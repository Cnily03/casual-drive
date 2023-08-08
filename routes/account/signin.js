const Router = require("koa-router");
const router = new Router();
const { verifySession, generateToken } = require("../../components/utils/session");
const CONFIG = require("../../runtime.config.json");
const crypto = require("../../components/utils/crypto");

router.get("/account/signin", async (ctx, next) => {
    if (verifySession(ctx)) ctx.redirect("/"), ctx.status = 302;
    else await ctx.render("account/signin", {
        cur_title: "登录",
        global_title: CONFIG.frontend.title,
        waf: crypto.base64.encode(JSON.stringify({
            reg: {
                username: CONFIG.backend.username_reg,
                password: CONFIG.backend.password_reg
            },
            waitTime: Math.ceil(CONFIG.backend.sign_in_wait_sec),
        }))
    });
});

module.exports = router;