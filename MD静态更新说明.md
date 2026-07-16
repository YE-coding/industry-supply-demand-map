# 行业 Markdown 静态更新流程

## 最终产品边界

网站是纯静态行业知识展示工具：

- 不提供用户上传、投稿、评论、账号或后台审核；
- 不使用 `localStorage` 保存用户报告；
- 只展示仓库中经过维护者审核的 Markdown；
- 原始 Markdown 会随静态网站一起发布，供查看和下载；
- 不输出买卖建议、目标价或短线判断。

## 更新一个已有行业

1. 在仓库根目录新增或更新 `数字_行业名供需周期分析*.md`。
2. 同一行业存在多份文件时，网页按报告正文中的完整“分析日期”选择最新一份。
3. 执行：

```powershell
npm.cmd run test
npm.cmd run build
```

4. `prebuild` 会自动运行 `scripts/extractCases.mjs`：
   - 解析根目录的报告；
   - 更新 `src/data/cases.json`；
   - 把原始文件复制到 `public/official-reports/`；
   - Vite 再生成静态 `dist/`。
5. 提交并推送 GitHub；Vercel 根据仓库绑定自动部署。

## 新增一个行业

新报告满足命名规则后，会在构建时成为新节点。若要把它放入一级产业或二级环节，同时更新 `src/industryTaxonomy.js`；否则网页将其显示在“待归类案例”。

## 验收

- `npm.cmd run test` 全部通过；
- `npm.cmd run build` 成功；
- 本地 HTTP 页面与 JavaScript 资源返回 `200`；
- 案例库中只出现一个该产业节点；
- 节点显示的报告日期、判断和原始 MD 均来自最新文件；
- 页面中不存在上传、投稿或账号入口。
