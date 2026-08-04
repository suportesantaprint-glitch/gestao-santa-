import { Router, type IRouter } from "express";
import * as XLSX from "xlsx";
import { supabaseFetch, supabaseCount } from "../lib/supabase";

const router: IRouter = Router();

function buildChamadasParams(query: Record<string, string>): URLSearchParams {
  const p = new URLSearchParams();
  const {
    situacao, dataInicio, dataFim, tipoEquipamento, tipoContrato,
    tipoEntrada, marca, cidade, cliente, tecnico,
  } = query;

  if (situacao) p.append("situacao_zenthi", `eq.${situacao}`);
  if (dataInicio) p.append("emissao", `gte.${dataInicio}`);
  if (dataFim) p.append("emissao", `lte.${dataFim}T23:59:59`);
  if (tipoEquipamento) p.append("desc_tipo_equipamento", `eq.${tipoEquipamento}`);
  if (tipoContrato) p.append("tipo_contrato", `eq.${tipoContrato}`);
  if (tipoEntrada) p.append("tipo_entrada", `eq.${tipoEntrada}`);
  if (marca) p.append("marca", `eq.${marca}`);
  if (cidade) p.append("cidade", `ilike.*${cidade}*`);
  if (cliente) p.append("razao_social", `ilike.*${cliente}*`);
  if (tecnico) p.append("email_tecnico", `ilike.*${tecnico}*`);

  return p;
}

// GET /api/chamadas
router.get("/chamadas", async (req, res): Promise<void> => {
  const q = req.query as Record<string, string>;
  const page = Math.max(1, parseInt(q.page ?? "1", 10) || 1);
  const limit = Math.min(200, Math.max(1, parseInt(q.limit ?? "50", 10) || 50));

  const filters = buildChamadasParams(q);
  filters.set("order", "emissao.desc");
  filters.set("limit", String(limit));
  filters.set("offset", String((page - 1) * limit));

  const { data, total } = await supabaseFetch("zenthi_chamadas", filters);
  res.json({ data, total, page, limit });
});

// GET /api/chamadas/exportar — must be defined BEFORE /:codigo
router.get("/chamadas/exportar", async (req, res): Promise<void> => {
  const q = req.query as Record<string, string>;
  const filters = buildChamadasParams(q);
  filters.set("order", "emissao.desc");
  filters.set("limit", "10000");
  filters.set("offset", "0");

  const { data } = await supabaseFetch<Record<string, unknown>>("zenthi_chamadas", filters);

  const exportColumns = [
    { key: "codigo", header: "Código" },
    { key: "emissao", header: "Abertura" },
    { key: "encerramento", header: "Encerramento" },
    { key: "situacao_zenthi", header: "Status" },
    { key: "razao_social", header: "Cliente" },
    { key: "cpf_cnpj", header: "CPF/CNPJ" },
    { key: "cidade", header: "Cidade" },
    { key: "email_tecnico", header: "Técnico" },
    { key: "marca", header: "Marca" },
    { key: "modelo", header: "Modelo" },
    { key: "numero_serie", header: "Nº Série" },
    { key: "desc_tipo_equipamento", header: "Tipo Equipamento" },
    { key: "tipo_contrato", header: "Tipo Contrato" },
    { key: "tipo_entrada", header: "Entrada" },
    { key: "defeito_informado", header: "Defeito Informado" },
    { key: "setor", header: "Setor" },
    { key: "data_prevista", header: "Previsão" },
    { key: "valor_chamada", header: "Valor" },
  ];

  const rows = data.map((row) =>
    Object.fromEntries(exportColumns.map(({ key, header }) => [header, row[key] ?? ""])),
  );

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Chamadas");

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", 'attachment; filename="chamadas.xlsx"');
  res.send(buf);
});

// GET /api/chamadas/:codigo
router.get("/chamadas/:codigo", async (req, res): Promise<void> => {
  const rawCodigo = Array.isArray(req.params.codigo) ? req.params.codigo[0] : req.params.codigo;
  const codigo = parseInt(rawCodigo ?? "", 10);

  if (isNaN(codigo)) {
    res.status(400).json({ error: "Código inválido" });
    return;
  }

  const p = new URLSearchParams();
  p.set("codigo", `eq.${codigo}`);
  p.set("limit", "1");

  const { data } = await supabaseFetch("zenthi_chamadas", p);
  if (!data.length) {
    res.status(404).json({ error: "Chamada não encontrada" });
    return;
  }
  res.json(data[0]);
});

export default router;
