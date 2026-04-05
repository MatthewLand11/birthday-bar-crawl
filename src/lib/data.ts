/* ================================================================== */
/*  Shared types, default data, localStorage helpers, field utilities  */
/*  Both /  and /admin  import from this file.                         */
/* ================================================================== */

/* ---- Types ---- */

export interface BarField {
  id: string;
  label: string;
  value: string;
}

export interface BarStop {
  id: string;
  name: string;
  icon: string;
  fields: BarField[];
}

export interface Person {
  id: string;
  name: string;
}

/* ---- Default data ---- */

export const DEFAULT_EVENT = {
  title: "Beck\u2019s Birthday Bar Crawl",
  subtitle: "FiDi Race Edition \uD83C\uDFC1",
  date: "Saturday, July 11, 2026",
  startTime: "1:30 PM ET",
  star: "Beck",
};

export const DEFAULT_PEOPLE: Person[] = [
  { id: "1", name: "Beck" },
  { id: "2", name: "Alex" },
  { id: "3", name: "Jordan" },
  { id: "4", name: "Sam" },
  { id: "5", name: "Riley" },
  { id: "6", name: "Casey" },
  { id: "7", name: "Morgan" },
  { id: "8", name: "Taylor" },
  { id: "9", name: "Drew" },
  { id: "10", name: "Jamie" },
];

/*
 * Bars in walking-proximity order through FiDi.
 * Each bar's details live in a flexible `fields` array so the host
 * can add, remove, or rename fields from the admin page.
 */
export const DEFAULT_BARS: BarStop[] = [
  {
    id: "bar-1",
    name: "Lawn Club",
    icon: "\u26F3",
    fields: [
      { id: "bar-1-addr", label: "Address", value: "250 Vesey St, Brookfield Place" },
      { id: "bar-1-time", label: "Time", value: "1:30 PM" },
      { id: "bar-1-miss", label: "Mission", value: "Play putting pool \u2014 at least one person must sink 3 shots in a row." },
    ],
  },
  {
    id: "bar-2",
    name: "Clinton Hall",
    icon: "\uD83E\uDD4A",
    fields: [
      { id: "bar-2-addr", label: "Address", value: "90 Washington St" },
      { id: "bar-2-time", label: "Time", value: "2:15 PM" },
      { id: "bar-2-miss", label: "Mission", value: "One person must beat 500 on the punching machine AND another must beat 750." },
    ],
  },
  {
    id: "bar-3",
    name: "Stout FiDi",
    icon: "\uD83C\uDF7A",
    fields: [
      { id: "bar-3-addr", label: "Address", value: "133 William St" },
      { id: "bar-3-time", label: "Time", value: "3:00 PM" },
      { id: "bar-3-miss", label: "Mission", value: "Split the G \u2014 max 2 beers per person. Whole team participates." },
    ],
  },
  {
    id: "bar-4",
    name: "Blarney Stone",
    icon: "\uD83C\uDFAF",
    fields: [
      { id: "bar-4-addr", label: "Address", value: "1 Fulton St" },
      { id: "bar-4-time", label: "Time", value: "3:45 PM" },
      { id: "bar-4-miss", label: "Mission", value: "At least one person must hit a bullseye in darts \u2014 green or red counts." },
    ],
  },
  {
    id: "bar-5",
    name: "The Beekman",
    icon: "\uD83D\uDCF8",
    fields: [
      { id: "bar-5-addr", label: "Address", value: "5 Beekman St" },
      { id: "bar-5-time", label: "Time", value: "4:30 PM" },
      { id: "bar-5-miss", label: "Mission", value: "Majority of team must take a photo-booth pic and keep the strip." },
    ],
  },
  {
    id: "bar-6",
    name: "Recreation Bar",
    icon: "\uD83C\uDFC0",
    fields: [
      { id: "bar-6-addr", label: "Address", value: "160 Water St" },
      { id: "bar-6-time", label: "Time", value: "5:15 PM" },
      { id: "bar-6-miss", label: "Mission", value: "One person makes a free throw AND another person makes a 3-pointer." },
    ],
  },
  {
    id: "bar-7",
    name: "Fish Market",
    icon: "\uD83D\uDC1F",
    fields: [
      { id: "bar-7-addr", label: "Address", value: "111 South St, Seaport" },
      { id: "bar-7-time", label: "Time", value: "6:00 PM" },
      { id: "bar-7-miss", label: "Mission", value: "At least 2 team members take a shot of any kind with the bartender." },
    ],
  },
  {
    id: "bar-8",
    name: "Barcade",
    icon: "\uD83D\uDD79\uFE0F",
    fields: [
      { id: "bar-8-addr", label: "Address", value: "148 W 24th St" },
      { id: "bar-8-time", label: "Time", value: "7:00 PM" },
      { id: "bar-8-miss", label: "Mission", value: "At least 2 team members must beat 60/100 on the Quick Draw shooting game in the back." },
    ],
  },
];

export const TEAMS = {
  team1: { name: "Team 1", color: "#ec4899", emoji: "\uD83D\uDC96" },
  team2: { name: "Team 2", color: "#a855f7", emoji: "\uD83D\uDC9C" },
};

export const DEFAULT_NOTES: string[] = [
  "\uD83D\uDCF8 Upload mission proof before leaving each bar",
  "\uD83E\uDDFE Snap receipts to split costs later",
  "\uD83C\uDFC1 First team to finish all 8 bars wins!",
  "\uD83D\uDCB8 Venmo @beck-bday for the group tab",
];

/* ================================================================== */
/*  Field-extraction helpers                                           */
/*  These let the main page find well-known fields by label while      */
/*  keeping the data model fully flexible.                             */
/* ================================================================== */

/** Find the first field whose label contains `substr` (case-insensitive). */
export function getField(bar: BarStop, substr: string): string | undefined {
  const lc = substr.toLowerCase();
  return bar.fields.find((f) => f.label.toLowerCase().includes(lc))?.value;
}

export function getAddress(bar: BarStop) {
  return getField(bar, "address");
}
export function getTime(bar: BarStop) {
  return getField(bar, "time");
}
export function getMission(bar: BarStop) {
  return getField(bar, "mission");
}

/** Return all fields that are NOT address, time, or mission. */
export function getExtraFields(bar: BarStop): BarField[] {
  const known = ["address", "time", "mission"];
  return bar.fields.filter(
    (f) => !known.some((k) => f.label.toLowerCase().includes(k))
  );
}

/* ================================================================== */
/*  localStorage helpers (with old-format migration)                   */
/* ================================================================== */

const KEYS = {
  people: "bbc-people",
  bars: "bbc-bars",
  notes: "bbc-notes",
} as const;

function safeLoad<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function safeSave(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify(value));
}

/* ---- Old-format migration ---- */

interface OldBarStop {
  id: number;
  name: string;
  address: string;
  time: string;
  mission: string;
  icon: string;
}

function isOldFormat(bar: unknown): bar is OldBarStop {
  return (
    typeof bar === "object" &&
    bar !== null &&
    "address" in bar &&
    typeof (bar as OldBarStop).address === "string" &&
    !("fields" in bar)
  );
}

function migrateBar(old: OldBarStop): BarStop {
  const sid = String(old.id);
  return {
    id: sid,
    name: old.name,
    icon: old.icon,
    fields: [
      { id: `${sid}-addr`, label: "Address", value: old.address },
      { id: `${sid}-time`, label: "Time", value: old.time },
      { id: `${sid}-miss`, label: "Mission", value: old.mission },
    ],
  };
}

/* ---- Public load/save functions ---- */

export function loadPeople(): Person[] {
  return safeLoad(KEYS.people, DEFAULT_PEOPLE);
}
export function savePeople(p: Person[]) {
  safeSave(KEYS.people, p);
}

export function loadBars(): BarStop[] {
  const raw = safeLoad<unknown[]>(KEYS.bars, []);
  if (raw.length === 0) return DEFAULT_BARS;

  // Migrate old format if needed
  if (isOldFormat(raw[0])) {
    const migrated = (raw as OldBarStop[]).map(migrateBar);
    safeSave(KEYS.bars, migrated); // persist the migration
    return migrated;
  }

  return raw as BarStop[];
}
export function saveBars(b: BarStop[]) {
  safeSave(KEYS.bars, b);
}

export function loadNotes(): string[] {
  return safeLoad(KEYS.notes, DEFAULT_NOTES);
}
export function saveNotes(n: string[]) {
  safeSave(KEYS.notes, n);
}

export function resetAll() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(KEYS.people);
  localStorage.removeItem(KEYS.bars);
  localStorage.removeItem(KEYS.notes);
}
