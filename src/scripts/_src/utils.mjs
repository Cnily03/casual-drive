export const httpRequest = {
    /**
     * {url, responseType, callback, timeout}
     * @param {Object} json
     * @param {string} json.url
     * @param {"text" | "json" | "document" | "blob" | "arraybuffer"} json.responseType
     * @param {(this:XMLHttpRequest, xhr:XMLHttpRequest)=>any} json.callback
     * @param {(this:XMLHttpRequest, xhr:XMLHttpRequest)=>any} json.timeout
     * @param {(this:XMLHttpRequest, xhr:XMLHttpRequest)=>any} json.error
     * @returns {void}
     */
    get: json => {
        const f_url = json.url.replace(/\\/g, "/");
        const xhr = new XMLHttpRequest();
        xhr.open("GET", f_url, true);
        xhr.responseType = json.responseType || "text";
        xhr.onload = () => {
            json.callback.bind(xhr)(xhr);
        };
        xhr.ontimeout = () => {
            json.timeout.bind(xhr)(xhr);
        };
        xhr.onerror = () => {
            json.error.bind(xhr)(xhr);
        };
        xhr.send();
    },
    /**
     * {url, data, contentType, responseType, callback, timeout}
     * @param {Object} json
     * @param {string} json.url
     * @param {string | FormData} json.data
     * @param {string} json.contentType
     * @param {"text" | "json" | "document" | "blob" | "arraybuffer"} json.responseType
     * @param {(this:XMLHttpRequest, xhr:XMLHttpRequest)=>any} json.callback
     * @param {(this:XMLHttpRequest, xhr:XMLHttpRequest)=>any} json.timeout
     * @param {(this:XMLHttpRequest, xhr:XMLHttpRequest)=>any} json.error
     * @returns {void}
     */
    post: json => {
        const f_url = json.url.replace(/\\/g, "/");
        const xhr = new XMLHttpRequest();
        xhr.open("POST", f_url, true);
        if (json.contentType) xhr.setRequestHeader("Content-Type", json.contentType)
        xhr.responseType = json.responseType || "text";
        xhr.onload = () => {
            json.callback.bind(xhr)(xhr);
        };
        xhr.ontimeout = () => {
            json.timeout.bind(xhr)(xhr);
        };
        xhr.onerror = () => {
            json.error.bind(xhr)(xhr);
        };
        xhr.send(json.data || null);
    },
};

export const querystring = {
    parse(str) {
        let obj = {}
        str.split("&").forEach(item => {
            let arr = item.split("=")
            obj[arr[0]] = arr[1]
        })
        return obj
    },
    stringify(obj) {
        let str = ""
        for (let key in obj) {
            str += `${key}=${obj[key]}&`
        }
        return str.slice(0, -1)
    }
}

export const sizeWithWeight = (size) => {
    if (isNaN(size) || size <= 0) return "0"
    let weight = 'Bytes'
    if (size <= 1) size = Math.round(size * 100) / 100, weight = 'bits'
    if (size >= 1000) size = Math.round(size / 1024 * 100) / 100, weight = 'KB'
    if (size >= 1000) size = Math.round(size / 1024 * 100) / 100, weight = 'MB'
    if (size >= 1000) size = Math.round(size / 1024 * 100) / 100, weight = 'GB'
    if (size >= 1000) size = Math.round(size / 1024 * 100) / 100, weight = 'TB'
    return `${size} ${weight}`
}