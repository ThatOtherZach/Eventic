import { Link } from "wouter";
import {
  Sparkles,
  Shield,
  TrendingUp,
  Repeat,
  Sticker,
  Users,
  Calendar,
  Ticket as TicketIcon,
  Zap,
} from "lucide-react";
import manifestoIcon from "@assets/image_1756696153574.png";

export default function Manifesto() {
  const paragraphStyle = {
    fontSize: "1.125rem",
    lineHeight: "1.8",
    fontFamily: 'Georgia, "Times New Roman", serif',
    color: "#333",
  };

  const sectionStyle = {
    fontSize: "1.05rem",
    lineHeight: "1.7",
  };

  return (
    <div className="container py-5" style={{ maxWidth: "800px" }}>
      <div className="mb-5 text-center">
        <h1 className="display-4 mb-3">
          <img
            src={manifestoIcon}
            alt="Manifesto"
            style={{
              width: "48px",
              height: "48px",
              marginRight: "12px",
              verticalAlign: "middle",
            }}
          />
          The Manifesto
        </h1>
        <p className="lead text-muted">Buy the ticket. Take the ride.</p>
      </div>

      <div className="card mb-4">
        <div className="card-body">
          <h2 className="h4 mb-3">But... Why?</h2>
          <p className="mb-3" style={paragraphStyle}>
            I hate Ticketmaster. Those parasitic fees. The endless spam. All for
            a lousy PDF that costs more in "convenience charges" than actual
            convenience.
          </p>
          <p className="mb-3" style={paragraphStyle}>
            Eventbrite? A spreadsheet with delusions of grandeur, skimming 10%
            to generate the world's most boring tickets.
          </p>
          <p className="mb-3" style={paragraphStyle}>
            These companies are digital toll collectors at the gates of fun.
            Gatekeepers nobody asked for. Middleware... So here's my silly
            solution, Eventic!
          </p>

          <h5 className="mt-4 mb-3">🎟 Tickets That Don't Suck</h5>
          <p className="mb-3" style={paragraphStyle}>
            Your ticket can glow golden. It can transform based on the day, the
            month, your birthday, or other random chaos.
          </p>
          <p className="mb-3" style={paragraphStyle}>
            Drop custom stickers on tickets. Enable peer-to-peer validation for
            your underground warehouse rave. Lock tickets to GPS coordinates for
            that secret rooftop show. Enable voting for your anarcho-syndicated
            commune's bi-weekly internal affairs meeting.
          </p>
          <p className="mb-3" style={paragraphStyle}>
            This isn't just ticketing, it's digital metaphysical alchemy! Yes,
            I'm being serious. No I'm not drunk, stop asking.
          </p>

          <h5 className="mt-4 mb-3">💸 The Credits Game (Yes, It's a Game)</h5>
          <p className="mb-3" style={paragraphStyle}>
            OK, so here's where it gets weird (in a good way). We built an 
            entire economy around... wait for it... being nice. I know, revolutionary.
          </p>
          <p className="mb-3" style={paragraphStyle}>
            <strong>Credits are NOT tickets.</strong> Credits are like arcade tokens 
            for creating events. Tickets are what people use to actually show up. 
            Got it? Good. Everyone starts with 10 credits. You spend them to create 
            events (100-person event = 100 credits). But attending? Always free.
          </p>
          <p className="mb-3" style={paragraphStyle}>
            Here's the fun part: Rate an event with a thumbs up? Boom, you earn 1 
            credit. First time only though—we're not running a credit farm here. 
            Want to thumbs down that terrible DJ set? That'll cost you 1 credit. 
            Why? Because negativity should cost something, even if it's tiny.
          </p>
          <p className="mb-3" style={paragraphStyle}>
            Changed your mind? Switching your rating is free. We're not monsters.
          </p>
          
          <h5 className="mt-4 mb-3">🎢 The Reputation Rollercoaster</h5>
          <p className="mb-3" style={paragraphStyle}>
            Every 69 days (nice), your reputation gets composted. Not deleted—composted. 
            Like nature intended. This isn't LinkedIn where you hoard endorsements 
            until the heat death of the universe. Your rep is fresh, current, real.
          </p>
          <p className="mb-3" style={paragraphStyle}>
            Run good events? Your reputation badge evolves: Newbie → Rising Star → 
            Trusted → Elite → Legend → 😎 (yes, that's an actual badge). Run bad 
            events? Well, you'll find out in 69 days when you can try again.
          </p>
          <p className="mb-3" style={paragraphStyle}>
            The beauty? Bad actors can't game the system. Creating 100 fake accounts 
            to upvote yourself costs 10,000 credits. Good luck with that, chief.
          </p>
          
          <h5 className="mt-4 mb-3">📈 Surge Pricing (But Make It Gentle)</h5>
          <p className="mb-3" style={paragraphStyle}>
            Remember Uber's 10x surge pricing during that snowstorm? Yeah, we don't 
            do that. Our surge is more like a polite nudge. Popular event filling up? 
            Prices might go up 25%. Last minute panic buy? Another 25%. That's it.
          </p>
          <p className="mb-3" style={paragraphStyle}>
            It's logarithmic (fancy word for "gets less aggressive as it goes up"). 
            Because we want to reward early birds without punishing procrastinators 
            too hard. We've all been there.
          </p>
          
          <h5 className="mt-4 mb-3">🎭 The Absurdist Social Experiment</h5>
          <p className="mb-3" style={paragraphStyle}>
            Here's the beautiful, chaotic part: With P2P validation, you can create 
            events for literally anything. "Standing in this parking lot for 10 minutes." 
            "Synchronized yelling at the moon." "Being alive on a Tuesday." Turn it on 
            and everyone who shows up can validate each other. No gatekeepers. Pure chaos.
          </p>
          <p className="mb-3" style={paragraphStyle}>
            The kicker? These ridiculous moments can become permanent. That ticket from 
            "Emergency dance party in Steve's backyard because his ex got engaged"? That 
            proof you were at "The great pillow fight of 2025"? Mint it as an NFT for 
            under 5 bucks (price TBD, we're not greedy). 
          </p>
          <p className="mb-3" style={paragraphStyle}>
            Everything else vanishes after 69 days. But minted tickets? They're forever. 
            A permanent record that yes, you were there when 47 strangers decided to have 
            a staring contest in a Denny's parking lot at 3am. Was it stupid? Absolutely. 
            Was it real? The blockchain says yes.
          </p>
          <p className="mb-3" style={paragraphStyle}>
            This isn't about creating value. It's about proving existence. "I was there" 
            becomes immutable truth. Even if "there" was completely absurd.
          </p>
          
          <h5 className="mt-4 mb-3">💰 Real Money? Not Our Problem (Yet)</h5>
          <p className="mb-3" style={paragraphStyle}>
            Cash happens at the door. Venmo in the DMs. Crypto in the metaverse. 
            Whatever. We don't touch it. We're just the matchmaker between people 
            who throw parties and people who show up to them.
          </p>
          <p className="mb-3" style={paragraphStyle}>
            Soon™ we'll add Stripe (2% fee) and crypto payments for the brave. But 
            credits? They stay in the platform. No cash out. They're utility tokens, 
            not securities. The SEC can't hurt us here.
          </p>

          <h5 className="mt-4 mb-3">🔐 Control With Some Chaos</h5>
          <p className="mb-3" style={paragraphStyle}>
            <strong>Validation:</strong> Works in any browser. No app downloads.
            Simply Login and get validated at the event. Some questions may be
            asked for security.
          </p>
          <p className="mb-3" style={paragraphStyle}>
            <strong>Geofencing:</strong> If enabled, your ticket becomes
            location aware. It's only valid within a 690-meter radius. If
            disabled, users can enter from wherever they want. Defaults: off.
          </p>
          <p className="mb-3" style={paragraphStyle}>
            <strong>Multi-pass:</strong> Enable if one ticket allows multiple
            entries. Perfect for conferences or multi-day festivals. All event
            creation settings are permanent.
          </p>
          <p className="mb-3" style={paragraphStyle}>
            <strong>Surge pricing:</strong> Let capitalism work when demand
            spikes, like ride-sharing apps, you set the multiplier, 1.5x to 5x.
          </p>

          <h5 className="mt-4 mb-3">⏳ The 69-Day Rule</h5>
          <p className="mb-3" style={paragraphStyle}>
            Most moments are meant to fade. Event and ticket data self-destructs
            69 days after your event ends. A minimal archive survives up to a
            year, then vanishes too.
          </p>
          <p className="mb-3" style={paragraphStyle}>
            Until I ship the NFT feature. $2.69 turns your ticket into an
            eternal proof-of-experience. Optional. Zero pressure. Proof. You.
            Were. There. Stuck in the blockchain forever. Or until the world
            ends. Whichever comes first.
          </p>

          <h5 className="mt-4 mb-3">✨ The Philosophy</h5>
          <p className="mb-3" style={paragraphStyle}>
            No engagement metrics. No influencer tiers. No algorithmic
            manipulation. Just tickets to things that actually happen. In places
            that actually exist. For people who actually show up.
          </p>
          <p className="mb-3" style={paragraphStyle}>
            We built this for the underground comedy show. The warehouse rave.
            The popup restaurant. The anarchist book club. The rooftop ritual.
            Things that matter because they don't last forever.
          </p>

          <h5 className="mt-4 mb-3">🏁 The Promise</h5>
          <p className="mb-3" style={paragraphStyle}>
            Create weird events. Validate real moments. Let most things
            disappear. And when something truly matters? Mint it.
          </p>
          <p className="mb-3" style={paragraphStyle}>
            This is Eventic. We're not disrupting anything. We're not the future
            of anything. We're just making tickets that don't suck.
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
            <p style={sectionStyle}>
              Pure Wonka energy. When someone validates, they might strike
              gold—literally. Their ticket transforms into a shimmering golden
              masterpiece. No chocolate factory required.
            </p>
            <small className="text-muted">
              Stack it with rainbow effects for Super RGB status. It's
              unnecessary, but very gamer.
            </small>
          </div>

          <div className="mb-4">
            <h5 className="text-purple">
              ✨ Special Effects (Date-Based Magic)
            </h5>
            <p style={sectionStyle}>Your validated tickets can:</p>
            <ul style={sectionStyle}>
              <li>
                <strong>Explode with confetti</strong> on New Year's or
                birthdays
              </li>
              <li>
                <strong>Float hearts</strong> on Valentine's Day
              </li>
              <li>
                <strong>Summon ghosts</strong> 👻 on Halloween
              </li>
              <li>
                <strong>Snow festively</strong> during Christmas
              </li>
              <li>
                <strong>Launch fireworks</strong> on July 4th
              </li>
              <li>
                <strong>Glow rainbow</strong> during Pride Month
              </li>
              <li>
                <strong>Change colors</strong> based on the month
              </li>
              <li>
                <strong>Do something "nice"</strong> on the 1st (iykyk)
              </li>
            </ul>
            <small className="text-muted">
              Effects are permanent. No take-backs. Choose chaos wisely.
            </small>
          </div>

          <div className="mb-4">
            <h5 className="text-danger">📈 Surge Pricing (1.5x - 5x)</h5>
            <p style={sectionStyle}>
              When you hit 50% capacity, prices can multiply. Supply, meet
              demand. Demand, meet capitalism. It's like Uber but for fun.
            </p>
            <small className="text-muted">
              Warning: Creates artificial scarcity. Use responsibly. Or don't.
            </small>
          </div>

          <div className="mb-4">
            <h5 className="text-success">🔄 Recurring Events</h5>
            <p style={sectionStyle}>Your event can resurrect itself:</p>
            <ul style={sectionStyle}>
              <li>
                <strong>Weekly:</strong> Every Tuesday fight club
              </li>
              <li>
                <strong>Monthly:</strong> First Friday art walks
              </li>
              <li>
                <strong>Yearly:</strong> Annual gathering of the chosen ones
              </li>
            </ul>
            <small className="text-muted">
              The Phoenix feature. Your event dies and rises again,
              automatically.
            </small>
          </div>

          <div className="mb-4">
            <h5 className="text-pink">🎨 Custom Stickers</h5>
            <p style={sectionStyle}>
              Upload any image. Set the probability. Watch it randomly appear on
              validated tickets. Pizza slices, crying Jordan, your ex's face—we
              don't judge your artistic choices.
            </p>
            <small className="text-muted">
              Layers on top of everything. Maximum chaos potential.
            </small>
          </div>

          <div className="mb-4">
            <h5 className="text-info">🤝 P2P Validation</h5>
            <p style={sectionStyle}>
              Democratize the door. Any ticket holder becomes a validator.
              Perfect for events where "organized" is a loose concept. Flash
              mobs, raves, revolutionary meetings—you get it.
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

          <p className="mb-3" style={sectionStyle}>
            Forget QR codes. We use 6-digit PINs because simplicity beats
            complexity every time.
          </p>

          <h5>The Flow:</h5>
          <ol style={sectionStyle}>
            <li className="mb-2">
              <strong>Attendee generates PIN</strong> — Good for 5 minutes.
              Shows it to the door person.
            </li>
            <li className="mb-2">
              <strong>Validator enters PIN</strong> — Type 6 digits. Hit enter.
              That's it.
            </li>
            <li className="mb-2">
              <strong>Magic happens</strong> — Ticket validates. Effects
              trigger. Entry granted.
            </li>
            <li className="mb-2">
              <strong>One and done</strong> — Ticket is marked used forever. No
              double-dipping.
            </li>
          </ol>

          <div className="alert alert-info mt-3">
            <strong>The Rules:</strong>
            <ul className="mb-0 mt-2" style={sectionStyle}>
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
            <ol style={sectionStyle}>
              <li className="mb-2">
                <strong>Creation:</strong> Someone claims a ticket. A digital
                soul is born.
              </li>
              <li className="mb-2">
                <strong>Anticipation:</strong> Ticket waits. Dreams of
                validation. Counts down the days.
              </li>
              <li className="mb-2">
                <strong>The Moment:</strong> PIN entered. Validation initiated.
                Destiny approaches.
              </li>
              <li className="mb-2">
                <strong>Transformation:</strong> Effects trigger. Golden?
                Rainbow? Stickered? The universe decides.
              </li>
              <li className="mb-2">
                <strong>Immortality:</strong> Validated. Complete. Ready to fade
                or be minted forever.
              </li>
            </ol>
          </div>

          <div className="alert alert-info">
            <strong>Ticket Economics:</strong>
            <ul className="mb-0 mt-2" style={sectionStyle}>
              <li>Returns allowed at original price (2% platform fee)</li>
              <li>Free tickets can be returned to the pool</li>
              <li>Return window closes 1 hour before showtime</li>
              <li>Purchase history is transparent (no scalper paradise)</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-body text-center">
          <h2 className="h4 mb-3">Ready to Start Something?</h2>
          <p className="mb-4" style={sectionStyle}>
            You've read the manifesto. You get it. Now go create something worth
            remembering (for 69 days).
          </p>
          <div className="d-flex gap-3 justify-content-center">
            <Link href="/events/new">
              <a className="btn btn-primary" data-testid="button-create-event">
                <Zap className="me-2" size={18} />
                Create an Event
              </a>
            </Link>
            <Link href="/">
              <a
                className="btn btn-outline-secondary"
                data-testid="button-browse-events"
              >
                Browse Events
              </a>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
