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

3. **不要过度拆分提交**
   - 一个功能一个提交就够了
   - 使用 `git rebase -i` 或 `git reset --soft` 来 squash 提交

## 正确的工作流程

### 1. 开发分支工作流

**重要：dev 分支是长期分支，不要删除！**

```bash
# 切换到 dev 分支
git checkout dev

# 开发功能
# ...

# 测试没问题后，squash 成一个提交
git reset --soft main
git commit -m "feat: 功能描述"

# 合并到 main
git checkout main
git merge dev --no-ff -m "merge: 合并功能分支"

# 切换回 dev 继续开发
git checkout dev
```

**永远不要删除 dev 分支！**

**永远不要在 main 分支直接开发！所有修改都在 dev 分支进行！**

### 2. 代码验证

```bash
# 验证 HTML 结构
curl -s http://localhost:8000/ | grep "关键元素"

# 验证 CSS 样式
curl -s http://localhost:8000/ | grep -A 10 "选择器 {"

# 验证 JavaScript 函数
curl -s http://localhost:8000/ | grep -A 20 "function name"
```

### 3. 提交规范

```
feat: 新功能
fix: 修复 bug
refactor: 重构
docs: 文档
style: 样式调整
```

## 技术要点

### CSS 布局

- Modal 使用 `flex` 布局，限制 `max-height: 80vh`
- 内容区域使用 `overflow-y: auto` 实现滚动
- 图片预览网格限制 `max-height: 200px`

### JavaScript

- 使用 `URL.createObjectURL()` 创建预览
- 使用 `URL.revokeObjectURL()` 清理内存
- Canvas 压缩图片时，PNG 保持透明背景需要 `ctx.clearRect()`

### GitHub API

- 使用 `/git/blobs` 上传文件
- 使用 `/git/trees` 创建树
- 使用 `/git/commits` 创建提交
- 使用 `/git/refs/heads/{branch}` 更新分支

## 调试技巧

1. **检查 HTML 结构**：`curl -s URL | grep "元素"`
2. **检查 CSS 样式**：`curl -s URL | grep -A N "选择器 {"`
3. **检查 JavaScript**：`curl -s URL | grep -A N "function name"`
4. **查看提交历史**：`git log --oneline --graph`

## 注意事项

1. **文件编码**：使用 UTF-8
2. **行尾符**：使用 LF（Unix 格式）
3. **缩进**：使用 Tab 或空格（保持一致）
4. **注释**：中文注释即可

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
