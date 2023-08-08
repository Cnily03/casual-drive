import { Logger as log4jsLoger } from "log4js"

type fgColors = "black" | "red" | "green" | "yellow" | "blue" | "magenta" | "cyan" | "white" | "gray" | "grey"
type bgColors = "bgBlack" | "bgRed" | "bgGreen" | "bgYellow" | "bgBlue" | "bgMagenta" | "bgCyan" | "bgWhite"
type efColors = "bold" | "dim" | "italic" | "underline" | "inverse" | "hidden" | "strikethrough"
type extColors = "rainbow" | "zebra" | "america" | "trap" | "random" | "zalgo"
type AllColors = fgColors | bgColors | efColors | extColors

export interface CustomLogger extends log4jsLoger {
    constructor(prefix: string, ...color?: AllColors | AllColors[], _presetGroup?: string[]): CustomLogger
    setPrefix(prefix: string, ...color?: AllColors | AllColors[]): CustomLogger
    log(...args: any[]): void
}

// const logger: CustomLogger

export const getLogger: (console: boolean) => CustomLogger
export const defaultLogger: () => CustomLogger
export const consoleLogger: () => CustomLogger