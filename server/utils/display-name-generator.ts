const verbs = [
  "Jump", "Dance", "Code", "Build", "Create", "Design", "Launch", "Spark", "Boost", "Chase",
  "Dream", "Forge", "Craft", "Paint", "Write", "Sing", "Play", "Rock", "Flow", "Glow",
  "Hack", "Brew", "Cook", "Mix", "Spin", "Flip", "Surf", "Dive", "Float", "Soar",
  "Sprint", "Climb", "Explore", "Discover", "Invent", "Compose", "Direct", "Film", "Sketch", "Sculpt"
];

const nouns = [
  "Tiger", "Eagle", "Phoenix", "Dragon", "Wolf", "Fox", "Bear", "Lion", "Hawk", "Falcon",
  "Ninja", "Wizard", "Knight", "Pirate", "Robot", "Alien", "Ghost", "Zombie", "Vampire", "Hero",
  "Coffee", "Pizza", "Taco", "Cookie", "Donut", "Bacon", "Cheese", "Candy", "Chocolate", "Burger",
  "Guitar", "Piano", "Drums", "Violin", "Trumpet", "Sax", "Bass", "Synth", "Mic", "Amp",
  "Rocket", "Comet", "Star", "Moon", "Planet", "Galaxy", "Nebula", "Aurora", "Eclipse", "Meteor"
];

// Leetspeak mapping for occasional character substitution
const leetMap: { [key: string]: string } = {
  'a': '4',
  'e': '3',
  'i': '1',
  'o': '0',
  's': '5',
  't': '7',
  'g': '9',
  'l': '1',
  'z': '2'
};

function applyLeetspeak(word: string, probability: number = 0.3): string {
  let result = word;
  
  // Only apply leetspeak with given probability
  if (Math.random() > probability) {
    return result;
  }
  
  // Randomly choose 1-2 characters to convert to leetspeak
  const chars = word.toLowerCase().split('');
  const convertibleIndices: number[] = [];
  
  chars.forEach((char, index) => {
    if (leetMap[char]) {
      convertibleIndices.push(index);
    }
  });
  
  if (convertibleIndices.length > 0) {
    // Convert 1-2 random characters
    const numToConvert = Math.min(Math.random() < 0.7 ? 1 : 2, convertibleIndices.length);
    const indicesToConvert = convertibleIndices
      .sort(() => Math.random() - 0.5)
      .slice(0, numToConvert);
    
    const resultChars = word.split('');
    indicesToConvert.forEach(index => {
      const char = resultChars[index].toLowerCase();
      if (leetMap[char]) {
        // Preserve original case for first letter
        if (index === 0) {
          resultChars[index] = leetMap[char];
        } else {
          resultChars[index] = leetMap[char];
        }
      }
    });
    
    result = resultChars.join('');
  }
  
  return result;
}

export function generateDisplayName(signupDate?: Date): string {
  const date = signupDate || new Date();
  
  // Get random verb and noun
  const verb = verbs[Math.floor(Math.random() * verbs.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  
  // Get MM and YY
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear().toString().slice(-2);
  
  // Apply leetspeak with 30% probability to each word
  const finalVerb = applyLeetspeak(verb, 0.3);
  const finalNoun = applyLeetspeak(noun, 0.3);
  
  // Combine: VerbNounMMYY
  return `${finalVerb}${finalNoun}${month}${year}`;
}

// Function to ensure uniqueness by adding a suffix if needed
export function generateUniqueDisplayName(existingNames: string[], signupDate?: Date): string {
  let displayName = generateDisplayName(signupDate);
  let suffix = 1;
  
  // If name exists, add numeric suffix
  while (existingNames.includes(displayName)) {
    displayName = generateDisplayName(signupDate);
    if (suffix > 10) {
      // After 10 attempts, just append a number
      displayName = `${displayName}${suffix}`;
      break;
    }
    suffix++;
  }
  
  return displayName;
}