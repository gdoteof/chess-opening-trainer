import { config } from '../config'
import { EngineService } from './EngineService'
import { ENGINE_FILES, ENGINE_PATH } from './engineFiles'
import { workerTransport } from './transport'

export interface EngineBuild {
  file: string
  threaded: boolean
  threads: number
}

const INIT_TIMEOUT_MS = 20000

/**
 * Starts the single full-strength Stockfish instance: the multi-threaded build when the page
 * is cross-origin isolated (SharedArrayBuffer available), otherwise the single-threaded one.
 */
export async function loadEngine(): Promise<{ engine: EngineService; build: EngineBuild }> {
  const files = ENGINE_FILES[config.engine.flavor]
  if (canUseThreads()) {
    const threads = Math.max(1, Math.min(config.engine.maxThreads, (navigator.hardwareConcurrency || 2) - 1))
    try {
      return await start({ file: files.threaded, threaded: true, threads })
    } catch (error) {
      console.warn('[engine] multi-threaded build failed to start; using single-threaded', error)
    }
  } else {
    console.info('[engine] page is not cross-origin isolated; using the single-threaded build')
  }
  return start({ file: files.single, threaded: false, threads: 1 })
}

function canUseThreads(): boolean {
  return globalThis.crossOriginIsolated === true && typeof SharedArrayBuffer !== 'undefined'
}

async function start(build: EngineBuild): Promise<{ engine: EngineService; build: EngineBuild }> {
  const worker = new Worker(`${import.meta.env.BASE_URL}${ENGINE_PATH}${build.file}`)
  const engine = new EngineService(workerTransport(worker))
  let timer: ReturnType<typeof setTimeout> | undefined
  const failed = new Promise<never>((_, reject) => {
    worker.addEventListener('error', (event) => reject(new Error(event.message || 'engine worker error')))
    timer = setTimeout(() => reject(new Error('engine did not answer in time')), INIT_TIMEOUT_MS)
  })
  try {
    await Promise.race([engine.init({ threads: build.threads, hashMb: config.engine.hashMb }), failed])
  } catch (error) {
    worker.terminate()
    throw error
  } finally {
    clearTimeout(timer)
    failed.catch(() => {})
  }
  console.info(
    `[engine] loaded ${build.threaded ? 'multi-threaded' : 'single-threaded'} Stockfish (${build.file}), ` +
      `${build.threads} thread${build.threads === 1 ? '' : 's'}`,
  )
  return { engine, build }
}
