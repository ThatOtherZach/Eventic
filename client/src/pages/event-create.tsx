import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertEventSchema, type InsertEvent, type Event, type Ticket } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { ObjectUploader } from "@/components/ObjectUploader";
import { TicketCard } from "@/components/tickets/ticket-card";
import { ArrowLeft, CreditCard, Image } from "lucide-react";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";
import { countries } from "@/lib/countries";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";

export function EventCreatePage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [imageUrl, setImageUrl] = useState<string>("");
  
  // Address component states
  const [address, setAddress] = useState<string>("");
  const [city, setCity] = useState<string>("");
  const [country, setCountry] = useState<string>("");
  
  // Calculate min and max dates for event creation
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const minDate = tomorrow.toISOString().split('T')[0];
  
  const fiveYearsFromNow = new Date();
  fiveYearsFromNow.setFullYear(fiveYearsFromNow.getFullYear() + 5);
  const maxDate = fiveYearsFromNow.toISOString().split('T')[0];

  const form = useForm<InsertEvent>({
    resolver: zodResolver(insertEventSchema),
    defaultValues: {
      name: "",
      description: "",
      venue: "",
      date: "",
      time: "",
      endDate: "",
      endTime: "",
      ticketPrice: "0",
      maxTickets: 100,
      imageUrl: undefined,
      ticketBackgroundUrl: undefined,
      earlyValidation: "Allow at Anytime",
      reentryType: "No Reentry (Single Use)",
      maxUses: 1,
      goldenTicketEnabled: false,
      goldenTicketCount: undefined,
      specialEffectsEnabled: false,
      allowMinting: false,
      isPrivate: false,
      oneTicketPerUser: false,
      surgePricing: false,
      raffleEnabled: false,
    },
  });

  const createEventMutation = useMutation({
    mutationFn: async (data: InsertEvent) => {
      const response = await apiRequest("POST", "/api/events", data);
      return response.json();
    },
    onSuccess: (event) => {
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      toast({
        title: "Success",
        description: "Event created successfully",
      });
      // Redirect to the event page
      setLocation(`/events/${event.id}`);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create event",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: InsertEvent) => {
    // Validate at least one address field is filled
    if (!address && !city && !country) {
      toast({
        title: "Validation Error",
        description: "Please enter at least one venue location field",
        variant: "destructive",
      });
      return;
    }
    
    // Combine address components into venue field
    const venueString = [address, city, country]
      .filter(Boolean)
      .join(', ');
    
    // Update data with combined venue
    data.venue = venueString;
    
    // Validate start date is at least 1 day in the future
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0); // Set to start of day
    
    const eventDate = new Date(`${data.date}T${data.time}`);
    
    if (eventDate < tomorrow) {
      form.setError('date', {
        type: 'manual',
        message: 'Event must be scheduled at least one day in advance'
      });
      return;
    }
    
    // Validate event date is not more than 5 years in the future
    const fiveYearsFromNow = new Date(now);
    fiveYearsFromNow.setFullYear(fiveYearsFromNow.getFullYear() + 5);
    
    if (eventDate > fiveYearsFromNow) {
      form.setError('date', {
        type: 'manual',
        message: 'Event cannot be scheduled more than 5 years in advance'
      });
      return;
    }
    
    // Validate end date/time if both are provided
    if (data.endDate && data.endTime) {
      const startDateTime = new Date(`${data.date}T${data.time}`);
      const endDateTime = new Date(`${data.endDate}T${data.endTime}`);
      
      if (endDateTime <= startDateTime) {
        form.setError('endDate', {
          type: 'manual',
          message: 'End date/time must be after start date/time'
        });
        return;
      }
    }

    // Ensure maxTickets has a default value of 100 if not set
    const submitData = {
      ...data,
      maxTickets: data.maxTickets || 100,
      imageUrl: imageUrl || undefined,
      ticketBackgroundUrl: imageUrl || undefined, // Use featured image for ticket background
    };

    createEventMutation.mutate(submitData);
  };

  const handleImageUpload = async () => {
    const response = await apiRequest("POST", "/api/objects/upload", {});
    const data = await response.json();
    return {
      method: "PUT" as const,
      url: data.uploadURL,
    };
  };
  


  const handleImageComplete = (result: any) => {
    // Extract the uploaded URL from the result
    const uploadedUrl = result.successful?.[0]?.uploadURL;
    if (uploadedUrl) {
      // Store the raw URL - it will be normalized by the server
      setImageUrl(uploadedUrl);
      toast({
        title: "Feature image uploaded",
        description: "Image applied to both event and ticket preview",
      });
    }
  };



  // Create a sample ticket for preview
  const sampleTicket: Ticket = {
    id: "sample",
    eventId: "sample",
    userId: user?.id || "",
    ticketNumber: "PREVIEW-001",
    qrData: "sample-qr-data", // Need QR data to show QR code in preview
    isValidated: false,
    validatedAt: null,
    validationCode: null,
    useCount: 0,
    isGoldenTicket: false,
    createdAt: new Date(),
    recipientName: "John Doe",
    recipientEmail: user?.email || "user@example.com",
    seatNumber: null,
    ticketType: null,
    transferable: false,
    status: "sent",
    purchaserEmail: null,
    purchaserIp: null,
    purchasePrice: "0",
    resellStatus: null,
    originalOwnerId: null,
    isRaffleWinner: false,
    raffleWonAt: null,
  };

  const watchedValues = form.watch();
  
  // Format date for preview
  const formatPreviewDate = (date: string | undefined) => {
    if (!date) return "2024-01-01";
    try {
      return new Date(date).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    } catch {
      return date;
    }
  };
  

  
  const previewEvent: Event = {
    id: "preview",
    name: watchedValues.name || "Your Event Name",
    description: watchedValues.description || null,
    venue: watchedValues.venue || "Event Venue",
    country: null,
    date: formatPreviewDate(watchedValues.date),
    time: watchedValues.time || "19:00",
    endDate: watchedValues.endDate || null,
    endTime: watchedValues.endTime || null,
    ticketPrice: watchedValues.ticketPrice || "0",
    maxTickets: watchedValues.maxTickets || null,
    userId: user?.id || null,
    imageUrl: imageUrl || null,
    ticketBackgroundUrl: imageUrl || null, // Use featured image for ticket background
    earlyValidation: watchedValues.earlyValidation || "Allow at Anytime",
    reentryType: watchedValues.reentryType || "No Reentry (Single Use)",
    maxUses: watchedValues.maxUses || 1,
    goldenTicketEnabled: watchedValues.goldenTicketEnabled || false,
    goldenTicketCount: watchedValues.goldenTicketCount || null,
    specialEffectsEnabled: watchedValues.specialEffectsEnabled || false,
    allowMinting: watchedValues.allowMinting || false,
    isPrivate: watchedValues.isPrivate || false,
    isEnabled: true,
    ticketPurchasesEnabled: true,
    oneTicketPerUser: watchedValues.oneTicketPerUser || false,
    surgePricing: watchedValues.surgePricing || false,
    raffleEnabled: watchedValues.raffleEnabled || false,
    createdAt: new Date(),
  };

  return (
    <div className="container py-5">
      <div className="row">
        <div className="col-lg-8 mx-auto">
          <div className="d-flex align-items-center mb-4">
            <button 
              className="btn btn-link text-decoration-none p-0 me-3"
              onClick={() => setLocation("/events")}
              data-testid="button-back"
            >
              <ArrowLeft size={24} />
            </button>
            <h1 className="h2 mb-0">Create New Event</h1>
          </div>

          <div className="card">
            <div className="card-body">
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)}>
                  <div className="row g-3">
                    <div className="col-12">
                      <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Event Name</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="Enter event name" className="form-control" data-testid="input-event-name" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="col-12">
                      <FormField
                        control={form.control}
                        name="description"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Description</FormLabel>
                            <FormControl>
                              <ReactQuill 
                                theme="snow" 
                                value={field.value || ''} 
                                onChange={field.onChange}
                                placeholder="Describe your event..."
                                className="bg-white"
                                data-testid="input-description"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="col-12">
                      <label className="form-label">Venue Location</label>
                      <div className="row g-2">
                        <div className="col-12">
                          <input
                            type="text"
                            className="form-control"
                            placeholder="Street Address"
                            value={address}
                            onChange={(e) => setAddress(e.target.value)}
                            data-testid="input-address"
                          />
                        </div>
                        <div className="col-md-6">
                          <input
                            type="text"
                            className="form-control"
                            placeholder="City"
                            value={city}
                            onChange={(e) => setCity(e.target.value)}
                            data-testid="input-city"
                          />
                        </div>
                        <div className="col-md-6">
                          <select
                            className="form-control"
                            value={country}
                            onChange={(e) => setCountry(e.target.value)}
                            data-testid="input-country"
                          >
                            <option value="">Select Country</option>
                            {countries.map((countryName) => (
                              <option key={countryName} value={countryName}>
                                {countryName}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                      {!address && !city && !country && (
                        <div className="text-danger small mt-1">Please enter at least one location field</div>
                      )}
                    </div>

                    <div className="col-md-6">
                      <FormField
                        control={form.control}
                        name="date"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Starts on</FormLabel>
                            <FormControl>
                              <Input 
                                {...field} 
                                type="date" 
                                className="form-control" 
                                min={minDate}
                                max={maxDate}
                                data-testid="input-date"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="col-md-6">
                      <FormField
                        control={form.control}
                        name="time"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Start Time</FormLabel>
                            <FormControl>
                              <Input {...field} type="time" className="form-control" data-testid="input-time" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="col-md-6">
                      <FormField
                        control={form.control}
                        name="endDate"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Ends on (Optional)</FormLabel>
                            <FormControl>
                              <Input 
                                {...field}
                                value={field.value || ''}  
                                type="date" 
                                className="form-control"
                                min={form.watch('date') || minDate}
                                max={maxDate}
                                data-testid="input-end-date"
                              />
                            </FormControl>
                            <div className="form-text">For multi-day events</div>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="col-md-6">
                      <FormField
                        control={form.control}
                        name="endTime"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>End Time (Optional)</FormLabel>
                            <FormControl>
                              <Input {...field} value={field.value || ''} type="time" className="form-control" data-testid="input-end-time" />
                            </FormControl>
                            <div className="form-text">When the event ends</div>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    {/* Tickets & Pricing Section - Own Row */}
                    <div className="col-12">
                      <div className="border rounded p-3 bg-light">
                        <h6 className="mb-3">Tickets & Pricing</h6>
                        <div className="row">
                          <div className="col-md-6">
                            <FormField
                              control={form.control}
                              name="ticketPrice"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Ticket Price ($)</FormLabel>
                                  <FormControl>
                                    <Input {...field} type="number" step="0.01" min="0" placeholder="0.00" className="form-control" data-testid="input-price" />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            
                            <FormField
                              control={form.control}
                              name="surgePricing"
                              render={({ field }) => (
                                <FormItem className="mt-3">
                                  <div className="form-check">
                                    <FormControl>
                                      <input
                                        type="checkbox"
                                        checked={field.value}
                                        onChange={field.onChange}
                                        className="form-check-input"
                                        id="surgePricingCheck"
                                        data-testid="checkbox-surge-pricing"
                                      />
                                    </FormControl>
                                    <label className="form-check-label" htmlFor="surgePricingCheck">
                                      <strong>Enable Surge Pricing</strong>
                                      <div className="text-muted small">
                                        Prices increase with demand. Base price must be at least $1.00.
                                      </div>
                                    </label>
                                  </div>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                          
                          <div className="col-md-6">
                            <FormField
                              control={form.control}
                              name="maxTickets"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Maximum Tickets</FormLabel>
                                  <FormControl>
                                    <Input 
                                      {...field} 
                                      type="number"
                                      min="5"
                                      max="5000"
                                      placeholder="100" 
                                      className="form-control" 
                                      data-testid="input-max-tickets"
                                      value={field.value || ''}
                                      onChange={(e) => {
                                        const value = e.target.value;
                                        if (value === '') {
                                          field.onChange(100);
                                        } else {
                                          const numValue = parseInt(value);
                                          if (numValue > 5000) {
                                            field.onChange(5000);
                                          } else if (numValue < 5) {
                                            field.onChange(5);
                                          } else {
                                            field.onChange(numValue);
                                          }
                                        }
                                      }}
                                    />
                                  </FormControl>
                                  <div className="form-text">Minimum 5, maximum 5,000 tickets. Default is 100.</div>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="col-md-6">
                      <FormField
                        control={form.control}
                        name="earlyValidation"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Early Validation</FormLabel>
                            <FormControl>
                              <select 
                                {...field} 
                                className="form-control"
                                data-testid="select-early-validation"
                              >
                                <option value="Allow at Anytime">Allow at Anytime</option>
                                <option value="No Early Validation">No Early Validation</option>
                                <option value="30 Minutes Before">30 Minutes Before</option>
                                <option value="1 Hour Before">1 Hour Before</option>
                                <option value="2 Hours Before">2 Hours Before</option>
                              </select>
                            </FormControl>
                            <div className="form-text">When attendees can validate their tickets</div>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="col-md-6">
                      <FormField
                        control={form.control}
                        name="reentryType"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Ticket Type</FormLabel>
                            <FormControl>
                              <select 
                                {...field} 
                                className="form-control"
                                data-testid="select-reentry-type"
                              >
                                <option value="No Reentry (Single Use)">No Reentry (Single Use)</option>
                                <option value="Pass (Multiple Use)">Pass (Multiple Use)</option>
                              </select>
                            </FormControl>
                            <div className="form-text">Single use tickets or multi-use passes</div>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    {form.watch('reentryType') === 'Pass (Multiple Use)' && (
                      <div className="col-12">
                        <FormField
                          control={form.control}
                          name="maxUses"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Number of Uses</FormLabel>
                              <FormControl>
                                <Input 
                                  {...field} 
                                  type="number"
                                  min="2"
                                  max="24"
                                  placeholder="Number of uses (2-24)"
                                  className="form-control"
                                  data-testid="input-max-uses"
                                  value={field.value || 2}
                                  onChange={(e) => {
                                    const value = parseInt(e.target.value) || 2;
                                    if (value < 2) {
                                      field.onChange(2);
                                    } else if (value > 24) {
                                      field.onChange(24);
                                    } else {
                                      field.onChange(value);
                                    }
                                  }}
                                />
                              </FormControl>
                              <div className="form-text">How many times the ticket can be used (minimum 2, maximum 24)</div>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    )}

                    {/* Additional Event Options */}
                    <div className="col-12">
                      <div className="border rounded p-3 bg-light">
                        <h6 className="mb-3">Additional Options</h6>
                        
                        {/* Private Event Setting - moved to top */}
                        <FormField
                          control={form.control}
                          name="isPrivate"
                          render={({ field }) => (
                            <FormItem>
                              <div className="form-check">
                                <input
                                  type="checkbox"
                                  className="form-check-input"
                                  id="isPrivate"
                                  checked={field.value}
                                  onChange={(e) => field.onChange(e.target.checked)}
                                  data-testid="checkbox-is-private"
                                />
                                <label className="form-check-label" htmlFor="isPrivate">
                                  <span className="badge bg-secondary me-2">🔒</span>
                                  Private Event
                                </label>
                              </div>
                              <div className="form-text">Private events won't appear in search results or be featured. Only accessible via direct link.</div>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={form.control}
                          name="oneTicketPerUser"
                          render={({ field }) => (
                            <FormItem className="mt-3">
                              <div className="form-check">
                                <input
                                  type="checkbox"
                                  className="form-check-input"
                                  id="oneTicketPerUser"
                                  checked={field.value}
                                  onChange={(e) => field.onChange(e.target.checked)}
                                  data-testid="checkbox-one-ticket-per-user"
                                />
                                <label className="form-check-label" htmlFor="oneTicketPerUser">
                                  <span className="badge bg-info text-white me-2">👤</span>
                                  Limit to One Ticket Per User
                                </label>
                              </div>
                              <div className="form-text">Prevent scalping by restricting users to purchasing only one ticket (tracks by email and IP)</div>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={form.control}
                          name="raffleEnabled"
                          render={({ field }) => (
                            <FormItem className="mt-3">
                              <div className="form-check">
                                <input
                                  type="checkbox"
                                  className="form-check-input"
                                  id="raffleEnabled"
                                  checked={field.value || false}
                                  onChange={(e) => field.onChange(e.target.checked)}
                                  data-testid="checkbox-raffle-enabled"
                                />
                                <label className="form-check-label" htmlFor="raffleEnabled">
                                  <span className="badge bg-success text-white me-2">🎁</span>
                                  Enable Raffle Feature
                                </label>
                              </div>
                              <div className="form-text">Allow event owners to randomly select winners from ticket holders (cannot be disabled once activated)</div>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>

                    {/* Special Features Section */}
                    <div className="col-12">
                      <div className="border rounded p-3 bg-light">
                        <h6 className="mb-3">Special Features</h6>
                        <FormField
                          control={form.control}
                          name="goldenTicketEnabled"
                          render={({ field }) => (
                            <FormItem className="mb-3">
                              <div className="form-check">
                                <input
                                  type="checkbox"
                                  className="form-check-input"
                                  id="goldenTicketEnabled"
                                  checked={field.value}
                                  onChange={(e) => field.onChange(e.target.checked)}
                                  data-testid="checkbox-golden-ticket"
                                />
                                <label className="form-check-label" htmlFor="goldenTicketEnabled">
                                  <span className="badge bg-warning text-dark me-2">🎫</span>
                                  Enable Golden Ticket Contest
                                </label>
                              </div>
                              <div className="form-text">A random ticket will win based on validation timing</div>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        {form.watch('goldenTicketEnabled') && (
                          <FormField
                            control={form.control}
                            name="goldenTicketCount"
                            render={({ field }) => (
                              <FormItem className="mb-3">
                                <FormLabel>Golden Ticket Count (1-100)</FormLabel>
                                <FormControl>
                                  <Input
                                    {...field}
                                    type="number"
                                    min="1"
                                    max="100"
                                    placeholder="Enter number of golden tickets"
                                    className="form-control"
                                    data-testid="input-golden-number"
                                    value={field.value || ''}
                                    onChange={(e) => {
                                      const value = parseInt(e.target.value);
                                      const maxTickets = form.getValues('maxTickets');
                                      const maxGoldenTickets = maxTickets ? Math.floor(maxTickets / 2) : 100;
                                      
                                      if (isNaN(value)) {
                                        field.onChange(undefined);
                                      } else if (value < 1) {
                                        field.onChange(1);
                                      } else if (value > maxGoldenTickets) {
                                        field.onChange(maxGoldenTickets);
                                      } else {
                                        field.onChange(value);
                                      }
                                    }}
                                  />
                                </FormControl>
                                <div className="form-text">
                                  Maximum number of golden tickets that can be won for this event
                                  {form.watch('maxTickets') && (
                                    <span className="text-muted"> (limit: {Math.floor((form.watch('maxTickets') || 0) / 2)} - half of total tickets)</span>
                                  )}
                                </div>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        )}

                        <FormField
                          control={form.control}
                          name="specialEffectsEnabled"
                          render={({ field }) => (
                            <FormItem>
                              <div className="form-check">
                                <input
                                  type="checkbox"
                                  className="form-check-input"
                                  id="specialEffectsEnabled"
                                  checked={field.value || false}
                                  onChange={(e) => field.onChange(e.target.checked)}
                                  data-testid="checkbox-special-effects"
                                />
                                <label className="form-check-label" htmlFor="specialEffectsEnabled">
                                  <span className="badge bg-primary me-2">✨</span>
                                  Enable Special Effects
                                </label>
                              </div>
                              <div className="form-text">Validated tickets may display special visual effects on holidays and themed events</div>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        {/* Allow Minting - moved to bottom */}
                        <FormField
                          control={form.control}
                          name="allowMinting"
                          render={({ field }) => (
                            <FormItem className="mt-3">
                              <div className="form-check">
                                <input
                                  type="checkbox"
                                  className="form-check-input"
                                  id="allowMinting"
                                  checked={field.value}
                                  onChange={(e) => field.onChange(e.target.checked)}
                                  data-testid="checkbox-allow-minting"
                                />
                                <label className="form-check-label" htmlFor="allowMinting">
                                  <span className="badge bg-info text-dark me-2">🎨</span>
                                  Allow Minting
                                </label>
                              </div>
                              <div className="form-text">Attendees will be allowed to mint a digital collectible of the event ticket. Some details of the ticket can be listed publicly if this is enabled.</div>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>

                    <div className="col-12">
                      <div className="mb-4">
                        <label className="form-label">
                          <Image size={18} className="me-2" />
                          Feature Image
                        </label>
                        <ObjectUploader
                          onGetUploadParameters={handleImageUpload}
                          onComplete={(result) => handleImageComplete(result)}
                          buttonClassName="btn btn-outline-primary"
                          currentImageUrl={imageUrl}
                          showPreview={true}
                        >
                          <Image size={18} className="me-2" />
                          Choose Image
                        </ObjectUploader>
                      </div>
                    </div>

                    <div className="col-12">
                      <div className="mb-4">
                        <label className="form-label">
                          <CreditCard size={18} className="me-2" />
                          Ticket Preview
                        </label>
                        <p className="text-muted small mb-3">
                          This is how your event tickets will appear to attendees. The featured image will be used as the ticket background.
                        </p>
                        
                        {/* Ticket Preview */}
                        <div className="mb-3">
                          <div className="bg-light rounded p-4" style={{ backgroundColor: '#f8f9fa' }}>
                            <div className="mx-auto" style={{ maxWidth: '400px' }}>
                              <TicketCard
                                ticket={sampleTicket}
                                event={previewEvent}
                                showQR={false}
                              />
                            </div>
                            <p className="text-center text-muted small mt-3 mb-0">
                              <i className="bi bi-info-circle me-1"></i>
                              {imageUrl ? "Your featured image is being used as the ticket background" : "Upload a featured image to customize the ticket background"}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="col-12">
                      <div className="d-flex gap-2">
                        <button
                          type="submit"
                          className="btn btn-primary"
                          disabled={createEventMutation.isPending}
                          data-testid="button-create-event"
                        >
                          {createEventMutation.isPending ? "Creating..." : "Create Event"}
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={() => setLocation("/events")}
                          data-testid="button-cancel"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                </form>
              </Form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}