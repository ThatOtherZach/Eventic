import { useState } from "react";
import { useParams, Link, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Calendar, MapPin, Clock, Ticket, Edit, ArrowLeft, CalendarPlus, Download, Eye } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { format } from "date-fns";
import { downloadICalendar, addToGoogleCalendar } from "@/lib/calendar-utils";
import type { Event, Ticket as TicketType } from "@shared/schema";

interface EventWithStats extends Event {
  ticketsSold: number;
  ticketsAvailable: number | null;
}

export default function EventDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [isPurchasing, setIsPurchasing] = useState(false);

  const { data: event, isLoading, error } = useQuery<EventWithStats>({
    queryKey: [`/api/events/${id}`],
    enabled: !!id,
  });

  const { data: userTickets } = useQuery<TicketType[]>({
    queryKey: [`/api/events/${id}/user-tickets`],
    enabled: !!id && !!user,
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/events/${id}/user-tickets`);
      return response.json();
    },
  });

  const purchaseTicketMutation = useMutation({
    mutationFn: async () => {
      if (!user) {
        setLocation("/auth");
        throw new Error("Please sign in to purchase tickets");
      }
      return apiRequest("POST", `/api/events/${id}/tickets`, {});
    },
    onSuccess: () => {
      toast({
        title: "Success!",
        description: "Your ticket has been purchased. Check your account page to view it.",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/events/${id}`] });
      setIsPurchasing(false);
    },
    onError: (error: any) => {
      toast({
        title: "Purchase Failed",
        description: error.message || "Failed to purchase ticket",
        variant: "destructive",
      });
      setIsPurchasing(false);
    },
  });

  const handlePurchase = () => {
    if (!user) {
      toast({
        title: "Sign In Required",
        description: "Please sign in to purchase tickets",
      });
      setLocation("/auth");
      return;
    }
    setIsPurchasing(true);
    purchaseTicketMutation.mutate();
  };

  if (isLoading) {
    return (
      <div className="container py-5">
        <div className="text-center">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="container py-5">
        <div className="alert alert-danger">
          Event not found or an error occurred.
        </div>
        <Link href="/events" className="btn btn-primary">
          <ArrowLeft size={18} className="me-2" />
          Back to Events
        </Link>
      </div>
    );
  }

  const eventDate = new Date(event.date);
  const isSoldOut = event.maxTickets && event.ticketsSold >= event.maxTickets;
  const isOwner = user && event.userId === user.id;

  return (
    <div className="container py-5">
      <Link href="/events" className="btn btn-link mb-3 text-decoration-none">
        <ArrowLeft size={18} className="me-2" />
        Back to Events
      </Link>

      <div className="row">
        <div className="col-lg-8">
          {event.imageUrl && (
            <div className="mb-4">
              <img 
                src={event.imageUrl} 
                alt={event.name}
                className="img-fluid rounded"
                style={{ width: '100%', maxHeight: '400px', objectFit: 'cover' }}
              />
            </div>
          )}

          <h1 className="mb-4">{event.name}</h1>

          <div className="d-flex flex-wrap gap-3 mb-4">
            <div className="d-flex align-items-center text-muted">
              <Calendar size={18} className="me-2" />
              {format(eventDate, "MMMM d, yyyy")}
            </div>
            <div className="d-flex align-items-center text-muted">
              <Clock size={18} className="me-2" />
              {event.time}
            </div>
            <div className="d-flex align-items-center text-muted">
              <MapPin size={18} className="me-2" />
              {event.venue}
            </div>
          </div>

          {event.description && (
            <div className="mb-4">
              <h5>About This Event</h5>
              <p className="text-muted" style={{ whiteSpace: 'pre-wrap' }}>
                {event.description}
              </p>
            </div>
          )}

          <div className="card bg-light mb-4">
            <div className="card-body">
              <h6 className="card-title mb-3">Add to Calendar</h6>
              <div className="d-flex gap-2 flex-wrap">
                <button
                  className="btn btn-outline-primary"
                  onClick={() => downloadICalendar(event)}
                  data-testid="button-icalendar"
                >
                  <Download size={18} className="me-2" />
                  iCalendar (.ics)
                </button>
                <button
                  className="btn btn-outline-danger"
                  onClick={() => addToGoogleCalendar(event)}
                  data-testid="button-google-calendar"
                >
                  <CalendarPlus size={18} className="me-2" />
                  Google Calendar
                </button>
              </div>
              <small className="text-muted d-block mt-2">
                Download for Apple Calendar, Outlook, or add to Google Calendar
              </small>
            </div>
          </div>

          {/* User's tickets for this event */}
          {userTickets && userTickets.length > 0 && (
            <div className="card mb-4">
              <div className="card-body">
                <h5 className="card-title mb-3">
                  <Ticket size={20} className="me-2" />
                  Your Tickets
                </h5>
                <div className="list-group">
                  {userTickets.map((ticket) => (
                    <div key={ticket.id} className="list-group-item d-flex justify-content-between align-items-center">
                      <div>
                        <span className="badge bg-primary me-2">{ticket.ticketNumber}</span>
                        {ticket.isValidated && <span className="badge bg-success">Used</span>}
                      </div>
                      <Link href={`/tickets/${ticket.id}`}>
                        <a className="btn btn-sm btn-outline-primary" data-testid={`button-view-ticket-${ticket.id}`}>
                          <Eye size={14} className="me-1" />
                          View Ticket
                        </a>
                      </Link>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="col-lg-4">
          <div className="card sticky-top" style={{ top: '80px' }}>
            <div className="card-body">
              <h5 className="card-title">Ticket Information</h5>
              
              <div className="mb-3">
                <div className="d-flex justify-content-between mb-2">
                  <span>Price:</span>
                  <strong>${parseFloat(event.ticketPrice).toFixed(2)}</strong>
                </div>
                {event.maxTickets && (
                  <>
                    <div className="d-flex justify-content-between mb-2">
                      <span>Tickets Sold:</span>
                      <span>{event.ticketsSold} / {event.maxTickets}</span>
                    </div>
                    <div className="progress mb-3">
                      <div 
                        className="progress-bar"
                        style={{ width: `${(event.ticketsSold / event.maxTickets) * 100}%` }}
                      />
                    </div>
                  </>
                )}
                {event.ticketsAvailable !== null && (
                  <div className="alert alert-info">
                    <small>
                      {isSoldOut ? (
                        "This event is sold out"
                      ) : (
                        `${event.ticketsAvailable} tickets remaining`
                      )}
                    </small>
                  </div>
                )}
              </div>

              {isOwner ? (
                <div>
                  <Link href={`/events/${id}/edit`} className="btn btn-primary w-100">
                    <Edit size={18} className="me-2" />
                    Edit Event
                  </Link>
                  <div className="alert alert-info mt-3">
                    <small>You own this event</small>
                  </div>
                </div>
              ) : (
                <button
                  className="btn btn-primary w-100"
                  onClick={handlePurchase}
                  disabled={isSoldOut || isPurchasing}
                  data-testid="button-purchase"
                >
                  {isPurchasing ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" />
                      Processing...
                    </>
                  ) : isSoldOut ? (
                    "Sold Out"
                  ) : (
                    <>
                      <Ticket size={18} className="me-2" />
                      Purchase Ticket
                    </>
                  )}
                </button>
              )}

              {!user && !isOwner && (
                <div className="alert alert-warning mt-3">
                  <small>
                    <Link href="/auth">Sign in</Link> to purchase tickets
                  </small>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}