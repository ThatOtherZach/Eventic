import { type Event, type InsertEvent, type Ticket, type InsertTicket } from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  // Events
  getEvents(): Promise<Event[]>;
  getEvent(id: string): Promise<Event | undefined>;
  createEvent(event: InsertEvent): Promise<Event>;
  updateEvent(id: string, event: Partial<InsertEvent>): Promise<Event | undefined>;
  deleteEvent(id: string): Promise<boolean>;
  
  // Tickets
  getTickets(): Promise<Ticket[]>;
  getTicketsByEventId(eventId: string): Promise<Ticket[]>;
  getTicket(id: string): Promise<Ticket | undefined>;
  getTicketByQrData(qrData: string): Promise<Ticket | undefined>;
  createTicket(ticket: InsertTicket): Promise<Ticket>;
  validateTicket(id: string): Promise<Ticket | undefined>;
  
  // Stats
  getEventStats(): Promise<{
    totalEvents: number;
    totalTickets: number;
    validatedTickets: number;
  }>;
}

export class MemStorage implements IStorage {
  private events: Map<string, Event>;
  private tickets: Map<string, Ticket>;

  constructor() {
    this.events = new Map();
    this.tickets = new Map();
  }

  async getEvents(): Promise<Event[]> {
    return Array.from(this.events.values()).sort((a, b) => 
      new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
    );
  }

  async getEvent(id: string): Promise<Event | undefined> {
    return this.events.get(id);
  }

  async createEvent(insertEvent: InsertEvent): Promise<Event> {
    const id = randomUUID();
    const event: Event = {
      ...insertEvent,
      id,
      description: insertEvent.description || null,
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
