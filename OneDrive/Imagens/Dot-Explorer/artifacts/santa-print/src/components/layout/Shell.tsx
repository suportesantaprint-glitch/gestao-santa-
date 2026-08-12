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
  ShoppingCart,
  FileText,
  Menu,
  X,
} from "lucide-react"

const SANTA_PRINT_LOGO_URL = "https://santaprint.com.br/wp-content/uploads/logo-santaprint-svg-0.svg"

const navItems = [
  { href: "/", label: "Início", description: "Resumo do que precisa de atenção", icon: LayoutDashboard },
  { href: "/chamadas", label: "Chamadas", description: "Acompanhar atendimentos e OS", icon: Wrench },
  { href: "/pecas", label: "Peças", description: "Consultar peças e estoque", icon: Package },
  { href: "/ciclo-vida-pecas", label: "Movimentação de Peças", description: "Ver onde cada peça está", icon: GitBranch },
  { href: "/maquinas", label: "Máquinas por Cliente", description: "Consultar equipamentos instalados", icon: Building2 },
  { href: "/tecnicos", label: "Técnicos", description: "Ver equipe e atendimentos", icon: UsersRound },
  { href: "/pedidos", label: "Pedidos", description: "Consultar vendas e pedidos", icon: ShoppingCart },
  { href: "/contratos", label: "Contratos", description: "Consultar contratos de locação", icon: FileText },
  { href: "/relatorios", label: "Relatórios", description: "Analisar resultados da operação", icon: BarChart3 },
]

function SantaPrintBrand({ subtitle }: { subtitle: string }) {
  const [logoFailed, setLogoFailed] = React.useState(false)

  return (
    <div className="flex min-w-0 items-center gap-3">
      {logoFailed ? (
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary text-xs font-bold text-primary-foreground">
          SP
        </div>
      ) : (
        <div className="flex h-10 max-w-[150px] shrink-0 items-center">
          <img
            src={SANTA_PRINT_LOGO_URL}
            alt="Santa Print"
            className="max-h-10 w-auto max-w-[150px] object-contain"
            decoding="async"
            onError={() => setLogoFailed(true)}
          />
        </div>
      )}

      <div className="min-w-0 leading-tight">
        {logoFailed && <span className="block font-bold text-sidebar-primary-foreground">Santa Print</span>}
        <span className="block truncate text-[10px] font-normal uppercase tracking-wider text-sidebar-foreground/50">
          {subtitle}
        </span>
      </div>
    </div>
  )
}

function Navigation({ onNavigate }: { onNavigate?: () => void }) {
  const [location] = useLocation()

  return (
    <nav className="grid gap-1 px-3 text-sm font-medium">
      {navItems.map((item) => {
        const Icon = item.icon
        const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href))

        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              "flex items-start gap-3 rounded-lg px-3 py-3 transition-all",
              isActive
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground/75 hover:bg-sidebar-accent/50 hover:text-sidebar-primary-foreground",
            )}
          >
            <Icon className="mt-0.5 h-4 w-4 shrink-0" />
            <span className="min-w-0">
              <span className="block font-semibold leading-5">{item.label}</span>
              <span className="block text-[11px] leading-4 opacity-70">{item.description}</span>
            </span>
          </Link>
        )
      })}
    </nav>
  )
}

export function Shell({ children }: { children: React.ReactNode }) {
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false)

  return (
    <div className="flex min-h-screen w-full bg-muted/40">
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-72 flex-col border-r bg-sidebar md:flex">
        <div className="flex h-16 items-center border-b border-sidebar-border px-6">
          <SantaPrintBrand subtitle="Gestão Operacional" />
        </div>

        <div className="border-b border-sidebar-border px-5 py-4">
          <p className="text-xs font-semibold text-sidebar-primary-foreground">O que você precisa fazer?</p>
          <p className="mt-1 text-[11px] leading-4 text-sidebar-foreground/60">
            Escolha uma opção abaixo. Cada área mostra apenas o necessário para aquela tarefa.
          </p>
        </div>

        <div className="flex-1 overflow-auto py-3">
          <Navigation />
        </div>

        <div className="mt-auto border-t border-sidebar-border p-4">
          <div className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-sidebar-foreground/70">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-sidebar-accent text-xs font-semibold text-sidebar-accent-foreground">
              OP
            </div>
            <div className="flex flex-col">
              <span className="font-medium text-sidebar-primary-foreground">Operações</span>
              <span className="text-[10px] uppercase tracking-wider text-sidebar-foreground/50">Sistema online</span>
            </div>
          </div>
        </div>
      </aside>

      {mobileMenuOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 md:hidden" onClick={() => setMobileMenuOpen(false)}>
          <aside
            className="h-full w-[88%] max-w-sm overflow-auto border-r bg-sidebar pb-6 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex h-16 items-center justify-between border-b border-sidebar-border px-5">
              <SantaPrintBrand subtitle="Menu" />
              <button
                type="button"
                aria-label="Fechar menu"
                className="rounded-md p-2 text-sidebar-foreground hover:bg-sidebar-accent"
                onClick={() => setMobileMenuOpen(false)}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="px-5 py-4">
              <p className="text-xs font-semibold text-sidebar-primary-foreground">Escolha o que você quer consultar</p>
              <p className="mt-1 text-[11px] leading-4 text-sidebar-foreground/60">Toque em uma opção para abrir a tela correspondente.</p>
            </div>
            <Navigation onNavigate={() => setMobileMenuOpen(false)} />
          </aside>
        </div>
      )}

      <div className="flex flex-1 flex-col md:pl-72">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-background px-4 md:hidden">
          <SantaPrintBrand subtitle="Gestão Operacional" />
          <button
            type="button"
            aria-label="Abrir menu"
            className="rounded-md border p-2 hover:bg-muted"
            onClick={() => setMobileMenuOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </button>
        </header>

        <main className="flex-1 p-4 sm:p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
