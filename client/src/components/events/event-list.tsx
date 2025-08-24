import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Link } from "wouter";
import { Eye, Ticket, Edit, ShoppingCart } from "lucide-react";
import type { Event } from "@shared/schema";

interface EventListProps {
  onGenerateTickets: (event: Event) => void;
}

export function EventList({ onGenerateTickets }: EventListProps) {
  const { user } = useAuth();
  const { data: events, isLoading } = useQuery<Event[]>({
    queryKey: ["/api/events"],
  });

  if (isLoading) {
    return (
      <div className="card">
        <div className="card-body">
          <div className="placeholder-glow">
            {[1, 2, 3].map((i) => (
              <div key={i} className="d-flex align-items-center mb-4">
                <div className="placeholder rounded me-3" style={{width: '48px', height: '48px'}}></div>
                <div className="flex-grow-1">
                  <div className="placeholder col-6 mb-2"></div>
                  <div className="placeholder col-4"></div>
                </div>
                <div className="d-flex gap-2">
                  <div className="placeholder rounded" style={{width: '32px', height: '32px'}}></div>
                  <div className="placeholder rounded" style={{width: '32px', height: '32px'}}></div>
                  <div className="placeholder rounded" style={{width: '32px', height: '32px'}}></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!events?.length) {
    return (
      <div className="card">
        <div className="card-body text-center py-5">
          <div className="text-muted">
            <Ticket className="mx-auto mb-3 opacity-50" size={48} />
            <h5 className="fw-medium mb-2">No events yet</h5>
            <p className="small mb-0">
              {user 
                ? "Create your first event to get started" 
                : "Sign in to create events"}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="card-header bg-white">
        <h5 className="card-title mb-0 fw-medium">Available Events</h5>
      </div>
      <div className="card-body p-0">
        {events.map((event, index) => (
          <div 
            key={event.id} 
            className={`p-3 ${index !== events.length - 1 ? 'border-bottom' : ''}`}
            data-testid={`card-event-${event.id}`}
          >
            <div className="row align-items-center">
              <div className="col-12 col-md-6">
                <div className="d-flex align-items-center">
                  {event.imageUrl ? (
                    <img 
                      src={event.imageUrl} 
                      alt={event.name}
                      className="rounded me-3"
                      style={{ width: '48px', height: '48px', objectFit: 'cover' }}
                    />
                  ) : (
                    <div className="bg-primary bg-opacity-10 rounded p-2 me-3">
                      <Ticket className="text-primary" size={24} />
                    </div>
                  )}
                  <div>
                    <h6 className="mb-1 fw-semibold">{event.name}</h6>
                    <p className="text-muted small mb-0">
                      {event.date} • {event.time}
                    </p>
                    <p className="text-muted small mb-0">{event.venue}</p>
                  </div>
                </div>
              </div>
              
              <div className="col-12 col-md-6">
                <div className="d-flex justify-content-md-end align-items-center mt-3 mt-md-0">
                  <div className="text-md-end me-3">
                    <p className="mb-0 fw-semibold">{parseFloat(event.ticketPrice) === 0 ? 'Free Entry' : `$${event.ticketPrice}`}</p>
                    {parseFloat(event.ticketPrice) !== 0 && <p className="text-muted small mb-0">per ticket</p>}
                  </div>
                  <div className="btn-group" role="group">
                    <Link 
                      href={`/events/${event.id}`}
                      className="btn btn-sm btn-outline-secondary"
                      title="View Event"
                      data-testid={`button-view-${event.id}`}
                    >
                      <Eye size={16} />
                    </Link>
                    <Link
                      href={`/events/${event.id}`}
                      className="btn btn-sm btn-outline-primary"
                      title="Buy Tickets"
                      data-testid={`button-buy-tickets-${event.id}`}
                    >
                      <ShoppingCart size={16} />
                    </Link>
                    {user && event.userId === user.id && (
                      <Link
                        href={`/events/${event.id}/edit`}
                        className="btn btn-sm btn-outline-secondary"
                        title="Edit Event"
                        data-testid={`button-edit-${event.id}`}
                      >
                        <Edit size={16} />
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}