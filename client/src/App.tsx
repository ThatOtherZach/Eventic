import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/use-auth";
import { ProtectedRoute } from "@/lib/protected-route";
import { Navigation } from "@/components/layout/navigation";
import { ErrorBoundary } from "@/components/error-boundary";
import Events from "@/pages/events";
import EventDetail from "@/pages/event-detail";
import EventForm from "@/pages/event-form";
import Scanner from "@/pages/scanner";
import AuthPage from "@/pages/auth-page";
import AccountPage from "@/pages/account-page";
import NotificationsPage from "@/pages/notifications-page";
import TicketViewPage from "@/pages/ticket-view";
import SpecialEffectsPage from "@/pages/special-effects";
import MonitoringPage from "@/pages/monitoring";
import AdminSettings from "@/pages/admin-settings";
import { LocationEventsPage } from "@/pages/location-events";
import { HashtagEventsPage } from "@/pages/hashtag-events";
import { FeaturedEventsPage } from "@/pages/featured-events";
import { EventTypePage } from "@/pages/event-type";
import Manifesto from "@/pages/manifesto";
import NerdStats from "@/pages/nerd-stats";
import { RegistryPage } from "@/pages/registry-page";
import { RegistryTicketPage } from "@/pages/registry-ticket-page";
import NotFound from "@/pages/not-found";
import HuntRedirect from "@/pages/hunt-redirect";
import { ScrollToTop } from "@/components/scroll-to-top";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Events} />
      <Route path="/events" component={Events} />
      <ProtectedRoute path="/events/create" component={EventForm} />
      <Route path="/events/:id" component={EventDetail} />
      <Route path="/e/:shortcode" component={EventDetail} />
      <Route path="/hunt/:huntCode" component={HuntRedirect} />
      <ProtectedRoute path="/events/:id/edit" component={EventForm} />
      <Route path="/scanner" component={Scanner} />
      <ProtectedRoute path="/account" component={AccountPage} />
      <ProtectedRoute path="/notifications" component={NotificationsPage} />
      <ProtectedRoute path="/monitoring" component={MonitoringPage} />
      <ProtectedRoute path="/admin" component={AdminSettings} />
      <Route path="/tickets/:ticketId" component={TicketViewPage} />
      <Route path="/special-effects" component={SpecialEffectsPage} />
      <Route path="/featured" component={FeaturedEventsPage} />
      <Route path="/manifesto" component={Manifesto} />
      <Route path="/sys/nerd" component={NerdStats} />
      <Route path="/registry" component={RegistryPage} />
      <Route path="/registry/:id" component={RegistryTicketPage} />
      <Route path="/auth" component={AuthPage} />
      <Route path="/hashtag/:hashtag">{(params) => <HashtagEventsPage />}</Route>
      <Route path="/type/:type">{(params) => <EventTypePage />}</Route>
      <Route path="/venue/:value">{(params) => <LocationEventsPage />}</Route>
      <Route path="/city/:value">{(params) => <LocationEventsPage />}</Route>
      <Route path="/country/:value">{(params) => <LocationEventsPage />}</Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <TooltipProvider>
            <ScrollToTop />
            <div className="min-vh-100 bg-light d-flex flex-column">
              <Navigation />
              <main id="main-content" className="container-fluid px-3 px-md-4 py-4 flex-grow-1" role="main">
                <div className="row justify-content-center">
                  <div className="col-12 col-xl-10">
                    <Router />
                  </div>
                </div>
              </main>
              <footer className="text-center py-3 mt-auto">
                <small className="text-muted">
                  <a href="https://github.com/ThatOtherZach/Eventic" target="_blank" rel="noopener noreferrer" className="link-primary">
                    Eventic Core
                  </a>
                  {" by "}
                  <a href="https://www.saymservices.com/eventic-core" target="_blank" rel="noopener noreferrer" style={{ color: '#ff7300' }}>
                    Saym Services
                  </a>
                </small>
              </footer>
            </div>
            <Toaster />
          </TooltipProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;