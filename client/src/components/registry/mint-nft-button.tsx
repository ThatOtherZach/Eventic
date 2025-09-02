import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Clock, Sparkles, CheckCircle } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useNotifications } from "@/hooks/use-notifications";
import { Modal, ModalHeader, ModalBody, ModalFooter } from "@/components/ui/modal";
import { captureTicketAsGif, uploadGifToStorage } from "@/utils/ticket-to-gif";
import html2canvas from "html2canvas";
import type { Ticket, Event, RegistryRecord } from "@shared/schema";

// Helper function to capture ticket HTML with all assets
async function captureTicketHTML(): Promise<string> {
  // Find the ticket card element
  const container = document.getElementById('ticket-card-for-nft');
  if (!container) throw new Error('Container not found');
  
  const ticketElement = container.querySelector('.ticket-card') as HTMLElement;
  if (!ticketElement) throw new Error('Ticket element not found');
  
  // Clone the ticket element
  const clone = ticketElement.cloneNode(true) as HTMLElement;
  
  // Get inline styles from the original
  const originalStyle = ticketElement.getAttribute('style');
  if (originalStyle) {
    clone.setAttribute('style', originalStyle);
  }
  
  // Convert background images in elements with inline style
  const allElements = clone.querySelectorAll('*');
  for (let i = 0; i < allElements.length; i++) {
    const el = allElements[i] as HTMLElement;
    const style = el.getAttribute('style');
    if (style && style.includes('background')) {
      const urlMatch = style.match(/url\(["']?([^"')]+)["']?\)/);
      if (urlMatch && urlMatch[1] && !urlMatch[1].startsWith('data:')) {
        try {
          const response = await fetch(urlMatch[1]);
          const blob = await response.blob();
          const reader = new FileReader();
          const base64 = await new Promise<string>((resolve) => {
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(blob);
          });
          el.style.backgroundImage = `url(${base64})`;
        } catch (err) {
          console.warn('Failed to convert background:', urlMatch[1]);
        }
      }
    }
  }
  
  // Convert img elements to base64
  const images = clone.querySelectorAll('img');
  for (let i = 0; i < images.length; i++) {
    const img = images[i];
    if (!img.src.startsWith('data:')) {
      try {
        const response = await fetch(img.src);
        const blob = await response.blob();
        const reader = new FileReader();
        const base64 = await new Promise<string>((resolve) => {
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(blob);
        });
        img.src = base64;
      } catch (err) {
        console.warn('Failed to convert image:', img.src);
      }
    }
  }
  
  // Get all the CSS we need
  const criticalCSS = `
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
    
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #000;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      padding: 20px;
    }
    
    .ticket-card {
      position: relative;
      width: 100%;
      max-width: 512px;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    }
    
    /* Preserve all the Bootstrap classes used in the ticket */
    .position-relative { position: relative !important; }
    .position-absolute { position: absolute !important; }
    .d-flex { display: flex !important; }
    .flex-column { flex-direction: column !important; }
    .align-items-center { align-items: center !important; }
    .justify-content-center { justify-content: center !important; }
    .text-center { text-align: center !important; }
    .text-white { color: white !important; }
    .fw-bold { font-weight: 700 !important; }
    .badge { display: inline-block; padding: 0.25em 0.6em; font-size: .75em; font-weight: 700; line-height: 1; color: #fff; text-align: center; white-space: nowrap; vertical-align: baseline; border-radius: 0.375rem; }
    .bg-warning { background-color: #ffc107 !important; }
    .bg-danger { background-color: #dc3545 !important; }
    .bg-success { background-color: #198754 !important; }
    .bg-info { background-color: #0dcaf0 !important; }
    .bg-primary { background-color: #0d6efd !important; }
    .opacity-75 { opacity: 0.75 !important; }
    .opacity-90 { opacity: 0.9 !important; }
    
    /* Animations and effects */
    @keyframes shimmer {
      0% { background-position: -1000px 0; }
      100% { background-position: 1000px 0; }
    }
    
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }
    
    @keyframes float {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-10px); }
    }
    
    .shimmer {
      background: linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent);
      background-size: 1000px 100%;
      animation: shimmer 2s infinite;
    }
    
    .pulse {
      animation: pulse 2s infinite;
    }
    
    .float {
      animation: float 3s ease-in-out infinite;
    }
  `;
  
  // Create standalone HTML document
  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>NFT Ticket</title>
  <style>${criticalCSS}</style>
</head>
<body>
  ${clone.outerHTML}
</body>
</html>`;
  
  return html;
}

interface MintNFTButtonProps {
  ticket: Ticket;
  event: Event;
}

interface MintStatus {
  canMint: boolean;
  alreadyMinted: boolean;
  needsValidation?: boolean;
  validatedAt?: string;
  timeRemaining?: number;
  timeRemainingHours?: number;
  registryRecord?: RegistryRecord;
}

export function MintNFTButton({ ticket, event }: MintNFTButtonProps) {
  const [showMintModal, setShowMintModal] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [additionalMetadata, setAdditionalMetadata] = useState("");
  const [timeLeft, setTimeLeft] = useState<string>("");
  const { toast } = useToast();
  const { addNotification } = useNotifications();

  const { data: mintStatus, isLoading, refetch } = useQuery<MintStatus>({
    queryKey: [`/api/tickets/${ticket.id}/mint-status`],
    refetchInterval: 60000, // Refetch every minute
  });

  useEffect(() => {
    if (!mintStatus || mintStatus.canMint || mintStatus.alreadyMinted || mintStatus.needsValidation) {
      setTimeLeft("");
      return;
    }

    const updateCountdown = () => {
      if (mintStatus.timeRemaining) {
        const totalSeconds = Math.floor(mintStatus.timeRemaining / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;

        if (hours > 0) {
          setTimeLeft(`${hours}h ${minutes}m ${seconds}s`);
        } else if (minutes > 0) {
          setTimeLeft(`${minutes}m ${seconds}s`);
        } else {
          setTimeLeft(`${seconds}s`);
        }

        // If countdown is complete, refetch status
        if (totalSeconds <= 0) {
          refetch();
        }
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);

    return () => clearInterval(interval);
  }, [mintStatus, refetch]);

  const mintMutation = useMutation({
    mutationFn: async () => {
      console.log("Starting mint process...");
      let imageUrl = '';
      let mediaType = 'text/html';
      
      // Check if media is already generated
      if (ticket.nftMediaUrl) {
        // Use pre-generated media
        imageUrl = ticket.nftMediaUrl;
        mediaType = ticket.nftMediaUrl.includes('.mp4') ? 'video/mp4' : 
                   ticket.nftMediaUrl.includes('.gif') ? 'image/gif' : 
                   ticket.nftMediaUrl.includes('.html') ? 'text/html' : 'image/png';
        addNotification({
          type: "info",
          title: "Preparing NFT",
          description: "Using pre-generated media for your NFT...",
        });
      } else {
        // Try client-side HTML capture first
        try {
          addNotification({
            type: "info",
            title: "Capturing Ticket",
            description: "Preserving your ticket with all effects and animations...",
          });
          
          const htmlContent = await captureTicketHTML();
          
          // Upload HTML as a file
          const htmlBlob = new Blob([htmlContent], { type: 'text/html' });
          const formData = new FormData();
          formData.append('file', htmlBlob, 'ticket-nft.html');
          
          // Use fetch directly for file upload, not apiRequest (which expects JSON)
          const response = await fetch("/api/upload", {
            method: "POST",
            body: formData,
            credentials: "include"
          });
          
          if (!response.ok) {
            throw new Error(`Upload failed: ${response.status}`);
          }
          
          const data = await response.json();
          imageUrl = data.url;
          mediaType = 'text/html';
        } catch (htmlError) {
          console.error("HTML capture failed, falling back to static image:", htmlError);
          
          // Final fallback: capture as static image
          const ticketElement = document.getElementById('ticket-card-for-nft');
          if (!ticketElement) {
            throw new Error('Unable to find ticket element');
          }
          
          addNotification({
            type: "info",
            title: "Capturing Ticket",
            description: "Creating static image of your ticket...",
          });
          
          const canvas = await html2canvas(ticketElement as HTMLElement);
          const pngBlob = await new Promise<Blob>((resolve) => {
            canvas.toBlob((blob) => resolve(blob!), 'image/png');
          });
          
          // Upload the PNG
          const formData = new FormData();
          formData.append('file', pngBlob, 'ticket.png');
          
          // Use fetch directly for file upload, not apiRequest (which expects JSON)
          const response = await fetch("/api/upload", {
            method: "POST",
            body: formData,
            credentials: "include"
          });
          
          if (!response.ok) {
            throw new Error(`Upload failed: ${response.status}`);
          }
          
          const data = await response.json();
          imageUrl = data.url;
          mediaType = 'image/png';
        }
      }

      const metadata: any = {
        imageUrl,
        mediaType
      };
      if (additionalMetadata) {
        try {
          Object.assign(metadata, JSON.parse(additionalMetadata));
        } catch (e) {
          // If not valid JSON, treat as plain text metadata
          metadata.notes = additionalMetadata;
        }
      }

      console.log("Sending mint request with metadata:", metadata);
      const response = await apiRequest("POST", `/api/tickets/${ticket.id}/mint`, {
        title: title || undefined,
        description: description || undefined,
        metadata: JSON.stringify(metadata)
      });
      console.log("Mint response received");
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success!",
        description: "Your ticket has been minted as an NFT",
      });
      setShowMintModal(false);
      queryClient.invalidateQueries({ queryKey: [`/api/tickets/${ticket.id}/mint-status`] });
      queryClient.invalidateQueries({ queryKey: ["/api/user/registry"] });
    },
    onError: (error: any) => {
      addNotification({
        type: "error",
        title: "Minting Failed",
        description: error.message || "Failed to mint NFT",
      });
    },
  });

  // Don't show button if ticket hasn't been validated
  if (!ticket.isValidated || !mintStatus || mintStatus.needsValidation) {
    return null;
  }

  // Show already minted state
  if (mintStatus.alreadyMinted) {
    return (
      <Button
        variant="outline"
        disabled
        className="w-100"
        data-testid="button-already-minted"
      >
        <CheckCircle className="me-2" size={16} />
        NFT Minted
      </Button>
    );
  }

  // Show countdown timer if not ready yet
  if (!mintStatus.canMint && timeLeft) {
    return (
      <Button
        variant="outline"
        disabled
        className="w-100"
        data-testid="button-mint-countdown"
      >
        <Clock className="me-2" size={16} />
        Mint NFT in {timeLeft}
      </Button>
    );
  }

  // Show mint button when ready
  if (mintStatus.canMint) {
    return (
      <>
        <Button
          variant="default"
          onClick={() => setShowMintModal(true)}
          className="w-100"
          data-testid="button-mint-nft"
        >
          <Sparkles className="me-2" size={16} />
          Mint NFT
        </Button>

        <Modal open={showMintModal} onOpenChange={setShowMintModal}>
          <ModalHeader onClose={() => setShowMintModal(false)}>
            Mint Ticket as NFT
          </ModalHeader>
          <ModalBody>
            <div className="alert alert-info mb-3" role="alert">
              <strong>Note:</strong> Once minted, your ticket becomes a permanent NFT record. 
              A 2.69% royalty fee applies to future sales (75% goes to the event creator).
            </div>

            <div className="mb-3">
              <label className="form-label">NFT Title (optional)</label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g., VIP Concert Experience #001"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                data-testid="input-nft-title"
              />
            </div>

            <div className="mb-3">
              <label className="form-label">Description (optional)</label>
              <textarea
                className="form-control"
                rows={3}
                placeholder="Describe what makes this NFT special..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                data-testid="input-nft-description"
              />
            </div>

            <div className="mb-3">
              <label className="form-label">Additional Metadata (optional)</label>
              <textarea
                className="form-control"
                rows={2}
                placeholder="JSON format or plain text notes"
                value={additionalMetadata}
                onChange={(e) => setAdditionalMetadata(e.target.value)}
                data-testid="input-nft-metadata"
              />
              <small className="text-muted">
                Add any extra information you want to include with your NFT
              </small>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button
              variant="secondary"
              onClick={() => setShowMintModal(false)}
            >
              Cancel
            </Button>
            <Button
              variant="default"
              onClick={() => mintMutation.mutate()}
              disabled={mintMutation.isPending}
              data-testid="button-confirm-mint"
            >
              {mintMutation.isPending ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2" />
                  Minting...
                </>
              ) : (
                <>
                  <Sparkles className="me-2" size={16} />
                  Mint NFT
                </>
              )}
            </Button>
          </ModalFooter>
        </Modal>
      </>
    );
  }

  return null;
}