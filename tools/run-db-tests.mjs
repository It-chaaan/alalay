import { readFileSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, relative } from 'node:path';
import process from 'node:process';

const root = process.cwd();
const testsDirectory = join(root, 'supabase', 'tests');
const testHelpers = readFileSync(join(root, 'supabase', 'test_helpers.sql'), 'utf8');

function resolveDatabaseContainer() {
  const configuredContainer = process.env.SUPABASE_DB_CONTAINER;
  if (configuredContainer) return configuredContainer;

  const result = spawnSync(
    'docker',
    ['ps', '--filter', 'label=com.supabase.cli.project=alalay', '--format', '{{.Names}}'],
    { cwd: root, encoding: 'utf8' },
  );
  if (result.status !== 0) {
    throw new Error(
      result.error?.message || result.stderr?.trim() || 'Unable to list local Docker containers.',
    );
  }

  const containers = (result.stdout ?? '')
    .split(/\r?\n/)
    .filter((name) => name.startsWith('supabase_db_'));
  if (containers.length !== 1) {
    throw new Error(
      `Expected exactly one running local Supabase database container; found ${containers.length}. ` +
        'Start the local Supabase database or set SUPABASE_DB_CONTAINER explicitly.',
    );
  }

  return containers[0];
}

const container = resolveDatabaseContainer();

function findSqlTests(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const location = join(directory, entry.name);
    if (entry.isDirectory()) return findSqlTests(location);
    return entry.name.endsWith('.sql') ? [location] : [];
  });
}

const results = findSqlTests(testsDirectory).map((testPath) => {
  const result = spawnSync(
    'docker',
    [
      'exec',
      '-i',
      container,
      'psql',
      '-v',
      'ON_ERROR_STOP=1',
      '-U',
      'postgres',
      '-d',
      'postgres',
      '-f',
      '-',
    ],
    {
      cwd: root,
      encoding: 'utf8',
      input: `${testHelpers}\n${readFileSync(testPath, 'utf8')}`,
    },
  );
  process.stdout.write(result.stdout ?? '');
  process.stderr.write(result.stderr ?? '');
  return { testPath, status: result.status ?? 1 };
});

const failed = results.filter((result) => result.status !== 0);
console.log('\nLOCAL SUPABASE DATABASE TEST SUMMARY');
console.log(`Executed: ${results.length}`);
console.log(`Passed: ${results.length - failed.length}`);
console.log(`Failed: ${failed.length}`);
if (failed.length) {
  console.log('Failures:');
  failed.forEach((result) => console.log(`- ${relative(root, result.testPath)}`));
  process.exitCode = 1;
}
