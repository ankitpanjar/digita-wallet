// Fallback rates (units of currency per 1 USD). They are only used to seed the table;
// if EXCHANGE_RATE_API_URL is set the live rates replace them.
export const DEFAULT_RATES: Record<string, number> = {
  USD: 1,
  EUR: 0.92,
  GBP: 0.79,
  INR: 83.2,
  JPY: 149.5,
  AUD: 1.53,
  CAD: 1.36,
  CHF: 0.88,
  CNY: 7.24,
  SGD: 1.34,
  AED: 3.6725,
};
