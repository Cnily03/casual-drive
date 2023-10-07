const Koa = require('koa');
const crypto = require("../utils/crypto");

/**
 * Sign text with SM2
 * 
 * - Algorithm:
 *   ```
 *   text = raw_text + "." + random_salt
 *   signature = SM2_sign(text)
 *   signed_text = base64_encode(text) + "." + base64_encode(signature ^ xor_key)
 *   ```
 * @param {string | Buffer | ArrayBuffer} text - The text to sign.
 * @param {Object} keys - The keys to use for signing.
 * @param {string} keys.pteKey - The private key to use for signing.
 * @param {string} keys.xorKey - The XOR key to use for signing.
 * @returns {string} The signed text.
 */
function signText(text, { pteKey, xorKey }) {
    let rndsalt = crypto.rndStr(16, crypto.ALPHABET.ALL_ASCII)
        .replace(/\.|\{|\}/g, crypto.rndStr(1, crypto.ALPHABET.UN_VISIBLE));
    text = text + "." + rndsalt;
    let signature = crypto.sm2.sign(text, pteKey);
    return crypto.base64.encode(text, true) + "." + crypto.base64.encode(crypto.xor(signature, xorKey, true), true);
}

function verifySign(text, { pubKey, xorKey }) {
    try {
        let [base64_text, encrypted_sig] = text.split(".")
        const signature = crypto.xor(crypto.base64.decode(encrypted_sig, true), xorKey);
        text = crypto.base64.decode(base64_text);
        return crypto.sm2.verifySign(text, signature, pubKey);
    }
    catch (e) { return false }
}

function getData(text, { pubKey, xorKey }) {
    try {
        if (verifySign(text, { pubKey, xorKey })) {
            let base64_text = text.split(".")[0]
            with_salt = crypto.base64.decode(base64_text);
            let salt = with_salt.split(".").reverse()[0];
            return with_salt.substring(0, with_salt.length - salt.length - 1);
        } else return undefined
    } catch (e) {
        return undefined
    }
}

const isJSON = function (obj) {
    return typeof obj === "object" && Object.prototype.toString.call(obj).toLowerCase() === "[object object]" && !obj.length;
}

function copyJSON(obj) {
    if (typeof obj !== "object" || obj === null) {
        if (Array.isArray(obj)) return Array.from(obj);
        else return obj;
    }

    const copy = Array.isArray(obj) ? [] : {};

    for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            Object.defineProperty(copy, key, {
                value: copyJSON(obj[key]),
                enumerable: true,
                writable: true,
                configurable: true
            });
        }
    }

    return copy;
}

const mergeJSON = function (target, patch, deep = false) {
    if (typeof patch !== "object") return target;
    if (!target) target = {}
    if (deep) { target = copyJSON(target), patch = copyJSON(patch); }
    for (let key in patch) {
        if (key === "__proto__" || key === "constructor" || key === "prototype") continue;
        if (isJSON(patch[key]) && isJSON(target[key]))
            target[key] = mergeJSON(target[key], patch[key]);
        else {
            if (target[key] !== patch[key]) target[key] = patch[key];
        }
    }
    return target;
}

const DEFAULT_OPTIONS = {
    key: "koa:session",
    autoCommit: true,
    renew: false,
    rolling: true,
    maxAge: 12 * 60 * 60 * 1000,
    path: "/",
    httpOnly: true,
    signed: true,
    secure: false,
    overwrite: true,
    keys: {}
}

/**
 * 会话中间件
 * @param {Object} options
 * @param {string} options.key
 * @param {boolean} options.autoCommit
 * @param {boolean} options.renew
 * @param {boolean} options.rolling
 * @param {number} options.maxAge
 * @param {string} options.path
 * @param {boolean} options.httpOnly
 * @param {boolean} options.signed
 * @param {boolean} options.secure
 * @param {Object} options.keys
 * @param {string} options.keys.pubKey
 * @param {string} options.keys.pteKey
 * @param {string} options.keys.xorKey
 * @param {Koa} app
 * 
 * @returns {(ctx: Koa.Context, next: Koa.Next)=>any}
 */
const Session = (options, app) => {
    let opts = mergeJSON({}, DEFAULT_OPTIONS);
    opts = mergeJSON(opts, options);

    if (opts.signed && !(
        typeof opts.keys.pubKey === "string" &&
        typeof opts.keys.pteKey === "string" &&
        typeof opts.keys.xorKey === "string"
    )) throw new Error("key in opts.keys must be string");

    const DefaultCookieOpts = {
        maxAge: opts.maxAge,
        path: opts.path,
        secure: opts.secure,
        httpOnly: opts.httpOnly,
        overwrite: opts.overwrite
    }

    return async (ctx, next) => {
        ctx.session = ctx.session || {};
        ctx.session.config = opts;
        ctx.session.data = ctx.session.data || {};
        let patch_cookie_opts = {};
        let hasCommited = false, hasChanged = false;

        const cookie_content = ctx.cookies.get(opts.key);
        let session_data = opts.signed ? getData(cookie_content, opts.keys) : cookie_content;
        let session_json = JSON.parse(session_data || "{}");
        ctx.session.data = mergeJSON(ctx.session.data, session_json);

        ctx.session.commit = () => {
            if (hasCommited || ctx.headerSent) return
            hasCommited = true;
            if (!ctx.session.data || (!session_data && !Object.keys(ctx.session.data).length)) {
                ctx.cookies.set(opts.key, "", { maxAge: 0 });
            } else {
                let session_data = JSON.stringify(ctx.session.data);
                if (opts.signed) session_data = signText(session_data, opts.keys);

                let cookie_set_opts = mergeJSON(DefaultCookieOpts, patch_cookie_opts, true);

                if (!hasChanged && !opts.rolling && !opts.renew) { return }

                if (Object.keys(patch_cookie_opts).includes("expires") &&
                    !Object.keys(patch_cookie_opts).includes("maxAge"))
                    delete cookie_set_opts["maxAge"]

                if (Array.isArray(patch_cookie_opts.delete)) patch_cookie_opts.delete.forEach(key => delete cookie_set_opts[key])
                delete cookie_set_opts["delete"]

                ctx.cookies.set(opts.key, session_data, cookie_set_opts);
            }
        }
        ctx.session.get = (key) => {
            return ctx.session.data[key];
        }
        ctx.session.set = (key, value) => {
            hasChanged = true;
            if (isJSON(key)) {
                // set(obj, opts)
                ctx.session.data = mergeJSON(ctx.session.data, key);
                patch_cookie_opts = mergeJSON(patch_cookie_opts, value);
            } else {
                ctx.session.data[key] = value;
            }
        }
        ctx.session.destroy = () => {
            hasChanged = true;
            ctx.session.data = null;
        }

        try {
            await next();
        } catch (e) {
            (app.logger || console).error(e);
            // throw e;
        } finally {
            if (opts.autoCommit) ctx.session.commit();
        }
    }
}

module.exports = Session;