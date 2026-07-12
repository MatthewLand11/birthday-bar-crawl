"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  DEFAULT_PEOPLE,
  DEFAULT_BARS,
  DEFAULT_NOTES,
  loadPeople,
  loadBars,
  loadNotes,
  savePeople,
  saveBars,
  saveNotes,
  resetAll,
} from "@/lib/data";
import type { Person, BarStop, BarField } from "@/lib/data";
import { TEAMS } from "@/lib/data";
import { useFirebase, isFirebaseActive } from "@/lib/firebase";

type TeamId = "team1" | "team2";
type Phase = "setup" | "race";
type Assignments = Record<string, TeamId | null>;

/* ================================================================== */
/*  ADMIN PAGE                                                         */
/* ================================================================== */

export default function AdminPage() {
  const live = isFirebaseActive();

  /* Firebase-synced state */
  const [fbPeople, setFbPeople] = useFirebase<Person[]>("config/people", DEFAULT_PEOPLE);
  const [fbBars, setFbBars] = useFirebase<BarStop[]>("config/bars", DEFAULT_BARS);
  const [fbNotes, setFbNotes] = useFirebase<string[]>("config/notes", DEFAULT_NOTES);

  /* Local editing state (always used for form inputs) */
  const [people, setPeople] = useState<Person[]>(DEFAULT_PEOPLE);
  const [bars, setBars] = useState<BarStop[]>(DEFAULT_BARS);
  const [notes, setNotes] = useState<string[]>(DEFAULT_NOTES);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  /* Race state (read + control) — Firebase is source of truth */
  const [phase, setFbPhase] = useFirebase<Phase>("race/phase", "setup");
  const [assignments, setFbAssignments] = useFirebase<Assignments>("race/assignments", {});
  const [, setFbProgress] = useFirebase<Record<string, unknown>>("race/progress", {});
  const [, setFbAlbum] = useFirebase<string[]>("album/photos", []);
  const [selectedPerson, setSelectedPerson] = useState<string | null>(null);

  /* Seed local state on initial load — from Firebase if available, else localStorage */
  const hasSynced = useRef(false);
  useEffect(() => {
    if (hasSynced.current) return;

    if (live) {
      const hasFirebaseData =
        fbPeople !== DEFAULT_PEOPLE || fbBars !== DEFAULT_BARS || fbNotes !== DEFAULT_NOTES;
      if (hasFirebaseData) {
        hasSynced.current = true;
        setPeople(fbPeople);
        setBars(fbBars);
        setNotes(fbNotes);
      } else {
        /* Firebase is active but has no data yet — check localStorage as fallback */
        const localPeople = loadPeople();
        const localBars = loadBars();
        const localNotes = loadNotes();
        const hasLocalData =
          localPeople !== DEFAULT_PEOPLE || localBars !== DEFAULT_BARS || localNotes !== DEFAULT_NOTES;
        if (hasLocalData) {
          hasSynced.current = true;
          setPeople(localPeople);
          setBars(localBars);
          setNotes(localNotes);
        }
        /* If neither has data, stay on defaults — hasSynced stays false
           until Firebase onValue fires with real data (or we give up after a timeout) */
      }
    } else {
      hasSynced.current = true;
      setPeople(loadPeople());
      setBars(loadBars());
      setNotes(loadNotes());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live, fbPeople, fbBars, fbNotes]);

  /* ================================================================ */
  /*  People helpers                                                   */
  /* ================================================================ */

  const updatePerson = (idx: number, name: string) => {
    const next = [...people];
    next[idx] = { ...next[idx], name };
    setPeople(next);
  };

  const removePerson = (idx: number) =>
    setPeople(people.filter((_, i) => i !== idx));

  const addPerson = () =>
    setPeople([...people, { id: crypto.randomUUID(), name: "" }]);

  /* ================================================================ */
  /*  Bar helpers                                                      */
  /* ================================================================ */

  const updateBarProp = (
    idx: number,
    key: "name" | "icon",
    value: string
  ) => {
    const next = [...bars];
    next[idx] = { ...next[idx], [key]: value };
    setBars(next);
  };

  const updateBarField = (
    barIdx: number,
    fieldId: string,
    key: "label" | "value",
    val: string
  ) => {
    const next = [...bars];
    const bar = { ...next[barIdx] };
    bar.fields = bar.fields.map((f) =>
      f.id === fieldId ? { ...f, [key]: val } : f
    );
    next[barIdx] = bar;
    setBars(next);
  };

  const addBarField = (barIdx: number) => {
    const next = [...bars];
    const bar = { ...next[barIdx] };
    bar.fields = [
      ...bar.fields,
      { id: crypto.randomUUID(), label: "", value: "" },
    ];
    next[barIdx] = bar;
    setBars(next);
  };

  const removeBarField = (barIdx: number, fieldId: string) => {
    const next = [...bars];
    const bar = { ...next[barIdx] };
    bar.fields = bar.fields.filter((f) => f.id !== fieldId);
    next[barIdx] = bar;
    setBars(next);
  };

  const moveBar = (idx: number, dir: "up" | "down") => {
    const target = dir === "up" ? idx - 1 : idx + 1;
    if (target < 0 || target >= bars.length) return;
    const next = [...bars];
    [next[idx], next[target]] = [next[target], next[idx]];
    setBars(next);
  };

  const addBar = () =>
    setBars([
      ...bars,
      {
        id: crypto.randomUUID(),
        name: "",
        icon: "\uD83C\uDF78",
        fields: [],
      },
    ]);

  const removeBar = (idx: number) => {
    if (!window.confirm(`Remove "${bars[idx].name || "this stop"}"?`)) return;
    setBars(bars.filter((_, i) => i !== idx));
  };

  /* ================================================================ */
  /*  Note helpers                                                     */
  /* ================================================================ */

  const updateNote = (idx: number, value: string) => {
    const next = [...notes];
    next[idx] = value;
    setNotes(next);
  };

  const removeNote = (idx: number) =>
    setNotes(notes.filter((_, i) => i !== idx));

  const addNote = () => setNotes([...notes, ""]);

  /* ================================================================ */
  /*  Actions                                                          */
  /* ================================================================ */

  const handleSave = async () => {
    const cleanPeople = people.filter((p) => p.name.trim() !== "");
    const cleanBars = bars.filter((b) => b.name.trim() !== "");
    const cleanNotes = notes.filter((n) => n.trim() !== "");

    setSaveError(null);

    /* Always persist to localStorage as a baseline */
    savePeople(cleanPeople);
    saveBars(cleanBars);
    saveNotes(cleanNotes);

    if (live) {
      try {
        await setFbPeople(cleanPeople);
        await setFbBars(cleanBars);
        await setFbNotes(cleanNotes);
      } catch {
        setSaveError("Saved locally only — Firebase denied the write. Changes won't sync to other devices until database rules are updated.");
      }
    }

    /* Update local editing state to match what was saved */
    setPeople(cleanPeople);
    setBars(cleanBars);
    setNotes(cleanNotes);

    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleReset = async () => {
    if (!window.confirm("Reset everything back to the original defaults?"))
      return;
    setSaveError(null);
    if (live) {
      try {
        await setFbPeople(DEFAULT_PEOPLE);
        await setFbBars(DEFAULT_BARS);
        await setFbNotes(DEFAULT_NOTES);
      } catch {
        /* Firebase failed — just clear localStorage */
      }
    }
    resetAll();
    setPeople(DEFAULT_PEOPLE);
    setBars(DEFAULT_BARS);
    setNotes(DEFAULT_NOTES);
  };

  /* ================================================================ */
  /*  Shared styles                                                    */
  /* ================================================================ */

  const inputClass =
    "w-full bg-white/[0.06] border border-white/10 rounded-xl px-3 py-2 text-white text-sm placeholder-white/20 focus:outline-none focus:border-pink-500/50 focus:ring-1 focus:ring-pink-500/30 transition-colors";
  const labelClass =
    "text-white/40 text-[10px] font-bold uppercase tracking-wider";
  const smallBtnClass =
    "text-white/20 hover:text-white/60 transition-colors text-sm leading-none";

  return (
    <div className="max-w-lg mx-auto px-5 pb-12">
      {/* ---- Header ---- */}
      <header className="pt-10 pb-6">
        <Link
          href="/"
          className="text-pink-400/60 hover:text-pink-400 text-xs transition-colors"
        >
          {"\u2190"} Back to event
        </Link>
        <h1 className="text-2xl font-bold text-white mt-3">
          {"\u2699\uFE0F"} Edit Event
        </h1>
        <p className="text-white/40 text-sm mt-1">
          Change names, bars, times, and notes. Hit Save when done.
        </p>
      </header>

      {/* ============================================================ */}
      {/*  ATTENDEES                                                    */}
      {/* ============================================================ */}
      <section className="mb-8">
        <h2 className="text-white font-semibold text-sm mb-3 flex items-center gap-2">
          {"\uD83D\uDC65"} Attendees
        </h2>
        <div className="space-y-2">
          {people.map((p, i) => (
            <div key={p.id} className="flex items-center gap-2">
              <input
                className={inputClass}
                value={p.name}
                onChange={(e) => updatePerson(i, e.target.value)}
                placeholder="Name"
              />
              <button
                onClick={() => removePerson(i)}
                className="text-white/20 hover:text-red-400 text-lg shrink-0 transition-colors px-1"
                title="Remove"
              >
                {"\u00D7"}
              </button>
            </div>
          ))}
        </div>
        <button
          onClick={addPerson}
          className="mt-2 text-pink-400/70 hover:text-pink-400 text-xs font-medium transition-colors"
        >
          + Add person
        </button>
      </section>

      {/* ============================================================ */}
      {/*  BAR STOPS                                                    */}
      {/* ============================================================ */}
      <section className="mb-8">
        <h2 className="text-white font-semibold text-sm mb-3 flex items-center gap-2">
          {"\uD83C\uDF7B"} Bar Stops
        </h2>
        <div className="space-y-4">
          {bars.map((bar, i) => (
            <div
              key={bar.id}
              className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-4"
            >
              {/* ---- Bar header: reorder + label + remove ---- */}
              <div className="flex items-center gap-2 mb-3">
                {/* Reorder arrows */}
                <div className="flex flex-col gap-0.5">
                  <button
                    onClick={() => moveBar(i, "up")}
                    disabled={i === 0}
                    className={`text-xs leading-none px-1 ${
                      i === 0
                        ? "text-white/10 cursor-not-allowed"
                        : "text-white/30 hover:text-white/70"
                    } transition-colors`}
                    title="Move up"
                  >
                    {"\u25B2"}
                  </button>
                  <button
                    onClick={() => moveBar(i, "down")}
                    disabled={i === bars.length - 1}
                    className={`text-xs leading-none px-1 ${
                      i === bars.length - 1
                        ? "text-white/10 cursor-not-allowed"
                        : "text-white/30 hover:text-white/70"
                    } transition-colors`}
                    title="Move down"
                  >
                    {"\u25BC"}
                  </button>
                </div>
                <span className="text-white/30 text-xs font-bold flex-1">
                  Stop {i + 1}
                </span>
                <button
                  onClick={() => removeBar(i)}
                  className="text-white/20 hover:text-red-400 text-xs transition-colors"
                  title="Remove bar"
                >
                  Remove
                </button>
              </div>

              {/* ---- Icon + Name ---- */}
              <div className="flex gap-2 mb-3">
                <div className="w-16 shrink-0">
                  <label className={labelClass}>Icon</label>
                  <input
                    className={inputClass + " text-center text-lg"}
                    value={bar.icon}
                    onChange={(e) => updateBarProp(i, "icon", e.target.value)}
                    placeholder="\uD83C\uDF78"
                  />
                </div>
                <div className="flex-1">
                  <label className={labelClass}>Name</label>
                  <input
                    className={inputClass}
                    value={bar.name}
                    onChange={(e) => updateBarProp(i, "name", e.target.value)}
                    placeholder="Bar name"
                  />
                </div>
              </div>

              {/* ---- Dynamic fields ---- */}
              <div className="space-y-2">
                {bar.fields.map((field) => (
                  <div key={field.id} className="flex gap-2 items-start">
                    {/* Label input (narrow) */}
                    <input
                      className={
                        inputClass +
                        " !w-24 shrink-0 text-[11px] !py-2"
                      }
                      value={field.label}
                      onChange={(e) =>
                        updateBarField(i, field.id, "label", e.target.value)
                      }
                      placeholder="Label"
                    />
                    {/* Value: textarea if label suggests long content */}
                    {field.label.toLowerCase().includes("mission") ? (
                      <textarea
                        className={inputClass + " min-h-[60px] resize-y flex-1 !py-2"}
                        value={field.value}
                        onChange={(e) =>
                          updateBarField(
                            i,
                            field.id,
                            "value",
                            e.target.value
                          )
                        }
                        placeholder="Value"
                      />
                    ) : (
                      <input
                        className={inputClass + " flex-1 !py-2"}
                        value={field.value}
                        onChange={(e) =>
                          updateBarField(
                            i,
                            field.id,
                            "value",
                            e.target.value
                          )
                        }
                        placeholder="Value"
                      />
                    )}
                    {/* Remove field */}
                    <button
                      onClick={() => removeBarField(i, field.id)}
                      className={smallBtnClass + " shrink-0 mt-2"}
                      title="Remove field"
                    >
                      {"\u00D7"}
                    </button>
                  </div>
                ))}
              </div>
              <button
                onClick={() => addBarField(i)}
                className="mt-2 text-pink-400/70 hover:text-pink-400 text-xs font-medium transition-colors"
              >
                + Add field
              </button>
            </div>
          ))}
        </div>

        {/* Add bar button */}
        <button
          onClick={addBar}
          className="w-full mt-4 py-3 rounded-2xl border-2 border-dashed border-white/10 text-white/30 hover:text-white/60 hover:border-white/20 text-sm font-medium transition-colors"
        >
          + Add bar stop
        </button>
      </section>

      {/* ============================================================ */}
      {/*  TEAM ASSIGNMENTS (tap to assign/move)                        */}
      {/* ============================================================ */}
      <section className="mb-8">
        <h2 className="text-white font-semibold text-sm mb-3 flex items-center gap-2">
          {"🏁"} Team Assignments
        </h2>
        <p className="text-white/30 text-xs mb-3">
          Tap a name, then tap a team to assign or move them.
        </p>
        {(() => {
          const team1 = people.filter((p) => assignments[p.id] === "team1");
          const team2 = people.filter((p) => assignments[p.id] === "team2");
          const unassigned = people.filter((p) => !assignments[p.id]);

          const assign = async (personId: string, team: TeamId | null) => {
            const next = { ...assignments, [personId]: team };
            if (team === null) {
              delete next[personId];
            }
            try {
              await setFbAssignments(next);
            } catch { /* ignore */ }
            setSelectedPerson(null);
          };

          return (
            <div className="space-y-3">
              {/* Team drop zones */}
              {(["team1", "team2"] as TeamId[]).map((tid) => {
                const members = tid === "team1" ? team1 : team2;
                const team = TEAMS[tid];
                return (
                  <div
                    key={tid}
                    onClick={() => {
                      if (selectedPerson) assign(selectedPerson, tid);
                    }}
                    className={`rounded-xl border p-3 transition-all ${
                      selectedPerson ? "cursor-pointer ring-1 ring-white/20" : ""
                    }`}
                    style={{
                      borderColor: team.color + "30",
                      backgroundColor: team.color + "08",
                    }}
                  >
                    <p
                      className="text-[11px] font-bold uppercase tracking-wider mb-2"
                      style={{ color: team.color }}
                    >
                      {team.emoji} {team.name} ({members.length})
                    </p>
                    {members.length === 0 ? (
                      <p className="text-white/20 text-xs">
                        {selectedPerson ? "Tap here to assign" : "No one yet"}
                      </p>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {members.map((p) => (
                          <button
                            key={p.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedPerson(
                                selectedPerson === p.id ? null : p.id
                              );
                            }}
                            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-all ${
                              selectedPerson === p.id
                                ? "bg-pink-500/30 text-white ring-2 ring-pink-400/40 scale-105"
                                : "bg-white/10 text-white/60 hover:bg-white/15"
                            }`}
                          >
                            {p.name}
                            {selectedPerson === p.id && (
                              <span
                                onClick={(e) => {
                                  e.stopPropagation();
                                  assign(p.id, null);
                                }}
                                className="text-white/30 hover:text-red-400 ml-0.5"
                              >
                                {"×"}
                              </span>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Unassigned pool */}
              {unassigned.length > 0 && (
                <div
                  onClick={() => {
                    if (selectedPerson) assign(selectedPerson, null);
                  }}
                  className={`rounded-xl border border-white/10 bg-white/[0.03] p-3 transition-all ${
                    selectedPerson ? "cursor-pointer ring-1 ring-white/20" : ""
                  }`}
                >
                  <p className="text-white/30 text-[11px] font-bold uppercase tracking-wider mb-2">
                    Not on a team ({unassigned.length})
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {unassigned.map((p) => (
                      <button
                        key={p.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedPerson(
                            selectedPerson === p.id ? null : p.id
                          );
                        }}
                        className={`inline-block rounded-full px-2.5 py-1 text-xs font-medium transition-all ${
                          selectedPerson === p.id
                            ? "bg-pink-500/30 text-white ring-2 ring-pink-400/40 scale-105"
                            : "bg-white/10 text-white/30 hover:bg-white/15"
                        }`}
                      >
                        {p.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })()}
      </section>

      {/* ============================================================ */}
      {/*  RACE CONTROLS                                                */}
      {/* ============================================================ */}
      <section className="mb-8">
        <h2 className="text-white font-semibold text-sm mb-3 flex items-center gap-2">
          {"🎮"} Race Controls
        </h2>
        <div className="bg-white/[0.04] border border-white/[0.08] rounded-xl p-4">
          <div className="flex items-center gap-3 mb-3">
            <span className="text-white/40 text-xs">Status:</span>
            <span
              className={`text-xs font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full ${
                phase === "race"
                  ? "bg-green-500/20 text-green-400"
                  : "bg-white/10 text-white/40"
              }`}
            >
              {phase === "race" ? "Race active" : "Waiting for start"}
            </span>
          </div>
          <div className="flex gap-2">
            {phase === "setup" ? (
              <button
                onClick={async () => {
                  try {
                    if (live) await setFbPhase("race");
                    else setFbPhase("race");
                  } catch { /* ignore */ }
                }}
                className="flex-1 py-2.5 rounded-xl bg-green-500/20 hover:bg-green-500/30 text-green-400 text-xs font-bold uppercase tracking-wider transition-colors"
              >
                {"🏁"} Start the Race
              </button>
            ) : (
              <button
                onClick={async () => {
                  try {
                    if (live) await setFbPhase("setup");
                    else setFbPhase("setup");
                  } catch { /* ignore */ }
                }}
                className="flex-1 py-2.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-white/40 text-xs font-bold uppercase tracking-wider transition-colors"
              >
                Pause Race
              </button>
            )}
            <button
              onClick={async () => {
                if (!window.confirm("Reset all team assignments, race progress, and shared album?")) return;
                try {
                  await setFbPhase("setup");
                  await setFbAssignments({});
                  await setFbProgress({});
                  await setFbAlbum([]);
                } catch { /* ignore */ }
              }}
              className="px-4 py-2.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400/60 hover:text-red-400 text-xs font-bold transition-colors"
            >
              Reset Race
            </button>
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/*  NOTES                                                        */}
      {/* ============================================================ */}
      <section className="mb-10">
        <h2 className="text-white font-semibold text-sm mb-3 flex items-center gap-2">
          {"\uD83D\uDCCC"} Notes
        </h2>
        <div className="space-y-2">
          {notes.map((n, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                className={inputClass}
                value={n}
                onChange={(e) => updateNote(i, e.target.value)}
                placeholder="Note"
              />
              <button
                onClick={() => removeNote(i)}
                className="text-white/20 hover:text-red-400 text-lg shrink-0 transition-colors px-1"
                title="Remove"
              >
                {"\u00D7"}
              </button>
            </div>
          ))}
        </div>
        <button
          onClick={addNote}
          className="mt-2 text-pink-400/70 hover:text-pink-400 text-xs font-medium transition-colors"
        >
          + Add note
        </button>
      </section>

      {/* ============================================================ */}
      {/*  STICKY ACTION BAR                                            */}
      {/* ============================================================ */}
      <div className="sticky bottom-0 bg-gradient-to-t from-[#1a0a14] via-[#1a0a14] to-transparent pt-6 pb-6 -mx-5 px-5">
        {saveError && (
          <div className="mb-3 px-4 py-2 rounded-xl bg-red-500/20 border border-red-500/30 text-red-300 text-sm">
            {saveError}
          </div>
        )}
        <div className="flex gap-3">
          <button
            onClick={handleSave}
            className="flex-1 py-3 rounded-full bg-pink-500 text-white font-bold text-sm uppercase tracking-wider shadow-lg shadow-pink-500/25 hover:bg-pink-400 active:scale-[0.98] transition-all"
          >
            {saved ? "\u2713 Saved!" : "Save Changes"}
          </button>
          <button
            onClick={handleReset}
            className="px-5 py-3 rounded-full bg-white/[0.06] text-white/40 hover:text-white/70 font-medium text-sm transition-colors"
          >
            Reset
          </button>
        </div>
      </div>
    </div>
  );
}
