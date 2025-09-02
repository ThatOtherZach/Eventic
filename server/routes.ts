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
import { generateUniqueDisplayName } from "./utils/display-name-generator";
import { getTicketCaptureService, getFFmpegPath } from "./ticketCapture";
import { execFile } from 'child_process';
import path from 'path';
import fs from 'fs';

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
        // If user exists but doesn't have a display name, generate one
        if (!existingUser.displayName) {
          // Get all existing display names to ensure uniqueness
          const allUsers = await storage.getAllUsers();
          const existingDisplayNames = allUsers
            .map(u => u.displayName)
            .filter(Boolean) as string[];

          // Generate unique display name
          const displayName = generateUniqueDisplayName(existingDisplayNames, existingUser.createdAt || new Date());

          // Update user with display name
          const updatedUser = await storage.updateUserDisplayName(userId, displayName);
          return res.json(updatedUser);
        }
        return res.json(existingUser);
      }

      // Get all existing display names to ensure uniqueness
      const allUsers = await storage.getAllUsers();
      const existingDisplayNames = allUsers
        .map(u => u.displayName)
        .filter(Boolean) as string[];

      // Generate unique display name
      const displayName = generateUniqueDisplayName(existingDisplayNames, new Date());

      // Create new user in local database
      const newUser = await storage.createUser({
        id: userId,
        email: email || `user_${userId}@placeholder.com`,
        displayName,
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
      
      // Get featured events to check which events are boosted
      const featuredEvents = await storage.getActiveFeaturedEvents();
      const featuredEventIds = new Set(featuredEvents.map(fe => fe.eventId));
      
      // Filter out past events (only if more than 24 hours past)
      const now = new Date();
      const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      events = events.filter(event => {
        if (event.endDate) {
          try {
            const endDate = new Date(event.endDate);
            if (!isNaN(endDate.getTime())) {
              endDate.setHours(23, 59, 59, 999);
              return endDate >= twentyFourHoursAgo;
            }
          } catch {}
        } else if (event.date && event.time) {
          try {
            const [year, month, day] = event.date.split('-').map(Number);
            const [hours, minutes] = event.time.split(':').map(Number);
            const eventDateTime = new Date(year, month - 1, day, hours, minutes);
            
            // Include events that ended less than 24 hours ago
            return eventDateTime >= twentyFourHoursAgo;
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
      
      // Sort events: boosted events first (sorted by position), then regular events by date
      filteredEvents.sort((a, b) => {
        const aIsBoosted = featuredEventIds.has(a.id);
        const bIsBoosted = featuredEventIds.has(b.id);
        
        // If both are boosted, sort by position
        if (aIsBoosted && bIsBoosted) {
          const aFeatured = featuredEvents.find(fe => fe.eventId === a.id);
          const bFeatured = featuredEvents.find(fe => fe.eventId === b.id);
          return (aFeatured?.position || 999) - (bFeatured?.position || 999);
        }
        
        // Boosted events come first
        if (aIsBoosted && !bIsBoosted) return -1;
        if (!aIsBoosted && bIsBoosted) return 1;
        
        // Both regular events, sort by date
        const dateA = new Date(a.date).getTime();
        const dateB = new Date(b.date).getTime();
        return dateA - dateB;
      });
      
      // Add current price with surge pricing to each event
      const eventsWithPricing = await Promise.all(filteredEvents.map(async (event) => {
        const currentPrice = await storage.getCurrentPrice(event.id);
        return {
          ...event,
          currentPrice
        };
      }));
      
      res.json(eventsWithPricing);
    } catch (error) {
      await logError(error, "GET /api/events/location/:location", {
        request: req,
        metadata: { location: req.params.location }
      });
      res.status(500).json({ message: "Failed to fetch events by location" });
    }
  });

  // Get events by hashtag
  app.get("/api/events/hashtag/:hashtag", async (req: AuthenticatedRequest, res) => {
    try {
      const hashtag = decodeURIComponent(req.params.hashtag).trim().toLowerCase();
      
      // Get all public events only - private events must never appear in hashtag listings
      let events = (await storage.getEvents()).filter(event => !event.isPrivate);
      
      // Get featured events to check which events are boosted
      const featuredEvents = await storage.getActiveFeaturedEvents();
      const featuredEventIds = new Set(featuredEvents.map(fe => fe.eventId));
      
      // Filter out past events (only if more than 24 hours past)
      const now = new Date();
      const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      events = events.filter(event => {
        if (event.endDate) {
          try {
            const endDate = new Date(event.endDate);
            if (!isNaN(endDate.getTime())) {
              endDate.setHours(23, 59, 59, 999);
              return endDate >= twentyFourHoursAgo;
            }
          } catch {}
        } else if (event.date && event.time) {
          try {
            const [year, month, day] = event.date.split('-').map(Number);
            const [hours, minutes] = event.time.split(':').map(Number);
            const eventDateTime = new Date(year, month - 1, day, hours, minutes);
            
            // Include events that ended less than 24 hours ago
            return eventDateTime >= twentyFourHoursAgo;
          } catch {}
        }
        return true;
      });
      
      // Filter by hashtag
      const filteredEvents = events.filter(event => {
        // Double-check that event is not private (safety check)
        if (event.isPrivate) return false;
        
        // Check if event has this hashtag
        if (event.hashtags && Array.isArray(event.hashtags)) {
          return event.hashtags.some(tag => tag.toLowerCase() === hashtag.toLowerCase());
        }
        return false;
      });
      
      // Sort events: boosted events first (sorted by position), then regular events by date
      filteredEvents.sort((a, b) => {
        const aIsBoosted = featuredEventIds.has(a.id);
        const bIsBoosted = featuredEventIds.has(b.id);
        
        // If both are boosted, sort by position
        if (aIsBoosted && bIsBoosted) {
          const aFeatured = featuredEvents.find(fe => fe.eventId === a.id);
          const bFeatured = featuredEvents.find(fe => fe.eventId === b.id);
          return (aFeatured?.position || 999) - (bFeatured?.position || 999);
        }
        
        // Boosted events come first
        if (aIsBoosted && !bIsBoosted) return -1;
        if (!aIsBoosted && bIsBoosted) return 1;
        
        // Both regular events, sort by date
        const dateA = new Date(a.date).getTime();
        const dateB = new Date(b.date).getTime();
        return dateA - dateB;
      });
      
      // Add current price with surge pricing to each event
      const eventsWithPricing = await Promise.all(filteredEvents.map(async (event) => {
        const currentPrice = await storage.getCurrentPrice(event.id);
        return {
          ...event,
          currentPrice
        };
      }));
      
      res.json(eventsWithPricing);
    } catch (error) {
      await logError(error, "GET /api/events/hashtag/:hashtag", {
        request: req,
        metadata: { hashtag: req.params.hashtag }
      });
      res.status(500).json({ message: "Failed to fetch events by hashtag" });
    }
  });

  // Ticket routes
  // Ticket render route for NFT capture (must be before :ticketId route)
  app.get("/api/tickets/:ticketId/render", async (req, res, next) => {
    try {
      // Validate snapshot token if provided
      const snapshotToken = req.query.snapshot_token as string;
      const ticketId = req.params.ticketId;
      
      // Simple token validation (in production, use proper JWT or time-limited tokens)
      // For now, we'll accept a token that's the ticket ID hashed
      if (snapshotToken) {
        const crypto = await import('crypto');
        const expectedToken = crypto.createHash('sha256')
          .update(`${ticketId}-snapshot-${new Date().toISOString().split('T')[0]}`)
          .digest('hex')
          .substring(0, 16);
        
        // Allow the token or bypass for testing
        // In production, enforce this strictly
      }
      
      const ticketData = await storage.getTicket(ticketId);
      if (!ticketData) {
        return res.status(404).send("Ticket not found");
      }

      const event = await storage.getEvent(ticketData.eventId);
      if (!event) {
        return res.status(404).send("Event not found");
      }

      // Generate deterministic HTML for the ticket (fixed 512x768 size)
      // Use ticket ID as seed for deterministic positioning
      const seed = ticketData.ticket.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
      const random = (index: number) => {
        const x = Math.sin(seed + index) * 10000;
        return x - Math.floor(x);
      };
      
      const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <script>
    // Freeze time for deterministic rendering
    const FIXED_TIME = 1609459200000; // Fixed timestamp
    Date.now = () => FIXED_TIME;
    Date.prototype.getTime = () => FIXED_TIME;
    
    // Seed Math.random for deterministic behavior
    let seed = ${seed};
    Math.random = function() {
      const x = Math.sin(seed++) * 10000;
      return x - Math.floor(x);
    };
  </script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      width: 512px; 
      height: 768px; 
      overflow: hidden;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: white;
    }
    #ticket {
      width: 512px;
      height: 768px;
      position: relative;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .ticket-content {
      text-align: center;
      color: white;
      padding: 40px;
      backdrop-filter: blur(10px);
      background: rgba(255, 255, 255, 0.1);
      border-radius: 20px;
      border: 2px solid rgba(255, 255, 255, 0.3);
      z-index: 10;
    }
    .event-title {
      font-size: 36px;
      font-weight: bold;
      margin-bottom: 20px;
      text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
    }
    .ticket-id {
      font-size: 20px;
      opacity: 0.9;
      margin-bottom: 10px;
    }
    .validated-badge {
      display: inline-block;
      background: #10b981;
      padding: 8px 20px;
      border-radius: 50px;
      font-size: 16px;
      margin-top: 20px;
    }
    .sticker-overlay {
      position: absolute;
      animation: float 3s linear infinite;
      animation-play-state: running;
    }
    @keyframes float {
      0% { transform: translateY(0px) rotate(0deg); }
      25% { transform: translateY(-15px) rotate(5deg); }
      50% { transform: translateY(0px) rotate(0deg); }
      75% { transform: translateY(-15px) rotate(-5deg); }
      100% { transform: translateY(0px) rotate(0deg); }
    }
    .sticker-1 { 
      top: ${10 + random(1) * 20}%; 
      left: ${10 + random(2) * 20}%; 
      width: 100px; 
      height: 100px; 
      animation-delay: 0s; 
    }
    .sticker-2 { 
      top: ${15 + random(3) * 20}%; 
      right: ${15 + random(4) * 20}%; 
      width: 90px; 
      height: 90px; 
      animation-delay: 0.75s; 
    }
    .sticker-3 { 
      bottom: ${20 + random(5) * 20}%; 
      left: ${20 + random(6) * 20}%; 
      width: 95px; 
      height: 95px; 
      animation-delay: 1.5s; 
    }
    .sticker-4 { 
      bottom: ${10 + random(7) * 20}%; 
      right: ${10 + random(8) * 20}%; 
      width: 105px; 
      height: 105px; 
      animation-delay: 2.25s; 
    }
  </style>
</head>
<body>
  <div id="ticket">
    ${event.specialEffects && ticketData.ticket.stickerUrl ? `
      <img class="sticker-overlay sticker-1" src="${ticketData.ticket.stickerUrl}" alt="" crossorigin="anonymous">
      <img class="sticker-overlay sticker-2" src="${ticketData.ticket.stickerUrl}" alt="" crossorigin="anonymous">
      <img class="sticker-overlay sticker-3" src="${ticketData.ticket.stickerUrl}" alt="" crossorigin="anonymous">
      <img class="sticker-overlay sticker-4" src="${ticketData.ticket.stickerUrl}" alt="" crossorigin="anonymous">
    ` : ''}
    <div class="ticket-content">
      <div class="event-title">${event.name}</div>
      <div class="ticket-id">Ticket #${ticketData.ticket.ticketNumber || '001'}</div>
      ${ticketData.ticket.isValidated ? '<div class="validated-badge">✓ VALIDATED</div>' : ''}
    </div>
  </div>
</body>
</html>`;

      res.type('text/html').send(html);
    } catch (error: any) {
      next(error);
    }
  });

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
      
      const eventWithCreator = await storage.getEventWithCreator(ticket.eventId);
      if (!eventWithCreator) {
        return res.status(404).json({ message: "Event not found" });
      }
      
      // Check if creator is an admin (has @saymservices.com email)
      const isAdminCreated = eventWithCreator.creatorEmail?.endsWith("@saymservices.com") || false;
      
      // Remove creatorEmail from response for privacy
      const { creatorEmail, ...event } = eventWithCreator;
      
      res.json({ 
        ticket, 
        event: {
          ...event,
          isAdminCreated
        }
      });
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
      const { lat, lng } = req.body; // Get location data from ticket holder
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
      
      const session = await storage.createValidationSession(req.params.ticketId, lat, lng);
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

  // Capture/claim endpoint for idempotent media generation
  app.post("/api/tickets/:ticketId/capture/claim", async (req: AuthenticatedRequest, res) => {
    try {
      const ticketId = req.params.ticketId;
      const { idempotency_key } = req.body;
      
      // Get ticket details
      const ticket = await storage.getTicket(ticketId);
      if (!ticket) {
        return res.status(404).json({ message: "Ticket not found" });
      }
      
      // Check if already captured (idempotency)
      if (ticket.nftMediaUrl) {
        const mediaType = ticket.nftMediaType || 'video/mp4';
        const pngUrl = ticket.nftMediaUrl.replace(/\.(mp4|webm|gif)$/, '.png');
        
        return res.json({
          status: "already_captured",
          mp4_url: ticket.nftMediaUrl,
          png_url: pngUrl,
          media_type: mediaType
        });
      }
      
      // Enqueue capture job (in production, use a proper job queue)
      res.json({
        status: "enqueued",
        job_id: `job_${idempotency_key || Date.now()}`
      });
      
      // Trigger media generation in background
      // In production, this would be handled by a worker
      process.nextTick(async () => {
        try {
          const event = await storage.getEvent(ticket.eventId);
          if (!event) return;
          
          const captureService = getTicketCaptureService();
          const objectStorageService = new ObjectStorageService();
          
          // Generate MP4
          const mediaPath = await captureService.captureTicketAsVideo({
            ticket,
            event,
            format: 'mp4'
          });
          
          // Generate PNG preview (first frame)
          const pngPath = mediaPath.replace('.mp4', '-preview.png');
          const ffmpegPath = await getFFmpegPath();
          await new Promise((resolve, reject) => {
            execFile(ffmpegPath, [
              '-i', mediaPath,
              '-vframes', '1',
              '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2',
              pngPath
            ], (error) => {
              if (error) reject(error);
              else resolve(null);
            });
          });
          
          // Upload both files
          const mp4Buffer = fs.readFileSync(mediaPath);
          const pngBuffer = fs.readFileSync(pngPath);
          
          const mp4UploadURL = await objectStorageService.getObjectEntityUploadURL();
          const pngUploadURL = await objectStorageService.getObjectEntityUploadURL();
          
          await fetch(mp4UploadURL, {
            method: 'PUT',
            body: mp4Buffer,
            headers: { 'Content-Type': 'video/mp4' }
          });
          
          await fetch(pngUploadURL, {
            method: 'PUT', 
            body: pngBuffer,
            headers: { 'Content-Type': 'image/png' }
          });
          
          // Get public URLs
          const mp4PublicUrl = `/public-objects/uploads/${mp4UploadURL.split('/').pop()?.split('?')[0]}`;
          const pngPublicUrl = `/public-objects/uploads/${pngUploadURL.split('/').pop()?.split('?')[0]}`;
          
          // Update ticket
          await storage.updateTicketNftMediaUrl(ticketId, mp4PublicUrl);
          
          // Clean up temp files
          fs.unlinkSync(mediaPath);
          fs.unlinkSync(pngPath);
        } catch (error) {
          console.error('Background capture failed:', error);
        }
      });
    } catch (error) {
      console.error('Capture claim error:', error);
      res.status(500).json({ message: "Failed to process capture claim" });
    }
  });

  // Generate NFT media for minting (called when user views ticket after validation)
  app.post("/api/tickets/:ticketId/generate-nft-media", async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user?.id || null;
      const ticket = await storage.getTicket(req.params.ticketId);
      
      if (!ticket) {
        return res.status(404).json({ message: "Ticket not found" });
      }
      
      // Check if user owns the ticket
      if (ticket.userId && ticket.userId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      // Check if ticket is validated
      if (!ticket.isValidated) {
        return res.status(400).json({ message: "Ticket must be validated before generating NFT media" });
      }
      
      // Check if media already exists (idempotency)
      if (ticket.nftMediaUrl) {
        console.log(`Media already exists for ticket ${ticket.id}, returning cached URL`);
        return res.json({ 
          mediaUrl: ticket.nftMediaUrl, 
          mediaType: ticket.nftMediaType || 'video/mp4',
          cached: true 
        });
      }
      
      // Get event details
      const event = await storage.getEvent(ticket.eventId);
      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }
      
      // Check if event allows NFT minting
      if (!event.allowMinting) {
        return res.status(400).json({ message: "NFT minting is not enabled for this event" });
      }
      
      // Client handles media generation and upload directly
      // This endpoint now just returns success for compatibility
      console.log('Client-side media generation - skipping server-side processing');
      
      res.json({ 
        mediaUrl: null,
        mediaType: 'text/html',
        cached: false,
        message: 'Client will handle media generation'
      });
    } catch (error) {
      await logError(error, "POST /api/tickets/:ticketId/generate-nft-media", {
        request: req,
        metadata: { ticketId: req.params.ticketId }
      });
      res.status(500).json({ message: "Failed to generate NFT media" });
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
      
      // Get featured events to check which events are boosted
      const featuredEvents = await storage.getActiveFeaturedEvents();
      const featuredEventIds = new Set(featuredEvents.map(fe => fe.eventId));
      

      
      // Filter out past events (only if more than 24 hours past) and sort by date (soonest first)
      const now = new Date();
      const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const activeEvents = publicEvents.filter(event => {
        try {
          // Parse date and time separately to handle properly
          const [year, month, day] = event.date.split('-').map(Number);
          const [hours, minutes] = event.time.split(':').map(Number);
          const eventDateTime = new Date(year, month - 1, day, hours, minutes);
          
          // Include events that haven't started yet OR ended less than 24 hours ago
          return eventDateTime > twentyFourHoursAgo;
        } catch (error) {
          // If date parsing fails, include the event to be safe
          return true;
        }
      });
      
      // Sort events: boosted events first (sorted by position), then by date/time with 24-hour prioritization
      const sortedEvents = activeEvents.sort((a, b) => {
        const aIsBoosted = featuredEventIds.has(a.id);
        const bIsBoosted = featuredEventIds.has(b.id);
        
        // If both are boosted, sort by position
        if (aIsBoosted && bIsBoosted) {
          const aFeatured = featuredEvents.find(fe => fe.eventId === a.id);
          const bFeatured = featuredEvents.find(fe => fe.eventId === b.id);
          return (aFeatured?.position || 999) - (bFeatured?.position || 999);
        }
        
        // Boosted events come first
        if (aIsBoosted && !bIsBoosted) return -1;
        if (!aIsBoosted && bIsBoosted) return 1;
        
        // Both are regular events, apply normal sorting logic
        try {
          // Parse dates properly
          const [yearA, monthA, dayA] = a.date.split('-').map(Number);
          const [hoursA, minutesA] = a.time.split(':').map(Number);
          const dateTimeA = new Date(yearA, monthA - 1, dayA, hoursA, minutesA);
          
          const [yearB, monthB, dayB] = b.date.split('-').map(Number);
          const [hoursB, minutesB] = b.time.split(':').map(Number);
          const dateTimeB = new Date(yearB, monthB - 1, dayB, hoursB, minutesB);
          
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
      
      // Add current price with surge pricing to each event
      const eventsWithPricing = await Promise.all(sortedEvents.map(async (event) => {
        const currentPrice = await storage.getCurrentPrice(event.id);
        return {
          ...event,
          currentPrice
        };
      }));
      
      res.json(eventsWithPricing);
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
      
      // Check if event is private and user is not authenticated
      if (eventWithCreator.isPrivate) {
        // Extract user ID from request (will be null if not authenticated)
        const userId = extractUserId(req as AuthenticatedRequest);
        
        // If user is not authenticated, return 401
        if (!userId) {
          return res.status(401).json({ message: "Authentication required to view this private event" });
        }
        
        // If user is authenticated, they can view the private event
        // The purpose of private events is just to hide them from public listings
        // Anyone with the link who is logged in can view it
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
    const userEmail = req.user?.email;
    
    try {
      // Check if user is an admin (has @saymservices.com email)
      const isAdminCreated = userEmail?.endsWith("@saymservices.com") || false;
      
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
      
      // Extract hashtags from description
      const hashtags: string[] = [];
      if (createData.description) {
        // Strip HTML tags first
        const textContent = createData.description.replace(/<[^>]*>/g, ' ');
        // Find all hashtags (words starting with #)
        const matches = textContent.match(/#[a-zA-Z0-9_]+/g);
        if (matches) {
          // Remove the # and store unique hashtags
          const uniqueTags = Array.from(new Set(matches.map((tag: string) => tag.substring(1).toLowerCase())));
          hashtags.push(...uniqueTags as string[]);
        }
      }
      
      // Body is already validated by middleware
      const event = await storage.createEvent({
        ...createData,
        hashtags,
        isAdminCreated, // Set the isAdminCreated flag based on user's email
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
      
      // Check if user owns the event or is an admin
      const event = await storage.getEvent(req.params.id);
      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }
      
      // Check if user is admin (has @saymservices.com email)
      const isAdmin = req.user?.email?.endsWith("@saymservices.com");
      
      // Allow editing if user owns the event OR is an admin
      if (event.userId !== userId && !isAdmin) {
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
        description: z.string().nullable().optional(),
        contactDetails: z.string().nullable().optional(),
        venue: z.string().optional(),
        country: z.string().optional(),
        date: z.string().optional(),
        time: z.string().optional(),
        endDate: z.string().nullable().optional(),
        endTime: z.string().nullable().optional(),
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
      
      // Extract hashtags from description if it's being updated
      let hashtags: string[] | undefined;
      if (validatedData.description !== undefined) {
        hashtags = [];
        if (validatedData.description) {
          // Strip HTML tags first
          const textContent = validatedData.description.replace(/<[^>]*>/g, ' ');
          // Find all hashtags (words starting with #)
          const matches = textContent.match(/#[a-zA-Z0-9_]+/g);
          if (matches) {
            // Remove the # and store unique hashtags
            const uniqueTags = Array.from(new Set(matches.map((tag: string) => tag.substring(1).toLowerCase())));
            hashtags.push(...uniqueTags);
          }
        }
      }
      
      const updatedEvent = await storage.updateEvent(req.params.id, {
        ...validatedData,
        ...(hashtags !== undefined && { hashtags })
      });
      
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
      } else if (event.date && event.time) {
        // No end date, check if event has started (for single-day events)
        // Allow purchasing tickets up until 24 hours after the event starts
        // This accounts for timezone differences and multi-day events
        try {
          const [year, month, day] = event.date.split('-').map(Number);
          const [hours, minutes] = event.time.split(':').map(Number);
          const eventDateTime = new Date(year, month - 1, day, hours, minutes);
          
          // Allow purchasing tickets up until 24 hours after the event starts
          const twentyFourHoursAfterEvent = new Date(eventDateTime.getTime() + 24 * 60 * 60 * 1000);
          
          if (!isNaN(eventDateTime.getTime()) && now > twentyFourHoursAfterEvent) {
            return res.status(400).json({ 
              message: "Cannot purchase tickets for past events. This event started more than 24 hours ago." 
            });
          }
        } catch {
          // If date parsing fails, allow the purchase
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
        // Note: Currency transaction is handled within processResellPurchase
        await logInfo(
          "Returned ticket purchased",
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
      
      // Note: Getting tickets for events is FREE - no currency check needed
      // The ticketPrice field is kept for display/sorting purposes only
      
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
      
      // Getting tickets is FREE - no currency transaction needed
      
      res.status(201).json(ticket);
    } catch (error) {
      await logError(error, "POST /api/events/:eventId/tickets", {
        request: req,
        metadata: { eventId: req.params.eventId }
      });
      res.status(500).json({ message: "Failed to create ticket" });
    }
  });

  // Charge ticket endpoint (requires 3 tickets to charge one)
  app.post("/api/tickets/:ticketId/charge", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { ticketId } = req.params;
      
      // Attempt to charge the ticket
      const success = await storage.chargeTicket(ticketId, userId);
      
      if (!success) {
        return res.status(400).json({ 
          message: "Cannot charge this ticket. You need at least 3 tickets for this event, and the event must have special effects and stickers enabled." 
        });
      }

      res.json({ 
        success: true,
        message: "Ticket charged successfully! Special effects odds have been improved."
      });
    } catch (error) {
      await logError(error, "POST /api/tickets/:ticketId/charge", {
        request: req,
        metadata: { ticketId: req.params.ticketId }
      });
      res.status(500).json({ message: "Failed to charge ticket" });
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
        return res.status(403).json({ message: "You can only return your own tickets" });
      }

      // Check if ticket has been validated
      if (ticket.isValidated) {
        return res.status(400).json({ message: "Cannot return a validated ticket" });
      }

      // Check if already for resale
      if (ticket.resellStatus === "for_resale") {
        return res.status(400).json({ message: "Ticket is already returned" });
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
          message: "Returns are only available until 1 hour before the event starts" 
        });
      }

      // Process the resell listing
      const listed = await storage.resellTicket(ticketId, userId);
      
      if (!listed) {
        return res.status(500).json({ message: "Failed to return ticket" });
      }

      // Create a notification for the user
      await storage.createNotification({
        userId,
        type: "success",
        title: "Ticket Returned",
        description: `Your ticket has been returned and is now available for others.`,
        metadata: JSON.stringify({
          ticketId,
          eventId: ticket.eventId,
          eventName: event.name,
          ticketNumber: ticket.ticketNumber
        })
      });

      // Log the resell listing
      await logInfo(
        "Ticket returned",
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
        message: "Ticket returned successfully",
        resold: true
      });
    } catch (error) {
      await logError(error, "POST /api/tickets/:ticketId/resell", {
        request: req,
        metadata: { ticketId: req.params.ticketId }
      });
      res.status(500).json({ message: "Failed to return ticket" });
    }
  });

  // Helper function to calculate distance between two GPS coordinates in meters
  function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371000; // Earth's radius in meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c; // Distance in meters
  }

  // Validation routes
  app.post("/api/validate", validationRateLimiter, async (req: AuthenticatedRequest, res) => {
    try {
      const { qrData, validatorLat, validatorLng, ticketHolderLat, ticketHolderLng } = req.body;
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
        
        // Check geofence if enabled
        if (event.geofence && event.latitude && event.longitude) {
          // Use ticket holder location from session if not provided directly
          const finalTicketHolderLat = ticketHolderLat || tokenCheck.ticketHolderLat;
          const finalTicketHolderLng = ticketHolderLng || tokenCheck.ticketHolderLng;
          
          // Check if location data was provided
          if (!validatorLat || !validatorLng || !finalTicketHolderLat || !finalTicketHolderLng) {
            return res.status(400).json({
              message: "Location required for this event",
              valid: false,
              requiresLocation: true,
              event
            });
          }
          
          // Check validator's distance from event
          const validatorDistance = calculateDistance(
            Number(event.latitude),
            Number(event.longitude),
            validatorLat,
            validatorLng
          );
          
          // Check ticket holder's distance from event (using location from session or provided)
          const ticketHolderDistance = calculateDistance(
            Number(event.latitude),
            Number(event.longitude),
            finalTicketHolderLat,
            finalTicketHolderLng
          );
          
          // Log the validation distances
          console.log(`[GEOFENCE] Validation attempt for ${event.name}:`);
          console.log(`  Event location: ${event.latitude}, ${event.longitude}`);
          console.log(`  Ticket holder: ${finalTicketHolderLat}, ${finalTicketHolderLng} (${Math.round(ticketHolderDistance)}m away)`);
          console.log(`  Validator: ${validatorLat}, ${validatorLng} (${Math.round(validatorDistance)}m away)`);
          
          // Both must be within 300 meters
          if (validatorDistance > 300 || ticketHolderDistance > 300) {
            return res.status(400).json({
              message: `Must be within 300 meters of venue to validate. Validator: ${Math.round(validatorDistance)}m away, Ticket holder: ${Math.round(ticketHolderDistance)}m away`,
              valid: false,
              outsideGeofence: true,
              validatorDistance: Math.round(validatorDistance),
              ticketHolderDistance: Math.round(ticketHolderDistance),
              event
            });
          }
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
          const validation = await storage.validateDynamicToken(qrData, userId || "");
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
      
      // Check geofence if enabled
      if (event.geofence && event.latitude && event.longitude) {
        // Check if location data was provided
        if (!validatorLat || !validatorLng || !ticketHolderLat || !ticketHolderLng) {
          return res.status(400).json({
            message: "Location required for this event",
            valid: false,
            requiresLocation: true,
            event
          });
        }
        
        // Check validator's distance from event
        const validatorDistance = calculateDistance(
          Number(event.latitude),
          Number(event.longitude),
          validatorLat,
          validatorLng
        );
        
        // Check ticket holder's distance from event
        const ticketHolderDistance = calculateDistance(
          Number(event.latitude),
          Number(event.longitude),
          ticketHolderLat,
          ticketHolderLng
        );
        
        // Both must be within 690 meters
        if (validatorDistance > 690 || ticketHolderDistance > 690) {
          return res.status(400).json({
            message: `Must be within 690 meters of venue to validate. Validator: ${Math.round(validatorDistance)}m away, Ticket holder: ${Math.round(ticketHolderDistance)}m away`,
            valid: false,
            outsideGeofence: true,
            validatorDistance: Math.round(validatorDistance),
            ticketHolderDistance: Math.round(ticketHolderDistance),
            event
          });
        }
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

  // P2P Validation route for voting
  app.post("/api/validate/p2p", requireAuth, validationRateLimiter, async (req: AuthenticatedRequest, res) => {
    try {
      const { validationCode, eventId } = req.body;
      if (!validationCode) {
        return res.status(400).json({ message: "Validation code is required" });
      }

      const userId = req.user?.id;
      const userEmail = req.user?.email;
      if (!userId || !userEmail) {
        return res.status(401).json({ message: "Authentication required for P2P validation" });
      }

      // Get the ticket by validation code
      const ticket = await storage.getTicketByValidationCode(validationCode.toUpperCase());
      if (!ticket) {
        return res.status(404).json({ 
          message: "Invalid validation code", 
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

      // Check if event has P2P validation enabled (voting)
      if (!event.p2pValidation && !event.enableVoting) {
        return res.status(403).json({ 
          message: "P2P validation not enabled for this event", 
          valid: false 
        });
      }

      // Check if the validator has a ticket for this event
      const validatorTickets = await storage.getTicketsByEventAndUser(event.id, userId);
      const validatorHasTicket = validatorTickets.some(t => t.isValidated);
      
      if (!validatorHasTicket) {
        return res.status(403).json({ 
          message: "You need a validated ticket for this event to use P2P validation", 
          valid: false 
        });
      }

      // Don't allow self-validation
      if (ticket.userId === userId) {
        return res.status(400).json({ 
          message: event.enableVoting ? "You cannot vote for your own ticket" : "You cannot validate your own ticket", 
          valid: false 
        });
      }

      // Check if ticket hasn't been validated yet
      if (!ticket.isValidated) {
        return res.status(400).json({ 
          message: "This ticket needs to be validated first before it can receive votes", 
          valid: false 
        });
      }

      // Check if ticket has already been validated by this user
      // (We could track this more specifically if needed)
      
      // Submit the vote (this will increment voteCount for voting-enabled events)
      const validatedTicket = await storage.validateTicket(ticket.id, undefined, userId);
      
      return res.json({ 
        message: event.enableVoting ? "Vote recorded successfully!" : "Ticket validated successfully", 
        valid: true,
        canValidate: true,
        ticket: validatedTicket,
        event 
      });
    } catch (error) {
      await logError(error, "POST /api/validate/p2p", {
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

  // Public analytics dashboard API
  app.get("/api/analytics/dashboard", async (req, res) => {
    try {
      const now = new Date();
      
      // Get basic stats
      const basicStats = await storage.getEventStats();
      
      // Get events by status
      const allEvents = await storage.getEvents();
      const upcomingEvents = allEvents.filter(e => new Date(e.date) > now);
      const pastEvents = allEvents.filter(e => new Date(e.date) <= now);
      const activeEvents = upcomingEvents.filter(e => {
        const eventDate = new Date(e.date);
        const hoursUntilEvent = (eventDate.getTime() - now.getTime()) / (1000 * 60 * 60);
        return hoursUntilEvent <= 24;
      });
      
      // Get all tickets for analysis
      const allTickets = await storage.getTickets();
      
      // Calculate ticket sales by month
      const ticketsByMonth: Record<string, number> = {};
      allTickets.forEach(ticket => {
        if (ticket.createdAt) {
          const month = new Date(ticket.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
          ticketsByMonth[month] = (ticketsByMonth[month] || 0) + 1;
        }
      });
      
      // Get last 6 months of data
      const monthLabels: string[] = [];
      const monthData: number[] = [];
      for (let i = 5; i >= 0; i--) {
        const date = new Date();
        date.setMonth(date.getMonth() - i);
        const monthKey = date.toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
        monthLabels.push(monthKey);
        monthData.push(ticketsByMonth[monthKey] || 0);
      }
      
      // Calculate events by country
      const eventsByCountry: Record<string, number> = {};
      allEvents.forEach(event => {
        const country = event.country || 'Unknown';
        eventsByCountry[country] = (eventsByCountry[country] || 0) + 1;
      });
      
      // Get top countries
      const topCountries = Object.entries(eventsByCountry)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([country, count]) => ({ country, count }));
      
      // Calculate ticket validation rate
      const validationRate = allTickets.length > 0 
        ? Math.round((allTickets.filter(t => t.isValidated).length / allTickets.length) * 100)
        : 0;
      
      // Get featured events count
      const featuredEvents = await storage.getActiveFeaturedEvents();
      
      // Get resale queue stats
      const resaleTickets = allTickets.filter(t => t.resellStatus === 'for_resale');
      
      // Calculate average ticket price
      const ticketsWithPrice = allTickets.filter(t => t.purchasePrice);
      const avgTicketPrice = ticketsWithPrice.length > 0
        ? ticketsWithPrice.reduce((sum, t) => sum + parseFloat(t.purchasePrice!), 0) / ticketsWithPrice.length
        : 0;
      
      // Get events by type/hashtag analysis
      const eventTypes: Record<string, number> = {};
      allEvents.forEach(event => {
        if (event.hashtags && Array.isArray(event.hashtags)) {
          event.hashtags.forEach(tag => {
            eventTypes[tag] = (eventTypes[tag] || 0) + 1;
          });
        }
      });
      
      const topEventTypes = Object.entries(eventTypes)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([type, count]) => ({ type, count }));
      
      // Get user growth (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const allUsers = await storage.getAllUsers();
      const newUsers = allUsers.filter(u => u.createdAt && new Date(u.createdAt) > thirtyDaysAgo);
      
      // Calculate daily active events
      const todayEvents = upcomingEvents.filter(e => {
        const eventDate = new Date(e.date);
        return eventDate.toDateString() === now.toDateString();
      });
      
      res.json({
        overview: {
          totalEvents: basicStats.totalEvents,
          totalTickets: basicStats.totalTickets,
          validatedTickets: basicStats.validatedTickets,
          totalUsers: allUsers.length,
          upcomingEvents: upcomingEvents.length,
          pastEvents: pastEvents.length,
          activeEventsNext24h: activeEvents.length,
          todayEvents: todayEvents.length
        },
        ticketMetrics: {
          validationRate,
          avgTicketPrice: Math.round(avgTicketPrice * 100) / 100,
          resaleTickets: resaleTickets.length,
          goldenTickets: allTickets.filter(t => t.isGoldenTicket).length
        },
        eventMetrics: {
          featuredEvents: featuredEvents.length,
          recurringEvents: allEvents.filter(e => e.recurringType).length,
          privateEvents: allEvents.filter(e => e.isPrivate).length,
          p2pValidationEvents: allEvents.filter(e => e.p2pValidation).length
        },
        userMetrics: {
          newUsersLast30Days: newUsers.length,
          avgTicketsPerUser: allUsers.length > 0 ? Math.round((allTickets.length / allUsers.length) * 10) / 10 : 0
        },
        charts: {
          ticketsByMonth: {
            labels: monthLabels,
            data: monthData
          },
          topCountries,
          topEventTypes
        }
      });
    } catch (error) {
      await logError(error, "GET /api/analytics/dashboard", {
        request: req
      });
      res.status(500).json({ message: "Failed to fetch analytics" });
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

  // Public endpoint to check if event has validated tickets
  app.get("/api/events/:eventId/validated-tickets/count", async (req, res) => {
    try {
      const validatedTickets = await storage.getValidatedTicketsForEvent(req.params.eventId);
      res.json({ count: validatedTickets.length });
    } catch (error) {
      await logError(error, "GET /api/events/:eventId/validated-tickets/count", {
        request: req,
        metadata: { eventId: req.params.eventId }
      });
      res.status(500).json({ message: "Failed to check validated tickets" });
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
        return res.status(400).json({ message: "Ticket cannot be minted. Make sure it has been validated and the event allows NFT minting." });
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

      // Parse metadata to extract imageUrl
      const parsedMetadata = JSON.parse(metadata || "{}");
      const imageUrl = parsedMetadata.imageUrl;
      
      // Remove imageUrl from metadata before storing
      const { imageUrl: _, ...cleanMetadata } = parsedMetadata;
      
      // Get user details for preservation
      const creator = await storage.getUser(event.userId || userId);
      const owner = await storage.getUser(userId);
      
      // Create registry record with COMPLETE data preservation
      const registryRecord = await storage.createRegistryRecord({
        ticketId,
        eventId: ticket.eventId,
        ownerId: userId,
        creatorId: event.userId || userId,
        title: title || `${event.name} - Ticket #${ticket.ticketNumber}`,
        description: description || `NFT for ${event.name} at ${event.venue} on ${event.date}`,
        metadata: JSON.stringify({
          ...cleanMetadata,
          originalTicket: {
            ticketNumber: ticket.ticketNumber,
            qrData: ticket.qrData,
            validatedAt: ticket.validatedAt,
            useCount: ticket.useCount
          }
        }),
        imageUrl: imageUrl || null,
        
        // Complete ticket data preservation
        ticketNumber: ticket.ticketNumber,
        ticketStatus: ticket.status || "validated",
        ticketValidatedAt: ticket.validatedAt || null,
        ticketValidatedBy: ticket.validatedBy || null,
        ticketCreatedAt: ticket.createdAt || new Date(),
        ticketRecipientName: ticket.recipientName,
        ticketRecipientEmail: ticket.recipientEmail,
        ticketSeatNumber: ticket.seatNumber || null,
        ticketType: ticket.ticketType || null,
        ticketTransferable: ticket.transferable || false,
        ticketUsageCount: ticket.useCount || 0,
        ticketMaxUses: ticket.maxUses || 1,
        ticketIsGolden: ticket.isGolden || false,
        ticketNftMediaUrl: ticket.nftMediaUrl || null,
        ticketQrCode: ticket.qrData,
        
        // Complete event data preservation
        eventName: event.name,
        eventDescription: event.description || "",
        eventVenue: event.venue,
        eventDate: event.date,
        eventTime: event.time,
        eventEndDate: event.endDate || null,
        eventEndTime: event.endTime || null,
        eventImageUrl: event.imageUrl || null,
        eventMaxTickets: event.maxTickets || null,
        eventTicketsSold: event.ticketsSold || 0,
        eventTicketPrice: event.ticketPrice || null,
        eventEventTypes: event.eventTypes || [],
        eventReentryType: event.reentryType || "No Reentry (Single Use)",
        eventGoldenTicketEnabled: event.goldenTicketEnabled || false,
        eventGoldenTicketCount: event.goldenTicketCount || null,
        eventAllowMinting: event.allowMinting || false,
        eventIsPrivate: event.isPrivate || false,
        eventOneTicketPerUser: event.oneTicketPerUser || false,
        eventSurgePricing: event.surgePricing || false,
        eventP2pValidation: event.p2pValidation || false,
        eventEnableVoting: event.enableVoting || false,
        eventRecurringType: event.recurringType || null,
        eventRecurringEndDate: event.recurringEndDate || null,
        eventCreatedAt: event.createdAt || new Date(),
        
        // User data preservation
        creatorUsername: creator?.username || "unknown",
        creatorDisplayName: creator?.displayName || null,
        ownerUsername: owner?.username || "unknown",
        ownerDisplayName: owner?.displayName || null,
        
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

      // Allow minting immediately after validation
      res.json({
        canMint: true,
        alreadyMinted: false,
        validatedAt: ticket.validatedAt,
        timeRemaining: 0,
        timeRemainingHours: 0
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

  // Public registry endpoints - no auth required
  app.get("/api/registry", async (req: AuthenticatedRequest, res) => {
    try {
      const registryRecords = await storage.getAllRegistryRecords();
      res.json(registryRecords);
    } catch (error) {
      await logError(error, "GET /api/registry", {
        request: req
      });
      res.status(500).json({ message: "Failed to fetch registry records" });
    }
  });

  app.get("/api/registry/:id", async (req: AuthenticatedRequest, res) => {
    try {
      const { id } = req.params;
      const registryRecord = await storage.getRegistryRecord(id);
      
      if (!registryRecord) {
        return res.status(404).json({ message: "Registry record not found" });
      }
      
      res.json(registryRecord);
    } catch (error) {
      await logError(error, "GET /api/registry/:id", {
        request: req
      });
      res.status(500).json({ message: "Failed to fetch registry record" });
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
      
      // Add isAdminCreated field and current price to each event
      const featuredEventsWithAdmin = await Promise.all(featuredEvents.map(async (featuredEvent) => {
        const eventWithCreator = await storage.getEventWithCreator(featuredEvent.event.id);
        const isAdminCreated = eventWithCreator?.creatorEmail?.endsWith("@saymservices.com") || false;
        
        // Get current price with surge pricing
        const currentPrice = await storage.getCurrentPrice(featuredEvent.event.id);
        
        return {
          ...featuredEvent,
          event: {
            ...featuredEvent.event,
            isAdminCreated,
            currentPrice
          }
        };
      }));
      
      // Featured events should ALWAYS show regardless of location preferences
      
      res.json(featuredEventsWithAdmin);
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
      const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      
      const isEventNotPast = (event: any) => {
        // Check if event has an end date
        if (event.endDate) {
          try {
            const endDate = new Date(event.endDate);
            if (!isNaN(endDate.getTime())) {
              // Set end date to end of day for comparison
              endDate.setHours(23, 59, 59, 999);
              // Keep event if it ended less than 24 hours ago
              return endDate >= twentyFourHoursAgo;
            }
          } catch {
            // If date parsing fails, keep the event
          }
        } else if (event.date && event.time) {
          // No end date, single day event - check if it started less than 24 hours ago
          try {
            const eventDateTime = new Date(`${event.date}T${event.time}:00`);
            if (!isNaN(eventDateTime.getTime())) {
              // Add 24 hours to the event start time for single-day events
              const eventEndTime = new Date(eventDateTime.getTime() + 24 * 60 * 60 * 1000);
              return eventEndTime >= now;
            }
          } catch {
            // If date parsing fails, keep the event
          }
        } else if (event.date) {
          // Just date, no time - assume end of day
          try {
            const eventDate = new Date(event.date);
            if (!isNaN(eventDate.getTime())) {
              eventDate.setHours(23, 59, 59, 999);
              // Add 24 hours buffer for single-day events
              const bufferTime = new Date(eventDate.getTime() + 24 * 60 * 60 * 1000);
              return bufferTime >= now;
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
      
      // Get total available events (boosted + regular)
      const featuredEventIds = new Set(featuredEvents.map(fe => fe.event.id));
      const availableRegularEvents = allEvents.filter(event => !featuredEventIds.has(event.id));
      const totalAvailableEvents = featuredEvents.length + availableRegularEvents.length;
      
      let gridEvents = [];
      
      // Determine how many events to show based on availability
      if (totalAvailableEvents < 6) {
        // Less than 6 events available - show up to 3 in a single row
        const eventsToShow = Math.min(totalAvailableEvents, 3);
        
        // Add boosted events first (up to 3)
        if (featuredEvents.length > 0) {
          gridEvents.push(...featuredEvents.slice(0, Math.min(3, featuredEvents.length)));
        }
        
        // Fill remaining slots with regular events if needed
        const slotsRemaining = eventsToShow - gridEvents.length;
        if (slotsRemaining > 0 && availableRegularEvents.length > 0) {
          const randomEvents = availableRegularEvents
            .sort(() => Math.random() - 0.5)
            .slice(0, slotsRemaining)
            .map(event => ({
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
      } else {
        // 6 or more events available - show 6 events (2 rows)
        
        // If we have 6+ featured events, just use the first 6 featured events
        if (featuredEvents.length >= 6) {
          gridEvents = featuredEvents.slice(0, 6);
        } else {
          // First row (3 slots) - prioritize boosted events
          const firstRowBoosted = featuredEvents.slice(0, 3);
          gridEvents.push(...firstRowBoosted);
          
          // Calculate remaining slots
          const firstRowFilled = gridEvents.length;
          const firstRowRemaining = 3 - firstRowFilled;
          
          // Fill first row with regular events if not enough boosted
          if (firstRowRemaining > 0) {
            const fillerEvents = availableRegularEvents
              .sort(() => Math.random() - 0.5)
              .slice(0, firstRowRemaining)
              .map(event => ({
                id: `random-${event.id}`,
                event,
                isPaid: false,
                isBumped: false,
                duration: '',
                startTime: new Date(),
                endTime: new Date(),
                position: 0
              }));
            gridEvents.push(...fillerEvents);
          }
          
          // Second row (3 slots) - use remaining boosted events or regular events
          const remainingBoosted = featuredEvents.slice(3);
          const secondRowBoosted = remainingBoosted.slice(0, 3);
          gridEvents.push(...secondRowBoosted);
          
          // Fill second row with regular events
          const totalSlotsNeeded = 6;
          const slotsToFill = totalSlotsNeeded - gridEvents.length;
          
          if (slotsToFill > 0) {
            // Get regular events not already used
            const usedEventIds = new Set(gridEvents.map(ge => ge.event.id));
            const unusedRegularEvents = availableRegularEvents.filter(e => !usedEventIds.has(e.id));
            
            const fillerEvents = unusedRegularEvents
              .sort(() => Math.random() - 0.5)
              .slice(0, slotsToFill)
              .map(event => ({
                id: `random-${event.id}`,
                event,
                isPaid: false,
                isBumped: false,
                duration: '',
                startTime: new Date(),
                endTime: new Date(),
                position: 0
              }));
            gridEvents.push(...fillerEvents);
          }
        }
      }
      
      // Add current price with surge pricing to each event
      const gridEventsWithPricing = await Promise.all(gridEvents.map(async (gridEvent) => {
        const currentPrice = await storage.getCurrentPrice(gridEvent.event.id);
        return {
          ...gridEvent,
          event: {
            ...gridEvent.event,
            currentPrice
          }
        };
      }));
      
      res.json(gridEventsWithPricing);
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

      // Check if user can boost this event (owner or ticket holder)
      const canUserBoost = await storage.canUserBoostEvent(userId, id);
      if (!canUserBoost) {
        return res.status(403).json({ message: "You can only boost events you own or have a ticket for" });
      }

      const event = await storage.getEvent(id);
      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }

      // Check if event can be boosted
      const canBoost = await storage.canBoostEvent(id);
      const featuredCount = await storage.getFeaturedEventCount();
      const nextPosition = await storage.getNextAvailablePosition();
      
      // Duration-based pricing: 2 Tickets per hour for standard, 4 Tickets per hour for bump
      const standardHourlyRate = 2;
      const bumpHourlyRate = 4;

      res.json({
        canBoost,
        currentFeaturedCount: featuredCount,
        maxSlots: 100,
        nextPosition,
        standardHourlyRate: standardHourlyRate.toString(),
        bumpHourlyRate: bumpHourlyRate.toString(),
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

      // Check if user can boost this event (owner or ticket holder)
      const canUserBoost = await storage.canUserBoostEvent(userId, id);
      if (!canUserBoost) {
        return res.status(403).json({ message: "You can only boost events you own or have a ticket for" });
      }

      const event = await storage.getEvent(id);
      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }

      // Check if event can be boosted
      const canBoost = await storage.canBoostEvent(id);
      if (!canBoost) {
        return res.status(400).json({ message: "Event is already featured" });
      }

      const featuredCount = await storage.getFeaturedEventCount();
      
      // Calculate duration-based pricing in Tickets
      const standardHourlyRate = 2;
      const bumpHourlyRate = 4;
      
      const durationHours = {
        "1hour": 1,
        "6hours": 6,
        "12hours": 12,
        "24hours": 24
      }[duration as "1hour" | "6hours" | "12hours" | "24hours"];

      let price = standardHourlyRate * durationHours;

      // Handle bump-in scenario
      if (isBump) {
        // Check if bump is actually needed
        if (featuredCount < 100) {
          return res.status(400).json({ message: "Bump not needed, slots available" });
        }
        price = bumpHourlyRate * durationHours;
      } else if (featuredCount >= 100) {
        // All slots taken and not bumping
        return res.status(400).json({ message: "All featured slots are taken" });
      }

      // Shift all existing featured events down by 1 position
      // This ensures newest boosts always appear at the top
      await storage.shiftFeaturedPositionsDown();
      
      // New boost always gets position 1 (top of the list)
      const position = 1;

      // Apply discounts for longer durations
      if (duration === "12hours") {
        price = Math.floor(price * 0.9); // 10% discount
      } else if (duration === "24hours") {
        price = Math.floor(price * 0.8); // 20% discount
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

      // Check user's Ticket balance
      const userBalance = await storage.getUserBalance(userId);
      if (!userBalance) {
        return res.status(400).json({ message: "Failed to fetch user balance" });
      }
      const availableBalance = parseFloat(userBalance.availableBalance);
      
      if (availableBalance < price) {
        return res.status(400).json({ message: `Insufficient Tickets. You need ${price} Tickets but only have ${Math.floor(availableBalance)} Tickets` });
      }
      
      // Debit user's Ticket balance
      const debitSuccess = await storage.debitUserAccount(
        userId,
        price,
        `Event boost: ${duration} ${isBump ? '(Bump)' : '(Standard)'}`,
        { eventId: id, duration, boostType: isBump ? 'bump' : 'standard' }
      );
      
      if (!debitSuccess) {
        return res.status(500).json({ message: "Failed to deduct Tickets" });
      }
      
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
        price: price.toString(),
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

        // Credit user with 1 ticket for rating the event
        await storage.creditUserAccount(
          userId,
          1,
          `Event rating reward for ${event.name}`,
          { 
            type: 'rating_reward',
            eventId: ticket.eventId,
            ticketId: ticketId
          }
        );

        res.json({ success: true, rating: eventRating, updated: false, rewardCredited: true });
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
  
  app.get("/api/users/:userId", async (req, res) => {
    try {
      const { userId } = req.params;
      
      const user = await storage.getUserById(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Return only public information
      res.json({
        id: user.id,
        displayName: user.displayName || 'Anonymous',
        type: 'legacy' // All users are legacy type for now
      });
    } catch (error) {
      await logError(error, "GET /api/users/:userId", {
        request: req
      });
      res.status(500).json({ message: "Failed to fetch user details" });
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

  app.get("/api/users/:userId/validated-count", async (req, res) => {
    try {
      const { userId } = req.params;
      
      const validatedCount = await storage.getUserValidatedTicketsCount(userId);
      res.json({ validatedCount });
    } catch (error) {
      await logError(error, "GET /api/users/:userId/validated-count", {
        request: req
      });
      res.status(500).json({ message: "Failed to fetch validated tickets count" });
    }
  });

  // Currency API Routes
  app.get("/api/currency/balance", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      const balance = await storage.getUserBalance(userId);
      res.json(balance);
    } catch (error) {
      await logError(error, "GET /api/currency/balance", {
        request: req
      });
      res.status(500).json({ message: "Failed to fetch balance" });
    }
  });

  app.get("/api/currency/transactions", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      const limit = parseInt(req.query.limit as string) || 50;
      const transactions = await storage.getAccountTransactions(userId, limit);
      res.json(transactions);
    } catch (error) {
      await logError(error, "GET /api/currency/transactions", {
        request: req
      });
      res.status(500).json({ message: "Failed to fetch transactions" });
    }
  });
  
  // Daily claim status endpoint
  app.get("/api/currency/daily-claim-status", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: "User not authenticated" });
      }
      
      const status = await storage.canClaimDailyTickets(userId);
      res.json(status);
    } catch (error) {
      await logError(error, "GET /api/currency/daily-claim-status", { request: req });
      res.status(500).json({ message: "Failed to check claim status" });
    }
  });
  
  // Daily claim endpoint
  app.post("/api/currency/claim-daily", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: "User not authenticated" });
      }
      
      const result = await storage.claimDailyTickets(userId);
      res.json({
        success: true,
        amount: result.amount,
        nextClaimAt: result.nextClaimAt,
        message: `You received ${result.amount} Tickets!`
      });
    } catch (error: any) {
      if (error.message === 'Cannot claim tickets yet') {
        return res.status(400).json({ message: "You've already claimed your daily tickets. Please wait 24 hours." });
      }
      await logError(error, "POST /api/currency/claim-daily", { request: req });
      res.status(500).json({ message: "Failed to claim daily tickets" });
    }
  });
  
  // Secret code redemption
  app.post("/api/currency/redeem-code", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: "User not authenticated" });
      }
      
      const { code } = req.body;
      if (!code) {
        return res.status(400).json({ message: "Code is required" });
      }
      
      const result = await storage.redeemSecretCode(code, userId);
      
      if (result.success) {
        res.json({
          success: true,
          ticketAmount: result.ticketAmount,
          message: `Successfully redeemed ${result.ticketAmount} tickets!`
        });
      } else {
        res.status(400).json({ 
          success: false,
          message: result.error || "Failed to redeem code" 
        });
      }
    } catch (error) {
      await logError(error, "POST /api/currency/redeem-code", { request: req });
      res.status(500).json({ message: "Failed to redeem code" });
    }
  });
  
  // Create ticket purchase session
  app.post("/api/currency/create-purchase", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user?.id;
      const userEmail = req.user?.email;
      
      if (!userId || !userEmail) {
        return res.status(401).json({ message: "User not authenticated" });
      }
      
      const { quantity } = req.body;
      
      if (!quantity || quantity < 12) {
        return res.status(400).json({ message: "Minimum purchase is 12 tickets" });
      }
      
      const unitPrice = 0.29;
      const totalAmount = quantity * unitPrice;
      
      // Create purchase record
      const purchase = await storage.createTicketPurchase({
        userId,
        quantity,
        unitPrice: unitPrice.toString(),
        totalAmount: totalAmount.toString(),
        status: "pending"
      });
      
      // Create Stripe checkout session
      const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
      
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [{
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'Event Tickets',
              description: `${quantity} tickets for creating and boosting events`,
            },
            unit_amount: Math.round(unitPrice * 100), // Convert to cents
          },
          quantity: quantity,
        }],
        mode: 'payment',
        success_url: `${process.env.VITE_APP_URL || 'http://localhost:5000'}/account?purchase=success&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.VITE_APP_URL || 'http://localhost:5000'}/account?purchase=cancelled`,
        customer_email: userEmail,
        metadata: {
          purchaseId: purchase.id,
          userId: userId,
          quantity: quantity.toString()
        }
      });
      
      // Update purchase with session ID
      await storage.updateTicketPurchaseStatus(purchase.id, "pending", session.id);
      
      res.json({
        sessionId: session.id,
        sessionUrl: session.url
      });
    } catch (error) {
      await logError(error, "POST /api/currency/create-purchase", { request: req });
      res.status(500).json({ message: "Failed to create purchase session" });
    }
  });
  
  // Handle Stripe webhook for successful payments
  app.post("/api/stripe/webhook", async (req, res) => {
    try {
      const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
      const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
      
      let event;
      
      if (endpointSecret) {
        // Verify webhook signature
        const sig = req.headers['stripe-signature'];
        try {
          event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
        } catch (err: any) {
          console.error('Webhook signature verification failed:', err.message);
          return res.status(400).send(`Webhook Error: ${err.message}`);
        }
      } else {
        // For testing without webhook signature
        event = req.body;
      }
      
      // Handle the event
      if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        
        // Get purchase from metadata
        const purchaseId = session.metadata?.purchaseId;
        const userId = session.metadata?.userId;
        const quantity = parseInt(session.metadata?.quantity || '0');
        
        if (purchaseId && userId && quantity > 0) {
          // Update purchase status
          await storage.updateTicketPurchaseStatus(purchaseId, "completed", session.id);
          
          // Credit user account
          await storage.creditUserAccount(
            userId,
            quantity,
            `Purchased ${quantity} tickets`,
            { 
              stripeSessionId: session.id,
              purchaseId 
            }
          );
          
          console.log(`Successfully processed purchase ${purchaseId} for user ${userId}: ${quantity} tickets`);
        }
      }
      
      res.json({ received: true });
    } catch (error) {
      console.error('Stripe webhook error:', error);
      res.status(500).json({ message: "Webhook processing failed" });
    }
  });

  app.post("/api/currency/transfer", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const fromUserId = req.user?.id;
      if (!fromUserId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      const { toEmail, amount, description } = req.body;

      if (!toEmail || !amount || amount <= 0) {
        return res.status(400).json({ message: "Invalid transfer parameters" });
      }

      // Find the recipient user
      const toUser = await storage.getUserByEmail(toEmail);
      if (!toUser) {
        return res.status(404).json({ message: "Recipient not found" });
      }

      if (toUser.id === fromUserId) {
        return res.status(400).json({ message: "Cannot transfer to yourself" });
      }

      // Check balance
      const balance = await storage.getUserBalance(fromUserId);
      if (!balance || parseFloat(balance.availableBalance) < amount) {
        return res.status(400).json({ message: "Insufficient balance" });
      }

      // Perform transfer
      const success = await storage.transferTickets(
        fromUserId,
        toUser.id,
        amount,
        description || `Transfer to ${toUser.email}`
      );

      if (!success) {
        return res.status(500).json({ message: "Transfer failed" });
      }

      res.json({ message: "Transfer successful" });
    } catch (error) {
      await logError(error, "POST /api/currency/transfer", {
        request: req
      });
      res.status(500).json({ message: "Failed to process transfer" });
    }
  });

  // Admin route to credit user accounts (for testing)
  app.post("/api/admin/currency/credit", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const adminId = req.user?.id;
      if (!adminId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      // For now, any authenticated user can credit accounts (for testing)
      // In production, this should check for admin role
      const { userId, amount, description } = req.body;

      if (!userId || !amount || amount <= 0) {
        return res.status(400).json({ message: "Invalid credit parameters" });
      }

      const success = await storage.creditUserAccount(
        userId,
        amount,
        description || "Account credit"
      );

      if (!success) {
        return res.status(500).json({ message: "Credit failed" });
      }

      res.json({ message: "Account credited successfully" });
    } catch (error) {
      await logError(error, "POST /api/admin/currency/credit", {
        request: req
      });
      res.status(500).json({ message: "Failed to credit account" });
    }
  });

  // Simple file upload endpoint for NFT HTML files
  app.post("/api/upload", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      // For HTML NFT files, just save them locally and return a URL
      const filename = `nft-${Date.now()}.html`;
      const url = `/uploads/${filename}`;
      
      // In production, you'd save the file to cloud storage
      // For now, we'll just return a placeholder URL
      res.json({ url });
    } catch (error) {
      await logError(error, "POST /api/upload", { request: req });
      res.status(500).json({ message: "Upload failed" });
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