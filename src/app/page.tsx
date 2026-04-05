"use client";

import { useState, useEffect } from "react";
import {
  DEFAULT_EVENT,
  DEFAULT_PEOPLE,
  DEFAULT_BARS,
  DEFAULT_NOTES,
  TEAMS,
  loadPeople,
  loadBars,
  loadNotes,
  getAddress,
  getTime,
  getMission,
  getExtraFields,
} from "@/lib/data";
import type { Person, BarStop } from "@/lib/data";
import { useFirebase, uploadPhoto, isFirebaseActive } from "@/lib/firebase";

/* ================================================================== */
/*  TYPES  (race-specific — not shared)                                */
/* ================================================================== */

interface BarProgress {
  missionPhotos: string[];
  receiptPhotos: string[];
  departed: boolean;
}

type TeamId = "team1" | "team2";
type Phase = "setup" | "race";
type Assignments = Record<string, TeamId | null>;
type AllProgress = Record<TeamId, Record<string, BarProgress>>;

/* ================================================================== */
/*  HELPERS                                                            */
/* ================================================================== */

function initProgress(bars: BarStop[]): AllProgress {
  const blank = () =>
    Object.fromEntries(
      bars.map((b) => [
        b.id,
        { missionPhotos: [], receiptPhotos: [], departed: false },
      ])
    ) as Record<string, BarProgress>;
  return { team1: blank(), team2: blank() };
}

function countDone(tp: Record<string, BarProgress> | undefined) {
  if (!tp) return 0;
  return Object.values(tp).filter((p) => p?.departed).length;
}

/** Returns the id of the first non-departed bar, or "__done__" if all complete. */
function firstOpenBar(
  bars: BarStop[],
  tp: Record<string, BarProgress> | undefined
): string {
  if (!tp) return bars[0]?.id ?? "__done__";
  for (const b of bars) {
    if (!tp[b.id]?.departed) return b.id;
  }
  return "__done__";
}

/* ================================================================== */
/*  HEADER                                                             */
/* ================================================================== */

function Header() {
  return (
    <header className="text-center pt-10 pb-5 px-5">
      <p className="text-4xl mb-1">{"\uD83C\uDF82"}</p>
      <h1 className="text-2xl font-bold text-white tracking-tight">
        {DEFAULT_EVENT.title}
      </h1>
      <p className="text-pink-400 font-semibold text-sm mt-1">
        {DEFAULT_EVENT.subtitle}
      </p>
      <div className="mt-2 flex items-center justify-center gap-2 text-pink-200/60 text-xs">
        <span>{DEFAULT_EVENT.date}</span>
        <span className="text-pink-400">{"\u00B7"}</span>
        <span>{DEFAULT_EVENT.startTime}</span>
      </div>
    </header>
  );
}

/* ================================================================== */
/*  TEAM SETUP  (drag-and-drop + tap-to-assign)                        */
/* ================================================================== */

function TeamSetup({
  people,
  assignments,
  onChange,
  onStart,
}: {
  people: Person[];
  assignments: Assignments;
  onChange: (a: Assignments) => void;
  onStart: () => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);

  const assign = (pid: string, team: TeamId | null) =>
    onChange({ ...assignments, [pid]: team });

  const unassigned = people.filter((p) => !assignments[p.id]);
  const team1Members = people.filter((p) => assignments[p.id] === "team1");
  const team2Members = people.filter((p) => assignments[p.id] === "team2");
  const ready = team1Members.length >= 1 && team2Members.length >= 1;

  const onDragOver = (e: React.DragEvent) => e.preventDefault();
  const onDrop = (team: TeamId | null) => {
    if (dragId) {
      assign(dragId, team);
      setDragId(null);
    }
  };

  const Chip = ({ p, removable }: { p: Person; removable?: boolean }) => {
    const isSelected = selected === p.id;
    return (
      <div
        draggable
        onDragStart={() => setDragId(p.id)}
        onDragEnd={() => setDragId(null)}
        onClick={(e) => {
          e.stopPropagation();
          setSelected(isSelected ? null : p.id);
        }}
        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium cursor-grab active:cursor-grabbing select-none transition-all border-2 ${
          isSelected
            ? "border-pink-400 bg-pink-500/20 text-white ring-2 ring-pink-400/30 scale-105"
            : "border-transparent bg-white/10 text-white/80 hover:bg-white/15"
        }`}
      >
        {p.name}
        {removable && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              assign(p.id, null);
              if (selected === p.id) setSelected(null);
            }}
            className="text-white/30 hover:text-white/70 text-xs leading-none ml-0.5"
          >
            {"\u00D7"}
          </button>
        )}
      </div>
    );
  };

  const Zone = ({
    teamId,
    members,
  }: {
    teamId: TeamId;
    members: Person[];
  }) => (
    <div
      onClick={() => {
        if (selected) {
          assign(selected, teamId);
          setSelected(null);
        }
      }}
      onDragOver={onDragOver}
      onDrop={() => onDrop(teamId)}
      className={`flex-1 rounded-2xl border-2 border-dashed p-3 min-h-[90px] transition-all ${
        selected ? "ring-1 ring-white/20" : ""
      }`}
      style={{
        borderColor: TEAMS[teamId].color + "40",
        backgroundColor: TEAMS[teamId].color + "08",
      }}
    >
      <p
        className="text-[11px] font-bold uppercase tracking-wider mb-2"
        style={{ color: TEAMS[teamId].color }}
      >
        {TEAMS[teamId].emoji} {TEAMS[teamId].name} ({members.length})
      </p>
      <div className="flex flex-wrap gap-1.5">
        {members.map((p) => (
          <Chip key={p.id} p={p} removable />
        ))}
        {members.length === 0 && (
          <p className="text-white/20 text-xs">
            {selected ? "Tap here to assign" : "Tap a name, then tap here"}
          </p>
        )}
      </div>
    </div>
  );

  return (
    <section className="px-5 pb-6">
      <p className="text-white/40 text-[11px] font-medium uppercase tracking-wider mb-3">
        Build your teams — tap a name, then tap a team
      </p>

      <div
        onDragOver={onDragOver}
        onDrop={() => onDrop(null)}
        className="bg-white/[0.04] border border-white/10 rounded-2xl p-3 mb-3 min-h-[52px]"
      >
        {unassigned.length === 0 ? (
          <p className="text-white/25 text-xs text-center py-1">
            Everyone&apos;s assigned! {"\uD83C\uDF89"}
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {unassigned.map((p) => (
              <Chip key={p.id} p={p} />
            ))}
          </div>
        )}
      </div>

      <div className="flex gap-3 mb-5">
        <Zone teamId="team1" members={team1Members} />
        <Zone teamId="team2" members={team2Members} />
      </div>

      <button
        disabled={!ready}
        onClick={onStart}
        className={`w-full py-3.5 rounded-full font-bold text-sm uppercase tracking-wider transition-all ${
          ready
            ? "bg-pink-500 text-white shadow-lg shadow-pink-500/25 hover:bg-pink-400 active:scale-[0.98]"
            : "bg-white/10 text-white/25 cursor-not-allowed"
        }`}
      >
        {ready
          ? "\uD83C\uDFC1 Start the Race!"
          : "Assign at least 1 per team"}
      </button>
    </section>
  );
}

/* ================================================================== */
/*  RACE PROGRESS HEADER                                               */
/* ================================================================== */

function RaceHeader({
  progress,
  totalBars,
}: {
  progress: AllProgress;
  totalBars: number;
}) {
  const t1 = countDone(progress?.team1);
  const t2 = countDone(progress?.team2);
  const total = totalBars;
  const winner =
    t1 === total || t2 === total
      ? t1 === total && t2 === total
        ? "TIE"
        : t1 === total
        ? "team1"
        : "team2"
      : null;

  return (
    <div className="mx-5 mb-4 bg-white/[0.06] border border-white/10 rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[11px] font-bold uppercase tracking-wider text-white/50">
          Race Progress
        </p>
        {winner && (
          <span className="bg-pink-500 text-white text-[10px] font-bold px-2.5 py-0.5 rounded-full animate-bounce">
            {"\uD83C\uDF89"}{" "}
            {winner === "TIE"
              ? "It\u2019s a tie!"
              : `${TEAMS[winner as TeamId].name} wins!`}
          </span>
        )}
      </div>
      {(["team1", "team2"] as TeamId[]).map((tid) => {
        const done = tid === "team1" ? t1 : t2;
        return (
          <div key={tid} className="mb-2.5 last:mb-0">
            <div className="flex items-center justify-between text-xs mb-1">
              <span
                style={{ color: TEAMS[tid].color }}
                className="font-semibold"
              >
                {TEAMS[tid].emoji} {TEAMS[tid].name}
              </span>
              <span className="text-white/40">
                {done}/{total}
              </span>
            </div>
            <div className="h-2 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${(done / total) * 100}%`,
                  backgroundColor: TEAMS[tid].color,
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ================================================================== */
/*  BAR MISSION CARD                                                   */
/* ================================================================== */

function BarCard({
  bar,
  idx,
  bp,
  isCurrent,
  isUpcoming,
  teamId,
  onMission,
  onReceipt,
  onDepart,
}: {
  bar: BarStop;
  idx: number;
  bp: BarProgress;
  isCurrent: boolean;
  isUpcoming: boolean;
  teamId: TeamId;
  onMission: (f: FileList) => void;
  onReceipt: (f: FileList) => void;
  onDepart: () => void;
}) {
  /* Firebase drops empty arrays, so defensively default them */
  const photos = bp.missionPhotos ?? [];
  const receipts = bp.receiptPhotos ?? [];
  const done = bp.departed;
  const canLeave = photos.length > 0;

  /* Extract well-known fields */
  const address = getAddress(bar);
  const time = getTime(bar);
  const mission = getMission(bar);
  const extras = getExtraFields(bar);

  const mapUrl = address
    ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
        address + ", New York, NY"
      )}`
    : null;

  /* Subtitle line: address · ~time (either or both may be absent) */
  const subtitle = [address, time ? `~${time}` : null]
    .filter(Boolean)
    .join(" \u00B7 ");

  /* Upcoming bars — collapsed */
  if (isUpcoming) {
    return (
      <div className="flex items-center gap-3 rounded-xl px-4 py-3 mb-2 bg-white/[0.03] border border-white/[0.05] opacity-40">
        <span className="text-base">{bar.icon}</span>
        <span className="text-white/50 text-sm font-medium flex-1">
          {bar.name}
        </span>
        {time && (
          <span className="text-white/20 text-[11px]">~{time}</span>
        )}
      </div>
    );
  }

  return (
    <div
      className={`rounded-2xl p-4 mb-3 border transition-all ${
        isCurrent
          ? "bg-white/[0.09] border-pink-500/30 shadow-lg shadow-pink-500/5"
          : "bg-white/[0.04] border-white/[0.06] opacity-50"
      }`}
    >
      {/* ---- header row ---- */}
      <div className="flex items-start justify-between mb-2">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-lg">{bar.icon}</span>
            <h3 className="text-white font-semibold text-[15px]">
              {bar.name}
            </h3>
            {done && (
              <span className="text-green-400 text-xs font-bold">
                {"\u2713"}
              </span>
            )}
            {isCurrent && (
              <span
                className="text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full animate-shimmer"
                style={{
                  backgroundColor: TEAMS[teamId].color,
                  color: "#fff",
                }}
              >
                NOW
              </span>
            )}
          </div>
          {subtitle && (
            <p className="text-white/35 text-xs mt-0.5">{subtitle}</p>
          )}
        </div>
        <span className="text-xl font-bold text-white/[0.07] shrink-0">
          {idx + 1}
        </span>
      </div>

      {/* ---- mission box (if a "Mission" field exists) ---- */}
      {mission && (
        <div className="bg-pink-500/10 border border-pink-500/15 rounded-xl p-3 mb-3">
          <p className="text-pink-300/80 text-[10px] font-bold uppercase tracking-widest mb-1">
            Mission
          </p>
          <p className="text-white/75 text-[13px] leading-relaxed">
            {mission}
          </p>
        </div>
      )}

      {/* ---- extra custom fields ---- */}
      {extras.length > 0 && (
        <div className="space-y-1 mb-3">
          {extras.map((f) => (
            <p key={f.id} className="text-white/60 text-[13px]">
              <span className="text-white/30 text-[11px] font-semibold uppercase tracking-wider">
                {f.label}:
              </span>{" "}
              {f.value}
            </p>
          ))}
        </div>
      )}

      {/* ---- active bar controls ---- */}
      {!done && (
        <>
          <div className="flex gap-2 mb-3">
            <label className="flex-1 flex items-center justify-center gap-1 bg-pink-500/15 hover:bg-pink-500/25 text-pink-300 text-[11px] font-semibold py-2.5 rounded-xl cursor-pointer transition-colors">
              <input
                type="file"
                accept="image/*"
                className="hidden"
                multiple
                onChange={(e) => {
                  if (e.target.files?.length) {
                    onMission(e.target.files);
                    e.target.value = "";
                  }
                }}
              />
              {"\uD83D\uDCF8"} Mission
              {photos.length > 0 &&
                ` (${photos.length})`}
            </label>
            <label className="flex-1 flex items-center justify-center gap-1 bg-white/[0.07] hover:bg-white/[0.12] text-white/50 text-[11px] font-semibold py-2.5 rounded-xl cursor-pointer transition-colors">
              <input
                type="file"
                accept="image/*"
                className="hidden"
                multiple
                onChange={(e) => {
                  if (e.target.files?.length) {
                    onReceipt(e.target.files);
                    e.target.value = "";
                  }
                }}
              />
              {"\uD83E\uDDFE"} Receipt
              {receipts.length > 0 &&
                ` (${receipts.length})`}
            </label>
          </div>

          {(photos.length > 0 || receipts.length > 0) && (
            <div className="flex gap-1.5 mb-3 overflow-x-auto pb-1 -mx-1 px-1">
              {photos.map((u, i) => (
                <img
                  key={`m${i}`}
                  src={u}
                  className="w-14 h-14 rounded-lg object-cover border-2 border-pink-500/30 shrink-0"
                  alt="mission proof"
                />
              ))}
              {receipts.map((u, i) => (
                <img
                  key={`r${i}`}
                  src={u}
                  className="w-14 h-14 rounded-lg object-cover border border-white/15 shrink-0"
                  alt="receipt"
                />
              ))}
            </div>
          )}

          <div className="flex gap-2">
            {mapUrl && (
              <a
                href={mapUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 flex items-center justify-center gap-1 bg-white/[0.07] hover:bg-white/[0.12] text-white/50 text-[11px] font-semibold py-2.5 rounded-xl transition-colors"
              >
                {"\uD83D\uDCCD"} Directions
              </a>
            )}
            <button
              onClick={onDepart}
              disabled={!canLeave}
              className={`flex-1 py-2.5 rounded-xl text-[11px] font-bold uppercase tracking-wider transition-all ${
                canLeave
                  ? "bg-pink-500 text-white shadow-md shadow-pink-500/20 hover:bg-pink-400 active:scale-[0.97]"
                  : "bg-white/[0.05] text-white/20 cursor-not-allowed"
              }`}
            >
              {canLeave ? "\u2713 Left this bar" : "Upload photo first"}
            </button>
          </div>
        </>
      )}

      {done && photos.length > 0 && (
        <div className="flex gap-1.5 mt-1 overflow-x-auto pb-1">
          {photos.map((u, i) => (
            <img
              key={i}
              src={u}
              className="w-10 h-10 rounded-lg object-cover border border-white/10 shrink-0"
              alt="mission proof"
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ================================================================== */
/*  NOTES                                                              */
/* ================================================================== */

function NotesSection({ notes }: { notes: string[] }) {
  return (
    <section className="mx-5 mt-6 mb-8 bg-white/[0.05] border border-white/[0.08] rounded-2xl p-4">
      <h2 className="text-white/70 font-semibold text-xs uppercase tracking-wider mb-2">
        {"\uD83D\uDCCC"} Notes
      </h2>
      <ul className="space-y-1">
        {notes.map((n, i) => (
          <li key={i} className="text-white/40 text-xs leading-relaxed">
            {n}
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ================================================================== */
/*  MAIN PAGE                                                          */
/* ================================================================== */

export default function Home() {
  const live = isFirebaseActive();

  /* ---- Config: Firebase if available, else localStorage ---- */
  const [fbPeople, setFbPeople] = useFirebase<Person[]>("config/people", DEFAULT_PEOPLE);
  const [fbBars, setFbBars] = useFirebase<BarStop[]>("config/bars", DEFAULT_BARS);
  const [fbNotes] = useFirebase<string[]>("config/notes", DEFAULT_NOTES);

  /* Offline fallback state */
  const [localPeople, setLocalPeople] = useState<Person[]>(DEFAULT_PEOPLE);
  const [localBars, setLocalBars] = useState<BarStop[]>(DEFAULT_BARS);
  const [localNotes, setLocalNotes] = useState<string[]>(DEFAULT_NOTES);

  useEffect(() => {
    if (!live) {
      setLocalPeople(loadPeople());
      setLocalBars(loadBars());
      setLocalNotes(loadNotes());
    }
  }, [live]);

  const people = live ? fbPeople : localPeople;
  const bars = live ? fbBars : localBars;
  const notes = live ? fbNotes : localNotes;

  /* ---- Race state: Firebase if available, else local ---- */
  const [fbPhase, setFbPhase] = useFirebase<Phase>("race/phase", "setup");
  const [fbAssignments, setFbAssignments] = useFirebase<Assignments>("race/assignments", {});
  const [fbProgress, setFbProgress] = useFirebase<AllProgress>("race/progress", initProgress(bars));

  const [localPhase, setLocalPhase] = useState<Phase>("setup");
  const [localAssignments, setLocalAssignments] = useState<Assignments>({});
  const [localProgress, setLocalProgress] = useState<AllProgress>(initProgress(bars));

  const phase = live ? fbPhase : localPhase;
  const setPhase = live ? setFbPhase : setLocalPhase;
  const assignments = live ? fbAssignments : localAssignments;
  const setAssignments = live ? setFbAssignments : setLocalAssignments;
  const progress = live ? fbProgress : localProgress;
  const setProgress = live ? setFbProgress : setLocalProgress;

  const [tab, setTab] = useState<TeamId>("team1");
  const [uploading, setUploading] = useState(false);

  /* Re-init progress when bars change (offline only) */
  useEffect(() => {
    if (!live) setLocalProgress(initProgress(bars));
  }, [bars, live]);

  /* ---- Handlers ---- */
  const upload = async (
    team: TeamId,
    barId: string,
    type: "mission" | "receipt",
    files: FileList
  ) => {
    setUploading(true);
    try {
      const urls: string[] = [];
      for (const file of Array.from(files)) {
        const url = await uploadPhoto(file, `photos/${team}/${barId}/${type}`);
        urls.push(url);
      }
      setProgress((prev) => {
        const tp = { ...prev[team] };
        const bp = { ...tp[barId] };
        const key = type === "mission" ? "missionPhotos" : "receiptPhotos";
        bp[key] = [...(bp[key] || []), ...urls];
        tp[barId] = bp;
        return { ...prev, [team]: tp };
      });
    } finally {
      setUploading(false);
    }
  };

  const depart = (team: TeamId, barId: string) => {
    setProgress((prev) => {
      const tp = { ...prev[team] };
      tp[barId] = { ...tp[barId], departed: true };
      return { ...prev, [team]: tp };
    });
  };

  return (
    <div className="max-w-lg mx-auto pb-10">
      <Header />

      {phase === "setup" && (
        <TeamSetup
          people={people}
          assignments={assignments}
          onChange={setAssignments}
          onStart={() => setPhase("race")}
        />
      )}

      {phase === "race" && (
        <>
          <RaceHeader progress={progress} totalBars={bars.length} />

          <div className="flex mx-5 mb-4 bg-white/[0.05] rounded-full p-1">
            {(["team1", "team2"] as TeamId[]).map((tid) => (
              <button
                key={tid}
                onClick={() => setTab(tid)}
                className={`flex-1 py-2 rounded-full text-[11px] font-bold uppercase tracking-wider transition-all ${
                  tab === tid ? "text-white shadow-md" : "text-white/35"
                }`}
                style={
                  tab === tid
                    ? { backgroundColor: TEAMS[tid].color }
                    : {}
                }
              >
                {TEAMS[tid].emoji} {TEAMS[tid].name} (
                {countDone(progress?.[tid])}/{bars.length})
              </button>
            ))}
          </div>

          <section className="px-5">
            {(() => {
              /* Team 1 follows the saved order; Team 2 goes in reverse */
              const teamBars =
                tab === "team2" ? [...bars].reverse() : bars;
              const teamProgress = progress?.[tab] ?? {};
              const curId = firstOpenBar(teamBars, teamProgress);
              const curIdx = teamBars.findIndex((b) => b.id === curId);
              return teamBars.map((bar, i) => (
                <BarCard
                  key={bar.id}
                  bar={bar}
                  idx={i}
                  bp={teamProgress[bar.id] ?? { missionPhotos: [], receiptPhotos: [], departed: false }}
                  isCurrent={bar.id === curId}
                  isUpcoming={i > curIdx && curId !== "__done__"}
                  teamId={tab}
                  onMission={(f) => upload(tab, bar.id, "mission", f)}
                  onReceipt={(f) => upload(tab, bar.id, "receipt", f)}
                  onDepart={() => depart(tab, bar.id)}
                />
              ));
            })()}
          </section>

          <button
            onClick={() => setPhase("setup")}
            className="block mx-auto mt-4 text-white/20 hover:text-white/40 text-xs transition-colors"
          >
            {"\u2190"} Edit teams
          </button>
        </>
      )}

      <NotesSection notes={notes} />

      {/* Upload indicator */}
      {uploading && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 bg-pink-500 text-white text-xs font-bold px-4 py-2 rounded-full shadow-lg z-50 animate-pulse">
          Uploading...
        </div>
      )}

      {/* Firebase status */}
      {live && (
        <div className="text-center mb-2">
          <span className="text-green-400/40 text-[10px]">{"\u25CF"} Live sync on</span>
        </div>
      )}

      <footer className="text-center text-white/15 text-[11px] pb-6">
        Made with {"\uD83D\uDC96"} for {DEFAULT_EVENT.star}&apos;s birthday
      </footer>
    </div>
  );
}
