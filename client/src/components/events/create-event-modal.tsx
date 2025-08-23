import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertEventSchema, type InsertEvent } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Modal, ModalHeader, ModalBody, ModalFooter } from "@/components/ui/modal";
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
  const queryClient = useQueryClient();

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
    createEventMutation.mutate(data);
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
                    <FormLabel>Event Name</FormLabel>
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
                      <FormLabel>Date</FormLabel>
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
                      <FormLabel>Time</FormLabel>
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
                    <FormLabel>Venue</FormLabel>
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