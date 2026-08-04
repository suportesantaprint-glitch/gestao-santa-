import { Router, type IRouter } from "express";
import { supabaseCount } from "../lib/supabase";

const router: IRouter = Router();

const STATUS_LIST = [
  "Em Análise",
  "Concluído",
  "Cancelado",
  "Aguardando Peça",
  "Para Conserto",
] as const;

const EQUIPAMENTO_LIST = [
  "MULTIFUNCIONAL",
  "IMPRESSORA",
  "SCANNERS",
  "ETIQUETA",
  "ZEBRA",
] as const;

function baseChamadasParams(query: Record<string, string>): URLSearchParams {
  const p = new URLSearchParams();
  if (query.dataInicio) p.append("emissao", `gte.${query.dataInicio}`);
  if (query.dataFim) p.append("emissao", `lte.${query.dataFim}T23:59:59`);
  return p;
}

// GET /api/dashboard/resumo
router.get("/dashboard/resumo", async (req, res): Promise<void> => {
  const q = req.query as Record<string, string>;
  const today = new Date().toISOString().split("T")[0]!;

  const base = baseChamadasParams(q);

  const [total, emAnalise, concluidas, canceladas, aguardandoPeca, paraConserto, hojeAbertas, hojeFechadas] =
    await Promise.all([
      supabaseCount("zenthi_chamadas", base),
      supabaseCount("zenthi_chamadas", new URLSearchParams([...base, ["situacao_zenthi", "eq.Em Análise"]])),
      supabaseCount("zenthi_chamadas", new URLSearchParams([...base, ["situacao_zenthi", "eq.Concluído"]])),
      supabaseCount("zenthi_chamadas", new URLSearchParams([...base, ["situacao_zenthi", "eq.Cancelado"]])),
      supabaseCount("zenthi_chamadas", new URLSearchParams([...base, ["situacao_zenthi", "eq.Aguardando Peça"]])),
      supabaseCount("zenthi_chamadas", new URLSearchParams([...base, ["situacao_zenthi", "eq.Para Conserto"]])),
      supabaseCount("zenthi_chamadas", new URLSearchParams([["emissao", `gte.${today}`]])),
      supabaseCount("zenthi_chamadas", new URLSearchParams([["encerramento", `gte.${today}`]])),
    ]);

  res.json({ total, emAnalise, concluidas, canceladas, aguardandoPeca, paraConserto, hojeAbertas, hojeFechadas });
});

// GET /api/dashboard/por-status
router.get("/dashboard/por-status", async (req, res): Promise<void> => {
  const q = req.query as Record<string, string>;
  const base = baseChamadasParams(q);

  const counts = await Promise.all(
    STATUS_LIST.map((s) =>
      supabaseCount("zenthi_chamadas", new URLSearchParams([...base, ["situacao_zenthi", `eq.${s}`]])),
    ),
  );

  const result = STATUS_LIST.map((s, i) => ({ situacao: s, total: counts[i]! }));
  res.json(result);
});

// GET /api/dashboard/por-equipamento
router.get("/dashboard/por-equipamento", async (req, res): Promise<void> => {
  const q = req.query as Record<string, string>;
  const base = baseChamadasParams(q);

  const counts = await Promise.all(
    EQUIPAMENTO_LIST.map((e) =>
      supabaseCount("zenthi_chamadas", new URLSearchParams([...base, ["desc_tipo_equipamento", `eq.${e}`]])),
    ),
  );

  const result = EQUIPAMENTO_LIST.map((e, i) => ({ tipo: e, total: counts[i]! })).filter((r) => r.total > 0);
  res.json(result);
});

// GET /api/dashboard/recentes
router.get("/dashboard/recentes", async (req, res): Promise<void> => {
  const p = new URLSearchParams();
  p.set("order", "emissao.desc");
  p.set("limit", "10");

  const { supabaseFetch } = await import("../lib/supabase");
  const { data } = await supabaseFetch("zenthi_chamadas", p);
  res.json(data);
});

export default router;
