import type { APIRoute } from 'astro';
import { getCalendar } from '../../lib/airbnb-calendar';
import { getStayQuote } from '../../lib/quote';

export const prerender = false;

const headers = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
};

function json(data: object, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers });
}

function todayInSouthAfrica(): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Africa/Johannesburg',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());

  const value = (type: string) =>
    parts.find((part) => part.type === type)?.value;

  return `${value('year')}-${value('month')}-${value('day')}`;
}

export const GET: APIRoute = async ({ url }) => {
  const checkIn = url.searchParams.get('checkIn') ?? '';
  const checkOut = url.searchParams.get('checkOut') ?? '';
  const quote = getStayQuote(checkIn, checkOut);

  if (!quote) {
    return json(
      { error: 'Please choose valid dates with configured nightly prices.' },
      422,
    );
  }

  const today = todayInSouthAfrica();
  const latestCheckout = new Date(
    Date.parse(`${today}T00:00:00Z`) + 365 * 24 * 60 * 60 * 1000,
  ).toISOString().slice(0, 10);

  if (checkIn < today || checkOut > latestCheckout) {
    return json(
      { error: 'Please choose future dates within the next year.' },
      400,
    );
  }

  try {
    const calendar = await getCalendar();

    const hasBlockedNight = calendar.blockedDates.some(
      (date) => date >= checkIn && date < checkOut,
    );

    if (hasBlockedNight) {
      return json(
        { error: 'One or more selected nights are unavailable.' },
        409,
      );
    }

    return json({
      checkIn,
      checkOut,
      ...quote,
      checkedAt: calendar.checkedAt,
    });
  } catch {
    return json(
      { error: 'Availability is temporarily unavailable.' },
      503,
    );
  }
};