import * as crypto from 'crypto';

// Encryption for PII data at rest
const ALGORITHM = 'aes-256-gcm';
const SALT_LENGTH = 64;
const TAG_LENGTH = 16;
const IV_LENGTH = 16;
const ITERATIONS = 100000;
const KEY_LENGTH = 32;

// Get or generate encryption key (in production, use proper key management like AWS KMS)
const getEncryptionKey = (): string => {
  return process.env.PII_ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex').slice(0, 32);
};

// Derive key from password
function deriveKey(password: string, salt: Buffer): Buffer {
  return crypto.pbkdf2Sync(password, salt, ITERATIONS, KEY_LENGTH, 'sha256');
}

// Encrypt PII data
export function encryptPII(text: string): string {
  if (!text) return text;
  
  try {
    const password = getEncryptionKey();
    const salt = crypto.randomBytes(SALT_LENGTH);
    const key = deriveKey(password, salt);
    const iv = crypto.randomBytes(IV_LENGTH);
    
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const tag = cipher.getAuthTag();
    
    // Combine salt, iv, tag, and encrypted data
    const combined = Buffer.concat([
      salt,
      iv,
      tag,
      Buffer.from(encrypted, 'hex')
    ]);
    
    return combined.toString('base64');
  } catch (error) {
    console.error('Encryption error:', error);
    return text; // Return original if encryption fails
  }
}

// Decrypt PII data
export function decryptPII(encryptedText: string): string {
  if (!encryptedText) return encryptedText;
  
  try {
    const password = getEncryptionKey();
    const combined = Buffer.from(encryptedText, 'base64');
    
    // Extract components
    const salt = combined.slice(0, SALT_LENGTH);
    const iv = combined.slice(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
    const tag = combined.slice(SALT_LENGTH + IV_LENGTH, SALT_LENGTH + IV_LENGTH + TAG_LENGTH);
    const encrypted = combined.slice(SALT_LENGTH + IV_LENGTH + TAG_LENGTH);
    
    const key = deriveKey(password, salt);
    
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    
    let decrypted = decipher.update(encrypted, null, 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    console.error('Decryption error:', error);
    return encryptedText; // Return encrypted if decryption fails
  }
}

// Hash sensitive data for comparison (one-way)
export function hashSensitiveData(data: string): string {
  return crypto
    .createHash('sha256')
    .update(data + (process.env.HASH_SALT || 'default-salt'))
    .digest('hex');
}

// Anonymize PII for logs and analytics
export function anonymizePII(email: string): string {
  if (!email || !email.includes('@')) return 'anonymous@example.com';
  
  const [localPart, domain] = email.split('@');
  const anonymizedLocal = localPart.charAt(0) + '***' + localPart.charAt(localPart.length - 1);
  
  return `${anonymizedLocal}@${domain}`;
}

// Mask IP addresses for privacy
export function maskIPAddress(ip: string): string {
  if (!ip) return 'unknown';
  
  // IPv4
  if (ip.includes('.')) {
    const parts = ip.split('.');
    return `${parts[0]}.${parts[1]}.xxx.xxx`;
  }
  
  // IPv6
  if (ip.includes(':')) {
    const parts = ip.split(':');
    return `${parts[0]}:${parts[1]}:xxxx:xxxx:xxxx:xxxx:xxxx:xxxx`;
  }
  
  return 'unknown';
}

// Encrypt an object's PII fields
export function encryptObjectPII<T extends Record<string, any>>(
  obj: T,
  piiFields: (keyof T)[]
): T {
  const encrypted = { ...obj };
  
  for (const field of piiFields) {
    if (encrypted[field] && typeof encrypted[field] === 'string') {
      encrypted[field] = encryptPII(encrypted[field] as string) as any;
    }
  }
  
  return encrypted;
}

// Decrypt an object's PII fields
export function decryptObjectPII<T extends Record<string, any>>(
  obj: T,
  piiFields: (keyof T)[]
): T {
  const decrypted = { ...obj };
  
  for (const field of piiFields) {
    if (decrypted[field] && typeof decrypted[field] === 'string') {
      decrypted[field] = decryptPII(decrypted[field] as string) as any;
    }
  }
  
  return decrypted;
}