import { validateDocs } from "../lib/typematter/validation";

const { report, hasErrors } = validateDocs();

if (report.errors.length === 0 && report.warnings.length === 0) {
  console.log("文档校验通过。");
  process.exit(0);
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
console.error(`\n错误 ${report.errors.length} 项，警告 ${report.warnings.length} 项。`);

if (hasErrors) {
  process.exit(1);
}
