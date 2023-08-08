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
            copy[key] = copyJSON(obj[key]);
        }
    }

    return copy;
}

const mergeJSON = function (target, patch, deep = false) {
    if (typeof patch !== "object") return target;
    if (!target) target = {}
    if (deep) { target = copyJSON(target), patch = copyJSON(patch); }
    for (let key in patch) {
        if (isJSON(patch[key]) && isJSON(target[key]))
            target[key] = mergeJSON(target[key], patch[key]);
        else {
            if (target[key] !== patch[key]) target[key] = patch[key];
        }
    }
    return target;
}

const content = `
<div class="toast align-items-center text-bg-{{ type }} border-0 show" role="alert" aria-live="assertive" style="pointer-events: auto;"
    aria-atomic="true">
  <div class="d-flex">
    <div class="toast-body">{{ message }}</div>
    <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
  </div>
</div>
`

const _TYPE_LIST = {
    "primary": "primary",
    "success": "success",
    "error": "danger",
    "warn": "warning"
}

let ToastQuery = {}
let toastId = 0

const HIDING_VANISH_TIME = 150
const DEFAULT_OPTIONS = { timeout: -1, id: false, autoDestroy: false }

/**
 * Creates a new toast with the specified message and type.
 * @param {string} message - The message to display in the toast.
 * @param {keyof _TYPE_LIST} [type="primary"] - The type of the toast. Can be one of "primary", "success", "error", or "warn".
 * @param {Object} [options=] - An object containing optional parameters for the toast.
 * @param {number} [options.timeout=-1] - The time in milliseconds after which the toast should automatically disappear. If set to -1, the toast will not disappear automatically.
 * @param {number} [options.id=false] - A specific ID to assign to the toast. If not specified, a unique ID will be generated.
 * @param {boolean} [options.autoDestroy=false] - Whether or not to automatically destroy the toast after it has been hidden.
 * @returns {number} The ID of the newly created toast.
 */
const createToast = (message, type = "primary", options = DEFAULT_OPTIONS) => {
    let opts = mergeJSON({}, DEFAULT_OPTIONS)
    opts = mergeJSON(opts, options)
    let timeout = opts.timeout
    const KEEP_ALIVE = timeout < 0
    const myId = typeof opts.id === "number" ? opts.id : toastId++

    // 设置容器
    const toastContianerEl = document.createElement("div");
    (c => { for (let key in c) toastContianerEl.style[key] = c[key] }).call(null, {
        "position": "fixed",
        "top": "4rem",
        "z-index": "1060",
        "display": "none",
        "pointerEvents": "none"
    })
    toastContianerEl.classList.add(..."d-flex justify-content-center align-items-center w-100".split(" "));
    toastContianerEl.innerHTML = content.replace(/{{ message }}/g, message).replace(/{{ type }}/g, _TYPE_LIST[type])

    let _firstShow = true
    function showContainer() {
        (c => { for (let key in c) toastContianerEl.style[key] = c[key] }).call(null, {
            "transform": "translateY(-4rem)",
            "opacity": "0",
            "transition": "transform 0.35s ease-out, opacity 0.35s ease-out",
            "display": "flex"
        });
        if (_firstShow) { document.body.appendChild(toastContianerEl), _firstShow = false }
        setTimeout(() => (c => { for (let key in c) toastContianerEl.style[key] = c[key] }).call(null, {
            "transform": "translateY(0)",
            "opacity": "1",
        }), 100)
    }
    if (!KEEP_ALIVE) timeout += 450 // timeout 包含容器动画显现的时间

    // 设置 Toast
    const toastEl = toastContianerEl.querySelector('.toast')
    let _opts = KEEP_ALIVE ? { autohide: false } : { autohide: true, delay: timeout }
    const toast = new bootstrap.Toast(toastEl, _opts) // 控制对象
    toast.destroy = () => { toast._element.dispatchEvent(new Event("destroy.bs.toast")) }
    ToastQuery[myId] = toast

    /*
     * show() - 显示（同时展示容器动画）
     * hide() - 隐藏（同时隐藏容器）
     * destroy() - 销毁
     */
    let _preventHide = false
    toastEl.addEventListener('show.bs.toast', () => { // Start showing
        _preventHide = true
        toastEl.style.transitionDuration = '';
        showContainer()
    })
    toastEl.addEventListener('shown.bs.toast', () => { // Shown
        _preventHide = false
    })
    toastEl.addEventListener('hide.bs.toast', () => { // Start vanishing
        toastEl.style.transitionDuration = HIDING_VANISH_TIME + 'ms';
    })
    toastEl.addEventListener('hidden.bs.toast', () => { // Vanished
        if (_preventHide) return toast._element.classList.remove('hide'), toast._element.classList.add('show');
        (c => { for (let key in c) toastContianerEl.style[key] = c[key] }).call(null, {
            "display": "none",
            "transition": "",
            "transform": "translateY(-4rem)",
            "opacity": "0"
        });
        if (opts.autoDestroy) toast.destroy()
    })
    toastEl.addEventListener('destroy.bs.toast', () => {
        toastContianerEl.remove()
        delete ToastQuery[myId]
    })

    return myId
}

/**
 * Represent a toast notification.
 * @class
 */
export class Toast {

    /**
     * Create a new Toast instance with the specified message and type.
     * @constructor
     * @param {string} message - The message to display in the toast.
     * @param {keyof _TYPE_LIST} [type="primary"] - The type of the toast. Can be one of "primary", "success", "error", or "warn".
     * @param {number} [timeout=-1] - The time in milliseconds after which the toast should automatically disappear. If set to -1, the toast will not disappear automatically.
     */
    constructor(message, type = "primary", timeout = -1) {
        this.id = createToast(message, type, { timeout, id: toastId++, autoDestroy: false })
    }

    /**
     * Show the toast.
     */
    show() {
        ToastQuery[this.id].show()
    }

    /**
     * Hide the toast.
     */
    hide() {
        ToastQuery[this.id].hide()
    }

    /**
     * Destroy the toast.
     */
    destroy() {
        ToastQuery[this.id].destroy()
    }

    /**
     * Create a new Toast instance with the specified message and type.
     * @static
     * @param {string} message - The message to display in the toast.
     * @param {keyof _TYPE_LIST} [type="primary"] - The type of the toast. Can be one of "primary", "success", "error", or "warn".
     * @param {number} [timeout=-1] - The time in milliseconds after which the toast should automatically disappear. If set to -1, the toast will not disappear automatically.
     * @returns {Toast} The newly created Toast instance.
     */
    static create(message, type = "primary", timeout = -1) {
        return new Toast(message, type, timeout)
    }

    /**
     * Show the toast with the specified ID.
     * @static
     * @param {number} id - The ID of the toast to show.
     * @throws {Error} Throws an error if the toast with the specified ID does not exist.
     */
    static show(id) {
        if (ToastQuery[id]) ToastQuery[id].show()
        else throw new Error("No such toast.")
    }

    /**
     * Hide the toast with the specified ID.
     * @static
     * @param {number} id - The ID of the toast to hide.
     * @throws {Error} Throws an error if the toast with the specified ID does not exist.
     */
    static hide(id) {
        if (ToastQuery[id]) ToastQuery[id].hide()
        else throw new Error("No such toast.")
    }

    /**
     * Destroy the toast with the specified ID.
     * @static
     * @param {number} id - The ID of the toast to destroy.
     * @throws {Error} Throws an error if the toast with the specified ID does not exist.
     */
    static destroy(id) {
        if (ToastQuery[id]) ToastQuery[id].destroy()
        else throw new Error("No such toast.")
    }

    /**
     * Create a new Toast instance with the specified message and type, and automatically destroys it after the specified timeout.
     * @static
     * @param {string} message - The message to display in the toast.
     * @param {keyof _TYPE_LIST} [type="primary"] - The type of the toast. Can be one of "primary", "success", "error", or "warn".
     * @param {number} [timeout=1500] - The time in milliseconds after which the toast should automatically disappear.
     * @returns {number} The ID of the newly created Toast instance.
     * @throws {Error} Throws an error if the specified timeout is less than or equal to 0.
     */
    static once(message, type = "primary", timeout = 1500) {
        if (timeout <= 0) throw new Error("Timeout must be greater than 0.")
        const _tid = createToast(message, type, { timeout, autoDestroy: true })
        ToastQuery[_tid].show()
        return _tid
    }

    /**
     * Create and show a single toast notification, hiding all other toasts.
     * @static
     * @param {string} message - The message to display in the toast.
     * @param {keyof _TYPE_LIST} [type="primary"] - The type of the toast. Can be one of "primary", "success", "error", or "warn".
     * @param {number} [timeout=1500] - The time in milliseconds after which the toast should automatically disappear.
     * @throws {Error} Throws an error if the specified timeout is less than or equal to 0.
     */
    static single(message, type = "primary", timeout = 1500) {
        if (timeout <= 0) throw new Error("Timeout must be greater than 0.")
        const tid = this.once(message, type, timeout)
        setTimeout(() => { for (const _tid in ToastQuery) if (Number(_tid) !== tid) ToastQuery[_tid].hide() },
            (350 - HIDING_VANISH_TIME) > 0 ? (350 - HIDING_VANISH_TIME) : 0)
    }
}