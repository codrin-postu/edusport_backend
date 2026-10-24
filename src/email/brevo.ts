/**
 * Brevo transactional e-mail over HTTPS (POST https://api.brevo.com/v3/smtp/email), with
 * Node's built-in fetch. One endpoint and one JSON body do not justify the SDK and its
 * dependency tree; a plain fetch is also trivial to fake in tests.
 */
import type { Sender } from './config';

export const BREVO_URL = 'https://api.brevo.com/v3/smtp/email';
const TIMEOUT_MS = 20_000;
const MAX_ERROR = 500;

export type Attachment = { name: string; content: string };
export type OutgoingEmail = { to: string; subject: string; html: string; text: string; attachments: Attachment[] };
export type SendResult = { ok: true; messageId: string | null } | { ok: false; error: string };
export type BrevoOptions = { apiKey: string; sender: Sender; replyTo: string | null; fetchFn?: typeof fetch };

type BrevoBody = {
  sender: Sender;
  to: { email: string }[];
  subject: string;
  htmlContent: string;
  textContent: string;
  attachment?: Attachment[];
  replyTo?: { email: string };
};

export function brevoBody(message: OutgoingEmail, sender: Sender, replyTo: string | null): BrevoBody {
  const body: BrevoBody = {
    sender,
    to: [{ email: message.to }],
    subject: message.subject,
    htmlContent: message.html,
    textContent: message.text,
  };
  if (message.attachments.length) body.attachment = message.attachments;
  if (replyTo) body.replyTo = { email: replyTo };
  return body;
}

async function readError(res: Response): Promise<string> {
  const raw = await res.text().catch(() => '');
  return `Brevo ${res.status}: ${raw.trim()}`.slice(0, MAX_ERROR);
}

export async function sendWithBrevo(message: OutgoingEmail, options: BrevoOptions): Promise<SendResult> {
  const fetchFn = options.fetchFn ?? fetch;
  try {
    const res = await fetchFn(BREVO_URL, {
      method: 'POST',
      headers: { accept: 'application/json', 'content-type': 'application/json', 'api-key': options.apiKey },
      body: JSON.stringify(brevoBody(message, options.sender, options.replyTo)),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return { ok: false, error: await readError(res) };
    const json = (await res.json().catch(() => ({}))) as { messageId?: unknown };
    return { ok: true, messageId: typeof json.messageId === 'string' ? json.messageId : null };
  } catch (err) {
    return { ok: false, error: `Brevo request failed: ${err instanceof Error ? err.message : String(err)}`.slice(0, MAX_ERROR) };
  }
}
