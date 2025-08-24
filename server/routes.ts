import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertEventSchema, insertTicketSchema } from "@shared/schema";
import { z } from "zod";
import { ObjectStorageService, ObjectNotFoundError } from "./objectStorage";
import { logError, logWarning, logInfo } from "./logger";

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

// Helper function to check if a ticket is within its valid time window
function isTicketWithinValidTime(event: any): { valid: boolean; message?: string } {
  const now = new Date();
  const startDate = new Date(event.startDate);
  
  // Check if event hasn't started yet
  if (now < startDate) {
    return {
      valid: false,
      message: `Event has not started yet. It begins on ${startDate.toLocaleString()}`
    };
  }
  
  // If event has an end date, check if we're past it
  if (event.endDate) {
    const endDate = new Date(event.endDate);
    if (now > endDate) {
      return {
        valid: false,
        message: `Event has ended. It ended on ${endDate.toLocaleString()}`
      };
    }
  } else {
    // No end date - check if we're within 24 hours of start
    const twentyFourHoursAfterStart = new Date(startDate.getTime() + 24 * 60 * 60 * 1000);
    if (now > twentyFourHoursAfterStart) {
      return {
        valid: false,
        message: `Ticket has expired. It was valid for 24 hours after ${startDate.toLocaleString()}`
      };
    }
  }
  
  return { valid: true };
}

// Helper function to extract user email from the request
function extractUserEmail(req: any): string | null {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return null;
    
    // Parse Supabase JWT to get email
    const token = authHeader.replace('Bearer ', '');
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
    return payload.email || null;
  } catch (error) {
    return null;
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  const objectStorageService = new ObjectStorageService();

  // Sync/create user in local database when they login via Supabase
  app.post("/api/auth/sync-user", async (req, res) => {
    try {
      const userId = extractUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { email, name } = req.body;
      
      // Check if user already exists
      const existingUser = await storage.getUserById(userId);
      if (existingUser) {
        return res.json(existingUser);
      }

      // Create new user in local database
      const newUser = await storage.createUser({
        id: userId,
        email: email || `user_${userId}@placeholder.com`,
      });
      
      res.json(newUser);
    } catch (error) {
      await logError(error, "POST /api/auth/sync-user", {
        request: req,
        metadata: { email: req.body.email }
      });
      res.status(500).json({ message: "Failed to sync user" });
    }
  });

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
      await logError(error, "GET /public-objects/:filePath", {
        request: req,
        metadata: { filePath }
      });
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/objects/:objectPath(*)", async (req, res) => {
    const objectStorageService = new ObjectStorageService();
    try {
      const objectPath = `/objects/${req.params.objectPath}`;
      const privateObjectDir = objectStorageService.getPrivateObjectDir();
      // The objectPath already includes "uploads/" so we don't need to add it again
      const fullPath = `${privateObjectDir}/${req.params.objectPath}`;
      // Parse the path to extract bucket and object name
      const pathParts = fullPath.split('/');
      const bucketName = pathParts[1];
      const objectName = pathParts.slice(2).join('/');
      // Access the objectStorageClient through the service instance
      const bucket = (objectStorageService as any).objectStorageClient.bucket(bucketName);
      const file = bucket.file(objectName);
      const [exists] = await file.exists();
      if (!exists) {
        console.log("File not found:", fullPath);
        return res.sendStatus(404);
      }
      objectStorageService.downloadObject(file, res);
    } catch (error) {
      await logError(error, "GET /objects/:objectPath", {
        request: req,
        metadata: { objectPath: req.params.objectPath }
      });
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

  // Ticket routes
  app.get("/api/tickets/:ticketId", async (req, res) => {
    try {
      const userId = extractUserId(req);
      const ticket = await storage.getTicket(req.params.ticketId);
      
      if (!ticket) {
        return res.status(404).json({ message: "Ticket not found" });
      }
      
      // Allow viewing if user owns the ticket OR if ticket has no owner
      if (ticket.userId && ticket.userId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const event = await storage.getEvent(ticket.eventId);
      res.json({ ticket, event });
    } catch (error) {
      await logError(error, "GET /api/tickets/:ticketId", {
        request: req,
        metadata: { ticketId: req.params.ticketId }
      });
      res.status(500).json({ message: "Failed to fetch ticket" });
    }
  });

  // Validation session routes
  app.post("/api/tickets/:ticketId/validate-session", async (req, res) => {
    try {
      const userId = extractUserId(req);
      const ticket = await storage.getTicket(req.params.ticketId);
      
      if (!ticket) {
        return res.status(404).json({ message: "Ticket not found" });
      }
      
      // Allow validation if user owns the ticket OR if ticket has no owner (for legacy tickets)
      if (ticket.userId && ticket.userId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      if (ticket.isValidated) {
        return res.status(400).json({ message: "Ticket already validated" });
      }
      
      const session = await storage.createValidationSession(req.params.ticketId);
      res.json(session);
    } catch (error) {
      await logError(error, "POST /api/tickets/:ticketId/validate-session", {
        request: req,
        metadata: { ticketId: req.params.ticketId }
      });
      res.status(500).json({ message: "Failed to create validation session" });
    }
  });

  app.get("/api/tickets/:ticketId/validation-token", async (req, res) => {
    const userId = extractUserId(req);
    try {
      const ticket = await storage.getTicket(req.params.ticketId);
      
      if (!ticket) {
        return res.status(404).json({ message: "Ticket not found" });
      }
      
      // Allow token generation if user owns the ticket OR if ticket has no owner
      if (ticket.userId && ticket.userId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const token = await storage.createValidationToken(req.params.ticketId);
      res.json({ token });
    } catch (error: any) {
      if (error.message === "Validation session expired or not found") {
        await logWarning(
          "Validation session expired",
          "GET /api/tickets/:ticketId/validation-token",
          {
            userId: userId || undefined,
            ticketId: req.params.ticketId
          }
        );
        return res.status(400).json({ message: error.message });
      }
      await logError(error, "GET /api/tickets/:ticketId/validation-token", {
        request: req,
        metadata: { ticketId: req.params.ticketId }
      });
      res.status(500).json({ message: "Failed to generate validation token" });
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
      await logError(error, "GET /api/events/:id", {
        request: req,
        metadata: { eventId: req.params.id }
      });
      res.status(500).json({ message: "Failed to fetch event" });
    }
  });

  app.post("/api/events", async (req, res) => {
    const userId = extractUserId(req);
    try {
      
      // Handle image URL normalization if provided
      let createData = { ...req.body };
      if (createData.imageUrl && createData.imageUrl.startsWith("https://storage.googleapis.com/")) {
        createData.imageUrl = objectStorageService.normalizeObjectEntityPath(createData.imageUrl);
      }
      if (createData.ticketBackgroundUrl && createData.ticketBackgroundUrl.startsWith("https://storage.googleapis.com/")) {
        createData.ticketBackgroundUrl = objectStorageService.normalizeObjectEntityPath(createData.ticketBackgroundUrl);
      }
      
      // Validate max tickets limit
      if (createData.maxTickets && createData.maxTickets > 5000) {
        return res.status(400).json({ message: "Maximum tickets cannot exceed 5,000" });
      }
      
      const validatedData = insertEventSchema.parse({
        ...createData,
        userId, // Now we can use the actual userId since user exists in DB
      });
      const event = await storage.createEvent(validatedData);
      res.status(201).json(event);
    } catch (error) {
      if (error instanceof z.ZodError) {
        await logWarning(
          "Invalid event data",
          "POST /api/events",
          {
            userId: userId || undefined,
            metadata: {
              errors: error.errors
            }
          }
        );
        return res.status(400).json({ message: "Invalid event data", errors: error.errors });
      }
      await logError(error, "POST /api/events", {
        request: req,
        metadata: { eventData: req.body }
      });
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
      
      // Get ticket count for validation
      const tickets = await storage.getTicketsByEventId(req.params.id);
      const ticketsSold = tickets.length;
      
      // Handle image URL normalization if provided
      let updateData = { ...req.body };
      
      // Remove name field to prevent it from being updated
      delete updateData.name;
      
      // Validate maxTickets if provided
      if (updateData.maxTickets !== undefined && updateData.maxTickets !== null) {
        const newMaxTickets = parseInt(updateData.maxTickets);
        if (newMaxTickets < ticketsSold) {
          return res.status(400).json({ 
            message: `Cannot set maximum tickets below ${ticketsSold} (tickets already sold)` 
          });
        }
        if (newMaxTickets > 5000) {
          return res.status(400).json({ 
            message: "Maximum tickets cannot exceed 5,000" 
          });
        }
      }
      
      if (updateData.imageUrl && updateData.imageUrl.startsWith("https://storage.googleapis.com/")) {
        updateData.imageUrl = objectStorageService.normalizeObjectEntityPath(updateData.imageUrl);
      }
      if (updateData.ticketBackgroundUrl && updateData.ticketBackgroundUrl.startsWith("https://storage.googleapis.com/")) {
        updateData.ticketBackgroundUrl = objectStorageService.normalizeObjectEntityPath(updateData.ticketBackgroundUrl);
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

  app.get("/api/events/:eventId/user-tickets", async (req, res) => {
    try {
      const userId = extractUserId(req);
      if (!userId) {
        return res.json([]);
      }
      const tickets = await storage.getTicketsByEventAndUser(req.params.eventId, userId);
      res.json(tickets);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch user tickets for event" });
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
    const userId = extractUserId(req);
    try {
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
        userId, // Now we can use the actual userId since user exists in DB
        ticketNumber,
        qrData,
      };

      const validatedData = insertTicketSchema.parse(ticketData);
      const ticket = await storage.createTicket(validatedData);
      res.status(201).json(ticket);
    } catch (error) {
      if (error instanceof z.ZodError) {
        await logWarning(
          "Invalid ticket data",
          "POST /api/events/:eventId/tickets",
          {
            userId: userId || undefined,
            eventId: req.params.eventId,
            metadata: {
              errors: error.errors
            }
          }
        );
        return res.status(400).json({ message: "Invalid ticket data", errors: error.errors });
      }
      await logError(error, "POST /api/events/:eventId/tickets", {
        request: req,
        metadata: { eventId: req.params.eventId }
      });
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

      const userId = extractUserId(req);
      const userEmail = extractUserEmail(req);

      // First check if it's a dynamic validation token
      const tokenCheck = await storage.checkDynamicToken(qrData);
      
      if (tokenCheck.valid && tokenCheck.ticketId) {
        const ticket = await storage.getTicket(tokenCheck.ticketId);
        if (!ticket) {
          return res.status(404).json({ 
            message: "Invalid ticket", 
            valid: false 
          });
        }
        const event = await storage.getEvent(ticket.eventId);
        if (!event) {
          return res.status(404).json({ 
            message: "Event not found", 
            valid: false 
          });
        }
        
        // Check if ticket is within valid time window
        const timeCheck = isTicketWithinValidTime(event);
        if (!timeCheck.valid) {
          return res.status(400).json({
            message: timeCheck.message,
            valid: false,
            isAuthentic: true,
            outsideValidTime: true,
            ticket,
            event
          });
        }
        
        // Check if user is authorized to validate for this event
        const canValidate = userId && userEmail ? 
          await storage.canUserValidateForEvent(userId, userEmail, event.id) : false;
        
        if (canValidate) {
          // User is authorized - perform actual validation
          const validation = await storage.validateDynamicToken(qrData);
          if (validation.valid) {
            return res.json({ 
              message: "Ticket validated successfully", 
              valid: true,
              canValidate: true,
              ticket,
              event 
            });
          }
        } else {
          // User not authorized - just verify authenticity
          return res.json({
            message: "Ticket is authentic but you are not authorized to validate it",
            valid: true,
            canValidate: false,
            isAuthentic: true,
            ticket: { ...ticket, isValidated: ticket.isValidated },
            event
          });
        }
      }

      // Otherwise try to validate as a regular ticket QR code
      const ticket = await storage.getTicketByQrData(qrData);
      if (!ticket) {
        return res.status(404).json({ 
          message: "Invalid ticket", 
          valid: false 
        });
      }

      const event = await storage.getEvent(ticket.eventId);
      if (!event) {
        return res.status(404).json({ 
          message: "Event not found", 
          valid: false 
        });
      }
      
      // Check if ticket is within valid time window
      const timeCheck = isTicketWithinValidTime(event);
      if (!timeCheck.valid) {
        return res.status(400).json({
          message: timeCheck.message,
          valid: false,
          isAuthentic: true,
          outsideValidTime: true,
          ticket,
          event
        });
      }
      
      // Check if user is authorized to validate for this event
      const canValidate = userId && userEmail ? 
        await storage.canUserValidateForEvent(userId, userEmail, event.id) : false;

      if (ticket.isValidated) {
        return res.json({ 
          message: "Ticket already validated", 
          valid: false,
          canValidate,
          isAuthentic: true,
          alreadyValidated: true,
          ticket,
          event
        });
      }

      if (canValidate) {
        // User is authorized - perform actual validation
        const validatedTicket = await storage.validateTicket(ticket.id);
        return res.json({ 
          message: "Ticket validated successfully", 
          valid: true,
          canValidate: true,
          ticket: validatedTicket,
          event 
        });
      } else {
        // User not authorized - just verify authenticity
        return res.json({
          message: "Ticket is authentic but you are not authorized to validate it",
          valid: true,
          canValidate: false,
          isAuthentic: true,
          ticket: { ...ticket, isValidated: ticket.isValidated },
          event
        });
      }
    } catch (error) {
      await logError(error, "POST /api/validate", {
        request: req,
        metadata: { qrData: req.body.qrData }
      });
      res.status(500).json({ message: "Failed to validate ticket" });
    }
  });

  // Stats route
  app.get("/api/stats", async (req, res) => {
    try {
      const stats = await storage.getEventStats();
      res.json(stats);
    } catch (error) {
      await logError(error, "GET /api/stats", {
        request: req
      });
      res.status(500).json({ message: "Failed to fetch stats" });
    }
  });

  // Delegated Validators routes
  app.get("/api/events/:eventId/validators", async (req, res) => {
    try {
      const userId = extractUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const event = await storage.getEvent(req.params.eventId);
      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }

      // Only event owner can view validators
      if (event.userId !== userId) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const validators = await storage.getDelegatedValidatorsByEvent(req.params.eventId);
      res.json(validators);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch validators" });
    }
  });

  app.post("/api/events/:eventId/validators", async (req, res) => {
    try {
      const userId = extractUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const event = await storage.getEvent(req.params.eventId);
      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }

      // Only event owner can add validators
      if (event.userId !== userId) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const { email } = req.body;
      if (!email) {
        return res.status(400).json({ message: "Email is required" });
      }

      const validator = await storage.addDelegatedValidator({
        eventId: req.params.eventId,
        email,
        addedBy: userId
      });

      res.status(201).json(validator);
    } catch (error) {
      await logError(error, "POST /api/events/:eventId/validators", {
        request: req,
        metadata: { eventId: req.params.eventId, email: req.body.email }
      });
      res.status(500).json({ message: "Failed to add validator" });
    }
  });

  app.delete("/api/events/:eventId/validators/:validatorId", async (req, res) => {
    try {
      const userId = extractUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const event = await storage.getEvent(req.params.eventId);
      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }

      // Only event owner can remove validators
      if (event.userId !== userId) {
        return res.status(403).json({ message: "Forbidden" });
      }

      await storage.removeDelegatedValidator(req.params.validatorId);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to remove validator" });
    }
  });

  // System logs endpoint (for administrators)
  app.get("/api/system-logs", async (req, res) => {
    try {
      const userId = extractUserId(req);
      const userEmail = extractUserEmail(req);
      
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      // Optional: Add admin check here
      // For now, any authenticated user can view logs
      // You might want to restrict this to specific admin users
      
      const { limit = 100, offset = 0, severity, search } = req.query;
      
      const logs = await storage.getSystemLogs({
        limit: Number(limit),
        offset: Number(offset),
        severity: severity as string,
        search: search as string
      });
      
      await logInfo(
        "System logs accessed",
        "GET /api/system-logs",
        { 
          userId, 
          metadata: {
            userEmail: userEmail || undefined,
            query: req.query 
          }
        }
      );
      
      res.json(logs);
    } catch (error) {
      await logError(error, "GET /api/system-logs", {
        request: req
      });
      res.status(500).json({ message: "Failed to fetch system logs" });
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