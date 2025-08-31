import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Link, useLocation } from "wouter";
import { Eye, Ticket, ShoppingCart, ChevronLeft, ChevronRight, Plus, Shield } from "lucide-react";
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
              <div className="dropdown">
                <button
                  className="btn btn-secondary btn-sm dropdown-toggle"
                  type="button"
                  data-bs-toggle="dropdown"
                  data-bs-auto-close="true"
                  aria-expanded="false"
                  style={{ fontSize: "1.2em", padding: "0.25rem 0.5rem" }}
                  title={selectedCountry === "All Countries" ? "Filter by country" : selectedCountry}
                >
                  {getSelectedDisplay()}
                </button>
                <ul className="dropdown-menu dropdown-menu-end" style={{ maxHeight: "300px", overflowY: "auto" }}>
                  <li>
                    <button 
                      className="dropdown-item"
                      onClick={() => {
                        setSelectedCountry("All Countries");
                        setCurrentPage(1);
                      }}
                    >
                      🌐 All Countries
                    </button>
                  </li>
                  {countries.map((country) => (
                    <li key={country}>
                      <button
                        className="dropdown-item"
                        onClick={() => {
                          setSelectedCountry(country);
                          setCurrentPage(1);
                        }}
                      >
                        {getCountryFlag(country)} {country}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
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
            <div className="dropdown">
              <button
                className="btn btn-secondary btn-sm dropdown-toggle"
                type="button"
                data-bs-toggle="dropdown"
                data-bs-auto-close="true"
                aria-expanded="false"
                style={{ fontSize: "1.2em", padding: "0.25rem 0.5rem" }}
                title={selectedCountry === "All Countries" ? "Filter by country" : selectedCountry}
              >
                {getSelectedDisplay()}
              </button>
              <ul className="dropdown-menu dropdown-menu-end" style={{ maxHeight: "300px", overflowY: "auto" }}>
                <li>
                  <button 
                    className="dropdown-item"
                    onClick={() => {
                      setSelectedCountry("All Countries");
                      setCurrentPage(1);
                    }}
                  >
                    🌐 All Countries
                  </button>
                </li>
                {countries.map((country) => (
                  <li key={country}>
                    <button
                      className="dropdown-item"
                      onClick={() => {
                        setSelectedCountry(country);
                        setCurrentPage(1);
                      }}
                    >
                      {getCountryFlag(country)} {country}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
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
            <Link 
              href={`/events/${event.id}`}
              className="text-decoration-none"
              style={{ cursor: 'pointer' }}
            >
              <div className="row align-items-center">
                <div className="col">
                  <div className="d-flex align-items-center">
                    {event.imageUrl ? (
                      <img 
                        src={event.imageUrl} 
                        alt={event.name}
                        className="rounded me-3"
                        style={{ width: '48px', height: '48px', objectFit: 'cover', cursor: 'pointer' }}
                      />
                    ) : (
                      <div className="bg-primary bg-opacity-10 rounded p-2 me-3" style={{ cursor: 'pointer' }}>
                        <Ticket className="text-primary" size={24} />
                      </div>
                    )}
                    <div className="flex-grow-1">
                      <h6 className="mb-1 fw-semibold text-dark">{event.name}</h6>
                      {/* Color bar for event features */}
                      {(event.isAdminCreated || event.goldenTicketEnabled || event.specialEffectsEnabled || 
                        event.surgePricing || event.stickerUrl || event.p2pValidation || event.allowMinting || 
                        event.geofence || event.enableVoting || event.recurringType || event.endDate) && (
                        <div className="d-flex mb-1" style={{ height: '3px', gap: '2px', width: '50%' }}>
                          {event.isAdminCreated && (
                            <div 
                              style={{ flex: 1, borderRadius: '2px', backgroundColor: '#DC2626' }}
                              title="Mission Event"
                            />
                          )}
                          {event.goldenTicketEnabled && (
                            <div 
                              style={{ flex: 1, borderRadius: '2px', backgroundColor: '#FFD700' }}
                              title="Golden Tickets"
                            />
                          )}
                          {event.specialEffectsEnabled && (
                            <div 
                              style={{ flex: 1, borderRadius: '2px', backgroundColor: '#9333EA' }}
                              title="Special Effects"
                            />
                          )}
                          {event.surgePricing && (
                            <div 
                              style={{ flex: 1, borderRadius: '2px', backgroundColor: '#DC2626' }}
                              title="Surge Pricing"
                            />
                          )}
                          {event.stickerUrl && (
                            <div 
                              style={{ flex: 1, borderRadius: '2px', backgroundColor: '#EC4899' }}
                              title="Custom Stickers"
                            />
                          )}
                          {event.p2pValidation && (
                            <div 
                              style={{ flex: 1, borderRadius: '2px', backgroundColor: '#3B82F6' }}
                              title="P2P Validation"
                            />
                          )}
                          {event.allowMinting && (
                            <div 
                              style={{ flex: 1, borderRadius: '2px', backgroundColor: '#000000' }}
                              title="Collectable NFT"
                            />
                          )}
                          {event.geofence && (
                            <div 
                              style={{ flex: 1, borderRadius: '2px', backgroundColor: '#F59E0B' }}
                              title="Location Lock"
                            />
                          )}
                          {event.enableVoting && (
                            <div 
                              style={{ flex: 1, borderRadius: '2px', backgroundColor: '#EAB308' }}
                              title="Voting Enabled"
                            />
                          )}
                          {event.recurringType && (
                            <div 
                              style={{ flex: 1, borderRadius: '2px', backgroundColor: '#059669' }}
                              title={`${event.recurringType.charAt(0).toUpperCase() + event.recurringType.slice(1)} Recurring`}
                            />
                          )}
                          {event.endDate && (
                            <div 
                              style={{ flex: 1, borderRadius: '2px', backgroundColor: '#6B7280' }}
                              title="Multi-day Event"
                            />
                          )}
                        </div>
                      )}
                      <p className="text-muted small mb-0">
                        {event.date} • {event.time}
                      </p>
                      <p className="text-muted small mb-0">{event.venue}</p>
                    </div>
                    <div className="text-end ms-auto">
                      <p className="mb-0 fw-semibold text-dark" style={{ cursor: 'pointer' }}>
                        Free
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </Link>
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