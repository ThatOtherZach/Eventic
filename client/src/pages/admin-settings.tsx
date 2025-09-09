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
import { Search, Settings, Ticket, Sparkles, Calendar, Eye, EyeOff, ShoppingCart, Ban, CreditCard, CheckCircle, XCircle, FileText, Edit, Trash2, Plus, ToggleLeft, ToggleRight, Globe, Users, AlertCircle } from "lucide-react";
import "@/styles/admin.css";

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
  const [seoSettings, setSeoSettings] = useState<any>({});
  const [registrationLimit, setRegistrationLimit] = useState<string>("unlimited");
  const [userCount, setUserCount] = useState<number | null>(null);

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
  const { data: platformHeaders = [], isLoading: headersLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/platform-headers"],
    enabled: isAdmin()
  });

  // Get banned words for content moderation
  const { data: bannedWordsData } = useQuery<{ words?: string }>({
    queryKey: ["/api/admin/banned-words"],
    enabled: isAdmin()
  });

  // Get NFT settings
  const { data: nftSettings } = useQuery<{
    enabled: boolean;
    configured: boolean;
    status?: {
      contractAddress: boolean;
      minterKey: boolean;
      royaltyWallet: boolean;
      rpcUrl: string;
    };
  }>({
    queryKey: ["/api/admin/nft/settings"],
    enabled: isAdmin()
  });

  // Get SEO settings
  const { data: seoSettingsData } = useQuery<any>({
    queryKey: ["/api/admin/seo/settings"],
    enabled: isAdmin()
  });

  // Get user registration limit
  const { data: registrationLimitData } = useQuery<{ limit: string; userCount: number }>({
    queryKey: ["/api/admin/registration-limit"],
    enabled: isAdmin()
  });

  // Set registration limit and user count when data loads
  useEffect(() => {
    if (registrationLimitData) {
      setRegistrationLimit(registrationLimitData.limit || "unlimited");
      setUserCount(registrationLimitData.userCount || 0);
    }
  }, [registrationLimitData]);

  // Set banned words when data loads
  useEffect(() => {
    if (bannedWordsData) {
      setBannedWords(bannedWordsData.words || "");
    }
  }, [bannedWordsData]);

  // Set SEO settings when data loads
  useEffect(() => {
    if (seoSettingsData) {
      setSeoSettings(seoSettingsData);
    }
  }, [seoSettingsData]);

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
    onSuccess: async (response) => {
      const data = await response.json();
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

  // Update SEO settings mutation
  const updateSeoSettingsMutation = useMutation({
    mutationFn: async (settings: any) => {
      return apiRequest("PUT", "/api/admin/seo/settings", settings);
    },
    onSuccess: () => {
      toast({
        title: "Settings Updated",
        description: "SEO settings have been updated successfully."
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/seo/settings"] });
    },
    onError: () => {
      toast({
        title: "Update Failed",
        description: "Failed to update SEO settings.",
        variant: "destructive"
      });
    }
  });

  // Update registration limit mutation
  const updateRegistrationLimitMutation = useMutation({
    mutationFn: async (limit: string) => {
      return apiRequest("PUT", "/api/admin/registration-limit", { limit });
    },
    onSuccess: () => {
      toast({
        title: "Registration Limit Updated",
        description: "User registration limit has been updated successfully."
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/registration-limit"] });
    },
    onError: () => {
      toast({
        title: "Update Failed",
        description: "Failed to update registration limit.",
        variant: "destructive"
      });
    }
  });

  const filteredEvents = (events as any[]).filter((event: any) =>
    event?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    event?.venue?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="admin-container">
      <div className="admin-content-wrapper" data-testid="admin-settings-page">
        <div className="flex items-center justify-between mb-6">
          <h1 className="admin-header text-4xl">Admin Settings</h1>
          <Badge className="admin-badge primary">
            Admin Access
          </Badge>
        </div>

        <Tabs defaultValue="effects" className="w-full">
          <TabsList className="admin-tabs-list">
            <TabsTrigger value="effects" className="admin-tab-trigger">
              <Sparkles className="h-4 w-4" />
              Special Effects
            </TabsTrigger>
            <TabsTrigger value="events" className="admin-tab-trigger">
              <Settings className="h-4 w-4" />
              Event Management
            </TabsTrigger>
            <TabsTrigger value="users" className="admin-tab-trigger">
              <Users className="h-4 w-4" />
              User Management
            </TabsTrigger>
            <TabsTrigger value="payments" className="admin-tab-trigger">
              <CreditCard className="h-4 w-4" />
              Payment Settings
            </TabsTrigger>
            <TabsTrigger value="nft" className="admin-tab-trigger">
              <Ticket className="h-4 w-4" />
              NFT Settings
            </TabsTrigger>
            <TabsTrigger value="content" className="admin-tab-trigger">
              <FileText className="h-4 w-4" />
              Content
            </TabsTrigger>
            <TabsTrigger value="seo" className="admin-tab-trigger">
              <Globe className="h-4 w-4" />
              SEO
            </TabsTrigger>
          </TabsList>

          <TabsContent value="effects" className="space-y-6 mt-6">
            <Card className="admin-card">
              <CardHeader className="admin-card-header">
                <CardTitle className="admin-card-title">Special Effects Odds Configuration</CardTitle>
                <CardDescription className="admin-card-description">
                  Adjust the odds for special ticket effects. Lower numbers mean more frequent effects.
                </CardDescription>
              </CardHeader>
              <CardContent className="admin-card-content space-y-6">
                {/* Ticket Type Preview Selector */}
                <div className="space-y-3">
                  <Label className="admin-label">Preview Ticket Type</Label>
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
                      <Label className="admin-label">
                        <span className={effect.color}>{effect.icon}</span>
                        {effect.name} (1 in X)
                      </Label>
                      <Input
                        className="admin-input"
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
                  className="admin-btn-primary w-full"
                  data-testid="button-save-odds"
                >
                  {updateOddsMutation.isPending ? "Saving..." : "Save Odds Configuration"}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="events" className="space-y-6 mt-6">
            <Card className="admin-card">
              <CardHeader className="admin-card-header">
                <CardTitle className="admin-card-title">Event Management</CardTitle>
                <CardDescription className="admin-card-description">
                  Find and manage all events in the system. Control visibility and ticket sales.
                </CardDescription>
              </CardHeader>
              <CardContent className="admin-card-content space-y-4">
                {/* Search Bar */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <Input
                    placeholder="Search events by name or venue..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="admin-input pl-10"
                  data-testid="input-search-events"
                />
              </div>

                {/* Events List */}
                <ScrollArea className="admin-scroll-area h-[500px] pr-4">
                {eventsLoading ? (
                  <div className="text-center py-8 text-gray-500">Loading events...</div>
                ) : filteredEvents.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">No events found</div>
                ) : (
                  <div className="space-y-3">
                    {filteredEvents.map((event: any) => (
                      <div key={event.id} className="admin-event-item">
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
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

          <TabsContent value="users" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle>User Registration Management</CardTitle>
              <CardDescription>
                Control user registration limits and manage platform growth
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Registration Limit Setting */}
              <div className="space-y-4">
                <div className="space-y-3">
                  <Label htmlFor="registration-limit" className="text-base font-semibold">Registration Limit</Label>
                  <Select
                    value={registrationLimit}
                    onValueChange={(value) => setRegistrationLimit(value)}
                    data-testid="select-registration-limit"
                  >
                    <SelectTrigger id="registration-limit" className="w-full">
                      <SelectValue placeholder="Select a limit" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="100">100 users</SelectItem>
                      <SelectItem value="500">500 users</SelectItem>
                      <SelectItem value="1000">1,000 users</SelectItem>
                      <SelectItem value="10000">10,000 users</SelectItem>
                      <SelectItem value="unlimited">Unlimited</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-gray-500">
                    Limit new user registrations during early stage. Super admins can always register.
                  </p>
                </div>

                {/* Current User Count Display */}
                <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="text-sm font-medium">Current Users</p>
                      <p className="text-2xl font-bold">
                        {userCount ? userCount.toLocaleString() : "..."}
                        {registrationLimit !== "unlimited" && (
                          <span className="text-base font-normal text-gray-500">
                            {" "}/ {parseInt(registrationLimit).toLocaleString()}
                          </span>
                        )}
                      </p>
                    </div>
                    {registrationLimit !== "unlimited" && userCount && (
                      <div className="text-right">
                        <p className="text-sm text-gray-500">Capacity</p>
                        <p className="text-lg font-semibold">
                          {Math.round((userCount / parseInt(registrationLimit)) * 100)}%
                        </p>
                        {userCount >= parseInt(registrationLimit) * 0.9 && (
                          <Badge variant="destructive" className="mt-1">
                            <AlertCircle className="h-3 w-3 mr-1" />
                            Near Limit
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Save Button */}
                <Button 
                  onClick={() => updateRegistrationLimitMutation.mutate(registrationLimit)}
                  disabled={updateRegistrationLimitMutation.isPending}
                  className="w-full"
                  data-testid="button-save-registration-limit"
                >
                  {updateRegistrationLimitMutation.isPending ? "Saving..." : "Save Registration Limit"}
                </Button>
              </div>

              {/* Cleanup Info */}
              <div className="border-t pt-4">
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold">Automatic Cleanup</h4>
                  <p className="text-sm text-gray-500">
                    Users who register but never sign in are automatically removed after 30 days on the 1st of each month.
                    This helps keep your user count accurate and frees up space for active users.
                  </p>
                </div>
              </div>
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
                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label htmlFor="nft-status">NFT Feature Status</Label>
                    <p className="text-sm text-gray-500">
                      Control whether users can mint validated tickets as NFTs
                    </p>
                  </div>
                  <Select
                    value={nftSettings?.enabled ? "enabled" : "disabled"}
                    onValueChange={(value) => {
                      updateNftSettingsMutation.mutate({ enabled: value === "enabled" });
                    }}
                    disabled={updateNftSettingsMutation.isPending || !nftSettings?.configured}
                  >
                    <SelectTrigger id="nft-status" className="w-[200px]" data-testid="select-nft-status">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="enabled">
                        <span className="flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-green-500" />
                          Enabled
                        </span>
                      </SelectItem>
                      <SelectItem value="disabled">
                        <span className="flex items-center gap-2">
                          <XCircle className="h-4 w-4 text-gray-500" />
                          Disabled
                        </span>
                      </SelectItem>
                    </SelectContent>
                  </Select>
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
                <div className="flex items-center justify-between">
                  <h3 className="font-medium">Environment Configuration Status</h3>
                  <Badge variant={nftSettings?.configured ? "default" : "secondary"}>
                    {nftSettings?.configured ? "Configured" : "Not Configured"}
                  </Badge>
                </div>
                <p className="text-sm text-gray-500">
                  These values are read-only and must be configured through Replit's Secrets tab for security.
                </p>
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
                <p className="text-sm font-medium text-blue-800">Configuration Instructions</p>
                <div className="text-xs text-blue-700 space-y-3">
                  <div className="p-3 bg-white rounded border border-blue-200">
                    <p className="font-medium mb-2">⚠️ Security Notice</p>
                    <p>Environment variables must be set through Replit's Secrets tab for security. Never expose private keys or sensitive data through the admin interface.</p>
                  </div>
                  <p className="font-medium">Steps to configure NFT features:</p>
                  <ol className="space-y-2 ml-4">
                    <li>1. Deploy the TicketRegistry contract to Base L2 blockchain</li>
                    <li>2. Open Replit's Secrets tab (Tools → Secrets)</li>
                    <li>3. Add the following secrets:
                      <ul className="ml-4 mt-1 space-y-1">
                        <li>• <code className="bg-blue-100 px-1">NFT_CONTRACT_ADDRESS</code> - Deployed contract address</li>
                        <li>• <code className="bg-blue-100 px-1">NFT_MINTER_PRIVATE_KEY</code> - Private key of minter wallet</li>
                        <li>• <code className="bg-blue-100 px-1">NFT_ROYALTY_WALLET</code> - Wallet for 2.69% royalties</li>
                        <li>• <code className="bg-blue-100 px-1">BASE_RPC_URL</code> - Optional custom RPC endpoint</li>
                      </ul>
                    </li>
                    <li>4. Install ethers library: <code className="bg-blue-100 px-1">npm install ethers</code></li>
                    <li>5. Restart the application</li>
                    <li>6. Enable NFT features using the dropdown above</li>
                  </ol>
                </div>
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

        {/* SEO Settings Tab */}
        <TabsContent value="seo" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>SEO Configuration</CardTitle>
              <CardDescription>
                Manage search engine optimization settings including site name, default images, and meta tags.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Site Name */}
              <div className="space-y-2">
                <Label htmlFor="site-name">Site Name</Label>
                <Input
                  id="site-name"
                  placeholder="Eventic"
                  value={seoSettings?.siteName || "Eventic"}
                  onChange={(e) => setSeoSettings((prev: any) => ({ ...prev, siteName: e.target.value }))}
                  data-testid="input-site-name"
                />
                <p className="text-xs text-gray-500">
                  The name of your platform that appears in search results and page titles.
                </p>
              </div>

              {/* Default Description */}
              <div className="space-y-2">
                <Label htmlFor="default-description">Default Description</Label>
                <textarea
                  id="default-description"
                  className="w-full min-h-[80px] p-3 border rounded-md resize-y"
                  placeholder="Create and manage events, generate tickets, and validate them via QR codes..."
                  value={seoSettings?.defaultDescription || ""}
                  onChange={(e) => setSeoSettings((prev: any) => ({ ...prev, defaultDescription: e.target.value }))}
                  data-testid="textarea-default-description"
                />
                <p className="text-xs text-gray-500">
                  Default meta description for pages without specific descriptions (max 160 characters recommended).
                </p>
              </div>

              {/* Default Keywords */}
              <div className="space-y-2">
                <Label htmlFor="default-keywords">Default Keywords</Label>
                <Input
                  id="default-keywords"
                  placeholder="events, tickets, event management, QR codes..."
                  value={seoSettings?.defaultKeywords || ""}
                  onChange={(e) => setSeoSettings((prev: any) => ({ ...prev, defaultKeywords: e.target.value }))}
                  data-testid="input-default-keywords"
                />
                <p className="text-xs text-gray-500">
                  Comma-separated keywords for search engine optimization.
                </p>
              </div>

              {/* Social Media Images */}
              <div className="space-y-4">
                <h3 className="font-medium">Social Media Images</h3>
                
                {/* OG Image */}
                <div className="space-y-2">
                  <Label htmlFor="og-image">Open Graph Image URL</Label>
                  <Input
                    id="og-image"
                    type="url"
                    placeholder="https://example.com/og-image.png"
                    value={seoSettings?.ogImage || ""}
                    onChange={(e) => setSeoSettings((prev: any) => ({ ...prev, ogImage: e.target.value }))}
                    data-testid="input-og-image"
                  />
                  <p className="text-xs text-gray-500">
                    Default image for social media sharing (1200x630px recommended).
                  </p>
                </div>

                {/* Twitter Image */}
                <div className="space-y-2">
                  <Label htmlFor="twitter-image">Twitter Card Image URL</Label>
                  <Input
                    id="twitter-image"
                    type="url"
                    placeholder="https://example.com/twitter-image.png"
                    value={seoSettings?.twitterImage || ""}
                    onChange={(e) => setSeoSettings((prev: any) => ({ ...prev, twitterImage: e.target.value }))}
                    data-testid="input-twitter-image"
                  />
                  <p className="text-xs text-gray-500">
                    Image for Twitter cards (can be same as OG image).
                  </p>
                </div>
              </div>

              {/* Favicon URL */}
              <div className="space-y-2">
                <Label htmlFor="favicon">Favicon URL</Label>
                <Input
                  id="favicon"
                  type="url"
                  placeholder="https://example.com/favicon.ico"
                  value={seoSettings?.favicon || ""}
                  onChange={(e) => setSeoSettings((prev: any) => ({ ...prev, favicon: e.target.value }))}
                  data-testid="input-favicon"
                />
                <p className="text-xs text-gray-500">
                  Icon that appears in browser tabs (16x16px or 32x32px).
                </p>
              </div>

              {/* Save Button */}
              <div className="flex gap-2">
                <Button
                  onClick={() => updateSeoSettingsMutation.mutate(seoSettings)}
                  disabled={updateSeoSettingsMutation.isPending}
                  className="flex-1"
                  data-testid="button-save-seo"
                >
                  {updateSeoSettingsMutation.isPending ? "Saving..." : "Save SEO Settings"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setSeoSettings(seoSettingsData)}
                  disabled={updateSeoSettingsMutation.isPending}
                  data-testid="button-reset-seo"
                >
                  Reset
                </Button>
              </div>

              {/* SEO Tips */}
              <div className="p-4 bg-blue-50 rounded-lg space-y-2">
                <p className="text-sm font-medium text-blue-800">SEO Best Practices</p>
                <ul className="text-xs text-blue-700 space-y-1 ml-4">
                  <li>• Keep descriptions between 150-160 characters for best display</li>
                  <li>• Use unique, descriptive titles for each page</li>
                  <li>• Include relevant keywords naturally in content</li>
                  <li>• Ensure images have proper dimensions for social sharing</li>
                  <li>• Update meta tags regularly to reflect current content</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}