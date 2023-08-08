document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll("[data-href]").forEach(e => e.addEventListener("click", e => {
        const method = (e.target.dataset.method && e.target.dataset.method.toLowerCase()) === "post" ? "post" : "get"
        const target = e.target.dataset.target || "_self"
        if (method === "get")
            window.open(e.target.dataset.href, target)
        else {
            const form = document.createElement("form")
            form.method = method
            form.action = e.target.dataset.href
            form.target = target
            document.body.appendChild(form)
            form.submit()
            document.body.removeChild(form)
        }
    }))
})