# Agent 经验教训

## 项目特性

这是一个纯静态站项目，没有编译步骤：
- `index.html` 是单文件应用，直接修改即可生效
- `functions/` 目录是 Cloudflare Functions，部署时自动处理
- 不需要启动本地服务器测试，改了就是改了

## 常见错误

### ❌ 不要做的事

1. **不要启动本地服务器测试静态页面**
   - 纯 HTML/CSS/JS 文件直接修改即可
   - 启动 `python3 -m http.server` 或 `npx serve` 是浪费时间
   - 只需要验证文件内容正确即可

2. **不要创建不必要的编译步骤**
   - 项目没有 build 流程
   - 不需要 npm install、webpack、vite 等
   - 直接编辑 `index.html` 即可

## 开发分支工作流

- 长期分支：`dev`，不要删除；所有开发在 `dev` 上，永远不要直接改 `main`
- 动手前：`git checkout dev`，`git fetch origin`，确认分支正确
- `main` 分支提交历史对外展示，保持干净。commit 上有 tweet 提交（发帖即 commit）和 squash 过的代码历史，所以 `dev` 要主动 `merge main` 来同步：
- 合并方向只能是 dev ← main；**严禁 `rebase dev`、`reset --soft main`**（会重演/揉捏已合并历史，冲突爆炸）
- dev 合并 main 出现冲突时：`index.html`、`functions/` 等代码文件以 main 为准
- 新功能进 main 用 squash：每次改动只提交一次
- 合完切回 `dev` 继续开发
- `push` 必须用户明确说了才做，不擅自 push


## 技术要点

### CSS 布局

- Modal 使用 `flex` 布局，限制 `max-height: 80vh`
- 内容区域使用 `overflow-y: auto` 实现滚动
- 图片预览网格限制 `max-height: 200px`

### JavaScript

- 使用 `URL.createObjectURL()` 创建预览
- 使用 `URL.revokeObjectURL()` 清理内存
- Canvas 压缩图片时，PNG 保持透明背景需要 `ctx.clearRect()`

## 部署

项目使用 Cloudflare Pages 部署：
- 推送到 GitHub 后自动部署
- `functions/` 目录会被识别为 Cloudflare Functions
- 静态文件直接托管

## 常见问题

### Q: 图片上传后不显示？
A: 检查 commit message 是否以 `:` 结尾

### Q: 透明 PNG 变黑？
A: Canvas 压缩时需要 `ctx.clearRect()` 清除背景

### Q: Modal 无法滚动？
A: 给 `.modal-body` 添加 `overflow-y: auto`

### Q: 图片预览太大？
A: 限制 `.image-preview-grid` 的 `max-height`
