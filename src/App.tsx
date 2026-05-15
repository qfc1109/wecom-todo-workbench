import {
  AlertTriangle,
  Bell,
  Check,
  Download,
  Edit3,
  Filter,
  Plus,
  RotateCcw,
  Save,
  Search,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { type ChangeEvent, type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  TASK_PRIORITIES,
  TASK_STATUSES,
  createTask,
  formatDueLabel,
  groupTasksByDueDate,
  isTaskOverdue,
  updateTask,
  updateTaskStatus,
  type Task,
  type TaskPriority,
  type TaskStatus,
} from "./domain/tasks";
import {
  getAttentionCount,
  getNotificationPermission,
  notifyDueTasks,
  requestNotificationPermission,
} from "./services/notifications";
import { exportTasks, importTasks, loadTasks, saveTasks } from "./services/storage";

type SelectableStatus = "全部" | TaskStatus;
type SelectablePriority = "全部" | TaskPriority;
type NotificationRequestState = "idle" | "requesting" | "granted" | "denied" | "default" | "unsupported" | "error";

interface TaskDraft {
  title: string;
  source: string;
  dueAt: string;
  priority: TaskPriority;
  status: TaskStatus;
  notes: string;
}

interface Filters {
  query: string;
  status: SelectableStatus;
  priority: SelectablePriority;
}

const emptyDraft = (): TaskDraft => ({
  title: "",
  source: "",
  dueAt: toDateTimeLocal(new Date(Date.now() + 60 * 60 * 1000)),
  priority: "中",
  status: "待处理",
  notes: "",
});

export default function App() {
  const [tasks, setTasks] = useState<Task[]>(() => loadTasks());
  const [draft, setDraft] = useState<TaskDraft>(() => emptyDraft());
  const [filters, setFilters] = useState<Filters>({ query: "", status: "全部", priority: "全部" });
  const [clock, setClock] = useState(() => new Date());
  const [permission, setPermission] = useState<NotificationPermission>(() => getNotificationPermission());
  const [notificationRequestState, setNotificationRequestState] = useState<NotificationRequestState>("idle");
  const [showNotificationHelp, setShowNotificationHelp] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<TaskDraft | null>(null);
  const [importMessage, setImportMessage] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    saveTasks(tasks);
  }, [tasks]);

  useEffect(() => {
    const tick = () => setClock(new Date());
    const interval = window.setInterval(tick, 60_000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    const runNotifications = () => {
      const currentPermission = getNotificationPermission();
      setPermission(currentPermission);

      if (currentPermission !== "granted" || !("Notification" in window)) {
        return;
      }

      setTasks((currentTasks) =>
        notifyDueTasks(currentTasks, {
          now: new Date(),
          permission: currentPermission,
          createNotification: (title, options) => new Notification(title, options),
        }),
      );
    };

    runNotifications();
    const interval = window.setInterval(runNotifications, 30_000);
    return () => window.clearInterval(interval);
  }, []);

  const visibleTasks = useMemo(() => {
    const keyword = filters.query.trim().toLocaleLowerCase("zh-CN");

    return tasks.filter((task) => {
      const matchesText =
        keyword.length === 0 ||
        [task.title, task.source, task.notes].some((value) =>
          value.toLocaleLowerCase("zh-CN").includes(keyword),
        );
      const matchesStatus = filters.status === "全部" || task.status === filters.status;
      const matchesPriority = filters.priority === "全部" || task.priority === filters.priority;

      return matchesText && matchesStatus && matchesPriority;
    });
  }, [tasks, filters]);

  const groups = useMemo(() => groupTasksByDueDate(visibleTasks, clock), [visibleTasks, clock]);
  const attentionCount = useMemo(() => getAttentionCount(tasks, clock), [tasks, clock]);
  const activeCount = tasks.filter((task) => task.status !== "已完成").length;
  const completedCount = tasks.length - activeCount;
  const notificationNotice = getNotificationNotice(notificationRequestState, permission);
  const notificationButtonLabel = getNotificationButtonLabel(notificationRequestState, permission);
  const notificationSettingsUrl = getNotificationSettingsUrl(window.location.origin, navigator.userAgent);

  function handleCreateTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft.title.trim() || !draft.dueAt) return;

    const task = createTask({
      title: draft.title,
      source: draft.source || "未填写来源",
      dueAt: draft.dueAt,
      priority: draft.priority,
      status: draft.status,
      notes: draft.notes,
    });

    setTasks((currentTasks) => [task, ...currentTasks]);
    setDraft({ ...emptyDraft(), source: draft.source });
  }

  function startEditing(task: Task) {
    setEditingId(task.id);
    setEditDraft({
      title: task.title,
      source: task.source,
      dueAt: task.dueAt,
      priority: task.priority,
      status: task.status,
      notes: task.notes,
    });
  }

  function cancelEditing() {
    setEditingId(null);
    setEditDraft(null);
  }

  function saveEdit(task: Task) {
    if (!editDraft || !editDraft.title.trim() || !editDraft.dueAt) return;

    setTasks((currentTasks) =>
      currentTasks.map((item) =>
        item.id === task.id
          ? updateTask(item, {
              title: editDraft.title,
              source: editDraft.source || "未填写来源",
              dueAt: editDraft.dueAt,
              priority: editDraft.priority,
              status: editDraft.status,
              notes: editDraft.notes,
              notificationSentAt:
                editDraft.dueAt !== item.dueAt || editDraft.status !== item.status ? null : item.notificationSentAt,
            })
          : item,
      ),
    );
    cancelEditing();
  }

  function setStatus(task: Task, status: TaskStatus) {
    setTasks((currentTasks) => currentTasks.map((item) => (item.id === task.id ? updateTaskStatus(item, status) : item)));
  }

  function removeTask(task: Task) {
    setTasks((currentTasks) => currentTasks.filter((item) => item.id !== task.id));
  }

  async function requestPermission() {
    if (!("Notification" in window)) {
      setPermission("denied");
      setNotificationRequestState("unsupported");
      return;
    }

    setNotificationRequestState("requesting");

    try {
      const nextPermission = await requestNotificationPermission();
      setPermission(nextPermission);

      if (nextPermission === "granted") {
        setNotificationRequestState("granted");
        new Notification("企业微信待办通知已开启", {
          body: "到期事项会在网页打开时提醒。",
        });
        return;
      }

      setNotificationRequestState(nextPermission === "denied" ? "denied" : "default");
    } catch {
      setPermission(getNotificationPermission());
      setNotificationRequestState("error");
    }
  }

  function downloadBackup() {
    const blob = new Blob([exportTasks(tasks)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `wecom-todo-backup-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function handleImport(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const importedTasks = importTasks(await file.text());
      setTasks(importedTasks);
      setImportMessage(`已导入 ${importedTasks.length} 条待办`);
    } catch (error) {
      setImportMessage(error instanceof Error ? error.message : "导入失败");
    } finally {
      event.target.value = "";
    }
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">个人企业微信事项</p>
          <h1>待办工作台</h1>
        </div>
        <div className="topbar-actions">
          <button
            className="secondary-button"
            type="button"
            disabled={notificationRequestState === "requesting"}
            onClick={requestPermission}
          >
            <Bell size={16} />
            {notificationButtonLabel}
          </button>
          <button className="icon-button" type="button" aria-label="导出备份" onClick={downloadBackup}>
            <Download size={17} />
          </button>
          <button className="icon-button" type="button" aria-label="导入备份" onClick={() => fileInputRef.current?.click()}>
            <Upload size={17} />
          </button>
          <input ref={fileInputRef} className="visually-hidden" type="file" accept="application/json" onChange={handleImport} />
        </div>
      </header>

      <main className="workspace">
        <section className="quick-entry" aria-labelledby="quick-entry-title">
          <div className="section-heading">
            <div>
              <p className="eyebrow">快速记录</p>
              <h2 id="quick-entry-title">新增企业微信待办</h2>
            </div>
            <Plus size={20} />
          </div>

          <form className="entry-form" onSubmit={handleCreateTask}>
            <label>
              <span>待办标题</span>
              <input
                value={draft.title}
                onChange={(event) => setDraft({ ...draft, title: event.target.value })}
                placeholder="例如：回复客户报价"
                required
              />
            </label>
            <label>
              <span>来源人/群</span>
              <input
                value={draft.source}
                onChange={(event) => setDraft({ ...draft, source: event.target.value })}
                placeholder="例如：企业微信/客户群"
              />
            </label>
            <div className="form-row">
              <label>
                <span>截止时间</span>
                <input
                  type="datetime-local"
                  value={draft.dueAt}
                  onChange={(event) => setDraft({ ...draft, dueAt: event.target.value })}
                  required
                />
              </label>
              <label>
                <span>优先级</span>
                <select
                  value={draft.priority}
                  onChange={(event) => setDraft({ ...draft, priority: event.target.value as TaskPriority })}
                >
                  {TASK_PRIORITIES.map((priority) => (
                    <option key={priority}>{priority}</option>
                  ))}
                </select>
              </label>
            </div>
            <label>
              <span>备注</span>
              <textarea
                value={draft.notes}
                onChange={(event) => setDraft({ ...draft, notes: event.target.value })}
                placeholder="补充企业微信原文、处理要求或下一步"
              />
            </label>
            <button className="primary-button" type="submit">
              <Plus size={17} />
              新增待办
            </button>
          </form>
        </section>

        <section className="control-panel" aria-label="筛选与概览">
          <div className="stats-grid">
            <Stat label="待处理" value={activeCount} tone="blue" />
            <Stat label="需关注" value={attentionCount} tone="red" />
            <Stat label="已完成" value={completedCount} tone="green" />
          </div>

          <div className="filters">
            <label className="search-field">
              <Search size={16} />
              <span className="visually-hidden">搜索待办</span>
              <input
                aria-label="搜索待办"
                value={filters.query}
                onChange={(event) => setFilters({ ...filters, query: event.target.value })}
                placeholder="搜索标题、来源、备注"
              />
            </label>
            <label>
              <span>
                <Filter size={14} />
                状态
              </span>
              <select
                value={filters.status}
                onChange={(event) => setFilters({ ...filters, status: event.target.value as SelectableStatus })}
              >
                <option>全部</option>
                {TASK_STATUSES.map((status) => (
                  <option key={status}>{status}</option>
                ))}
              </select>
            </label>
            <label>
              <span>优先级</span>
              <select
                value={filters.priority}
                onChange={(event) => setFilters({ ...filters, priority: event.target.value as SelectablePriority })}
              >
                <option>全部</option>
                {TASK_PRIORITIES.map((priority) => (
                  <option key={priority}>{priority}</option>
                ))}
              </select>
            </label>
          </div>

          <p className="notice" aria-live="polite">
            {notificationNotice}
          </p>
          {notificationRequestState === "denied" ? (
            <button className="link-button" type="button" onClick={() => setShowNotificationHelp(true)}>
              查看开启方法
            </button>
          ) : null}
          {importMessage ? <p className="import-message">{importMessage}</p> : null}
        </section>

        <section className="task-board" aria-label="今日优先待办">
          <TaskGroup
            title="逾期"
            tone="danger"
            tasks={groups.overdue}
            emptyText="没有逾期待办。"
            clock={clock}
            editingId={editingId}
            editDraft={editDraft}
            onEditDraftChange={setEditDraft}
            onStartEdit={startEditing}
            onCancelEdit={cancelEditing}
            onSaveEdit={saveEdit}
            onStatusChange={setStatus}
            onRemove={removeTask}
          />
          <TaskGroup
            title="今天"
            tone="today"
            tasks={groups.today}
            emptyText="今天没有待办。"
            clock={clock}
            editingId={editingId}
            editDraft={editDraft}
            onEditDraftChange={setEditDraft}
            onStartEdit={startEditing}
            onCancelEdit={cancelEditing}
            onSaveEdit={saveEdit}
            onStatusChange={setStatus}
            onRemove={removeTask}
          />
          <TaskGroup
            title="未来"
            tone="future"
            tasks={groups.future}
            emptyText="未来没有排期。"
            clock={clock}
            editingId={editingId}
            editDraft={editDraft}
            onEditDraftChange={setEditDraft}
            onStartEdit={startEditing}
            onCancelEdit={cancelEditing}
            onSaveEdit={saveEdit}
            onStatusChange={setStatus}
            onRemove={removeTask}
          />
          <TaskGroup
            title="已完成"
            tone="done"
            tasks={groups.completed}
            emptyText="暂时没有完成记录。"
            clock={clock}
            editingId={editingId}
            editDraft={editDraft}
            onEditDraftChange={setEditDraft}
            onStartEdit={startEditing}
            onCancelEdit={cancelEditing}
            onSaveEdit={saveEdit}
            onStatusChange={setStatus}
            onRemove={removeTask}
          />
        </section>
      </main>

      {showNotificationHelp ? (
        <div className="modal-backdrop">
          <section
            className="help-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="notification-help-title"
          >
            <div className="dialog-heading">
              <div>
                <p className="eyebrow">浏览器权限</p>
                <h2 id="notification-help-title">开启浏览器通知</h2>
              </div>
              <button
                className="icon-button"
                type="button"
                aria-label="关闭开启方法"
                onClick={() => setShowNotificationHelp(false)}
              >
                <X size={16} />
              </button>
            </div>
            <p className="dialog-intro">浏览器已拒绝当前站点通知。请将本站通知权限改为允许后重试。</p>
            <ol className="help-steps">
              <li>点击地址栏左侧的站点信息图标。</li>
              <li>找到通知权限，并改为允许。</li>
              <li>回到本页后，再次点击开启通知。</li>
            </ol>
            <a className="secondary-button settings-link" href={notificationSettingsUrl} target="_blank" rel="noreferrer">
              打开浏览器通知设置
            </a>
            <p className="settings-url">{notificationSettingsUrl}</p>
          </section>
        </div>
      ) : null}
    </div>
  );
}

interface TaskGroupProps {
  title: string;
  tone: "danger" | "today" | "future" | "done";
  tasks: Task[];
  emptyText: string;
  clock: Date;
  editingId: string | null;
  editDraft: TaskDraft | null;
  onEditDraftChange: (draft: TaskDraft | null) => void;
  onStartEdit: (task: Task) => void;
  onCancelEdit: () => void;
  onSaveEdit: (task: Task) => void;
  onStatusChange: (task: Task, status: TaskStatus) => void;
  onRemove: (task: Task) => void;
}

function TaskGroup(props: TaskGroupProps) {
  return (
    <section className={`task-group task-group-${props.tone}`} aria-label={props.title}>
      <div className="group-header">
        <h2>{props.title}</h2>
        <span>{props.tasks.length}</span>
      </div>
      <div className="task-list">
        {props.tasks.length === 0 ? <p className="empty-state">{props.emptyText}</p> : null}
        {props.tasks.map((task) => (
          <TaskCard key={task.id} task={task} {...props} />
        ))}
      </div>
    </section>
  );
}

function TaskCard({
  task,
  clock,
  editingId,
  editDraft,
  onEditDraftChange,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onStatusChange,
  onRemove,
}: Omit<TaskGroupProps, "title" | "tone" | "tasks" | "emptyText"> & { task: Task }) {
  const editing = editingId === task.id && editDraft;
  const overdue = isTaskOverdue(task, clock);

  if (editing) {
    return (
      <article className="task-card editing">
        <div className="edit-grid">
          <label>
            <span>标题</span>
            <input
              value={editDraft.title}
              onChange={(event) => onEditDraftChange({ ...editDraft, title: event.target.value })}
            />
          </label>
          <label>
            <span>来源</span>
            <input
              value={editDraft.source}
              onChange={(event) => onEditDraftChange({ ...editDraft, source: event.target.value })}
            />
          </label>
          <label>
            <span>截止时间</span>
            <input
              type="datetime-local"
              value={editDraft.dueAt}
              onChange={(event) => onEditDraftChange({ ...editDraft, dueAt: event.target.value })}
            />
          </label>
          <label>
            <span>状态</span>
            <select
              value={editDraft.status}
              onChange={(event) => onEditDraftChange({ ...editDraft, status: event.target.value as TaskStatus })}
            >
              {TASK_STATUSES.map((status) => (
                <option key={status}>{status}</option>
              ))}
            </select>
          </label>
          <label>
            <span>优先级</span>
            <select
              value={editDraft.priority}
              onChange={(event) => onEditDraftChange({ ...editDraft, priority: event.target.value as TaskPriority })}
            >
              {TASK_PRIORITIES.map((priority) => (
                <option key={priority}>{priority}</option>
              ))}
            </select>
          </label>
          <label className="wide">
            <span>备注</span>
            <textarea
              value={editDraft.notes}
              onChange={(event) => onEditDraftChange({ ...editDraft, notes: event.target.value })}
            />
          </label>
        </div>
        <div className="card-actions">
          <button className="secondary-button" type="button" onClick={() => onSaveEdit(task)}>
            <Save size={16} />
            保存
          </button>
          <button className="icon-button" type="button" aria-label={`取消编辑 ${task.title}`} onClick={onCancelEdit}>
            <X size={16} />
          </button>
        </div>
      </article>
    );
  }

  return (
    <article className={`task-card ${overdue ? "is-overdue" : ""}`}>
      <div className="task-main">
        <div>
          <h3>{task.title}</h3>
          <p>{task.source}</p>
        </div>
        <span className={`priority priority-${task.priority}`}>{task.priority}</span>
      </div>
      <div className="task-meta">
        <span className={overdue ? "meta-danger" : ""}>
          {overdue ? <AlertTriangle size={14} /> : null}
          {formatDueLabel(task)}
        </span>
        <select value={task.status} onChange={(event) => onStatusChange(task, event.target.value as TaskStatus)}>
          {TASK_STATUSES.map((status) => (
            <option key={status}>{status}</option>
          ))}
        </select>
      </div>
      {task.notes ? <p className="task-notes">{task.notes}</p> : null}
      <div className="card-actions">
        {task.status === "已完成" ? (
          <button className="secondary-button" type="button" aria-label={`恢复 ${task.title}`} onClick={() => onStatusChange(task, "进行中")}>
            <RotateCcw size={16} />
            恢复
          </button>
        ) : (
          <button className="secondary-button" type="button" aria-label={`完成 ${task.title}`} onClick={() => onStatusChange(task, "已完成")}>
            <Check size={16} />
            完成
          </button>
        )}
        <button className="icon-button" type="button" aria-label={`编辑 ${task.title}`} onClick={() => onStartEdit(task)}>
          <Edit3 size={16} />
        </button>
        <button className="icon-button danger" type="button" aria-label={`删除 ${task.title}`} onClick={() => onRemove(task)}>
          <Trash2 size={16} />
        </button>
      </div>
    </article>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: "blue" | "red" | "green" }) {
  return (
    <div className={`stat stat-${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function getNotificationButtonLabel(state: NotificationRequestState, permission: NotificationPermission): string {
  if (state === "requesting") return "请求中...";
  if (permission === "granted" || state === "granted") return "通知已开启";
  if (state === "denied") return "通知已拒绝";
  return "开启通知";
}

function getNotificationNotice(state: NotificationRequestState, permission: NotificationPermission): string {
  if (state === "requesting") return "正在请求浏览器通知权限，请在弹窗中选择允许。";
  if (state === "granted") return "通知已开启，并已发送测试通知。网页打开时会提醒到期事项。";
  if (state === "denied") return "通知权限已被浏览器拒绝，请在浏览器地址栏或设置中允许通知后重试。";
  if (state === "default") return "未完成授权。关闭权限弹窗后不会发送系统通知，可再次点击开启。";
  if (state === "unsupported") return "当前浏览器不支持系统通知，网站仍会在页面内标出到期和逾期任务。";
  if (state === "error") return "通知权限请求失败，网站仍会在页面内标出到期和逾期任务。";

  return permission === "granted"
    ? "网页打开时会触发到期通知；关闭期间错过的任务会在下次打开后显示为逾期。"
    : "通知未开启时，网站仍会在页面内标出到期和逾期任务。";
}

function getNotificationSettingsUrl(origin: string, userAgent: string): string {
  const encodedOrigin = encodeURIComponent(origin);

  if (/Edg\//.test(userAgent)) {
    return `edge://settings/content/siteDetails?site=${encodedOrigin}`;
  }

  if (/Firefox\//.test(userAgent)) {
    return "about:preferences#privacy";
  }

  return `chrome://settings/content/siteDetails?site=${encodedOrigin}`;
}

function toDateTimeLocal(date: Date): string {
  const pad = (value: number) => value.toString().padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(
    date.getMinutes(),
  )}`;
}
