import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Calendar, Ticket, User, LogOut } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import type { Ticket as TicketType, Event } from "@shared/schema";

export default function AccountPage() {
  const { user, signOut } = useAuth();
  
  const { data: tickets, isLoading: ticketsLoading } = useQuery<(TicketType & { event: Event })[]>({
    queryKey: ["/api/user/tickets"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/user/tickets");
      return response.json();
    },
    enabled: !!user,
  });

  const { data: events, isLoading: eventsLoading } = useQuery<Event[]>({
    queryKey: ["/api/user/events"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/user/events");
      return response.json();
    },
    enabled: !!user,
  });

  const handleSignOut = async () => {
    await signOut();
  };

  if (!user) {
    return null;
  }

  return (
    <div className="container py-5">
      <div className="row mb-4">
        <div className="col">
          <div className="d-flex justify-content-between align-items-center">
            <h1 className="h3 fw-bold mb-0">My Account</h1>
            <button 
              className="btn btn-outline-secondary"
              onClick={handleSignOut}
              data-testid="button-sign-out"
            >
              <LogOut size={18} className="me-2" />
              Sign Out
            </button>
          </div>
        </div>
      </div>

      {/* User Info Card */}
      <div className="row mb-4">
        <div className="col-12">
          <div className="card">
            <div className="card-body">
              <div className="d-flex align-items-center">
                <div className="bg-primary bg-opacity-10 rounded-circle p-3 me-3">
                  <User className="text-primary" size={24} />
                </div>
                <div>
                  <h5 className="card-title mb-1">Account Details</h5>
                  <p className="text-muted mb-0">{user.email}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* My Tickets Section */}
      <div className="row mb-4">
        <div className="col-12">
          <h4 className="h5 fw-semibold mb-3">
            <Ticket className="me-2" size={20} />
            My Tickets
          </h4>
          
          {ticketsLoading ? (
            <div className="card">
              <div className="card-body">
                <div className="placeholder-glow">
                  <div className="placeholder col-12 mb-2"></div>
                  <div className="placeholder col-8"></div>
                </div>
              </div>
            </div>
          ) : tickets?.length === 0 ? (
            <div className="card">
              <div className="card-body text-center py-5">
                <Ticket className="text-muted mb-3 mx-auto" size={48} />
                <h6 className="text-muted">No tickets yet</h6>
                <p className="text-muted small">Tickets you purchase will appear here</p>
              </div>
            </div>
          ) : (
            <div className="row g-3">
              {tickets?.map((ticket) => (
                <div key={ticket.id} className="col-12 col-md-6 col-lg-4">
                  <div className="card h-100">
                    <div className="card-body">
                      <h6 className="card-title fw-semibold">{ticket.event.name}</h6>
                      <p className="text-muted small mb-2">
                        <Calendar size={14} className="me-1" />
                        {ticket.event.date} at {ticket.event.time}
                      </p>
                      <p className="text-muted small mb-2">
                        📍 {ticket.event.venue}
                      </p>
                      <div className="d-flex justify-content-between align-items-center">
                        <span className="badge bg-primary">
                          {ticket.ticketNumber}
                        </span>
                        {ticket.isValidated && (
                          <span className="badge bg-success">Used</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* My Events Section */}
      <div className="row">
        <div className="col-12">
          <h4 className="h5 fw-semibold mb-3">
            <Calendar className="me-2" size={20} />
            My Events
          </h4>
          
          {eventsLoading ? (
            <div className="card">
              <div className="card-body">
                <div className="placeholder-glow">
                  <div className="placeholder col-12 mb-2"></div>
                  <div className="placeholder col-8"></div>
                </div>
              </div>
            </div>
          ) : events?.length === 0 ? (
            <div className="card">
              <div className="card-body text-center py-5">
                <Calendar className="text-muted mb-3 mx-auto" size={48} />
                <h6 className="text-muted">No events created</h6>
                <p className="text-muted small">Events you create will appear here</p>
              </div>
            </div>
          ) : (
            <div className="card">
              <div className="card-body p-0">
                {events?.map((event, index) => (
                  <div 
                    key={event.id}
                    className={`p-3 ${index !== events.length - 1 ? 'border-bottom' : ''}`}
                  >
                    <div className="d-flex justify-content-between align-items-center">
                      <div>
                        <h6 className="mb-1">{event.name}</h6>
                        <p className="text-muted small mb-0">
                          {event.date} • {event.time} • {event.venue}
                        </p>
                      </div>
                      <div className="text-end">
                        <p className="mb-0 fw-semibold">${event.ticketPrice}</p>
                        <p className="text-muted small mb-0">per ticket</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}