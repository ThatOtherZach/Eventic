// Note: ethers library must be installed to enable on-chain minting
// npm install ethers
let ethers: any;
try {
  ethers = require('ethers');
} catch (error) {
  console.log("[NFT] ethers library not installed. On-chain minting disabled.");
  console.log("[NFT] To enable: npm install ethers");
}

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
    // Skip if ethers is not installed
    if (!ethers) {
      return;
    }
    
    // Check if environment variables are set
    const contractAddress = process.env.NFT_CONTRACT_ADDRESS;
    const privateKey = process.env.NFT_MINTER_PRIVATE_KEY;
    const royaltyWallet = process.env.NFT_ROYALTY_WALLET;
    const rpcUrl = process.env.BASE_RPC_URL || "https://mainnet.base.org";

    if (!contractAddress || !privateKey) {
      console.log("[NFT] Contract not configured. Set NFT_CONTRACT_ADDRESS and NFT_MINTER_PRIVATE_KEY to enable on-chain minting.");
      return;
    }
    
    if (!royaltyWallet) {
      console.log("[NFT] Warning: NFT_ROYALTY_WALLET not set. Royalty collection will not work properly.");
    }

    try {
      // Initialize provider and wallet
      this.provider = new ethers.providers.JsonRpcProvider(rpcUrl);
      this.wallet = new ethers.Wallet(privateKey, this.provider);
      
      // Initialize contract
      this.contract = new ethers.Contract(contractAddress, CONTRACT_ABI, this.wallet);
      
      console.log("[NFT] NFT minting service initialized");
      console.log("[NFT] Contract address:", contractAddress);
      console.log("[NFT] Minter address:", this.wallet.address);
    } catch (error) {
      console.error("[NFT] Failed to initialize minting service:", error);
    }
  }

  /**
   * Mint an NFT for a registry record
   */
  async mintNFT(
    walletAddress: string,
    registryId: string,
    metadataPath: string,
    withRoyalty: boolean = true
  ): Promise<MintResult> {
    if (!this.contract || !this.wallet) {
      return {
        success: false,
        error: "NFT minting not configured"
      };
    }

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
   * Check if a registry record has been minted
   */
  async checkMintStatus(registryId: string): Promise<{
    minted: boolean;
    tokenId?: string;
  }> {
    if (!this.contract) {
      return { minted: false };
    }

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
   * Get estimated gas cost in ETH
   */
  async estimateGasCost(
    walletAddress: string,
    registryId: string,
    metadataPath: string
  ): Promise<string | null> {
    if (!this.contract || !this.provider) {
      return null;
    }

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