import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Activity, AlertCircle, Clock, Shield, TrendingUp, Users, RefreshCw } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';

interface AuthMetrics {
  totalLogins: number;
  failedLogins: number;
  rateLimitHits: number;
  uniqueUsers: number;
}

interface SystemMetrics {
  totalEvents: number;
  totalTickets: number;
  validatedTickets: number;
  activeUsers: number;
  queueLength: number;
}

export function AuthMonitoring() {
  const [timeRange, setTimeRange] = useState('24');
  const [autoRefresh, setAutoRefresh] = useState(true);
  
  // Fetch auth metrics
  const { data: authMetrics, isLoading: authLoading, error: authError } = useQuery<AuthMetrics>({
    queryKey: ['/api/monitoring/auth-metrics', timeRange],
    queryFn: async () => {
      const response = await fetch(`/api/monitoring/auth-metrics?hours=${timeRange}`);
      if (!response.ok) throw new Error('Failed to fetch auth metrics');
      return response.json();
    },
    refetchInterval: autoRefresh ? 30000 : false, // Refresh every 30 seconds if enabled
  });
  
  // Fetch system metrics
  const { data: systemMetrics, isLoading: systemLoading, error: systemError } = useQuery<SystemMetrics>({
    queryKey: ['/api/monitoring/system-metrics'],
    queryFn: async () => {
      const response = await fetch('/api/monitoring/system-metrics');
      if (!response.ok) throw new Error('Failed to fetch system metrics');
      return response.json();
    },
    refetchInterval: autoRefresh ? 30000 : false,
  });
  
  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['/api/monitoring'] });
  };
  
  const getHealthStatus = () => {
    if (!authMetrics) return 'unknown';
    
    const failureRate = authMetrics.totalLogins > 0 
      ? (authMetrics.failedLogins / authMetrics.totalLogins) * 100 
      : 0;
    
    if (authMetrics.rateLimitHits > 50) return 'critical';
    if (failureRate > 30) return 'warning';
    return 'healthy';
  };
  
  const healthStatus = getHealthStatus();
  
  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Authentication Monitoring</h1>
          <p className="text-muted-foreground">Monitor authentication health and system metrics</p>
        </div>
        
        <div className="flex items-center gap-4">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-32" data-testid="select-time-range">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">Last Hour</SelectItem>
              <SelectItem value="6">Last 6 Hours</SelectItem>
              <SelectItem value="24">Last 24 Hours</SelectItem>
              <SelectItem value="72">Last 3 Days</SelectItem>
              <SelectItem value="168">Last Week</SelectItem>
            </SelectContent>
          </Select>
          
          <Button
            variant={autoRefresh ? "default" : "outline"}
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
            data-testid="button-toggle-refresh"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${autoRefresh ? 'animate-spin' : ''}`} />
            {autoRefresh ? 'Auto' : 'Manual'}
          </Button>
          
          <Button onClick={handleRefresh} size="sm" variant="outline" data-testid="button-refresh">
            Refresh Now
          </Button>
        </div>
      </div>
      
      {/* Health Status Alert */}
      {healthStatus !== 'healthy' && (
        <Alert variant={healthStatus === 'critical' ? 'destructive' : 'default'}>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {healthStatus === 'critical' 
              ? 'Critical: High rate limiting activity detected. Possible attack or system issue.'
              : 'Warning: Elevated login failure rate detected. Monitor for potential issues.'}
          </AlertDescription>
        </Alert>
      )}
      
      {/* Authentication Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Logins</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-logins">
              {authLoading ? '...' : authMetrics?.totalLogins || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Successful authentications
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Failed Logins</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-failed-logins">
              {authLoading ? '...' : authMetrics?.failedLogins || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Authentication failures
            </p>
            {authMetrics && authMetrics.totalLogins > 0 && (
              <Badge variant={authMetrics.failedLogins / authMetrics.totalLogins > 0.3 ? 'destructive' : 'secondary'}>
                {((authMetrics.failedLogins / authMetrics.totalLogins) * 100).toFixed(1)}% failure rate
              </Badge>
            )}
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Rate Limit Hits</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-rate-limits">
              {authLoading ? '...' : authMetrics?.rateLimitHits || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Blocked by rate limiting
            </p>
            {authMetrics && authMetrics.rateLimitHits > 10 && (
              <Badge variant="destructive">High Activity</Badge>
            )}
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Unique Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-unique-users">
              {authLoading ? '...' : authMetrics?.uniqueUsers || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Active in period
            </p>
          </CardContent>
        </Card>
      </div>
      
      {/* System Metrics */}
      <Card>
        <CardHeader>
          <CardTitle>System Overview</CardTitle>
          <CardDescription>Current system usage and statistics</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">Total Events</p>
              <p className="text-2xl font-bold" data-testid="text-total-events">
                {systemLoading ? '...' : systemMetrics?.totalEvents || 0}
              </p>
            </div>
            
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">Total Tickets</p>
              <p className="text-2xl font-bold" data-testid="text-total-tickets">
                {systemLoading ? '...' : systemMetrics?.totalTickets || 0}
              </p>
            </div>
            
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">Validated</p>
              <p className="text-2xl font-bold" data-testid="text-validated-tickets">
                {systemLoading ? '...' : systemMetrics?.validatedTickets || 0}
              </p>
              {systemMetrics && systemMetrics.totalTickets > 0 && (
                <Badge variant="outline">
                  {((systemMetrics.validatedTickets / systemMetrics.totalTickets) * 100).toFixed(1)}%
                </Badge>
              )}
            </div>
            
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">Active Users</p>
              <p className="text-2xl font-bold" data-testid="text-active-users">
                {systemLoading ? '...' : systemMetrics?.activeUsers || 0}
              </p>
            </div>
            
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">Auth Queue</p>
              <p className="text-2xl font-bold" data-testid="text-queue-length">
                {systemLoading ? '...' : systemMetrics?.queueLength || 0}
              </p>
              {systemMetrics && systemMetrics.queueLength > 0 && (
                <Badge variant="secondary">
                  <Clock className="h-3 w-3 mr-1" />
                  Processing
                </Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Recent Activity Feed (placeholder for future enhancement) */}
      <Card>
        <CardHeader>
          <CardTitle>Authentication Events</CardTitle>
          <CardDescription>Recent authentication activity and alerts</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground text-center py-8">
            Event stream will be displayed here in future updates
          </div>
        </CardContent>
      </Card>
    </div>
  );
}