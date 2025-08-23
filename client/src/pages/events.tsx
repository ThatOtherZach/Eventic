import { useState } from "react";
import { StatsCards } from "@/components/events/stats-cards";
import { EventList } from "@/components/events/event-list";
import { CreateEventModal } from "@/components/events/create-event-modal";
import { TicketPreviewModal } from "@/components/tickets/ticket-preview-modal";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import type { Event } from "@shared/schema";

export default function Events() {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [isTicketModalOpen, setIsTicketModalOpen] = useState(false);

  const handleGenerateTickets = (event: Event) => {
    setSelectedEvent(event);
    setIsTicketModalOpen(true);
  };

  return (
    <div className="animate-fade-in">
      {/* Header Section */}
      <div className="row align-items-center mb-4">
        <div className="col-12 col-md-8 mobile-mb">
          <h2 className="h3 fw-semibold text-dark mb-2">Event Management</h2>
          <p className="text-muted mb-0">Create and manage your events and tickets</p>
        </div>
        <div className="col-12 col-md-4 text-md-end">
          <Button
            onClick={() => setIsCreateModalOpen(true)}
            className="btn btn-primary w-100 w-md-auto"
            data-testid="button-create-event"
          >
            <Plus className="me-2" size={18} />
            Create Event
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <StatsCards />

      {/* Events List */}
      <EventList onGenerateTickets={handleGenerateTickets} />

      {/* Modals */}
      <CreateEventModal 
        open={isCreateModalOpen} 
        onOpenChange={setIsCreateModalOpen} 
      />
      
      {selectedEvent && (
        <TicketPreviewModal
          open={isTicketModalOpen}
          onOpenChange={setIsTicketModalOpen}
          event={selectedEvent}
        />
      )}
    </div>
  );
}
