import { Request, Response, NextFunction } from 'express';
import { storage } from './storage';

// Extended Request type with Replit Auth user info
export interface AuthenticatedRequest extends Request {
  user?: any; // Replit Auth user from passport
}

// Middleware to require authentication
export async function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  if (!req.isAuthenticated() || !req.user) {
    return res.status(401).json({ message: 'Authentication required' });
  }
  next();
}

// Middleware to require specific permission
export function requirePermission(permissionName: string) {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    // First ensure user is authenticated
    if (!req.isAuthenticated() || !req.user?.claims?.sub) {
      return res.status(401).json({ message: 'Authentication required' });
    }
    
    const userId = req.user.claims.sub;
    
    // Check if user has the required permission
    const hasPermission = await storage.hasPermission(userId, permissionName);
    
    if (!hasPermission) {
      return res.status(403).json({ message: 'Insufficient permissions' });
    }
    
    next();
  };
}

// Middleware to require any of the specified permissions
export function requireAnyPermission(...permissionNames: string[]) {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    // First ensure user is authenticated
    if (!req.isAuthenticated() || !req.user?.claims?.sub) {
      return res.status(401).json({ message: 'Authentication required' });
    }
    
    const userId = req.user.claims.sub;
    
    // Check if user has any of the required permissions
    for (const permission of permissionNames) {
      const hasPermission = await storage.hasPermission(userId, permission);
      if (hasPermission) {
        return next();
      }
    }
    
    return res.status(403).json({ message: 'Insufficient permissions' });
  };
}

// Check if user has admin role
export async function isAdmin(userId: string): Promise<boolean> {
  const roles = await storage.getUserRoles(userId);
  return roles.some(role => role.name === 'super_admin' || role.name === 'event_moderator');
}

// Helper functions for extracting user info from Replit Auth session
export function extractUserId(req: AuthenticatedRequest): string | null {
  return req.user?.claims?.sub || null;
}

export function extractUserEmail(req: AuthenticatedRequest): string | null {
  return req.user?.claims?.email || null;
}

// Middleware to extract user context (for optional auth routes)
export async function extractAuthUser(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  // For Replit Auth, user is already populated by passport
  // This middleware is kept for compatibility but doesn't need to do anything
  next();
}