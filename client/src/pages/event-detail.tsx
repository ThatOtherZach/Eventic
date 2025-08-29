import { useState, useEffect } from "react";
import { useParams, Link, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Calendar, MapPin, Clock, Ticket, Edit, ArrowLeft, CalendarPlus, Download, Eye, UserPlus, X, Star, RotateCcw, Award, Gift, Shield } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useNotifications } from "@/hooks/use-notifications";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { format } from "date-fns";
import { downloadICalendar, addToGoogleCalendar } from "@/lib/calendar-utils";
import { BoostEventModal } from "@/components/boost/boost-event-modal";
import { ValidatedTicketsList } from "@/components/validated-tickets-list";
import type { Event, Ticket as TicketType } from "@shared/schema";

interface EventWithStats extends Event {
  ticketsSold: number;
  ticketsAvailable: number | null;
  currentPrice: number;
  resaleCount?: number;
}

export default function EventDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { toast } = useToast();
  const { addNotification } = useNotifications();
  const [, setLocation] = useLocation();
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [validatorEmail, setValidatorEmail] = useState("");
  const [isAddingValidator, setIsAddingValidator] = useState(false);
  const [ticketsDisplayed, setTicketsDisplayed] = useState(10);
  const [isBoostModalOpen, setIsBoostModalOpen] = useState(false);

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

  const { data: validators } = useQuery<any[]>({
    queryKey: [`/api/events/${id}/validators`],
    enabled: !!id && !!user && event?.userId === user.id,
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/events/${id}/validators`);
      return response.json();
    },
  });

  const { data: organizerReputation } = useQuery<{ thumbsUp: number; thumbsDown: number; percentage: number | null }>({
    queryKey: [`/api/users/${event?.userId}/reputation`],
    enabled: !!event?.userId,
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/users/${event?.userId}/reputation`);
      return response.json();
    },
  });

  // Update SEO meta tags when event data loads
  useEffect(() => {
    if (event) {
      // Set page title
      document.title = `${event.name} - Event Tickets`;
      
      // Remove existing meta tags we're going to replace
      const existingMetaTags = document.querySelectorAll('meta[name="description"], meta[property^="og:"], meta[name="twitter:"]');
      existingMetaTags.forEach(tag => tag.remove());
      
      // Create description from event description or fallback
      const description = event.description 
        ? event.description.replace(/<[^>]*>/g, '').substring(0, 160) + (event.description.length > 160 ? '...' : '')
        : `Join us for ${event.name} at ${event.venue} on ${event.date}. Get your tickets now!`;
      
      // Add meta description
      const metaDescription = document.createElement('meta');
      metaDescription.name = 'description';
      metaDescription.content = description;
      document.head.appendChild(metaDescription);
      
      // Add Open Graph tags
      const ogTitle = document.createElement('meta');
      ogTitle.setAttribute('property', 'og:title');
      ogTitle.content = event.name;
      document.head.appendChild(ogTitle);
      
      const ogDescription = document.createElement('meta');
      ogDescription.setAttribute('property', 'og:description');
      ogDescription.content = description;
      document.head.appendChild(ogDescription);
      
      const ogType = document.createElement('meta');
      ogType.setAttribute('property', 'og:type');
      ogType.content = 'event';
      document.head.appendChild(ogType);
      
      const ogUrl = document.createElement('meta');
      ogUrl.setAttribute('property', 'og:url');
      ogUrl.content = window.location.href;
      document.head.appendChild(ogUrl);
      
      // Add Open Graph image if event has featured image
      if (event.imageUrl) {
        const ogImage = document.createElement('meta');
        ogImage.setAttribute('property', 'og:image');
        ogImage.content = event.imageUrl;
        document.head.appendChild(ogImage);
        
        const ogImageAlt = document.createElement('meta');
        ogImageAlt.setAttribute('property', 'og:image:alt');
        ogImageAlt.content = `${event.name} event image`;
        document.head.appendChild(ogImageAlt);
      }
      
      // Add Twitter Card tags
      const twitterCard = document.createElement('meta');
      twitterCard.name = 'twitter:card';
      twitterCard.content = 'summary_large_image';
      document.head.appendChild(twitterCard);
      
      const twitterTitle = document.createElement('meta');
      twitterTitle.name = 'twitter:title';
      twitterTitle.content = event.name;
      document.head.appendChild(twitterTitle);
      
      const twitterDescription = document.createElement('meta');
      twitterDescription.name = 'twitter:description';
      twitterDescription.content = description;
      document.head.appendChild(twitterDescription);
      
      if (event.imageUrl) {
        const twitterImage = document.createElement('meta');
        twitterImage.name = 'twitter:image';
        twitterImage.content = event.imageUrl;
        document.head.appendChild(twitterImage);
      }
    }
    
    // Cleanup function to reset title when component unmounts
    return () => {
      document.title = 'Event Tickets';
    };
  }, [event]);

  const addValidatorMutation = useMutation({
    mutationFn: async (email: string) => {
      return apiRequest("POST", `/api/events/${id}/validators`, { email });
    },
    onSuccess: () => {
      toast({
        title: "Success!",
        description: "Delegated validator added successfully",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/events/${id}/validators`] });
      setValidatorEmail("");
      setIsAddingValidator(false);
    },
    onError: (error: any) => {
      addNotification({
        type: "error",
        title: "Error",
        description: error.message || "Failed to add validator",
      });
      setIsAddingValidator(false);
    },
  });

  const removeValidatorMutation = useMutation({
    mutationFn: async (validatorId: string) => {
      return apiRequest("DELETE", `/api/events/${id}/validators/${validatorId}`, {});
    },
    onSuccess: () => {
      toast({
        title: "Success!",
        description: "Validator removed successfully",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/events/${id}/validators`] });
    },
    onError: (error: any) => {
      addNotification({
        type: "error",
        title: "Error",
        description: error.message || "Failed to remove validator",
      });
    },
  });

  const resellTicketMutation = useMutation({
    mutationFn: async (ticketId: string) => {
      const response = await apiRequest("POST", `/api/tickets/${ticketId}/resell`, {});
      return { ...await response.json(), ticketId };
    },
    onSuccess: (data) => {
      const ticket = userTickets?.find(t => t.id === data.ticketId);
      const price = parseFloat((ticket as any)?.purchasePrice || event?.ticketPrice || "0");
      const isReturn = price === 0;
      
      toast({
        title: isReturn ? "Ticket Returned" : "Listed for Resale",
        description: isReturn 
          ? "Your ticket has been returned and is now available for others."
          : "Your ticket has been listed for resale successfully.",
      });
      // Refresh tickets and event data
      queryClient.invalidateQueries({ queryKey: [`/api/events/${id}/user-tickets`] });
      queryClient.invalidateQueries({ queryKey: [`/api/events/${id}`] });
    },
    onError: (error: any) => {
      toast({
        title: "Resale Failed",
        description: error.message || "Unable to list ticket for resale",
        variant: "destructive",
      });
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
      queryClient.invalidateQueries({ queryKey: [`/api/events/${id}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/events/${id}/user-tickets`] });
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
      setIsPurchasing(false);
    },
    onError: (error: any) => {
      // Check if it's a rate limit error (429)
      const isRateLimit = error.message?.includes("429:");
      
      if (isRateLimit) {
        addNotification({
          type: "warning",
          title: "Purchase Limit Reached",
          description: "You've reached the maximum number of purchase attempts. Please wait a moment before trying again.",
        });
      } else {
        addNotification({
          type: "error",
          title: "Purchase Failed",
          description: error.message || "Failed to purchase ticket",
        });
      }
      setIsPurchasing(false);
    },
  });

  const canResellTicket = (ticket: TicketType) => {
    if (!event) return false;
    
    // Check if ticket has been validated
    if (ticket.isValidated) return false;
    
    // Check if ticket is already for resale
    if ((ticket as any).resellStatus === "for_resale") return false;
    
    // Check if event start is at least 1 hour in the future
    const eventStartTime = new Date(`${event.date}T${event.time}:00`);
    const now = new Date();
    const hoursUntilEvent = (eventStartTime.getTime() - now.getTime()) / (1000 * 60 * 60);
    
    return hoursUntilEvent >= 1;
  };

  const handleResell = async (ticketId: string) => {
    const ticket = userTickets?.find(t => t.id === ticketId);
    const originalPrice = parseFloat((ticket as any)?.purchasePrice || event?.ticketPrice || "0");
    
    const confirmMessage = originalPrice === 0
      ? "Are you sure you want to return this free ticket? It will become available for others to claim."
      : `Are you sure you want to list this ticket for resale at $${originalPrice.toFixed(2)}? When someone buys it, you'll receive the payment (minus a 2% platform fee). Tickets can only be resold at their original purchase price.`;
    
    if (confirm(confirmMessage)) {
      resellTicketMutation.mutate(ticketId);
    }
  };

  const handlePurchase = () => {
    if (!user) {
      addNotification({
        type: "warning",
        title: "Sign In Required",
        description: "Please sign in to purchase tickets",
      });
      setLocation("/auth");
      return;
    }
    setIsPurchasing(true);
    purchaseTicketMutation.mutate();
  };

  // Format vote count (1000 -> 1k, 999000 -> 999k, 1000000+ -> +1M)
  const formatVoteCount = (count: number) => {
    if (count >= 1000000) {
      return "+1M";
    } else if (count >= 1000) {
      const k = Math.floor(count / 1000);
      return `${k}k`;
    }
    return count.toString();
  };

  // Get reputation badge and display
  const getReputationDisplay = () => {
    if (!organizerReputation) return null;
    
    const { percentage, thumbsUp, thumbsDown } = organizerReputation;
    const totalVotes = thumbsUp + thumbsDown;
    
    if (percentage === null || percentage === 0) {
      return { badge: "New", showPercentage: false, totalVotes };
    } else if (percentage >= 1 && percentage <= 25) {
      return { badge: "Novice", showPercentage: false, totalVotes };
    } else {
      return { badge: null, showPercentage: true, percentage, totalVotes };
    }
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

  const eventDate = event.date ? (() => {
    try {
      // Parse the date components to avoid timezone issues
      const [year, month, day] = event.date.split('-').map(Number);
      // Create date in local timezone by specifying components
      const date = new Date(year, month - 1, day);
      return isNaN(date.getTime()) ? null : date;
    } catch {
      return null;
    }
  })() : null;
  
  // Check if event has passed based on either start date or end date
  const isEventPast = (() => {
    const now = new Date();
    
    // If there's an end date, use it to determine if event is past
    if (event.endDate) {
      try {
        const endDate = new Date(event.endDate);
        if (!isNaN(endDate.getTime())) {
          // Set end date to end of day for comparison
          endDate.setHours(23, 59, 59, 999);
          return now > endDate;
        }
      } catch {
        // If end date parsing fails, fall back to start date
      }
    }
    
    // Otherwise use start date to determine if event has started
    if (eventDate) {
      // For single-day events, consider them past once they've started
      return now > eventDate;
    }
    
    return false;
  })();
  
  const isSoldOut = event.ticketsAvailable === 0;
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
              {event.endDate ? (
                <>
                  {eventDate ? format(eventDate, "MMMM d, yyyy") : event.date} - {event.endDate && event.endDate !== '' ? (() => {
                    try {
                      // Parse the date components to avoid timezone issues
                      const [year, month, day] = event.endDate.split('-').map(Number);
                      // Create date in local timezone by specifying components
                      const endDate = new Date(year, month - 1, day);
                      return isNaN(endDate.getTime()) ? 'Invalid end date' : format(endDate, "MMMM d, yyyy");
                    } catch {
                      return 'Invalid end date';
                    }
                  })() : 'No end date'}
                </>
              ) : (
                eventDate ? format(eventDate, "MMMM d, yyyy") : event.date
              )}
            </div>
            <div className="d-flex align-items-center text-muted">
              <Clock size={18} className="me-2" />
              {event.endTime ? (
                <>
                  {event.time} - {event.endTime}
                </>
              ) : (
                event.time
              )}
              {event.timezone && (
                <span className="ms-1">
                  ({(() => {
                    const tzMap: Record<string, string> = {
                      "America/New_York": "ET",
                      "America/Chicago": "CT",
                      "America/Denver": "MT",
                      "America/Phoenix": "MST",
                      "America/Los_Angeles": "PT",
                      "America/Anchorage": "AKT",
                      "Pacific/Honolulu": "HST",
                      "Europe/London": "GMT/BST",
                      "Europe/Paris": "CET",
                      "Europe/Berlin": "CET",
                      "Europe/Moscow": "MSK",
                      "Asia/Tokyo": "JST",
                      "Asia/Shanghai": "CST",
                      "Asia/Hong_Kong": "HKT",
                      "Asia/Singapore": "SGT",
                      "Asia/Dubai": "GST",
                      "Asia/Kolkata": "IST",
                      "Australia/Sydney": "AEDT",
                      "Australia/Melbourne": "AEDT",
                      "Pacific/Auckland": "NZDT",
                      "UTC": "UTC"
                    };
                    return tzMap[event.timezone] || event.timezone.split('/').pop()?.replace(/_/g, ' ');
                  })()})
                </span>
              )}
            </div>
            <div className="d-flex align-items-center text-muted">
              <MapPin size={18} className="me-2" />
              {event.venue}
            </div>
          </div>

          {/* Event Creator Reputation */}
          {organizerReputation && (
            <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border">
              <div className="flex items-center gap-2">
                <Award className="h-4 w-4 text-blue-600" />
                <span className="font-medium text-sm">Event Creator Reputation</span>
                {organizerReputation.percentage === null ? (
                  <span className="px-2 py-1 bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs rounded-full">
                    New
                  </span>
                ) : organizerReputation.percentage >= 1 && organizerReputation.percentage <= 25 ? (
                  <span className="px-2 py-1 bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 text-xs rounded-full">
                    Novice
                  </span>
                ) : organizerReputation.thumbsUp + organizerReputation.thumbsDown >= 1000 ? (
                  <span className="px-2 py-1 bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 text-xs rounded-full">
                    Bestie
                  </span>
                ) : (
                  <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 text-xs rounded-full">
                    {organizerReputation.percentage}% • {(() => {
                      const total = organizerReputation.thumbsUp + organizerReputation.thumbsDown;
                      if (total >= 1000000) return `+1M`;
                      if (total >= 1000) return `${Math.floor(total / 1000)}k`;
                      return total.toString();
                    })()} votes
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Contact Details - Only shown to ticket holders */}
          {event.contactDetails && userTickets && userTickets.length > 0 && (
            <div className="mb-4">
              <h5>Contact Details</h5>
              <div className="text-muted">
                {event.contactDetails}
              </div>
            </div>
          )}

          {event.description && (
            <div className="mb-4">
              <h5>About This Event</h5>
              <div 
                className="text-muted"
                dangerouslySetInnerHTML={{ __html: event.description }}
              />
            </div>
          )}

          {/* P2P Validation Notice */}
          {event.p2pValidation && (
            <div className="alert alert-info mb-4">
              <div className="d-flex align-items-start">
                <Shield size={20} className="me-3 mt-1 flex-shrink-0" />
                <div>
                  <h6 className="alert-heading mb-2">Peer-to-Peer Validation Event</h6>
                  <p className="mb-2">This event uses community-based ticket validation. What this means:</p>
                  <ul className="mb-0 ps-3">
                    <li>Tickets are validated by other attendees, not just event staff</li>
                    <li>Any ticket holder can scan and validate other tickets at the venue</li>
                    <li>The event organizer(s) may or may not be present at the event</li>
                    <li>Entry is managed collectively by the attendee community</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          <div className="card bg-light mb-4">
            <div className="card-body">
              <h6 className="card-title mb-3">Add to Calendar</h6>
              <div className="d-flex gap-2 flex-wrap">
                <button
                  className="btn btn-secondary"
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
                  Your Tickets ({userTickets.length})
                </h5>
                <div className="list-group">
                  {userTickets.slice(0, ticketsDisplayed).map((ticket) => (
                    <div key={ticket.id} className="list-group-item d-flex justify-content-between align-items-center">
                      <div>
                        <span className="badge bg-primary me-2">{ticket.ticketNumber}</span>
                        {ticket.isValidated && <span className="badge bg-success">Used</span>}
                        {(ticket as any).resellStatus === "for_resale" && (
                          <span className="badge bg-warning text-dark">Listed for Resale</span>
                        )}
                      </div>
                      <div className="d-flex gap-2">
                        {(ticket as any).resellStatus !== "for_resale" && (
                          <Link href={`/tickets/${ticket.id}`}>
                            <a className="btn btn-sm btn-secondary" data-testid={`button-view-ticket-${ticket.id}`}>
                              <Eye size={14} className="me-1" />
                              View
                            </a>
                          </Link>
                        )}
                        {canResellTicket(ticket) && (
                          <button
                            className="btn btn-sm btn-outline-warning"
                            onClick={() => handleResell(ticket.id)}
                            disabled={resellTicketMutation.isPending}
                            data-testid={`button-resell-ticket-${ticket.id}`}
                          >
                            <RotateCcw size={14} className="me-1" />
                            {parseFloat(ticket.purchasePrice || event.ticketPrice) === 0 ? 'Return' : 'Resell'}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                {userTickets.length > ticketsDisplayed && (
                  <div className="text-center mt-3">
                    <button
                      className="btn btn-secondary"
                      onClick={() => setTicketsDisplayed(prev => Math.min(prev + 10, userTickets.length))}
                      data-testid="button-show-more-tickets"
                    >
                      Show {Math.min(10, userTickets.length - ticketsDisplayed)} More
                    </button>
                    <div className="text-muted small mt-2">
                      Showing {ticketsDisplayed} of {userTickets.length} tickets
                    </div>
                  </div>
                )}
                {userTickets.length > 10 && ticketsDisplayed >= userTickets.length && (
                  <div className="text-center mt-3">
                    <button
                      className="btn btn-outline-secondary btn-sm"
                      onClick={() => setTicketsDisplayed(10)}
                      data-testid="button-show-less-tickets"
                    >
                      Show Less
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="col-lg-4">
          <div className="card sticky-top" style={{ top: '80px' }}>
            <div className="card-body">
              <h5 className="card-title">Ticket Information</h5>
              
              {/* Organizer Reputation */}
              {organizerReputation && (() => {
                const reputationInfo = getReputationDisplay();
                if (!reputationInfo) return null;
                
                const { badge, showPercentage, percentage, totalVotes } = reputationInfo;
                const formattedVotes = formatVoteCount(totalVotes);
                
                return (
                  <div className="mb-3 p-3 bg-light rounded">
                    <div className="d-flex align-items-center justify-content-between">
                      <span className="text-muted small">Organizer Reputation</span>
                      {totalVotes >= 1000 && (
                        <span className="badge bg-warning text-dark">
                          <Award size={14} className="me-1" />
                          Bestie
                        </span>
                      )}
                    </div>
                    <div className="d-flex align-items-center mt-1">
                      <Star size={16} className="text-warning me-2" />
                      {badge ? (
                        <span className="badge bg-secondary">{badge}</span>
                      ) : showPercentage ? (
                        <span>
                          <strong>{percentage}%</strong>
                          <span className="text-muted ms-2">({formattedVotes} votes)</span>
                        </span>
                      ) : null}
                    </div>
                  </div>
                );
              })()}
              
              <div className="mb-3">
                <div className="d-flex justify-content-between mb-2">
                  <span>Price:</span>
                  {event.ticketsAvailable === 0 ? (
                    <span className="badge bg-danger text-white">Sold Out</span>
                  ) : (
                    <strong>
                      {event.currentPrice === 0 ? 'Free Entry' : `$${event.currentPrice.toFixed(2)}`}
                      {event.surgePricing && event.currentPrice !== parseFloat(event.ticketPrice) && (
                        <small className="text-muted ms-2">(was ${parseFloat(event.ticketPrice).toFixed(2)})</small>
                      )}
                    </strong>
                  )}
                </div>
                
                {event.surgePricing && (
                  <div className="mb-2">
                    <div className="d-flex align-items-center">
                      <span className="badge bg-warning text-dark me-2">📈</span>
                      <small className="text-muted">
                        Surge pricing active - prices increase based on demand and time to event
                      </small>
                    </div>
                    {event.currentPrice !== parseFloat(event.ticketPrice) && (
                      <div className="mt-1">
                        <small className="text-muted">
                          Price increased due to: 
                          {(() => {
                            const basePrice = parseFloat(event.ticketPrice);
                            const increase = event.currentPrice - basePrice;
                            const increasePercent = Math.round((increase / basePrice) * 100);
                            
                            // Calculate time to event
                            let daysUntilEvent = 0;
                            try {
                              const eventDateTime = new Date(`${event.date}T${event.time}:00`);
                              if (!isNaN(eventDateTime.getTime())) {
                                const now = new Date();
                                daysUntilEvent = (eventDateTime.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
                              }
                            } catch {
                              // Handle invalid date gracefully
                            }
                            
                            const factors = [];
                            
                            // Check if demand contributes
                            if (event.maxTickets && event.ticketsSold > 0) {
                              const demandPercent = Math.round((event.ticketsSold / event.maxTickets) * 100);
                              if (demandPercent > 10) factors.push(`${demandPercent}% sold`);
                            }
                            
                            // Check if urgency contributes
                            if (daysUntilEvent <= 14) {
                              if (daysUntilEvent <= 1) factors.push("event within 24 hours");
                              else if (daysUntilEvent <= 3) factors.push("event within 3 days");
                              else if (daysUntilEvent <= 7) factors.push("event within 1 week");
                              else factors.push("event within 2 weeks");
                            }
                            
                            return factors.length > 0 
                              ? ` ${factors.join(", ")} (+${increasePercent}%)`
                              : ` high demand (+${increasePercent}%)`;
                          })()}
                        </small>
                      </div>
                    )}
                  </div>
                )}
                
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
                        <>
                          {event.ticketsAvailable} tickets remaining
                          {event.resaleCount && event.resaleCount > 0 && (
                            <div className="mt-1">
                              {event.resaleCount} {event.resaleCount === 1 ? 'ticket' : 'tickets'} listed for resale
                            </div>
                          )}
                        </>
                      )}
                    </small>
                  </div>
                )}
              </div>

              {/* Purchase Button for everyone including owners */}
              <button
                className="btn btn-primary w-100 mb-3"
                onClick={handlePurchase}
                disabled={isSoldOut || isPurchasing || isEventPast || !event?.ticketPurchasesEnabled}
                data-testid="button-purchase"
              >
                {isPurchasing ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" />
                    Processing...
                  </>
                ) : isEventPast ? (
                  "Event Has Passed"
                ) : isSoldOut ? (
                  "Sold Out"
                ) : !event?.ticketPurchasesEnabled ? (
                  "Event Suspended"
                ) : (
                  <>
                    <Ticket size={18} className="me-2" />
                    Purchase Ticket
                  </>
                )}
              </button>
              
              {/* Show message if ticket sales are disabled */}
              {!event?.ticketPurchasesEnabled && !isEventPast && !isSoldOut && (
                <div className="alert alert-warning mb-3">
                  <small>
                    <strong>This event has been suspended by administrators.</strong><br />
                    {event.resaleCount && event.resaleCount > 0 && (
                      <>Existing ticket holders can still resell - {event.resaleCount} {event.resaleCount === 1 ? 'ticket is' : 'tickets are'} available for resale.</>
                    )}
                  </small>
                </div>
              )}

              {isOwner && (
                <div>
                  <Link href={`/events/${id}/edit`} className="btn btn-secondary w-100 mb-2">
                    <Edit size={18} className="me-2" />
                    Edit Event
                  </Link>
                  <button 
                    onClick={() => setIsBoostModalOpen(true)}
                    className="btn btn-warning w-100 mb-2"
                    data-testid="button-boost-event"
                  >
                    <Star size={18} className="me-2" />
                    Boost to Featured
                  </button>
                  <div className="alert alert-info mt-3">
                    <small>You own this event</small>
                  </div>
                  
                  {/* Delegated Validators Section */}
                  <div className="mt-4">
                    <h6 className="fw-semibold mb-3">Delegated Validators</h6>
                    <p className="small text-muted mb-3">
                      Allow others to validate tickets for this event by adding their email address.
                    </p>
                    
                    <div className="input-group mb-3">
                      <input
                        type="email"
                        className="form-control"
                        placeholder="Enter email address"
                        value={validatorEmail}
                        onChange={(e) => setValidatorEmail(e.target.value)}
                        disabled={isAddingValidator}
                      />
                      <button
                        className="btn btn-secondary"
                        onClick={() => {
                          if (validatorEmail) {
                            setIsAddingValidator(true);
                            addValidatorMutation.mutate(validatorEmail);
                          }
                        }}
                        disabled={!validatorEmail || isAddingValidator}
                      >
                        {isAddingValidator ? (
                          <span className="spinner-border spinner-border-sm" />
                        ) : (
                          <UserPlus size={16} />
                        )}
                      </button>
                    </div>
                    
                    {validators && validators.length > 0 && (
                      <div className="list-group">
                        {validators.map((validator: any) => (
                          <div key={validator.id} className="list-group-item d-flex justify-content-between align-items-center">
                            <small>{validator.email}</small>
                            <button
                              className="btn btn-sm btn-outline-danger"
                              onClick={() => removeValidatorMutation.mutate(validator.id)}
                            >
                              <X size={14} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {(!validators || validators.length === 0) && (
                      <div className="text-muted small">
                        No delegated validators added yet
                      </div>
                    )}
                  </div>
                  
                  {/* Validated Tickets Section */}
                  <div className="mt-4">
                    <ValidatedTicketsList 
                      eventId={id!} 
                      isEventOwner={isOwner} 
                    />
                  </div>
                </div>
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

      {/* Boost Event Modal */}
      {isOwner && (
        <>
          <BoostEventModal 
            eventId={id!}
            open={isBoostModalOpen}
            onOpenChange={setIsBoostModalOpen}
          />
        </>
      )}
    </div>
  );
}