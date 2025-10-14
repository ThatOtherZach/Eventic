import type { Express, NextFunction } from "express";
import { createServer, type Server } from "http";
import { randomUUID } from "crypto";
import { storage } from "./storage";
import {
  insertEventSchema,
  insertTicketSchema,
  insertFeaturedEventSchema,
  insertNotificationSchema,
  insertNotificationPreferencesSchema,
} from "@shared/schema";
import { z } from "zod";
import { fromZonedTime } from "date-fns-tz";
import { ObjectStorageService, ObjectNotFoundError } from "./objectStorage";
import { supabaseSyncService } from "./supabaseSync";
import { coinbaseService, TICKET_PACKAGES } from "./coinbaseService";
import fetch from "node-fetch";
import { logError, logWarning, logInfo } from "./logger";
import { setupAuth, isAuthenticated } from "./replitAuth";
import {
  extractAuthUser,
  requireAuth,
  extractUserId,
  extractUserEmail,
  AuthenticatedRequest,
  requirePermission,
  isAdmin,
} from "./authHelpers";
import { validateBody, validateQuery, paginationSchema } from "./validation";
import rateLimit from "express-rate-limit";
import { generateUniqueDisplayName } from "./utils/display-name-generator";
import { generateUniqueHuntCode } from "./utils/hunt-code-generator";
import { getTicketCaptureService, getFFmpegPath } from "./ticketCapture";
import { execFile } from "child_process";
import path from "path";
import fs from "fs";
import { nftMintingService } from "./services/nft-minting";
import { isCountry } from "@shared/countries";

// Rate limiter configuration for ticket purchases
const purchaseRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // Max 10 purchases per minute (increased from 3)
  message:
    "Too many purchase attempts. Please wait a moment before trying again.",
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  skipFailedRequests: false,
  handler: async (req, res) => {
    await logWarning("Rate limit exceeded for ticket purchase", req.path, {
      userId: extractUserId(req as AuthenticatedRequest) || undefined,
      metadata: {
        rateLimitWindow: 60000,
        maxPurchases: 10,
        ip: req.ip,
      },
    });
    res.status(429).json({
      message:
        "Too many purchase attempts. Please wait a moment before trying again.",
      retryAfter: 60,
    });
  },
});

// Rate limiter for event creation
const eventCreationRateLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 5, // Max 5 events per 5 minutes (increased from 2)
  message:
    "Too many events created. Please wait before creating another event.",
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  skipFailedRequests: false,
  handler: async (req, res) => {
    await logWarning("Rate limit exceeded for event creation", req.path, {
      userId: extractUserId(req as AuthenticatedRequest) || undefined,
      metadata: {
        rateLimitWindow: 300000,
        maxEvents: 5,
        ip: req.ip,
      },
    });
    res.status(429).json({
      message:
        "Too many events created. Please wait before creating another event.",
      retryAfter: 300,
    });
  },
});

// General API rate limiter
const generalRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 2000, // Limit each IP to 2000 requests per windowMs (increased from 1000)
  message: "Too many requests from this IP, please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
  // Use default keyGenerator which handles IPv6 properly
});

// Helper function to convert event time to UTC timestamp
function convertEventTimeToUtc(
  dateStr: string,
  timeStr: string,
  timezone: string,
): Date {
  // Create datetime string in the event's timezone
  const dateTimeStr = `${dateStr} ${timeStr}:00`;

  // Convert from the event's timezone to UTC
  // fromZonedTime treats the input as being in the specified timezone
  // and returns the equivalent UTC date
  return fromZonedTime(dateTimeStr, timezone);
}

// Helper function for rolling timezone events (kept for backward compatibility)
function getTimeInTimezone(date: Date, timezone: string): Date {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const dateParts: any = {};
  parts.forEach((part) => {
    dateParts[part.type] = part.value;
  });

  const localDateStr = `${dateParts.year}-${dateParts.month}-${dateParts.day}T${dateParts.hour}:${dateParts.minute}:${dateParts.second}`;
  return new Date(localDateStr);
}

// Helper function to check if an event is active (upcoming or ongoing with 1-hour buffer)
function isEventActive(event: any): boolean {
  const now = new Date();
  const timezone = event.timezone || "America/New_York";

  try {
    // Get event start time
    let startDate: Date;
    if (event.startAtUtc) {
      startDate = new Date(event.startAtUtc);
    } else if (event.date && event.time) {
      startDate = convertEventTimeToUtc(event.date, event.time, timezone);
    } else if (event.date) {
      // If only date is provided, assume it starts at midnight
      startDate = convertEventTimeToUtc(event.date, "00:00", timezone);
    } else {
      // If no date information, include the event
      return true;
    }

    // Get event end time with 1-hour buffer
    let endDateWithBuffer: Date;

    if (event.endAtUtc) {
      // Use pre-computed UTC end time if available
      endDateWithBuffer = new Date(event.endAtUtc);
      endDateWithBuffer.setTime(endDateWithBuffer.getTime() + 60 * 60 * 1000); // Add 1-hour buffer
    } else if (event.endDate && event.endTime) {
      // Event has explicit end date/time
      endDateWithBuffer = convertEventTimeToUtc(
        event.endDate,
        event.endTime,
        timezone,
      );
      endDateWithBuffer.setTime(endDateWithBuffer.getTime() + 60 * 60 * 1000); // Add 1-hour buffer
    } else if (event.endDate) {
      // Event has end date but no specific end time - default to end of day (23:59:59)
      endDateWithBuffer = convertEventTimeToUtc(
        event.endDate,
        "23:59",
        timezone,
      );
      endDateWithBuffer.setTime(endDateWithBuffer.getTime() + 60 * 60 * 1000); // Add 1-hour buffer
    } else {
      // Single-day event: assume 3 hours duration + 1 hour buffer = 4 hours total from start
      endDateWithBuffer = new Date(startDate.getTime() + 4 * 60 * 60 * 1000);
    }

    // Event is active if:
    // - It hasn't ended yet (including buffer), OR
    // - It's a future event
    return now <= endDateWithBuffer;
  } catch (error) {
    // If there's any error parsing dates, include the event to be safe
    return true;
  }
}

// Helper function to check if a ticket is within its valid time window
function isTicketWithinValidTime(event: any): {
  valid: boolean;
  message?: string;
} {
  const serverNow = new Date();

  // Get event's timezone (default to America/New_York if not set)
  const eventTimezone = event.timezone || "America/New_York";

  // Use pre-computed UTC timestamps if available (new approach)
  // Fall back to computing on-the-fly for older events without UTC fields
  let startDate: Date;
  if (event.startAtUtc) {
    startDate = new Date(event.startAtUtc);
  } else {
    // Fallback for events created before UTC fields were added
    startDate = convertEventTimeToUtc(event.date, event.time, eventTimezone);
  }

  // Now we can compare directly with server time (both are in UTC)
  const now = serverNow;

  // Check if this is a rolling timezone event
  if (event.rollingTimezone) {
    // For rolling timezone events, check if the current time in ANY timezone
    // matches or has passed the event start time
    // Convert server time to event's timezone for rolling timezone comparison
    const nowInEventTz = getTimeInTimezone(serverNow, eventTimezone);
    const eventHour = parseInt(event.time.split(":")[0]);
    const eventMinute = parseInt(event.time.split(":")[1]);
    const currentHour = nowInEventTz.getHours();
    const currentMinute = nowInEventTz.getMinutes();
    const eventDate = new Date(event.date + "T00:00:00");
    const todayDate = new Date(
      nowInEventTz.toISOString().split("T")[0] + "T00:00:00",
    );

    // Check if we're on the same day or after the event date
    if (todayDate >= eventDate) {
      // Check if current local time has passed the event start time
      if (
        currentHour > eventHour ||
        (currentHour === eventHour && currentMinute >= eventMinute)
      ) {
        // Event is valid in this timezone
        return { valid: true };
      } else {
        return {
          valid: false,
          message: `Global Sync event starts at ${event.time} in your local timezone`,
        };
      }
    } else {
      return {
        valid: false,
        message: `Global Sync event starts on ${event.date} at ${event.time} in each timezone`,
      };
    }
  }

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
        validationStartTime = new Date(
          startDate.getTime() - 2 * 60 * 60 * 1000,
        );
        break;
      // "At Start Time" uses the original start time
    }

    if (now < validationStartTime) {
      // Format times in the event's timezone for display
      const formatter = new Intl.DateTimeFormat("en-US", {
        timeZone: eventTimezone,
        dateStyle: "short",
        timeStyle: "short",
      });

      const timeDescription =
        earlyValidation === "At Start Time"
          ? `at ${formatter.format(startDate)}`
          : earlyValidation === "One Hour Before"
            ? `starting ${formatter.format(validationStartTime)} (1 hour before event)`
            : `starting ${formatter.format(validationStartTime)} (2 hours before event)`;

      return {
        valid: false,
        message: `Ticket validation begins ${timeDescription}`,
      };
    }
  }

  // If event has an end date and time, check if we're past it
  if (event.endDate && event.endTime) {
    // Use pre-computed UTC timestamp if available
    let endDate: Date;
    if (event.endAtUtc) {
      endDate = new Date(event.endAtUtc);
    } else {
      // Fallback for events created before UTC fields were added
      endDate = convertEventTimeToUtc(
        event.endDate,
        event.endTime,
        eventTimezone,
      );
    }

    // For rolling timezone events, check against local time
    if (event.rollingTimezone) {
      const nowInEventTz = getTimeInTimezone(serverNow, eventTimezone);
      const eventEndHour = parseInt(event.endTime.split(":")[0]);
      const eventEndMinute = parseInt(event.endTime.split(":")[1]);
      const currentHour = nowInEventTz.getHours();
      const currentMinute = nowInEventTz.getMinutes();
      const eventEndDateObj = new Date(event.endDate + "T00:00:00");
      const todayDate = new Date(
        nowInEventTz.toISOString().split("T")[0] + "T00:00:00",
      );

      if (
        todayDate > eventEndDateObj ||
        (todayDate.getTime() === eventEndDateObj.getTime() &&
          (currentHour > eventEndHour ||
            (currentHour === eventEndHour && currentMinute > eventEndMinute)))
      ) {
        return {
          valid: false,
          message: `Global Sync event ended at ${event.endTime} in your local timezone`,
        };
      }
    } else if (now > endDate) {
      // Format end date in the event's timezone for display
      const formatter = new Intl.DateTimeFormat("en-US", {
        timeZone: eventTimezone,
        dateStyle: "short",
        timeStyle: "short",
      });

      return {
        valid: false,
        message: `Event has ended. It ended on ${formatter.format(endDate)}`,
      };
    }
  } else {
    // No end date - check if we're within 24 hours of start
    if (event.rollingTimezone) {
      // For rolling events without end date, valid for 24 hours after local start time
      const nowInEventTz = getTimeInTimezone(serverNow, eventTimezone);
      const eventHour = parseInt(event.time.split(":")[0]);
      const eventMinute = parseInt(event.time.split(":")[1]);
      const currentHour = nowInEventTz.getHours();
      const currentMinute = nowInEventTz.getMinutes();
      const eventDate = new Date(event.date + "T00:00:00");
      const todayDate = new Date(
        nowInEventTz.toISOString().split("T")[0] + "T00:00:00",
      );
      const dayAfterEvent = new Date(eventDate);
      dayAfterEvent.setDate(dayAfterEvent.getDate() + 1);

      // Check if we're more than 24 hours past the event date
      if (todayDate > dayAfterEvent) {
        return {
          valid: false,
          message: `Global Sync event expired. It was valid for 24 hours after ${event.time} in each timezone`,
        };
      }
    } else {
      const twentyFourHoursAfterStart = new Date(
        startDate.getTime() + 24 * 60 * 60 * 1000,
      );
      if (now > twentyFourHoursAfterStart) {
        // Format times in the event's timezone for display
        const formatter = new Intl.DateTimeFormat("en-US", {
          timeZone: eventTimezone,
          dateStyle: "short",
          timeStyle: "short",
        });

        return {
          valid: false,
          message: `Ticket has expired. It was valid for 24 hours after ${formatter.format(startDate)}`,
        };
      }
    }
  }

  return { valid: true };
}

// Validation rate limiter
const validationRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 50, // Max 50 validation attempts per minute (increased from 20)
  message:
    "Too many validation attempts. Please wait a moment before trying again.",
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  skipFailedRequests: false,
});

// Hunt code redemption rate limiter (stricter limits)
const huntRedemptionRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // Only 5 hunt redemption attempts per minute per IP
  message:
    "Too many hunt code attempts. Please wait a minute and try again.",
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful redemptions
  skipFailedRequests: false,
});

export async function registerRoutes(app: Express): Promise<Server> {
  const objectStorageService = new ObjectStorageService();

  // Setup Replit Auth first
  await setupAuth(app);

  // Set trust proxy for accurate IP detection (already done in setupAuth but kept for clarity)
  app.set("trust proxy", 1);

  // Apply general rate limiting to all routes
  app.use(generalRateLimiter);

  // Auth routes for Replit Auth
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const replitAuthId = req.user.claims.sub;
      const userEmail = req.user.claims.email;
      
      // First try to find user by email (to handle ID mismatches)
      let user = userEmail ? await storage.getUserByEmail(userEmail) : null;
      
      // If not found by email, try by Replit Auth ID
      if (!user) {
        user = await storage.getUser(replitAuthId);
      }
      
      if (user) {
        // Get user's roles using their actual database ID
        const roles = await storage.getUserRoles(user.id);
        const isAdmin = roles.some(role => role.name === 'super_admin' || role.name === 'event_moderator');
        
        // Return user with roles and admin status
        res.json({
          ...user,
          roles,
          isAdmin
        });
      } else {
        res.status(404).json({ message: "User not found" });
      }
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Get user permissions
  app.get('/api/auth/permissions', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const permissions = await storage.getUserPermissions(userId);
      const roles = await storage.getUserRoles(userId);
      const isAdmin = await storage.hasPermission(userId, 'manage_events');
      
      res.json({
        permissions,
        roles,
        isAdmin
      });
    } catch (error) {
      console.error("Error fetching permissions:", error);
      res.status(500).json({ message: "Failed to fetch permissions" });
    }
  });

  // DEPRECATED: Old login endpoint - keeping for backwards compatibility but returns error
  app.post("/api/auth/login", async (req: AuthenticatedRequest, res) => {
    const { checkLoginRateLimit } = await import("./authLimiter");

    // Apply rate limiting check
    await new Promise((resolve) => {
      checkLoginRateLimit(req, res, resolve as NextFunction);
    });

    // If rate limited, response was already sent
    if (res.headersSent) return;

    const { email, rememberMe } = req.body;
    const ipAddress = req.ip || "unknown";

    try {
      // Check if Supabase is available (you could add a health check here)
      const isSupabaseAvailable = true; // For now, assume it's available

      if (!isSupabaseAvailable) {
        // Add to queue (queuePosition is calculated in addToAuthQueue)
        const queueItem = await storage.addToAuthQueue({
          email,
          queuePosition: 0, // Will be calculated in storage method
          status: "waiting",
        });

        const position = await storage.getQueuePosition(email);

        return res.status(503).json({
          message:
            "Authentication service is currently busy. You have been added to the queue.",
          queuePosition: position,
          queueId: queueItem.id,
        });
      }

      // Record login attempt
      await storage.recordLoginAttempt({
        email,
        ipAddress,
        success: false, // Will update if successful
      });

      // Record auth event
      await storage.recordAuthEventNew({
        type: "login_attempt",
        email,
        ipAddress,
        metadata: { rememberMe } as any,
      });

      // In production, you would trigger Supabase magic link here
      // For now, return success to continue with existing flow
      res.json({
        message: "Magic link sent to your email",
        sessionDuration: rememberMe ? 30 : 15, // days
        requiresCaptcha: false,
      });
    } catch (error) {
      await storage.recordAuthEventNew({
        type: "login_failure",
        email,
        ipAddress,
        metadata: { error: (error as Error).message } as any,
      });

      await logError(error, "POST /api/auth/login", {
        request: req,
        metadata: { email },
      });

      res.status(500).json({ message: "Login failed" });
    }
  });

  // Monitoring endpoints
  app.get(
    "/api/monitoring/auth-metrics",
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const hours = parseInt(req.query.hours as string) || 24;
        const metrics = await storage.getAuthMetrics(hours);
        res.json(metrics);
      } catch (error) {
        await logError(error, "GET /api/monitoring/auth-metrics", {
          request: req,
        });
        res.status(500).json({ message: "Failed to fetch auth metrics" });
      }
    },
  );

  app.get(
    "/api/monitoring/system-metrics",
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const stats = await storage.getEventStats();

        // Get active users count (users who logged in within last 24 hours)
        const activeUsers = await storage.getAuthMetrics(24);

        // Get current queue length
        const queueLength =
          (await storage.getQueuePosition("_count_only_")) || 0;

        res.json({
          totalEvents: stats.totalEvents,
          totalTickets: stats.totalTickets,
          validatedTickets: stats.validatedTickets,
          activeUsers: activeUsers.uniqueUsers,
          queueLength,
        });
      } catch (error) {
        await logError(error, "GET /api/monitoring/system-metrics", {
          request: req,
        });
        res.status(500).json({ message: "Failed to fetch system metrics" });
      }
    },
  );

  // Get queue position
  app.get("/api/auth/queue/:email", async (req: AuthenticatedRequest, res) => {
    try {
      const position = await storage.getQueuePosition(req.params.email);

      if (position === null) {
        return res.status(404).json({ message: "Not in queue" });
      }

      res.json({ position });
    } catch (error) {
      res.status(500).json({ message: "Failed to get queue position" });
    }
  });

  // Sync/create user in local database when they login via Supabase
  app.post(
    "/api/auth/sync-user",
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const replitAuthId = extractUserId(req);
        if (!replitAuthId) {
          return res.status(401).json({ message: "Unauthorized" });
        }

        const { email, name } = req.body;
        const userEmail = email || extractUserEmail(req);

        // Check if user already exists by email first, then by ID
        let existingUser = userEmail 
          ? await storage.getUserByEmail(userEmail)
          : null;
        
        if (!existingUser) {
          existingUser = await storage.getUserById(replitAuthId);
        }
        if (existingUser) {
          // Check if this user should be an admin based on environment variable
          const adminEmails =
            process.env.ADMIN_EMAILS?.split(",").map((e) =>
              e.trim().toLowerCase(),
            ) || [];
          if (userEmail && adminEmails.includes(userEmail.toLowerCase())) {
            // Check if they already have the super_admin role using the correct database user ID
            const actualUserId = existingUser.id;
            const userRoles = await storage.getUserRoles(actualUserId);
            const hasSuperAdmin = userRoles.some(
              (role) => role.name === "super_admin",
            );
            
            console.log(`[AUTH] Checking admin status for ${userEmail} (ID: ${actualUserId}):`, {
              isInAdminEmails: true,
              currentRoles: userRoles.map(r => r.name),
              hasSuperAdmin,
              databaseUserId: actualUserId
            });

            if (!hasSuperAdmin) {
              // Ensure roles are initialized
              await storage.initializeRolesAndPermissions();
              
              // Assign super_admin role using the correct database user ID
              const superAdminRole = await storage.getRoleByName("super_admin");
              if (superAdminRole) {
                try {
                  await storage.assignUserRole(actualUserId, superAdminRole.id);
                  console.log(
                    `[AUTH] Successfully assigned super_admin role to existing user ${userEmail} (ID: ${actualUserId}) based on ADMIN_EMAILS environment variable`,
                  );
                } catch (error) {
                  console.error(
                    `[AUTH] Role assignment failed for ${userEmail} (ID: ${actualUserId}):`,
                    error,
                  );
                }
              } else {
                console.error(`[AUTH] super_admin role not found in database`);
              }
            } else {
              console.log(`[AUTH] User ${userEmail} (ID: ${actualUserId}) already has super_admin role`);
            }
          }

          // If user exists but doesn't have a display name, generate one
          if (!existingUser.displayName) {
            // Get all existing display names to ensure uniqueness
            const allUsers = await storage.getAllUsers();
            const existingDisplayNames = allUsers
              .map((u) => u.displayName)
              .filter(Boolean) as string[];

            // Generate unique display name
            const displayName = generateUniqueDisplayName(
              existingDisplayNames,
              existingUser.createdAt || new Date(),
            );

            // Update user with display name
            const updatedUser = await storage.updateUserDisplayName(
              userId,
              displayName,
            );
            return res.json(updatedUser);
          }
          return res.json(existingUser);
        }

        // Check registration limit before creating new user
        const registrationLimitSetting = await storage.getSystemSetting(
          "userRegistrationLimit",
        );
        if (
          registrationLimitSetting &&
          registrationLimitSetting.value !== "unlimited"
        ) {
          const currentUserCount = await storage.getTotalUsersCount();
          const limit = parseInt(registrationLimitSetting.value, 10);

          // Allow super admins to bypass the limit
          const adminEmails =
            process.env.ADMIN_EMAILS?.split(",").map((e) =>
              e.trim().toLowerCase(),
            ) || [];
          const isSuperAdmin =
            email && adminEmails.includes(email.toLowerCase());

          if (!isSuperAdmin && currentUserCount >= limit) {
            return res.status(403).json({
              message: "We're currently at capacity! Please check back soon.",
              currentCount: currentUserCount,
              limit: limit,
            });
          }
        }

        // Get all existing display names to ensure uniqueness
        const allUsers = await storage.getAllUsers();
        const existingDisplayNames = allUsers
          .map((u) => u.displayName)
          .filter(Boolean) as string[];

        // Generate unique display name
        const displayName = generateUniqueDisplayName(
          existingDisplayNames,
          new Date(),
        );

        // Create new user in local database
        const newUser = await storage.createUser({
          id: userId,
          email: email || `user_${userId}@placeholder.com`,
          displayName,
        });

        // Check if this user should be an admin based on environment variable
        const adminEmails =
          process.env.ADMIN_EMAILS?.split(",").map((e) =>
            e.trim().toLowerCase(),
          ) || [];
        if (email && adminEmails.includes(email.toLowerCase())) {
          // Ensure roles are initialized
          await storage.initializeRolesAndPermissions();
          
          // Assign super_admin role
          const superAdminRole = await storage.getRoleByName("super_admin");
          if (superAdminRole) {
            try {
              await storage.assignUserRole(userId, superAdminRole.id);
              console.log(
                `[AUTH] Successfully assigned super_admin role to new user ${email} based on ADMIN_EMAILS environment variable`,
              );
            } catch (error) {
              // Role might already be assigned, that's okay
              console.error(
                `[AUTH] Role assignment failed for new user ${email}:`,
                error,
              );
            }
          } else {
            console.error(`[AUTH] super_admin role not found in database for new user ${email}`);
          }
        } else if (email) {
          console.log(`[AUTH] User ${email} created without admin role (not in ADMIN_EMAILS)`);
        }

        res.json(newUser);
      } catch (error) {
        await logError(error, "POST /api/auth/sync-user", {
          request: req,
          metadata: { email: req.body.email },
        });
        res.status(500).json({ message: "Failed to sync user" });
      }
    },
  );

  // Get current user's permissions
  app.get(
    "/api/auth/permissions",
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const userId = extractUserId(req);
        if (!userId) {
          return res.status(401).json({ message: "Unauthorized" });
        }

        const [roles, permissions] = await Promise.all([
          storage.getUserRoles(userId),
          storage.getUserPermissions(userId),
        ]);

        res.json({
          roles: roles.map((r) => ({
            name: r.name,
            displayName: r.displayName,
          })),
          permissions: permissions.map((p) => p.name),
          isAdmin: roles.some(
            (r) => r.name === "super_admin" || r.name === "event_moderator",
          ),
        });
      } catch (error) {
        await logError(error, "GET /api/auth/permissions", { request: req });
        res.status(500).json({ message: "Failed to fetch permissions" });
      }
    },
  );

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
        metadata: { filePath },
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
      const pathParts = fullPath.split("/");
      const bucketName = pathParts[1];
      const objectName = pathParts.slice(2).join("/");
      // Access the objectStorageClient through the service instance
      const bucket = (objectStorageService as any).objectStorageClient.bucket(
        bucketName,
      );
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
        metadata: { objectPath: req.params.objectPath },
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

  // Unified location-based event filtering with type support
  app.get("/api/events/location", async (req: AuthenticatedRequest, res) => {
    try {
      const type = req.query.type as string; // 'venue', 'city', or 'country'
      const value = ((req.query.value as string) || "").trim().toLowerCase();

      if (!type || !value) {
        return res
          .status(400)
          .json({ message: "Missing type or value parameter" });
      }

      if (!["venue", "city", "country"].includes(type)) {
        return res
          .status(400)
          .json({
            message: "Invalid type parameter. Must be venue, city, or country",
          });
      }

      // Get all public and enabled events only - private and suspended events must never appear in location listings
      let events = (await storage.getEvents()).filter(
        (event) => !event.isPrivate && event.isEnabled,
      );

      // Only get featured events if this is a city (not a country or venue)
      const isLocationACountry = type === "country";
      const featuredEvents =
        type === "city" ? await storage.getActiveFeaturedEvents() : [];
      const featuredEventIds = new Set(featuredEvents.map((fe) => fe.eventId));

      // Filter to show only upcoming and ongoing events (with 1-hour buffer)
      events = events.filter((event) => isEventActive(event));

      // Filter by location type
      const filteredEvents = events.filter((event) => {
        // Double-check that event is not private or suspended (safety check)
        if (event.isPrivate || !event.isEnabled) return false;
        if (!event.venue) return false;

        const venueLower = event.venue.toLowerCase();
        const venueParts = venueLower.split(",").map((part) => part.trim());

        switch (type) {
          case "venue":
            // For venue, match the entire venue string
            return venueLower.includes(value);

          case "city":
            // For city, typically the second-to-last part after splitting by comma
            // e.g., "123 Main St, London, United Kingdom" -> ["123 Main St", "London", "United Kingdom"]
            if (venueParts.length >= 2) {
              // Try to match the city part (usually second-to-last)
              const cityPart = venueParts[venueParts.length - 2] || "";
              return cityPart.includes(value) || value.includes(cityPart);
            }
            // Fallback to checking all parts
            return venueParts.some(
              (part) => part.includes(value) || value.includes(part),
            );

          case "country":
            // For country, typically the last part after splitting by comma
            if (venueParts.length >= 1) {
              const countryPart = venueParts[venueParts.length - 1] || "";
              // Also check if it's a known country using the isCountry helper
              return (
                countryPart.includes(value) ||
                value.includes(countryPart) ||
                (isCountry(value) &&
                  venueParts.some((part) => part.includes(value)))
              );
            }
            return false;

          default:
            return false;
        }
      });

      // Sort events
      filteredEvents.sort((a, b) => {
        // For country and venue pages, just sort by date (no boosting)
        if (type !== "city") {
          const dateA = new Date(a.date).getTime();
          const dateB = new Date(b.date).getTime();
          return dateA - dateB;
        }

        // For city pages, apply boosting logic
        const aIsBoosted = featuredEventIds.has(a.id);
        const bIsBoosted = featuredEventIds.has(b.id);

        // If both are boosted, sort by position
        if (aIsBoosted && bIsBoosted) {
          const aFeatured = featuredEvents.find((fe) => fe.eventId === a.id);
          const bFeatured = featuredEvents.find((fe) => fe.eventId === b.id);
          return (aFeatured?.position || 999) - (bFeatured?.position || 999);
        }

        // Boosted events come first (only for cities)
        if (aIsBoosted && !bIsBoosted) return -1;
        if (!aIsBoosted && bIsBoosted) return 1;

        // Both regular events, sort by date
        const dateA = new Date(a.date).getTime();
        const dateB = new Date(b.date).getTime();
        return dateA - dateB;
      });

      // Add current price with surge pricing to each event
      const eventsWithPricing = await Promise.all(
        filteredEvents.map(async (event) => {
          const currentPrice = await storage.getCurrentPrice(event.id);
          return {
            ...event,
            currentPrice,
          };
        }),
      );

      res.json(eventsWithPricing);
    } catch (error) {
      await logError(error, "GET /api/events/location", {
        request: req,
        metadata: { type: req.query.type, value: req.query.value },
      });
      res.status(500).json({ message: "Failed to fetch events by location" });
    }
  });

  // Legacy location-based event filtering (kept for backward compatibility, will be removed)
  app.get(
    "/api/events/location/:location",
    async (req: AuthenticatedRequest, res) => {
      try {
        const location = decodeURIComponent(req.params.location)
          .trim()
          .toLowerCase();

        // Get all public and enabled events only - private and suspended events must never appear in location listings
        let events = (await storage.getEvents()).filter(
          (event) => !event.isPrivate && event.isEnabled,
        );

        // Use the imported isCountry helper

        // Only get featured events if this is a city (not a country)
        const isLocationACountry = isCountry(location);
        const featuredEvents = !isLocationACountry
          ? await storage.getActiveFeaturedEvents()
          : [];
        const featuredEventIds = new Set(
          featuredEvents.map((fe) => fe.eventId),
        );

        // Filter to show only upcoming and ongoing events (with 1-hour buffer)
        events = events.filter((event) => isEventActive(event));

        // Filter by location (city or country) and ensure no private or suspended events slip through
        const filteredEvents = events.filter((event) => {
          // Double-check that event is not private or suspended (safety check)
          if (event.isPrivate || !event.isEnabled) return false;

          if (!event.venue) return false;
          const venueLower = event.venue.toLowerCase();

          // Check if the location matches any part of the venue string
          // This handles both "London" matching "123 Main St, London, United Kingdom"
          // and "United Kingdom" matching the same
          const venueParts = venueLower.split(",").map((part) => part.trim());
          return venueParts.some(
            (part) => part.includes(location) || location.includes(part),
          );
        });

        // Sort events:
        // - For cities: boosted events first (sorted by position), then regular events by date
        // - For countries: just sort by date (no boosting priority)
        filteredEvents.sort((a, b) => {
          // If this is a country page, just sort by date (no boosting)
          if (isLocationACountry) {
            const dateA = new Date(a.date).getTime();
            const dateB = new Date(b.date).getTime();
            return dateA - dateB;
          }

          // For city pages, apply boosting logic
          const aIsBoosted = featuredEventIds.has(a.id);
          const bIsBoosted = featuredEventIds.has(b.id);

          // If both are boosted, sort by position
          if (aIsBoosted && bIsBoosted) {
            const aFeatured = featuredEvents.find((fe) => fe.eventId === a.id);
            const bFeatured = featuredEvents.find((fe) => fe.eventId === b.id);
            return (aFeatured?.position || 999) - (bFeatured?.position || 999);
          }

          // Boosted events come first (only for cities)
          if (aIsBoosted && !bIsBoosted) return -1;
          if (!aIsBoosted && bIsBoosted) return 1;

          // Both regular events, sort by date
          const dateA = new Date(a.date).getTime();
          const dateB = new Date(b.date).getTime();
          return dateA - dateB;
        });

        // Add current price with surge pricing to each event
        const eventsWithPricing = await Promise.all(
          filteredEvents.map(async (event) => {
            const currentPrice = await storage.getCurrentPrice(event.id);
            return {
              ...event,
              currentPrice,
            };
          }),
        );

        res.json(eventsWithPricing);
      } catch (error) {
        await logError(error, "GET /api/events/location/:location", {
          request: req,
          metadata: { location: req.params.location },
        });
        res.status(500).json({ message: "Failed to fetch events by location" });
      }
    },
  );

  // Get events by hashtag
  app.get(
    "/api/events/hashtag/:hashtag",
    async (req: AuthenticatedRequest, res) => {
      try {
        const hashtag = decodeURIComponent(req.params.hashtag)
          .trim()
          .toLowerCase();

        // Get all public and enabled events only - private and suspended events must never appear in hashtag listings
        let events = (await storage.getEvents()).filter(
          (event) => !event.isPrivate && event.isEnabled,
        );

        // Get featured events to check which events are boosted
        const featuredEvents = await storage.getActiveFeaturedEvents();
        const featuredEventIds = new Set(
          featuredEvents.map((fe) => fe.eventId),
        );

        // Filter to show only upcoming and ongoing events (with 1-hour buffer)
        events = events.filter((event) => isEventActive(event));

        // Filter by hashtag
        const filteredEvents = events.filter((event) => {
          // Double-check that event is not private or suspended (safety check)
          if (event.isPrivate || !event.isEnabled) return false;

          // Check if event has this hashtag
          if (event.hashtags && Array.isArray(event.hashtags)) {
            return event.hashtags.some(
              (tag) => tag.toLowerCase() === hashtag.toLowerCase(),
            );
          }
          return false;
        });

        // Sort events: boosted events first (sorted by position), then regular events by date
        filteredEvents.sort((a, b) => {
          const aIsBoosted = featuredEventIds.has(a.id);
          const bIsBoosted = featuredEventIds.has(b.id);

          // If both are boosted, sort by position
          if (aIsBoosted && bIsBoosted) {
            const aFeatured = featuredEvents.find((fe) => fe.eventId === a.id);
            const bFeatured = featuredEvents.find((fe) => fe.eventId === b.id);
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
        const eventsWithPricing = await Promise.all(
          filteredEvents.map(async (event) => {
            const currentPrice = await storage.getCurrentPrice(event.id);
            return {
              ...event,
              currentPrice,
            };
          }),
        );

        res.json(eventsWithPricing);
      } catch (error) {
        await logError(error, "GET /api/events/hashtag/:hashtag", {
          request: req,
          metadata: { hashtag: req.params.hashtag },
        });
        res.status(500).json({ message: "Failed to fetch events by hashtag" });
      }
    },
  );

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
        const crypto = await import("crypto");
        const expectedToken = crypto
          .createHash("sha256")
          .update(
            `${ticketId}-snapshot-${new Date().toISOString().split("T")[0]}`,
          )
          .digest("hex")
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
      const seed = ticketData.id
        .split("")
        .reduce((acc, char) => acc + char.charCodeAt(0), 0);
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
    ${
      event.specialEffectsEnabled && event.stickerUrl
        ? `
      <img class="sticker-overlay sticker-1" src="${event.stickerUrl}" alt="" crossorigin="anonymous">
      <img class="sticker-overlay sticker-2" src="${event.stickerUrl}" alt="" crossorigin="anonymous">
      <img class="sticker-overlay sticker-3" src="${event.stickerUrl}" alt="" crossorigin="anonymous">
      <img class="sticker-overlay sticker-4" src="${event.stickerUrl}" alt="" crossorigin="anonymous">
    `
        : ""
    }
    <div class="ticket-content">
      <div class="event-title">${event.name}</div>
      <div class="ticket-id">Ticket #${ticketData.ticketNumber || "001"}</div>
      ${ticketData.isValidated ? '<div class="validated-badge">✓ VALIDATED</div>' : ""}
    </div>
  </div>
</body>
</html>`;

      res.type("text/html").send(html);
    } catch (error: any) {
      next(error);
    }
  });

  app.get("/api/tickets/:ticketId", async (req: AuthenticatedRequest, res) => {
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

      const eventWithCreator = await storage.getEventWithCreator(
        ticket.eventId,
      );
      if (!eventWithCreator) {
        return res.status(404).json({ message: "Event not found" });
      }

      // Check if creator has admin role
      const creatorId = eventWithCreator.userId;
      const isAdminCreated = creatorId ? await isAdmin(creatorId) : false;

      // Remove creatorEmail from response for privacy
      const { creatorEmail, ...event } = eventWithCreator;

      res.json({
        ticket,
        event: {
          ...event,
          isAdminCreated,
        },
      });
    } catch (error) {
      await logError(error, "GET /api/tickets/:ticketId", {
        request: req,
        metadata: { ticketId: req.params.ticketId },
      });
      res.status(500).json({ message: "Failed to fetch ticket" });
    }
  });

  // Validation session routes
  app.post(
    "/api/tickets/:ticketId/validate-session",
    async (req: AuthenticatedRequest, res) => {
      try {
        const userId = extractUserId(req);
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

        const session = await storage.createValidationSession(
          req.params.ticketId,
          lat,
          lng,
        );
        res.json(session);
      } catch (error) {
        await logError(error, "POST /api/tickets/:ticketId/validate-session", {
          request: req,
          metadata: { ticketId: req.params.ticketId },
        });
        res
          .status(500)
          .json({ message: "Failed to create validation session" });
      }
    },
  );

  app.get(
    "/api/tickets/:ticketId/validation-token",
    async (req: AuthenticatedRequest, res) => {
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

        const tokenData = await storage.createValidationToken(
          req.params.ticketId,
        );
        res.json({ token: tokenData.token, code: tokenData.code });
      } catch (error: any) {
        if (error.message === "Validation session expired or not found") {
          await logWarning(
            "Validation session expired",
            "GET /api/tickets/:ticketId/validation-token",
            {
              userId: userId || undefined,
              ticketId: req.params.ticketId,
            },
          );
          return res.status(400).json({ message: error.message });
        }
        await logError(error, "GET /api/tickets/:ticketId/validation-token", {
          request: req,
          metadata: { ticketId: req.params.ticketId },
        });
        res
          .status(500)
          .json({ message: "Failed to generate validation token" });
      }
    },
  );

  // Capture/claim endpoint for idempotent media generation
  app.post(
    "/api/tickets/:ticketId/capture/claim",
    async (req: AuthenticatedRequest, res) => {
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
          const mediaType = "video/mp4";
          const pngUrl = ticket.nftMediaUrl.replace(
            /\.(mp4|webm|gif)$/,
            ".png",
          );

          return res.json({
            status: "already_captured",
            mp4_url: ticket.nftMediaUrl,
            png_url: pngUrl,
            media_type: mediaType,
          });
        }

        // Enqueue capture job (in production, use a proper job queue)
        res.json({
          status: "enqueued",
          job_id: `job_${idempotency_key || Date.now()}`,
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
              format: "mp4",
            });

            // Generate PNG preview (first frame)
            const pngPath = mediaPath.replace(".mp4", "-preview.png");
            const ffmpegPath = await getFFmpegPath();
            await new Promise((resolve, reject) => {
              execFile(
                ffmpegPath,
                [
                  "-i",
                  mediaPath,
                  "-vframes",
                  "1",
                  "-vf",
                  "scale=trunc(iw/2)*2:trunc(ih/2)*2",
                  pngPath,
                ],
                (error) => {
                  if (error) reject(error);
                  else resolve(null);
                },
              );
            });

            // Upload both files
            const mp4Buffer = fs.readFileSync(mediaPath);
            const pngBuffer = fs.readFileSync(pngPath);

            const mp4UploadURL =
              await objectStorageService.getObjectEntityUploadURL();
            const pngUploadURL =
              await objectStorageService.getObjectEntityUploadURL();

            await fetch(mp4UploadURL, {
              method: "PUT",
              body: mp4Buffer,
              headers: { "Content-Type": "video/mp4" },
            });

            await fetch(pngUploadURL, {
              method: "PUT",
              body: pngBuffer,
              headers: { "Content-Type": "image/png" },
            });

            // Get public URLs
            const mp4PublicUrl = `/public-objects/uploads/${mp4UploadURL.split("/").pop()?.split("?")[0]}`;
            const pngPublicUrl = `/public-objects/uploads/${pngUploadURL.split("/").pop()?.split("?")[0]}`;

            // Update ticket
            await storage.updateTicketNftMediaUrl(ticketId, mp4PublicUrl);

            // Clean up temp files
            fs.unlinkSync(mediaPath);
            fs.unlinkSync(pngPath);
          } catch (error) {
            console.error("Background capture failed:", error);
          }
        });
      } catch (error) {
        console.error("Capture claim error:", error);
        res.status(500).json({ message: "Failed to process capture claim" });
      }
    },
  );

  // Generate NFT media for minting (called when user views ticket after validation)
  app.post(
    "/api/tickets/:ticketId/generate-nft-media",
    async (req: AuthenticatedRequest, res) => {
      try {
        const userId = extractUserId(req);
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
          return res
            .status(400)
            .json({
              message: "Ticket must be validated before generating NFT media",
            });
        }

        // Check if media already exists (idempotency)
        if (ticket.nftMediaUrl) {
          console.log(
            `Media already exists for ticket ${ticket.id}, returning cached URL`,
          );
          return res.json({
            mediaUrl: ticket.nftMediaUrl,
            mediaType: "video/mp4",
            cached: true,
          });
        }

        // Get event details
        const event = await storage.getEvent(ticket.eventId);
        if (!event) {
          return res.status(404).json({ message: "Event not found" });
        }

        // Check if event allows NFT minting
        if (!event.allowMinting) {
          return res
            .status(400)
            .json({ message: "NFT minting is not enabled for this event" });
        }

        // Client handles media generation and upload directly
        // This endpoint now just returns success for compatibility
        console.log(
          "Client-side media generation - skipping server-side processing",
        );

        res.json({
          mediaUrl: null,
          mediaType: "text/html",
          cached: false,
          message: "Client will handle media generation",
        });
      } catch (error) {
        await logError(
          error,
          "POST /api/tickets/:ticketId/generate-nft-media",
          {
            request: req,
            metadata: { ticketId: req.params.ticketId },
          },
        );
        res.status(500).json({ message: "Failed to generate NFT media" });
      }
    },
  );

  // User-specific routes
  app.get(
    "/api/user/tickets",
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const userId = extractUserId(req);
        if (!userId) {
          return res.status(401).json({ message: "Unauthorized" });
        }

        const page = parseInt(req.query.page as string) || 1;
        const limit = Math.min(parseInt(req.query.limit as string) || 20, 100); // Max 100 items per page

        // Use paginated query if page is specified
        if (req.query.page) {
          const result = await storage.getTicketsByUserIdPaginated(userId, {
            page,
            limit,
          });
          // Fetch event data for each ticket
          const ticketsWithEvents = await Promise.all(
            result.tickets.map(async (ticket) => {
              const eventWithCreator = await storage.getEventWithCreator(
                ticket.eventId,
              );
              if (!eventWithCreator) {
                return { ...ticket, event: null };
              }
              const creatorId = eventWithCreator.userId;
              const isAdminCreated = creatorId
                ? await isAdmin(creatorId)
                : false;
              const { creatorEmail, ...event } = eventWithCreator;
              return { ...ticket, event: { ...event, isAdminCreated } };
            }),
          );
          res.json({ ...result, tickets: ticketsWithEvents });
        } else {
          // Legacy non-paginated response
          const tickets = await storage.getTicketsByUserId(userId);
          // Fetch event data for each ticket
          const ticketsWithEvents = await Promise.all(
            tickets.map(async (ticket) => {
              const eventWithCreator = await storage.getEventWithCreator(
                ticket.eventId,
              );
              if (!eventWithCreator) {
                return { ...ticket, event: null };
              }
              const creatorId = eventWithCreator.userId;
              const isAdminCreated = creatorId
                ? await isAdmin(creatorId)
                : false;
              const { creatorEmail, ...event } = eventWithCreator;
              return { ...ticket, event: { ...event, isAdminCreated } };
            }),
          );
          res.json(ticketsWithEvents);
        }
      } catch (error) {
        res.status(500).json({ message: "Failed to fetch user tickets" });
      }
    },
  );

  app.get(
    "/api/user/events",
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
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
    },
  );

  // Events routes
  app.get("/api/events", async (req: AuthenticatedRequest, res) => {
    try {
      const events = await storage.getEvents();
      // Filter out private and suspended events from general listing
      let publicEvents = events.filter((event) => !event.isPrivate && event.isEnabled);

      // Get featured events to check which events are boosted
      const featuredEvents = await storage.getActiveFeaturedEvents();
      const featuredEventIds = new Set(featuredEvents.map((fe) => fe.eventId));

      // Filter to show only upcoming and ongoing events (with 1-hour buffer)
      const activeEvents = publicEvents.filter((event) => isEventActive(event));

      // Sort events: boosted events first (sorted by position), then by date/time with 24-hour prioritization
      const sortedEvents = activeEvents.sort((a, b) => {
        const aIsBoosted = featuredEventIds.has(a.id);
        const bIsBoosted = featuredEventIds.has(b.id);

        // If both are boosted, sort by position
        if (aIsBoosted && bIsBoosted) {
          const aFeatured = featuredEvents.find((fe) => fe.eventId === a.id);
          const bFeatured = featuredEvents.find((fe) => fe.eventId === b.id);
          return (aFeatured?.position || 999) - (bFeatured?.position || 999);
        }

        // Boosted events come first
        if (aIsBoosted && !bIsBoosted) return -1;
        if (!aIsBoosted && bIsBoosted) return 1;

        // Both are regular events, apply normal sorting logic
        try {
          // Parse dates properly
          const [yearA, monthA, dayA] = a.date.split("-").map(Number);
          const [hoursA, minutesA] = a.time.split(":").map(Number);
          const dateTimeA = new Date(yearA, monthA - 1, dayA, hoursA, minutesA);

          const [yearB, monthB, dayB] = b.date.split("-").map(Number);
          const [hoursB, minutesB] = b.time.split(":").map(Number);
          const dateTimeB = new Date(yearB, monthB - 1, dayB, hoursB, minutesB);

          const now = new Date();
          const twentyFourHoursFromNow = new Date(
            now.getTime() + 24 * 60 * 60 * 1000,
          );

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
      const eventsWithPricing = await Promise.all(
        sortedEvents.map(async (event) => {
          const currentPrice = await storage.getCurrentPrice(event.id);
          return {
            ...event,
            currentPrice,
          };
        }),
      );

      res.json(eventsWithPricing);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch events" });
    }
  });

  app.get("/api/events/:id", async (req, res) => {
    try {
      // Check if it's a shortcode (8 characters) or full UUID
      const isShortcode = req.params.id.length === 8;
      const eventWithCreator = isShortcode
        ? await storage.getEventByShortcode(req.params.id)
        : await storage.getEventWithCreator(req.params.id);

      if (!eventWithCreator) {
        return res.status(404).json({ message: "Event not found" });
      }

      // Check if event is private and user is not authenticated
      if (eventWithCreator.isPrivate) {
        // Extract user ID from request (will be null if not authenticated)
        const userId = extractUserId(req as AuthenticatedRequest);

        // If user is not authenticated, return 401
        if (!userId) {
          return res
            .status(401)
            .json({
              message: "Authentication required to view this private event",
            });
        }

        // If user is authenticated, they can view the private event
        // The purpose of private events is just to hide them from public listings
        // Anyone with the link who is logged in can view it
      }

      // Check if creator has admin role
      const creatorId = eventWithCreator.userId;
      const isAdminCreated = creatorId ? await isAdmin(creatorId) : false;

      // Remove creatorEmail from response for privacy
      const { creatorEmail, ...event } = eventWithCreator;

      // Get total count of ALL tickets created for this event (regardless of resale status)
      // This gives us the true count of tickets sold
      const ticketsSold = await storage.getTotalTicketCountForEvent(
        event.id,
      );

      // Get count of tickets in resale queue
      const resaleCount = await storage.getResellQueueCount(event.id);

      // Available tickets = max tickets - total tickets sold
      // When tickets are resold, they don't create new tickets, just transfer ownership
      // So we don't need to adjust for resale queue
      const ticketsAvailable = event.maxTickets
        ? event.maxTickets - ticketsSold
        : null;

      // Get current price (handles surge pricing)
      const currentPrice = await storage.getCurrentPrice(event.id);

      res.json({
        ...event,
        ticketsSold,
        ticketsAvailable,
        currentPrice,
        resaleCount,
        isAdminCreated,
      });
    } catch (error) {
      await logError(error, "GET /api/events/:id", {
        request: req,
        metadata: { eventId: req.params.id },
      });
      res.status(500).json({ message: "Failed to fetch event" });
    }
  });

  // Helper function to check for offensive content in text (now async to use database)
  async function containsOffensiveContent(text: string): Promise<boolean> {
    const bannedWords = await storage.getBannedWords();
    const lowerText = text.toLowerCase();
    return bannedWords.some((word) => lowerText.includes(word));
  }

  app.post(
    "/api/events",
    eventCreationRateLimiter,
    validateBody(insertEventSchema),
    async (req: AuthenticatedRequest, res) => {
      // Get the actual database user ID
      const userId = await extractDatabaseUserId(req);
      const userEmail = extractUserEmail(req);

      try {
        // Check if user is scheduled for deletion
        if (userId) {
          const isScheduledForDeletion =
            await storage.isUserScheduledForDeletion(userId);
          if (isScheduledForDeletion) {
            const deletionStatus = await storage.getUserDeletionStatus(userId);
            return res.status(403).json({
              message: `Cannot create events while account is scheduled for deletion. Your account will be deleted in ${deletionStatus.daysRemaining} days. Cancel deletion to create events.`,
            });
          }
        }

        // Check if user has admin role
        const isAdminCreated = userId ? await isAdmin(userId) : false;

        // Handle image URL normalization if provided
        let createData = { ...req.body };
        if (
          createData.imageUrl &&
          createData.imageUrl.startsWith("https://storage.googleapis.com/")
        ) {
          createData.imageUrl = objectStorageService.normalizeObjectEntityPath(
            createData.imageUrl,
          );
        }
        if (
          createData.ticketBackgroundUrl &&
          createData.ticketBackgroundUrl.startsWith(
            "https://storage.googleapis.com/",
          )
        ) {
          createData.ticketBackgroundUrl =
            objectStorageService.normalizeObjectEntityPath(
              createData.ticketBackgroundUrl,
            );
        }
        if (
          createData.stickerUrl &&
          createData.stickerUrl.startsWith("https://storage.googleapis.com/")
        ) {
          createData.stickerUrl =
            objectStorageService.normalizeObjectEntityPath(
              createData.stickerUrl,
            );
        }

        // If ticket purchases are disabled, automatically set event to private
        if (createData.ticketPurchasesEnabled === false) {
          createData.isPrivate = true;
        }

        // Content moderation: Check for offensive words in title and venue fields
        let moderationTriggered = false;
        let moderationField = "";

        // Check event name
        if (
          createData.name &&
          (await containsOffensiveContent(createData.name))
        ) {
          createData.isPrivate = true;
          moderationTriggered = true;
          moderationField = "name";
        }

        // Check venue address
        if (
          createData.venueAddress &&
          (await containsOffensiveContent(createData.venueAddress))
        ) {
          createData.isPrivate = true;
          moderationTriggered = true;
          moderationField = moderationField
            ? `${moderationField}, address`
            : "address";
        }

        // Check venue city
        if (
          createData.venueCity &&
          (await containsOffensiveContent(createData.venueCity))
        ) {
          createData.isPrivate = true;
          moderationTriggered = true;
          moderationField = moderationField
            ? `${moderationField}, city`
            : "city";
        }

        if (moderationTriggered) {
          // Log this moderation action for monitoring
          await logInfo(
            "Event auto-moderated due to offensive content",
            "POST /api/events",
            {
              userId,
              metadata: {
                eventName: createData.name,
                triggeredFields: moderationField,
                action: "auto-set-private",
              },
            },
          );
        }

        // Extract hashtags from description (now plain text)
        const hashtags: string[] = [];
        if (createData.description) {
          // Extract hashtags directly from plain text
          const matches = createData.description.match(/#[a-zA-Z0-9_]+/g);
          if (matches) {
            // Remove the # and store unique hashtags
            const uniqueTags = Array.from(
              new Set(
                matches.map((tag: string) => tag.substring(1).toLowerCase()),
              ),
            );
            hashtags.push(...(uniqueTags as string[]));
          }
        }

        // Calculate payment processing fee if enabled
        let paymentProcessingFee = 0;
        if (
          createData.ticketPrice > 0 &&
          createData.paymentProcessing &&
          createData.paymentProcessing !== "None"
        ) {
          if (
            createData.paymentProcessing === "Ethereum" ||
            createData.paymentProcessing === "Bitcoin"
          ) {
            paymentProcessingFee = 100;
          } else if (createData.paymentProcessing === "USDC") {
            paymentProcessingFee = 50;
          }
        }

        // Calculate total tickets required
        // For free events: charge for capacity + payment fee
        // For paid events: only charge payment fee (attendees pay for tickets)
        const ticketPrice = parseFloat(createData.ticketPrice || "0");
        const capacityCost = ticketPrice > 0 ? 0 : createData.maxTickets || 0;
        const totalTicketsRequired = capacityCost + paymentProcessingFee;

        // Check if user has enough tickets
        if (userId && totalTicketsRequired > 0) {
          const userBalance = await storage.getUserBalance(userId);
          const balance = parseInt(userBalance?.balance || "0");
          if (balance < totalTicketsRequired) {
            // Build appropriate error message based on event type
            let message = "";
            if (ticketPrice > 0) {
              // Paid event - only payment processing fee
              message =
                paymentProcessingFee > 0
                  ? `Insufficient tickets. You need ${totalTicketsRequired} tickets for payment processing, but only have ${balance}.`
                  : `Insufficient tickets. You need ${totalTicketsRequired} tickets, but only have ${balance}.`;
            } else {
              // Free event - capacity + payment processing fee
              if (paymentProcessingFee > 0) {
                message = `Insufficient tickets. You need ${totalTicketsRequired} tickets (${capacityCost} for capacity + ${paymentProcessingFee} for payment processing), but only have ${balance}.`;
              } else {
                message = `Insufficient tickets. You need ${totalTicketsRequired} tickets for event capacity, but only have ${balance}.`;
              }
            }
            return res.status(400).json({ message });
          }

          // Deduct tickets from user balance (eventId will be set after creation)
          await storage.debitUserAccount(
            userId,
            totalTicketsRequired,
            "Event Creation",
            {},
          );
        }

        // Compute UTC timestamps for validation (unless it's a rolling timezone event)
        let startAtUtc: Date | null = null;
        let endAtUtc: Date | null = null;

        if (!createData.rollingTimezone) {
          // Convert event start time to UTC
          const timezone = createData.timezone || "America/New_York";
          startAtUtc = convertEventTimeToUtc(
            createData.date,
            createData.time,
            timezone,
          );

          // If event has an end date/time, convert that too
          if (createData.endDate && createData.endTime) {
            endAtUtc = convertEventTimeToUtc(
              createData.endDate,
              createData.endTime,
              timezone,
            );
          }
        }

        // Body is already validated by middleware
        const event = await storage.createEvent({
          ...createData,
          hashtags,
          paymentProcessingFee, // Store the fee amount
          isAdminCreated, // Set the isAdminCreated flag based on user's email
          userId, // Now we can use the actual userId since user exists in DB
          startAtUtc,
          endAtUtc,
        });

        // Create Hunt secret code if Treasure Hunt is enabled
        if (
          createData.treasureHunt &&
          createData.huntCode &&
          createData.latitude &&
          createData.longitude
        ) {
          try {
            // Check for hunt code collision and regenerate if needed
            let uniqueHuntCode = createData.huntCode.toUpperCase();
            let attempts = 0;
            const maxAttempts = 100;

            // Check if the provided hunt code already exists
            while (
              (await storage.huntCodeExists(uniqueHuntCode)) &&
              attempts < maxAttempts
            ) {
              // Generate a new hunt code server-side
              uniqueHuntCode = await generateUniqueHuntCode(storage, 1); // Only need 1 attempt per iteration
              attempts++;

              if (attempts > 10) {
                await logWarning(
                  "Multiple hunt code collisions detected",
                  "POST /api/events",
                  {
                    request: req as AuthenticatedRequest,
                    metadata: {
                      originalCode: createData.huntCode,
                      attempts,
                      finalCode: uniqueHuntCode,
                    },
                  },
                );
              }
            }

            // If we exhausted all attempts, add a timestamp suffix
            if (attempts >= maxAttempts) {
              uniqueHuntCode = `${uniqueHuntCode}_${Date.now()}`;
              await logError(
                new Error("Max hunt code collision attempts reached"),
                "POST /api/events",
                {
                  request: req as AuthenticatedRequest,
                  metadata: {
                    originalCode: createData.huntCode,
                    attempts: maxAttempts,
                    finalCode: uniqueHuntCode,
                  },
                },
              );
            }

            await storage.createSecretCode({
              code: uniqueHuntCode,
              ticketAmount: 2, // Default ticket reward for Hunt codes
              maxUses: createData.maxTickets || 100, // Use event capacity as max uses
              createdBy: userId,
              codeType: "hunt",
              eventId: event.id,
              huntLatitude: createData.latitude,
              huntLongitude: createData.longitude,
            });

            // Log if we had to change the hunt code
            if (uniqueHuntCode !== createData.huntCode.toUpperCase()) {
              await logInfo(
                "Hunt code changed due to collision",
                "POST /api/events",
                {
                  request: req as AuthenticatedRequest,
                  metadata: {
                    originalCode: createData.huntCode,
                    finalCode: uniqueHuntCode,
                    eventId: event.id,
                  },
                },
              );
            }
          } catch (error) {
            console.error("Failed to create Hunt secret code:", error);
            // Don't fail the event creation if secret code creation fails
          }
        }

        res.status(201).json(event);
      } catch (error) {
        await logError(error, "POST /api/events", {
          request: req,
          metadata: { eventData: req.body },
        });
        res.status(500).json({ message: "Failed to create event" });
      }
    },
  );

  app.put(
    "/api/events/:id",
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        // Get the actual database user ID (not the Replit Auth ID)
        const userId = await extractDatabaseUserId(req);
        if (!userId) {
          return res.status(401).json({ message: "Unauthorized" });
        }

        // Check if user owns the event or is an admin
        const event = await storage.getEvent(req.params.id);
        if (!event) {
          return res.status(404).json({ message: "Event not found" });
        }

        // Check if user has admin role using their database ID
        const hasAdminRole = await isAdmin(userId);
        
        // Log admin check for debugging
        if (!hasAdminRole && event.userId !== userId) {
          const userRoles = await storage.getUserRoles(userId);
          const userEmail = extractUserEmail(req);
          console.log(`[EVENT EDIT] User ${userEmail} (${userId}) attempted to edit event ${req.params.id}:`, {
            isOwner: event.userId === userId,
            hasAdminRole,
            userRoles: userRoles.map(r => r.name),
            eventOwnerId: event.userId,
            userDatabaseId: userId
          });
        }

        // Allow editing if user owns the event OR is an admin
        if (event.userId !== userId && !hasAdminRole) {
          return res
            .status(403)
            .json({ 
              message: "You can only edit your own events",
              isOwner: event.userId === userId,
              hasAdminRole
            });
        }

        // Get ticket count for validation
        const tickets = await storage.getTicketsByEventId(req.params.id);
        const ticketsSold = tickets.length;

        // Handle image URL normalization if provided
        let updateData = { ...req.body };

        // Content moderation: Check for offensive content in editable fields
        let moderationTriggered = false;
        let moderationField = "";

        // Check if updating name (shouldn't happen in edit mode, but just in case)
        if (
          updateData.name &&
          (await containsOffensiveContent(updateData.name))
        ) {
          updateData.isPrivate = true;
          moderationTriggered = true;
          moderationField = "name";
        }

        // Check venue address (this is locked in edit mode, but check anyway)
        if (
          updateData.venueAddress &&
          (await containsOffensiveContent(updateData.venueAddress))
        ) {
          updateData.isPrivate = true;
          moderationTriggered = true;
          moderationField = moderationField
            ? `${moderationField}, address`
            : "address";
        }

        // Check venue city (this is locked in edit mode, but check anyway)
        if (
          updateData.venueCity &&
          (await containsOffensiveContent(updateData.venueCity))
        ) {
          updateData.isPrivate = true;
          moderationTriggered = true;
          moderationField = moderationField
            ? `${moderationField}, city`
            : "city";
        }

        if (moderationTriggered) {
          // Log this moderation action for monitoring
          await logInfo(
            "Event auto-moderated due to offensive content",
            "PUT /api/events/:id",
            {
              userId,
              eventId: req.params.id,
              metadata: {
                eventName: event.name,
                triggeredFields: moderationField,
                action: "auto-set-private",
              },
            },
          );
        }

        // Remove name, earlyValidation, re-entry, and golden ticket fields to prevent them from being updated
        delete updateData.name;
        delete updateData.earlyValidation;
        delete updateData.reentryType;
        delete updateData.maxUses;
        delete updateData.goldenTicketEnabled;
        delete updateData.goldenTicketNumber;

        // If event has rolling timezone enabled, prevent timezone and rolling timezone changes
        if (event.rollingTimezone) {
          delete updateData.timezone;
          delete updateData.rollingTimezone;
        }

        // Handle payment processing updates
        let paymentFeeAdjustment = 0;
        if (event.walletAddress) {
          // If wallet address is already set, prevent changes to payment configuration
          delete updateData.paymentProcessing;
          delete updateData.walletAddress;
        } else if (updateData.paymentProcessing && updateData.walletAddress) {
          // If setting up payment processing for the first time
          const oldFee = event.paymentProcessingFee || 0;
          let newFee = 0;

          if (
            updateData.ticketPrice > 0 &&
            updateData.paymentProcessing !== "None"
          ) {
            if (
              updateData.paymentProcessing === "Ethereum" ||
              updateData.paymentProcessing === "Bitcoin"
            ) {
              newFee = 100;
            } else if (updateData.paymentProcessing === "USDC") {
              newFee = 50;
            }
          }

          paymentFeeAdjustment = newFee - oldFee;
          updateData.paymentProcessingFee = newFee;
        }

        // Validate maxTickets if provided
        if (
          updateData.maxTickets !== undefined &&
          updateData.maxTickets !== null
        ) {
          const newMaxTickets = parseInt(updateData.maxTickets);
          if (newMaxTickets < ticketsSold) {
            return res.status(400).json({
              message: `Cannot set maximum tickets below ${ticketsSold} (tickets already sold)`,
            });
          }
          if (newMaxTickets > 5000) {
            return res.status(400).json({
              message: "Maximum tickets cannot exceed 5,000",
            });
          }

          // Calculate if user needs to pay additional tickets for maxTickets increase
          const oldMaxTickets = event.maxTickets || 0;
          const ticketDifference = newMaxTickets - oldMaxTickets;
          const totalTicketsRequired = ticketDifference + paymentFeeAdjustment;

          if (userId && totalTicketsRequired > 0) {
            const userBalance = await storage.getUserBalance(userId);
            const balance = parseInt(userBalance?.balance || "0");
            if (balance < totalTicketsRequired) {
              return res.status(400).json({
                message: `Insufficient tickets. You need ${totalTicketsRequired} additional tickets${paymentFeeAdjustment > 0 ? ` (${ticketDifference} for capacity increase + ${paymentFeeAdjustment} for payment processing)` : ""}, but only have ${balance}.`,
              });
            }

            // Deduct tickets from user balance
            await storage.debitUserAccount(
              userId,
              totalTicketsRequired,
              "Event Update",
              { eventId: req.params.id },
            );
          }
        } else if (paymentFeeAdjustment > 0) {
          // If only adding payment processing without changing maxTickets
          if (userId) {
            const userBalance = await storage.getUserBalance(userId);
            const balance = parseInt(userBalance?.balance || "0");
            if (balance < paymentFeeAdjustment) {
              return res.status(400).json({
                message: `Insufficient tickets. You need ${paymentFeeAdjustment} tickets for payment processing setup, but only have ${balance}.`,
              });
            }

            // Deduct payment fee from user balance
            await storage.debitUserAccount(
              userId,
              paymentFeeAdjustment,
              "Payment Processing Fee",
              { eventId: req.params.id },
            );
          }
        }

        if (
          updateData.imageUrl &&
          updateData.imageUrl.startsWith("https://storage.googleapis.com/")
        ) {
          updateData.imageUrl = objectStorageService.normalizeObjectEntityPath(
            updateData.imageUrl,
          );
        }
        if (
          updateData.ticketBackgroundUrl &&
          updateData.ticketBackgroundUrl.startsWith(
            "https://storage.googleapis.com/",
          )
        ) {
          updateData.ticketBackgroundUrl =
            objectStorageService.normalizeObjectEntityPath(
              updateData.ticketBackgroundUrl,
            );
        }
        if (
          updateData.stickerUrl &&
          updateData.stickerUrl.startsWith("https://storage.googleapis.com/")
        ) {
          updateData.stickerUrl =
            objectStorageService.normalizeObjectEntityPath(
              updateData.stickerUrl,
            );
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
          earlyValidation: z
            .enum([
              "At Start Time",
              "One Hour Before",
              "Two Hours Before",
              "Allow at Anytime",
            ])
            .optional(),
          reentryType: z
            .enum([
              "No Reentry (Single Use)",
              "Pass (Multiple Use)",
              "No Limit",
            ])
            .optional(),
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

        // Extract hashtags from description if it's being updated (now plain text)
        let hashtags: string[] | undefined;
        if (validatedData.description !== undefined) {
          hashtags = [];
          if (validatedData.description) {
            // Extract hashtags directly from plain text
            const matches = validatedData.description.match(/#[a-zA-Z0-9_]+/g);
            if (matches) {
              // Remove the # and store unique hashtags
              const uniqueTags = Array.from(
                new Set(
                  matches.map((tag: string) => tag.substring(1).toLowerCase()),
                ),
              );
              hashtags.push(...uniqueTags);
            }
          }
        }

        // Recompute UTC timestamps if date/time/timezone changed (unless it's a rolling timezone event)
        let startAtUtc: Date | undefined;
        let endAtUtc: Date | undefined;

        if (!event.rollingTimezone) {
          const timezone =
            validatedData.timezone || event.timezone || "America/New_York";
          const eventDate = validatedData.date || event.date;
          const eventTime = validatedData.time || event.time;

          // If any date/time/timezone field changed, recompute UTC timestamps
          if (
            validatedData.date ||
            validatedData.time ||
            validatedData.timezone
          ) {
            startAtUtc = convertEventTimeToUtc(eventDate, eventTime, timezone);
          }

          // Handle end date/time updates
          const eventEndDate =
            validatedData.endDate !== undefined
              ? validatedData.endDate
              : event.endDate;
          const eventEndTime =
            validatedData.endTime !== undefined
              ? validatedData.endTime
              : event.endTime;

          if (eventEndDate && eventEndTime) {
            // If any end date/time/timezone field changed, recompute end UTC
            if (
              validatedData.endDate !== undefined ||
              validatedData.endTime !== undefined ||
              validatedData.timezone
            ) {
              endAtUtc = convertEventTimeToUtc(
                eventEndDate,
                eventEndTime,
                timezone,
              );
            }
          } else {
            // If end date/time was cleared, set endAtUtc to undefined (will be null in DB)
            endAtUtc = undefined;
          }
        }

        const updatedEvent = await storage.updateEvent(req.params.id, {
          ...validatedData,
          ...(hashtags !== undefined && { hashtags }),
          ...(startAtUtc !== undefined && { startAtUtc }),
          ...(endAtUtc !== undefined && { endAtUtc }),
        });

        // Send notifications to all ticket holders
        if (updatedEvent) {
          try {
            const ticketHolders = await storage.getUniqueTicketHolders(
              req.params.id,
            );

            // Create notifications for each ticket holder
            const notifications = ticketHolders.map(async (ticketHolderId) => {
              if (ticketHolderId !== userId) {
                // Don't notify the event owner
                await storage.createNotification({
                  userId: ticketHolderId,
                  type: "event",
                  title: "Event Updated",
                  description: `The event "${updatedEvent.name}" has been updated by the organizer. View at /events/${updatedEvent.id}`,
                });
              }
            });

            await Promise.all(notifications);
          } catch (notificationError) {
            // Log the error but don't fail the event update
            console.error("Failed to send notifications:", notificationError);
          }
        }

        res.json(updatedEvent);
      } catch (error) {
        if (error instanceof z.ZodError) {
          return res
            .status(400)
            .json({ message: "Invalid event data", errors: error.errors });
        }
        res.status(500).json({ message: "Failed to update event" });
      }
    },
  );

  app.delete(
    "/api/events/:id",
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
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
          return res
            .status(403)
            .json({ message: "You can only delete your own events" });
        }

        const deleted = await storage.deleteEvent(req.params.id);
        res.status(204).send();
      } catch (error) {
        res.status(500).json({ message: "Failed to delete event" });
      }
    },
  );

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

  app.get(
    "/api/events/:eventId/user-tickets",
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const userId = extractUserId(req);
        if (!userId) {
          return res.json([]);
        }
        const tickets = await storage.getTicketsByEventAndUser(
          req.params.eventId,
          userId,
        );
        res.json(tickets);
      } catch (error) {
        res
          .status(500)
          .json({ message: "Failed to fetch user tickets for event" });
      }
    },
  );

  app.get("/api/events/:eventId/tickets", async (req, res) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;

      if (req.query.page) {
        const result = await storage.getTicketsByEventIdPaginated(
          req.params.eventId,
          { page, limit },
        );
        res.json(result);
      } else {
        const tickets = await storage.getTicketsByEventId(req.params.eventId);
        res.json(tickets);
      }
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch event tickets" });
    }
  });

  app.post(
    "/api/events/:eventId/tickets",
    purchaseRateLimiter,
    validateBody(insertTicketSchema.partial()),
    async (req: AuthenticatedRequest, res) => {
      const userId = extractUserId(req);
      const userEmail = extractUserEmail(req);
      const userIp = req.ip || req.connection.remoteAddress || "unknown";

      try {
        const event = await storage.getEvent(req.params.eventId);
        if (!event) {
          return res.status(404).json({ message: "Event not found" });
        }

        // Check if ticket purchases are enabled
        if (!event.ticketPurchasesEnabled) {
          return res.status(400).json({
            message:
              "Ticket sales are currently disabled for this event. Resale tickets may still be available.",
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
                  message:
                    "Cannot purchase tickets for past events. This event ended on " +
                    endDate.toLocaleDateString(),
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
            const [year, month, day] = event.date.split("-").map(Number);
            const [hours, minutes] = event.time.split(":").map(Number);
            const eventDateTime = new Date(
              year,
              month - 1,
              day,
              hours,
              minutes,
            );

            // Allow purchasing tickets up until 24 hours after the event starts
            const twentyFourHoursAfterEvent = new Date(
              eventDateTime.getTime() + 24 * 60 * 60 * 1000,
            );

            if (
              !isNaN(eventDateTime.getTime()) &&
              now > twentyFourHoursAfterEvent
            ) {
              return res.status(400).json({
                message:
                  "Cannot purchase tickets for past events. This event started more than 24 hours ago.",
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
            userId || "",
            userEmail || "",
            userIp,
          );

          if (hasTicket) {
            return res.status(400).json({
              message:
                "You have already purchased a ticket for this event. This event is limited to one ticket per person.",
            });
          }
        }

        // First, check if there are any resell tickets available
        const resellTicket = await storage.processResellPurchase(
          req.params.eventId,
          userId || "",
          userEmail || "",
          userIp,
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
                purchaseTime: new Date().toISOString(),
              },
            },
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
          metadata: { eventId: req.params.eventId },
        });
        res.status(500).json({ message: "Failed to create ticket" });
      }
    },
  );

  // Charge ticket endpoint (requires 3 tickets to charge one)
  app.post(
    "/api/tickets/:ticketId/charge",
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const userId = extractUserId(req);
        if (!userId) {
          return res.status(401).json({ message: "Unauthorized" });
        }

        const { ticketId } = req.params;

        // Attempt to charge the ticket
        const success = await storage.chargeTicket(ticketId, userId);

        if (!success) {
          return res.status(400).json({
            message:
              "Cannot charge this ticket. You need at least 3 credits, and the event must have special effects or stickers enabled.",
          });
        }

        res.json({
          success: true,
          message:
            "Ticket charged successfully! Special effects odds have been improved.",
        });
      } catch (error) {
        await logError(error, "POST /api/tickets/:ticketId/charge", {
          request: req,
          metadata: { ticketId: req.params.ticketId },
        });
        res.status(500).json({ message: "Failed to charge ticket" });
      }
    },
  );

  // Expand event tickets endpoint (add 5 tickets for 5 credits)
  app.post(
    "/api/events/:eventId/expand",
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const userId = extractUserId(req);
        if (!userId) {
          return res.status(401).json({ message: "Unauthorized" });
        }

        const { eventId } = req.params;

        // Get the event to verify it exists and user is the owner
        const event = await storage.getEvent(eventId);
        if (!event) {
          return res.status(404).json({ message: "Event not found" });
        }

        if (event.userId !== userId) {
          return res
            .status(403)
            .json({ message: "Only the event owner can expand tickets" });
        }

        // Check if event has already started (no expansion after start)
        const now = new Date();
        const [year, month, day] = event.date.split("-").map(Number);
        const [hours, minutes] = event.time.split(":").map(Number);
        const eventStartTime = new Date(year, month - 1, day, hours, minutes);

        if (now >= eventStartTime) {
          return res
            .status(400)
            .json({
              message: "Cannot expand tickets after the event has started",
            });
        }

        // Check user's credit balance
        const balance = await storage.getUserBalance(userId);
        if (!balance || parseFloat(balance.balance) < 5) {
          return res
            .status(400)
            .json({
              message:
                "Insufficient credits. You need 5 credits to expand tickets.",
            });
        }

        // Deduct 5 credits from user's balance
        const deducted = await storage.debitUserAccount(
          userId,
          5,
          `Expanded tickets for event: ${event.name}`,
        );
        if (!deducted) {
          return res.status(400).json({ message: "Failed to deduct credits" });
        }

        // Update the event's maxTickets (add 5)
        const currentMaxTickets = event.maxTickets || 0;
        const newMaxTickets = currentMaxTickets + 5;

        await storage.updateEventMaxTickets(eventId, newMaxTickets);

        // Create a notification for the user
        await storage.createNotification({
          userId,
          type: "success",
          title: "Tickets Expanded",
          description: `5 additional tickets have been added to "${event.name}". Total capacity is now ${newMaxTickets}.`,
        });

        // Log the expansion
        await logInfo(
          "Event tickets expanded",
          "POST /api/events/:eventId/expand",
          {
            userId,
            eventId,
            metadata: {
              previousCapacity: currentMaxTickets,
              newCapacity: newMaxTickets,
              creditsSpent: 5,
            },
          },
        );

        res.json({
          success: true,
          message: "Tickets expanded successfully",
          newMaxTickets,
          creditsSpent: 5,
        });
      } catch (error) {
        await logError(error, "POST /api/events/:eventId/expand", {
          request: req,
          metadata: { eventId: req.params.eventId },
        });
        res.status(500).json({ message: "Failed to expand tickets" });
      }
    },
  );

  // Resell ticket endpoint
  app.post(
    "/api/tickets/:ticketId/resell",
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const userId = extractUserId(req);
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
          return res
            .status(403)
            .json({ message: "You can only return your own tickets" });
        }

        // Check if ticket has been validated
        if (ticket.isValidated) {
          return res
            .status(400)
            .json({ message: "Cannot return a validated ticket" });
        }

        // Check if already for resale
        if (ticket.resellStatus === "for_resale") {
          return res
            .status(400)
            .json({ message: "Ticket is already returned" });
        }

        // Get the event to check timing
        const event = await storage.getEvent(ticket.eventId);
        if (!event) {
          return res.status(404).json({ message: "Event not found" });
        }

        // Check if event start is at least 1 hour in the future
        const eventStartTime = new Date(`${event.date}T${event.time}:00`);
        const now = new Date();
        const hoursUntilEvent =
          (eventStartTime.getTime() - now.getTime()) / (1000 * 60 * 60);

        if (hoursUntilEvent < 1) {
          return res.status(400).json({
            message:
              "Returns are only available until 1 hour before the event starts",
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
          description: `Your ticket for "${event.name}" has been returned and is now available for others.`,
        });

        // Log the resell listing
        await logInfo("Ticket returned", "POST /api/tickets/:ticketId/resell", {
          userId,
          ticketId,
          eventId: ticket.eventId,
          metadata: {
            ticketNumber: ticket.ticketNumber,
            eventName: event.name,
            resellTime: new Date().toISOString(),
          },
        });

        res.json({
          message: "Ticket returned successfully",
          resold: true,
        });
      } catch (error) {
        await logError(error, "POST /api/tickets/:ticketId/resell", {
          request: req,
          metadata: { ticketId: req.params.ticketId },
        });
        res.status(500).json({ message: "Failed to return ticket" });
      }
    },
  );

  // Helper function to calculate distance between two GPS coordinates in meters
  function calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number {
    const R = 6371000; // Earth's radius in meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance in meters
  }

  // Helper function to get approximate country from GPS coordinates
  // This is a simplified approach using coordinate ranges
  function getCountryFromCoordinates(lat: number, lon: number): string | undefined {
    // USA (approximate boundaries)
    if (lat >= 24.5 && lat <= 49.4 && lon >= -125 && lon <= -66.9) {
      return "United States";
    }
    // Canada
    if (lat >= 41.7 && lat <= 83.1 && lon >= -141 && lon <= -52.6) {
      return "Canada";
    }
    // Mexico
    if (lat >= 14.5 && lat <= 32.7 && lon >= -118.5 && lon <= -86.7) {
      return "Mexico";
    }
    // United Kingdom
    if (lat >= 49.9 && lat <= 60.9 && lon >= -8.6 && lon <= 1.8) {
      return "United Kingdom";
    }
    // France
    if (lat >= 41.3 && lat <= 51.1 && lon >= -5.1 && lon <= 9.6) {
      return "France";
    }
    // Germany
    if (lat >= 47.3 && lat <= 55.1 && lon >= 5.9 && lon <= 15.0) {
      return "Germany";
    }
    // Australia
    if (lat >= -43.6 && lat <= -10.7 && lon >= 113.3 && lon <= 153.6) {
      return "Australia";
    }
    // Japan
    if (lat >= 24.4 && lat <= 45.5 && lon >= 122.9 && lon <= 153.9) {
      return "Japan";
    }
    // Brazil
    if (lat >= -33.8 && lat <= 5.3 && lon >= -73.9 && lon <= -34.8) {
      return "Brazil";
    }
    // India
    if (lat >= 8.1 && lat <= 37.1 && lon >= 68.2 && lon <= 97.4) {
      return "India";
    }
    // China
    if (lat >= 18.2 && lat <= 53.6 && lon >= 73.6 && lon <= 134.8) {
      return "China";
    }
    // South Africa
    if (lat >= -34.8 && lat <= -22.1 && lon >= 16.5 && lon <= 32.9) {
      return "South Africa";
    }
    // Spain
    if (lat >= 35.9 && lat <= 43.8 && lon >= -9.3 && lon <= 4.3) {
      return "Spain";
    }
    // Italy
    if (lat >= 35.5 && lat <= 47.1 && lon >= 6.6 && lon <= 18.5) {
      return "Italy";
    }
    // Netherlands
    if (lat >= 50.8 && lat <= 53.5 && lon >= 3.4 && lon <= 7.2) {
      return "Netherlands";
    }
    
    // Return undefined if country cannot be determined
    return undefined;
  }

  // Hunt validation endpoint
  // Get event by hunt code (for redirects)
  app.get("/api/hunt/:huntCode/event", async (req, res) => {
    try {
      const { huntCode } = req.params;

      // Get event by hunt code (no GPS optimization needed for GET request)
      const event = await storage.getEventByHuntCode(huntCode);
      if (!event || !event.treasureHunt) {
        return res.status(404).json({ message: "Hunt code not found" });
      }

      res.json(event);
    } catch (error) {
      console.error("Hunt code lookup error:", error);
      res.status(500).json({ message: "Error looking up Hunt code" });
    }
  });

  // Check if Hunt code is valid (without GPS)
  app.post(
    "/api/hunt/validate",
    requireAuth,
    huntRedemptionRateLimiter,
    async (req: AuthenticatedRequest, res) => {
      try {
        const { code } = req.body;
        const userId = extractUserId(req);

        if (!userId) {
          return res.status(401).json({
            valid: false,
            message: "Login required",
          });
        }

        if (!code) {
          return res.status(400).json({
            valid: false,
            message: "Code is required",
          });
        }

        // Check if this looks like a Hunt code pattern
        const huntPattern = /^[A-Z][a-z0-9]+[A-Z][a-z0-9]+$/i;
        if (!huntPattern.test(code.trim())) {
          return res.json({
            valid: false,
            isHuntCode: false,
            message: "Invalid code format",
          });
        }

        // Try to get country from GPS if available for optimization
        let country: string | undefined;
        if (req.body.lat && req.body.lon) {
          country = getCountryFromCoordinates(req.body.lat, req.body.lon);
        }
        
        // Lookup event by hunt code, using country filter if available
        const event = await storage.getEventByHuntCode(code.trim(), country);
        if (!event || !event.treasureHunt) {
          return res.json({
            valid: false,
            message: "Invalid code - Try again",
          });
        }

        // Check if user already has a ticket
        const existingTickets = await storage.getTicketsByEventAndUser(
          event.id,
          userId,
        );
        if (existingTickets.length > 0) {
          return res.json({
            valid: false,
            message: "You've already claimed this code",
            alreadyClaimed: true,
          });
        }

        // Check ticket availability
        const ticketCount = await storage.getTotalTicketCountForEvent(event.id);
        if (event.maxTickets && ticketCount >= event.maxTickets) {
          return res.json({
            valid: false,
            message: "Sorry, no tickets are available.",
            soldOut: true,
          });
        }

        // Check if event timing is valid
        const timeCheck = isTicketWithinValidTime(event);
        if (!timeCheck.valid) {
          return res.json({
            valid: false,
            message: timeCheck.message || "Event hasn't started yet",
            notInTimeWindow: true,
          });
        }

        // Event requires location
        if (!event.latitude || !event.longitude) {
          return res.json({
            valid: false,
            message: "This event event doesn't have a location set.",
            noLocation: true,
          });
        }

        // Code is valid and can be redeemed!
        res.json({
          valid: true,
          message: "Please allow location access.",
          eventName: event.name,
          requiresLocation: true,
        });
      } catch (error) {
        console.error("Hunt code validation error:", error);
        res.status(500).json({
          valid: false,
          message: "Error validating code",
        });
      }
    },
  );

  // New Hunt Code Redemption endpoint
  app.post(
    "/api/hunt/redeem",
    requireAuth,
    huntRedemptionRateLimiter,
    async (req: AuthenticatedRequest, res) => {
      try {
        const { code, lat, lon } = req.body;
        const userId = extractUserId(req);
        const userEmail = extractUserEmail(req);
        const userIp = req.ip || "unknown";

        if (!userId || !userEmail) {
          return res.status(401).json({
            success: false,
            message: "Login required to redeem secret codes",
          });
        }

        if (!code) {
          return res.status(400).json({
            success: false,
            message: "Secret code is required :)",
          });
        }

        // Get country from GPS coordinates for optimized lookup
        const country = getCountryFromCoordinates(lat, lon);
        
        // Lookup event by hunt code with country filter
        const event = await storage.getEventByHuntCode(code.trim(), country);
        if (!event || !event.treasureHunt) {
          return res.status(404).json({
            success: false,
            message: "Invalid code",
          });
        }

        // Check if user already redeemed this Hunt code by checking if they have a ticket
        const existingRedeemedTickets = await storage.getTicketsByEventAndUser(
          event.id,
          userId,
        );
        const hasRedeemed = existingRedeemedTickets.some(t => t.ticketType === 'hunt');
        if (hasRedeemed) {
          return res.status(400).json({
            success: false,
            message: "You've already redeemed this code",
          });
        }

        // Check if location is provided
        if (!lat || !lon) {
          return res.status(400).json({
            success: false,
            message: "Location required",
            requiresLocation: true,
          });
        }

        // Check geofence - Hunt always requires being within 300m
        if (event.latitude && event.longitude) {
          const distance = calculateDistance(
            Number(event.latitude),
            Number(event.longitude),
            lat,
            lon,
          );

          if (distance > 300) {
            return res.status(400).json({
              success: false,
              message: `You're too far from the event (must be within 300m), and you're ${Math.round(distance)}m away!`,
              outsideGeofence: true,
              distance: Math.round(distance),
            });
          }
        } else {
          // Event doesn't have location set
          return res.status(400).json({
            success: false,
            message: "This event doesn't have a location configured.",
          });
        }

        // Check if event timing is valid
        const timeCheck = isTicketWithinValidTime(event);
        if (!timeCheck.valid) {
          return res.status(400).json({
            success: false,
            message: timeCheck.message || "Event hasn't started yet",
          });
        }

        // Check if user already has a ticket for this event
        const existingTickets = await storage.getTicketsByEventAndUser(
          event.id,
          userId,
        );

        if (existingTickets.length > 0) {
          // User already has a ticket - validate it if not already validated
          const ticket = existingTickets[0];
          if (ticket.isValidated) {
            return res.json({
              success: true,
              message: "You've already completed this!",
              alreadyValidated: true,
              ticket,
            });
          }

          // Validate the existing ticket
          const validatedTicket = await storage.validateTicket(ticket.id);

          // Hunt code redemption is tracked via the ticket itself

          await logInfo("Secret code claimed (ticket validated)", req.path, {
            userId,
            eventId: event.id,
            ticketId: ticket.id,
            metadata: { huntCode: code },
          });

          return res.json({
            success: true,
            message: "Event completed! Your ticket has been validated!",
            ticket: validatedTicket,
          });
        }

        // Check ticket availability
        const ticketCount = await storage.getTotalTicketCountForEvent(event.id);
        if (event.maxTickets && ticketCount >= event.maxTickets) {
          return res.status(400).json({
            success: false,
            message: "No tickets available for this event",
          });
        }

        // Create a new free ticket for the Hunt
        const qrData = randomUUID();
        const validationCode = randomUUID().slice(0, 8).toUpperCase();

        // Get user info for ticket number
        const user = await storage.getUser(userId);
        const username =
          user?.displayName || userEmail?.split("@")[0] || "hunter";

        // Use the total ticket count for this event to generate the ticket number
        // This shows the order in which people completed the Hunt
        const ticketSequence = String(ticketCount + 1).padStart(3, "0");

        const newTicket = await storage.createTicket({
          eventId: event.id,
          userId,
          ticketNumber: `${event.huntCode}-${username}-${ticketSequence}`,
          qrData,
          validationCode,
          recipientName: userEmail?.split("@")[0] || "Hunter",
          recipientEmail: userEmail || "",
          ticketType: "hunt",
          purchaserIp: userIp,
          status: "sent",
          transferable: false,
        });

        // Immediately validate the ticket
        const validatedTicket = await storage.validateTicket(newTicket.id);

        // Hunt code redemption is tracked via the ticket itself

        await logInfo("Secret code redeemed (new ticket)", req.path, {
          userId,
          eventId: event.id,
          ticketId: newTicket.id,
          metadata: { huntCode: code },
        });

        return res.json({
          success: true,
          message: "Event completed! Ticket created and validated!",
          ticket: validatedTicket,
          newTicket: true,
        });
      } catch (error) {
        await logError("Secret code redemption error", req.path, {
          userId: req.user?.id,
          metadata: {
            error: error instanceof Error ? error.message : "Unknown error",
            code: req.body.code,
          },
        });

        console.error("Hunt redemption error:", error);
        res.status(500).json({
          success: false,
          message: "Error redeeming secret code",
        });
      }
    },
  );

  app.post(
    "/api/hunt/:huntCode/validate",
    async (req: AuthenticatedRequest, res) => {
      try {
        const { huntCode } = req.params;
        const { latitude, longitude } = req.body;
        const userId = extractUserId(req);
        const userEmail = extractUserEmail(req);

        if (!userId || !userEmail) {
          return res.status(401).json({
            message: "Login required to validate URL",
            valid: false,
            requiresAuth: true,
          });
        }

        // Get event by hunt code
        const event = await storage.getEventByHuntCode(huntCode);
        if (!event || !event.treasureHunt) {
          return res.status(404).json({
            message: "Invalid URL",
            valid: false,
          });
        }

        // Check if user has a ticket for this event
        const tickets = await storage.getTicketsByEventAndUser(
          event.id,
          userId,
        );
        if (tickets.length === 0) {
          return res.status(403).json({
            message: "You need a ticket for this event to validate the URL",
            valid: false,
            needsTicket: true,
            event,
          });
        }

        // Check if location is provided
        if (!latitude || !longitude) {
          return res.status(400).json({
            message: "GPS location required for validation",
            valid: false,
            requiresLocation: true,
            event,
          });
        }

        // Check geofence - Hunt always requires being within the geofence
        if (event.latitude && event.longitude) {
          const distance = calculateDistance(
            Number(event.latitude),
            Number(event.longitude),
            latitude,
            longitude,
          );

          // Must be within 300 meters
          if (distance > 300) {
            return res.status(400).json({
              message: `You must be within 300 meters, You are ${Math.round(distance)}m away`,
              valid: false,
              outsideGeofence: true,
              distance: Math.round(distance),
              event,
            });
          }
        }

        // Check if ticket is within valid time window
        const timeCheck = isTicketWithinValidTime(event);
        if (!timeCheck.valid) {
          return res.status(400).json({
            message: timeCheck.message,
            valid: false,
            outsideValidTime: true,
            event,
          });
        }

        // Find the first non-validated ticket for the user
        const validTicket = tickets.find((t) => !t.isValidated);
        if (!validTicket) {
          return res.json({
            message: "All your tickets for this event are already validated",
            valid: false,
            alreadyValidated: true,
            event,
          });
        }

        // Validate the ticket
        const validatedTicket = await storage.validateTicket(validTicket.id);

        return res.json({
          message: "Event completed! Your ticket has been validated",
          valid: true,
          huntSuccess: true,
          ticket: validatedTicket,
          event,
        });
      } catch (error) {
        await logError(
          error,
          `POST /api/hunt/${req.params.huntCode}/validate`,
          {
            request: req,
            metadata: { huntCode: req.params.huntCode },
          },
        );
        console.error("Hunt validation error:", error);
        res.status(500).json({
          message: "Error validating URL",
          valid: false,
        });
      }
    },
  );

  // Validation routes
  app.post(
    "/api/validate",
    validationRateLimiter,
    async (req: AuthenticatedRequest, res) => {
      const { validateCodeInstant, queueValidation, preloadP2PEventCodes } =
        await import("./codePoolManager");

      try {
        const {
          qrData,
          validatorLat,
          validatorLng,
          ticketHolderLat,
          ticketHolderLng,
        } = req.body;
        if (!qrData) {
          return res.status(400).json({ message: "QR data is required" });
        }

        const userId = extractUserId(req);
        const userEmail = extractUserEmail(req);

        // For 4-digit codes (with or without suffix), try memory-first validation for P2P events
        if (/^\d{4}[SPU]?$/.test(qrData)) {
          // Strip any suffix (S, P, U) for processing but search with original code
          const cleanCode = qrData.replace(/[SPU]$/, "");

          // Try to find which event this code belongs to by checking all tickets
          const ticket = await storage.getTicketByValidationCode(qrData);
          if (ticket) {
            const event = await storage.getEvent(ticket.eventId);
            if (event && event.p2pValidation) {
              // Ensure P2P event is preloaded
              preloadP2PEventCodes(event.id);

              // Use instant memory validation with clean code
              const isValid = validateCodeInstant(event.id, cleanCode);
              if (isValid) {
                // Queue the database update for later
                queueValidation(ticket.id, userId || undefined);

                // Return instant success
                return res.json({
                  message: "Ticket validated successfully (P2P)",
                  valid: true,
                  canValidate: true,
                  ticket,
                  event,
                  instant: true,
                });
              }
            }
          }
        }

        // Fall back to original validation logic for non-P2P or non-4-digit codes
        const tokenCheck = await storage.checkDynamicToken(qrData);

        if (tokenCheck.valid && tokenCheck.ticketId) {
          const ticket = await storage.getTicket(tokenCheck.ticketId);
          if (!ticket) {
            return res.status(404).json({
              message: "Invalid ticket",
              valid: false,
            });
          }
          const event = await storage.getEvent(ticket.eventId);
          if (!event) {
            return res.status(404).json({
              message: "Event not found",
              valid: false,
            });
          }

          // Check geofence if enabled
          if (event.geofence && event.latitude && event.longitude) {
            // Use ticket holder location from session if not provided directly
            const finalTicketHolderLat =
              ticketHolderLat || tokenCheck.ticketHolderLat;
            const finalTicketHolderLng =
              ticketHolderLng || tokenCheck.ticketHolderLng;

            // Check if location data was provided
            if (
              !validatorLat ||
              !validatorLng ||
              !finalTicketHolderLat ||
              !finalTicketHolderLng
            ) {
              return res.status(400).json({
                message: "Location required for this event",
                valid: false,
                requiresLocation: true,
                event,
              });
            }

            // Check validator's distance from event
            const validatorDistance = calculateDistance(
              Number(event.latitude),
              Number(event.longitude),
              validatorLat,
              validatorLng,
            );

            // Check ticket holder's distance from event (using location from session or provided)
            const ticketHolderDistance = calculateDistance(
              Number(event.latitude),
              Number(event.longitude),
              finalTicketHolderLat,
              finalTicketHolderLng,
            );

            // Log the validation distances
            console.log(`[GEOFENCE] Validation attempt for ${event.name}:`);
            console.log(
              `  Event location: ${event.latitude}, ${event.longitude}`,
            );
            console.log(
              `  Ticket holder: ${finalTicketHolderLat}, ${finalTicketHolderLng} (${Math.round(ticketHolderDistance)}m away)`,
            );
            console.log(
              `  Validator: ${validatorLat}, ${validatorLng} (${Math.round(validatorDistance)}m away)`,
            );

            // Both must be within 300 meters
            if (validatorDistance > 300 || ticketHolderDistance > 300) {
              return res.status(400).json({
                message: `Must be within 300 meters of venue to validate. Validator: ${Math.round(validatorDistance)}m away, Ticket holder: ${Math.round(ticketHolderDistance)}m away`,
                valid: false,
                outsideGeofence: true,
                validatorDistance: Math.round(validatorDistance),
                ticketHolderDistance: Math.round(ticketHolderDistance),
                event,
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
              event,
            });
          }

          // Check if user is authorized to validate for this event
          const canValidate =
            userId && userEmail
              ? await storage.canUserValidateForEvent(
                  userId,
                  userEmail,
                  event.id,
                )
              : false;

          if (canValidate) {
            // User is authorized - perform actual validation
            const validation = await storage.validateDynamicToken(
              qrData,
              userId || "",
            );
            if (validation.valid) {
              return res.json({
                message: "Ticket validated successfully",
                valid: true,
                canValidate: true,
                ticket,
                event,
              });
            }
          } else {
            // User not authorized - just verify authenticity
            return res.json({
              message:
                "Ticket is authentic but you are not authorized to validate it",
              valid: true,
              canValidate: false,
              isAuthentic: true,
              ticket: { ...ticket, isValidated: ticket.isValidated },
              event,
            });
          }
        }

        // Otherwise try to validate as a regular ticket QR code
        const ticket = await storage.getTicketByQrData(qrData);
        if (!ticket) {
          return res.status(404).json({
            message: "Invalid ticket",
            valid: false,
          });
        }

        const event = await storage.getEvent(ticket.eventId);
        if (!event) {
          return res.status(404).json({
            message: "Event not found",
            valid: false,
          });
        }

        // Check geofence if enabled
        if (event.geofence && event.latitude && event.longitude) {
          // Check if location data was provided
          if (
            !validatorLat ||
            !validatorLng ||
            !ticketHolderLat ||
            !ticketHolderLng
          ) {
            return res.status(400).json({
              message: "Location required for this event",
              valid: false,
              requiresLocation: true,
              event,
            });
          }

          // Check validator's distance from event
          const validatorDistance = calculateDistance(
            Number(event.latitude),
            Number(event.longitude),
            validatorLat,
            validatorLng,
          );

          // Check ticket holder's distance from event
          const ticketHolderDistance = calculateDistance(
            Number(event.latitude),
            Number(event.longitude),
            ticketHolderLat,
            ticketHolderLng,
          );

          // Both must be within 300 meters
          if (validatorDistance > 300 || ticketHolderDistance > 300) {
            return res.status(400).json({
              message: `Must be within 300 meters of venue to validate. Validator: ${Math.round(validatorDistance)}m away, Ticket holder: ${Math.round(ticketHolderDistance)}m away`,
              valid: false,
              outsideGeofence: true,
              validatorDistance: Math.round(validatorDistance),
              ticketHolderDistance: Math.round(ticketHolderDistance),
              event,
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
            event,
          });
        }

        // Check if user is authorized to validate for this event
        const canValidate =
          userId && userEmail
            ? await storage.canUserValidateForEvent(userId, userEmail, event.id)
            : false;

        if (ticket.isValidated) {
          return res.json({
            message: "Ticket already validated",
            valid: false,
            canValidate,
            isAuthentic: true,
            alreadyValidated: true,
            ticket,
            event,
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
            event,
          });
        } else {
          // User not authorized - just verify authenticity
          return res.json({
            message:
              "Ticket is authentic but you are not authorized to validate it",
            valid: true,
            canValidate: false,
            isAuthentic: true,
            ticket: { ...ticket, isValidated: ticket.isValidated },
            event,
          });
        }
      } catch (error) {
        await logError(error, "POST /api/validate", {
          request: req,
          metadata: { qrData: req.body.qrData },
        });
        res.status(500).json({ message: "Failed to validate ticket" });
      }
    },
  );

  // P2P Validation route for voting
  app.post(
    "/api/validate/p2p",
    requireAuth,
    validationRateLimiter,
    async (req: AuthenticatedRequest, res) => {
      try {
        const { validationCode, eventId } = req.body;
        if (!validationCode) {
          return res
            .status(400)
            .json({ message: "Validation code is required" });
        }

        const userId = extractUserId(req);
        const userEmail = extractUserEmail(req);
        if (!userId || !userEmail) {
          return res
            .status(401)
            .json({ message: "Authentication required for P2P validation" });
        }

        // Get the ticket by validation code
        const ticket = await storage.getTicketByValidationCode(
          validationCode.toUpperCase(),
        );
        if (!ticket) {
          return res.status(404).json({
            message: "Invalid validation code",
            valid: false,
          });
        }

        const event = await storage.getEvent(ticket.eventId);
        if (!event) {
          return res.status(404).json({
            message: "Event not found",
            valid: false,
          });
        }

        // Check if event has P2P validation enabled (voting)
        if (!event.p2pValidation && !event.enableVoting) {
          return res.status(403).json({
            message: "P2P validation not enabled for this event",
            valid: false,
          });
        }

        // Check if the validator has a ticket for this event
        const validatorTickets = await storage.getTicketsByEventAndUser(
          event.id,
          userId,
        );
        const validatorHasTicket = validatorTickets.some((t) => t.isValidated);

        if (!validatorHasTicket) {
          return res.status(403).json({
            message:
              "You need a validated ticket for this event to use P2P validation",
            valid: false,
          });
        }

        // Don't allow self-validation
        if (ticket.userId === userId) {
          return res.status(400).json({
            message: event.enableVoting
              ? "You cannot vote for your own ticket"
              : "You cannot validate your own ticket",
            valid: false,
          });
        }

        // Check if ticket hasn't been validated yet
        if (!ticket.isValidated) {
          return res.status(400).json({
            message:
              "This ticket needs to be validated first before it can receive votes",
            valid: false,
          });
        }

        // Check if ticket has already been validated by this user
        // (We could track this more specifically if needed)

        // Submit the vote (this will increment voteCount for voting-enabled events)
        const validatedTicket = await storage.validateTicket(
          ticket.id,
          undefined,
          userId,
        );

        return res.json({
          message: event.enableVoting
            ? "Vote recorded successfully!"
            : "Ticket validated successfully",
          valid: true,
          canValidate: true,
          ticket: validatedTicket,
          event,
        });
      } catch (error) {
        await logError(error, "POST /api/validate/p2p", {
          request: req,
          metadata: { qrData: req.body.qrData },
        });
        res.status(500).json({ message: "Failed to validate ticket" });
      }
    },
  );

  // Performance test endpoints
  app.get(
    "/api/performance/test/:eventId",
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      const { testValidationPerformance, getCapacityComparison } = await import(
        "./performanceTest"
      );

      try {
        const eventId = req.params.eventId;
        const iterations = parseInt(req.query.iterations as string) || 1000;

        // Check if event exists
        const event = await storage.getEvent(eventId);
        if (!event) {
          return res.status(404).json({ message: "Event not found" });
        }

        // Run performance test
        const testResults = await testValidationPerformance(
          eventId,
          iterations,
        );
        const capacityComparison = getCapacityComparison();

        res.json({
          event: {
            id: event.id,
            name: event.name,
            p2pValidation: event.p2pValidation,
          },
          testResults,
          systemCapacity: capacityComparison,
          summary: {
            message: `The optimized system is ${testResults.comparison.speedImprovement} compared to database-based validation`,
            canHandle: `${testResults.memoryBased.operationsPerSecond.toLocaleString()} validations per second`,
            improvement: testResults.comparison,
          },
        });
      } catch (error) {
        await logError(error, "GET /api/performance/test/:eventId", {
          request: req,
          metadata: { eventId: req.params.eventId },
        });
        res.status(500).json({ message: "Failed to run performance test" });
      }
    },
  );

  app.post(
    "/api/performance/simulate-p2p/:eventId",
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      const { simulateP2PValidationStorm } = await import("./performanceTest");

      try {
        const eventId = req.params.eventId;
        const validators = parseInt(req.body.validators as string) || 100;
        const validationsPerValidator =
          parseInt(req.body.validationsPerValidator as string) || 5;

        // Check if event exists and has P2P enabled
        const event = await storage.getEvent(eventId);
        if (!event) {
          return res.status(404).json({ message: "Event not found" });
        }

        if (!event.p2pValidation) {
          return res
            .status(400)
            .json({ message: "Event does not have P2P validation enabled" });
        }

        // Run P2P storm simulation
        const results = await simulateP2PValidationStorm(
          eventId,
          validators,
          validationsPerValidator,
        );

        res.json({
          event: {
            id: event.id,
            name: event.name,
          },
          simulation: {
            validators,
            validationsPerValidator,
            results,
          },
          analysis: {
            message: `Successfully processed ${results.totalValidations.toLocaleString()} validations in ${(results.totalTime / 1000).toFixed(2)} seconds`,
            throughput: `${results.validationsPerSecond.toLocaleString()} validations per second`,
            concurrency: `Peak of ${results.peakConcurrency} concurrent validators`,
            successRate: `${results.successRate}% success rate`,
          },
        });
      } catch (error) {
        await logError(error, "POST /api/performance/simulate-p2p/:eventId", {
          request: req,
          metadata: { eventId: req.params.eventId },
        });
        res.status(500).json({ message: "Failed to run P2P simulation" });
      }
    },
  );

  // Code pool stats route
  app.get(
    "/api/code-pool/stats",
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      const { getCodePoolStats } = await import("./codePoolManager");

      try {
        const stats = getCodePoolStats();
        res.json(stats);
      } catch (error) {
        await logError(error, "GET /api/code-pool/stats", {
          request: req,
        });
        res.status(500).json({ message: "Failed to fetch code pool stats" });
      }
    },
  );

  // Preload P2P event codes
  app.post(
    "/api/events/:eventId/preload-codes",
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      const { preloadP2PEventCodes } = await import("./codePoolManager");

      try {
        const event = await storage.getEvent(req.params.eventId);

        if (!event) {
          return res.status(404).json({ message: "Event not found" });
        }

        if (!event.p2pValidation) {
          return res
            .status(400)
            .json({ message: "Event does not have P2P validation enabled" });
        }

        const codeCount = preloadP2PEventCodes(event.id);

        res.json({
          message: `Preloaded ${codeCount} codes for P2P event`,
          eventId: event.id,
          eventName: event.name,
          codesLoaded: codeCount,
        });
      } catch (error) {
        await logError(error, "POST /api/events/:eventId/preload-codes", {
          request: req,
          metadata: { eventId: req.params.eventId },
        });
        res.status(500).json({ message: "Failed to preload event codes" });
      }
    },
  );

  // Stats route
  app.get("/api/stats", async (req, res) => {
    try {
      const stats = await storage.getEventStats();
      res.json(stats);
    } catch (error) {
      await logError(error, "GET /api/stats", {
        request: req,
      });
      res.status(500).json({ message: "Failed to fetch stats" });
    }
  });

  // Public analytics dashboard API
  app.get("/api/analytics/dashboard", async (req, res) => {
    try {
      const now = new Date();
      const { country } = req.query;

      // Get basic stats
      const basicStats = await storage.getEventStats();

      // Get all events and filter by country if specified
      let allEvents = await storage.getEvents();

      // Filter to only include events from today onwards up to 1 year in the future
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const oneYearFromNow = new Date();
      oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);

      allEvents = allEvents.filter((e) => {
        const eventDate = new Date(e.date);
        return eventDate >= today && eventDate <= oneYearFromNow;
      });

      if (country && country !== "Global") {
        allEvents = allEvents.filter((e) => e.country === country);
      }

      const upcomingEvents = allEvents.filter((e) => new Date(e.date) > now);
      const pastEvents = allEvents.filter((e) => new Date(e.date) <= now);
      const activeEvents = upcomingEvents.filter((e) => {
        const eventDate = new Date(e.date);
        const hoursUntilEvent =
          (eventDate.getTime() - now.getTime()) / (1000 * 60 * 60);
        return hoursUntilEvent <= 24;
      });

      // Get all tickets for analysis
      let allTickets = await storage.getTickets();

      // If filtering by country, only include tickets for events in that country
      if (country && country !== "Global") {
        const eventIds = new Set(allEvents.map((e) => e.id));
        allTickets = allTickets.filter((t) => eventIds.has(t.eventId));
      }

      // Calculate ticket sales by day (last 68 days)
      const ticketsByDay: Record<string, number> = {};
      allTickets.forEach((ticket) => {
        if (ticket.createdAt) {
          const day = new Date(ticket.createdAt).toLocaleDateString("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric",
          });
          ticketsByDay[day] = (ticketsByDay[day] || 0) + 1;
        }
      });

      // Aggregate data every 2 days for cleaner chart (34 data points)
      const periodLabels: string[] = [];
      const periodData: number[] = [];
      for (let i = 33; i >= 0; i--) {
        const endDate = new Date();
        endDate.setDate(endDate.getDate() - i * 2);
        const startDate = new Date(endDate);
        startDate.setDate(startDate.getDate() - 1);

        // Sum tickets for this 2-day period
        let periodTotal = 0;
        for (let j = 0; j < 2; j++) {
          const checkDate = new Date(startDate);
          checkDate.setDate(checkDate.getDate() + j);
          const dayKey = checkDate.toLocaleDateString("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric",
          });
          periodTotal += ticketsByDay[dayKey] || 0;
        }

        const periodLabel = endDate.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        });
        periodLabels.push(periodLabel);
        periodData.push(periodTotal);
      }

      // Calculate events by country
      const eventsByCountry: Record<string, number> = {};
      allEvents.forEach((event) => {
        const country = event.country || "Unknown";
        eventsByCountry[country] = (eventsByCountry[country] || 0) + 1;
      });

      // Get top countries
      const topCountries = Object.entries(eventsByCountry)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([country, count]) => ({ country, count }));

      // Calculate ticket validation rate
      const validationRate =
        allTickets.length > 0
          ? Math.round(
              (allTickets.filter((t) => t.isValidated).length /
                allTickets.length) *
                100,
            )
          : 0;

      // Get featured events count
      const featuredEvents = await storage.getActiveFeaturedEvents();

      // Get resale queue stats
      const resaleTickets = allTickets.filter(
        (t) => t.resellStatus === "for_resale",
      );

      // Calculate average ticket price
      const ticketsWithPrice = allTickets.filter((t) => t.purchasePrice);
      const avgTicketPrice =
        ticketsWithPrice.length > 0
          ? ticketsWithPrice.reduce(
              (sum, t) => sum + parseFloat(t.purchasePrice!),
              0,
            ) / ticketsWithPrice.length
          : 0;

      // Get events by type/hashtag analysis
      const eventTypes: Record<string, number> = {};
      allEvents.forEach((event) => {
        if (event.hashtags && Array.isArray(event.hashtags)) {
          event.hashtags.forEach((tag) => {
            eventTypes[tag] = (eventTypes[tag] || 0) + 1;
          });
        }
      });

      const topEventTypes = Object.entries(eventTypes)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([type, count]) => ({ type, count }));

      // Get top 10 hashtags
      const topHashtags = Object.entries(eventTypes)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([hashtag, count]) => ({ hashtag, count }));

      // Get user growth (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const allUsers = await storage.getAllUsers();
      const newUsers = allUsers.filter(
        (u) => u.createdAt && new Date(u.createdAt) > thirtyDaysAgo,
      );

      // Calculate daily active events
      const todayEvents = upcomingEvents.filter((e) => {
        const eventDate = new Date(e.date);
        return eventDate.toDateString() === now.toDateString();
      });

      // Calculate event distribution for next 5 days
      const fiveDaysFromNow = new Date();
      fiveDaysFromNow.setDate(fiveDaysFromNow.getDate() + 5);

      // Filter events within next 5 days
      const next5DaysEvents = upcomingEvents.filter((e) => {
        const eventDate = new Date(e.date);
        return eventDate >= now && eventDate <= fiveDaysFromNow;
      });

      // Create an array for each of the next 5 days
      const eventDistribution = [];
      for (let i = 0; i < 5; i++) {
        const checkDate = new Date();
        checkDate.setDate(checkDate.getDate() + i);
        const dateStr = checkDate.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        });

        // Count events on this date
        const eventsOnDate = next5DaysEvents.filter((e) => {
          const eventDate = new Date(e.date);
          return eventDate.toDateString() === checkDate.toDateString();
        });

        // Count badges for events on this date
        const badges = {
          featured: 0, // Featured events are tracked separately
          specialEffects: eventsOnDate.filter((e) => e.specialEffectsEnabled)
            .length,
          p2p: eventsOnDate.filter((e) => e.p2pValidation).length,
          locationSpecific: eventsOnDate.filter((e) => e.geofence).length,
          free: eventsOnDate.filter((e) => parseFloat(e.ticketPrice) === 0)
            .length,
          goldenTicket: eventsOnDate.filter((e) => e.goldenTicketEnabled)
            .length,
        };

        eventDistribution.push({
          date: dateStr,
          count: eventsOnDate.length,
          badges,
        });
      }

      res.json({
        overview: {
          totalEvents: basicStats.totalEvents,
          totalTickets: basicStats.totalTickets,
          validatedTickets: basicStats.validatedTickets,
          totalUsers: allUsers.length,
          upcomingEvents: upcomingEvents.length,
          pastEvents: pastEvents.length,
          activeEventsNext24h: activeEvents.length,
          todayEvents: todayEvents.length,
        },
        ticketMetrics: {
          validationRate,
          avgTicketPrice: Math.round(avgTicketPrice * 100) / 100,
          resaleTickets: resaleTickets.length,
          goldenTickets: allTickets.filter((t) => t.isGoldenTicket).length,
        },
        eventMetrics: {
          featuredEvents: featuredEvents.length,
          privateEvents: allEvents.filter((e) => e.isPrivate).length,
          p2pValidationEvents: allEvents.filter((e) => e.p2pValidation).length,
        },
        userMetrics: {
          newUsersLast30Days: newUsers.length,
          avgTicketsPerUser:
            allUsers.length > 0
              ? Math.round((allTickets.length / allUsers.length) * 10) / 10
              : 0,
        },
        charts: {
          ticketsByMonth: {
            labels: periodLabels,
            data: periodData,
          },
          topCountries,
          topEventTypes,
          topHashtags,
          eventDistribution,
        },
      });
    } catch (error) {
      await logError(error, "GET /api/analytics/dashboard", {
        request: req,
      });
      res.status(500).json({ message: "Failed to fetch analytics" });
    }
  });

  // Get payment configuration status (admin only)
  app.get(
    "/api/admin/payment-status",
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const userId = extractUserId(req);
        const userEmail = extractUserEmail(req);

        // Check admin access
        if (
          !userId ||
          !(await storage.hasPermission(userId, "manage_settings"))
        ) {
          return res.status(403).json({ message: "Admin access required" });
        }

        // Check Stripe status
        const stripeConfigured = !!(
          process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PUBLISHABLE_KEY
        );
        const stripeWebhookConfigured = !!process.env.STRIPE_WEBHOOK_SECRET;

        // Check Coinbase status
        const coinbaseStatus = coinbaseService.getSettings();

        res.json({
          stripe: {
            configured: stripeConfigured,
            webhookConfigured: stripeWebhookConfigured,
            testMode:
              process.env.STRIPE_SECRET_KEY?.startsWith("sk_test_") || false,
            bonus: 2,
          },
          coinbase: {
            configured: coinbaseStatus.configured,
            enabled: coinbaseStatus.enabled,
            bonus: 10,
            acceptedCurrencies: ["BTC", "ETH", "USDC", "LTC", "DOGE"],
          },
        });
      } catch (error) {
        await logError(error, "GET /api/admin/payment-status", {
          request: req,
        });
        res.status(500).json({ message: "Failed to get payment status" });
      }
    },
  );

  // Admin routes (protected - only for @saymservices.com emails)
  app.get("/api/admin/events", async (req: AuthenticatedRequest, res) => {
    try {
      // Check admin access
      const userId = extractUserId(req);
      if (!userId || !(await storage.hasPermission(userId, "manage_events"))) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const events = await storage.getAllEventsForAdmin();
      res.json(events);
    } catch (error) {
      await logError(error, "GET /api/admin/events", {
        request: req,
      });
      res.status(500).json({ message: "Failed to fetch events" });
    }
  });

  app.put(
    "/api/admin/events/:eventId/toggle",
    async (req: AuthenticatedRequest, res) => {
      try {
        // Check admin access
        const userId = extractUserId(req);
        if (
          !userId ||
          !(await storage.hasPermission(userId, "manage_events"))
        ) {
          return res.status(403).json({ message: "Admin access required" });
        }

        const { eventId } = req.params;
        const { field, value } = req.body;

        if (
          !field ||
          !["isEnabled", "ticketPurchasesEnabled"].includes(field)
        ) {
          return res.status(400).json({ message: "Invalid field" });
        }

        const updatedEvent = await storage.updateEventVisibility(
          eventId,
          field,
          value,
        );
        if (!updatedEvent) {
          return res.status(404).json({ message: "Event not found" });
        }

        res.json(updatedEvent);
      } catch (error) {
        await logError(error, "PUT /api/admin/events/:eventId/toggle", {
          request: req,
        });
        res.status(500).json({ message: "Failed to update event" });
      }
    },
  );

  // Special effects odds configuration
  const specialEffectsOdds = {
    valentines: 14,
    halloween: 88,
    christmas: 25,
    nice: 69,
  };

  // Get user registration limit and current user count
  app.get(
    "/api/admin/registration-limit",
    async (req: AuthenticatedRequest, res) => {
      try {
        // Check admin access
        const userId = extractUserId(req);
        if (
          !userId ||
          !(await storage.hasPermission(userId, "manage_settings"))
        ) {
          return res.status(403).json({ message: "Admin access required" });
        }

        // Get current limit from system settings
        const limitSetting = await storage.getSystemSetting(
          "userRegistrationLimit",
        );
        const userCount = await storage.getTotalUsersCount();

        res.json({
          limit: limitSetting?.value || "unlimited",
          userCount,
        });
      } catch (error) {
        await logError(error, "GET /api/admin/registration-limit", {
          request: req,
        });
        res.status(500).json({ message: "Failed to fetch registration limit" });
      }
    },
  );

  // Update user registration limit
  app.put(
    "/api/admin/registration-limit",
    async (req: AuthenticatedRequest, res) => {
      try {
        // Check admin access
        const userId = extractUserId(req);
        if (
          !userId ||
          !(await storage.hasPermission(userId, "manage_settings"))
        ) {
          return res.status(403).json({ message: "Admin access required" });
        }

        const { limit } = req.body;

        if (!["100", "500", "1000", "10000", "unlimited"].includes(limit)) {
          return res.status(400).json({ message: "Invalid limit value" });
        }

        await storage.setSystemSetting("userRegistrationLimit", limit, userId);

        res.json({ message: "Registration limit updated successfully" });
      } catch (error) {
        await logError(error, "PUT /api/admin/registration-limit", {
          request: req,
          metadata: { limit: req.body.limit },
        });
        res
          .status(500)
          .json({ message: "Failed to update registration limit" });
      }
    },
  );

  app.get(
    "/api/admin/special-effects-odds",
    async (req: AuthenticatedRequest, res) => {
      try {
        // Check admin access
        const userId = extractUserId(req);
        if (
          !userId ||
          !(await storage.hasPermission(userId, "manage_events"))
        ) {
          return res.status(403).json({ message: "Admin access required" });
        }

        res.json(specialEffectsOdds);
      } catch (error) {
        await logError(error, "GET /api/admin/special-effects-odds", {
          request: req,
        });
        res.status(500).json({ message: "Failed to fetch odds" });
      }
    },
  );

  app.put(
    "/api/admin/special-effects-odds",
    async (req: AuthenticatedRequest, res) => {
      try {
        // Check admin access
        const userId = extractUserId(req);
        if (
          !userId ||
          !(await storage.hasPermission(userId, "manage_events"))
        ) {
          return res.status(403).json({ message: "Admin access required" });
        }

        const { valentines, halloween, christmas, nice } = req.body;

        // Validate odds are reasonable numbers
        if (
          valentines < 1 ||
          valentines > 1000 ||
          halloween < 1 ||
          halloween > 1000 ||
          christmas < 1 ||
          christmas > 1000 ||
          nice < 1 ||
          nice > 1000
        ) {
          return res
            .status(400)
            .json({ message: "Odds must be between 1 and 1000" });
        }

        // Update the odds
        specialEffectsOdds.valentines = valentines;
        specialEffectsOdds.halloween = halloween;
        specialEffectsOdds.christmas = christmas;
        specialEffectsOdds.nice = nice;

        res.json(specialEffectsOdds);
      } catch (error) {
        await logError(error, "PUT /api/admin/special-effects-odds", {
          request: req,
        });
        res.status(500).json({ message: "Failed to update odds" });
      }
    },
  );

  // Platform Headers Management Routes
  // Public endpoint to get a random active header for the home page
  app.get("/api/platform-headers/random", async (req, res) => {
    try {
      const header = await storage.getRandomPlatformHeader();
      if (!header) {
        // Return default if no headers are found
        return res.json({
          title: "Event Management",
          subtitle: "Browse events and purchase tickets",
        });
      }
      res.json(header);
    } catch (error) {
      await logError(error, "GET /api/platform-headers/random", {
        request: req,
      });
      // Return default on error
      res.json({
        title: "Event Management",
        subtitle: "Browse events and purchase tickets",
      });
    }
  });

  // Admin: Get all platform headers
  app.get(
    "/api/admin/platform-headers",
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const userId = extractUserId(req);
        if (
          !userId ||
          !(await storage.hasPermission(userId, "manage_settings"))
        ) {
          return res.status(403).json({ message: "Admin access required" });
        }

        const headers = await storage.getPlatformHeaders();
        res.json(headers);
      } catch (error) {
        await logError(error, "GET /api/admin/platform-headers", {
          request: req,
        });
        res.status(500).json({ message: "Failed to fetch platform headers" });
      }
    },
  );

  // Admin: Create a new platform header
  app.post(
    "/api/admin/platform-headers",
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const userId = extractUserId(req);
        if (
          !userId ||
          !(await storage.hasPermission(userId, "manage_settings"))
        ) {
          return res.status(403).json({ message: "Admin access required" });
        }

        const { title, subtitle, active, displayOrder } = req.body;

        if (!title || !subtitle) {
          return res
            .status(400)
            .json({ message: "Title and subtitle are required" });
        }

        const header = await storage.createPlatformHeader({
          title,
          subtitle,
          active: active !== undefined ? active : true,
          displayOrder: displayOrder || null,
        });

        res.status(201).json(header);
      } catch (error) {
        await logError(error, "POST /api/admin/platform-headers", {
          request: req,
        });
        res.status(500).json({ message: "Failed to create platform header" });
      }
    },
  );

  // Admin: Update a platform header
  app.put(
    "/api/admin/platform-headers/:id",
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const userId = extractUserId(req);
        if (
          !userId ||
          !(await storage.hasPermission(userId, "manage_settings"))
        ) {
          return res.status(403).json({ message: "Admin access required" });
        }

        const { title, subtitle, active, displayOrder } = req.body;

        const header = await storage.updatePlatformHeader(req.params.id, {
          title,
          subtitle,
          active,
          displayOrder,
        });

        if (!header) {
          return res.status(404).json({ message: "Platform header not found" });
        }

        res.json(header);
      } catch (error) {
        await logError(error, "PUT /api/admin/platform-headers/:id", {
          request: req,
          metadata: { headerId: req.params.id },
        });
        res.status(500).json({ message: "Failed to update platform header" });
      }
    },
  );

  // Admin: Delete a platform header
  app.delete(
    "/api/admin/platform-headers/:id",
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const userId = extractUserId(req);
        if (
          !userId ||
          !(await storage.hasPermission(userId, "manage_settings"))
        ) {
          return res.status(403).json({ message: "Admin access required" });
        }

        const success = await storage.deletePlatformHeader(req.params.id);

        if (!success) {
          return res.status(404).json({ message: "Platform header not found" });
        }

        res.status(204).send();
      } catch (error) {
        await logError(error, "DELETE /api/admin/platform-headers/:id", {
          request: req,
          metadata: { headerId: req.params.id },
        });
        res.status(500).json({ message: "Failed to delete platform header" });
      }
    },
  );

  // Admin: Toggle platform header active state
  app.patch(
    "/api/admin/platform-headers/:id/toggle",
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const userId = extractUserId(req);
        if (
          !userId ||
          !(await storage.hasPermission(userId, "manage_settings"))
        ) {
          return res.status(403).json({ message: "Admin access required" });
        }

        const header = await storage.togglePlatformHeaderActive(req.params.id);

        if (!header) {
          return res.status(404).json({ message: "Platform header not found" });
        }

        res.json(header);
      } catch (error) {
        await logError(error, "PATCH /api/admin/platform-headers/:id/toggle", {
          request: req,
          metadata: { headerId: req.params.id },
        });
        res.status(500).json({ message: "Failed to toggle platform header" });
      }
    },
  );

  // Admin: Get banned words
  app.get(
    "/api/admin/banned-words",
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const userId = extractUserId(req);
        if (
          !userId ||
          !(await storage.hasPermission(userId, "manage_settings"))
        ) {
          return res.status(403).json({ message: "Admin access required" });
        }

        const bannedWords = await storage.getBannedWords();
        res.json({ words: bannedWords.join(", ") });
      } catch (error) {
        await logError(error, "GET /api/admin/banned-words", { request: req });
        res.status(500).json({ message: "Failed to get banned words" });
      }
    },
  );

  // Admin: Update banned words
  app.put(
    "/api/admin/banned-words",
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const userId = extractUserId(req);
        if (
          !userId ||
          !(await storage.hasPermission(userId, "manage_settings"))
        ) {
          return res.status(403).json({ message: "Admin access required" });
        }

        const { words } = req.body;
        if (typeof words !== "string") {
          return res.status(400).json({ message: "Words must be a string" });
        }

        // Update the banned words setting
        await storage.setSystemSetting("banned_words", words, userId);

        // Get the updated list
        const bannedWords = await storage.getBannedWords();
        res.json({ words: bannedWords.join(", ") });
      } catch (error) {
        await logError(error, "PUT /api/admin/banned-words", {
          request: req,
          metadata: { wordsLength: req.body.words?.length },
        });
        res.status(500).json({ message: "Failed to update banned words" });
      }
    },
  );

  // Admin: User Role Management Routes

  // Get paginated list of users with their roles
  app.get(
    "/api/admin/users",
    requirePermission("manage_users"),
    async (req: AuthenticatedRequest, res) => {
      try {
        const { page = 1, limit = 20, search = "" } = req.query;
        const pageNum = parseInt(page as string) || 1;
        const limitNum = Math.min(parseInt(limit as string) || 20, 100); // Max 100 per page
        const searchTerm = (search as string).toLowerCase();

        // Get all users
        const allUsers = await storage.getAllUsers();

        // Filter users by search term (email or displayName)
        let filteredUsers = allUsers;
        if (searchTerm) {
          filteredUsers = allUsers.filter(
            (user) =>
              user.email.toLowerCase().includes(searchTerm) ||
              (user.displayName &&
                user.displayName.toLowerCase().includes(searchTerm)),
          );
        }

        // Calculate pagination
        const totalUsers = filteredUsers.length;
        const totalPages = Math.ceil(totalUsers / limitNum);
        const offset = (pageNum - 1) * limitNum;
        const paginatedUsers = filteredUsers.slice(offset, offset + limitNum);

        // Get roles for each user
        const usersWithRoles = await Promise.all(
          paginatedUsers.map(async (user) => {
            const roles = await storage.getUserRoles(user.id);
            return {
              id: user.id,
              email: user.email,
              displayName: user.displayName,
              memberStatus: user.memberStatus,
              createdAt: user.createdAt,
              lastLoginAt: user.lastLoginAt,
              roles: roles.map((role) => ({
                id: role.id,
                name: role.name,
                displayName: role.displayName,
              })),
            };
          }),
        );

        res.json({
          users: usersWithRoles,
          pagination: {
            page: pageNum,
            limit: limitNum,
            total: totalUsers,
            totalPages,
          },
        });
      } catch (error) {
        await logError(error, "GET /api/admin/users", {
          request: req,
          metadata: { query: req.query },
        });
        res.status(500).json({ message: "Failed to fetch users" });
      }
    },
  );

  // Get available roles for assignment
  app.get(
    "/api/admin/roles",
    requirePermission("manage_users"),
    async (req: AuthenticatedRequest, res) => {
      try {
        const roles = await storage.getRoles();

        // Filter to only show assignable roles (exclude regular 'user' role if it exists)
        const assignableRoles = roles.filter(
          (role) =>
            role.name === "super_admin" ||
            role.name === "event_moderator" ||
            role.name === "support",
        );

        res.json({
          roles: assignableRoles.map((role) => ({
            id: role.id,
            name: role.name,
            displayName: role.displayName,
            description: role.description,
          })),
        });
      } catch (error) {
        await logError(error, "GET /api/admin/roles", { request: req });
        res.status(500).json({ message: "Failed to fetch roles" });
      }
    },
  );

  // Assign a role to a user
  app.post(
    "/api/admin/users/:userId/roles",
    requirePermission("manage_users"),
    async (req: AuthenticatedRequest, res) => {
      try {
        const { userId } = req.params;
        const { roleId } = req.body;
        const assignedBy = req.user?.id;

        if (!roleId) {
          return res.status(400).json({ message: "Role ID is required" });
        }

        // Check if user exists
        const user = await storage.getUser(userId);
        if (!user) {
          return res.status(404).json({ message: "User not found" });
        }

        // Check if role exists
        const roles = await storage.getRoles();
        const role = roles.find((r) => r.id === roleId);
        if (!role) {
          return res.status(404).json({ message: "Role not found" });
        }

        // Check if it's an assignable role
        if (
          role.name !== "super_admin" &&
          role.name !== "event_moderator" &&
          role.name !== "support"
        ) {
          return res
            .status(400)
            .json({ message: "This role cannot be assigned manually" });
        }

        // Check if user already has this role
        const currentRoles = await storage.getUserRoles(userId);
        if (currentRoles.some((r) => r.id === roleId)) {
          return res
            .status(400)
            .json({ message: "User already has this role" });
        }

        // Assign the role
        await storage.assignUserRole(userId, roleId, assignedBy);

        // Get updated roles
        const updatedRoles = await storage.getUserRoles(userId);

        res.json({
          message: `Role '${role.displayName}' assigned successfully`,
          user: {
            id: user.id,
            email: user.email,
            displayName: user.displayName,
            roles: updatedRoles.map((r) => ({
              id: r.id,
              name: r.name,
              displayName: r.displayName,
            })),
          },
        });
      } catch (error) {
        await logError(error, "POST /api/admin/users/:userId/roles", {
          request: req,
          metadata: { userId: req.params.userId, roleId: req.body.roleId },
        });
        res.status(500).json({ message: "Failed to assign role" });
      }
    },
  );

  // Remove a role from a user
  app.delete(
    "/api/admin/users/:userId/roles/:roleId",
    requirePermission("manage_users"),
    async (req: AuthenticatedRequest, res) => {
      try {
        const { userId, roleId } = req.params;

        // Check if user exists
        const user = await storage.getUser(userId);
        if (!user) {
          return res.status(404).json({ message: "User not found" });
        }

        // Check if user has this role
        const currentRoles = await storage.getUserRoles(userId);
        const hasRole = currentRoles.some((r) => r.id === roleId);
        if (!hasRole) {
          return res
            .status(400)
            .json({ message: "User does not have this role" });
        }

        // Find the role details
        const role = currentRoles.find((r) => r.id === roleId);

        // Prevent removing the last super_admin if this is one
        if (role?.name === "super_admin") {
          // Count total super admins
          const allUsers = await storage.getAllUsers();
          let superAdminCount = 0;
          for (const u of allUsers) {
            const roles = await storage.getUserRoles(u.id);
            if (roles.some((r) => r.name === "super_admin")) {
              superAdminCount++;
            }
          }

          if (superAdminCount <= 1) {
            return res.status(400).json({
              message:
                "Cannot remove the last super admin role. Assign another super admin first.",
            });
          }
        }

        // Remove the role
        await storage.removeUserRole(userId, roleId);

        // Get updated roles
        const updatedRoles = await storage.getUserRoles(userId);

        res.json({
          message: `Role '${role?.displayName}' removed successfully`,
          user: {
            id: user.id,
            email: user.email,
            displayName: user.displayName,
            roles: updatedRoles.map((r) => ({
              id: r.id,
              name: r.name,
              displayName: r.displayName,
            })),
          },
        });
      } catch (error) {
        await logError(error, "DELETE /api/admin/users/:userId/roles/:roleId", {
          request: req,
          metadata: { userId: req.params.userId, roleId: req.params.roleId },
        });
        res.status(500).json({ message: "Failed to remove role" });
      }
    },
  );

  // Delegated Validators routes
  app.get(
    "/api/events/:eventId/validators",
    async (req: AuthenticatedRequest, res) => {
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

        const validators = await storage.getDelegatedValidatorsByEvent(
          req.params.eventId,
        );
        res.json(validators);
      } catch (error) {
        res.status(500).json({ message: "Failed to fetch validators" });
      }
    },
  );

  app.post(
    "/api/events/:eventId/validators",
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
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
          addedBy: userId,
        });

        res.status(201).json(validator);
      } catch (error) {
        await logError(error, "POST /api/events/:eventId/validators", {
          request: req,
          metadata: { eventId: req.params.eventId, email: req.body.email },
        });
        res.status(500).json({ message: "Failed to add validator" });
      }
    },
  );

  app.delete(
    "/api/events/:eventId/validators/:validatorId",
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
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
    },
  );

  app.get(
    "/api/events/:eventId/validated-tickets",
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
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
          return res
            .status(403)
            .json({ message: "Only event owners can view validated tickets" });
        }

        const validatedTickets = await storage.getValidatedTicketsForEvent(
          req.params.eventId,
        );
        res.json(validatedTickets);
      } catch (error) {
        await logError(error, "GET /api/events/:eventId/validated-tickets", {
          request: req,
          metadata: { eventId: req.params.eventId },
        });
        res.status(500).json({ message: "Failed to fetch validated tickets" });
      }
    },
  );

  // Public endpoint to check if event has validated tickets
  app.get("/api/events/:eventId/validated-tickets/count", async (req, res) => {
    try {
      const validatedTickets = await storage.getValidatedTicketsForEvent(
        req.params.eventId,
      );
      res.json({ count: validatedTickets.length });
    } catch (error) {
      await logError(
        error,
        "GET /api/events/:eventId/validated-tickets/count",
        {
          request: req,
          metadata: { eventId: req.params.eventId },
        },
      );
      res.status(500).json({ message: "Failed to check validated tickets" });
    }
  });

  // Toggle payment status for a ticket (for event owners)
  app.post(
    "/api/tickets/:ticketId/toggle-payment",
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const userId = extractUserId(req);
        if (!userId) {
          return res.status(401).json({ message: "Unauthorized" });
        }

        // Get the ticket to check event ownership
        const ticket = await storage.getTicket(req.params.ticketId);
        if (!ticket) {
          return res.status(404).json({ message: "Ticket not found" });
        }

        // Check if user owns the event
        const event = await storage.getEvent(ticket.eventId);
        if (!event) {
          return res.status(404).json({ message: "Event not found" });
        }
        if (event.userId !== userId) {
          return res
            .status(403)
            .json({ message: "Only event owners can toggle payment status" });
        }

        // Toggle the payment status
        const updatedTicket = await storage.toggleTicketPaymentStatus(
          req.params.ticketId,
        );
        res.json(updatedTicket);
      } catch (error) {
        await logError(error, "POST /api/tickets/:ticketId/toggle-payment", {
          request: req,
          metadata: { ticketId: req.params.ticketId },
        });
        res.status(500).json({ message: "Failed to toggle payment status" });
      }
    },
  );

  // Export payment intents as CSV for event owners
  app.get(
    "/api/events/:eventId/payment-intents/export",
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const userId = extractUserId(req);
        if (!userId) {
          return res.status(401).json({ message: "Unauthorized" });
        }

        // Check if user owns the event or is admin
        const event = await storage.getEvent(req.params.eventId);
        if (!event) {
          return res.status(404).json({ message: "Event not found" });
        }

        const userEmail = extractUserEmail(req);
        const isUserAdmin = userEmail?.endsWith("@saymservices.com") || false;

        if (event.userId !== userId && !isUserAdmin) {
          return res
            .status(403)
            .json({
              message: "Only event owners and admins can export payment data",
            });
        }

        // Get payment intents for the event
        const paymentIntents = await storage.getPaymentIntentsByEventId(
          req.params.eventId,
        );

        // Create CSV content
        const csvHeaders =
          "Reference,Blockchain,Wallet Address,Amount USD,Amount Crypto,Status,Transaction Hash,Created At,Confirmed At\n";
        const csvRows = paymentIntents
          .map((intent) => {
            const createdAt = intent.createdAt
              ? new Date(intent.createdAt).toISOString()
              : "";
            const confirmedAt = intent.confirmedAt
              ? new Date(intent.confirmedAt).toISOString()
              : "";
            const txHash = intent.transactionHash || "";

            return `"${intent.reference}","${intent.blockchain}","${intent.receiverAddress}","${intent.amountUsd}","${intent.amountCrypto}","${intent.status}","${txHash}","${createdAt}","${confirmedAt}"`;
          })
          .join("\n");

        const csvContent = csvHeaders + csvRows;

        // Set response headers for CSV download
        res.setHeader("Content-Type", "text/csv");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="payment-intents-${event.name.replace(/[^a-z0-9]/gi, "-")}-${new Date().toISOString().split("T")[0]}.csv"`,
        );
        res.send(csvContent);
      } catch (error) {
        await logError(
          error,
          "GET /api/events/:eventId/payment-intents/export",
          {
            request: req,
            metadata: { eventId: req.params.eventId },
          },
        );
        res.status(500).json({ message: "Failed to export payment intents" });
      }
    },
  );

  // System logs endpoint (for administrators)
  app.get(
    "/api/system-logs",
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
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
          search: search as string,
        });

        await logInfo("System logs accessed", "GET /api/system-logs", {
          userId,
          metadata: {
            userEmail: userEmail || undefined,
            query: req.query,
          },
        });

        res.json(logs);
      } catch (error) {
        await logError(error, "GET /api/system-logs", {
          request: req,
        });
        res.status(500).json({ message: "Failed to fetch system logs" });
      }
    },
  );

  // Archive endpoints
  app.get(
    "/api/user/past-events",
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const userId = extractUserId(req);
        if (!userId) {
          return res.status(401).json({ message: "Unauthorized" });
        }

        const archivedEvents = await storage.getArchivedEventsByUser(userId);
        res.json(archivedEvents);
      } catch (error) {
        await logError(error, "GET /api/user/past-events", {
          request: req,
        });
        res.status(500).json({ message: "Failed to fetch past events" });
      }
    },
  );

  // Manual archive trigger (for testing or admin use)
  app.post(
    "/api/archive/check",
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
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
            archived: success,
          });
        }

        res.json({
          message: `Archived ${results.filter((r) => r.archived).length} of ${results.length} events`,
          results,
        });
      } catch (error) {
        await logError(error, "POST /api/archive/check", {
          request: req,
        });
        res.status(500).json({ message: "Failed to archive events" });
      }
    },
  );

  // Registry endpoints
  app.post(
    "/api/tickets/:ticketId/mint",
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const userId = extractUserId(req);
        if (!userId) {
          return res.status(401).json({ message: "Unauthorized" });
        }

        const { ticketId } = req.params;
        const {
          title,
          description,
          metadata,
          walletAddress,
          withRoyalty = true,
        } = req.body;

        // Validate wallet address
        if (!walletAddress || !walletAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
          return res
            .status(400)
            .json({ message: "Valid Ethereum wallet address is required" });
        }

        // Get the ticket details
        const ticket = await storage.getTicket(ticketId);
        if (!ticket) {
          return res.status(404).json({ message: "Ticket not found" });
        }

        // Verify ownership
        if (ticket.userId !== userId) {
          return res
            .status(403)
            .json({ message: "You can only mint your own tickets" });
        }

        // Check if can mint
        const canMint = await storage.canMintTicket(ticketId);
        if (!canMint) {
          return res
            .status(400)
            .json({
              message:
                "Ticket cannot be minted. Make sure it has been validated and the event allows NFT minting.",
            });
        }

        // Check if already minted
        const existingRegistry =
          await storage.getRegistryRecordByTicket(ticketId);
        if (existingRegistry) {
          return res
            .status(400)
            .json({ message: "This ticket has already been minted as an NFT" });
        }

        // Check user's ticket balance for minting cost (12 tickets with royalty, 15 without)
        const MINT_COST = withRoyalty ? 12 : 15;
        const userBalance = await storage.getUserBalance(userId);
        if (!userBalance || parseFloat(userBalance.balance) < MINT_COST) {
          return res.status(400).json({
            message: `Insufficient tickets. You need ${MINT_COST} tickets to mint an NFT ${withRoyalty ? "(with royalty)" : "(without royalty)"}. Current balance: ${userBalance?.balance || 0}`,
          });
        }

        // Debit tickets for minting
        await storage.debitUserAccount(userId, MINT_COST, "NFT Minting", {
          ticketId,
          type: "nft_mint",
        });

        // Get event details
        const event = await storage.getEvent(ticket.eventId);
        if (!event) {
          return res.status(404).json({ message: "Event not found" });
        }

        // Check if event allows minting
        if (!event.allowMinting) {
          return res
            .status(403)
            .json({ message: "NFT minting is not enabled for this event" });
        }

        // Private events cannot be minted as NFTs
        if (event.isPrivate) {
          return res
            .status(403)
            .json({
              message: "Private events are not eligible for NFT minting",
            });
        }

        // Parse metadata to extract imageUrl
        const parsedMetadata = JSON.parse(metadata || "{}");
        const imageUrl = parsedMetadata.imageUrl;

        // Remove imageUrl from metadata before storing
        const { imageUrl: _, ...cleanMetadata } = parsedMetadata;

        // Get user details for preservation
        const creator = await storage.getUser(event.userId || userId);
        const owner = await storage.getUser(userId);

        // Fetch actual image data as base64 for permanent storage
        const fetchImageAsBase64 = async (
          url: string | null,
        ): Promise<string | null> => {
          if (!url) return null;
          try {
            // Handle both object storage paths and full URLs
            let fetchUrl = url;
            if (url.startsWith("/objects/")) {
              // It's an object storage path, fetch from our server
              fetchUrl = `${req.protocol}://${req.get("host")}${url}`;
            } else if (!url.startsWith("http")) {
              // It's a relative path
              fetchUrl = `${req.protocol}://${req.get("host")}${url}`;
            }

            const response = await fetch(fetchUrl);
            if (!response.ok) return null;

            const arrayBuffer = await response.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            const base64 = buffer.toString("base64");
            const contentType =
              response.headers.get("content-type") || "image/png";

            // Return as data URL for easy reconstruction
            return `data:${contentType};base64,${base64}`;
          } catch (error) {
            console.error(`Failed to fetch image ${url}:`, error);
            return null;
          }
        };

        // Fetch all image data in parallel for efficiency
        const [
          eventImageData,
          eventStickerData,
          ticketBackgroundData,
          ticketGifData,
        ] = await Promise.all([
          fetchImageAsBase64(event.imageUrl),
          fetchImageAsBase64(event.stickerUrl),
          fetchImageAsBase64(event.ticketBackgroundUrl),
          fetchImageAsBase64(ticket.nftMediaUrl),
        ]);

        // Extract hunt metadata if this ticket was obtained via hunt
        let huntCode: string | null = null;
        let huntLatitude: string | null = null;
        let huntLongitude: string | null = null;

        // Check if ticket was obtained via hunt by examining the qrData
        if (ticket.qrData && ticket.qrData.startsWith("HUNT-")) {
          // Extract hunt code from qrData pattern: HUNT-{code}-{ticketNumber}
          const parts = ticket.qrData.split("-");
          if (parts.length >= 2) {
            huntCode = parts[1]; // The code is the second part

            // Try to get the hunt secret code to get GPS coordinates
            const secretCode = await storage.validateSecretCode(huntCode);
            if (secretCode && secretCode.codeType === "hunt") {
              huntLatitude = secretCode.huntLatitude;
              huntLongitude = secretCode.huntLongitude;
            }
          }
        }

        // Create registry record with COMPLETE data preservation
        const registryRecord = await storage.createRegistryRecord({
          ticketId,
          eventId: ticket.eventId,
          ownerId: userId,
          creatorId: event.userId || userId,
          title: title || `${event.name} - Ticket #${ticket.ticketNumber}`,
          description:
            description ||
            `NFT for ${event.name} at ${event.venue} on ${event.date}`,
          metadata: JSON.stringify({
            ...cleanMetadata,
            originalTicket: {
              ticketNumber: ticket.ticketNumber,
              qrData: ticket.qrData,
              validatedAt: ticket.validatedAt,
              useCount: ticket.useCount,
            },
          }),
          imageUrl: imageUrl || null, // Keep original URL for OpenSea metadata

          // Base64 image data for permanent preservation
          eventImageData: eventImageData || null,
          eventStickerData: eventStickerData || null,
          ticketBackgroundData: ticketBackgroundData || null,
          ticketGifData: ticketGifData || null,

          // Complete ticket data preservation
          ticketNumber: ticket.ticketNumber,
          ticketStatus: ticket.status || "validated",
          ticketValidatedAt: ticket.validatedAt || null,
          ticketValidatedBy: null, // validatedBy not tracked in current schema
          ticketCreatedAt: ticket.createdAt || new Date(),
          // PII fields removed - no longer storing recipient name/email
          ticketSeatNumber: ticket.seatNumber || null,
          ticketType: ticket.ticketType || null,
          ticketTransferable: ticket.transferable || false,
          ticketUsageCount: ticket.useCount || 0,
          ticketMaxUses: 1, // maxUses not tracked on tickets, only events
          ticketIsGolden: ticket.isGoldenTicket || false,
          ticketNftMediaUrl: ticket.nftMediaUrl || null, // Keep original URL
          ticketQrCode: ticket.qrData,
          ticketValidationCode: ticket.validationCode || null,
          ticketVoteCount: ticket.voteCount || 0,
          ticketIsDoubleGolden: ticket.isDoubleGolden || false,
          ticketSpecialEffect: ticket.specialEffect || null,
          // PII fields removed - no longer storing purchaser email/IP
          ticketPurchasePrice: ticket.purchasePrice || null,
          ticketResellStatus: ticket.resellStatus || "not_for_resale",
          ticketOriginalOwnerId: ticket.originalOwnerId || null,
          ticketIsCharged: ticket.isCharged || false,

          // Hunt metadata (if ticket was obtained via hunt)
          huntCode: huntCode,
          huntClaimLatitude: huntLatitude,
          huntClaimLongitude: huntLongitude,

          // Complete event data preservation
          eventName: event.name,
          eventDescription: event.description || "",
          eventVenue: event.venue,
          eventDate: event.date,
          eventTime: event.time,
          eventEndDate: event.endDate || null,
          eventEndTime: event.endTime || null,
          eventImageUrl: event.imageUrl || null, // Keep original URL for reference
          eventMaxTickets: event.maxTickets || null,
          eventTicketsSold: 0, // ticketsSold calculated separately
          eventTicketPrice: event.ticketPrice || null,
          eventEventTypes: [], // eventTypes not stored in current schema
          eventReentryType: event.reentryType || "No Reentry (Single Use)",
          eventGoldenTicketEnabled: event.goldenTicketEnabled || false,
          eventGoldenTicketCount: event.goldenTicketCount || null,
          eventAllowMinting: event.allowMinting || false,
          eventIsPrivate: event.isPrivate || false,
          eventOneTicketPerUser: event.oneTicketPerUser || false,
          eventSurgePricing: event.surgePricing || false,
          eventP2pValidation: event.p2pValidation || false,
          eventEnableVoting: event.enableVoting || false,
          eventCreatedAt: event.createdAt || new Date(),
          eventStickerUrl: event.stickerUrl || null, // Keep original URL for reference
          eventTicketBackgroundUrl:
            event.ticketBackgroundUrl || event.imageUrl || null, // Keep original URL
          eventSpecialEffectsEnabled:
            (event as any).specialEffectsEnabled || false,
          eventGeofence: (event as any).geofence
            ? JSON.stringify((event as any).geofence)
            : null,
          eventIsAdminCreated: (event as any).isAdminCreated || false,
          eventContactDetails: event.contactDetails || null,
          eventCountry: event.country || null,
          eventEarlyValidation: event.earlyValidation || "Allow at Anytime",
          eventMaxUses: event.maxUses || 1,
          eventStickerOdds: event.stickerOdds || 25,
          eventIsEnabled: event.isEnabled !== false,
          eventTicketPurchasesEnabled: event.ticketPurchasesEnabled !== false,
          eventLatitude: event.latitude || null,
          eventLongitude: event.longitude || null,
          eventTimezone: event.timezone || "America/New_York",
          eventRollingTimezone: event.rollingTimezone || false,
          eventHashtags: event.hashtags || [],
          eventTreasureHunt: event.treasureHunt || false,
          eventHuntCode: event.huntCode || null,

          // User data preservation
          creatorUsername: creator?.displayName || "unknown",
          creatorDisplayName: creator?.displayName || null,
          ownerUsername: owner?.displayName || "unknown",
          ownerDisplayName: owner?.displayName || null,

          // Sync tracking
          synced: false,
          syncedAt: null,

          // NFT minting data
          walletAddress: walletAddress,
          nftMinted: false,
          nftMintingStatus: "pending",
          nftMintCost: MINT_COST,

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

        // Get the full URL for the registry record
        const registryUrl = `${req.protocol}://${req.get("host")}/registry/${registryRecord.id}`;
        const metadataUrl = `${req.protocol}://${req.get("host")}/api/registry/${registryRecord.id}/metadata`;

        // Decentralized minting - no server-side minting

        res.json({
          message:
            "Registry record created successfully. Ready for NFT minting.",
          registryRecord,
          registryUrl,
          metadataUrl,
          walletAddress,
          cost: MINT_COST,
          withRoyalty,
        });
      } catch (error) {
        await logError(error, "POST /api/tickets/:ticketId/mint", {
          request: req,
        });
        res.status(500).json({ message: "Failed to mint ticket" });
      }
    },
  );

  // Prepare mint parameters for user-controlled minting
  app.post(
    "/api/tickets/:ticketId/prepare-mint",
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const { ethers } = await import("ethers");

        const userId = extractUserId(req);
        if (!userId) {
          return res.status(401).json({ message: "Unauthorized" });
        }

        const { ticketId } = req.params;
        const {
          walletAddress,
          title,
          description,
          metadata,
          withRoyalty = true,
        } = req.body;

        if (!walletAddress || !walletAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
          return res.status(400).json({ message: "Invalid wallet address" });
        }

        // Get the ticket
        const ticket = await storage.getTicket(ticketId);
        if (!ticket) {
          return res.status(404).json({ message: "Ticket not found" });
        }

        // Check if user owns the ticket
        if (ticket.userId !== userId) {
          return res
            .status(403)
            .json({ message: "You do not own this ticket" });
        }

        // Check if ticket is validated
        if (!ticket.isValidated || !ticket.validatedAt) {
          return res
            .status(400)
            .json({ message: "Ticket must be validated before minting" });
        }

        // Check if already minted
        const existingRecord =
          await storage.getRegistryRecordByTicket(ticketId);
        if (existingRecord) {
          return res.status(400).json({ message: "Ticket already minted" });
        }

        // Get the event
        const event = await storage.getEvent(ticket.eventId);
        if (!event || !event.allowMinting) {
          return res
            .status(400)
            .json({ message: "NFT minting is not enabled for this event" });
        }

        // Check 24-hour waiting period
        const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
        const timeSinceValidation =
          Date.now() - new Date(ticket.validatedAt).getTime();
        if (timeSinceValidation < TWENTY_FOUR_HOURS) {
          return res.status(400).json({
            message: "Must wait 24 hours after validation before minting",
            timeRemaining: TWENTY_FOUR_HOURS - timeSinceValidation,
          });
        }

        // Check user has enough tickets
        const userBalance = await storage.getUserBalance(userId);
        const MINT_COST = withRoyalty ? 12 : 15;

        if (!userBalance || parseFloat(userBalance.balance) < MINT_COST) {
          return res.status(400).json({
            message: `Insufficient tickets. Need ${MINT_COST}, have ${userBalance ? parseFloat(userBalance.balance) : 0}`,
          });
        }

        // Deduct tickets immediately
        await storage.createLedgerTransaction({
          transactionType: "nft_mint",
          description: `NFT mint preparation for ticket ${ticketId}`,
          debits: [
            { accountId: userId, accountType: "user", amount: MINT_COST },
          ],
          credits: [
            {
              accountId: "system_revenue",
              accountType: "system",
              amount: MINT_COST,
            },
          ],
          metadata: { ticketId, withRoyalty },
          relatedEntityId: ticketId,
          relatedEntityType: "ticket",
          createdBy: userId,
        });

        // Fetch base64 encoded images for complete preservation
        const fetchImageAsBase64 = async (
          url: string | null | undefined,
        ): Promise<string | null> => {
          if (!url) return null;
          try {
            const response = await fetch(url);
            if (!response.ok) return null;
            const buffer = await response.buffer();
            return `data:${response.headers.get("content-type") || "image/jpeg"};base64,${buffer.toString("base64")}`;
          } catch (error) {
            console.error("Error fetching image as base64:", error);
            return null;
          }
        };

        // Fetch all images as base64 for preservation
        const [eventImageData, eventStickerData, ticketBackgroundData] =
          await Promise.all([
            fetchImageAsBase64(event.imageUrl),
            fetchImageAsBase64(event.stickerUrl),
            fetchImageAsBase64(event.ticketBackgroundUrl || event.imageUrl),
          ]);

        // Create registry record (but not minted yet)
        const creator = await storage.getUser(event.userId!);
        const owner = await storage.getUser(ticket.userId!);

        const registryRecord = await storage.createRegistryRecord({
          ticketId: ticket.id,
          ownerId: userId,
          creatorId: event.userId!,
          eventId: event.id,
          title: (title || `${event.name} - Validated Ticket`) as string,
          description: (description ||
            `Validated ticket for ${event.name} on ${event.date}`) as string,
          metadata: (metadata || "{}") as string,

          // Required ticket fields
          ticketNumber: ticket.ticketNumber,
          ticketStatus: ticket.status || "pending",
          // PII fields removed - no longer storing recipient name/email

          // Preserve ticket data
          ticketCreatedAt: ticket.createdAt || new Date(),
          ticketValidatedAt: ticket.validatedAt!,
          ticketIsGolden: ticket.isGoldenTicket || false,
          ticketPurchasePrice: ticket.purchasePrice || null,

          // Preserve event data
          eventName: event.name,
          eventDate: event.date,
          eventTime: event.time,
          eventVenue: event.venue,
          eventDescription: event.description || "",
          eventTicketPrice: event.ticketPrice,
          eventImageUrl: event.imageUrl || null,
          eventIsPrivate: event.isPrivate || false,
          eventAllowMinting: event.allowMinting || true,
          eventEndDate: event.endDate || null,
          eventEndTime: event.endTime || null,
          eventCreatedAt: event.createdAt || new Date(),
          eventStickerUrl: event.stickerUrl || null,
          eventTicketBackgroundUrl:
            event.ticketBackgroundUrl || event.imageUrl || null,
          eventSpecialEffectsEnabled:
            (event as any).specialEffectsEnabled || false,
          eventGeofence: (event as any).geofence
            ? JSON.stringify((event as any).geofence)
            : null,
          eventIsAdminCreated: (event as any).isAdminCreated || false,
          eventContactDetails: event.contactDetails || null,
          eventCountry: event.country || null,
          eventEarlyValidation: event.earlyValidation || "Allow at Anytime",
          eventMaxUses: event.maxUses || 1,
          eventStickerOdds: event.stickerOdds || 25,
          eventIsEnabled: event.isEnabled !== false,
          eventTicketPurchasesEnabled: event.ticketPurchasesEnabled !== false,
          eventLatitude: event.latitude || null,
          eventLongitude: event.longitude || null,
          eventTimezone: event.timezone || "America/New_York",
          eventRollingTimezone: event.rollingTimezone || false,
          eventHashtags: event.hashtags || [],
          eventTreasureHunt: event.treasureHunt || false,
          eventHuntCode: event.huntCode || null,

          // User data preservation
          creatorUsername: creator?.displayName || "unknown",
          creatorDisplayName: creator?.displayName || null,
          ownerUsername: owner?.displayName || "unknown",
          ownerDisplayName: owner?.displayName || null,

          // Sync tracking
          synced: false,
          syncedAt: null,

          // Binary data storage for complete preservation
          eventImageData: eventImageData,
          eventStickerData: eventStickerData,
          ticketBackgroundData: ticketBackgroundData,

          // NFT minting data
          walletAddress: walletAddress,
          nftMinted: false,
          nftMintingStatus: "prepared",
          nftMintCost: MINT_COST,

          validatedAt: ticket.validatedAt!,
        });

        // Get contract details
        const contractAddress =
          process.env.NFT_CONTRACT_ADDRESS ||
          "0x0000000000000000000000000000000000000000";
        const contractABI = [
          "function mintTicket(address recipient, string registryId, string metadataPath, bool withRoyalty) returns (uint256)",
        ];

        // Create the interface and encode the function call
        const iface = new ethers.Interface(contractABI);
        const data = iface.encodeFunctionData("mintTicket", [
          walletAddress,
          registryRecord.id,
          `${registryRecord.id}/metadata`,
          withRoyalty,
        ]);

        // Prepare unsigned transaction for Base L2
        const unsignedTx = {
          to: contractAddress,
          data: data,
          value: "0x0", // No ETH value needed
          chainId: process.env.BASE_NETWORK === "testnet" ? 84532 : 8453, // Base Sepolia or Base Mainnet
          gasLimit: "0x249F0", // 150000 in hex
        };

        // Get registry and metadata URLs
        const registryUrl = `${req.protocol}://${req.get("host")}/registry/${registryRecord.id}`;
        const metadataUrl = `${req.protocol}://${req.get("host")}/api/registry/${registryRecord.id}/metadata`;

        res.json({
          unsignedTransaction: unsignedTx,
          registryId: registryRecord.id,
          registryUrl,
          metadataUrl,
          withRoyalty,
          ticketCost: MINT_COST,
          contractAddress,
          chainName:
            process.env.BASE_NETWORK === "testnet" ? "Base Sepolia" : "Base",
        });
      } catch (error) {
        await logError(error, "POST /api/tickets/:ticketId/prepare-mint", {
          request: req,
        });
        res.status(500).json({ message: "Failed to prepare mint" });
      }
    },
  );

  // Confirm mint after user executes transaction
  app.post(
    "/api/tickets/:ticketId/confirm-mint",
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const userId = extractUserId(req);
        if (!userId) {
          return res.status(401).json({ message: "Unauthorized" });
        }

        const { ticketId } = req.params;
        const { transactionHash, tokenId } = req.body;

        if (!transactionHash) {
          return res.status(400).json({ message: "Transaction hash required" });
        }

        // Get the ticket
        const ticket = await storage.getTicket(ticketId);
        if (!ticket) {
          return res.status(404).json({ message: "Ticket not found" });
        }

        // Get registry record
        const registryRecord =
          await storage.getRegistryRecordByTicket(ticketId);
        if (!registryRecord) {
          return res.status(404).json({ message: "Registry record not found" });
        }

        // TODO: Update registry record with on-chain data
        // This would require adding an updateRegistryRecord method to storage
        // For now, just return success

        res.json({
          message: "NFT mint confirmed",
          registryRecord,
          transactionHash,
          tokenId,
          openSeaUrl: `https://opensea.io/assets/base/${process.env.NFT_CONTRACT_ADDRESS}/${tokenId}`,
          baseScanUrl: `https://basescan.org/tx/${transactionHash}`,
        });
      } catch (error) {
        await logError(error, "POST /api/tickets/:ticketId/confirm-mint", {
          request: req,
        });
        res.status(500).json({ message: "Failed to confirm mint" });
      }
    },
  );

  // Refund tickets if mint fails
  app.post(
    "/api/tickets/:ticketId/refund-mint",
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const userId = extractUserId(req);
        if (!userId) {
          return res.status(401).json({ message: "Unauthorized" });
        }

        const { ticketId } = req.params;
        const { transactionHash, reason } = req.body;

        // Get the ticket
        const ticket = await storage.getTicket(ticketId);
        if (!ticket) {
          return res.status(404).json({ message: "Ticket not found" });
        }

        // Get registry record
        const registryRecord =
          await storage.getRegistryRecordByTicket(ticketId);
        if (!registryRecord) {
          return res.status(404).json({ message: "Registry record not found" });
        }

        // Check if already minted (no refund if successful)
        if (registryRecord.nftMinted) {
          return res
            .status(400)
            .json({ message: "NFT already minted, cannot refund" });
        }

        // Refund tickets
        const refundAmount = registryRecord.nftMintCost || 12; // Default to standard mint cost
        await storage.createLedgerTransaction({
          transactionType: "nft_refund",
          description: `Refund for failed NFT mint (ticket ${ticketId})`,
          debits: [
            {
              accountId: "system_revenue",
              accountType: "system",
              amount: refundAmount,
            },
          ],
          credits: [
            { accountId: userId, accountType: "user", amount: refundAmount },
          ],
          metadata: { ticketId, reason },
          relatedEntityId: ticketId,
          relatedEntityType: "ticket",
          createdBy: userId,
        });

        // TODO: Mark registry record as failed
        // This would require adding an updateRegistryRecord method

        res.json({
          message: "Tickets refunded successfully",
          refundAmount,
          reason,
        });
      } catch (error) {
        await logError(error, "POST /api/tickets/:ticketId/refund-mint", {
          request: req,
        });
        res.status(500).json({ message: "Failed to process refund" });
      }
    },
  );

  app.get(
    "/api/tickets/:ticketId/mint-status",
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
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
            mintingDisabled: true,
          });
        }

        // Check if already minted
        const registryRecord =
          await storage.getRegistryRecordByTicket(ticketId);
        if (registryRecord) {
          return res.json({
            canMint: false,
            alreadyMinted: true,
            registryRecord,
          });
        }

        // Check validation status
        if (!ticket.isValidated || !ticket.validatedAt) {
          return res.json({
            canMint: false,
            alreadyMinted: false,
            needsValidation: true,
          });
        }

        // If ticket is validated, allow minting regardless of event time
        // (Validated tickets prove attendance, so they should always be mintable)
        res.json({
          canMint: true,
          alreadyMinted: false,
          validatedAt: ticket.validatedAt,
          timeRemaining: 0,
          timeRemainingHours: 0,
        });
      } catch (error) {
        await logError(error, "GET /api/tickets/:ticketId/mint-status", {
          request: req,
        });
        res.status(500).json({ message: "Failed to get mint status" });
      }
    },
  );

  app.get(
    "/api/user/registry",
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const userId = extractUserId(req);
        if (!userId) {
          return res.status(401).json({ message: "Unauthorized" });
        }

        const registryRecords = await storage.getRegistryRecordsByUser(userId);
        res.json(registryRecords);
      } catch (error) {
        await logError(error, "GET /api/user/registry", {
          request: req,
        });
        res.status(500).json({ message: "Failed to fetch registry records" });
      }
    },
  );

  // Public registry endpoints - no auth required
  app.get("/api/registry", async (req: AuthenticatedRequest, res) => {
    try {
      const registryRecords = await storage.getAllRegistryRecords();
      res.json(registryRecords);
    } catch (error) {
      await logError(error, "GET /api/registry", {
        request: req,
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

      // Update lastAccessed timestamp to track NFT viewing
      await storage.updateRegistryLastAccessed(id);

      res.json(registryRecord);
    } catch (error) {
      await logError(error, "GET /api/registry/:id", {
        request: req,
      });
      res.status(500).json({ message: "Failed to fetch registry record" });
    }
  });

  // Prepare mint parameters for registry NFT
  app.post(
    "/api/registry/:id/mint-parameters",
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const userId = extractUserId(req);
        if (!userId) {
          return res.status(401).json({ message: "Unauthorized" });
        }

        const { id } = req.params;
        const { walletAddress } = req.body;

        if (!walletAddress || !walletAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
          return res.status(400).json({ message: "Valid wallet address required" });
        }

        // Get the registry record
        const registryRecord = await storage.getRegistryRecord(id);
        if (!registryRecord) {
          return res.status(404).json({ message: "Registry record not found" });
        }

        // Check ownership
        if (registryRecord.ownerId !== userId) {
          return res.status(403).json({ message: "Access denied" });
        }

        // Check if already minted
        if (registryRecord.nftTokenId) {
          return res.status(400).json({ message: "NFT already minted for this registry record" });
        }

        // Check if NFT is globally enabled
        const nftEnabledSetting = await storage.getSystemSetting("nft_enabled");
        const isEnabled = nftEnabledSetting?.value === "true";
        if (!isEnabled) {
          return res.status(400).json({ message: "NFT minting is not enabled" });
        }

        // Get contract ABI
        let contractABI;
        try {
          contractABI = require('../contracts/TicketRegistryABI.json');
        } catch (error) {
          console.error("Failed to load contract ABI:", error);
          return res.status(500).json({ message: "Contract configuration error" });
        }

        // Prepare mint parameters
        const contractAddress = process.env.NFT_CONTRACT_ADDRESS;
        if (!contractAddress) {
          return res.status(500).json({ message: "NFT contract not configured" });
        }

        // Use the metadata from the registry record or create a default URL
        const metadataUrl = registryRecord.metadata || `https://metadata.eventic.app/registry/${id}`;

        // Estimate gas (typically 150,000 - 200,000 for NFT minting)
        const estimatedGas = "200000";

        // Check if this registry was created with royalty (infer from metadata or default to true)
        let withRoyalty = true; // Default to standard minting with royalty
        try {
          const meta = JSON.parse(registryRecord.metadata);
          if (meta && typeof meta.withRoyalty === 'boolean') {
            withRoyalty = meta.withRoyalty;
          }
        } catch (e) {
          // If metadata parsing fails, use default
        }

        res.json({
          contractAddress,
          contractABI,
          registryId: id,
          metadataPath: metadataUrl,
          withRoyalty,
          estimatedGas
        });
      } catch (error) {
        await logError(error, "POST /api/registry/:id/mint-parameters", {
          request: req,
        });
        res.status(500).json({ message: "Failed to prepare mint parameters" });
      }
    }
  );

  // Confirm mint after user executes transaction
  app.post(
    "/api/registry/:id/confirm-mint",
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const userId = extractUserId(req);
        if (!userId) {
          return res.status(401).json({ message: "Unauthorized" });
        }

        const { id } = req.params;
        const { transactionHash, tokenId } = req.body;

        if (!transactionHash) {
          return res.status(400).json({ message: "Transaction hash required" });
        }

        // Get the registry record
        const registryRecord = await storage.getRegistryRecord(id);
        if (!registryRecord) {
          return res.status(404).json({ message: "Registry record not found" });
        }

        // Check ownership
        if (registryRecord.ownerId !== userId) {
          return res.status(403).json({ message: "Access denied" });
        }

        // Update the registry record with NFT details
        await storage.updateRegistryNftStatus(
          id,
          'confirmed',
          transactionHash,
          tokenId
        );

        res.json({
          success: true,
          tokenId,
          openSeaUrl: `https://opensea.io/assets/base/${process.env.NFT_CONTRACT_ADDRESS}/${tokenId}`,
          baseScanUrl: `https://basescan.org/tx/${transactionHash}`,
        });
      } catch (error) {
        await logError(error, "POST /api/registry/:id/confirm-mint", {
          request: req,
        });
        res.status(500).json({ message: "Failed to confirm mint" });
      }
    }
  );

  // NFT Monitoring Session endpoints
  app.post(
    "/api/monitoring-sessions",
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const userId = extractUserId(req);
        if (!userId) {
          return res.status(401).json({ message: "Unauthorized" });
        }

        const { registryId, transactionHash, walletAddress } = req.body;
        
        // Validate registry record belongs to user
        const registryRecord = await storage.getRegistryRecord(registryId);
        if (!registryRecord || registryRecord.ownerId !== userId) {
          return res.status(403).json({ message: "Registry record not found or unauthorized" });
        }
        
        // Check if a session already exists for this transaction
        const existingSession = await storage.getActiveMonitoringSessionByTxHash(transactionHash);
        if (existingSession) {
          return res.json(existingSession);
        }
        
        // Create new 10-minute monitoring session
        const expiresAt = new Date();
        expiresAt.setMinutes(expiresAt.getMinutes() + 10);
        
        const session = await storage.createMonitoringSession({
          registryId,
          userId,
          transactionHash,
          walletAddress: walletAddress || registryRecord.walletAddress,
          expiresAt
        });
        
        res.json(session);
      } catch (error) {
        await logError(error, "POST /api/monitoring-sessions", {
          request: req,
        });
        res.status(500).json({ message: "Failed to create monitoring session" });
      }
    }
  );
  
  app.get(
    "/api/monitoring-sessions/:id",
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const userId = extractUserId(req);
        if (!userId) {
          return res.status(401).json({ message: "Unauthorized" });
        }
        
        const { id } = req.params;
        const session = await storage.getMonitoringSession(id);
        
        if (!session) {
          return res.status(404).json({ message: "Monitoring session not found" });
        }
        
        // Verify ownership
        const registryRecord = await storage.getRegistryRecord(session.registryId);
        if (!registryRecord || registryRecord.ownerId !== userId) {
          return res.status(403).json({ message: "Unauthorized" });
        }
        
        res.json(session);
      } catch (error) {
        await logError(error, "GET /api/monitoring-sessions/:id", {
          request: req,
        });
        res.status(500).json({ message: "Failed to fetch monitoring session" });
      }
    }
  );
  
  app.post(
    "/api/monitoring-sessions/:id/update-status",
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const userId = extractUserId(req);
        if (!userId) {
          return res.status(401).json({ message: "Unauthorized" });
        }
        
        const { id } = req.params;
        const { status, tokenId, errorReason } = req.body;
        
        // Get session and verify ownership
        const session = await storage.getMonitoringSession(id);
        if (!session) {
          return res.status(404).json({ message: "Monitoring session not found" });
        }
        
        const registryRecord = await storage.getRegistryRecord(session.registryId);
        if (!registryRecord || registryRecord.ownerId !== userId) {
          return res.status(403).json({ message: "Unauthorized" });
        }
        
        // Update session status
        await storage.updateMonitoringSessionStatus(id, status, tokenId, errorReason);
        
        // If confirmed, update the registry record
        if (status === 'confirmed' && tokenId) {
          await storage.updateRegistryNftStatus(
            session.registryId, 
            'confirmed', 
            session.transactionHash, 
            tokenId
          );
        } else if (status === 'failed') {
          await storage.updateRegistryNftStatus(
            session.registryId, 
            'failed', 
            session.transactionHash
          );
        }
        
        res.json({ success: true });
      } catch (error) {
        await logError(error, "POST /api/monitoring-sessions/:id/update-status", {
          request: req,
        });
        res.status(500).json({ message: "Failed to update monitoring session" });
      }
    }
  );

  // NFT Metadata endpoint for OpenSea/marketplaces
  app.get(
    "/api/registry/:id/metadata",
    async (req: AuthenticatedRequest, res) => {
      try {
        const { id } = req.params;
        const registryRecord = await storage.getRegistryRecord(id);

        // Update lastAccessed for metadata endpoint too (OpenSea crawls this)
        await storage.updateRegistryLastAccessed(id);

        if (!registryRecord) {
          return res.status(404).json({ message: "Registry record not found" });
        }

        // Build OpenSea-compatible metadata
        const metadata = {
          name:
            registryRecord.title || `Ticket #${registryRecord.ticketNumber}`,
          description:
            registryRecord.description ||
            `Validated ticket from ${registryRecord.eventName}`,
          // Serve compressed or original image based on isCompressed flag
          // The data is already in base64 format, whether compressed or not
          image:
            registryRecord.ticketGifData ||
            registryRecord.eventImageData ||
            registryRecord.imageUrl ||
            "",
          external_url: `${req.protocol}://${req.get("host")}/registry/${id}`,
          attributes: [
            {
              trait_type: "Event",
              value: registryRecord.eventName,
            },
            {
              trait_type: "Venue",
              value: registryRecord.eventVenue,
            },
            {
              trait_type: "Date",
              value: registryRecord.eventDate,
            },
            {
              trait_type: "Ticket Number",
              value: registryRecord.ticketNumber,
            },
            {
              trait_type: "Validated",
              value: registryRecord.ticketValidatedAt ? "Yes" : "No",
            },
            {
              trait_type: "Golden Ticket",
              value: registryRecord.ticketIsGolden ? "Yes" : "No",
            },
          ],
        };

        // Add special attributes if present
        if (registryRecord.ticketIsDoubleGolden) {
          metadata.attributes.push({
            trait_type: "Double Golden",
            value: "Yes",
          });
        }

        if (registryRecord.ticketSpecialEffect) {
          metadata.attributes.push({
            trait_type: "Special Effect",
            value: registryRecord.ticketSpecialEffect,
          });
        }

        if (registryRecord.huntCode) {
          metadata.attributes.push({
            trait_type: "Treasure Hunt",
            value: registryRecord.huntCode,
          });
        }

        if (
          registryRecord.ticketVoteCount &&
          registryRecord.ticketVoteCount > 0
        ) {
          metadata.attributes.push({
            trait_type: "Vote Count",
            value: registryRecord.ticketVoteCount.toString(),
          });
        }

        // Set proper headers for NFT metadata
        res.setHeader("Content-Type", "application/json");
        res.setHeader("Access-Control-Allow-Origin", "*");

        res.json(metadata);
      } catch (error) {
        await logError(error, "GET /api/registry/:id/metadata", {
          request: req,
        });
        res.status(500).json({ message: "Failed to fetch NFT metadata" });
      }
    },
  );

  // Featured Events Routes
  app.get("/api/featured-events", async (req: AuthenticatedRequest, res) => {
    try {
      // Clean up expired featured events first
      await storage.cleanupExpiredFeaturedEvents();

      let featuredEvents = await storage.getFeaturedEventsWithDetails();

      // Filter to show only upcoming and ongoing events (with 1-hour buffer) and enabled events
      featuredEvents = featuredEvents.filter((featuredEvent) =>
        isEventActive(featuredEvent.event) && featuredEvent.event.isEnabled,
      );

      // Add isAdminCreated field and current price to each event
      const featuredEventsWithAdmin = await Promise.all(
        featuredEvents.map(async (featuredEvent) => {
          const eventWithCreator = await storage.getEventWithCreator(
            featuredEvent.event.id,
          );
          const creatorId = eventWithCreator?.userId;
          const isAdminCreated = creatorId ? await isAdmin(creatorId) : false;

          // Get current price with surge pricing
          const currentPrice = await storage.getCurrentPrice(
            featuredEvent.event.id,
          );

          return {
            ...featuredEvent,
            event: {
              ...featuredEvent.event,
              isAdminCreated,
              currentPrice,
            },
          };
        }),
      );

      // Featured events should ALWAYS show regardless of location preferences

      res.json(featuredEventsWithAdmin);
    } catch (error) {
      await logError(error, "GET /api/featured-events", {
        request: req,
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

      // Get all regular events for random selection (exclude private and suspended events)
      let allEvents = (await storage.getEvents()).filter(
        (event) => !event.isPrivate && event.isEnabled,
      );

      // Filter to show only upcoming and ongoing events (with 1-hour buffer) and enabled events
      featuredEvents = featuredEvents.filter((fe) => isEventActive(fe.event) && fe.event.isEnabled);
      allEvents = allEvents.filter((event) => isEventActive(event));

      // Get total available events (boosted + regular)
      const featuredEventIds = new Set(featuredEvents.map((fe) => fe.event.id));
      const availableRegularEvents = allEvents.filter(
        (event) => !featuredEventIds.has(event.id),
      );
      const totalAvailableEvents =
        featuredEvents.length + availableRegularEvents.length;

      let gridEvents = [];

      // Determine how many events to show (min 4, max 8)
      let targetEventCount;
      if (totalAvailableEvents < 4) {
        // Less than 4 events - show all available
        targetEventCount = totalAvailableEvents;
      } else if (totalAvailableEvents <= 8) {
        // Between 4 and 8 events - show all
        targetEventCount = totalAvailableEvents;
      } else {
        // More than 8 events - show 8
        targetEventCount = 8;
      }

      // Add boosted events first (up to 8)
      if (featuredEvents.length > 0) {
        gridEvents.push(
          ...featuredEvents.slice(
            0,
            Math.min(targetEventCount, featuredEvents.length),
          ),
        );
      }

      // Fill remaining slots with regular events if needed
      const slotsRemaining = targetEventCount - gridEvents.length;
      if (slotsRemaining > 0 && availableRegularEvents.length > 0) {
        const randomEvents = availableRegularEvents
          .sort(() => Math.random() - 0.5)
          .slice(0, slotsRemaining)
          .map((event) => ({
            id: `random-${event.id}`,
            event,
            isPaid: false,
            isBumped: false,
            duration: "",
            startTime: new Date(),
            endTime: new Date(),
            position: 0,
          }));
        gridEvents.push(...randomEvents);
      }

      // If we still have more than 8 events somehow, limit to 8
      if (gridEvents.length > 8) {
        gridEvents = gridEvents.slice(0, 8);
      }

      // Add current price with surge pricing to each event
      const gridEventsWithPricing = await Promise.all(
        gridEvents.map(async (gridEvent) => {
          const currentPrice = await storage.getCurrentPrice(
            gridEvent.event.id,
          );
          return {
            ...gridEvent,
            event: {
              ...gridEvent.event,
              currentPrice,
            },
          };
        }),
      );

      res.json(gridEventsWithPricing);
    } catch (error) {
      await logError(error, "GET /api/featured-grid", {
        request: req,
      });
      res.status(500).json({ message: "Failed to fetch featured grid" });
    }
  });

  app.get(
    "/api/events/:id/boost-info",
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const { id } = req.params;
        const userId = extractUserId(req);

        if (!userId) {
          return res.status(401).json({ message: "Unauthorized" });
        }

        // Check if user can boost this event (owner or ticket holder)
        const canUserBoost = await storage.canUserBoostEvent(userId, id);
        if (!canUserBoost) {
          return res
            .status(403)
            .json({
              message: "You can only boost events you own or have a ticket for",
            });
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
          allSlotsTaken: nextPosition === null,
        });
      } catch (error) {
        await logError(error, "GET /api/events/:id/boost-info", {
          request: req,
        });
        res.status(500).json({ message: "Failed to get boost info" });
      }
    },
  );

  app.post(
    "/api/events/:id/boost",
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
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

        // Check if user can boost this event (owner or ticket holder)
        const canUserBoost = await storage.canUserBoostEvent(userId, id);
        if (!canUserBoost) {
          return res
            .status(403)
            .json({
              message: "You can only boost events you own or have a ticket for",
            });
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
          "24hours": 24,
        }[duration as "1hour" | "6hours" | "12hours" | "24hours"];

        let price = standardHourlyRate * durationHours;

        // Handle bump-in scenario
        if (isBump) {
          // Check if bump is actually needed
          if (featuredCount < 100) {
            return res
              .status(400)
              .json({ message: "Bump not needed, slots available" });
          }
          price = bumpHourlyRate * durationHours;
        } else if (featuredCount >= 100) {
          // All slots taken and not bumping
          return res
            .status(400)
            .json({ message: "All featured slots are taken" });
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
          "24hours": 24 * 60 * 60 * 1000,
        }[duration as "1hour" | "6hours" | "12hours" | "24hours"];

        const endTime = new Date(now.getTime() + durationMs);

        // Check user's Ticket balance
        const userBalance = await storage.getUserBalance(userId);
        if (!userBalance) {
          return res
            .status(400)
            .json({ message: "Failed to fetch user balance" });
        }
        const availableBalance = parseFloat(userBalance.availableBalance);

        if (availableBalance < price) {
          return res
            .status(400)
            .json({
              message: `Insufficient Tickets. You need ${price} Tickets but only have ${Math.floor(availableBalance)} Tickets`,
            });
        }

        // Debit user's Ticket balance
        const debitSuccess = await storage.debitUserAccount(
          userId,
          price,
          `Event boost: ${duration} ${isBump ? "(Bump)" : "(Standard)"}`,
          { eventId: id, duration, boostType: isBump ? "bump" : "standard" },
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
          position: position!,
        });

        res.json({
          success: true,
          featuredEvent,
          price: price.toString(),
          endTime,
        });
      } catch (error) {
        await logError(error, "POST /api/events/:id/boost", {
          request: req,
        });
        res.status(500).json({ message: "Failed to boost event" });
      }
    },
  );

  app.get("/api/events-paginated", async (req, res) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 25;

      if (page < 1 || limit < 1 || limit > 100) {
        return res
          .status(400)
          .json({ message: "Invalid pagination parameters" });
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
          hasPrev: page > 1,
        },
      });
    } catch (error) {
      await logError(error, "GET /api/events-paginated", {
        request: req,
      });
      res.status(500).json({ message: "Failed to fetch paginated events" });
    }
  });

  // Notifications endpoints
  app.get(
    "/api/notifications",
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const userId = extractUserId(req);
        if (!userId) {
          return res.status(401).json({ message: "Unauthorized" });
        }

        const notifications = await storage.getNotifications(userId);
        res.json(notifications);
      } catch (error) {
        await logError(error, "GET /api/notifications", {
          request: req,
        });
        res.status(500).json({ message: "Failed to fetch notifications" });
      }
    },
  );

  app.post(
    "/api/notifications",
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const userId = extractUserId(req);
        if (!userId) {
          return res.status(401).json({ message: "Unauthorized" });
        }

        const validation = insertNotificationSchema.safeParse(req.body);
        if (!validation.success) {
          return res.status(400).json({
            message: "Invalid notification data",
            errors: validation.error.errors,
          });
        }

        const notification = await storage.createNotification({
          ...validation.data,
          userId,
        });

        res.status(201).json(notification);
      } catch (error) {
        await logError(error, "POST /api/notifications", {
          request: req,
        });
        res.status(500).json({ message: "Failed to create notification" });
      }
    },
  );

  app.patch(
    "/api/notifications/:id/read",
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const userId = extractUserId(req);
        if (!userId) {
          return res.status(401).json({ message: "Unauthorized" });
        }

        const notification = await storage.markNotificationAsRead(
          req.params.id,
        );

        if (!notification) {
          return res.status(404).json({ message: "Notification not found" });
        }

        res.json(notification);
      } catch (error) {
        await logError(error, "PATCH /api/notifications/:id/read", {
          request: req,
        });
        res
          .status(500)
          .json({ message: "Failed to mark notification as read" });
      }
    },
  );

  app.patch(
    "/api/notifications/mark-all-read",
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const userId = extractUserId(req);
        if (!userId) {
          return res.status(401).json({ message: "Unauthorized" });
        }

        await storage.markAllNotificationsAsRead(userId);
        res.json({ message: "All notifications marked as read" });
      } catch (error) {
        await logError(error, "PATCH /api/notifications/mark-all-read", {
          request: req,
        });
        res
          .status(500)
          .json({ message: "Failed to mark all notifications as read" });
      }
    },
  );

  app.get(
    "/api/notification-preferences",
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const userId = extractUserId(req);
        if (!userId) {
          return res.status(401).json({ message: "Unauthorized" });
        }

        const preferences = await storage.getNotificationPreferences(userId);
        res.json(preferences);
      } catch (error) {
        await logError(error, "GET /api/notification-preferences", {
          request: req,
        });
        res
          .status(500)
          .json({ message: "Failed to fetch notification preferences" });
      }
    },
  );

  app.patch(
    "/api/notification-preferences",
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const userId = extractUserId(req);
        if (!userId) {
          return res.status(401).json({ message: "Unauthorized" });
        }

        const validation = insertNotificationPreferencesSchema
          .omit({ userId: true })
          .safeParse(req.body);
        if (!validation.success) {
          return res.status(400).json({
            message: "Invalid preferences data",
            errors: validation.error.errors,
          });
        }

        const preferences = await storage.updateNotificationPreferences(
          userId,
          validation.data,
        );
        res.json(preferences);
      } catch (error) {
        await logError(error, "PATCH /api/notification-preferences", {
          request: req,
        });
        res
          .status(500)
          .json({ message: "Failed to update notification preferences" });
      }
    },
  );

  // Event Rating endpoints
  app.post(
    "/api/tickets/:ticketId/rate",
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const userId = extractUserId(req);
        if (!userId) {
          return res.status(401).json({ message: "Unauthorized" });
        }

        const { ticketId } = req.params;
        const { rating } = req.body;

        // Validate rating
        if (!rating || !["thumbs_up", "thumbs_down"].includes(rating)) {
          return res
            .status(400)
            .json({
              message: "Invalid rating. Must be 'thumbs_up' or 'thumbs_down'",
            });
        }

        // Verify the ticket belongs to the user
        const ticket = await storage.getTicket(ticketId);
        if (!ticket || ticket.userId !== userId) {
          return res
            .status(403)
            .json({ message: "You can only rate events for your own tickets" });
        }

        // Get event details to fetch the owner ID
        const event = await storage.getEvent(ticket.eventId);
        if (!event || !event.userId) {
          return res
            .status(404)
            .json({ message: "Event not found or has no owner" });
        }

        // Check if event rating period is still valid (within 24 hours after event ends)
        let eventEndDateTime: string;
        if (event.endDate && event.endTime) {
          // Use end date/time if available
          eventEndDateTime = `${event.endDate}T${event.endTime}:00`;
        } else if (event.endTime) {
          // If only end time is provided, use event date with end time
          eventEndDateTime = `${event.date}T${event.endTime}:00`;
        } else {
          // If no end time, use start time as the end
          eventEndDateTime = `${event.date}T${event.time}:00`;
        }

        const eventEnd = new Date(eventEndDateTime);
        const now = new Date();
        const hoursSinceEnd =
          (now.getTime() - eventEnd.getTime()) / (1000 * 60 * 60);

        if (hoursSinceEnd > 24) {
          return res
            .status(400)
            .json({
              message: "Rating period has ended (24 hours after event ends)",
            });
        }

        // Check if user has already rated this event
        const existingRating = await storage.getUserEventRating(
          userId,
          ticket.eventId,
        );

        if (existingRating) {
          // User has already rated, allow free switching (no ticket adjustments)
          const updatedRating = await storage.updateEventRating(
            userId,
            ticket.eventId,
            rating,
          );

          if (!updatedRating) {
            return res.status(400).json({ message: "Failed to update rating" });
          }

          res.json({ success: true, rating: updatedRating, updated: true });
        } else {
          // For thumbs down, check if user has enough credits first
          if (rating === "thumbs_down") {
            const userBalance = await storage.getUserBalance(userId);
            if (!userBalance || parseFloat(userBalance.availableBalance) < 1) {
              return res
                .status(400)
                .json({
                  message: "Insufficient credits. Downvoting costs 1 credit.",
                });
            }
          }

          // Create new rating
          const eventRating = await storage.rateEvent({
            ticketId,
            eventId: ticket.eventId,
            eventOwnerId: event.userId,
            rating,
          });

          if (!eventRating) {
            return res.status(400).json({ message: "Failed to submit rating" });
          }

          // Handle ticket rewards/costs based on rating type
          if (rating === "thumbs_up") {
            // Credit user with 1 credit for positive rating
            await storage.creditUserAccount(
              userId,
              1,
              `Event rating reward for ${event.name}`,
              {
                type: "rating_reward",
                eventId: ticket.eventId,
                ticketId: ticketId,
              },
            );
            res.json({
              success: true,
              rating: eventRating,
              updated: false,
              rewardCredited: true,
            });
          } else {
            // Debit user 1 credit for negative rating
            const debitSuccess = await storage.debitUserAccount(
              userId,
              1,
              `Event downvote cost for ${event.name}`,
              {
                type: "rating_cost",
                eventId: ticket.eventId,
                ticketId: ticketId,
              },
            );

            res.json({
              success: true,
              rating: eventRating,
              updated: false,
              ticketDebited: true,
            });
          }
        }
      } catch (error) {
        await logError(error, "POST /api/tickets/:ticketId/rate", {
          request: req,
        });
        res.status(500).json({ message: "Failed to submit event rating" });
      }
    },
  );

  app.get(
    "/api/tickets/:ticketId/rating",
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const userId = extractUserId(req);
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

        // Check if within rating period (24 hours after event ends)
        let eventEndDateTime: string;
        if (event.endDate && event.endTime) {
          // Use end date/time if available
          eventEndDateTime = `${event.endDate}T${event.endTime}:00`;
        } else if (event.endTime) {
          // If only end time is provided, use event date with end time
          eventEndDateTime = `${event.date}T${event.endTime}:00`;
        } else {
          // If no end time, use start time as the end
          eventEndDateTime = `${event.date}T${event.time}:00`;
        }

        const eventEnd = new Date(eventEndDateTime);
        const now = new Date();
        const hoursSinceEnd =
          (now.getTime() - eventEnd.getTime()) / (1000 * 60 * 60);
        const canRate = hoursSinceEnd <= 24;

        // Get user's existing rating if any
        const existingRating = await storage.getUserEventRating(
          userId,
          ticket.eventId,
        );

        res.json({
          hasRated: !!existingRating,
          currentRating: existingRating?.rating || null,
          canRate,
          ratingPeriodEnded: hoursSinceEnd > 24,
        });
      } catch (error) {
        await logError(error, "GET /api/tickets/:ticketId/rating", {
          request: req,
        });
        res.status(500).json({ message: "Failed to check rating status" });
      }
    },
  );

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
        displayName: user.displayName || "Anonymous",
        type: "legacy", // All users are legacy type for now
      });
    } catch (error) {
      await logError(error, "GET /api/users/:userId", {
        request: req,
      });
      res.status(500).json({ message: "Failed to fetch user details" });
    }
  });

  app.get("/api/users/:userId/reputation", async (req, res) => {
    try {
      const { userId } = req.params;
      const { debug } = req.query;

      const reputation = await storage.getUserReputation(userId);

      // If debug mode, also show what ratings are pending (not yet 24 hours old)
      if (debug === "true") {
        // Get all ratings for comparison
        const allRatings = await storage.getAllUserRatings(userId);

        res.json({
          ...reputation,
          debug: {
            currentReputation: reputation,
            totalRatingsAll: allRatings.totalRatings,
            pendingRatings: allRatings.totalRatings - reputation.totalRatings,
            note: "Ratings from events less than 24 hours old are pending and not included in reputation yet",
          },
        });
      } else {
        res.json(reputation);
      }
    } catch (error) {
      await logError(error, "GET /api/users/:userId/reputation", {
        request: req,
      });
      res.status(500).json({ message: "Failed to fetch user reputation" });
    }
  });

  // Get user's validated tickets count
  app.get(
    "/api/users/:userId/validated-count",
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const { userId } = req.params;
        const requestingUserId = req.user?.id;

        // User can only get their own validation count
        if (userId !== requestingUserId) {
          return res.status(403).json({ message: "Unauthorized" });
        }

        const validatedCount =
          await storage.getUserValidatedTicketsCount(userId);
        res.json({ validatedCount });
      } catch (error) {
        await logError(error, "GET /api/users/:userId/validated-count", {
          request: req,
          metadata: { userId: req.params.userId },
        });
        res
          .status(500)
          .json({ message: "Failed to get validated tickets count" });
      }
    },
  );

  // Get user's secret codes count
  app.get(
    "/api/users/:userId/secret-codes-count",
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const { userId } = req.params;
        const requestingUserId = req.user?.id;

        // User can only get their own secret codes count
        if (userId !== requestingUserId) {
          return res.status(403).json({ message: "Unauthorized" });
        }

        const secretCodesCount = await storage.getUserSecretCodesCount(userId);
        res.json({ secretCodesCount });
      } catch (error) {
        await logError(error, "GET /api/users/:userId/secret-codes-count", {
          request: req,
          metadata: { userId: req.params.userId },
        });
        res.status(500).json({ message: "Failed to get secret codes count" });
      }
    },
  );

  app.get("/api/users/:userId/validated-count", async (req, res) => {
    try {
      const { userId } = req.params;

      const validatedCount = await storage.getUserValidatedTicketsCount(userId);
      res.json({ validatedCount });
    } catch (error) {
      await logError(error, "GET /api/users/:userId/validated-count", {
        request: req,
      });
      res
        .status(500)
        .json({ message: "Failed to fetch validated tickets count" });
    }
  });

  // Currency API Routes
  app.get(
    "/api/currency/balance",
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const userId = extractUserId(req);
        if (!userId) {
          return res.status(401).json({ message: "User not authenticated" });
        }

        const balance = await storage.getUserBalance(userId);
        res.json(balance);
      } catch (error) {
        await logError(error, "GET /api/currency/balance", {
          request: req,
        });
        res.status(500).json({ message: "Failed to fetch balance" });
      }
    },
  );

  app.get(
    "/api/currency/transactions",
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const userId = extractUserId(req);
        if (!userId) {
          return res.status(401).json({ message: "User not authenticated" });
        }

        const limit = parseInt(req.query.limit as string) || 50;
        const transactions = await storage.getAccountTransactions(
          userId,
          limit,
        );
        res.json(transactions);
      } catch (error) {
        await logError(error, "GET /api/currency/transactions", {
          request: req,
        });
        res.status(500).json({ message: "Failed to fetch transactions" });
      }
    },
  );

  // Daily claim status endpoint
  app.get(
    "/api/currency/daily-claim-status",
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const userId = extractUserId(req);
        if (!userId) {
          return res.status(401).json({ message: "User not authenticated" });
        }

        const status = await storage.canClaimDailyTickets(userId);
        res.json(status);
      } catch (error) {
        await logError(error, "GET /api/currency/daily-claim-status", {
          request: req,
        });
        res.status(500).json({ message: "Failed to check claim status" });
      }
    },
  );

  // Daily claim endpoint
  app.post(
    "/api/currency/claim-daily",
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const userId = extractUserId(req);
        if (!userId) {
          return res.status(401).json({ message: "User not authenticated" });
        }

        const result = await storage.claimDailyTickets(userId);
        res.json({
          success: true,
          amount: result.amount,
          nextClaimAt: result.nextClaimAt,
          message: `You received ${result.amount} Tickets!`,
        });
      } catch (error: any) {
        if (error.message === "Cannot claim tickets yet") {
          return res
            .status(400)
            .json({
              message:
                "You've already claimed your daily tickets. Please wait 24 hours.",
            });
        }
        await logError(error, "POST /api/currency/claim-daily", {
          request: req,
        });
        res.status(500).json({ message: "Failed to claim daily tickets" });
      }
    },
  );

  // Admin claim status endpoint
  app.get(
    "/api/currency/admin-claim-status",
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const userId = extractUserId(req);
        if (!userId) {
          return res.status(401).json({ message: "User not authenticated" });
        }

        const status = await storage.canClaimAdminCredits(userId);
        res.json(status);
      } catch (error) {
        await logError(error, "GET /api/currency/admin-claim-status", {
          request: req,
        });
        res.status(500).json({ message: "Failed to check admin claim status" });
      }
    },
  );

  // Admin claim endpoint
  app.post(
    "/api/currency/claim-admin",
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const userId = extractUserId(req);
        if (!userId) {
          return res.status(401).json({ message: "User not authenticated" });
        }

        // Check if user has admin role
        const roles = await storage.getUserRoles(userId);
        const isAdmin = roles.some(
          (role: any) =>
            role.name === "super_admin" || role.name === "event_moderator",
        );

        if (!isAdmin) {
          return res
            .status(403)
            .json({
              message: "You don't have permission to claim admin credits",
            });
        }

        const result = await storage.claimAdminCredits(userId);
        res.json({
          success: true,
          amount: result.amount,
          nextClaimAt: result.nextClaimAt,
          message: `Admin reward: You received ${result.amount} Tickets!`,
        });
      } catch (error: any) {
        if (error.message === "Cannot claim admin credits yet") {
          return res
            .status(400)
            .json({
              message:
                "You've already claimed your admin credits. Please wait 24 hours.",
            });
        }
        await logError(error, "POST /api/currency/claim-admin", {
          request: req,
        });
        res.status(500).json({ message: "Failed to claim admin credits" });
      }
    },
  );

  // Secret code redemption
  app.post(
    "/api/currency/redeem-code",
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const userId = extractUserId(req);
        if (!userId) {
          return res.status(401).json({ message: "User not authenticated" });
        }

        const { code, latitude, longitude } = req.body;
        if (!code) {
          return res.status(400).json({ message: "Code is required" });
        }

        const result = await storage.redeemSecretCode(
          code,
          userId,
          latitude,
          longitude,
        );

        if (result.success) {
          res.json({
            success: true,
            ticketAmount: result.ticketAmount,
            message:
              result.message ||
              `Successfully redeemed ${result.ticketAmount} tickets!`,
            eventId: result.eventId, // Pass through the eventId if it exists (for Hunt codes)
          });
        } else {
          res.status(400).json({
            success: false,
            message: result.error || "Failed to redeem code",
          });
        }
      } catch (error) {
        await logError(error, "POST /api/currency/redeem-code", {
          request: req,
        });
        res.status(500).json({ message: "Failed to redeem code" });
      }
    },
  );

  // Get ticket demand data (cached for 12 hours)
  let demandCache: { value: number; timestamp: number } | null = null;
  const DEMAND_CACHE_DURATION = 12 * 60 * 60 * 1000; // 12 hours in milliseconds

  app.get("/api/currency/demand", async (req, res) => {
    try {
      // Check if cache is valid
      if (
        demandCache &&
        Date.now() - demandCache.timestamp < DEMAND_CACHE_DURATION
      ) {
        const cachedDemand = demandCache.value;
        let demandMultiplier: number;
        if (cachedDemand <= 200) {
          demandMultiplier = 0.92;
        } else if (cachedDemand <= 500) {
          demandMultiplier = 0.92 + ((cachedDemand - 200) / 300) * 0.08;
        } else if (cachedDemand <= 1000) {
          demandMultiplier = 1.0 + ((cachedDemand - 500) / 500) * 0.12;
        } else {
          demandMultiplier = Math.min(
            1.28,
            1.12 + ((cachedDemand - 1000) / 1000) * 0.16,
          );
        }
        const currentUnitPrice = 0.25 * demandMultiplier;

        return res.json({
          demand: cachedDemand,
          demandMultiplier: demandMultiplier,
          currentUnitPrice: currentUnitPrice,
          baseUnitPrice: 0.25,
        });
      }

      // Get fresh demand data
      const demand = await storage.getTicketDemand48Hours();

      // Update cache
      demandCache = { value: demand, timestamp: Date.now() };

      // Calculate current pricing based on bidirectional demand
      let demandMultiplier: number;
      if (demand <= 200) {
        demandMultiplier = 0.92;
      } else if (demand <= 500) {
        demandMultiplier = 0.92 + ((demand - 200) / 300) * 0.08;
      } else if (demand <= 1000) {
        demandMultiplier = 1.0 + ((demand - 500) / 500) * 0.12;
      } else {
        demandMultiplier = Math.min(
          1.28,
          1.12 + ((demand - 1000) / 1000) * 0.16,
        );
      }
      const currentUnitPrice = 0.25 * demandMultiplier;

      res.json({
        demand,
        demandMultiplier,
        currentUnitPrice,
        baseUnitPrice: 0.25,
      });
    } catch (error) {
      await logError(error, "GET /api/currency/demand", { request: req });
      res.status(500).json({ message: "Failed to get demand data" });
    }
  });

  // Create ticket purchase session
  app.post(
    "/api/currency/create-purchase",
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const userId = extractUserId(req);
        const userEmail = extractUserEmail(req);

        if (!userId || !userEmail) {
          return res.status(401).json({ message: "User not authenticated" });
        }

        const {
          quantity,
          hasDiscount,
          reputationDiscount = 0,
          volumeDiscount = 0,
          stripeBonus = 0,
        } = req.body;

        if (!quantity || quantity < 12) {
          return res
            .status(400)
            .json({ message: "Minimum purchase is 12 credits" });
        }

        // Get current demand to calculate dynamic pricing
        const currentDemand = await storage.getTicketDemand48Hours();

        // Base price with dynamic adjustment based on bidirectional demand
        const baseUnitPrice = 0.25;

        // Calculate demand multiplier with gentler curve (0.92x to 1.28x)
        // 0-200: Floor price ($0.23)
        // 200-500: Gradual rise to base ($0.25)
        // 500-1000: Rise to moderate surge ($0.28)
        // 1000+: Approach ceiling ($0.32)
        let demandMultiplier: number;
        if (currentDemand <= 200) {
          demandMultiplier = 0.92; // Floor: $0.23
        } else if (currentDemand <= 500) {
          // Linear interpolation from 0.92 to 1.0 (floor to base)
          demandMultiplier = 0.92 + ((currentDemand - 200) / 300) * 0.08;
        } else if (currentDemand <= 1000) {
          // Linear interpolation from 1.0 to 1.12 (base to moderate)
          demandMultiplier = 1.0 + ((currentDemand - 500) / 500) * 0.12;
        } else {
          // Linear interpolation from 1.12 to 1.28 (moderate to ceiling)
          // Caps at 1.28 when demand reaches 2000
          demandMultiplier = Math.min(
            1.28,
            1.12 + ((currentDemand - 1000) / 1000) * 0.16,
          );
        }

        const unitPrice = baseUnitPrice * demandMultiplier;
        let effectiveUnitPrice = unitPrice;
        let totalDiscountPercentage = 0;

        // Calculate total discount percentage
        if (hasDiscount) {
          totalDiscountPercentage += 10; // x2 multiplier discount
        }

        if (reputationDiscount > 0 && reputationDiscount <= 20) {
          totalDiscountPercentage += reputationDiscount;
        }

        if (volumeDiscount > 0 && !hasDiscount) {
          totalDiscountPercentage += volumeDiscount;
        }

        // Cap total discount at 30%
        const cappedDiscount = Math.min(totalDiscountPercentage, 30);
        effectiveUnitPrice = unitPrice * (1 - cappedDiscount / 100);

        const totalAmount = quantity * effectiveUnitPrice;

        // Create purchase record
        const purchase = await storage.createTicketPurchase({
          userId,
          quantity,
          unitPrice: effectiveUnitPrice.toString(),
          totalAmount: totalAmount.toString(),
          status: "pending",
        });

        // Create Stripe checkout session
        const Stripe = (await import("stripe")).default;
        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
          apiVersion: "2025-08-27.basil",
        });

        const session = await stripe.checkout.sessions.create({
          payment_method_types: ["card"],
          line_items: [
            {
              price_data: {
                currency: "usd",
                product_data: {
                  name:
                    stripeBonus > 0
                      ? `Event Tickets (+${stripeBonus} bonus)`
                      : "Event Tickets",
                  description: `${quantity} tickets for creating and boosting events${stripeBonus > 0 ? ` plus ${stripeBonus} bonus` : ""}${reputationDiscount > 0 ? ` ${reputationDiscount}%rep discount` : ""}, Qty ${quantity} total`,
                },
                unit_amount: Math.round(effectiveUnitPrice * 100), // Convert to cents
              },
              quantity: quantity,
            },
          ],
          mode: "payment",
          success_url: `${process.env.VITE_APP_URL || "http://localhost:5000"}/account?purchase=success&session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${process.env.VITE_APP_URL || "http://localhost:5000"}/account?purchase=cancelled`,
          customer_email: userEmail,
          metadata: {
            purchaseId: purchase.id,
            userId: userId,
            quantity: quantity.toString(),
            stripeBonus: stripeBonus.toString(),
          },
        });

        // Update purchase with session ID
        await storage.updateTicketPurchaseStatus(
          purchase.id,
          "pending",
          session.id,
        );

        res.json({
          sessionId: session.id,
          sessionUrl: session.url,
        });
      } catch (error) {
        await logError(error, "POST /api/currency/create-purchase", {
          request: req,
        });
        res.status(500).json({ message: "Failed to create purchase session" });
      }
    },
  );

  // Handle Stripe webhook for successful payments
  app.post("/api/stripe/webhook", async (req, res) => {
    try {
      const Stripe = (await import("stripe")).default;
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
        apiVersion: "2025-08-27.basil",
      });
      const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

      let event;

      if (endpointSecret) {
        // Verify webhook signature
        const sig = req.headers["stripe-signature"];
        try {
          event = stripe.webhooks.constructEvent(
            req.body,
            sig as string,
            endpointSecret,
          );
        } catch (err: any) {
          console.error("Webhook signature verification failed:", err.message);
          return res.status(400).send(`Webhook Error: ${err.message}`);
        }
      } else {
        // For testing without webhook signature
        event = req.body;
      }

      // Handle the event
      if (event.type === "checkout.session.completed") {
        const session = event.data.object;

        // Get purchase from metadata
        const purchaseId = session.metadata?.purchaseId;
        const userId = session.metadata?.userId;
        const quantity = parseInt(session.metadata?.quantity || "0");
        const stripeBonus = parseInt(session.metadata?.stripeBonus || "0");

        if (purchaseId && userId && quantity > 0) {
          // Update purchase status
          await storage.updateTicketPurchaseStatus(
            purchaseId,
            "completed",
            session.id,
          );

          // Credit user account with total tickets (including bonus)
          const totalTickets = quantity + stripeBonus;
          const description =
            stripeBonus > 0
              ? `Purchased ${quantity} tickets (+${stripeBonus} Stripe bonus)`
              : `Purchased ${quantity} tickets`;

          await storage.creditUserAccount(userId, totalTickets, description, {
            stripeSessionId: session.id,
            purchaseId,
          });

          console.log(
            `Successfully processed purchase ${purchaseId} for user ${userId}: ${totalTickets} tickets (includes ${stripeBonus} bonus)`,
          );
        }
      }

      res.json({ received: true });
    } catch (error) {
      console.error("Stripe webhook error:", error);
      res.status(500).json({ message: "Webhook processing failed" });
    }
  });

  app.post(
    "/api/currency/transfer",
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const fromUserId = req.user?.id;
        if (!fromUserId) {
          return res.status(401).json({ message: "User not authenticated" });
        }

        const { toEmail, amount, description } = req.body;

        if (!toEmail || !amount || amount <= 0) {
          return res
            .status(400)
            .json({ message: "Invalid transfer parameters" });
        }

        // Find the recipient user
        const toUser = await storage.getUserByEmail(toEmail);
        if (!toUser) {
          return res.status(404).json({ message: "Recipient not found" });
        }

        if (toUser.id === fromUserId) {
          return res
            .status(400)
            .json({ message: "Cannot transfer to yourself" });
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
          description || `Transfer to ${toUser.email}`,
        );

        if (!success) {
          return res.status(500).json({ message: "Transfer failed" });
        }

        res.json({ message: "Transfer successful" });
      } catch (error) {
        await logError(error, "POST /api/currency/transfer", {
          request: req,
        });
        res.status(500).json({ message: "Failed to process transfer" });
      }
    },
  );

  // Admin route to credit user accounts (for testing)
  app.post(
    "/api/admin/currency/credit",
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
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
          description || "Account credit",
        );

        if (!success) {
          return res.status(500).json({ message: "Credit failed" });
        }

        res.json({ message: "Account credited successfully" });
      } catch (error) {
        await logError(error, "POST /api/admin/currency/credit", {
          request: req,
        });
        res.status(500).json({ message: "Failed to credit account" });
      }
    },
  );

  // Get leaderboard - top 100 users by reputation
  app.get("/api/leaderboard", async (req, res) => {
    try {
      const leaderboard = await storage.getLeaderboard();
      res.json(leaderboard);
    } catch (error) {
      await logError(error, "GET /api/leaderboard", { request: req });
      res.status(500).json({ message: "Failed to fetch leaderboard" });
    }
  });

  // Simple file upload endpoint for NFT HTML files
  app.post(
    "/api/upload",
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const userId = extractUserId(req);
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
    },
  );

  // Supabase Sync Management Endpoints

  // Get sync status
  app.get(
    "/api/sync/status",
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const stats = await supabaseSyncService.getSyncStats();

        // Get count of unsynced records
        const unsyncedRecords = await storage.getUnsyncedRegistryRecords();

        res.json({
          ...stats,
          pendingCount: unsyncedRecords.length,
          message: stats.configured
            ? stats.connected
              ? `Supabase sync is active. ${unsyncedRecords.length} records pending sync.`
              : "Supabase is configured but connection failed. Check your SUPABASE_DATABASE_URL."
            : "Supabase sync is not configured. Add SUPABASE_DATABASE_URL to enable.",
        });
      } catch (error) {
        await logError(error, "GET /api/sync/status", { request: req });
        res.status(500).json({ message: "Failed to get sync status" });
      }
    },
  );

  // Manually trigger sync for unsynced records
  app.post(
    "/api/sync/trigger",
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const userId = extractUserId(req);
        if (!userId) {
          return res.status(401).json({ message: "Unauthorized" });
        }

        // Check if service is available
        if (!supabaseSyncService.isAvailable()) {
          return res.status(503).json({
            message:
              "Supabase sync is not available. Please configure SUPABASE_DATABASE_URL.",
          });
        }

        // Get all unsynced records
        const unsyncedRecords = await storage.getUnsyncedRegistryRecords();

        if (unsyncedRecords.length === 0) {
          return res.json({
            message: "No records to sync",
            success: 0,
            failed: 0,
          });
        }

        // Batch sync the records
        const result =
          await supabaseSyncService.batchSyncRegistryRecords(unsyncedRecords);

        // Mark successfully synced records in local database
        const successfulIds = unsyncedRecords
          .filter((r) => !result.failedIds.includes(r.id))
          .map((r) => r.id);

        if (successfulIds.length > 0) {
          await storage.markRegistryRecordsSynced(successfulIds);
        }

        res.json({
          message: `Sync completed: ${result.success} succeeded, ${result.failed} failed`,
          ...result,
        });
      } catch (error) {
        await logError(error, "POST /api/sync/trigger", { request: req });
        res.status(500).json({ message: "Failed to trigger sync" });
      }
    },
  );

  // Verify a specific registry record is in Supabase
  app.get(
    "/api/sync/verify/:registryId",
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const { registryId } = req.params;

        if (!supabaseSyncService.isAvailable()) {
          return res.status(503).json({
            message: "Supabase sync is not available",
          });
        }

        const exists =
          await supabaseSyncService.verifyRecordInSupabase(registryId);

        res.json({
          registryId,
          existsInSupabase: exists,
          message: exists
            ? "Record found in Supabase backup"
            : "Record not found in Supabase backup",
        });
      } catch (error) {
        await logError(error, "GET /api/sync/verify/:registryId", {
          request: req,
        });
        res.status(500).json({ message: "Failed to verify record" });
      }
    },
  );

  // Coinbase Commerce Endpoints

  // Get available ticket packages and Coinbase status
  app.get("/api/coinbase/packages", async (req, res) => {
    try {
      const settings = coinbaseService.getSettings();

      res.json({
        packages: TICKET_PACKAGES,
        coinbaseEnabled: settings.enabled,
        coinbaseConfigured: settings.configured,
      });
    } catch (error) {
      await logError(error, "GET /api/coinbase/packages", { request: req });
      res.status(500).json({ message: "Failed to get packages" });
    }
  });

  // Create a custom Coinbase charge with calculated pricing
  app.post(
    "/api/coinbase/create-charge-custom",
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const userId = extractUserId(req);
        if (!userId) {
          return res.status(401).json({ message: "Unauthorized" });
        }

        const { tickets, bonusTickets, price, multiplied, discount } = req.body;

        if (!tickets || !price) {
          return res.status(400).json({ message: "Invalid purchase data" });
        }

        if (!coinbaseService.isAvailable()) {
          return res.status(503).json({
            message:
              "Coinbase payments are not available. Please use Stripe or try again later.",
          });
        }

        // Get user details
        const user = await storage.getUser(userId);
        if (!user) {
          return res.status(404).json({ message: "User not found" });
        }

        // Create custom charge data
        const packageName = multiplied
          ? `${tickets} Tickets*`
          : `${tickets} Tickets`;
        const chargeData = {
          name: `${packageName} (+${bonusTickets} bonus)`,
          description: `${tickets + bonusTickets} total tickets (includes ${bonusTickets} bonus tickets: ${bonusTickets - 10} from demand + 10 from Coinbase payment)`,
          local_price: {
            amount: price.toString(),
            currency: "USD",
          },
          pricing_type: "fixed_price",
          metadata: {
            userId,
            userEmail: user.email,
            userName: user.displayName || "User",
            tickets: tickets.toString(),
            bonusTickets: bonusTickets.toString(),
            totalTickets: (tickets + bonusTickets).toString(),
            multiplied: multiplied ? "true" : "false",
            discount: discount.toString(),
          },
          redirect_url: `${process.env.APP_URL || "http://localhost:5000"}/account?payment=success`,
          cancel_url: `${process.env.APP_URL || "http://localhost:5000"}/account?payment=cancelled`,
        };

        // Use the coinbase service's internal client if available
        const service = coinbaseService as any;
        if (!service.charge) {
          return res
            .status(503)
            .json({ message: "Coinbase service not initialized" });
        }

        const charge = await service.charge.create(chargeData);

        res.json({
          chargeId: charge.id,
          hostedUrl: charge.hosted_url,
        });
      } catch (error) {
        await logError(error, "POST /api/coinbase/create-charge-custom", {
          request: req,
        });
        res.status(500).json({ message: "Failed to create Coinbase charge" });
      }
    },
  );

  // Create a Coinbase charge for ticket purchase (original endpoint for packages)
  app.post(
    "/api/coinbase/create-charge",
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const userId = extractUserId(req);
        if (!userId) {
          return res.status(401).json({ message: "Unauthorized" });
        }

        const { packageIndex } = req.body;

        if (
          packageIndex === undefined ||
          packageIndex < 0 ||
          packageIndex >= TICKET_PACKAGES.length
        ) {
          return res.status(400).json({ message: "Invalid package selected" });
        }

        if (!coinbaseService.isAvailable()) {
          return res.status(503).json({
            message:
              "Coinbase payments are not available. Please try again later or use a different payment method.",
          });
        }

        // Get user details
        const user = await storage.getUser(userId);
        if (!user) {
          return res.status(404).json({ message: "User not found" });
        }

        // Create the charge
        const charge = await coinbaseService.createCharge(
          packageIndex,
          userId,
          user.email,
          user.displayName || "User",
        );

        if (!charge) {
          return res.status(500).json({ message: "Failed to create payment" });
        }

        res.json({
          chargeId: charge.chargeId,
          hostedUrl: charge.hostedUrl,
          package: TICKET_PACKAGES[packageIndex],
        });
      } catch (error) {
        await logError(error, "POST /api/coinbase/create-charge", {
          request: req,
        });
        res.status(500).json({ message: "Failed to create charge" });
      }
    },
  );

  // Webhook endpoint for Coinbase payment confirmations
  app.post("/api/coinbase/webhook", async (req, res) => {
    try {
      const signature = req.headers["x-cc-webhook-signature"] as string;
      const rawBody = JSON.stringify(req.body);

      // Verify the webhook signature
      if (!coinbaseService.verifyWebhookSignature(rawBody, signature)) {
        return res.status(401).json({ message: "Invalid signature" });
      }

      // Process the webhook event
      const event = req.body.event;
      const result = await coinbaseService.processWebhookEvent(event);

      if (result.success && result.userId && result.tickets) {
        // Get metadata for better description
        const metadata = event?.data?.metadata || {};
        const description =
          metadata.multiplied === "true"
            ? `Coinbase purchase: ${metadata.tickets} tickets* (+${metadata.bonusTickets} bonus)`
            : `Coinbase purchase: ${metadata.tickets} tickets (+${metadata.bonusTickets} bonus)`;

        // Credit the user's account with tickets
        const success = await storage.creditUserAccount(
          result.userId,
          result.tickets,
          description,
        );

        if (!success) {
          console.error(
            "[COINBASE] Failed to credit user account:",
            result.userId,
          );
          return res.status(500).json({ message: "Failed to credit account" });
        }

        console.log(
          `[COINBASE] Successfully credited ${result.tickets} tickets to user ${result.userId}`,
        );
      }

      res.json({ received: true });
    } catch (error) {
      await logError(error, "POST /api/coinbase/webhook", { request: req });
      res.status(500).json({ message: "Webhook processing failed" });
    }
  });

  // Admin endpoint to update Coinbase settings
  app.post(
    "/api/admin/coinbase/settings",
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const userId = extractUserId(req);
        if (!userId) {
          return res.status(401).json({ message: "Unauthorized" });
        }

        // Check if user is admin (for now, any authenticated user can update settings)
        // In production, add proper admin role checking
        const user = await storage.getUser(userId);
        if (!user) {
          return res.status(404).json({ message: "User not found" });
        }

        const { apiKey, webhookSecret, enabled } = req.body;

        // Update settings
        const success = await coinbaseService.updateSettings(
          apiKey,
          webhookSecret,
          enabled,
        );

        if (!success) {
          return res
            .status(400)
            .json({
              message:
                "Failed to update settings. Please check your API credentials.",
            });
        }

        res.json({
          message: "Coinbase settings updated successfully",
          settings: coinbaseService.getSettings(),
        });
      } catch (error) {
        await logError(error, "POST /api/admin/coinbase/settings", {
          request: req,
        });
        res.status(500).json({ message: "Failed to update settings" });
      }
    },
  );

  // Get Coinbase settings for admin page
  app.get(
    "/api/admin/coinbase/settings",
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const userId = extractUserId(req);
        if (!userId) {
          return res.status(401).json({ message: "Unauthorized" });
        }

        const settings = coinbaseService.getSettings();

        res.json({
          ...settings,
          hasApiKey: !!process.env.COINBASE_API_KEY,
          hasWebhookSecret: !!process.env.COINBASE_WEBHOOK_SECRET,
        });
      } catch (error) {
        await logError(error, "GET /api/admin/coinbase/settings", {
          request: req,
        });
        res.status(500).json({ message: "Failed to get settings" });
      }
    },
  );

  // Account Deletion Management Endpoints

  // Schedule account deletion
  app.post(
    "/api/user/schedule-deletion",
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const userId = extractUserId(req);
        if (!userId) {
          return res.status(401).json({ message: "Unauthorized" });
        }

        const user = await storage.scheduleAccountDeletion(userId);
        if (!user) {
          return res
            .status(500)
            .json({ message: "Failed to schedule account deletion" });
        }

        const deletionStatus = await storage.getUserDeletionStatus(userId);

        res.json({
          message: "Account deletion scheduled successfully",
          scheduledAt: deletionStatus.scheduledAt,
          daysRemaining: deletionStatus.daysRemaining,
        });
      } catch (error) {
        await logError(error, "POST /api/user/schedule-deletion", {
          request: req,
        });
        res
          .status(500)
          .json({ message: "Failed to schedule account deletion" });
      }
    },
  );

  // Cancel account deletion
  app.post(
    "/api/user/cancel-deletion",
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const userId = extractUserId(req);
        if (!userId) {
          return res.status(401).json({ message: "Unauthorized" });
        }

        const user = await storage.cancelAccountDeletion(userId);
        if (!user) {
          return res
            .status(500)
            .json({ message: "Failed to cancel account deletion" });
        }

        res.json({
          message: "Account deletion cancelled successfully",
        });
      } catch (error) {
        await logError(error, "POST /api/user/cancel-deletion", {
          request: req,
        });
        res.status(500).json({ message: "Failed to cancel account deletion" });
      }
    },
  );

  // Get account deletion status
  app.get(
    "/api/user/deletion-status",
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const userId = extractUserId(req);
        if (!userId) {
          return res.status(401).json({ message: "Unauthorized" });
        }

        const deletionStatus = await storage.getUserDeletionStatus(userId);

        res.json(deletionStatus);
      } catch (error) {
        await logError(error, "GET /api/user/deletion-status", {
          request: req,
        });
        res.status(500).json({ message: "Failed to get deletion status" });
      }
    },
  );

  // NFT Settings Management Endpoints

  // Get NFT settings and status
  app.get(
    "/api/admin/nft/settings",
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const userId = extractUserId(req);
        if (!userId) {
          return res.status(401).json({ message: "Unauthorized" });
        }

        // Check if user is admin
        const isUserAdmin = await isAdmin(userId);
        if (!isUserAdmin) {
          return res.status(403).json({ message: "Admin access required" });
        }

        // Get NFT enabled setting from database
        const nftEnabledSetting = await storage.getSystemSetting("nft_enabled");
        const isEnabled = nftEnabledSetting?.value === "true";

        // Check environment variables for decentralized NFT configuration
        const hasContractAddress = !!process.env.NFT_CONTRACT_ADDRESS;
        const hasRoyaltyWallet = !!process.env.NFT_ROYALTY_WALLET;
        const baseRpcUrl =
          process.env.BASE_RPC_URL || "https://mainnet.base.org";

        // In decentralized mode, we can allow enabling without a deployed contract
        // Users will handle their own minting
        const isConfigured = true; // Always allow enabling in decentralized model

        res.json({
          enabled: isEnabled,
          configured: isConfigured,
          mode: "decentralized",
          status: {
            contractAddress: hasContractAddress,
            royaltyWallet: hasRoyaltyWallet,
            rpcUrl: baseRpcUrl,
          },
          requirements: {
            contractAddress:
              "NFT_CONTRACT_ADDRESS - The deployed TicketRegistry contract address on Base L2",
            royaltyWallet:
              "NFT_ROYALTY_WALLET - Wallet address to receive 2.69% royalties from resales",
            rpcUrl:
              "BASE_RPC_URL - (Optional) RPC endpoint for Base L2, defaults to mainnet",
          },
          description:
            "Users pay tickets and receive unsigned transactions to mint NFTs themselves on Base L2",
        });
      } catch (error) {
        await logError(error, "GET /api/admin/nft/settings", { request: req });
        res.status(500).json({ message: "Failed to get NFT settings" });
      }
    },
  );

  // Update NFT settings
  app.post(
    "/api/admin/nft/settings",
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const userId = extractUserId(req);
        if (!userId) {
          return res.status(401).json({ message: "Unauthorized" });
        }

        // Check if user is admin
        const isUserAdmin = await isAdmin(userId);
        if (!isUserAdmin) {
          return res.status(403).json({ message: "Admin access required" });
        }

        const { enabled } = req.body;

        // Save the enabled state to database
        await storage.setSystemSetting(
          "nft_enabled",
          enabled ? "true" : "false",
          userId,
        );

        res.json({
          message: `NFT features ${enabled ? "enabled" : "disabled"} successfully`,
          enabled,
        });
      } catch (error) {
        await logError(error, "POST /api/admin/nft/settings", { request: req });
        res.status(500).json({ message: "Failed to update NFT settings" });
      }
    },
  );

  // Public endpoint to check if NFT features are enabled
  app.get("/api/nft/enabled", async (req, res) => {
    try {
      const nftEnabledSetting = await storage.getSystemSetting("nft_enabled");
      const isEnabled = nftEnabledSetting?.value === "true";

      res.json({ enabled: isEnabled });
    } catch (error) {
      await logError(error, "GET /api/nft/enabled", { request: req });
      res.json({ enabled: false }); // Default to disabled on error
    }
  });

  // Get SEO settings
  app.get(
    "/api/admin/seo/settings",
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const userId = extractUserId(req);
        if (!userId) {
          return res.status(401).json({ message: "Unauthorized" });
        }

        // Check if user is admin
        const isUserAdmin = await isAdmin(userId);
        if (!isUserAdmin) {
          return res.status(403).json({ message: "Admin access required" });
        }

        // Get SEO settings from database
        const siteName = await storage.getSystemSetting("seo_site_name");
        const defaultDescription = await storage.getSystemSetting(
          "seo_default_description",
        );
        const defaultKeywords = await storage.getSystemSetting(
          "seo_default_keywords",
        );
        const ogImage = await storage.getSystemSetting("seo_og_image");
        const twitterImage =
          await storage.getSystemSetting("seo_twitter_image");
        const favicon = await storage.getSystemSetting("seo_favicon");

        res.json({
          siteName: siteName?.value || "Eventic",
          defaultDescription:
            defaultDescription?.value ||
            "Create and manage events, generate tickets, and validate them via QR codes with Eventic - your complete event management platform.",
          defaultKeywords:
            defaultKeywords?.value ||
            "events, tickets, event management, QR codes, event ticketing, event platform",
          ogImage: ogImage?.value || "",
          twitterImage: twitterImage?.value || "",
          favicon: favicon?.value || "",
        });
      } catch (error) {
        await logError(error, "GET /api/admin/seo/settings", { request: req });
        res.status(500).json({ message: "Failed to get SEO settings" });
      }
    },
  );

  // Update SEO settings
  app.put(
    "/api/admin/seo/settings",
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const userId = extractUserId(req);
        if (!userId) {
          return res.status(401).json({ message: "Unauthorized" });
        }

        // Check if user is admin
        const isUserAdmin = await isAdmin(userId);
        if (!isUserAdmin) {
          return res.status(403).json({ message: "Admin access required" });
        }

        const {
          siteName,
          defaultDescription,
          defaultKeywords,
          ogImage,
          twitterImage,
          favicon,
        } = req.body;

        // Save SEO settings to database
        if (siteName !== undefined) {
          await storage.setSystemSetting("seo_site_name", siteName, userId);
        }
        if (defaultDescription !== undefined) {
          await storage.setSystemSetting(
            "seo_default_description",
            defaultDescription,
            userId,
          );
        }
        if (defaultKeywords !== undefined) {
          await storage.setSystemSetting(
            "seo_default_keywords",
            defaultKeywords,
            userId,
          );
        }
        if (ogImage !== undefined) {
          await storage.setSystemSetting("seo_og_image", ogImage, userId);
        }
        if (twitterImage !== undefined) {
          await storage.setSystemSetting(
            "seo_twitter_image",
            twitterImage,
            userId,
          );
        }
        if (favicon !== undefined) {
          await storage.setSystemSetting("seo_favicon", favicon, userId);
        }

        res.json({
          message: "SEO settings updated successfully",
        });
      } catch (error) {
        await logError(error, "PUT /api/admin/seo/settings", { request: req });
        res.status(500).json({ message: "Failed to update SEO settings" });
      }
    },
  );

  // Public endpoint to get SEO configuration for frontend
  app.get("/api/seo/config", async (req, res) => {
    try {
      // Get SEO settings from database
      const siteName = await storage.getSystemSetting("seo_site_name");
      const defaultDescription = await storage.getSystemSetting(
        "seo_default_description",
      );
      const defaultKeywords = await storage.getSystemSetting(
        "seo_default_keywords",
      );
      const ogImage = await storage.getSystemSetting("seo_og_image");
      const twitterImage = await storage.getSystemSetting("seo_twitter_image");
      const favicon = await storage.getSystemSetting("seo_favicon");

      res.json({
        siteName: siteName?.value || "Eventic",
        defaultDescription:
          defaultDescription?.value ||
          "Create and manage events, generate tickets, and validate them via QR codes with Eventic - your complete event management platform.",
        defaultKeywords:
          defaultKeywords?.value ||
          "events, tickets, event management, QR codes, event ticketing, event platform",
        ogImage: ogImage?.value || "",
        twitterImage: twitterImage?.value || "",
        favicon: favicon?.value || "",
      });
    } catch (error) {
      await logError(error, "GET /api/seo/config", { request: req });
      // Return defaults on error
      res.json({
        siteName: "Eventic",
        defaultDescription:
          "Create and manage events, generate tickets, and validate them via QR codes with Eventic - your complete event management platform.",
        defaultKeywords:
          "events, tickets, event management, QR codes, event ticketing, event platform",
        ogImage: "",
        twitterImage: "",
        favicon: "",
      });
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
