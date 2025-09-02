import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Calendar, Ticket, User, Eye, Sparkles, Edit, Save, X, Globe, CheckCircle, Wallet, Gift, Info, AlertTriangle } from "lucide-react";
import { Link, useLocation, useSearch } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useNotifications } from "@/hooks/use-notifications";
import { TicketCard } from "@/components/tickets/ticket-card";
import { PastEvents } from "@/components/archive/past-events";
import { HTMLViewer } from "@/components/nft/html-viewer";
import type { Ticket as TicketType, Event, RegistryRecord, AccountBalance } from "@shared/schema";
import { loadStripe } from "@stripe/stripe-js";

export default function AccountPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const searchParams = useSearch();
  const [ticketsDisplayed, setTicketsDisplayed] = useState(10);
  const [secretCode, setSecretCode] = useState("");
  const [ticketQuantity, setTicketQuantity] = useState(12);
  const [isRedeeming, setIsRedeeming] = useState(false);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [multiplyAndSave, setMultiplyAndSave] = useState(false);
  const [demandLevel, setDemandLevel] = useState<'low' | 'medium' | 'high' | 'very-high'>('low');
  const [bonusPercentage, setBonusPercentage] = useState(0);
  const [reputationDiscount, setReputationDiscount] = useState(0);

  const { toast } = useToast();
  const { addNotification } = useNotifications();
  
  // Fetch demand data
  const { data: demandData } = useQuery<{ demand: number }>({ 
    queryKey: ["/api/currency/demand"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/currency/demand");
      return response.json();
    },
    refetchInterval: 30 * 60 * 1000, // Refresh every 30 minutes
  });
  
  // Calculate demand level and bonus percentage
  useEffect(() => {
    if (demandData) {
      const demand = demandData.demand;
      if (demand < 50) {
        setDemandLevel('low');
        setBonusPercentage(2);
      } else if (demand < 200) {
        setDemandLevel('medium');
        setBonusPercentage(5);
      } else if (demand < 500) {
        setDemandLevel('high');
        setBonusPercentage(8);
      } else {
        setDemandLevel('very-high');
        setBonusPercentage(12);
      }
    }
  }, [demandData]);
  
  
  // Helper function to calculate bonus tickets
  const calculateBonus = (baseTickets: number): number => {
    if (!multiplyAndSave || bonusPercentage === 0) return 0;
    
    let bonus = Math.floor(baseTickets * (bonusPercentage / 100));
    // If bonus is less than 5 but greater than 0, add 3 extra tickets
    if (bonus > 0 && bonus < 5) {
      bonus += 3;
    }
    // If ticket count is over 50, add another 10 bonus tickets
    if (baseTickets > 50) {
      bonus += 10;
    }
    return bonus;
  };
  
  const { data: tickets, isLoading: ticketsLoading } = useQuery<(TicketType & { event: Event })[]>({
    queryKey: ["/api/user/tickets"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/user/tickets");
      return response.json();
    },
    enabled: !!user,
  });

  const { data: events, isLoading: eventsLoading } = useQuery<Event[]>({
    queryKey: ["/api/user/events"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/user/events");
      return response.json();
    },
    enabled: !!user,
  });

  const { data: registryRecords, isLoading: registryLoading } = useQuery<RegistryRecord[]>({
    queryKey: ["/api/user/registry"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/user/registry");
      return response.json();
    },
    enabled: !!user,
  });

  const { data: reputation } = useQuery<{ thumbsUp: number; thumbsDown: number; percentage: number | null; reputation: number; totalRatings: number }>({
    queryKey: [`/api/users/${user?.id}/reputation`],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/users/${user?.id}/reputation`);
      return response.json();
    },
    enabled: !!user?.id,
  });

  const { data: validatedCount } = useQuery<{ validatedCount: number }>({
    queryKey: [`/api/users/${user?.id}/validated-count`],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/users/${user?.id}/validated-count`);
      return response.json();
    },
    enabled: !!user?.id,
  });

  // Fetch user details to ensure displayName and memberStatus are loaded
  const { data: userDetails } = useQuery<{ id: string; email: string; displayName?: string; memberStatus?: string }>({
    queryKey: [`/api/users/${user?.id}`],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/users/${user?.id}`);
      return response.json();
    },
    enabled: !!user?.id,
  });

  const { data: balance } = useQuery<AccountBalance>({
    queryKey: ["/api/currency/balance"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/currency/balance");
      return response.json();
    },
    enabled: !!user,
  });
  
  const { data: claimStatus } = useQuery<{ canClaim: boolean; nextClaimAt?: string }>({
    queryKey: ["/api/currency/daily-claim-status"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/currency/daily-claim-status");
      return response.json();
    },
    enabled: !!user,
    refetchInterval: 60000, // Check every minute
  });
  
  const claimDailyMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/currency/claim-daily");
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Daily Tickets Claimed!",
        description: data.message,
        variant: "success",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/currency/balance"] });
      queryClient.invalidateQueries({ queryKey: ["/api/currency/daily-claim-status"] });
    },
    onError: (error: any) => {
      toast({
        title: "Claim Failed",
        description: error.message || "Failed to claim daily tickets",
        variant: "destructive",
      });
    },
  });
  
  // Calculate reputation discount
  useEffect(() => {
    if (reputation && reputation.totalRatings > 0) {
      const rep = reputation.reputation;
      if (rep >= 55) {
        // Scale from 5% at 55 reputation to 20% at 100 reputation
        const discount = 5 + ((rep - 55) / 45) * 15;
        setReputationDiscount(Math.round(discount * 100) / 100); // Round to 2 decimals
      } else {
        setReputationDiscount(0);
      }
    } else {
      setReputationDiscount(0);
    }
  }, [reputation]);
  
  // Handle secret code redemption
  const handleRedeemCode = async () => {
    if (!secretCode.trim()) {
      toast({
        title: "Error",
        description: "Please enter a code",
        variant: "destructive",
      });
      return;
    }
    
    setIsRedeeming(true);
    try {
      const response = await apiRequest("POST", "/api/currency/redeem-code", {
        code: secretCode.trim()
      });
      const data = await response.json();
      
      if (response.ok) {
        toast({
          title: "Success!",
          description: data.message,
          variant: "success",
        });
        setSecretCode("");
        queryClient.invalidateQueries({ queryKey: ["/api/currency/balance"] });
      } else {
        toast({
          title: "Failed",
          description: data.message || "Invalid code",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to redeem code",
        variant: "destructive",
      });
    } finally {
      setIsRedeeming(false);
    }
  };
  
  // Handle ticket purchase
  const handlePurchaseTickets = async () => {
    if (ticketQuantity < 12) {
      toast({
        title: "Error",
        description: "Minimum purchase is 12 tickets",
        variant: "destructive",
      });
      return;
    }
    
    setIsPurchasing(true);
    try {
      // Calculate actual quantity including bonus
      let finalQuantity = ticketQuantity;
      if (multiplyAndSave && bonusPercentage > 0) {
        let bonusTickets = Math.floor(ticketQuantity * (bonusPercentage / 100));
        // If bonus is less than 5, add 3 extra tickets
        if (bonusTickets > 0 && bonusTickets < 5) {
          bonusTickets += 3;
        }
        finalQuantity = ticketQuantity + bonusTickets;
      }
      
      const response = await apiRequest("POST", "/api/currency/create-purchase", {
        quantity: finalQuantity,
        hasDiscount: multiplyAndSave,
        reputationDiscount: reputationDiscount
      });
      const data = await response.json();
      
      if (response.ok && data.sessionUrl) {
        // Redirect to Stripe checkout
        window.location.href = data.sessionUrl;
      } else {
        toast({
          title: "Error",
          description: data.message || "Failed to create purchase session",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to start purchase",
        variant: "destructive",
      });
    } finally {
      setIsPurchasing(false);
    }
  };
  
  // Check for purchase success/cancel in URL params
  useEffect(() => {
    const params = new URLSearchParams(searchParams);
    const purchase = params.get("purchase");
    
    if (purchase === "success") {
      toast({
        title: "Purchase Complete!",
        description: "Your tickets have been added to your balance",
        variant: "success",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/currency/balance"] });
      // Clean up URL
      setLocation("/account");
    } else if (purchase === "cancelled") {
      toast({
        title: "Purchase Cancelled",
        description: "Your purchase was cancelled",
        variant: "destructive",
      });
      // Clean up URL
      setLocation("/account");
    }
  }, [searchParams]);

  if (!user) {
    return null;
  }

  return (
    <div className="container py-5">
      <div className="row mb-4">
        <div className="col">
          <div className="d-flex justify-content-between align-items-center">
            <h1 className="h3 fw-bold mb-0">My Account</h1>
            <PastEvents />
          </div>
        </div>
      </div>

      {/* User Info Card */}
      <div className="row mb-4">
        <div className="col-12">
          <div className="card">
            <div className="card-body">
              <div className="d-flex flex-column flex-sm-row align-items-start align-items-sm-center justify-content-between">
                <div className="d-flex align-items-center">
                  <div className="me-3 d-none d-sm-block">
                    <img src="/key-icon.png" alt="" style={{ width: '48px', height: '48px' }} />
                  </div>
                  <div className="me-3 d-block d-sm-none">
                    <img src="/key-icon.png" alt="" style={{ width: '36px', height: '36px' }} />
                  </div>
                  <div>
                    {(userDetails?.displayName || user.displayName) && (
                      <h5 className="card-title mb-1">{userDetails?.displayName || user.displayName}</h5>
                    )}
                    {(userDetails?.memberStatus || user.memberStatus) && (
                      <p className="text-muted small mb-1">{userDetails?.memberStatus || user.memberStatus}</p>
                    )}
                    <p className="text-muted mb-0">{userDetails?.email || user.email}</p>
                    {reputation && reputation.percentage !== null && (
                      <div className="d-flex align-items-center mt-2">
                        <img src="/world-icon.png" alt="" style={{ width: '16px', height: '16px', marginRight: '8px' }} />
                        <span className="text-muted small">
                          Reputation: <strong>{reputation.percentage}%</strong>
                          <span className="ms-2 text-secondary">
                            ({reputation.thumbsUp} 👍 / {reputation.thumbsDown} 👎)
                          </span>
                        </span>
                      </div>
                    )}
                    {validatedCount && (
                      <div className="d-flex align-items-center mt-2">
                        <img src="/validation-icon.png" alt="" style={{ width: '16px', height: '16px', marginRight: '8px' }} />
                        <span className="text-muted small">
                          Validated: <strong>{validatedCount.validatedCount}</strong>
                        </span>
                      </div>
                    )}

                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tickets Balance Card */}
      {balance && (
        <div className="row mb-4">
          <div className="col-12">
            <div className="card">
              <div className="card-body">
                <div className="d-flex align-items-center justify-content-between">
                  <div className="d-flex align-items-center">
                    <Wallet className="text-primary me-3" size={32} />
                    <div>
                      <h5 className="card-title mb-1">Tickets Balance</h5>
                      <div className="h3 mb-0 fw-bold">{Math.floor(parseFloat(balance.balance))}</div>
                      {parseFloat(balance.holdBalance) > 0 && (
                        <div className="text-warning">
                          {Math.floor(parseFloat(balance.holdBalance))} tickets on hold
                        </div>
                      )}
                    </div>
                  </div>
                  {/* Daily Claim Button */}
                  {claimStatus && (
                    <button
                      onClick={() => claimDailyMutation.mutate()}
                      disabled={!claimStatus.canClaim || claimDailyMutation.isPending}
                      className={`btn ${claimStatus.canClaim ? 'btn-success' : 'btn-secondary'} d-flex align-items-center`}
                      title={claimStatus.canClaim ? "Claim your daily tickets!" : `Next claim: ${claimStatus.nextClaimAt ? new Date(claimStatus.nextClaimAt).toLocaleString() : 'N/A'}`}
                    >
                      <Gift size={20} className="me-2" />
                      {claimDailyMutation.isPending ? "Claiming..." : claimStatus.canClaim ? "Claim Daily" : "Claimed"}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* My Wallet - Purchase and Redeem Tickets */}
      <div className="row mb-4">
        <div className="col-12">
          <div className="card border-0 shadow-sm">
            <div className="card-body">
              <div className="d-flex align-items-center mb-4">
                <Wallet className="text-primary me-2" size={24} />
                <h5 className="mb-0 fw-semibold">My Wallet</h5>
              </div>
              
              {/* Balance Display */}
              <div className="bg-light rounded-3 p-3 mb-4">
                <div className="row align-items-center">
                  <div className="col-auto">
                    <small className="text-muted text-uppercase fw-semibold" style={{ fontSize: '0.75rem', letterSpacing: '0.5px' }}>Balance</small>
                    <div className="d-flex align-items-baseline">
                      <span className="h2 mb-0 fw-bold text-danger">{balance ? Math.floor(parseFloat(balance.balance)) : 0}</span>
                      <span className="ms-2 text-muted">Tickets</span>
                    </div>
                  </div>
                  {!claimStatus?.canClaim && claimStatus?.nextClaimAt && (
                    <div className="col text-end">
                      <span className="badge bg-success-subtle text-success">
                        <CheckCircle size={12} className="me-1" />
                        claimed
                      </span>
                    </div>
                  )}
                </div>
                <div className="mt-3">
                  <small className="text-muted d-block" style={{ lineHeight: '1.5' }}>
                    Tickets are used to create and boost events, and to charge your ticket for better special-effect odds. 
                    You can collect free tickets every 24 hours.
                  </small>
                </div>
              </div>

              <div className="row g-4">
                {/* Secret Code Section */}
                <div className="col-md-6">
                  <div className="border rounded-3 p-3 h-100">
                    <label className="form-label fw-semibold small text-uppercase" style={{ letterSpacing: '0.5px' }}>Secret Code</label>
                    <div className="input-group mb-2">
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Enter code"
                        value={secretCode}
                        onChange={(e) => setSecretCode(e.target.value.toUpperCase())}
                        onKeyDown={(e) => e.key === 'Enter' && handleRedeemCode()}
                        disabled={isRedeeming}
                        style={{ textTransform: 'uppercase' }}
                      />
                      <button 
                        className="btn btn-outline-primary"
                        onClick={handleRedeemCode}
                        disabled={isRedeeming || !secretCode.trim()}
                      >
                        {isRedeeming ? "Redeeming..." : "Execute"}
                      </button>
                    </div>
                    <small className="text-muted">Redeem codes for free tickets</small>
                  </div>
                </div>

                {/* Ticket Packs Section */}
                <div className="col-md-6">
                  <div className="border rounded-3 p-3 h-100">
                    <label className="form-label fw-semibold small text-uppercase" style={{ letterSpacing: '0.5px' }}>Choose Pack</label>
                    
                    {/* Multiply and Save Checkbox */}
                    <div className="form-check mb-2">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        id="multiplyAndSave"
                        checked={multiplyAndSave}
                        onChange={(e) => setMultiplyAndSave(e.target.checked)}
                      />
                      <label className="form-check-label small" htmlFor="multiplyAndSave">
                        Multiply and save, x2 for 10%
                      </label>
                    </div>
                    
                    <div className="d-flex flex-column gap-2">
                      {/* Starter Pack Button */}
                      <button
                        className={`btn btn-sm ${ticketQuantity === (multiplyAndSave ? 24 : 12) ? 'btn-primary' : 'btn-outline-primary'} text-start p-2`}
                        onClick={() => setTicketQuantity(multiplyAndSave ? 24 : 12)}
                      >
                        <div className="d-flex justify-content-between align-items-center">
                          <div>
                            <div className="fw-semibold">Starter</div>
                            <small className="text-muted">
                              {multiplyAndSave ? '24' : '12'} tickets
                              {calculateBonus(24) > 0 && (
                                <span className="text-success"> +{calculateBonus(24)} bonus</span>
                              )}
                            </small>
                          </div>
                          <div className="text-end">
                            {reputationDiscount > 0 ? (
                              <>
                                <div className="fw-bold">
                                  ${(() => {
                                    let price = (multiplyAndSave ? 24 : 12) * 0.29;
                                    if (multiplyAndSave) price *= 0.9;
                                    price *= (1 - reputationDiscount / 100);
                                    return price.toFixed(2);
                                  })()}
                                </div>
                                <small className="text-muted text-decoration-line-through" style={{ fontSize: '0.7rem' }}>
                                  ${multiplyAndSave ? (24 * 0.29 * 0.9).toFixed(2) : '3.48'}
                                </small>
                              </>
                            ) : (
                              <>
                                <div className="fw-bold">
                                  ${multiplyAndSave ? (24 * 0.29 * 0.9).toFixed(2) : '3.48'}
                                </div>
                                {multiplyAndSave && <small className="text-success" style={{ fontSize: '0.7rem' }}>10% off</small>}
                              </>
                            )}
                          </div>
                        </div>
                      </button>
                      
                      {/* Standard Pack Button */}
                      <button
                        className={`btn btn-sm ${ticketQuantity === (multiplyAndSave ? 48 : 24) ? 'btn-primary' : 'btn-outline-primary'} text-start p-2 position-relative`}
                        onClick={() => setTicketQuantity(multiplyAndSave ? 48 : 24)}
                      >
                        <div className="d-flex justify-content-between align-items-center">
                          <div>
                            <div className="fw-semibold">Standard</div>
                            <small className="text-muted">
                              {multiplyAndSave ? '48' : '24'} tickets
                              {calculateBonus(48) > 0 && (
                                <span className="text-success"> +{calculateBonus(48)} bonus</span>
                              )}
                            </small>
                          </div>
                          <div className="text-end">
                            {reputationDiscount > 0 ? (
                              <>
                                <div className="fw-bold">
                                  ${(() => {
                                    let price = (multiplyAndSave ? 48 : 24) * 0.29;
                                    if (multiplyAndSave) price *= 0.9;
                                    price *= (1 - reputationDiscount / 100);
                                    return price.toFixed(2);
                                  })()}
                                </div>
                                <small className="text-muted text-decoration-line-through" style={{ fontSize: '0.7rem' }}>
                                  ${multiplyAndSave ? (48 * 0.29 * 0.9).toFixed(2) : '6.96'}
                                </small>
                              </>
                            ) : (
                              <>
                                <div className="fw-bold">
                                  ${multiplyAndSave ? (48 * 0.29 * 0.9).toFixed(2) : '6.96'}
                                </div>
                                {multiplyAndSave && <small className="text-success" style={{ fontSize: '0.7rem' }}>10% off</small>}
                              </>
                            )}
                          </div>
                        </div>
                        <span className="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-success" style={{ fontSize: '0.65rem' }}>
                          Popular
                        </span>
                      </button>
                      
                      {/* Premium Pack Button */}
                      <button
                        className={`btn btn-sm ${ticketQuantity === (multiplyAndSave ? 100 : 50) ? 'btn-primary' : 'btn-outline-primary'} text-start p-2`}
                        onClick={() => setTicketQuantity(multiplyAndSave ? 100 : 50)}
                      >
                        <div className="d-flex justify-content-between align-items-center">
                          <div>
                            <div className="fw-semibold">Premium</div>
                            <small className="text-muted">
                              {multiplyAndSave ? '100' : '50'} tickets
                              {calculateBonus(100) > 0 && (
                                <span className="text-success"> +{calculateBonus(100)} bonus</span>
                              )}
                            </small>
                          </div>
                          <div className="text-end">
                            {reputationDiscount > 0 ? (
                              <>
                                <div className="fw-bold">
                                  ${(() => {
                                    let price = (multiplyAndSave ? 100 : 50) * 0.29;
                                    if (multiplyAndSave) price *= 0.9;
                                    price *= (1 - reputationDiscount / 100);
                                    return price.toFixed(2);
                                  })()}
                                </div>
                                <small className="text-muted text-decoration-line-through" style={{ fontSize: '0.7rem' }}>
                                  ${multiplyAndSave ? (100 * 0.29 * 0.9).toFixed(2) : '14.50'}
                                </small>
                              </>
                            ) : (
                              <>
                                <div className="fw-bold">
                                  ${multiplyAndSave ? (100 * 0.29 * 0.9).toFixed(2) : '14.50'}
                                </div>
                                {multiplyAndSave && <small className="text-success" style={{ fontSize: '0.7rem' }}>10% off</small>}
                              </>
                            )}
                          </div>
                        </div>
                      </button>
                      
                      {/* Ultimate Pack Button */}
                      <button
                        className={`btn btn-sm ${ticketQuantity === (multiplyAndSave ? 200 : 100) ? 'btn-primary' : 'btn-outline-primary'} text-start p-2`}
                        onClick={() => setTicketQuantity(multiplyAndSave ? 200 : 100)}
                      >
                        <div className="d-flex justify-content-between align-items-center">
                          <div>
                            <div className="fw-semibold">Ultimate</div>
                            <small className="text-muted">
                              {multiplyAndSave ? '200' : '100'} tickets
                              {calculateBonus(200) > 0 && (
                                <span className="text-success"> +{calculateBonus(200)} bonus</span>
                              )}
                            </small>
                          </div>
                          <div className="text-end">
                            {reputationDiscount > 0 ? (
                              <>
                                <div className="fw-bold">
                                  ${(() => {
                                    let price = (multiplyAndSave ? 200 : 100) * 0.29;
                                    if (multiplyAndSave) price *= 0.9;
                                    price *= (1 - reputationDiscount / 100);
                                    return price.toFixed(2);
                                  })()}
                                </div>
                                <small className="text-muted text-decoration-line-through" style={{ fontSize: '0.7rem' }}>
                                  ${multiplyAndSave ? (200 * 0.29 * 0.9).toFixed(2) : '29.00'}
                                </small>
                              </>
                            ) : (
                              <>
                                <div className="fw-bold">
                                  ${multiplyAndSave ? (200 * 0.29 * 0.9).toFixed(2) : '29.00'}
                                </div>
                                {multiplyAndSave && <small className="text-success" style={{ fontSize: '0.7rem' }}>10% off</small>}
                              </>
                            )}
                          </div>
                        </div>
                      </button>
                    </div>
                    
                    {/* Selected Total */}
                    <div className="mt-2 bg-light rounded-2 p-2 text-center">
                      <small className="text-muted d-block">
                        {ticketQuantity} tickets
                        {calculateBonus(ticketQuantity) > 0 && (
                          <span className="text-success"> +{calculateBonus(ticketQuantity)} bonus</span>
                        )}
                      </small>
                      <div className="fw-bold text-primary">
                        ${(() => {
                          let price = ticketQuantity * 0.29;
                          if (multiplyAndSave) price *= 0.9; // 10% multiply discount
                          if (reputationDiscount > 0) price *= (1 - reputationDiscount / 100); // Reputation discount
                          return price.toFixed(2);
                        })()}
                      </div>
                      {(multiplyAndSave || reputationDiscount > 0) && (
                        <>
                          {multiplyAndSave && (
                            <small className="text-success d-block">Multiply discount: ${(ticketQuantity * 0.29 * 0.1).toFixed(2)}</small>
                          )}
                          {reputationDiscount > 0 && (
                            <small className="text-success d-block">
                              Reputation discount ({reputationDiscount}%): ${(() => {
                                let basePrice = ticketQuantity * 0.29;
                                if (multiplyAndSave) basePrice *= 0.9;
                                return (basePrice * (reputationDiscount / 100)).toFixed(2);
                              })()}
                            </small>
                          )}
                          {calculateBonus(ticketQuantity) > 0 && (
                            <small className="text-info d-block">
                              {demandLevel === 'low' && 'Low demand'}
                              {demandLevel === 'medium' && 'Medium demand'}
                              {demandLevel === 'high' && 'High demand!'}
                              {demandLevel === 'very-high' && 'Very high demand!'}
                              {' - '}{bonusPercentage}% bonus
                            </small>
                          )}
                          {(multiplyAndSave || reputationDiscount > 0) && (
                            <small className="text-muted d-block mt-1">
                              Total savings: ${(() => {
                                const baseTotal = ticketQuantity * 0.29;
                                let finalPrice = baseTotal;
                                if (multiplyAndSave) finalPrice *= 0.9;
                                if (reputationDiscount > 0) finalPrice *= (1 - reputationDiscount / 100);
                                return (baseTotal - finalPrice).toFixed(2);
                              })()}
                            </small>
                          )}
                        </>
                      )}
                    </div>
                    
                    {/* Reputation Discount Info Message */}
                    {reputation && reputation.totalRatings === 0 && (
                      <div className="mt-2 p-2 rounded-2" style={{ backgroundColor: 'rgba(13, 110, 253, 0.08)', border: '1px solid rgba(13, 110, 253, 0.2)' }}>
                        <div className="d-flex align-items-start gap-2">
                          <div className="rounded-circle bg-info bg-opacity-25 d-flex align-items-center justify-content-center" style={{ width: '24px', height: '24px', minWidth: '24px' }}>
                            <Info size={14} className="text-info" />
                          </div>
                          <small style={{ fontSize: '0.875rem', lineHeight: '1.4' }}>
                            Host an event and get rated to unlock reputation discounts up to 20% off
                          </small>
                        </div>
                      </div>
                    )}
                    {reputation && reputation.totalRatings > 0 && reputation.reputation < 55 && (
                      <div className="mt-2 p-2 rounded-2" style={{ backgroundColor: 'rgba(255, 193, 7, 0.08)', border: '1px solid rgba(255, 193, 7, 0.2)' }}>
                        <div className="d-flex align-items-start gap-2">
                          <div className="rounded-circle bg-warning bg-opacity-25 d-flex align-items-center justify-content-center" style={{ width: '24px', height: '24px', minWidth: '24px' }}>
                            <AlertTriangle size={14} className="text-warning" />
                          </div>
                          <small style={{ fontSize: '0.875rem', lineHeight: '1.4' }}>
                            Reputation discount requires 55% or higher rating (currently {reputation.reputation}%)
                          </small>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Payment Buttons */}
              <div className="border-top mt-4 pt-4">
                <div className="row g-2">
                  <div className="col-6">
                    <button 
                      className="btn btn-outline-primary w-100 py-2"
                      onClick={handlePurchaseTickets}
                      disabled={isPurchasing || ticketQuantity < 12}
                    >
                      {isPurchasing ? (
                        <>Processing...</>
                      ) : (
                        <>
                          <img src="/stripe-icon.png" alt="" style={{ width: '20px', height: '20px', marginRight: '8px' }} />
                          Stripe
                        </>
                      )}
                    </button>
                  </div>
                  <div className="col-6">
                    <button 
                      className="btn btn-outline-secondary w-100 py-2"
                      disabled
                      title="Coinbase payment coming soon"
                    >
                      <img src="/coinbase-icon.png" alt="" style={{ width: '20px', height: '20px', marginRight: '8px', opacity: 0.5 }} />
                      <span className="text-muted">Coinbase</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* My Tickets Section */}
      <div className="row mb-4">
        <div className="col-12">
          <h4 className="h5 fw-semibold mb-3">
            <img src="/tickets-icon.png" alt="" style={{ width: '20px', height: '20px', marginRight: '8px', verticalAlign: 'text-bottom' }} />
            My Tickets
          </h4>
          
          {ticketsLoading ? (
            <div className="card">
              <div className="card-body">
                <div className="placeholder-glow">
                  <div className="placeholder col-12 mb-2"></div>
                  <div className="placeholder col-8"></div>
                </div>
              </div>
            </div>
          ) : tickets?.length === 0 ? (
            <div className="card">
              <div className="card-body text-center py-5">
                <Ticket className="text-muted mb-3 mx-auto" size={48} />
                <h6 className="text-muted">No tickets yet</h6>
                <p className="text-muted small">Tickets you purchase will appear here</p>
              </div>
            </div>
          ) : (
            <>
              <div className="row g-3">
                {tickets?.slice(0, ticketsDisplayed).map((ticket) => (
                  <div key={ticket.id} className="col-md-4">
                    <div 
                      onClick={() => setLocation(`/tickets/${ticket.id}`)}
                      style={{ 
                        cursor: 'pointer'
                      }}
                    >
                      <TicketCard 
                        ticket={ticket}
                        event={ticket.event}
                        showQR={false}
                        showBadges={true}
                      />
                    </div>
                  </div>
                ))}
              </div>
              {tickets && tickets.length > ticketsDisplayed && (
                <div className="text-center mt-4">
                  <button
                    className="btn btn-secondary"
                    onClick={() => setTicketsDisplayed(prev => Math.min(prev + 10, tickets.length))}
                    data-testid="button-show-more-tickets"
                  >
                    Show {Math.min(10, tickets.length - ticketsDisplayed)} More
                  </button>
                  <div className="text-muted small mt-2">
                    Showing {ticketsDisplayed} of {tickets.length} tickets
                  </div>
                </div>
              )}
              {tickets && tickets.length > 10 && ticketsDisplayed >= tickets.length && (
                <div className="text-center mt-3">
                  <button
                    className="btn btn-outline-secondary btn-sm"
                    onClick={() => setTicketsDisplayed(10)}
                    data-testid="button-show-less-tickets"
                  >
                    Show Less
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* NFT Registry Section - Only show if user has minted NFTs */}
      {registryRecords && registryRecords.length > 0 && (
        <div className="row mb-4">
          <div className="col-12">
            <h4 className="h5 fw-semibold mb-3">
              <Sparkles className="me-2" size={20} />
              My NFT Collection
            </h4>
            
            {registryLoading ? (
              <div className="card">
                <div className="card-body">
                  <div className="placeholder-glow">
                    <div className="placeholder col-12 mb-2"></div>
                    <div className="placeholder col-8"></div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="row g-3">
                {registryRecords.map((record) => {
                  const mediaUrl = (record as any).imageUrl;
                  const metadata = record.metadata as any;
                  const mediaType = metadata?.mediaType || 'image/gif';
                  const isVideo = mediaType === 'video/mp4' || mediaUrl?.endsWith('.mp4');
                  const isHTML = mediaType === 'text/html' || mediaUrl?.endsWith('.html');
                  
                  return (
                    <div key={record.id} className="col-md-6">
                      <div className="card">
                        {mediaUrl && (
                          isHTML ? (
                            <div style={{ height: '400px', overflow: 'hidden' }}>
                              <HTMLViewer 
                                htmlUrl={mediaUrl}
                                title={record.title}
                                className="w-100 h-100"
                              />
                            </div>
                          ) : isVideo ? (
                            <video 
                              src={mediaUrl}
                              className="card-img-top" 
                              style={{ height: '200px', objectFit: 'cover' }}
                              autoPlay
                              loop
                              muted
                              playsInline
                            />
                          ) : (
                            <img 
                              src={mediaUrl} 
                              className="card-img-top" 
                              alt={record.title}
                              style={{ height: '200px', objectFit: 'cover' }}
                            />
                          )
                        )}
                        <div className="card-body">
                        <div className="d-flex justify-content-between align-items-start mb-3">
                          <div>
                            <h6 className="card-title mb-1">{record.title}</h6>
                            <p className="text-muted small mb-0">
                              {record.eventName} • {record.eventDate}
                            </p>
                          </div>
                          <span className="badge bg-info">NFT</span>
                        </div>
                        
                        <p className="card-text small">{record.description}</p>
                        
                        <div className="border-top pt-2 mt-2">
                          <div className="row g-2 text-muted small">
                            <div className="col-6">
                              <strong>Ticket #:</strong> {record.ticketNumber}
                            </div>
                            <div className="col-6">
                              <strong>Venue:</strong> {record.eventVenue}
                            </div>
                            <div className="col-6">
                              <strong>Validated:</strong> {record.validatedAt ? new Date(record.validatedAt).toLocaleDateString() : 'N/A'}
                            </div>
                            <div className="col-6">
                              <strong>Minted:</strong> {record.mintedAt ? new Date(record.mintedAt).toLocaleDateString() : 'N/A'}
                            </div>
                          </div>
                        </div>
                        
                        {record.transferCount && record.transferCount > 0 && (
                          <div className="mt-2">
                            <span className="badge bg-secondary">
                              {record.transferCount} Transfer{record.transferCount !== 1 ? 's' : ''}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* My Events Section */}
      <div className="row">
        <div className="col-12">
          <h4 className="h5 fw-semibold mb-3">
            <img src="/events-icon.png" alt="" style={{ width: '20px', height: '20px', marginRight: '8px', verticalAlign: 'text-bottom' }} />
            My Events
          </h4>
          
          {eventsLoading ? (
            <div className="card">
              <div className="card-body">
                <div className="placeholder-glow">
                  <div className="placeholder col-12 mb-2"></div>
                  <div className="placeholder col-8"></div>
                </div>
              </div>
            </div>
          ) : events?.length === 0 ? (
            <div className="card">
              <div className="card-body text-center py-5">
                <Calendar className="text-muted mb-3 mx-auto" size={48} />
                <h6 className="text-muted">No events created</h6>
                <p className="text-muted small">Events you create will appear here</p>
              </div>
            </div>
          ) : (
            <div className="card">
              <div className="card-body p-0">
                {events?.map((event, index) => (
                  <div 
                    key={event.id}
                    className={`p-3 ${index !== events.length - 1 ? 'border-bottom' : ''}`}
                  >
                    <div className="d-flex justify-content-between align-items-center">
                      <div>
                        <h6 className="mb-1">
                          <Link href={`/events/${event.id}`} className="text-decoration-none text-dark">
                            {event.name}
                          </Link>
                        </h6>
                        <p className="text-muted small mb-0">
                          {event.date} • {event.time} • {event.venue}
                        </p>
                      </div>
                      <div className="text-end">
                        <p className="mb-0 fw-semibold">${event.ticketPrice}</p>
                        <p className="text-muted small mb-0">per ticket</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}