import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useSEO, SEO_CONFIG } from "@/hooks/use-seo";
import { StatsCards } from "@/components/events/stats-cards";
import { EventList } from "@/components/events/event-list";
import { TicketPreviewModal } from "@/components/tickets/ticket-preview-modal";
import { FeaturedCarousel } from "@/components/featured/featured-carousel";
import { FeaturedGrid } from "@/components/featured/featured-grid";
import { Plus, LogIn } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import type { Event } from "@shared/schema";

export default function Events() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [isTicketModalOpen, setIsTicketModalOpen] = useState(false);
  const [showAuthPrompt, setShowAuthPrompt] = useState(false);
  
  // Fetch random platform header
  const { data: platformHeader } = useQuery({
    queryKey: ["/api/platform-headers/random"],
    refetchOnWindowFocus: false,
    staleTime: 1000 * 60 * 5 // Cache for 5 minutes
  });

  // Set page SEO
  useSEO(SEO_CONFIG.home);

  const handleGenerateTickets = (event: Event) => {
    if (!user) {
      setSelectedEvent(event);
      setShowAuthPrompt(true);
      return;
    }
    setSelectedEvent(event);
    setIsTicketModalOpen(true);
  };

  const handleCreateEventClick = () => {
    if (!user) {
      setShowAuthPrompt(true);
      return;
    }
    setLocation("/events/create");
  };

  const handleSignIn = () => {
    setLocation("/auth");
  };

  return (
    <div className="animate-fade-in">
      {/*██╔════╝██║   ██║████╗  ██║╚══██╔══╝██║██╔═══██╗
         Eventic Core by Saym Services Inc. A Global Live Action Missions Peer Reputation            and Rewards Operations Module or GLAM PROM for short. Users complete Missions to           get validation from others which can unlock secret codes.
         ╚════██║██║   ██║██║╚██╗██║   ██║   ██║██║   ██║*/}
      
      {/* Header Section */}
      <div className="row align-items-center mb-4">
        <div className="col-12 col-md-8 mobile-mb">
          <h2 className="h3 fw-semibold text-dark mb-2">
            {platformHeader?.title || "Event Management"}
          </h2>
          <p className="text-muted mb-0">
            {platformHeader?.subtitle || "Browse events and purchase tickets"}
          </p>
        </div>
        <div className="col-12 col-md-4 text-md-end">
          {user ? (
            <button
              onClick={handleCreateEventClick}
              className="btn btn-primary w-100 w-md-auto"
              data-testid="button-create-event"
            >
              <Plus className="me-2" size={18} />
              Create Event
            </button>
          ) : (
            <button
              onClick={handleSignIn}
              className="btn btn-secondary w-100 w-md-auto"
              data-testid="button-sign-in-to-create"
            >
              <LogIn className="me-2" size={18} />
              Sign In
            </button>
          )}
        </div>
      </div>

      {/* Featured Events Carousel */}
      <FeaturedCarousel />

      {/* Featured Events Grid */}
      <FeaturedGrid />

      {/* Stats Cards */}
      <StatsCards />

      {/* Events List */}
      <EventList onGenerateTickets={handleGenerateTickets} />

      {/* Auth Prompt Modal */}
      {showAuthPrompt && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Sign In Required</h5>
                <button 
                  type="button" 
                  className="btn-close" 
                  onClick={() => setShowAuthPrompt(false)}
                />
              </div>
              <div className="modal-body text-center">
                <div className="mb-4">
                  <LogIn className="text-primary mb-3" size={48} />
                  <p className="lead">
                    {selectedEvent 
                      ? "You need to sign in to purchase tickets" 
                      : "You need to sign in to create events"}
                  </p>
                  <p className="text-muted">
                    Create an account or sign in to continue
                  </p>
                </div>
              </div>
              <div className="modal-footer justify-content-center">
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={() => setShowAuthPrompt(false)}
                >
                  Cancel
                </button>
                <button 
                  type="button" 
                  className="btn btn-primary" 
                  onClick={handleSignIn}
                >
                  <LogIn className="me-2" size={16} />
                  Sign In
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      
      {selectedEvent && user && (
        <TicketPreviewModal
          open={isTicketModalOpen}
          onOpenChange={setIsTicketModalOpen}
          event={selectedEvent}
        />
      )}
    </div>
  );
}