import fs from 'node:fs'
import path from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'
import { config } from './src/config'
import { ENGINE_FILES, ENGINE_PATH } from './src/engine/engineFiles'

/** Cross-origin isolation, required for SharedArrayBuffer and so the multi-threaded engine. */
const isolationHeaders = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
}

const engineDir = path.resolve(import.meta.dirname, 'node_modules/stockfish/bin')
const contentTypes: Record<string, string> = { '.js': 'text/javascript', '.wasm': 'application/wasm' }

/** Serves the Stockfish builds at /engine/ in dev and copies the configured flavor into the build. */
function stockfishEngine(): Plugin {
  return {
    name: 'stockfish-engine',
    configureServer(server) {
      server.middlewares.use(`/${ENGINE_PATH}`, (req, res, next) => {
        const file = path.basename(req.url?.split('?')[0] ?? '')
        const full = path.join(engineDir, file)
        if (!file.startsWith('stockfish') || !fs.existsSync(full)) return next()
        res.setHeader('Content-Type', contentTypes[path.extname(file)] ?? 'application/octet-stream')
        for (const [name, value] of Object.entries(isolationHeaders)) res.setHeader(name, value)
        fs.createReadStream(full).pipe(res)
      })
    },
    generateBundle() {
      const { threaded, single } = ENGINE_FILES[config.engine.flavor]
      for (const script of [threaded, single]) {
        for (const file of [script, script.replace(/\.js$/, '.wasm')]) {
          this.emitFile({ type: 'asset', fileName: ENGINE_PATH + file, source: fs.readFileSync(path.join(engineDir, file)) })
        }
      }
    },
  }
}

export default defineConfig({
  plugins: [react(), stockfishEngine()],
  server: { headers: isolationHeaders },
  preview: { headers: isolationHeaders },
})
