import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Link, useLocation } from "wouter";
import { Eye, Ticket, Edit, ShoppingCart, ChevronLeft, ChevronRight, Plus, Shield } from "lucide-react";
import { countries } from "@/lib/countries";
import { getCountryFlag } from "@/lib/country-flags";
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
  const [selectedCountry, setSelectedCountry] = useState("All Countries");
  
  // Get display text for selected country (only flag/globe)
  const getSelectedDisplay = () => {
    if (selectedCountry === "All Countries") {
      return "🌐";
    }
    return getCountryFlag(selectedCountry) || "🌐";
  };
  
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
  const allEvents = currentPage === 1 ? initialEvents?.slice(0, 50) : paginatedData?.events;
  const isLoading = currentPage === 1 ? isLoadingInitial : isLoadingPaginated;
  
  // Filter events by selected country
  const events = allEvents?.filter(event => {
    if (selectedCountry === "All Countries") return true;
    if (!event.venue) return false;
    
    // Extract country from venue string (last part after comma)
    const venueParts = event.venue.split(',').map(part => part.trim());
    const eventCountry = venueParts[venueParts.length - 1];
    return eventCountry === selectedCountry;
  });
  
  // Calculate pagination info based on filtered events
  const totalFilteredEvents = events?.length || 0;
  const eventsPerPage = currentPage === 1 ? 50 : 25;
  const totalPages = Math.ceil(totalFilteredEvents / eventsPerPage);
  const hasNext = currentPage < totalPages;
  const hasPrev = currentPage > 1;

  const handleFeelinLucky = () => {
    if (!events || events.length === 0) {
      // No events in selected country - prompt to create one
      setLocation('/create-event');
      return;
    }
    
    // Get IDs of featured events to exclude them
    const featuredEventIds = new Set(
      (featuredEvents || []).map((fe: any) => fe.eventId || fe.event?.id).filter(Boolean)
    );
    
    // Filter out featured events from country-filtered events
    let candidateEvents = events.filter(event => !featuredEventIds.has(event.id));
    
    if (candidateEvents.length === 0) {
      // If all events in this country are featured, just pick from all events in country
      const randomEvent = events[Math.floor(Math.random() * events.length)];
      setLocation(`/events/${randomEvent.id}`);
    } else {
      // Pick a random event from candidates in the selected country
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
        <div className="card-header bg-white">
          <div className="d-flex justify-content-between align-items-center">
            <h5 className="card-title mb-0 fw-medium">Available Events</h5>
            <div className="d-flex gap-2 align-items-center">
              <select
                value={selectedCountry}
                onChange={(e) => {
                  setSelectedCountry(e.target.value);
                  setCurrentPage(1); // Reset to first page when filter changes
                }}
                className="form-select form-select-sm"
                style={{ 
                  width: "auto",
                  minWidth: "50px",
                  maxWidth: "180px",
                  paddingRight: "24px"
                }}
                data-testid="select-country-filter"
                title={selectedCountry === "All Countries" ? "Filter by country" : selectedCountry}
              >
                <option value="All Countries">🌐 All Countries</option>
                {countries.map((country) => {
                  const flag = getCountryFlag(country);
                  return (
                    <option key={country} value={country}>
                      {flag} {country}
                    </option>
                  );
                })}
              </select>
            </div>
          </div>
        </div>
        <div className="card-body text-center py-5">
          <div className="text-muted">
            <Ticket className="mx-auto mb-3 opacity-50" size={48} />
            <h5 className="fw-medium mb-2">
              {selectedCountry === "All Countries" ? "No events yet" : `No events in ${selectedCountry}`}
            </h5>
            <p className="small mb-3">
              {selectedCountry === "All Countries" 
                ? (user ? "Create your first event to get started" : "Sign in")
                : `Be the first to create an event in ${selectedCountry}`}
            </p>
            {user && (
              <Link
                href="/create-event"
                className="btn btn-primary"
                data-testid="button-create-event"
              >
                <Plus size={16} className="me-1" />
                Create Event
              </Link>
            )}
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
          <div className="d-flex gap-2 align-items-center">
            <button 
              className="btn btn-secondary btn-sm"
              onClick={handleFeelinLucky}
              data-testid="button-feelin-lucky"
              title="I'm feelin' lucky - Go to a random event"
              style={{ fontSize: "1.2em", padding: "0.25rem 0.5rem" }}
            >
              🎲
            </button>
            <select
              value={selectedCountry}
              onChange={(e) => {
                setSelectedCountry(e.target.value);
                setCurrentPage(1); // Reset to first page when filter changes
              }}
              className="form-select form-select-sm"
              style={{ 
                width: "auto",
                minWidth: "50px",
                maxWidth: "180px",
                paddingRight: "24px"
              }}
              data-testid="select-country-filter"
              title={selectedCountry === "All Countries" ? "Filter by country" : selectedCountry}
            >
              <option value="All Countries">🌐 All Countries</option>
              {countries.map((country) => {
                const flag = getCountryFlag(country);
                return (
                  <option key={country} value={country}>
                    {flag} {country}
                  </option>
                );
              })}
            </select>
          </div>
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
                      {event.p2pValidation && (
                        <span className="badge bg-success me-2" style={{ fontSize: "0.7em" }} title="Peer-to-Peer Validation Event">
                          <Shield size={12} className="me-1" style={{ verticalAlign: "middle" }} />
                          P2P
                        </span>
                      )}
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
                      className="btn btn-sm btn-secondary"
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
              Showing {events?.length || 0} events
              {selectedCountry !== "All Countries" && (
                <span className="ms-2 text-info">in {selectedCountry}</span>
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