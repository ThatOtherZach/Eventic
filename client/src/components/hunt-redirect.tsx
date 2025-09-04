import { useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { Event } from "@shared/schema";

export function HuntRedirect() {
  const { huntCode } = useParams();
  const [, setLocation] = useLocation();

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
      // Redirect to the event page
      setLocation(`/events/${event.id}`);
    } else if (!isLoading && huntCode) {
      // If no event found and not loading, redirect to home
      setLocation("/");
    }
  }, [event, isLoading, huntCode, setLocation]);

  if (isLoading) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ minHeight: "50vh" }}>
        <div className="text-center">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
          <div className="mt-3">
            <h5>Following Hunt trail...</h5>
            <p className="text-muted">Redirecting to event</p>
          </div>
        </div>
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