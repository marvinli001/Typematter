import { buildRegistry, writeRegistryFiles } from "../lib/typematter/build-registry";

const result = buildRegistry();
const { registryPath, searchPath } = writeRegistryFiles(result);

console.log(`Registry written: ${registryPath}`);
console.log(`Search index written: ${searchPath}`);
