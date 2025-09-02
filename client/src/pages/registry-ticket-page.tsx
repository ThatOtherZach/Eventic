import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  CalendarDays, 
  MapPin, 
  User, 
  Hash, 
  Trophy, 
  ArrowLeft,
  CheckCircle,
  Clock,
  Users,
  Ticket,
  Mail,
  Shield,
  Star
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
        <Card>
          <CardHeader>
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-4 w-1/2 mt-2" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-64 w-full" />
          </CardContent>
        </Card>
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

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <Link href="/registry">
        <Button variant="ghost" className="mb-6">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Registry
        </Button>
      </Link>

      {/* Main Ticket Card */}
      <Card className="mb-6 overflow-hidden">
        {/* Ticket Background Image */}
        {record.eventImageUrl && (
          <div className="relative h-64 overflow-hidden">
            <img
              src={record.eventImageUrl}
              alt={record.eventName}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
            <div className="absolute bottom-4 left-4 text-white">
              <h1 className="text-3xl font-bold mb-2">{record.eventName}</h1>
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-1">
                  <MapPin className="w-4 h-4" />
                  <span>{record.eventVenue}</span>
                </div>
                <div className="flex items-center gap-1">
                  <CalendarDays className="w-4 h-4" />
                  <span>{record.eventDate} at {record.eventTime}</span>
                </div>
              </div>
            </div>
            {record.ticketIsGolden && (
              <Badge className="absolute top-4 right-4 bg-yellow-500 text-white">
                <Star className="w-3 h-3 mr-1" />
                Golden Ticket
              </Badge>
            )}
          </div>
        )}

        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="text-2xl">{record.title}</CardTitle>
              <CardDescription className="mt-2">
                {record.description}
              </CardDescription>
            </div>
            <Badge variant="secondary" className="text-lg px-3 py-1">
              #{record.ticketNumber}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Ticket Details */}
          <div>
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Ticket className="w-4 h-4" />
              Ticket Information
            </h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Recipient</p>
                <p className="font-medium">{record.ticketRecipientName}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Email</p>
                <p className="font-medium flex items-center gap-1">
                  <Mail className="w-3 h-3" />
                  {record.ticketRecipientEmail}
                </p>
              </div>
              {record.ticketSeatNumber && (
                <div>
                  <p className="text-muted-foreground">Seat Number</p>
                  <p className="font-medium">{record.ticketSeatNumber}</p>
                </div>
              )}
              {record.ticketType && (
                <div>
                  <p className="text-muted-foreground">Ticket Type</p>
                  <p className="font-medium">{record.ticketType}</p>
                </div>
              )}
              <div>
                <p className="text-muted-foreground">Status</p>
                <Badge variant="default" className="bg-green-500">
                  <CheckCircle className="w-3 h-3 mr-1" />
                  Validated
                </Badge>
              </div>
              <div>
                <p className="text-muted-foreground">Usage</p>
                <p className="font-medium">
                  {record.ticketUsageCount} / {record.ticketMaxUses} uses
                </p>
              </div>
            </div>
          </div>

          <Separator />

          {/* Event Details */}
          <div>
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <CalendarDays className="w-4 h-4" />
              Event Details
            </h3>
            <div className="space-y-3">
              {record.eventDescription && (
                <p className="text-sm text-muted-foreground">{record.eventDescription}</p>
              )}
              
              {record.eventEventTypes && record.eventEventTypes.length > 0 && (
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
              )}

              <div className="grid grid-cols-2 gap-4 text-sm">
                {record.eventEndDate && (
                  <div>
                    <p className="text-muted-foreground">End Date</p>
                    <p className="font-medium">
                      {record.eventEndDate} {record.eventEndTime && `at ${record.eventEndTime}`}
                    </p>
                  </div>
                )}
                {record.eventTicketPrice && (
                  <div>
                    <p className="text-muted-foreground">Ticket Price</p>
                    <p className="font-medium">${record.eventTicketPrice}</p>
                  </div>
                )}
                {record.eventMaxTickets && (
                  <div>
                    <p className="text-muted-foreground">Capacity</p>
                    <p className="font-medium">
                      {record.eventTicketsSold} / {record.eventMaxTickets} sold
                    </p>
                  </div>
                )}
                {record.eventReentryType && (
                  <div>
                    <p className="text-muted-foreground">Re-entry</p>
                    <p className="font-medium">{record.eventReentryType}</p>
                  </div>
                )}
              </div>

              {/* Event Features */}
              <div className="flex flex-wrap gap-2 pt-2">
                {record.eventP2pValidation && (
                  <Badge variant="outline">
                    <Users className="w-3 h-3 mr-1" />
                    P2P Validation
                  </Badge>
                )}
                {record.eventEnableVoting && (
                  <Badge variant="outline">
                    <Star className="w-3 h-3 mr-1" />
                    Voting Enabled
                  </Badge>
                )}
                {record.eventSurgePricing && (
                  <Badge variant="outline">Surge Pricing</Badge>
                )}
                {record.eventIsPrivate && (
                  <Badge variant="outline">
                    <Shield className="w-3 h-3 mr-1" />
                    Private Event
                  </Badge>
                )}
              </div>
            </div>
          </div>

          <Separator />

          {/* NFT Metadata */}
          <div>
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Trophy className="w-4 h-4" />
              NFT Information
            </h3>
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
                <p className="text-muted-foreground">Creator</p>
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
              {record.transferCount > 0 && (
                <div>
                  <p className="text-muted-foreground">Transfers</p>
                  <p className="font-medium">{record.transferCount}</p>
                </div>
              )}
            </div>
          </div>

          {/* QR Code Section */}
          {record.ticketQrCode && (
            <>
              <Separator />
              <div className="text-center">
                <h3 className="text-sm font-semibold mb-3">Preserved QR Code</h3>
                <div className="inline-block p-4 bg-white rounded-lg border">
                  <div className="w-48 h-48 bg-gray-100 flex items-center justify-center text-xs text-muted-foreground">
                    QR: {record.ticketQrCode.substring(0, 20)}...
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Original ticket validation code preserved
                </p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Registry ID Footer */}
      <div className="text-center text-xs text-muted-foreground">
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