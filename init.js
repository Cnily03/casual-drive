require("colors")

const logger = global.logger = require("./logger").consoleLogger().setPrefix("INIT");
const DefaultConfig = require("./config.js")

const fs = require("fs");
const path = require("path");
const crypto = require("./components/utils/crypto");

function isJSON(obj) {
    return typeof (obj) === "object" && Object.prototype.toString.call(obj).toLowerCase() === "[object object]" && !obj.length;
}

function mergeJSON(target, source) {
    for (const key of Object.keys(source)) {
        if (isJSON(source[key])) {
            if (!target[key]) target[key] = {}
            mergeJSON(target[key], source[key])
        } else {
            target[key] = source[key]
        }
    }
    return target
}

function dirExists(path) {
    try {
        return fs.statSync(path).isDirectory();
    } catch (err) {
        if (err.code === 'ENOENT') { // no such file or directory. 
            return false;
        }
        throw err;  // 其他错误，重新抛出
    }
}

const getDefault = (path) => {
    let p = DefaultConfig
    for (v of path.split("/")) {
        try {
            p = p[v]
        } catch (e) {
            return false
        }
    }
    return p
}

const exec = require('child_process').exec;
const execSync = (cmd) => {
    return new Promise((resolve, reject) => {
        logger.log("> ".bold.gray + cmd)
        exec(cmd, (err, stdout, stderr) => {
            if (err) reject(err);
            resolve(stdout);
        });
    })
}
const execAll = (cmds) => { cmds.forEach(execSync) }
const execAllSync = async (cmds) => {
    for (const cmd of cmds) await execSync(cmd);
}

const SQLite = require('sqlite3').verbose();
const database = require("./components/utils/database");

const CONFIG = {
    storage_path: getDefault("storage_path"),
    db: {
        salt: {
            user_password: getDefault("db/salt/user_password")
        }
    },
    session: {
        SM2: {
            pubKey: getDefault("session/SM2/pubKey"),
            pteKey: getDefault("session/SM2/pteKey"),
            xorKey: getDefault("session/SM2/xorKey"),
        },
        token: {
            aes_key: getDefault("session/token/aes_key"),
            aes_iv: getDefault("session/token/aes_iv"),
        }
    },
    download_signature: {
        max_age: getDefault("download_signature/max_age"),
        SM2: {
            pubKey: getDefault("download_signature/SM2/pubKey"),
            pteKey: getDefault("download_signature/SM2/pteKey"),
            xorKey: getDefault("download_signature/SM2/xorKey")
        }
    },
};

console.log("")
logger.info("Starting initialization...".blue.bold)
Promise.all([

    /** Basic normalization */

    (async () => {
        if (DefaultConfig.storage_path && DefaultConfig.storage_path.startsWith("."))
            DefaultConfig.storage_path = path.resolve(DefaultConfig.storage_path)
        if (CONFIG.storage_path && CONFIG.storage_path.startsWith("."))
            CONFIG.storage_path = path.resolve(CONFIG.storage_path)
    })(),

    /** Init UserInfo Database */

    (async () => {
        // Generate salt
        logger.info("Generating salt...")
        const SALT = CONFIG.db.salt.user_password || crypto.rndHex(6);
        logger.debug("Salt:".magenta, SALT.cyan)
        CONFIG.db.salt.user_password = SALT;

        if (!dirExists("./sql")) fs.mkdirSync("./sql")
        logger.info("Creating database " + "./sql/user.db".cyan + "...")
        await execAllSync([
            "rm -rf ./sql/user.db",
            "touch ./sql/user.db",
        ])

        logger.info("Connecting databse " + "./sql/user.db".cyan + "...")
        const user = await database.promise_db.user();

        logger.info("Creating table " + "user/userlist".cyan + "...")
        await user.runSync(
            `CREATE TABLE IF NOT EXISTS userlist (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                uid TEXT NOT NULL UNIQUE,
                username TEXT NOT NULL UNIQUE COLLATE NOCASE,
                password TEXT NOT NULL
            )`
        );

        // generate random hex string (16 charactors long)
        const randomPasswd = crypto.rndStr(18, {
            repeat: false, alphabet: "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ!@#$%^&_-", ensure: [
                {
                    pattern: "!@#$%^&_-",
                    count: 3
                },
                {
                    pattern: crypto.ALPHABET.NUMBER,
                    count: 2
                },
                {
                    pattern: crypto.ALPHABET.UPPERCASE,
                    count: 3
                },
                {
                    pattern: crypto.ALPHABET.LOWERCASE,
                    count: 3
                }
            ]
        });
        logger.debug("Random password:".magenta, randomPasswd.cyan)
        const randomPasswd_MD5 = crypto.md5(randomPasswd);
        logger.debug("Random password MD5:".magenta, randomPasswd_MD5.cyan)
        const randomPasswd_MD5_SALTED = crypto.sha1(randomPasswd_MD5 + "." + SALT);
        logger.debug("Salted random password MD5:".magenta, randomPasswd_MD5_SALTED.cyan)

        logger.info("Inserting admin data into table " + "user/userlist".cyan + "...")
        await user.runSync(
            `INSERT INTO userlist (uid, username, password) VALUES (?, ?, ?)`,
            ["100000", "admin", randomPasswd_MD5_SALTED]
        );
    })(),

    /** Init Log Event Database */

    (async () => {
        logger.info("Creating database " + "./sql/logevent.db".cyan + "...")
        await execAllSync([
            "rm -rf ./sql/logevent.db",
            "touch ./sql/logevent.db",
        ])

        logger.info("Connecting databse " + "./sql/logevent.db".cyan + "...")
        const logevent = await database.promise_db.logevent();

        logger.info("Creating table " + "logevent/failed_signin".cyan + "...")
        await logevent.runSync(
            `CREATE TABLE IF NOT EXISTS failed_signin (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                ip TEXT NOT NULL UNIQUE,
                record TEXT NOT NULL
            )`
        );
    })(),

    /** Init Drive Database */

    (async () => {
        logger.info("Creating database " + "./sql/drive.db".cyan + "...")
        await execAllSync([
            "rm -rf ./sql/drive.db",
            "touch ./sql/drive.db",
        ])

        logger.info("Connecting databse " + "./sql/drive.db".cyan + "...")
        const drive = await database.promise_db.drive();

        logger.info("Creating table " + "drive/file_info".cyan + "...")
        // size in bits
        await drive.runSync(
            `CREATE TABLE IF NOT EXISTS file_info (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                hash TEXT NOT NULL UNIQUE,
                md5 TEXT NOT NULL,
                size INTEGER NOT NULL,
                create_time INTEGER NOT NULL
            )`
        );


        logger.info("Creating table " + "drive/user_file_list".cyan + "...")
        await drive.runSync(
            `CREATE TABLE IF NOT EXISTS user_file_list (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                uid TEXT NOT NULL,
                hash TEXT NOT NULL,
                filename TEXT NOT NULL,
                upload_time INTEGER NOT NULL,
                shared INTEGER NOT NULL
            )`
        );

        logger.info("Creating table " + "drive/share_file_list".cyan + "...")
        await drive.runSync(
            `CREATE TABLE IF NOT EXISTS share_file_list (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                hash TEXT NOT NULL,
                uploader_uid TEXT NOT NULL,
                share_time INTEGER NOT NULL
            )`
        );
    })(),

    /** Clean `storage` directory */
    (async function () {
        logger.info("Cleaning " + "./storage".cyan + "...")
        await execSync("rm -rf ./storage")
        fs.mkdirSync("./storage")
    })(),

    /** Init Session Keys */

    (async function () {
        const { publicKey, privateKey } = crypto.sm2.generateKeyPairHex()
        const pubKey = !(CONFIG.session.SM2.pubKey && CONFIG.session.SM2.pteKey) ? publicKey : CONFIG.session.SM2.pubKey;
        const pteKey = !(CONFIG.session.SM2.pubKey && CONFIG.session.SM2.pteKey) ? privateKey : CONFIG.session.SM2.pteKey;
        const xorKey = CONFIG.session.SM2.xorKey || crypto.rndStr(16);
        logger.debug("Session SM2 public key:".magenta, pubKey.cyan)
        logger.debug("Session SM2 private key:".magenta, pteKey.cyan)
        logger.debug("Session SM2 xor key:".magenta, xorKey.cyan)
        CONFIG.session.SM2 = { pubKey, pteKey, xorKey };

        const aes_key = CONFIG.session.token.aes_key || crypto.rndStr(16),
            aes_iv = CONFIG.session.token.aes_iv || crypto.rndStr(16);
        logger.debug("Session Token AES key:".magenta, aes_key.cyan)
        logger.debug("Session Token AES iv:".magenta, aes_iv.cyan)
        CONFIG.session.token = {
            aes_key: aes_key,
            aes_iv: aes_iv
        }
    })(),

    /** Init Downlaod Signature Keys */

    (async function () {
        const { publicKey, privateKey } = crypto.sm2.generateKeyPairHex()
        const pubKey = !(CONFIG.download_signature.SM2.pubKey && CONFIG.download_signature.SM2.pteKey) ? publicKey : CONFIG.download_signature.SM2.pubKey;
        const pteKey = !(CONFIG.download_signature.SM2.pubKey && CONFIG.download_signature.SM2.pteKey) ? privateKey : CONFIG.download_signature.SM2.pteKey;
        const xorKey = CONFIG.download_signature.SM2.xorKey || crypto.rndStr(16);
        logger.debug("Signature for Downloading SM2 public key:".magenta, pubKey.cyan)
        logger.debug("Signature for Downloading SM2 private key:".magenta, pteKey.cyan)
        logger.debug("Signature for Downloading SM2 xor key:".magenta, xorKey.cyan)
        CONFIG.download_signature.SM2 = { pubKey, pteKey, xorKey };
    })()


]).then(() => {
    logger.info("Writing config to " + "runtime.config.json".cyan + "...")
    fs.writeFileSync(path.resolve("./runtime.config.json"), JSON.stringify(mergeJSON(CONFIG, DefaultConfig), null, 4));
    logger.info("Done.".green.bold)
    console.log("")
})