const VIEW_NAME = "v_coml_pedido_itens";
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

function json(body, status = 200, origin = null) {
  const headers = new Headers({
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "private, no-store, max-age=0",
  });

  if (origin) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Vary", "Origin");
  }

  return new Response(JSON.stringify(body), { status, headers });
}

function getAllowedOrigin(request, env) {
  const origin = request.headers.get("Origin");
  if (!origin) return null;

  const allowed = String(env.ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  return allowed.includes(origin) ? origin : null;
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

function buildSupabaseHeaders(apiKey) {
  const headers = {
    apikey: apiKey,
    Accept: "application/json",
    Prefer: "count=exact",
  };

  // Chaves legadas service_role/anon são JWTs e aceitam Authorization Bearer.
  // As chaves atuais sb_secret_*/sb_publishable_* devem ser enviadas via apikey.
  if (!apiKey.startsWith("sb_secret_") && !apiKey.startsWith("sb_publishable_")) {
    headers.Authorization = `Bearer ${apiKey}`;
  }

  return headers;
}

async function fetchPedidos(requestUrl, env) {
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

  const supabaseUrl = String(env.SUPABASE_URL ?? "").replace(/\/+$/, "");
  const apiKey = String(env.SUPABASE_SECRET_KEY ?? "");

  if (!supabaseUrl || !apiKey) {
    throw new Error("Worker sem SUPABASE_URL ou SUPABASE_SECRET_KEY configurado");
  }

  const response = await fetch(`${supabaseUrl}/rest/v1/${VIEW_NAME}?${params.toString()}`, {
    headers: buildSupabaseHeaders(apiKey),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Supabase ${response.status}: ${detail}`);
  }

  const data = await response.json();
  const contentRange = response.headers.get("content-range") ?? "";
  const total = Number.parseInt(contentRange.split("/")[1] ?? "0", 10) || 0;

  return { data, total, page, limit };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const allowedOrigin = getAllowedOrigin(request, env);
    const requestOrigin = request.headers.get("Origin");

    if (requestOrigin && !allowedOrigin) {
      return json({ error: "Origem não autorizada" }, 403);
    }

    if (request.method === "OPTIONS") {
      const headers = new Headers({
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Max-Age": "86400",
      });
      if (allowedOrigin) {
        headers.set("Access-Control-Allow-Origin", allowedOrigin);
        headers.set("Vary", "Origin");
      }
      return new Response(null, { status: 204, headers });
    }

    if (request.method !== "GET") {
      return json({ error: "Método não permitido" }, 405, allowedOrigin);
    }

    if (url.pathname === "/healthz") {
      return json({ status: "ok", source: "cloudflare", view: VIEW_NAME }, 200, allowedOrigin);
    }

    if (url.pathname !== "/api/pedidos") {
      return json({ error: "Endpoint não encontrado" }, 404, allowedOrigin);
    }

    try {
      return json(await fetchPedidos(url, env), 200, allowedOrigin);
    } catch (error) {
      console.error("Falha ao carregar pedidos", error);
      return json(
        {
          error: "Não foi possível carregar os pedidos",
          detail: error instanceof Error ? error.message : "Erro desconhecido",
        },
        502,
        allowedOrigin,
      );
    }
  },
};
