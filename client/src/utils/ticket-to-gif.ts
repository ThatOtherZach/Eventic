import html2canvas from 'html2canvas';
import GIF from 'gif.js';

export async function captureTicketAsGif(ticketElement: HTMLElement): Promise<Blob> {
  // Capture the ticket element as a canvas
  const canvas = await html2canvas(ticketElement, {
    backgroundColor: null,
    scale: 2, // Higher quality
    logging: false,
    useCORS: true, // Allow cross-origin images
    allowTaint: true,
  });

  // Create a GIF encoder
  const gif = new GIF({
    workers: 2,
    quality: 10,
    width: canvas.width,
    height: canvas.height,
    workerScript: '/gif.worker.js'
  });

  // Add the canvas as a frame (static GIF with single frame)
  gif.addFrame(canvas, { delay: 100 });

  // Convert to blob
  return new Promise((resolve, reject) => {
    gif.on('finished', (blob: Blob) => {
      resolve(blob);
    });

    gif.on('error', reject);

    gif.render();
  });
}

export async function uploadGifToStorage(gifBlob: Blob): Promise<string> {
  // Get upload URL from backend
  const uploadResponse = await fetch('/api/objects/upload', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include'
  });

  if (!uploadResponse.ok) {
    throw new Error('Failed to get upload URL');
  }

  const { uploadURL } = await uploadResponse.json();

  // Upload GIF directly to storage
  const response = await fetch(uploadURL, {
    method: 'PUT',
    body: gifBlob,
    headers: {
      'Content-Type': 'image/gif',
    },
  });

  if (!response.ok) {
    throw new Error('Failed to upload GIF');
  }

  // Extract the base URL (without query parameters)
  const baseUrl = uploadURL.split('?')[0];
  
  // Convert the storage URL to our public endpoint URL
  // Extract the filename from the storage URL
  const parts = baseUrl.split('/');
  const filename = parts[parts.length - 1];
  const publicUrl = `/public-objects/uploads/${filename}`;
  
  return publicUrl;
}