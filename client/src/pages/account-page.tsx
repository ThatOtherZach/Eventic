import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import {
  Calendar,
  Ticket,
  User,
  Eye,
  Sparkles,
  Edit,
  Save,
  X,
  Globe,
  CheckCircle,
  Wallet,
  Gift,
  Info,
  AlertTriangle,
  ChevronDown,
  Lock,
} from "lucide-react";
import { Link, useLocation, useSearch } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useNotifications } from "@/hooks/use-notifications";
import { TicketCard } from "@/components/tickets/ticket-card";
import { PastEvents } from "@/components/archive/past-events";
import { HTMLViewer } from "@/components/nft/html-viewer";
import type {
  Ticket as TicketType,
  Event,
  RegistryRecord,
  AccountBalance,
} from "@shared/schema";
import { loadStripe } from "@stripe/stripe-js";
import smileyIcon from "@assets/image_1756856574950.png";

export default function AccountPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const searchParams = useSearch();
  const [ticketsDisplayed, setTicketsDisplayed] = useState(10);
  const [secretCode, setSecretCode] = useState("");
  const [ticketQuantity, setTicketQuantity] = useState(12);
  const [purchaseExpanded, setPurchaseExpanded] = useState(true);
  const [secretCodeExpanded, setSecretCodeExpanded] = useState(false);
  const [isRedeeming, setIsRedeeming] = useState(false);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [multiplyAndSave, setMultiplyAndSave] = useState(false);
  const [demandLevel, setDemandLevel] = useState<
    "low" | "medium" | "high" | "very-high"
  >("low");
  const [bonusPercentage, setBonusPercentage] = useState(0);
  const [reputationDiscount, setReputationDiscount] = useState(0);

  const { toast } = useToast();
  const { addNotification } = useNotifications();

  // Fetch demand data
  const { data: demandData } = useQuery<{
    demand: number;
    demandMultiplier: number;
    currentUnitPrice: number;
    baseUnitPrice: number;
  }>({
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
        setDemandLevel("low");
        setBonusPercentage(2);
      } else if (demand < 200) {
        setDemandLevel("medium");
        setBonusPercentage(5);
      } else if (demand < 500) {
        setDemandLevel("high");
        setBonusPercentage(8);
      } else {
        setDemandLevel("very-high");
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

  const { data: tickets, isLoading: ticketsLoading } = useQuery<
    (TicketType & { event: Event })[]
  >({
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

  const { data: registryRecords, isLoading: registryLoading } = useQuery<
    RegistryRecord[]
  >({
    queryKey: ["/api/user/registry"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/user/registry");
      return response.json();
    },
    enabled: !!user,
  });

  const { data: reputation } = useQuery<{
    thumbsUp: number;
    thumbsDown: number;
    percentage: number | null;
    reputation: number;
    totalRatings: number;
  }>({
    queryKey: [`/api/users/${user?.id}/reputation`],
    queryFn: async () => {
      const response = await apiRequest(
        "GET",
        `/api/users/${user?.id}/reputation`,
      );
      return response.json();
    },
    enabled: !!user?.id,
  });

  const { data: validatedCount } = useQuery<{ validatedCount: number }>({
    queryKey: [`/api/users/${user?.id}/validated-count`],
    queryFn: async () => {
      const response = await apiRequest(
        "GET",
        `/api/users/${user?.id}/validated-count`,
      );
      return response.json();
    },
    enabled: !!user?.id,
  });

  // Fetch user details to ensure displayName and memberStatus are loaded
  const { data: userDetails } = useQuery<{
    id: string;
    email: string;
    displayName?: string;
    memberStatus?: string;
  }>({
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

  const { data: claimStatus } = useQuery<{
    canClaim: boolean;
    nextClaimAt?: string;
  }>({
    queryKey: ["/api/currency/daily-claim-status"],
    queryFn: async () => {
      const response = await apiRequest(
        "GET",
        "/api/currency/daily-claim-status",
      );
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
      queryClient.invalidateQueries({
        queryKey: ["/api/currency/daily-claim-status"],
      });
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

  // Calculate volume discount for users with less than 5 ratings
  const calculateVolumeDiscount = (quantity: number): number => {
    // Only apply if user has less than 5 total ratings and x2 multiplier is NOT active and quantity > 100
    if (
      !multiplyAndSave &&
      reputation &&
      reputation.totalRatings < 5 &&
      quantity > 100
    ) {
      // 5% discount for every 50 tickets
      const discountTiers = Math.floor(quantity / 50);
      return discountTiers * 5; // 5% per 50 tickets
    }
    return 0;
  };

  // Round price to nearest .69
  const roundToNice = (price: number): number => {
    const base = Math.floor(price);
    const decimal = price - base;

    // If decimal is less than 0.35, round down to X.69 (previous dollar)
    // If decimal is between 0.35 and 0.85, round to current X.69
    // If decimal is above 0.85, round up to (X+1).69
    if (base === 0 && price < 1) {
      return 0.69;
    } else if (decimal < 0.35 && base > 0) {
      return base - 0.31; // X-1.69
    } else if (decimal > 0.85) {
      return base + 1.69; // X+1.69
    } else {
      return base + 0.69; // X.69
    }
  };

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
        code: secretCode.trim(),
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

      const volumeDiscount = calculateVolumeDiscount(ticketQuantity);
      const response = await apiRequest(
        "POST",
        "/api/currency/create-purchase",
        {
          quantity: finalQuantity,
          hasDiscount: multiplyAndSave,
          reputationDiscount: reputationDiscount,
          volumeDiscount: volumeDiscount,
        },
      );
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
                    <img
                      src="/key-icon.png"
                      alt=""
                      style={{ width: "48px", height: "48px" }}
                    />
                  </div>
                  <div className="me-3 d-block d-sm-none">
                    <img
                      src="/key-icon.png"
                      alt=""
                      style={{ width: "36px", height: "36px" }}
                    />
                  </div>
                  <div>
                    {(userDetails?.displayName || user.displayName) && (
                      <h5 className="card-title mb-1">
                        {userDetails?.displayName || user.displayName}
                      </h5>
                    )}
                    {(userDetails?.memberStatus || user.memberStatus) && (
                      <p className="text-muted small mb-1">
                        {userDetails?.memberStatus || user.memberStatus}
                      </p>
                    )}
                    <p className="text-muted mb-0">
                      {userDetails?.email || user.email}
                    </p>
                    {reputation && reputation.percentage !== null && (
                      <div className="d-flex align-items-center mt-2">
                        <img
                          src="/world-icon.png"
                          alt=""
                          style={{
                            width: "16px",
                            height: "16px",
                            marginRight: "8px",
                          }}
                        />
                        <span className="text-muted small">
                          Reputation: <strong>{reputation.percentage}%</strong>
                          <span className="ms-2 text-secondary">
                            ({reputation.thumbsUp} 👍 / {reputation.thumbsDown}{" "}
                            👎)
                          </span>
                        </span>
                      </div>
                    )}
                    {validatedCount && (
                      <div className="d-flex align-items-center mt-2">
                        <img
                          src="/validation-icon.png"
                          alt=""
                          style={{
                            width: "16px",
                            height: "16px",
                            marginRight: "8px",
                          }}
                        />
                        <span className="text-muted small">
                          Validated:{" "}
                          <strong>{validatedCount.validatedCount}</strong>
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

      {/* My Wallet - Purchase and Redeem Tickets */}
      <div className="row mb-4">
        <div className="col-12">
          <div className="card shadow-sm">
            <div className="card-body py-3">
              <h5 className="card-title mb-3 d-flex align-items-center gap-2">
                <Wallet size={20} />
                Credits Wallet
              </h5>

              {/* Balance Display */}
              <div className="mb-3">
                <div className="text-muted text-uppercase small mb-1">
                  You have
                </div>
                <div className="d-flex align-items-baseline gap-2">
                  <h2 className="mb-0 text-danger">
                    {balance ? Math.floor(parseFloat(balance.balance)) : 0}
                  </h2>
                  <span className="text-muted">Credits</span>
                  {!claimStatus?.canClaim && claimStatus?.nextClaimAt && (
                    <span className="badge bg-success ms-2">
                      <CheckCircle size={12} className="me-1" />
                      claimed
                    </span>
                  )}
                </div>
                <div className="mt-2">
                  <small className="text-muted" style={{ fontSize: "0.85rem" }}>
                    Credits are used to create and boost events, and to charge
                    your ticket for better special-effect odds. You can collect
                    free credits every 12 hours.
                  </small>
                </div>
                {/* Daily Claim Button - Show only when not claimed */}
                {claimStatus && claimStatus.canClaim && (
                  <div className="mt-2">
                    <button
                      onClick={() => claimDailyMutation.mutate()}
                      disabled={claimDailyMutation.isPending}
                      className="btn btn-success btn-sm"
                    >
                      {claimDailyMutation.isPending
                        ? "Okay one sec..."
                        : "Claim Credits"}
                    </button>
                  </div>
                )}
              </div>

              {/* Secret Code Section - Collapsible */}
              <div className="border-top pt-3">
                <div
                  className="d-flex align-items-center justify-content-between mb-2"
                  style={{ cursor: "pointer" }}
                  onClick={() => setSecretCodeExpanded(!secretCodeExpanded)}
                >
                  <h6
                    className="mb-0 text-uppercase fw-semibold"
                    style={{ fontSize: "0.85rem", letterSpacing: "0.5px" }}
                  >
                    Secret Code
                  </h6>
                  <ChevronDown
                    size={16}
                    style={{
                      transform: secretCodeExpanded
                        ? "rotate(180deg)"
                        : "rotate(0deg)",
                      transition: "transform 0.2s",
                    }}
                  />
                </div>
                {secretCodeExpanded && (
                  <div className="mb-3">
                    <div className="input-group">
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Enter code"
                        value={secretCode}
                        onChange={(e) =>
                          setSecretCode(e.target.value.toUpperCase())
                        }
                        onKeyDown={(e) =>
                          e.key === "Enter" && handleRedeemCode()
                        }
                        disabled={isRedeeming}
                        style={{ textTransform: "uppercase" }}
                      />
                      <button
                        className="btn btn-outline-primary"
                        onClick={handleRedeemCode}
                        disabled={isRedeeming || !secretCode.trim()}
                      >
                        {isRedeeming ? "Hmmmm..." : "Execute"}
                      </button>
                    </div>
                    <small className="text-muted mt-2 d-block">
                      <Lock size={14} className="me-1" />
                      Redeem codes for stuff
                    </small>
                  </div>
                )}
              </div>

              {/* Ticket Purchase Section - Collapsible */}
              <div className="border-top pt-3 mt-3">
                <div
                  className="d-flex align-items-center justify-content-between mb-2"
                  style={{ cursor: "pointer" }}
                  onClick={() => setPurchaseExpanded(!purchaseExpanded)}
                >
                  <h6
                    className="mb-0 text-uppercase fw-semibold"
                    style={{ fontSize: "0.85rem", letterSpacing: "0.5px" }}
                  >
                    Choose a Ticket Pack
                  </h6>
                  <ChevronDown
                    size={16}
                    style={{
                      transform: purchaseExpanded
                        ? "rotate(180deg)"
                        : "rotate(0deg)",
                      transition: "transform 0.2s",
                    }}
                  />
                </div>
                {purchaseExpanded && (
                  <div>
                    {/* Multiply and Save Checkbox */}
                    <div className="form-check mb-3">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        id="multiplyAndSave"
                        checked={multiplyAndSave}
                        onChange={(e) => setMultiplyAndSave(e.target.checked)}
                      />
                      <label
                        className="form-check-label small"
                        htmlFor="multiplyAndSave"
                      >
                        Multiply & Save
                      </label>
                    </div>

                    {/* Reputation Discount Info Message - Moved here */}
                    {reputation && reputation.totalRatings === 0 && (
                      <div
                        className="mb-3 p-2 rounded-2"
                        style={{
                          backgroundColor: "rgba(13, 110, 253, 0.08)",
                          border: "1px solid rgba(13, 110, 253, 0.2)",
                        }}
                      >
                        <div className="d-flex align-items-start gap-2">
                          <div style={{ minWidth: "20px" }}>
                            <Info
                              size={20}
                              className="text-info"
                              strokeWidth={2}
                            />
                          </div>
                          <small
                            style={{ fontSize: "0.875rem", lineHeight: "1.4" }}
                          >
                            Heads up! Hosting events and getting good ratings
                            improves your discount level. You can save up to 20%
                            on credits.
                          </small>
                        </div>
                      </div>
                    )}
                    {reputation &&
                      reputation.totalRatings > 0 &&
                      reputation.reputation < 55 && (
                        <div
                          className="mb-3 p-2 rounded-2"
                          style={{
                            backgroundColor: "rgba(255, 193, 7, 0.08)",
                            border: "1px solid rgba(255, 193, 7, 0.2)",
                          }}
                        >
                          <div className="d-flex align-items-start gap-2">
                            <div style={{ minWidth: "20px" }}>
                              <AlertTriangle
                                size={20}
                                className="text-warning"
                                strokeWidth={2}
                              />
                            </div>
                            <small
                              style={{
                                fontSize: "0.875rem",
                                lineHeight: "1.4",
                              }}
                            >
                              Hmm, your reputation as an organizer needs work.
                              You don't yet qualify for a discount :(
                            </small>
                          </div>
                        </div>
                      )}
                    {reputation &&
                      reputation.totalRatings > 0 &&
                      reputation.reputation >= 55 &&
                      reputationDiscount > 0 && (
                        <div
                          className="mb-3 p-2 rounded-2"
                          style={{
                            backgroundColor: "rgba(40, 167, 69, 0.08)",
                            border: "1px solid rgba(40, 167, 69, 0.2)",
                          }}
                        >
                          <div className="d-flex align-items-start gap-2">
                            <div style={{ minWidth: "20px" }}>
                              <Info
                                size={20}
                                className="text-success"
                                strokeWidth={2}
                              />
                            </div>
                            <small
                              style={{
                                fontSize: "0.875rem",
                                lineHeight: "1.4",
                              }}
                            >
                              Your reputation is impressive! You're now getting{" "}
                              {reputationDiscount.toFixed(1)}% off! Keep hosting
                              awesome events :)
                            </small>
                          </div>
                        </div>
                      )}

                    <div className="d-flex flex-column gap-2">
                      {/* Starter Pack Button */}
                      <button
                        className={`btn btn-sm ${ticketQuantity === (multiplyAndSave ? 24 : 12) ? "btn-primary" : "btn-outline-primary"} text-start p-2`}
                        onClick={() =>
                          setTicketQuantity(multiplyAndSave ? 24 : 12)
                        }
                      >
                        <div className="d-flex justify-content-between align-items-center">
                          <div>
                            <div className="fw-semibold">Mini</div>
                            <small className="text-muted">
                              {multiplyAndSave ? "24" : "12"} Tickets
                              {calculateBonus(24) > 0 && (
                                <span
                                  className="badge bg-success ms-1"
                                  style={{ fontSize: "0.65rem" }}
                                >
                                  +{calculateBonus(24)} Bonus
                                </span>
                              )}
                            </small>
                          </div>
                          <div className="text-end">
                            {(() => {
                              const quantity = multiplyAndSave ? 24 : 12;
                              const unitPrice =
                                demandData?.currentUnitPrice || 0.23;
                              const basePrice = quantity * unitPrice;

                              // No discounts for packs under 15 tickets
                              if (quantity < 15) {
                                const finalPrice = roundToNice(basePrice);
                                return (
                                  <>
                                    <div className="fw-bold">
                                      ${finalPrice.toFixed(2)}
                                    </div>
                                  </>
                                );
                              }

                              const volumeDiscount =
                                calculateVolumeDiscount(quantity);
                              const multiplyDiscount = multiplyAndSave ? 10 : 0;
                              const totalDiscount = Math.min(
                                reputationDiscount +
                                  volumeDiscount +
                                  multiplyDiscount,
                                30,
                              ); // Cap at 30% max discount
                              const cappedDiscount = totalDiscount; // Use the capped total directly
                              const finalPrice = roundToNice(
                                basePrice * (1 - cappedDiscount / 100),
                              );

                              if (totalDiscount > 0 || cappedDiscount > 0) {
                                const isMaxDiscount = cappedDiscount >= 30;
                                return (
                                  <>
                                    <div className="fw-bold">
                                      ${finalPrice.toFixed(2)}
                                    </div>
                                    <small
                                      className="text-muted text-decoration-line-through"
                                      style={{ fontSize: "0.7rem" }}
                                    >
                                      ${basePrice.toFixed(2)}
                                    </small>
                                    {isMaxDiscount && (
                                      <span
                                        className="badge bg-warning text-dark d-block mt-1"
                                        style={{ fontSize: "0.65rem" }}
                                      >
                                        Best Rate
                                      </span>
                                    )}
                                    {volumeDiscount > 0 &&
                                      !multiplyAndSave &&
                                      !isMaxDiscount && (
                                        <span
                                          className="badge bg-danger d-block mt-1"
                                          style={{ fontSize: "0.65rem" }}
                                        >
                                          {volumeDiscount}% Off
                                        </span>
                                      )}
                                  </>
                                );
                              } else {
                                return (
                                  <>
                                    <div className="fw-bold">
                                      ${finalPrice.toFixed(2)}
                                    </div>
                                    {multiplyAndSave && (
                                      <small
                                        className="text-success"
                                        style={{ fontSize: "0.7rem" }}
                                      >
                                        10% off
                                      </small>
                                    )}
                                  </>
                                );
                              }
                            })()}
                          </div>
                        </div>
                      </button>

                      {/* Standard Pack Button */}
                      <button
                        className={`btn btn-sm ${ticketQuantity === (multiplyAndSave ? 48 : 24) ? "btn-primary" : "btn-outline-primary"} text-start p-2 position-relative`}
                        onClick={() =>
                          setTicketQuantity(multiplyAndSave ? 48 : 24)
                        }
                      >
                        <div className="d-flex justify-content-between align-items-center">
                          <div>
                            <div className="fw-semibold">Standard</div>
                            <small className="text-muted">
                              {multiplyAndSave ? "48" : "24"} Tickets
                              {calculateBonus(48) > 0 && (
                                <span
                                  className="badge bg-success ms-1"
                                  style={{ fontSize: "0.65rem" }}
                                >
                                  +{calculateBonus(48)} bonus
                                </span>
                              )}
                            </small>
                          </div>
                          <div className="text-end">
                            {(() => {
                              const volumeDiscount = calculateVolumeDiscount(
                                multiplyAndSave ? 48 : 24,
                              );
                              const multiplyDiscount = multiplyAndSave ? 10 : 0;
                              const totalDiscount = Math.min(
                                reputationDiscount +
                                  volumeDiscount +
                                  multiplyDiscount,
                                30,
                              ); // Cap at 30% max discount
                              const unitPrice =
                                demandData?.currentUnitPrice || 0.23;
                              const basePrice =
                                (multiplyAndSave ? 48 : 24) * unitPrice * 1.26; // Keep relative premium
                              const cappedDiscount = totalDiscount; // Use the capped total directly
                              const finalPrice = roundToNice(
                                basePrice * (1 - cappedDiscount / 100),
                              );

                              if (totalDiscount > 0 || cappedDiscount > 0) {
                                const isMaxDiscount = cappedDiscount >= 30;
                                return (
                                  <>
                                    <div className="fw-bold">
                                      ${finalPrice.toFixed(2)}
                                    </div>
                                    <small
                                      className="text-muted text-decoration-line-through"
                                      style={{ fontSize: "0.7rem" }}
                                    >
                                      ${basePrice.toFixed(2)}
                                    </small>
                                    {isMaxDiscount && (
                                      <span
                                        className="badge bg-warning text-dark d-block mt-1"
                                        style={{ fontSize: "0.65rem" }}
                                      >
                                        Best Rate
                                      </span>
                                    )}
                                    {volumeDiscount > 0 &&
                                      !multiplyAndSave &&
                                      !isMaxDiscount && (
                                        <span
                                          className="badge bg-danger d-block mt-1"
                                          style={{ fontSize: "0.65rem" }}
                                        >
                                          {volumeDiscount}% Off
                                        </span>
                                      )}
                                  </>
                                );
                              } else {
                                return (
                                  <>
                                    <div className="fw-bold">
                                      ${finalPrice.toFixed(2)}
                                    </div>
                                    {multiplyAndSave && (
                                      <small
                                        className="text-success"
                                        style={{ fontSize: "0.7rem" }}
                                      >
                                        10% off
                                      </small>
                                    )}
                                  </>
                                );
                              }
                            })()}
                          </div>
                        </div>
                        <span
                          className="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-success"
                          style={{ fontSize: "0.65rem" }}
                        >
                          Popular
                        </span>
                      </button>

                      {/* Premium Pack Button */}
                      <button
                        className={`btn btn-sm ${ticketQuantity === (multiplyAndSave ? 100 : 50) ? "btn-primary" : "btn-outline-primary"} text-start p-2`}
                        onClick={() =>
                          setTicketQuantity(multiplyAndSave ? 100 : 50)
                        }
                      >
                        <div className="d-flex justify-content-between align-items-center">
                          <div>
                            <div className="fw-semibold">
                              Standard 2: Electric Boogaloo
                            </div>
                            <small className="text-muted">
                              {multiplyAndSave ? "100" : "50"} Tickets
                              {calculateBonus(100) > 0 && (
                                <span
                                  className="badge bg-success ms-1"
                                  style={{ fontSize: "0.65rem" }}
                                >
                                  +{calculateBonus(100)} bonus
                                </span>
                              )}
                            </small>
                          </div>
                          <div className="text-end">
                            {(() => {
                              const volumeDiscount = calculateVolumeDiscount(
                                multiplyAndSave ? 100 : 50,
                              );
                              const multiplyDiscount = multiplyAndSave ? 10 : 0;
                              const totalDiscount = Math.min(
                                reputationDiscount +
                                  volumeDiscount +
                                  multiplyDiscount,
                                30,
                              ); // Cap at 30% max discount
                              const unitPrice =
                                demandData?.currentUnitPrice || 0.23;
                              const basePrice =
                                (multiplyAndSave ? 100 : 50) * unitPrice;
                              const cappedDiscount = totalDiscount; // Use the capped total directly
                              const finalPrice = roundToNice(
                                basePrice * (1 - cappedDiscount / 100),
                              );

                              if (totalDiscount > 0 || cappedDiscount > 0) {
                                const isMaxDiscount = cappedDiscount >= 30;
                                return (
                                  <>
                                    <div className="fw-bold">
                                      ${finalPrice.toFixed(2)}
                                    </div>
                                    <small
                                      className="text-muted text-decoration-line-through"
                                      style={{ fontSize: "0.7rem" }}
                                    >
                                      ${basePrice.toFixed(2)}
                                    </small>
                                    {isMaxDiscount && (
                                      <span
                                        className="badge bg-warning text-dark d-block mt-1"
                                        style={{ fontSize: "0.65rem" }}
                                      >
                                        Best Rate
                                      </span>
                                    )}
                                    {volumeDiscount > 0 &&
                                      !multiplyAndSave &&
                                      !isMaxDiscount && (
                                        <span
                                          className="badge bg-danger d-block mt-1"
                                          style={{ fontSize: "0.65rem" }}
                                        >
                                          {volumeDiscount}% Off
                                        </span>
                                      )}
                                  </>
                                );
                              } else {
                                return (
                                  <>
                                    <div className="fw-bold">
                                      ${finalPrice.toFixed(2)}
                                    </div>
                                    {multiplyAndSave && (
                                      <small
                                        className="text-success"
                                        style={{ fontSize: "0.7rem" }}
                                      >
                                        10% off
                                      </small>
                                    )}
                                  </>
                                );
                              }
                            })()}
                          </div>
                        </div>
                      </button>

                      {/* Ultimate Pack Button */}
                      <button
                        className={`btn btn-sm ${ticketQuantity === (multiplyAndSave ? 200 : 100) ? "btn-primary" : "btn-outline-primary"} text-start p-2`}
                        onClick={() =>
                          setTicketQuantity(multiplyAndSave ? 200 : 100)
                        }
                      >
                        <div className="d-flex justify-content-between align-items-center">
                          <div>
                            <div className="fw-semibold">Large</div>
                            <small className="text-muted">
                              {multiplyAndSave ? "200" : "100"} Tickets
                              {calculateBonus(200) > 0 && (
                                <span
                                  className="badge bg-success ms-1"
                                  style={{ fontSize: "0.65rem" }}
                                >
                                  +{calculateBonus(200)} bonus
                                </span>
                              )}
                            </small>
                          </div>
                          <div className="text-end">
                            {(() => {
                              const volumeDiscount = calculateVolumeDiscount(
                                multiplyAndSave ? 200 : 100,
                              );
                              const multiplyDiscount = multiplyAndSave ? 10 : 0;
                              const totalDiscount = Math.min(
                                reputationDiscount +
                                  volumeDiscount +
                                  multiplyDiscount,
                                30,
                              ); // Cap at 30% max discount
                              const unitPrice =
                                demandData?.currentUnitPrice || 0.23;
                              const basePrice =
                                (multiplyAndSave ? 200 : 100) * unitPrice;
                              const cappedDiscount = totalDiscount; // Use the capped total directly
                              const finalPrice = roundToNice(
                                basePrice * (1 - cappedDiscount / 100),
                              );

                              if (totalDiscount > 0 || cappedDiscount > 0) {
                                const isMaxDiscount = cappedDiscount >= 30;
                                return (
                                  <>
                                    <div className="fw-bold">
                                      ${finalPrice.toFixed(2)}
                                    </div>
                                    <small
                                      className="text-muted text-decoration-line-through"
                                      style={{ fontSize: "0.7rem" }}
                                    >
                                      ${basePrice.toFixed(2)}
                                    </small>
                                    {isMaxDiscount && (
                                      <span
                                        className="badge bg-warning text-dark d-block mt-1"
                                        style={{ fontSize: "0.65rem" }}
                                      >
                                        Best Rate
                                      </span>
                                    )}
                                    {volumeDiscount > 0 &&
                                      !multiplyAndSave &&
                                      !isMaxDiscount && (
                                        <span
                                          className="badge bg-danger d-block mt-1"
                                          style={{ fontSize: "0.65rem" }}
                                        >
                                          {volumeDiscount}% Off
                                        </span>
                                      )}
                                  </>
                                );
                              } else {
                                return (
                                  <>
                                    <div className="fw-bold">
                                      ${finalPrice.toFixed(2)}
                                    </div>
                                    {multiplyAndSave && (
                                      <small
                                        className="text-success"
                                        style={{ fontSize: "0.7rem" }}
                                      >
                                        10% off
                                      </small>
                                    )}
                                  </>
                                );
                              }
                            })()}
                          </div>
                        </div>
                      </button>

                      {/* Wumbo Pack Button */}
                      <button
                        className={`btn btn-sm ${ticketQuantity === (multiplyAndSave ? 400 : 200) ? "btn-primary" : "btn-outline-primary"} text-start p-2`}
                        onClick={() =>
                          setTicketQuantity(multiplyAndSave ? 400 : 200)
                        }
                      >
                        <div className="d-flex justify-content-between align-items-center">
                          <div>
                            <div className="fw-semibold">Wumbo</div>
                            <small className="text-muted">
                              {multiplyAndSave ? "400" : "200"} Tickets
                              {calculateBonus(400) > 0 && (
                                <span
                                  className="badge bg-success ms-1"
                                  style={{ fontSize: "0.65rem" }}
                                >
                                  +{calculateBonus(400)} bonus
                                </span>
                              )}
                            </small>
                          </div>
                          <div className="text-end">
                            {(() => {
                              const volumeDiscount = calculateVolumeDiscount(
                                multiplyAndSave ? 400 : 200,
                              );
                              const multiplyDiscount = multiplyAndSave ? 10 : 0;
                              const totalDiscount = Math.min(
                                reputationDiscount +
                                  volumeDiscount +
                                  multiplyDiscount,
                                30,
                              ); // Cap at 30% max discount
                              const unitPrice =
                                demandData?.currentUnitPrice || 0.23;
                              const basePrice =
                                (multiplyAndSave ? 400 : 200) * unitPrice;
                              const cappedDiscount = totalDiscount; // Use the capped total directly
                              const finalPrice = roundToNice(
                                basePrice * (1 - cappedDiscount / 100),
                              );

                              if (totalDiscount > 0 || cappedDiscount > 0) {
                                const isMaxDiscount = cappedDiscount >= 30;
                                return (
                                  <>
                                    <div className="fw-bold">
                                      ${finalPrice.toFixed(2)}
                                    </div>
                                    <small
                                      className="text-muted text-decoration-line-through"
                                      style={{ fontSize: "0.7rem" }}
                                    >
                                      ${basePrice.toFixed(2)}
                                    </small>
                                    {isMaxDiscount && (
                                      <span
                                        className="badge bg-warning text-dark d-block mt-1"
                                        style={{ fontSize: "0.65rem" }}
                                      >
                                        Best Rate
                                      </span>
                                    )}
                                    {volumeDiscount > 0 &&
                                      !multiplyAndSave &&
                                      !isMaxDiscount && (
                                        <span
                                          className="badge bg-danger d-block mt-1"
                                          style={{ fontSize: "0.65rem" }}
                                        >
                                          {volumeDiscount}% Off
                                        </span>
                                      )}
                                  </>
                                );
                              } else {
                                return (
                                  <>
                                    <div className="fw-bold">
                                      ${finalPrice.toFixed(2)}
                                    </div>
                                    {multiplyAndSave && (
                                      <small
                                        className="text-success"
                                        style={{ fontSize: "0.7rem" }}
                                      >
                                        10% off
                                      </small>
                                    )}
                                  </>
                                );
                              }
                            })()}
                          </div>
                        </div>
                      </button>
                    </div>

                    {/* Selected Total */}
                    <div className="mt-3 p-3 rounded bg-light">
                      <div className="text-center">
                        {/* Price */}
                        <div className="h3 mb-2 text-primary fw-bold">
                          $
                          {(() => {
                            const unitPrice =
                              demandData?.currentUnitPrice || 0.23;
                            const basePrice = ticketQuantity * unitPrice;

                            // No discounts for packs under 15 tickets
                            if (ticketQuantity < 15) {
                              const finalPrice = roundToNice(basePrice);
                              return finalPrice.toFixed(2);
                            }

                            const volumeDiscount =
                              calculateVolumeDiscount(ticketQuantity);
                            const multiplyDiscount = multiplyAndSave ? 10 : 0;
                            const totalDiscount = Math.min(
                              reputationDiscount +
                                volumeDiscount +
                                multiplyDiscount,
                              30,
                            ); // Cap at 30% max
                            const finalPrice = roundToNice(
                              basePrice * (1 - totalDiscount / 100),
                            );
                            return finalPrice.toFixed(2);
                          })()}
                        </div>

                        {/* Total ticket count */}
                        <div className="mb-2" style={{ fontSize: "1.1rem" }}>
                          <span className="fw-semibold text-success">
                            +{ticketQuantity + calculateBonus(ticketQuantity)}{" "}
                            Tickets
                          </span>
                        </div>

                        {/* Total discount if any discounts apply */}
                        {(() => {
                          // No discounts for packs under 15 tickets
                          if (ticketQuantity < 15) {
                            return null;
                          }

                          const volumeDiscount =
                            calculateVolumeDiscount(ticketQuantity);
                          const multiplyDiscount = multiplyAndSave ? 10 : 0;
                          const totalDiscount = Math.min(
                            reputationDiscount +
                              volumeDiscount +
                              multiplyDiscount,
                            30,
                          );

                          if (totalDiscount > 0) {
                            const unitPrice =
                              demandData?.currentUnitPrice || 0.23;
                            const baseTotal = ticketQuantity * unitPrice;
                            const finalPrice = roundToNice(
                              baseTotal * (1 - totalDiscount / 100),
                            );
                            const discountAmount = baseTotal - finalPrice;

                            return (
                              <div className="mb-2">
                                <span className="text-dark d-flex align-items-center gap-1">
                                  -${discountAmount.toFixed(2)} Discount Applied
                                  <img
                                    src={smileyIcon}
                                    alt=""
                                    style={{ width: "16px", height: "16px" }}
                                  />
                                </span>
                              </div>
                            );
                          }
                          return null;
                        })()}

                        {/* Demand bonus badge */}
                        {calculateBonus(ticketQuantity) > 0 && (
                          <div className="mt-2">
                            <span
                              className="badge bg-success px-3 py-2"
                              style={{ fontSize: "0.85rem" }}
                            >
                              {bonusPercentage}% Bonus Applied
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Demand indicator and stats link */}
                    <div className="d-flex justify-content-between align-items-center mt-2">
                      <div className="small text-muted">
                        {demandData && (
                          <>
                            <span
                              className={`badge ${
                                demandData.demandMultiplier <= 1.0
                                  ? "bg-success"
                                  : demandData.demandMultiplier < 1.15
                                    ? "bg-warning"
                                    : "bg-danger"
                              } me-1`}
                            >
                              {demandData.demandMultiplier <= 1.0
                                ? "Base Price"
                                : demandData.demandMultiplier < 1.15
                                  ? "Moderate Demand"
                                  : "High Demand"}
                            </span>
                            <span style={{ fontSize: "0.75rem" }}>
                              ${demandData.currentUnitPrice.toFixed(3)}/credit
                              {demandData.demandMultiplier !== 1 && (
                                <span className="ms-1">
                                  (
                                  {demandData.demandMultiplier < 1
                                    ? `-${Math.round((1 - demandData.demandMultiplier) * 100)}%`
                                    : `+${Math.round((demandData.demandMultiplier - 1) * 100)}%`}
                                  )
                                </span>
                              )}
                            </span>
                          </>
                        )}
                      </div>
                      <Link
                        to="/sys/nerd"
                        className="text-muted small text-decoration-none"
                        style={{ fontSize: "0.75rem" }}
                        data-testid="link-stats-nerds"
                      >
                        Stats for nerds
                      </Link>
                    </div>
                  </div>
                )}
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
                          <img
                            src="/stripe-icon.png"
                            alt=""
                            style={{
                              width: "20px",
                              height: "20px",
                              marginRight: "8px",
                            }}
                          />
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
                      <img
                        src="/coinbase-icon.png"
                        alt=""
                        style={{
                          width: "20px",
                          height: "20px",
                          marginRight: "8px",
                          opacity: 0.5,
                        }}
                      />
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
            <img
              src="/tickets-icon.png"
              alt=""
              style={{
                width: "20px",
                height: "20px",
                marginRight: "8px",
                verticalAlign: "text-bottom",
              }}
            />
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
                <p className="text-muted small">
                  Tickets you purchase will appear here
                </p>
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
                        cursor: "pointer",
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
                    onClick={() =>
                      setTicketsDisplayed((prev) =>
                        Math.min(prev + 10, tickets.length),
                      )
                    }
                    data-testid="button-show-more-tickets"
                  >
                    Show {Math.min(10, tickets.length - ticketsDisplayed)} More
                  </button>
                  <div className="text-muted small mt-2">
                    Showing {ticketsDisplayed} of {tickets.length} tickets
                  </div>
                </div>
              )}
              {tickets &&
                tickets.length > 10 &&
                ticketsDisplayed >= tickets.length && (
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
                  const mediaType = metadata?.mediaType || "image/gif";
                  const isVideo =
                    mediaType === "video/mp4" || mediaUrl?.endsWith(".mp4");
                  const isHTML =
                    mediaType === "text/html" || mediaUrl?.endsWith(".html");

                  return (
                    <div key={record.id} className="col-md-6">
                      <div className="card">
                        {mediaUrl &&
                          (isHTML ? (
                            <div
                              style={{ height: "400px", overflow: "hidden" }}
                            >
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
                              style={{ height: "200px", objectFit: "cover" }}
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
                              style={{ height: "200px", objectFit: "cover" }}
                            />
                          ))}
                        <div className="card-body">
                          <div className="d-flex justify-content-between align-items-start mb-3">
                            <div>
                              <h6 className="card-title mb-1">
                                {record.title}
                              </h6>
                              <p className="text-muted small mb-0">
                                {record.eventName} • {record.eventDate}
                              </p>
                            </div>
                            <span className="badge bg-info">NFT</span>
                          </div>

                          <p className="card-text small">
                            {record.description}
                          </p>

                          <div className="border-top pt-2 mt-2">
                            <div className="row g-2 text-muted small">
                              <div className="col-6">
                                <strong>Ticket #:</strong> {record.ticketNumber}
                              </div>
                              <div className="col-6">
                                <strong>Venue:</strong> {record.eventVenue}
                              </div>
                              <div className="col-6">
                                <strong>Validated:</strong>{" "}
                                {record.validatedAt
                                  ? new Date(
                                      record.validatedAt,
                                    ).toLocaleDateString()
                                  : "N/A"}
                              </div>
                              <div className="col-6">
                                <strong>Minted:</strong>{" "}
                                {record.mintedAt
                                  ? new Date(
                                      record.mintedAt,
                                    ).toLocaleDateString()
                                  : "N/A"}
                              </div>
                            </div>
                          </div>

                          {record.transferCount && record.transferCount > 0 && (
                            <div className="mt-2">
                              <span className="badge bg-secondary">
                                {record.transferCount} Transfer
                                {record.transferCount !== 1 ? "s" : ""}
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
            <img
              src="/events-icon.png"
              alt=""
              style={{
                width: "20px",
                height: "20px",
                marginRight: "8px",
                verticalAlign: "text-bottom",
              }}
            />
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
                <p className="text-muted small">
                  Events you create will appear here
                </p>
              </div>
            </div>
          ) : (
            <div className="card">
              <div className="card-body p-0">
                {events?.map((event, index) => (
                  <div
                    key={event.id}
                    className={`p-3 ${index !== events.length - 1 ? "border-bottom" : ""}`}
                  >
                    <div className="d-flex justify-content-between align-items-center">
                      <div>
                        <h6 className="mb-1">
                          <Link
                            href={`/events/${event.id}`}
                            className="text-decoration-none text-dark"
                          >
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
