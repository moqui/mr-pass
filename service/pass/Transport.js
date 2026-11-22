/* How PASS reaches its one configured authority (mr-moqui plans/archive/Edge-Node.md §5.5): in process (local mode), or
   remotely by one of two transports behind the same functions, so a caller cannot tell them apart and sees the same
   statusKind error kinds from both:
   - rest: the authority's REST API (Mantle's PassApi.js) at pass@backend-url, the client's secret in headers;
   - grpc: the host's gRPC binding (ec.service.passAuthority): direct to the authority's gRPC listener
     (pass@backend-grpc-url), or with pass@backend-url edge: the edge node's link to its local node.
   pass@backend-transport chooses: grpc or rest, or empty for automatic, which is gRPC where the host has it and a gRPC
   endpoint is configured, else REST (Lite and Dev have no gRPC, so REST stays their supported default). CC0 plus patent
   grant. */
const fail = (kind, text) => {
    const e = new Error(text)
    e.moquiErrorKind = kind
    throw e
}
const statusKind = (status) =>
    ({
        401: 'AuthenticationRequired',
        403: 'Unauthorized',
        404: 'NotFound',
        409: 'Conflict',
        422: 'Unprocessable',
        429: 'Tarpit',
    })[Number(status)] || 'Unavailable'
/* The authority's refusal as the error a local call would have raised (impl-shop P1, F4): its kind from the status, and
   its reason, field and text (the envelope's message) put back as "reason[field]: text", the form Shared/Portal.js reads
   from a local refusal; an envelope without them keeps the fallback text. */
function refused(status, envelope, fallback) {
    const reason = /^[a-z][a-zA-Z0-9]{1,63}$/.test(String(envelope?.reason || ''))
        ? envelope.reason
        : null
    const field = reason ? envelope.fieldErrors?.[0]?.field : null
    const own = ['Unprocessable', 'Conflict'].includes(statusKind(status))
    const text =
        own && typeof envelope?.message === 'string' && envelope.message
            ? envelope.message.split('\n')[0].slice(0, 300)
            : fallback
    fail(
        statusKind(status),
        (reason
            ? reason +
              (/^[A-Za-z][A-Za-z0-9_.]{0,63}$/.test(String(field || ''))
                  ? '[' + field + ']'
                  : '') +
              ': '
            : '') + text,
    )
}
/* The JSON envelope of a REST error response, or null. */
function envelopeOf(response) {
    try {
        return response.jsonObject()
    } catch (error) {
        return null
    }
}
/* Writes a bearer link's token authorizes for a visitor who is not signed in (Mantle's PassAuthority lists the same). */
const TOKEN_WRITES = [
    'startInvoicePayment',
    'submitSupplierBill',
    // Purchasing P16: a quote's and a purchase order's link
    'saveQuoteResponse',
    'submitQuoteResponse',
    'acknowledgePurchaseOrder',
    'reportDropShipDelivery',
    // Customer Service P13: a feedback invitation's link
    'submitCaseFeedback',
    // Customer Service P15: a queue's form token, a case's CaseView link, an article view's rating nonce and an RMA link
    'createCustomerCase',
    'replyCustomerCase',
    'requestCaseReopen',
    'cancelCustomerCase',
    'rateArticle',
    'addReturnEvidence',
    'withdrawCustomerReturn',
    // Shop P1: none yet; P4 adds the cart writes
    // Shop P4: a cart's writes, authorized by the session's cart capability (input.token); the first add makes the cart
    // with no capability yet (impl-shop F44: an anonymous write, as applyOptOut is), its creations rate limited by the
    // requester
    'addCartItem',
    'updateCartItem',
    'removeCartItem',
    'applyPromoCode',
    'removePromoCode',
    // Shop P5: the checkout's writes and its capability reads (POSTs, F75), authorized by the session's cart capability
    // (input.token), the checkout's reference and key (a provider's return, a refreshed frontend) or a guest's order link;
    // getCart with them
    'getCart',
    'beginCheckout',
    'getCheckout',
    'resumeCheckout',
    'setCheckoutContact',
    'setCheckoutAddresses',
    'getDeliveryOptions',
    'selectDelivery',
    'getPaymentOptions',
    'selectPayment',
    'submitCheckout',
    'getCheckoutPaymentResult',
    'getCheckoutPaymentForm',
    'getOrderConfirmation',
    // Shop P6: reads and writes a guest's order link (orderToken) or a list link's token (email preferences) authorizes,
    // and the Support operations an order link admits (F27); the Support reads with a capability are POSTs (F75)
    'findShopOrders',
    'getShopOrder',
    'getShopOrderDocument',
    'getDownloads',
    'issueDownload',
    'getEmailPreferences',
    'storeEmailPreferences',
    'applyOneClickUnsubscribe',
    'getCaseIntake',
    'getReturnableOrder',
    'requestCustomerReturn',
    'requestOrderCancel',
    // SEC-PSS-23: an order link asks for the code its cancel, return and case need
    'sendOrderChangeCode',
    // Commerce P10: a cart recovery link's one-time token (input.token); the authority asks a visitor to sign in first
    'recoverCart',
    // IronStone Sales P13: a quote link's acceptance or decline (input.token)
    'respondSalesQuote',
    // IronStone Marketing P7: a subscription request (anonymous: PASS's request key, its limits and the neutral receipt bound it)
    // and its confirmation link's POST (input.token)
    'requestSubscription',
    'verifySubscription',
    // IronStone Marketing P12: a form's answer (anonymous for a public publication: PASS's request key, its limits and the neutral
    // receipt bound it; an invitation's link with input.token)
    'submitMarketingForm',
    // IronStone Marketing P15: a tracking event of the redirect, the pixel or a page carrying a code (anonymous: the authority's limits
    // per client and code and per site bound it, and its answer is the same; a personalized link's or pixel's input.token)
    'recordTrackingEvent',
    // IronStone Marketing P17: a registration's reservation (anonymous: PASS's request key and the authority's limits bound it) and
    // its completion, payment, read and cancellation by its capability (input.token) or the provider's return (input.key)
    'reserveRegistration',
    'completeRegistration',
    'startRegistrationPayment',
    // the provider's posted form of a pending payment, by the capability (the user's call, Nov 15)
    'getRegistrationPaymentForm',
    'getRegistration',
    'cancelRegistration',
]
const MAX_UPLOAD = 10485760
const SKIP_HEADERS = ['set-cookie', 'x-csrf-token', 'moquisessiontoken']
// a PASS setting by its conf selector (pass@backend-url), empty when not set
const property = (name) => String(ec.factory.getConfValue(name) || '').trim()
const routes = () =>
    ec.resource.script('component://mr-pass/service/pass/Routes.js')

/* The gRPC endpoint of an authority's REST URL, for pass@backend-transport grpc with no pass@backend-grpc-url: its host
   on the gRPC listener's default port. */
function grpcEndpointOf(backend) {
    const match = /^(https?):\/\/(\[[^\]]+\]|[^/:]+)/.exec(String(backend))
    if (!match) return ''
    return (match[1] === 'https' ? 'grpcs://' : 'grpc://') + match[2] + ':4317'
}
/* Whether a URL (http://, https://, grpc://, grpcs://) is in clear text to a host other than this one's loopback: such
   a URL would carry the client's secret and the visitors' delegations unencrypted (SEC-PSF-05). */
function clearToAnotherHost(url) {
    const match = /^(https?|grpcs?):\/\/(\[[^\]]+\]|[^/:?#]+)/i.exec(String(url || ''))
    if (!match || !/^(http|grpc)$/i.test(match[1])) return false
    const host = match[2].toLowerCase().replace(/^\[|\]$/g, '')
    return !(host === 'localhost' || host === '::1' || /^127(?:\.\d{1,3}){3}$/.test(host))
}
/* The transport for the settings: {kind: 'local'}, {kind: 'rest'} or {kind: 'grpc', endpoint}. backend is
   pass@backend-url, setting pass@backend-transport, grpcUrl pass@backend-grpc-url, available whether the host has the
   gRPC binding, insecure pass@backend-insecure. Settings that cannot work are an Unavailable error naming them, and so is
   a transport in clear text (http://, grpc://) to another host, unless insecure is true (as the authority's gRPC
   listener takes clear text from another host only with pass-authority@grpc-insecure). */
function select(settings) {
    const chosen = selectTransport(settings)
    const url =
        chosen.kind === 'rest'
            ? settings.backend
            : chosen.kind === 'grpc'
              ? chosen.endpoint
              : ''
    if (settings.insecure !== true && clearToAnotherHost(url))
        fail(
            'Unavailable',
            (chosen.kind === 'rest'
                ? 'pass@backend-url'
                : 'pass@backend-grpc-url') +
                ' sends the client secret in clear text to another host: use https:// (grpcs://), or set pass@backend-insecure to true',
        )
    return chosen
}
function selectTransport({ backend, setting, grpcUrl, available }) {
    if (!backend) return { kind: 'local' }
    const chosen = String(setting || '').toLowerCase()
    if (chosen && chosen !== 'grpc' && chosen !== 'rest')
        fail(
            'Unavailable',
            'pass@backend-transport must be grpc, rest or empty',
        )
    if (backend === 'edge:') {
        // the local node on the edge link is reached over gRPC only
        if (chosen === 'rest')
            fail(
                'Unavailable',
                'pass@backend-url edge: is the edge link, which takes gRPC only',
            )
        if (!available)
            fail(
                'Unavailable',
                'pass@backend-url edge: needs gRPC in this host',
            )
        return { kind: 'grpc', endpoint: 'edge:' }
    }
    if (chosen === 'rest') return { kind: 'rest' }
    const endpoint =
        grpcUrl || (chosen === 'grpc' ? grpcEndpointOf(backend) : '')
    if (chosen === 'grpc') {
        if (!available)
            fail(
                'Unavailable',
                'pass@backend-transport grpc needs gRPC in this host',
            )
        if (!endpoint) fail('Unavailable', ec.l10n.localize('No gRPC endpoint for the authority'))
        return { kind: 'grpc', endpoint }
    }
    // automatic: an authority that has not opened its gRPC listener keeps REST until pass@backend-grpc-url names it
    return available && endpoint ? { kind: 'grpc', endpoint } : { kind: 'rest' }
}
/* Whether this host has the gRPC binding: Lite and Dev throw "gRPC not built into this host". */
function grpcAvailable() {
    if (typeof ec.service.passAuthority !== 'function') return false
    try {
        ec.service.passAuthority('edge:')
        return true
    } catch (error) {
        if (/not built/.test(String(error.message))) return false
        throw error
    }
}
function current() {
    const backend = property('pass@backend-url')
    if (!backend) return { kind: 'local' }
    return select({
        backend,
        setting: property('pass@backend-transport'),
        grpcUrl: property('pass@backend-grpc-url'),
        available: grpcAvailable(),
        insecure: property('pass@backend-insecure') === 'true',
    })
}
/* The authority's web address, for the SSO front channel the browser follows: pass@backend-web-url, else an http(s)
   pass@backend-url. On the edge link that is the local node's host name, through the edge node's web access. */
function webBase() {
    const base =
        property('pass@backend-web-url') || property('pass@backend-url')
    if (!/^https?:\/\//.test(base))
        fail('Unavailable', 'pass@backend-web-url is not configured')
    return base.replace(/\/$/, '')
}
/* The remote call's route (the path/verb catalogue is packaged with PASS, so a remote frontend needs no Mantle
   metadata), and the anonymous-write rule both transports keep. */
function routeOf(operation, input) {
    const route = routes().find(([method, path, op]) => op === operation)
    if (!route) fail('Unavailable', ec.l10n.localize('Remote operation is unavailable'))
    const token = ec.web.sessionAttributes.passDelegation
    if (
        !token &&
        route[0] !== 'GET' &&
        operation !== 'applyOptOut' &&
        // Shop P4 (F44): a visitor's first add makes the cart, so it has no capability yet; P5 (F75): the cart's read is a
        // POST, answered empty for a visitor with no cart
        operation !== 'addCartItem' &&
        operation !== 'getCart' &&
        // IronStone Marketing P7: a visitor's subscription request has no token (PASS's request key and the authority's limits)
        operation !== 'requestSubscription' &&
        // IronStone Marketing P12: a visitor's answer to a public form has no token (PASS's request key and the authority's limits)
        operation !== 'submitMarketingForm' &&
        // IronStone Marketing P15: a tracking event of a generic link or page has no token (the authority's limits bound it)
        operation !== 'recordTrackingEvent' &&
        // IronStone Marketing P17: a visitor's registration request has no token yet (PASS's request key and the authority's limits)
        operation !== 'reserveRegistration' &&
        // a link's or cart's token, or (Shop P5) a checkout's return key or a guest's order link
        !(
            TOKEN_WRITES.includes(operation) &&
            (input.token || input.key || input.orderToken)
        )
    )
        fail('AuthenticationRequired', 'Sign in to continue')
    return { method: route[0], pattern: route[1], token }
}
const checkUpload = (file) => {
    if (!file || Number(file.size) > MAX_UPLOAD)
        fail('Unprocessable', ec.l10n.localize('Upload exceeds the size limit'))
}
function signedOut() {
    ec.web.sessionAttributes.remove('passDelegation')
    ec.web.sessionAttributes.remove('passSubject')
}

/* ---- REST ---- */
/* Every authority call names this deployment with its secret and its browser's address (for rate limits). The secret is
   never read here: the host adds it as a header only to a URL under pass@backend-url (RestClient.addPropertyHeader). */
function authorityClient(siteId, path, method) {
    const backend = ec.factory.getConfValue('pass@backend-url'),
        clientId = ec.factory.getConfValue('pass@client-id')
    if (!backend || !clientId || !ec.factory.isConfValueSet('pass@client-secret'))
        fail('Unavailable', ec.l10n.localize('Remote authority is not configured'))
    // the same rule as select's for a caller that comes here directly: no secret in clear text to another host
    if (property('pass@backend-insecure') !== 'true' && clearToAnotherHost(backend))
        fail('Unavailable', 'pass@backend-url sends the client secret in clear text to another host')
    const client = ec.service
        .rest()
        .uri(
            String(backend).replace(/\/$/, '') +
                '/rest/s1/pass/v1/sites/' +
                encodeURIComponent(siteId) +
                '/' +
                path,
        )
        .method(method)
        .timeout(30)
        .followRedirects(false)
        // the authority is this deployment's own, configured by the operator: it may be on a private network
        .allowInternal()
        .addHeader('x-pass-client', clientId)
        .addPropertyHeader('x-pass-client-secret', 'pass@client-secret', 'pass@backend-url')
    const address = ec.web?.request?.remoteAddr
    if (address) client.addHeader('x-pass-client-ip', String(address))
    return client
}
const rest = {
    call(operation, input, def) {
        const { method, pattern, token } = routeOf(operation, input)
        const payload = { ...input }
        delete payload.siteId
        const path = pattern.replace(/\{([^}]+)\}/g, (_, name) => {
            const value = payload[name]
            delete payload[name]
            if (value == null || value === '')
                fail('Unprocessable', 'Missing ' + name)
            return encodeURIComponent(String(value))
        })
        const client = authorityClient(input.siteId, path, method)
        if (token) client.addHeader('authorization', 'Bearer ' + token)
        if (operation === 'stageAttachment') {
            checkUpload(input.file)
            const upload = client
                .multipart({
                    file: input.file,
                    contactListId: input.contactListId || '',
                    purpose: input.purpose || 'post',
                    draftId: input.draftId || '',
                    altText: input.altText || '',
                })
                .send()
            if (
                Number(upload.statusCode) < 200 ||
                Number(upload.statusCode) >= 300
            )
                fail(
                    statusKind(upload.statusCode),
                    ec.l10n.localize('Upload could not be completed'),
                )
            return upload.jsonObject()
        }
        // Another operation with a file (a supplier's bill, quote or acknowledgement) sends its fields and the file as one
        // multipart request; without a file (a quote's or an acknowledgement's is optional) it is an ordinary call.
        if (def.fields.includes('file') && input.file) {
            checkUpload(input.file)
            const parts = {}
            for (const [k, v] of Object.entries(payload))
                if (v != null && v !== '')
                    parts[k] = k === 'file' ? v : String(v)
            const sent = client.multipart(parts).send()
            if (Number(sent.statusCode) < 200 || Number(sent.statusCode) >= 300)
                refused(
                    sent.statusCode,
                    envelopeOf(sent),
                    ec.l10n.localize('The authority could not complete this request'),
                )
            return sent.jsonObject()
        }
        if (method === 'GET') {
            for (const [k, v] of Object.entries(payload))
                if (v != null) client.addBodyParameter(k, String(v))
        } else
            client.text(JSON.stringify(payload)).contentType('application/json')
        const response = client.call(),
            status = Number(response.statusCode)
        if (status === 401) {
            signedOut()
            if (method === 'GET' && token)
                return rest.call(operation, input, def)
        }
        if (status < 200 || status >= 300)
            refused(
                status,
                envelopeOf(response),
                ec.l10n.localize('The authority could not complete this request'),
            )
        return response.jsonObject()
    },
    /* A protected file, streamed through to the browser with the authority's status and headers. */
    download(siteId, path) {
        const client = authorityClient(siteId, path, 'GET')
        if (ec.web.sessionAttributes.passDelegation)
            client.addHeader(
                'authorization',
                'Bearer ' + ec.web.sessionAttributes.passDelegation,
            )
        ec.web.response.forward(client.send(), { skipHeaders: SKIP_HEADERS })
    },
    /* The SSO back channel: no session or credential of the visitor's. */
    ssoAccount(action, input, siteId) {
        const response = authorityClient(siteId, 'account/' + action, 'POST')
            .jsonObject(input)
            .call()
        if (Number(response.statusCode) !== 200)
            fail(
                'AuthenticationRequired',
                ec.l10n.localize('Sign-in handoff could not be completed'),
            )
        return response.jsonObject()
    },
    /* An account action, with the authority's session (the second factor) in its cookie, kept in the visitor's session. */
    account(action, input, siteId) {
        const client = authorityClient(
            siteId,
            'account/' + action,
            'POST',
        ).jsonObject(input)
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
                statusKind(response.statusCode),
                ec.l10n.localize('Authentication could not be completed'),
            )
        const cookies = response
            .headerList('set-cookie')
            .map((c) => String(c).split(';')[0])
            .filter((c) =>
                /^__Host-moqui\.session=|^moqui\.session=|^JSESSIONID=|^moquiSession=/.test(c),
            )
        if (cookies.length)
            ec.web.sessionAttributes.passAuthorityCookie = cookies.join('; ')
        return response.jsonObject()
    },
}

/* ---- gRPC ---- */
/* The PassAuthority call of an operation, with the visitor's credential and address. */
function grpcCall(operation, siteId, input, extra) {
    return {
        operation,
        siteId,
        input,
        delegation: ec.web.sessionAttributes.passDelegation || '',
        visitorAddress: String(ec.web?.request?.remoteAddr || ''),
        operationId: ec.user.randomString(16),
        ...(extra || {}),
    }
}
/* An answer's result, or its error as the REST adapter's: the envelope's status gives the kind. */
function answered(answer, message) {
    if (answer.error) refused(answer.error.status, answer.error, message)
    return answer.result
}
const grpc = (endpoint) => ({
    call(operation, input, def) {
        const { method, token } = routeOf(operation, input)
        const authority = ec.service.passAuthority(endpoint)
        if (operation === 'stageAttachment') {
            checkUpload(input.file)
            const fields = {
                contactListId: input.contactListId || '',
                purpose: input.purpose || 'post',
                draftId: input.draftId || '',
                altText: input.altText || '',
            }
            return answered(
                authority.upload(
                    grpcCall(operation, input.siteId, fields),
                    input.file,
                ),
                ec.l10n.localize('Upload could not be completed'),
            )
        }
        if (def.fields.includes('file') && input.file) {
            checkUpload(input.file)
            const fields = {}
            for (const [k, v] of Object.entries(input))
                if (k !== 'file' && k !== 'siteId' && v != null && v !== '')
                    fields[k] = String(v)
            return answered(
                authority.upload(
                    grpcCall(operation, input.siteId, fields),
                    input.file,
                ),
                ec.l10n.localize('The authority could not complete this request'),
            )
        }
        const payload = {}
        // a GET sends text query parameters over REST, so it sends text here too
        for (const [k, v] of Object.entries(input))
            if (k !== 'siteId' && (method !== 'GET' || v != null))
                payload[k] = method === 'GET' ? String(v) : v
        const answer = authority.call(
            grpcCall(operation, input.siteId, payload),
        )
        if (answer.error && Number(answer.error.status) === 401) {
            signedOut()
            if (method === 'GET' && token)
                return this.call(operation, input, def)
        }
        return answered(answer, ec.l10n.localize('The authority could not complete this request'))
    },
    /* A protected file, streamed through to the browser; an error is the envelope with its status, as REST's. */
    download(siteId, operation, input) {
        const response = ec.service
            .passAuthority(endpoint)
            .download(grpcCall(operation, siteId, input))
        ec.web.response.forward(response, { skipHeaders: SKIP_HEADERS })
    },
    ssoAccount(action, input, siteId) {
        const answer = ec.service.passAuthority(endpoint).call(
            grpcCall('account.' + action, siteId, input, {
                delegation: '',
            }),
        )
        if (answer.error)
            fail(
                'AuthenticationRequired',
                ec.l10n.localize('Sign-in handoff could not be completed'),
            )
        return answer.result
    },
    /* An account action, with the authority's session (the second factor) as its handle, kept in the visitor's
       session in place of REST's cookie. */
    account(action, input, siteId) {
        const answer = ec.service.passAuthority(endpoint).call(
            grpcCall('account.' + action, siteId, input, {
                sessionHandle:
                    ec.web.sessionAttributes.passAuthoritySession || '',
            }),
        )
        if (answer.sessionHandle)
            ec.web.sessionAttributes.passAuthoritySession = answer.sessionHandle
        return answered(answer, ec.l10n.localize('Authentication could not be completed'))
    },
})

/* The remote transport, which callers use when the authority is not in process. */
function remote() {
    const chosen = current()
    if (chosen.kind === 'local') fail('Unavailable', ec.l10n.localize('The authority is local'))
    return chosen.kind === 'grpc' ? grpc(chosen.endpoint) : rest
}
/* ---- the anonymous catalog read cache (Shop P3, F43, F58; design-shop §12.7) ----
   A remote frontend keeps the authority's answers to anonymous catalog reads, keyed by site, operation, input, locale,
   currency, the site's publication generation and its active theme release, so a page whose publication is unchanged
   costs one generation read (getSiteGeneration, kept for GENERATION_MS) instead of its reads. Only a visitor who is not
   signed in, without a delegation or a bearer token, on a GET route; an answer naming another generation, and every
   refusal, is not kept. When the generation cannot be read nothing cached is served. The cache is bounded: a fixed number
   of slots, a key's slot by its digest (a collision replaces the slot), each entry kept at most ENTRY_MS. */
const CATALOG_CACHE = 'pass.shop.catalogReads'
const GENERATION_CACHE = 'pass.shop.siteGenerations'
const CACHE_SLOTS = 512
const ENTRY_MS = 60000
const GENERATION_MS = 2000
const CACHED_READS = [
    'getShopContext',
    'getShopPage',
    'getShopHome',
    'getStoreCategories',
    'getStoreCategory',
    'findProducts',
    'searchShop',
    'getProduct',
    'quoteSelection',
    'getStorePage',
    'getShopSitemap',
    'getSiteNavigation',
    'resolveSiteRedirect',
    // Shop P8 (impl-shop F63): the site information Pass.xml reads on every page, for a visitor not signed in (a signed-in
    // visitor's names their membership and profile, so it is never kept); kept under the site's generation, which a site,
    // host or mount change advances
    'getSiteInfo',
]
/* Whether a read may be answered from the cache: a listed operation, by a visitor not signed in, without a token. */
function cacheable(operation, input) {
    if (!CACHED_READS.includes(operation) || ec.user.userId) return false
    if (input.token != null && input.token !== '') return false
    try {
        return !ec.web || !ec.web.sessionAttributes.passDelegation
    } catch (error) {
        return false
    }
}
const nowMs = () => Date.now()
/* The site's generation and active release ({generation, releaseId}), read at most every GENERATION_MS; null when it
   cannot be read. read: the authority read (getSiteGeneration by default). */
function siteGeneration(siteId, read) {
    const cache = ec.cache.getCache(GENERATION_CACHE)
    const kept = cache.get(String(siteId))
    if (kept && nowMs() - Number(kept.at) < GENERATION_MS) return kept.value
    try {
        const answer = (read || ((id) => remote().call('getSiteGeneration', { siteId: id }, { fields: ['siteId'] })))(
            siteId,
        )
        const value = {
            generation: Number(answer.generation || 0),
            releaseId: answer.release ? String(answer.release.releaseId) : null,
        }
        cache.put(String(siteId), { at: nowMs(), value })
        return value
    } catch (error) {
        ec.message.clearErrors()
        cache.remove(String(siteId))
        return null
    }
}
/* The cache key of a read: its site, operation, input (in key order), locale, currency, generation and release. */
function cacheKey(operation, input, publication) {
    const fields = Object.keys(input)
        .sort()
        .map((k) => [k, input[k] == null ? null : String(input[k])])
    return JSON.stringify([
        String(input.siteId || ''),
        operation,
        fields,
        String(ec.user.locale || ''),
        String(input.currencyUomId || ''),
        publication.generation,
        publication.releaseId,
    ])
}
const slotOf = (key) => 'slot:' + (parseInt(ec.resource.digestText(key, 'sha256').slice(0, 8), 16) % CACHE_SLOTS)
/* A read through the cache: the kept answer of the same key, else fetch()'s, kept when it may be. generationRead: the
   generation read (the authority's by default). */
function readThrough(operation, input, fetch, generationRead) {
    if (!cacheable(operation, input)) return fetch()
    const publication = siteGeneration(input.siteId, generationRead)
    if (!publication) return fetch()
    const key = cacheKey(operation, input, publication)
    const cache = ec.cache.getCache(CATALOG_CACHE)
    const slot = slotOf(key)
    const kept = cache.get(slot)
    if (kept && kept.key === key && nowMs() - Number(kept.at) < ENTRY_MS) return kept.value
    const value = fetch()
    if (keepable(value, publication)) cache.put(slot, { key, at: nowMs(), value })
    return value
}
/* Whether an answer may be kept under the generation read: one naming another generation (a catalog read's own, or the site
   information's site.generation) is not, nor one that says its visitor is signed in. */
function keepable(value, publication) {
    if (!value || typeof value !== 'object' || value.authenticated === true) return false
    const generation = value.generation != null ? value.generation : value.site ? value.site.generation : null
    return generation == null || Number(generation) === publication.generation
}
/* A remote operation: its result, or the error kind REST's status would give. */
function call(operation, input, def) {
    return readThrough(operation, input, () => remote().call(operation, input, def))
}
/* A remote attachment (getAttachment) or export (getExport) download, streamed to the browser. */
function download(siteId, attachmentId, variant) {
    const transport = remote()
    if (transport === rest)
        return rest.download(
            siteId,
            'attachments/' +
                encodeURIComponent(attachmentId) +
                (variant ? '?variant=' + encodeURIComponent(variant) : ''),
        )
    transport.download(siteId, 'getAttachment', {
        attachmentId,
        ...(variant ? { variant } : {}),
    })
}
function downloadExport(siteId, exportId) {
    const transport = remote()
    if (transport === rest)
        return rest.download(siteId, 'exports/' + encodeURIComponent(exportId))
    transport.download(siteId, 'getExport', { exportId })
}
/* A file an operation answers (the Support app's case file and return label, Customer Service P15), streamed through: over
   REST its route's path with the input as the query, over gRPC the operation itself. */
function downloadOperation(siteId, operation, input) {
    const transport = remote()
    if (transport === rest) {
        const route = routes().find(([method, , op]) => method === 'GET' && op === operation)
        if (!route) fail('NotFound', ec.l10n.localize('Resource not found'))
        const query = Object.entries(input || {})
            .filter(([k, v]) => k !== 'siteId' && v != null && v !== '')
            .map(([k, v]) => encodeURIComponent(k) + '=' + encodeURIComponent(String(v)))
            .join('&')
        return rest.download(siteId, route[1] + (query ? '?' + query : ''))
    }
    transport.download(siteId, operation, input)
}
const ssoAccount = (action, input, siteId) =>
    remote().ssoAccount(action, input, siteId)
const account = (action, input, siteId) =>
    remote().account(action, input, siteId)
;({
    select,
    current,
    grpcAvailable,
    grpcEndpointOf,
    clearToAnotherHost,
    webBase,
    call,
    download,
    downloadExport,
    downloadOperation,
    ssoAccount,
    account,
    authorityClient,
    statusKind,
    answered,
    refused,
    readThrough,
    CACHED_READS,
    // Shop P4: the anonymous-write rule and its list, which ShopCart checks equal to the authority's
    routeOf,
    TOKEN_WRITES,
})
