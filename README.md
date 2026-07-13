# 产业供需坐标

面向普通用户的行业研究静态网站。页面通过关系图谱、产业链、供需、利润、周期和证据视图展示 `industry-cycle-analysis` Skill 的分析结果。

网站不包含账号、上传、投稿、评论、数据库或服务端接口。18 份案例和原始 Markdown 都会在构建时打包为静态资源，可部署到 GitHub Pages、Vercel 或任意静态文件托管平台。

## 本地运行

```powershell
npm.cmd install
npm.cmd run dev
```

生产构建与预览：

```powershell
npm.cmd run build
npm.cmd run serve
```

浏览器访问 `http://127.0.0.1:5173/`。

## 更新行业报告

根目录中以数字编号开头的 Markdown 是案例源文件。修改或新增报告后运行：

```powershell
npm.cmd run build
```

构建脚本会重新生成 `src/data/cases.json` 和 `public/official-reports/`。同一行业按行业名称去重，数据日期更新的版本优先。

## GitHub Pages

发布当前版本：

```powershell
npm.cmd run deploy
```

该命令会重新生成案例、构建 `dist/`，再把产物发布到 `gh-pages` 分支。仓库的 Pages 来源设置为该分支后，默认的 `github.io/仓库名/` 地址与自定义域名都可工作。

## 使用边界

- 网站只展示仓库内维护的静态案例。
- 用户可以阅读详情、查看或下载原始 Markdown。
- Skill 调用词只帮助用户在自己的模型中运行 Skill，不会把结果发送到本站。
- 若未来恢复上传、社区或后台审核，需要重新引入独立后端和数据存储。
