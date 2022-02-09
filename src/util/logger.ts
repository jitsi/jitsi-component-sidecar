import logger from '@jitsi/logger';

/**
 * An instantiated and configured {@code jitsi logger} instance.
 */
export default logger.getLogger('jitsi-component-sidecar', undefined, {
    disableCallerInfo: true
});
