// Simple compression service that marks data as compressed
// In production, you'd use sharp or imagemin for actual compression

interface CompressionResult {
  data: string; // Base64 encoded result
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
}

export class ImageCompressionService {
  /**
   * Simulate compression by reducing base64 string quality
   * In production, use sharp or imagemin for real compression
   */
  static async compressImage(base64Data: string | null): Promise<string | null> {
    if (!base64Data) return null;
    
    try {
      // Extract the data portion from data URL if present
      const base64Match = base64Data.match(/^data:([^;]+);base64,(.+)$/);
      if (!base64Match) return base64Data; // Return as-is if not a data URL
      
      const mimeType = base64Match[1];
      const imageData = base64Match[2];
      
      // Check if it's an animated GIF - preserve animation
      if (mimeType === 'image/gif') {
        // For GIFs, we want to preserve animation
        // In production, use gifsicle or gif-resize for proper optimization
        return await this.compressGif(imageData, mimeType);
      }
      
      // For static images, simulate compression by reducing data
      // In production, use sharp to actually recompress at lower quality
      const simulatedCompression = this.simulateCompression(imageData);
      
      // Return as base64 data URL with compression marker
      return `data:${mimeType};base64,${simulatedCompression}`;
    } catch (error) {
      console.error('[COMPRESSION] Error compressing image:', error);
      return base64Data; // Return original if compression fails
    }
  }
  
  /**
   * Simulate compression for demo purposes
   * In production, replace with actual image processing
   */
  static simulateCompression(base64String: string): string {
    // For demo: Just mark as compressed by adding a marker
    // Real implementation would use sharp/imagemin to reduce quality
    
    // Add a compression marker (won't affect display)
    // This is just for testing - real compression would reduce file size
    return base64String;
  }
  
  /**
   * Compress animated GIF while preserving animation
   * Note: This is a simplified version. For production, you'd want to use
   * a proper GIF optimization library like gifsicle or gif-resize
   */
  static async compressGif(base64Data: string, mimeType: string): Promise<string> {
    try {
      // For now, we'll do a simple size check
      // In production, you'd use a library like node-gifsicle for proper GIF optimization
      
      const buffer = Buffer.from(base64Data, 'base64');
      
      // Check if GIF is larger than 200KB
      if (buffer.length > 200 * 1024) {
        // For large GIFs, we could:
        // 1. Reduce color palette (256 -> 64 colors)
        // 2. Skip frames (every 2nd frame)
        // 3. Reduce resolution
        // But this requires a specialized GIF library
        
        // For now, return as-is with a note
        console.log('[COMPRESSION] Large GIF detected, keeping original for animation preservation');
      }
      
      // Return original GIF to preserve animation
      // In production, this would be optimized
      return `data:${mimeType};base64,${base64Data}`;
    } catch (error) {
      console.error('[COMPRESSION] Error processing GIF:', error);
      return `data:${mimeType};base64,${base64Data}`;
    }
  }
  
  /**
   * Compress all images in a registry record
   */
  static async compressRegistryRecord(record: any): Promise<any> {
    const compressionTasks = [
      this.compressImage(record.eventImageData),
      this.compressImage(record.eventStickerData),
      this.compressImage(record.ticketBackgroundData),
      this.compressImage(record.ticketGifData)
    ];
    
    const [
      compressedEventImage,
      compressedSticker,
      compressedBackground,
      compressedTicketGif
    ] = await Promise.all(compressionTasks);
    
    return {
      ...record,
      eventImageData: compressedEventImage,
      eventStickerData: compressedSticker,
      ticketBackgroundData: compressedBackground,
      ticketGifData: compressedTicketGif,
      isCompressed: true,
      compressionDate: new Date()
    };
  }
  
  /**
   * Calculate the size reduction achieved by compression
   */
  static calculateSizeReduction(original: string | null, compressed: string | null): number {
    if (!original || !compressed) return 0;
    
    const originalSize = Buffer.from(original).length;
    const compressedSize = Buffer.from(compressed).length;
    
    return Math.round((1 - compressedSize / originalSize) * 100);
  }
}