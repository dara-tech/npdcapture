/**
 * Build DHIS2 menu icons (16 / 48 / 128) from public/app-logo-source.png.
 * Optionally patch manifest.webapp after d2-app-scripts generateManifests (which only sets 48).
 */
import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const publicDir = path.join(root, 'public')
const srcIcon = path.join(publicDir, 'app-logo-source.png')

const ICON_SIZES = [16, 48, 128]

/** Menu manifest: 48 uses full-size master; 16/128 are resized variants. */
const MANIFEST_ICONS = {
    16: 'dhis2-app-icon-16.png',
    48: 'dhis2-app-icon.png',
    128: 'dhis2-app-icon-128.png',
}

function readDimensions(filePath) {
    const out = execSync(`sips -g pixelWidth -g pixelHeight "${filePath}"`, {
        encoding: 'utf8',
    })
    const w = Number(/pixelWidth:\s*(\d+)/.exec(out)?.[1])
    const h = Number(/pixelHeight:\s*(\d+)/.exec(out)?.[1])
    return { w, h }
}

/** Center-crop to square so menu icons are not stretched. */
function writeSquareMaster(src, dest) {
    fs.copyFileSync(src, dest)
    const { w, h } = readDimensions(dest)
    if (w && h && w !== h) {
        const side = Math.min(w, h)
        execSync(`sips -c ${side} ${side} "${dest}"`, { stdio: 'inherit' })
    }
}

function resizePng(size, src, dest) {
    if (process.platform === 'darwin') {
        execSync(`sips -z ${size} ${size} "${src}" --out "${dest}"`, {
            stdio: 'inherit',
        })
        return
    }
    try {
        execSync(
            `convert "${src}" -resize ${size}x${size}! "${dest}"`,
            { stdio: 'inherit' }
        )
    } catch {
        throw new Error(
            'Icon resize failed. On macOS use built-in sips; on Linux install ImageMagick (convert).'
        )
    }
}

function generateIcons() {
    if (!fs.existsSync(srcIcon)) {
        throw new Error(
            `Missing ${path.relative(root, srcIcon)}. Add your logo as public/app-logo-source.png`
        )
    }
    fs.mkdirSync(publicDir, { recursive: true })
    const master = path.join(publicDir, 'dhis2-app-icon.png')
    writeSquareMaster(srcIcon, master)
    for (const size of ICON_SIZES) {
        resizePng(size, master, path.join(publicDir, `dhis2-app-icon-${size}.png`))
    }
    console.log('Generated DHIS2 app icons in capture/public/')
}

function patchManifest(manifestPath) {
    if (!fs.existsSync(manifestPath)) {
        console.warn(`manifest not found (skip): ${manifestPath}`)
        return
    }
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
    manifest.icons = { ...MANIFEST_ICONS }
    fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
    console.log(`Patched icons in ${path.relative(root, manifestPath)}`)
}

const patchBuild = process.argv.includes('--patch-build')
const patchShell = process.argv.includes('--patch-shell')

generateIcons()

if (patchBuild) {
    patchManifest(path.join(root, 'build/app/manifest.webapp'))
}

if (patchShell) {
    patchManifest(path.join(root, '.d2/shell/public/manifest.webapp'))
}
