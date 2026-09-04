import { env } from '../../config/env.js';

/**
 * Outbound email behind a driver.
 *
 * Without a key, mail is printed to the server log rather than silently
 * dropped — so a developer can read the password-reset link, the referee's
 * form link and the interview details without any mail configuration at all.
 */

const consoleDriver = {
  name: 'console',
  async send({ to, subject, text }) {
    console.log(
      ['', '─'.repeat(72), `  mail → ${to}`, `  ${subject}`, '─'.repeat(72), text.trim(), '─'.repeat(72), ''].join('\n'),
    );
    return { id: `console-${Date.now()}` };
  },
};

const resendDriver = {
  name: 'resend',
  async send({ to, subject, text, html }) {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${env.mail.resendApiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ from: env.mail.from, to: [to], subject, text, html }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(`Resend rejected the message (${res.status}): ${detail.slice(0, 200)}`);
    }
    return res.json();
  },
};

const driver = env.mail.driver === 'resend' ? resendDriver : consoleDriver;

export const mailer = {
  driver: driver.name,
  /** Never throws. A failed send is reported to the caller, not raised. */
  async send(message) {
    try {
      const result = await driver.send(message);
      return { ok: true, result };
    } catch (err) {
      console.error('[kingdom-network] mail send failed:', err.message);
      return { ok: false, error: err.message };
    }
  },
};

export const link = (path) => `${env.publicBaseUrl}${path.startsWith('/') ? path : `/${path}`}`;
