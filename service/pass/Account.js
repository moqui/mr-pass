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
/* The remote transport, REST or gRPC (Transport.js). */
const transport = () =>
    ec.resource.script('component://mr-pass/service/pass/Transport.js')
function remoteAccount(action, input, siteId) {
    return transport().ssoAccount(action, input, siteId)
}
function startSso(parameters, siteId) {
    const backend = ec.factory.getConfValue('pass@backend-url')
    if (!backend) {
        if (
            !String(ec.factory.getConfValue('pass-authority@sso-flows') || '')
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
        // an account already signed in that starts a provider sign-in is signing in again (Smithy's "Sign in again" before
        // a git credential, SEC-PFS-63): asked as a re-authentication, an OpenID provider signs the user in afresh
        // (prompt=login) and an OAuth provider's sign-in counts as recent (check#RecentAuth)
        ec.service
            .sync()
            .throwOnError(true)
            .name('org.moqui.sso.AuthServices.login#User')
            .parameters({
                authFlowId: parameters.authFlowId,
                returnTo: base,
                ...(ec.user.userId ? { reauth: true } : {}),
            })
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
    // the browser's front channel goes to the authority's web address, on either transport
    return {
        redirectUrl:
            transport().webBase() +
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
    // Shop P4: the session's cart attached to the account
    shopCart().signedIn(
        siteId,
        shopCart().tokenOf(siteId),
        ec.context.get('siteInfo'),
    )
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
    for (const key of [
        'passDelegation',
        'passSubject',
        'passAuthorityCookie',
        'passAuthoritySession',
    ])
        ec.web.sessionAttributes.remove(key)
}
/* Shop P4: the session's Shop cart at sign-in and sign-out (Shop/ShopCart.js; never fails either). */
const shopCart = () =>
    ec.resource.script('component://mr-pass/screen/Shop/ShopCart.js')
const signedIn = () =>
    !!ec.user.userId || !!ec.web.sessionAttributes.passDelegation
function call(op, parameters, siteId) {
    if (op === 'endSession')
        shopCart().signingOut(siteId, ec.context.get('siteInfo'))
    if (['startSession', 'completeSession'].includes(op)) {
        const token = siteId ? shopCart().tokenOf(siteId) : null
        const result = callAuthority(op, parameters, siteId)
        rememberReturn(parameters)
        if (result?.authenticated && signedIn())
            shopCart().signedIn(siteId, token, ec.context.get('siteInfo'))
        return result
    }
    if (op === 'startSso') {
        const result = startSso(parameters, siteId)
        rememberReturn(parameters)
        return result
    }
    if (op === 'endSession' && ec.factory.getConfValue('pass@backend-url')) {
        // Sign-out always ends the local session; revoking the remote credential is best effort.
        try {
            return callAuthority(op, parameters, siteId)
        } catch (error) {
            ec.logger.warn(
                'Remote sign-out revocation failed: ' + error.message,
            )
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
    const backend = ec.factory.getConfValue('pass@backend-url')
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
            if (s.state !== 'published')
                fail('Unauthorized', ec.l10n.localize('Registration is closed'))
            if (s.registrationMode !== 'open') {
                if (
                    s.registrationMode !== 'invitation' ||
                    !input.invitationToken
                )
                    fail('Unauthorized', ec.l10n.localize('Registration is closed'))
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
        // the authority's session (a second factor in progress) rides along: REST's cookie, or gRPC's handle
        result = transport().account(spec[2], input, siteId)
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
/* Where a sign-in lands with no return path (Shop P5, F71): the site's root app (Forum or Shop at '/'), else its Forum
   mount, else the site's root. */
function landing(siteInfo) {
    const mounts = siteInfo?.mounts || []
    if (mounts.some((m) => m.pathPrefix === '/')) return '/'
    const forum = mounts.find((m) => m.app === 'forum')
    return forum ? forum.pathPrefix : '/'
}
;({ call, finishSso, safeReturnPath, landing })
