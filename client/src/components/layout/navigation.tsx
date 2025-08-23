import { Link, useLocation } from "wouter";
import { Calendar, QrCode, Ticket } from "lucide-react";

export function Navigation() {
  const [location] = useLocation();

  const navItems = [
    { path: "/events", label: "Events", icon: Calendar },
    { path: "/scanner", label: "Scanner", icon: QrCode },
  ];

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
          </ul>
        </div>
      </div>
    </nav>
  );
}
