import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { ArrowRight, MapPin, Clock, Shield } from "lucide-react";

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
  const { data: featuredEvents = [], isLoading } = useQuery<FeaturedEvent[]>({
    queryKey: ["/api/featured-grid"],
    refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes to show fresh content
  });

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
      
      <div className="row g-4">
        {featuredEvents.slice(0, 6).map((featuredEvent) => (
          <div key={featuredEvent.event.id} className="col-md-4">
            <Link href={`/events/${featuredEvent.event.id}`} className="text-decoration-none">
              <div className="card border-0 shadow-sm h-100 hover-card">
                <div 
                  className="card-img-top"
                  style={{
                    height: "200px",
                    backgroundImage: featuredEvent.event.imageUrl 
                      ? `linear-gradient(rgba(0,0,0,0.1), rgba(0,0,0,0.3)), url(${featuredEvent.event.imageUrl})`
                      : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                  }}
                >
                  {featuredEvent.isPaid && (
                    <div className="position-absolute top-0 start-0 m-2">
                      <span className="badge bg-warning text-dark">
                        Featured
                      </span>
                    </div>
                  )}
                </div>
                
                <div className="card-body py-3">
                  <h6 className="card-title fw-semibold text-dark mb-2 text-truncate">
                    {featuredEvent.event.name}
                  </h6>
                  
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
                  
                  <div className="small text-muted mb-1">
                    <MapPin size={14} className="me-1" />
                    {featuredEvent.event.venue}
                  </div>
                  
                  <div className="d-flex justify-content-between align-items-center">
                    <div className="small text-muted">
                      <Clock size={14} className="me-1" />
                      {(() => {
                        const [year, month, day] = featuredEvent.event.date.split('-').map(Number);
                        return new Date(year, month - 1, day).toLocaleDateString();
                      })()} at {featuredEvent.event.time}
                    </div>
                    <span className="badge bg-primary" style={{ fontSize: '0.95rem', padding: '0.5rem 0.75rem' }}>
                      {parseFloat(featuredEvent.event.ticketPrice) === 0 ? 'Free' : `$${parseFloat(featuredEvent.event.ticketPrice).toFixed(2)}`}
                    </span>
                  </div>
                </div>
              </div>
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}