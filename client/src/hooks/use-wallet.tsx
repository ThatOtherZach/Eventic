import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { useToast } from '@/hooks/use-toast';

interface WalletState {
  address: string | null;
  provider: ethers.BrowserProvider | null;
  signer: ethers.Signer | null;
  chainId: number | null;
  isConnecting: boolean;
  error: string | null;
}

const BASE_CHAIN_ID = 8453; // Base mainnet
const BASE_RPC_URL = 'https://mainnet.base.org';

export function useWallet() {
  const { toast } = useToast();
  const [state, setState] = useState<WalletState>({
    address: null,
    provider: null,
    signer: null,
    chainId: null,
    isConnecting: false,
    error: null
  });

  // Check if wallet is already connected on mount
  useEffect(() => {
    checkExistingConnection();
  }, []);

  const checkExistingConnection = async () => {
    if (typeof window.ethereum !== 'undefined') {
      try {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const accounts = await provider.listAccounts();
        
        if (accounts.length > 0) {
          const signer = await provider.getSigner();
          const address = await signer.getAddress();
          const network = await provider.getNetwork();
          
          setState({
            address,
            provider,
            signer,
            chainId: Number(network.chainId),
            isConnecting: false,
            error: null
          });
        }
      } catch (error) {
        console.error('Failed to check existing connection:', error);
      }
    }
  };

  const switchToBase = async (provider: ethers.BrowserProvider) => {
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: `0x${BASE_CHAIN_ID.toString(16)}` }],
      });
    } catch (switchError: any) {
      // This error code indicates that the chain has not been added to MetaMask
      if (switchError.code === 4902) {
        try {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: `0x${BASE_CHAIN_ID.toString(16)}`,
              chainName: 'Base',
              nativeCurrency: {
                name: 'Ether',
                symbol: 'ETH',
                decimals: 18
              },
              rpcUrls: [BASE_RPC_URL],
              blockExplorerUrls: ['https://basescan.org']
            }],
          });
        } catch (addError) {
          throw new Error('Failed to add Base network');
        }
      } else {
        throw switchError;
      }
    }
  };

  const connectWallet = useCallback(async (walletType: 'metamask' | 'coinbase' | 'walletconnect' = 'metamask') => {
    setState(prev => ({ ...prev, isConnecting: true, error: null }));

    try {
      let provider: ethers.BrowserProvider;

      if (walletType === 'metamask') {
        if (typeof window.ethereum === 'undefined') {
          throw new Error('MetaMask is not installed');
        }
        
        provider = new ethers.BrowserProvider(window.ethereum);
        await provider.send('eth_requestAccounts', []);
      } else if (walletType === 'coinbase') {
        // For Coinbase Wallet, we'll use the injected provider if available
        // The Coinbase Wallet SDK is already installed via @coinbase/wallet-sdk
        if (typeof window.ethereum === 'undefined') {
          throw new Error('No wallet detected. Please install Coinbase Wallet');
        }
        
        provider = new ethers.BrowserProvider(window.ethereum);
        await provider.send('eth_requestAccounts', []);
      } else {
        throw new Error('WalletConnect support coming soon');
      }

      const network = await provider.getNetwork();
      
      // Switch to Base network if not already on it
      if (Number(network.chainId) !== BASE_CHAIN_ID) {
        await switchToBase(provider);
        // Re-fetch network after switching
        const newNetwork = await provider.getNetwork();
        if (Number(newNetwork.chainId) !== BASE_CHAIN_ID) {
          throw new Error('Please switch to Base network');
        }
      }

      const signer = await provider.getSigner();
      const address = await signer.getAddress();

      setState({
        address,
        provider,
        signer,
        chainId: BASE_CHAIN_ID,
        isConnecting: false,
        error: null
      });

      toast({
        title: 'Wallet Connected',
        description: `Connected to ${address.slice(0, 6)}...${address.slice(-4)}`,
      });

      // Listen for account changes
      window.ethereum.on('accountsChanged', handleAccountsChanged);
      window.ethereum.on('chainChanged', handleChainChanged);

    } catch (error: any) {
      const errorMessage = error.message || 'Failed to connect wallet';
      setState(prev => ({ 
        ...prev, 
        isConnecting: false, 
        error: errorMessage 
      }));
      
      toast({
        title: 'Connection Failed',
        description: errorMessage,
        variant: 'destructive'
      });
    }
  }, [toast]);

  const handleAccountsChanged = (accounts: string[]) => {
    if (accounts.length === 0) {
      disconnectWallet();
    } else {
      checkExistingConnection();
    }
  };

  const handleChainChanged = () => {
    // Reload the page to reset the state properly
    window.location.reload();
  };

  const disconnectWallet = useCallback(() => {
    setState({
      address: null,
      provider: null,
      signer: null,
      chainId: null,
      isConnecting: false,
      error: null
    });

    // Remove event listeners
    if (window.ethereum) {
      window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
      window.ethereum.removeListener('chainChanged', handleChainChanged);
    }

    toast({
      title: 'Wallet Disconnected',
      description: 'Your wallet has been disconnected',
    });
  }, [toast]);

  const signMessage = useCallback(async (message: string) => {
    if (!state.signer) {
      throw new Error('Wallet not connected');
    }

    try {
      const signature = await state.signer.signMessage(message);
      return signature;
    } catch (error: any) {
      toast({
        title: 'Signing Failed',
        description: error.message || 'Failed to sign message',
        variant: 'destructive'
      });
      throw error;
    }
  }, [state.signer, toast]);

  const sendTransaction = useCallback(async (transaction: ethers.TransactionRequest) => {
    if (!state.signer) {
      throw new Error('Wallet not connected');
    }

    try {
      const tx = await state.signer.sendTransaction(transaction);
      return tx;
    } catch (error: any) {
      toast({
        title: 'Transaction Failed',
        description: error.message || 'Failed to send transaction',
        variant: 'destructive'
      });
      throw error;
    }
  }, [state.signer, toast]);

  const waitForTransaction = useCallback(async (txHash: string) => {
    if (!state.provider) {
      throw new Error('Provider not available');
    }

    try {
      const receipt = await state.provider.waitForTransaction(txHash);
      return receipt;
    } catch (error: any) {
      toast({
        title: 'Transaction Error',
        description: 'Failed to confirm transaction',
        variant: 'destructive'
      });
      throw error;
    }
  }, [state.provider, toast]);

  return {
    ...state,
    connectWallet,
    disconnectWallet,
    signMessage,
    sendTransaction,
    waitForTransaction,
    isConnected: !!state.address,
    isBaseNetwork: state.chainId === BASE_CHAIN_ID
  };
}