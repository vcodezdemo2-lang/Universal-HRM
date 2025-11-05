import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import { useWebSocket } from "@/hooks/useWebSocket";
import Landing from "@/pages/landing";
import Login from "@/pages/login";
import Dashboard from "@/pages/dashboard";
import Leads from "@/pages/leads";
import MyLeads from "@/pages/my-leads";
import MyCompletion from "@/pages/my-completion";
import Users from "@/pages/users";
import Reports from "@/pages/reports";
import Audit from "@/pages/audit";
import NotFound from "@/pages/not-found";

function Router() {
  const { isAuthenticated, isLoading } = useAuth();
  
  // Always call useWebSocket hook to avoid hooks ordering issues
  const { connectionStatus } = useWebSocket();
  
  // Log WebSocket status for debugging
  console.log('WebSocket status:', connectionStatus, 'Authenticated:', isAuthenticated);

  return (
    <Switch>
      {/* Login page accessible to all */}
      <Route path="/login" component={Login} />
      
      {isLoading || !isAuthenticated ? (
        <Route path="/" component={Landing} />
      ) : (
        <>
          <Route path="/" component={Dashboard} />
          <Route path="/leads" component={Leads} />
          <Route path="/my-leads" component={MyLeads} />
          <Route path="/my-completion" component={MyCompletion} />
          <Route path="/users" component={Users} />
          <Route path="/reports" component={Reports} />
          <Route path="/audit" component={Audit} />
        </>
      )}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
