// The Shop app's mount and context (impl-shop P1; design-shop §1, §4.1, §4.3): only an operator targets Shop at a real store
// of an internal organization (an unknown and an outside organization's store refused); a site has one Shop mount and one
// root app, Forum or Shop, and a Shop at the root never takes the reserved or other apps' paths; a site or mount not
// published conceals the Shop; the context answers the same through the facade (local) and as a remote frontend gets it
// (the authority's envelope taken by the transport), and a refusal keeps its reason both ways.
const lib = () =>
    ec.resource.script('component://mr-pass/test/Shop/ShopSpecLib.js')
const SITE = 'PASS_SHOP_SITE',
    HOST = 'shop.example.test',
    ROOT_SITE = 'PASS_SHOP_ROOT',
    ROOT_HOST = 'root.shop.example.test'
spec({
    setupSpec() {
        login('john.doe')
        const l = lib()
        l.records()
        l.site(SITE, HOST)
        l.site(ROOT_SITE, ROOT_HOST, {
            theme: JSON.stringify({
                primaryColor: '#7a1f5c',
                textColor: 'red;}body{x',
                logoUrl: 'javascript:alert(1)',
            }),
        })
        setConf('pass-authority/client[' + l.ids.client + ']@secret',
            'pass-shop-spec-secret',
        )
        setConf('pass-authority/client[' + l.ids.client + ']@sites',
            [SITE, ROOT_SITE].join(','),
        )
    },
    cleanup() {
        login('john.doe')
    },
})
feature(
    'only an operator targets Shop at an internal organization’s store; a site has one Shop mount and one root app',
    {
        when() {
            const l = lib(),
                { store, outsideStore } = l.ids
            const core = [{ app: 'account', pathPrefix: '/account' }]
            const shop = (pathPrefix, targetId) => ({
                app: 'shop',
                pathPrefix,
                targetId,
            })
            const out = {
                unknown: l.mounts(SITE, [
                    ...core,
                    shop('/shop', 'NO_SUCH_STORE'),
                ]),
                outside: l.mounts(SITE, [...core, shop('/shop', outsideStore)]),
                noTarget: l.mounts(SITE, [
                    ...core,
                    { app: 'shop', pathPrefix: '/shop' },
                ]),
                two: l.mounts(SITE, [
                    ...core,
                    shop('/shop', store),
                    shop('/store', store),
                ]),
                nonRoot: l.mounts(SITE, [
                    { app: 'account', pathPrefix: '/' },
                    shop('/shop', store),
                ]),
                twoRoots: l.mounts(SITE, [
                    { app: 'forum', pathPrefix: '/' },
                    shop('/', store),
                ]),
                // the framework's, with each declared servlet's first segment (PASS's tracking scripts)
                reserved: [
                    '/static',
                    '/assets',
                    '/rest',
                    '/s',
                    '/WebPush',
                    '/trk',
                    '/trk-o',
                ].map(
                    (p) =>
                        l.mounts(SITE, [...core, shop(p, store)]).kind ||
                        'saved',
                ),
                saved: l.mounts(SITE, [...core, shop('/shop', store)]),
            }
            // the root site: Shop at '/', beside Account, Billing and Support
            out.root = l.mounts(
                ROOT_SITE,
                [
                    { app: 'account', pathPrefix: '/account' },
                    shop('/', store),
                    {
                        app: 'billing',
                        pathPrefix: '/billing',
                        targetId: l.ids.org,
                    },
                    {
                        app: 'support',
                        pathPrefix: '/support',
                        targetId: l.ids.org,
                    },
                ],
                [{ hostname: ROOT_HOST, canonical: true }],
            )
            // the site's readiness lists the store's findings (Commerce's check#StoreReadiness, the shop app's)
            out.readiness = l.facade('checkReadiness', {
                siteId: ROOT_SITE,
            }).result
            // a site owner's save (not an operator) cannot target
            logout()
            out.anonymous = l.mounts(SITE, [...core, shop('/shop', store)])
            login('john.doe')
            return out
        },
        then(o) {
            o.unknown.kind === 'Unprocessable'
            o.unknown.reason === 'targetInvalid'
            o.unknown.fieldErrors[0].field === 'targetId'
            o.outside.reason === 'targetInvalid'
            o.noTarget.reason === 'targetInvalid'
            o.two.reason === 'mountTaken'
            o.nonRoot.reason === 'rootNotAllowed'
            o.twoRoots.kind === 'Unprocessable'
            o.twoRoots.message.includes('overlap')
            o.reserved.every((k) => k === 'Unprocessable')
            o.saved.result.revision > 0
            o.root.result.revision > 0
            o.readiness.checks.some((c) => c.name.startsWith('shop '))
            o.readiness.checks.some(
                (c) => c.name.startsWith('shop ') && !c.ready,
            )
            o.readiness.ready === false
            ;['Unauthorized', 'NotFound'].includes(o.anonymous.kind)
        },
    },
)
feature(
    'a Shop at the root leaves Account, Billing, Support and its own canonical paths to their owners',
    {
        when() {
            const l = lib()
            l.setState(ROOT_SITE, 'published')
            const r = (path) => l.route(ROOT_SITE, ROOT_HOST, path)
            return {
                home: r('/'),
                product: r('/products/P100/stone-mug'),
                category: r('/categories/C10/mugs'),
                page: r('/pages/returns'),
                badProduct: r('/products/../x'),
                longProduct: r('/products/P1/slug/extra'),
                account: r('/account/Login'),
                billing: r('/billing/Invoices'),
                support: r('/support/SupportHome'),
                other: r('/Cart'),
            }
        },
        then(o) {
            o.home === '/Shop/'
            o.product === '/Shop/Products/ProductDetail'
            o.category === '/Shop/Categories/CategoryDetail'
            o.page === '/Shop/Page'
            o.badProduct.startsWith('refused:')
            o.longProduct.startsWith('refused:')
            o.account === '/Account/Login'
            o.billing === '/Billing/Invoices'
            o.support === '/Support/SupportHome'
            o.other === '/Shop/Cart'
        },
    },
)
feature(
    'an unpublished site or a disabled mount conceals the Shop; published, the root shows the store with the brand',
    {
        when() {
            const l = lib()
            l.setState(SITE, 'disabled')
            const unpublished = l.facade('getShopContext', { siteId: SITE })
            l.setState(SITE, 'published')
            const published = l.facade('getShopContext', { siteId: SITE })
            l.setShopEnabled(SITE, false)
            const disabled = l.facade('getShopContext', { siteId: SITE })
            l.setShopEnabled(SITE, true)
            const info = l.facade('getSiteInfo', {
                siteId: ROOT_SITE,
                hostname: ROOT_HOST,
            }).result
            // the root's one render: the Shop's Home in the PASS shell, with the site's brand
            logout()
            const home = l.render(ROOT_SITE, ROOT_HOST, '/', 'Shop')
            login('john.doe')
            const headers = ec.resource.script(
                'component://mr-pass/screen/Shared/Headers.js',
            )
            return {
                unpublished,
                published,
                disabled,
                info,
                home,
                policy: headers.policyOf('shop', '/'),
                csp: headers.csp(headers.policyOf('shop', '/')),
                // an https logo's origin joins img-src; nothing past a plain host and port does
                logo: headers.logoOrigin('https://cdn.example.test/logo.png'),
                forged: headers.logoOrigin("https://x.test;script-src/a"),
            }
        },
        then({ unpublished, published, disabled, info, home, policy, csp, logo, forged }) {
            unpublished.kind === 'NotFound'
            unpublished.reason === 'notAvailable'
            disabled.kind === 'NotFound'
            published.result.store.productStoreId === 'PASS_SHOP_STORE'
            published.result.mount.base === '/shop'
            published.result.currency === 'USD'
            published.result.release === null
            published.result.capabilities.canPurchase === false
            info.brand.primaryColor === '#7a1f5c'
            info.brand.textColor === undefined
            info.brand.logoUrl === undefined
            info.subscriptionUrl === null
            home.errors.length === 0
            home.html.includes('Shop Spec Store')
            home.html.includes('a{color:#7a1f5c}')
            home.html.includes('aria-label="Shop"')
            // an anonymous visitor's page may be shared-cached (P3, F42): no session token, no signed-in state
            home.html.includes('/account/Settings')
            !home.html.includes('moquiSessionToken')
            policy.cacheControl === 'no-store'
            // SEC-PSF-04: a default-src, so frames, fonts and connections are the site's own
            csp ===
                "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self' data:; connect-src 'self'; img-src 'self' data:; media-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'"
            logo === 'https://cdn.example.test'
            forged === undefined
        },
    },
)
feature(
    'a remote frontend gets the same context, and a refused write keeps its reason through the transport',
    {
        when() {
            const l = lib()
            const local = l.facade('getShopContext', {
                siteId: ROOT_SITE,
            }).result
            const far = l.remote('getShopContext', { siteId: ROOT_SITE }).result
            l.setState(SITE, 'disabled')
            const concealed = l.remote('getShopContext', { siteId: SITE })
            l.setState(SITE, 'published')
            const forged = l.remote('getShopContext', {
                siteId: ROOT_SITE,
                productStoreId: l.ids.outsideStore,
            })
            const input = {
                siteId: ROOT_SITE,
                expectedRevision: Number(l.siteRow(ROOT_SITE).policyRevision),
                mounts: [
                    {
                        app: 'shop',
                        pathPrefix: '/shop',
                        targetId: 'NO_SUCH_STORE',
                    },
                ],
            }
            const localWrite = l.facade('storeMounts', input)
            const remoteWrite = l.remote('storeMounts', input, {
                sessionChecked: true,
            })
            const portal = ec.resource.script(
                'component://mr-pass/screen/Shared/Portal.js',
            )
            const authority = ec.resource.script(
                'component://mr-mantle/script/PassAuthority.js',
            )
            return {
                local,
                far,
                concealed,
                forged,
                localWrite,
                remoteWrite,
                lists: [
                    Object.keys(portal.reasons).join(),
                    authority.REASONS.join(),
                ],
            }
        },
        then({
            local,
            far,
            concealed,
            forged,
            localWrite,
            remoteWrite,
            lists,
        }) {
            JSON.stringify(far) === JSON.stringify(local)
            far.mount.base === ''
            concealed.kind === 'NotFound'
            concealed.reason === 'notAvailable'
            concealed.envelope.message === 'Resource not found'
            forged.kind === 'Unprocessable'
            remoteWrite.kind === localWrite.kind
            remoteWrite.reason === 'targetInvalid'
            remoteWrite.envelope.reason === 'targetInvalid'
            remoteWrite.envelope.fieldErrors[0].field === 'targetId'
            remoteWrite.message === localWrite.message
            lists[0] === lists[1]
        },
    },
)
