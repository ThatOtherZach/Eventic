import { useState, useEffect } from "react";
import { useLocation, useParams } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertEventSchema, type InsertEvent, type Event, type Ticket } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useNotifications } from "@/hooks/use-notifications";
import { ObjectUploader } from "@/components/ObjectUploader";
import { TicketCard } from "@/components/tickets/ticket-card";
import { ArrowLeft, ArrowRight, CreditCard, Image } from "lucide-react";
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

interface EventWithTicketInfo extends Event {
  ticketsSold?: number;
  ticketsAvailable?: number | null;
}

export default function EventForm() {
  const { id } = useParams<{ id?: string }>();
  const { toast } = useToast();
  const { user } = useAuth();
  const { addNotification } = useNotifications();
  const [, setLocation] = useLocation();
  const [imageUrl, setImageUrl] = useState<string>("");
  const [stickerEnabled, setStickerEnabled] = useState(false);
  const [ticketsSold, setTicketsSold] = useState(0);
  const isEditMode = !!id;
  const isAdmin = user?.email?.endsWith("@saymservices.com") || false;
  
  // Address component states
  const [address, setAddress] = useState<string>("");
  const [city, setCity] = useState<string>("");
  const [country, setCountry] = useState<string>("");
  
  // State for cycling through special effects preview
  const [previewEffectIndex, setPreviewEffectIndex] = useState(0);
  
  // Get current month name for monthly effect
  const currentMonthName = new Date().toLocaleDateString('en-US', { month: 'long' });
  
  const availableEffects: Array<{type: string, name: string}> = [
    { type: 'monthly', name: currentMonthName + ' Color' },
    { type: 'snowflakes', name: 'Christmas (Dec. 25 Only)' },
    { type: 'confetti', name: 'Confetti (Party Events)' },
    { type: 'fireworks', name: 'New Year\'s (Dec. 31 Only)' },
    { type: 'hearts', name: 'Valentine\'s (Feb. 14 Only)' },
    { type: 'spooky', name: 'Halloween (Oct. 31 Only)' },
    { type: 'pride', name: 'Pride (June + Keywords)' },
    { type: 'nice', name: 'Nice Day (Mar. 10 Only)' },
    { type: 'rainbow', name: 'Super RGB (Rare)' },
  ];
  
  // Calculate min and max dates for event creation
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const minDate = tomorrow.toISOString().split('T')[0];
  
  const fiveYearsFromNow = new Date();
  fiveYearsFromNow.setFullYear(fiveYearsFromNow.getFullYear() + 5);
  const maxDate = fiveYearsFromNow.toISOString().split('T')[0];
  
  // Load existing event if in edit mode
  const { data: event, isLoading } = useQuery<EventWithTicketInfo>({
    queryKey: [`/api/events/${id}`],
    enabled: isEditMode && !!id,
  });

  const form = useForm<InsertEvent>({
    resolver: zodResolver(insertEventSchema),
    defaultValues: {
      name: "",
      description: "",
      contactDetails: "",
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
      stickerUrl: "",
      stickerOdds: 25,
      allowMinting: false,
      isPrivate: false,
      oneTicketPerUser: false,
      surgePricing: false,
      p2pValidation: false,
      enableVoting: false,
      recurringType: null,
      recurringEndDate: null,
      ticketPurchasesEnabled: true,
      timezone: "America/New_York",
    },
  });
  
  // Load event data into form when in edit mode
  useEffect(() => {
    if (event && isEditMode) {
      // Check ownership
      if (user && event.userId !== user.id) {
        toast({
          title: "Access Denied",
          description: "You can only edit your own events",
          variant: "destructive",
        });
        setLocation(`/events/${id}`);
        return;
      }

      // Parse venue string to populate address fields
      if (event.venue) {
        const venueParts = event.venue.split(',').map(part => part.trim());
        if (venueParts.length === 3) {
          setAddress(venueParts[0]);
          setCity(venueParts[1]);
          setCountry(venueParts[2]);
        } else if (venueParts.length === 2) {
          setCity(venueParts[0]);
          setCountry(venueParts[1]);
        } else {
          setAddress(event.venue);
        }
      }
      
      // Reset form with event data
      form.reset({
        name: event.name || "",
        description: event.description || "",
        contactDetails: event.contactDetails || "",
        venue: event.venue || "",
        date: event.date || "",
        time: event.time || "",
        endDate: event.endDate || "",
        endTime: event.endTime || "",
        ticketPrice: event.ticketPrice || "0",
        maxTickets: event.maxTickets || 100,
        imageUrl: event.imageUrl || undefined,
        ticketBackgroundUrl: event.ticketBackgroundUrl || undefined,
        earlyValidation: (event.earlyValidation || "Allow at Anytime") as "Allow at Anytime" | "One Hour Before" | "Two Hours Before" | "At Start Time" | undefined,
        reentryType: (event.reentryType || "No Reentry (Single Use)") as "No Reentry (Single Use)" | "Pass (Multiple Use)" | "No Limit" | undefined,
        maxUses: event.maxUses || 1,
        goldenTicketEnabled: event.goldenTicketEnabled || false,
        goldenTicketCount: event.goldenTicketCount || undefined,
        specialEffectsEnabled: event.specialEffectsEnabled || false,
        stickerUrl: event.stickerUrl || "",
        stickerOdds: event.stickerOdds || 25,
        allowMinting: event.allowMinting || false,
        isPrivate: event.isPrivate || false,
        oneTicketPerUser: event.oneTicketPerUser || false,
        surgePricing: event.surgePricing || false,
        p2pValidation: event.p2pValidation || false,
        enableVoting: event.enableVoting || false,
        recurringType: (event.recurringType as "weekly" | "monthly" | "annual" | null) || null,
        recurringEndDate: event.recurringEndDate || null,
        ticketPurchasesEnabled: event.ticketPurchasesEnabled !== false,
        timezone: event.timezone || "America/New_York",
      });
      
      setImageUrl(event.imageUrl || "");
      setStickerEnabled(!!event.stickerUrl);
      setTicketsSold(event.ticketsSold || 0);
    }
  }, [event, isEditMode, user, toast, setLocation, id, form]);

  // Update venue field when address components change
  useEffect(() => {
    const venueString = [address, city, country]
      .filter(Boolean)
      .join(', ');
    // Always set venue value, even if empty to trigger validation
    form.setValue('venue', venueString || '', { shouldValidate: true });
  }, [address, city, country, form]);

  // When ticket sales are disabled, automatically set event to private
  useEffect(() => {
    const subscription = form.watch((value, { name }) => {
      if (name === 'ticketPurchasesEnabled' && value.ticketPurchasesEnabled === false) {
        form.setValue('isPrivate', true);
      }
    });
    return () => subscription.unsubscribe();
  }, [form]);

  const createEventMutation = useMutation({
    mutationFn: async (data: InsertEvent) => {
      const response = await apiRequest("POST", "/api/events", data);
      return response.json();
    },
    onSuccess: async (event) => {
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      // Use notification instead of toast for success
      await addNotification({
        type: "success",
        title: "Event Created!",
        message: `Your event "${event.name}" has been created successfully.`,
        relatedEventId: event.id,
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
  
  const updateEventMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("PUT", `/api/events/${id}`, data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Event updated successfully",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/events/${id}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
      setLocation(`/events/${id}`);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update event",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: InsertEvent) => {
    // Venue is already set by the useEffect hook, just validate it exists
    if (!data.venue || data.venue.trim() === '') {
      toast({
        title: "Validation Error",
        description: "Please enter at least one venue location field",
        variant: "destructive",
      });
      return;
    }
    
    // Only validate dates for new events (not in edit mode)
    if (!isEditMode) {
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
    
    // Validate surge pricing minimum ticket price
    if (data.surgePricing) {
      const ticketPrice = parseFloat(data.ticketPrice || '0');
      if (ticketPrice < 1.00) {
        form.setError('ticketPrice', {
          type: 'manual',
          message: 'Ticket price must be at least $1.00 for surge pricing'
        });
        return;
      }
    }

    // Ensure maxTickets has a default value of 100 if not set
    const submitData = {
      ...data,
      maxTickets: data.maxTickets || 100,
      endDate: data.endDate && data.endDate !== '' ? data.endDate : null,
      endTime: data.endTime && data.endTime !== '' ? data.endTime : null,
      imageUrl: imageUrl || undefined,
      ticketBackgroundUrl: imageUrl || undefined, // Use featured image for ticket background
      stickerUrl: (stickerEnabled && data.stickerUrl) ? data.stickerUrl : undefined,
      stickerOdds: (stickerEnabled && data.stickerUrl) ? (data.stickerOdds || 25) : undefined,
      timezone: data.timezone || "America/New_York",
    };

    // If in edit mode, perform update with proper validation
    if (isEditMode) {
      // Validate max tickets against tickets sold
      if (data.maxTickets && ticketsSold > 0) {
        const maxTicketValue = data.maxTickets;
        if (maxTicketValue < ticketsSold) {
          toast({
            title: "Invalid ticket limit",
            description: `Cannot set maximum tickets below ${ticketsSold} (tickets already sold)`,
            variant: "destructive",
          });
          return;
        }
      }
      
      // Prepare update data with only the necessary fields
      const updateData = {
        name: data.name,
        description: data.description || null,
        contactDetails: data.contactDetails || null,
        venue: data.venue,
        date: data.date,
        time: data.time,
        endDate: data.endDate && data.endDate !== '' ? data.endDate : null,
        endTime: data.endTime && data.endTime !== '' ? data.endTime : null,
        ticketPrice: data.ticketPrice,
        maxTickets: data.maxTickets || undefined,
        imageUrl: imageUrl || undefined,
        ticketBackgroundUrl: imageUrl || undefined,
        stickerUrl: (stickerEnabled && data.stickerUrl) ? data.stickerUrl : event?.stickerUrl || undefined,
        stickerOdds: (stickerEnabled && data.stickerUrl) ? (data.stickerOdds || 25) : event?.stickerOdds || undefined,
        timezone: data.timezone || "America/New_York",
      };
      
      updateEventMutation.mutate(updateData);
    } else {
      createEventMutation.mutate(submitData);
    }
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
    }
  };




  // Create a sample ticket for preview
  const goldenTicketEnabled = form.watch('goldenTicketEnabled');
  const specialEffectsEnabled = form.watch('specialEffectsEnabled');
  
  // Determine what effect to show
  let currentEffect = specialEffectsEnabled ? availableEffects[previewEffectIndex]?.type : undefined;
  // Golden ticket shows independently of stickers
  let isGolden = goldenTicketEnabled && !specialEffectsEnabled;
  let isDoubleGolden = currentEffect === 'rainbow';
  
  const sampleTicket: Ticket & { previewEffectType?: string } = {
    id: "sample",
    eventId: "sample",
    userId: user?.id || "",
    ticketNumber: "PREVIEW-001",
    qrData: "sample-qr-data", // Need QR data to show QR code in preview
    isValidated: specialEffectsEnabled || (stickerEnabled && !!form.watch('stickerUrl')), // Mark as validated for preview when special effects or sticker enabled
    validatedAt: null,
    validationCode: null,
    useCount: 0,
    isGoldenTicket: isGolden, // Apply golden ticket when enabled and no other effect
    isDoubleGolden: isDoubleGolden, // Show double golden for rainbow effect
    specialEffect: currentEffect || (stickerEnabled && form.watch('stickerUrl') ? 'sticker' : null),
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
    // Add preview effect type for special effects preview
    previewEffectType: currentEffect,
    // Add sticker URL for overlay on any effect
    previewStickerUrl: (stickerEnabled && form.watch('stickerUrl')) ? form.watch('stickerUrl') : undefined,
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
    contactDetails: watchedValues.contactDetails || null,
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
    stickerUrl: (stickerEnabled && form.watch('stickerUrl')) ? (form.watch('stickerUrl') || null) : null,
    stickerOdds: watchedValues.stickerOdds || 25,
    allowMinting: watchedValues.allowMinting || false,
    isPrivate: watchedValues.isPrivate || false,
    isEnabled: true,
    ticketPurchasesEnabled: true,
    oneTicketPerUser: watchedValues.oneTicketPerUser || false,
    surgePricing: watchedValues.surgePricing || false,
    p2pValidation: watchedValues.p2pValidation || false,
    enableVoting: watchedValues.enableVoting || false,
    recurringType: watchedValues.recurringType || null,
    recurringEndDate: watchedValues.recurringEndDate || null,
    parentEventId: null,
    lastRecurrenceCreated: null,
    timezone: watchedValues.timezone || "America/New_York",
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
            <h1 className="h2 mb-0">{isEditMode ? 'Edit Event' : 'Create New Event'}</h1>
          </div>

          <div className="card">
            <div className="card-body">
              <div className="text-muted small mb-3">
                <span className="text-danger">*</span> Required fields
              </div>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)}>
                  <div className="row g-3">
                    <div className="col-12">
                      <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Event Name <span className="text-danger">*</span></FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="Enter event name" className="form-control" data-testid="input-event-name" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="col-12">
                      <div className="mb-4">
                        <label className="form-label">
                          <Image size={18} className="me-2" />
                          Featured Image
                        </label>
                        <div className="form-text mb-2">Maximum file size: 5MB. Accepted formats: JPEG, JPG, PNG, GIF</div>
                        <ObjectUploader
                          onGetUploadParameters={handleImageUpload}
                          onComplete={(result) => handleImageComplete(result)}
                          buttonClassName="btn btn-secondary"
                          currentImageUrl={imageUrl}
                          showPreview={true}
                          accept="image/jpeg,image/jpg,image/png,image/gif"
                          maxFileSize={5 * 1024 * 1024}
                        >
                          <Image size={18} className="me-2" />
                          Choose Image
                        </ObjectUploader>
                      </div>
                    </div>

                    <div className="col-12">
                      <FormField
                        control={form.control}
                        name="contactDetails"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Contact Details</FormLabel>
                            <FormControl>
                              <Input 
                                {...field} 
                                placeholder="email, phone, secret handshake, etc."
                                className="form-control" 
                                maxLength={150}
                                data-testid="input-contact-details"
                              />
                            </FormControl>
                            <FormDescription>
                              Not public, revealed only to ticket holders.
                            </FormDescription>
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
                      <FormField
                        control={form.control}
                        name="venue"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-dark">Venue Location <span className="text-danger">*</span></FormLabel>
                            <input type="hidden" {...field} />
                            <div className="row g-2">
                              <div className="col-12">
                                <input
                                  type="text"
                                  className="form-control"
                                  placeholder="Street Address, GPS Coordinates, Online, etc."
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
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="col-md-6">
                      <FormField
                        control={form.control}
                        name="date"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Starts on <span className="text-danger">*</span></FormLabel>
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
                            <FormLabel>Start Time <span className="text-danger">*</span></FormLabel>
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
                            <FormLabel>Ends on</FormLabel>
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
                            <FormLabel>End Time</FormLabel>
                            <FormControl>
                              <Input {...field} value={field.value || ''} type="time" className="form-control" data-testid="input-end-time" />
                            </FormControl>
                            <div className="form-text">When the event ends</div>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="col-md-6">
                      <FormField
                        control={form.control}
                        name="timezone"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Timezone</FormLabel>
                            <FormControl>
                              <select 
                                className="form-select" 
                                data-testid="select-timezone"
                                value={field.value || "America/New_York"}
                                onChange={(e) => field.onChange(e.target.value)}
                              >
                                <optgroup label="US & Canada">
                                  <option value="America/New_York">Eastern Time (ET)</option>
                                  <option value="America/Chicago">Central Time (CT)</option>
                                  <option value="America/Denver">Mountain Time (MT)</option>
                                  <option value="America/Phoenix">Arizona Time (MST)</option>
                                  <option value="America/Los_Angeles">Pacific Time (PT)</option>
                                  <option value="America/Anchorage">Alaska Time (AKT)</option>
                                  <option value="Pacific/Honolulu">Hawaii Time (HST)</option>
                                </optgroup>
                                <optgroup label="Europe">
                                  <option value="Europe/London">London (GMT/BST)</option>
                                  <option value="Europe/Paris">Paris (CET)</option>
                                  <option value="Europe/Berlin">Berlin (CET)</option>
                                  <option value="Europe/Moscow">Moscow (MSK)</option>
                                </optgroup>
                                <optgroup label="Asia">
                                  <option value="Asia/Tokyo">Tokyo (JST)</option>
                                  <option value="Asia/Shanghai">Shanghai (CST)</option>
                                  <option value="Asia/Hong_Kong">Hong Kong (HKT)</option>
                                  <option value="Asia/Singapore">Singapore (SGT)</option>
                                  <option value="Asia/Dubai">Dubai (GST)</option>
                                  <option value="Asia/Kolkata">India (IST)</option>
                                </optgroup>
                                <optgroup label="Australia & Pacific">
                                  <option value="Australia/Sydney">Sydney (AEDT)</option>
                                  <option value="Australia/Melbourne">Melbourne (AEDT)</option>
                                  <option value="Pacific/Auckland">Auckland (NZDT)</option>
                                </optgroup>
                                <optgroup label="Other">
                                  <option value="UTC">UTC</option>
                                </optgroup>
                              </select>
                            </FormControl>
                            <div className="form-text">Event times will be displayed in this timezone</div>
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
                                    <Input 
                                      {...field} 
                                      type="number" 
                                      step="0.01" 
                                      min="0" 
                                      placeholder="0.00" 
                                      className="form-control" 
                                      data-testid="input-price"
                                      onChange={(e) => {
                                        field.onChange(e);
                                        // Clear surge pricing error if price meets requirement
                                        const surgePricing = form.getValues('surgePricing');
                                        if (surgePricing) {
                                          const ticketPrice = parseFloat(e.target.value || '0');
                                          if (ticketPrice >= 1.00) {
                                            form.clearErrors('ticketPrice');
                                          } else {
                                            form.setError('ticketPrice', {
                                              type: 'manual',
                                              message: 'Ticket price must be at least $1.00 for surge pricing'
                                            });
                                          }
                                        }
                                      }}
                                    />
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
                                        onChange={(e) => {
                                          field.onChange(e);
                                          // Validate ticket price when enabling surge pricing
                                          if (e.target.checked) {
                                            const ticketPrice = parseFloat(form.getValues('ticketPrice') || '0');
                                            if (ticketPrice < 1.00) {
                                              form.setError('ticketPrice', {
                                                type: 'manual',
                                                message: 'Ticket price must be at least $1.00 for surge pricing'
                                              });
                                            }
                                          } else {
                                            // Clear the error when disabling surge pricing
                                            form.clearErrors('ticketPrice');
                                          }
                                        }}
                                        className="form-check-input"
                                        id="surgePricingCheck"
                                        data-testid="checkbox-surge-pricing"
                                      />
                                    </FormControl>
                                    <label className="form-check-label" htmlFor="surgePricingCheck">
                                      <strong>Surge Pricing</strong>
                                      <div className="text-muted small">
                                        Ticket prices increase with demand. Minimum $1.00 ticket price.
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
                        
                        {/* Admin-only Disable Ticket Sales checkbox */}
                        {isAdmin && (
                          <div className="row mt-3">
                            <div className="col-12">
                              <FormField
                                control={form.control}
                                name="ticketPurchasesEnabled"
                                render={({ field }) => (
                                  <FormItem>
                                    <div className="form-check">
                                      <input
                                        type="checkbox"
                                        className="form-check-input"
                                        id="ticketPurchasesEnabled"
                                        checked={!field.value}
                                        onChange={(e) => field.onChange(!e.target.checked)}
                                        data-testid="checkbox-disable-ticket-sales"
                                      />
                                      <label className="form-check-label" htmlFor="ticketPurchasesEnabled">
                                        <span className="badge bg-danger me-2">⚠️</span>
                                        Suspend Event
                                      </label>
                                    </div>
                                    <div className="form-text">Suspend this event from public view and stop new ticket sales. Existing ticket holders can still access and resell tickets. Admin moderation tool.</div>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                            </div>
                          </div>
                        )}
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

                    {/* Repeat Section - Admin Only */}
                    {user?.email?.endsWith("@saymservices.com") && (
                      <div className="col-12">
                        <div className="border rounded p-3 bg-light">
                          <h6 className="mb-3">Repeat</h6>
                          <FormField
                            control={form.control}
                            name="recurringType"
                            render={({ field }) => (
                              <FormItem>
                                <div className="d-flex gap-3">
                                  <div className="form-check">
                                    <input
                                      type="radio"
                                      className="form-check-input"
                                      id="recurring-none"
                                      name="recurringType"
                                      checked={!field.value}
                                      onChange={() => field.onChange(null)}
                                      data-testid="radio-recurring-none"
                                    />
                                    <label className="form-check-label" htmlFor="recurring-none">
                                      None
                                    </label>
                                  </div>
                                  <div className="form-check">
                                    <input
                                      type="radio"
                                      className="form-check-input"
                                      id="recurring-weekly"
                                      name="recurringType"
                                      value="weekly"
                                      checked={field.value === "weekly"}
                                      onChange={() => field.onChange("weekly")}
                                      data-testid="radio-recurring-weekly"
                                    />
                                    <label className="form-check-label" htmlFor="recurring-weekly">
                                      Weekly
                                    </label>
                                  </div>
                                  <div className="form-check">
                                    <input
                                      type="radio"
                                      className="form-check-input"
                                      id="recurring-monthly"
                                      name="recurringType"
                                      value="monthly"
                                      checked={field.value === "monthly"}
                                      onChange={() => field.onChange("monthly")}
                                      data-testid="radio-recurring-monthly"
                                    />
                                    <label className="form-check-label" htmlFor="recurring-monthly">
                                      Monthly
                                    </label>
                                  </div>
                                  <div className="form-check">
                                    <input
                                      type="radio"
                                      className="form-check-input"
                                      id="recurring-annual"
                                      name="recurringType"
                                      value="annual"
                                      checked={field.value === "annual"}
                                      onChange={() => field.onChange("annual")}
                                      data-testid="radio-recurring-annual"
                                    />
                                    <label className="form-check-label" htmlFor="recurring-annual">
                                      Annual
                                    </label>
                                  </div>
                                </div>
                                <div className="form-text mt-2">
                                  When enabled, the event will automatically recreate after it has passed (minimum 7 days after start date).
                                </div>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          
                          {form.watch("recurringType") && (
                            <FormField
                              control={form.control}
                              name="recurringEndDate"
                              render={({ field }) => (
                                <FormItem className="mt-3">
                                  <FormLabel>Repeat Until</FormLabel>
                                  <FormControl>
                                    <Input 
                                      {...field} 
                                      type="date" 
                                      className="form-control" 
                                      min={minDate}
                                      max={(() => {
                                        const twoYearsFromNow = new Date();
                                        twoYearsFromNow.setFullYear(twoYearsFromNow.getFullYear() + 2);
                                        return twoYearsFromNow.toISOString().split('T')[0];
                                      })()}
                                      value={field.value || ""}
                                      data-testid="input-recurring-end-date"
                                    />
                                  </FormControl>
                                  <div className="form-text">
                                    The date to stop creating recurring events (maximum 2 years from event start date).
                                  </div>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          )}
                        </div>
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
                                  disabled={!form.watch("ticketPurchasesEnabled")}
                                  data-testid="checkbox-is-private"
                                />
                                <label className="form-check-label" htmlFor="isPrivate">
                                  <span className="badge bg-secondary me-2">🔒</span>
                                  Private Event
                                </label>
                              </div>
                              <div className="form-text">
                                Private events won't appear in search results or be featured. Only accessible via direct link.
                                {!form.watch("ticketPurchasesEnabled") && (
                                  <span className="text-warning"> <strong>Automatically enabled when event is suspended.</strong></span>
                                )}
                              </div>
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
                                  Limit Ticket Sales
                                </label>
                              </div>
                              <div className="form-text">Prevent scalping by restricting users to purchasing only one ticket.</div>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={form.control}
                          name="p2pValidation"
                          render={({ field }) => (
                            <FormItem className="mt-3">
                              <div className="form-check">
                                <input
                                  type="checkbox"
                                  className="form-check-input"
                                  id="p2pValidation"
                                  checked={field.value || false}
                                  onChange={(e) => field.onChange(e.target.checked)}
                                  data-testid="checkbox-p2p-validation"
                                  disabled={isEditMode} // Disable if editing existing event
                                />
                                <label className="form-check-label" htmlFor="p2pValidation">
                                  <span className="badge bg-primary me-2">🤝</span>
                                  P2P Validation
                                </label>
                              </div>
                              <div className="form-text">Allow any ticket holder the ability to validate other tickets{isEditMode ? " (This setting is read-only after event creation)" : ""}.</div>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        {/* Nested Enable Voting setting - only shown when P2P Validation is enabled */}
                        {form.watch("p2pValidation") && (
                          <FormField
                            control={form.control}
                            name="enableVoting"
                            render={({ field }) => (
                              <FormItem className="mt-3 ms-4">
                                <div className="form-check">
                                  <input
                                    type="checkbox"
                                    className="form-check-input"
                                    id="enableVoting"
                                    checked={field.value || false}
                                    onChange={(e) => field.onChange(e.target.checked)}
                                    data-testid="checkbox-enable-voting"
                                    disabled={isEditMode} // Disable if editing existing event
                                  />
                                  <label className="form-check-label" htmlFor="enableVoting">
                                    <span className="badge bg-warning text-dark me-2">🗳️</span>
                                    Enable Voting
                                  </label>
                                </div>
                                <div className="form-text">Tickets can collect votes! The most voted ticket becomes golden. Use the validator to vote/validate someones ticket.</div>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        )}
                        
                      </div>
                    </div>

                    {/* Ticket Preview Section */}
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
                            {/* Special Effects Preview Controls */}
                            {specialEffectsEnabled && (
                              <div className="d-flex justify-content-center align-items-center mt-3 gap-3">
                                <button
                                  type="button"
                                  className="btn btn-sm btn-outline-secondary"
                                  onClick={() => setPreviewEffectIndex((prev) => (prev - 1 + availableEffects.length) % availableEffects.length)}
                                  data-testid="button-prev-effect"
                                  title="Previous effect"
                                >
                                  <ArrowLeft size={16} />
                                </button>
                                <span className="text-muted small text-center" style={{ minWidth: '180px' }}>
                                  <strong>{availableEffects[previewEffectIndex]?.name}</strong>
                                </span>
                                <button
                                  type="button"
                                  className="btn btn-sm btn-outline-secondary"
                                  onClick={() => setPreviewEffectIndex((prev) => (prev + 1) % availableEffects.length)}
                                  data-testid="button-next-effect"
                                  title="Next effect"
                                >
                                  <ArrowRight size={16} />
                                </button>
                              </div>
                            )}
                            <p className="text-center text-muted small mt-3 mb-0">
                              <i className="bi bi-info-circle me-1"></i>
                              {imageUrl ? "Your featured image is being used as the ticket background" : "Upload a featured image to customize the ticket background"}
                            </p>
                          </div>
                        </div>
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
                                  Enable Golden Tickets
                                </label>
                              </div>
                              <div className="form-text">Random ticket(s) will be golden when validated.</div>
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
                                <FormLabel>Number of Golden Tickets</FormLabel>
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
                                    onKeyPress={(e) => {
                                      // Prevent non-numeric characters
                                      if (!/[0-9]/.test(e.key) && e.key !== 'Backspace' && e.key !== 'Delete') {
                                        e.preventDefault();
                                      }
                                    }}
                                    onChange={(e) => {
                                      // Only allow numbers
                                      const rawValue = e.target.value.replace(/[^0-9]/g, '');
                                      if (rawValue === '') {
                                        field.onChange(undefined);
                                        return;
                                      }
                                      
                                      const value = parseInt(rawValue);
                                      const maxTickets = form.getValues('maxTickets');
                                      const maxGoldenTickets = maxTickets ? Math.floor(maxTickets / 2) : 100;
                                      
                                      if (value < 1) {
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
                              <div className="form-text">Validated tickets may display special visual effects on holidays and themed events. These effects are randomly assigned, not all tickets will get an effect.</div>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        {/* Custom Sticker Checkbox */}
                        <div className="form-check mt-3">
                          <input
                            type="checkbox"
                            className="form-check-input"
                            id="stickerEnabled"
                            checked={stickerEnabled || !!form.watch('stickerUrl')}
                            onChange={(e) => {
                              if (!form.watch('stickerUrl')) {
                                setStickerEnabled(e.target.checked);
                              }
                            }}
                            disabled={isEditMode && !!event?.stickerUrl}
                            data-testid="checkbox-sticker-enabled"
                          />
                          <label className="form-check-label" htmlFor="stickerEnabled">
                            <span className="badge bg-success me-2">🎯</span>
                            Enable Custom Sticker
                          </label>
                        </div>
                        {isEditMode && event?.stickerUrl && (
                          <div className="form-text text-info">
                            <small>✓ Sticker configured. This feature cannot be removed once added.</small>
                          </div>
                        )}
                        {!form.watch('stickerUrl') && stickerEnabled && (
                          <div className="form-text">Enter a URL for a custom sticker that will float on lucky tickets</div>
                        )}

                        {/* Custom Sticker URL - shows when checkbox is checked */}
                        {(stickerEnabled || form.watch('stickerUrl')) && (
                          <div className="mt-3 p-3 border rounded bg-light">
                            <FormField
                              control={form.control}
                              name="stickerUrl"
                              render={({ field }) => (
                                <FormItem className="mb-3">
                                  <FormLabel>Sticker URL</FormLabel>
                                  <FormControl>
                                    <input
                                      type="url"
                                      className="form-control"
                                      placeholder="https://example.com/sticker.png"
                                      {...field}
                                      value={field.value || ''}
                                      disabled={isEditMode && !!event?.stickerUrl}
                                      data-testid="input-sticker-url"
                                    />
                                  </FormControl>
                                  <div className="form-text">
                                    Enter a direct URL to a PNG or GIF image (transparent PNGs work best)
                                  </div>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            
                            {form.watch('stickerUrl') && (
                              <div className="d-flex align-items-center gap-3 mb-3">
                                <img 
                                  src={form.watch('stickerUrl') || ''} 
                                  alt="Sticker preview" 
                                  style={{ maxHeight: '60px', maxWidth: '60px' }}
                                  onError={(e) => {
                                    (e.target as HTMLImageElement).style.display = 'none';
                                  }}
                                />
                                <span className="text-success small">✓ Sticker URL configured</span>
                              </div>
                            )}
                            
                            <FormField
                              control={form.control}
                              name="stickerOdds"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Sticker Odds (%)</FormLabel>
                                  <div className="d-flex align-items-center gap-3">
                                    <input
                                      type="number"
                                      className="form-control"
                                      style={{ width: '100px' }}
                                      min="1"
                                      max="100"
                                      value={field.value || 25}
                                      onChange={(e) => {
                                        const val = parseInt(e.target.value);
                                        if (val >= 1 && val <= 100) {
                                          field.onChange(val);
                                        }
                                      }}
                                      disabled={!form.watch('stickerUrl')}
                                      data-testid="input-sticker-odds"
                                    />
                                    <span className="text-muted">%</span>
                                  </div>
                                  <div className="form-text">
                                    Percentage of validated tickets that will display the custom sticker (1-100)
                                  </div>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                        )}
                        
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
                              <div className="form-text">Attendees will be allowed to mint a digital collectible of the event ticket. The details seen in the ticket preview will be publicly accessible if enabled. Digital collectible will be issued on the Coinbase L2 network (Base, Ethereum).</div>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>

                    <div className="col-12">
                      <div className="d-flex gap-2">
                        <button
                          type="submit"
                          className="btn btn-primary"
                          disabled={createEventMutation.isPending || updateEventMutation.isPending}
                          data-testid="button-save-event"
                        >
                          {(createEventMutation.isPending || updateEventMutation.isPending) ? "Saving..." : "Save"}
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