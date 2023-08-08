import "@css/_components/resourcelist.scss"

import { httpRequest, querystring, sizeWithWeight } from "../_src/utils.mjs"
import { Toast } from "../_src/toast.mjs"
import { createApp } from "../_src/third-parties/vue.esm-bundler.js"


/**
 * Creates a Bootstrap tooltip for the given element with the specified position and content.
 * @param {HTMLElement} element - The element to attach the tooltip to.
 * @param {'top' | 'bottom' | 'left' | 'right'} position - The position of the tooltip relative to the element.
 * @param {string} content - The content of the tooltip.
 * @param {Object} [options] - Optional configuration options for the tooltip.
 * @param {boolean} [options.flexible=false] - Whether the tooltip has a flexible width.
 * @param {boolean} [options.extendRight=false] - Whether to extend the tooltip to the right instead of left and right. It will override the `flexible` option to `true`. Only works when the position is `top` or `bottom`.
 * @param {boolean} [options.html=false] - Whether the content of the tooltip is HTML.
 */
function createTooltip(element, position, content, options = { flexible: false, extendRight: false, html: false }) {
    if (options.extendRight) options.flexible = true
    let opts = {
        flexible: typeof options.flexible === "boolean" ? options.flexible : false,
        extendRight: typeof options.extendRight === "boolean" ? options.extendRight : false,
        html: typeof options.html === "boolean" ? options.html : false
    }
    const _DOM = element
    _DOM.setAttribute("data-bs-toggle", "tooltip")
    _DOM.setAttribute("data-bs-placement", position)
    _DOM.setAttribute("data-bs-title", content)
    _DOM.setAttribute("data-bs-html", opts.html ? "true" : "false")

    let custom_class_list = []
    if (opts.flexible && !opts.extendRight) custom_class_list.push("tooltip-max-content")
    if (custom_class_list.length)
        _DOM.setAttribute("data-bs-custom-class", custom_class_list.join(" "))

    const ctl = new bootstrap.Tooltip(_DOM)
    ctl.show()
    if (opts.extendRight) {
        // Extend the tooltip to the right only when the position is top or bottom
        // This step must be taken after it updates automatically (the automatical default is extend both)
        let _itvid = setInterval(() => {
            if (ctl.tip) {
                ctl.tip.classList.add("tooltip-max-content")
                let placement = ctl._popper.state.placement
                if (placement !== "top" && placement !== "bottom")
                    ctl._popper.update()// readjust the position
                clearInterval(_itvid)
            }
        }, 1)
    }
    // Dispose tooltip when mouseleave
    const disposeListener = () => {
        _DOM.removeAttribute("data-bs-toggle")
        _DOM.removeAttribute("data-bs-placement")
        _DOM.removeAttribute("data-bs-title")
        _DOM.removeAttribute("data-bs-html")
        _DOM.removeAttribute("data-bs-custom-class")
        ctl.dispose()
        _DOM.removeEventListener("mouseleave", disposeListener)
    }
    _DOM.addEventListener("mouseleave", disposeListener)
}

function getCookie(name) {
    let cookie = document.cookie
    let cookieArr = cookie.split("; ")
    for (let i = 0; i < cookieArr.length; i++) {
        let arr = cookieArr[i].split("=")
        if (arr[0] === name) return arr[1]
    }
    return ""
}

function getUID() {
    return getCookie("uid")
}

let _logged = false
async function getData() {
    return await new Promise((resolve, reject) => {
        httpRequest.post({
            url: 'api/info/drive/sharezone',
            contentType: "application/x-www-form-urlencoded",
            responseType: "json",
            callback(xhr) {
                if (xhr.status === 200 && xhr.response.code === 0) {
                    const data = xhr.response.data
                    _logged = xhr.response.logged
                    for (let d of data) {
                        d.size = sizeWithWeight(d.size)
                        d.shareTime = new Date(d.shareTime).toLocaleDateString().split("/").map(s => s.length < 2 ? "0" + s : s).join("-")
                        d.shared = true
                        d.isOriOwn = d.isOwn
                    }
                    resolve({
                        msg: xhr.response.msg,
                        type: "success",
                        data: data,
                        logged: _logged
                    })
                } else if (xhr.status === 200 && xhr.response.code === -2) {
                    resolve({
                        msg: xhr.response.msg,
                        type: "warn",
                        data: [],
                        logged: _logged
                    })
                } else resolve({
                    msg: xhr.response.msg,
                    type: "error",
                    data: [],
                    logged: _logged
                })
            },
            timeout() {
                resolve({
                    msg: "请求超时",
                    type: "error",
                    data: [],
                    logged: _logged
                })
            },
            error() {
                resolve({
                    msg: "数据请求失败",
                    type: "error",
                    data: [],
                    logged: _logged
                })
            }
        })
    })
}

document.addEventListener("DOMContentLoaded", async () => {
    let _onUpdateList = true;
    let downloadRequestHashPool = []; // 下载请求哈希池，用于防止同一时间对同一hash的重复请求
    let storeRequestHashPool = []; // 存储请求哈希池，用于防止同一时间对同一hash的重复请求
    let shareRequestHashPool = []; // 分享请求哈希池，用于防止同一时间对同一hash的重复请求
    const __data = (await getData().catch(e => _onUpdateList = false)).data.reverse()
    _onUpdateList = false
    createApp({
        data() {
            return {
                logged: _logged,
                files: __data
            }
        },
        methods: {
            async updateList(preventSuccessToast = false) {
                preventSuccessToast = (typeof preventSuccessToast === "boolean" || typeof preventSuccessToast === "undefined") ? !!preventSuccessToast : false

                if (_onUpdateList) return Toast.single("已发送请求，请稍后再试", "warn")
                _onUpdateList = true

                const res = (await getData().catch(e => _onUpdateList = false))
                if (res.type !== "success") Toast.single(res.msg, res.type)
                else {
                    if (!preventSuccessToast) Toast.single("刷新成功", "success")
                    this.files = res.data.reverse()
                }

                _onUpdateList = false
            },
            tooltipTd(e) {
                // is ellipsis
                if (e.target.scrollWidth > e.target.clientWidth) {
                    createTooltip(e.target, "top", e.target.innerText, { extendRight: true, html: false })
                }
            },
            tooltipStoreOwn(e, fn) {
                createTooltip(e.target, "top", `<b>你已拥有相同的文件：</b>${fn}`, { flexible: true, html: true })
            },
            download(hash, uploader_uid) {
                if (downloadRequestHashPool.includes(hash)) return
                downloadRequestHashPool.push(hash)
                const _this = this
                httpRequest.post({
                    url: `/api/action/dl/sharezone/link`,
                    data: querystring.stringify({ uid: uploader_uid, hash: hash, s: 1 }),
                    contentType: "application/x-www-form-urlencoded",
                    responseType: "json",
                    callback(xhr) {
                        if (xhr.status === 200 && xhr.response.code === 0) {
                            window.open(xhr.response.data.uri, "_blank")
                        } else if (xhr.status === 200 && xhr.response.code === -2) {
                            Toast.single(xhr.response.msg, "warn")
                        } else {
                            Toast.single(xhr.response.msg, "error")
                        }
                        // end download file function
                        downloadRequestHashPool.splice(downloadRequestHashPool.indexOf(hash), 1)
                    },
                    timeout() {
                        Toast.single("与服务器通信超时", "error")
                        downloadRequestHashPool.splice(downloadRequestHashPool.indexOf(hash), 1)
                    },
                    error() {
                        Toast.single("下载失败", "error")
                        downloadRequestHashPool.splice(downloadRequestHashPool.indexOf(hash), 1)
                    }
                })
            },
            setStore(hash, uploader_uid, sotreOrCancel) {
                if (storeRequestHashPool.includes(hash)) return
                storeRequestHashPool.push(hash)
                const _this = this
                if (sotreOrCancel) {
                    httpRequest.post({
                        url: 'api/action/drive/store',
                        data: querystring.stringify({ hash: hash, uid: uploader_uid }),
                        contentType: "application/x-www-form-urlencoded",
                        responseType: "json",
                        callback(xhr) {
                            if (xhr.status === 200 && xhr.response.code === 0) {
                                Toast.single(xhr.response.msg, "success")
                                for (let i = 0; i < _this.files.length; i++) {
                                    if (_this.files[i].hash === hash) {
                                        _this.files[i].isOwn = true;
                                        break;
                                    }
                                }
                            } else if (xhr.status === 200 && xhr.response.code === -2) {
                                Toast.single(xhr.response.msg, "warn")
                            } else {
                                Toast.single(xhr.response.msg, "error")
                            }
                            // end store file function
                            storeRequestHashPool.splice(storeRequestHashPool.indexOf(hash), 1)
                        },
                        timeout() {
                            Toast.single("与服务器通信超时", "error")
                            storeRequestHashPool.splice(storeRequestHashPool.indexOf(hash), 1)
                        },
                        error() {
                            Toast.single("转存失败", "error")
                            storeRequestHashPool.splice(storeRequestHashPool.indexOf(hash), 1)
                        }
                    })
                } else {
                    httpRequest.post({
                        url: 'api/action/drive/remove',
                        data: querystring.stringify({ uid: getUID(), hash: hash }),
                        contentType: "application/x-www-form-urlencoded",
                        responseType: "json",
                        callback(xhr) {
                            if (xhr.status === 200 && xhr.response.code === 0) {
                                Toast.single("操作成功", "success")
                                for (let i = 0; i < _this.files.length; i++) {
                                    if (_this.files[i].hash === hash) {
                                        _this.files[i].isOwn = false;
                                        break;
                                    }
                                }
                            } else if (xhr.status === 200 && xhr.response.code === -2) {
                                Toast.single(xhr.response.msg, "warn")
                            } else {
                                Toast.single(xhr.response.msg, "error")
                            }
                            // end remove file function
                            storeRequestHashPool.splice(storeRequestHashPool.indexOf(hash), 1)
                        },
                        timeout() {
                            Toast.single("与服务器通信超时", "error")
                            storeRequestHashPool.splice(storeRequestHashPool.indexOf(hash), 1)
                        },
                        error() {
                            Toast.single("操作失败", "error")
                            storeRequestHashPool.splice(storeRequestHashPool.indexOf(hash), 1)
                        }
                    })
                }
            },
            store(hash, uploader_uid) {
                if (storeRequestHashPool.includes(hash)) return Toast.single("正在转存，请稍后", "warn")
                return this.setStore(hash, uploader_uid, true)
            },
            cancelStore(hash, uploader_uid) {
                if (storeRequestHashPool.includes(hash)) return Toast.single("正在取消，请稍后", "warn")
                return this.setStore(hash, uploader_uid, false)
            },
            setShare(hash, share) {
                if (shareRequestHashPool.includes(hash)) return
                shareRequestHashPool.push(hash)
                const _this = this
                httpRequest.post({
                    url: 'api/action/drive/setshare',
                    data: querystring.stringify({ uid: getUID(), hash: hash, share: share ? 1 : 0 }),
                    contentType: "application/x-www-form-urlencoded",
                    responseType: "json",
                    callback(xhr) {
                        if (xhr.status === 200 && xhr.response.code === 0) {
                            Toast.single(xhr.response.msg, "success")
                            for (let i = 0; i < _this.files.length; i++) {
                                if (_this.files[i].hash === hash) {
                                    _this.files[i].shared = share;
                                    break;
                                }
                            }
                        } else if (xhr.status === 200 && xhr.response.code === -2) {
                            Toast.single(xhr.response.msg, "warn")
                        } else {
                            Toast.single(xhr.response.msg, "error")
                        }
                        shareRequestHashPool.splice(shareRequestHashPool.indexOf(hash), 1)
                    },
                    timeout() {
                        Toast.single("请求超时", "error")
                        shareRequestHashPool.splice(shareRequestHashPool.indexOf(hash), 1)
                    },
                    error() {
                        Toast.single("数据请求失败", "error")
                        shareRequestHashPool.splice(shareRequestHashPool.indexOf(hash), 1)
                    }
                })
            },
            share(hash) {
                if (shareRequestHashPool.includes(hash)) return Toast.single("已发送请求，请稍后再试", "warn")
                return this.setShare(hash, true)
            },
            unshare(hash) {
                if (shareRequestHashPool.includes(hash)) return Toast.single("已发送请求，请稍后再试", "warn")
                return this.setShare(hash, false)
            }
        }
    }).mount("#resourcelist-app")
})