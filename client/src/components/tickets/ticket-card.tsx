import { useEffect, useRef } from "react";
import QRCode from "qrcode";
import { Calendar, Clock, MapPin } from "lucide-react";
import { Link } from "wouter";
import type { Event, Ticket } from "@shared/schema";
import { SpecialEffects, SpecialEffectBadge, SpecialEffectOverlay, detectSpecialEffect, getMonthlyColor } from "./special-effects";

interface TicketCardProps {
  ticket: Ticket;
  event: Event;
  showQR?: boolean;
  dynamicQrUrl?: string;
  isValidating?: boolean;
  showBadges?: boolean;
}

export function TicketCard({ ticket, event, showQR = true, dynamicQrUrl, isValidating = false, showBadges = false }: TicketCardProps) {
  const qrCanvasRef = useRef<HTMLCanvasElement>(null);
  const ticketContainerRef = useRef<HTMLDivElement>(null);
  
  // Check if this ticket has any special effects
  // For preview tickets with previewEffectType, use that directly
  const ticketWithPreview = ticket as any;
  const specialEffect = ticketWithPreview.previewEffectType || detectSpecialEffect(event, ticket as any);
  const hasSpecialEffects = ticket.isGoldenTicket || specialEffect !== null;
  const monthlyColor = specialEffect === 'monthly' ? getMonthlyColor(event, ticket) : null;

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
      ref={ticketContainerRef}
      className="ticket-card position-relative w-100"
      style={{
        aspectRatio: showQR || isValidating ? '7/4' : '16/9',
        maxWidth: '100%',
        minHeight: '200px',
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
        <div 
          className="position-absolute w-100 h-100 pointer-events-none"
          style={{
            background: 'radial-gradient(circle at center, transparent 30%, rgba(255, 215, 0, 0.15) 70%)',
            boxShadow: 'inset 0 0 30px rgba(255, 215, 0, 0.225), inset 0 0 60px rgba(255, 215, 0, 0.075)',
            animation: 'goldenGlow 3s ease-in-out infinite',
            zIndex: 2,
          }}
        />
      )}

      {/* Special Event Effects Badge */}
      <SpecialEffectBadge event={event} ticket={ticket as any} />
      
      {/* Special Effects Overlay (for glows and text) */}
      <SpecialEffectOverlay event={event} ticket={ticket} />
      
      {/* Special Effects Animation (for particles) */}
      <SpecialEffects event={event} ticket={ticket} containerRef={ticketContainerRef} />

      {/* Ticket Content */}
      <div className="position-relative h-100 d-flex">
        {/* Left side - Event Details */}
        <div className="flex-grow-1 px-3 pt-3 pb-4 text-white d-flex flex-column justify-content-between">
          <div>
            <h5 className="mb-1 text-truncate fw-bold" style={{ fontSize: '16px' }}>
              {specialEffect === 'rainbow' ? (
                // Super RGB effect - rainbow animated text
                <span className="super-rgb-text">
                  {event.name}
                </span>
              ) : ticket.isGoldenTicket ? (
                // Golden ticket badge takes priority over monthly
                <span 
                  style={{
                    padding: '2px 8px',
                    borderRadius: '4px',
                    backgroundColor: 'rgba(255, 215, 0, 0.85)',
                    color: '#000',
                    display: 'inline-block',
                    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)',
                  }}
                >
                  {event.name}
                </span>
              ) : specialEffect === 'monthly' && monthlyColor ? (
                // Monthly effect badge - only if not golden
                <span 
                  style={{
                    padding: '2px 8px',
                    borderRadius: '4px',
                    background: `linear-gradient(135deg, ${monthlyColor.color1}, ${monthlyColor.color2})`,
                    color: '#fff',
                    display: 'inline-block',
                    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)',
                    textShadow: '0 1px 2px rgba(0, 0, 0, 0.3)',
                  }}
                >
                  {event.name}
                </span>
              ) : (
                event.name
              )}
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
              {ticket.ticketNumber}{ticket.isGoldenTicket && ' 🎫'}
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

      {/* Event Feature Badge Bar at Bottom - Format: [Mission][Validated]---colors---[#] */}
      {(() => {
        // Check what badges we need to show
        const hasMission = (event as any).isAdminCreated;
        const isValidated = showBadges && Boolean(ticket.isValidated);
        const isPass = showBadges && event.reentryType && event.reentryType !== 'No Reentry (Single Use)';
        const passUses = isPass ? (event.reentryType === 'No Limit' ? '∞' : String(ticket.useCount || 0)) : null;
        
        // Collect color segments for features (no text, just colors)
        const colorSegments = [];
        if (event.goldenTicketEnabled) colorSegments.push('#FFD700'); // Golden
        if (event.specialEffectsEnabled) colorSegments.push('#9333EA'); // Purple  
        if (event.p2pValidation) colorSegments.push('#3B82F6'); // Blue
        if (event.allowMinting) colorSegments.push('#000000'); // Black
        if (event.geofence) colorSegments.push('#F59E0B'); // Orange
        if (event.treasureHunt) colorSegments.push('#FF6B35'); // Orange-red for Hunt
        if (event.enableVoting) colorSegments.push('#EAB308'); // Yellow
        if (event.surgePricing) colorSegments.push('#DC2626'); // Red
        if (event.stickerUrl) colorSegments.push('#EC4899'); // Pink
        if (event.recurringType) colorSegments.push('#059669'); // Green
        if (event.endDate && event.endDate !== event.date) colorSegments.push('#6B7280'); // Gray for multi-day
        
        // Add special ticket status to colors
        if (showBadges) {
          if ((ticket as any).resellStatus === "for_resale") colorSegments.push('#FFC107'); // Yellow for returned
          if (ticket.nftMediaUrl) colorSegments.push('#17a2b8'); // Teal for NFT
        }

        // If nothing to show, don't show the bar
        if (!hasMission && !isValidated && colorSegments.length === 0 && !passUses) return null;

        return (
          <div 
            className="position-absolute bottom-0 start-0 w-100 d-flex align-items-stretch"
            style={{ 
              height: '24px',
              zIndex: 10,
              fontSize: '11px',
              fontWeight: 'bold'
            }}
          >
            {/* Mission Badge - First */}
            {hasMission && (
              <div
                style={{
                  backgroundColor: '#DC2626',
                  color: '#fff',
                  padding: '0 8px',
                  display: 'flex',
                  alignItems: 'center',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  whiteSpace: 'nowrap',
                  flexShrink: 0
                }}
              >
                MISSION
              </div>
            )}
            
            {/* Validated Badge - Second */}
            {isValidated && (
              <div
                style={{
                  backgroundColor: '#059669',
                  color: '#fff',
                  padding: '0 8px',
                  display: 'flex',
                  alignItems: 'center',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  whiteSpace: 'nowrap',
                  flexShrink: 0
                }}
              >
                VALIDATED
              </div>
            )}
            
            {/* Color segments fill the middle */}
            {colorSegments.length > 0 && (
              <div className="flex-grow-1 d-flex" style={{ minWidth: 0 }}>
                {colorSegments.map((color, index) => (
                  <div
                    key={index}
                    style={{
                      flex: 1,
                      backgroundColor: color
                    }}
                  />
                ))}
              </div>
            )}
            
            {/* If no color segments but we need space filler, add empty space */}
            {colorSegments.length === 0 && (hasMission || isValidated) && passUses && (
              <div className="flex-grow-1" />
            )}
            
            {/* Pass count - Last */}
            {passUses && (
              <div
                style={{
                  backgroundColor: '#0DCAF0',
                  color: '#000',
                  padding: '0 12px',
                  display: 'flex',
                  alignItems: 'center',
                  fontWeight: 'bold',
                  flexShrink: 0
                }}
              >
                {passUses}
              </div>
            )}
          </div>
        );
      })()}

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