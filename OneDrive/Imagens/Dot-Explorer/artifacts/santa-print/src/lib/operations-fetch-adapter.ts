import { getMachinesResponse, getTechniciansResponse } from "./operations-analytics"
import { getPartsLifecycleResponse } from "./parts-lifecycle-analytics"

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
    const supportedPaths = new Set(["/api/maquinas", "/api/tecnicos", "/api/pecas/ciclo-vida"])

    if (
      url &&
      url.origin === window.location.origin &&
      method === "GET" &&
      supportedPaths.has(url.pathname)
    ) {
      const query = Object.fromEntries(url.searchParams.entries())

      try {
        let data: unknown
        if (url.pathname === "/api/maquinas") data = await getMachinesResponse(query)
        else if (url.pathname === "/api/tecnicos") data = await getTechniciansResponse(query)
        else data = await getPartsLifecycleResponse(query)

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
