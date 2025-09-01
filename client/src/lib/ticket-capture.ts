import html2canvas from 'html2canvas';
import GIF from 'gif.js';

export interface CaptureOptions {
  element: HTMLElement;
  duration?: number; // Duration in milliseconds to capture animations
  fps?: number; // Frames per second
  quality?: number; // GIF quality (1-10)
  width?: number;
  height?: number;
}

export async function captureTicketAsGif({
  element,
  duration = 3000, // 3 seconds by default to capture animations
  fps = 10,
  quality = 10,
  width = 600,
  height = 400
}: CaptureOptions): Promise<Blob> {
  return new Promise((resolve, reject) => {
    // Create GIF encoder
    const gif = new GIF({
      workers: 2,
      quality,
      width,
      height,
      workerScript: '/gif.worker.js'
    });

    const frameInterval = 1000 / fps;
    const totalFrames = Math.floor(duration / frameInterval);
    let capturedFrames = 0;

    // Function to capture a single frame
    const captureFrame = async () => {
      try {
        const canvas = await html2canvas(element, {
          backgroundColor: null,
          scale: 2, // Higher quality
          width: width,
          height: height,
          useCORS: true,
          allowTaint: true,
          logging: false
        });

        // Add frame to GIF
        gif.addFrame(canvas, { delay: frameInterval });
        capturedFrames++;

        if (capturedFrames < totalFrames) {
          setTimeout(captureFrame, frameInterval);
        } else {
          // All frames captured, render GIF
          gif.render();
        }
      } catch (error) {
        console.error('Error capturing frame:', error);
        reject(error);
      }
    };

    // Start capturing frames
    captureFrame();

    // Handle GIF completion
    gif.on('finished', (blob: Blob) => {
      resolve(blob);
    });

    gif.on('error', (error: Error) => {
      reject(error);
    });
  });
}

export async function captureTicketAsImage(element: HTMLElement): Promise<Blob> {
  try {
    const canvas = await html2canvas(element, {
      backgroundColor: null,
      scale: 2,
      width: 600,
      height: 400,
      useCORS: true,
      allowTaint: true,
      logging: false
    });

    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Failed to convert canvas to blob'));
        }
      }, 'image/png');
    });
  } catch (error) {
    console.error('Error capturing ticket as image:', error);
    throw error;
  }
}