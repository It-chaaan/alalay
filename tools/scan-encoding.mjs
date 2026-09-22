import { readFile } from 'node:fs/promises';
import { readdir } from 'node:fs/promises';
import { join, relative } from 'node:path';

const roots = [
  'mobile/src',
  'frontend/src',
  'backend/src',
  'shared',
  'supabase',
  'database',
  'seed',
  'seeds',
  'migrations',
  'fixtures',
];
const ignored = new Set(['node_modules', '.expo', 'dist', 'build', 'coverage']);
const markerPattern = /Ã¢|Ã‚|Ãƒ|ï¿½|â‚±|Â·|â€¦|â€™|â€¢|âˆ’|âœ“|â€¹|â€º|âŒ«|Ã—|Ã·/u;

async function filesUnder(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (ignored.has(entry.name)) continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await filesUnder(path)));
    else if (/\.(?:ts|tsx|js|jsx|json|sql|md)$/u.test(entry.name)) files.push(path);
  }
  return files;
}

const findings = [];
for (const root of roots) {
  try {
    for (const path of await filesUnder(root)) {
      const content = await readFile(path, 'utf8');
      const lines = content.split(/\r?\n/u);
      lines.forEach((line, index) => {
        if (markerPattern.test(line)) findings.push(`${relative('.', path)}:${index + 1}`);
      });
    }
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
}

if (findings.length > 0) {
  console.error(`Encoding markers found in ${findings.length} source line(s):`);
  findings.forEach((finding) => console.error(`- ${finding}`));
  process.exitCode = 1;
} else {
  console.log('Encoding scan passed: no known mojibake markers found.');
}
