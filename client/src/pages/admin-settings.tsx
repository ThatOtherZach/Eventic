import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";

// Windows 98 styled admin panel
export default function AdminSettings() {
  const { user, isAdmin } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("effects");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedEffect, setSelectedEffect] = useState<string | null>(null);
  const [effectOdds, setEffectOdds] = useState({
    valentines: 14,
    halloween: 88,
    christmas: 25,
    nice: 69
  });
  const [editingHeader, setEditingHeader] = useState<any>(null);
  const [newHeaderTitle, setNewHeaderTitle] = useState("");
  const [newHeaderSubtitle, setNewHeaderSubtitle] = useState("");
  const [bannedWords, setBannedWords] = useState<string>("");

  // Special effects configuration
  const SPECIAL_EFFECTS = [
    { name: "Valentine's Day", key: "valentines", defaultOdds: 14, icon: "❤️" },
    { name: "Halloween", key: "halloween", defaultOdds: 88, icon: "🎃" },
    { name: "Christmas", key: "christmas", defaultOdds: 25, icon: "🎄" },
    { name: "Nice", key: "nice", defaultOdds: 69, icon: "✨" }
  ];

  // Check if user has admin access
  if (!isAdmin()) {
    navigate("/");
    return null;
  }

  // Get all events for management
  const { data: events = [], isLoading: eventsLoading } = useQuery({
    queryKey: ["/api/admin/events"],
    enabled: isAdmin()
  });

  // Get platform headers for content management
  const { data: platformHeaders = [], isLoading: headersLoading } = useQuery({
    queryKey: ["/api/admin/platform-headers"],
    enabled: isAdmin()
  });

  // Get banned words for content moderation
  const { data: bannedWordsData } = useQuery({
    queryKey: ["/api/admin/banned-words"],
    enabled: isAdmin()
  });

  // Set banned words when data loads
  useEffect(() => {
    if (bannedWordsData) {
      setBannedWords((bannedWordsData as any).words || "");
    }
  }, [bannedWordsData]);

  // Update special effects odds
  const updateOddsMutation = useMutation({
    mutationFn: async (odds: typeof effectOdds) => {
      return apiRequest("PUT", "/api/admin/special-effects-odds", odds);
    },
    onSuccess: () => {
      toast({
        title: "Settings Updated",
        description: "Special effects odds have been updated successfully."
      });
    }
  });

  // Toggle event enabled status
  const toggleEventMutation = useMutation({
    mutationFn: async ({ eventId, field, value }: { eventId: string; field: "isEnabled" | "ticketPurchasesEnabled"; value: boolean }) => {
      return apiRequest("PUT", `/api/admin/events/${eventId}/toggle`, { field, value });
    },
    onSuccess: () => {
      toast({
        title: "Event Updated",
        description: "Event settings have been updated successfully."
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/events"] });
    }
  });

  // Platform Headers Mutations
  const createHeaderMutation = useMutation({
    mutationFn: async (data: { title: string; subtitle: string }) => {
      return apiRequest("POST", "/api/admin/platform-headers", { ...data, active: true });
    },
    onSuccess: () => {
      toast({
        title: "Header Created",
        description: "Platform header has been created successfully."
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/platform-headers"] });
      setNewHeaderTitle("");
      setNewHeaderSubtitle("");
    }
  });

  const updateHeaderMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: string; title: string; subtitle: string }) => {
      return apiRequest("PUT", `/api/admin/platform-headers/${id}`, data);
    },
    onSuccess: () => {
      toast({
        title: "Header Updated",
        description: "Platform header has been updated successfully."
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/platform-headers"] });
      setEditingHeader(null);
    }
  });

  const deleteHeaderMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/admin/platform-headers/${id}`);
    },
    onSuccess: () => {
      toast({
        title: "Header Deleted",
        description: "Platform header has been deleted successfully."
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/platform-headers"] });
    }
  });

  const toggleHeaderMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("PATCH", `/api/admin/platform-headers/${id}/toggle`);
    },
    onSuccess: () => {
      toast({
        title: "Status Updated",
        description: "Platform header status has been updated."
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/platform-headers"] });
    }
  });

  // Update banned words mutation
  const updateBannedWordsMutation = useMutation({
    mutationFn: async (words: string) => {
      return apiRequest("PUT", "/api/admin/banned-words", { words });
    },
    onSuccess: () => {
      toast({
        title: "Banned Words Updated",
        description: "The list of banned words has been updated successfully."
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/banned-words"] });
    }
  });

  const filteredEvents = (events as any[]).filter((event: any) =>
    event?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    event?.venue?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="window" style={{ width: "95%", margin: "20px auto", maxWidth: "1200px" }}>
      <div className="title-bar">
        <div className="title-bar-text">Admin Control Panel - Windows 98 Edition</div>
        <div className="title-bar-controls">
          <button aria-label="Minimize"></button>
          <button aria-label="Maximize"></button>
          <button aria-label="Close"></button>
        </div>
      </div>
      <div className="window-body">
        {/* Tab navigation */}
        <menu role="tablist" style={{ marginBottom: "10px" }}>
          <li role="tab" aria-selected={activeTab === "effects"}>
            <button onClick={() => setActiveTab("effects")}>🎆 Special Effects</button>
          </li>
          <li role="tab" aria-selected={activeTab === "events"}>
            <button onClick={() => setActiveTab("events")}>⚙️ Event Management</button>
          </li>
          <li role="tab" aria-selected={activeTab === "payments"}>
            <button onClick={() => setActiveTab("payments")}>💳 Payment Settings</button>
          </li>
          <li role="tab" aria-selected={activeTab === "content"}>
            <button onClick={() => setActiveTab("content")}>📄 Content</button>
          </li>
        </menu>

        {/* Tab panels */}
        <div className="sunken-panel" style={{ padding: "15px", minHeight: "500px" }}>
          {/* Special Effects Tab */}
          {activeTab === "effects" && (
            <div role="tabpanel">
              <fieldset style={{ marginBottom: "20px" }}>
                <legend>Special Effects Odds Configuration</legend>
                <p style={{ marginBottom: "15px" }}>
                  Adjust the odds for special ticket effects. Lower numbers mean more frequent effects.
                </p>
                
                {/* Ticket Type Preview Selector */}
                <div style={{ marginBottom: "20px" }}>
                  <label htmlFor="effect-preview">Preview Ticket Type:</label>
                  <select 
                    id="effect-preview"
                    value={selectedEffect || ""}
                    onChange={(e) => setSelectedEffect(e.target.value)}
                    style={{ marginLeft: "10px", width: "200px" }}
                  >
                    <option value="">Select a ticket type...</option>
                    {SPECIAL_EFFECTS.map((effect) => (
                      <option key={effect.key} value={effect.key}>
                        {effect.icon} {effect.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Preview Display */}
                {selectedEffect && (
                  <div className="field-row-stacked" style={{ background: "#ffffc0", padding: "10px", marginBottom: "20px" }}>
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontSize: "48px" }}>
                        {SPECIAL_EFFECTS.find(e => e.key === selectedEffect)?.icon}
                      </div>
                      <p>This special effect appears on validated tickets</p>
                    </div>
                  </div>
                )}

                {/* Odds Configuration */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px", marginBottom: "20px" }}>
                  {SPECIAL_EFFECTS.map((effect) => (
                    <div key={effect.key} className="field-row">
                      <label htmlFor={`odds-${effect.key}`} style={{ minWidth: "150px" }}>
                        {effect.icon} {effect.name} (1 in X):
                      </label>
                      <input
                        id={`odds-${effect.key}`}
                        type="number"
                        min="1"
                        max="1000"
                        value={effectOdds[effect.key as keyof typeof effectOdds]}
                        onChange={(e) => setEffectOdds({
                          ...effectOdds,
                          [effect.key]: parseInt(e.target.value) || effect.defaultOdds
                        })}
                        style={{ width: "100px" }}
                      />
                    </div>
                  ))}
                </div>

                <button 
                  onClick={() => updateOddsMutation.mutate(effectOdds)}
                  disabled={updateOddsMutation.isPending}
                  style={{ width: "150px" }}
                >
                  {updateOddsMutation.isPending ? "Saving..." : "Save Configuration"}
                </button>
              </fieldset>
            </div>
          )}

          {/* Event Management Tab */}
          {activeTab === "events" && (
            <div role="tabpanel">
              <fieldset>
                <legend>Event Management</legend>
                <p style={{ marginBottom: "15px" }}>
                  Find and manage all events in the system. Control visibility and ticket sales.
                </p>

                {/* Search Bar */}
                <div className="field-row" style={{ marginBottom: "20px" }}>
                  <label htmlFor="event-search">Search:</label>
                  <input
                    id="event-search"
                    type="text"
                    placeholder="Search events by name or venue..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{ flex: 1 }}
                  />
                </div>

                {/* Events List */}
                <div style={{ border: "2px inset", padding: "10px", height: "400px", overflowY: "auto", background: "white" }}>
                  {eventsLoading ? (
                    <p>Loading events...</p>
                  ) : filteredEvents.length === 0 ? (
                    <p>No events found</p>
                  ) : (
                    <ul style={{ listStyle: "none", padding: 0 }}>
                      {filteredEvents.map((event: any) => (
                        <li key={event.id} style={{ padding: "10px", borderBottom: "1px solid #c0c0c0" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <div>
                              <strong>{event.name}</strong>
                              <br />
                              <span style={{ fontSize: "11px" }}>📍 {event.venue}</span>
                              <br />
                              <span style={{ fontSize: "11px" }}>📅 {new Date(event.date).toLocaleDateString()}</span>
                            </div>
                            <div style={{ display: "flex", gap: "5px" }}>
                              <label>
                                <input
                                  type="checkbox"
                                  checked={event.isEnabled}
                                  onChange={(e) => toggleEventMutation.mutate({
                                    eventId: event.id,
                                    field: "isEnabled",
                                    value: e.target.checked
                                  })}
                                />
                                Visible
                              </label>
                              <label>
                                <input
                                  type="checkbox"
                                  checked={event.ticketPurchasesEnabled}
                                  onChange={(e) => toggleEventMutation.mutate({
                                    eventId: event.id,
                                    field: "ticketPurchasesEnabled",
                                    value: e.target.checked
                                  })}
                                />
                                Sales
                              </label>
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </fieldset>
            </div>
          )}

          {/* Payment Settings Tab */}
          {activeTab === "payments" && (
            <div role="tabpanel">
              <fieldset style={{ marginBottom: "20px" }}>
                <legend>Stripe Configuration</legend>
                <div className="status-bar" style={{ marginBottom: "15px" }}>
                  <p className="status-bar-field">Status: ✅ Configured</p>
                  <p className="status-bar-field">Webhook: ✅ Active</p>
                </div>
                <p style={{ fontSize: "11px", marginBottom: "10px" }}>
                  Stripe is configured via environment variables. Contact system administrator to update keys.
                </p>
                <ul style={{ fontSize: "11px", marginLeft: "20px" }}>
                  <li>STRIPE_PUBLISHABLE_KEY</li>
                  <li>STRIPE_SECRET_KEY</li>
                  <li>STRIPE_WEBHOOK_SECRET</li>
                </ul>
              </fieldset>

              <fieldset>
                <legend>Coinbase Commerce</legend>
                <div className="status-bar" style={{ marginBottom: "15px" }}>
                  <p className="status-bar-field">Status: ✅ Active</p>
                </div>
                <p style={{ fontSize: "11px", marginBottom: "10px" }}>
                  Customers receive 10 bonus tickets when paying with cryptocurrency.
                </p>
                <p style={{ fontSize: "11px", marginBottom: "10px" }}>
                  <strong>Accepted Currencies:</strong> Bitcoin (BTC), Ethereum (ETH), USDC, Litecoin (LTC), Dogecoin (DOGE)
                </p>
              </fieldset>
            </div>
          )}

          {/* Content Tab */}
          {activeTab === "content" && (
            <div role="tabpanel">
              {/* Platform Headers Management */}
              <fieldset style={{ marginBottom: "20px" }}>
                <legend>Platform Headers Management</legend>
                <p style={{ marginBottom: "15px" }}>
                  Manage dynamic titles and subtitles that appear on the home page.
                </p>

                {/* Add New Header Form */}
                <div className="window" style={{ marginBottom: "20px" }}>
                  <div className="title-bar">
                    <div className="title-bar-text">Add New Header</div>
                  </div>
                  <div className="window-body">
                    <div className="field-row">
                      <label htmlFor="new-title">Title:</label>
                      <input
                        id="new-title"
                        type="text"
                        value={newHeaderTitle}
                        onChange={(e) => setNewHeaderTitle(e.target.value)}
                        style={{ flex: 1 }}
                      />
                    </div>
                    <div className="field-row">
                      <label htmlFor="new-subtitle">Subtitle:</label>
                      <input
                        id="new-subtitle"
                        type="text"
                        value={newHeaderSubtitle}
                        onChange={(e) => setNewHeaderSubtitle(e.target.value)}
                        style={{ flex: 1 }}
                      />
                    </div>
                    <button
                      onClick={() => {
                        if (newHeaderTitle && newHeaderSubtitle) {
                          createHeaderMutation.mutate({ title: newHeaderTitle, subtitle: newHeaderSubtitle });
                        }
                      }}
                      disabled={createHeaderMutation.isPending}
                    >
                      ➕ Add Header
                    </button>
                  </div>
                </div>

                {/* Headers List */}
                <div style={{ border: "2px inset", padding: "10px", height: "300px", overflowY: "auto", background: "white" }}>
                  {headersLoading ? (
                    <p>Loading headers...</p>
                  ) : platformHeaders.length === 0 ? (
                    <p>No headers found</p>
                  ) : (
                    <ul style={{ listStyle: "none", padding: 0 }}>
                      {(platformHeaders as any[]).map((header: any) => (
                        <li key={header.id} style={{ padding: "10px", borderBottom: "1px solid #c0c0c0" }}>
                          {editingHeader?.id === header.id ? (
                            <div>
                              <input
                                type="text"
                                value={editingHeader.title}
                                onChange={(e) => setEditingHeader({ ...editingHeader, title: e.target.value })}
                                style={{ width: "100%", marginBottom: "5px" }}
                              />
                              <input
                                type="text"
                                value={editingHeader.subtitle}
                                onChange={(e) => setEditingHeader({ ...editingHeader, subtitle: e.target.value })}
                                style={{ width: "100%", marginBottom: "5px" }}
                              />
                              <button
                                onClick={() => updateHeaderMutation.mutate({
                                  id: header.id,
                                  title: editingHeader.title,
                                  subtitle: editingHeader.subtitle
                                })}
                              >
                                Save
                              </button>
                              <button onClick={() => setEditingHeader(null)}>Cancel</button>
                            </div>
                          ) : (
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                              <div style={{ flex: 1 }}>
                                <strong>{header.title}</strong>
                                <br />
                                <span style={{ fontSize: "11px" }}>{header.subtitle}</span>
                                <br />
                                <span className={header.active ? "status-bar" : ""} style={{ fontSize: "10px" }}>
                                  {header.active ? "✅ Active" : "❌ Inactive"}
                                </span>
                              </div>
                              <div style={{ display: "flex", gap: "5px" }}>
                                <button onClick={() => toggleHeaderMutation.mutate(header.id)} style={{ padding: "2px 5px" }}>
                                  {header.active ? "🔴" : "🟢"}
                                </button>
                                <button onClick={() => setEditingHeader(header)} style={{ padding: "2px 5px" }}>
                                  ✏️
                                </button>
                                <button 
                                  onClick={() => {
                                    if (confirm("Delete this header?")) {
                                      deleteHeaderMutation.mutate(header.id);
                                    }
                                  }}
                                  style={{ padding: "2px 5px" }}
                                >
                                  🗑️
                                </button>
                              </div>
                            </div>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="status-bar" style={{ marginTop: "10px" }}>
                  <p className="status-bar-field">Total: {platformHeaders.length}</p>
                  <p className="status-bar-field">Active: {(platformHeaders as any[]).filter((h: any) => h.active).length}</p>
                </div>
              </fieldset>

              {/* Content Moderation */}
              <fieldset>
                <legend>Content Moderation</legend>
                <p style={{ marginBottom: "15px" }}>
                  Manage banned words that automatically set events to private when detected.
                </p>
                <div className="field-row-stacked">
                  <label htmlFor="banned-words">Banned Words (comma-separated):</label>
                  <textarea
                    id="banned-words"
                    value={bannedWords}
                    onChange={(e) => setBannedWords(e.target.value)}
                    style={{ width: "100%", minHeight: "100px", resize: "vertical" }}
                  />
                </div>
                <div style={{ display: "flex", gap: "10px", marginTop: "10px" }}>
                  <button
                    onClick={() => updateBannedWordsMutation.mutate(bannedWords)}
                    disabled={updateBannedWordsMutation.isPending}
                  >
                    {updateBannedWordsMutation.isPending ? "Saving..." : "💾 Save"}
                  </button>
                  <button
                    onClick={() => setBannedWords(bannedWordsData?.words || "")}
                    disabled={updateBannedWordsMutation.isPending}
                  >
                    ↩️ Reset
                  </button>
                </div>
                <details style={{ marginTop: "15px" }}>
                  <summary style={{ cursor: "pointer" }}>ℹ️ How it works</summary>
                  <ul style={{ fontSize: "11px", marginTop: "10px" }}>
                    <li>Words are checked against event titles and venue information</li>
                    <li>Matching is case-insensitive</li>
                    <li>Events with banned words are set to private automatically</li>
                    <li>Changes apply to new events only</li>
                  </ul>
                </details>
              </fieldset>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}