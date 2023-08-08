const fs = require('fs');
const path = require('path');
const args = process.argv.slice(2)
require('colors')

function isJSON(obj) {
    return typeof (obj) === "object" && Object.prototype.toString.call(obj).toLowerCase() === "[object object]" && !obj.length;
}

function mergeJSON(target, source) {
    for (const key of Object.keys(source)) {
        if (isJSON(source[key])) {
            if (!target[key]) target[key] = {}
            mergeJSON(target[key], source[key])
        } else {
            target[key] = source[key]
        }
    }
    return target
}

function reconfigure(autoinit = false) {
    if (!fs.existsSync('./runtime.config.json')) {
        if (autoinit) require('./init')
        else throw new Error('No runtime configuration file not found. Please run `'.red + "npm run init".cyan + '` to initialize first.'.red)
    }
    const runtimeConfig = require('./runtime.config.json')
    const config = require('./config.js')
    const newConfig = mergeJSON(runtimeConfig, config)
    fs.writeFileSync(path.resolve("./runtime.config.json"), JSON.stringify(newConfig, null, 4));
}

if (args[0] === '--auto') {
    if (!fs.existsSync('./runtime.config.json')) {
        console.log('No runtime configuration file not found. Start initializing...\n')
        require('./init')
    } else {
        reconfigure()
        console.log('Reconfiguration successfully!')
    }
}


module.exports = {
    reconfigure
}