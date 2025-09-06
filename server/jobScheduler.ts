import { db } from "./db";
import { scheduledJobs, InsertScheduledJob, events } from "@shared/schema";
import { and, eq, lte, or } from "drizzle-orm";
import { storage } from "./storage";
import { migrateExistingTickets } from "./migrateExistingTickets";

let jobInterval: NodeJS.Timeout | null = null;

export async function scheduleEventDeletion(eventId: string, deleteAt: Date): Promise<void> {
  try {
    const jobData: InsertScheduledJob = {
      jobType: 'archive_event',
      targetId: eventId,
      scheduledFor: deleteAt,
      status: 'pending',
      errorMessage: null,
    };
    
    await db.insert(scheduledJobs).values(jobData);
    console.log(`[JOBS] Scheduled archiving for event ${eventId} at ${deleteAt.toISOString()}`);
  } catch (error) {
    console.error('[JOBS] Failed to schedule event deletion:', error);
  }
}

export async function updateEventDeletionSchedule(eventId: string, newDeleteAt: Date): Promise<void> {
  try {
    // Find existing pending job for this event
    const existingJob = await db
      .select()
      .from(scheduledJobs)
      .where(
        and(
          eq(scheduledJobs.targetId, eventId),
          eq(scheduledJobs.jobType, 'archive_event'),
          eq(scheduledJobs.status, 'pending')
        )
      )
      .limit(1);
    
    if (existingJob.length > 0) {
      // Update existing job's scheduled time
      await db
        .update(scheduledJobs)
        .set({ scheduledFor: newDeleteAt })
        .where(eq(scheduledJobs.id, existingJob[0].id));
      
      console.log(`[JOBS] Updated archiving schedule for event ${eventId} to ${newDeleteAt.toISOString()}`);
    } else {
      // No existing job, create a new one
      await scheduleEventDeletion(eventId, newDeleteAt);
    }
  } catch (error) {
    console.error('[JOBS] Failed to update event deletion schedule:', error);
  }
}

export async function cancelEventDeletion(eventId: string): Promise<void> {
  try {
    await db
      .update(scheduledJobs)
      .set({ status: 'cancelled' })
      .where(
        and(
          eq(scheduledJobs.targetId, eventId),
          eq(scheduledJobs.jobType, 'archive_event'),
          eq(scheduledJobs.status, 'pending')
        )
      );
    
    console.log(`[JOBS] Cancelled archiving for event ${eventId}`);
  } catch (error) {
    console.error('[JOBS] Failed to cancel event deletion:', error);
  }
}

async function processScheduledJobs(): Promise<void> {
  try {
    const now = new Date();
    
    // Get all pending jobs that should be executed now
    const jobsToProcess = await db
      .select()
      .from(scheduledJobs)
      .where(
        and(
          eq(scheduledJobs.status, 'pending'),
          lte(scheduledJobs.scheduledFor, now)
        )
      );
    
    for (const job of jobsToProcess) {
      await processJob(job);
    }
    
    // Also retry failed jobs (max 3 attempts)
    const failedJobs = await db
      .select()
      .from(scheduledJobs)
      .where(
        and(
          eq(scheduledJobs.status, 'failed'),
          or(
            eq(scheduledJobs.attempts, 0),
            eq(scheduledJobs.attempts, 1),
            eq(scheduledJobs.attempts, 2)
          )
        )
      );
    
    for (const job of failedJobs) {
      // Wait at least 1 hour between retry attempts
      if (job.lastAttemptAt) {
        const hoursSinceLastAttempt = (now.getTime() - job.lastAttemptAt.getTime()) / (1000 * 60 * 60);
        if (hoursSinceLastAttempt < 1) {
          continue;
        }
      }
      await processJob(job);
    }
  } catch (error) {
    console.error('[JOBS] Error processing scheduled jobs:', error);
  }
}

async function processJob(job: typeof scheduledJobs.$inferSelect): Promise<void> {
  try {
    // Mark job as processing
    await db
      .update(scheduledJobs)
      .set({ 
        status: 'processing',
        lastAttemptAt: new Date(),
        attempts: (job.attempts || 0) + 1
      })
      .where(eq(scheduledJobs.id, job.id));
    
    // Process based on job type
    if (job.jobType === 'archive_event') {
      // Archive the event
      const success = await storage.archiveEvent(job.targetId);
      
      if (success) {
        // Mark job as completed
        await db
          .update(scheduledJobs)
          .set({ 
            status: 'completed',
            completedAt: new Date()
          })
          .where(eq(scheduledJobs.id, job.id));
        
        console.log(`[JOBS] Successfully archived event ${job.targetId}`);
      } else {
        throw new Error('Failed to archive event');
      }
    }
  } catch (error) {
    // Mark job as failed
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    await db
      .update(scheduledJobs)
      .set({ 
        status: 'failed',
        errorMessage
      })
      .where(eq(scheduledJobs.id, job.id));
    
    console.error(`[JOBS] Failed to process job ${job.id}:`, error);
  }
}

export async function initializeJobScheduler(): Promise<void> {
  // Schedule jobs for any existing events that don't have them yet
  await scheduleJobsForExistingEvents();
  
  // Migrate existing tickets to have deletion dates
  await migrateExistingTickets();
  
  // Process jobs immediately on startup
  await processScheduledJobs();
  
  // Then process every 5 minutes
  jobInterval = setInterval(async () => {
    await processScheduledJobs();
  }, 5 * 60 * 1000); // 5 minutes
  
  console.log('[JOBS] Job scheduler initialized - processing every 5 minutes');
}

async function scheduleJobsForExistingEvents(): Promise<void> {
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
          and(
            eq(scheduledJobs.targetId, event.id),
            eq(scheduledJobs.jobType, 'archive_event'),
            eq(scheduledJobs.status, 'pending')
          )
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
    
    if (scheduled > 0) {
      console.log(`[JOBS] Scheduled deletion jobs for ${scheduled} existing events (${skipped} already had jobs)`);
    }
  } catch (error) {
    console.error('[JOBS] Failed to schedule jobs for existing events:', error);
  }
}

export function stopJobScheduler(): void {
  if (jobInterval) {
    clearInterval(jobInterval);
    jobInterval = null;
    console.log('[JOBS] Job scheduler stopped');
  }
}

// Helper to calculate deletion date (69 days from event end or start date)
export function calculateDeletionDate(eventDate: string, eventEndDate: string | null): Date {
  const baseDate = eventEndDate || eventDate;
  const deletionDate = new Date(baseDate);
  deletionDate.setDate(deletionDate.getDate() + 69);
  return deletionDate;
}