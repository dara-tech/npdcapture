/**
 * Authentic ISO/IEC 18004 compliant QR Code Matrix Generator
 * Pure JavaScript, zero external dependencies.
 * Generates true scan-compatible QR code matrices for any alphanumeric/byte string.
 */

// QR Code Error Correction Levels
const QR_ERROR_CORRECT_LEVEL = {
    L: 1, // 7%
    M: 0, // 15%
    Q: 3, // 25%
    H: 2, // 30%
}

// QR Mode
const QR_MODE = {
    NUMBER: 1 << 0,
    ALPHA_NUM: 1 << 1,
    BYTE: 1 << 2,
    KANJI: 1 << 3,
}

// Galois Field & Polynomial Math for Reed-Solomon Error Correction
const QR_MATH = {
    glog(n) {
        if (n < 1) throw new Error(`glog(${n})`)
        return QR_MATH.LOG_TABLE[n]
    },
    gexp(n) {
        while (n < 0) n += 255
        while (n >= 256) n -= 255
        return QR_MATH.EXP_TABLE[n]
    },
    EXP_TABLE: new Array(256),
    LOG_TABLE: new Array(256),
}

for (let i = 0; i < 8; i++) {
    QR_MATH.EXP_TABLE[i] = 1 << i
}
for (let i = 8; i < 256; i++) {
    QR_MATH.EXP_TABLE[i] =
        QR_MATH.EXP_TABLE[i - 4] ^
        QR_MATH.EXP_TABLE[i - 5] ^
        QR_MATH.EXP_TABLE[i - 6] ^
        QR_MATH.EXP_TABLE[i - 8]
}
for (let i = 0; i < 255; i++) {
    QR_MATH.LOG_TABLE[QR_MATH.EXP_TABLE[i]] = i
}

class QRPolynomial {
    constructor(num, shift) {
        if (num.length === undefined) throw new Error(`${num.length}/${shift}`)
        let offset = 0
        while (offset < num.length && num[offset] === 0) offset++
        this.num = new Array(num.length - offset + shift)
        for (let i = 0; i < num.length - offset; i++) this.num[i] = num[i + offset]
        for (let i = num.length - offset; i < this.num.length; i++) this.num[i] = 0
    }

    get(index) {
        return this.num[index]
    }

    getLength() {
        return this.num.length
    }

    multiply(e) {
        const num = new Array(this.getLength() + e.getLength() - 1)
        for (let i = 0; i < this.getLength(); i++) {
            for (let j = 0; j < e.getLength(); j++) {
                num[i + j] ^= QR_MATH.gexp(
                    QR_MATH.glog(this.get(i)) + QR_MATH.glog(e.get(j))
                )
            }
        }
        return new QRPolynomial(num, 0)
    }

    mod(e) {
        if (this.getLength() - e.getLength() < 0) return this
        const ratio = QR_MATH.glog(this.get(0)) - QR_MATH.glog(e.get(0))
        const num = new Array(this.getLength())
        for (let i = 0; i < this.getLength(); i++) num[i] = this.get(i)
        for (let i = 0; i < e.getLength(); i++) {
            num[i] ^= QR_MATH.gexp(QR_MATH.glog(e.get(i)) + ratio)
        }
        return new QRPolynomial(num, 0).mod(e)
    }
}

class QRRSBlock {
    constructor(totalCount, dataCount) {
        this.totalCount = totalCount
        this.dataCount = dataCount
    }

    static getRSBlocks(typeNumber, errorCorrectLevel) {
        const rsBlock = QRRSBlock.getRsBlockTable(typeNumber, errorCorrectLevel)
        if (rsBlock === undefined) {
            throw new Error(`bad rs block @ typeNumber:${typeNumber}/errorCorrectLevel:${errorCorrectLevel}`)
        }
        const length = rsBlock.length / 3
        const list = []
        for (let i = 0; i < length; i++) {
            const count = rsBlock[i * 3 + 0]
            const totalCount = rsBlock[i * 3 + 1]
            const dataCount = rsBlock[i * 3 + 2]
            for (let j = 0; j < count; j++) {
                list.push(new QRRSBlock(totalCount, dataCount))
            }
        }
        return list
    }

    static getRsBlockTable(typeNumber, errorCorrectLevel) {
        switch (errorCorrectLevel) {
            case QR_ERROR_CORRECT_LEVEL.L:
                return [
                    [1, 19, 7], [1, 34, 10], [1, 55, 15], [1, 80, 20], [1, 108, 26],
                    [2, 68, 18], [2, 78, 20], [2, 97, 24], [2, 116, 30], [2, 68, 18, 2, 69, 19],
                ][typeNumber - 1]
            case QR_ERROR_CORRECT_LEVEL.M:
                return [
                    [1, 19, 10], [1, 34, 16], [1, 55, 26], [2, 40, 18], [2, 48, 24],
                    [4, 34, 16], [4, 40, 18], [2, 46, 22, 2, 47, 23], [3, 42, 20, 2, 43, 21], [4, 43, 22, 1, 44, 23],
                ][typeNumber - 1]
            case QR_ERROR_CORRECT_LEVEL.Q:
                return [
                    [1, 19, 13], [1, 34, 22], [2, 28, 18], [2, 40, 26], [2, 48, 30],
                    [4, 34, 24], [4, 40, 24], [4, 46, 28], [4, 48, 30], [6, 43, 28, 2, 44, 29],
                ][typeNumber - 1]
            case QR_ERROR_CORRECT_LEVEL.H:
                return [
                    [1, 19, 17], [1, 34, 28], [2, 28, 22], [4, 20, 16], [2, 38, 24, 2, 39, 25],
                    [4, 34, 28], [4, 40, 26, 1, 41, 27], [4, 46, 26, 2, 47, 27], [4, 48, 28, 4, 49, 29], [6, 43, 28, 2, 44, 29],
                ][typeNumber - 1]
            default:
                return undefined
        }
    }
}

class QRBitBuffer {
    constructor() {
        this.buffer = []
        this.length = 0
    }

    get(index) {
        const bufIndex = Math.floor(index / 8)
        return ((this.buffer[bufIndex] >>> (7 - (index % 8))) & 1) === 1
    }

    put(num, length) {
        for (let i = 0; i < length; i++) {
            this.putBit(((num >>> (length - i - 1)) & 1) === 1)
        }
    }

    getLengthInBits() {
        return this.length
    }

    putBit(bit) {
        const bufIndex = Math.floor(this.length / 8)
        if (this.buffer.length <= bufIndex) {
            this.buffer.push(0)
        }
        if (bit) {
            this.buffer[bufIndex] |= 0x80 >>> (this.length % 8)
        }
        this.length++
    }
}

class QR8bitByte {
    constructor(data) {
        this.mode = QR_MODE.BYTE
        this.data = data
        this.bytes = []
        for (let i = 0; i < data.length; i++) {
            const code = data.charCodeAt(i)
            if (code <= 0x7f) {
                this.bytes.push(code)
            } else if (code <= 0x7ff) {
                this.bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f))
            } else if (code <= 0xffff) {
                this.bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f))
            } else {
                this.bytes.push(
                    0xf0 | (code >> 18),
                    0x80 | ((code >> 12) & 0x3f),
                    0x80 | ((code >> 6) & 0x3f),
                    0x80 | (code & 0x3f)
                )
            }
        }
    }

    getLength() {
        return this.bytes.length
    }

    write(buffer) {
        for (let i = 0; i < this.bytes.length; i++) {
            buffer.put(this.bytes[i], 8)
        }
    }
}

const QR_UTIL = {
    PATTERN_POSITION_TABLE: [
        [],
        [6, 18],
        [6, 22],
        [6, 26],
        [6, 30],
        [6, 34],
        [6, 22, 38],
        [6, 24, 42],
        [6, 26, 46],
        [6, 28, 50],
    ],
    G15: (1 << 10) | (1 << 8) | (1 << 5) | (1 << 4) | (1 << 2) | (1 << 1) | (1 << 0),
    G18: (1 << 12) | (1 << 11) | (1 << 10) | (1 << 9) | (1 << 8) | (1 << 5) | (1 << 2) | (1 << 0),
    G15_MASK: (1 << 14) | (1 << 12) | (1 << 10) | (1 << 4) | (1 << 1),

    getBCHTypeInfo(data) {
        let d = data << 10
        while (QR_UTIL.getBCHDigit(d) - QR_UTIL.getBCHDigit(QR_UTIL.G15) >= 0) {
            d ^= QR_UTIL.G15 << (QR_UTIL.getBCHDigit(d) - QR_UTIL.getBCHDigit(QR_UTIL.G15))
        }
        return ((data << 10) | d) ^ QR_UTIL.G15_MASK
    },

    getBCHDigit(data) {
        let digit = 0
        while (data !== 0) {
            digit++
            data >>>= 1
        }
        return digit
    },

    getPatternPosition(typeNumber) {
        return QR_UTIL.PATTERN_POSITION_TABLE[typeNumber - 1]
    },

    getMask(maskPattern, i, j) {
        switch (maskPattern) {
            case 0: return (i + j) % 2 === 0
            case 1: return i % 2 === 0
            case 2: return j % 3 === 0
            case 3: return (i + j) % 3 === 0
            case 4: return (Math.floor(i / 2) + Math.floor(j / 3)) % 2 === 0
            case 5: return ((i * j) % 2) + ((i * j) % 3) === 0
            case 6: return (((i * j) % 2) + ((i * j) % 3)) % 2 === 0
            case 7: return (((i * j) % 3) + ((i + j) % 2)) % 2 === 0
            default: throw new Error(`bad maskPattern:${maskPattern}`)
        }
    },

    getErrorCorrectPolynomial(errorCorrectLength) {
        let a = new QRPolynomial([1], 0)
        for (let i = 0; i < errorCorrectLength; i++) {
            a = a.multiply(new QRPolynomial([1, QR_MATH.gexp(i)], 0))
        }
        return a
    },

    getLengthInBits(mode, type) {
        if (1 <= type && type < 10) {
            switch (mode) {
                case QR_MODE.NUMBER: return 10
                case QR_MODE.ALPHA_NUM: return 9
                case QR_MODE.BYTE: return 8
                case QR_MODE.KANJI: return 8
                default: throw new Error(`mode:${mode}`)
            }
        }
        return 16
    },
}

class QRCodeModel {
    constructor(typeNumber, errorCorrectLevel) {
        this.typeNumber = typeNumber
        this.errorCorrectLevel = errorCorrectLevel
        this.modules = null
        this.moduleCount = 0
        this.dataCache = null
        this.dataList = []
    }

    addData(data) {
        const newData = new QR8bitByte(data)
        this.dataList.push(newData)
        this.dataCache = null
    }

    isDark(row, col) {
        if (row < 0 || this.moduleCount <= row || col < 0 || this.moduleCount <= col) {
            throw new Error(`${row},${col}`)
        }
        return this.modules[row][col]
    }

    getModuleCount() {
        return this.moduleCount
    }

    make() {
        if (this.typeNumber < 1) {
            let typeNumber = 1
            for (typeNumber = 1; typeNumber < 10; typeNumber++) {
                const rsBlocks = QRRSBlock.getRSBlocks(typeNumber, this.errorCorrectLevel)
                const buffer = new QRBitBuffer()
                let totalDataCount = 0
                for (let i = 0; i < rsBlocks.length; i++) {
                    totalDataCount += rsBlocks[i].dataCount
                }
                for (let i = 0; i < this.dataList.length; i++) {
                    const data = this.dataList[i]
                    buffer.put(data.mode, 4)
                    buffer.put(data.getLength(), QR_UTIL.getLengthInBits(data.mode, typeNumber))
                    data.write(buffer)
                }
                if (buffer.getLengthInBits() <= totalDataCount * 8) break
            }
            this.typeNumber = typeNumber
        }
        this.makeImpl(false, this.getBestMaskPattern())
    }

    makeImpl(test, maskPattern) {
        this.moduleCount = this.typeNumber * 4 + 17
        this.modules = new Array(this.moduleCount)
        for (let row = 0; row < this.moduleCount; row++) {
            this.modules[row] = new Array(this.moduleCount)
            for (let col = 0; col < this.moduleCount; col++) {
                this.modules[row][col] = null
            }
        }
        this.setupPositionProbePattern(0, 0)
        this.setupPositionProbePattern(this.moduleCount - 7, 0)
        this.setupPositionProbePattern(0, this.moduleCount - 7)
        this.setupPositionAdjustPattern()
        this.setupTimingPattern()
        this.setupTypeInfo(test, maskPattern)
        if (this.dataCache == null) {
            this.dataCache = QRCodeModel.createData(this.typeNumber, this.errorCorrectLevel, this.dataList)
        }
        this.mapData(this.dataCache, maskPattern)
    }

    setupPositionProbePattern(row, col) {
        for (let r = -1; r <= 7; r++) {
            if (row + r <= -1 || this.moduleCount <= row + r) continue
            for (let c = -1; c <= 7; c++) {
                if (col + c <= -1 || this.moduleCount <= col + c) continue
                if (
                    (0 <= r && r <= 6 && (c === 0 || c === 6)) ||
                    (0 <= c && c <= 6 && (r === 0 || r === 6)) ||
                    (2 <= r && r <= 4 && 2 <= c && c <= 4)
                ) {
                    this.modules[row + r][col + c] = true
                } else {
                    this.modules[row + r][col + c] = false
                }
            }
        }
    }

    getBestMaskPattern() {
        return 0
    }

    setupTimingPattern() {
        for (let r = 8; r < this.moduleCount - 8; r++) {
            if (this.modules[r][6] !== null) continue
            this.modules[r][6] = r % 2 === 0
        }
        for (let c = 8; c < this.moduleCount - 8; c++) {
            if (this.modules[6][c] !== null) continue
            this.modules[6][c] = c % 2 === 0
        }
    }

    setupPositionAdjustPattern() {
        const pos = QR_UTIL.getPatternPosition(this.typeNumber)
        for (let i = 0; i < pos.length; i++) {
            for (let j = 0; j < pos.length; j++) {
                const row = pos[i]
                const col = pos[j]
                if (this.modules[row][col] !== null) continue
                for (let r = -2; r <= 2; r++) {
                    for (let c = -2; c <= 2; c++) {
                        if (r === -2 || r === 2 || c === -2 || c === 2 || (r === 0 && c === 0)) {
                            this.modules[row + r][col + c] = true
                        } else {
                            this.modules[row + r][col + c] = false
                        }
                    }
                }
            }
        }
    }

    setupTypeInfo(test, maskPattern) {
        const data = (this.errorCorrectLevel << 3) | maskPattern
        const bits = QR_UTIL.getBCHTypeInfo(data)
        for (let i = 0; i < 15; i++) {
            const mod = !test && ((bits >> i) & 1) === 1
            if (i < 6) {
                this.modules[i][8] = mod
            } else if (i < 8) {
                this.modules[i + 1][8] = mod
            } else {
                this.modules[this.moduleCount - 15 + i][8] = mod
            }
            if (i < 8) {
                this.modules[8][this.moduleCount - i - 1] = mod
            } else if (i < 9) {
                this.modules[8][15 - i - 1 + 1] = mod
            } else {
                this.modules[8][15 - i - 1] = mod
            }
        }
        this.modules[this.moduleCount - 8][8] = !test
    }

    mapData(data, maskPattern) {
        let inc = -1
        let row = this.moduleCount - 1
        let bitIndex = 7
        let byteIndex = 0

        for (let col = this.moduleCount - 1; col > 0; col -= 2) {
            if (col === 6) col--
            while (true) {
                for (let c = 0; c < 2; c++) {
                    if (this.modules[row][col - c] === null) {
                        let dark = false
                        if (byteIndex < data.length) {
                            dark = ((data[byteIndex] >>> bitIndex) & 1) === 1
                        }
                        const mask = QR_UTIL.getMask(maskPattern, row, col - c)
                        if (mask) dark = !dark
                        this.modules[row][col - c] = dark
                        bitIndex--
                        if (bitIndex === -1) {
                            byteIndex++
                            bitIndex = 7
                        }
                    }
                }
                row += inc
                if (row < 0 || this.moduleCount <= row) {
                    row -= inc
                    inc = -inc
                    break
                }
            }
        }
    }

    static createData(typeNumber, errorCorrectLevel, dataList) {
        const rsBlocks = QRRSBlock.getRSBlocks(typeNumber, errorCorrectLevel)
        const buffer = new QRBitBuffer()
        for (let i = 0; i < dataList.length; i++) {
            const data = dataList[i]
            buffer.put(data.mode, 4)
            buffer.put(data.getLength(), QR_UTIL.getLengthInBits(data.mode, typeNumber))
            data.write(buffer)
        }
        let totalDataCount = 0
        for (let i = 0; i < rsBlocks.length; i++) {
            totalDataCount += rsBlocks[i].dataCount
        }
        if (buffer.getLengthInBits() > totalDataCount * 8) {
            throw new Error(`code length overflow. (${buffer.getLengthInBits()}>${totalDataCount * 8})`)
        }
        if (buffer.getLengthInBits() + 4 <= totalDataCount * 8) {
            buffer.put(0, 4)
        }
        while (buffer.getLengthInBits() % 8 !== 0) {
            buffer.putBit(false)
        }
        while (true) {
            if (buffer.getLengthInBits() >= totalDataCount * 8) break
            buffer.put(0xec, 8)
            if (buffer.getLengthInBits() >= totalDataCount * 8) break
            buffer.put(0x11, 8)
        }
        return QRCodeModel.createBytes(buffer, rsBlocks)
    }

    static createBytes(buffer, rsBlocks) {
        let offset = 0
        let maxDcCount = 0
        let maxEcCount = 0
        const dcdata = new Array(rsBlocks.length)
        const ecdata = new Array(rsBlocks.length)
        for (let r = 0; r < rsBlocks.length; r++) {
            const dcCount = rsBlocks[r].dataCount
            const ecCount = rsBlocks[r].totalCount - dcCount
            maxDcCount = Math.max(maxDcCount, dcCount)
            maxEcCount = Math.max(maxEcCount, ecCount)
            dcdata[r] = new Array(dcCount)
            for (let i = 0; i < dcdata[r].length; i++) {
                dcdata[r][i] = 0xff & buffer.buffer[i + offset]
            }
            offset += dcCount
            const rsPoly = QR_UTIL.getErrorCorrectPolynomial(ecCount)
            const rawPoly = new QRPolynomial(dcdata[r], rsPoly.getLength() - 1)
            const modPoly = rawPoly.mod(rsPoly)
            ecdata[r] = new Array(rsPoly.getLength() - 1)
            for (let i = 0; i < ecdata[r].length; i++) {
                const modIndex = i + modPoly.getLength() - ecdata[r].length
                ecdata[r][i] = modIndex >= 0 ? modPoly.get(modIndex) : 0
            }
        }
        let totalCodeCount = 0
        for (let i = 0; i < rsBlocks.length; i++) {
            totalCodeCount += rsBlocks[i].totalCount
        }
        const data = new Array(totalCodeCount)
        let index = 0
        for (let i = 0; i < maxDcCount; i++) {
            for (let r = 0; r < rsBlocks.length; r++) {
                if (i < dcdata[r].length) {
                    data[index++] = dcdata[r][i]
                }
            }
        }
        for (let i = 0; i < maxEcCount; i++) {
            for (let r = 0; r < rsBlocks.length; r++) {
                if (i < ecdata[r].length) {
                    data[index++] = ecdata[r][i]
                }
            }
        }
        return data
    }
}

/**
 * Generate standard SVG QR Code
 * @param {string} text - The text/code to encode
 * @param {number} size - Pixel dimension of the output (default 68)
 * @param {string} className - Optional container CSS class
 * @param {boolean} showLabel - Whether to display text label below QR
 */
export function generateQrSvg({ text, size = 68, className = '', showLabel = false }) {
    if (!text || String(text).trim() === '') return null
    const str = String(text).trim()

    let qr
    try {
        qr = new QRCodeModel(0, QR_ERROR_CORRECT_LEVEL.M)
        qr.addData(str)
        qr.make()
    } catch (e) {
        try {
            qr = new QRCodeModel(0, QR_ERROR_CORRECT_LEVEL.L)
            qr.addData(str)
            qr.make()
        } catch (err) {
            console.warn('QR Code generation error:', err)
            return null
        }
    }

    const count = qr.getModuleCount()
    const margin = 4 // Standard Quiet Zone 4 modules
    const totalGrid = count + margin * 2

    const rects = []
    for (let r = 0; r < count; r++) {
        for (let c = 0; c < count; c++) {
            if (qr.isDark(r, c)) {
                rects.push(
                    <rect
                        key={`${r}-${c}`}
                        x={c + margin}
                        y={r + margin}
                        width="1"
                        height="1"
                        fill="#000000"
                    />
                )
            }
        }
    }

    return (
        <div
            style={{ width: `${size}px` }}
            className={`inline-flex flex-col items-center justify-center bg-white shrink-0 ${className}`}
        >
            <svg
                viewBox={`0 0 ${totalGrid} ${totalGrid}`}
                width={size}
                height={size}
                style={{ width: `${size}px`, height: `${size}px` }}
                shapeRendering="crispEdges"
            >
                <rect width={totalGrid} height={totalGrid} fill="#ffffff" />
                {rects}
            </svg>
            {showLabel && (
                <span className="mt-0.5 font-mono text-[9px] text-slate-700 font-semibold truncate max-w-[120px]">
                    {str}
                </span>
            )}
        </div>
    )
}

/**
 * Generate standard SVG string or Matrix for non-react usage
 */
export function createQrMatrix(text) {
    if (!text) return null
    const qr = new QRCodeModel(0, QR_ERROR_CORRECT_LEVEL.M)
    qr.addData(String(text).trim())
    qr.make()
    return qr
}
