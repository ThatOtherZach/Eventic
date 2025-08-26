import { useState, useEffect } from "react";
import { useParams, Link, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ArrowLeft, Save, Image, CreditCard } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useNotifications } from "@/hooks/use-notifications";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { ObjectUploader } from "@/components/ObjectUploader";
import { TicketCard } from "@/components/tickets/ticket-card";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";
import type { Event, Ticket } from "@shared/schema";
import { countries } from "@/lib/countries";

interface EventWithTicketInfo extends Event {
  ticketsSold?: number;
  ticketsAvailable?: number | null;
}

export default function EventEditPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { toast } = useToast();
  const { addNotification } = useNotifications();
  const [, setLocation] = useLocation();
  const [ticketsSold, setTicketsSold] = useState(0);
  
  // Address component states
  const [address, setAddress] = useState<string>("");
  const [city, setCity] = useState<string>("");
  const [country, setCountry] = useState<string>("");

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    venue: "",
    date: "",
    time: "",
    endDate: "",
    endTime: "",
    ticketPrice: "",
    maxTickets: "",
    imageUrl: "",
    earlyValidation: "Allow at Anytime",
    reentryType: "No Reentry (Single Use)",
    maxUses: 1,
    goldenTicketEnabled: false,
    goldenTicketCount: undefined as number | undefined,
    specialEffectsEnabled: false,
    allowMinting: false,
    isPrivate: false,
    oneTicketPerUser: false,
    surgePricing: false,
    raffleEnabled: false,
  });

  const { data: event, isLoading } = useQuery<EventWithTicketInfo>({
    queryKey: [`/api/events/${id}`],
    enabled: !!id,
  });

  useEffect(() => {
    if (event) {
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
      
      setFormData({
        name: event.name,
        description: event.description || "",
        venue: event.venue,
        date: event.date,
        time: event.time,
        endDate: event.endDate || "",
        endTime: event.endTime || "",
        ticketPrice: event.ticketPrice,
        maxTickets: event.maxTickets?.toString() || "",
        imageUrl: event.imageUrl || "",
        earlyValidation: event.earlyValidation || "Allow at Anytime",
        reentryType: event.reentryType || "No Reentry (Single Use)",
        maxUses: event.maxUses || 1,
        goldenTicketEnabled: event.goldenTicketEnabled || false,
        goldenTicketCount: event.goldenTicketCount || undefined,
        specialEffectsEnabled: event.specialEffectsEnabled || false,
        allowMinting: event.allowMinting || false,
        isPrivate: event.isPrivate || false,
        oneTicketPerUser: event.oneTicketPerUser || false,
        surgePricing: event.surgePricing || false,
        raffleEnabled: event.raffleEnabled || false,
      });
      
      // Store tickets sold for validation
      setTicketsSold(event.ticketsSold || 0);
    }
  }, [event, user, toast, setLocation, id]);

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
      // Check if it's a rate limit error (429)
      const isRateLimit = error.message?.includes("429:");
      
      if (isRateLimit) {
        addNotification({
          type: "warning",
          title: "Event Creation Limit Reached",
          description: "You've reached the maximum number of event creation attempts. Please wait before creating another event.",
        });
      } else {
        addNotification({
          type: "error",
          title: "Error",
          description: error.message || "Failed to update event",
        });
      }
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
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
    
    // Update formData with combined venue
    formData.venue = venueString;
    
    // Validate max tickets against tickets sold and maximum limit
    if (formData.maxTickets) {
      const maxTicketValue = parseInt(formData.maxTickets);
      if (maxTicketValue < ticketsSold) {
        toast({
          title: "Invalid ticket limit",
          description: `Cannot set maximum tickets below ${ticketsSold} (tickets already sold)`,
          variant: "destructive",
        });
        return;
      }
      if (maxTicketValue > 5000) {
        toast({
          title: "Invalid ticket limit",
          description: "Maximum tickets cannot exceed 5,000",
          variant: "destructive",
        });
        return;
      }
    }
    
    // Validate end date/time if both are provided
    if (formData.endDate && formData.endTime) {
      const startDateTime = new Date(`${formData.date}T${formData.time}`);
      const endDateTime = new Date(`${formData.endDate}T${formData.endTime}`);
      
      if (endDateTime <= startDateTime) {
        toast({
          title: "Invalid end date/time",
          description: "End date/time must be after start date/time",
          variant: "destructive",
        });
        return;
      }
    }
    
    const updateData: any = {
      name: formData.name,
      description: formData.description || null,
      venue: formData.venue,
      date: formData.date,
      time: formData.time,
      endDate: formData.endDate || null,
      endTime: formData.endTime || null,
      ticketPrice: formData.ticketPrice,
    };

    if (formData.maxTickets) {
      updateData.maxTickets = parseInt(formData.maxTickets);
    }

    if (formData.imageUrl) {
      updateData.imageUrl = formData.imageUrl;
    }

    // Use featured image for ticket background
    if (formData.imageUrl) {
      updateData.ticketBackgroundUrl = formData.imageUrl;
    }

    updateEventMutation.mutate(updateData);
  };

  const handleImageUpload = async () => {
    const response = await apiRequest("POST", "/api/objects/upload", {});
    const data = await response.json();
    return {
      method: "PUT" as const,
      url: data.uploadURL,
    };
  };

  const handleImageComplete = async (result: any) => {
    // Extract the uploaded URL from the result
    const uploadedUrl = result.successful?.[0]?.uploadURL;
    if (uploadedUrl) {
      // The URL needs to be normalized to /objects/ path format
      // We'll send it to the server which will normalize it
      setFormData(prev => ({ ...prev, imageUrl: uploadedUrl }));
      toast({
        title: "Image uploaded",
        description: "Save the event to apply changes",
      });
    }
  };



  // Create a sample ticket for preview
  const sampleTicket: Ticket = {
    id: "sample",
    eventId: id || "",
    userId: user?.id || "",
    ticketNumber: "ABC-001",
    qrData: "",
    isValidated: false,
    validatedAt: null,
    validationCode: null,
    useCount: 0,
    isGoldenTicket: false,
    createdAt: new Date(),
    recipientName: "Sample User",
    recipientEmail: user?.email || "user@example.com",
    seatNumber: null,
    ticketType: null,
    transferable: false,
    status: "pending",
    purchaserEmail: null,
    purchaserIp: null,
    purchasePrice: "0",
    resellStatus: "not_for_resale",
    originalOwnerId: null,
    isRaffleWinner: false,
    raffleWonAt: null,
  };

  const previewEvent: Event = {
    id: id || "",
    name: formData.name || "Event Name",
    description: formData.description,
    venue: formData.venue || "Venue",
    country: null,
    date: formData.date || "2024-01-01",
    time: formData.time || "19:00",
    endDate: formData.endDate || null,
    endTime: formData.endTime || null,
    ticketPrice: formData.ticketPrice || "0",
    maxTickets: formData.maxTickets ? parseInt(formData.maxTickets) : null,
    userId: user?.id || null,
    imageUrl: formData.imageUrl,
    ticketBackgroundUrl: formData.imageUrl, // Use featured image for ticket background
    earlyValidation: formData.earlyValidation || "Allow at Anytime",
    reentryType: formData.reentryType || "No Reentry (Single Use)",
    maxUses: formData.maxUses || 1,
    goldenTicketEnabled: formData.goldenTicketEnabled || false,
    goldenTicketCount: formData.goldenTicketCount || null,
    specialEffectsEnabled: formData.specialEffectsEnabled || false,
    allowMinting: formData.allowMinting || false,
    isPrivate: formData.isPrivate || false,
    isEnabled: true,
    ticketPurchasesEnabled: true,
    oneTicketPerUser: formData.oneTicketPerUser || false,
    surgePricing: formData.surgePricing || false,
    raffleEnabled: formData.raffleEnabled || false,
    createdAt: new Date(),
  };

  if (isLoading) {
    return (
      <div className="container py-5">
        <div className="text-center">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="container py-5">
        <div className="alert alert-warning">
          Please <Link href="/auth">sign in</Link> to edit events.
        </div>
      </div>
    );
  }

  return (
    <div className="container py-5">
      {/* Header Section */}
      <div className="row mb-4">
        <div className="col">
          <div className="d-flex justify-content-between align-items-center">
            <div>
              <h1 className="display-5 fw-bold mb-2">Edit Event</h1>
              <p className="text-muted">Update your event details</p>
            </div>
            <Link href={`/events/${id}`}>
              <button className="btn btn-outline-secondary">
                <ArrowLeft size={18} className="me-2" />
                Back to Event
              </button>
            </Link>
          </div>
        </div>
      </div>

      <div className="row">
        <div className="col-lg-8">
          <form onSubmit={handleSubmit}>
            {/* Basic Information Card */}
            <div className="card mb-4">
              <div className="card-body">
                <h5 className="card-title mb-4">Basic Information</h5>
                
                <div className="row">
                  <div className="col-12">
                    <div className="mb-3">
                      <label htmlFor="name" className="form-label">Event Name *</label>
                      <input
                        type="text"
                        className="form-control"
                        id="name"
                        value={formData.name}
                        disabled
                        title="Event name cannot be changed after creation"
                        data-testid="input-name"
                      />
                      <small className="text-muted">Event name cannot be changed after creation</small>
                    </div>
                  </div>

                  <div className="col-12">
                    <div className="mb-3">
                      <label htmlFor="description" className="form-label">Description</label>
                      <ReactQuill 
                        theme="snow"
                        value={formData.description}
                        onChange={(value) => setFormData({ ...formData, description: value })}
                        placeholder="Tell people about your event..."
                        className="bg-white"
                        data-testid="input-description"
                        modules={{
                          toolbar: [
                            [{ 'header': [1, 2, 3, false] }],
                            ['bold', 'italic', 'underline', 'strike'],
                            [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                            ['link'],
                            ['clean']
                          ]
                        }}
                      />
                    </div>
                  </div>

                  <div className="col-12">
                    <div className="mb-3">
                      <label className="form-label text-dark">Venue Location</label>
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
                      {!address && !city && !country && (
                        <div className="text-danger small mt-1">A venue name is required. City and Country are optional.</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Date & Time Card */}
            <div className="card mb-4">
              <div className="card-body">
                <h5 className="card-title mb-4">Date & Time</h5>
                
                <div className="row">
                  <div className="col-12">
                    <div className="mb-3">
                      <label className="form-label fw-bold">Starts on *</label>
                      <div className="row">
                        <div className="col-md-6 mb-2">
                          <input
                            type="date"
                            className="form-control"
                            id="date"
                            value={formData.date}
                            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                            required
                            data-testid="input-date"
                          />
                        </div>
                        <div className="col-md-6 mb-2">
                          <input
                            type="time"
                            className="form-control"
                            id="time"
                            value={formData.time}
                            onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                            required
                            data-testid="input-time"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="col-12">
                    <div className="mb-3">
                      <label className="form-label fw-bold">Ends on <span className="text-muted">(optional)</span></label>
                      <div className="row">
                        <div className="col-md-6 mb-2">
                          <input
                            type="date"
                            className="form-control"
                            id="endDate"
                            value={formData.endDate}
                            onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                            min={formData.date}
                            data-testid="input-endDate"
                          />
                        </div>
                        <div className="col-md-6 mb-2">
                          <input
                            type="time"
                            className="form-control"
                            id="endTime"
                            value={formData.endTime}
                            onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                            data-testid="input-endTime"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Ticketing Card */}
            <div className="card mb-4">
              <div className="card-body">
                <h5 className="card-title mb-4">Ticketing</h5>
                
                <div className="row">
                  <div className="col-md-6">
                    <div className="mb-3">
                      <label htmlFor="ticketPrice" className="form-label">Ticket Price ($) *</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        className="form-control"
                        id="ticketPrice"
                        value={formData.ticketPrice}
                        onChange={(e) => setFormData({ ...formData, ticketPrice: e.target.value })}
                        required
                        data-testid="input-ticketPrice"
                      />
                    </div>
                  </div>

                  <div className="col-md-6">
                    <div className="mb-3">
                      <label htmlFor="maxTickets" className="form-label">Maximum Tickets (optional)</label>
                      <input
                        type="number"
                        min={ticketsSold || 1}
                        max="5000"
                        className="form-control"
                        id="maxTickets"
                        value={formData.maxTickets}
                        onChange={(e) => {
                          const value = e.target.value;
                          if (value && parseInt(value) > 5000) {
                            setFormData({ ...formData, maxTickets: "5000" });
                          } else {
                            setFormData({ ...formData, maxTickets: value });
                          }
                        }}
                        placeholder="Leave empty for unlimited (max 5,000)"
                        data-testid="input-maxTickets"
                      />
                      {ticketsSold > 0 && (
                        <small className="text-muted">
                          Minimum: {ticketsSold} (tickets already sold)
                        </small>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Event Settings Card */}
            <div className="card mb-4">
              <div className="card-body">
                <h5 className="card-title mb-4">Event Settings</h5>
                
                <div className="row">
                  <div className="col-md-6">
                    <div className="mb-3">
                      <label htmlFor="earlyValidation" className="form-label">Ticket Validation Timing</label>
                      <select
                        className="form-select"
                        id="earlyValidation"
                        value={formData.earlyValidation}
                        disabled
                        title="Validation timing cannot be changed after creation"
                        data-testid="select-earlyValidation"
                      >
                        <option value="Allow at Anytime">Allow at Anytime</option>
                        <option value="Two Hours Before">Two Hours Before</option>
                        <option value="One Hour Before">One Hour Before</option>
                        <option value="At Start Time">At Start Time</option>
                      </select>
                      <small className="text-muted">Validation timing cannot be changed after event creation</small>
                    </div>
                  </div>

                  <div className="col-md-6">
                    <div className="mb-3">
                      <label htmlFor="reentryType" className="form-label">Re-entry Policy</label>
                      <select
                        className="form-select"
                        id="reentryType"
                        value={formData.reentryType}
                        disabled
                        title="Re-entry policy cannot be changed after creation"
                        data-testid="select-reentryType"
                      >
                        <option value="No Reentry (Single Use)">No Re-entry (Single Use)</option>
                        <option value="Pass (Multiple Use)">Pass (Multiple Use)</option>
                        <option value="No Limit">No Limit</option>
                      </select>
                      <small className="text-muted">Re-entry policy cannot be changed after event creation</small>
                    </div>
                  </div>

                  {formData.reentryType === 'Pass (Multiple Use)' && (
                    <div className="col-12">
                      <div className="mb-3">
                        <label htmlFor="maxUses" className="form-label">Number of Uses</label>
                        <input
                          type="number"
                          className="form-control"
                          id="maxUses"
                          value={formData.maxUses}
                          disabled
                          title="Number of uses cannot be changed after creation"
                          data-testid="input-maxUses"
                        />
                        <small className="text-muted">Number of uses cannot be changed after event creation</small>
                      </div>
                    </div>
                  )}

                </div>
              </div>
            </div>

            {/* Additional Features Card */}
            <div className="card mb-4">
              <div className="card-body">
                <h5 className="card-title mb-4">Additional Features</h5>
                
                <div className="row">
                  <div className="col-12">
                    <div className="mb-3">
                      <div className="form-check">
                        <input
                          type="checkbox"
                          className="form-check-input"
                          id="goldenTicketEnabled"
                          checked={formData.goldenTicketEnabled}
                          disabled
                          title="Golden ticket contest cannot be changed after creation"
                          data-testid="checkbox-goldenTicket"
                        />
                        <label className="form-check-label" htmlFor="goldenTicketEnabled">
                          <span className="badge bg-warning text-dark me-2">🎫</span>
                          Golden Ticket Contest Enabled
                        </label>
                      </div>
                      <small className="text-muted">Golden ticket contest settings cannot be changed after event creation</small>
                    </div>
                  </div>

                  {formData.goldenTicketEnabled && (
                    <div className="col-12">
                      <div className="mb-3">
                        <label htmlFor="goldenTicketCount" className="form-label">Number of Golden Tickets</label>
                        <input
                          type="number"
                          className="form-control"
                          id="goldenTicketCount"
                          value={formData.goldenTicketCount || ''}
                          disabled
                          title="Golden ticket count cannot be changed after creation"
                          data-testid="input-goldenTicketCount"
                        />
                        <small className="text-muted">
                          Number of golden tickets cannot be changed after event creation
                          {formData.maxTickets && (
                            <span> (limit: {Math.floor(parseInt(formData.maxTickets) / 2)} - half of total tickets)</span>
                          )}
                        </small>
                      </div>
                    </div>
                  )}

                  <div className="col-12">
                    <div className="mb-3">
                      <div className="form-check">
                        <input
                          type="checkbox"
                          className="form-check-input"
                          id="oneTicketPerUser"
                          checked={formData.oneTicketPerUser}
                          disabled
                          title="Ticket purchase limit cannot be changed after creation"
                          data-testid="checkbox-oneTicketPerUser"
                        />
                        <label className="form-check-label" htmlFor="oneTicketPerUser">
                          <span className="badge bg-info text-white me-2">👤</span>
                          One Ticket Per User Limit
                        </label>
                      </div>
                      <small className="text-muted">
                        Ticket purchase limit cannot be changed after event creation. 
                        {formData.oneTicketPerUser && " Users are limited to purchasing one ticket (tracked by email and IP)."}
                      </small>
                    </div>
                  </div>

                  <div className="col-12">
                    <div className="mb-3">
                      <div className="form-check">
                        <input
                          type="checkbox"
                          className="form-check-input"
                          id="surgePricing"
                          checked={formData.surgePricing}
                          onChange={() => {}}
                          disabled
                          title="Surge pricing setting cannot be changed after creation"
                          data-testid="checkbox-surgePricing"
                        />
                        <label className="form-check-label" htmlFor="surgePricing">
                          <span className="badge bg-warning text-dark me-2">📈</span>
                          Surge Pricing
                        </label>
                      </div>
                      <small className="text-muted">
                        Surge pricing setting cannot be changed after event creation. 
                        {formData.surgePricing && " Ticket prices increase dynamically as more tickets are sold."}
                      </small>
                    </div>
                  </div>

                  <div className="col-12">
                    <div className="mb-3">
                      <div className="form-check">
                        <input
                          type="checkbox"
                          className="form-check-input"
                          id="specialEffectsEnabled"
                          checked={formData.specialEffectsEnabled}
                          disabled
                          title="Special effects settings cannot be changed after creation"
                          data-testid="checkbox-specialEffects"
                        />
                        <label className="form-check-label" htmlFor="specialEffectsEnabled">
                          <span className="badge bg-primary me-2">✨</span>
                          Special Effects Enabled
                        </label>
                      </div>
                      <small className="text-muted">
                        Special effects settings cannot be changed after event creation.
                        {formData.specialEffectsEnabled && " Validated tickets may display special visual effects on holidays and themed events."}
                      </small>
                    </div>
                  </div>

                  <div className="col-12">
                    <div className="mb-3">
                      <div className="form-check">
                        <input
                          type="checkbox"
                          className="form-check-input"
                          id="raffleEnabled"
                          checked={formData.raffleEnabled || false}
                          onChange={(e) => setFormData({ ...formData, raffleEnabled: e.target.checked })}
                          disabled={event?.raffleEnabled === true}
                          title={event?.raffleEnabled ? "Raffle cannot be disabled once enabled" : "Enable raffle feature for this event"}
                          data-testid="checkbox-raffle-enabled"
                        />
                        <label className="form-check-label" htmlFor="raffleEnabled">
                          <span className="badge bg-success text-white me-2">🎁</span>
                          Enable Raffle Feature
                        </label>
                      </div>
                      <small className="text-muted">
                        {event?.raffleEnabled 
                          ? "Raffle is enabled for this event and cannot be disabled."
                          : "Allow random selection of winners from ticket holders. Cannot be disabled once enabled."}
                      </small>
                    </div>
                  </div>

                  <div className="col-12">
                    <div className="mb-3">
                      <div className="form-check">
                        <input
                          type="checkbox"
                          className="form-check-input"
                          id="allowMinting"
                          checked={formData.allowMinting}
                          disabled
                          title="NFT minting settings cannot be changed after creation"
                          data-testid="checkbox-allowMinting"
                        />
                        <label className="form-check-label" htmlFor="allowMinting">
                          <span className="badge bg-info text-dark me-2">NFT</span>
                          NFT Minting Allowed
                        </label>
                      </div>
                      <small className="text-muted">
                        NFT minting settings cannot be changed after event creation.
                        {formData.allowMinting && " Attendees can mint their validated tickets as digital collectibles."}
                      </small>
                    </div>
                  </div>

                  <div className="col-12">
                    <div className="mb-3">
                      <div className="form-check">
                        <input
                          type="checkbox"
                          className="form-check-input"
                          id="isPrivate"
                          checked={formData.isPrivate}
                          disabled
                          title="Private event settings cannot be changed after creation"
                          data-testid="checkbox-isPrivate"
                        />
                        <label className="form-check-label" htmlFor="isPrivate">
                          <span className="badge bg-secondary me-2">Private</span>
                          Private Event
                        </label>
                      </div>
                      <small className="text-muted">
                        Private event settings cannot be changed after event creation.
                        {formData.isPrivate && " This event is excluded from search results and cannot be featured or boosted. Only accessible by direct link."}
                      </small>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Event Image Card */}
            <div className="card mb-4">
              <div className="card-body">
                <h5 className="card-title mb-4">Event Image</h5>
                
                <div className="mb-3">
                  <label className="form-label">
                    <Image size={18} className="me-2" />
                    Feature Image
                  </label>
                  <ObjectUploader
                    onGetUploadParameters={handleImageUpload}
                    onComplete={(result) => handleImageComplete(result)}
                    buttonClassName="btn btn-outline-primary"
                    currentImageUrl={formData.imageUrl}
                  >
                    <Image size={18} className="me-2" />
                    Choose Image
                  </ObjectUploader>
                  <small className="text-muted d-block mt-2">
                    Recommended size: 1200x630px (16:9 ratio) for best display
                  </small>
                </div>
              </div>
            </div>

            {/* Ticket Preview Card */}
            <div className="card mb-4">
              <div className="card-body">
                <h5 className="card-title mb-4">
                  <CreditCard size={18} className="me-2" />
                  Ticket Preview
                </h5>
                <p className="text-muted small mb-3">
                  Your featured image will be used as the ticket background. Tickets are business card sized (3.5" x 2").
                </p>
                
                <div className="d-flex justify-content-center p-3 bg-light rounded">
                  <TicketCard 
                    ticket={sampleTicket} 
                    event={previewEvent} 
                    showQR={false}
                  />
                </div>
                
                <small className="text-muted d-block mt-2">
                  The ticket displays event details on the left and a QR code on the right.
                </small>
              </div>
            </div>

            {/* Submit Buttons */}
            <div className="d-flex gap-2">
              <button
                type="submit"
                className="btn btn-primary btn-lg px-5"
                disabled={updateEventMutation.isPending}
                data-testid="button-save"
              >
                {updateEventMutation.isPending ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save size={18} className="me-2" />
                    Save Changes
                  </>
                )}
              </button>
              
              <Link href={`/events/${id}`}>
                <button type="button" className="btn btn-outline-secondary btn-lg">
                  Cancel
                </button>
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}