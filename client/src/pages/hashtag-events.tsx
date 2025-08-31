import { useQuery } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { Calendar, MapPin, Users, DollarSign, Star, Sparkles, Vote, Crown } from "lucide-react";
import { format } from "date-fns";
import type { Event } from "@shared/schema";

export function HashtagEventsPage() {
  const { hashtag } = useParams<{ hashtag: string }>();
  const [, setLocation] = useLocation();
  
  const processedHashtag = (hashtag || "").trim().toLowerCase();
  
  const { data: events = [], isLoading, error } = useQuery<Event[]>({
    queryKey: ["/api/events/hashtag", processedHashtag],
    queryFn: async () => {
      const response = await fetch(`/api/events/hashtag/${encodeURIComponent(processedHashtag)}`);
      if (!response.ok) {
        throw new Error("Failed to fetch events");
      }
      return response.json();
    },
    enabled: !!processedHashtag,
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

  if (!processedHashtag) {
    return (
      <div className="container mt-4">
        <div className="alert alert-warning">
          No hashtag specified. Please use a URL like /hashtag/music or /hashtag/tech
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
          Failed to load events for #{processedHashtag}. Please try again later.
        </div>
      </div>
    );
  }

  // Format hashtag for display (capitalize first letter)
  const displayHashtag = processedHashtag.charAt(0).toUpperCase() + processedHashtag.slice(1);

  return (
    <div className="container mt-4 pb-5">
      <div className="mb-4">
        <div className="d-flex align-items-start justify-content-between">
          <div>
            <h2 className="h3 fw-bold text-dark d-flex align-items-center gap-2">
              <span className={`badge bg-gradient text-white bg-${currentMonthColor.glow}`}>
                #{displayHashtag}
              </span>
              Events
            </h2>
            <p className="text-muted">
              {events.length} {events.length === 1 ? 'event' : 'events'} tagged with #{processedHashtag}
            </p>
          </div>
        </div>
      </div>

      {events.length === 0 ? (
        <div className="alert alert-info">
          <h5 className="alert-heading">No events found</h5>
          <p className="mb-0">There are no upcoming events with the hashtag #{processedHashtag}.</p>
        </div>
      ) : (
        <div className="row g-4">
          {events.map((event) => {
            const eventDate = new Date(`${event.date}T${event.time}`);
            const isPastEvent = eventDate < new Date();
            
            return (
              <div key={event.id} className="col-md-6 col-lg-4">
                <div 
                  className="card h-100 shadow-sm hover-card cursor-pointer"
                  onClick={() => setLocation(`/events/${event.id}`)}
                  style={{
                    transition: "transform 0.2s, box-shadow 0.2s",
                    cursor: "pointer",
                    opacity: isPastEvent ? 0.7 : 1,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = "translateY(-4px)";
                    e.currentTarget.style.boxShadow = "0 8px 16px rgba(0,0,0,0.1)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = "translateY(0)";
                    e.currentTarget.style.boxShadow = "";
                  }}
                >
                  {/* Event Image */}
                  <div 
                    className="card-img-top position-relative"
                    style={{
                      height: "200px",
                      backgroundImage: event.imageUrl 
                        ? `linear-gradient(rgba(0,0,0,0.1), rgba(0,0,0,0.3)), url(${event.imageUrl})`
                        : `linear-gradient(135deg, ${currentMonthColor.gradient})`,
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                    }}
                  >
                    {/* Badges */}
                    <div className="position-absolute top-0 start-0 p-2 d-flex flex-wrap gap-1">
                      {event.goldenTicketEnabled && (
                        <span className="badge bg-warning text-dark">
                          <Crown size={12} className="me-1" />
                          Golden Ticket
                        </span>
                      )}
                      {event.specialEffectsEnabled && (
                        <span className="badge bg-info">
                          <Sparkles size={12} className="me-1" />
                          Effects
                        </span>
                      )}
                      {event.allowMinting && (
                        <span className="badge bg-success">
                          NFT
                        </span>
                      )}
                      {event.p2pValidation && (
                        <span className="badge bg-secondary">
                          P2P
                        </span>
                      )}
                      {event.enableVoting && (
                        <span className="badge bg-primary">
                          <Vote size={12} className="me-1" />
                          Voting
                        </span>
                      )}
                      {isPastEvent && (
                        <span className="badge bg-dark">
                          Past Event
                        </span>
                      )}
                    </div>
                    
                    {/* Price Badge */}
                    {event.ticketPrice && parseFloat(event.ticketPrice) > 0 && (
                      <div className="position-absolute bottom-0 end-0 p-2">
                        <span className="badge bg-dark bg-opacity-75">
                          <DollarSign size={14} />
                          {parseFloat(event.ticketPrice).toFixed(2)}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Event Details */}
                  <div className="card-body">
                    <h5 className="card-title fw-bold text-dark mb-2">
                      {event.name}
                    </h5>
                    
                    <div className="d-flex flex-column gap-2 text-muted small">
                      <div className="d-flex align-items-center gap-2">
                        <Calendar size={14} />
                        <span>{format(eventDate, "MMM d, yyyy 'at' h:mm a")}</span>
                      </div>
                      
                      {event.venue && (
                        <div className="d-flex align-items-center gap-2">
                          <MapPin size={14} />
                          <span className="text-truncate">{event.venue}</span>
                        </div>
                      )}
                      
                      {event.maxTickets && (
                        <div className="d-flex align-items-center gap-2">
                          <Users size={14} />
                          <span>Max {event.maxTickets} tickets</span>
                        </div>
                      )}
                    </div>

                    {/* View Details Button */}
                    <div className="mt-3">
                      <button 
                        className="btn btn-sm btn-outline-primary w-100"
                        onClick={(e) => {
                          e.stopPropagation();
                          setLocation(`/events/${event.id}`);
                        }}
                      >
                        View Details
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}