import { useEffect, useMemo, useState, type ReactNode } from "react"
import { useQuery } from "@tanstack/react-query"
import { Boxes, Building2, CircleAlert, FilterX, History, MapPin, PackageCheck, Search, ShieldCheck, Wrench } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Pagination, PaginationContent, PaginationItem, PaginationNext, PaginationPrevious } from "@/components/ui/pagination"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { EmptyState, LoadingTable } from "@/components/States"
import { formatCurrency, formatDateTime } from "@/lib/format"

type Status = "no-cliente" | "em-atendimento" | "sem-baixa" | "sem-vinculo" | "historico"
type Confidence = "alta" | "media" | "baixa"

type Part = {
  id: string; chamada: string; peca: string; marcaPeca: string; quantidade: number
  valorUnitario: number; valorTotal: number; movimentouEstoque: boolean
  dataRegistro: string | null; dataAplicacao: string | null; ultimoEvento: string | null
  cliente: string; documento: string; cidade: string; tecnico: string
  marcaEquipamento: string; modeloEquipamento: string; numeroSerie: string; tipoEquipamento: string
  situacaoChamada: string; status: Status; posicaoAtualEstimada: boolean
  confianca: Confidence; diasNoCliente: number | null; motivoEstimativa: string
}

type Response = {
  data: Part[]; total: number; page: number; totalPages: number
  summary: { registros: number; unidades: number; noCliente: number; emAtendimento: number; pendencias: number; clientes: number; valorNoCliente: number; semSerie: number; confiancaAlta: number }
  options: { clientes: string[]; tecnicos: string[]; marcas: string[] }
  methodology: { description: string }
}

type Filters = { busca: string; status: string; cliente: string; tecnico: string; dataInicio: string; dataFim: string; ordenar: string; semSerie: boolean }

const initialFilters: Filters = { busca: "", status: "all", cliente: "all", tecnico: "all", dataInicio: "", dataFim: "", ordenar: "recente-desc", semSerie: false }
const labels: Record<Status, string> = {
  "no-cliente": "No cliente (estimado)", "em-atendimento": "Em atendimento",
  "sem-baixa": "Sem baixa confirmada", "sem-vinculo": "Sem vínculo com OS", historico: "Histórico anterior",
}

function useDebounced<T>(value: T, delay = 350): T {
  const [result, setResult] = useState(value)
  useEffect(() => { const timer = window.setTimeout(() => setResult(value), delay); return () => window.clearTimeout(timer) }, [delay, value])
  return result
}

export function CicloVidaPecas() {
  const [page, setPage] = useState(1)
  const [filters, setFilters] = useState(initialFilters)
  const [selected, setSelected] = useState<Part | null>(null)
  const search = useDebounced(filters.busca)

  const query = useMemo(() => {
    const params = new URLSearchParams({ page: String(page), limit: "40", ordenar: filters.ordenar })
    if (search.trim()) params.set("busca", search.trim())
    if (filters.status !== "all") params.set("status", filters.status)
    if (filters.cliente !== "all") params.set("cliente", filters.cliente)
    if (filters.tecnico !== "all") params.set("tecnico", filters.tecnico)
    if (filters.dataInicio) params.set("dataInicio", filters.dataInicio)
    if (filters.dataFim) params.set("dataFim", filters.dataFim)
    if (filters.semSerie) params.set("semSerie", "sim")
    return params.toString()
  }, [filters, page, search])

  const { data, isLoading, isError, error } = useQuery<Response>({
    queryKey: ["ciclo-vida-pecas", query],
    queryFn: async () => {
      const response = await fetch(`/api/pecas/ciclo-vida?${query}`)
      if (!response.ok) throw new Error((await response.text()) || "Falha ao carregar a rastreabilidade")
      return response.json() as Promise<Response>
    },
  })

  const setFilter = <K extends keyof Filters>(key: K, value: Filters[K]) => { setFilters((current) => ({ ...current, [key]: value })); setPage(1) }
  const reset = () => { setFilters(initialFilters); setPage(1) }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Ciclo de Vida das Peças</h1>
          <p className="text-sm text-muted-foreground">Do registro e da baixa de estoque até a última localização conhecida no cliente.</p>
        </div>
        <div className="flex max-w-xl gap-3 rounded-lg border bg-card p-4 text-sm shadow-sm">
          <ShieldCheck className="h-5 w-5 shrink-0 text-muted-foreground" />
          <div><p className="font-medium">Rastreabilidade baseada em evidências</p><p className="text-xs leading-relaxed text-muted-foreground">{data?.methodology.description ?? "A posição é estimada pela última OS encerrada com movimentação de estoque."}</p></div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <Metric title="Registros" value={data?.summary.registros} icon={History} />
        <Metric title="Unidades" value={data?.summary.unidades} icon={Boxes} />
        <Metric title="No cliente" value={data?.summary.noCliente} icon={PackageCheck} />
        <Metric title="Em atendimento" value={data?.summary.emAtendimento} icon={Wrench} />
        <Metric title="Pendências" value={data?.summary.pendencias} icon={CircleAlert} />
        <Metric title="Valor em campo" value={data ? formatCurrency(data.summary.valorNoCliente) : undefined} icon={Building2} />
      </div>

      <Card>
        <CardHeader className="pb-3"><div className="flex flex-wrap items-center justify-between gap-2"><CardTitle className="text-base">Filtros</CardTitle><span className="text-xs text-muted-foreground">{data ? `${data.summary.clientes} clientes · ${data.summary.confiancaAlta} posições de alta confiança` : "Carregando..."}</span></div></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Field label="Busca geral" wide><div className="relative"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input className="pl-9" placeholder="Peça, OS, cliente, técnico, equipamento ou série..." value={filters.busca} onChange={(event) => setFilter("busca", event.target.value)} /></div></Field>
            <SelectField label="Situação" value={filters.status} onChange={(value) => setFilter("status", value)} options={[
              ["all", "Todas"], ["no-cliente", "No cliente (estimado)"], ["em-atendimento", "Em atendimento"],
              ["sem-baixa", "Sem baixa confirmada"], ["sem-vinculo", "Sem vínculo com OS"], ["historico", "Histórico anterior"],
            ]} />
            <SelectField label="Ordenação" value={filters.ordenar} onChange={(value) => setFilter("ordenar", value)} options={[
              ["recente-desc", "Evento mais recente"], ["tempo-desc", "Mais tempo no cliente"], ["valor-desc", "Maior valor"], ["cliente-asc", "Cliente A–Z"], ["peca-asc", "Peça A–Z"],
            ]} />
            <DynamicSelect label="Cliente" value={filters.cliente} placeholder="Todos os clientes" options={data?.options.clientes ?? []} onChange={(value) => setFilter("cliente", value)} />
            <DynamicSelect label="Técnico" value={filters.tecnico} placeholder="Todos os técnicos" options={data?.options.tecnicos ?? []} onChange={(value) => setFilter("tecnico", value)} />
            <Field label="Data inicial"><Input type="date" value={filters.dataInicio} onChange={(event) => setFilter("dataInicio", event.target.value)} /></Field>
            <Field label="Data final"><Input type="date" value={filters.dataFim} onChange={(event) => setFilter("dataFim", event.target.value)} /></Field>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant={filters.semSerie ? "default" : "outline"} onClick={() => setFilter("semSerie", !filters.semSerie)}>Somente sem número de série</Button>
            <Button size="sm" variant="ghost" className="gap-2" onClick={reset}><FilterX className="h-4 w-4" /> Limpar filtros</Button>
            {data?.summary.semSerie ? <span className="text-xs text-muted-foreground">{data.summary.semSerie} posições atuais sem série</span> : null}
          </div>
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader className="pb-3"><CardTitle className="text-base">Última posição conhecida</CardTitle><p className="text-sm text-muted-foreground">Clique em uma linha para consultar a linha do tempo.</p></CardHeader>
        <div className="overflow-auto">
          <Table>
            <TableHeader><TableRow><TableHead className="min-w-[260px]">Peça</TableHead><TableHead className="min-w-[170px]">Situação</TableHead><TableHead className="min-w-[250px]">Cliente / equipamento</TableHead><TableHead className="min-w-[170px]">OS / técnico</TableHead><TableHead className="min-w-[150px]">Último evento</TableHead><TableHead className="text-right">Qtd. / valor</TableHead><TableHead className="text-center">Tempo</TableHead></TableRow></TableHeader>
            <TableBody>
              {isLoading ? <TableRow><TableCell colSpan={7}><LoadingTable rows={10} /></TableCell></TableRow> : isError ? (
                <TableRow><TableCell colSpan={7} className="py-12 text-center text-destructive">{error instanceof Error ? error.message : "Falha ao carregar"}</TableCell></TableRow>
              ) : !data?.data.length ? <TableRow><TableCell colSpan={7}><EmptyState title="Nenhuma peça encontrada" description="Ajuste os filtros ou revise os vínculos entre peças e OS." /></TableCell></TableRow> : data.data.map((part) => (
                <TableRow key={part.id} className="cursor-pointer" onClick={() => setSelected(part)}>
                  <TableCell><div className="font-medium">{part.peca}</div><div className="text-xs text-muted-foreground">{part.marcaPeca || "Marca não informada"} · ID {part.id}</div></TableCell>
                  <TableCell><StatusBadge status={part.status} /><div className="mt-1"><ConfidenceBadge confidence={part.confianca} /></div></TableCell>
                  <TableCell><div className="font-medium">{part.cliente || "Cliente não identificado"}</div><div className="text-xs text-muted-foreground">{[part.marcaEquipamento, part.modeloEquipamento].filter(Boolean).join(" ") || "Equipamento não informado"}</div><div className="font-mono text-xs text-muted-foreground">{part.numeroSerie || "Sem número de série"}</div></TableCell>
                  <TableCell><div className="font-mono text-xs">{part.chamada ? `#${part.chamada}` : "Sem OS"}</div><div className="mt-1 text-xs text-muted-foreground">{part.tecnico || "Técnico não informado"}</div></TableCell>
                  <TableCell className="font-mono text-xs">{formatDateTime(part.ultimoEvento)}</TableCell>
                  <TableCell className="text-right"><div className="font-mono font-semibold">{part.quantidade}</div><div className="font-mono text-xs text-muted-foreground">{formatCurrency(part.valorTotal)}</div></TableCell>
                  <TableCell className="text-center">{part.diasNoCliente == null ? "—" : <Badge variant="outline">{duration(part.diasNoCliente)}</Badge>}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        {(data?.totalPages ?? 0) > 1 ? <div className="flex items-center justify-between border-t p-4 text-sm text-muted-foreground"><span>Página {data?.page} de {data?.totalPages} · {data?.total} registros</span><Pagination className="mx-0 w-auto"><PaginationContent><PaginationItem><PaginationPrevious onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page <= 1} /></PaginationItem><PaginationItem><PaginationNext onClick={() => setPage((current) => Math.min(data?.totalPages ?? current, current + 1))} disabled={page >= (data?.totalPages ?? 1)} /></PaginationItem></PaginationContent></Pagination></div> : null}
      </Card>

      <Details part={selected} onClose={() => setSelected(null)} />
    </div>
  )
}

function Details({ part, onClose }: { part: Part | null; onClose: () => void }) {
  return <Dialog open={Boolean(part)} onOpenChange={(open) => !open && onClose()}><DialogContent className="max-h-[88vh] max-w-3xl overflow-hidden p-0"><DialogHeader className="border-b p-6 pb-4"><DialogTitle>{part?.peca}</DialogTitle><DialogDescription>Ciclo reconstruído com o histórico da peça, estoque e ordem de serviço.</DialogDescription></DialogHeader>{part ? <div className="max-h-[72vh] space-y-5 overflow-auto p-6">
    <div className="grid gap-3 sm:grid-cols-3"><Info label="Situação"><StatusBadge status={part.status} /></Info><Info label="Confiança"><ConfidenceBadge confidence={part.confianca} /></Info><Info label="Tempo conhecido"><strong>{part.diasNoCliente == null ? "Não calculado" : duration(part.diasNoCliente)}</strong></Info></div>
    <div className="rounded-lg border bg-muted/30 p-4"><p className="text-sm font-medium">Critério da posição</p><p className="mt-1 text-sm text-muted-foreground">{part.motivoEstimativa}</p></div>
    <div className="space-y-3"><Timeline icon={History} title="Registrada no sistema" date={part.dataRegistro} text={`Registro ${part.id} · ${part.quantidade} unidade(s)`} done={Boolean(part.dataRegistro)} /><Timeline icon={Boxes} title="Movimentação de estoque" date={part.dataRegistro} text={part.movimentouEstoque ? "Movimentação confirmada" : "Movimentação não confirmada"} done={part.movimentouEstoque} /><Timeline icon={Wrench} title="Aplicação vinculada" date={part.dataAplicacao} text={part.chamada ? `OS #${part.chamada} · ${part.situacaoChamada || "sem status"}` : "Sem OS vinculada"} done={Boolean(part.chamada)} /><Timeline icon={MapPin} title="Última localização conhecida" date={part.dataAplicacao || part.ultimoEvento} text={part.cliente ? `${part.cliente} · ${[part.marcaEquipamento, part.modeloEquipamento].filter(Boolean).join(" ") || "equipamento não informado"} · ${part.numeroSerie || "sem série"}` : "Localização indisponível"} done={part.posicaoAtualEstimada} /></div>
    <div className="grid gap-4 sm:grid-cols-2"><Box title="Destino"><Line label="Cliente" value={part.cliente || "Não identificado"} /><Line label="Cidade" value={part.cidade || "Não informada"} /><Line label="Técnico" value={part.tecnico || "Não informado"} /></Box><Box title="Equipamento"><Line label="Modelo" value={[part.marcaEquipamento, part.modeloEquipamento].filter(Boolean).join(" ") || "Não informado"} /><Line label="Série" value={part.numeroSerie || "Não informada"} /><Line label="OS" value={part.chamada ? `#${part.chamada}` : "Não vinculada"} /></Box></div>
    <div className="grid gap-3 rounded-lg border p-4 sm:grid-cols-3"><Line label="Quantidade" value={String(part.quantidade)} /><Line label="Valor unitário" value={formatCurrency(part.valorUnitario)} /><Line label="Valor total" value={formatCurrency(part.valorTotal)} /></div>
  </div> : null}</DialogContent></Dialog>
}

function StatusBadge({ status }: { status: Status }) {
  const classes = status === "no-cliente" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : status === "em-atendimento" ? "border-blue-200 bg-blue-50 text-blue-700" : status === "sem-baixa" ? "border-amber-200 bg-amber-50 text-amber-700" : ""
  return status === "sem-vinculo" ? <Badge variant="destructive">{labels[status]}</Badge> : status === "historico" ? <Badge variant="secondary">{labels[status]}</Badge> : <Badge className={classes}>{labels[status]}</Badge>
}
function ConfidenceBadge({ confidence }: { confidence: Confidence }) { return <Badge variant={confidence === "alta" ? "default" : confidence === "media" ? "secondary" : "outline"}>{confidence === "alta" ? "Alta" : confidence === "media" ? "Média" : "Baixa"}</Badge> }
function Metric({ title, value, icon: Icon }: { title: string; value?: string | number; icon: typeof History }) { return <Card><CardContent className="flex items-center justify-between p-4"><div><p className="text-xs text-muted-foreground">{title}</p><p className="text-2xl font-bold">{value ?? "-"}</p></div><Icon className="h-5 w-5 text-muted-foreground" /></CardContent></Card> }
function Field({ label, children, wide = false }: { label: string; children: ReactNode; wide?: boolean }) { return <div className={`space-y-1.5 ${wide ? "xl:col-span-2" : ""}`}><Label>{label}</Label>{children}</div> }
function SelectField({ label, value, options, onChange }: { label: string; value: string; options: [string, string][]; onChange: (value: string) => void }) { return <Field label={label}><Select value={value} onValueChange={onChange}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{options.map(([key, text]) => <SelectItem key={key} value={key}>{text}</SelectItem>)}</SelectContent></Select></Field> }
function DynamicSelect({ label, value, placeholder, options, onChange }: { label: string; value: string; placeholder: string; options: string[]; onChange: (value: string) => void }) { return <SelectField label={label} value={value} onChange={onChange} options={[["all", placeholder], ...options.map((option): [string, string] => [option, option])]} /> }
function Info({ label, children }: { label: string; children: ReactNode }) { return <div className="rounded-lg border p-3"><p className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">{label}</p>{children}</div> }
function Timeline({ icon: Icon, title, date, text, done }: { icon: typeof History; title: string; date: string | null; text: string; done: boolean }) { return <div className="flex gap-3"><div className={done ? "flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground" : "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-muted-foreground"}><Icon className="h-4 w-4" /></div><div className="flex-1"><div className="flex flex-wrap justify-between gap-2"><p className="font-medium">{title}</p><span className="font-mono text-xs text-muted-foreground">{formatDateTime(date)}</span></div><p className="text-sm text-muted-foreground">{text}</p></div></div> }
function Box({ title, children }: { title: string; children: ReactNode }) { return <div className="space-y-2 rounded-lg border p-4"><p className="font-medium">{title}</p>{children}</div> }
function Line({ label, value }: { label: string; value: string }) { return <div><p className="text-xs text-muted-foreground">{label}</p><p className="text-sm font-medium">{value}</p></div> }
function duration(days: number): string { if (days < 30) return `${days}d`; if (days < 365) return `${Math.floor(days / 30)}m ${days % 30}d`; const years = Math.floor(days / 365); const months = Math.floor((days % 365) / 30); return months ? `${years}a ${months}m` : `${years}a` }
