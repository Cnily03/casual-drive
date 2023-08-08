const Router = require("koa-router");
const router = new Router();
const database = require("../../components/utils/database");
const crypto = require("../../components/utils/crypto");
const { generateToken } = require("../../components/utils/session");
const CONFIG = require("../../runtime.config.json");
const logger = require("../../app").logger.setPrefix("ACCOUNT");
const { UserUtil, LogEventUtil } = require("../../components/utils/database.utilities");
const Res = require("../../components/utils/response");

const SALT = CONFIG.db.salt.user_password;
// const SIGN_IN_MAX_TRY = CONFIG.backend.sign_in_max_try;
// const SIGN_IN_WAIT_TIME = CONFIG.backend.sign_in_wait_sec * 1000;

/**
 * Returns the hashed password with the salt used in the database.
 * 
 * - Algorithm:
 *   ```
 *   db_password = sha1(md5(raw_password) + "." + salt)
 *   ```
 * @param {string} passwd_md5 - The MD5 hash of the password.
 * @returns {string} The hashed password with the salt used in the database.
 */
function getPasswdInDB(passwd_md5) {
    return crypto.sha1(passwd_md5 + "." + SALT);
}

router.post("/api/account/signin", async (ctx, next) => {
    if (ctx.request.body["type"] === "auth") {
        const { username, password } = ctx.request.body;
        const rememberme = !(typeof ctx.request.body["rememberme"] === "undefined" || /^0+$/.test(ctx.request.body["rememberme"]))
        const UN_RULE = RegExp(...CONFIG.backend.username_reg);
        const MD5_RULE = /^[0-9a-z]{32}$/;

        /**
         *  0: 登录成功
         * -1: 用户名或密码错误
         * -2: Warning - Basic Pass failed
         * -3: 尝试次数过多，请稍后再试
         * -4: 未知请求
         * -5: Internal Error
         */
        let code = -2, msg = "";

        if (!await LogEventUtil.verifyIPSignInHistory(ctx.ip, username))
            return Res.TooManyRequests(ctx, `尝试次数过多，请 ${Math.ceil(CONFIG.backend.sign_in_wait_sec / 60)} 分钟后再试`)
        else if (!username || !password) return Res.CustomThrow400(ctx, "请输入用户名或密码");
        else if (!UN_RULE.test(username)) return Res.CustomThrow400(ctx, "用户名不合法");
        else if (!MD5_RULE.test(password)) return Res.Return(ctx, 418, { code: 418, msg: "I'm a teapot" }); // egg
        else {
            const uid = await UserUtil.getUserUidByUnPwd(username, getPasswdInDB(password))
            if (uid) {
                code = 0, msg = "登录成功";
                ctx.session.set({ username: username, uid: uid, token: generateToken(username) }, {
                    delete: rememberme ? [] : ["maxAge", "expires"]
                });
                ctx.cookies.set("uid", uid, {
                    httpOnly: false,
                    maxAge: rememberme ? ctx.session.config.maxAge : undefined
                })
                await LogEventUtil.clearIPSignInHistory(ctx.ip);
                logger.info(`[+] Sign in: ${("UID " + uid).cyan} who is ${username.cyan}`);
            } else {
                return Res.CustomThrow400(ctx, "用户名或密码错误");
            }
        }

        ctx.body = { code, msg }
    } else return Res.UnkownRequest(ctx)
});

router.post("/api/account/signup", async (ctx, next) => {
    const { username, password } = ctx.request.body;
    const UN_RULE = RegExp(...CONFIG.backend.username_reg);
    const MD5_RULE = /^[0-9a-z]{32}$/;

    /**
     * 0: 注册成功
     * -1: 用户名已存在
     * -2: Warning - Basic Pass failed
     * -3: Too many requests
     * -4: 未知请求
     * -5: Internal Error
     */
    let code = -2, msg = "";

    if (!username || !password) return Res.CustomThrow400(ctx, "请输入用户名或密码");
    else if (!UN_RULE.test(username)) return Res.CustomThrow400(ctx, "用户名不合法");
    else if (!MD5_RULE.test(password)) return Res.Return(ctx, 418, { code: 418, msg: "I'm a teapot" }); // egg
    else if (await UserUtil.isUsernameExist(username)) code = -2, msg = "用户名已存在";
    else {
        let uid = await UserUtil.insertUser(username, getPasswdInDB(password));
        code = 0, msg = "注册成功";
        logger.info(`Add new account: ${("UID " + uid).cyan} named ${username.cyan}`);
    }

    ctx.body = { code, msg }

})

router.post("/api/account/logout", async (ctx, next) => {
    if (ctx.session.get("token")) {
        logger.info(`[-] Log out: ${("UID " + ctx.session.get("uid")).cyan} who is ${ctx.session.get("username").cyan}`);
        ctx.session.destroy();
        ctx.cookies.set("uid", "", { maxAge: 0 });
        return Res.Success(ctx, {
            redirect: ctx.request.body["redirect"] || ctx.origin + "/account/signin"
        })
    } else return Res.UnAuthorized(ctx, {
        redirect: ctx.request.body["redirect"] || ctx.origin + "/account/signin"
    })
})

module.exports = router;