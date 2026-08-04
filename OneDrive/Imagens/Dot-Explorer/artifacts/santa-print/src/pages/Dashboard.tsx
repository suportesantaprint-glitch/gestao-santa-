import { useGetDashboardResumo, useGetDashboardPorStatus, useGetDashboardPorEquipamento, useGetDashboardRecentes } from "@workspace/api-client-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { StatusBadge } from "@/components/StatusBadge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Link } from "wouter"
import { formatDateTime } from "@/lib/format"
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, PieChart, Pie, Cell } from "recharts"
import { SkeletonRow } from "@/components/States"
import { FileStack, Wrench, AlertTriangle, CheckCircle2, Clock } from "lucide-react"

const COLORS = {
  "Em Análise": "hsl(var(--status-analise))",
  "Concluído": "hsl(var(--status-concluido))",
  "Cancelado": "hsl(var(--status-cancelado))",
  "Aguardando Peça": "hsl(var(--status-aguardando))",
  "Para Conserto": "hsl(var(--status-conserto))"
}

export function Dashboard() {
  const { data: resumo, isLoading: loadingResumo } = useGetDashboardResumo()
  const { data: statusData, isLoading: loadingStatus } = useGetDashboardPorStatus()
  const { data: equipData, isLoading: loadingEquip } = useGetDashboardPorEquipamento()
  const { data: recentes, isLoading: loadingRecentes } = useGetDashboardRecentes()

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Visão Geral</h1>
        <p className="text-muted-foreground">Monitore o status da operação técnica em tempo real.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Abertas Hoje</CardTitle>
            <FileStack className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loadingResumo ? "-" : resumo?.hojeAbertas}</div>
          </CardContent>
        </Card>
        
        <Card className="shadow-sm border-l-4 border-l-status-analise">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Em Análise</CardTitle>
            <Clock className="h-4 w-4 text-status-analise" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loadingResumo ? "-" : resumo?.emAnalise}</div>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-l-4 border-l-status-aguardando">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Aguardando Peça</CardTitle>
            <AlertTriangle className="h-4 w-4 text-status-aguardando" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loadingResumo ? "-" : resumo?.aguardandoPeca}</div>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-l-4 border-l-status-conserto">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Para Conserto</CardTitle>
            <Wrench className="h-4 w-4 text-status-conserto" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loadingResumo ? "-" : resumo?.paraConserto}</div>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-l-4 border-l-status-concluido">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Concluídas</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-status-concluido" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loadingResumo ? "-" : resumo?.concluidas}</div>
            <p className="text-xs text-muted-foreground mt-1">Fechadas hoje: {loadingResumo ? "-" : resumo?.hojeFechadas}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Chamadas por Status</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            {loadingStatus ? (
              <div className="flex h-full items-center justify-center text-muted-foreground">Carregando gráfico...</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={statusData} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
                  <XAxis type="number" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis dataKey="situacao" type="category" fontSize={12} tickLine={false} axisLine={false} width={100} />
                  <Tooltip 
                    cursor={{fill: 'hsl(var(--muted))'}} 
                    contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))' }}
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
            {loadingEquip ? (
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
                    contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Chamadas Recentes</CardTitle>
          <Link href="/chamadas" className="text-sm text-primary hover:underline font-medium">
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
              {loadingRecentes ? (
                <>
                  <TableRow><TableCell colSpan={6}><SkeletonRow /></TableCell></TableRow>
                  <TableRow><TableCell colSpan={6}><SkeletonRow /></TableCell></TableRow>
                  <TableRow><TableCell colSpan={6}><SkeletonRow /></TableCell></TableRow>
                </>
              ) : recentes?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    Nenhuma chamada recente.
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
                    <TableCell className="text-muted-foreground text-xs truncate max-w-[150px]">
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
