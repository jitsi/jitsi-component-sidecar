import { HTTPError, RequestError, TimeoutError, UnsupportedProtocolError } from 'got';

/**
 * Extracts a user-friendly error message, taking into consideration the behaviour of
 * got errors https://github.com/sindresorhus/got#errors
 * @param err Error
 */
export function getDisplayedErrorMessage(err: Error): string {
    if (err instanceof HTTPError || err instanceof TimeoutError || err instanceof UnsupportedProtocolError) {
        return `${err}`;
    } else if (err instanceof RequestError) {
        return `${err.name} ${err.code}`;
    }

    return `${err.name}`;

}
