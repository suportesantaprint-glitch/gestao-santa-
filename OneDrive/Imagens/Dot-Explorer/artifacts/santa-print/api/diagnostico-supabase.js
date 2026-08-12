function requireEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} environment variable is not set`);
  return value;
}

async function countRows(table, key) {
  const baseUrl = requireEnv("SUPABASE_URL").replace(/\/+$/, "");
  const response = await fetch(`${baseUrl}/rest/v1/${table}?select=*&limit=1`, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      Prefer: "count=exact",
      Accept: "application/json",
    },
  });
  const body = await response.text();
  if (!response.ok) return { ok: false, status: response.status, detail: body.slice(0, 300) };
  const total = Number.parseInt((response.headers.get("content-range") ?? "").split("/")[1] ?? "0", 10) || 0;
  return { ok: true, total };
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.statusCode = 405;
    res.end();
    return;
  }
  try {
    const key = requireEnv("SUPABASE_SECRET_KEY");
    const host = new URL(requireEnv("SUPABASE_URL")).hostname;
    const [chamadas, pedidos] = await Promise.all([
      countRows("zenthi_chamadas", key),
      countRows("v_coml_pedido_itens", key),
    ]);
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Cache-Control", "no-store");
    res.end(JSON.stringify({ host, chamadas, pedidos }));
  } catch (error) {
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: error instanceof Error ? error.message : "Erro desconhecido" }));
  }
}
