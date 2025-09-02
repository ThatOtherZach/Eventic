import puppeteer, { Browser } from 'puppeteer';
import ffmpeg from 'fluent-ffmpeg';
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
      this.browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu'
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

  async captureTicketAsVideo(options: CaptureOptions & { format?: 'mp4' | 'webm' }): Promise<string> {
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
      
      // Set viewport to business card dimensions (scaled up for quality)
      // 3.5" x 2" aspect ratio = 7:4
      await page.setViewport({ 
        width: 1050,  // 3.5 * 300 DPI
        height: 600   // 2 * 300 DPI
      });

      // Generate the HTML for the ticket
      const ticketHTML = this.generateTicketHTML(ticket, event);
      
      // Set the content
      await page.setContent(ticketHTML, { waitUntil: 'networkidle0' });

      // Wait for animations to be ready
      await page.waitForSelector('.ticket-card', { visible: true });

      // Capture frames for animation (3 seconds at 30fps = 90 frames)
      const frameCount = 90;
      const fps = 30;
      
      for (let i = 0; i < frameCount; i++) {
        // Take screenshot
        const framePath = path.join(framesDir, `frame-${String(i).padStart(4, '0')}.png`);
        await page.screenshot({ 
          path: framePath as `${string}.png`,
          type: 'png'
        });

        // Wait for next frame (33ms for 30fps)
        await new Promise(resolve => setTimeout(resolve, 33));
      }

      // Close the page
      await page.close();

      // Convert frames to video using FFmpeg
      if (format === 'mp4') {
        await this.createMP4FromFrames(framesDir, outputPath, fps);
      } else if (format === 'webm') {
        await this.createWebMFromFrames(framesDir, outputPath, fps);
      }

      // Clean up frames directory
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
      
      // Set the content
      await page.setContent(ticketHTML, { waitUntil: 'networkidle0' });

      // Wait for content to render
      await page.waitForSelector('.ticket-card', { visible: true });
      await new Promise(resolve => setTimeout(resolve, 500)); // Let animations settle

      // Take screenshot
      await page.screenshot({ 
        path: outputPath as `${string}.png`,
        type: 'png',
        fullPage: false
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
      ffmpeg()
        .input(path.join(framesDir, 'frame-%04d.png'))
        .inputFPS(fps)
        .output(outputPath)
        .outputOptions([
          '-c:v libx264',
          '-pix_fmt yuv420p',
          '-crf 23',
          '-preset medium'
        ])
        .on('end', () => resolve())
        .on('error', (err: Error) => reject(err))
        .run();
    });
  }

  private createWebMFromFrames(framesDir: string, outputPath: string, fps: number): Promise<void> {
    return new Promise((resolve, reject) => {
      ffmpeg()
        .input(path.join(framesDir, 'frame-%04d.png'))
        .inputFPS(fps)
        .output(outputPath)
        .outputOptions([
          '-c:v libvpx-vp9',
          '-pix_fmt yuv420p',
          '-crf 30',
          '-b:v 0'
        ])
        .on('end', () => resolve())
        .on('error', (err: Error) => reject(err))
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