// The theme preview host (impl-commerce P5, F54; design-shop §12.6; Shop/ShopPreview.js, ShopPreview.xml): on a site's
// preview host only /preview/{token} and its assets route, everything else is Not Found, and the live host never reaches
// the preview; the preview page is the draft rendered through the adapter with the trusted components, its sections
// marked for selection and its script by nonce, sent no-store, noindex, without referrer and framed only by the
// configured BOSS origins; a token of another site or a forged one is Not Found. An image uploaded to the draft (F55) is
// served as bytes by the preview and, once published, by the live asset route by its digest, immutable (Shop F55: the
// release's package names it by reference; only a registered frontend reads it by digest); a release published before,
// whose image is base64 text, still serves it.
const lib = () =>
    ec.resource.script('component://mr-pass/test/Shop/ShopSpecLib.js')
const preview = () =>
    ec.resource.script('component://mr-pass/screen/Shop/ShopPreview.js')
const theme = () =>
    ec.resource.script('component://mr-pass/screen/Shop/ShopTheme.js')
const T = 'mantle.public.ThemeServices.'
const SITE = 'PASS_SHOP_PREVIEW',
    HOST = 'preview-live.shop.example.test',
    PREVIEW_HOST = 'preview.preview-live.shop.example.test'
const state = {}
// A 1x1 PNG.
const PNG =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
/* The response a page writes its headers to. */
function fakeResponse() {
    const headers = {}
    return { headers, setHeader: (name, value) => (headers[name] = value) }
}
spec({
    setupSpec() {
        login('john.doe')
        const l = lib()
        l.records()
        l.site(SITE, HOST)
        l.mounts(SITE, [
            { app: 'shop', pathPrefix: '/', targetId: l.ids.store },
        ])
        l.run('create#mantle.public.PublicSiteHost', {
            hostname: PREVIEW_HOST,
            siteId: SITE,
            canonical: 'N',
            hostKindEnumId: 'PshkPreview',
        })
        state.themeId = l.run(T + 'create#ThemeDraft', {
            productStoreId: l.ids.store,
            starter: 'mr-pass/starter',
        }).themeId
        const made = l.run(T + 'create#ThemePreview', {
            themeId: state.themeId,
            siteId: SITE,
            pageKind: 'home',
        })
        state.token = made.previewPath.split('/').pop()
    },
    cleanup() {
        login('john.doe')
    },
})
feature(
    'the preview host routes only the preview, and the live host never reaches it',
    {
        when() {
            const l = lib()
            return {
                page: l.route(SITE, PREVIEW_HOST, '/preview/' + state.token),
                asset: l.route(
                    SITE,
                    PREVIEW_HOST,
                    '/preview/' + state.token + '/asset/store.css',
                ),
                home: l.route(SITE, PREVIEW_HOST, '/'),
                account: l.route(SITE, PREVIEW_HOST, '/account/Login'),
                parent: l.route(
                    SITE,
                    PREVIEW_HOST,
                    '/preview/' + state.token + '/asset/../theme.json',
                ),
                live: l.route(SITE, HOST, '/preview/' + state.token),
                hostKind: preview().isPreviewHost(SITE, PREVIEW_HOST),
                liveKind: preview().isPreviewHost(SITE, HOST),
            }
        },
        then({ page, asset, home, account, parent, live, hostKind, liveKind }) {
            page === '/ShopPreview/page'
            asset === '/ShopPreview/asset'
            home === 'refused:NotFound'
            account === 'refused:NotFound'
            parent === 'refused:NotFound'
            live === '/Shop/preview/' + state.token
            hostKind === true
            liveKind === false
        },
    },
)
feature(
    'a preview host check that fails answers Unavailable, never a live host of the site (SEC-PSF-06)',
    {
        when() {
            // the module with an authority whose host check throws (a database that is down)
            const source = ec.resource.getLocationText(
                'component://mr-pass/screen/Shop/ShopPreview.js',
            )
            // a call that throws, and one that answers null with its errors set (a service's failure without throwOnError)
            const withService = (call, hasError) =>
                runInContext(source, {
                    ec: {
                        factory: { getConfValue: () => null },
                        service: {
                            sync: () => {
                                const builder = {
                                    name: () => builder,
                                    parameters: () => builder,
                                    throwOnError: () => builder,
                                    call,
                                }
                                return builder
                            },
                        },
                        message: {
                            pushErrors() {},
                            clearErrors() {},
                            popErrors() {},
                            hasError: () => hasError,
                            getErrorsString: () => 'the database is down',
                        },
                        logger: { error() {} },
                    },
                })
            const kindOf = (module) => {
                try {
                    return 'answered ' + module.isPreviewHost(SITE, PREVIEW_HOST)
                } catch (error) {
                    return error.moquiErrorKind || 'Error'
                }
            }
            return {
                thrown: kindOf(
                    withService(() => {
                        throw new Error('the database is down')
                    }, false),
                ),
                silent: kindOf(withService(() => null, true)),
                live: kindOf(withService(() => ({ preview: false }), false)),
            }
        },
        then({ thrown, silent, live }) {
            thrown === 'Unavailable'
            silent === 'Unavailable'
            live === 'answered false'
        },
    },
)
feature(
    'the preview page is the draft through the adapter, marked for selection, framed only by the BOSS origins',
    {
        when() {
            const response = fakeResponse()
            const rendered = preview().page(SITE, PREVIEW_HOST, state.token)
            preview().headers(response, 'NONCE123')
            const css = preview().asset(
                SITE,
                PREVIEW_HOST,
                state.token,
                'store.css',
            )
            const refused = (siteId, host, token) => {
                try {
                    preview().page(siteId, host, token)
                    return 'served'
                } catch (error) {
                    return error.moquiErrorKind
                }
            }
            return {
                rendered,
                scriptByNonce: /<script nonce="[A-Za-z0-9]+">/.test(
                    rendered.html,
                ),
                headers: response.headers,
                css,
                otherHost: refused(SITE, HOST, state.token),
                forged: refused(
                    SITE,
                    PREVIEW_HOST,
                    state.token.slice(0, -1) +
                        (state.token.endsWith('Q') ? 'R' : 'Q'),
                ),
            }
        },
        then({ rendered, scriptByNonce, headers, css, otherHost, forged }) {
            rendered.html.includes('Shop Spec Store')
            rendered.html.includes('data-section-id="hero"')
            scriptByNonce
            rendered.html.includes('"moqui-theme-preview"')
            rendered.html.includes(
                '/preview/' + state.token + '/asset/store.css',
            )
            headers['Cache-Control'] === 'no-store'
            headers['X-Robots-Tag'] === 'noindex, nofollow'
            headers['Referrer-Policy'] === 'no-referrer'
            headers['Content-Security-Policy'].includes(
                'frame-ancestors http://localhost:* http://127.0.0.1:*',
            )
            headers['Content-Security-Policy'].includes(
                "script-src 'nonce-NONCE123'",
            )
            headers['Content-Security-Policy'].includes("form-action 'none'")
            css.contentType.startsWith('text/css')
            otherHost === 'NotFound'
            forged === 'NotFound'
        },
    },
)
feature(
    'an image uploaded to the draft is served as bytes by the preview and, published, by the live asset route',
    {
        when() {
            const l = lib()
            const revision = Number(
                ec.entity
                    .find('mantle.public.PublicTheme')
                    .condition({ themeId: state.themeId })
                    .disableAuthz()
                    .one().draftRevision,
            )
            const uploaded = l.run(T + 'store#ThemeAsset', {
                themeId: state.themeId,
                expectedRevision: revision,
                path: 'hero.png',
                contentBase64: PNG,
            })
            const previewed = preview().asset(
                SITE,
                PREVIEW_HOST,
                state.token,
                'hero.png',
            )
            l.setState(SITE, 'published')
            const { validationDigest } = l.run(T + 'validate#Theme', {
                themeId: state.themeId,
            })
            const published = l.run(T + 'publish#Theme', {
                operationKey: 'SHOPPRV-' + Date.now(),
                themeId: state.themeId,
                siteId: SITE,
                validationDigest,
                expectedActiveRevision: 0,
            })
            const shop = l.facade('getShopContext', { siteId: SITE }).result
            const live = theme().sendAsset(
                shop,
                published.manifestDigest,
                'hero.png',
            )
            const entry = theme().packageOf(SITE, shop.release).files[
                'assets/hero.png'
            ]
            // the authority's download of it, to a browser and to a registered frontend
            const asked = (clientId) =>
                ec.resource
                    .script('component://mr-mantle/script/PassAuthority.js')
                    .handle({
                        operation: 'getShopThemeAsset',
                        siteId: SITE,
                        input: {
                            releaseId: published.releaseId,
                            path: 'assets/hero.png',
                            digest: entry.digest,
                        },
                        ...(clientId ? { clientId, clientVerified: true } : {}),
                    })
            setConf('pass-authority/client[' + l.ids.client + ']@sites', SITE)
            const browser = asked(null)
            const frontend = asked(l.ids.client)
            // as publish pinned it before: the digest of the image's base64 text, in the release's manifest and its row
            const digestOf = (text) => ec.resource.digestText(text, 'sha256')
            const release = ec.entity
                .find('mantle.public.PublicThemeRelease')
                .condition({ releaseId: published.releaseId })
                .disableAuthz()
                .one()
            const manifest = JSON.parse(release.manifestText)
            Object.assign(
                manifest.files.find((file) => file.path === 'assets/hero.png'),
                { digest: digestOf(PNG), size: PNG.length },
            )
            const manifestText = JSON.stringify(manifest)
            l.run('update#mantle.public.PublicThemeRelease', {
                releaseId: published.releaseId,
                manifestText,
                manifestDigest: digestOf(manifestText),
            })
            l.run('update#mantle.public.PublicThemeReleaseFile', {
                releaseId: published.releaseId,
                filePath: 'assets/hero.png',
                digest: digestOf(PNG),
                fileSize: PNG.length,
            })
            const before = l.facade('getShopContext', { siteId: SITE }).result
            const old = theme().sendAsset(
                before,
                before.release.manifestDigest,
                'hero.png',
            )
            return { uploaded, previewed, live, entry, browser, frontend, old }
        },
        then({ uploaded, previewed, live, entry, browser, frontend, old }) {
            uploaded.path === 'assets/hero.png'
            previewed.contentType === 'image/png'
            previewed.body.length === 70
            previewed.body[0] === 0x89
            entry.contentType === 'image/png'
            entry.size === 70
            live.contentType === 'image/png'
            live.cacheControl === 'public, max-age=31536000, immutable'
            live.bytes.length === 70
            live.bytes[0] === 0x89
            browser.error.status === 404
            frontend.download.cacheControl ===
                'public, max-age=31536000, immutable'
            frontend.download.disposition === 'inline'
            frontend.download.contentType === 'image/png'
            old.contentType === 'image/png'
            old.text === PNG
        },
    },
)
// Shop F55: a frontend takes a binary asset by reference only as its manifest pins it, whatever the extension's case (as
// the authority and the adapter take it); a text file named by reference, or another content type, fails the release.
feature(
    'a binary asset by reference is verified against its pin, its extension in any case',
    {
        when() {
            const engine = ec.resource.theme.engines()[0]
            const digest = 'a'.repeat(64)
            const verify = (path, answered) => {
                const pin = { path, digest, size: 70, contentType: 'image/png' }
                const manifestText = JSON.stringify({
                    engine,
                    viewApiVersion: 1,
                    files: [pin],
                })
                const manifestDigest = ec.resource.digestText(
                    manifestText,
                    'sha256',
                )
                const ask = (operation) =>
                    operation === 'getShopThemeRelease'
                        ? { manifestDigest, manifestText }
                        : { files: [Object.assign({}, pin, answered)] }
                try {
                    return theme().packageOf(
                        'PASS_SHOP_PREVIEW_PIN',
                        { releaseId: 'R' + manifestDigest, manifestDigest },
                        ask,
                    ).files[path]
                } catch (error) {
                    return { error: error.moquiErrorKind }
                }
            }
            return {
                upper: verify('assets/Logo.PNG', {}),
                otherType: verify('assets/logo.png', {
                    contentType: 'image/gif',
                }),
                textByReference: verify('assets/store.css', {}),
            }
        },
        then({ upper, otherType, textByReference }) {
            upper.contentType === 'image/png'
            upper.size === 70
            otherType.error === 'Unavailable'
            textByReference.error === 'Unavailable'
        },
    },
)
