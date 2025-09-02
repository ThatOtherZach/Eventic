import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { TicketCard } from "@/components/tickets/ticket-card";
import { Sparkles } from "lucide-react";

export function RegistryPage() {
  const [, setLocation] = useLocation();
  const { data: registryRecords, isLoading } = useQuery({
    queryKey: ["/api/registry"],
  });

  if (isLoading) {
    return (
      <div className="container py-5">
        <div className="row mb-4">
          <div className="col">
            <h1 className="h3 fw-bold mb-0">NFT Registry</h1>
          </div>
        </div>
        <div className="card">
          <div className="card-body">
            <div className="placeholder-glow">
              <div className="placeholder col-12 mb-2"></div>
              <div className="placeholder col-8"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container py-5">
      <div className="row mb-4">
        <div className="col">
          <h1 className="h3 fw-bold mb-0">NFT Registry</h1>
          <p className="text-muted">Permanently preserved event tickets</p>
        </div>
      </div>

      {!registryRecords || registryRecords.length === 0 ? (
        <div className="card">
          <div className="card-body text-center py-5">
            <Sparkles className="text-muted mb-3 mx-auto" size={48} />
            <h6 className="text-muted">No NFTs in the registry yet</h6>
            <p className="text-muted small">Validated tickets that have been minted as NFTs will appear here</p>
          </div>
        </div>
      ) : (
        <div className="row g-3">
          {registryRecords.map((record: any) => {
            // Reconstruct ticket object from preserved data
            const preservedTicket = {
              id: record.ticketId || record.id,
              eventId: record.eventId,
              userId: record.ownerId,
              ticketNumber: record.ticketNumber,
              qrData: record.ticketQrCode,
              status: record.ticketStatus,
              isValidated: record.ticketValidatedAt ? true : false,
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
              isDoubleGolden: record.ticketIsDoubleGolden,
              specialEffect: record.ticketSpecialEffect,
              voteCount: record.ticketVoteCount,
              isCharged: record.ticketIsCharged,
              validationCode: record.ticketValidationCode,
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
              stickerUrl: record.eventStickerUrl,
              specialEffectsEnabled: record.eventSpecialEffectsEnabled,
              geofence: record.eventGeofence ? JSON.parse(record.eventGeofence) : null,
              isAdminCreated: record.eventIsAdminCreated,
            };

            return (
              <div key={record.id} className="col-md-4">
                <div 
                  onClick={() => setLocation(`/registry/${record.id}`)}
                  style={{ 
                    cursor: 'pointer'
                  }}
                >
                  <TicketCard
                    ticket={preservedTicket}
                    event={preservedEvent}
                    showQR={false}
                    showBadges={true}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}