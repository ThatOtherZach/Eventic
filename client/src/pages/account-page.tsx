import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Calendar, Ticket, User, LogOut, Eye, Sparkles, Edit, Save, X } from "lucide-react";
import { Link, useLocation } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useNotifications } from "@/hooks/use-notifications";
import { TicketCard } from "@/components/tickets/ticket-card";
import { PastEvents } from "@/components/archive/past-events";
import type { Ticket as TicketType, Event, RegistryRecord } from "@shared/schema";

export default function AccountPage() {
  const { user, signOut } = useAuth();
  const [, setLocation] = useLocation();
  const [ticketsDisplayed, setTicketsDisplayed] = useState(10);
  const [isEditingCity, setIsEditingCity] = useState(false);
  const [locationsValue, setLocationsValue] = useState((user as any)?.locations || "");
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

  const updateLocationsMutation = useMutation({
    mutationFn: async (locations: string) => {
      const response = await apiRequest("PATCH", "/api/user/profile", {
        body: JSON.stringify({ locations }),
        headers: { "Content-Type": "application/json" },
      });
      return response.json();
    },
    onSuccess: (updatedUser) => {
      toast({
        title: "Success",
        description: "Locations updated successfully",
        variant: "default",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      setIsEditingCity(false);
    },
    onError: (error) => {
      addNotification({
        type: "error",
        title: "Error",
        description: "Failed to update locations",
      });
    },
  });

  const handleSaveLocations = () => {
    updateLocationsMutation.mutate(locationsValue);
  };

  const handleCancelEdit = () => {
    setLocationsValue((user as any)?.locations || "");
    setIsEditingCity(false);
  };

  const handleSignOut = async () => {
    await signOut();
  };

  if (!user) {
    return null;
  }

  return (
    <div className="container py-5">
      <div className="row mb-4">
        <div className="col">
          <div className="d-flex justify-content-between align-items-center">
            <h1 className="h3 fw-bold mb-0">My Account</h1>
            <div className="d-flex gap-2">
              <PastEvents />
              <button 
                className="btn btn-outline-secondary"
                onClick={handleSignOut}
                data-testid="button-sign-out"
              >
                <LogOut size={18} className="me-2" />
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* User Info Card */}
      <div className="row mb-4">
        <div className="col-12">
          <div className="card">
            <div className="card-body">
              <div className="d-flex align-items-center justify-content-between">
                <div className="d-flex align-items-center">
                  <div className="bg-primary bg-opacity-10 rounded-circle p-3 me-3">
                    <User className="text-primary" size={24} />
                  </div>
                  <div>
                    <h5 className="card-title mb-1">Account Details</h5>
                    <p className="text-muted mb-0">{user.email}</p>
                    <div className="d-flex align-items-center mt-2">
                      {isEditingCity ? (
                        <div className="d-flex align-items-center gap-2">
                          <input
                            type="text"
                            value={locationsValue}
                            onChange={(e) => setLocationsValue(e.target.value)}
                            placeholder="Enter your preferred locations or search terms"
                            className="form-control form-control-sm"
                            style={{ width: "300px" }}
                            data-testid="input-locations"
                          />
                          <button
                            onClick={handleSaveLocations}
                            disabled={updateLocationsMutation.isPending}
                            className="btn btn-sm btn-primary"
                            data-testid="button-save-locations"
                          >
                            {updateLocationsMutation.isPending ? (
                              <span className="spinner-border spinner-border-sm" />
                            ) : (
                              <Save size={14} />
                            )}
                          </button>
                          <button
                            onClick={handleCancelEdit}
                            className="btn btn-sm btn-outline-secondary"
                            data-testid="button-cancel-locations"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ) : (
                        <div className="d-flex align-items-center">
                          <span className="text-muted small me-2">
                            Locations: {(user as any).locations || "Auto-detected from your events"}
                          </span>
                          <button
                            onClick={() => setIsEditingCity(true)}
                            className="btn btn-sm btn-outline-primary"
                            data-testid="button-edit-locations"
                          >
                            <Edit size={14} />
                          </button>
                        </div>
                      )}
                    </div>
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
            <Ticket className="me-2" size={20} />
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
                    {ticket.isValidated && (
                      <div className="text-center mt-2">
                        <span className="badge bg-success">Used</span>
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
            <Calendar className="me-2" size={20} />
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
                        <h6 className="mb-1">{event.name}</h6>
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