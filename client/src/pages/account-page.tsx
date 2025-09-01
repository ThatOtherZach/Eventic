import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Calendar, MapPin, Ticket, Plus, Sparkles, Trophy, Clock, X, Edit2, Eye, EyeOff, AlertCircle, DollarSign, TrendingUp, Coins, Gift, CalendarCheck, Package, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { EventCard } from "@/components/EventCard";
import { TicketCard } from "@/components/tickets/ticket-card";
import { useToast } from "@/hooks/use-toast";
import type { SelectEvent, SelectTicket, SelectRegistryRecord } from "@shared/schema";
import { CountdownTimer } from "@/components/CountdownTimer";

export function AccountPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<"all" | "validated" | "golden">("all");

  const { data: events, isLoading: eventsLoading } = useQuery<SelectEvent[]>({
    queryKey: ["/api/events"],
  });

  const { data: userEvents, isLoading: userEventsLoading } = useQuery<SelectEvent[]>({
    queryKey: ["/api/user/events"],
    enabled: !!user,
  });

  const { data: tickets, isLoading: ticketsLoading, refetch: refetchTickets } = useQuery<SelectTicket[]>({
    queryKey: ["/api/user/tickets"],
    enabled: !!user,
  });

  const { data: balance, isLoading: balanceLoading } = useQuery<{ id: string; userId: string; balance: number; lastDailyClaimAt: string | null }>({
    queryKey: ["/api/currency/balance"],
    enabled: !!user,
  });

  const { data: claimStatus, refetch: refetchClaimStatus } = useQuery<{ canClaim: boolean; nextClaimTime: string | null; hoursUntilClaim: number }>({
    queryKey: ["/api/currency/daily-claim-status"],
    enabled: !!user,
  });

  const { data: registryRecords, isLoading: registryLoading } = useQuery<SelectRegistryRecord[]>({
    queryKey: ["/api/user/registry"],
    enabled: !!user,
  });

  const claimDailyMutation = useMutation({
    mutationFn: () => apiRequest("/api/currency/claim-daily", { method: "POST" }),
    onSuccess: () => {
      toast({
        title: "Daily Tickets Claimed!",
        description: "You've received 5 Tickets",
        variant: "success",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/currency/balance"] });
      queryClient.invalidateQueries({ queryKey: ["/api/currency/daily-claim-status"] });
      refetchClaimStatus();
    },
    onError: (error) => {
      toast({
        title: "Claim Failed",
        description: error.message || "Unable to claim daily tickets",
        variant: "destructive",
      });
    },
  });

  const handleDailyClaim = () => {
    if (claimStatus?.canClaim) {
      claimDailyMutation.mutate();
    }
  };

  const [eventSearchTerm, setEventSearchTerm] = useState("");
  const [eventFilterType, setEventFilterType] = useState<"all" | "future" | "past" | "active">("all");

  const filteredEvents = userEvents?.filter(event => {
    const matchesSearch = event.name.toLowerCase().includes(eventSearchTerm.toLowerCase()) ||
                          event.venue?.toLowerCase().includes(eventSearchTerm.toLowerCase());
    
    const now = new Date();
    const eventStart = new Date(event.date);
    const eventEnd = event.endDate ? new Date(event.endDate) : eventStart;
    
    const matchesFilter = eventFilterType === "all" ? true :
                         eventFilterType === "future" ? eventStart > now :
                         eventFilterType === "past" ? eventEnd < now :
                         eventFilterType === "active" ? eventStart <= now && eventEnd >= now : true;
    
    return matchesSearch && matchesFilter;
  });

  const filteredTickets = tickets?.filter(ticket => {
    const event = events?.find(e => e.id === ticket.eventId);
    const matchesSearch = 
      ticket.ticketNumber?.toString().includes(searchTerm) ||
      event?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      event?.venue?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesFilter = 
      filterType === "all" ? true :
      filterType === "validated" ? ticket.validated :
      filterType === "golden" ? ticket.isGoldenTicket : true;
    
    return matchesSearch && matchesFilter;
  });

  const stats = {
    totalEvents: userEvents?.length || 0,
    futureEvents: userEvents?.filter(e => new Date(e.date) > new Date()).length || 0,
    activeEvents: userEvents?.filter(e => {
      const now = new Date();
      const start = new Date(e.date);
      const end = e.endDate ? new Date(e.endDate) : start;
      return start <= now && end >= now;
    }).length || 0,
    totalTickets: tickets?.length || 0,
    validatedTickets: tickets?.filter(t => t.validated).length || 0,
    goldenTickets: tickets?.filter(t => t.isGoldenTicket).length || 0,
  };

  if (!user) {
    return (
      <div className="container mt-5 text-center">
        <h1 className="h3">Please log in to view your account</h1>
        <p className="text-muted">You need to be logged in to access this page.</p>
      </div>
    );
  }

  return (
    <div className="container py-4">
      <div className="row mb-4">
        <div className="col">
          <div className="d-flex justify-content-between align-items-center mb-4">
            <div>
              <h1 className="h3 fw-bold mb-2">My Account</h1>
              <p className="text-muted mb-0">Manage your events and tickets</p>
            </div>
            <Link href="/events/new">
              <Button className="d-flex align-items-center gap-2">
                <Plus size={20} />
                <span className="d-none d-sm-inline">Create Event</span>
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Currency Section */}
      <div className="row mb-4">
        <div className="col-12">
          <div className="card border-0 shadow-sm bg-gradient" style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
            <div className="card-body p-4">
              <div className="row align-items-center">
                <div className="col-md-6 text-white">
                  <div className="d-flex align-items-center mb-3">
                    <Coins className="me-2" size={24} />
                    <h5 className="mb-0 fw-bold">My Tickets Balance</h5>
                  </div>
                  <div className="d-flex align-items-baseline">
                    <span className="display-4 fw-bold">{balance?.balance || 0}</span>
                    <span className="ms-2 fs-4 opacity-75">Tickets</span>
                  </div>
                  <p className="mt-2 mb-0 opacity-90">
                    Use Tickets to boost events and unlock premium features
                  </p>
                </div>
                <div className="col-md-6 text-white text-md-end mt-3 mt-md-0">
                  {claimStatus?.canClaim ? (
                    <div>
                      <p className="mb-2 opacity-90">Daily bonus available!</p>
                      <Button 
                        onClick={handleDailyClaim}
                        disabled={claimDailyMutation.isPending}
                        className="btn-light px-4"
                        variant="secondary"
                      >
                        <Gift className="me-2" size={18} />
                        {claimDailyMutation.isPending ? "Claiming..." : "Claim 5 Tickets"}
                      </Button>
                    </div>
                  ) : (
                    <div>
                      <p className="mb-2 opacity-90">Next claim available in:</p>
                      <div className="d-flex align-items-center justify-content-end">
                        <CalendarCheck className="me-2" size={20} />
                        <span className="fs-5">
                          {claimStatus?.hoursUntilClaim ? 
                            `${Math.floor(claimStatus.hoursUntilClaim)} hours` : 
                            'Tomorrow'}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="row mb-4 g-3">
        <div className="col-md-4">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-body">
              <div className="d-flex justify-content-between align-items-center mb-2">
                <span className="text-muted">Total Events</span>
                <Calendar size={20} className="text-primary" />
              </div>
              <h3 className="h4 fw-bold mb-0">{stats.totalEvents}</h3>
              <small className="text-muted">
                {stats.futureEvents} upcoming, {stats.activeEvents} active
              </small>
            </div>
          </div>
        </div>
        <div className="col-md-4">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-body">
              <div className="d-flex justify-content-between align-items-center mb-2">
                <span className="text-muted">Total Tickets</span>
                <Ticket size={20} className="text-success" />
              </div>
              <h3 className="h4 fw-bold mb-0">{stats.totalTickets}</h3>
              <small className="text-muted">
                {stats.validatedTickets} validated
              </small>
            </div>
          </div>
        </div>
        <div className="col-md-4">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-body">
              <div className="d-flex justify-content-between align-items-center mb-2">
                <span className="text-muted">Golden Tickets</span>
                <Trophy size={20} className="text-warning" />
              </div>
              <h3 className="h4 fw-bold mb-0">{stats.goldenTickets}</h3>
              <small className="text-muted">
                Special edition tickets
              </small>
            </div>
          </div>
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
                  // Get the actual ticket and event from our existing data
                  const ticket = tickets?.find(t => t.id === record.ticketId);
                  const event = events?.find(e => e.id === record.eventId) || 
                                userEvents?.find(e => e.id === record.eventId);
                  
                  // Parse metadata just for the GIF if we have one
                  const metadata = typeof record.metadata === 'string' ? JSON.parse(record.metadata) : record.metadata || {};
                  const ticketGifUrl = metadata.ticketGifUrl || null;
                  
                  // If we have a GIF already captured, show that
                  if (ticketGifUrl) {
                    return (
                      <div key={record.id} className="col-md-4">
                        <div className="mb-2">
                          <div className="card" style={{ overflow: 'hidden' }}>
                            <img 
                              src={ticketGifUrl} 
                              alt={`${record.eventName} - Ticket #${record.ticketNumber}`}
                              className="w-100" 
                              style={{ display: 'block', borderRadius: '8px' }}
                            />
                          </div>
                        </div>
                        <div className="card">
                          <div className="card-body p-2">
                            <div className="d-flex justify-content-between align-items-center">
                              <div className="small">
                                <span className="badge bg-info me-2">NFT</span>
                                <span className="text-muted">Minted {record.mintedAt ? new Date(record.mintedAt).toLocaleDateString() : 'Unknown'}</span>
                              </div>
                              {record.transferCount && record.transferCount > 0 && (
                                <span className="badge bg-secondary small">
                                  {record.transferCount} Transfer{record.transferCount !== 1 ? 's' : ''}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  }
                  
                  // If we don't have ticket or event data, skip
                  if (!ticket || !event) {
                    return null;
                  }
                  
                  // Show the actual ticket using TicketCard component
                  return (
                    <div key={record.id} className="col-md-4">
                      <div className="mb-2">
                        <TicketCard 
                          ticket={ticket}
                          event={event}
                          showQR={false}
                          showBadges={false}
                        />
                      </div>
                      <div className="card">
                        <div className="card-body p-2">
                          <div className="d-flex justify-content-between align-items-center">
                            <div className="small">
                              <span className="badge bg-info me-2">NFT</span>
                              <span className="text-muted">
                                Minted {record.mintedAt ? new Date(record.mintedAt).toLocaleDateString() : 'Unknown'}
                              </span>
                            </div>
                            {record.transferCount && record.transferCount > 0 && (
                              <span className="badge bg-secondary small">
                                {record.transferCount} Transfer{record.transferCount !== 1 ? 's' : ''}
                              </span>
                            )}
                          </div>
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
      <div className="row mb-4">
        <div className="col-12">
          <div className="d-flex justify-content-between align-items-center mb-3">
            <h4 className="h5 fw-semibold mb-0">My Events</h4>
            <div className="d-flex gap-2">
              <div className="input-group" style={{ width: '250px' }}>
                <span className="input-group-text bg-white">
                  <Search size={16} />
                </span>
                <input
                  type="text"
                  className="form-control border-start-0"
                  placeholder="Search events..."
                  value={eventSearchTerm}
                  onChange={(e) => setEventSearchTerm(e.target.value)}
                />
              </div>
              <select 
                className="form-select" 
                style={{ width: 'auto' }}
                value={eventFilterType}
                onChange={(e) => setEventFilterType(e.target.value as any)}
              >
                <option value="all">All Events</option>
                <option value="future">Upcoming</option>
                <option value="active">Active Now</option>
                <option value="past">Past</option>
              </select>
            </div>
          </div>
          
          {userEventsLoading ? (
            <div className="card">
              <div className="card-body">
                <div className="placeholder-glow">
                  <div className="placeholder col-12 mb-2"></div>
                  <div className="placeholder col-8"></div>
                </div>
              </div>
            </div>
          ) : filteredEvents && filteredEvents.length > 0 ? (
            <div className="row g-3">
              {filteredEvents.map(event => {
                const eventEnd = event.endDate ? new Date(event.endDate) : new Date(event.date);
                const daysSinceEnd = Math.floor((Date.now() - eventEnd.getTime()) / (1000 * 60 * 60 * 24));
                const daysUntilDeletion = 69 - daysSinceEnd;
                const showDeletionWarning = eventEnd < new Date() && daysUntilDeletion > 0;

                return (
                  <div key={event.id} className="col-md-6 col-lg-4">
                    <div className="card h-100 border-0 shadow-sm position-relative">
                      <EventCard event={event} />
                      {showDeletionWarning && (
                        <div className="position-absolute top-0 end-0 m-2">
                          <span className="badge bg-warning text-dark" title={`This event will be deleted in ${daysUntilDeletion} days`}>
                            <Clock size={12} className="me-1" />
                            {daysUntilDeletion}d
                          </span>
                        </div>
                      )}
                      <div className="card-footer bg-white border-top">
                        <div className="d-flex gap-2">
                          <Link href={`/events/${event.id}`} className="text-decoration-none">
                            <Button variant="outline" size="sm" className="btn-sm">
                              <Eye size={16} className="me-1" />
                              View
                            </Button>
                          </Link>
                          <Link href={`/events/${event.id}/edit`} className="text-decoration-none">
                            <Button variant="outline" size="sm" className="btn-sm">
                              <Edit2 size={16} className="me-1" />
                              Edit
                            </Button>
                          </Link>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="card">
              <div className="card-body text-center py-5">
                <Calendar size={48} className="text-muted mb-3" />
                <h5>No events found</h5>
                <p className="text-muted mb-3">
                  {eventSearchTerm ? "Try adjusting your search" : "You haven't created any events yet"}
                </p>
                {!eventSearchTerm && (
                  <Link href="/events/new">
                    <Button>Create Your First Event</Button>
                  </Link>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* My Tickets Section */}
      <div className="row">
        <div className="col-12">
          <div className="d-flex justify-content-between align-items-center mb-3">
            <h4 className="h5 fw-semibold mb-0">My Tickets</h4>
            <div className="d-flex gap-2">
              <div className="input-group" style={{ width: '250px' }}>
                <span className="input-group-text bg-white">
                  <Search size={16} />
                </span>
                <input
                  type="text"
                  className="form-control border-start-0"
                  placeholder="Search tickets..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <select 
                className="form-select" 
                style={{ width: 'auto' }}
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as any)}
              >
                <option value="all">All Tickets</option>
                <option value="validated">Validated</option>
                <option value="golden">Golden</option>
              </select>
            </div>
          </div>
          
          {ticketsLoading ? (
            <div className="card">
              <div className="card-body">
                <div className="placeholder-glow">
                  <div className="placeholder col-12 mb-2"></div>
                  <div className="placeholder col-8"></div>
                </div>
              </div>
            </div>
          ) : filteredTickets && filteredTickets.length > 0 ? (
            <div className="row g-3">
              {filteredTickets.map(ticket => {
                const event = events?.find(e => e.id === ticket.eventId);
                if (!event) return null;

                const eventEnd = event.endDate ? new Date(event.endDate) : new Date(event.date);
                const daysSinceEnd = Math.floor((Date.now() - eventEnd.getTime()) / (1000 * 60 * 60 * 24));
                const daysUntilDeletion = 69 - daysSinceEnd;
                const showDeletionWarning = eventEnd < new Date() && daysUntilDeletion > 0;

                return (
                  <div key={ticket.id} className="col-md-6 col-lg-4">
                    <div className="position-relative">
                      {showDeletionWarning && (
                        <div className="position-absolute top-0 end-0 m-2" style={{ zIndex: 10 }}>
                          <span className="badge bg-warning text-dark" title={`This ticket will be deleted in ${daysUntilDeletion} days`}>
                            <Clock size={12} className="me-1" />
                            {daysUntilDeletion}d
                          </span>
                        </div>
                      )}
                      <TicketCard ticket={ticket} event={event} />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="card">
              <div className="card-body text-center py-5">
                <Ticket size={48} className="text-muted mb-3" />
                <h5>No tickets found</h5>
                <p className="text-muted">
                  {searchTerm ? "Try adjusting your search" : "You don't have any tickets yet"}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}