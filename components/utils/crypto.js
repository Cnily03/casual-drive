const crypto = require("crypto");
const SM2 = require('sm-crypto').sm2;

const DEFAULT_AES_ALGORITHM = "aes-128-cbc";
const ALPHABET = {
    NUMBER: "0123456789",
    LOWERCASE: "abcdefghijklmnopqrstuvwxyz",
    UPPERCASE: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
    SYMBOL: "!\"#$%&'()*+,-./:;<=>?@[\\]^_`{|}~",
    aZ: "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ",
    aZ09: "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789",
    VISIBLE: " !\"#$%&'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~",
    UN_VISIBLE: Array.from({ length: 128 }, (_, i) => String.fromCharCode(i)).join("").replace(/[\x20-\x7E]/g, ""),
    ALL_ASCII: Array.from({ length: 128 }, (_, i) => String.fromCharCode(i)).join("")
}

/**
 * Generates a random hexadecimal string of the specified length.
 * @param {number} length - The length of the hexadecimal string to generate.
 * @returns {string} The generated hexadecimal string.
 */
const rndHex = function (length) {
    return Array.from({ length: length }, () => Math.floor(Math.random() * 0x10).toString(16)).join("");
}

/**
 * Generates a random string of the specified length, using the specified options.
 * @param {number} length - The length of the string to generate.
 * @param {string | {repeat?:boolean, alphabet?: string, ensure?:(string|{pattern:string,count:number,repeat?:boolean})[]}} [options=ALPHABET.VISIBLE] - The options to use when generating the string. If a string is provided, it is used as the alphabet.
 * @param {boolean} [options.repeat=true] - Whether to allow repeat charactors.
 * @param {string} [options.alphabet=ALPHABET.VISIBLE] - The alphabet to use when generating the string.
 * @param {string | {pattern:string,count:number,repeat?:boolean}} [options.ensure=[]] - The charactors to ensure in the generated string.
 * @param {string} [options.ensure.pattern] - The charactors to ensure in the generated string.
 * @param {number} [options.ensure.count] - The count of charactors to ensure in the generated string.
 * @param {boolean} [options.ensure.repeat=false] - Whether to allow repeat charactors in the ensure charactors.
 * @returns {string} The generated string.
 */
const rndStr = function (length, options = ALPHABET.VISIBLE) {
    let opts = { repeat: true, alphabet: undefined, ensure: [] };
    if (typeof options === "string") opts.alphabet = options;
    else opts = Object.assign(opts, options);
    if (typeof opts.alphabet !== "string") {
        if (!Array.isArray(opts.ensure) || opts.ensure.length === 0) throw new Error("Alphabet is empty. ensure or alphabet must be provided.")
        if (typeof opts.ensure[0] === "string") opts.ensure = opts.ensure.map(c => ({ pattern: c, count: 1, repeat: false }))
        opts.alphabet = Array.from(new Set(opts.ensure.map(a => a.pattern).join("").split(""))).join("")
    }

    let ensurelist = []
    for (let key in opts.ensure) {
        opts.ensure[key].repeat = typeof opts.ensure[key].repeat === "boolean" ? opts.ensure[key].repeat : false
        const { pattern, count } = opts.ensure[key];
        // remove charactors not existing in alphabet and remove repeat charactors
        let charlist = Array.from(new Set(pattern.split("").filter(c => opts.alphabet.includes(c)))).join("")
        let cnt = count
        while (cnt--) {
            const char = charlist[Math.floor(Math.random() * charlist.length)]
            ensurelist.push(char)
            if (!opts.ensure[key].repeat) charlist = charlist.replace(char, "")
        }
    }
    let autolen = length - ensurelist.length

    let autolist = []

    if (opts.repeat) {
        autolist = Array.from({ length: autolen }, () => opts.alphabet[Math.floor(Math.random() * opts.alphabet.length)])
    } else {
        while (autolist.length < autolen) {
            const char = opts.alphabet[Math.floor(Math.random() * opts.alphabet.length)];
            autolist.push(char);
            opts.alphabet = opts.alphabet.replaceAll(char, "");
        }
    }

    let result = "";
    let insertIndex = Array.from({ length: ensurelist.length }, () => Math.floor(Math.random() * (autolen + 1)))
        .map(c => ({ pos: c, char: ensurelist.shift() })).sort((a, b) => a.pos - b.pos)
    for (let i = 0; i < autolen; i++) {
        while (insertIndex.length && i === insertIndex[0].pos) {
            result += insertIndex[0].char;
            insertIndex.shift();
        }
        result += autolist.shift();
    }
    while (insertIndex.length) result += insertIndex.shift().char;
    return result
}

/**
 * @param {string | Buffer | ArrayBuffer} data 
 * @param {string | Buffer | ArrayBuffer} key 
 */
const xor = function (data, key, returnBuffer = false) {
    const dataBuf = Buffer.from(data, "utf8");
    const keyBuf = Buffer.from(key, "utf8");
    const result = Buffer.alloc(dataBuf.length);
    for (let i = 0; i < dataBuf.length; i++) {
        result[i] = dataBuf[i] ^ keyBuf[i % keyBuf.length];
    }
    return returnBuffer ? result : result.toString("utf8");
}

const base64 = {
    /**
     * @param {string | Buffer | ArrayBuffer} data 
     */
    encode: function (data) {
        const code = Buffer.from(data, 'utf-8').toString('base64');
        return code;
    },
    /**
     * @param {string} str
     */
    decode: function (str, returnBuffer = false) {
        const code = Buffer.from(str, 'base64');
        return returnBuffer ? code : code.toString('utf-8');
    }
}

const aes = {
    /**
     * @param {string} str
     * @param {string} aesKey
     * @param {'aes-128-cbc' | 'aes-128-cbc-hmac-sha1' | 'aes-128-cbc-hmac-sha256' | 'aes-128-cfb' | 'aes-128-cfb1' | 'aes-128-cfb8' | 'aes-128-ctr' | 'aes-128-ecb' | 'aes-128-ocb' | 'aes-128-ofb' | 'aes-128-xts' | 'aes-192-cbc' | 'aes-192-cfb' | 'aes-192-cfb1' | 'aes-192-cfb8' | 'aes-192-ctr' | 'aes-192-ecb' | 'aes-192-ocb' | 'aes-192-ofb' | 'aes-256-cbc' | 'aes-256-cbc-hmac-sha1' | 'aes-256-cbc-hmac-sha256' | 'aes-256-cfb' | 'aes-256-cfb1' | 'aes-256-cfb8' | 'aes-256-ctr' | 'aes-256-ecb' | 'aes-256-ocb' | 'aes-256-ofb' | 'aes-256-xts'} algorithm 
     */
    encode: function (str, aesKey, aesIv = aesKey, algorithm = DEFAULT_AES_ALGORITHM) {
        const keyKey = Buffer.from(aesKey, "utf8");
        const iv = Buffer.from(aesIv, "utf8");
        var cipher = crypto.createCipheriv(algorithm, aesKey, aesIv);
        var code = cipher.update(str, "utf8", "hex");
        code += cipher.final("hex");
        return code;
    },
    /**
     * @param {string} str
     * @param {string} aesKey
     * @param {'aes-128-cbc' | 'aes-128-cbc-hmac-sha1' | 'aes-128-cbc-hmac-sha256' | 'aes-128-cfb' | 'aes-128-cfb1' | 'aes-128-cfb8' | 'aes-128-ctr' | 'aes-128-ecb' | 'aes-128-ocb' | 'aes-128-ofb' | 'aes-128-xts' | 'aes-192-cbc' | 'aes-192-cfb' | 'aes-192-cfb1' | 'aes-192-cfb8' | 'aes-192-ctr' | 'aes-192-ecb' | 'aes-192-ocb' | 'aes-192-ofb' | 'aes-256-cbc' | 'aes-256-cbc-hmac-sha1' | 'aes-256-cbc-hmac-sha256' | 'aes-256-cfb' | 'aes-256-cfb1' | 'aes-256-cfb8' | 'aes-256-ctr' | 'aes-256-ecb' | 'aes-256-ocb' | 'aes-256-ofb' | 'aes-256-xts'} algorithm 
     */
    decode: function (str, aesKey, aesIv = aesKey, algorithm = DEFAULT_AES_ALGORITHM) {
        const keyKey = Buffer.from(aesKey, "utf8");
        const iv = Buffer.from(aesIv, "utf8");
        var cipher = crypto.createDecipheriv(algorithm, aesKey, aesIv);
        var code = cipher.update(str, "hex", "utf8");
        code += cipher.final("utf8");
        return code;
    }
}

const rsa = {
    encodeByPub: function (str, pubKey) {
        const buf = crypto.publicEncrypt(pubKey, Buffer.from(str, "utf8"));
        return buf.toString("hex");
    },
    encodeByPte: function (str, pteKey) {
        const buf = crypto.privateEncrypt(pteKey, Buffer.from(str, "utf-8"));
        return buf.toString("hex");
    },
    decodeByPte: function (str, pteKey) {
        const buf = crypto.privateDecrypt(pteKey, Buffer.from(str, "hex"));
        return buf.toString("utf8");
    },
    decodeByPub: function (str, pubKey) {
        const buf = crypto.publicDecrypt(pubKey, Buffer.from(str, "hex"));
        return buf.toString("utf8");
    }
}

const sm2 = {
    /**
     * @param {string} data
     * @param {string} pubKey
     * @param {"C1C2C3"|"C1C3C2"} cipherMode
     * @returns {string}
     */
    encode: function (data, pubKey, cipherMode = 'C1C3C2') {
        return SM2.doEncrypt(data, pubKey, ["C1C2C3", "C1C3C2"].indexOf(cipherMode));
    },
    /**
     * @param {string} data
     * @param {string} pteKey
     * @param {"C1C2C3"|"C1C3C2"} cipherMode
     * @returns {string}
     */
    decode: function (data, pteKey, cipherMode = 'C1C3C2') {
        return SM2.doDecrypt(data, pteKey, ["C1C2C3", "C1C3C2"].indexOf(cipherMode));
    },
    sign: (data, pteKey) => SM2.doSignature(data, pteKey, {
        pointPool: [SM2.getPoint(), SM2.getPoint(), SM2.getPoint(), SM2.getPoint()]
    }),
    verifySign: SM2.doVerifySignature,
    generateKeyPairHex: SM2.generateKeyPairHex
}

function sha256(str) {
    var sha256 = crypto.createHash("sha256");
    var code = sha256.update(str).digest("hex");
    return code;
}

function sha128(str) {
    var sha128 = crypto.createHash("sha128");
    var code = sha128.update(str).digest("hex");
    return code;
}


function sha1(str) {
    var sha1 = crypto.createHash("sha1");
    var code = sha1.update(str).digest("hex");
    return code;
}

function md5(str) {
    var md5 = crypto.createHash("md5");
    var code = md5.update(str).digest("hex");
    return code;
}

module.exports = {
    rndHex, rndStr, xor, base64, aes, rsa, sm2, sha256, sha128, sha1, md5, ALPHABET
}