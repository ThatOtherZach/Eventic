import { db } from "./db";
import { platformHeaders } from "@shared/schema";
import { sql } from "drizzle-orm";

const headerData = [
  { title: "Event Management", subtitle: "Browse events and purchase tickets." },
  { title: "Certified Shenanigans", subtitle: "Your memories digitally certified and approved by the masses." },
  { title: "Eventic", subtitle: "\"Can you validate me?\"" },
  { title: "Evantic", subtitle: "The worlds best ticket management platform, for anything." },
  { title: "The People's Ticket Machine", subtitle: "Make an event, get tickets." },
  { title: "Proof of Experience", subtitle: "Ticket validated by the moment, not a corporation." },
  { title: "DIY Mayhem, Digitally Verified", subtitle: "Throw a party, start a rally, host a séance, we'll handle the logistics :)" },
  { title: "The Chaos Ledger", subtitle: "Meet strangers for validation!" },
  { title: "One App, Infinite Shenanigans", subtitle: "Oh look, your ticket glows!" },
  { title: "There's Always Something To Do", subtitle: "It's organized chaos bby!" },
  { title: "Seamless Event Infrastructure", subtitle: "A platform for hosting, validating, and scaling events of any size." },
  { title: "Crowd-Powered Validation", subtitle: "Peer-to-peer ticketing & validation." },
  { title: "Default Plausible Deniability", subtitle: "We inverted the model!" },
  { title: "Ticketing Without the Toll Booth", subtitle: "The other guys wished thier tickets looked like this." },
  { title: "Validated Vibes", subtitle: "Gone in 69 days." },
  { title: "BTW Your Reputation Decays ;)", subtitle: "Optimized Ephemerality ✨" },
  { title: "The 69-Day Retention Policy", subtitle: "We don't hoard your data." },
  { title: "Pokémon GO for Anything", subtitle: "Buy the Ticket. Take the Ride." },
  { title: "69 Days, Then Deleted", subtitle: "Most events fade. A few survive forever. That's the point." },
  { title: "Your World, Your Quests", subtitle: "Rooftop parties, ramen runs, flash mobs, idk do what you want." },
  { title: "Make Fun Weird Again", subtitle: "Get some group validation!" },
  { title: "Collect or Vaporize", subtitle: "Mint your ticket, or watch it vanish." },
  { title: "Achievement Hunting IRL", subtitle: "Like Chuck E Cheese for adults." },
  { title: "Missions & Side Quests", subtitle: "The world's recurring rituals & chaotic one-offs." },
  { title: "Chaos Mode Enabled", subtitle: "Everyone's a gatekeeper 🤪" },
  { title: "Tickets Are the Fuel", subtitle: "Spend them, boost with them, or burn them like confetti." },
  { title: "PINs, Not PDFs", subtitle: "Four digits. Three minutes. Zero bullsh!t." },
  { title: "Looking for Something To Do?", subtitle: "Join the club!" },
  { title: "Private Events Included", subtitle: "Your ticket is either alive, or it's nothing." },
  { title: "No Likes or Algorithms", subtitle: "Just a ticket that proves you were there." },
  { title: "Your Memories, Your Call", subtitle: "Keep them forever, or let them be deleted." },
  { title: "Designed to be Deleted", subtitle: "Achievement Unlocked: Validation!" },
  { title: "Collect 'Em All (Or Try)", subtitle: "Most vanish. Some survive. That's the game." },
  { title: "Proof-of-Experience", subtitle: "Not clout. Not screenshots. Just presence." },
  { title: "We Make Tickets", subtitle: "Voting tickets, geo locked tickets, tickets with gifs, tickets that glow..." },
  { title: "Peer-to-Peer Validation", subtitle: "Anyone can validate anyone! They told us we were crazy." },
  { title: "69 Days 'Til Oblivion", subtitle: "Every ticket has a death clock." },
  { title: "Here, Then Gone", subtitle: "Events fade away. Legends survive." },
  { title: "The Main Plot", subtitle: "Temporary by Design." },
  { title: "Find Something!", subtitle: "The only platform that forgets." },
  { title: "Entropy Engine", subtitle: "It's like GTA Missions I guess." },
  { title: "Trust the Crowd", subtitle: "Your own Pip-Boy 3000 Mk V!" },
  { title: "Democratically Designed", subtitle: "You could literally live Skyrim." },
  { title: "Just Meet People", subtitle: "Real connections, no waste." },
  { title: "Energy Efficient", subtitle: "Low cycle. No paper. Zero trace." },
  { title: "TPS Support Included!", subtitle: "Easily issue memos with cover letters." },
  { title: "Your Globo-Local Quest Line", subtitle: "Find it, or light the fire 🔥" },
  { title: "Treasure Hunts Enabled", subtitle: "Hide and seek mode, try it!" },
  { title: "Golden Boi!", subtitle: "Go Full Charlie! You can also rig the odds." },
  { title: "Democracy Manifest", subtitle: "Enable Peer-to-peer Validation for voting! Winner goes golden." },
  { title: "Strap in And Feel The G's", subtitle: "Max Power uses Surge Pricing!" },
  { title: "Scalp This!", subtitle: "Geocodes, limit sales and easy verification." },
  { title: "The Experience Index", subtitle: "The MBA's said it couldn't be done!" },
  { title: "Event + Ticket Management", subtitle: "Get it?" },
  { title: "We're Not Your Grandma's Ticket Master", subtitle: "2.69% Fee or $2.69... Forever." },
  { title: "Just 2.69 Percent?!", subtitle: "The bean counters told me I was insane." },
  { title: "Special Effects!", subtitle: "Never tell me the odds." },
  { title: "Digital Collectables?", subtitle: "Totally optional. Always." },
  { title: "NFTs?!", subtitle: "Mint a collectable to save it. Or we delete it." },
  { title: "Welcome", subtitle: "To the world's best ticket machine." },
  { title: "Guest list? Guess not", subtitle: "Verifiable entry or reentry if that's your thing..." },
  { title: "You're on Eventic", subtitle: "It's like a weird mix of everything, but people first." },
  { title: "Humane Technology", subtitle: "Efficient, no paper, mandated data deletion." },
  { title: "Social Social Media", subtitle: "Vote, Rate, Verify Reputation. Ranks Decay." },
  { title: "Check It Out!", subtitle: "Ephemeral Technologia." },
  { title: "Ready Player One", subtitle: "Complete a mission IRL with others!" },
  { title: "Why?", subtitle: "Why not. Give it a'go." },
  { title: "Tune In", subtitle: "Or go back to doom scrollin' idk." },
  { title: "People First Tech", subtitle: "Make a friend, take a tour, find a treasure." }
];

export async function seedPlatformHeaders() {
  try {
    console.log("[SEED] Starting platform headers seeding...");
    
    // Check if headers already exist
    const existingHeaders = await db.select().from(platformHeaders);
    
    if (existingHeaders.length > 0) {
      console.log(`[SEED] Platform headers already exist (${existingHeaders.length} found). Skipping seed.`);
      return;
    }
    
    // Insert all headers with display order
    const insertPromises = headerData.map((header, index) => 
      db.insert(platformHeaders).values({
        title: header.title,
        subtitle: header.subtitle,
        active: true,
        displayOrder: index + 1
      }).returning()
    );
    
    const results = await Promise.all(insertPromises);
    
    console.log(`[SEED] Successfully inserted ${results.length} platform headers`);
    return results;
  } catch (error) {
    console.error("[SEED] Error seeding platform headers:", error);
    throw error;
  }
}

