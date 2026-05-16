import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import App from "./App";
import { createTask } from "./domain/tasks";
import { exportTasks, STORAGE_KEY } from "./services/storage";

const originalNotificationDescriptor = Object.getOwnPropertyDescriptor(window, "Notification");
const originalSecureContextDescriptor = Object.getOwnPropertyDescriptor(window, "isSecureContext");

function restoreNotification(): void {
  if (originalNotificationDescriptor) {
    Object.defineProperty(window, "Notification", originalNotificationDescriptor);
    Object.defineProperty(globalThis, "Notification", originalNotificationDescriptor);
    return;
  }

  Reflect.deleteProperty(window, "Notification");
  Reflect.deleteProperty(globalThis, "Notification");
}

function restoreSecureContext(): void {
  if (originalSecureContextDescriptor) {
    Object.defineProperty(window, "isSecureContext", originalSecureContextDescriptor);
    return;
  }

  Reflect.deleteProperty(window, "isSecureContext");
}

function mockSecureContext(isSecureContext: boolean): void {
  Object.defineProperty(window, "isSecureContext", {
    configurable: true,
    value: isSecureContext,
  });
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
    mockSecureContext(true);
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-15T09:00:00+08:00"));
  });

  afterEach(() => {
    restoreNotification();
    restoreSecureContext();
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

  it("filters tasks by search text and changes completion state through the edit dialog", async () => {
    render(<App />);

    fireEvent.change(screen.getByLabelText("待办标题"), { target: { value: "确认发票信息" } });
    fireEvent.change(screen.getByLabelText("来源人/群"), { target: { value: "财务群" } });
    fireEvent.change(screen.getByLabelText("截止时间"), { target: { value: "2026-05-15T11:00" } });
    fireEvent.click(screen.getByRole("button", { name: "新增待办" }));

    fireEvent.change(screen.getByLabelText("搜索待办"), { target: { value: "发票" } });
    expect(within(screen.getByRole("region", { name: "今天" })).getByText("确认发票信息")).toBeInTheDocument();

    expect(screen.queryByRole("button", { name: "完成 确认发票信息" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "编辑 确认发票信息" }));
    const completeDialog = screen.getByRole("dialog", { name: "编辑待办" });
    fireEvent.change(within(completeDialog).getByLabelText("状态"), { target: { value: "已完成" } });
    fireEvent.click(within(completeDialog).getByRole("button", { name: "保存修改" }));

    const completed = screen.getByRole("region", { name: "已完成" });
    expect(within(completed).getByText("确认发票信息")).toBeInTheDocument();

    expect(screen.queryByRole("button", { name: "恢复 确认发票信息" })).not.toBeInTheDocument();
    fireEvent.click(within(completed).getByRole("button", { name: "编辑 确认发票信息" }));
    const restoreDialog = screen.getByRole("dialog", { name: "编辑待办" });
    fireEvent.change(within(restoreDialog).getByLabelText("状态"), { target: { value: "进行中" } });
    fireEvent.click(within(restoreDialog).getByRole("button", { name: "保存修改" }));

    expect(within(screen.getByRole("region", { name: "今天" })).getByText("确认发票信息")).toBeInTheDocument();
  });

  it("keeps task handling on cards without an unused detail panel", async () => {
    render(<App />);

    expect(screen.queryByRole("region", { name: "当前待办详情" })).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("待办标题"), { target: { value: "跟进采购合同" } });
    fireEvent.change(screen.getByLabelText("来源人/群"), { target: { value: "企业微信/采购群" } });
    fireEvent.change(screen.getByLabelText("截止时间"), { target: { value: "2026-05-15T16:30" } });
    fireEvent.change(screen.getByLabelText("备注"), { target: { value: "确认盖章版本并同步法务。" } });
    fireEvent.click(screen.getByRole("button", { name: "新增待办" }));

    expect(screen.queryByRole("button", { name: "查看 跟进采购合同" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "完成 跟进采购合同" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "编辑 跟进采购合同" }));
    const dialog = screen.getByRole("dialog", { name: "编辑待办" });
    fireEvent.change(within(dialog).getByLabelText("状态"), { target: { value: "已完成" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "保存修改" }));

    expect(within(screen.getByRole("region", { name: "已完成" })).getByText("跟进采购合同")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "恢复 跟进采购合同" })).not.toBeInTheDocument();
  });

  it("edits an existing task and saves the updated details", async () => {
    render(<App />);

    fireEvent.change(screen.getByLabelText("待办标题"), { target: { value: "整理会议纪要" } });
    fireEvent.change(screen.getByLabelText("来源人/群"), { target: { value: "项目群" } });
    fireEvent.change(screen.getByLabelText("截止时间"), { target: { value: "2026-05-15T17:00" } });
    fireEvent.click(screen.getByRole("button", { name: "新增待办" }));

    fireEvent.click(screen.getByRole("button", { name: "编辑 整理会议纪要" }));
    const dialog = screen.getByRole("dialog", { name: "编辑待办" });
    fireEvent.change(within(dialog).getByLabelText("标题"), { target: { value: "整理客户会议纪要" } });
    fireEvent.change(within(dialog).getByLabelText("来源"), { target: { value: "客户群" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "保存修改" }));

    const today = screen.getByRole("region", { name: "今天" });
    expect(within(today).getByText("整理客户会议纪要")).toBeInTheDocument();
    expect(within(today).getByText("客户群")).toBeInTheDocument();
    expect(screen.queryByText("整理会议纪要")).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "编辑待办" })).not.toBeInTheDocument();
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

    expect(within(screen.getByRole("region", { name: "今日优先待办" })).getByText("导入前的待办")).toBeInTheDocument();

    fireEvent.change(input as HTMLInputElement, {
      target: {
        files: [backupFile],
      },
    });

    expect(await screen.findByText("已导入 1 条待办")).toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: "今日优先待办" })).getByText("导入后的待办")).toBeInTheDocument();
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
    expect(screen.getByText("通知效果：到期待办会弹出系统通知；如果没有看到气泡，请打开 Windows 通知中心查看。")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "发送测试通知" })).toBeInTheDocument();
  });

  it("sends another test notification after notification permission is granted", async () => {
    vi.useRealTimers();
    const notification = mockNotification("granted", Promise.resolve("granted"));
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "发送测试通知" }));

    expect(notification.createNotification).toHaveBeenCalledWith("企业微信待办测试通知", {
      body: "如果你看到了这条系统通知，说明浏览器通知已经可以正常弹出。",
    });
    expect(screen.getByText("已再次发送测试通知。若没有弹窗，请查看 Windows 通知中心或系统通知设置。")).toBeInTheDocument();
  });

  it("schedules a due notification at the task deadline instead of waiting for polling", async () => {
    vi.setSystemTime(new Date("2026-05-15T09:00:17+08:00"));
    const notification = mockNotification("granted", Promise.resolve("granted"));
    render(<App />);

    fireEvent.change(screen.getByLabelText("待办标题"), { target: { value: "准点提醒客户" } });
    fireEvent.change(screen.getByLabelText("来源人/群"), { target: { value: "客户群" } });
    fireEvent.change(screen.getByLabelText("截止时间"), { target: { value: "2026-05-15T09:01" } });
    fireEvent.click(screen.getByRole("button", { name: "新增待办" }));

    await act(async () => {
      vi.advanceTimersByTime(42_000);
    });
    expect(notification.createNotification).not.toHaveBeenCalledWith(
      "企业微信待办到期",
      expect.objectContaining({ body: "准点提醒客户 · 来源：客户群" }),
    );

    await act(async () => {
      vi.advanceTimersByTime(1_000);
    });

    expect(notification.createNotification).toHaveBeenCalledWith(
      "企业微信待办到期",
      expect.objectContaining({ body: "准点提醒客户 · 来源：客户群" }),
    );
  });

  it("reschedules a due notification when the task deadline is edited", async () => {
    vi.setSystemTime(new Date("2026-05-15T09:00:17+08:00"));
    const notification = mockNotification("granted", Promise.resolve("granted"));
    render(<App />);

    fireEvent.change(screen.getByLabelText("待办标题"), { target: { value: "改期提醒客户" } });
    fireEvent.change(screen.getByLabelText("来源人/群"), { target: { value: "客户群" } });
    fireEvent.change(screen.getByLabelText("截止时间"), { target: { value: "2026-05-15T09:10" } });
    fireEvent.click(screen.getByRole("button", { name: "新增待办" }));

    fireEvent.click(screen.getByRole("button", { name: "编辑 改期提醒客户" }));
    const dialog = screen.getByRole("dialog", { name: "编辑待办" });
    fireEvent.change(within(dialog).getByLabelText("截止时间"), { target: { value: "2026-05-15T09:01" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "保存修改" }));

    await act(async () => {
      vi.advanceTimersByTime(43_000);
    });

    expect(notification.createNotification).toHaveBeenCalledWith(
      "企业微信待办到期",
      expect.objectContaining({ body: "改期提醒客户 · 来源：客户群" }),
    );
  });

  it("shows browser settings guidance when notification permission is denied", async () => {
    vi.useRealTimers();
    mockNotification("default", Promise.resolve("denied"));
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "开启通知" }));

    expect(await screen.findByRole("button", { name: "通知已拒绝" })).toBeInTheDocument();
    expect(screen.getByText("通知权限已被浏览器拒绝，请在浏览器地址栏或设置中允许通知后重试。")).toBeInTheDocument();
    const notificationStatus = screen.getByRole("group", { name: "通知状态" });
    expect(within(notificationStatus).getByText("通知权限已被浏览器拒绝，请在浏览器地址栏或设置中允许通知后重试。")).toBeInTheDocument();
    expect(within(notificationStatus).getByRole("button", { name: "查看开启方法" })).toBeInTheDocument();
  });

  it("diagnoses blocked notification permissions before requesting browser permission", async () => {
    vi.useRealTimers();
    mockSecureContext(false);
    const notification = mockNotification("default", Promise.resolve("granted"));
    render(<App />);

    expect(
      screen.getByText("当前地址不是浏览器认可的安全地址，通知权限会被锁成屏蔽。请改用 http://localhost:5173/ 或 HTTPS 后再开启。"),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "开启通知" }));

    expect(notification.requestPermission).not.toHaveBeenCalled();
    expect(await screen.findByRole("button", { name: "通知不可用" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "查看原因和修复方法" }));

    const dialog = screen.getByRole("dialog", { name: "开启浏览器通知" });
    expect(within(dialog).getByText("当前检测结果")).toBeInTheDocument();
    expect(within(dialog).getByText(`当前地址：${window.location.origin}`)).toBeInTheDocument();
    expect(within(dialog).getByText("安全上下文：否")).toBeInTheDocument();
    expect(within(dialog).getByText("浏览器通知接口：支持")).toBeInTheDocument();
    expect(within(dialog).getByText("权限状态：default")).toBeInTheDocument();
    expect(
      within(dialog).getByText("如果已经是 localhost 但通知仍是灰色，检查浏览器的全局通知开关，以及 Windows 设置里的系统通知开关。"),
    ).toBeInTheDocument();
  });

  it("opens browser notification setting guidance after permission is denied", async () => {
    vi.useRealTimers();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    mockNotification("default", Promise.resolve("denied"));
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "开启通知" }));
    fireEvent.click(await screen.findByRole("button", { name: "查看开启方法" }));

    const dialog = screen.getByRole("dialog", { name: "开启浏览器通知" });
    const settingsUrl = `chrome://settings/content/siteDetails?site=${encodeURIComponent(window.location.origin)}`;
    expect(within(dialog).queryByRole("link", { name: "打开浏览器通知设置" })).not.toBeInTheDocument();
    expect(
      within(dialog).getByText("浏览器不允许网页直接打开这类内部设置页，请复制下面地址到地址栏打开。"),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByText("如果当前地址是 192.168.x.x 这类局域网地址，Chrome 可能会把通知权限锁成屏蔽。请改用终端里显示的 Local 地址，例如 http://localhost:5173/。"),
    ).toBeInTheDocument();
    expect(within(dialog).getByText("设置页地址（不是网页链接，请复制后粘贴到地址栏）：")).toBeInTheDocument();
    expect(within(dialog).getByText(settingsUrl)).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole("button", { name: "复制设置地址" }));

    expect(writeText).toHaveBeenCalledWith(settingsUrl);
    expect(await within(dialog).findByText("已复制设置地址，请粘贴到浏览器地址栏打开。")).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole("button", { name: "关闭开启方法" }));

    expect(screen.queryByRole("dialog", { name: "开启浏览器通知" })).not.toBeInTheDocument();
  });

  it("copies the notification settings address with a document fallback", async () => {
    vi.useRealTimers();
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: undefined,
    });
    const execCommand = vi.fn(() => true);
    Object.defineProperty(document, "execCommand", {
      configurable: true,
      value: execCommand,
    });
    mockNotification("default", Promise.resolve("denied"));
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "开启通知" }));
    fireEvent.click(await screen.findByRole("button", { name: "查看开启方法" }));

    const dialog = screen.getByRole("dialog", { name: "开启浏览器通知" });
    fireEvent.click(within(dialog).getByRole("button", { name: "复制设置地址" }));

    expect(execCommand).toHaveBeenCalledWith("copy");
    expect(await within(dialog).findByText("已复制设置地址，请粘贴到浏览器地址栏打开。")).toBeInTheDocument();
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
