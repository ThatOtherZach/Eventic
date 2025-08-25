import { useState, useRef, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Camera, CheckCircle, XCircle, AlertCircle, RotateCcw, Play, Square } from "lucide-react";
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
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [debugInfo, setDebugInfo] = useState<string[]>([]);
  
  const videoRef = useRef<HTMLVideoElement>(null);

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
      setRecentValidations(prev => [validation, ...prev.slice(0, 99)]);
      
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
      addDebugInfo("Checking camera support...");
      
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        addDebugInfo("❌ No mediaDevices support");
        setHasCamera(false);
        setCameraError("Camera not supported in this browser");
        return false;
      }

      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(device => device.kind === 'videoinput');
      const cameraAvailable = videoDevices.length > 0;
      
      addDebugInfo(`${cameraAvailable ? "✅" : "❌"} Found ${videoDevices.length} camera(s)`);
      
      setHasCamera(cameraAvailable);
      if (!cameraAvailable) {
        setCameraError("No camera found on this device");
      }
      return cameraAvailable;
    } catch (error: any) {
      addDebugInfo(`❌ Camera check failed: ${error.message}`);
      setHasCamera(false);
      setCameraError("Camera support check failed");
      return false;
    }
  };

  const handleStartClick = () => {
    addDebugInfo("🔵 Start button clicked!");
    
    if (isScanning) {
      addDebugInfo("❌ Already scanning, ignoring click");
      return;
    }

    if (!videoRef.current) {
      addDebugInfo("❌ No video element reference");
      return;
    }

    startScanner();
  };

  const startScanner = async () => {
    try {
      addDebugInfo("🚀 Starting scanner...");
      
      // Reset states
      setCameraError("");
      setValidationResult(null);
      
      // Stop any existing stream
      if (stream) {
        addDebugInfo("🛑 Stopping existing stream");
        stream.getTracks().forEach(track => track.stop());
        setStream(null);
      }

      // Check camera support
      const cameraAvailable = await checkCameraSupport();
      if (!cameraAvailable) {
        addDebugInfo("❌ Camera not available, stopping");
        return;
      }

      addDebugInfo("📷 Requesting camera access...");
      
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: { ideal: "environment" },
          width: { ideal: 640 },
          height: { ideal: 480 }
        }
      });

      addDebugInfo("✅ Camera access granted!");
      
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        addDebugInfo("✅ Video stream set");
      }
      
      setStream(mediaStream);
      setIsScanning(true);

      toast({
        title: "📷 Camera Started",
        description: "Camera is now active",
      });

    } catch (error: any) {
      addDebugInfo(`❌ Camera start failed: ${error.name} - ${error.message}`);
      
      // Reset states on error
      setIsScanning(false);
      setStream(null);
      
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

  const handleStopClick = () => {
    addDebugInfo("🔴 Stop button clicked!");
    stopScanner();
  };

  const stopScanner = () => {
    try {
      addDebugInfo("🛑 Stopping scanner...");
      
      // Stop media stream
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
        setStream(null);
        addDebugInfo("✅ Stream stopped");
      }
      
      // Clear video element
      if (videoRef.current) {
        videoRef.current.srcObject = null;
        addDebugInfo("✅ Video cleared");
      }
      
      setIsScanning(false);
      setValidationResult(null);
      setCameraError("");
      
      toast({
        title: "📷 Camera Stopped",
        description: "Scanner has been stopped",
      });

    } catch (error: any) {
      addDebugInfo(`❌ Error stopping scanner: ${error.message}`);
      // Force reset states even if cleanup fails
      setIsScanning(false);
      setStream(null);
      setCameraError("");
    }
  };

  const resetValidation = () => {
    setValidationResult(null);
  };

  const clearDebugInfo = () => {
    setDebugInfo([]);
  };

  const simulateQRScan = () => {
    addDebugInfo("🧪 Simulating QR scan for testing...");
    // Create a fake QR data for testing
    const testQrData = JSON.stringify({
      eventId: "test-event-123",
      ticketNumber: "TEST-001",
      timestamp: Date.now(),
    });
    validateTicketMutation.mutate(testQrData);
  };

  useEffect(() => {
    addDebugInfo("📱 Component mounted, checking camera...");
    checkCameraSupport();
  }, []);

  return (
    <div className="animate-fade-in">
      {/* Camera Container */}
      <div className="card mb-4 overflow-hidden position-relative">
        <div className="scanner-container position-relative">
          {/* Video element always present but conditionally visible */}
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-100 h-100 object-fit-cover"
            data-testid="video-scanner"
            style={{ 
              transform: "scaleX(-1)",
              display: isScanning ? "block" : "none"
            }}
          />
          
          {isScanning && (
            <>
              {/* QR Code Targeting Overlay */}
              <div className="position-absolute top-50 start-50 translate-middle" 
                   style={{ width: "250px", height: "250px", zIndex: 10 }}>
                <div className="position-relative w-100 h-100">
                  {/* Corner brackets */}
                  <div className="position-absolute" style={{ top: "0", left: "0", width: "30px", height: "30px" }}>
                    <div className="border-top border-start border-3 border-white w-100 h-100" style={{ boxShadow: "0 0 0 1px rgba(0,0,0,0.3)" }}></div>
                  </div>
                  <div className="position-absolute" style={{ top: "0", right: "0", width: "30px", height: "30px" }}>
                    <div className="border-top border-end border-3 border-white w-100 h-100" style={{ boxShadow: "0 0 0 1px rgba(0,0,0,0.3)" }}></div>
                  </div>
                  <div className="position-absolute" style={{ bottom: "0", left: "0", width: "30px", height: "30px" }}>
                    <div className="border-bottom border-start border-3 border-white w-100 h-100" style={{ boxShadow: "0 0 0 1px rgba(0,0,0,0.3)" }}></div>
                  </div>
                  <div className="position-absolute" style={{ bottom: "0", right: "0", width: "30px", height: "30px" }}>
                    <div className="border-bottom border-end border-3 border-white w-100 h-100" style={{ boxShadow: "0 0 0 1px rgba(0,0,0,0.3)" }}></div>
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
          )}

          {!isScanning && (
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
      </div>

      {/* Scanner Controls */}
      <div className="row mb-4">
        <div className="col-4 pe-1">
          <button
            onClick={handleStartClick}
            disabled={isScanning || hasCamera === false}
            className="btn btn-primary w-100"
            data-testid="button-start-scanner"
          >
            <Play className="me-1" size={16} />
            Start
          </button>
        </div>
        <div className="col-4 px-1">
          <button
            onClick={handleStopClick}
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
            onClick={simulateQRScan}
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
            <p className="mb-1"><strong>Stream Active:</strong> {stream ? "✅ Yes" : "❌ No"}</p>
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
              <p className="small mb-0">No validations yet - use the "Test" button to try validation</p>
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