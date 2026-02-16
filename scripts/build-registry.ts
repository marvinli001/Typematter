import { buildRegistry, writeRegistryFiles } from "../lib/typematter/build-registry";

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
