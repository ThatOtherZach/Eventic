import { useMemo } from "react";
import { useLocation } from "wouter";

interface EventTypesBarProps {
  events: Array<{
    event: {
      isAdminCreated?: boolean | null;
      goldenTicketEnabled?: boolean | null;
      specialEffectsEnabled?: boolean | null;
      surgePricing?: boolean | null;
      stickerUrl?: string | null;
      p2pValidation?: boolean | null;
      allowMinting?: boolean | null;
      geofence?: boolean | null;
      enableVoting?: boolean | null;
      recurringType?: string | null;
      endDate?: string | null;
    };
  }>;
}

// Define badge types with their colors and labels
const badgeTypes = [
  { key: 'isAdminCreated', color: '#DC2626', label: 'Mission Event', searchParam: 'mission' },
  { key: 'goldenTicketEnabled', color: '#FFD700', label: 'Golden Tickets', searchParam: 'golden' },
  { key: 'specialEffectsEnabled', color: '#9333EA', label: 'Special Effects', searchParam: 'effects' },
  { key: 'surgePricing', color: '#DC2626', label: 'Surge Pricing', searchParam: 'surge' },
  { key: 'stickerUrl', color: '#EC4899', label: 'Custom Stickers', searchParam: 'stickers' },
  { key: 'p2pValidation', color: '#3B82F6', label: 'P2P Validation', searchParam: 'p2p' },
  { key: 'allowMinting', color: '#000000', label: 'Collectable NFT', searchParam: 'nft' },
  { key: 'geofence', color: '#F59E0B', label: 'Location Lock', searchParam: 'geofenced' },
  { key: 'enableVoting', color: '#EAB308', label: 'Voting Enabled', searchParam: 'voting' },
  { key: 'recurringType', color: '#059669', label: 'Recurring', searchParam: 'recurring' },
  { key: 'endDate', color: '#6B7280', label: 'Multi-day', searchParam: 'multiday' },
];

export function EventTypesBar({ events }: EventTypesBarProps) {
  const [, setLocation] = useLocation();
  
  const segments = useMemo(() => {
    // Count occurrences of each badge type
    const counts: Record<string, number> = {};
    let totalCount = 0;
    
    badgeTypes.forEach(badge => {
      const count = events.filter(e => {
        if (badge.key === 'endDate') {
          return !!e.event.endDate;
        }
        return !!e.event[badge.key as keyof typeof e.event];
      }).length;
      
      if (count > 0) {
        counts[badge.key] = count;
        totalCount += count;
      }
    });
    
    if (totalCount === 0) return [];
    
    // Create segments with their relative widths
    const segs = badgeTypes
      .filter(badge => counts[badge.key] > 0)
      .map(badge => ({
        ...badge,
        count: counts[badge.key],
        percentage: (counts[badge.key] / totalCount) * 100
      }));
    
    // Sort by count (highest in the middle)
    segs.sort((a, b) => b.count - a.count);
    
    // Rearrange to have highest counts in the center, expanding outward
    const arranged: typeof segs = [];
    segs.forEach((seg, index) => {
      if (index % 2 === 0) {
        arranged.push(seg);
      } else {
        arranged.unshift(seg);
      }
    });
    
    return arranged;
  }, [events]);
  
  if (segments.length === 0) return null;
  
  const handleSegmentClick = (searchParam: string) => {
    // Navigate to the event type page
    setLocation(`/type/${searchParam}`);
  };
  
  return (
    <div 
      className="d-flex" 
      style={{ 
        height: '50px', 
        gap: '0',
        borderRadius: '4px',
        overflow: 'hidden'
      }}
    >
      {segments.map((segment, index) => (
        <div
          key={segment.key}
          onClick={() => handleSegmentClick(segment.searchParam)}
          style={{
            flex: segment.percentage,
            backgroundColor: segment.color,
            cursor: 'pointer',
            transition: 'transform 0.2s, opacity 0.2s',
            borderRadius: index === 0 ? '4px 0 0 4px' : index === segments.length - 1 ? '0 4px 4px 0' : '0',
          }}
          title={`${segment.label} (${segment.count} event${segment.count > 1 ? 's' : ''})`}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'scaleY(1.5)';
            e.currentTarget.style.opacity = '0.8';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'scaleY(1)';
            e.currentTarget.style.opacity = '1';
          }}
        />
      ))}
    </div>
  );
}