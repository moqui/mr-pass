/* The theme preview host (impl-commerce P5, F54; design-shop §12.6): a site's PshkPreview host serves only the preview
 * render of a theme draft, `/preview/{token}` and its assets `/preview/{token}/asset/{path}`, for the Commerce editor to
 * frame. Every other route on it is Not Found (resolve#Route, Pass.xml). The token is the preview capability
 * (mantle.public.ThemeServices.create#ThemePreview): it is in the URL, never a cookie, and its page sends no-store,
 * noindex, no referrer and a CSP whose frame-ancestors are the BOSS origins of pass@preview-frame-origins (none: not
 * framed). The page is the draft rendered by the same composition adapter and trusted components as the live page,
 * with the view the authority answers (synthetic private state); it sends no mail and makes no cart or payment call
 * and declines a session (no cookie, no token, no Visit: impl-commerce F86). Previews are served by the authority's runtime only: a remote frontend (pass@backend-url) has no preview
 * host. The selection script talks to the editor only through the MessageChannel port the editor transfers with the
 * nonce of the preview's URL, from an allowed origin, and carries section ids only. CC0 plus patent grant. */
const PREVIEW_SERVICE = 'mantle.public.ThemeServices.get#ThemePreviewPage'
const HOST_SERVICE = 'mantle.public.ThemeServices.get#PreviewHost'
const TOKEN = /^[A-Za-z0-9]{20,80}$/
const ASSET = /^[A-Za-z0-9_-]+(\/[A-Za-z0-9_.-]+)*\.[a-z0-9]+$/
const SECTION_ID = /^[A-Za-z0-9_-]{1,64}$/
/* The content type of each asset type a preview serves (as the live sendAsset). */
const ASSET_TYPES = {
    css: 'text/css; charset=utf-8',
    svg: 'image/svg+xml; charset=utf-8',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    webp: 'image/webp',
    woff2: 'font/woff2',
}
const fail = (kind, message) => {
    const error = new Error(message)
    error.moquiErrorKind = kind
    throw error
}
const notFound = () => fail('NotFound', 'Page not found')
const local = () => !ec.factory.getConfValue('pass@backend-url')
/* Whether a host of a site is its preview host: only on the authority's runtime (with Mantle in process). */
function isPreviewHost(siteId, hostname) {
    if (!local() || !siteId || !hostname) return false
    ec.message.pushErrors()
    try {
        return (
            ec.service
                .sync()
                .name(HOST_SERVICE)
                .parameters({
                    siteId,
                    hostname: String(hostname).toLowerCase(),
                })
                .call()?.preview === true
        )
    } catch (error) {
        ec.logger.error(
            'Preview host check of ' + hostname + ' failed: ' + error.message,
        )
        return false
    } finally {
        ec.message.clearErrors()
        ec.message.popErrors()
    }
}
/* The route of a path on a preview host: the page or an asset of a token; anything else is Not Found. */
function route(path) {
    const parts = String(path || '')
        .split('/')
        .filter(Boolean)
    if (parts[0] !== 'preview' || !TOKEN.test(parts[1] || '')) notFound()
    if (parts.length === 2)
        return {
            screenPath: '/ShopPreview/page',
            screenParameters: { previewToken: parts[1] },
        }
    const assetPath = parts.slice(3).join('/')
    if (
        parts[2] !== 'asset' ||
        !ASSET.test(assetPath) ||
        assetPath.includes('..')
    )
        notFound()
    return {
        screenPath: '/ShopPreview/asset',
        screenParameters: { previewToken: parts[1], assetPath },
    }
}
/* The BOSS origins that may frame a preview (pass@preview-frame-origins, space or comma separated): https://host[:port],
 * or http on localhost, 127.0.0.1 or a *.localhost name, with :* for any port; anything else is left out. */
function frameOrigins() {
    return String(ec.factory.getConfValue('pass@preview-frame-origins') || '')
        .split(/[\s,]+/)
        .map((origin) => origin.trim().replace(/\/$/, '').toLowerCase())
        .filter((origin) => {
            const match = /^(https?):\/\/([a-z0-9.-]+)(?::(\d{1,5}|\*))?$/.exec(
                origin,
            )
            if (!match) return false
            return (
                match[1] === 'https' ||
                ['localhost', '127.0.0.1'].includes(match[2]) ||
                match[2].endsWith('.localhost')
            )
        })
}
/* The preview's response headers: no-store, noindex, no referrer, and its own CSP (a script only by nonce). */
function headers(response, scriptNonce) {
    const origins = frameOrigins()
    response.setHeader('Cache-Control', 'no-store')
    response.setHeader('X-Robots-Tag', 'noindex, nofollow')
    response.setHeader('Referrer-Policy', 'no-referrer')
    response.setHeader('X-Content-Type-Options', 'nosniff')
    response.setHeader(
        'Content-Security-Policy',
        [
            "default-src 'self'",
            "script-src 'nonce-" + scriptNonce + "'",
            "img-src 'self' data:",
            "style-src 'self' 'unsafe-inline'",
            "connect-src 'none'",
            "object-src 'none'",
            "base-uri 'none'",
            "form-action 'none'",
            'frame-ancestors ' +
                (origins.length ? origins.join(' ') : "'none'"),
        ].join('; '),
    )
}
/* The authority's answer for a token on its site's host, or Not Found. */
function previewOf(siteId, hostname, token, assetPath) {
    if (!local() || !TOKEN.test(String(token || ''))) notFound()
    ec.message.pushErrors()
    try {
        const out = ec.service
            .sync()
            .name(PREVIEW_SERVICE)
            .parameters({
                siteId,
                hostname: String(hostname || '').toLowerCase(),
                token: String(token),
                ...(assetPath ? { assetPath } : {}),
            })
            .call()
        if (ec.message.hasError() || !out) notFound()
        return out
    } catch (error) {
        notFound()
    } finally {
        ec.message.clearErrors()
        ec.message.popErrors()
    }
}
/* The selection script: the editor's port (from an allowed origin, with the URL's nonce), a click on a section sends its
 * id, the editor's highlight shows one; links and forms do nothing in a preview. */
function selectionScript(scriptNonce, origins) {
    const allowed = JSON.stringify(origins).replace(/</g, '\\u003c')
    return (
        '<style>[data-preview-selected]{outline:3px solid #1976d2;outline-offset:2px}</style><script nonce="' +
        scriptNonce +
        '">(function(){var allowed=' +
        allowed +
        ';var nonce=new URLSearchParams(location.search).get("n")||"";var port=null;var id=/^[A-Za-z0-9_-]{1,64}$/;' +
        'function ok(o){return allowed.some(function(a){if(a.slice(-2)===":*"){var b=a.slice(0,-2);return o===b||(o.indexOf(b+":")===0&&/^\\d+$/.test(o.slice(b.length+1)))}return o===a})}' +
        'function mark(s){document.querySelectorAll("[data-preview-selected]").forEach(function(e){e.removeAttribute("data-preview-selected")});' +
        'if(!id.test(s||""))return;var e=document.querySelector("[data-section-id=\\""+s+"\\"]");if(e){e.setAttribute("data-preview-selected","");e.scrollIntoView({block:"nearest"})}}' +
        'window.addEventListener("message",function(e){if(port||e.source!==window.parent||!ok(e.origin)||!nonce||!e.data||e.data.type!=="moqui-theme-preview"||e.data.nonce!==nonce||!e.ports||!e.ports[0])return;' +
        'port=e.ports[0];port.onmessage=function(m){var d=m.data||{};if(d.type==="highlight")mark(d.sectionId)};port.postMessage({type:"ready"})});' +
        'document.addEventListener("click",function(e){var t=e.target.closest?e.target:e.target.parentElement;if(!t)return;var s=t.closest("[data-section-id]");' +
        'if(t.closest("a,button,form,input,select,label"))e.preventDefault();if(s&&port&&id.test(s.getAttribute("data-section-id")))port.postMessage({type:"select",sectionId:s.getAttribute("data-section-id")})},true);' +
        'document.addEventListener("submit",function(e){e.preventDefault()},true)})();</script>'
    )
}
/* The preview page of a token: the draft rendered through the adapter with the page kind's trusted components (those
 * theme.json declares), answered as a whole document; a draft the adapter cannot render shows the safe unavailable page
 * with the reason in the log. */
function page(siteId, hostname, token) {
    ec.web?.declineSession()
    const response = ec.web?.response
    const preview = previewOf(siteId, hostname, token)
    const theme = ec.resource.script(
        'component://mr-pass/screen/Shop/ShopTheme.js',
    )
    let declared = null
    try {
        declared = JSON.parse(
            preview.files['theme.json'] || '{}',
        ).requiredComponents
    } catch (error) {
        declared = null
    }
    const context = {
        site: { siteId },
        mount: { base: '' },
        store: { name: preview.view?.shop?.name || '' },
    }
    const components = {}
    for (const [name, component] of Object.entries(theme.COMPONENTS)) {
        if (!component.kinds.includes(preview.pageKind)) continue
        if (Array.isArray(declared) && !declared.includes(name)) continue
        try {
            components[name] = { html: component.html(context, preview.view) }
        } catch (error) {
            components[name] = {
                error: ec.l10n.localize('not available in a preview'),
            }
        }
    }
    const rendered = ec.resource.theme.render(
        { files: preview.files },
        {
            pageKind: preview.pageKind,
            ...(preview.template ? { template: preview.template } : {}),
            view: preview.view,
            components,
            references: preview.references || {},
            media: preview.media || {},
            sources: preview.sources || {},
            assetBase: '/preview/' + token + '/asset',
            releaseId: 'preview-' + preview.previewId,
            limits: { pageTimeMs: 3000 },
        },
    )
    for (const diagnostic of rendered.diagnostics || [])
        if (diagnostic.severity === 'error')
            ec.logger.warn(
                'Theme preview ' +
                    preview.previewId +
                    ' ' +
                    preview.pageKind +
                    ': ' +
                    diagnostic.file +
                    ':' +
                    diagnostic.line +
                    ' ' +
                    diagnostic.message,
            )
    const scriptNonce = ec.user.randomString(24).replace(/[^A-Za-z0-9]/g, 'x')
    let html = rendered.html || theme.unavailablePage(context)
    const script = selectionScript(scriptNonce, frameOrigins())
    html = html.includes('</body>')
        ? html.replace(/<\/body>(?![\s\S]*<\/body>)/, script + '</body>')
        : html + script
    if (!response)
        return { html, omitted: rendered.omitted || [], ok: !!rendered.ok }
    headers(response, scriptNonce)
    response.setContentType('text/html; charset=utf-8')
    response.write(html)
    return { html, omitted: rendered.omitted || [], ok: !!rendered.ok }
}
/* A draft asset of a token: its bytes or text, no-store (a draft changes), an SVG cleaned again, sandboxed. */
function asset(siteId, hostname, token, assetPath) {
    ec.web?.declineSession()
    const extension = String(assetPath || '').slice(
        String(assetPath || '').lastIndexOf('.') + 1,
    )
    const type = ASSET_TYPES[extension]
    if (!type || !ASSET.test(String(assetPath || ''))) notFound()
    const found = previewOf(siteId, hostname, token, assetPath).asset
    if (!found) notFound()
    let body = found.text
    if (found.binary) body = StringUtilities.base64Decode(found.text)
    else if (extension === 'svg')
        body = ec.resource.theme.sanitizeSvg(found.text)
    const response = ec.web?.response
    if (!response) return { contentType: type, body }
    response.setContentType(type)
    response.setHeader('Cache-Control', 'no-store')
    response.setHeader('X-Content-Type-Options', 'nosniff')
    response.setHeader('Referrer-Policy', 'no-referrer')
    response.setHeader(
        'Content-Security-Policy',
        "default-src 'none'; style-src 'unsafe-inline'; img-src 'self' data:",
    )
    response.write(body)
    return { contentType: type, body }
}
;({
    SECTION_ID,
    isPreviewHost,
    route,
    frameOrigins,
    headers,
    page,
    asset,
})
