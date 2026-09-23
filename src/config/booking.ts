type SpecialRate = {
  start: string; // First night, inclusive
  end: string;   // Last night, inclusive
  nightlyRate: number | null;
};

type BookingPricing = {
  currency: string;
  weekdayNightlyRate: number | null; // Sunday–Thursday
  weekendNightlyRate: number | null; // Friday–Saturday
  specialRates: SpecialRate[];
};

export const bookingPricing: BookingPricing = {
  currency: 'ZAR',

  weekdayNightlyRate: 4500,
  weekendNightlyRate: 5175,

  specialRates: [
    { start: '2026-12-10', end: '2026-12-18', nightlyRate: 9000 },
    { start: '2026-12-19', end: '2026-12-29', nightlyRate: 12500 },
    { start: '2026-12-30', end: '2027-01-02', nightlyRate: 18000 },
    { start: '2027-01-03', end: '2027-01-05', nightlyRate: 15000 },
    { start: '2027-01-06', end: '2027-01-08', nightlyRate: 8000 },
  ],
};