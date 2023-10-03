const Router = require("koa-router");

const router = new Router();
const Busboy = require("busboy");
const path = require("path");
const fs = require("fs");
const Crypto = require("crypto");
const crypto = require("../../../components/utils/crypto");
const CONFIG = require("../../../runtime.config.json");
const logger = global.logger.setPrefix("API").setPrefix("DRIVE");
const { UserUtil, DriveUtil } = require("../../../components/utils/database.utilities");
const FileSignUtil = require("../../../components/utils/file-signature");
const { verifySession } = require("../../../components/utils/session");
const Res = require("../../../components/utils/response");

const FILE_WAF = { // return is_invalid
    filename(filename) {
        return /[\\\/\:\*\"\'\<\>\|\?\x00-\x1F\x7F]/gi.test(filename) ||
            filename.length > CONFIG.backend.file_upload_max_name_length || filename.length === 0
    },
    filesize(filesize) {
        return parseFloat(filesize) > CONFIG.backend.file_upload_max_size
    }
}

async function getUnrepeatedFilename(uid, filename) {
    let fn = filename.trim()
    while (await DriveUtil.getUserFileInfo(uid, "filename", fn) !== null) {
        let dotPos = fn.lastIndexOf(".")
        let _name_part, _ext_part
        if (dotPos !== -1) {
            _name_part = fn.substring(0, dotPos).trim()
            _ext_part = fn.substring(dotPos).trim()
        } else {
            _name_part = fn.trim()
            _ext_part = ""
        }
        if (/\(\d+\)$/.test(_name_part)) {
            let leftQuotePos = _name_part.lastIndexOf("(")
            let num = parseInt(_name_part.substring(leftQuotePos + 1, _name_part.length - 1))
            _name_part = _name_part.substring(0, leftQuotePos + 1) + (num + 1) + ")"
        } else {
            _name_part += " (1)"
        }
        fn = _name_part + _ext_part
    }
    return fn
}

function trimFn(fn) {
    if (typeof fn !== "string") return fn
    fn = fn.trim()
    let dotPos = fn.lastIndexOf(".")
    if (dotPos !== -1) {
        let _name_part = fn.substring(0, dotPos).trim()
        let _ext_part = fn.substring(dotPos).trim()
        return _name_part + _ext_part
    }
    return fn
}

function calcBodyLength(str, encoding) {
    let asciiCount = 0;
    for (let i = 0; i < str.length; i++) { if (str[i].charCodeAt(0) < 128) asciiCount++ }
    return Buffer.from(str, 'utf-8').length
}


/**
 * @param {import('koa').Context} ctx 
 */
function getSizeFromHeaders(ctx, encoding, name, filename, mimeType) {
    const contentLength = ctx.req.headers["content-length"];
    try {
        const boundary = ctx.req.headers["content-type"].split(";")[1].split("=")[1]
        let WebKitFormBoundary = `${boundary}`;
        let EndWebKitFormBoundary = `${boundary}--`;
        let ContentDisposition = `Content-Disposition: form-data; name="${name}"; filename="${filename}"`;
        let ContentType = `Content-Type: ${mimeType}`;
        let body = `${WebKitFormBoundary}\r\n${ContentDisposition}\r\n${ContentType}\r\n\r\n{{file}}\r\n${EndWebKitFormBoundary}\r\n`
            .replace(/\{\{file\}\}/g, "")
        const adjust_size = 4
        const size = calcBodyLength(body, encoding) + adjust_size;
        return Math.ceil(contentLength - size);
    }
    catch (e) {
        return ctx.req.headers["content-length"];
    }
}


router.post("/api/action/drive/upload/check", async (ctx, next) => {
    if (!verifySession(ctx)) return Res.UnAuthorized(ctx)

    const { hash } = ctx.request.body;
    const fn = trimFn(ctx.request.body["fn"]);
    // autoup: if the file hash matches, the file will be automatically uploaded
    const autoup = !(typeof ctx.request.body["autoup"] === "undefined" || /^0+$/.test(ctx.request.body["autoup"]))

    if (typeof hash !== "string") return Res.CustomThrow400(ctx, "参数错误")
    if (FILE_WAF.filename(fn)) return Res.CustomThrow400(ctx, "文件名不合法")

    const FileInfo = await DriveUtil.getFileInfo(hash, "hash");
    const IS_FILE_EXIST = FileInfo !== null;
    let autoupRes = {
        uploaded: false,
        msg: "Unexpected Resquest" // Hacker
    }

    if (IS_FILE_EXIST) {
        const IS_USER_FILE_EXIST = await DriveUtil.isUserOwnFile(ctx.session.get("uid"), hash);
        if (IS_USER_FILE_EXIST) return Res.CustomThrow200(ctx, "文件已存在")
    }

    if (autoup) {
        if (IS_FILE_EXIST) {
            const uid = ctx.session.get("uid");
            let nowTimeStamp = Date.now();
            try {
                let _fn = await getUnrepeatedFilename(uid, fn);
                await DriveUtil.insertUserFile(uid, hash, fn, nowTimeStamp, false, false);
                autoupRes = {
                    uploaded: true,
                    msg: "上传成功",
                    data: {
                        name: fn,
                        hash: hash,
                        size: FileInfo.size / 8,
                        uploadTime: nowTimeStamp,
                        shared: false
                    }
                }
            } catch (e) {
                autoupRes = {
                    uploaded: false,
                    msg: "Internal Server Error"
                }
            }
        } else {
            autoupRes = {
                uploaded: false,
                msg: "无法秒传"
            }
        }
    }

    return Res.Success(ctx, {
        data: {
            exist: IS_FILE_EXIST,
            ...(autoup ? { autoup: autoupRes } : {})
        }
    })
})

router.post("/api/action/drive/upload/file", async (ctx, next) => {
    if (!verifySession(ctx)) return Res.UnAuthorized(ctx)

    function handleInternalError(err, resolve) {
        logger.error(err)
        Res.InternalError(ctx)
        return resolve()
    }

    const bb = Busboy({ headers: ctx.req.headers });

    await new Promise((resolve, reject) => {
        bb.on("file", (name, file, info) => {
            const { encoding, mimeType } = info;
            const filename = trimFn(Buffer.from(info.filename, "binary").toString("utf-8"));

            // WAF
            if (FILE_WAF.filename(filename)) {
                return resolve(Res.CustomThrow400(ctx, "文件名不合法"))
            } else if (FILE_WAF.filesize(getSizeFromHeaders(ctx, encoding, Buffer.from(name, 'binary').toString(), filename, mimeType))) {
                return resolve(Res.CustomThrow400(ctx, "文件大小超过限制"))
            }

            // 准备写入文件
            const hash = Crypto.createHash('sha256');
            const md5 = Crypto.createHash('md5');
            const savedir = CONFIG.storage_path;
            let temp_filename = `busy.${crypto.md5(filename)}.${crypto.md5(String(Date.now())).slice(0, 8)}`;
            const ori_filepath = path.resolve(savedir, temp_filename);

            // 创建文件流
            fs.writeFileSync(ori_filepath, Buffer.alloc(0));
            const fostream = fs.createWriteStream(ori_filepath);

            // 处理文件流
            const Status = {
                isInterrupted: false,
                isFileSizeExceeded: false,
                isFileCompelete: false
            }

            function emitDeleteTempFile(autoDetectExists = true) {
                logger.debug("Removing file ".yellow + `"${ori_filepath}"`.cyan)
                // fostream.destroy();
                try { fs.rmSync(ori_filepath, { force: true }) } catch (e) {
                    // Pass error: no such file or directory
                    if (autoDetectExists && e.code === "ENOENT") return
                    return handleInternalError(e, resolve)
                }
            }

            ctx.req.on("error", (err) => { // 请求中断
                Status.isInterrupted = true;
                file.destroy(); // 交给 close 事件处理
            })

            file.on('data', (data) => {
                hash.update(data);
                md5.update(data);
                if (fostream.bytesWritten > CONFIG.backend.file_upload_max_size) { // 文件大小超过限制
                    Status.isFileSizeExceeded = true;
                    file.destroy(); // 交给 close 事件处理
                }

            }).on("error", (err) => { // 异常写入报错：删除文件
                if (!err.message === "Request Interrupted") {
                    logger.error([
                        `FILE NAME ${`"${filename}"`.cyan}`,
                        `UID ${ctx.session.get("uid")}`,
                        `USER ${ctx.session.get("username")}\n`].join(" | "),
                        err);
                }

                emitDeleteTempFile();
                return resolve()
            }).on('close', () => {
                if (Status.isInterrupted) fostream.destroy(); // 交给 fostream 的 close 事件处理
            })

            fostream.on('close', async () => {

                // 接受处理事件：请求中断
                if (Status.isInterrupted) {
                    logger.debug("Request Interrupted".red)
                    emitDeleteTempFile()
                    return resolve()
                }

                // 文件大小超过限制
                if (Status.isFileSizeExceeded) {
                    logger.debug("File size exceeded")
                    emitDeleteTempFile()
                    return resolve(Res.CustomThrow400(ctx, "文件大小超过限制"))
                }

                // 规范化文件
                const filehash = hash.digest('hex');
                const filemd5 = md5.digest('hex');
                const new_filepath = path.resolve(savedir, filehash);
                try {
                    // Recheck file size
                    let filesize = fostream.bytesWritten; // bytes

                    if (filesize > CONFIG.backend.file_upload_max_size) { // 文件大小超过限制
                        logger.debug("File size exceeded")
                        emitDeleteTempFile()
                        return resolve(Res.CustomThrow400(ctx, "文件大小超过限制"))
                    }


                    let IS_FILE_EXIST = await DriveUtil.isFileExist(filehash);
                    let IS_USER_FILE_EXIST = await DriveUtil.isUserOwnFile(ctx.session.get('uid'), filehash)

                    // If file already exist in user's drive, then skip the database updating event
                    if (/* IS_FILE_EXIST &&  */IS_USER_FILE_EXIST) {
                        emitDeleteTempFile()

                        // To fix the unexpected bug that file exist in user's drive but not in file_info table
                        if (!IS_FILE_EXIST) await DriveUtil.insertFileInfo(filehash, filemd5, filesize * 8, Date.now(), false)
                            .catch(e => handleInternalError(e, resolve))

                        return resolve(Res.CustomThrow200(ctx, "文件已存在"));
                    }

                    // Save file
                    if (!fs.existsSync(new_filepath)) {
                        try { fs.renameSync(ori_filepath, new_filepath) } catch (e) { return handleInternalError(e, resolve) }
                        logger.info(`Saved file ` + `"${filename}"`.cyan + ` to ` + `"${new_filepath}"`.cyan)
                    } else {
                        logger.warn(`Saving File ` + `"${filename}"`.cyan + ` met conflict. File already exist at ` + `"${new_filepath}"`.cyan)
                    }
                    Status.isFileCompelete = true;

                    // Update database
                    let _filename = await getUnrepeatedFilename(ctx.session.get('uid'), filename); // format repeated filename
                    let nowTimeStamp = Date.now();
                    if (!IS_FILE_EXIST) await DriveUtil.insertFileInfo(filehash, filemd5, filesize * 8, nowTimeStamp, false)
                        .catch(e => handleInternalError(e, resolve))
                    await DriveUtil.insertUserFile(ctx.session.get('uid'), filehash, _filename, nowTimeStamp, false)
                        .catch(e => handleInternalError(e, resolve))
                    return resolve(Res.Success(ctx, {
                        msg: "上传成功",
                        data: {
                            name: _filename,
                            hash: filehash,
                            size: filesize,
                            uploadTime: nowTimeStamp,
                            shared: false
                        }
                    }))

                } catch (e) { emitDeleteTempFile(); handleInternalError(e, resolve) }
            })

            // 关联文件流
            file.pipe(fostream);

        })

        ctx.req.pipe(bb);
    })
})

router.post("/api/action/drive/rename", async (ctx, next) => {
    if (!verifySession(ctx)) return Res.UnAuthorized(ctx)
    const { uid, hash } = ctx.request.body
    const newName = trimFn(ctx.request.body["new"])
    const tokenUID = ctx.session.get("uid")

    if (typeof uid !== "string" || typeof hash !== "string" || typeof newName !== "string")
        return Res.CustomThrow400(ctx, "参数格式不正确")
    if (FILE_WAF.filename(newName)) return Res.CustomThrow400(ctx, "文件名不合法")
    if (typeof tokenUID !== "string") return Res.PermissionDenied(ctx)
    if (uid !== tokenUID) return Res.PermissionDenied(ctx)
    if (!await UserUtil.isUserExist(uid)) return Res.CustomThrow400(ctx, "UID 不存在")
    if (!await DriveUtil.isUserOwnFile(uid, hash)) return Res.CustomThrow400(ctx, "文件已删除或不存在")

    try {
        if (await DriveUtil.getUserFileInfo(uid, "filename", newName) !== null)
            return Res.CustomThrow400(ctx, "文件名已存在")
        await DriveUtil.renameUserFile(uid, hash, newName, false)
        return Res.Success(ctx, { msg: "重命名成功" })
    } catch (e) { return Res.InternalError(ctx) }
})

router.post("/api/action/drive/remove", async (ctx, next) => {
    if (!verifySession(ctx)) return Res.UnAuthorized(ctx)
    const { uid, hash } = ctx.request.body
    const tokenUID = ctx.session.get("uid")

    if (typeof uid !== "string" || typeof hash !== "string") return Res.CustomThrow400(ctx, "参数格式不正确")
    if (typeof tokenUID !== "string") return Res.PermissionDenied(ctx)
    if (uid !== tokenUID) return Res.PermissionDenied(ctx)
    if (!await UserUtil.isUserExist(uid)) return Res.CustomThrow400(ctx, "UID 不存在")
    if (!await DriveUtil.isUserOwnFile(uid, hash)) return Res.CustomThrow400(ctx, "文件已删除或不存在")

    try {
        await DriveUtil.updateFileInShareZone("remove", uid, hash, false, false)
        let removed = await DriveUtil.removeUserFileIfExist(uid, hash)
        if (!CONFIG.always_keep_file && await DriveUtil.isFileHasOwner(hash) === false) {
            await DriveUtil.removeFileInfoIfExist(hash)
            try {
                fs.rmSync(path.resolve(CONFIG.storage_path, hash))
            } catch (e) {
                logger.debug(`Failed to delete file ${hash} in storage due to not exist`)
            }
        }
        if (removed) return Res.Success(ctx, { msg: "删除成功" })
        else return Res.CustomThrow400(ctx, "文件已删除或不存在")
    } catch (e) { return Res.InternalError(ctx) }
})

router.post("/api/action/drive/store", async (ctx, next) => {
    if (!verifySession(ctx)) return Res.UnAuthorized(ctx)
    const { uid, hash } = ctx.request.body
    const tokenUID = ctx.session.get("uid")

    if (typeof uid !== "string" || typeof hash !== "string") return Res.CustomThrow400(ctx, "参数格式不正确")
    if (typeof tokenUID !== "string") return Res.PermissionDenied(ctx)
    if (uid === tokenUID) return Res.CustomThrow200(ctx, "不能转存自己的文件")
    if (!await UserUtil.isUserExist(uid)) return Res.CustomThrow400(ctx, "UID 不存在")
    if (!await DriveUtil.isShareFileExist(hash, uid)) return Res.CustomThrow400(ctx, "该文件未分享或已删除")
    else {
        // fix unexpected internal bug: file is in sharezone but user doesn't have this file
        if (!await DriveUtil.isUserOwnFile(uid, hash)) {
            await DriveUtil.updateFileInShareZone("remove", uid, hash, false, false)
            return Res.CustomThrow400(ctx, "该文件未分享或已删除")
        }
    }
    if (await DriveUtil.isUserOwnFile(tokenUID, hash)) return Res.CustomThrow200(ctx, "您已拥有相同的文件")

    let nowTimeStamp = Date.now()
    let filename = await DriveUtil.getFilename(uid, hash)
    filename = await getUnrepeatedFilename(tokenUID, filename)
    try {
        await DriveUtil.insertUserFile(tokenUID, hash, filename, nowTimeStamp, true, false)
        Res.Success(ctx, {
            msg: "转存成功"
        })
    } catch (e) {
        return Res.InternalError(ctx)
    }
})

router.post("/api/action/drive/setshare", async (ctx, next) => {
    if (!verifySession(ctx)) return Res.UnAuthorized(ctx)
    const { uid, hash, share } = ctx.request.body
    const tokenUID = ctx.session.get("uid")

    if (typeof uid !== "string" || typeof hash !== "string" || typeof share === "undefined") return Res.CustomThrow400(ctx, "参数格式不正确")
    if (typeof tokenUID !== "string") return Res.PermissionDenied(ctx)
    if (uid !== tokenUID) return Res.PermissionDenied(ctx)
    if (!await UserUtil.isUserExist(uid)) return Res.CustomThrow400(ctx, "UID 不存在")
    if (!await DriveUtil.isUserOwnFile(uid, hash)) return Res.CustomThrow400(ctx, "文件已删除或不存在")

    const shared = await DriveUtil.getShareStatus(uid, hash, false)
    if (typeof shared !== "boolean") return Res.InternalError(ctx)

    const status = !!Math.ceil(share)
    if (shared === status) return Res.CustomThrow200(ctx, "状态无变化")

    await DriveUtil.setShareStatus(uid, hash, status, false).catch(err => {
        logger.error(err)
        return Res.InternalError(ctx)
    })

    if ((ctx.body | {}).code !== -5) {
        return Res.Success(ctx, {
            msg: status ? "分享成功" : "已取消分享",
        })
    }

})

module.exports = router