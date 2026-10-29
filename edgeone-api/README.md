# 拾形抓取 API · EdgeOne 函数版

此目录独立部署，通过 EdgeOne Pages/Makers MCP 的 deploy_folder 上传，projectType 为 fullstack。不要只上传 index.html。

- GET /health：接口健康状态。
- POST /api/analyze：JSON {"url":"https://公开网页"}，返回真实网页与片段截图。
- cloud-functions 采用平台文件路由。
- 使用 playwright-core 与适合函数环境的 Chromium，不依赖 Docker 常驻服务。
- edgeone.json 设置 120 秒上限，并将含静态二进制资源的模块设为外部模块。
- 保留标准端口、公网 DNS 校验及固定实际连接 IP 的代理，防止内网访问和 DNS 重绑定。
- 默认允许来自 https://observl.github.io 的前端请求。

安装依赖后，通过 MCP 部署整个目录。登录凭据、.edgeone 和 node_modules 不应提交 Git。

必须在真实 EdgeOne 运行环境上验证截图请求成功后，才可宣称迁移成功；本地测试通过不代表云端 Chromium 可以启动。
