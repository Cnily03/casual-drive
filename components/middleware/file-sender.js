const Koa = require('koa');
const fs = require('fs');
const path = require('path');
const util = require('util');
const resolvePath = require('resolve-path');

async function stat(fp) {
    let statfunc = util.promisify(fs.stat);
    let readfunc = util.promisify(fs.readFile);
    let st = await statfunc(fp)
    st.size = st.size > 0 ? st.size : (await readfunc(fp)).byteLength
    return st
}

const exists = util.promisify(fs.exists)

/**
 * 文件发送中间件
 * @param {Koa.Context} ctx
 * @param {Koa.Next} next
 */
const FileSender = async (ctx, next) => {
    ctx.sendFile = async (filepath, options) => {
        options = options || {};
        let abs_path
        if (typeof options.root !== "string") {
            abs_path = path.resolve("", filepath)
        } else {
            let root = options.root === '' ? process.cwd() : options.root
            abs_path = resolvePath(root, filepath)
        }

        if (!await exists(abs_path)) {
            throw new Error("File not found: " + abs_path)
        }
        let stats = await stat(abs_path)
        if (stats.isDirectory()) {
            throw new Error("File is a directory: " + abs_path)
        }
        ctx.set("Content-Type", "application/octet-stream")
        if (!ctx.response.header["content-disposition"]) {
            ctx.set("Content-Disposition", `attachment; filename="${path.basename(abs_path)}"`)
        }
        ctx.set("Content-Length", stats.size)
        ctx.body = fs.createReadStream(abs_path)
    }
    await next();
}

module.exports = FileSender;