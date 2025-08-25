import { AuthMonitoring } from '@/components/monitoring/auth-monitoring';
import { useAuth } from '@/hooks/use-auth';
import { Redirect } from 'wouter';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Shield } from 'lucide-react';

export default function MonitoringPage() {
  const { user } = useAuth();
  
  // For now, allow any authenticated user to view monitoring
  // In production, you might want to restrict this to admin users
  if (!user) {
    return <Redirect to="/" />;
  }
  
  return (
    <div className="min-h-screen bg-background">
      <div className="border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            <span className="text-sm font-medium">System Monitoring</span>
          </div>
        </div>
      </div>
      
      <AuthMonitoring />
      
      <div className="container mx-auto px-4 py-4">
        <Alert>
          <AlertDescription>
            This monitoring dashboard provides real-time insights into authentication health and system usage. 
            Data refreshes automatically every 30 seconds.
          </AlertDescription>
        </Alert>
      </div>
    </div>
  );
}