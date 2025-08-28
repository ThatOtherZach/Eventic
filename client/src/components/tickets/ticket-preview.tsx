import { useState } from "react";
import { generateQRCode } from "@/lib/qr-utils";
import { QrCode } from "lucide-react";
import type { Event, Ticket } from "@shared/schema";

interface TicketPreviewProps {
  event: Event;
  ticket: Ticket;
}

export function TicketPreview({ event, ticket }: TicketPreviewProps) {
  const [qrCodeUrl, setQrCodeUrl] = useState<string>("");
  
  const handleGenerateQR = async () => {
    try {
      const url = await generateQRCode(ticket.qrData);
      setQrCodeUrl(url);
    } catch (error) {
      console.error("Failed to generate QR code:", error);
    }
  };

  return (
    <div className="border border-2 border-secondary border-opacity-25 rounded p-3" style={{ borderStyle: "dashed" }}>
      <div className="row">
        <div className="col-8">
          <h6 className="fw-semibold mb-1">{event.name}</h6>
          <p className="text-muted small mb-1">{event.venue}</p>
          <p className="text-muted small mb-2">{event.date} at {event.time}</p>
          <p className="small mb-0">
            <span className="text-muted">Ticket:</span> <span className="font-monospace">{ticket.ticketNumber}</span>
          </p>
        </div>
        <div className="col-4 text-center">
          {qrCodeUrl ? (
            <img 
              src={qrCodeUrl} 
              alt="QR Code" 
              className="img-fluid"
              style={{ maxWidth: "80px" }}
            />
          ) : (
            <button 
              className="btn btn-sm btn-secondary"
              onClick={handleGenerateQR}
            >
              <QrCode size={16} className="me-1" />
              QR
            </button>
          )}
        </div>
      </div>
    </div>
  );
}