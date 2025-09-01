declare module 'gif.js' {
  interface GIFOptions {
    workers?: number;
    quality?: number;
    width?: number;
    height?: number;
    workerScript?: string;
    repeat?: number;
    transparent?: number | string;
    background?: string;
    debug?: boolean;
  }

  interface AddFrameOptions {
    delay?: number;
    copy?: boolean;
    dispose?: number;
  }

  class GIF {
    constructor(options?: GIFOptions);
    addFrame(image: HTMLCanvasElement | ImageData | CanvasRenderingContext2D, options?: AddFrameOptions): void;
    render(): void;
    on(event: 'finished', callback: (blob: Blob) => void): void;
    on(event: 'error', callback: (error: Error) => void): void;
    on(event: 'progress', callback: (progress: number) => void): void;
    abort(): void;
    running: boolean;
  }

  export default GIF;
}