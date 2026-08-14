import { Router, type IRouter } from "express";
import { supabaseFetch } from "../lib/supabase";

const router: IRouter = Router();
const CHAMADAS_SOURCE = "zenthi_chamadas_unicas";

let cachedOpcoes: unknown = null;
let cacheExpiry = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// GET /api/filtros/opcoes
router.get("/filtros/opcoes", async (req, res): Promise<void> => {
  if (cachedOpcoes && Date.now() < cacheExpiry) {
    res.json(cachedOpcoes);
    return;
  }

  // Fetch unique values for dynamic filters in parallel
  const [marcasRes, cidadesRes, tecnicosRes] = await Promise.all([
    supabaseFetch<{ marca: string }>(
      CHAMADAS_SOURCE,
      new URLSearchParams([["select", "marca"], ["order", "marca.asc"], ["limit", "500"]]),
    ),
    supabaseFetch<{ cidade: string }>(
      CHAMADAS_SOURCE,
      new URLSearchParams([["select", "cidade"], ["order", "cidade.asc"], ["limit", "500"]]),
    ),
    supabaseFetch<{ email_tecnico: string }>(
      CHAMADAS_SOURCE,
      new URLSearchParams([["select", "email_tecnico"], ["order", "email_tecnico.asc"], ["limit", "500"]]),
    ),
  ]);

  const marcas = [...new Set(marcasRes.data.map((r) => r.marca).filter(Boolean))].sort();
  const cidades = [...new Set(cidadesRes.data.map((r) => r.cidade).filter(Boolean))].sort();
  const tecnicos = [...new Set(tecnicosRes.data.map((r) => r.email_tecnico).filter(Boolean))].sort();

  const opcoes = {
    situacoes: ["Em Análise", "Concluído", "Cancelado", "Aguardando Peça", "Para Conserto"],
    tiposEquipamento: ["MULTIFUNCIONAL", "IMPRESSORA", "SCANNERS", "ETIQUETA", "ZEBRA"],
    tiposContrato: ["Contrato", "Normal"],
    tiposEntrada: ["Interna", "Externa"],
    marcas,
    cidades,
    tecnicos,
  };

  cachedOpcoes = opcoes;
  cacheExpiry = Date.now() + CACHE_TTL_MS;

  res.json(opcoes);
});

export default router;
