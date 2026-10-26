/**
 * Registration e-mail, design E1 (DECISIONS 2026-10-05, mockups/screens/email-e-v2.html,
 * generator mockups/gen_email3.py): a letter on white with a navy left bar, header image
 * CLUBUL SPORTIV / EDUSPORT, Sezonul and Nr. înscriere on the right, "Ce urmează" in three
 * numbered navy squares, two buttons stacked on phones, sign-off and footer.
 * Table-based HTML with inline styles, plus a plain-text part. Copy is word for word from the
 * mockup; the footer joins facts with commas (no middle dot).
 */
import type { DocumentKind } from '../club/documents';

export type EmailLinks = {
  site: string;
  program: string;
  privacy: string;
  headerImage: string | null;
  whatsapp: string | null;
  phone: string | null;
  email: string | null;
  facebook: string | null;
};

export type RegistrationEmailInput = {
  childName: string;
  registrationNumber: string;
  seasonLabel: string;
  documents: DocumentKind[];
  links: EmailLinks;
};

export type RenderedEmail = { subject: string; html: string; text: string };
type Step = { title: string; text: string };

const NAVY = '#0e1a3c';
const MUTED = '#495269';
const FONT = 'Inter,Arial,Helvetica,sans-serif';
const HEAD_FONT = "'League Spartan',Arial,Helvetica,sans-serif";
const SIGN_OFF = ['Cu drag,', 'Echipa Școlii de Patinaj EduSport'] as const;
const NOTICE_START = 'Ați primit acest e-mail pentru că ați completat formularul de înscriere pe ';
const NOTICE_END = '. Datele sunt prelucrate conform ';
const PRIVACY = 'Politicii de Confidențialitate';

export function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

const oneLine = (value: string): string => value.replace(/\s+/g, ' ').trim();

export function registrationSubject(childName: string, registrationNumber: string): string {
  return `Înscriere înregistrată: ${oneLine(childName)} (nr. ${oneLine(registrationNumber)})`;
}

/** Which documents are attached, as the intro says it. */
export function attachedSentence(documents: DocumentKind[]): string {
  const acord = documents.includes('acord');
  const adeziune = documents.includes('adeziune');
  if (acord && adeziune) return 'Am atașat formularul de înscriere și cererea de adeziune.';
  return adeziune ? 'Am atașat cererea de adeziune.' : 'Am atașat formularul de înscriere.';
}

export function nextSteps(documents: DocumentKind[]): Step[] {
  const many = documents.length > 1;
  return [
    { title: 'Confirmăm înscrierea', text: 'Vom confirma înscrierea în cel mai scurt timp.' },
    many
      ? { title: 'Aduceți documentele', text: 'Tipăriți documentele atașate și aduceți-le la prima ședință. Documentele vor fi semnate la prima ședință de curs.' }
      : { title: 'Aduceți documentul', text: 'Tipăriți documentul atașat și aduceți-l la prima ședință. Documentul va fi semnat la prima ședință de curs.' },
    { title: 'Urmăriți programul', text: 'Programul weekendurilor e pe site.' },
  ];
}

/** "https://www.facebook.com/EduSportClub/" -> "facebook.com/EduSportClub" */
export function displayUrl(url: string): string {
  return url.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/+$/, '');
}

function contactLines(links: EmailLinks): string[] {
  const contact = [links.phone ? `Telefon ${links.phone}` : null, links.email].filter((v): v is string => Boolean(v));
  const web = [displayUrl(links.site), links.facebook ? displayUrl(links.facebook) : null].filter((v): v is string => Boolean(v));
  return ['ACS EduSport', contact.join(', '), web.join(', ')].filter(Boolean);
}

/** The CLUBUL SPORTIV / EDUSPORT image; as text when no image address is configured (CMS_PUBLIC_URL unset). */
function brandHtml(headerImage: string | null): string {
  if (headerImage) {
    return `<img src="${escapeHtml(headerImage)}" width="176" height="32" alt="Clubul Sportiv EduSport" style="display:block;border:0;outline:none;text-decoration:none;">`;
  }
  return (
    `<div style="font-family:${FONT};font-size:9px;font-weight:700;letter-spacing:.34em;color:${NAVY};">CLUBUL SPORTIV</div>` +
    `<div style="font-family:'Climate Crisis',Impact,${FONT};font-size:20px;letter-spacing:.04em;color:${NAVY};">EDUSPORT</div>`
  );
}

function headerHtml(input: RegistrationEmailInput): string {
  const meta = `font-family:${FONT};font-size:12px;line-height:1.6;color:${MUTED};`;
  return (
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>' +
    `<td valign="top">${brandHtml(input.links.headerImage)}</td>` +
    `<td valign="top" align="right" style="${meta}">Sezonul <b style="color:${NAVY};white-space:nowrap;">${escapeHtml(input.seasonLabel)}</b><br>` +
    `Nr. înscriere <b style="color:${NAVY};white-space:nowrap;">${escapeHtml(input.registrationNumber)}</b></td>` +
    '</tr></table>'
  );
}

function introHtml(input: RegistrationEmailInput): string {
  return (
    `<h1 style="margin:34px 0 12px;font-family:${HEAD_FONT};font-size:24px;font-weight:800;line-height:1.1;color:${NAVY};">Înscriere înregistrată</h1>` +
    '<p style="margin:0 0 6px;">Bună ziua,</p>' +
    `<p style="margin:0 0 18px;">Am primit înscrierea pentru <b>${escapeHtml(oneLine(input.childName))}</b> la Școala de Patinaj EduSport. ${attachedSentence(input.documents)}</p>`
  );
}

function stepRowHtml(step: Step, index: number): string {
  const square = `width:28px;height:28px;background:${NAVY};color:#fbf8f1;font-family:${FONT};font-size:13px;font-weight:800;text-align:center;vertical-align:middle;`;
  return (
    '<tr>' +
    `<td width="28" valign="top" style="padding:8px 0;"><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td bgcolor="${NAVY}" style="${square}">${index + 1}</td></tr></table></td>` +
    `<td valign="top" style="padding:8px 0 8px 10px;font-family:${FONT};"><b style="display:block;color:${NAVY};">${step.title}</b>` +
    `<span style="color:${MUTED};font-size:13.5px;">${step.text}</span></td>` +
    '</tr>'
  );
}

function stepsHtml(documents: DocumentKind[]): string {
  const label = `font-family:${FONT};font-size:11px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:${MUTED};`;
  return (
    `<div style="${label}">Ce urmează</div>` +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:4px;">' +
    nextSteps(documents).map(stepRowHtml).join('') +
    '</table>'
  );
}

function buttonHtml(label: string, href: string, primary: boolean): string {
  const cell = primary ? 'background:#000000;' : 'background:#ffffff;';
  const link =
    `display:block;padding:${primary ? '14px 22px' : '12px 20px'};font-family:${FONT};font-size:13px;font-weight:600;` +
    `letter-spacing:.06em;text-transform:uppercase;text-align:center;text-decoration:none;color:${primary ? '#fbf8f1' : NAVY};`;
  return `<td class="es-btn" bgcolor="${primary ? '#000000' : '#ffffff'}" style="${cell}border:1.5px solid ${NAVY};"><a href="${escapeHtml(href)}" style="${link}">${label}</a></td>`;
}

function buttonsHtml(links: EmailLinks): string {
  const whatsapp = links.whatsapp
    ? '<td class="es-gap" width="10" style="width:10px;font-size:0;line-height:0;">&nbsp;</td>' + buttonHtml('Canalul WhatsApp', links.whatsapp, false)
    : '';
  return (
    '<table role="presentation" class="es-btns" cellpadding="0" cellspacing="0" border="0" style="margin-top:22px;"><tr>' +
    buttonHtml('Vezi programul', links.program, true) +
    whatsapp +
    '</tr></table>'
  );
}

function signOffHtml(): string {
  return `<p style="margin:28px 0 0;color:${MUTED};">${SIGN_OFF[0]}<br><b style="color:${NAVY};">${SIGN_OFF[1]}</b></p>`;
}

function footerHtml(links: EmailLinks): string {
  const lines = contactLines(links).map(escapeHtml);
  lines[0] = `<b style="color:${NAVY};">${lines[0]}</b>`;
  const privacy = `<a href="${escapeHtml(links.privacy)}" style="color:${NAVY};font-weight:600;">${PRIVACY}</a>`;
  return (
    `<td colspan="2" class="es-pad" style="border-top:1px solid #dfdddb;padding:22px 36px;font-family:${FONT};font-size:11.5px;line-height:1.55;color:#5f657a;">` +
    `${lines.join('<br>')}<br><br>${NOTICE_START}${escapeHtml(displayUrl(links.site))}${NOTICE_END}${privacy}.</td>`
  );
}

const HEAD =
  '<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">' +
  '<meta name="x-apple-disable-message-reformatting"><style>' +
  '@media only screen and (max-width:600px){' +
  '.es-pad{padding-left:22px!important;padding-right:22px!important}' +
  '.es-btns,.es-btns tbody,.es-btns tr{display:block!important;width:100%!important}' +
  '.es-btn{display:block!important;width:100%!important;box-sizing:border-box}' +
  '.es-gap{display:block!important;width:100%!important;height:10px!important}}' +
  '</style></head>';

function letterHtml(input: RegistrationEmailInput): string {
  return (
    `<tr><td width="6" bgcolor="${NAVY}" style="width:6px;background:${NAVY};font-size:0;line-height:0;">&nbsp;</td>` +
    `<td class="es-pad" style="padding:36px;font-family:${FONT};font-size:14px;line-height:1.5;color:#1b1d22;">` +
    headerHtml(input) + introHtml(input) + stepsHtml(input.documents) + buttonsHtml(input.links) + signOffHtml() +
    '</td></tr>'
  );
}

export function registrationHtml(input: RegistrationEmailInput): string {
  return (
    `<!DOCTYPE html><html lang="ro">${HEAD}<body style="margin:0;padding:0;background:#f3f4f6;">` +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f3f4f6"><tr><td align="center" style="padding:24px 12px;">' +
    '<table role="presentation" cellpadding="0" cellspacing="0" border="0" bgcolor="#ffffff" style="width:100%;max-width:600px;background:#ffffff;">' +
    letterHtml(input) +
    `<tr>${footerHtml(input.links)}</tr>` +
    '</table></td></tr></table></body></html>'
  );
}

export function registrationText(input: RegistrationEmailInput): string {
  const steps = nextSteps(input.documents).map((s, i) => `${i + 1}. ${s.title}\n   ${s.text}`);
  const buttons = [`Vezi programul: ${input.links.program}`, input.links.whatsapp ? `Canalul WhatsApp: ${input.links.whatsapp}` : null];
  return [
    'Înscriere înregistrată',
    `Sezonul ${input.seasonLabel}\nNr. înscriere ${input.registrationNumber}`,
    'Bună ziua,',
    `Am primit înscrierea pentru ${oneLine(input.childName)} la Școala de Patinaj EduSport. ${attachedSentence(input.documents)}`,
    ['Ce urmează', ...steps].join('\n'),
    buttons.filter(Boolean).join('\n'),
    SIGN_OFF.join('\n'),
    contactLines(input.links).join('\n'),
    `${NOTICE_START}${displayUrl(input.links.site)}${NOTICE_END}${PRIVACY}: ${input.links.privacy}`,
  ].join('\n\n') + '\n';
}

export function renderRegistrationEmail(input: RegistrationEmailInput): RenderedEmail {
  return {
    subject: registrationSubject(input.childName, input.registrationNumber),
    html: registrationHtml(input),
    text: registrationText(input),
  };
}
