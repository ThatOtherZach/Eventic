import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { TicketCard } from "@/components/tickets/ticket-card";
import { ArrowLeft, Sparkles } from "lucide-react";
import { Link } from "wouter";

export function RegistryTicketPage() {
  const { id } = useParams();
  
  const { data: record, isLoading } = useQuery({
    queryKey: [`/api/registry/${id}`],
  });

  if (isLoading) {
    return (
      <div className="container py-5">
        <div className="d-flex align-items-center mb-4">
          <Link href="/registry" className="btn btn-link p-0 text-decoration-none">
            <ArrowLeft size={20} className="me-2" />
            Back to Registry
          </Link>
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

  if (!record) {
    return (
      <div className="container py-5">
        <div className="d-flex align-items-center mb-4">
          <Link href="/registry" className="btn btn-link p-0 text-decoration-none">
            <ArrowLeft size={20} className="me-2" />
            Back to Registry
          </Link>
        </div>
        <div className="card">
          <div className="card-body text-center py-5">
            <Sparkles className="text-muted mb-3 mx-auto" size={48} />
            <h6 className="text-muted">NFT not found</h6>
            <p className="text-muted small">This NFT may have been removed from the registry</p>
          </div>
        </div>
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
    stickerUrl: record.eventStickerUrl,
    specialEffectsEnabled: record.eventSpecialEffectsEnabled,
    geofence: record.eventGeofence ? JSON.parse(record.eventGeofence) : null,
    isAdminCreated: record.eventIsAdminCreated,
  };

  return (
    <div className="container py-5">
      {/* Navigation Header */}
      <div className="d-flex align-items-center mb-4">
        <Link href="/registry" className="btn btn-link p-0 text-decoration-none">
          <ArrowLeft size={20} className="me-2" />
          Back to Registry
        </Link>
      </div>

      {/* NFT Registry Header */}
      <div className="row mb-4">
        <div className="col-12">
          <div className="alert alert-info">
            <div className="d-flex align-items-center">
              <Sparkles size={20} className="me-2" />
              <div>
                <h6 className="mb-1">NFT Registry Record</h6>
                <p className="mb-0 small">
                  This ticket has been preserved as an NFT and will remain in the registry permanently.
                  Minted on {new Date(record.createdAt).toLocaleDateString()}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Ticket Display - Same structure as ticket-view.tsx */}
      <div className="row justify-content-center">
        <div className="col-12 col-md-8 col-lg-6">
          {/* Ticket Display */}
          <div className="mb-4">
            <TicketCard 
              ticket={preservedTicket} 
              event={preservedEvent} 
              showQR={false}
              showBadges={true}
            />
          </div>

          {/* Ticket Status Badge */}
          {preservedTicket.isValidated && (
            <div className="d-flex justify-content-center gap-2 mb-3">
              <span className="badge" style={{ backgroundColor: '#198754', color: '#fff', fontSize: '0.9em', padding: '6px 12px' }}>
                VALIDATED
              </span>
            </div>
          )}

          {/* NFT Details Card */}
          <div className="card">
            <div className="card-body">
              <h6 className="card-title mb-3">NFT Details</h6>
              <div className="row g-3">
                <div className="col-6">
                  <div className="text-muted small">Token ID</div>
                  <div className="font-monospace small">{record.id}</div>
                </div>
                <div className="col-6">
                  <div className="text-muted small">Owner</div>
                  <div className="small">{record.ownerEmail || 'Anonymous'}</div>
                </div>
                <div className="col-6">
                  <div className="text-muted small">Event</div>
                  <div className="small">{record.eventName}</div>
                </div>
                <div className="col-6">
                  <div className="text-muted small">Event Date</div>
                  <div className="small">{record.eventDate}</div>
                </div>
                {record.ticketNumber && (
                  <div className="col-6">
                    <div className="text-muted small">Ticket Number</div>
                    <div className="small">#{record.ticketNumber}</div>
                  </div>
                )}
                {record.ticketSeatNumber && (
                  <div className="col-6">
                    <div className="text-muted small">Seat</div>
                    <div className="small">{record.ticketSeatNumber}</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}