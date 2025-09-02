import { useEffect, useRef, useState } from 'react';

interface HTMLViewerProps {
  htmlUrl: string;
  title?: string;
  className?: string;
}

export function HTMLViewer({ htmlUrl, title, className = '' }: HTMLViewerProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadHTML = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        // Fetch the HTML content
        const response = await fetch(htmlUrl);
        if (!response.ok) {
          throw new Error('Failed to load HTML content');
        }
        
        const htmlContent = await response.text();
        
        // Write the HTML to the iframe
        if (iframeRef.current) {
          const doc = iframeRef.current.contentDocument || iframeRef.current.contentWindow?.document;
          if (doc) {
            doc.open();
            doc.write(htmlContent);
            doc.close();
          }
        }
        
        setIsLoading(false);
      } catch (err) {
        console.error('Error loading HTML:', err);
        setError('Failed to load NFT content');
        setIsLoading(false);
      }
    };

    if (htmlUrl) {
      loadHTML();
    }
  }, [htmlUrl]);

  return (
    <div className={`position-relative ${className}`}>
      {isLoading && (
        <div className="position-absolute top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center bg-light">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
        </div>
      )}
      
      {error && (
        <div className="alert alert-warning m-2">
          {error}
        </div>
      )}
      
      <iframe
        ref={iframeRef}
        title={title || 'NFT Ticket'}
        className="w-100 h-100 border-0"
        style={{ 
          minHeight: '400px',
          backgroundColor: '#f0f0f0'
        }}
        sandbox="allow-scripts allow-same-origin"
      />
    </div>
  );
}