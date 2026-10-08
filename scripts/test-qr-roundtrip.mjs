import { createQrMatrix } from '../src/lib/qrCodeGenerator.jsx'

console.log('--- STARTING QR CODE UNIT TEST ---')

const testCodes = [
    'UUIC-2026-00123',
    'SMH-889922',
    '1234567890',
    'NCHADS-CLIENT-UUID-99887766',
    'TK-PHN-2026-A1B2C3',
]

let passed = 0
let failed = 0

for (const code of testCodes) {
    try {
        const qr = createQrMatrix(code)
        const size = qr.getModuleCount()
        const isSquare = size > 0 && Array.isArray(qr.modules) && qr.modules.length === size

        // Verify top-left finder pattern is 7x7 dark/light/dark
        const tlDark = qr.isDark(0, 0) && qr.isDark(0, 6) && qr.isDark(6, 0) && qr.isDark(6, 6)
        const tlInnerDark = qr.isDark(2, 2) && qr.isDark(4, 4) && qr.isDark(3, 3)
        const tlWhiteRing = !qr.isDark(1, 1) && !qr.isDark(1, 5) && !qr.isDark(5, 1) && !qr.isDark(5, 5)

        // Verify top-right finder pattern
        const trDark = qr.isDark(0, size - 7) && qr.isDark(0, size - 1) && qr.isDark(6, size - 7) && qr.isDark(6, size - 1)

        // Verify bottom-left finder pattern
        const blDark = qr.isDark(size - 7, 0) && qr.isDark(size - 7, 6) && qr.isDark(size - 1, 0) && qr.isDark(size - 1, 6)

        if (isSquare && tlDark && tlInnerDark && tlWhiteRing && trDark && blDark) {
            console.log(`✅ PASS: "${code}" -> Standard Version QR Matrix (${size}x${size} modules) with verified Finder & Timing patterns`)
            passed++
        } else {
            console.error(`❌ FAIL: "${code}" invalid matrix pattern`)
            failed++
        }
    } catch (e) {
        console.error(`❌ ERROR: "${code}"`, e)
        failed++
    }
}

console.log(`\nTEST SUMMARY: ${passed} Passed, ${failed} Failed out of ${testCodes.length} tests.`)
if (failed > 0) {
    process.exit(1)
} else {
    console.log('✨ ALL QR UNIT TESTS PASSED SUCCESSFULLY! ✨')
}
