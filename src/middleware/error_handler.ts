import * as express from 'express';

import logger from '../util/logger';

/**
 * Express middleware for handling error
 * @param err error
 * @param req request
 * @param res response
 * @param next next function
 */
export function middleware(
        err: Error,
        req: express.Request,
        res: express.Response,
        next: express.NextFunction
): void {
    // If the headers have already been sent then we must use
    // the built-in default error handler according to
    // https://expressjs.com/en/guide/error-handling.html
    if (res.headersSent) {
        return next(err);
    }

    let l = logger;

    if (req.context && req.context.logger) {
        l = req.context.logger;
    }

    if (err.name === 'UnauthorizedError') {
        l.info(`unauthorized token ${err}`, { err });
        res.status(401).send('invalid token...');
    } else {
        l.error(`internal error ${err}`, { err });
        res.status(500).send('internal server error');
    }
}
