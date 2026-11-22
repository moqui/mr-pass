/* Shop's catalog pages (impl-shop P3; design-shop §5, §11, §12.7): Home, Categories, a category, Search, a product and a
 * published page, each one getShopPage call (the page kind's view from the authority, local or remote) rendered through
 * the active release (ShopTheme.js renderView), or, with no published release, the same view in the PASS shell
 * (Catalog.html.fancy). The page's states: a product, category or page that is not public is the theme's not-found page
 * (404) unless the site redirects its path (resolveSiteRedirect, after the access check failed); an old slug is
 * redirected to the canonical URL after the access check passed; a release that cannot be shown is the safe unavailable
 * page (503). The response headers: Pass.xml set the route's policy (public for a minute only for an anonymous request
 * with no session, Shared/Headers.js); any answer but 200 is no-store, and a public one carries an ETag of its content, so
 * a revalidation is answered 304. The head gains, for current public pages only, the canonical page's hreflang, the
 * product's structured data (schema.org, from the same view the page shows) and noindex on a search. CC0 plus patent
 * grant. */
const theme = () =>
    ec.resource.script('component://mr-pass/screen/Shop/ShopTheme.js')
const portal = () =>
    ec.resource.script('component://mr-pass/screen/Shared/Portal.js')
const escapeText = (text) => theme().escapeText(text)

/* The visitor-facing origin of the request (scheme, host and port), for absolute URLs. */
function originOf() {
    const request = ec.web?.request
    if (!request) return ''
    const url = String(request.getRequestURL() || '')
    const path = String(request.getRequestURI() || '')
    return path && url.endsWith(path)
        ? url.slice(0, url.length - path.length)
        : url.replace(/^(https?:\/\/[^/]+).*$/, '$1')
}
/* JSON for an inline data block: no "<" can close the element. */
const dataJson = (value) => JSON.stringify(value).replace(/</g, '\\u003c')
/* The schema.org availability of a band. */
const availabilityUrl = (code) =>
    'https://schema.org/' +
    ({
        inStock: 'InStock',
        lowStock: 'LimitedAvailability',
        backorder: 'BackOrder',
        outOfStock: 'OutOfStock',
    }[code] || 'InStock')
/* The structured product data of a product view: the visible name, SKU, URL, price and availability. */
function productData(view, origin) {
    const product = view.product
    if (!product) return null
    const data = {
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: product.name,
        sku: product.sku,
        url: origin + product.url,
    }
    if (product.price?.available)
        data.offers = {
            '@type': 'Offer',
            price: product.price.amount,
            priceCurrency: product.price.currencyUomId,
            availability: availabilityUrl(product.availability?.code),
            url: origin + product.url,
        }
    return data
}
/* What the head gains: hreflang of the canonical page, the product's data, noindex for a search with a query. */
function headExtras(kind, view) {
    const origin = originOf()
    const parts = []
    const canonical = view.page?.canonicalUrl
    if (canonical && kind !== 'search')
        parts.push(
            '<link rel="alternate" hreflang="' +
                escapeText(view.page.locale || view.locale || 'en') +
                '" href="' +
                escapeText(origin + canonical) +
                '">',
        )
    if (kind === 'search' && view.page?.query)
        parts.push('<meta name="robots" content="noindex">')
    const data = kind === 'product' ? productData(view, origin) : null
    if (data)
        parts.push(
            '<script type="application/ld+json">' +
                dataJson(data) +
                '</script>',
        )
    return parts.join('')
}
const withHead = (html, extras) =>
    extras && html.includes('</head>')
        ? html.replace('</head>', extras + '</head>')
        : html
/* The response's caching for a status: only a 200 keeps the route's public policy, with an ETag of its content. */
function cacheHeaders(status, html, policy) {
    const response = ec.web?.response
    if (!response) return
    if (
        status !== 200 ||
        !String(policy?.cacheControl || '').startsWith('public')
    ) {
        response.setHeader('Cache-Control', 'no-store')
        return
    }
    response.setHeader(
        'ETag',
        'W/"' +
            ec.resource.digestText(String(html || ''), 'sha256').slice(0, 32) +
            '"',
    )
}
/* A response with a status other than 200, written here: the framework opens a screen's output with 200 whatever status
 * its actions set (F-SP3-1), and a body written first keeps its status. The page's template then writes nothing. */
function commit(status, html) {
    const response = ec.web?.response
    if (response) {
        response.setStatus(status)
        response.setHeader('Cache-Control', 'no-store')
        if (html) response.setContentType('text/html;charset=UTF-8')
        response.write(html || '')
    }
    return { status, html: '', written: true }
}
/* A redirect: its status and Location, written before the render; the page renders nothing. */
function redirect(url, status) {
    ec.web?.response?.setHeader('Location', url)
    return Object.assign(commit(status || 302, ''), { redirect: url })
}
/* A refusal the framework answers with its own page and status (a page in the PASS shell cannot set its status). */
function fail(kind, message) {
    const error = new Error(message)
    error.moquiErrorKind = kind
    throw error
}
/* The page's path and query as requested. */
const requestQuery = () => {
    const query = ec.web?.request?.getQueryString?.()
    return query ? '?' + query : ''
}
/* The not-found page of the release (404), or of the shell. */
function notFound(context) {
    const found = portal().attempt('getShopPage', {
        siteId: context.site.siteId,
        pageKind: 'not-found',
    })
    return finish(context, 'not-found', found.result || null, 404)
}
/* Render an answer: through its release, else in the shell; {status, html (a whole document) or view (the shell's)}. */
function finish(context, kind, page, status) {
    let out
    if (page && page.release) {
        const rendered = theme().renderView(context, kind, page)
        out =
            rendered && rendered.html
                ? {
                      status:
                          rendered.status === 200
                              ? status || 200
                              : rendered.status,
                      html:
                          rendered.status === 200
                              ? withHead(
                                    rendered.html,
                                    headExtras(kind, page.view),
                                )
                              : rendered.html,
                  }
                : { status: 503, html: theme().unavailablePage(context) }
    } else {
        if ((status || 200) === 404)
            fail('NotFound', ec.l10n.localize('Page not found'))
        out = shellPage(context, kind, page ? page.view : null, status || 200)
    }
    if (out.status !== 200) return commit(out.status, out.html)
    // a shell page's tag covers the shell's header too (the site's name, brand and mounts), not only the view
    cacheHeaders(
        out.status,
        out.html ||
            JSON.stringify([
                out.view || {},
                ec.context.get('siteInfo') || null,
            ]),
        policyOf(),
    )
    return out
}
/* The PASS shell's page of a view (no published release): the view, its rich text sanitized and the trusted forms. */
function shellPage(context, kind, view, status) {
    const clean = (value) =>
        value && typeof value.$richText === 'string'
            ? ec.resource.theme.sanitizeRichText(value.$richText)
            : null
    const components = theme().COMPONENTS
    return {
        status,
        html: null,
        kind,
        view,
        richBody: kind === 'page' ? clean(view?.page?.body) : null,
        richDescription:
            kind === 'product' ? clean(view?.product?.description) : null,
        purchaseHtml:
            kind === 'product'
                ? components['shop.productPurchase'].html(context, view)
                : '',
        searchHtml:
            kind === 'search'
                ? components['shop.search'].html(context, view)
                : '',
    }
}
/* A request parameter's first value, or null. */
function param(name) {
    const value = ec.web?.parameters?.[name]
    if (value == null || value === '') return null
    if (typeof value === 'object' && value.length != null)
        return value.length ? String(value[0]) : null
    return String(value)
}
/* The route's policy as Pass.xml set it (Shared/Headers.js): the response's Cache-Control so far. */
const policyOf = () => ({
    cacheControl: ec.web?.response?.getHeader('Cache-Control') || 'no-store',
})
/* A catalog page: its view from the authority (getShopPage with the page kind's input), rendered. options.canonical: the
 * request path, compared with the view's canonical URL (a product's or category's old slug is redirected). */
function show(context, kind, input, options) {
    const opts = options || {}
    const found = portal().attempt('getShopPage', {
        ...(input || {}),
        siteId: context.site.siteId,
        pageKind: kind,
    })
    if (found.error) {
        if (found.error.kind === 'NotFound') {
            if (opts.path) {
                const moved = portal().attempt('resolveSiteRedirect', {
                    siteId: context.site.siteId,
                    path: opts.path,
                })
                if (moved.result?.url)
                    return redirect(
                        moved.result.url,
                        Number(moved.result.status) || 301,
                    )
            }
            return notFound(context)
        }
        ec.logger.warn(
            'Shop ' +
                kind +
                ' page of ' +
                context.site.siteId +
                ' not shown: ' +
                found.error.message,
        )
        return commit(503, theme().unavailablePage(context))
    }
    const page = found.result
    const canonical = page.view?.page?.canonicalUrl
    if (
        opts.path &&
        canonical &&
        opts.path.replace(/\/$/, '') !== canonical.replace(/\/$/, '')
    )
        return redirect(canonical + requestQuery(), 301)
    return finish(context, kind, page, page.status || 200)
}
/* The robots.txt of the Shop mount: the catalog is open; the cart, checkout, account and search pages are not indexed;
 * the sitemap's address. */
function robots(context) {
    const base = context.mount.base || ''
    const text =
        'User-agent: *\n' +
        ['/Cart', '/Checkout', '/Account', '/Orders', '/Search']
            .map((path) => 'Disallow: ' + base + path + '\n')
            .join('') +
        'Sitemap: ' +
        originOf() +
        base +
        '/sitemap.xml\n'
    send('text/plain; charset=utf-8', text)
}
/* The sitemap of the store's current public pages (getShopSitemap), with absolute URLs. */
function sitemap(context) {
    const found = portal().attempt('getShopSitemap', {
        siteId: context.site.siteId,
    })
    if (found.error) {
        const response = ec.web?.response
        if (response) {
            response.setStatus(found.error.kind === 'NotFound' ? 404 : 503)
            response.setHeader('Cache-Control', 'no-store')
        }
        return
    }
    const origin = originOf()
    const xml =
        '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
        (found.result.entries || [])
            .map(
                (entry) =>
                    '<url><loc>' +
                    escapeText(origin + entry.path) +
                    '</loc></url>\n',
            )
            .join('') +
        '</urlset>\n'
    send('application/xml; charset=utf-8', xml)
}
function send(contentType, text) {
    const response = ec.web?.response
    if (!response) return
    response.setContentType(contentType)
    response.setHeader('X-Content-Type-Options', 'nosniff')
    const policy = policyOf()
    if (String(policy?.cacheControl || '').startsWith('public'))
        response.setHeader(
            'ETag',
            'W/"' + ec.resource.digestText(text, 'sha256').slice(0, 32) + '"',
        )
    response.write(text)
}
;({ show, notFound, robots, sitemap, headExtras, productData, originOf, param })
