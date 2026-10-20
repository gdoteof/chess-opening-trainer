/**
 * Stockfish builds from the `stockfish` npm package, served from `/engine/` by the Vite
 * plugin in vite.config.ts. Each script loads the .wasm file of the same name beside it.
 */
export const ENGINE_FILES = {
  lite: { threaded: 'stockfish-19-lite.js', single: 'stockfish-19-lite-single.js' },
  full: { threaded: 'stockfish-19.js', single: 'stockfish-19-single.js' },
} as const

export type EngineFlavor = keyof typeof ENGINE_FILES

export const ENGINE_PATH = 'engine/'
