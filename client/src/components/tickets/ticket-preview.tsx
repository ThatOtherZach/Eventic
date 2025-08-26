import type { Event, Ticket } from "@shared/schema";

interface TicketPreviewProps {
  event: Event;
  ticket: Ticket;
}

export function TicketPreview({ event, ticket }: TicketPreviewProps) {
  return (
    <div className="border border-2 border-secondary border-opacity-25 rounded p-3" style={{ borderStyle: "dashed" }}>
      <div className="row">
        <div className="col-12">
          <h6 className="fw-semibold mb-1">{event.name}</h6>
          <p className="text-muted small mb-1">{event.venue}</p>
          <p className="text-muted small mb-2">{event.date} at {event.time}</p>
          <p className="small mb-0">
            <span className="text-muted">Ticket:</span> <span className="font-monospace">{ticket.ticketNumber}</span>
          </p>
        </div>
      </div>
    </div>
  );
}