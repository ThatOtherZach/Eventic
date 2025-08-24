import { useEffect, useRef } from "react";
import { MapPin } from "lucide-react";

interface VenueMapProps {
  venueUrl: string;
  venueName: string;
}

export function VenueMap({ venueUrl, venueName }: VenueMapProps) {
  const mapRef = useRef<HTMLIFrameElement>(null);

  // Parse Google Maps URL to extract coordinates
  const parseGoogleMapsUrl = (url: string): { lat: number; lng: number } | null => {
    try {
      // Handle various Google Maps URL formats
      // Format 1: https://maps.google.com/?q=lat,lng
      // Format 2: https://www.google.com/maps/place/.../@lat,lng,zoom...
      // Format 3: https://maps.app.goo.gl/... (shortened URL)
      // Format 4: https://www.google.com/maps?q=lat,lng
      
      // Try to extract coordinates from @ symbol format
      const atMatch = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
      if (atMatch) {
        return {
          lat: parseFloat(atMatch[1]),
          lng: parseFloat(atMatch[2])
        };
      }

      // Try to extract from q= parameter
      const qMatch = url.match(/[?&]q=(-?\d+\.\d+)[,+](-?\d+\.\d+)/);
      if (qMatch) {
        return {
          lat: parseFloat(qMatch[1]),
          lng: parseFloat(qMatch[2])
        };
      }

      // Try to extract from ll= parameter
      const llMatch = url.match(/[?&]ll=(-?\d+\.\d+),(-?\d+\.\d+)/);
      if (llMatch) {
        return {
          lat: parseFloat(llMatch[1]),
          lng: parseFloat(llMatch[2])
        };
      }

      // Try to extract from place format
      const placeMatch = url.match(/place\/[^/]+\/@(-?\d+\.\d+),(-?\d+\.\d+)/);
      if (placeMatch) {
        return {
          lat: parseFloat(placeMatch[1]),
          lng: parseFloat(placeMatch[2])
        };
      }

      return null;
    } catch (error) {
      console.error("Error parsing Google Maps URL:", error);
      return null;
    }
  };

  const coords = parseGoogleMapsUrl(venueUrl);

  if (!coords) {
    return (
      <div className="alert alert-info">
        <MapPin size={18} className="me-2" />
        <span>Map location could not be determined from the provided URL</span>
      </div>
    );
  }

  // Create OpenStreetMap embed URL
  const osmEmbedUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${coords.lng-0.01},${coords.lat-0.01},${coords.lng+0.01},${coords.lat+0.01}&layer=mapnik&marker=${coords.lat},${coords.lng}`;

  return (
    <div className="card">
      <div className="card-body">
        <h5 className="card-title mb-3">
          <MapPin size={20} className="me-2" />
          Venue Location
        </h5>
        <div className="ratio ratio-16x9">
          <iframe
            ref={mapRef}
            src={osmEmbedUrl}
            style={{ border: 0 }}
            allowFullScreen
            loading="lazy"
            title={`Map showing ${venueName}`}
          />
        </div>
        <div className="mt-2">
          <a 
            href={venueUrl} 
            target="_blank" 
            rel="noopener noreferrer" 
            className="btn btn-sm btn-outline-primary"
          >
            <MapPin size={16} className="me-1" />
            View on Google Maps
          </a>
        </div>
      </div>
    </div>
  );
}