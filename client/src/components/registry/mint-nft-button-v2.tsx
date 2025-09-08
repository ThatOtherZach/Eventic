import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Clock, Sparkles, CheckCircle, Wallet, AlertCircle, ExternalLink } from "lucide-react";
import mintTicketIcon from "@assets/image_1756937391196.png";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useNotifications } from "@/hooks/use-notifications";
import { useWallet } from "@/hooks/use-wallet";
import { WalletConnectButton } from "@/components/wallet-connect-button";
import { Modal, ModalHeader, ModalBody, ModalFooter } from "@/components/ui/modal";
import { ethers } from "ethers";
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

interface MintParameters {
  contractAddress: string;
  contractABI: any[];
  registryId: string;
  metadataPath: string;
  withRoyalty: boolean;
  estimatedGas: string;
  ticketCost: number;
}

export function MintNFTButtonV2({ ticket, event }: MintNFTButtonProps) {
  const [showMintModal, setShowMintModal] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [additionalMetadata, setAdditionalMetadata] = useState("");
  const [timeLeft, setTimeLeft] = useState<string>("");
  const [withRoyalty, setWithRoyalty] = useState(true);
  const [isMinting, setIsMinting] = useState(false);
  const [transactionHash, setTransactionHash] = useState<string | null>(null);
  const [transactionStatus, setTransactionStatus] = useState<'pending' | 'confirmed' | 'failed' | null>(null);
  
  const { toast } = useToast();
  const { addNotification } = useNotifications();
  const { 
    address, 
    isConnected, 
    connectWallet, 
    signer, 
    provider,
    isBaseNetwork,
    waitForTransaction 
  } = useWallet();

  const { data: mintStatus, isLoading, refetch } = useQuery<MintStatus>({
    queryKey: [`/api/tickets/${ticket.id}/mint-status`],
    refetchInterval: 60000,
  });

  const { data: nftEnabled } = useQuery<{ enabled: boolean }>({
    queryKey: ['/api/nft/enabled'],
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

        if (totalSeconds <= 0) {
          refetch();
        }
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [mintStatus, refetch]);

  // Prepare mint parameters on server
  const prepareMintMutation = useMutation({
    mutationFn: async () => {
      const metadata: any = {
        imageUrl: event.imageUrl || '',
        mediaType: 'image/png'
      };
      
      if (additionalMetadata) {
        try {
          Object.assign(metadata, JSON.parse(additionalMetadata));
        } catch (e) {
          metadata.notes = additionalMetadata;
        }
      }

      const response = await apiRequest("POST", `/api/tickets/${ticket.id}/prepare-mint`, {
        walletAddress: address,
        title: title || undefined,
        description: description || undefined,
        metadata: JSON.stringify(metadata),
        withRoyalty: withRoyalty
      });
      return response.json() as Promise<MintParameters>;
    },
    onError: (error: any) => {
      addNotification({
        type: "error",
        title: "Preparation Failed",
        description: error.message || "Failed to prepare NFT minting",
      });
    },
  });

  // Execute mint on blockchain
  const executeMint = async (params: MintParameters) => {
    if (!signer || !provider) {
      throw new Error("Wallet not connected");
    }

    setIsMinting(true);
    setTransactionStatus('pending');

    try {
      // Create contract instance
      const contract = new ethers.Contract(
        params.contractAddress,
        params.contractABI,
        signer
      );

      // Call the mint function
      const tx = await contract.mintTicket(
        address,
        params.registryId,
        params.metadataPath,
        params.withRoyalty,
        {
          gasLimit: params.estimatedGas
        }
      );

      setTransactionHash(tx.hash);
      
      toast({
        title: "Transaction Submitted",
        description: (
          <div className="flex items-center gap-2">
            <span>Waiting for confirmation...</span>
            <a 
              href={`https://basescan.org/tx/${tx.hash}`} 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-blue-500 hover:underline"
            >
              View <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        ),
      });

      // Wait for transaction confirmation
      const receipt = await waitForTransaction(tx.hash);
      
      if (receipt && receipt.status === 1) {
        setTransactionStatus('confirmed');
        
        // Confirm mint on server
        await apiRequest("POST", `/api/tickets/${ticket.id}/confirm-mint`, {
          transactionHash: tx.hash,
          tokenId: receipt.logs[0]?.topics[1] // Extract token ID from event
        });

        toast({
          title: "NFT Minted Successfully!",
          description: `Your NFT has been minted to ${address}`,
        });

        setShowMintModal(false);
        queryClient.invalidateQueries({ queryKey: [`/api/tickets/${ticket.id}/mint-status`] });
        queryClient.invalidateQueries({ queryKey: ["/api/user/registry"] });
      } else {
        throw new Error("Transaction failed");
      }
    } catch (error: any) {
      setTransactionStatus('failed');
      
      // Refund tickets if transaction failed
      if (transactionHash) {
        await apiRequest("POST", `/api/tickets/${ticket.id}/refund-mint`, {
          transactionHash,
          reason: error.message
        });
      }

      addNotification({
        type: "error",
        title: "Minting Failed",
        description: error.message || "Failed to mint NFT",
      });
    } finally {
      setIsMinting(false);
    }
  };

  // Handle mint button click
  const handleMint = async () => {
    if (!isConnected) {
      toast({
        title: "Connect Wallet",
        description: "Please connect your wallet first",
        variant: "destructive"
      });
      return;
    }

    if (!isBaseNetwork) {
      toast({
        title: "Wrong Network",
        description: "Please switch to Base network",
        variant: "destructive"
      });
      return;
    }

    try {
      const params = await prepareMintMutation.mutateAsync();
      await executeMint(params);
    } catch (error) {
      console.error("Mint error:", error);
    }
  };

  // Don't show button if NFT is disabled or ticket hasn't been validated
  if (!nftEnabled?.enabled || !ticket.isValidated || !mintStatus || mintStatus.needsValidation) {
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
          Mint Ticket (User Pays Gas)
        </Button>

        <Modal open={showMintModal} onOpenChange={setShowMintModal}>
          <ModalHeader onClose={() => setShowMintModal(false)}>
            Mint Ticket as NFT
          </ModalHeader>
          <ModalBody>
            <div className="alert alert-info mb-3" role="alert">
              <strong>Platform Cost:</strong> {withRoyalty ? '12' : '15'} tickets<br/>
              <strong>Gas Cost:</strong> ~$0.01 - $0.50 (paid by you)<br/>
              <strong>Network:</strong> Base L2 (Ethereum Layer 2)<br/>
              <strong>Note:</strong> You will pay the gas fees directly from your wallet. The NFT will be minted directly to your address.
            </div>

            {/* Wallet Connection Section */}
            {!isConnected ? (
              <div className="mb-4 p-4 border rounded bg-gray-50">
                <h5 className="mb-3">Step 1: Connect Your Wallet</h5>
                <p className="text-sm text-gray-600 mb-3">
                  Connect your wallet to mint the NFT. You'll pay the gas fees (~$0.01-$0.50) directly.
                </p>
                <WalletConnectButton />
              </div>
            ) : (
              <div className="mb-4 p-4 border rounded bg-green-50">
                <h5 className="mb-2 text-green-800">Wallet Connected</h5>
                <p className="text-sm text-green-700">
                  <Wallet className="inline h-4 w-4 mr-1" />
                  {address?.slice(0, 6)}...{address?.slice(-4)}
                </p>
                {!isBaseNetwork && (
                  <p className="text-sm text-yellow-600 mt-2">
                    <AlertCircle className="inline h-4 w-4 mr-1" />
                    Please switch to Base network in your wallet
                  </p>
                )}
              </div>
            )}

            <div className="mb-3">
              <div className="form-check">
                <input
                  type="checkbox"
                  className="form-check-input"
                  id="royaltyCheckbox"
                  checked={withRoyalty}
                  onChange={(e) => setWithRoyalty(e.target.checked)}
                  data-testid="checkbox-royalty"
                />
                <label className="form-check-label" htmlFor="royaltyCheckbox">
                  Include 2.69% royalty fee on resales
                </label>
              </div>
              <small className="text-muted">
                {withRoyalty 
                  ? "Standard minting (12 tickets): 2.69% of resale price goes to platform"
                  : "No royalty minting (15 tickets): No fees on future resales"}
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

            {/* Transaction Status */}
            {transactionStatus && (
              <div className={`alert ${
                transactionStatus === 'pending' ? 'alert-warning' : 
                transactionStatus === 'confirmed' ? 'alert-success' : 
                'alert-danger'
              } mb-3`}>
                {transactionStatus === 'pending' && (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" />
                    Transaction pending... Please wait for confirmation.
                  </>
                )}
                {transactionStatus === 'confirmed' && "Transaction confirmed! NFT minted successfully."}
                {transactionStatus === 'failed' && "Transaction failed. Your tickets have been refunded."}
                {transactionHash && (
                  <div className="mt-2">
                    <a 
                      href={`https://basescan.org/tx/${transactionHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm"
                    >
                      View on BaseScan <ExternalLink className="inline h-3 w-3" />
                    </a>
                  </div>
                )}
              </div>
            )}
          </ModalBody>
          <ModalFooter>
            <Button
              variant="secondary"
              onClick={() => setShowMintModal(false)}
              disabled={isMinting}
            >
              Cancel
            </Button>
            <Button
              variant="default"
              onClick={handleMint}
              disabled={!isConnected || !isBaseNetwork || isMinting || prepareMintMutation.isPending}
              data-testid="button-confirm-mint"
            >
              {isMinting || prepareMintMutation.isPending ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2" />
                  {isMinting ? "Minting..." : "Preparing..."}
                </>
              ) : (
                <>
                  <Sparkles className="me-2" size={16} />
                  Mint NFT ({withRoyalty ? '12' : '15'} Tickets + Gas)
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