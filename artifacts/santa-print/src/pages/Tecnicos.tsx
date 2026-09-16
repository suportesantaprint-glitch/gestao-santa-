import { useEffect, useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Boxes, FileDown, FilterX, History, Printer, Search, UsersRound, Wrench } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Pagination, PaginationContent, PaginationItem, PaginationNext, PaginationPrevious } from "@/components/ui/pagination"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { EmptyState, LoadingTable } from "@/components/States"
import { StatusBadge } from "@/components/StatusBadge"
import { formatDateTime } from "@/lib/format"
import { downloadTechnicianReportPdf, printTechnicianReport } from "@/lib/technician-report"

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

type TecnicosResponse = {
  data: TecnicoResumo[]
  total: number
  page: number
  limit: number
  totalPages: number
  summary: {
    tecnicos: number
    atendimentos: number
    clientes: number
    pecasUsadas: number
    retornos: number
    emAberto: number
  }
  options: {
    tecnicos: string[]
    clientes: string[]
    situacoes: string[]
  }
}

type Filters = {
  busca: string
  tecnico: string
  cliente: string
  situacao: string
  dataInicio: string
  dataFim: string
  retorno: string
  comPecas: string
  ordenar: string
}

type DetailMode = "parts" | "returns"

type TechnicianDetails = {
  mode: DetailMode
  technician: TecnicoResumo
}

const initialFilters: Filters = {
  busca: "",
  tecnico: "all",
  cliente: "all",
  situacao: "all",
  dataInicio: "",
  dataFim: "",
  retorno: "all",
  comPecas: "all",
  ordenar: "atendimentos-desc",
}

function useDebouncedValue<T>(value: T, delay = 350): T {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay)
    return () => window.clearTimeout(timer)
  }, [value, delay])

  return debounced
}

export function Tecnicos() {
  const [page, setPage] = useState(1)
  const [selectedTechnician, setSelectedTechnician] = useState("")
  const [details, setDetails] = useState<TechnicianDetails | null>(null)
  const [filters, setFilters] = useState<Filters>(initialFilters)
  const debouncedSearch = useDebouncedValue(filters.busca)

  const queryString = useMemo(() => {
    const params = new URLSearchParams({
      page: String(page),
      limit: "20",
      ordenar: filters.ordenar,
    })

    if (debouncedSearch.trim()) params.set("busca", debouncedSearch.trim())
    if (filters.tecnico !== "all") params.set("tecnico", filters.tecnico)
    if (filters.cliente !== "all") params.set("cliente", filters.cliente)
    if (filters.situacao !== "all") params.set("situacao", filters.situacao)
    if (filters.dataInicio) params.set("dataInicio", filters.dataInicio)
    if (filters.dataFim) params.set("dataFim", filters.dataFim)
    if (filters.retorno !== "all") params.set("retorno", filters.retorno)
    if (filters.comPecas !== "all") params.set("comPecas", filters.comPecas)

    return params.toString()
  }, [debouncedSearch, filters, page])

  const { data, isLoading, isError, error } = useQuery<TecnicosResponse>({
    queryKey: ["tecnicos-operacao", queryString],
    queryFn: async () => {
      const response = await fetch(`/api/tecnicos?${queryString}`)
      if (!response.ok) {
        const body = await response.text()
        throw new Error(body || "Não foi possível carregar os técnicos")
      }
      return response.json() as Promise<TecnicosResponse>
    },
  })

  useEffect(() => {
    const technicians = data?.data ?? []
    if (!technicians.length) {
      setSelectedTechnician("")
      return
    }

    if (!technicians.some((item) => item.tecnico === selectedTechnician)) {
      setSelectedTechnician(technicians[0]?.tecnico ?? "")
    }
  }, [data, selectedTechnician])

  const selected = data?.data.find((item) => item.tecnico === selectedTechnician)
  const detailServices = details
    ? details.technician.servicos.filter((service) =>
        details.mode === "parts" ? service.pecas.length > 0 : service.retorno,
      )
    : []

  const updateFilter = <K extends keyof Filters>(key: K, value: Filters[K]) => {
    setFilters((current) => ({ ...current, [key]: value }))
    setPage(1)
  }

  const resetFilters = () => {
    setFilters(initialFilters)
    setPage(1)
  }

  const openDetails = (event: React.MouseEvent<HTMLButtonElement>, mode: DetailMode, technician: TecnicoResumo) => {
    event.stopPropagation()
    setDetails({ mode, technician })
  }

  const createReportPayload = () => {
    if (!details) return null
    return {
      mode: details.mode,
      technician: details.technician.tecnico,
      services: detailServices,
    }
  }

  const handleDownloadPdf = () => {
    const report = createReportPayload()
    if (!report) return

    try {
      downloadTechnicianReportPdf(report)
    } catch (reportError) {
      console.error("Falha ao gerar PDF do técnico", reportError)
      window.alert(reportError instanceof Error ? reportError.message : "Não foi possível gerar o PDF")
    }
  }

  const handlePrint = () => {
    const report = createReportPayload()
    if (!report) return

    try {
      printTechnicianReport(report)
    } catch (reportError) {
      console.error("Falha ao imprimir relatório do técnico", reportError)
      window.alert(reportError instanceof Error ? reportError.message : "Não foi possível abrir a impressão")
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Desempenho dos Técnicos</h1>
        <p className="text-sm text-muted-foreground">
          Atendimentos, clientes, equipamentos, peças aplicadas e retornos ao mesmo cliente e máquina.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <MetricCard title="Técnicos" value={data?.summary.tecnicos} icon={UsersRound} />
        <MetricCard title="Atendimentos" value={data?.summary.atendimentos} icon={Wrench} />
        <MetricCard title="Clientes" value={data?.summary.clientes} icon={UsersRound} />
        <MetricCard title="Peças usadas" value={data?.summary.pecasUsadas} icon={Boxes} />
        <MetricCard title="Retornos" value={data?.summary.retornos} icon={History} />
        <MetricCard title="Em aberto" value={data?.summary.emAberto} icon={Wrench} />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filtros inteligentes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="space-y-1.5 xl:col-span-2">
              <Label>Busca geral</Label>
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Técnico, cliente, cidade, máquina, série, peça ou número da OS..."
                  value={filters.busca}
                  onChange={(event) => updateFilter("busca", event.target.value)}
                />
              </div>
            </div>

            <FilterSelect
              label="Técnico"
              value={filters.tecnico}
              placeholder="Todos os técnicos"
              options={data?.options.tecnicos ?? []}
              onChange={(value) => updateFilter("tecnico", value)}
            />
            <FilterSelect
              label="Cliente"
              value={filters.cliente}
              placeholder="Todos os clientes"
              options={data?.options.clientes ?? []}
              onChange={(value) => updateFilter("cliente", value)}
            />

            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={filters.situacao} onValueChange={(value) => updateFilter("situacao", value)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os status</SelectItem>
                  {(data?.options.situacoes ?? []).map((status) => (
                    <SelectItem key={status} value={status}>{status}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Data inicial</Label>
              <Input type="date" value={filters.dataInicio} onChange={(event) => updateFilter("dataInicio", event.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Data final</Label>
              <Input type="date" value={filters.dataFim} onChange={(event) => updateFilter("dataFim", event.target.value)} />
            </div>

            <div className="space-y-1.5">
              <Label>Ordenação</Label>
              <Select value={filters.ordenar} onValueChange={(value) => updateFilter("ordenar", value)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="atendimentos-desc">Mais atendimentos</SelectItem>
                  <SelectItem value="retornos-desc">Mais retornos</SelectItem>
                  <SelectItem value="pecas-desc">Mais peças usadas</SelectItem>
                  <SelectItem value="clientes-desc">Mais clientes atendidos</SelectItem>
                  <SelectItem value="recente-desc">Atendimento mais recente</SelectItem>
                  <SelectItem value="tecnico-asc">Técnico A–Z</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant={filters.retorno === "sim" ? "default" : "outline"}
              onClick={() => updateFilter("retorno", filters.retorno === "sim" ? "all" : "sim")}
            >
              Somente com retorno
            </Button>
            <Button
              type="button"
              size="sm"
              variant={filters.comPecas === "sim" ? "default" : "outline"}
              onClick={() => updateFilter("comPecas", filters.comPecas === "sim" ? "all" : "sim")}
            >
              Somente com peças
            </Button>
            <Button type="button" size="sm" variant="ghost" className="gap-2" onClick={resetFilters}>
              <FilterX className="h-4 w-4" /> Limpar filtros
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader><CardTitle className="text-base">Resumo por técnico</CardTitle></CardHeader>
        <div className="overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[230px]">Técnico</TableHead>
                <TableHead className="text-center">Atendimentos</TableHead>
                <TableHead className="text-center">Clientes</TableHead>
                <TableHead className="text-center">Máquinas</TableHead>
                <TableHead className="text-center">Peças</TableHead>
                <TableHead className="text-center">Retornos</TableHead>
                <TableHead className="text-center">Abertos</TableHead>
                <TableHead className="min-w-[160px]">Último atendimento</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={8}><LoadingTable rows={8} /></TableCell></TableRow>
              ) : isError ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-10 text-center text-destructive">
                    {error instanceof Error ? error.message : "Falha ao carregar os dados"}
                  </TableCell>
                </TableRow>
              ) : !data?.data.length ? (
                <TableRow>
                  <TableCell colSpan={8}>
                    <EmptyState title="Nenhum técnico encontrado" description="Ajuste os filtros ou confirme se as chamadas possuem técnico atribuído." />
                  </TableCell>
                </TableRow>
              ) : (
                data.data.map((technician) => (
                  <TableRow
                    key={technician.tecnico}
                    className={selectedTechnician === technician.tecnico ? "cursor-pointer bg-muted/60" : "cursor-pointer"}
                    onClick={() => setSelectedTechnician(technician.tecnico)}
                  >
                    <TableCell className="font-medium">{technician.tecnico}</TableCell>
                    <TableCell className="text-center font-semibold">{technician.atendimentos}</TableCell>
                    <TableCell className="text-center">{technician.clientes}</TableCell>
                    <TableCell className="text-center">{technician.maquinas}</TableCell>
                    <TableCell className="text-center">
                      <button
                        type="button"
                        className="rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                        aria-label={`Ver peças usadas por ${technician.tecnico}`}
                        title="Clique para ver quais peças foram usadas e onde"
                        onClick={(event) => openDetails(event, "parts", technician)}
                      >
                        <Badge className="cursor-pointer hover:opacity-80" variant={technician.pecasUsadas > 0 ? "default" : "outline"}>
                          {technician.pecasUsadas}
                        </Badge>
                      </button>
                    </TableCell>
                    <TableCell className="text-center">
                      <button
                        type="button"
                        className="rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                        aria-label={`Ver retornos de ${technician.tecnico}`}
                        title="Clique para ver quais atendimentos foram retornos"
                        onClick={(event) => openDetails(event, "returns", technician)}
                      >
                        <Badge className="cursor-pointer hover:opacity-80" variant={technician.retornos > 0 ? "destructive" : "outline"}>
                          {technician.retornos}
                        </Badge>
                      </button>
                    </TableCell>
                    <TableCell className="text-center">{technician.abertos}</TableCell>
                    <TableCell className="font-mono text-xs">
                      {technician.ultimoAtendimento ? formatDateTime(technician.ultimoAtendimento) : "-"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {(data?.totalPages ?? 0) > 1 && (
          <div className="flex items-center justify-between border-t p-4 text-sm text-muted-foreground">
            <span>Página {data?.page} de {data?.totalPages} · {data?.total} técnicos</span>
            <Pagination className="mx-0 w-auto">
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page <= 1} />
                </PaginationItem>
                <PaginationItem>
                  <PaginationNext onClick={() => setPage((current) => Math.min(data?.totalPages ?? current, current + 1))} disabled={page >= (data?.totalPages ?? 1)} />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        )}
      </Card>

      {selected && (
        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle className="text-base">Histórico detalhado — {selected.tecnico}</CardTitle>
            <p className="text-sm text-muted-foreground">
              {selected.atendimentos} atendimentos · {selected.pecasUsadas} peças · {selected.retornos} retornos identificados
            </p>
          </CardHeader>
          <div className="overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[100px]">OS</TableHead>
                  <TableHead className="min-w-[220px]">Cliente</TableHead>
                  <TableHead className="min-w-[210px]">Máquina</TableHead>
                  <TableHead className="min-w-[130px]">Status</TableHead>
                  <TableHead className="min-w-[150px]">Data</TableHead>
                  <TableHead className="min-w-[280px]">Peças utilizadas</TableHead>
                  <TableHead className="text-center">Retorno</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {selected.servicos.map((service) => (
                  <TableRow key={String(service.codigo)}>
                    <TableCell className="font-mono text-xs">#{service.codigo}</TableCell>
                    <TableCell>
                      <div className="font-medium">{service.cliente || "Cliente não identificado"}</div>
                      <div className="text-xs text-muted-foreground">{service.cidade || "Cidade não informada"}</div>
                    </TableCell>
                    <TableCell>
                      <div>{[service.marca, service.modelo].filter(Boolean).join(" ") || "Modelo não informado"}</div>
                      <div className="font-mono text-xs text-muted-foreground">{service.numeroSerie || "Sem número de série"}</div>
                    </TableCell>
                    <TableCell><StatusBadge status={service.situacao} /></TableCell>
                    <TableCell className="font-mono text-xs">{service.emissao ? formatDateTime(service.emissao) : "-"}</TableCell>
                    <TableCell><PartsList parts={service.pecas} /></TableCell>
                    <TableCell className="text-center">
                      {service.retorno ? <Badge variant="destructive">Sim</Badge> : <Badge variant="outline">Não</Badge>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      <Dialog open={Boolean(details)} onOpenChange={(open) => !open && setDetails(null)}>
        <DialogContent className="max-h-[85vh] max-w-4xl overflow-hidden p-0">
          <DialogHeader className="border-b p-6 pb-4 pr-12">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-1.5">
                <DialogTitle>
                  {details?.mode === "parts" ? "Peças usadas" : "Atendimentos com retorno"} por {details?.technician.tecnico}
                </DialogTitle>
                <DialogDescription>
                  {details?.mode === "parts"
                    ? "Veja a peça, a quantidade, a OS, o cliente e o equipamento em que foi aplicada."
                    : "Veja quais ordens de serviço exigiram retorno, com cliente, equipamento, datas e peças aplicadas."}
                </DialogDescription>
              </div>

              {details && detailServices.length > 0 && (
                <div className="flex shrink-0 flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="gap-2"
                    onClick={handleDownloadPdf}
                    aria-label={`Baixar relatório em PDF de ${details.technician.tecnico}`}
                  >
                    <FileDown className="h-4 w-4" />
                    Baixar PDF
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="gap-2"
                    onClick={handlePrint}
                    aria-label={`Imprimir relatório de ${details.technician.tecnico}`}
                  >
                    <Printer className="h-4 w-4" />
                    Imprimir
                  </Button>
                </div>
              )}
            </div>
          </DialogHeader>

          <div className="max-h-[68vh] overflow-auto p-6 pt-4">
            {detailServices.length > 0 ? (
              <div className="space-y-4">
                {detailServices.map((service) => (
                  <div key={String(service.codigo)} className="rounded-lg border p-4">
                    <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold">OS #{service.codigo} · {service.cliente || "Cliente não identificado"}</p>
                        <p className="text-sm text-muted-foreground">{service.cidade || "Cidade não informada"}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {details?.mode === "returns" && <Badge variant="destructive">Retorno</Badge>}
                        <StatusBadge status={service.situacao} />
                      </div>
                    </div>

                    <div className="mb-3 grid gap-2 text-sm sm:grid-cols-2">
                      <p><span className="font-medium">Equipamento:</span> {[service.marca, service.modelo].filter(Boolean).join(" ") || "Não informado"}</p>
                      <p><span className="font-medium">Número de série:</span> {service.numeroSerie || "Não informado"}</p>
                      <p><span className="font-medium">Abertura:</span> {service.emissao ? formatDateTime(service.emissao) : "Não informada"}</p>
                      <p><span className="font-medium">Encerramento:</span> {service.encerramento ? formatDateTime(service.encerramento) : "Não informado"}</p>
                      {details?.mode === "parts" && (
                        <p><span className="font-medium">Total aplicado:</span> {service.pecas.reduce((total, part) => total + part.quantidade, 0)} peça(s)</p>
                      )}
                    </div>

                    {details?.mode === "parts" ? (
                      <div className="rounded-md bg-muted/50 p-3">
                        <PartsList parts={service.pecas} showValue />
                      </div>
                    ) : service.pecas.length > 0 ? (
                      <div className="rounded-md bg-muted/50 p-3">
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Peças usadas neste retorno</p>
                        <PartsList parts={service.pecas} showValue />
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">Nenhuma peça registrada neste atendimento.</p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                title={details?.mode === "parts" ? "Nenhuma peça registrada" : "Nenhum retorno identificado"}
                description={details?.mode === "parts"
                  ? "Não existem peças vinculadas às ordens de serviço deste técnico."
                  : "Não existem atendimentos marcados como retorno para este técnico."}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function PartsList({ parts, showValue = false }: { parts: PecaUsada[]; showValue?: boolean }) {
  if (!parts.length) {
    return <span className="text-xs text-muted-foreground">Nenhuma peça registrada</span>
  }

  return (
    <div className="space-y-1.5">
      {parts.map((part, index) => (
        <div key={`${part.descricao}-${index}`} className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <span><strong>{part.quantidade}×</strong> {part.descricao}</span>
          {showValue && part.valor > 0 ? (
            <span className="text-muted-foreground">R$ {part.valor.toFixed(2).replace(".", ",")}</span>
          ) : null}
        </div>
      ))}
    </div>
  )
}

function MetricCard({ title, value, icon: Icon }: { title: string; value?: number; icon: typeof Wrench }) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between p-4">
        <div>
          <p className="text-xs font-medium text-muted-foreground">{title}</p>
          <p className="text-2xl font-bold">{value ?? "-"}</p>
        </div>
        <Icon className="h-5 w-5 text-muted-foreground" />
      </CardContent>
    </Card>
  )
}

function FilterSelect({
  label,
  value,
  placeholder,
  options,
  onChange,
}: {
  label: string
  value: string
  placeholder: string
  options: string[]
  onChange: (value: string) => void
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger><SelectValue placeholder={placeholder} /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{placeholder}</SelectItem>
          {options.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  )
}
