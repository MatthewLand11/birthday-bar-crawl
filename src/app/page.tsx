"use client";

import { useState, useEffect } from "react";
import {
  DEFAULT_EVENT,
  DEFAULT_BARS,
  DEFAULT_NOTES,
  TEAMS,
  getAddress,
  getTime,
  getMission,
  getExtraFields,
} from "@/lib/data";
import type { Person, BarStop } from "@/lib/data";
import { useFirebase, uploadPhoto, joinBarCrawl } from "@/lib/firebase";

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

const LS_MY_ID = "bbc-my-id";

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
      <p className="text-4xl mb-1">{"🎂"}</p>
      <h1 className="text-2xl font-bold text-white tracking-tight">
        {DEFAULT_EVENT.title}
      </h1>
      <p className="text-pink-400 font-semibold text-sm mt-1">
        {DEFAULT_EVENT.subtitle}
      </p>
      <div className="mt-2 flex items-center justify-center gap-2 text-pink-200/60 text-xs">
        <span>{DEFAULT_EVENT.date}</span>
        <span className="text-pink-400">{"·"}</span>
        <span>{DEFAULT_EVENT.startTime}</span>
      </div>
    </header>
  );
}

/* ================================================================== */
/*  JOIN SCREEN                                                        */
/* ================================================================== */

function JoinScreen({
  onJoin,
  joinedCount,
  loading,
  error,
}: {
  onJoin: (name: string) => void;
  joinedCount: number;
  loading: boolean;
  error: string | null;
}) {
  const [name, setName] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onJoin(name);
  };

  return (
    <section className="px-5 pb-6">
      <div className="bg-white/[0.06] border border-white/10 rounded-2xl p-6 text-center">
        <p className="text-3xl mb-3">{"🎉"}</p>
        <h2 className="text-white font-bold text-lg mb-1">
          Join the Party!
        </h2>
        <p className="text-white/40 text-sm mb-5">
          Enter your name to get assigned to a team
        </p>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            className="w-full bg-white/[0.06] border border-white/10 rounded-xl px-4 py-3 text-white text-center text-base placeholder-white/20 focus:outline-none focus:border-pink-500/50 focus:ring-1 focus:ring-pink-500/30 transition-colors"
            disabled={loading}
            autoFocus
          />

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={loading || !name.trim()}
            className={`w-full py-3.5 rounded-full font-bold text-sm uppercase tracking-wider transition-all ${
              loading || !name.trim()
                ? "bg-white/10 text-white/25 cursor-not-allowed"
                : "bg-pink-500 text-white shadow-lg shadow-pink-500/25 hover:bg-pink-400 active:scale-[0.98]"
            }`}
          >
            {loading ? "Joining..." : "🍻 Join the Bar Crawl"}
          </button>
        </form>

        {joinedCount > 0 && (
          <p className="text-white/20 text-xs mt-4">
            {joinedCount} {joinedCount === 1 ? "person has" : "people have"}{" "}
            joined so far
          </p>
        )}
      </div>
    </section>
  );
}

/* ================================================================== */
/*  TEAM REVEAL  (confirmation after joining)                          */
/* ================================================================== */

function TeamReveal({
  person,
  teamId,
  teamMembers,
  raceActive,
}: {
  person: Person;
  teamId: TeamId;
  teamMembers: Person[];
  raceActive: boolean;
}) {
  const team = TEAMS[teamId];

  return (
    <section className="px-5 pb-6">
      <div
        className="rounded-2xl p-6 text-center border-2"
        style={{
          borderColor: team.color + "40",
          backgroundColor: team.color + "10",
        }}
      >
        <p className="text-5xl mb-3">{team.emoji}</p>
        <h2 className="text-white font-bold text-xl mb-1">
          {person.name}, you&apos;re on{" "}
          <span style={{ color: team.color }}>{team.name}</span>!
        </h2>
        <p className="text-white/40 text-sm mt-2">
          {raceActive
            ? "The race is on! Scroll down to see your progress."
            : "Hang tight — the race will start soon."}
        </p>

        {teamMembers.length > 1 && (
          <div className="mt-4 pt-4 border-t border-white/10">
            <p className="text-white/30 text-[11px] font-bold uppercase tracking-wider mb-2">
              Your teammates
            </p>
            <div className="flex flex-wrap justify-center gap-1.5">
              {teamMembers
                .filter((m) => m.id !== person.id)
                .map((m) => (
                  <span
                    key={m.id}
                    className="inline-block rounded-full px-3 py-1 text-xs font-medium bg-white/10 text-white/60"
                  >
                    {m.name}
                  </span>
                ))}
            </div>
          </div>
        )}
      </div>
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
            {"🎉"}{" "}
            {winner === "TIE"
              ? "It’s a tie!"
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
  onUndo,
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
  onUndo?: () => void;
}) {
  const photos = bp.missionPhotos ?? [];
  const receipts = bp.receiptPhotos ?? [];
  const done = bp.departed;
  const canLeave = photos.length > 0;

  const address = getAddress(bar);
  const time = getTime(bar);
  const mission = getMission(bar);
  const extras = getExtraFields(bar);

  const mapUrl = address
    ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
        address + ", New York, NY"
      )}`
    : null;

  const subtitle = [address, time ? `~${time}` : null]
    .filter(Boolean)
    .join(" · ");

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
      <div className="flex items-start justify-between mb-2">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-lg">{bar.icon}</span>
            <h3 className="text-white font-semibold text-[15px]">
              {bar.name}
            </h3>
            {done && (
              <span className="text-green-400 text-xs font-bold">
                {"✓"}
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
              {"📸"} Mission
              {photos.length > 0 && ` (${photos.length})`}
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
              {"🧾"} Receipt
              {receipts.length > 0 && ` (${receipts.length})`}
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
                {"📍"} Directions
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
              {canLeave ? "✓ Left this bar" : "Upload photo first"}
            </button>
          </div>
        </>
      )}

      {done && (
        <div className="flex items-center gap-2 mt-2">
          {photos.length > 0 && (
            <div className="flex gap-1.5 overflow-x-auto pb-1 flex-1">
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
          {onUndo && (
            <button
              onClick={onUndo}
              className="text-white/20 hover:text-white/50 text-[10px] font-medium shrink-0 transition-colors"
            >
              Undo
            </button>
          )}
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
        {"📌"} Notes
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
  /* ---- Firebase is the source of truth ---- */
  const [people] = useFirebase<Person[]>("config/people", []);
  const [bars] = useFirebase<BarStop[]>("config/bars", DEFAULT_BARS);
  const [notes] = useFirebase<string[]>("config/notes", DEFAULT_NOTES);
  const [phase] = useFirebase<Phase>("race/phase", "setup");
  const [assignments] = useFirebase<Assignments>("race/assignments", {});
  const [progress, setProgress] = useFirebase<AllProgress>(
    "race/progress",
    initProgress(bars)
  );

  /* ---- Device identity (localStorage only) ---- */
  const [myId, setMyId] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem(LS_MY_ID);
    if (stored) setMyId(stored);
  }, []);

  const myPerson = myId ? people.find((p) => p.id === myId) : null;
  const myTeam = (myId ? assignments[myId] : null) as TeamId | null;

  /* Clear stale identity if person was removed from Firebase */
  useEffect(() => {
    if (!myId || people.length === 0) return;
    if (!people.find((p) => p.id === myId)) {
      localStorage.removeItem(LS_MY_ID);
      setMyId(null);
    }
  }, [myId, people]);

  const joinedCount = Object.values(assignments).filter(Boolean).length;

  const myTeamMembers = myTeam
    ? people.filter((p) => assignments[p.id] === myTeam)
    : [];

  /* ---- Tab for race view (default to my team) ---- */
  const [tab, setTab] = useState<TeamId>("team1");
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (myTeam) setTab(myTeam);
  }, [myTeam]);

  /* ================================================================ */
  /*  Join handler — Firebase transactions                             */
  /* ================================================================ */

  const handleJoin = async (name: string) => {
    const trimmed = name.trim();
    setJoinError(null);

    if (!trimmed) {
      setJoinError("Please enter your name.");
      return;
    }

    const isDupe = people.some(
      (p) => p.name.trim().toLowerCase() === trimmed.toLowerCase()
    );
    if (isDupe) {
      setJoinError(
        "That name is already taken. Try adding a last initial."
      );
      return;
    }

    setJoining(true);

    try {
      const { id } = await joinBarCrawl(trimmed);
      localStorage.setItem(LS_MY_ID, id);
      setMyId(id);
    } catch (err) {
      setJoinError(
        err instanceof Error
          ? err.message
          : "Something went wrong. Please try again."
      );
    } finally {
      setJoining(false);
    }
  };

  /* ================================================================ */
  /*  Race handlers (same as before)                                   */
  /* ================================================================ */

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
        const url = await uploadPhoto(
          file,
          `photos/${team}/${barId}/${type}`
        );
        urls.push(url);
      }
      setProgress((prev) => {
        const tp = { ...prev[team] };
        const bp = { ...tp[barId] };
        const key =
          type === "mission" ? "missionPhotos" : "receiptPhotos";
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

  const undoDepart = (team: TeamId, barId: string) => {
    setProgress((prev) => {
      const tp = { ...prev[team] };
      tp[barId] = { ...tp[barId], departed: false };
      return { ...prev, [team]: tp };
    });
  };

  /* ================================================================ */
  /*  Render                                                           */
  /* ================================================================ */

  const hasJoined = myId && myPerson && myTeam;

  return (
    <div className="max-w-lg mx-auto pb-10">
      <Header />

      {/* ---- Not joined yet: show sign-up form ---- */}
      {!hasJoined && (
        <JoinScreen
          onJoin={handleJoin}
          joinedCount={joinedCount}
          loading={joining}
          error={joinError}
        />
      )}

      {/* ---- Joined: show team assignment ---- */}
      {hasJoined && (
        <TeamReveal
          person={myPerson}
          teamId={myTeam}
          teamMembers={myTeamMembers}
          raceActive={phase === "race"}
        />
      )}

      {/* ---- Race view (only when joined AND race is active) ---- */}
      {hasJoined && phase === "race" && (
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
                  bp={
                    teamProgress[bar.id] ?? {
                      missionPhotos: [],
                      receiptPhotos: [],
                      departed: false,
                    }
                  }
                  isCurrent={bar.id === curId}
                  isUpcoming={i > curIdx && curId !== "__done__"}
                  teamId={tab}
                  onMission={(f) => upload(tab, bar.id, "mission", f)}
                  onReceipt={(f) => upload(tab, bar.id, "receipt", f)}
                  onDepart={() => depart(tab, bar.id)}
                  onUndo={() => undoDepart(tab, bar.id)}
                />
              ));
            })()}
          </section>
        </>
      )}

      <NotesSection notes={notes} />

      {uploading && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 bg-pink-500 text-white text-xs font-bold px-4 py-2 rounded-full shadow-lg z-50 animate-pulse">
          Uploading...
        </div>
      )}

      <div className="text-center mb-2">
        <span className="text-green-400/40 text-[10px]">
          {"●"} Live sync on
        </span>
      </div>

      <footer className="text-center text-white/15 text-[11px] pb-6">
        Made with {"💖"} for {DEFAULT_EVENT.star}&apos;s birthday
      </footer>
    </div>
  );
}
