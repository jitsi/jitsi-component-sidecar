import { JibriStatus, JigasiStatus } from '../handlers/component_state_handler';
import { Context } from '../util/context';
import WsClient from '../ws_client';

export enum ComponentType {
    Jibri = 'JIBRI',
    SipJibri = 'SIP-JIBRI',
    Jigasi = 'JIGASI',
}

export interface ComponentDetails {
    componentId: string;
    componentKey: string;
    componentType: ComponentType;
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
    sessionId?: string;
    status?: JibriStatus | JigasiStatus;
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
            ctx.logger.debug(`Stats report available, sending.. ${JSON.stringify(body)}`);
        } else {
            body = {
                component: this.componentDetails
            };

            ctx.logger.debug(`Stats report not available, only sending component info ${JSON.stringify(body)}`);
        }

        this.wsClient.emitStatusUpdate(ctx, body);
    }
}
