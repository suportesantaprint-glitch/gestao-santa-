import * as React from "react"
import { Link, useLocation } from "wouter"
import { cn } from "@/lib/utils"
import {
  LayoutDashboard,
  Wrench,
  Package,
  GitBranch,
  Building2,
  UsersRound,
  BarChart3,
} from "lucide-react"

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/chamadas", label: "Chamadas", icon: Wrench },
  { href: "/pecas", label: "Peças", icon: Package },
  { href: "/ciclo-vida-pecas", label: "Ciclo de Vida", icon: GitBranch },
  { href: "/maquinas", label: "Máquinas por Cliente", icon: Building2 },
  { href: "/tecnicos", label: "Técnicos", icon: UsersRound },
  { href: "/relatorios", label: "Relatórios", icon: BarChart3 },
]

export function Shell({ children }: { children: React.ReactNode }) {
  const [location] = useLocation()

  return (
    <div className="flex min-h-screen w-full bg-muted/40">
      <aside className="fixed inset-y-0 left-0 z-10 hidden w-64 flex-col border-r bg-sidebar md:flex">
        <div className="flex h-14 items-center border-b border-sidebar-border px-6">
          <div className="flex items-center gap-2 font-bold text-sidebar-primary-foreground">
            <div className="flex h-6 w-6 items-center justify-center rounded bg-sidebar-primary text-[10px] text-primary-foreground">
              SP
            </div>
            <span>Santa Print</span>
          </div>
        </div>
        <div className="flex-1 overflow-auto py-4">
          <nav className="grid gap-1 px-4 text-sm font-medium">
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href))

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2.5 transition-all hover:text-sidebar-primary-foreground",
                    isActive
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              )
            })}
          </nav>
        </div>
        <div className="mt-auto border-t border-sidebar-border p-4">
          <div className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-sidebar-foreground/70">
            <div className="h-8 w-8 rounded-full bg-sidebar-accent flex items-center justify-center font-semibold text-xs text-sidebar-accent-foreground">
              OP
            </div>
            <div className="flex flex-col">
              <span className="font-medium text-sidebar-primary-foreground">Operações</span>
              <span className="text-[10px] uppercase tracking-wider text-sidebar-foreground/50">Online</span>
            </div>
          </div>
        </div>
      </aside>

      <div className="flex flex-col md:pl-64 flex-1">
        <header className="sticky top-0 z-10 flex h-14 items-center gap-4 border-b bg-background px-6 md:hidden">
          <div className="flex items-center gap-2 font-bold">
            <div className="flex h-6 w-6 items-center justify-center rounded bg-primary text-[10px] text-primary-foreground">
              SP
            </div>
            <span>Santa Print</span>
          </div>
        </header>

        <main className="flex-1 p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
