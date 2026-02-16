import fs from "fs";
import path from "path";
import { spawn } from "child_process";
import siteConfig from "../site.config";
import { buildRegistry, writeRegistryFiles } from "../lib/typematter/build-registry";
import { validateDocs } from "../lib/typematter/validation";

type ParsedArgs = {
  command: string;
  options: Record<string, string | boolean>;
  rest: string[];
};

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
  return path.join(process.cwd(), configDir);
}

async function runNext(args: string[]) {
  return new Promise<number>((resolve) => {
    const child = spawn("next", args, {
      stdio: "inherit",
      shell: true,
    });

    child.on("close", (code) => resolve(code ?? 0));
  });
}

function printValidationReport(report: ReturnType<typeof validateDocs>["report"]) {
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

function watchContent(onRebuild: () => void) {
  const watchers: fs.FSWatcher[] = [];
  const schedule = (() => {
    let timer: NodeJS.Timeout | null = null;
    return () => {
      if (timer) {
        clearTimeout(timer);
      }
      timer = setTimeout(() => {
        onRebuild();
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

async function runDev(extraArgs: string[]) {
  const rebuild = () => {
    const result = buildRegistry();
    writeRegistryFiles(result);
    console.log("Registry refreshed.");
  };

  rebuild();
  const stopWatching = watchContent(rebuild);
  const code = await runNext(["dev", ...extraArgs]);
  stopWatching();
  process.exit(code);
}

async function runBuild(extraArgs: string[]) {
  const validation = validateDocs();
  printValidationReport(validation.report);
  if (validation.hasErrors) {
    process.exit(1);
  }

  const registry = buildRegistry();
  writeRegistryFiles(registry);
  const code = await runNext(["build", ...extraArgs]);
  process.exit(code);
}

function runValidate() {
  const validation = validateDocs();
  printValidationReport(validation.report);
  if (validation.hasErrors) {
    process.exit(1);
  }
}

function runExportRegistry() {
  const result = buildRegistry();
  const {
    registryPath,
    searchPath,
    askPath,
    publicAskPath,
    robotsPath,
    sitemapPath,
  } = writeRegistryFiles(result);
  console.log(`Registry written: ${registryPath}`);
  console.log(`Search index written: ${searchPath}`);
  console.log(`Ask index written: ${askPath}`);
  console.log(`Public ask index written: ${publicAskPath}`);
  console.log(`Robots written: ${robotsPath}`);
  console.log(`Sitemap written: ${sitemapPath}`);
}

function runNew(options: Record<string, string | boolean>) {
  const lang = options.lang ?? options.language;
  if (!lang || typeof lang !== "string") {
    console.error("请提供 --lang <code> 以创建语言目录。");
    process.exit(1);
  }

  const contentDir = resolveContentDir();
  const targetDir = path.join(contentDir, lang);
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  const indexPath = path.join(targetDir, "index.mdx");
  if (!fs.existsSync(indexPath)) {
    fs.writeFileSync(
      indexPath,
      `---\ntitle: ${lang.toUpperCase()} Index\norder: 1\nsection: General\n---\n\n`
    );
  }

  console.log(`Language scaffolded: ${lang}`);
}

async function runServe(extraArgs: string[]) {
  const code = await runNext(["start", ...extraArgs]);
  process.exit(code);
}

async function main() {
  const { command, options, rest } = parseArgs(process.argv.slice(2));

  switch (command) {
    case "dev":
      await runDev(rest);
      return;
    case "build":
      await runBuild(rest);
      return;
    case "validate":
      runValidate();
      return;
    case "export-registry":
      runExportRegistry();
      return;
    case "new":
      runNew(options);
      return;
    case "serve":
      await runServe(rest);
      return;
    default:
      console.error(`未知命令: ${command}`);
      console.error("可用命令: dev | build | validate | new | export-registry | serve");
      process.exit(1);
  }
}

main();
