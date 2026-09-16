type DatabaseRow = Record<string, unknown>

type OperationsData = {
  chamadas: DatabaseRow[]
  pecas: DatabaseRow[]
}

type MaquinaCliente = {
  id: string
  cliente: string
  documento: string
  cidade: string
  marca: string
  modelo: string
  numeroSerie: string
  tipoEquipamento: string
  tipoContrato: string
  ultimoAtendimento: string | null
  totalAtendimentos: number
  atendimentosAbertos: number
  retornos: number
  tecnicos: string[]
  ordensServico: Array<string | number>
}

type PecaUsada = {
  descricao: string
  quantidade: number
  valor: number
}

type ServicoTecnico = {
  codigo: string | number
  cliente: string
  cidade: string
  marca: string
  modelo: string
  numeroSerie: string
  situacao: string
  emissao: string | null
  encerramento: string | null
  retorno: boolean
  pecas: PecaUsada[]
  totalPecas: number
}

type TecnicoResumo = {
  tecnico: string
  atendimentos: number
  clientes: number
  maquinas: number
  pecasUsadas: number
  retornos: number
  concluidos: number
  abertos: number
  ultimoAtendimento: string | null
  servicos: ServicoTecnico[]
}

const CACHE_TTL_MS = 5 * 60 * 1000
const PAGE_SIZE = 1000

let operationsPromise: Promise<OperationsData> | null = null
let operationsExpiresAt = 0

function text(value: unknown): string {
  if (value == null) return ""
  return String(value).trim()
}

function numberValue(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0
  const parsed = Number.parseFloat(text(value).replace(",", "."))
  return Number.isFinite(parsed) ? parsed : 0
}

function normalize(value: unknown): string {
  return text(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
}

function timestamp(value: unknown): number {
  const parsed = Date.parse(text(value))
  return Number.isFinite(parsed) ? parsed : 0
}

function isClosedStatus(value: unknown): boolean {
  const status = normalize(value)
  return status.includes("concluid") || status.includes("cancelad") || status.includes("fechad") || status.includes("finalizad")
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
  let offset = 0

  while (true) {
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
    offset += PAGE_SIZE
  }

  return rows
}

async function loadOperationsData(): Promise<OperationsData> {
  const now = Date.now()
  if (operationsPromise && now < operationsExpiresAt) return operationsPromise

  operationsExpiresAt = now + CACHE_TTL_MS
  operationsPromise = Promise.all([
    queryAll(
      "zenthi_chamadas_santa_print",
      "codigo,emissao,encerramento,situacao_zenthi,razao_social,cpf_cnpj,cidade,email_tecnico,marca,modelo,numero_serie,desc_tipo_equipamento,tipo_contrato",
    ),
    queryAll(
      "zenthi_pecas_santa_print",
      "chamada_number,desc_produto,qtdem,valor_item",
    ),
  ]).then(([chamadas, pecas]) => ({ chamadas, pecas }))

  try {
    return await operationsPromise
  } catch (error) {
    operationsPromise = null
    operationsExpiresAt = 0
    throw error
  }
}

function clientKey(row: DatabaseRow): string {
  return normalize(row.cpf_cnpj) || normalize(row.razao_social) || "cliente-nao-identificado"
}

function equipmentKey(row: DatabaseRow): string {
  const serial = normalize(row.numero_serie)
  if (serial) return `serie:${serial}`

  return [normalize(row.marca), normalize(row.modelo), normalize(row.desc_tipo_equipamento)]
    .filter(Boolean)
    .join("|") || `os:${text(row.codigo)}`
}

function machineKey(row: DatabaseRow): string {
  return `${clientKey(row)}::${equipmentKey(row)}`
}

function buildMachines(chamadas: DatabaseRow[]): MaquinaCliente[] {
  const groups = new Map<string, {
    rows: DatabaseRow[]
    tecnicos: Set<string>
    ordens: Array<string | number>
  }>()

  for (const row of chamadas) {
    const key = machineKey(row)
    const group = groups.get(key) ?? { rows: [], tecnicos: new Set<string>(), ordens: [] }
    group.rows.push(row)

    const tecnico = text(row.email_tecnico)
    if (tecnico) group.tecnicos.add(tecnico)

    const codigo = row.codigo
    if (typeof codigo === "string" || typeof codigo === "number") group.ordens.push(codigo)
    groups.set(key, group)
  }

  return [...groups.entries()].map(([id, group]) => {
    const ordered = [...group.rows].sort((a, b) => timestamp(b.emissao) - timestamp(a.emissao))
    const latest = ordered[0] ?? {}
    const openCalls = group.rows.filter((row) => !isClosedStatus(row.situacao_zenthi)).length

    return {
      id,
      cliente: text(latest.razao_social),
      documento: text(latest.cpf_cnpj),
      cidade: text(latest.cidade),
      marca: text(latest.marca),
      modelo: text(latest.modelo),
      numeroSerie: text(latest.numero_serie),
      tipoEquipamento: text(latest.desc_tipo_equipamento),
      tipoContrato: text(latest.tipo_contrato),
      ultimoAtendimento: text(latest.emissao) || null,
      totalAtendimentos: group.rows.length,
      atendimentosAbertos: openCalls,
      retornos: Math.max(0, group.rows.length - 1),
      tecnicos: uniqueSorted([...group.tecnicos]),
      ordensServico: group.ordens,
    }
  })
}

function matchesMachineSearch(machine: MaquinaCliente, search: string): boolean {
  if (!search) return true

  return normalize([
    machine.cliente,
    machine.documento,
    machine.cidade,
    machine.marca,
    machine.modelo,
    machine.numeroSerie,
    machine.tipoEquipamento,
    machine.tipoContrato,
    machine.tecnicos.join(" "),
    machine.ordensServico.join(" "),
  ].join(" ")).includes(search)
}

export async function getMachinesResponse(query: Record<string, string>): Promise<unknown> {
  const { chamadas } = await loadOperationsData()
  const allMachines = buildMachines(chamadas)
  const search = normalize(query.busca)

  const filtered = allMachines.filter((machine) => {
    if (!matchesMachineSearch(machine, search)) return false
    if (query.cliente && machine.cliente !== query.cliente) return false
    if (query.cidade && machine.cidade !== query.cidade) return false
    if (query.marca && machine.marca !== query.marca) return false
    if (query.tipoEquipamento && machine.tipoEquipamento !== query.tipoEquipamento) return false
    if (query.situacao === "aberto" && machine.atendimentosAbertos === 0) return false
    if (query.situacao === "sem-aberto" && machine.atendimentosAbertos > 0) return false
    if (query.retorno === "com-retorno" && machine.retornos === 0) return false
    if (query.retorno === "sem-retorno" && machine.retornos > 0) return false
    if (query.semSerie === "sim" && machine.numeroSerie) return false
    return true
  })

  const order = query.ordenar ?? "atendimentos-desc"
  filtered.sort((a, b) => {
    if (order === "retornos-desc") return b.retornos - a.retornos
    if (order === "recente-desc") return timestamp(b.ultimoAtendimento) - timestamp(a.ultimoAtendimento)
    if (order === "cliente-asc") return a.cliente.localeCompare(b.cliente, "pt-BR")
    return b.totalAtendimentos - a.totalAtendimentos
  })

  const page = Math.max(1, Number.parseInt(query.page ?? "1", 10) || 1)
  const limit = Math.min(200, Math.max(1, Number.parseInt(query.limit ?? "40", 10) || 40))
  const totalPages = Math.max(1, Math.ceil(filtered.length / limit))
  const safePage = Math.min(page, totalPages)
  const start = (safePage - 1) * limit
  const data = filtered.slice(start, start + limit)

  return {
    data,
    total: filtered.length,
    page: safePage,
    limit,
    totalPages,
    summary: {
      maquinas: filtered.length,
      clientes: new Set(filtered.map((machine) => clientKey({ cpf_cnpj: machine.documento, razao_social: machine.cliente }))).size,
      atendimentos: filtered.reduce((total, machine) => total + machine.totalAtendimentos, 0),
      retornos: filtered.reduce((total, machine) => total + machine.retornos, 0),
      emAberto: filtered.reduce((total, machine) => total + machine.atendimentosAbertos, 0),
      semSerie: filtered.filter((machine) => !machine.numeroSerie).length,
    },
    options: {
      clientes: uniqueSorted(allMachines.map((machine) => machine.cliente)),
      cidades: uniqueSorted(allMachines.map((machine) => machine.cidade)),
      marcas: uniqueSorted(allMachines.map((machine) => machine.marca)),
      tiposEquipamento: uniqueSorted(allMachines.map((machine) => machine.tipoEquipamento)),
    },
  }
}

function buildPartsByCall(pecas: DatabaseRow[]): Map<string, PecaUsada[]> {
  const partsByCall = new Map<string, PecaUsada[]>()

  for (const row of pecas) {
    const callNumber = text(row.chamada_number)
    if (!callNumber) continue

    const list = partsByCall.get(callNumber) ?? []
    list.push({
      descricao: text(row.desc_produto) || "Peça sem descrição",
      quantidade: Math.max(0, numberValue(row.qtdem)),
      valor: Math.max(0, numberValue(row.valor_item)),
    })
    partsByCall.set(callNumber, list)
  }

  return partsByCall
}

function buildTechnicianServices(chamadas: DatabaseRow[], pecas: DatabaseRow[], query: Record<string, string>): ServicoTecnico[] {
  const partsByCall = buildPartsByCall(pecas)
  const startDate = query.dataInicio ? Date.parse(`${query.dataInicio}T00:00:00`) : 0
  const endDate = query.dataFim ? Date.parse(`${query.dataFim}T23:59:59`) : Number.POSITIVE_INFINITY

  const rows = chamadas
    .filter((row) => text(row.email_tecnico))
    .filter((row) => {
      const date = timestamp(row.emissao)
      return date >= startDate && date <= endDate
    })
    .sort((a, b) => timestamp(a.emissao) - timestamp(b.emissao))

  const seenSupport = new Set<string>()

  return rows.map((row) => {
    const code = typeof row.codigo === "number" || typeof row.codigo === "string" ? row.codigo : "-"
    const technician = text(row.email_tecnico)
    const supportKey = `${normalize(technician)}::${machineKey(row)}`
    const retorno = seenSupport.has(supportKey)
    seenSupport.add(supportKey)

    const parts = partsByCall.get(String(code)) ?? []

    return {
      codigo: code,
      cliente: text(row.razao_social),
      cidade: text(row.cidade),
      marca: text(row.marca),
      modelo: text(row.modelo),
      numeroSerie: text(row.numero_serie),
      situacao: text(row.situacao_zenthi),
      emissao: text(row.emissao) || null,
      encerramento: text(row.encerramento) || null,
      retorno,
      pecas: parts,
      totalPecas: parts.reduce((total, part) => total + part.quantidade, 0),
      tecnico: technician,
      machineId: machineKey(row),
    } as ServicoTecnico & { tecnico: string; machineId: string }
  })
}

function matchesServiceSearch(service: ServicoTecnico & { tecnico?: string; machineId?: string }, search: string): boolean {
  if (!search) return true

  return normalize([
    service.tecnico,
    service.codigo,
    service.cliente,
    service.cidade,
    service.marca,
    service.modelo,
    service.numeroSerie,
    service.situacao,
    service.pecas.map((part) => part.descricao).join(" "),
  ].join(" ")).includes(search)
}

export async function getTechniciansResponse(query: Record<string, string>): Promise<unknown> {
  const { chamadas, pecas } = await loadOperationsData()
  const rawServices = buildTechnicianServices(chamadas, pecas, query) as Array<ServicoTecnico & { tecnico: string; machineId: string }>
  const search = normalize(query.busca)

  const filteredServices = rawServices.filter((service) => {
    if (!matchesServiceSearch(service, search)) return false
    if (query.tecnico && service.tecnico !== query.tecnico) return false
    if (query.cliente && service.cliente !== query.cliente) return false
    if (query.situacao && service.situacao !== query.situacao) return false
    if (query.retorno === "sim" && !service.retorno) return false
    if (query.comPecas === "sim" && service.totalPecas <= 0) return false
    return true
  })

  const groups = new Map<string, Array<ServicoTecnico & { tecnico: string; machineId: string }>>()
  for (const service of filteredServices) {
    const list = groups.get(service.tecnico) ?? []
    list.push(service)
    groups.set(service.tecnico, list)
  }

  const technicians: TecnicoResumo[] = [...groups.entries()].map(([technician, services]) => {
    const ordered = [...services].sort((a, b) => timestamp(b.emissao) - timestamp(a.emissao))

    return {
      tecnico: technician,
      atendimentos: services.length,
      clientes: new Set(services.map((service) => normalize(service.cliente))).size,
      maquinas: new Set(services.map((service) => service.machineId)).size,
      pecasUsadas: services.reduce((total, service) => total + service.totalPecas, 0),
      retornos: services.filter((service) => service.retorno).length,
      concluidos: services.filter((service) => isClosedStatus(service.situacao)).length,
      abertos: services.filter((service) => !isClosedStatus(service.situacao)).length,
      ultimoAtendimento: ordered[0]?.emissao ?? null,
      servicos: ordered.map(({ tecnico: _tecnico, machineId: _machineId, ...service }) => service),
    }
  })

  const order = query.ordenar ?? "atendimentos-desc"
  technicians.sort((a, b) => {
    if (order === "retornos-desc") return b.retornos - a.retornos
    if (order === "pecas-desc") return b.pecasUsadas - a.pecasUsadas
    if (order === "clientes-desc") return b.clientes - a.clientes
    if (order === "recente-desc") return timestamp(b.ultimoAtendimento) - timestamp(a.ultimoAtendimento)
    if (order === "tecnico-asc") return a.tecnico.localeCompare(b.tecnico, "pt-BR")
    return b.atendimentos - a.atendimentos
  })

  const page = Math.max(1, Number.parseInt(query.page ?? "1", 10) || 1)
  const limit = Math.min(100, Math.max(1, Number.parseInt(query.limit ?? "20", 10) || 20))
  const totalPages = Math.max(1, Math.ceil(technicians.length / limit))
  const safePage = Math.min(page, totalPages)
  const start = (safePage - 1) * limit
  const data = technicians.slice(start, start + limit)

  const allTechnicians = uniqueSorted(chamadas.map((row) => text(row.email_tecnico)))
  const allClients = uniqueSorted(chamadas.map((row) => text(row.razao_social)))
  const allStatuses = uniqueSorted(chamadas.map((row) => text(row.situacao_zenthi)))

  return {
    data,
    total: technicians.length,
    page: safePage,
    limit,
    totalPages,
    summary: {
      tecnicos: technicians.length,
      atendimentos: filteredServices.length,
      clientes: new Set(filteredServices.map((service) => normalize(service.cliente))).size,
      pecasUsadas: filteredServices.reduce((total, service) => total + service.totalPecas, 0),
      retornos: filteredServices.filter((service) => service.retorno).length,
      emAberto: filteredServices.filter((service) => !isClosedStatus(service.situacao)).length,
    },
    options: {
      tecnicos: allTechnicians,
      clientes: allClients,
      situacoes: allStatuses,
    },
  }
}
