// DEPRECATED: This service is no longer used.
// Users are responsible for minting their own NFTs using the registry page as metadata.
// The platform only creates registry entries (paywalled with tickets).

// Keeping ethers import disabled
let ethers: any = null;

// Contract ABI (only the functions we need)
const CONTRACT_ABI = [
  "function mintTicket(address recipient, string registryId, string metadataPath, bool withRoyalty) returns (uint256)",
  "function isMinted(string registryId) view returns (bool)",
  "function getTokenId(string registryId) view returns (uint256)",
  "event TicketMinted(uint256 indexed tokenId, address indexed recipient, string registryId, string metadataURI, bool withRoyalty)"
];

interface MintResult {
  success: boolean;
  transactionHash?: string;
  tokenId?: string;
  error?: string;
}

class NFTMintingService {
  private contract: any = null;
  private wallet: any = null;
  private provider: any = null;

  constructor() {
    this.initialize();
  }

  private initialize() {
    // Service is deprecated - users mint their own NFTs
    console.log("[Registry] Registry service initialized (on-chain minting disabled)");
  }

  /**
   * @deprecated Platform no longer mints NFTs. Users mint their own.
   */
  async mintNFT(
    walletAddress: string,
    registryId: string,
    metadataPath: string,
    withRoyalty: boolean = true
  ): Promise<MintResult> {
    return {
      success: false,
      error: "Platform minting is deprecated. Users should mint their own NFTs using the registry page as metadata."
    };

    try {
      // Check if already minted
      const isMinted = await this.contract.isMinted(registryId);
      if (isMinted) {
        const tokenId = await this.contract.getTokenId(registryId);
        return {
          success: false,
          error: "Already minted",
          tokenId: tokenId.toString()
        };
      }

      // Estimate gas
      const gasEstimate = await this.contract.estimateGas.mintTicket(
        walletAddress,
        registryId,
        metadataPath,
        withRoyalty
      );

      // Add 20% buffer to gas estimate
      const gasLimit = gasEstimate.mul(120).div(100);

      // Get current gas price
      const gasPrice = await this.provider.getGasPrice();

      // Execute mint transaction
      console.log(`[NFT] Minting NFT for registry ${registryId} to ${walletAddress} (royalty: ${withRoyalty})`);
      const tx = await this.contract.mintTicket(
        walletAddress,
        registryId,
        metadataPath,
        withRoyalty,
        {
          gasLimit,
          gasPrice
        }
      );

      // Wait for confirmation
      console.log(`[NFT] Transaction sent: ${tx.hash}`);
      const receipt = await tx.wait();

      // Extract token ID from event
      const mintEvent = receipt.events?.find(
        (e: any) => e.event === "TicketMinted"
      );
      const tokenId = mintEvent?.args?.tokenId?.toString() || "0";

      console.log(`[NFT] Successfully minted token ${tokenId} in tx ${receipt.transactionHash}`);

      return {
        success: true,
        transactionHash: receipt.transactionHash,
        tokenId
      };
    } catch (error: any) {
      console.error("[NFT] Minting failed:", error);
      
      // Parse error message
      let errorMessage = "Failed to mint NFT";
      if (error.reason) {
        errorMessage = error.reason;
      } else if (error.message) {
        errorMessage = error.message;
      }

      return {
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * @deprecated Platform no longer tracks on-chain minting
   */
  async checkMintStatus(registryId: string): Promise<{
    minted: boolean;
    tokenId?: string;
  }> {
    return { minted: false };

    try {
      const isMinted = await this.contract.isMinted(registryId);
      if (isMinted) {
        const tokenId = await this.contract.getTokenId(registryId);
        return {
          minted: true,
          tokenId: tokenId.toString()
        };
      }
      return { minted: false };
    } catch (error) {
      console.error("[NFT] Failed to check mint status:", error);
      return { minted: false };
    }
  }

  /**
   * @deprecated Platform no longer estimates gas
   */
  async estimateGasCost(
    walletAddress: string,
    registryId: string,
    metadataPath: string
  ): Promise<string | null> {
    return null;

    try {
      const gasEstimate = await this.contract.estimateGas.mintTicket(
        walletAddress,
        registryId,
        metadataPath
      );
      const gasPrice = await this.provider.getGasPrice();
      const cost = gasEstimate.mul(gasPrice);
      return ethers?.utils?.formatEther(cost) || "0";
    } catch (error) {
      console.error("[NFT] Failed to estimate gas:", error);
      return null;
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
}

// Export singleton instance
export const nftMintingService = new NFTMintingService();