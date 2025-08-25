import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';

interface CaptchaProps {
  onVerify: (token: string) => void;
  onCancel?: () => void;
}

export function SimpleCaptcha({ onVerify, onCancel }: CaptchaProps) {
  const [challenge, setChallenge] = useState<{ question: string; answer: number }>({ question: '', answer: 0 });
  const [userAnswer, setUserAnswer] = useState('');
  const [error, setError] = useState('');
  
  useEffect(() => {
    generateChallenge();
  }, []);
  
  const generateChallenge = () => {
    const num1 = Math.floor(Math.random() * 10) + 1;
    const num2 = Math.floor(Math.random() * 10) + 1;
    const operations = ['+', '-', '*'];
    const operation = operations[Math.floor(Math.random() * operations.length)];
    
    let answer = 0;
    let question = '';
    
    switch (operation) {
      case '+':
        answer = num1 + num2;
        question = `${num1} + ${num2}`;
        break;
      case '-':
        answer = Math.max(num1, num2) - Math.min(num1, num2);
        question = `${Math.max(num1, num2)} - ${Math.min(num1, num2)}`;
        break;
      case '*':
        answer = num1 * num2;
        question = `${num1} × ${num2}`;
        break;
    }
    
    setChallenge({ question, answer });
    setUserAnswer('');
    setError('');
  };
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (parseInt(userAnswer) === challenge.answer) {
      // In production, this would generate a real token
      // For now, we'll use a simple validation token
      onVerify('valid-captcha-token');
    } else {
      setError('Incorrect answer. Please try again.');
      generateChallenge();
    }
  };
  
  return (
    <Card className="p-4 space-y-4" data-testid="captcha-container">
      <div className="text-sm text-muted-foreground">
        Please solve this simple math problem to continue:
      </div>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="text-2xl font-bold text-center" data-testid="captcha-challenge">
          {challenge.question} = ?
        </div>
        
        <Input
          type="number"
          value={userAnswer}
          onChange={(e) => setUserAnswer(e.target.value)}
          placeholder="Enter your answer"
          required
          autoFocus
          data-testid="input-captcha-answer"
        />
        
        {error && (
          <div className="text-sm text-destructive" data-testid="text-captcha-error">
            {error}
          </div>
        )}
        
        <div className="flex gap-2">
          <Button type="submit" className="flex-1" data-testid="button-verify-captcha">
            Verify
          </Button>
          <Button 
            type="button" 
            variant="outline" 
            onClick={generateChallenge}
            data-testid="button-new-challenge"
          >
            New Challenge
          </Button>
          {onCancel && (
            <Button 
              type="button" 
              variant="ghost" 
              onClick={onCancel}
              data-testid="button-cancel-captcha"
            >
              Cancel
            </Button>
          )}
        </div>
      </form>
    </Card>
  );
}