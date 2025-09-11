import { db } from "./db";
import { events, scheduledJobs } from "@shared/schema";
import { eq, isNull } from "drizzle-orm";
import { calculateDeletionDate, scheduleEventDeletion } from "./jobScheduler";
import { fromZonedTime } from 'date-fns-tz';

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

// Helper function to convert event time to UTC timestamp
function convertEventTimeToUtc(dateStr: string, timeStr: string, timezone: string): Date {
  // Create datetime string in the event's timezone
  const dateTimeStr = `${dateStr} ${timeStr}:00`;
  
  // Convert from the event's timezone to UTC
  // fromZonedTime treats the input as being in the specified timezone
  // and returns the equivalent UTC date
  return fromZonedTime(dateTimeStr, timezone);
}

export async function populateUtcTimestamps(): Promise<void> {
  try {
    // Get all events that don't have UTC timestamps yet
    const allEvents = await db.select().from(events).where(isNull(events.startAtUtc));
    
    let updated = 0;
    let skipped = 0;
    
    for (const event of allEvents) {
      // Skip rolling timezone events - they don't use UTC timestamps
      if (event.rollingTimezone) {
        skipped++;
        continue;
      }
      
      const timezone = event.timezone || 'America/New_York';
      
      // Convert start time to UTC
      const startAtUtc = convertEventTimeToUtc(event.date, event.time, timezone);
      
      // Convert end time to UTC if present
      let endAtUtc = null;
      if (event.endDate && event.endTime) {
        endAtUtc = convertEventTimeToUtc(event.endDate, event.endTime, timezone);
      }
      
      // Update the event with UTC timestamps
      await db.update(events)
        .set({ startAtUtc, endAtUtc })
        .where(eq(events.id, event.id));
      
      updated++;
    }
    
    console.log(`[MIGRATION] Populated UTC timestamps for ${updated} events (${skipped} rolling timezone events skipped)`);
  } catch (error) {
    console.error('[MIGRATION] Failed to populate UTC timestamps:', error);
  }
}

// This file is now imported by server/index.ts and its functions are called during startup
// Remove the standalone execution code that was causing ES module errors