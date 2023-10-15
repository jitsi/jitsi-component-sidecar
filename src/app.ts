import express from 'express';
import * as fs from 'fs';

import config from './config/config';
import ComponentStateHandler from './handlers/component_state_handler';
import RestServer from './rest_server';
import AsapRequest from './service/asap_request';
import { CommanderService } from './service/commander_service';
import StatsCollector from './service/stats_collector';
import StatsReporter, { ComponentDetails, ComponentType } from './service/stats_reporter';
import { generateNewContext } from './util/context';
import logger from './util/logger';
import WsClient from './ws_client';

logger.info(`Starting up jitsi-component-sidecar service with config: ${JSON.stringify(config)}`);

const jwtSigningKey = fs.readFileSync(config.AsapSigningKeyFile);
const app = express();

const asapRequest = new AsapRequest({
    signingKey: jwtSigningKey,
    asapJwtIss: config.AsapJwtIss,
    asapJwtAud: config.AsapJwtAud,
    asapJwtKid: config.AsapJwtKid,
    requestTimeoutMs: config.RequestTimeoutMs,
    requestRetryCount: config.RequestRetryCount
});

const wsClientCtx = generateNewContext('ws-client');
const url = config.WSServerUrl;
const path = config.WSServerPath;
const wsClient = new WsClient({
    url,
    path,
    asapRequest,
    commanderService: new CommanderService({
        environment: config.Environment,
        componentKey: config.ComponentKey,
        componentNick: config.ComponentNick,
        startComponentUrl: config.StartComponentURL,
        stopComponentUrl: config.StopComponentURL,
        enableStopComponent: config.EnableStopComponent,
        asapRequest,
        sipClientUsername: config.SipClientUserName,
        sipClientPassword: config.SipClientPassword
    }),
    ctx: wsClientCtx
});

const componentDetails: ComponentDetails = config.ComponentMetadata as unknown as ComponentDetails;

componentDetails.componentId = config.ComponentId;
componentDetails.componentKey = config.ComponentKey;
componentDetails.componentType = config.ComponentType as ComponentType;
componentDetails.environment = config.Environment;
componentDetails.region = config.Region;
componentDetails.hostname = config.Hostname;

const statsCollector = new StatsCollector({
    retrieveUrl: config.StatsRetrieveURL,
    asapRequest,
    componentDetails
});

const statsReporter = new StatsReporter({
    wsClient,
    componentDetails
});

const componentStateHandler = new ComponentStateHandler({
    statsReporter,
    componentDetails
});

// configure rest server and initialize routes
const restServer = new RestServer({
    app,
    componentStateHandler
});

restServer.init();

/**
 * Collect component stats
 */
async function collectStats() {
    const ctx = generateNewContext('stats-collector');

    try {
        const statsReport = await statsCollector.retrieveStatsReport(ctx);

        statsReporter.setLatestStatsReport(statsReport);
    } catch (err) {
        logger.error(`Error collecting stats ${err}`, { err });
        statsReporter.setLatestStatsReport(undefined);
    }
}

/**
 * Report component stats
 */
async function reportStats() {
    const ctx = generateNewContext('stats-reporter');

    try {
        await statsReporter.reportStats(ctx);
    } catch (err) {
        logger.info(`Error reporting stats ${err}`, { err });
        statsReporter.setLatestStatsReport(undefined);
    }
}

/**
 * Loop for polling
 */
async function poll() {
    await collectStats();
    await reportStats();

    setTimeout(poll, config.StatsReportingInterval * 1000);
}

poll();

logger.warn('starting in unprotected api mode');

app.listen(config.HTTPServerPort, () => {
    logger.info(`...listening on :${config.HTTPServerPort}`);
});
