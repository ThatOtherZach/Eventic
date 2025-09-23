# NFT Contract Deployment Instructions (User-Initiated Minting)

## Overview
This guide will help you deploy the TicketRegistry smart contract where **users pay their own gas fees** to mint NFTs directly. The platform only needs to deploy the contract once.

## What You'll Need
- **$10 worth of ETH on Base L2** (for deployment + testing)
- **A wallet address** to receive 2.69% royalties from resales
- **10 minutes** to complete deployment

## Step 1: Get ETH on Base L2

### Option A: Use Coinbase (Easiest)
1. Buy $10 worth of ETH on Coinbase
2. When withdrawing, select "Base" as the network
3. Send to your MetaMask wallet

### Option B: Bridge from Ethereum
1. Go to [bridge.base.org](https://bridge.base.org)
2. Connect your wallet with ETH on Ethereum mainnet
3. Bridge $10 worth to Base network (takes ~10 minutes)

## Step 2: Deploy Using Remix (No Coding Required)

1. **Open Remix IDE**: Go to [remix.ethereum.org](https://remix.ethereum.org)

2. **Create the Contract File**:
   - Click "+" to create new file
   - Name it `TicketRegistry.sol`
   - Copy the entire content from your `contracts/TicketRegistry.sol` file

3. **Compile the Contract**:
   - Go to "Solidity Compiler" tab (left sidebar)
   - Select compiler version `0.8.20`
   - Click "Advanced Configuration" and enable "Optimization"
   - Click "Compile TicketRegistry.sol"

4. **Deploy to Base**:
   - Go to "Deploy & Run" tab (left sidebar)
   - In "Environment", select "Injected Provider - MetaMask"
   - MetaMask will pop up - switch network to "Base" (Network ID: 8453)
   - Under "Deploy", you'll see two fields:
     ```
     _baseMetadataURI: https://your-app-name.replit.app/api/registry/
     _royaltyReceiver: 0x... (your royalty wallet address)
     ```
   - Click "Deploy"
   - MetaMask will ask you to confirm (deployment costs ~$2-5)

5. **Save the Contract Address**:
   - After deployment, Remix shows the contract address at the bottom
   - **CRITICAL: Copy and save this address immediately**
   - It looks like: `0x1234567890abcdef...`

## Step 3: Configure Your Replit App

1. **Add Environment Variables** in Replit Secrets:
   ```
   NFT_CONTRACT_ADDRESS=0x... (the contract address from Step 2)
   NFT_ROYALTY_WALLET=0x... (the royalty receiver address)
   BASE_NETWORK=mainnet
   ```

2. **The ABI is already saved** in `contracts/TicketRegistryABI.json`

## Step 4: Test the Setup

1. **Check NFT Settings**: Visit `/api/nft/enabled` - should return `{"enabled": true}`

2. **Test Minting**:
   - Create and validate a test ticket
   - Click "Mint NFT" 
   - Connect wallet (same network as contract)
   - Approve the transaction
   - NFT should appear in your wallet

## Step 5: Update prepare-mint Endpoint

The `/api/tickets/:ticketId/prepare-mint` endpoint needs the contract ABI. It's already configured to use the ABI from `contracts/TicketRegistryABI.json`.

## How It Works After Deployment

1. **User validates ticket** at an event
2. **User clicks "Mint NFT"** button
3. **Platform charges 12 or 15 tickets** (based on royalty choice)
4. **User's wallet opens** to sign the transaction
5. **User pays gas** (~$0.01-0.50 on Base)
6. **NFT mints directly** to user's wallet
7. **Platform monitors** the transaction for 10 minutes
8. **Registry updates** with NFT details

## Important Notes

### Contract is Immutable
Once deployed, you CANNOT change the contract. Make sure:
- Base metadata URI is correct
- Royalty wallet is secure
- You've tested on testnet first (optional but recommended)

### Gas Costs
- **Deployment**: ~$2-5 one time
- **Per Mint**: ~$0.01-0.50 (paid by users)
- **Platform pays**: Nothing after deployment

### Royalty System
- Users who choose royalties (12 tickets) = 2.69% on all resales
- Users who opt out (15 tickets) = No royalties on resales
- Royalties go to the wallet specified during deployment

## Viewing NFTs

Once minted, NFTs appear on:
- **OpenSea**: `https://opensea.io/assets/base/[CONTRACT_ADDRESS]/[TOKEN_ID]`
- **Coinbase Wallet**: Automatically in NFT section
- **BaseScan**: `https://basescan.org/token/[CONTRACT_ADDRESS]`

## Troubleshooting

### "NFT features not enabled"
- Check NFT_CONTRACT_ADDRESS is set in environment variables

### "Transaction fails during mint"
- User needs more ETH for gas
- Check they're on Base network
- Verify contract was deployed correctly

### "Can't see NFT after minting"
- Wait 1-2 minutes for indexing
- Check BaseScan for transaction status
- Verify metadata endpoint is accessible

## Security Reminders

1. **Never share the deployment wallet's private key**
2. **Use a secure wallet for royalty collection**
3. **Test with small amounts first**
4. **Keep a backup of the contract address**

## Need Base Testnet First?

To test on Base Sepolia (testnet):
1. Get free testnet ETH from [base-faucet.vercel.app](https://base-faucet.vercel.app)
2. In Remix, switch MetaMask to "Base Sepolia"
3. Deploy with test parameters
4. Set `BASE_NETWORK=testnet` in environment

---

After deployment, your NFT system is fully decentralized. Users mint directly on-chain, and you never need to touch the contract again!