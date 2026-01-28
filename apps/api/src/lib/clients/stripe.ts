/**
 * Stripe Client
 *
 * Used for fiat payment processing (investment deposits, payouts).
 *
 * Required environment variables:
 * - STRIPE_SECRET_KEY
 * - STRIPE_WEBHOOK_SECRET (for webhook verification)
 */

// Lazy-loaded client
let __stripeClient: Awaited<ReturnType<typeof createStripeClient>> | null = null;

export const createStripeClient = async () => {
  const Stripe = (await import('stripe')).default;

  return new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2024-12-18.acacia',
    typescript: true,
  });
};

export const getStripeClient = async () => {
  if (!__stripeClient) {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error('STRIPE_SECRET_KEY not configured');
    }
    __stripeClient = await createStripeClient();
  }
  return __stripeClient;
};

// Re-export types
export type { Stripe } from 'stripe';
