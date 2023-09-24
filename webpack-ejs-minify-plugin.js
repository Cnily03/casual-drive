"use strict";
require("colors");
const fs = require('fs');
const path = require("path");
const Terser = require("html-minifier-terser");
const minify = Terser.minify;

function isJSON(obj) {
    return typeof obj === "object" && Object.prototype.toString.call(obj).toLowerCase() === "[object object]" && !obj.length;
}

function copyJSON(obj) {
    if (typeof obj !== "object" || obj === null) {
        if (Array.isArray(obj)) return Array.from(obj);
        else return obj;
    }

    const copy = Array.isArray(obj) ? [] : {};

    for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            Object.defineProperty(copy, key, {
                value: copyJSON(obj[key]),
                enumerable: true,
                writable: true,
                configurable: true
            });
        }
    }

    return copy;
}

const mergeJSON = function (target, patch, deep = false) {
    if (typeof patch !== "object") return target;
    if (!target) target = {}
    if (deep) { target = copyJSON(target), patch = copyJSON(patch); }
    for (let key in patch) {
        if (key === "__proto__" || key === "constructor" || key === "prototype") continue;
        if (isJSON(patch[key]) && isJSON(target[key]))
            target[key] = mergeJSON(target[key], patch[key]);
        else {
            if (target[key] !== patch[key]) target[key] = patch[key];
        }
    }
    return target;
}

const sizeWithWeight = (size) => {
    if (isNaN(size) || size <= 0) return "0"
    let weight = 'Bytes'
    if (size <= 1) size = Math.round(size * 100) / 100, weight = 'bits'
    if (size >= 1000) size = Math.round(size / 1024 * 100) / 100, weight = 'KB'
    if (size >= 1000) size = Math.round(size / 1024 * 100) / 100, weight = 'MB'
    if (size >= 1000) size = Math.round(size / 1024 * 100) / 100, weight = 'GB'
    if (size >= 1000) size = Math.round(size / 1024 * 100) / 100, weight = 'TB'
    return `${size} ${weight}`
}

/**
 * A class that represents a plugin for minifying EJS content in a webpack build.
 */
class MinifyEJSContent {

    /**
     * Creates a new instance of the MinifyEJSContent class.
     * @param {Object} opts - An object containing configuration options for the plugin.
     * @param {string} opts.entryDir - The directory containing the EJS files to minify.
     * @param {string} opts.outDir - The directory to output the minified EJS files to.
     * @param {RegExp} [opts.test=/\.ejs$/] - A regular expression used to test which files to minify.
     * @param {Terser.Options} [opts.minify=] - An object containing options to pass to the html-minifier-terser library.
     */
    constructor(opts) {
        this.config = opts;
        this.init(opts);
    }

    init(config) {
        this.config.minify = config.minify || {};
        this.config.test = config.test || /\.ejs$/;

        if (typeof this.config.include === "undefined") this.config.include = [];
        if (!Array.isArray(this.config.include)) this.config.include = [this.config.include];
        this.config.include = this.config.include.map(v => RegExp(v));

        if (typeof this.config.exclude === "undefined") this.config.exclude = [];
        if (!Array.isArray(this.config.exclude)) this.config.exclude = [this.config.exclude];
        this.config.exclude = this.config.exclude.map(v => RegExp(v));

    }

    /**
     * @param {import("webpack").Compiler} compiler 
     */
    apply(compiler) {
        const config = this.config;
        compiler.hooks.emit.tapPromise("MinifyEJSContent", compilation => {
            function isInclude(filepath) {
                if (config.include.length === 0) return true;
                for (let reg of config.include) {
                    if (reg.test(filepath)) return true;
                }
                return false;
            }
            function isExclude(filepath) {
                for (let reg of config.exclude) {
                    if (reg.test(filepath)) return true;
                }
                return false;
            }
            let processPaths = [];
            let ori_allsize = 0, new_allsize = 0;
            let outputs = []
            async function work(compileFilePath) {
                const inpath = path.resolve(`${config.entryDir}/${compileFilePath}`),
                    outpath = path.resolve(`${config.outDir}/${compileFilePath}`);
                const in_data = fs.readFileSync(inpath, "utf-8")
                const out_data = await minify(in_data, config.minify);

                // create file and dir if not exists
                let outFullDir = path.dirname(outpath);
                if (!fs.existsSync(outFullDir)) fs.mkdirSync(outFullDir, { recursive: true });

                // write file
                fs.writeFileSync(outpath, out_data)

                let _ori_size = fs.statSync(inpath).size,
                    _new_size = Buffer.byteLength(out_data, 'utf8')
                ori_allsize += _ori_size, new_allsize += _new_size
                let ori_size = sizeWithWeight(_ori_size),
                    new_size = sizeWithWeight(_new_size)
                outputs.push(`  asset ` + `${config.entryDir}/${compileFilePath}`.green.bold + ` ${ori_size} -> ${new_size}`);
            }
            async function workThrough(entryDir, outDir) {
                const files = fs.readdirSync(entryDir);
                await Promise.all(files.map(filepath => !async function () {
                    const stats = fs.statSync(entryDir + "/" + filepath)
                    if (stats.isDirectory()) {
                        await workThrough(entryDir + "/" + filepath, outDir + "/" + filepath);
                    } else if (config.test.test(filepath)) {
                        let compileFilePath = entryDir.replace(path.resolve(config.entryDir), "") + "/" + filepath
                        if (compileFilePath.startsWith("/")) compileFilePath = compileFilePath.substring(1)
                        if (!isInclude(compileFilePath)) return;
                        if (isExclude(compileFilePath)) return;

                        processPaths.push(compileFilePath);
                    }
                }()))
            }
            async function main() {
                await workThrough(path.resolve(config.entryDir), path.resolve(config.outDir));
                await Promise.all(processPaths.map(work));
                console.log(`assets of EJS files ${sizeWithWeight(ori_allsize)} -> ${sizeWithWeight(new_allsize)}`);
                outputs.forEach(v => console.log(v));
            }
            return main();
        });
    }
}


module.exports = MinifyEJSContent;
