import { downloadProfessionalExcel } from "./professional-excel-export"

let installed = false

export function installSupabaseExportOpenAdapter(): void {
  if (installed) return
  installed = true

  const nativeOpen = window.open.bind(window)

  window.open = ((url?: string | URL, target?: string, features?: string) => {
    if (url) {
      const resolved = new URL(String(url), window.location.origin)
      const exports = {
        "/api/chamadas/exportar": { type: "chamadas" as const, filename: "relatorio-chamadas-santa-print.xlsx" },
        "/api/pecas/exportar": { type: "pecas" as const, filename: "relatorio-pecas-santa-print.xlsx" },
      }
      const configuration = exports[resolved.pathname as keyof typeof exports]

      if (resolved.origin === window.location.origin && configuration) {
        void downloadProfessionalExcel(
          `${resolved.pathname}${resolved.search}`,
          configuration.type,
          configuration.filename,
        ).catch((error) => {
          console.error("Falha ao gerar relatório Excel", error)
          window.alert(error instanceof Error ? error.message : "Falha ao gerar relatório Excel")
        })
        return null
      }
    }

    return nativeOpen(url, target, features)
  }) as typeof window.open
}
