import { useQuery } from "@tanstack/react-query";
import { Calendar, Ticket, CheckCircle } from "lucide-react";

export function StatsCards() {
  const { data: stats, isLoading } = useQuery<{
    totalEvents: number;
    totalTickets: number;
    validatedTickets: number;
  }>({
    queryKey: ["/api/stats"],
  });

  if (isLoading) {
    return (
      <div className="row mb-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="col-12 col-md-4 mb-3">
            <div className="card placeholder-glow">
              <div className="card-body d-flex align-items-center">
                <div className="placeholder rounded-circle me-3" style={{width: '48px', height: '48px'}}></div>
                <div className="flex-grow-1">
                  <div className="placeholder col-6 mb-2"></div>
                  <div className="placeholder col-4"></div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  const cards = [
    {
      title: "Total Events",
      value: stats?.totalEvents || 0,
      icon: Calendar,
      bgColor: "primary",
      bgOpacity: "10",
    },
    {
      title: "Tickets Sold",
      value: stats?.totalTickets || 0,
      icon: Ticket,
      bgColor: "success",
      bgOpacity: "10",
    },
    {
      title: "Validated",
      value: stats?.validatedTickets || 0,
      icon: CheckCircle,
      bgColor: "info",
      bgOpacity: "10",
    },
  ];

  return (
    <div className="row mb-4">
      {cards.map((card, index) => {
        const Icon = card.icon;
        // Color bars for visual appeal
        const barColors = ['#dc3545', '#ffc107', '#0d6efd']; // Red, Gold, Blue
        return (
          <div key={card.title} className="col-12 col-md-4 mb-3">
            <div className="card h-100 border-0 shadow-sm position-relative overflow-hidden">
              {/* Color bar at the top */}
              <div 
                style={{ 
                  height: '4px', 
                  backgroundColor: barColors[index],
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0
                }} 
              />
              <div className="card-body d-flex align-items-center">
                <div className={`bg-${card.bgColor} bg-opacity-${card.bgOpacity} rounded-circle p-3 me-3 d-flex align-items-center justify-content-center`}>
                  <Icon className={`text-${card.bgColor}`} size={24} />
                </div>
                <div className="flex-grow-1">
                  <p className="text-muted small mb-1 fw-medium">{card.title}</p>
                  <p 
                    className="h4 fw-semibold text-dark mb-0"
                    data-testid={`text-${card.title.toLowerCase().replace(' ', '-')}`}
                  >
                    {card.value.toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}