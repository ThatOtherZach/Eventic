import { useRef, useState, useEffect, useCallback } from "react";
import QrScanner from "qr-scanner";
import { Camera, CheckCircle, XCircle, Play, Square, AlertCircle, RotateCcw } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Ticket, Event } from "@shared/schema";

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

export function QrScannerImplementation() {
  const { toast } = useToast();
  const [isScanning, setIsScanning] = useState(false);
  const [hasCamera, setHasCamera] = useState<boolean | null>(null);
  const [cameraError, setCameraError] = useState<string>("");
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [recentValidations, setRecentValidations] = useState<ValidationHistory[]>([]);
  const [debugInfo, setDebugInfo] = useState<string[]>([]);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const scannerRef = useRef<QrScanner | null>(null);

  const addDebugInfo = (message: string) => {
    console.log("QR Scanner:", message);
    setDebugInfo(prev => [message, ...prev.slice(0, 4)]);
  };

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

  const onScanSuccess = useCallback((result: QrScanner.ScanResult) => {
    addDebugInfo(`✅ QR Code detected: ${result.data.substring(0, 50)}...`);
    
    // Stop scanning temporarily to prevent multiple scans
    if (scannerRef.current) {
      scannerRef.current.stop();
      setIsScanning(false);
    }
    
    // Validate the ticket
    validateTicketMutation.mutate(result.data);
  }, [validateTicketMutation]);

  const onScanError = useCallback((error: string | Error) => {
    // Ignore "No QR code found" errors as they're normal during scanning
    if (typeof error === 'string' && error.includes('No QR code found')) {
      return;
    }
    addDebugInfo(`❌ Scan error: ${error}`);
  }, []);

  const checkCameraSupport = async () => {
    try {
      addDebugInfo("Checking camera support...");
      
      const hasSupport = await QrScanner.hasCamera();
      setHasCamera(hasSupport);
      
      if (!hasSupport) {
        setCameraError("No camera found on this device");
        addDebugInfo("❌ No camera found");
      } else {
        addDebugInfo("✅ Camera available");
      }
      
      return hasSupport;
    } catch (error: any) {
      addDebugInfo(`❌ Camera check failed: ${error.message}`);
      setHasCamera(false);
      setCameraError("Camera support check failed");
      return false;
    }
  };

  const startScanner = async () => {
    try {
      addDebugInfo("🚀 Starting scanner...");
      
      // Reset states
      setCameraError("");
      setValidationResult(null);
      
      if (!videoRef.current) {
        addDebugInfo("❌ No video element");
        return;
      }
      
      // Create QR scanner instance
      if (!scannerRef.current) {
        scannerRef.current = new QrScanner(
          videoRef.current,
          onScanSuccess,
          {
            onDecodeError: onScanError,
            highlightScanRegion: true,
            highlightCodeOutline: true,
            preferredCamera: 'environment', // Use back camera on mobile
          }
        );
      }
      
      // Start scanning
      await scannerRef.current.start();
      setIsScanning(true);
      addDebugInfo("✅ Scanner started successfully");
      
      toast({
        title: "📷 Scanner Active",
        description: "Point the camera at a QR code to scan",
      });
    } catch (error: any) {
      addDebugInfo(`❌ Failed to start scanner: ${error.message}`);
      setIsScanning(false);
      
      let errorMessage = "Failed to start scanner";
      if (error.name === "NotAllowedError") {
        errorMessage = "Camera permission denied. Please allow camera access.";
      } else if (error.name === "NotFoundError") {
        errorMessage = "No camera found on this device";
      }
      
      setCameraError(errorMessage);
      toast({
        title: "❌ Scanner Error",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  const stopScanner = () => {
    try {
      addDebugInfo("🛑 Stopping scanner...");
      
      if (scannerRef.current) {
        scannerRef.current.stop();
        setIsScanning(false);
        addDebugInfo("✅ Scanner stopped");
      }
      
      setValidationResult(null);
      setCameraError("");
      
      toast({
        title: "📷 Scanner Stopped",
        description: "Scanner has been stopped",
      });
    } catch (error: any) {
      addDebugInfo(`❌ Error stopping scanner: ${error.message}`);
    }
  };

  const resetValidation = () => {
    setValidationResult(null);
    if (scannerRef.current && !isScanning) {
      startScanner();
    }
  };

  const clearDebugInfo = () => {
    setDebugInfo([]);
  };

  const testScan = () => {
    addDebugInfo("🧪 Simulating QR scan for testing...");
    // Test with a fake validation token
    const testToken = "VAL-test-" + Date.now();
    validateTicketMutation.mutate(testToken);
  };

  useEffect(() => {
    addDebugInfo("📱 Component mounted, checking camera...");
    checkCameraSupport();
    
    // Cleanup on unmount
    return () => {
      if (scannerRef.current) {
        scannerRef.current.destroy();
        scannerRef.current = null;
      }
    };
  }, []);

  return (
    <div className="animate-fade-in">
      {/* Camera Container */}
      <div className="card mb-4 overflow-hidden position-relative">
        <div className="scanner-container position-relative">
          {/* Video element for QR scanning */}
          <video
            ref={videoRef}
            className="w-100 h-100 object-fit-cover"
            data-testid="video-scanner"
            style={{ 
              display: isScanning ? "block" : "none",
              minHeight: "400px"
            }}
          />
          
          {!isScanning && (
            <div className="scanner-placeholder d-flex flex-column align-items-center justify-content-center" style={{ minHeight: "400px" }} data-testid="camera-placeholder">
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
      </div>

      {/* Scanner Controls */}
      <div className="row mb-4">
        <div className="col-4 pe-1">
          <button
            onClick={startScanner}
            disabled={isScanning || hasCamera === false || validateTicketMutation.isPending}
            className="btn btn-primary w-100"
            data-testid="button-start-scanner"
          >
            <Play className="me-1" size={16} />
            Start
          </button>
        </div>
        <div className="col-4 px-1">
          <button
            onClick={stopScanner}
            disabled={!isScanning}
            className="btn btn-outline-secondary w-100"
            data-testid="button-stop-scanner"
          >
            <Square className="me-1" size={16} />
            Stop
          </button>
        </div>
        <div className="col-4 ps-1">
          <button
            onClick={testScan}
            disabled={validateTicketMutation.isPending}
            className="btn btn-outline-info w-100"
            data-testid="button-test-scan"
          >
            Test
          </button>
        </div>
      </div>

      {/* Debug Info */}
      <div className="card mb-4">
        <div className="card-header bg-light d-flex justify-content-between align-items-center">
          <h6 className="card-title mb-0">Debug Info</h6>
          <button onClick={clearDebugInfo} className="btn btn-sm btn-outline-secondary">Clear</button>
        </div>
        <div className="card-body">
          <div className="small">
            <p className="mb-1"><strong>Has Camera:</strong> {hasCamera === null ? "Checking..." : hasCamera ? "✅ Yes" : "❌ No"}</p>
            <p className="mb-1"><strong>Is Scanning:</strong> {isScanning ? "✅ Yes" : "❌ No"}</p>
            <p className="mb-1"><strong>Processing:</strong> {validateTicketMutation.isPending ? "✅ Yes" : "❌ No"}</p>
            {cameraError && <p className="mb-2 text-danger"><strong>Error:</strong> {cameraError}</p>}
            
            <div className="mt-2">
              <strong>Debug Log:</strong>
              <div className="bg-dark text-light p-2 rounded mt-1" style={{ fontSize: "0.75rem", maxHeight: "150px", overflowY: "auto" }}>
                {debugInfo.length === 0 ? (
                  <div className="text-muted">No debug info yet...</div>
                ) : (
                  debugInfo.map((info, index) => (
                    <div key={index} className="mb-1">{info}</div>
                  ))
                )}
              </div>
            </div>
          </div>
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
              <p className="small mb-0">No validations yet - scan a QR code to validate tickets</p>
            </div>
          ) : (
            <ul className="list-group list-group-flush">
              {recentValidations.map((validation, index) => (
                <li key={index} className="list-group-item py-2">
                  <div className="d-flex justify-content-between align-items-center">
                    <div className="d-flex align-items-center">
                      {validation.valid ? (
                        <CheckCircle className="text-success me-2" size={16} />
                      ) : (
                        <XCircle className="text-danger me-2" size={16} />
                      )}
                      <div>
                        <p className="mb-0 small fw-medium">{validation.eventName}</p>
                        <p className="mb-0 small text-muted">{validation.ticketNumber}</p>
                      </div>
                    </div>
                    <small className="text-muted">{validation.timestamp}</small>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}