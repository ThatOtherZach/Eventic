import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { ArrowRight, MapPin, Clock, Shield } from "lucide-react";
import { SpecialEffects, SpecialEffectBadge, SpecialEffectOverlay } from "@/components/tickets/special-effects";
import { detectSpecialEffect, getMonthlyColor } from "@/lib/special-effects";

interface FeaturedEvent {
  id: string;
  event: {
    id: string;
    name: string;
    venue: string;
    date: string;
    time: string;
    imageUrl?: string;
    ticketPrice: string;
    currentPrice?: number;
    p2pValidation?: boolean;
    isAdminCreated?: boolean;
    goldenTicketEnabled?: boolean;
    specialEffectsEnabled?: boolean;
    surgePricing?: boolean;
    stickerUrl?: string;
    stickerOdds?: number;
    allowMinting?: boolean;
    geofence?: boolean;
    enableVoting?: boolean;
    recurringType?: string;
  };
  isPaid: boolean;
}

export function FeaturedGrid() {
  const [, setLocation] = useLocation();
  const { data: featuredEvents = [], isLoading } = useQuery<FeaturedEvent[]>({
    queryKey: ["/api/featured-grid"],
    refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes to show fresh content
  });

  // Ensure we show at least 3 cards
  const displayEvents = featuredEvents.length < 6 && featuredEvents.length > 0 
    ? featuredEvents.slice(0, 3) 
    : featuredEvents.slice(0, 6);

  if (isLoading) {
    return (
      <div className="mb-5">
        <div className="d-flex justify-content-between align-items-center mb-4">
          <h3 className="h4 fw-semibold text-dark mb-0">Discover Events</h3>
        </div>
        
        <div className="row g-4">
          {[...Array(6)].map((_, index) => (
            <div key={index} className="col-md-4">
              <div className="card border-0 shadow-sm">
                <div 
                  className="placeholder-glow"
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

  if (!featuredEvents.length) {
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
        {displayEvents.map((featuredEvent) => {
          // Create a mock ticket object for display purposes
          const mockTicket = {
            id: `preview-${featuredEvent.event.id}`,
            ticketNumber: "PREVIEW",
            isGoldenTicket: featuredEvent.event.goldenTicketEnabled,
            qrData: null,
            isValidated: false
          };

          // Create a full event object for special effects components
          const fullEvent = {
            ...featuredEvent.event,
            description: null,
            country: null,
            maxTickets: featuredEvent.event.maxTickets || null,
            createdAt: new Date().toISOString(),
            userId: '',
            ticketBackgroundUrl: featuredEvent.event.imageUrl || null,
          };

          // Check for special effects
          const specialEffect = detectSpecialEffect(fullEvent, mockTicket);
          
          return (
            <div key={featuredEvent.event.id} className="col-md-4">
              <div 
                onClick={() => setLocation(`/events/${featuredEvent.event.id}`)}
                style={{ cursor: 'pointer' }}
                data-testid={`link-event-${featuredEvent.event.id}`}
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
                    background: featuredEvent.event.imageUrl 
                      ? `url(${featuredEvent.event.imageUrl}) center/cover` 
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
                      background: featuredEvent.event.imageUrl 
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

                  {/* Event Content */}
                  <div className="position-relative p-3 h-100 d-flex flex-column justify-content-between" style={{ zIndex: 10 }}>
                    {/* Top section with featured badge */}
                    <div>
                      {featuredEvent.isPaid && (
                        <span className="badge bg-warning text-dark mb-2">
                          Featured
                        </span>
                      )}
                    </div>

                    {/* Middle section with event info */}
                    <div className="text-white">
                      <h5 className="fw-semibold mb-2 text-truncate">
                        {featuredEvent.event.name}
                      </h5>
                  
                      {/* Event Feature Badges */}
                      {(featuredEvent.event.isAdminCreated || featuredEvent.event.goldenTicketEnabled || 
                        featuredEvent.event.specialEffectsEnabled || featuredEvent.event.surgePricing || 
                        featuredEvent.event.stickerUrl || featuredEvent.event.p2pValidation || 
                        featuredEvent.event.allowMinting || featuredEvent.event.geofence || 
                        featuredEvent.event.enableVoting || featuredEvent.event.recurringType) && (
                        <div className="d-flex flex-wrap gap-1 mb-2">
                          {featuredEvent.event.isAdminCreated && (
                            <span className="badge" style={{ backgroundColor: '#DC2626', color: '#fff', fontSize: "0.7em" }}>
                              Mission
                            </span>
                          )}
                          {featuredEvent.event.goldenTicketEnabled && (
                            <span className="badge" style={{ backgroundColor: '#FFD700', color: '#000', fontSize: "0.7em" }}>
                              Golden Tickets
                            </span>
                          )}
                          {featuredEvent.event.specialEffectsEnabled && (
                            <span className="badge" style={{ backgroundColor: '#9333EA', color: '#fff', fontSize: "0.7em" }}>
                              Special Effects
                            </span>
                          )}
                          {featuredEvent.event.surgePricing && (
                            <span className="badge" style={{ backgroundColor: '#DC2626', color: '#fff', fontSize: "0.7em" }}>
                              Surge
                            </span>
                          )}
                          {featuredEvent.event.stickerUrl && (
                            <span className="badge" style={{ backgroundColor: '#EC4899', color: '#fff', fontSize: "0.7em" }}>
                              Stickers
                            </span>
                          )}
                          {featuredEvent.event.p2pValidation && (
                            <span className="badge" style={{ backgroundColor: '#3B82F6', color: '#fff', fontSize: "0.7em" }}>
                              P2P Validation
                            </span>
                          )}
                          {featuredEvent.event.allowMinting && (
                            <span className="badge" style={{ backgroundColor: '#000000', color: '#fff', fontSize: "0.7em" }}>
                              Collectable
                            </span>
                          )}
                          {featuredEvent.event.geofence && (
                            <span className="badge" style={{ backgroundColor: '#F59E0B', color: '#fff', fontSize: "0.7em" }}>
                              Location Lock
                            </span>
                          )}
                          {featuredEvent.event.enableVoting && (
                            <span className="badge" style={{ backgroundColor: '#EAB308', color: '#fff', fontSize: "0.7em" }}>
                              Vote
                            </span>
                          )}
                          {featuredEvent.event.recurringType && (
                            <span className="badge" style={{ backgroundColor: '#059669', color: '#fff', fontSize: "0.7em" }}>
                              {featuredEvent.event.recurringType === 'weekly' && 'Weekly'}
                              {featuredEvent.event.recurringType === 'monthly' && 'Monthly'}
                              {featuredEvent.event.recurringType === 'annually' && 'Annual'}
                            </span>
                          )}
                        </div>
                      )}
                      
                      <div className="small text-white-50 mb-1">
                        <MapPin size={14} className="me-1" />
                        {featuredEvent.event.venue}
                      </div>
                      
                      <div className="small text-white-50">
                        <Clock size={14} className="me-1" />
                        {(() => {
                          const [year, month, day] = featuredEvent.event.date.split('-').map(Number);
                          return new Date(year, month - 1, day).toLocaleDateString();
                        })()} at {featuredEvent.event.time}
                      </div>
                    </div>

                    {/* Bottom section with price */}
                    <div className="text-end">
                      <span className="badge bg-primary" style={{ fontSize: '0.95rem', padding: '0.5rem 0.75rem' }}>
                        {(() => {
                          const price = featuredEvent.event.currentPrice ?? parseFloat(featuredEvent.event.ticketPrice);
                          return price === 0 ? 'Free' : `$${price.toFixed(2)}`;
                        })()}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}