import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertEventSchema, insertTicketSchema, insertFeaturedEventSchema, insertNotificationSchema, insertNotificationPreferencesSchema } from "@shared/schema";
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
  // Combine date and time fields for start date
  const startDateTime = `${event.date}T${event.time}:00`;
  const startDate = new Date(startDateTime);
  
  // Check early validation setting
  const earlyValidation = event.earlyValidation || "Allow at Anytime";
  
  // Check if event hasn't started yet based on early validation setting
  if (earlyValidation !== "Allow at Anytime") {
    let validationStartTime = new Date(startDate);
    
    switch (earlyValidation) {
      case "One Hour Before":
        validationStartTime = new Date(startDate.getTime() - 60 * 60 * 1000);
        break;
      case "Two Hours Before":
        validationStartTime = new Date(startDate.getTime() - 2 * 60 * 60 * 1000);
        break;
      // "At Start Time" uses the original start time
    }
    
    if (now < validationStartTime) {
      const timeDescription = earlyValidation === "At Start Time" 
        ? `at ${startDate.toLocaleString()}`
        : earlyValidation === "One Hour Before"
        ? `starting ${validationStartTime.toLocaleString()} (1 hour before event)`
        : `starting ${validationStartTime.toLocaleString()} (2 hours before event)`;
      
      return {
        valid: false,
        message: `Ticket validation begins ${timeDescription}`
      };
    }
  }
  
  // If event has an end date and time, check if we're past it
  if (event.endDate && event.endTime) {
    const endDateTime = `${event.endDate}T${event.endTime}:00`;
    const endDate = new Date(endDateTime);
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

  // Rate limiter for ticket purchases
  const purchaseAttempts = new Map<string, number[]>();
  const PURCHASE_RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute in milliseconds
  const MAX_PURCHASES_PER_WINDOW = 3; // Max 3 purchases per minute per user

  // Rate limiter for event creation
  const eventCreationAttempts = new Map<string, number[]>();
  const EVENT_RATE_LIMIT_WINDOW = 5 * 60 * 1000; // 5 minutes in milliseconds
  const MAX_EVENTS_PER_WINDOW = 2; // Max 2 events per 5 minutes per user

  function checkPurchaseRateLimit(userId: string): boolean {
    const now = Date.now();
    const userAttempts = purchaseAttempts.get(userId) || [];
    
    // Remove attempts older than the window
    const recentAttempts = userAttempts.filter(time => now - time < PURCHASE_RATE_LIMIT_WINDOW);
    
    // Check if user has exceeded the limit
    if (recentAttempts.length >= MAX_PURCHASES_PER_WINDOW) {
      return false; // Rate limit exceeded
    }
    
    // Add current attempt and update the map
    recentAttempts.push(now);
    purchaseAttempts.set(userId, recentAttempts);
    
    return true; // Under rate limit
  }

  function checkEventCreationRateLimit(userId: string): boolean {
    const now = Date.now();
    const userAttempts = eventCreationAttempts.get(userId) || [];
    
    // Remove attempts older than the window
    const recentAttempts = userAttempts.filter(time => now - time < EVENT_RATE_LIMIT_WINDOW);
    
    // Check if user has exceeded the limit
    if (recentAttempts.length >= MAX_EVENTS_PER_WINDOW) {
      return false; // Rate limit exceeded
    }
    
    // Add current attempt and update the map
    recentAttempts.push(now);
    eventCreationAttempts.set(userId, recentAttempts);
    
    return true; // Under rate limit
  }

  // Cleanup old rate limit entries every 5 minutes to prevent memory leaks
  setInterval(() => {
    const now = Date.now();
    
    // Clean up purchase attempts
    for (const [userId, attempts] of Array.from(purchaseAttempts.entries())) {
      const recentAttempts = attempts.filter((time: number) => now - time < PURCHASE_RATE_LIMIT_WINDOW);
      if (recentAttempts.length === 0) {
        purchaseAttempts.delete(userId);
      } else {
        purchaseAttempts.set(userId, recentAttempts);
      }
    }
    
    // Clean up event creation attempts
    for (const [userId, attempts] of Array.from(eventCreationAttempts.entries())) {
      const recentAttempts = attempts.filter((time: number) => now - time < EVENT_RATE_LIMIT_WINDOW);
      if (recentAttempts.length === 0) {
        eventCreationAttempts.delete(userId);
      } else {
        eventCreationAttempts.set(userId, recentAttempts);
      }
    }
  }, 5 * 60 * 1000);

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
        // Auto-populate locations if not set by user
        if (!existingUser.locations) {
          const countries = await storage.getUserEventCountries(userId);
          if (countries.length > 0) {
            const autoLocations = countries.join(', ');
            await storage.updateUserProfile(userId, { locations: autoLocations });
            existingUser.locations = autoLocations;
          }
        }
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

  // Update user profile
  app.patch("/api/user/profile", async (req, res) => {
    try {
      const userId = extractUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { locations } = req.body;
      
      // Only update if locations value is provided
      if (locations !== undefined) {
        const updatedUser = await storage.updateUserProfile(userId, { locations });
        if (!updatedUser) {
          return res.status(404).json({ message: "User not found" });
        }
        res.json(updatedUser);
      } else {
        res.status(400).json({ message: "No locations value provided" });
      }
    } catch (error) {
      await logError(error, "PATCH /api/user/profile", {
        request: req,
        metadata: { locations: req.body.locations }
      });
      res.status(500).json({ message: "Failed to update profile" });
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
      
      const tokenData = await storage.createValidationToken(req.params.ticketId);
      res.json({ token: tokenData.token, code: tokenData.code });
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
    
    // Check rate limit for event creation
    if (userId && !checkEventCreationRateLimit(userId)) {
      await logWarning(
        "Rate limit exceeded for event creation",
        "POST /api/events",
        {
          userId,
          metadata: { 
            rateLimitWindow: EVENT_RATE_LIMIT_WINDOW,
            maxEvents: MAX_EVENTS_PER_WINDOW
          }
        }
      );
      return res.status(429).json({ 
        message: "Too many event creation attempts. Please wait before creating another event.",
        retryAfter: Math.ceil(EVENT_RATE_LIMIT_WINDOW / 1000) // seconds
      });
    }
    
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
      
      // Remove name, earlyValidation, re-entry, and golden ticket fields to prevent them from being updated
      delete updateData.name;
      delete updateData.earlyValidation;
      delete updateData.reentryType;
      delete updateData.maxUses;
      delete updateData.goldenTicketEnabled;
      delete updateData.goldenTicketNumber;
      
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
    
    // Check rate limit for authenticated users
    if (userId && !checkPurchaseRateLimit(userId)) {
      await logWarning(
        "Rate limit exceeded for ticket purchase",
        "POST /api/events/:eventId/tickets",
        {
          userId,
          eventId: req.params.eventId,
          metadata: { 
            rateLimitWindow: PURCHASE_RATE_LIMIT_WINDOW,
            maxPurchases: MAX_PURCHASES_PER_WINDOW
          }
        }
      );
      return res.status(429).json({ 
        message: "Too many purchase attempts. Please wait a moment before trying again.",
        retryAfter: Math.ceil(PURCHASE_RATE_LIMIT_WINDOW / 1000) // seconds
      });
    }
    
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

  app.get("/api/events/:eventId/validated-tickets", async (req, res) => {
    try {
      const userId = extractUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      // Check if user owns the event
      const event = await storage.getEvent(req.params.eventId);
      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }
      if (event.userId !== userId) {
        return res.status(403).json({ message: "Only event owners can view validated tickets" });
      }
      
      const validatedTickets = await storage.getValidatedTicketsForEvent(req.params.eventId);
      res.json(validatedTickets);
    } catch (error) {
      await logError(error, "GET /api/events/:eventId/validated-tickets", {
        request: req,
        metadata: { eventId: req.params.eventId }
      });
      res.status(500).json({ message: "Failed to fetch validated tickets" });
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

  // Archive endpoints
  app.get("/api/user/past-events", async (req, res) => {
    try {
      const userId = extractUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const archivedEvents = await storage.getArchivedEventsByUser(userId);
      res.json(archivedEvents);
    } catch (error) {
      await logError(error, "GET /api/user/past-events", {
        request: req
      });
      res.status(500).json({ message: "Failed to fetch past events" });
    }
  });

  app.get("/api/user/past-tickets", async (req, res) => {
    try {
      const userId = extractUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const archivedTickets = await storage.getArchivedTicketsByUser(userId);
      res.json(archivedTickets);
    } catch (error) {
      await logError(error, "GET /api/user/past-tickets", {
        request: req
      });
      res.status(500).json({ message: "Failed to fetch past tickets" });
    }
  });

  // Manual archive trigger (for testing or admin use)
  app.post("/api/archive/check", async (req, res) => {
    try {
      const userId = extractUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      // Get events that need archiving
      const eventsToArchive = await storage.getEventsToArchive();
      
      // Archive each event
      const results = [];
      for (const event of eventsToArchive) {
        const success = await storage.archiveEvent(event.id);
        results.push({
          eventId: event.id,
          eventName: event.name,
          archived: success
        });
      }

      res.json({
        message: `Archived ${results.filter(r => r.archived).length} of ${results.length} events`,
        results
      });
    } catch (error) {
      await logError(error, "POST /api/archive/check", {
        request: req
      });
      res.status(500).json({ message: "Failed to archive events" });
    }
  });

  // Registry endpoints
  app.post("/api/tickets/:ticketId/mint", async (req, res) => {
    try {
      const userId = extractUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { ticketId } = req.params;
      const { title, description, metadata } = req.body;

      // Get the ticket details
      const ticket = await storage.getTicket(ticketId);
      if (!ticket) {
        return res.status(404).json({ message: "Ticket not found" });
      }

      // Verify ownership
      if (ticket.userId !== userId) {
        return res.status(403).json({ message: "You can only mint your own tickets" });
      }

      // Check if can mint
      const canMint = await storage.canMintTicket(ticketId);
      if (!canMint) {
        return res.status(400).json({ message: "Ticket cannot be minted yet. Make sure it has been validated and 72 hours have passed." });
      }

      // Get event details
      const event = await storage.getEvent(ticket.eventId);
      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }

      // Check if event allows minting
      if (!event.allowMinting) {
        return res.status(403).json({ message: "NFT minting is not enabled for this event" });
      }

      // Create registry record
      const registryRecord = await storage.createRegistryRecord({
        ticketId,
        eventId: ticket.eventId,
        ownerId: userId,
        creatorId: event.userId || userId,
        title: title || `${event.name} - Ticket #${ticket.ticketNumber}`,
        description: description || `NFT for ${event.name} at ${event.venue} on ${event.date}`,
        metadata: JSON.stringify({
          ...JSON.parse(metadata || "{}"),
          originalTicket: {
            ticketNumber: ticket.ticketNumber,
            qrData: ticket.qrData,
            validatedAt: ticket.validatedAt,
            useCount: ticket.useCount
          }
        }),
        ticketNumber: ticket.ticketNumber,
        eventName: event.name,
        eventVenue: event.venue,
        eventDate: event.date,
        validatedAt: ticket.validatedAt!,
      });

      // Create mint transaction
      await storage.createRegistryTransaction({
        registryId: registryRecord.id,
        fromUserId: null,
        toUserId: userId,
        transactionType: "mint",
        price: null,
        royaltyAmount: null,
        creatorRoyalty: null,
        platformFee: null,
      });

      res.json({
        message: "Ticket successfully minted as NFT",
        registryRecord
      });
    } catch (error) {
      await logError(error, "POST /api/tickets/:ticketId/mint", {
        request: req
      });
      res.status(500).json({ message: "Failed to mint ticket" });
    }
  });

  app.get("/api/tickets/:ticketId/mint-status", async (req, res) => {
    try {
      const userId = extractUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { ticketId } = req.params;

      // Get the ticket
      const ticket = await storage.getTicket(ticketId);
      if (!ticket) {
        return res.status(404).json({ message: "Ticket not found" });
      }

      // Get the event to check if minting is allowed
      const event = await storage.getEvent(ticket.eventId);
      if (!event || !event.allowMinting) {
        return res.json({
          canMint: false,
          alreadyMinted: false,
          needsValidation: false,
          mintingDisabled: true
        });
      }

      // Check if already minted
      const registryRecord = await storage.getRegistryRecordByTicket(ticketId);
      if (registryRecord) {
        return res.json({
          canMint: false,
          alreadyMinted: true,
          registryRecord
        });
      }

      // Check validation status
      if (!ticket.isValidated || !ticket.validatedAt) {
        return res.json({
          canMint: false,
          alreadyMinted: false,
          needsValidation: true
        });
      }

      // Calculate time remaining
      const now = new Date();
      const validatedTime = new Date(ticket.validatedAt);
      const seventyTwoHoursMs = 72 * 60 * 60 * 1000;
      const timeDiff = now.getTime() - validatedTime.getTime();
      const timeRemaining = Math.max(0, seventyTwoHoursMs - timeDiff);

      res.json({
        canMint: timeDiff >= seventyTwoHoursMs,
        alreadyMinted: false,
        validatedAt: ticket.validatedAt,
        timeRemaining: timeRemaining,
        timeRemainingHours: Math.ceil(timeRemaining / (60 * 60 * 1000))
      });
    } catch (error) {
      await logError(error, "GET /api/tickets/:ticketId/mint-status", {
        request: req
      });
      res.status(500).json({ message: "Failed to get mint status" });
    }
  });

  app.get("/api/user/registry", async (req, res) => {
    try {
      const userId = extractUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const registryRecords = await storage.getRegistryRecordsByUser(userId);
      res.json(registryRecords);
    } catch (error) {
      await logError(error, "GET /api/user/registry", {
        request: req
      });
      res.status(500).json({ message: "Failed to fetch registry records" });
    }
  });

  // Featured Events Routes
  app.get("/api/featured-events", async (req, res) => {
    try {
      // Clean up expired featured events first
      await storage.cleanupExpiredFeaturedEvents();
      
      const featuredEvents = await storage.getFeaturedEventsWithDetails();
      res.json(featuredEvents);
    } catch (error) {
      await logError(error, "GET /api/featured-events", {
        request: req
      });
      res.status(500).json({ message: "Failed to fetch featured events" });
    }
  });

  app.get("/api/events/:id/boost-info", async (req, res) => {
    try {
      const { id } = req.params;
      const userId = extractUserId(req);
      
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      // Check if event exists and belongs to user
      const event = await storage.getEvent(id);
      if (!event || event.userId !== userId) {
        return res.status(404).json({ message: "Event not found" });
      }

      // Check if event can be boosted
      const canBoost = await storage.canBoostEvent(id);
      const featuredCount = await storage.getFeaturedEventCount();
      const nextPosition = await storage.getNextAvailablePosition();
      
      // Duration-based pricing: $0.02 per hour for standard, $0.04 per hour for bump
      const standardHourlyRate = 0.02;
      const bumpHourlyRate = 0.04;

      res.json({
        canBoost,
        currentFeaturedCount: featuredCount,
        maxSlots: 100,
        nextPosition,
        standardHourlyRate: standardHourlyRate.toFixed(2),
        bumpHourlyRate: bumpHourlyRate.toFixed(2),
        allSlotsTaken: nextPosition === null
      });
    } catch (error) {
      await logError(error, "GET /api/events/:id/boost-info", {
        request: req
      });
      res.status(500).json({ message: "Failed to get boost info" });
    }
  });

  app.post("/api/events/:id/boost", async (req, res) => {
    try {
      const { id } = req.params;
      const { duration, isBump = false } = req.body;
      const userId = extractUserId(req);
      
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      // Validate duration
      if (!["1hour", "6hours", "12hours", "24hours"].includes(duration)) {
        return res.status(400).json({ message: "Invalid duration" });
      }

      // Check if event exists and belongs to user
      const event = await storage.getEvent(id);
      if (!event || event.userId !== userId) {
        return res.status(404).json({ message: "Event not found" });
      }

      // Check if event can be boosted
      const canBoost = await storage.canBoostEvent(id);
      if (!canBoost) {
        return res.status(400).json({ message: "Event is already featured" });
      }

      const featuredCount = await storage.getFeaturedEventCount();
      let position = await storage.getNextAvailablePosition();
      
      // Calculate duration-based pricing
      const standardHourlyRate = 0.02;
      const bumpHourlyRate = 0.04;
      
      const durationHours = {
        "1hour": 1,
        "6hours": 6,
        "12hours": 12,
        "24hours": 24
      }[duration as "1hour" | "6hours" | "12hours" | "24hours"];

      let price = standardHourlyRate * durationHours;

      // Handle bump-in scenario
      if (isBump) {
        if (position !== null) {
          return res.status(400).json({ message: "Bump not needed, slots available" });
        }
        price = bumpHourlyRate * durationHours;
        position = 1; // Bump to position 1
        
        // Shift all existing positions down by 1
        // This would require additional logic to update existing featured events
        // For now, we'll just place it at position 1
      } else if (position === null) {
        return res.status(400).json({ message: "All featured slots are taken" });
      }

      // Apply discounts for longer durations
      if (duration === "12hours") {
        price = price * 0.9; // 10% discount
      } else if (duration === "24hours") {
        price = price * 0.8; // 20% discount
      }

      // Calculate end time based on duration
      const now = new Date();
      const durationMs = {
        "1hour": 60 * 60 * 1000,
        "6hours": 6 * 60 * 60 * 1000,
        "12hours": 12 * 60 * 60 * 1000,
        "24hours": 24 * 60 * 60 * 1000
      }[duration as "1hour" | "6hours" | "12hours" | "24hours"];

      const endTime = new Date(now.getTime() + durationMs);

      // Create featured event record
      const featuredEvent = await storage.createFeaturedEvent({
        eventId: id,
        duration,
        startTime: now,
        endTime,
        pricePaid: price.toString(),
        isBumped: isBump,
        position: position!
      });

      res.json({
        success: true,
        featuredEvent,
        price: price.toFixed(2),
        endTime
      });
    } catch (error) {
      await logError(error, "POST /api/events/:id/boost", {
        request: req
      });
      res.status(500).json({ message: "Failed to boost event" });
    }
  });

  app.get("/api/events-paginated", async (req, res) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 25;
      
      if (page < 1 || limit < 1 || limit > 100) {
        return res.status(400).json({ message: "Invalid pagination parameters" });
      }

      const events = await storage.getEventsPaginated(page, limit);
      const total = await storage.getTotalEventsCount();
      const totalPages = Math.ceil(total / limit);

      res.json({
        events,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1
        }
      });
    } catch (error) {
      await logError(error, "GET /api/events-paginated", {
        request: req
      });
      res.status(500).json({ message: "Failed to fetch paginated events" });
    }
  });

  // Notifications endpoints
  app.get("/api/notifications", async (req, res) => {
    try {
      const userId = extractUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const notifications = await storage.getNotifications(userId);
      res.json(notifications);
    } catch (error) {
      await logError(error, "GET /api/notifications", {
        request: req
      });
      res.status(500).json({ message: "Failed to fetch notifications" });
    }
  });

  app.post("/api/notifications", async (req, res) => {
    try {
      const userId = extractUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const validation = insertNotificationSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ 
          message: "Invalid notification data", 
          errors: validation.error.errors 
        });
      }

      const notification = await storage.createNotification({
        ...validation.data,
        userId
      });

      res.status(201).json(notification);
    } catch (error) {
      await logError(error, "POST /api/notifications", {
        request: req
      });
      res.status(500).json({ message: "Failed to create notification" });
    }
  });

  app.patch("/api/notifications/:id/read", async (req, res) => {
    try {
      const userId = extractUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const notification = await storage.markNotificationAsRead(req.params.id);
      
      if (!notification) {
        return res.status(404).json({ message: "Notification not found" });
      }

      res.json(notification);
    } catch (error) {
      await logError(error, "PATCH /api/notifications/:id/read", {
        request: req
      });
      res.status(500).json({ message: "Failed to mark notification as read" });
    }
  });

  app.patch("/api/notifications/mark-all-read", async (req, res) => {
    try {
      const userId = extractUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      await storage.markAllNotificationsAsRead(userId);
      res.json({ message: "All notifications marked as read" });
    } catch (error) {
      await logError(error, "PATCH /api/notifications/mark-all-read", {
        request: req
      });
      res.status(500).json({ message: "Failed to mark all notifications as read" });
    }
  });

  app.get("/api/notification-preferences", async (req, res) => {
    try {
      const userId = extractUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const preferences = await storage.getNotificationPreferences(userId);
      res.json(preferences);
    } catch (error) {
      await logError(error, "GET /api/notification-preferences", {
        request: req
      });
      res.status(500).json({ message: "Failed to fetch notification preferences" });
    }
  });

  app.patch("/api/notification-preferences", async (req, res) => {
    try {
      const userId = extractUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const validation = insertNotificationPreferencesSchema.omit({ userId: true }).safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ 
          message: "Invalid preferences data", 
          errors: validation.error.errors 
        });
      }

      const preferences = await storage.updateNotificationPreferences(userId, validation.data);
      res.json(preferences);
    } catch (error) {
      await logError(error, "PATCH /api/notification-preferences", {
        request: req
      });
      res.status(500).json({ message: "Failed to update notification preferences" });
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