import * as sqlite3 from "sqlite3";
declare module "sqlite3" {
    interface Database {
        runSync(sql: string, params?: any): Promise<sqlite3.Database>;
        getSync(sql: string, params?: any): Promise<any>;
        allSync(sql: string, params?: any): Promise<any[]>;
        eachSync(sql: string, params?: any, callback?: (err: Error, row: any) => void): Promise<number>;
    }
}

export const getDB: (dbpath: string) => sqlite3.Database
export const getDBSync: (dbpath: string) => Promise<sqlite3.Database>