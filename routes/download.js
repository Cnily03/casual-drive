const Router = require("koa-router");
const router = new Router();
const CONFIG = require("../runtime.config.json");
const Res = require("../components/utils/response");
const FileSignUtil = require("../components/utils/file-signature");
const { DriveUtil } = require("../components/utils/database.utilities");
const fs = require("fs");
const path = require("path");
const { verifySession } = require("../components/utils/session");
const logger = global.logger;

router.get("/download/drive/:hash", async (ctx, next) => {
    let dl_hash = typeof ctx.params.hash === "string" ? ctx.params.hash.replace(/\-/g, "") : undefined;
    const signaure = ctx.query.sign;

    if (typeof dl_hash !== "string" || typeof signaure !== "string" || (dl_hash.length !== 16 && dl_hash.length !== 32 && dl_hash.length !== 64)) {
        // invalid params or query
        ctx.set("X-Error-Reason", "Invalid Params");
        ctx.status = 400; // Bad Request
        return ctx.res.end();
    }

    let _data = FileSignUtil.getFileDataIfVerified(signaure);
    if (!_data.verified) { // not verified
        ctx.set("X-Error-Reason", "Invalid Signature");
        ctx.status = 403; // Permission Denied
        return ctx.res.end();
    }

    const data = _data.data
    if (data.exp < Date.now()) { // expired
        ctx.set("X-Error-Reason", "Signature Expired");
        ctx.status = 403; // Permission Denied
        return ctx.res.end();
    }

    let IS_FILE_EXIST_IN_GLOBAL, full_hash_lists
    try {
        full_hash_lists = (await DriveUtil.getAllFileInfo(dl_hash, "auto")).map(v => v.hash)
        IS_FILE_EXIST_IN_GLOBAL = full_hash_lists.length > 0
    } catch (e) {
        ctx.set("X-Error-Reason", "Internal Server Error");
        ctx.status = 500;// Internal Server Error
        return ctx.res.end();
    }

    if (!IS_FILE_EXIST_IN_GLOBAL) {
        ctx.set("X-Error-Reason", "File Not Found");
        ctx.status = 404; // Not Found
        return ctx.res.end();
    }

    if (full_hash_lists.length > 1) {
        ctx.set("X-Error-Reason", "Multiple Files Found");
        ctx.status = 403; // Forbidden
        return ctx.res.end();
    }

    const hash = full_hash_lists[0]

    if (data.hash.length > hash || hash.substring(0, data.hash.length) !== data.hash) { // hash not match
        ctx.set("X-Error-Reason", "Signature does not match");
        ctx.status = 403; // Permission Denied
        return ctx.res.end();
    }


    let IS_FILE_EXIST;
    const uid = data.uid;
    try {
        // if it's the file owner that visit the sharezone link, use `user_file_list` check
        if (!!data.s && ctx.session.get("uid") !== uid)
            IS_FILE_EXIST = await DriveUtil.isShareFileExist(hash, uid)
        else
            IS_FILE_EXIST = await DriveUtil.isUserOwnFile(uid, hash)
    } catch (e) {
        ctx.set("X-Error-Reason", "Internal Server Error");
        ctx.status = 500;// Internal Server Error
        return ctx.res.end();
    }

    if (!IS_FILE_EXIST) {
        ctx.set("X-Error-Reason", "File Not Found");
        ctx.status = 404; // Not Found
        return ctx.res.end();
    }


    let IS_FILE_EXIST_IN_STORAGE;
    try {
        IS_FILE_EXIST_IN_STORAGE = fs.existsSync(path.resolve(CONFIG.storage_path, hash))
    } catch (e) {
        ctx.set("X-Error-Reason", "Internal Server Error");
        ctx.status = 500;// Internal Server Error
        return ctx.res.end();
    }
    if (!IS_FILE_EXIST_IN_STORAGE) {
        logger.error(`File ${hash.yellow} not found in storage, but exist in database!`)
        ctx.set("X-Error-Reason", "Internal Server Error");
        ctx.status = 500;// Internal Server Error
        return ctx.res.end();
    }

    let filename = typeof data.fn === "string" ? data.fn : (await DriveUtil.getFilename(uid, hash));
    filename = filename.replace(/[\\\/\:\*\"\'\<\>\|\?\x00-\x1F\x7F]/gi, "_")

    ctx.set("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);
    // ctx.body = fs.createReadStream(path.resolve(CONFIG.storage_path, hash))
    await ctx.sendFile(path.resolve(CONFIG.storage_path, hash))
})

module.exports = router;