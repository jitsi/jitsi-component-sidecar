import { io } from 'socket.io-client';

import config from './config/config';
import AsapRequest from './service/asap_request';
import { Command, CommandResponse, CommandType, CommanderService } from './service/commander_service';
import CommandResponseBuilder from './service/response_builder';
import { SessionReport, StatsReport } from './service/stats_reporter';
import { Context, generateNewContext } from './util/context';
import { getDisplayedErrorMessage } from './util/error_util';

export interface WsClientOptions {
    url: string;
    path: string;
    ctx: Context;
    asapRequest: AsapRequest;
    commanderService: CommanderService;
}

/**
 * * Configures the web socket client behavior
 */
export default class WsClient {
    public url: string;
    public path: string;
    private socket: any;
    private ctx: Context;
    private commanderService: CommanderService;
    private asapRequest: AsapRequest;

    /**
     * Constructor
     * @param options
     */
    constructor(options: WsClientOptions) {
        this.url = options.url;
        this.path = options.path;
        this.asapRequest = options.asapRequest;
        this.commanderService = options.commanderService;
        this.ctx = options.ctx;

        this.sockets();
        this.init();
    }

    /**
     *  Configures the sockets
     */
    private sockets(): void {
        this.socket = io(this.url, {
            path: this.path,
            auth: {
                token: this.asapRequest.authToken()
            },
            transports: [ 'websocket' ],
            query: {
                componentKey: this.commanderService.getComponentKey()
            }
        });
    }

    /**
     * Configures websocket routes and behavior
     */
    private init(): void {
        this.socket.on('connect_error', (err: any) => {
            this.ctx.logger.error(`Socket connection error: ${err}`);

            this.socket.auth.token = this.asapRequest.authToken();
        });

        this.socket.on('connect', () => {
            this.ctx.logger.info(
                `Socket connected, using componentKey ${this.commanderService.getComponentKey()}, `
                + `socket=${this.socket.id}`
            );
        });

        this.socket.on('command', async (command: Command, callback: any) => {
            const ctx = generateNewContext(command.cmdId);

            ctx.logger.debug(`Received command ${JSON.stringify(command)}, socket=${this.socket.id}`);

            let commandResponse: CommandResponse;

            if (command.type === CommandType.START) {
                try {
                    commandResponse = await this.commanderService.startComponent(ctx, command);
                } catch (err) {
                    ctx.logger.error(
                        `Error starting component ${command.payload.componentKey}. 
                        Error is: ${err}, socket=${this.socket.id}`, { err }
                    );
                    commandResponse = CommandResponseBuilder.errorCommandResponse(command.cmdId, command.type, {
                        componentKey: command.payload.componentKey,
                        errorKey: 'component.not.started',
                        errorMessage: `Component could not start. Error is ${getDisplayedErrorMessage(err)}`
                    });
                }
            } else if (command.type === CommandType.STOP) {
                try {
                    commandResponse = await this.commanderService.stopComponent(ctx, command);
                } catch (err) {
                    ctx.logger.error(
                        `Error stopping component ${command.payload.componentKey}. 
                        Error is: ${err}, socket=${this.socket.id}`, { err }
                    );
                    commandResponse = CommandResponseBuilder.errorCommandResponse(command.cmdId, command.type, {
                        componentKey: command.payload.componentKey,
                        errorKey: 'component.not.stopped',
                        errorMessage: `Component could not stop. Error is ${getDisplayedErrorMessage(err)}`
                    });
                }
            } else {
                commandResponse = CommandResponseBuilder.errorCommandResponse(command.cmdId, command.type, {
                    componentKey: command.payload.componentKey,
                    errorKey: 'command.unsupported',
                    errorMessage: 'Command type is not supported'
                });
            }
            callback(commandResponse);
        });

        this.socket.on('disconnect', (reason: any) => {
            this.ctx.logger.info(`Socket is disconnected, reason is: ${reason}`);
        });
    }

    /**
     * Send component and session status updates
     * @param ctx
     * @param eventName
     * @param report
     */
    public emitUpdate(ctx: Context, eventName: string, report: StatsReport|SessionReport): void {
        if (this.socket.connected) {
            const volatileEvents = config.VolatileEvents;

            ctx.logger.info(`Emitting ${eventName}, volatile ${volatileEvents}, 
            report ${JSON.stringify(report)}, socket=${this.socket.id}`);
            if (volatileEvents) {
                this.socket.volatile.emit(eventName, report, ctx);
            } else {
                this.socket.emit(eventName, report, ctx);
            }
        } else {
            ctx.logger.info('Could not emmit updates, socket not connected');
        }
    }
}
