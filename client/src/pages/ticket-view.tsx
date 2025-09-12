import { useState, useEffect, useRef } from "react";
import { useParams, Link, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { TicketCard } from "@/components/tickets/ticket-card";
import { CryptoPaymentInfo } from "@/components/crypto-payment-info";
import { MintNFTButton } from "@/components/registry/mint-nft-button";
import { MintNFTButtonV2 } from "@/components/registry/mint-nft-button-v2";
import { useToast } from "@/hooks/use-toast";
import { useSEO } from "@/hooks/use-seo";
import {
  ArrowLeft,
  Clock,
  RefreshCw,
  MapPin,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Shield,
  Users,
  HelpCircle,
  CheckCircle,
  ThumbsUp,
  ThumbsDown,
} from "lucide-react";
import QRCode from "qrcode";
import deletionWarningIcon from "@assets/image_1756936869495.png";
import batteryIcon from "@assets/image_1756977732648.png";
import expiredIcon from "@assets/image_1757231398193.png";
import gearIcon from "@assets/image_1757231239743.png";
import cryptoPaymentIcon from "@assets/expand_hierarchial_array-1_1757599748433.png";
import type { Ticket, Event } from "@shared/schema";

interface ValidationSession {
  token: string;
  expiresAt: string;
}

// Helper function to check if event has started (for NFT minting)
function hasEventStarted(event: Event | undefined): boolean {
  if (!event) return false;

  const now = new Date();
  const startDateTime = `${event.date}T${event.time}:00`;
  const startDate = new Date(startDateTime);

  // Check if event has started yet
  return now >= startDate;
}

// Helper function to check if a ticket is within its valid time window
function isTicketWithinValidTime(event: Event | undefined): {
  valid: boolean;
  message?: string;
} {
  if (!event) return { valid: false, message: "Event data not available" };

  const now = new Date();
  // Combine date and time fields for start date using ISO format
  const startDateTime = `${event.date}T${event.time}:00`;
  const startDate = new Date(startDateTime);

  // Check early validation setting
  const earlyValidation = event.earlyValidation || "Allow at Anytime";

  // Check if event hasn't started yet based on early validation setting
  if (earlyValidation !== "Allow at Anytime") {
    let validationStartTime = new Date(startDate);

    switch (earlyValidation) {
      case "One Hour Before":
        validationStartTime = new Date(startDate.getTime() - 60 * 60 * 1000);
        break;
      case "Two Hours Before":
        validationStartTime = new Date(
          startDate.getTime() - 2 * 60 * 60 * 1000,
        );
        break;
      // "At Start Time" uses the original start time
    }

    if (now < validationStartTime) {
      const timeDescription =
        earlyValidation === "At Start Time"
          ? `at ${startDate.toLocaleString()}`
          : earlyValidation === "One Hour Before"
            ? `starting ${validationStartTime.toLocaleString()} (1 hour before event)`
            : `starting ${validationStartTime.toLocaleString()} (2 hours before event)`;

      return {
        valid: false,
        message: `Validation begins ${timeDescription}`,
      };
    }
  }

  // If event has an end date and time, check if we're past it
  if (event.endDate && event.endTime) {
    const endDateTime = `${event.endDate}T${event.endTime}:00`;
    const endDate = new Date(endDateTime);
    if (now > endDate) {
      return {
        valid: false,
        message: `Event has ended. It ended on ${endDate.toLocaleString()}`,
      };
    }
  } else {
    // No end date - check if we're within 24 hours of start
    const twentyFourHoursAfterStart = new Date(
      startDate.getTime() + 24 * 60 * 60 * 1000,
    );
    if (now > twentyFourHoursAfterStart) {
      return {
        valid: false,
        message: `Ticket has expired. It was valid for 24 hours after ${startDate.toLocaleString()}`,
      };
    }
  }

  return { valid: true };
}

export default function TicketViewPage(): React.ReactElement {
  const { ticketId } = useParams<{ ticketId: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [isValidating, setIsValidating] = useState(false);
  const [currentToken, setCurrentToken] = useState<string>("");
  const [currentCode, setCurrentCode] = useState<string>("");
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [selectedRating, setSelectedRating] = useState<
    "thumbs_up" | "thumbs_down" | null
  >(null);
  const [hasRated, setHasRated] = useState(false);
  const [canRate, setCanRate] = useState(false);
  const [ratingPeriodEnded, setRatingPeriodEnded] = useState(false);
  const [p2pVoteError, setP2pVoteError] = useState<string>("");
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isCharging, setIsCharging] = useState(false);
  const [showCryptoPayment, setShowCryptoPayment] = useState(false);
  const [userCredits, setUserCredits] = useState(0);
  const [currentColorIndex, setCurrentColorIndex] = useState(0);

  // Event type colors for background cycling
  const eventTypeColors = [
    "#3B82F6", // Blue - P2P
    "#DC2626", // Red - Featured/Surge
    "#9333EA", // Purple - Special Effects
    "#EC4899", // Pink - Stickers
    "#F59E0B", // Orange - Geofence
    "#FF6B35", // Coral - Treasure Hunt
    "#EAB308", // Yellow - Vote
    "#059669", // Green - Recurring
    "#14B8A6", // Teal - Limited
    "#6B7280", // Gray - Multi-day
    "#000000", // Black - Collectable
    "#FFD700", // Gold - Golden
  ];

  // Fetch ticket details with polling during validation
  const {
    data: ticketData,
    isLoading,
    error,
  } = useQuery<{ ticket: Ticket; event: Event }>({
    queryKey: [`/api/tickets/${ticketId}`],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/tickets/${ticketId}`);
      return response.json();
    },
    // Poll every 2 seconds while validation is active
    refetchInterval: isValidating ? 2000 : false,
  });

  // Check user's credit balance
  const { data: userBalance } = useQuery({
    queryKey: [`/api/currency/balance`],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/currency/balance`);
      return response.json();
    },
    enabled: !!ticketData?.ticket.userId,
  });

  // Set dynamic SEO based on event data
  useSEO({
    title: ticketData?.event
      ? `${ticketData.event.name} Ticket`
      : "Ticket View",
    description: ticketData?.event
      ? `Your ticket for ${ticketData.event.name} at ${ticketData.event.venue} on ${ticketData.event.date}. Access QR code for entry.`
      : "View your event ticket details and access QR code for entry.",
    keywords: ticketData?.event
      ? `${ticketData.event.name}, ticket, QR code, ${ticketData.event.venue}, event entry`
      : "ticket, QR code, event entry",
  });

  // Check if NFT features are enabled
  const { data: nftEnabled } = useQuery<{ enabled: boolean }>({
    queryKey: ["/api/nft/enabled"],
  });

  useEffect(() => {
    if (userBalance) {
      setUserCredits(userBalance.balance || 0);
    }
  }, [userBalance]);

  // Check if user has already rated
  const { data: ratingStatus } = useQuery({
    queryKey: [`/api/tickets/${ticketId}/rating`],
    queryFn: async () => {
      const response = await apiRequest(
        "GET",
        `/api/tickets/${ticketId}/rating`,
      );
      return response.json();
    },
    enabled: !!ticketId,
  });

  // Submit rating mutation
  const submitRatingMutation = useMutation({
    mutationFn: async (rating: "thumbs_up" | "thumbs_down") => {
      const response = await apiRequest(
        "POST",
        `/api/tickets/${ticketId}/rate`,
        {
          rating,
        },
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || "Failed to submit rating");
      }
      return data;
    },
    onSuccess: (data) => {
      setSelectedRating(data.rating.rating);
      setHasRated(true);

      let description = "";
      if (data.updated) {
        description = "Your rating has been updated!";
      } else if (data.rewardCredited) {
        description =
          "Thank you! You've earned 1 credit for rating this event!";
      } else if (data.ticketDebited) {
        description = "Thank you for your feedback! 1 credit was deducted.";
      } else {
        description = "Thank you for rating this event!";
      }

      toast({
        title: data.updated ? "Rating Updated" : "Rating Submitted",
        description: description,
      });

      // Invalidate rating queries to sync across tickets
      queryClient.invalidateQueries({
        queryKey: [`/api/tickets/${ticketId}/rating`],
      });
      // Invalidate balance query if reward was credited or debited
      if (data.rewardCredited || data.ticketDebited) {
        queryClient.invalidateQueries({ queryKey: ["/api/currency/balance"] });
      }
      // Invalidate event owner's reputation query to reflect the new rating
      if (event?.userId) {
        queryClient.invalidateQueries({
          queryKey: [`/api/users/${event.userId}/reputation`],
        });
      }
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Rating Failed",
        description: error.message || "Could not submit rating",
      });
    },
  });

  // P2P Vote mutation
  const p2pVoteMutation = useMutation({
    mutationFn: async (validationCode: string) => {
      const response = await apiRequest("POST", "/api/validate/p2p-vote", {
        validationCode,
        voterId: ticket.id,
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Invalid validation code");
      }
      return response.json();
    },
    onSuccess: (data) => {
      setP2pVoteError("");
      toast({
        title: "Vote Submitted!",
        description: "Your vote has been recorded successfully.",
      });
      // Clear the input form
      const form = document.querySelector(
        '[data-testid="input-vote-code"]',
      ) as HTMLInputElement;
      if (form) form.value = "";
    },
    onError: (error: any) => {
      setP2pVoteError(error.message || "Invalid validation code");
    },
  });

  // Start validation session mutation
  const startValidationMutation = useMutation({
    mutationFn: async (locationData?: { lat: number; lng: number }) => {
      const response = await apiRequest(
        "POST",
        `/api/tickets/${ticketId}/validate-session`,
        locationData,
      );
      return response.json();
    },
    onSuccess: (data: ValidationSession) => {
      setIsValidating(true);
      setTimeRemaining(180); // 3 minutes in seconds
      startTokenRotation();
      startCountdown();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to start validation",
        variant: "destructive",
      });
    },
  });

  // Generate QR code for current token
  const generateQRCode = async (token: string) => {
    if (!canvasRef.current || !token) return;

    try {
      await QRCode.toCanvas(canvasRef.current, token, {
        width: 200,
        margin: 2,
        color: {
          dark: "#000000",
          light: "#FFFFFF",
        },
      });

      // Convert canvas to data URL for display
      const dataUrl = canvasRef.current.toDataURL();
      setQrDataUrl(dataUrl);
    } catch (error) {
      console.error("Error generating QR code:", error);
    }
  };

  // Fetch new validation token
  const fetchNewToken = async () => {
    try {
      const response = await apiRequest(
        "GET",
        `/api/tickets/${ticketId}/validation-token`,
      );
      const data = await response.json();
      setCurrentToken(data.token);
      setCurrentCode(data.code || ""); // Store the 4-digit code
      await generateQRCode(data.token);
    } catch (error) {
      console.error("Error fetching validation token:", error);
    }
  };

  // Start token rotation (every 10 seconds)
  const startTokenRotation = () => {
    // Fetch initial token
    fetchNewToken();

    // Reset color index
    setCurrentColorIndex(0);

    // Set up interval for token rotation and color change
    intervalRef.current = setInterval(() => {
      fetchNewToken();
      // Cycle to next color
      setCurrentColorIndex((prev) => (prev + 1) % eventTypeColors.length);
    }, 10000); // 10 seconds
  };

  // Start countdown timer
  const startCountdown = () => {
    countdownRef.current = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          stopValidation();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  // Stop validation session
  const stopValidation = () => {
    setIsValidating(false);
    setCurrentToken("");
    setCurrentCode("");
    setQrDataUrl("");
    setTimeRemaining(0);

    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }

    // Refetch ticket data when validation ends to ensure UI updates
    queryClient.invalidateQueries({ queryKey: [`/api/tickets/${ticketId}`] });
  };

  // Check if ticket is already validated on mount and after mutations
  useEffect(() => {
    if (ticketData?.ticket?.isValidated) {
      stopValidation();
    }
  }, [ticketData?.ticket?.isValidated]);

  // Generate MP4 for NFT minting if ticket is validated and event allows minting
  // DISABLED: Automatic background generation causes conflicts with manual minting
  // useEffect(() => {
  //   const generateNftMedia = async () => {
  //     if (!ticketData?.ticket || !ticketData?.event) return;

  //     // Check if conditions are met for MP4 generation
  //     if (ticketData.ticket.isValidated &&
  //         ticketData.event.allowMinting &&
  //         !ticketData.ticket.nftMediaUrl) {

  //       try {
  //         // Call API to generate MP4
  //         const response = await apiRequest("POST", `/api/tickets/${ticketId}/generate-nft-media`, {});
  //         const data = await response.json();

  //         if (data.mediaUrl && !data.cached) {
  //           console.log("NFT media generated successfully:", data.mediaUrl);
  //         }
  //       } catch (error) {
  //         console.error("Failed to generate NFT media:", error);
  //         // Silent failure - don't show error to user as this is a background operation
  //       }
  //     }
  //   };

  //   generateNftMedia();
  // }, [ticketData?.ticket?.isValidated, ticketData?.event?.allowMinting, ticketId]);

  // Check if within rating period (before event OR within 24 hours after start)
  const isWithinRatingPeriod = () => {
    if (!ticketData?.event) return false;
    const now = new Date();
    const startDateTime = `${ticketData.event.date}T${ticketData.event.time}:00`;
    const startDate = new Date(startDateTime);
    const hoursSinceStart =
      (now.getTime() - startDate.getTime()) / (1000 * 60 * 60);

    // Allow rating anytime before event or within 24 hours after start
    return hoursSinceStart <= 24;
  };

  // Check if within voting period (only during event and up to 24 hours after, or until end date)
  const getVotingPeriodStatus = () => {
    if (!ticketData?.event) return { isValid: false, reason: "notStarted" };
    const now = new Date();
    const startDateTime = `${ticketData.event.date}T${ticketData.event.time}:00`;
    const startDate = new Date(startDateTime);

    // Check if event hasn't started yet
    if (now < startDate) {
      return { isValid: false, reason: "notStarted" }; // Voting not allowed before event starts
    }

    // If event has an end date, check if we're past it
    if (ticketData.event.endDate && ticketData.event.endTime) {
      const endDateTime = `${ticketData.event.endDate}T${ticketData.event.endTime}:00`;
      const endDate = new Date(endDateTime);
      return now <= endDate
        ? { isValid: true, reason: "active" }
        : { isValid: false, reason: "ended" };
    } else {
      // No end date - allow voting for 24 hours after start
      const twentyFourHoursAfterStart = new Date(
        startDate.getTime() + 24 * 60 * 60 * 1000,
      );
      return now <= twentyFourHoursAfterStart
        ? { isValid: true, reason: "active" }
        : { isValid: false, reason: "ended" };
    }
  };

  const isWithinVotingPeriod = () => {
    return getVotingPeriodStatus().isValid;
  };

  // Update rating state when rating status changes
  useEffect(() => {
    if (ratingStatus) {
      setHasRated(ratingStatus.hasRated);
      setCanRate(ratingStatus.canRate);
      setRatingPeriodEnded(ratingStatus.ratingPeriodEnded);
      if (ratingStatus.currentRating) {
        setSelectedRating(ratingStatus.currentRating);
      }
    }
  }, [ratingStatus]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, []);

  // Format time remaining
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
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

  if (error || !ticketData) {
    return (
      <div className="container py-5">
        <div className="alert alert-danger">
          <h5>Ticket not found</h5>
          <p>
            The ticket you're looking for doesn't exist or you don't have access
            to it.
          </p>
          <Link href="/account">
            <a className="btn btn-primary mt-3">
              <ArrowLeft size={18} className="me-2" />
              Back to Account
            </a>
          </Link>
        </div>
      </div>
    );
  }

  const { ticket, event } = ticketData;
  const timeValidation = isTicketWithinValidTime(event);

  // Calculate days until deletion (69 days after event ends)
  const daysUntilDeletion = (() => {
    const now = new Date();

    // Check if event has passed
    let eventEndDate: Date | null = null;

    // Use end date if available, otherwise use start date
    if (event.endDate) {
      try {
        const [endYear, endMonth, endDay] = event.endDate
          .split("-")
          .map(Number);
        eventEndDate = new Date(endYear, endMonth - 1, endDay);
        eventEndDate.setHours(23, 59, 59, 999);
      } catch {
        // Fall back to start date
      }
    }

    if (!eventEndDate && event.date) {
      try {
        const [year, month, day] = event.date.split("-").map(Number);
        eventEndDate = new Date(year, month - 1, day);
      } catch {
        return null;
      }
    }

    if (!eventEndDate) return null;

    // Check if event has ended (past the end of the event day)
    const endOfEventDay = new Date(eventEndDate);
    endOfEventDay.setHours(23, 59, 59, 999);
    if (now <= endOfEventDay) return null;

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

  return (
    <div className="container py-5">
      {/* Back Button */}
      <div className="mb-4">
        <Link href="/account">
          <a className="btn btn-outline-secondary">
            <ArrowLeft size={18} className="me-2" />
            Back to My Tickets
          </a>
        </Link>
      </div>

      {/* Page Title */}
      <div className="row mb-4">
        <div className="col text-center">
          <h1 className="h3 fw-bold">
            <Link href={`/events/${event.id}`}>
              <a className="text-decoration-none text-dark">
                {event.name} Ticket
              </a>
            </Link>
          </h1>
          {event.contactDetails && (
            <p className="text-muted fst-italic">{event.contactDetails}</p>
          )}
        </div>
      </div>

      {/* Deletion countdown - Only shown for past events */}
      {daysUntilDeletion !== null && (
        <div className="row justify-content-center mb-4">
          <div className="col-12 col-md-8 col-lg-6">
            <div className="d-flex align-items-center text-danger">
              <img
                src={deletionWarningIcon}
                alt=""
                style={{ width: "18px", height: "18px", marginRight: "8px" }}
              />
              <span>
                {daysUntilDeletion} days until deletion
                {event.allowMinting && (
                  <span> - digital collectable available</span>
                )}
                {daysUntilDeletion <= 7 && !event.allowMinting && (
                  <span className="ms-1">
                    - data will be permanently deleted soon
                  </span>
                )}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Ticket and Validation Section */}
      <div className="row justify-content-center">
        <div className="col-12 col-md-8 col-lg-6">
          {/* Ticket Display */}
          <div className="mb-4" id="ticket-card-for-nft">
            <TicketCard
              ticket={ticket}
              event={event}
              showQR={false}
              showBadges={true}
            />
          </div>

          {/* Ticket Status Badge for Resale Only - kept separate since it's not in the badge bar */}
          {(ticket as any).resellStatus === "for_resale" && (
            <div className="d-flex justify-content-center gap-2 mb-3">
              <span
                className="badge"
                style={{
                  backgroundColor: "#FFC107",
                  color: "#000",
                  fontSize: "0.9em",
                  padding: "6px 12px",
                }}
              >
                RETURNED
              </span>
            </div>
          )}

          {/* Ticket Details */}
          <div className="card mb-4">
            <div className="card-body">
              <h6 className="card-title mb-3">Details</h6>

              <div className="d-flex justify-content-between">
                <div>
                  <span className="text-muted">Purchase Date:</span>
                  <p className="mb-0 fw-bold">
                    {ticket.createdAt
                      ? new Date(ticket.createdAt).toLocaleDateString("en-US", {
                          month: "long",
                          day: "numeric",
                          year: "numeric",
                        })
                      : "Unknown"}
                  </p>
                  {/* Show payment status for paid events */}
                  {parseFloat(event.ticketPrice) > 0 && (
                    <>
                      <span className="text-muted">Payment Status:</span>
                      <p className="mb-0 fw-bold">
                        {ticket.paymentConfirmed === true ? (
                          <span className="text-success">Paid</span>
                        ) : (
                          <span className="text-warning">Not Paid</span>
                        )}
                      </p>
                    </>
                  )}
                </div>
                <div className="text-end">
                  <span className="text-muted">Price:</span>
                  <p className="mb-0 fw-bold">
                    ${ticket.purchasePrice || event.ticketPrice || "0.00"}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Charge Ticket Section - Only show if event has special effects OR stickers enabled, ticket not validated, and event hasn't started */}
          {(event.specialEffectsEnabled || event.stickerUrl) &&
            !ticket.isCharged &&
            !ticket.isValidated &&
            (() => {
              const now = new Date();
              const startDateTime = `${event.date}T${event.time}:00`;
              const startDate = new Date(startDateTime);
              return now < startDate;
            })() && (
              <div className="card mb-4">
                <div className="card-body">
                  <h6 className="card-title mb-3">
                    <img
                      src={batteryIcon}
                      alt=""
                      style={{ width: "18px", height: "18px" }}
                      className="me-2"
                    />
                    Charge Ticket
                  </h6>
                  <p className="text-muted small mb-3">
                    Charge your ticket for better odds of special effects.
                  </p>
                  <div className="alert alert-info small mb-3">
                    <strong>How it works:</strong>
                    <ul className="mb-0 mt-2">
                      <li>
                        You have {userCredits} tickets, it costs 3 tickets to
                        charge.
                      </li>
                      <li>
                        Special effects odds will be improved for better
                        chances.
                      </li>
                      <li>
                        Includes seasonal effects, stickers, and other stuff.
                      </li>
                    </ul>
                  </div>
                  <button
                    className="btn btn-warning w-100"
                    onClick={async () => {
                      setIsCharging(true);
                      try {
                        const response = await apiRequest(
                          "POST",
                          `/api/tickets/${ticketId}/charge`,
                          {},
                        );
                        if (response.ok) {
                          toast({
                            title: "Ticket Charged!",
                            description:
                              "Your ticket now has improved chances of special effects.",
                          });
                          // Refresh ticket data and balance
                          queryClient.invalidateQueries({
                            queryKey: [`/api/tickets/${ticketId}`],
                          });
                          queryClient.invalidateQueries({
                            queryKey: [`/api/currency/balance`],
                          });
                        } else {
                          const error = await response.json();
                          toast({
                            title: "Failed to charge ticket",
                            description:
                              error.message || "Something went wrong :(",
                            variant: "destructive",
                          });
                        }
                      } catch (error) {
                        toast({
                          title: "Error",
                          description: "Failed to charge :(",
                          variant: "destructive",
                        });
                      } finally {
                        setIsCharging(false);
                      }
                    }}
                    disabled={isCharging || userCredits < 3}
                    data-testid="button-charge-ticket"
                  >
                    {isCharging ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2" />
                        Charging...
                      </>
                    ) : userCredits < 3 ? (
                      <>
                        <img
                          src={batteryIcon}
                          alt=""
                          style={{ width: "18px", height: "18px" }}
                          className="me-2"
                        />
                        Insufficient Tickets
                      </>
                    ) : (
                      <>
                        <img
                          src={batteryIcon}
                          alt=""
                          style={{ width: "18px", height: "18px" }}
                          className="me-2"
                        />
                        Charge (3 Tickets)
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

          {/* Show charged status if ticket is already charged */}
          {ticket.isCharged && (
            <div className="card mb-4">
              <div className="card-body">
                <div className="d-flex align-items-center">
                  <img
                    src={batteryIcon}
                    alt=""
                    style={{ width: "20px", height: "20px" }}
                    className="me-2"
                  />
                  <div>
                    <h6 className="mb-0">Ticket Charged!</h6>
                    <p className="text-muted small mb-0">
                      This ticket has improved odds of special effects
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Crypto Payment Section - Only show if event has crypto payment enabled */}
          {event.ticketPrice &&
            parseFloat(event.ticketPrice.toString()) > 0 &&
            event.paymentProcessing &&
            event.paymentProcessing !== "None" &&
            event.walletAddress &&
            !ticket.isValidated &&
            (() => {
              // Check if payment should be visible based on allowPrepay and event timing
              const now = new Date();
              const eventStartDate = new Date(event.date);

              // Parse event time to add to date
              if (event.time) {
                const [hours, minutes] = event.time.split(":").map(Number);
                eventStartDate.setHours(hours || 0, minutes || 0, 0, 0);
              }

              // If allowPrepay is true, always show payment info
              // If allowPrepay is false, only show if event has started
              const shouldShow =
                (event as any).allowPrepay || now >= eventStartDate;

              if (!shouldShow) {
                // Event hasn't started and prepay is not allowed
                return (
                  <div className="card mb-4">
                    <div className="card-body text-center">
                      <Clock size={24} className="text-muted mb-2" />
                      <h6 className="card-title">
                        Payment Opens at Event Time
                      </h6>
                      <p className="text-muted mb-0">
                        Crypto payment information will be available when the
                        event starts on{" "}
                        {new Date(eventStartDate).toLocaleDateString("en-US", {
                          month: "long",
                          day: "numeric",
                          year: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  </div>
                );
              }

              const ticketPrice = parseFloat(
                ticket.purchasePrice?.toString() ||
                  event.ticketPrice?.toString() ||
                  "0",
              );
              const paymentMethod = event.paymentProcessing as
                | "Bitcoin"
                | "Ethereum"
                | "USDC"
                | "Dogecoin";

              return (
                <div className="card mb-4">
                  <div className="card-body">
                    <h6 className="card-title mb-3">
                      <img
                        src={cryptoPaymentIcon}
                        alt=""
                        style={{ width: "18px", height: "18px" }}
                        className="me-2"
                      />
                      Payment Information
                    </h6>
                    <p className="text-muted small mb-3">
                      The event creator has requested that you pay with{" "}
                      {paymentMethod}
                    </p>

                    <div className="alert alert-info small mb-3">
                      <strong>How it works:</strong>
                      <ul className="mb-0 mt-2">
                        <li>
                          Send the exact payment to the wallet address shown
                          below
                        </li>
                        <li>
                          Current conversion rates are displayed in real-time
                        </li>
                        <li>Payment to be verified by the event organizer</li>
                      </ul>
                    </div>

                    <CryptoPaymentInfo
                      walletAddress={event.walletAddress}
                      ticketPrice={ticketPrice}
                      paymentMethod={paymentMethod}
                    />

                    <p className="text-muted small mt-3 mb-0 text-end">
                      Price Data from{" "}
                      <a
                        href="https://www.coingecko.com"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-muted"
                        style={{ textDecoration: "underline" }}
                      >
                        CoinGecko
                      </a>
                    </p>
                  </div>
                </div>
              );
            })()}

          {/* Vote Count Display - Only for voting-enabled events */}
          {event.enableVoting && (
            <div className="card mb-4">
              <div className="card-body">
                <h6 className="card-title mb-3 d-flex align-items-center">
                  <img
                    src="/vote-count-icon.png"
                    alt=""
                    width="20"
                    height="20"
                    className="me-2"
                    style={{ verticalAlign: "middle" }}
                  />
                  Vote Count
                </h6>
                <div className="text-center">
                  <div className="display-4 fw-bold text-primary">
                    {ticket.voteCount || 0}
                  </div>
                  <p className="text-muted mb-0">
                    {ticket.voteCount === 1 ? "vote" : "votes"} received
                  </p>
                  {ticket.isGoldenTicket && (ticket.voteCount || 0) > 0 && (
                    <p className="text-warning fw-bold mt-2">
                      🏆 Currently winning!
                    </p>
                  )}
                </div>
                {event.p2pValidation && (
                  <div className="alert alert-info mt-3 mb-0">
                    <small>
                      Votes are collected when other attendees validate this
                      ticket using P2P validation.
                    </small>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Validation Section */}
          <div className="card">
            <div className="card-body">
              <h5 className="card-title mb-3">
                <img
                  src="/shield-icon.png"
                  alt=""
                  width="20"
                  height="20"
                  className="me-2"
                  style={{
                    display: "inline-block",
                    verticalAlign: "text-bottom",
                  }}
                />
                Ticket Validation
              </h5>

              {/* Golden Ticket Badge - Only show for non-voting events */}
              {ticket.isGoldenTicket && !event.enableVoting && (
                <div className="alert alert-warning text-center mb-3">
                  <h5 className="mb-2">
                    <span className="badge bg-warning text-dark">
                      🎫 GOLDEN TICKET WINNER! 🎫
                    </span>
                  </h5>
                  <p className="mb-0">Congratulations!</p>
                </div>
              )}

              {ticket.isValidated &&
              event.reentryType === "No Reentry (Single Use)" &&
              !(event.enableVoting && event.p2pValidation) ? (
                <div className="text-center py-4">
                  <img
                    src="/check-icon.png"
                    alt=""
                    width="48"
                    height="48"
                    className="mb-3"
                  />
                  <h6 className="text-success">Ticket Used</h6>
                  <p className="text-muted">
                    Validated on{" "}
                    {new Date(ticket.validatedAt!).toLocaleDateString("en-US", {
                      month: "2-digit",
                      day: "2-digit",
                      year: "numeric",
                    })}
                    ,{" "}
                    {new Date(ticket.validatedAt!).toLocaleTimeString("en-US", {
                      hour12: false,
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    })}
                  </p>
                  <p className="text-muted small">
                    This is a single-use ticket and cannot be re-validated.
                  </p>
                </div>
              ) : ticket.isValidated &&
                event.reentryType === "Pass (Multiple Use)" &&
                (ticket.useCount || 0) >= (event.maxUses || 1) ? (
                <div className="text-center py-4">
                  <CheckCircle size={48} className="text-warning mb-3" />
                  <h6 className="text-warning">Ticket Uses Exhausted</h6>
                  <p className="text-muted">
                    This ticket has been used {ticket.useCount || 0} of{" "}
                    {event.maxUses} times.
                  </p>
                  <p className="text-muted small">
                    Last validated on{" "}
                    {new Date(ticket.validatedAt!).toLocaleString()}
                  </p>
                </div>
              ) : ticket.isValidated &&
                (event.reentryType === "Pass (Multiple Use)" ||
                  event.reentryType === "No Limit") ? (
                <div>
                  <div className="alert alert-info mb-3">
                    <h6 className="mb-2">
                      <img
                        src={gearIcon}
                        alt=""
                        width="18"
                        height="18"
                        className="me-2"
                        style={{
                          display: "inline-block",
                          verticalAlign: "text-bottom",
                        }}
                      />
                      Re-entry Ticket
                    </h6>
                    <p className="mb-2 small">
                      {event.reentryType === "No Limit"
                        ? `This ticket allows unlimited re-entry. Used ${ticket.useCount || 0} times.`
                        : `This ticket has been used ${ticket.useCount || 0} of ${event.maxUses} times.`}
                    </p>
                    <p className="mb-0 small">
                      Last validated on{" "}
                      {new Date(ticket.validatedAt!).toLocaleString()}
                    </p>
                  </div>

                  {/* Allow re-validation if within allowed uses */}
                  {isValidating ? (
                    <div>
                      {/* Timer Display */}
                      <div className="alert alert-info mb-3">
                        <div className="d-flex align-items-center">
                          <Clock size={20} className="me-2" />
                          <span>
                            Time remaining:{" "}
                            <strong>{formatTime(timeRemaining)}</strong>
                          </span>
                        </div>
                      </div>

                      {/* Validation Code Display - Prominent for mobile */}
                      <div className="text-center mb-3">
                        <div className="alert alert-success">
                          {currentCode && (
                            <div className="my-3">
                              <div
                                className="text-white rounded-3 p-4 mb-3"
                                style={{
                                  backgroundColor:
                                    eventTypeColors[currentColorIndex],
                                  transition: "background-color 0.5s ease",
                                }}
                              >
                                <p className="text-white-50 small mb-2">
                                  Tell the validator this code:
                                </p>
                                <h1
                                  className="display-3 mb-0 font-monospace fw-bold"
                                  style={{ letterSpacing: "0.3rem" }}
                                >
                                  {currentCode}
                                </h1>
                                <p className="text-white-50 small mt-2 mb-0">
                                  Changes every 10 seconds
                                </p>
                              </div>

                              <div className="alert alert-info small text-start">
                                <strong>📱 Instructions:</strong>
                                <ol className="mb-0 ps-3">
                                  <li>Show this code to the event validator</li>
                                  <li>
                                    They will enter it manually if QR scanning
                                    doesn't work
                                  </li>
                                  <li>
                                    The code refreshes automatically every 10
                                    seconds
                                  </li>
                                </ol>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Stop Button */}
                      <button
                        className="btn btn-secondary w-100"
                        onClick={stopValidation}
                        data-testid="button-stop-validation"
                      >
                        Stop Re-validation
                      </button>
                    </div>
                  ) : (
                    <div>
                      {!timeValidation.valid ? (
                        <div className="alert alert-warning mb-3">
                          <div className="d-flex align-items-center">
                            <img
                              src="/clock-warning-icon.png"
                              alt=""
                              width="20"
                              height="20"
                              className="me-2"
                              style={{ flexShrink: 0 }}
                            />
                            <div>
                              <h6 className="mb-1">
                                Re-validation Unavailable
                              </h6>
                              <p className="mb-0 small">
                                {timeValidation.message}
                              </p>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <p className="text-muted mb-3">
                          Click the button below to generate a new validation
                          code for re-entry. The code will be valid for 3
                          minutes.
                        </p>
                      )}
                      <button
                        className="btn btn-primary w-100"
                        onClick={() => {
                          // For geofenced events, request location first
                          if (event.geofence) {
                            if (navigator.geolocation) {
                              navigator.geolocation.getCurrentPosition(
                                (position) => {
                                  startValidationMutation.mutate({
                                    lat: position.coords.latitude,
                                    lng: position.coords.longitude,
                                  });
                                },
                                (error) => {
                                  toast({
                                    title: "Location Required",
                                    description:
                                      "Eventic needs your location to verify ticket.",
                                    variant: "destructive",
                                  });
                                },
                              );
                            } else {
                              toast({
                                title: "Location Not Supported",
                                description:
                                  "Your browser doesn't support location services.",
                                variant: "destructive",
                              });
                            }
                          } else {
                            startValidationMutation.mutate(undefined);
                          }
                        }}
                        disabled={
                          startValidationMutation.isPending ||
                          !timeValidation.valid
                        }
                        data-testid="button-revalidate-ticket"
                      >
                        {startValidationMutation.isPending ? (
                          <>
                            <span
                              className="spinner-border spinner-border-sm me-2"
                              role="status"
                              aria-hidden="true"
                            ></span>
                            Starting...
                          </>
                        ) : !timeValidation.valid ? (
                          <>
                            <img
                              src={expiredIcon}
                              alt=""
                              width="18"
                              height="18"
                              className="me-2"
                              style={{
                                display: "inline-block",
                                verticalAlign: "text-bottom",
                              }}
                            />
                            {timeValidation.message?.includes("begins")
                              ? "Please Wait"
                              : "Expired"}
                          </>
                        ) : (
                          <>
                            <img
                              src={gearIcon}
                              alt=""
                              width="18"
                              height="18"
                              className="me-2"
                              style={{
                                display: "inline-block",
                                verticalAlign: "text-bottom",
                              }}
                            />
                            Re-validate for Entry
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              ) : (event.enableVoting &&
                  event.p2pValidation &&
                  ticket.isValidated &&
                  isWithinVotingPeriod()) ||
                isValidating ? (
                <div>
                  {/* Only show timer for regular validation, not for voting */}
                  {!(
                    event.enableVoting &&
                    event.p2pValidation &&
                    ticket.isValidated
                  ) && (
                    <div className="alert alert-info mb-3">
                      <div className="d-flex align-items-center">
                        <Clock size={20} className="me-2" />
                        <span>
                          Time remaining:{" "}
                          <strong>{formatTime(timeRemaining)}</strong>
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Validation Code Display OR Voting Interface */}
                  {event.enableVoting &&
                  event.p2pValidation &&
                  ticket.isValidated &&
                  isWithinVotingPeriod() ? (
                    // Voting interface for already-validated voting tickets
                    <div className="mb-3">
                      <div className="alert alert-info mb-3">
                        <h6 className="mb-2">
                          <Users size={18} className="me-2" />
                          Your Voting Code
                        </h6>
                        <p className="small mb-2">
                          Share this code with other attendees so they can vote
                          for you:
                        </p>
                        <div className="bg-primary text-white rounded-3 p-3 text-center">
                          <h2
                            className="mb-0 font-monospace fw-bold"
                            style={{ letterSpacing: "0.3rem" }}
                          >
                            {ticket.validationCode}
                          </h2>
                        </div>
                      </div>

                      <div className="alert alert-light">
                        <h6 className="mb-2">
                          <span
                            style={{ fontSize: "18px", fontWeight: "bold" }}
                            className="me-2"
                          >
                            +1
                          </span>
                          Vote for Another Attendee
                        </h6>
                        <p className="small mb-2">Enter their vote code:</p>
                        <form
                          onSubmit={(e) => {
                            e.preventDefault();
                            const formData = new FormData(e.currentTarget);
                            const code = formData.get("voteCode") as string;
                            if (code && code.length >= 4) {
                              // Check if trying to vote for themselves
                              if (
                                code.toUpperCase() ===
                                ticket.validationCode?.toUpperCase()
                              ) {
                                setP2pVoteError(
                                  "Nice try ;) you can't vote for yourself Kyle.",
                                );
                                return;
                              }
                              p2pVoteMutation.mutate(code.toUpperCase());
                            }
                          }}
                        >
                          <input
                            type="text"
                            name="voteCode"
                            className="form-control mb-2"
                            placeholder="Enter vote code"
                            maxLength={5}
                            pattern="[0-9A-Za-z]{4,5}"
                            style={{ textTransform: "uppercase" }}
                            required
                            data-testid="input-vote-code"
                          />
                          <button
                            type="submit"
                            className="btn btn-primary w-100"
                            disabled={p2pVoteMutation.isPending}
                            data-testid="button-submit-vote"
                          >
                            {p2pVoteMutation.isPending ? (
                              <>
                                <span
                                  className="spinner-border spinner-border-sm me-2"
                                  role="status"
                                  aria-hidden="true"
                                ></span>
                                Voting...
                              </>
                            ) : (
                              "Vote"
                            )}
                          </button>
                        </form>
                        {p2pVoteError && (
                          <div className="alert alert-danger mt-2">
                            {p2pVoteError}
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    // Regular validation code display
                    <div className="text-center mb-3">
                      {currentCode && (
                        <div>
                          <div
                            className="text-white rounded-3 p-4 mb-3"
                            style={{
                              backgroundColor:
                                eventTypeColors[currentColorIndex],
                              transition: "background-color 0.5s ease",
                            }}
                          >
                            <p className="text-white-50 mb-2">
                              Tell the validator this code:
                            </p>
                            <h1
                              className="display-1 fw-bold mb-0"
                              style={{ letterSpacing: "0.5rem" }}
                            >
                              {currentCode}
                            </h1>
                            <p className="text-white-50 mt-2">
                              Changes every 10 seconds
                            </p>
                          </div>

                          <div className="alert alert-light">
                            <h6 className="mb-2">
                              <Shield size={18} className="me-2" />
                              Instructions:
                            </h6>
                            <ol className="mb-0 ps-3">
                              <li>Show this code at the event.</li>
                              <li>
                                The event needs to know the code to validate it.
                              </li>
                              <li>
                                Tickets cannot be resold after validation. Buy
                                the ticket, take the ride.
                              </li>
                            </ol>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Stop Button - different text for voting vs validation */}
                  <button
                    className="btn btn-secondary w-100"
                    onClick={() => {
                      if (
                        event.enableVoting &&
                        event.p2pValidation &&
                        ticket.isValidated &&
                        isWithinVotingPeriod()
                      ) {
                        // For voting, refresh the ticket data to update vote count
                        queryClient.invalidateQueries({
                          queryKey: [`/api/tickets/${ticketId}`],
                        });
                      } else {
                        // For regular validation, stop the session
                        stopValidation();
                      }
                    }}
                    data-testid="button-stop-validation"
                  >
                    {event.enableVoting &&
                    event.p2pValidation &&
                    ticket.isValidated &&
                    isWithinVotingPeriod()
                      ? "Refresh Vote Count"
                      : "Stop Validation"}
                  </button>
                </div>
              ) : (
                <div>
                  {!timeValidation.valid ? (
                    <div className="alert alert-warning mb-3">
                      <div className="d-flex align-items-center">
                        <img
                          src="/clock-warning-icon.png"
                          alt=""
                          width="20"
                          height="20"
                          className="me-2"
                          style={{ flexShrink: 0 }}
                        />
                        <div>
                          <h6 className="mb-1">Validation Unavailable</h6>
                          <p className="mb-0 small">{timeValidation.message}</p>
                        </div>
                      </div>
                    </div>
                  ) : event.enableVoting &&
                    event.p2pValidation &&
                    ticket.isValidated ? (
                    !isWithinVotingPeriod() ? (
                      <div className="alert alert-warning mb-3">
                        <div className="d-flex align-items-center">
                          <img
                            src="/clock-warning-icon.png"
                            alt=""
                            width="20"
                            height="20"
                            className="me-2"
                            style={{ flexShrink: 0 }}
                          />
                          <div>
                            <h6 className="mb-1">
                              {getVotingPeriodStatus().reason === "notStarted"
                                ? "Voting Not Yet Available"
                                : "Voting Period Ended"}
                            </h6>
                            <p className="mb-0 small">
                              {getVotingPeriodStatus().reason === "notStarted"
                                ? "Voting will be available when the event starts"
                                : "Voting is no longer available for this event"}
                            </p>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <p className="text-muted mb-3">
                        Click the button below to vote for other attendees. You
                        can enter their 4-digit codes during the validation
                        session.
                      </p>
                    )
                  ) : (
                    <p className="text-muted mb-3">
                      Click the button below to generate a time-limited
                      validation session. The QR code and manual entry code will
                      be valid for 3 minutes.
                    </p>
                  )}
                  {/* Geofencing Warning */}
                  {event.geofence && (
                    <div className="alert alert-warning mb-3">
                      <div className="d-flex align-items-center">
                        <img
                          src="/location-icon.png"
                          alt=""
                          width="20"
                          height="20"
                          className="me-2"
                          style={{ flexShrink: 0 }}
                        />
                        <div>
                          <h6 className="mb-1">Location Required</h6>
                          <p className="mb-0 small">
                            Validation must occur within 300 meters of the event
                            venue
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                  <button
                    className="btn btn-primary w-100"
                    onClick={() => {
                      // For geofenced events, request location first
                      if (event.geofence) {
                        if (navigator.geolocation) {
                          navigator.geolocation.getCurrentPosition(
                            (position) => {
                              startValidationMutation.mutate({
                                lat: position.coords.latitude,
                                lng: position.coords.longitude,
                              });
                            },
                            (error) => {
                              toast({
                                title: "Location Required",
                                description:
                                  "Eventic needs your location to verify ticket.",
                                variant: "destructive",
                              });
                            },
                          );
                        } else {
                          toast({
                            title: "Location Not Supported",
                            description:
                              "Your browser doesn't support location services.",
                            variant: "destructive",
                          });
                        }
                      } else {
                        startValidationMutation.mutate(undefined);
                      }
                    }}
                    disabled={
                      startValidationMutation.isPending ||
                      (!timeValidation.valid &&
                        !(
                          event.enableVoting &&
                          event.p2pValidation &&
                          ticket.isValidated
                        )) ||
                      (event.enableVoting &&
                        event.p2pValidation &&
                        ticket.isValidated &&
                        !isWithinVotingPeriod())
                    }
                    data-testid="button-validate-ticket"
                  >
                    {startValidationMutation.isPending ? (
                      <>
                        <span
                          className="spinner-border spinner-border-sm me-2"
                          role="status"
                          aria-hidden="true"
                        ></span>
                        Starting...
                      </>
                    ) : !timeValidation.valid &&
                      !(
                        event.enableVoting &&
                        event.p2pValidation &&
                        ticket.isValidated
                      ) ? (
                      <>
                        <img
                          src={expiredIcon}
                          alt=""
                          width="18"
                          height="18"
                          className="me-2"
                          style={{
                            display: "inline-block",
                            verticalAlign: "text-bottom",
                          }}
                        />
                        {timeValidation.message?.includes("begins")
                          ? "Please Wait"
                          : "Expired"}
                      </>
                    ) : event.enableVoting &&
                      event.p2pValidation &&
                      ticket.isValidated &&
                      !isWithinVotingPeriod() ? (
                      <>
                        <Clock size={18} className="me-2" />
                        {getVotingPeriodStatus().reason === "notStarted"
                          ? "Voting Starts at Event Time"
                          : "Voting Period Ended"}
                      </>
                    ) : event.enableVoting &&
                      event.p2pValidation &&
                      ticket.isValidated ? (
                      <>
                        <img
                          src="/shield-icon.png"
                          alt=""
                          width="18"
                          height="18"
                          className="me-2"
                          style={{
                            display: "inline-block",
                            verticalAlign: "text-bottom",
                          }}
                        />
                        Vote for Other Attendees
                      </>
                    ) : (
                      <>
                        <img
                          src="/shield-icon.png"
                          alt=""
                          width="18"
                          height="18"
                          className="me-2"
                          style={{
                            display: "inline-block",
                            verticalAlign: "text-bottom",
                          }}
                        />
                        Validate Ticket
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Event Rating Section */}
          {canRate && (
            <div className="card mt-3">
              <div className="card-body">
                <div className="d-flex justify-content-between align-items-center">
                  <div>
                    <h5 className="card-title mb-1">Rate Event</h5>
                    <p className="text-muted mb-0 small">
                      {hasRated
                        ? "Thank you for rating :)"
                        : "Thumbs up earns 1 credit, thumbs down costs 1 credit"}
                    </p>
                  </div>

                  <div className="d-flex gap-3 align-items-center">
                    <div className="d-flex flex-column align-items-center">
                      <button
                        className={`btn ${selectedRating === "thumbs_up" ? "btn-success" : "btn-outline-success"}`}
                        onClick={() => {
                          submitRatingMutation.mutate("thumbs_up");
                        }}
                        disabled={submitRatingMutation.isPending}
                        data-testid="button-thumbs-up"
                        style={{ padding: "8px 16px", minWidth: "60px" }}
                        title={
                          hasRated ? "Change rating (free)" : "Earns 1 credit"
                        }
                      >
                        <ThumbsUp size={18} />
                      </button>
                    </div>

                    <div className="d-flex flex-column align-items-center">
                      <button
                        className={`btn ${selectedRating === "thumbs_down" ? "btn-danger" : "btn-outline-danger"}`}
                        onClick={() => {
                          submitRatingMutation.mutate("thumbs_down");
                        }}
                        disabled={submitRatingMutation.isPending}
                        data-testid="button-thumbs-down"
                        style={{ padding: "8px 16px", minWidth: "60px" }}
                        title={
                          hasRated ? "Change rating (free)" : "Costs 1 credit"
                        }
                      >
                        <ThumbsDown size={18} />
                      </button>
                    </div>
                  </div>
                </div>

                {submitRatingMutation.isPending && (
                  <div className="text-center mt-2">
                    <div
                      className="spinner-border spinner-border-sm text-primary"
                      role="status"
                    >
                      <span className="visually-hidden">
                        Submitting rating...
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Rating Period Ended Message */}
          {ratingPeriodEnded && hasRated && (
            <div className="card mt-3">
              <div className="card-body">
                <div className="d-flex justify-content-between align-items-center">
                  <div>
                    <h5 className="card-title mb-1">Your Rating</h5>
                    <p className="text-muted mb-0 small">
                      Rating period has ended
                    </p>
                  </div>
                  <div>
                    {selectedRating === "thumbs_up" ? (
                      <span
                        className="text-success"
                        style={{ fontSize: "20px", fontWeight: "bold" }}
                      >
                        +1
                      </span>
                    ) : (
                      <span
                        className="text-danger"
                        style={{ fontSize: "20px", fontWeight: "bold" }}
                      >
                        -1
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* NFT Minting Section - Show for validated tickets with minting enabled */}
          {ticket.isValidated && event.allowMinting && nftEnabled?.enabled && (
            <div className="card mt-3">
              <div className="card-body">
                <h5 className="card-title mb-3">
                  <img
                    src="/nft-icon.png"
                    alt=""
                    width="20"
                    height="20"
                    className="me-2"
                    style={{ verticalAlign: "text-bottom" }}
                  />
                  Digital Collectable
                </h5>
                <p className="text-muted mb-3">
                  Mint your ticket into a permanent digital collectable! This is
                  delivered to your wallet as an NFT on the Base L2 network
                  (Ethereum). You will need a valid address to recieve it. This
                  is completely optional.
                </p>
                {/* Always use V2 button for user-controlled minting - more friendly approach */}
                <MintNFTButtonV2 ticket={ticket} event={event} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Hidden canvas for QR generation */}
      <canvas ref={canvasRef} style={{ display: "none" }} />
    </div>
  );
}
