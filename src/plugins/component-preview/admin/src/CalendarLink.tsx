import * as React from 'react';
import { LinkOutCard } from './components/LinkOutCard';

interface Props {
  name: string;
  attribute: Record<string, unknown>;
}

/**
 * Sends the editor to the custom "Calendar si serii" page.
 *
 * The program page used to carry its own calendar and schedule fields. Those
 * moved to the Program single type, and the dead copies were removed, which
 * left this screen with no hint of where the calendar actually lives. Same
 * shape as the season link inside CalendarEventsEditor and the competitions
 * link on Realizari.
 */
export default function CalendarLink(_props: Props) {
  return (
    <LinkOutCard
      title="Calendar și serii"
      description="Calendarul sezonului și seriile de curs se editează în pagina Program, nu aici."
      body="Aici poți edita datele pentru școala de patinaj și alte evenimente."
      href="/admin/plugins/edusport-program"
      linkLabel="Deschide Calendar și serii"
    />
  );
}
