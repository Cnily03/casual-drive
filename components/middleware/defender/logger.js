const { RequestDefender, ResponseDefender } = require("../defender");
const logger = require("../../../app").logger;

module.exports = ResponseDefender(async (ctx, next) => {
    const method = ctx.request.method.toUpperCase();
    const urlpath = ctx.request.path;
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
    const status = ctx.response.status;
    if (![
        /\.(js|css|png|jpeg)$/,
        /\.[^\.]{1,4}$/
    ].map(e => (typeof e === "string" ? RegExp(`^${e}$`) : e).test(urlpath)).includes(true))
        logger.info(
            `${method.cyan.bold} ${String(status).yellow} ${urlpath.green} - FROM ${ip.magenta}` + (query ? ` - ${method === "GET" ? "QUREY" : "BODY"} ${query.yellow}` : '')
        );
})