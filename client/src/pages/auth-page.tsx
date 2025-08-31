import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { Mail, CheckCircle, Ticket } from "lucide-react";

export default function AuthPage() {
  const { user, signUp } = useAuth();
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState("");
  const [emailSent, setEmailSent] = useState(false);
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
      setEmailSent(true);
    } catch (error) {
      // Error is handled in the hook
      setEmailSent(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    setIsLoading(true);
    try {
      await signUp(email);
      setEmailSent(true);
    } catch (error) {
      // Error is handled in the hook
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container-fluid min-vh-100">
      <div className="row min-vh-100">
        {/* Left side - Form */}
        <div className="col-12 col-md-6 d-flex align-items-center justify-content-center p-4">
          <div className="w-100" style={{ maxWidth: "400px" }}>
            <div className="text-center mb-5">
              <div className="bg-primary bg-opacity-10 rounded-circle p-3 d-inline-flex mb-3">
                <img src="/eventic-logo.png" alt="Eventic" style={{ width: '32px', height: '32px' }} />
              </div>
              <h2 className="h3 fw-bold">Welcome to Eventic</h2>
              <p className="text-muted">Enter your email to sign in</p>
            </div>

            {!emailSent ? (
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
                    "Send Login Link"
                  )}
                </button>
              </form>
            ) : (
              <div>
                <div className="text-center mb-4">
                  <div className="bg-success bg-opacity-10 rounded-circle p-3 d-inline-flex mb-3">
                    <CheckCircle className="text-success" size={32} />
                  </div>
                  <h5 className="fw-bold mb-3">Check Your Email</h5>
                  <p className="text-muted">
                    We've sent a login link to:
                    <br />
                    <strong className="text-dark">{email}</strong>
                  </p>
                </div>

                <div className="alert alert-info">
                  <small>
                    Click the link in your email to sign in. The link will
                    expire in 60 minutes.
                  </small>
                </div>

                <button
                  type="button"
                  className="btn btn-secondary w-100 mb-3"
                  onClick={handleResend}
                  disabled={isLoading}
                  data-testid="button-resend"
                >
                  {isLoading ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" />
                      Sending...
                    </>
                  ) : (
                    "Resend Login Link"
                  )}
                </button>

                <button
                  type="button"
                  className="btn btn-link w-100 text-decoration-none"
                  onClick={() => {
                    setEmailSent(false);
                    setEmail("");
                  }}
                  data-testid="button-change-email"
                >
                  Use a Different Email
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right side - Hero */}
        <div className="col-12 col-md-6 bg-primary bg-opacity-10 d-none d-md-flex align-items-center justify-content-center p-5">
          <div className="text-center">
            <div className="mb-4">
              <Ticket className="text-primary" size={80} />
            </div>
            <h3 className="h2 fw-bold mb-3">What is This?</h3>
            <p className="lead text-muted mb-4">
              Please read <a href="/manifesto" className="text-primary">The Manifesto</a> to understand the mission.
            </p>
            <div className="mt-5">
              <p className="text-muted">
                
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
