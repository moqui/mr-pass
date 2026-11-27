// Shop's catalog pages on PASS (impl-shop P3; design-shop §5, §11, §12.7): one render of each catalog page kind through the
// published starter theme (Home, Categories, a category, Search, a product with its purchase selection and structured data,
// a published page, the not-found page), the shell's page without a release, the cache headers of each route (public for an
// anonymous request only), and a remote frontend's read-through cache keyed by the site's generation.
const lib = () =>
    ec.resource.script('component://mr-pass/test/Shop/ShopSpecLib.js')
const T = 'mantle.public.ThemeServices.'
const SITE = 'PASS_SHOP_CAT',
    HOST = 'catalog.shop.example.test'
const ids = {
    mug: 'PSC_MUG',
    draft: 'PSC_DRAFT',
    root: 'PSC_ROOT',
    cups: 'PSC_CUPS',
    space: 'PSCPAGES',
    store: 'PASS_SHOP_CAT_STORE',
}
const state = {}
/* One render under Pass.xml of a Shop page with its route's screen parameters: {html, errors}. */
function render(path, screenPath, parameters) {
    const rendered = ec.screen
        .makeTest()
        .rootScreen('component://mr-pass/screen/Pass.xml')
        .render(
            screenPath,
            {
                resolvedSiteId: SITE,
                publicHost: HOST,
                publicPath: path,
                ...(parameters || {}),
            },
            null,
        )
    return { html: rendered.output, errors: rendered.errorMessages }
}
spec({
    setupSpec() {
        login('john.doe')
        const l = lib()
        l.records()
        // a store of its own, so the other Shop specs' store stays empty
        if (
            !ec.entity
                .find('mantle.product.store.ProductStore')
                .condition({ productStoreId: ids.store })
                .disableAuthz()
                .one()
        )
            l.run('create#mantle.product.store.ProductStore', {
                productStoreId: ids.store,
                storeName: 'Shop Spec Catalog Store',
                organizationPartyId: l.ids.org,
                defaultCurrencyUomId: 'USD',
                defaultLocale: 'en_US',
            })
        l.site(SITE, HOST)
        l.mounts(SITE, [
            { app: 'account', pathPrefix: '/account' },
            { app: 'shop', pathPrefix: '/shop', targetId: ids.store },
        ])
        l.setState(SITE, 'published')
        setConf('pass-authority/client[' + l.ids.client + ']@secret',
            'pass-shop-spec-secret',
        )
        setConf('pass-authority/client[' + l.ids.client + ']@sites', SITE)
        const make = (entity, values) => l.run('create#' + entity, values)
        make('mantle.product.Product', {
            productId: ids.mug,
            productName: 'Spec stone mug',
            productTypeEnumId: 'PtDigital',
        })
        make('mantle.product.Product', {
            productId: ids.draft,
            productName: 'Spec draft mug',
            productTypeEnumId: 'PtDigital',
            statusId: 'PrdDraft',
        })
        for (const productId of [ids.mug, ids.draft]) {
            make('mantle.product.ProductPrice', {
                productId,
                pricePurposeEnumId: 'PppPurchase',
                priceTypeEnumId: 'PptCurrent',
                fromDate: 0,
                minQuantity: 1,
                price: '24.00',
                priceUomId: 'USD',
            })
            make('mantle.product.store.ProductStoreProduct', {
                productStoreId: ids.store,
                productId,
                fromDate: 0,
            })
        }
        make('mantle.product.category.ProductCategory', {
            productCategoryId: ids.root,
            categoryName: 'Spec root',
        })
        make('mantle.product.category.ProductCategory', {
            productCategoryId: ids.cups,
            categoryName: 'Spec cups',
        })
        make('mantle.product.category.ProductCategoryRollup', {
            productCategoryId: ids.cups,
            parentProductCategoryId: ids.root,
            fromDate: 0,
        })
        make('mantle.product.store.ProductStoreCategory', {
            productStoreId: ids.store,
            productCategoryId: ids.root,
            storeCategoryTypeEnumId: 'PsctBrowseRoot',
            fromDate: 0,
        })
        make('mantle.product.category.ProductCategoryMember', {
            productCategoryId: ids.cups,
            productId: ids.mug,
            fromDate: 0,
        })
        // a published page of the Shop mount: its wiki version bound
        const wiki = (verb, parameters) =>
            l.run('org.moqui.resource.WikiServices.' + verb, parameters)
        wiki('create#WikiSpace', {
            wikiSpaceId: ids.space,
            description: 'Shop catalog spec pages',
        })
        const wikiPageId = wiki('update#WikiPage', {
            wikiSpaceId: ids.space,
            pageName: 'Returns',
            pageText: 'Return within 30 days\n',
        }).wikiPageId
        const versionName = wiki('get#WikiPageHistory', { wikiPageId })
            .versionList[0].versionName
        wiki('set#PublishedVersion', {
            wikiPageId,
            publishedVersionName: versionName,
        })
        const shopMount = ec.entity
            .find('mantle.public.PublicSiteApp')
            .condition({ siteId: SITE, app: 'shop' })
            .disableAuthz()
            .one()
        make('mantle.public.PublicSitePage', {
            siteId: SITE,
            appMountId: shopMount.appMountId,
            routePath: 'returns',
            title: 'Spec returns',
            wikiPageId,
            versionName,
            fromDate: 0,
        })
        // the starter theme, published
        const themeId = l.run(T + 'create#ThemeDraft', {
            productStoreId: ids.store,
            starter: 'mr-pass/starter',
        }).themeId
        const { validationDigest } = l.run(T + 'validate#Theme', { themeId })
        state.release = l.run(T + 'publish#Theme', {
            operationKey:
                'SHOPCAT-' + Date.now() + '-' + Math.floor(Math.random() * 1e6),
            themeId,
            siteId: SITE,
            validationDigest,
            expectedActiveRevision: 0,
        })
    },
    cleanup() {
        login('john.doe')
    },
})
feature(
    'each catalog page kind renders once through the published theme, with only public products',
    {
        when() {
            logout()
            try {
                return {
                    home: render('/shop', 'Shop'),
                    categories: render('/shop/Categories', 'Shop/Categories'),
                    category: render(
                        '/shop/categories/' + ids.cups + '/spec-cups',
                        'Shop/Categories/CategoryDetail',
                        {
                            productCategoryId: ids.cups,
                        },
                    ),
                    search: render('/shop/Search', 'Shop/Search', { q: 'mug' }),
                    product: render(
                        '/shop/products/' + ids.mug + '/spec-stone-mug',
                        'Shop/Products/ProductDetail',
                        {
                            productId: ids.mug,
                            quantity: '2',
                        },
                    ),
                    draft: render(
                        '/shop/products/' + ids.draft + '/spec-draft-mug',
                        'Shop/Products/ProductDetail',
                        {
                            productId: ids.draft,
                        },
                    ),
                    page: render('/shop/pages/returns', 'Shop/Page', {
                        routePath: 'returns',
                    }),
                }
            } finally {
                login('john.doe')
            }
        },
        then({ home, categories, category, search, product, draft, page }) {
            ;[home, categories, category, search, product, draft, page].every(
                (r) => r.errors.length === 0,
            )
            ;[home, categories, category, search, product, page].every(
                (r) =>
                    r.html.includes(
                        'href="/shop/theme/' +
                            state.release.manifestDigest +
                            '/store.css"',
                    ) && !r.html.includes('moquiSessionToken'),
            )
            home.html.includes('Spec stone mug')
            !home.html.includes('Spec draft mug')
            categories.html.includes(
                'href="/shop/categories/' + ids.cups + '/spec-cups"',
            )
            category.html.includes('<h1>Spec cups</h1>')
            category.html.includes(
                'href="/shop/products/' + ids.mug + '/spec-stone-mug"',
            )
            !category.html.includes(ids.draft)
            search.html.includes('Spec stone mug')
            !search.html.includes('Spec draft mug')
            search.html.includes('role="search"')
            search.html.includes('<meta name="robots" content="noindex">')
            product.html.includes('<h1>Spec stone mug</h1>')
            product.html.includes('$24.00')
            product.html.includes('name="quantity"')
            product.html.includes('2 × $24.00 = $48.00')
            // P4: the purchase selection posts to the cart, its Show price to the quote, in its island
            product.html.includes('action="/shop/Cart/add"')
            product.html.includes('formaction="/shop/Cart/quote"')
            product.html.includes('>Add to cart</button>')
            product.html.includes('data-moqui-island="ShopPurchase"')
            product.html.includes('<script type="application/ld+json">')
            product.html.includes('"price":"24.00"')
            product.html.includes('hreflang="en-US"')
            draft.html.includes('This page is not available.')
            !draft.html.includes('Spec draft mug')
            page.html.includes('<h1>Spec returns</h1>')
            page.html.includes('Return within 30 days')
        },
    },
)
feature(
    'the catalog routes are public for a minute only for an anonymous request; a remote read is kept by generation',
    {
        when() {
            const headers = ec.resource.script(
                'component://mr-pass/screen/Shared/Headers.js',
            )
            const transport = ec.resource.script(
                'component://mr-pass/service/pass/Transport.js',
            )
            const paths = [
                '/',
                '/Categories',
                '/categories/C1/cups',
                '/Search',
                '/products/P1/mug',
                '/pages/returns',
                '/sitemap.xml',
            ]
            let fetches = 0
            let generation = 7
            const fetch = () => ({ answer: ++fetches, generation })
            const read = () => ({ generation, release: null })
            const input = { siteId: SITE, productId: ids.mug }
            logout()
            let cached
            try {
                cached = [
                    transport.readThrough('getProduct', input, fetch, read)
                        .answer,
                    transport.readThrough('getProduct', input, fetch, read)
                        .answer,
                ]
                ec.cache.getCache('pass.shop.siteGenerations').remove(SITE)
                generation = 8
                cached.push(
                    transport.readThrough('getProduct', input, fetch, read)
                        .answer,
                )
                cached.push(
                    transport.readThrough(
                        'getProduct',
                        { ...input, quantity: '2' },
                        fetch,
                        read,
                    ).answer,
                )
                // never a write or another operation's answer
                cached.push(
                    transport.readThrough('storeProfile', input, fetch, read)
                        .answer,
                )
                cached.push(
                    transport.readThrough('storeProfile', input, fetch, read)
                        .answer,
                )
            } finally {
                login('john.doe')
            }
            // signed in: never kept
            const signedIn = [
                transport.readThrough('getProduct', input, fetch, read).answer,
                transport.readThrough('getProduct', input, fetch, read).answer,
            ]
            return {
                anonymous: paths.map(
                    (path) => headers.policyOf('shop', path, true).cacheControl,
                ),
                session: paths.map(
                    (path) =>
                        headers.policyOf('shop', path, false).cacheControl,
                ),
                others: [
                    headers.policyOf('shop', '/Cart', true).cacheControl,
                    headers.policyOf('shop', '/theme/x/y', true).cacheControl,
                    headers.policyOf('account', '/', true).cacheControl,
                ],
                cached,
                signedIn,
                remote: lib().remote('getShopPage', {
                    siteId: SITE,
                    pageKind: 'product',
                    productId: ids.mug,
                }),
                local: lib().facade('getShopPage', {
                    siteId: SITE,
                    pageKind: 'product',
                    productId: ids.mug,
                }),
                remoteDraft: lib().remote('getProduct', {
                    siteId: SITE,
                    productId: ids.draft,
                }),
            }
        },
        then({
            anonymous,
            session,
            others,
            cached,
            signedIn,
            remote,
            local,
            remoteDraft,
        }) {
            anonymous.every((value) => value === 'public, max-age=60')
            session.every((value) => value === 'no-store')
            others.every((value) => value === 'no-store')
            cached == [1, 1, 2, 3, 4, 5]
            signedIn == [6, 7]
            JSON.stringify(remote.result.view) ===
                JSON.stringify(local.result.view)
            remote.result.generation === local.result.generation
            remote.result.view.product.price.amount === '24.00'
            remoteDraft.kind === 'NotFound'
        },
    },
)
feature(
    "a product's text with a replacement pattern goes into the head as it is (SEC-PSF-87)",
    {
        expect() {
            const page =
                '<html><head><title>T</title></head><body><script src="/a.js"></script></body></html>'
            const extras =
                '<script type="application/ld+json">{"name":"A $\' B $` C $& D $$"}</script>'
            ec.resource
                .script('component://mr-pass/screen/Shop/Catalog.js')
                .withHead(page, extras) ===
                '<html><head><title>T</title>' +
                    extras +
                    '</head><body><script src="/a.js"></script></body></html>'
        },
    },
)
