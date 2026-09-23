import 'dotenv/config';
import { env } from 'node:process';
import nodemailer from 'nodemailer';
import type { APIRoute } from 'astro';
import { site } from '../../config/site';

export const prerender = false;

function reply(status: number, message: string) {
  return new Response(JSON.stringify({ message }), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

function field(value: FormDataEntryValue | null) {
  return typeof value === 'string' ? value.trim() : '';
}

export const POST: APIRoute = async ({ request }) => {
  const contentType = request.headers.get('content-type') ?? '';

  if (
    !contentType.startsWith('multipart/form-data') &&
    !contentType.startsWith('application/x-www-form-urlencoded')
  ) {
    return reply(415, 'Unsupported form format.');
  }

  const declaredSize = Number(request.headers.get('content-length') ?? 0);
  if (declaredSize > 16_384) {
    return reply(413, 'Message is too large.');
  }

  let form: FormData;

  try {
    form = await request.formData();
  } catch {
    return reply(400, 'Invalid form submission.');
  }

  const name = field(form.get('name'));
  const email = field(form.get('email'));
  const message = field(form.get('message'));
  const website = field(form.get('website'));

  // Quietly discard submissions that fill the hidden spam field.
  if (website) {
    return reply(200, 'Message received.');
  }

  if (
    name.length < 2 ||
    name.length > 100 ||
    /[\r\n<>]/.test(name) ||
    email.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    message.length < 1 ||
    message.length > 3000
  ) {
    return reply(400, 'Please check your name, email, and message.');
  }

  const smtpHost = env.SMTP_HOST;
  const smtpPort = Number(env.SMTP_PORT);
  const smtpUser = env.SMTP_USER;
  const smtpPass = env.SMTP_PASS;
  const smtpFrom = env.SMTP_FROM;
  const recipient = site.contactEmail.trim();

  if (
    !smtpHost ||
    !Number.isInteger(smtpPort) ||
    smtpPort < 1 ||
    smtpPort > 65535 ||
    !smtpUser ||
    !smtpPass ||
    !smtpFrom ||
    !recipient
  ) {
    console.error('Contact email configuration is incomplete.');
    return reply(503, 'Enquiries are temporarily unavailable.');
  }

  try {
    const transport = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 15_000,
    });

    const result = await transport.sendMail({
      from: { name: `${site.name} website`, address: smtpFrom },
      to: recipient,
      replyTo: { name, address: email },
      subject: `New enquiry for ${site.name}`,
      text: `Name: ${name}\nEmail: ${email}\n\nMessage:\n${message}`,
    });

    if (result.accepted.length === 0) {
      throw new Error('SMTP server did not accept the recipient.');
    }

    return reply(200, 'Message sent.');
  } catch (error) {
    console.error('Contact email delivery failed:', error);
    return reply(502, 'Message could not be sent.');
  }
};