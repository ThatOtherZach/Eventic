import { db } from './db';
import { tickets, events } from '@shared/schema';
import { eq, isNull } from 'drizzle-orm';

export async function migrateExistingTickets() {
  try {
    // Get all tickets without scheduled deletion date
    const ticketsToUpdate = await db
      .select({
        id: tickets.id,
        eventId: tickets.eventId
      })
      .from(tickets)
      .where(isNull(tickets.scheduledDeletion));

    if (ticketsToUpdate.length === 0) {
      console.log('[MIGRATION] No tickets need deletion date migration');
      return;
    }

    console.log(`[MIGRATION] Found ${ticketsToUpdate.length} tickets to migrate`);
    let updated = 0;

    // Get events for these tickets
    const eventIds = [...new Set(ticketsToUpdate.map(t => t.eventId))];
    const eventsList = await db
      .select()
      .from(events)
      .where(eq(events.id, eventIds[0])); // We'll batch these properly

    // Create a map of event IDs to events
    const eventMap = new Map();
    for (const eventId of eventIds) {
      const [event] = await db
        .select()
        .from(events)
        .where(eq(events.id, eventId));
      if (event) {
        eventMap.set(eventId, event);
      }
    }

    // Update each ticket with its deletion date
    for (const ticket of ticketsToUpdate) {
      const event = eventMap.get(ticket.eventId);
      if (event && (event.endDate || event.startDate)) {
        try {
          const baseDate = event.endDate || event.startDate;
          if (!baseDate) continue;
          
          const eventEndDate = new Date(baseDate);
          // Check if date is valid
          if (isNaN(eventEndDate.getTime())) {
            console.log(`[MIGRATION] Skipping ticket ${ticket.id} - invalid event date`);
            continue;
          }
          
          const scheduledDeletion = new Date(eventEndDate);
          scheduledDeletion.setDate(scheduledDeletion.getDate() + 69); // 69 days after event end

          await db
            .update(tickets)
            .set({ scheduledDeletion })
            .where(eq(tickets.id, ticket.id));
          
          updated++;
        } catch (error) {
          console.log(`[MIGRATION] Failed to update ticket ${ticket.id}:`, error);
        }
      }
    }

    console.log(`[MIGRATION] Successfully updated ${updated} tickets with deletion dates`);
  } catch (error) {
    console.error('[MIGRATION] Error migrating ticket deletion dates:', error);
  }
}