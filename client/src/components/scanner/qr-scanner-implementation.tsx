import { useRef, useState, useEffect, useCallback } from "react";
import QrScanner from "qr-scanner";
import { Camera, CheckCircle, XCircle, Play, Square, AlertCircle, RotateCcw, Keyboard } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
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
  const [selectedCamera, setSelectedCamera] = useState<string>('environment');
  const [availableCameras, setAvailableCameras] = useState<{ id: string; label: string }[]>([]);
  const [manualCode, setManualCode] = useState<string>("");
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  
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
    onSuccess: (result: any) => {
      setValidationResult(result);
      
      const validation: ValidationHistory = {
        eventName: result.event?.name || "Unknown Event",
        ticketNumber: result.ticket?.ticketNumber || "Unknown",
        timestamp: new Date().toLocaleTimeString(),
        valid: result.valid && result.canValidate,
      };
      setRecentValidations(prev => [validation, ...prev.slice(0, 9)]);
      
      if (result.valid && result.canValidate) {
        // User is authorized and ticket was validated
        toast({
          title: "✅ Ticket Validated",
          description: `Ticket for ${result.event?.name} has been validated successfully`,
        });
      } else if (result.isAuthentic && !result.canValidate) {
        // Ticket is authentic but user not authorized to validate
        toast({
          title: "✔️ Authentic Ticket",
          description: `Valid ticket for ${result.event?.name}, but you're not authorized to validate. Only the event owner or delegated validators can validate.`,
        });
      } else if (result.alreadyValidated) {
        // Ticket was already validated
        toast({
          title: "⚠️ Already Validated",
          description: `This ticket for ${result.event?.name} has already been validated`,
          variant: "destructive",
        });
      } else {
        // Invalid ticket
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
      
      // First check if we're on HTTPS (required for camera on mobile)
      if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') {
        addDebugInfo("⚠️ Not on HTTPS - camera may not work");
      }
      
      // Check for camera availability
      const hasSupport = await QrScanner.hasCamera();
      setHasCamera(hasSupport);
      
      if (!hasSupport) {
        setCameraError("No camera found on this device");
        addDebugInfo("❌ No camera found");
      } else {
        addDebugInfo("✅ Camera available");
        
        // List available cameras for debugging
        try {
          const cameras = await QrScanner.listCameras(true);
          addDebugInfo(`📷 Found ${cameras.length} camera(s)`);
          cameras.forEach((camera, index) => {
            addDebugInfo(`  ${index + 1}. ${camera.label || camera.id}`);
          });
        } catch (e) {
          addDebugInfo("Could not list cameras");
        }
      }
      
      return hasSupport;
    } catch (error: any) {
      const errorMsg = error?.message || String(error);
      addDebugInfo(`❌ Camera check failed: ${errorMsg}`);
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
      
      // Destroy existing scanner if any
      if (scannerRef.current) {
        try {
          scannerRef.current.destroy();
        } catch (e) {
          // Ignore destroy errors
        }
        scannerRef.current = null;
      }
      
      // Create QR scanner instance with mobile-optimized settings
      scannerRef.current = new QrScanner(
        videoRef.current,
        onScanSuccess,
        {
          onDecodeError: onScanError,
          highlightScanRegion: true,
          highlightCodeOutline: true,
          preferredCamera: selectedCamera, // Use selected camera
          calculateScanRegion: (video) => {
            // Make scan region larger on mobile for better detection
            const smallestDimension = Math.min(video.videoWidth, video.videoHeight);
            const scanRegionSize = Math.round(0.75 * smallestDimension);
            return {
              x: Math.round((video.videoWidth - scanRegionSize) / 2),
              y: Math.round((video.videoHeight - scanRegionSize) / 2),
              width: scanRegionSize,
              height: scanRegionSize,
            };
          },
        }
      );
      
      // Start scanning with better error details
      await scannerRef.current.start();
      setIsScanning(true);
      addDebugInfo("✅ Scanner started successfully");
      
      toast({
        title: "📷 Scanner Active",
        description: "Point the camera at a QR code to scan",
      });
    } catch (error: any) {
      const errorMsg = error?.message || error?.name || String(error) || "Unknown error";
      addDebugInfo(`❌ Failed to start scanner: ${errorMsg}`);
      setIsScanning(false);
      
      let errorMessage = "Failed to start scanner";
      if (error?.name === "NotAllowedError" || errorMsg.includes("NotAllowed")) {
        errorMessage = "Camera permission denied. Please allow camera access in your browser settings.";
      } else if (error?.name === "NotFoundError" || errorMsg.includes("NotFound")) {
        errorMessage = "No camera found on this device";
      } else if (error?.name === "NotReadableError" || errorMsg.includes("NotReadable")) {
        errorMessage = "Camera is already in use by another app. Please close other camera apps and try again.";
      } else if (error?.name === "OverconstrainedError" || errorMsg.includes("Overconstrained")) {
        errorMessage = "Camera settings not supported. Try using manual code entry instead.";
        setShowManualEntry(true);
      } else {
        errorMessage = `Camera error: ${errorMsg}. Try manual code entry if camera doesn't work.`;
        setShowManualEntry(true);
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
    } catch (error: any) {
      addDebugInfo(`❌ Error stopping scanner: ${error?.message || String(error)}`);
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

  const handleManualCodeSubmit = () => {
    if (!manualCode || manualCode.length !== 4) {
      toast({
        title: "❌ Invalid Code",
        description: "Please enter a 4-digit validation code",
        variant: "destructive",
      });
      return;
    }
    
    addDebugInfo(`🕹️ Manual code entered: ${manualCode}`);
    validateTicketMutation.mutate(manualCode);
    setManualCode("");
  };

  useEffect(() => {
    // Detect mobile device
    const userAgent = navigator.userAgent.toLowerCase();
    const mobile = /mobile|android|iphone|ipad|phone/i.test(userAgent);
    setIsMobile(mobile);
    
    // Auto-show manual entry on mobile
    if (mobile) {
      setShowManualEntry(true);
      addDebugInfo("📱 Mobile device detected - showing manual entry");
    }
    
    addDebugInfo("📱 Component mounted, checking camera...");
    checkCameraSupport().then(async (hasSupport) => {
      if (hasSupport) {
        try {
          const cameras = await QrScanner.listCameras(true);
          setAvailableCameras(cameras.map(cam => ({
            id: cam.id,
            label: cam.label || `Camera ${cam.id.slice(-4)}`
          })));
        } catch (e) {
          addDebugInfo("Could not enumerate cameras");
        }
      }
    });
    
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
            className="w-100 h-100"
            data-testid="video-scanner"
            playsInline
            muted
            style={{ 
              display: isScanning ? "block" : "none",
              minHeight: "400px",
              maxHeight: "500px",
              objectFit: "cover",
              backgroundColor: "#000"
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
                  <p className="small text-muted text-center mb-3">
                    {isMobile ? (
                      "Camera may not work on mobile. Use manual code entry above."
                    ) : (
                      "Tap 'Start Scanner' to begin scanning QR codes"
                    )}
                  </p>
                  {cameraError && (
                    <div className="alert alert-warning small mt-3">
                      <strong>Tip:</strong> {cameraError}
                      {!showManualEntry && (
                        <div className="mt-2">
                          <button
                            className="btn btn-sm btn-warning"
                            onClick={() => setShowManualEntry(true)}
                          >
                            Use Manual Code Entry
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Camera Selection and Manual Entry */}
      {availableCameras.length > 1 && (
        <div className="card mb-3">
          <div className="card-body">
            <label className="form-label small fw-medium">Select Camera:</label>
            <select 
              className="form-select"
              value={selectedCamera}
              onChange={(e) => {
                setSelectedCamera(e.target.value);
                if (isScanning) {
                  stopScanner();
                  setTimeout(() => startScanner(), 100);
                }
              }}
              disabled={isScanning}
            >
              <option value="environment">Back Camera (Default)</option>
              <option value="user">Front Camera</option>
              {availableCameras.map((cam) => (
                <option key={cam.id} value={cam.id}>
                  {cam.label}
                </option>
              ))}
            </select>
            <small className="text-muted d-block mt-1">
              If the scanner shows a black screen, try switching cameras
            </small>
          </div>
        </div>
      )}
      
      {/* Manual Code Entry */}
      <div className={`card mb-3 ${isMobile ? 'border-primary border-2' : ''}`}>
        <div className="card-body">
          <div className="d-flex justify-content-between align-items-center mb-3">
            <h6 className="card-title mb-0">
              <Keyboard className="me-2" size={18} />
              Manual Code Entry
              {isMobile && <span className="badge bg-primary ms-2">Recommended</span>}
            </h6>
            {!isMobile && (
              <button
                className="btn btn-sm btn-outline-primary"
                onClick={() => setShowManualEntry(!showManualEntry)}
              >
                {showManualEntry ? "Hide" : "Show"}
              </button>
            )}
          </div>
          
          {showManualEntry && (
            <>
              <p className="small text-muted mb-3">
                {isMobile ? (
                  <>
                    <strong className="text-primary">Mobile users:</strong> Camera may not work properly on mobile browsers. 
                    Ask the ticket holder for their 4-digit validation code shown on their screen.
                  </>
                ) : (
                  "If QR scanning doesn't work, the ticket holder can provide a 4-digit code that refreshes every 10 seconds."
                )}
              </p>
              <div className="input-group">
                <input
                  type="text"
                  className="form-control text-center font-monospace fw-bold"
                  placeholder="Enter 4-digit code"
                  value={manualCode}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, '').slice(0, 4);
                    setManualCode(value);
                  }}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      handleManualCodeSubmit();
                    }
                  }}
                  maxLength={4}
                  disabled={validateTicketMutation.isPending}
                  data-testid="input-manual-code"
                />
                <button
                  className="btn btn-primary"
                  onClick={handleManualCodeSubmit}
                  disabled={validateTicketMutation.isPending || manualCode.length !== 4}
                  data-testid="button-submit-code"
                >
                  Validate
                </button>
              </div>
            </>
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
            <p className="mb-1"><strong>Browser:</strong> {navigator.userAgent.includes('Mobile') ? '📱 Mobile' : '💻 Desktop'}</p>
            {availableCameras.length > 0 && (
              <p className="mb-1"><strong>Cameras Found:</strong> {availableCameras.length}</p>
            )}
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
                validationResult.canValidate && validationResult.valid ? "bg-success" : 
                validationResult.outsideValidTime ? "bg-warning" :
                validationResult.isAuthentic ? "bg-info" : "bg-danger"
              }`} style={{ width: "40px", height: "40px" }}>
                {validationResult.valid ? (
                  <CheckCircle className="text-white" size={20} />
                ) : (
                  <XCircle className="text-white" size={20} />
                )}
              </div>
              <div className="flex-grow-1">
                <h6 className="fw-semibold mb-1">
                  {validationResult.canValidate && validationResult.valid ? "✅ Ticket Validated" : 
                   validationResult.outsideValidTime ? "⏰ Outside Valid Time" :
                   validationResult.isAuthentic ? "✔️ Authentic Ticket" :
                   validationResult.alreadyValidated ? "⚠️ Already Validated" : "❌ Invalid Ticket"}
                </h6>
                <p className="text-muted small mb-0">
                  {validationResult.message || "Ticket status checked"}
                </p>
              </div>
            </div>

            {validationResult.event && validationResult.ticket && (
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
                  {validationResult.ticket.isValidated && (
                    <div className="col-12 mt-2">
                      <span className="badge bg-secondary">Already Validated</span>
                    </div>
                  )}
                </div>
                
                {!validationResult.canValidate && validationResult.isAuthentic && (
                  <div className="alert alert-info mt-3 mb-0">
                    <small>
                      <strong>Note:</strong> Only the event owner or delegated validators can mark tickets as validated. 
                      <a href={`/events/${validationResult.event.id}`} className="alert-link ms-1">View Event Details →</a>
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