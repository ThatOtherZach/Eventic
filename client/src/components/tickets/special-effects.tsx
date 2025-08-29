import { useEffect, useRef } from "react";
import { Event } from "@shared/schema";

type EffectType = 'snowflakes' | 'confetti' | 'fireworks' | 'hearts' | 'spooky' | 'pride' | 'nice' | 'monthly' | 'rainbow' | 'sticker';

interface SpecialEffectConfig {
  type: EffectType;
  condition: (event: Event) => boolean;
  priority?: number; // Higher priority effects override lower ones
}

// Get the day of year (1-365/366)
function getDayOfYear(date: Date): number {
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date.getTime() - start.getTime();
  const oneDay = 1000 * 60 * 60 * 24;
  return Math.floor(diff / oneDay);
}

// Monthly colors for glow effects
export const MONTHLY_COLORS: { [key: number]: { name: string; color1: string; color2: string } } = {
  0: { name: 'Navy Blue', color1: '#002366', color2: '#003380' },      // January
  1: { name: 'Crimson', color1: '#DC143C', color2: '#B91C3C' },       // February
  2: { name: 'Emerald', color1: '#008000', color2: '#00A000' },       // March
  3: { name: 'Bright Pink', color1: '#FF69B4', color2: '#FF1493' },   // April
  4: { name: 'Leaf Green', color1: '#32CD32', color2: '#3CB371' },    // May
  5: { name: 'Sky Blue', color1: '#1E90FF', color2: '#87CEEB' },      // June
  6: { name: 'Pure Red', color1: '#FF0000', color2: '#CC0000' },      // July
  7: { name: 'Golden', color1: '#FFD700', color2: '#FFA500' },        // August
  8: { name: 'Orange', color1: '#FF8C00', color2: '#FF6347' },        // September
  9: { name: 'Pumpkin', color1: '#FF4500', color2: '#FF6347' },       // October
  10: { name: 'Brown', color1: '#8B4513', color2: '#A0522D' },        // November
  11: { name: 'Holiday Green', color1: '#006400', color2: '#228B22' } // December
};

// Helper function to get monthly color for a ticket/event
export function getMonthlyColor(event: Event, ticket?: { id?: string }): { color1: string; color2: string } | null {
  // For preview tickets, use current month; for real tickets use event date
  const isPreview = ticket && ticket.id === 'sample';
  let month: number;
  if (isPreview) {
    month = new Date().getMonth();
  } else {
    // Parse date components to avoid timezone issues
    const [year, monthNum, day] = event.date.split('-').map(Number);
    month = monthNum - 1; // JavaScript months are 0-indexed
  }
  return MONTHLY_COLORS[month] || null;
}

// Define special effect conditions (ordered by priority)
const SPECIAL_EFFECTS: SpecialEffectConfig[] = [
  {
    type: 'nice',
    condition: (event) => {
      // Parse date components to avoid timezone issues
      const [year, month, day] = event.date.split('-').map(Number);
      const eventDate = new Date(year, month - 1, day);
      return getDayOfYear(eventDate) === 69; // 69th day of the year
    },
    priority: 100 // Highest priority - this overrides everything
  },
  {
    type: 'pride',
    condition: (event) => {
      const eventName = event.name.toLowerCase();
      return eventName.includes('pride') || eventName.includes('gay');
    },
    priority: 90
  },
  {
    type: 'hearts',
    condition: (event) => {
      // Parse date components to avoid timezone issues
      const [year, month, day] = event.date.split('-').map(Number);
      return month === 2 && day === 14; // February 14 (month is 2 in YYYY-MM-DD format)
    },
    priority: 80
  },
  {
    type: 'spooky',
    condition: (event) => {
      // Parse date components to avoid timezone issues
      const [year, month, day] = event.date.split('-').map(Number);
      return month === 10 && day === 31; // October 31 (month is 10 in YYYY-MM-DD format)
    },
    priority: 80
  },
  {
    type: 'snowflakes',
    condition: (event) => {
      // Parse date components to avoid timezone issues
      const [year, month, day] = event.date.split('-').map(Number);
      return month === 12 && day === 25; // December 25 (month is 12 in YYYY-MM-DD format)
    },
    priority: 80
  },
  {
    type: 'confetti',
    condition: (event) => {
      return event.name.toLowerCase().includes('party');
    },
    priority: 70
  },
  {
    type: 'fireworks',
    condition: (event) => {
      // Parse date components to avoid timezone issues
      const [year, month, day] = event.date.split('-').map(Number);
      return month === 12 && day === 31; // December 31 (month is 12 in YYYY-MM-DD format)
    },
    priority: 80
  },
  {
    type: 'monthly',
    condition: () => true, // Always applies, but has lowest priority
    priority: 10
  }
];

export function detectSpecialEffect(event: Event, ticket?: { isValidated: boolean | null; isDoubleGolden?: boolean; specialEffect?: string | null; id?: string; [key: string]: any }): EffectType | null {
  // Priority 1: Double golden tickets get rainbow effect (highest priority)
  if (ticket?.isDoubleGolden) {
    return 'rainbow';
  }
  
  // Priority 2: If ticket has a saved special effect from validation, use it
  if (ticket?.specialEffect) {
    return ticket.specialEffect as EffectType;
  }
  
  // Only apply effects if the event has special effects enabled
  if (!event.specialEffectsEnabled) {
    return null;
  }
  
  // Special case: for preview tickets (id = "sample"), don't use random chance
  const isPreview = ticket && ticket.id === 'sample';
  
  // Only apply effects to validated tickets (or preview)
  if (!ticket?.isValidated && !isPreview) {
    return null;
  }
  
  // For preview mode ONLY (no saved effects), determine effect for testing
  // Real validated tickets should have their effect saved from validation
  if (!isPreview) {
    return null; // Non-preview tickets should have saved effects
  }
  
  // Preview mode: show effects without random chance for testing
  const sortedEffects = [...SPECIAL_EFFECTS].sort((a, b) => (b.priority || 0) - (a.priority || 0));
  
  for (const effect of sortedEffects) {
    if (effect.condition(event)) {
      // For preview, always show the effect
      return effect.type;
    }
  }
  return null;
}

interface SpecialEffectsProps {
  event: Event;
  ticket?: { isValidated: boolean | null; id?: string; [key: string]: any };
  containerRef?: React.RefObject<HTMLElement>;
}

export function SpecialEffects({ event, ticket, containerRef }: SpecialEffectsProps) {
  // Check for preview effect type first
  const ticketWithPreview = ticket as any;
  const effectType = ticketWithPreview?.previewEffectType || detectSpecialEffect(event, ticket);
  const particlesRef = useRef<HTMLDivElement[]>([]);
  
  useEffect(() => {
    if (!effectType || effectType === 'nice' || effectType === 'pride' || effectType === 'monthly' || effectType === 'rainbow') return; // These are handled by overlay
    
    const container = containerRef?.current;
    if (!container) return;
    const particles: HTMLDivElement[] = [];
    
    const createSnowflakes = () => {
      // Create floating Christmas emojis like Halloween
      const christmasEmojis = ['🎄', '🎅', '⛄', '🎁', '❄️', '🔔', '⭐'];
      for (let i = 0; i < 4; i++) {
        const emoji = document.createElement('div');
        emoji.className = 'spooky-ghost'; // Reuse the floating animation
        emoji.innerHTML = christmasEmojis[Math.floor(Math.random() * christmasEmojis.length)];
        emoji.style.position = 'absolute';
        emoji.style.left = Math.random() * 80 + 10 + '%';
        emoji.style.top = Math.random() * 60 + 20 + '%';
        emoji.style.animationDelay = Math.random() * 6 + 's';
        emoji.style.fontSize = Math.random() * 15 + 15 + 'px';
        emoji.style.zIndex = '10';
        emoji.style.pointerEvents = 'none';
        container.appendChild(emoji);
        particles.push(emoji);
      }
    };
    
    const createConfetti = () => {
      const colors = ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff'];
      for (let i = 0; i < 50; i++) {
        const confetti = document.createElement('div');
        confetti.className = 'confetti';
        confetti.style.position = 'absolute';
        confetti.style.left = Math.random() * 100 + '%';
        confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
        confetti.style.animationDuration = Math.random() * 3 + 2 + 's';
        confetti.style.animationDelay = Math.random() * 2 + 's';
        confetti.style.zIndex = '10';
        confetti.style.pointerEvents = 'none';
        container.appendChild(confetti);
        particles.push(confetti);
      }
    };
    
    const createHearts = () => {
      // Create floating Valentine's emojis like Halloween
      const valentineEmojis = ['❤️', '💕', '💖', '💗', '💝', '💘', '😍', '🌹'];
      for (let i = 0; i < 4; i++) {
        const emoji = document.createElement('div');
        emoji.className = 'spooky-ghost'; // Reuse the floating animation
        emoji.innerHTML = valentineEmojis[Math.floor(Math.random() * valentineEmojis.length)];
        emoji.style.position = 'absolute';
        emoji.style.left = Math.random() * 80 + 10 + '%';
        emoji.style.top = Math.random() * 60 + 20 + '%';
        emoji.style.animationDelay = Math.random() * 6 + 's';
        emoji.style.fontSize = Math.random() * 15 + 15 + 'px';
        emoji.style.zIndex = '10';
        emoji.style.pointerEvents = 'none';
        container.appendChild(emoji);
        particles.push(emoji);
      }
    };
    
    const createSpooky = () => {
      // Create floating ghosts that stay within ticket bounds
      const ghosts = ['👻', '💀', '🎃', '🦇'];
      for (let i = 0; i < 4; i++) {
        const ghost = document.createElement('div');
        ghost.className = 'spooky-ghost';
        ghost.innerHTML = ghosts[Math.floor(Math.random() * ghosts.length)];
        ghost.style.position = 'absolute';
        ghost.style.left = Math.random() * 80 + 10 + '%';
        ghost.style.top = Math.random() * 60 + 20 + '%';
        ghost.style.animationDelay = Math.random() * 6 + 's';
        ghost.style.zIndex = '10';
        ghost.style.pointerEvents = 'none';
        container.appendChild(ghost);
        particles.push(ghost);
      }
      
      // Create fog layer
      const fog = document.createElement('div');
      fog.className = 'spooky-fog';
      fog.style.position = 'absolute';
      fog.style.inset = '0';
      fog.style.pointerEvents = 'none';
      container.appendChild(fog);
      particles.push(fog);
    };
    
    const createFireworks = () => {
      const createBurst = () => {
        const x = Math.random() * window.innerWidth;
        const y = Math.random() * (window.innerHeight / 2);
        
        const burst = document.createElement('div');
        burst.className = 'firework-burst';
        burst.style.position = 'absolute';
        burst.style.left = x + 'px';
        burst.style.top = y + 'px';
        burst.style.pointerEvents = 'none';
        
        const colors = ['#ff0000', '#ffa500', '#ffff00', '#00ff00', '#0000ff', '#ff00ff'];
        const color = colors[Math.floor(Math.random() * colors.length)];
        
        // Create sparks
        for (let i = 0; i < 12; i++) {
          const spark = document.createElement('div');
          spark.className = 'firework-spark';
          spark.style.backgroundColor = color;
          spark.style.boxShadow = `0 0 6px ${color}`;
          
          const angle = (i * 30) * Math.PI / 180;
          const distance = 50 + Math.random() * 50;
          spark.style.setProperty('--spark-x', Math.cos(angle) * distance + 'px');
          spark.style.setProperty('--spark-y', Math.sin(angle) * distance + 'px');
          
          burst.appendChild(spark);
        }
        
        container.appendChild(burst);
        particles.push(burst);
        
        // Remove burst after animation (faster)
        setTimeout(() => {
          burst.remove();
          const index = particles.indexOf(burst);
          if (index > -1) particles.splice(index, 1);
        }, 800);
      };
      
      // Create bursts more frequently
      const interval = setInterval(createBurst, 400);
      
      // Store interval cleanup
      return () => clearInterval(interval);
    };
    
    const createSticker = () => {
      // Create floating custom sticker images
      if (!event.stickerUrl) return;
      
      for (let i = 0; i < 4; i++) {
        const sticker = document.createElement('img');
        sticker.className = 'spooky-ghost'; // Reuse the floating animation
        // Use the URL directly if it starts with http/https, otherwise treat as object storage path
        sticker.src = event.stickerUrl.startsWith('http') ? event.stickerUrl : 
                     (event.stickerUrl.startsWith('/objects/') ? event.stickerUrl : '/objects/' + event.stickerUrl.split('/').pop());
        sticker.style.position = 'absolute';
        sticker.style.left = Math.random() * 80 + 10 + '%';
        sticker.style.top = Math.random() * 60 + 20 + '%';
        sticker.style.animationDelay = Math.random() * 6 + 's';
        sticker.style.width = Math.random() * 20 + 20 + 'px';
        sticker.style.height = 'auto';
        sticker.style.zIndex = '10';
        sticker.style.pointerEvents = 'none';
        
        // Hide the image if it fails to load
        sticker.onerror = () => {
          sticker.style.display = 'none';
        };
        
        container.appendChild(sticker);
        particles.push(sticker);
      }
    };
    
    let cleanup: (() => void) | undefined;
    
    switch (effectType) {
      case 'snowflakes':
        createSnowflakes();
        break;
      case 'confetti':
        createConfetti();
        break;
      case 'hearts':
        createHearts();
        break;
      case 'spooky':
        createSpooky();
        break;
      case 'fireworks':
        cleanup = createFireworks();
        break;
      case 'sticker':
        createSticker();
        break;
      case 'pride':
      case 'monthly':
        // These are handled by SpecialEffectOverlay component
        break;
    }
    
    particlesRef.current = particles;
    
    return () => {
      // Cleanup particles
      particles.forEach(particle => particle.remove());
      if (cleanup) cleanup();
    };
  }, [effectType, containerRef]);
  
  return null;
}

// Overlay component for glow effects
export function SpecialEffectOverlay({ event, ticket }: { event: Event; ticket?: { isValidated: boolean | null; id?: string; [key: string]: any } }) {
  // Check for preview effect type first
  const ticketWithPreview = ticket as any;
  const effectType = ticketWithPreview?.previewEffectType || detectSpecialEffect(event, ticket);
  
  if (!effectType) return null;
  
  // Nice Day (69th) effect
  if (effectType === 'nice') {
    return (
      <>
        <div 
          className="position-absolute w-100 h-100 pointer-events-none"
          style={{
            animation: 'niceGlow 3s ease-in-out infinite',
            zIndex: 2,
          }}
        />
        <div 
          className="position-absolute"
          style={{
            right: '20px',
            top: '50%',
            transform: 'translateY(-50%)',
            zIndex: 10,
            fontSize: '36px',
            fontFamily: '"Comic Sans MS", "Comic Sans", "Chalkboard SE", "Marker Felt", cursive',
            fontWeight: 'bold',
            color: '#fff',
            textShadow: '2px 2px 0 #000, -2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000, 2px 0 0 #000, -2px 0 0 #000, 0 2px 0 #000, 0 -2px 0 #000',
          }}
        >
          Nice ;)
        </div>
      </>
    );
  }
  
  // Pride rainbow glow
  if (effectType === 'pride') {
    return (
      <div 
        className="position-absolute w-100 h-100 pointer-events-none"
        style={{
          animation: 'rainbowDoubleGolden 4s ease-in-out infinite',
          zIndex: 2,
        }}
      />
    );
  }
  
  // Monthly color glow
  if (effectType === 'monthly') {
    // For preview tickets, use current month; for real tickets use event date
    const isPreview = ticket && ticket.id === 'sample';
    let month: number;
    if (isPreview) {
      month = new Date().getMonth();
    } else {
      // Parse date components to avoid timezone issues
      const [year, monthNum, day] = event.date.split('-').map(Number);
      month = monthNum - 1; // JavaScript months are 0-indexed
    }
    const monthColor = MONTHLY_COLORS[month];
    
    return (
      <div 
        className="position-absolute w-100 h-100 pointer-events-none"
        style={{
          '--month-color-1': monthColor.color1,
          '--month-color-2': monthColor.color2,
          animation: 'monthlyGlow 3s ease-in-out infinite',
          zIndex: 2,
        } as React.CSSProperties}
      />
    );
  }
  
  // Super RGB (rainbow double golden effect)
  if (effectType === 'rainbow') {
    return (
      <>
        <div 
          className="position-absolute w-100 h-100 pointer-events-none"
          style={{
            animation: 'rainbowDoubleGolden 4s ease-in-out infinite',
            zIndex: 2,
          }}
        />
        <style>{`
          .super-rgb-text {
            background: linear-gradient(
              90deg,
              #ff0000,
              #ff7f00,
              #ffff00,
              #00ff00,
              #0000ff,
              #4b0082,
              #9400d3,
              #ff0000
            );
            background-size: 200% 100%;
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
            animation: rainbow-slide 3s linear infinite;
            font-weight: bold;
          }
          
          @keyframes rainbow-slide {
            0% { background-position: 0% 50%; }
            100% { background-position: 200% 50%; }
          }
        `}</style>
      </>
    );
  }
  
  return null;
}

// Badge component to show the special effect type (now hidden per user request)
export function SpecialEffectBadge({ event, ticket }: { event: Event; ticket?: { isValidated: boolean | null; isDoubleGolden?: boolean; id?: string; [key: string]: any } }) {
  // Don't show color badges anymore per user request
  return null;
}