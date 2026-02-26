import { NextResponse } from "next/server";

// Dev-only in-memory task endpoint - disabled in production
const isDev = process.env.NODE_ENV === 'development'

type Task = {
  id: string;
  content: string;
  completed: boolean;
  startDate: string | null;
};

// In-memory seed (resets when dev server restarts)
let tasks: Task[] = [
  { id: "1", content: "Design homepage",   completed: false, startDate: "2025-10-15" },
  { id: "2", content: "Plan calendar view", completed: false, startDate: null },
  { id: "3", content: "Write API spec",     completed: true,  startDate: "2025-10-20" },
];

export async function GET() {
  if (!isDev) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ tasks });
}

export async function POST(req: Request) {
  if (!isDev) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  try {
    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const content = (typeof body.content === 'string' ? body.content : "").trim();
    if (!content) return NextResponse.json({ error: "content required" }, { status: 400 });

    const newTask: Task = {
      id: globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2),
      content,
      completed: Boolean(body.completed ?? false),
      startDate: typeof body.startDate === 'string' ? body.startDate : null,
    };

    tasks.unshift(newTask);
    return NextResponse.json({ task: newTask }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  if (!isDev) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  try {
    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const id = (typeof body.id === 'string' ? body.id : "");
    const completed = Boolean(body.completed);

    const idx = tasks.findIndex(t => t.id === id);
    if (idx === -1) return NextResponse.json({ error: "not found" }, { status: 404 });

    tasks[idx] = { ...tasks[idx], completed };
    return NextResponse.json({ task: tasks[idx] });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
