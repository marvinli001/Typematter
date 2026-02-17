type AskScope = "page" | "section" | "site";

type AskRequest = {
  question: string;
  language: string;
  scope: AskScope;
  currentRoute: string;
  currentSection: string;
  siteContext: {
    title: string;
  };
};

type AskIndexItem = {
  id: string;
  title: string;
  section: string;
  href: string;
  route: string;
  language?: string;
  anchor: string;
  heading?: string;
  content: string;
};

type SourceCandidate = {
  id: string;
  title: string;
  href: string;
  route: string;
  section: string;
  anchor: string;
  snippet: string;
  score: number;
};

type StreamUsage = {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
};

type Env = {
  AI: {
    autorag: (name: string) => {
      search: (options: Record<string, unknown>) => Promise<any>;
    };
  };
  OPENAI_API_HOST: string;
  OPENAI_API_KEY: string;
  OPENAI_MODEL: string;
  AI_SEARCH_INSTANCE: string;
  AI_SEARCH_RERANK_MODEL?: string;
  DOCS_ORIGIN: string;
};

const ASK_INDEX_CACHE_TTL_MS = 5 * 60 * 1000;
const MAX_KEYWORD_CANDIDATES = 20;
const MAX_VECTOR_CANDIDATES = 20;
const MAX_FINAL_SOURCES = 8;
const RRF_K = 60;
const ASK_ENDPOINT_PATHS = new Set(["/v1/ask", "/ask", "/api/ask"]);
const DEFAULT_DOCS_ORIGIN = "https://docs.example.com";

let askIndexCache:
  | {
      origin: string;
      expiresAt: number;
      items: AskIndexItem[];
    }
  | null = null;

function normalizeRoute(route: string) {
  if (!route || route === "/") {
    return "/";
  }
  const cleaned = route.replace(/^\/+|\/+$/g, "");
  return cleaned ? `/${cleaned}` : "/";
}

function isCn(language: string) {
  const normalized = language.toLowerCase();
  return normalized.startsWith("cn") || normalized.startsWith("zh");
}

function toTitleFromPath(pathname: string) {
  const parts = pathname.split("/").filter(Boolean);
  if (parts.length === 0) {
    return "Overview";
  }
  const last = parts[parts.length - 1];
  return last
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function buildCorsHeaders(origin: string) {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    Vary: "Origin",
  };
}

function normalizeOrigin(raw: string | null | undefined) {
  if (!raw) {
    return "";
  }
  try {
    const parsed = new URL(raw.trim());
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return "";
    }
    return parsed.origin;
  } catch {
    return "";
  }
}

function parseConfiguredOrigins(raw: string | undefined) {
  if (!raw) {
    return [];
  }
  const parts = raw
    .split(/[,\s]+/g)
    .map((item) => normalizeOrigin(item))
    .filter(Boolean);
  return Array.from(new Set(parts));
}

function stripWwwHost(origin: string) {
  try {
    return new URL(origin).host.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

function sameSiteHost(left: string, right: string) {
  const leftHost = stripWwwHost(left);
  const rightHost = stripWwwHost(right);
  return Boolean(leftHost) && leftHost === rightHost;
}

function resolveDocsOrigin(
  configuredRaw: string | undefined,
  requestOrigin: string
) {
  const configured = parseConfiguredOrigins(configuredRaw).filter(
    (item) => item !== DEFAULT_DOCS_ORIGIN
  );
  if (requestOrigin) {
    const exact = configured.find((item) => item === requestOrigin);
    if (exact) {
      return exact;
    }
    const alias = configured.find((item) => sameSiteHost(item, requestOrigin));
    if (alias) {
      return requestOrigin;
    }
  }
  if (configured.length > 0) {
    return configured[0];
  }
  if (requestOrigin) {
    return requestOrigin;
  }
  return DEFAULT_DOCS_ORIGIN;
}

function resolveCorsOrigin(
  configuredRaw: string | undefined,
  requestOrigin: string,
  docsOrigin: string
) {
  if (!requestOrigin) {
    return docsOrigin;
  }
  const configured = parseConfiguredOrigins(configuredRaw).filter(
    (item) => item !== DEFAULT_DOCS_ORIGIN
  );
  if (configured.length === 0) {
    return requestOrigin;
  }
  const allowed = configured.some(
    (item) => item === requestOrigin || sameSiteHost(item, requestOrigin)
  );
  return allowed ? requestOrigin : docsOrigin;
}

function containsCjk(value: string) {
  return /[\u3400-\u9fff]/.test(value);
}

function buildCharNgrams(text: string, size: number) {
  const chars = Array.from(text);
  if (chars.length <= size) {
    return [text];
  }
  const grams: string[] = [];
  for (let i = 0; i <= chars.length - size; i += 1) {
    grams.push(chars.slice(i, i + size).join(""));
  }
  return grams;
}

function tokenizeQuestion(question: string) {
  const normalized = question.trim().toLowerCase();
  if (!normalized) {
    return [];
  }

  const rawTokens = normalized
    .split(/[\s,.;:!?()[\]{}，。！？；：、（）【】《》“”‘’"']+/g)
    .map((token) => token.trim())
    .filter(Boolean);
  const wordTokens: string[] = [];

  rawTokens.forEach((token) => {
    if (containsCjk(token)) {
      wordTokens.push(...buildCharNgrams(token, 2));
      if (token.length <= 12) {
        wordTokens.push(...buildCharNgrams(token, 3));
      }
      return;
    }
    if (token.length >= 2) {
      wordTokens.push(token);
    }
  });

  if (wordTokens.length > 0) {
    return Array.from(new Set(wordTokens));
  }

  const compact = normalized.replace(/\s+/g, "");
  const chars = Array.from(compact);
  if (chars.length <= 2) {
    return compact ? [compact] : [];
  }

  const grams: string[] = [];
  for (let i = 0; i < chars.length - 1; i += 1) {
    grams.push(chars.slice(i, i + 2).join(""));
  }
  return Array.from(new Set(grams));
}

function scoreByTokens(text: string, tokens: string[]) {
  if (!text || tokens.length === 0) {
    return 0;
  }
  const lower = text.toLowerCase();
  let score = 0;
  tokens.forEach((token) => {
    if (lower.includes(token)) {
      score += 1;
    }
  });
  return score;
}

function compressSnippet(text: string, question: string, maxLength = 280) {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= maxLength) {
    return clean;
  }

  const tokens = tokenizeQuestion(question);
  const lower = clean.toLowerCase();
  let index = -1;
  for (const token of tokens) {
    const found = lower.indexOf(token);
    if (found !== -1) {
      index = found;
      break;
    }
  }

  if (index === -1) {
    return `${clean.slice(0, maxLength)}...`;
  }

  const start = Math.max(0, index - Math.floor(maxLength * 0.35));
  const end = Math.min(clean.length, start + maxLength);
  let snippet = clean.slice(start, end).trim();
  if (start > 0) {
    snippet = `...${snippet}`;
  }
  if (end < clean.length) {
    snippet = `${snippet}...`;
  }
  return snippet;
}

function matchesLanguage(route: string, language: string, itemLanguage?: string) {
  const normalizedLanguage = language.toLowerCase();
  if (itemLanguage && itemLanguage.toLowerCase() !== normalizedLanguage) {
    return false;
  }

  if (normalizedLanguage === "cn" || normalizedLanguage === "en") {
    const prefix = `/${normalizedLanguage}`;
    return route === prefix || route.startsWith(`${prefix}/`);
  }

  return true;
}

function inScope(
  candidate: { route: string; section: string },
  payload: AskRequest
) {
  const currentRoute = normalizeRoute(payload.currentRoute);
  if (payload.scope === "site") {
    return true;
  }
  if (payload.scope === "page") {
    return normalizeRoute(candidate.route) === currentRoute;
  }
  return candidate.section === payload.currentSection;
}

async function fetchAskIndex(env: Env) {
  const now = Date.now();
  if (
    askIndexCache &&
    askIndexCache.origin === env.DOCS_ORIGIN &&
    askIndexCache.expiresAt > now
  ) {
    return askIndexCache.items;
  }

  const askIndexUrl = new URL("/typematter/ask-index.json", env.DOCS_ORIGIN).toString();
  const response = await fetch(askIndexUrl, {
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch ask index (${response.status}).`);
  }

  const parsed = (await response.json()) as AskIndexItem[];
  const items = Array.isArray(parsed) ? parsed : [];
  askIndexCache = {
    origin: env.DOCS_ORIGIN,
    expiresAt: now + ASK_INDEX_CACHE_TTL_MS,
    items,
  };
  return items;
}

function keywordRecall(index: AskIndexItem[], payload: AskRequest) {
  const tokens = tokenizeQuestion(payload.question);
  const normalizedQuestion = payload.question.trim().toLowerCase();

  return index
    .filter((item) => {
      if (!matchesLanguage(item.route, payload.language, item.language)) {
        return false;
      }
      return inScope(
        { route: item.route, section: item.section || "" },
        payload
      );
    })
    .map<SourceCandidate | null>((item) => {
      const titleScore = scoreByTokens(item.title, tokens) * 2;
      const headingScore = scoreByTokens(item.heading ?? "", tokens) * 1.5;
      const bodyScore = scoreByTokens(item.content, tokens);
      const phraseBonus = item.content.toLowerCase().includes(normalizedQuestion)
        ? 1.5
        : 0;
      const score = titleScore + headingScore + bodyScore + phraseBonus;
      if (score <= 0) {
        return null;
      }

      return {
        id: item.id,
        title: item.title,
        href: item.href,
        route: item.route,
        section: item.section,
        anchor: item.anchor || "top",
        snippet: item.content,
        score,
      };
    })
    .filter((item): item is SourceCandidate => Boolean(item))
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_KEYWORD_CANDIDATES);
}

function toRouteFromUrl(raw: string) {
  if (!raw) {
    return "/";
  }
  try {
    const url = new URL(raw);
    return normalizeRoute(url.pathname);
  } catch {
    return normalizeRoute(raw);
  }
}

function toAnchorFromUrl(raw: string) {
  if (!raw) {
    return "top";
  }
  try {
    const url = new URL(raw);
    return url.hash ? url.hash.replace(/^#/, "") || "top" : "top";
  } catch {
    return "top";
  }
}

async function vectorRecall(
  env: Env,
  payload: AskRequest,
  routeToSection: Map<string, string>
) {
  const autorag = env.AI.autorag(env.AI_SEARCH_INSTANCE);
  const baseOptions = {
    query: payload.question,
    max_num_results: MAX_VECTOR_CANDIDATES,
    ranking_options: {
      score_threshold: 0.05,
    },
  };
  const rerankModel = String(env.AI_SEARCH_RERANK_MODEL ?? "").trim();
  let response: any;

  try {
    response = await autorag.search(
      rerankModel
        ? {
            ...baseOptions,
            reranking: {
              enabled: true,
              model: rerankModel,
            },
          }
        : baseOptions
    );
  } catch (primaryError) {
    if (!rerankModel) {
      throw primaryError;
    }
    response = await autorag.search(baseOptions);
  }

  const records = Array.isArray(response?.data)
    ? response.data
    : Array.isArray(response?.results)
      ? response.results
      : [];

  const normalizedLanguage = payload.language.toLowerCase();
  const sources: SourceCandidate[] = [];
  records.forEach((record: any, index: number) => {
    const rawUrl =
      String(record?.attributes?.file?.url ?? record?.url ?? record?.source ?? "");
    const route = toRouteFromUrl(rawUrl);
    if (!matchesLanguage(route, normalizedLanguage)) {
      return;
    }

    const section =
      String(record?.attributes?.section ?? routeToSection.get(route) ?? "").trim();
    if (
      !inScope(
        {
          route,
          section,
        },
        payload
      )
    ) {
      return;
    }

    const snippet = String(
      record?.content ?? record?.attributes?.content ?? record?.snippet ?? ""
    ).trim();
    const score = Number(record?.score ?? record?.rerank_score ?? 0) || 0;

    sources.push({
      id: `vector-${index + 1}-${route}`,
      title:
        String(record?.attributes?.title ?? record?.title ?? "").trim() ||
        toTitleFromPath(route),
      href: route,
      route,
      section,
      anchor: String(record?.attributes?.anchor ?? toAnchorFromUrl(rawUrl) ?? "top"),
      snippet,
      score,
    });
  });

  return sources.slice(0, MAX_VECTOR_CANDIDATES);
}

function fuseCandidates(
  lexical: SourceCandidate[],
  vector: SourceCandidate[],
  currentRoute: string
) {
  const index = new Map<string, SourceCandidate & { fused: number }>();
  const route = normalizeRoute(currentRoute);
  const add = (item: SourceCandidate, rank: number, weight: number) => {
    const key = `${normalizeRoute(item.href)}#${item.anchor || "top"}`;
    const current = index.get(key);
    const incremental = weight / (RRF_K + rank + 1);
    if (current) {
      current.fused += incremental;
      current.score = Math.max(current.score, item.score);
      if (!current.snippet && item.snippet) {
        current.snippet = item.snippet;
      }
      return;
    }

    index.set(key, {
      ...item,
      fused: incremental,
    });
  };

  lexical.forEach((item, rank) => add(item, rank, 1.0));
  vector.forEach((item, rank) => add(item, rank, 0.9));

  return Array.from(index.values())
    .map((item) => ({
      ...item,
      fused: item.fused + (normalizeRoute(item.route) === route ? 0.03 : 0),
    }))
    .sort((a, b) => b.fused - a.fused)
    .slice(0, MAX_FINAL_SOURCES)
    .map(({ fused: _, ...item }) => item);
}

function buildCitedFallback(language: string) {
  return isCn(language)
    ? "我暂时无法从当前检索结果中找到可验证证据，无法给出确定答案。请换个问法或扩大检索范围。"
    : "I do not have enough verifiable evidence in the retrieved docs to answer confidently. Try rephrasing or broadening the scope.";
}

function buildPrompt(payload: AskRequest, sources: SourceCandidate[]) {
  const evidence = sources
    .map(
      (source, index) =>
        `[S${index + 1}]\nTitle: ${source.title}\nRoute: ${source.href}#${
          source.anchor || "top"
        }\nSnippet: ${compressSnippet(source.snippet, payload.question, 320)}`
    )
    .join("\n\n");

  const cn = isCn(payload.language);
  const systemMessage = cn
    ? [
        "你是文档问答助手。严格遵守：",
        "1) 只能依据给定证据回答，不可编造。",
        "2) 每个关键结论必须附 [S#] 引用。",
        "3) 若证据不足，明确写“文档未覆盖/不确定”。",
        "4) 输出结构固定：简答（2-5行）+ 分步骤建议。",
      ].join("\n")
    : [
        "You are a docs QA assistant. Follow these rules strictly:",
        "1) Only answer based on provided evidence. No fabrication.",
        "2) Every key claim must include [S#] citations.",
        "3) If evidence is insufficient, clearly say uncertain / not covered.",
        "4) Output format: short answer (2-5 lines) + step-by-step guidance.",
      ].join("\n");

  const userMessage = [
    `Question: ${payload.question}`,
    `Language: ${payload.language}`,
    `Scope: ${payload.scope}`,
    `Current route: ${payload.currentRoute}`,
    `Current section: ${payload.currentSection}`,
    "",
    "Evidence:",
    evidence,
  ].join("\n");

  return {
    systemMessage,
    userMessage,
  };
}

function buildFollowups(language: string) {
  if (isCn(language)) {
    return [
      "能给我一个最短执行清单吗？",
      "这个方案的前置条件和限制是什么？",
      "如果失败，优先检查哪些点？",
    ];
  }
  return [
    "Can you give me a shortest actionable checklist?",
    "What prerequisites and constraints should I verify?",
    "If this fails, what should I check first?",
  ];
}

function toOpenAiUsage(raw: any): StreamUsage {
  if (!raw || typeof raw !== "object") {
    return {};
  }
  return {
    promptTokens:
      typeof raw.prompt_tokens === "number" ? raw.prompt_tokens : undefined,
    completionTokens:
      typeof raw.completion_tokens === "number" ? raw.completion_tokens : undefined,
    totalTokens:
      typeof raw.total_tokens === "number" ? raw.total_tokens : undefined,
  };
}

function shouldDisableThinking(model: string) {
  const normalized = model.trim().toLowerCase();
  return normalized === "qwen3.5-plus";
}

async function streamChatCompletion(
  env: Env,
  payload: AskRequest,
  sources: SourceCandidate[],
  writeEvent: (eventName: string, data: unknown) => Promise<void>
) {
  const { systemMessage, userMessage } = buildPrompt(payload, sources);
  const baseUrl = env.OPENAI_API_HOST.replace(/\/+$/, "");
  const url = `${baseUrl}/chat/completions`;
  const extraBody =
    shouldDisableThinking(env.OPENAI_MODEL)
      ? {
          extra_body: {
            enable_thinking: false,
          },
        }
      : {};
  const requestVariants = [
    {
      ...extraBody,
      model: env.OPENAI_MODEL,
      stream: true,
      stream_options: {
        include_usage: true,
      },
      temperature: 0.2,
      messages: [
        { role: "system", content: systemMessage },
        { role: "user", content: userMessage },
      ],
    },
    {
      ...extraBody,
      model: env.OPENAI_MODEL,
      stream: true,
      messages: [
        { role: "system", content: systemMessage },
        { role: "user", content: userMessage },
      ],
    },
  ];

  let response: Response | null = null;
  let lastErrorMessage = "";
  for (const body of requestVariants) {
    const candidate = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify(body),
    });
    if (candidate.ok && candidate.body) {
      response = candidate;
      break;
    }
    lastErrorMessage = await candidate.text().catch(() => "");
    if (!lastErrorMessage) {
      lastErrorMessage = `Chat completion request failed with ${candidate.status}.`;
    }
  }

  if (!response || !response.body) {
    throw new Error(lastErrorMessage || "Chat completion request failed.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffered = "";
  let usage: StreamUsage = {};

  while (true) {
    const { value, done } = await reader.read();
    if (done) {
      break;
    }
    if (!value) {
      continue;
    }

    buffered += decoder.decode(value, { stream: true });
    const lines = buffered.split(/\r?\n/);
    buffered = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith("data:")) {
        continue;
      }
      const payloadText = trimmed.slice("data:".length).trim();
      if (!payloadText || payloadText === "[DONE]") {
        continue;
      }

      const parsed = (() => {
        try {
          return JSON.parse(payloadText) as any;
        } catch {
          return null;
        }
      })();
      if (!parsed) {
        continue;
      }

      const delta = parsed?.choices?.[0]?.delta?.content;
      if (typeof delta === "string" && delta.length > 0) {
        await writeEvent("delta", { delta });
      }

      if (parsed.usage) {
        usage = toOpenAiUsage(parsed.usage);
      }
    }
  }

  return usage;
}

function validateAskPayload(raw: unknown): AskRequest {
  if (!raw || typeof raw !== "object") {
    throw new Error("Invalid request body.");
  }

  const payload = raw as Partial<AskRequest>;
  const question = String(payload.question ?? "").trim();
  if (!question) {
    throw new Error("Question is required.");
  }

  const language = String(payload.language ?? "en").trim() || "en";
  const scope = String(payload.scope ?? "page") as AskScope;
  if (scope !== "page" && scope !== "section" && scope !== "site") {
    throw new Error("Invalid scope.");
  }

  const currentRoute = normalizeRoute(String(payload.currentRoute ?? "/"));
  const currentSection = String(payload.currentSection ?? "").trim();
  const title = String(payload.siteContext?.title ?? "").trim() || "Untitled";

  return {
    question,
    language,
    scope,
    currentRoute,
    currentSection,
    siteContext: {
      title,
    },
  };
}

async function retrieveSources(env: Env, payload: AskRequest) {
  const askIndex = await fetchAskIndex(env);
  const routeToSection = new Map<string, string>();
  askIndex.forEach((item) => {
    const route = normalizeRoute(item.route || item.href);
    if (!routeToSection.has(route) && item.section) {
      routeToSection.set(route, item.section);
    }
  });

  const lexical = keywordRecall(askIndex, payload);
  let vector: SourceCandidate[] = [];
  try {
    vector = await vectorRecall(env, payload, routeToSection);
  } catch {
    vector = [];
  }

  const fused = fuseCandidates(lexical, vector, payload.currentRoute).map((item) => ({
    ...item,
    snippet: compressSnippet(item.snippet, payload.question, 300),
  }));
  return fused;
}

function jsonResponse(
  body: unknown,
  status: number,
  corsHeaders: Record<string, string>
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...corsHeaders,
    },
  });
}

function normalizeEndpointPath(pathname: string) {
  if (!pathname) {
    return "/";
  }
  const cleaned = pathname.replace(/\/+$/, "");
  return cleaned || "/";
}

function healthResponse(
  corsHeaders: Record<string, string>,
  details: {
    docsOrigin: string;
    corsOrigin: string;
    configuredOrigins: string[];
  }
) {
  return jsonResponse(
    {
      status: "ok",
      service: "typematter-ask-ai",
      endpoints: Array.from(ASK_ENDPOINT_PATHS),
      docsOrigin: details.docsOrigin,
      corsOrigin: details.corsOrigin,
      configuredOrigins: details.configuredOrigins,
    },
    200,
    corsHeaders
  );
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const requestOrigin = normalizeOrigin(request.headers.get("Origin"));
    const docsOrigin = resolveDocsOrigin(env.DOCS_ORIGIN, requestOrigin);
    const corsOrigin = resolveCorsOrigin(env.DOCS_ORIGIN, requestOrigin, docsOrigin);
    const configuredOrigins = parseConfiguredOrigins(env.DOCS_ORIGIN);
    const corsHeaders = buildCorsHeaders(corsOrigin);
    const runtimeEnv: Env = {
      ...env,
      DOCS_ORIGIN: docsOrigin,
    };
    const url = new URL(request.url);
    const endpointPath = normalizeEndpointPath(url.pathname);

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders,
      });
    }

    if (request.method === "GET" && (endpointPath === "/" || endpointPath === "/health")) {
      return healthResponse(corsHeaders, {
        docsOrigin,
        corsOrigin,
        configuredOrigins,
      });
    }

    if (request.method !== "POST" || !ASK_ENDPOINT_PATHS.has(endpointPath)) {
      return jsonResponse(
        {
          error: "Not Found",
          message: "Use POST /v1/ask (or /ask, /api/ask).",
        },
        404,
        corsHeaders
      );
    }

    let payload: AskRequest;
    try {
      payload = validateAskPayload(await request.json());
    } catch (error) {
      return jsonResponse(
        {
          error: error instanceof Error ? error.message : "Invalid request body.",
        },
        400,
        corsHeaders
      );
    }

    const stream = new TransformStream();
    const writer = stream.writable.getWriter();
    const encoder = new TextEncoder();
    const writeEvent = async (eventName: string, data: unknown) => {
      await writer.write(
        encoder.encode(`event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`)
      );
    };

    void (async () => {
      try {
        const sources = await retrieveSources(runtimeEnv, payload);
        await writeEvent(
          "sources",
          sources.map((source) => ({
            id: source.id,
            title: source.title,
            href: source.href,
            anchor: source.anchor || "top",
            snippet: source.snippet,
            score: source.score,
          }))
        );

        if (sources.length === 0) {
          await writeEvent("delta", {
            delta: buildCitedFallback(payload.language),
          });
          await writeEvent("done", {
            followups: buildFollowups(payload.language),
            usage: {},
          });
          return;
        }

        const usage = await streamChatCompletion(runtimeEnv, payload, sources, writeEvent);
        await writeEvent("done", {
          followups: buildFollowups(payload.language),
          usage,
        });
      } catch (error) {
        await writeEvent("error", {
          message:
            error instanceof Error ? error.message : "Unexpected worker error.",
        });
      } finally {
        await writer.close();
      }
    })();

    return new Response(stream.readable, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        ...corsHeaders,
      },
    });
  },
};
