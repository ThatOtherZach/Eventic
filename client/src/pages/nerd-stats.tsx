import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Link } from "wouter";
import { BarChart3, TrendingUp, Users, Ticket, Calendar, Zap, ChevronLeft, Activity, Database, Clock, Server } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export default function NerdStats() {
  const [currentTime, setCurrentTime] = useState(new Date());

  // Update time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch various stats
  const { data: stats } = useQuery({
    queryKey: ["/api/stats"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/stats");
      return response.json();
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const { data: demandData } = useQuery({
    queryKey: ["/api/currency/demand"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/currency/demand");
      return response.json();
    },
    refetchInterval: 30000,
  });

  const { data: events } = useQuery({
    queryKey: ["/api/events"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/events");
      return response.json();
    },
    refetchInterval: 60000,
  });

  // Calculate advanced stats
  const calculateStats = () => {
    if (!events || !stats) return null;

    const now = new Date();
    const activeEvents = events.filter((e: any) => new Date(e.eventDate) > now);
    const pastEvents = events.filter((e: any) => new Date(e.eventDate) <= now);
    
    // Calculate average tickets per event
    const avgTicketsPerEvent = events.length > 0 
      ? Math.round(stats.totalTickets / events.length * 100) / 100 
      : 0;

    // Calculate validation rate
    const validationRate = stats.totalTickets > 0 
      ? Math.round((stats.validatedTickets / stats.totalTickets) * 10000) / 100 
      : 0;

    // Events by day of week
    const dayStats = events.reduce((acc: any, event: any) => {
      const day = new Date(event.eventDate).getDay();
      const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][day];
      acc[dayName] = (acc[dayName] || 0) + 1;
      return acc;
    }, {});

    // Price statistics
    const ticketPrices = events.map((e: any) => e.ticketPrice).filter((p: any) => p > 0);
    const avgPrice = ticketPrices.length > 0 
      ? Math.round(ticketPrices.reduce((a: number, b: number) => a + b, 0) / ticketPrices.length * 100) / 100
      : 0;
    const maxPrice = Math.max(...ticketPrices, 0);
    const minPrice = ticketPrices.length > 0 ? Math.min(...ticketPrices) : 0;

    return {
      activeEvents: activeEvents.length,
      pastEvents: pastEvents.length,
      avgTicketsPerEvent,
      validationRate,
      dayStats,
      avgPrice,
      maxPrice,
      minPrice,
      totalRevenue: Math.round(stats.totalTickets * 0.29 * 100) / 100,
    };
  };

  const advancedStats = calculateStats();

  // Format large numbers
  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(2)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  // Calculate system uptime (mock)
  const uptime = Math.floor((Date.now() - new Date('2024-01-01').getTime()) / 1000);
  const uptimeDays = Math.floor(uptime / 86400);
  const uptimeHours = Math.floor((uptime % 86400) / 3600);

  return (
    <div className="container py-5">
      {/* Header */}
      <div className="row mb-4">
        <div className="col">
          <div className="d-flex align-items-center gap-3 mb-4">
            <Link to="/account" className="btn btn-sm btn-outline-secondary" data-testid="link-back-account">
              <ChevronLeft size={16} className="me-1" />
              Back
            </Link>
            <h1 className="h3 fw-bold mb-0 flex-grow-1">
              <BarChart3 className="me-2" size={28} style={{ verticalAlign: 'text-bottom' }} />
              Stats for Nerds
            </h1>
          </div>
        </div>
      </div>

      {/* System Status */}
      <div className="row mb-4">
        <div className="col-12">
          <Card>
            <CardHeader>
              <CardTitle className="d-flex align-items-center gap-2">
                <Server size={20} />
                System Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="row g-3">
                <div className="col-md-3">
                  <div className="text-muted small">Server Time</div>
                  <div className="fw-semibold font-monospace">
                    {currentTime.toISOString()}
                  </div>
                </div>
                <div className="col-md-3">
                  <div className="text-muted small">Unix Timestamp</div>
                  <div className="fw-semibold font-monospace">
                    {Math.floor(currentTime.getTime() / 1000)}
                  </div>
                </div>
                <div className="col-md-3">
                  <div className="text-muted small">Uptime</div>
                  <div className="fw-semibold font-monospace">
                    {uptimeDays}d {uptimeHours}h
                  </div>
                </div>
                <div className="col-md-3">
                  <div className="text-muted small">API Version</div>
                  <div className="fw-semibold font-monospace">v2.0.0</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Core Metrics */}
      <div className="row mb-4">
        <div className="col-12">
          <h5 className="fw-semibold mb-3">Core Metrics</h5>
          <div className="row g-3">
            <div className="col-md-3">
              <Card>
                <CardContent className="pt-3">
                  <div className="d-flex justify-content-between align-items-start">
                    <div>
                      <div className="text-muted small">Total Events</div>
                      <div className="h4 fw-bold mb-0">{formatNumber(stats?.totalEvents || 0)}</div>
                      <div className="text-success small">
                        {advancedStats?.activeEvents || 0} active
                      </div>
                    </div>
                    <Calendar className="text-primary" size={24} />
                  </div>
                </CardContent>
              </Card>
            </div>
            <div className="col-md-3">
              <Card>
                <CardContent className="pt-3">
                  <div className="d-flex justify-content-between align-items-start">
                    <div>
                      <div className="text-muted small">Total Tickets</div>
                      <div className="h4 fw-bold mb-0">{formatNumber(stats?.totalTickets || 0)}</div>
                      <div className="text-info small">
                        {advancedStats?.avgTicketsPerEvent || 0} avg/event
                      </div>
                    </div>
                    <Ticket className="text-info" size={24} />
                  </div>
                </CardContent>
              </Card>
            </div>
            <div className="col-md-3">
              <Card>
                <CardContent className="pt-3">
                  <div className="d-flex justify-content-between align-items-start">
                    <div>
                      <div className="text-muted small">Validation Rate</div>
                      <div className="h4 fw-bold mb-0">{advancedStats?.validationRate || 0}%</div>
                      <div className="text-warning small">
                        {stats?.validatedTickets || 0} validated
                      </div>
                    </div>
                    <Activity className="text-warning" size={24} />
                  </div>
                </CardContent>
              </Card>
            </div>
            <div className="col-md-3">
              <Card>
                <CardContent className="pt-3">
                  <div className="d-flex justify-content-between align-items-start">
                    <div>
                      <div className="text-muted small">Current Demand</div>
                      <div className="h4 fw-bold mb-0">{demandData?.demand || 0}</div>
                      <div className="text-success small">
                        Tickets/hour
                      </div>
                    </div>
                    <Zap className="text-success" size={24} />
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>

      {/* Financial Metrics */}
      <div className="row mb-4">
        <div className="col-12">
          <h5 className="fw-semibold mb-3">Financial Metrics</h5>
          <Card>
            <CardContent>
              <div className="row g-3">
                <div className="col-md-3">
                  <div className="text-muted small">Total Revenue (Est.)</div>
                  <div className="h5 fw-bold">${advancedStats?.totalRevenue || 0}</div>
                  <div className="text-muted small font-monospace">@ $0.29/ticket</div>
                </div>
                <div className="col-md-3">
                  <div className="text-muted small">Avg Ticket Price</div>
                  <div className="h5 fw-bold">${advancedStats?.avgPrice || 0}</div>
                  <div className="text-muted small">Per event</div>
                </div>
                <div className="col-md-3">
                  <div className="text-muted small">Price Range</div>
                  <div className="h5 fw-bold">${advancedStats?.minPrice || 0} - ${advancedStats?.maxPrice || 0}</div>
                  <div className="text-muted small">Min - Max</div>
                </div>
                <div className="col-md-3">
                  <div className="text-muted small">NFTs Minted</div>
                  <div className="h5 fw-bold">{stats?.nftMinted || 0}</div>
                  <div className="text-muted small">Validated tickets</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Event Distribution */}
      {advancedStats?.dayStats && (
        <div className="row mb-4">
          <div className="col-12">
            <h5 className="fw-semibold mb-3">Event Distribution by Day</h5>
            <Card>
              <CardContent>
                <div className="row g-2">
                  {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(day => (
                    <div key={day} className="col">
                      <div className="text-center">
                        <div className="text-muted small">{day.slice(0, 3)}</div>
                        <div className="h4 fw-bold mb-0">
                          {advancedStats.dayStats[day] || 0}
                        </div>
                        <div 
                          className="bg-primary mt-2" 
                          style={{ 
                            height: '4px', 
                            width: '100%',
                            opacity: Math.min((advancedStats.dayStats[day] || 0) / Math.max(...Object.values(advancedStats.dayStats).map(v => Number(v)), 1), 1)
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Technical Details */}
      <div className="row mb-4">
        <div className="col-12">
          <h5 className="fw-semibold mb-3">Technical Details</h5>
          <Card>
            <CardContent>
              <div className="font-monospace small">
                <div className="row mb-2">
                  <div className="col-4 text-muted">Database</div>
                  <div className="col-8">PostgreSQL (Neon)</div>
                </div>
                <div className="row mb-2">
                  <div className="col-4 text-muted">ORM</div>
                  <div className="col-8">Drizzle ORM</div>
                </div>
                <div className="row mb-2">
                  <div className="col-4 text-muted">Backend</div>
                  <div className="col-8">Express.js + TypeScript</div>
                </div>
                <div className="row mb-2">
                  <div className="col-4 text-muted">Frontend</div>
                  <div className="col-8">React 18 + Vite</div>
                </div>
                <div className="row mb-2">
                  <div className="col-4 text-muted">Data Retention</div>
                  <div className="col-8">69 days post-event</div>
                </div>
                <div className="row mb-2">
                  <div className="col-4 text-muted">Cache TTL</div>
                  <div className="col-8">30s (stats), 60s (events)</div>
                </div>
                <div className="row mb-2">
                  <div className="col-4 text-muted">Rate Limits</div>
                  <div className="col-8">100 req/min (general), 10 req/min (auth)</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Footer */}
      <div className="row">
        <div className="col-12">
          <p className="text-muted text-center small">
            Last refresh: {new Date().toLocaleTimeString()} | Auto-refresh: 30s
          </p>
        </div>
      </div>
    </div>
  );
}