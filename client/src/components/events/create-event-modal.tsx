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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

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

  const form = useForm<InsertEvent>({
    resolver: zodResolver(insertEventSchema),
    defaultValues: {
      name: "",
      description: "",
      venue: "",
      date: "",
      time: "",
      ticketPrice: "0",
      maxTickets: undefined,
      imageUrl: undefined,
      ticketBackgroundUrl: undefined,
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
    createdAt: new Date(),
  };

  const watchedValues = form.watch();
  const previewEvent: Event = {
    id: "preview",
    name: watchedValues.name || "Event Name",
    description: watchedValues.description || null,
    venue: watchedValues.venue || "Venue",
    date: watchedValues.date || "2024-01-01",
    time: watchedValues.time || "19:00",
    ticketPrice: watchedValues.ticketPrice || "0",
    maxTickets: watchedValues.maxTickets || null,
    userId: user?.id || null,
    imageUrl: imageUrl || null,
    ticketBackgroundUrl: ticketBackgroundUrl || null,
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

            <div className="row mb-3">
              <div className="col-6">
                <FormField
                  control={form.control}
                  name="date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date <span className="text-danger">*</span></FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          type="date"
                          className="form-control"
                          data-testid="input-event-date"
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
                      <FormLabel>Time <span className="text-danger">*</span></FormLabel>
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
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea 
                        {...field} 
                        value={field.value || ""}
                        rows={3}
                        placeholder="Enter event description"
                        className="form-control"
                        data-testid="textarea-event-description"
                      />
                    </FormControl>
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
                          placeholder="Unlimited"
                          className="form-control"
                          data-testid="input-max-tickets"
                          value={field.value || ""}
                          onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <div className="mb-3">
              <label className="form-label">
                <Image size={18} className="me-2" />
                Feature Image
              </label>
              <ObjectUploader
                onGetUploadParameters={handleImageUpload}
                onComplete={(result) => handleImageComplete(result)}
                buttonClassName="btn btn-outline-primary"
                currentImageUrl={imageUrl}
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
                buttonClassName="btn btn-outline-primary"
                currentImageUrl={ticketBackgroundUrl}
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
              {createEventMutation.isPending ? "Creating..." : "Create Event"}
            </button>
          </ModalFooter>
        </form>
      </Form>
    </Modal>
  );
}