"use client";

import { useState, useEffect } from "react";
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
import { useFirebase, isFirebaseActive } from "@/lib/firebase";

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

  /* Seed local state from Firebase or localStorage on mount */
  useEffect(() => {
    if (live) {
      setPeople(fbPeople);
      setBars(fbBars);
      setNotes(fbNotes);
    } else {
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

  const handleSave = () => {
    const cleanPeople = people.filter((p) => p.name.trim() !== "");
    const cleanBars = bars.filter((b) => b.name.trim() !== "");
    const cleanNotes = notes.filter((n) => n.trim() !== "");

    if (live) {
      /* Write to Firebase — all devices pick it up instantly */
      setFbPeople(cleanPeople);
      setFbBars(cleanBars);
      setFbNotes(cleanNotes);
    } else {
      /* Offline fallback — localStorage */
      savePeople(cleanPeople);
      saveBars(cleanBars);
      saveNotes(cleanNotes);
    }

    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleReset = () => {
    if (!window.confirm("Reset everything back to the original defaults?"))
      return;
    if (live) {
      setFbPeople(DEFAULT_PEOPLE);
      setFbBars(DEFAULT_BARS);
      setFbNotes(DEFAULT_NOTES);
    } else {
      resetAll();
    }
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
