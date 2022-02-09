import { Context } from '../util/context';
import WsClient from '../ws_client';

export interface ComponentDetails {
    componentKey: string;
    hostname: string;
    environment: string;
    region: string;
    cloud?: string;
    group?: string;
    privateIp?: string;
    publicIp?: string;
}

export interface StatsReporterOptions {
    wsClient: WsClient;
    componentDetails: ComponentDetails;
}

export interface StatsReport {
    component: ComponentDetails;
    stats?: unknown;
    timestamp?: number;
}

/**
 */
export default class StatsReporter {
    private wsClient: WsClient;
    private readonly componentDetails: ComponentDetails;
    private latestStatsReport: StatsReport;

    /**
     * Constructor
     * @param options
     */
    constructor(options: StatsReporterOptions) {
        this.wsClient = options.wsClient;
        this.componentDetails = options.componentDetails;

        this.setLatestStatsReport = this.setLatestStatsReport.bind(this);
        this.reportStats = this.reportStats.bind(this);
    }

    /**
     * @param statsReport
     */
    setLatestStatsReport(statsReport: StatsReport): void {
        this.latestStatsReport = statsReport;
    }

    /**
     * @param ctx
     */
    async reportStats(ctx: Context): Promise<void> {
        let body;

        if (this.latestStatsReport) {
            body = this.latestStatsReport;
            ctx.logger.debug('Stats report available, sending..', { body });
        } else {
            body = {
                component: this.componentDetails
            };

            ctx.logger.debug('Stats report not available, only sending component info', { body });
        }

        this.wsClient.emitStatusUpdate(ctx, body);
    }
}
