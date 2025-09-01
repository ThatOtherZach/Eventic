import { Calendar, MapPin, DollarSign } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Event } from "@shared/schema";

interface EventCardProps {
  event: Event;
}

export function EventCard({ event }: EventCardProps) {
  const eventDate = new Date(event.date);
  const isToday = eventDate.toDateString() === new Date().toDateString();
  const eventPrice = parseFloat(event.ticketPrice.toString());
  const isFree = eventPrice === 0;

  return (
    <div className="card h-100 border-0 shadow-sm">
      <div 
        className="card-img-top"
        style={{
          height: '200px',
          background: event.ticketBackgroundUrl 
            ? `url(${event.ticketBackgroundUrl}) center/cover` 
            : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        }}
      />
      <div className="card-body d-flex flex-column">
        <h5 className="card-title fw-bold">{event.name}</h5>
        
        <div className="d-flex align-items-center text-muted mb-2">
          <MapPin size={16} className="me-2" />
          <small>{event.venue}</small>
        </div>
        
        <div className="d-flex align-items-center text-muted mb-2">
          <Calendar size={16} className="me-2" />
          <small>
            {eventDate.toLocaleDateString()} at {event.time}
            {isToday && <Badge variant="secondary" className="ms-2">Today</Badge>}
          </small>
        </div>
        
        <div className="d-flex align-items-center text-muted mb-3">
          <DollarSign size={16} className="me-2" />
          <small className="fw-semibold">
            {isFree ? 'Free' : `$${eventPrice.toFixed(2)}`}
          </small>
        </div>

        <div className="d-flex flex-wrap gap-1 mb-3">
          {event.goldenTicketEnabled && (
            <Badge variant="outline" className="badge bg-warning text-dark">
              Golden Tickets
            </Badge>
          )}
          {event.p2pValidation && (
            <Badge variant="outline" className="badge bg-info">
              P2P Validation
            </Badge>
          )}
          {event.allowMinting && (
            <Badge variant="outline" className="badge bg-success">
              NFT Minting
            </Badge>
          )}
          {event.isAdminCreated && (
            <Badge variant="outline" className="badge bg-primary">
              Featured
            </Badge>
          )}
        </div>

        {event.description && (
          <p className="card-text text-muted small mt-auto">
            {event.description.length > 100 
              ? `${event.description.substring(0, 100)}...` 
              : event.description}
          </p>
        )}
      </div>
    </div>
  );
}