import { useEffect, useRef } from "react";
import { Event } from "@shared/schema";

type EffectType = 'snowflakes' | 'confetti' | 'fireworks' | 'hearts' | 'spooky' | 'pride' | 'nice' | 'monthly';

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
const MONTHLY_COLORS: { [key: number]: { name: string; color1: string; color2: string } } = {
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

// Define special effect conditions (ordered by priority)
const SPECIAL_EFFECTS: SpecialEffectConfig[] = [
  {
    type: 'nice',
    condition: (event) => {
      const eventDate = new Date(event.date);
      return getDayOfYear(eventDate) === 69; // 69th day of the year
    },
    priority: 100 // Highest priority - this overrides everything
  },
  {
    type: 'pride',
    condition: (event) => {
      return event.name.toLowerCase().includes('pride');
    },
    priority: 90
  },
  {
    type: 'hearts',
    condition: (event) => {
      const eventDate = new Date(event.date);
      return eventDate.getMonth() === 1 && eventDate.getDate() === 14; // February 14
    },
    priority: 80
  },
  {
    type: 'spooky',
    condition: (event) => {
      const eventDate = new Date(event.date);
      return eventDate.getMonth() === 9 && eventDate.getDate() === 31; // October 31
    },
    priority: 80
  },
  {
    type: 'snowflakes',
    condition: (event) => {
      const eventDate = new Date(event.date);
      return eventDate.getMonth() === 11 && eventDate.getDate() === 25; // December 25
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
      const eventDate = new Date(event.date);
      return eventDate.getMonth() === 11 && eventDate.getDate() === 31; // December 31 (New Year's Eve)
    },
    priority: 80
  },
  {
    type: 'monthly',
    condition: () => true, // Always applies, but has lowest priority
    priority: 10
  }
];

export function detectSpecialEffect(event: Event): EffectType | null {
  // Sort by priority (highest first) and find the first matching effect
  const sortedEffects = [...SPECIAL_EFFECTS].sort((a, b) => (b.priority || 0) - (a.priority || 0));
  
  for (const effect of sortedEffects) {
    if (effect.condition(event)) {
      return effect.type;
    }
  }
  return null;
}

interface SpecialEffectsProps {
  event: Event;
  containerRef?: React.RefObject<HTMLElement>;
}

export function SpecialEffects({ event, containerRef }: SpecialEffectsProps) {
  const effectType = detectSpecialEffect(event);
  const particlesRef = useRef<HTMLDivElement[]>([]);
  
  useEffect(() => {
    if (!effectType || effectType === 'nice') return; // Nice effect is handled differently
    
    const container = containerRef?.current || document.body;
    const particles: HTMLDivElement[] = [];
    
    const createSnowflakes = () => {
      for (let i = 0; i < 30; i++) {
        const snowflake = document.createElement('div');
        snowflake.className = 'snowflake';
        snowflake.innerHTML = '❄';
        snowflake.style.left = Math.random() * 100 + '%';
        snowflake.style.animationDuration = Math.random() * 3 + 5 + 's';
        snowflake.style.animationDelay = Math.random() * 3 + 's';
        snowflake.style.fontSize = Math.random() * 10 + 10 + 'px';
        container.appendChild(snowflake);
        particles.push(snowflake);
      }
    };
    
    const createConfetti = () => {
      const colors = ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff'];
      for (let i = 0; i < 50; i++) {
        const confetti = document.createElement('div');
        confetti.className = 'confetti';
        confetti.style.left = Math.random() * 100 + '%';
        confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
        confetti.style.animationDuration = Math.random() * 3 + 2 + 's';
        confetti.style.animationDelay = Math.random() * 2 + 's';
        container.appendChild(confetti);
        particles.push(confetti);
      }
    };
    
    const createHearts = () => {
      for (let i = 0; i < 25; i++) {
        const heart = document.createElement('div');
        heart.className = 'falling-heart';
        heart.innerHTML = '❤';
        heart.style.left = Math.random() * 100 + '%';
        heart.style.animationDuration = Math.random() * 3 + 4 + 's';
        heart.style.animationDelay = Math.random() * 3 + 's';
        heart.style.fontSize = Math.random() * 15 + 10 + 'px';
        container.appendChild(heart);
        particles.push(heart);
      }
    };
    
    const createSpooky = () => {
      // Create floating ghosts
      const ghosts = ['👻', '💀', '🎃', '🦇'];
      for (let i = 0; i < 8; i++) {
        const ghost = document.createElement('div');
        ghost.className = 'spooky-ghost';
        ghost.innerHTML = ghosts[Math.floor(Math.random() * ghosts.length)];
        ghost.style.left = Math.random() * 90 + 5 + '%';
        ghost.style.top = Math.random() * 70 + 10 + '%';
        ghost.style.animationDelay = Math.random() * 6 + 's';
        container.appendChild(ghost);
        particles.push(ghost);
      }
      
      // Create fog layer
      const fog = document.createElement('div');
      fog.className = 'spooky-fog';
      container.appendChild(fog);
      particles.push(fog);
    };
    
    const createFireworks = () => {
      const createBurst = () => {
        const x = Math.random() * window.innerWidth;
        const y = Math.random() * (window.innerHeight / 2);
        
        const burst = document.createElement('div');
        burst.className = 'firework-burst';
        burst.style.left = x + 'px';
        burst.style.top = y + 'px';
        
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
        
        // Remove burst after animation
        setTimeout(() => {
          burst.remove();
          const index = particles.indexOf(burst);
          if (index > -1) particles.splice(index, 1);
        }, 1500);
      };
      
      // Create bursts periodically
      const interval = setInterval(createBurst, 1000);
      
      // Store interval cleanup
      return () => clearInterval(interval);
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
export function SpecialEffectOverlay({ event }: { event: Event }) {
  const effectType = detectSpecialEffect(event);
  
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
            fontSize: '24px',
            fontWeight: 'bold',
            color: '#000',
            textShadow: '0 0 10px rgba(0, 0, 0, 0.5)',
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
          animation: 'rainbowGlow 4s ease-in-out infinite',
          zIndex: 2,
        }}
      />
    );
  }
  
  // Monthly color glow
  if (effectType === 'monthly') {
    const eventDate = new Date(event.date);
    const month = eventDate.getMonth();
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
  
  return null;
}

// Badge component to show the special effect type
export function SpecialEffectBadge({ event }: { event: Event }) {
  const effectType = detectSpecialEffect(event);
  
  if (!effectType) return null;
  
  const badges: { [key in EffectType]?: { icon: string; label: string; color: string } } = {
    snowflakes: { icon: '❄️', label: 'Christmas Special', color: 'rgba(135, 206, 235, 0.9)' },
    confetti: { icon: '🎉', label: 'Party Time', color: 'rgba(255, 105, 180, 0.9)' },
    fireworks: { icon: '🎆', label: "New Year's Eve", color: 'rgba(138, 43, 226, 0.9)' },
    hearts: { icon: '❤️', label: "Valentine's Day", color: 'rgba(255, 20, 147, 0.9)' },
    spooky: { icon: '👻', label: 'Halloween', color: 'rgba(64, 0, 128, 0.9)' },
    pride: { icon: '🏳️‍🌈', label: 'Pride', color: 'linear-gradient(90deg, red, orange, yellow, green, blue, purple)' },
    nice: { icon: '😏', label: 'Nice Day', color: 'rgba(0, 0, 0, 0.8)' },
    monthly: { 
      icon: '🎨', 
      label: MONTHLY_COLORS[new Date(event.date).getMonth()].name, 
      color: MONTHLY_COLORS[new Date(event.date).getMonth()].color1 + 'DD'
    }
  };
  
  const badge = badges[effectType];
  
  if (!badge) return null;
  
  return (
    <div 
      className="position-absolute"
      style={{
        top: '10px',
        left: '10px',
        zIndex: 10,
        padding: '4px 8px',
        borderRadius: '4px',
        background: badge.color,
        color: effectType === 'nice' ? '#fff' : effectType === 'pride' ? '#fff' : '#fff',
        fontSize: '12px',
        fontWeight: 'bold',
        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)',
      }}
    >
      {badge.icon} {badge.label}
    </div>
  );
}