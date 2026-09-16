import { createServer } from 'vite';
import { spawn } from 'node:child_process';
const preferred = 'http://127.0.0.1:5173/';
function openWorkspace(address) {
  if (process.platform === 'darwin') spawn('open', [address], { stdio: 'ignore' });
  else if (process.platform === 'win32') spawn('cmd.exe', ['/d', '/s', '/c', `start "" "microsoft-edge:${address}"`], { stdio: 'ignore', windowsHide: true });
  else spawn('xdg-open', [address], { stdio: 'ignore' });
}
try {
  const response = await fetch(preferred, { signal: AbortSignal.timeout(1200) });
  if ((await response.text()).includes('<title>ENG · Workspace</title>')) {
    openWorkspace(preferred);
    console.log(`ENG Workspace è già attivo: ${preferred}`);
    process.exit(0);
  }
} catch { /* Start a new local server when no workspace is listening. */ }
const server = await createServer({ server: { host: '127.0.0.1', port: 5173, strictPort: false } });
await server.listen();
const listening = server.httpServer.address();
const address = `http://127.0.0.1:${listening.port}/`;
console.log(`\nENG Workspace pronto: ${address}\nLascia aperta questa finestra durante l’utilizzo. Premi Ctrl+C per chiudere.\n`);
openWorkspace(address);
process.on('SIGINT', async () => { await server.close(); process.exit(0); });
