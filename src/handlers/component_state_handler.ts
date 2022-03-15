import { Request, Response } from 'express';

import StatsReporter, { ComponentDetails, StatsReport } from '../service/stats_reporter';
import logger from '../util/logger';

export interface ComponentStateHandlerOptions {
    statsReporter: StatsReporter;
    componentDetails: ComponentDetails;
}

export interface JibriStatus {
    busyStatus: unknown,
    health: unknown
}

export interface JigasiStatus {
}

interface ComponentState {
    jibriId: string;
    sessionId: string;
    status: JibriStatus | JigasiStatus;
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

        if (!componentState.status || !componentState.jibriId) {
            res.sendStatus(400);

            return;
        }

        const ts = new Date();
        const statsReport = <StatsReport>{
            component: this.componentDetails,
            sessionId: componentState.sessionId,
            status: componentState.status,
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
