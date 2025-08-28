import { useParams, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { MapPin, Calendar, Clock, DollarSign, Shield, Sparkles, Star } from "lucide-react";
import { SpecialEffects } from "@/components/tickets/special-effects";

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
}

export function LocationEventsPage() {
  const { location } = useParams<{ location: string }>();
  
  // Decode URL parameter (handle spaces and special characters)
  const decodedLocation = decodeURIComponent(location || "").trim();
  
  const { data: events = [], isLoading, error } = useQuery<Event[]>({
    queryKey: ["/api/events/location", decodedLocation],
    queryFn: async () => {
      const response = await fetch(`/api/events/location/${encodeURIComponent(decodedLocation)}`);
      if (!response.ok) {
        throw new Error("Failed to fetch events");
      }
      return response.json();
    },
    enabled: !!decodedLocation,
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

  if (!decodedLocation) {
    return (
      <div className="container mt-4">
        <div className="alert alert-warning">
          No location specified. Please use a URL like /London or /United States
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
          Failed to load events for {decodedLocation}
        </div>
      </div>
    );
  }

  return (
    <div className="container mt-4 pb-5">
      <div className="mb-4">
        <h2 className="h3 fw-bold text-dark d-flex align-items-center gap-2">
          <MapPin className="text-primary" size={28} />
          Events in {decodedLocation}
        </h2>
        <p className="text-muted">
          {events.length} {events.length === 1 ? 'event' : 'events'} found
        </p>
      </div>

      {events.length === 0 ? (
        <div className="card">
          <div className="card-body text-center py-5">
            <MapPin size={48} className="text-muted mb-3" />
            <h5 className="text-muted">No events found in {decodedLocation}</h5>
            <p className="text-muted">Check back later or explore events in other locations</p>
            <Link href="/">
              <a className="btn btn-primary mt-3" data-testid="button-go-home">
                Browse All Events
              </a>
            </Link>
          </div>
        </div>
      ) : (
        <div className="row g-4">
          {events.map((event) => {
            const hasGoldenTicket = event.specialEffects?.includes("Golden Ticket");
            const hasMonthlyColors = event.specialEffects?.includes("Monthly Colors");
            
            return (
              <div key={event.id} className="col-md-6 col-lg-4">
                <Link href={`/events/${event.id}`}>
                  <a className="text-decoration-none" data-testid={`link-event-${event.id}`}>
                    <div 
                      className={`card h-100 shadow-sm border-0 overflow-hidden position-relative ${
                        hasGoldenTicket ? 'golden-ticket-card' : ''
                      }`}
                      style={{
                        transition: "all 0.3s ease",
                        cursor: "pointer",
                        ...(hasMonthlyColors && {
                          background: `linear-gradient(135deg, ${currentMonthColor.gradient.replace('from-', '').replace('to-', ',')})`,
                        })
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = "translateY(-5px)";
                        e.currentTarget.style.boxShadow = hasGoldenTicket 
                          ? "0 10px 30px rgba(255, 215, 0, 0.4)" 
                          : hasMonthlyColors
                          ? `0 10px 30px rgba(var(--bs-${currentMonthColor.glow}-rgb), 0.3)`
                          : "0 10px 30px rgba(0,0,0,0.15)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = "translateY(0)";
                        e.currentTarget.style.boxShadow = "";
                      }}
                    >
                      {/* Special Effects Overlay */}
                      {hasGoldenTicket && (
                        <>
                          <div className="golden-shimmer"></div>
                          <div className="position-absolute top-0 end-0 m-2">
                            <span className="badge bg-warning text-dark">
                              <Star size={12} className="me-1" />
                              Golden Ticket
                            </span>
                          </div>
                        </>
                      )}
                      
                      {hasMonthlyColors && !hasGoldenTicket && (
                        <div className="position-absolute top-0 end-0 m-2">
                          <span className="badge bg-light text-dark">
                            <Sparkles size={12} className="me-1" />
                            Monthly Theme
                          </span>
                        </div>
                      )}

                      {/* Event Image */}
                      {event.imageUrl && (
                        <div 
                          className="card-img-top"
                          style={{
                            height: "200px",
                            backgroundImage: `url(${event.imageUrl})`,
                            backgroundSize: "cover",
                            backgroundPosition: "center",
                            opacity: hasMonthlyColors ? 0.9 : 1,
                          }}
                        />
                      )}
                      
                      <div className={`card-body ${hasMonthlyColors ? 'text-white' : ''}`}>
                        <h5 className={`card-title fw-semibold ${hasGoldenTicket ? 'golden-text' : ''}`}>
                          {event.name}
                        </h5>
                        
                        {event.p2pValidation && (
                          <div className="mb-2">
                            <span className={`badge ${hasMonthlyColors ? 'bg-light text-dark' : 'bg-success'}`}>
                              <Shield size={12} className="me-1" />
                              P2P Validation
                            </span>
                          </div>
                        )}
                        
                        <div className={`small ${hasMonthlyColors ? 'text-white-50' : 'text-muted'}`}>
                          <div className="d-flex align-items-center mb-1">
                            <MapPin size={14} className="me-1" />
                            {event.venue}
                          </div>
                          <div className="d-flex align-items-center mb-1">
                            <Calendar size={14} className="me-1" />
                            {new Date(event.date).toLocaleDateString()}
                            {event.endDate && event.endDate !== event.date && (
                              <span> - {new Date(event.endDate).toLocaleDateString()}</span>
                            )}
                          </div>
                          <div className="d-flex align-items-center mb-1">
                            <Clock size={14} className="me-1" />
                            {event.time}
                            {event.endTime && event.endTime !== event.time && (
                              <span> - {event.endTime}</span>
                            )}
                          </div>
                          <div className="d-flex align-items-center">
                            <DollarSign size={14} className="me-1" />
                            <strong>${event.ticketPrice || '0.00'}</strong>
                          </div>
                        </div>
                      </div>
                    </div>
                  </a>
                </Link>
              </div>
            );
          })}
        </div>
      )}
      
      {/* Add CSS for golden ticket effect */}
      <style>{`
        .golden-ticket-card {
          background: linear-gradient(
            135deg,
            #FFD700,
            #FFA500,
            #FFD700,
            #FFC700
          );
          animation: golden-pulse 3s ease-in-out infinite;
        }
        
        .golden-shimmer {
          position: absolute;
          top: 0;
          left: -100%;
          width: 100%;
          height: 100%;
          background: linear-gradient(
            90deg,
            transparent,
            rgba(255, 255, 255, 0.6),
            transparent
          );
          animation: shimmer 3s infinite;
          pointer-events: none;
        }
        
        .golden-text {
          background: linear-gradient(135deg, #FFD700, #FFA500);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        
        @keyframes golden-pulse {
          0%, 100% {
            box-shadow: 0 0 20px rgba(255, 215, 0, 0.5);
          }
          50% {
            box-shadow: 0 0 40px rgba(255, 215, 0, 0.8);
          }
        }
        
        @keyframes shimmer {
          0% {
            left: -100%;
          }
          50%, 100% {
            left: 200%;
          }
        }
      `}</style>
    </div>
  );
}