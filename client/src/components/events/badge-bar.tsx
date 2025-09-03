import React from 'react';

interface BadgeBarProps {
  event: {
    isAdminCreated?: boolean;
    goldenTicketEnabled?: boolean;
    specialEffectsEnabled?: boolean;
    surgePricing?: boolean;
    stickerUrl?: string | null;
    allowMinting?: boolean;
    geofence?: boolean;
    enableVoting?: boolean;
    recurringType?: string | null;
    p2pValidation?: boolean;
    maxTickets?: number | null;
    endDate?: string | null;
    reentryType?: string | null;
    maxUses?: number | null;
  };
  ticket?: {
    isValidated?: boolean | null;
    useCount?: number | null;
  };
}

const BadgeBar: React.FC<BadgeBarProps> = ({ event, ticket }) => {
  // Check if we need to show the badge bar at all
  const hasMission = event.isAdminCreated;
  const isValidated = ticket?.isValidated;
  const isPass = event.reentryType && event.reentryType !== 'No Reentry (Single Use)';
  const passUses = isPass ? (event.reentryType === 'No Limit' ? '∞' : (ticket?.useCount || '0')) : null;
  
  // Collect all other feature badges (as color segments)
  const colorSegments = [];
  if (event.goldenTicketEnabled) colorSegments.push('#FFD700'); // Golden
  if (event.specialEffectsEnabled) colorSegments.push('#9333EA'); // Purple
  if (event.surgePricing) colorSegments.push('#DC2626'); // Red
  if (event.stickerUrl) colorSegments.push('#EC4899'); // Pink
  if (event.p2pValidation) colorSegments.push('#3B82F6'); // Blue
  if (event.allowMinting) colorSegments.push('#000000'); // Black
  if (event.geofence) colorSegments.push('#F59E0B'); // Orange
  if (event.enableVoting) colorSegments.push('#EAB308'); // Yellow
  if (event.recurringType) colorSegments.push('#059669'); // Green
  if (event.maxTickets) colorSegments.push('#14B8A6'); // Teal
  if (event.endDate) colorSegments.push('#6B7280'); // Gray for multi-day

  // If nothing to show, return null
  if (!hasMission && !isValidated && !passUses && colorSegments.length === 0) {
    return null;
  }

  // Calculate segment width for color bar
  const segmentWidth = colorSegments.length > 0 ? (100 / colorSegments.length) : 0;

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
      {/* Mission Badge - Left */}
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
          Mission
        </div>
      )}
      
      {/* Color Segments - Middle (flexible width) */}
      {colorSegments.length > 0 && (
        <div className="flex-grow-1 d-flex">
          {colorSegments.map((color, index) => (
            <div
              key={index}
              style={{
                flex: `0 0 ${segmentWidth}%`,
                backgroundColor: color,
                opacity: 0.9
              }}
            />
          ))}
        </div>
      )}
      
      {/* If no color segments but need space between Mission/Pass/Validated */}
      {colorSegments.length === 0 && (hasMission || passUses || isValidated) && (
        <div className="flex-grow-1" />
      )}
      
      {/* Pass Uses Number */}
      {passUses && (
        <div
          style={{
            backgroundColor: '#10B981',
            color: '#fff',
            padding: '0 10px',
            display: 'flex',
            alignItems: 'center',
            fontWeight: 'bold',
            fontSize: '13px',
            flexShrink: 0
          }}
        >
          {passUses}
        </div>
      )}
      
      {/* Validated Badge - Right */}
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
          Validated
        </div>
      )}
    </div>
  );
};

export default BadgeBar;