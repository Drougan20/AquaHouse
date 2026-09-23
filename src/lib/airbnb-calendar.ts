import 'dotenv/config';
import { env } from 'node:process';
import ical from 'node-ical';

export type CalendarSnapshot = {
  blockedDates: string[];
  checkedAt: string;
};

const DAY_MS = 24 * 60 * 60 * 1000;
const CACHE_MS = 60 * 1000;

let cached: CalendarSnapshot | null = null;
let cacheUntil = 0;
let pending: Promise<CalendarSnapshot> | null = null;

function calendarDay(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const value = (type: string) =>
    parts.find((part) => part.type === type)?.value;

  return `${value('year')}-${value('month')}-${value('day')}`;
}

async function fetchCalendar(): Promise<CalendarSnapshot> {
  const calendarUrl = env.AIRBNB_ICAL_URL;

  if (!calendarUrl) {
    throw new Error('AIRBNB_ICAL_URL is missing');
  }

  const url = new URL(calendarUrl);

  if (url.protocol !== 'https:') {
    throw new Error('Airbnb calendar URL must use HTTPS');
  }

  const response = await fetch(url.toString(), {
  signal: AbortSignal.timeout(10_000),
  cache: 'no-store',
});

if (!response.ok) {
  throw new Error(`Airbnb calendar request failed: ${response.status}`);
}

const calendarText = await response.text();

if (!calendarText.includes('BEGIN:VCALENDAR')) {
  throw new Error('Airbnb did not return a calendar');
}

const events = await ical.async.parseICS(calendarText);

  const blocked = new Set<string>();
  const windowStart = Date.now() - DAY_MS;
  const windowEnd = Date.now() + 370 * DAY_MS;

  for (const event of Object.values(events)) {
    if (!event || event.type !== 'VEVENT') continue;

    if (!(event.start instanceof Date) || !(event.end instanceof Date)) {
      throw new Error('Airbnb calendar contains an invalid event');
    }

    const instances = ical.expandRecurringEvent(event, {
      from: new Date(windowStart),
      to: new Date(windowEnd),
      expandOngoing: true,
    });

    for (const instance of instances) {
      const propertyTimeZone = 'Africa/Johannesburg';

      const firstNight = calendarDay(instance.start, propertyTimeZone);
      const checkoutDay = calendarDay(instance.end, propertyTimeZone);;

      const first = Date.parse(`${firstNight}T00:00:00Z`);
      const last = Date.parse(`${checkoutDay}T00:00:00Z`);

      if (!Number.isFinite(first) || !Number.isFinite(last) || last <= first) {
        throw new Error('Airbnb calendar contains invalid dates');
      }

      for (
        let day = Math.max(first, windowStart);
        day < Math.min(last, windowEnd);
        day += DAY_MS
      ) {
        blocked.add(new Date(day).toISOString().slice(0, 10));
      }
    }
  }

  return {
    blockedDates: [...blocked].sort(),
    checkedAt: new Date().toISOString(),
  };
}

export function getCalendar(forceRefresh = false): Promise<CalendarSnapshot> {
  if (!forceRefresh && cached && Date.now() < cacheUntil) {
    return Promise.resolve(cached);
  }

  if (!pending) {
    pending = fetchCalendar()
      .then((result) => {
        cached = result;
        cacheUntil = Date.now() + CACHE_MS;
        return result;
      })
      .finally(() => {
        pending = null;
      });
  }

  return pending;
}