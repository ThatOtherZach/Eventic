// Server-side text formatting utilities

// Convert HTML to plain text (for migration and NFT processing)
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
    .replace(/&nbsp;/g, ' ')
    .replace(/&rsquo;/g, "'")
    .replace(/&lsquo;/g, "'")
    .replace(/&rdquo;/g, '"')
    .replace(/&ldquo;/g, '"')
    .replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–');
  
  // Replace multiple spaces with single space
  text = text.replace(/\s+/g, ' ');
  
  // Trim whitespace
  return text.trim();
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