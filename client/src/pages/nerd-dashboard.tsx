import { useQuery } from "@tanstack/react-query";
import { 
  BarChart3, 
  TrendingUp, 
  Users, 
  Ticket, 
  Calendar,
  Globe,
  Hash,
  Activity,
  Star,
  RefreshCw,
  Lock,
  UserCheck,
  DollarSign,
  Percent
} from "lucide-react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from "recharts";

interface DashboardData {
  overview: {
    totalEvents: number;
    totalTickets: number;
    validatedTickets: number;
    totalUsers: number;
    upcomingEvents: number;
    pastEvents: number;
    activeEventsNext24h: number;
    todayEvents: number;
  };
  ticketMetrics: {
    validationRate: number;
    avgTicketPrice: number;
    resaleTickets: number;
    goldenTickets: number;
  };
  eventMetrics: {
    featuredEvents: number;
    recurringEvents: number;
    privateEvents: number;
    p2pValidationEvents: number;
  };
  userMetrics: {
    newUsersLast30Days: number;
    avgTicketsPerUser: number;
  };
  charts: {
    ticketsByMonth: {
      labels: string[];
      data: number[];
    };
    topCountries: Array<{ country: string; count: number }>;
    topEventTypes: Array<{ type: string; count: number }>;
  };
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D', '#FFC658', '#FF6B6B', '#4ECDC4', '#45B7D1'];

export default function NerdDashboard() {
  const { data, isLoading, error } = useQuery<DashboardData>({
    queryKey: ["/api/analytics/dashboard"],
    refetchInterval: 60000 // Refresh every minute
  });

  if (isLoading) {
    return (
      <div className="container-fluid">
        <div className="animate-pulse">
          <div className="bg-light rounded mb-3" style={{ height: '32px', width: '25%' }}></div>
          <div className="row">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="col-12 col-md-6 col-lg-3 mb-3">
                <div className="bg-light rounded" style={{ height: '120px' }}></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="container-fluid">
        <div className="alert alert-danger" role="alert">
          <i className="bi bi-exclamation-triangle-fill me-2"></i>
          Failed to load analytics data
        </div>
      </div>
    );
  }

  // Prepare chart data
  const monthlyData = data.charts.ticketsByMonth.labels.map((label, index) => ({
    month: label,
    tickets: data.charts.ticketsByMonth.data[index]
  }));

  const eventStatusData = [
    { name: 'Upcoming', value: data.overview.upcomingEvents, color: '#00C49F' },
    { name: 'Past', value: data.overview.pastEvents, color: '#8884D8' },
    { name: 'Today', value: data.overview.todayEvents, color: '#FFBB28' },
    { name: 'Next 24h', value: data.overview.activeEventsNext24h, color: '#FF8042' }
  ];

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h2 className="h3 fw-semibold text-dark mb-2">Analytics Dashboard</h2>
          <p className="text-muted mb-0">Real-time insights into your event ecosystem</p>
        </div>
        <span className="badge bg-success d-flex align-items-center gap-2">
          <Activity size={14} />
          Live Data
        </span>
      </div>

      {/* Overview Cards */}
      <div className="row mb-4">
        <div className="col-12 col-md-6 col-lg-3 mb-3">
          <div className="card h-100 border-0 shadow-sm">
            <div className="card-body">
              <div className="d-flex justify-content-between align-items-start mb-2">
                <span className="text-muted small fw-medium">Total Events</span>
                <Calendar className="text-muted" size={20} />
              </div>
              <div className="h4 fw-bold text-dark mb-1">{data.overview.totalEvents.toLocaleString()}</div>
              <p className="text-muted small mb-0">
                {data.overview.upcomingEvents} upcoming
              </p>
            </div>
          </div>
        </div>

        <div className="col-12 col-md-6 col-lg-3 mb-3">
          <div className="card h-100 border-0 shadow-sm">
            <div className="card-body">
              <div className="d-flex justify-content-between align-items-start mb-2">
                <span className="text-muted small fw-medium">Total Tickets</span>
                <Ticket className="text-muted" size={20} />
              </div>
              <div className="h4 fw-bold text-dark mb-1">{data.overview.totalTickets.toLocaleString()}</div>
              <p className="text-muted small mb-0">
                {data.overview.validatedTickets} validated
              </p>
            </div>
          </div>
        </div>

        <div className="col-12 col-md-6 col-lg-3 mb-3">
          <div className="card h-100 border-0 shadow-sm">
            <div className="card-body">
              <div className="d-flex justify-content-between align-items-start mb-2">
                <span className="text-muted small fw-medium">Total Users</span>
                <Users className="text-muted" size={20} />
              </div>
              <div className="h4 fw-bold text-dark mb-1">{data.overview.totalUsers.toLocaleString()}</div>
              <p className="text-muted small mb-0">
                +{data.userMetrics.newUsersLast30Days} last 30 days
              </p>
            </div>
          </div>
        </div>

        <div className="col-12 col-md-6 col-lg-3 mb-3">
          <div className="card h-100 border-0 shadow-sm">
            <div className="card-body">
              <div className="d-flex justify-content-between align-items-start mb-2">
                <span className="text-muted small fw-medium">Validation Rate</span>
                <Percent className="text-muted" size={20} />
              </div>
              <div className="h4 fw-bold text-dark mb-1">{data.ticketMetrics.validationRate}%</div>
              <div className="progress" style={{ height: '6px' }}>
                <div 
                  className="progress-bar bg-success" 
                  role="progressbar" 
                  style={{ width: `${data.ticketMetrics.validationRate}%` }}
                  aria-valuenow={data.ticketMetrics.validationRate}
                  aria-valuemin={0}
                  aria-valuemax={100}
                ></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <ul className="nav nav-tabs mb-4" role="tablist">
        <li className="nav-item" role="presentation">
          <button 
            className="nav-link active" 
            data-bs-toggle="tab" 
            data-bs-target="#tickets"
            type="button"
            role="tab"
          >
            Tickets
          </button>
        </li>
        <li className="nav-item" role="presentation">
          <button 
            className="nav-link" 
            data-bs-toggle="tab" 
            data-bs-target="#events"
            type="button"
            role="tab"
          >
            Events
          </button>
        </li>
        <li className="nav-item" role="presentation">
          <button 
            className="nav-link" 
            data-bs-toggle="tab" 
            data-bs-target="#geography"
            type="button"
            role="tab"
          >
            Geography
          </button>
        </li>
        <li className="nav-item" role="presentation">
          <button 
            className="nav-link" 
            data-bs-toggle="tab" 
            data-bs-target="#metrics"
            type="button"
            role="tab"
          >
            Metrics
          </button>
        </li>
      </ul>

      <div className="tab-content">
        {/* Tickets Tab */}
        <div className="tab-pane fade show active" id="tickets" role="tabpanel">
          <div className="row">
            <div className="col-12 col-lg-6 mb-4">
              <div className="card border-0 shadow-sm h-100">
                <div className="card-header bg-white border-bottom">
                  <h5 className="card-title mb-0">Ticket Sales Trend</h5>
                  <small className="text-muted">Monthly ticket sales over the last 6 months</small>
                </div>
                <div className="card-body">
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={monthlyData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <Tooltip />
                      <Line 
                        type="monotone" 
                        dataKey="tickets" 
                        stroke="#0d6efd" 
                        strokeWidth={2}
                        dot={{ fill: '#0d6efd' }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            <div className="col-12 col-lg-6 mb-4">
              <div className="card border-0 shadow-sm h-100">
                <div className="card-header bg-white border-bottom">
                  <h5 className="card-title mb-0">Ticket Metrics</h5>
                  <small className="text-muted">Key ticket statistics</small>
                </div>
                <div className="card-body">
                  <div className="list-group list-group-flush">
                    <div className="list-group-item d-flex justify-content-between align-items-center px-0">
                      <div className="d-flex align-items-center gap-2">
                        <DollarSign size={16} className="text-muted" />
                        <span className="text-muted">Average Price</span>
                      </div>
                      <span className="fw-semibold">${data.ticketMetrics.avgTicketPrice.toFixed(2)}</span>
                    </div>
                    <div className="list-group-item d-flex justify-content-between align-items-center px-0">
                      <div className="d-flex align-items-center gap-2">
                        <RefreshCw size={16} className="text-muted" />
                        <span className="text-muted">Resale Queue</span>
                      </div>
                      <span className="fw-semibold">{data.ticketMetrics.resaleTickets}</span>
                    </div>
                    <div className="list-group-item d-flex justify-content-between align-items-center px-0">
                      <div className="d-flex align-items-center gap-2">
                        <Star size={16} className="text-warning" />
                        <span className="text-muted">Golden Tickets</span>
                      </div>
                      <span className="fw-semibold">{data.ticketMetrics.goldenTickets}</span>
                    </div>
                    <div className="list-group-item d-flex justify-content-between align-items-center px-0 border-0">
                      <div className="d-flex align-items-center gap-2">
                        <Users size={16} className="text-muted" />
                        <span className="text-muted">Avg Tickets/User</span>
                      </div>
                      <span className="fw-semibold">{data.userMetrics.avgTicketsPerUser}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Events Tab */}
        <div className="tab-pane fade" id="events" role="tabpanel">
          <div className="row">
            <div className="col-12 col-lg-6 mb-4">
              <div className="card border-0 shadow-sm h-100">
                <div className="card-header bg-white border-bottom">
                  <h5 className="card-title mb-0">Event Status Distribution</h5>
                  <small className="text-muted">Breakdown of events by status</small>
                </div>
                <div className="card-body">
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={eventStatusData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, value }) => `${name}: ${value}`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {eventStatusData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            <div className="col-12 col-lg-6 mb-4">
              <div className="card border-0 shadow-sm h-100">
                <div className="card-header bg-white border-bottom">
                  <h5 className="card-title mb-0">Event Features</h5>
                  <small className="text-muted">Special event configurations</small>
                </div>
                <div className="card-body">
                  <div className="list-group list-group-flush">
                    <div className="list-group-item d-flex justify-content-between align-items-center px-0">
                      <div className="d-flex align-items-center gap-2">
                        <TrendingUp size={16} className="text-primary" />
                        <span className="text-muted">Featured Events</span>
                      </div>
                      <span className="badge bg-primary">{data.eventMetrics.featuredEvents}</span>
                    </div>
                    <div className="list-group-item d-flex justify-content-between align-items-center px-0">
                      <div className="d-flex align-items-center gap-2">
                        <RefreshCw size={16} className="text-success" />
                        <span className="text-muted">Recurring Events</span>
                      </div>
                      <span className="badge bg-success">{data.eventMetrics.recurringEvents}</span>
                    </div>
                    <div className="list-group-item d-flex justify-content-between align-items-center px-0">
                      <div className="d-flex align-items-center gap-2">
                        <Lock size={16} className="text-secondary" />
                        <span className="text-muted">Private Events</span>
                      </div>
                      <span className="badge bg-secondary">{data.eventMetrics.privateEvents}</span>
                    </div>
                    <div className="list-group-item d-flex justify-content-between align-items-center px-0 border-0">
                      <div className="d-flex align-items-center gap-2">
                        <UserCheck size={16} className="text-info" />
                        <span className="text-muted">P2P Validation</span>
                      </div>
                      <span className="badge bg-info">{data.eventMetrics.p2pValidationEvents}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Event Types */}
          {data.charts.topEventTypes.length > 0 && (
            <div className="row">
              <div className="col-12">
                <div className="card border-0 shadow-sm">
                  <div className="card-header bg-white border-bottom">
                    <h5 className="card-title mb-0">Popular Event Types</h5>
                    <small className="text-muted">Most common event hashtags</small>
                  </div>
                  <div className="card-body">
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={data.charts.topEventTypes}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="type" />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="count" fill="#198754" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Geography Tab */}
        <div className="tab-pane fade" id="geography" role="tabpanel">
          <div className="card border-0 shadow-sm">
            <div className="card-header bg-white border-bottom">
              <h5 className="card-title mb-0">Events by Country</h5>
              <small className="text-muted">Top 10 countries hosting events</small>
            </div>
            <div className="card-body">
              {data.charts.topCountries.length > 0 ? (
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart 
                    data={data.charts.topCountries} 
                    layout="horizontal"
                    margin={{ left: 80 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis dataKey="country" type="category" />
                    <Tooltip />
                    <Bar dataKey="count" fill="#0d6efd">
                      {data.charts.topCountries.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-muted text-center py-5">No country data available</p>
              )}
            </div>
          </div>
        </div>

        {/* Metrics Tab */}
        <div className="tab-pane fade" id="metrics" role="tabpanel">
          <div className="row">
            <div className="col-12 col-md-6 col-lg-4 mb-3">
              <div className="card border-0 shadow-sm h-100">
                <div className="card-body">
                  <h6 className="card-subtitle mb-2 text-muted">Today's Events</h6>
                  <div className="h3 fw-bold text-primary">
                    {data.overview.todayEvents}
                  </div>
                  <p className="text-muted small mb-0">Happening today</p>
                </div>
              </div>
            </div>

            <div className="col-12 col-md-6 col-lg-4 mb-3">
              <div className="card border-0 shadow-sm h-100">
                <div className="card-body">
                  <h6 className="card-subtitle mb-2 text-muted">Next 24 Hours</h6>
                  <div className="h3 fw-bold text-success">
                    {data.overview.activeEventsNext24h}
                  </div>
                  <p className="text-muted small mb-0">Active events</p>
                </div>
              </div>
            </div>

            <div className="col-12 col-md-6 col-lg-4 mb-3">
              <div className="card border-0 shadow-sm h-100">
                <div className="card-body">
                  <h6 className="card-subtitle mb-2 text-muted">User Growth</h6>
                  <div className="h3 fw-bold text-info">
                    +{data.userMetrics.newUsersLast30Days}
                  </div>
                  <p className="text-muted small mb-0">Last 30 days</p>
                </div>
              </div>
            </div>

            <div className="col-12 col-md-6 col-lg-4 mb-3">
              <div className="card border-0 shadow-sm h-100">
                <div className="card-body">
                  <h6 className="card-subtitle mb-2 text-muted">Validation Success</h6>
                  <div className="h3 fw-bold text-warning">
                    {data.ticketMetrics.validationRate}%
                  </div>
                  <p className="text-muted small mb-0">Of all tickets</p>
                </div>
              </div>
            </div>

            <div className="col-12 col-md-6 col-lg-4 mb-3">
              <div className="card border-0 shadow-sm h-100">
                <div className="card-body">
                  <h6 className="card-subtitle mb-2 text-muted">Revenue Potential</h6>
                  <div className="h3 fw-bold text-danger">
                    ${(data.overview.totalTickets * data.ticketMetrics.avgTicketPrice).toLocaleString()}
                  </div>
                  <p className="text-muted small mb-0">Total ticket value</p>
                </div>
              </div>
            </div>

            <div className="col-12 col-md-6 col-lg-4 mb-3">
              <div className="card border-0 shadow-sm h-100">
                <div className="card-body">
                  <h6 className="card-subtitle mb-2 text-muted">Resale Activity</h6>
                  <div className="h3 fw-bold text-secondary">
                    {data.ticketMetrics.resaleTickets}
                  </div>
                  <p className="text-muted small mb-0">Tickets in queue</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="text-center text-muted small mt-5 pt-4 border-top">
        <p className="mb-0">Data refreshes every minute • All metrics are real-time</p>
      </div>
    </div>
  );
}