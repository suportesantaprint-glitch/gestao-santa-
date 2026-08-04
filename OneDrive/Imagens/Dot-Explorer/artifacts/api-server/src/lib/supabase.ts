import { logger } from "./logger";

function requireEnv(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`${key} environment variable is not set`);
  return val;
}

function getHeaders(): Record<string, string> {
  return {
    apikey: requireEnv("SUPABASE_SECRET_KEY"),
    Authorization: `Bearer ${requireEnv("SUPABASE_SECRET_KEY")}`,
    "Content-Type": "application/json",
    Prefer: "count=exact",
  };
}

function getBaseUrl(): string {
  return `${requireEnv("SUPABASE_URL")}/rest/v1`;
}

export async function supabaseFetch<T = unknown>(
  table: string,
  params: URLSearchParams,
): Promise<{ data: T[]; total: number }> {
  const url = `${getBaseUrl()}/${table}?${params.toString()}`;
  logger.debug({ table }, "supabase fetch");

  const response = await fetch(url, { headers: getHeaders() });

  if (!response.ok) {
    const body = await response.text();
    logger.error({ status: response.status, body }, "supabase error");
    throw new Error(`Supabase error ${response.status}: ${body}`);
  }

  const data = (await response.json()) as T[];
  const cr = response.headers.get("content-range") ?? "";
  const total = parseInt(cr.split("/")[1] ?? "0", 10) || 0;

  return { data, total };
}

export async function supabaseCount(
  table: string,
  params: URLSearchParams,
): Promise<number> {
  const p = new URLSearchParams(params);
  p.set("limit", "1");

  const url = `${getBaseUrl()}/${table}?${p.toString()}`;
  const response = await fetch(url, { headers: getHeaders() });
  if (!response.ok) {
    await response.text();
    return 0;
  }
  await response.text();
  const cr = response.headers.get("content-range") ?? "";
  const n = parseInt(cr.split("/")[1] ?? "0", 10);
  return isNaN(n) ? 0 : n;
}
