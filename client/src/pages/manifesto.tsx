import { useState } from "react";
import { Link } from "wouter";
import {
  Sparkles,
  TrendingUp,
  Repeat,
  Sticker,
  Users,
  Calendar,
  Zap,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import manifestoIcon from "@assets/image_1756696153574.png";
import validationIcon from "@assets/users_green-4_1757356700434.png";
import ticketLifeIcon from "@assets/certificate_server-1_1757356779647.png";

export default function Manifesto() {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(),
  );

  const toggleSection = (sectionId: string) => {
    setExpandedSections((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(sectionId)) {
        newSet.delete(sectionId);
      } else {
        newSet.add(sectionId);
      }
      return newSet;
    });
  };

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

  const CollapsibleSection = ({
    id,
    title,
    children,
  }: {
    id: string;
    title: string;
    children: React.ReactNode;
  }) => {
    const isExpanded = expandedSections.has(id);
    return (
      <div className="mb-3">
        <h5
          className="mt-4 mb-3 d-flex align-items-center justify-content-between"
          style={{ cursor: "pointer" }}
          onClick={() => toggleSection(id)}
        >
          <span>{title}</span>
          {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
        </h5>
        {isExpanded && <div>{children}</div>}
      </div>
    );
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
      {/*════╝██║   ██║████╗  ██║╚══██╔══╝██║██╔═══██╗█║╚══██╔══╝██║██║╚══██╔══╝██║█
         Eventic Core by Saym Services Inc. A Global Live Action Missions Peer Reputation            and Rewards Operations Module or GLAM PR²OM for short. Complete Missions to get             validation which can unlock secret codes.
         ╚════5365637265745f436f64655f785855524d313535304e5878*/}
      <div className="card mb-4">
        <div className="card-body">
          <h2 className="h4 mb-3">But... Why?</h2>
          <p className="mb-3" style={paragraphStyle}>
            I hate Ticketmaster. Parasitic fees, endless spam and all for
            a lousy PDF that costs more in "convenience charges" than actual
            convenience.
          </p>
          <p className="mb-3" style={paragraphStyle}>
            Eventbrite? A spreadsheet with delusions of grandeur, skimming 10%
            to generate the world's most boring tickets.
          </p>
          <p className="mb-3" style={paragraphStyle}>
            These companies are digital toll collectors at the gates of fun.
            Gatekeepers nobody asked for. So here's my silly
            solution, Eventic!
          </p>

          <p className="mb-3" style={paragraphStyle}>
            Here there be dragons. This is a beta and lord knows there's bugs around here somewhere. I'm just a one man show at the moment, so if you find something wacky weird, please fly over to <a href="https://github.com/ThatOtherZach/Eventic" target="_blank">Github and report it</a>. Otherwise I'll never know.
          </p>

          <CollapsibleSection id="tickets" title="🎟 Tickets That Don't Suck">
            <p className="mb-3" style={paragraphStyle}>
              Now your ticket can glow golden. It can transform based on the day,
              the month, your birthday, or other random chaos.
            </p>
            <p className="mb-3" style={paragraphStyle}>
              Drop custom stickers on tickets. Enable peer-to-peer validation
              for your underground warehouse rave. Lock tickets to GPS
              coordinates for that secret rooftop show. Enable voting for your
              anarcho-syndicated commune's bi-weekly internal affairs meeting.
            </p>
            <p className="mb-3" style={paragraphStyle}>
              This isn't just ticketing, it's digital metaphysical alchemy! Yes,
              I'm being serious. No I'm not drunk, stop asking.
            </p>
          </CollapsibleSection>

          <CollapsibleSection id="sixtynine" title="⏳ The 69-Day Rule">
            <p className="mb-3" style={paragraphStyle}>
              Most moments are meant to fade. Event and ticket data
              self-destructs 69 days after your event ends. A minimal archive
              survives up to a year, then vanishes too.
            </p>
            <p className="mb-3" style={paragraphStyle}>
              Want to keep it long term? For just $2.69 you can mint your ticket into an
              eternal proof-of-experience digital collectable. Totally optional. Zero pressure. We store the anchor point for your collectable and you're free to take it where evever the blockchain takes you.
            </p>
          </CollapsibleSection>

          <CollapsibleSection
            id="reputation"
            title="🎢 The 69-Day Reputation Window"
          >
            <p className="mb-3" style={paragraphStyle}>
              Only events from the last 69
              days count toward your score. Run an amazing event today? Those
              thumbs up boost your rep immediately. But in 69 days? Poof, they
              fall off. Your reputation is always based on what
              you've done lately, not what you did last year.
            </p>
            <p className="mb-3" style={paragraphStyle}>
              Think of it like a rolling average of your recent vibe. Got 100
              thumbs up from an event 68 days ago? Tomorrow you'll need fresh
              ones to maintain your status. Your badge evolves in real-time: NPC
              → Interesting → Nice → 😎.
            </p>
            <p className="mb-3" style={paragraphStyle}>
              This revolving door reputation system means bad events
              can't haunt you forever as redemption is always 69 days away. You
              can't coast on past glory—stay active or fade away. Gaming the
              system is pointless since the ratings expire with the events.
            </p>
            <p className="mb-3" style={paragraphStyle}>
              It's reputation with an expiration date. Fresh, organic, and
              impossible to hoard.
            </p>
          </CollapsibleSection>

          <CollapsibleSection
            id="credits"
            title="💸 The Ticket Economy"
          >
            <p className="mb-3" style={paragraphStyle}>
              OK, so here's where it gets weird (in a good way). Eventic has an
              entire economy around... wait for it... being nice! I know,
              revolutionary.
            </p>
            <p className="mb-3" style={paragraphStyle}>
              Tickets for all users are like arcade
              tokens, they're used for interacting with the platform for actions like creating events. So an event with 50 attendees will cost you 50 tickets. Tickets are what people use to
              actually show up. Got it? Good. Everyone starts with 10 tickets as a signup bonus.
              You spend them to create events, boost to the featured section of the home page as well as increase odds of getting specials effects applied. Attending an event is always free, unless the event organizer has applied a ticket price to pay at the door on online with one of our payment options.
            </p>
            <p className="mb-3" style={paragraphStyle}>
              Here's the fun part: Rate an event with a thumbs up? Boom, you
              earn 1 ticket. First time only though—we're not running a credit
              farm here. Want to thumbs down that terrible DJ set? That'll cost
              you 1 ticket. Why? Because negativity should cost something, even
              if it's tiny.
            </p>
            <p className="mb-3" style={paragraphStyle}>
              Changed your mind? Switching your rating is free. We're not
              monsters.
            </p>
          </CollapsibleSection>

          <CollapsibleSection
            id="surge"
            title="📈 Gentle Surge Pricing"
          >
            <p className="mb-3" style={paragraphStyle}>
              Remember Uber's 10x surge pricing during that snowstorm? Yeah, we
              don't do that. Our surge is more like a polite nudge. Popular
              event filling up? Prices might go up 25%. Last minute panic buy?
              Another 25%. That's it.
            </p>
            <p className="mb-3" style={paragraphStyle}>
              It's logarithmic (fancy word for "gets less aggressive as it goes
              up"). Because we want to reward early birds without punishing
              procrastinators too hard. We've all been there.
            </p>
          </CollapsibleSection>

          <CollapsibleSection
            id="money"
            title="💰 Real Money? Not Here"
          >
            <p className="mb-3" style={paragraphStyle}>
              Event ticket payments happens at the door. Venmo in the DMs. Crypto in the
              metaverse. Whatever. We don't touch it. We're just the matchmaker
              between people who throw parties and people who show up to them.
            </p>
            <p className="mb-3" style={paragraphStyle}>
              We do allow event creators to add crypto payments, but we don't touch any of those funds, creators keep 100% of their ticket revenue.</p>
          </CollapsibleSection>

          <CollapsibleSection
            id="absurdist"
            title="🎭 Absurd Social Experiment Included"
          >
            <p className="mb-3" style={paragraphStyle}>
              Here's the beautiful, chaotic part: With P2P validation, you can
              create events for literally anything. "Standing in this parking
              lot for 10 minutes." "Synchronized yelling at the moon." "Being
              alive on a Tuesday." Turn it on and everyone who shows up can
              validate each other. No gatekeepers. Pure chaos.
            </p>
            <p className="mb-3" style={paragraphStyle}>
              The kicker? These ridiculous moments can become permanent. That
              ticket from "Emergency dance party in Steve's backyard because his
              ex got engaged"? That proof you were at "The great pillow fight of
              2025"? Mint it as an digital collectable and keep it forever.
            </p>
            <p className="mb-3" style={paragraphStyle}>
              Everything else vanishes after 69 days unless you mint it as a digital collectable. A permanent record that yes, you were there when
              47 strangers decided to have a staring contest in a Denny's
              parking lot at 3am. Was it stupid? Absolutely. Can you prove it for years to come? Yup.
            </p>
            <p className="mb-3" style={paragraphStyle}>
              This isn't about creating value. It's about proving existence. "I
              was there" becomes immutable truth. Even if "there" was completely
              absurd.
            </p>
          </CollapsibleSection>

          <CollapsibleSection id="control" title="🔐 Control With Some Chaos">
            <p className="mb-3" style={paragraphStyle}>
              <strong>Validation:</strong> Works in any browser. No app
              downloads. Simply Login and get validated at the event. Some
              questions may be asked for security.
            </p>
            <p className="mb-3" style={paragraphStyle}>
              <strong>Geofencing:</strong> If enabled, your ticket becomes
              location aware. It's only valid within a 300 meter radius. If
              disabled, users can enter from wherever they want. Defaults: off.
            </p>
            <p className="mb-3" style={paragraphStyle}>
              <strong>Multi-pass:</strong> Enable if one ticket allows multiple
              entries. Perfect for conferences or multi-day festivals. All event
              creation settings are permanent.
            </p>
          </CollapsibleSection>

          <CollapsibleSection
            id="location"
            title="📍 Your Location = Your Business"
          >
            <p className="mb-3" style={paragraphStyle}>
              Let's be crystal clear: <strong>We don't track you.</strong>{" "}
              Period. No creepy location history. No selling your movements to
              advertisers. No "anonymous" analytics that aren't really
              anonymous.
            </p>
            <p className="mb-3" style={paragraphStyle}>
              When you validate a geofenced ticket, your browser checks if
              you're within 300 meters of the venue. This happens{" "}
              <strong>on your device</strong>, takes 2 seconds, then we forget
              it forever. The GPS check never leaves your phone. We literally
              don't know where you are and don't want to know.
            </p>
            <p className="mb-3" style={paragraphStyle}>
              Your "location preference" for the leaderboard? That's just the
              country of the last event you attended. Not GPS. Not IP tracking.
              Just "Oh, you went to that show in Berlin? Here's Berlin's
              leaderboard." It updates when you participate, expires after 69
              days if you don't.
            </p>
            <p className="mb-3" style={paragraphStyle}>
              We treat data passivley, only used when we need it and dumped like a bad ex the second we don't. You can also delete your account if you want.
            </p>
          </CollapsibleSection>

          <CollapsibleSection id="philosophy" title="✨ The Philosophy">
            <p className="mb-3" style={paragraphStyle}>
              No engagement metrics. No influencer tiers. No algorithmic
              manipulation. Just tickets to things that actually happen. In
              places that actually exist. For people who actually show up.
            </p>
            <p className="mb-3" style={paragraphStyle}>
              We built this for the underground comedy show. The warehouse rave.
              The popup restaurant. The anarchist book club. The rooftop ritual.
              Things that matter because they don't last forever.
            </p>
          </CollapsibleSection>

          <CollapsibleSection id="promise" title="🏁 The Promise">
            <p className="mb-3" style={paragraphStyle}>
              Create weird events. Validate real moments. Let most things
              disappear. And when something truly matters? Mint it.
            </p>
            <p className="mb-3" style={paragraphStyle}>
              This is Eventic. We're not disrupting anything. We're not the
              future of anything. We're just making tickets that don't suck.
            </p>
          </CollapsibleSection>
        </div>
      </div>

      <div className="card mb-4">
        <div className="card-body">
          <h2 className="h4 mb-3 d-flex align-items-center">
            <Sparkles className="text-warning me-2" size={24} />
            The Secret Sauce: Event Settings
          </h2>

          <div className="mb-4">
            <h5 className="text-warning">Golden Tickets</h5>
            <p style={sectionStyle}>
              Pure Wonka energy. When someone validates, they might strike gold.
              Their ticket transforms into a shimmering golden masterpiece. No
              chocolate factory required.
            </p>
            <small className="text-muted">
              Stack it with rainbow effects for Super RGB status. It's
              unnecessary, but very gamer.
            </small>
          </div>

          <div className="mb-4">
            <h5 className="text-purple">
              Special Effects (Date-Based Magic)
            </h5>
            <p style={sectionStyle}>
              Some of the effects that can be applied to validated tickets are:
            </p>
            <ul style={sectionStyle}>
              <li>
                <strong>Explode with confetti</strong> on New Year's or
                birthdays
              </li>
              <li>
                <strong>Change colors</strong> based on the month
              </li>
              <li>
                <strong>Do something "nice"</strong> on the 1st (iykyk)
              </li>
            </ul>
            <small className="text-muted">
              Effects are permanent. No take-backs. You're stuck with them.
            </small>
          </div>

          <div className="mb-4">
            <h5 className="text-danger">Surge Pricing (1.5x - 5x)</h5>
            <p style={sectionStyle}>
              When you hit 50% capacity, prices can multiply. Supply, meet
              demand. Demand, meet capitalism. It's like Uber but for fun.
            </p>
            <small className="text-muted">
              Warning: Creates artificial scarcity. Use responsibly. Or don't.
            </small>
          </div>

          <div className="mb-4">
            <h5 className="text-pink">Custom Stickers</h5>
            <p style={sectionStyle}>
              Upload any image or gif URL. Set the probability. Watch it
              randomly appear on validated tickets. Pizza slices, crying Jordan,
              your ex's face—we don't judge your artistic choices.
            </p>
            <small className="text-muted">
              Layers on top of everything. Maximum chaos potential.
            </small>
          </div>

          <div className="mb-4">
            <h5 className="text-info">P2P Validation</h5>
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
            <img src={validationIcon} alt="" style={{ width: "24px", height: "24px", marginRight: "8px" }} />
            Validation: How the Magic Happens
          </h2>

          <p className="mb-3" style={sectionStyle}>
            Forget QR codes. We use 4-digit PINs because simplicity beats
            complexity every time.
          </p>

          <h5>The Flow:</h5>
          <ol style={sectionStyle}>
            <li className="mb-2">
              <strong>Attendee generates PIN</strong> — Good for 3 minutes.
              Shows it to the door person.
            </li>
            <li className="mb-2">
              <strong>Validator enters PIN</strong> — Type 4 digits. Hit enter.
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
              <li>PINs expire in 3 minutes (security through ephemerality)</li>
              <li>Generates PINs until validated</li>
              <li>Event creators always have validation power</li>
              <li>P2P mode = everyone can validate</li>
              <li>
                Works on any device with a browser and internet, GPS may be
                required
              </li>
            </ul>
          </div>
        </div>
      </div>

      <div className="card mb-4">
        <div className="card-body">
          <h2 className="h4 mb-3 d-flex align-items-center">
            <img src={ticketLifeIcon} alt="" style={{ width: "24px", height: "24px", marginRight: "8px" }} />
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
                <strong>Immortality:</strong> Validated. Complete. Ready to be
                minted as a digital collectable, or let it be deleted.
              </li>
            </ol>
          </div>

          <div className="alert alert-info">
            <strong>Ticket Economics:</strong>
            <ul className="mb-0 mt-2" style={sectionStyle}>
              <li>Returns allowed at original price, refunds are with the event creators</li>
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
