import { useState } from "react";
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
import { useAdmin } from "@/hooks/use-admin";
import { useLocation } from "wouter";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Search, Settings, Ticket, Sparkles, Calendar, Eye, EyeOff, ShoppingCart, Ban, CreditCard, CheckCircle, XCircle } from "lucide-react";

// Special effects configuration with ticket type previews
const SPECIAL_EFFECTS = [
  { name: "Valentine's Day", defaultOdds: 14, icon: "❤️", color: "text-pink-500" },
  { name: "Halloween", defaultOdds: 88, icon: "🎃", color: "text-orange-500" },
  { name: "Christmas", defaultOdds: 25, icon: "🎄", color: "text-green-500" },
  { name: "Nice", defaultOdds: 69, icon: "✨", color: "text-purple-500" }
];

export default function AdminSettings() {
  const { user } = useAuth();
  const { isAdmin, isLoading: isAdminLoading } = useAdmin();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedEffect, setSelectedEffect] = useState<string | null>(null);
  const [effectOdds, setEffectOdds] = useState({
    valentines: 14,
    halloween: 88,
    christmas: 25,
    nice: 69
  });
  const [paymentStatus, setPaymentStatus] = useState<any>(null);

  // Check if user has admin access
  if (isAdminLoading) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardHeader>
            <CardTitle>Loading...</CardTitle>
            <CardDescription>
              Checking access permissions...
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (!isAdmin) {
    navigate("/");
    return null;
  }

  // Get all events for management
  const { data: events = [], isLoading: eventsLoading } = useQuery({
    queryKey: ["/api/admin/events"],
    enabled: isAdmin
  });

  // Get current special effects odds
  const { data: currentOdds } = useQuery({
    queryKey: ["/api/admin/special-effects-odds"],
    enabled: isAdmin,
    onSuccess: (data) => {
      if (data) {
        setEffectOdds(data);
      }
    }
  });

  // Get payment configuration status
  const { data: paymentData } = useQuery({
    queryKey: ["/api/admin/payment-status"],
    enabled: isAdmin
  });

  // Update special effects odds
  const updateOddsMutation = useMutation({
    mutationFn: async (odds: typeof effectOdds) => {
      return apiRequest("/api/admin/special-effects-odds", {
        method: "PUT",
        body: JSON.stringify(odds)
      });
    },
    onSuccess: () => {
      toast({
        title: "Settings Updated",
        description: "Special effects odds have been updated successfully."
      });
      queryClient.invalidateQueries(["/api/admin/special-effects-odds"]);
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
      return apiRequest(`/api/admin/events/${eventId}/toggle`, {
        method: "PUT",
        body: JSON.stringify({ field, value })
      });
    },
    onSuccess: () => {
      toast({
        title: "Event Updated",
        description: "Event settings have been updated successfully."
      });
      queryClient.invalidateQueries(["/api/admin/events"]);
    },
    onError: () => {
      toast({
        title: "Update Failed",
        description: "Failed to update event settings.",
        variant: "destructive"
      });
    }
  });

  const filteredEvents = events.filter((event: any) =>
    event.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    event.venue.toLowerCase().includes(searchQuery.toLowerCase())
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
        <TabsList className="grid w-full grid-cols-3">
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
                        {paymentData?.stripe?.configured ? "Connected" : "Not Configured"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {paymentData?.stripe?.configured ? (
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
                {paymentData?.stripe?.testMode && (
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
                    {paymentData?.coinbase?.enabled ? (
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
      </Tabs>
    </div>
  );
}