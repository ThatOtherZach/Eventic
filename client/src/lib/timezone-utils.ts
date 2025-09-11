import { zonedTimeToUtc, utcToZonedTime, formatInTimeZone } from 'date-fns-tz';

/**
 * Creates a Date object from event date and time in the specified timezone
 * @param date - Date string (YYYY-MM-DD format)
 * @param time - Time string (HH:mm format)
 * @param timezone - IANA timezone identifier (e.g., "America/New_York")
 * @returns Date object representing the event time in UTC
 */
export function createEventDateTime(date: string, time: string, timezone: string): Date {
  try {
    // Create a date string in ISO format and convert from timezone to UTC
    const dateTimeString = `${date}T${time}:00`;
    
    // Convert from the specified timezone to UTC
    const utcDate = zonedTimeToUtc(dateTimeString, timezone);
    
    return utcDate;
  } catch (error) {
    console.warn(`Failed to parse date/time in timezone ${timezone}:`, error);
    // Fallback to local interpretation
    return new Date(`${date}T${time}:00`);
  }
}

/**
 * Gets the current time in the specified timezone
 * @param timezone - IANA timezone identifier
 * @returns Date object representing current time in the specified timezone
 */
export function getCurrentTimeInTimezone(timezone: string): Date {
  try {
    const now = new Date();
    return utcToZonedTime(now, timezone);
  } catch (error) {
    console.warn(`Failed to get current time in timezone ${timezone}:`, error);
    return new Date();
  }
}

/**
 * Formats a date for display in a specific timezone
 * @param date - Date object
 * @param timezone - IANA timezone identifier
 * @param formatString - Format string for date-fns
 * @returns Formatted date string
 */
export function formatDateInTimezone(date: Date, timezone: string, formatString: string = 'yyyy-MM-dd HH:mm:ss zzz'): string {
  try {
    return formatInTimeZone(date, timezone, formatString);
  } catch (error) {
    console.warn(`Failed to format date in timezone ${timezone}:`, error);
    return date.toLocaleString();
  }
}

/**
 * Checks if two dates are the same day in a specific timezone
 * @param date1 - First date
 * @param date2 - Second date
 * @param timezone - IANA timezone identifier
 * @returns Boolean indicating if dates are on the same day
 */
export function isSameDayInTimezone(date1: Date, date2: Date, timezone: string): boolean {
  try {
    const zonedDate1 = utcToZonedTime(date1, timezone);
    const zonedDate2 = utcToZonedTime(date2, timezone);
    
    return zonedDate1.getFullYear() === zonedDate2.getFullYear() &&
           zonedDate1.getMonth() === zonedDate2.getMonth() &&
           zonedDate1.getDate() === zonedDate2.getDate();
  } catch (error) {
    console.warn(`Failed to compare dates in timezone ${timezone}:`, error);
    return false;
  }
}