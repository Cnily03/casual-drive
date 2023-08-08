const Koa = require("koa");
const Router = require("koa-router");

const crypto = require("./crypto");
const CONFIG = require("../../runtime.config.json");

/**
 * @param {Koa.Context} ctx 
 */
const verifySession = (ctx, clearSession = true, updateTokenMs = CONFIG.cookie.token_auto_update_delay) => {
    try {
        if (ctx.session.get("token") && ctx.session.get("username")) {
            const { aes_key, aes_iv } = CONFIG.session.token
            const splited = crypto.aes.decode(ctx.session.get("token"), aes_key, aes_iv, "aes-128-cbc").split(" | ");
            if (ctx.session.get("username") === splited[0] && /^[0-9]+$/.test(splited[1])) {
                if (parseInt(splited[1]) + updateTokenMs < Date.now())
                    ctx.session.set("token", generateToken(ctx.session.get("username")))
                return true
            }
        }
    } catch (e) {}
    // destory session
    if (clearSession) ctx.session.destroy()
    return false
}

/**
 * token = AES(username + " | " + timestamp)
 */
const generateToken = (username) => {
    const { aes_key, aes_iv } = CONFIG.session.token
    const timestamp = Date.now()
    const token = crypto.aes.encode([username, timestamp].join(" | "), aes_key, aes_iv, "aes-128-cbc")
    return token
}

module.exports = { verifySession, generateToken }