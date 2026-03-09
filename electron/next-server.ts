import { fork, ChildProcess } from 'child_process';
import path from 'path';
import net from 'net';
import { app } from 'electron';

let serverProcess: ChildProcess | null = null;

/** Find a free TCP port starting from the preferred port. */
function findFreePort(preferred: number): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(preferred, '127.0.0.1', () => {
      const addr = server.address();
      const port = typeof addr === 'object' && addr ? addr.port : preferred;
      server.close(() => resolve(port));
    });
    server.on('error', () => {
      // Preferred port is taken — let the OS pick one
      const fallback = net.createServer();
      fallback.listen(0, '127.0.0.1', () => {
        const addr = fallback.address();
        const port = typeof addr === 'object' && addr ? addr.port : 0;
        fallback.close(() => resolve(port));
      });
      fallback.on('error', reject);
    });
  });
}

/** Wait until a TCP connection succeeds on the given port. */
function waitForServer(port: number, timeoutMs = 30_000): Promise<void> {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    function tryConnect() {
      const sock = net.createConnection({ host: '127.0.0.1', port });
      sock.on('connect', () => {
        sock.destroy();
        resolve();
      });
      sock.on('error', () => {
        sock.destroy();
        if (Date.now() - start > timeoutMs) {
          reject(new Error(`Next.js server did not start within ${timeoutMs}ms`));
        } else {
          setTimeout(tryConnect, 200);
        }
      });
    }
    tryConnect();
  });
}

/**
 * Start the Next.js standalone server as a child process.
 * Returns the URL the server is listening on.
 */
export async function startNextServer(): Promise<string> {
  const port = await findFreePort(3000);

  // In a packaged app, the standalone output is in resources/standalone
  const standaloneDir = path.join(
    app.isPackaged ? process.resourcesPath : path.resolve(__dirname, '..'),
    app.isPackaged ? 'standalone' : '.next/standalone'
  );
  const serverScript = path.join(standaloneDir, 'server.js');

  serverProcess = fork(serverScript, [], {
    env: {
      ...process.env,
      PORT: String(port),
      HOSTNAME: '127.0.0.1',
    },
    cwd: standaloneDir,
    stdio: 'pipe',
  });

  serverProcess.stdout?.on('data', (data: Buffer) => {
    console.log('[next]', data.toString().trim());
  });

  serverProcess.stderr?.on('data', (data: Buffer) => {
    console.error('[next]', data.toString().trim());
  });

  serverProcess.on('exit', (code) => {
    console.log(`[next] server exited with code ${code}`);
    serverProcess = null;
  });

  await waitForServer(port);
  console.log(`[next] server ready on http://127.0.0.1:${port}`);
  return `http://127.0.0.1:${port}`;
}

/** Stop the Next.js server process. */
export function stopNextServer() {
  if (serverProcess) {
    serverProcess.kill();
    serverProcess = null;
  }
}
