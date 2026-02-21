import {
  buildRegistryWithPlugins,
  writeRegistryFiles,
} from "../lib/typematter/build-registry";
import {
  createBuildContext,
  getConfiguredPlugins,
  runBuildHook,
} from "../lib/typematter/plugin-runner";

async function main() {
  const plugins = getConfiguredPlugins();
  const context = createBuildContext();

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
  await runBuildHook("buildEnd", context, plugins, { registry: result.registry });

  console.log(`Registry written: ${registryPath}`);
  console.log(`Search index written: ${searchPath}`);
  console.log(`Ask index written: ${askPath}`);
  console.log(`Public ask index written: ${publicAskPath}`);
  console.log(`Standard search manifest written: ${searchManifestPath}`);
  console.log(`Robots written: ${robotsPath}`);
  console.log(`Sitemap written: ${sitemapPath}`);
}

main();

