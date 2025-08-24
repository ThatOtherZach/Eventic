import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/use-auth";
import { ProtectedRoute } from "@/lib/protected-route";
import { Navigation } from "@/components/layout/navigation";
import Events from "@/pages/events";
import EventDetail from "@/pages/event-detail";
import EventEdit from "@/pages/event-edit";
import Scanner from "@/pages/scanner";
import AuthPage from "@/pages/auth-page";
import AccountPage from "@/pages/account-page";
import TicketViewPage from "@/pages/ticket-view";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Events} />
      <Route path="/events" component={Events} />
      <Route path="/events/:id" component={EventDetail} />
      <ProtectedRoute path="/events/:id/edit" component={EventEdit} />
      <Route path="/scanner" component={Scanner} />
      <ProtectedRoute path="/account" component={AccountPage} />
      <ProtectedRoute path="/tickets/:ticketId" component={TicketViewPage} />
      <Route path="/auth" component={AuthPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <div className="min-vh-100 bg-light">
            <Navigation />
            <main className="container-fluid px-3 px-md-4 py-4">
              <div className="row justify-content-center">
                <div className="col-12 col-xl-10">
                  <Router />
                </div>
              </div>
            </main>
          </div>
          <Toaster />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;