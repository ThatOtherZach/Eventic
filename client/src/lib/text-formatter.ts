// Safe text formatter for event descriptions
// Converts plain text to safe HTML with URL detection and line breaks

export function formatDescription(text: string): string {
  if (!text) return '';
  
  // First, escape HTML to prevent injection
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
  
  // Convert URLs to clickable links
  // Matches http://, https://, or www. URLs
  const urlPattern = /(https?:\/\/[^\s]+)|(www\.[^\s]+)/gi;
  const withUrls = escaped.replace(urlPattern, (match) => {
    const href = match.startsWith('http') ? match : `https://${match}`;
    // Ensure URLs are safe and add rel="noopener noreferrer" for security
    return `<a href="${href}" target="_blank" rel="noopener noreferrer" class="text-primary">${match}</a>`;
  });
  
  // Convert hashtags to links
  const withHashtags = withUrls.replace(
    /#([a-zA-Z0-9_]+)/g,
    '<a href="/hashtag/$1" class="text-decoration-none">#$1</a>'
  );
  
  // Convert line breaks to <br> tags
  const withLineBreaks = withHashtags.replace(/\n/g, '<br>');
  
  return withLineBreaks;
}

// Extract hashtags from plain text
export function extractHashtags(text: string): string[] {
  if (!text) return [];
  
  const hashtagPattern = /#([a-zA-Z0-9_]+)/g;
  const hashtags: string[] = [];
  let match;
  
  while ((match = hashtagPattern.exec(text)) !== null) {
    hashtags.push(match[1].toLowerCase());
  }
  
  // Return unique hashtags
  return [...new Set(hashtags)];
}

// Convert HTML to plain text (for migration)
export function htmlToPlainText(html: string): string {
  if (!html) return '';
  
  // Remove HTML tags
  let text = html.replace(/<[^>]*>/g, '');
  
  // Decode HTML entities
  text = text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&nbsp;/g, ' ');
  
  // Replace multiple spaces with single space
  text = text.replace(/\s+/g, ' ');
  
  // Trim whitespace
  return text.trim();
}

// Count characters (for form validation)
export function countCharacters(text: string): number {
  return text ? text.length : 0;
}