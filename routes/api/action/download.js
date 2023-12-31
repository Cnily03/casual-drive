const Router = require("koa-router");

const router = new Router();
const crypto = require("../../../components/utils/crypto");
const CONFIG = require("../../../runtime.config.json");
const logger = global.logger.setPrefix("API").setPrefix("DRIVE");
const { UserUtil, DriveUtil } = require("../../../components/utils/database.utilities");
const FileSignUtil = require("../../../components/utils/file-signature");
const { verifySession } = require("../../../components/utils/session");
const Res = require("../../../components/utils/response");


router.post("/api/action/dl/:zone/:requestType", async (ctx, next) => {
    const { zone, requestType } = ctx.params
    if (!["myresources", "sharezone"].includes(zone)) return next()
    if (!["link", "sign"].includes(requestType)) return next()

    const SIGN_HASH_LEN = 16, DL_HASH_MODE = "hash"

    const { uid, hash, filename, age } = ctx.request.body
    const tokenUID = ctx.session.get("uid")

    if (zone === "myresources") {
        /* myresources */
        if (zone === "myresources" && !verifySession(ctx)) return Res.UnAuthorized(ctx)

        if (typeof uid !== "string" || typeof hash !== "string") return Res.CustomThrow400(ctx, "参数格式不正确")
        if (typeof tokenUID !== "string") return Res.PermissionDenied(ctx)
        if (uid !== tokenUID) return Res.PermissionDenied(ctx)
        if (!await UserUtil.isUserExist(uid)) return Res.CustomThrow400(ctx, "UID 不存在")
        if (!await DriveUtil.isUserOwnFile(uid, hash)) return Res.CustomThrow400(ctx, "文件已删除或不存在")

    } else if (zone === "sharezone") {
        /* sharezone */
        if (typeof uid !== "string" || typeof hash !== "string") return Res.CustomThrow400(ctx, "参数格式不正确")
        if (!await UserUtil.isUserExist(uid)) return Res.CustomThrow400(ctx, "UID 不存在")
        // if it's the file owner that request the download link and the file is not shared, generate a download link anyway
        if (tokenUID !== uid && !await DriveUtil.isShareFileExist(hash, uid))
            return Res.CustomThrow400(ctx, "该文件未分享或已删除")
        if (tokenUID === uid && !await DriveUtil.isUserOwnFile(uid, hash))
            return Res.CustomThrow400(ctx, "文件已删除或不存在")

    } else {
        return ctx.status = 404
    }

    if (hash.length < SIGN_HASH_LEN) return Res.CustomThrow400(ctx, "hash 格式不正确")

    let _age = parseInt(age)
    _age = (isNaN(_age) || _age < 0 || _age > CONFIG.download_signature.maxAge) ? CONFIG.download_signature.max_age : _age

    let sign_data = {
        uid: uid,
        hash: hash.substring(0, SIGN_HASH_LEN),
        exp: Date.now() + _age
    }

    if (typeof filename === "string")
        sign_data.filename = filename.replace(/[\\\/\:\*\"\'\<\>\|\?\x00-\x1F\x7F]/gi, "_")

    if (zone === "sharezone") sign_data.s = 1

    let signature = FileSignUtil.signFileData(sign_data)

    if (requestType === "link") {
        try {
            let hash_type = DL_HASH_MODE
            let file_dl_hash
            if (hash_type === "md5_16" || hash_type === "md5_32") {
                let full_file_md5 = (await DriveUtil.getFileInfo(hash, "hash")).md5
                let short_file_md5 = full_file_md5.substring(8, 24)
                if (hash_type === "md5_16") {
                    file_dl_hash = short_file_md5
                    const IS_SHORT_MD5_CONFLICT = (await DriveUtil.getAllFileInfo(short_file_md5, "md5_16")).length > 1
                    if (IS_SHORT_MD5_CONFLICT) hash_type = "md5_32"
                }
                if (hash_type === "md5_32") {
                    file_dl_hash = full_file_md5
                    const IS_FULL_MD5_CONFLICT = (await DriveUtil.getAllFileInfo(full_file_md5, "md5_32")).length > 1
                    if (IS_FULL_MD5_CONFLICT) hash_type = "hash"
                }
            }
            if (hash_type === "hash") file_dl_hash = hash

            if (file_dl_hash.length === 32)
                file_dl_hash = file_dl_hash.substring(0, 8) + "-" + file_dl_hash.substring(8, 12) + "-" + file_dl_hash.substring(12, 16) + "-" + file_dl_hash.substring(16, 20) + "-" + file_dl_hash.substring(20, 32)

            return Res.Success(ctx, {
                data: {
                    uri: `/download/drive/${file_dl_hash}` +
                        `?sign=${signature.replace(/\+/g, "%2B")}`
                }
            })
        } catch (e) { logger.error(e); return Res.InternalError(ctx) }
    } else if (requestType === "sign") {
        return Res.Success(ctx, {
            data: {
                sign: signature
            }
        })
    } else {
        ctx.status = 404
    }
})


module.exports = router