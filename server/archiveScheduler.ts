import { storage } from "./storage";

let archiveInterval: NodeJS.Timeout | null = null;

export async function scheduleEventArchiving(): Promise<void> {
  // Run archiving on startup
  await storage.performScheduledArchiving();
  
  // Schedule to run every 24 hours at 3 AM (or just every 24 hours for simplicity)
  archiveInterval = setInterval(async () => {
    await storage.performScheduledArchiving();
  }, 24 * 60 * 60 * 1000); // 24 hours
  
  console.log('[ARCHIVE] Event archiving scheduler initialized - runs daily');
}

export function stopArchiveScheduler(): void {
  if (archiveInterval) {
    clearInterval(archiveInterval);
    archiveInterval = null;
    console.log('[ARCHIVE] Event archiving scheduler stopped');
  }
}