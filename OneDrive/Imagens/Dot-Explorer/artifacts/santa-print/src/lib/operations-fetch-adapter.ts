import { getMachinesResponse, getTechniciansResponse } from "./operations-analytics"

let installed = false

function resolveUrl(input: RequestInfo | URL): URL | null {
  if (typeof input === "string") return new URL(input, window.location.origin)
  if (input instanceof URL) return input
  if (typeof Request !== "undefined" && input instanceof Request) {
    return new URL(input.url, window.location.origin)
  }
  return null
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  })
}

export function installOperationsAnalyticsAdapter(): void {
  if (installed) return
  installed = true

  const previousFetch = window.fetch.bind(window)

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = resolveUrl(input)
    const method = String(init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase()

    if (
      url &&
      url.origin === window.location.origin &&
      method === "GET" &&
      (url.pathname === "/api/maquinas" || url.pathname === "/api/tecnicos")
    ) {
      const query = Object.fromEntries(url.searchParams.entries())

      try {
        const data = url.pathname === "/api/maquinas"
          ? await getMachinesResponse(query)
          : await getTechniciansResponse(query)

        return jsonResponse(data)
      } catch (error) {
        console.error("Falha ao gerar análise operacional", error)
        return jsonResponse(
          { message: error instanceof Error ? error.message : "Erro desconhecido ao analisar o Supabase" },
          500,
        )
      }
    }

    return previousFetch(input, init)
  }
}
