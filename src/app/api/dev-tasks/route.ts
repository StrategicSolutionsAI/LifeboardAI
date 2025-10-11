import { NextResponse } from "next/server";

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
  return NextResponse.json({ tasks });
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({} as any));
    const content = (body.content ?? "").toString().trim();
    if (!content) return NextResponse.json({ error: "content required" }, { status: 400 });

    const newTask: Task = {
      id: globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2),
      content,
      completed: Boolean(body.completed ?? false),
      startDate: body.startDate ?? null,
    };

    tasks.unshift(newTask);
    return NextResponse.json({ task: newTask }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json().catch(() => ({} as any));
    const id = (body.id ?? "").toString();
    const completed = Boolean(body.completed);

    const idx = tasks.findIndex(t => t.id === id);
    if (idx === -1) return NextResponse.json({ error: "not found" }, { status: 404 });

    tasks[idx] = { ...tasks[idx], completed };
    return NextResponse.json({ task: tasks[idx] });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}