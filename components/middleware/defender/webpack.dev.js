const logger = global.logger;
const koaServerHttpProxy = require("koa-server-http-proxy");
const WEBPACK_PORT = require("../../../runtime.config.json").webpack_dev_port;

logger.debug("Passing static path ".magenta + "/v".cyan + " to webpack dev server port ".magenta + WEBPACK_PORT.toString().yellow);

module.exports = koaServerHttpProxy("/v", {
    target: "http://localhost:" + WEBPACK_PORT,
    pathRewrite: { '^/v': '' },
    changeOrigin: true
})