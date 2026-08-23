import * as React from 'react';
import { useField, useForm } from '@strapi/admin/strapi-admin';

interface Props {
  name: string;
  attribute: Record<string, unknown>;
}

function getByPath(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc == null || typeof acc !== 'object') return undefined;
    const idx = parseInt(key, 10);
    return isNaN(idx)
      ? (acc as Record<string, unknown>)[key]
      : (acc as unknown[])[idx];
  }, obj);
}

export default function AthleteNameSync({ name }: Props) {
  const field = useField<string>(name);
  const values = useForm('AthleteNameSync', (state) => state.values);

  // "participants.0.athleteName" → "participants.0.sportsperson"
  const siblingPath = name.replace(/\.athleteName$/, '.sportsperson');
  const sp = getByPath(values as Record<string, unknown>, siblingPath) as any;

  // Handle both shapes: freshly selected ({connect:[{name}]}) and server-loaded ({name})
  const resolvedName: string | undefined =
    sp?.connect?.[0]?.name ?? sp?.name ?? undefined;

  React.useEffect(() => {
    if (resolvedName !== undefined && resolvedName !== field.value) {
      field.onChange(name, resolvedName);
    } else if (resolvedName === undefined && field.value) {
      field.onChange(name, '');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedName]);

  return null;
}
