import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { AccountBalance } from "@shared/schema";

interface TicketsWalletProps {
  balance: AccountBalance;
  claimStatus: { canClaim: boolean; nextClaimAt?: string } | undefined;
  onClaimDaily: () => void;
  isClaimPending: boolean;
}

export function TicketsWallet({ balance, claimStatus, onClaimDaily, isClaimPending }: TicketsWalletProps) {
  const [quantity, setQuantity] = useState(0);
  const [secretCode, setSecretCode] = useState("");
  const { toast } = useToast();
  
  const PRICE_PER_TICKET = 0.29;

  const handleQuantityChange = (value: number) => {
    setQuantity(Math.max(0, Math.floor(value)));
  };

  const handleIncrement = () => {
    handleQuantityChange(quantity + 2);
  };

  const handleDecrement = () => {
    handleQuantityChange(quantity - 1);
  };

  const handleSecretCode = async () => {
    if (!secretCode.trim()) {
      toast({
        title: "No Code",
        description: "Please enter a secret code",
        variant: "destructive",
      });
      return;
    }

    try {
      const response = await apiRequest("POST", "/api/currency/secret-code", {
        code: secretCode.trim()
      });
      const data = await response.json();
      
      toast({
        title: "Code Redeemed!",
        description: data.message || `Added ${data.tickets} tickets to your balance`,
        variant: "success",
      });
      
      setSecretCode("");
      queryClient.invalidateQueries({ queryKey: ["/api/currency/balance"] });
    } catch (error: any) {
      toast({
        title: "Invalid Code",
        description: error.message || "This code is invalid or has already been used",
        variant: "destructive",
      });
    }
  };

  const handleStripeCheckout = () => {
    if (quantity <= 0) {
      toast({
        title: "No Tickets Selected",
        description: "Choose 1 or more tickets to purchase",
        variant: "destructive",
      });
      return;
    }
    
    const total = (quantity * PRICE_PER_TICKET).toFixed(2);
    toast({
      title: "Coming Soon",
      description: `Stripe checkout for ${quantity} ticket(s) - $${total}`,
    });
  };

  const handleCryptoCheckout = () => {
    if (quantity <= 0) {
      toast({
        title: "No Tickets Selected",
        description: "Choose 1 or more tickets to purchase",
        variant: "destructive",
      });
      return;
    }
    
    toast({
      title: "Coming Soon",
      description: `Crypto checkout for ${quantity} ticket(s) - ${quantity} USDC on Base`,
    });
  };

  const totalPrice = (quantity * PRICE_PER_TICKET).toFixed(2);
  const currentBalance = Math.floor(parseFloat(balance.balance));
  const holdBalance = Math.floor(parseFloat(balance.holdBalance));

  return (
    <div className="window" style={{ maxWidth: '460px', width: '100%', marginBottom: '1rem' }}>
      <div className="title-bar">
        <div className="title-bar-text">My Wallet</div>
      </div>
      <div className="window-body">
        {/* Balance + Daily Claim */}
        <fieldset>
          <legend>Balance</legend>
          <div className="field-row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <label htmlFor="ticketBalance" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <span aria-hidden="true">🎟️</span>
              <output id="ticketBalance">{currentBalance}</output>
              Tickets
              {holdBalance > 0 && (
                <span style={{ color: '#808080', fontSize: '0.9em' }}>
                  ({holdBalance} on hold)
                </span>
              )}
            </label>
            <button 
              id="claimBtn" 
              title={claimStatus?.canClaim ? "Daily claim" : `Next claim: ${claimStatus?.nextClaimAt ? new Date(claimStatus.nextClaimAt).toLocaleString() : 'N/A'}`}
              onClick={onClaimDaily}
              disabled={!claimStatus?.canClaim || isClaimPending}
            >
              <span aria-hidden="true">🎁</span> {isClaimPending ? "Claiming..." : claimStatus?.canClaim ? "Claim" : "Claimed"}
            </button>
          </div>
          <p style={{ marginTop: '6px', fontSize: '0.9em' }}>
            Tickets are used to create and boost events, and to charge your ticket for better special-effect odds. 
            Tickets are not required for RSVPing to events. You can collect a free 2 or 4 tickets every 24 hours 
            (you get more in the evening).
          </p>
        </fieldset>

        {/* Secret code */}
        <fieldset>
          <legend>Secret code</legend>
          <div className="field-row" style={{ gap: '6px', alignItems: 'center', justifyContent: 'center' }}>
            <input 
              id="secretCode" 
              type="text" 
              placeholder="enter code" 
              style={{ width: '220px' }}
              value={secretCode}
              onChange={(e) => setSecretCode(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleSecretCode();
                }
              }}
            />
            <button id="secretBtn" onClick={handleSecretCode}>Execute</button>
          </div>
        </fieldset>

        {/* Add Tickets (Stepper) */}
        <fieldset>
          <legend>Add tickets</legend>
          <div className="field-row" style={{ alignItems: 'center', gap: '6px', justifyContent: 'center' }}>
            <button 
              id="decBtn" 
              aria-label="Decrease"
              onClick={handleDecrement}
              disabled={quantity <= 0}
            >
              −
            </button>
            <input 
              id="addQty" 
              type="number" 
              value={quantity}
              onChange={(e) => handleQuantityChange(parseInt(e.target.value) || 0)}
              onKeyDown={(e) => {
                if (e.key === 'ArrowUp') {
                  e.preventDefault();
                  handleIncrement();
                }
                if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  handleDecrement();
                }
              }}
              min="0" 
              style={{ width: '64px', textAlign: 'center' }} 
              aria-label="Tickets to add" 
            />
            <button 
              id="incBtn" 
              aria-label="Increase"
              onClick={handleIncrement}
            >
              +
            </button>
          </div>
          <div className="status-bar" style={{ marginTop: '8px' }}>
            <p className="status-bar-field" id="calcHint" style={{ width: '100%', textAlign: 'center' }}>
              Total: ${totalPrice}
            </p>
          </div>
        </fieldset>

        {/* Actions */}
        <menu role="toolbar" style={{ display: 'flex', gap: '8px', justifyContent: 'space-between', padding: '0' }}>
          <button id="buyCard" onClick={handleStripeCheckout}>💳 Stripe</button>
          <button id="buyCrypto" onClick={handleCryptoCheckout}>🪙 Coinbase</button>
        </menu>
      </div>
    </div>
  );
}