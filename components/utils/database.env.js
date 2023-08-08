require('colors')

/**
 * @returns {import("../../logger").CustomLogger}
 */
const getGlobalLogger = ()=> global.logger

const logger = getGlobalLogger().setPrefix("DB")
const sqlite3 = require('sqlite3')
const SQLite = sqlite3.verbose()

/**
 * @returns {sqlite3.Database}
 */
function getDB(dbpath) {
    return new SQLite.Database(dbpath, (err) => {
        if (err) return logger.error(err.message)
        logger.info("Connect database ".green + `${dbpath}`.cyan + " successfully".green)
    })
}

/**
 * @returns {Promise<sqlite3.Database>}
 */
function getDBSync(dbpath) {
    return new Promise((resolve, reject) => {
        const db = new SQLite.Database(dbpath, (err) => {
            if (err) reject(err)
            logger.info("Connect database ".green + `${dbpath}`.cyan + " successfully".green)
            resolve(db)
        })
    })
}

/**
 * @returns {Promise<sqlite3.Database>}
 */
sqlite3.Database.prototype.runSync = function (sql, params) {
    return new Promise((resolve, reject) => {
        this.run(sql, params, function (err) {
            if (err) reject(err)
            resolve(this)
        })
    })
}

/**
 * @returns {Promise<any>}
 */
sqlite3.Database.prototype.getSync = function (sql, params) {
    return new Promise((resolve, reject) => {
        this.get(sql, params, function (err, row) {
            if (err) reject(err)
            resolve(row)
        })
    })
}

/**
 * @returns {Promise<any>}
 */
sqlite3.Database.prototype.allSync = function (sql, params) {
    return new Promise((resolve, reject) => {
        this.all(sql, params, function (err, rows) {
            if (err) reject(err)
            resolve(rows)
        })
    })
}

/**
 * @returns {Promise<number>}
 */
sqlite3.Database.prototype.eachSync = function (sql, params, callback) {
    return new Promise((resolve, reject) => {
        this.each(sql, params, function (err, row) {
            if (err) reject(err)
            callback(row)
        }, function (err, count) {
            if (err) reject(err)
            resolve(count)
        })
    })
}

module.exports = {
    getDB, getDBSync
}