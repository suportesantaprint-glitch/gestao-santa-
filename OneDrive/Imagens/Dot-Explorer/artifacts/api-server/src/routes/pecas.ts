import { Router, type IRouter } from "express";
import * as XLSX from "xlsx";
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

  const exportColumns = [
    { key: "chamada_number", header: "Nº Chamada" },
    { key: "data_abertura", header: "Data Abertura" },
    { key: "desc_produto", header: "Produto" },
    { key: "desc_marca", header: "Marca" },
    { key: "modelo_equip", header: "Modelo" },
    { key: "qtdem", header: "Qtd" },
    { key: "preco_unitario", header: "Preço Unit." },
    { key: "valor_item", header: "Valor Item" },
    { key: "valor_custo", header: "Custo" },
    { key: "movimentou_estoque", header: "Movimentou Estoque" },
    { key: "defeito_equip", header: "Defeito" },
    { key: "garantia", header: "Garantia" },
  ];

  const rows = data.map((row) =>
    Object.fromEntries(exportColumns.map(({ key, header }) => [header, row[key] ?? ""])),
  );

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Peças");

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", 'attachment; filename="pecas.xlsx"');
  res.send(buf);
});

export default router;
