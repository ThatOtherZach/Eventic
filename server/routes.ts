import type { Express, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertEventSchema, insertTicketSchema, insertFeaturedEventSchema, insertNotificationSchema, insertNotificationPreferencesSchema } from "@shared/schema";
import { z } from "zod";
import { ObjectStorageService, ObjectNotFoundError } from "./objectStorage";
import { logError, logWarning, logInfo } from "./logger";
import { extractAuthUser, requireAuth, extractUserId, extractUserEmail, AuthenticatedRequest } from "./auth";
import { validateBody, validateQuery, paginationSchema } from "./validation";
import rateLimit from "express-rate-limit";

// Rate limiter configuration for ticket purchases
const purchaseRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 3, // Max 3 purchases per minute
  message: 'Too many purchase attempts. Please wait a moment before trying again.',
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  skipFailedRequests: false,
  handler: async (req, res) => {
    await logWarning(
      'Rate limit exceeded for ticket purchase',
      req.path,
      {
        userId: extractUserId(req as AuthenticatedRequest) || undefined,
        metadata: { 
          rateLimitWindow: 60000,
          maxPurchases: 3,
          ip: req.ip
        }
      }
    );
    res.status(429).json({
      message: 'Too many purchase attempts. Please wait a moment before trying again.',
      retryAfter: 60
    });
  }
});

// Rate limiter for event creation  
const eventCreationRateLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 2, // Max 2 events per 5 minutes
  message: 'Too many events created. Please wait before creating another event.',
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  skipFailedRequests: false,
  handler: async (req, res) => {
    await logWarning(
      'Rate limit exceeded for event creation',
      req.path,
      {
        userId: extractUserId(req as AuthenticatedRequest) || undefined,
        metadata: {
          rateLimitWindow: 300000,
          maxEvents: 2,
          ip: req.ip
        }
      }
    );
    res.status(429).json({
      message: 'Too many events created. Please wait before creating another event.',
      retryAfter: 300
    });
  }
});

// General API rate limiter
const generalRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Limit each IP to 1000 requests per windowMs (reasonable for normal browsing)
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  // Use default keyGenerator which handles IPv6 properly
});

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

// Validation rate limiter
const validationRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute  
  max: 20, // Max 20 validation attempts per minute
  message: 'Too many validation attempts. Please wait a moment before trying again.',
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  skipFailedRequests: false
});

export async function registerRoutes(app: Express): Promise<Server> {
  const objectStorageService = new ObjectStorageService();

  // Set trust proxy for accurate IP detection
  app.set('trust proxy', 1);
  
  // Apply general rate limiting to all routes
  app.use(generalRateLimiter);
  
  // Apply authentication middleware to extract user from JWT on all routes
  app.use(extractAuthUser);

  // New login endpoint with rate limiting
  app.post("/api/auth/login", async (req: AuthenticatedRequest, res) => {
    const { checkLoginRateLimit } = await import('./authLimiter');
    
    // Apply rate limiting check
    await new Promise((resolve) => {
      checkLoginRateLimit(req, res, resolve as NextFunction);
    });
    
    // If rate limited, response was already sent
    if (res.headersSent) return;
    
    const { email, rememberMe } = req.body;
    const ipAddress = req.ip || 'unknown';
    
    try {
      // Check if Supabase is available (you could add a health check here)
      const isSupabaseAvailable = true; // For now, assume it's available
      
      if (!isSupabaseAvailable) {
        // Add to queue (queuePosition is calculated in addToAuthQueue)
        const queueItem = await storage.addToAuthQueue({
          email,
          queuePosition: 0, // Will be calculated in storage method
          status: 'waiting'
        });
        
        const position = await storage.getQueuePosition(email);
        
        return res.status(503).json({
          message: 'Authentication service is currently busy. You have been added to the queue.',
          queuePosition: position,
          queueId: queueItem.id
        });
      }
      
      // Record login attempt
      await storage.recordLoginAttempt({
        email,
        ipAddress,
        success: false // Will update if successful
      });
      
      // Record auth event
      await storage.recordAuthEventNew({
        type: 'login_attempt',
        email,
        ipAddress,
        metadata: { rememberMe } as any
      });
      
      // In production, you would trigger Supabase magic link here
      // For now, return success to continue with existing flow
      res.json({
        message: 'Magic link sent to your email',
        sessionDuration: rememberMe ? 30 : 15, // days
        requiresCaptcha: false
      });
      
    } catch (error) {
      await storage.recordAuthEventNew({
        type: 'login_failure',
        email,
        ipAddress,
        metadata: { error: (error as Error).message } as any
      });
      
      await logError(error, "POST /api/auth/login", {
        request: req,
        metadata: { email }
      });
      
      res.status(500).json({ message: 'Login failed' });
    }
  });
  
  // Monitoring endpoints
  app.get("/api/monitoring/auth-metrics", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const hours = parseInt(req.query.hours as string) || 24;
      const metrics = await storage.getAuthMetrics(hours);
      res.json(metrics);
    } catch (error) {
      await logError(error, "GET /api/monitoring/auth-metrics", { request: req });
      res.status(500).json({ message: 'Failed to fetch auth metrics' });
    }
  });
  
  app.get("/api/monitoring/system-metrics", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const stats = await storage.getEventStats();
      
      // Get active users count (users who logged in within last 24 hours)
      const activeUsers = await storage.getAuthMetrics(24);
      
      // Get current queue length
      const queueLength = await storage.getQueuePosition('_count_only_') || 0;
      
      res.json({
        totalEvents: stats.totalEvents,
        totalTickets: stats.totalTickets,
        validatedTickets: stats.validatedTickets,
        activeUsers: activeUsers.uniqueUsers,
        queueLength
      });
    } catch (error) {
      await logError(error, "GET /api/monitoring/system-metrics", { request: req });
      res.status(500).json({ message: 'Failed to fetch system metrics' });
    }
  });
  
  // Get queue position
  app.get("/api/auth/queue/:email", async (req: AuthenticatedRequest, res) => {
    try {
      const position = await storage.getQueuePosition(req.params.email);
      
      if (position === null) {
        return res.status(404).json({ message: 'Not in queue' });
      }
      
      res.json({ position });
    } catch (error) {
      res.status(500).json({ message: 'Failed to get queue position' });
    }
  });
  
  // Sync/create user in local database when they login via Supabase
  app.post("/api/auth/sync-user", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user?.id;
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

  // Update user profile


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



  // Location-based event filtering
  app.get("/api/events/location/:location", async (req: AuthenticatedRequest, res) => {
    try {
      const location = decodeURIComponent(req.params.location).trim().toLowerCase();
      
      // Get all public events only - private events must never appear in location listings
      let events = (await storage.getEvents()).filter(event => !event.isPrivate);
      
      // Filter out past events
      const now = new Date();
      events = events.filter(event => {
        if (event.endDate) {
          try {
            const endDate = new Date(event.endDate);
            if (!isNaN(endDate.getTime())) {
              endDate.setHours(23, 59, 59, 999);
              return now <= endDate;
            }
          } catch {}
        } else if (event.date) {
          try {
            const startDate = new Date(event.date);
            if (!isNaN(startDate.getTime())) {
              return now <= startDate;
            }
          } catch {}
        }
        return true;
      });
      
      // Filter by location (city or country) and ensure no private events slip through
      const filteredEvents = events.filter(event => {
        // Double-check that event is not private (safety check)
        if (event.isPrivate) return false;
        
        if (!event.venue) return false;
        const venueLower = event.venue.toLowerCase();
        
        // Check if the location matches any part of the venue string
        // This handles both "London" matching "123 Main St, London, United Kingdom"
        // and "United Kingdom" matching the same
        const venueParts = venueLower.split(',').map(part => part.trim());
        return venueParts.some(part => part.includes(location) || location.includes(part));
      });
      
      // Sort by date
      filteredEvents.sort((a, b) => {
        const dateA = new Date(a.date).getTime();
        const dateB = new Date(b.date).getTime();
        return dateA - dateB;
      });
      
      res.json(filteredEvents);
    } catch (error) {
      await logError(error, "GET /api/events/location/:location", {
        request: req,
        metadata: { location: req.params.location }
      });
      res.status(500).json({ message: "Failed to fetch events by location" });
    }
  });

  // Ticket routes
  app.get("/api/tickets/:ticketId", async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user?.id || null;
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
  app.post("/api/tickets/:ticketId/validate-session", async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user?.id || null;
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

  app.get("/api/tickets/:ticketId/validation-token", async (req: AuthenticatedRequest, res) => {
    const userId = req.user?.id || null;
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
  app.get("/api/user/tickets", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      const page = parseInt(req.query.page as string) || 1;
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 100); // Max 100 items per page
      
      // Use paginated query if page is specified
      if (req.query.page) {
        const result = await storage.getTicketsByUserIdPaginated(userId, { page, limit });
        // Fetch event data for each ticket
        const ticketsWithEvents = await Promise.all(
          result.tickets.map(async (ticket) => {
            const event = await storage.getEvent(ticket.eventId);
            return { ...ticket, event };
          })
        );
        res.json({ ...result, tickets: ticketsWithEvents });
      } else {
        // Legacy non-paginated response
        const tickets = await storage.getTicketsByUserId(userId);
        // Fetch event data for each ticket
        const ticketsWithEvents = await Promise.all(
          tickets.map(async (ticket) => {
            const event = await storage.getEvent(ticket.eventId);
            return { ...ticket, event };
          })
        );
        res.json(ticketsWithEvents);
      }
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch user tickets" });
    }
  });

  app.get("/api/user/events", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user?.id;
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
  app.get("/api/events", async (req: AuthenticatedRequest, res) => {
    try {
      const events = await storage.getEvents();
      // Filter out private events from general listing
      let publicEvents = events.filter(event => !event.isPrivate);
      

      
      // Filter out past events and sort by date (soonest first)
      const now = new Date();
      const activeEvents = publicEvents.filter(event => {
        try {
          const eventDateTime = new Date(`${event.date}T${event.time}`);
          return eventDateTime > now;
        } catch (error) {
          // If date parsing fails, exclude the event
          return false;
        }
      });
      
      // Sort events by date and time, prioritizing events in next 24 hours
      const sortedEvents = activeEvents.sort((a, b) => {
        try {
          const dateTimeA = new Date(`${a.date}T${a.time}`);
          const dateTimeB = new Date(`${b.date}T${b.time}`);
          
          const twentyFourHoursFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
          
          // Check if events are within next 24 hours
          const aIsWithin24h = dateTimeA <= twentyFourHoursFromNow;
          const bIsWithin24h = dateTimeB <= twentyFourHoursFromNow;
          
          // If one is within 24h and other isn't, prioritize the one within 24h
          if (aIsWithin24h && !bIsWithin24h) return -1;
          if (!aIsWithin24h && bIsWithin24h) return 1;
          
          // If both are in same category (within 24h or not), sort by date/time ascending (soonest first)
          return dateTimeA.getTime() - dateTimeB.getTime();
        } catch (error) {
          // If date parsing fails, sort by name as fallback
          return a.name.localeCompare(b.name);
        }
      });
      
      res.json(sortedEvents);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch events" });
    }
  });

  app.get("/api/events/:id", async (req, res) => {
    try {
      const eventWithCreator = await storage.getEventWithCreator(req.params.id);
      if (!eventWithCreator) {
        return res.status(404).json({ message: "Event not found" });
      }
      
      // Check if creator is an admin (has @saymservices.com email)
      const isAdminCreated = eventWithCreator.creatorEmail?.endsWith("@saymservices.com") || false;
      
      // Remove creatorEmail from response for privacy
      const { creatorEmail, ...event } = eventWithCreator;
      
      // Get total count of ALL tickets created for this event (regardless of resale status)
      // This gives us the true count of tickets sold
      const ticketsSold = await storage.getTotalTicketCountForEvent(req.params.id);
      
      // Get count of tickets in resale queue
      const resaleCount = await storage.getResellQueueCount(req.params.id);
      
      // Available tickets = max tickets - total tickets sold
      // When tickets are resold, they don't create new tickets, just transfer ownership
      // So we don't need to adjust for resale queue
      const ticketsAvailable = event.maxTickets ? 
        event.maxTickets - ticketsSold : null;
      
      // Get current price (handles surge pricing)
      const currentPrice = await storage.getCurrentPrice(req.params.id);
      
      res.json({
        ...event,
        ticketsSold,
        ticketsAvailable,
        currentPrice,
        resaleCount,
        isAdminCreated
      });
    } catch (error) {
      await logError(error, "GET /api/events/:id", {
        request: req,
        metadata: { eventId: req.params.id }
      });
      res.status(500).json({ message: "Failed to fetch event" });
    }
  });

  app.post("/api/events", eventCreationRateLimiter, validateBody(insertEventSchema), async (req: AuthenticatedRequest, res) => {
    const userId = req.user?.id;
    
    try {
      // Handle image URL normalization if provided
      let createData = { ...req.body };
      if (createData.imageUrl && createData.imageUrl.startsWith("https://storage.googleapis.com/")) {
        createData.imageUrl = objectStorageService.normalizeObjectEntityPath(createData.imageUrl);
      }
      if (createData.ticketBackgroundUrl && createData.ticketBackgroundUrl.startsWith("https://storage.googleapis.com/")) {
        createData.ticketBackgroundUrl = objectStorageService.normalizeObjectEntityPath(createData.ticketBackgroundUrl);
      }
      if (createData.stickerUrl && createData.stickerUrl.startsWith("https://storage.googleapis.com/")) {
        createData.stickerUrl = objectStorageService.normalizeObjectEntityPath(createData.stickerUrl);
      }
      
      // If ticket purchases are disabled, automatically set event to private
      if (createData.ticketPurchasesEnabled === false) {
        createData.isPrivate = true;
      }
      
      // Body is already validated by middleware
      const event = await storage.createEvent({
        ...createData,
        userId, // Now we can use the actual userId since user exists in DB
      });
      
      res.status(201).json(event);
    } catch (error) {
      await logError(error, "POST /api/events", {
        request: req,
        metadata: { eventData: req.body }
      });
      res.status(500).json({ message: "Failed to create event" });
    }
  });

  app.put("/api/events/:id", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user?.id;
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
      if (updateData.stickerUrl && updateData.stickerUrl.startsWith("https://storage.googleapis.com/")) {
        updateData.stickerUrl = objectStorageService.normalizeObjectEntityPath(updateData.stickerUrl);
      }
      
      // Validate the update data - create a new partial schema from the base event schema
      const baseEventSchema = z.object({
        name: z.string().optional(),
        description: z.string().optional(),
        contactDetails: z.string().nullable().optional(),
        venue: z.string().optional(),
        country: z.string().optional(),
        date: z.string().optional(),
        time: z.string().optional(),
        endDate: z.string().optional(),
        endTime: z.string().optional(),
        ticketPrice: z.string().optional(),
        maxTickets: z.number().optional(),
        userId: z.string().optional(),
        imageUrl: z.string().optional(),
        ticketBackgroundUrl: z.string().optional(),
        earlyValidation: z.enum(["At Start Time", "One Hour Before", "Two Hours Before", "Allow at Anytime"]).optional(),
        reentryType: z.enum(["No Reentry (Single Use)", "Pass (Multiple Use)", "No Limit"]).optional(),
        maxUses: z.number().optional(),
        goldenTicketEnabled: z.boolean().optional(),
        goldenTicketCount: z.number().optional(),
        specialEffectsEnabled: z.boolean().optional(),
        stickerUrl: z.string().optional(),
        stickerOdds: z.number().optional(),
        allowMinting: z.boolean().optional(),
        isPrivate: z.boolean().optional(),
        isEnabled: z.boolean().optional(),
        ticketPurchasesEnabled: z.boolean().optional(),
        oneTicketPerUser: z.boolean().optional(),
        surgePricing: z.boolean().optional(),
        timezone: z.string().optional(),
      });
      const validatedData = baseEventSchema.parse(updateData);
      
      // If ticket purchases are disabled, automatically set event to private
      if (validatedData.ticketPurchasesEnabled === false) {
        validatedData.isPrivate = true;
      }
      
      const updatedEvent = await storage.updateEvent(req.params.id, validatedData);
      
      // Send notifications to all ticket holders
      if (updatedEvent) {
        try {
          const ticketHolders = await storage.getUniqueTicketHolders(req.params.id);
          
          // Create notifications for each ticket holder
          const notifications = ticketHolders.map(async (ticketHolderId) => {
            if (ticketHolderId !== userId) { // Don't notify the event owner
              await storage.createNotification({
                userId: ticketHolderId,
                type: "event",
                title: "Event Updated", 
                description: `The event "${updatedEvent.name}" has been updated by the organizer. View at /events/${updatedEvent.id}`
              });
            }
          });
          
          await Promise.all(notifications);
        } catch (notificationError) {
          // Log the error but don't fail the event update
          console.error('Failed to send notifications:', notificationError);
        }
      }
      
      res.json(updatedEvent);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid event data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update event" });
    }
  });

  app.delete("/api/events/:id", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user?.id;
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
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      
      if (req.query.page) {
        const result = await storage.getTicketsPaginated({ page, limit });
        res.json(result);
      } else {
        const tickets = await storage.getTickets();
        res.json(tickets);
      }
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch tickets" });
    }
  });

  app.get("/api/events/:eventId/user-tickets", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user?.id;
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
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      
      if (req.query.page) {
        const result = await storage.getTicketsByEventIdPaginated(req.params.eventId, { page, limit });
        res.json(result);
      } else {
        const tickets = await storage.getTicketsByEventId(req.params.eventId);
        res.json(tickets);
      }
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch event tickets" });
    }
  });

  app.post("/api/events/:eventId/tickets", purchaseRateLimiter, validateBody(insertTicketSchema.partial()), async (req: AuthenticatedRequest, res) => {
    const userId = req.user?.id;
    const userEmail = req.user?.email;
    const userIp = req.ip || req.connection.remoteAddress || 'unknown';
    
    try {
      const event = await storage.getEvent(req.params.eventId);
      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }

      // Check if ticket purchases are enabled
      if (!event.ticketPurchasesEnabled) {
        return res.status(400).json({ 
          message: "Ticket sales are currently disabled for this event. Resale tickets may still be available." 
        });
      }

      // Check if event has already passed
      const now = new Date();
      
      // Check if event has an end date
      if (event.endDate) {
        try {
          const endDate = new Date(event.endDate);
          if (!isNaN(endDate.getTime())) {
            // Set end date to end of day for comparison
            endDate.setHours(23, 59, 59, 999);
            if (now > endDate) {
              return res.status(400).json({ 
                message: "Cannot purchase tickets for past events. This event ended on " + endDate.toLocaleDateString() 
              });
            }
          }
        } catch {
          // If date parsing fails, continue with other checks
        }
      } else if (event.date) {
        // No end date, check if event has started (for single-day events)
        try {
          const startDate = new Date(event.date);
          if (!isNaN(startDate.getTime()) && now > startDate) {
            return res.status(400).json({ 
              message: "Cannot purchase tickets for past events. This event started on " + startDate.toLocaleDateString() 
            });
          }
        } catch {
          // If date parsing fails, continue with purchase
        }
      }

      // Check if event has one ticket per user limit
      if (event.oneTicketPerUser) {
        // Check if user has already purchased a ticket for this event
        const hasTicket = await storage.checkUserHasTicketForEvent(
          req.params.eventId,
          userId || '',
          userEmail || '',
          userIp
        );
        
        if (hasTicket) {
          return res.status(400).json({ 
            message: "You have already purchased a ticket for this event. This event is limited to one ticket per person." 
          });
        }
      }

      // First, check if there are any resell tickets available
      const resellTicket = await storage.processResellPurchase(
        req.params.eventId,
        userId || '',
        userEmail || '',
        userIp
      );

      if (resellTicket) {
        // Found and purchased a resell ticket
        await logInfo(
          "Resell ticket purchased",
          "POST /api/events/:eventId/tickets",
          {
            userId,
            ticketId: resellTicket.id,
            eventId: req.params.eventId,
            metadata: {
              ticketNumber: resellTicket.ticketNumber,
              eventName: event.name,
              originalOwnerId: resellTicket.originalOwnerId,
              purchaseTime: new Date().toISOString()
            }
          }
        );

        
        return res.status(201).json(resellTicket);
      }

      // No resell tickets available, create a new ticket
      // Get current price for this ticket
      const currentPrice = await storage.getCurrentPrice(req.params.eventId);
      
      // Generate QR data for the ticket
      const tempTicketNumber = `${event.id.slice(0, 8)}-PENDING`;
      const qrData = JSON.stringify({
        eventId: req.params.eventId,
        ticketNumber: tempTicketNumber,
        timestamp: Date.now(),
      });

      const ticketData = {
        ...req.body, // Include validated body data
        eventId: req.params.eventId,
        userId, // Now we can use the actual userId since user exists in DB
        ticketNumber: tempTicketNumber, // Will be replaced by transaction
        qrData,
        purchaserEmail: userEmail, // Track email for anti-scalping
        purchaserIp: userIp, // Track IP for anti-scalping
        purchasePrice: currentPrice.toString(), // Store original purchase price for resale enforcement
      };

      // Use transactional ticket creation to prevent race conditions
      const ticket = await storage.createTicketWithTransaction(ticketData);
      
      res.status(201).json(ticket);
    } catch (error) {
      await logError(error, "POST /api/events/:eventId/tickets", {
        request: req,
        metadata: { eventId: req.params.eventId }
      });
      res.status(500).json({ message: "Failed to create ticket" });
    }
  });

  // Resell ticket endpoint
  app.post("/api/tickets/:ticketId/resell", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { ticketId } = req.params;
      
      // Get the ticket to verify it exists and belongs to the user
      const ticket = await storage.getTicket(ticketId);
      if (!ticket) {
        return res.status(404).json({ message: "Ticket not found" });
      }

      if (ticket.userId !== userId) {
        return res.status(403).json({ message: "You can only resell your own tickets" });
      }

      // Check if ticket has been validated
      if (ticket.isValidated) {
        return res.status(400).json({ message: "Cannot resell a validated ticket" });
      }

      // Check if already for resale
      if (ticket.resellStatus === "for_resale") {
        return res.status(400).json({ message: "Ticket is already listed for resale" });
      }

      // Get the event to check timing
      const event = await storage.getEvent(ticket.eventId);
      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }

      // Check if event start is at least 1 hour in the future
      const eventStartTime = new Date(`${event.date}T${event.time}:00`);
      const now = new Date();
      const hoursUntilEvent = (eventStartTime.getTime() - now.getTime()) / (1000 * 60 * 60);
      
      if (hoursUntilEvent < 1) {
        return res.status(400).json({ 
          message: "Reselling is only available until 1 hour before the event starts" 
        });
      }

      // Process the resell listing
      const listed = await storage.resellTicket(ticketId, userId);
      
      if (!listed) {
        return res.status(500).json({ message: "Failed to list ticket for resale" });
      }

      // Log the resell listing
      await logInfo(
        "Ticket listed for resale",
        "POST /api/tickets/:ticketId/resell",
        {
          userId,
          ticketId,
          eventId: ticket.eventId,
          metadata: {
            ticketNumber: ticket.ticketNumber,
            eventName: event.name,
            resellTime: new Date().toISOString()
          }
        }
      );

      res.json({ 
        message: "Ticket listed for resale successfully",
        resold: true
      });
    } catch (error) {
      await logError(error, "POST /api/tickets/:ticketId/resell", {
        request: req,
        metadata: { ticketId: req.params.ticketId }
      });
      res.status(500).json({ message: "Failed to list ticket for resale" });
    }
  });

  // Validation routes
  app.post("/api/validate", validationRateLimiter, async (req: AuthenticatedRequest, res) => {
    try {
      const { qrData } = req.body;
      if (!qrData) {
        return res.status(400).json({ message: "QR data is required" });
      }

      const userId = req.user?.id || null;
      const userEmail = req.user?.email || null;

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

  // Admin routes (protected - only for @saymservices.com emails)
  app.get("/api/admin/events", async (req: AuthenticatedRequest, res) => {
    try {
      // Check admin access
      if (!req.user?.email?.endsWith("@saymservices.com")) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const events = await storage.getAllEventsForAdmin();
      res.json(events);
    } catch (error) {
      await logError(error, "GET /api/admin/events", {
        request: req
      });
      res.status(500).json({ message: "Failed to fetch events" });
    }
  });

  app.put("/api/admin/events/:eventId/toggle", async (req: AuthenticatedRequest, res) => {
    try {
      // Check admin access
      if (!req.user?.email?.endsWith("@saymservices.com")) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const { eventId } = req.params;
      const { field, value } = req.body;

      if (!field || !["isEnabled", "ticketPurchasesEnabled"].includes(field)) {
        return res.status(400).json({ message: "Invalid field" });
      }

      const updatedEvent = await storage.updateEventVisibility(eventId, field, value);
      if (!updatedEvent) {
        return res.status(404).json({ message: "Event not found" });
      }

      res.json(updatedEvent);
    } catch (error) {
      await logError(error, "PUT /api/admin/events/:eventId/toggle", {
        request: req
      });
      res.status(500).json({ message: "Failed to update event" });
    }
  });

  // Special effects odds configuration
  const specialEffectsOdds = {
    valentines: 14,
    halloween: 88,
    christmas: 25,
    nice: 69
  };

  app.get("/api/admin/special-effects-odds", async (req: AuthenticatedRequest, res) => {
    try {
      // Check admin access
      if (!req.user?.email?.endsWith("@saymservices.com")) {
        return res.status(403).json({ message: "Admin access required" });
      }

      res.json(specialEffectsOdds);
    } catch (error) {
      await logError(error, "GET /api/admin/special-effects-odds", {
        request: req
      });
      res.status(500).json({ message: "Failed to fetch odds" });
    }
  });

  app.put("/api/admin/special-effects-odds", async (req: AuthenticatedRequest, res) => {
    try {
      // Check admin access
      if (!req.user?.email?.endsWith("@saymservices.com")) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const { valentines, halloween, christmas, nice } = req.body;
      
      // Validate odds are reasonable numbers
      if (valentines < 1 || valentines > 1000 ||
          halloween < 1 || halloween > 1000 ||
          christmas < 1 || christmas > 1000 ||
          nice < 1 || nice > 1000) {
        return res.status(400).json({ message: "Odds must be between 1 and 1000" });
      }

      // Update the odds
      specialEffectsOdds.valentines = valentines;
      specialEffectsOdds.halloween = halloween;
      specialEffectsOdds.christmas = christmas;
      specialEffectsOdds.nice = nice;

      res.json(specialEffectsOdds);
    } catch (error) {
      await logError(error, "PUT /api/admin/special-effects-odds", {
        request: req
      });
      res.status(500).json({ message: "Failed to update odds" });
    }
  });

  // Recurring Events Processing
  app.post("/api/admin/process-recurring-events", async (req: AuthenticatedRequest, res) => {
    try {
      // Check admin access
      if (!req.user?.email?.endsWith("@saymservices.com")) {
        return res.status(403).json({ message: "Admin access required" });
      }

      // Get events that need recurrence
      const eventsNeedingRecurrence = await storage.getEventsNeedingRecurrence();
      
      const results = [];
      for (const event of eventsNeedingRecurrence) {
        try {
          const newEvent = await storage.createRecurringEvent(event);
          if (newEvent) {
            results.push({
              originalEventId: event.id,
              originalEventName: event.name,
              newEventId: newEvent.id,
              newEventDate: newEvent.date,
              success: true,
              error: null
            });
            
            await logInfo(
              `Recurring event created`,
              "POST /api/admin/process-recurring-events",
              {
                eventId: newEvent.id,
                metadata: {
                  originalEventId: event.id,
                  recurringType: event.recurringType,
                  newEventDate: newEvent.date
                }
              }
            );
          }
        } catch (error) {
          results.push({
            originalEventId: event.id,
            originalEventName: event.name,
            newEventId: null,
            newEventDate: null,
            success: false,
            error: error instanceof Error ? error.message : "Unknown error"
          });
          
          await logError(error, "POST /api/admin/process-recurring-events", {
            eventId: event.id,
            metadata: {
              eventName: event.name
            }
          });
        }
      }

      res.json({
        message: `Processed ${results.length} recurring events. ${results.filter(r => r.success).length} created successfully.`,
        results
      });
    } catch (error) {
      await logError(error, "POST /api/admin/process-recurring-events", {
        request: req
      });
      res.status(500).json({ message: "Failed to process recurring events" });
    }
  });

  // Delegated Validators routes
  app.get("/api/events/:eventId/validators", async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user?.id || null;
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

  app.post("/api/events/:eventId/validators", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user?.id;
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

  app.delete("/api/events/:eventId/validators/:validatorId", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user?.id;
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

  app.get("/api/events/:eventId/validated-tickets", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user?.id;
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
  app.get("/api/system-logs", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user?.id;
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
  app.get("/api/user/past-events", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user?.id;
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

  app.get("/api/user/past-tickets", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user?.id;
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
  app.post("/api/archive/check", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user?.id;
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
  app.post("/api/tickets/:ticketId/mint", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user?.id;
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

      // Private events cannot be minted as NFTs
      if (event.isPrivate) {
        return res.status(403).json({ message: "Private events are not eligible for NFT minting" });
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

  app.get("/api/tickets/:ticketId/mint-status", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user?.id;
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

  app.get("/api/user/registry", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user?.id;
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
  app.get("/api/featured-events", async (req: AuthenticatedRequest, res) => {
    try {
      // Clean up expired featured events first
      await storage.cleanupExpiredFeaturedEvents();
      
      let featuredEvents = await storage.getFeaturedEventsWithDetails();
      
      // Filter out past events
      const now = new Date();
      featuredEvents = featuredEvents.filter(featuredEvent => {
        const event = featuredEvent.event;
        
        // Check if event has an end date
        if (event.endDate) {
          try {
            const endDate = new Date(event.endDate);
            if (!isNaN(endDate.getTime())) {
              // Set end date to end of day for comparison
              endDate.setHours(23, 59, 59, 999);
              // Keep event if it hasn't ended yet
              return now <= endDate;
            }
          } catch {
            // If date parsing fails, keep the event
          }
        } else if (event.date) {
          // No end date, check if event hasn't started yet (for single-day events)
          try {
            const startDate = new Date(event.date);
            if (!isNaN(startDate.getTime())) {
              // Keep event if it hasn't started yet
              return now <= startDate;
            }
          } catch {
            // If date parsing fails, keep the event
          }
        }
        
        // If no valid dates, keep the event
        return true;
      });
      
      // Featured events should ALWAYS show regardless of location preferences
      
      res.json(featuredEvents);
    } catch (error) {
      await logError(error, "GET /api/featured-events", {
        request: req
      });
      res.status(500).json({ message: "Failed to fetch featured events" });
    }
  });

  app.get("/api/featured-grid", async (req: AuthenticatedRequest, res) => {
    try {
      // Clean up expired featured events first
      await storage.cleanupExpiredFeaturedEvents();
      
      // Get paid boost events (featured events)
      let featuredEvents = await storage.getFeaturedEventsWithDetails();
      
      // Get all regular events for random selection (exclude private events)
      let allEvents = (await storage.getEvents()).filter(event => !event.isPrivate);
      
      // Filter out past events from both featured and regular events
      const now = new Date();
      const isEventNotPast = (event: any) => {
        // Check if event has an end date
        if (event.endDate) {
          try {
            const endDate = new Date(event.endDate);
            if (!isNaN(endDate.getTime())) {
              // Set end date to end of day for comparison
              endDate.setHours(23, 59, 59, 999);
              // Keep event if it hasn't ended yet
              return now <= endDate;
            }
          } catch {
            // If date parsing fails, keep the event
          }
        } else if (event.date) {
          // No end date, check if event hasn't started yet (for single-day events)
          try {
            const startDate = new Date(event.date);
            if (!isNaN(startDate.getTime())) {
              // Keep event if it hasn't started yet
              return now <= startDate;
            }
          } catch {
            // If date parsing fails, keep the event
          }
        }
        
        // If no valid dates, keep the event
        return true;
      };
      
      // Apply past event filtering
      featuredEvents = featuredEvents.filter(fe => isEventNotPast(fe.event));
      allEvents = allEvents.filter(isEventNotPast);
      
      // Featured grid should ALWAYS show all events regardless of location preferences
      
      // Target: 6 events total, with 3/4 (4-5) being paid boosts if available
      const targetTotal = 6;
      const targetPaidBoosts = Math.min(Math.ceil(targetTotal * 0.75), featuredEvents.length);
      const targetRandomEvents = targetTotal - targetPaidBoosts;
      
      let gridEvents = [];
      
      // Add paid boost events first (up to 4-5 events)
      if (featuredEvents.length > 0) {
        gridEvents.push(...featuredEvents.slice(0, targetPaidBoosts));
      }
      
      // Fill remaining slots with random events (exclude already featured events)
      if (gridEvents.length < targetTotal) {
        const featuredEventIds = new Set(gridEvents.map(fe => fe.event.id));
        const availableEvents = allEvents.filter(event => !featuredEventIds.has(event.id) && !event.isPrivate);
        
        // Shuffle and take needed amount
        const shuffled = availableEvents.sort(() => Math.random() - 0.5);
        const needed = targetTotal - gridEvents.length;
        
        const randomEvents = shuffled.slice(0, needed).map(event => ({
          id: `random-${event.id}`,
          event,
          isPaid: false,
          isBumped: false,
          duration: '',
          startTime: new Date(),
          endTime: new Date(),
          position: 0
        }));
        
        gridEvents.push(...randomEvents);
      }
      
      // Final shuffle to mix paid and random events
      gridEvents = gridEvents.sort(() => Math.random() - 0.5);
      
      res.json(gridEvents);
    } catch (error) {
      await logError(error, "GET /api/featured-grid", {
        request: req
      });
      res.status(500).json({ message: "Failed to fetch featured grid" });
    }
  });

  app.get("/api/events/:id/boost-info", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const { id } = req.params;
      const userId = req.user?.id;
      
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      // Check if event exists and belongs to user
      const event = await storage.getEvent(id);
      if (!event || event.userId !== userId) {
        return res.status(404).json({ message: "Event not found" });
      }

      // Private events cannot be boosted
      if (event.isPrivate) {
        return res.status(400).json({ message: "Private events cannot be featured or boosted" });
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

  app.post("/api/events/:id/boost", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const { id } = req.params;
      const { duration, isBump = false } = req.body;
      const userId = req.user?.id;
      
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

      // Private events cannot be boosted
      if (event.isPrivate) {
        return res.status(400).json({ message: "Private events cannot be featured or boosted" });
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
  app.get("/api/notifications", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user?.id;
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

  app.post("/api/notifications", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user?.id;
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

  app.patch("/api/notifications/:id/read", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user?.id;
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

  app.patch("/api/notifications/mark-all-read", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user?.id;
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

  app.get("/api/notification-preferences", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user?.id;
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

  app.patch("/api/notification-preferences", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user?.id;
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

  // Event Rating endpoints
  app.post("/api/tickets/:ticketId/rate", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { ticketId } = req.params;
      const { rating } = req.body;

      // Validate rating
      if (!rating || !['thumbs_up', 'thumbs_down'].includes(rating)) {
        return res.status(400).json({ message: "Invalid rating. Must be 'thumbs_up' or 'thumbs_down'" });
      }

      // Verify the ticket belongs to the user
      const ticket = await storage.getTicket(ticketId);
      if (!ticket || ticket.userId !== userId) {
        return res.status(403).json({ message: "You can only rate events for your own tickets" });
      }

      // Get event details to fetch the owner ID
      const event = await storage.getEvent(ticket.eventId);
      if (!event || !event.userId) {
        return res.status(404).json({ message: "Event not found or has no owner" });
      }

      // Check if event rating period is still valid (within 24 hours after start)
      const eventStartDateTime = `${event.date}T${event.time}:00`;
      const eventStart = new Date(eventStartDateTime);
      const now = new Date();
      const hoursSinceStart = (now.getTime() - eventStart.getTime()) / (1000 * 60 * 60);
      
      if (hoursSinceStart > 24) {
        return res.status(400).json({ message: "Rating period has ended (24 hours after event start)" });
      }

      // Check if user has already rated this event
      const existingRating = await storage.getUserEventRating(userId, ticket.eventId);
      
      if (existingRating) {
        // User has already rated, update their rating
        const updatedRating = await storage.updateEventRating(userId, ticket.eventId, rating);
        
        if (!updatedRating) {
          return res.status(400).json({ message: "Failed to update rating" });
        }
        
        res.json({ success: true, rating: updatedRating, updated: true });
      } else {
        // Create new rating
        const eventRating = await storage.rateEvent({
          ticketId,
          eventId: ticket.eventId,
          eventOwnerId: event.userId,
          rating
        });

        if (!eventRating) {
          return res.status(400).json({ message: "Failed to submit rating" });
        }

        res.json({ success: true, rating: eventRating, updated: false });
      }
    } catch (error) {
      await logError(error, "POST /api/tickets/:ticketId/rate", {
        request: req
      });
      res.status(500).json({ message: "Failed to submit event rating" });
    }
  });

  app.get("/api/tickets/:ticketId/rating", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      const { ticketId } = req.params;
      
      // Get the ticket to find the event ID
      const ticket = await storage.getTicket(ticketId);
      if (!ticket) {
        return res.status(404).json({ message: "Ticket not found" });
      }
      
      // Get the event to check if rating period is still valid
      const event = await storage.getEvent(ticket.eventId);
      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }
      
      // Check if within rating period (24 hours after event start)
      const eventStartDateTime = `${event.date}T${event.time}:00`;
      const eventStart = new Date(eventStartDateTime);
      const now = new Date();
      const hoursSinceStart = (now.getTime() - eventStart.getTime()) / (1000 * 60 * 60);
      const canRate = hoursSinceStart <= 24;
      
      // Get user's existing rating if any
      const existingRating = await storage.getUserEventRating(userId, ticket.eventId);
      
      res.json({ 
        hasRated: !!existingRating,
        currentRating: existingRating?.rating || null,
        canRate,
        ratingPeriodEnded: hoursSinceStart > 24
      });
    } catch (error) {
      await logError(error, "GET /api/tickets/:ticketId/rating", {
        request: req
      });
      res.status(500).json({ message: "Failed to check rating status" });
    }
  });
  
  app.get("/api/users/:userId/reputation", async (req, res) => {
    try {
      const { userId } = req.params;
      
      const reputation = await storage.getUserReputation(userId);
      res.json(reputation);
    } catch (error) {
      await logError(error, "GET /api/users/:userId/reputation", {
        request: req
      });
      res.status(500).json({ message: "Failed to fetch user reputation" });
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