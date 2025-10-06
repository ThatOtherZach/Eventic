import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, decimal, integer, boolean, jsonb, unique, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").unique(), // Made nullable for Replit Auth (some providers don't provide email)
  displayName: text("display_name"),
  memberStatus: text("member_status").default("Legacy"), // Track account signup periods
  // Replit Auth fields
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  createdAt: timestamp("created_at").defaultNow(),
  lastLoginAt: timestamp("last_login_at"),
  deletionScheduledAt: timestamp("deletion_scheduled_at"), // When account deletion was scheduled (90-day grace period)
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Roles table for defining user roles
export const roles = pgTable("roles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(), // e.g., super_admin, event_moderator, support, user
  displayName: text("display_name").notNull(), // Human-readable name
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Permissions table for defining specific permissions
export const permissions = pgTable("permissions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(), // e.g., manage_events, manage_users, view_analytics
  displayName: text("display_name").notNull(), // Human-readable name
  description: text("description"),
  category: text("category"), // Group permissions by category (events, users, settings, etc.)
  createdAt: timestamp("created_at").defaultNow(),
});

// Junction table for role-permission associations
export const rolePermissions = pgTable("role_permissions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  roleId: varchar("role_id").references(() => roles.id, { onDelete: "cascade" }).notNull(),
  permissionId: varchar("permission_id").references(() => permissions.id, { onDelete: "cascade" }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  uniqueRolePermission: unique().on(table.roleId, table.permissionId),
}));

// User roles assignment table
export const userRoles = pgTable("user_roles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  roleId: varchar("role_id").references(() => roles.id, { onDelete: "cascade" }).notNull(),
  assignedBy: varchar("assigned_by").references(() => users.id), // Who assigned this role
  assignedAt: timestamp("assigned_at").defaultNow(),
}, (table) => ({
  uniqueUserRole: unique().on(table.userId, table.roleId),
}));

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

// Old sessions table - renamed to preserve existing data
export const userSessions = pgTable("user_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id", { length: 100 }).notNull(),
  email: varchar("email", { length: 255 }).notNull(),
  rememberMe: boolean("remember_me").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  lastActiveAt: timestamp("last_active_at").defaultNow(),
  refreshToken: varchar("refresh_token", { length: 255 }),
});

// Sessions table for Replit Auth (connect-pg-simple)
// (IMPORTANT) This table is mandatory for Replit Auth, don't drop it
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

export const events = pgTable("events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  contactDetails: text("contact_details"), // Contact info revealed to ticket holders only
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
  specialEffectsEnabled: boolean("special_effects_enabled").default(false), // Enable special visual effects on validated tickets
  stickerUrl: text("sticker_url"),
  stickerOdds: integer("sticker_odds").default(25), // Percentage chance (1-100)
  allowMinting: boolean("allow_minting").default(false), // Allow attendees to mint tickets as NFTs
  isAdminCreated: boolean("is_admin_created").default(false), // Whether this event was created by admin (@saymservices.com email)
  isPrivate: boolean("is_private").default(false), // Private events are excluded from searches and boosts
  isEnabled: boolean("is_enabled").default(true), // Whether event is publicly visible
  ticketPurchasesEnabled: boolean("ticket_purchases_enabled").default(true), // Whether new tickets can be purchased
  oneTicketPerUser: boolean("one_ticket_per_user").default(false), // Restrict users to one ticket per event
  surgePricing: boolean("surge_pricing").default(false), // Enable dynamic pricing based on ticket sales
  p2pValidation: boolean("p2p_validation").default(false), // Allow any ticket holder to validate other tickets for this event
  enableVoting: boolean("enable_voting").default(false), // Allow tickets to collect votes when P2P validation is enabled
  // GPS location fields for venue
  latitude: decimal("latitude", { precision: 10, scale: 7 }), // Latitude coordinate
  longitude: decimal("longitude", { precision: 10, scale: 7 }), // Longitude coordinate
  geofence: boolean("geofence").default(false), // Restrict validation to within 300 meters of GPS coordinates
  // Hunt feature fields (geocaching-style validation)
  treasureHunt: boolean("treasure_hunt").default(false), // Enable hunt feature (requires geofence)
  huntCode: varchar("hunt_code", { length: 50 }), // Unique ColorNoun code for hunt URL (e.g., "BlueTiger")
  rollingTimezone: boolean("rolling_timezone").default(false), // Event remains valid as start time hits each timezone
  // Timezone field
  timezone: text("timezone").default("America/New_York"), // Timezone for the event (IANA timezone format)
  // Hashtags extracted from description
  hashtags: text("hashtags").array().default(sql`ARRAY[]::text[]`), // Array of hashtags found in description
  // Bonus content for treasure hunt events
  bonusContent: text("bonus_content"), // Special content revealed after Hunt Code validation (max 1690 chars)
  // Payment processing configuration
  paymentProcessing: text("payment_processing").default("None"), // None, Ethereum, Bitcoin, USDC, Dogecoin
  walletAddress: text("wallet_address"), // Event owner's wallet address for receiving crypto payments
  paymentProcessingFee: integer("payment_processing_fee").default(0), // Tickets spent on payment configuration (non-refundable)
  allowPrepay: boolean("allow_prepay").default(false), // Allow crypto payments before event starts
  // Recurring event fields
  recurringType: text("recurring_type"), // "weekly", "monthly", "annually", "annual", null for non-recurring
  recurringEndDate: text("recurring_end_date"), // End date for recurring events
  // UTC timestamps for validation - computed from date/time/timezone when saving
  startAtUtc: timestamp("start_at_utc"), // Event start time in UTC
  endAtUtc: timestamp("end_at_utc"), // Event end time in UTC (if endDate/endTime provided)
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  // Index for filtering active events efficiently
  activeEventsIdx: index("active_events_idx").on(table.startAtUtc, table.endAtUtc, table.isEnabled, table.isPrivate),
  // Index for efficient hunt code lookups (case-insensitive)
  huntCodeIdx: index("hunt_code_idx").on(table.huntCode, table.treasureHunt),
  // Index for country-based filtering
  countryIdx: index("country_idx").on(table.country),
  // Composite index for hunt code lookups filtered by country
  huntCodeCountryIdx: index("hunt_code_country_idx").on(table.country, table.huntCode, table.treasureHunt),
}));

export const cryptoPaymentIntents = pgTable("crypto_payment_intents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ticketId: varchar("ticket_id").references(() => tickets.id).notNull().unique(),
  eventId: varchar("event_id").references(() => events.id).notNull(),
  reference: varchar("reference", { length: 50 }).notNull().unique(), // Format: Ta4f2c891K1736424325T
  receiverAddress: text("receiver_address").notNull(), // Event creator's wallet address
  blockchain: text("blockchain").notNull(), // Bitcoin, Ethereum, USDC, Dogecoin
  amountCrypto: decimal("amount_crypto", { precision: 20, scale: 8 }).notNull(), // Amount in cryptocurrency
  amountUsd: decimal("amount_usd", { precision: 10, scale: 2 }).notNull(), // USD value at time of creation
  status: text("status").default("pending"), // pending, monitoring, confirmed, expired
  monitoringExpiresAt: timestamp("monitoring_expires_at"), // When monitoring window expires
  transactionHash: text("transaction_hash"), // Blockchain transaction hash when confirmed
  createdAt: timestamp("created_at").defaultNow(),
  confirmedAt: timestamp("confirmed_at"), // When payment was confirmed on blockchain
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
  voteCount: integer("vote_count").default(0), // Number of votes received (for voting-enabled events)
  isGoldenTicket: boolean("is_golden_ticket").default(false), // Whether this ticket won the golden ticket contest
  isDoubleGolden: boolean("is_double_golden").default(false), // Whether this ticket is both random golden AND most voted (rainbow effect)
  specialEffect: text("special_effect"), // Locked special effect type (snowflakes, hearts, spooky, etc.) determined at validation
  recipientName: text("recipient_name"),
  recipientEmail: text("recipient_email"),
  seatNumber: text("seat_number"),
  ticketType: text("ticket_type"),
  transferable: boolean("transferable").default(false),
  status: text("status").default("pending"), // pending, sent, failed
  purchaserEmail: text("purchaser_email"), // Email of the person who purchased this ticket
  purchaserIp: text("purchaser_ip"), // IP address of the person who purchased this ticket
  purchasePrice: decimal("purchase_price", { precision: 10, scale: 2 }), // Original purchase price (for resale price enforcement)
  resellStatus: text("resell_status").default("not_for_resale"), // not_for_resale, for_resale, sold
  originalOwnerId: varchar("original_owner_id").references(() => users.id), // Original owner for resell tracking
  isCharged: boolean("is_charged").default(false), // Whether ticket is charged for better special effects odds
  nftMediaUrl: text("nft_media_url"), // URL to the pre-generated MP4 file for NFT minting
  scheduledDeletion: timestamp("scheduled_deletion"), // When this ticket should be automatically deleted (69 days after event end)
  paymentConfirmed: boolean("payment_confirmed").default(false), // Whether payment has been confirmed for this ticket (for paid events)
  createdAt: timestamp("created_at").defaultNow(),
});

export const delegatedValidators = pgTable("delegated_validators", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  eventId: varchar("event_id").references(() => events.id).notNull(),
  email: text("email").notNull(),
  addedBy: varchar("added_by").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Resell queue for tickets put up for resale
export const resellQueue = pgTable("resell_queue", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ticketId: varchar("ticket_id").references(() => tickets.id).notNull().unique(),
  eventId: varchar("event_id").references(() => events.id).notNull(),
  originalOwnerId: varchar("original_owner_id").references(() => users.id).notNull(), // User who put ticket for resale
  ticketPrice: decimal("ticket_price", { precision: 10, scale: 2 }).notNull(), // Original ticket price
  position: integer("position").notNull(), // Position in resell queue (1 is next to be sold)
  createdAt: timestamp("created_at").defaultNow(),
});

export const resellTransactions = pgTable("resell_transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ticketId: varchar("ticket_id").references(() => tickets.id).notNull(),
  eventId: varchar("event_id").references(() => events.id).notNull(),
  originalOwnerId: varchar("original_owner_id").references(() => users.id).notNull(), // Seller
  newOwnerId: varchar("new_owner_id").references(() => users.id).notNull(), // Buyer
  ticketPrice: decimal("ticket_price", { precision: 10, scale: 2 }).notNull(), // Original ticket price
  platformFee: decimal("platform_fee", { precision: 10, scale: 2 }).notNull(), // 2% platform fee
  sellerAmount: decimal("seller_amount", { precision: 10, scale: 2 }).notNull(), // Amount paid to seller (price - fee)
  createdAt: timestamp("created_at").defaultNow(),
});

// Event ratings table for reputation system - one vote per event per user
export const eventRatings = pgTable("event_ratings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ticketId: varchar("ticket_id").references(() => tickets.id).notNull().unique(), // One vote per ticket
  eventId: varchar("event_id").references(() => events.id).notNull(),
  eventOwnerId: varchar("event_owner_id").references(() => users.id).notNull(), // Track who gets the rating
  rating: text("rating").notNull(), // "thumbs_up" or "thumbs_down"
  ratedAt: timestamp("rated_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(), // Track when vote was cast/changed
});

// Cached User Reputation table (updated hourly)
export const userReputationCache = pgTable("user_reputation_cache", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull().unique(),
  thumbsUp: integer("thumbs_up").default(0).notNull(),
  thumbsDown: integer("thumbs_down").default(0).notNull(),
  percentage: integer("percentage"), // null if no ratings
  lastUpdated: timestamp("last_updated").defaultNow(),
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

// Currency Ledger System - Double-entry bookkeeping for Tickets currency
export const currencyLedger = pgTable("currency_ledger", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  transactionId: varchar("transaction_id").notNull(), // Groups debit and credit entries together
  accountId: varchar("account_id").notNull(), // Account identifier (user ID or system accounts)
  accountType: text("account_type").notNull(), // user, system_revenue, system_fees, system_rewards, etc.
  entryType: text("entry_type").notNull(), // debit or credit
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(), // Always positive
  balance: decimal("balance", { precision: 10, scale: 2 }).notNull(), // Running balance after this entry
  transactionType: text("transaction_type").notNull(), // purchase, sale, refund, reward, fee, transfer, etc.
  description: text("description").notNull(),
  metadata: text("metadata"), // JSON string with transaction details
  relatedEntityId: varchar("related_entity_id"), // Reference to ticket, event, etc.
  relatedEntityType: text("related_entity_type"), // ticket, event, resell_transaction, etc.
  createdAt: timestamp("created_at").defaultNow(),
  createdBy: varchar("created_by").references(() => users.id), // Who initiated the transaction
});

// Account Balances - Cached view of current balances
export const accountBalances = pgTable("account_balances", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  accountId: varchar("account_id").notNull().unique(), // User ID or system account ID
  accountType: text("account_type").notNull(), // user, system_revenue, system_fees, etc.
  balance: decimal("balance", { precision: 10, scale: 2 }).notNull().default("0"),
  holdBalance: decimal("hold_balance", { precision: 10, scale: 2 }).notNull().default("0"), // Amount on hold (pending transactions)
  availableBalance: decimal("available_balance", { precision: 10, scale: 2 }).notNull().default("0"), // balance - holdBalance
  lastTransactionId: varchar("last_transaction_id"), // Last ledger transaction for this account
  lastUpdated: timestamp("last_updated").defaultNow(),
});

// Transaction Templates - Define standard transactions
export const transactionTemplates = pgTable("transaction_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  code: text("code").notNull().unique(), // TICKET_PURCHASE, TICKET_RESELL, etc.
  name: text("name").notNull(),
  description: text("description"),
  debitAccount: text("debit_account").notNull(), // Account to debit
  creditAccount: text("credit_account").notNull(), // Account to credit
  requiresApproval: boolean("requires_approval").default(false),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// Currency Transaction Holds - For pending transactions
export const currencyHolds = pgTable("currency_holds", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  accountId: varchar("account_id").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  reason: text("reason").notNull(),
  relatedEntityId: varchar("related_entity_id"),
  relatedEntityType: text("related_entity_type"),
  status: text("status").notNull().default("active"), // active, released, expired
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow(),
  releasedAt: timestamp("released_at"),
});

// Daily Ticket Claims tracking
export const dailyClaims = pgTable("daily_claims", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  claimedAt: timestamp("claimed_at").defaultNow().notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  nextClaimAt: timestamp("next_claim_at").notNull(),
});

// Admin Claims tracking (separate from daily claims for admins)
export const adminClaims = pgTable("admin_claims", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  claimedAt: timestamp("claimed_at").defaultNow().notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  nextClaimAt: timestamp("next_claim_at").notNull(),
});

// NFT Registry table for minted tickets
export const registryRecords = pgTable("registry_records", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ticketId: varchar("ticket_id").references(() => tickets.id, { onDelete: "set null" }).unique(), // Can be null after ticket deletion
  eventId: varchar("event_id").references(() => events.id, { onDelete: "set null" }), // Can be null after event deletion
  ownerId: varchar("owner_id").references(() => users.id).notNull(), // Current owner
  creatorId: varchar("creator_id").references(() => users.id).notNull(), // Original event creator
  title: text("title").notNull(),
  description: text("description").notNull(),
  metadata: text("metadata").notNull(), // JSON string with additional metadata
  imageUrl: text("image_url"), // GIF image of the ticket
  mintedAt: timestamp("minted_at").defaultNow(),
  transferCount: integer("transfer_count").default(0),
  isListed: boolean("is_listed").default(false), // For future marketplace
  listPrice: decimal("list_price", { precision: 10, scale: 2 }),
  
  // Complete ticket data preservation
  ticketNumber: text("ticket_number").notNull(),
  ticketStatus: text("ticket_status").notNull(), // validated, pending, etc
  ticketValidatedAt: timestamp("ticket_validated_at"), // When ticket was validated
  ticketValidatedBy: varchar("ticket_validated_by"), // Who validated it
  ticketCreatedAt: timestamp("ticket_created_at").notNull(),
  // PII removed - no longer storing recipient name/email
  ticketSeatNumber: text("ticket_seat_number"),
  ticketType: text("ticket_type"),
  ticketTransferable: boolean("ticket_transferable").default(false),
  ticketUsageCount: integer("ticket_usage_count").default(0),
  ticketMaxUses: integer("ticket_max_uses").default(1),
  ticketIsGolden: boolean("ticket_is_golden").default(false),
  ticketNftMediaUrl: text("ticket_nft_media_url"),
  ticketQrCode: text("ticket_qr_code"),
  ticketValidationCode: text("ticket_validation_code"), // The 4-digit code used for validation
  ticketVoteCount: integer("ticket_vote_count").default(0), // Number of votes received
  ticketIsDoubleGolden: boolean("ticket_is_double_golden").default(false), // Both random golden AND most voted
  ticketSpecialEffect: text("ticket_special_effect"), // Locked special effect type
  // PII removed - no longer storing purchaser email/IP
  ticketPurchasePrice: decimal("ticket_purchase_price", { precision: 10, scale: 2 }), // Original purchase price
  ticketResellStatus: text("ticket_resell_status"), // not_for_resale, for_resale, sold
  ticketOriginalOwnerId: varchar("ticket_original_owner_id"), // Original owner for resell tracking
  ticketIsCharged: boolean("ticket_is_charged").default(false), // Whether ticket was charged for better effects
  
  // Hunt metadata (if ticket was obtained via hunt)
  huntCode: text("hunt_code"), // Hunt code used to claim the ticket (e.g., "REDBEAR")
  huntClaimLatitude: decimal("hunt_claim_latitude", { precision: 10, scale: 7 }), // GPS latitude where claimed
  huntClaimLongitude: decimal("hunt_claim_longitude", { precision: 11, scale: 7 }), // GPS longitude where claimed
  
  // Complete event data preservation  
  eventName: text("event_name").notNull(),
  eventDescription: text("event_description").notNull(),
  eventVenue: text("event_venue").notNull(),
  eventDate: text("event_date").notNull(),
  eventTime: text("event_time").notNull(),
  eventEndDate: text("event_end_date"),
  eventEndTime: text("event_end_time"),
  eventImageUrl: text("event_image_url"),
  eventMaxTickets: integer("event_max_tickets"),
  eventTicketsSold: integer("event_tickets_sold"),
  eventTicketPrice: decimal("event_ticket_price", { precision: 10, scale: 2 }),
  eventEventTypes: text("event_event_types").array(), // Event type badges
  eventReentryType: text("event_reentry_type"),
  eventGoldenTicketEnabled: boolean("event_golden_ticket_enabled").default(false),
  eventGoldenTicketCount: integer("event_golden_ticket_count"),
  eventAllowMinting: boolean("event_allow_minting").default(false),
  eventIsPrivate: boolean("event_is_private").default(false),
  eventOneTicketPerUser: boolean("event_one_ticket_per_user").default(false),
  eventSurgePricing: boolean("event_surge_pricing").default(false),
  eventP2pValidation: boolean("event_p2p_validation").default(false),
  eventEnableVoting: boolean("event_enable_voting").default(false),
  eventRecurringType: text("event_recurring_type"),
  eventRecurringEndDate: text("event_recurring_end_date"),
  eventCreatedAt: timestamp("event_created_at").notNull(),
  eventStickerUrl: text("event_sticker_url"), // GIF sticker URL for the event
  eventSpecialEffectsEnabled: boolean("event_special_effects_enabled").default(false),
  eventGeofence: text("event_geofence"), // JSON string with geofence data
  eventIsAdminCreated: boolean("event_is_admin_created").default(false),
  eventContactDetails: text("event_contact_details"), // Contact details revealed to ticket holders
  eventCountry: text("event_country"), // Country extracted from venue
  eventTicketBackgroundUrl: text("event_ticket_background_url"), // Custom ticket background
  eventEarlyValidation: text("event_early_validation"), // Early validation policy
  eventMaxUses: integer("event_max_uses"), // Max uses per ticket
  eventStickerOdds: integer("event_sticker_odds"), // Sticker appearance odds
  eventIsEnabled: boolean("event_is_enabled").default(true), // Whether event is visible
  eventTicketPurchasesEnabled: boolean("event_ticket_purchases_enabled").default(true), // Whether purchases are enabled
  eventLatitude: decimal("event_latitude", { precision: 10, scale: 7 }), // GPS latitude
  eventLongitude: decimal("event_longitude", { precision: 10, scale: 7 }), // GPS longitude
  eventParentEventId: varchar("event_parent_event_id"), // Parent for recurring events
  eventLastRecurrenceCreated: timestamp("event_last_recurrence_created"), // Last recurrence creation
  eventTimezone: text("event_timezone"), // Event timezone
  eventRollingTimezone: boolean("event_rolling_timezone").default(false), // Event remains valid as time hits each timezone
  eventHashtags: text("event_hashtags").array(), // Hashtags from description
  eventTreasureHunt: boolean("event_treasure_hunt").default(false), // Hunt feature enabled
  eventHuntCode: text("event_hunt_code"), // Unique Hunt code (e.g., "BlueTiger")
  eventBonusContent: text("event_bonus_content"), // Bonus content from treasure hunt
  
  // User data preservation
  creatorUsername: text("creator_username").notNull(),
  creatorDisplayName: text("creator_display_name"),
  ownerUsername: text("owner_username").notNull(),
  ownerDisplayName: text("owner_display_name"),
  
  // Binary data storage for complete preservation
  eventImageData: text("event_image_data"), // Base64 encoded event featured image
  eventStickerData: text("event_sticker_data"), // Base64 encoded sticker GIF
  ticketBackgroundData: text("ticket_background_data"), // Base64 encoded ticket background
  ticketGifData: text("ticket_gif_data"), // Base64 encoded generated ticket GIF
  
  // Sync tracking for Supabase
  synced: boolean("synced").default(false), // Whether synced to Supabase
  syncedAt: timestamp("synced_at"), // When last synced to Supabase
  
  // NFT minting tracking
  walletAddress: text("wallet_address"), // User's wallet address for NFT delivery
  nftMinted: boolean("nft_minted").default(false), // Whether NFT has been minted on-chain
  nftMintingStatus: text("nft_minting_status").default("not_minted"), // not_minted, pending, minted, failed
  nftTransactionHash: text("nft_transaction_hash"), // Blockchain transaction hash
  nftTokenId: text("nft_token_id"), // Token ID on the NFT contract
  nftContractAddress: text("nft_contract_address"), // NFT contract address
  nftMintedAt: timestamp("nft_minted_at"), // When NFT was minted on-chain
  nftMintCost: integer("nft_mint_cost").default(12), // Cost in tickets to mint
  
  // Compression tracking for long-term storage optimization
  isCompressed: boolean("is_compressed").default(false), // Whether images have been compressed
  lastAccessed: timestamp("last_accessed").defaultNow(), // Last time NFT was viewed
  compressionDate: timestamp("compression_date"), // When compression was applied
  
  validatedAt: timestamp("validated_at").notNull(), // Preserved for backward compat
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

// NFT transaction monitoring sessions - user-initiated, time-limited tracking
export const nftMonitoringSessions = pgTable("nft_monitoring_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  registryId: varchar("registry_id").references(() => registryRecords.id).notNull(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  transactionHash: text("transaction_hash").notNull(),
  walletAddress: text("wallet_address").notNull(),
  chainId: integer("chain_id").notNull().default(8453), // Base mainnet
  status: text("status").notNull().default("pending"), // pending, confirmed, failed, expired
  confirmations: integer("confirmations").default(0),
  tokenId: text("token_id"), // NFT token ID if minted successfully
  blockNumber: integer("block_number"), // Block where transaction was included
  gasUsed: text("gas_used"), // Actual gas used
  effectiveGasPrice: text("effective_gas_price"), // Gas price in wei
  errorReason: text("error_reason"), // Error message if failed
  createdAt: timestamp("created_at").defaultNow(),
  expiresAt: timestamp("expires_at").notNull(), // 10 minutes from creation
  lastCheckedAt: timestamp("last_checked_at"),
  confirmedAt: timestamp("confirmed_at"), // When transaction was confirmed
}, (table) => ({
  transactionHashIdx: index("nft_monitoring_tx_hash_idx").on(table.transactionHash),
  expiresAtIdx: index("nft_monitoring_expires_idx").on(table.expiresAt),
  userIdx: index("nft_monitoring_user_idx").on(table.userId),
}));

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

// Validation actions table to track who performed each validation
export const validationActions = pgTable("validation_actions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  validatorId: varchar("validator_id").references(() => users.id).notNull(), // Who performed the validation
  ticketId: varchar("ticket_id").references(() => tickets.id).notNull(), // Which ticket was validated
  eventId: varchar("event_id").references(() => events.id).notNull(), // Which event
  validationCode: text("validation_code"), // The 4-digit code or token used
  validatedAt: timestamp("validated_at").defaultNow(),
});

// Secret codes for free ticket redemption
export const secretCodes = pgTable("secret_codes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  code: text("code").notNull().unique(),
  ticketAmount: integer("ticket_amount").notNull(), // Number of tickets this code gives
  maxUses: integer("max_uses"), // null for unlimited
  currentUses: integer("current_uses").default(0),
  expiresAt: timestamp("expires_at"),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  isActive: boolean("is_active").default(true),
  codeType: text("code_type").default("regular"), // "regular" or "hunt"
  eventId: varchar("event_id").references(() => events.id), // For hunt codes, links to event
  huntLatitude: decimal("hunt_latitude", { precision: 10, scale: 7 }), // GPS coordinates for hunt codes
  huntLongitude: decimal("hunt_longitude", { precision: 11, scale: 7 }),
});

// Track who redeemed secret codes
export const codeRedemptions = pgTable("code_redemptions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  codeId: varchar("code_id").references(() => secretCodes.id).notNull(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  redeemedAt: timestamp("redeemed_at").defaultNow(),
}, (table) => ({
  uniqueUserCode: unique().on(table.userId, table.codeId), // Prevent same user from redeeming same code twice
}));

// Ticket purchases through Stripe
export const ticketPurchases = pgTable("ticket_purchases", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  quantity: integer("quantity").notNull(),
  unitPrice: decimal("unit_price", { precision: 10, scale: 2 }).notNull(), // Price per ticket
  totalAmount: decimal("total_amount", { precision: 10, scale: 2 }).notNull(),
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  stripeSessionId: text("stripe_session_id"),
  status: text("status").default("pending"), // pending, completed, failed, refunded
  purchasedAt: timestamp("purchased_at").defaultNow(),
});

// Scheduled deletion jobs table for efficient event archiving
export const scheduledJobs = pgTable("scheduled_jobs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  jobType: text("job_type").notNull(), // 'archive_event'
  targetId: varchar("target_id").notNull(), // Event ID to archive
  scheduledFor: timestamp("scheduled_for").notNull(), // When to run this job
  status: text("status").default("pending"), // pending, processing, completed, failed
  attempts: integer("attempts").default(0), // Number of execution attempts
  lastAttemptAt: timestamp("last_attempt_at"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow(),
  completedAt: timestamp("completed_at"),
});

// Platform Headers table for dynamic homepage content
export const platformHeaders = pgTable("platform_headers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  subtitle: text("subtitle").notNull(),
  active: boolean("active").default(true).notNull(),
  displayOrder: integer("display_order"), // Optional ordering if needed
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// System Settings table for global configuration
export const systemSettings = pgTable("system_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  key: text("key").notNull().unique(), // Setting key (e.g., 'banned_words')
  value: text("value").notNull(), // Setting value (comma-separated for lists)
  description: text("description"), // Description of the setting
  updatedAt: timestamp("updated_at").defaultNow(),
  updatedBy: varchar("updated_by"), // User ID who last updated
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
  startAtUtc: true,  // Computed server-side from date/time/timezone
  endAtUtc: true,    // Computed server-side from endDate/endTime/timezone
}).extend({
  name: z.string()
    .min(1, "Event name is required")
    .max(100, "Event name must be less than 100 characters")
    .regex(/^[a-zA-Z0-9\s\-_&.,!'"()]+$/, "Event name contains invalid characters"),
  description: z.string()
    .max(1000, "Description must be less than 1000 characters")
    .optional()
    .nullable()
    .transform(val => val?.trim() || null),
  contactDetails: z.string()
    .max(150, "Contact details must be less than 150 characters")
    .optional()
    .nullable()
    .transform(val => val?.trim() || null),
  venue: z.string()
    .min(1, "A venue name is required. City and Country are optional.")
    .max(200, "Venue must be less than 200 characters")
    .regex(/^[a-zA-Z0-9\s\-_&.,!'"()#/@]+$/, "Venue contains invalid characters"),
  date: z.string()
    .min(1, "Date is required")
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format"),
  time: z.string()
    .min(1, "Time is required")
    .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Time must be in HH:MM format (24-hour)"),
  endDate: z.string()
    .transform(val => val === '' ? null : val)
    .nullable()
    .optional()
    .superRefine((val, ctx) => {
      if (val && val !== null && !/^\d{4}-\d{2}-\d{2}$/.test(val)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "End date must be in YYYY-MM-DD format",
        });
      }
    }),
  endTime: z.string()
    .transform(val => val === '' ? null : val)
    .nullable()
    .optional()
    .superRefine((val, ctx) => {
      if (val && val !== null && !/^([01]\d|2[0-3]):([0-5]\d)$/.test(val)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "End time must be in HH:MM format (24-hour)",
        });
      }
    }),
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
  oneTicketPerUser: z.boolean().optional().default(false),
  surgePricing: z.boolean().optional().default(false),
  p2pValidation: z.boolean().optional().default(false),
  enableVoting: z.boolean().optional().default(false),
  paymentProcessing: z.enum(["None", "Ethereum", "Bitcoin", "USDC", "Dogecoin"]).optional().default("None"),
  walletAddress: z.string().optional().nullable(),
  allowPrepay: z.boolean().optional().default(false),
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
  
  // Validate minimum price for surge pricing
  if (data.surgePricing && (!data.ticketPrice || parseFloat(data.ticketPrice.toString()) < 1.00)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Base price must be at least $1.00 when surge pricing is enabled",
      path: ["ticketPrice"],
    });
  }

  // Validate that enableVoting requires p2pValidation
  if (data.enableVoting && !data.p2pValidation) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "P2P Validation must be enabled to use voting feature",
      path: ["enableVoting"],
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

export const insertCryptoPaymentIntentSchema = createInsertSchema(cryptoPaymentIntents).omit({
  id: true,
  createdAt: true,
});

export const insertDelegatedValidatorSchema = createInsertSchema(delegatedValidators).omit({
  id: true,
  createdAt: true,
});

export const insertResellTransactionSchema = createInsertSchema(resellTransactions).omit({
  id: true,
  createdAt: true,
});

export const insertEventRatingSchema = createInsertSchema(eventRatings).omit({
  id: true,
  ratedAt: true,
}).extend({
  rating: z.enum(["thumbs_up", "thumbs_down"]),
});

export const insertUserReputationCacheSchema = createInsertSchema(userReputationCache).omit({
  id: true,
  lastUpdated: true,
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

export const insertNftMonitoringSessionSchema = createInsertSchema(nftMonitoringSessions).omit({
  id: true,
  createdAt: true,
  confirmations: true,
  status: true,
  lastCheckedAt: true,
  confirmedAt: true,
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

export const insertResellQueueSchema = createInsertSchema(resellQueue).omit({
  id: true,
  createdAt: true,
});

export const insertCurrencyLedgerSchema = createInsertSchema(currencyLedger).omit({
  id: true,
  createdAt: true,
  balance: true, // Balance is calculated, not inserted
});

export const insertAccountBalanceSchema = createInsertSchema(accountBalances).omit({
  id: true,
  lastUpdated: true,
  availableBalance: true, // Calculated field
});

export const insertTransactionTemplateSchema = createInsertSchema(transactionTemplates).omit({
  id: true,
  createdAt: true,
});

export const insertCurrencyHoldSchema = createInsertSchema(currencyHolds).omit({
  id: true,
  createdAt: true,
  releasedAt: true,
});

export const insertDailyClaimSchema = createInsertSchema(dailyClaims).omit({
  id: true,
  claimedAt: true,
});

export const insertAdminClaimSchema = createInsertSchema(adminClaims).omit({
  id: true,
  claimedAt: true,
});

export const insertSecretCodeSchema = createInsertSchema(secretCodes).omit({
  id: true,
  createdAt: true,
  currentUses: true,
});

export const insertCodeRedemptionSchema = createInsertSchema(codeRedemptions).omit({
  id: true,
  redeemedAt: true,
});

export const insertTicketPurchaseSchema = createInsertSchema(ticketPurchases).omit({
  id: true,
  purchasedAt: true,
});

export const insertScheduledJobSchema = createInsertSchema(scheduledJobs).omit({
  id: true,
  createdAt: true,
  completedAt: true,
  lastAttemptAt: true,
  attempts: true,
});

export const insertPlatformHeaderSchema = createInsertSchema(platformHeaders).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSystemSettingSchema = createInsertSchema(systemSettings).omit({
  id: true,
  updatedAt: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
// UpsertUser type for Replit Auth
export type UpsertUser = typeof users.$inferInsert;
export type InsertAuthToken = z.infer<typeof insertAuthTokenSchema>;
export type AuthToken = typeof authTokens.$inferSelect;
export type InsertEvent = z.infer<typeof insertEventSchema>;
export type Event = typeof events.$inferSelect;
export type InsertTicket = z.infer<typeof insertTicketSchema>;
export type Ticket = typeof tickets.$inferSelect;
export type InsertCryptoPaymentIntent = z.infer<typeof insertCryptoPaymentIntentSchema>;
export type CryptoPaymentIntent = typeof cryptoPaymentIntents.$inferSelect;
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
export type InsertNftMonitoringSession = z.infer<typeof insertNftMonitoringSessionSchema>;
export type NftMonitoringSession = typeof nftMonitoringSessions.$inferSelect;
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
export type InsertResellQueue = z.infer<typeof insertResellQueueSchema>;
export type ResellQueue = typeof resellQueue.$inferSelect;
export type InsertResellTransaction = z.infer<typeof insertResellTransactionSchema>;
export type ResellTransaction = typeof resellTransactions.$inferSelect;
export type InsertEventRating = z.infer<typeof insertEventRatingSchema>;
export type EventRating = typeof eventRatings.$inferSelect;
export type InsertUserReputationCache = z.infer<typeof insertUserReputationCacheSchema>;
export type UserReputationCache = typeof userReputationCache.$inferSelect;
export type InsertCurrencyLedger = z.infer<typeof insertCurrencyLedgerSchema>;
export type CurrencyLedger = typeof currencyLedger.$inferSelect;
export type InsertAccountBalance = z.infer<typeof insertAccountBalanceSchema>;
export type AccountBalance = typeof accountBalances.$inferSelect;
export type InsertTransactionTemplate = z.infer<typeof insertTransactionTemplateSchema>;
export type TransactionTemplate = typeof transactionTemplates.$inferSelect;
export type InsertCurrencyHold = z.infer<typeof insertCurrencyHoldSchema>;
export type CurrencyHold = typeof currencyHolds.$inferSelect;
export type InsertDailyClaim = z.infer<typeof insertDailyClaimSchema>;
export type DailyClaim = typeof dailyClaims.$inferSelect;
export type InsertAdminClaim = z.infer<typeof insertAdminClaimSchema>;
export type AdminClaim = typeof adminClaims.$inferSelect;
export type InsertSecretCode = z.infer<typeof insertSecretCodeSchema>;
export type SecretCode = typeof secretCodes.$inferSelect;
export type InsertCodeRedemption = z.infer<typeof insertCodeRedemptionSchema>;
export type CodeRedemption = typeof codeRedemptions.$inferSelect;
export type InsertTicketPurchase = z.infer<typeof insertTicketPurchaseSchema>;
export type TicketPurchase = typeof ticketPurchases.$inferSelect;
export type InsertScheduledJob = z.infer<typeof insertScheduledJobSchema>;
export type ScheduledJob = typeof scheduledJobs.$inferSelect;
export type InsertPlatformHeader = z.infer<typeof insertPlatformHeaderSchema>;
export type PlatformHeader = typeof platformHeaders.$inferSelect;
export type InsertSystemSetting = z.infer<typeof insertSystemSettingSchema>;
export type SystemSetting = typeof systemSettings.$inferSelect;

// Role and permission schemas
export const insertRoleSchema = createInsertSchema(roles).omit({
  id: true,
  createdAt: true,
});

export const insertPermissionSchema = createInsertSchema(permissions).omit({
  id: true,
  createdAt: true,
});

export const insertRolePermissionSchema = createInsertSchema(rolePermissions).omit({
  id: true,
  createdAt: true,
});

export const insertUserRoleSchema = createInsertSchema(userRoles).omit({
  id: true,
  assignedAt: true,
});

export type InsertRole = z.infer<typeof insertRoleSchema>;
export type Role = typeof roles.$inferSelect;
export type InsertPermission = z.infer<typeof insertPermissionSchema>;
export type Permission = typeof permissions.$inferSelect;
export type InsertRolePermission = z.infer<typeof insertRolePermissionSchema>;
export type RolePermission = typeof rolePermissions.$inferSelect;
export type InsertUserRole = z.infer<typeof insertUserRoleSchema>;
export type UserRole = typeof userRoles.$inferSelect;