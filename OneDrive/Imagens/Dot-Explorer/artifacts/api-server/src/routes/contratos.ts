import { Router, type IRouter } from "express";
import { supabaseFetch } from "../lib/supabase";

const router: IRouter = Router();

// GET /api/contratos
router.get("/contratos", async (req, res): Promise<void> => {
  const q = req.query as Record<string, string>;
  const page = Math.max(1, parseInt(q.page ?? "1", 10) || 1);
  const limit = Math.min(200, Math.max(1, parseInt(q.limit ?? "50", 10) || 50));

  const p = new URLSearchParams();
  if (q.tipoContrato) p.append("tipo_contrato", `eq.${q.tipoContrato}`);

  p.set("limit", String(limit));
  p.set("offset", String((page - 1) * limit));

  const { data, total } = await supabaseFetch("vw_contratos_locacao", p);
  res.json({ data, total, page, limit });
});

export default router;
