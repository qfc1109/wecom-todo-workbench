export const TASK_STATUSES = ["待处理", "进行中", "等待他人", "已完成"] as const;
export const TASK_PRIORITIES = ["高", "中", "低"] as const;

export type TaskStatus = (typeof TASK_STATUSES)[number];
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export interface Task {
  id: string;
  title: string;
  source: string;
  priority: TaskPriority;
  status: TaskStatus;
  dueAt: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  notificationSentAt: string | null;
}

export interface TaskInput {
  title: string;
  source: string;
  dueAt: string;
  priority?: TaskPriority;
  status?: TaskStatus;
  notes?: string;
}

export interface TaskGroups {
  overdue: Task[];
  today: Task[];
  future: Task[];
  completed: Task[];
}

const priorityWeight: Record<TaskPriority, number> = {
  高: 0,
  中: 1,
  低: 2,
};

export function createTask(input: TaskInput, now = new Date()): Task {
  const timestamp = now.toISOString();

  return {
    id: createId(),
    title: input.title.trim(),
    source: input.source.trim(),
    priority: input.priority ?? "中",
    status: input.status ?? "待处理",
    dueAt: input.dueAt,
    notes: input.notes?.trim() ?? "",
    createdAt: timestamp,
    updatedAt: timestamp,
    completedAt: input.status === "已完成" ? timestamp : null,
    notificationSentAt: null,
  };
}

export function updateTask(task: Task, patch: Partial<Omit<Task, "id" | "createdAt">>, now = new Date()): Task {
  const nextStatus = patch.status ?? task.status;
  const wasCompleted = task.status === "已完成";
  const isCompleted = nextStatus === "已完成";

  return {
    ...task,
    ...patch,
    status: nextStatus,
    title: typeof patch.title === "string" ? patch.title.trim() : task.title,
    source: typeof patch.source === "string" ? patch.source.trim() : task.source,
    notes: typeof patch.notes === "string" ? patch.notes.trim() : task.notes,
    updatedAt: now.toISOString(),
    completedAt: isCompleted ? (wasCompleted ? task.completedAt : now.toISOString()) : null,
  };
}

export function updateTaskStatus(task: Task, status: TaskStatus, now = new Date()): Task {
  return updateTask(task, { status }, now);
}

export function isTaskOverdue(task: Task, now = new Date()): boolean {
  return task.status !== "已完成" && parseDueAt(task.dueAt).getTime() < now.getTime();
}

export function groupTasksByDueDate(tasks: Task[], now = new Date()): TaskGroups {
  return sortTasksByUrgency(tasks).reduce<TaskGroups>(
    (groups, task) => {
      if (task.status === "已完成") {
        groups.completed.push(task);
        return groups;
      }

      const dueDate = parseDueAt(task.dueAt);
      if (dueDate.getTime() < now.getTime()) {
        groups.overdue.push(task);
      } else if (isSameLocalDate(dueDate, now)) {
        groups.today.push(task);
      } else {
        groups.future.push(task);
      }

      return groups;
    },
    { overdue: [], today: [], future: [], completed: [] },
  );
}

export function sortTasksByUrgency(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    if (a.status === "已完成" && b.status !== "已完成") return 1;
    if (a.status !== "已完成" && b.status === "已完成") return -1;

    const priorityDelta = priorityWeight[a.priority] - priorityWeight[b.priority];
    if (priorityDelta !== 0) return priorityDelta;

    const dueDelta = parseDueAt(a.dueAt).getTime() - parseDueAt(b.dueAt).getTime();
    if (dueDelta !== 0) return dueDelta;

    return a.createdAt.localeCompare(b.createdAt);
  });
}

export function formatDueLabel(task: Task): string {
  const dueDate = parseDueAt(task.dueAt);
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(dueDate);
}

export function parseDueAt(value: string): Date {
  return new Date(value);
}

function isSameLocalDate(left: Date, right: Date): boolean {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

function createId(): string {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  return `task-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
