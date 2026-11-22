/* The PASS shell's response headers per route (impl-shop P1, F3; design-shop §12.7): every route is `no-store` with the
 * shell's CSP unless a route here says otherwise. A route names its app and a path pattern within the app's mount, and
 * may change `cacheControl` (P3: public caching of the anonymous catalog routes, only for a request with no session or
 * signed-in user) or add a `formAction` source to the CSP (P5: the payment relay route, F37). The first route that
 * matches decides. A publicly cached answer varies by Cookie. Pass.xml applies this before any page renders; a page's own
 * headers still win. CC0 plus patent grant.
 */
/* default-src 'self' (SEC-PSF-04): what no other directive names (frames, fonts, connections, workers, manifests) comes
 * from the site alone, so injected markup loads no frame of another origin and sends nothing to one with fetch or CSS.
 * Styles may be inline (the theme's and the brand's <style>, Quasar's style attributes). The islands run on the runtime
 * build of Vue, loaded as bundled qvue, so scripts need no 'unsafe-eval'. */
const CSP = {
    'default-src': ["'self'"],
    'script-src': ["'self'"],
    'style-src': ["'self'", "'unsafe-inline'"],
    'font-src': ["'self'", 'data:'],
    'connect-src': ["'self'"],
    'img-src': ["'self'", 'data:'],
    'media-src': ["'self'"],
    'object-src': ["'none'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'"],
    'frame-ancestors': ["'none'"],
}
const DEFAULT = { cacheControl: 'no-store', formAction: [] }
/* {app, path: RegExp over the path within the mount, cacheControl?, anonymousOnly?, formAction?: [sources]}. */
const ROUTES = [
    // P3 (design-shop §12.7, F42): Shop's anonymous catalog and content routes, Home, Categories, a category, Search, a
    // product, a page, the sitemap and robots, are public for a minute, and only for a request with no session cookie and
    // no signed-in user (anonymousOnly; anything else is no-store). The page itself sends no-store for any answer but 200
    // and an ETag of its content. A cart (P4) makes a session, so a shopper with one is no-store.
    {
        app: 'shop',
        path: /^\/(?:Home|Categories(?:\/List)?|Search|products\/[A-Za-z0-9_-]{1,40}(?:\/[A-Za-z0-9_-]{0,200})?|categories\/[A-Za-z0-9_-]{1,40}(?:\/[A-Za-z0-9_-]{0,200})?|pages(?:\/[A-Za-z0-9_-]{1,40}){1,5}|sitemap\.xml|robots\.txt)?\/?$/,
        cacheControl: 'public, max-age=60',
        anonymousOnly: true,
    },
    // P5 (F37; the user's call, impl-shop §4): the payment relay posts a fresh Accept Hosted form token to Authorize.Net's
    // page (production and sandbox); only this route's form-action allows them, and it stays no-store
    {
        app: 'shop',
        // Shop P6 (F40): the hosted profile page's relay for a card kept outside a checkout
        path: /^\/(?:PaymentRelay|MethodRelay)\/?$/,
        formAction: [
            'https://accept.authorize.net',
            'https://test.authorize.net',
        ],
    },
    // IronStone Marketing P17 review (the user's call, Nov 15): Register's relay posts a fresh Accept Hosted form token to
    // Authorize.Net's page as Shop's does; only this route's form-action allows it, and it stays no-store
    {
        app: 'marketing',
        path: /^\/RegistrationRelay\/?$/,
        formAction: [
            'https://accept.authorize.net',
            'https://test.authorize.net',
        ],
    },
    // Smithy DG1 (plan/design-smithy.md §1): its read pages are public for a minute, and only for a request with no session
    // cookie and no signed-in user (anonymousOnly), which sees public groups and repositories alone; a signed-in or
    // session request, so every members-only and private page, is no-store, as are the app's own paths under /-/ and the
    // create and import pages. A page answers no-store itself for a refusal and a redirect (Smithy/Smithy.js).
    // Smithy DG3: the issue pages (a repository's and a group's Issues, an issue, the new-issue form, Labels and Milestones)
    // and a commit's page, which lists the titles of the issues it names, are never kept by a cache, for a visitor either:
    // an issue may become confidential, and a page a cache kept would still show it. (The shells' Issues tab has its count
    // only for a signed-in account, whose pages no cache keeps: Smithy/Smithy.js openIssueCount.)
    // Smithy DG4: a merge request's pages (one may be held for review, and Not Found to others), the pages that edit a
    // file and the fork pages are never kept by a cache either.
    // Smithy DG6: nor the forum's pages inside a group's or a repository's shell (the forum's own are not kept either: a
    // topic may be hidden or moved, and its page carries the session's token for the reader's own controls) and the
    // scope's moderation pages.
    // Smithy DG5: nor the pipeline pages, a job's log and its uploads (-/pipelines…, -/artifacts/…): a log can hold
    // anything a job printed, and a merge request's run is hidden with it.
    // Smithy DG7: nor a release's file (-/release-assets/…, which the download answers no-store itself) and the Search page
    // (-/search, one of the app's own paths; it lists issues, which may become confidential). A group's addons.xml sets its
    // own (public for a visitor of a public group). Docs and Releases are read pages.
    {
        app: 'smithy',
        path: /\/-\/(?:issues|labels|milestones|commit|merge-requests|edit|new|upload|delete|fork|forks|forum|moderation|pipelines|artifacts|release-assets)(?:\/|$)/,
    },
    {
        app: 'smithy',
        path: /^\/(?!-(?:\/|$)|new(?:\/|$)|import(?:\/|$))/,
        cacheControl: 'public, max-age=60',
        anonymousOnly: true,
    },
]
/* The cookies of a session (the framework's, and a servlet container's): a request with one is not anonymous. */
const SESSION_COOKIES = /^(?:__Host-moqui\.session|moqui\.session|moquiSession|JSESSIONID)$/
/* Whether this request is anonymous and session-less: no signed-in user and no session cookie. */
function anonymous() {
    const request = ec.web?.request
    if (ec.user.userId || !request) return false
    return !request
        .getCookies()
        .some((cookie) => SESSION_COOKIES.test(cookie.name))
}
/* The policy of a request: its app (the mount it is in) and its path within that mount; a route for anonymous requests
 * only (anonymousOnly) is the default unless anonymous is true. */
function policyOf(app, path, isAnonymous) {
    const route = ROUTES.find((r) => r.app === app && r.path.test(path || '/'))
    if (route && route.anonymousOnly && !isAnonymous) return { ...DEFAULT }
    return { ...DEFAULT, ...(route || {}) }
}
const csp = (policy) =>
    Object.entries(CSP)
        .map(([name, sources]) =>
            [
                name,
                ...sources,
                ...(name === 'form-action' ? policy.formAction || [] : []),
                ...(name === 'img-src' ? policy.imgSrc || [] : []),
            ].join(' '),
        )
        .join('; ')
/* The https origin of a site's brand logo (getSiteInfo's brand.logoUrl), which the shell's img-src allows; a local logo is
 * 'self' already. Only a plain host and port, so nothing else reaches the policy. */
const logoOrigin = (logoUrl) =>
    /^https:\/\/[A-Za-z0-9.-]+(?::\d{1,5})?(?=[/?#]|$)/.exec(
        String(logoUrl || ''),
    )?.[0]
/* Set the headers of a request's route on the response, and answer the policy; logoUrl the site's brand logo. */
function apply(app, path, logoUrl) {
    const origin = logoOrigin(logoUrl)
    const policy = {
        ...policyOf(app, path, app ? anonymous() : false),
        ...(origin ? { imgSrc: [origin.toLowerCase()] } : {}),
    }
    const response = ec.web?.response
    if (response) {
        response.setHeader('Cache-Control', policy.cacheControl)
        // a page a cache may keep is the answer to a request with no cookie only: once a visitor has a session (signing
        // in), neither the browser's cache nor a shared one answers with the anonymous page; the anonymous page is in the
        // language the browser asks for, so a cache keeps one per Accept-Language
        if (String(policy.cacheControl).startsWith('public'))
            response.setHeader('Vary', 'Cookie, Accept-Language')
        response.setHeader('Referrer-Policy', 'same-origin')
        response.setHeader('Content-Security-Policy', csp(policy))
    }
    return policy
}
;({ ROUTES, policyOf, anonymous, csp, logoOrigin, apply })
