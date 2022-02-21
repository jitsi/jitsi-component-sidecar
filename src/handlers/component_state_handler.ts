import { Request, Response } from 'express';

import StatsReporter, { ComponentDetails, StatsReport } from '../service/stats_reporter';
import logger from '../util/logger';

export interface ComponentStateHandlerOptions {
    statsReporter: StatsReporter;
    componentDetails: ComponentDetails;
}

interface ComponentMetadata {
    [key: string]: string;
}

interface ComponentState {
    componentId: string;
    status: unknown;
    timestamp?: number;
    metadata: ComponentMetadata;
}

/**
 */
export default class ComponentStateHandler {
    private statsReporter: StatsReporter;
    private readonly componentDetails: ComponentDetails;

    /**
     * Constructor
     * @param options
     */
    constructor(options: ComponentStateHandlerOptions) {
        this.statsReporter = options.statsReporter;
        this.componentDetails = options.componentDetails;
    }

    /**
     * @param req
     * @param res
     */
    async componentStateWebhook(req: Request, res: Response): Promise<void> {
        const ctx = req.context;
        const componentState: ComponentState = req.body;

        if (!componentState.status) {
            res.sendStatus(400);

            return;
        }
        if (!componentState.componentId) {
            res.sendStatus(400);

            return;
        }

        const ts = new Date();
        const statsReport = <StatsReport>{
            component: this.componentDetails,
            stats: componentState,
            timestamp: ts.getTime()
        };

        try {
            this.statsReporter.setLatestStatsReport(statsReport);
            await this.statsReporter.reportStats(ctx);
        } catch (err) {
            logger.error(`Error reporting stats: ${err}`, { err });
        }

        res.status(200);
        res.send('{"status":"OK"}');
    }
}
