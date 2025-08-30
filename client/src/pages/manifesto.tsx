import { Link } from "wouter";
import { Sparkles, Shield, TrendingUp, Repeat, Sticker, Users, Calendar, Ticket as TicketIcon, Zap } from "lucide-react";

export default function Manifesto() {
  return (
    <div className="container py-5" style={{ maxWidth: '800px' }}>
      <div className="mb-5 text-center">
        <h1 className="display-4 mb-3">📜 The Event Manifesto</h1>
        <p className="lead text-muted">
          Everything you never knew you needed to know about running events like a boss
        </p>
      </div>

      <div className="card mb-4">
        <div className="card-body">
          <h2 className="h4 mb-3">Mission Statement</h2>
          <p className="mb-3">
            It started like all great revolutions do—with edibles, craft beer, and the creeping dread of rejection emails piling up like parking tickets on a dead man’s car. I woke up sweating, buzzing, half-convinced I was being chased through the desert by the ghost of Steve Jobs. Somewhere in that chemical afterglow, I muttered the words that would change everything: “To hell with this. I’m building my own circus.”
          </p>
          <p className="mb-3">
            And in that moment of divine inspiration (or THC-induced clarity), I decided to take on 
            the final boss of the ticketing world: Ticketmaster. Yeah, THAT Ticketmaster. The one 
            with the fees that cost more than your actual ticket. The one that crashes every time 
            Taylor Swift announces a tour.
          </p>
          <p>
            So here it is, folks. My magnum opus. My middle finger to the establishment. 
            An event ticketing platform where tickets get golden, effects get special, and 
            sometimes your event just keeps coming back like that friend who "forgot" their wallet. 
            This is where event creators become legends and ticket holders get treated like actual humans.
          </p>
          <p className="text-muted small mt-3">
            <em>Take that, corporate overlords. This one's for the people.</em>
          </p>
        </div>
      </div>

      <div className="card mb-4">
        <div className="card-body">
          <h2 className="h4 mb-3 d-flex align-items-center">
            <Sparkles className="text-warning me-2" size={24} />
            Event Settings: The Fun Stuff
          </h2>
          
          <div className="mb-4">
            <h5 className="text-warning">🎫 Golden Tickets</h5>
            <p>
              Remember Willy Wonka? Yeah, it's like that but without the chocolate river. 
              Enable this bad boy and 10% of your validated tickets turn GOLDEN. That's right, 
              actual digital gold (not redeemable for real gold, we checked). Winners get that 
              sweet, sweet golden glow that says "I'm special" without actually saying it.
            </p>
            <small className="text-muted">
              Pro tip: If someone gets both golden AND rainbow effects, they become DOUBLE GOLDEN. 
              It's like winning the lottery twice, but cooler.
            </small>
          </div>

          <div className="mb-4">
            <h5 className="text-purple">✨ Special Effects</h5>
            <p>
              Turn your boring tickets into a Michael Bay movie! When enabled, validated tickets 
              get random visual effects based on super secret conditions:
            </p>
            <ul>
              <li><strong>Confetti:</strong> For birthdays and New Year's - because who doesn't love digital confetti?</li>
              <li><strong>Hearts:</strong> Valentine's Day special - spread the love, literally</li>
              <li><strong>Spooky Ghosts:</strong> Halloween vibes with floating 👻 emojis</li>
              <li><strong>Christmas Magic:</strong> Santa, trees, and snow for the festive season</li>
              <li><strong>Fireworks:</strong> 4th of July explosions (no fingers were harmed)</li>
              <li><strong>Pride Rainbow:</strong> June pride month with fabulous gradients</li>
              <li><strong>Monthly Colors:</strong> Each month gets its own special color theme</li>
              <li><strong>"Nice" Effect:</strong> Events on the 1st get this... nice surprise</li>
            </ul>
            <small className="text-muted">
              Effects are permanent once assigned - no take-backsies!
            </small>
          </div>

          <div className="mb-4">
            <h5 className="text-danger">📈 Surge Pricing</h5>
            <p>
              Like your favorite ride-sharing app, but for events! Set a multiplier (1.5x to 5x) 
              and watch prices go brrrr when tickets start flying off the digital shelves. 
              Kicks in when you hit 50% capacity because supply and demand is real, folks.
            </p>
            <small className="text-muted">
              Warning: May cause FOMO. Use responsibly.
            </small>
          </div>

          <div className="mb-4">
            <h5 className="text-success">🔄 Recurring Events</h5>
            <p>
              Got a weekly poker night? Monthly book club? Annual "definitely-not-a-cult" meeting? 
              Set it to recur and your event resurrects itself like a phoenix after it ends:
            </p>
            <ul>
              <li><strong>Weekly:</strong> Every 7 days, like clockwork</li>
              <li><strong>Monthly:</strong> Same date each month (or closest valid date)</li>
              <li><strong>Annually:</strong> Once a year, for those special occasions</li>
            </ul>
            <small className="text-muted">
              The event automatically recreates itself after it ends. Set it and forget it!
            </small>
          </div>

          <div className="mb-4">
            <h5 className="text-pink">🎨 Custom Stickers</h5>
            <p>
              Upload a sticker URL and set the odds (1-100%). When tickets get validated, 
              BAM! Your custom sticker might float around like a beautiful butterfly. 
              Or a pizza. Or your ex's face. We don't judge.
            </p>
            <small className="text-muted">
              Stickers overlay on EVERYTHING - golden tickets, special effects, your hopes and dreams...
            </small>
          </div>

          <div className="mb-4">
            <h5 className="text-info">🤝 P2P Validation</h5>
            <p>
              Democracy comes to ticket validation! Enable this and ANY ticket holder can 
              validate other tickets. It's like deputizing everyone at your event. 
              Perfect for flash mobs, raves, or events where you "might not make it" (we see you).
            </p>
            <small className="text-muted">
              Cannot be changed after creation - choose wisely!
            </small>
          </div>
        </div>
      </div>

      <div className="card mb-4">
        <div className="card-body">
          <h2 className="h4 mb-3 d-flex align-items-center">
            <Shield className="text-primary me-2" size={24} />
            The Validator: PIN Code Power
          </h2>
          
          <p className="mb-3">
            Forget QR codes - we're keeping it simple with good old PIN codes. 
            The validator is your gateway to checking tickets at the door. 
            Navigate to <Link href="/scanner"><a className="text-primary">the validator page</a></Link> and 
            become the gatekeeper of your event.
          </p>

          <h5>How PIN Validation Works:</h5>
          <ol>
            <li className="mb-2">
              <strong>Ticket holders get a PIN</strong> - When someone views their ticket, they can generate 
              a 6-digit validation PIN that's good for 5 minutes. It's like a secret handshake, but with numbers.
            </li>
            <li className="mb-2">
              <strong>Open the validator</strong> - Click "Validate" in the navigation (the checkmark icon)
            </li>
            <li className="mb-2">
              <strong>Enter the PIN</strong> - Type in that 6-digit code the ticket holder shows you
            </li>
            <li className="mb-2">
              <strong>Watch the magic happen</strong> - Valid ticket? ✅ Special effects might appear! 
              Invalid, expired, or already used? ❌ No entry for you!
            </li>
          </ol>

          <div className="alert alert-info mt-3">
            <strong>PIN Code Facts:</strong>
            <ul className="mb-0 mt-2">
              <li>PINs expire after 5 minutes (keeps things secure)</li>
              <li>Each ticket can generate unlimited PINs (until it's validated)</li>
              <li>Once validated, the ticket is marked as used forever</li>
              <li>Event creators can ALWAYS validate their own event tickets</li>
              <li>P2P events? Any ticket holder can validate others</li>
              <li>Regular events? Only the creator or designated validators allowed</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="card mb-4">
        <div className="card-body">
          <h2 className="h4 mb-3 d-flex align-items-center">
            <TicketIcon className="text-success me-2" size={24} />
            Ticket Life Cycle: From Birth to Glory
          </h2>
          
          <div className="mb-3">
            <h5>The Journey of a Ticket:</h5>
            <ol>
              <li className="mb-2">
                <strong>Birth:</strong> Someone buys/claims a ticket (aww, it's beautiful)
              </li>
              <li className="mb-2">
                <strong>Adolescence:</strong> Ticket sits in inventory, dreams of being validated
              </li>
              <li className="mb-2">
                <strong>The Big Moment:</strong> QR code gets scanned at the event
              </li>
              <li className="mb-2">
                <strong>Transformation:</strong> Effects assigned! Golden? Special? Sticker? All three?!
              </li>
              <li className="mb-2">
                <strong>Glory:</strong> Ticket marked as validated, effects permanent, life complete
              </li>
            </ol>
          </div>

          <div className="alert alert-info">
            <strong>Fun Facts:</strong>
            <ul className="mb-0 mt-2">
              <li>Tickets can be resold at original price (2% fee because servers aren't free)</li>
              <li>Free tickets can be "returned" (fancy word for giving them back)</li>
              <li>Resale stops 1 hour before event (no last-minute shenanigans)</li>
              <li>Purchase info shows on validated tickets (we see you, scalpers)</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-body text-center">
          <h2 className="h4 mb-3">Ready to Create Some Magic?</h2>
          <p className="mb-4">
            Now that you're basically a PhD in Event Management (unofficial, non-accredited), 
            go forth and create events that would make your mom proud!
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