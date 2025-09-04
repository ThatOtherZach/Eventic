import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { apiRequest } from "@/lib/queryClient";

export function StatsCards() {
  const { data: stats, isLoading } = useQuery<{
    totalEvents: number;
    totalTickets: number;
    validatedTickets: number;
  }>({
    queryKey: ["/api/stats"],
  });

  const { data: demandData } = useQuery<{
    demand: number;
    demandMultiplier: number;
    currentUnitPrice: number;
    baseUnitPrice: number;
  }>({
    queryKey: ["/api/currency/demand"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/currency/demand");
      return response.json();
    },
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
            <div 
              className="position-relative overflow-hidden"
              style={{
                background: 'linear-gradient(135deg, #c0c0c0 0%, #808080 100%)',
                border: '2px outset #c0c0c0',
                borderRadius: '0px',
                boxShadow: '2px 2px 4px rgba(0,0,0,0.3)'
              }}
            >
              {/* Windows 98 style title bar */}
              <div 
                style={{ 
                  background: `linear-gradient(90deg, ${barColors[index]} 0%, ${barColors[index]}dd 100%)`,
                  color: 'white',
                  padding: '4px 8px',
                  fontSize: '11px',
                  fontWeight: 'bold',
                  fontFamily: 'MS Sans Serif, sans-serif',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}
              >
                <span>{card.title}</span>
                <div style={{ 
                  width: '16px', 
                  height: '14px', 
                  background: '#c0c0c0', 
                  border: '1px outset #c0c0c0',
                  fontSize: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'black'
                }}>
                  ×
                </div>
              </div>
              
              {/* Content area */}
              <div 
                className="p-3"
                style={{
                  background: '#f0f0f0',
                  border: '1px inset #c0c0c0',
                  minHeight: '80px'
                }}
              >
                <div className="d-flex align-items-center">
                  <div className="me-3">
                    <img 
                      src={card.iconSrc} 
                      alt="" 
                      style={{ 
                        width: '32px', 
                        height: '32px',
                        filter: 'drop-shadow(1px 1px 1px rgba(0,0,0,0.5))'
                      }} 
                    />
                  </div>
                  <div className="flex-grow-1">
                    <p 
                      className="h4 fw-bold mb-0"
                      style={{ 
                        color: '#000080',
                        fontFamily: 'MS Sans Serif, sans-serif'
                      }}
                      data-testid={`text-${card.title.toLowerCase().replace(' ', '-')}`}
                    >
                      {card.value.toLocaleString()}
                    </p>
                    {card.title === "Tickets (48h)" && demandData && (
                      <div className="mt-2">
                        <Link
                          to="/sys/nerd"
                          className="text-decoration-none"
                          style={{ 
                            fontSize: "0.7rem",
                            color: '#000080',
                            fontFamily: 'MS Sans Serif, sans-serif'
                          }}
                          data-testid="link-stats-nerds-tickets"
                        >
                          Stats for nerds: ${demandData.currentUnitPrice.toFixed(3)}/credit
                          {demandData.demandMultiplier !== 1 && (
                            <>
                              {demandData.demandMultiplier < 1
                                ? ` (-${Math.round((1 - demandData.demandMultiplier) * 100)}%)`
                                : ` (+${Math.round((demandData.demandMultiplier - 1) * 100)}%)`}
                            </>
                          )}
                        </Link>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}