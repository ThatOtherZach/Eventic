import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertEventSchema, insertTicketSchema } from "@shared/schema";
import { z } from "zod";
import { ObjectStorageService, ObjectNotFoundError } from "./objectStorage";

// Middleware to extract userId from Supabase auth header
function extractUserId(req: any): string | null {
  const authHeader = req.headers.authorization;
  if (!authHeader) return null;
  
  try {
    // Parse Supabase JWT to get user ID
    const token = authHeader.replace('Bearer ', '');
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
    return payload.sub || null;
  } catch (error) {
    return null;
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  const objectStorageService = new ObjectStorageService();

  // Object Storage routes
  app.get("/public-objects/:filePath(*)", async (req, res) => {
    const filePath = req.params.filePath;
    try {
      const file = await objectStorageService.searchPublicObject(filePath);
      if (!file) {
        return res.status(404).json({ error: "File not found" });
      }
      objectStorageService.downloadObject(file, res);
    } catch (error) {
      console.error("Error searching for public object:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/objects/:objectPath(*)", async (req, res) => {
    const objectStorageService = new ObjectStorageService();
    try {
      const objectPath = `/objects/${req.params.objectPath}`;
      const privateObjectDir = objectStorageService.getPrivateObjectDir();
      const fullPath = `${privateObjectDir}/uploads/${req.params.objectPath}`;
      const { bucketName, objectName } = parseObjectPath(fullPath);
      const bucket = objectStorageService['objectStorageClient'].bucket(bucketName);
      const file = bucket.file(objectName);
      const [exists] = await file.exists();
      if (!exists) {
        return res.sendStatus(404);
      }
      objectStorageService.downloadObject(file, res);
    } catch (error) {
      console.error("Error checking object access:", error);
      if (error instanceof ObjectNotFoundError) {
        return res.sendStatus(404);
      }
      return res.sendStatus(500);
    }
  });

  app.post("/api/objects/upload", async (req, res) => {
    try {
      const uploadURL = await objectStorageService.getObjectEntityUploadURL();
      res.json({ uploadURL });
    } catch (error) {
      console.error("Error getting upload URL:", error);
      res.status(500).json({ error: "Failed to get upload URL" });
    }
  });

  // User-specific routes
  app.get("/api/user/tickets", async (req, res) => {
    try {
      const userId = extractUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      const tickets = await storage.getTicketsByUserId(userId);
      // Fetch event data for each ticket
      const ticketsWithEvents = await Promise.all(
        tickets.map(async (ticket) => {
          const event = await storage.getEvent(ticket.eventId);
          return { ...ticket, event };
        })
      );
      
      res.json(ticketsWithEvents);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch user tickets" });
    }
  });

  app.get("/api/user/events", async (req, res) => {
    try {
      const userId = extractUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      const events = await storage.getEventsByUserId(userId);
      res.json(events);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch user events" });
    }
  });

  // Events routes
  app.get("/api/events", async (req, res) => {
    try {
      const events = await storage.getEvents();
      res.json(events);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch events" });
    }
  });

  app.get("/api/events/:id", async (req, res) => {
    try {
      const event = await storage.getEvent(req.params.id);
      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }
      
      // Get ticket count for the event
      const tickets = await storage.getTicketsByEventId(req.params.id);
      const ticketsSold = tickets.length;
      const ticketsAvailable = event.maxTickets ? event.maxTickets - ticketsSold : null;
      
      res.json({
        ...event,
        ticketsSold,
        ticketsAvailable
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch event" });
    }
  });

  app.post("/api/events", async (req, res) => {
    try {
      const userId = extractUserId(req);
      const validatedData = insertEventSchema.parse({
        ...req.body,
        userId, // Associate event with logged-in user
      });
      const event = await storage.createEvent(validatedData);
      res.status(201).json(event);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid event data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create event" });
    }
  });

  app.put("/api/events/:id", async (req, res) => {
    try {
      const userId = extractUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      // Check if user owns the event
      const event = await storage.getEvent(req.params.id);
      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }
      if (event.userId !== userId) {
        return res.status(403).json({ message: "You can only edit your own events" });
      }
      
      // Handle image URL normalization if provided
      let updateData = { ...req.body };
      if (updateData.imageUrl && updateData.imageUrl.startsWith("https://storage.googleapis.com/")) {
        updateData.imageUrl = objectStorageService.normalizeObjectEntityPath(updateData.imageUrl);
      }
      
      const validatedData = insertEventSchema.partial().parse(updateData);
      const updatedEvent = await storage.updateEvent(req.params.id, validatedData);
      res.json(updatedEvent);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid event data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update event" });
    }
  });

  app.delete("/api/events/:id", async (req, res) => {
    try {
      const userId = extractUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      // Check if user owns the event
      const event = await storage.getEvent(req.params.id);
      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }
      if (event.userId !== userId) {
        return res.status(403).json({ message: "You can only delete your own events" });
      }
      
      const deleted = await storage.deleteEvent(req.params.id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete event" });
    }
  });

  // Tickets routes
  app.get("/api/tickets", async (req, res) => {
    try {
      const tickets = await storage.getTickets();
      res.json(tickets);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch tickets" });
    }
  });

  app.get("/api/events/:eventId/tickets", async (req, res) => {
    try {
      const tickets = await storage.getTicketsByEventId(req.params.eventId);
      res.json(tickets);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch event tickets" });
    }
  });

  app.post("/api/events/:eventId/tickets", async (req, res) => {
    try {
      const userId = extractUserId(req);
      const event = await storage.getEvent(req.params.eventId);
      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }

      // Check if event is sold out
      const existingTickets = await storage.getTicketsByEventId(req.params.eventId);
      if (event.maxTickets && existingTickets.length >= event.maxTickets) {
        return res.status(400).json({ message: "Event is sold out" });
      }

      const ticketNumber = `${event.name.substring(0, 3).toUpperCase()}-${existingTickets.length + 1}`;
      
      const qrData = JSON.stringify({
        eventId: req.params.eventId,
        ticketNumber,
        timestamp: Date.now(),
      });

      const ticketData = {
        eventId: req.params.eventId,
        userId, // Associate ticket with logged-in user
        ticketNumber,
        qrData,
      };

      const validatedData = insertTicketSchema.parse(ticketData);
      const ticket = await storage.createTicket(validatedData);
      res.status(201).json(ticket);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid ticket data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create ticket" });
    }
  });

  // Validation routes
  app.post("/api/validate", async (req, res) => {
    try {
      const { qrData } = req.body;
      if (!qrData) {
        return res.status(400).json({ message: "QR data is required" });
      }

      const ticket = await storage.getTicketByQrData(qrData);
      if (!ticket) {
        return res.status(404).json({ 
          message: "Invalid ticket", 
          valid: false 
        });
      }

      if (ticket.isValidated) {
        return res.status(400).json({ 
          message: "Ticket already validated", 
          valid: false,
          ticket 
        });
      }

      const validatedTicket = await storage.validateTicket(ticket.id);
      const event = await storage.getEvent(ticket.eventId);

      res.json({ 
        message: "Ticket validated successfully", 
        valid: true,
        ticket: validatedTicket,
        event 
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to validate ticket" });
    }
  });

  // Stats route
  app.get("/api/stats", async (req, res) => {
    try {
      const stats = await storage.getEventStats();
      res.json(stats);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch stats" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}

function parseObjectPath(path: string): {
  bucketName: string;
  objectName: string;
} {
  if (!path.startsWith("/")) {
    path = `/${path}`;
  }
  const pathParts = path.split("/");
  if (pathParts.length < 3) {
    throw new Error("Invalid path: must contain at least a bucket name");
  }
  const bucketName = pathParts[1];
  const objectName = pathParts.slice(2).join("/");
  return { bucketName, objectName };
}