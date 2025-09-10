import { useState, useEffect } from "react";
import QRCode from "qrcode";
import { Copy, RefreshCw } from "lucide-react";
import { fetchCryptoPrices, calculateCryptoAmount, formatConversionRate, type CryptoPrice } from "@/lib/crypto-prices";
import { useToast } from "@/hooks/use-toast";

interface CryptoPaymentInfoProps {
  walletAddress: string;
  ticketPrice: number;
  paymentMethod: "Bitcoin" | "Ethereum" | "USDC" | "Dogecoin";
}

export function CryptoPaymentInfo({ walletAddress, ticketPrice, paymentMethod }: CryptoPaymentInfoProps) {
  const [qrCodeUrl, setQrCodeUrl] = useState<string>("");
  const [cryptoPrices, setCryptoPrices] = useState<CryptoPrice | null>(null);
  const [isLoadingPrices, setIsLoadingPrices] = useState(false);
  const { toast } = useToast();

  // Generate QR code for wallet address
  useEffect(() => {
    const generateQR = async () => {
      try {
        const url = await QRCode.toDataURL(walletAddress, {
          width: 150,
          margin: 1,
          color: {
            dark: '#000000',
            light: '#FFFFFF',
          }
        });
        setQrCodeUrl(url);
      } catch (err) {
        console.error('Error generating QR code:', err);
      }
    };
    
    if (walletAddress) {
      generateQR();
    }
  }, [walletAddress]);

  // Fetch crypto prices on mount
  useEffect(() => {
    handleRefreshPrices();
  }, []);

  const handleRefreshPrices = async () => {
    setIsLoadingPrices(true);
    try {
      const prices = await fetchCryptoPrices();
      setCryptoPrices(prices);
    } catch (error) {
      toast({
        title: "Failed to fetch prices",
        description: "Could not get current crypto prices. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoadingPrices(false);
    }
  };

  const handleCopyAddress = () => {
    navigator.clipboard.writeText(walletAddress);
    toast({
      title: "Address copied",
      description: "Wallet address copied to clipboard",
    });
  };

  const handleCopyAmount = () => {
    const amount = getCryptoAmount();
    navigator.clipboard.writeText(amount);
    toast({
      title: "Amount copied",
      description: `${amount} ${getCurrencySymbol()} copied to clipboard`,
    });
  };

  const getCryptoAmount = () => {
    if (!cryptoPrices) return "Loading...";
    
    const currencyKey = paymentMethod.toLowerCase() as keyof CryptoPrice;
    const price = cryptoPrices[currencyKey];
    
    return calculateCryptoAmount(ticketPrice, price, currencyKey as any);
  };

  const getConversionRate = () => {
    if (!cryptoPrices) return "";
    
    const currencyKey = paymentMethod.toLowerCase() as keyof CryptoPrice;
    const price = cryptoPrices[currencyKey];
    
    return formatConversionRate(price, paymentMethod);
  };

  const getCurrencySymbol = () => {
    switch (paymentMethod) {
      case "Bitcoin": return "BTC";
      case "Ethereum": return "ETH";
      case "USDC": return "USDC";
      case "Dogecoin": return "DOGE";
      default: return "";
    }
  };

  return (
    <div className="border rounded p-3 mb-3" style={{ backgroundColor: "#f8f9fa" }}>
      <h6 className="mb-3">💳 Crypto Payment Information</h6>
      
      {/* Mobile-first vertical layout */}
      <div>
        {/* Address section */}
        <div className="mb-3">
          <div className="mb-2">
            <small className="text-muted">Send {paymentMethod} to:</small>
          </div>
          <div style={{ 
            wordBreak: "break-all", 
            fontFamily: "monospace",
            fontSize: "12px",
            lineHeight: "1.4",
            backgroundColor: "white",
            padding: "8px",
            borderRadius: "4px",
            border: "1px solid #dee2e6"
          }}>
            {walletAddress}
          </div>
        </div>
        
        {/* QR code and buttons section */}
        <div className="text-center">
          {qrCodeUrl && (
            <img 
              src={qrCodeUrl} 
              alt="Wallet QR Code" 
              style={{ width: "150px", height: "150px", marginBottom: "12px" }}
            />
          )}
          <div className="d-flex gap-2 justify-content-center">
            <button
              className="btn btn-outline-secondary"
              onClick={handleCopyAddress}
              style={{ 
                width: "40px", 
                height: "40px", 
                padding: "0",
                display: "flex",
                alignItems: "center",
                justifyContent: "center"
              }}
              title="Copy address"
              data-testid="button-copy-address"
            >
              <Copy size={16} />
            </button>
            <button
              className="btn btn-outline-secondary"
              onClick={handleRefreshPrices}
              disabled={isLoadingPrices}
              style={{ 
                width: "40px", 
                height: "40px", 
                padding: "0",
                display: "flex",
                alignItems: "center",
                justifyContent: "center"
              }}
              title="Refresh prices"
              data-testid="button-refresh-prices"
            >
              <RefreshCw size={16} className={isLoadingPrices ? "animate-spin" : ""} />
            </button>
          </div>
        </div>
      </div>
      
      {/* Amount and conversion rate */}
      <div className="mt-3 pt-3 border-top">
        <div className="d-flex justify-content-between align-items-center mb-1">
          <div className="d-flex align-items-center gap-2">
            <span className="text-muted">{getCurrencySymbol()}</span>
            <strong style={{ fontFamily: "monospace", fontSize: "16px" }}>
              {getCryptoAmount()}
            </strong>
          </div>
          <button
            className="btn btn-outline-secondary"
            onClick={handleCopyAmount}
            style={{ 
              width: "40px",
              height: "40px",
              padding: "0",
              display: "flex",
              alignItems: "center",
              justifyContent: "center"
            }}
            title="Copy amount"
            data-testid="button-copy-amount"
          >
            <Copy size={16} />
          </button>
        </div>
        <div className="text-start">
          <small className="text-muted">
            {getConversionRate()}
          </small>
        </div>
        <div className="text-start">
          <small className="text-muted">
            Ticket price: ${ticketPrice.toFixed(2)} USD
          </small>
        </div>
      </div>
    </div>
  );
}