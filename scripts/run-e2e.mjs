/* global process, URL, fetch, setTimeout */
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const viteCli = fileURLToPath(new URL('../node_modules/vite/bin/vite.js', import.meta.url))
const playwrightCli = fileURLToPath(new URL('../node_modules/@playwright/test/cli.js', import.meta.url))
const baseUrl = 'http://127.0.0.1:4173'

const server = spawn(process.execPath, [viteCli, 'preview', '--host', '127.0.0.1', '--port', '4173'], {
  stdio: 'inherit',
  windowsHide: true,
})

async function waitUntilReady() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (server.exitCode !== null) throw new Error(`O preview encerrou com código ${server.exitCode}.`)
    try {
      const response = await fetch(`${baseUrl}/login`)
      if (response.ok) return
    } catch {
      // O preview ainda está iniciando.
    }
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  throw new Error('Timeout ao iniciar o preview para E2E.')
}

try {
  await waitUntilReady()
  const testProcess = spawn(process.execPath, [playwrightCli, 'test'], {
    stdio: 'inherit',
    windowsHide: true,
    env: { ...process.env, PLAYWRIGHT_NO_SERVER: '1' },
  })
  const exitCode = await new Promise((resolve, reject) => {
    testProcess.once('error', reject)
    testProcess.once('exit', (code) => resolve(code ?? 1))
  })
  process.exitCode = Number(exitCode)
} finally {
  server.kill()
}
