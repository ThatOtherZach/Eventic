// Crypto price fetching utility using CoinGecko free API
export interface CryptoPrice {
  bitcoin: number;
  ethereum: number;
  usd: number; // USDC is pegged to 1 USD
  dogecoin: number;
}

const COINGECKO_API = 'https://api.coingecko.com/api/v3';

export async function fetchCryptoPrices(): Promise<CryptoPrice> {
  try {
    // Fetch BTC, ETH and DOGE prices in USD
    const response = await fetch(
      `${COINGECKO_API}/simple/price?ids=bitcoin,ethereum,dogecoin&vs_currencies=usd`
    );
    
    if (!response.ok) {
      throw new Error('Failed to fetch crypto prices');
    }
    
    const data = await response.json();
    
    return {
      bitcoin: data.bitcoin?.usd || 0,
      ethereum: data.ethereum?.usd || 0,
      usd: 1, // USDC is always 1:1 with USD
      dogecoin: data.dogecoin?.usd || 0,
    };
  } catch (error) {
    console.error('Error fetching crypto prices:', error);
    // Return fallback prices if API fails
    return {
      bitcoin: 0,
      ethereum: 0,
      usd: 1,
      dogecoin: 0,
    };
  }
}

export function calculateCryptoAmount(
  usdAmount: number,
  cryptoPrice: number,
  currency: 'bitcoin' | 'ethereum' | 'usd' | 'dogecoin'
): string {
  if (currency === 'usd') {
    // USDC is 1:1 with USD, show 2 decimal places
    return usdAmount.toFixed(2);
  }
  
  if (cryptoPrice === 0) {
    return '0.00000000';
  }
  
  const cryptoAmount = usdAmount / cryptoPrice;
  // Return 8 decimal places for BTC and ETH
  return cryptoAmount.toFixed(8);
}

export function formatConversionRate(
  cryptoPrice: number,
  currency: 'Bitcoin' | 'Ethereum' | 'USDC' | 'Dogecoin'
): string {
  if (currency === 'USDC') {
    return '1 USDC = $1.00 USD';
  }
  
  if (cryptoPrice === 0) {
    return 'Price unavailable';
  }
  
  return `1 ${currency} = $${cryptoPrice.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} USD`;
}