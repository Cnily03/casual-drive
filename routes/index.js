const Router = require("koa-router");
const { verifySession } = require("../components/utils/session");
const router = new Router();
const CONFIG = require("../runtime.config.json");

router.get("/", async (ctx, next) => {
    let logged = verifySession(ctx)

    if (logged) return ctx.redirect("/myresources")
    else {
        await ctx.render("sharezone", {
            cur_title: "首页",
            global_title: CONFIG.frontend.title,
            logged: false,
            cur_nav_path: "/sharezone",
            data: {}
        })
    }
})

module.exports = router;