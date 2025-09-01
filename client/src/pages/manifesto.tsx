import { Link } from "wouter";
import { Sparkles, Shield, TrendingUp, Repeat, Sticker, Users, Calendar, Ticket as TicketIcon, Zap } from "lucide-react";

export default function Manifesto() {
  return (
    <div className="container py-5" style={{ maxWidth: '800px' }}>
      <div className="mb-5 text-center">
        <h1 className="display-4 mb-3">🎭 The Manifesto</h1>
        <p className="lead text-muted">
          Welcome to the revolution.
        </p>
      </div>

      <div className="card mb-4">
        <div className="card-body">
          <h2 className="h4 mb-3">Why We're Here</h2>
          <p className="mb-3">
            I hate Ticketmaster. Those parasitic fees. The endless spam. All for a lousy PDF that costs more in "convenience charges" than actual convenience. 
          </p>
          <p className="mb-3">
            Eventbrite? A spreadsheet with delusions of grandeur, skimming 10% to generate the world's most boring tickets.
          </p>
          <p className="mb-3">
            These companies are digital toll collectors at the gates of fun. Gatekeepers nobody asked for. Middlemen in an age that doesn't need them.
          </p>
          <p className="mb-3">
            <strong>So I built Eventic.</strong>
          </p>
          
          <h5 className="mt-4 mb-3">🎟 Tickets That Don't Suck</h5>
          <p className="mb-3">
            Your ticket can glow golden. It can explode with confetti. It can transform based on the moon phase, your birthday, or pure random chaos.
          </p>
          <p className="mb-3">
            Drop custom stickers on tickets. Enable peer-to-peer validation for your underground warehouse rave. Lock tickets to GPS coordinates for that secret rooftop show.
          </p>
          <p className="mb-3">
            This isn't just ticketing—it's digital alchemy.
          </p>
          
          <h5 className="mt-4 mb-3">💸 The Economics of Fun</h5>
          <p className="mb-3">
            No subscription fees. No percentage cuts. No "platform charges" or whatever corporate doublespeak they invented this week.
          </p>
          <p className="mb-3">
            You get tickets. Use them to create events. That's it.
          </p>
          <p className="mb-3">
            New users start with 10 free tickets. Log in daily for 2-4 more (because loyalty should be rewarded, not exploited). Need more? Buy a pack. Simple. Transparent. Not evil.
          </p>
          
          <h5 className="mt-4 mb-3">🔐 Control Without the Chaos</h5>
          <p className="mb-3">
            <strong>Validation:</strong> Works in any browser. No app downloads. No account required for attendees.
          </p>
          <p className="mb-3">
            <strong>Geofencing:</strong> Lock events to a 690-meter radius. Perfect for speakeasies and flash mobs.
          </p>
          <p className="mb-3">
            <strong>Multi-pass:</strong> One ticket, multiple entries. Because some parties need bathroom breaks.
          </p>
          <p className="mb-3">
            <strong>Surge pricing:</strong> Let capitalism work for you when demand spikes.
          </p>
          
          <h5 className="mt-4 mb-3">⏳ The 69-Day Rule</h5>
          <p className="mb-3">
            Everything dies. Even your event data.
          </p>
          <p className="mb-3">
            69 days after your event ends, poof—gone. A minimal archive lingers for a year, then that vanishes too.
          </p>
          <p className="mb-3">
            Why? Because digital hoarding is a disease. Most moments are meant to fade. The internet doesn't need another permanent record of your cousin's birthday party.
          </p>
          <p className="mb-3">
            Unless... you mint it. $2.69 turns your ticket into an eternal NFT artifact. Your proof you were there when it mattered. Completely optional. Zero pressure.
          </p>
          
          <h5 className="mt-4 mb-3">✨ The Philosophy</h5>
          <p className="mb-3">
            No algorithms deciding what you see. No engagement metrics. No influencer tiers. No algorithmic timeline manipulation.
          </p>
          <p className="mb-3">
            Just tickets to things that actually happen, in places that actually exist, with people who actually show up.
          </p>
          <p className="mb-3">
            We built this for the underground comedy show, the warehouse rave, the popup restaurant, the secret screening, the anarchist book club, the rooftop ritual, the things that matter because they don't last forever.
          </p>
          
          <h5 className="mt-4 mb-3">🏁 The Promise</h5>
          <p className="mb-3">
            Create weird events. Validate real moments. Let most things disappear.
          </p>
          <p className="mb-3">
            This is Eventic. We're not disrupting anything. We're just making tickets fun again.
          </p>
          <p className="text-muted small mt-3">
            <em>Buy the ticket. Take the ride. Let it burn.</em>
          </p>
        </div>
      </div>

      <div className="card mb-4">
        <div className="card-body">
          <h2 className="h4 mb-3 d-flex align-items-center">
            <Sparkles className="text-warning me-2" size={24} />
            The Secret Sauce: Event Settings
          </h2>
          
          <div className="mb-4">
            <h5 className="text-warning">🎫 Golden Tickets (10% Chance)</h5>
            <p>
              Pure Wonka energy. When someone validates, they might strike gold—literally. Their ticket transforms into a shimmering golden masterpiece. No chocolate factory required.
            </p>
            <small className="text-muted">
              Stack it with rainbow effects for DOUBLE GOLDEN status. It's unnecessarily awesome.
            </small>
          </div>

          <div className="mb-4">
            <h5 className="text-purple">✨ Special Effects (Date-Based Magic)</h5>
            <p>
              Your validated tickets can:
            </p>
            <ul>
              <li><strong>Explode with confetti</strong> on New Year's or birthdays</li>
              <li><strong>Float hearts</strong> on Valentine's Day</li>
              <li><strong>Summon ghosts</strong> 👻 on Halloween</li>
              <li><strong>Snow festively</strong> during Christmas</li>
              <li><strong>Launch fireworks</strong> on July 4th</li>
              <li><strong>Glow rainbow</strong> during Pride Month</li>
              <li><strong>Change colors</strong> based on the month</li>
              <li><strong>Do something "nice"</strong> on the 1st (iykyk)</li>
            </ul>
            <small className="text-muted">
              Effects are permanent. No take-backs. Choose chaos wisely.
            </small>
          </div>

          <div className="mb-4">
            <h5 className="text-danger">📈 Surge Pricing (1.5x - 5x)</h5>
            <p>
              When you hit 50% capacity, prices can multiply. Supply, meet demand. Demand, meet capitalism. It's like Uber but for fun.
            </p>
            <small className="text-muted">
              Warning: Creates artificial scarcity. Use responsibly. Or don't.
            </small>
          </div>

          <div className="mb-4">
            <h5 className="text-success">🔄 Recurring Events</h5>
            <p>
              Your event can resurrect itself:
            </p>
            <ul>
              <li><strong>Weekly:</strong> Every Tuesday fight club</li>
              <li><strong>Monthly:</strong> First Friday art walks</li>
              <li><strong>Yearly:</strong> Annual gathering of the chosen ones</li>
            </ul>
            <small className="text-muted">
              The Phoenix feature. Your event dies and rises again, automatically.
            </small>
          </div>

          <div className="mb-4">
            <h5 className="text-pink">🎨 Custom Stickers</h5>
            <p>
              Upload any image. Set the probability. Watch it randomly appear on validated tickets. Pizza slices, crying Jordan, your ex's face—we don't judge your artistic choices.
            </p>
            <small className="text-muted">
              Layers on top of everything. Maximum chaos potential.
            </small>
          </div>

          <div className="mb-4">
            <h5 className="text-info">🤝 P2P Validation</h5>
            <p>
              Democratize the door. Any ticket holder becomes a validator. Perfect for events where "organized" is a loose concept. Flash mobs, raves, revolutionary meetings—you get it.
            </p>
            <small className="text-muted">
              Permanent choice. There's no going back to centralized authority.
            </small>
          </div>
        </div>
      </div>

      <div className="card mb-4">
        <div className="card-body">
          <h2 className="h4 mb-3 d-flex align-items-center">
            <Shield className="text-primary me-2" size={24} />
            Validation: How the Magic Happens
          </h2>
          
          <p className="mb-3">
            Forget QR codes. We use 6-digit PINs because simplicity beats complexity every time.
          </p>

          <h5>The Flow:</h5>
          <ol>
            <li className="mb-2">
              <strong>Attendee generates PIN</strong> — Good for 5 minutes. Shows it to the door person.
            </li>
            <li className="mb-2">
              <strong>Validator enters PIN</strong> — Type 6 digits. Hit enter. That's it.
            </li>
            <li className="mb-2">
              <strong>Magic happens</strong> — Ticket validates. Effects trigger. Entry granted.
            </li>
            <li className="mb-2">
              <strong>One and done</strong> — Ticket is marked used forever. No double-dipping.
            </li>
          </ol>

          <div className="alert alert-info mt-3">
            <strong>The Rules:</strong>
            <ul className="mb-0 mt-2">
              <li>PINs expire in 5 minutes (security through ephemerality)</li>
              <li>Unlimited PIN generation until validated</li>
              <li>Event creators always have validation power</li>
              <li>P2P mode = everyone can validate</li>
              <li>Works on any device with a browser</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="card mb-4">
        <div className="card-body">
          <h2 className="h4 mb-3 d-flex align-items-center">
            <TicketIcon className="text-success me-2" size={24} />
            The Life of a Ticket
          </h2>
          
          <div className="mb-3">
            <h5>From Birth to Glory:</h5>
            <ol>
              <li className="mb-2">
                <strong>Creation:</strong> Someone claims a ticket. A digital soul is born.
              </li>
              <li className="mb-2">
                <strong>Anticipation:</strong> Ticket waits. Dreams of validation. Counts down the days.
              </li>
              <li className="mb-2">
                <strong>The Moment:</strong> PIN entered. Validation initiated. Destiny approaches.
              </li>
              <li className="mb-2">
                <strong>Transformation:</strong> Effects trigger. Golden? Rainbow? Stickered? The universe decides.
              </li>
              <li className="mb-2">
                <strong>Immortality:</strong> Validated. Complete. Ready to fade or be minted forever.
              </li>
            </ol>
          </div>

          <div className="alert alert-info">
            <strong>Ticket Economics:</strong>
            <ul className="mb-0 mt-2">
              <li>Resale allowed at original price (2% platform fee)</li>
              <li>Free tickets can be returned to the pool</li>
              <li>Resale window closes 1 hour before showtime</li>
              <li>Purchase history is transparent (no scalper paradise)</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-body text-center">
          <h2 className="h4 mb-3">Ready to Start Something?</h2>
          <p className="mb-4">
            You've read the manifesto. You get it. Now go create something worth remembering (for 69 days).
          </p>
          <div className="d-flex gap-3 justify-content-center">
            <Link href="/events/new">
              <a className="btn btn-primary" data-testid="button-create-event">
                <Zap className="me-2" size={18} />
                Create an Event
              </a>
            </Link>
            <Link href="/">
              <a className="btn btn-outline-secondary" data-testid="button-browse-events">
                Browse Events
              </a>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}