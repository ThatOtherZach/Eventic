import { db } from "./db";
import { apiKeys, apiKeyRotationLog } from "@shared/schema";
import { eq, and, lte, or } from "drizzle-orm";
import { encrypt, decrypt } from "./utils/twoFactor";
import { hashSensitiveData } from "./utils/encryption";
import { logInfo, logWarning, logAdminAction } from "./logger";
import * as crypto from "crypto";

export interface ApiKeyConfig {
  service: string;
  keyName: string;
  rotationInterval?: number; // days
}

// Supported services for key rotation
export const SUPPORTED_SERVICES: ApiKeyConfig[] = [
  { service: 'stripe', keyName: 'STRIPE_SECRET_KEY', rotationInterval: 90 },
  { service: 'coinbase', keyName: 'COINBASE_API_KEY', rotationInterval: 90 },
  { service: 'coinbase_webhook', keyName: 'COINBASE_WEBHOOK_SECRET', rotationInterval: 180 },
  { service: 'sendgrid', keyName: 'SENDGRID_API_KEY', rotationInterval: 90 },
  { service: 'encryption', keyName: 'ENCRYPTION_KEY', rotationInterval: 365 },
  { service: 'pii_encryption', keyName: 'PII_ENCRYPTION_KEY', rotationInterval: 365 },
];

// Initialize API key tracking
export async function initializeApiKeys(): Promise<void> {
  try {
    for (const config of SUPPORTED_SERVICES) {
      // Check if key exists in tracking
      const existing = await db
        .select()
        .from(apiKeys)
        .where(eq(apiKeys.service, config.service))
        .limit(1);
      
      if (existing.length === 0) {
        // Get current key from environment
        const currentKey = process.env[config.keyName];
        if (currentKey) {
          // Store encrypted key
          const encryptedKey = encrypt(currentKey);
          const nextRotation = new Date();
          nextRotation.setDate(nextRotation.getDate() + (config.rotationInterval || 90));
          
          await db.insert(apiKeys).values({
            service: config.service,
            keyName: config.keyName,
            encryptedKey,
            rotationInterval: config.rotationInterval || 90,
            nextRotation,
            status: 'active'
          });
          
          await logInfo(
            `API key initialized for ${config.service}`,
            "Key Rotation",
            {
              metadata: { service: config.service }
            }
          );
        }
      }
    }
  } catch (error) {
    await logWarning(
      "Failed to initialize API keys",
      "Key Rotation",
      {
        metadata: { error: String(error) }
      }
    );
  }
}

// Get decrypted API key
export async function getApiKey(service: string): Promise<string | null> {
  try {
    const key = await db
      .select()
      .from(apiKeys)
      .where(
        and(
          eq(apiKeys.service, service),
          eq(apiKeys.status, 'active')
        )
      )
      .limit(1);
    
    if (key[0]) {
      return decrypt(key[0].encryptedKey);
    }
    
    // Fallback to environment variable
    const config = SUPPORTED_SERVICES.find(s => s.service === service);
    if (config) {
      return process.env[config.keyName] || null;
    }
    
    return null;
  } catch (error) {
    console.error(`Failed to get API key for ${service}:`, error);
    return null;
  }
}

// Check which keys need rotation
export async function checkKeysForRotation(): Promise<any[]> {
  try {
    const now = new Date();
    const keysNeedingRotation = await db
      .select()
      .from(apiKeys)
      .where(
        and(
          lte(apiKeys.nextRotation, now),
          eq(apiKeys.status, 'active')
        )
      );
    
    return keysNeedingRotation;
  } catch (error) {
    await logWarning(
      "Failed to check keys for rotation",
      "Key Rotation",
      {
        metadata: { error: String(error) }
      }
    );
    return [];
  }
}

// Rotate an API key
export async function rotateApiKey(
  service: string,
  newKey: string,
  adminId: string,
  reason?: string
): Promise<boolean> {
  try {
    const existingKey = await db
      .select()
      .from(apiKeys)
      .where(eq(apiKeys.service, service))
      .limit(1);
    
    if (!existingKey[0]) {
      throw new Error(`No API key found for service: ${service}`);
    }
    
    // Get old key for audit log
    const oldKey = decrypt(existingKey[0].encryptedKey);
    const oldKeyHash = hashSensitiveData(oldKey);
    const newKeyHash = hashSensitiveData(newKey);
    
    // Update the key
    const encryptedNewKey = encrypt(newKey);
    const nextRotation = new Date();
    nextRotation.setDate(nextRotation.getDate() + existingKey[0].rotationInterval);
    
    await db.transaction(async (tx) => {
      // Update API key
      await tx
        .update(apiKeys)
        .set({
          encryptedKey: encryptedNewKey,
          lastRotated: new Date(),
          nextRotation,
          status: 'active'
        })
        .where(eq(apiKeys.id, existingKey[0].id));
      
      // Log rotation
      await tx.insert(apiKeyRotationLog).values({
        keyId: existingKey[0].id,
        oldKeyHash,
        newKeyHash,
        rotatedBy: adminId,
        rotationReason: reason || 'Scheduled rotation'
      });
    });
    
    // Update environment variable in memory (for current session)
    process.env[existingKey[0].keyName] = newKey;
    
    // Log admin action
    await logAdminAction(
      'ROTATE_API_KEY',
      adminId,
      `/api/admin/keys/${service}`,
      {
        service,
        reason,
        nextRotation
      }
    );
    
    await logInfo(
      `API key rotated for ${service}`,
      "Key Rotation",
      {
        userId: adminId,
        metadata: { 
          service,
          reason,
          nextRotation
        }
      }
    );
    
    return true;
  } catch (error) {
    await logWarning(
      `Failed to rotate API key for ${service}`,
      "Key Rotation",
      {
        userId: adminId,
        metadata: { 
          service,
          error: String(error)
        }
      }
    );
    return false;
  }
}

// Get rotation history for a service
export async function getRotationHistory(service: string): Promise<any[]> {
  try {
    const key = await db
      .select()
      .from(apiKeys)
      .where(eq(apiKeys.service, service))
      .limit(1);
    
    if (!key[0]) {
      return [];
    }
    
    const history = await db
      .select({
        rotatedAt: apiKeyRotationLog.rotatedAt,
        rotatedBy: apiKeyRotationLog.rotatedBy,
        reason: apiKeyRotationLog.rotationReason
      })
      .from(apiKeyRotationLog)
      .where(eq(apiKeyRotationLog.keyId, key[0].id))
      .orderBy(apiKeyRotationLog.rotatedAt);
    
    return history;
  } catch (error) {
    console.error(`Failed to get rotation history for ${service}:`, error);
    return [];
  }
}

// Schedule automatic key rotation check
export async function scheduleKeyRotationCheck(): Promise<void> {
  // Check daily for keys that need rotation
  setInterval(async () => {
    const keysToRotate = await checkKeysForRotation();
    
    if (keysToRotate.length > 0) {
      await logWarning(
        `${keysToRotate.length} API keys need rotation`,
        "Key Rotation",
        {
          metadata: {
            services: keysToRotate.map(k => k.service)
          }
        }
      );
      
      // Mark keys as pending rotation
      for (const key of keysToRotate) {
        await db
          .update(apiKeys)
          .set({ status: 'pending_rotation' })
          .where(eq(apiKeys.id, key.id));
      }
    }
  }, 24 * 60 * 60 * 1000); // Check daily
}

// Get all API keys status (for admin dashboard)
export async function getApiKeysStatus(): Promise<any[]> {
  try {
    const keys = await db
      .select({
        service: apiKeys.service,
        lastRotated: apiKeys.lastRotated,
        nextRotation: apiKeys.nextRotation,
        status: apiKeys.status,
        rotationInterval: apiKeys.rotationInterval
      })
      .from(apiKeys)
      .orderBy(apiKeys.nextRotation);
    
    // Calculate days until rotation for each key
    const now = new Date();
    return keys.map(key => ({
      ...key,
      daysUntilRotation: Math.ceil((key.nextRotation.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
      needsRotation: key.status === 'pending_rotation' || key.nextRotation < now
    }));
  } catch (error) {
    console.error('Failed to get API keys status:', error);
    return [];
  }
}