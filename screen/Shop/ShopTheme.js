/* Shop's live render path (impl-shop P2; design-shop §12.4, §12.7): the page view and active release from the
 * authority (getShopPage), the release's package verified file by file against its manifest's digests and kept by
 * release, then the composition adapter (ec.resource.theme.render) with PASS's trusted components. The same code runs
 * with a local Mantle and on a remote frontend, whose manifest and files come over its authority connection
 * (getShopThemeRelease and getShopThemeFiles, which the authority answers only to a registered frontend). A release
 * this frontend cannot verify, an engine or view API it does not have, or a page the adapter cannot render is the
 * built-in safe unavailable page, never a mix of files of two releases. Diagnostics go to the log, not to the page.
 * Shop F55: a release's binary asset (an image, a font) is in the package by reference, {digest, size, contentType}, as
 * its manifest pins it; its bytes are read by digest only when the asset is asked for (getShopThemeAsset), so the render
 * package stays text. A release published before carries the base64 of its bytes as text, served as before.
 * CC0 plus patent grant. */
const CACHE = 'pass.shop.themeReleases'
const VIEW_API_VERSIONS = [1]
const FILES_PER_CALL = 50
/* The content type of each asset type a release serves (by extension); anything else under assets/ is Not Found. */
const ASSET_TYPES = {
    css: 'text/css',
    svg: 'image/svg+xml',
    json: 'application/json',
    // Commerce P5 (F55): images and fonts, by digest (a release published before keeps the base64 of their bytes)
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    webp: 'image/webp',
    woff2: 'font/woff2',
}
const TEXT_ASSETS = ['css', 'svg', 'json']
/* How long a binary asset by digest may be kept: its bytes never change (Shop F55). */
const ASSET_CACHE = 'public, max-age=31536000, immutable'
/* The trusted components of the page kinds that place them (the authority's Themes.js requiredComponents): installed
 * PASS code, never theme source, each made from the page's view (escaped). P4: the purchase selection (a form posted to
 * the cart, its Show price the selection's quote) and the cart (the shopper's lines, codes and totals, given by the cart
 * page as context.cartComponent), each with its trusted Vue island (Shop/ShopCart.js); P5 the checkout's pages
 * (context.checkoutComponent, Shop/ShopCheckout.js). */
const cart = () =>
    ec.resource.script('component://mr-pass/screen/Shop/ShopCart.js')
const COMPONENTS = {
    'shop.productPurchase': {
        kinds: ['product'],
        html: (context, view) => cart().purchaseHtml(context, view),
    },
    'shop.cart': {
        kinds: ['cart'],
        html: (context) =>
            context.cartComponent
                ? context.cartComponent()
                : '<p class="shop-cart">' +
                  escapeText(ec.l10n.localize('Your cart is empty.')) +
                  '</p>',
    },
    // P5: the checkout's steps, the payment's result, its relay and the order confirmation (Shop/ShopCheckout.js), given by
    // the page as context.checkoutComponent
    'shop.checkout': {
        kinds: ['checkout'],
        html: (context) =>
            context.checkoutComponent
                ? context.checkoutComponent()
                : '<p class="shop-checkout">' +
                  escapeText(ec.l10n.localize('Your cart is empty.')) +
                  '</p>',
    },
    // P3: the search form, which a theme cannot make (no <form> in theme source)
    'shop.search': {
        kinds: ['search'],
        html: (context, view) => searchForm(view),
    },
}
const fail = (kind, message) => {
    const error = new Error(message)
    error.moquiErrorKind = kind
    throw error
}
/* An authority operation through the facade (local, or the configured remote authority). */
const facade = (operation, input) =>
    ec.service
        .sync()
        .throwOnError(true)
        .name('pass.Facade.call#Operation')
        .parameters({ operation, input })
        .call().result
const digestOf = (text) => ec.resource.digestText(String(text), 'sha256')
/* A release's package, verified: {manifest, files}. The manifest's text must have the digest the page named, and each
 * file the digest the manifest pins; the engine and view API must be this frontend's. Kept per site with its release and
 * digest, so a release is fetched once and a site's earlier releases do not stay in memory. `call` is the authority
 * call (the facade by default). */
function packageOf(siteId, release, call) {
    const ask = call || facade
    const key = release.releaseId + ':' + release.manifestDigest
    const cache = ec.cache.getCache(CACHE)
    const kept = cache.get(siteId)
    if (kept && kept.key === key) return kept.verified
    const found = ask('getShopThemeRelease', {
        siteId,
        releaseId: release.releaseId,
    })
    if (
        found.manifestDigest !== release.manifestDigest ||
        digestOf(found.manifestText) !== release.manifestDigest
    )
        fail(
            'Unavailable',
            'Release ' + release.releaseId + ' manifest does not match',
        )
    const manifest = JSON.parse(found.manifestText)
    if (!ec.resource.theme.engines().includes(manifest.engine))
        fail('Unavailable', 'Engine ' + manifest.engine + ' is not installed')
    if (!VIEW_API_VERSIONS.includes(Number(manifest.viewApiVersion)))
        fail(
            'Unavailable',
            'View API ' + manifest.viewApiVersion + ' is not supported',
        )
    const pinned = Object.fromEntries(
        (manifest.files || []).map((file) => [file.path, file]),
    )
    const paths = Object.keys(pinned)
    const files = {}
    for (let start = 0; start < paths.length; start += FILES_PER_CALL) {
        const batch = paths.slice(start, start + FILES_PER_CALL)
        const answer = ask('getShopThemeFiles', {
            siteId,
            releaseId: release.releaseId,
            paths: batch.join(','),
        })
        for (const file of answer.files || []) {
            const entry = verifiedEntry(pinned[file.path], file)
            if (entry == null)
                fail(
                    'Unavailable',
                    'Release ' +
                        release.releaseId +
                        ' file ' +
                        file.path +
                        ' does not match its digest',
                )
            files[file.path] = entry
        }
    }
    const missing = paths.filter((path) => files[path] == null)
    if (missing.length)
        fail(
            'Unavailable',
            'Release ' + release.releaseId + ' is missing ' + missing[0],
        )
    const verified = { manifest, files }
    cache.put(siteId, { key, verified })
    return verified
}
/* A file of a release as the package holds it, checked against its manifest entry: a text file's text when its digest is
 * the pinned one, a binary asset by reference ({digest, size, contentType}, Shop F55) when all three are the pinned ones
 * and its type is its extension's (in any case); else null. */
function verifiedEntry(pin, file) {
    if (!pin) return null
    if (typeof file.text === 'string')
        return digestOf(file.text) === pin.digest ? file.text : null
    // the extension in any case, as the authority and the adapter take it (assets/Logo.PNG is an image/png)
    const extension = String(file.path)
        .slice(String(file.path).lastIndexOf('.') + 1)
        .toLowerCase()
    if (
        !String(file.path).startsWith('assets/') ||
        TEXT_ASSETS.includes(extension) ||
        ASSET_TYPES[extension] !== file.contentType ||
        file.contentType !== pin.contentType ||
        typeof file.digest !== 'string' ||
        file.digest !== pin.digest ||
        Number(file.size) !== Number(pin.size)
    )
        return null
    return {
        digest: file.digest,
        size: Number(file.size),
        contentType: file.contentType,
    }
}
const escapeText = (text) =>
    String(text ?? '').replace(
        /[&<>"']/g,
        (c) =>
            ({
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#39;',
            })[c],
    )
/* P3's search form: a GET to the store's Search page with the current query. */
function searchForm(view) {
    return (
        '<form class="shop-search" method="get" role="search" action="' +
        escapeText(view?.shop?.searchUrl || 'Search') +
        '"><label>' +
        escapeText(ec.l10n.localize('Search the store')) +
        ' <input type="search" name="q" maxlength="100" value="' +
        escapeText(view?.page?.query || '') +
        '"></label><button type="submit">' +
        escapeText(ec.l10n.localize('Search')) +
        '</button></form>'
    )
}
/* The built-in safe page for a release or page that cannot be shown: no draft, source or diagnostic text. */
function unavailablePage(context) {
    const name = context?.store?.name || ec.l10n.localize('This store')
    const safe = escapeText(name)
    return (
        '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' +
        safe +
        '</title></head><body><main id="ShopUnavailable"><h1>' +
        escapeText(
            ec.resource.expand('${name} is not available right now', '', {
                name,
            }),
        ) +
        '</h1><p>' +
        escapeText(ec.l10n.localize('Please try again in a few minutes.')) +
        '</p></main></body></html>'
    )
}
/* The asset prefix of a release under the site's Shop mount: immutable by the manifest's digest. */
const assetBase = (context, release) =>
    (context.mount.base || '') + '/theme/' + release.manifestDigest
/* Render a Shop page through the active theme: {status, html, ok, omitted, failedRequired, releaseId}, or null when
 * the site has no published theme (the page keeps the PASS shell). `call` is the authority call (the facade by
 * default). */
function renderPage(context, pageKind, call, input) {
    const ask = call || facade
    const page = ask('getShopPage', {
        ...(input || {}),
        siteId: context.site.siteId,
        pageKind,
    })
    return renderView(context, pageKind, page, ask)
}
/* Render a getShopPage answer through its release (the same result as renderPage), or null when it has none. The
 * components given are the page kind's that the release declares (a release published before a component was added
 * does not place it, and the adapter refuses one given and not placed). */
function renderView(context, pageKind, page, call) {
    const ask = call || facade
    const release = page.release
    if (!release) return null
    let verified
    try {
        verified = packageOf(context.site.siteId, release, ask)
    } catch (error) {
        ec.logger.error(
            'Shop site ' +
                context.site.siteId +
                ' release ' +
                release.releaseId +
                ' unavailable: ' +
                error.message,
        )
        return {
            status: 503,
            ok: false,
            html: unavailablePage(context),
            omitted: [],
            failedRequired: [],
            releaseId: release.releaseId,
        }
    }
    let declared = null
    try {
        declared = JSON.parse(
            verified.files['theme.json'] || '{}',
        ).requiredComponents
    } catch (error) {
        declared = null
    }
    const components = Object.fromEntries(
        Object.entries(COMPONENTS)
            .filter(
                ([name, component]) =>
                    component.kinds.includes(pageKind) &&
                    (!Array.isArray(declared) || declared.includes(name)),
            )
            .map(([name, component]) => [
                name,
                { html: component.html(context, page.view) },
            ]),
    )
    const rendered = ec.resource.theme.render(
        { files: verified.files },
        {
            pageKind,
            // Commerce P5 (F77): the page's alternate template when the release has it
            ...(page.template ? { template: page.template } : {}),
            view: page.view,
            components,
            references: page.references || {},
            media: page.media || {},
            sources: page.sources || {},
            assetBase: assetBase(context, release),
            releaseId: release.releaseId,
        },
    )
    for (const diagnostic of rendered.diagnostics || [])
        if (diagnostic.severity === 'error')
            ec.logger.error(
                'Shop site ' +
                    context.site.siteId +
                    ' release ' +
                    release.releaseId +
                    ' ' +
                    pageKind +
                    ': ' +
                    diagnostic.file +
                    ':' +
                    diagnostic.line +
                    ' ' +
                    diagnostic.message,
            )
    if (!rendered.html)
        return {
            status: 503,
            ok: false,
            html: unavailablePage(context),
            omitted: rendered.omitted || [],
            failedRequired: rendered.failedRequired || [],
            releaseId: release.releaseId,
        }
    return {
        status: page.status || 200,
        ok: !!rendered.ok,
        html: rendered.html,
        omitted: rendered.omitted || [],
        failedRequired: rendered.failedRequired || [],
        releaseId: release.releaseId,
    }
}
/* Answer a release asset (the package's assets/, by the manifest's digest in the path) on the response: immutable,
 * nosniff, an SVG cleaned again and sandboxed. A binary asset by reference (Shop F55) streams its bytes by digest: in
 * process read from the location the authority answers, through a remote frontend the authority's download forwarded
 * (its Cache-Control the framework's immutable theme asset value). Anything else, or another release's digest, is Not
 * Found. */
function sendAsset(context, manifestDigest, assetPath, call) {
    const release = context.release
    const path = 'assets/' + String(assetPath || '')
    if (
        !release ||
        release.manifestDigest !== manifestDigest ||
        !/^assets\/[A-Za-z0-9_-]+(\/[A-Za-z0-9_.-]+)*\.[A-Za-z0-9]+$/.test(path) ||
        path.includes('..')
    )
        fail('NotFound', ec.l10n.localize('Not found'))
    let verified
    try {
        verified = packageOf(context.site.siteId, release, call)
    } catch (error) {
        fail('NotFound', ec.l10n.localize('Not found'))
    }
    let text = verified.files[path]
    // the extension in any case, as the authority and the adapter take it
    const extension = path.slice(path.lastIndexOf('.') + 1).toLowerCase()
    const type = ASSET_TYPES[extension]
    // only the asset types a theme serves: never its template source (.html.fancy-locked) or another file under assets/
    if (text == null || !type) fail('NotFound', ec.l10n.localize('Not found'))
    if (typeof text !== 'string')
        return sendBinary(context, release, path, text, call)
    if (extension === 'svg') text = ec.resource.theme.sanitizeSvg(text)
    const response = ec.web?.response
    if (!response) return { contentType: type, text }
    response.setContentType(
        TEXT_ASSETS.includes(extension) ? type + '; charset=utf-8' : type,
    )
    response.setHeader('Cache-Control', ASSET_CACHE)
    assetHeaders(response)
    response.write(
        TEXT_ASSETS.includes(extension)
            ? text
            : StringUtilities.base64Decode(text),
    )
    return { contentType: type, text }
}
const assetHeaders = (response) => {
    response.setHeader('X-Content-Type-Options', 'nosniff')
    response.setHeader(
        'Content-Security-Policy',
        "default-src 'none'; style-src 'unsafe-inline'; img-src 'self' data:",
    )
}
/* A binary asset by digest (Shop F55): {contentType, cacheControl, bytes} once answered. In process (or with a `call`
 * given) the authority's getShopThemeAsset names the file and its location, read as the authority reads it; a remote
 * frontend forwards the authority's download, which keeps the immutable Cache-Control only for this operation. */
function sendBinary(context, release, path, asset, call) {
    const input = {
        siteId: context.site.siteId,
        releaseId: release.releaseId,
        path,
        digest: asset.digest,
    }
    const response = ec.web?.response
    if (!call && ec.factory.getConfValue('pass@backend-url')) {
        if (response) assetHeaders(response)
        ec.resource
            .script('component://mr-pass/service/pass/Transport.js')
            .downloadOperation(context.site.siteId, 'getShopThemeAsset', input)
        return { contentType: asset.contentType, cacheControl: ASSET_CACHE }
    }
    let result
    try {
        result = (call || facade)('getShopThemeAsset', input)
    } catch (error) {
        fail('NotFound', ec.l10n.localize('Not found'))
    }
    if (!result?.location || result.file?.mimeType !== asset.contentType)
        fail('NotFound', ec.l10n.localize('Not found'))
    // the authority checked the release, path and digest; the bytes are read as it reads them (the database resource
    // store, which a public account may not read itself)
    const wasDisabled = ec.artifactExecution.disableAuthz()
    let bytes
    try {
        const stream = ec.resource
            .getLocationReference(result.location)
            .openStream()
        try {
            bytes = stream.readAllBytes()
        } finally {
            stream.close()
        }
    } finally {
        if (!wasDisabled) ec.artifactExecution.enableAuthz()
    }
    if (bytes.length !== asset.size) fail('NotFound', ec.l10n.localize('Not found'))
    if (response) {
        response.setContentType(asset.contentType)
        response.setHeader('Cache-Control', ASSET_CACHE)
        assetHeaders(response)
        response.write(bytes)
    }
    return { contentType: asset.contentType, cacheControl: ASSET_CACHE, bytes }
}
;({
    COMPONENTS,
    packageOf,
    renderPage,
    renderView,
    unavailablePage,
    sendAsset,
    escapeText,
})
