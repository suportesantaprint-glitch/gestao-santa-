import { Loader2 } from "lucide-react"

export function SkeletonRow() {
  return (
    <div className="flex h-10 w-full animate-pulse items-center rounded-md bg-muted/50" />
  )
}

export function LoadingTable({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonRow key={i} />
      ))}
    </div>
  )
}

export function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center">
      <div className="mb-4 rounded-full bg-muted/50 p-4">
        <Loader2 className="h-8 w-8 text-muted-foreground opacity-50" />
      </div>
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="text-sm text-muted-foreground mt-2 max-w-sm">
        {description}
      </p>
    </div>
  )
}
