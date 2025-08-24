import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, decimal, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
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

export const events = pgTable("events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  venue: text("venue").notNull(),
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
  goldenTicketNumber: integer("golden_ticket_number"),
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
  name: z.string().min(1, "Event name is required"),
  venue: z.string().min(1, "Venue is required"),
  date: z.string().min(1, "Date is required"),
  time: z.string().min(1, "Time is required"),
  earlyValidation: z.enum(["At Start Time", "One Hour Before", "Two Hours Before", "Allow at Anytime"]).optional().default("Allow at Anytime"),
  reentryType: z.enum(["No Reentry (Single Use)", "Pass (Multiple Use)", "No Limit"]).optional().default("No Reentry (Single Use)"),
  maxUses: z.number().min(1).max(24).optional().default(1),
  goldenTicketEnabled: z.boolean().optional().default(false),
  goldenTicketNumber: z.number().min(0).max(5000).optional(),
});

export const insertTicketSchema = createInsertSchema(tickets).omit({
  id: true,
  createdAt: true,
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