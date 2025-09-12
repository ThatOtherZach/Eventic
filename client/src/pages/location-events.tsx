import { useParams, Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { MapPin, Calendar, Clock, DollarSign, Shield, Sparkles, Star } from "lucide-react";
import { SpecialEffects, SpecialEffectBadge, SpecialEffectOverlay, detectSpecialEffect, getMonthlyColor } from "@/components/tickets/special-effects";
import BadgeBar from "@/components/events/badge-bar";
import globeIcon from "@assets/globe_map-5_1756847514357.png";

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
  currentPrice?: number;
  p2pValidation?: boolean;
  specialEffects?: string;
  ticketBackgroundUrl?: string;
  isAdminCreated?: boolean;
  allowMinting?: boolean;
  goldenTicketEnabled?: boolean;
  specialEffectsEnabled?: boolean;
  surgePricing?: boolean;
  stickerUrl?: string;
  stickerOdds?: number;
  geofence?: boolean;
  enableVoting?: boolean;
  recurringType?: string;
}

export function LocationEventsPage() {
  const params = useParams<{ value: string }>();
  const [pathname, setLocation] = useLocation();
  
  // Determine the location type from the URL path
  const getLocationType = () => {
    if (pathname.startsWith('/venue/')) return 'venue';
    if (pathname.startsWith('/city/')) return 'city';
    if (pathname.startsWith('/country/')) return 'country';
    return null;
  };
  
  const locationType = getLocationType();
  const locationValue = params.value || "";
  
  // Process the location value (handle special characters and formatting)
  const processedValue = locationValue
    .trim()
    // Add spaces before capital letters that follow lowercase letters
    .replace(/([a-z])([A-Z])/g, '$1 $2');
  
  const { data: events = [], isLoading, error } = useQuery<Event[]>({
    queryKey: ["/api/events/location", locationType, processedValue],
    queryFn: async () => {
      const queryParams = new URLSearchParams({
        type: locationType || '',
        value: processedValue
      });
      const response = await fetch(`/api/events/location?${queryParams}`);
      if (!response.ok) {
        throw new Error("Failed to fetch events");
      }
      return response.json();
    },
    enabled: !!processedValue && !!locationType,
  });

  // Get current date for special effects
  const currentMonth = new Date().getMonth();
  const monthColors = [
    { gradient: "from-blue-500 to-cyan-400", glow: "blue" }, // January
    { gradient: "from-pink-500 to-rose-400", glow: "pink" }, // February
    { gradient: "from-green-500 to-emerald-400", glow: "green" }, // March
    { gradient: "from-yellow-500 to-amber-400", glow: "yellow" }, // April
    { gradient: "from-purple-500 to-violet-400", glow: "purple" }, // May
    { gradient: "from-orange-500 to-red-400", glow: "orange" }, // June
    { gradient: "from-teal-500 to-cyan-400", glow: "teal" }, // July
    { gradient: "from-indigo-500 to-blue-400", glow: "indigo" }, // August
    { gradient: "from-red-500 to-pink-400", glow: "red" }, // September
    { gradient: "from-amber-500 to-orange-400", glow: "amber" }, // October
    { gradient: "from-violet-500 to-purple-400", glow: "violet" }, // November
    { gradient: "from-slate-500 to-gray-400", glow: "gray" }, // December
  ];
  
  const currentMonthColor = monthColors[currentMonth];

  if (!processedValue || !locationType) {
    return (
      <div className="container mt-4">
        <div className="alert alert-warning">
          No location specified. Please use a URL like /venue/Madison%20Square%20Garden, /city/New%20York or /country/USA
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="container mt-4">
        <div className="d-flex justify-content-center p-5">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading events...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mt-4">
        <div className="alert alert-danger">
          Failed to load events for {processedValue}
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
              <img src={globeIcon} alt="Globe" style={{ width: 28, height: 28 }} />
              <span>
                {locationType === 'venue' && 'Events at '}
                {locationType === 'city' && 'Events in '}
                {locationType === 'country' && 'Events in '}
                {processedValue.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
              </span>
            </h2>
            <p className="text-muted">
              {events.length} {events.length === 1 ? 'event' : 'events'} found
            </p>
          </div>
        </div>
      </div>

      {events.length === 0 ? (
        <div className="card">
          <div className="card-body text-center py-5">
            <img src={globeIcon} alt="Globe" className="mb-3" style={{ width: 48, height: 48, opacity: 0.5 }} />
            <h5 className="text-muted">No events found for {processedValue.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}</h5>
            <p className="text-muted">Check back later or explore events in other locations</p>
            <Link href="/">
              <a className="btn btn-primary mt-3" style={{ textDecoration: 'none' }} data-testid="button-go-home">
                Browse All Events
              </a>
            </Link>
          </div>
        </div>
      ) : (
        <div className="row g-3">
          {events.map((event) => {
            // Create a mock ticket object for display purposes
            const mockTicket = {
              id: `preview-${event.id}`,
              ticketNumber: "PREVIEW",
              isGoldenTicket: event.specialEffects?.includes("Golden Ticket"),
              qrData: null,
              isValidated: false
            };

            // Check for special effects - cast to any to handle partial event type
            const specialEffect = detectSpecialEffect(event as any, mockTicket);
            const monthlyColor = specialEffect === 'monthly' ? getMonthlyColor(event as any, mockTicket) : null;
            
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
                      <SpecialEffectBadge event={event as any} ticket={mockTicket} />
                      
                      {/* Special Effects Overlay (for glows and text) */}
                      <SpecialEffectOverlay event={event as any} ticket={mockTicket} />
                      
                      {/* Special Effects Animation (for particles) */}
                      <SpecialEffects event={event as any} ticket={mockTicket} />

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