import { useState } from 'react';
import { useWallet } from '@/hooks/use-wallet';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from '@/components/ui/dropdown-menu';
import { Wallet, LogOut, ChevronDown, ExternalLink } from 'lucide-react';
import { SiCoinbase } from 'react-icons/si';

export function WalletConnectButton() {
  const { 
    address, 
    isConnected, 
    isConnecting, 
    connectWallet, 
    disconnectWallet,
    isBaseNetwork 
  } = useWallet();
  const [showWalletMenu, setShowWalletMenu] = useState(false);

  if (isConnected && address) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="gap-2" data-testid="button-wallet-connected">
            <Wallet className="h-4 w-4" />
            <span className="font-mono">
              {address.slice(0, 6)}...{address.slice(-4)}
            </span>
            {!isBaseNetwork && (
              <span className="text-yellow-600 text-xs">(Wrong Network)</span>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem
            onClick={() => navigator.clipboard.writeText(address)}
            className="cursor-pointer"
            data-testid="button-copy-address"
          >
            Copy Address
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <a
              href={`https://basescan.org/address/${address}`}
              target="_blank"
              rel="noopener noreferrer"
              className="cursor-pointer flex items-center gap-2"
              data-testid="link-basescan"
            >
              View on BaseScan
              <ExternalLink className="h-3 w-3" />
            </a>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={disconnectWallet}
            className="cursor-pointer text-red-600"
            data-testid="button-disconnect-wallet"
          >
            <LogOut className="h-4 w-4 mr-2" />
            Disconnect
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <DropdownMenu open={showWalletMenu} onOpenChange={setShowWalletMenu}>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="default" 
          disabled={isConnecting}
          className="gap-2"
          data-testid="button-connect-wallet"
        >
          <Wallet className="h-4 w-4" />
          {isConnecting ? 'Connecting...' : 'Connect Wallet'}
          <ChevronDown className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem
          onClick={() => {
            connectWallet('metamask');
            setShowWalletMenu(false);
          }}
          disabled={isConnecting}
          className="cursor-pointer"
          data-testid="button-connect-metamask"
        >
          <img 
            src="https://upload.wikimedia.org/wikipedia/commons/3/36/MetaMask_Fox.svg" 
            alt="MetaMask" 
            className="h-4 w-4 mr-2"
          />
          MetaMask
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => {
            connectWallet('coinbase');
            setShowWalletMenu(false);
          }}
          disabled={isConnecting}
          className="cursor-pointer"
          data-testid="button-connect-coinbase"
        >
          <SiCoinbase className="h-4 w-4 mr-2" />
          Coinbase Wallet
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}