const Koa = require('koa');
const Path = require('path');
const send = require('koa-send');

/**
 * 文件发送中间件
 * @param {Koa.Context} ctx
 * @param {Koa.Next} next
 */
const FileSender = async (ctx, next) => {
    ctx.sendFile = async (path, options) => {
        if (path.startsWith(Path.resolve("/"))) {
            options = options || {};
            options.root = Path.resolve("/");
        }
        await send(ctx, path, options);
    }
    await next();
}

module.exports = FileSender;