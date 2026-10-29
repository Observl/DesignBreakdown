# DesignBreakdown · 拾形

将公开网页拆解为可收藏的设计片段。

## 已实现

- Playwright Chromium 实际加载网页、滚动触发懒加载、生成网页与区域 JPEG 截图。
- 根据 DOM、计算样式、布局、字号、渐变、圆角、阴影等规则提取最多 16 个候选片段。
- 导航 / 布局 / 组件 / 排版 / 交互分类；查看字体、颜色、来源与采集时间；在整页截图定位。
- 批量收藏、收藏夹、搜索、备注和删除确认。图片及片段快照存入 IndexedDB；不同网页的收藏不会互相覆盖。
- 旧版本演示收藏可迁移，保留“历史演示素材”标识。
- 不向前端传递或执行目标网页的 HTML、脚本。

这不是 AI 审美模型。“交互”来自 CSS 过渡/动画声明，不代表已验证 hover、点击行为，也不包含动效录制。

## Render 部署

[Deploy to Render](https://render.com/deploy?repo=https://github.com/Observl/DesignBreakdown)

1. 登录 Render，连接此仓库并应用根目录的 render.yaml。
2. 创建 Docker Web Service；配置使用免费方案，确认 Render 当前显示的方案后部署。
3. 等待 /health 返回 ok:true、service:designbreakdown。Render 会提供实际服务网址，不要猜测网址。
4. 打开 GitHub Pages 前端，点击“连接抓取服务”，填入该 Render 服务网址并检测保存。
5. 输入公开网页地址，点击“开始拆解”。

Render 服务根路径也提供完整前端，在 onrender.com 域名下会自动连接同源后端。
免费服务休眠后首次启动可能较慢。后端最大同时抓取数为 1；忙时返回可重试提示。

## 本地运行

需要 Node.js 22+。

```sh
npm ci
npx playwright install --with-deps chromium
npm start
```

打开 http://localhost:10000 。可选环境变量：

- PORT：默认 10000。
- ALLOWED_ORIGIN：逗号分隔的允许来源，默认 https://observl.github.io；Render 自身域名和本机地址自动加入。
- MAX_CONCURRENT：默认 1，最大 3，免费实例保持 1。
- CHROMIUM_EXECUTABLE：可选，使用本机安装的 Chrome 执行文件。

## 测试

```sh
npm test
```

覆盖 URL / DNS 地址校验、代理拦截内网、真实 DOM 和计算样式提取、区域截图、恶意标题转义、批量收藏、刷新持久化、连续抓取隔离和窄屏布局。GitHub Actions 使用与 Docker 相同的 Playwright 镜像执行测试。

## 接口

POST /api/analyze，JSON 请求：{"url":"https://目标网页"}。
成功返回 source、title、capturedAt、screenshot、width、height 和 fragments；片段包含 id、name、type、desc、tags、rect、style、image、source。
失败返回非 2xx 和 error；不会返回演示结果。

## 抓取边界

只访问无需登录、使用标准端口的公开 HTTP/HTTPS 网页。代理在连接前检查全部 DNS 结果并固定实际连接 IP，阻止本机、内网、云元数据等地址及 DNS 重绑定。重定向和资源请求也经过代理。该服务仅适合个人低流量使用；CORS 不等于身份验证，公开运营前需加入用户认证、计费限制和更严格的资源配额。

最长抓取 85 秒，页面前 14000 像素，最多 16 个片段。不能绕过登录、验证码或反爬机制；复杂 Canvas、WebGL、滚动锁定和嵌套框架可能无法完整识别。图片是采集时的静态快照，收藏保存在当前浏览器，不跨设备同步。

## GitHub Pages

.github/workflows/pages.yml 发布根目录 index.html。
GitHub Pages 只托管前端，不会运行抓取后端。后端由 Render 运行，GitHub Actions 另执行回归测试。
