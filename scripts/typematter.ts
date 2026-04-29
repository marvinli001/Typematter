import fs from "fs";
import path from "path";
import { spawn } from "child_process";
import siteConfig from "../site.config";

type ParsedArgs = {
  command: string;
  options: Record<string, string | boolean>;
  rest: string[];
};

type ValidationIssue = {
  type: string;
  message: string;
  file?: string;
};

type ValidationReportForCli = {
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
};

const PROJECT_ROOT = process.cwd();
const NEXT_CLI_PATH = path.join(
  PROJECT_ROOT,
  "node_modules",
  "next",
  "dist",
  "bin",
  "next"
);
const STARTER_KIT_DIR = path.join(PROJECT_ROOT, "starter-kit");
const INIT_EXCLUDED_TOP_LEVEL = new Set([
  ".git",
  ".next",
  ".typematter",
  ".vercel",
  "node_modules",
  "out",
  "starter-kit",
  "content",
]);
const INIT_EXCLUDED_FILES = new Set([
  ".DS_Store",
  "AGENTS.md",
  "README.md",
  "public/robots.txt",
  "public/sitemap.xml",
  "site.config.ts",
  "nav.config.ts",
]);

function parseArgs(argv: string[]): ParsedArgs {
  const [command = "dev", ...restArgs] = argv;
  const options: Record<string, string | boolean> = {};
  const rest: string[] = [];

  for (let i = 0; i < restArgs.length; i += 1) {
    const arg = restArgs[i];
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const next = restArgs[i + 1];
      if (next && !next.startsWith("--")) {
        options[key] = next;
        i += 1;
      } else {
        options[key] = true;
      }
      continue;
    }
    rest.push(arg);
  }

  return { command, options, rest };
}

function resolveContentDir() {
  const configDir = siteConfig.contentDir ?? "content";
  return path.join(PROJECT_ROOT, configDir);
}

async function resetDerivedState() {
  const [{ clearDocsCache }, { clearI18nCache }, { clearRegistryCache }] =
    await Promise.all([
      import("../lib/docs"),
      import("../lib/i18n"),
      import("../lib/typematter/build-registry"),
    ]);

  clearDocsCache();
  clearI18nCache();
  clearRegistryCache();
}

async function runNext(args: string[]) {
  return new Promise<number>((resolve) => {
    const child = spawn(process.execPath, [NEXT_CLI_PATH, ...args], {
      stdio: "inherit",
    });

    child.on("close", (code) => resolve(code ?? 0));
  });
}

function warnIfUnsupportedNode() {
  const major = Number(process.versions.node.split(".")[0]);
  if (Number.isFinite(major) && major >= 25) {
    console.warn(
      "Typematter supports active LTS/current Node lines below 25. Node 25+ may expose MDX parser compatibility issues; use Node 20, 22, or 24 for build and validation."
    );
  }
}

function printValidationReport(report: ValidationReportForCli) {
  if (report.errors.length === 0 && report.warnings.length === 0) {
    console.log("文档校验通过。");
    return;
  }

  console.error("\n文档校验结果:\n");
  report.errors.forEach((error) => {
    const location = error.file ? ` (${error.file})` : "";
    console.error(`- [error:${error.type}] ${error.message}${location}`);
  });
  report.warnings.forEach((warning) => {
    const location = warning.file ? ` (${warning.file})` : "";
    console.error(`- [warn:${warning.type}] ${warning.message}${location}`);
  });
  console.error(
    `\n错误 ${report.errors.length} 项，警告 ${report.warnings.length} 项。`
  );
}

function watchContent(onRebuild: () => void | Promise<void>) {
  const watchers: fs.FSWatcher[] = [];
  const schedule = (() => {
    let timer: NodeJS.Timeout | null = null;
    return () => {
      if (timer) {
        clearTimeout(timer);
      }
      timer = setTimeout(() => {
        Promise.resolve(onRebuild()).catch((error) => {
          console.error(
            error instanceof Error ? error.message : `Registry rebuild failed: ${String(error)}`
          );
        });
        timer = null;
      }, 150);
    };
  })();

  const contentDir = resolveContentDir();
  if (fs.existsSync(contentDir)) {
    watchers.push(
      fs.watch(contentDir, { recursive: true }, (event, filename) => {
        if (filename && filename.toLowerCase().endsWith(".mdx")) {
          schedule();
        }
      })
    );
  }

  ["site.config.ts", "nav.config.ts"].forEach((file) => {
    const fullPath = path.join(process.cwd(), file);
    if (!fs.existsSync(fullPath)) {
      return;
    }
    watchers.push(
      fs.watch(fullPath, () => {
        schedule();
      })
    );
  });

  return () => {
    watchers.forEach((watcher) => watcher.close());
  };
}

function ensureStarterKit() {
  if (!fs.existsSync(STARTER_KIT_DIR)) {
    throw new Error(`Starter kit not found: ${STARTER_KIT_DIR}`);
  }
}

function validateInitTarget(targetDir: string, force: boolean) {
  const resolvedTarget = path.resolve(targetDir);
  if (resolvedTarget === PROJECT_ROOT || resolvedTarget.startsWith(`${PROJECT_ROOT}${path.sep}`)) {
    throw new Error("初始化目录不能位于当前 Typematter 仓库内部。请传入仓库外的目标目录。");
  }

  if (!fs.existsSync(resolvedTarget)) {
    return resolvedTarget;
  }

  const entries = fs.readdirSync(resolvedTarget);
  if (entries.length > 0 && !force) {
    throw new Error(
      `目标目录非空: ${resolvedTarget}。如需覆盖，请传入 --force。`
    );
  }

  return resolvedTarget;
}

function shouldCopyIntoStarter(targetPath: string) {
  const relative = path.relative(PROJECT_ROOT, targetPath).replace(/\\/g, "/");
  if (!relative) {
    return true;
  }

  const basename = path.basename(relative);
  if (basename === ".DS_Store" || basename.endsWith(".log")) {
    return false;
  }

  if (relative.startsWith(".env") && relative !== ".env.example") {
    return false;
  }

  const topLevel = relative.split("/")[0];
  if (INIT_EXCLUDED_TOP_LEVEL.has(topLevel)) {
    return false;
  }

  if (relative === "public/typematter" || relative.startsWith("public/typematter/")) {
    return false;
  }

  if (INIT_EXCLUDED_FILES.has(relative)) {
    return false;
  }

  return true;
}

function shouldCopyStarterKit(sourcePath: string) {
  const relative = path.relative(STARTER_KIT_DIR, sourcePath).replace(/\\/g, "/");
  if (!relative) {
    return true;
  }

  const basename = path.basename(relative);
  if (basename === ".DS_Store" || basename.endsWith(".log")) {
    return false;
  }

  const topLevel = relative.split("/")[0];
  if (
    topLevel === "node_modules" ||
    topLevel === ".next" ||
    topLevel === ".typematter" ||
    topLevel === "out"
  ) {
    return false;
  }

  if (relative.startsWith(".env") && relative !== ".env.example") {
    return false;
  }

  return true;
}

function derivePackageName(targetDir: string) {
  const base = path.basename(targetDir).trim().toLowerCase();
  const normalized = base
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/--+/g, "-");
  return normalized || "my-typematter-docs";
}

function getStringOption(
  options: Record<string, string | boolean>,
  key: string
) {
  const value = options[key];
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : undefined;
}

function getBooleanOption(
  options: Record<string, string | boolean>,
  key: string
) {
  return options[key] === true;
}

function getLocalizedStringOption(
  options: Record<string, string | boolean>,
  key: string,
  language: string
) {
  return (
    getStringOption(options, `${key}.${language}`) ??
    getStringOption(options, `${key}-${language}`) ??
    getStringOption(options, key)
  );
}

function updateStarterPackageMeta(targetDir: string) {
  const packageName = derivePackageName(targetDir);
  const packagePath = path.join(targetDir, "package.json");
  if (fs.existsSync(packagePath)) {
    const raw = fs.readFileSync(packagePath, "utf8");
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    parsed.name = packageName;
    fs.writeFileSync(packagePath, `${JSON.stringify(parsed, null, 2)}\n`);
  }

  const lockPath = path.join(targetDir, "package-lock.json");
  if (fs.existsSync(lockPath)) {
    const raw = fs.readFileSync(lockPath, "utf8");
    const parsed = JSON.parse(raw) as {
      name?: string;
      packages?: Record<string, { name?: string }>;
    };
    parsed.name = packageName;
    if (parsed.packages?.[""]) {
      parsed.packages[""].name = packageName;
    }
    fs.writeFileSync(lockPath, `${JSON.stringify(parsed, null, 2)}\n`);
  }
}

function runInit(options: Record<string, string | boolean>, rest: string[]) {
  ensureStarterKit();

  const targetOption = options.dir ?? options.target ?? rest[0];
  if (!targetOption || typeof targetOption !== "string") {
    console.error("请提供目标目录，例如: typematter init --dir ../my-docs");
    process.exit(1);
  }

  const force = options.force === true;

  try {
    const targetDir = validateInitTarget(targetOption, force);
    if (force && fs.existsSync(targetDir)) {
      fs.rmSync(targetDir, { recursive: true, force: true });
    }
    fs.mkdirSync(targetDir, { recursive: true });

    fs.cpSync(PROJECT_ROOT, targetDir, {
      recursive: true,
      filter: shouldCopyIntoStarter,
    });
    fs.cpSync(STARTER_KIT_DIR, targetDir, {
      recursive: true,
      filter: shouldCopyStarterKit,
    });
    updateStarterPackageMeta(targetDir);

    console.log(`Starter project created: ${targetDir}`);
    console.log("Next steps:");
    console.log(`  cd ${targetDir}`);
    console.log("  npm install");
    console.log("  npm run dev");
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

async function runDev(extraArgs: string[]) {
  warnIfUnsupportedNode();
  const [{ buildRegistryWithPlugins, writeRegistryFiles }, pluginRunner] =
    await Promise.all([
      import("../lib/typematter/build-registry"),
      import("../lib/typematter/plugin-runner"),
    ]);
  const { createBuildContext, getConfiguredPlugins, runBuildHook } = pluginRunner;
  const plugins = getConfiguredPlugins();
  const context = createBuildContext();
  const rebuild = async () => {
    await resetDerivedState();
    await runBuildHook("buildStart", context, plugins);
    const result = await buildRegistryWithPlugins({ plugins, context });
    writeRegistryFiles(result);
    await runBuildHook("buildEnd", context, plugins, {
      registry: result.registry,
    });
    console.log("Registry refreshed.");
  };

  await rebuild();
  const stopWatching = watchContent(rebuild);
  const code = await runNext(["dev", ...extraArgs]);
  stopWatching();
  process.exit(code);
}

async function runBuild(extraArgs: string[]) {
  warnIfUnsupportedNode();
  const [{ buildRegistryWithPlugins, writeRegistryFiles }, pluginRunner, validationRunner] =
    await Promise.all([
      import("../lib/typematter/build-registry"),
      import("../lib/typematter/plugin-runner"),
      import("../lib/typematter/validation"),
    ]);
  const { createBuildContext, getConfiguredPlugins, runBuildHook } = pluginRunner;
  const { validateDocs } = validationRunner;
  const plugins = getConfiguredPlugins();
  const context = createBuildContext();
  await resetDerivedState();
  const validation = await validateDocs({ plugins });
  printValidationReport(validation.report);
  if (validation.hasErrors) {
    process.exit(1);
  }

  await runBuildHook("buildStart", context, plugins);
  const registry = await buildRegistryWithPlugins({ plugins, context });
  writeRegistryFiles(registry);
  const code = await runNext(["build", ...extraArgs]);
  await runBuildHook("buildEnd", context, plugins, {
    registry: registry.registry,
  });
  process.exit(code);
}

async function runValidate(options: Record<string, string | boolean>) {
  warnIfUnsupportedNode();
  const [{ validateDocs }, { getConfiguredPlugins }] = await Promise.all([
    import("../lib/typematter/validation"),
    import("../lib/typematter/plugin-runner"),
  ]);
  const plugins = getConfiguredPlugins();
  await resetDerivedState();
  const validation = await validateDocs({
    plugins,
    strict: getBooleanOption(options, "strict"),
  });
  printValidationReport(validation.report);
  if (validation.hasErrors) {
    process.exit(1);
  }
}

async function runExportRegistry() {
  warnIfUnsupportedNode();
  const [{ buildRegistryWithPlugins, writeRegistryFiles }, pluginRunner] =
    await Promise.all([
      import("../lib/typematter/build-registry"),
      import("../lib/typematter/plugin-runner"),
    ]);
  const { createBuildContext, getConfiguredPlugins, runBuildHook } = pluginRunner;
  const plugins = getConfiguredPlugins();
  const context = createBuildContext();
  await resetDerivedState();
  await runBuildHook("buildStart", context, plugins);
  const result = await buildRegistryWithPlugins({ plugins, context });
  const {
    registryPath,
    searchPath,
    askPath,
    publicAskPath,
    robotsPath,
    sitemapPath,
    searchManifestPath,
  } = writeRegistryFiles(result);
  await runBuildHook("buildEnd", context, plugins, {
    registry: result.registry,
  });
  console.log(`Registry written: ${registryPath}`);
  console.log(`Search index written: ${searchPath}`);
  console.log(`Ask index written: ${askPath}`);
  console.log(`Public ask index written: ${publicAskPath}`);
  console.log(`Standard search manifest written: ${searchManifestPath}`);
  console.log(`Robots written: ${robotsPath}`);
  console.log(`Sitemap written: ${sitemapPath}`);
}

function slugToTitle(slug: string) {
  const leaf = slug
    .replace(/\.mdx?$/i, "")
    .split("/")
    .filter(Boolean)
    .pop();
  if (!leaf || leaf === "index") {
    return "New Page";
  }
  return leaf
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function normalizeNewPageSlug(slug: string, language: string) {
  const withoutExtension = slug.trim().replace(/\.mdx?$/i, "");
  const normalized = withoutExtension
    .replace(/\\/g, "/")
    .replace(/^\/+|\/+$/g, "");
  const withoutLanguagePrefix = normalized.startsWith(`${language}/`)
    ? normalized.slice(language.length + 1)
    : normalized;

  if (!withoutLanguagePrefix || withoutLanguagePrefix === ".") {
    return "index";
  }

  if (
    withoutLanguagePrefix.includes("..") ||
    withoutLanguagePrefix.split("/").some((segment) => segment.trim().length === 0)
  ) {
    throw new Error("slug 不能包含空路径片段或 ..");
  }

  return withoutLanguagePrefix;
}

function pagePathFromSlug(contentDir: string, language: string, slug: string) {
  return path.join(contentDir, language, `${slug}.mdx`);
}

function defaultSectionForLanguage(language: string) {
  if (language === "cn" || language === "zh" || language === "zh-CN") {
    return "指南";
  }
  return "Guides";
}

function defaultDescriptionForLanguage(language: string, title: string) {
  if (language === "cn" || language === "zh" || language === "zh-CN") {
    return `TODO: 补充「${title}」的页面摘要。`;
  }
  return `TODO: Add a short summary for ${title}.`;
}

function frontmatterString(value: string) {
  return JSON.stringify(value);
}

function createPageTemplate(args: {
  language: string;
  title: string;
  order: number;
  section: string;
  type: string;
  description: string;
  pager: boolean;
}) {
  const isChinese =
    args.language === "cn" || args.language === "zh" || args.language === "zh-CN";
  const opening = isChinese
    ? "在这里写一段简短、具体的开场摘要。"
    : "Write the opening summary here. Keep the first paragraph short and concrete.";
  const contextHeading = isChinese ? "背景" : "Context";
  const contextText = isChinese
    ? "说明读者在继续阅读前需要知道什么。"
    : "Explain what the reader should know before following the steps.";
  const stepsHeading = isChinese ? "步骤" : "Steps";
  const firstStep = isChinese
    ? "将这段脚手架替换成第一个动作。"
    : "Replace this scaffold with the first action.";
  const secondStep = isChinese ? "补充下一个动作。" : "Add the next action.";
  const validateStep = isChinese
    ? "部署前运行 `npm run validate:docs`。"
    : "Run `npm run validate:docs` before deployment.";

  return [
    "---",
    `title: ${frontmatterString(args.title)}`,
    `order: ${args.order}`,
    `section: ${frontmatterString(args.section)}`,
    `type: ${frontmatterString(args.type)}`,
    `pager: ${args.pager ? "true" : "false"}`,
    `description: ${frontmatterString(args.description)}`,
    "---",
    "",
    opening,
    "",
    `## ${contextHeading}`,
    "",
    contextText,
    "",
    `## ${stepsHeading}`,
    "",
    ":::steps",
    `1. ${firstStep}`,
    `2. ${secondStep}`,
    `3. ${validateStep}`,
    ":::",
    "",
  ].join("\n");
}

function resolveNewLanguages(options: Record<string, string | boolean>) {
  if (getBooleanOption(options, "all-languages") || getBooleanOption(options, "all")) {
    const languages = siteConfig.i18n?.languages.map((language) => language.code) ?? [];
    if (languages.length === 0) {
      throw new Error("当前站点未配置 i18n.languages，无法使用 --all-languages。");
    }
    return languages;
  }

  const lang = getStringOption(options, "lang") ?? getStringOption(options, "language");
  if (!lang) {
    throw new Error("请提供 --lang <code>，或使用 --all-languages。");
  }
  return [lang];
}

function runNew(options: Record<string, string | boolean>, rest: string[]) {
  const slugOption = getStringOption(options, "slug") ?? rest[0];
  const contentDir = resolveContentDir();

  let languages: string[];
  try {
    languages = resolveNewLanguages(options);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }

  if (!slugOption) {
    languages.forEach((language) => {
      const targetDir = path.join(contentDir, language);
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }

      const indexPath = path.join(targetDir, "index.mdx");
      if (!fs.existsSync(indexPath)) {
        const title = `${language.toUpperCase()} Index`;
        fs.writeFileSync(
          indexPath,
          createPageTemplate({
            language,
            title,
            order: 1,
            section: defaultSectionForLanguage(language),
            type: "guide",
            pager: false,
            description: defaultDescriptionForLanguage(language, title),
          })
        );
      }

      console.log(`Language scaffolded: ${language}`);
    });
    return;
  }

  const force = getBooleanOption(options, "force");
  const orderOption = getStringOption(options, "order");
  const parsedOrder = orderOption ? Number(orderOption) : 100;
  if (!Number.isFinite(parsedOrder)) {
    console.error("--order 必须是数字。");
    process.exit(1);
  }

  try {
    languages.forEach((language) => {
      const slug = normalizeNewPageSlug(slugOption, language);
      const targetPath = pagePathFromSlug(contentDir, language, slug);
      if (fs.existsSync(targetPath) && !force) {
        throw new Error(`页面已存在: ${targetPath}。如需覆盖，请传入 --force。`);
      }

      const title =
        getLocalizedStringOption(options, "title", language) ?? slugToTitle(slug);
      const section =
        getLocalizedStringOption(options, "section", language) ??
        defaultSectionForLanguage(language);
      const type = getLocalizedStringOption(options, "type", language) ?? "guide";
      const description =
        getLocalizedStringOption(options, "description", language) ??
        defaultDescriptionForLanguage(language, title);
      const pager = options.pager === false ? false : options.pager !== "false";

      fs.mkdirSync(path.dirname(targetPath), { recursive: true });
      fs.writeFileSync(
        targetPath,
        createPageTemplate({
          language,
          title,
          order: parsedOrder,
          section,
          type,
          description,
          pager,
        })
      );

      const route = slug === "index" ? `/${language}` : `/${language}/${slug}`;
      console.log(`Page created: ${targetPath}`);
      console.log(`Route: ${route}`);
    });
    console.log("Next step: edit the page, then run npm run validate:docs.");
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

function getServePort(extraArgs: string[]) {
  const portFlagIndex = extraArgs.findIndex((arg) => arg === "--port" || arg === "-p");
  const candidate =
    portFlagIndex >= 0 ? extraArgs[portFlagIndex + 1] : extraArgs.find((arg) => /^\d+$/.test(arg));
  const parsed = candidate ? Number(candidate) : Number(process.env.PORT ?? 3000);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 3000;
}

function getContentType(filePath: string) {
  const extension = path.extname(filePath).toLowerCase();
  const types: Record<string, string> = {
    ".css": "text/css; charset=utf-8",
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".map": "application/json; charset=utf-8",
    ".svg": "image/svg+xml",
    ".txt": "text/plain; charset=utf-8",
    ".xml": "application/xml; charset=utf-8",
  };
  return types[extension] ?? "application/octet-stream";
}

function resolveStaticFile(outDir: string, requestPath: string) {
  const decoded = decodeURIComponent(requestPath);
  const normalized = path.normalize(decoded).replace(/^(\.\.[/\\])+/, "");
  const candidate = path.join(outDir, normalized);
  const resolved = path.resolve(candidate);
  if (!resolved.startsWith(`${path.resolve(outDir)}${path.sep}`) && resolved !== path.resolve(outDir)) {
    return null;
  }

  if (fs.existsSync(resolved) && fs.statSync(resolved).isFile()) {
    return resolved;
  }

  const indexPath = path.join(resolved, "index.html");
  if (fs.existsSync(indexPath) && fs.statSync(indexPath).isFile()) {
    return indexPath;
  }

  const htmlPath = `${resolved}.html`;
  if (fs.existsSync(htmlPath) && fs.statSync(htmlPath).isFile()) {
    return htmlPath;
  }

  return null;
}

async function runServe(extraArgs: string[]) {
  const outDir = path.join(PROJECT_ROOT, "out");
  if (!fs.existsSync(outDir)) {
    console.error("Static output not found: out/. Run npm run build first.");
    process.exit(1);
  }

  const { createServer } = await import("http");
  const port = getServePort(extraArgs);
  const server = createServer((request, response) => {
    const requestUrl = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);
    const pathname = requestUrl.pathname === "/" ? "/index.html" : requestUrl.pathname;
    const filePath = resolveStaticFile(outDir, pathname);

    if (!filePath) {
      response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      response.end("Not found");
      return;
    }

    response.writeHead(200, { "content-type": getContentType(filePath) });
    fs.createReadStream(filePath).pipe(response);
  });

  server.listen(port, () => {
    console.log(`Serving ${outDir} at http://localhost:${port}`);
  });
}

async function main() {
  const { command, options, rest } = parseArgs(process.argv.slice(2));

  switch (command) {
    case "init":
      runInit(options, rest);
      return;
    case "dev":
      await runDev(rest);
      return;
    case "build":
      await runBuild(rest);
      return;
    case "validate":
      await runValidate(options);
      return;
    case "export-registry":
      await runExportRegistry();
      return;
    case "new":
      runNew(options, rest);
      return;
    case "serve":
      await runServe(rest);
      return;
    default:
      console.error(`未知命令: ${command}`);
      console.error(
        "可用命令: init | dev | build | validate | new | export-registry | serve"
      );
      process.exit(1);
  }
}

main();
