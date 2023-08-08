const Router = require("koa-router");
const { verifySession } = require("../components/utils/session");
const router = new Router();
const CONFIG = require("../runtime.config.json");

router.get("/sharezone", async (ctx, next) => {
    let logged = verifySession(ctx)

    await ctx.render("sharezone", {
        cur_title: "公共资源区",
        global_title: CONFIG.frontend.title,
        logged: logged,
        cur_nav_path: "/sharezone",
        data: logged ? {
            username: ctx.session.get("username"),
        } : {}
    })
})

module.exports = router;