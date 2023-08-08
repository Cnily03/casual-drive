require('./reconfigure').reconfigure()

require('colors');
const logger = require("./logger").defaultLogger();

const env = global.env = (process.env.NODE_ENV || "production").trim();
const isEnvDev = global.isEnvDev = env === "development";
const devOnly = (fn) => isEnvDev ? fn : undefined

const path = require("path");
const Koa = require("koa");
const Session = require("./components/middleware/session")
const bodyParser = require('koa-bodyparser');
const Views = require("koa-views");
const CONFIG = require("./runtime.config.json");

const app = new Koa();
// logger
app.logger = global.logger = logger;
module.exports = app;


// session
app.use(Session({
    key: 'token',
    autoCommit: true,
    renew: false,
    rolling: false,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    overwrite: true,
    httpOnly: true,
    signed: true,
    secure: false,
    keys: CONFIG.session.SM2
}, app))

// body parser
app.use(bodyParser({
    onerror: function (err, ctx) {
        // If the json is invalid, the body will be set to {}. That means, the request json would be seen as empty.
        if (err.status === 400 && err.name === 'SyntaxError' && ctx.request.type === 'application/json') {
            ctx.request.body = {}
        } else {
            throw err;
        }
    }
}));

// views
app.use(Views(path.join(__dirname, isEnvDev ? "./views" : "./views.prod"), {
    extension: 'ejs'
}));

// static
app.use(require('koa-static')(path.join(__dirname, './static')));

// defender
[
    devOnly("webpack.dev"),
    "logger"
].filter(t => !!t).forEach(p => { p = require("./components/middleware/defender/" + p); app.use(p) });

// routes
[
    "index",
    "sharezone",
    "myresources",
    "account/signin",
    "account/signup",
    "api/account",
    "api/info/drive",
    "api/action/drive",
    "api/action/download",
    "download",
    "_fallback"
].forEach(p => { p = require("./routes/" + p); app.use(p.routes()).use(p.allowedMethods()) });

const PORT = isEnvDev ? CONFIG.koa_dev_port : CONFIG.koa_port;
app.listen(PORT, () => {
    logger.info(`Server is running at port ${PORT}...`.green);
})

module.exports = app;