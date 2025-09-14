import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { MapPin, Trophy, AlertTriangle, Loader2 } from "lucide-react";

interface GPSPermissionDialogProps {
  open: boolean;
  onClose: () => void;
  onLocationGranted: (latitude: number, longitude: number) => void;
  onLocationDenied: () => void;
  title?: string;
  description?: string;
  huntCode?: string;
}

export function GPSPermissionDialog({
  open,
  onClose,
  onLocationGranted,
  onLocationDenied,
  title = "GPS Location Required",
  description = "To claim, we need to verify you're at the right location.",
  huntCode,
}: GPSPermissionDialogProps) {
  const [isRequesting, setIsRequesting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requestLocation = async () => {
    setIsRequesting(true);
    setError(null);

    if (!navigator.geolocation) {
      setError("Your browser doesn't support location services");
      setIsRequesting(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setIsRequesting(false);
        onLocationGranted(position.coords.latitude, position.coords.longitude);
        onClose();
      },
      (error) => {
        setIsRequesting(false);

        switch (error.code) {
          case error.PERMISSION_DENIED:
            setError(
              "Location permission denied. Please enable location access in your browser settings.",
            );
            onLocationDenied();
            break;
          case error.POSITION_UNAVAILABLE:
            setError("Location information is unavailable. Please try again.");
            break;
          case error.TIMEOUT:
            setError("Location request timed out. Please try again.");
            break;
          default:
            setError("Unable to get your location. Please try again.");
            break;
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000, // Use cached location up to 1 minute old
      },
    );
  };

  const handleDeny = () => {
    onLocationDenied();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-2">
            <DialogTitle data-testid="dialog-secret-title">{title}</DialogTitle>
          </div>
          <DialogDescription className="space-y-3">
            {huntCode && (
              <div className="bg-muted px-3 py-2 rounded-md font-mono text-center text-lg">
                {huntCode}
              </div>
            )}

            <div className="flex items-start gap-2 text-sm">
              <span>{description}</span>
            </div>

            <Alert className="border-blue-200 bg-blue-50 dark:bg-blue-950/20">
              <AlertDescription className="text-sm">
                <strong>What happens:</strong>
                <ul className="mt-2 space-y-1 list-disc list-inside">
                  <li>
                    We'll check if you're within 300 meters of the location
                  </li>
                  <li>Automatic RVSP and validation for your ticket.</li>
                </ul>
              </AlertDescription>
            </Alert>

            {error && (
              <Alert variant="destructive" className="mt-3">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="gap-2">
          <Button
            onClick={requestLocation}
            disabled={isRequesting}
            className="gap-2"
            data-testid="button-allow-location"
          >
            {isRequesting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Getting Location...
              </>
            ) : (
              <>
                <MapPin className="h-4 w-4" />
                Allow Location Access
              </>
            )}
          </Button>
          <Button
            variant="outline"
            onClick={handleDeny}
            disabled={isRequesting}
            data-testid="button-deny-location"
          >
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
