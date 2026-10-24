import { expect, it } from 'vitest';
import { readEmailConfig } from '../config';
import { buildEmailLinks } from '../links';

it('builds the site links and reads the contact from Setări site', () => {
  const config = readEmailConfig({ FRONTEND_ORIGIN: 'https://scoaladepatinaj.com', CMS_PUBLIC_URL: 'https://cms.scoaladepatinaj.com' });
  const contact = { phone: '0723.623.712', email: ' edusporttrophy@gmail.com ', facebookUrl1: 'https://www.facebook.com/EduSportClub', whatsappChannelUrl: '' };
  expect(buildEmailLinks(config, contact)).toEqual({
    site: 'https://scoaladepatinaj.com',
    program: 'https://scoaladepatinaj.com/cursuri/program',
    privacy: 'https://scoaladepatinaj.com/protectia-datelor',
    headerImage: 'https://cms.scoaladepatinaj.com/email/edusport-header.png',
    whatsapp: null,
    phone: '0723.623.712',
    email: 'edusporttrophy@gmail.com',
    facebook: 'https://www.facebook.com/EduSportClub',
  });
});

it('copes with a missing contact block and no CMS address', () => {
  expect(buildEmailLinks(readEmailConfig({}), null)).toMatchObject({ headerImage: null, whatsapp: null, phone: null, email: null, facebook: null });
});
