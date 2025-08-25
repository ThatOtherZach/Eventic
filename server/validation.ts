import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { logWarning } from './logger';

// Sanitize input to prevent SQL injection and XSS attacks
export function sanitizeInput(input: any): any {
  if (typeof input === 'string') {
    // Remove potential SQL injection patterns
    return input
      .replace(/'/g, "''") // Escape single quotes
      .replace(/;/g, '') // Remove semicolons
      .replace(/--/g, '') // Remove SQL comments
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove script tags
      .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '') // Remove iframes
      .trim();
  }
  
  if (Array.isArray(input)) {
    return input.map(sanitizeInput);
  }
  
  if (input && typeof input === 'object') {
    const sanitized: any = {};
    for (const key in input) {
      sanitized[key] = sanitizeInput(input[key]);
    }
    return sanitized;
  }
  
  return input;
}

// Middleware to validate request body against a Zod schema
export function validateBody<T>(schema: z.ZodSchema<T>) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Sanitize input first
      req.body = sanitizeInput(req.body);
      
      // Validate against schema
      const validated = await schema.parseAsync(req.body);
      req.body = validated;
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        await logWarning(
          'Invalid request data',
          req.path,
          {
            metadata: {
              errors: error.errors,
              body: req.body
            }
          }
        );
        
        // Format error messages for user
        const formattedErrors = error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message
        }));
        
        return res.status(400).json({
          message: 'Validation failed',
          errors: formattedErrors
        });
      }
      
      // Unexpected error
      return res.status(500).json({
        message: 'Internal validation error'
      });
    }
  };
}

// Validate query parameters
export function validateQuery<T>(schema: z.ZodSchema<T>) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Sanitize input first
      req.query = sanitizeInput(req.query);
      
      // Validate against schema
      const validated = await schema.parseAsync(req.query);
      req.query = validated as any;
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        await logWarning(
          'Invalid query parameters',
          req.path,
          {
            metadata: {
              errors: error.errors,
              query: req.query
            }
          }
        );
        
        // Format error messages for user
        const formattedErrors = error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message
        }));
        
        return res.status(400).json({
          message: 'Invalid query parameters',
          errors: formattedErrors
        });
      }
      
      // Unexpected error
      return res.status(500).json({
        message: 'Internal validation error'
      });
    }
  };
}

// Common validation schemas
export const paginationSchema = z.object({
  page: z.string().optional().transform(val => val ? parseInt(val) : 1),
  limit: z.string().optional().transform(val => val ? Math.min(parseInt(val) || 20, 100) : 20)
});

export const idParamSchema = z.object({
  id: z.string().uuid('Invalid ID format')
});

export const searchSchema = z.object({
  q: z.string().min(1).max(100).optional(),
  sort: z.enum(['asc', 'desc', 'newest', 'oldest']).optional(),
  filter: z.string().optional()
});