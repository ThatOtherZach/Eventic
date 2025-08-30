import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { MapPin, Calendar, Clock, Star, Shield, Sparkles } from "lucide-react";
import { SpecialEffects, SpecialEffectBadge, SpecialEffectOverlay, detectSpecialEffect, getMonthlyColor } from "@/components/tickets/special-effects";

interface Event {
  id: string;
  name: string;
  venue: string;
  date: string;
  time: string;
  endDate?: string;
  endTime?: string;
  imageUrl?: string;
  ticketPrice: string;
  p2pValidation?: boolean;
  specialEffects?: string;
  ticketBackgroundUrl?: string;
  isAdminCreated?: boolean;
  allowMinting?: boolean;
}

interface FeaturedEvent {
  id: string;
  eventId: string;
  event: Event;
}

export function FeaturedEventsPage() {
  const [, setLocation] = useLocation();
  
  // Fetch featured/boosted events
  const { data: featuredData = [], isLoading: loadingFeatured } = useQuery<FeaturedEvent[]>({
    queryKey: ["/api/featured-events"],
  });

  // Fetch admin-created events and NFT-enabled events
  const { data: specialEvents = [], isLoading: loadingSpecial } = useQuery<Event[]>({
    queryKey: ["/api/events/special"],
    queryFn: async () => {
      const response = await fetch("/api/events");
      if (!response.ok) {
        throw new Error("Failed to fetch events");
      }
      const allEvents = await response.json();
      // Filter for admin-created events and NFT-enabled events
      return allEvents.filter((event: Event) => event.isAdminCreated || event.allowMinting);
    },
  });

  const isLoading = loadingFeatured || loadingSpecial;

  // Combine featured events, admin events, and NFT events, removing duplicates
  const combinedEvents = (() => {
    const eventMap = new Map<string, Event>();
    
    // Add featured events
    featuredData.forEach(featured => {
      eventMap.set(featured.event.id, featured.event);
    });
    
    // Add admin events and NFT events (won't duplicate if already featured)
    specialEvents.forEach(event => {
      if (!eventMap.has(event.id)) {
        eventMap.set(event.id, event);
      }
    });
    
    return Array.from(eventMap.values());
  })();

  if (isLoading) {
    return (
      <div className="container mt-4">
        <div className="d-flex justify-content-center p-5">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading featured events...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mt-4 pb-5">
      <div className="mb-4">
        <div className="d-flex align-items-start justify-content-between">
          <div>
            <h2 className="h3 fw-bold text-dark d-flex align-items-center gap-2">
              <img src="/world-star-icon.png" alt="" style={{ width: '28px', height: '28px' }} />
              Featured & Special Events
            </h2>
            <p className="text-muted">
              {combinedEvents.length} {combinedEvents.length === 1 ? 'event' : 'events'}
            </p>
          </div>
        </div>
      </div>

      {combinedEvents.length === 0 ? (
        <div className="card">
          <div className="card-body text-center py-5">
            <Star size={48} className="text-muted mb-3" />
            <h5 className="text-muted">No featured events at the moment</h5>
            <p className="text-muted">Check back later or explore all events</p>
            <Link href="/">
              <a className="btn btn-primary mt-3" style={{ textDecoration: 'none' }} data-testid="button-go-home">
                Browse All Events
              </a>
            </Link>
          </div>
        </div>
      ) : (
        <div className="row g-3">
          {combinedEvents.map((event) => {
            // Create a mock ticket object for display purposes
            const mockTicket = {
              id: `preview-${event.id}`,
              ticketNumber: "PREVIEW",
              isGoldenTicket: event.specialEffects?.includes("Golden Ticket"),
              qrData: null,
              isValidated: false
            };

            // Create a full event object for special effects components
            const fullEvent = {
              ...event,
              description: null,
              country: null,
              maxTickets: null,
              createdAt: new Date().toISOString(),
              userId: '',
              stripePaymentIntentId: null,
              stripePriceId: null,
              stripeProductId: null,
              specialEffects: event.specialEffects || null,
              ticketBackgroundUrl: event.ticketBackgroundUrl || null,
              organizerName: null,
              organizerEmail: null,
              organizerPhone: null,
              category: null,
              tags: null,
              isPrivate: false
            };

            // Check for special effects
            const specialEffect = detectSpecialEffect(fullEvent, mockTicket);
            const monthlyColor = specialEffect === 'monthly' ? getMonthlyColor(fullEvent, mockTicket) : null;
            
            return (
              <div key={event.id} className="col-md-6">
                <div 
                  onClick={() => setLocation(`/events/${event.id}`)}
                  style={{ cursor: 'pointer' }}
                  data-testid={`link-event-${event.id}`}
                >
                  {/* Ticket-style card matching TicketCard component */}
                  <div 
                    className="ticket-card position-relative w-100"
                      style={{
                        aspectRatio: '16/9',
                        maxWidth: '100%',
                        minHeight: '200px',
                        borderRadius: '8px',
                        overflow: 'hidden',
                        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                        background: event.ticketBackgroundUrl 
                          ? `url(${event.ticketBackgroundUrl}) center/cover` 
                          : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        transition: 'transform 0.2s, box-shadow 0.2s',
                        cursor: 'pointer',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'translateY(-2px)';
                        e.currentTarget.style.boxShadow = '0 6px 12px rgba(0, 0, 0, 0.15)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.1)';
                      }}
                    >
                      {/* Semi-transparent overlay for text readability */}
                      <div 
                        className="position-absolute w-100 h-100"
                        style={{
                          background: event.ticketBackgroundUrl 
                            ? 'rgba(0, 0, 0, 0.4)' 
                            : 'rgba(0, 0, 0, 0.2)',
                          backdropFilter: 'blur(1px)',
                        }}
                      />

                      {/* Golden Ticket Glow Overlay */}
                      {mockTicket.isGoldenTicket && (
                        <div 
                          className="position-absolute w-100 h-100 pointer-events-none"
                          style={{
                            background: 'radial-gradient(circle at center, transparent 30%, rgba(255, 215, 0, 0.15) 70%)',
                            boxShadow: 'inset 0 0 30px rgba(255, 215, 0, 0.225), inset 0 0 60px rgba(255, 215, 0, 0.075)',
                            animation: 'goldenGlow 3s ease-in-out infinite',
                            zIndex: 2,
                          }}
                        />
                      )}

                      {/* Special Event Effects Badge */}
                      <SpecialEffectBadge event={fullEvent} ticket={mockTicket} />
                      
                      {/* Special Effects Overlay (for glows and text) */}
                      <SpecialEffectOverlay event={fullEvent} ticket={mockTicket} />
                      
                      {/* Special Effects Animation (for particles) */}
                      <SpecialEffects event={fullEvent} ticket={mockTicket} />

                      {/* Badges for admin/NFT events */}
                      <div className="position-absolute top-0 start-0 p-2" style={{ zIndex: 10 }}>
                        {event.isAdminCreated && (
                          <span className="badge me-2" style={{ backgroundColor: '#DC2626', color: '#fff' }}>
                            Mission
                          </span>
                        )}
                        {event.allowMinting && (
                          <span className="badge bg-info text-white">
                            <Sparkles size={12} className="me-1" />
                            NFT
                          </span>
                        )}
                      </div>

                      {/* Ticket Content */}
                      <div className="position-relative h-100 d-flex">
                        {/* Event Details */}
                        <div className="flex-grow-1 px-3 pt-3 pb-4 text-white d-flex flex-column justify-content-between">
                          <div>
                            <h5 className="mb-2 fw-bold" style={{ fontSize: '18px', marginTop: '24px' }}>
                              {mockTicket.isGoldenTicket ? (
                                // Golden ticket takes priority
                                <span 
                                  style={{
                                    padding: '2px 8px',
                                    borderRadius: '4px',
                                    backgroundColor: 'rgba(255, 215, 0, 0.85)',
                                    color: '#000',
                                    display: 'inline-block',
                                    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)',
                                  }}
                                >
                                  {event.name}
                                </span>
                              ) : monthlyColor ? (
                                // Monthly effect badge
                                <span 
                                  style={{
                                    padding: '2px 8px',
                                    borderRadius: '4px',
                                    background: `linear-gradient(135deg, ${monthlyColor.color1}, ${monthlyColor.color2})`,
                                    color: '#fff',
                                    display: 'inline-block',
                                    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)',
                                    textShadow: '0 1px 2px rgba(0, 0, 0, 0.3)',
                                  }}
                                >
                                  {event.name}
                                </span>
                              ) : (
                                event.name
                              )}
                            </h5>
                            <div className="small opacity-90">
                              <div className="d-flex align-items-center mb-1">
                                <Calendar size={14} className="me-1" />
                                {event.date}
                                {event.endDate && event.endDate !== event.date && (
                                  <span> - {event.endDate}</span>
                                )}
                              </div>
                              <div className="d-flex align-items-center mb-1">
                                <Clock size={14} className="me-1" />
                                {event.time}
                                {event.endTime && (
                                  <span> - {event.endTime}</span>
                                )}
                              </div>
                              <div className="d-flex align-items-center mb-1">
                                <MapPin size={14} className="me-1" />
                                <span>{event.venue}</span>
                              </div>
                              <div className="fw-bold" style={{ fontSize: '16px' }}>
                                {event.ticketPrice && parseFloat(event.ticketPrice) > 0 
                                  ? `$${event.ticketPrice}` 
                                  : 'Free'}
                              </div>
                            </div>
                          </div>
                          <div className="d-flex justify-content-end align-items-end">
                            {event.p2pValidation && (
                              <span className="badge bg-success bg-opacity-75">
                                <Shield size={12} className="me-1" />
                                P2P Validation
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      
      {/* Add CSS for golden glow animation */}
      <style>{`
        @keyframes goldenGlow {
          0%, 100% {
            opacity: 0.8;
          }
          50% {
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}