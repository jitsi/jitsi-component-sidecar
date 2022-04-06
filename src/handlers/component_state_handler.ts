import { Request, Response } from 'express';

import StatsReporter, { ComponentDetails, SessionReport, StatsReport } from '../service/stats_reporter';
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
    status: JibriStatus | JigasiStatus;
}

export enum SessionStatus {
    ON = 'ON',
    OFF = 'OFF',
    PENDING = 'PENDING',
    UNDEFINED = 'UNDEFINED'
}

export enum FailureReason {
    BUSY='BUSY',
    ERROR ='ERROR',
    UNDEFINED = 'UNDEFINED'
}

export enum ErrorScope {
    SESSION='SESSION',
    SYSTEM='SYSTEM'
}

export interface ComponentError {
    scope: ErrorScope,
    detail: String
}

export interface ComponentFailure {
    reason?: FailureReason,
    error?: ComponentError
}

export interface JibriSession {
    sessionId: string;
    status: SessionStatus,
    sipAddress?: string,
    failure?: ComponentFailure,
    shouldRetry?: boolean
}

interface ComponentSessionState {
    jibriId: string;
    session: JibriSession;
}

/**
 * Handler for component and session status updates
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
     * Method for processing component stats
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
            status: componentState.status,
            timestamp: ts.getTime()
        };

        try {
            this.statsReporter.setLatestStatsReport(statsReport);
            await this.statsReporter.reportStats(ctx);

            res.status(200);
            res.send('{"status":"OK"}');
        } catch (err) {
            logger.error(`Error reporting stats: ${err}`, { err });

            res.status(200);
            res.send('{"status":"ERROR"}');
        }
    }

    /**
     * Method for processing session stats
     * @param req
     * @param res
     */
    async componentSessionStateWebhook(req: Request, res: Response): Promise<void> {
        const ctx = req.context;
        const sessionState: ComponentSessionState = req.body;

        if (!sessionState.session || !sessionState.session.status || !sessionState.session.sessionId) {
            res.sendStatus(400);

            return;
        }

        const ts = new Date();
        const sessionReport = <SessionReport>{
            ...sessionState.session,
            timestamp: ts.getTime()
        };

        try {
            await this.statsReporter.reportSession(ctx, sessionReport);

            res.status(200);
            res.send('{"status":"OK"}');
        } catch (err) {
            logger.error(`Error reporting session: ${err}`, { err });

            res.status(200);
            res.send('{"status":"ERROR"}');
        }

    }
}
