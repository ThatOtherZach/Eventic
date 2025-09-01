import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Calendar, Ticket, User, Eye, Sparkles, Edit, Save, X, Globe, CheckCircle, Wallet, Gift } from "lucide-react";
import { Link, useLocation } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useNotifications } from "@/hooks/use-notifications";
import { TicketCard } from "@/components/tickets/ticket-card";
import { PastEvents } from "@/components/archive/past-events";
import type { Ticket as TicketType, Event, RegistryRecord, AccountBalance } from "@shared/schema";

export default function AccountPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [ticketsDisplayed, setTicketsDisplayed] = useState(10);

  const { toast } = useToast();
  const { addNotification } = useNotifications();
  
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

  const { data: reputation } = useQuery<{ thumbsUp: number; thumbsDown: number; percentage: number | null }>({
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
                    {user.displayName && (
                      <h5 className="card-title mb-1">{user.displayName}</h5>
                    )}
                    {user.memberStatus && (
                      <p className="text-muted small mb-1">{user.memberStatus}</p>
                    )}
                    <p className="text-muted mb-0">{user.email}</p>
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
                {/* Balance Display */}
                {balance && (
                  <div className="mt-3 mt-sm-0">
                    <div className="card bg-light">
                      <div className="card-body py-2 px-3">
                        <div className="d-flex align-items-center justify-content-between">
                          <div className="d-flex align-items-center">
                            <Wallet className="text-primary me-2" size={24} />
                            <div>
                              <div className="small text-muted">Tickets Balance</div>
                              <div className="h5 mb-0 fw-bold">{Math.floor(parseFloat(balance.balance))}</div>
                              {parseFloat(balance.holdBalance) > 0 && (
                                <div className="small text-warning">
                                  {Math.floor(parseFloat(balance.holdBalance))} on hold
                                </div>
                              )}
                            </div>
                          </div>
                          {/* Daily Claim Button */}
                          {claimStatus && (
                            <button
                              onClick={() => claimDailyMutation.mutate()}
                              disabled={!claimStatus.canClaim || claimDailyMutation.isPending}
                              className={`btn btn-sm ${claimStatus.canClaim ? 'btn-success' : 'btn-secondary'} d-flex align-items-center`}
                              title={claimStatus.canClaim ? "Claim your daily tickets!" : `Next claim: ${claimStatus.nextClaimAt ? new Date(claimStatus.nextClaimAt).toLocaleString() : 'N/A'}`}
                            >
                              <Gift size={16} className="me-1" />
                              {claimDailyMutation.isPending ? "Claiming..." : claimStatus.canClaim ? "Claim Daily" : "Claimed"}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
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
                      />
                    </div>
                    {(ticket.isValidated || (ticket as any).resellStatus === "for_resale") && (
                      <div className="text-center mt-2">
                        {ticket.isValidated && (
                          <span className="badge bg-success me-2">Validated</span>
                        )}
                        {(ticket as any).resellStatus === "for_resale" && (
                          <span className="badge bg-warning text-dark">Returned</span>
                        )}
                      </div>
                    )}
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
                {registryRecords.map((record) => (
                  <div key={record.id} className="col-md-6">
                    <div className="card">
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
                ))}
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