import puppeteer, { Browser } from 'puppeteer';
import ffmpeg from 'fluent-ffmpeg';
import { execFile as execFileCallback } from 'child_process';
import { promisify } from 'util';

const execFile = promisify(execFileCallback);

// Export helper to get ffmpeg binary path
export async function getFFmpegPath(): Promise<string> {
  // In production, this would return the actual ffmpeg binary path
  return 'ffmpeg';
}
import { path as ffmpegPath } from '@ffmpeg-installer/ffmpeg';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import type { Ticket, Event } from '@shared/schema';

// Set ffmpeg path
ffmpeg.setFfmpegPath(ffmpegPath);

interface CaptureOptions {
  ticket: Ticket;
  event: Event;
  outputPath?: string;
}

export class TicketCaptureService {
  private browser: Browser | null = null;
  private tempDir: string = path.join(process.cwd(), 'temp-captures');

  constructor() {
    // Ensure temp directory exists
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
  }

  async initialize() {
    if (!this.browser) {
      // Use system Chromium - the path is dynamically resolved
      const executablePath = '/nix/store/zi4f80l169xlmivz8vja8wlphq74qqk0-chromium-125.0.6422.141/bin/chromium';
      
      this.browser = await puppeteer.launch({
        headless: true,
        executablePath,
        protocolTimeout: 180000, // Increase timeout to 3 minutes
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--disable-web-security',
          '--disable-features=IsolateOrigins,site-per-process'
        ]
      });
    }
  }

  async cleanup() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  async captureTicketAsHTML(options: CaptureOptions): Promise<string> {
    const { ticket, event } = options;
    const sessionId = uuidv4();
    const outputPath = options.outputPath || path.join(this.tempDir, `${sessionId}.html`);

    try {
      // Initialize browser if not already done
      await this.initialize();

      // Create a new page
      const page = await this.browser!.newPage();
      
      // Set viewport to fixed dimensions
      await page.setViewport({ 
        width: 512,
        height: 768
      });

      // Generate snapshot token
      const crypto = require('crypto');
      const snapshotToken = crypto.createHash('sha256')
        .update(`${ticket.id}-snapshot-${new Date().toISOString().split('T')[0]}`)
        .digest('hex')
        .substring(0, 16);

      // Navigate to the render route with snapshot token
      const renderUrl = `http://localhost:5000/api/tickets/${ticket.id}/render?snapshot_token=${snapshotToken}`;
      console.log(`Capturing HTML from: ${renderUrl}`);
      await page.goto(renderUrl, { waitUntil: 'networkidle0' });
      
      // Wait for the ticket element to be present
      await page.waitForSelector('#ticket', { visible: true });
      
      // Wait a bit for animations to initialize
      await new Promise(resolve => setTimeout(resolve, 500));

      // Get the complete HTML of the ticket element including styles
      const ticketHTML = await page.evaluate(() => {
        const ticketEl = document.getElementById('ticket');
        if (!ticketEl) return null;

        // Get all stylesheets
        const styles: string[] = [];
        Array.from(document.styleSheets).forEach(sheet => {
          try {
            if (sheet.cssRules) {
              Array.from(sheet.cssRules).forEach(rule => {
                styles.push(rule.cssText);
              });
            }
          } catch (e) {
            // Skip cross-origin stylesheets
          }
        });

        // Get computed styles for the ticket element
        const computedStyles = window.getComputedStyle(ticketEl);
        
        // Create a standalone HTML document
        const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>NFT Ticket - ${document.title}</title>
  <style>
    /* Reset styles */
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background: #f0f0f0;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      padding: 20px;
    }
    
    /* Include all captured styles */
    ${styles.join('\n')}
    
    /* Ensure ticket is centered and sized correctly */
    #ticket {
      width: ${computedStyles.width};
      height: ${computedStyles.height};
      position: relative;
      overflow: hidden;
    }
  </style>
</head>
<body>
  ${ticketEl.outerHTML}
  <script>
    // Re-initialize any animations
    document.addEventListener('DOMContentLoaded', function() {
      // Restart CSS animations
      const animatedElements = document.querySelectorAll('[style*="animation"]');
      animatedElements.forEach(el => {
        const style = el.getAttribute('style');
        el.setAttribute('style', '');
        setTimeout(() => el.setAttribute('style', style), 10);
      });
    });
  </script>
</body>
</html>`;
        
        return html;
      });

      if (!ticketHTML) {
        throw new Error('Failed to capture ticket HTML');
      }

      // Save HTML to file
      fs.writeFileSync(outputPath, ticketHTML);
      console.log(`HTML saved to: ${outputPath}`);

      // Close the page
      await page.close();

      return outputPath;
    } catch (error) {
      console.error('Error capturing ticket as HTML:', error);
      throw error;
    }
  }

  async captureTicketAsVideo(options: CaptureOptions & { format?: 'mp4' | 'webm' | 'gif' }): Promise<string> {
    const { ticket, event, format = 'mp4' } = options;
    const sessionId = uuidv4();
    const framesDir = path.join(this.tempDir, sessionId);
    const outputPath = options.outputPath || path.join(this.tempDir, `${sessionId}.${format}`);

    try {
      // Initialize browser if not already done
      await this.initialize();

      // Create frames directory
      if (!fs.existsSync(framesDir)) {
        fs.mkdirSync(framesDir, { recursive: true });
      }

      // Create a new page
      const page = await this.browser!.newPage();
      
      // Set viewport to fixed dimensions
      await page.setViewport({ 
        width: 512,
        height: 768
      });

      // Generate snapshot token
      const crypto = require('crypto');
      const snapshotToken = crypto.createHash('sha256')
        .update(`${ticket.id}-snapshot-${new Date().toISOString().split('T')[0]}`)
        .digest('hex')
        .substring(0, 16);

      // Navigate to the render route with snapshot token
      const renderUrl = `http://localhost:5000/api/tickets/${ticket.id}/render?snapshot_token=${snapshotToken}`;
      console.log(`Navigating to render route: ${renderUrl}`);
      await page.goto(renderUrl, { waitUntil: 'networkidle0' });
      
      // Wait for the ticket element to be present
      await page.waitForSelector('#ticket', { visible: true });
      
      // Get the exact clip area of the ticket element
      const clip = await page.$eval('#ticket', el => {
        const r = el.getBoundingClientRect();
        return { 
          x: Math.round(r.x), 
          y: Math.round(r.y), 
          width: Math.round(r.width), 
          height: Math.round(r.height) 
        };
      });

      // Small delay for animations to start
      await new Promise(resolve => setTimeout(resolve, 100));

      // Capture 3 seconds at 30fps = 90 frames
      const frameCount = 90;
      const fps = 30;
      const frameInterval = 1000 / fps; // 33.33ms per frame
      
      // Capture frames sequentially with precise timing
      console.log(`Capturing ${frameCount} frames at ${fps}fps...`);
      for (let i = 0; i < frameCount; i++) {
        const startTime = Date.now();
        const framePath = path.join(framesDir, `f${String(i).padStart(4, '0')}.png`);
        
        // Take screenshot with the exact clip area
        await page.screenshot({ 
          path: framePath as `${string}.png`,
          type: 'png',
          clip
        });
        
        // Calculate timing for next frame
        const elapsed = Date.now() - startTime;
        const waitTime = Math.max(0, frameInterval - elapsed);
        
        if (waitTime > 0) {
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      }

      // Close the page
      await page.close();
      console.log('Frame capture complete');

      // Convert frames to video using FFmpeg
      if (format === 'mp4') {
        await this.createMP4FromFrames(framesDir, outputPath, fps);
      } else if (format === 'webm') {
        await this.createWebMFromFrames(framesDir, outputPath, fps);
      } else if (format === 'gif') {
        await this.createGIFFromFrames(framesDir, outputPath);
      }

      // Clean up frames directory
      console.log('Cleaning up frames...');
      this.cleanupDirectory(framesDir);

      return outputPath;

    } catch (error) {
      // Clean up on error
      if (fs.existsSync(framesDir)) {
        this.cleanupDirectory(framesDir);
      }
      throw error;
    }
  }

  // Legacy method for backward compatibility
  async captureTicketAsMP4(options: CaptureOptions): Promise<string> {
    return this.captureTicketAsVideo({ ...options, format: 'mp4' });
  }

  async captureTicketAsImage(options: CaptureOptions): Promise<string> {
    const { ticket, event } = options;
    const sessionId = uuidv4();
    const outputPath = options.outputPath || path.join(this.tempDir, `${sessionId}.png`);

    try {
      // Initialize browser if not already done
      await this.initialize();

      // Create a new page
      const page = await this.browser!.newPage();
      
      // Set viewport to business card dimensions (scaled up for quality)
      await page.setViewport({ 
        width: 1050,
        height: 600
      });

      // Generate the HTML for the ticket
      const ticketHTML = this.generateTicketHTML(ticket, event);
      
      // Set the content with a simpler wait condition
      await page.setContent(ticketHTML, { waitUntil: 'domcontentloaded' });

      // Wait a moment for rendering
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Take screenshot with timeout
      await page.screenshot({ 
        path: outputPath as `${string}.png`,
        type: 'png',
        fullPage: false,
        timeout: 30000
      });

      // Close the page
      await page.close();

      return outputPath;

    } catch (error) {
      throw error;
    }
  }

  private generateTicketHTML(ticket: Ticket, event: Event): string {
    const specialEffect = this.detectSpecialEffect(event, ticket);
    const hasSpecialEffects = ticket.isGoldenTicket === true || specialEffect !== null;
    const monthlyColor = specialEffect === 'monthly' ? this.getMonthlyColor(event, ticket) : null;

    // Generate styles based on effects
    const animationStyles = hasSpecialEffects ? this.getAnimationStyles(ticket.isGoldenTicket === true, specialEffect, monthlyColor) : '';

    return `
<!DOCTYPE html>
<html>
<head>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      width: 100vw;
      height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #f5f5f5;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }

    .ticket-card {
      width: 100%;
      height: 100%;
      position: relative;
      background: ${event.ticketBackgroundUrl 
        ? `url('${event.ticketBackgroundUrl}') center/cover` 
        : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'};
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 8px 16px rgba(0, 0, 0, 0.2);
    }

    .ticket-overlay {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.4);
      backdrop-filter: blur(2px);
      padding: 32px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      color: white;
    }

    .ticket-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
    }

    .event-name {
      font-size: 28px;
      font-weight: bold;
      margin-bottom: 8px;
      text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.5);
    }

    .event-date {
      font-size: 18px;
      opacity: 0.9;
      text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.5);
    }

    .ticket-number {
      background: rgba(255, 255, 255, 0.2);
      padding: 8px 16px;
      border-radius: 8px;
      font-size: 16px;
      font-weight: 600;
      backdrop-filter: blur(10px);
    }

    .ticket-details {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
    }

    .venue-info {
      font-size: 16px;
      opacity: 0.9;
    }

    .validation-badge {
      background: rgba(34, 197, 94, 0.9);
      padding: 8px 16px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 600;
      display: inline-flex;
      align-items: center;
      gap: 8px;
    }

    .golden-badge {
      position: absolute;
      top: 20px;
      right: 20px;
      background: linear-gradient(135deg, #FFD700, #FFA500);
      color: #000;
      padding: 8px 16px;
      border-radius: 20px;
      font-weight: bold;
      font-size: 14px;
      box-shadow: 0 4px 8px rgba(255, 215, 0, 0.5);
      animation: pulse 2s infinite;
    }

    @keyframes pulse {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.05); }
    }

    ${animationStyles}
  </style>
</head>
<body>
  <div class="ticket-card" id="ticket-card">
    ${hasSpecialEffects ? '<div class="special-effect-overlay"></div>' : ''}
    <div class="ticket-overlay">
      <div class="ticket-header">
        <div>
          <div class="event-name">${event.name}</div>
          <div class="event-date">${new Date(event.date).toLocaleDateString('en-US', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          })}</div>
        </div>
        <div class="ticket-number">#${ticket.ticketNumber}</div>
      </div>
      
      <div class="ticket-details">
        <div class="venue-info">
          <div style="font-weight: 600; margin-bottom: 4px;">Venue</div>
          <div>${event.venue}</div>
        </div>
        ${ticket.isValidated ? `
          <div class="validation-badge">
            <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
              <path d="M10.97 4.97a.75.75 0 0 1 1.07 1.05l-3.99 4.99a.75.75 0 0 1-1.08.02L4.324 8.384a.75.75 0 1 1 1.06-1.06l2.094 2.093 3.473-4.425a.267.267 0 0 1 .02-.022z"/>
            </svg>
            Validated
          </div>
        ` : ''}
      </div>
    </div>
    ${ticket.isGoldenTicket === true ? '<div class="golden-badge">✨ Golden Ticket</div>' : ''}
    ${this.generateStickerOverlay(event, ticket)}
  </div>
</body>
</html>`;
  }

  private getAnimationStyles(isGoldenTicket: boolean, specialEffect: string | null, monthlyColor: string | null): string {
    let styles = '';

    if (isGoldenTicket) {
      styles += `
        .special-effect-overlay {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: linear-gradient(
            45deg,
            rgba(255, 215, 0, 0.1) 0%,
            rgba(255, 223, 0, 0.2) 25%,
            rgba(255, 215, 0, 0.1) 50%,
            rgba(255, 223, 0, 0.2) 75%,
            rgba(255, 215, 0, 0.1) 100%
          );
          animation: golden-shimmer 3s ease-in-out infinite;
          pointer-events: none;
        }

        @keyframes golden-shimmer {
          0%, 100% { opacity: 0.3; transform: translateX(-100%); }
          50% { opacity: 0.6; transform: translateX(100%); }
        }
      `;
    }

    if (specialEffect === 'monthly' && monthlyColor) {
      styles += `
        .special-effect-overlay {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: linear-gradient(
            135deg,
            ${monthlyColor}22 0%,
            ${monthlyColor}44 50%,
            ${monthlyColor}22 100%
          );
          animation: monthly-pulse 4s ease-in-out infinite;
          pointer-events: none;
        }

        @keyframes monthly-pulse {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 0.6; }
        }
      `;
    }

    return styles;
  }

  private detectSpecialEffect(event: Event, ticket: Ticket): string | null {
    // Check for monthly color effect
    const eventDate = new Date(event.date);
    const currentDate = new Date();
    
    if (eventDate.getMonth() === currentDate.getMonth() && 
        eventDate.getFullYear() === currentDate.getFullYear()) {
      return 'monthly';
    }
    
    return null;
  }

  private getMonthlyColor(event: Event, ticket: Ticket): string | null {
    const eventDate = new Date(event.date);
    const month = eventDate.getMonth();
    
    const monthColors = [
      '#FF6B6B', // January - Red
      '#FF6BB5', // February - Pink  
      '#6BCB77', // March - Green
      '#4D96FF', // April - Blue
      '#FFD93D', // May - Yellow
      '#FF8C42', // June - Orange
      '#E84545', // July - Deep Red
      '#6C5CE7', // August - Purple
      '#A8E6CF', // September - Mint
      '#FF8B94', // October - Coral
      '#B4A7D6', // November - Lavender
      '#73A9C2'  // December - Ice Blue
    ];
    
    return monthColors[month];
  }

  private generateStickerOverlay(event: Event, ticket: Ticket): string {
    // Only show sticker if ticket is validated and event has a sticker URL
    if (!ticket.isValidated || !event.stickerUrl) {
      return '';
    }

    // Format the sticker URL properly
    let stickerUrl = event.stickerUrl;
    if (!stickerUrl.startsWith('http')) {
      // If it's a relative path like /objects/..., prepend the base URL
      const baseUrl = process.env.REPLIT_DEV_DOMAIN 
        ? `https://${process.env.REPLIT_DEV_DOMAIN}`
        : 'http://localhost:5000';
      stickerUrl = baseUrl + stickerUrl;
    }

    // Generate multiple floating sticker elements
    const stickerElements = [];
    for (let i = 0; i < 4; i++) {
      const left = Math.random() * 80 + 10; // 10% to 90%
      const top = Math.random() * 60 + 20;  // 20% to 80%
      const size = Math.random() * 20 + 20; // 20px to 40px
      const delay = Math.random() * 6;      // 0s to 6s delay
      
      stickerElements.push(`
        <img 
          src="${stickerUrl}" 
          style="
            position: absolute;
            left: ${left}%;
            top: ${top}%;
            width: ${size}px;
            height: auto;
            z-index: 15;
            pointer-events: none;
            animation: floatSticker 6s ease-in-out ${delay}s infinite;
            opacity: 0.8;
          "
        />
      `);
    }

    // Add the CSS animation for floating stickers
    const styles = `
      <style>
        @keyframes floatSticker {
          0%, 100% {
            transform: translateY(0px) rotate(0deg);
          }
          25% {
            transform: translateY(-10px) rotate(5deg);
          }
          50% {
            transform: translateY(0px) rotate(-5deg);
          }
          75% {
            transform: translateY(-5px) rotate(3deg);
          }
        }
      </style>
    `;

    return styles + stickerElements.join('');
  }

  private createMP4FromFrames(framesDir: string, outputPath: string, fps: number): Promise<void> {
    return new Promise((resolve, reject) => {
      console.log('Encoding MP4 with FFmpeg...');
      ffmpeg()
        .input(path.join(framesDir, 'f%04d.png'))
        .inputFPS(30)
        .output(outputPath)
        .outputOptions([
          '-c:v libx264',
          '-crf 20',
          '-preset veryslow',
          '-pix_fmt yuv420p',
          '-movflags +faststart'
        ])
        .on('end', () => {
          console.log('MP4 encoding complete');
          resolve();
        })
        .on('error', (err: Error) => {
          console.error('FFmpeg MP4 error:', err);
          reject(err);
        })
        .run();
    });
  }

  private createWebMFromFrames(framesDir: string, outputPath: string, fps: number): Promise<void> {
    return new Promise((resolve, reject) => {
      console.log('Encoding WebM with FFmpeg...');
      ffmpeg()
        .input(path.join(framesDir, 'f%04d.png'))
        .inputFPS(30)
        .output(outputPath)
        .outputOptions([
          '-c:v libvpx-vp9',
          '-b:v 0',
          '-crf 30',
          '-pix_fmt yuv420p'
        ])
        .on('end', () => {
          console.log('WebM encoding complete');
          resolve();
        })
        .on('error', (err: Error) => {
          console.error('FFmpeg WebM error:', err);
          reject(err);
        })
        .run();
    });
  }

  private createGIFFromFrames(framesDir: string, outputPath: string): Promise<void> {
    return new Promise(async (resolve, reject) => {
      console.log('Creating GIF with FFmpeg...');
      const palettePath = path.join(path.dirname(outputPath), 'palette.png');
      
      // First generate palette
      await new Promise((res, rej) => {
        ffmpeg()
          .input(path.join(framesDir, 'f%04d.png'))
          .outputOptions([
            '-vf fps=15,scale=480:-1:flags=lanczos,palettegen'
          ])
          .output(palettePath)
          .on('end', () => res(null))
          .on('error', rej)
          .run();
      });
      
      // Then create GIF using palette
      ffmpeg()
        .input(path.join(framesDir, 'f%04d.png'))
        .input(palettePath)
        .outputOptions([
          '-lavfi fps=15,scale=480:-1:flags=lanczos[x];[x][1:v]paletteuse=dither=bayer'
        ])
        .output(outputPath)
        .on('end', () => {
          // Clean up palette file
          if (fs.existsSync(palettePath)) {
            fs.unlinkSync(palettePath);
          }
          console.log('GIF encoding complete');
          resolve();
        })
        .on('error', (err: Error) => {
          console.error('FFmpeg GIF error:', err);
          reject(err);
        })
        .run();
    });
  }

  private cleanupDirectory(dir: string) {
    if (fs.existsSync(dir)) {
      const files = fs.readdirSync(dir);
      for (const file of files) {
        fs.unlinkSync(path.join(dir, file));
      }
      fs.rmdirSync(dir);
    }
  }
}

// Singleton instance
let captureService: TicketCaptureService | null = null;

export function getTicketCaptureService(): TicketCaptureService {
  if (!captureService) {
    captureService = new TicketCaptureService();
  }
  return captureService;
}