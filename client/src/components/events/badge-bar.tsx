import React from 'react';

interface BadgeBarProps {
  event: {
    isAdminCreated?: boolean;
    goldenTicketEnabled?: boolean;
    specialEffectsEnabled?: boolean;
    surgePricing?: boolean;
    stickerUrl?: string | null;
    allowMinting?: boolean;
    geofence?: string | null;
    enableVoting?: boolean;
    recurringType?: string | null;
    p2pValidation?: boolean;
    maxTickets?: number | null;
    endDate?: string | null;
  };
}

const BadgeBar: React.FC<BadgeBarProps> = ({ event }) => {
  // Define badge types with their colors
  const badges = [];
  
  if (event.isAdminCreated) {
    badges.push({ color: '#DC2626', label: 'Mission' });
  }
  if (event.goldenTicketEnabled) {
    badges.push({ color: '#FFD700', label: 'Golden' });
  }
  if (event.specialEffectsEnabled) {
    badges.push({ color: '#9333EA', label: 'Effects' });
  }
  if (event.surgePricing) {
    badges.push({ color: '#DC2626', label: 'Surge' });
  }
  if (event.stickerUrl) {
    badges.push({ color: '#EC4899', label: 'Stickers' });
  }
  if (event.allowMinting) {
    badges.push({ color: '#000000', label: 'Collect' });
  }
  if (event.geofence) {
    badges.push({ color: '#F59E0B', label: 'Geo' });
  }
  if (event.enableVoting) {
    badges.push({ color: '#EAB308', label: 'Vote' });
  }
  if (event.recurringType) {
    badges.push({ color: '#059669', label: 'Recurring' });
  }
  if (event.p2pValidation) {
    badges.push({ color: '#3B82F6', label: 'P2P' });
  }
  if (event.maxTickets) {
    badges.push({ color: '#14B8A6', label: 'Limited' });
  }
  if (event.endDate) {
    badges.push({ color: '#6B7280', label: 'Multi-day' });
  }

  // If no badges, return null
  if (badges.length === 0) return null;

  // Calculate width for each badge
  const badgeWidth = 100 / badges.length;

  return (
    <div 
      className="position-absolute bottom-0 start-0 w-100 d-flex"
      style={{ 
        height: '24px',
        zIndex: 10
      }}
    >
      {badges.map((badge, index) => (
        <div
          key={index}
          style={{
            flex: `0 0 ${badgeWidth}%`,
            backgroundColor: badge.color,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: badge.color === '#FFD700' || badge.color === '#EAB308' ? '#000' : '#fff',
            fontSize: '10px',
            fontWeight: 'bold',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            overflow: 'hidden',
            whiteSpace: 'nowrap',
            textOverflow: 'ellipsis',
            padding: '0 2px'
          }}
        >
          {badge.label}
        </div>
      ))}
    </div>
  );
};

export default BadgeBar;