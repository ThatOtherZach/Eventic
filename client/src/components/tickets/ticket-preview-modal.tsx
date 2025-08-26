import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Modal, ModalHeader, ModalBody, ModalFooter } from "@/components/ui/modal";
import type { Event, Ticket } from "@shared/schema";

interface TicketPreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event: Event;
}

export function TicketPreviewModal({ open, onOpenChange, event }: TicketPreviewModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [ticket, setTicket] = useState<Ticket | null>(null);

  const createTicketMutation = useMutation({
    mutationFn: async (eventId: string) => {
      const response = await apiRequest("POST", `/api/events/${eventId}/tickets`);
      return response.json();
    },
    onSuccess: (newTicket: Ticket) => {
      setTicket(newTicket);
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
      toast({
        title: "Success",
        description: "Ticket created successfully",
        variant: "success",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create ticket",
        variant: "error",
      });
    },
  });



  useEffect(() => {
    if (open && !ticket) {
      createTicketMutation.mutate(event.id);
    }
  }, [open, event.id]);

  useEffect(() => {
    if (!open) {
      setTicket(null);
    }
  }, [open]);

  return (
    <Modal open={open} onOpenChange={onOpenChange} className="modal-md">
      <ModalHeader onClose={() => onOpenChange(false)}>
        Event Ticket
      </ModalHeader>
      
      <ModalBody>
        {/* Ticket Design */}
        <div className="border border-2 border-secondary border-opacity-25 rounded p-4 mb-4" style={{ borderStyle: "dashed" }}>
          <div className="text-center border-bottom pb-3 mb-3">
            <h5 className="fw-semibold text-dark">{event.name}</h5>
            <p className="text-muted small mb-1">{event.venue}</p>
            <p className="text-muted small">{event.date} at {event.time}</p>
          </div>

          <div className="d-flex justify-content-between align-items-start mb-3">
            <div>
              <p className="text-muted small mb-1">Ticket ID</p>
              <p className="fw-semibold font-monospace small" data-testid="text-ticket-id">
                {ticket?.ticketNumber || "Loading..."}
              </p>
            </div>
            <div className="text-end">
              <p className="text-muted small mb-1">Price</p>
              <p className="h5 fw-semibold text-primary">${event.ticketPrice}</p>
            </div>
          </div>


        </div>
      </ModalBody>
      
      <ModalFooter>
        <button
          onClick={() => onOpenChange(false)}
          className="btn btn-primary"
          data-testid="button-close-modal"
        >
          Close
        </button>
      </ModalFooter>
    </Modal>
  );
}