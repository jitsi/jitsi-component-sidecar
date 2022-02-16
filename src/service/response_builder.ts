import {
    CommandResponse,
    CommandType,
    ErrorResponsePayload,
    ResponsePayload,
    ResponseType
} from './commander_service';

/**
 */
export default class CommandResponseBuilder {

    /**
     * @param cmdId
     * @param type
     * @param payload
     */
    public static successCommandResponse(cmdId: string, type: CommandType, payload: ResponsePayload): CommandResponse {
        return {
            cmdId,
            type,
            responseType: ResponseType.SUCCESS,
            payload
        };
    }

    /**
     * @param cmdId
     * @param type
     * @param payload
     */
    public static errorCommandResponse(
            cmdId: string,
            type: CommandType,
            payload: ErrorResponsePayload
    ): CommandResponse {
        return {
            cmdId,
            type,
            responseType: ResponseType.ERROR,
            payload
        };
    }
}
