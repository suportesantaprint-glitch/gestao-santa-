import { Badge } from "@/components/ui/badge"

interface StatusBadgeProps {
  status: string
}

export function StatusBadge({ status }: StatusBadgeProps) {
  let colorClass = "bg-muted text-muted-foreground"
  
  const s = status?.toLowerCase() || ""
  
  if (s === "em análise" || s === "em analise") {
    colorClass = "bg-status-analise/15 text-status-analise border-status-analise/30"
  } else if (s === "concluído" || s === "concluido") {
    colorClass = "bg-status-concluido/15 text-status-concluido border-status-concluido/30"
  } else if (s === "cancelado") {
    colorClass = "bg-status-cancelado/15 text-status-cancelado border-status-cancelado/30"
  } else if (s === "aguardando peça" || s === "aguardando peca") {
    colorClass = "bg-status-aguardando/15 text-status-aguardando border-status-aguardando/30"
  } else if (s === "para conserto") {
    colorClass = "bg-status-conserto/15 text-status-conserto border-status-conserto/30"
  }

  return (
    <Badge variant="outline" className={`font-semibold border ${colorClass}`}>
      {status || "Desconhecido"}
    </Badge>
  )
}
