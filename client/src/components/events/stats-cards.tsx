import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
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
      bgColor: "bg-blue-100",
      iconColor: "text-primary",
    },
    {
      title: "Tickets Sold",
      value: stats?.totalTickets || 0,
      icon: Ticket,
      bgColor: "bg-green-100",
      iconColor: "text-success",
    },
    {
      title: "Validated",
      value: stats?.validatedTickets || 0,
      icon: CheckCircle,
      bgColor: "bg-purple-100",
      iconColor: "text-purple-600",
    },
  ];

  return (
    <div className="row mb-4">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div key={card.title} className="col-12 col-md-4 mb-3">
            <div className="card h-100 border-0 shadow-sm">
              <div className="card-body d-flex align-items-center">
                <div className={`p-3 rounded-circle ${card.bgColor} me-3 d-flex align-items-center justify-content-center`}>
                  <Icon className={`${card.iconColor}`} size={24} />
                </div>
                <div className="flex-grow-1">
                  <p className="text-muted small mb-1 fw-medium">{card.title}</p>
                  <p 
                    className="h4 fw-semibold text-dark mb-0"
                    data-testid={`text-${card.title.toLowerCase().replace(' ', '-')}`}
                  >
                    {card.value}
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
