import { type Event, type InsertEvent, type Ticket, type InsertTicket, type User, type InsertUser, type AuthToken, type InsertAuthToken, type DelegatedValidator, type InsertDelegatedValidator, type SystemLog, type ArchivedEvent, type InsertArchivedEvent, type ArchivedTicket, type InsertArchivedTicket, type RegistryRecord, type InsertRegistryRecord, type RegistryTransaction, type InsertRegistryTransaction, type FeaturedEvent, type InsertFeaturedEvent, type Notification, type InsertNotification, type NotificationPreferences, type InsertNotificationPreferences, users, authTokens, events, tickets, delegatedValidators, systemLogs, archivedEvents, archivedTickets, registryRecords, registryTransactions, featuredEvents, notifications, notificationPreferences } from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, count, gt, lt, notInArray, sql } from "drizzle-orm";
import { randomUUID } from "crypto";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserById(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUserLoginTime(id: string): Promise<User | undefined>;
  updateUserProfile(id: string, updates: { locations?: string }): Promise<User | undefined>;
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
  deleteEvent(id: string): Promise<boolean>;
  
  // Tickets
  getTickets(): Promise<Ticket[]>;
  getTicketsByEventId(eventId: string): Promise<Ticket[]>;
  getTicketsByUserId(userId: string): Promise<Ticket[]>;
  getTicketsByEventAndUser(eventId: string, userId: string): Promise<Ticket[]>;
  getTicket(id: string): Promise<Ticket | undefined>;
  getTicketByQrData(qrData: string): Promise<Ticket | undefined>;
  createTicket(ticket: InsertTicket): Promise<Ticket>;
  validateTicket(id: string, validationCode?: string): Promise<Ticket | undefined>;
  
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
  getArchivedTicketsByUser(userId: string): Promise<ArchivedTicket[]>;
  getEventsToArchive(): Promise<Event[]>;
  
  // Registry Management
  createRegistryRecord(record: InsertRegistryRecord): Promise<RegistryRecord>;
  getRegistryRecord(id: string): Promise<RegistryRecord | undefined>;
  getRegistryRecordByTicket(ticketId: string): Promise<RegistryRecord | undefined>;
  getRegistryRecordsByUser(userId: string): Promise<RegistryRecord[]>;
  canMintTicket(ticketId: string): Promise<boolean>;
  createRegistryTransaction(transaction: InsertRegistryTransaction): Promise<RegistryTransaction>;
  
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
  
  // Notifications
  getNotifications(userId: string): Promise<Notification[]>;
  createNotification(notification: InsertNotification): Promise<Notification>;
  markNotificationAsRead(id: string): Promise<Notification | undefined>;
  markAllNotificationsAsRead(userId: string): Promise<void>;
  getNotificationPreferences(userId: string): Promise<NotificationPreferences | undefined>;
  updateNotificationPreferences(userId: string, preferences: Partial<InsertNotificationPreferences>): Promise<NotificationPreferences>;
  expireOldNotifications(): Promise<void>;
}

interface ValidationSession {
  ticketId: string;
  expiresAt: Date;
  tokens: Set<string>;
  codes: Map<string, number>; // code -> timestamp
}

export class DatabaseStorage implements IStorage {
  // In-memory cache for validation sessions (temporary data)
  private validationSessions: Map<string, ValidationSession>;
  private validationTokens: Map<string, string>; // token -> ticketId
  private validationCodes: Map<string, string>; // code -> ticketId

  constructor() {
    this.validationSessions = new Map();
    this.validationTokens = new Map();
    this.validationCodes = new Map();
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

  async createUser(insertUser: InsertUser & { id?: string }): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
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

  async updateUserProfile(id: string, updates: { locations?: string }): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set(updates)
      .where(eq(users.id, id))
      .returning();
    return user || undefined;
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

  async getEventsByUserId(userId: string): Promise<Event[]> {
    return db
      .select()
      .from(events)
      .where(eq(events.userId, userId))
      .orderBy(desc(events.createdAt));
  }

  async createEvent(insertEvent: InsertEvent): Promise<Event> {
    const [event] = await db.insert(events).values(insertEvent).returning();
    return event;
  }

  async updateEvent(id: string, updateData: Partial<InsertEvent>): Promise<Event | undefined> {
    const [event] = await db
      .update(events)
      .set(updateData)
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
    return db.select().from(tickets).orderBy(desc(tickets.createdAt));
  }

  async getTicketsByEventId(eventId: string): Promise<Ticket[]> {
    return db
      .select()
      .from(tickets)
      .where(eq(tickets.eventId, eventId))
      .orderBy(desc(tickets.createdAt));
  }

  async getTicketsByUserId(userId: string): Promise<Ticket[]> {
    return db
      .select()
      .from(tickets)
      .where(eq(tickets.userId, userId))
      .orderBy(desc(tickets.createdAt));
  }

  async getTicketsByEventAndUser(eventId: string, userId: string): Promise<Ticket[]> {
    return db
      .select()
      .from(tickets)
      .where(and(eq(tickets.eventId, eventId), eq(tickets.userId, userId)))
      .orderBy(desc(tickets.createdAt));
  }

  async getTicket(id: string): Promise<Ticket | undefined> {
    const [ticket] = await db.select().from(tickets).where(eq(tickets.id, id));
    return ticket || undefined;
  }

  async getTicketByQrData(qrData: string): Promise<Ticket | undefined> {
    const [ticket] = await db.select().from(tickets).where(eq(tickets.qrData, qrData));
    return ticket || undefined;
  }

  async createTicket(insertTicket: InsertTicket): Promise<Ticket> {
    const [ticket] = await db.insert(tickets).values(insertTicket).returning();
    return ticket;
  }

  async validateTicket(id: string, validationCode?: string): Promise<Ticket | undefined> {
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
    
    // Check for golden ticket on first validation
    let isGoldenTicket = currentTicket.isGoldenTicket || false;
    if (!currentTicket.isValidated && event.goldenTicketEnabled && event.goldenTicketNumber !== null) {
      // Generate random number using current timestamp as seed
      const timestamp = Date.now();
      // Simple seeded random using timestamp
      const seed = timestamp % 10000;
      const random = (seed * 9301 + 49297) % 233280;
      const randomNumber = Math.floor((random / 233280) * 5001); // 0-5000
      
      // Check if it matches the golden ticket number
      if (randomNumber === event.goldenTicketNumber) {
        isGoldenTicket = true;
        console.log(`🎫 GOLDEN TICKET WINNER! Ticket ${id} won with number ${randomNumber}`);
      }
    }
    
    // Update ticket with incremented use count and golden ticket status
    const [ticket] = await db
      .update(tickets)
      .set({ 
        isValidated: true, 
        validatedAt: new Date(),
        validationCode: fullValidationCode,
        useCount: (currentTicket.useCount || 0) + 1,
        isGoldenTicket: isGoldenTicket
      })
      .where(eq(tickets.id, id))
      .returning();
    return ticket || undefined;
  }

  // Validation Sessions (in-memory for temporary tokens)
  async createValidationSession(ticketId: string): Promise<{ token: string; expiresAt: Date }> {
    const expiresAt = new Date(Date.now() + 3 * 60 * 1000); // 3 minutes from now
    const session: ValidationSession = {
      ticketId,
      expiresAt,
      tokens: new Set(),
      codes: new Map(),
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
    
    // Generate a unique 4-digit code for this event
    let code: string;
    let attempts = 0;
    const maxAttempts = 100; // Prevent infinite loop
    
    do {
      code = Math.floor(1000 + Math.random() * 9000).toString();
      attempts++;
      
      // Check if this code is already in use for this event (including with suffixes)
      const existingTickets = await this.getTicketsByEventId(ticket.eventId);
      const codeInUse = existingTickets.some(t => {
        if (!t.validationCode) return false;
        // Check if the base code (without suffix) matches
        const baseCode = t.validationCode.replace(/[SPU]$/, '');
        return baseCode === code;
      });
      
      // Also check current active codes
      const activeCodeInUse = this.validationCodes.has(code);
      
      if (!codeInUse && !activeCodeInUse) {
        break; // Found a unique code
      }
    } while (attempts < maxAttempts);
    
    if (attempts >= maxAttempts) {
      // Fallback to a longer code if we can't find a unique 4-digit one
      code = Math.floor(10000 + Math.random() * 90000).toString();
    }
    
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

  async validateDynamicToken(token: string): Promise<{ valid: boolean; ticketId?: string }> {
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
    await this.validateTicket(ticketId, token);
    
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

  async checkDynamicToken(token: string): Promise<{ valid: boolean; ticketId?: string }> {
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
      
      return { valid: true, ticketId };
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
    return { valid: true, ticketId };
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
    
    return !!validator;
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
    const [eventResult] = await db
      .select({ count: db.$count(events) })
      .from(events);
    
    const [ticketResult] = await db
      .select({ count: db.$count(tickets) })
      .from(tickets);
    
    const [validatedResult] = await db
      .select({ count: db.$count(tickets) })
      .from(tickets)
      .where(eq(tickets.isValidated, true));

    return {
      totalEvents: eventResult?.count || 0,
      totalTickets: ticketResult?.count || 0,
      validatedTickets: validatedResult?.count || 0,
    };
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
      if (!event || !event.userId) return false;

      // Get all tickets for this event
      const eventTickets = await this.getTicketsByEventId(eventId);
      
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

      // Archive the event for the owner
      await db.insert(archivedEvents).values({
        userId: event.userId,
        originalEventId: eventId,
        csvData: eventCsvData,
        eventName: event.name,
        eventDate: event.date,
        totalTicketsSold,
        totalRevenue: totalRevenue.toFixed(2),
      });

      // Archive tickets for each ticket holder
      for (const ticket of eventTickets) {
        if (ticket.userId) {
          const ticketCsvData = [
            ticket.ticketNumber,
            event.name,
            event.venue,
            event.date,
            event.time,
            event.ticketPrice,
            ticket.isValidated,
            ticket.validatedAt || ''
          ].join(',');

          await db.insert(archivedTickets).values({
            userId: ticket.userId,
            originalTicketId: ticket.id,
            originalEventId: eventId,
            csvData: ticketCsvData,
            eventName: event.name,
            eventDate: event.date,
            ticketNumber: ticket.ticketNumber,
            wasValidated: ticket.isValidated || false,
          });
        }
      }

      // Delete the tickets
      await db.delete(tickets).where(eq(tickets.eventId, eventId));
      
      // Delete delegated validators
      await db.delete(delegatedValidators).where(eq(delegatedValidators.eventId, eventId));
      
      // Delete the event
      await db.delete(events).where(eq(events.id, eventId));

      return true;
    } catch (error) {
      console.error('Error archiving event:', error);
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

  async getArchivedTicketsByUser(userId: string): Promise<ArchivedTicket[]> {
    return db
      .select()
      .from(archivedTickets)
      .where(eq(archivedTickets.userId, userId))
      .orderBy(desc(archivedTickets.archivedAt));
  }

  async getEventsToArchive(): Promise<Event[]> {
    // Get all events
    const allEvents = await db.select().from(events);
    
    // Filter events that should be archived (69 days after end date or start date)
    const now = new Date();
    const sixtyNineDaysMs = 69 * 24 * 60 * 60 * 1000;
    
    return allEvents.filter(event => {
      // Use end date if available, otherwise use start date
      const eventDateStr = event.endDate || event.date;
      const eventDate = new Date(eventDateStr);
      
      // Check if 69 days have passed
      const timeDiff = now.getTime() - eventDate.getTime();
      return timeDiff >= sixtyNineDaysMs;
    });
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

    // Check if 72 hours have passed since validation
    const now = new Date();
    const validatedTime = new Date(ticket.validatedAt);
    const seventyTwoHoursMs = 72 * 60 * 60 * 1000;
    const timeDiff = now.getTime() - validatedTime.getTime();
    
    return timeDiff >= seventyTwoHoursMs;
  }

  async createRegistryTransaction(transaction: InsertRegistryTransaction): Promise<RegistryTransaction> {
    const [newTransaction] = await db.insert(registryTransactions).values(transaction).returning();
    return newTransaction;
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

    // Get random events to fill remaining slots (excluding already featured ones)
    const featuredEventIds = paidEvents.map(fe => fe.eventId);
    const randomEventsNeeded = 100 - paidEvents.length;
    
    const randomEvents = await db
      .select()
      .from(events)
      .where(
        featuredEventIds.length > 0 
          ? notInArray(events.id, featuredEventIds)
          : undefined
      )
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
}

export const storage = new DatabaseStorage();