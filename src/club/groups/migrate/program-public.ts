/** Step 3 (spec 4, W8): groups whose "Program public" was never written get `true`, so the website shows what it shows today. Pure. */
export const planProgramPublic = (rows: { id: string; name: string; programPublic: unknown }[]): { id: string; name: string }[] =>
  rows.filter((r) => r.programPublic === null || r.programPublic === undefined).map(({ id, name }) => ({ id, name }));
