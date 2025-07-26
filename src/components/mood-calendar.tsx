"use client";
import React, { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

// Types
type MoodKey = "great" | "good" | "okay" | "meh" | "bad";

interface MoodEntry {
  date: string; // YYYY-MM-DD
  mood: MoodKey | null;
  note: string;
  tags: string[];
}

interface MoodOption {
  key: MoodKey;
  label: string;
  emoji: string;
  color: string; // Tailwind color base for bg-*, text-*, border-*
  score: number; // for averages
}

const MOODS: MoodOption[] = [
  { key: "great", label: "Great", emoji: "😄", color: "emerald", score: 5 },
  { key: "good", label: "Good", emoji: "😊", color: "green", score: 4 },
  { key: "okay", label: "Okay", emoji: "🙂", color: "yellow", score: 3 },
  { key: "meh", label: "Meh", emoji: "😕", color: "orange", score: 2 },
  { key: "bad", label: "Bad", emoji: "😞", color: "red", score: 1 },
];

const SUGGESTED_TAGS = [
  "work",
  "family",
  "health",
  "friends",
  "sleep",
  "exercise",
  "gratitude",
  "stress",
];

const STORAGE_KEY = "lifeboard-mood-tracker-entries-v1";

function getDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

function firstDayOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function lastDayOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function addMonths(date: Date, amount: number) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function classNames(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

const formatter = new Intl.DateTimeFormat(undefined, {
  weekday: "short",
  month: "short",
  day: "numeric",
});

const monthFormatter = new Intl.DateTimeFormat(undefined, {
  month: "long",
  year: "numeric",
});

interface MoodCalendarProps {
  compact?: boolean;
}

export default function MoodCalendar({ compact = false }: MoodCalendarProps) {
  const [entries, setEntries] = useState<Record<string, MoodEntry>>({});
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [viewMonth, setViewMonth] = useState<Date>(firstDayOfMonth(new Date()));
  const [note, setNote] = useState<string>("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [customTag, setCustomTag] = useState<string>("");

  const selectedKey = getDateKey(selectedDate);
  const selectedEntry = entries[selectedKey];

  // Load stored data
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Record<string, MoodEntry>;
        setEntries(parsed);
      }
    } catch (e) {
      // ignore
    }
  }, []);

  // Sync state when selected date changes
  useEffect(() => {
    const existing = entries[selectedKey];
    setNote(existing?.note || "");
    setSelectedTags(existing?.tags || []);
  }, [selectedKey, entries]);

  // Persist to localStorage when entries change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    } catch (e) {
      // ignore
    }
  }, [entries]);

  function setMood(mood: MoodKey | null) {
    setEntries((prev) => {
      const current = prev[selectedKey] || {
        date: selectedKey,
        mood: null,
        note: "",
        tags: [],
      };
      const updated: MoodEntry = {
        ...current,
        mood,
        note,
        tags: selectedTags,
      };
      return { ...prev, [selectedKey]: updated };
    });
  }

  function saveNote(value: string) {
    setNote(value);
    setEntries((prev) => {
      const current = prev[selectedKey] || {
        date: selectedKey,
        mood: null,
        note: "",
        tags: [],
      };
      const updated: MoodEntry = { ...current, note: value, tags: selectedTags };
      return { ...prev, [selectedKey]: updated };
    });
  }

  function toggleTag(tag: string) {
    setSelectedTags((prev) => {
      const next = prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag];
      // also sync entry
      setEntries((prevEntries) => {
        const current = prevEntries[selectedKey] || {
          date: selectedKey,
          mood: null,
          note,
          tags: [],
        };
        const updated: MoodEntry = { ...current, note, tags: next };
        return { ...prevEntries, [selectedKey]: updated };
      });
      return next;
    });
  }

  function addCustomTag() {
    const tag = customTag.trim().toLowerCase();
    if (!tag) return;
    if (!selectedTags.includes(tag)) {
      toggleTag(tag);
    }
    setCustomTag("");
  }

  function clearDay() {
    setNote("");
    setSelectedTags([]);
    setEntries((prev) => {
      const next = { ...prev };
      delete next[selectedKey];
      return next;
    });
  }

  function goToday() {
    const today = new Date();
    setSelectedDate(today);
    setViewMonth(firstDayOfMonth(today));
  }

  // Calendar grid days for viewMonth
  const calendarDays = useMemo(() => {
    const start = firstDayOfMonth(viewMonth);
    const end = lastDayOfMonth(viewMonth);
    const startWeekday = start.getDay(); // 0-6
    const totalDays = end.getDate();

    const days: (Date | null)[] = [];
    for (let i = 0; i < startWeekday; i++) days.push(null);
    for (let d = 1; d <= totalDays; d++) {
      days.push(new Date(viewMonth.getFullYear(), viewMonth.getMonth(), d));
    }
    // fill to complete weeks (multiples of 7)
    const remainder = days.length % 7;
    if (remainder !== 0) {
      for (let i = 0; i < 7 - remainder; i++) days.push(null);
    }
    return days;
  }, [viewMonth]);

  // Stats
  const stats = useMemo(() => {
    const keys = Object.keys(entries);
    const distribution: Record<MoodKey, number> = {
      great: 0,
      good: 0,
      okay: 0,
      meh: 0,
      bad: 0,
    };
    let totalLogged = 0;
    let totalScore = 0;
    for (const k of keys) {
      const e = entries[k];
      if (e?.mood) {
        totalLogged += 1;
        distribution[e.mood] += 1;
        const opt = MOODS.find((m) => m.key === e.mood)!;
        totalScore += opt.score;
      }
    }
    const avg = totalLogged > 0 ? totalScore / totalLogged : 0;

    // Streak from today backwards for days with a mood set
    let streak = 0;
    let cursor = new Date();
    while (true) {
      const key = getDateKey(cursor);
      const e = entries[key];
      if (e && e.mood) {
        streak += 1;
        cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() - 1);
      } else {
        break;
      }
    }
    return { distribution, totalLogged, avg, streak };
  }, [entries]);

  const maxNoteChars = 400;

  function dayMood(date: Date | null): MoodKey | null {
    if (!date) return null;
    const e = entries[getDateKey(date)];
    return e?.mood || null;
  }

  function moodOption(mood: MoodKey | null) {
    return MOODS.find((m) => m.key === mood);
  }

  const combinedTags = useMemo(() => {
    const seen = new Set<string>([...SUGGESTED_TAGS]);
    // include from entries
    Object.values(entries).forEach((e) => e?.tags?.forEach((t) => seen.add(t)));
    return Array.from(seen).sort();
  }, [entries]);

  if (compact) {
    return (
      <Card className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Mood Calendar</h3>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setViewMonth(addMonths(viewMonth, -1))}
            >
              ←
            </Button>
            <span className="text-sm font-medium min-w-[120px] text-center">
              {monthFormatter.format(viewMonth)}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setViewMonth(addMonths(viewMonth, 1))}
            >
              →
            </Button>
          </div>
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 gap-1 text-center text-xs text-gray-500 mb-2">
          <div>Sun</div>
          <div>Mon</div>
          <div>Tue</div>
          <div>Wed</div>
          <div>Thu</div>
          <div>Fri</div>
          <div>Sat</div>
        </div>

        <div className="grid grid-cols-7 gap-1">
          {calendarDays.map((d, idx) => {
            const active = d && isSameDay(d, selectedDate);
            const inMonth = d && d.getMonth() === viewMonth.getMonth();
            const mood = dayMood(d);
            const opt = mood ? MOODS.find((m) => m.key === mood)! : undefined;
            return (
              <button
                key={idx}
                disabled={!d}
                onClick={() => d && (setSelectedDate(d), setViewMonth(firstDayOfMonth(d)))}
                className={classNames(
                  "aspect-square rounded border flex flex-col items-center justify-center text-xs transition hover:bg-gray-50",
                  d
                    ? active
                      ? "border-blue-500 bg-blue-50 text-blue-700"
                      : inMonth
                      ? "border-gray-200 bg-white text-gray-800"
                      : "border-gray-200 bg-gray-50 text-gray-400"
                    : "border-transparent bg-transparent cursor-default"
                )}
              >
                {d && (
                  <>
                    <span className="text-[10px]">{d.getDate()}</span>
                    {opt ? (
                      <span className="text-sm" aria-hidden>
                        {MOODS.find((m) => m.key === mood)!.emoji}
                      </span>
                    ) : (
                      <span className="text-gray-300 text-sm" aria-hidden>•</span>
                    )}
                  </>
                )}
              </button>
            );
          })}
        </div>

        {/* Quick Stats */}
        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <div className="bg-gray-50 rounded p-2">
            <div className="text-xs text-gray-600">Logged</div>
            <div className="text-sm font-bold">{stats.totalLogged}</div>
          </div>
          <div className="bg-gray-50 rounded p-2">
            <div className="text-xs text-gray-600">Streak</div>
            <div className="text-sm font-bold">{stats.streak}d</div>
          </div>
          <div className="bg-gray-50 rounded p-2">
            <div className="text-xs text-gray-600">Average</div>
            <div className="text-sm font-bold">{stats.avg.toFixed(1)}</div>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Mood Entry Section */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Today's Mood</h3>
          <span className="text-sm text-gray-500">{formatter.format(selectedDate)}</span>
        </div>
        
        <div className="mb-4">
          <p className="text-sm text-gray-600 mb-3">How are you feeling?</p>
          <div className="grid grid-cols-5 gap-2">
            {MOODS.map((m) => {
              const active = selectedEntry?.mood === m.key;
              return (
                <Button
                  key={m.key}
                  variant={active ? "default" : "outline"}
                  onClick={() => setMood(active ? null : m.key)}
                  className={classNames(
                    "flex flex-col items-center justify-center h-16 text-sm",
                    active && `bg-${m.color}-100 border-${m.color}-400 text-${m.color}-700 hover:bg-${m.color}-200`
                  )}
                >
                  <span className="text-2xl mb-1" aria-hidden>{m.emoji}</span>
                  <span>{m.label}</span>
                </Button>
              );
            })}
          </div>
        </div>

        <div className="flex gap-2">
          <Button onClick={goToday} size="sm">Today</Button>
          <Button onClick={clearDay} variant="outline" size="sm">Clear Day</Button>
        </div>
      </Card>

      {/* Calendar and Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Calendar */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <Button
              variant="outline"
              onClick={() => setViewMonth(addMonths(viewMonth, -1))}
            >
              Previous
            </Button>
            <h3 className="text-lg font-semibold">{monthFormatter.format(viewMonth)}</h3>
            <Button
              variant="outline"
              onClick={() => setViewMonth(addMonths(viewMonth, 1))}
            >
              Next
            </Button>
          </div>

          <div className="grid grid-cols-7 gap-2 text-center text-xs text-gray-500 mb-2">
            <div>Sun</div>
            <div>Mon</div>
            <div>Tue</div>
            <div>Wed</div>
            <div>Thu</div>
            <div>Fri</div>
            <div>Sat</div>
          </div>

          <div className="grid grid-cols-7 gap-2">
            {calendarDays.map((d, idx) => {
              const active = d && isSameDay(d, selectedDate);
              const inMonth = d && d.getMonth() === viewMonth.getMonth();
              const mood = dayMood(d);
              const opt = mood ? MOODS.find((m) => m.key === mood)! : undefined;
              return (
                <button
                  key={idx}
                  disabled={!d}
                  onClick={() => d && (setSelectedDate(d), setViewMonth(firstDayOfMonth(d)))}
                  className={classNames(
                    "aspect-square rounded border flex flex-col items-center justify-center text-sm transition hover:bg-gray-50",
                    d
                      ? active
                        ? "border-blue-500 bg-blue-50 text-blue-700"
                        : inMonth
                        ? "border-gray-200 bg-white text-gray-800"
                        : "border-gray-200 bg-gray-50 text-gray-400"
                      : "border-transparent bg-transparent cursor-default"
                  )}
                >
                  {d && (
                    <>
                      <span>{d.getDate()}</span>
                      {opt ? (
                        <span className="text-xl" aria-hidden>
                          {MOODS.find((m) => m.key === mood)!.emoji}
                        </span>
                      ) : (
                        <span className="text-gray-300 text-xl" aria-hidden>•</span>
                      )}
                    </>
                  )}
                </button>
              );
            })}
          </div>
        </Card>

        {/* Stats */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Overview</h3>
          
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-gray-50 rounded p-3 text-center">
              <div className="text-sm text-gray-600">Logged Days</div>
              <div className="text-2xl font-bold">{stats.totalLogged}</div>
            </div>
            <div className="bg-gray-50 rounded p-3 text-center">
              <div className="text-sm text-gray-600">Current Streak</div>
              <div className="text-2xl font-bold">{stats.streak}d</div>
            </div>
            <div className="bg-gray-50 rounded p-3 text-center">
              <div className="text-sm text-gray-600">Average Mood</div>
              <div className="text-2xl font-bold">{stats.avg.toFixed(1)}</div>
            </div>
          </div>

          <div className="space-y-3">
            {MOODS.map((m) => {
              const count = stats.distribution[m.key];
              const percent = stats.totalLogged > 0 ? (count / stats.totalLogged) * 100 : 0;
              return (
                <div key={m.key}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-lg" aria-hidden>{m.emoji}</span>
                      <span>{m.label}</span>
                    </div>
                    <span className="text-gray-600">{count} ({percent.toFixed(0)}%)</span>
                  </div>
                  <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                    <div
                      className={`h-full bg-${m.color}-400`}
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      {/* Journal and Tags */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Journal */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Journal</h3>
          <textarea
            value={note}
            onChange={(e) => saveNote(e.target.value.slice(0, maxNoteChars))}
            placeholder="Write a quick note about your day..."
            className="w-full h-32 resize-none rounded border border-gray-300 p-3 text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
          <div className="mt-2 text-right text-xs text-gray-500">
            {note.length}/{maxNoteChars}
          </div>
        </Card>

        {/* Tags */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Tags</h3>
          <p className="text-sm text-gray-600 mb-4">Mark what influenced your mood.</p>
          
          <div className="flex flex-wrap gap-2 mb-4">
            {combinedTags.map((tag) => {
              const active = selectedTags.includes(tag);
              return (
                <Badge
                  key={tag}
                  variant={active ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() => toggleTag(tag)}
                >
                  #{tag}
                </Badge>
              );
            })}
          </div>
          
          <div className="flex gap-2">
            <input
              value={customTag}
              onChange={(e) => setCustomTag(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addCustomTag();
                }
              }}
              placeholder="Add custom tag"
              className="flex-1 rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
            <Button onClick={addCustomTag} size="sm">Add</Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
