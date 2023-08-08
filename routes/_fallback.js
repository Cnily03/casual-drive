const Router = require("koa-router");
const router = new Router();

router.get(/^/, async (ctx, next) => {
    ctx.redirect("/")
    ctx.status = 301
})

module.exports = router;