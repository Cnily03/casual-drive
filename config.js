module.exports = {
    koa_port: 5656,
    koa_dev_port: 21920,
    webpack_dev_port: 21921,
    storage_path: "./storage",
    always_keep_file: false,// if no one owns the file, it won't be deleted in the database
    cookie: {
        max_age: 7 * 24 * 60 * 60 * 1000,
        token_auto_update_delay: 30 * 60 * 1000, // in ms, must lower than max_age
    },
    download_signature: {
        max_age: 6 * 60 * 60 * 1000, // in miliseconds
    },
    backend: {
        sign_in_max_try: 5,
        sign_in_wait_sec: 60,
        username_reg: ["^[a-z0-9_-]+$", "i"],
        password_reg: ["^[a-z0-9\\!\\@\\#\\$\\%\\^\\&\\_\\-]+$", "i"],
        file_upload_max_size: 10 * 1024 * 1024,// Byte
        file_upload_max_name_length: 64
    },
    frontend: {
        title: "下一代的云盘"
    }
}
