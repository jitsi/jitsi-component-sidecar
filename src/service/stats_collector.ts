import { Context } from '../util/context';

import AsapRequest from './asap_request';
import { ComponentDetails, StatsReport } from './stats_reporter';

export interface StatsCollectorOptions {
    retrieveUrl: string;
    asapRequest: AsapRequest;
    componentDetails: ComponentDetails;
}

/**
 */
export default class StatsCollector {
    private readonly retrieveUrl: string;
    private readonly componentDetails: ComponentDetails;
    private asapRequest: AsapRequest;

    /**
     * Constructor
     * @param options
     */
    constructor(options: StatsCollectorOptions) {
        this.retrieveUrl = options.retrieveUrl;
        this.asapRequest = options.asapRequest;
        this.componentDetails = options.componentDetails;

        this.retrieveStats = this.retrieveStats.bind(this);
        this.retrieveStatsReport = this.retrieveStatsReport.bind(this);
    }

    /**
     * Response will look like
     * {"status":{"busyStatus":"IDLE","health":{"healthStatus":"HEALTHY","details":{}}}}
     */
    private async retrieveStats(ctx: Context): Promise<unknown> {
        try {
            const response = await this.asapRequest.getJson(ctx, this.retrieveUrl);

            if (response) {
                return response;
            }
        } catch (err) {
            ctx.logger.error(`RetrieveStats Error: ${err}, from url: ${this.retrieveUrl}`, { err });
        }
    }

    /**
     * @param ctx
     */
    async retrieveStatsReport(ctx: Context): Promise<StatsReport> {
        let stats = await this.retrieveStats(ctx);

        if (!stats) {
            stats = {};
        }
        const ts = new Date();
        const report = <StatsReport>{
            component: this.componentDetails,
            stats,
            timestamp: ts.getTime()
        };

        ctx.logger.debug(`Stats report ${JSON.stringify(report)}`);

        return report;
    }
}
