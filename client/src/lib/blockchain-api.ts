// Blockchain API service for fetching transactions
// Uses public blockchain explorers - no API keys required for basic queries

interface Transaction {
  hash: string;
  from: string;
  to: string;
  value: string;
  timestamp: number;
  confirmations: number;
  blockNumber?: number;
}

// Format crypto amounts for display
function formatCryptoAmount(value: string, decimals: number): string {
  const num = parseFloat(value) / Math.pow(10, decimals);
  return num.toFixed(8);
}

// Fetch Bitcoin transactions
async function fetchBitcoinTransactions(
  address: string,
  startTime: number,
  endTime: number
): Promise<Transaction[]> {
  try {
    // Using Blockchain.info API (no key required for basic queries)
    const response = await fetch(
      `https://blockchain.info/rawaddr/${address}?cors=true`
    );
    
    if (!response.ok) {
      throw new Error('Failed to fetch Bitcoin transactions');
    }
    
    const data = await response.json();
    const transactions: Transaction[] = [];
    
    // Process transactions
    if (data.txs) {
      for (const tx of data.txs) {
        const timestamp = tx.time * 1000; // Convert to milliseconds
        
        // Filter by time range
        if (timestamp >= startTime && timestamp <= endTime) {
          // Check if this address received funds in this transaction
          for (const output of tx.out) {
            if (output.addr === address) {
              transactions.push({
                hash: tx.hash,
                from: tx.inputs?.[0]?.prev_out?.addr || 'Unknown',
                to: address,
                value: formatCryptoAmount(output.value.toString(), 8), // Bitcoin has 8 decimals
                timestamp,
                confirmations: tx.confirmations || 0,
                blockNumber: tx.block_height
              });
            }
          }
        }
      }
    }
    
    return transactions.sort((a, b) => b.timestamp - a.timestamp);
  } catch (error) {
    console.error('Error fetching Bitcoin transactions:', error);
    return [];
  }
}

// Fetch Ethereum transactions
async function fetchEthereumTransactions(
  address: string,
  startTime: number,
  endTime: number
): Promise<Transaction[]> {
  try {
    // Using Etherscan API (rate limited without key, but works for basic queries)
    // Note: This uses a public endpoint, may be rate limited
    const startBlock = Math.floor(startTime / 1000 / 15); // Approximate block number
    const endBlock = Math.floor(endTime / 1000 / 15); // Approximate block number
    
    const response = await fetch(
      `https://api.etherscan.io/api?module=account&action=txlist&address=${address}&startblock=${startBlock}&endblock=${endBlock}&sort=desc`
    );
    
    if (!response.ok) {
      throw new Error('Failed to fetch Ethereum transactions');
    }
    
    const data = await response.json();
    const transactions: Transaction[] = [];
    
    if (data.status === '1' && data.result) {
      for (const tx of data.result) {
        const timestamp = parseInt(tx.timeStamp) * 1000;
        
        // Only include incoming transactions
        if (tx.to.toLowerCase() === address.toLowerCase()) {
          transactions.push({
            hash: tx.hash,
            from: tx.from,
            to: tx.to,
            value: formatCryptoAmount(tx.value, 18), // Ethereum has 18 decimals
            timestamp,
            confirmations: parseInt(tx.confirmations),
            blockNumber: parseInt(tx.blockNumber)
          });
        }
      }
    }
    
    return transactions;
  } catch (error) {
    console.error('Error fetching Ethereum transactions:', error);
    return [];
  }
}

// Fetch USDC transactions (on Ethereum)
async function fetchUSDCTransactions(
  address: string,
  startTime: number,
  endTime: number
): Promise<Transaction[]> {
  try {
    // USDC is an ERC-20 token on Ethereum
    // Using Etherscan token transfer API
    const usdcContract = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'; // USDC contract on Ethereum
    
    const response = await fetch(
      `https://api.etherscan.io/api?module=account&action=tokentx&contractaddress=${usdcContract}&address=${address}&sort=desc`
    );
    
    if (!response.ok) {
      throw new Error('Failed to fetch USDC transactions');
    }
    
    const data = await response.json();
    const transactions: Transaction[] = [];
    
    if (data.status === '1' && data.result) {
      for (const tx of data.result) {
        const timestamp = parseInt(tx.timeStamp) * 1000;
        
        // Filter by time range and only incoming transactions
        if (timestamp >= startTime && timestamp <= endTime && 
            tx.to.toLowerCase() === address.toLowerCase()) {
          transactions.push({
            hash: tx.hash,
            from: tx.from,
            to: tx.to,
            value: formatCryptoAmount(tx.value, 6), // USDC has 6 decimals
            timestamp,
            confirmations: parseInt(tx.confirmations),
            blockNumber: parseInt(tx.blockNumber)
          });
        }
      }
    }
    
    return transactions;
  } catch (error) {
    console.error('Error fetching USDC transactions:', error);
    return [];
  }
}

// Fetch Dogecoin transactions
async function fetchDogecoinTransactions(
  address: string,
  startTime: number,
  endTime: number
): Promise<Transaction[]> {
  try {
    // Using DogeChain API (similar to Blockchain.info for Bitcoin)
    const response = await fetch(
      `https://dogechain.info/api/v1/address/transactions/${address}`
    );
    
    if (!response.ok) {
      // Fallback to BlockCypher API (limited free tier)
      const fallbackResponse = await fetch(
        `https://api.blockcypher.com/v1/doge/main/addrs/${address}/full?limit=50`
      );
      
      if (!fallbackResponse.ok) {
        throw new Error('Failed to fetch Dogecoin transactions');
      }
      
      const fallbackData = await fallbackResponse.json();
      const transactions: Transaction[] = [];
      
      if (fallbackData.txs) {
        for (const tx of fallbackData.txs) {
          const timestamp = new Date(tx.received || tx.confirmed).getTime();
          
          // Filter by time range
          if (timestamp >= startTime && timestamp <= endTime) {
            // Check outputs for this address
            for (const output of (tx.outputs || [])) {
              if (output.addresses?.includes(address)) {
                transactions.push({
                  hash: tx.hash,
                  from: tx.inputs?.[0]?.addresses?.[0] || 'Unknown',
                  to: address,
                  value: formatCryptoAmount(output.value?.toString() || '0', 8), // Dogecoin has 8 decimals
                  timestamp,
                  confirmations: tx.confirmations || 0,
                  blockNumber: tx.block_height
                });
              }
            }
          }
        }
      }
      
      return transactions.sort((a, b) => b.timestamp - a.timestamp);
    }
    
    const data = await response.json();
    const transactions: Transaction[] = [];
    
    // Process DogeChain API response
    if (data.transactions) {
      for (const tx of data.transactions) {
        const timestamp = tx.time * 1000;
        
        if (timestamp >= startTime && timestamp <= endTime) {
          transactions.push({
            hash: tx.hash,
            from: tx.sent_by?.[0] || 'Unknown',
            to: address,
            value: formatCryptoAmount((tx.value || 0).toString(), 8),
            timestamp,
            confirmations: tx.confirmations || 0
          });
        }
      }
    }
    
    return transactions.sort((a, b) => b.timestamp - a.timestamp);
  } catch (error) {
    console.error('Error fetching Dogecoin transactions:', error);
    return [];
  }
}

// Main function to fetch transactions based on payment method
export async function fetchBlockchainTransactions(
  walletAddress: string,
  paymentMethod: 'Bitcoin' | 'Ethereum' | 'USDC' | 'Dogecoin',
  startDate: Date,
  endDate: Date
): Promise<Transaction[]> {
  const startTime = startDate.getTime();
  const endTime = endDate.getTime();
  
  switch (paymentMethod) {
    case 'Bitcoin':
      return fetchBitcoinTransactions(walletAddress, startTime, endTime);
    case 'Ethereum':
      return fetchEthereumTransactions(walletAddress, startTime, endTime);
    case 'USDC':
      return fetchUSDCTransactions(walletAddress, startTime, endTime);
    case 'Dogecoin':
      return fetchDogecoinTransactions(walletAddress, startTime, endTime);
    default:
      return [];
  }
}

// Get blockchain explorer URL for a transaction
export function getExplorerUrl(txHash: string, paymentMethod: 'Bitcoin' | 'Ethereum' | 'USDC' | 'Dogecoin'): string {
  switch (paymentMethod) {
    case 'Bitcoin':
      return `https://blockchain.info/tx/${txHash}`;
    case 'Ethereum':
    case 'USDC':
      return `https://etherscan.io/tx/${txHash}`;
    case 'Dogecoin':
      return `https://dogechain.info/tx/${txHash}`;
    default:
      return '#';
  }
}

// Format transactions for display
export function formatTransactionData(
  transactions: Transaction[],
  paymentMethod: 'Bitcoin' | 'Ethereum' | 'USDC' | 'Dogecoin'
): string {
  if (transactions.length === 0) {
    return 'No transactions found in the specified time period.';
  }
  
  let output = `${paymentMethod} Transactions\n`;
  output += `Found ${transactions.length} transaction(s)\n\n`;
  
  transactions.forEach((tx, index) => {
    output += `Transaction ${index + 1}:\n`;
    output += `  Hash: ${tx.hash}\n`;
    output += `  From: ${tx.from}\n`;
    output += `  Amount: ${tx.value} ${paymentMethod === 'USDC' ? 'USDC' : paymentMethod === 'Bitcoin' ? 'BTC' : paymentMethod === 'Dogecoin' ? 'DOGE' : 'ETH'}\n`;
    output += `  Time: ${new Date(tx.timestamp).toLocaleString()}\n`;
    output += `  Confirmations: ${tx.confirmations}\n`;
    output += `  Explorer: ${getExplorerUrl(tx.hash, paymentMethod)}\n`;
    output += '\n';
  });
  
  return output;
}