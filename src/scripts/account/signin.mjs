import "@css/_components/sign-page.scss"

import { httpRequest } from "../_src/utils.mjs"
import {MD5} from "crypto-js"

! function () {
    const GetUrlValue = name => {
        const reg = new RegExp("(^|&)" + name + "=([^&]*)(&|$)", "i");
        const r = window.location.search.substring(1).match(reg);
        if (r != null) return decodeURIComponent(r[2]);
        return undefined;
    }
    const TIP = {
        _DOM: document.getElementById("tip"),
        _TYPE_LIST: {
            "primary": "alert-primary",
            "success": "alert-success",
            "error": "alert-danger",
            "warn": "alert-warning"
        },
        clear() {
            this._DOM.innerHTML = "";
            this._DOM.classList.toggle("show", false);
        },
        /**
         * @param {*} msg 
         * @param {"primary" | "success" | "error" | "warn"} type
         */
        show(msg, type = "") {
            this._DOM.innerHTML = msg;
            if (type) Object.keys(this._TYPE_LIST).forEach(k => this._DOM.classList.toggle(this._TYPE_LIST[k], k === type));
            this._DOM.classList.toggle("show", true);
        }
    }
    // bind enter key event
    let lockClick = false;
    document.querySelector("form#signin").addEventListener("keydown", function (e) {
        if (e.keyCode === 13 && !lockClick) {
            lockClick = true;
            document.querySelector("form#signin #submit").click();
        }
    })
    document.querySelector("form#signin").addEventListener("keyup", function (e) {
        lockClick = false;
    })
    // bind submit event
    const SUBMIT_BTN = document.querySelector("form#signin #submit");
    SUBMIT_BTN.addEventListener("click", function (e) {
        const username = document.querySelector("form#signin [name='username']").value;
        const password = document.querySelector("form#signin [name='password']").value;
        const rememberme = document.querySelector("form#signin [name='rememberme']").checked;

        const WAF_INFO = JSON.parse(atob(document.querySelector("[data-waf-info]").dataset["wafInfo"]));
        const reg = WAF_INFO.reg, waitTime = WAF_INFO.waitTime;
        const UN_RULE = RegExp(...reg.username);
        const PW_RULE = RegExp(...reg.password);

        if (!username || !password)
            return TIP.show("请输入用户名或密码", "warn");
        if (!UN_RULE.test(username))
            return TIP.show("用户名不合法", "warn");
        if (username.length < 3 || username.length > 10)
            return TIP.show("用户名长度必须为3-10个字符", "warn");
        if (!PW_RULE.test(password))
            return TIP.show("密码不合法", "warn");
        if (password.length < 6 || password.length > 18)
            return TIP.show("密码长度必须为6-18个字符", "warn");

        TIP.clear();
        SUBMIT_BTN.classList.toggle("disabled", true);
        const BACKUP_INNER_HTML = SUBMIT_BTN.innerHTML;
        SUBMIT_BTN.innerHTML = "登录中";
        httpRequest.post({
            url: "/api/account/signin",
            data: `type=auth&username=${username}&password=${MD5(password)}&rememberme=${rememberme ? 1 : 0}`,
            contentType: "application/x-www-form-urlencoded; charset=UTF-8",
            responseType: "json",
            callback: xhr => {
                const res = xhr.response;
                if (xhr.status === 200 && res.code === 0) {
                    TIP.show(res.msg, "success");
                    SUBMIT_BTN.innerHTML = "跳转中";
                    setTimeout(() => {
                        window.location.href = GetUrlValue("from") || "/";
                    }, 1000);
                } else if (res.code === -9) {
                    TIP.show(res.msg, "error");
                    SUBMIT_BTN.innerHTML = BACKUP_INNER_HTML;

                    const btnEl = document.createElement("button");
                    btnEl.type = "button", btnEl.disabled = true, btnEl.classList.add("btn", "btn-outline-primary");
                    let countTime = Math.ceil(waitTime);
                    btnEl.innerHTML = `${countTime}s`;
                    SUBMIT_BTN.parentNode.insertBefore(btnEl, SUBMIT_BTN);
                    let intervalId = setInterval(() => {
                        if (countTime <= 0) {
                            clearInterval(intervalId);
                            btnEl.parentNode.removeChild(btnEl);
                            SUBMIT_BTN.classList.toggle("disabled", false);
                            SUBMIT_BTN.innerHTML = BACKUP_INNER_HTML;
                            return;
                        }
                        btnEl.innerHTML = `${countTime}s`;
                        countTime--;
                    }, 1000)
                } else if (res.code === -2) {
                    TIP.show(res.msg, "error");
                    SUBMIT_BTN.classList.toggle("disabled", false);
                    SUBMIT_BTN.innerHTML = BACKUP_INNER_HTML;
                } else {
                    TIP.show("登录失败", "error");
                    SUBMIT_BTN.classList.toggle("disabled", false);
                    SUBMIT_BTN.innerHTML = BACKUP_INNER_HTML;
                }
            },
            timeout: xhr => {
                TIP.show("登录超时", "error");
                SUBMIT_BTN.classList.toggle("disabled", false);
                SUBMIT_BTN.innerHTML = BACKUP_INNER_HTML;
            },
            error: xhr => {
                TIP.show("登录失败", "error");
                SUBMIT_BTN.classList.toggle("disabled", false);
                SUBMIT_BTN.innerHTML = BACKUP_INNER_HTML;
            }
        })
    })
}()