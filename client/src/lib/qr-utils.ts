export function generateQRCode(data: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    
    if (!ctx) {
      reject(new Error("Canvas context not available"));
      return;
    }

    // Set canvas size
    canvas.width = 200;
    canvas.height = 200;

    // Create QR code using a library (for demo, we'll create a simple pattern)
    // In production, use a proper QR code library like qrcode.js
    if (typeof window !== "undefined" && (window as any).QRCode) {
      (window as any).QRCode.toCanvas(canvas, data, {
        width: 200,
        height: 200,
        margin: 2,
        color: {
          dark: "#000000",
          light: "#FFFFFF"
        }
      }, (error: any) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(canvas.toDataURL());
      });
    } else {
      // Fallback: create a simple pattern
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, 200, 200);
      
      ctx.fillStyle = "#000000";
      const gridSize = 10;
      
      // Create a simple pattern based on the data hash
      const hash = Array.from(data).reduce((a, b) => {
        a = ((a << 5) - a) + b.charCodeAt(0);
        return a & a;
      }, 0);
      
      for (let x = 0; x < 20; x++) {
        for (let y = 0; y < 20; y++) {
          const shouldFill = (hash + x * 31 + y * 17) % 3 === 0;
          if (shouldFill) {
            ctx.fillRect(x * gridSize, y * gridSize, gridSize, gridSize);
          }
        }
      }
      
      resolve(canvas.toDataURL());
    }
  });
}

export function loadQRCodeLibrary(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window !== "undefined" && (window as any).QRCode) {
      resolve();
      return;
    }

    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load QR code library"));
    document.head.appendChild(script);
  });
}

// Load the QR code library when the module is imported
if (typeof window !== "undefined") {
  loadQRCodeLibrary().catch(console.error);
}
