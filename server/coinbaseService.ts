const Client = require('coinbase-commerce-node');

// Ticket package configurations
export const TICKET_PACKAGES = [
  { 
    tickets: 100, 
    price: 5, 
    bonus: 10,  // +10 bonus for Coinbase payments
    displayName: '100 Tickets',
    description: 'Perfect for trying out events'
  },
  { 
    tickets: 500, 
    price: 20, 
    bonus: 10,  // +10 bonus for Coinbase payments
    displayName: '500 Tickets',
    description: 'Great value for regular attendees'
  },
  { 
    tickets: 1000, 
    price: 35, 
    bonus: 10,  // +10 bonus for Coinbase payments
    displayName: '1000 Tickets',
    description: 'Best value for event creators'
  },
  { 
    tickets: 5000, 
    price: 150, 
    bonus: 10,  // +10 bonus for Coinbase payments
    displayName: '5000 Tickets',
    description: 'Premium package for power users'
  }
];

export interface CoinbaseSettings {
  apiKey: string;
  webhookSecret: string;
  enabled: boolean;
}

export class CoinbaseService {
  private client: any;
  private charge: any;
  private webhook: any;
  private settings: CoinbaseSettings | null = null;
  
  constructor() {
    this.initialize();
  }
  
  private initialize() {
    const apiKey = process.env.COINBASE_API_KEY;
    const webhookSecret = process.env.COINBASE_WEBHOOK_SECRET;
    
    if (!apiKey || !webhookSecret) {
      console.log('[COINBASE] Coinbase Commerce not configured - payments disabled');
      return;
    }
    
    try {
      Client.init(apiKey);
      this.charge = Client.resources.Charge;
      this.webhook = Client.Webhook;
      
      this.settings = {
        apiKey,
        webhookSecret,
        enabled: true
      };
      
      console.log('[COINBASE] Coinbase Commerce initialized successfully');
    } catch (error) {
      console.error('[COINBASE] Failed to initialize:', error);
      this.settings = null;
    }
  }
  
  /**
   * Check if Coinbase payments are available
   */
  public isAvailable(): boolean {
    return this.settings?.enabled === true && !!this.charge;
  }
  
  /**
   * Get current settings (without exposing secrets)
   */
  public getSettings(): { enabled: boolean; configured: boolean } {
    return {
      enabled: this.settings?.enabled || false,
      configured: !!this.settings?.apiKey
    };
  }
  
  /**
   * Update Coinbase settings (admin only)
   */
  public async updateSettings(apiKey?: string, webhookSecret?: string, enabled?: boolean): Promise<boolean> {
    try {
      // If new credentials provided, test them
      if (apiKey) {
        Client.init(apiKey);
        this.charge = Client.resources.Charge;
        
        // Test the API key by making a simple request
        await Client.resources.Charge.list({ limit: 1 });
      }
      
      // Update settings
      if (apiKey || webhookSecret !== undefined || enabled !== undefined) {
        this.settings = {
          apiKey: apiKey || this.settings?.apiKey || '',
          webhookSecret: webhookSecret || this.settings?.webhookSecret || '',
          enabled: enabled !== undefined ? enabled : (this.settings?.enabled || false)
        };
        
        // Re-initialize if enabled
        if (this.settings.enabled && this.settings.apiKey) {
          Client.init(this.settings.apiKey);
          this.charge = Client.resources.Charge;
          this.webhook = Client.Webhook;
        }
      }
      
      return true;
    } catch (error) {
      console.error('[COINBASE] Failed to update settings:', error);
      return false;
    }
  }
  
  /**
   * Create a charge for ticket purchase
   */
  public async createCharge(
    packageIndex: number,
    userId: string,
    userEmail: string,
    userName: string
  ): Promise<{ chargeId: string; hostedUrl: string } | null> {
    if (!this.isAvailable()) {
      return null;
    }
    
    const ticketPackage = TICKET_PACKAGES[packageIndex];
    if (!ticketPackage) {
      throw new Error('Invalid package selected');
    }
    
    try {
      const chargeData = {
        name: `${ticketPackage.displayName} (+${ticketPackage.bonus} bonus)`,
        description: `${ticketPackage.tickets + ticketPackage.bonus} total tickets for your event platform account`,
        local_price: {
          amount: ticketPackage.price.toString(),
          currency: 'USD'
        },
        pricing_type: 'fixed_price',
        metadata: {
          userId,
          userEmail,
          userName,
          packageIndex: packageIndex.toString(),
          tickets: ticketPackage.tickets.toString(),
          bonus: ticketPackage.bonus.toString(),
          totalTickets: (ticketPackage.tickets + ticketPackage.bonus).toString()
        },
        redirect_url: `${process.env.APP_URL || 'http://localhost:5000'}/account?payment=success`,
        cancel_url: `${process.env.APP_URL || 'http://localhost:5000'}/account?payment=cancelled`
      };
      
      const charge = await this.charge.create(chargeData);
      
      return {
        chargeId: charge.id,
        hostedUrl: charge.hosted_url
      };
    } catch (error) {
      console.error('[COINBASE] Failed to create charge:', error);
      return null;
    }
  }
  
  /**
   * Verify webhook signature
   */
  public verifyWebhookSignature(rawBody: string, signature: string): boolean {
    if (!this.settings?.webhookSecret) {
      return false;
    }
    
    try {
      this.webhook.verifyEventBody(rawBody, signature, this.settings.webhookSecret);
      return true;
    } catch (error) {
      console.error('[COINBASE] Webhook signature verification failed:', error);
      return false;
    }
  }
  
  /**
   * Process webhook event
   */
  public async processWebhookEvent(event: any): Promise<{
    success: boolean;
    userId?: string;
    tickets?: number;
  }> {
    try {
      const { type, data } = event;
      
      // We only care about successful payments
      if (type !== 'charge:confirmed' && type !== 'charge:resolved') {
        return { success: false };
      }
      
      const charge = data;
      const metadata = charge.metadata;
      
      if (!metadata?.userId || !metadata?.totalTickets) {
        console.error('[COINBASE] Invalid charge metadata');
        return { success: false };
      }
      
      return {
        success: true,
        userId: metadata.userId,
        tickets: parseInt(metadata.totalTickets)
      };
    } catch (error) {
      console.error('[COINBASE] Failed to process webhook event:', error);
      return { success: false };
    }
  }
  
  /**
   * Get charge details
   */
  public async getCharge(chargeId: string): Promise<any> {
    if (!this.isAvailable()) {
      return null;
    }
    
    try {
      return await this.charge.retrieve(chargeId);
    } catch (error) {
      console.error('[COINBASE] Failed to retrieve charge:', error);
      return null;
    }
  }
}

// Export singleton instance
export const coinbaseService = new CoinbaseService();