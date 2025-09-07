import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Clock, MapPin, Calendar, ArrowRight } from "lucide-react";
import { detectSpecialEffect, getMonthlyColor, SpecialEffects, SpecialEffectBadge, SpecialEffectOverlay } from "@/components/tickets/special-effects";
import BadgeBar from "@/components/events/badge-bar";

interface FeaturedEvent {
  isPaid: boolean;
  position: number;
  event: {
    id: string;
    name: string;
    venue: string;
    date: string;
    time: string;
    endDate?: string | null;
    endTime?: string | null;
    ticketPrice: string;
    currentPrice?: number;
    imageUrl?: string | null;
    ticketBackgroundUrl?: string | null;
    isAdminCreated: boolean;
    goldenTicketEnabled: boolean;
    specialEffectsEnabled: boolean;
    surgePricing: boolean;
    stickerUrl?: string | null;
    p2pValidation: boolean;
    allowMinting: boolean;
    geofence: boolean;
    enableVoting: boolean;
    recurringType?: string | null;
    maxTickets?: number | null;
    specialEffects?: string[] | null;
  };
}

export function FeaturedGrid() {
  const [, setLocation] = useLocation();
  
  const { data: featuredEvents, isLoading } = useQuery<FeaturedEvent[]>({
    queryKey: ["/api/featured-grid"]
  });

  if (isLoading) {
    return (
      <div className="mb-5">
        <h3 className="h4 fw-semibold text-dark mb-4">Discover Events</h3>
        <div className="row g-3">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="col-md-6">
              <div className="card border-0 shadow-sm">
                <div 
                  className="card-img-top"
                  style={{ height: "200px" }}
                >
                  <div className="placeholder w-100 h-100"></div>
                </div>
                <div className="card-body">
                  <div className="placeholder-glow">
                    <span className="placeholder col-8"></span>
                    <span className="placeholder col-6"></span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!featuredEvents?.length) {
    return null;
  }

  return (
    <div className="mb-5" style={{ paddingTop: '20px' }}>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h3 className="h4 fw-semibold text-dark mb-0">Discover Events</h3>
        <Link href="/featured" className="btn btn-secondary">
          See More <ArrowRight size={16} className="ms-1" />
        </Link>
      </div>
      
      <div className="row g-3">
        {featuredEvents.slice(0, 8).map((featuredEvent) => {
          const event = featuredEvent.event;
          
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
            maxTickets: event.maxTickets || null,
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

                  {/* Event Feature Badge Bar */}
                  <BadgeBar event={event} />

                  {/* Ticket Content */}
                  <div className="position-relative h-100 d-flex">
                    {/* Event Details */}
                    <div className="flex-grow-1 px-3 pt-3 pb-5 text-white d-flex flex-column justify-content-between">
                      <div>
                        <h5 className="mb-2 fw-bold" style={{ fontSize: '18px', marginTop: '0' }}>
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
                            {(() => {
                              const price = event.currentPrice ?? parseFloat(event.ticketPrice || '0');
                              return price > 0 ? `$${price.toFixed(2)}` : 'Free';
                            })()}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      
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