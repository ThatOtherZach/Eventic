
import { ethers } from 'ethers';
import { db } from '../db';
import { registryRecords } from '@shared/schema';
import { eq } from 'drizzle-orm';

const CONTRACT_ADDRESS = process.env.NFT_CONTRACT_ADDRESS;
const CONTRACT_ABI = [
  "event TicketMinted(uint256 indexed tokenId, address indexed recipient, string registryId, string metadataURI, bool withRoyalty)"
];

class BlockchainMonitor {
  private provider: ethers.Provider;
  private contract: ethers.Contract;

  constructor() {
    this.provider = new ethers.JsonRpcProvider(process.env.BASE_RPC_URL);
    this.contract = new ethers.Contract(CONTRACT_ADDRESS!, CONTRACT_ABI, this.provider);
  }

  async startMonitoring() {
    // Listen for new TicketMinted events
    this.contract.on('TicketMinted', async (tokenId, recipient, registryId, metadataURI, withRoyalty, event) => {
      console.log(`[NFT] Detected mint: tokenId=${tokenId}, registryId=${registryId}`);
      
      try {
        // Update registry record with successful mint
        await db.update(registryRecords)
          .set({
            nftMinted: true,
            nftMintingStatus: 'minted',
            nftTokenId: tokenId.toString(),
            nftTransactionHash: event.transactionHash,
            nftMintedAt: new Date()
          })
          .where(eq(registryRecords.id, registryId));
          
        console.log(`[NFT] Updated registry record ${registryId} as minted`);
      } catch (error) {
        console.error(`[NFT] Failed to update registry record:`, error);
      }
    });

    // Also check for past events we might have missed
    await this.checkPastEvents();
  }

  async checkPastEvents() {
    const fromBlock = await this.provider.getBlockNumber() - 1000; // Check last 1000 blocks
    
    const events = await this.contract.queryFilter(
      this.contract.filters.TicketMinted(),
      fromBlock
    );

    for (const event of events) {
      const { tokenId, registryId } = event.args!;
      
      // Check if we have this registry record but haven't marked it as minted
      const record = await db.query.registryRecords.findFirst({
        where: eq(registryRecords.id, registryId)
      });

      if (record && !record.nftMinted) {
        await db.update(registryRecords)
          .set({
            nftMinted: true,
            nftMintingStatus: 'minted',
            nftTokenId: tokenId.toString(),
            nftTransactionHash: event.transactionHash,
            nftMintedAt: new Date()
          })
          .where(eq(registryRecords.id, registryId));
      }
    }
  }
}

export const blockchainMonitor = new BlockchainMonitor();
