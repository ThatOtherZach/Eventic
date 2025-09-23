
import { ethers } from 'ethers';
import { db } from '../db';
import { registryRecords } from '@shared/schema';
import { eq } from 'drizzle-orm';

export class NFTStatusChecker {
  private provider: ethers.Provider;

  constructor() {
    this.provider = new ethers.JsonRpcProvider(process.env.BASE_RPC_URL);
  }

  async checkPendingTransactions() {
    // Get all records with pending NFT minting status
    const pendingRecords = await db.query.registryRecords.findMany({
      where: eq(registryRecords.nftMintingStatus, 'pending')
    });

    console.log(`[NFT] Checking ${pendingRecords.length} pending transactions`);

    for (const record of pendingRecords) {
      if (!record.nftTransactionHash) continue;

      try {
        const receipt = await this.provider.getTransactionReceipt(record.nftTransactionHash);
        
        if (receipt) {
          if (receipt.status === 1) {
            // Transaction succeeded
            await db.update(registryRecords)
              .set({
                nftMinted: true,
                nftMintingStatus: 'minted',
                nftMintedAt: new Date()
              })
              .where(eq(registryRecords.id, record.id));
              
            console.log(`[NFT] Confirmed mint for registry ${record.id}`);
          } else {
            // Transaction failed
            await db.update(registryRecords)
              .set({
                nftMintingStatus: 'failed'
              })
              .where(eq(registryRecords.id, record.id));
              
            console.log(`[NFT] Marked failed mint for registry ${record.id}`);
          }
        }
      } catch (error) {
        console.error(`[NFT] Error checking transaction ${record.nftTransactionHash}:`, error);
      }
    }
  }
}

export const nftStatusChecker = new NFTStatusChecker();
