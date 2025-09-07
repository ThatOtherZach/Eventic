import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { TicketCard } from "@/components/tickets/ticket-card";
import { ArrowLeft, Sparkles } from "lucide-react";
import { Link } from "wouter";
import type { RegistryRecord } from "@shared/schema";

export function RegistryTicketPage() {
  const { id } = useParams();
  
  const { data: record, isLoading } = useQuery<RegistryRecord>({
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
    eventId: record.eventId || '',
    userId: record.ownerId,
    ticketNumber: record.ticketNumber,
    qrData: record.ticketQrCode || '',
    status: record.ticketStatus,
    isValidated: record.ticketValidatedAt ? true : false,
    validatedAt: record.ticketValidatedAt,
    validatedBy: record.ticketValidatedBy || null,
    createdAt: record.ticketCreatedAt,
    recipientName: record.ticketRecipientName,
    recipientEmail: record.ticketRecipientEmail,
    seatNumber: record.ticketSeatNumber || null,
    ticketType: record.ticketType || null,
    transferable: record.ticketTransferable || false,
    useCount: record.ticketUsageCount || 0,
    maxUses: record.ticketMaxUses || 1,
    isGolden: record.ticketIsGolden || false,
    isGoldenTicket: record.ticketIsGolden || false,
    isDoubleGolden: record.ticketIsDoubleGolden || false,
    specialEffect: record.ticketSpecialEffect || null,
    voteCount: record.ticketVoteCount || 0,
    isCharged: record.ticketIsCharged || false,
    validationCode: record.ticketValidationCode || null,
    nftMediaUrl: record.ticketGifData || record.ticketNftMediaUrl || null, // Use base64 GIF data if available
    purchaserEmail: record.ticketPurchaserEmail || null,
    purchaserIp: record.ticketPurchaserIp || null,
    purchasePrice: record.ticketPurchasePrice || null,
    resellStatus: record.ticketResellStatus || 'not_for_resale',
    originalOwnerId: record.ticketOriginalOwnerId || null,
    scheduledDeletion: null, // NFT records are never deleted
  };

  // Reconstruct event object from preserved data - use base64 images when available
  const preservedEvent = {
    id: record.eventId || record.id,
    userId: record.creatorId,
    name: record.eventName,
    description: record.eventDescription || '',
    venue: record.eventVenue,
    date: record.eventDate,
    time: record.eventTime,
    endDate: record.eventEndDate || null,
    endTime: record.eventEndTime || null,
    // Use base64 data if available, fallback to URLs
    imageUrl: record.eventImageData || record.eventImageUrl || null,
    ticketBackgroundUrl: record.ticketBackgroundData || record.eventTicketBackgroundUrl || record.eventImageData || record.eventImageUrl || null,
    maxTickets: record.eventMaxTickets || null,
    ticketsSold: record.eventTicketsSold || 0,
    ticketPrice: record.eventTicketPrice ? String(record.eventTicketPrice) : '0',
    eventTypes: record.eventEventTypes || [],
    reentryType: record.eventReentryType || 'No Reentry (Single Use)',
    goldenTicketEnabled: record.eventGoldenTicketEnabled || false,
    goldenTicketCount: record.eventGoldenTicketCount || null,
    allowMinting: record.eventAllowMinting || false,
    isPrivate: record.eventIsPrivate || false,
    oneTicketPerUser: record.eventOneTicketPerUser || false,
    surgePricing: record.eventSurgePricing || false,
    p2pValidation: record.eventP2pValidation || false,
    enableVoting: record.eventEnableVoting || false,
    recurringType: record.eventRecurringType || null,
    recurringEndDate: record.eventRecurringEndDate || null,
    createdAt: record.eventCreatedAt,
    stickerUrl: record.eventStickerData || record.eventStickerUrl || null, // Use base64 sticker data if available
    specialEffectsEnabled: record.eventSpecialEffectsEnabled || false,
    geofence: record.eventGeofence ? JSON.parse(record.eventGeofence) : null,
    isAdminCreated: record.eventIsAdminCreated || false,
    contactDetails: record.eventContactDetails || null,
    country: record.eventCountry || null,
    earlyValidation: record.eventEarlyValidation || 'Allow at Anytime',
    maxUses: record.eventMaxUses || 1,
    stickerOdds: record.eventStickerOdds || 25,
    isEnabled: record.eventIsEnabled !== false,
    ticketPurchasesEnabled: record.eventTicketPurchasesEnabled !== false,
    latitude: record.eventLatitude || null,
    longitude: record.eventLongitude || null,
    parentEventId: record.eventParentEventId || null,
    lastRecurrenceCreated: record.eventLastRecurrenceCreated || null,
    timezone: record.eventTimezone || 'America/New_York',
    rollingTimezone: record.eventRollingTimezone || false,
    hashtags: record.eventHashtags || [],
    treasureHunt: record.eventTreasureHunt || false,
    huntCode: record.eventHuntCode || null,
    goldenTickets: [],
    accountBalance: null,
    likedByUser: false,
    dislikedByUser: false,
    totalLikes: 0,
    totalDislikes: 0,
    earnedVotes: 0,
    scheduledDeletion: null, // NFT records are never deleted
    paymentCurrencies: null,
    paymentProcessingFee: null,
    paymentProcessing: 'none',
    walletAddress: null,
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
                  Minted on {new Date(record.mintedAt || new Date()).toLocaleDateString()}
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
              showQR={true}  // Show QR code for complete ticket display
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
                  <div className="small">{record.ownerDisplayName || record.ownerUsername || 'Anonymous'}</div>
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