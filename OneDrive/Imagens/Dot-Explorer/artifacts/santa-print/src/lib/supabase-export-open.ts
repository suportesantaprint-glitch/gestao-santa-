import { downloadApiExport } from "./supabase-fetch-adapter";

let installed = false;

export function installSupabaseExportOpenAdapter(): void {
  if (installed) return;
  installed = true;

  const nativeOpen = window.open.bind(window);

  window.open = ((url?: string | URL, target?: string, features?: string) => {
    if (url) {
      const resolved = new URL(String(url), window.location.origin);
      const exports: Record<string, string> = {
        "/api/chamadas/exportar": "chamadas.csv",
        "/api/pecas/exportar": "pecas.csv",
      };
      const filename = exports[resolved.pathname];

      if (resolved.origin === window.location.origin && filename) {
        void downloadApiExport(`${resolved.pathname}${resolved.search}`, filename).catch((error) => {
          console.error("Falha ao exportar dados do Supabase", error);
          window.alert(error instanceof Error ? error.message : "Falha ao exportar dados");
        });
        return null;
      }
    }

    return nativeOpen(url, target, features);
  }) as typeof window.open;
}
