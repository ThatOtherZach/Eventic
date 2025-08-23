import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { Ticket, Mail, Lock, AlertCircle, Info } from "lucide-react";

export default function AuthPage() {
  const { user, signUp, verifyOtp } = useAuth();
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [stage, setStage] = useState<"email" | "otp">("email");
  const [isLoading, setIsLoading] = useState(false);

  // Redirect if already logged in
  if (user) {
    setLocation("/");
    return null;
  }

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    
    setIsLoading(true);
    try {
      await signUp(email);
      setStage("otp");
    } catch (error) {
      // Error is handled in the hook
    } finally {
      setIsLoading(false);
    }
  };

  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp) return;
    
    setIsLoading(true);
    try {
      await verifyOtp(email, otp);
      // Redirect is handled in the auth hook after successful verification
    } catch (error) {
      // Error is handled in the hook
    } finally {
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    setStage("email");
    setOtp("");
  };

  return (
    <div className="container-fluid min-vh-100">
      <div className="row min-vh-100">
        {/* Left side - Form */}
        <div className="col-12 col-md-6 d-flex align-items-center justify-content-center p-4">
          <div className="w-100" style={{ maxWidth: "400px" }}>
            <div className="text-center mb-5">
              <div className="bg-primary bg-opacity-10 rounded-circle p-3 d-inline-flex mb-3">
                <Ticket className="text-primary" size={32} />
              </div>
              <h2 className="h3 fw-bold">Welcome to EventTicket Pro</h2>
              <p className="text-muted">
                {stage === "email" 
                  ? "Enter your email to get started" 
                  : "Check your email for login options"}
              </p>
            </div>

            {stage === "email" ? (
              <form onSubmit={handleEmailSubmit}>
                <div className="mb-4">
                  <label htmlFor="email" className="form-label">
                    Email Address
                  </label>
                  <div className="input-group">
                    <span className="input-group-text">
                      <Mail size={18} />
                    </span>
                    <input
                      type="email"
                      className="form-control"
                      id="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      autoFocus
                      data-testid="input-email"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="btn btn-primary w-100"
                  disabled={isLoading || !email}
                  data-testid="button-send-code"
                >
                  {isLoading ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" />
                      Sending...
                    </>
                  ) : (
                    "Send Login Email"
                  )}
                </button>
              </form>
            ) : (
              <form onSubmit={handleOtpSubmit}>
                <div className="mb-3">
                  <button
                    type="button"
                    className="btn btn-link p-0 text-decoration-none"
                    onClick={handleBack}
                    data-testid="button-back"
                  >
                    ← Back to email
                  </button>
                </div>

                <div className="alert alert-success mb-4">
                  <small>We sent a login email to <strong>{email}</strong></small>
                </div>

                <div className="card mb-4">
                  <div className="card-body">
                    <h6 className="card-title d-flex align-items-center">
                      <Info className="me-2 text-primary" size={18} />
                      Two Ways to Log In
                    </h6>
                    <ol className="mb-0 small">
                      <li className="mb-2">
                        <strong>Click the link in your email</strong> - It might show an error about port 3000, but 
                        just change the URL to use port 5000 instead and refresh the page.
                      </li>
                      <li>
                        <strong>Or use the 6-digit code below</strong> - Find the code in your email and enter it here.
                      </li>
                    </ol>
                  </div>
                </div>

                <div className="mb-4">
                  <label htmlFor="otp" className="form-label">
                    6-Digit Code (Optional)
                  </label>
                  <div className="input-group">
                    <span className="input-group-text">
                      <Lock size={18} />
                    </span>
                    <input
                      type="text"
                      className="form-control form-control-lg text-center"
                      id="otp"
                      placeholder="000000"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      autoFocus
                      maxLength={6}
                      pattern="[0-9]{6}"
                      style={{ letterSpacing: '0.5em', fontFamily: 'monospace' }}
                      data-testid="input-otp"
                    />
                  </div>
                  <small className="text-muted">
                    Enter the code if you prefer not to click the link
                  </small>
                </div>

                <button
                  type="submit"
                  className="btn btn-primary w-100"
                  disabled={isLoading || otp.length !== 6}
                  data-testid="button-verify"
                >
                  {isLoading ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" />
                      Verifying...
                    </>
                  ) : (
                    "Verify Code & Login"
                  )}
                </button>

                <button
                  type="button"
                  className="btn btn-link w-100 mt-3 text-decoration-none"
                  onClick={handleEmailSubmit}
                  disabled={isLoading}
                  data-testid="button-resend"
                >
                  Resend Login Email
                </button>
              </form>
            )}
          </div>
        </div>

        {/* Right side - Hero */}
        <div className="col-12 col-md-6 bg-primary bg-opacity-10 d-none d-md-flex align-items-center justify-content-center p-5">
          <div className="text-center">
            <div className="mb-4">
              <Ticket className="text-primary" size={80} />
            </div>
            <h3 className="h2 fw-bold mb-3">Event Management Made Simple</h3>
            <p className="lead text-muted mb-4">
              Create events, generate tickets with QR codes, and validate them seamlessly.
            </p>
            <div className="row g-4 text-start">
              <div className="col-12">
                <div className="d-flex align-items-start">
                  <div className="bg-primary bg-opacity-25 rounded-circle p-2 me-3">
                    <div className="text-primary" style={{ width: "24px", height: "24px" }}>✓</div>
                  </div>
                  <div>
                    <h6 className="fw-semibold mb-1">Create Events</h6>
                    <p className="text-muted small mb-0">Set up your events with custom pricing and capacity</p>
                  </div>
                </div>
              </div>
              <div className="col-12">
                <div className="d-flex align-items-start">
                  <div className="bg-primary bg-opacity-25 rounded-circle p-2 me-3">
                    <div className="text-primary" style={{ width: "24px", height: "24px" }}>✓</div>
                  </div>
                  <div>
                    <h6 className="fw-semibold mb-1">Generate Tickets</h6>
                    <p className="text-muted small mb-0">Create secure tickets with unique QR codes</p>
                  </div>
                </div>
              </div>
              <div className="col-12">
                <div className="d-flex align-items-start">
                  <div className="bg-primary bg-opacity-25 rounded-circle p-2 me-3">
                    <div className="text-primary" style={{ width: "24px", height: "24px" }}>✓</div>
                  </div>
                  <div>
                    <h6 className="fw-semibold mb-1">Validate Instantly</h6>
                    <p className="text-muted small mb-0">Scan QR codes to verify ticket authenticity</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}