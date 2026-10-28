/* Authentication stays at the configured authority; the browser sees only its local session. */
const verbs = {
    startSession: ['start', 'Session', 'session'],
    completeSession: ['complete', 'Session', 'challenge'],
    beginRegistration: ['begin', 'Registration', 'registration'],
    verifyRegistration: ['verify', 'Registration', 'verification'],
    requestRecovery: ['request', 'Recovery', 'recovery'],
    endSession: ['end', 'Session', 'logout'],
    manageAccount: ['manage', 'Account', 'security'],
}
const fail = (kind, text) => {
    const e = new Error(text)
    e.moquiErrorKind = kind
    throw e
}
const facade = () =>
    ec.resource.script('component://mr-pass/service/pass/Facade.js')
function remoteAccount(action, input, siteId) {
    const response = facade()
        .authorityClient(siteId, 'account/' + action, 'POST')
        .jsonObject(input)
        .call()
    if (Number(response.statusCode) !== 200)
        fail('AuthenticationRequired', 'Sign-in handoff could not be completed')
    return response.jsonObject()
}
function startSso(parameters, siteId) {
    const backend = System.getProperty('pass_backend_url')
    if (!backend) {
        if (
            !String(System.getProperty('pass_sso_flows') || '')
                .split(',')
                .includes(parameters.authFlowId)
        )
            fail('Unauthorized', 'Sign-in provider is unavailable')
        const info = ec.service
            .sync()
            .throwOnError(true)
            .name('pass.Facade.call#Operation')
            .parameters({ operation: 'getSiteInfo', input: { siteId } })
            .call().result
        const base =
            info.mounts.find((m) => m.app === 'forum')?.pathPrefix || '/forum'
        ec.service
            .sync()
            .throwOnError(true)
            .name('org.moqui.sso.AuthServices.login#User')
            .parameters({ authFlowId: parameters.authFlowId, returnTo: base })
            .call()
        return { externalRedirect: true }
    }
    const state = ec.user.randomString(32),
        verifier = ec.user.randomString(64)
    const result = remoteAccount(
        'sso-prepare',
        { authFlowId: parameters.authFlowId, state, verifier },
        siteId,
    )
    ec.web.sessionAttributes.passSsoState = state
    ec.web.sessionAttributes.passSsoVerifier = verifier
    ec.web.sessionAttributes.passSsoHandoffId = result.handoffId
    return {
        redirectUrl:
            String(backend).replace(/\/$/, '') +
            '/rest/s1/pass/v1/sites/' +
            encodeURIComponent(siteId) +
            '/account/sso?handoffId=' +
            encodeURIComponent(result.handoffId),
    }
}
function finishSso(parameters, siteId) {
    const attrs = ec.web.sessionAttributes
    if (
        !attrs.passSsoState ||
        parameters.state !== attrs.passSsoState ||
        parameters.handoffId !== attrs.passSsoHandoffId
    )
        fail('Unauthorized', 'Sign-in state changed; start again')
    const result = remoteAccount(
        'sso-exchange',
        {
            handoffId: parameters.handoffId,
            code: parameters.code,
            verifier: attrs.passSsoVerifier,
        },
        siteId,
    )
    ec.web.rotateSession()
    attrs.passDelegation = result.credential
    attrs.passSubject = JSON.stringify(result.subject)
    for (const key of ['passSsoState', 'passSsoVerifier', 'passSsoHandoffId'])
        attrs.remove(key)
    return { authenticated: true }
}
/* A local path only: one leading slash, no backslash, whitespace or control character
   (browsers drop tabs, so "/\t/host" would otherwise be read as "//host"). */
function safeReturnPath(value) {
    const path = String(value || '')
    return /^\/(?![\/\\])[^\s\\\u0000-\u001f\u007f]*$/.test(path) ? path : null
}
function rememberReturn(parameters) {
    const destination = safeReturnPath(parameters.returnTo)
    if (destination) ec.web.sessionAttributes.passReturnTo = destination
}
function clearRemoteSession() {
    for (const key of ['passDelegation', 'passSubject', 'passAuthorityCookie'])
        ec.web.sessionAttributes.remove(key)
}
function call(op, parameters, siteId) {
    if (op === 'startSso') {
        const result = startSso(parameters, siteId)
        rememberReturn(parameters)
        return result
    }
    if (op === 'endSession' && System.getProperty('pass_backend_url')) {
        // Sign-out always ends the local session; revoking the remote credential is best effort.
        try {
            return callAuthority(op, parameters, siteId)
        } catch (error) {
            ec.logger.warn('Remote sign-out revocation failed: ' + error.message)
            return {}
        } finally {
            clearRemoteSession()
            ec.web.rotateSession()
        }
    }
    const result = callAuthority(op, parameters, siteId)
    rememberReturn(parameters)
    return result
}
function callAuthority(op, parameters, siteId) {
    const spec = verbs[op]
    if (!spec) fail('NotFound', 'Account action not found')
    const allowed = {
        startSession: ['username', 'password'],
        completeSession: ['code'],
        beginRegistration: ['emailAddress', 'invitationToken'],
        verifyRegistration: ['token', 'newPassword'],
        requestRecovery: ['emailAddress'],
        endSession: [],
        manageAccount: [
            'action',
            'oldPassword',
            'newPassword',
            'newPasswordVerify',
            'code',
            'visitId',
        ],
    }[op]
    const input = Object.fromEntries(
        allowed
            .filter((k) => parameters[k] != null)
            .map((k) => [k, parameters[k]]),
    )
    const backend = System.getProperty('pass_backend_url')
    let result
    if (!backend) {
        if (op === 'beginRegistration') {
            const s = ec.service
                .sync()
                .throwOnError(true)
                .name('pass.Facade.call#Operation')
                .parameters({ operation: 'getSiteInfo', input: { siteId } })
                .call().result.site
            // Same rule as the authority's registration route: an unpublished site takes no registrations.
            if (s.state !== 'published') fail('Unauthorized', 'Registration is closed')
            if (s.registrationMode !== 'open') {
                if (
                    s.registrationMode !== 'invitation' ||
                    !input.invitationToken
                )
                    fail('Unauthorized', 'Registration is closed')
                ec.service
                    .sync()
                    .throwOnError(true)
                    .name('pass.Facade.call#Operation')
                    .parameters({
                        operation: 'inspectInvitation',
                        input: {
                            siteId,
                            token: input.invitationToken,
                            emailAddress: input.emailAddress,
                        },
                    })
                    .call()
            }
        }
        result = ec.service
            .sync()
            .throwOnError(true)
            .name('org.moqui.public.AccountServices.' + spec[0] + '#' + spec[1])
            .parameters({ input })
            .call().result
    } else {
        const client = facade()
            .authorityClient(siteId, 'account/' + spec[2], 'POST')
            .jsonObject(input)
        if (ec.web.sessionAttributes.passAuthorityCookie)
            client.addHeader(
                'Cookie',
                ec.web.sessionAttributes.passAuthorityCookie,
            )
        if (ec.web.sessionAttributes.passDelegation)
            client.addHeader(
                'Authorization',
                'Bearer ' + ec.web.sessionAttributes.passDelegation,
            )
        const response = client.call()
        if (Number(response.statusCode) !== 200)
            fail(
                facade().statusKind(response.statusCode),
                'Authentication could not be completed',
            )
        const cookies = response
            .headerList('set-cookie')
            .map((c) => String(c).split(';')[0])
            .filter((c) =>
                /^moqui\.session=|^JSESSIONID=|^moquiSession=/.test(c),
            )
        if (cookies.length)
            ec.web.sessionAttributes.passAuthorityCookie = cookies.join('; ')
        result = response.jsonObject()
        if (result.credential) {
            ec.web.rotateSession()
            ec.web.sessionAttributes.passDelegation = result.credential
            ec.web.sessionAttributes.passSubject = JSON.stringify(
                result.subject,
            )
            delete result.credential
        }
    }
    if (op === 'endSession') clearRemoteSession()
    return result
}
;({ call, finishSso, safeReturnPath })
