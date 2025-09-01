import { useState, useEffect } from "react";
import { RotateCcw } from "lucide-react";
import customIcon from "@assets/image_1756530485392.png";
import errorIcon from "@assets/image_1756530597104.png";
import successIcon from "@assets/image_1756530807933.png";
import warningIcon from "@assets/image_1756530837845.png";
import spiderIcon from "@assets/image_1756530947341.png";
import lockIcon from "@assets/image_1756530985990.png";
import geofenceIcon from "@assets/image_1756580752162.png";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useNotifications } from "@/hooks/use-notifications";
import { Ticket, Event } from "@shared/schema";

interface ValidationResult {
  valid: boolean;
  message: string;
  ticket?: Ticket;
  event?: Event;
  canValidate?: boolean;
  isAuthentic?: boolean;
  alreadyValidated?: boolean;
  outsideValidTime?: boolean;
  requiresLocation?: boolean;
  outsideGeofence?: boolean;
  validatorDistance?: number;
  ticketHolderDistance?: number;
}

interface ValidationHistory {
  eventName: string;
  ticketNumber: string;
  timestamp: string;
  valid: boolean;
}

export function QrScannerImplementation() {
  const { toast } = useToast();
  const { addNotification } = useNotifications();
  const [validationResult, setValidationResult] =
    useState<ValidationResult | null>(null);
  const [recentValidations, setRecentValidations] = useState<
    ValidationHistory[]
  >([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [manualCode, setManualCode] = useState<string>("");
  const [needsGeofence, setNeedsGeofence] = useState(false);
  const [pendingCode, setPendingCode] = useState<string>("");
  const [buttonColorIndex, setButtonColorIndex] = useState(0);

  // Event badge colors to cycle through
  const badgeColors = [
    '#DC2626', // Mission Events - red
    '#FFD700', // Golden Ticket - gold
    '#10B981', // Minting Enabled - green
    '#8B5CF6', // Special Effects - purple
    '#EC4899', // Surge Pricing - pink
    '#F59E0B', // Sticker Drops - amber
    '#3B82F6', // Geofenced - blue
    '#14B8A6', // Voting Enabled - teal
    '#6366F1', // Recurring - indigo
  ];

  const validateTicketMutation = useMutation({
    mutationFn: async ({code, validatorLat, validatorLng, ticketHolderLat, ticketHolderLng}: {code: string, validatorLat?: number, validatorLng?: number, ticketHolderLat?: number, ticketHolderLng?: number}) => {
      // Add a 1.5 second delay to show the color animation
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      const response = await apiRequest("POST", "/api/validate", {
        qrData: code,
        validatorLat,
        validatorLng,
        ticketHolderLat,
        ticketHolderLng,
      });
      return response.json();
    },
    onSuccess: (result: any) => {
      // This will only be reached for successful validations now
      // since location-required responses return 400 status
      
      setValidationResult(result);

      const validation: ValidationHistory = {
        eventName: result.event?.name || "Unknown Event",
        ticketNumber: result.ticket?.ticketNumber || "Unknown",
        timestamp: new Date().toLocaleTimeString(),
        valid: result.valid && result.canValidate,
      };
      setRecentValidations((prev) => [validation, ...prev.slice(0, 99)]);

      if (result.valid && result.canValidate) {
        // Check if this is a golden ticket winner!
        if (result.ticket?.isGoldenTicket) {
          toast({
            title: "🎫 GOLDEN TICKET WINNER! 🎫",
            description: `CONGRATULATIONS! ${result.ticket?.ticketNumber} for ${result.event?.name} is a GOLDEN TICKET WINNER!`,
            className: "bg-yellow-100 border-yellow-400 text-yellow-900",
          });
        }
      } else if (result.isAuthentic && !result.canValidate) {
        // Ticket is authentic but user not authorized to validate
        // Don't show toast notification, just update the result
      } else if (result.alreadyValidated) {
        // Ticket was already validated
        toast({
          title: "⚠️ Already Validated",
          description: `This ticket for ${result.event?.name} has already been validated`,
          variant: "destructive",
        });
      } else if (result.outsideGeofence) {
        // Outside geofence area
        toast({
          title: "📍 Outside Event Area",
          description: result.message,
          variant: "destructive",
        });
      } else {
        // Invalid ticket
        toast({
          title: "404",
          description: "Invalid ticket",
          variant: "destructive",
        });
      }
    },
    onError: async (error: any) => {
      // Check if this is a location-required error (400: Location required for this event)
      if (error.message?.includes("Location required for this event")) {
        // Automatically request validator's location
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (position) => {
              // Retry validation with validator's location
              validateTicketMutation.mutate({
                code: pendingCode || manualCode,
                validatorLat: position.coords.latitude,
                validatorLng: position.coords.longitude,
              });
            },
            (err) => {
              toast({
                title: "Location Required",
                description: "Eventic needs your location to verify ticket.",
                variant: "destructive",
              });
            },
            {
              enableHighAccuracy: true,
              timeout: 10000,
              maximumAge: 0
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
        // Handle other errors normally
        const result = {
          valid: false,
          message: error.message || "Failed to validate ticket",
        };
        setValidationResult(result);
        addNotification({
          type: "error",
          title: "❌ Validation Error",
          description: result.message,
        });
      }
    },
  });

  // Cycle through colors when loading
  useEffect(() => {
    if (validateTicketMutation.isPending) {
      const interval = setInterval(() => {
        setButtonColorIndex((prev) => (prev + 1) % badgeColors.length);
      }, 500); // Change color every 0.5 seconds
      return () => clearInterval(interval);
    } else {
      setButtonColorIndex(0); // Reset when not loading
    }
  }, [validateTicketMutation.isPending, badgeColors.length]);

  const resetValidation = () => {
    setValidationResult(null);
  };

  
  const handleManualCodeSubmit = () => {
    if (!manualCode || manualCode.length !== 4) {
      toast({
        title: "❌ Invalid Code",
        description: "Please enter a 4-digit validation code",
        variant: "destructive",
      });
      return;
    }

    // Store the code and try validation
    setPendingCode(manualCode);
    validateTicketMutation.mutate({code: manualCode});
    setManualCode("");
  };


  return (
    <div className="animate-fade-in">
      {/* Manual Code Entry */}
      <div className="card mb-3 border-primary">
        <div className="card-body">
          <div className="d-flex justify-content-between align-items-center mb-3">
            <h6 className="card-title mb-0 text-primary">
              <img src={customIcon} alt="Validation" className="me-2" style={{ width: '18px', height: '18px' }} />
              Ticket Code Validation
            </h6>
          </div>

          <div className="alert alert-info small mb-3">
            Ask the ticket holder for the <strong>4-digit code</strong> shown on
            their ticket screen.
          </div>

          <div className="input-group input-group-lg mb-2">
            <input
              type="text"
              className={validateTicketMutation.isPending ? "form-control text-center font-monospace fw-bold fs-3 rainbow-text" : "form-control text-center font-monospace fw-bold fs-3"}
              placeholder="0000"
              value={manualCode}
              onChange={(e) => {
                const value = e.target.value.replace(/\D/g, "").slice(0, 4);
                setManualCode(value);
              }}
              onKeyPress={(e) => {
                if (e.key === "Enter" && manualCode.length === 4) {
                  handleManualCodeSubmit();
                }
              }}
              maxLength={4}
              pattern="[0-9]{4}"
              inputMode="numeric"
              autoComplete="off"
              autoFocus
              disabled={validateTicketMutation.isPending}
              data-testid="input-manual-code"
              style={{ letterSpacing: "0.5rem" }}
            />
            <button
              className={validateTicketMutation.isPending ? "btn btn-lg btn-color-cycling" : "btn btn-primary btn-lg"}
              onClick={handleManualCodeSubmit}
              disabled={
                validateTicketMutation.isPending || manualCode.length !== 4
              }
              data-testid="button-submit-code"
              style={validateTicketMutation.isPending ? {
                '--btn-color': badgeColors[buttonColorIndex],
                backgroundColor: badgeColors[buttonColorIndex],
                borderColor: badgeColors[buttonColorIndex],
                color: '#ffffff',
                opacity: 1,
                boxShadow: `0 0 10px ${badgeColors[buttonColorIndex]}40`
              } as React.CSSProperties : {}}
            >
              Validate
            </button>
          </div>

          <p className="small text-muted mb-3">Four digit codes only.</p>

          {manualCode.length > 0 && manualCode.length < 4 && (
            <small className="text-muted">
              Enter {4 - manualCode.length} more digit
              {4 - manualCode.length !== 1 ? "s" : ""}
            </small>
          )}
        </div>
      </div>

      {/* Geofence Location Request */}
      {needsGeofence && validationResult?.requiresLocation && (
        <div className="card mb-3 border-warning">
          <div className="card-body">
            <h6 className="card-title text-warning">
              <img src={warningIcon} alt="Location" className="me-2" style={{ width: '18px', height: '18px' }} />
              Location Required
            </h6>
            <p className="mb-3">
              This event has geofencing enabled. Both you and the ticket holder must be within 690 meters of the venue.
            </p>
            <div className="alert alert-info small mb-0">
              <strong>📍 Requesting location access...</strong><br/>
              Your browser will ask for permission to share your location. The ticket holder's location was already captured when they started validation.
            </div>
          </div>
        </div>
      )}

      {/* Validation Result */}
      {validationResult && !validationResult.requiresLocation && (
        <div className="card mb-4" data-testid="scan-result">
          <div className="card-body">
            <div className="d-flex align-items-center mb-3">
              <div
                className="me-3 d-flex align-items-center justify-content-center"
                style={{ width: "40px", height: "40px" }}
              >
                {validationResult.canValidate && validationResult.valid ? (
                  validationResult.ticket?.isGoldenTicket ? (
                    <img src={spiderIcon} alt="Golden Ticket" style={{ width: '30px', height: '30px' }} />
                  ) : (
                    <img src={successIcon} alt="Success" style={{ width: '30px', height: '30px' }} />
                  )
                ) : validationResult.outsideGeofence ? (
                  <img src={geofenceIcon} alt="Outside Geofence" style={{ width: '30px', height: '30px' }} />
                ) : validationResult.outsideValidTime || validationResult.alreadyValidated ? (
                  <img src={warningIcon} alt="Warning" style={{ width: '30px', height: '30px' }} />
                ) : validationResult.isAuthentic ? (
                  <img src={lockIcon} alt="Authentic" style={{ width: '30px', height: '30px' }} />
                ) : (
                  <img src={errorIcon} alt="Error" style={{ width: '30px', height: '30px' }} />
                )}
              </div>
              <div className="flex-grow-1">
                <h6 className="fw-semibold mb-1">
                  {validationResult.canValidate && validationResult.valid
                    ? "✅ Ticket Validated"
                    : validationResult.outsideGeofence
                      ? "📍 Outside Event Area"
                      : validationResult.outsideValidTime
                      ? "⏰ Outside Valid Time"
                      : validationResult.isAuthentic
                        ? "✔️ Authentic Ticket"
                        : validationResult.alreadyValidated
                          ? "⚠️ Already Validated"
                          : "404"}
                </h6>
                <p className="text-muted small mb-0">
                  {validationResult.valid ? (validationResult.message || "Ticket status checked") : "Invalid ticket"}
                </p>
              </div>
            </div>

            {validationResult.event && validationResult.ticket && (
              <div className="bg-light rounded p-3 mb-3">
                <div className="row">
                  <div className="col-6 mb-2">
                    <span className="text-muted small">Event:</span>
                    <p className="fw-medium mb-0 small">
                      {validationResult.event.name}
                    </p>
                  </div>
                  <div className="col-6 mb-2">
                    <span className="text-muted small">Venue:</span>
                    <p className="fw-medium mb-0 small">
                      {validationResult.event.venue}
                    </p>
                  </div>
                  <div className="col-6 mb-2">
                    <span className="text-muted small">Ticket ID:</span>
                    <p className="fw-medium mb-0 small font-monospace">
                      {validationResult.ticket.ticketNumber}
                    </p>
                  </div>
                  <div className="col-6 mb-2">
                    <span className="text-muted small">Date & Time:</span>
                    <p className="fw-medium mb-0 small">
                      {validationResult.event.date}{" "}
                      {validationResult.event.time}
                    </p>
                  </div>
                  {validationResult.ticket.isValidated && (
                    <div className="col-12 mt-2">
                      <span className="badge bg-secondary">
                        Already Validated
                      </span>
                    </div>
                  )}
                </div>

                {!validationResult.canValidate &&
                  validationResult.isAuthentic && (
                    <div className="alert alert-info mt-3 mb-0">
                      <small>
                        <strong>Note:</strong> Only the event owner or delegated
                        validators can mark tickets as validated.
                        <a
                          href={`/events/${validationResult.event.id}`}
                          className="alert-link ms-1"
                        >
                          View Event Details →
                        </a>
                      </small>
                    </div>
                  )}
              </div>
            )}

            <button
              onClick={resetValidation}
              className="btn btn-primary w-100"
              data-testid="button-scan-another"
            >
              <RotateCcw className="me-2" size={18} />
              Validate Another?
            </button>
          </div>
        </div>
      )}

      {/* Recent Validations */}
      <div className="card">
        <div className="card-header bg-white border-bottom">
          <h6 className="card-title mb-0 fw-medium">Recent</h6>
        </div>
        <div
          className="card-body p-0"
          style={{ maxHeight: "300px", overflowY: "auto" }}
        >
          {recentValidations.length === 0 ? (
            <div className="p-4 text-center text-muted">
              <p className="small mb-0">No validations yet :)</p>
            </div>
          ) : (
            <>
              <ul className="list-group list-group-flush">
                {recentValidations
                  .slice(currentPage * 25, (currentPage + 1) * 25)
                  .map((validation, index) => (
                    <li
                      key={currentPage * 25 + index}
                      className="list-group-item py-2"
                    >
                      <div className="d-flex justify-content-between align-items-center">
                        <div className="d-flex align-items-center">
                          {validation.valid ? (
                            <img src={successIcon} alt="Success" className="me-2" style={{ width: '16px', height: '16px' }} />
                          ) : (
                            <img src={errorIcon} alt="Error" className="me-2" style={{ width: '16px', height: '16px' }} />
                          )}
                          <div>
                            <p className="mb-0 small fw-medium">
                              {validation.eventName}
                            </p>
                            <p className="mb-0 small text-muted">
                              {validation.ticketNumber}
                            </p>
                          </div>
                        </div>
                        <small className="text-muted">
                          {validation.timestamp}
                        </small>
                      </div>
                    </li>
                  ))}
              </ul>

              {/* Pagination Controls */}
              {recentValidations.length > 25 && (
                <div className="p-3 border-top bg-light">
                  <div className="d-flex justify-content-between align-items-center">
                    <small className="text-muted">
                      Showing {currentPage * 25 + 1} -{" "}
                      {Math.min(
                        (currentPage + 1) * 25,
                        recentValidations.length,
                      )}{" "}
                      of {recentValidations.length}
                    </small>
                    <div className="btn-group" role="group">
                      <button
                        className="btn btn-sm btn-outline-secondary"
                        disabled={currentPage === 0}
                        onClick={() => setCurrentPage(currentPage - 1)}
                      >
                        Previous
                      </button>
                      <button
                        className="btn btn-sm btn-outline-secondary"
                        disabled={
                          (currentPage + 1) * 25 >= recentValidations.length
                        }
                        onClick={() => setCurrentPage(currentPage + 1)}
                      >
                        Next
                      </button>
                    </div>
                  </div>

                  {recentValidations.length >= 100 && (
                    <div className="alert alert-info mt-2 mb-0">
                      <small>
                        <strong>Note:</strong> For complete validation history,
                        visit the event page. Event owners can see all validated
                        tickets there.
                      </small>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
