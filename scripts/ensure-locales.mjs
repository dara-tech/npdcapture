#!/usr/bin/env node
/**
 * Ensures src/locales/index.js exists before dev/build.
 * d2-app-scripts generates it from i18n/*.po; without it Vite fails on `import './locales/index.js'`.
 * Also syncs into .d2/shell when the dev copy is missing (e.g. after a partial HMR wipe).
 */
import { existsSync, cpSync, mkdirSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const srcLocales = path.join(root, 'src', 'locales')
const indexFile = path.join(srcLocales, 'index.js')
const shellLocales = path.join(root, '.d2', 'shell', 'src', 'D2App', 'locales')

function runGenerate() {
    console.log('[ensure-locales] Running d2-app-scripts i18n generate…')
    const result = spawnSync(
        'npx',
        ['d2-app-scripts', 'i18n', 'generate'],
        { cwd: root, stdio: 'inherit', shell: process.platform === 'win32' }
    )
    if (result.status !== 0) {
        process.exit(result.status ?? 1)
    }
}

if (!existsSync(indexFile)) {
    runGenerate()
}

if (!existsSync(indexFile)) {
    console.error('[ensure-locales] src/locales/index.js is still missing after generate.')
    process.exit(1)
}

const shellIndex = path.join(shellLocales, 'index.js')
if (!existsSync(shellIndex) && existsSync(indexFile)) {
    mkdirSync(shellLocales, { recursive: true })
    cpSync(srcLocales, shellLocales, { recursive: true })
    console.log('[ensure-locales] Synced src/locales → .d2/shell/src/D2App/locales')
}
