import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { TicketCard } from "@/components/tickets/ticket-card";
import { Card, CardContent } from "@/components/ui/card";
import { Trophy } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export function RegistryPage() {
  const { data: registryRecords, isLoading } = useQuery({
    queryKey: ["/api/registry"],
  });

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">NFT Registry</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-48 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">NFT Registry</h1>
        <p className="text-muted-foreground">
          Permanently preserved event tickets
        </p>
      </div>

      {!registryRecords || registryRecords.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <Trophy className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-lg text-muted-foreground mb-2">No NFTs in the registry yet</p>
            <p className="text-sm text-muted-foreground">
              Validated tickets that have been minted as NFTs will appear here
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {registryRecords.map((record: any) => {
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
              <Link key={record.id} href={`/registry/${record.id}`}>
                <div className="cursor-pointer">
                  <TicketCard
                    ticket={preservedTicket}
                    event={preservedEvent}
                    showQR={false}
                    showBadges={true}
                  />
                  <div className="mt-2 text-xs text-muted-foreground">
                    Minted by @{record.ownerUsername}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}