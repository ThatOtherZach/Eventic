import { useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { SimpleCaptcha } from './captcha';
import { Loader2, AlertCircle, Clock } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

export function LoginForm() {
  const { signUp } = useAuth();
  const [email, setEmail] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requiresCaptcha, setRequiresCaptcha] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [queueInfo, setQueueInfo] = useState<{ position: number; id: string } | null>(null);
  const [blocked, setBlocked] = useState<{ message: string; minutesRemaining: number } | null>(null);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    
    try {
      // Call the new login endpoint first
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email, 
          rememberMe,
          captchaToken: captchaToken || undefined 
        })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        // Handle rate limiting
        if (response.status === 429) {
          if (data.blocked) {
            setBlocked({
              message: data.message,
              minutesRemaining: data.minutesRemaining
            });
            return;
          }
          setError(data.message);
          return;
        }
        
        // Handle CAPTCHA requirement
        if (response.status === 400 && data.requiresCaptcha) {
          setRequiresCaptcha(true);
          setError(data.message);
          return;
        }
        
        // Handle queue
        if (response.status === 503 && data.queuePosition !== undefined) {
          setQueueInfo({
            position: data.queuePosition,
            id: data.queueId
          });
          // Start polling for queue updates
          startQueuePolling(email);
          return;
        }
        
        throw new Error(data.message || 'Login failed');
      }
      
      // Success - now trigger Supabase magic link
      await signUp(email);
      
      // Store session preference
      if (rememberMe) {
        localStorage.setItem('rememberMe', 'true');
      } else {
        localStorage.removeItem('rememberMe');
      }
      
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  };
  
  const startQueuePolling = (email: string) => {
    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`/api/auth/queue/${encodeURIComponent(email)}`);
        if (response.ok) {
          const data = await response.json();
          if (queueInfo) {
            setQueueInfo({ ...queueInfo, position: data.position });
          }
          
          // If position is 0, they're being processed
          if (data.position === 0) {
            clearInterval(pollInterval);
            setQueueInfo(null);
            // Retry login
            handleSubmit(new Event('submit') as any);
          }
        } else if (response.status === 404) {
          // No longer in queue, might be processed
          clearInterval(pollInterval);
          setQueueInfo(null);
        }
      } catch (err) {
        console.error('Queue polling error:', err);
      }
    }, 5000); // Poll every 5 seconds
    
    // Clean up after 10 minutes
    setTimeout(() => clearInterval(pollInterval), 10 * 60 * 1000);
  };
  
  const handleCaptchaVerify = (token: string) => {
    setCaptchaToken(token);
    setRequiresCaptcha(false);
    // Retry submission with CAPTCHA token
    handleSubmit(new Event('submit') as any);
  };
  
  if (blocked) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Access Temporarily Blocked</CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {blocked.message}
            </AlertDescription>
          </Alert>
          <div className="mt-4 text-sm text-muted-foreground">
            Please wait {blocked.minutesRemaining} minutes before trying again.
          </div>
        </CardContent>
      </Card>
    );
  }
  
  if (queueInfo) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Authentication Queue</CardTitle>
          <CardDescription>The authentication service is currently busy</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <Clock className="h-8 w-8 text-muted-foreground animate-pulse" />
            <div>
              <div className="text-2xl font-bold" data-testid="text-queue-position">
                Position: {queueInfo.position}
              </div>
              <div className="text-sm text-muted-foreground">
                You'll be processed automatically
              </div>
            </div>
          </div>
          <Alert>
            <AlertDescription>
              Please keep this page open. We'll log you in as soon as possible.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }
  
  if (requiresCaptcha && !captchaToken) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Verification Required</CardTitle>
          <CardDescription>Please complete the CAPTCHA to continue</CardDescription>
        </CardHeader>
        <CardContent>
          <SimpleCaptcha 
            onVerify={handleCaptchaVerify}
            onCancel={() => {
              setRequiresCaptcha(false);
              setCaptchaToken(null);
            }}
          />
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>Sign In</CardTitle>
        <CardDescription>
          Enter your email to receive a magic link
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={isLoading}
              data-testid="input-email"
            />
          </div>
          
          <div className="flex items-center space-x-2">
            <Checkbox 
              id="remember" 
              checked={rememberMe}
              onCheckedChange={(checked) => setRememberMe(checked as boolean)}
              disabled={isLoading}
              data-testid="checkbox-remember"
            />
            <Label 
              htmlFor="remember" 
              className="text-sm font-normal cursor-pointer"
            >
              Remember me for 30 days (instead of 15)
            </Label>
          </div>
          
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          
          <Button 
            type="submit" 
            className="w-full" 
            disabled={isLoading}
            data-testid="button-submit-login"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending magic link...
              </>
            ) : (
              'Send Magic Link'
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}