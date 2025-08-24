import type { Event } from "@shared/schema";

/**
 * Generate an iCalendar (.ics) file content for an event
 */
export function generateICalendar(event: Event): string {
  const startDateTime = new Date(`${event.date}T${event.time}`);
  const endDateTime = new Date(startDateTime.getTime() + 2 * 60 * 60 * 1000); // Default 2 hours duration
  
  // Format dates to iCalendar format (YYYYMMDDTHHMMSS)
  const formatDate = (date: Date) => {
    return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  };
  
  const icsContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Event Ticket Platform//EN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${event.id}@eventplatform.com`,
    `DTSTART:${formatDate(startDateTime)}`,
    `DTEND:${formatDate(endDateTime)}`,
    `SUMMARY:${event.name}`,
    `DESCRIPTION:${event.description || `Event at ${event.venue}`}`,
    `LOCATION:${event.venue}`,
    'STATUS:CONFIRMED',
    'END:VEVENT',
    'END:VCALENDAR'
  ].join('\r\n');
  
  return icsContent;
}

/**
 * Download an iCalendar file for an event
 */
export function downloadICalendar(event: Event): void {
  const icsContent = generateICalendar(event);
  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const url = window.URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = `${event.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.ics`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}

/**
 * Generate a Google Calendar URL for an event
 */
export function generateGoogleCalendarUrl(event: Event): string {
  const startDateTime = new Date(`${event.date}T${event.time}`);
  const endDateTime = new Date(startDateTime.getTime() + 2 * 60 * 60 * 1000); // Default 2 hours duration
  
  // Format dates for Google Calendar (YYYYMMDDTHHMMSS)
  const formatDate = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${year}${month}${day}T${hours}${minutes}${seconds}`;
  };
  
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.name,
    dates: `${formatDate(startDateTime)}/${formatDate(endDateTime)}`,
    details: event.description || `Event at ${event.venue}`,
    location: event.venue
  });
  
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/**
 * Open Google Calendar in a new tab with event details
 */
export function addToGoogleCalendar(event: Event): void {
  const url = generateGoogleCalendarUrl(event);
  window.open(url, '_blank');
}