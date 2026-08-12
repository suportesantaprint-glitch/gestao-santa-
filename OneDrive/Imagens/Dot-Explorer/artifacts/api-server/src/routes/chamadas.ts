import { Router, type IRouter } from "express";
import { buildProfessionalExcel, type ExcelColumn } from "../lib/excel";
import { supabaseFetch } from "../lib/supabase";

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

const exportColumns: ExcelColumn[] = [
  { key: "codigo", header: "Código", width: 12, type: "integer" },
  { key: "emissao", header: "Abertura", width: 20, type: "datetime" },
  { key: "encerramento", header: "Encerramento", width: 20, type: "datetime" },
  { key: "situacao_zenthi", header: "Status", width: 18 },
  { key: "razao_social", header: "Cliente", width: 34 },
  { key: "cpf_cnpj", header: "CPF/CNPJ", width: 20 },
  { key: "cidade", header: "Cidade", width: 22 },
  { key: "email_tecnico", header: "Técnico", width: 30 },
  { key: "marca", header: "Marca", width: 18 },
  { key: "modelo", header: "Modelo", width: 24 },
  { key: "numero_serie", header: "Nº Série", width: 22 },
  { key: "desc_tipo_equipamento", header: "Tipo Equipamento", width: 24 },
  { key: "tipo_contrato", header: "Tipo Contrato", width: 20 },
  { key: "tipo_entrada", header: "Entrada", width: 18 },
  { key: "defeito_informado", header: "Defeito Informado", width: 42 },
  { key: "setor", header: "Setor", width: 22 },
  { key: "data_prevista", header: "Previsão", width: 16, type: "date" },
  { key: "valor_chamada", header: "Valor", width: 16, type: "currency" },
];

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

  const buf = buildProfessionalExcel({
    sheetName: "Chamadas",
    title: "Relatório de Chamadas de Serviço",
    columns: exportColumns,
    rows: data,
  });

  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", 'attachment; filename="chamadas.xlsx"');
  res.setHeader("Cache-Control", "no-store");
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
