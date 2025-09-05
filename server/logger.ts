import { db } from "./db";
import { systemLogs } from "@shared/schema";
import { Request } from "express";
import { sql } from "drizzle-orm";

interface LogContext {
  userId?: string;
  eventId?: string;
  ticketId?: string;
  request?: Request & { user?: { id: string } };
  metadata?: Record<string, any>;
}

export async function logError(
  error: Error | any,
  source: string,
  context: LogContext = {}
): Promise<void> {
  try {
    const { request, userId, eventId, ticketId, metadata } = context;
    
    // Extract error details
    const errorMessage = error?.message || String(error);
    const stackTrace = error?.stack || new Error().stack;
    const isSystemError = errorMessage.includes("System Fault Detected:");
    
    // Prepare log entry
    const logEntry = {
      level: isSystemError ? "system" : "error",
      message: errorMessage.substring(0, 1000), // Limit message length
      source: source.substring(0, 255), // File/function where error occurred
      userId: userId || request?.user?.id || null,
      eventId: eventId || null,
      ticketId: ticketId || null,
      errorCode: error?.code || (isSystemError ? "SYSTEM_FAULT" : "ERROR"),
      stackTrace: stackTrace?.substring(0, 5000), // Limit stack trace length
      metadata: JSON.stringify({
        ...metadata,
        timestamp: new Date().toISOString(),
        nodeEnv: process.env.NODE_ENV,
        errorType: error?.constructor?.name,
      }),
      ipAddress: request?.ip || request?.connection?.remoteAddress || null,
      userAgent: request?.headers?.["user-agent"] || null,
      url: request?.originalUrl || request?.url || null,
      method: request?.method || null,
    };
    
    // Insert into database
    await db.insert(systemLogs).values(logEntry);
    
    // Also log to console for immediate visibility
    console.error(`[SYSTEM_LOG] ${source}:`, errorMessage);
    if (process.env.NODE_ENV === "development") {
      console.error("Stack trace:", stackTrace);
    }
  } catch (logError) {
    // If logging fails, at least output to console
    console.error("Failed to write to system log:", logError);
    console.error("Original error:", error);
  }
}

export async function logWarning(
  message: string,
  source: string,
  context: LogContext = {}
): Promise<void> {
  try {
    const { request, userId, eventId, ticketId, metadata } = context;
    
    const logEntry = {
      level: "warning",
      message: message.substring(0, 1000),
      source: source.substring(0, 255),
      userId: userId || request?.user?.id || null,
      eventId: eventId || null,
      ticketId: ticketId || null,
      errorCode: "WARNING",
      stackTrace: null,
      metadata: JSON.stringify({
        ...metadata,
        timestamp: new Date().toISOString(),
        nodeEnv: process.env.NODE_ENV,
      }),
      ipAddress: request?.ip || request?.connection?.remoteAddress || null,
      userAgent: request?.headers?.["user-agent"] || null,
      url: request?.originalUrl || request?.url || null,
      method: request?.method || null,
    };
    
    await db.insert(systemLogs).values(logEntry);
    console.warn(`[SYSTEM_LOG] ${source}:`, message);
  } catch (logError) {
    console.error("Failed to write warning to system log:", logError);
  }
}

export async function logInfo(
  message: string,
  source: string,
  context: LogContext = {}
): Promise<void> {
  try {
    const { request, userId, eventId, ticketId, metadata } = context;
    
    const logEntry = {
      level: "info",
      message: message.substring(0, 1000),
      source: source.substring(0, 255),
      userId: userId || request?.user?.id || null,
      eventId: eventId || null,
      ticketId: ticketId || null,
      errorCode: "INFO",
      stackTrace: null,
      metadata: JSON.stringify({
        ...metadata,
        timestamp: new Date().toISOString(),
        nodeEnv: process.env.NODE_ENV,
      }),
      ipAddress: request?.ip || request?.connection?.remoteAddress || null,
      userAgent: request?.headers?.["user-agent"] || null,
      url: request?.originalUrl || request?.url || null,
      method: request?.method || null,
    };
    
    await db.insert(systemLogs).values(logEntry);
    console.log(`[SYSTEM_LOG] ${source}:`, message);
  } catch (logError) {
    console.error("Failed to write info to system log:", logError);
  }
}

// Cleanup function to remove logs older than 90 days
export async function cleanupOldLogs(): Promise<void> {
  try {
    const result = await db
      .delete(systemLogs)
      .where(sql`expires_at < CURRENT_TIMESTAMP`)
      .returning();
    
    if (result.length > 0) {
      console.log(`[SYSTEM_LOG] Cleaned up ${result.length} expired log entries`);
    }
  } catch (error) {
    console.error("Failed to cleanup old logs:", error);
  }
}

// Schedule cleanup to run daily
export function scheduleLogCleanup(): void {
  // Run cleanup on startup
  cleanupOldLogs();
  
  // Schedule to run every 24 hours
  setInterval(() => {
    cleanupOldLogs();
  }, 24 * 60 * 60 * 1000);
}