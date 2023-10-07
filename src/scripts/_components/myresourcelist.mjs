import "@css/_components/resourcelist.scss"
import "../_src/toast.mjs"

import { httpRequest, querystring, sizeWithWeight } from "../_src/utils.mjs"
import { Toast } from "../_src/toast.mjs"
import { createApp } from "../_src/third-parties/vue.esm-bundler.js"
import CryptoJS from "crypto-js"

let WAF_INFO;

const RENAME_MODAL_CONTENT = `<div class="modal fade" id="renameModal" tabindex="-1" aria-labelledby="renameModalLabel" aria-hidden="true">
    <div class="modal-dialog">
        <div class="modal-content">
            <div class="modal-header">
                <h1 class="modal-title fs-5" id="renameModalLabel">重命名文件</h1>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body">
                <form>
                    <div class="mb-3">
                        <label for="new-name" class="col-form-label">新文件名</label>
                        <input type="text" class="form-control" id="new-name">
                    </div>
                </form>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">取消</button>
                <button type="button" class="btn btn-primary" id="modal-confirm">确定</button>
            </div>
        </div>
    </div>
</div>`
function showRenameModal(ori_name, placeholder = "") {
    const containerEl = document.createElement("div")
    containerEl.innerHTML = RENAME_MODAL_CONTENT
    const modalEl = containerEl.querySelector("#renameModal")
    const inputEl = containerEl.querySelector("#new-name")
    const confirmBtnEl = containerEl.querySelector("#modal-confirm")
    const Modal = new bootstrap.Modal(modalEl, { keyboard: true, backdrop: "static" })

    inputEl.placeholder = placeholder
    inputEl.value = ori_name
    return new Promise((resolve, reject) => {
        function recall() { return new Promise((_resolve, _reject) => { resolve = _resolve; reject = _reject; }) }

        // bind input listener
        inputEl.addEventListener("input", function (e) {
            e.target.value = e.target.value.replace(/[\\\/\:\*\"\'\<\>\|\?\x00-\x1F\x7F]/gi, "")
        })

        // bind enter key event
        let lockClick = false;
        inputEl.addEventListener("keydown", function (e) {
            if (e.keyCode === 13 && !lockClick) {
                lockClick = true;
                confirmBtnEl.click();
            }
        })
        inputEl.addEventListener("keyup", function (e) {
            lockClick = false;
        })

        // bind modal show event
        modalEl.addEventListener("show.bs.modal", function (e) {
            document.body.appendChild(containerEl)
            inputEl.focus()
        })

        // bind modal hide event
        let _confirmed = false;
        modalEl.addEventListener("hide.bs.modal", function (e) {
            if (!_confirmed) {
                const _obj = { goOn: false, recall, end() { _obj.goOn = false } }
                resolve(_obj)
            }
        })

        modalEl.addEventListener("hidden.bs.modal", function (e) {
            containerEl.remove()
        })

        // bind confirm button event
        confirmBtnEl.addEventListener("click", function (e) {
            inputEl.value = trimFn(inputEl.value)
            let _msg = fileWaf(inputEl.value)
            if (typeof _msg === "string") return Toast.single(_msg, "warn")
            if (inputEl.value === ori_name) return Toast.single("文件名未改变", "warn")

            _confirmed = true;
            const _obj = { goOn: true, newName: inputEl.value, recall, end() { _obj.goOn = false; Modal.hide() } }
            resolve(_obj)
        })

        Modal.show()
    })

}


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

function fileWaf(filename, filesize) {
    if (typeof filename !== "string") return "文件名不合法"
    if (filename.length < 1) return "文件名不能为空"
    else if (filename.length > WAF_INFO.fn_maxlen) return `文件名过长，最长为 ${WAF_INFO.fn_maxlen} 个字符`
    else if (/[\\\/\:\*\"\'\<\>\|\?\x00-\x1F\x7F]/gi.test(filename)) {
        return "文件名不合法"
    }
    if (typeof filesize !== "undefined" && parseFloat(filesize) > WAF_INFO.file_maxsize) {
        return `文件大小超过限制，最大为 ${sizeWithWeight(WAF_INFO.file_maxsize)}`
    }
    return false
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

function formatDataPiece(data_piece) {
    data_piece.size = sizeWithWeight(data_piece.size)
    data_piece.uploadTime = new Date(data_piece.uploadTime).toLocaleDateString().split("/").map(s => s.length < 2 ? "0" + s : s).join("-")
    return data_piece
}

function formatData(data) {
    for (let d of data) d = formatDataPiece(d)
    return data
}

async function getData(status = {}) {
    return await new Promise((resolve, reject) => {
        httpRequest.post({
            url: 'api/info/drive/user',
            data: querystring.stringify({ uid: getUID() }),
            contentType: "application/x-www-form-urlencoded",
            responseType: "json",
            callback(xhr) {
                if (xhr.status === 200 && xhr.response.code === 0) {
                    resolve({
                        msg: xhr.response.msg,
                        type: "success",
                        data: formatData(xhr.response.data)
                    })
                } else if (xhr.status === 200 && xhr.response.code === -2) {
                    resolve({
                        msg: xhr.response.msg,
                        type: "warn",
                        data: []
                    })
                } else resolve({
                    msg: xhr.response.msg,
                    type: "error",
                    data: []
                })
            },
            timeout() {
                resolve({
                    msg: "请求超时",
                    type: "error",
                    data: []
                })
            },
            error() {
                resolve({
                    msg: "数据请求失败",
                    type: "error",
                    data: []
                })
            }
        })
    })
}

document.addEventListener("DOMContentLoaded", async () => {
    WAF_INFO = JSON.parse(atob(document.querySelector("[data-waf-info]").dataset["wafInfo"]));

    let _onUpdateList = true, _onUploading = false;
    let downloadRequestHashPool = []; // 下载请求哈希池，用于防止同一时间对同一hash的重复请求
    let renameRequestHashPool = []; // 重命名请求哈希池，用于防止同一时间对同一hash的重复请求
    let removeRequestHashPool = []; // 删除请求哈希池，用于防止同一时间对同一hash的重复请求
    let shareRequestHashPool = []; // 分享请求哈希池，用于防止同一时间对同一hash的重复请求
    _onUpdateList = false
    const app = createApp({
        data() {
            return {
                files: []
            }
        },
        methods: {
            async updateList(preventSuccessToast = false) {
                preventSuccessToast = (typeof preventSuccessToast === "boolean" || typeof preventSuccessToast === "undefined") ? !!preventSuccessToast : false

                if (_onUpdateList) return Toast.single("正在更新列表，请稍后再试", "warn")
                if (_onUploading) return Toast.single("正在上传文件，请稍后再试", "warn")
                _onUpdateList = true

                const res = (await getData().catch(e => _onUpdateList = false))
                if (res.type !== "success") Toast.single(res.msg, res.type)
                else {
                    if (!preventSuccessToast) {
                        Toast.single("刷新成功", "success")
                    }
                    this.files = res.data.reverse()
                }

                _onUpdateList = false
            },
            clickUpload() {
                if (_onUploading) {
                    return Toast.single("正在上传文件，请稍后再试", "warn")
                }
                document.getElementById('upload-file').click()
            },
            tooltipTd(e) {
                // is ellipsis
                if (e.target.scrollWidth > e.target.clientWidth) {
                    createTooltip(e.target, "top", e.target.innerText, { extendRight: true, html: false })
                }
            },
            /**
             * Calculates the SHA256 hash of a given file.
             * @param {File} file - The file to calculate the hash for.
             * @returns {Promise<string>} A promise that resolves with the calculated hash as a string.
             */
            calcFileHash(file) {
                return new Promise((resolve, reject) => {
                    const reader = new FileReader()
                    reader.readAsArrayBuffer(file)
                    reader.onload = () => {
                        const buffer = reader.result
                        const hash = CryptoJS.SHA256(CryptoJS.lib.WordArray.create(buffer))
                        resolve(hash.toString())
                    }
                })
            },
            async uploadFile() {
                if (_onUploading) return
                const _btn_dom = document.querySelector('#resourcelist-btn[data-func=upload]')
                const _ori_text = _btn_dom.innerText
                function endUpload() {
                    _onUploading = false
                    _btn_dom.innerText = _ori_text
                    _btn_dom.classList.remove("disabled")
                    inputEl.value = ''
                }
                const inputEl = document.getElementById('upload-file')

                // 暂时只支持单文件上传
                const file = inputEl.files[inputEl.files.length - 1]


                // WAF
                let _msg = fileWaf(file.name, file.size)
                if (typeof _msg === "string") {
                    endUpload()
                    return Toast.single(_msg, "warn")
                }
                /* for (let f in this.files) { // 防止重复上传
                    if (this.files[f].name === file.name) {
                        endUpload()
                        return Toast.single("已存在相同文件名的文件", "warn")
                    }
                } */

                // start uploading
                _onUploading = true
                _btn_dom.innerText = "正在上传"
                _btn_dom.classList.add("disabled")
                const _this = this

                // verify file hash
                const hash = await this.calcFileHash(file)
                for (let f in this.files) { // 防止重复上传
                    if (this.files[f].hash === hash) {
                        endUpload()
                        return Toast.single("文件已存在", "warn")
                    }
                }
                if (typeof hash !== "string") {
                    inputEl.value = ''
                    Toast.single("文件读取失败", "error")
                    return endUpload()
                }
                let canFastUploadStatus = await new Promise((resolve, reject) => {
                    // 0: 秒传成功，无需提交文件上传
                    // 1: 不能够秒传，需要提交文件上传
                    // -1: 出错，终止上传
                    httpRequest.post({
                        url: 'api/action/drive/upload/check',
                        data: JSON.stringify({ hash, fn: file.name, autoup: 1 }),
                        contentType: "application/json",
                        responseType: "json",
                        callback(xhr) {
                            const res = xhr.response || {}
                            if (xhr.status === 200 && res.code === 0) {

                                if (res.data.exist) { // 能够秒传
                                    if (res.data.autoup.uploaded) { // 秒传成功
                                        Toast.single(res.data.autoup.msg, "success")
                                        _this.files.unshift(formatDataPiece(res.data.autoup.data))
                                        return resolve(0)
                                    }
                                } else {
                                    return resolve(1) // 不能够秒传
                                }

                            } else if (xhr.status === 200 && res.code === -2) {
                                Toast.single(res.msg, "warn")
                                return resolve(-1)
                            } else {
                                Toast.single(res.msg, "error")
                                return resolve(-1)
                            }
                        },
                        error() {
                            Toast.single("上传失败", "error")
                            return resolve(-1)
                        },
                        timeout() {
                            Toast.single("数据请求超时", "error")
                            return resolve(-1)
                        }
                    })
                })

                if (canFastUploadStatus === 0 || canFastUploadStatus === -1) {
                    return endUpload()
                }

                // upload file

                let formData = new FormData()
                formData.append(file.name, file)

                httpRequest.post({
                    url: 'api/action/drive/upload/file',
                    data: formData,
                    responseType: "json",
                    callback(xhr) {
                        const res = xhr.response || {}
                        if (xhr.status === 200 && res.code === 0) {
                            // console.log("upload success")
                            _this.files.unshift(formatDataPiece(res.data))
                            Toast.single(res.msg, "success")
                        } else if (xhr.status === 200 && res.code === -2) {
                            // console.log("file alreay exists")
                            Toast.single(res.msg, "warn")
                        } else {
                            // console.log("upload failed")
                            Toast.single(res.msg, "error")
                        }
                        // end upload
                        endUpload()
                    },
                    error() {
                        Toast.single("上传失败", "error")
                        // end upload
                        endUpload()
                    },
                    timeout() {
                        Toast.single("数据请求超时", "error")
                        // end upload
                        endUpload()
                    }
                })
            },
            download(hash) {
                if (downloadRequestHashPool.includes(hash)) return
                downloadRequestHashPool.push(hash)
                const _this = this
                httpRequest.post({
                    url: `/api/action/dl/myresources/link`,
                    data: querystring.stringify({ uid: getUID(), hash: hash }),
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
            async clickRename(hash, ori_fn) {
                if (renameRequestHashPool.includes(hash)) return

                let data = await showRenameModal(ori_fn)
                while (data.goOn) {
                    let success = await this.renameFile(hash, data.newName)
                    if (success) {
                        data.end();
                        // data.goOn = false;
                        break;
                    }
                    else data = await data.recall()
                }
            },
            async renameFile(hash, newName) {
                return await new Promise((resolve, reject) => {
                    if (renameRequestHashPool.includes(hash)) return

                    newName = trimFn(newName)

                    let _msg = fileWaf(newName)
                    if (typeof _msg === "string") {
                        return Toast.single(_msg, "warn")
                    }

                    renameRequestHashPool.push(hash)

                    const _this = this
                    httpRequest.post({
                        url: 'api/action/drive/rename',
                        data: JSON.stringify({ uid: getUID(), hash: hash, new: newName }),
                        contentType: "application/json",
                        responseType: "json",
                        callback(xhr) {
                            let _success = false
                            if (xhr.status === 200 && xhr.response.code === 0) {
                                _success = true
                                Toast.single(xhr.response.msg, "success")
                                for (let f of _this.files) {
                                    if (f.hash === hash) {
                                        f.name = newName
                                        break
                                    }
                                }
                            } else if (xhr.status === 200 && xhr.response.code === -2) {
                                Toast.single(xhr.response.msg, "warn")
                            } else {
                                Toast.single(xhr.response.msg, "error")
                            }
                            // end rename file function
                            renameRequestHashPool.splice(renameRequestHashPool.indexOf(hash), 1)
                            resolve(_success)
                        },
                        timeout() {
                            Toast.single("与服务器通信超时", "error")
                            renameRequestHashPool.splice(renameRequestHashPool.indexOf(hash), 1)
                            resolve(false)
                        },
                        error() {
                            Toast.single("重命名失败", "error")
                            renameRequestHashPool.splice(renameRequestHashPool.indexOf(hash), 1)
                            resolve(false)
                        }
                    })
                })
            },
            removeFile(hash) {
                if (removeRequestHashPool.includes(hash)) return
                removeRequestHashPool.push(hash)
                const _this = this
                httpRequest.post({
                    url: 'api/action/drive/remove',
                    data: querystring.stringify({ uid: getUID(), hash: hash }),
                    contentType: "application/x-www-form-urlencoded",
                    responseType: "json",
                    callback(xhr) {
                        if (xhr.status === 200 && xhr.response.code === 0) {
                            Toast.single(xhr.response.msg, "success")
                            _this.files.splice(_this.files.findIndex(item => item.hash === hash), 1)
                        } else if (xhr.status === 200 && xhr.response.code === -2) {
                            Toast.single(xhr.response.msg, "warn")
                        } else {
                            Toast.single(xhr.response.msg, "error")
                        }
                        // end remove file function
                        removeRequestHashPool.splice(removeRequestHashPool.indexOf(hash), 1)
                    },
                    timeout() {
                        Toast.single("与服务器通信超时", "error")
                        removeRequestHashPool.splice(removeRequestHashPool.indexOf(hash), 1)
                    },
                    error() {
                        Toast.single("下载失败", "error")
                        removeRequestHashPool.splice(removeRequestHashPool.indexOf(hash), 1)
                    }
                })
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
                                    _this.files[i].shared = share
                                    break
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
                if (shareRequestHashPool.includes(hash))
                    return Toast.single("已发送请求，请稍后再试", "warn")
                return this.setShare(hash, true)
            },
            unshare(hash) {
                if (shareRequestHashPool.includes(hash))
                    return Toast.single("已发送请求，请稍后再试", "warn")
                return this.setShare(hash, false)
            }
        }
    }).mount("#resourcelist-app")
    app.updateList(true)
})