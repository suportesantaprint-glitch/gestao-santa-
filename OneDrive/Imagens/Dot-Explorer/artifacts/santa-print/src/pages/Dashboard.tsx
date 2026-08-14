import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Link } from "wouter"
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Clock,
  FileStack,
  FilterX,
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
}

type DashboardStatus = {
  situacao: string
  total: number
}

type DashboardEquipamento = {
  tipo: string
  total: number
}

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
  const response = await fetch(url)

  if (!response.ok) {
    const details = await response.text()
    throw new Error(details || "Não foi possível carregar o dashboard")
  }

  return response.json() as Promise<T>
}

export function Dashboard() {
  const [dataInicio, setDataInicio] = useState("")
  const [dataFim, setDataFim] = useState("")

  const intervaloInvalido = Boolean(dataInicio && dataFim && dataInicio > dataFim)

  const queryString = useMemo(() => {
    const params = new URLSearchParams()
    if (dataInicio) params.set("dataInicio", dataInicio)
    if (dataFim) params.set("dataFim", dataFim)
    return params.toString()
  }, [dataFim, dataInicio])

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
    enabled: !intervaloInvalido,
  })

  const statusQuery = useQuery<DashboardStatus[]>({
    queryKey: ["dashboard-status", queryString],
    queryFn: () => fetchJson<DashboardStatus[]>(dashboardUrl("por-status")),
    enabled: !intervaloInvalido,
  })

  const equipamentoQuery = useQuery<DashboardEquipamento[]>({
    queryKey: ["dashboard-equipamentos", queryString],
    queryFn: () => fetchJson<DashboardEquipamento[]>(dashboardUrl("por-equipamento")),
    enabled: !intervaloInvalido,
  })

  const recentesQuery = useQuery<ChamadasResponse>({
    queryKey: ["dashboard-recentes", queryString],
    queryFn: () => fetchJson<ChamadasResponse>(chamadasRecentesUrl),
    enabled: !intervaloInvalido,
  })

  const resumo = resumoQuery.data
  const statusData = statusQuery.data
  const equipData = equipamentoQuery.data
  const recentes = recentesQuery.data?.data
  const filtrandoPeriodo = Boolean(dataInicio || dataFim)
  const hasError = resumoQuery.isError || statusQuery.isError || equipamentoQuery.isError || recentesQuery.isError

  const limparPeriodo = () => {
    setDataInicio("")
    setDataFim("")
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Visão Geral</h1>
        <p className="text-muted-foreground">Monitore o status da operação técnica em tempo real.</p>
      </div>

      <Card className="shadow-sm">
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
              <div className="space-y-1.5">
                <Label htmlFor="dashboard-data-inicio">Data inicial</Label>
                <div className="relative">
                  <CalendarDays className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="dashboard-data-inicio"
                    type="date"
                    className="w-full pl-9 sm:w-[190px]"
                    value={dataInicio}
                    max={dataFim || undefined}
                    onChange={(event) => setDataInicio(event.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="dashboard-data-fim">Data final</Label>
                <div className="relative">
                  <CalendarDays className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="dashboard-data-fim"
                    type="date"
                    className="w-full pl-9 sm:w-[190px]"
                    value={dataFim}
                    min={dataInicio || undefined}
                    onChange={(event) => setDataFim(event.target.value)}
                  />
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                className="gap-2"
                disabled={!filtrandoPeriodo}
                onClick={limparPeriodo}
              >
                <FilterX className="h-4 w-4" />
                Limpar período
              </Button>
            </div>

            <p className="text-sm text-muted-foreground">
              {filtrandoPeriodo
                ? `Exibindo atendimentos ${dataInicio ? `a partir de ${dataInicio.split("-").reverse().join("/")}` : ""}${dataInicio && dataFim ? " " : ""}${dataFim ? `até ${dataFim.split("-").reverse().join("/")}` : ""}.`
                : "Exibindo todo o histórico disponível."}
            </p>
          </div>

          {intervaloInvalido && (
            <p className="mt-3 text-sm font-medium text-destructive">
              A data inicial não pode ser posterior à data final.
            </p>
          )}

          {hasError && !intervaloInvalido && (
            <p className="mt-3 text-sm font-medium text-destructive">
              Não foi possível atualizar todos os indicadores. Tente novamente.
            </p>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{filtrandoPeriodo ? "Atendimentos no período" : "Total de atendimentos"}</CardTitle>
            <FileStack className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{resumoQuery.isLoading ? "-" : resumo?.total ?? 0}</div>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-l-4 border-l-status-analise">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Em Análise</CardTitle>
            <Clock className="h-4 w-4 text-status-analise" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{resumoQuery.isLoading ? "-" : resumo?.emAnalise ?? 0}</div>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-l-4 border-l-status-aguardando">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Aguardando Peça</CardTitle>
            <AlertTriangle className="h-4 w-4 text-status-aguardando" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{resumoQuery.isLoading ? "-" : resumo?.aguardandoPeca ?? 0}</div>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-l-4 border-l-status-conserto">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Para Conserto</CardTitle>
            <Wrench className="h-4 w-4 text-status-conserto" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{resumoQuery.isLoading ? "-" : resumo?.paraConserto ?? 0}</div>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-l-4 border-l-status-concluido">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Concluídas</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-status-concluido" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{resumoQuery.isLoading ? "-" : resumo?.concluidas ?? 0}</div>
            {!filtrandoPeriodo && (
              <p className="mt-1 text-xs text-muted-foreground">
                Fechadas hoje: {resumoQuery.isLoading ? "-" : resumo?.hojeFechadas ?? 0}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Chamadas por Status</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            {statusQuery.isLoading ? (
              <div className="flex h-full items-center justify-center text-muted-foreground">Carregando gráfico...</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={statusData} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
                  <XAxis type="number" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis dataKey="situacao" type="category" fontSize={12} tickLine={false} axisLine={false} width={100} />
                  <Tooltip
                    cursor={{ fill: "hsl(var(--muted))" }}
                    contentStyle={{ borderRadius: "8px", border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }}
                  />
                  <Bar dataKey="total" radius={[0, 4, 4, 0]}>
                    {statusData?.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[entry.situacao as keyof typeof COLORS] || "hsl(var(--primary))"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="col-span-3 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Equipamentos Atendidos</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            {equipamentoQuery.isLoading ? (
              <div className="flex h-full items-center justify-center text-muted-foreground">Carregando gráfico...</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={equipData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={2}
                    dataKey="total"
                    nameKey="tipo"
                  >
                    {equipData?.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={`hsl(var(--chart-${(index % 5) + 1}))`} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ borderRadius: "8px", border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Chamadas Recentes{filtrandoPeriodo ? " no período" : ""}</CardTitle>
          <Link href="/chamadas" className="text-sm font-medium text-primary hover:underline">
            Ver todas
          </Link>
        </CardHeader>
        <CardContent>
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
                <>
                  <TableRow><TableCell colSpan={6}><SkeletonRow /></TableCell></TableRow>
                  <TableRow><TableCell colSpan={6}><SkeletonRow /></TableCell></TableRow>
                  <TableRow><TableCell colSpan={6}><SkeletonRow /></TableCell></TableRow>
                </>
              ) : recentes?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                    Nenhuma chamada encontrada no período selecionado.
                  </TableCell>
                </TableRow>
              ) : (
                recentes?.map((call) => (
                  <TableRow key={call.codigo}>
                    <TableCell className="font-mono text-xs font-medium">#{call.codigo}</TableCell>
                    <TableCell>
                      <StatusBadge status={call.situacao_zenthi} />
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate font-medium" title={call.razao_social}>
                      {call.razao_social}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {call.marca} {call.modelo}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {formatDateTime(call.emissao)}
                    </TableCell>
                    <TableCell className="max-w-[150px] truncate text-xs text-muted-foreground">
                      {call.email_tecnico || "-"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
