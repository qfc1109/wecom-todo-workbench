# WeCom Todo Workbench

一个面向企业微信事项整理的个人待办工作台。它用于把来自企业微信会话、客户群或内部协作场景中的事项手动记录为待办，并按截止时间、优先级和处理状态进行管理。

## 功能

- 快速新增待办：记录标题、来源、截止时间、优先级、状态和备注。
- 任务分组展示：自动按逾期、今天、未来、已完成归类。
- 搜索与筛选：可按标题、来源、备注、状态和优先级查找任务。
- 到期提醒：浏览器通知权限开启后，会对到期任务发送本地提醒。
- 本地保存：任务数据保存在浏览器 localStorage 中。
- 备份恢复：支持导出 JSON 备份，也支持从 JSON 文件导入任务。

## 技术栈

- React 19
- TypeScript
- Vite
- Vitest
- Testing Library
- lucide-react

## 本地使用

按下面步骤操作，不需要翻代码。

### 1. 准备环境

先确认电脑已经安装 Node.js。打开终端后执行：

```bash
node -v
npm -v
```

能看到版本号就可以继续。如果提示找不到命令，请先安装 Node.js。

### 2. 安装依赖

在项目根目录执行：

```bash
npm install
```

如果你使用 PowerShell，遇到脚本权限问题，可以改用：

```bash
npm.cmd install
```

### 3. 启动网站

在项目根目录执行：

```bash
npm run dev
```

PowerShell 也可以用：

```bash
npm.cmd run dev
```

### 4. 打开网站

开发服务默认地址是：

```text
http://localhost:5173/
```

把上面的地址复制到浏览器地址栏打开即可。

如果 `5173` 端口被占用，Vite 会在终端里显示新的地址，例如 `http://localhost:5174/`。这时以终端显示的 `Local:` 地址为准。

### 5. 停止网站

回到运行 `npm run dev` 的终端，按：

```text
Ctrl + C
```

终端询问是否终止时，输入 `Y` 后回车。

### 6. 开启到期通知

进入网站后，点击右上角 `开启通知`。浏览器弹出权限提示时选择允许。

如果你点过拒绝，浏览器会继续拦截通知。页面会显示 `查看开启方法`，按弹窗里的步骤去浏览器设置里把本站通知改为允许，然后回到页面再次点击 `开启通知`。

### 7. 数据保存在哪里

待办数据保存在当前浏览器的 `localStorage` 中。换浏览器、清理网站数据、换电脑都可能看不到原来的待办。需要迁移或备份时，请使用页面右上角的导出按钮保存 JSON 文件，再用导入按钮恢复。

## 常用命令

```bash
npm run dev       # 启动开发环境
npm run build     # 类型检查并构建生产版本
npm run preview   # 预览构建产物
npm test          # 运行测试
npm run lint      # 执行 TypeScript 检查
```

在 PowerShell 执行脚本受限时，可以使用 `npm.cmd`，例如：

```bash
npm.cmd test
npm.cmd run build
npm.cmd run dev
```

## 项目结构

```text
src/
  App.tsx                    # 应用主界面与交互逻辑
  App.css                    # 页面样式
  domain/
    tasks.ts                 # 任务模型、排序、分组和状态更新
    tasks.test.ts            # 任务领域逻辑测试
  services/
    notifications.ts         # 浏览器本地通知逻辑
    notifications.test.ts    # 通知逻辑测试
    storage.ts               # 本地存储、导入和导出
    storage.test.ts          # 存储逻辑测试
  test/
    setup.ts                 # 测试环境配置
```

## 数据说明

当前版本不直接连接企业微信 API。任务来源由用户手动填写，适合记录企业微信聊天、客户群、同事协作中产生的待办事项。所有任务默认只保存在当前浏览器中，如需迁移设备或备份数据，请使用页面中的导出功能。
