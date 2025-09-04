import React from 'react';
import { Link } from 'wouter';
import calendarIcon from '@assets/calendar-0_1756849638733.png';
import goldenTicketIcon from '@assets/world_star-0_1756849251180.png';
import specialEffectsIcon from '@assets/image_1756849316138.png';
import certificateIcon from '@assets/certificate_multiple-1_1756849669534.png';
import gpsIcon from '@assets/gps-1_1756849430189.png';
import checkIcon from '@assets/check-0_1756849706987.png';
import usersIcon from '@assets/users_green-4_1756849357200.png';
import chartIcon from '@assets/chart1-4_1756850194937.png';
import clockIcon from '@assets/clock-1_1756752706835.png';
import dateIcon from '@assets/image_1756751150943.png';
import shieldIcon from '@assets/image_1756532723922.png';

interface FeatureGridProps {
  event: {
    isAdminCreated?: boolean;
    goldenTicketEnabled?: boolean;
    goldenTicketCount?: number;
    specialEffectsEnabled?: boolean;
    surgePricing?: boolean;
    stickerUrl?: string | null;
    stickerOdds?: number;
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
}

interface FeatureItem {
  enabled: boolean;
  color: string;
  label: string;
  href: string;
  icon: string;
  description?: string;
}

const FeatureGrid: React.FC<FeatureGridProps> = ({ event }) => {
  const features: FeatureItem[] = [
    {
      enabled: !!event.isAdminCreated,
      color: '#DC2626',
      label: 'Mission',
      href: '/type/mission',
      icon: shieldIcon,
      description: 'Official mission event'
    },
    {
      enabled: !!event.goldenTicketEnabled,
      color: '#FFD700',
      label: 'Golden Tickets',
      href: '/type/golden',
      icon: goldenTicketIcon,
      description: event.goldenTicketCount ? `${event.goldenTicketCount} golden tickets` : 'Golden ticket enabled'
    },
    {
      enabled: !!event.specialEffectsEnabled,
      color: '#9333EA',
      label: 'Special Effects',
      href: '/type/effects',
      icon: specialEffectsIcon,
      description: 'Visual effects on validated tickets'
    },
    {
      enabled: !!event.surgePricing,
      color: '#DC2626',
      label: 'Surge Pricing',
      href: '/type/surge',
      icon: chartIcon,
      description: 'Dynamic pricing based on demand'
    },
    {
      enabled: !!event.stickerUrl,
      color: '#EC4899',
      label: 'Stickers',
      href: '/type/stickers',
      icon: specialEffectsIcon,
      description: event.stickerOdds ? `${event.stickerOdds}% chance` : 'Custom stickers'
    },
    {
      enabled: !!event.p2pValidation,
      color: '#3B82F6',
      label: 'P2P Validation',
      href: '/type/p2p',
      icon: usersIcon,
      description: 'Peer-to-peer ticket validation'
    },
    {
      enabled: !!event.allowMinting,
      color: '#000000',
      label: 'Collectable',
      href: '/type/collectable',
      icon: certificateIcon,
      description: 'Mint as NFT collectible'
    },
    {
      enabled: !!event.geofence,
      color: '#F59E0B',
      label: 'Location Lock',
      href: '/type/geofenced',
      icon: gpsIcon,
      description: 'GPS-restricted validation'
    },
    {
      enabled: !!event.enableVoting,
      color: '#EAB308',
      label: 'Voting',
      href: '/type/voting',
      icon: checkIcon,
      description: 'Vote for best ticket'
    },
    {
      enabled: !!event.recurringType,
      color: '#059669',
      label: event.recurringType === 'weekly' ? 'Weekly' : 
              event.recurringType === 'monthly' ? 'Monthly' : 
              event.recurringType === 'annually' ? 'Annual' : 'Recurring',
      href: '/type/recurring',
      icon: calendarIcon,
      description: `${event.recurringType} recurring event`
    },
    {
      enabled: !!event.maxTickets,
      color: '#14B8A6',
      label: 'Limited',
      href: '/type/limited',
      icon: clockIcon,
      description: `Limited to ${event.maxTickets} tickets`
    },
    {
      enabled: !!event.endDate && event.endDate !== event.date,
      color: '#6B7280',
      label: 'Multi-day',
      href: '/events',
      icon: dateIcon,
      description: 'Multi-day event'
    },
    {
      enabled: event.reentryType !== 'No Reentry (Single Use)',
      color: '#10B981',
      label: event.reentryType === 'No Limit' ? 'Unlimited Pass' : 
              event.maxUses ? `Pass (${event.maxUses} uses)` : 'Pass',
      href: '/type/pass',
      icon: certificateIcon,
      description: event.reentryType === 'No Limit' ? 'Unlimited re-entry' : 
                   event.maxUses ? `Up to ${event.maxUses} entries` : 'Multiple entry pass'
    }
  ];

  // Filter to only enabled features
  const enabledFeatures = features.filter(f => f.enabled);

  if (enabledFeatures.length === 0) {
    return null;
  }

  return (
    <div className="mb-4">
      <div className="row g-2">
        {enabledFeatures.map((feature, index) => (
          <div key={index} className="col-6 col-sm-4 col-md-3 col-lg-2">
              <Link href={feature.href}>
                <div 
                  className="p-3 rounded text-center text-white position-relative"
                  style={{
                    backgroundColor: feature.color,
                    cursor: 'pointer',
                    transition: 'transform 0.2s, box-shadow 0.2s',
                    minHeight: '100px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                  title={feature.description}
                >
                  <img 
                    src={feature.icon} 
                    alt={feature.label}
                    style={{
                      width: '32px',
                      height: '32px',
                      marginBottom: '8px',
                      filter: feature.color === '#FFD700' || feature.color === '#EAB308' ? 'invert(1)' : 'none'
                    }}
                  />
                  <div 
                    className="fw-bold"
                    style={{
                      fontSize: '12px',
                      color: feature.color === '#FFD700' || feature.color === '#EAB308' ? '#000' : '#fff',
                      wordBreak: 'break-word',
                      lineHeight: '1.2'
                    }}
                  >
                    {feature.label}
                  </div>
                </div>
              </Link>
            </div>
          ))}
        </div>
    </div>
  );
};

export default FeatureGrid;