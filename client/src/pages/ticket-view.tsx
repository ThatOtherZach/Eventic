import { useState, useEffect, useRef } from "react";
import { useParams, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { TicketCard } from "@/components/tickets/ticket-card";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Shield, Clock, CheckCircle } from "lucide-react";
import QRCode from "qrcode";
import type { Ticket, Event } from "@shared/schema";

interface ValidationSession {
  token: string;
  expiresAt: string;
}

export default function TicketViewPage(): React.ReactElement {
  const { ticketId } = useParams<{ ticketId: string }>();
  const { toast } = useToast();
  const [isValidating, setIsValidating] = useState(false);
  const [currentToken, setCurrentToken] = useState<string>("");
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
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
        description: "Show the QR code to the scanner. It will refresh every 10 seconds.",
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
        <div className="col">
          <h1 className="h3 fw-bold">Ticket Details</h1>
          <p className="text-muted">View and validate your ticket</p>
        </div>
      </div>

      {/* Ticket Display */}
      <div className="row mb-4">
        <div className="col-12 col-md-6">
          <TicketCard 
            ticket={ticket} 
            event={event} 
            showQR={!isValidating} 
          />
        </div>

        {/* Validation Section */}
        <div className="col-12 col-md-6">
          <div className="card">
            <div className="card-body">
              <h5 className="card-title mb-3">
                <Shield size={20} className="me-2" />
                Ticket Validation
              </h5>

              {ticket.isValidated ? (
                <div className="text-center py-4">
                  <CheckCircle size={48} className="text-success mb-3" />
                  <h6 className="text-success">Ticket Already Validated</h6>
                  <p className="text-muted">
                    This ticket was validated on {new Date(ticket.validatedAt!).toLocaleString()}
                  </p>
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

                  {/* Dynamic QR Code */}
                  <div className="text-center mb-3">
                    <h6 className="mb-3">Show this QR code to the scanner</h6>
                    <div className="bg-white p-3 rounded border d-inline-block">
                      {qrDataUrl ? (
                        <img src={qrDataUrl} alt="Validation QR Code" style={{ width: '200px', height: '200px' }} />
                      ) : (
                        <div style={{ width: '200px', height: '200px' }} className="d-flex align-items-center justify-content-center">
                          <div className="spinner-border text-primary" role="status">
                            <span className="visually-hidden">Loading QR...</span>
                          </div>
                        </div>
                      )}
                    </div>
                    <p className="text-muted small mt-2">
                      QR code refreshes every 10 seconds
                    </p>
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
                  <p className="text-muted mb-3">
                    Click the button below to generate a time-limited validation code. 
                    The QR code will be valid for 3 minutes and can only be used once.
                  </p>
                  <button
                    className="btn btn-primary w-100"
                    onClick={() => startValidationMutation.mutate()}
                    disabled={startValidationMutation.isPending}
                    data-testid="button-validate-ticket"
                  >
                    {startValidationMutation.isPending ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                        Starting...
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
        </div>
      </div>

      {/* Hidden canvas for QR generation */}
      <canvas ref={canvasRef} style={{ display: 'none' }} />
    </div>
  );
}