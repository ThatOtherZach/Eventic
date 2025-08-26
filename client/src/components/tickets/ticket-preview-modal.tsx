import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { generateQRCode } from "@/lib/qr-utils";
import { Modal, ModalHeader, ModalBody, ModalFooter } from "@/components/ui/modal";
import type { Event, Ticket } from "@shared/schema";
import { QrCode, Download } from "lucide-react";

interface TicketPreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event: Event;
}

export function TicketPreviewModal({ open, onOpenChange, event }: TicketPreviewModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [qrCodeUrl, setQrCodeUrl] = useState<string>("");

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

  const generateQR = async () => {
    if (!ticket) return;

    try {
      const qrUrl = await generateQRCode(ticket.qrData);
      setQrCodeUrl(qrUrl);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to generate QR code",
        variant: "error",
      });
    }
  };

  const downloadTicket = () => {
    if (!qrCodeUrl) return;

    const link = document.createElement("a");
    link.download = `ticket-${ticket?.ticketNumber || "unknown"}.png`;
    link.href = qrCodeUrl;
    link.click();
  };

  useEffect(() => {
    if (open && !ticket) {
      createTicketMutation.mutate(event.id);
    }
  }, [open, event.id]);

  useEffect(() => {
    if (!open) {
      setTicket(null);
      setQrCodeUrl("");
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

          {/* QR Code Container */}
          <div className="text-center">
            <div className="bg-light border rounded p-3 mx-auto mb-3" style={{ width: "150px", height: "150px" }}>
              {qrCodeUrl ? (
                <img 
                  src={qrCodeUrl} 
                  alt="Ticket QR Code" 
                  className="w-100 h-100"
                  style={{ objectFit: "contain" }}
                  data-testid="img-qr-code"
                />
              ) : (
                <div className="d-flex flex-column align-items-center justify-content-center h-100" data-testid="qr-placeholder">
                  <QrCode className="text-muted mb-2" size={40} />
                  <p className="text-muted small mb-0">QR Code</p>
                </div>
              )}
            </div>
            <p className="text-muted small">Present this QR code at the event entrance</p>
          </div>
        </div>
      </ModalBody>
      
      <ModalFooter>
        <button
          onClick={generateQR}
          className="btn btn-primary"
          disabled={!ticket || !!qrCodeUrl}
          data-testid="button-generate-qr"
        >
          <QrCode className="me-2" size={16} />
          {qrCodeUrl ? "QR Generated" : "Generate QR"}
        </button>
        <button
          onClick={downloadTicket}
          className="btn btn-outline-secondary"
          disabled={!qrCodeUrl}
          data-testid="button-download-ticket"
        >
          <Download className="me-2" size={16} />
          Download
        </button>
      </ModalFooter>
    </Modal>
  );
}