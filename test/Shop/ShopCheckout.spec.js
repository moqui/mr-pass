// Shop's checkout on PASS (impl-shop P5; design-shop §6 Checkout, PaymentResult, OrderConfirmation, §7.3, §13.1; F37, F71,
// F75): the checkout page's one render through the published starter theme (its steps as plain forms with the revision
// and operation id, the review's submit with the store's optional emails unchecked, never a capability); only the payment relay's route allows the provider's
// form-action; the checkout's writes and capability reads (POSTs) in all three TOKEN_WRITES lists, with getCart a POST;
// a remote frontend's checkout, its refusal of a stale submit, its submit and a provider's return read by the reference
// and key alone, the same as a local page's, its visitor key kept as its digest with the order (Marketing follow-up 4); a
// sign-in on a Shop site landing on its root app. The checkout's rules are Mantle's (mr-mantle test/order/ShopCheckout).
const lib = () =>
    ec.resource.script('component://mr-pass/test/Shop/ShopSpecLib.js')
const shopCart = () =>
    ec.resource.script('component://mr-pass/screen/Shop/ShopCart.js')
const shopCheckout = () =>
    ec.resource.script('component://mr-pass/screen/Shop/ShopCheckout.js')
const T = 'mantle.public.ThemeServices.'
const SITE = 'PASS_SHOP_CHECKOUT',
    HOST = 'checkout.shop.example.test'
const ids = {
    book: 'PSCHK_BOOK',
    store: 'PASS_SHOP_CHK_STORE',
    gateway: 'PSCHK_HOSTED',
    pending: 'PSCHK_PENDING',
}
const state = {}
const VISITOR_KEY = 'PassChkVisitor_0123456789ab'
const context = () => lib().facade('getShopContext', { siteId: SITE }).result
const CHECKOUT_OPS = [
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
]
// The cart-making specs of one run (mr-mantle's, mr-pass's and mr-boss's in one process) share this requester's Shop
// cart-creation throttle (30 in ten minutes, Shop P4): this window's bucket for the requester goes first, so this spec's
// carts are made (Commerce F128); the throttle itself is unchanged.
function resetCartCreations() {
    const requester = ec.resource
        .script('component://framework/service/org/moqui/public/Account.js')
        .requesterKey()
    const window = Math.floor(
        ec.user.timestampMillis(ec.user.nowTimestamp) / 600000,
    )
    const was = ec.artifactExecution.disableAuthz()
    try {
        ec.entity
            .find('moqui.security.public.AccountAttempt')
            .condition({
                bucketId: ec.user.singleUseCodeHash(
                    'cart-create:' + requester + ':' + window,
                ),
            })
            .deleteAll()
    } finally {
        if (!was) ec.artifactExecution.enableAuthz()
    }
}
spec({
    setupSpec() {
        login('john.doe')
        resetCartCreations()
        const l = lib()
        l.records()
        l.run('create#mantle.product.store.ProductStore', {
            productStoreId: ids.store,
            storeName: 'Shop Spec Checkout Store',
            organizationPartyId: l.ids.org,
            defaultCurrencyUomId: 'USD',
            defaultLocale: 'en_US',
            requireInventory: 'N',
            defaultDisableShippingCalc: 'Y',
        })
        l.run('create#mantle.product.store.ProductStoreSetting', {
            productStoreId: ids.store,
            settingTypeEnumId: 'PsstCheckoutTerms',
            fromDate: 0,
            settingValue: 'false',
        })
        l.run('create#mantle.account.method.PaymentGatewayConfig', {
            paymentGatewayConfigId: ids.gateway,
            paymentGatewayTypeEnumId: 'PgtTest',
            description: 'Spec hosted page',
            authorizeServiceName:
                'mantle.account.PaymentTestServices.hostedPending#PaymentAuthorization',
            captureServiceName:
                'mantle.account.PaymentTestServices.alwaysApprove#PaymentCapture',
            detailsServiceName:
                'mantle.account.PaymentTestServices.alwaysApprove#PaymentDetails',
        })
        l.run('create#mantle.account.method.PaymentGatewayOrganization', {
            organizationPartyId: l.ids.org,
            paymentGatewayConfigId: ids.gateway,
            fromDate: 0,
            isEnabled: 'Y',
        })
        l.run('create#mantle.product.store.ProductStorePaymentGateway', {
            productStoreId: ids.store,
            paymentInstrumentEnumId: 'PiCreditCard',
            paymentGatewayConfigId: ids.gateway,
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
        setConf('pass-authority/client[' + l.ids.client + ']@sites',
            'PASS_SHOP_CAT,PASS_SHOP_CART,' + SITE,
        )
        l.run('create#mantle.product.Product', {
            productId: ids.book,
            productName: 'Spec checkout guide',
            productTypeEnumId: 'PtDigital',
        })
        l.run('create#mantle.product.ProductPrice', {
            productId: ids.book,
            pricePurposeEnumId: 'PppPurchase',
            priceTypeEnumId: 'PptCurrent',
            fromDate: 0,
            minQuantity: 1,
            price: '10.00',
            priceUomId: 'USD',
        })
        l.run('create#mantle.product.store.ProductStoreProduct', {
            productStoreId: ids.store,
            productId: ids.book,
            fromDate: 0,
        })
        const themeId = l.run(T + 'create#ThemeDraft', {
            productStoreId: ids.store,
            starter: 'mr-pass/starter',
        }).themeId
        const { validationDigest } = l.run(T + 'validate#Theme', { themeId })
        state.release = l.run(T + 'publish#Theme', {
            operationKey:
                'SHOPCHK-' + Date.now() + '-' + Math.floor(Math.random() * 1e6),
            themeId,
            siteId: SITE,
            validationDigest,
            expectedActiveRevision: 0,
        })
    },
    cleanup() {
        ec.web.sessionAttributes.remove(shopCart().tokenKey(SITE))
        login('john.doe')
    },
})
feature(
    "the checkout page renders its steps through the theme's checkout component; only the relay's route allows the provider",
    {
        when() {
            logout()
            try {
                const c = context()
                shopCart().call(c, 'addCartItem', {
                    productId: ids.book,
                    quantity: '1',
                })
                shopCart().call(c, 'beginCheckout', {})
                shopCart().call(c, 'setCheckoutContact', {
                    emailAddress: 'reader@shop.example.test',
                    name: 'Rita Reader',
                })
                shopCart().call(c, 'selectPayment', {
                    paymentOptionId: 'PiCreditCard',
                })
                const rendered = ec.screen
                    .makeTest()
                    .rootScreen('component://mr-pass/screen/Pass.xml')
                    .render(
                        'Shop/Checkout',
                        {
                            resolvedSiteId: SITE,
                            publicHost: HOST,
                            publicPath: '/shop/Checkout',
                        },
                        null,
                    )
                const headers = ec.resource.script(
                    'component://mr-pass/screen/Shared/Headers.js',
                )
                return {
                    token: ec.web.sessionAttributes[shopCart().tokenKey(SITE)],
                    html: rendered.output,
                    errors: rendered.errorMessages,
                    relay: headers.csp(
                        headers.policyOf('shop', '/PaymentRelay', false),
                    ),
                    checkout: headers.csp(
                        headers.policyOf('shop', '/Checkout', false),
                    ),
                    relayCache: headers.policyOf('shop', '/PaymentRelay', false)
                        .cacheControl,
                }
            } finally {
                login('john.doe')
            }
        },
        then({ token, html, errors, relay, checkout, relayCache }) {
            errors.length == 0
            html.includes(
                'href="/shop/theme/' +
                    state.release.manifestDigest +
                    '/store.css"',
            )
            html.includes('id="ShopCheckout"')
            html.includes('action="/shop/Checkout/contact"')
            html.includes('value="reader@shop.example.test"')
            html.includes('action="/shop/Checkout/payment"')
            html.includes('Spec hosted page')
            html.includes('action="/shop/Checkout/submit"')
            html.includes('Place order and pay $10.00')
            // the store's optional emails (Commerce P9 follow-up): a guest is offered review requests, unchecked, with what
            // it is and is not; no cart reminders without an account
            html.includes('name="optIn" value="reviewRequests">')
            html.includes(
                'One email per item after it arrives; no offers or newsletters.',
            )
            !html.includes('value="cartReminders"')
            html.includes('name="expectedRevision"')
            html.includes('name="operationId"')
            !html.includes('Delivery address')
            !html.includes(token)
            !html.includes(ids.gateway)
            relay.includes(
                "form-action 'self' https://accept.authorize.net https://test.authorize.net",
            )
            checkout.includes("form-action 'self';")
            !checkout.includes('authorize.net')
            relayCache == 'no-store'
        },
    },
)
feature(
    "checkout operations are capability writes; a remote frontend's checkout, refusal, submit and return equal a local page's",
    {
        when() {
            const transport = ec.resource.script(
                'component://mr-pass/service/pass/Transport.js',
            )
            const lists = [
                transport.TOKEN_WRITES,
                ec.resource.script('component://mr-mantle/script/PassApi.js')
                    .TOKEN_WRITES,
                ec.resource.script(
                    'component://mr-mantle/script/PassAuthority.js',
                ).TOKEN_WRITES,
            ]
            const routed = (operation, input) => {
                try {
                    return transport.routeOf(operation, input).method
                } catch (error) {
                    return error.moquiErrorKind
                }
            }
            logout()
            try {
                const token = lib().remote('addCartItem', {
                    siteId: SITE,
                    productId: ids.book,
                    quantity: '2',
                }).result.token
                const remote = (operation, input) =>
                    lib().remote(operation, { siteId: SITE, ...input })
                remote('beginCheckout', { token })
                remote('setCheckoutContact', {
                    token,
                    emailAddress: 'remote@shop.example.test',
                    name: 'Remy Remote',
                })
                remote('selectPayment', {
                    token,
                    paymentOptionId: 'PiCreditCard',
                })
                const remoteView = remote('getCheckout', { token })
                const localView = lib().facade('getCheckout', {
                    siteId: SITE,
                    token,
                })
                const remoteStale = remote('submitCheckout', {
                    token,
                    expectedRevision: '0',
                })
                const localStale = lib().facade('submitCheckout', {
                    siteId: SITE,
                    token,
                    expectedRevision: '0',
                })
                // Marketing follow-up 4: the frontend's visitor key, kept as its digest where the seller's policy keeps keys
                lib().run('create#mantle.marketing.campaign.MarketingPolicy', {
                    marketingPolicyId: 'PSCHK_MKT_POLICY',
                    organizationPartyId: lib().ids.org,
                    fromDate: new Date(Date.now() - 60000),
                    visitorKeys: 'Y',
                })
                const submitted = remote('submitCheckout', {
                    token,
                    expectedRevision: remoteView.result.checkout.revision,
                    visitorKey: VISITOR_KEY,
                })
                const reference = submitted.result.checkout.reference
                const key = submitted.result.returnKey
                const orderOf = () => {
                    const checkoutRow = ec.entity
                        .find('mantle.order.StoreCheckout')
                        .condition({ returnReference: reference })
                        .disableAuthz()
                        .one()
                    return ec.entity
                        .find('mantle.order.OrderHeader')
                        .condition({ orderId: checkoutRow.orderId })
                        .disableAuthz()
                        .one()
                }
                const frozenKey = orderOf().marketingVisitorKeyHash
                return {
                    frozenKey,
                    lists,
                    routes: ec.resource.script(
                        'component://mr-pass/service/pass/Routes.js',
                    ),
                    anonymousCart: routed('getCart', { siteId: SITE }),
                    returnRead: routed('getCheckoutPaymentResult', {
                        siteId: SITE,
                        reference: 'x',
                        key: 'k',
                    }),
                    submitWithout: routed('submitCheckout', { siteId: SITE }),
                    remoteView,
                    localView,
                    remoteStale,
                    localStale,
                    submitted,
                    // a provider's return on another frontend session (a moment after the submit): the reference and key
                    // only, no cart capability
                    returned: (() => {
                        const row = ec.entity
                            .find('mantle.order.StoreCheckout')
                            .condition({ returnReference: reference })
                            .disableAuthz()
                            .one()
                        lib().run(
                            'update#mantle.account.payment.PortalPaymentAttempt',
                            { paymentId: row.paymentId, lastCheckDate: null },
                        )
                        return remote('getCheckoutPaymentResult', {
                            reference,
                            key,
                        })
                    })(),
                    // Shop P6 (F85): the reference and key alone read the order's state, and no order link; the cart's
                    // own session (its placed cart's capability) the confirmation and the link
                    byReference: remote('getOrderConfirmation', {
                        reference,
                        key,
                    }),
                    confirmation: remote('getOrderConfirmation', {
                        reference,
                        key,
                        token,
                    }),
                    noKey: remote('getCheckoutPaymentResult', { reference }),
                    // after the return's placement (keptVisitorKey reads the policy again before place#Order)
                    placed: orderOf(),
                }
            } finally {
                ec.entity
                    .find('mantle.marketing.campaign.MarketingPolicy')
                    .condition({ marketingPolicyId: 'PSCHK_MKT_POLICY' })
                    .disableAuthz()
                    .deleteAll()
                login('john.doe')
            }
        },
        then(r) {
            JSON.stringify(r.lists[0]) === JSON.stringify(r.lists[1])
            JSON.stringify(r.lists[1]) === JSON.stringify(r.lists[2])
            CHECKOUT_OPS.concat(['getCart']).every((operation) =>
                r.lists[0].includes(operation),
            )
            // every checkout read and getCart is a POST (F75): a capability is never a query parameter
            CHECKOUT_OPS.concat(['getCart']).every(
                (operation) =>
                    r.routes.find((route) => route[2] == operation)[0] ==
                    'POST',
            )
            r.anonymousCart == 'POST'
            r.returnRead == 'POST'
            r.submitWithout == 'AuthenticationRequired'
            JSON.stringify(r.remoteView.result.checkout) ===
                JSON.stringify(r.localView.result.checkout)
            r.remoteView.result.checkout.state == 'ready'
            r.remoteStale.kind == 'Conflict'
            r.remoteStale.reason == 'staleRevision'
            r.remoteStale.message == r.localStale.message
            r.submitted.result.checkout.state == 'paymentPending'
            r.submitted.result.returnKey.length == 40
            r.submitted.result.checkout.attempt.providerUrl.startsWith(
                'https://' + HOST + '/shop/Checkout/return?ref=',
            )
            // the return key rides as returnToken, a name the request log's secret rule leaves out (SEC-PSS-02)
            r.submitted.result.checkout.attempt.providerUrl.includes('&returnToken=')
            !r.submitted.result.checkout.attempt.providerUrl.includes('&key=')
            r.returned.result.checkout.state == 'completed'
            r.byReference.result.confirmation.minimal == true
            !r.byReference.result.orderToken
            r.confirmation.result.confirmation.totals.total.amount == '20.00'
            r.confirmation.result.orderToken.length == 48
            r.noKey.kind == 'NotFound'
            // Marketing follow-up 4: the remote frontend's visitor key reached the authority, which kept only its digest (the one
            // Marketing's events keep) with the order, through its placement
            r.frozenKey ==
                String(
                    ec.resource.digestText(
                        'mkt-visitor:' + VISITOR_KEY,
                        'sha256',
                    ),
                )
            r.frozenKey != VISITOR_KEY
            r.placed.marketingVisitorKeyHash == r.frozenKey
            r.placed.placedDate != null
        },
    },
)
feature('a sign-in on a site lands on its root app, else its Forum (F71)', {
    when() {
        const account = ec.resource.script(
            'component://mr-pass/service/pass/Account.js',
        )
        return {
            shopRoot: account.landing({
                mounts: [
                    { app: 'shop', pathPrefix: '/' },
                    { app: 'account', pathPrefix: '/account' },
                ],
            }),
            forum: account.landing({
                mounts: [
                    { app: 'forum', pathPrefix: '/forum' },
                    { app: 'shop', pathPrefix: '/shop' },
                ],
            }),
            neither: account.landing({
                mounts: [{ app: 'shop', pathPrefix: '/shop' }],
            }),
        }
    },
    then({ shopRoot, forum, neither }) {
        shopRoot == '/'
        forum == '/forum'
        neither == '/'
    },
})
feature(
    'Shop P9: a refused field is invalid, described by the alert and focused; with no field the alert takes the focus',
    {
        when() {
            const c = shopCheckout()
            const form =
                '<form><input type="hidden" name="expectedRevision" value="3"><label>Email <input name="emailAddress" value="" type="email"></label><label>Name <input name="name" value=""></label></form>'
            const page = (notice) =>
                c.markInvalid(c.noticeHtml(notice) + form, notice)
            return {
                field: page({
                    kind: 'error',
                    text: 'Enter the email address for your order',
                    field: 'emailAddress',
                }),
                noField: page({ kind: 'error', text: 'Reload the checkout' }),
                elsewhere: page({
                    kind: 'error',
                    text: 'Choose',
                    field: 'paymentOptionId',
                }),
                hidden: page({
                    kind: 'error',
                    text: 'Reload the checkout and try again',
                    field: 'expectedRevision',
                }),
                ok: page({ kind: 'ok', text: 'Saved your contact details.' }),
            }
        },
        then({ field, noField, elsewhere, hidden, ok }) {
            field.includes('role="alert" id="ShopNotice" tabindex="-1">')
            field.includes(
                '<input aria-invalid="true" aria-describedby="ShopNotice" autofocus name="emailAddress"',
            )
            !field.includes('name="name" aria-invalid')
            noField.includes('id="ShopNotice" tabindex="-1" autofocus>')
            !noField.includes('aria-invalid')
            elsewhere.includes('tabindex="-1" autofocus>')
            hidden.includes('tabindex="-1" autofocus>')
            !hidden.includes('aria-invalid')
            ok.includes('role="status">') && !ok.includes('autofocus')
        },
    },
)
feature(
    "a provider's return keeps a key once the authority read the checkout with it; another shopper's pair offers no payment page",
    {
        when() {
            // SEC-PSF-82: a pending payment whose lookup stays pending
            lib().run('create#mantle.account.method.PaymentGatewayConfig', {
                paymentGatewayConfigId: ids.pending,
                paymentGatewayTypeEnumId: 'PgtTest',
                description: 'Spec hosted page, still pending',
                authorizeServiceName:
                    'mantle.account.PaymentTestServices.hostedPending#PaymentAuthorization',
                detailsServiceName:
                    'mantle.account.PaymentTestServices.alwaysPending#PaymentDetails',
            })
            lib().run(
                'create#mantle.account.method.PaymentGatewayOrganization',
                {
                    organizationPartyId: lib().ids.org,
                    paymentGatewayConfigId: ids.pending,
                    fromDate: 0,
                    isEnabled: 'Y',
                },
            )
            logout()
            try {
                // another shopper's checkout, on a remote frontend's session
                const remote = (operation, input) =>
                    lib().remote(operation, { siteId: SITE, ...input })
                const token = remote('addCartItem', {
                    productId: ids.book,
                    quantity: '1',
                }).result.token
                remote('beginCheckout', { token })
                remote('setCheckoutContact', {
                    token,
                    emailAddress: 'sender@shop.example.test',
                    name: 'Sam Sender',
                })
                remote('selectPayment', {
                    token,
                    paymentOptionId: 'PiCreditCard',
                })
                const access = ec.entity
                    .find('mantle.order.StoreCartAccess')
                    .condition({
                        capabilityDigest: ec.resource
                            .script(
                                'component://mr-mantle/service/mantle/party/ExternalAccess.js',
                            )
                            .tokenDigest(token),
                    })
                    .disableAuthz()
                    .one()
                const row = ec.entity
                    .find('mantle.order.StoreCheckout')
                    .condition({ cartAccessId: access.cartAccessId })
                    .disableAuthz()
                    .one()
                lib().run('update#mantle.order.StoreCheckout', {
                    checkoutId: row.checkoutId,
                    paymentGatewayConfigId: ids.pending,
                })
                const submitted = remote('submitCheckout', {
                    token,
                    expectedRevision: remote('getCheckout', { token }).result
                        .checkout.revision,
                })
                const reference = submitted.result.checkout.reference
                const key = submitted.result.returnKey
                // the visitor (one browser session of its own) follows links to Checkout/return: the sender's own pair,
                // then a made-up key for the same reference
                const browser = ec.screen
                    .makeTest()
                    .rootScreen('component://mr-pass/screen/Pass.xml')
                const page = (path, more) =>
                    browser.render(
                        'Shop/' + path,
                        {
                            resolvedSiteId: SITE,
                            publicHost: HOST,
                            publicPath: '/shop/' + path,
                            ref: reference,
                            ...(more || {}),
                        },
                        null,
                    ).output
                page('Checkout/return', { returnToken: key })
                const result = page('PaymentResult')
                const relay = page('PaymentRelay')
                page('Checkout/return', { returnToken: 'x'.repeat(40) })
                return {
                    submitted,
                    result,
                    relay,
                    afterMadeUp: page('PaymentResult'),
                }
            } finally {
                ec.web.sessionAttributes.remove(shopCheckout().keysKey(SITE))
                login('john.doe')
            }
        },
        then(r) {
            r.submitted.result.checkout.state == 'paymentPending'
            // the pair reads the payment's state, and offers no way to pay it
            r.result.includes('Your payment is not confirmed yet.')
            !r.result.includes('Continue to the payment page')
            r.relay.includes('This page is not available')
            !r.relay.includes('id="ShopPaymentRelay"')
            // a made-up key is not kept: it replaced nothing the authority had read
            r.afterMadeUp.includes('Your payment is not confirmed yet.')
        },
    },
)
feature("the Shop's cart and checkout writes answer only a POST, so a same-site image runs none", {
    when() {
        // SEC-PSF-81: <img src="/shop/Cart/add?..."> or "/shop/Checkout/begin" in member HTML is a GET with the reader's session
        const carts = () =>
            ec.entity
                .find('mantle.order.StoreCartAccess')
                .condition({ siteId: SITE })
                .disableAuthz()
                .count()
        resetCartCreations()
        logout()
        try {
            const browser = ec.screen
                .makeTest()
                .rootScreen('component://mr-pass/screen/Pass.xml')
            const send = (path, method) =>
                browser.render(
                    'Shop/' + path,
                    {
                        resolvedSiteId: SITE,
                        publicHost: HOST,
                        publicPath: '/shop/' + path,
                        productId: ids.book,
                        quantity: '1',
                    },
                    method,
                )
            const before = carts()
            send('Cart/add', 'get')
            const afterGet = carts()
            send('Checkout/begin', 'get')
            send('Cart/add', 'post')
            return { before, afterGet, afterPost: carts() }
        } finally {
            login('john.doe')
        }
    },
    then({ before, afterGet, afterPost }) {
        afterGet == before
        afterPost == before + 1
    },
})
feature("a relay posts its form only to the hosted payment page the relay's CSP names (SEC-PSS-64)", {
    expect() {
        const relay = shopCheckout().relayFormUrl
        relay('https://test.authorize.net/payment/payment') === true
        relay('https://accept.authorize.net/payment/payment') === true
        relay('https://accept.authorize.net.example.test/payment') === false
        relay('https://pay.example.test/accept.authorize.net/') === false
        relay('http://test.authorize.net/payment/payment') === false
        relay(null) === false
    },
})
