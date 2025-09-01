import { useQuery } from "@tanstack/react-query";

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
      iconSrc: "/calendar-icon.png",
      bgColor: "primary",
      bgOpacity: "10",
    },
    {
      title: "Tickets (48h)",
      value: stats?.totalTickets || 0,
      iconSrc: "/tickets-icon.png",
      bgColor: "success",
      bgOpacity: "10",
    },
    {
      title: "Active Attendees",
      value: stats?.validatedTickets || 0,
      iconSrc: "/users-icon.png",
      bgColor: "info",
      bgOpacity: "10",
    },
  ];

  return (
    <div className="row mb-4">
      {cards.map((card, index) => {
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
                  <img src={card.iconSrc} alt="" style={{ width: '24px', height: '24px' }} />
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