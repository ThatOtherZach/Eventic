import { useState, useEffect, useRef } from "react";
import { useParams, Link, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { TicketCard } from "@/components/tickets/ticket-card";
import { MintNFTButton } from "@/components/registry/mint-nft-button";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Clock, CheckCircle, RefreshCw, ThumbsUp, ThumbsDown, MapPin, AlertTriangle, Shield, Users, Zap, HelpCircle } from "lucide-react";
import QRCode from "qrcode";
import type { Ticket, Event } from "@shared/schema";

interface ValidationSession {
  token: string;
  expiresAt: string;
}

// Helper function to check if a ticket is within its valid time window
function isTicketWithinValidTime(event: Event | undefined): { valid: boolean; message?: string } {
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
        validationStartTime = new Date(startDate.getTime() - 2 * 60 * 60 * 1000);
        break;
      // "At Start Time" uses the original start time
    }
    
    if (now < validationStartTime) {
      const timeDescription = earlyValidation === "At Start Time" 
        ? `at ${startDate.toLocaleString()}`
        : earlyValidation === "One Hour Before"
        ? `starting ${validationStartTime.toLocaleString()} (1 hour before event)`
        : `starting ${validationStartTime.toLocaleString()} (2 hours before event)`;
      
      return {
        valid: false,
        message: `Validation begins ${timeDescription}`
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
        message: `Event has ended. It ended on ${endDate.toLocaleString()}`
      };
    }
  } else {
    // No end date - check if we're within 24 hours of start
    const twentyFourHoursAfterStart = new Date(startDate.getTime() + 24 * 60 * 60 * 1000);
    if (now > twentyFourHoursAfterStart) {
      return {
        valid: false,
        message: `Ticket has expired. It was valid for 24 hours after ${startDate.toLocaleString()}`
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
  const [selectedRating, setSelectedRating] = useState<'thumbs_up' | 'thumbs_down' | null>(null);
  const [hasRated, setHasRated] = useState(false);
  const [canRate, setCanRate] = useState(false);
  const [ratingPeriodEnded, setRatingPeriodEnded] = useState(false);
  const [p2pVoteError, setP2pVoteError] = useState<string>("");
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isCharging, setIsCharging] = useState(false);
  const [userCredits, setUserCredits] = useState(0);

  // Fetch ticket details with polling during validation
  const { data: ticketData, isLoading, error } = useQuery<{ ticket: Ticket; event: Event }>({
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

  useEffect(() => {
    if (userBalance) {
      setUserCredits(userBalance.balance || 0);
    }
  }, [userBalance]);

  // Check if user has already rated
  const { data: ratingStatus } = useQuery({
    queryKey: [`/api/tickets/${ticketId}/rating`],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/tickets/${ticketId}/rating`);
      return response.json();
    },
    enabled: !!ticketId,
  });

  // Submit rating mutation
  const submitRatingMutation = useMutation({
    mutationFn: async (rating: 'thumbs_up' | 'thumbs_down') => {
      const response = await apiRequest("POST", `/api/tickets/${ticketId}/rate`, {
        rating
      });
      return response.json();
    },
    onSuccess: (data) => {
      setSelectedRating(data.rating.rating);
      setHasRated(true);
      toast({
        title: data.updated ? "Rating Updated" : "Rating Submitted",
        description: data.updated ? "Your rating has been updated!" : "Thank you for rating this event!",
      });
      // Invalidate rating queries to sync across tickets
      queryClient.invalidateQueries({ queryKey: [`/api/tickets/${ticketId}/rating`] });
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
        voterId: ticket.id
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
      const form = document.querySelector('[data-testid="input-vote-code"]') as HTMLInputElement;
      if (form) form.value = '';
    },
    onError: (error: any) => {
      setP2pVoteError(error.message || "Invalid validation code");
    },
  });

  // Start validation session mutation
  const startValidationMutation = useMutation({
    mutationFn: async (locationData?: {lat: number, lng: number}) => {
      const response = await apiRequest("POST", `/api/tickets/${ticketId}/validate-session`, locationData);
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
      await QRCode.toCanvas(
        canvasRef.current,
        token,
        {
          width: 200,
          margin: 2,
          color: {
            dark: "#000000",
            light: "#FFFFFF",
          },
        }
      );
      
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
      const response = await apiRequest("GET", `/api/tickets/${ticketId}/validation-token`);
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
    
    // Set up interval for token rotation
    intervalRef.current = setInterval(() => {
      fetchNewToken();
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

  // Check if within rating period (before event OR within 24 hours after start)
  const isWithinRatingPeriod = () => {
    if (!ticketData?.event) return false;
    const now = new Date();
    const startDateTime = `${ticketData.event.date}T${ticketData.event.time}:00`;
    const startDate = new Date(startDateTime);
    const hoursSinceStart = (now.getTime() - startDate.getTime()) / (1000 * 60 * 60);
    
    // Allow rating anytime before event or within 24 hours after start
    return hoursSinceStart <= 24;
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
    return `${mins}:${secs.toString().padStart(2, '0')}`;
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
          <p>The ticket you're looking for doesn't exist or you don't have access to it.</p>
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
        const [endYear, endMonth, endDay] = event.endDate.split('-').map(Number);
        eventEndDate = new Date(endYear, endMonth - 1, endDay);
        eventEndDate.setHours(23, 59, 59, 999);
      } catch {
        // Fall back to start date
      }
    }
    
    if (!eventEndDate && event.date) {
      try {
        const [year, month, day] = event.date.split('-').map(Number);
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
    const daysRemaining = Math.ceil((deletionDate.getTime() - now.getTime()) / msPerDay);
    
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
              <a className="text-decoration-none text-dark">{event.name} Ticket</a>
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
              <AlertTriangle size={18} className="me-2" />
              <span>
                {daysUntilDeletion} days until deletion
                {daysUntilDeletion <= 7 && (
                  <span className="ms-1">- data will be permanently removed soon</span>
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
          <div className="mb-4">
            <TicketCard 
              ticket={ticket} 
              event={event} 
              showQR={false}
              showBadges={true}
            />
          </div>

          {/* Ticket Details */}
          <div className="card mb-4">
            <div className="card-body">
              <h6 className="card-title mb-3">Ticket Details</h6>
              
              {/* Event Feature Badges */}
              <div className="d-flex flex-wrap gap-1 mb-3">
                {(event as any).isAdminCreated && (
                  <span className="badge" style={{ backgroundColor: '#DC2626', color: '#fff', fontSize: '0.8em' }}>
                    Mission
                  </span>
                )}
                {event.enableVoting && (
                  <span className="badge" style={{ backgroundColor: '#EAB308', color: '#fff', fontSize: '0.8em' }}>
                    Vote
                  </span>
                )}
                {event.allowMinting && (
                  <span className="badge" style={{ backgroundColor: '#000000', color: '#fff', fontSize: '0.8em' }}>
                    Collectable
                  </span>
                )}
                {event.p2pValidation && (
                  <span className="badge" style={{ backgroundColor: '#3B82F6', color: '#fff', fontSize: '0.8em' }}>
                    P2P Validation
                  </span>
                )}
                {event.goldenTicketEnabled && (
                  <span className="badge" style={{ backgroundColor: '#FFD700', color: '#000', fontSize: '0.8em' }}>
                    Golden Tickets
                  </span>
                )}
                {event.specialEffectsEnabled && (
                  <span className="badge" style={{ backgroundColor: '#9333EA', color: '#fff', fontSize: '0.8em' }}>
                    Special Effects
                  </span>
                )}
                {event.surgePricing && (
                  <span className="badge" style={{ backgroundColor: '#DC2626', color: '#fff', fontSize: '0.8em' }}>
                    Surge
                  </span>
                )}
                {event.stickerUrl && (
                  <span className="badge" style={{ backgroundColor: '#EC4899', color: '#fff', fontSize: '0.8em' }}>
                    Stickers
                  </span>
                )}
                {event.geofence && (
                  <span className="badge" style={{ backgroundColor: '#F59E0B', color: '#fff', fontSize: '0.8em' }}>
                    Location Lock
                  </span>
                )}
                {event.recurringType && (
                  <span className="badge" style={{ backgroundColor: '#059669', color: '#fff', fontSize: '0.8em' }}>
                    {event.recurringType === 'weekly' && 'Weekly'}
                    {event.recurringType === 'monthly' && 'Monthly'}
                    {event.recurringType === 'annually' && 'Annual'}
                  </span>
                )}
              </div>
              
              <div className="d-flex justify-content-between">
                <div>
                  <span className="text-muted">Purchase Date:</span>
                  <p className="mb-0 fw-bold">
                    {ticket.createdAt ? new Date(ticket.createdAt).toLocaleDateString('en-US', {
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric'
                    }) : 'Unknown'}
                  </p>
                </div>
                <div className="text-end">
                  <span className="text-muted">Purchase Price:</span>
                  <p className="mb-0 fw-bold">
                    ${ticket.purchasePrice || event.ticketPrice || '0.00'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Charge Ticket Section - Only show if event has special effects and stickers enabled, ticket not validated */}
          {event.specialEffectsEnabled && event.stickerUrl && !ticket.isCharged && !ticket.isValidated && (
            <div className="card mb-4">
              <div className="card-body">
                <h6 className="card-title mb-3">
                  <Zap size={18} className="me-2 text-warning" />
                  3 Tickets to Charge
                </h6>
                <p className="text-muted small mb-3">
                  Charge your ticket for better odds of special effects.
                  <HelpCircle 
                    size={14} 
                    className="ms-1" 
                    data-bs-toggle="tooltip" 
                    data-bs-placement="top" 
                    data-bs-title="Charging cuts the odds of all special effects in half, including golden tickets, monthly effects, day-driven effects, and criteria-driven special effects."
                    style={{ cursor: 'help' }}
                  />
                </p>
                <div className="alert alert-info small mb-3">
                  <strong>How it works:</strong>
                  <ul className="mb-0 mt-2">
                    <li>You have {userCredits} credits available</li>
                    <li>Charging costs 3 credits to improve this ticket's odds</li>
                    <li>Special effects odds will be cut in half (better chances)</li>
                    <li>Includes golden tickets, stickers, and all special effects</li>
                  </ul>
                </div>
                <button
                  className="btn btn-warning w-100"
                  onClick={async () => {
                    if (!confirm('Are you sure you want to charge this ticket? This will cost 3 credits to improve special effects odds.')) {
                      return;
                    }
                    setIsCharging(true);
                    try {
                      const response = await apiRequest("POST", `/api/tickets/${ticketId}/charge`, {});
                      if (response.ok) {
                        toast({
                          title: "Ticket Charged!",
                          description: "Your ticket now has improved special effects odds.",
                        });
                        // Refresh ticket data and balance
                        queryClient.invalidateQueries({ queryKey: [`/api/tickets/${ticketId}`] });
                        queryClient.invalidateQueries({ queryKey: [`/api/currency/balance`] });
                      } else {
                        const error = await response.json();
                        toast({
                          title: "Failed to charge ticket",
                          description: error.message || "Something went wrong",
                          variant: "destructive",
                        });
                      }
                    } catch (error) {
                      toast({
                        title: "Error",
                        description: "Failed to charge ticket",
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
                      <Zap size={18} className="me-2" />
                      Insufficient Credits
                    </>
                  ) : (
                    <>
                      <Zap size={18} className="me-2" />
                      Charge Ticket (3 Credits)
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
                  <Zap size={20} className="text-warning me-2" />
                  <div>
                    <h6 className="mb-0">Ticket Charged!</h6>
                    <p className="text-muted small mb-0">This ticket has improved special effects odds</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Vote Count Display - Only for voting-enabled events */}
          {event.enableVoting && (
            <div className="card mb-4">
              <div className="card-body">
                <h6 className="card-title mb-3">
                  <ThumbsUp size={18} className="me-2" />
                  Vote Count
                </h6>
                <div className="text-center">
                  <div className="display-4 fw-bold text-primary">
                    {ticket.voteCount || 0}
                  </div>
                  <p className="text-muted mb-0">
                    {ticket.voteCount === 1 ? 'vote' : 'votes'} received
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
                      Votes are collected when other attendees validate this ticket using P2P validation.
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
                <img src="/shield-icon.png" alt="" width="20" height="20" className="me-2" style={{ display: 'inline-block', verticalAlign: 'text-bottom' }} />
                Ticket Validation
              </h5>

              {/* Golden Ticket Badge - Only show for non-voting events */}
              {ticket.isGoldenTicket && !event.enableVoting && (
                <div className="alert alert-warning text-center mb-3">
                  <h5 className="mb-2">
                    <span className="badge bg-warning text-dark">🎫 GOLDEN TICKET WINNER! 🎫</span>
                  </h5>
                  <p className="mb-0">Congratulations!</p>
                </div>
              )}


              {ticket.isValidated && event.reentryType === 'No Reentry (Single Use)' && !(event.enableVoting && event.p2pValidation) ? (
                <div className="text-center py-4">
                  <CheckCircle size={48} className="text-success mb-3" />
                  <h6 className="text-success">Ticket Already Used</h6>
                  <p className="text-muted">
                    This ticket was validated on {new Date(ticket.validatedAt!).toLocaleString()}
                  </p>
                  <p className="text-muted small">
                    This is a single-use ticket and cannot be re-validated.
                  </p>
                </div>
              ) : ticket.isValidated && event.reentryType === 'Pass (Multiple Use)' && (ticket.useCount || 0) >= (event.maxUses || 1) ? (
                <div className="text-center py-4">
                  <CheckCircle size={48} className="text-warning mb-3" />
                  <h6 className="text-warning">Ticket Uses Exhausted</h6>
                  <p className="text-muted">
                    This ticket has been used {ticket.useCount || 0} of {event.maxUses} times.
                  </p>
                  <p className="text-muted small">
                    Last validated on {new Date(ticket.validatedAt!).toLocaleString()}
                  </p>
                </div>
              ) : ticket.isValidated && (event.reentryType === 'Pass (Multiple Use)' || event.reentryType === 'No Limit') ? (
                <div>
                  <div className="alert alert-info mb-3">
                    <h6 className="mb-2">
                      <RefreshCw size={18} className="me-2" />
                      Re-entry Ticket
                    </h6>
                    <p className="mb-2 small">
                      {event.reentryType === 'No Limit' 
                        ? `This ticket allows unlimited re-entry. Used ${ticket.useCount || 0} times.`
                        : `This ticket has been used ${ticket.useCount || 0} of ${event.maxUses} times.`
                      }
                    </p>
                    <p className="mb-0 small">
                      Last validated on {new Date(ticket.validatedAt!).toLocaleString()}
                    </p>
                  </div>
                  
                  {/* Allow re-validation if within allowed uses */}
                  {isValidating ? (
                    <div>
                      {/* Timer Display */}
                      <div className="alert alert-info mb-3">
                        <div className="d-flex align-items-center">
                          <Clock size={20} className="me-2" />
                          <span>Time remaining: <strong>{formatTime(timeRemaining)}</strong></span>
                        </div>
                      </div>

                      {/* Validation Code Display - Prominent for mobile */}
                      <div className="text-center mb-3">
                        <div className="alert alert-success">
                          
                          {currentCode && (
                            <div className="my-3">
                              <div className="bg-primary text-white rounded-3 p-4 mb-3">
                                <p className="text-white-50 small mb-2">Tell the validator this code:</p>
                                <h1 className="display-3 mb-0 font-monospace fw-bold" style={{ letterSpacing: '0.3rem' }}>
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
                                  <li>They will enter it manually if QR scanning doesn't work</li>
                                  <li>The code refreshes automatically every 10 seconds</li>
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
                            <img src="/clock-warning-icon.png" alt="" width="20" height="20" className="me-2" style={{ flexShrink: 0 }} />
                            <div>
                              <h6 className="mb-1">Re-validation Unavailable</h6>
                              <p className="mb-0 small">{timeValidation.message}</p>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <p className="text-muted mb-3">
                          Click the button below to generate a new validation code for re-entry.
                          The code will be valid for 3 minutes.
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
                                    lng: position.coords.longitude
                                  });
                                },
                                (error) => {
                                  toast({
                                    title: "Location Required",
                                    description: "Eventic needs your location to verify ticket.",
                                    variant: "destructive",
                                  });
                                }
                              );
                            } else {
                              toast({
                                title: "Location Not Supported",
                                description: "Your browser doesn't support location services.",
                                variant: "destructive",
                              });
                            }
                          } else {
                            startValidationMutation.mutate(undefined);
                          }
                        }}
                        disabled={startValidationMutation.isPending || !timeValidation.valid}
                        data-testid="button-revalidate-ticket"
                      >
                        {startValidationMutation.isPending ? (
                          <>
                            <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                            Starting...
                          </>
                        ) : !timeValidation.valid ? (
                          <>
                            <Clock size={18} className="me-2" />
                            {timeValidation.message?.includes('begins') ? 'Please Wait' : 'Expired'}
                          </>
                        ) : (
                          <>
                            <RefreshCw size={18} className="me-2" />
                            Re-validate for Entry
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              ) : (event.enableVoting && event.p2pValidation && ticket.isValidated) || isValidating ? (
                <div>
                  {/* Only show timer for regular validation, not for voting */}
                  {!(event.enableVoting && event.p2pValidation && ticket.isValidated) && (
                    <div className="alert alert-info mb-3">
                      <div className="d-flex align-items-center">
                        <Clock size={20} className="me-2" />
                        <span>Time remaining: <strong>{formatTime(timeRemaining)}</strong></span>
                      </div>
                    </div>
                  )}

                  {/* Validation Code Display OR Voting Interface */}
                  {event.enableVoting && event.p2pValidation && ticket.isValidated ? (
                    // Voting interface for already-validated voting tickets
                    <div className="mb-3">
                      <div className="alert alert-info mb-3">
                        <h6 className="mb-2">
                          <Users size={18} className="me-2" />
                          Your Voting Code
                        </h6>
                        <p className="small mb-2">Share this code with other attendees so they can vote for you:</p>
                        <div className="bg-primary text-white rounded-3 p-3 text-center">
                          <h2 className="mb-0 font-monospace fw-bold" style={{ letterSpacing: '0.3rem' }}>
                            {ticket.validationCode}
                          </h2>
                        </div>
                      </div>
                      
                      <div className="alert alert-light">
                        <h6 className="mb-2">
                          <ThumbsUp size={18} className="me-2" />
                          Vote for Another Attendee
                        </h6>
                        <p className="small mb-2">Enter their vote code:</p>
                        <form onSubmit={(e) => {
                          e.preventDefault();
                          const formData = new FormData(e.currentTarget);
                          const code = formData.get('voteCode') as string;
                          if (code && code.length >= 4) {
                            // Check if trying to vote for themselves
                            if (code.toUpperCase() === ticket.validationCode?.toUpperCase()) {
                              setP2pVoteError("Nice try ;) you can't vote for yourself Kyle.");
                              return;
                            }
                            p2pVoteMutation.mutate(code.toUpperCase());
                          }
                        }}>
                          <input
                            type="text"
                            name="voteCode"
                            className="form-control mb-2"
                            placeholder="Enter vote code"
                            maxLength={5}
                            pattern="[0-9A-Za-z]{4,5}"
                            style={{ textTransform: 'uppercase' }}
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
                                <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                                Voting...
                              </>
                            ) : (
                              'Vote'
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
                          <div className="bg-primary text-white rounded-3 p-4 mb-3">
                            <p className="text-white-50 mb-2">Tell the validator this code:</p>
                            <h1 className="display-1 fw-bold mb-0" style={{ letterSpacing: '0.5rem' }}>
                              {currentCode}
                            </h1>
                            <p className="text-white-50 mt-2">Changes every 10 seconds</p>
                          </div>
                          
                          <div className="alert alert-light">
                            <h6 className="mb-2">
                              <Shield size={18} className="me-2" />
                              Instructions:
                            </h6>
                            <ol className="mb-0 ps-3">
                              <li>Show this code at the event.</li>
                              <li>The event needs to know the code to validate it.</li>
                              <li>Tickets cannot be resold after validation. Buy the ticket, take the ride.</li>
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
                      if (event.enableVoting && event.p2pValidation && ticket.isValidated) {
                        // For voting, refresh the ticket data to update vote count
                        queryClient.invalidateQueries({ queryKey: [`/api/tickets/${ticketId}`] });
                      } else {
                        // For regular validation, stop the session
                        stopValidation();
                      }
                    }}
                    data-testid="button-stop-validation"
                  >
                    {event.enableVoting && event.p2pValidation && ticket.isValidated 
                      ? 'Refresh Vote Count' 
                      : 'Stop Validation'}
                  </button>
                </div>
              ) : (
                <div>
                  {!timeValidation.valid ? (
                    <div className="alert alert-warning mb-3">
                      <div className="d-flex align-items-center">
                        <img src="/clock-warning-icon.png" alt="" width="20" height="20" className="me-2" style={{ flexShrink: 0 }} />
                        <div>
                          <h6 className="mb-1">Validation Unavailable</h6>
                          <p className="mb-0 small">{timeValidation.message}</p>
                        </div>
                      </div>
                    </div>
                  ) : event.enableVoting && event.p2pValidation && ticket.isValidated ? (
                    <p className="text-muted mb-3">
                      Click the button below to vote for other attendees.
                      You can enter their 4-digit codes during the validation session.
                    </p>
                  ) : (
                    <p className="text-muted mb-3">
                      Click the button below to generate a time-limited validation session. 
                      The QR code and manual entry code will be valid for 3 minutes.
                    </p>
                  )}
                  {/* Geofencing Warning */}
                  {event.geofence && (
                    <div className="alert alert-warning mb-3">
                      <div className="d-flex align-items-center">
                        <img src="/location-icon.png" alt="" width="20" height="20" className="me-2" style={{ flexShrink: 0 }} />
                        <div>
                          <h6 className="mb-1">Location Required</h6>
                          <p className="mb-0 small">Validation must occur within 690 meters of the event venue</p>
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
                                lng: position.coords.longitude
                              });
                            },
                            (error) => {
                              toast({
                                title: "Location Required",
                                description: "Eventic needs your location to verify ticket.",
                                variant: "destructive",
                              });
                            }
                          );
                        } else {
                          toast({
                            title: "Location Not Supported",
                            description: "Your browser doesn't support location services.",
                            variant: "destructive",
                          });
                        }
                      } else {
                        startValidationMutation.mutate(undefined);
                      }
                    }}
                    disabled={startValidationMutation.isPending || !timeValidation.valid}
                    data-testid="button-validate-ticket"
                  >
                    {startValidationMutation.isPending ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                        Starting...
                      </>
                    ) : !timeValidation.valid ? (
                      <>
                        <Clock size={18} className="me-2" />
                        {timeValidation.message?.includes('begins') ? 'Please Wait' : 'Expired'}
                      </>
                    ) : event.enableVoting && event.p2pValidation && ticket.isValidated ? (
                      <>
                        <img src="/shield-icon.png" alt="" width="18" height="18" className="me-2" style={{ display: 'inline-block', verticalAlign: 'text-bottom' }} />
                        Vote for Other Attendees
                      </>
                    ) : (
                      <>
                        <img src="/shield-icon.png" alt="" width="18" height="18" className="me-2" style={{ display: 'inline-block', verticalAlign: 'text-bottom' }} />
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
                      {hasRated ? 'You can change your rating' : 'How is the event?'}
                    </p>
                  </div>
                  
                  <div className="d-flex gap-2">
                    <button
                      className={`btn ${selectedRating === 'thumbs_up' ? 'btn-success' : 'btn-outline-success'}`}
                      onClick={() => {
                        submitRatingMutation.mutate('thumbs_up');
                      }}
                      disabled={submitRatingMutation.isPending}
                      data-testid="button-thumbs-up"
                      style={{ padding: '8px 16px' }}
                    >
                      <ThumbsUp size={20} />
                    </button>
                    
                    <button
                      className={`btn ${selectedRating === 'thumbs_down' ? 'btn-danger' : 'btn-outline-danger'}`}
                      onClick={() => {
                        submitRatingMutation.mutate('thumbs_down');
                      }}
                      disabled={submitRatingMutation.isPending}
                      data-testid="button-thumbs-down"
                      style={{ padding: '8px 16px' }}
                    >
                      <ThumbsDown size={20} />
                    </button>
                  </div>
                </div>
                
                {submitRatingMutation.isPending && (
                  <div className="text-center mt-2">
                    <div className="spinner-border spinner-border-sm text-primary" role="status">
                      <span className="visually-hidden">Submitting rating...</span>
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
                    <p className="text-muted mb-0 small">Rating period has ended</p>
                  </div>
                  <div>
                    {selectedRating === 'thumbs_up' ? (
                      <span className="text-success"><ThumbsUp size={20} /></span>
                    ) : (
                      <span className="text-danger"><ThumbsDown size={20} /></span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Show rating status if already rated */}
          {hasRated && (
            <div className="card mt-3">
              <div className="card-body">
                <div className="text-center">
                  <CheckCircle size={24} className="text-success mb-2" />
                  <h6 className="mb-0">Thank you for rating this event!</h6>
                </div>
              </div>
            </div>
          )}

          {/* NFT Minting Section */}
          {ticket.isValidated && event.allowMinting && (
            <div className="card mt-3">
              <div className="card-body">
                <h5 className="card-title mb-3">
                  <Shield size={20} className="me-2" />
                  NFT Registry
                </h5>
                <p className="text-muted mb-3">
                  Convert your validated ticket into a permanent NFT record. NFTs can be collected and may have value in the future marketplace.
                </p>
                <MintNFTButton ticket={ticket} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Hidden canvas for QR generation */}
      <canvas ref={canvasRef} style={{ display: 'none' }} />
    </div>
  );
}