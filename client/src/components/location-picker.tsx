import { useEffect, useRef } from "react";
import { MapContainer, TileLayer, Marker, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix default icon issue with Leaflet + Webpack
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

interface LocationPickerProps {
  latitude?: number | null;
  longitude?: number | null;
  onLocationSelect?: (lat: number, lng: number) => void;
  readOnly?: boolean;
  height?: string;
}

function LocationMarker({ 
  position, 
  onLocationSelect, 
  readOnly 
}: { 
  position: [number, number] | null;
  onLocationSelect?: (lat: number, lng: number) => void;
  readOnly?: boolean;
}) {
  const map = useMapEvents({
    click(e) {
      if (!readOnly && onLocationSelect) {
        onLocationSelect(e.latlng.lat, e.latlng.lng);
      }
    },
  });

  useEffect(() => {
    if (position) {
      map.setView(position, map.getZoom());
    }
  }, [position, map]);

  return position === null ? null : <Marker position={position} />;
}

export function LocationPicker({ 
  latitude, 
  longitude, 
  onLocationSelect, 
  readOnly = false,
  height = "400px"
}: LocationPickerProps) {
  const position: [number, number] | null = 
    latitude && longitude ? [Number(latitude), Number(longitude)] : null;
  
  // Default center (New York City) if no position provided
  const center: [number, number] = position || [40.7128, -74.0060];

  return (
    <div className="position-relative">
      <MapContainer 
        center={center} 
        zoom={13} 
        style={{ 
          height, 
          width: "100%", 
          borderRadius: "8px",
          opacity: readOnly ? 0.8 : 1
        }}
        scrollWheelZoom={!readOnly}
        dragging={!readOnly}
        zoomControl={!readOnly}
        doubleClickZoom={!readOnly}
        touchZoom={!readOnly}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <LocationMarker 
          position={position} 
          onLocationSelect={onLocationSelect}
          readOnly={readOnly}
        />
      </MapContainer>
      {!readOnly && (
        <div className="position-absolute top-0 start-0 m-2 bg-white rounded px-2 py-1" style={{ zIndex: 1000 }}>
          <small className="text-muted">Click on the map to set venue location</small>
        </div>
      )}
      {readOnly && (
        <div className="position-absolute top-50 start-50 translate-middle bg-light rounded px-3 py-2 shadow" 
             style={{ 
               zIndex: 1000,
               pointerEvents: "none"
             }}>
          <small className="text-muted fw-bold">
            <span className="me-1">🔒</span>
            GPS coordinates are locked
          </small>
        </div>
      )}
    </div>
  );
}