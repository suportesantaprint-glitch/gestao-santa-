import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Link } from "wouter"
import {
  AlertTriangle,
  ArrowUpRight,
  CalendarDays,
  CheckCircle2,
  CircleAlert,
  Clock3,
  DatabaseZap,
  FileStack,
  FilterX,
  RefreshCw,
  ServerOff,
  Wrench,
} from "lucide-react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import { StatusBadge } from "@/components/StatusBadge"
import { SkeletonRow } from "@/components/States"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { formatDateTime } from "@/lib/format"

type DashboardResumo = {
  total: number
  emAnalise: number
  concluidas: number
  canceladas: number
  aguardandoPeca: number
  paraConserto: number
  hojeAbertas: number
  hojeFechadas: number
  unavailable?: string[]
}

type DashboardStatus = { situacao: string; total: number }
type DashboardEquipamento = { tipo: string; total: number }

type ChamadaRecente = {
  codigo: number
  situacao_zenthi: string
  razao_social: string
  marca: string
  modelo: string
  emissao: string
  email_tecnico: string | null
}

type ChamadasResponse = {
  data: ChamadaRecente[]
  total: number
  page: number
  limit: number
}

const COLORS = {
  "Em Análise": "hsl(var(--status-analise))",
  "Concluído": "hsl(var(--status-concluido))",
  "Cancelado": "hsl(var(--status-cancelado))",
  "Aguardando Peça": "hsl(var(--status-aguardando))",
  "Para Conserto": "hsl(var(--status-conserto))",
}

async function fetchJson<T>(url: string): Promise<T> {
  let response: Response
  try {
    response = await fetch(url)
  } catch {
    throw new Error("Não foi possível conectar à fonte de dados. Verifique a conexão ou a configuração do Supabase.")
  }

  if (!response.ok) {
    let message = ""
    try {
      const body = (await response.json()) as { message?: string; error?: string }
      message = body.message || body.error || ""
    } catch {
      message = await response.text()
    }
    throw new Error(message || `A consulta não pôde ser concluída (HTTP ${response.status}).`)
  }

  return response.json() as Promise<T>
}

function formatDate(value: string) {
  if (!value) return ""
  const [year, month, day] = value.split("-")
  return `${day}/${month}/${year}`
}

function queryErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : ""
  const lower = message.toLowerCase()
  if (lower.includes("supabase") && (lower.includes("configur") || lower.includes("publishable"))) {
    return "A fonte de dados não está configurada. Defina as variáveis do Supabase no ambiente de execução."
  }
  if (lower.includes("row-level security") || lower.includes("permission denied") || lower.includes("policy")) {
    return "A fonte de dados recusou esta consulta por permissão. Revise o acesso de leitura do serviço de dados."
  }
  if (lower.includes("401") || lower.includes("403") || lower.includes("jwt")) {
    return "A fonte de dados recusou esta consulta. Verifique a chave e as permissões de leitura do ambiente."
  }
  if (lower.includes("failed to fetch") || lower.includes("conectar") || lower.includes("network")) {
    return "Não foi possível conectar à fonte de dados. Verifique a rede e tente atualizar."
  }
  return message || "A consulta não pôde ser concluída. Tente atualizar os dados."
}

function ChartUnavailable({ message }: { message: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-muted/30 px-5 text-center">
      <ServerOff className="h-5 w-5 text-muted-foreground" />
      <p className="max-w-xs text-sm text-muted-foreground" data-testid="state-chart-error">{message}</p>
    </div>
  )
}

function MetricCard({
  title,
  value,
  icon: Icon,
  tone,
  detail,
  loading,
  error,
  testId,
}: {
  title: string
  value: number | undefined
  icon: typeof FileStack
  tone: string
  detail?: string
  loading: boolean
  error: boolean
  testId: string
}) {
  return (
    <Card className={`relative overflow-hidden border-l-[3px] shadow-sm transition-shadow hover:shadow-md ${tone}`} data-testid={`card-${testId}`}>
      <CardHeader className="flex flex-row items-start justify-between space-y-0 px-5 pb-2 pt-5">
        <CardTitle className="max-w-[150px] text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent className="px-5 pb-5">
        <div className={`font-mono text-[2rem] font-bold leading-none tracking-[-0.06em] ${error ? "text-muted-foreground" : "text-foreground"}`} data-testid={`value-${testId}`}>
          {loading ? <span className="inline-block h-8 w-16 animate-pulse rounded bg-muted" /> : error ? "—" : value ?? 0}
        </div>
        {detail && !error && <p className="mt-2 text-xs text-muted-foreground">{detail}</p>}
        {error && <p className="mt-2 text-xs text-destructive">Indisponível</p>}
      </CardContent>
    </Card>
  )
}

export function Dashboard() {
  const [draftInicio, setDraftInicio] = useState("")
  const [draftFim, setDraftFim] = useState("")
  const [periodo, setPeriodo] = useState({ inicio: "", fim: "" })
  const intervaloInvalido = Boolean(draftInicio && draftFim && draftInicio > draftFim)

  const queryString = useMemo(() => {
    const params = new URLSearchParams()
    if (periodo.inicio) params.set("dataInicio", periodo.inicio)
    if (periodo.fim) params.set("dataFim", periodo.fim)
    return params.toString()
  }, [periodo])

  const dashboardUrl = (path: string) => `/api/dashboard/${path}${queryString ? `?${queryString}` : ""}`
  const chamadasRecentesUrl = useMemo(() => {
    const params = new URLSearchParams(queryString)
    params.set("page", "1")
    params.set("limit", "10")
    return `/api/chamadas?${params.toString()}`
  }, [queryString])

  const resumoQuery = useQuery<DashboardResumo>({
    queryKey: ["dashboard-resumo", queryString],
    queryFn: () => fetchJson<DashboardResumo>(dashboardUrl("resumo")),
  })
  const statusQuery = useQuery<DashboardStatus[]>({
    queryKey: ["dashboard-status", queryString],
    queryFn: () => fetchJson<DashboardStatus[]>(dashboardUrl("por-status")),
  })
  const equipamentoQuery = useQuery<DashboardEquipamento[]>({
    queryKey: ["dashboard-equipamentos", queryString],
    queryFn: () => fetchJson<DashboardEquipamento[]>(dashboardUrl("por-equipamento")),
  })
  const recentesQuery = useQuery<ChamadasResponse>({
    queryKey: ["dashboard-recentes", queryString],
    queryFn: () => fetchJson<ChamadasResponse>(chamadasRecentesUrl),
  })

  const queries = [resumoQuery, statusQuery, equipamentoQuery, recentesQuery]
  const falhas = queries.filter((query) => query.isError)
  const resumo = resumoQuery.data
  const statusData = statusQuery.data ?? []
  const equipData = equipamentoQuery.data ?? []
  const recentes = recentesQuery.data?.data ?? []
  const filtrandoPeriodo = Boolean(periodo.inicio || periodo.fim)
  const carregando = queries.some((query) => query.isFetching)
  const resumoParcial = (resumo?.unavailable?.length ?? 0) > 0

  const aplicarPeriodo = () => {
    if (intervaloInvalido) return
    setPeriodo({ inicio: draftInicio, fim: draftFim })
  }

  const limparPeriodo = () => {
    setDraftInicio("")
    setDraftFim("")
    setPeriodo({ inicio: "", fim: "" })
  }

  const atualizarDados = () => {
    void Promise.all(queries.map((query) => query.refetch()))
  }

  return (
    <div className="mx-auto w-full max-w-[1480px] space-y-7 pb-10">
      <header className="flex flex-col gap-3 border-b border-border/70 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-primary">
            <span className="h-1.5 w-1.5 rounded-full bg-status-concluido" />
            Operação técnica
          </p>
          <h1 className="text-3xl font-bold tracking-[-0.04em] text-foreground sm:text-[2.15rem]" data-testid="heading-dashboard">Visão Geral</h1>
          <p className="mt-1.5 text-sm text-muted-foreground" data-testid="text-dashboard-subtitle">Monitore o status da operação técnica em tempo real.</p>
        </div>
        <Button type="button" variant="outline" className="w-fit gap-2 bg-card" onClick={atualizarDados} disabled={carregando} data-testid="button-refresh-dashboard">
          <RefreshCw className={`h-4 w-4 ${carregando ? "animate-spin" : ""}`} />
          {carregando ? "Atualizando..." : "Atualizar dados"}
        </Button>
      </header>

      <Card className="overflow-hidden border-border/80 shadow-sm" data-testid="card-period-filter">
        <CardContent className="p-0">
          <div className="flex flex-col gap-5 p-5 sm:p-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
              <div className="space-y-2">
                <Label htmlFor="dashboard-data-inicio" className="text-xs font-semibold text-foreground">Data inicial</Label>
                <div className="relative">
                  <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="dashboard-data-inicio"
                    data-testid="input-date-start"
                    type="date"
                    className="h-10 w-full bg-background pl-9 sm:w-[185px]"
                    value={draftInicio}
                    max={draftFim || undefined}
                    onChange={(event) => setDraftInicio(event.target.value)}
                    aria-invalid={intervaloInvalido}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="dashboard-data-fim" className="text-xs font-semibold text-foreground">Data final</Label>
                <div className="relative">
                  <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="dashboard-data-fim"
                    data-testid="input-date-end"
                    type="date"
                    className="h-10 w-full bg-background pl-9 sm:w-[185px]"
                    value={draftFim}
                    min={draftInicio || undefined}
                    onChange={(event) => setDraftFim(event.target.value)}
                    aria-invalid={intervaloInvalido}
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button type="button" className="h-10 gap-2" onClick={aplicarPeriodo} disabled={intervaloInvalido || (draftInicio === periodo.inicio && draftFim === periodo.fim)} data-testid="button-apply-period">
                  <DatabaseZap className="h-4 w-4" />
                  Aplicar
                </Button>
                <Button type="button" variant="ghost" className="h-10 gap-2 px-3" disabled={!draftInicio && !draftFim && !filtrandoPeriodo} onClick={limparPeriodo} data-testid="button-clear-period">
                  <FilterX className="h-4 w-4" />
                  Limpar
                </Button>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground" data-testid="text-period-summary">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
              {filtrandoPeriodo
                ? `Atendimentos de ${formatDate(periodo.inicio) || "qualquer data"} a ${formatDate(periodo.fim) || "hoje"}`
                : "Todo o histórico disponível"}
            </div>
          </div>
          {intervaloInvalido && (
            <div className="flex items-center gap-2 border-t border-destructive/20 bg-destructive/5 px-5 py-3 text-sm font-medium text-destructive sm:px-6" data-testid="state-invalid-period">
              <CircleAlert className="h-4 w-4 shrink-0" />
              A data inicial não pode ser posterior à data final.
            </div>
          )}
          {falhas.length > 0 && !intervaloInvalido && (
            <div className="flex flex-col gap-3 border-t border-destructive/20 bg-destructive/5 px-5 py-3 text-sm text-destructive sm:flex-row sm:items-center sm:justify-between sm:px-6" data-testid="state-dashboard-error">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  <p className="font-semibold">Alguns dados não puderam ser atualizados.</p>
                  <p className="mt-0.5 text-xs text-destructive/80">{queryErrorMessage(falhas[0].error)}</p>
                </div>
              </div>
              <Button type="button" variant="outline" size="sm" className="w-fit border-destructive/30 bg-card text-destructive hover:bg-destructive/10" onClick={atualizarDados} data-testid="button-retry-dashboard">
                Tentar novamente
              </Button>
            </div>
          )}
          {resumoParcial && falhas.length === 0 && !intervaloInvalido && (
            <div className="flex items-center gap-2 border-t border-status-aguardando/20 bg-status-aguardando/10 px-5 py-3 text-xs text-foreground sm:px-6" data-testid="state-dashboard-partial">
              <CircleAlert className="h-4 w-4 text-status-aguardando" />
              Alguns contadores estão temporariamente indisponíveis; os demais indicadores continuam disponíveis.
            </div>
          )}
        </CardContent>
      </Card>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5" aria-label="Indicadores de atendimento">
        <MetricCard title={filtrandoPeriodo ? "No período" : "Total de atendimentos"} value={resumo?.total} icon={FileStack} tone="border-l-primary" loading={resumoQuery.isLoading} error={resumoQuery.isError || resumo?.unavailable?.includes("total") === true} testId="total" />
        <MetricCard title="Em análise" value={resumo?.emAnalise} icon={Clock3} tone="border-l-status-analise" loading={resumoQuery.isLoading} error={resumoQuery.isError || resumo?.unavailable?.includes("emAnalise") === true} testId="analysis" />
        <MetricCard title="Aguardando peça" value={resumo?.aguardandoPeca} icon={AlertTriangle} tone="border-l-status-aguardando" loading={resumoQuery.isLoading} error={resumoQuery.isError || resumo?.unavailable?.includes("aguardandoPeca") === true} testId="waiting-part" />
        <MetricCard title="Para conserto" value={resumo?.paraConserto} icon={Wrench} tone="border-l-status-conserto" loading={resumoQuery.isLoading} error={resumoQuery.isError || resumo?.unavailable?.includes("paraConserto") === true} testId="repair" />
        <MetricCard title="Concluídas" value={resumo?.concluidas} icon={CheckCircle2} tone="border-l-status-concluido" loading={resumoQuery.isLoading} error={resumoQuery.isError || resumo?.unavailable?.includes("concluidas") === true} detail={!filtrandoPeriodo ? `Fechadas hoje: ${resumo?.hojeFechadas ?? 0}` : undefined} testId="completed" />
      </section>

      <section className="grid gap-4 lg:grid-cols-7" aria-label="Análises da operação">
        <Card className="lg:col-span-4 shadow-sm" data-testid="card-status-chart">
          <CardHeader className="flex flex-row items-start justify-between space-y-0">
            <div>
              <CardTitle className="text-base">Chamadas por status</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">Distribuição dos atendimentos selecionados</p>
            </div>
            <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="h-[300px]">
            {statusQuery.isLoading ? <div className="h-full animate-pulse rounded-lg bg-muted/60" data-testid="state-status-loading" /> : statusQuery.isError ? <ChartUnavailable message={queryErrorMessage(statusQuery.error)} /> : statusData.length === 0 ? <ChartUnavailable message="Nenhum status encontrado no período." /> : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={statusData} layout="vertical" margin={{ top: 5, right: 25, left: 38, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
                  <XAxis type="number" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis dataKey="situacao" type="category" fontSize={11} tickLine={false} axisLine={false} width={100} />
                  <Tooltip cursor={{ fill: "hsl(var(--muted))" }} contentStyle={{ borderRadius: "8px", border: "1px solid hsl(var(--border))", background: "hsl(var(--card))", fontSize: "12px" }} />
                  <Bar dataKey="total" radius={[0, 4, 4, 0]}>
                    {statusData.map((entry, index) => <Cell key={`status-${entry.situacao}-${index}`} fill={COLORS[entry.situacao as keyof typeof COLORS] || "hsl(var(--primary))"} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-3 shadow-sm" data-testid="card-equipment-chart">
          <CardHeader>
            <CardTitle className="text-base">Equipamentos atendidos</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">Tipos registrados nas chamadas</p>
          </CardHeader>
          <CardContent className="h-[300px]">
            {equipamentoQuery.isLoading ? <div className="h-full animate-pulse rounded-lg bg-muted/60" data-testid="state-equipment-loading" /> : equipamentoQuery.isError ? <ChartUnavailable message={queryErrorMessage(equipamentoQuery.error)} /> : equipData.length === 0 ? <ChartUnavailable message="Nenhum equipamento encontrado no período." /> : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={equipData} cx="50%" cy="50%" innerRadius={58} outerRadius={90} paddingAngle={2} dataKey="total" nameKey="tipo">
                    {equipData.map((entry, index) => <Cell key={`equipment-${entry.tipo}-${index}`} fill={`hsl(var(--chart-${(index % 5) + 1}))`} />)}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: "8px", border: "1px solid hsl(var(--border))", background: "hsl(var(--card))", fontSize: "12px" }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </section>

      <Card className="shadow-sm" data-testid="card-recent-calls">
        <CardHeader className="flex flex-row items-end justify-between gap-4">
          <div>
            <CardTitle className="text-base">Chamadas recentes{filtrandoPeriodo ? " no período" : ""}</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">Os últimos atendimentos registrados</p>
          </div>
          <Link href="/chamadas" className="flex shrink-0 items-center gap-1 text-xs font-semibold text-primary hover:underline" data-testid="link-all-calls">
            Ver todas <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[100px]">OS</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Equipamento</TableHead>
                  <TableHead>Abertura</TableHead>
                  <TableHead>Técnico</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentesQuery.isLoading ? (
                  Array.from({ length: 3 }).map((_, index) => <TableRow key={`loading-${index}`}><TableCell colSpan={6}><SkeletonRow /></TableCell></TableRow>)
                ) : recentesQuery.isError ? (
                  <TableRow><TableCell colSpan={6} className="py-10 text-center"><div className="flex flex-col items-center gap-2 text-sm text-muted-foreground" data-testid="state-recent-calls-error"><ServerOff className="h-5 w-5" />Não foi possível carregar as chamadas recentes.</div></TableCell></TableRow>
                ) : recentes.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground" data-testid="state-recent-calls-empty">Nenhuma chamada encontrada no período selecionado.</TableCell></TableRow>
                ) : (
                  recentes.map((call) => (
                    <TableRow key={call.codigo} data-testid={`row-recent-call-${call.codigo}`}>
                      <TableCell className="font-mono text-xs font-bold text-primary">#{call.codigo}</TableCell>
                      <TableCell><StatusBadge status={call.situacao_zenthi} /></TableCell>
                      <TableCell className="max-w-[220px] truncate font-medium" title={call.razao_social}>{call.razao_social}</TableCell>
                      <TableCell className="text-muted-foreground">{call.marca} {call.modelo}</TableCell>
                      <TableCell className="whitespace-nowrap font-mono text-xs">{formatDateTime(call.emissao)}</TableCell>
                      <TableCell className="max-w-[160px] truncate text-xs text-muted-foreground">{call.email_tecnico || "Sem técnico"}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}