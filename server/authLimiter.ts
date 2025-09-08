import { Request, Response, NextFunction } from 'express';
import { storage } from './storage';
import { AuthenticatedRequest } from './auth';
import { logWarning } from './logger';

// Track CAPTCHA attempts per IP
const captchaAttempts = new Map<string, { failures: number; lastAttempt: Date }>();

// Clean up old CAPTCHA attempts bi-weekly
setInterval(() => {
  const now = new Date();
  Array.from(captchaAttempts.entries()).forEach(([ip, data]) => {
    if (now.getTime() - data.lastAttempt.getTime() > 30 * 60 * 1000) {
      captchaAttempts.delete(ip);
    }
  });
}, 14 * 24 * 60 * 60 * 1000); // Bi-weekly (14 days)

export async function checkLoginRateLimit(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const { email } = req.body;
  const ipAddress = req.ip || 'unknown';
  
  try {
    // First check if IP is blocked
    const isBlocked = await storage.isIpBlocked(ipAddress);
    if (isBlocked) {
      const blockedIp = await storage.getBlockedIp(ipAddress);
      const unblockTime = blockedIp?.unblockAt;
      const minutesLeft = unblockTime ? Math.ceil((unblockTime.getTime() - Date.now()) / 60000) : 30;
      
      await storage.recordAuthEvent({
        type: 'rate_limit_hit',
        email,
        ipAddress,
        metadata: JSON.stringify({ reason: 'ip_blocked' })
      });
      
      return res.status(429).json({
        message: `Your IP has been temporarily blocked due to too many requests. Please try again in ${minutesLeft} minutes.`,
        requiresCaptcha: false,
        blocked: true,
        minutesRemaining: minutesLeft
      });
    }
    
    // Check email rate limit (3 per 30 minutes)
    const recentAttempts = await storage.getRecentLoginAttempts(email, 30);
    if (recentAttempts.length >= 3) {
      await storage.recordAuthEvent({
        type: 'rate_limit_hit',
        email,
        ipAddress,
        metadata: JSON.stringify({ reason: 'email_limit' })
      });
      
      return res.status(429).json({
        message: 'Too many login attempts for this email. Please wait 30 minutes before trying again.',
        requiresCaptcha: false,
        emailLimitExceeded: true
      });
    }
    
    // Check IP rate limit (10 requests in 10 minutes means blocking)
    const failedIpAttempts = await storage.getFailedLoginAttemptsFromIp(ipAddress, 10);
    if (failedIpAttempts.length >= 10) {
      // Block the IP for 30 minutes
      const unblockAt = new Date(Date.now() + 30 * 60 * 1000);
      await storage.blockIp({
        ipAddress,
        reason: 'Too many failed login attempts',
        unblockAt
      });
      
      await storage.recordAuthEvent({
        type: 'rate_limit_hit',
        email,
        ipAddress,
        metadata: JSON.stringify({ reason: 'ip_blocked_new' })
      });
      
      return res.status(429).json({
        message: 'Your IP has been temporarily blocked due to too many failed attempts. Please try again in 30 minutes.',
        requiresCaptcha: false,
        blocked: true,
        minutesRemaining: 30
      });
    }
    
    // Check if CAPTCHA is required (3 failed attempts from this IP)
    if (failedIpAttempts.length >= 3) {
      const captchaData = captchaAttempts.get(ipAddress);
      
      // If no CAPTCHA token provided, require it
      if (!req.body.captchaToken) {
        return res.status(400).json({
          message: 'Too many failed attempts. Please complete the CAPTCHA.',
          requiresCaptcha: true
        });
      }
      
      // Simple CAPTCHA validation (in production, integrate with reCAPTCHA or similar)
      // For now, we'll just track if they provided something
      if (req.body.captchaToken !== 'valid-captcha-token') {
        // Track failed CAPTCHA
        if (captchaData) {
          captchaData.failures++;
          captchaData.lastAttempt = new Date();
        } else {
          captchaAttempts.set(ipAddress, { failures: 1, lastAttempt: new Date() });
        }
        
        return res.status(400).json({
          message: 'Invalid CAPTCHA. Please try again.',
          requiresCaptcha: true
        });
      }
      
      // Clear CAPTCHA tracking on success
      captchaAttempts.delete(ipAddress);
    }
    
    next();
  } catch (error) {
    await logWarning('Login rate limit check failed', 'checkLoginRateLimit', {
      metadata: { error: (error as Error).message, email, ipAddress }
    });
    // Allow request to continue on error
    next();
  }
}

// Clean up expired IP blocks bi-weekly
setInterval(async () => {
  try {
    await storage.unblockExpiredIps();
  } catch (error) {
    console.error('Failed to unblock expired IPs:', error);
  }
}, 14 * 24 * 60 * 60 * 1000); // Bi-weekly (14 days)