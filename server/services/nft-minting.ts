// Decentralized NFT minting service - users mint their own NFTs
// This service only provides utility methods for the decentralized flow

class NFTMintingService {
  constructor() {
    const contractAddress = process.env.NFT_CONTRACT_ADDRESS;
    const royaltyWallet = process.env.NFT_ROYALTY_WALLET;
    
    if (!contractAddress) {
      console.log("[NFT] Contract address not configured. Set NFT_CONTRACT_ADDRESS to enable NFT features.");
    }
    
    if (!royaltyWallet) {
      console.log("[NFT] Warning: NFT_ROYALTY_WALLET not set. Royalty collection will not work properly.");
    }
    
    if (contractAddress) {
      console.log("[NFT] Decentralized minting service initialized");
      console.log("[NFT] Contract address:", contractAddress);
      console.log("[NFT] Users will mint their own NFTs on Base L2");
    }
  }

  /**
   * Get the OpenSea URL for a minted NFT
   */
  getOpenSeaUrl(tokenId: string): string {
    const contractAddress = process.env.NFT_CONTRACT_ADDRESS;
    if (!contractAddress) return "";
    
    const network = process.env.BASE_NETWORK === "testnet" ? "base-sepolia" : "base";
    return `https://opensea.io/assets/${network}/${contractAddress}/${tokenId}`;
  }

  /**
   * Get the BaseScan URL for a transaction
   */
  getBaseScanUrl(transactionHash: string): string {
    const network = process.env.BASE_NETWORK === "testnet" ? "sepolia.basescan" : "basescan";
    return `https://${network}.org/tx/${transactionHash}`;
  }
  
  /**
   * Get the contract address for display purposes
   */
  getContractAddress(): string | undefined {
    return process.env.NFT_CONTRACT_ADDRESS;
  }
  
  /**
   * Check if NFT features are properly configured
   */
  isConfigured(): boolean {
    return !!process.env.NFT_CONTRACT_ADDRESS && !!process.env.NFT_ROYALTY_WALLET;
  }
}

// Export singleton instance
export const nftMintingService = new NFTMintingService();