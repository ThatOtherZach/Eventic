import type { Event } from "@shared/schema";

/**
 * Generate an iCalendar (.ics) file content for an event
 */
export function generateICalendar(event: Event): string {
  // Parse the date and time directly without creating Date objects
  // This ensures no timezone conversion issues
  const [year, month, day] = event.date.split('-');
  const [hours, minutes] = event.time.split(':');
  
  // Format start date directly from strings
  const startDateStr = `${year}${month.padStart(2, '0')}${day.padStart(2, '0')}T${hours.padStart(2, '0')}${minutes.padStart(2, '0')}00`;
  
  // Calculate end date
  let endDateStr: string;
  if (event.endDate && event.endTime) {
    const [endYear, endMonth, endDay] = event.endDate.split('-');
    const [endHours, endMinutes] = event.endTime.split(':');
    endDateStr = `${endYear}${endMonth.padStart(2, '0')}${endDay.padStart(2, '0')}T${endHours.padStart(2, '0')}${endMinutes.padStart(2, '0')}00`;
  } else {
    // Default to 2 hours duration
    const startHour = parseInt(hours);
    const endHour = (startHour + 2) % 24;
    const isNextDay = startHour + 2 >= 24;
    const endDayNum = parseInt(day) + (isNextDay ? 1 : 0);
    endDateStr = `${year}${month.padStart(2, '0')}${String(endDayNum).padStart(2, '0')}T${String(endHour).padStart(2, '0')}${minutes.padStart(2, '0')}00`;
  }

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
    `DTSTART;TZID=${timezone}:${startDateStr}`,
    `DTEND;TZID=${timezone}:${endDateStr}`,
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
  // Parse the date and time directly without creating Date objects
  const [year, month, day] = event.date.split('-');
  const [hours, minutes] = event.time.split(':');
  
  // Format start date directly from strings
  const startDateStr = `${year}${month.padStart(2, '0')}${day.padStart(2, '0')}T${hours.padStart(2, '0')}${minutes.padStart(2, '0')}00`;
  
  // Calculate end date
  let endDateStr: string;
  if (event.endDate && event.endTime) {
    const [endYear, endMonth, endDay] = event.endDate.split('-');
    const [endHours, endMinutes] = event.endTime.split(':');
    endDateStr = `${endYear}${endMonth.padStart(2, '0')}${endDay.padStart(2, '0')}T${endHours.padStart(2, '0')}${endMinutes.padStart(2, '0')}00`;
  } else {
    // Default to 2 hours duration
    const startHour = parseInt(hours);
    const endHour = (startHour + 2) % 24;
    const isNextDay = startHour + 2 >= 24;
    const endDayNum = parseInt(day) + (isNextDay ? 1 : 0);
    endDateStr = `${year}${month.padStart(2, '0')}${String(endDayNum).padStart(2, '0')}T${String(endHour).padStart(2, '0')}${minutes.padStart(2, '0')}00`;
  }
  
  // Get timezone for Google Calendar
  const timezone = event.timezone || "America/New_York";
  
  // Add timezone information to the description
  const timezoneInfo = timezone !== "America/New_York" ? `\n\nTimezone: ${timezone}` : "";
  const description = (event.description || `Event at ${event.venue}`) + timezoneInfo;
  
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.name,
    dates: `${startDateStr}/${endDateStr}`,
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