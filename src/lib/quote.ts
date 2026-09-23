import { bookingPricing } from '../config/booking';

const DAY_MS = 24 * 60 * 60 * 1000;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export type StayQuote = {
  nights: number;
  total: number;
  currency: string;
};

function dateToUtc(date: string): number | null {
  if (!DATE_PATTERN.test(date)) return null;

  const value = Date.parse(`${date}T00:00:00Z`);

  if (!Number.isFinite(value)) return null;
  if (new Date(value).toISOString().slice(0, 10) !== date) return null;

  return value;
}

export function getStayQuote(
  checkIn: string,
  checkOut: string,
): StayQuote | null {
  const start = dateToUtc(checkIn);
  const end = dateToUtc(checkOut);

  if (start === null || end === null) return null;

  const nights = (end - start) / DAY_MS;
  if (nights < 1 || nights > 365) return null;

  let totalCents = 0;

  for (let day = start; day < end; day += DAY_MS) {
    const date = new Date(day);
    const dateKey = date.toISOString().slice(0, 10);
    const weekday = date.getUTCDay();

    const special = bookingPricing.specialRates.find(
      (range) => dateKey >= range.start && dateKey <= range.end,
    );

    const rate = special
      ? special.nightlyRate
      : weekday === 5 || weekday === 6
        ? bookingPricing.weekendNightlyRate
        : bookingPricing.weekdayNightlyRate;

    if (typeof rate !== 'number' || !Number.isFinite(rate) || rate <= 0) {
      return null;
    }

    totalCents += Math.round(rate * 100);
  }

  return {
    nights,
    total: totalCents / 100,
    currency: bookingPricing.currency,
  };
}