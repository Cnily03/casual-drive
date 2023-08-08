const { getDB, getDBSync } = require("./database.env")
// const sqlite3 = require('sqlite3')
// const SQLite = sqlite3.verbose()

module.exports = {
    getDB, getDBSync,
    promise_db: {
        user: () => getDBSync('./sql/user.db'),
        logevent: () => getDBSync('./sql/logevent.db'),
        drive: () => getDBSync('./sql/drive.db')
    },
    db: {
        user: () => getDB('./sql/user.db'),
        logevent: () => getDB('./sql/logevent.db'),
        drive: () => getDB('./sql/drive.db')
    }
}