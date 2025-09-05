// Migration script to convert existing HTML descriptions to plain text
import { db } from "./db";
import { events, registryRecords } from "@shared/schema";
import { htmlToPlainText } from "./text-formatter";
import { eq, isNotNull } from "drizzle-orm";

export async function migrateDescriptionsToPlainText() {
  try {
    console.log("[MIGRATION] Starting description conversion from HTML to plain text...");
    
    // Convert active events descriptions
    const activeEvents = await db.select().from(events).where(isNotNull(events.description));
    let convertedCount = 0;
    
    for (const event of activeEvents) {
      if (event.description && event.description.includes('<')) {
        // Only convert if it contains HTML tags
        const plainText = htmlToPlainText(event.description);
        
        if (plainText !== event.description) {
          await db.update(events)
            .set({ description: plainText })
            .where(eq(events.id, event.id));
          convertedCount++;
        }
      }
    }
    
    console.log(`[MIGRATION] Converted ${convertedCount} active event descriptions`);
    
    // Convert registry records descriptions
    const registry = await db.select().from(registryRecords).where(isNotNull(registryRecords.description));
    let registryConvertedCount = 0;
    
    for (const record of registry) {
      if (record.description && record.description.includes('<')) {
        const plainText = htmlToPlainText(record.description);
        
        if (plainText !== record.description) {
          await db.update(registryRecords)
            .set({ description: plainText })
            .where(eq(registryRecords.id, record.id));
          registryConvertedCount++;
        }
      }
    }
    
    console.log(`[MIGRATION] Converted ${registryConvertedCount} registry record descriptions`);
    console.log("[MIGRATION] Description conversion completed successfully");
    
    return {
      events: convertedCount,
      registry: registryConvertedCount
    };
  } catch (error) {
    console.error("[MIGRATION] Error converting descriptions:", error);
    throw error;
  }
}