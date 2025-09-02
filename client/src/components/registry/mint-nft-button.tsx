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
  // Try to find the ticket element by different selectors
  const ticketElement = document.querySelector('#ticket-card-for-nft') || 
                        document.querySelector('.ticket-card') || 
                        document.querySelector('.ticket-container');
  if (!ticketElement) throw new Error('Ticket element not found');
  
  // Clone the ticket element
  const clone = ticketElement.cloneNode(true) as HTMLElement;
  
  // Convert all images to base64
  const images = clone.querySelectorAll('img');
  for (let i = 0; i < images.length; i++) {
    const img = images[i];
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
      console.warn('Failed to convert image:', img.src, err);
    }
  }
  
  // Get all stylesheets
  const styles = Array.from(document.styleSheets)
    .map(sheet => {
      try {
        return Array.from(sheet.cssRules)
          .map(rule => rule.cssText)
          .join('\n');
      } catch {
        return '';
      }
    })
    .filter(Boolean)
    .join('\n');
  
  // Create standalone HTML document
  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>NFT Ticket</title>
  <style>${styles}</style>
</head>
<body style="margin: 0; padding: 20px; background: #000; display: flex; justify-content: center; align-items: center; min-height: 100vh;">
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
          
          const response = await apiRequest("POST", "/api/upload", formData);
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
          
          const response = await apiRequest("POST", "/api/upload", formData);
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

      const response = await apiRequest("POST", `/api/tickets/${ticket.id}/mint`, {
        title: title || undefined,
        description: description || undefined,
        metadata: JSON.stringify(metadata)
      });
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