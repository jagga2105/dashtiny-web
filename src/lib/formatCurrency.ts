/**
 * DashTiny Currency Formatter
 * Canonical currency formatter for travel offers and decision cards.
 * Data-driven support for INR, USD, EUR, GBP without hardcoding currency symbols in UI.
 */
export function formatCurrency(amount: number | null | undefined, currency: string = 'INR'): string {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return '—';
  }

  const curr = (currency || 'INR').toUpperCase().trim();

  // Locale mapping for standard financial presentations
  const localeMap: Record<string, string> = {
    INR: 'en-IN',
    USD: 'en-US',
    EUR: 'de-DE',
    GBP: 'en-GB',
  };

  const locale = localeMap[curr] || 'en-IN';

  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: curr,
      maximumFractionDigits: 0,
      minimumFractionDigits: 0,
    }).format(amount);
  } catch {
    // Graceful fallback if Intl fails
    const symbolMap: Record<string, string> = {
      INR: '₹',
      USD: '$',
      EUR: '€',
      GBP: '£',
    };
    const symbol = symbolMap[curr] || `${curr} `;
    return `${symbol}${Math.round(amount).toLocaleString('en-US')}`;
  }
}
