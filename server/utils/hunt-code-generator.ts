/**
 * Server-side hunt code generator with leetspeak variations
 * Generates unique codes for treasure hunt events
 */

// Apply leetspeak transformations to a string
function applyLeetspeak(text: string): string {
  const leetMap: { [key: string]: string } = {
    'a': '4',
    'A': '4',
    'e': '3',
    'E': '3',
    'i': '1',
    'I': '1',
    'o': '0',
    'O': '0',
    's': '5',
    'S': '5',
    't': '7',
    'T': '7',
    'l': '1',
    'L': '1',
    'g': '9',
    'G': '9',
  };

  // Apply transformations with 40% probability per character, but skip the first character to keep codes readable
  return text.split('').map((char, index) => {
    // Skip first character to keep it readable
    if (index === 0) {
      return char;
    }
    if (leetMap[char] && Math.random() < 0.4) {
      return leetMap[char];
    }
    return char;
  }).join('');
}

// Generate Hunt code with leetspeak variations
export function generateHuntCodeWithLeetspeak(): string {
  const colors = [
    "Red",
    "Blue",
    "Green",
    "Purple",
    "Orange",
    "Yellow",
    "Pink",
    "Silver",
    "Golden",
    "Black",
    "White",
    "Emerald",
    "Ruby",
    "Sapphire",
    "Diamond",
  ];
  
  const nouns = [
    // Original animals
    "Tiger", "Dragon", "Eagle", "Wolf", "Bear", "Lion", "Falcon", 
    "Phoenix", "Raven", "Shark", "Panther", "Cobra", "Hawk", "Lynx", "Jaguar",
    // More animals & creatures
    "Stallion", "Viper", "Orca", "Kraken", "Griffin", "Mantis", "Rhino",
    "Turtle", "Scorpion", "Leopard", "Cheetah", "Raptor", "Python",
    "Dolphin", "Octopus", "Spider", "Hornet", "Mongoose", "Puma", "Cougar",
    // Mythical beings
    "Titan", "Golem", "Hydra", "Siren", "Cyclops", "Sphinx", "Wizard",
    "Valkyrie", "Minotaur", "Centaur", "Pegasus", "Unicorn", "Banshee",
    "Wraith", "Demon", "Angel", "Oracle", "Mystic", "Warlock", "Shaman",
    // Natural phenomena
    "Storm", "Thunder", "Lightning", "Tornado", "Aurora", "Comet",
    "Meteor", "Eclipse", "Tsunami", "Avalanche", "Volcano", "Glacier",
    "Hurricane", "Blizzard", "Monsoon", "Tempest", "Cyclone", "Typhoon",
    // Cool objects & concepts
    "Crystal", "Portal", "Blade", "Crown", "Dagger", "Shield", "Sword",
    "Hammer", "Spear", "Arrow", "Cannon", "Pistol", "Rifle", "Saber",
    "Trident", "Scythe", "Katana", "Kunai", "Shuriken", "Axe", "Mace",
    // Powerful concepts
    "Legend", "Shadow", "Spirit", "Vortex", "Phantom", "Specter",
    "Enigma", "Cipher", "Paradox", "Nexus", "Matrix", "Cosmos",
    "Nebula", "Galaxy", "Pulsar", "Quasar", "Photon", "Neutron",
    "Proton", "Electron", "Atom", "Quantum", "Plasma", "Energy"
  ];
  
  const randomColor = colors[Math.floor(Math.random() * colors.length)];
  const randomNoun = nouns[Math.floor(Math.random() * nouns.length)];
  const baseCode = `${randomColor}${randomNoun}`;
  
  // Apply leetspeak with 50% chance for the entire code
  if (Math.random() < 0.5) {
    return applyLeetspeak(baseCode);
  }
  return baseCode;
}

/**
 * Generate a unique hunt code with collision detection
 * @param storage - Storage instance to check for existing codes
 * @param maxAttempts - Maximum number of attempts to generate a unique code
 * @returns A unique hunt code
 */
export async function generateUniqueHuntCode(storage: any, maxAttempts: number = 100): Promise<string> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const huntCode = generateHuntCodeWithLeetspeak();
    const exists = await storage.huntCodeExists(huntCode);
    
    if (!exists) {
      return huntCode;
    }
  }
  
  // If we couldn't generate a unique code after maxAttempts, add a timestamp suffix
  // This should be extremely rare given the large number of possible combinations
  const fallbackCode = `${generateHuntCodeWithLeetspeak()}_${Date.now()}`;
  return fallbackCode;
}