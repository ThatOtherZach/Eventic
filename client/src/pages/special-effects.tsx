import { Calendar, Clock, MapPin } from "lucide-react";
import type { Event, Ticket } from "@shared/schema";
import { TicketCard } from "@/components/tickets/ticket-card";

export default function SpecialEffectsPage() {
  // Example golden ticket for demonstration
  const exampleGoldenTicket: Ticket = {
    id: "example-golden",
    eventId: "example-event",
    userId: "example-user",
    ticketNumber: "GOLD-001",
    qrData: "example-qr-data",
    isValidated: true,
    validatedAt: new Date(),
    validationCode: "1234",
    useCount: 1,
    isGoldenTicket: true,
    createdAt: new Date(),
  };

  // Example event for demonstration
  const exampleEvent: Event = {
    id: "example-event",
    name: "Example Concert",
    description: "A wonderful music event",
    venue: "Example Venue, 123 Main St",
    country: "US",
    date: "2024-06-15",
    time: "19:00",
    endDate: null,
    endTime: null,
    ticketPrice: "25.00",
    maxTickets: 100,
    userId: "example-user",
    imageUrl: null,
    ticketBackgroundUrl: null,
    earlyValidation: "Allow at Anytime",
    reentryType: "No Reentry (Single Use)",
    maxUses: 1,
    goldenTicketEnabled: true,
    goldenTicketCount: 5,
    allowMinting: false,
    isPrivate: false,
    createdAt: new Date(),
  };

  return (
    <div className="container-fluid">
      <div className="row justify-content-center">
        <div className="col-12 col-lg-8">
          <div className="text-center mb-4">
            <h1 className="display-4 mb-3">Ticket Special Effects</h1>
            <p className="lead text-muted">
              Sometimes tickets have special visual effects applied to them. Here's what they mean!
            </p>
          </div>

          {/* Golden Ticket Section */}
          <div className="card mb-4">
            <div className="card-body">
              <div className="row align-items-center">
                <div className="col-md-6">
                  <h3 className="card-title">
                    <span className="badge bg-warning text-dark me-2">🎫</span>
                    Golden Tickets
                  </h3>
                  <p className="card-text">
                    Golden tickets are special validated tickets that receive a beautiful golden glow effect. 
                    These tickets are randomly awarded during the validation process and represent a unique 
                    achievement for the ticket holder.
                  </p>
                  <p className="card-text">
                    <strong>Visual Features:</strong>
                  </p>
                  <ul>
                    <li>Animated golden glow overlay</li>
                    <li>Special "GOLDEN" badge in the corner</li>
                    <li>Enhanced visual presentation</li>
                  </ul>
                </div>
                <div className="col-md-6">
                  <div className="d-flex justify-content-center">
                    <div style={{ maxWidth: '300px', width: '100%' }}>
                      <TicketCard 
                        ticket={exampleGoldenTicket} 
                        event={exampleEvent} 
                        showQR={false}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Special Event Effects Section */}
          <div className="card mb-4">
            <div className="card-body">
              <h3 className="card-title">
                <span className="badge bg-info text-white me-2">✨</span>
                Special Event Effects
              </h3>
              <p className="card-text">
                Some validated tickets may display special visual effects based on the event date, 
                name, or other special characteristics. These effects add a unique touch to 
                commemorate special occasions and events.
              </p>
              
              <div className="row mt-4">
                <div className="col-md-6">
                  <h5>Seasonal Effects</h5>
                  <ul>
                    <li><strong>Holiday Celebrations:</strong> Special animations for Christmas, New Year's, and other holidays</li>
                    <li><strong>Monthly Themes:</strong> Color-coded effects based on the event month</li>
                    <li><strong>Pride Celebrations:</strong> Rainbow effects for pride-themed events</li>
                  </ul>
                </div>
                <div className="col-md-6">
                  <h5>Event-Based Effects</h5>
                  <ul>
                    <li><strong>Party Events:</strong> Confetti animations for party-themed events</li>
                    <li><strong>Special Numbers:</strong> Unique effects for events on special dates</li>
                    <li><strong>Themed Overlays:</strong> Custom visual treatments based on event content</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {/* How It Works Section */}
          <div className="card mb-4">
            <div className="card-body">
              <h3 className="card-title">
                <span className="badge bg-secondary text-white me-2">⚙️</span>
                How It Works
              </h3>
              <p className="card-text">
                Special effects are automatically applied to tickets when they are validated. 
                The system analyzes various factors about the event and ticket to determine 
                if any special visual treatments should be applied.
              </p>
              <p className="card-text">
                <strong>Important:</strong> Only validated tickets can receive special effects. 
                This ensures that the special visual treatments are earned through actual 
                event attendance or participation.
              </p>
            </div>
          </div>

          {/* Back Link */}
          <div className="text-center mt-4">
            <a 
              href="javascript:history.back()" 
              className="btn btn-outline-primary"
              data-testid="button-back"
            >
              ← Back
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}