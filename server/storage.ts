import { type Event, type InsertEvent, type Ticket, type InsertTicket, type User, type InsertUser, type AuthToken, type InsertAuthToken, type DelegatedValidator, type InsertDelegatedValidator, type SystemLog, users, authTokens, events, tickets, delegatedValidators, systemLogs } from "@shared/schema";
import { db } from "./db";
import { eq, desc, and } from "drizzle-orm";
import { randomUUID } from "crypto";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserById(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUserLoginTime(id: string): Promise<User | undefined>;
  
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
    const [ticket] = await db
      .update(tickets)
      .set({ 
        isValidated: true, 
        validatedAt: new Date(),
        validationCode: validationCode || null
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
      
      // Check if this code is already in use for this event
      const existingTickets = await this.getTicketsByEventId(ticket.eventId);
      const codeInUse = existingTickets.some(t => t.validationCode === code);
      
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
    if (!ticket || ticket.isValidated) {
      return { valid: false };
    }

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
}

export const storage = new DatabaseStorage();