import { Context } from '../util/context';
import { getDisplayedErrorMessage } from '../util/error_util';

import AsapRequest from './asap_request';
import CommandResponseBuilder from './response_builder';

export enum CommandType {
    START = 'START',
    STOP = 'STOP',
}

export enum SinkType {
    GATEWAY = 'GATEWAY',
    FILE = 'FILE',
}

/**
 * We assume the 'baseUrl' represents a sort of landing page (on the same
 * domain, eg. https://8x8.vc) where we can set the necessary local storage values.  The call
 * url will be created by joining [baseUrl] and [callName] with a "/".  If
 * set, a list of [urlParams] will be concatenated after the call name with
 * a "#" in between.
 */
export interface CallUrlInfo {
    baseUrl: string;
    callName: string;
    urlParams?: string[];
}

export interface CallParams {
    callUrlInfo: CallUrlInfo;
    email: string;
    passcode?: string;
    callStatsUsernameOverride?: string;
    displayName?: string;
}

export interface SipClientParams {

    /**
     * The SIP address we'll be connecting to
     */
    sipAddress: string;

    /**
     * The display name we'll use for the web conference
     * in the pjsua call
     */
    displayName: string;

    /**
     * The username to use if registration is needed.
     */
    userName?: string;

    /**
     * The password to use if registration is needed.
     */
    password?: string;

    /**
     * Whether auto-answer is enabled, if it is, the client will listen for
     * incoming invites and will auto answer the first one.
     */
    autoAnswer: boolean;
}

export interface XmppCredentials {

    /**
     * Eg. recorder.oana.jitsi.net
     */
    domain: string;

    port?: string;

    /**
     * The username to use if registration is needed.
     */
    username: string;

    /**
     * The password to use if registration is needed.
     */
    password: string;
}

export interface StartComponentPayload {
    sessionId: string;
    sinkType: SinkType;
    callParams: CallParams;
    sipClientParams?: SipClientParams;
    callLoginParams?: XmppCredentials;
}

export interface CommandPayload {
    componentKey: string;
    componentRequest: StartComponentPayload;
}

export interface CommandOptions {
    commandTimeoutMs: number;
    componentRequestTimeoutMs?: number;
}

export interface Command {
    cmdId: string;
    type: CommandType;
    options: CommandOptions;
    payload: CommandPayload;
}

export enum ResponseType {
    SUCCESS = 'SUCCESS',
    ERROR = 'ERROR',
}

export interface ResponsePayload {
    componentKey: string;
    sessionId?: string;
    sipUsername?: string;
}

export interface ErrorResponsePayload {
    componentKey: string;
    sessionId?: string;
    errorKey: string;
    errorMessage: string;
}

export interface CommandResponse {
    cmdId: string;
    type: CommandType;
    responseType: ResponseType;
    payload?: ResponsePayload | ErrorResponsePayload;
}

export interface StartComponentRequest {
    sessionId: string;
    sinkType: SinkType;
    callParams: CallParams;
    sipClientParams?: SipClientParams;
    callLoginParams?: XmppCredentials;
}

export interface ComponentCommanderOptions {
    environment: string;
    asapRequest: AsapRequest;
    componentKey: string;
    componentNick: string;
    startComponentUrl: string;
    stopComponentUrl: string;
    enableStopComponent: boolean;
    sipClientUsername: string;
    sipClientPassword: string;
}

/**
 * Sends commands to the Jibri service, such as startService or stopService
 * See supported Jibri commands https://github.com/jitsi/jibri/blob/master/doc/http_api.md
 */
export class CommanderService {
    private readonly environment: string;
    private asapRequest: AsapRequest;
    private readonly componentKey: string;
    private readonly componentNick: string;
    private readonly startComponentUrl: string;
    private readonly stopComponentUrl: string;
    private readonly enableStopComponent: boolean;
    private readonly sipClientUsername: string;
    private readonly sipClientPassword: string;

    /**
     * Constructor
     * @param options
     */
    constructor(options: ComponentCommanderOptions) {
        this.environment = options.environment;
        this.asapRequest = options.asapRequest;
        this.componentKey = options.componentKey;
        this.componentNick = options.componentNick ? options.componentNick : 'componentNick';
        this.startComponentUrl = options.startComponentUrl;
        this.stopComponentUrl = options.stopComponentUrl;
        this.enableStopComponent = options.enableStopComponent;
        this.sipClientUsername = options.sipClientUsername;
        this.sipClientPassword = options.sipClientPassword;
    }

    /**
     * Method processing start command
     * @param ctx
     * @param command
     */
    public async startComponent(ctx: Context, command: Command): Promise<CommandResponse> {
        const requestedComponent = command.payload.componentKey;
        const startComponentPayload: StartComponentPayload = command.payload.componentRequest;
        const commandType = command.type;

        ctx.logger.info(`Processing start command: ${commandType} for ${requestedComponent}, `
            + `payload ${JSON.stringify(startComponentPayload)}`);

        let commandResponse: CommandResponse;

        if (requestedComponent && requestedComponent === this.componentKey) {
            const startComponentRequest: StartComponentRequest = {
                sessionId: startComponentPayload.sessionId,
                sinkType: startComponentPayload.sinkType,
                callParams: startComponentPayload.callParams,
                sipClientParams: startComponentPayload.sipClientParams,
                callLoginParams: startComponentPayload.callLoginParams
            };

            // if callStatsUsernameOverride is set, make sure to add the componentNick as prefix
            if (startComponentRequest.callParams.callStatsUsernameOverride) {
                startComponentRequest.callParams.callStatsUsernameOverride = this.componentNick
                    .concat(' ')
                    .concat(startComponentRequest.callParams.callStatsUsernameOverride);
            }

            if (startComponentRequest.sipClientParams) {
                startComponentRequest.sipClientParams.userName = this.sipClientUsername;
                startComponentRequest.sipClientParams.password = this.sipClientPassword;
            }

            try {
                const responseStatusCode = await this.asapRequest.postJson(ctx, this.startComponentUrl,
                    startComponentRequest, { requestTimeoutMs: CommanderService.getRequestTimeout(command) });

                if (responseStatusCode === 200) {
                    ctx.logger.info(`Started component ${requestedComponent}`);

                    return CommandResponseBuilder.successCommandResponse(command.cmdId, commandType, {
                        componentKey: this.componentKey,
                        sessionId: startComponentPayload.sessionId,
                        sipUsername:
                            startComponentRequest.sipClientParams && startComponentRequest.sipClientParams.userName
                                ? startComponentRequest.sipClientParams.userName.split('@')[0]
                                : null
                    });
                }
                ctx.logger.error(
                    `Error staring component ${requestedComponent}. Status code is ${responseStatusCode}`
                );
                commandResponse = CommandResponseBuilder.errorCommandResponse(command.cmdId, commandType, {
                    componentKey: requestedComponent,
                    sessionId: startComponentPayload.sessionId,
                    errorKey: 'component.not.started',
                    errorMessage: `Component could not start. Status code is ${responseStatusCode}`
                });

            } catch (err) {
                ctx.logger.error(`Error starting component ${requestedComponent}. Error is: ${err}`, { err });

                // Especially useful in case of timeout, when we don't know if the component started
                // Do not wait for the stop component to finish
                this.safeStopComponent(ctx).then(() =>
                    'Component was stopped after start request failed');

                commandResponse = CommandResponseBuilder.errorCommandResponse(command.cmdId, commandType, {
                    componentKey: requestedComponent,
                    sessionId: startComponentPayload.sessionId,
                    errorKey: 'component.not.started',
                    errorMessage: `Component could not start. Error is ${getDisplayedErrorMessage(err)}`
                });
            }
        } else {
            ctx.logger.error(`Invalid component: ${requestedComponent}`);
            commandResponse = CommandResponseBuilder.errorCommandResponse(command.cmdId, commandType, {
                componentKey: requestedComponent,
                sessionId: startComponentPayload.sessionId,
                errorKey: 'component.not.started',
                errorMessage: 'Component does not exist here'
            });
        }

        return commandResponse;
    }

    /**
     * Method processing start command
     * @param ctx
     * @param command
     */
    public async stopComponent(ctx: Context, command: Command): Promise<CommandResponse> {
        const requestedComponent = command.payload.componentKey;
        const commandType = command.type;

        ctx.logger.info(`Processing stop command: ${commandType} for ${requestedComponent}`);

        let commandResponse: CommandResponse;

        if (requestedComponent && requestedComponent === this.componentKey) {
            try {
                const responseStatusCode = await this.asapRequest.postJson(ctx, this.stopComponentUrl, {},
                    { requestTimeoutMs: CommanderService.getRequestTimeout(command) });

                if (responseStatusCode === 200) {
                    ctx.logger.info(`Stopped component ${requestedComponent}`);

                    return CommandResponseBuilder.successCommandResponse(command.cmdId, commandType, {
                        componentKey: this.componentKey
                    });
                }
                ctx.logger.error(
                        `Error stopping component ${requestedComponent}. Status code is ${responseStatusCode}`
                );
                commandResponse = CommandResponseBuilder.errorCommandResponse(command.cmdId, commandType, {
                    componentKey: requestedComponent,
                    errorKey: 'component.not.stopped',
                    errorMessage: `Component could not stop. Status code is ${responseStatusCode}`
                });

            } catch (err) {
                ctx.logger.error(`Error stopping component ${requestedComponent}. 
                Error is: ${err}`, { err });

                commandResponse = CommandResponseBuilder.errorCommandResponse(command.cmdId, commandType, {
                    componentKey: requestedComponent,
                    errorKey: 'component.not.started',
                    errorMessage: `Component could not stop. Error is ${getDisplayedErrorMessage(err)}`
                });
            }
        } else {
            ctx.logger.error(`Invalid component: ${requestedComponent}`);
            commandResponse = CommandResponseBuilder.errorCommandResponse(command.cmdId, commandType, {
                componentKey: requestedComponent,
                errorKey: 'component.not.started',
                errorMessage: 'component does not exist here'
            });
        }

        return commandResponse;
    }

    /**
     * @param ctx
     */
    private async safeStopComponent(ctx: Context): Promise<void> {
        if (this.enableStopComponent) {
            try {
                await this.asapRequest.postJson(ctx, this.stopComponentUrl, {}, {});
            } catch (error) {
                ctx.logger.info(`Component service stop action failed with error: ${error}`, { error });
            }
        }
    }

    /**
     * Get request timeout if specified in the command options
     * @param command
     * @private
     */
    private static getRequestTimeout(command: Command): number {
        if (command.options && command.options.componentRequestTimeoutMs
            && command.options.componentRequestTimeoutMs > 0) {
            return command.options.componentRequestTimeoutMs;
        }

        return null;
    }

    /**
     */
    public getComponentKey(): string {
        return this.componentKey;
    }
}
