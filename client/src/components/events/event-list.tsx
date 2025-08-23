import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Eye, Ticket, Edit } from "lucide-react";
import type { Event } from "@shared/schema";

interface EventListProps {
  onGenerateTickets: (event: Event) => void;
}

export function EventList({ onGenerateTickets }: EventListProps) {
  const { data: events, isLoading } = useQuery<Event[]>({
    queryKey: ["/api/events"],
  });

  if (isLoading) {
    return (
      <div className="card">
        <div className="card-body">
          <div className="placeholder-glow">
            {[1, 2, 3].map((i) => (
              <div key={i} className="d-flex align-items-center mb-4">
                <div className="placeholder rounded me-3" style={{width: '48px', height: '48px'}}></div>
                <div className="flex-grow-1">
                  <div className="placeholder col-6 mb-2"></div>
                  <div className="placeholder col-4"></div>
                </div>
                <div className="d-flex gap-2">
                  <div className="placeholder rounded" style={{width: '32px', height: '32px'}}></div>
                  <div className="placeholder rounded" style={{width: '32px', height: '32px'}}></div>
                  <div className="placeholder rounded" style={{width: '32px', height: '32px'}}></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!events?.length) {
    return (
      <div className="card">
        <div className="card-body text-center py-5">
          <div className="text-muted">
            <Ticket className="mx-auto mb-3 opacity-50" size={48} />
            <h5 className="fw-medium mb-2">No events yet</h5>
            <p className="small mb-0">Create your first event to get started</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <Card>
      <CardContent className="p-0">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Recent Events</h3>
        </div>
        <div className="divide-y divide-gray-200">
          {events.map((event) => (
            <div 
              key={event.id} 
              className="p-6 hover:bg-gray-50 transition-colors duration-150"
              data-testid={`card-event-${event.id}`}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center">
                    <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mr-4">
                      <Ticket className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <h4 className="text-base font-medium text-gray-900">{event.name}</h4>
                      <p className="text-sm text-gray-500">
                        {event.date} • {event.time}
                      </p>
                      <p className="text-sm text-gray-500">{event.venue}</p>
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-900">
                      ${event.ticketPrice}
                    </p>
                    <p className="text-sm text-gray-500">per ticket</p>
                  </div>
                  <div className="flex space-x-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-gray-400 hover:text-primary"
                      data-testid={`button-view-${event.id}`}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-gray-400 hover:text-primary"
                      onClick={() => onGenerateTickets(event)}
                      data-testid={`button-generate-tickets-${event.id}`}
                    >
                      <Ticket className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-gray-400 hover:text-gray-600"
                      data-testid={`button-edit-${event.id}`}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
