import { useEffect, useRef } from "react";
import { Event } from "@shared/schema";

interface SpecialEffectConfig {
  type: 'snowflakes' | 'confetti' | 'fireworks';
  condition: (event: Event) => boolean;
}

// Define special effect conditions
const SPECIAL_EFFECTS: SpecialEffectConfig[] = [
  {
    type: 'snowflakes',
    condition: (event) => {
      const eventDate = new Date(event.date);
      return eventDate.getMonth() === 11 && eventDate.getDate() === 25; // December 25
    }
  },
  {
    type: 'confetti',
    condition: (event) => {
      return event.name.toLowerCase().includes('party');
    }
  },
  {
    type: 'fireworks',
    condition: (event) => {
      const eventDate = new Date(event.date);
      return eventDate.getMonth() === 11 && eventDate.getDate() === 31; // December 31 (New Year's Eve)
    }
  }
];

export function detectSpecialEffect(event: Event): 'snowflakes' | 'confetti' | 'fireworks' | null {
  for (const effect of SPECIAL_EFFECTS) {
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
    if (!effectType) return;
    
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
      case 'fireworks':
        cleanup = createFireworks();
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

// Badge component to show the special effect type
export function SpecialEffectBadge({ event }: { event: Event }) {
  const effectType = detectSpecialEffect(event);
  
  if (!effectType) return null;
  
  const badges = {
    snowflakes: { icon: '❄️', label: 'Christmas Special', color: 'rgba(135, 206, 235, 0.9)' },
    confetti: { icon: '🎉', label: 'Party Time', color: 'rgba(255, 105, 180, 0.9)' },
    fireworks: { icon: '🎆', label: "New Year's Eve", color: 'rgba(138, 43, 226, 0.9)' }
  };
  
  const badge = badges[effectType];
  
  return (
    <div 
      className="position-absolute"
      style={{
        top: '10px',
        left: '10px',
        zIndex: 10,
        padding: '4px 8px',
        borderRadius: '4px',
        backgroundColor: badge.color,
        color: '#fff',
        fontSize: '12px',
        fontWeight: 'bold',
        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)',
      }}
    >
      {badge.icon} {badge.label}
    </div>
  );
}