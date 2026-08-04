import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Route, Switch, Router as WouterRouter } from 'wouter';
import { Shell } from '@/components/layout/Shell';

import { Dashboard } from '@/pages/Dashboard';
import { Chamadas } from '@/pages/Chamadas';
import { Pecas } from '@/pages/Pecas';
import { MaquinasClientes } from '@/pages/MaquinasClientes';
import { Tecnicos } from '@/pages/Tecnicos';
import { Relatorios } from '@/pages/Relatorios';

function NotFound() {
  return (
    <div className="min-h-[80vh] w-full flex flex-col items-center justify-center gap-2">
      <h1 className="text-4xl font-bold text-foreground">404</h1>
      <p className="text-muted-foreground">Página não encontrada.</p>
    </div>
  );
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 5 * 60 * 1000,
    },
  },
});

function Router() {
  return (
    <Shell>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/chamadas" component={Chamadas} />
        <Route path="/pecas" component={Pecas} />
        <Route path="/maquinas" component={MaquinasClientes} />
        <Route path="/tecnicos" component={Tecnicos} />
        <Route path="/pedidos" component={MaquinasClientes} />
        <Route path="/contratos" component={Tecnicos} />
        <Route path="/relatorios" component={Relatorios} />
        <Route component={NotFound} />
      </Switch>
    </Shell>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
