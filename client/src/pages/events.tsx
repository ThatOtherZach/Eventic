import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { StatsCards } from "@/components/events/stats-cards";
import { EventList } from "@/components/events/event-list";
import { CreateEventModal } from "@/components/events/create-event-modal";
import { TicketPreviewModal } from "@/components/tickets/ticket-preview-modal";
import { FeaturedCarousel } from "@/components/featured/featured-carousel";
import { Plus, LogIn } from "lucide-react";
import type { Event } from "@shared/schema";

export default function Events() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [isTicketModalOpen, setIsTicketModalOpen] = useState(false);
  const [showAuthPrompt, setShowAuthPrompt] = useState(false);

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
    setIsCreateModalOpen(true);
  };

  const handleSignIn = () => {
    setLocation("/auth");
  };

  return (
    <div className="animate-fade-in">
      {/* Header Section */}
      <div className="row align-items-center mb-4">
        <div className="col-12 col-md-8 mobile-mb">
          <h2 className="h3 fw-semibold text-dark mb-2">Event Management</h2>
          <p className="text-muted mb-0">Browse events and purchase tickets</p>
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
              className="btn btn-outline-primary w-100 w-md-auto"
              data-testid="button-sign-in-to-create"
            >
              <LogIn className="me-2" size={18} />
              Sign In to Create Events
            </button>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <StatsCards />

      {/* Featured Events Carousel */}
      <FeaturedCarousel />

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
      <CreateEventModal 
        open={isCreateModalOpen} 
        onOpenChange={setIsCreateModalOpen} 
      />
      
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