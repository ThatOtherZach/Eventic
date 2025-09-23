import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { TicketCard } from "@/components/tickets/ticket-card";
import { ArrowLeft, MapPin, Clock, Sparkles } from "lucide-react";
import { Link } from "wouter";
import { MintNFTButton } from "@/components/registry/mint-nft-button";
import type { RegistryRecord } from "@shared/schema";

export function RegistryTicketPage() {
  const { id } = useParams();
  
  const { data: record, isLoading, error } = useQuery<RegistryRecord>({
    queryKey: [`/api/registry/${id}`],
  });

  if (isLoading) {
    return (
      <div className="container py-5">
        <div className="text-center">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error || !record) {
    return (
      <div className="container py-5">
        <div className="alert alert-danger">
          <h5>Digital collectible not found</h5>
          <p>
            The digital collectible you're looking for doesn't exist or has been removed.
          </p>
          <Link href="/registry">
            <a className="btn btn-primary mt-3">
              <ArrowLeft size={18} className="me-2" />
              Back to Collectibles
            </a>
          </Link>
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
    nftMediaUrl: record.ticketGifData || record.ticketNftMediaUrl || null,
    purchaserEmail: record.ticketPurchaserEmail || null,
    purchaserIp: record.ticketPurchaserIp || null,
    purchasePrice: record.ticketPurchasePrice || null,
    resellStatus: record.ticketResellStatus || 'not_for_resale',
    originalOwnerId: record.ticketOriginalOwnerId || null,
    scheduledDeletion: null,
    paymentConfirmed: true,
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
    stickerUrl: record.eventStickerData || record.eventStickerUrl || null,
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
    bonusContent: record.eventBonusContent || null,
    goldenTickets: [],
    accountBalance: null,
    likedByUser: false,
    dislikedByUser: false,
    totalLikes: 0,
    totalDislikes: 0,
    earnedVotes: 0,
    scheduledDeletion: null,
    paymentCurrencies: null,
    paymentProcessingFee: null,
    paymentProcessing: 'none',
    walletAddress: null,
    allowPrepay: false,
    startAtUtc: null,
    endAtUtc: null,
  };

  return (
    <div className="container py-5">
      {/* Back Button */}
      <div className="mb-4">
        <Link href="/registry">
          <a className="btn btn-outline-secondary">
            <ArrowLeft size={18} className="me-2" />
            Back to Collectibles
          </a>
        </Link>
      </div>

      {/* Page Title - EXACTLY like ticket-view.tsx */}
      <div className="row mb-4">
        <div className="col text-center">
          <h1 className="h3 fw-bold">
            <span className="text-decoration-none text-dark">
              {preservedEvent.name} Ticket
            </span>
          </h1>
          {preservedEvent.contactDetails && (
            <p className="text-muted fst-italic">{preservedEvent.contactDetails}</p>
          )}
          {/* Bonus Content for Validated NFTs */}
          {preservedEvent.bonusContent && 
           preservedTicket.isValidated && (
            <div className="mt-4 p-3 bg-light rounded border">
              <h6 className="mb-2 d-flex align-items-center">
                🎁 Bonus Content
              </h6>
              <p className="mb-0">{preservedEvent.bonusContent}</p>
            </div>
          )}
        </div>
      </div>

      {/* NFT Permanent Record Notice - Replaces deletion countdown */}
      <div className="row justify-content-center mb-4">
        <div className="col-12 col-md-8 col-lg-6">
          <div className="d-flex align-items-center text-success">
            <Sparkles size={18} className="me-2" />
            <span>
              Digital Collectible
              {record.nftMinted && record.walletAddress && (
                <span className="ms-1">• Minted to {record.walletAddress.slice(0, 6)}...{record.walletAddress.slice(-4)}</span>
              )}
            </span>
          </div>
        </div>
      </div>

      {/* Ticket and Details Section - EXACTLY like ticket-view.tsx */}
      <div className="row justify-content-center">
        <div className="col-12 col-md-8 col-lg-6">
          {/* Ticket Display */}
          <div className="mb-4" id="ticket-card-for-nft">
            <TicketCard
              ticket={preservedTicket}
              event={preservedEvent}
              showQR={false}
              showBadges={true}
            />
          </div>

          {/* Ticket Status Badge for Resale */}
          {(preservedTicket as any).resellStatus === "for_resale" && (
            <div className="d-flex justify-content-center gap-2 mb-3">
              <span
                className="badge"
                style={{
                  backgroundColor: "#FFC107",
                  color: "#000",
                  fontSize: "0.9em",
                  padding: "6px 12px",
                }}
              >
                RETURNED
              </span>
            </div>
          )}

          {/* Ticket Details */}
          <div className="card mb-4">
            <div className="card-body">
              <h6 className="card-title mb-3">Details</h6>

              <div className="d-flex justify-content-between">
                <div>
                  <span className="text-muted">Purchase Date:</span>
                  <p className="mb-0 fw-bold">
                    {preservedTicket.createdAt
                      ? new Date(preservedTicket.createdAt).toLocaleDateString("en-US", {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })
                      : "Unknown"}
                  </p>
                </div>
                <div className="text-end">
                  <span className="text-muted">Ticket Number:</span>
                  <p className="mb-0 fw-bold">#{preservedTicket.ticketNumber}</p>
                </div>
              </div>

              {preservedTicket.seatNumber && (
                <div className="mt-3">
                  <span className="text-muted">Seat Number:</span>
                  <p className="mb-0 fw-bold">{preservedTicket.seatNumber}</p>
                </div>
              )}

              {preservedTicket.ticketType && (
                <div className="mt-3">
                  <span className="text-muted">Ticket Type:</span>
                  <p className="mb-0 fw-bold">{preservedTicket.ticketType}</p>
                </div>
              )}

              {preservedTicket.isValidated && preservedTicket.validatedAt && (
                <div className="mt-3">
                  <span className="text-muted">Validated At:</span>
                  <p className="mb-0 fw-bold">
                    {new Date(preservedTicket.validatedAt).toLocaleString("en-US", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                      hour12: true,
                    })}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Event Info - EXACTLY like ticket-view.tsx */}
          <div className="card mb-4">
            <div className="card-body">
              <h6 className="card-title mb-3">Event Information</h6>

              {/* Venue */}
              <div className="d-flex align-items-start mb-3">
                <MapPin size={18} className="text-muted me-2 mt-1" />
                <div>
                  <small className="text-muted">Venue</small>
                  <p className="mb-0">{preservedEvent.venue}</p>
                </div>
              </div>

              {/* Date & Time */}
              <div className="d-flex align-items-start">
                <Clock size={18} className="text-muted me-2 mt-1" />
                <div>
                  <small className="text-muted">Date & Time</small>
                  <p className="mb-0">
                    {new Date(preservedEvent.date).toLocaleDateString("en-US", {
                      weekday: "long",
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}{" "}
                    at {preservedEvent.time}
                  </p>
                  {preservedEvent.endDate && preservedEvent.endTime && (
                    <p className="mb-0 text-muted small">
                      Ends: {new Date(preservedEvent.endDate).toLocaleDateString("en-US", {
                        weekday: "long",
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}{" "}
                      at {preservedEvent.endTime}
                    </p>
                  )}
                </div>
              </div>

              {/* Description */}
              {preservedEvent.description && (
                <div className="mt-3">
                  <small className="text-muted">Description</small>
                  <p className="mb-0">{preservedEvent.description}</p>
                </div>
              )}
            </div>
          </div>

          {/* Hunt Information - if ticket was obtained via hunt */}
          {record.huntCode && (
            <div className="card mb-4">
              <div className="card-body">
                <h6 className="card-title mb-3">🏴‍☠️ Treasure Hunt Claim</h6>
                <div className="row">
                  <div className="col-6">
                    <small className="text-muted">Hunt Code</small>
                    <p className="mb-0 fw-bold">{record.huntCode}</p>
                  </div>
                  {record.huntClaimLatitude && record.huntClaimLongitude && (
                    <div className="col-6">
                      <small className="text-muted">Claim Location</small>
                      <p className="mb-0 fw-bold">
                        {parseFloat(record.huntClaimLatitude).toFixed(4)}, {parseFloat(record.huntClaimLongitude).toFixed(4)}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Mint Button - Show only if not already minted */}
          {!record.nftTokenId && (
            <div className="card mb-4">
              <div className="card-body">
                <h6 className="card-title mb-3">Mint as NFT</h6>
                <p className="text-muted small">Permanently save this digital collectible on the blockchain. You'll pay gas fees (~$0.01-$0.50) directly from your wallet.</p>
                <MintNFTButton registry={record} />
              </div>
            </div>
          )}

          {/* NFT Information */}
          <div className="card">
            <div className="card-body">
              <h6 className="card-title mb-3">Collectible Details</h6>
              <div className="row g-3">
                <div className="col-6">
                  <div className="text-muted small">Collectible ID</div>
                  <div className="font-monospace small">{record.id}</div>
                </div>
                <div className="col-6">
                  <div className="text-muted small">Minted On</div>
                  <div className="small">
                    {new Date(record.mintedAt || new Date()).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </div>
                </div>
                {record.walletAddress && (
                  <div className="col-12">
                    <div className="text-muted small">Wallet Address</div>
                    <div className="font-monospace small">{record.walletAddress}</div>
                  </div>
                )}
                {record.nftTransactionHash && (
                  <div className="col-12">
                    <div className="text-muted small">Transaction Hash</div>
                    <div className="font-monospace small">{record.nftTransactionHash}</div>
                  </div>
                )}
                {record.nftTokenId && (
                  <div className="col-6">
                    <div className="text-muted small">Token ID</div>
                    <div className="small">#{record.nftTokenId}</div>
                  </div>
                )}
                {record.nftContractAddress && (
                  <div className="col-6">
                    <div className="text-muted small">Contract</div>
                    <div className="font-monospace small">
                      {record.nftContractAddress.slice(0, 6)}...{record.nftContractAddress.slice(-4)}
                    </div>
                  </div>
                )}
                <div className="col-12">
                  <div className="text-muted small">Owner</div>
                  <div className="small">{record.ownerDisplayName || record.ownerUsername || 'Anonymous'}</div>
                </div>
                <div className="col-12">
                  <div className="text-muted small">Creator</div>
                  <div className="small">{record.creatorDisplayName || record.creatorUsername || 'Unknown'}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}