import { useListContratos } from "@workspace/api-client-react"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { LoadingTable, EmptyState } from "@/components/States"
import { usePagination } from "@/hooks/use-pagination"
import { Pagination, PaginationContent, PaginationItem, PaginationPrevious, PaginationNext } from "@/components/ui/pagination"

export function Contratos() {
  const { page, setPage, limit } = usePagination(1, 50)

  const { data, isLoading } = useListContratos({
    page,
    limit,
  })

  const totalPages = data ? Math.ceil(data.total / limit) : 0

  return (
    <div className="space-y-6 flex flex-col h-full">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Contratos de Locação</h1>
          <p className="text-muted-foreground text-sm">Controle de equipamentos em campo sob contrato.</p>
        </div>
      </div>

      <Card className="flex-1 shadow-sm flex flex-col overflow-hidden">
        <div className="overflow-auto flex-1">
          <Table>
            <TableHeader className="sticky top-0 bg-background z-10 shadow-sm">
              <TableRow>
                <TableHead className="w-[100px]">ID Contrato</TableHead>
                <TableHead>Detalhes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={2}><LoadingTable rows={5} /></TableCell></TableRow>
              ) : data?.data.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={2}>
                    <EmptyState 
                      title="Módulo em desenvolvimento" 
                      description="A base de contratos não possui registros ou o módulo ainda não foi integrado."
                    />
                  </TableCell>
                </TableRow>
              ) : (
                data?.data.map((item, idx) => (
                  <TableRow key={`${item.id}-${idx}`}>
                    <TableCell className="font-mono text-xs">{item.id || "-"}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">Dados não disponíveis na API</TableCell>
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
