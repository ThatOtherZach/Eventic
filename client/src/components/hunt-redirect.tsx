import { useEffect, useState } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { Event } from "@shared/schema";
import compassIcon from "@assets/image_1756971767387.png";

export function HuntRedirect() {
  const { huntCode } = useParams();
  const [, setLocation] = useLocation();
  const [showRedirect, setShowRedirect] = useState(false);

  // Query to find the event by hunt code
  const { data: event, isLoading } = useQuery<Event>({
    queryKey: [`/api/hunt/${huntCode}/event`],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/hunt/${huntCode}/event`);
      return response.json();
    },
    enabled: !!huntCode,
  });

  useEffect(() => {
    if (event) {
      // Show redirect message and wait 1 second before redirecting
      setShowRedirect(true);
      setTimeout(() => {
        setLocation(`/events/${event.id}`);
      }, 1000);
    } else if (!isLoading && huntCode) {
      // If no event found and not loading, redirect to home
      setLocation("/");
    }
  }, [event, isLoading, huntCode, setLocation]);

  if (isLoading || showRedirect) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ minHeight: "50vh" }}>
        <div className="text-center">
          <div className="mb-4">
            {/* Hunt icon spinning slowly */}
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
            <h5>Routing to event. Please hold...</h5>
            <p className="text-muted">Processing Hunt discovery</p>
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

  return (
    <div className="d-flex justify-content-center align-items-center" style={{ minHeight: "50vh" }}>
      <div className="text-center">
        <h5>Hunt code not found</h5>
        <p className="text-muted">Redirecting to home...</p>
      </div>
    </div>
  );
}