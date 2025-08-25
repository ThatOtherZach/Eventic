import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { Check, Calendar, Mail, Ticket, Users } from "lucide-react";
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
      <div className="card">
        <div className="card-header bg-white border-bottom">
          <h6 className="card-title mb-0 fw-medium">
            <Check className="me-2" size={18} />
            Validated Tickets
          </h6>
        </div>
        <div className="card-body">
          <div className="d-flex justify-content-center p-4">
            <div className="spinner-border text-primary" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card">
        <div className="card-header bg-white border-bottom">
          <h6 className="card-title mb-0 fw-medium">
            <Check className="me-2" size={18} />
            Validated Tickets
          </h6>
        </div>
        <div className="card-body">
          <div className="alert alert-danger">
            Failed to load validated tickets. Please try again.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="card-header bg-white border-bottom">
        <h6 className="card-title mb-0 fw-medium">
          <Check className="me-2" size={18} />
          Validated Tickets ({validatedTickets?.length || 0})
        </h6>
      </div>
      <div className="card-body p-0">
        {!validatedTickets || validatedTickets.length === 0 ? (
          <div className="p-4 text-center text-muted">
            <p className="small mb-0">No tickets have been validated yet</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table table-hover mb-0">
              <thead className="table-light">
                <tr>
                  <th scope="col" className="border-0 fw-medium small">
                    <Calendar className="me-1" size={14} />
                    Validated
                  </th>
                  <th scope="col" className="border-0 fw-medium small">
                    <Mail className="me-1" size={14} />
                    Email
                  </th>
                  <th scope="col" className="border-0 fw-medium small">
                    <Ticket className="me-1" size={14} />
                    Ticket #
                  </th>
                  <th scope="col" className="border-0 fw-medium small">
                    <Users className="me-1" size={14} />
                    Uses
                  </th>
                  <th scope="col" className="border-0 fw-medium small">Type</th>
                </tr>
              </thead>
              <tbody>
                {validatedTickets.map((ticket) => (
                  <tr key={ticket.ticketId}>
                    <td className="border-0 small">
                      {format(new Date(ticket.validatedAt), "MMM d, yyyy 'at' h:mm a")}
                    </td>
                    <td className="border-0 small font-monospace">
                      {ticket.userEmail}
                    </td>
                    <td className="border-0 small font-monospace">
                      {ticket.isGoldenTicket && <span className="me-1">🏆</span>}
                      {ticket.ticketNumber}
                    </td>
                    <td className="border-0 small">
                      <span className="badge bg-secondary">{ticket.useCount}</span>
                    </td>
                    <td className="border-0 small">
                      <span className={`badge ${
                        ticket.ticketType === "Single Use" ? "bg-info" :
                        ticket.ticketType === "Pass" ? "bg-warning" : "bg-success"
                      }`}>
                        {ticket.ticketType}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}