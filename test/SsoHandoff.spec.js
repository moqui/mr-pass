const A = 'org.moqui.public.AccountServices.'
const account = (op, input) => call(A + op, { input }).result
const registered = {
    siteId: 'PASS_AUTH',
    clientId: 'test',
    clientSecret: 'test-deployment-secret',
}
const verifier = 'v'.repeat(64),
    state = 's'.repeat(32)
let handoffId, code
function fails(work) {
    try {
        work()
        return ''
    } catch (error) {
        ec.message.clearErrors()
        return String(error.message)
    }
}
spec({
    stepwise: true,
    setupSpec() {
        login('john.doe')
        const old = ec.artifactExecution.disableAuthz()
        try {
            call('create#moqui.security.sso.AuthFlow', {
                authFlowId: 'PASS_TEST_SSO',
                authFlowTypeEnumId: 'AftOidc',
                disabled: 'N',
            })
        } finally {
            if (!old) ec.artifactExecution.enableAuthz()
        }
    },
    cleanupSpec() {
        login('john.doe')
    },
})
feature(
    'SSO handoff uses the registered callback and stores only challenge digests',
    {
        when() {
            const prepared = account('prepare#Sso', {
                ...registered,
                authFlowId: 'PASS_TEST_SSO',
                state,
                verifier,
            })
            handoffId = prepared.handoffId
            const row = ec.entity
                .find('moqui.security.public.SsoHandoff')
                .disableAuthz()
                .condition('handoffId', handoffId)
                .one()
            return {
                callback: row.callbackUri,
                hash: row.verifierHash,
                refused: fails(() =>
                    account('prepare#Sso', {
                        ...registered,
                        clientSecret: 'wrong',
                        authFlowId: 'PASS_TEST_SSO',
                        state,
                        verifier,
                    }),
                ),
            }
        },
        then({ callback, hash, refused }) {
            callback === 'https://frontend.example.test/account/Sso'
            hash !== verifier
            refused.includes('Unregistered')
        },
    },
)
feature(
    'SSO callback is browser-bound and exchanges a single-use site-scoped code',
    {
        when() {
            const missingState = fails(() =>
                account('complete#Sso', { siteId: 'PASS_AUTH', handoffId }),
            )
            ec.web.sessionAttributes.passSsoHandoffId = handoffId
            const callback = account('complete#Sso', {
                siteId: 'PASS_AUTH',
                handoffId,
            })
            code = callback.redirectUrl.match(/[?&]code=([^&]+)/)[1]
            const wrongVerifier = fails(() =>
                account('exchange#Sso', {
                    ...registered,
                    handoffId,
                    code,
                    verifier: 'x'.repeat(64),
                }),
            )
            const exchanged = account('exchange#Sso', {
                ...registered,
                handoffId,
                code,
                verifier,
            })
            const replay = fails(() =>
                account('exchange#Sso', {
                    ...registered,
                    handoffId,
                    code,
                    verifier,
                }),
            )
            return { missingState, wrongVerifier, exchanged, replay }
        },
        then({ missingState, wrongVerifier, exchanged, replay }) {
            missingState.includes('expired')
            wrongVerifier.includes('expired')
            exchanged.authenticated === true
            exchanged.credential.length === 64
            replay.includes('expired')
        },
    },
)
