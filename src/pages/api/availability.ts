import type { APIRoute } from 'astro';
import { getCalendar } from '../../lib/airbnb-calendar';

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
  const forceRefresh =
    new URL(request.url).searchParams.get('refresh') === '1';

  try {
    const calendar = await getCalendar(forceRefresh);

    return new Response(JSON.stringify(calendar), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      },
    });
  } catch {
    return new Response(
      JSON.stringify({
        error: 'Availability could not be checked. Please try again.',
      }),
      {
        status: 503,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store',
        },
      },
    );
  }
};