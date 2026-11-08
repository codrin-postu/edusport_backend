import * as React from 'react';
import { getFetchClient, useAuth, useFetchClient } from '@strapi/admin/strapi-admin';
import type { ActionBody, GroupOptions } from '../../../club/groups/api-types';
import type {
  AddedSession, CoachPage, CoachRow, GridPage, GroupMonth, LessonPanel, LessonSaved, PeriodLessonRow, PeriodPage, SessionCheck, SessionDefaults,
  SessionPanel, SessionSaveBody, SessionSaved,
} from '../../../club/presence/attendance/api-types';
import { coachesCsvName } from '../../../club/presence/coaches/csv';
import { searchUrl } from '../../../club/sportivi/search-view';
import { downloadGet } from '../inscrieri/downloadPdf';
import { strapiDownload } from '../inscrieri/strapiDownload';

const BASE = '/api/club';
const enc = encodeURIComponent;
type Body = Record<string, unknown>;
type Wrapped<T> = { data: { data: T } };

/** The panel's address: a saved session, a held occurrence, or a session not saved yet (the "+ Ședință nouă" panel). */
export type SessionQuery = ({ id: string } | { occurrence: string } | AddedSession) & { athlete?: string };
/** The "+ Ședință nouă" check body (readNewSession). */
export type NewSessionBody = { groupId: string; date: string; startTime: string };

function query(values: Record<string, string | null>): string {
  const s = new URLSearchParams(Object.entries(values).filter((e): e is [string, string] => !!e[1])).toString();
  return s ? `?${s}` : '';
}

function sessionQuery(q: SessionQuery): string {
  const athlete = q.athlete ?? null;
  if ('id' in q) return query({ id: q.id, athlete });
  if ('occurrence' in q) return query({ occurrence: q.occurrence, athlete });
  return query({ group: q.groupId, date: q.date, time: q.startTime, duration: String(q.durationMin), athlete });
}

/** The plan 5-2 admin routes (attendance, lessons, coaches) and the phase 4 routes the Prezență screens reuse. Same identity on every render. */
export function usePrezentaApi() {
  const client = useFetchClient();
  const ref = React.useRef(client);
  ref.current = client;
  const token = useAuth('PrezentaDownload', (state) => state.token) ?? null;
  const tokenRef = React.useRef(token);
  tokenRef.current = token;
  return React.useMemo(() => {
    const data = async <T>(p: Promise<unknown>): Promise<T> => ((await p) as Wrapped<T>).data.data;
    const action = async <T>(p: Promise<unknown>): Promise<ActionBody<T>> => ((await p) as { data: ActionBody<T> }).data;
    const get = <T>(url: string) => data<T>(ref.current.get(url));
    return {
      period: (from: string, to: string) => get<PeriodPage>(`${BASE}/attendance/period${query({ from, to })}`),
      grid: (from: string, to: string) => get<GridPage>(`${BASE}/attendance/grid${query({ from, to })}`),
      session: (q: SessionQuery) => get<SessionPanel>(`${BASE}/attendance/session${sessionQuery(q)}`),
      defaults: (groupId: string, date: string) => get<SessionDefaults>(`${BASE}/attendance/session/defaults${query({ group: groupId, date })}`),
      check: (body: NewSessionBody) => data<SessionCheck>(ref.current.post(`${BASE}/attendance/session/check`, body as Body)),
      save: (body: SessionSaveBody) => action<SessionSaved>(ref.current.put(`${BASE}/attendance/session`, body as unknown as Body)),
      groupMonth: (groupId: string, month: string) => get<GroupMonth>(`${BASE}/groups/${enc(groupId)}/attendance${query({ month })}`),
      lessons: (from: string, to: string) => get<PeriodLessonRow[]>(`${BASE}/lessons${query({ from, to })}`),
      lesson: (id: string) => get<LessonPanel>(`${BASE}/lessons/${enc(id)}`),
      lessonNew: (athleteId: string, date: string) => get<{ coachIds: string[] }>(`${BASE}/lessons/new${query({ athlete: athleteId, date })}`),
      createLesson: (body: Body) => action<LessonSaved>(ref.current.post(`${BASE}/lessons`, body)),
      saveLesson: (id: string, body: Body) => action<LessonSaved>(ref.current.put(`${BASE}/lessons/${enc(id)}`, body)),
      deleteLesson: (id: string) => action<{ deleted: true; toast: string }>(ref.current.del(`${BASE}/lessons/${enc(id)}`)),
      coaches: (from: string, to: string) => get<CoachRow[]>(`${BASE}/attendance/coaches${query({ from, to })}`),
      coachesCsv: (from: string, to: string) =>
        downloadGet(tokenRef.current, `${BASE}/attendance/coaches.csv${query({ from, to })}`, coachesCsvName(from, to), strapiDownload()),
      coachPage: (id: string, from: string, to: string) => get<CoachPage>(`${BASE}/coaches/${enc(id)}/presence${query({ from, to })}`),
      coachCsv: (id: string, from: string, to: string) =>
        downloadGet(tokenRef.current, `${BASE}/coaches/${enc(id)}/presence.csv${query({ from, to })}`, `antrenor-${from}-${to}.csv`, strapiDownload()),
      options: () => get<GroupOptions>(`${BASE}/groups/options`),
      undo: (actionId: string) => data<{ undone: true }>(getFetchClient().post(`${BASE}/undo`, { actionId })),
      search: searchUrl,
    };
  }, []);
}

export type PrezentaApi = ReturnType<typeof usePrezentaApi>;
