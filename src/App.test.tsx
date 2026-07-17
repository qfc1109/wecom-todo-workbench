import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import App from "./App";

describe("App", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-15T09:00:00+08:00"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders a work-item list workspace inspired by WeCom issue tables", () => {
    render(<App />);

    expect(screen.getByRole("heading", { name: "我的工作" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "创建工作项" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "待办 0" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "已办 0" })).toBeInTheDocument();
    expect(screen.getAllByText("标题")[0]).toBeInTheDocument();
    expect(screen.getAllByText("状态")[0]).toBeInTheDocument();
    expect(screen.getAllByText("优先级")[0]).toBeInTheDocument();
    expect(screen.getAllByText("处理人")[0]).toBeInTheDocument();
    expect(screen.getAllByText("创建时间")[0]).toBeInTheDocument();
  });

  it("opens the quick entry panel from the create work item action", () => {
    render(<App />);

    expect(screen.queryByLabelText("待办标题")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "创建工作项" }));

    expect(screen.getByLabelText("待办标题")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "新增待办" })).toBeInTheDocument();
  });

  it("adds a manual WeCom todo and places it in the today group", async () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "创建工作项" }));
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

    fireEvent.click(screen.getByRole("button", { name: "创建工作项" }));
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
});
