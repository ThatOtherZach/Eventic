import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Calendar, MapPin, Users, DollarSign, Download, Archive } from "lucide-react";
import { Modal, ModalHeader, ModalBody, ModalFooter } from "@/components/ui/modal";
import { Badge } from "@/components/ui/badge";
import type { ArchivedEvent, ArchivedTicket } from "@shared/schema";

export function PastEvents() {
  const [isOpen, setIsOpen] = useState(false);

  const { data: pastEvents = [], isLoading } = useQuery<ArchivedEvent[]>({
    queryKey: ["/api/user/past-events"],
    enabled: isOpen,
  });

  const { data: pastTickets = [] } = useQuery<ArchivedTicket[]>({
    queryKey: ["/api/user/past-tickets"],
    enabled: isOpen,
  });

  const downloadCSV = (csvData: string, filename: string) => {
    const blob = new Blob([csvData], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const downloadAllEvents = () => {
    if (pastEvents.length === 0) return;
    
    const headers = "Event Name,Venue,Date,Time,End Date,End Time,Ticket Price,Tickets Sold,Total Revenue\n";
    const csvContent = headers + pastEvents.map(event => event.csvData).join("\n");
    downloadCSV(csvContent, "past-events.csv");
  };

  const downloadAllTickets = () => {
    if (pastTickets.length === 0) return;
    
    const headers = "Ticket Number,Event Name,Venue,Date,Time,Price,Was Validated,Validated At\n";
    const csvContent = headers + pastTickets.map(ticket => ticket.csvData).join("\n");
    downloadCSV(csvContent, "past-tickets.csv");
  };

  return (
    <>
      <Button 
        variant="outline" 
        size="sm" 
        onClick={() => setIsOpen(true)}
        data-testid="button-past-events"
      >
        Archive
      </Button>
      
      <Modal open={isOpen} onOpenChange={setIsOpen} className="modal-lg">
        <ModalHeader onClose={() => setIsOpen(false)}>
          Past Events Archive
        </ModalHeader>
        <ModalBody>
        <div className="alert alert-info mb-4" role="alert">
          <strong>Note:</strong> Events that ended over 69 days ago have been archived. You can download the data as CSV files.
        </div>
        
        <div className="space-y-6">
          {/* Past Events Section */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Events You Organized</h3>
              {pastEvents.length > 0 && (
                <Button size="sm" variant="outline" onClick={downloadAllEvents} data-testid="button-download-all-events">
                  <Download className="mr-2 h-4 w-4" />
                  Download All
                </Button>
              )}
            </div>
            
            <ScrollArea className="h-[250px] rounded-md border p-4">
              {isLoading ? (
                <div className="text-center text-muted-foreground">Loading...</div>
              ) : pastEvents.length === 0 ? (
                <div className="text-center text-muted-foreground">No archived events yet</div>
              ) : (
                <div className="space-y-3">
                  {pastEvents.map((event) => (
                    <Card key={event.id} className="p-3">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <p className="font-medium" data-testid={`text-event-name-${event.id}`}>{event.eventName}</p>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {event.eventDate}
                            </span>
                            <span className="flex items-center gap-1">
                              <Users className="h-3 w-3" />
                              {event.totalTicketsSold} tickets
                            </span>
                            <span className="flex items-center gap-1">
                              <DollarSign className="h-3 w-3" />
                              ${event.totalRevenue}
                            </span>
                          </div>
                          <Badge variant="secondary" className="text-xs">
                            Archived {event.archivedAt ? new Date(event.archivedAt).toLocaleDateString() : 'Unknown'}
                          </Badge>
                        </div>
                        <Button 
                          size="sm" 
                          variant="ghost"
                          onClick={() => downloadCSV(
                            "Event Name,Venue,Date,Time,End Date,End Time,Ticket Price,Tickets Sold,Total Revenue\n" + event.csvData,
                            `${event.eventName.replace(/\s+/g, '-')}-data.csv`
                          )}
                          data-testid={`button-download-event-${event.id}`}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>

          {/* Past Tickets Section */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Tickets You Purchased</h3>
              {pastTickets.length > 0 && (
                <Button size="sm" variant="outline" onClick={downloadAllTickets} data-testid="button-download-all-tickets">
                  <Download className="mr-2 h-4 w-4" />
                  Download All
                </Button>
              )}
            </div>
            
            <ScrollArea className="h-[250px] rounded-md border p-4">
              {pastTickets.length === 0 ? (
                <div className="text-center text-muted-foreground">No archived tickets yet</div>
              ) : (
                <div className="space-y-3">
                  {pastTickets.map((ticket) => (
                    <Card key={ticket.id} className="p-3">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <p className="font-medium" data-testid={`text-ticket-event-${ticket.id}`}>{ticket.eventName}</p>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <span>Ticket #{ticket.ticketNumber}</span>
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {ticket.eventDate}
                            </span>
                            {ticket.wasValidated && (
                              <Badge variant="outline" className="text-xs">
                                Used
                              </Badge>
                            )}
                          </div>
                          <Badge variant="secondary" className="text-xs">
                            Archived {ticket.archivedAt ? new Date(ticket.archivedAt).toLocaleDateString() : 'Unknown'}
                          </Badge>
                        </div>
                        <Button 
                          size="sm" 
                          variant="ghost"
                          onClick={() => downloadCSV(
                            "Ticket Number,Event Name,Venue,Date,Time,Price,Was Validated,Validated At\n" + ticket.csvData,
                            `ticket-${ticket.ticketNumber}-data.csv`
                          )}
                          data-testid={`button-download-ticket-${ticket.id}`}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        </div>
        </ModalBody>
      </Modal>
    </>
  );
}