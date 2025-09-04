import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { MapPin, Trophy, AlertCircle, Navigation, Ticket as TicketIcon, Clock } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Event, Ticket } from "@shared/schema";

interface HuntValidationResponse {
  message: string;
  valid: boolean;
  huntSuccess?: boolean;
  requiresAuth?: boolean;
  needsTicket?: boolean;
  outsideGeofence?: boolean;
  distance?: number;
  alreadyValidated?: boolean;
  outsideValidTime?: boolean;
  ticket?: Ticket;
  event?: Event;
}

export default function HuntPage() {
  const { huntCode } = useParams();
  const [, setLocation] = useLocation();
  const [gpsStatus, setGpsStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationError, setLocationError] = useState<string>("");
  const { toast } = useToast();

  const validateHunt = useMutation<HuntValidationResponse, Error, { latitude: number; longitude: number }>({
    mutationFn: async (location: { latitude: number; longitude: number }) => {
      return apiRequest(`/api/hunt/${huntCode}/validate`, "POST", location) as Promise<HuntValidationResponse>;
    },
    onSuccess: (data) => {
      if (data.huntSuccess) {
        toast({
          title: "Hunt Completed!",
          description: "Your ticket has been validated successfully!",
          variant: "default"
        });
      }
    },
    onError: (error: any) => {
      console.error("Hunt validation error:", error);
    }
  });

  const requestLocation = () => {
    setGpsStatus("loading");
    setLocationError("");

    if (!navigator.geolocation) {
      setGpsStatus("error");
      setLocationError("Your browser doesn't support GPS location");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const location = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        };
        setUserLocation(location);
        setGpsStatus("success");
        // Automatically validate once we have location
        validateHunt.mutate(location);
      },
      (error) => {
        setGpsStatus("error");
        switch (error.code) {
          case error.PERMISSION_DENIED:
            setLocationError("Please allow location access to validate the Hunt URL");
            break;
          case error.POSITION_UNAVAILABLE:
            setLocationError("Location information is unavailable");
            break;
          case error.TIMEOUT:
            setLocationError("Location request timed out");
            break;
          default:
            setLocationError("An error occurred getting your location");
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  };

  useEffect(() => {
    // Auto-request location on page load
    requestLocation();
  }, []);

  const handleLogin = () => {
    // Store the Hunt URL in session storage so we can redirect back after login
    sessionStorage.setItem("huntRedirect", `/hunt/${huntCode}`);
    setLocation("/login");
  };

  if (validateHunt.data) {
    const { valid, message, event, huntSuccess, requiresAuth, needsTicket, outsideGeofence, distance } = validateHunt.data;

    if (requiresAuth) {
      return (
        <div className="container max-w-2xl mx-auto py-8 px-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="h-6 w-6 text-yellow-500" />
                Treasure Hunt Validation
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert className="border-yellow-200 bg-yellow-50">
                <AlertCircle className="h-4 w-4 text-yellow-600" />
                <AlertDescription className="text-yellow-800">
                  You need to log in to validate this Hunt URL
                </AlertDescription>
              </Alert>
              <Button onClick={handleLogin} className="w-full">
                Log In to Continue
              </Button>
            </CardContent>
          </Card>
        </div>
      );
    }

    if (needsTicket && event) {
      return (
        <div className="container max-w-2xl mx-auto py-8 px-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="h-6 w-6 text-yellow-500" />
                Treasure Hunt for {event.name}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert className="border-orange-200 bg-orange-50">
                <TicketIcon className="h-4 w-4 text-orange-600" />
                <AlertDescription className="text-orange-800">
                  You need a ticket for this event to validate the Hunt URL
                </AlertDescription>
              </Alert>
              <Button onClick={() => setLocation(`/events/${event.id}`)} className="w-full">
                View Event & Get Ticket
              </Button>
            </CardContent>
          </Card>
        </div>
      );
    }

    if (outsideGeofence) {
      return (
        <div className="container max-w-2xl mx-auto py-8 px-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="h-6 w-6 text-yellow-500" />
                {event?.name && `Treasure Hunt for ${event.name}`}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert className="border-red-200 bg-red-50">
                <MapPin className="h-4 w-4 text-red-600" />
                <AlertDescription className="text-red-800">
                  You're {distance}m away from the venue. You need to be within 300 meters to validate this Hunt URL.
                </AlertDescription>
              </Alert>
              <Button onClick={requestLocation} className="w-full" disabled={gpsStatus === "loading"}>
                <Navigation className="mr-2 h-4 w-4" />
                {gpsStatus === "loading" ? "Getting Location..." : "Try Again"}
              </Button>
            </CardContent>
          </Card>
        </div>
      );
    }

    if (huntSuccess) {
      return (
        <div className="container max-w-2xl mx-auto py-8 px-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="h-6 w-6 text-yellow-500" />
                Hunt Completed!
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert className="border-green-200 bg-green-50">
                <Trophy className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-800">
                  Congratulations! You found the hidden Hunt URL and your ticket has been validated!
                </AlertDescription>
              </Alert>
              {event && (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Event: {event.name}</p>
                  <Button onClick={() => setLocation(`/events/${event.id}`)} className="w-full">
                    View Event Details
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      );
    }

    if (!valid) {
      return (
        <div className="container max-w-2xl mx-auto py-8 px-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="h-6 w-6 text-yellow-500" />
                Hunt Validation
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert className="border-red-200 bg-red-50">
                <AlertCircle className="h-4 w-4 text-red-600" />
                <AlertDescription className="text-red-800">
                  {message}
                </AlertDescription>
              </Alert>
              <Button onClick={requestLocation} className="w-full" disabled={gpsStatus === "loading"}>
                <Navigation className="mr-2 h-4 w-4" />
                {gpsStatus === "loading" ? "Getting Location..." : "Try Again"}
              </Button>
            </CardContent>
          </Card>
        </div>
      );
    }
  }

  return (
    <div className="container max-w-2xl mx-auto py-8 px-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-6 w-6 text-yellow-500" />
            Treasure Hunt Validation
          </CardTitle>
          <CardDescription>
            Validating Hunt code: {huntCode}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {gpsStatus === "loading" && (
            <Alert>
              <Navigation className="h-4 w-4 animate-pulse" />
              <AlertDescription>
                Getting your GPS location...
              </AlertDescription>
            </Alert>
          )}
          
          {gpsStatus === "error" && (
            <Alert className="border-red-200 bg-red-50">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-800">
                {locationError}
              </AlertDescription>
            </Alert>
          )}

          {validateHunt.isPending && (
            <Alert>
              <Clock className="h-4 w-4 animate-spin" />
              <AlertDescription>
                Validating Hunt URL...
              </AlertDescription>
            </Alert>
          )}

          {validateHunt.error && (
            <Alert className="border-red-200 bg-red-50">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-800">
                {(validateHunt.error as any)?.message || "Error validating Hunt URL"}
              </AlertDescription>
            </Alert>
          )}

          <Button 
            onClick={requestLocation} 
            className="w-full" 
            disabled={gpsStatus === "loading" || validateHunt.isPending}
          >
            <Navigation className="mr-2 h-4 w-4" />
            {gpsStatus === "loading" ? "Getting Location..." : "Validate Hunt URL"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}