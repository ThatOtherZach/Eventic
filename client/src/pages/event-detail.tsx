import { useState, useEffect } from "react";
import { useParams, Link, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Calendar, MapPin, Clock, Ticket, Edit, ArrowLeft, CalendarPlus, Download, Eye, UserPlus, X, Star, RotateCcw, Award, Gift, Shield, HelpCircle, AlertTriangle } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useNotifications } from "@/hooks/use-notifications";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { format } from "date-fns";
import { downloadICalendar, addToGoogleCalendar } from "@/lib/calendar-utils";
import { BoostEventModal } from "@/components/boost/boost-event-modal";
import { ValidatedTicketsList } from "@/components/validated-tickets-list";
import ticketIcon from "@assets/image_1756532232153.png";
import ownerIcon from "@assets/image_1756532723922.png";
import calendarIcon from "@assets/image_1756578631464.png";
import googleCalendarIcon from "@assets/calendar-3_1756578696542.png";
import globeIcon from "@assets/image_1756578828379.png";
import dateIcon from "@assets/image_1756751150943.png";
import locationIcon from "@assets/globe_map-5_1756751517694.png";
import clockIcon from "@assets/clock-1_1756752706835.png";
import { LocationPicker } from "@/components/location-picker";
import type { Event, Ticket as TicketType } from "@shared/schema";

interface EventWithStats extends Event {
  ticketsSold: number;
  ticketsAvailable: number | null;
  currentPrice: number;
  resaleCount?: number;
  isAdminCreated: boolean | null;
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

  const { data: organizerDetails } = useQuery<{ id: string; displayName: string; type: string }>({
    queryKey: [`/api/users/${event?.userId}`],
    enabled: !!event?.userId,
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/users/${event?.userId}`);
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

  // Initialize Bootstrap tooltips
  useEffect(() => {
    const tooltipTriggerList = document.querySelectorAll('[data-bs-toggle="tooltip"]');
    const tooltipList = Array.from(tooltipTriggerList).map(tooltipTriggerEl => {
      if ((window as any).bootstrap && (window as any).bootstrap.Tooltip) {
        return new (window as any).bootstrap.Tooltip(tooltipTriggerEl);
      }
      return null;
    });

    // Cleanup tooltips on unmount
    return () => {
      tooltipList.forEach(tooltip => {
        if (tooltip && tooltip.dispose) {
          tooltip.dispose();
        }
      });
    };
  }, [event]); // Re-initialize when event data changes

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
        title: "Ticket Returned",
        description: "Your ticket has been returned and is now available for others.",
      });
      // Refresh tickets and event data
      queryClient.invalidateQueries({ queryKey: [`/api/events/${id}/user-tickets`] });
      queryClient.invalidateQueries({ queryKey: [`/api/events/${id}`] });
    },
    onError: (error: any) => {
      // Extract the actual error message from the formatted error
      let errorMessage = "Unable to return ticket";
      
      if (error.message) {
        // Error format is "400: {"message":"Actual error message"}"
        const match = error.message.match(/\d{3}:\s*({.*})/);
        if (match) {
          try {
            const errorData = JSON.parse(match[1]);
            errorMessage = errorData.message || errorMessage;
          } catch {
            // If JSON parsing fails, try to extract plain text after status code
            const textMatch = error.message.match(/\d{3}:\s*(.+)/);
            if (textMatch) {
              errorMessage = textMatch[1];
            }
          }
        } else {
          errorMessage = error.message;
        }
      }
      
      toast({
        title: "Return Failed",
        description: errorMessage,
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
    // Parse date components to avoid timezone issues
    const [year, month, day] = event.date.split('-').map(Number);
    const [hours, minutes] = event.time.split(':').map(Number);
    const eventStartTime = new Date(year, month - 1, day, hours, minutes, 0);
    const now = new Date();
    const hoursUntilEvent = (eventStartTime.getTime() - now.getTime()) / (1000 * 60 * 60);
    
    return hoursUntilEvent >= 1;
  };

  const handleResell = async (ticketId: string) => {
    resellTicketMutation.mutate(ticketId);
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
    // Check if it's an authentication error for a private event
    const errorMessage = (error as any)?.message || '';
    const isAuthError = errorMessage.includes('Authentication required') || 
                        errorMessage.includes('private event');
    
    if (isAuthError && !user) {
      return (
        <div className="container py-5">
          <div className="alert alert-warning">
            <Shield size={24} className="me-2" />
            This is a private event. Please sign in to view it.
          </div>
          <div className="mt-3">
            <Link href={`/auth?redirect=/events/${id}`} className="btn btn-primary me-2">
              Sign In to View Event
            </Link>
            <Link href="/events" className="btn btn-outline-secondary">
              <ArrowLeft size={18} className="me-2" />
              Back to Events
            </Link>
          </div>
        </div>
      );
    }
    
    // This case shouldn't happen anymore since authenticated users can view private events
    // But keeping it as a fallback just in case
    if (isAuthError && user) {
      return (
        <div className="container py-5">
          <div className="alert alert-warning">
            <Shield size={24} className="me-2" />
            There was an issue accessing this private event. Please try refreshing the page.
          </div>
          <Link href="/events" className="btn btn-primary">
            <ArrowLeft size={18} className="me-2" />
            Back to Events
          </Link>
        </div>
      );
    }
    
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
        // Parse date components to avoid timezone issues
        const [endYear, endMonth, endDay] = event.endDate.split('-').map(Number);
        const endDate = new Date(endYear, endMonth - 1, endDay);
        if (!isNaN(endDate.getTime())) {
          // Set end date to end of day for comparison
          endDate.setHours(23, 59, 59, 999);
          return now > endDate;
        }
      } catch {
        // If end date parsing fails, fall back to start date
      }
    }
    
    // Otherwise use start date to determine if event has ended
    if (eventDate) {
      // For single-day events, consider them past after the end of the event day
      const endOfEventDay = new Date(eventDate);
      endOfEventDay.setHours(23, 59, 59, 999);
      return now > endOfEventDay;
    }
    
    return false;
  })();
  
  // Calculate days until deletion (69 days after event ends)
  const daysUntilDeletion = (() => {
    if (!isEventPast) return null;
    
    const now = new Date();
    let eventEndDate: Date | null = null;
    
    // Use end date if available, otherwise use start date
    if (event.endDate) {
      try {
        const [endYear, endMonth, endDay] = event.endDate.split('-').map(Number);
        eventEndDate = new Date(endYear, endMonth - 1, endDay);
      } catch {
        // Fall back to start date
      }
    }
    
    if (!eventEndDate && eventDate) {
      eventEndDate = eventDate;
    }
    
    if (!eventEndDate) return null;
    
    // Calculate deletion date (69 days after event end)
    const deletionDate = new Date(eventEndDate);
    deletionDate.setDate(deletionDate.getDate() + 69);
    
    // Calculate days remaining
    const msPerDay = 24 * 60 * 60 * 1000;
    const daysRemaining = Math.ceil((deletionDate.getTime() - now.getTime()) / msPerDay);
    
    return daysRemaining > 0 ? daysRemaining : 0;
  })();
  
  const isSoldOut = event.ticketsAvailable === 0;
  const isOwner = user && event.userId === user.id;
  const isAdmin = user?.email?.endsWith("@saymservices.com");
  const canEdit = isOwner || isAdmin;

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

          {/* Event Settings Display - Badges above title */}
          {(event.isAdminCreated || event.goldenTicketEnabled || event.specialEffectsEnabled || event.surgePricing || 
            event.recurringType || event.stickerUrl || event.p2pValidation || event.allowMinting || 
            event.geofence || event.enableVoting) && (
            <div className="d-flex flex-wrap gap-2 mb-2">
              {event.isAdminCreated && (
                <Link href="/type/mission">
                  <span className="badge" style={{ backgroundColor: '#DC2626', color: '#fff', cursor: 'pointer' }}>
                    Mission
                  </span>
                </Link>
              )}
              {event.goldenTicketEnabled && (
                <Link href="/type/golden">
                  <span className="badge" style={{ backgroundColor: '#FFD700', color: '#000', cursor: 'pointer' }}>
                    Golden Tickets
                  </span>
                </Link>
              )}
              {event.specialEffectsEnabled && (
                <Link href="/type/effects">
                  <span className="badge" style={{ backgroundColor: '#9333EA', color: '#fff', cursor: 'pointer' }}>
                    Special Effects
                  </span>
                </Link>
              )}
              {event.surgePricing && (
                <Link href="/type/surge">
                  <span className="badge" style={{ backgroundColor: '#DC2626', color: '#fff', cursor: 'pointer' }}>
                    Surge
                  </span>
                </Link>
              )}
              {event.stickerUrl && (
                <Link href="/type/stickers">
                  <span className="badge" style={{ backgroundColor: '#EC4899', color: '#fff', cursor: 'pointer' }}>
                    Custom Stickers ({event.stickerOdds || 50}%)
                  </span>
                </Link>
              )}
              {event.p2pValidation && (
                <Link href="/type/p2p">
                  <span className="badge" style={{ backgroundColor: '#3B82F6', color: '#fff', cursor: 'pointer' }}>
                    P2P Validation
                  </span>
                </Link>
              )}
              {event.allowMinting && (
                <Link href="/type/collectable">
                  <span className="badge" style={{ backgroundColor: '#000000', color: '#fff', cursor: 'pointer' }}>
                    Collectable
                  </span>
                </Link>
              )}
              {event.geofence && (
                <Link href="/type/geofence">
                  <span className="badge" style={{ backgroundColor: '#F59E0B', color: '#fff', cursor: 'pointer' }}>
                    Location Lock
                  </span>
                </Link>
              )}
              {event.enableVoting && (
                <Link href="/type/vote">
                  <span className="badge" style={{ backgroundColor: '#EAB308', color: '#fff', cursor: 'pointer' }}>
                    Vote
                  </span>
                </Link>
              )}
              {event.recurringType && (
                <Link href="/type/recurring">
                  <span className="badge" style={{ backgroundColor: '#059669', color: '#fff', cursor: 'pointer' }}>
                    {event.recurringType === 'weekly' && 'Weekly Recurring'}
                    {event.recurringType === 'monthly' && 'Monthly Recurring'}
                    {event.recurringType === 'annually' && 'Annual Recurring'}
                  </span>
                </Link>
              )}
            </div>
          )}

          <h1 className="mb-3">{event.name}</h1>

          <div className="mb-4">
            <div className="d-flex align-items-center text-muted mb-2">
              <img src={dateIcon} alt="" style={{ width: '18px', height: '18px', marginRight: '8px' }} />
              <span>
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
              </span>
            </div>
            <div className="d-flex align-items-center text-muted mb-2">
              <img src={clockIcon} alt="" style={{ width: '18px', height: '18px', marginRight: '8px' }} />
              <span>
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
              </span>
            </div>
            <div className="d-flex align-items-center text-muted">
              <img src={locationIcon} alt="" style={{ width: '18px', height: '18px', marginRight: '8px' }} />
              {(() => {
                // Parse venue to extract city
                const venueParts = event.venue.split(',').map(part => part.trim());
                
                if (venueParts.length === 1) {
                  // Single location name (e.g., "Vancouver")
                  const location = venueParts[0];
                  return (
                    <Link href={`/${encodeURIComponent(location.replace(/\s+/g, ''))}`}>
                      <a className="text-primary" style={{ textDecoration: 'underline', cursor: 'pointer' }}>
                        {location}
                      </a>
                    </Link>
                  );
                } else if (venueParts.length >= 2) {
                  // Multi-part venue (e.g., "address, city, country")
                  const cityIndex = venueParts.length >= 3 ? venueParts.length - 2 : venueParts.length - 1;
                  const city = venueParts[cityIndex];
                  
                  return (
                    <span>
                      {venueParts.map((part, index) => (
                        <span key={index}>
                          {index === cityIndex ? (
                            <Link href={`/${encodeURIComponent(city.replace(/\s+/g, ''))}`}>
                              <a className="text-primary" style={{ textDecoration: 'underline', cursor: 'pointer' }}>
                                {part}
                              </a>
                            </Link>
                          ) : (
                            part
                          )}
                          {index < venueParts.length - 1 && ', '}
                        </span>
                      ))}
                    </span>
                  );
                }
                // Fallback - shouldn't reach here
                return event.venue;
              })()}
            </div>
          </div>

          {/* Deletion countdown - Only shown for past events */}
          {daysUntilDeletion !== null && (
            <div className="d-flex align-items-center mb-4 text-danger">
              <AlertTriangle size={18} className="me-2" />
              <span>
                {daysUntilDeletion} days until deletion
                {daysUntilDeletion <= 7 && (
                  <span className="ms-1">- data will be permanently removed soon</span>
                )}
              </span>
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
                dangerouslySetInnerHTML={{ 
                  __html: event.description.replace(
                    /#([a-zA-Z0-9_]+)/g, 
                    '<a href="/hashtag/$1" class="text-decoration-none">#$1</a>'
                  )
                }}
              />
            </div>
          )}

          {/* Calendar and Location Buttons - Only for signed-in users */}
          {user && (
            <div className="mb-4">
              <div className="d-flex gap-2 flex-wrap">
              <button
                className="btn btn-sm btn-outline-danger"
                onClick={() => downloadICalendar(event)}
                data-testid="button-icalendar"
              >
                <img src={calendarIcon} alt="" style={{ width: '14px', height: '14px', marginRight: '4px' }} />
                iCalendar (.ics)
              </button>
              <button
                className="btn btn-sm btn-outline-danger"
                onClick={() => addToGoogleCalendar(event)}
                data-testid="button-google-calendar"
              >
                <img src={googleCalendarIcon} alt="" style={{ width: '14px', height: '14px', marginRight: '4px' }} />
                Google Calendar
              </button>
              <button
                className="btn btn-sm btn-outline-danger"
                onClick={() => {
                  let searchQuery = '';
                  
                  // Use GPS coordinates if available
                  if (event.latitude && event.longitude) {
                    searchQuery = `${event.latitude},${event.longitude}`;
                  } else {
                    // Fall back to city and country from venue
                    const venueParts = event.venue.split(',').map(part => part.trim());
                    if (venueParts.length >= 2) {
                      // If venue has multiple parts, use the last two (likely city and country)
                      searchQuery = encodeURIComponent(venueParts.slice(-2).join(', '));
                    } else if (event.country) {
                      // If we have a country field, combine venue with country
                      searchQuery = encodeURIComponent(`${event.venue}, ${event.country}`);
                    } else {
                      // Last resort: use the full venue string
                      searchQuery = encodeURIComponent(event.venue);
                    }
                  }
                  
                  window.open(`https://www.google.com/maps/search/?api=1&query=${searchQuery}`, '_blank');
                }}
                data-testid="button-search-location"
              >
                <img src={globeIcon} alt="" style={{ width: '14px', height: '14px', marginRight: '4px' }} />
                Find Location
              </button>
              </div>
            </div>
          )}

          {/* Venue Location Map - Only for signed-in users */}
          {user && event.latitude && event.longitude && (
            <div className="mb-4">
              <h5>Map</h5>
              <LocationPicker
                latitude={Number(event.latitude)}
                longitude={Number(event.longitude)}
                readOnly={true}
                height="300px"
              />
            </div>
          )}

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
                    <div key={ticket.id} className="list-group-item">
                      <div className="mb-2">
                        <span className="badge bg-primary">{ticket.ticketNumber}</span>
                      </div>
                      <div className="d-flex justify-content-between align-items-center mb-2">
                        {ticket.isValidated ? (
                          <>
                            <div>
                              <span className="badge bg-success me-2">Used</span>
                              {(ticket as any).resellStatus === "for_resale" && (
                                <span className="badge bg-warning text-dark">Returned</span>
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
                                  Return
                                </button>
                              )}
                            </div>
                          </>
                        ) : (
                          <>
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
                                  Return
                                </button>
                              )}
                            </div>
                            <div>
                              {(ticket as any).resellStatus === "for_resale" && (
                                <span className="badge bg-warning text-dark">Returned</span>
                              )}
                            </div>
                          </>
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
          
          {/* Validated Tickets Section - moved here from right column */}
          <div className="card mb-4">
            <div className="card-body">
              <ValidatedTicketsList 
                eventId={id!} 
                isEventOwner={!!isOwner}
                enableVoting={event.enableVoting ?? false}
              />
            </div>
          </div>
        </div>

        <div className="col-lg-4">
          <div className="card sticky-top" style={{ top: '80px' }}>
            <div className="card-body">
              <h5 className="card-title">Ticket Information</h5>
              
              {/* Organizer Details */}
              {(organizerDetails || organizerReputation) && (
                <div className="mb-3 p-3 bg-light rounded">
                  {organizerDetails && (
                    <div className="mb-2">
                      <div className="text-muted small">Event Organizer</div>
                      <div className="mt-1">
                        <strong>{organizerDetails.displayName}</strong>
                      </div>
                      <div className="d-flex align-items-center mt-1">
                        <span className="badge bg-secondary small me-2" style={{ textTransform: 'capitalize' }}>{organizerDetails.type}</span>
                        {organizerReputation && (() => {
                          const reputationInfo = getReputationDisplay();
                          if (!reputationInfo) return null;
                          
                          const { badge, showPercentage, percentage, totalVotes } = reputationInfo;
                          const formattedVotes = formatVoteCount(totalVotes);
                          
                          return (
                            <>
                              {badge ? (
                                <span className="badge bg-secondary">{badge}</span>
                              ) : showPercentage ? (
                                <>
                                  <strong>{percentage}%</strong>
                                  <span className="text-muted small ms-2" style={{ fontSize: '0.85em' }}>({formattedVotes} votes)</span>
                                </>
                              ) : null}
                              {totalVotes >= 1000 && (
                                <span className="badge bg-warning text-dark ms-2">
                                  <Award size={14} className="me-1" />
                                  Bestie
                                </span>
                              )}
                            </>
                          );
                        })()}
                      </div>
                    </div>
                  )}
                </div>
              )}
              
              <div className="mb-3">
                <div className="d-flex justify-content-between mb-2">
                  <span>Price:</span>
                  {event.ticketsAvailable === 0 ? (
                    <span className="badge bg-danger text-white">Sold Out</span>
                  ) : (
                    <strong>
                      {event.currentPrice === 0 ? 'Free' : `$${event.currentPrice.toFixed(2)}`}
                      {event.surgePricing && event.currentPrice !== parseFloat(event.ticketPrice) && (
                        <small className="text-muted ms-2">
                          ({(() => {
                            const basePrice = parseFloat(event.ticketPrice);
                            const increase = event.currentPrice - basePrice;
                            const increasePercent = Math.round((increase / basePrice) * 100);
                            return `+${increasePercent}%`;
                          })()})
                        </small>
                      )}
                    </strong>
                  )}
                </div>
                
                {event.surgePricing && event.currentPrice !== parseFloat(event.ticketPrice) && (
                  <div className="text-end" style={{ paddingBottom: '10px' }}>
                    <span className="badge bg-danger">Surge Activated</span>
                  </div>
                )}
                
                {event.ticketsAvailable !== null && (
                  <div className="alert alert-info">
                    <small>
                      {isSoldOut ? (
                        "This event is sold out"
                      ) : (
                        <>
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
                          <div className="d-flex align-items-center">
                            <img src={ticketIcon} alt="" style={{ width: '32px', height: '32px', marginRight: '8px' }} />
                            <div>
                              <div className="d-flex align-items-center">
                                <span className="fw-bold">{event.ticketsAvailable}</span>&nbsp;Remaining
                                <HelpCircle 
                                  className="ms-1 text-muted" 
                                  size={12}
                                  data-bs-toggle="tooltip"
                                  data-bs-placement="top"
                                  data-bs-title="Number of tickets still available for purchase directly from the event"
                                  style={{ cursor: 'help' }}
                                />
                              </div>
                              <div className="mt-1 d-flex align-items-center">
                                <span className="fw-bold">{event.resaleCount || 0}</span>&nbsp;Available
                                <HelpCircle 
                                  className="ms-1 text-muted" 
                                  size={12}
                                  data-bs-toggle="tooltip"
                                  data-bs-placement="top"
                                  data-bs-title="Number of tickets being resold by other attendees at original price"
                                  style={{ cursor: 'help' }}
                                />
                              </div>
                            </div>
                          </div>
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
                disabled={isSoldOut || isPurchasing || isEventPast || !(event?.ticketPurchasesEnabled ?? true) || ((event?.oneTicketPerUser ?? false) && userTickets && userTickets.length > 0)}
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
                ) : (event?.oneTicketPerUser && userTickets && userTickets.length > 0) ? (
                  "Already Have Ticket"
                ) : (
                  <>
                    <img src="/ticket-icon.png" alt="" style={{ width: '18px', height: '18px', marginRight: '8px' }} />
                    {event.currentPrice === 0 ? "Get Ticket" : "Buy Ticket"}
                  </>
                )}
              </button>
              
              {/* Boost Button for event owners and ticket holders - not shown for private events */}
              {!event.isPrivate && (isOwner || (userTickets && userTickets.length > 0)) && (
                <button 
                  onClick={() => setIsBoostModalOpen(true)}
                  className="btn btn-warning w-100 mb-3"
                  data-testid="button-boost-event"
                  style={{ padding: '0.375rem 0.75rem', fontSize: '1rem', lineHeight: '1.5' }}
                >
                  <img src="/boost-icon.png" alt="" style={{ width: '18px', height: '18px', marginRight: '8px', verticalAlign: 'text-bottom' }} />
                  Boost
                </button>
              )}
              
              {/* Show message if ticket sales are disabled */}
              {!event?.ticketPurchasesEnabled && !isEventPast && !isSoldOut && (
                <div className="alert alert-warning mb-3">
                  <small>
                    <strong>This event has been suspended by administrators.</strong><br />
                    {event.resaleCount && event.resaleCount > 0 && (
                      <>Existing ticket holders can still return tickets - {event.resaleCount} {event.resaleCount === 1 ? 'ticket is' : 'tickets are'} available.</>
                    )}
                  </small>
                </div>
              )}

              {canEdit && (
                <div>
                  <Link href={`/events/${id}/edit`} className="btn btn-secondary w-100 mb-2">
                    <img src="/edit-icon.png" alt="" style={{ width: '18px', height: '18px', marginRight: '8px' }} />
                    Edit Event
                  </Link>
                  <div className="alert alert-info mt-3">
                    <small className="d-flex align-items-center">
                      <img src={ownerIcon} alt="" style={{ width: '32px', height: '32px', marginRight: '8px' }} />
                      {isOwner ? "You own this event" : "Admin: You can edit this event"}
                    </small>
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

      {/* Boost Event Modal - not shown for private events */}
      {!event.isPrivate && (isOwner || (userTickets && userTickets.length > 0)) && (
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