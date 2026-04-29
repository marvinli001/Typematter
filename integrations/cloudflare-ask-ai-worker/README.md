# Typematter Ask AI Worker

Cloudflare Worker endpoint for Typematter `Ask AI` tab.

## 功能

- 提供 `POST /v1/ask` SSE 接口（兼容 `POST /ask`、`POST /api/ask`）。
- 提供健康检查：`GET /` 或 `GET /health`。
- 混合召回流程：
  - 关键词召回：`/typematter/ask-index.json`
  - 向量召回：Cloudflare AI Search（`env.AI.autorag(...).search`）
  - RRF 重排 + 上下文压缩
- 调用 OpenAI Chat Completions 并流式返回。
- SSE 事件顺序：
  1. `sources`
  2. `delta`（多次）
  3. `done`
  4. 异常时 `error`

## 前置条件

- 你已经有 Cloudflare 账号与可用的 AI Search 实例。
- 文档站点可访问，且已生成 `https://<docs-origin>/typematter/ask-index.json`。
- 你有可用的 OpenAI API Key。

## 方式 A：Cloudflare Dashboard（Git 仓库部署，和你截图对应）

### 1) 创建 Worker 项目

1. 进入 Cloudflare Dashboard → Workers & Pages → Create。
2. 选择从 Git 仓库创建（连接你的 Typematter 仓库）。
3. 项目名称建议：`typematter-ask-ai`。

### 2) 构建与部署命令（关键）

推荐配置（仓库根目录作为项目目录）：

- 构建命令：留空（可选），或 `echo "skip build"`
- 部署命令：`npx wrangler deploy --config integrations/cloudflare-ask-ai-worker/wrangler.toml`
- 当前 `wrangler.toml` 已启用 `keep_vars = true`，会保留 Dashboard 中维护的 Variables。

不建议把 Root directory 改成 `integrations/cloudflare-ask-ai-worker`，因为 Worker 入口复用了仓库根目录的 `lib/` 代码。

### 3) 配置环境变量与密钥

在 Worker 项目 Settings → Variables and Secrets 中配置：

- 普通变量（Variables）：
  - `OPENAI_API_HOST=https://api.openai.com/v1`
  - `OPENAI_MODEL=gpt-4.1-mini`（或你的模型）
  - `AI_SEARCH_INSTANCE=<你的 AI Search 实例名>`
  - `AI_SEARCH_RERANK_MODEL=@cf/baai/bge-reranker-base`（可选）
  - `DOCS_ORIGIN=https://<你的文档域名>`
- 密钥（Secrets）：
  - `OPENAI_API_KEY=<你的 OpenAI Key>`

说明：

- `DOCS_ORIGIN` 必须和你的文档站点 origin 一致（用于 CORS 与拉取 ask-index）。
- `OPENAI_API_HOST` 需包含 `/v1`，因为代码会请求 `${OPENAI_API_HOST}/chat/completions`。
- `AI_SEARCH_RERANK_MODEL` 不填也可运行；若填错会自动回退到无 rerank 检索。

### 4) 部署并获取 Worker 域名

1. 点击部署。
2. 部署成功后记录 Worker URL，例如：`https://typematter-ask-ai.<subdomain>.workers.dev`。

## 方式 B：本地 Wrangler CLI 部署

1. 登录 Cloudflare：
   - `npm i -g wrangler`
   - `wrangler login`
2. 在仓库根目录执行部署命令：
   - `wrangler deploy --config integrations/cloudflare-ask-ai-worker/wrangler.toml --keep-vars`
3. 配置密钥：
   - `wrangler secret put OPENAI_API_KEY --config integrations/cloudflare-ask-ai-worker/wrangler.toml`
4. 本地创建环境文件（不要把真实值写进 `wrangler.toml`）：
   - 复制 `integrations/cloudflare-ask-ai-worker/.dev.vars.example` 为 `integrations/cloudflare-ask-ai-worker/.dev.vars`
   - 按需填写：
     - `DOCS_ORIGIN`
     - `OPENAI_API_HOST`
     - `OPENAI_MODEL`
     - `AI_SEARCH_INSTANCE`

说明：Worker 入口会复用根目录下的 `lib/typematter/search-utils`。从仓库根目录运行 wrangler 可以让依赖解析路径保持稳定。

## Typematter 站点侧配置

在文档站点构建环境设置：

- `TYPEMATTER_SITE_URL=https://<docs-origin>`（用于自动生成 `robots.txt` 与 `sitemap.xml`）
- `NEXT_PUBLIC_TYPEMATTER_ASK_AI_ENDPOINT=https://<worker-domain>`
- `NEXT_PUBLIC_TYPEMATTER_ASK_AI_TIMEOUT_MS=25000`（可选）
- `NEXT_PUBLIC_TYPEMATTER_ASK_AI_ENABLED=true`（可选；不填时按 endpoint 自动启用）

## 快速验收

### 1) 检查 ask-index 是否可访问

```bash
curl -I https://<docs-origin>/typematter/ask-index.json
```

### 1.1) 检查 robots 与 sitemap

```bash
curl -I https://<docs-origin>/robots.txt
curl -I https://<docs-origin>/sitemap.xml
```

### 2) 检查 Worker SSE 是否返回

```bash
curl -N https://<worker-domain>/v1/ask \
  -H "Content-Type: application/json" \
  -d '{
    "question":"这个页面的核心结论是什么？",
    "language":"cn",
    "scope":"page",
    "currentRoute":"/cn/core-concepts/components",
    "currentSection":"Core concepts",
    "siteContext":{"title":"Components"}
  }'
```

预期可看到 `event: sources` 先出现，再出现 `event: delta`。

### 2.1) 检查健康状态（可选）

```bash
curl -I https://<worker-domain>/
curl -I https://<worker-domain>/health
```

预期返回 `200`，并带有 JSON 健康信息。

## 常见问题

- 部署成功但前端没有 Ask AI Tab：
  - 检查 `NEXT_PUBLIC_TYPEMATTER_ASK_AI_ENDPOINT` 是否已注入到前端构建环境。
- Worker 返回 CORS 错误：
  - 检查 `DOCS_ORIGIN` 是否与实际站点 origin 完全一致（协议、域名都要一致）。
- 前端显示 `Failed to fetch`，且 Worker 响应头 `Access-Control-Allow-Origin` 是 `https://docs.example.com`：
  - 说明部署时占位变量覆盖了线上真实变量。
  - 修复方式：使用 `--keep-vars` 重新部署，或在 Dashboard 里重新设置 `DOCS_ORIGIN` / `AI_SEARCH_INSTANCE` / `OPENAI_API_HOST` / `OPENAI_MODEL`。
- 明明配置了自定义 API Host，仍返回 OpenAI `invalid_api_key`：
  - 先检查 `/health` 返回的 `docsOrigin/corsOrigin/configuredOrigins` 是否仍是占位值。
  - 再确认 Worker Variables 中 `OPENAI_API_HOST` 已是你的网关地址，且 `OPENAI_API_KEY` 与该网关匹配。
- Worker 提示找不到 ask-index：
  - 先运行 `npm run typematter -- export-registry`，确保 `public/typematter/ask-index.json` 已生成并随站点发布。
