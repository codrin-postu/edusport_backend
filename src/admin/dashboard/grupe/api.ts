import * as React from 'react';
import { getFetchClient, useFetchClient } from '@strapi/admin/strapi-admin';
import type { Occurrence } from '../../../api/calendar-event/services/expand';
import type { AthleteCard, HistoryLine } from '../../../club/athletes/api-types';
import type {
  ActionBody, AllocateResult, GroupListPage, GroupOptions, GroupPage, JoinResult, MoveResult, NamedRef, UnassignedPage,
} from '../../../club/groups/api-types';
import type { GroupProgram } from '../../../club/groups/program-read';
import { searchUrl } from '../../../club/sportivi/search-view';

const BASE = '/api/club';
const enc = encodeURIComponent;
type Body = Record<string, unknown>;
type Wrapped<T> = { data: { data: T } };
export type DateAnswer = { mode: 'keep' | 'cancel' | 'move'; date: string; emails: number };

function query(values: Record<string, string | null>): string {
  const s = new URLSearchParams(Object.entries(values).filter((e): e is [string, string] => !!e[1])).toString();
  return s ? `?${s}` : '';
}

/** The plan 4-1 / 4-2 admin routes. Same identity on every render (the fetch client's is not). */
export function useGrupeApi() {
  const client = useFetchClient();
  const ref = React.useRef(client);
  ref.current = client;
  return React.useMemo(() => {
    const data = async <T>(p: Promise<unknown>): Promise<T> => ((await p) as Wrapped<T>).data.data;
    const action = async <T>(p: Promise<unknown>): Promise<ActionBody<T>> => ((await p) as { data: ActionBody<T> }).data;
    const get = <T>(url: string) => data<T>(ref.current.get(url));
    const g = (id: string) => `${BASE}/groups/${enc(id)}`;
    const p = (id: string) => `${BASE}/program/${enc(id)}`;
    return {
      list: (season: string | null, section: string | null) => get<GroupListPage>(`${BASE}/groups${query({ season, section })}`),
      unassigned: (season: string | null) => get<UnassignedPage>(`${BASE}/groups/unassigned${query({ season })}`),
      options: () => get<GroupOptions>(`${BASE}/groups/options`),
      page: (id: string, season: string | null) => get<GroupPage>(`${g(id)}${query({ season })}`),
      history: (id: string) => get<HistoryLine[]>(`${g(id)}/history`),
      create: (body: Body) => data<NamedRef>(ref.current.post(`${BASE}/groups`, body)),
      update: (id: string, body: Body) => data<{ changed: boolean }>(ref.current.put(g(id), body)),
      remove: (id: string) => data<{ name: string }>(ref.current.del(g(id))),
      join: (id: string, body: Body) => action<JoinResult>(ref.current.post(`${g(id)}/members`, body)),
      allocate: (body: Body) => action<AllocateResult>(ref.current.post(`${BASE}/memberships/allocate`, body)),
      move: (membershipId: string, toGroupId: string) => action<MoveResult>(ref.current.post(`${BASE}/memberships/${enc(membershipId)}/move`, { toGroupId })),
      removeMember: (membershipId: string) => action<MoveResult>(ref.current.del(`${BASE}/memberships/${enc(membershipId)}`)),
      copyMembers: (id: string, season: string) => action<{ copied: number; from: string }>(ref.current.post(`${g(id)}/copy-members`, { season })),
      copyProgram: (id: string, season: string) => action<{ series: number; from: string }>(ref.current.post(`${g(id)}/copy-program`, { season })),
      undo: (actionId: string) => data<{ undone: true }>(getFetchClient().post(`${BASE}/undo`, { actionId })),
      program: (id: string, season: string | null) => get<GroupProgram>(`${g(id)}/program${query({ season })}`),
      occurrences: (id: string, from: string, to: string) => get<Occurrence[]>(`${BASE}/calendar/occurrences${query({ from, to, group: id })}`),
      addProgram: (id: string, body: Body) => action<{ eventId: string; date: string | null }>(ref.current.post(`${g(id)}/program`, body)),
      changeProgram: (eventId: string, body: Body) => action<{ eventId: string }>(ref.current.put(p(eventId), body)),
      endProgram: (eventId: string, from: string) => action<{ eventId: string }>(ref.current.post(`${p(eventId)}/end`, { from })),
      deleteClass: (eventId: string) => action<{ date: string }>(ref.current.del(p(eventId))),
      setDate: (eventId: string, date: string, body: Body) => action<DateAnswer>(ref.current.put(`${p(eventId)}/dates/${enc(date)}`, body)),
      searchAthletes: (q: string) => get<AthleteCard[]>(searchUrl(q)),
    };
  }, []);
}

export type GrupeApi = ReturnType<typeof useGrupeApi>;
