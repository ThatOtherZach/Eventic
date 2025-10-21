import { useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

export default function HuntRedirect() {
  const { huntCode } = useParams<{ huntCode: string }>();
  const [, setLocation] = useLocation();

  const { data: event, isLoading, error } = useQuery({
    queryKey: [`/api/hunt/${huntCode}/event`],
    enabled: !!huntCode,
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/hunt/${huntCode}/event`);
      if (!response.ok) throw new Error("Hunt code not found");
      return response.json();
    },
  });

  useEffect(() => {
    if (event?.id) {
      // Redirect to the event page with huntMode and huntCode query params
      // This indicates the user came from a hunt URL
      const params = new URLSearchParams({
        huntMode: 'true',
        huntCode: huntCode || ''
      });
      setLocation(`/events/${event.id}?${params.toString()}`);
    }
  }, [event, setLocation, huntCode]);

  useEffect(() => {
    if (error) {
      // If hunt code not found, redirect to home page
      setLocation("/");
    }
  }, [error, setLocation]);

  if (isLoading) {
    return (
      <div className="container-fluid py-5 text-center">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
        <p className="mt-3">Finding event...</p>
      </div>
    );
  }

  return null;
}