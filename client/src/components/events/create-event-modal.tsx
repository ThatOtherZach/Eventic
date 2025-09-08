import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertEventSchema, type InsertEvent, type Event, type Ticket } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Modal, ModalHeader, ModalBody, ModalFooter } from "@/components/ui/modal";
import { ObjectUploader } from "@/components/ObjectUploader";
import { TicketCard } from "@/components/tickets/ticket-card";
import { CreditCard, Image } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { countCharacters } from "@/lib/text-formatter";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface CreateEventModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateEventModal({ open, onOpenChange }: CreateEventModalProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [imageUrl, setImageUrl] = useState<string>("");
  const [ticketBackgroundUrl, setTicketBackgroundUrl] = useState<string>("");
  
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
      maxTickets: undefined,
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
      paymentProcessing: "None",
      walletAddress: undefined,
    },
  });

  const createEventMutation = useMutation({
    mutationFn: async (data: InsertEvent) => {
      const response = await apiRequest("POST", "/api/events", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      toast({
        title: "Success",
        description: "Event created successfully",
      });
      form.reset();
      onOpenChange(false);
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

    const submitData = {
      ...data,
      imageUrl: imageUrl || undefined,
      ticketBackgroundUrl: ticketBackgroundUrl || undefined,
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
        title: "Image uploaded",
        description: "Image will be included when you create the event",
      });
    }
  };

  const handleTicketBackgroundComplete = (result: any) => {
    // Extract the uploaded URL from the result
    const uploadedUrl = result.successful?.[0]?.uploadURL;
    if (uploadedUrl) {
      // Store the raw URL - it will be normalized by the server
      setTicketBackgroundUrl(uploadedUrl);
      toast({
        title: "Ticket background uploaded",
        description: "Ticket design will be applied when you create the event",
      });
    }
  };

  // Create a sample ticket for preview
  const sampleTicket: Ticket = {
    id: "sample",
    eventId: "sample",
    userId: user?.id || "",
    ticketNumber: "ABC-001",
    qrData: "",
    isValidated: false,
    validatedAt: null,
    validationCode: null,
    useCount: 0,
    isGoldenTicket: false,
    createdAt: new Date(),
  };

  const watchedValues = form.watch();
  const previewEvent: Event = {
    id: "preview",
    name: watchedValues.name || "Event Name",
    description: watchedValues.description || null,
    venue: watchedValues.venue || "Venue",
    country: null,
    date: watchedValues.date || "2024-01-01",
    time: watchedValues.time || "19:00",
    endDate: watchedValues.endDate || null,
    endTime: watchedValues.endTime || null,
    ticketPrice: watchedValues.ticketPrice || "0",
    maxTickets: watchedValues.maxTickets || null,
    userId: user?.id || null,
    imageUrl: imageUrl || null,
    ticketBackgroundUrl: ticketBackgroundUrl || null,
    earlyValidation: watchedValues.earlyValidation || "Allow at Anytime",
    reentryType: watchedValues.reentryType || "No Reentry (Single Use)",
    maxUses: watchedValues.maxUses || 1,
    goldenTicketEnabled: watchedValues.goldenTicketEnabled || false,
    goldenTicketCount: watchedValues.goldenTicketCount || null,
    specialEffectsEnabled: watchedValues.specialEffectsEnabled || false,
    allowMinting: watchedValues.allowMinting || false,
    isPrivate: watchedValues.isPrivate || false,
    createdAt: new Date(),
  };

  return (
    <Modal open={open} onOpenChange={onOpenChange} className="modal-lg">
      <ModalHeader onClose={() => onOpenChange(false)}>
        Create New Event
      </ModalHeader>
      
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <ModalBody>
            <div className="mb-3">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Event Name <span className="text-danger">*</span></FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        placeholder="Enter event name"
                        className="form-control"
                        data-testid="input-event-name"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="mb-3">
              <label className="form-label fw-bold mb-2">Starts on <span className="text-danger">*</span></label>
              <div className="row">
                <div className="col-6">
                  <FormField
                    control={form.control}
                    name="date"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Input 
                            {...field} 
                            type="date"
                            className="form-control"
                            data-testid="input-event-date"
                            min={minDate}
                            max={maxDate}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                
                <div className="col-6">
                  <FormField
                    control={form.control}
                    name="time"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Input 
                            {...field} 
                            type="time"
                            className="form-control"
                            data-testid="input-event-time"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            </div>

            <div className="mb-3">
              <label className="form-label fw-bold mb-2">Ends on <span className="text-muted">(optional)</span></label>
              <div className="row">
                <div className="col-6">
                  <FormField
                    control={form.control}
                    name="endDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Input 
                            {...field}
                            value={field.value || ""} 
                            type="date"
                            className="form-control"
                            data-testid="input-event-end-date"
                            min={form.watch('date') || minDate}
                            max={maxDate}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                
                <div className="col-6">
                  <FormField
                    control={form.control}
                    name="endTime"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Input 
                            {...field}
                            value={field.value || ""} 
                            type="time"
                            className="form-control"
                            data-testid="input-event-end-time"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            </div>

            <div className="mb-3">
              <FormField
                control={form.control}
                name="venue"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Venue <span className="text-danger">*</span></FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        placeholder="Enter venue"
                        className="form-control"
                        data-testid="input-event-venue"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="mb-3">
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
                        rows={6}
                        maxLength={5000}
                        style={{ resize: 'vertical' }}
                      />
                    </FormControl>
                    <FormDescription>
                      Plain text with automatic URL detection. Use hashtags (#example) to categorize your event.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="row">
              <div className="col-6">
                <FormField
                  control={form.control}
                  name="ticketPrice"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Ticket Price</FormLabel>
                      <FormControl>
                        <div className="input-group">
                          <span className="input-group-text">$</span>
                          <Input 
                            {...field} 
                            type="number"
                            step="0.01"
                            min="0"
                            className="form-control"
                            placeholder="0.00"
                            data-testid="input-ticket-price"
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="col-6">
                <FormField
                  control={form.control}
                  name="maxTickets"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Max Tickets</FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          type="number"
                          min="1"
                          max="5000"
                          placeholder="Unlimited (max 5,000)"
                          className="form-control"
                          data-testid="input-max-tickets"
                          value={field.value || ""}
                          onChange={(e) => {
                            const value = e.target.value ? parseInt(e.target.value) : undefined;
                            if (value && value > 5000) {
                              field.onChange(5000);
                            } else {
                              field.onChange(value);
                            }
                            
                            // Update golden ticket count if it exceeds new limit
                            const currentGoldenCount = form.getValues('goldenTicketCount');
                            if (value && currentGoldenCount) {
                              const maxGoldenTickets = Math.floor(value / 2);
                              if (currentGoldenCount > maxGoldenTickets) {
                                form.setValue('goldenTicketCount', maxGoldenTickets);
                              }
                            }
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <div className="mb-3">
              <FormField
                control={form.control}
                name="earlyValidation"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Ticket Validation Timing</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || "Allow at Anytime"}>
                      <FormControl>
                        <SelectTrigger className="form-control" data-testid="select-early-validation">
                          <SelectValue placeholder="Select when validation starts" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Allow at Anytime">Allow at Anytime</SelectItem>
                        <SelectItem value="Two Hours Before">Two Hours Before</SelectItem>
                        <SelectItem value="One Hour Before">One Hour Before</SelectItem>
                        <SelectItem value="At Start Time">At Start Time</SelectItem>
                      </SelectContent>
                    </Select>
                    <div className="form-text">When ticket validation can begin relative to event start time</div>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="mb-3">
              <FormField
                control={form.control}
                name="reentryType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Re-entry Policy</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || "No Reentry (Single Use)"}>
                      <FormControl>
                        <SelectTrigger className="form-control" data-testid="select-reentry-type">
                          <SelectValue placeholder="Select re-entry policy" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="No Reentry (Single Use)">No Re-entry (Single Use)</SelectItem>
                        <SelectItem value="Pass (Multiple Use)">Pass (Multiple Use)</SelectItem>
                        <SelectItem value="No Limit">No Limit</SelectItem>
                      </SelectContent>
                    </Select>
                    <div className="form-text">How many times a ticket can be used for entry</div>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {form.watch('reentryType') === 'Pass (Multiple Use)' && (
              <div className="mb-3">
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

            <div className="mb-3">
              <FormField
                control={form.control}
                name="goldenTicketEnabled"
                render={({ field }) => (
                  <FormItem>
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
            </div>

            {form.watch('goldenTicketEnabled') && (
              <div className="mb-3">
                <FormField
                  control={form.control}
                  name="goldenTicketCount"
                  render={({ field }) => (
                    <FormItem>
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
              </div>
            )}

            <div className="mb-3">
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
            </div>

            <div className="mb-3">
              <FormField
                control={form.control}
                name="allowMinting"
                render={({ field }) => (
                  <FormItem>
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
                        <span className="badge bg-info text-dark me-2">NFT</span>
                        Allow Minting
                      </label>
                    </div>
                    <div className="form-text">Attendees will be allowed to mint a digital collectible of the event ticket. Some details of the ticket can be listed publicly if this is enabled.</div>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="mb-3">
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
                        <span className="badge bg-secondary me-2">Private</span>
                        Private Event
                      </label>
                    </div>
                    <div className="form-text">Private events are excluded from search results and cannot be featured or boosted. Only accessible by direct link. This setting cannot be changed after creation.</div>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="mb-3">
              <label className="form-label">
                <Image size={18} className="me-2" />
                Feature Image
              </label>
              <div className="form-text mb-2">Maximum file size: 5MB. Accepted formats: JPEG, JPG, PNG, GIF</div>
              <ObjectUploader
                onGetUploadParameters={handleImageUpload}
                onComplete={(result) => handleImageComplete(result)}
                buttonClassName="btn btn-secondary"
                currentImageUrl={imageUrl}
                accept="image/jpeg,image/jpg,image/png,image/gif"
                maxFileSize={5 * 1024 * 1024}
              >
                <Image size={18} className="me-2" />
                Choose Image
              </ObjectUploader>
            </div>

            <div className="mb-3">
              <label className="form-label">
                <CreditCard size={18} className="me-2" />
                Ticket Design
              </label>
              <p className="text-muted small mb-3">
                Customize the background image for your event tickets. Tickets are business card sized (3.5" x 2"); event details will be on the left and a QR code for validation will be on the right.
              </p>
              
              {/* Ticket Preview */}
              <div className="mb-3">
                <div className="d-flex justify-content-center p-3 bg-light rounded">
                  <TicketCard 
                    ticket={sampleTicket} 
                    event={previewEvent} 
                    showQR={false}
                  />
                </div>
              </div>

              <ObjectUploader
                onGetUploadParameters={handleImageUpload}
                onComplete={(result) => handleTicketBackgroundComplete(result)}
                buttonClassName="btn btn-secondary"
                currentImageUrl={ticketBackgroundUrl}
                accept="image/jpeg,image/jpg,image/png,image/gif"
                maxFileSize={5 * 1024 * 1024}
              >
                <CreditCard size={18} className="me-2" />
                Upload Background Image
              </ObjectUploader>
            </div>
          </ModalBody>
          
          <ModalFooter>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => onOpenChange(false)}
              data-testid="button-cancel-create"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={createEventMutation.isPending}
              data-testid="button-submit-create"
            >
              {createEventMutation.isPending ? "Creating..." : (() => {
                const maxTickets = parseInt(form.watch('maxTickets') as string) || 0;
                const paymentProcessing = form.watch('paymentProcessing') || 'None';
                
                // Base cost: always charge for event capacity  
                let baseCost = maxTickets;
                
                // Calculate payment processing fee if enabled
                let paymentFee = 0;
                if (paymentProcessing && paymentProcessing !== 'None') {
                  if (paymentProcessing === 'Ethereum' || paymentProcessing === 'Bitcoin') {
                    paymentFee = 100;
                  } else if (paymentProcessing === 'USDC') {
                    paymentFee = 50;
                  }
                }
                
                // Total tickets needed = base cost + payment processing fee
                const ticketsNeeded = baseCost + paymentFee;
                
                return ticketsNeeded > 0 ? `Create for ${ticketsNeeded} Tickets` : "Create Event";
              })()}
            </button>
          </ModalFooter>
        </form>
      </Form>
    </Modal>
  );
}