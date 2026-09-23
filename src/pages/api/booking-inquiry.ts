import 'dotenv/config';
import { env } from 'node:process';
import type { APIRoute } from 'astro';
import nodemailer from 'nodemailer';
import { site } from '../../config/site';
import { getCalendar } from '../../lib/airbnb-calendar';
import { getStayQuote } from '../../lib/quote';

export const prerender = false;

function json(body: object, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });
}

function field(form: FormData, key: string): string {
  const value = form.get(key);
  return typeof value === 'string' ? value.trim() : '';
}

function todayInSouthAfrica(): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Johannesburg',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());

  const value = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? '';

  return `${value('year')}-${value('month')}-${value('day')}`;
}

export const POST: APIRoute = async ({ request }) => {
  let form: FormData;

  try {
    form = await request.formData();
  } catch {
    return json({ error: 'Please check the enquiry form and try again.' }, 400);
  }

  // Hidden field used to discard basic bot submissions.
  if (field(form, 'website')) {
    return json({ ok: true });
  }

  const name = field(form, 'name');
  const email = field(form, 'email');
  const phone = field(form, 'phone');
  const message = field(form, 'message');
  const checkIn = field(form, 'checkIn');
  const checkOut = field(form, 'checkOut');

  if (!email && !phone) {
    return json({ error: 'Enter an email address or phone number.' }, 400);
  }

  if (
    name.length > 100 ||
    email.length > 254 ||
    phone.length > 30 ||
    !message ||
    message.length > 3000
  ) {
    return json({ error: 'Please check the enquiry details.' }, 400);
  }

  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json({ error: 'Enter a valid email address.' }, 400);
  }

  if (
    phone &&
    (!/^[+()\d\s.-]+$/.test(phone) ||
      phone.replace(/\D/g, '').length < 7 ||
      phone.replace(/\D/g, '').length > 15)
  ) {
    return json({ error: 'Enter a valid phone number.' }, 400);
  }

  const today = todayInSouthAfrica();
  const latestCheckout = new Date(
    Date.parse(`${today}T00:00:00Z`) + 365 * 86_400_000,
  )
    .toISOString()
    .slice(0, 10);

  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(checkIn) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(checkOut) ||
    checkIn < today ||
    checkOut > latestCheckout
  ) {
    return json({ error: 'Choose valid dates within the next year.' }, 400);
  }

  // Prices come from our server configuration, never the browser's total.
  const quote = getStayQuote(checkIn, checkOut);

  if (!quote) {
    return json({ error: 'A price is unavailable for those dates.' }, 422);
  }

  let blockedDates: string[];

  try {
    // Bypass our short cache for the final availability check.
    blockedDates = (await getCalendar(true)).blockedDates;
  } catch {
    return json(
      { error: 'Availability could not be checked. Please try again shortly.' },
      503,
    );
  }

  if (blockedDates.some((day) => day >= checkIn && day < checkOut)) {
    return json(
      { error: 'One or more selected nights are no longer available.' },
      409,
    );
  }

  const port = Number(env.SMTP_PORT);

  if (
    !env.SMTP_HOST ||
    !Number.isInteger(port) ||
    port < 1 ||
    port > 65535 ||
    !env.SMTP_USER ||
    !env.SMTP_PASS ||
    !env.SMTP_FROM ||
    !site.contactEmail
  ) {
    return json({ error: 'Enquiries are temporarily unavailable.' }, 503);
  }

  const total = new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency: quote.currency,
  }).format(quote.total);

  try {
    const transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port,
      secure: port === 465,
      auth: {
        user: env.SMTP_USER,
        pass: env.SMTP_PASS,
      },
    });

    await transporter.sendMail({
      from: env.SMTP_FROM,
      to: site.contactEmail,
      ...(email ? { replyTo: email } : {}),
      subject: `Whole-house enquiry: ${checkIn} to ${checkOut}`,
      text: [
        'New whole-house availability enquiry',
        '',
        `Check-in: ${checkIn}`,
        `Check-out: ${checkOut}`,
        `Nights: ${quote.nights}`,
        `Estimated total: ${total}`,
        '',
        `Name: ${name || 'Not supplied'}`,
        `Email: ${email || 'Not supplied'}`,
        `Phone: ${phone || 'Not supplied'}`,
        '',
        'Message:',
        message,
        '',
        'This is an enquiry, not a confirmed booking.',
      ].join('\n'),
    });

    return json({ ok: true });
  } catch {
    return json(
      { error: 'Your enquiry could not be sent. Please try again.' },
      502,
    );
  }
};