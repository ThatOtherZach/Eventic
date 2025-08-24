import { type Event, type InsertEvent, type Ticket, type InsertTicket, type User, type InsertUser, type AuthToken, type InsertAuthToken } from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
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
  validateTicket(id: string): Promise<Ticket | undefined>;
  
  // Validation Sessions
  createValidationSession(ticketId: string): Promise<{ token: string; expiresAt: Date }>;
  createValidationToken(ticketId: string): Promise<string>;
  validateDynamicToken(token: string): Promise<{ valid: boolean; ticketId?: string }>;
  
  // Stats
  getEventStats(): Promise<{
    totalEvents: number;
    totalTickets: number;
    validatedTickets: number;
  }>;
}

interface ValidationSession {
  ticketId: string;
  expiresAt: Date;
  tokens: Set<string>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private authTokens: Map<string, AuthToken>;
  private events: Map<string, Event>;
  private tickets: Map<string, Ticket>;
  private validationSessions: Map<string, ValidationSession>;
  private validationTokens: Map<string, string>; // token -> ticketId

  constructor() {
    this.users = new Map();
    this.authTokens = new Map();
    this.events = new Map();
    this.tickets = new Map();
    this.validationSessions = new Map();
    this.validationTokens = new Map();
  }

  // Users
  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(user => user.email === email);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = {
      ...insertUser,
      id,
      createdAt: new Date(),
      lastLoginAt: null,
    };
    this.users.set(id, user);
    return user;
  }

  async updateUserLoginTime(id: string): Promise<User | undefined> {
    const user = this.users.get(id);
    if (!user) return undefined;
    
    const updatedUser = {
      ...user,
      lastLoginAt: new Date(),
    };
    this.users.set(id, updatedUser);
    return updatedUser;
  }

  // Auth Tokens
  async createAuthToken(insertToken: InsertAuthToken): Promise<AuthToken> {
    const id = randomUUID();
    const authToken: AuthToken = {
      ...insertToken,
      id,
      used: false,
      createdAt: new Date(),
    };
    this.authTokens.set(id, authToken);
    return authToken;
  }

  async getAuthToken(token: string): Promise<AuthToken | undefined> {
    return Array.from(this.authTokens.values()).find(t => t.token === token && !t.used);
  }

  async markTokenAsUsed(id: string): Promise<AuthToken | undefined> {
    const token = this.authTokens.get(id);
    if (!token) return undefined;
    
    const updatedToken = {
      ...token,
      used: true,
    };
    this.authTokens.set(id, updatedToken);
    return updatedToken;
  }

  // Events
  async getEvents(): Promise<Event[]> {
    return Array.from(this.events.values()).sort((a, b) => 
      new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
    );
  }

  async getEvent(id: string): Promise<Event | undefined> {
    return this.events.get(id);
  }

  async getEventsByUserId(userId: string): Promise<Event[]> {
    return Array.from(this.events.values())
      .filter(event => event.userId === userId)
      .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
  }

  async createEvent(insertEvent: InsertEvent): Promise<Event> {
    const id = randomUUID();
    const event: Event = {
      ...insertEvent,
      id,
      description: insertEvent.description || null,
      userId: insertEvent.userId || null,
      maxTickets: insertEvent.maxTickets || null,
      imageUrl: insertEvent.imageUrl || null,
      ticketBackgroundUrl: insertEvent.ticketBackgroundUrl || null,
      createdAt: new Date(),
    };
    this.events.set(id, event);
    return event;
  }

  async updateEvent(id: string, updateData: Partial<InsertEvent>): Promise<Event | undefined> {
    const event = this.events.get(id);
    if (!event) return undefined;

    const updatedEvent = { ...event, ...updateData };
    this.events.set(id, updatedEvent);
    return updatedEvent;
  }

  async deleteEvent(id: string): Promise<boolean> {
    const deleted = this.events.delete(id);
    // Also delete associated tickets
    for (const [ticketId, ticket] of Array.from(this.tickets.entries())) {
      if (ticket.eventId === id) {
        this.tickets.delete(ticketId);
      }
    }
    return deleted;
  }

  // Tickets
  async getTickets(): Promise<Ticket[]> {
    return Array.from(this.tickets.values()).sort((a, b) => 
      new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
    );
  }

  async getTicketsByEventId(eventId: string): Promise<Ticket[]> {
    return Array.from(this.tickets.values())
      .filter(ticket => ticket.eventId === eventId)
      .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
  }

  async getTicketsByUserId(userId: string): Promise<Ticket[]> {
    return Array.from(this.tickets.values())
      .filter(ticket => ticket.userId === userId)
      .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
  }

  async getTicketsByEventAndUser(eventId: string, userId: string): Promise<Ticket[]> {
    return Array.from(this.tickets.values())
      .filter(ticket => ticket.eventId === eventId && ticket.userId === userId)
      .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
  }

  async getTicket(id: string): Promise<Ticket | undefined> {
    return this.tickets.get(id);
  }

  async getTicketByQrData(qrData: string): Promise<Ticket | undefined> {
    return Array.from(this.tickets.values()).find(ticket => ticket.qrData === qrData);
  }

  async createTicket(insertTicket: InsertTicket): Promise<Ticket> {
    const id = randomUUID();
    const ticket: Ticket = {
      ...insertTicket,
      id,
      userId: insertTicket.userId || null,
      isValidated: false,
      validatedAt: null,
      createdAt: new Date(),
    };
    this.tickets.set(id, ticket);
    return ticket;
  }

  async validateTicket(id: string): Promise<Ticket | undefined> {
    const ticket = this.tickets.get(id);
    if (!ticket) return undefined;

    const validatedTicket = {
      ...ticket,
      isValidated: true,
      validatedAt: new Date(),
    };
    this.tickets.set(id, validatedTicket);
    return validatedTicket;
  }

  // Validation Sessions
  async createValidationSession(ticketId: string): Promise<{ token: string; expiresAt: Date }> {
    const expiresAt = new Date(Date.now() + 3 * 60 * 1000); // 3 minutes from now
    const session: ValidationSession = {
      ticketId,
      expiresAt,
      tokens: new Set(),
    };
    this.validationSessions.set(ticketId, session);
    
    // Create initial token
    const token = await this.createValidationToken(ticketId);
    return { token, expiresAt };
  }

  async createValidationToken(ticketId: string): Promise<string> {
    const session = this.validationSessions.get(ticketId);
    if (!session || session.expiresAt < new Date()) {
      throw new Error("Validation session expired or not found");
    }

    // Generate unique token for this rotation
    const token = `VAL-${randomUUID()}-${Date.now()}`;
    session.tokens.add(token);
    this.validationTokens.set(token, ticketId);
    
    // Clean up old tokens after a delay (keep them valid for 15 seconds to handle network delays)
    setTimeout(() => {
      this.validationTokens.delete(token);
      session.tokens.delete(token);
    }, 15000);
    
    return token;
  }

  async validateDynamicToken(token: string): Promise<{ valid: boolean; ticketId?: string }> {
    const ticketId = this.validationTokens.get(token);
    if (!ticketId) {
      return { valid: false };
    }

    const session = this.validationSessions.get(ticketId);
    if (!session || session.expiresAt < new Date()) {
      return { valid: false };
    }

    const ticket = this.tickets.get(ticketId);
    if (!ticket || ticket.isValidated) {
      return { valid: false };
    }

    // Mark ticket as validated
    await this.validateTicket(ticketId);
    
    // Clean up session
    this.validationSessions.delete(ticketId);
    Array.from(session.tokens).forEach(sessionToken => {
      this.validationTokens.delete(sessionToken);
    })

    return { valid: true, ticketId };
  }

  async getEventStats(): Promise<{
    totalEvents: number;
    totalTickets: number;
    validatedTickets: number;
  }> {
    const totalEvents = this.events.size;
    const totalTickets = this.tickets.size;
    const validatedTickets = Array.from(this.tickets.values())
      .filter(ticket => ticket.isValidated).length;

    return {
      totalEvents,
      totalTickets,
      validatedTickets,
    };
  }
}

export const storage = new MemStorage();