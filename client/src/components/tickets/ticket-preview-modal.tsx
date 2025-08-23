import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { generateQRCode } from "@/lib/qr-utils";
import type { Event, Ticket } from "@shared/schema";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X, QrCode, Download } from "lucide-react";

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
      toast({
        title: "Success",
        description: "Ticket created successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create ticket",
        variant: "destructive",
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
        variant: "destructive",
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            Event Ticket
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="text-gray-400 hover:text-gray-600"
              data-testid="button-close-ticket-modal"
            >
              <X className="h-4 w-4" />
            </Button>
          </DialogTitle>
        </DialogHeader>

        {/* Ticket Design */}
        <div className="bg-white border-2 border-dashed border-gray-300 rounded-lg p-6 mb-4">
          <div className="text-center border-b border-gray-200 pb-4 mb-4">
            <h4 className="text-lg font-semibold text-gray-900">{event.name}</h4>
            <p className="text-sm text-gray-600">{event.venue}</p>
            <p className="text-sm text-gray-500">{event.date} at {event.time}</p>
          </div>

          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-xs text-gray-500">Ticket ID</p>
              <p className="text-sm font-mono text-gray-900" data-testid="text-ticket-id">
                {ticket?.ticketNumber || "Loading..."}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500">Price</p>
              <p className="text-lg font-semibold text-primary">${event.ticketPrice}</p>
            </div>
          </div>

          {/* QR Code Container */}
          <div className="bg-white border-2 border-gray-200 rounded-lg p-4 mx-auto w-32 h-32 flex items-center justify-center mb-4">
            {qrCodeUrl ? (
              <img 
                src={qrCodeUrl} 
                alt="Ticket QR Code" 
                className="w-full h-full object-contain"
                data-testid="img-qr-code"
              />
            ) : (
              <div className="text-center" data-testid="qr-placeholder">
                <QrCode className="text-gray-400 text-3xl mb-2 mx-auto" />
                <p className="text-xs text-gray-500">QR Code</p>
              </div>
            )}
          </div>

          <div className="text-center text-xs text-gray-500">
            <p>Present this QR code at the event entrance</p>
          </div>
        </div>

        <div className="flex space-x-3">
          <Button
            onClick={generateQR}
            className="flex-1 bg-primary hover:bg-primary-dark"
            disabled={!ticket || !!qrCodeUrl}
            data-testid="button-generate-qr"
          >
            <QrCode className="mr-2 h-4 w-4" />
            {qrCodeUrl ? "QR Generated" : "Generate QR"}
          </Button>
          <Button
            onClick={downloadTicket}
            variant="outline"
            className="flex-1"
            disabled={!qrCodeUrl}
            data-testid="button-download-ticket"
          >
            <Download className="mr-2 h-4 w-4" />
            Download
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
