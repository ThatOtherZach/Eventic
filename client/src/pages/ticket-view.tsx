import { useState, useEffect, useRef } from "react";
import { useParams, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { TicketCard } from "@/components/tickets/ticket-card";
import { MintNFTButton } from "@/components/registry/mint-nft-button";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Shield, Clock, CheckCircle, RefreshCw, ThumbsUp, ThumbsDown } from "lucide-react";
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
        message: `Ticket validation begins ${timeDescription}`
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
  const { toast } = useToast();
  const [isValidating, setIsValidating] = useState(false);
  const [currentToken, setCurrentToken] = useState<string>("");
  const [currentCode, setCurrentCode] = useState<string>("");
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [selectedRating, setSelectedRating] = useState<'thumbs_up' | 'thumbs_down' | null>(null);
  const [hasRated, setHasRated] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Fetch ticket details
  const { data: ticketData, isLoading, error } = useQuery<{ ticket: Ticket; event: Event }>({
    queryKey: [`/api/tickets/${ticketId}`],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/tickets/${ticketId}`);
      return response.json();
    },
  });

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
    onSuccess: () => {
      setHasRated(true);
      toast({
        title: "Rating Submitted",
        description: "Thank you for rating this event!",
      });
      // Invalidate all ticket rating queries for this event to sync across tickets
      queryClient.invalidateQueries({ queryKey: ['/api/tickets'] });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Rating Failed",
        description: error.message || "Could not submit rating",
      });
    },
  });

  // Start validation session mutation
  const startValidationMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/tickets/${ticketId}/validate-session`);
      return response.json();
    },
    onSuccess: (data: ValidationSession) => {
      setIsValidating(true);
      setTimeRemaining(180); // 3 minutes in seconds
      startTokenRotation();
      startCountdown();
      toast({
        title: "Validation Started",
        description: "Show the QR code or validation code to the scanner.",
      });
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
  };

  // Check if ticket is already validated on mount and after mutations
  useEffect(() => {
    if (ticketData?.ticket?.isValidated) {
      stopValidation();
    }
  }, [ticketData?.ticket?.isValidated]);

  // Check if event has started (for showing rating option)
  const isEventStarted = () => {
    if (!ticketData?.event) return false;
    const now = new Date();
    const startDateTime = `${ticketData.event.date}T${ticketData.event.time}:00`;
    const startDate = new Date(startDateTime);
    return now >= startDate;
  };

  // Update hasRated state when rating status changes
  useEffect(() => {
    if (ratingStatus?.hasRated) {
      setHasRated(true);
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
          <h1 className="h3 fw-bold">{event.name} Ticket</h1>
          <p className="text-muted">View and validate your ticket</p>
        </div>
      </div>

      {/* Ticket and Validation Section */}
      <div className="row justify-content-center">
        <div className="col-12 col-md-8 col-lg-6">
          {/* Ticket Display */}
          <div className="mb-4">
            <TicketCard 
              ticket={ticket} 
              event={event} 
              showQR={false}
            />
          </div>

          {/* Validation Section */}
          <div className="card">
            <div className="card-body">
              <h5 className="card-title mb-3">
                <Shield size={20} className="me-2" />
                Ticket Validation
              </h5>

              {/* Golden Ticket Badge */}
              {ticket.isGoldenTicket && (
                <div className="alert alert-warning text-center mb-3">
                  <h5 className="mb-2">
                    <span className="badge bg-warning text-dark">🎫 GOLDEN TICKET WINNER! 🎫</span>
                  </h5>
                  <p className="mb-0">Congratulations! This ticket won the golden ticket contest!</p>
                </div>
              )}

              {ticket.isValidated && event.reentryType === 'No Reentry (Single Use)' ? (
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
                          <h6 className="mb-2">✅ Re-validation Active</h6>
                          
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
                            <Clock size={20} className="me-2" />
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
                        onClick={() => startValidationMutation.mutate()}
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
                            Re-validation Expired
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
              ) : isValidating ? (
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
                      <h6 className="mb-2">✅ Validation Active</h6>
                      
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
                      
                      <p className="small text-muted mb-0">
                        The QR code on your ticket also updates every 10 seconds
                      </p>
                    </div>
                  </div>

                  {/* Stop Button */}
                  <button
                    className="btn btn-secondary w-100"
                    onClick={stopValidation}
                    data-testid="button-stop-validation"
                  >
                    Stop Validation
                  </button>
                </div>
              ) : (
                <div>
                  {!timeValidation.valid ? (
                    <div className="alert alert-warning mb-3">
                      <div className="d-flex align-items-center">
                        <Clock size={20} className="me-2" />
                        <div>
                          <h6 className="mb-1">Ticket Validation Unavailable</h6>
                          <p className="mb-0 small">{timeValidation.message}</p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="text-muted mb-3">
                      Click the button below to generate a time-limited validation session. 
                      The QR code and manual entry code will be valid for 3 minutes.
                    </p>
                  )}
                  <button
                    className="btn btn-primary w-100"
                    onClick={() => startValidationMutation.mutate()}
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
                        Validation Expired
                      </>
                    ) : (
                      <>
                        <Shield size={18} className="me-2" />
                        Validate Ticket
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Event Rating Section */}
          {isEventStarted() && !hasRated && (
            <div className="card mt-3">
              <div className="card-body">
                <div className="d-flex justify-content-between align-items-center">
                  <div>
                    <h5 className="card-title mb-1">Rate Event</h5>
                    <p className="text-muted mb-0 small">How is the event?</p>
                  </div>
                  
                  <div className="d-flex gap-2">
                    <button
                      className={`btn ${selectedRating === 'thumbs_up' ? 'btn-success' : 'btn-outline-success'}`}
                      onClick={() => {
                        setSelectedRating('thumbs_up');
                        submitRatingMutation.mutate('thumbs_up');
                      }}
                      disabled={submitRatingMutation.isPending || hasRated}
                      data-testid="button-thumbs-up"
                      style={{ padding: '8px 16px' }}
                    >
                      <ThumbsUp size={20} />
                    </button>
                    
                    <button
                      className={`btn ${selectedRating === 'thumbs_down' ? 'btn-danger' : 'btn-outline-danger'}`}
                      onClick={() => {
                        setSelectedRating('thumbs_down');
                        submitRatingMutation.mutate('thumbs_down');
                      }}
                      disabled={submitRatingMutation.isPending || hasRated}
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