import { useListPecas } from "@workspace/api-client-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { LoadingTable, EmptyState } from "@/components/States"
import { formatCurrency, formatDateTime } from "@/lib/format"
import { usePagination } from "@/hooks/use-pagination"
import { useFilters } from "@/hooks/use-filters"
import { Search, Download } from "lucide-react"
import { Pagination, PaginationContent, PaginationItem, PaginationPrevious, PaginationNext } from "@/components/ui/pagination"
import { Badge } from "@/components/ui/badge"

export function Pecas() {
  const { page, setPage, limit } = usePagination(1, 50)
  const { filters, setFilter, resetFilters } = useFilters({
    chamadaNumero: "",
    descProduto: "",
    dataInicio: "",
    dataFim: ""
  })

  // Parse chamadaNumero to number if present
  const queryParams = {
    ...filters,
    chamadaNumero: filters.chamadaNumero ? Number(filters.chamadaNumero) : undefined,
    page,
    limit
  }

  const { data, isLoading } = useListPecas(queryParams as any)

  const handleExport = () => {
    const params = new URLSearchParams()
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.append(key, value as string)
    })
    window.open('/api/pecas/exportar?' + params.toString())
  }

  const totalPages = data ? Math.ceil(data.total / limit) : 0

  return (
    <div className="space-y-6 flex flex-col h-full">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Consumo de Peças</h1>
          <p className="text-muted-foreground text-sm">Histórico de peças e suprimentos aplicados em serviços.</p>
        </div>
        <Button onClick={handleExport} variant="outline" className="gap-2">
          <Download className="h-4 w-4" /> Exportar Excel
        </Button>
      </div>

      <Card className="shadow-sm">
        <CardContent className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="space-y-1.5 lg:col-span-2">
            <Label className="text-xs">Produto / Peça</Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Descrição do produto..." 
                className="pl-9"
                value={filters.descProduto}
                onChange={(e) => { setFilter("descProduto", e.target.value); setPage(1); }}
              />
            </div>
          </div>
          
          <div className="space-y-1.5">
            <Label className="text-xs">Nº OS (Chamada)</Label>
            <Input 
              type="number"
              placeholder="Ex: 12345"
              value={filters.chamadaNumero}
              onChange={(e) => { setFilter("chamadaNumero", e.target.value); setPage(1); }}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Data Início</Label>
            <Input 
              type="date" 
              value={filters.dataInicio} 
              onChange={(e) => { setFilter("dataInicio", e.target.value); setPage(1); }} 
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Data Fim</Label>
            <Input 
              type="date" 
              value={filters.dataFim} 
              onChange={(e) => { setFilter("dataFim", e.target.value); setPage(1); }} 
            />
          </div>

        </CardContent>
      </Card>

      <Card className="flex-1 shadow-sm flex flex-col overflow-hidden">
        <div className="overflow-auto flex-1">
          <Table>
            <TableHeader className="sticky top-0 bg-background z-10 shadow-sm">
              <TableRow>
                <TableHead className="w-[100px]">OS</TableHead>
                <TableHead className="w-[140px]">Data Aplicação</TableHead>
                <TableHead className="min-w-[250px]">Produto / Peça</TableHead>
                <TableHead className="w-[120px]">Marca</TableHead>
                <TableHead className="w-[80px] text-right">Qtd</TableHead>
                <TableHead className="w-[120px] text-right">Valor Item</TableHead>
                <TableHead className="w-[120px] text-center">Estoque</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7}><LoadingTable rows={10} /></TableCell></TableRow>
              ) : data?.data.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7}>
                    <EmptyState 
                      title="Nenhuma peça encontrada" 
                      description="Não há registros de consumo com os filtros atuais."
                    />
                  </TableCell>
                </TableRow>
              ) : (
                data?.data.map((item, idx) => (
                  <TableRow key={`${item.chamada_number}-${item.id_sales_peca || idx}`} className="group">
                    <TableCell className="font-mono text-xs font-medium">#{item.chamada_number}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{formatDateTime(item.data_encerramento || item.data_abertura)}</TableCell>
                    <TableCell className="font-medium text-sm">
                      <div className="line-clamp-2" title={item.desc_produto}>{item.desc_produto}</div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{item.desc_marca || "-"}</TableCell>
                    <TableCell className="text-right font-mono text-sm">{item.qtdem || 0}</TableCell>
                    <TableCell className="text-right font-mono text-xs">{formatCurrency(item.valor_item)}</TableCell>
                    <TableCell className="text-center">
                      {item.movimentou_estoque === "S" ? (
                        <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">Sim</Badge>
                      ) : (
                        <Badge variant="outline" className="bg-muted text-muted-foreground">Não</Badge>
                      )}
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
