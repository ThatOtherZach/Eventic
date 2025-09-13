import { useEffect, useState } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { GPSPermissionDialog } from "@/components/gps-permission-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Trophy, MapPin, AlertTriangle, CheckCircle } from "lucide-react";
import type { Event } from "@shared/schema";
import compassIcon from "@assets/image_1756971767387.png";

export function HuntRedirect() {
  const { huntCode } = useParams();
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const [showGPSDialog, setShowGPSDialog] = useState(false);
  const [validationStatus, setValidationStatus] = useState<"pending" | "validating" | "success" | "error">("pending");
  const [validationMessage, setValidationMessage] = useState<string>("");
  const [event, setEvent] = useState<Event | null>(null);

  // Query to find the event by hunt code
  const { data: eventData, isLoading: eventLoading } = useQuery<Event>({
    queryKey: [`/api/hunt/${huntCode}/event`],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/hunt/${huntCode}/event`);
      return response.json();
    },
    enabled: !!huntCode,
  });

  // Validation mutation
  const validateMutation = useMutation({
    mutationFn: async ({ latitude, longitude }: { latitude: number; longitude: number }) => {
      const response = await apiRequest("POST", `/api/currency/redeem-code`, {
        code: huntCode,
        latitude,
        longitude,
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to validate Hunt code");
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      setValidationStatus("success");
      setValidationMessage(data.message || `Successfully claimed ${data.ticketAmount} tickets!`);
      
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ["/api/currency/balance"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user/tickets"] });
      
      toast({
        title: "Hunt Success!",
        description: `You've earned ${data.ticketAmount} tickets and been registered for the event!`,
      });
      
      // Redirect to event page after 3 seconds
      setTimeout(() => {
        if (eventData) {
          setLocation(`/events/${eventData.id}`);
        }
      }, 3000);
    },
    onError: (error: any) => {
      setValidationStatus("error");
      setValidationMessage(error.message || "Failed to validate Hunt code");
      
      // If it's not a location error, redirect to home after 3 seconds
      if (!error.message?.includes("within") && !error.message?.includes("location")) {
        setTimeout(() => {
          setLocation("/");
        }, 3000);
      }
    },
  });

  // Initialize when component mounts
  useEffect(() => {
    if (!user) {
      // Not logged in, redirect to auth page
      toast({
        title: "Login Required",
        description: "Please log in to claim Hunt codes",
        variant: "destructive",
      });
      setLocation(`/auth?redirect=/hunt/${huntCode}`);
      return;
    }

    if (eventData && !showGPSDialog && validationStatus === "pending") {
      setEvent(eventData);
      // Show GPS dialog after event is loaded
      setShowGPSDialog(true);
    } else if (!eventLoading && !eventData && huntCode) {
      // Invalid hunt code
      setValidationStatus("error");
      setValidationMessage("Hunt code not found");
      setTimeout(() => {
        setLocation("/");
      }, 2000);
    }
  }, [eventData, eventLoading, huntCode, user, showGPSDialog, validationStatus, setLocation, toast]);

  const handleGPSGranted = async (latitude: number, longitude: number) => {
    setValidationStatus("validating");
    await validateMutation.mutateAsync({ latitude, longitude });
  };

  const handleGPSDenied = () => {
    setValidationStatus("error");
    setValidationMessage("Location access is required to claim Hunt codes");
    
    toast({
      title: "Location Required",
      description: "Hunt codes require location verification to claim rewards",
      variant: "destructive",
    });
    
    // Redirect to event page after 3 seconds
    setTimeout(() => {
      if (eventData) {
        setLocation(`/events/${eventData.id}`);
      } else {
        setLocation("/");
      }
    }, 3000);
  };

  // Loading state
  if (eventLoading || (!eventData && validationStatus === "pending")) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ minHeight: "50vh" }}>
        <div className="text-center">
          <div className="mb-4">
            <img 
              src={compassIcon}
              alt="Hunt Loading"
              style={{
                width: "64px",
                height: "64px",
                animation: "spin 3s linear infinite"
              }}
            />
          </div>
          <div>
            <h5>Discovering Hunt...</h5>
            <p className="text-muted">Loading Hunt code details</p>
          </div>
        </div>
        <style jsx>{`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  // Validating state
  if (validationStatus === "validating") {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ minHeight: "50vh" }}>
        <div className="text-center">
          <div className="mb-4">
            <MapPin className="h-16 w-16 text-primary animate-pulse" />
          </div>
          <div>
            <h5>Validating Location...</h5>
            <p className="text-muted">Checking if you're at the event venue</p>
          </div>
        </div>
      </div>
    );
  }

  // Success state
  if (validationStatus === "success") {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ minHeight: "50vh" }}>
        <div className="text-center">
          <div className="mb-4">
            <CheckCircle className="h-16 w-16 text-success" />
          </div>
          <div>
            <h5>Hunt Success!</h5>
            <p className="text-success">{validationMessage}</p>
            <p className="text-muted mt-3">Redirecting to event page...</p>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (validationStatus === "error") {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ minHeight: "50vh" }}>
        <div className="text-center">
          <div className="mb-4">
            <AlertTriangle className="h-16 w-16 text-danger" />
          </div>
          <div>
            <h5>Hunt Failed</h5>
            <p className="text-danger">{validationMessage}</p>
            <p className="text-muted mt-3">Redirecting...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* GPS Permission Dialog */}
      <GPSPermissionDialog
        open={showGPSDialog}
        onClose={() => {
          setShowGPSDialog(false);
          handleGPSDenied();
        }}
        onLocationGranted={handleGPSGranted}
        onLocationDenied={handleGPSDenied}
        huntCode={huntCode}
        title={`Hunt Code: ${huntCode}`}
        description={event ? `Verify you're at ${event.name} to claim your reward!` : "Verify your location to claim your reward!"}
      />
      
      {/* Initial loading state while dialog is pending */}
      <div className="d-flex justify-content-center align-items-center" style={{ minHeight: "50vh" }}>
        <div className="text-center">
          <div className="mb-4">
            <Trophy className="h-16 w-16 text-warning" />
          </div>
          <div>
            <h5>Hunt Code Detected!</h5>
            <p className="text-muted">Preparing to verify your location...</p>
          </div>
        </div>
      </div>
    </>
  );
}