import bodyParser from 'body-parser';
import * as express from 'express';
import { Application, Express } from 'express';

import ComponentStateHandler from './handlers/component_state_handler';
import * as errorHandler from './middleware/error_handler';
import * as stats from './middleware/stats';
import * as context from './util/context';

export interface RestServerOptions {
    app: express.Express;
    componentStateHandler: ComponentStateHandler;
}

/**
 * Class for configuring the express routes and middleware
 */
export default class RestServer {
    private readonly app: express.Express;
    private componentStateHandler: ComponentStateHandler;

    /**
     * Constructor
     * @param options options
     */
    constructor(options: RestServerOptions) {
        this.app = options.app;
        this.componentStateHandler = options.componentStateHandler;
    }

    /**
     * Initializes the express configs
     */
    public init(): void {
        this.config(this.app);
        this.configRoutes(this.app);
    }

    /**
     * Configures express middlewares
     * @param app express app
     * @private
     */
    private config(app: Express): void {
        app.use(bodyParser.json());
        app.use(express.json());
        app.use('/', context.injectContext);

        const loggedPaths = [ '/*' ];

        app.use(loggedPaths, stats.middleware);
        app.use(loggedPaths, context.accessLogger);
        stats.registerHandler(app, '/metrics');

        // This is placed last in the middleware chain and is our default error handler.
        app.use(errorHandler.middleware);
    }

    /**
     * Configures express routes
     * @param app express app
     * @private
     */
    private configRoutes(app: Application): void {
        app.get('/health', (req: express.Request, res: express.Response) => {
            res.send('healthy!');
        });

        app.post('/hook/v1/status', async (req: express.Request, res: express.Response, next: express.NextFunction) => {
            try {
                await this.componentStateHandler.componentStateWebhook(req, res);
            } catch (err) {
                next(err);
            }
        });
    }
}
