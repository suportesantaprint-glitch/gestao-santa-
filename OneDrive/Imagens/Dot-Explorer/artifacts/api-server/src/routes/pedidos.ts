import { Router, type IRouter } from "express";
import { supabaseFetch } from "../lib/supabase";

const router: IRouter = Router();

// GET /api/pedidos
router.get("/pedidos", async (req, res): Promise<void> => {
  const q = req.query as Record<string, string>;
  const page = Math.max(1, parseInt(q.page ?? "1", 10) || 1);
  const limit = Math.min(200, Math.max(1, parseInt(q.limit ?? "50", 10) || 50));

  const p = new URLSearchParams();
  if (q.mesAno) p.append("mes_ano", `eq.${q.mesAno}`);
  if (q.cliente) p.append("nome_cliente", `ilike.*${q.cliente}*`);
  if (q.representante) p.append("nome_repres", `ilike.*${q.representante}*`);
  if (q.formaPagto) p.append("forma_pagto", `eq.${q.formaPagto}`);

  p.set("order", "data_emissao.desc");
  p.set("limit", String(limit));
  p.set("offset", String((page - 1) * limit));

  const { data, total } = await supabaseFetch("v_coml_pedido_itens", p);
  res.json({ data, total, page, limit });
});

export default router;
