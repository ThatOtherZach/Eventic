# Ticket Registry NFT Contract Deployment Guide

## Overview
This smart contract enables minting NFTs for validated tickets on Coinbase's Base L2 blockchain. The NFT metadata points to your registry URLs, creating permanent on-chain records of event tickets.

## Prerequisites
1. **Coinbase Wallet** or any Ethereum-compatible wallet
2. **Base ETH** for gas fees (get from Coinbase or bridge from Ethereum)
3. **Node.js** installed for deployment scripts

## Contract Features
- ERC-721 compliant NFTs
- ERC-2981 royalty standard support (2.69% on resales)
- Per-token royalty configuration
- Centralized minting (only contract owner can mint)
- Registry ID tracking to prevent duplicate mints
- Metadata URLs point to your platform's registry endpoints
- Designed for Base L2 for low gas costs

## Deployment Steps

### 1. Install Dependencies
```bash
npm install --save-dev hardhat @openzeppelin/contracts ethers
```

### 2. Configure Hardhat
Create `hardhat.config.js`:
```javascript
require("@nomiclabs/hardhat-ethers");

module.exports = {
  solidity: "0.8.20",
  networks: {
    base: {
      url: "https://mainnet.base.org",
      accounts: ["YOUR_PRIVATE_KEY"], // Never commit this!
      chainId: 8453
    },
    "base-sepolia": {
      url: "https://sepolia.base.org",
      accounts: ["YOUR_PRIVATE_KEY"], // Never commit this!
      chainId: 84532
    }
  }
};
```

### 3. Deploy Script
Create `scripts/deploy.js`:
```javascript
async function main() {
  const TicketRegistry = await ethers.getContractFactory("TicketRegistry");
  
  // Set your platform's base URL and royalty wallet
  const baseMetadataURI = "https://your-app.replit.app/api/registry/";
  const royaltyWallet = "YOUR_ROYALTY_WALLET_ADDRESS"; // Wallet to receive 2.69% royalties
  
  const contract = await TicketRegistry.deploy(baseMetadataURI, royaltyWallet);
  await contract.deployed();
  
  console.log("TicketRegistry deployed to:", contract.address);
  console.log("Base Metadata URI:", baseMetadataURI);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
```

### 4. Deploy to Base Sepolia (Testnet)
```bash
npx hardhat run scripts/deploy.js --network base-sepolia
```

### 5. Deploy to Base Mainnet
```bash
npx hardhat run scripts/deploy.js --network base
```

## Integration with Platform

### Update Backend
After deployment, update your backend to call the contract when users mint:

```typescript
// server/services/nft-minting.ts
import { ethers } from 'ethers';

const CONTRACT_ADDRESS = "YOUR_DEPLOYED_CONTRACT_ADDRESS";
const PRIVATE_KEY = process.env.NFT_MINTER_PRIVATE_KEY;
const ROYALTY_WALLET = process.env.NFT_ROYALTY_WALLET;

async function mintNFT(walletAddress: string, registryId: string, withRoyalty: boolean = true) {
  const provider = new ethers.providers.JsonRpcProvider("https://mainnet.base.org");
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
  
  const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, wallet);
  
  const tx = await contract.mintTicket(
    walletAddress,
    registryId,
    `${registryId}/metadata`,
    withRoyalty // User's choice: true = 12 tickets (with royalty), false = 15 tickets (no royalty)
  );
  
  const receipt = await tx.wait();
  return receipt.transactionHash;
}
```

### Update Registry Schema
Store the contract address and transaction hash:
```typescript
// Update registry record after successful mint
await storage.updateRegistryRecord(registryId, {
  nftMinted: true,
  nftMintingStatus: "completed",
  nftTransactionHash: txHash,
  nftContractAddress: CONTRACT_ADDRESS,
  nftTokenId: tokenId
});
```

## Gas Costs
- Deployment: ~0.002 ETH on Base
- Minting: ~0.0001 ETH per NFT on Base

## Security Considerations
1. **Never expose private keys** - Use environment variables
2. **Secure royalty wallet** - Use a secure wallet for collecting royalties
3. **Implement rate limiting** - Prevent minting abuse
4. **Validate registry records** - Ensure ticket is validated before minting
5. **Monitor gas prices** - Base is cheap but monitor for spikes

## Environment Variables
Set these in your .env file:
```
NFT_CONTRACT_ADDRESS=0x... # Deployed contract address
NFT_MINTER_PRIVATE_KEY=... # Private key for minting wallet
NFT_ROYALTY_WALLET=0x...   # Wallet to receive 2.69% royalties
BASE_RPC_URL=https://mainnet.base.org # Or testnet URL
```

## View NFTs
Once minted, NFTs can be viewed on:
- OpenSea: `https://opensea.io/assets/base/[CONTRACT_ADDRESS]/[TOKEN_ID]`
- Coinbase Wallet: Automatically appears in user's NFT collection
- BaseScan: `https://basescan.org/token/[CONTRACT_ADDRESS]`

## Example Flow
1. User validates ticket at event
2. User clicks "Mint NFT" and enters wallet address
3. User chooses whether to include 2.69% royalty on resales:
   - With royalty: 12 tickets (standard price)
   - Without royalty: 15 tickets (higher upfront cost)
4. Platform charges appropriate ticket amount
5. Backend calls smart contract to mint NFT with royalty preference
6. NFT appears in user's wallet
7. NFT metadata points to `https://your-app.replit.app/api/registry/[ID]/metadata`
8. Registry page serves as permanent record
9. If royalties enabled, 2.69% of any resale goes to platform wallet

## Support
For Base L2 documentation: https://docs.base.org
For OpenZeppelin contracts: https://docs.openzeppelin.com