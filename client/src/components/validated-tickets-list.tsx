import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { Check, Calendar, Ticket } from "lucide-react";
import { format } from "date-fns";
import poweredByImage from "@assets/image_1756973626753.png";
import singleTicketIcon from "@assets/certificate_seal_1757234773120.png";
import { useToast } from "@/hooks/use-toast";

interface ValidatedTicket {
  ticketId: string;
  ticketNumber: string;
  validatedAt: string;
  useCount: number;
  voteCount: number;
  isGoldenTicket: boolean;
  userEmail: string;
  ticketType: string;
  paymentConfirmed?: boolean;
}

interface ValidatedTicketsListProps {
  eventId: string;
  isEventOwner: boolean;
  enableVoting?: boolean;
  ticketPrice?: number;
}

function TogglePaymentButton({ ticketId, isConfirmed, eventId }: { ticketId: string; isConfirmed: boolean; eventId: string }) {
  const { toast } = useToast();
  
  const togglePaymentMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/tickets/${ticketId}/toggle-payment`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/events/${eventId}/validated-tickets`] });
      toast({
        title: "Payment status updated",
        description: `Ticket marked as ${!isConfirmed ? 'paid' : 'not paid'}`,
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update payment status",
        variant: "destructive",
      });
    },
  });

  return (
    <button
      className={`btn btn-sm ${isConfirmed ? 'btn-success' : 'btn-outline-secondary'} ms-2`}
      onClick={() => togglePaymentMutation.mutate()}
      disabled={togglePaymentMutation.isPending}
    >
      {togglePaymentMutation.isPending ? (
        <span className="spinner-border spinner-border-sm" role="status">
          <span className="visually-hidden">Loading...</span>
        </span>
      ) : isConfirmed ? (
        "Not Paid"
      ) : (
        "Paid"
      )}
    </button>
  );
}

export function ValidatedTicketsList({ eventId, isEventOwner, enableVoting, ticketPrice }: ValidatedTicketsListProps) {
  const { user } = useAuth();
  const { toast } = useToast();

  const { data: validatedTickets, isLoading, error } = useQuery<ValidatedTicket[]>({
    queryKey: [`/api/events/${eventId}/validated-tickets`],
    enabled: !!eventId && !!user && isEventOwner,
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/events/${eventId}/validated-tickets`);
      return response.json();
    },
  });

  // Show different content based on whether user is event owner
  if (!isEventOwner) {
    // Check if there are no validated tickets
    const { data: hasValidatedTickets } = useQuery<boolean>({
      queryKey: [`/api/events/${eventId}/has-validated-tickets`],
      enabled: !!eventId,
      queryFn: async () => {
        try {
          const response = await apiRequest("GET", `/api/events/${eventId}/validated-tickets/count`);
          const data = await response.json();
          return data.count > 0;
        } catch {
          return false;
        }
      },
    });

    if (!hasValidatedTickets) {
      return (
        <div className="text-center p-3">
          <img 
            src={poweredByImage} 
            alt="" 
            style={{ maxHeight: "32px" }}
          />
        </div>
      );
    }
    
    return null;
  }

  if (isLoading) {
    return (
      <div>
        <h5 className="card-title mb-3">
          <img
            src={singleTicketIcon}
            alt=""
            style={{
              width: "20px",
              height: "20px",
              marginRight: "8px",
              verticalAlign: "middle",
            }}
          />
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
          <img
            src={singleTicketIcon}
            alt=""
            style={{
              width: "20px",
              height: "20px",
              marginRight: "8px",
              verticalAlign: "middle",
            }}
          />
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
        <img
          src={singleTicketIcon}
          alt=""
          style={{
            width: "20px",
            height: "20px",
            marginRight: "8px",
            verticalAlign: "middle",
          }}
        />
        Validated Tickets ({validatedTickets?.length || 0})
      </h5>
      {!validatedTickets || validatedTickets.length === 0 ? (
        <div className="text-center text-muted p-3">
          <p className="small mb-0">No tickets have been validated yet</p>
        </div>
      ) : (
        <div className="list-group">
          {validatedTickets
            .sort((a, b) => {
              // Sort golden tickets to the top
              if (a.isGoldenTicket && !b.isGoldenTicket) return -1;
              if (!a.isGoldenTicket && b.isGoldenTicket) return 1;
              // Then sort by validation time (most recent first)
              return new Date(b.validatedAt).getTime() - new Date(a.validatedAt).getTime();
            })
            .map((ticket) => (
            <div key={ticket.ticketId} className="list-group-item">
              <div className="mb-2">
                <span className="badge bg-primary">{ticket.ticketNumber}</span>
                {ticketPrice && ticketPrice > 0 && (
                  <TogglePaymentButton 
                    ticketId={ticket.ticketId} 
                    isConfirmed={ticket.paymentConfirmed || false}
                    eventId={eventId}
                  />
                )}
              </div>
              <div className="mb-2 text-muted small">
                {format(new Date(ticket.validatedAt), "MMM d, yyyy 'at' h:mm a")}
              </div>
              {(ticket.isGoldenTicket || ticket.ticketType === "Pass" || 
                (enableVoting && ticket.voteCount > 0) || (!enableVoting && ticket.useCount > 1)) && (
                <div>
                  {ticket.isGoldenTicket && (
                    <span className="badge bg-warning text-dark me-2">Golden</span>
                  )}
                  {ticket.ticketType === "Pass" && (
                    <span className="badge bg-info me-2">Pass</span>
                  )}
                  {enableVoting ? (
                    ticket.voteCount > 0 && (
                      <span className="badge bg-success">
                        {ticket.voteCount} {ticket.voteCount === 1 ? 'vote' : 'votes'}
                      </span>
                    )
                  ) : (
                    ticket.useCount > 1 && (
                      <span className="badge bg-dark">Used {ticket.useCount}x</span>
                    )
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}