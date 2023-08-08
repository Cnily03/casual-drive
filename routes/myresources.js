const Router = require("koa-router");
const { verifySession } = require("../components/utils/session");
const router = new Router();
const crypto = require("../components/utils/crypto");
const CONFIG = require("../runtime.config.json");

router.get("/myresources", async (ctx, next) => {
    let logged = verifySession(ctx);

    if (!logged) return ctx.redirect("/")

    await ctx.render("myresources", {
        cur_title: "我的资源",
        global_title: CONFIG.frontend.title,
        logged: logged,
        cur_nav_path: "/myresources",
        data: logged ? {
            username: ctx.session.get("username")
        } : {},
        waf: {
            waf_info: crypto.base64.encode(JSON.stringify({
                fn_maxlen: CONFIG.backend.file_upload_max_name_length,
                file_maxsize: CONFIG.backend.file_upload_max_size
            }))
        }
    })
})

module.exports = router;