import type { IncomingMessage, ServerResponse } from "node:http";

const VIEW_NAME = "v_coml_pedido_itens";
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

type Pedido = Record<string, unknown>;

type SupabaseResult<T> = {
  data: T[];
  total: number;
};

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`${name} environment variable is not set`);
  }

  return value;
}

function parsePositiveInteger(value: string | null, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function addFilter(
  params: URLSearchParams,
  key: string,
  value: string | null,
  operator: "eq" | "ilike",
): void {
  const normalized = value?.trim();

  if (!normalized) return;

  params.append(key, operator === "ilike" ? `ilike.*${normalized}*` : `eq.${normalized}`);
}

async function fetchPedidos(params: URLSearchParams): Promise<SupabaseResult<Pedido>> {
  const supabaseUrl = requireEnv("SUPABASE_URL").replace(/\/+$/, "");
  const secretKey = requireEnv("SUPABASE_SECRET_KEY");
  const endpoint = `${supabaseUrl}/rest/v1/${VIEW_NAME}?${params.toString()}`;

  const response = await fetch(endpoint, {
    headers: {
      apikey: secretKey,
      Authorization: `Bearer ${secretKey}`,
      Accept: "application/json",
      Prefer: "count=exact",
    },
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Supabase ${response.status}: ${details}`);
  }

  const data = (await response.json()) as Pedido[];
  const contentRange = response.headers.get("content-range") ?? "";
  const total = Number.parseInt(contentRange.split("/")[1] ?? "0", 10) || 0;

  return { data, total };
}

function sendJson(res: ServerResponse, statusCode: number, body: unknown): void {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "private, no-store, max-age=0");
  res.end(JSON.stringify(body));
}

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    sendJson(res, 405, { error: "Método não permitido" });
    return;
  }

  try {
    const requestUrl = new URL(req.url ?? "/api/pedidos", "http://localhost");
    const page = parsePositiveInteger(requestUrl.searchParams.get("page"), 1);
    const requestedLimit = parsePositiveInteger(requestUrl.searchParams.get("limit"), DEFAULT_LIMIT);
    const limit = Math.min(MAX_LIMIT, requestedLimit);

    const params = new URLSearchParams();
    addFilter(params, "mes_ano", requestUrl.searchParams.get("mesAno"), "eq");
    addFilter(params, "nome_cliente", requestUrl.searchParams.get("cliente"), "ilike");
    addFilter(params, "nome_repres", requestUrl.searchParams.get("representante"), "ilike");
    addFilter(params, "forma_pagto", requestUrl.searchParams.get("formaPagto"), "eq");
    params.set("order", "data_emissao.desc");
    params.set("limit", String(limit));
    params.set("offset", String((page - 1) * limit));

    const { data, total } = await fetchPedidos(params);

    sendJson(res, 200, { data, total, page, limit });
  } catch (error) {
    console.error("Falha ao carregar pedidos", error);

    sendJson(res, 500, {
      error: "Não foi possível carregar os pedidos.",
      detail: error instanceof Error ? error.message : "Erro desconhecido",
    });
  }
}
