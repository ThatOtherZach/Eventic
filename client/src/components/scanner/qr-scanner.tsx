import { useState, useRef, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Camera, CheckCircle, XCircle, AlertCircle, RotateCcw } from "lucide-react";
import QrScannerLib from "qr-scanner";
import type { Event, Ticket } from "@shared/schema";

interface ValidationResult {
  valid: boolean;
  message: string;
  ticket?: Ticket;
  event?: Event;
}

interface ValidationHistory {
  eventName: string;
  ticketNumber: string;
  timestamp: string;
  valid: boolean;
}

export function QrScanner() {
  const { toast } = useToast();
  const [isScanning, setIsScanning] = useState(false);
  const [hasCamera, setHasCamera] = useState<boolean | null>(null);
  const [cameraError, setCameraError] = useState<string>("");
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [recentValidations, setRecentValidations] = useState<ValidationHistory[]>([]);
  const [qrScanner, setQrScanner] = useState<QrScannerLib | null>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);

  const validateTicketMutation = useMutation({
    mutationFn: async (qrData: string) => {
      const response = await apiRequest("POST", "/api/validate", { qrData });
      return response.json();
    },
    onSuccess: (result: ValidationResult) => {
      setValidationResult(result);
      
      const validation: ValidationHistory = {
        eventName: result.event?.name || "Unknown Event",
        ticketNumber: result.ticket?.ticketNumber || "Unknown",
        timestamp: new Date().toLocaleTimeString(),
        valid: result.valid,
      };
      setRecentValidations(prev => [validation, ...prev.slice(0, 9)]);
      
      if (result.valid) {
        toast({
          title: "✅ Valid Ticket",
          description: `Ticket for ${result.event?.name} validated successfully`,
        });
      } else {
        toast({
          title: "❌ Invalid Ticket",
          description: result.message,
          variant: "destructive",
        });
      }
    },
    onError: (error: any) => {
      const result = {
        valid: false,
        message: error.message || "Failed to validate ticket",
      };
      setValidationResult(result);
      toast({
        title: "❌ Validation Error",
        description: result.message,
        variant: "destructive",
      });
    },
  });

  const checkCameraSupport = async () => {
    try {
      const hasCamera = await QrScannerLib.hasCamera();
      setHasCamera(hasCamera);
      return hasCamera;
    } catch (error) {
      console.error("Camera check failed:", error);
      setHasCamera(false);
      setCameraError("Camera support check failed");
      return false;
    }
  };

  const startScanner = async () => {
    if (!videoRef.current || isScanning) return;

    try {
      // Clean up any existing scanner first
      if (qrScanner) {
        qrScanner.stop();
        qrScanner.destroy();
        setQrScanner(null);
      }

      setCameraError("");
      setValidationResult(null);
      
      // Check camera support first
      const cameraAvailable = await checkCameraSupport();
      if (!cameraAvailable) {
        setCameraError("No camera found on this device");
        return;
      }

      // Create QR scanner instance
      const scanner = new QrScannerLib(
        videoRef.current,
        (result) => {
          if (result?.data) {
            console.log("QR Code detected:", result.data);
            validateTicketMutation.mutate(result.data);
          }
        },
        {
          highlightScanRegion: true,
          highlightCodeOutline: true,
          preferredCamera: "environment", // Use back camera on mobile
        }
      );

      await scanner.start();
      setQrScanner(scanner);
      setIsScanning(true);
      
      toast({
        title: "📷 Camera Started",
        description: "Point camera at QR code to scan",
      });

    } catch (error: any) {
      console.error("Camera start failed:", error);
      
      // Reset states on error
      setIsScanning(false);
      setQrScanner(null);
      
      let errorMessage = "Failed to access camera";
      
      if (error.name === "NotAllowedError") {
        errorMessage = "Camera permission denied. Please allow camera access and try again.";
      } else if (error.name === "NotFoundError") {
        errorMessage = "No camera found on this device";
      } else if (error.name === "NotSupportedError") {
        errorMessage = "Camera not supported in this browser";
      } else if (error.name === "NotReadableError") {
        errorMessage = "Camera is already in use by another application";
      }
      
      setCameraError(errorMessage);
      toast({
        title: "❌ Camera Error",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  const stopScanner = () => {
    try {
      if (qrScanner) {
        qrScanner.stop();
        qrScanner.destroy();
        setQrScanner(null);
      }
      
      // Clear video element
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      
      setIsScanning(false);
      setValidationResult(null);
      setCameraError("");
      
      toast({
        title: "📷 Camera Stopped",
        description: "Scanner has been stopped",
      });
    } catch (error) {
      console.error("Error stopping scanner:", error);
      // Force reset states even if cleanup fails
      setQrScanner(null);
      setIsScanning(false);
      setCameraError("");
    }
  };

  const resetValidation = () => {
    setValidationResult(null);
  };

  useEffect(() => {
    // Check camera support on component mount
    checkCameraSupport();

    // Cleanup on unmount
    return () => {
      if (qrScanner) {
        try {
          qrScanner.stop();
          qrScanner.destroy();
        } catch (error) {
          console.error("Cleanup error:", error);
        }
      }
    };
  }, [qrScanner]);

  // Additional cleanup effect for page visibility changes
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && isScanning) {
        stopScanner();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [isScanning]);

  return (
    <div className="animate-fade-in">
      {/* Camera Container */}
      <div className="card mb-4 overflow-hidden position-relative">
        <div className="scanner-container position-relative">
          {isScanning ? (
            <>
              <video
                ref={videoRef}
                className="w-100 h-100 object-fit-cover"
                data-testid="video-scanner"
                style={{ transform: "scaleX(-1)" }} // Mirror for better UX
              />
              
              {/* QR Code Targeting Overlay */}
              <div className="position-absolute top-50 start-50 translate-middle" 
                   style={{ width: "250px", height: "250px", zIndex: 10 }}>
                <div className="position-relative w-100 h-100">
                  {/* Corner brackets */}
                  <div className="position-absolute" style={{ top: "0", left: "0", width: "30px", height: "30px" }}>
                    <div className="border-top border-start border-3 border-primary w-100 h-100"></div>
                  </div>
                  <div className="position-absolute" style={{ top: "0", right: "0", width: "30px", height: "30px" }}>
                    <div className="border-top border-end border-3 border-primary w-100 h-100"></div>
                  </div>
                  <div className="position-absolute" style={{ bottom: "0", left: "0", width: "30px", height: "30px" }}>
                    <div className="border-bottom border-start border-3 border-primary w-100 h-100"></div>
                  </div>
                  <div className="position-absolute" style={{ bottom: "0", right: "0", width: "30px", height: "30px" }}>
                    <div className="border-bottom border-end border-3 border-primary w-100 h-100"></div>
                  </div>
                  
                  {/* Center guidance text */}
                  <div className="position-absolute top-50 start-50 translate-middle text-center">
                    <div className="bg-dark bg-opacity-75 text-white px-3 py-2 rounded">
                      <small className="fw-medium">Position QR code here</small>
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="scanner-placeholder d-flex flex-column align-items-center justify-content-center" data-testid="camera-placeholder">
              {hasCamera === false ? (
                <>
                  <AlertCircle className="text-danger mb-3" size={48} />
                  <p className="fw-medium text-danger mb-2">No Camera Available</p>
                  <p className="small text-muted text-center mb-0">
                    {cameraError || "This device doesn't have a camera or camera access is not available"}
                  </p>
                </>
              ) : (
                <>
                  <Camera className="text-muted mb-3" size={48} />
                  <p className="fw-medium mb-2">Ready to Scan</p>
                  <p className="small text-muted text-center mb-0">
                    Tap "Start Scanner" to begin scanning QR codes
                  </p>
                </>
              )}
            </div>
          )}
        </div>
        
        {/* Camera error overlay */}
        {cameraError && (
          <div className="position-absolute top-0 start-0 w-100 h-100 bg-danger bg-opacity-10 d-flex align-items-center justify-content-center">
            <div className="text-center text-danger">
              <AlertCircle size={32} className="mb-2" />
              <p className="fw-medium mb-1">Camera Error</p>
              <p className="small">{cameraError}</p>
            </div>
          </div>
        )}
      </div>

      {/* Scanner Controls */}
      <div className="row mb-4">
        <div className="col-6 pe-2">
          <button
            onClick={startScanner}
            disabled={isScanning || hasCamera === false}
            className="btn btn-primary w-100"
            data-testid="button-start-scanner"
          >
            <Camera className="me-2" size={18} />
            {isScanning ? "Scanning..." : "Start Scanner"}
          </button>
        </div>
        <div className="col-6 ps-2">
          <button
            onClick={stopScanner}
            disabled={!isScanning}
            className="btn btn-outline-secondary w-100"
            data-testid="button-stop-scanner"
          >
            <XCircle className="me-2" size={18} />
            Stop Scanner
          </button>
        </div>
      </div>

      {/* Validation Result */}
      {validationResult && (
        <div className="card mb-4" data-testid="scan-result">
          <div className="card-body">
            <div className="d-flex align-items-center mb-3">
              <div className={`rounded-circle p-2 me-3 d-flex align-items-center justify-content-center ${
                validationResult.valid ? "bg-success" : "bg-danger"
              }`} style={{ width: "40px", height: "40px" }}>
                {validationResult.valid ? (
                  <CheckCircle className="text-white" size={20} />
                ) : (
                  <XCircle className="text-white" size={20} />
                )}
              </div>
              <div className="flex-grow-1">
                <h6 className="fw-semibold mb-1">
                  {validationResult.valid ? "✅ Valid Ticket" : "❌ Invalid Ticket"}
                </h6>
                <p className="text-muted small mb-0">
                  {validationResult.valid ? "Ticket successfully validated" : validationResult.message}
                </p>
              </div>
            </div>

            {validationResult.valid && validationResult.event && validationResult.ticket && (
              <div className="bg-light rounded p-3 mb-3">
                <div className="row">
                  <div className="col-6 mb-2">
                    <span className="text-muted small">Event:</span>
                    <p className="fw-medium mb-0 small">{validationResult.event.name}</p>
                  </div>
                  <div className="col-6 mb-2">
                    <span className="text-muted small">Venue:</span>
                    <p className="fw-medium mb-0 small">{validationResult.event.venue}</p>
                  </div>
                  <div className="col-6 mb-2">
                    <span className="text-muted small">Ticket ID:</span>
                    <p className="fw-medium mb-0 small font-monospace">{validationResult.ticket.ticketNumber}</p>
                  </div>
                  <div className="col-6 mb-2">
                    <span className="text-muted small">Date & Time:</span>
                    <p className="fw-medium mb-0 small">{validationResult.event.date} {validationResult.event.time}</p>
                  </div>
                </div>
              </div>
            )}

            <button
              onClick={resetValidation}
              className="btn btn-primary w-100"
              data-testid="button-scan-another"
            >
              <RotateCcw className="me-2" size={18} />
              Scan Another Ticket
            </button>
          </div>
        </div>
      )}

      {/* Recent Validations */}
      <div className="card">
        <div className="card-header bg-white border-bottom">
          <h6 className="card-title mb-0 fw-medium">Recent Validations</h6>
        </div>
        <div className="card-body p-0" style={{ maxHeight: "300px", overflowY: "auto" }}>
          {recentValidations.length === 0 ? (
            <div className="p-4 text-center text-muted">
              <p className="small mb-0">No validations yet</p>
            </div>
          ) : (
            recentValidations.map((validation, index) => (
              <div 
                key={index} 
                className="d-flex align-items-center justify-content-between p-3 border-bottom"
                data-testid={`validation-${index}`}
              >
                <div className="d-flex align-items-center flex-grow-1">
                  <div className={`rounded-circle me-3 ${
                    validation.valid ? "bg-success" : "bg-danger"
                  }`} style={{ width: "8px", height: "8px" }}></div>
                  <div className="flex-grow-1">
                    <p className="fw-medium mb-1 small">{validation.eventName}</p>
                    <p className="text-muted mb-0" style={{ fontSize: "0.75rem" }}>
                      {validation.ticketNumber} • {validation.timestamp}
                    </p>
                  </div>
                </div>
                <span className={`badge ${
                  validation.valid ? "bg-success" : "bg-danger"
                } fw-medium`} style={{ fontSize: "0.65rem" }}>
                  {validation.valid ? "Valid" : "Invalid"}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}