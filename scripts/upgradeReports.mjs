import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const supportedReport = '18_先进封装行业供需周期分析.md';

const timestamp = (() => {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Shanghai',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(new Date()).map(({ type, value }) => [type, value]),
  );
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second} +08:00`;
})();

const reportFlag = process.argv.indexOf('--report');
const requestedReport = reportFlag >= 0 ? process.argv[reportFlag + 1] : '';

if (!requestedReport) {
  throw new Error(`Refusing a bulk rewrite. Pass --report ${supportedReport} after independently updating its evidence source.`);
}
if (requestedReport !== supportedReport) {
  throw new Error(`Report ${requestedReport} has no audited evidence source. Supported report: ${supportedReport}`);
}

const templatePath = path.join(root, 'scripts', 'report-sources', `${supportedReport.replace(/\.md$/u, '')}.template.md`);
const template = await readFile(templatePath, 'utf8');
const placeholders = template.match(/\{\{ANALYSIS_TIMESTAMP\}\}/gu) || [];
if (placeholders.length !== 1) {
  throw new Error(`Expected exactly one ANALYSIS_TIMESTAMP placeholder in ${templatePath}; found ${placeholders.length}.`);
}
const datePlaceholders = template.match(/\{\{ANALYSIS_DATE\}\}/gu) || [];
if (datePlaceholders.length < 1) {
  throw new Error(`Expected at least one ANALYSIS_DATE placeholder in ${templatePath}.`);
}

const report = template
  .replace('{{ANALYSIS_TIMESTAMP}}', timestamp)
  .replaceAll('{{ANALYSIS_DATE}}', timestamp.slice(0, 10));
await writeFile(path.join(root, supportedReport), report, 'utf8');
console.log(`Generated audited report ${supportedReport} at ${timestamp}.`);
