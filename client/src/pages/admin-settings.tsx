import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { useSEO, SEO_CONFIG } from "@/hooks/use-seo";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Search, Settings, Ticket, Sparkles, Calendar, Eye, EyeOff, ShoppingCart, Ban, CreditCard, CheckCircle, XCircle, FileText, Edit, Trash2, Plus, ToggleLeft, ToggleRight } from "lucide-react";

// Special effects configuration with ticket type previews
const SPECIAL_EFFECTS = [
  { name: "Valentine's Day", defaultOdds: 14, icon: "❤️", color: "text-pink-500" },
  { name: "Halloween", defaultOdds: 88, icon: "🎃", color: "text-orange-500" },
  { name: "Christmas", defaultOdds: 25, icon: "🎄", color: "text-green-500" },
  { name: "Nice", defaultOdds: 69, icon: "✨", color: "text-purple-500" }
];

export default function AdminSettings() {
  const { user, isAdmin } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  // Set page SEO
  useSEO(SEO_CONFIG.admin);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedEffect, setSelectedEffect] = useState<string | null>(null);
  const [effectOdds, setEffectOdds] = useState({
    valentines: 14,
    halloween: 88,
    christmas: 25,
    nice: 69
  });
  const [paymentStatus, setPaymentStatus] = useState<any>(null);
  const [editingHeader, setEditingHeader] = useState<any>(null);
  const [newHeaderTitle, setNewHeaderTitle] = useState("");
  const [newHeaderSubtitle, setNewHeaderSubtitle] = useState("");
  const [bannedWords, setBannedWords] = useState<string>("");
  const [bannedWordsLoading, setBannedWordsLoading] = useState(false);

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

  // Get current special effects odds
  const { data: currentOdds } = useQuery({
    queryKey: ["/api/admin/special-effects-odds"],
    enabled: isAdmin()
  });

  // Get payment configuration status
  const { data: paymentData } = useQuery({
    queryKey: ["/api/admin/payment-status"],
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

  // Get NFT settings
  const { data: nftSettings } = useQuery({
    queryKey: ["/api/admin/nft/settings"],
    enabled: isAdmin()
  });

  // Set banned words when data loads
  useEffect(() => {
    if (bannedWordsData) {
      setBannedWords(bannedWordsData.words || "");
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
      queryClient.invalidateQueries({ queryKey: ["/api/admin/special-effects-odds"] });
    },
    onError: () => {
      toast({
        title: "Update Failed",
        description: "Failed to update special effects odds.",
        variant: "destructive"
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
    },
    onError: () => {
      toast({
        title: "Update Failed",
        description: "Failed to update event settings.",
        variant: "destructive"
      });
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
    },
    onError: () => {
      toast({
        title: "Creation Failed",
        description: "Failed to create platform header.",
        variant: "destructive"
      });
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
    },
    onError: () => {
      toast({
        title: "Update Failed",
        description: "Failed to update platform header.",
        variant: "destructive"
      });
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
    },
    onError: () => {
      toast({
        title: "Deletion Failed",
        description: "Failed to delete platform header.",
        variant: "destructive"
      });
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
    },
    onError: () => {
      toast({
        title: "Update Failed",
        description: "Failed to toggle platform header status.",
        variant: "destructive"
      });
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
      setBannedWordsLoading(false);
    },
    onError: () => {
      toast({
        title: "Update Failed",
        description: "Failed to update banned words.",
        variant: "destructive"
      });
      setBannedWordsLoading(false);
    }
  });

  // Update NFT settings mutation
  const updateNftSettingsMutation = useMutation({
    mutationFn: async ({ enabled }: { enabled: boolean }) => {
      return apiRequest("POST", "/api/admin/nft/settings", { enabled });
    },
    onSuccess: (data) => {
      toast({
        title: "NFT Settings Updated",
        description: data.message || "NFT settings have been updated successfully."
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/nft/settings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/nft/enabled"] });
    },
    onError: () => {
      toast({
        title: "Update Failed",
        description: "Failed to update NFT settings.",
        variant: "destructive"
      });
    }
  });

  const filteredEvents = (events as any[]).filter((event: any) =>
    event?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    event?.venue?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="container mx-auto py-6 space-y-6" data-testid="admin-settings-page">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Admin Settings</h1>
        <Badge variant="secondary" className="text-sm">
          Admin Access
        </Badge>
      </div>

      <Tabs defaultValue="effects" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="effects" className="flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            Special Effects
          </TabsTrigger>
          <TabsTrigger value="events" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Event Management
          </TabsTrigger>
          <TabsTrigger value="payments" className="flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            Payment Settings
          </TabsTrigger>
          <TabsTrigger value="nft" className="flex items-center gap-2">
            <Ticket className="h-4 w-4" />
            NFT Settings
          </TabsTrigger>
          <TabsTrigger value="content" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Content
          </TabsTrigger>
        </TabsList>

        <TabsContent value="effects" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Special Effects Odds Configuration</CardTitle>
              <CardDescription>
                Adjust the odds for special ticket effects. Lower numbers mean more frequent effects.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Ticket Type Preview Selector */}
              <div className="space-y-3">
                <Label>Preview Ticket Type</Label>
                <Select value={selectedEffect || ""} onValueChange={setSelectedEffect}>
                  <SelectTrigger data-testid="select-effect-preview">
                    <SelectValue placeholder="Select a ticket type to preview" />
                  </SelectTrigger>
                  <SelectContent>
                    {SPECIAL_EFFECTS.map((effect) => (
                      <SelectItem key={effect.name} value={effect.name.toLowerCase().replace(/\s+/g, '')}>
                        <span className="flex items-center gap-2">
                          <span>{effect.icon}</span>
                          {effect.name}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Preview Display */}
              {selectedEffect && (
                <div className="p-4 border rounded-lg bg-gradient-to-r from-purple-50 to-pink-50">
                  <div className="text-center space-y-2">
                    <div className="text-4xl">
                      {SPECIAL_EFFECTS.find(e => e.name.toLowerCase().replace(/\s+/g, '') === selectedEffect)?.icon}
                    </div>
                    <p className="text-sm text-gray-600">
                      This special effect appears on validated tickets
                    </p>
                  </div>
                </div>
              )}

              {/* Odds Configuration */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {SPECIAL_EFFECTS.map((effect) => {
                  const key = effect.name.toLowerCase().replace(/\s+/g, '').replace('\'sday', 's');
                  return (
                    <div key={effect.name} className="space-y-2">
                      <Label className="flex items-center gap-2">
                        <span className={effect.color}>{effect.icon}</span>
                        {effect.name} (1 in X)
                      </Label>
                      <Input
                        type="number"
                        min="1"
                        max="1000"
                        value={effectOdds[key as keyof typeof effectOdds]}
                        onChange={(e) => setEffectOdds({
                          ...effectOdds,
                          [key]: parseInt(e.target.value) || effect.defaultOdds
                        })}
                        data-testid={`input-odds-${key}`}
                      />
                      <p className="text-xs text-gray-500">
                        Current: 1 in {effectOdds[key as keyof typeof effectOdds]} chance
                      </p>
                    </div>
                  );
                })}
              </div>

              <Button 
                onClick={() => updateOddsMutation.mutate(effectOdds)}
                disabled={updateOddsMutation.isPending}
                className="w-full"
                data-testid="button-save-odds"
              >
                {updateOddsMutation.isPending ? "Saving..." : "Save Odds Configuration"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="events" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Event Management</CardTitle>
              <CardDescription>
                Find and manage all events in the system. Control visibility and ticket sales.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Search Bar */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search events by name or venue..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                  data-testid="input-search-events"
                />
              </div>

              {/* Events List */}
              <ScrollArea className="h-[500px] pr-4">
                {eventsLoading ? (
                  <div className="text-center py-8 text-gray-500">Loading events...</div>
                ) : filteredEvents.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">No events found</div>
                ) : (
                  <div className="space-y-3">
                    {filteredEvents.map((event: any) => (
                      <Card key={event.id} className="p-4">
                        <div className="space-y-3">
                          <div className="flex items-start justify-between">
                            <div className="space-y-1">
                              <h3 className="font-semibold">{event.name}</h3>
                              <p className="text-sm text-gray-500">{event.venue}</p>
                              <div className="flex items-center gap-2 text-xs text-gray-500">
                                <Calendar className="h-3 w-3" />
                                {(() => {
                                  const [year, month, day] = event.date.split('-').map(Number);
                                  return new Date(year, month - 1, day).toLocaleDateString();
                                })()}
                                {event.endDate && ` - ${(() => {
                                  const [endYear, endMonth, endDay] = event.endDate.split('-').map(Number);
                                  return new Date(endYear, endMonth - 1, endDay).toLocaleDateString();
                                })()}`}
                              </div>
                            </div>
                            <div className="flex gap-2">
                              {!event.isEnabled && (
                                <Badge variant="secondary" className="text-xs">
                                  Hidden
                                </Badge>
                              )}
                              {!event.ticketPurchasesEnabled && (
                                <Badge variant="outline" className="text-xs">
                                  Sales Disabled
                                </Badge>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-4 pt-2 border-t">
                            <div className="flex items-center space-x-2">
                              <Switch
                                id={`visible-${event.id}`}
                                checked={event.isEnabled}
                                onCheckedChange={(checked) => 
                                  toggleEventMutation.mutate({ 
                                    eventId: event.id, 
                                    field: "isEnabled", 
                                    value: checked 
                                  })
                                }
                                data-testid={`switch-visibility-${event.id}`}
                              />
                              <Label htmlFor={`visible-${event.id}`} className="flex items-center gap-1 cursor-pointer">
                                {event.isEnabled ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                                Public Visibility
                              </Label>
                            </div>

                            <div className="flex items-center space-x-2">
                              <Switch
                                id={`purchases-${event.id}`}
                                checked={event.ticketPurchasesEnabled}
                                onCheckedChange={(checked) => 
                                  toggleEventMutation.mutate({ 
                                    eventId: event.id, 
                                    field: "ticketPurchasesEnabled", 
                                    value: checked 
                                  })
                                }
                                data-testid={`switch-purchases-${event.id}`}
                              />
                              <Label htmlFor={`purchases-${event.id}`} className="flex items-center gap-1 cursor-pointer">
                                {event.ticketPurchasesEnabled ? <ShoppingCart className="h-3 w-3" /> : <Ban className="h-3 w-3" />}
                                Ticket Sales
                              </Label>
                            </div>
                          </div>

                          <div className="flex items-center gap-4 text-xs text-gray-500">
                            <span className="flex items-center gap-1">
                              <Ticket className="h-3 w-3" />
                              {event.ticketsSold || 0} sold
                            </span>
                            {event.maxTickets && (
                              <span>/ {event.maxTickets} max</span>
                            )}
                            {event.specialEffectsEnabled && (
                              <Badge variant="outline" className="text-xs">
                                <Sparkles className="h-3 w-3 mr-1" />
                                Effects
                              </Badge>
                            )}
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payments" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Stripe Configuration</CardTitle>
              <CardDescription>
                Manage your Stripe payment integration settings
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                {/* Stripe Status */}
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <CreditCard className="h-5 w-5 text-gray-500" />
                    <div>
                      <p className="font-medium">Stripe Integration</p>
                      <p className="text-sm text-gray-500">
                        {(paymentData as any)?.stripe?.configured ? "Connected" : "Not Configured"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {(paymentData as any)?.stripe?.configured ? (
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-500" />
                    )}
                  </div>
                </div>

                {/* Stripe Bonus Configuration */}
                <div className="p-4 border rounded-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Stripe Payment Bonus</p>
                      <p className="text-sm text-gray-500">
                        Customers receive 2 bonus tickets when paying with Stripe
                      </p>
                    </div>
                    <Badge variant="secondary">+2 Tickets</Badge>
                  </div>
                </div>

                {/* Test Mode Indicator */}
                {(paymentData as any)?.stripe?.testMode && (
                  <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <div className="flex items-center gap-2">
                      <span className="text-yellow-600 text-sm font-medium">Test Mode</span>
                      <p className="text-sm text-gray-600">
                        Using test API keys. Real payments will not be processed.
                      </p>
                    </div>
                  </div>
                )}

                {/* Configuration Info */}
                <div className="p-4 bg-gray-50 rounded-lg space-y-2">
                  <p className="text-sm font-medium text-gray-700">Configuration</p>
                  <p className="text-xs text-gray-600">
                    Stripe API keys are managed through environment variables:
                  </p>
                  <ul className="text-xs text-gray-600 space-y-1 ml-4">
                    <li>• STRIPE_SECRET_KEY</li>
                    <li>• STRIPE_WEBHOOK_SECRET</li>
                    <li>• STRIPE_PUBLISHABLE_KEY</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Coinbase Commerce Configuration</CardTitle>
              <CardDescription>
                Manage your cryptocurrency payment integration
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                {/* Coinbase Status */}
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <CreditCard className="h-5 w-5 text-gray-500" />
                    <div>
                      <p className="font-medium">Coinbase Commerce</p>
                      <p className="text-sm text-gray-500">
                        Cryptocurrency payment acceptance
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {(paymentData as any)?.coinbase?.enabled ? (
                      <>
                        <CheckCircle className="h-5 w-5 text-green-500" />
                        <span className="text-sm text-green-600">Active</span>
                      </>
                    ) : (
                      <>
                        <XCircle className="h-5 w-5 text-red-500" />
                        <span className="text-sm text-red-600">Not Configured</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Coinbase Bonus Configuration */}
                <div className="p-4 border rounded-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Crypto Payment Bonus</p>
                      <p className="text-sm text-gray-500">
                        Customers receive 10 bonus tickets when paying with cryptocurrency
                      </p>
                    </div>
                    <Badge variant="secondary">+10 Tickets</Badge>
                  </div>
                </div>

                {/* Accepted Currencies */}
                <div className="p-4 border rounded-lg space-y-3">
                  <p className="font-medium text-sm">Accepted Cryptocurrencies</p>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline">Bitcoin (BTC)</Badge>
                    <Badge variant="outline">Ethereum (ETH)</Badge>
                    <Badge variant="outline">USDC</Badge>
                    <Badge variant="outline">Litecoin (LTC)</Badge>
                    <Badge variant="outline">Dogecoin (DOGE)</Badge>
                  </div>
                </div>

                {/* Configuration Info */}
                <div className="p-4 bg-gray-50 rounded-lg space-y-2">
                  <p className="text-sm font-medium text-gray-700">Configuration</p>
                  <p className="text-xs text-gray-600">
                    Coinbase API credentials are managed through environment variables:
                  </p>
                  <ul className="text-xs text-gray-600 space-y-1 ml-4">
                    <li>• COINBASE_API_KEY</li>
                    <li>• COINBASE_WEBHOOK_SECRET</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="content" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Platform Headers Management</CardTitle>
              <CardDescription>
                Manage the dynamic titles and subtitles that appear on the home page. The system randomly selects one to display each time the page loads.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Add New Header Form */}
              <div className="space-y-4 p-4 border rounded-lg bg-gray-50">
                <h3 className="font-medium text-sm">Add New Header</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Title</Label>
                    <Input
                      placeholder="Enter title..."
                      value={newHeaderTitle}
                      onChange={(e) => setNewHeaderTitle(e.target.value)}
                      data-testid="input-new-header-title"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Subtitle</Label>
                    <Input
                      placeholder="Enter subtitle..."
                      value={newHeaderSubtitle}
                      onChange={(e) => setNewHeaderSubtitle(e.target.value)}
                      data-testid="input-new-header-subtitle"
                    />
                  </div>
                </div>
                <Button
                  onClick={() => {
                    if (newHeaderTitle && newHeaderSubtitle) {
                      createHeaderMutation.mutate({ title: newHeaderTitle, subtitle: newHeaderSubtitle });
                    } else {
                      toast({
                        title: "Missing Information",
                        description: "Please enter both title and subtitle.",
                        variant: "destructive"
                      });
                    }
                  }}
                  disabled={createHeaderMutation.isPending}
                  className="w-full"
                  data-testid="button-add-header"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  {createHeaderMutation.isPending ? "Adding..." : "Add Header"}
                </Button>
              </div>

              {/* Headers List */}
              <div className="space-y-2">
                <h3 className="font-medium text-sm mb-3">Current Headers ({platformHeaders.length})</h3>
                <ScrollArea className="h-[400px] pr-4">
                  {headersLoading ? (
                    <p className="text-gray-500 text-sm">Loading headers...</p>
                  ) : platformHeaders.length === 0 ? (
                    <p className="text-gray-500 text-sm">No headers found. Add your first header above.</p>
                  ) : (
                    <div className="space-y-2">
                      {(platformHeaders as any[]).map((header: any) => (
                        <div key={header.id} className="p-3 border rounded-lg space-y-2 bg-white">
                          {editingHeader?.id === header.id ? (
                            // Edit Mode
                            <div className="space-y-3">
                              <Input
                                value={editingHeader.title}
                                onChange={(e) => setEditingHeader({ ...editingHeader, title: e.target.value })}
                                placeholder="Title"
                                data-testid={`input-edit-title-${header.id}`}
                              />
                              <Input
                                value={editingHeader.subtitle}
                                onChange={(e) => setEditingHeader({ ...editingHeader, subtitle: e.target.value })}
                                placeholder="Subtitle"
                                data-testid={`input-edit-subtitle-${header.id}`}
                              />
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  onClick={() => {
                                    updateHeaderMutation.mutate({
                                      id: header.id,
                                      title: editingHeader.title,
                                      subtitle: editingHeader.subtitle
                                    });
                                  }}
                                  disabled={updateHeaderMutation.isPending}
                                  data-testid={`button-save-${header.id}`}
                                >
                                  Save
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setEditingHeader(null)}
                                  data-testid={`button-cancel-${header.id}`}
                                >
                                  Cancel
                                </Button>
                              </div>
                            </div>
                          ) : (
                            // View Mode
                            <>
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <h4 className="font-medium text-sm">{header.title}</h4>
                                  <p className="text-xs text-gray-600 mt-1">{header.subtitle}</p>
                                </div>
                                <div className="flex items-center gap-1">
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => toggleHeaderMutation.mutate(header.id)}
                                    disabled={toggleHeaderMutation.isPending}
                                    data-testid={`button-toggle-${header.id}`}
                                  >
                                    {header.active ? (
                                      <ToggleRight className="h-4 w-4 text-green-600" />
                                    ) : (
                                      <ToggleLeft className="h-4 w-4 text-gray-400" />
                                    )}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => setEditingHeader(header)}
                                    data-testid={`button-edit-${header.id}`}
                                  >
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => {
                                      if (confirm("Are you sure you want to delete this header?")) {
                                        deleteHeaderMutation.mutate(header.id);
                                      }
                                    }}
                                    disabled={deleteHeaderMutation.isPending}
                                    data-testid={`button-delete-${header.id}`}
                                  >
                                    <Trash2 className="h-4 w-4 text-red-500" />
                                  </Button>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge variant={header.active ? "default" : "secondary"}>
                                  {header.active ? "Active" : "Inactive"}
                                </Badge>
                                {header.displayOrder && (
                                  <Badge variant="outline">Order: {header.displayOrder}</Badge>
                                )}
                              </div>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </div>

              {/* Statistics */}
              <div className="p-4 bg-blue-50 rounded-lg space-y-2">
                <p className="text-sm font-medium text-blue-700">Statistics</p>
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <p className="text-blue-600">Total Headers:</p>
                    <p className="font-medium text-blue-800">{platformHeaders.length}</p>
                  </div>
                  <div>
                    <p className="text-blue-600">Active Headers:</p>
                    <p className="font-medium text-blue-800">
                      {(platformHeaders as any[]).filter((h: any) => h.active).length}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Banned Words Card */}
          <Card>
            <CardHeader>
              <CardTitle>Content Moderation</CardTitle>
              <CardDescription>
                Manage banned words that automatically set events to private when detected in titles or venue information. Words are case-insensitive.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="banned-words">Banned Words (comma-separated)</Label>
                <textarea
                  id="banned-words"
                  className="w-full min-h-[100px] p-3 border rounded-md resize-y"
                  placeholder="Enter banned words separated by commas..."
                  value={bannedWords}
                  onChange={(e) => setBannedWords(e.target.value)}
                  data-testid="textarea-banned-words"
                />
                <p className="text-xs text-gray-500">
                  Events containing these words in their title or venue will be automatically set to private.
                </p>
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={() => {
                    setBannedWordsLoading(true);
                    updateBannedWordsMutation.mutate(bannedWords);
                  }}
                  disabled={bannedWordsLoading || updateBannedWordsMutation.isPending}
                  className="flex-1"
                  data-testid="button-save-banned-words"
                >
                  {updateBannedWordsMutation.isPending ? "Saving..." : "Save Banned Words"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setBannedWords(bannedWordsData?.words || "");
                  }}
                  disabled={bannedWordsLoading || updateBannedWordsMutation.isPending}
                  data-testid="button-reset-banned-words"
                >
                  Reset
                </Button>
              </div>

              {/* Info Box */}
              <div className="p-4 bg-yellow-50 rounded-lg space-y-2">
                <p className="text-sm font-medium text-yellow-800">How it works</p>
                <ul className="text-xs text-yellow-700 space-y-1 ml-4">
                  <li>• Words are checked against event titles and venue information</li>
                  <li>• Matching is case-insensitive</li>
                  <li>• Events with banned words are set to private automatically</li>
                  <li>• Changes apply to new events only (existing events are not affected)</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* NFT Settings Tab */}
        <TabsContent value="nft" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>NFT Configuration</CardTitle>
              <CardDescription>
                Manage NFT minting features for validated tickets. Users can mint their validated tickets as collectible NFTs on the blockchain.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* NFT Feature Toggle */}
              <div className="p-4 border rounded-lg space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="font-medium">Enable NFT Features</p>
                    <p className="text-sm text-gray-500">
                      Allow users to mint validated tickets as NFTs
                    </p>
                  </div>
                  <Switch
                    id="nft-enabled"
                    checked={nftSettings?.enabled || false}
                    onCheckedChange={(enabled) => {
                      updateNftSettingsMutation.mutate({ enabled });
                    }}
                    disabled={updateNftSettingsMutation.isPending || !nftSettings?.configured}
                    data-testid="switch-nft-enabled"
                  />
                </div>
                {!nftSettings?.configured && (
                  <div className="p-3 bg-yellow-50 rounded-md">
                    <p className="text-sm text-yellow-800">
                      ⚠️ NFT features cannot be enabled until the smart contract is deployed and configured.
                    </p>
                  </div>
                )}
              </div>

              {/* Configuration Status */}
              <div className="space-y-4">
                <h3 className="font-medium">Smart Contract Configuration</h3>
                <div className="space-y-3">
                  {/* Contract Address */}
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <Ticket className="h-5 w-5 text-gray-500" />
                      <div>
                        <p className="font-medium">Contract Address</p>
                        <p className="text-sm text-gray-500">NFT_CONTRACT_ADDRESS</p>
                      </div>
                    </div>
                    {nftSettings?.status?.contractAddress ? (
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-500" />
                    )}
                  </div>

                  {/* Minter Key */}
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <Settings className="h-5 w-5 text-gray-500" />
                      <div>
                        <p className="font-medium">Minter Private Key</p>
                        <p className="text-sm text-gray-500">NFT_MINTER_PRIVATE_KEY</p>
                      </div>
                    </div>
                    {nftSettings?.status?.minterKey ? (
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-500" />
                    )}
                  </div>

                  {/* Royalty Wallet */}
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <CreditCard className="h-5 w-5 text-gray-500" />
                      <div>
                        <p className="font-medium">Royalty Wallet</p>
                        <p className="text-sm text-gray-500">NFT_ROYALTY_WALLET</p>
                      </div>
                    </div>
                    {nftSettings?.status?.royaltyWallet ? (
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-500" />
                    )}
                  </div>

                  {/* RPC URL */}
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <Settings className="h-5 w-5 text-gray-500" />
                      <div>
                        <p className="font-medium">Base RPC URL</p>
                        <p className="text-sm text-gray-500">{nftSettings?.status?.rpcUrl || "https://mainnet.base.org"}</p>
                      </div>
                    </div>
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  </div>
                </div>
              </div>

              {/* Deployment Instructions */}
              <div className="p-4 bg-blue-50 rounded-lg space-y-3">
                <p className="text-sm font-medium text-blue-800">Deployment Instructions</p>
                <ol className="text-xs text-blue-700 space-y-2 ml-4">
                  <li>1. Deploy the TicketRegistry contract to Base L2 blockchain</li>
                  <li>2. Set NFT_CONTRACT_ADDRESS environment variable with the deployed contract address</li>
                  <li>3. Set NFT_MINTER_PRIVATE_KEY with the private key of the minter wallet</li>
                  <li>4. Set NFT_ROYALTY_WALLET with the wallet address to receive 2.69% royalties</li>
                  <li>5. Optionally set BASE_RPC_URL for custom RPC endpoint (defaults to Base mainnet)</li>
                  <li>6. Install ethers library: npm install ethers</li>
                  <li>7. Enable NFT features using the toggle above</li>
                </ol>
              </div>

              {/* Contract Details */}
              <div className="p-4 bg-gray-50 rounded-lg space-y-2">
                <p className="text-sm font-medium text-gray-700">Contract Features</p>
                <ul className="text-xs text-gray-600 space-y-1 ml-4">
                  <li>• ERC-721 NFT standard for ticket collectibles</li>
                  <li>• ERC-2981 royalty standard (2.69% on resales)</li>
                  <li>• Per-token royalty configuration</li>
                  <li>• Metadata served from platform API</li>
                  <li>• One-time minting per validated ticket</li>
                  <li>• Base L2 blockchain for low gas fees</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}