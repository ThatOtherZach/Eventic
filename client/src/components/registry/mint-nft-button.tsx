import { useState, useEffect, useRef } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Clock, Sparkles, CheckCircle, Camera } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useNotifications } from "@/hooks/use-notifications";
import { Modal, ModalHeader, ModalBody, ModalFooter } from "@/components/ui/modal";
import { captureTicketAsGif } from "@/lib/ticket-capture";
import type { Ticket, RegistryRecord } from "@shared/schema";

interface MintNFTButtonProps {
  ticket: Ticket;
  ticketElementRef?: React.RefObject<HTMLDivElement>;
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

export function MintNFTButton({ ticket, ticketElementRef }: MintNFTButtonProps) {
  const [showMintModal, setShowMintModal] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [additionalMetadata, setAdditionalMetadata] = useState("");
  const [timeLeft, setTimeLeft] = useState<string>("");
  const [isCapturing, setIsCapturing] = useState(false);
  const [capturedGifUrl, setCapturedGifUrl] = useState<string>("");
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

  const captureAndUploadTicket = async (): Promise<string | null> => {
    if (!ticketElementRef?.current) {
      console.error('Ticket element not found for capture');
      return null;
    }

    try {
      setIsCapturing(true);
      
      // Capture the ticket as an animated GIF
      const imageBlob = await captureTicketAsGif({
        element: ticketElementRef.current,
        duration: 2000, // 2 seconds to capture animations
        fps: 10, // 10 frames per second
        quality: 10, // Maximum quality
        width: 600,
        height: 400
      });

      // Get upload URL from server
      const uploadUrlResponse = await apiRequest("POST", "/api/objects/upload");
      const { uploadURL } = await uploadUrlResponse.json();

      // Upload the image to object storage
      const uploadResponse = await fetch(uploadURL, {
        method: 'PUT',
        body: imageBlob,
        headers: {
          'Content-Type': 'image/gif'
        }
      });

      if (!uploadResponse.ok) {
        throw new Error('Failed to upload image');
      }

      // Return the uploaded URL
      return uploadURL.split('?')[0]; // Remove query parameters
    } catch (error) {
      console.error('Error capturing ticket:', error);
      addNotification({
        type: "error",
        title: "Capture Failed",
        description: "Failed to capture ticket image. Minting will continue without visual preservation.",
      });
      return null;
    } finally {
      setIsCapturing(false);
    }
  };

  const mintMutation = useMutation({
    mutationFn: async () => {
      // First capture the ticket as image
      const imageUrl = await captureAndUploadTicket();
      if (imageUrl) {
        setCapturedGifUrl(imageUrl);
      }

      const metadata: any = {};
      if (additionalMetadata) {
        try {
          Object.assign(metadata, JSON.parse(additionalMetadata));
        } catch (e) {
          metadata.notes = additionalMetadata;
        }
      }

      // Add the captured image URL to metadata
      if (imageUrl) {
        metadata.ticketImageUrl = imageUrl;
      }

      const response = await apiRequest("POST", `/api/tickets/${ticket.id}/mint`, {
        title: title || undefined,
        description: description || undefined,
        metadata: JSON.stringify(metadata),
        ticketGifUrl: imageUrl || undefined
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
              <strong>Note:</strong> Your ticket will be captured as an animated GIF to preserve all visual effects, animations and backgrounds. 
              Once minted, it becomes a permanent NFT record. A 2.69% royalty fee applies to future sales (75% goes to the event creator).
            </div>

            {isCapturing && (
              <div className="alert alert-warning mb-3" role="alert">
                <Camera className="me-2" size={16} />
                <strong>Capturing ticket animation...</strong> Please wait (this takes a few seconds to record all effects).
              </div>
            )}

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
              disabled={mintMutation.isPending || isCapturing}
              data-testid="button-confirm-mint"
            >
              {(mintMutation.isPending || isCapturing) ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2" />
                  {isCapturing ? 'Capturing...' : 'Minting...'}
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