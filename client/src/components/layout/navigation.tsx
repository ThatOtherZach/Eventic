import { Link, useLocation } from "wouter";
import { Calendar, Check, Ticket, User, LogOut, LogIn, Bell, Settings } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import type { Notification } from "@shared/schema";

export function Navigation() {
  const [location] = useLocation();
  const { user, signOut } = useAuth();

  const navItems = [
    { path: "/events", label: "Events", icon: Calendar, ariaLabel: "View all events" },
    { path: "/scanner", label: "Validate", icon: Check, ariaLabel: "Validate tickets" },
  ];

  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <nav className="navbar navbar-expand-lg navbar-light bg-white shadow-sm" role="navigation" aria-label="Main navigation">
      <div className="container-fluid px-3 px-md-4">
        <Link href="/events" className="navbar-brand d-flex align-items-center">
          <Ticket className="text-primary me-2" size={28} />
          <span className="fw-bold">Eventic</span>
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
                    aria-label={item.ariaLabel || item.label}
                    aria-current={isActive ? "page" : undefined}
                  >
                    <Icon className="me-1" size={18} aria-hidden="true" />
                    <span>{item.label}</span>
                  </Link>
                </li>
              );
            })}
            
            {user ? (
              <>
                <NotificationBell user={user} location={location} />
                {user.email?.endsWith("@saymservices.com") && (
                  <li className="nav-item">
                    <Link
                      href="/admin"
                      className={`nav-link d-flex align-items-center ${
                        location === "/admin" ? "active" : ""
                      }`}
                      data-testid="link-nav-admin"
                      aria-label="Admin settings"
                      aria-current={location === "/admin" ? "page" : undefined}
                    >
                      <Settings className="me-1" size={18} aria-hidden="true" />
                      <span>Admin</span>
                    </Link>
                  </li>
                )}
                <li className="nav-item">
                  <Link
                    href="/account"
                    className={`nav-link d-flex align-items-center ${
                      location === "/account" ? "active" : ""
                    }`}
                    data-testid="link-nav-account"
                    aria-label="Account settings"
                    aria-current={location === "/account" ? "page" : undefined}
                  >
                    <User className="me-1" size={18} aria-hidden="true" />
                    <span>Account</span>
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
            ) : (
              <li className="nav-item">
                <Link
                  href="/auth"
                  className={`nav-link d-flex align-items-center ${
                    location === "/auth" ? "active" : ""
                  }`}
                  data-testid="link-nav-signin"
                >
                  <LogIn className="me-1" size={18} />
                  Sign In
                </Link>
              </li>
            )}
          </ul>
        </div>
      </div>
    </nav>
  );
}

function NotificationBell({ user, location }: { user: any; location: string }) {
  const { data: notifications = [] } = useQuery<Notification[]>({
    queryKey: [`/api/notifications`],
    enabled: !!user,
    refetchInterval: 30000, // Check for new notifications every 30 seconds
  });

  const unreadCount = notifications.filter(n => !n.isRead).length;

  return (
    <li className="nav-item position-relative">
      <Link
        href="/notifications"
        className={`nav-link d-flex align-items-center ${
          location === "/notifications" ? "active" : ""
        }`}
        data-testid="link-nav-notifications"
      >
        <Bell className="me-1" size={18} />
        Notifications
        {unreadCount > 0 && (
          <span 
            className="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger"
            style={{ fontSize: '10px', minWidth: '18px' }}
            data-testid="badge-notification-count"
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </Link>
    </li>
  );
}