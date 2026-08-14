import { useState } from "react"
import {
  useGetChamada,
  useGetFiltrosOpcoes,
  useListChamadas,
  useListPecas,
} from "@workspace/api-client-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { StatusBadge } from "@/components/StatusBadge"
import { EmptyState, LoadingTable } from "@/components/States"
import { formatCurrency, formatDateTime } from "@/lib/format"
import { usePagination } from "@/hooks/use-pagination"
import { useFilters } from "@/hooks/use-filters"
import { AlertTriangle, Download, Eye, FilterX, PackageSearch, Search, Wrench } from "lucide-react"
import { Pagination, PaginationContent, PaginationItem, PaginationNext, PaginationPrevious } from "@/components/ui/pagination"

export function Chamadas() {
  const { page, setPage, limit } = usePagination(1, 50)
  const [selectedCodigo, setSelectedCodigo] = useState<number | null>(null)
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

  const { data, isLoading } = useListChamadas({
    page,
    limit,
    ...filters
  })

  const { data: options } = useGetFiltrosOpcoes()

  const {
    data: chamadaDetalhe,
    isLoading: isLoadingDetail,
    isError: isDetailError,
  } = useGetChamada(selectedCodigo ?? 0, {
    query: { enabled: selectedCodigo !== null },
  })

  const {
    data: pecasDaChamada,
    isLoading: isLoadingParts,
    isError: isPartsError,
  } = useListPecas(
    {
      chamadaNumero: selectedCodigo ?? undefined,
      page: 1,
      limit: 100,
    },
    {
      query: { enabled: selectedCodigo !== null },
    },
  )

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

  const openDetails = (codigo: number) => setSelectedCodigo(codigo)
  const totalPages = data ? Math.ceil(data.total / limit) : 0
  const pecas = pecasDaChamada?.data ?? []
  const aguardandoPeca = chamadaDetalhe?.situacao_zenthi?.toLocaleLowerCase("pt-BR").includes("aguardando") ?? false

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
                <TableHead className="w-[110px] text-right">Detalhes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={8}><LoadingTable rows={10} /></TableCell></TableRow>
              ) : data?.data.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8}>
                    <EmptyState
                      title="Nenhuma chamada encontrada"
                      description="Tente ajustar os filtros de busca para encontrar o que procura."
                    />
                  </TableCell>
                </TableRow>
              ) : (
                data?.data.map((item) => (
                  <TableRow
                    key={item.codigo}
                    className="group cursor-pointer hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                    tabIndex={0}
                    role="button"
                    aria-label={`Abrir detalhes da OS ${item.codigo}`}
                    onClick={() => openDetails(item.codigo)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault()
                        openDetails(item.codigo)
                      }
                    }}
                  >
                    <TableCell className="font-mono text-xs font-semibold text-primary">#{item.codigo}</TableCell>
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
                    <TableCell className="text-right">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="gap-2"
                        onClick={(event) => {
                          event.stopPropagation()
                          openDetails(item.codigo)
                        }}
                      >
                        <Eye className="h-4 w-4" /> Abrir
                      </Button>
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

      <Dialog open={selectedCodigo !== null} onOpenChange={(open) => !open && setSelectedCodigo(null)}>
        <DialogContent className="max-h-[90vh] max-w-5xl overflow-hidden p-0">
          <DialogHeader className="border-b p-6 pr-12">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <DialogTitle>Detalhes da OS #{selectedCodigo}</DialogTitle>
                <DialogDescription>
                  Problema informado, diagnóstico, equipamento, atendimento e peças vinculadas à chamada.
                </DialogDescription>
              </div>
              {chamadaDetalhe && <StatusBadge status={chamadaDetalhe.situacao_zenthi} />}
            </div>
          </DialogHeader>

          <div className="max-h-[72vh] overflow-y-auto p-6">
            {isLoadingDetail ? (
              <LoadingTable rows={6} />
            ) : isDetailError || !chamadaDetalhe ? (
              <EmptyState
                title="Não foi possível carregar a chamada"
                description="Tente fechar e abrir a OS novamente."
              />
            ) : (
              <div className="space-y-6">
                <section className="rounded-xl border bg-muted/20 p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-amber-600" />
                    <h3 className="font-semibold">Problema da chamada</h3>
                  </div>
                  <div className="grid gap-4 lg:grid-cols-2">
                    <TextBlock label="Defeito informado" value={chamadaDetalhe.defeito_informado} emphasize />
                    <TextBlock label="Defeito verificado" value={chamadaDetalhe.defeito_verificado} />
                    <TextBlock label="Observação da chamada" value={chamadaDetalhe.observacao} />
                    <TextBlock label="Observação do serviço" value={chamadaDetalhe.observacao_servico} />
                  </div>
                </section>

                <section className="rounded-xl border p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <Wrench className="h-5 w-5 text-muted-foreground" />
                    <h3 className="font-semibold">Equipamento e atendimento</h3>
                  </div>
                  <div className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
                    <DetailField label="Cliente" value={chamadaDetalhe.razao_social} />
                    <DetailField label="Cidade" value={chamadaDetalhe.cidade} />
                    <DetailField label="Setor" value={chamadaDetalhe.setor} />
                    <DetailField label="Equipamento" value={[chamadaDetalhe.marca, chamadaDetalhe.modelo].filter(Boolean).join(" ")} />
                    <DetailField label="Número de série" value={chamadaDetalhe.numero_serie} mono />
                    <DetailField label="Tipo" value={chamadaDetalhe.desc_tipo_equipamento} />
                    <DetailField label="Produto da OS" value={chamadaDetalhe.produto_os} />
                    <DetailField label="Técnico" value={chamadaDetalhe.email_tecnico} />
                    <DetailField label="Abertura" value={formatDateTime(chamadaDetalhe.emissao)} mono />
                    <DetailField label="Início do serviço" value={formatDateTime(chamadaDetalhe.data_inicio_servico)} mono />
                    <DetailField label="Encerramento" value={formatDateTime(chamadaDetalhe.encerramento)} mono />
                    <DetailField label="Previsão" value={formatDateTime(chamadaDetalhe.data_prevista)} mono />
                  </div>

                  {(chamadaDetalhe.servico_realizado || chamadaDetalhe.descricao_ocorrencia) && (
                    <div className="mt-4 grid gap-4 lg:grid-cols-2">
                      <TextBlock label="Serviço realizado" value={chamadaDetalhe.servico_realizado} />
                      <TextBlock label="Ocorrência" value={chamadaDetalhe.descricao_ocorrencia} />
                    </div>
                  )}
                </section>

                <section className="rounded-xl border p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <PackageSearch className="h-5 w-5 text-muted-foreground" />
                      <h3 className="font-semibold">Peças da OS</h3>
                    </div>
                    {!isLoadingParts && !isPartsError && (
                      <span className="text-xs text-muted-foreground">{pecas.length} item(ns) encontrado(s)</span>
                    )}
                  </div>

                  {isLoadingParts ? (
                    <LoadingTable rows={3} />
                  ) : isPartsError ? (
                    <p className="text-sm text-destructive">Não foi possível consultar as peças desta OS.</p>
                  ) : pecas.length > 0 ? (
                    <div className="space-y-3">
                      {pecas.map((peca) => (
                        <div key={peca.id_sales_peca} className="rounded-lg border bg-muted/20 p-4">
                          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                            <div>
                              <p className="font-semibold">{peca.desc_produto}</p>
                              <p className="mt-1 text-xs text-muted-foreground">
                                {[peca.desc_marca, peca.modelo_equip].filter(Boolean).join(" · ") || "Sem marca/modelo informado"}
                              </p>
                            </div>
                            <div className="grid grid-cols-2 gap-x-5 gap-y-1 text-xs md:text-right">
                              <span className="text-muted-foreground">Quantidade</span>
                              <strong>{peca.qtdem ?? 0}</strong>
                              <span className="text-muted-foreground">Valor unitário</span>
                              <strong>{formatCurrency(peca.preco_unitario)}</strong>
                              <span className="text-muted-foreground">Valor item</span>
                              <strong>{formatCurrency(peca.valor_item)}</strong>
                            </div>
                          </div>

                          {(peca.defeito_equip || peca.defeito_verificado || peca.servicos_realizar || peca.obs_servicos) && (
                            <div className="mt-3 grid gap-3 border-t pt-3 md:grid-cols-2">
                              <TextBlock label="Defeito na ficha da peça" value={peca.defeito_equip} />
                              <TextBlock label="Defeito verificado" value={peca.defeito_verificado} />
                              <TextBlock label="Serviço a realizar" value={peca.servicos_realizar} />
                              <TextBlock label="Observação" value={peca.obs_servicos} />
                            </div>
                          )}

                          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
                            <span>Movimentou estoque: <strong className="text-foreground">{peca.movimentou_estoque || "Não informado"}</strong></span>
                            <span>Garantia: <strong className="text-foreground">{peca.garantia || "Não informada"}</strong></span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-lg border border-dashed p-4">
                      <p className="text-sm font-medium">Nenhuma peça vinculada à OS foi encontrada.</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {aguardandoPeca
                          ? "A chamada está como Aguardando Peça, mas ainda não há item lançado na base de peças. Confira as observações e o defeito acima; a peça também pode ainda não ter sido registrada no Zenthi."
                          : "Esta chamada não possui peça registrada na base de peças."}
                      </p>
                    </div>
                  )}
                </section>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function DetailField({
  label,
  value,
  mono = false,
}: {
  label: string
  value: string | number | null | undefined
  mono?: boolean
}) {
  const displayValue = value === null || value === undefined || value === "" ? "Não informado" : String(value)

  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className={mono ? "mt-1 font-mono text-xs" : "mt-1 font-medium"}>{displayValue}</p>
    </div>
  )
}

function TextBlock({
  label,
  value,
  emphasize = false,
}: {
  label: string
  value: string | null | undefined
  emphasize?: boolean
}) {
  return (
    <div className={emphasize ? "rounded-lg border border-amber-200 bg-amber-50/60 p-3 dark:border-amber-900 dark:bg-amber-950/20" : "rounded-lg bg-muted/40 p-3"}>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 whitespace-pre-wrap text-sm">{value?.trim() || "Não informado"}</p>
    </div>
  )
}
