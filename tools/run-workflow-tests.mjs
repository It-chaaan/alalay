import { readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { spawnSync } from 'node:child_process';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

const root = process.cwd();
const backendDirectory = join(root, 'backend');
const frontendDirectory = join(root, 'frontend');
const mobileDirectory = join(root, 'mobile');
const tsxLoader = pathToFileURL(
  join(backendDirectory, 'node_modules', 'tsx', 'dist', 'loader.mjs'),
).href;
const mode = process.argv[2] ?? 'all';

function findTests(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const location = join(directory, entry.name);
    if (entry.isDirectory()) return findTests(location);
    return entry.name.endsWith('.test.ts') ? [location] : [];
  });
}

function testCommand(testPath) {
  if (testPath.startsWith(frontendDirectory)) {
    return {
      cwd: frontendDirectory,
      path: relative(frontendDirectory, testPath).replaceAll('\\', '/'),
      loader: tsxLoader,
    };
  }
  if (testPath.startsWith(mobileDirectory)) {
    return {
      cwd: mobileDirectory,
      path: relative(mobileDirectory, testPath).replaceAll('\\', '/'),
      loader: tsxLoader,
    };
  }
  return {
    cwd: backendDirectory,
    path: relative(backendDirectory, testPath).replaceAll('\\', '/'),
    loader: tsxLoader,
  };
}

const backendTests = findTests(join(root, 'backend', 'src'));
const clientTests = [
  ...findTests(join(root, 'frontend', 'src')),
  ...findTests(join(root, 'mobile', 'src')),
];
const selectedTests =
  mode === 'contracts'
    ? backendTests.filter(
        (path) =>
          path.includes(`${join('src', 'contracts')}`) ||
          path.includes(`${join('src', 'schemas')}`),
      )
    : [...backendTests, ...clientTests];

function testArea(testPath) {
  const path = relative(root, testPath).replaceAll('\\', '/');
  if (path.includes('/contracts/') || path.includes('/schemas/')) return 'API contracts';
  if (path.startsWith('backend/')) return 'Backend financial workflows';
  if (path.startsWith('frontend/')) return 'Web contracts and presentation';
  return 'Mobile contracts and presentation';
}

const results = [];
for (const testPath of selectedTests) {
  const command = testCommand(testPath);
  const result = spawnSync(process.execPath, ['--import', command.loader, command.path], {
    cwd: command.cwd,
    encoding: 'utf8',
  });
  process.stdout.write(result.stdout ?? '');
  process.stderr.write(result.stderr ?? '');
  results.push({ testPath, status: result.status ?? 1 });
}

const failed = results.filter((result) => result.status !== 0);
console.log('\nAPI + FINANCIAL WORKFLOW TEST SUMMARY');
console.log(`Executed: ${results.length}`);
console.log(`Passed: ${results.length - failed.length}`);
console.log(`Failed: ${failed.length}`);
for (const area of new Set(results.map((result) => testArea(result.testPath)))) {
  const areaResults = results.filter((result) => testArea(result.testPath) === area);
  const areaFailures = areaResults.filter((result) => result.status !== 0).length;
  console.log(`${area}: ${areaResults.length - areaFailures}/${areaResults.length} passed`);
}
if (failed.length) {
  console.log('Failures:');
  failed.forEach((result) => console.log(`- ${relative(root, result.testPath)}`));
  process.exitCode = 1;
}
