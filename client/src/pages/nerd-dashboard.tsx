import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
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
      <div className="container mx-auto p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-32 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="container mx-auto p-6">
        <Card className="border-red-200">
          <CardContent className="pt-6">
            <p className="text-red-600">Failed to load analytics data</p>
          </CardContent>
        </Card>
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
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Analytics Dashboard</h1>
            <p className="text-gray-600 mt-1">Real-time insights into your event ecosystem</p>
          </div>
          <Badge variant="outline" className="flex items-center gap-2">
            <Activity className="h-3 w-3 text-green-500" />
            Live Data
          </Badge>
        </div>

        {/* Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Events</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data.overview.totalEvents.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {data.overview.upcomingEvents} upcoming
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Tickets</CardTitle>
              <Ticket className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data.overview.totalTickets.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {data.overview.validatedTickets} validated
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Users</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data.overview.totalUsers.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground mt-1">
                +{data.userMetrics.newUsersLast30Days} last 30 days
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Validation Rate</CardTitle>
              <Percent className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data.ticketMetrics.validationRate}%</div>
              <Progress value={data.ticketMetrics.validationRate} className="mt-2" />
            </CardContent>
          </Card>
        </div>

        {/* Tabs for Different Sections */}
        <Tabs defaultValue="tickets" className="space-y-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="tickets">Tickets</TabsTrigger>
            <TabsTrigger value="events">Events</TabsTrigger>
            <TabsTrigger value="geography">Geography</TabsTrigger>
            <TabsTrigger value="metrics">Metrics</TabsTrigger>
          </TabsList>

          {/* Tickets Tab */}
          <TabsContent value="tickets" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>Ticket Sales Trend</CardTitle>
                  <CardDescription>Monthly ticket sales over the last 6 months</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={monthlyData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <Tooltip />
                      <Line 
                        type="monotone" 
                        dataKey="tickets" 
                        stroke="#8884d8" 
                        strokeWidth={2}
                        dot={{ fill: '#8884d8' }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Ticket Metrics</CardTitle>
                  <CardDescription>Key ticket statistics</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-gray-500" />
                      <span className="text-sm text-gray-600">Average Price</span>
                    </div>
                    <span className="font-semibold">${data.ticketMetrics.avgTicketPrice.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <RefreshCw className="h-4 w-4 text-gray-500" />
                      <span className="text-sm text-gray-600">Resale Queue</span>
                    </div>
                    <span className="font-semibold">{data.ticketMetrics.resaleTickets}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Star className="h-4 w-4 text-yellow-500" />
                      <span className="text-sm text-gray-600">Golden Tickets</span>
                    </div>
                    <span className="font-semibold">{data.ticketMetrics.goldenTickets}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-gray-500" />
                      <span className="text-sm text-gray-600">Avg Tickets/User</span>
                    </div>
                    <span className="font-semibold">{data.userMetrics.avgTicketsPerUser}</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Events Tab */}
          <TabsContent value="events" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>Event Status Distribution</CardTitle>
                  <CardDescription>Breakdown of events by status</CardDescription>
                </CardHeader>
                <CardContent>
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
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Event Features</CardTitle>
                  <CardDescription>Special event configurations</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-blue-500" />
                      <span className="text-sm text-gray-600">Featured Events</span>
                    </div>
                    <Badge>{data.eventMetrics.featuredEvents}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <RefreshCw className="h-4 w-4 text-green-500" />
                      <span className="text-sm text-gray-600">Recurring Events</span>
                    </div>
                    <Badge>{data.eventMetrics.recurringEvents}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Lock className="h-4 w-4 text-gray-500" />
                      <span className="text-sm text-gray-600">Private Events</span>
                    </div>
                    <Badge>{data.eventMetrics.privateEvents}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <UserCheck className="h-4 w-4 text-purple-500" />
                      <span className="text-sm text-gray-600">P2P Validation</span>
                    </div>
                    <Badge>{data.eventMetrics.p2pValidationEvents}</Badge>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Event Types */}
            {data.charts.topEventTypes.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Popular Event Types</CardTitle>
                  <CardDescription>Most common event hashtags</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={data.charts.topEventTypes}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="type" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="count" fill="#82ca9d" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Geography Tab */}
          <TabsContent value="geography" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Events by Country</CardTitle>
                <CardDescription>Top 10 countries hosting events</CardDescription>
              </CardHeader>
              <CardContent>
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
                      <Bar dataKey="count" fill="#8884d8">
                        {data.charts.topCountries.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-gray-500 text-center py-8">No country data available</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Metrics Tab */}
          <TabsContent value="metrics" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Today's Events</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-blue-600">
                    {data.overview.todayEvents}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Happening today</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Next 24 Hours</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-green-600">
                    {data.overview.activeEventsNext24h}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Active events</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">User Growth</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-purple-600">
                    +{data.userMetrics.newUsersLast30Days}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Last 30 days</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Validation Success</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-orange-600">
                    {data.ticketMetrics.validationRate}%
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Of all tickets</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Revenue Potential</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-indigo-600">
                    ${(data.overview.totalTickets * data.ticketMetrics.avgTicketPrice).toLocaleString()}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Total ticket value</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Resale Activity</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-pink-600">
                    {data.ticketMetrics.resaleTickets}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Tickets in queue</p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        {/* Footer */}
        <div className="text-center text-sm text-gray-500 pt-6 border-t">
          <p>Data refreshes every minute • All metrics are real-time</p>
        </div>
      </div>
    </div>
  );
}