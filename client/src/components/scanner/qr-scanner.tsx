import { useState, useRef, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Play, Square, Camera, CheckCircle, XCircle } from "lucide-react";
import type { Event, Ticket } from "@shared/schema";

interface ValidationResult {
  valid: boolean;
  message: string;
  ticket?: Ticket;
  event?: Event;
}

export function QrScanner() {
  const { toast } = useToast();
  const [isScanning, setIsScanning] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [recentValidations, setRecentValidations] = useState<Array<{
    eventName: string;
    timestamp: string;
    valid: boolean;
  }>>([]);
  const videoRef = useRef<HTMLVideoElement>(null);

  const validateTicketMutation = useMutation({
    mutationFn: async (qrData: string) => {
      const response = await apiRequest("POST", "/api/validate", { qrData });
      return response.json();
    },
    onSuccess: (result: ValidationResult) => {
      setValidationResult(result);
      const validation = {
        eventName: result.event?.name || "Unknown Event",
        timestamp: "Just now",
        valid: result.valid,
      };
      setRecentValidations(prev => [validation, ...prev.slice(0, 9)]);
      
      if (result.valid) {
        toast({
          title: "Valid Ticket",
          description: "Ticket validated successfully",
        });
      } else {
        toast({
          title: "Invalid Ticket",
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
        title: "Validation Error",
        description: result.message,
        variant: "destructive",
      });
    },
  });

  const startScanner = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" }
      });
      
      setStream(mediaStream);
      setIsScanning(true);
      
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }

      // Simulate QR detection after 3 seconds for demo
      setTimeout(() => {
        if (isScanning) {
          const mockQrData = JSON.stringify({
            eventId: "demo-event",
            ticketNumber: "DEMO-001",
            timestamp: Date.now(),
          });
          validateTicketMutation.mutate(mockQrData);
        }
      }, 3000);

    } catch (error) {
      toast({
        title: "Camera Error",
        description: "Camera access is required for QR code scanning",
        variant: "destructive",
      });
    }
  };

  const stopScanner = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setIsScanning(false);
    setValidationResult(null);
  };

  const scanAnother = () => {
    setValidationResult(null);
  };

  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [stream]);

  return (
    <div>
      {/* Camera Container */}
      <Card className="mb-6 overflow-hidden">
        <div className="aspect-square bg-gray-100 flex items-center justify-center relative">
          {isScanning ? (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              className="w-full h-full object-cover"
              data-testid="video-scanner"
            />
          ) : (
            <div className="text-center" data-testid="camera-placeholder">
              <Camera className="text-gray-400 text-4xl mb-4 mx-auto" />
              <p className="text-gray-600 font-medium">Tap to start camera</p>
              <p className="text-sm text-gray-500 mt-1">Point camera at QR code</p>
            </div>
          )}
        </div>
      </Card>

      {/* Scanner Controls */}
      <div className="flex space-x-3 mb-6">
        <Button
          onClick={startScanner}
          disabled={isScanning}
          className="flex-1 bg-primary hover:bg-primary-dark"
          data-testid="button-start-scanner"
        >
          <Play className="mr-2 h-4 w-4" />
          Start Scanner
        </Button>
        <Button
          onClick={stopScanner}
          disabled={!isScanning}
          variant="outline"
          className="flex-1"
          data-testid="button-stop-scanner"
        >
          <Square className="mr-2 h-4 w-4" />
          Stop Scanner
        </Button>
      </div>

      {/* Scan Result */}
      {validationResult && (
        <Card className="mb-6" data-testid="scan-result">
          <CardContent className="p-6">
            <div className="flex items-center mb-4">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center mr-3 ${
                validationResult.valid ? "bg-success" : "bg-error"
              }`}>
                {validationResult.valid ? (
                  <CheckCircle className="text-white text-sm" />
                ) : (
                  <XCircle className="text-white text-sm" />
                )}
              </div>
              <div>
                <h4 className="text-lg font-medium text-gray-900">
                  {validationResult.valid ? "Valid Ticket" : "Invalid Ticket"}
                </h4>
                <p className="text-sm text-gray-500">
                  {validationResult.valid ? "Ticket successfully validated" : validationResult.message}
                </p>
              </div>
            </div>

            {validationResult.valid && validationResult.event && validationResult.ticket && (
              <div className="bg-gray-50 rounded-lg p-4 space-y-2 mb-4">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Event:</span>
                  <span className="text-sm font-medium text-gray-900">
                    {validationResult.event.name}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Ticket ID:</span>
                  <span className="text-sm font-mono text-gray-900">
                    {validationResult.ticket.ticketNumber}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Scanned:</span>
                  <span className="text-sm text-gray-600">Just now</span>
                </div>
              </div>
            )}

            <Button
              onClick={scanAnother}
              className="w-full bg-primary hover:bg-primary-dark"
              data-testid="button-scan-another"
            >
              Scan Another Ticket
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Recent Validations */}
      <Card>
        <CardContent className="p-0">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">Recent Validations</h3>
          </div>
          <div className="divide-y divide-gray-200 max-h-64 overflow-y-auto">
            {recentValidations.length === 0 ? (
              <div className="p-4 text-center text-gray-500">
                <p className="text-sm">No validations yet</p>
              </div>
            ) : (
              recentValidations.map((validation, index) => (
                <div 
                  key={index} 
                  className="p-4 flex items-center justify-between"
                  data-testid={`validation-${index}`}
                >
                  <div className="flex items-center">
                    <div className={`w-2 h-2 rounded-full mr-3 ${
                      validation.valid ? "bg-success" : "bg-error"
                    }`}></div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {validation.eventName}
                      </p>
                      <p className="text-xs text-gray-500">{validation.timestamp}</p>
                    </div>
                  </div>
                  <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                    validation.valid 
                      ? "text-success bg-green-100" 
                      : "text-error bg-red-100"
                  }`}>
                    {validation.valid ? "Valid" : "Invalid"}
                  </span>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
