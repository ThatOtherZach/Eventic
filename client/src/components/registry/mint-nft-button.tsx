import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Sparkles, CheckCircle, Wallet, AlertCircle, ExternalLink } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useWallet } from "@/hooks/use-wallet";
import { WalletConnectButton } from "@/components/wallet-connect-button";
import { Modal, ModalHeader, ModalBody, ModalFooter } from "@/components/ui/modal";
import { ethers } from "ethers";
import type { RegistryRecord } from "@shared/schema";

interface MintNFTButtonProps {
  registry: RegistryRecord;
}

export function MintNFTButton({ registry }: MintNFTButtonProps) {
  const [showMintModal, setShowMintModal] = useState(false);
  const [isMinting, setIsMinting] = useState(false);
  const [transactionHash, setTransactionHash] = useState<string | null>(null);
  const [transactionStatus, setTransactionStatus] = useState<'pending' | 'confirmed' | 'failed' | null>(null);
  
  const { toast } = useToast();
  const { 
    address, 
    isConnected, 
    signer, 
    provider,
    isBaseNetwork 
  } = useWallet();

  const { data: nftEnabled } = useQuery<{ enabled: boolean }>({
    queryKey: ['/api/nft/enabled'],
  });

  // Check if already minted
  if (registry.nftTokenId) {
    return (
      <Button
        variant="outline"
        disabled
        className="w-100"
        data-testid="button-already-minted"
      >
        <CheckCircle className="me-2" size={16} />
        NFT Minted (Blockchain ID: #{registry.nftTokenId})
      </Button>
    );
  }

  // Don't show if NFT is disabled
  if (!nftEnabled?.enabled) {
    return null;
  }

  // Get mint parameters from server
  const getMintParameters = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/registry/${registry.id}/mint-parameters`, {
        walletAddress: address
      });
      return response.json();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to prepare NFT minting",
        variant: "destructive"
      });
    },
  });

  // Execute mint directly on blockchain
  const executeMint = async () => {
    if (!signer || !provider) {
      toast({
        title: "Wallet Not Connected",
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

    setIsMinting(true);
    setTransactionStatus('pending');

    try {
      // Get minting parameters
      const params = await getMintParameters.mutateAsync();
      
      // Create contract instance
      const contract = new ethers.Contract(
        params.contractAddress,
        params.contractABI,
        signer
      );

      // Call the mint function - user pays gas directly
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
      const receipt = await provider.waitForTransaction(tx.hash);
      
      if (receipt && receipt.status === 1) {
        setTransactionStatus('confirmed');
        
        // Extract token ID from event logs
        let tokenId = null;
        if (receipt.logs && receipt.logs.length > 0) {
          for (const log of receipt.logs) {
            if (log.topics && log.topics.length >= 4) {
              // Transfer event: tokenId is in topics[3]
              tokenId = parseInt(log.topics[3], 16).toString();
              break;
            }
          }
        }
        
        // Update registry record on server
        await apiRequest("POST", `/api/registry/${registry.id}/confirm-mint`, {
          transactionHash: tx.hash,
          tokenId: tokenId
        });

        toast({
          title: "NFT Minted Successfully!",
          description: `Your NFT has been minted to ${address}`,
          variant: "success"
        });

        setShowMintModal(false);
        queryClient.invalidateQueries({ queryKey: [`/api/registry/${registry.id}`] });
        queryClient.invalidateQueries({ queryKey: ["/api/registry"] });
        
      } else {
        throw new Error("Transaction failed");
      }
    } catch (error: any) {
      setTransactionStatus('failed');
      
      let errorMessage = "Failed to mint NFT";
      if (error.code === 'ACTION_REJECTED' || error.code === 4001) {
        errorMessage = "Transaction was cancelled";
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      toast({
        title: "Minting Failed",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setIsMinting(false);
    }
  };

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
          Mint Your Collectible as NFT
        </ModalHeader>
        <ModalBody>
          <div className="alert alert-info mb-3" role="alert">
            <strong>What this does:</strong> Mints your digital collectible as a permanent NFT on the blockchain<br/>
            <strong>Gas Cost:</strong> ~$0.01 - $0.50 (paid by you from your wallet)<br/>
            <strong>Network:</strong> Base L2 (Ethereum Layer 2)<br/>
            <strong>Royalty:</strong> 2.69% on resales
          </div>

          {/* Wallet Connection */}
          {!isConnected ? (
            <div className="mb-4 p-4 border rounded bg-gray-50">
              <h5 className="mb-3">Connect Your Wallet</h5>
              <p className="text-sm text-gray-600 mb-3">
                To mint this digital collectible as an NFT, connect your wallet. You'll pay the gas fees (~$0.01-$0.50) directly.
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

          {/* Collectible Info */}
          <div className="mb-3">
            <h6>Collectible Details</h6>
            <div className="small text-muted">
              <div>Event: {registry.eventName}</div>
              <div>Ticket: #{registry.ticketNumber}</div>
              <div>Validated: {registry.ticketValidatedAt ? new Date(registry.ticketValidatedAt).toLocaleDateString() : 'N/A'}</div>
            </div>
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
              {transactionStatus === 'failed' && "Transaction failed."}
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
            onClick={executeMint}
            disabled={!isConnected || !isBaseNetwork || isMinting || getMintParameters.isPending}
            data-testid="button-confirm-mint"
          >
            {isMinting || getMintParameters.isPending ? (
              <>
                <span className="spinner-border spinner-border-sm me-2" />
                {isMinting ? "Minting..." : "Preparing..."}
              </>
            ) : (
              <>
                <Sparkles className="me-2" size={16} />
                Mint NFT (Pay Gas Only)
              </>
            )}
          </Button>
        </ModalFooter>
      </Modal>
    </>
  );
}