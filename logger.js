const Color = require('colors');
const path = require('path');

const env = global.env = (process.env.NODE_ENV || "production").trim();
const isEnvDev = global.isEnvDev = env === "development";

global.console.debug = global.isEnvDev ? (...args) => { console.log(`[${time(0)}] `.gray + "[DEBUG]".blue.bold, ...args) } : () => { };
global.console.info = (...args) => { console.log(`[${time(0)}] `.gray + "[INFO]".green.bold, ...args) }
global.console.warn = (...args) => { console.log(`[${time(0)}] `.gray + "[WARN]".yellow.bold, ...args) }
global.console.error = (...args) => { console.log(`[${time(0)}] `.gray + "[ERROR]".red.bold, ...args) }
global.console.fetal = (...args) => { console.log(`[${time(0)}] `.gray + "[FETAL]".magenta.bold, ...args) }
console._trace = console.trace
global.console.trace = (...args) => { console._trace(`[${time(0)}] `.gray + "[TRACE]".cyan.bold, ...args) }

function time(tight = true) {
    const date = new Date();
    if (tight) return date.toLocaleString().split(/\/| |:/).map(s => s.length < 2 ? "0" + s : s).join("")
    else return date.toLocaleDateString().split("/").map(s => s.length < 2 ? "0" + s : s).join("-")
        + " " + date.toLocaleTimeString()
}

function date(delimiter = "") {
    return new Date().toLocaleDateString().split("/").map(s => s.length < 2 ? "0" + s : s).join(delimiter)
}


const fgColors = ["black", "red", "green", "yellow", "blue", "magenta", "cyan", "white", "gray", "grey"]
const bgColors = ["bgBlack", "bgRed", "bgGreen", "bgYellow", "bgBlue", "bgMagenta", "bgCyan", "bgWhite"]
const efColors = ["bold", "dim", "italic", "underline", "inverse", "hidden", "strikethrough"]
const extColors = ["rainbow", "zebra", "america", "trap", "random", "zalgo"]

function colorize(str, colors) {
    if (!Array.isArray(colors)) colors = [colors]
    let fg = colors.filter(color => fgColors.includes(color)),
        bg = colors.filter(color => bgColors.includes(color)),
        ef = colors.filter(color => efColors.includes(color)),
        ext = colors.filter(color => extColors.includes(color))
    fg = fg[fg.length - 1], bg = bg[bg.length - 1], ef = ef[ef.length - 1], ext = ext[ext.length - 1]
    let pre = [], suf = []
    if (ext) return str[ext]
    function sp(s) {
        let r = []
        for (let i of s.matchAll(/\x1b\[(\d+)m/g)) r.push(i[1])
        return r
    }
    if (ef) { let p = sp(""[ef]); pre.push(p[0]), suf.push(p[1]) }
    if (bg) { let p = sp(""[bg]); pre.push(p[0]), suf.push(p[1]) }
    if (fg) { let p = sp(""[fg]); pre.push(p[0]), suf.push(p[1]) }
    if (pre.length) return "\x1b[" + pre.join(";") + "m" + str + "\x1b[" + suf.reverse().join(";") + "m"
    else return str
}

function getLogger(onlyConsole = false) {
    const log4js = require('log4js');

    let logger_default, logger_error;

    const _layout = {
        type: 'pattern',
        pattern: '[%d{yyyy-MM-dd hh:mm:ss}] [%p] %x{m#uncolor}',
        tokens: {
            "m#uncolor": (logEvent) => {
                const message = (logEvent.data || []).join(' ');
                return message.replace(/\u001b\[\d+m/g, '');
            }
        }
    }

    if (isEnvDev || onlyConsole) {
        log4js.configure({
            appenders: {
                console: {
                    type: 'console',
                    layout: {
                        type: 'pattern',
                        pattern: '[%d{yyyy-MM-dd hh:mm:ss}] '.gray + '%[[%p]%] '.bold + '%m',
                    }
                }
            },
            categories: {
                default: { appenders: ['console'], level: 'debug' }
            }
        });
        logger_default = log4js.getLogger()
    } else {
        log4js.configure({
            appenders: {
                console: {
                    type: 'console',
                    layout: {
                        type: 'pattern',
                        pattern: '[%d{yyyy-MM-dd hh:mm:ss}] '.gray + '%[[%p]%] '.bold + '%m',
                    }
                },
                file: {
                    type: 'dateFile',
                    filename: path.join(__dirname, `./logs/app.${date()}.log`),
                    pattern: '.part.yyyyMMdd',
                    maxLogSize: 10 * 1024 * 1024,
                    layout: _layout
                },
                error_file: {
                    type: 'dateFile',
                    filename: path.join(__dirname, `./logs/error/error.${date()}.log`),
                    pattern: '.part.yyyyMMdd',
                    maxLogSize: 10 * 1024 * 1024,
                    layout: _layout
                }
            },
            categories: {
                default: { appenders: ['file', 'console'], level: 'debug' },
                error: { appenders: ['error_file'], level: 'error' }
            }
        });
        logger_default = log4js.getLogger()
        logger_error = log4js.getLogger('error');
    }

    class logger {
        /**
         * @param {string} prefix 
         * @param {keyof Color | (keyof Color)[]} prefixColor 
         * @param {string[]} _presetGroup
         */
        constructor(prefix, prefixColor, _presetGroup) {
            if (typeof prefixColor === "string") prefixColor = [prefixColor]
            if (!Array.isArray(prefixColor)) prefixColor = []
            if (!(_presetGroup && _presetGroup.length > 0)) _presetGroup = []
            this.prefixGroup = _presetGroup
            if (prefixColor.length && prefix)
                this.prefixGroup.push(colorize("[", prefixColor) + colorize(prefix, prefixColor) + colorize("]", prefixColor))
            else if (prefix)
                this.prefixGroup.push(`[${prefix}]`)

            const _this = this;
            log4js.levels.levels.forEach(level => {
                const lvName = level.levelStr.toLowerCase();
                _this[lvName] = (...args) => {
                    if (logger_default) logger_default[lvName](..._this.prefixGroup, ...args);
                    if (logger_error) logger_error[lvName](..._this.prefixGroup, ...args);
                }
            });
        }
        log = (...args) => console.log(...args)
        /**
         * @param {string} prefix 
         * @param {(keyof Color | (keyof Color)[])[]} colors
         */
        setPrefix(prefix, ...colors) {
            let _colors = []
            colors.forEach(color => {
                if (Array.isArray(color)) _colors = _colors.concat(color)
                else _colors.push(color)
            })
            return new logger(prefix, _colors, Array.from(this.prefixGroup));
        }
    };

    return new logger();
}

module.exports = {
    getLogger,
    defaultLogger() {
        return getLogger(false);
    },
    consoleLogger() {
        return getLogger(true);
    }
}