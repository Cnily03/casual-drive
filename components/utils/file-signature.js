const crypto = require("./crypto");
const CONFIG = require("../../runtime.config.json");

/**
 * Sign text with SM2
 * 
 * - Algorithm:
 *   ```
 *   text = raw_text + "." + random_salt
 *   signature = SM2_sign(text)
 *   signed_text = base64_encode(random_xor_key + "." + xor_encode(text)) + "." + base64_encode(signature ^ xor_key)
 *   ```
 * @param {string} raw_text - The text to sign.
 * @param {Object} keys - The keys to use for signing.
 * @param {string} keys.pteKey - The private key to use for signing.
 * @param {string} keys.xorKey - The XOR key to use for signing.
 * @returns {string} The signed text.
 */
function genRawFileSignature(raw_text, { pteKey, xorKey } = CONFIG.download_signature.SM2) {
    let rndsalt = crypto.rndStr(3 + raw_text.length % 4, crypto.ALPHABET.ALL_ASCII)
        .replace(/\.|\{|\}/g, crypto.rndStr(1, crypto.ALPHABET.UN_VISIBLE));
    let text = raw_text + "." + rndsalt;
    let signature = crypto.sm2.sign(text, pteKey);
    let rnd_xor_key = crypto.rndStr(4 + text.length % 3, crypto.ALPHABET.ALL_ASCII)
        .replace(/\./g, crypto.rndStr(1, crypto.ALPHABET.UN_VISIBLE));

    return crypto.base64.encode(rnd_xor_key + "." + crypto.xor(text, rnd_xor_key, true)) +
        "." + crypto.base64.encode(crypto.xor(signature, xorKey, true));
}



/**
 * Verify the signature of the given text.
 *
 * @param {string} enc_text - The signed text to verify.
 * @param {Object} keys - The keys to use for verification.
 * @param {string} keys.pubKey - The public key to use for verification.
 * @param {string} keys.xorKey - The XOR key to use for verification.
 * @returns {boolean} A boolean indicating whether the signature is verified or not.
 */
function verifyFileSignature(enc_text, { pubKey, xorKey } = CONFIG.download_signature.SM2) {
    try {
        let [base64_xor_text, base64_encrypted_sig] = enc_text.split(".")
        const signature = crypto.xor(crypto.base64.decode(base64_encrypted_sig, true), xorKey);
        let xor_text = crypto.base64.decode(base64_xor_text);
        let rnd_xor_key = xor_text.split(".")[0];
        const text = crypto.xor(xor_text.substring(rnd_xor_key.length + 1), rnd_xor_key)
        return crypto.sm2.verifySign(text, signature, pubKey);
    }
    catch (e) { return false }
}



/**
 * Extracts the raw file sign data from the given signed text if the signature is verified.
 *
 * @param {string} enc_text - The signed text to extract the raw file sign data from.
 * @param {Object} keys - The keys to use for verification.
 * @param {string} keys.pubKey - The public key to use for verification.
 * @param {string} keys.xorKey - The XOR key to use for verification.
 * @returns {string | undefined} The raw file sign data if the signature is verified, otherwise undefined.
 */
function getRawFileSignData(enc_text, { pubKey, xorKey } = CONFIG.download_signature.SM2) {
    try {
        if (verifyFileSignature(enc_text, { pubKey, xorKey })) {
            let base64_xor_text = enc_text.split(".")[0]
            let xor_text = crypto.base64.decode(base64_xor_text);
            let rnd_xor_key = xor_text.split(".")[0];
            const text = crypto.xor(xor_text.substring(rnd_xor_key.length + 1), rnd_xor_key)
            let rnd_salt = text.split(".").reverse()[0];
            return text.substring(0, text.length - rnd_salt.length - 1);
        } else return undefined
    } catch (e) { return undefined }
}



/**
 * Verify the signature of the given text and return the file data if verified.
 *
 * @param {string} enc_text - The signed text to verify.
 * @param {Object} keys - The keys to use for verification.
 * @param {string} keys.pubKey - The public key to use for verification.
 * @param {string} keys.xorKey - The XOR key to use for verification.
 * @returns {{verified: boolean, data?: {uid:string, hash: string, exp: number, fn?: string, s?: number}}}
 *     An object containing the verification status and the file data if verified.
 *     The object has two properties: `verified` and `data`.
 *     The `verified` property is a boolean indicating whether the signature is verified or not.
 *     The `data` property is the file data if the signature is verified, otherwise it is undefined.
 */
function getFileDataIfVerified(enc_text, { pubKey, xorKey } = CONFIG.download_signature.SM2) {
    const data = getRawFileSignData(enc_text, { pubKey, xorKey });
    if (typeof data === "string") {
        return { verified: true, data: JSON.parse(data) }
    } else {
        return { verified: false, data: undefined }
    }
}



/**
 * Sign file data with SM2.
 *
 * @param {Object} data - The data to sign.
 * @param {string} data.uid - The user ID.
 * @param {string} data.hash - The file hash.
 * @param {number} data.exp - The expiration time.
 * @param {string} [data.fn] - The file name. If not specified, the file name will dynamically generated
 *                              according to the file in the database.
 * @param {number} [s] - If specified and is true, the data shows the file comes from sharezone.
 * @param {Object} keys - The keys to use for signing.
 * @param {string} keys.pteKey - The private key to use for signing.
 * @param {string} keys.xorKey - The XOR key to use for signing.
 * @returns {string} The signed file data.
 */
function signFileData(data, { pteKey, xorKey } = CONFIG.download_signature.SM2) {
    return genRawFileSignature(JSON.stringify(data), { pteKey, xorKey })
}

module.exports = {
    getFileDataIfVerified,
    signFileData
}