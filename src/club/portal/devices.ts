import { DEVICE_WORDS } from './copy';

const BROWSERS: ReadonlyArray<readonly [RegExp, string]> = [
  [/Edg\//, 'Edge'],
  [/Firefox\//, 'Firefox'],
  [/Chrome\//, 'Chrome'],
  [/Safari\//, 'Safari'],
];

const kindOf = (ua: string): string => {
  if (/iPad|Tablet/.test(ua)) return DEVICE_WORDS.tablet;
  if (/Mobi|Android|iPhone/.test(ua)) return DEVICE_WORDS.phone;
  return DEVICE_WORDS.computer;
};

const browserOf = (ua: string): string => BROWSERS.find(([re]) => re.test(ua))?.[1] ?? 'Browser';

export function deviceLabel(userAgent: string | null): string {
  if (!userAgent) return DEVICE_WORDS.unknown;
  return `${kindOf(userAgent)}, ${browserOf(userAgent)}`;
}
