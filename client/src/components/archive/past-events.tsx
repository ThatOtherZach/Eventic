import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Download, Archive, Database, Clock } from "lucide-react";
import { Modal, ModalHeader, ModalBody } from "@/components/ui/modal";
import type { ArchivedEvent, Event, Ticket } from "@shared/schema";
import directoryHistoryIcon from "@assets/directory_closed_history-4_1757452662398.png";
import chipRamdriveIcon from "@assets/chip_ramdrive-2_1757452723019.png";

export function PastEvents() {
  const [isOpen, setIsOpen] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  // Fetch archived events (deleted events)
  const { data: pastEvents = [], isLoading: loadingArchive } = useQuery<
    ArchivedEvent[]
  >({
    queryKey: ["/api/user/past-events"],
    enabled: isOpen,
  });

  // Fetch current events
  const { data: currentEvents = [], isLoading: loadingEvents } = useQuery<
    Event[]
  >({
    queryKey: ["/api/user/events"],
    enabled: isOpen,
  });

  // Fetch current tickets
  const { data: currentTickets = [], isLoading: loadingTickets } = useQuery<
    Ticket[]
  >({
    queryKey: ["/api/user/tickets"],
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

  const downloadAllCurrentData = async () => {
    setIsDownloading(true);
    try {
      // Prepare events CSV
      const eventHeaders =
        "Event Name,Venue,Date,Time,End Date,End Time,Ticket Price,Max Tickets,Status,Created At\n";
      const eventRows = currentEvents
        .map((event) =>
          [
            event.name,
            event.venue || "",
            event.date || "",
            event.time || "",
            event.endDate || "",
            event.endTime || "",
            event.ticketPrice || "0",
            event.maxTickets || "",
            event.isPrivate ? "Private" : "Public",
            event.createdAt
              ? new Date(event.createdAt).toLocaleDateString()
              : "",
          ].join(","),
        )
        .join("\n");

      // Prepare tickets CSV
      const ticketHeaders =
        "\n\n--- TICKETS ---\nTicket Number,Event Name,Status,Purchase Date,Validated At\n";
      const ticketRows = currentTickets
        .map((ticket) => {
          const event = currentEvents.find((e) => e.id === ticket.eventId);
          return [
            ticket.ticketNumber,
            event?.name || "Unknown Event",
            ticket.status || "purchased",
            ticket.createdAt
              ? new Date(ticket.createdAt).toLocaleDateString()
              : "",
            ticket.validatedAt
              ? new Date(ticket.validatedAt).toLocaleDateString()
              : "",
          ].join(",");
        })
        .join("\n");

      const fullCsv = eventHeaders + eventRows + ticketHeaders + ticketRows;
      const timestamp = new Date().toISOString().split("T")[0];
      downloadCSV(fullCsv, `eventic-current-data-${timestamp}.csv`);
    } finally {
      setIsDownloading(false);
    }
  };

  const downloadArchivedData = () => {
    if (pastEvents.length === 0) {
      alert("No archived events to download");
      return;
    }

    const headers =
      "Event Name,Venue,Date,Time,End Date,End Time,Ticket Price,Tickets Sold,Total Revenue,Archived Date\n";
    const rows = pastEvents
      .map((event) => {
        const archivedDate = event.archivedAt
          ? new Date(event.archivedAt).toLocaleDateString()
          : "Unknown";
        return event.csvData + "," + archivedDate;
      })
      .join("\n");

    const fullCsv = headers + rows;
    const timestamp = new Date().toISOString().split("T")[0];
    downloadCSV(fullCsv, `eventic-archived-events-${timestamp}.csv`);
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

      <Modal open={isOpen} onOpenChange={setIsOpen} className="modal-md">
        <ModalHeader onClose={() => setIsOpen(false)}>
          Export Account Data
        </ModalHeader>
        <ModalBody>
          <div className="space-y-4">
            {/* Current Data Download */}
            <div className="p-4 border rounded-lg">
              <div className="flex items-start space-x-3">
                <img src={chipRamdriveIcon} alt="" className="h-5 w-5 mt-1" />
                <div className="flex-1">
                  <h4 className="font-semibold mb-1">Download Current Data</h4>
                  <p className="text-sm text-muted-foreground mb-3">
                    Export all your active events and tickets as a CSV file.
                  </p>
                  <button
                    onClick={downloadAllCurrentData}
                    disabled={isDownloading || loadingEvents || loadingTickets}
                    className="btn btn-primary w-100 d-flex align-items-center justify-content-center"
                    data-testid="button-download-current"
                  >
                    {isDownloading
                      ? "Preparing download..."
                      : "Download All Current Data"}
                  </button>
                </div>
              </div>
            </div>

            {/* Archived Data Download */}
            <div className="p-4 border rounded-lg">
              <div className="flex items-start space-x-3">
                <img
                  src={directoryHistoryIcon}
                  alt=""
                  className="h-5 w-5 mt-1"
                  style={{ opacity: 0.6 }}
                />
                <div className="flex-1">
                  <h4 className="font-semibold mb-1">
                    Download Archived Events
                  </h4>
                  <p className="text-sm text-muted-foreground mb-3">
                    Export past events, data is held for one year.
                  </p>
                  <button
                    onClick={downloadArchivedData}
                    disabled={loadingArchive}
                    className="btn btn-primary w-100 d-flex align-items-center justify-content-center"
                    data-testid="button-download-archive"
                  >
                    {loadingArchive
                      ? "Loading..."
                      : `Download Archived Events (${pastEvents.length})`}
                  </button>
                </div>
              </div>
            </div>

            {/* Info Note */}
            <div className="text-xs text-muted-foreground p-3 bg-muted rounded-lg">
              <p className="mb-1">
                <strong>Note:</strong> Events are deleted and only minimal data
                is retained in the archive.
              </p>
            </div>
          </div>
        </ModalBody>
      </Modal>
    </>
  );
}
