import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Link } from "wouter";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from "recharts";
import { 
  BarChart3, 
  TrendingUp, 
  Users, 
  Ticket, 
  Calendar, 
  Zap, 
  ChevronLeft, 
  Activity, 
  Award,
  DollarSign,
  Gift,
  RefreshCw,
  Coins,
  Trophy,
  Hash
} from "lucide-react";
import starIcon from "@assets/world_star-0_1756849251180.png";
import specialEffectsIcon from "@assets/image_1756849316138.png";
import p2pIcon from "@assets/users_green-4_1756849357200.png";
import gpsIcon from "@assets/gps-1_1756849430189.png";
import calendarIcon from "@assets/calendar-0_1756849638733.png";
import ticketsIcon from "@assets/certificate_multiple-1_1756849669534.png";
import checkIcon from "@assets/check-0_1756849706987.png";
import demandIcon from "@assets/image_1756849793480.png";
import coreMetricsIcon from "@assets/image_1756850088693.png";
import distributionIcon from "@assets/image_1756850111300.png";
import statsIcon from "@assets/chart1-4_1756850194937.png";
import ticketingTrendsIcon from "@assets/image_1756851232451.png";
import tealBg from "@assets/win98-teal_1756850231196.png";
import hashtagIcon from "@assets/modem-4_1756868854727.png";

export default function NerdStats() {

  // Fetch various stats
  const { data: stats } = useQuery({
    queryKey: ["/api/stats"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/stats");
      return response.json();
    },
    // No auto-refresh, only refresh on page load
  });

  const { data: demandData } = useQuery({
    queryKey: ["/api/currency/demand"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/currency/demand");
      return response.json();
    },
    // No auto-refresh
  });

  const { data: analyticsData } = useQuery({
    queryKey: ["/api/analytics/dashboard"],
  });

  // Prepare chart data for ticket sales trend (2-day periods)
  const periodData = analyticsData?.charts?.ticketsByMonth ? 
    analyticsData.charts.ticketsByMonth.labels.map((label: string, index: number) => ({
      period: label,
      tickets: analyticsData.charts.ticketsByMonth.data[index]
    })) : [];

  const { data: events } = useQuery({
    queryKey: ["/api/events"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/events");
      return response.json();
    },
    // No auto-refresh
  });

  const { data: tickets } = useQuery({
    queryKey: ["/api/user/tickets"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/user/tickets");
      return response.json();
    },
    // No auto-refresh
  });

  // Calculate advanced stats
  const calculateStats = () => {
    if (!events || !stats) return null;

    const now = new Date();
    const activeEvents = events.filter((e: any) => new Date(e.date) > now);
    const pastEvents = events.filter((e: any) => new Date(e.date) <= now);
    
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
      const day = new Date(event.date).getDay();
      const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][day];
      acc[dayName] = (acc[dayName] || 0) + 1;
      return acc;
    }, {});

    // Price statistics
    const ticketPrices = events.map((e: any) => parseFloat(e.ticketPrice)).filter((p: any) => p > 0);
    const avgPrice = ticketPrices.length > 0 
      ? Math.round(ticketPrices.reduce((a: number, b: number) => a + b, 0) / ticketPrices.length * 100) / 100
      : 0;
    const maxPrice = ticketPrices.length > 0 ? Math.max(...ticketPrices) : 0;
    const minPrice = ticketPrices.length > 0 ? Math.min(...ticketPrices) : 0;

    // Badge statistics
    const featuredEvents = 0; // Featured events are tracked separately in featuredEvents table
    const specialEffectsEvents = events.filter((e: any) => e.specialEffectsEnabled).length;
    const locationSpecificEvents = events.filter((e: any) => e.geofence).length;
    const p2pEvents = events.filter((e: any) => e.p2pValidation).length;

    // Ticket economy stats
    const freeEvents = events.filter((e: any) => parseFloat(e.ticketPrice) === 0).length;
    const paidEvents = events.filter((e: any) => parseFloat(e.ticketPrice) > 0).length;
    const goldenTickets = tickets?.filter((t: any) => t.isGoldenTicket).length || 0;
    const resaleTickets = tickets?.filter((t: any) => t.resalePrice !== null).length || 0;

    return {
      activeEvents: activeEvents.length,
      pastEvents: pastEvents.length,
      avgTicketsPerEvent,
      validationRate,
      dayStats,
      avgPrice,
      maxPrice,
      minPrice,
      totalRevenue: Math.round(stats.totalTickets * 0.23 * 100) / 100,
      featuredEvents,
      specialEffectsEvents,
      locationSpecificEvents,
      p2pEvents,
      freeEvents,
      paidEvents,
      goldenTickets,
      resaleTickets,
    };
  };

  const advancedStats = calculateStats();

  // Format large numbers
  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(2)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };


  return (
    <div className="container py-4">
      {/* Header */}
      <div className="row mb-4">
        <div className="col">
          <div className="d-flex align-items-center gap-3 mb-3">
            <Link to="/account" className="btn btn-sm btn-outline-secondary" data-testid="link-back-account">
              <ChevronLeft size={16} className="me-1" />
              Back
            </Link>
            <h1 className="h3 fw-bold mb-0 flex-grow-1">
              <img src={statsIcon} alt="Stats" className="me-2" style={{ width: 28, height: 28, verticalAlign: 'text-bottom' }} />
              Stats for Nerds
            </h1>
          </div>
        </div>
      </div>

      {/* Core Metrics */}
      <div className="row mb-4">
        <div className="col-12">
          <h5 className="fw-semibold mb-3">
            <img src={coreMetricsIcon} alt="Numbers 'n' Stuff" className="me-2" style={{ width: 20, height: 20, verticalAlign: 'text-bottom' }} />
            Numbers 'n' Stuff
          </h5>
          <div className="row g-3">
            <div className="col-md-3">
              <div className="card shadow-sm h-100">
                <div className="card-body">
                  <div className="d-flex justify-content-between align-items-start">
                    <div>
                      <div className="text-muted small mb-1">Total Events</div>
                      <div className="h4 fw-bold mb-1">{formatNumber(stats?.totalEvents || 0)}</div>
                    </div>
                    <img src={calendarIcon} alt="Calendar" style={{ width: 32, height: 32 }} />
                  </div>
                </div>
              </div>
            </div>
            <div className="col-md-3">
              <div className="card shadow-sm h-100">
                <div className="card-body">
                  <div className="d-flex justify-content-between align-items-start">
                    <div>
                      <div className="text-muted small mb-1">Total Tickets</div>
                      <div className="h4 fw-bold mb-1">{formatNumber(stats?.totalTickets || 0)}</div>
                      <div className="text-info small">
                        <Activity size={14} className="me-1" />
                        {advancedStats?.avgTicketsPerEvent || 0} avg/event
                      </div>
                    </div>
                    <img src={ticketsIcon} alt="Tickets" style={{ width: 32, height: 32 }} />
                  </div>
                </div>
              </div>
            </div>
            <div className="col-md-3">
              <div className="card shadow-sm h-100">
                <div className="card-body">
                  <div className="d-flex justify-content-between align-items-start">
                    <div>
                      <div className="text-muted small mb-1">Ticket Demand</div>
                      <div className="h4 fw-bold mb-1">{demandData?.demand || 0}</div>
                      <div className="text-success small">
                        <Zap size={14} className="me-1" />
                        Tickets/hour
                      </div>
                    </div>
                    <img src={demandIcon} alt="Demand" style={{ width: 32, height: 32 }} />
                  </div>
                </div>
              </div>
            </div>
            <div className="col-md-3">
              <div className="card shadow-sm h-100">
                <div className="card-body">
                  <div className="d-flex justify-content-between align-items-start">
                    <div>
                      <div className="text-muted small mb-1">Validation Rate</div>
                      <div className="h4 fw-bold mb-1">{advancedStats?.validationRate || 0}%</div>
                    </div>
                    <img src={checkIcon} alt="Validation" style={{ width: 32, height: 32 }} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Badge & Event Type Statistics */}
      <div className="row mb-4">
        <div className="col-12">
          <div className="row g-3 mb-3">
            <div className="col-md-3">
              <div className="card shadow-sm">
                <div className="card-body text-center">
                  <img src={starIcon} alt="Star" className="mb-2" style={{ width: 24, height: 24 }} />
                  <div className="h5 fw-bold mb-1">{advancedStats?.featuredEvents || 0}</div>
                  <div className="text-muted small">Boosted Events</div>
                </div>
              </div>
            </div>
            <div className="col-md-3">
              <div className="card shadow-sm">
                <div className="card-body text-center">
                  <img src={specialEffectsIcon} alt="Special Effects" className="mb-2" style={{ width: 24, height: 24 }} />
                  <div className="h5 fw-bold mb-1">{advancedStats?.specialEffectsEvents || 0}</div>
                  <div className="text-muted small">Special Effects</div>
                </div>
              </div>
            </div>
            <div className="col-md-3">
              <div className="card shadow-sm">
                <div className="card-body text-center">
                  <img src={p2pIcon} alt="P2P Validation" className="mb-2" style={{ width: 24, height: 24 }} />
                  <div className="h5 fw-bold mb-1">{advancedStats?.p2pEvents || 0}</div>
                  <div className="text-muted small">P2P Validation</div>
                </div>
              </div>
            </div>
            <div className="col-md-3">
              <div className="card shadow-sm">
                <div className="card-body text-center">
                  <img src={gpsIcon} alt="Location Specific" className="mb-2" style={{ width: 24, height: 24 }} />
                  <div className="h5 fw-bold mb-1">{advancedStats?.locationSpecificEvents || 0}</div>
                  <div className="text-muted small">Location Specific</div>
                </div>
              </div>
            </div>
          </div>
          <div className="row g-3 mt-2">
            <div className="col-md-4">
              <div className="card shadow-sm bg-primary text-dark border-0">
                <div className="card-body text-center">
                  <div className="h4 fw-bold mb-1">{advancedStats?.freeEvents || 0}</div>
                  <div className="small">Free Events</div>
                </div>
              </div>
            </div>
            <div className="col-md-4">
              <div className="card shadow-sm bg-warning text-dark border-0">
                <div className="card-body text-center">
                  <div className="h4 fw-bold mb-1">{advancedStats?.goldenTickets || 0}</div>
                  <div className="small">Golden Tickets</div>
                </div>
              </div>
            </div>
            <div className="col-md-4">
              <div className="card shadow-sm bg-success text-dark border-0">
                <div className="card-body text-center">
                  <div className="h4 fw-bold mb-1">${(advancedStats?.avgPrice || 0).toFixed(2)}</div>
                  <div className="small">Average Price</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Event Distribution */}
      {analyticsData?.charts?.eventDistribution && analyticsData.charts.eventDistribution.length > 0 && (
        <div className="row mb-4">
          <div className="col-12">
            <h5 className="fw-semibold mb-3">
              <img src={distributionIcon} alt="Event Distribution" className="me-2" style={{ width: 20, height: 20, verticalAlign: 'text-bottom' }} />
              Event Distribution - Upcoming Events
            </h5>
            <div className="card shadow-sm">
              <div className="card-body">
                <div className="row g-2">
                  {analyticsData.charts.eventDistribution.map((item: { date: string; count: number }) => {
                    const maxCount = Math.max(...analyticsData.charts.eventDistribution.map((d: any) => d.count), 1);
                    const percentage = (item.count / maxCount) * 100;
                    
                    return (
                      <div key={item.date} className="col">
                        <div className="text-center">
                          <div className="text-muted small mb-1">{item.date}</div>
                          <div className="h5 fw-bold mb-2">{item.count}</div>
                          <div className="progress" style={{ height: '6px' }}>
                            <div 
                              className="progress-bar bg-primary" 
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Ticket Sales Trend and Top Hashtags */}
      {periodData.length > 0 && (
        <div className="row mb-4">
          <div className="col-md-8">
            <h5 className="fw-semibold mb-3">
              <img src={ticketingTrendsIcon} alt="Ticketing Trends" className="me-2" style={{ width: 20, height: 20, verticalAlign: 'text-bottom' }} />
              Ticketing Trends
            </h5>
            <div className="card shadow-sm">
              <div className="card-body">
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={periodData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="period" 
                      tick={{ fontSize: 12 }}
                      interval="preserveStartEnd"
                    />
                    <YAxis />
                    <Tooltip 
                      labelFormatter={(value) => `Period ending: ${value}`}
                      formatter={(value) => [`${value} tickets`, '2-Day Total']}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="tickets" 
                      stroke="#0d6efd" 
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4, fill: '#0d6efd' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
          <div className="col-md-4">
            <h5 className="fw-semibold mb-3">
              <img src={hashtagIcon} alt="Hashtags" className="me-2" style={{ width: 20, height: 20, verticalAlign: 'text-bottom' }} />
              Top 10 Hashtags
            </h5>
            <div className="card shadow-sm">
              <div className="card-body">
                {analyticsData?.charts?.topHashtags && analyticsData.charts.topHashtags.length > 0 ? (
                  <div className="list-group list-group-flush">
                    {analyticsData.charts.topHashtags.map((item: { hashtag: string; count: number }, index: number) => {
                      const rankEmoji = index === 0 ? '🔥' : (index + 1).toString();
                      const formattedHashtag = item.hashtag.charAt(0).toUpperCase() + item.hashtag.slice(1).toLowerCase();
                      return (
                        <div key={item.hashtag} className="d-flex justify-content-between align-items-center py-2 border-bottom">
                          <div className="d-flex align-items-center">
                            <span className="me-2" style={{ minWidth: '25px', fontSize: '16px' }}>{rankEmoji}</span>
                            <Link href={`/hashtag/${encodeURIComponent(item.hashtag)}`} className="text-decoration-none text-primary">
                              #{formattedHashtag}
                            </Link>
                          </div>
                          <span className="badge bg-light text-dark">{item.count} Events</span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-muted text-center mb-0">No hashtags found</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="text-center mt-5 pt-4 border-top">
        <p className="text-muted small">Designed by Saym Services Inc.</p>
      </div>

    </div>
  );
}