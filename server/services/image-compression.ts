import sharp from 'sharp';

interface CompressionResult {
  data: string; // Base64 encoded result
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
}

export class ImageCompressionService {
  /**
   * Compress a base64 encoded image while preserving animations for GIFs
   */
  static async compressImage(base64Data: string | null): Promise<string | null> {
    if (!base64Data) return null;
    
    try {
      // Extract the data portion from data URL if present
      const base64Match = base64Data.match(/^data:([^;]+);base64,(.+)$/);
      if (!base64Match) return base64Data; // Return as-is if not a data URL
      
      const mimeType = base64Match[1];
      const imageData = base64Match[2];
      const buffer = Buffer.from(imageData, 'base64');
      
      // Check if it's an animated GIF
      if (mimeType === 'image/gif') {
        // For GIFs, reduce quality but keep animation
        // Sharp doesn't support animated GIF compression well, so we'll use a different approach
        // For now, return as-is or implement with a different library like gifsicle
        return await this.compressGif(buffer, mimeType);
      }
      
      // For static images (JPEG, PNG, WebP)
      const compressed = await sharp(buffer)
        .jpeg({ 
          quality: 60, // Reduce quality to 60%
          progressive: true,
          mozjpeg: true // Use mozjpeg encoder for better compression
        })
        .toBuffer();
      
      // Return as base64 data URL
      return `data:image/jpeg;base64,${compressed.toString('base64')}`;
    } catch (error) {
      console.error('[COMPRESSION] Error compressing image:', error);
      return base64Data; // Return original if compression fails
    }
  }
  
  /**
   * Compress animated GIF while preserving animation
   * Note: This is a simplified version. For production, you'd want to use
   * a proper GIF optimization library like gifsicle or gif-resize
   */
  static async compressGif(buffer: Buffer, mimeType: string): Promise<string> {
    try {
      // For now, we'll do a simple size check and mild compression
      // In production, you'd use a library like node-gifsicle for proper GIF optimization
      
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
      return `data:${mimeType};base64,${buffer.toString('base64')}`;
    } catch (error) {
      console.error('[COMPRESSION] Error processing GIF:', error);
      return `data:${mimeType};base64,${buffer.toString('base64')}`;
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