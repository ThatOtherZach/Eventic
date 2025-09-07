import { useState, useEffect } from "react";
import { useLocation, useParams } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  insertEventSchema,
  type InsertEvent,
  type Event,
  type Ticket,
} from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useNotifications } from "@/hooks/use-notifications";
import { ObjectUploader } from "@/components/ObjectUploader";
import { TicketCard } from "@/components/tickets/ticket-card";
import {
  ArrowLeft,
  ArrowRight,
  CreditCard,
  Image,
  Lock,
  Globe,
} from "lucide-react";
import ticketPreviewIcon from "@assets/image_1757235624831.png";
import goldenTicketIcon from "@assets/utopia_smiley_1757235878527.png";
import specialEffectsIcon from "@assets/display_properties-5_1757236054502.png";
import customStickerIcon from "@assets/wm-4_1757236109199.png";
import mintingIcon from "@assets/briefcase-4_1757236135278.png";
import { Textarea } from "@/components/ui/textarea";
import { countCharacters, extractHashtags } from "@/lib/text-formatter";
import { countries } from "@/lib/countries";
import { LocationPicker } from "@/components/location-picker";
import { Clock } from "lucide-react";
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface EventWithTicketInfo extends Event {
  ticketsSold?: number;
  ticketsAvailable?: number | null;
}

export default function EventForm() {
  const { id } = useParams<{ id?: string }>();
  const { toast } = useToast();
  const { user, isAdmin: checkIsAdmin } = useAuth();
  const { addNotification } = useNotifications();
  const [, setLocation] = useLocation();
  const [imageUrl, setImageUrl] = useState<string>("");
  const [stickerEnabled, setStickerEnabled] = useState(false);
  const [ticketsSold, setTicketsSold] = useState(0);
  const isEditMode = !!id;
  const isAdmin = checkIsAdmin();

  // Get user's credit balance
  const { data: userBalance } = useQuery<{ balance: string }>({
    queryKey: ["/api/currency/balance"],
    enabled: !!user,
  });

  const creditBalance = userBalance ? parseFloat(userBalance.balance) : 0;
  const maxTicketsAllowed = Math.min(creditBalance, 5000);

  // Address component states
  const [address, setAddress] = useState<string>("");
  const [city, setCity] = useState<string>("");
  const [country, setCountry] = useState<string>("");

  // GPS coordinates states
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);

  // State for cycling through special effects preview
  const [previewEffectIndex, setPreviewEffectIndex] = useState(0);

  // Get current month name for monthly effect
  const currentMonthName = new Date().toLocaleDateString("en-US", {
    month: "long",
  });

  const availableEffects: Array<{ type: string; name: string }> = [
    { type: "monthly", name: currentMonthName + " Color" },
    { type: "snowflakes", name: "Christmas (Dec. 25 Only)" },
    { type: "confetti", name: "Confetti (Party Events)" },
    { type: "fireworks", name: "New Year's (Dec. 31 Only)" },
    { type: "hearts", name: "Valentine's (Feb. 14 Only)" },
    { type: "spooky", name: "Halloween (Oct. 31 Only)" },
    { type: "pride", name: "Pride (June + Keywords)" },
    { type: "nice", name: "Nice Day (Mar. 10 Only)" },
    { type: "rainbow", name: "Super RGB (Rare)" },
  ];

  // Calculate min and max dates for event creation
  // Allow events to be created for today (will validate 3-hour rule on submit)
  const today = new Date();
  const minDate = today.toISOString().split("T")[0];

  const fiveYearsFromNow = new Date();
  fiveYearsFromNow.setFullYear(fiveYearsFromNow.getFullYear() + 5);
  const maxDate = fiveYearsFromNow.toISOString().split("T")[0];

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
      maxTickets: Math.min(creditBalance || 100, 5000),
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
      geofence: false,
      ticketPurchasesEnabled: true,
      timezone: "America/New_York",
      rollingTimezone: false,
      paymentProcessing: "None",
      walletAddress: "",
    },
  });

  // Update maxTickets default when user balance loads (for create mode)
  useEffect(() => {
    if (!isEditMode && userBalance && creditBalance > 0) {
      const currentValue = form.getValues("maxTickets");
      // Only update if it's still the default 100 or if balance is less than current value
      if (currentValue === 100 || currentValue > creditBalance) {
        form.setValue("maxTickets", Math.min(creditBalance, 5000));
      }
    }
  }, [userBalance, creditBalance, isEditMode, form]);

  // Generate Hunt code when Treasure Hunt is enabled
  useEffect(() => {
    const treasureHunt = form.watch("treasureHunt");
    const currentHuntCode = form.watch("huntCode");

    if (treasureHunt && !currentHuntCode && !isEditMode) {
      const colors = [
        "Red",
        "Blue",
        "Green",
        "Purple",
        "Orange",
        "Yellow",
        "Pink",
        "Silver",
        "Golden",
        "Black",
        "White",
        "Emerald",
        "Ruby",
        "Sapphire",
        "Diamond",
      ];
      const nouns = [
        "Tiger",
        "Dragon",
        "Eagle",
        "Wolf",
        "Bear",
        "Lion",
        "Falcon",
        "Phoenix",
        "Raven",
        "Shark",
        "Panther",
        "Cobra",
        "Hawk",
        "Lynx",
        "Jaguar",
      ];
      const randomColor = colors[Math.floor(Math.random() * colors.length)];
      const randomNoun = nouns[Math.floor(Math.random() * nouns.length)];
      const huntCode = `${randomColor}${randomNoun}`;

      form.setValue("huntCode", huntCode);
    } else if (!treasureHunt && !isEditMode) {
      form.setValue("huntCode", "");
    }
  }, [form.watch("treasureHunt"), form, isEditMode]);

  // Track if form has been initialized to prevent re-resetting
  const [formInitialized, setFormInitialized] = useState(false);

  // Load event data into form when in edit mode
  useEffect(() => {
    if (event && isEditMode && !formInitialized) {
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
        const venueParts = event.venue.split(",").map((part) => part.trim());
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

      // Load GPS coordinates if they exist
      if (event.latitude && event.longitude) {
        setLatitude(Number(event.latitude));
        setLongitude(Number(event.longitude));
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
        earlyValidation: (event.earlyValidation || "Allow at Anytime") as
          | "Allow at Anytime"
          | "One Hour Before"
          | "Two Hours Before"
          | "At Start Time"
          | undefined,
        reentryType: (event.reentryType || "No Reentry (Single Use)") as
          | "No Reentry (Single Use)"
          | "Pass (Multiple Use)"
          | "No Limit"
          | undefined,
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
        geofence: event.geofence || false,
        ticketPurchasesEnabled: event.ticketPurchasesEnabled !== false,
        timezone: event.timezone || "America/New_York",
        rollingTimezone: event.rollingTimezone || false,
      });

      setImageUrl(event.imageUrl || "");
      setStickerEnabled(!!event.stickerUrl);
      setTicketsSold(event.ticketsSold || 0);

      // Mark form as initialized to prevent re-resetting
      setFormInitialized(true);
    }
  }, [event, isEditMode, user, toast, setLocation, id, formInitialized]);

  // Update venue field when address components change
  useEffect(() => {
    const venueString = [address, city, country].filter(Boolean).join(", ");
    // Always set venue value, even if empty to trigger validation
    form.setValue("venue", venueString || "", { shouldValidate: true });
  }, [address, city, country, form]);

  // When ticket sales are disabled, automatically set event to private
  useEffect(() => {
    const subscription = form.watch((value, { name }) => {
      if (
        name === "ticketPurchasesEnabled" &&
        value.ticketPurchasesEnabled === false
      ) {
        form.setValue("isPrivate", true);
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
        description: `Your event "${event.name}" has been created successfully.`,
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
    if (!data.venue || data.venue.trim() === "") {
      toast({
        title: "Validation Error",
        description: "Please enter at least one venue location field",
        variant: "destructive",
      });
      return;
    }

    // Only validate dates for new events (not in edit mode)
    if (!isEditMode) {
      // Validate event is at least 3 hours in the future
      const now = new Date();
      const threeHoursFromNow = new Date(now.getTime() + 3 * 60 * 60 * 1000);

      const eventDate = new Date(`${data.date}T${data.time}`);

      if (eventDate < threeHoursFromNow) {
        const hoursUntilEvent =
          (eventDate.getTime() - now.getTime()) / (1000 * 60 * 60);
        if (hoursUntilEvent < 0) {
          form.setError("time", {
            type: "manual",
            message: "Event cannot be scheduled in the past",
          });
        } else {
          form.setError("time", {
            type: "manual",
            message: `Event must be scheduled at least 3 hours in advance (${hoursUntilEvent.toFixed(1)} hours is too soon)`,
          });
        }
        return;
      }

      // Validate event date is not more than 5 years in the future
      const fiveYearsFromNow = new Date(now);
      fiveYearsFromNow.setFullYear(fiveYearsFromNow.getFullYear() + 5);

      if (eventDate > fiveYearsFromNow) {
        form.setError("date", {
          type: "manual",
          message: "Event cannot be scheduled more than 5 years in advance",
        });
        return;
      }
    }

    // Validate end date/time if both are provided
    if (data.endDate && data.endTime) {
      const startDateTime = new Date(`${data.date}T${data.time}`);
      const endDateTime = new Date(`${data.endDate}T${data.endTime}`);

      if (endDateTime <= startDateTime) {
        form.setError("endDate", {
          type: "manual",
          message:
            "End date/time must be after start date/time (cannot be the same)",
        });
        return;
      }
    }

    // Validate surge pricing minimum ticket price
    if (data.surgePricing) {
      const ticketPrice = parseFloat(data.ticketPrice || "0");
      if (ticketPrice < 1.0) {
        form.setError("ticketPrice", {
          type: "manual",
          message: "Ticket price must be at least $1.00 for surge pricing",
        });
        return;
      }
    }

    // Generate Hunt code if Treasure Hunt is enabled
    const generateHuntCode = () => {
      const colors = [
        "Red",
        "Blue",
        "Green",
        "Purple",
        "Orange",
        "Yellow",
        "Pink",
        "Silver",
        "Golden",
        "Black",
        "White",
        "Emerald",
        "Ruby",
        "Sapphire",
        "Diamond",
      ];
      const nouns = [
        "Tiger",
        "Dragon",
        "Eagle",
        "Wolf",
        "Bear",
        "Lion",
        "Falcon",
        "Phoenix",
        "Raven",
        "Shark",
        "Panther",
        "Cobra",
        "Hawk",
        "Lynx",
        "Jaguar",
      ];
      const randomColor = colors[Math.floor(Math.random() * colors.length)];
      const randomNoun = nouns[Math.floor(Math.random() * nouns.length)];
      return `${randomColor}${randomNoun}`;
    };

    // Ensure maxTickets has a default value of 100 if not set
    const submitData = {
      ...data,
      maxTickets: data.maxTickets || 100,
      endDate: data.endDate && data.endDate !== "" ? data.endDate : null,
      endTime: data.endTime && data.endTime !== "" ? data.endTime : null,
      imageUrl: imageUrl || undefined,
      ticketBackgroundUrl: imageUrl || undefined, // Use featured image for ticket background
      stickerUrl:
        stickerEnabled && data.stickerUrl ? data.stickerUrl : undefined,
      stickerOdds:
        stickerEnabled && data.stickerUrl ? data.stickerOdds || 25 : undefined,
      timezone: data.timezone || "America/New_York",
      latitude: latitude ? String(latitude) : undefined,
      longitude: longitude ? String(longitude) : undefined,
      geofence: watchedValues.geofence || false,
      treasureHunt: data.treasureHunt || false,
      huntCode: data.treasureHunt ? generateHuntCode() : undefined,
      rollingTimezone: data.rollingTimezone || false,
      paymentProcessing: data.paymentProcessing || "None",
      walletAddress: data.walletAddress || undefined,
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
      // Note: name field cannot be updated and is removed on backend
      const updateData = {
        description: data.description || null,
        contactDetails: data.contactDetails || null,
        venue: data.venue,
        date: data.date,
        time: data.time,
        endDate: data.endDate && data.endDate !== "" ? data.endDate : null,
        endTime: data.endTime && data.endTime !== "" ? data.endTime : null,
        ticketPrice: data.ticketPrice,
        maxTickets: data.maxTickets || undefined,
        imageUrl: imageUrl || undefined,
        ticketBackgroundUrl: imageUrl || undefined,
        stickerUrl:
          stickerEnabled && data.stickerUrl
            ? data.stickerUrl
            : event?.stickerUrl || undefined,
        stickerOdds:
          stickerEnabled && data.stickerUrl
            ? data.stickerOdds || 25
            : event?.stickerOdds || undefined,
        timezone: data.timezone || "America/New_York",
        latitude: latitude ? String(latitude) : undefined,
        longitude: longitude ? String(longitude) : undefined,
        geofence: watchedValues.geofence || false,
        rollingTimezone: data.rollingTimezone || false,
        // Preserve allowMinting if it was previously enabled (one-way editable)
        allowMinting: event?.allowMinting || data.allowMinting || false,
        paymentProcessing: data.paymentProcessing || "None",
        walletAddress: data.walletAddress || undefined,
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
  const goldenTicketEnabled = form.watch("goldenTicketEnabled");
  const specialEffectsEnabled = form.watch("specialEffectsEnabled");

  // Determine what effect to show
  let currentEffect = specialEffectsEnabled
    ? availableEffects[previewEffectIndex]?.type
    : undefined;
  // Golden ticket shows independently of stickers
  let isGolden = goldenTicketEnabled && !specialEffectsEnabled;
  let isDoubleGolden = currentEffect === "rainbow";

  const sampleTicket: Ticket & { previewEffectType?: string } = {
    id: "sample",
    eventId: "sample",
    userId: user?.id || "",
    ticketNumber: "PREVIEW-001",
    qrData: "sample-qr-data", // Need QR data to show QR code in preview
    isValidated:
      specialEffectsEnabled || (stickerEnabled && !!form.watch("stickerUrl")), // Mark as validated for preview when special effects or sticker enabled
    validatedAt: null,
    validationCode: null,
    useCount: 0,
    isGoldenTicket: isGolden, // Apply golden ticket when enabled and no other effect
    isDoubleGolden: isDoubleGolden, // Show double golden for rainbow effect
    specialEffect:
      currentEffect ||
      (stickerEnabled && form.watch("stickerUrl") ? "sticker" : null),
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
  };

  const watchedValues = form.watch();

  // Format date for preview
  const formatPreviewDate = (date: string | undefined) => {
    if (!date) return "2024-01-01";
    try {
      return new Date(date).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
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
    latitude: latitude ? latitude.toString() : null,
    longitude: longitude ? longitude.toString() : null,
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
    stickerUrl:
      stickerEnabled && form.watch("stickerUrl")
        ? form.watch("stickerUrl") || null
        : null,
    stickerOdds: watchedValues.stickerOdds || 25,
    allowMinting: watchedValues.allowMinting || false,
    isPrivate: watchedValues.isPrivate || false,
    isEnabled: true,
    ticketPurchasesEnabled: true,
    oneTicketPerUser: watchedValues.oneTicketPerUser || false,
    surgePricing: watchedValues.surgePricing || false,
    p2pValidation: watchedValues.p2pValidation || false,
    enableVoting: watchedValues.enableVoting || false,
    geofence: watchedValues.geofence || false,
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
            <h1 className="h2 mb-0">
              {isEditMode ? "Edit Event" : "Create New Event"}
            </h1>
          </div>

          <div className="card">
            <div className="card-body">
              <div className="text-muted small mb-3">
                <span className="text-danger">*</span> Required fields
              </div>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)}>
                  <div className="row g-3">
                    {/* Admin-only Suspend Event checkbox - Show at top in edit mode */}
                    {isAdmin && isEditMode && (
                      <div className="col-12">
                        <div className="alert alert-warning p-3">
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
                                    onChange={(e) =>
                                      field.onChange(!e.target.checked)
                                    }
                                    data-testid="checkbox-disable-ticket-sales"
                                  />
                                  <label
                                    className="form-check-label"
                                    htmlFor="ticketPurchasesEnabled"
                                  >
                                    <span className="badge bg-danger me-2">
                                      ⚠️
                                    </span>
                                    <strong>Suspend Event</strong>
                                  </label>
                                </div>
                                <div className="form-text mt-2">
                                  Suspend this event from public view and stop
                                  new ticket sales. Existing ticket holders can
                                  still access and return tickets. Admin
                                  moderation tool.
                                </div>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      </div>
                    )}

                    {/* Help notification for event creation */}
                    {!isEditMode && (
                      <div className="col-12">
                        <div
                          className="alert alert-light border"
                          style={{ backgroundColor: "#f8f9fa" }}
                        >
                          <div className="d-flex align-items-start">
                            <span className="me-2">💡</span>
                            <div className="flex-grow-1">
                              <div className="small">
                                <strong>Need help with event settings?</strong>
                              </div>
                              <div className="small text-muted mt-1">
                                Read the{" "}
                                <a
                                  href="/manifesto"
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-decoration-none"
                                >
                                  manifesto
                                </a>{" "}
                                for detailed information about features like
                                Golden Tickets, Special Effects, P2P Validation,
                                and more event options.
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="col-12">
                      <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>
                              Event Name <span className="text-danger">*</span>
                              {isEditMode && (
                                <span className="text-muted small ms-2">
                                  (read-only)
                                </span>
                              )}
                            </FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                placeholder="Enter event name"
                                className={`form-control ${isEditMode ? "bg-light text-muted" : ""}`}
                                data-testid="input-event-name"
                                readOnly={isEditMode}
                                style={
                                  isEditMode
                                    ? { cursor: "not-allowed", opacity: 0.7 }
                                    : {}
                                }
                              />
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
                          {isEditMode && (
                            <span className="text-muted small ms-2">
                              (read-only)
                            </span>
                          )}
                        </label>
                        <div className="form-text mb-2">
                          Maximum file size: 5MB. Accepted formats: JPEG, JPG,
                          PNG, GIF
                          {isEditMode && (
                            <span className="text-muted">
                              {" "}
                              - Featured image cannot be changed after event
                              creation
                            </span>
                          )}
                        </div>
                        {!isEditMode ? (
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
                        ) : (
                          imageUrl && (
                            <div
                              className="border rounded p-2"
                              style={{ backgroundColor: "#f0f0f0" }}
                            >
                              <img
                                src={imageUrl}
                                alt="Event featured image"
                                style={{
                                  maxWidth: "200px",
                                  maxHeight: "150px",
                                }}
                                className="d-block"
                              />
                            </div>
                          )
                        )}
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
                                value={field.value || ""}
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
                            <FormLabel>
                              Description
                              <span className="text-muted small ms-2">
                                ({countCharacters(field.value || "")}/5000)
                              </span>
                            </FormLabel>
                            <FormControl>
                              <Textarea
                                {...field}
                                placeholder="Describe your event... You can include URLs and hashtags (#example)"
                                className="form-control"
                                rows={8}
                                maxLength={5000}
                                data-testid="input-description"
                                style={{ resize: "vertical" }}
                              />
                            </FormControl>
                            <FormDescription>
                              Plain text with automatic URL detection. Use
                              hashtags (#example) to categorize your event.
                            </FormDescription>
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
                            <FormLabel className="text-dark">
                              Venue Location{" "}
                              <span className="text-danger">*</span>
                              {isEditMode && (
                                <span className="text-muted small ms-2">
                                  (read-only)
                                </span>
                              )}
                            </FormLabel>
                            <input type="hidden" {...field} />
                            <div className="row g-2">
                              <div className="col-12">
                                <input
                                  type="text"
                                  className={`form-control ${isEditMode ? "bg-light text-muted" : ""}`}
                                  placeholder="Street Address, GPS Coordinates, Online, etc."
                                  value={address}
                                  onChange={(e) =>
                                    !isEditMode && setAddress(e.target.value)
                                  }
                                  data-testid="input-address"
                                  readOnly={isEditMode}
                                  style={
                                    isEditMode
                                      ? { cursor: "not-allowed", opacity: 0.7 }
                                      : {}
                                  }
                                />
                              </div>
                              <div className="col-md-6">
                                <input
                                  type="text"
                                  className={`form-control ${isEditMode ? "bg-light text-muted" : ""}`}
                                  placeholder="City"
                                  value={city}
                                  onChange={(e) =>
                                    !isEditMode && setCity(e.target.value)
                                  }
                                  data-testid="input-city"
                                  readOnly={isEditMode}
                                  style={
                                    isEditMode
                                      ? { cursor: "not-allowed", opacity: 0.7 }
                                      : {}
                                  }
                                />
                              </div>
                              <div className="col-md-6">
                                <select
                                  className={`form-control ${isEditMode ? "bg-light text-muted" : ""}`}
                                  value={country}
                                  onChange={(e) =>
                                    !isEditMode && setCountry(e.target.value)
                                  }
                                  data-testid="input-country"
                                  disabled={isEditMode}
                                  style={
                                    isEditMode
                                      ? { cursor: "not-allowed", opacity: 0.7 }
                                      : {}
                                  }
                                >
                                  <option value="">Select Country</option>
                                  {countries.map((countryName) => (
                                    <option
                                      key={countryName}
                                      value={countryName}
                                    >
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

                    {/* Interactive Map for Location Selection */}
                    <div className="col-12 mt-3">
                      <div className="mb-2">
                        <label className="form-label">
                          Map
                          {isEditMode && (
                            <span className="text-muted small ms-2">
                              (GPS coordinates locked)
                            </span>
                          )}
                        </label>
                      </div>
                      <LocationPicker
                        latitude={latitude}
                        longitude={longitude}
                        onLocationSelect={(lat, lng) => {
                          setLatitude(lat);
                          setLongitude(lng);
                        }}
                        readOnly={isEditMode}
                        height="300px"
                      />
                      {latitude && longitude && (
                        <div className="mt-2">
                          <small className="text-muted">
                            Location set: {latitude.toFixed(6)},{" "}
                            {longitude.toFixed(6)}
                            {isEditMode && " (cannot be changed)"}
                          </small>
                        </div>
                      )}
                    </div>

                    <div className="col-md-6">
                      <FormField
                        control={form.control}
                        name="date"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>
                              Starts on <span className="text-danger">*</span>
                              {isEditMode && (
                                <span className="text-muted small ms-2">
                                  (read-only)
                                </span>
                              )}
                            </FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                type="date"
                                className={`form-control ${isEditMode ? "bg-light text-muted" : ""}`}
                                min={minDate}
                                max={maxDate}
                                data-testid="input-date"
                                readOnly={isEditMode}
                                style={
                                  isEditMode
                                    ? { cursor: "not-allowed", opacity: 0.7 }
                                    : {}
                                }
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
                            <FormLabel>
                              Start Time <span className="text-danger">*</span>
                              {isEditMode && (
                                <span className="text-muted small ms-2">
                                  (read-only)
                                </span>
                              )}
                            </FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                type="time"
                                className={`form-control ${isEditMode ? "bg-light text-muted" : ""}`}
                                data-testid="input-time"
                                readOnly={isEditMode}
                                style={
                                  isEditMode
                                    ? { cursor: "not-allowed", opacity: 0.7 }
                                    : {}
                                }
                                onChange={(e) => {
                                  field.onChange(e);
                                  // Clear any existing date/time errors when user changes the time
                                  form.clearErrors(["date", "time"]);

                                  // Validate 3-hour rule if both date and time are set
                                  const dateValue = form.getValues("date");
                                  const timeValue = e.target.value;

                                  if (dateValue && timeValue && !isEditMode) {
                                    const eventDate = new Date(
                                      `${dateValue}T${timeValue}`,
                                    );
                                    const now = new Date();
                                    const threeHoursFromNow = new Date(
                                      now.getTime() + 3 * 60 * 60 * 1000,
                                    );

                                    if (eventDate < threeHoursFromNow) {
                                      const hoursUntilEvent =
                                        (eventDate.getTime() - now.getTime()) /
                                        (1000 * 60 * 60);
                                      if (hoursUntilEvent < 0) {
                                        form.setError("time", {
                                          type: "manual",
                                          message:
                                            "Event cannot be scheduled in the past",
                                        });
                                      } else {
                                        form.setError("time", {
                                          type: "manual",
                                          message: `Event must be scheduled at least 3 hours in advance`,
                                        });
                                      }
                                    }
                                  }
                                }}
                              />
                            </FormControl>
                            {/* Show validation status when both date and time are selected */}
                            {form.watch("date") &&
                              form.watch("time") &&
                              !isEditMode &&
                              (() => {
                                const dateValue = form.watch("date");
                                const timeValue = form.watch("time");
                                if (!dateValue || !timeValue) return null;

                                const eventDate = new Date(
                                  `${dateValue}T${timeValue}`,
                                );
                                const now = new Date();
                                const hoursUntilEvent =
                                  (eventDate.getTime() - now.getTime()) /
                                  (1000 * 60 * 60);

                                if (hoursUntilEvent >= 3) {
                                  return (
                                    <div className="text-success small mt-1">
                                      <Clock
                                        size={14}
                                        className="d-inline me-1"
                                      />
                                      Event starts in{" "}
                                      {hoursUntilEvent.toFixed(1)} hours ✓
                                    </div>
                                  );
                                } else if (hoursUntilEvent >= 0) {
                                  return (
                                    <div className="text-warning small mt-1">
                                      <Clock
                                        size={14}
                                        className="d-inline me-1"
                                      />
                                      Too soon: {hoursUntilEvent.toFixed(1)}{" "}
                                      hours (minimum 3 hours required)
                                    </div>
                                  );
                                }
                                return null;
                              })()}
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
                            <FormLabel>
                              Ends on
                              {isEditMode && (
                                <span className="text-muted small ms-2">
                                  (read-only)
                                </span>
                              )}
                            </FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                value={field.value || ""}
                                type="date"
                                className={`form-control ${isEditMode ? "bg-light text-muted" : ""}`}
                                min={form.watch("date") || minDate}
                                max={maxDate}
                                data-testid="input-end-date"
                                readOnly={isEditMode}
                                style={
                                  isEditMode
                                    ? { cursor: "not-allowed", opacity: 0.7 }
                                    : {}
                                }
                              />
                            </FormControl>
                            <div className="form-text">
                              For multi-day events
                            </div>
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
                            <FormLabel>
                              End Time
                              {isEditMode && (
                                <span className="text-muted small ms-2">
                                  (read-only)
                                </span>
                              )}
                            </FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                value={field.value || ""}
                                type="time"
                                className={`form-control ${isEditMode ? "bg-light text-muted" : ""}`}
                                data-testid="input-end-time"
                                readOnly={isEditMode}
                                style={
                                  isEditMode
                                    ? { cursor: "not-allowed", opacity: 0.7 }
                                    : {}
                                }
                              />
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
                            <FormLabel>
                              Timezone
                              {isEditMode && event?.rollingTimezone && (
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Lock
                                        size={14}
                                        className="ms-2 text-muted"
                                      />
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>
                                        Timezone is locked for Global Sync
                                        events
                                      </p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              )}
                            </FormLabel>
                            <FormControl>
                              <select
                                className={`form-select ${isEditMode && event?.rollingTimezone ? "bg-light text-muted" : ""}`}
                                data-testid="select-timezone"
                                value={field.value || "America/New_York"}
                                onChange={(e) => field.onChange(e.target.value)}
                                disabled={isEditMode && event?.rollingTimezone}
                                style={
                                  isEditMode && event?.rollingTimezone
                                    ? { cursor: "not-allowed", opacity: 0.7 }
                                    : {}
                                }
                              >
                                <optgroup label="US & Canada">
                                  <option value="America/New_York">
                                    Eastern Time (ET)
                                  </option>
                                  <option value="America/Chicago">
                                    Central Time (CT)
                                  </option>
                                  <option value="America/Denver">
                                    Mountain Time (MT)
                                  </option>
                                  <option value="America/Phoenix">
                                    Arizona Time (MST)
                                  </option>
                                  <option value="America/Los_Angeles">
                                    Pacific Time (PT)
                                  </option>
                                  <option value="America/Anchorage">
                                    Alaska Time (AKT)
                                  </option>
                                  <option value="Pacific/Honolulu">
                                    Hawaii Time (HST)
                                  </option>
                                </optgroup>
                                <optgroup label="Europe">
                                  <option value="Europe/London">
                                    London (GMT/BST)
                                  </option>
                                  <option value="Europe/Paris">
                                    Paris (CET)
                                  </option>
                                  <option value="Europe/Berlin">
                                    Berlin (CET)
                                  </option>
                                  <option value="Europe/Moscow">
                                    Moscow (MSK)
                                  </option>
                                </optgroup>
                                <optgroup label="Asia">
                                  <option value="Asia/Tokyo">
                                    Tokyo (JST)
                                  </option>
                                  <option value="Asia/Shanghai">
                                    Shanghai (CST)
                                  </option>
                                  <option value="Asia/Hong_Kong">
                                    Hong Kong (HKT)
                                  </option>
                                  <option value="Asia/Singapore">
                                    Singapore (SGT)
                                  </option>
                                  <option value="Asia/Dubai">
                                    Dubai (GST)
                                  </option>
                                  <option value="Asia/Kolkata">
                                    India (IST)
                                  </option>
                                </optgroup>
                                <optgroup label="Australia & Pacific">
                                  <option value="Australia/Sydney">
                                    Sydney (AEDT)
                                  </option>
                                  <option value="Australia/Melbourne">
                                    Melbourne (AEDT)
                                  </option>
                                  <option value="Pacific/Auckland">
                                    Auckland (NZDT)
                                  </option>
                                </optgroup>
                                <optgroup label="Other">
                                  <option value="UTC">UTC</option>
                                </optgroup>
                              </select>
                            </FormControl>
                            <div className="form-text">
                              Event times will be displayed in this timezone
                            </div>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="col-md-6">
                      {/* Rolling Timezone Option */}
                      <FormField
                        control={form.control}
                        name="rollingTimezone"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>&nbsp;</FormLabel>
                            <div className="form-check">
                              <FormControl>
                                <input
                                  type="checkbox"
                                  className={`form-check-input ${isEditMode ? "bg-light" : ""}`}
                                  data-testid="checkbox-rolling-timezone"
                                  checked={field.value || false}
                                  onChange={(e) =>
                                    field.onChange(e.target.checked)
                                  }
                                  disabled={isEditMode}
                                  style={
                                    isEditMode
                                      ? { cursor: "not-allowed", opacity: 0.7 }
                                      : {}
                                  }
                                />
                              </FormControl>
                              <label className="form-check-label ms-2">
                                <img
                                  src="/global-sync-icon.png"
                                  alt=""
                                  width="18"
                                  height="18"
                                  className="me-1"
                                  style={{ verticalAlign: "text-bottom" }}
                                />
                                Global Sync
                                {isEditMode && (
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Lock
                                          size={14}
                                          className="ms-2 text-muted"
                                        />
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p>
                                          Global Sync cannot be changed after
                                          event creation
                                        </p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                )}
                              </label>
                            </div>
                            <div className="form-text">
                              Synchronizes across all timezones - starts at the
                              same local time worldwide.
                              {isEditMode && (
                                <span className="text-muted"> (Locked)</span>
                              )}
                            </div>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    {/* Tickets & Pricing Section - Windows 98 Style - Only show when creating new event */}
                    {isEditMode ? (
                      <div className="col-12">
                        <div className="alert alert-info">
                          <i className="bi bi-info-circle me-2"></i>
                          <strong>
                            Tickets & Pricing are locked after event creation
                          </strong>
                          <div className="small mt-1">
                            Ticket price, quantity, and surge pricing settings
                            cannot be changed once an event is created to
                            maintain fairness for existing ticket holders.
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="col-12">
                        <div
                          style={{
                            background: "#c0c0c0",
                            border: "3px solid",
                            borderColor: "#ffffff #000000 #000000 #ffffff",
                            boxShadow: "1px 1px 0 #808080",
                            marginBottom: "20px",
                          }}
                        >
                          <div
                            style={{
                              background:
                                "linear-gradient(to right, #000080, #1084d0)",
                              padding: "2px 4px",
                              marginBottom: "1px",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                            }}
                          >
                            <div
                              className="text-white fw-bold"
                              style={{
                                fontSize: "11px",
                                fontFamily: "Tahoma, sans-serif",
                              }}
                            >
                              Tickets & Pricing
                            </div>
                            <div
                              style={{
                                width: "13px",
                                height: "11px",
                                background: "#c0c0c0",
                                border: "1px solid",
                                borderColor: "#ffffff #000000 #000000 #ffffff",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontSize: "9px",
                                fontWeight: "bold",
                                lineHeight: "1",
                                cursor: "pointer",
                              }}
                            >
                              ×
                            </div>
                          </div>
                          <div
                            className="p-3"
                            style={{ background: "#c0c0c0" }}
                          >
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
                                            const surgePricing =
                                              form.getValues("surgePricing");
                                            if (surgePricing) {
                                              const ticketPrice = parseFloat(
                                                e.target.value || "0",
                                              );
                                              if (ticketPrice >= 1.0) {
                                                form.clearErrors("ticketPrice");
                                              } else {
                                                form.setError("ticketPrice", {
                                                  type: "manual",
                                                  message:
                                                    "Ticket price must be at least $1.00 for surge pricing",
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
                                              // Update ticket price to $1.00 when enabling surge pricing if it's less
                                              if (e.target.checked) {
                                                const ticketPrice = parseFloat(
                                                  form.getValues(
                                                    "ticketPrice",
                                                  ) || "0",
                                                );
                                                if (ticketPrice < 1.0) {
                                                  form.setValue(
                                                    "ticketPrice",
                                                    "1.00",
                                                  );
                                                  form.clearErrors(
                                                    "ticketPrice",
                                                  );
                                                }
                                              } else {
                                                // Clear the error when disabling surge pricing
                                                form.clearErrors("ticketPrice");
                                              }
                                            }}
                                            className="form-check-input"
                                            id="surgePricingCheck"
                                            data-testid="checkbox-surge-pricing"
                                          />
                                        </FormControl>
                                        <label
                                          className="form-check-label"
                                          htmlFor="surgePricingCheck"
                                        >
                                          <img
                                            src="/surge-pricing-icon.png"
                                            alt="Surge Pricing"
                                            style={{
                                              width: "21px",
                                              height: "21px",
                                              marginRight: "8px",
                                              display: "inline-block",
                                              verticalAlign: "middle",
                                            }}
                                          />
                                          <strong>Surge Pricing</strong>
                                          <div className="text-muted small">
                                            Ticket prices increase with demand.
                                            Minimum $1.00 ticket price.
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
                                      <FormLabel>Tickets</FormLabel>
                                      <FormControl>
                                        <Input
                                          {...field}
                                          type="number"
                                          min="1"
                                          max="4999"
                                          placeholder="Enter number of tickets"
                                          className="form-control"
                                          data-testid="input-max-tickets"
                                          value={field.value || ""}
                                          onChange={(e) => {
                                            const value =
                                              parseInt(e.target.value) || 0;
                                            field.onChange(value);

                                            // Check if value exceeds user's credit balance
                                            if (value > creditBalance) {
                                              form.setError("maxTickets", {
                                                type: "manual",
                                                message: "Not Enough Credits",
                                              });
                                            } else {
                                              form.clearErrors("maxTickets");
                                            }
                                          }}
                                        />
                                      </FormControl>
                                      <div className="form-text">
                                        Your balance: {creditBalance} credits
                                      </div>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                              </div>
                            </div>

                            {/* Admin-only Disable Ticket Sales checkbox - Show here only when creating */}
                            {isAdmin && !isEditMode && (
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
                                            id="ticketPurchasesEnabledCreate"
                                            checked={!field.value}
                                            onChange={(e) =>
                                              field.onChange(!e.target.checked)
                                            }
                                            data-testid="checkbox-disable-ticket-sales"
                                          />
                                          <label
                                            className="form-check-label"
                                            htmlFor="ticketPurchasesEnabledCreate"
                                          >
                                            <span className="badge bg-danger me-2">
                                              ⚠️
                                            </span>
                                            Suspend Event
                                          </label>
                                        </div>
                                        <div className="form-text">
                                          Suspend this event from public view
                                          and stop new ticket sales. Existing
                                          ticket holders can still access and
                                          return tickets. Admin moderation tool.
                                        </div>
                                        <FormMessage />
                                      </FormItem>
                                    )}
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Payment Processing Section - Windows 98 Style */}
                    <div className="col-12">
                      <div
                        style={{
                          background: "#c0c0c0",
                          border: "3px solid",
                          borderColor: "#ffffff #000000 #000000 #ffffff",
                          boxShadow: "1px 1px 0 #808080",
                          marginBottom: "20px",
                        }}
                      >
                        <div
                          style={{
                            background:
                              "linear-gradient(to right, #000080, #1084d0)",
                            padding: "2px 4px",
                            marginBottom: "1px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                          }}
                        >
                          <div
                            className="text-white fw-bold"
                            style={{
                              fontSize: "11px",
                              fontFamily: "Tahoma, sans-serif",
                            }}
                          >
                            Payment Processing
                          </div>
                          <div
                            style={{
                              width: "13px",
                              height: "11px",
                              background: "#c0c0c0",
                              border: "1px solid",
                              borderColor: "#ffffff #000000 #000000 #ffffff",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: "9px",
                              fontWeight: "bold",
                              lineHeight: "1",
                              cursor: "pointer",
                            }}
                          >
                            ×
                          </div>
                        </div>
                        <div className="p-3" style={{ background: "#c0c0c0" }}>
                          <FormField
                            control={form.control}
                            name="paymentProcessing"
                            render={({ field }) => {
                              // Check if wallet address is already saved
                              const isPaymentLocked = event?.walletAddress && event.walletAddress.length > 0;
                              
                              return (
                                <FormItem>
                                  <FormLabel>
                                    Payment Method
                                    {isPaymentLocked && (
                                      <span className="text-muted ms-2">
                                        (locked - wallet configured)
                                      </span>
                                    )}
                                  </FormLabel>
                                  <FormControl>
                                    <select
                                      className="form-select"
                                      {...field}
                                      value={field.value || "None"}
                                      onChange={(e) =>
                                        field.onChange(e.target.value)
                                      }
                                      disabled={isPaymentLocked}
                                      data-testid="select-payment-processing"
                                    >
                                      <option value="None">
                                        None - No payment processing
                                      </option>
                                      <option value="Ethereum">
                                        Ξ Ethereum
                                      </option>
                                      <option value="Bitcoin">₿ Bitcoin</option>
                                      <option value="Dogecoin">
                                        Ð Dogecoin
                                      </option>
                                      <option value="Litecoin">
                                        Ł Litecoin
                                      </option>
                                    </select>
                                  </FormControl>
                                  {field.value !== "None" && (
                                    <>
                                      <div className="mt-3 p-3 bg-light border rounded">
                                        <div className="d-flex align-items-center justify-content-between">
                                          <div>
                                            <strong>
                                              {field.value} Payment Integration
                                            </strong>
                                            <div className="text-muted small mt-1">
                                              Ticket holders can pay with their{" "}
                                              {field.value} wallet.
                                            </div>
                                          </div>
                                          <div className="text-end">
                                            <span
                                              className={`badge ${
                                                field.value === "Ethereum" ||
                                                field.value === "Bitcoin"
                                                  ? "bg-warning text-dark"
                                                  : "bg-info text-dark"
                                              } fs-6`}
                                            >
                                              {field.value === "Ethereum" ||
                                              field.value === "Bitcoin"
                                                ? "100"
                                                : "50"}{" "}
                                              tickets
                                            </span>
                                            <div className="text-muted small mt-1">
                                              Config. Fee
                                            </div>
                                          </div>
                                        </div>
                                      </div>

                                      <FormField
                                        control={form.control}
                                        name="walletAddress"
                                        render={({ field: walletField }) => (
                                          <FormItem className="mt-3">
                                            <FormLabel>
                                              Your {field.value} Wallet Address
                                              {isPaymentLocked && (
                                                <span className="text-muted ms-2">
                                                  (read-only)
                                                </span>
                                              )}
                                            </FormLabel>
                                            <FormControl>
                                              <input
                                                type="text"
                                                className="form-control"
                                                placeholder={`Enter your ${field.value} wallet address`}
                                                {...walletField}
                                                value={walletField.value || ""}
                                                readOnly={isPaymentLocked}
                                                data-testid="input-wallet-address"
                                              />
                                            </FormControl>
                                            <div className="form-text">
                                              {isPaymentLocked ? (
                                                <>
                                                  <span className="text-warning">
                                                    ⚠️ Wallet address is locked for security.
                                                  </span>
                                                  <br />
                                                  Payments will be sent to this address.
                                                </>
                                              ) : (
                                                "This is where ticket payments will be sent"
                                              )}
                                            </div>
                                            <FormMessage />
                                          </FormItem>
                                        )}
                                      />
                                    </>
                                  )}
                                  <div className="form-text mt-2">
                                    {field.value === "None" ? (
                                      <>
                                        We don't handle payment processing for
                                        ticket sales at events. You'll need to
                                        manage payments independently.
                                      </>
                                    ) : (
                                      <>
                                        Enable {field.value} payments for your
                                        event. Ticket holders can pay for their
                                        tickets with {field.value}. We prepare
                                        the transaction with a one-click "Pay
                                        with {field.value}" button.
                                      </>
                                    )}
                                  </div>
                                  <FormMessage />
                                </FormItem>
                              );
                            }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Additional Event Options - Windows 98 Style */}
                    <div className="col-12">
                      <div
                        style={{
                          background: "#c0c0c0",
                          border: "3px solid",
                          borderColor: "#ffffff #000000 #000000 #ffffff",
                          boxShadow: "1px 1px 0 #808080",
                          marginBottom: "20px",
                        }}
                      >
                        <div
                          style={{
                            background:
                              "linear-gradient(to right, #000080, #1084d0)",
                            padding: "2px 4px",
                            marginBottom: "1px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                          }}
                        >
                          <div
                            className="text-white fw-bold"
                            style={{
                              fontSize: "11px",
                              fontFamily: "Tahoma, sans-serif",
                            }}
                          >
                            Additional Options
                          </div>
                          <div
                            style={{
                              width: "13px",
                              height: "11px",
                              background: "#c0c0c0",
                              border: "1px solid",
                              borderColor: "#ffffff #000000 #000000 #ffffff",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: "9px",
                              fontWeight: "bold",
                              lineHeight: "1",
                              cursor: "pointer",
                            }}
                          >
                            ×
                          </div>
                        </div>
                        <div className="p-3" style={{ background: "#c0c0c0" }}>
                          <div className="row mb-3">
                            <div className="col-md-6">
                              <FormField
                                control={form.control}
                                name="earlyValidation"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>
                                      Early Validation
                                      {isEditMode && (
                                        <span className="text-muted ms-2">
                                          (read-only)
                                        </span>
                                      )}
                                    </FormLabel>
                                    <FormControl>
                                      <select
                                        {...field}
                                        className="form-control"
                                        data-testid="select-early-validation"
                                        disabled={isEditMode}
                                        style={
                                          isEditMode
                                            ? {
                                                backgroundColor: "#f0f0f0",
                                                color: "#6c757d",
                                              }
                                            : {}
                                        }
                                      >
                                        <option value="Allow at Anytime">
                                          Allow at Anytime
                                        </option>
                                        <option value="At Start Time">
                                          At Start Time
                                        </option>
                                        <option value="One Hour Before">
                                          One Hour Before
                                        </option>
                                        <option value="Two Hours Before">
                                          Two Hours Before
                                        </option>
                                      </select>
                                    </FormControl>
                                    <div className="form-text">
                                      When attendees can validate their tickets
                                    </div>
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
                                    <FormLabel>
                                      Ticket Type
                                      {isEditMode && (
                                        <span className="text-muted ms-2">
                                          (read-only)
                                        </span>
                                      )}
                                    </FormLabel>
                                    <FormControl>
                                      <select
                                        {...field}
                                        className="form-control"
                                        data-testid="select-reentry-type"
                                        disabled={isEditMode}
                                        style={
                                          isEditMode
                                            ? {
                                                backgroundColor: "#f0f0f0",
                                                color: "#6c757d",
                                              }
                                            : {}
                                        }
                                      >
                                        <option value="No Reentry (Single Use)">
                                          No Reentry (Single Use)
                                        </option>
                                        <option value="Pass (Multiple Use)">
                                          Pass (Multiple Use)
                                        </option>
                                      </select>
                                    </FormControl>
                                    <div className="form-text">
                                      Single use tickets or multi-use passes
                                    </div>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                            </div>

                            {form.watch("reentryType") ===
                              "Pass (Multiple Use)" && (
                              <div className="col-12">
                                <FormField
                                  control={form.control}
                                  name="maxUses"
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel>
                                        Number of Uses
                                        {isEditMode && (
                                          <span className="text-muted small ms-2">
                                            (read-only)
                                          </span>
                                        )}
                                      </FormLabel>
                                      <FormControl>
                                        <Input
                                          {...field}
                                          type="number"
                                          min="2"
                                          max="24"
                                          placeholder="Number of uses (2-24)"
                                          className={`form-control ${isEditMode ? "bg-light text-muted" : ""}`}
                                          data-testid="input-max-uses"
                                          value={field.value || 2}
                                          onChange={(e) => {
                                            if (!isEditMode) {
                                              const value =
                                                parseInt(e.target.value) || 2;
                                              if (value < 2) {
                                                field.onChange(2);
                                              } else if (value > 24) {
                                                field.onChange(24);
                                              } else {
                                                field.onChange(value);
                                              }
                                            }
                                          }}
                                          readOnly={isEditMode}
                                          style={
                                            isEditMode
                                              ? {
                                                  cursor: "not-allowed",
                                                  opacity: 0.7,
                                                }
                                              : {}
                                          }
                                        />
                                      </FormControl>
                                      <div className="form-text">
                                        How many times the ticket can be used
                                        (minimum 2, maximum 24)
                                        {isEditMode &&
                                          " - Cannot be changed after event creation"}
                                      </div>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                              </div>
                            )}
                          </div>

                          {/* Private Event Setting */}
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
                                    onChange={(e) =>
                                      field.onChange(e.target.checked)
                                    }
                                    disabled={
                                      !form.watch("ticketPurchasesEnabled")
                                    }
                                    data-testid="checkbox-is-private"
                                  />
                                  <label
                                    className="form-check-label"
                                    htmlFor="isPrivate"
                                  >
                                    <img
                                      src="/lock-icon.png"
                                      alt="Private"
                                      style={{
                                        width: "21px",
                                        height: "21px",
                                        marginRight: "8px",
                                      }}
                                    />
                                    Private Event
                                  </label>
                                </div>
                                <div className="form-text">
                                  Private events won't appear in search results
                                  or be featured. Only accessible via direct
                                  link.
                                  {!form.watch("ticketPurchasesEnabled") && (
                                    <span className="text-warning">
                                      {" "}
                                      <strong>
                                        Automatically enabled when event is
                                        suspended.
                                      </strong>
                                    </span>
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
                                    onChange={(e) =>
                                      field.onChange(e.target.checked)
                                    }
                                    data-testid="checkbox-one-ticket-per-user"
                                  />
                                  <label
                                    className="form-check-label"
                                    htmlFor="oneTicketPerUser"
                                  >
                                    <img
                                      src="/limit-sales-icon.png"
                                      alt="Limit Sales"
                                      style={{
                                        width: "21px",
                                        height: "21px",
                                        marginRight: "8px",
                                      }}
                                    />
                                    Limit Ticket Sales
                                  </label>
                                </div>
                                <div className="form-text">
                                  Prevent scalping by restricting users to
                                  purchasing only one ticket.
                                </div>
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
                                    onChange={(e) =>
                                      field.onChange(e.target.checked)
                                    }
                                    data-testid="checkbox-p2p-validation"
                                    disabled={isEditMode} // Disable if editing existing event
                                  />
                                  <label
                                    className="form-check-label"
                                    htmlFor="p2pValidation"
                                  >
                                    <img
                                      src="/p2p-icon.png"
                                      alt="P2P"
                                      style={{
                                        width: "21px",
                                        height: "21px",
                                        marginRight: "8px",
                                      }}
                                    />
                                    P2P Validation
                                  </label>
                                </div>
                                <div className="form-text">
                                  Allow any ticket holder the ability to
                                  validate other tickets
                                  {isEditMode
                                    ? " (This setting is read-only after event creation)"
                                    : ""}
                                  .
                                </div>
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
                                      onChange={(e) =>
                                        field.onChange(e.target.checked)
                                      }
                                      data-testid="checkbox-enable-voting"
                                      disabled={isEditMode} // Disable if editing existing event
                                    />
                                    <label
                                      className="form-check-label"
                                      htmlFor="enableVoting"
                                    >
                                      <span className="badge bg-warning text-dark me-2">
                                        🗳️
                                      </span>
                                      Voting
                                      {isEditMode && (
                                        <span className="text-muted ms-2">
                                          (read-only)
                                        </span>
                                      )}
                                    </label>
                                  </div>
                                  <div className="form-text">
                                    Tickets can collect votes! The most voted
                                    ticket becomes golden. Use the validator to
                                    vote/validate someones ticket
                                    {isEditMode
                                      ? " (This setting is read-only after event creation)"
                                      : ""}
                                    .
                                  </div>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          )}

                          {/* Geofence setting - only shown when GPS coordinates are set */}
                          {latitude && longitude && (
                            <FormField
                              control={form.control}
                              name="geofence"
                              render={({ field }) => (
                                <FormItem className="mt-3">
                                  <div className="form-check">
                                    <input
                                      type="checkbox"
                                      className="form-check-input"
                                      id="geofence"
                                      checked={field.value || false}
                                      onChange={(e) =>
                                        field.onChange(e.target.checked)
                                      }
                                      data-testid="checkbox-geofence"
                                      disabled={isEditMode} // Disable if editing existing event
                                    />
                                    <label
                                      className="form-check-label"
                                      htmlFor="geofence"
                                    >
                                      <span className="badge bg-success me-2">
                                        🌎
                                      </span>
                                      Geofence
                                      {isEditMode && (
                                        <span className="text-muted ms-2">
                                          (read-only)
                                        </span>
                                      )}
                                    </label>
                                  </div>
                                  <div className="form-text">
                                    Tickets can only be validated within 300
                                    meters of the GPS coordinates set on the
                                    map.
                                  </div>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          )}

                          {form.watch("geofence") && !isEditMode && (
                            <FormField
                              control={form.control}
                              name="treasureHunt"
                              render={({ field }) => (
                                <FormItem className="mt-3 ms-4">
                                  <div className="form-check">
                                    <input
                                      className="form-check-input"
                                      type="checkbox"
                                      id="treasureHunt"
                                      checked={field.value || false}
                                      onChange={(e) =>
                                        field.onChange(e.target.checked)
                                      }
                                      data-testid="checkbox-treasurehunt"
                                    />
                                    <label
                                      className="form-check-label"
                                      htmlFor="treasureHunt"
                                    >
                                      <span className="badge bg-info me-2">
                                        🗺️
                                      </span>
                                      Treasure Hunt
                                    </label>
                                  </div>
                                  <div className="form-text">
                                    Enable geocaching-style validation. Hide a
                                    unique URL in the real world for attendees
                                    to discover. Ticket holders can enter the
                                    Hunt code on their account page for instant
                                    validation.
                                    {form.watch("treasureHunt") &&
                                      form.watch("huntCode") && (
                                        <div className="mt-2 p-2 bg-light border rounded">
                                          <strong>Your hunt URL:</strong>
                                          <br />
                                          <code className="text-primary">
                                            www.eventic.quest/hunt/
                                            {form.watch("huntCode")}
                                          </code>
                                          <br />
                                          <small className="text-muted">
                                            Share this URL, or hide it for
                                            anyoneone to find! They can also
                                            enter just the code "
                                            {form.watch("huntCode")}" on their
                                            account page in the Secret Codes
                                            section.
                                          </small>
                                        </div>
                                      )}
                                  </div>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          )}

                          {form.watch("geofence") &&
                            isEditMode &&
                            event?.treasureHunt && (
                              <div className="mt-3 ms-4">
                                <div className="form-check">
                                  <input
                                    className="form-check-input"
                                    type="checkbox"
                                    id="treasureHunt"
                                    checked={true}
                                    disabled={true}
                                  />
                                  <label
                                    className="form-check-label"
                                    htmlFor="treasureHunt"
                                  >
                                    <span className="badge bg-info me-2">
                                      🗺️
                                    </span>
                                    Treasure Hunt
                                    <span className="text-muted ms-2">
                                      (read-only)
                                    </span>
                                  </label>
                                </div>
                                <div className="form-text">
                                  {event?.huntCode && (
                                    <div className="mt-2 p-2 bg-light border rounded">
                                      <strong>Hunt URL:</strong>
                                      <br />
                                      <code className="text-primary">
                                        www.eventic.quest/hunt/{event.huntCode}
                                      </code>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                        </div>
                      </div>

                      {/* Ticket Preview Section */}
                      <div className="col-12">
                        <div className="mb-4">
                          <label className="form-label">
                            <img
                              src={ticketPreviewIcon}
                              alt=""
                              style={{
                                width: "26px",
                                height: "26px",
                                marginRight: "8px",
                                verticalAlign: "middle",
                              }}
                            />
                            Ticket Preview
                          </label>
                          <p className="text-muted small mb-3">
                            This is how your event tickets will appear to
                            attendees. The featured image will be used as the
                            ticket background.
                          </p>

                          {/* Ticket Preview */}
                          <div className="mb-3">
                            <div
                              className="bg-light rounded p-4"
                              style={{ backgroundColor: "#f8f9fa" }}
                            >
                              <div
                                className="mx-auto"
                                style={{ maxWidth: "400px" }}
                              >
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
                                    onClick={() =>
                                      setPreviewEffectIndex(
                                        (prev) =>
                                          (prev - 1 + availableEffects.length) %
                                          availableEffects.length,
                                      )
                                    }
                                    data-testid="button-prev-effect"
                                    title="Previous effect"
                                  >
                                    <ArrowLeft size={16} />
                                  </button>
                                  <span
                                    className="text-muted small text-center"
                                    style={{ minWidth: "180px" }}
                                  >
                                    <strong>
                                      {
                                        availableEffects[previewEffectIndex]
                                          ?.name
                                      }
                                    </strong>
                                  </span>
                                  <button
                                    type="button"
                                    className="btn btn-sm btn-outline-secondary"
                                    onClick={() =>
                                      setPreviewEffectIndex(
                                        (prev) =>
                                          (prev + 1) % availableEffects.length,
                                      )
                                    }
                                    data-testid="button-next-effect"
                                    title="Next effect"
                                  >
                                    <ArrowRight size={16} />
                                  </button>
                                </div>
                              )}
                              <p className="text-center text-muted small mt-3 mb-0">
                                <i className="bi bi-info-circle me-1"></i>
                                {imageUrl
                                  ? "Your featured image is being used as the ticket background"
                                  : "Upload a featured image to customize the ticket background"}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Special Features Section */}
                      <div className="col-12">
                        <div
                          style={{
                            background: "#c0c0c0",
                            border: "3px solid",
                            borderColor: "#ffffff #000000 #000000 #ffffff",
                            boxShadow: "1px 1px 0 #808080",
                            marginBottom: "20px",
                          }}
                        >
                          <div
                            style={{
                              background:
                                "linear-gradient(to right, #000080, #1084d0)",
                              padding: "2px 4px",
                              marginBottom: "1px",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                            }}
                          >
                            <div
                              className="text-white fw-bold"
                              style={{
                                fontSize: "11px",
                                fontFamily: "Tahoma, sans-serif",
                              }}
                            >
                              Special Features
                            </div>
                            <div
                              style={{
                                width: "13px",
                                height: "11px",
                                background: "#c0c0c0",
                                border: "1px solid",
                                borderColor: "#ffffff #000000 #000000 #ffffff",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontSize: "9px",
                                fontWeight: "bold",
                                lineHeight: "1",
                                cursor: "pointer",
                              }}
                            >
                              ×
                            </div>
                          </div>
                          <div style={{ padding: "12px" }}>
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
                                      onChange={(e) =>
                                        field.onChange(e.target.checked)
                                      }
                                      data-testid="checkbox-golden-ticket"
                                      disabled={isEditMode}
                                    />
                                    <label
                                      className="form-check-label"
                                      htmlFor="goldenTicketEnabled"
                                    >
                                      <img
                                        src={goldenTicketIcon}
                                        alt=""
                                        style={{
                                          width: "20px",
                                          height: "20px",
                                          marginRight: "8px",
                                          verticalAlign: "middle",
                                        }}
                                      />
                                      Golden Tickets
                                      {isEditMode && (
                                        <span className="text-muted ms-2">
                                          (read-only)
                                        </span>
                                      )}
                                    </label>
                                  </div>
                                  <div className="form-text">
                                    Random ticket(s) will be golden when
                                    validated
                                    {isEditMode
                                      ? " (This setting is read-only after event creation)"
                                      : ""}
                                    .
                                  </div>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            {form.watch("goldenTicketEnabled") && (
                              <FormField
                                control={form.control}
                                name="goldenTicketCount"
                                render={({ field }) => (
                                  <FormItem className="mb-3">
                                    <FormLabel>
                                      Number of Golden Tickets
                                    </FormLabel>
                                    <FormControl>
                                      <Input
                                        {...field}
                                        type="number"
                                        min="1"
                                        max="100"
                                        placeholder="Enter number of golden tickets"
                                        className="form-control"
                                        data-testid="input-golden-number"
                                        value={field.value || ""}
                                        onKeyPress={(e) => {
                                          // Prevent non-numeric characters
                                          if (
                                            !/[0-9]/.test(e.key) &&
                                            e.key !== "Backspace" &&
                                            e.key !== "Delete"
                                          ) {
                                            e.preventDefault();
                                          }
                                        }}
                                        onChange={(e) => {
                                          // Only allow numbers
                                          const rawValue =
                                            e.target.value.replace(
                                              /[^0-9]/g,
                                              "",
                                            );
                                          if (rawValue === "") {
                                            field.onChange(undefined);
                                            return;
                                          }

                                          const value = parseInt(rawValue);
                                          const maxTickets =
                                            form.getValues("maxTickets");
                                          const maxGoldenTickets = maxTickets
                                            ? Math.floor(maxTickets / 2)
                                            : 100;

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
                                      Maximum number of golden tickets that can
                                      be won for this event
                                      {form.watch("maxTickets") && (
                                        <span className="text-muted">
                                          {" "}
                                          (limit:{" "}
                                          {Math.floor(
                                            (form.watch("maxTickets") || 0) / 2,
                                          )}{" "}
                                          - half of total tickets)
                                        </span>
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
                                      onChange={(e) =>
                                        field.onChange(e.target.checked)
                                      }
                                      data-testid="checkbox-special-effects"
                                      disabled={isEditMode}
                                    />
                                    <label
                                      className="form-check-label"
                                      htmlFor="specialEffectsEnabled"
                                    >
                                      <img
                                        src={specialEffectsIcon}
                                        alt=""
                                        style={{
                                          width: "20px",
                                          height: "20px",
                                          marginRight: "8px",
                                          verticalAlign: "middle",
                                        }}
                                      />
                                      Special Effects
                                      {isEditMode && (
                                        <span className="text-muted ms-2">
                                          (read-only)
                                        </span>
                                      )}
                                    </label>
                                  </div>
                                  <div className="form-text">
                                    Validated tickets may display special visual
                                    effects on holidays and themed events. These
                                    effects are randomly assigned, not all
                                    tickets will get an effect
                                    {isEditMode
                                      ? " (This setting is read-only after event creation)"
                                      : ""}
                                    .
                                  </div>
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
                                checked={
                                  stickerEnabled || !!form.watch("stickerUrl")
                                }
                                onChange={(e) => {
                                  if (!form.watch("stickerUrl")) {
                                    setStickerEnabled(e.target.checked);
                                  }
                                }}
                                disabled={isEditMode}
                                data-testid="checkbox-sticker-enabled"
                              />
                              <label
                                className="form-check-label"
                                htmlFor="stickerEnabled"
                              >
                                <img
                                  src={customStickerIcon}
                                  alt=""
                                  style={{
                                    width: "20px",
                                    height: "20px",
                                    marginRight: "8px",
                                    verticalAlign: "middle",
                                  }}
                                />
                                Custom Sticker
                                {isEditMode && (
                                  <span className="text-muted ms-2">
                                    (read-only)
                                  </span>
                                )}
                              </label>
                            </div>
                            {isEditMode && event?.stickerUrl && (
                              <div className="form-text text-info">
                                <small>
                                  ✓ Sticker configured. This feature cannot be
                                  removed once added.
                                </small>
                              </div>
                            )}
                            {!form.watch("stickerUrl") && stickerEnabled && (
                              <div className="form-text">
                                Enter a URL for a custom sticker that will float
                                on lucky tickets
                                {isEditMode
                                  ? " (This setting is read-only after event creation)"
                                  : ""}
                                .
                              </div>
                            )}

                            {/* Custom Sticker URL - shows when checkbox is checked */}
                            {(stickerEnabled || form.watch("stickerUrl")) && (
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
                                          value={field.value || ""}
                                          disabled={
                                            isEditMode && !!event?.stickerUrl
                                          }
                                          data-testid="input-sticker-url"
                                        />
                                      </FormControl>
                                      <div className="form-text">
                                        Enter a direct URL to a PNG or GIF image
                                        (transparent PNGs work best)
                                      </div>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />

                                {form.watch("stickerUrl") && (
                                  <div className="d-flex align-items-center gap-3 mb-3">
                                    <img
                                      src={form.watch("stickerUrl") || ""}
                                      alt="Sticker preview"
                                      style={{
                                        maxHeight: "60px",
                                        maxWidth: "60px",
                                      }}
                                      onError={(e) => {
                                        (
                                          e.target as HTMLImageElement
                                        ).style.display = "none";
                                      }}
                                    />
                                    <span className="text-success small">
                                      ✓ Sticker URL configured
                                    </span>
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
                                          style={{ width: "100px" }}
                                          min="1"
                                          max="100"
                                          value={field.value || 25}
                                          onChange={(e) => {
                                            const val = parseInt(
                                              e.target.value,
                                            );
                                            if (val >= 1 && val <= 100) {
                                              field.onChange(val);
                                            }
                                          }}
                                          disabled={!form.watch("stickerUrl")}
                                          data-testid="input-sticker-odds"
                                        />
                                        <span className="text-muted">%</span>
                                      </div>
                                      <div className="form-text">
                                        Percentage of validated tickets that
                                        will display the custom sticker (1-100)
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
                                      onChange={(e) =>
                                        field.onChange(e.target.checked)
                                      }
                                      data-testid="checkbox-allow-minting"
                                    />
                                    <label
                                      className="form-check-label"
                                      htmlFor="allowMinting"
                                    >
                                      <img
                                        src={mintingIcon}
                                        alt=""
                                        style={{
                                          width: "20px",
                                          height: "20px",
                                          marginRight: "8px",
                                          verticalAlign: "middle",
                                        }}
                                      />
                                      Allow Digital Collectable Minting
                                      {isEditMode && event?.allowMinting && (
                                        <span className="text-muted ms-2">
                                          (cannot be disabled once saved)
                                        </span>
                                      )}
                                    </label>
                                  </div>
                                  <div className="form-text">
                                    Attendees will be allowed to mint a digital
                                    collectible of the event ticket. The details
                                    seen in the ticket preview will be publicly
                                    accessible if enabled. Digital collectible
                                    will be issued on the Coinbase L2 network
                                    (Base, Ethereum)
                                    {isEditMode && !event?.allowMinting
                                      ? ". This can be enabled after event creation, but once enabled it cannot be disabled"
                                      : isEditMode && event?.allowMinting
                                        ? ". Once saved with minting enabled, it cannot be disabled"
                                        : ""}
                                    .
                                  </div>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                        </div>
                      </div>

                      <div className="col-12">
                        <div className="d-flex gap-2">
                          <button
                            type="submit"
                            className="btn btn-primary"
                            disabled={
                              createEventMutation.isPending ||
                              updateEventMutation.isPending ||
                              (!isEditMode &&
                                (form.watch("maxTickets") || 100) >
                                  creditBalance)
                            }
                            data-testid="button-save-event"
                          >
                            {createEventMutation.isPending ||
                            updateEventMutation.isPending
                              ? "Please hold..."
                              : !isEditMode
                                ? (form.watch("maxTickets") || 100) >
                                  creditBalance
                                  ? "Not Enough Credits"
                                  : `Create for -${form.watch("maxTickets") || 100} Credits`
                                : "Save"}
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
