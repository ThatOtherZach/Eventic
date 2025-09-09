import { type Event, type InsertEvent, type Ticket, type InsertTicket, type User, type InsertUser, type AuthToken, type InsertAuthToken, type DelegatedValidator, type InsertDelegatedValidator, type SystemLog, type ArchivedEvent, type InsertArchivedEvent, type ArchivedTicket, type InsertArchivedTicket, type RegistryRecord, type InsertRegistryRecord, type RegistryTransaction, type InsertRegistryTransaction, type FeaturedEvent, type InsertFeaturedEvent, type Notification, type InsertNotification, type NotificationPreferences, type InsertNotificationPreferences, type LoginAttempt, type InsertLoginAttempt, type BlockedIp, type InsertBlockedIp, type AuthMonitoring, type InsertAuthMonitoring, type AuthQueue, type InsertAuthQueue, type AuthEvent, type InsertAuthEvent, type Session, type InsertSession, type ResellQueue, type InsertResellQueue, type ResellTransaction, type InsertResellTransaction, type EventRating, type InsertEventRating, type CurrencyLedger, type InsertCurrencyLedger, type AccountBalance, type InsertAccountBalance, type TransactionTemplate, type InsertTransactionTemplate, type CurrencyHold, type InsertCurrencyHold, type DailyClaim, type InsertDailyClaim, type SecretCode, type InsertSecretCode, type CodeRedemption, type InsertCodeRedemption, type TicketPurchase, type InsertTicketPurchase, type CryptoPaymentIntent, type InsertCryptoPaymentIntent, type Role, type InsertRole, type Permission, type InsertPermission, type RolePermission, type InsertRolePermission, type UserRole, type InsertUserRole, type PlatformHeader, type InsertPlatformHeader, type SystemSetting, type InsertSystemSetting, users, authTokens, events, tickets, cryptoPaymentIntents, delegatedValidators, systemLogs, archivedEvents, archivedTickets, registryRecords, registryTransactions, featuredEvents, notifications, notificationPreferences, loginAttempts, blockedIps, authMonitoring, authQueue, authEvents, sessions, resellQueue, resellTransactions, eventRatings, userReputationCache, validationActions, currencyLedger, accountBalances, transactionTemplates, currencyHolds, dailyClaims, secretCodes, codeRedemptions, ticketPurchases, roles, permissions, rolePermissions, userRoles, scheduledJobs, platformHeaders, systemSettings } from "@shared/schema";
import { db } from "./db";
import { scheduleEventDeletion, updateEventDeletionSchedule, calculateDeletionDate } from "./jobScheduler";
import { generateValidationCode, addCodeToEvent, validateCodeInstant, queueValidation, getPendingValidations, preloadP2PEventCodes, clearEventCodes } from "./codePoolManager";
import { eq, desc, and, count, gt, lt, gte, lte, notInArray, sql, isNotNull, ne, isNull, inArray, or, not, asc } from "drizzle-orm";
import { randomUUID } from "crypto";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserById(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getAllUsers(): Promise<User[]>;
  createUser(user: InsertUser): Promise<User>;
  updateUserLoginTime(id: string): Promise<User | undefined>;
  updateUserDisplayName(id: string, displayName: string): Promise<User | undefined>;
  getTotalUsersCount(): Promise<number>;
  deleteUsersWhoNeverSignedIn(daysOld?: number): Promise<number>;

  // Account Deletion Management
  scheduleAccountDeletion(userId: string): Promise<User | undefined>;
  cancelAccountDeletion(userId: string): Promise<User | undefined>;
  isUserScheduledForDeletion(userId: string): Promise<boolean>;
  getUserDeletionStatus(userId: string): Promise<{ isScheduled: boolean; scheduledAt?: Date; daysRemaining?: number }>;
  deleteUserAccount(userId: string): Promise<boolean>;

  getUserEventCountries(userId: string): Promise<string[]>;
  
  // Auth Tokens
  createAuthToken(token: InsertAuthToken): Promise<AuthToken>;
  getAuthToken(token: string): Promise<AuthToken | undefined>;
  markTokenAsUsed(id: string): Promise<AuthToken | undefined>;
  
  // Events
  getEvents(): Promise<Event[]>;
  getEvent(id: string): Promise<Event | undefined>;
  getEventsByUserId(userId: string): Promise<Event[]>;
  createEvent(event: InsertEvent): Promise<Event>;
  updateEvent(id: string, event: Partial<InsertEvent>): Promise<Event | undefined>;
  updateEventMaxTickets(id: string, maxTickets: number): Promise<Event | undefined>;
  deleteEvent(id: string): Promise<boolean>;
  archiveEvent(eventId: string): Promise<boolean>;
  getEventByHuntCode(huntCode: string): Promise<Event | undefined>;
  
  // Tickets
  getTickets(): Promise<Ticket[]>;
  getTicketsByEventId(eventId: string): Promise<Ticket[]>;
  getTotalTicketCountForEvent(eventId: string): Promise<number>;
  getTicketsByUserId(userId: string): Promise<Ticket[]>;
  getTicketsByEventAndUser(eventId: string, userId: string): Promise<Ticket[]>;
  getTicket(id: string): Promise<Ticket | undefined>;
  getTicketByQrData(qrData: string): Promise<Ticket | undefined>;
  getTicketByValidationCode(validationCode: string): Promise<Ticket | undefined>;
  createTicket(ticket: InsertTicket): Promise<Ticket>;
  validateTicket(id: string, validationCode?: string): Promise<Ticket | undefined>;
  reassignGoldenTicketByVotes(eventId: string): Promise<void>;
  resellTicket(ticketId: string, userId: string): Promise<boolean>;
  getResellQueueCount(eventId: string): Promise<number>;
  getNextResellTicket(eventId: string): Promise<{ ticket: Ticket; resellEntry: ResellQueue } | null>;
  processResellPurchase(eventId: string, newBuyerId: string, buyerEmail: string, buyerIp: string): Promise<Ticket | null>;
  checkUserHasTicketForEvent(eventId: string, userId: string, email: string, ip: string): Promise<boolean>;
  getCurrentPrice(eventId: string): Promise<number>;
  getUniqueTicketHolders(eventId: string): Promise<string[]>;
  
  // Paginated ticket queries
  getTicketsPaginated(params: { page: number; limit: number }): Promise<{ tickets: Ticket[]; total: number; hasMore: boolean }>;
  getTicketsByEventIdPaginated(eventId: string, params: { page: number; limit: number }): Promise<{ tickets: Ticket[]; total: number; hasMore: boolean }>;
  getTicketsByUserIdPaginated(userId: string, params: { page: number; limit: number }): Promise<{ tickets: Ticket[]; total: number; hasMore: boolean }>;
  
  // Transaction support for race condition prevention
  createTicketWithTransaction(ticket: InsertTicket): Promise<Ticket>;
  
  // Crypto Payment Intents
  createPaymentIntent(intent: InsertCryptoPaymentIntent): Promise<CryptoPaymentIntent>;
  getPaymentIntentByTicketId(ticketId: string): Promise<CryptoPaymentIntent | undefined>;
  getPaymentIntentByReference(reference: string): Promise<CryptoPaymentIntent | undefined>;
  updatePaymentIntentStatus(id: string, status: string, transactionHash?: string): Promise<CryptoPaymentIntent | undefined>;
  getPaymentIntentsByEventId(eventId: string): Promise<CryptoPaymentIntent[]>;
  getExpiredMonitoringIntents(): Promise<CryptoPaymentIntent[]>;
  
  // Validation Sessions
  createValidationSession(ticketId: string): Promise<{ token: string; expiresAt: Date }>;
  createValidationToken(ticketId: string): Promise<{ token: string; code: string }>;
  validateDynamicToken(token: string): Promise<{ valid: boolean; ticketId?: string }>;
  checkDynamicToken(token: string): Promise<{ valid: boolean; ticketId?: string }>;
  
  // Delegated Validators
  getDelegatedValidatorsByEvent(eventId: string): Promise<DelegatedValidator[]>;
  canUserValidateForEvent(userId: string, email: string, eventId: string): Promise<boolean>;
  addDelegatedValidator(validator: InsertDelegatedValidator): Promise<DelegatedValidator>;
  removeDelegatedValidator(id: string): Promise<boolean>;
  
  // Stats
  getEventStats(): Promise<{
    totalEvents: number;
    totalTickets: number;
    validatedTickets: number;
  }>;
  getUserValidatedTicketsCount(userId: string): Promise<number>;
  
  // System Logs
  getSystemLogs(params: {
    limit?: number;
    offset?: number;
    severity?: string;
    search?: string;
  }): Promise<SystemLog[]>;
  
  // Archive Management
  archiveEvent(eventId: string): Promise<boolean>;
  getArchivedEventsByUser(userId: string): Promise<ArchivedEvent[]>;
  getEventsToArchive(): Promise<Event[]>;
  cleanupOldArchives(): Promise<void>;
  
  // Registry Management
  createRegistryRecord(record: InsertRegistryRecord): Promise<RegistryRecord>;
  getRegistryRecord(id: string): Promise<RegistryRecord | undefined>;
  getRegistryRecordByTicket(ticketId: string): Promise<RegistryRecord | undefined>;
  getRegistryRecordsByUser(userId: string): Promise<RegistryRecord[]>;
  getAllRegistryRecords(): Promise<RegistryRecord[]>;
  canMintTicket(ticketId: string): Promise<boolean>;
  createRegistryTransaction(transaction: InsertRegistryTransaction): Promise<RegistryTransaction>;
  updateRegistryLastAccessed(id: string): Promise<void>;
  
  // Featured Events Management
  getActiveFeaturedEvents(): Promise<FeaturedEvent[]>;
  getFeaturedEventsWithDetails(): Promise<(FeaturedEvent & { event: Event })[]>;
  createFeaturedEvent(featuredEvent: InsertFeaturedEvent): Promise<FeaturedEvent>;
  getBoostPrice(count: number): number;
  getFeaturedEventCount(): Promise<number>;
  canBoostEvent(eventId: string): Promise<boolean>;
  getNextAvailablePosition(): Promise<number | null>;
  cleanupExpiredFeaturedEvents(): Promise<void>;
  getEventsPaginated(page: number, limit: number): Promise<Event[]>;
  getTotalEventsCount(): Promise<number>;
  
  // Admin Operations
  getAllEventsForAdmin(): Promise<Event[]>;
  updateEventVisibility(eventId: string, field: "isEnabled" | "ticketPurchasesEnabled", value: boolean): Promise<Event | undefined>;
  
  // Roles and Permissions
  createRole(role: InsertRole): Promise<Role>;
  getRoles(): Promise<Role[]>;
  getRoleByName(name: string): Promise<Role | undefined>;
  createPermission(permission: InsertPermission): Promise<Permission>;
  getPermissions(): Promise<Permission[]>;
  assignRolePermission(roleId: string, permissionId: string): Promise<RolePermission>;
  getRolePermissions(roleId: string): Promise<Permission[]>;
  assignUserRole(userId: string, roleId: string, assignedBy?: string): Promise<UserRole>;
  getUserRoles(userId: string): Promise<Role[]>;
  getUserPermissions(userId: string): Promise<Permission[]>;
  hasPermission(userId: string, permissionName: string): Promise<boolean>;
  removeUserRole(userId: string, roleId: string): Promise<void>;
  initializeRolesAndPermissions(): Promise<void>;
  migrateExistingAdmins(): Promise<void>;
  
  // Notifications
  getNotifications(userId: string): Promise<Notification[]>;
  createNotification(notification: InsertNotification): Promise<Notification>;
  markNotificationAsRead(id: string): Promise<Notification | undefined>;
  markAllNotificationsAsRead(userId: string): Promise<void>;
  getNotificationPreferences(userId: string): Promise<NotificationPreferences | undefined>;
  updateNotificationPreferences(userId: string, preferences: Partial<InsertNotificationPreferences>): Promise<NotificationPreferences>;
  expireOldNotifications(): Promise<void>;
  
  // Login Rate Limiting
  recordLoginAttempt(attempt: InsertLoginAttempt): Promise<LoginAttempt>;
  getRecentLoginAttempts(email: string, minutes: number): Promise<LoginAttempt[]>;
  getFailedLoginAttemptsFromIp(ipAddress: string, minutes: number): Promise<LoginAttempt[]>;
  
  // IP Blocking
  blockIp(ip: InsertBlockedIp): Promise<BlockedIp>;
  isIpBlocked(ipAddress: string): Promise<boolean>;
  unblockExpiredIps(): Promise<void>;
  getBlockedIp(ipAddress: string): Promise<BlockedIp | undefined>;
  
  // Auth Monitoring
  recordAuthEvent(event: InsertAuthMonitoring): Promise<AuthMonitoring>;
  getAuthMetrics(hours: number): Promise<{
    totalLogins: number;
    failedLogins: number;
    rateLimitHits: number;
    uniqueUsers: number;
  }>;
  
  // Auth Events
  recordAuthEventNew(event: InsertAuthEvent): Promise<AuthEvent>;
  getAuthEvents(userId?: string, limit?: number): Promise<AuthEvent[]>;
  
  // Sessions
  createSession(session: InsertSession): Promise<Session>;
  getSession(id: string): Promise<Session | undefined>;
  updateSessionActivity(id: string): Promise<Session | undefined>;
  cleanupExpiredSessions(): Promise<void>;
  
  // Auth Queue
  addToAuthQueue(item: InsertAuthQueue): Promise<AuthQueue>;
  getQueuePosition(email: string): Promise<number | null>;
  processAuthQueue(): Promise<AuthQueue[]>;
  updateQueueStatus(id: string, status: string, processedAt?: Date): Promise<AuthQueue | undefined>;
  
  // Event Ratings
  rateEvent(rating: InsertEventRating): Promise<EventRating | null>;
  hasUserRatedEvent(ticketId: string): Promise<boolean>;
  getUserReputation(userId: string): Promise<{ thumbsUp: number; thumbsDown: number; percentage: number | null }>;
  getAllUserRatings(userId: string): Promise<{ thumbsUp: number; thumbsDown: number; percentage: number | null; reputation: number; totalRatings: number }>;
  getUserValidationStats(userId: string): Promise<{ validationsPerformed: number }>;
  
  // Leaderboard
  getLeaderboard(): Promise<{
    userId: string;
    displayName: string;
    memberStatus: string;
    thumbsUp: number;
    thumbsDown: number;
    percentage: number | null;
    validatedCount: number;
  }[]>;
  
  // Currency Ledger Operations
  getUserBalance(userId: string): Promise<AccountBalance | null>;
  createLedgerTransaction(params: {
    transactionType: string;
    description: string;
    debits: Array<{ accountId: string; accountType: string; amount: number }>;
    credits: Array<{ accountId: string; accountType: string; amount: number }>;
    metadata?: any;
    relatedEntityId?: string;
    relatedEntityType?: string;
    createdBy?: string;
  }): Promise<CurrencyLedger[]>;
  getAccountTransactions(accountId: string, limit?: number): Promise<CurrencyLedger[]>;
  createHold(hold: InsertCurrencyHold): Promise<CurrencyHold>;
  releaseHold(holdId: string): Promise<boolean>;
  expireOldHolds(): Promise<void>;
  initializeSystemAccounts(): Promise<void>;
  creditUserAccount(userId: string, amount: number, description: string, metadata?: any): Promise<boolean>;
  debitUserAccount(userId: string, amount: number, description: string, metadata?: any): Promise<boolean>;
  transferTickets(fromUserId: string, toUserId: string, amount: number, description: string): Promise<boolean>;
  
  // Daily Claims
  canClaimDailyTickets(userId: string): Promise<{ canClaim: boolean; nextClaimAt?: Date }>;
  claimDailyTickets(userId: string): Promise<{ amount: number; nextClaimAt: Date }>;
  
  // Secret Codes
  validateSecretCode(code: string): Promise<SecretCode | undefined>;
  redeemSecretCode(code: string, userId: string): Promise<{ success: boolean; ticketAmount?: number; error?: string }>;
  hasUserRedeemedCode(userId: string, codeId: string): Promise<boolean>;
  
  // Ticket Purchases
  createTicketPurchase(purchase: InsertTicketPurchase): Promise<TicketPurchase>;
  updateTicketPurchaseStatus(id: string, status: string, stripeSessionId?: string): Promise<TicketPurchase | undefined>;
  getTicketPurchase(id: string): Promise<TicketPurchase | undefined>;
  getTicketPurchaseBySessionId(sessionId: string): Promise<TicketPurchase | undefined>;
  
  // Platform Headers Management
  getPlatformHeaders(): Promise<PlatformHeader[]>;
  getActivePlatformHeaders(): Promise<PlatformHeader[]>;
  getRandomPlatformHeader(): Promise<PlatformHeader | undefined>;
  getPlatformHeader(id: string): Promise<PlatformHeader | undefined>;
  createPlatformHeader(header: InsertPlatformHeader): Promise<PlatformHeader>;
  updatePlatformHeader(id: string, header: Partial<InsertPlatformHeader>): Promise<PlatformHeader | undefined>;
  deletePlatformHeader(id: string): Promise<boolean>;
  togglePlatformHeaderActive(id: string): Promise<PlatformHeader | undefined>;
  
  // System Settings Management
  getSystemSetting(key: string): Promise<SystemSetting | undefined>;
  setSystemSetting(key: string, value: string, userId?: string): Promise<SystemSetting>;
  getBannedWords(): Promise<string[]>;
}

interface ValidationSession {
  ticketId: string;
  expiresAt: Date;
  tokens: Set<string>;
  codes: Map<string, number>; // code -> timestamp
  ticketHolderLat?: number;
  ticketHolderLng?: number;
}

export class DatabaseStorage implements IStorage {
  // In-memory cache for validation sessions (temporary data)
  private validationSessions: Map<string, ValidationSession>;
  private validationTokens: Map<string, string>; // token -> ticketId
  private validationCodes: Map<string, string>; // code -> ticketId
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.validationSessions = new Map();
    this.validationTokens = new Map();
    this.validationCodes = new Map();
    
    // Start cleanup interval for expired sessions (every 30 seconds)
    this.startSessionCleanup();
    
    // Initialize code pool with existing tickets
    this.initializeCodePool();
    
    // Start batch processing for validation updates
    this.startBatchValidationProcessor();
  }
  
  private async initializeCodePool() {
    try {
      // Load all existing tickets with validation codes
      const allTickets = await db.select()
        .from(tickets)
        .where(isNotNull(tickets.validationCode));
      
      let loadedCount = 0;
      for (const ticket of allTickets) {
        if (ticket.validationCode) {
          // Remove any suffix (S, P, U) from the code
          const baseCode = ticket.validationCode.replace(/[SPU]$/, '');
          addCodeToEvent(ticket.eventId, baseCode);
          loadedCount++;
        }
      }
      
      console.log(`[CODE POOL] Loaded ${loadedCount} existing validation codes into pool`);
      
      // Preload any active P2P events
      await this.preloadActiveP2PEvents();
    } catch (error) {
      console.error('[CODE POOL] Error initializing code pool:', error);
    }
  }
  
  private async preloadActiveP2PEvents() {
    try {
      // Find events that are happening today with P2P validation enabled
      const now = new Date();
      const todayStart = new Date(now.setHours(0, 0, 0, 0));
      const todayEnd = new Date(now.setHours(23, 59, 59, 999));
      
      const p2pEvents = await db.select()
        .from(events)
        .where(
          and(
            eq(events.p2pValidation, true),
            gte(events.date, todayStart),
            lte(events.date, todayEnd)
          )
        );
      
      for (const event of p2pEvents) {
        const count = preloadP2PEventCodes(event.id);
        if (count > 0) {
          console.log(`[CODE POOL] Preloaded ${count} codes for P2P event: ${event.name}`);
        }
      }
    } catch (error) {
      console.error('[CODE POOL] Error preloading P2P events:', error);
    }
  }
  
  private startSessionCleanup() {
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredValidationSessions();
    }, 60000); // Run every 60 seconds instead of 30 (reduced frequency)
  }
  
  private startBatchValidationProcessor() {
    // Process pending validations every 30 seconds
    setInterval(async () => {
      try {
        const pendingValidations = getPendingValidations();
        
        if (pendingValidations.length === 0) {
          return;
        }
        
        console.log(`[BATCH PROCESSOR] Processing ${pendingValidations.length} pending validations`);
        
        // Process in batches of 100 to avoid overwhelming the database
        const batchSize = 100;
        for (let i = 0; i < pendingValidations.length; i += batchSize) {
          const batch = pendingValidations.slice(i, i + batchSize);
          
          // Update tickets in batch using a transaction
          await db.transaction(async (tx) => {
            for (const validation of batch) {
              await tx
                .update(tickets)
                .set({
                  isValidated: true,
                  validatedAt: validation.timestamp,
                  validatedBy: validation.validatorId
                })
                .where(eq(tickets.id, validation.ticketId));
            }
          });
        }
        
        console.log(`[BATCH PROCESSOR] Successfully processed ${pendingValidations.length} validations`);
      } catch (error) {
        console.error('[BATCH PROCESSOR] Error processing validations:', error);
      }
    }, 30000); // Run every 30 seconds
  }
  
  private cleanupExpiredValidationSessions() {
    const now = new Date();
    let cleanedCount = 0;
    
    for (const [ticketId, session] of Array.from(this.validationSessions.entries())) {
      if (session.expiresAt < now) {
        // Clean up tokens
        session.tokens.forEach((token: string) => {
          this.validationTokens.delete(token);
        });
        
        // Clean up codes
        session.codes.forEach((_timestamp: number, code: string) => {
          this.validationCodes.delete(code);
        });
        
        // Delete the session
        this.validationSessions.delete(ticketId);
        cleanedCount++;
      }
    }
    
    if (cleanedCount > 0) {
      console.log(`Cleaned up ${cleanedCount} expired validation sessions`);
    }
  }
  
  // Call this when shutting down the server
  public cleanup() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.cleanupExpiredValidationSessions(); // Final cleanup
  }

  // Users
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserById(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || undefined;
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users);
  }

  async createUser(insertUser: InsertUser & { id?: string }): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    
    // Give new users a welcome bonus of 10 Tickets
    if (user && user.id) {
      await this.creditUserAccount(
        user.id,
        10,
        'Welcome bonus - one time credit for new account',
        { type: 'welcome_bonus' }
      );
    }
    
    return user;
  }

  async updateUserLoginTime(id: string): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({ lastLoginAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return user || undefined;
  }

  async updateUserDisplayName(id: string, displayName: string): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({ displayName })
      .where(eq(users.id, id))
      .returning();
    return user || undefined;
  }

  async getTotalUsersCount(): Promise<number> {
    const result = await db
      .select({ count: count() })
      .from(users);
    return result[0]?.count || 0;
  }

  async deleteUsersWhoNeverSignedIn(daysOld: number = 30): Promise<number> {
    // Calculate the cutoff date (users created more than X days ago)
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);
    
    // Find users who were created before the cutoff date and have never signed in
    const usersToDelete = await db
      .select({ id: users.id })
      .from(users)
      .where(
        and(
          lt(users.createdAt, cutoffDate),
          isNull(users.lastLoginAt)
        )
      );
    
    if (usersToDelete.length === 0) {
      return 0;
    }
    
    // Delete these users
    const userIds = usersToDelete.map(u => u.id);
    await db
      .delete(users)
      .where(inArray(users.id, userIds));
    
    console.log(`[CLEANUP] Deleted ${usersToDelete.length} users who never signed in after ${daysOld} days`);
    return usersToDelete.length;
  }

  // Account Deletion Management
  async scheduleAccountDeletion(userId: string): Promise<User | undefined> {
    const deletionDate = new Date();
    const [user] = await db
      .update(users)
      .set({ deletionScheduledAt: deletionDate })
      .where(eq(users.id, userId))
      .returning();
    
    if (user) {
      // Schedule the actual deletion job for 90 days from now
      const deletionJobDate = new Date(deletionDate.getTime() + (90 * 24 * 60 * 60 * 1000));
      await this.scheduleUserDeletionJob(userId, deletionJobDate);
    }
    
    return user || undefined;
  }

  async cancelAccountDeletion(userId: string): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({ deletionScheduledAt: null })
      .where(eq(users.id, userId))
      .returning();
    
    if (user) {
      // Remove the scheduled deletion job
      await this.cancelUserDeletionJob(userId);
    }
    
    return user || undefined;
  }

  async isUserScheduledForDeletion(userId: string): Promise<boolean> {
    const user = await db
      .select({ deletionScheduledAt: users.deletionScheduledAt })
      .from(users)
      .where(eq(users.id, userId))
      .then(rows => rows[0]);
    
    return user?.deletionScheduledAt !== null && user?.deletionScheduledAt !== undefined;
  }

  async getUserDeletionStatus(userId: string): Promise<{ isScheduled: boolean; scheduledAt?: Date; daysRemaining?: number }> {
    const user = await db
      .select({ deletionScheduledAt: users.deletionScheduledAt })
      .from(users)
      .where(eq(users.id, userId))
      .then(rows => rows[0]);
    
    if (!user?.deletionScheduledAt) {
      return { isScheduled: false };
    }
    
    const scheduledAt = user.deletionScheduledAt;
    const deletionDate = new Date(scheduledAt.getTime() + (90 * 24 * 60 * 60 * 1000));
    const now = new Date();
    const daysRemaining = Math.ceil((deletionDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
    
    return {
      isScheduled: true,
      scheduledAt,
      daysRemaining: Math.max(0, daysRemaining)
    };
  }

  private async scheduleUserDeletionJob(userId: string, deletionDate: Date): Promise<void> {
    await db.insert(scheduledJobs).values({
      jobType: 'delete_user',
      targetId: userId,
      scheduledFor: deletionDate,
      status: 'pending'
    });
  }

  private async cancelUserDeletionJob(userId: string): Promise<void> {
    await db
      .delete(scheduledJobs)
      .where(and(
        eq(scheduledJobs.jobType, 'delete_user'),
        eq(scheduledJobs.targetId, userId),
        eq(scheduledJobs.status, 'pending')
      ));
  }

  async deleteUserAccount(userId: string): Promise<boolean> {
    try {
      console.log(`[DELETE_USER] Starting account deletion for user ${userId}`);
      
      // Get user details before deletion
      const user = await this.getUser(userId);
      if (!user) {
        console.log(`[DELETE_USER] User ${userId} not found`);
        return true; // Already deleted
      }
      
      // Generate anonymized ID: username_deleted_MMDDYYYY
      const deletionDate = new Date();
      const month = (deletionDate.getMonth() + 1).toString().padStart(2, '0');
      const day = deletionDate.getDate().toString().padStart(2, '0');
      const year = deletionDate.getFullYear();
      const anonymizedId = `${user.displayName || 'unknown'}_deleted_${month}${day}${year}`;
      
      console.log(`[DELETE_USER] Anonymizing records with ID: ${anonymizedId}`);
      
      // === ANONYMIZE FINANCIAL/ECONOMIC RECORDS ===
      
      // Anonymize ticket purchases
      await db.update(ticketPurchases)
        .set({ userId: anonymizedId })
        .where(eq(ticketPurchases.userId, userId));
      
      // Anonymize currency ledger entries
      await db.update(currencyLedger)
        .set({ accountId: anonymizedId })
        .where(eq(currencyLedger.accountId, userId));
      
      // Anonymize account balances
      await db.update(accountBalances)
        .set({ accountId: anonymizedId })
        .where(eq(accountBalances.accountId, userId));
      
      // Anonymize resell transactions (both as buyer and seller)
      await db.update(resellTransactions)
        .set({ originalOwnerId: anonymizedId })
        .where(eq(resellTransactions.originalOwnerId, userId));
      
      await db.update(resellTransactions)
        .set({ newOwnerId: anonymizedId })
        .where(eq(resellTransactions.newOwnerId, userId));
      
      // Anonymize code redemptions
      await db.update(codeRedemptions)
        .set({ userId: anonymizedId })
        .where(eq(codeRedemptions.userId, userId));
      
      // === ANONYMIZE AUDIT/HISTORICAL RECORDS ===
      
      // Anonymize validation actions
      await db.update(validationActions)
        .set({ validatorId: anonymizedId })
        .where(eq(validationActions.validatorId, userId));
      
      // Anonymize event ratings
      await db.update(eventRatings)
        .set({ eventOwnerId: anonymizedId })
        .where(eq(eventRatings.eventOwnerId, userId));
      
      // Anonymize archived events
      await db.update(archivedEvents)
        .set({ userId: anonymizedId })
        .where(eq(archivedEvents.userId, userId));
      
      // Anonymize archived tickets
      await db.update(archivedTickets)
        .set({ userId: anonymizedId })
        .where(eq(archivedTickets.userId, userId));
      
      // === DELETE PERSONAL/AUTH DATA ===
      
      // Delete notifications
      await db.delete(notifications).where(eq(notifications.userId, userId));
      
      // Delete notification preferences  
      await db.delete(notificationPreferences).where(eq(notificationPreferences.userId, userId));
      
      // Delete user sessions
      await db.delete(sessions).where(eq(sessions.userId, userId));
      
      // Delete user roles
      await db.delete(userRoles).where(eq(userRoles.userId, userId));
      
      // Delete auth tokens
      await db.delete(authTokens).where(eq(authTokens.userId, userId));
      
      // Delete login attempts (by email)
      const userEmail = user.email;
      if (userEmail) {
        await db.delete(loginAttempts).where(eq(loginAttempts.email, userEmail));
      }
      
      // Delete auth monitoring
      await db.delete(authMonitoring).where(eq(authMonitoring.userId, userId));
      
      // Delete auth queue entries (by email)
      if (userEmail) {
        await db.delete(authQueue).where(eq(authQueue.email, userEmail));
      }
      
      // Delete auth events
      await db.delete(authEvents).where(eq(authEvents.userId, userId));
      
      // Delete delegated validators (where user added them)
      await db.delete(delegatedValidators).where(eq(delegatedValidators.addedBy, userId));
      
      // Delete resell queue entries
      await db.delete(resellQueue).where(eq(resellQueue.originalOwnerId, userId));
      
      // Delete daily claims
      await db.delete(dailyClaims).where(eq(dailyClaims.userId, userId));
      
      // Delete user reputation cache
      await db.delete(userReputationCache).where(eq(userReputationCache.userId, userId));
      
      // === DELETE ACTIVE CONTENT ===
      
      // Delete user tickets (will be archived naturally)
      await db.delete(tickets).where(eq(tickets.userId, userId));
      
      // Delete all events created by the user (will be archived naturally)
      await db.delete(events).where(eq(events.userId, userId));
      
      // Delete scheduled jobs for this user
      await db.delete(scheduledJobs).where(eq(scheduledJobs.targetId, userId));
      
      // Delete system logs related to this user
      await db.delete(systemLogs).where(eq(systemLogs.userId, userId));
      
      // NOTE: We explicitly DO NOT touch:
      // - registryRecords (NFT registry) - preserved permanently
      // - registryTransactions - preserved permanently
      
      // Finally, delete the user account
      await db.delete(users).where(eq(users.id, userId));
      
      console.log(`[DELETE_USER] Successfully anonymized financial/audit records and deleted user ${userId}`);
      console.log(`[DELETE_USER] Preserved records now use anonymized ID: ${anonymizedId}`);
      return true;
    } catch (error) {
      console.error(`[DELETE_USER] Error deleting user account ${userId}:`, error);
      return false;
    }
  }





  async getUserEventCountries(userId: string): Promise<string[]> {
    // Get all events user has tickets for, ordered by event date (most recent first)
    const userTickets = await db
      .select({
        eventId: tickets.eventId,
        eventDate: events.date,
        country: events.country,
        venue: events.venue
      })
      .from(tickets)
      .innerJoin(events, eq(tickets.eventId, events.id))
      .where(eq(tickets.userId, userId))
      .orderBy(desc(events.date))
      .limit(10); // Get last 10 events

    const countries: string[] = [];
    
    for (const ticket of userTickets) {
      let country = ticket.country;
      
      // If country not set, try to extract from venue address
      if (!country && ticket.venue) {
        country = this.extractCountryFromAddress(ticket.venue);
        
        // Update the event with the extracted country
        if (country) {
          await db
            .update(events)
            .set({ country })
            .where(eq(events.id, ticket.eventId));
        }
      }
      
      if (country && !countries.includes(country)) {
        countries.push(country);
      }
      
      // Return top 3 countries
      if (countries.length >= 3) break;
    }
    
    return countries;
  }

  private extractCountryFromAddress(address: string): string | null {
    // Simple country extraction logic - in production you'd use a proper geocoding service
    const countryPatterns = [
      // Common patterns for addresses
      { pattern: /,\s*(United States|USA|US)$/i, country: 'United States' },
      { pattern: /,\s*(United Kingdom|UK|England|Scotland|Wales)$/i, country: 'United Kingdom' },
      { pattern: /,\s*(Canada|CA)$/i, country: 'Canada' },
      { pattern: /,\s*(Australia|AU)$/i, country: 'Australia' },
      { pattern: /,\s*(Germany|Deutschland|DE)$/i, country: 'Germany' },
      { pattern: /,\s*(France|FR)$/i, country: 'France' },
      { pattern: /,\s*(Italy|IT)$/i, country: 'Italy' },
      { pattern: /,\s*(Spain|ES)$/i, country: 'Spain' },
      { pattern: /,\s*(Japan|JP)$/i, country: 'Japan' },
      { pattern: /,\s*(Brazil|BR)$/i, country: 'Brazil' },
      { pattern: /,\s*(India|IN)$/i, country: 'India' },
      { pattern: /,\s*(China|CN)$/i, country: 'China' },
      { pattern: /,\s*(Netherlands|NL)$/i, country: 'Netherlands' },
      { pattern: /,\s*(Belgium|BE)$/i, country: 'Belgium' },
      { pattern: /,\s*(Switzerland|CH)$/i, country: 'Switzerland' },
      { pattern: /,\s*(Austria|AT)$/i, country: 'Austria' },
      { pattern: /,\s*(Sweden|SE)$/i, country: 'Sweden' },
      { pattern: /,\s*(Norway|NO)$/i, country: 'Norway' },
      { pattern: /,\s*(Denmark|DK)$/i, country: 'Denmark' },
      { pattern: /,\s*(Finland|FI)$/i, country: 'Finland' },
    ];

    for (const { pattern, country } of countryPatterns) {
      if (pattern.test(address)) {
        return country;
      }
    }

    return null;
  }

  // Auth Tokens
  async createAuthToken(insertToken: InsertAuthToken): Promise<AuthToken> {
    const [token] = await db.insert(authTokens).values(insertToken).returning();
    return token;
  }

  async getAuthToken(token: string): Promise<AuthToken | undefined> {
    const [authToken] = await db
      .select()
      .from(authTokens)
      .where(eq(authTokens.token, token));
    return authToken || undefined;
  }

  async markTokenAsUsed(id: string): Promise<AuthToken | undefined> {
    const [token] = await db
      .update(authTokens)
      .set({ used: true })
      .where(eq(authTokens.id, id))
      .returning();
    return token || undefined;
  }

  // Events
  async getEvents(): Promise<Event[]> {
    return db.select().from(events).orderBy(desc(events.createdAt));
  }

  async getEvent(id: string): Promise<Event | undefined> {
    const [event] = await db.select().from(events).where(eq(events.id, id));
    return event || undefined;
  }

  async getEventWithCreator(id: string): Promise<(Event & { creatorEmail?: string }) | undefined> {
    const [result] = await db
      .select({
        event: events,
        creatorEmail: users.email,
      })
      .from(events)
      .leftJoin(users, eq(events.userId, users.id))
      .where(eq(events.id, id));
    
    if (!result) return undefined;
    
    return {
      ...result.event,
      creatorEmail: result.creatorEmail || undefined,
    };
  }

  async getEventByHuntCode(huntCode: string): Promise<Event | undefined> {
    // First find the secret code with this hunt code
    const [secretCode] = await db
      .select()
      .from(secretCodes)
      .where(and(
        eq(secretCodes.code, huntCode),
        eq(secretCodes.codeType, "hunt")
      ));
    
    if (!secretCode || !secretCode.eventId) {
      return undefined;
    }
    
    // Then get the associated event
    const [event] = await db
      .select()
      .from(events)
      .where(eq(events.id, secretCode.eventId));
    
    return event || undefined;
  }

  async getEventsByUserId(userId: string): Promise<Event[]> {
    return db
      .select()
      .from(events)
      .where(eq(events.userId, userId))
      .orderBy(desc(events.createdAt));
  }

  async createEvent(insertEvent: InsertEvent): Promise<Event> {
    const [event] = await db.insert(events).values(insertEvent).returning();
    
    // Schedule automatic deletion 69 days after event ends (or starts if no end date)
    const deletionDate = calculateDeletionDate(event.date, event.endDate);
    await scheduleEventDeletion(event.id, deletionDate);
    
    return event;
  }

  async updateEvent(id: string, updateData: Partial<InsertEvent>): Promise<Event | undefined> {
    const [event] = await db
      .update(events)
      .set(updateData)
      .where(eq(events.id, id))
      .returning();
    
    // If dates were updated, update the deletion schedule
    if (event && (updateData.date || updateData.endDate)) {
      const deletionDate = calculateDeletionDate(event.date, event.endDate);
      await updateEventDeletionSchedule(event.id, deletionDate);
    }
    
    return event || undefined;
  }

  async updateEventMaxTickets(id: string, maxTickets: number): Promise<Event | undefined> {
    const [event] = await db
      .update(events)
      .set({ maxTickets })
      .where(eq(events.id, id))
      .returning();
    return event || undefined;
  }

  async deleteEvent(id: string): Promise<boolean> {
    // Delete associated tickets first
    await db.delete(tickets).where(eq(tickets.eventId, id));
    
    // Delete the event
    const result = await db.delete(events).where(eq(events.id, id)).returning();
    return result.length > 0;
  }

  // Tickets
  async getTickets(): Promise<Ticket[]> {
    // Limit to 100 tickets by default for performance
    return db.select().from(tickets).orderBy(desc(tickets.createdAt)).limit(100);
  }

  async getTicketsByEventId(eventId: string): Promise<Ticket[]> {
    // Limit to 100 tickets by default for performance
    // Exclude tickets that are listed for resale (they're available to purchase again)
    return db
      .select()
      .from(tickets)
      .where(and(
        eq(tickets.eventId, eventId),
        ne(tickets.resellStatus, "for_resale")
      ))
      .orderBy(desc(tickets.createdAt))
      .limit(100);
  }

  async getTotalTicketCountForEvent(eventId: string): Promise<number> {
    // Get total count of ALL tickets created for this event (regardless of resale status)
    const [result] = await db
      .select({ count: count() })
      .from(tickets)
      .where(eq(tickets.eventId, eventId));
    
    return result?.count || 0;
  }

  async getTicketsByUserId(userId: string): Promise<Ticket[]> {
    // Limit to 100 tickets by default for performance
    // Exclude tickets that are listed for resale or have been sold
    return db
      .select()
      .from(tickets)
      .where(and(
        eq(tickets.userId, userId),
        ne(tickets.resellStatus, "for_resale"),
        ne(tickets.resellStatus, "sold")
      ))
      .orderBy(desc(tickets.createdAt))
      .limit(100);
  }

  async getTicketsByEventAndUser(eventId: string, userId: string): Promise<Ticket[]> {
    // Limit to 100 tickets by default for performance
    // Include all user's tickets for the event, even those listed for resale
    return db
      .select()
      .from(tickets)
      .where(and(eq(tickets.eventId, eventId), eq(tickets.userId, userId)))
      .orderBy(desc(tickets.createdAt))
      .limit(100);
  }

  async getUniqueTicketHolders(eventId: string): Promise<string[]> {
    const results = await db
      .selectDistinct({ userId: tickets.userId })
      .from(tickets)
      .where(and(eq(tickets.eventId, eventId), isNotNull(tickets.userId)));
    
    return results.map(result => result.userId).filter(Boolean) as string[];
  }

  async getValidatedTicketsForEvent(eventId: string): Promise<any[]> {
    const validatedTickets = await db
      .select({
        ticketId: tickets.id,
        ticketNumber: tickets.ticketNumber,
        validatedAt: tickets.validatedAt,
        useCount: tickets.useCount,
        isGoldenTicket: tickets.isGoldenTicket,
        userEmail: users.email,
        eventReentryType: events.reentryType,
      })
      .from(tickets)
      .innerJoin(users, eq(tickets.userId, users.id))
      .innerJoin(events, eq(tickets.eventId, events.id))
      .where(and(eq(tickets.eventId, eventId), eq(tickets.isValidated, true)))
      .orderBy(desc(tickets.validatedAt));
    
    return validatedTickets.map(ticket => ({
      ...ticket,
      ticketType: ticket.eventReentryType === "No Reentry (Single Use)" ? "Single Use" :
                 ticket.eventReentryType === "Pass (Multiple Use)" ? "Pass" : "Unlimited"
    }));
  }

  async getTicket(id: string): Promise<Ticket | undefined> {
    const [ticket] = await db.select().from(tickets).where(eq(tickets.id, id));
    return ticket || undefined;
  }

  async getTicketByQrData(qrData: string): Promise<Ticket | undefined> {
    const [ticket] = await db.select().from(tickets).where(eq(tickets.qrData, qrData));
    return ticket || undefined;
  }

  async getTicketByValidationCode(validationCode: string): Promise<Ticket | undefined> {
    const [ticket] = await db.select().from(tickets).where(eq(tickets.validationCode, validationCode));
    return ticket || undefined;
  }

  async createTicket(insertTicket: InsertTicket): Promise<Ticket> {
    const [ticket] = await db.insert(tickets).values(insertTicket).returning();
    return ticket;
  }

  async resellTicket(ticketId: string, userId: string): Promise<boolean> {
    try {
      // Get the ticket
      const ticket = await this.getTicket(ticketId);
      if (!ticket) return false;
      
      // Verify ownership
      if (ticket.userId !== userId) return false;
      
      // Check if ticket has been validated
      if (ticket.isValidated) return false;
      
      // Check if already for resale
      if (ticket.resellStatus === "for_resale") return false;
      
      // Get the event to check timing
      const event = await this.getEvent(ticket.eventId);
      if (!event) return false;
      
      // Check if event start is at least 1 hour in the future
      const eventStartTime = new Date(`${event.date}T${event.time}:00`);
      const now = new Date();
      const hoursUntilEvent = (eventStartTime.getTime() - now.getTime()) / (1000 * 60 * 60);
      
      if (hoursUntilEvent < 1) return false;
      
      // Get the next position in the resell queue for this event
      const maxPosition = await db
        .select({ maxPos: sql<number>`COALESCE(MAX(${resellQueue.position}), 0)` })
        .from(resellQueue)
        .where(eq(resellQueue.eventId, ticket.eventId));
      
      const nextPosition = (maxPosition[0]?.maxPos || 0) + 1;
      
      // Start transaction to update ticket status and add to resell queue
      await db.transaction(async (tx) => {
        // Update ticket status and store original owner
        await tx.update(tickets)
          .set({ 
            resellStatus: "for_resale", 
            originalOwnerId: userId 
          })
          .where(eq(tickets.id, ticketId));
        
        // Add to resell queue using the ticket's original purchase price
        const resellPrice = ticket.purchasePrice || event.ticketPrice; // Use stored purchase price or fallback to event price
        await tx.insert(resellQueue).values({
          ticketId,
          eventId: ticket.eventId,
          originalOwnerId: userId,
          ticketPrice: resellPrice, // Enforce resale at original purchase price
          position: nextPosition,
        });
      });
      
      return true;
    } catch (error) {
      console.error("Error putting ticket up for resale:", error);
      return false;
    }
  }

  async getResellQueueCount(eventId: string): Promise<number> {
    try {
      const [result] = await db
        .select({ count: count() })
        .from(resellQueue)
        .where(eq(resellQueue.eventId, eventId));
      
      return result?.count || 0;
    } catch (error) {
      console.error("Error getting resell queue count:", error);
      return 0;
    }
  }

  async getNextResellTicket(eventId: string): Promise<{ ticket: Ticket; resellEntry: ResellQueue } | null> {
    try {
      // Get the ticket at position 1 (next to be sold) with its resell entry
      const [result] = await db
        .select()
        .from(resellQueue)
        .innerJoin(tickets, eq(resellQueue.ticketId, tickets.id))
        .where(and(
          eq(resellQueue.eventId, eventId),
          eq(resellQueue.position, 1)
        ))
        .limit(1);
      
      if (!result) return null;
      
      return {
        ticket: result.tickets,
        resellEntry: result.resell_queue
      };
    } catch (error) {
      console.error("Error getting next resell ticket:", error);
      return null;
    }
  }

  async processResellPurchase(eventId: string, newBuyerId: string, buyerEmail: string, buyerIp: string): Promise<Ticket | null> {
    try {
      const resellData = await this.getNextResellTicket(eventId);
      if (!resellData) return null;
      
      const { ticket, resellEntry } = resellData;
      
      // Check buyer has sufficient balance
      const ticketPrice = parseFloat(resellEntry.ticketPrice.toString());
      if (newBuyerId && ticketPrice > 0) {
        const buyerBalance = await this.getUserBalance(newBuyerId);
        if (!buyerBalance || parseFloat(buyerBalance.availableBalance) < ticketPrice) {
          return null; // Insufficient balance
        }
      }
      
      return await db.transaction(async (tx) => {
        // Calculate transaction amounts
        // No platform fee for free tickets (returns)
        const platformFee = ticketPrice === 0 ? 0 : Math.round(ticketPrice * 0.02 * 100) / 100; // 2% fee only for paid tickets
        const sellerAmount = Math.round((ticketPrice - platformFee) * 100) / 100; // Amount to seller
        
        // Get the new buyer's display name
        let displayName = 'Guest';
        const [user] = await tx
          .select({ displayName: users.displayName })
          .from(users)
          .where(eq(users.id, newBuyerId));
        if (user?.displayName) {
          displayName = user.displayName;
        }
        
        // Extract the ticket sequence number from the current ticket number
        // Format is: eventId-username-000001
        const ticketParts = ticket.ticketNumber.split('-');
        const sequenceNumber = ticketParts[ticketParts.length - 1]; // Get the last part (000001)
        const eventIdPart = ticketParts[0]; // Get the event ID part
        
        // Generate new ticket number with new owner's username
        const newTicketNumber = `${eventIdPart}-${displayName}-${sequenceNumber}`;
        
        // Transfer ticket to new buyer with updated ticket number
        const [updatedTicket] = await tx.update(tickets)
          .set({
            userId: newBuyerId,
            purchaserEmail: buyerEmail,
            purchaserIp: buyerIp,
            resellStatus: "sold",
            ticketNumber: newTicketNumber,
            qrData: newTicketNumber, // Update QR data to match new ticket number
          })
          .where(eq(tickets.id, ticket.id))
          .returning();
        
        // Record the resell transaction
        await tx.insert(resellTransactions).values({
          ticketId: ticket.id,
          eventId: eventId,
          originalOwnerId: resellEntry.originalOwnerId,
          newOwnerId: newBuyerId,
          ticketPrice: resellEntry.ticketPrice,
          platformFee: platformFee.toString(),
          sellerAmount: sellerAmount.toString(),
        });
        
        // Remove from resell queue
        await tx.delete(resellQueue)
          .where(eq(resellQueue.id, resellEntry.id));
        
        // Adjust positions for remaining tickets in queue
        await tx.update(resellQueue)
          .set({ position: sql`${resellQueue.position} - 1` })
          .where(and(
            eq(resellQueue.eventId, eventId),
            gt(resellQueue.position, resellEntry.position)
          ));
        
        // Process currency transaction if price > 0 and buyer is logged in
        if (newBuyerId && ticketPrice > 0) {
          // Ensure currency accounts exist - they should already exist from initial purchase
          
          // Create ledger entries for the resale transaction
          const transactionType = 'TICKET_RESALE';
          const transactionDescription = `Resale of ticket for event ${eventId}`;
          
          // Debit buyer for full amount
          await tx.insert(currencyLedger).values({
            transactionId: `resale_${ticket.id}_${Date.now()}`,
            accountId: newBuyerId,
            accountType: 'user',
            entryType: 'debit',
            amount: ticketPrice.toString(),
            balance: '0', // This would be calculated if we track running balance
            transactionType,
            description: `Purchased resale ticket`,
            metadata: JSON.stringify({
              ticketId: ticket.id,
              ticketNumber: newTicketNumber,
              sellerId: resellEntry.originalOwnerId,
            }),
            relatedEntityId: ticket.id,
            relatedEntityType: 'ticket',
            createdBy: newBuyerId,
          });
          
          // Credit seller with amount minus platform fee
          await tx.insert(currencyLedger).values({
            transactionId: `resale_${ticket.id}_${Date.now()}`,
            accountId: resellEntry.originalOwnerId,
            accountType: 'user',
            entryType: 'credit',
            amount: sellerAmount.toString(),
            balance: '0', // This would be calculated if we track running balance
            transactionType,
            description: `Sold ticket - received payment`,
            metadata: JSON.stringify({
              ticketId: ticket.id,
              ticketNumber: ticket.ticketNumber,
              buyerId: newBuyerId,
              platformFee: platformFee.toString(),
            }),
            relatedEntityId: ticket.id,
            relatedEntityType: 'ticket',
            createdBy: newBuyerId,
          });
          
          // Credit platform fee to system account if there's a fee
          if (platformFee > 0) {
            await tx.insert(currencyLedger).values({
              transactionId: `resale_${ticket.id}_${Date.now()}`,
              accountId: 'platform_fees',
              accountType: 'system_fees',
              entryType: 'credit',
              amount: platformFee.toString(),
              balance: '0', // This would be calculated if we track running balance
              transactionType,
              description: `Platform fee for ticket resale`,
              metadata: JSON.stringify({
                ticketId: ticket.id,
                sellerId: resellEntry.originalOwnerId,
                buyerId: newBuyerId,
              }),
              relatedEntityId: ticket.id,
              relatedEntityType: 'ticket',
              createdBy: newBuyerId,
            });
          }
        }
        
        return updatedTicket;
      });
    } catch (error) {
      console.error("Error processing resell purchase:", error);
      return null;
    }
  }

  async checkUserHasTicketForEvent(eventId: string, userId: string, email: string, ip: string): Promise<boolean> {
    try {
      // Check by user ID if available
      if (userId) {
        const ticketsByUserId = await db
          .select()
          .from(tickets)
          .leftJoin(resellQueue, eq(tickets.id, resellQueue.ticketId))
          .where(and(
            eq(tickets.eventId, eventId),
            eq(tickets.userId, userId),
            isNull(resellQueue.id) // Exclude tickets that are in resell queue
          ))
          .limit(1);
        
        if (ticketsByUserId.length > 0) {
          return true;
        }
      }
      
      // Check by email if available
      if (email) {
        const ticketsByEmail = await db
          .select()
          .from(tickets)
          .leftJoin(resellQueue, eq(tickets.id, resellQueue.ticketId))
          .where(and(
            eq(tickets.eventId, eventId),
            eq(tickets.purchaserEmail, email),
            isNull(resellQueue.id) // Exclude tickets that are in resell queue
          ))
          .limit(1);
        
        if (ticketsByEmail.length > 0) {
          return true;
        }
      }
      
      // Check by IP address
      if (ip && ip !== 'unknown') {
        const ticketsByIp = await db
          .select()
          .from(tickets)
          .leftJoin(resellQueue, eq(tickets.id, resellQueue.ticketId))
          .where(and(
            eq(tickets.eventId, eventId),
            eq(tickets.purchaserIp, ip),
            isNull(resellQueue.id) // Exclude tickets that are in resell queue
          ))
          .limit(1);
        
        if (ticketsByIp.length > 0) {
          return true;
        }
      }
      
      return false;
    } catch (error) {
      console.error("Error checking user ticket for event:", error);
      return false;
    }
  }

  async getCurrentPrice(eventId: string): Promise<number> {
    try {
      // Get the event to check if surge pricing is enabled
      const event = await this.getEvent(eventId);
      if (!event) {
        throw new Error('Event not found');
      }

      const basePrice = parseFloat(event.ticketPrice.toString());
      
      // If surge pricing is not enabled, return the base price
      if (!event.surgePricing) {
        return basePrice;
      }

      // Get the number of tickets sold
      const [ticketCount] = await db
        .select({ count: count() })
        .from(tickets)
        .where(eq(tickets.eventId, eventId));
      
      const ticketsSold = ticketCount?.count || 0;
      
      // Calculate demand factor with very gentle scaling - just enough to nudge behavior
      let demandFactor = 0;
      if (event.maxTickets && event.maxTickets > 0) {
        const soldRatio = ticketsSold / event.maxTickets;
        // Use logarithmic scaling for ultra-gentle curve
        // 25% sold = +5%, 50% sold = +10%, 75% sold = +15%, 90% sold = +20%
        if (soldRatio > 0) {
          demandFactor = Math.log10(soldRatio * 10 + 1) * 0.2;
        }
        // Cap at 0.25 for predictable pricing
        demandFactor = Math.min(demandFactor, 0.25);
      } else {
        // If no max tickets, use even gentler scaling based on absolute numbers
        // Every 50 tickets adds ~5% to price
        demandFactor = Math.min(Math.log10(ticketsSold / 10 + 1) * 0.1, 0.15);
      }
      
      // Calculate urgency factor based on time to event (very gentle)
      const eventDateTime = new Date(`${event.date}T${event.time}:00`);
      const now = new Date();
      const daysUntilEvent = (eventDateTime.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
      
      let urgencyFactor = 0;
      if (daysUntilEvent <= 1) {
        urgencyFactor = 0.25; // 25% increase in last 24 hours
      } else if (daysUntilEvent <= 3) {
        urgencyFactor = 0.13; // 13% increase in last 3 days
      } else if (daysUntilEvent <= 7) {
        urgencyFactor = 0.05; // 5% increase in last week
      } else if (daysUntilEvent <= 14) {
        urgencyFactor = 0.02; // 2% increase in last 2 weeks
      }
      
      // Combine factors: base price + (demand factor * base price) + (urgency factor * base price)
      const demandIncrease = demandFactor * basePrice;
      const urgencyIncrease = urgencyFactor * basePrice;
      const currentPrice = basePrice + demandIncrease + urgencyIncrease;
      
      // Round to 2 decimal places
      return Math.round(currentPrice * 100) / 100;
    } catch (error) {
      console.error("Error calculating current price:", error);
      throw error;
    }
  }

  async recordValidationAction(validatorId: string, ticketId: string, eventId: string, validationCode?: string): Promise<void> {
    await db.insert(validationActions).values({
      validatorId,
      ticketId,
      eventId,
      validationCode
    });
  }

  async validateTicket(id: string, validationCode?: string, validatorId?: string): Promise<Ticket | undefined> {
    // Get current ticket state
    const currentTicket = await this.getTicket(id);
    if (!currentTicket) return undefined;
    
    // Get event to check reentry settings
    const event = await this.getEvent(currentTicket.eventId);
    if (!event) return undefined;
    
    // Determine suffix based on reentry type
    let codeSuffix = '';
    if (event.reentryType === 'No Reentry (Single Use)') {
      codeSuffix = 'S';
    } else if (event.reentryType === 'Pass (Multiple Use)') {
      codeSuffix = 'P';
    } else if (event.reentryType === 'No Limit') {
      codeSuffix = 'U';
    }
    
    // Append suffix to validation code for backend uniqueness
    const fullValidationCode = validationCode ? validationCode + codeSuffix : null;
    
    // Determine special effect on first validation (only if special effects are enabled)
    let specialEffect: string | null = currentTicket.specialEffect || null;
    
    // Calculate multipliers for special effects (used in multiple places)
    let scarcityMultiplier = 1;
    let totalTickets = 0;
    let totalMultiplier = 1;
    
    if (!currentTicket.isValidated && event.specialEffectsEnabled) {
      // Count total tickets for this event to apply scarcity factor
      totalTickets = await db
        .select({ count: sql`count(*)` })
        .from(tickets)
        .where(eq(tickets.eventId, event.id))
        .then(rows => Number(rows[0]?.count || 0));
      
      // Calculate scarcity multiplier: fewer tickets = higher multiplier
      // 1-10 tickets: 3x multiplier
      // 11-25 tickets: 2x multiplier  
      // 26-50 tickets: 1.75x multiplier
      // 51-100 tickets: 1.5x multiplier
      // 101-200 tickets: 1.25x multiplier
      // 200+ tickets: 1x (no bonus)
      if (totalTickets <= 10) {
        scarcityMultiplier = 3;
      } else if (totalTickets <= 25) {
        scarcityMultiplier = 2;
      } else if (totalTickets <= 50) {
        scarcityMultiplier = 1.75;
      } else if (totalTickets <= 100) {
        scarcityMultiplier = 1.5;
      } else if (totalTickets <= 200) {
        scarcityMultiplier = 1.25;
      }
      
      // If ticket is charged, halve the odds denominator (double the probability)
      const chargeDivisor = currentTicket.isCharged ? 2 : 1;
      
      // Combine both multipliers for final odds boost
      totalMultiplier = chargeDivisor * scarcityMultiplier;
    }
    
    if (!currentTicket.isValidated && event.specialEffectsEnabled && !specialEffect) {
      // Parse event date to check for holiday effects
      const [year, month, day] = event.date.split('-').map(Number);
      const eventDate = new Date(year, month - 1, day);
      const dayOfYear = Math.floor((eventDate.getTime() - new Date(eventDate.getFullYear(), 0, 0).getTime()) / (1000 * 60 * 60 * 24));
      
      // Check conditions and apply probability
      const random = Math.random();
      
      // Priority order (highest to lowest)
      if (dayOfYear === 69) { // Nice day (March 10)
        if (random < 1/(69/totalMultiplier)) specialEffect = 'nice';
      } else if (event.name.toLowerCase().includes('pride') || event.name.toLowerCase().includes('gay')) {
        if (random < 1/(100/totalMultiplier)) specialEffect = 'pride';
      } else if (month === 2 && day === 14) { // Valentine's Day
        if (random < 1/(14/totalMultiplier)) specialEffect = 'hearts';
      } else if (month === 10 && day === 31) { // Halloween
        if (random < 1/(88/totalMultiplier)) specialEffect = 'spooky';
      } else if (month === 12 && day === 25) { // Christmas
        if (random < 1/(25/totalMultiplier)) specialEffect = 'snowflakes';
      } else if (month === 12 && day === 31) { // New Year's Eve
        if (random < 1/(365/totalMultiplier)) specialEffect = 'fireworks';
      } else if (event.name.toLowerCase().includes('party')) {
        if (random < 1/(100/totalMultiplier)) specialEffect = 'confetti';
      } else {
        // Monthly color effect (lowest priority)
        if (random < 1/(30/totalMultiplier)) specialEffect = 'monthly';
      }
      
      if (specialEffect) {
        console.log(`✨ Special effect assigned to ticket ${id}: ${specialEffect}`);
        if (scarcityMultiplier > 1) {
          console.log(`   Scarcity bonus applied: ${scarcityMultiplier}x (${totalTickets} tickets in event)`);
        }
        if (currentTicket.isCharged) {
          console.log(`   Charge bonus applied: 2x`);
        }
      }
    }
    
    // Check for custom sticker effect
    if (!specialEffect && event.stickerUrl && event.stickerOdds) {
      const random = Math.random();
      // Apply the same scarcity and charge multipliers
      const odds = event.stickerOdds / 100; // Convert percentage to decimal
      const adjustedOdds = odds * totalMultiplier; // Apply both scarcity and charge multipliers
      if (random < adjustedOdds) {
        specialEffect = 'sticker';
        const effectivePercentage = event.stickerOdds * totalMultiplier;
        console.log(`🎯 Custom sticker effect assigned to ticket ${id} (${effectivePercentage.toFixed(1)}% chance)`);
        if (scarcityMultiplier > 1) {
          console.log(`   Scarcity bonus: ${scarcityMultiplier}x (${totalTickets} tickets)`);
        }
        if (currentTicket.isCharged) {
          console.log(`   Charge bonus: 2x`);
        }
      }
    }
    
    // Check for golden ticket on first validation
    let isGoldenTicket = currentTicket.isGoldenTicket || false;
    if (!currentTicket.isValidated && event.goldenTicketEnabled && event.goldenTicketCount !== null) {
      // Skip random golden ticket assignment if voting is enabled
      if (!event.enableVoting) {
        // Count how many golden tickets have already been awarded for this event
        const goldenTicketCount = await db
          .select({ count: sql`count(*)` })
          .from(tickets)
          .where(and(eq(tickets.eventId, event.id), eq(tickets.isGoldenTicket, true)))
          .then(rows => Number(rows[0]?.count || 0));
        
        // Count how many unvalidated tickets remain for this event
        const unvalidatedCount = await db
          .select({ count: sql`count(*)` })
          .from(tickets)
          .where(and(eq(tickets.eventId, event.id), eq(tickets.isValidated, false)))
          .then(rows => Number(rows[0]?.count || 0));
        
        // Calculate remaining golden tickets to award
        const remainingGoldenTickets = event.goldenTicketCount - goldenTicketCount;
        
        // If we haven't reached the limit and there are tickets left to validate
        if (remainingGoldenTickets > 0 && unvalidatedCount > 0) {
          // Calculate probability: (remaining golden tickets / remaining unvalidated tickets) / 2
          // Dividing by 2 makes golden tickets rarer and more special
          // If ticket is charged, double the probability (halve the odds)
          const chargeDivisor = currentTicket.isCharged ? 2 : 1;
          const baseProbability = remainingGoldenTickets / unvalidatedCount;
          const probability = baseProbability / (2 / chargeDivisor);
          
          // Generate random number between 0 and 1
          const timestamp = Date.now();
          const seed = timestamp % 10000;
          const random = (seed * 9301 + 49297) % 233280;
          const randomValue = random / 233280; // 0 to 1
          
          // Check if this ticket wins based on calculated probability
          if (randomValue < probability) {
            isGoldenTicket = true;
            console.log(`🎫 GOLDEN TICKET WINNER! Ticket ${id} is golden ticket #${goldenTicketCount + 1} of ${event.goldenTicketCount}`);
            console.log(`   Probability was ${(probability * 100).toFixed(2)}% (base: ${(baseProbability * 100).toFixed(2)}% halved for rarity)`);
            console.log(`   ${remainingGoldenTickets} golden remaining / ${unvalidatedCount} unvalidated tickets`);
          }
        }
      }
    }
    
    // Update ticket with incremented use count/vote count, golden ticket status, and special effect
    // For voting-enabled events: increment voteCount if this is P2P validation, otherwise increment useCount
    const updateData: any = {
        isValidated: true, 
        validatedAt: new Date(),
        validationCode: fullValidationCode,
        isGoldenTicket: isGoldenTicket,
        specialEffect: specialEffect
    };
    
    // If this is a voting-enabled event and being validated by another ticket holder (P2P)
    if (event.enableVoting && validatorId && validatorId !== currentTicket.userId) {
      // This is a vote, only increment vote count
      updateData.voteCount = (currentTicket.voteCount || 0) + 1;
    } else {
      // This is regular validation, increment use count
      updateData.useCount = (currentTicket.useCount || 0) + 1;
    }
    
    const [ticket] = await db
      .update(tickets)
      .set(updateData)
      .where(eq(tickets.id, id))
      .returning();
    
    // Record validation action if validatorId is provided
    if (validatorId && ticket) {
      await this.recordValidationAction(validatorId, id, currentTicket.eventId, validationCode);
    }
    
    // For voting-enabled events, reassign golden ticket based on vote counts
    // Voting always uses golden tickets to identify the winner
    if (event.enableVoting) {
      await this.reassignGoldenTicketByVotes(event.id);
    }
    
    return ticket || undefined;
  }

  // Reassign golden tickets based on vote counts for voting-enabled events
  async chargeTicket(ticketId: string, userId: string): Promise<boolean> {
    try {
      return await db.transaction(async (tx) => {
        // Get the ticket to charge
        const ticketToCharge = await tx
          .select()
          .from(tickets)
          .where(eq(tickets.id, ticketId))
          .then(rows => rows[0]);
          
        if (!ticketToCharge || ticketToCharge.userId !== userId) {
          return false;
        }

        // Check if ticket is already charged or validated
        if (ticketToCharge.isCharged || ticketToCharge.isValidated) {
          return false;
        }

        // Get event to verify special effects OR stickers are enabled
        const event = await tx
          .select()
          .from(events)
          .where(eq(events.id, ticketToCharge.eventId))
          .then(rows => rows[0]);
          
        if (!event || (!event.specialEffectsEnabled && !event.stickerUrl)) {
          return false;
        }

        // Check user's currency balance
        const userBalance = await tx
          .select({ balance: sql`COALESCE(SUM(CASE WHEN entry_type = 'credit' THEN amount ELSE -amount END), 0)` })
          .from(currencyLedger)
          .where(eq(currencyLedger.accountId, userId))
          .then(rows => Number(rows[0]?.balance || 0));

        // Check if user has at least 3 credits
        if (userBalance < 3) {
          console.log(`User ${userId} has insufficient credits: ${userBalance} < 3`);
          return false;
        }

        // Create a unique transaction ID for this charge operation
        const transactionId = `charge_${ticketId}_${Date.now()}`;

        // Debit 3 credits from user's account
        await tx.insert(currencyLedger).values({
          transactionId,
          accountId: userId,
          accountType: 'user',
          entryType: 'debit',
          amount: '3.00',
          balance: (userBalance - 3).toString(),
          transactionType: 'TICKET_CHARGE',
          description: 'Charged ticket for improved special effects odds',
          metadata: JSON.stringify({
            ticketId: ticketId,
            eventId: ticketToCharge.eventId,
            eventName: event.name
          }),
          relatedEntityId: ticketId,
          relatedEntityType: 'ticket',
          createdBy: userId,
        });

        // Credit the system rewards account
        await tx.insert(currencyLedger).values({
          transactionId,
          accountId: 'system_rewards',
          accountType: 'system_rewards',
          entryType: 'credit',
          amount: '3.00',
          balance: '0', // System accounts don't track balance
          transactionType: 'TICKET_CHARGE',
          description: 'Received payment for ticket charge',
          metadata: JSON.stringify({
            ticketId: ticketId,
            userId: userId,
            eventId: ticketToCharge.eventId
          }),
          relatedEntityId: ticketId,
          relatedEntityType: 'ticket',
          createdBy: userId,
        });

        // Update the ticket to charged status
        await tx
          .update(tickets)
          .set({ isCharged: true })
          .where(eq(tickets.id, ticketId));

        console.log(`✨ Ticket ${ticketId} charged successfully. User ${userId} debited 3 credits.`);
        return true;
      });
    } catch (error) {
      console.error("Error charging ticket:", error);
      return false;
    }
  }

  async reassignGoldenTicketByVotes(eventId: string): Promise<void> {
    // Get the event to check if voting is enabled
    const event = await this.getEvent(eventId);
    if (!event || !event.enableVoting) {
      return; // Nothing to do if voting is not enabled
    }

    // Find the ticket with the highest vote count (voteCount) for this event
    const eventTickets = await db
      .select()
      .from(tickets)
      .where(eq(tickets.eventId, eventId))
      .orderBy(desc(tickets.voteCount));

    if (eventTickets.length === 0) {
      return; // No tickets for this event
    }

    const topTicket = eventTickets[0];
    const currentGoldenTickets = eventTickets.filter((t: Ticket) => t.isGoldenTicket);

    // Only proceed if there's a clear winner with votes and it's not already golden
    if ((topTicket.voteCount || 0) > 0 && !topTicket.isGoldenTicket) {
      // Check if this ticket would also have been randomly selected (double golden detection)
      let isDoubleGolden = false;
      
      // Simulate the random golden ticket selection for this ticket
      const goldenTicketCount = await db
        .select({ count: sql`count(*)` })
        .from(tickets)
        .where(and(eq(tickets.eventId, eventId), eq(tickets.isGoldenTicket, true)))
        .then(rows => Number(rows[0]?.count || 0));
      
      const unvalidatedCount = await db
        .select({ count: sql`count(*)` })
        .from(tickets)
        .where(and(eq(tickets.eventId, eventId), eq(tickets.isValidated, false)))
        .then(rows => Number(rows[0]?.count || 0));
      
      const remainingGoldenTickets = (event.goldenTicketCount || 0) - goldenTicketCount;
      
      if (remainingGoldenTickets > 0 && unvalidatedCount > 0) {
        // Use the same probability calculation as the random system
        const baseProbability = remainingGoldenTickets / unvalidatedCount;
        const probability = baseProbability / 2;
        
        // Use ticket ID as seed for consistent random check
        const ticketSeed = parseInt(topTicket.id.slice(-8), 16) % 10000;
        const random = (ticketSeed * 9301 + 49297) % 233280;
        const randomValue = random / 233280;
        
        // Check if this ticket would have won randomly too
        if (randomValue < probability) {
          isDoubleGolden = true;
          console.log(`🌈 DOUBLE GOLDEN DETECTED! Ticket ${topTicket.id} is both most voted AND would have won randomly!`);
        }
      }

      // Remove golden status from all other tickets for this event
      if (currentGoldenTickets.length > 0) {
        await db
          .update(tickets)
          .set({ isGoldenTicket: false, isDoubleGolden: false })
          .where(and(
            eq(tickets.eventId, eventId),
            eq(tickets.isGoldenTicket, true)
          ));
      }

      // Assign golden status (and double golden if applicable) to the most voted ticket
      await db
        .update(tickets)
        .set({ 
          isGoldenTicket: true,
          isDoubleGolden: isDoubleGolden
        })
        .where(eq(tickets.id, topTicket.id));
      
      if (isDoubleGolden) {
        console.log(`🌈 DOUBLE GOLDEN TICKET! Ticket ${topTicket.id} has ${topTicket.voteCount} votes and won the random lottery too!`);
      } else {
        console.log(`🗳️ GOLDEN TICKET REASSIGNED! Ticket ${topTicket.id} now golden with ${topTicket.voteCount} votes`);
      }
    }
  }

  // Validation Sessions (in-memory for temporary tokens)
  async createValidationSession(ticketId: string, lat?: number, lng?: number): Promise<{ token: string; expiresAt: Date }> {
    const expiresAt = new Date(Date.now() + 3 * 60 * 1000); // 3 minutes from now
    const session: ValidationSession = {
      ticketId,
      expiresAt,
      tokens: new Set(),
      codes: new Map(),
      ticketHolderLat: lat,
      ticketHolderLng: lng,
    };
    this.validationSessions.set(ticketId, session);
    
    // Create initial token
    const tokenData = await this.createValidationToken(ticketId);
    return { token: tokenData.token, expiresAt };
  }

  async createValidationToken(ticketId: string): Promise<{ token: string; code: string }> {
    const session = this.validationSessions.get(ticketId);
    if (!session || session.expiresAt < new Date()) {
      throw new Error("Validation session expired or not found");
    }

    // Generate unique token for this rotation
    const token = `VAL-${randomUUID()}-${Date.now()}`;
    session.tokens.add(token);
    this.validationTokens.set(token, ticketId);
    
    // Get the ticket to find its event
    const ticket = await this.getTicket(ticketId);
    if (!ticket) {
      throw new Error("Ticket not found");
    }
    
    // Generate a unique 4-digit code using the code pool manager
    const code = generateValidationCode(ticket.eventId);
    
    const now = Date.now();
    
    // Clean up old codes (older than 15 seconds)
    for (const [oldCode, timestamp] of Array.from(session.codes.entries())) {
      if (now - timestamp > 15000) {
        session.codes.delete(oldCode);
        this.validationCodes.delete(oldCode);
      }
    }
    
    // Store new code
    session.codes.set(code, now);
    this.validationCodes.set(code, ticketId);
    
    // Clean up tokens and codes after a delay (keep them valid for 15 seconds to handle network delays)
    setTimeout(() => {
      this.validationTokens.delete(token);
      session.tokens.delete(token);
      session.codes.delete(code);
      this.validationCodes.delete(code);
    }, 15000);
    
    return { token, code };
  }

  async validateDynamicToken(token: string, validatorId?: string): Promise<{ valid: boolean; ticketId?: string }> {
    let ticketId: string | undefined;
    
    // Check if it's a 4-digit code
    if (/^\d{4}$/.test(token)) {
      ticketId = this.validationCodes.get(token);
    } else {
      ticketId = this.validationTokens.get(token);
    }
    
    if (!ticketId) {
      return { valid: false };
    }

    const session = this.validationSessions.get(ticketId);
    if (!session || session.expiresAt < new Date()) {
      return { valid: false };
    }

    const ticket = await this.getTicket(ticketId);
    if (!ticket) {
      return { valid: false };
    }
    
    // Get event to check reentry settings
    const event = await this.getEvent(ticket.eventId);
    if (!event) {
      return { valid: false };
    }
    
    // Check if ticket can be validated based on reentry settings
    const useCount = ticket.useCount || 0;
    if (event.reentryType === 'No Reentry (Single Use)' && useCount >= 1) {
      return { valid: false }; // Already used once
    } else if (event.reentryType === 'Pass (Multiple Use)' && useCount >= (event.maxUses || 1)) {
      return { valid: false }; // Reached max uses
    }
    // No Limit tickets can always be re-validated

    // Mark ticket as validated with the code used
    await this.validateTicket(ticketId, token, validatorId);
    
    // Clean up session
    this.validationSessions.delete(ticketId);
    Array.from(session.tokens).forEach(sessionToken => {
      this.validationTokens.delete(sessionToken);
    });
    Array.from(session.codes.keys()).forEach(code => {
      this.validationCodes.delete(code);
    });

    return { valid: true, ticketId };
  }

  async checkDynamicToken(token: string): Promise<{ valid: boolean; ticketId?: string; ticketHolderLat?: number; ticketHolderLng?: number }> {
    // First check if it's a 4-digit code
    if (/^\d{4}$/.test(token)) {
      const ticketId = this.validationCodes.get(token);
      if (!ticketId) {
        return { valid: false };
      }
      
      const session = this.validationSessions.get(ticketId);
      if (!session || session.expiresAt < new Date()) {
        return { valid: false };
      }
      
      const ticket = await this.getTicket(ticketId);
      if (!ticket) {
        return { valid: false };
      }
      
      return { 
        valid: true, 
        ticketId, 
        ticketHolderLat: session.ticketHolderLat,
        ticketHolderLng: session.ticketHolderLng
      };
    }
    
    // Otherwise check as normal token
    const ticketId = this.validationTokens.get(token);
    if (!ticketId) {
      return { valid: false };
    }

    const session = this.validationSessions.get(ticketId);
    if (!session || session.expiresAt < new Date()) {
      return { valid: false };
    }

    const ticket = await this.getTicket(ticketId);
    if (!ticket) {
      return { valid: false };
    }

    // Just check validity without marking as validated
    return { 
      valid: true, 
      ticketId,
      ticketHolderLat: session.ticketHolderLat,
      ticketHolderLng: session.ticketHolderLng
    };
  }

  // Delegated Validators
  async getDelegatedValidatorsByEvent(eventId: string): Promise<DelegatedValidator[]> {
    return await db
      .select()
      .from(delegatedValidators)
      .where(eq(delegatedValidators.eventId, eventId));
  }

  async canUserValidateForEvent(userId: string, email: string, eventId: string): Promise<boolean> {
    // Check if user is the event owner
    const event = await this.getEvent(eventId);
    if (event?.userId === userId) {
      return true;
    }

    // Check if user is a delegated validator
    const [validator] = await db
      .select()
      .from(delegatedValidators)
      .where(and(
        eq(delegatedValidators.eventId, eventId),
        eq(delegatedValidators.email, email)
      ));
    
    if (validator) {
      return true;
    }

    // Check if event has P2P validation enabled and user has a ticket for this event
    if (event?.p2pValidation) {
      const [userTicket] = await db
        .select()
        .from(tickets)
        .where(and(
          eq(tickets.eventId, eventId),
          eq(tickets.userId, userId)
        ))
        .limit(1);
      
      return !!userTicket;
    }
    
    return false;
  }

  async addDelegatedValidator(validator: InsertDelegatedValidator): Promise<DelegatedValidator> {
    const [newValidator] = await db
      .insert(delegatedValidators)
      .values(validator)
      .returning();
    return newValidator;
  }

  async removeDelegatedValidator(id: string): Promise<boolean> {
    const result = await db
      .delete(delegatedValidators)
      .where(eq(delegatedValidators.id, id));
    return true;
  }

  async getEventStats(): Promise<{
    totalEvents: number;
    totalTickets: number;
    validatedTickets: number;
  }> {
    // These stats automatically reflect only active events within the 69-day retention period
    // Archived events are moved to the archivedEvents table and not counted here
    const [eventResult] = await db
      .select({ count: db.$count(events) })
      .from(events);
    
    // Count tickets created in the last 48 hours from the most recent ticket
    // Using SQL to handle the date calculation directly in the database
    const recentTicketsQuery = await db.execute(
      sql`SELECT COUNT(*) as count FROM ${tickets} WHERE ${tickets.createdAt} >= (SELECT MAX(${tickets.createdAt}) - INTERVAL '48 hours' FROM ${tickets})`
    );
    const recentTicketCount = Number(recentTicketsQuery.rows[0]?.count) || 0;
    
    // Count unique users who have tickets (active attendees)
    const [uniqueUsersResult] = await db
      .select({ 
        count: sql<number>`COUNT(DISTINCT ${tickets.userId})` 
      })
      .from(tickets)
      .where(isNotNull(tickets.userId));

    return {
      totalEvents: eventResult?.count || 0,
      totalTickets: recentTicketCount, // Now shows tickets from last 48 hours
      validatedTickets: Number(uniqueUsersResult?.count) || 0, // Active attendees count
    };
  }

  async getUserValidatedTicketsCount(userId: string): Promise<number> {
    // Count validation actions performed by this user
    const [result] = await db
      .select({ count: db.$count(validationActions) })
      .from(validationActions)
      .where(eq(validationActions.validatorId, userId));

    return result?.count || 0;
  }

  async getUserSecretCodesCount(userId: string): Promise<number> {
    // Count secret codes redeemed by this user
    const [result] = await db
      .select({ count: count() })
      .from(codeRedemptions)
      .where(eq(codeRedemptions.userId, userId));

    return result?.count || 0;
  }

  async getSystemLogs(params: {
    limit?: number;
    offset?: number;
    severity?: string;
    search?: string;
  }): Promise<SystemLog[]> {
    const { limit = 100, offset = 0, severity, search } = params;
    
    let query = db.select().from(systemLogs);
    
    // Add filtering if needed
    // For now, return all logs with limit and offset
    const logs = await query
      .orderBy(desc(systemLogs.createdAt))
      .limit(limit)
      .offset(offset);
    
    return logs;
  }

  // Archive Management
  async archiveEvent(eventId: string): Promise<boolean> {
    try {
      // Get the event details
      const event = await this.getEvent(eventId);
      if (!event) {
        console.log(`[ARCHIVE] Event ${eventId} not found - may have been already deleted`);
        return true; // Return true since there's nothing to archive
      }
      if (!event.userId) {
        console.log(`[ARCHIVE] Event ${eventId} has no userId - skipping`);
        return true; // Return true to avoid retrying
      }

      // Get all tickets for this event
      const eventTickets = await this.getTicketsByEventId(eventId);
      
      // Note: NFT-minted tickets are already preserved in the Registry table
      // The Registry contains all the ticket metadata flattened into its own record
      // So we can safely archive/delete the original event and tickets
      
      // Calculate total tickets sold and revenue
      const totalTicketsSold = eventTickets.length;
      const totalRevenue = totalTicketsSold * parseFloat(event.ticketPrice.toString());

      // Create CSV data for the event owner
      const eventCsvData = [
        event.name,
        event.venue,
        event.date,
        event.time,
        event.endDate || '',
        event.endTime || '',
        event.ticketPrice,
        totalTicketsSold,
        totalRevenue
      ].join(',');

      // Archive the event for the owner (if they exist)
      if (event.userId) {
        await db.insert(archivedEvents).values({
          userId: event.userId,
          originalEventId: eventId,
          csvData: eventCsvData,
          eventName: event.name,
          eventDate: event.date,
          totalTicketsSold,
          totalRevenue: totalRevenue.toFixed(2),
        });
      }

      // Return unvalidated capacity tickets to event owner (but NOT payment processing fees)
      const validatedTickets = eventTickets.filter(ticket => ticket.isValidated);
      const unvalidatedCount = eventTickets.length - validatedTickets.length;
      
      if (event.userId && event.maxTickets && unvalidatedCount > 0) {
        // Calculate tickets to return: unvalidated capacity tickets only
        // Do NOT return the payment processing fee
        const ticketsToReturn = Math.min(unvalidatedCount, event.maxTickets || 0);
        
        if (ticketsToReturn > 0) {
          try {
            // Return tickets to event owner
            await this.updateUserBalance(event.userId, ticketsToReturn);
            console.log(`[ARCHIVE] Returned ${ticketsToReturn} unvalidated capacity tickets to event owner ${event.userId} (payment fee of ${event.paymentProcessingFee || 0} tickets not returned)`);
          } catch (error) {
            console.error(`[ARCHIVE] Failed to return tickets to event owner ${event.userId}:`, error);
          }
        }
      }
      
      // Process refunds for unvalidated tickets before archiving
      const unvalidatedTickets = eventTickets.filter(ticket => !ticket.isValidated);
      if (unvalidatedTickets.length > 0) {
        console.log(`[ARCHIVE] Processing ${unvalidatedTickets.length} refunds for unvalidated tickets`);
        
        // Group unvalidated tickets by user for batch refunds
        const refundsByUser = new Map<string, number>();
        for (const ticket of unvalidatedTickets) {
          if (ticket.userId && ticket.purchasePrice) {
            const price = parseFloat(ticket.purchasePrice);
            if (price > 0) {
              const currentTotal = refundsByUser.get(ticket.userId) || 0;
              refundsByUser.set(ticket.userId, currentTotal + price);
            }
          }
        }
        
        // Process refunds for each user
        for (const [userId, refundAmount] of Array.from(refundsByUser.entries())) {
          try {
            // Currency account should exist from initial purchase
            
            // Create refund transaction
            await this.createLedgerTransaction({
              transactionType: 'TICKET_REFUND',
              description: `Refund for unvalidated tickets - Event: ${event.name} (archived)`,
              debits: [{ accountId: 'system_revenue', accountType: 'system', amount: refundAmount }],
              credits: [{ accountId: userId, accountType: 'user', amount: refundAmount }],
              metadata: {
                eventId: event.id,
                eventName: event.name,
                reason: 'event_archived',
                ticketCount: unvalidatedTickets.filter(t => t.userId === userId).length,
              },
              relatedEntityId: eventId,
              relatedEntityType: 'event',
              createdBy: 'system',
            });
            
            console.log(`[ARCHIVE] Refunded ${refundAmount} Tickets to user ${userId} for event ${event.name}`);
          } catch (error) {
            console.error(`[ARCHIVE] Failed to refund user ${userId}:`, error);
          }
        }
      }

      // Archive the event for each ticket holder (attendees)
      // Get unique user IDs to avoid duplicate entries
      const attendeeUserIds = new Set<string>();
      for (const ticket of eventTickets) {
        if (ticket.userId && ticket.userId !== event.userId) {
          attendeeUserIds.add(ticket.userId);
        }
      }

      // Create archive record for each attendee
      for (const attendeeUserId of Array.from(attendeeUserIds)) {
        // Create a simplified CSV for attendees (they don't need revenue info)
        const attendeeCsvData = [
          event.name,
          event.venue,
          event.date,
          event.time,
          event.endDate || '',
          event.endTime || '',
          event.ticketPrice,
          0, // attendees don't see total tickets sold
          0  // attendees don't see revenue
        ].join(',');

        await db.insert(archivedEvents).values({
          userId: attendeeUserId,
          originalEventId: eventId,
          csvData: attendeeCsvData,
          eventName: event.name,
          eventDate: event.date,
          totalTicketsSold: 0, // Not relevant for attendees
          totalRevenue: "0",   // Not relevant for attendees
        });
      }

      // Delete payment intents (following 69-day retention policy)
      await db.delete(cryptoPaymentIntents).where(eq(cryptoPaymentIntents.eventId, eventId));
      
      // Delete the tickets
      await db.delete(tickets).where(eq(tickets.eventId, eventId));
      
      // Delete delegated validators
      await db.delete(delegatedValidators).where(eq(delegatedValidators.eventId, eventId));
      
      // Delete the event
      await db.delete(events).where(eq(events.id, eventId));

      console.log(`[ARCHIVE] Successfully archived and deleted event ${eventId}`);
      return true;
    } catch (error) {
      console.error(`[ARCHIVE] Error archiving event ${eventId}:`, error);
      // If the error is because the event doesn't exist, consider it successful
      if (error instanceof Error && error.message.includes('does not exist')) {
        return true;
      }
      return false;
    }
  }

  async getArchivedEventsByUser(userId: string): Promise<ArchivedEvent[]> {
    return db
      .select()
      .from(archivedEvents)
      .where(eq(archivedEvents.userId, userId))
      .orderBy(desc(archivedEvents.archivedAt));
  }

  async cleanupOldArchives(): Promise<void> {
    try {
      // Delete archive records older than 1 year
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
      
      const result = await db
        .delete(archivedEvents)
        .where(sql`archived_at < ${oneYearAgo.toISOString()}`)
        .returning();
      
      if (result.length > 0) {
        console.log(`[ARCHIVE] Cleaned up ${result.length} archive records older than 1 year`);
      }
    } catch (error) {
      console.error('[ARCHIVE] Error cleaning up old archives:', error);
    }
  }

  async performScheduledArchiving(): Promise<void> {
    try {
      console.log('[ARCHIVE] Starting scheduled event archiving...');
      
      // Get events that need archiving
      const eventsToArchive = await this.getEventsToArchive();
      
      if (eventsToArchive.length === 0) {
        console.log('[ARCHIVE] No events to archive at this time');
      } else {
        let successCount = 0;
        let failCount = 0;
        
        // Archive each event
        for (const event of eventsToArchive) {
          const success = await this.archiveEvent(event.id);
          if (success) {
            successCount++;
            console.log(`[ARCHIVE] Successfully archived event: ${event.name} (${event.id})`);
          } else {
            failCount++;
            console.log(`[ARCHIVE] Failed to archive event: ${event.name} (${event.id})`);
          }
        }
        
        console.log(`[ARCHIVE] Archiving complete. Success: ${successCount}, Failed: ${failCount}`);
      }
      
      // Also clean up archive records older than 1 year
      await this.cleanupOldArchives();
      
    } catch (error) {
      console.error('[ARCHIVE] Error during scheduled archiving:', error);
    }
  }

  async getEventsToArchive(): Promise<Event[]> {
    // Get all events
    const allEvents = await db.select().from(events);
    
    // Filter events that should be archived (69 days after end date or start date)
    const now = new Date();
    const sixtyNineDaysMs = 69 * 24 * 60 * 60 * 1000;
    
    const eventsToArchive = [];
    
    for (const event of allEvents) {
      // Use end date if available, otherwise use start date
      const eventDateStr = event.endDate || event.date;
      const eventDate = new Date(eventDateStr);
      
      // Check if 69 days have passed
      const timeDiff = now.getTime() - eventDate.getTime();
      if (timeDiff < sixtyNineDaysMs) {
        continue;
      }
      
      
      // Events with NFT-minted tickets can be archived
      // The Registry table already preserves the ticket metadata permanently
      // No need to check for NFTs - they're already preserved in Registry
      
      // This event is eligible for archiving
      eventsToArchive.push(event);
    }
    
    return eventsToArchive;
  }

  // Registry Management
  async createRegistryRecord(record: InsertRegistryRecord): Promise<RegistryRecord> {
    const [newRecord] = await db.insert(registryRecords).values(record).returning();
    return newRecord;
  }

  async getRegistryRecord(id: string): Promise<RegistryRecord | undefined> {
    const [record] = await db.select().from(registryRecords).where(eq(registryRecords.id, id));
    return record || undefined;
  }

  async getRegistryRecordByTicket(ticketId: string): Promise<RegistryRecord | undefined> {
    const [record] = await db.select().from(registryRecords).where(eq(registryRecords.ticketId, ticketId));
    return record || undefined;
  }

  async getRegistryRecordsByUser(userId: string): Promise<RegistryRecord[]> {
    return db
      .select()
      .from(registryRecords)
      .where(eq(registryRecords.ownerId, userId))
      .orderBy(desc(registryRecords.mintedAt));
  }

  async getAllRegistryRecords(): Promise<RegistryRecord[]> {
    return db
      .select()
      .from(registryRecords)
      .orderBy(desc(registryRecords.mintedAt));
  }
  
  async getUnsyncedRegistryRecords(): Promise<RegistryRecord[]> {
    return db
      .select()
      .from(registryRecords)
      .where(eq(registryRecords.synced, false))
      .orderBy(asc(registryRecords.mintedAt));
  }
  
  async markRegistryRecordsSynced(recordIds: string[]): Promise<void> {
    if (recordIds.length === 0) return;
    
    await db
      .update(registryRecords)
      .set({ 
        synced: true,
        syncedAt: new Date()
      })
      .where(inArray(registryRecords.id, recordIds));
  }

  async canMintTicket(ticketId: string): Promise<boolean> {
    // Check if ticket exists and has been validated
    const ticket = await this.getTicket(ticketId);
    if (!ticket || !ticket.isValidated || !ticket.validatedAt) {
      return false;
    }

    // Check if already minted
    const existingRecord = await this.getRegistryRecordByTicket(ticketId);
    if (existingRecord) {
      return false;
    }

    // Get event to check if minting is allowed and if it's private
    const event = await this.getEvent(ticket.eventId);
    if (!event || !event.allowMinting || event.isPrivate) {
      return false;
    }

    // Allow minting immediately after validation
    // (tickets can be minted until the event is deleted)
    return true;
  }

  async updateTicketNftMediaUrl(ticketId: string, mediaUrl: string): Promise<Ticket | undefined> {
    const [updatedTicket] = await db
      .update(tickets)
      .set({ nftMediaUrl: mediaUrl })
      .where(eq(tickets.id, ticketId))
      .returning();
    return updatedTicket || undefined;
  }

  async createRegistryTransaction(transaction: InsertRegistryTransaction): Promise<RegistryTransaction> {
    const [newTransaction] = await db.insert(registryTransactions).values(transaction).returning();
    return newTransaction;
  }

  async updateRegistryLastAccessed(id: string): Promise<void> {
    await db
      .update(registryRecords)
      .set({ lastAccessed: new Date() })
      .where(eq(registryRecords.id, id));
  }

  // Featured Events Management
  async getActiveFeaturedEvents(): Promise<FeaturedEvent[]> {
    const now = new Date();
    return db
      .select()
      .from(featuredEvents)
      .where(gt(featuredEvents.endTime, now))
      .orderBy(featuredEvents.position);
  }

  async getFeaturedEventsWithDetails(): Promise<(FeaturedEvent & { event: Event } & { isPaid: boolean })[]> {
    const now = new Date();
    
    // Get paid featured events
    const paidResults = await db
      .select({
        id: featuredEvents.id,
        eventId: featuredEvents.eventId,
        duration: featuredEvents.duration,
        startTime: featuredEvents.startTime,
        endTime: featuredEvents.endTime,
        pricePaid: featuredEvents.pricePaid,
        isBumped: featuredEvents.isBumped,
        position: featuredEvents.position,
        createdAt: featuredEvents.createdAt,
        event: events
      })
      .from(featuredEvents)
      .innerJoin(events, eq(featuredEvents.eventId, events.id))
      .where(gt(featuredEvents.endTime, now))
      .orderBy(featuredEvents.position);
    
    const paidEvents = paidResults.map(row => ({
      ...row,
      event: row.event,
      isPaid: true
    }));

    // If we have enough paid events, return them
    if (paidEvents.length >= 100) {
      return paidEvents.slice(0, 100);
    }

    // Get random events to fill remaining slots (excluding already featured ones and past events)
    const featuredEventIds = paidEvents.map(fe => fe.eventId);
    const randomEventsNeeded = 100 - paidEvents.length;
    
    // Build where conditions for random events
    const whereConditions = [];
    
    // Exclude already featured events
    if (featuredEventIds.length > 0) {
      whereConditions.push(notInArray(events.id, featuredEventIds));
    }
    
    // Exclude past events (events that have already started)
    whereConditions.push(gte(events.date, new Date().toISOString().split('T')[0]));
    
    // Exclude private events
    whereConditions.push(eq(events.isPrivate, false));
    
    const randomEvents = await db
      .select()
      .from(events)
      .where(whereConditions.length > 0 ? and(...whereConditions) : undefined)
      .orderBy(sql`RANDOM()`)
      .limit(randomEventsNeeded);

    // Convert random events to featured event format
    const randomFeaturedEvents = randomEvents.map((event, index) => ({
      id: `random-${event.id}`,
      eventId: event.id,
      duration: "24h" as const,
      startTime: now,
      endTime: new Date(now.getTime() + 24 * 60 * 60 * 1000),
      pricePaid: "0",
      isBumped: false,
      position: paidEvents.length + index + 1,
      createdAt: now,
      event: event,
      isPaid: false
    }));

    // Combine and create alternating pattern: newest paid first, then alternate
    const allEvents = [...paidEvents, ...randomFeaturedEvents];
    
    // Sort paid events by newest first (position 1 is newest/most expensive)
    const sortedPaidEvents = paidEvents.sort((a, b) => a.position - b.position);
    const randomEventsList = randomFeaturedEvents;
    
    // Create alternating pattern: paid, random, paid, random...
    const alternatingEvents: (typeof allEvents)[0][] = [];
    const maxEvents = Math.max(sortedPaidEvents.length, randomEventsList.length);
    
    for (let i = 0; i < maxEvents; i++) {
      if (i < sortedPaidEvents.length) {
        alternatingEvents.push(sortedPaidEvents[i]);
      }
      if (i < randomEventsList.length) {
        alternatingEvents.push(randomEventsList[i]);
      }
    }

    return alternatingEvents;
  }

  async createFeaturedEvent(featuredEvent: InsertFeaturedEvent): Promise<FeaturedEvent> {
    const [newFeaturedEvent] = await db.insert(featuredEvents).values(featuredEvent).returning();
    return newFeaturedEvent;
  }

  getBoostPrice(count: number): number {
    // Exponential pricing from $0.02 to $69.69 over 100 slots
    // Formula: 0.02 * (1.0876)^count
    const basePrice = 0.02;
    const growthRate = 1.0876; // Calculated to reach $69.69 at slot 99
    const price = basePrice * Math.pow(growthRate, count);
    
    // Cap at $69.69 maximum
    return Math.min(price, 69.69);
  }

  async getFeaturedEventCount(): Promise<number> {
    const now = new Date();
    const [result] = await db
      .select({ count: count() })
      .from(featuredEvents)
      .where(gt(featuredEvents.endTime, now));
    return result?.count || 0;
  }

  async canBoostEvent(eventId: string): Promise<boolean> {
    // Check if event is not already featured
    const now = new Date();
    const [existing] = await db
      .select()
      .from(featuredEvents)
      .where(and(eq(featuredEvents.eventId, eventId), gt(featuredEvents.endTime, now)));
    
    return !existing;
  }

  async canUserBoostEvent(userId: string, eventId: string): Promise<boolean> {
    // Check if event exists
    const event = await this.getEvent(eventId);
    if (!event) {
      return false;
    }

    // Private events cannot be boosted
    if (event.isPrivate) {
      return false;
    }

    // Check if user is the event owner
    if (event.userId === userId) {
      return true;
    }

    // Check if user has a ticket for this event
    const [userTicket] = await db
      .select()
      .from(tickets)
      .where(and(
        eq(tickets.eventId, eventId),
        eq(tickets.userId, userId)
      ))
      .limit(1);
    
    return !!userTicket;
  }

  async getNextAvailablePosition(): Promise<number | null> {
    const activeFeatured = await this.getActiveFeaturedEvents();
    
    // If less than 100 slots used, return next position
    if (activeFeatured.length < 100) {
      const usedPositions = new Set(activeFeatured.map(f => f.position));
      for (let i = 1; i <= 100; i++) {
        if (!usedPositions.has(i)) {
          return i;
        }
      }
    }
    
    return null; // All 100 slots taken
  }

  async shiftFeaturedPositionsDown(): Promise<void> {
    // Shift all existing featured events' positions down by 1
    const now = new Date();
    await db
      .update(featuredEvents)
      .set({ position: sql`${featuredEvents.position} + 1` })
      .where(gt(featuredEvents.endTime, now));
  }

  async cleanupExpiredFeaturedEvents(): Promise<void> {
    const now = new Date();
    await db.delete(featuredEvents).where(lt(featuredEvents.endTime, now));
  }

  async getEventsPaginated(page: number, limit: number): Promise<Event[]> {
    const offset = (page - 1) * limit;
    return db
      .select()
      .from(events)
      .orderBy(desc(events.createdAt))
      .limit(limit)
      .offset(offset);
  }

  async getTotalEventsCount(): Promise<number> {
    const [result] = await db.select({ count: count() }).from(events);
    return result?.count || 0;
  }

  // Admin Operations
  async getAllEventsForAdmin(): Promise<Event[]> {
    const eventsList = await db
      .select({
        event: events,
        ticketsSold: count(tickets.id)
      })
      .from(events)
      .leftJoin(tickets, eq(tickets.eventId, events.id))
      .groupBy(events.id)
      .orderBy(desc(events.createdAt));
    
    return eventsList.map(({ event, ticketsSold }) => ({
      ...event,
      ticketsSold
    }));
  }

  async updateEventVisibility(eventId: string, field: "isEnabled" | "ticketPurchasesEnabled", value: boolean): Promise<Event | undefined> {
    const [updatedEvent] = await db
      .update(events)
      .set({ [field]: value })
      .where(eq(events.id, eventId))
      .returning();
    return updatedEvent;
  }

  // Roles and Permissions
  async createRole(role: InsertRole): Promise<Role> {
    const [newRole] = await db.insert(roles).values(role).returning();
    return newRole;
  }

  async getRoles(): Promise<Role[]> {
    return await db.select().from(roles).orderBy(roles.name);
  }

  async getRoleByName(name: string): Promise<Role | undefined> {
    const [role] = await db.select().from(roles).where(eq(roles.name, name));
    return role;
  }

  async createPermission(permission: InsertPermission): Promise<Permission> {
    const [newPermission] = await db.insert(permissions).values(permission).returning();
    return newPermission;
  }

  async getPermissions(): Promise<Permission[]> {
    return await db.select().from(permissions).orderBy(permissions.category, permissions.name);
  }

  async assignRolePermission(roleId: string, permissionId: string): Promise<RolePermission> {
    const [assignment] = await db
      .insert(rolePermissions)
      .values({ roleId, permissionId })
      .onConflictDoNothing()
      .returning();
    return assignment;
  }

  async getRolePermissions(roleId: string): Promise<Permission[]> {
    const perms = await db
      .select({ permission: permissions })
      .from(rolePermissions)
      .innerJoin(permissions, eq(permissions.id, rolePermissions.permissionId))
      .where(eq(rolePermissions.roleId, roleId));
    return perms.map(p => p.permission);
  }

  async assignUserRole(userId: string, roleId: string, assignedBy?: string): Promise<UserRole> {
    const [assignment] = await db
      .insert(userRoles)
      .values({ userId, roleId, assignedBy })
      .onConflictDoNothing()
      .returning();
    return assignment;
  }

  async getUserRoles(userId: string): Promise<Role[]> {
    const userRolesList = await db
      .select({ role: roles })
      .from(userRoles)
      .innerJoin(roles, eq(roles.id, userRoles.roleId))
      .where(eq(userRoles.userId, userId));
    return userRolesList.map(ur => ur.role);
  }

  async getUserPermissions(userId: string): Promise<Permission[]> {
    // Get all permissions from all user's roles
    const perms = await db
      .select({ permission: permissions })
      .from(userRoles)
      .innerJoin(rolePermissions, eq(rolePermissions.roleId, userRoles.roleId))
      .innerJoin(permissions, eq(permissions.id, rolePermissions.permissionId))
      .where(eq(userRoles.userId, userId));
    
    // Remove duplicates
    const uniquePerms = new Map<string, Permission>();
    perms.forEach(p => uniquePerms.set(p.permission.id, p.permission));
    return Array.from(uniquePerms.values());
  }

  async hasPermission(userId: string, permissionName: string): Promise<boolean> {
    const [result] = await db
      .select({ count: count() })
      .from(userRoles)
      .innerJoin(rolePermissions, eq(rolePermissions.roleId, userRoles.roleId))
      .innerJoin(permissions, eq(permissions.id, rolePermissions.permissionId))
      .where(and(
        eq(userRoles.userId, userId),
        eq(permissions.name, permissionName)
      ));
    return (result?.count || 0) > 0;
  }

  async removeUserRole(userId: string, roleId: string): Promise<void> {
    await db
      .delete(userRoles)
      .where(and(
        eq(userRoles.userId, userId),
        eq(userRoles.roleId, roleId)
      ));
  }

  async initializeRolesAndPermissions(): Promise<void> {
    // Check if roles already exist
    const existingRoles = await this.getRoles();
    if (existingRoles.length > 0) {
      return; // Already initialized
    }

    // Create default roles
    const superAdminRole = await this.createRole({
      name: 'super_admin',
      displayName: 'Super Admin',
      description: 'Full system access with all permissions'
    });

    const eventModeratorRole = await this.createRole({
      name: 'event_moderator',
      displayName: 'Event Moderator',
      description: 'Can manage events and view event analytics'
    });

    const supportRole = await this.createRole({
      name: 'support',
      displayName: 'Support',
      description: 'Can view analytics and help users'
    });

    const userRole = await this.createRole({
      name: 'user',
      displayName: 'User',
      description: 'Standard user with basic permissions'
    });

    // Create permissions
    const manageEvents = await this.createPermission({
      name: 'manage_events',
      displayName: 'Manage Events',
      description: 'Can enable/disable events and manage event settings',
      category: 'events'
    });

    const manageUsers = await this.createPermission({
      name: 'manage_users',
      displayName: 'Manage Users',
      description: 'Can manage user accounts and roles',
      category: 'users'
    });

    const manageSettings = await this.createPermission({
      name: 'manage_settings',
      displayName: 'Manage Settings',
      description: 'Can change system settings and configuration',
      category: 'settings'
    });

    const viewAnalytics = await this.createPermission({
      name: 'view_analytics',
      displayName: 'View Analytics',
      description: 'Can view system analytics and reports',
      category: 'analytics'
    });

    const managePayments = await this.createPermission({
      name: 'manage_payments',
      displayName: 'Manage Payments',
      description: 'Can configure payment settings and view transactions',
      category: 'payments'
    });

    // Assign permissions to roles
    // Super Admin gets all permissions
    await this.assignRolePermission(superAdminRole.id, manageEvents.id);
    await this.assignRolePermission(superAdminRole.id, manageUsers.id);
    await this.assignRolePermission(superAdminRole.id, manageSettings.id);
    await this.assignRolePermission(superAdminRole.id, viewAnalytics.id);
    await this.assignRolePermission(superAdminRole.id, managePayments.id);

    // Event Moderator gets event and analytics permissions
    await this.assignRolePermission(eventModeratorRole.id, manageEvents.id);
    await this.assignRolePermission(eventModeratorRole.id, viewAnalytics.id);

    // Support gets view analytics
    await this.assignRolePermission(supportRole.id, viewAnalytics.id);

    // User role has no special permissions
  }

  async migrateExistingAdmins(): Promise<void> {
    // Get admin emails from environment variable
    const adminEmails = process.env.ADMIN_EMAILS?.split(',').map(e => e.trim().toLowerCase()) || [];
    
    // Find all users with @saymservices.com email OR in the ADMIN_EMAILS environment variable
    const adminUsers = await db
      .select()
      .from(users)
      .where(sql`${users.email} LIKE '%@saymservices.com'`);
    
    // Also find users specified in ADMIN_EMAILS
    if (adminEmails.length > 0) {
      for (const adminEmail of adminEmails) {
        const user = await db
          .select()
          .from(users)
          .where(eq(users.email, adminEmail))
          .limit(1);
        
        if (user.length > 0 && !adminUsers.some(u => u.id === user[0].id)) {
          adminUsers.push(user[0]);
        }
      }
    }

    if (adminUsers.length === 0) {
      return; // No admins to migrate
    }

    // Get the super_admin role
    const superAdminRole = await this.getRoleByName('super_admin');
    if (!superAdminRole) {
      // Initialize roles first if they don't exist
      await this.initializeRolesAndPermissions();
      const role = await this.getRoleByName('super_admin');
      if (!role) return;
      
      // Assign super_admin role to all admin users
      for (const user of adminUsers) {
        await this.assignUserRole(user.id, role.id);
        const source = adminEmails.includes(user.email?.toLowerCase() || '') ? 'ADMIN_EMAILS env var' : '@saymservices.com domain';
        console.log(`[ADMIN] Migrated admin user ${user.email} to super_admin role (source: ${source})`);
      }
    } else {
      // Assign super_admin role to all admin users
      for (const user of adminUsers) {
        // Check if user already has the role
        const userRoles = await this.getUserRoles(user.id);
        const hasRole = userRoles.some(r => r.id === superAdminRole.id);
        
        if (!hasRole) {
          await this.assignUserRole(user.id, superAdminRole.id);
          const source = adminEmails.includes(user.email?.toLowerCase() || '') ? 'ADMIN_EMAILS env var' : '@saymservices.com domain';
          console.log(`[ADMIN] Migrated admin user ${user.email} to super_admin role (source: ${source})`);
        }
      }
    }
    
    // Log if ADMIN_EMAILS is configured
    if (adminEmails.length > 0) {
      console.log(`[ADMIN] ADMIN_EMAILS environment variable configured with ${adminEmails.length} email(s)`);
    }
  }


  // Notifications
  async getNotifications(userId: string): Promise<Notification[]> {
    const notificationList = await db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt))
      .limit(100);
    return notificationList;
  }

  async createNotification(notification: InsertNotification): Promise<Notification> {
    const [newNotification] = await db.insert(notifications).values(notification).returning();
    return newNotification;
  }

  async markNotificationAsRead(id: string): Promise<Notification | undefined> {
    const [notification] = await db
      .update(notifications)
      .set({ isRead: true })
      .where(eq(notifications.id, id))
      .returning();
    return notification || undefined;
  }

  async markAllNotificationsAsRead(userId: string): Promise<void> {
    await db
      .update(notifications)
      .set({ isRead: true })
      .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));
  }

  async getNotificationPreferences(userId: string): Promise<NotificationPreferences | undefined> {
    const [prefs] = await db
      .select()
      .from(notificationPreferences)
      .where(eq(notificationPreferences.userId, userId));
    
    if (!prefs) {
      // Create default preferences if none exist
      const [newPrefs] = await db
        .insert(notificationPreferences)
        .values({ userId })
        .returning();
      return newPrefs;
    }
    
    return prefs;
  }

  async updateNotificationPreferences(userId: string, preferences: Partial<InsertNotificationPreferences>): Promise<NotificationPreferences> {
    const [updatedPrefs] = await db
      .update(notificationPreferences)
      .set({ ...preferences, updatedAt: new Date() })
      .where(eq(notificationPreferences.userId, userId))
      .returning();
    
    if (!updatedPrefs) {
      // Create if doesn't exist
      const [newPrefs] = await db
        .insert(notificationPreferences)
        .values({ userId, ...preferences })
        .returning();
      return newPrefs;
    }
    
    return updatedPrefs;
  }

  async expireOldNotifications(): Promise<void> {
    await db
      .delete(notifications)
      .where(lt(notifications.expiresAt, new Date()));
  }

  // Login Rate Limiting
  async recordLoginAttempt(attempt: InsertLoginAttempt): Promise<LoginAttempt> {
    const [loginAttempt] = await db
      .insert(loginAttempts)
      .values(attempt)
      .returning();
    return loginAttempt;
  }

  async getRecentLoginAttempts(email: string, minutes: number): Promise<LoginAttempt[]> {
    const cutoffTime = new Date(Date.now() - minutes * 60 * 1000);
    return await db
      .select()
      .from(loginAttempts)
      .where(and(
        eq(loginAttempts.email, email),
        gt(loginAttempts.attemptedAt, cutoffTime)
      ));
  }

  async getFailedLoginAttemptsFromIp(ipAddress: string, minutes: number): Promise<LoginAttempt[]> {
    const cutoffTime = new Date(Date.now() - minutes * 60 * 1000);
    return await db
      .select()
      .from(loginAttempts)
      .where(and(
        eq(loginAttempts.ipAddress, ipAddress),
        eq(loginAttempts.success, false),
        gt(loginAttempts.attemptedAt, cutoffTime)
      ));
  }

  // IP Blocking
  async blockIp(ip: InsertBlockedIp): Promise<BlockedIp> {
    const [blocked] = await db
      .insert(blockedIps)
      .values(ip)
      .returning();
    return blocked;
  }

  async isIpBlocked(ipAddress: string): Promise<boolean> {
    const [blocked] = await db
      .select()
      .from(blockedIps)
      .where(and(
        eq(blockedIps.ipAddress, ipAddress),
        gt(blockedIps.unblockAt, new Date())
      ));
    return !!blocked;
  }

  async unblockExpiredIps(): Promise<void> {
    await db
      .delete(blockedIps)
      .where(lt(blockedIps.unblockAt, new Date()));
  }

  async getBlockedIp(ipAddress: string): Promise<BlockedIp | undefined> {
    const [blocked] = await db
      .select()
      .from(blockedIps)
      .where(and(
        eq(blockedIps.ipAddress, ipAddress),
        gt(blockedIps.unblockAt, new Date())
      ));
    return blocked || undefined;
  }

  // Auth Monitoring
  async recordAuthEvent(event: InsertAuthMonitoring): Promise<AuthMonitoring> {
    const [authEvent] = await db
      .insert(authMonitoring)
      .values(event)
      .returning();
    return authEvent;
  }

  async getAuthMetrics(hours: number): Promise<{
    totalLogins: number;
    failedLogins: number;
    rateLimitHits: number;
    uniqueUsers: number;
  }> {
    const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000);
    
    const results = await db
      .select({
        type: authMonitoring.type,
        count: count()
      })
      .from(authMonitoring)
      .where(gt(authMonitoring.createdAt, cutoffTime))
      .groupBy(authMonitoring.type);
    
    const uniqueUsersResult = await db
      .selectDistinct({ userId: authMonitoring.userId })
      .from(authMonitoring)
      .where(and(
        gt(authMonitoring.createdAt, cutoffTime),
        isNotNull(authMonitoring.userId)
      ));
    
    const metrics = {
      totalLogins: 0,
      failedLogins: 0,
      rateLimitHits: 0,
      uniqueUsers: uniqueUsersResult.length
    };
    
    for (const row of results) {
      switch (row.type) {
        case 'login_success':
          metrics.totalLogins = row.count;
          break;
        case 'login_failure':
          metrics.failedLogins = row.count;
          break;
        case 'rate_limit_hit':
          metrics.rateLimitHits = row.count;
          break;
      }
    }
    
    return metrics;
  }

  // Auth Queue
  async addToAuthQueue(item: InsertAuthQueue): Promise<AuthQueue> {
    // Get the next queue position
    const [maxPosition] = await db
      .select({ maxPos: sql`MAX(queue_position)` })
      .from(authQueue)
      .where(eq(authQueue.status, 'waiting'));
    
    const nextPosition = (maxPosition?.maxPos as number || 0) + 1;
    
    const [queueItem] = await db
      .insert(authQueue)
      .values({ ...item, queuePosition: nextPosition })
      .returning();
    return queueItem;
  }

  async getQueuePosition(email: string): Promise<number | null> {
    const [item] = await db
      .select()
      .from(authQueue)
      .where(and(
        eq(authQueue.email, email),
        eq(authQueue.status, 'waiting')
      ))
      .orderBy(desc(authQueue.createdAt));
    
    if (!item) return null;
    
    // Count how many are ahead in queue
    const [ahead] = await db
      .select({ count: count() })
      .from(authQueue)
      .where(and(
        eq(authQueue.status, 'waiting'),
        lt(authQueue.queuePosition, item.queuePosition)
      ));
    
    return ahead.count;
  }

  async processAuthQueue(): Promise<AuthQueue[]> {
    // Get next 5 items to process
    const items = await db
      .select()
      .from(authQueue)
      .where(eq(authQueue.status, 'waiting'))
      .orderBy(authQueue.queuePosition)
      .limit(5);
    
    // Mark them as processing
    for (const item of items) {
      await db
        .update(authQueue)
        .set({ status: 'processing' })
        .where(eq(authQueue.id, item.id));
    }
    
    return items;
  }

  async updateQueueStatus(id: string, status: string, processedAt?: Date): Promise<AuthQueue | undefined> {
    const [updated] = await db
      .update(authQueue)
      .set({ status, processedAt })
      .where(eq(authQueue.id, id))
      .returning();
    return updated || undefined;
  }

  // Auth Events
  async recordAuthEventNew(event: InsertAuthEvent): Promise<AuthEvent> {
    const [authEvent] = await db
      .insert(authEvents)
      .values(event)
      .returning();
    return authEvent;
  }

  async getAuthEvents(userId?: string, limit: number = 100): Promise<AuthEvent[]> {
    let query = db.select().from(authEvents);
    
    if (userId) {
      query = query.where(eq(authEvents.userId, userId)) as any;
    }
    
    const events = await query
      .orderBy(desc(authEvents.createdAt))
      .limit(limit);
    
    return events;
  }

  // Sessions
  async createSession(session: InsertSession): Promise<Session> {
    const [newSession] = await db
      .insert(sessions)
      .values(session)
      .returning();
    return newSession;
  }

  async getSession(id: string): Promise<Session | undefined> {
    const [session] = await db
      .select()
      .from(sessions)
      .where(eq(sessions.id, id));
    return session || undefined;
  }

  async updateSessionActivity(id: string): Promise<Session | undefined> {
    const [updated] = await db
      .update(sessions)
      .set({ lastActiveAt: new Date() })
      .where(eq(sessions.id, id))
      .returning();
    return updated || undefined;
  }

  async cleanupExpiredSessions(): Promise<void> {
    await db
      .delete(sessions)
      .where(lt(sessions.expiresAt, new Date()));
  }

  // Event Ratings
  async rateEvent(rating: InsertEventRating): Promise<EventRating | null> {
    try {
      const [eventRating] = await db
        .insert(eventRatings)
        .values(rating)
        .returning();
      
      return eventRating;
    } catch (error) {
      console.error("Error rating event:", error);
      return null;
    }
  }

  async updateEventRating(userId: string, eventId: string, newRating: 'thumbs_up' | 'thumbs_down'): Promise<EventRating | null> {
    try {
      // Find the existing rating through user's tickets
      const existingRatings = await db
        .select({
          ratingId: eventRatings.id,
          ticketId: eventRatings.ticketId
        })
        .from(eventRatings)
        .innerJoin(tickets, eq(eventRatings.ticketId, tickets.id))
        .where(and(
          eq(tickets.userId, userId),
          eq(eventRatings.eventId, eventId)
        ))
        .limit(1);
      
      if (existingRatings.length === 0) {
        return null;
      }
      
      const [updated] = await db
        .update(eventRatings)
        .set({ 
          rating: newRating,
          createdAt: new Date() // Update timestamp to track when vote was changed
        })
        .where(eq(eventRatings.id, existingRatings[0].ratingId))
        .returning();
      
      return updated;
    } catch (error) {
      console.error("Error updating event rating:", error);
      return null;
    }
  }

  async getUserEventRating(userId: string, eventId: string): Promise<{ rating: 'thumbs_up' | 'thumbs_down'; createdAt: Date } | null> {
    try {
      const result = await db
        .select({
          rating: eventRatings.rating,
          createdAt: eventRatings.createdAt
        })
        .from(eventRatings)
        .innerJoin(tickets, eq(eventRatings.ticketId, tickets.id))
        .where(and(
          eq(tickets.userId, userId),
          eq(eventRatings.eventId, eventId)
        ))
        .limit(1);
      
      if (result.length > 0 && result[0].createdAt) {
        return {
          rating: result[0].rating as 'thumbs_up' | 'thumbs_down',
          createdAt: result[0].createdAt
        };
      }
      
      return null;
    } catch (error) {
      console.error("Error getting user event rating:", error);
      return null;
    }
  }
  
  async hasUserRatedEvent(ticketId: string): Promise<boolean> {
    const [rating] = await db
      .select()
      .from(eventRatings)
      .where(eq(eventRatings.ticketId, ticketId))
      .limit(1);
    
    return !!rating;
  }

  async hasUserRatedEventByUser(userId: string, eventId: string): Promise<boolean> {
    // Check if user has rated this event with any of their tickets
    const [rating] = await db
      .select()
      .from(eventRatings)
      .innerJoin(tickets, eq(eventRatings.ticketId, tickets.id))
      .where(and(
        eq(tickets.userId, userId),
        eq(eventRatings.eventId, eventId)
      ))
      .limit(1);
    
    return !!rating;
  }
  
  async getUserValidationStats(userId: string): Promise<{ validationsPerformed: number }> {
    // Count tickets validated by this user (they are the ticket owner and ticket is validated)
    const validatedTickets = await db
      .select({ count: count() })
      .from(tickets)
      .where(
        and(
          eq(tickets.userId, userId),
          eq(tickets.isValidated, true)
        )
      );
    
    return {
      validationsPerformed: Number(validatedTickets[0]?.count || 0)
    };
  }

  async getUserReputation(userId: string): Promise<{ thumbsUp: number; thumbsDown: number; percentage: number | null; reputation: number; totalRatings: number }> {
    // First check cache
    const [cached] = await db
      .select()
      .from(userReputationCache)
      .where(eq(userReputationCache.userId, userId))
      .limit(1);
    
    // If cache exists and is less than 1 hour old, use it
    if (cached && cached.lastUpdated) {
      const cacheAge = Date.now() - cached.lastUpdated.getTime();
      const oneHour = 60 * 60 * 1000;
      
      if (cacheAge < oneHour) {
        return {
          thumbsUp: cached.thumbsUp,
          thumbsDown: cached.thumbsDown,
          percentage: cached.percentage,
          reputation: cached.percentage || 0,
          totalRatings: cached.thumbsUp + cached.thumbsDown
        };
      }
    }
    
    // Otherwise compute fresh and update cache
    const result = await this.updateUserReputationCache(userId);
    return {
      ...result,
      reputation: result.percentage || 0,
      totalRatings: result.thumbsUp + result.thumbsDown
    };
  }
  

  async updateUserReputationCache(userId: string): Promise<{ thumbsUp: number; thumbsDown: number; percentage: number | null; reputation: number; totalRatings: number }> {
    // Get current time minus 24 hours (in ISO string format for comparison)
    const twentyFourHoursAgo = new Date();
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);
    const twentyFourHoursAgoStr = twentyFourHoursAgo.toISOString();
    
    // Query ratings but only for events that have ended at least 24 hours ago
    const ratings = await db
      .select({
        rating: eventRatings.rating,
        count: count()
      })
      .from(eventRatings)
      .innerJoin(events, eq(eventRatings.eventId, events.id))
      .where(
        and(
          eq(eventRatings.eventOwnerId, userId),
          or(
            // If event has end date, use that + 24 hours
            and(
              not(isNull(events.endDate)),
              lte(events.endDate, twentyFourHoursAgoStr)
            ),
            // If no end date, use start date + 24 hours
            and(
              isNull(events.endDate),
              lte(events.date, twentyFourHoursAgoStr)
            )
          )
        )
      )
      .groupBy(eventRatings.rating);
    
    let thumbsUp = 0;
    let thumbsDown = 0;
    
    for (const row of ratings) {
      if (row.rating === 'thumbs_up') {
        thumbsUp = row.count;
      } else if (row.rating === 'thumbs_down') {
        thumbsDown = row.count;
      }
    }
    
    const total = thumbsUp + thumbsDown;
    const percentage = total > 0 ? Math.round((thumbsUp / total) * 100) : null;
    
    // Update or insert cache
    await db
      .insert(userReputationCache)
      .values({
        userId,
        thumbsUp,
        thumbsDown,
        percentage,
        lastUpdated: new Date()
      })
      .onConflictDoUpdate({
        target: userReputationCache.userId,
        set: {
          thumbsUp,
          thumbsDown,
          percentage,
          lastUpdated: new Date()
        }
      });
    
    return { 
      thumbsUp, 
      thumbsDown, 
      percentage,
      reputation: percentage || 0,
      totalRatings: thumbsUp + thumbsDown
    };
  }
  
  // Get all ratings without 24-hour filter (for debug/comparison)
  async getAllUserRatings(userId: string): Promise<{ thumbsUp: number; thumbsDown: number; percentage: number | null; reputation: number; totalRatings: number }> {
    const ratings = await db
      .select({
        rating: eventRatings.rating,
        count: count()
      })
      .from(eventRatings)
      .where(eq(eventRatings.eventOwnerId, userId))
      .groupBy(eventRatings.rating);
    
    let thumbsUp = 0;
    let thumbsDown = 0;
    
    for (const row of ratings) {
      if (row.rating === 'thumbs_up') {
        thumbsUp = row.count;
      } else if (row.rating === 'thumbs_down') {
        thumbsDown = row.count;
      }
    }
    
    const total = thumbsUp + thumbsDown;
    const percentage = total > 0 ? Math.round((thumbsUp / total) * 100) : null;
    
    return {
      thumbsUp,
      thumbsDown,
      percentage,
      reputation: percentage || 0,
      totalRatings: total
    };
  }

  async updateAllUserReputations(): Promise<void> {
    // Get all users who have received ratings
    const usersWithRatings = await db
      .selectDistinct({ userId: eventRatings.eventOwnerId })
      .from(eventRatings);
    
    // Update each user's reputation cache
    for (const { userId } of usersWithRatings) {
      if (userId) {
        await this.updateUserReputationCache(userId);
      }
    }
  }

  // Paginated ticket queries
  async getTicketsPaginated(params: { page: number; limit: number }): Promise<{ tickets: Ticket[]; total: number; hasMore: boolean }> {
    const { page = 1, limit = 20 } = params;
    const offset = (page - 1) * limit;
    
    // Get total count
    const [countResult] = await db
      .select({ count: count() })
      .from(tickets);
    
    const total = countResult?.count || 0;
    
    // Get paginated tickets with only necessary fields
    const ticketList = await db
      .select({
        id: tickets.id,
        eventId: tickets.eventId,
        userId: tickets.userId,
        ticketNumber: tickets.ticketNumber,
        isValidated: tickets.isValidated,
        validatedAt: tickets.validatedAt,
        isGoldenTicket: tickets.isGoldenTicket,
        createdAt: tickets.createdAt
      })
      .from(tickets)
      .orderBy(desc(tickets.createdAt))
      .limit(limit)
      .offset(offset);
    
    return {
      tickets: ticketList as Ticket[],
      total,
      hasMore: offset + ticketList.length < total
    };
  }

  async getTicketsByEventIdPaginated(eventId: string, params: { page: number; limit: number }): Promise<{ tickets: Ticket[]; total: number; hasMore: boolean }> {
    const { page = 1, limit = 20 } = params;
    const offset = (page - 1) * limit;
    
    // Get total count
    const [countResult] = await db
      .select({ count: count() })
      .from(tickets)
      .where(eq(tickets.eventId, eventId));
    
    const total = countResult?.count || 0;
    
    // Get paginated tickets
    const ticketList = await db
      .select({
        id: tickets.id,
        eventId: tickets.eventId,
        userId: tickets.userId,
        ticketNumber: tickets.ticketNumber,
        isValidated: tickets.isValidated,
        validatedAt: tickets.validatedAt,
        isGoldenTicket: tickets.isGoldenTicket,
        createdAt: tickets.createdAt
      })
      .from(tickets)
      .where(eq(tickets.eventId, eventId))
      .orderBy(desc(tickets.createdAt))
      .limit(limit)
      .offset(offset);
    
    return {
      tickets: ticketList as Ticket[],
      total,
      hasMore: offset + ticketList.length < total
    };
  }

  async getTicketsByUserIdPaginated(userId: string, params: { page: number; limit: number }): Promise<{ tickets: Ticket[]; total: number; hasMore: boolean }> {
    const { page = 1, limit = 20 } = params;
    const offset = (page - 1) * limit;
    
    // Get total count - exclude tickets listed for resale or sold
    const [countResult] = await db
      .select({ count: count() })
      .from(tickets)
      .where(and(
        eq(tickets.userId, userId),
        ne(tickets.resellStatus, "for_resale"),
        ne(tickets.resellStatus, "sold")
      ));
    
    const total = countResult?.count || 0;
    
    // Get paginated tickets with joined event data for user view
    // Exclude tickets that are listed for resale or have been sold
    const ticketList = await db
      .select({
        id: tickets.id,
        eventId: tickets.eventId,
        userId: tickets.userId,
        ticketNumber: tickets.ticketNumber,
        qrData: tickets.qrData,
        isValidated: tickets.isValidated,
        validatedAt: tickets.validatedAt,
        isGoldenTicket: tickets.isGoldenTicket,
        resellStatus: tickets.resellStatus,
        createdAt: tickets.createdAt
      })
      .from(tickets)
      .where(and(
        eq(tickets.userId, userId),
        ne(tickets.resellStatus, "for_resale"),
        ne(tickets.resellStatus, "sold")
      ))
      .orderBy(desc(tickets.createdAt))
      .limit(limit)
      .offset(offset);
    
    return {
      tickets: ticketList as Ticket[],
      total,
      hasMore: offset + ticketList.length < total
    };
  }

  // Transaction support for race condition prevention
  async createTicketWithTransaction(ticket: InsertTicket): Promise<Ticket> {
    return await db.transaction(async (tx) => {
      // Get the event to check availability
      const [event] = await tx
        .select()
        .from(events)
        .where(eq(events.id, ticket.eventId))
        .for('update'); // Lock the event row
      
      if (!event) {
        throw new Error('Event not found');
      }
      
      // Get the user's display name if userId is provided
      let displayName = 'Guest';
      if (ticket.userId) {
        const [user] = await tx
          .select({ displayName: users.displayName })
          .from(users)
          .where(eq(users.id, ticket.userId));
        if (user?.displayName) {
          displayName = user.displayName;
        }
      }
      
      // Count existing tickets
      const [ticketCount] = await tx
        .select({ count: count() })
        .from(tickets)
        .where(eq(tickets.eventId, ticket.eventId));
      
      const currentCount = ticketCount?.count || 0;
      
      // Check if tickets are still available
      if (event.maxTickets && currentCount >= event.maxTickets) {
        throw new Error('No tickets available');
      }
      
      // Generate unique ticket number with username
      const ticketNumber = `${event.id.slice(0, 8)}-${displayName}-${(currentCount + 1).toString().padStart(6, '0')}`;
      
      // Generate a unique 4-digit validation code from the pool
      const validationCode = generateValidationCode(ticket.eventId);
      
      // Calculate scheduled deletion date (69 days after event end)
      let scheduledDeletion: Date | null = null;
      if (event.endDate || event.date) {
        const eventEndDate = event.endDate ? new Date(event.endDate) : new Date(event.date);
        scheduledDeletion = new Date(eventEndDate);
        scheduledDeletion.setDate(scheduledDeletion.getDate() + 69);
      }
      
      // Create the ticket
      const [newTicket] = await tx
        .insert(tickets)
        .values({
          ...ticket,
          ticketNumber,
          qrData: ticket.qrData || ticketNumber,
          validationCode,
          scheduledDeletion
        })
        .returning();
      
      return newTicket;
    });
  }

  // Crypto Payment Intents
  async createPaymentIntent(intent: InsertCryptoPaymentIntent): Promise<CryptoPaymentIntent> {
    const [paymentIntent] = await db.insert(cryptoPaymentIntents).values(intent).returning();
    return paymentIntent;
  }

  async getPaymentIntentByTicketId(ticketId: string): Promise<CryptoPaymentIntent | undefined> {
    const [intent] = await db
      .select()
      .from(cryptoPaymentIntents)
      .where(eq(cryptoPaymentIntents.ticketId, ticketId));
    return intent;
  }

  async getPaymentIntentByReference(reference: string): Promise<CryptoPaymentIntent | undefined> {
    const [intent] = await db
      .select()
      .from(cryptoPaymentIntents)
      .where(eq(cryptoPaymentIntents.reference, reference));
    return intent;
  }

  async updatePaymentIntentStatus(id: string, status: string, transactionHash?: string): Promise<CryptoPaymentIntent | undefined> {
    const updateData: any = { status };
    if (transactionHash) {
      updateData.transactionHash = transactionHash;
      updateData.confirmedAt = new Date();
    }
    
    const [updated] = await db
      .update(cryptoPaymentIntents)
      .set(updateData)
      .where(eq(cryptoPaymentIntents.id, id))
      .returning();
    return updated;
  }

  async getPaymentIntentsByEventId(eventId: string): Promise<CryptoPaymentIntent[]> {
    return db
      .select()
      .from(cryptoPaymentIntents)
      .where(eq(cryptoPaymentIntents.eventId, eventId))
      .orderBy(desc(cryptoPaymentIntents.createdAt));
  }

  async getExpiredMonitoringIntents(): Promise<CryptoPaymentIntent[]> {
    const now = new Date();
    return db
      .select()
      .from(cryptoPaymentIntents)
      .where(and(
        eq(cryptoPaymentIntents.status, 'monitoring'),
        lt(cryptoPaymentIntents.monitoringExpiresAt, now)
      ));
  }

  // Currency Ledger Operations
  async getUserBalance(userId: string): Promise<AccountBalance | null> {
    const [balance] = await db
      .select()
      .from(accountBalances)
      .where(eq(accountBalances.accountId, userId));
    
    if (!balance) {
      // Create a new balance record for the user
      const [newBalance] = await db
        .insert(accountBalances)
        .values({
          accountId: userId,
          accountType: 'user',
          balance: '0',
          holdBalance: '0',
          availableBalance: '0',
        })
        .returning();
      return newBalance;
    }
    
    return balance;
  }

  async createLedgerTransaction(params: {
    transactionType: string;
    description: string;
    debits: Array<{ accountId: string; accountType: string; amount: number }>;
    credits: Array<{ accountId: string; accountType: string; amount: number }>;
    metadata?: any;
    relatedEntityId?: string;
    relatedEntityType?: string;
    createdBy?: string;
  }): Promise<CurrencyLedger[]> {
    const transactionId = randomUUID();
    const entries: CurrencyLedger[] = [];
    
    // Validate that debits equal credits (double-entry bookkeeping)
    const totalDebits = params.debits.reduce((sum, d) => sum + d.amount, 0);
    const totalCredits = params.credits.reduce((sum, c) => sum + c.amount, 0);
    
    if (Math.abs(totalDebits - totalCredits) > 0.01) {
      throw new Error('Debits must equal credits in double-entry bookkeeping');
    }
    
    return await db.transaction(async (tx) => {
      // Process debits
      for (const debit of params.debits) {
        // Get or create account balance
        let [accountBalance] = await tx
          .select()
          .from(accountBalances)
          .where(eq(accountBalances.accountId, debit.accountId))
          .for('update');
        
        if (!accountBalance) {
          [accountBalance] = await tx
            .insert(accountBalances)
            .values({
              accountId: debit.accountId,
              accountType: debit.accountType,
              balance: '0',
              holdBalance: '0',
              availableBalance: '0',
            })
            .returning();
        }
        
        // Calculate new balance (debit decreases user balance)
        const currentBalance = parseFloat(accountBalance.balance);
        const newBalance = currentBalance - debit.amount;
        
        // Create ledger entry
        const [ledgerEntry] = await tx
          .insert(currencyLedger)
          .values({
            transactionId,
            accountId: debit.accountId,
            accountType: debit.accountType,
            entryType: 'debit',
            amount: debit.amount.toString(),
            balance: newBalance.toString(),
            transactionType: params.transactionType,
            description: params.description,
            metadata: params.metadata ? JSON.stringify(params.metadata) : null,
            relatedEntityId: params.relatedEntityId,
            relatedEntityType: params.relatedEntityType,
            createdBy: params.createdBy,
          })
          .returning();
        
        entries.push(ledgerEntry);
        
        // Update account balance
        const holdBalance = parseFloat(accountBalance.holdBalance);
        await tx
          .update(accountBalances)
          .set({
            balance: newBalance.toString(),
            availableBalance: (newBalance - holdBalance).toString(),
            lastTransactionId: transactionId,
            lastUpdated: new Date(),
          })
          .where(eq(accountBalances.accountId, debit.accountId));
      }
      
      // Process credits
      for (const credit of params.credits) {
        // Get or create account balance
        let [accountBalance] = await tx
          .select()
          .from(accountBalances)
          .where(eq(accountBalances.accountId, credit.accountId))
          .for('update');
        
        if (!accountBalance) {
          [accountBalance] = await tx
            .insert(accountBalances)
            .values({
              accountId: credit.accountId,
              accountType: credit.accountType,
              balance: '0',
              holdBalance: '0',
              availableBalance: '0',
            })
            .returning();
        }
        
        // Calculate new balance (credit increases user balance)
        const currentBalance = parseFloat(accountBalance.balance);
        const newBalance = currentBalance + credit.amount;
        
        // Create ledger entry
        const [ledgerEntry] = await tx
          .insert(currencyLedger)
          .values({
            transactionId,
            accountId: credit.accountId,
            accountType: credit.accountType,
            entryType: 'credit',
            amount: credit.amount.toString(),
            balance: newBalance.toString(),
            transactionType: params.transactionType,
            description: params.description,
            metadata: params.metadata ? JSON.stringify(params.metadata) : null,
            relatedEntityId: params.relatedEntityId,
            relatedEntityType: params.relatedEntityType,
            createdBy: params.createdBy,
          })
          .returning();
        
        entries.push(ledgerEntry);
        
        // Update account balance
        const holdBalance = parseFloat(accountBalance.holdBalance);
        await tx
          .update(accountBalances)
          .set({
            balance: newBalance.toString(),
            availableBalance: (newBalance - holdBalance).toString(),
            lastTransactionId: transactionId,
            lastUpdated: new Date(),
          })
          .where(eq(accountBalances.accountId, credit.accountId));
      }
      
      return entries;
    });
  }

  async getAccountTransactions(accountId: string, limit: number = 50): Promise<CurrencyLedger[]> {
    return await db
      .select()
      .from(currencyLedger)
      .where(eq(currencyLedger.accountId, accountId))
      .orderBy(desc(currencyLedger.createdAt))
      .limit(limit);
  }

  async createHold(hold: InsertCurrencyHold): Promise<CurrencyHold> {
    return await db.transaction(async (tx) => {
      // Get account balance
      const [accountBalance] = await tx
        .select()
        .from(accountBalances)
        .where(eq(accountBalances.accountId, hold.accountId))
        .for('update');
      
      if (!accountBalance) {
        throw new Error('Account not found');
      }
      
      const availableBalance = parseFloat(accountBalance.availableBalance);
      const holdAmount = parseFloat(hold.amount.toString());
      
      if (availableBalance < holdAmount) {
        throw new Error('Insufficient available balance');
      }
      
      // Create hold
      const [newHold] = await tx
        .insert(currencyHolds)
        .values(hold)
        .returning();
      
      // Update account balance
      const currentHoldBalance = parseFloat(accountBalance.holdBalance);
      const newHoldBalance = currentHoldBalance + holdAmount;
      const balance = parseFloat(accountBalance.balance);
      
      await tx
        .update(accountBalances)
        .set({
          holdBalance: newHoldBalance.toString(),
          availableBalance: (balance - newHoldBalance).toString(),
          lastUpdated: new Date(),
        })
        .where(eq(accountBalances.accountId, hold.accountId));
      
      return newHold;
    });
  }

  async releaseHold(holdId: string): Promise<boolean> {
    return await db.transaction(async (tx) => {
      // Get the hold
      const [hold] = await tx
        .select()
        .from(currencyHolds)
        .where(and(
          eq(currencyHolds.id, holdId),
          eq(currencyHolds.status, 'active')
        ))
        .for('update');
      
      if (!hold) {
        return false;
      }
      
      // Update hold status
      await tx
        .update(currencyHolds)
        .set({
          status: 'released',
          releasedAt: new Date(),
        })
        .where(eq(currencyHolds.id, holdId));
      
      // Update account balance
      const [accountBalance] = await tx
        .select()
        .from(accountBalances)
        .where(eq(accountBalances.accountId, hold.accountId))
        .for('update');
      
      if (accountBalance) {
        const currentHoldBalance = parseFloat(accountBalance.holdBalance);
        const holdAmount = parseFloat(hold.amount);
        const newHoldBalance = Math.max(0, currentHoldBalance - holdAmount);
        const balance = parseFloat(accountBalance.balance);
        
        await tx
          .update(accountBalances)
          .set({
            holdBalance: newHoldBalance.toString(),
            availableBalance: (balance - newHoldBalance).toString(),
            lastUpdated: new Date(),
          })
          .where(eq(accountBalances.accountId, hold.accountId));
      }
      
      return true;
    });
  }

  async expireOldHolds(): Promise<void> {
    const expiredHolds = await db
      .select()
      .from(currencyHolds)
      .where(and(
        eq(currencyHolds.status, 'active'),
        lt(currencyHolds.expiresAt, new Date())
      ));
    
    for (const hold of expiredHolds) {
      await this.releaseHold(hold.id);
    }
  }

  async initializeSystemAccounts(): Promise<void> {
    const systemAccounts = [
      { accountId: 'system_revenue', accountType: 'system', description: 'System Revenue Account' },
      { accountId: 'system_fees', accountType: 'system', description: 'System Fees Account' },
      { accountId: 'system_rewards', accountType: 'system', description: 'System Rewards Account' },
      { accountId: 'system_escrow', accountType: 'system', description: 'System Escrow Account' },
    ];
    
    for (const account of systemAccounts) {
      const [existing] = await db
        .select()
        .from(accountBalances)
        .where(eq(accountBalances.accountId, account.accountId));
      
      if (!existing) {
        await db
          .insert(accountBalances)
          .values({
            accountId: account.accountId,
            accountType: account.accountType,
            balance: '0',
            holdBalance: '0',
            availableBalance: '0',
          });
      }
    }
    
    // Initialize transaction templates
    const templates = [
      {
        code: 'TICKET_PURCHASE',
        name: 'Ticket Purchase',
        description: 'User purchases a ticket',
        debitAccount: 'user',
        creditAccount: 'system_revenue',
      },
      {
        code: 'TICKET_RESELL',
        name: 'Ticket Resale',
        description: 'User resells a ticket',
        debitAccount: 'buyer',
        creditAccount: 'seller',
      },
      {
        code: 'PLATFORM_FEE',
        name: 'Platform Fee',
        description: 'Platform fee for resale',
        debitAccount: 'seller',
        creditAccount: 'system_fees',
      },
      {
        code: 'REWARD',
        name: 'Reward',
        description: 'User receives a reward',
        debitAccount: 'system_rewards',
        creditAccount: 'user',
      },
      {
        code: 'TRANSFER',
        name: 'Transfer',
        description: 'Transfer between users',
        debitAccount: 'sender',
        creditAccount: 'receiver',
      },
    ];
    
    for (const template of templates) {
      const [existing] = await db
        .select()
        .from(transactionTemplates)
        .where(eq(transactionTemplates.code, template.code));
      
      if (!existing) {
        await db.insert(transactionTemplates).values(template);
      }
    }
  }

  async creditUserAccount(userId: string, amount: number, description: string, metadata?: any): Promise<boolean> {
    try {
      await this.createLedgerTransaction({
        transactionType: 'credit',
        description,
        debits: [{ accountId: 'system_revenue', accountType: 'system', amount }],
        credits: [{ accountId: userId, accountType: 'user', amount }],
        metadata,
        createdBy: userId,
      });
      return true;
    } catch (error) {
      console.error('Error crediting user account:', error);
      return false;
    }
  }

  async debitUserAccount(userId: string, amount: number, description: string, metadata?: any): Promise<boolean> {
    try {
      await this.createLedgerTransaction({
        transactionType: 'debit',
        description,
        debits: [{ accountId: userId, accountType: 'user', amount }],
        credits: [{ accountId: 'system_revenue', accountType: 'system', amount }],
        metadata,
        createdBy: userId,
      });
      return true;
    } catch (error) {
      console.error('Error debiting user account:', error);
      return false;
    }
  }

  async transferTickets(fromUserId: string, toUserId: string, amount: number, description: string): Promise<boolean> {
    try {
      await this.createLedgerTransaction({
        transactionType: 'transfer',
        description,
        debits: [{ accountId: fromUserId, accountType: 'user', amount }],
        credits: [{ accountId: toUserId, accountType: 'user', amount }],
        createdBy: fromUserId,
      });
      return true;
    } catch (error) {
      console.error('Error transferring tickets:', error);
      return false;
    }
  }
  
  // Daily Claims Implementation
  async canClaimDailyTickets(userId: string): Promise<{ canClaim: boolean; nextClaimAt?: Date }> {
    try {
      // Get the most recent claim for this user
      const [lastClaim] = await db
        .select()
        .from(dailyClaims)
        .where(eq(dailyClaims.userId, userId))
        .orderBy(desc(dailyClaims.claimedAt))
        .limit(1);
      
      if (!lastClaim) {
        // User has never claimed, they can claim now
        return { canClaim: true };
      }
      
      const now = new Date();
      const nextClaimTime = new Date(lastClaim.nextClaimAt);
      
      if (now >= nextClaimTime) {
        return { canClaim: true };
      } else {
        return { canClaim: false, nextClaimAt: nextClaimTime };
      }
    } catch (error) {
      console.error('Error checking daily claim eligibility:', error);
      return { canClaim: false };
    }
  }
  
  async claimDailyTickets(userId: string): Promise<{ amount: number; nextClaimAt: Date }> {
    try {
      // Check if user can claim
      const eligibility = await this.canClaimDailyTickets(userId);
      if (!eligibility.canClaim) {
        throw new Error('Cannot claim tickets yet');
      }
      
      // Fixed amount: 2 tickets per claim
      const now = new Date();
      const amount = 2;
      
      // Calculate next claim time (12 hours from now)
      const nextClaimAt = new Date(now.getTime() + 12 * 60 * 60 * 1000);
      
      // Record the claim
      await db.insert(dailyClaims).values({
        userId,
        amount: amount.toString(),
        nextClaimAt,
      });
      
      // Credit the user's account
      await this.creditUserAccount(
        userId,
        amount,
        `Daily reward claim: ${amount} Tickets`,
        { claimTime: now.toISOString() }
      );
      
      return { amount, nextClaimAt };
    } catch (error) {
      console.error('Error claiming daily tickets:', error);
      throw error;
    }
  }
  
  // Secret Codes
  async validateSecretCode(code: string): Promise<SecretCode | undefined> {
    try {
      const [secretCode] = await db.select()
        .from(secretCodes)
        .where(and(
          eq(secretCodes.code, code.toUpperCase()),
          eq(secretCodes.isActive, true)
        ));
      
      if (!secretCode) return undefined;
      
      // Check if expired
      if (secretCode.expiresAt && new Date(secretCode.expiresAt) < new Date()) {
        return undefined;
      }
      
      // Check if max uses reached
      if (secretCode.maxUses && secretCode.currentUses !== null && secretCode.currentUses >= secretCode.maxUses) {
        return undefined;
      }
      
      return secretCode;
    } catch (error) {
      console.error('Error validating secret code:', error);
      return undefined;
    }
  }
  
  async redeemSecretCode(code: string, userId: string, latitude?: number, longitude?: number): Promise<{ success: boolean; ticketAmount?: number; error?: string; message?: string }> {
    try {
      // Check if it looks like a Hunt code pattern but doesn't exist
      const huntPattern = /^[A-Z][a-z]+[A-Z][a-z]+$/;
      const looksLikeHuntCode = huntPattern.test(code);
      
      // Validate the code
      const secretCode = await this.validateSecretCode(code);
      if (!secretCode) {
        // If it looks like a Hunt code but doesn't exist, show hunt-specific message
        if (looksLikeHuntCode) {
          return { success: false, error: 'Sorry, it\'s gone :(' };
        }
        return { success: false, error: 'Invalid or expired code' };
      }
      
      // Check if user already redeemed this code
      const hasRedeemed = await this.hasUserRedeemedCode(userId, secretCode.id);
      if (hasRedeemed) {
        return { success: false, error: 'You have already redeemed this code' };
      }
      
      // Special handling for Hunt codes
      if (secretCode.codeType === 'hunt') {
        if (!latitude || !longitude) {
          return { success: false, error: 'Hunt codes require your location. Please enable GPS and try again.' };
        }
        
        if (!secretCode.huntLatitude || !secretCode.huntLongitude) {
          return { success: false, error: 'This Hunt code is missing location data' };
        }
        
        // Calculate distance from Hunt location (Haversine formula)
        const R = 6371000; // Earth's radius in meters
        const lat1Rad = (latitude * Math.PI) / 180;
        const lat2Rad = (Number(secretCode.huntLatitude) * Math.PI) / 180;
        const deltaLatRad = ((Number(secretCode.huntLatitude) - latitude) * Math.PI) / 180;
        const deltaLngRad = ((Number(secretCode.huntLongitude) - longitude) * Math.PI) / 180;
        
        const a = Math.sin(deltaLatRad / 2) * Math.sin(deltaLatRad / 2) +
                 Math.cos(lat1Rad) * Math.cos(lat2Rad) *
                 Math.sin(deltaLngRad / 2) * Math.sin(deltaLngRad / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const distance = R * c;
        
        // Check if within 300 meters
        if (distance > 300) {
          const distanceKm = (distance / 1000).toFixed(1);
          return { 
            success: false, 
            error: `You're ${distanceKm}km away from the Hunt location. You need to be within 300 meters to redeem this code.` 
          };
        }
        
        // Get event info and check availability
        if (!secretCode.eventId) {
          return { success: false, error: 'Sorry, it\'s gone :(' };
        }
        
        const event = await this.getEvent(secretCode.eventId);
        if (!event) {
          return { success: false, error: 'Sorry, it\'s gone :(' };
        }
        
        // Check if event has available tickets
        const existingTickets = await this.getTicketsByEventId(event.id);
        const ticketsSold = existingTickets.length;
        const ticketsAvailable = event.maxTickets ? event.maxTickets - ticketsSold : 1;
        
        if (ticketsAvailable <= 0) {
          return { success: false, error: 'Sorry, it\'s gone :(' };
        }
        
        // Check if user already has a ticket for this event
        const userTickets = await this.getTicketsByEventAndUser(event.id, userId);
        let ticket = userTickets.length > 0 ? userTickets[0] : null;
        
        // Start transaction
        await db.transaction(async (tx) => {
          // Record the redemption
          await tx.insert(codeRedemptions).values({
            codeId: secretCode.id,
            userId
          });
          
          // Update the usage count
          await tx.update(secretCodes)
            .set({ currentUses: (secretCode.currentUses || 0) + 1 })
            .where(eq(secretCodes.id, secretCode.id));
          
          // If user doesn't have a ticket, create one (auto-signup!)
          if (!ticket) {
            const user = await this.getUser(userId);
            const ticketNumber = `HUNT-${event.id.slice(0, 8)}-${Date.now()}`;
            const qrData = `HUNT-${secretCode.code}-${ticketNumber}`;
            
            ticket = await this.createTicket({
              eventId: event.id,
              userId: userId,
              ticketNumber: ticketNumber,
              qrData: qrData,
              recipientName: user?.displayName || 'Hunt Discoverer',
              recipientEmail: user?.email || 'unknown@hunt.quest',
              status: 'sent', // Auto-sent Hunt tickets
              transferable: false, // Hunt tickets are non-transferable
              isValidated: true, // Auto-validate Hunt tickets
              validatedAt: new Date(),
              useCount: 1,
              isGoldenTicket: false,
              purchasePrice: null, // Free Hunt ticket
              purchaserEmail: user?.email || null,
              purchaserIp: null,
              resellStatus: 'not_for_resale',
              originalOwnerId: userId,
              isCharged: false,
            });
          } else {
            // User has ticket, just validate it if not already validated
            if (!ticket.isValidated) {
              await tx.update(tickets)
                .set({ 
                  isValidated: true, 
                  validatedAt: new Date(),
                  useCount: (ticket.useCount || 0) + 1
                })
                .where(eq(tickets.id, ticket.id));
            }
          }
          
          // Credit user account with tickets (bonus reward)
          await this.creditUserAccount(
            userId, 
            secretCode.ticketAmount, 
            `Hunt discovery: ${code} for ${event.name}`,
            { codeId: secretCode.id, huntLocation: true, distance: Math.round(distance), eventId: event.id }
          );
        });
        
        return { 
          success: true, 
          ticketAmount: secretCode.ticketAmount,
          message: `You found ${event.name} and earned a validated ticket! Nice.`
        };
      }
      
      // Regular secret code handling
      await db.transaction(async (tx) => {
        // Record the redemption
        await tx.insert(codeRedemptions).values({
          codeId: secretCode.id,
          userId
        });
        
        // Update the usage count
        await tx.update(secretCodes)
          .set({ currentUses: (secretCode.currentUses || 0) + 1 })
          .where(eq(secretCodes.id, secretCode.id));
        
        // Credit user account with tickets
        await this.creditUserAccount(
          userId, 
          secretCode.ticketAmount, 
          `Redeemed secret code: ${code}`,
          { codeId: secretCode.id }
        );
      });
      
      // Send notification for NERRRRRD! code
      if (code.toUpperCase() === "NERRRRRD!") {
        try {
          await this.createNotification({
            userId,
            type: "success",
            title: "NERRRRRD!",
            description: "NERRRRRD!"
          });
        } catch (error) {
          console.error('Failed to send NERRRRRD! notification:', error);
        }
      }
      
      return { success: true, ticketAmount: secretCode.ticketAmount };
    } catch (error) {
      console.error('Error redeeming secret code:', error);
      return { success: false, error: 'Failed to redeem code' };
    }
  }
  
  async hasUserRedeemedCode(userId: string, codeId: string): Promise<boolean> {
    try {
      const [redemption] = await db.select()
        .from(codeRedemptions)
        .where(and(
          eq(codeRedemptions.userId, userId),
          eq(codeRedemptions.codeId, codeId)
        ));
      
      return !!redemption;
    } catch (error) {
      console.error('Error checking code redemption:', error);
      return false;
    }
  }

  async createSecretCode(codeData: {
    code: string;
    ticketAmount: number;
    maxUses?: number | null;
    expiresAt?: Date | null;
    createdBy?: string | null;
    codeType?: string;
    eventId?: string | null;
    huntLatitude?: string | null;
    huntLongitude?: string | null;
  }): Promise<SecretCode> {
    try {
      const [newCode] = await db.insert(secretCodes).values({
        code: codeData.code,
        ticketAmount: codeData.ticketAmount,
        maxUses: codeData.maxUses || null,
        expiresAt: codeData.expiresAt || null,
        createdBy: codeData.createdBy || null,
        codeType: codeData.codeType || 'regular',
        eventId: codeData.eventId || null,
        huntLatitude: codeData.huntLatitude || null,
        huntLongitude: codeData.huntLongitude || null,
      }).returning();
      
      return newCode;
    } catch (error) {
      console.error('Error creating secret code:', error);
      throw error;
    }
  }
  
  // Ticket Purchases
  async createTicketPurchase(purchase: InsertTicketPurchase): Promise<TicketPurchase> {
    try {
      const [newPurchase] = await db.insert(ticketPurchases).values(purchase).returning();
      return newPurchase;
    } catch (error) {
      console.error('Error creating ticket purchase:', error);
      throw error;
    }
  }
  
  async updateTicketPurchaseStatus(id: string, status: string, stripeSessionId?: string): Promise<TicketPurchase | undefined> {
    try {
      const updateData: any = { status };
      if (stripeSessionId) {
        updateData.stripeSessionId = stripeSessionId;
      }
      
      const [updated] = await db.update(ticketPurchases)
        .set(updateData)
        .where(eq(ticketPurchases.id, id))
        .returning();
      
      return updated || undefined;
    } catch (error) {
      console.error('Error updating ticket purchase status:', error);
      return undefined;
    }
  }
  
  async getTicketPurchase(id: string): Promise<TicketPurchase | undefined> {
    try {
      const [purchase] = await db.select()
        .from(ticketPurchases)
        .where(eq(ticketPurchases.id, id));
      
      return purchase || undefined;
    } catch (error) {
      console.error('Error getting ticket purchase:', error);
      return undefined;
    }
  }
  
  async getTicketPurchaseBySessionId(sessionId: string): Promise<TicketPurchase | undefined> {
    try {
      const [purchase] = await db.select()
        .from(ticketPurchases)
        .where(eq(ticketPurchases.stripeSessionId, sessionId));
      
      return purchase || undefined;
    } catch (error) {
      console.error('Error getting ticket purchase by session ID:', error);
      return undefined;
    }
  }
  
  // Get ticket demand for the last 48 hours (bidirectional: purchases up, validations down)
  async getTicketDemand48Hours(): Promise<number> {
    try {
      const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);
      
      // Count credit purchases in the last 48 hours (increases demand)
      const [purchaseResult] = await db
        .select({ 
          totalQuantity: sql<number>`COALESCE(SUM(quantity), 0)` 
        })
        .from(ticketPurchases)
        .where(and(
          eq(ticketPurchases.status, "completed"),
          gte(ticketPurchases.purchasedAt, fortyEightHoursAgo)
        ));
      
      // Count ticket validations in the last 48 hours (decreases demand)
      const [validationResult] = await db
        .select({ count: count() })
        .from(tickets)
        .where(and(
          eq(tickets.isValidated, true),
          gte(tickets.validatedAt, fortyEightHoursAgo)
        ));
      
      const purchaseDemand = purchaseResult?.totalQuantity || 0;
      const validationReduction = validationResult?.count || 0;
      
      // Bidirectional demand: purchases increase it, validations decrease it
      // Apply a multiplier to validations to make them impactful (each validation reduces demand by 0.5)
      const netDemand = Math.max(0, purchaseDemand - (validationReduction * 0.5));
      
      return netDemand;
    } catch (error) {
      console.error('Error getting 48-hour bidirectional demand:', error);
      return 0;
    }
  }
  
  // Get leaderboard - top 100 users by reputation
  async getLeaderboard(): Promise<{
    userId: string;
    displayName: string;
    memberStatus: string;
    thumbsUp: number;
    thumbsDown: number;
    percentage: number | null;
    validatedCount: number;
  }[]> {
    try {
      // Get top 100 users by total ratings (thumbs up + down) in last 69 days
      const sixtyNineDaysAgo = new Date();
      sixtyNineDaysAgo.setDate(sixtyNineDaysAgo.getDate() - 69);
      
      // Get all users with their reputation stats
      const userStats = await db
        .select({
          userId: users.id,
          displayName: users.displayName,
          memberStatus: users.memberStatus,
        })
        .from(users);
      
      // Get ratings for each user
      const leaderboardData = await Promise.all(
        userStats.map(async (user) => {
          const reputation = await this.getUserReputation(user.userId);
          const validationStats = await this.getUserValidatedTicketsCount(user.userId);
          
          return {
            userId: user.userId,
            displayName: user.displayName || 'Anonymous',
            memberStatus: user.memberStatus || 'Legacy',
            thumbsUp: reputation.thumbsUp,
            thumbsDown: reputation.thumbsDown,
            percentage: reputation.percentage,
            validatedCount: validationStats,
            totalVotes: reputation.thumbsUp + reputation.thumbsDown
          };
        })
      );
      
      // Sort by total votes (thumbs up + down) and take top 100
      const sortedLeaderboard = leaderboardData
        .filter(user => user.totalVotes > 0 || user.validatedCount > 0) // Only include users with activity
        .sort((a, b) => {
          // Sort by total votes first, then by validation count
          const voteDiff = b.totalVotes - a.totalVotes;
          if (voteDiff !== 0) return voteDiff;
          return b.validatedCount - a.validatedCount;
        })
        .slice(0, 100)
        .map(({ totalVotes, ...user }) => user); // Remove totalVotes from final output
      
      return sortedLeaderboard;
    } catch (error) {
      console.error('Error getting leaderboard:', error);
      return [];
    }
  }
  
  // Platform Headers Management
  async getPlatformHeaders(): Promise<PlatformHeader[]> {
    try {
      const headers = await db.select()
        .from(platformHeaders)
        .orderBy(asc(platformHeaders.displayOrder), asc(platformHeaders.createdAt));
      return headers;
    } catch (error) {
      console.error('Error getting platform headers:', error);
      return [];
    }
  }
  
  async getActivePlatformHeaders(): Promise<PlatformHeader[]> {
    try {
      const headers = await db.select()
        .from(platformHeaders)
        .where(eq(platformHeaders.active, true))
        .orderBy(asc(platformHeaders.displayOrder), asc(platformHeaders.createdAt));
      return headers;
    } catch (error) {
      console.error('Error getting active platform headers:', error);
      return [];
    }
  }
  
  async getRandomPlatformHeader(): Promise<PlatformHeader | undefined> {
    try {
      const activeHeaders = await this.getActivePlatformHeaders();
      if (activeHeaders.length === 0) return undefined;
      
      const randomIndex = Math.floor(Math.random() * activeHeaders.length);
      return activeHeaders[randomIndex];
    } catch (error) {
      console.error('Error getting random platform header:', error);
      return undefined;
    }
  }
  
  async getPlatformHeader(id: string): Promise<PlatformHeader | undefined> {
    try {
      const [header] = await db.select()
        .from(platformHeaders)
        .where(eq(platformHeaders.id, id));
      return header || undefined;
    } catch (error) {
      console.error('Error getting platform header:', error);
      return undefined;
    }
  }
  
  async createPlatformHeader(header: InsertPlatformHeader): Promise<PlatformHeader> {
    try {
      const [newHeader] = await db.insert(platformHeaders)
        .values(header)
        .returning();
      return newHeader;
    } catch (error) {
      console.error('Error creating platform header:', error);
      throw error;
    }
  }
  
  async updatePlatformHeader(id: string, header: Partial<InsertPlatformHeader>): Promise<PlatformHeader | undefined> {
    try {
      const updateData: any = { ...header };
      updateData.updatedAt = new Date();
      
      const [updated] = await db.update(platformHeaders)
        .set(updateData)
        .where(eq(platformHeaders.id, id))
        .returning();
      
      return updated || undefined;
    } catch (error) {
      console.error('Error updating platform header:', error);
      return undefined;
    }
  }
  
  async deletePlatformHeader(id: string): Promise<boolean> {
    try {
      const result = await db.delete(platformHeaders)
        .where(eq(platformHeaders.id, id));
      return true;
    } catch (error) {
      console.error('Error deleting platform header:', error);
      return false;
    }
  }
  
  async togglePlatformHeaderActive(id: string): Promise<PlatformHeader | undefined> {
    try {
      const header = await this.getPlatformHeader(id);
      if (!header) return undefined;
      
      const [updated] = await db.update(platformHeaders)
        .set({ 
          active: !header.active,
          updatedAt: new Date()
        })
        .where(eq(platformHeaders.id, id))
        .returning();
      
      return updated || undefined;
    } catch (error) {
      console.error('Error toggling platform header active state:', error);
      return undefined;
    }
  }
  
  // System Settings Management
  async getSystemSetting(key: string): Promise<SystemSetting | undefined> {
    try {
      const [setting] = await db.select()
        .from(systemSettings)
        .where(eq(systemSettings.key, key))
        .limit(1);
      return setting || undefined;
    } catch (error) {
      console.error('Error getting system setting:', error);
      return undefined;
    }
  }
  
  async setSystemSetting(key: string, value: string, userId?: string): Promise<SystemSetting> {
    try {
      // Try to update existing setting first
      const existing = await this.getSystemSetting(key);
      
      if (existing) {
        const [updated] = await db.update(systemSettings)
          .set({ 
            value,
            updatedAt: new Date(),
            updatedBy: userId
          })
          .where(eq(systemSettings.key, key))
          .returning();
        return updated;
      }
      
      // Create new setting if it doesn't exist
      const [created] = await db.insert(systemSettings)
        .values({
          key,
          value,
          description: key === 'banned_words' ? 'Comma-separated list of banned words for content moderation' : undefined,
          updatedBy: userId
        })
        .returning();
      
      return created;
    } catch (error) {
      console.error('Error setting system setting:', error);
      throw error;
    }
  }
  
  async getBannedWords(): Promise<string[]> {
    try {
      const setting = await this.getSystemSetting('banned_words');
      if (!setting || !setting.value) {
        // Return default banned words if not configured
        return ['nigger', 'faggot', 'fuck', 'nazi'];
      }
      
      // Parse comma-separated values
      return setting.value
        .split(',')
        .map(word => word.trim().toLowerCase())
        .filter(word => word.length > 0);
    } catch (error) {
      console.error('Error getting banned words:', error);
      // Return default list on error
      return ['nigger', 'faggot', 'fuck', 'nazi'];
    }
  }
}

export const storage = new DatabaseStorage();