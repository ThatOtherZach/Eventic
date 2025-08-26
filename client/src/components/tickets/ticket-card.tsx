import { useEffect, useRef } from "react";
import QRCode from "qrcode";
import { Calendar, Clock, MapPin } from "lucide-react";
import { Link } from "wouter";
import type { Event, Ticket } from "@shared/schema";
import { SpecialEffects, SpecialEffectBadge, SpecialEffectOverlay, detectSpecialEffect } from "./special-effects";

interface TicketCardProps {
  ticket: Ticket;
  event: Event;
  showQR?: boolean;
  dynamicQrUrl?: string;
  isValidating?: boolean;
}

export function TicketCard({ ticket, event, showQR = true, dynamicQrUrl, isValidating = false }: TicketCardProps) {
  const qrCanvasRef = useRef<HTMLCanvasElement>(null);
  
  // Debug: Log what's being received
  console.log("TicketCard - ticketBackgroundUrl:", event.ticketBackgroundUrl);
  
  // Check if this ticket has any special effects
  const hasSpecialEffects = ticket.isGoldenTicket || detectSpecialEffect(event, { isValidated: !!ticket.isValidated }) !== null;

  useEffect(() => {
    if (showQR && qrCanvasRef.current && ticket.qrData) {
      QRCode.toCanvas(
        qrCanvasRef.current,
        ticket.qrData,
        {
          width: 180,
          margin: 1,
          color: {
            dark: "#000000",
            light: "#FFFFFF",
          },
        },
        (error: any) => {
          if (error) console.error("QR Generation error:", error);
        }
      );
    }
  }, [ticket.qrData, showQR]);

  // Business card dimensions: 3.5" x 2" (aspect ratio 7:4)
  // For screen display: maintain aspect ratio but allow width to be responsive
  return (
    <div 
      className="ticket-card position-relative w-100"
      style={{
        aspectRatio: showQR || isValidating ? '7/4' : '2/1',
        maxWidth: '100%',
        minHeight: '150px',
        borderRadius: '8px',
        overflow: 'hidden',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
        background: event.ticketBackgroundUrl 
          ? `url(${event.ticketBackgroundUrl}) center/cover` 
          : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        transition: 'transform 0.2s, box-shadow 0.2s',
      }}
      data-testid={`ticket-card-${ticket.id}`}
      onMouseEnter={(e) => {
        if (!showQR && !isValidating) {
          e.currentTarget.style.transform = 'translateY(-2px)';
          e.currentTarget.style.boxShadow = '0 6px 12px rgba(0, 0, 0, 0.15)';
        }
      }}
      onMouseLeave={(e) => {
        if (!showQR && !isValidating) {
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.1)';
        }
      }}
    >
      {/* Semi-transparent overlay for text readability */}
      <div 
        className="position-absolute w-100 h-100"
        style={{
          background: event.ticketBackgroundUrl 
            ? 'rgba(0, 0, 0, 0.4)' 
            : 'rgba(0, 0, 0, 0.2)',
          backdropFilter: 'blur(1px)',
        }}
      />

      {/* Golden Ticket Glow Overlay */}
      {ticket.isGoldenTicket && (
        <>
          <div 
            className="position-absolute w-100 h-100 pointer-events-none"
            style={{
              background: 'radial-gradient(circle at center, transparent 30%, rgba(255, 215, 0, 0.15) 70%)',
              boxShadow: 'inset 0 0 30px rgba(255, 215, 0, 0.225), inset 0 0 60px rgba(255, 215, 0, 0.075)',
              animation: 'goldenGlow 3s ease-in-out infinite',
              zIndex: 2,
            }}
          />
          {/* Golden Ticket Badge */}
          <div 
            className="position-absolute"
            style={{
              top: '10px',
              right: '10px',
              zIndex: 10,
              padding: '4px 8px',
              borderRadius: '4px',
              backgroundColor: 'rgba(255, 215, 0, 0.675)',
              color: '#000',
              fontSize: '12px',
              fontWeight: 'bold',
              boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)',
            }}
          >
            🎫 GOLDEN
          </div>
        </>
      )}

      {/* Special Event Effects Badge */}
      <SpecialEffectBadge event={event} ticket={{ isValidated: !!ticket.isValidated }} />
      
      {/* Special Effects Overlay (for glows and text) */}
      <SpecialEffectOverlay event={event} ticket={{ isValidated: !!ticket.isValidated }} />
      
      {/* Special Effects Animation (for particles) */}
      <SpecialEffects event={event} ticket={{ isValidated: !!ticket.isValidated }} />

      {/* Ticket Content */}
      <div className="position-relative h-100 d-flex">
        {/* Left side - Event Details */}
        <div className="flex-grow-1 p-3 text-white d-flex flex-column justify-content-between">
          <div>
            <h5 className="mb-1 text-truncate fw-bold" style={{ fontSize: '16px' }}>
              {event.name}
            </h5>
            <div className="small opacity-75">
              <div className="d-flex align-items-center mb-1">
                <Calendar size={12} className="me-1" />
                {event.date}
              </div>
              <div className="d-flex align-items-center mb-1">
                <Clock size={12} className="me-1" />
                {event.time}
              </div>
              <div className="d-flex align-items-center">
                <MapPin size={12} className="me-1" />
                <span className="text-truncate">{event.venue}</span>
              </div>
            </div>
          </div>
          <div className="mt-2">
            <div className="small opacity-75">Ticket #</div>
            <div className="fst-italic" style={{ fontSize: '14px' }}>
              {ticket.ticketNumber}
            </div>
          </div>
        </div>

        {/* Right side - QR Code (only show when QR is enabled or validating) */}
        {(showQR || isValidating) && (
          <div 
            className="d-flex align-items-center justify-content-center"
            style={{
              width: '210px',
              backgroundColor: 'white',
              borderRadius: '0 8px 8px 0',
            }}
          >
            {isValidating && dynamicQrUrl ? (
              <div className="text-center">
                <img 
                  src={dynamicQrUrl} 
                  alt="Validation QR Code" 
                  style={{ width: '180px', height: '180px' }}
                />
                <div className="small text-muted mt-1" style={{ fontSize: '10px' }}>Validation Code</div>
              </div>
            ) : (
              <canvas
                ref={qrCanvasRef}
                style={{ display: 'block' }}
              />
            )}
          </div>
        )}
      </div>

      {/* Special Effects Explanation Link */}
      {hasSpecialEffects && (
        <div className="text-center mt-2">
          <Link href="/special-effects">
            <span 
              className="text-muted small"
              style={{ 
                textDecoration: 'underline',
                cursor: 'pointer',
                fontSize: '12px'
              }}
              data-testid="link-special-effects"
            >
              Why does it look like that?
            </span>
          </Link>
        </div>
      )}
    </div>
  );
}