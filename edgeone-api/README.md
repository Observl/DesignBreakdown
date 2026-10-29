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


## 云端验证与访问地址限制

2026-10-29，已通过 EdgeOne 云端浏览器实际抓取 https://www.tencent.com/ ，返回 HTTP 200、整页 JPEG 截图和 8 个设计片段。区域图片由前端使用截图和坐标裁出，避免函数环境中逐区域截图失败。

当前中国区 MCP 部署返回的是带签名参数的临时预览域名，有效期约 3 小时。它不能作为无需更新地址的长期后端。未把预览签名写进前端默认配置或仓库。外部网络请求可能被预览访问保护拦截；健康状态和抓取成功是在用户 Chrome 中验证的。

若继续使用此 EdgeOne 部署提供长期 API，需要绑定可用的自有域名。没有自有域名时，需要另选提供长期系统域名的承载方式，例如腾讯云 SCF 函数 URL；该方式尚未配置或部署。
