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
    <div>
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900">Event Management</h2>
          <p className="mt-1 text-sm text-gray-500">Create and manage your events and tickets</p>
        </div>
        <div className="mt-4 sm:mt-0">
          <Button
            onClick={() => setIsCreateModalOpen(true)}
            className="bg-primary hover:bg-primary-dark"
            data-testid="button-create-event"
          >
            <Plus className="mr-2 h-4 w-4" />
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
