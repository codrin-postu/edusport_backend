import type { Core } from '@strapi/strapi';

declare const strapi: Core.Strapi;

interface ParticipantJSON {
  documentId?: string;
  name?: string;
  category?: string;
  placement?: number | null;
  score?: number | null;
}

async function syncSportspeople(data: Record<string, unknown>) {
  const participants = data?.participantData;
  if (!Array.isArray(participants)) return;

  const docIds = (participants as ParticipantJSON[])
    .map((p) => p?.documentId)
    .filter((id): id is string => Boolean(id));

  if (docIds.length === 0) {
    data.sportspeople = { connect: [], disconnect: [] };
    return;
  }

  // The entity manager needs numeric IDs — documentIds must be resolved here
  // because the document service relation translation doesn't run on lifecycle-
  // injected fields when a customField is present on the same content type.
  const entities = await (strapi.db as any)
    .query('api::sportsperson.sportsperson')
    .findMany({ where: { documentId: { $in: docIds } }, select: ['id'] });

  data.sportspeople = {
    connect: (entities as { id: number }[]).map((e) => ({ id: e.id })),
    disconnect: [],
  };
}

export default {
  async beforeCreate(event: { params: { data: Record<string, unknown> } }) {
    await syncSportspeople(event.params.data);
  },
  async beforeUpdate(event: { params: { data: Record<string, unknown> } }) {
    await syncSportspeople(event.params.data);
  },
};
