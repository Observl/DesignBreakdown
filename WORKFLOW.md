# AI workflow integration v1

默认 DOM/计算样式拆解规则保持不变。现有前端无需修改，仍然展示默认规则结果。此版本只提供接入边界，未配置 AI 服务。

## API

- `GET /api/workflow`：读取版本、输入输出约定。
- `POST /api/analyze`：`{"url":"https://example.com","workflow":"default"}`。省略 workflow 时同样使用默认规则。
- 同一接口传 `"workflow":"ai"` 时，在真实抓取完成后运行筛选适配器；目前未配置，会返回全部默认片段，并在 `workflow.status` 返回 `fallback`、`reason` 返回 `not_configured`。

## 接入位置

Node 服务：`server/workflow-adapter.mjs`；EdgeOne：`edgeone-api/lib/workflow-adapter.mjs`。将 `filterCandidates = null` 替换为异步函数 `filterCandidates(input, {signal})`，在函数内调用未来的 AI workflow。密钥只从服务端环境读取，不放入前端、请求参数或仓库；网络调用应传入 signal，响应需为以下标准对象，其他平台格式由适配器转换。

输入包含 `version: "1.0"`、`source`、`title`、`candidates`。每个候选项包含字符串 id、名称、类型、描述、标签、默认评分、文本（最多4000字符）、区域坐标和计算样式。默认不发送截图或图片。

输出示例：

```json
{"version":"1.0","selectedIds":["1793280000001","1793280000000"]}
```

selectedIds 顺序就是展示顺序；空数组代表筛选后没有合适内容。只能返回输入中已有的字符串 ID，禁止重复。图片和元数据始终取自真实抓取结果，适配器不能覆盖。

默认8秒超时；未配置、异常、超时或输出格式无效时保留默认结果。响应附带 workflow 的版本、模式、状态、候选数量和筛选后数量；错误细节与密钥不会返回客户端。当前前端未开放 AI 开关，未来接入后再开放。

## 验证

`npm test` 包含 Node 与 EdgeOne 两套适配器边界测试，覆盖默认行为、排序、空结果、非法 ID、重复 ID、异常、超时和原始数据保护。接口代码提交不代表新的云端部署已经完成。

## 腾讯云同域预览部署

EdgeOne 部署目录的 index.html 为完整产品前端，diagnostic.html 保留抓取诊断页面。腾讯云预览站点内使用同域 API，并将当前预览 URL 的认证查询参数传给 API；不把限时认证参数写进源码。GitHub Pages 默认地址保持原状，因为跨域请求可能被预览认证层返回401并阻止 CORS。预览地址仍会过期，不能作为永久服务承诺。
