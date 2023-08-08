const Koa = require("koa");
const Router = require("koa-router");

/**
 * @param {Koa.Context} ctx
 * @param {number} status
 * @param {any} body
 */
function Return(ctx, status, body) {
    ctx.status = status
    ctx.body = body
    return ctx.body
}

/**
 * @param {Koa.Context} ctx
 * @param {string | {[k:string]:any}} msgOrAppendix
 * @returns {{code: 0, msg: string}} ctx.body
 */
function Success(ctx, msgOrAppendix = {}) {
    ctx.status = 200
    if (typeof msgOrAppendix === "string") msgOrAppendix = { msg: msgOrAppendix }
    return ctx.body = {
        code: 0,
        msg: "success",
        ...msgOrAppendix
    }
}

/**
 * @param {Koa.Context} ctx
 * @param {string | {[k:string]:any}} msgOrAppendix
 * @returns {{code: -1, msg: string}} ctx.body
 */
function UnAuthorized(ctx, msgOrAppendix = {}) {
    ctx.status = 401
    if (typeof msgOrAppendix === "string") msgOrAppendix = { msg: msgOrAppendix }
    return ctx.body = {
        code: -1,
        msg: "未登录",
        ...msgOrAppendix
    }
}


/**
 * @param {Koa.Context} ctx
 * @param {string | {[k:string]:any}} msgOrAppendix
 * @returns {{code: -2, msg: string}} ctx.body
 */
function CustomThrow200(ctx, msgOrAppendix = {}) {
    ctx.status = 200;
    if (typeof msgOrAppendix === "string") msgOrAppendix = { msg: msgOrAppendix }
    return ctx.body = {
        code: -2,
        ...msgOrAppendix
    }
}

/**
 * @param {Koa.Context} ctx
 * @param {string | {[k:string]:any}} msgOrAppendix
 * @returns {{code: -2, msg: string}} ctx.body
 */
function CustomThrow400(ctx, msgOrAppendix = {}) {
    ctx.status = 400;
    if (typeof msgOrAppendix === "string") msgOrAppendix = { msg: msgOrAppendix }
    return ctx.body = {
        code: -2,
        ...msgOrAppendix
    }
}


/**
 * @param {Koa.Context} ctx
 * @param {string | {[k:string]:any}} msgOrAppendix
 * @returns {{code: -3, msg: string}} ctx.body
 */
function UnkownRequest(ctx, msgOrAppendix = {}) {
    ctx.status = 406
    if (typeof msgOrAppendix === "string") msgOrAppendix = { msg: msgOrAppendix }
    return ctx.body = {
        code: -3,
        msg: "未知请求",
        ...msgOrAppendix
    }
}


/**
 * @param {Koa.Context} ctx
 * @param {string | {[k:string]:any}} msgOrAppendix
 * @returns {{code: -4, msg: string}} ctx.body
 */
function PermissionDenied(ctx, msgOrAppendix = {}) {
    ctx.status = 403
    if (typeof msgOrAppendix === "string") msgOrAppendix = { msg: msgOrAppendix }
    return ctx.body = {
        code: -4,
        msg: "Permission denied",
        ...msgOrAppendix
    }
}

/**
 * @param {Koa.Context} ctx
 * @param {string | {[k:string]:any}} msgOrAppendix
 * @returns {{code: -4, msg: string}} ctx.body
 */
function Forbidden(ctx, msgOrAppendix = {}) {
    ctx.status = 403
    if (typeof msgOrAppendix === "string") msgOrAppendix = { msg: msgOrAppendix }
    return ctx.body = {
        code: -4,
        msg: "Forbidden",
        ...msgOrAppendix
    }
}


/**
 * @param {Koa.Context} ctx
 * @param {string | {[k:string]:any}} msgOrAppendix
 * @returns {{code: -5, msg: string}} ctx.body
 */
function InternalError(ctx, msgOrAppendix = {}) {
    ctx.status = 500
    if (typeof msgOrAppendix === "string") msgOrAppendix = { msg: msgOrAppendix }
    return ctx.body = {
        code: -5,
        msg: "Internal Server Error",
        ...msgOrAppendix
    }
}

/**
 * @param {Koa.Context} ctx
 * @param {string | {[k:string]:any}} msgOrAppendix
 * @returns {{code: -6, msg: string}} ctx.body
 */
function MethodNotAllowed(ctx, msgOrAppendix = {}) {
    ctx.status = 405
    if (typeof msgOrAppendix === "string") msgOrAppendix = { msg: msgOrAppendix }
    return ctx.body = {
        code: -6,
        msg: "Method Not Allowed",
        ...msgOrAppendix
    }
}

/**
 * @param {Koa.Context} ctx
 * @param {string | {[k:string]:any}} msgOrAppendix
 * @returns {{code: -7, msg: string}} ctx.body
 */
function BadRequest(ctx, msgOrAppendix = {}) {
    ctx.status = 500
    if (typeof msgOrAppendix === "string") msgOrAppendix = { msg: msgOrAppendix }
    return ctx.body = {
        code: -7,
        msg: "Bad Request",
        ...msgOrAppendix
    }
}

/**
 * @param {Koa.Context} ctx
 * @param {string | {[k:string]:any}} msgOrAppendix
 * @returns {{code: -8, msg: string}} ctx.body
 */
function NotFound(ctx, msgOrAppendix = {}) {
    ctx.status = 404
    if (typeof msgOrAppendix === "string") msgOrAppendix = { msg: msgOrAppendix }
    return ctx.body = {
        code: -8,
        msg: "Not Found",
        ...msgOrAppendix
    }
}


/**
 * @param {Koa.Context} ctx
 * @param {string | {[k:string]:any}} msgOrAppendix
 * @returns {{code: -9, msg: string}} ctx.body
 */
function TooManyRequests(ctx, msgOrAppendix = {}) {
    ctx.status = 429
    if (typeof msgOrAppendix === "string") msgOrAppendix = { msg: msgOrAppendix }
    return ctx.body = {
        code: -9,
        msg: "Too Many Requests",
        ...msgOrAppendix
    }
}

module.exports = {
    Return, Success, UnAuthorized, CustomThrow200, CustomThrow400, UnkownRequest, PermissionDenied, Forbidden, InternalError, MethodNotAllowed, BadRequest, NotFound, TooManyRequests
}