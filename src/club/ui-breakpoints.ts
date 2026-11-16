/** The one set of admin breakpoints: phone stacks everything, tablet is where rails and list-detail panes collapse. */
export const BP = { phone: 640, tablet: 1024 } as const;

export const phoneQuery = `(max-width:${BP.phone}px)`;
export const tabletQuery = `(max-width:${BP.tablet}px)`;
