import { useEffect } from "react";

export default function AuthPage() {
  useEffect(() => {
    // Redirect to Replit Auth login
    window.location.href = "/api/login";
  }, []);

  return (
    <div className="container mt-5">
      <div className="d-flex justify-content-center align-items-center" style={{ minHeight: "50vh" }}>
        <div className="text-center">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Redirecting to login...</span>
          </div>
          <p className="mt-3 text-muted">Redirecting to sign in...</p>
        </div>
      </div>
    </div>
  );
}