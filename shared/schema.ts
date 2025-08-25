import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, decimal, integer, boolean, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  locations: text("locations"), // Changed from city to locations for multiple location tracking
  createdAt: timestamp("created_at").defaultNow(),
  lastLoginAt: timestamp("last_login_at"),
});

export const authTokens = pgTable("auth_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  token: text("token").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  used: boolean("used").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const loginAttempts = pgTable("login_attempts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull(),
  ipAddress: text("ip_address").notNull(),
  success: boolean("success").default(false),
  attemptedAt: timestamp("attempted_at").defaultNow(),
});

export const blockedIps = pgTable("blocked_ips", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ipAddress: text("ip_address").notNull().unique(),
  reason: text("reason"),
  blockedAt: timestamp("blocked_at").defaultNow(),
  unblockAt: timestamp("unblock_at").notNull(),
});

export const authMonitoring = pgTable("auth_monitoring", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  type: text("type").notNull(), // login_success, login_failure, token_refresh, rate_limit_hit
  userId: varchar("user_id").references(() => users.id),
  email: text("email"),
  ipAddress: text("ip_address"),
  metadata: text("metadata"), // JSON string for additional data
  createdAt: timestamp("created_at").defaultNow(),
});

export const authQueue = pgTable("auth_queue", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull(),
  queuePosition: integer("queue_position").notNull(),
  status: text("status").default("waiting"), // waiting, processing, completed, failed
  createdAt: timestamp("created_at").defaultNow(),
  processedAt: timestamp("processed_at"),
});

// Auth Events table for tracking authentication events
export const authEvents = pgTable("auth_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  type: varchar("type", { length: 50 }).notNull(), // login_attempt, login_success, login_failure, logout, token_refresh
  email: varchar("email", { length: 255 }),
  userId: varchar("user_id", { length: 100 }),
  ipAddress: varchar("ip_address", { length: 50 }),
  userAgent: text("user_agent"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Sessions table for managing user sessions
export const sessions = pgTable("sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id", { length: 100 }).notNull(),
  email: varchar("email", { length: 255 }).notNull(),
  rememberMe: boolean("remember_me").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  lastActiveAt: timestamp("last_active_at").defaultNow(),
  refreshToken: varchar("refresh_token", { length: 255 }),
});

export const events = pgTable("events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  venue: text("venue").notNull(), // Now expects full address
  country: text("country"), // Extracted country from venue address
  date: text("date").notNull(),
  time: text("time").notNull(),
  endDate: text("end_date"),
  endTime: text("end_time"),
  ticketPrice: decimal("ticket_price", { precision: 10, scale: 2 }).notNull(),
  maxTickets: integer("max_tickets"),
  userId: varchar("user_id").references(() => users.id),
  imageUrl: text("image_url"),
  ticketBackgroundUrl: text("ticket_background_url"),
  earlyValidation: text("early_validation").default("Allow at Anytime"),
  reentryType: text("reentry_type").default("No Reentry (Single Use)"),
  maxUses: integer("max_uses").default(1),
  goldenTicketEnabled: boolean("golden_ticket_enabled").default(false),
  goldenTicketCount: integer("golden_ticket_count"),
  allowMinting: boolean("allow_minting").default(false), // Allow attendees to mint tickets as NFTs
  isPrivate: boolean("is_private").default(false), // Private events are excluded from searches and boosts
  createdAt: timestamp("created_at").defaultNow(),
});

export const tickets = pgTable("tickets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  eventId: varchar("event_id").references(() => events.id).notNull(),
  userId: varchar("user_id").references(() => users.id),
  ticketNumber: text("ticket_number").notNull(),
  qrData: text("qr_data").notNull(),
  isValidated: boolean("is_validated").default(false),
  validatedAt: timestamp("validated_at"),
  validationCode: text("validation_code"), // The unique 4-digit code used when ticket was validated
  useCount: integer("use_count").default(0), // Number of times this ticket has been used
  isGoldenTicket: boolean("is_golden_ticket").default(false), // Whether this ticket won the golden ticket contest
  createdAt: timestamp("created_at").defaultNow(),
});

export const delegatedValidators = pgTable("delegated_validators", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  eventId: varchar("event_id").references(() => events.id).notNull(),
  email: text("email").notNull(),
  addedBy: varchar("added_by").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const systemLogs = pgTable("system_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  level: text("level").notNull(), // error, warning, info
  message: text("message").notNull(),
  source: text("source").notNull(), // file/function where error occurred
  userId: varchar("user_id").references(() => users.id),
  eventId: varchar("event_id").references(() => events.id),
  ticketId: varchar("ticket_id").references(() => tickets.id),
  errorCode: text("error_code"),
  stackTrace: text("stack_trace"),
  metadata: text("metadata"), // JSON string for additional context
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  url: text("url"),
  method: text("method"),
  createdAt: timestamp("created_at").defaultNow(),
  expiresAt: timestamp("expires_at").notNull().default(sql`CURRENT_TIMESTAMP + INTERVAL '90 days'`),
});

// Archived events table for event owners
export const archivedEvents = pgTable("archived_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  originalEventId: text("original_event_id").notNull(),
  csvData: text("csv_data").notNull(), // CSV format: name,venue,date,time,endDate,endTime,ticketPrice,totalTicketsSold,totalRevenue
  eventName: text("event_name").notNull(), // For quick searching
  eventDate: text("event_date").notNull(), // For sorting
  totalTicketsSold: integer("total_tickets_sold").default(0),
  totalRevenue: decimal("total_revenue", { precision: 10, scale: 2 }).default("0"),
  archivedAt: timestamp("archived_at").defaultNow(),
});

// Archived tickets table for ticket holders
export const archivedTickets = pgTable("archived_tickets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  originalTicketId: text("original_ticket_id").notNull(),
  originalEventId: text("original_event_id").notNull(),
  csvData: text("csv_data").notNull(), // CSV format: ticketNumber,eventName,venue,date,time,price,wasValidated,validatedAt
  eventName: text("event_name").notNull(), // For quick searching
  eventDate: text("event_date").notNull(), // For sorting
  ticketNumber: text("ticket_number").notNull(),
  wasValidated: boolean("was_validated").default(false),
  archivedAt: timestamp("archived_at").defaultNow(),
});

// Featured Events table for boosted events
export const featuredEvents = pgTable("featured_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  eventId: varchar("event_id").references(() => events.id).notNull(),
  duration: text("duration").notNull(), // "1hour", "6hours", "12hours", "24hours"
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time").notNull(),
  pricePaid: decimal("price_paid", { precision: 10, scale: 2 }).notNull(),
  isBumped: boolean("is_bumped").default(false), // Whether this was a bump-in for 2x price
  position: integer("position").notNull(), // Position in the carousel (1-100)
  createdAt: timestamp("created_at").defaultNow(),
});

// NFT Registry table for minted tickets
export const registryRecords = pgTable("registry_records", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ticketId: varchar("ticket_id").references(() => tickets.id).unique(), // One registry record per ticket
  eventId: varchar("event_id").references(() => events.id).notNull(),
  ownerId: varchar("owner_id").references(() => users.id).notNull(), // Current owner
  creatorId: varchar("creator_id").references(() => users.id).notNull(), // Original event creator
  title: text("title").notNull(),
  description: text("description").notNull(),
  metadata: text("metadata").notNull(), // JSON string with additional metadata
  mintedAt: timestamp("minted_at").defaultNow(),
  transferCount: integer("transfer_count").default(0),
  isListed: boolean("is_listed").default(false), // For future marketplace
  listPrice: decimal("list_price", { precision: 10, scale: 2 }),
  
  // Original ticket data
  ticketNumber: text("ticket_number").notNull(),
  eventName: text("event_name").notNull(),
  eventVenue: text("event_venue").notNull(),
  eventDate: text("event_date").notNull(),
  validatedAt: timestamp("validated_at").notNull(), // When ticket was first validated
});

// Registry transactions for tracking NFT transfers and royalties
export const registryTransactions = pgTable("registry_transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  registryId: varchar("registry_id").references(() => registryRecords.id).notNull(),
  fromUserId: varchar("from_user_id").references(() => users.id),
  toUserId: varchar("to_user_id").references(() => users.id).notNull(),
  transactionType: text("transaction_type").notNull(), // "mint", "transfer", "sale"
  price: decimal("price", { precision: 10, scale: 2 }),
  royaltyAmount: decimal("royalty_amount", { precision: 10, scale: 2 }), // 2.69% of sale price
  creatorRoyalty: decimal("creator_royalty", { precision: 10, scale: 2 }), // 75% of royalty (to event creator)
  platformFee: decimal("platform_fee", { precision: 10, scale: 2 }), // 25% of royalty
  transactionDate: timestamp("transaction_date").defaultNow(),
});

// Notifications table for the notifications center
export const notifications = pgTable("notifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  type: text("type").notNull(), // "system", "validation", "auth", "event", "ticket", "camera"
  title: text("title").notNull(),
  description: text("description").notNull(),
  isRead: boolean("is_read").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  expiresAt: timestamp("expires_at").notNull().default(sql`CURRENT_TIMESTAMP + INTERVAL '69 days'`),
});

// User notification preferences
export const notificationPreferences = pgTable("notification_preferences", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull().unique(),
  systemNotifications: boolean("system_notifications").default(true),
  validationNotifications: boolean("validation_notifications").default(true),
  authNotifications: boolean("auth_notifications").default(true),
  eventNotifications: boolean("event_notifications").default(true),
  ticketNotifications: boolean("ticket_notifications").default(true),
  cameraNotifications: boolean("camera_notifications").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  lastLoginAt: true,
});

export const insertAuthTokenSchema = createInsertSchema(authTokens).omit({
  id: true,
  createdAt: true,
  used: true,
});

export const insertEventSchema = createInsertSchema(events).omit({
  id: true,
  createdAt: true,
}).extend({
  name: z.string()
    .min(1, "Event name is required")
    .max(100, "Event name must be less than 100 characters")
    .regex(/^[a-zA-Z0-9\s\-_&.,!'"()]+$/, "Event name contains invalid characters"),
  description: z.string()
    .max(1000, "Description must be less than 1000 characters")
    .optional()
    .transform(val => val?.trim()),
  venue: z.string()
    .min(1, "Venue is required")
    .max(200, "Venue must be less than 200 characters")
    .regex(/^[a-zA-Z0-9\s\-_&.,!'"()#/@]+$/, "Venue contains invalid characters"),
  date: z.string()
    .min(1, "Date is required")
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format"),
  time: z.string()
    .min(1, "Time is required")
    .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Time must be in HH:MM format (24-hour)"),
  endDate: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "End date must be in YYYY-MM-DD format")
    .optional()
    .nullable(),
  endTime: z.string()
    .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "End time must be in HH:MM format (24-hour)")
    .optional()
    .nullable(),
  ticketPrice: z.string()
    .regex(/^\d+(\.\d{0,2})?$/, "Price must be a valid number with up to 2 decimal places")
    .transform(val => val)
    .refine(val => parseFloat(val) >= 0, "Price must be non-negative")
    .refine(val => parseFloat(val) <= 99999.99, "Price must be less than $100,000"),
  maxTickets: z.number()
    .int("Max tickets must be a whole number")
    .min(1, "Must allow at least 1 ticket")
    .max(100000, "Max tickets cannot exceed 100,000")
    .optional()
    .nullable(),
  earlyValidation: z.enum(["At Start Time", "One Hour Before", "Two Hours Before", "Allow at Anytime"]).optional().default("Allow at Anytime"),
  reentryType: z.enum(["No Reentry (Single Use)", "Pass (Multiple Use)", "No Limit"]).optional().default("No Reentry (Single Use)"),
  maxUses: z.number()
    .int("Max uses must be a whole number")
    .min(1, "Max uses must be at least 1")
    .max(24, "Max uses cannot exceed 24")
    .optional()
    .default(1),
  goldenTicketEnabled: z.boolean().optional().default(false),
  goldenTicketCount: z.number()
    .int("Golden ticket count must be a whole number")
    .min(1, "Must have at least 1 golden ticket if enabled")
    .max(100, "Golden tickets cannot exceed 100")
    .optional()
    .nullable(),
  allowMinting: z.boolean().optional().default(false),
  isPrivate: z.boolean().optional().default(false),
}).superRefine((data, ctx) => {
  // Validate that end date/time is after start date/time
  if (data.endDate && data.endTime) {
    const start = new Date(`${data.date} ${data.time}`);
    const end = new Date(`${data.endDate} ${data.endTime}`);
    
    if (end <= start) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "End date/time must be after start date/time",
        path: ["endDate"],
      });
    }
    
    // Check that event duration is reasonable (max 30 days)
    const daysDiff = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
    if (daysDiff > 30) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Event duration cannot exceed 30 days",
        path: ["endDate"],
      });
    }
  }
  
  // Validate golden ticket settings
  if (data.goldenTicketEnabled && !data.goldenTicketCount) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Golden ticket count is required when golden tickets are enabled",
      path: ["goldenTicketCount"],
    });
  }
  
  // Validate that golden tickets don't exceed max tickets
  if (data.maxTickets && data.goldenTicketCount && data.goldenTicketCount > data.maxTickets) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Golden ticket count cannot exceed max tickets",
      path: ["goldenTicketCount"],
    });
  }
});

export const insertTicketSchema = createInsertSchema(tickets).omit({
  id: true,
  createdAt: true,
}).extend({
  eventId: z.string()
    .uuid("Invalid event ID format")
    .min(1, "Event ID is required"),
  userId: z.string()
    .uuid("Invalid user ID format")
    .min(1, "User ID is required"),
  recipientName: z.string()
    .min(1, "Recipient name is required")
    .max(100, "Recipient name must be less than 100 characters")
    .regex(/^[a-zA-Z0-9\s\-'.]+$/, "Recipient name contains invalid characters"),
  recipientEmail: z.string()
    .email("Invalid email format")
    .max(200, "Email must be less than 200 characters"),
  seatNumber: z.string()
    .max(20, "Seat number must be less than 20 characters")
    .optional()
    .nullable(),
  ticketType: z.string()
    .max(50, "Ticket type must be less than 50 characters")
    .optional()
    .nullable(),
  transferable: z.boolean().optional().default(false),
  status: z.enum(["pending", "sent", "failed"]).optional().default("pending"),
});

export const insertDelegatedValidatorSchema = createInsertSchema(delegatedValidators).omit({
  id: true,
  createdAt: true,
});

export const insertSystemLogSchema = createInsertSchema(systemLogs).omit({
  id: true,
  createdAt: true,
  expiresAt: true,
});

export const insertArchivedEventSchema = createInsertSchema(archivedEvents).omit({
  id: true,
  archivedAt: true,
});

export const insertArchivedTicketSchema = createInsertSchema(archivedTickets).omit({
  id: true,
  archivedAt: true,
});

export const insertRegistryRecordSchema = createInsertSchema(registryRecords).omit({
  id: true,
  mintedAt: true,
  transferCount: true,
});

export const insertRegistryTransactionSchema = createInsertSchema(registryTransactions).omit({
  id: true,
  transactionDate: true,
});

export const insertFeaturedEventSchema = createInsertSchema(featuredEvents).omit({
  id: true,
  createdAt: true,
}).extend({
  duration: z.enum(["1hour", "6hours", "12hours", "24hours"]),
  startTime: z.date(),
  endTime: z.date(),
  pricePaid: z.string().regex(/^\d+(\.\d{1,2})?$/, "Invalid price format"),
  position: z.number().min(1).max(100),
});

export const insertNotificationSchema = createInsertSchema(notifications).omit({
  id: true,
  createdAt: true,
  expiresAt: true,
});

export const insertNotificationPreferencesSchema = createInsertSchema(notificationPreferences).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertLoginAttemptSchema = createInsertSchema(loginAttempts).omit({
  id: true,
  attemptedAt: true,
});

export const insertBlockedIpSchema = createInsertSchema(blockedIps).omit({
  id: true,
  blockedAt: true,
});

export const insertAuthMonitoringSchema = createInsertSchema(authMonitoring).omit({
  id: true,
  createdAt: true,
});

export const insertAuthQueueSchema = createInsertSchema(authQueue).omit({
  id: true,
  createdAt: true,
  processedAt: true,
});

export const insertAuthEventsSchema = createInsertSchema(authEvents).omit({
  id: true,
  createdAt: true
});

export const insertSessionsSchema = createInsertSchema(sessions).omit({
  id: true,
  createdAt: true,
  lastActiveAt: true
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertAuthToken = z.infer<typeof insertAuthTokenSchema>;
export type AuthToken = typeof authTokens.$inferSelect;
export type InsertEvent = z.infer<typeof insertEventSchema>;
export type Event = typeof events.$inferSelect;
export type InsertTicket = z.infer<typeof insertTicketSchema>;
export type Ticket = typeof tickets.$inferSelect;
export type InsertDelegatedValidator = z.infer<typeof insertDelegatedValidatorSchema>;
export type DelegatedValidator = typeof delegatedValidators.$inferSelect;
export type InsertSystemLog = z.infer<typeof insertSystemLogSchema>;
export type SystemLog = typeof systemLogs.$inferSelect;
export type InsertArchivedEvent = z.infer<typeof insertArchivedEventSchema>;
export type ArchivedEvent = typeof archivedEvents.$inferSelect;
export type InsertArchivedTicket = z.infer<typeof insertArchivedTicketSchema>;
export type ArchivedTicket = typeof archivedTickets.$inferSelect;
export type InsertRegistryRecord = z.infer<typeof insertRegistryRecordSchema>;
export type RegistryRecord = typeof registryRecords.$inferSelect;
export type InsertRegistryTransaction = z.infer<typeof insertRegistryTransactionSchema>;
export type RegistryTransaction = typeof registryTransactions.$inferSelect;
export type InsertFeaturedEvent = z.infer<typeof insertFeaturedEventSchema>;
export type FeaturedEvent = typeof featuredEvents.$inferSelect;
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type Notification = typeof notifications.$inferSelect;
export type InsertNotificationPreferences = z.infer<typeof insertNotificationPreferencesSchema>;
export type NotificationPreferences = typeof notificationPreferences.$inferSelect;
export type InsertLoginAttempt = z.infer<typeof insertLoginAttemptSchema>;
export type LoginAttempt = typeof loginAttempts.$inferSelect;
export type InsertBlockedIp = z.infer<typeof insertBlockedIpSchema>;
export type BlockedIp = typeof blockedIps.$inferSelect;
export type InsertAuthMonitoring = z.infer<typeof insertAuthMonitoringSchema>;
export type AuthMonitoring = typeof authMonitoring.$inferSelect;
export type InsertAuthQueue = z.infer<typeof insertAuthQueueSchema>;
export type AuthQueue = typeof authQueue.$inferSelect;
export type InsertAuthEvent = z.infer<typeof insertAuthEventsSchema>;
export type AuthEvent = typeof authEvents.$inferSelect;
export type InsertSession = z.infer<typeof insertSessionsSchema>;
export type Session = typeof sessions.$inferSelect;