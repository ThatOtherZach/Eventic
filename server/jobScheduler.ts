import { db } from "./db";
import { scheduledJobs, InsertScheduledJob, events, registryRecords } from "@shared/schema";
import { and, eq, lte, or, lt, isNull } from "drizzle-orm";
import { storage } from "./storage";
import { migrateExistingTickets } from "./migrateExistingTickets";
import { ImageCompressionService } from "./services/image-compression";
import cron from 'node-cron';
import { logger } from './logger';
import { archiveOldEvents } from './routes'; // We'll add this import when we implement it
import { nftStatusChecker } from './services/nft-status-checker';
import { blockchainMonitor } from './services/blockchain-monitor';

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

    // Process NFT compression for inactive records (runs daily)
    await compressInactiveNFTs();

    // Clean up users who never signed in (runs monthly on the 1st)
    await cleanupInactiveUsers();
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
      // Check if event still exists before archiving
      const event = await storage.getEvent(job.targetId);
      if (!event) {
        // Event already deleted, mark job as completed
        await db
          .update(scheduledJobs)
          .set({ 
            status: 'completed',
            completedAt: new Date(),
            errorMessage: 'Event already deleted'
          })
          .where(eq(scheduledJobs.id, job.id));

        console.log(`[JOBS] Event ${job.targetId} already deleted, marking job as completed`);
        return;
      }

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
        throw new Error(`Failed to archive event ${job.targetId} - check logs for details`);
      }
    } else if (job.jobType === 'delete_user') {
      // Check if user still exists and is still scheduled for deletion
      const user = await storage.getUser(job.targetId);
      if (!user) {
        // User already deleted, mark job as completed
        await db
          .update(scheduledJobs)
          .set({ 
            status: 'completed',
            completedAt: new Date(),
            errorMessage: 'User already deleted'
          })
          .where(eq(scheduledJobs.id, job.id));

        console.log(`[JOBS] User ${job.targetId} already deleted, marking job as completed`);
        return;
      }

      const isScheduled = await storage.isUserScheduledForDeletion(job.targetId);
      if (!isScheduled) {
        // User cancelled deletion, mark job as completed
        await db
          .update(scheduledJobs)
          .set({ 
            status: 'completed',
            completedAt: new Date(),
            errorMessage: 'User cancelled deletion'
          })
          .where(eq(scheduledJobs.id, job.id));

        console.log(`[JOBS] User ${job.targetId} cancelled deletion, marking job as completed`);
        return;
      }

      // Delete the user account
      const success = await storage.deleteUserAccount(job.targetId);

      if (success) {
        // Mark job as completed
        await db
          .update(scheduledJobs)
          .set({ 
            status: 'completed',
            completedAt: new Date()
          })
          .where(eq(scheduledJobs.id, job.id));

        console.log(`[JOBS] Successfully deleted user account ${job.targetId}`);
      } else {
        throw new Error(`Failed to delete user account ${job.targetId} - check logs for details`);
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

  // Then process every hour
  jobInterval = setInterval(async () => {
    await processScheduledJobs();
  }, 60 * 60 * 1000); // 1 hour

  logger.info('[JOBS] Job scheduler initialized - processing every hour');

  // Archive old events every hour at minute 0
  cron.schedule('0 * * * *', async () => {
    try {
      logger.info('[JOBS] Starting scheduled event archival...');
      await archiveOldEvents();
      logger.info('[JOBS] Scheduled event archival completed');
    } catch (error) {
      logger.error('[JOBS] Scheduled event archival failed:', error);
    }
  });

  // Check NFT transaction status every 5 minutes
  cron.schedule('*/5 * * * *', async () => {
    try {
      await nftStatusChecker.checkPendingTransactions();
    } catch (error) {
      logger.error('[JOBS] NFT status check failed:', error);
    }
  });

  // Start blockchain event monitoring
  if (process.env.NFT_CONTRACT_ADDRESS && process.env.BASE_RPC_URL) {
    blockchainMonitor.startMonitoring().catch(error => {
      logger.error('[JOBS] Failed to start blockchain monitoring:', error);
    });
  }
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

// Compress NFT registry records that haven't been accessed in 3+ years
async function cleanupInactiveUsers(): Promise<void> {
  try {
    const now = new Date();

    // Only run on the first day of each month
    if (now.getDate() !== 1) {
      return;
    }

    // Check if we've already run this month (to avoid duplicate runs)
    const lastRunKey = `last_inactive_user_cleanup_${now.getFullYear()}_${now.getMonth()}`;
    const lastRun = await storage.getSystemSetting(lastRunKey);
    if (lastRun) {
      return; // Already ran this month
    }

    // Delete users who never signed in after 30 days
    const deletedCount = await storage.deleteUsersWhoNeverSignedIn(30);

    if (deletedCount > 0) {
      console.log(`[CLEANUP] Deleted ${deletedCount} users who never signed in after 30 days`);
    }

    // Mark that we've run this month
    await storage.setSystemSetting(lastRunKey, 'true');

  } catch (error) {
    console.error('[CLEANUP] Error cleaning up inactive users:', error);
  }
}

async function compressInactiveNFTs(): Promise<void> {
  try {
    const now = new Date();
    const threeYearsAgo = new Date();
    threeYearsAgo.setFullYear(threeYearsAgo.getFullYear() - 3);

    // Only run on the first day of each month
    if (now.getDate() !== 1) {
      return;
    }

    // Find uncompressed NFTs that haven't been accessed in 3+ years
    const nftsToCompress = await db
      .select()
      .from(registryRecords)
      .where(
        and(
          eq(registryRecords.isCompressed, false),
          lt(registryRecords.lastAccessed, threeYearsAgo)
        )
      )
      .limit(10); // Process 10 at a time to avoid overwhelming the system

    if (nftsToCompress.length === 0) {
      return; // Nothing to compress
    }

    console.log(`[COMPRESSION] Found ${nftsToCompress.length} NFTs to compress`);

    for (const nft of nftsToCompress) {
      try {
        // Compress the images
        const compressedData = await ImageCompressionService.compressRegistryRecord(nft);

        // Calculate size reduction
        const originalSize = 
          (nft.eventImageData?.length || 0) +
          (nft.eventStickerData?.length || 0) +
          (nft.ticketBackgroundData?.length || 0) +
          (nft.ticketGifData?.length || 0);

        const compressedSize = 
          (compressedData.eventImageData?.length || 0) +
          (compressedData.eventStickerData?.length || 0) +
          (compressedData.ticketBackgroundData?.length || 0) +
          (compressedData.ticketGifData?.length || 0);

        const reductionPercent = Math.round((1 - compressedSize / originalSize) * 100);

        // Update the database with compressed data
        await db
          .update(registryRecords)
          .set({
            eventImageData: compressedData.eventImageData,
            eventStickerData: compressedData.eventStickerData,
            ticketBackgroundData: compressedData.ticketBackgroundData,
            ticketGifData: compressedData.ticketGifData,
            isCompressed: true,
            compressionDate: now
          })
          .where(eq(registryRecords.id, nft.id));

        console.log(`[COMPRESSION] Compressed NFT ${nft.id} - reduced by ${reductionPercent}% (${originalSize} → ${compressedSize} bytes)`);
      } catch (error) {
        console.error(`[COMPRESSION] Failed to compress NFT ${nft.id}:`, error);
      }
    }
  } catch (error) {
    console.error('[COMPRESSION] Error processing NFT compression:', error);
  }
}