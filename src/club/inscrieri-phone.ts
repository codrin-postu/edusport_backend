import { whatsappDigits } from './phone';

/** The first message of the WhatsApp action. The user writes the text; placeholders: {parinte}, {copil}. */
export const WHATSAPP_MESSAGE = 'COPY NEEDED';

export const PHONE_COPY = { copied: 'Copiat.', invalid: 'Număr de telefon invalid', copy: 'Copiază', whatsapp: 'WhatsApp' };

type Names = { parinte: string; copil: string };

/** Fills the placeholders of a template with the parent and child names. */
export function fillMessage(template: string, names: Names): string {
  return template.split('{parinte}').join(names.parinte).split('{copil}').join(names.copil);
}

export const whatsappMessage = (names: Names): string => fillMessage(WHATSAPP_MESSAGE, names);

/** wa.me link with the message; null when the phone does not parse. */
export function whatsappUrl(raw: string, names: Names): string | null {
  const digits = whatsappDigits(raw);
  return digits ? `https://wa.me/${digits}?text=${encodeURIComponent(whatsappMessage(names))}` : null;
}

/** A registration still "Nou" becomes "Contactat" when WhatsApp is pressed; any other status stays. */
export const statusAfterWhatsapp = (status: string): 'Contactat' | null => (status === 'Nou' ? 'Contactat' : null);
