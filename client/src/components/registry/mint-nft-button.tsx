import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Clock, Sparkles, CheckCircle } from "lucide-react";
import mintTicketIcon from "@assets/image_1756937391196.png";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useNotifications } from "@/hooks/use-notifications";
import { Modal, ModalHeader, ModalBody, ModalFooter } from "@/components/ui/modal";
import type { Ticket, Event, RegistryRecord } from "@shared/schema";

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
  const [walletAddress, setWalletAddress] = useState("");
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
      // Validate wallet address format
      if (!walletAddress || !walletAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
        throw new Error("Please enter a valid Ethereum wallet address");
      }
      
      // Simple mint - just save to registry without any media generation
      const metadata: any = {
        imageUrl: event.imageUrl || '',  // Use event image as placeholder
        mediaType: 'image/png'
      };
      
      if (additionalMetadata) {
        try {
          Object.assign(metadata, JSON.parse(additionalMetadata));
        } catch (e) {
          metadata.notes = additionalMetadata;
        }
      }

      const response = await apiRequest("POST", `/api/tickets/${ticket.id}/mint`, {
        walletAddress: walletAddress,
        title: title || undefined,
        description: description || undefined,
        metadata: JSON.stringify(metadata)
      });
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "NFT Minting Initiated!",
        description: `Your NFT will be minted to ${walletAddress}. Metadata URL: ${data.metadataUrl}`,
      });
      setShowMintModal(false);
      setWalletAddress("");
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
        Mint Ticket in {timeLeft}
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
          <img
            src={mintTicketIcon}
            alt=""
            style={{ width: "16px", height: "16px", marginRight: "8px" }}
          />
          Mint Ticket
        </Button>

        <Modal open={showMintModal} onOpenChange={setShowMintModal}>
          <ModalHeader onClose={() => setShowMintModal(false)}>
            Mint Ticket as NFT
          </ModalHeader>
          <ModalBody>
            <div className="alert alert-info mb-3" role="alert">
              <strong>Cost:</strong> 12 tickets will be charged to mint this NFT.<br/>
              <strong>Note:</strong> Your NFT will be minted on Coinbase's Base L2 blockchain. The NFT metadata will point to your permanent registry record.
            </div>

            <div className="mb-3">
              <label className="form-label">Wallet Address <span className="text-danger">*</span></label>
              <input
                type="text"
                className="form-control"
                placeholder="0x..."
                value={walletAddress}
                onChange={(e) => setWalletAddress(e.target.value)}
                data-testid="input-wallet-address"
                required
              />
              <small className="text-muted">
                Enter your Ethereum wallet address (e.g., from Coinbase Wallet, MetaMask, etc.)
              </small>
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
                  Mint NFT (12 Tickets)
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