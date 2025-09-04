import { db } from "./db";
import { events, scheduledJobs } from "@shared/schema";
import { eq, isNull } from "drizzle-orm";
import { calculateDeletionDate, scheduleEventDeletion } from "./jobScheduler";

export async function scheduleJobsForExistingEvents(): Promise<void> {
  try {
    // Get all events that don't have scheduled deletion jobs yet
    const allEvents = await db.select().from(events);
    
    let scheduled = 0;
    let skipped = 0;
    
    for (const event of allEvents) {
      // Check if this event already has a scheduled job
      const existingJobs = await db
        .select()
        .from(scheduledJobs)
        .where(
          eq(scheduledJobs.targetId, event.id)
        )
        .limit(1);
      
      if (existingJobs.length > 0) {
        skipped++;
        continue;
      }
      
      // Calculate when this event should be deleted (69 days after end/start date)
      const deletionDate = calculateDeletionDate(event.date, event.endDate);
      
      // Schedule the deletion
      await scheduleEventDeletion(event.id, deletionDate);
      scheduled++;
    }
    
    console.log(`[MIGRATION] Scheduled deletion jobs for ${scheduled} existing events (${skipped} already had jobs)`);
  } catch (error) {
    console.error('[MIGRATION] Failed to schedule jobs for existing events:', error);
  }
}

// Run the migration if this file is executed directly
if (require.main === module) {
  scheduleJobsForExistingEvents()
    .then(() => {
      console.log('[MIGRATION] Migration completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('[MIGRATION] Migration failed:', error);
      process.exit(1);
    });
}