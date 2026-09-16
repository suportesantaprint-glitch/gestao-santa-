import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useFilters } from "@/hooks/use-filters"
import { Download, FileSpreadsheet, PackageOpen } from "lucide-react"

export function Relatorios() {
  const { filters, setFilter } = useFilters({
    dataInicio: "",
    dataFim: ""
  })

  const handleExportChamadas = () => {
    const params = new URLSearchParams()
    if (filters.dataInicio) params.append("dataInicio", filters.dataInicio)
    if (filters.dataFim) params.append("dataFim", filters.dataFim)
    window.open('/api/chamadas/exportar?' + params.toString())
  }

  const handleExportPecas = () => {
    const params = new URLSearchParams()
    if (filters.dataInicio) params.append("dataInicio", filters.dataInicio)
    if (filters.dataFim) params.append("dataFim", filters.dataFim)
    window.open('/api/pecas/exportar?' + params.toString())
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Relatórios Gerenciais</h1>
        <p className="text-muted-foreground text-sm">Exporte dados operacionais consolidados.</p>
      </div>

      <Card className="shadow-sm">
        <CardHeader className="border-b bg-muted/20 pb-4">
          <CardTitle className="text-lg">Período de Análise</CardTitle>
          <CardDescription>Defina o intervalo de datas base para todas as exportações.</CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row gap-6 max-w-md">
            <div className="space-y-2 flex-1">
              <Label>Data Inicial</Label>
              <Input 
                type="date" 
                value={filters.dataInicio} 
                onChange={(e) => setFilter("dataInicio", e.target.value)} 
              />
            </div>
            <div className="space-y-2 flex-1">
              <Label>Data Final</Label>
              <Input 
                type="date" 
                value={filters.dataFim} 
                onChange={(e) => setFilter("dataFim", e.target.value)} 
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid sm:grid-cols-2 gap-6">
        <Card className="shadow-sm hover:border-primary/50 transition-colors">
          <CardHeader>
            <div className="h-10 w-10 bg-primary/10 rounded-lg flex items-center justify-center mb-2">
              <FileSpreadsheet className="h-5 w-5 text-primary" />
            </div>
            <CardTitle className="text-lg">Chamadas de Serviço</CardTitle>
            <CardDescription>Extração completa do painel de chamadas no período selecionado.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={handleExportChamadas} className="w-full gap-2">
              <Download className="h-4 w-4" /> Baixar Excel
            </Button>
          </CardContent>
        </Card>

        <Card className="shadow-sm hover:border-primary/50 transition-colors">
          <CardHeader>
            <div className="h-10 w-10 bg-primary/10 rounded-lg flex items-center justify-center mb-2">
              <PackageOpen className="h-5 w-5 text-primary" />
            </div>
            <CardTitle className="text-lg">Consumo de Peças</CardTitle>
            <CardDescription>Listagem de produtos aplicados nas ordens de serviço do período.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={handleExportPecas} className="w-full gap-2">
              <Download className="h-4 w-4" /> Baixar Excel
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
