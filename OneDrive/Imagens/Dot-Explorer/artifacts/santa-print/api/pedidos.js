const VIEW_NAME = "v_coml_pedido_itens";
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

function getEnv(...names) {
  for (const name of names) {
    const value = process.env[name]?.trim();
    if (value) return value;
  }
  return "";
}

function requireEnv(...names) {
  const value = getEnv(...names);
  if (!value) {
    throw new Error(`${names.join(" ou ")} environment variable is not set`);
  }
  return value;
}

function parsePositiveInteger(value, fallback) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function addFilter(params, key, value, operator) {
  const normalized = value?.trim();
  if (!normalized) return;
  params.append(key, operator === "ilike" ? `ilike.*${normalized}*` : `eq.${normalized}`);
}

async function queryPedidos(params, key) {
  const supabaseUrl = requireEnv("SUPABASE_URL", "VITE_SUPABASE_URL").replace(/\/+$/, "");
  const endpoint = `${supabaseUrl}/rest/v1/${VIEW_NAME}?${params.toString()}`;

  const response = await fetch(endpoint, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      Accept: "application/json",
      Prefer: "count=exact",
    },
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Supabase ${response.status}: ${details}`);
  }

  const data = await response.json();
  const contentRange = response.headers.get("content-range") ?? "";
  const total = Number.parseInt(contentRange.split("/")[1] ?? "0", 10) || 0;
  return { data, total };
}

async function fetchPedidos(params) {
  const secretKey = getEnv("SUPABASE_SECRET_KEY");
  const publicKey = getEnv(
    "SUPABASE_PUBLISHABLE_KEY",
    "VITE_SUPABASE_ANON_KEY",
  );

  if (!secretKey && !publicKey) {
    throw new Error(
      "SUPABASE_SECRET_KEY, SUPABASE_PUBLISHABLE_KEY ou VITE_SUPABASE_ANON_KEY não configurada",
    );
  }

  // Prefere a credencial server-side. Algumas views, porém, são definidas com
  // regras dependentes do papel anon/authenticated. Nesses casos o service role
  // pode retornar zero linhas mesmo quando a chave pública enxerga a view.
  if (secretKey) {
    const result = await queryPedidos(params, secretKey);
    if (result.data.length > 0 || !publicKey || publicKey === secretKey) {
      return result;
    }
  }

  if (publicKey) {
    return queryPedidos(params, publicKey);
  }

  return { data: [], total: 0 };
}

function sendJson(res, statusCode, body) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "private, no-store, max-age=0");
  res.end(JSON.stringify(body));
}

export default async function handler(req, res) {
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
