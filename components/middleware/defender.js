const Koa = require("koa");

/**
 * 请求拦截器
 * @param {(ctx: Koa.Context, next: Koa.Next)=>any} func 
 * @returns {(ctx: Koa.Context, next: Koa.Next)=>any}
 */
function RequestDefender(func) {
    return async (ctx, next) => {
        await func(ctx, next);
        await next();
    }
}

/**
 * 响应拦截器
 * @param {(ctx: Koa.Context, next: Koa.Next)=>any} func 
 * @returns {(ctx: Koa.Context, next: Koa.Next)=>any}
 */
function ResponseDefender(func) {
    return async (ctx, next) => {
        await next();
        await func(ctx, next);
    }
}

module.exports = { RequestDefender, ResponseDefender }