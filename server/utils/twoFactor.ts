import * as crypto from 'crypto';
import { createHash, randomBytes } from 'crypto';

// Simple TOTP implementation for 2FA
const TOTP_WINDOW = 30; // 30 seconds window
const TOTP_DIGITS = 6;

// Encryption key for storing secrets (in production, use proper key management)
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex').slice(0, 32);
const ENCRYPTION_IV_LENGTH = 16;

// Encrypt sensitive data
export function encrypt(text: string): string {
  const iv = crypto.randomBytes(ENCRYPTION_IV_LENGTH);
  const cipher = crypto.createCipheriv(
    'aes-256-cbc',
    Buffer.from(ENCRYPTION_KEY, 'utf-8'),
    iv
  );
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  return iv.toString('hex') + ':' + encrypted;
}

// Decrypt sensitive data
export function decrypt(encryptedText: string): string {
  const parts = encryptedText.split(':');
  const iv = Buffer.from(parts[0], 'hex');
  const encrypted = parts[1];
  
  const decipher = crypto.createDecipheriv(
    'aes-256-cbc',
    Buffer.from(ENCRYPTION_KEY, 'utf-8'),
    iv
  );
  
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

// Generate a random base32 secret for TOTP
export function generateTOTPSecret(): string {
  const buffer = crypto.randomBytes(20);
  const base32chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let secret = '';
  
  for (let i = 0; i < buffer.length; i++) {
    secret += base32chars[buffer[i] % 32];
  }
  
  return secret;
}

// Generate backup codes for account recovery
export function generateBackupCodes(count: number = 10): string[] {
  const codes: string[] = [];
  
  for (let i = 0; i < count; i++) {
    const code = crypto.randomBytes(4).toString('hex').toUpperCase();
    codes.push(`${code.slice(0, 4)}-${code.slice(4, 8)}`);
  }
  
  return codes;
}

// Hash backup codes for storage
export function hashBackupCode(code: string): string {
  return createHash('sha256').update(code).digest('hex');
}

// Convert base32 to hex
function base32ToHex(base32: string): string {
  const base32chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  let hex = '';

  for (let i = 0; i < base32.length; i++) {
    const val = base32chars.indexOf(base32.charAt(i).toUpperCase());
    if (val === -1) continue;
    bits += val.toString(2).padStart(5, '0');
  }

  for (let i = 0; i + 4 <= bits.length; i += 4) {
    const chunk = bits.substr(i, 4);
    hex += parseInt(chunk, 2).toString(16);
  }

  return hex;
}

// Generate HMAC
function generateHMAC(secret: string, counter: Buffer): Buffer {
  const key = Buffer.from(base32ToHex(secret), 'hex');
  const hmac = crypto.createHmac('sha1', key);
  hmac.update(counter);
  return hmac.digest();
}

// Generate TOTP token
export function generateTOTPToken(secret: string, time?: number): string {
  const currentTime = time || Math.floor(Date.now() / 1000);
  const counter = Math.floor(currentTime / TOTP_WINDOW);
  
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeUInt32BE(0, 0);
  counterBuffer.writeUInt32BE(counter, 4);
  
  const hmac = generateHMAC(secret, counterBuffer);
  const offset = hmac[hmac.length - 1] & 0xf;
  
  const code = (
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff)
  ) % Math.pow(10, TOTP_DIGITS);
  
  return code.toString().padStart(TOTP_DIGITS, '0');
}

// Verify TOTP token (allows for time drift)
export function verifyTOTPToken(token: string, secret: string, window: number = 1): boolean {
  const currentTime = Math.floor(Date.now() / 1000);
  
  // Check current time and adjacent windows for time drift
  for (let i = -window; i <= window; i++) {
    const testTime = currentTime + (i * TOTP_WINDOW);
    const expectedToken = generateTOTPToken(secret, testTime);
    
    if (token === expectedToken) {
      return true;
    }
  }
  
  return false;
}

// Generate QR code URL for authenticator apps
export function generateTOTPUrl(email: string, secret: string, issuer: string = 'EventTickets'): string {
  return `otpauth://totp/${issuer}:${encodeURIComponent(email)}?secret=${secret}&issuer=${issuer}`;
}

// Session fingerprinting for additional security
export function generateSessionFingerprint(req: any): string {
  const components = [
    req.headers['user-agent'] || '',
    req.headers['accept-language'] || '',
    req.headers['accept-encoding'] || '',
    req.ip || ''
  ];
  
  return createHash('sha256')
    .update(components.join('|'))
    .digest('hex');
}