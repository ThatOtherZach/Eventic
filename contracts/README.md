# Ticket Registry NFT Contract Deployment Guide

## Overview
This smart contract enables minting NFTs for validated tickets on Coinbase's Base L2 blockchain. The NFT metadata points to your registry URLs, creating permanent on-chain records of event tickets.

## Prerequisites
1. **Coinbase Wallet** or any Ethereum-compatible wallet
2. **Base ETH** for gas fees (get from Coinbase or bridge from Ethereum)
3. **Node.js** installed for deployment scripts

## Contract Features
- ERC-721 compliant NFTs
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
  
  // Set your platform's base URL
  const baseMetadataURI = "https://your-app.replit.app/api/registry/";
  
  const contract = await TicketRegistry.deploy(baseMetadataURI);
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
const PRIVATE_KEY = process.env.MINTER_PRIVATE_KEY;

async function mintNFT(walletAddress: string, registryId: string) {
  const provider = new ethers.providers.JsonRpcProvider("https://mainnet.base.org");
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
  
  const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, wallet);
  
  const tx = await contract.mintTicket(
    walletAddress,
    registryId,
    `${registryId}/metadata`
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
2. **Implement rate limiting** - Prevent minting abuse
3. **Validate registry records** - Ensure ticket is validated before minting
4. **Monitor gas prices** - Base is cheap but monitor for spikes

## View NFTs
Once minted, NFTs can be viewed on:
- OpenSea: `https://opensea.io/assets/base/[CONTRACT_ADDRESS]/[TOKEN_ID]`
- Coinbase Wallet: Automatically appears in user's NFT collection
- BaseScan: `https://basescan.org/token/[CONTRACT_ADDRESS]`

## Example Flow
1. User validates ticket at event
2. User clicks "Mint NFT" and enters wallet address
3. Platform charges 12 tickets
4. Backend calls smart contract to mint NFT
5. NFT appears in user's wallet
6. NFT metadata points to `https://your-app.replit.app/api/registry/[ID]/metadata`
7. Registry page serves as permanent record

## Support
For Base L2 documentation: https://docs.base.org
For OpenZeppelin contracts: https://docs.openzeppelin.com