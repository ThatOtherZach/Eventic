import { Link, useLocation } from "wouter";
import { Calendar, QrCode, Ticket, User, LogOut } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

export function Navigation() {
  const [location] = useLocation();
  const { user, signOut } = useAuth();

  const navItems = [
    { path: "/events", label: "Events", icon: Calendar },
    { path: "/scanner", label: "Scanner", icon: QrCode },
  ];

  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <nav className="navbar navbar-expand-lg navbar-light bg-white shadow-sm">
      <div className="container-fluid px-3 px-md-4">
        <Link href="/events" className="navbar-brand d-flex align-items-center">
          <Ticket className="text-primary me-2" size={28} />
          <span className="fw-bold">EventTicket Pro</span>
        </Link>
        
        <button 
          className="navbar-toggler" 
          type="button" 
          data-bs-toggle="collapse" 
          data-bs-target="#navbarNav"
          aria-controls="navbarNav" 
          aria-expanded="false" 
          aria-label="Toggle navigation"
        >
          <span className="navbar-toggler-icon"></span>
        </button>
        
        <div className="collapse navbar-collapse" id="navbarNav">
          <ul className="navbar-nav ms-auto">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location === item.path || (location === "/" && item.path === "/events");
              
              return (
                <li key={item.path} className="nav-item">
                  <Link
                    href={item.path}
                    className={`nav-link d-flex align-items-center ${
                      isActive ? "active" : ""
                    }`}
                    data-testid={`link-nav-${item.label.toLowerCase()}`}
                  >
                    <Icon className="me-1" size={18} />
                    {item.label}
                  </Link>
                </li>
              );
            })}
            
            {user && (
              <>
                <li className="nav-item">
                  <Link
                    href="/account"
                    className={`nav-link d-flex align-items-center ${
                      location === "/account" ? "active" : ""
                    }`}
                    data-testid="link-nav-account"
                  >
                    <User className="me-1" size={18} />
                    Account
                  </Link>
                </li>
                <li className="nav-item">
                  <button
                    className="nav-link btn btn-link d-flex align-items-center"
                    onClick={handleSignOut}
                    data-testid="button-nav-signout"
                  >
                    <LogOut className="me-1" size={18} />
                    Sign Out
                  </button>
                </li>
              </>
            )}
          </ul>
        </div>
      </div>
    </nav>
  );
}