import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { TicketCard } from "@/components/tickets/ticket-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  ArrowLeft,
  Trophy,
  User,
  Clock,
  CheckCircle,
  Calendar,
  MapPin
} from "lucide-react";
import { format } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";

export function RegistryTicketPage() {
  const { id } = useParams();
  const { data: record, isLoading } = useQuery({
    queryKey: [`/api/registry/${id}`],
  });

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <Skeleton className="h-8 w-32 mb-6" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!record) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <Link href="/registry">
          <Button variant="ghost" className="mb-6">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Registry
          </Button>
        </Link>
        <Card>
          <CardContent className="text-center py-12">
            <Trophy className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-lg text-muted-foreground">NFT not found</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Reconstruct ticket object from preserved data
  const preservedTicket = {
    id: record.ticketId || record.id,
    eventId: record.eventId,
    userId: record.ownerId,
    ticketNumber: record.ticketNumber,
    qrData: record.ticketQrCode,
    status: record.ticketStatus,
    isValidated: record.ticketStatus === 'validated',
    validatedAt: record.ticketValidatedAt,
    validatedBy: record.ticketValidatedBy,
    createdAt: record.ticketCreatedAt,
    recipientName: record.ticketRecipientName,
    recipientEmail: record.ticketRecipientEmail,
    seatNumber: record.ticketSeatNumber,
    ticketType: record.ticketType,
    transferable: record.ticketTransferable,
    useCount: record.ticketUsageCount,
    maxUses: record.ticketMaxUses,
    isGolden: record.ticketIsGolden,
    isGoldenTicket: record.ticketIsGolden,
    nftMediaUrl: record.ticketNftMediaUrl,
  };

  // Reconstruct event object from preserved data
  const preservedEvent = {
    id: record.eventId,
    userId: record.creatorId,
    name: record.eventName,
    description: record.eventDescription,
    venue: record.eventVenue,
    date: record.eventDate,
    time: record.eventTime,
    endDate: record.eventEndDate,
    endTime: record.eventEndTime,
    imageUrl: record.eventImageUrl,
    ticketBackgroundUrl: record.eventImageUrl, // Use event image as ticket background
    maxTickets: record.eventMaxTickets,
    ticketsSold: record.eventTicketsSold,
    ticketPrice: record.eventTicketPrice,
    eventTypes: record.eventEventTypes,
    reentryType: record.eventReentryType,
    goldenTicketEnabled: record.eventGoldenTicketEnabled,
    goldenTicketCount: record.eventGoldenTicketCount,
    allowMinting: record.eventAllowMinting,
    isPrivate: record.eventIsPrivate,
    oneTicketPerUser: record.eventOneTicketPerUser,
    surgePricing: record.eventSurgePricing,
    p2pValidation: record.eventP2pValidation,
    enableVoting: record.eventEnableVoting,
    recurringType: record.eventRecurringType,
    recurringEndDate: record.eventRecurringEndDate,
    createdAt: record.eventCreatedAt,
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <Link href="/registry">
        <Button variant="ghost" className="mb-6">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Registry
        </Button>
      </Link>

      {/* NFT Title and Description */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-2xl">{record.title}</CardTitle>
          <p className="text-muted-foreground">{record.description}</p>
        </CardHeader>
      </Card>

      {/* The Actual Ticket with All Effects */}
      <div className="mb-6">
        <TicketCard
          ticket={preservedTicket}
          event={preservedEvent}
          showQR={true}
          showBadges={true}
        />
      </div>

      {/* NFT Metadata */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Trophy className="w-5 h-5" />
            NFT Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Event Info */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Event</p>
              <p className="font-medium">{record.eventName}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Venue</p>
              <p className="font-medium flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                {record.eventVenue}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Date</p>
              <p className="font-medium flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {record.eventDate} at {record.eventTime}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Ticket #</p>
              <p className="font-medium">{record.ticketNumber}</p>
            </div>
          </div>

          <Separator />

          {/* Ownership Info */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Owner</p>
              <p className="font-medium flex items-center gap-1">
                <User className="w-3 h-3" />
                @{record.ownerUsername}
                {record.ownerDisplayName && ` (${record.ownerDisplayName})`}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Event Creator</p>
              <p className="font-medium flex items-center gap-1">
                <User className="w-3 h-3" />
                @{record.creatorUsername}
                {record.creatorDisplayName && ` (${record.creatorDisplayName})`}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Minted</p>
              <p className="font-medium flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {format(new Date(record.mintedAt), "PPp")}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Validated</p>
              <p className="font-medium flex items-center gap-1">
                <CheckCircle className="w-3 h-3" />
                {format(new Date(record.ticketValidatedAt || record.validatedAt), "PPp")}
              </p>
            </div>
          </div>

          {/* Event Types */}
          {record.eventEventTypes && record.eventEventTypes.length > 0 && (
            <>
              <Separator />
              <div>
                <p className="text-sm text-muted-foreground mb-2">Event Categories</p>
                <div className="flex flex-wrap gap-2">
                  {record.eventEventTypes.map((type: string) => (
                    <Badge
                      key={type}
                      variant="secondary"
                      style={{
                        backgroundColor: getEventTypeColor(type),
                        color: "white",
                      }}
                    >
                      {type}
                    </Badge>
                  ))}
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Registry ID Footer */}
      <div className="text-center text-xs text-muted-foreground mt-6">
        Registry ID: {record.id}
      </div>
    </div>
  );
}

function getEventTypeColor(type: string): string {
  const colors: Record<string, string> = {
    "Music": "#dc2626",
    "Sports": "#ea580c",
    "Comedy": "#ca8a04",
    "Theater": "#65a30d",
    "Art": "#16a34a",
    "Conference": "#059669",
    "Workshop": "#0891b2",
    "Festival": "#0284c7",
    "Party": "#2563eb",
    "Networking": "#4f46e5",
    "Charity": "#7c3aed",
    "Other": "#9333ea",
  };
  return colors[type] || "#6b7280";
}