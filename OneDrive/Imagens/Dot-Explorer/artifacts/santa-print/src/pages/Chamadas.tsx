import { useState } from "react"
import { useListChamadas, useGetFiltrosOpcoes } from "@workspace/api-client-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { StatusBadge } from "@/components/StatusBadge"
import { LoadingTable, EmptyState } from "@/components/States"
import { formatDateTime } from "@/lib/format"
import { usePagination } from "@/hooks/use-pagination"
import { useFilters } from "@/hooks/use-filters"
import { Search, Download, FilterX } from "lucide-react"
import { Pagination, PaginationContent, PaginationItem, PaginationPrevious, PaginationNext } from "@/components/ui/pagination"

export function Chamadas() {
  const { page, setPage, limit } = usePagination(1, 50)
  const { filters, setFilter, resetFilters } = useFilters({
    situacao: "",
    dataInicio: "",
    dataFim: "",
    tipoEquipamento: "",
    tipoContrato: "",
    tipoEntrada: "",
    marca: "",
    cliente: "",
    tecnico: ""
  })

  // Debounce string filters conceptually by only fetching on exact data
  // Using the hooks directly with params
  const { data, isLoading } = useListChamadas({
    page,
    limit,
    ...filters
  })

  const { data: options } = useGetFiltrosOpcoes()

  const handleExport = () => {
    const params = new URLSearchParams()
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.append(key, value as string)
    })
    window.open('/api/chamadas/exportar?' + params.toString())
  }

  const handleApplyFilter = (key: keyof typeof filters, value: string) => {
    setFilter(key, value === "all" ? "" : value)
    setPage(1)
  }

  const totalPages = data ? Math.ceil(data.total / limit) : 0

  return (
    <div className="space-y-6 flex flex-col h-full">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Chamadas de Serviço</h1>
          <p className="text-muted-foreground text-sm">Gerencie e filtre ordens de serviço ({data?.total || 0} registros).</p>
        </div>
        <Button onClick={handleExport} variant="outline" className="gap-2">
          <Download className="h-4 w-4" /> Exportar Excel
        </Button>
      </div>

      <Card className="shadow-sm">
        <CardContent className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Cliente (Razão Social)</Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Buscar cliente..." 
                className="pl-9"
                value={filters.cliente}
                onChange={(e) => handleApplyFilter("cliente", e.target.value)}
              />
            </div>
          </div>
          
          <div className="space-y-1.5">
            <Label className="text-xs">Status</Label>
            <Select value={filters.situacao || "all"} onValueChange={(v) => handleApplyFilter("situacao", v)}>
              <SelectTrigger>
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {options?.situacoes?.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Data Início</Label>
            <Input 
              type="date" 
              value={filters.dataInicio} 
              onChange={(e) => handleApplyFilter("dataInicio", e.target.value)} 
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Data Fim</Label>
            <Input 
              type="date" 
              value={filters.dataFim} 
              onChange={(e) => handleApplyFilter("dataFim", e.target.value)} 
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Tipo Equipamento</Label>
            <Select value={filters.tipoEquipamento || "all"} onValueChange={(v) => handleApplyFilter("tipoEquipamento", v)}>
              <SelectTrigger>
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {options?.tiposEquipamento?.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Marca</Label>
            <Select value={filters.marca || "all"} onValueChange={(v) => handleApplyFilter("marca", v)}>
              <SelectTrigger>
                <SelectValue placeholder="Todas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {options?.marcas?.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Técnico</Label>
            <Select value={filters.tecnico || "all"} onValueChange={(v) => handleApplyFilter("tecnico", v)}>
              <SelectTrigger>
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {options?.tecnicos?.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-end">
            <Button variant="ghost" onClick={resetFilters} className="w-full gap-2 text-muted-foreground">
              <FilterX className="h-4 w-4" /> Limpar Filtros
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="flex-1 shadow-sm flex flex-col overflow-hidden">
        <div className="overflow-auto flex-1">
          <Table>
            <TableHeader className="sticky top-0 bg-background z-10 shadow-sm">
              <TableRow>
                <TableHead className="w-[80px]">OS</TableHead>
                <TableHead className="w-[140px]">Status</TableHead>
                <TableHead className="min-w-[200px]">Cliente</TableHead>
                <TableHead className="w-[140px]">Cidade</TableHead>
                <TableHead className="w-[180px]">Equipamento</TableHead>
                <TableHead className="w-[150px]">Abertura</TableHead>
                <TableHead className="w-[180px]">Técnico</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7}><LoadingTable rows={10} /></TableCell></TableRow>
              ) : data?.data.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7}>
                    <EmptyState 
                      title="Nenhuma chamada encontrada" 
                      description="Tente ajustar os filtros de busca para encontrar o que procura."
                    />
                  </TableCell>
                </TableRow>
              ) : (
                data?.data.map((item) => (
                  <TableRow key={item.codigo} className="group">
                    <TableCell className="font-mono text-xs font-medium">#{item.codigo}</TableCell>
                    <TableCell><StatusBadge status={item.situacao_zenthi} /></TableCell>
                    <TableCell className="font-medium">
                      <div className="line-clamp-2" title={item.razao_social}>{item.razao_social}</div>
                      {item.setor && <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{item.setor}</div>}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{item.cidade}</TableCell>
                    <TableCell>
                      <div className="text-sm font-medium">{item.marca || "-"}</div>
                      <div className="text-xs text-muted-foreground truncate" title={item.modelo || ""}>{item.modelo || "-"}</div>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{formatDateTime(item.emissao)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground truncate" title={item.email_tecnico || ""}>
                      {item.email_tecnico || "Não atribuído"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        
        {totalPages > 1 && (
          <div className="border-t p-4 flex items-center justify-between bg-card text-sm text-muted-foreground">
            <div>
              Página <span className="font-medium text-foreground">{page}</span> de <span className="font-medium text-foreground">{totalPages}</span>
            </div>
            <Pagination className="w-auto mx-0">
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious 
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                  />
                </PaginationItem>
                <PaginationItem>
                  <PaginationNext 
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        )}
      </Card>
    </div>
  )
}
