import assert from 'node:assert/strict';
import { once } from 'node:events';
import { readFile, stat } from 'node:fs/promises';
import { createServer } from 'node:net';
import { spawn } from 'node:child_process';

const expectedEntryPoint = 'dist/index.js';
const expectedStartCommand = `node ${expectedEntryPoint}`;
const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));

assert.equal(
  packageJson.scripts?.start,
  expectedStartCommand,
  `The production start script must remain "${expectedStartCommand}".`,
);
assert.equal(
  packageJson.main,
  expectedEntryPoint,
  `package.json main must remain "${expectedEntryPoint}".`,
);

const entryPointUrl = new URL(`../${expectedEntryPoint}`, import.meta.url);
const entryPointStats = await stat(entryPointUrl).catch(() => null);
assert.ok(entryPointStats?.isFile(), `The backend build did not emit ${expectedEntryPoint}.`);

const probe = createServer();
probe.listen(0, '127.0.0.1');
await once(probe, 'listening');
const probeAddress = probe.address();
assert.ok(probeAddress && typeof probeAddress === 'object');
const port = probeAddress.port;
await new Promise((resolve, reject) => probe.close((error) => (error ? reject(error) : resolve())));

const child = spawn(process.execPath, [expectedEntryPoint], {
  cwd: new URL('..', import.meta.url),
  env: {
    ...process.env,
    NODE_ENV: 'test',
    PORT: String(port),
    NOTIFICATION_SCHEDULER_ENABLED: 'false',
    IN_PROCESS_SCHEDULERS_ENABLED: 'false',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});

let stdout = '';
let stderr = '';
child.stdout.setEncoding('utf8').on('data', (chunk) => {
  stdout += chunk;
});
child.stderr.setEncoding('utf8').on('data', (chunk) => {
  stderr += chunk;
});

const childExit = once(child, 'exit');
const deadline = Date.now() + 10_000;
let healthResponse;

try {
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`Compiled backend exited before becoming healthy.\n${stdout}${stderr}`);
    }

    try {
      healthResponse = await fetch(`http://127.0.0.1:${port}/health`);
      if (healthResponse.ok) break;
    } catch {
      // The process may still be opening its listener.
    }

    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  assert.ok(healthResponse?.ok, `Compiled backend did not pass /health.\n${stdout}${stderr}`);

  if (process.platform === 'win32') {
    // Windows does not deliver POSIX signals to child processes. CI and Render
    // run on Linux and exercise the production SIGTERM handler below.
    child.kill();
  } else {
    child.kill('SIGTERM');
  }

  const [exitCode, signal] = await Promise.race([
    childExit,
    new Promise((_, reject) =>
      setTimeout(
        () => reject(new Error('Compiled backend did not stop within 10 seconds.')),
        10_000,
      ).unref(),
    ),
  ]);

  if (process.platform !== 'win32') {
    assert.equal(signal, null, `Compiled backend was terminated by ${signal}.`);
    assert.equal(exitCode, 0, `Compiled backend exited with code ${exitCode}.\n${stdout}${stderr}`);
    assert.match(stdout, /Received SIGTERM; closing HTTP server\./);
  }
} finally {
  if (child.exitCode === null) child.kill();
}

console.log(
  process.platform === 'win32'
    ? `Verified ${expectedEntryPoint}, npm start, and /health (SIGTERM is verified on Linux).`
    : `Verified ${expectedEntryPoint}, npm start, /health, and graceful SIGTERM shutdown.`,
);
