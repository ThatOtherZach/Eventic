import { useState, useEffect } from "react";
import { useParams, Link, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ArrowLeft, Save, Image, CreditCard } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { ObjectUploader } from "@/components/ObjectUploader";
import { TicketCard } from "@/components/tickets/ticket-card";
import type { Event, Ticket } from "@shared/schema";

export default function EventEditPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    venue: "",
    date: "",
    time: "",
    ticketPrice: "",
    maxTickets: "",
    imageUrl: "",
    ticketBackgroundUrl: "",
  });

  const { data: event, isLoading } = useQuery<Event>({
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

      setFormData({
        name: event.name,
        description: event.description || "",
        venue: event.venue,
        date: event.date,
        time: event.time,
        ticketPrice: event.ticketPrice,
        maxTickets: event.maxTickets?.toString() || "",
        imageUrl: event.imageUrl || "",
        ticketBackgroundUrl: event.ticketBackgroundUrl || "",
      });
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
      toast({
        title: "Error",
        description: error.message || "Failed to update event",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const updateData: any = {
      name: formData.name,
      description: formData.description || null,
      venue: formData.venue,
      date: formData.date,
      time: formData.time,
      ticketPrice: formData.ticketPrice,
    };

    if (formData.maxTickets) {
      updateData.maxTickets = parseInt(formData.maxTickets);
    }

    if (formData.imageUrl) {
      updateData.imageUrl = formData.imageUrl;
    }

    if (formData.ticketBackgroundUrl) {
      updateData.ticketBackgroundUrl = formData.ticketBackgroundUrl;
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

  const handleImageComplete = (uploadUrl: string) => {
    setFormData(prev => ({ ...prev, imageUrl: uploadUrl }));
    toast({
      title: "Image uploaded",
      description: "Save the event to apply changes",
    });
  };

  const handleTicketBackgroundComplete = (uploadUrl: string) => {
    setFormData(prev => ({ ...prev, ticketBackgroundUrl: uploadUrl }));
    toast({
      title: "Ticket background uploaded",
      description: "Save the event to apply changes",
    });
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
    createdAt: new Date(),
  };

  const previewEvent: Event = {
    id: id || "",
    name: formData.name || "Event Name",
    description: formData.description,
    venue: formData.venue || "Venue",
    date: formData.date || "2024-01-01",
    time: formData.time || "19:00",
    ticketPrice: formData.ticketPrice || "0",
    maxTickets: formData.maxTickets ? parseInt(formData.maxTickets) : null,
    userId: user?.id || null,
    imageUrl: formData.imageUrl,
    ticketBackgroundUrl: formData.ticketBackgroundUrl,
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
      <Link href={`/events/${id}`} className="btn btn-link mb-3 text-decoration-none">
        <ArrowLeft size={18} className="me-2" />
        Back to Event
      </Link>

      <div className="row">
        <div className="col-lg-8">
          <h2 className="mb-4">Edit Event</h2>

          <form onSubmit={handleSubmit}>
            <div className="mb-3">
              <label htmlFor="name" className="form-label">
                Event Name *
              </label>
              <input
                type="text"
                className="form-control"
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>

            <div className="mb-3">
              <label htmlFor="description" className="form-label">
                Description
              </label>
              <textarea
                className="form-control"
                id="description"
                rows={4}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Tell people about your event..."
              />
            </div>

            <div className="mb-3">
              <label htmlFor="venue" className="form-label">
                Venue *
              </label>
              <input
                type="text"
                className="form-control"
                id="venue"
                value={formData.venue}
                onChange={(e) => setFormData({ ...formData, venue: e.target.value })}
                required
              />
            </div>

            <div className="row">
              <div className="col-md-6 mb-3">
                <label htmlFor="date" className="form-label">
                  Date *
                </label>
                <input
                  type="date"
                  className="form-control"
                  id="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  required
                />
              </div>

              <div className="col-md-6 mb-3">
                <label htmlFor="time" className="form-label">
                  Time *
                </label>
                <input
                  type="time"
                  className="form-control"
                  id="time"
                  value={formData.time}
                  onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="row">
              <div className="col-md-6 mb-3">
                <label htmlFor="ticketPrice" className="form-label">
                  Ticket Price ($) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className="form-control"
                  id="ticketPrice"
                  value={formData.ticketPrice}
                  onChange={(e) => setFormData({ ...formData, ticketPrice: e.target.value })}
                  required
                />
              </div>

              <div className="col-md-6 mb-3">
                <label htmlFor="maxTickets" className="form-label">
                  Maximum Tickets (optional)
                </label>
                <input
                  type="number"
                  min="1"
                  className="form-control"
                  id="maxTickets"
                  value={formData.maxTickets}
                  onChange={(e) => setFormData({ ...formData, maxTickets: e.target.value })}
                  placeholder="Leave empty for unlimited"
                />
              </div>
            </div>

            <div className="mb-4">
              <label className="form-label">
                <Image size={18} className="me-2" />
                Feature Image
              </label>
              <ObjectUploader
                onGetUploadParameters={handleImageUpload}
                onComplete={handleImageComplete}
                buttonClassName="btn btn-outline-primary"
                currentImageUrl={formData.imageUrl}
              >
                <Image size={18} className="me-2" />
                Choose Image
              </ObjectUploader>
            </div>

            <div className="mb-4">
              <label className="form-label">
                <CreditCard size={18} className="me-2" />
                Ticket Design
              </label>
              <p className="text-muted small mb-3">
                Customize the background image for your event tickets. Tickets are business card sized (3.5" x 2").
              </p>
              
              {/* Ticket Preview */}
              <div className="mb-3">
                <h6 className="mb-2">Ticket Preview:</h6>
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
                onComplete={handleTicketBackgroundComplete}
                buttonClassName="btn btn-outline-primary"
                currentImageUrl={formData.ticketBackgroundUrl}
              >
                <CreditCard size={18} className="me-2" />
                Choose Ticket Background
              </ObjectUploader>
              <small className="text-muted d-block mt-2">
                The ticket will display event details on the left and a QR code on the right.
              </small>
            </div>

            <div className="d-flex gap-2">
              <button
                type="submit"
                className="btn btn-primary"
                disabled={updateEventMutation.isPending}
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
              <Link href={`/events/${id}`} className="btn btn-outline-secondary">
                Cancel
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}