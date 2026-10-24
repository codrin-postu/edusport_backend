import { describe, expect, it } from 'vitest';
import {
  attachedSentence,
  displayUrl,
  nextSteps,
  registrationSubject,
  renderRegistrationEmail,
  type RegistrationEmailInput,
} from '../registration-template';

const INPUT: RegistrationEmailInput = {
  childName: 'Maria Dumitrescu',
  registrationNumber: '2026-0142',
  seasonLabel: '2026-2027',
  documents: ['acord', 'adeziune'],
  links: {
    site: 'https://scoaladepatinaj.com',
    program: 'https://scoaladepatinaj.com/cursuri/program',
    privacy: 'https://scoaladepatinaj.com/protectia-datelor',
    headerImage: 'https://cms.scoaladepatinaj.com/email/edusport-header.png',
    whatsapp: 'https://whatsapp.com/channel/abc',
    phone: '0723.623.712',
    email: 'edusporttrophy@gmail.com',
    facebook: 'https://www.facebook.com/EduSportClub',
  },
};
const ACORD_ONLY: RegistrationEmailInput = { ...INPUT, documents: ['acord'] };
const visible = (html: string) => html.replace(/<style[\s\S]*?<\/style>/g, '').replace(/<[^>]+>/g, ' ');

describe('registration e-mail copy', () => {
  it('uses the approved subject', () => {
    expect(registrationSubject('Maria Dumitrescu', '2026-0142')).toBe('Înscriere înregistrată: Maria Dumitrescu (nr. 2026-0142)');
    expect(registrationSubject(' Maria\n Dumitrescu ', '2026-0142')).toBe('Înscriere înregistrată: Maria Dumitrescu (nr. 2026-0142)');
  });

  it('names the attached documents', () => {
    expect(attachedSentence(['acord', 'adeziune'])).toBe('Am atașat formularul de înscriere și cererea de adeziune.');
    expect(attachedSentence(['acord'])).toBe('Am atașat formularul de înscriere.');
  });

  it('switches the document step between plural and singular', () => {
    expect(nextSteps(['acord', 'adeziune'])[1]).toEqual({
      title: 'Aduceți documentele',
      text: 'Tipăriți documentele atașate și aduceți-le la prima ședință. Documentele vor fi semnate la prima ședință de curs.',
    });
    expect(nextSteps(['acord'])[1]).toEqual({
      title: 'Aduceți documentul',
      text: 'Tipăriți documentul atașat și aduceți-l la prima ședință. Documentul va fi semnat la prima ședință de curs.',
    });
  });

  it('shortens links for display', () => {
    expect(displayUrl('https://www.facebook.com/EduSportClub/')).toBe('facebook.com/EduSportClub');
  });
});

describe('renderRegistrationEmail', () => {
  it('builds the E1 letter with header image, steps, buttons and sign-off', () => {
    const { html } = renderRegistrationEmail(INPUT);
    expect(html).toContain('<img src="https://cms.scoaladepatinaj.com/email/edusport-header.png"');
    expect(html).toContain('alt="Clubul Sportiv EduSport"');
    const text = visible(html);
    for (const part of ['Sezonul', '2026-2027', 'Nr. înscriere', '2026-0142', 'Înscriere înregistrată', 'Bună ziua,', 'Ce urmează', 'Confirmăm înscrierea', 'Urmăriți programul', 'Vezi programul', 'Canalul WhatsApp', 'Cu drag,', 'Echipa Școlii de Patinaj EduSport', 'ACS EduSport', 'Telefon 0723.623.712, edusporttrophy@gmail.com', 'scoaladepatinaj.com, facebook.com/EduSportClub', 'Politicii de Confidențialitate']) {
      expect(text).toContain(part);
    }
    expect(html).toContain('href="https://scoaladepatinaj.com/cursuri/program"');
    expect(html).toContain('href="https://whatsapp.com/channel/abc"');
    expect(html).toContain('href="https://scoaladepatinaj.com/protectia-datelor"');
  });

  it('is table-based and stacks the buttons on phones', () => {
    const { html } = renderRegistrationEmail(INPUT);
    expect(html).toContain('role="presentation"');
    expect(html).toContain('@media only screen and (max-width:600px)');
    expect(html).toContain('.es-btn{display:block!important;width:100%!important');
    expect(html).not.toMatch(/border-radius|dashed|dotted/);
  });

  it('has a plain-text part with the same content and the link targets', () => {
    const { text } = renderRegistrationEmail(INPUT);
    expect(text).toContain('Înscriere înregistrată');
    expect(text).toContain('Am primit înscrierea pentru Maria Dumitrescu la Școala de Patinaj EduSport. Am atașat formularul de înscriere și cererea de adeziune.');
    expect(text).toContain('1. Confirmăm înscrierea');
    expect(text).toContain('Vezi programul: https://scoaladepatinaj.com/cursuri/program');
    expect(text).toContain('Canalul WhatsApp: https://whatsapp.com/channel/abc');
    expect(text).toContain('Cu drag,\nEchipa Școlii de Patinaj EduSport');
    expect(text).not.toMatch(/<[a-z]/i);
  });

  it('never contains an em dash, a middle dot or an emoji, in any variant', () => {
    for (const input of [INPUT, ACORD_ONLY, { ...INPUT, links: { ...INPUT.links, whatsapp: null, phone: null, facebook: null } }]) {
      const { subject, html, text } = renderRegistrationEmail(input);
      for (const part of [subject, html, text]) {
        expect(part).not.toMatch(/[—·•]/);
        expect(part).not.toMatch(/\p{Extended_Pictographic}/u);
      }
    }
  });

  it('uses the singular wording with only the Acord', () => {
    const { html, text } = renderRegistrationEmail(ACORD_ONLY);
    expect(visible(html)).toContain('Am atașat formularul de înscriere.');
    expect(text).toContain('Documentul va fi semnat la prima ședință de curs.');
    expect(text).not.toContain('Documentele');
  });

  it('leaves out the WhatsApp button when no channel link is set', () => {
    const { html, text } = renderRegistrationEmail({ ...INPUT, links: { ...INPUT.links, whatsapp: null } });
    expect(html).not.toContain('Canalul WhatsApp');
    expect(text).not.toContain('Canalul WhatsApp');
  });

  it('falls back to a text header without an image address', () => {
    const { html } = renderRegistrationEmail({ ...INPUT, links: { ...INPUT.links, headerImage: null } });
    expect(html).not.toContain('<img');
    expect(visible(html)).toContain('CLUBUL SPORTIV');
    expect(visible(html)).toContain('EDUSPORT');
  });

  it('escapes what the parent typed', () => {
    const { html } = renderRegistrationEmail({ ...INPUT, childName: 'Ana <script>alert(1)</script> & "Co"' });
    expect(html).not.toContain('<script>');
    expect(html).toContain('Ana &lt;script&gt;alert(1)&lt;/script&gt; &amp; &quot;Co&quot;');
  });
});
