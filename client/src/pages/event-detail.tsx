import { useState, useEffect, useRef } from "react";
import { useParams, Link, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import QRCode from "qrcode";
import {
  Calendar,
  MapPin,
  Clock,
  Ticket,
  Edit,
  ArrowLeft,
  CalendarPlus,
  Download,
  Eye,
  UserPlus,
  X,
  Star,
  RotateCcw,
  Award,
  Gift,
  Shield,
  HelpCircle,
  AlertTriangle,
  Globe,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useNotifications } from "@/hooks/use-notifications";
import { useSEO } from "@/hooks/use-seo";
import { formatDescription } from "@/lib/text-formatter";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
import goldenTicketIcon from "@assets/world_star-0_1756849251180.png";
import specialEffectsIcon from "@assets/image_1756849316138.png";
import certificateIcon from "@assets/briefcase-4_1756934281378.png";
import gpsIcon from "@assets/gps-1_1756849430189.png";
import checkIcon from "@assets/check-0_1756849706987.png";
import usersIcon from "@assets/users_green-4_1756849357200.png";
import chartIcon from "@assets/chart1-4_1756850194937.png";
import calendarBadgeIcon from "@assets/calendar-0_1756849638733.png";
import missionIcon from "@assets/internet_connection_wiz-2_1756934046026.png";
import mediaPlayerIcon from "@assets/wm-4_1756934119811.png";
import charmapIcon from "@assets/charmap_w2k-0_1756934317788.png";
import netmeetingIcon from "@assets/netmeeting-2_1756934362133.png";
import worldIcon from "@assets/world-2_1756934408907.png";
import timeAndDateIcon from "@assets/time_and_date-4_1756934474067.png";
import surgeClockIcon from "@assets/clock-1_1756934533905.png";
import goldenSmileyIcon from "@assets/utopia_smiley_1756934700538.png";
import voteIcon from "@assets/image_1756934773951.png";
import rsvpIcon from "@assets/printer-0_1756935612816.png";
import userWorldIcon from "@assets/user_world-1_1756936174601.png";
import deletionWarningIcon from "@assets/image_1756936869495.png";
import expandIcon from "@assets/image_1756959756931.png";
import huntIcon from "@assets/image_1756971767387.png";
import p2pValidationIcon from "@assets/address_book_users_1757234713487.png";
import multipleTicketsIcon from "@assets/certificate_multiple-1_1757234773120.png";
import singleTicketIcon from "@assets/certificate_seal_1757234773120.png";
import type { Event, Ticket as TicketType } from "@shared/schema";

interface EventWithStats extends Event {
  ticketsSold: number;
  ticketsAvailable: number | null;
  currentPrice: number;
  resaleCount?: number;
  isAdminCreated: boolean | null;
}

export default function EventDetailPage() {
  const { id, shortcode } = useParams<{ id?: string; shortcode?: string }>();
  const eventId = id || shortcode;
  const { user } = useAuth();
  const { toast } = useToast();
  const { addNotification } = useNotifications();
  const [, setLocation] = useLocation();
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [validatorEmail, setValidatorEmail] = useState("");
  const [isAddingValidator, setIsAddingValidator] = useState(false);
  const [ticketsDisplayed, setTicketsDisplayed] = useState(10);
  const [isBoostModalOpen, setIsBoostModalOpen] = useState(false);
  const [isExpanding, setIsExpanding] = useState(false);
  const [eventQrCode, setEventQrCode] = useState<string>("");
  const qrCanvasRef = useRef<HTMLCanvasElement>(null);

  const {
    data: event,
    isLoading,
    error,
  } = useQuery<EventWithStats>({
    queryKey: [`/api/events/${eventId}`],
    enabled: !!eventId,
  });

  const { data: userTickets } = useQuery<TicketType[]>({
    queryKey: [`/api/events/${eventId}/user-tickets`],
    enabled: !!eventId && !!user,
    queryFn: async () => {
      const response = await apiRequest(
        "GET",
        `/api/events/${eventId}/user-tickets`,
      );
      return response.json();
    },
  });

  const { data: validators } = useQuery<any[]>({
    queryKey: [`/api/events/${eventId}/validators`],
    enabled: !!eventId && !!user && event?.userId === user.id,
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/events/${eventId}/validators`);
      return response.json();
    },
  });

  const { data: organizerReputation } = useQuery<{
    thumbsUp: number;
    thumbsDown: number;
    percentage: number | null;
  }>({
    queryKey: [`/api/users/${event?.userId}/reputation`],
    enabled: !!event?.userId,
    queryFn: async () => {
      const response = await apiRequest(
        "GET",
        `/api/users/${event?.userId}/reputation`,
      );
      return response.json();
    },
  });

  const { data: organizerDetails } = useQuery<{
    id: string;
    displayName: string;
    type: string;
  }>({
    queryKey: [`/api/users/${event?.userId}`],
    enabled: !!event?.userId,
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/users/${event?.userId}`);
      return response.json();
    },
  });

  const { data: organizerValidations } = useQuery<{ validatedCount: number }>({
    queryKey: [`/api/users/${event?.userId}/validated-count`],
    enabled: !!event?.userId,
    queryFn: async () => {
      const response = await apiRequest(
        "GET",
        `/api/users/${event?.userId}/validated-count`,
      );
      return response.json();
    },
  });

  // Generate QR code for short event URL
  useEffect(() => {
    if (event?.id) {
      const shortcode = event.id.substring(0, 8);
      const shortUrl = `https://eventic.quest/e/${shortcode}`;
      
      // Generate QR code as data URL
      QRCode.toDataURL(shortUrl, {
        width: 200,
        margin: 1,
        color: {
          dark: "#000000",
          light: "#FFFFFF",
        },
      }).then((url) => {
        setEventQrCode(url);
      }).catch((err) => {
        console.error("Error generating QR code:", err);
      });
    }
  }, [event?.id]);

  // Query for user's credit balance
  const { data: userBalance } = useQuery<{ balance: string }>({
    queryKey: [`/api/currency/balance`],
    enabled: !!user && event?.userId === user?.id,
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/currency/balance`);
      return response.json();
    },
  });

  // Set dynamic SEO based on event data
  const eventDescription = event?.description
    ? event.description.replace(/<[^>]*>/g, "").substring(0, 160) +
      (event.description.length > 160 ? "..." : "")
    : event ? `Join us for ${event.name} at ${event.venue} on ${event.date}. Get your tickets now!` : "";

  useSEO({
    title: event?.name || "Event Details",
    description: eventDescription || "View event details, get tickets, and find venue information.",
    ogTitle: event?.name,
    ogDescription: eventDescription,
    ogImage: event?.imageUrl,
    ogUrl: typeof window !== "undefined" ? window.location.href : undefined,
    keywords: event ? `${event.name}, event tickets, ${event.venue}, ${event.date}` : "event, tickets, venue"
  });

  // Initialize Bootstrap tooltips
  useEffect(() => {
    const tooltipTriggerList = document.querySelectorAll(
      '[data-bs-toggle="tooltip"]',
    );
    const tooltipList = Array.from(tooltipTriggerList).map(
      (tooltipTriggerEl) => {
        if ((window as any).bootstrap && (window as any).bootstrap.Tooltip) {
          return new (window as any).bootstrap.Tooltip(tooltipTriggerEl);
        }
        return null;
      },
    );

    // Cleanup tooltips on unmount
    return () => {
      tooltipList.forEach((tooltip) => {
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
      queryClient.invalidateQueries({
        queryKey: [`/api/events/${id}/validators`],
      });
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
      return apiRequest(
        "DELETE",
        `/api/events/${id}/validators/${validatorId}`,
        {},
      );
    },
    onSuccess: () => {
      toast({
        title: "Success!",
        description: "Validator removed successfully",
      });
      queryClient.invalidateQueries({
        queryKey: [`/api/events/${id}/validators`],
      });
    },
    onError: (error: any) => {
      addNotification({
        type: "error",
        title: "Error",
        description: error.message || "Failed to remove validator",
      });
    },
  });

  const expandTicketsMutation = useMutation({
    mutationFn: async () => {
      if (!user) {
        throw new Error("Please sign in to expand tickets");
      }
      return apiRequest("POST", `/api/events/${id}/expand`, {});
    },
    onSuccess: () => {
      addNotification({
        type: "success",
        title: "Tickets Expanded",
        description: "5 additional tickets have been added to your event",
      });
      // Refresh event data and user balance
      queryClient.invalidateQueries({ queryKey: [`/api/events/${id}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/currency/balance`] });
      setIsExpanding(false);
    },
    onError: (error: any) => {
      addNotification({
        type: "error",
        title: "Expansion Failed",
        description: error.message || "Failed to expand tickets",
      });
      setIsExpanding(false);
    },
  });

  const resellTicketMutation = useMutation({
    mutationFn: async (ticketId: string) => {
      const response = await apiRequest(
        "POST",
        `/api/tickets/${ticketId}/resell`,
        {},
      );
      return { ...(await response.json()), ticketId };
    },
    onSuccess: (data) => {
      // Refresh tickets and event data
      queryClient.invalidateQueries({
        queryKey: [`/api/events/${id}/user-tickets`],
      });
      queryClient.invalidateQueries({ queryKey: [`/api/events/${id}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
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
      queryClient.invalidateQueries({
        queryKey: [`/api/events/${id}/user-tickets`],
      });
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
          description:
            "You've reached the maximum number of purchase attempts. Please wait a moment before trying again.",
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
    const [year, month, day] = event.date.split("-").map(Number);
    const [hours, minutes] = event.time.split(":").map(Number);
    const eventStartTime = new Date(year, month - 1, day, hours, minutes, 0);
    const now = new Date();
    const hoursUntilEvent =
      (eventStartTime.getTime() - now.getTime()) / (1000 * 60 * 60);

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
        description: "Please sign in to RVSP",
      });
      setLocation("/auth");
      return;
    }
    setIsPurchasing(true);
    purchaseTicketMutation.mutate();
  };

  const handleExpandTickets = () => {
    setIsExpanding(true);
    expandTicketsMutation.mutate();
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

    if (totalVotes === 0 || percentage === null) {
      return { badge: "NPC", showPercentage: false, totalVotes };
    } else if (percentage >= 1 && percentage <= 49) {
      return { badge: "Interesting", showPercentage: false, totalVotes };
    } else if (percentage >= 50 && percentage <= 79) {
      return { badge: "Nice", showPercentage: false, totalVotes };
    } else if (percentage >= 80) {
      return { badge: "😎", showPercentage: false, totalVotes };
    } else {
      return { badge: "NPC", showPercentage: false, totalVotes };
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
    const errorMessage = (error as any)?.message || "";
    const isAuthError =
      errorMessage.includes("Authentication required") ||
      errorMessage.includes("private event");

    if (isAuthError && !user) {
      return (
        <div className="container py-5">
          <div className="alert alert-warning">
            <Shield size={24} className="me-2" />
            This is a private event. Please sign in to view it.
          </div>
          <div className="mt-3">
            <Link
              href={`/auth?redirect=/events/${id}`}
              className="btn btn-primary me-2"
            >
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
            There was an issue accessing this private event. Please try
            refreshing the page.
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

  const eventDate = event.date
    ? (() => {
        try {
          // Parse the date components to avoid timezone issues
          const [year, month, day] = event.date.split("-").map(Number);
          // Create date in local timezone by specifying components
          const date = new Date(year, month - 1, day);
          return isNaN(date.getTime()) ? null : date;
        } catch {
          return null;
        }
      })()
    : null;

  // Check if event has passed based on either start date or end date
  const isEventPast = (() => {
    const now = new Date();

    // If there's an end date, use it to determine if event is past
    if (event.endDate) {
      try {
        // Parse date components to avoid timezone issues
        const [endYear, endMonth, endDay] = event.endDate
          .split("-")
          .map(Number);
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
        const [endYear, endMonth, endDay] = event.endDate
          .split("-")
          .map(Number);
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
    const daysRemaining = Math.ceil(
      (deletionDate.getTime() - now.getTime()) / msPerDay,
    );

    return daysRemaining > 0 ? daysRemaining : 0;
  })();

  const isSoldOut = event.ticketsAvailable === 0;
  const isOwner = user && event.userId === user.id;
  const isAdmin = user?.email?.endsWith("@saymservices.com");

  // Calculate if event has started using date and time
  const eventHasStarted = (() => {
    if (!event.date || !event.time) return false;
    const [year, month, day] = event.date.split("-").map(Number);
    const [hours, minutes] = event.time.split(":").map(Number);
    const eventStartTime = new Date(year, month - 1, day, hours, minutes);
    return eventStartTime <= new Date();
  })();

  const canEdit = isAdmin || (isOwner && !eventHasStarted);

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
                style={{
                  width: "100%",
                  maxHeight: "400px",
                  objectFit: "cover",
                }}
              />
            </div>
          )}

          {/* Event Settings Display - Retro badges with icons */}
          {(event.isAdminCreated ||
            event.goldenTicketEnabled ||
            event.specialEffectsEnabled ||
            event.surgePricing ||
            event.recurringType ||
            event.stickerUrl ||
            event.p2pValidation ||
            event.allowMinting ||
            event.geofence ||
            event.enableVoting) && (
            <div className="d-flex flex-wrap gap-2 mb-2">
              {event.isAdminCreated && (
                <Link href="/type/mission">
                  <span
                    className="badge"
                    style={{
                      backgroundColor: "#DC2626",
                      color: "#fff",
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                    }}
                  >
                    <img
                      src={missionIcon}
                      alt=""
                      style={{ width: "14px", height: "14px" }}
                    />
                    Mission
                  </span>
                </Link>
              )}
              {event.goldenTicketEnabled && (
                <Link href="/type/golden">
                  <span
                    className="badge"
                    style={{
                      backgroundColor: "#FFD700",
                      color: "#000",
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                    }}
                  >
                    <img
                      src={goldenSmileyIcon}
                      alt=""
                      style={{ width: "14px", height: "14px" }}
                    />
                    Golden Tickets
                  </span>
                </Link>
              )}
              {event.specialEffectsEnabled && (
                <Link href="/type/effects">
                  <span
                    className="badge"
                    style={{
                      backgroundColor: "#9333EA",
                      color: "#fff",
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                    }}
                  >
                    <img
                      src={mediaPlayerIcon}
                      alt=""
                      style={{ width: "14px", height: "14px" }}
                    />
                    Special Effects
                  </span>
                </Link>
              )}
              {event.surgePricing && (
                <Link href="/type/surge">
                  <span
                    className="badge"
                    style={{
                      backgroundColor: "#DC2626",
                      color: "#fff",
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                    }}
                  >
                    <img
                      src={surgeClockIcon}
                      alt=""
                      style={{ width: "14px", height: "14px" }}
                    />
                    Surge
                  </span>
                </Link>
              )}
              {event.stickerUrl && (
                <Link href="/type/stickers">
                  <span
                    className="badge"
                    style={{
                      backgroundColor: "#EC4899",
                      color: "#fff",
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                    }}
                  >
                    <img
                      src={mediaPlayerIcon}
                      alt=""
                      style={{ width: "14px", height: "14px" }}
                    />
                    Custom Stickers ({event.stickerOdds || 50}%)
                  </span>
                </Link>
              )}
              {event.p2pValidation && (
                <Link href="/type/p2p">
                  <span
                    className="badge"
                    style={{
                      backgroundColor: "#3B82F6",
                      color: "#fff",
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                    }}
                  >
                    <img
                      src={usersIcon}
                      alt=""
                      style={{ width: "14px", height: "14px" }}
                    />
                    P2P Validation
                  </span>
                </Link>
              )}
              {event.allowMinting && (
                <Link href="/type/collectable">
                  <span
                    className="badge"
                    style={{
                      backgroundColor: "#000000",
                      color: "#fff",
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                    }}
                  >
                    <img
                      src={certificateIcon}
                      alt=""
                      style={{ width: "14px", height: "14px" }}
                    />
                    Collectable
                  </span>
                </Link>
              )}
              {event.geofence && (
                <Link href="/type/geofenced">
                  <span
                    className="badge"
                    style={{
                      backgroundColor: "#F59E0B",
                      color: "#fff",
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                    }}
                  >
                    <img
                      src={worldIcon}
                      alt=""
                      style={{ width: "14px", height: "14px" }}
                    />
                    Location Lock
                  </span>
                </Link>
              )}
              {event.treasureHunt && (
                <Link href="/type/hunt">
                  <span
                    className="badge"
                    style={{
                      backgroundColor: "#FF6B35",
                      color: "#fff",
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                    }}
                  >
                    <img
                      src={huntIcon}
                      alt=""
                      style={{ width: "14px", height: "14px" }}
                    />
                    Treasure Hunt
                  </span>
                </Link>
              )}
              {event.enableVoting && (
                <Link href="/type/voting">
                  <span
                    className="badge"
                    style={{
                      backgroundColor: "#EAB308",
                      color: "#fff",
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                    }}
                  >
                    <img
                      src={voteIcon}
                      alt=""
                      style={{ width: "14px", height: "14px" }}
                    />
                    Vote
                  </span>
                </Link>
              )}
              {event.recurringType && (
                <Link href="/type/recurring">
                  <span
                    className="badge"
                    style={{
                      backgroundColor: "#059669",
                      color: "#fff",
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                    }}
                  >
                    <img
                      src={netmeetingIcon}
                      alt=""
                      style={{ width: "14px", height: "14px" }}
                    />
                    {event.recurringType === "weekly" && "Weekly Recurring"}
                    {event.recurringType === "monthly" && "Monthly Recurring"}
                    {(event.recurringType === "annually" || event.recurringType === "annual") && "Annual"}
                  </span>
                </Link>
              )}
              {event.maxTickets && (
                <Link href="/type/limited">
                  <span
                    className="badge"
                    style={{
                      backgroundColor: "#14B8A6",
                      color: "#fff",
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                    }}
                  >
                    <img
                      src={charmapIcon}
                      alt=""
                      style={{ width: "14px", height: "14px" }}
                    />
                    Limited
                  </span>
                </Link>
              )}
              {event.endDate && event.endDate !== event.date && (
                <Link href="/type/multiday">
                  <span
                    className="badge"
                    style={{
                      backgroundColor: "#6B7280",
                      color: "#fff",
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                    }}
                  >
                    <img
                      src={timeAndDateIcon}
                      alt=""
                      style={{ width: "14px", height: "14px" }}
                    />
                    Multi-day
                  </span>
                </Link>
              )}
              {event.rollingTimezone && (
                <Link href="/type/sync">
                  <span
                    className="badge"
                    style={{
                      backgroundColor: "#0EA5E9",
                      color: "#fff",
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                    }}
                  >
                    <img
                      src="/global-sync-icon.png"
                      alt=""
                      style={{ width: "14px", height: "14px" }}
                    />
                    Global Sync
                  </span>
                </Link>
              )}
            </div>
          )}

          <h1 className="mb-3">{event.name}</h1>

          <div className="mb-4">
            <div className="d-flex align-items-center text-muted mb-2">
              <img
                src={dateIcon}
                alt=""
                style={{ width: "18px", height: "18px", marginRight: "8px" }}
              />
              <span>
                {event.endDate && event.endDate !== event.date ? (
                  <>
                    {eventDate ? format(eventDate, "MMMM d, yyyy") : event.date}{" "}
                    -{" "}
                    {event.endDate && event.endDate !== ""
                      ? (() => {
                          try {
                            // Parse the date components to avoid timezone issues
                            const [year, month, day] = event.endDate
                              .split("-")
                              .map(Number);
                            // Create date in local timezone by specifying components
                            const endDate = new Date(year, month - 1, day);
                            return isNaN(endDate.getTime())
                              ? "Invalid end date"
                              : format(endDate, "MMMM d, yyyy");
                          } catch {
                            return "Invalid end date";
                          }
                        })()
                      : "No end date"}
                  </>
                ) : eventDate ? (
                  format(eventDate, "MMMM d, yyyy")
                ) : (
                  event.date
                )}
              </span>
            </div>
            {event.recurringType && event.recurringEndDate && (
              <div className="d-flex align-items-center text-muted mb-2">
                <img
                  src="/recurrence-end-icon.png"
                  alt=""
                  style={{ width: "18px", height: "18px", marginRight: "8px" }}
                />
                <span style={{ fontSize: "0.9rem" }}>
                  Ends {(() => {
                    try {
                      const [year, month, day] = event.recurringEndDate.split("-").map(Number);
                      const endDate = new Date(year, month - 1, day);
                      return isNaN(endDate.getTime())
                        ? event.recurringEndDate
                        : format(endDate, "MMMM d, yyyy");
                    } catch {
                      return event.recurringEndDate;
                    }
                  })()}
                </span>
              </div>
            )}
            <div className="d-flex align-items-center text-muted mb-2">
              <img
                src={clockIcon}
                alt=""
                style={{ width: "18px", height: "18px", marginRight: "8px" }}
              />
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
                    (
                    {(() => {
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
                        UTC: "UTC",
                      };
                      return (
                        tzMap[event.timezone] ||
                        event.timezone.split("/").pop()?.replace(/_/g, " ")
                      );
                    })()}
                    )
                  </span>
                )}
              </span>
            </div>
            <div className="d-flex align-items-center text-muted">
              <img
                src={locationIcon}
                alt=""
                style={{ width: "18px", height: "18px", marginRight: "8px" }}
              />
              {(() => {
                // Parse venue to extract city
                const venueParts = event.venue
                  .split(",")
                  .map((part) => part.trim());

                if (venueParts.length === 1) {
                  // Single location name (e.g., "Vancouver")
                  const location = venueParts[0];
                  return (
                    <Link
                      href={`/${encodeURIComponent(location.replace(/\s+/g, ""))}`}
                    >
                      <a
                        className="text-primary"
                        style={{
                          textDecoration: "underline",
                          cursor: "pointer",
                        }}
                      >
                        {location}
                      </a>
                    </Link>
                  );
                } else if (venueParts.length >= 2) {
                  // Multi-part venue (e.g., "address, city, country")
                  const cityIndex =
                    venueParts.length >= 3
                      ? venueParts.length - 2
                      : venueParts.length - 1;
                  const city = venueParts[cityIndex];

                  return (
                    <span>
                      {venueParts.map((part, index) => (
                        <span key={index}>
                          {index === cityIndex ? (
                            <Link
                              href={`/${encodeURIComponent(city.replace(/\s+/g, ""))}`}
                            >
                              <a
                                className="text-primary"
                                style={{
                                  textDecoration: "underline",
                                  cursor: "pointer",
                                }}
                              >
                                {part}
                              </a>
                            </Link>
                          ) : (
                            part
                          )}
                          {index < venueParts.length - 1 && ", "}
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
              <img
                src={deletionWarningIcon}
                alt=""
                style={{ width: "18px", height: "18px", marginRight: "8px" }}
              />
              <span>
                {daysUntilDeletion} days until deletion
                {daysUntilDeletion <= 7 && (
                  <span className="ms-1">
                    - data will be permanently removed soon
                  </span>
                )}
              </span>
            </div>
          )}

          {/* Contact Details - Only shown to ticket holders */}
          {event.contactDetails && userTickets && userTickets.length > 0 && (
            <div className="mb-4">
              <h5>Contact Details</h5>
              <div className="text-muted">{event.contactDetails}</div>
            </div>
          )}

          {event.description && (
            <div className="mb-4">
              <h5>About This Event</h5>
              <div
                className="text-muted"
                dangerouslySetInnerHTML={{
                  __html: formatDescription(event.description),
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
                  onClick={() => {
                    const eventUrl = `${window.location.origin}/events/${event.id}`;
                    navigator.clipboard.writeText(eventUrl).then(() => {
                      // Optional: Add a toast or some feedback that link was copied
                    });
                  }}
                  data-testid="button-copy-link"
                >
                  <img
                    src="/copy-link-icon.png"
                    alt=""
                    style={{
                      width: "14px",
                      height: "14px",
                      marginRight: "4px",
                    }}
                  />
                  Copy Link
                </button>
                <button
                  className="btn btn-sm btn-outline-danger"
                  onClick={() => downloadICalendar(event)}
                  data-testid="button-icalendar"
                >
                  <img
                    src={calendarIcon}
                    alt=""
                    style={{
                      width: "14px",
                      height: "14px",
                      marginRight: "4px",
                    }}
                  />
                  iCalendar (.ics)
                </button>
                <button
                  className="btn btn-sm btn-outline-danger"
                  onClick={() => addToGoogleCalendar(event)}
                  data-testid="button-google-calendar"
                >
                  <img
                    src={googleCalendarIcon}
                    alt=""
                    style={{
                      width: "14px",
                      height: "14px",
                      marginRight: "4px",
                    }}
                  />
                  Google Calendar
                </button>
                <button
                  className="btn btn-sm btn-outline-danger"
                  onClick={() => {
                    let searchQuery = "";

                    // For Hunt events, never use GPS coordinates - only use general venue info
                    if (
                      event.treasureHunt ||
                      !event.latitude ||
                      !event.longitude
                    ) {
                      // Use city and country from venue
                      const venueParts = event.venue
                        .split(",")
                        .map((part) => part.trim());
                      if (venueParts.length >= 2) {
                        // If venue has multiple parts, use the last two (likely city and country)
                        searchQuery = encodeURIComponent(
                          venueParts.slice(-2).join(", "),
                        );
                      } else if (event.country) {
                        // If we have a country field, combine venue with country
                        searchQuery = encodeURIComponent(
                          `${event.venue}, ${event.country}`,
                        );
                      } else {
                        // Last resort: use the full venue string
                        searchQuery = encodeURIComponent(event.venue);
                      }
                    } else {
                      // For non-Hunt events, use GPS coordinates if available
                      searchQuery = `${event.latitude},${event.longitude}`;
                    }

                    window.open(
                      `https://www.google.com/maps/search/?api=1&query=${searchQuery}`,
                      "_blank",
                    );
                  }}
                  data-testid="button-search-location"
                >
                  <img
                    src={globeIcon}
                    alt=""
                    style={{
                      width: "14px",
                      height: "14px",
                      marginRight: "4px",
                    }}
                  />
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

          {/* Reputation */}
          {(organizerReputation || organizerValidations) && (
            <div
              className="card mb-4"
              style={{
                border: "2px solid #e0e0e0",
                borderRadius: "0",
                boxShadow: "1px 1px 0 rgba(0,0,0,0.05)",
                backgroundColor: "#e9ecef",
              }}
            >
              <div
                className="card-body text-center"
                style={{ padding: "20px" }}
              >
                {/* Username Badge at top */}
                {organizerDetails && (
                  <div className="d-flex justify-content-center mb-3">
                    <span
                      className="badge"
                      style={{
                        backgroundColor: "#f8f9fa",
                        color: "#495057",
                        border: "1px solid #dee2e6",
                        fontSize: "12px",
                        padding: "6px 10px",
                        borderRadius: "0",
                        fontWeight: "500",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                      }}
                    >
                      <img
                        src={userWorldIcon}
                        alt=""
                        style={{ width: "16px", height: "16px" }}
                      />
                      {organizerDetails.type
                        ? `${organizerDetails.type.charAt(0).toUpperCase() + organizerDetails.type.slice(1)}${organizerDetails.displayName}`
                        : organizerDetails.displayName}
                    </span>
                  </div>
                )}

                {/* Check if all stats are zero (new user on signup day) */}
                {(() => {
                  const totalVotes = organizerReputation
                    ? organizerReputation.thumbsUp +
                      organizerReputation.thumbsDown
                    : 0;
                  const validationCount =
                    organizerValidations?.validatedCount || 0;
                  const isNewUser = totalVotes === 0 && validationCount === 0;

                  if (isNewUser) {
                    return (
                      <div
                        style={{
                          fontSize: "16px",
                          color: "#6c757d",
                          padding: "20px 0",
                        }}
                      >
                        Not yet :)
                      </div>
                    );
                  }

                  return (
                    <>
                      <div className="d-flex align-items-center justify-content-center gap-4 mb-3">
                        {/* Left side: Validations and Votes on same line */}
                        <div style={{ textAlign: "left" }}>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "baseline",
                              gap: "4px",
                              marginBottom: "2px",
                              lineHeight: "1.2",
                            }}
                          >
                            <span
                              style={{ fontSize: "14px", fontWeight: "600" }}
                            >
                              {validationCount >= 1000000
                                ? "+1M"
                                : validationCount >= 1000
                                  ? `${Math.floor(validationCount / 1000)}k`
                                  : validationCount.toString()}
                            </span>
                            <span
                              style={{ fontSize: "14px", color: "#6c757d" }}
                            >
                              validations
                            </span>
                          </div>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "baseline",
                              gap: "4px",
                              lineHeight: "1.2",
                            }}
                          >
                            <span
                              style={{ fontSize: "14px", fontWeight: "600" }}
                            >
                              {totalVotes >= 1000000
                                ? "+1M"
                                : totalVotes >= 1000
                                  ? `${Math.floor(totalVotes / 1000)}k`
                                  : totalVotes.toString()}
                            </span>
                            <span
                              style={{ fontSize: "14px", color: "#6c757d" }}
                            >
                              votes
                            </span>
                          </div>
                        </div>

                        {/* Separator */}
                        <div
                          style={{
                            width: "1px",
                            height: "60px",
                            backgroundColor: "#dee2e6",
                          }}
                        />

                        {/* Percentage and Badge Container */}
                        <div style={{ textAlign: "center" }}>
                          {/* Percentage Display */}
                          <div
                            style={{
                              fontSize: "28px",
                              fontWeight: "bold",
                              color:
                                organizerReputation?.percentage !== null &&
                                organizerReputation?.percentage !== undefined &&
                                organizerReputation.percentage >= 80
                                  ? "#28a745"
                                  : organizerReputation?.percentage !== null &&
                                      organizerReputation?.percentage !==
                                        undefined &&
                                      organizerReputation.percentage >= 50
                                    ? "#ffc107"
                                    : organizerReputation?.percentage !==
                                          null &&
                                        organizerReputation?.percentage !==
                                          undefined
                                      ? "#dc3545"
                                      : "#6c757d",
                            }}
                          >
                            {organizerReputation?.percentage !== null &&
                            organizerReputation?.percentage !== undefined
                              ? `${organizerReputation.percentage}%`
                              : "—"}
                          </div>

                          {/* Badge below percentage */}
                          {organizerReputation &&
                            (() => {
                              const reputationInfo = getReputationDisplay();
                              if (!reputationInfo || !reputationInfo.badge)
                                return null;

                              // Don't show badge for emoji
                              if (reputationInfo.badge === "😎") {
                                return (
                                  <div
                                    style={{
                                      marginTop: "-10px",
                                      fontSize: "16px",
                                    }}
                                  >
                                    {reputationInfo.badge}
                                  </div>
                                );
                              }

                              // Different colors for each badge level
                              let badgeColor = "#4181c0"; // Blue for NPC
                              if (reputationInfo.badge === "Interesting") {
                                badgeColor = "#28a745"; // Green
                              } else if (reputationInfo.badge === "Nice") {
                                badgeColor = "#17a2b8"; // Teal
                              }

                              return (
                                <div style={{ marginTop: "-10px" }}>
                                  <span
                                    className="badge"
                                    style={{
                                      backgroundColor: badgeColor,
                                      color: "#fff",
                                      fontSize: "16px",
                                      padding: "5px 10px",
                                      borderRadius: "0",
                                      fontWeight: "500",
                                    }}
                                  >
                                    {reputationInfo.badge}
                                  </span>
                                </div>
                              );
                            })()}
                        </div>
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>
          )}

          {/* P2P Validation Notice */}
          {event.p2pValidation && (
            <div className="alert alert-info mb-4">
              <div className="d-flex align-items-start">
                <img
                  src={p2pValidationIcon}
                  alt=""
                  style={{
                    width: "20px",
                    height: "20px",
                    marginRight: "12px",
                    marginTop: "4px",
                    flexShrink: 0,
                  }}
                />
                <div>
                  <h6 className="alert-heading mb-2">
                    Peer-to-Peer Validation Event
                  </h6>
                  <p className="mb-2">
                    This event uses community-based ticket validation. What this
                    means:
                  </p>
                  <ul className="mb-0 ps-3">
                    <li>
                      Tickets are validated by other attendees, not just event
                      staff.
                    </li>
                    <li>
                      Any ticket holder can scan and validate other tickets at
                      the venue.
                    </li>
                    <li>
                      The event organizer(s) may or may not be present at the.
                      event
                    </li>
                    <li>
                      Entry is managed collectively by the attendee community.
                    </li>
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
                  <img
                    src={multipleTicketsIcon}
                    alt=""
                    style={{
                      width: "20px",
                      height: "20px",
                      marginRight: "8px",
                      verticalAlign: "middle",
                    }}
                  />
                  Your Tickets ({userTickets.length})
                </h5>
                <div className="list-group">
                  {userTickets.slice(0, ticketsDisplayed).map((ticket) => (
                    <div key={ticket.id} className="list-group-item">
                      <div className="mb-2">
                        <span className="badge bg-primary">
                          {ticket.ticketNumber}
                        </span>
                      </div>
                      <div className="d-flex justify-content-between align-items-center mb-2">
                        {ticket.isValidated ? (
                          <>
                            <div>
                              <span className="badge bg-success me-2">
                                Validated
                              </span>
                              {(ticket as any).resellStatus ===
                                "for_resale" && (
                                <span className="badge bg-warning text-dark">
                                  Returned
                                </span>
                              )}
                            </div>
                            <div className="d-flex gap-2">
                              {(ticket as any).resellStatus !==
                                "for_resale" && (
                                <Link href={`/tickets/${ticket.id}`}>
                                  <a
                                    className="btn btn-sm btn-secondary"
                                    data-testid={`button-view-ticket-${ticket.id}`}
                                  >
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
                            <div>
                              {(ticket as any).resellStatus ===
                                "for_resale" && (
                                <span className="badge bg-warning text-dark">
                                  Returned
                                </span>
                              )}
                            </div>
                            <div className="d-flex gap-2">
                              {(ticket as any).resellStatus !==
                                "for_resale" && (
                                <Link href={`/tickets/${ticket.id}`}>
                                  <a
                                    className="btn btn-sm btn-secondary"
                                    data-testid={`button-view-ticket-${ticket.id}`}
                                  >
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
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                {userTickets.length > ticketsDisplayed && (
                  <div className="text-center mt-3">
                    <button
                      className="btn btn-secondary"
                      onClick={() =>
                        setTicketsDisplayed((prev) =>
                          Math.min(prev + 10, userTickets.length),
                        )
                      }
                      data-testid="button-show-more-tickets"
                    >
                      Show {Math.min(10, userTickets.length - ticketsDisplayed)}{" "}
                      More
                    </button>
                    <div className="text-muted small mt-2">
                      Showing {ticketsDisplayed} of {userTickets.length} tickets
                    </div>
                  </div>
                )}
                {userTickets.length > 10 &&
                  ticketsDisplayed >= userTickets.length && (
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

          {/* Crypto Payment Intents Section - Only for event owners with crypto payment enabled */}
          {isOwner && event.paymentProcessing && event.paymentProcessing !== "None" && event.walletAddress && (
            <div className="card mb-4">
              <div className="card-body">
                <h5 className="card-title mb-3">💳 Crypto Payment Tracker</h5>
                <p className="text-muted small mb-3">
                  View and track cryptocurrency payment attempts for your event
                </p>
                
                {/* Terminal-style balance display */}
                <div style={{
                  backgroundColor: "#000000",
                  color: "#00ff00",
                  fontFamily: "monospace",
                  padding: "12px",
                  borderRadius: "4px",
                  marginBottom: "20px",
                  border: "1px solid #00ff00"
                }}>
                  <div>WALLET: {event.walletAddress.substring(0, 10)}...{event.walletAddress.slice(-8)}</div>
                  <div>CHAIN: {event.paymentProcessing}</div>
                  <div>PRICE: ${event.ticketPrice} USD</div>
                </div>

                <button 
                  className="btn btn-outline-success w-100"
                  onClick={() => {
                    toast({
                      title: "Payment tracking coming soon",
                      description: "Real-time payment monitoring will be available shortly",
                    });
                  }}
                >
                  View Payment Intents
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="col-lg-4">
          <div className="card sticky-top" style={{ top: "80px" }}>
            <div className="card-body">
              <h5 className="card-title">Ticket Information</h5>

              {/* Event QR Code */}
              {eventQrCode && (
                <div className="mb-3 p-3 bg-light rounded text-center">
                  <div className="text-muted small mb-2">Event Link QR Code</div>
                  <img 
                    src={eventQrCode} 
                    alt="Event QR Code" 
                    style={{ width: "200px", height: "200px" }}
                    className="mb-2"
                    data-testid="img-event-qr-code"
                  />
                  <div className="text-muted small">
                    Share this event: eventic.quest/e/{event?.id?.substring(0, 8)}
                  </div>
                </div>
              )}

              <div className="mb-3">
                <div className="d-flex justify-content-between mb-2">
                  <span>Price:</span>
                  {event.ticketsAvailable === 0 ? (
                    <span className="badge bg-danger text-white">Sold Out</span>
                  ) : (
                    <strong>
                      {event.currentPrice === 0
                        ? "Free"
                        : `$${event.currentPrice.toFixed(2)}`}
                      {event.surgePricing &&
                        event.currentPrice !==
                          parseFloat(event.ticketPrice) && (
                          <small className="text-muted ms-2">
                            (
                            {(() => {
                              const basePrice = parseFloat(event.ticketPrice);
                              const increase = event.currentPrice - basePrice;
                              const increasePercent = Math.round(
                                (increase / basePrice) * 100,
                              );
                              return `+${increasePercent}%`;
                            })()}
                            )
                          </small>
                        )}
                    </strong>
                  )}
                </div>

                {event.surgePricing &&
                  event.currentPrice !== parseFloat(event.ticketPrice) && (
                    <div className="text-end" style={{ paddingBottom: "10px" }}>
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
                              <div className="d-flex justify-content-between align-items-center mb-2">
                                <span>Tickets Sold:</span>
                                <div className="d-flex align-items-center gap-2">
                                  <span>
                                    {event.ticketsSold === 0 ? "Be the first :)" : `${event.ticketsSold} / ${event.maxTickets}`}
                                  </span>
                                  {/* Show +5 button only for event owner with sufficient credits and event hasn't started */}
                                  {isOwner &&
                                    userBalance &&
                                    parseFloat(userBalance.balance) >= 5 &&
                                    !eventHasStarted && (
                                      <TooltipProvider>
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <button
                                              className="btn btn-sm btn-outline-success d-flex align-items-center gap-1"
                                              onClick={handleExpandTickets}
                                              disabled={isExpanding}
                                              style={{
                                                padding: "2px 8px",
                                                minWidth: "auto",
                                              }}
                                            >
                                              <img
                                                src={expandIcon}
                                                alt=""
                                                style={{
                                                  width: "14px",
                                                  height: "14px",
                                                }}
                                              />
                                              <span
                                                style={{ fontSize: "12px" }}
                                              >
                                                +5
                                              </span>
                                            </button>
                                          </TooltipTrigger>
                                          <TooltipContent>
                                            <p>
                                              Add five more for five credits.
                                            </p>
                                          </TooltipContent>
                                        </Tooltip>
                                      </TooltipProvider>
                                    )}
                                </div>
                              </div>
                              <div className="progress mb-3">
                                <div
                                  className="progress-bar"
                                  style={{
                                    width: `${(event.ticketsSold / event.maxTickets) * 100}%`,
                                  }}
                                />
                              </div>
                            </>
                          )}
                          <div className="d-flex align-items-center">
                            <img
                              src={ticketIcon}
                              alt=""
                              style={{
                                width: "32px",
                                height: "32px",
                                marginRight: "8px",
                              }}
                            />
                            <div>
                              <div className="d-flex align-items-center">
                                <span className="fw-bold">
                                  {event.ticketsAvailable}
                                </span>
                                &nbsp;Remaining
                                <HelpCircle
                                  className="ms-1 text-muted"
                                  size={12}
                                  data-bs-toggle="tooltip"
                                  data-bs-placement="top"
                                  data-bs-title="Number of tickets still available for purchase directly from the event"
                                  style={{ cursor: "help" }}
                                />
                              </div>
                              <div className="mt-1 d-flex align-items-center">
                                <span className="fw-bold">
                                  {event.resaleCount || 0}
                                </span>
                                &nbsp;Available
                                <HelpCircle
                                  className="ms-1 text-muted"
                                  size={12}
                                  data-bs-toggle="tooltip"
                                  data-bs-placement="top"
                                  data-bs-title="Number of tickets being resold by other attendees at original price"
                                  style={{ cursor: "help" }}
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
                disabled={
                  isSoldOut ||
                  isPurchasing ||
                  isEventPast ||
                  !(event?.ticketPurchasesEnabled ?? true) ||
                  ((event?.oneTicketPerUser ?? false) &&
                    userTickets &&
                    userTickets.filter(
                      (t) => (t as any).resellStatus !== "for_resale",
                    ).length > 0)
                }
                data-testid="button-purchase"
              >
                {isPurchasing ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" />
                    Issuing...
                  </>
                ) : isEventPast ? (
                  "Event Has Passed"
                ) : isSoldOut ? (
                  "All Gone :("
                ) : !event?.ticketPurchasesEnabled ? (
                  "Suspended"
                ) : event?.oneTicketPerUser &&
                  userTickets &&
                  userTickets.filter(
                    (t) => (t as any).resellStatus !== "for_resale",
                  ).length > 0 ? (
                  "Good 2 Go"
                ) : (
                  <>
                    <img
                      src={
                        event.currentPrice === 0 ? rsvpIcon : "/ticket-icon.png"
                      }
                      alt=""
                      style={{
                        width: "18px",
                        height: "18px",
                        marginRight: "8px",
                      }}
                    />
                    {event.currentPrice === 0
                      ? "RSVP"
                      : "RSVP - Pay on Arrival"}
                  </>
                )}
              </button>

              {/* Boost Button for event owners and ticket holders - not shown for private events */}
              {!event.isPrivate &&
                (isOwner || (userTickets && userTickets.filter((t) => (t as any).resellStatus !== "for_resale").length > 0)) &&
                !eventHasStarted && (
                  <button
                    onClick={() => setIsBoostModalOpen(true)}
                    className="btn btn-warning w-100 mb-3"
                    data-testid="button-boost-event"
                    style={{
                      padding: "0.375rem 0.75rem",
                      fontSize: "1rem",
                      lineHeight: "1.5",
                    }}
                  >
                    <img
                      src="/boost-icon.png"
                      alt=""
                      style={{
                        width: "18px",
                        height: "18px",
                        marginRight: "8px",
                        verticalAlign: "text-bottom",
                      }}
                    />
                    Boost
                  </button>
                )}

              {/* Show message if ticket sales are disabled */}
              {!event?.ticketPurchasesEnabled && !isEventPast && !isSoldOut && (
                <div className="alert alert-warning mb-3">
                  <small>
                    <strong>This event has been suspended.</strong>
                    <br />
                    {event.resaleCount && event.resaleCount > 0 && (
                      <>
                        Existing ticket holders can still return tickets -{" "}
                        {event.resaleCount}{" "}
                        {event.resaleCount === 1 ? "ticket is" : "tickets are"}{" "}
                        available.
                      </>
                    )}
                  </small>
                </div>
              )}

              {canEdit && (
                <div>
                  <Link
                    href={`/events/${id}/edit`}
                    className="btn btn-secondary w-100 mb-2"
                  >
                    <img
                      src="/edit-icon.png"
                      alt=""
                      style={{
                        width: "18px",
                        height: "18px",
                        marginRight: "8px",
                      }}
                    />
                    Edit Event
                  </Link>
                  
                  {/* Download Transactions Button - Show for crypto events based on prepay setting */}
                  {event.paymentProcessing && event.paymentProcessing !== "None" && 
                   event.walletAddress && (() => {
                    const now = new Date();
                    const eventStart = new Date(event.date);
                    if (event.time) {
                      const [hours, minutes] = event.time.split(':').map(Number);
                      eventStart.setHours(hours || 0, minutes || 0, 0, 0);
                    }
                    
                    let eventEnd = eventStart;
                    if (event.endDate) {
                      eventEnd = new Date(event.endDate);
                      eventEnd.setHours(23, 59, 59, 999);
                    } else {
                      // No end date - use 24 hours from start
                      eventEnd = new Date(eventStart);
                      eventEnd.setDate(eventEnd.getDate() + 1);
                    }
                    
                    // Add 24 hours buffer after event end for settlement
                    const settlementTime = new Date(eventEnd);
                    settlementTime.setDate(settlementTime.getDate() + 1);
                    
                    const allowPrepay = (event as any).allowPrepay || false;
                    
                    // Determine if button should be shown and enabled
                    let showButton = true;
                    let isDisabled = false;
                    let buttonText = "📥 Download Transactions";
                    let disabledReason = "";
                    
                    if (allowPrepay) {
                      // Prepay ON: Show after event starts
                      if (now < eventStart) {
                        showButton = false;
                      }
                    } else {
                      // Prepay OFF: Show but disable until 24 hours after event ends
                      if (now < settlementTime) {
                        isDisabled = true;
                        const hoursRemaining = Math.ceil((settlementTime.getTime() - now.getTime()) / (1000 * 60 * 60));
                        disabledReason = `Available in ${hoursRemaining} hour${hoursRemaining !== 1 ? 's' : ''}`;
                        buttonText = `📥 Download Transactions (${disabledReason})`;
                      }
                    }
                    
                    if (!showButton) return null;
                    
                    return (
                      <button
                        className="btn btn-outline-success w-100 mb-2"
                        disabled={isDisabled}
                        onClick={async () => {
                          toast({
                            title: "Fetching transactions...",
                            description: "Querying blockchain for transactions",
                          });
                          
                          // Import the blockchain API
                          const { fetchBlockchainTransactions, formatTransactionData } = await import('@/lib/blockchain-api');
                          
                          let startDate: Date;
                          let endDate: Date;
                          
                          if (allowPrepay) {
                            // Prepay ON: Fetch from event creation to event start
                            startDate = new Date(event.createdAt);
                            endDate = eventStart;
                          } else {
                            // Prepay OFF: Fetch from event start to end
                            startDate = eventStart;
                            endDate = eventEnd;
                          }
                          
                          try {
                            const transactions = await fetchBlockchainTransactions(
                              event.walletAddress!,
                              event.paymentProcessing as 'Bitcoin' | 'Ethereum' | 'USDC' | 'Dogecoin',
                              startDate,
                              endDate
                            );
                            
                            const formatted = formatTransactionData(transactions, event.paymentProcessing as 'Bitcoin' | 'Ethereum' | 'USDC' | 'Dogecoin');
                            
                            // Add date range info to the output
                            const dateRangeInfo = `Date Range: ${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()}\n` +
                                                 `Payment Mode: ${allowPrepay ? 'Prepayment Allowed' : 'Event-time Only'}\n\n`;
                            const finalOutput = dateRangeInfo + formatted;
                            
                            // Create and download text file
                            const blob = new Blob([finalOutput], { type: 'text/plain' });
                            const url = URL.createObjectURL(blob);
                            const link = document.createElement('a');
                            link.href = url;
                            link.download = `${event.name.replace(/[^a-z0-9]/gi, '-')}-transactions.txt`;
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                            URL.revokeObjectURL(url);
                            
                            toast({
                              title: "Downloaded transactions",
                              description: `Found ${transactions.length} transaction(s)`,
                            });
                          } catch (error) {
                            toast({
                              title: "Error fetching transactions",
                              description: "Could not retrieve blockchain data. Please try again later.",
                              variant: "destructive",
                            });
                          }
                        }}
                      >
                        {buttonText}
                      </button>
                    );
                  })()}
                  
                  <div className="alert alert-info mt-3">
                    <small className="d-flex align-items-center">
                      <img
                        src={ownerIcon}
                        alt=""
                        style={{
                          width: "32px",
                          height: "32px",
                          marginRight: "8px",
                        }}
                      />
                      {isOwner
                        ? "You own this event"
                        : "Admin: You can edit this event"}
                    </small>
                  </div>

                  {/* Delegated Validators Section */}
                  <div className="mt-4">
                    <h6 className="fw-semibold mb-3">Delegated Validators</h6>
                    <p className="small text-muted mb-3">
                      Allow others to validate tickets for this event by adding
                      their email address.
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
                          <div
                            key={validator.id}
                            className="list-group-item d-flex justify-content-between align-items-center"
                          >
                            <small>{validator.email}</small>
                            <button
                              className="btn btn-sm btn-outline-danger"
                              onClick={() =>
                                removeValidatorMutation.mutate(validator.id)
                              }
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
                    <Link href="/auth">Sign in</Link> to RVSP
                  </small>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Boost Event Modal - not shown for private events */}
      {!event.isPrivate &&
        (isOwner || (userTickets && userTickets.filter((t) => (t as any).resellStatus !== "for_resale").length > 0)) && (
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
