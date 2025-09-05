import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { registryRecords } from '@shared/schema';
import { eq } from 'drizzle-orm';
import type { RegistryRecord } from '@shared/schema';

export class SupabaseSyncService {
  private supabaseDb: ReturnType<typeof drizzle> | null = null;
  private isConfigured: boolean = false;
  
  constructor() {
    this.initialize();
  }
  
  private initialize() {
    // Check if SUPABASE_DATABASE_URL is configured
    const supabaseUrl = process.env.SUPABASE_DATABASE_URL;
    
    if (!supabaseUrl) {
      console.log('[SUPABASE SYNC] No SUPABASE_DATABASE_URL configured - sync disabled');
      return;
    }
    
    try {
      // Initialize Supabase connection
      const sql = postgres(supabaseUrl, {
        ssl: 'require',
        max: 1, // Keep connection pool small for sync operations
      });
      
      this.supabaseDb = drizzle(sql);
      this.isConfigured = true;
      console.log('[SUPABASE SYNC] Successfully connected to Supabase');
    } catch (error) {
      console.error('[SUPABASE SYNC] Failed to initialize:', error);
      this.isConfigured = false;
    }
  }
  
  /**
   * Check if Supabase sync is properly configured and available
   */
  public isAvailable(): boolean {
    return this.isConfigured && this.supabaseDb !== null;
  }
  
  /**
   * Sync a single registry record to Supabase
   */
  public async syncRegistryRecord(record: RegistryRecord): Promise<boolean> {
    if (!this.isAvailable()) {
      return false;
    }
    
    try {
      // Upsert the record to Supabase
      await this.supabaseDb!
        .insert(registryRecords)
        .values({
          ...record,
          synced: true,
          syncedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: registryRecords.id,
          set: {
            ...record,
            synced: true,
            syncedAt: new Date(),
          },
        });
      
      console.log(`[SUPABASE SYNC] Successfully synced registry record ${record.id}`);
      return true;
    } catch (error) {
      console.error(`[SUPABASE SYNC] Failed to sync record ${record.id}:`, error);
      return false;
    }
  }
  
  /**
   * Batch sync multiple registry records to Supabase
   */
  public async batchSyncRegistryRecords(records: RegistryRecord[]): Promise<{
    success: number;
    failed: number;
    failedIds: string[];
  }> {
    if (!this.isAvailable()) {
      return {
        success: 0,
        failed: records.length,
        failedIds: records.map(r => r.id),
      };
    }
    
    let success = 0;
    let failed = 0;
    const failedIds: string[] = [];
    
    // Process in batches of 10 to avoid overwhelming the connection
    const batchSize = 10;
    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      
      try {
        // Prepare batch with sync metadata
        const batchWithSync = batch.map(record => ({
          ...record,
          synced: true,
          syncedAt: new Date(),
        }));
        
        // Upsert batch to Supabase
        await this.supabaseDb!
          .insert(registryRecords)
          .values(batchWithSync)
          .onConflictDoUpdate({
            target: registryRecords.id,
            set: {
              synced: true,
              syncedAt: new Date(),
            },
          });
        
        success += batch.length;
        console.log(`[SUPABASE SYNC] Successfully synced batch of ${batch.length} records`);
      } catch (error) {
        console.error(`[SUPABASE SYNC] Failed to sync batch:`, error);
        failed += batch.length;
        failedIds.push(...batch.map(r => r.id));
      }
    }
    
    return { success, failed, failedIds };
  }
  
  /**
   * Get sync statistics
   */
  public async getSyncStats(): Promise<{
    configured: boolean;
    connected: boolean;
    lastSyncTime?: Date;
    pendingCount?: number;
  }> {
    if (!this.isAvailable()) {
      return {
        configured: !!process.env.SUPABASE_DATABASE_URL,
        connected: false,
      };
    }
    
    try {
      // Test the connection with a simple query
      const testResult = await this.supabaseDb!
        .select({ count: registryRecords.id })
        .from(registryRecords)
        .limit(1);
      
      return {
        configured: true,
        connected: true,
      };
    } catch (error) {
      console.error('[SUPABASE SYNC] Connection test failed:', error);
      return {
        configured: true,
        connected: false,
      };
    }
  }
  
  /**
   * Verify a record exists in Supabase
   */
  public async verifyRecordInSupabase(recordId: string): Promise<boolean> {
    if (!this.isAvailable()) {
      return false;
    }
    
    try {
      const [record] = await this.supabaseDb!
        .select({ id: registryRecords.id })
        .from(registryRecords)
        .where(eq(registryRecords.id, recordId))
        .limit(1);
      
      return !!record;
    } catch (error) {
      console.error(`[SUPABASE SYNC] Failed to verify record ${recordId}:`, error);
      return false;
    }
  }
}

// Export singleton instance
export const supabaseSyncService = new SupabaseSyncService();