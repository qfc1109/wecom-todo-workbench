import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import App from "./App";
import { createTask } from "./domain/tasks";
import { exportTasks, STORAGE_KEY } from "./services/storage";

const originalNotificationDescriptor = Object.getOwnPropertyDescriptor(window, "Notification");

function restoreNotification(): void {
  if (originalNotificationDescriptor) {
    Object.defineProperty(window, "Notification", originalNotificationDescriptor);
    Object.defineProperty(globalThis, "Notification", originalNotificationDescriptor);
    return;
  }

  Reflect.deleteProperty(window, "Notification");
  Reflect.deleteProperty(globalThis, "Notification");
}

function removeNotificationSupport(): void {
  Reflect.deleteProperty(window, "Notification");
  Reflect.deleteProperty(globalThis, "Notification");
}

function mockNotification(
  permission: NotificationPermission,
  requestResult: Promise<NotificationPermission> | (() => Promise<NotificationPermission>),
) {
  const createNotification = vi.fn(function NotificationMock() {
    return {};
  });
  const notification = Object.assign(createNotification, {
    permission,
    requestPermission: vi.fn(() => (typeof requestResult === "function" ? requestResult() : requestResult)),
  });

  Object.defineProperty(window, "Notification", {
    configurable: true,
    value: notification,
    writable: true,
  });
  Object.defineProperty(globalThis, "Notification", {
    configurable: true,
    value: notification,
    writable: true,
  });

  return { createNotification, requestPermission: notification.requestPermission };
}

describe("App", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-15T09:00:00+08:00"));
  });

  afterEach(() => {
    restoreNotification();
    vi.useRealTimers();
  });

  it("adds a manual WeCom todo and places it in the today group", async () => {
    render(<App />);

    fireEvent.change(screen.getByLabelText("待办标题"), { target: { value: "回复客户报价" } });
    fireEvent.change(screen.getByLabelText("来源人/群"), { target: { value: "企业微信/客户群" } });
    fireEvent.change(screen.getByLabelText("截止时间"), { target: { value: "2026-05-15T18:30" } });
    fireEvent.click(screen.getByRole("button", { name: "新增待办" }));

    const today = screen.getByRole("region", { name: "今天" });
    expect(within(today).getByText("回复客户报价")).toBeInTheDocument();
    expect(within(today).getByText("企业微信/客户群")).toBeInTheDocument();
  });

  it("filters tasks by search text and can complete then restore a task", async () => {
    render(<App />);

    fireEvent.change(screen.getByLabelText("待办标题"), { target: { value: "确认发票信息" } });
    fireEvent.change(screen.getByLabelText("来源人/群"), { target: { value: "财务群" } });
    fireEvent.change(screen.getByLabelText("截止时间"), { target: { value: "2026-05-15T11:00" } });
    fireEvent.click(screen.getByRole("button", { name: "新增待办" }));

    fireEvent.change(screen.getByLabelText("搜索待办"), { target: { value: "发票" } });
    expect(screen.getByText("确认发票信息")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "完成 确认发票信息" }));
    const completed = screen.getByRole("region", { name: "已完成" });
    expect(within(completed).getByText("确认发票信息")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "恢复 确认发票信息" }));
    expect(within(screen.getByRole("region", { name: "今天" })).getByText("确认发票信息")).toBeInTheDocument();
  });

  it("edits an existing task and saves the updated details", async () => {
    render(<App />);

    fireEvent.change(screen.getByLabelText("待办标题"), { target: { value: "整理会议纪要" } });
    fireEvent.change(screen.getByLabelText("来源人/群"), { target: { value: "项目群" } });
    fireEvent.change(screen.getByLabelText("截止时间"), { target: { value: "2026-05-15T17:00" } });
    fireEvent.click(screen.getByRole("button", { name: "新增待办" }));

    fireEvent.click(screen.getByRole("button", { name: "编辑 整理会议纪要" }));
    fireEvent.change(screen.getByLabelText("标题"), { target: { value: "整理客户会议纪要" } });
    fireEvent.change(screen.getByLabelText("来源"), { target: { value: "客户群" } });
    fireEvent.click(screen.getByRole("button", { name: "保存" }));

    expect(screen.getByText("整理客户会议纪要")).toBeInTheDocument();
    expect(screen.getByText("客户群")).toBeInTheDocument();
    expect(screen.queryByText("整理会议纪要")).not.toBeInTheDocument();
  });

  it("imports a backup file and replaces the current task list", async () => {
    vi.useRealTimers();
    const importedTask = createTask(
      { title: "导入后的待办", source: "文件传输助手", dueAt: "2026-05-15T14:00" },
      new Date("2026-05-15T09:00:00+08:00"),
    );
    const storedTask = createTask(
      { title: "导入前的待办", source: "旧数据", dueAt: "2026-05-15T10:00" },
      new Date("2026-05-15T08:00:00+08:00"),
    );
    localStorage.setItem(STORAGE_KEY, JSON.stringify([storedTask]));
    const { container } = render(<App />);
    const input = container.querySelector('input[type="file"]');
    const backupFile = new File([""], "backup.json", { type: "application/json" });
    Object.defineProperty(backupFile, "text", {
      value: () => Promise.resolve(exportTasks([importedTask])),
    });

    expect(screen.getByText("导入前的待办")).toBeInTheDocument();

    fireEvent.change(input as HTMLInputElement, {
      target: {
        files: [backupFile],
      },
    });

    expect(await screen.findByText("已导入 1 条待办")).toBeInTheDocument();
    expect(screen.getByText("导入后的待办")).toBeInTheDocument();
    expect(screen.queryByText("导入前的待办")).not.toBeInTheDocument();
  });

  it("shows inline feedback when browser notifications are unsupported", async () => {
    vi.useRealTimers();
    removeNotificationSupport();
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "开启通知" }));

    expect(await screen.findByText("当前浏览器不支持系统通知，网站仍会在页面内标出到期和逾期任务。")).toBeInTheDocument();
  });

  it("shows a requesting state while waiting for notification permission", async () => {
    vi.useRealTimers();
    mockNotification("default", new Promise(() => undefined));
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "开启通知" }));

    expect(await screen.findByRole("button", { name: "请求中..." })).toBeDisabled();
    expect(screen.getByText("正在请求浏览器通知权限，请在弹窗中选择允许。")).toBeInTheDocument();
  });

  it("confirms notification permission and sends a test notification", async () => {
    vi.useRealTimers();
    const notification = mockNotification("default", Promise.resolve("granted"));
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "开启通知" }));

    expect(await screen.findByRole("button", { name: "通知已开启" })).toBeInTheDocument();
    expect(screen.getByText("通知已开启，并已发送测试通知。网页打开时会提醒到期事项。")).toBeInTheDocument();
    expect(notification.createNotification).toHaveBeenCalledWith("企业微信待办通知已开启", {
      body: "到期事项会在网页打开时提醒。",
    });
  });

  it("shows browser settings guidance when notification permission is denied", async () => {
    vi.useRealTimers();
    mockNotification("default", Promise.resolve("denied"));
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "开启通知" }));

    expect(await screen.findByRole("button", { name: "通知已拒绝" })).toBeInTheDocument();
    expect(screen.getByText("通知权限已被浏览器拒绝，请在浏览器地址栏或设置中允许通知后重试。")).toBeInTheDocument();
  });

  it("opens browser notification setting guidance after permission is denied", async () => {
    vi.useRealTimers();
    mockNotification("default", Promise.resolve("denied"));
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "开启通知" }));
    fireEvent.click(await screen.findByRole("button", { name: "查看开启方法" }));

    const dialog = screen.getByRole("dialog", { name: "开启浏览器通知" });
    const settingsLink = within(dialog).getByRole("link", { name: "打开浏览器通知设置" });
    expect(settingsLink).toHaveAttribute(
      "href",
      `chrome://settings/content/siteDetails?site=${encodeURIComponent(window.location.origin)}`,
    );
    expect(within(dialog).getByText("回到本页后，再次点击开启通知。")).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole("button", { name: "关闭开启方法" }));

    expect(screen.queryByRole("dialog", { name: "开启浏览器通知" })).not.toBeInTheDocument();
  });

  it("shows retry guidance when notification permission is dismissed", async () => {
    vi.useRealTimers();
    mockNotification("default", Promise.resolve("default"));
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "开启通知" }));

    expect(await screen.findByText("未完成授权。关闭权限弹窗后不会发送系统通知，可再次点击开启。")).toBeInTheDocument();
  });

  it("shows page fallback guidance when notification permission request fails", async () => {
    vi.useRealTimers();
    mockNotification("default", () => Promise.reject(new Error("permission failed")));
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "开启通知" }));

    expect(await screen.findByText("通知权限请求失败，网站仍会在页面内标出到期和逾期任务。")).toBeInTheDocument();
  });
});
