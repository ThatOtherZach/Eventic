import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Link, useLocation } from "wouter";
import { Eye, Ticket, Edit, ShoppingCart, ChevronLeft, ChevronRight } from "lucide-react";
import type { Event } from "@shared/schema";

interface EventListProps {
  onGenerateTickets: (event: Event) => void;
}

interface PaginatedEventsResponse {
  events: Event[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export function EventList({ onGenerateTickets }: EventListProps) {
  const { user } = useAuth();
  const [currentPage, setCurrentPage] = useState(1);
  const [, setLocation] = useLocation();
  
  // Get first 50 events for initial page
  const { data: initialEvents, isLoading: isLoadingInitial } = useQuery<Event[]>({
    queryKey: ["/api/events"],
  });

  // Get paginated events for subsequent pages
  const { data: paginatedData, isLoading: isLoadingPaginated } = useQuery<PaginatedEventsResponse>({
    queryKey: ["/api/events-paginated", currentPage],
    enabled: currentPage > 1, // Only fetch paginated data for pages after the first
  });

  // Get featured events to filter them out for lucky button
  const { data: featuredEvents } = useQuery<any[]>({
    queryKey: ["/api/featured-events"],
  });

  // Use initial events for page 1, paginated events for other pages
  const events = currentPage === 1 ? initialEvents?.slice(0, 50) : paginatedData?.events;
  const isLoading = currentPage === 1 ? isLoadingInitial : isLoadingPaginated;
  
  // Calculate pagination info
  const totalEvents = currentPage === 1 ? (initialEvents?.length || 0) : (paginatedData?.pagination.total || 0);
  const eventsPerPage = currentPage === 1 ? 50 : 25;
  const totalPages = Math.ceil(totalEvents / (currentPage === 1 ? 50 : 25));
  const hasNext = currentPage < totalPages;
  const hasPrev = currentPage > 1;

  const handleFeelinLucky = () => {
    if (!events || events.length === 0) return;
    
    // Get IDs of featured events to exclude them
    const featuredEventIds = new Set(
      (featuredEvents || []).map((fe: any) => fe.eventId || fe.event?.id).filter(Boolean)
    );
    
    // Filter out featured events
    let candidateEvents = events.filter(event => !featuredEventIds.has(event.id));
    
    // Smart location filtering based on user's locations
    if ((user as any)?.locations && candidateEvents.length > 1) {
      const userLocations = (user as any).locations.toLowerCase();
      const locationPreferredEvents = candidateEvents.filter(event => {
        const eventVenue = (event.venue || '').toLowerCase();
        const eventCountry = ((event as any).country || '').toLowerCase();
        return userLocations.includes(eventCountry) || 
               userLocations.includes(eventVenue) ||
               userLocations.split(',').some((loc: string) => 
                 eventVenue.includes(loc.trim()) || eventCountry.includes(loc.trim())
               );
      });
      
      // If we found location-matched events, prefer them
      if (locationPreferredEvents.length > 0) {
        candidateEvents = locationPreferredEvents;
      }
    }
    
    if (candidateEvents.length === 0) {
      // If all events are featured, just pick from all events
      const randomEvent = events[Math.floor(Math.random() * events.length)];
      setLocation(`/events/${randomEvent.id}`);
    } else {
      // Pick a random event from candidates
      const randomEvent = candidateEvents[Math.floor(Math.random() * candidateEvents.length)];
      setLocation(`/events/${randomEvent.id}`);
    }
  };

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
        <div className="d-flex justify-content-between align-items-center">
          <h5 className="card-title mb-0 fw-medium">Available Events</h5>
          <button 
            className="btn btn-outline-primary btn-sm"
            onClick={handleFeelinLucky}
            data-testid="button-feelin-lucky"
          >
            I'm feelin' lucky
          </button>
        </div>
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
                    <div className="d-flex align-items-center">
                      <h6 className="mb-1 fw-semibold me-2">{event.name}</h6>
                      {(event as any).country && (
                        <span className="badge bg-info text-white" style={{ fontSize: "0.7em" }}>
                          {(event as any).country}
                        </span>
                      )}
                    </div>
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
      
      {/* Pagination Controls */}
      {(hasNext || hasPrev) && (
        <div className="card-footer bg-white border-top-0">
          <div className="d-flex justify-content-between align-items-center">
            <div className="text-muted small">
              Showing {events?.length || 0} of {totalEvents} events
              {currentPage === 1 && totalEvents > 50 && (
                <span className="ms-2 text-primary">(Showing newest 50 events)</span>
              )}
            </div>
            <div className="d-flex gap-2">
              <button
                className="btn btn-outline-secondary btn-sm"
                onClick={() => setCurrentPage(currentPage - 1)}
                disabled={!hasPrev || isLoading}
                data-testid="button-prev-page"
              >
                <ChevronLeft size={16} />
                Previous
              </button>
              <span className="align-self-center mx-2 small text-muted">
                Page {currentPage} of {totalPages}
              </span>
              <button
                className="btn btn-outline-secondary btn-sm"
                onClick={() => setCurrentPage(currentPage + 1)}
                disabled={!hasNext || isLoading}
                data-testid="button-next-page"
              >
                Next
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}