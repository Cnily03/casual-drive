import Koa from 'koa';
import send from 'koa-send';

declare const FileSender: Koa.Middleware;

declare module 'koa' {
    interface BaseContext {
        sendFile: (path: string, opts?: send.SendOptions) => Promise<void>;
    }
}