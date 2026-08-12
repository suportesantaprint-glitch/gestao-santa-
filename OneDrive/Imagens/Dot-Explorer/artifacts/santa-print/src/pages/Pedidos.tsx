import type { Pedido } from "@workspace/api-client-react"
import { useQuery } from "@tanstack/react-query"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { LoadingTable, EmptyState } from "@/components/States"
import { formatCurrency, formatDate } from "@/lib/format"
import { usePagination } from "@/hooks/use-pagination"
import { useFilters } from "@/hooks/use-filters"
import { AlertTriangle, Search } from "lucide-react"
import { Pagination, PaginationContent, PaginationItem, PaginationPrevious, PaginationNext } from "@/components/ui/pagination"

type PedidosResponse = {
  data: Pedido[]
  total: number
  page: number
  limit: number
}

const DEFAULT_PEDIDOS_API_URL = "https://gestao-santa.suporte-santaprint.workers.dev"

function getPedidosEndpoint(): string {
  const baseUrl = String(import.meta.env.VITE_PEDIDOS_API_URL ?? DEFAULT_PEDIDOS_API_URL).trim().replace(/\/+$/, "")
  return `${baseUrl}/api/pedidos`
}

async function fetchPedidos(params: { page: number; limit: number; cliente: string; mesAno: string }): Promise<PedidosResponse> {
  const url = new URL(getPedidosEndpoint())
  url.searchParams.set("page", String(params.page))
  url.searchParams.set("limit", String(params.limit))
  if (params.cliente) url.searchParams.set("cliente", params.cliente)
  if (params.mesAno) url.searchParams.set("mesAno", params.mesAno)

  const response = await fetch(url.toString(), { headers: { Accept: "application/json" } })
  if (!response.ok) {
    const detail = await response.text()
    throw new Error(`Cloudflare ${response.status}: ${detail}`)
  }
  return response.json() as Promise<PedidosResponse>
}

export function Pedidos() {
  const { page, setPage, limit } = usePagination(1, 50)
  const { filters, setFilter } = useFilters({ cliente: "", mesAno: "" })

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["cloudflare-pedidos", page, limit, filters],
    queryFn: () => fetchPedidos({ page, limit, cliente: filters.cliente, mesAno: filters.mesAno }),
  })

  const totalPages = data ? Math.ceil(data.total / limit) : 0

  return (
    <div className="space-y-6 flex flex-col h-full">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Pedidos Comerciais</h1>
          <p className="text-muted-foreground text-sm">Vendas e faturamento da equipe comercial.</p>
        </div>
      </div>

      <Card className="shadow-sm">
        <CardContent className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="space-y-1.5 lg:col-span-2">
            <Label className="text-xs">Cliente</Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar cliente..." className="pl-9" value={filters.cliente} onChange={(e) => { setFilter("cliente", e.target.value); setPage(1); }} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Mês/Ano (MM/YYYY)</Label>
            <Input placeholder="Ex: 10/2023" value={filters.mesAno} onChange={(e) => { setFilter("mesAno", e.target.value); setPage(1); }} />
          </div>
        </CardContent>
      </Card>

      {isError && (
        <Card className="border-destructive/50 bg-destructive/5 shadow-sm">
          <CardContent className="flex items-start gap-3 p-4">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" aria-hidden="true" />
            <div className="min-w-0">
              <p className="font-semibold text-destructive">Não foi possível carregar os pedidos</p>
              <p className="mt-1 break-words text-sm text-muted-foreground">{error instanceof Error ? error.message : "Falha ao consultar o Worker Cloudflare."}</p>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="flex-1 shadow-sm flex flex-col overflow-hidden">
        <div className="overflow-auto flex-1">
          <Table>
            <TableHeader className="sticky top-0 bg-background z-10 shadow-sm">
              <TableRow>
                <TableHead className="w-[100px]">Pedido</TableHead><TableHead className="w-[120px]">Emissão</TableHead><TableHead className="min-w-[200px]">Cliente</TableHead><TableHead className="min-w-[200px]">Produto</TableHead><TableHead className="w-[80px] text-right">Qtd</TableHead><TableHead className="w-[120px] text-right">Valor Venda</TableHead><TableHead className="w-[150px]">Representante</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? <TableRow><TableCell colSpan={7}><LoadingTable rows={10} /></TableCell></TableRow> : isError ? <TableRow><TableCell colSpan={7}><EmptyState title="Pedidos indisponíveis" description="A consulta à Cloudflare falhou. O erro detalhado está exibido acima." /></TableCell></TableRow> : data?.data.length === 0 ? <TableRow><TableCell colSpan={7}><EmptyState title="Nenhum pedido" description="A base de pedidos está vazia ou não corresponde aos filtros." /></TableCell></TableRow> : data?.data.map((item, idx) => (
                <TableRow key={`${item.pedido}-${idx}`} className="group">
                  <TableCell className="font-mono text-xs font-medium">{item.pedido || "-"}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{formatDate(item.data_emissao)}</TableCell>
                  <TableCell className="font-medium text-sm"><div className="line-clamp-2" title={item.nome_cliente || ""}>{item.nome_cliente || "-"}</div></TableCell>
                  <TableCell className="text-sm"><div className="line-clamp-1" title={item.descricao || ""}>{item.descricao || item.produto || "-"}</div></TableCell>
                  <TableCell className="text-right font-mono text-sm">{item.qtde || 0}</TableCell>
                  <TableCell className="text-right font-mono text-xs font-semibold">{formatCurrency(item.valor_venda)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground truncate" title={item.nome_repres || ""}>{item.nome_repres || "-"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        {!isError && totalPages > 1 && <div className="border-t p-4 flex items-center justify-between bg-card text-sm text-muted-foreground"><div>Página <span className="font-medium text-foreground">{page}</span> de <span className="font-medium text-foreground">{totalPages}</span></div><Pagination className="w-auto mx-0"><PaginationContent><PaginationItem><PaginationPrevious onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} /></PaginationItem><PaginationItem><PaginationNext onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} /></PaginationItem></PaginationContent></Pagination></div>}
      </Card>
    </div>
  )
}
