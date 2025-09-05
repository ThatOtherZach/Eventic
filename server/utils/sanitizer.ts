// HTML sanitization utility to prevent XSS attacks

const ALLOWED_TAGS = ['p', 'br', 'strong', 'em', 'u', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 
  'ul', 'ol', 'li', 'a', 'blockquote', 'code', 'pre', 'span', 'div'];
const ALLOWED_ATTRIBUTES: { [key: string]: string[] } = {
  'a': ['href', 'title'],
  'span': ['class'],
  'div': ['class']
};

// Basic HTML sanitization - removes dangerous tags and attributes
export function sanitizeHtml(input: string): string {
  if (!input) return '';
  
  // Remove script tags and their content
  let cleaned = input.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  
  // Remove on* event handlers
  cleaned = cleaned.replace(/\s*on\w+\s*=\s*"[^"]*"/gi, '');
  cleaned = cleaned.replace(/\s*on\w+\s*=\s*'[^']*'/gi, '');
  cleaned = cleaned.replace(/\s*on\w+\s*=\s*[^\s>]*/gi, '');
  
  // Remove javascript: protocol
  cleaned = cleaned.replace(/javascript:/gi, '');
  
  // Remove data: protocol (can be used for XSS)
  cleaned = cleaned.replace(/data:text\/html/gi, '');
  
  // Remove style tags
  cleaned = cleaned.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
  
  // Remove iframe, embed, object tags
  cleaned = cleaned.replace(/<(iframe|embed|object)\b[^<]*(?:(?!<\/(iframe|embed|object)>)<[^<]*)*<\/(iframe|embed|object)>/gi, '');
  
  return cleaned;
}

// Strip all HTML tags for plain text fields
export function stripHtml(input: string): string {
  if (!input) return '';
  
  // Remove all HTML tags
  let text = input.replace(/<[^>]*>/g, '');
  
  // Decode HTML entities
  text = text.replace(/&amp;/g, '&');
  text = text.replace(/&lt;/g, '<');
  text = text.replace(/&gt;/g, '>');
  text = text.replace(/&quot;/g, '"');
  text = text.replace(/&#039;/g, "'");
  text = text.replace(/&nbsp;/g, ' ');
  
  return text.trim();
}

// Sanitize user input based on field type
export function sanitizeInput(value: any, fieldType: 'html' | 'text' | 'url' | 'email' = 'text'): string {
  if (typeof value !== 'string') {
    return String(value || '');
  }
  
  switch (fieldType) {
    case 'html':
      return sanitizeHtml(value);
    case 'url':
      // Ensure URL starts with http:// or https://
      const url = value.trim();
      if (url && !url.match(/^https?:\/\//i)) {
        return '';
      }
      return url;
    case 'email':
      // Basic email validation and cleaning
      return value.trim().toLowerCase();
    case 'text':
    default:
      return stripHtml(value);
  }
}

// Sanitize an entire object
export function sanitizeObject<T extends Record<string, any>>(
  obj: T,
  fieldTypes: Partial<Record<keyof T, 'html' | 'text' | 'url' | 'email'>> = {}
): T {
  const sanitized = { ...obj };
  
  for (const key in sanitized) {
    if (typeof sanitized[key] === 'string') {
      const fieldType = fieldTypes[key] || 'text';
      sanitized[key] = sanitizeInput(sanitized[key], fieldType) as any;
    }
  }
  
  return sanitized;
}