import type { Event } from "@shared/schema";

/**
 * Generate an iCalendar (.ics) file content for an event
 */
export function generateICalendar(event: Event): string {
  // Parse the date and time - these are in the event's local timezone
  const [year, month, day] = event.date.split('-');
  const [hours, minutes] = event.time.split(':');
  
  // Format start date for the event's timezone
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

  // Get timezone string
  const timezone = event.timezone || "America/New_York";
  
  // For iCal, we use the TZID parameter with the timezone name
  // This tells calendar apps to interpret the time in that specific timezone
  const icsContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Event Ticket Platform//EN',
    'METHOD:PUBLISH',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${event.id}@eventplatform.com`,
    `DTSTART;TZID=${timezone}:${startDateStr}`,
    `DTEND;TZID=${timezone}:${endDateStr}`,
    `SUMMARY:${event.name}`,
    `DESCRIPTION:${event.description || `Event at ${event.venue}`}\n\nView event details: ${window.location.origin}/events/${event.id}`,
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
  // Parse the date and time - these are in the event's local timezone
  const [year, month, day] = event.date.split('-');
  const [hours, minutes] = event.time.split(':');
  
  // Format start date for the event's timezone
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
  
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.name,
    dates: `${startDateStr}/${endDateStr}`,
    details: `${event.description || `Event at ${event.venue}`}\n\nView event details: ${window.location.origin}/events/${event.id}`,
    location: event.venue,
    ctz: timezone  // This tells Google Calendar what timezone the dates are in
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