const { RequestDefender, ResponseDefender } = require("../defender");
const logger = global.logger;

module.exports = ResponseDefender(async (ctx, next) => {
    const method = ctx.request.method.toUpperCase();
    const urlpath = ctx.request.path;
    const contentType = ctx.response.get("Content-Type");
    let _ip = ctx.request.socket.remoteAddress;

    if (_ip === "::1") {
        _ip = "localhost"
    } else {
        _ip = _ip.replace(/^::ffff:/, "");
        if (_ip === "::" || _ip === "") _ip = "localhost"
        if (!/^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$/.test(_ip)) {
            _ip = `[${_ip}]`
        }
    }
    const ip = _ip + (ctx.request.socket.remotePort ? (":" + ctx.request.socket.remotePort) : "");

    const query = method === "GET" ? ctx.request.querystring : ctx.request.rawBody;
    const colorQuery = (_query) => {
        return (_query.length > 256) ?
            `[${Buffer.from(_query).byteLength} Bytes]`.blue :
            _query.yellow
    }

    const status = ctx.response.status;
    if (![
        "application/javascript",
        "text/css",
    ].some(e => (typeof e === "string" ? RegExp(`^${e}$`) : e).test(contentType)))
        logger.info([
            `${method.cyan.bold} ${String(status).yellow} ${urlpath.green}`,
            `FROM ${ip.magenta}`,
            (query ? `${method === "GET" ? "QUREY" : "BODY"} ${colorQuery(query)}` : undefined)
        ].filter(s => typeof s === "string").join(" - "));
})