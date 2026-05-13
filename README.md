# 每日上香

每日上香是一款轻量的跨平台桌宠应用。打开后，桌面上会出现一个小小的像素风香炉；点击“上香”，写下或选择一个愿望，三炷香会慢慢燃烧，伴随烟雾和香灰。香燃尽后窗口自动隐藏，应用仍在系统托盘静默常驻，方便下一次上香。

## 功能

- Windows / macOS 桌面安装应用
- 透明、无边框、小尺寸桌宠窗口
- 支持拖动摆放，窗口位置会保存在本机
- “上香”按钮启动时固定显示在香炉正下方
- 点击“上香”后弹出许愿框，许愿框也会以香炉为锚点展开
- 预设愿望：今日顺遂、平安喜乐、所求皆如愿、工作顺利、身体健康
- 默认燃烧 45 分钟
- 燃烧中播放 45 分钟逐帧像素素材，显示烟雾、香灰、香体变短
- 燃尽后隐藏窗口，托盘后台常驻
- 托盘菜单支持：上香、显示/隐藏、退出

## 隐私

愿望内容只存在于当前应用会话中，不保存到本地文件，不上传网络，也不会进入历史记录。本地只保存窗口位置。

## 开发

需要安装：

- Node.js 20.19+ / 22.12+
- Rust stable
- Windows 或 macOS 对应的 Tauri 系统依赖

常用命令：

```bash
npm install
npm test
npm run build
npm run tauri dev
npm run tauri build
```

## 发布

仓库包含 GitHub Actions 工作流，会在 macOS 和 Windows 上构建安装工件。第一版默认不做代码签名，因此：

- macOS 可能出现 Gatekeeper 提示
- Windows 可能出现 SmartScreen 提示

后续可以配置 Apple Developer ID 和 Windows 代码签名证书来改善安装体验。

## 技术栈

- Tauri 2
- Vite
- TypeScript
- 逐帧 PNG 素材播放
- Vitest

## 许可证

MIT
