import Koa from 'koa';
import { CustomLogger } from './logger';

declare const app: Koa & {
    logger: CustomLogger;
};

export = app;