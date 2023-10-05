const database = require("./database")
const CONFIG = require("../../runtime.config.json");
const logger = global.logger.setPrefix("DB", "blue", "bold");
const crypto = require("./crypto");

const db = {
    user: database.db.user(),
    logevent: database.db.logevent(),
    drive: database.db.drive()
}

// ============== User ==============

async function getUserInfo(uid) {
    const data = await db.user.getSync("SELECT * FROM userlist WHERE uid = ?", [uid]);
    if (data && data.uid) return data;
    else return {};
}

async function isUserExist(uid) {
    const data = await db.user.getSync("SELECT uid FROM userlist WHERE uid = ?", [uid]);
    if (data && data.uid) return true;
    else return false;
}

/**
 * @returns {Promise<string | undefined>}
 */
async function getUserUidByUnPwd(username, passwd) {
    const data = await db.user.getSync("SELECT uid FROM userlist WHERE username = ? AND password = ?", [username, passwd]);
    if (data && data.uid) return data.uid;
    else return undefined;
}

/**
 * @returns {Promise<boolean>}
 */
async function isUsernameExist(username) {
    const data = await db.user.getSync("SELECT uid FROM userlist WHERE username = ?", [username]);
    if (data && data.uid) return true;
    else return false;
}

/**
 * @returns {Promise<string>} uid
 */
async function getMaxUID() {
    const data = await db.user.getSync("SELECT MAX(uid) AS max FROM userlist");
    if (data && data.max) return data.max;
    else return "100000";
}

/**
 * @returns {Promise<string>} uid
 */
async function insertUser(username, password) {
    let uid = String(parseInt(await getMaxUID()) + 1);
    await db.user.runSync("INSERT INTO userlist (uid, username, password) VALUES (?, ?, ?)", [uid, username, password]);
    return uid;
}

const UserUtil = {
    getUserInfo, isUserExist, getUserUidByUnPwd, isUsernameExist, getMaxUID, insertUser
}

// ============== LogEvent ==============

const SIGN_IN_MAX_TRY = CONFIG.backend.sign_in_max_try;
const SIGN_IN_WAIT_TIME = CONFIG.backend.sign_in_wait_sec * 1000;

/**
 * @returns {Promise<{t:number;un:string;}[]>} record
 */
async function getIPSignInHistory(ip) {
    const data = await db.logevent.getSync("SELECT record FROM failed_signin WHERE ip = ?", [ip]);
    if (data && data.record) {
        const record = JSON.parse(crypto.base64.decode(data.record));
        logger.debug(`[+] Get IP sign in history: ${ip.cyan} => ${JSON.stringify(record)}`);
        return record;
    }
    else return []
}

async function clearIPSignInHistory(ip) {
    await db.logevent.runSync("DELETE FROM failed_signin WHERE ip = ?", [ip]);
}

async function pushIPSignInHistory(ip, username, record, time) {
    const TIME = time || Date.now();
    record = record || await getIPSignInHistory(ip);
    // record = record.filter(item => TIME - item.t < LOGIN_WAIT_TIME); // remove expired records
    record.push({ t: TIME, un: username });
    if (record.length > SIGN_IN_MAX_TRY) record.shift();
    await db.logevent.runSync("INSERT OR REPLACE INTO failed_signin (ip, record) VALUES (?, ?)",
        [ip, crypto.base64.encode(JSON.stringify(record))]);
}

/**
 * 登录 `SIGN_IN_MAX_TRY` 次后，须等待 `SIGN_IN_WAIT_TIME` 毫秒再试
 * @returns {Promise<boolean>}
 */
async function verifyIPSignInHistory(ip, username) {
    const TIME = Date.now();
    let record = await getIPSignInHistory(ip);
    if (record.length >= SIGN_IN_MAX_TRY) {
        const lastTime = record[record.length - 1].t;
        if (TIME - lastTime < SIGN_IN_WAIT_TIME) {
            await pushIPSignInHistory(ip, username, record, TIME); // reset waiting time
            return false;
        }
    }
    record = record.filter(item => TIME - item.t < SIGN_IN_WAIT_TIME); // remove expired records
    await pushIPSignInHistory(ip, username, record, TIME);
    return true;
}

const LogEventUtil = {
    getIPSignInHistory, verifyIPSignInHistory, pushIPSignInHistory, clearIPSignInHistory
}


// ============== Drive ==============

/**
 * Retrieve file information from the database based on the provided hash or md5 value.
 * @param {string} v - The hash or md5 value of the file to retrieve information for.
 * @param {"auto" | "hash" | "md5" | "md5_32" | "md5_16"} [type="auto"] - The type of value provided (either "hash" or "md5").
 * @returns {Promise<Object|null>} - Returns an object containing file information if found, or null if not found.
 */
async function getFileInfo(v, type = "auto") {
    let query_args;
    if (type === "auto") {
        if (v.length === 64) type = "hash";
        else if (v.length === 32) type = "md5_32";
        else if (v.length === 16) type = "md5_16";
        else throw new Error("Invalid hash or md5 length");
    }
    if (type === "md5") {
        if (v.length === 32) type = "md5_32";
        else if (v.length === 16) type = "md5_16";
        else throw new Error("Invalid md5 length");
    }
    if (type === "hash") query_args = [
        "SELECT * FROM file_info WHERE hash = ?", [v]
    ];
    else if (type === "md5_32") query_args = [
        "SELECT * FROM file_info WHERE md5 = ?", [v]
    ];
    else if (type === "md5_16") query_args = [ // Use LIKE syntax to match the [8,24) substring of the md5 value
        "SELECT * FROM file_info WHERE md5 LIKE ?", [`________${v}________`]
    ];
    const data = await db.drive.getSync(...query_args);
    if (data && data.id) return data;
    else return null;
}

/**
 * Retrieve file information from the database based on the provided hash or md5 value.
 * @param {string} v - The hash or md5 value of the file to retrieve information for.
 * @param {"auto" | "hash" | "md5" | "md5_32" | "md5_16"} [type="auto"] - The type of value provided (either "hash" or "md5").
 * @returns {Promise<Object[]>} - Returns an array of the object containing file information if found.
 */
async function getAllFileInfo(v, type = "auto") {
    let query_args;
    if (type === "auto") {
        if (v.length === 64) type = "hash";
        else if (v.length === 32) type = "md5_32";
        else if (v.length === 16) type = "md5_16";
        else throw new Error("Invalid hash or md5 length");
    }
    if (type === "md5") {
        if (v.length === 32) type = "md5_32";
        else if (v.length === 16) type = "md5_16";
        else throw new Error("Invalid md5 length");
    }
    if (type === "hash") query_args = [
        "SELECT * FROM file_info WHERE hash = ?", [v]
    ];
    else if (type === "md5_32") query_args = [
        "SELECT * FROM file_info WHERE md5 = ?", [v]
    ];
    else if (type === "md5_16") query_args = [ // Use LIKE syntax to match the [8,24) substring of the md5 value
        "SELECT * FROM file_info WHERE md5 LIKE ?", [`________${v}________`]
    ];
    const data = await db.drive.allSync(...query_args);
    if (data && data.length) return data;
    else return []
}

/**
 * @returns {Promise<boolean>}
 */
async function isFileExist(hash) {
    const data = await db.drive.getSync("SELECT id FROM file_info WHERE hash = ?", [hash]);
    if (data && data.id) return true;
    else return false;
}

/**
 * @returns {Promise<boolean>}
 */
async function isFileHasOwner(hash) {
    const data = await db.drive.getSync("SELECT id FROM user_file_list WHERE hash = ?", [hash]);
    if (data && data.id) return true;
    else return false;
}

/**
 * @returns {Promise<boolean>}
 */
async function isUserOwnFile(uid, hash) {
    const data = await db.drive.getSync("SELECT id FROM user_file_list WHERE uid = ? AND hash = ?", [uid, hash]);
    if (data && data.id) return true;
    else return false;
}

/**
 * Check if a shared file exists in the database.
 * @param {string} hash - The hash of the file.
 * @param {string} [uid] - The user ID of the file uploader.
 * @returns {Promise<boolean>} - Returns true if the file exists, false otherwise.
 */
async function isShareFileExist(hash, uid) {
    if (typeof uid === "undefined") {
        const data = await db.drive.getSync("SELECT id FROM share_file_list WHERE hash = ?", [hash]);
        if (data && data.id) return true;
        else return false;
    } else {
        const data = await db.drive.getSync("SELECT id FROM share_file_list WHERE hash = ? AND uploader_uid = ?", [hash, uid]);
        if (data && data.id) return true;
        else return false;
    }
}

/**
 * Insert file information into the database.
 * @param {string} hash - The hash of the file.
 * @param {string} md5 - The MD5 of the file.
 * @param {number} size - The size of the file in bytes.
 * @param {number} createTime - The creation time of the file.
 * @param {boolean} [checkExist=true] - Whether to check if the file already exists in the database.
 * @returns {Promise<void>}
 */
async function insertFileInfo(hash, md5, size, createTime, checkExist = true) {
    size = Math.round(size);
    if (checkExist && await isFileExist(hash)) {
        // logger.warn(`File ${hash.yellow} wants to be inserted into ${'file_info'.cyan}, but it already exists`);
        return;
    }
    await db.drive.runSync("INSERT INTO file_info (hash, md5, size, create_time) VALUES (?, ?, ?, ?)", [hash, md5, size, createTime]);
    logger.info(`[+] Insert file ${hash.yellow} | Size ${`${size / 8} Bytes`.cyan} | CreateTime ${new Date(createTime).toLocaleString().cyan}`);
}



/**
 * Insert a user file into the database.
 * @param {string} uid - The user ID.
 * @param {string} hash - The hash of the file.
 * @param {string} filename - The name of the file.
 * @param {number} uploadTime - The time the file was uploaded.
 * @param {boolean} [checkExist=true] - Whether to check if the file already exists in the database.
 * @param {boolean} [checkOwn=true] - Whether to check if the user owns the file.
 * @returns {Promise<void>}
 */
async function insertUserFile(uid, hash, filename, uploadTime, checkExist = true, checkOwn = true) {
    if (checkExist && !await isFileExist(hash)) {
        logger.debug(`File ${hash.yellow} wants to be inserted into ${'user_file_list'.yellow}, but it doesn't exist in the ${'file_info'.cyan}`);
        // throw new Error("Please ensure the file exist in the database first");
        return;
    } else if (checkOwn && await isUserOwnFile(uid, hash)) {
        return
    }
    await db.drive.runSync("INSERT INTO user_file_list (uid, hash, filename, upload_time, shared) VALUES (?, ?, ?, ?, ?)", [uid, hash, filename, uploadTime, 0]);
    logger.info(`[+] Insert file ${`"${filename}"`.cyan} | UID ${uid.cyan}`);
}

/**
 * Remove file information from the database if it exists.
 * @param {string} hash - The hash of the file.
 * @returns {Promise<boolean>} - Whether the file information exists in the database.
 */
async function removeFileInfoIfExist(hash) {
    const status = await db.drive.runSync("DELETE FROM file_info WHERE hash = ?", [hash])
    if (status.changes === 0) {
        logger.debug(`[-] Remove file info ${hash.yellow} | ${'Not Found'.red}`);
        return false
    } else {
        logger.info(`[-] Remove file info ${hash.yellow} | ${'Success'.green}`);
        return true
    }
}

/**
 * Remove a user file from the database if it exists.
 * @param {string} uid - The user ID.
 * @param {string} hash - The hash of the file.
 * @returns {Promise<boolean>} - Whether the file exists in user's file list.
 */
async function removeUserFileIfExist(uid, hash) {
    const status = await db.drive.runSync("DELETE FROM user_file_list WHERE uid = ? AND hash = ?", [uid, hash])
    if (status.changes === 0) {
        logger.debug(`[-] Remove user file ${hash.yellow} | UID ${uid.cyan} | ${'Not Found'.red}`);
        return false
    } else {
        logger.info(`[-] Remove user file ${hash.yellow} | UID ${uid.cyan} | ${'Success'.green}`);
        return true
    }
}

/**
 * Get file information for a specific user by either hash or filename.
 * @param {string} uid - The user ID.
 * @param {"hash" | "filename"} type - The type of search to perform.
 * @param {string} search - The value to search for.
 * @returns {Promise<Object|null>} - Returns an object containing file information if found, null otherwise.
 */
async function getUserFileInfo(uid, type, search) {
    let query_str;
    if (type === "hash") query_str = "SELECT * FROM user_file_list WHERE uid = ? AND hash = ?";
    else if (type === "filename") query_str = "SELECT * FROM user_file_list WHERE uid = ? AND filename = ?";
    const data = await db.drive.getSync(query_str, [uid, search])
    if (data && data.id) return data
    else return null
}

async function getUserFileList(uid) {
    const data = await db.drive.allSync("SELECT * FROM user_file_list WHERE uid = ?", [uid])
    if (data && data.length) return data
    else return []
}

async function getShareZoneFileList() {
    const data = await db.drive.allSync("SELECT * FROM share_file_list")
    if (data && data.length) return data
    else return []
}

/**
 * @param {string} hash 
 * @returns {Promise<boolean | number>}
 */
async function getFileSize(hash) {
    const data = await db.drive.getSync("SELECT size FROM file_info WHERE hash = ?", [hash]);
    if (data && typeof data.size === "number") return data.size;
    else return false;
}

/**
 * @returns {Promise<string | undefined>}
 */
async function getFilename(uid, hash) {
    const data = await db.drive.getSync("SELECT filename FROM user_file_list WHERE hash = ? AND uid = ?", [hash, uid]);
    if (data && data.filename) return data.filename;
    else return undefined;
}

/**
 * Get the share status of a file for a given user.
 * @param {string} uid - The user ID of the uploader.
 * @param {string} hash - The hash of the file to check.
 * @param {boolean} [checkOwn=true] - Whether to check if the user owns the file.
 * @returns {Promise<boolean>} - Returns a promise that resolves to a boolean indicating whether the file is shared with the user.
 */
async function getShareStatus(uid, hash, checkOwn = true) {
    if (checkOwn && !await isUserOwnFile(uid, hash)) {
        logger.debug(`UID ${uid.cyan} doesn't own file ${hash.yellow}`);
        return false
    }
    const data = await db.drive.getSync("SELECT shared FROM user_file_list WHERE uid = ? AND hash = ?", [uid, hash]);
    if (data && typeof data.shared === "number") return !!data.shared;
    else return false;
}

/**
 * Get the full hash of a file given its short hash.
 * @param {string} short_hash - The short hash of the file.
 * @param {"file_info" | "user_file_list" | "share_file_list"} [table="file_info"] - The name of the table to search for the hash.
 * @returns {Promise<string[]>} - Returns a promise that resolves to an array of full hashes that match the short hash.
 */
async function getFullHash(short_hash, table = "file_info", uid) {
    let query_args
    if (table === "user_file_list" && typeof uid === "string") query_args = [
        `SELECT hash FROM ${table} WHERE uid = ? AND hash LIKE ?`, [uid, `${short_hash}%`]
    ];
    else if (table === "share_file_list" && typeof uid === "string") query_args = [
        `SELECT hash FROM ${table} WHERE uploader_uid = ? AND hash LIKE ?`, [uid, `${short_hash}%`]
    ];
    else query_args = [
        `SELECT hash FROM ${table} WHERE hash LIKE ?`, [`${short_hash}%`]
    ];
    const data = await db.drive.allSync(...query_args);
    if (data && data.length) return data.map(item => item.hash);
    else return [];
}


/**
 * Set the share status of a file for a given user.
 * @param {string} uid - The user ID of the uploader.
 * @param {string} hash - The hash of the file to update.
 * @param {boolean} status - The share status to set for the file.
 * @param {boolean} [checkOwn=true] - Whether to check if the user owns the file.
 * @returns {Promise<void>}
 */
async function setShareStatus(uid, hash, status, checkOwn = true) {
    status = status ? 1 : 0
    if (checkOwn && !await isUserOwnFile(uid, hash)) {
        logger.debug(`UID ${uid.cyan} doesn't own file ${hash.yellow}`);
    }
    await Promise.all([
        db.drive.runSync("UPDATE user_file_list SET shared = ? WHERE uid = ? AND hash = ?", [status, uid, hash]),
        updateFileInShareZone(!!status ? "add" : "remove", uid, hash, false,)
    ]);
    logger.info(`Set share status: ${"STATUS ".cyan + `${status} | ${"UID ".cyan + uid.yellow} | ${"HASH ".cyan + hash.yellow}`.yellow}`)
}



/**
 * Update the file in the share zone with the given action, user ID, and hash.
 * @param {"add" | "remove"} action - The action to perform on the file in the share zone.
 * @param {string} uid - The user ID of the uploader.
 * @param {string} hash - The hash of the file to update.
 * @param {boolean} [checkOwn=true] - Whether to check if the user owns the file.
 * @param {boolean} [checkAlreadyShared=true] - Whether to check if the file is already shared.
 * @returns {Promise<void>}
 */
async function updateFileInShareZone(action, uid, hash, checkOwn = true, checkAlreadyShared = true) {
    if (checkOwn && !await isUserOwnFile(uid, hash)) return logger.warn(`UID ${uid.cyan} doesn't own file ${hash.yellow}`);

    const time = Date.now();

    // get filename
    // const data = await db.drive.getSync("SELECT filename FROM user_file_list WHERE uid = ? AND hash = ?", [uid, hash]);
    // let fn;
    // if (data && data.filename) fn = data.filename;
    // else return logger.warn(`UID ${uid.cyan} doesn't own file ${hash.yellow}`);

    // insert
    let isAlreadyShared;
    if (checkAlreadyShared) {
        const _data = await db.drive.getSync("SELECT id FROM share_file_list WHERE uploader_uid = ? AND hash = ?", [uid, hash]);
        if (_data && _data.id) isAlreadyShared = true;
        else isAlreadyShared = false;
    }
    if (action === "add") {
        if (checkAlreadyShared && isAlreadyShared)
            return logger.debug(`File ${hash.yellow} of UID ${uid.cyan} already exists in share zone`);

        await db.drive.runSync("INSERT INTO share_file_list (uploader_uid, hash, share_time) VALUES (?, ?, ?)", [uid, hash, time]);
        logger.info(`[+] Share file ${hash.yellow} | UID ${uid.cyan} | Time ${new Date(time).toLocaleString().cyan}`);
    } else if (action === "remove") {
        if (checkAlreadyShared && !isAlreadyShared)
            return logger.debug(`File ${hash.yellow} of UID ${uid.cyan} doesn't exist in share zone`);
        const status = await db.drive.runSync("DELETE FROM share_file_list WHERE uploader_uid = ? AND hash = ?", [uid, hash]);
        if (status.changes > 0) logger.info(`[-] Unshare file ${hash.yellow} | UID ${uid.cyan}`);
    }
}

async function renameUserFile(uid, hash, newName, checkOwn = true) {
    if (checkOwn && !await isUserOwnFile(uid, hash)) return logger.debug(`UID ${uid.cyan} doesn't own file ${hash.yellow}`);
    await db.drive.runSync("UPDATE user_file_list SET filename = ? WHERE uid = ? AND hash = ?", [newName, uid, hash]);
}

const DriveUtil = {
    getFileInfo, getAllFileInfo, isFileExist, isFileHasOwner, isUserOwnFile, isShareFileExist, insertFileInfo, insertUserFile, removeFileInfoIfExist, removeUserFileIfExist, getFilename, getUserFileInfo, getUserFileList, getShareZoneFileList, getFileSize, getShareStatus, getFullHash, setShareStatus, updateFileInShareZone, renameUserFile
}

module.exports = {
    UserUtil, LogEventUtil, DriveUtil
}