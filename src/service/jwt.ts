
import * as dotenv from 'dotenv';
import envalid from 'envalid';
import fs from 'fs';

import AsapRequest from './asap_request';

dotenv.config();

const env = envalid.cleanEnv(process.env, {
    ASAP_JWT_ISS: envalid.str({ default: 'jitsi-component-sidecar' }),
    ASAP_JWT_AUD: envalid.str({ default: 'jitsi-component-selector' }),
    ASAP_JWT_COMPONENT_KEY_CLAIM: envalid.str({ default: 'sub' }),
    ASAP_SIGNING_KEY_FILE: envalid.str(),
    ASAP_JWT_KID: envalid.str(),
    INSTANCE_KEY: envalid.str({ default: undefined })
});

const jwtSigningKey = fs.readFileSync(env.ASAP_SIGNING_KEY_FILE);

const asapRequest = new AsapRequest({
    signingKey: jwtSigningKey,
    asapJwtIss: env.ASAP_JWT_ISS,
    asapJwtAud: env.ASAP_JWT_AUD,
    asapJwtKid: env.ASAP_JWT_KID,
    componentKey: env.INSTANCE_KEY,
    componentKeyClaim: env.ASAP_JWT_COMPONENT_KEY_CLAIM
});

console.log(asapRequest.authToken());
