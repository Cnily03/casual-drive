const Router = require("koa-router");
const router = new Router();
const crypto = require("../../../components/utils/crypto");
const CONFIG = require("../../../runtime.config.json");
const logger = require("../../../app").logger.setPrefix("API").setPrefix("DRIVE");
const { UserUtil, DriveUtil } = require("../../../components/utils/database.utilities");
const { verifySession } = require("../../../components/utils/session");
const Res = require("../../../components/utils/response");

router.post("/api/info/drive/user", async (ctx, next) => {
    if (!verifySession(ctx)) Res.UnAuthorized(ctx)
    const { uid } = ctx.request.body
    const tokenUID = ctx.session.get("uid")

    if (typeof uid !== "string") return Res.CustomThrow400(ctx, "UID 格式不正确")
    if (typeof tokenUID !== "string") return Res.PermissionDenied(ctx)
    if (uid !== tokenUID) return Res.PermissionDenied(ctx)
    if (!await UserUtil.isUserExist(uid)) return Res.CustomThrow400(ctx, "UID 不存在")

    const data = await DriveUtil.getUserFileList(uid)

    async function size(data_piece) {
        if (typeof data_piece.hash !== "string") return false
        let _size = await DriveUtil.getFileSize(data_piece.hash) / 8
        if (typeof _size !== "number") return false
        return _size
    }

    let formatedData = []

    for (let d of data) {
        let _size = await size(d)
        if (typeof _size !== "number") return Res.InternalError(ctx)
        formatedData.push({
            name: d.filename,
            hash: d.hash,
            size: _size,
            uploadTime: d.upload_time,
            shared: !!d.shared
        })
    }

    return Res.Success(ctx, {
        data: formatedData
    })
})

router.post("/api/info/drive/sharezone", async (ctx, next) => {

    const data = await DriveUtil.getShareZoneFileList()

    async function filename(data_piece) {
        if (typeof data_piece.hash !== "string") return false
        let _filename = await DriveUtil.getFilename(data_piece.uploader_uid, data_piece.hash)
        if (typeof _filename !== "string") return false
        return _filename
    }

    async function uploader(data_piece) {
        if (typeof data_piece.uploader_uid !== "string") return false
        let _uploader = (await UserUtil.getUserInfo(data_piece.uploader_uid)).username
        if (typeof _uploader !== "string") return false
        return _uploader
    }

    async function size(data_piece) {
        if (typeof data_piece.hash !== "string") return false
        let _size = await DriveUtil.getFileSize(data_piece.hash) / 8
        if (typeof _size !== "number") return false
        return _size
    }

    let reqeustorUID = ctx.session.get("uid")
    let formatedData = []

    for (let d of data) {
        let _filename, _uploader, _size, _isOwn, _ownFn;
        await Promise.all([
            filename(d).then(res => _filename = res),
            uploader(d).then(res => _uploader = res),
            size(d).then(res => _size = res)
        ])

        if (typeof _filename !== "string") return Res.InternalError(ctx)
        if (typeof _uploader !== "string") return Res.InternalError(ctx)
        if (typeof _size !== "number") return Res.InternalError(ctx)
        _isOwn = reqeustorUID ? (
            reqeustorUID === d.uploader_uid ? true : await DriveUtil.isUserOwnFile(reqeustorUID, d.hash)
        ) : false
        if (_isOwn) _ownFn = await DriveUtil.getFilename(reqeustorUID, d.hash)

        formatedData.push({
            name: _filename,
            hash: d.hash,
            size: _size,
            uploader: _uploader,
            uploader_uid: d.uploader_uid, // getting download link requires uploader_uid
            shareTime: d.share_time,
            isYours: reqeustorUID ? reqeustorUID === d.uploader_uid : false,
            isOwn: _isOwn,
            ownFn: _ownFn
        })
    }

    return Res.Success(ctx, {
        logged: !!reqeustorUID,
        data: formatedData
    })
})

module.exports = router