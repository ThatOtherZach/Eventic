/**
 * Code Pool Manager
 * Manages pre-generated validation codes for events to enable instant P2P validation
 * without database queries. Codes are stored in memory for O(1) lookups.
 */

// Global code database that builds over time
const GLOBAL_CODE_DATABASE = new Set<string>();

// Map of eventId to Set of used codes for that event
const CODES_BY_EVENT = new Map<string, Set<string>>();

// Map of eventId to all valid codes (for P2P validation)
const P2P_VALIDATION_CACHE = new Map<string, Set<string>>();

// Batch of validations waiting to be written to database
const PENDING_VALIDATIONS: Array<{
  ticketId: string;
  validatorId?: string;
  timestamp: Date;
}> = [];

// Initialize with seed codes for faster initial performance
export function initializeCodePool() {
  // Pre-seed with first 5000 codes to avoid early collisions
  for (let i = 0; i < 5000; i++) {
    GLOBAL_CODE_DATABASE.add(String(i).padStart(4, '0'));
  }
  console.log(`[CODE POOL] Initialized with ${GLOBAL_CODE_DATABASE.size} codes`);
}

/**
 * Hybrid code generation: tries random first, falls back to deterministic
 */
export function generateValidationCode(eventId: string): string {
  let eventCodes = CODES_BY_EVENT.get(eventId);
  if (!eventCodes) {
    eventCodes = new Set<string>();
    CODES_BY_EVENT.set(eventId, eventCodes);
  }

  let attempts = 0;
  let code: string;
  
  // Try random generation first (preserves existing behavior)
  while (attempts < 10) {
    code = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
    
    // Add to global database for future use
    GLOBAL_CODE_DATABASE.add(code);
    
    // Check if unique for this event
    if (!eventCodes.has(code)) {
      eventCodes.add(code);
      
      // Also add to P2P cache if it exists (event already started)
      const p2pCache = P2P_VALIDATION_CACHE.get(eventId);
      if (p2pCache) {
        p2pCache.add(code);
      }
      
      return code;
    }
    attempts++;
  }
  
  // Too many collisions, switch to deterministic mode
  return pickUnusedCode(eventId);
}

/**
 * Deterministic code selection from pre-generated pool
 */
function pickUnusedCode(eventId: string): string {
  const eventCodes = CODES_BY_EVENT.get(eventId) || new Set<string>();
  
  // Ensure we have all possible codes generated
  if (GLOBAL_CODE_DATABASE.size < 10000) {
    for (let i = 0; i < 10000; i++) {
      GLOBAL_CODE_DATABASE.add(String(i).padStart(4, '0'));
    }
  }
  
  // Find first unused code for this event
  for (const code of GLOBAL_CODE_DATABASE) {
    if (!eventCodes.has(code)) {
      eventCodes.add(code);
      CODES_BY_EVENT.set(eventId, eventCodes);
      
      // Also add to P2P cache if it exists
      const p2pCache = P2P_VALIDATION_CACHE.get(eventId);
      if (p2pCache) {
        p2pCache.add(code);
      }
      
      return code;
    }
  }
  
  // This should never happen with 5000 ticket limit
  throw new Error('No validation codes available for event');
}

/**
 * Load all codes for a P2P event into memory for instant validation
 */
export function preloadP2PEventCodes(eventId: string): number {
  const eventCodes = CODES_BY_EVENT.get(eventId);
  
  if (!eventCodes || eventCodes.size === 0) {
    console.log(`[CODE POOL] No codes found for event ${eventId}`);
    return 0;
  }
  
  // Copy to P2P validation cache for fast lookups
  P2P_VALIDATION_CACHE.set(eventId, new Set(eventCodes));
  
  console.log(`[CODE POOL] Preloaded ${eventCodes.size} codes for P2P event ${eventId}`);
  return eventCodes.size;
}

/**
 * Instant validation check using in-memory codes (no database needed)
 */
export function validateCodeInstant(eventId: string, code: string): boolean {
  const validCodes = P2P_VALIDATION_CACHE.get(eventId);
  
  if (!validCodes) {
    // Event not preloaded, fall back to checking event codes
    const eventCodes = CODES_BY_EVENT.get(eventId);
    return eventCodes ? eventCodes.has(code) : false;
  }
  
  return validCodes.has(code);
}

/**
 * Queue a validation for batch database update
 */
export function queueValidation(ticketId: string, validatorId?: string) {
  PENDING_VALIDATIONS.push({
    ticketId,
    validatorId,
    timestamp: new Date()
  });
}

/**
 * Get pending validations and clear the queue
 */
export function getPendingValidations() {
  const validations = [...PENDING_VALIDATIONS];
  PENDING_VALIDATIONS.length = 0;
  return validations;
}

/**
 * Add a code to an event (used when importing existing tickets)
 */
export function addCodeToEvent(eventId: string, code: string) {
  let eventCodes = CODES_BY_EVENT.get(eventId);
  if (!eventCodes) {
    eventCodes = new Set<string>();
    CODES_BY_EVENT.set(eventId, eventCodes);
  }
  
  eventCodes.add(code);
  GLOBAL_CODE_DATABASE.add(code);
  
  // Also update P2P cache if it exists
  const p2pCache = P2P_VALIDATION_CACHE.get(eventId);
  if (p2pCache) {
    p2pCache.add(code);
  }
}

/**
 * Clear codes for an event (when event is archived)
 */
export function clearEventCodes(eventId: string) {
  CODES_BY_EVENT.delete(eventId);
  P2P_VALIDATION_CACHE.delete(eventId);
  console.log(`[CODE POOL] Cleared codes for archived event ${eventId}`);
}

/**
 * Get statistics about the code pool
 */
export function getCodePoolStats() {
  return {
    globalCodes: GLOBAL_CODE_DATABASE.size,
    activeEvents: CODES_BY_EVENT.size,
    p2pEventsLoaded: P2P_VALIDATION_CACHE.size,
    pendingValidations: PENDING_VALIDATIONS.length,
    memoryUsage: {
      globalPool: (GLOBAL_CODE_DATABASE.size * 4) / 1024, // KB
      eventCodes: Array.from(CODES_BY_EVENT.values()).reduce((sum, set) => sum + set.size, 0) * 4 / 1024, // KB
      p2pCache: Array.from(P2P_VALIDATION_CACHE.values()).reduce((sum, set) => sum + set.size, 0) * 4 / 1024 // KB
    }
  };
}

// Initialize on module load
initializeCodePool();