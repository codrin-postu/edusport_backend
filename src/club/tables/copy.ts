/** COPY NEEDED: the notice texts are not given yet; the suffix tells them apart. */
const COPY_NEEDED = 'COPY NEEDED';

export const TABLES_COPY = {
  notices: {
    columnDropped: `${COPY_NEEDED} (column)`,
    filterDropped: `${COPY_NEEDED} (filter)`,
    groupByDropped: `${COPY_NEEDED} (group by)`,
    sectionMissing: `${COPY_NEEDED} (section)`,
    groupMissing: `${COPY_NEEDED} (group)`,
    seasonMissing: `${COPY_NEEDED} (season)`,
    periodReset: `${COPY_NEEDED} (period)`,
  },
  views: {
    duplicate: 'Există deja o vizualizare cu numele ăsta.',
    tooMany: 'Prea multe vizualizări salvate. Șterge una.',
    notAuthor: 'Doar autorul poate modifica vizualizarea.',
    saved: 'Vizualizare salvată.',
    updated: 'Salvat.',
    deleted: 'Vizualizare ștearsă.',
  },
  readyMade: {
    platiGrupa: 'Plăți pe grupă luna aceasta',
    prezentaGrupa: 'Prezență pe grupă',
    sportiviActivi: 'Sportivi activi',
    ramas: 'Rămas de plată',
    expira: 'Abonamente care expiră',
    sportiviPlati: 'Sportivi pe grupă, cu plăți',
    author: 'Sistem',
  },
};
