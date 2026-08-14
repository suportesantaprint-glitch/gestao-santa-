type QueryValue = string | number | undefined;

type PaginatedResult<T> = {
  data: T[];
  total: number;
  page: number;
  limit: number;
};

const CHAMADAS_SOURCE = "zenthi_chamadas_santa_print";
const PECAS_SOURCE = "zenthi_pecas_santa_print";

const STATUS_LIST = [
  "Em Análise",
  "Concluído",
  "Cancelado",
  "Aguardando Peça",
  "Para Conserto",
] as const;

const EQUIPMENT_LIST = [
  "MULTIFUNCIONAL",
  "IMPRESSORA",
  "SCANNERS",
  "ETIQUETA",
  "ZEBRA",
] as const;

let originalFetch: typeof window.fetch | null = null;
let installed = false;

function getConfiguration(): { url: string; key: string } {
  const url = String(import.meta.env.VITE_SUPABASE_URL ?? "").replace(/\/+$/, "");
  const key = String(import.meta.env.VITE_SUPABASE_ANON_KEY ?? "");

  if (!url || !key) {
    throw new Error(
      "Supabase não configurado. Defina SUPABASE_URL e SUPABASE_PUBLISHABLE_KEY " +
        "(ou VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY) na Vercel.",
    );
  }

  return { url, key };
}

function getNativeFetch(): typeof window.fetch {
  if (!originalFetch) {
    originalFetch = window.fetch.bind(window);
  }
  return originalFetch;
}

function supabaseHeaders(extra?: HeadersInit): Headers {
  const { key } = getConfiguration();
  const headers = new Headers(extra);
  headers.set("apikey", key);
  headers.set("Authorization", `Bearer ${key}`);
  headers.set("Accept", "application/json");
  headers.set("Prefer", "count=exact");
  return headers;
}

async function queryTable<T>(
  table: string,
  params: URLSearchParams,
): Promise<{ data: T[]; total: number }> {
  const { url } = getConfiguration();
  const response = await getNativeFetch()(
    `${url}/rest/v1/${encodeURIComponent(table)}?${params.toString()}`,
    { headers: supabaseHeaders() },
  );

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Supabase ${response.status}: ${details}`);
  }

  const data = (await response.json()) as T[];
  const contentRange = response.headers.get("content-range") ?? "";
  const total = Number.parseInt(contentRange.split("/")[1] ?? "0", 10) || 0;
  return { data, total };
}

async function countTable(table: string, params: URLSearchParams): Promise<number> {
  const query = new URLSearchParams(params);
  query.set("limit", "1");
  const result = await queryTable(table, query);
  return result.total;
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

function queryRecord(url: URL): Record<string, string> {
  return Object.fromEntries(url.searchParams.entries());
}

function pagination(query: Record<string, string>): { page: number; limit: number } {
  const page = Math.max(1, Number.parseInt(query.page ?? "1", 10) || 1);
  const limit = Math.min(200, Math.max(1, Number.parseInt(query.limit ?? "50", 10) || 50));
  return { page, limit };
}

function addParam(params: URLSearchParams, key: string, value: QueryValue): void {
  if (value !== undefined && value !== "") {
    params.append(key, String(value));
  }
}

function chamadasFilters(query: Record<string, string>): URLSearchParams {
  const params = new URLSearchParams();
  addParam(params, "situacao_zenthi", query.situacao ? `eq.${query.situacao}` : undefined);
  addParam(params, "emissao", query.dataInicio ? `gte.${query.dataInicio}` : undefined);
  addParam(params, "emissao", query.dataFim ? `lte.${query.dataFim}T23:59:59` : undefined);
  addParam(
    params,
    "desc_tipo_equipamento",
    query.tipoEquipamento ? `eq.${query.tipoEquipamento}` : undefined,
  );
  addParam(params, "tipo_contrato", query.tipoContrato ? `eq.${query.tipoContrato}` : undefined);
  addParam(params, "tipo_entrada", query.tipoEntrada ? `eq.${query.tipoEntrada}` : undefined);
  addParam(params, "marca", query.marca ? `eq.${query.marca}` : undefined);
  addParam(params, "cidade", query.cidade ? `ilike.*${query.cidade}*` : undefined);
  addParam(params, "razao_social", query.cliente ? `ilike.*${query.cliente}*` : undefined);
  addParam(params, "email_tecnico", query.tecnico ? `ilike.*${query.tecnico}*` : undefined);
  return params;
}

function pecasFilters(query: Record<string, string>): URLSearchParams {
  const params = new URLSearchParams();
  addParam(
    params,
    "chamada_number",
    query.chamadaNumero ? `eq.${query.chamadaNumero}` : undefined,
  );
  addParam(params, "desc_produto", query.descProduto ? `ilike.*${query.descProduto}*` : undefined);
  addParam(params, "desc_marca", query.marca ? `eq.${query.marca}` : undefined);
  addParam(params, "data_abertura", query.dataInicio ? `gte.${query.dataInicio}` : undefined);
  addParam(
    params,
    "data_abertura",
    query.dataFim ? `lte.${query.dataFim}T23:59:59` : undefined,
  );
  return params;
}

function dashboardBase(query: Record<string, string>): URLSearchParams {
  const params = new URLSearchParams();
  addParam(params, "emissao", query.dataInicio ? `gte.${query.dataInicio}` : undefined);
  addParam(params, "emissao", query.dataFim ? `lte.${query.dataFim}T23:59:59` : undefined);
  return params;
}

async function dashboardResumo(query: Record<string, string>): Promise<unknown> {
  const today = new Date().toISOString().split("T")[0] ?? "";
  const base = dashboardBase(query);

  const withStatus = (status: string): URLSearchParams =>
    new URLSearchParams([...base, ["situacao_zenthi", `eq.${status}`]]);

  const [
    total,
    emAnalise,
    concluidas,
    canceladas,
    aguardandoPeca,
    paraConserto,
    hojeAbertas,
    hojeFechadas,
  ] = await Promise.all([
    countTable(CHAMADAS_SOURCE, base),
    countTable(CHAMADAS_SOURCE, withStatus("Em Análise")),
    countTable(CHAMADAS_SOURCE, withStatus("Concluído")),
    countTable(CHAMADAS_SOURCE, withStatus("Cancelado")),
    countTable(CHAMADAS_SOURCE, withStatus("Aguardando Peça")),
    countTable(CHAMADAS_SOURCE, withStatus("Para Conserto")),
    countTable(CHAMADAS_SOURCE, new URLSearchParams([["emissao", `gte.${today}`]])),
    countTable(CHAMADAS_SOURCE, new URLSearchParams([["encerramento", `gte.${today}`]])),
  ]);

  return {
    total,
    emAnalise,
    concluidas,
    canceladas,
    aguardandoPeca,
    paraConserto,
    hojeAbertas,
    hojeFechadas,
  };
}

async function dashboardStatus(query: Record<string, string>): Promise<unknown> {
  const base = dashboardBase(query);
  const counts = await Promise.all(
    STATUS_LIST.map((status) =>
      countTable(
        CHAMADAS_SOURCE,
        new URLSearchParams([...base, ["situacao_zenthi", `eq.${status}`]]),
      ),
    ),
  );
  return STATUS_LIST.map((situacao, index) => ({ situacao, total: counts[index] ?? 0 }));
}

async function dashboardEquipment(query: Record<string, string>): Promise<unknown> {
  const base = dashboardBase(query);
  const counts = await Promise.all(
    EQUIPMENT_LIST.map((equipment) =>
      countTable(
        CHAMADAS_SOURCE,
        new URLSearchParams([
          ...base,
          ["desc_tipo_equipamento", `eq.${equipment}`],
        ]),
      ),
    ),
  );

  return EQUIPMENT_LIST.map((tipo, index) => ({ tipo, total: counts[index] ?? 0 })).filter(
    (item) => item.total > 0,
  );
}

async function listChamadas(query: Record<string, string>): Promise<PaginatedResult<unknown>> {
  const { page, limit } = pagination(query);
  const params = chamadasFilters(query);
  params.set("order", "emissao.desc");
  params.set("limit", String(limit));
  params.set("offset", String((page - 1) * limit));
  const { data, total } = await queryTable(CHAMADAS_SOURCE, params);
  return { data, total, page, limit };
}

async function listPecas(query: Record<string, string>): Promise<PaginatedResult<unknown>> {
  const { page, limit } = pagination(query);
  const params = pecasFilters(query);
  params.set("order", "data_abertura.desc");
  params.set("limit", String(limit));
  params.set("offset", String((page - 1) * limit));
  const { data, total } = await queryTable(PECAS_SOURCE, params);
  return { data, total, page, limit };
}

async function listPedidos(query: Record<string, string>): Promise<PaginatedResult<unknown>> {
  const { page, limit } = pagination(query);
  const params = new URLSearchParams();
  params.set("empresa", "eq.1");
  addParam(params, "mes_ano", query.mesAno ? `eq.${query.mesAno}` : undefined);
  addParam(params, "nome_cliente", query.cliente ? `ilike.*${query.cliente}*` : undefined);
  addParam(
    params,
    "nome_repres",
    query.representante ? `ilike.*${query.representante}*` : undefined,
  );
  addParam(params, "forma_pagto", query.formaPagto ? `eq.${query.formaPagto}` : undefined);
  params.set("order", "data_emissao.desc");
  params.set("limit", String(limit));
  params.set("offset", String((page - 1) * limit));
  const { data, total } = await queryTable("v_coml_pedido_itens", params);
  return { data, total, page, limit };
}

async function listContratos(query: Record<string, string>): Promise<PaginatedResult<unknown>> {
  const { page, limit } = pagination(query);
  const params = new URLSearchParams();
  params.set("empresa", "eq.1");
  params.set("filial", "eq.2");
  addParam(params, "tipo_contrato", query.tipoContrato ? `eq.${query.tipoContrato}` : undefined);
  params.set("limit", String(limit));
  params.set("offset", String((page - 1) * limit));
  const { data, total } = await queryTable("vw_contratos_locacao", params);
  return { data, total, page, limit };
}

async function filtrosOpcoes(): Promise<unknown> {
  const [marcasResult, cidadesResult, tecnicosResult] = await Promise.all([
    queryTable<{ marca: string }>(
      CHAMADAS_SOURCE,
      new URLSearchParams([
        ["select", "marca"],
        ["order", "marca.asc"],
        ["limit", "1000"],
      ]),
    ),
    queryTable<{ cidade: string }>(
      CHAMADAS_SOURCE,
      new URLSearchParams([
        ["select", "cidade"],
        ["order", "cidade.asc"],
        ["limit", "1000"],
      ]),
    ),
    queryTable<{ email_tecnico: string }>(
      CHAMADAS_SOURCE,
      new URLSearchParams([
        ["select", "email_tecnico"],
        ["order", "email_tecnico.asc"],
        ["limit", "1000"],
      ]),
    ),
  ]);

  const unique = (values: Array<string | null | undefined>): string[] =>
    [...new Set(values.filter((value): value is string => Boolean(value)))].sort();

  return {
    situacoes: [...STATUS_LIST],
    tiposEquipamento: [...EQUIPMENT_LIST],
    tiposContrato: ["Contrato", "Normal"],
    tiposEntrada: ["Interna", "Externa"],
    marcas: unique(marcasResult.data.map((item) => item.marca)),
    cidades: unique(cidadesResult.data.map((item) => item.cidade)),
    tecnicos: unique(tecnicosResult.data.map((item) => item.email_tecnico)),
  };
}

function csvCell(value: unknown): string {
  const text = value == null ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function csvResponse(rows: Array<Record<string, unknown>>): Response {
  const columns = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  const lines = [
    columns.map(csvCell).join(";"),
    ...rows.map((row) => columns.map((column) => csvCell(row[column])).join(";")),
  ];
  return new Response(`\uFEFF${lines.join("\r\n")}`, {
    status: 200,
    headers: { "Content-Type": "text/csv; charset=utf-8" },
  });
}

async function handleApiRequest(url: URL): Promise<Response> {
  const query = queryRecord(url);
  const path = url.pathname.replace(/^\/api\/?/, "");

  if (path === "healthz") return jsonResponse({ status: "ok", source: "supabase" });
  if (path === "dashboard/resumo") return jsonResponse(await dashboardResumo(query));
  if (path === "dashboard/por-status") return jsonResponse(await dashboardStatus(query));
  if (path === "dashboard/por-equipamento") {
    return jsonResponse(await dashboardEquipment(query));
  }
  if (path === "dashboard/recentes") {
    const params = new URLSearchParams([
      ["order", "emissao.desc"],
      ["limit", "10"],
    ]);
    return jsonResponse((await queryTable(CHAMADAS_SOURCE, params)).data);
  }
  if (path === "filtros/opcoes") return jsonResponse(await filtrosOpcoes());

  if (path === "chamadas/exportar") {
    const params = chamadasFilters(query);
    params.set("order", "emissao.desc");
    params.set("limit", "10000");
    return csvResponse(
      (await queryTable<Record<string, unknown>>(CHAMADAS_SOURCE, params)).data,
    );
  }
  if (path === "chamadas") return jsonResponse(await listChamadas(query));
  if (path.startsWith("chamadas/")) {
    const codigo = path.slice("chamadas/".length);
    if (!/^\d+$/.test(codigo)) return jsonResponse({ error: "Código inválido" }, 400);
    const params = new URLSearchParams([
      ["codigo", `eq.${codigo}`],
      ["limit", "1"],
    ]);
    const data = (await queryTable(CHAMADAS_SOURCE, params)).data;
    return data.length ? jsonResponse(data[0]) : jsonResponse({ error: "Chamada não encontrada" }, 404);
  }

  if (path === "pecas/exportar") {
    const params = pecasFilters(query);
    params.set("order", "data_abertura.desc");
    params.set("limit", "5000");
    return csvResponse((await queryTable<Record<string, unknown>>(PECAS_SOURCE, params)).data);
  }
  if (path === "pecas") return jsonResponse(await listPecas(query));
  if (path === "pedidos") return jsonResponse(await listPedidos(query));
  if (path === "contratos") return jsonResponse(await listContratos(query));

  return jsonResponse({ error: `Endpoint não encontrado: /api/${path}` }, 404);
}

function resolveUrl(input: RequestInfo | URL): URL | null {
  if (typeof input === "string") return new URL(input, window.location.origin);
  if (input instanceof URL) return input;
  if (typeof Request !== "undefined" && input instanceof Request) {
    return new URL(input.url, window.location.origin);
  }
  return null;
}

export function installSupabaseFetchAdapter(): void {
  if (installed) return;
  installed = true;

  const nativeFetch = getNativeFetch();
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = resolveUrl(input);
    const method = String(init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();

    if (
      url &&
      url.origin === window.location.origin &&
      url.pathname.startsWith("/api/") &&
      method === "GET"
    ) {
      // Em produção, Pedidos usa uma função serverless real da Vercel. A view
      // v_coml_pedido_itens não deve depender de acesso público/anon no navegador.
      if (import.meta.env.PROD && url.pathname === "/api/pedidos") {
        return nativeFetch(input, init);
      }

      try {
        return await handleApiRequest(url);
      } catch (error) {
        console.error("Falha ao consultar o Supabase", error);
        return jsonResponse(
          { message: error instanceof Error ? error.message : "Erro desconhecido no Supabase" },
          500,
        );
      }
    }

    return nativeFetch(input, init);
  };
}

export async function downloadApiExport(path: string, filename: string): Promise<void> {
  const response = await window.fetch(path);
  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Falha ao exportar: ${details}`);
  }

  const blob = await response.blob();
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(href);
}