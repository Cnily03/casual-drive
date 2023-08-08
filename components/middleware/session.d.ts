import Koa from 'koa';
import Cookies from 'cookies';

interface SessionProps {
    config: SessionMiddlewareOpts;
    data: { [k: string]: any };
    get(key: string): any;
    set(data: { [k: string]: any }, cookie_opts?: Cookies.SetOption & {
        delete: (keyof typeof Cookies.SetOption)[]
    }): void;
    set(key: string, value: any): void;
    destroy(): void;
    commit(): void;

}

interface SessionMiddlewareOpts {
    key?: string,
    autoCommit?: boolean,
    renew?: boolean,
    rolling?: boolean,
    maxAge?: number,
    path?: string,
    httpOnly?: boolean,
    signed?: boolean,
    secure?: boolean,
    overwrite?: boolean,
    keys?: {
        pubKey: string,
        pteKey: string,
        xorKey: string
    }
}

declare const Session: (opts: SessionMiddlewareOpts, app: Koa) => Koa.Middleware;

declare module 'koa' {
    interface BaseContext {
        session: SessionProps;
    }
}