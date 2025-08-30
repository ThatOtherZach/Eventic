import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Star, Clock, TrendingUp, AlertTriangle, X } from "lucide-react";

interface BoostEventModalProps {
  eventId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface BoostInfo {
  canBoost: boolean;
  currentFeaturedCount: number;
  maxSlots: number;
  nextPosition: number | null;
  price?: string;
  bumpPrice?: string;
  standardHourlyRate: string;
  bumpHourlyRate: string;
  allSlotsTaken: boolean;
}

export function BoostEventModal({ eventId, open, onOpenChange }: BoostEventModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedDuration, setSelectedDuration] = useState<"1hour" | "6hours" | "12hours" | "24hours">("6hours");
  const [useBoostType, setUseBoostType] = useState<"normal" | "bump">("normal");

  const { data: boostInfo, isLoading } = useQuery<BoostInfo>({
    queryKey: ["/api/events", eventId, "boost-info"],
    enabled: open,
  });
  
  // When boost info loads and all slots are taken, automatically select bump
  useEffect(() => {
    if (boostInfo && boostInfo.allSlotsTaken && useBoostType === "normal") {
      setUseBoostType("bump");
    }
  }, [boostInfo]);

  const boostMutation = useMutation({
    mutationFn: async (data: { duration: string; isBump: boolean }) => {
      const response = await apiRequest("POST", `/api/events/${eventId}/boost`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/featured-events"] });
      queryClient.invalidateQueries({ queryKey: ["/api/events", eventId, "boost-info"] });
      toast({
        title: "Success",
        description: "Event has been boosted to featured section!",
      });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to boost event",
        variant: "destructive",
      });
    },
  });

  const handleBoost = () => {
    if (!boostInfo) return;
    
    const isBump = useBoostType === "bump";
    boostMutation.mutate({
      duration: selectedDuration,
      isBump,
    });
  };

  const getDurationLabel = (duration: string) => {
    switch (duration) {
      case "1hour": return "1 Hour";
      case "6hours": return "6 Hours";
      case "12hours": return "12 Hours";
      case "24hours": return "24 Hours";
      default: return duration;
    }
  };

  const getDurationHours = (duration: string) => {
    switch (duration) {
      case "1hour": return 1;
      case "6hours": return 6;
      case "12hours": return 12;
      case "24hours": return 24;
      default: return 1;
    }
  };

  const getPrice = () => {
    if (!boostInfo) return "0.00";
    
    const hours = getDurationHours(selectedDuration);
    const standardRate = parseFloat(boostInfo.standardHourlyRate || "0.02");
    const bumpRate = parseFloat(boostInfo.bumpHourlyRate || "0.04");
    
    let price = useBoostType === "bump" ? bumpRate * hours : standardRate * hours;
    
    // Apply discounts for longer durations
    if (selectedDuration === "12hours") {
      price = price * 0.9; // 10% discount
    } else if (selectedDuration === "24hours") {
      price = price * 0.8; // 20% discount
    }
    
    return price.toFixed(2);
  };

  if (!open) return null;

  return (
    <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content">
          <div className="modal-header border-0">
            <h5 className="modal-title d-flex align-items-center">
              <Star className="text-warning me-2" size={20} />
              Boost Event to Featured
            </h5>
            <button 
              type="button" 
              className="btn-close" 
              onClick={() => onOpenChange(false)}
            />
          </div>
          
          <div className="modal-body">
            {isLoading ? (
              <div className="text-center py-4">
                <div className="spinner-border text-primary" role="status">
                  <span className="visually-hidden">Loading boost info...</span>
                </div>
              </div>
            ) : !boostInfo?.canBoost ? (
              <div className="text-center py-4">
                <AlertTriangle className="text-warning mb-3" size={48} />
                <h6 className="mb-2">Event Already Featured</h6>
                <p className="text-muted">This event is already in the featured section.</p>
              </div>
            ) : (
              <>
                {/* Featured Section Info */}
                <div className="bg-light rounded p-3 mb-4">
                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <small className="text-muted">Featured Slots</small>
                    <small className="fw-medium">{boostInfo.currentFeaturedCount} / {boostInfo.maxSlots}</small>
                  </div>
                  <div className="progress" style={{ height: "6px" }}>
                    <div 
                      className="progress-bar bg-warning" 
                      style={{ width: `${(boostInfo.currentFeaturedCount / boostInfo.maxSlots) * 100}%` }}
                    />
                  </div>
                  <small className="text-muted">
                    {boostInfo.allSlotsTaken 
                      ? "All slots taken - use bump option to get priority"
                      : `Next available position: #${boostInfo.nextPosition}`
                    }
                  </small>
                </div>

                {/* Boost Type Selection */}
                <div className="mb-4">
                  <label className="form-label fw-medium">Boost Type</label>
                  <div className="row g-2">
                    <div className="col-12">
                      <div 
                        className={`card cursor-pointer ${useBoostType === "normal" ? "border-primary bg-primary bg-opacity-10" : ""}`}
                        onClick={() => setUseBoostType("normal")}
                        style={{ cursor: boostInfo.allSlotsTaken ? "not-allowed" : "pointer" }}
                      >
                        <div className="card-body p-3">
                          <div className="d-flex align-items-center">
                            <input
                              type="radio"
                              className="form-check-input me-2"
                              checked={useBoostType === "normal"}
                              disabled={boostInfo.allSlotsTaken}
                              readOnly
                            />
                            <div className="flex-grow-1">
                              <div className="d-flex justify-content-between align-items-center">
                                <span className="fw-medium">Standard Boost</span>
                                <span className="text-primary fw-bold">${boostInfo.standardHourlyRate}/hour</span>
                              </div>
                              <small className="text-muted">
                                {boostInfo.allSlotsTaken 
                                  ? "All slots currently taken"
                                  : `Get position #${boostInfo.nextPosition} in featured carousel`
                                }
                              </small>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                    {boostInfo.allSlotsTaken && (
                      <div className="col-12">
                        <div 
                          className={`card cursor-pointer ${useBoostType === "bump" ? "border-warning bg-warning bg-opacity-10" : ""}`}
                          onClick={() => setUseBoostType("bump")}
                          style={{ cursor: "pointer" }}
                        >
                          <div className="card-body p-3">
                            <div className="d-flex align-items-center">
                              <input
                                type="radio"
                                className="form-check-input me-2"
                                checked={useBoostType === "bump"}
                                readOnly
                              />
                              <div className="flex-grow-1">
                                <div className="d-flex justify-content-between align-items-center">
                                  <span className="fw-medium d-flex align-items-center">
                                    <TrendingUp size={16} className="me-1" />
                                    Bump to Top
                                  </span>
                                  <span className="text-warning fw-bold">${boostInfo.bumpHourlyRate}/hour</span>
                                </div>
                                <small className="text-muted">
                                  Jump to position #1 - 2x price for priority placement
                                </small>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Duration Selection */}
                <div className="mb-4">
                  <label className="form-label fw-medium">Duration</label>
                  <select 
                    className="form-select"
                    value={selectedDuration}
                    onChange={(e) => setSelectedDuration(e.target.value as "1hour" | "6hours" | "12hours" | "24hours")}
                  >
                    <option value="1hour">1 Hour</option>
                    <option value="6hours">6 Hours</option>
                    <option value="12hours">12 Hours</option>
                    <option value="24hours">24 Hours</option>
                  </select>
                </div>

                {/* Pricing Info */}
                <div className="bg-primary bg-opacity-10 rounded p-3 mb-4">
                  <div className="d-flex justify-content-between align-items-center">
                    <div>
                      <div className="fw-medium">Total Cost</div>
                      <small className="text-muted">
                        {getDurationLabel(selectedDuration)} • {useBoostType === "bump" ? "Bump" : "Standard"}
                      </small>
                    </div>
                    <div className="text-end">
                      <div className="h5 mb-0 fw-bold text-primary">${getPrice()}</div>
                      <small className="text-muted">Payment required</small>
                    </div>
                  </div>
                </div>

                {/* Important Notice */}
                <div className="alert alert-info d-flex align-items-start">
                  <AlertTriangle size={20} className="me-2 mt-1 flex-shrink-0" />
                  <div>
                    <strong>Pricing:</strong> Standard boost costs $0.02 per hour, Bump costs $0.04 per hour (2x rate). 12-hour bookings get 10% discount, 24-hour bookings get 20% discount. Payment processing is not yet implemented - this will activate the boost immediately.
                  </div>
                </div>
              </>
            )}
          </div>
          
          {boostInfo?.canBoost && (
            <div className="modal-footer border-0">
              <button 
                type="button" 
                className="btn btn-outline-secondary" 
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </button>
              <button 
                type="button" 
                className="btn btn-primary"
                onClick={handleBoost}
                disabled={boostMutation.isPending || (useBoostType === "normal" && boostInfo.allSlotsTaken)}
              >
                {boostMutation.isPending ? (
                  <>
                    <div className="spinner-border spinner-border-sm me-2" role="status" />
                    Boosting...
                  </>
                ) : (
                  <>
                    ${getPrice()} Buy Boost
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}