type DatabaseRow = Record<string, unknown>

type LifecycleStatus = "no-cliente" | "em-atendimento" | "sem-baixa" | "sem-vinculo" | "historico"
type TraceConfidence = "alta" | "media" | "baixa"

type PartLifecycleRecord = {
  id: string
  chamada: string
  peca: string
  marcaPeca: string
  quantidade: number
  valorUnitario: number
  valorTotal: number
  movimentouEstoque: boolean
  dataRegistro: string | null
  dataAplicacao: string | null
  cliente: string
  documento: string
  cidade: string
  tecnico: string
  marcaEquipamento: string
  modeloEquipamento: string
  numeroSerie: string
  tipoEquipamento: string
  situacaoChamada: string
  status: LifecycleStatus
  posicaoAtualEstimada: boolean
  confianca: TraceConfidence
  diasNoCliente: number | null
  motivoEstimativa: string
  ultimoEvento: string | null
  trackingKey: string
}

const CACHE_TTL_MS = 5 * 60 * 1000
const PAGE_SIZE = 1000
const MAX_ROWS = 50000

let lifecyclePromise: Promise<{ chamadas: DatabaseRow[]; pecas: DatabaseRow[] }> | null = null
let lifecycleExpiresAt = 0

function text(value: unknown): string {
  if (value == null) return ""
  return String(value).trim()
}

function normalize(value: unknown): string {
  return text(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
}

function numberValue(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0
  const raw = text(value).replace(/\./g, "").replace(",", ".")
  const parsed = Number.parseFloat(raw)
  return Number.isFinite(parsed) ? parsed : 0
}

function timestamp(value: unknown): number {
  const parsed = Date.parse(text(value))
  return Number.isFinite(parsed) ? parsed : 0
}

function isClosedStatus(value: unknown): boolean {
  const status = normalize(value)
  return status.includes("concluid") || status.includes("cancelad") || status.includes("fechad") || status.includes("finalizad")
}

function isTruthyStockMovement(value: unknown): boolean {
  return ["s", "sim", "y", "yes", "1", "true"].includes(normalize(value))
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt-BR"))
}

function getConfiguration(): { url: string; key: string } {
  const url = String(import.meta.env.VITE_SUPABASE_URL ?? "").replace(/\/+$/, "")
  const key = String(import.meta.env.VITE_SUPABASE_ANON_KEY ?? "")

  if (!url || !key) {
    throw new Error("Supabase não configurado na Vercel")
  }

  return { url, key }
}

async function queryAll(table: string, select: string): Promise<DatabaseRow[]> {
  const { url, key } = getConfiguration()
  const rows: DatabaseRow[] = []

  for (let offset = 0; offset < MAX_ROWS; offset += PAGE_SIZE) {
    const params = new URLSearchParams({
      select,
      limit: String(PAGE_SIZE),
      offset: String(offset),
    })

    const response = await fetch(`${url}/rest/v1/${encodeURIComponent(table)}?${params.toString()}`, {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        Accept: "application/json",
        Prefer: "count=exact",
      },
    })

    if (!response.ok) {
      const details = await response.text()
      throw new Error(`Supabase ${response.status} em ${table}: ${details}`)
    }

    const batch = (await response.json()) as DatabaseRow[]
    rows.push(...batch)

    const range = response.headers.get("content-range") ?? ""
    const total = Number.parseInt(range.split("/")[1] ?? "0", 10) || 0
    if (batch.length < PAGE_SIZE || (total > 0 && rows.length >= total)) break
  }

  return rows
}

async function loadLifecycleData(): Promise<{ chamadas: DatabaseRow[]; pecas: DatabaseRow[] }> {
  const now = Date.now()
  if (lifecyclePromise && now < lifecycleExpiresAt) return lifecyclePromise

  lifecycleExpiresAt = now + CACHE_TTL_MS
  lifecyclePromise = Promise.all([
    queryAll(
      "zenthi_chamadas",
      "codigo,emissao,encerramento,situacao_zenthi,razao_social,cpf_cnpj,cidade,email_tecnico,marca,modelo,numero_serie,desc_tipo_equipamento,tipo_contrato",
    ),
    queryAll(
      "zenthi_pecas",
      "id_sales_peca,chamada_number,data_abertura,data_encerramento,desc_produto,desc_marca,qtdem,valor_item,movimentou_estoque",
    ),
  ]).then(([chamadas, pecas]) => ({ chamadas, pecas }))

  try {
    return await lifecyclePromise
  } catch (error) {
    lifecyclePromise = null
    lifecycleExpiresAt = 0
    throw error
  }
}

function machineKey(call: DatabaseRow): string {
  const serial = normalize(call.numero_serie)
  if (serial) return `serie:${serial}`

  const client = normalize(call.cpf_cnpj) || normalize(call.razao_social) || "cliente-desconhecido"
  const equipment = [normalize(call.marca), normalize(call.modelo), normalize(call.desc_tipo_equipamento)]
    .filter(Boolean)
    .join("|") || `os:${text(call.codigo)}`

  return `${client}::${equipment}`
}

function daysSince(value: string | null): number | null {
  const start = timestamp(value)
  if (!start) return null
  return Math.max(0, Math.floor((Date.now() - start) / 86_400_000))
}

function buildLifecycleRecords(chamadas: DatabaseRow[], pecas: DatabaseRow[]): PartLifecycleRecord[] {
  const callsByCode = new Map<string, DatabaseRow>()
  for (const call of chamadas) {
    const code = text(call.codigo)
    if (code) callsByCode.set(code, call)
  }

  const records = pecas.map((part, index): PartLifecycleRecord => {
    const chamada = text(part.chamada_number)
    const call = callsByCode.get(chamada)
    const movimentouEstoque = isTruthyStockMovement(part.movimentou_estoque)
    const dataRegistro = text(part.data_abertura) || (call ? text(call.emissao) : "") || null
    const dataAplicacao = text(part.data_encerramento) || (call ? text(call.encerramento) : "") || null
    const callClosed = call ? isClosedStatus(call.situacao_zenthi) : false

    let status: LifecycleStatus
    let motivoEstimativa: string

    if (!call) {
      status = "sem-vinculo"
      motivoEstimativa = "A peça não possui uma OS encontrada para determinar cliente e equipamento."
    } else if (!movimentouEstoque) {
      status = "sem-baixa"
      motivoEstimativa = "Existe vínculo com a OS, mas a movimentação de estoque não está confirmada."
    } else if (!callClosed) {
      status = "em-atendimento"
      motivoEstimativa = "A peça movimentou estoque, porém a OS ainda não está encerrada."
    } else {
      status = "no-cliente"
      motivoEstimativa = "Última aplicação conhecida em OS encerrada com movimentação de estoque confirmada."
    }

    const quantidade = Math.max(0, numberValue(part.qtdem))
    const valorUnitario = Math.max(0, numberValue(part.valor_item))
    const peca = text(part.desc_produto) || "Peça sem descrição"
    const trackingKey = call ? `${machineKey(call)}::${normalize(peca)}` : `sem-vinculo::${chamada || index}::${normalize(peca)}`
    const numeroSerie = call ? text(call.numero_serie) : ""

    let confianca: TraceConfidence = "baixa"
    if (status === "no-cliente" && numeroSerie && dataAplicacao) confianca = "alta"
    else if ((status === "no-cliente" || status === "em-atendimento") && call) confianca = "media"

    return {
      id: text(part.id_sales_peca) || `${chamada || "sem-os"}-${index}`,
      chamada,
      peca,
      marcaPeca: text(part.desc_marca),
      quantidade,
      valorUnitario,
      valorTotal: quantidade * valorUnitario,
      movimentouEstoque,
      dataRegistro,
      dataAplicacao,
      cliente: call ? text(call.razao_social) : "",
      documento: call ? text(call.cpf_cnpj) : "",
      cidade: call ? text(call.cidade) : "",
      tecnico: call ? text(call.email_tecnico) : "",
      marcaEquipamento: call ? text(call.marca) : "",
      modeloEquipamento: call ? text(call.modelo) : "",
      numeroSerie,
      tipoEquipamento: call ? text(call.desc_tipo_equipamento) : "",
      situacaoChamada: call ? text(call.situacao_zenthi) : "",
      status,
      posicaoAtualEstimada: status === "no-cliente",
      confianca,
      diasNoCliente: status === "no-cliente" ? daysSince(dataAplicacao || dataRegistro) : null,
      motivoEstimativa,
      ultimoEvento: dataAplicacao || dataRegistro,
      trackingKey,
    }
  })

  const installedGroups = new Map<string, PartLifecycleRecord[]>()
  for (const record of records) {
    if (record.status !== "no-cliente") continue
    const group = installedGroups.get(record.trackingKey) ?? []
    group.push(record)
    installedGroups.set(record.trackingKey, group)
  }

  for (const group of installedGroups.values()) {
    group.sort((a, b) => timestamp(b.ultimoEvento) - timestamp(a.ultimoEvento))
    const latestTimestamp = timestamp(group[0]?.ultimoEvento)

    for (const record of group) {
      const isLatestKnownPosition = timestamp(record.ultimoEvento) === latestTimestamp
      record.posicaoAtualEstimada = isLatestKnownPosition

      if (!isLatestKnownPosition) {
        record.status = "historico"
        record.confianca = record.numeroSerie ? "media" : "baixa"
        record.motivoEstimativa = "Há uma aplicação posterior da mesma peça para este equipamento; este registro foi mantido como histórico."
      }
    }
  }

  return records
}

function matchesSearch(record: PartLifecycleRecord, search: string): boolean {
  if (!search) return true
  return normalize([
    record.id,
    record.chamada,
    record.peca,
    record.marcaPeca,
    record.cliente,
    record.documento,
    record.cidade,
    record.tecnico,
    record.marcaEquipamento,
    record.modeloEquipamento,
    record.numeroSerie,
    record.tipoEquipamento,
    record.situacaoChamada,
  ].join(" ")).includes(search)
}

export async function getPartsLifecycleResponse(query: Record<string, string>): Promise<unknown> {
  const { chamadas, pecas } = await loadLifecycleData()
  const allRecords = buildLifecycleRecords(chamadas, pecas)
  const search = normalize(query.busca)
  const startDate = query.dataInicio ? Date.parse(`${query.dataInicio}T00:00:00`) : 0
  const endDate = query.dataFim ? Date.parse(`${query.dataFim}T23:59:59`) : Number.POSITIVE_INFINITY

  const filtered = allRecords.filter((record) => {
    if (!matchesSearch(record, search)) return false
    if (query.status && query.status !== "all" && record.status !== query.status) return false
    if (query.cliente && query.cliente !== "all" && record.cliente !== query.cliente) return false
    if (query.tecnico && query.tecnico !== "all" && record.tecnico !== query.tecnico) return false
    if (query.marca && query.marca !== "all" && record.marcaPeca !== query.marca) return false
    if (query.semSerie === "sim" && record.numeroSerie) return false
    if (query.confianca && query.confianca !== "all" && record.confianca !== query.confianca) return false

    const eventDate = timestamp(record.ultimoEvento)
    if (eventDate < startDate || eventDate > endDate) return false
    return true
  })

  const order = query.ordenar ?? "recente-desc"
  filtered.sort((a, b) => {
    if (order === "tempo-desc") return (b.diasNoCliente ?? -1) - (a.diasNoCliente ?? -1)
    if (order === "valor-desc") return b.valorTotal - a.valorTotal
    if (order === "cliente-asc") return a.cliente.localeCompare(b.cliente, "pt-BR")
    if (order === "peca-asc") return a.peca.localeCompare(b.peca, "pt-BR")
    return timestamp(b.ultimoEvento) - timestamp(a.ultimoEvento)
  })

  const page = Math.max(1, Number.parseInt(query.page ?? "1", 10) || 1)
  const limit = Math.min(100, Math.max(1, Number.parseInt(query.limit ?? "40", 10) || 40))
  const totalPages = Math.max(1, Math.ceil(filtered.length / limit))
  const safePage = Math.min(page, totalPages)
  const start = (safePage - 1) * limit
  const data = filtered.slice(start, start + limit).map(({ trackingKey: _trackingKey, ...record }) => record)

  const currentAtClient = filtered.filter((record) => record.status === "no-cliente" && record.posicaoAtualEstimada)
  const pending = filtered.filter((record) => record.status === "sem-baixa" || record.status === "sem-vinculo")

  return {
    data,
    total: filtered.length,
    page: safePage,
    limit,
    totalPages,
    summary: {
      registros: filtered.length,
      unidades: filtered.reduce((total, record) => total + record.quantidade, 0),
      noCliente: currentAtClient.reduce((total, record) => total + record.quantidade, 0),
      emAtendimento: filtered
        .filter((record) => record.status === "em-atendimento")
        .reduce((total, record) => total + record.quantidade, 0),
      pendencias: pending.reduce((total, record) => total + record.quantidade, 0),
      clientes: new Set(currentAtClient.map((record) => normalize(record.documento) || normalize(record.cliente))).size,
      valorNoCliente: currentAtClient.reduce((total, record) => total + record.valorTotal, 0),
      semSerie: currentAtClient.filter((record) => !record.numeroSerie).length,
      confiancaAlta: currentAtClient.filter((record) => record.confianca === "alta").length,
    },
    options: {
      clientes: uniqueSorted(allRecords.map((record) => record.cliente)),
      tecnicos: uniqueSorted(allRecords.map((record) => record.tecnico)),
      marcas: uniqueSorted(allRecords.map((record) => record.marcaPeca)),
    },
    methodology: {
      estimated: true,
      description: "A posição atual é estimada pela última OS encerrada com movimentação de estoque. Registros anteriores da mesma peça no mesmo equipamento permanecem no histórico.",
    },
  }
}
