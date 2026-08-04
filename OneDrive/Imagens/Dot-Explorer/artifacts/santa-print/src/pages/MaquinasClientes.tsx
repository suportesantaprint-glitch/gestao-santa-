import { useEffect, useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Building2, FilterX, History, MonitorCog, Search, TriangleAlert } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { EmptyState, LoadingTable } from "@/components/States"
import { Pagination, PaginationContent, PaginationItem, PaginationNext, PaginationPrevious } from "@/components/ui/pagination"
import { formatDateTime } from "@/lib/format"

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

type MaquinasResponse = {
  data: MaquinaCliente[]
  total: number
  page: number
  limit: number
  totalPages: number
  summary: {
    maquinas: number
    clientes: number
    atendimentos: number
    retornos: number
    emAberto: number
    semSerie: number
  }
  options: {
    clientes: string[]
    cidades: string[]
    marcas: string[]
    tiposEquipamento: string[]
  }
}

type Filters = {
  busca: string
  cliente: string
  cidade: string
  marca: string
  tipoEquipamento: string
  situacao: string
  retorno: string
  semSerie: string
  ordenar: string
}

const initialFilters: Filters = {
  busca: "",
  cliente: "all",
  cidade: "all",
  marca: "all",
  tipoEquipamento: "all",
  situacao: "all",
  retorno: "all",
  semSerie: "all",
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

export function MaquinasClientes() {
  const [page, setPage] = useState(1)
  const [filters, setFilters] = useState<Filters>(initialFilters)
  const debouncedSearch = useDebouncedValue(filters.busca)

  const queryString = useMemo(() => {
    const params = new URLSearchParams({
      page: String(page),
      limit: "40",
      ordenar: filters.ordenar,
    })

    if (debouncedSearch.trim()) params.set("busca", debouncedSearch.trim())
    if (filters.cliente !== "all") params.set("cliente", filters.cliente)
    if (filters.cidade !== "all") params.set("cidade", filters.cidade)
    if (filters.marca !== "all") params.set("marca", filters.marca)
    if (filters.tipoEquipamento !== "all") params.set("tipoEquipamento", filters.tipoEquipamento)
    if (filters.situacao !== "all") params.set("situacao", filters.situacao)
    if (filters.retorno !== "all") params.set("retorno", filters.retorno)
    if (filters.semSerie !== "all") params.set("semSerie", filters.semSerie)

    return params.toString()
  }, [debouncedSearch, filters, page])

  const { data, isLoading, isError, error } = useQuery<MaquinasResponse>({
    queryKey: ["maquinas-clientes", queryString],
    queryFn: async () => {
      const response = await fetch(`/api/maquinas?${queryString}`)
      if (!response.ok) {
        const body = await response.text()
        throw new Error(body || "Não foi possível carregar as máquinas")
      }
      return response.json() as Promise<MaquinasResponse>
    },
  })

  const updateFilter = <K extends keyof Filters>(key: K, value: Filters[K]) => {
    setFilters((current) => ({ ...current, [key]: value }))
    setPage(1)
  }

  const resetFilters = () => {
    setFilters(initialFilters)
    setPage(1)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Máquinas por Cliente</h1>
        <p className="text-sm text-muted-foreground">
          Inventário operacional calculado pelas ordens de serviço, agrupando cliente, modelo e número de série.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <MetricCard title="Máquinas" value={data?.summary.maquinas} icon={MonitorCog} />
        <MetricCard title="Clientes" value={data?.summary.clientes} icon={Building2} />
        <MetricCard title="Atendimentos" value={data?.summary.atendimentos} icon={History} />
        <MetricCard title="Retornos" value={data?.summary.retornos} icon={History} />
        <MetricCard title="Em aberto" value={data?.summary.emAberto} icon={TriangleAlert} />
        <MetricCard title="Sem série" value={data?.summary.semSerie} icon={TriangleAlert} />
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
                  placeholder="Cliente, CNPJ, cidade, marca, modelo, série ou técnico..."
                  value={filters.busca}
                  onChange={(event) => updateFilter("busca", event.target.value)}
                />
              </div>
            </div>

            <FilterSelect
              label="Cliente"
              value={filters.cliente}
              placeholder="Todos os clientes"
              options={data?.options.clientes ?? []}
              onChange={(value) => updateFilter("cliente", value)}
            />
            <FilterSelect
              label="Cidade"
              value={filters.cidade}
              placeholder="Todas as cidades"
              options={data?.options.cidades ?? []}
              onChange={(value) => updateFilter("cidade", value)}
            />
            <FilterSelect
              label="Marca"
              value={filters.marca}
              placeholder="Todas as marcas"
              options={data?.options.marcas ?? []}
              onChange={(value) => updateFilter("marca", value)}
            />
            <FilterSelect
              label="Tipo de equipamento"
              value={filters.tipoEquipamento}
              placeholder="Todos os tipos"
              options={data?.options.tiposEquipamento ?? []}
              onChange={(value) => updateFilter("tipoEquipamento", value)}
            />

            <div className="space-y-1.5">
              <Label>Situação operacional</Label>
              <Select value={filters.situacao} onValueChange={(value) => updateFilter("situacao", value)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="aberto">Com atendimento aberto</SelectItem>
                  <SelectItem value="sem-aberto">Sem atendimento aberto</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Ordenação</Label>
              <Select value={filters.ordenar} onValueChange={(value) => updateFilter("ordenar", value)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="atendimentos-desc">Mais atendidas</SelectItem>
                  <SelectItem value="retornos-desc">Mais retornos</SelectItem>
                  <SelectItem value="recente-desc">Atendimento mais recente</SelectItem>
                  <SelectItem value="cliente-asc">Cliente A–Z</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant={filters.retorno === "com-retorno" ? "default" : "outline"}
              onClick={() => updateFilter("retorno", filters.retorno === "com-retorno" ? "all" : "com-retorno")}
            >
              Com retorno
            </Button>
            <Button
              type="button"
              size="sm"
              variant={filters.situacao === "aberto" ? "default" : "outline"}
              onClick={() => updateFilter("situacao", filters.situacao === "aberto" ? "all" : "aberto")}
            >
              Com OS aberta
            </Button>
            <Button
              type="button"
              size="sm"
              variant={filters.semSerie === "sim" ? "default" : "outline"}
              onClick={() => updateFilter("semSerie", filters.semSerie === "sim" ? "all" : "sim")}
            >
              Sem número de série
            </Button>
            <Button type="button" size="sm" variant="ghost" className="gap-2" onClick={resetFilters}>
              <FilterX className="h-4 w-4" /> Limpar filtros
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <div className="overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[240px]">Cliente</TableHead>
                <TableHead className="min-w-[210px]">Máquina</TableHead>
                <TableHead className="min-w-[150px]">Série</TableHead>
                <TableHead className="min-w-[150px]">Tipo / contrato</TableHead>
                <TableHead className="text-center">Atendimentos</TableHead>
                <TableHead className="text-center">Retornos</TableHead>
                <TableHead className="text-center">Abertos</TableHead>
                <TableHead className="min-w-[160px]">Último atendimento</TableHead>
                <TableHead className="min-w-[220px]">Técnicos</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={9}><LoadingTable rows={10} /></TableCell></TableRow>
              ) : isError ? (
                <TableRow>
                  <TableCell colSpan={9} className="py-10 text-center text-destructive">
                    {error instanceof Error ? error.message : "Falha ao carregar os dados"}
                  </TableCell>
                </TableRow>
              ) : !data?.data.length ? (
                <TableRow>
                  <TableCell colSpan={9}>
                    <EmptyState title="Nenhuma máquina encontrada" description="Ajuste os filtros ou confirme se a chave pública do Supabase possui permissão de leitura." />
                  </TableCell>
                </TableRow>
              ) : (
                data.data.map((machine) => (
                  <TableRow key={machine.id}>
                    <TableCell>
                      <div className="font-medium">{machine.cliente || "Cliente não identificado"}</div>
                      <div className="text-xs text-muted-foreground">
                        {[machine.documento, machine.cidade].filter(Boolean).join(" · ") || "Sem documento e cidade"}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{[machine.marca, machine.modelo].filter(Boolean).join(" ") || "Modelo não informado"}</div>
                      <div className="text-xs text-muted-foreground">OS: {machine.ordensServico.slice(0, 4).join(", ")}{machine.ordensServico.length > 4 ? "…" : ""}</div>
                    </TableCell>
                    <TableCell>
                      {machine.numeroSerie ? <span className="font-mono text-xs">{machine.numeroSerie}</span> : <Badge variant="outline">Sem série</Badge>}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">{machine.tipoEquipamento || "-"}</div>
                      <div className="text-xs text-muted-foreground">{machine.tipoContrato || "Contrato não informado"}</div>
                    </TableCell>
                    <TableCell className="text-center font-semibold">{machine.totalAtendimentos}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant={machine.retornos > 0 ? "default" : "outline"}>{machine.retornos}</Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={machine.atendimentosAbertos > 0 ? "destructive" : "outline"}>{machine.atendimentosAbertos}</Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{machine.ultimoAtendimento ? formatDateTime(machine.ultimoAtendimento) : "-"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{machine.tecnicos.join(", ") || "Não atribuído"}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {(data?.totalPages ?? 0) > 1 && (
          <div className="flex items-center justify-between border-t p-4 text-sm text-muted-foreground">
            <span>Página {data?.page} de {data?.totalPages} · {data?.total} máquinas</span>
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
    </div>
  )
}

function MetricCard({ title, value, icon: Icon }: { title: string; value?: number; icon: typeof MonitorCog }) {
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
