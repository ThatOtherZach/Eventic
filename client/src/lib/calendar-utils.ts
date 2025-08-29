import type { Event } from "@shared/schema";

/**
 * Generate an iCalendar (.ics) file content for an event
 */
export function generateICalendar(event: Event): string {
  // Parse the date and time exactly as provided (local time)
  const [year, month, day] = event.date.split('-').map(Number);
  const [hours, minutes] = event.time.split(':').map(Number);
  
  // Create date in local time
  const startDateTime = new Date(year, month - 1, day, hours, minutes, 0);
  
  // Use endDate/endTime if provided, otherwise default to 2 hours duration
  let endDateTime: Date;
  if (event.endDate && event.endTime) {
    const [endYear, endMonth, endDay] = event.endDate.split('-').map(Number);
    const [endHours, endMinutes] = event.endTime.split(':').map(Number);
    endDateTime = new Date(endYear, endMonth - 1, endDay, endHours, endMinutes, 0);
  } else {
    endDateTime = new Date(startDateTime.getTime() + 2 * 60 * 60 * 1000);
  }
  
  // Format dates to iCalendar format (YYYYMMDDTHHMMSS) in local time
  const formatDate = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${year}${month}${day}T${hours}${minutes}${seconds}`;
  };

  // Get timezone string for VTIMEZONE component
  const timezone = event.timezone || "America/New_York";
  
  // Build VTIMEZONE component for proper timezone support
  const vtimezone = [
    'BEGIN:VTIMEZONE',
    `TZID:${timezone}`,
    'END:VTIMEZONE'
  ].join('\r\n');
  
  const icsContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Event Ticket Platform//EN',
    'METHOD:PUBLISH',
    'CALSCALE:GREGORIAN',
    vtimezone,
    'BEGIN:VEVENT',
    `UID:${event.id}@eventplatform.com`,
    `DTSTART;TZID=${timezone}:${formatDate(startDateTime)}`,
    `DTEND;TZID=${timezone}:${formatDate(endDateTime)}`,
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
  // Parse the date and time exactly as provided (local time)
  const [year, month, day] = event.date.split('-').map(Number);
  const [hours, minutes] = event.time.split(':').map(Number);
  
  // Create date in local time
  const startDateTime = new Date(year, month - 1, day, hours, minutes, 0);
  
  // Use endDate/endTime if provided, otherwise default to 2 hours duration
  let endDateTime: Date;
  if (event.endDate && event.endTime) {
    const [endYear, endMonth, endDay] = event.endDate.split('-').map(Number);
    const [endHours, endMinutes] = event.endTime.split(':').map(Number);
    endDateTime = new Date(endYear, endMonth - 1, endDay, endHours, endMinutes, 0);
  } else {
    endDateTime = new Date(startDateTime.getTime() + 2 * 60 * 60 * 1000);
  }
  
  // Format dates for Google Calendar (YYYYMMDDTHHMMSS) in local time
  const formatDate = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${year}${month}${day}T${hours}${minutes}${seconds}`;
  };
  
  // Get timezone for Google Calendar
  const timezone = event.timezone || "America/New_York";
  
  // Add timezone information to the description
  const timezoneInfo = timezone !== "America/New_York" ? `\n\nTimezone: ${timezone}` : "";
  const description = (event.description || `Event at ${event.venue}`) + timezoneInfo;
  
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.name,
    dates: `${formatDate(startDateTime)}/${formatDate(endDateTime)}`,
    details: description,
    location: event.venue,
    ctz: timezone  // Add timezone parameter for Google Calendar
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