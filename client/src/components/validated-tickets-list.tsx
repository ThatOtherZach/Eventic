import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { Check, Calendar, Ticket } from "lucide-react";
import { format } from "date-fns";

interface ValidatedTicket {
  ticketId: string;
  ticketNumber: string;
  validatedAt: string;
  useCount: number;
  isGoldenTicket: boolean;
  userEmail: string;
  ticketType: string;
}

interface ValidatedTicketsListProps {
  eventId: string;
  isEventOwner: boolean;
}

export function ValidatedTicketsList({ eventId, isEventOwner }: ValidatedTicketsListProps) {
  const { user } = useAuth();

  const { data: validatedTickets, isLoading, error } = useQuery<ValidatedTicket[]>({
    queryKey: [`/api/events/${eventId}/validated-tickets`],
    enabled: !!eventId && !!user && isEventOwner,
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/events/${eventId}/validated-tickets`);
      return response.json();
    },
  });

  // Only show to event owners
  if (!isEventOwner) {
    return null;
  }

  if (isLoading) {
    return (
      <div>
        <h5 className="card-title mb-3">
          <Ticket size={20} className="me-2" />
          Validated Tickets
        </h5>
        <div className="d-flex justify-content-center p-4">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <h5 className="card-title mb-3">
          <Ticket size={20} className="me-2" />
          Validated Tickets
        </h5>
        <div className="alert alert-danger">
          Failed to load validated tickets. Please try again.
        </div>
      </div>
    );
  }

  return (
    <div>
      <h5 className="card-title mb-3">
        <Ticket size={20} className="me-2" />
        Validated Tickets ({validatedTickets?.length || 0})
      </h5>
      {!validatedTickets || validatedTickets.length === 0 ? (
        <div className="text-center text-muted p-3">
          <p className="small mb-0">No tickets have been validated yet</p>
        </div>
      ) : (
        <div className="list-group">
          {validatedTickets.map((ticket) => (
            <div key={ticket.ticketId} className="list-group-item d-flex justify-content-between align-items-center">
              <div className="d-flex align-items-center gap-2">
                <span className="badge bg-primary">{ticket.ticketNumber}</span>
                {ticket.isGoldenTicket && (
                  <span className="badge bg-warning text-dark">Golden</span>
                )}
                <span className="badge bg-success">Validated</span>
                <span className="badge bg-secondary">{ticket.userEmail}</span>
                {ticket.ticketType === "Pass" && (
                  <span className="badge bg-info">Pass</span>
                )}
                {ticket.useCount > 1 && (
                  <span className="badge bg-dark">Used {ticket.useCount}x</span>
                )}
              </div>
              <div className="text-muted small">
                {format(new Date(ticket.validatedAt), "MMM d, h:mm a")}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}