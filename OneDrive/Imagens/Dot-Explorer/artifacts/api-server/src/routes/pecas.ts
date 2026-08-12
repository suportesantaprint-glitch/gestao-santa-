import { Router, type IRouter } from "express";
import { buildProfessionalExcel, type ExcelColumn } from "../lib/excel";
import { supabaseFetch } from "../lib/supabase";

const router: IRouter = Router();

function buildPecasParams(query: Record<string, string>): URLSearchParams {
  const p = new URLSearchParams();
  const { chamadaNumero, descProduto, marca, dataInicio, dataFim } = query;

  if (chamadaNumero) p.append("chamada_number", `eq.${chamadaNumero}`);
  if (descProduto) p.append("desc_produto", `ilike.*${descProduto}*`);
  if (marca) p.append("desc_marca", `eq.${marca}`);
  if (dataInicio) p.append("data_abertura", `gte.${dataInicio}`);
  if (dataFim) p.append("data_abertura", `lte.${dataFim}T23:59:59`);

  return p;
}

const exportColumns: ExcelColumn[] = [
  { key: "chamada_number", header: "Nº Chamada", width: 14, type: "integer" },
  { key: "data_abertura", header: "Data Abertura", width: 20, type: "datetime" },
  { key: "desc_produto", header: "Produto", width: 38 },
  { key: "desc_marca", header: "Marca", width: 20 },
  { key: "modelo_equip", header: "Modelo", width: 24 },
  { key: "qtdem", header: "Qtd", width: 10, type: "decimal" },
  { key: "preco_unitario", header: "Preço Unit.", width: 16, type: "currency" },
  { key: "valor_item", header: "Valor Item", width: 16, type: "currency" },
  { key: "valor_custo", header: "Custo", width: 16, type: "currency" },
  { key: "movimentou_estoque", header: "Movimentou Estoque", width: 22 },
  { key: "defeito_equip", header: "Defeito", width: 42 },
  { key: "garantia", header: "Garantia", width: 16 },
];

// GET /api/pecas
router.get("/pecas", async (req, res): Promise<void> => {
  const q = req.query as Record<string, string>;
  const page = Math.max(1, parseInt(q.page ?? "1", 10) || 1);
  const limit = Math.min(200, Math.max(1, parseInt(q.limit ?? "50", 10) || 50));

  const filters = buildPecasParams(q);
  filters.set("order", "data_abertura.desc");
  filters.set("limit", String(limit));
  filters.set("offset", String((page - 1) * limit));

  const { data, total } = await supabaseFetch("zenthi_pecas", filters);
  res.json({ data, total, page, limit });
});

// GET /api/pecas/exportar
router.get("/pecas/exportar", async (req, res): Promise<void> => {
  const q = req.query as Record<string, string>;
  const filters = buildPecasParams(q);
  filters.set("order", "data_abertura.desc");
  filters.set("limit", "5000");
  filters.set("offset", "0");

  const { data } = await supabaseFetch<Record<string, unknown>>("zenthi_pecas", filters);

  const buf = buildProfessionalExcel({
    sheetName: "Peças",
    title: "Relatório de Consumo de Peças",
    columns: exportColumns,
    rows: data,
  });

  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", 'attachment; filename="pecas.xlsx"');
  res.setHeader("Cache-Control", "no-store");
  res.send(buf);
});

export default router;
