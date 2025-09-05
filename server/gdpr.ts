import { db } from "./db";
import { 
  users, 
  events, 
  tickets, 
  eventRatings,
  notificationPreferences,
  notifications,
  resellTransactions,
  dataExportRequests,
  accountDeletionRequests,
  userBalances,
  userTransactions
} from "@shared/schema";
import { eq, and, or, sql } from "drizzle-orm";
import { storage } from "./storage";
import { logInfo, logWarning } from "./logger";
import * as crypto from "crypto";
import { decryptPII } from "./utils/encryption";

// Generate a secure token for verification
export function generateVerificationToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

// Export all user data for GDPR compliance
export async function exportUserData(userId: string): Promise<any> {
  try {
    // Get user profile
    const user = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    
    // Get all user's events
    const userEvents = await db.select().from(events).where(eq(events.userId, userId));
    
    // Get all user's tickets
    const userTickets = await db.select().from(tickets).where(eq(tickets.userId, userId));
    
    // Get user's ratings
    const userRatings = await db.select().from(eventRatings).where(eq(eventRatings.userId, userId));
    
    // Get notification preferences
    const notifPrefs = await db.select().from(notificationPreferences).where(eq(notificationPreferences.userId, userId));
    
    // Get notifications
    const userNotifications = await db.select().from(notifications).where(eq(notifications.userId, userId));
    
    // Get resell transactions
    const resellTx = await db.select().from(resellTransactions)
      .where(or(
        eq(resellTransactions.originalOwnerId, userId),
        eq(resellTransactions.newOwnerId, userId)
      ));
    
    // Get balance and transaction history
    const balance = await db.select().from(userBalances).where(eq(userBalances.userId, userId));
    const transactions = await db.select().from(userTransactions).where(eq(userTransactions.userId, userId));
    
    // Compile all data
    const userData = {
      profile: user[0] || null,
      events: userEvents,
      tickets: userTickets,
      ratings: userRatings,
      notificationPreferences: notifPrefs[0] || null,
      notifications: userNotifications,
      resellTransactions: resellTx,
      balance: balance[0] || null,
      transactionHistory: transactions,
      exportedAt: new Date().toISOString()
    };
    
    // Log the export
    await logInfo(
      "User data exported for GDPR request",
      "GDPR Export",
      {
        userId,
        metadata: {
          recordCounts: {
            events: userEvents.length,
            tickets: userTickets.length,
            ratings: userRatings.length,
            notifications: userNotifications.length,
            transactions: transactions.length
          }
        }
      }
    );
    
    return userData;
  } catch (error) {
    await logWarning(
      "Failed to export user data",
      "GDPR Export",
      {
        userId,
        metadata: { error: String(error) }
      }
    );
    throw error;
  }
}

// Check if user can delete their account
export async function canDeleteAccount(userId: string): Promise<{ canDelete: boolean; reason?: string }> {
  try {
    // Check for active events (events that haven't ended yet)
    const now = new Date();
    const activeEvents = await db
      .select()
      .from(events)
      .where(
        and(
          eq(events.userId, userId),
          sql`(${events.endDate} IS NULL AND ${events.date} >= ${now.toISOString().split('T')[0]}) 
               OR (${events.endDate} IS NOT NULL AND ${events.endDate} >= ${now.toISOString().split('T')[0]})`
        )
      );
    
    if (activeEvents.length > 0) {
      return {
        canDelete: false,
        reason: `You have ${activeEvents.length} active event(s). Please wait until all your events have ended or delete them manually.`
      };
    }
    
    // Check for tickets to future events
    const futureTickets = await db
      .select({
        ticket: tickets,
        event: events
      })
      .from(tickets)
      .innerJoin(events, eq(tickets.eventId, events.id))
      .where(
        and(
          eq(tickets.userId, userId),
          sql`(${events.endDate} IS NULL AND ${events.date} >= ${now.toISOString().split('T')[0]}) 
               OR (${events.endDate} IS NOT NULL AND ${events.endDate} >= ${now.toISOString().split('T')[0]})`
        )
      );
    
    if (futureTickets.length > 0) {
      return {
        canDelete: false,
        reason: `You have ${futureTickets.length} ticket(s) to future events. Please wait until these events have passed.`
      };
    }
    
    // Check for pending resell transactions
    const pendingResells = await storage.getUserResellQueue(userId);
    if (pendingResells.length > 0) {
      return {
        canDelete: false,
        reason: `You have ${pendingResells.length} ticket(s) in the resell queue. Please cancel these listings first.`
      };
    }
    
    return { canDelete: true };
  } catch (error) {
    await logWarning(
      "Error checking account deletion eligibility",
      "GDPR Deletion",
      {
        userId,
        metadata: { error: String(error) }
      }
    );
    throw error;
  }
}

// Request account deletion
export async function requestAccountDeletion(userId: string, reason?: string): Promise<string> {
  try {
    // Check if user can delete account
    const eligibility = await canDeleteAccount(userId);
    if (!eligibility.canDelete) {
      throw new Error(eligibility.reason);
    }
    
    // Generate verification token
    const verificationToken = generateVerificationToken();
    const verificationExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    
    // Create deletion request
    await db.insert(accountDeletionRequests).values({
      userId,
      reason,
      verificationToken,
      verificationExpiresAt,
      scheduledDeletionDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
    });
    
    await logInfo(
      "Account deletion requested",
      "GDPR Deletion",
      {
        userId,
        metadata: { reason }
      }
    );
    
    return verificationToken;
  } catch (error) {
    await logWarning(
      "Failed to request account deletion",
      "GDPR Deletion",
      {
        userId,
        metadata: { error: String(error) }
      }
    );
    throw error;
  }
}

// Verify and execute account deletion
export async function executeAccountDeletion(userId: string, verificationToken: string): Promise<void> {
  try {
    // Verify deletion request
    const request = await db
      .select()
      .from(accountDeletionRequests)
      .where(
        and(
          eq(accountDeletionRequests.userId, userId),
          eq(accountDeletionRequests.verificationToken, verificationToken),
          eq(accountDeletionRequests.status, 'pending')
        )
      )
      .limit(1);
    
    if (!request[0]) {
      throw new Error("Invalid or expired deletion request");
    }
    
    if (new Date() > request[0].verificationExpiresAt!) {
      throw new Error("Verification token has expired");
    }
    
    // Final check
    const eligibility = await canDeleteAccount(userId);
    if (!eligibility.canDelete) {
      // Update request as rejected
      await db
        .update(accountDeletionRequests)
        .set({
          status: 'rejected',
          rejectionReason: eligibility.reason
        })
        .where(eq(accountDeletionRequests.id, request[0].id));
      
      throw new Error(eligibility.reason);
    }
    
    // Begin deletion process
    await db.transaction(async (tx) => {
      // Delete user's past events
      await tx.delete(events).where(eq(events.userId, userId));
      
      // Delete user's tickets
      await tx.delete(tickets).where(eq(tickets.userId, userId));
      
      // Delete ratings
      await tx.delete(eventRatings).where(eq(eventRatings.userId, userId));
      
      // Delete notifications
      await tx.delete(notifications).where(eq(notifications.userId, userId));
      await tx.delete(notificationPreferences).where(eq(notificationPreferences.userId, userId));
      
      // Delete transactions
      await tx.delete(userTransactions).where(eq(userTransactions.userId, userId));
      await tx.delete(userBalances).where(eq(userBalances.userId, userId));
      
      // Finally, delete the user
      await tx.delete(users).where(eq(users.id, userId));
      
      // Mark deletion as completed
      await tx
        .update(accountDeletionRequests)
        .set({
          status: 'completed',
          completedAt: new Date()
        })
        .where(eq(accountDeletionRequests.id, request[0].id));
    });
    
    await logInfo(
      "Account successfully deleted",
      "GDPR Deletion",
      {
        userId,
        metadata: { deletionRequestId: request[0].id }
      }
    );
  } catch (error) {
    await logWarning(
      "Failed to execute account deletion",
      "GDPR Deletion",
      {
        userId,
        metadata: { error: String(error) }
      }
    );
    throw error;
  }
}

// Create data export request
export async function createDataExportRequest(userId: string): Promise<string> {
  try {
    const request = await db.insert(dataExportRequests).values({
      userId,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
    }).returning();
    
    return request[0].id;
  } catch (error) {
    throw error;
  }
}

// Process data export request
export async function processDataExportRequest(requestId: string): Promise<string> {
  try {
    const request = await db
      .select()
      .from(dataExportRequests)
      .where(eq(dataExportRequests.id, requestId))
      .limit(1);
    
    if (!request[0] || request[0].status !== 'pending') {
      throw new Error("Invalid or already processed request");
    }
    
    // Update status to processing
    await db
      .update(dataExportRequests)
      .set({ status: 'processing' })
      .where(eq(dataExportRequests.id, requestId));
    
    // Export data
    const data = await exportUserData(request[0].userId);
    
    // Convert to JSON string
    const jsonData = JSON.stringify(data, null, 2);
    
    // Create a data URL (in production, upload to secure storage)
    const dataUrl = `data:application/json;base64,${Buffer.from(jsonData).toString('base64')}`;
    
    // Update request with download URL
    await db
      .update(dataExportRequests)
      .set({
        status: 'completed',
        downloadUrl: dataUrl,
        completedAt: new Date()
      })
      .where(eq(dataExportRequests.id, requestId));
    
    return dataUrl;
  } catch (error) {
    throw error;
  }
}