/* Shop's cart pages and the shopper's cart capability (impl-shop P4; design-shop §4.2, §6 Cart, §7.1, F44, F45). The
 * authority keeps the cart (Mantle's ShopCartServices); this frontend keeps only the capability it was given, in its own
 * server session under the site (never in a cookie, a URL or a page), and sends it as input.token, the same locally and
 * through a remote authority. A cart page is never kept by a cache (no-store: Shared/Headers.js's default).
 *
 * - The plain HTML forms work without JavaScript: the product page's purchase selection posts to Cart/add (its Show price
 *   button to Cart/quote, which redirects to the product's page with the selection), and the cart's line, code and
 *   removal forms post to their transitions, each answered by a redirect to the page with a notice. Every change of what
 *   is in the cart sends the revision the shopper saw and an operation id, so another window's older form is refused and
 *   a double submit answers once.
 * - The trusted Vue enhancement (F45): each form is wrapped in an island (WebrootPublic.qvt.js island mode) whose qvue
 *   (Purchase.qvue, Cart.qvue) asks the same transitions for JSON, so a price updates and an add announces the cart's count
 *   without a reload; without JavaScript, or if the island fails, the plain form stays.
 * - Sign-in attaches the session's cart to the account (attachCart, which may merge it into the account's cart) and
 *   sign-out releases it (releaseCart rotates the account's carts' capabilities); Account.js calls signedIn and
 *   signingOut, and a failure there never stops a sign-in or sign-out.
 * CC0 plus patent grant. */
const portal = () =>
    ec.resource.script('component://mr-pass/screen/Shared/Portal.js')
const theme = () =>
    ec.resource.script('component://mr-pass/screen/Shop/ShopTheme.js')
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
/* JSON for an inline data block: no "<" can close the element. */
const dataJson = (value) => JSON.stringify(value).replace(/</g, '\\u003c')
const tokenKey = (siteId) => 'passShopCart:' + siteId
const noticeKey = (siteId) => 'passShopNotice:' + siteId
const session = () => {
    try {
        return ec.web?.sessionAttributes || null
    } catch (error) {
        return null
    }
}
/* The session's cart capability for the site, or null. */
const tokenOf = (siteId) => {
    const attributes = session()
    const value = attributes ? attributes[tokenKey(siteId)] : null
    return value ? String(value) : null
}
/* Keep a capability the authority issued (the first add, sign-in), and answer the result without it. */
function keep(siteId, result) {
    if (!result || typeof result !== 'object') return result
    const { token, ...rest } = result
    const attributes = session()
    if (token && attributes) attributes[tokenKey(siteId)] = String(token)
    return rest
}
/* A cart operation with the session's capability: {result} or {error} (Shared/Portal.js attempt). */
function call(context, operation, input) {
    const siteId = context.site.siteId
    const token = tokenOf(siteId)
    const found = portal().attempt(
        operation,
        { siteId, ...(token ? { token } : {}), ...(input || {}) },
        { newTransaction: true },
    )
    if (found.result) found.result = keep(siteId, found.result)
    return found
}
const base = (context) => context.mount.base || ''
/* A one-time notice for the next page of this site: {kind: 'ok' | 'error', text, field}. */
function notify(siteId, notice) {
    const attributes = session()
    if (attributes) attributes[noticeKey(siteId)] = JSON.stringify(notice)
}
function takeNotice(siteId) {
    const attributes = session()
    const text = attributes ? attributes[noticeKey(siteId)] : null
    if (!text) return null
    attributes.remove(noticeKey(siteId))
    try {
        return JSON.parse(String(text))
    } catch (error) {
        return null
    }
}
/* Whether this page carries the session's form token: a visitor with a session (its cookie, or signed in), whose posts the
 * framework checks, on a page no shared cache keeps (Pass.xml passPublicPage). A visitor with no session posts without
 * one: the post starts the session. */
const SESSION_COOKIES = /^(?:__Host-moqui\.session|moqui\.session|moquiSession|JSESSIONID)$/
function privatePage() {
    if (ec.context.get('passPublicPage')) return false
    if (ec.user.userId) return true
    try {
        const cookies = ec.web?.request?.getCookies?.() || []
        return Array.from(cookies).some((cookie) =>
            SESSION_COOKIES.test(cookie.name),
        )
    } catch (error) {
        return false
    }
}
const tokenField = () =>
    privatePage() && ec.web
        ? '<input type="hidden" name="moquiSessionToken" value="' +
          escapeText(ec.web.sessionToken) +
          '">'
        : ''
const noticeHtml = (notice) =>
    notice
        ? '<p class="shop-notice shop-notice-' +
          (notice.kind === 'error' ? 'error' : 'ok') +
          '" role="' +
          (notice.kind === 'error' ? 'alert' : 'status') +
          '">' +
          escapeText(notice.text) +
          '</p>'
        : ''
/* The island's scripts (WebrootPublic.qvt.js and what it needs): the trusted Vue enhancement, no theme stylesheet. */
const ISLAND_SCRIPTS = [
    '/libs/vue/vue.runtime.global.prod.js',
    '/libs/quasar/quasar.umd.prod.js',
    '/libs/quasar/lang/en-US.umd.prod.js',
    '/js/MoquiLib.js',
    '/js/MoquiL10n.js',
    '/js/WebrootVue.qvt.render.js',
    '/js/WebrootVue.qvt.js',
    '/js/WebrootPublic.qvt.js',
]
/* An island's config and scripts (F45): its screen's qvue at the element mountId, with its context. */
function island(context, mountId, screen, islandContext) {
    const config = {
        shell: 'island',
        sessionToken: privatePage() && ec.web ? ec.web.sessionToken : '',
        locale: context.locale || 'en',
        timeZone: context.site.timeZone || 'UTC',
        quasar: { dark: false },
        quasarLang: 'enUS',
        qvt: {
            build: 'runtime',
            handles: ['static-template', 'bundled-qvue'],
        },
        route: {
            name: 'shop-' + screen.toLowerCase(),
            basePath: base(context) + '/' + screen,
            title: screen,
            renderModes: ['qvue'],
        },
        context: islandContext,
        // the island's own texts in the visitor's language, which a public page has no catalog for
        messages: ec.resource
            .script('component://webroot/script/IslandMessages.js')
            .islandMessages(['component://mr-pass/screen/Shop/' + screen + '.qvue']),
        labels: { loading: ec.l10n.localize('Loading'), notFound: '' },
    }
    return (
        '<script type="application/json" data-moqui-island="' +
        mountId +
        '">' +
        dataJson(config) +
        '</script>' +
        ISLAND_SCRIPTS.map((src) => '<script src="' + src + '"></script>').join(
            '',
        )
    )
}

/* ---- the purchase selection (shop.productPurchase) ---- */
/* The product page's purchase selection: its public variants and a quantity, posted to Cart/add (Show price posts to
 * Cart/quote, which redirects to the page with the selection's quote), the quote of the selection, and the island. */
function purchaseHtml(context, view) {
    const product = view?.product || {}
    const quote = product.quote || {}
    const variants = product.variants || []
    const notice = privatePage() ? takeNotice(context.site.siteId) : null
    const options = variants
        .map(
            (variant) =>
                '<option value="' +
                escapeText(variant.id) +
                '"' +
                (variant.id === product.selectedVariantId ? ' selected' : '') +
                '>' +
                escapeText(variant.options || variant.name) +
                (variant.price?.display
                    ? ' (' + escapeText(variant.price.display) + ')'
                    : '') +
                (variant.availability?.purchasable === false
                    ? ' (' + escapeText(variant.availability.label) + ')'
                    : '') +
                '</option>',
        )
        .join('')
    const purchasable =
        product.availability?.purchasable !== false || variants.length > 0
    const form =
        '<form class="shop-purchase" method="post" action="' +
        escapeText(base(context) + '/Cart/add') +
        '" aria-label="' +
        escapeText(ec.l10n.localize('Choose your purchase')) +
        '">' +
        tokenField() +
        '<input type="hidden" name="productId" value="' +
        escapeText(product.id || '') +
        '">' +
        (variants.length
            ? '<label>' +
              escapeText(ec.l10n.localize('Option')) +
              ' <select name="variantId" required><option value="">' +
              escapeText(ec.l10n.localize('Choose an option')) +
              '</option>' +
              options +
              '</select></label>'
            : '') +
        '<label>' +
        escapeText(ec.l10n.localize('Quantity')) +
        ' <input type="number" name="quantity" min="1" max="999" step="1" inputmode="numeric" value="' +
        escapeText(String(product.quantity || 1)) +
        '"></label><button type="submit" formaction="' +
        escapeText(base(context) + '/Cart/quote') +
        '" formnovalidate>' +
        escapeText(ec.l10n.localize('Show price')) +
        '</button>' +
        (purchasable
            ? '<button type="submit" class="shop-add">' +
              escapeText(ec.l10n.localize('Add to cart')) +
              '</button>'
            : '') +
        '<p class="shop-quote" id="ShopQuote" aria-live="polite">' +
        escapeText(quote.label || '') +
        '</p>' +
        noticeHtml(notice) +
        '<p class="shop-cart-link"><a href="' +
        escapeText(base(context) + '/Cart') +
        '">' +
        escapeText(ec.l10n.localize('View cart')) +
        '</a></p></form>'
    return (
        '<div id="ShopPurchase">' +
        form +
        '</div>' +
        island(context, 'ShopPurchase', 'Purchase', {
            productId: product.id || '',
            productUrl: product.url || '',
            variants: variants.map((variant) => ({
                id: variant.id,
                label:
                    (variant.options || variant.name) +
                    (variant.price?.display
                        ? ' (' + variant.price.display + ')'
                        : ''),
                purchasable: variant.availability?.purchasable !== false,
            })),
            selectedVariantId: product.selectedVariantId || '',
            quantity: String(product.quantity || 1),
            quoteLabel: quote.label || '',
            purchasable,
            quoteUrl: base(context) + '/Purchase/quote',
            addUrl: base(context) + '/Cart/add',
            stateUrl: base(context) + '/Cart/state',
            cartUrl: base(context) + '/Cart',
        })
    )
}

/* ---- the cart (shop.cart) ---- */
const hidden = (name, value) =>
    '<input type="hidden" name="' +
    name +
    '" value="' +
    escapeText(value ?? '') +
    '">'
/* The common fields of a cart change: the session's form token, the revision the shopper sees and a new operation id. */
const changeFields = (cart) =>
    tokenField() +
    hidden('expectedRevision', cart.revision) +
    hidden('operationId', portal().operationId())
/* The cart's plain page (CartItems, PromoCode, CartTotals; P5's BeginCheckout): every change a form of its own. */
function cartHtml(context, cartView, notice) {
    const cart = cartView?.cart || { items: [], promoCodes: [], notices: [] }
    const action = (name) => escapeText(base(context) + '/Cart/' + name)
    const parts = [noticeHtml(notice)]
    if (!cart.items.length) {
        parts.push(
            '<p class="shop-cart-empty" id="ShopCartEmpty">' +
                escapeText(ec.l10n.localize('Your cart is empty.')) +
                '</p><p><a href="' +
                escapeText(base(context) + '/') +
                '">' +
                escapeText(ec.l10n.localize('Continue shopping')) +
                '</a></p>',
        )
        return (
            '<div class="shop-cart" id="ShopCart">' + parts.join('') + '</div>'
        )
    }
    parts.push(
        '<ul class="shop-cart-items" id="ShopCartItems">' +
            cart.items
                .map(
                    (item) =>
                        '<li class="shop-cart-item" data-item="' +
                        escapeText(item.orderItemSeqId) +
                        '"><p class="shop-cart-name">' +
                        (item.url
                            ? '<a href="' +
                              escapeText(item.url) +
                              '">' +
                              escapeText(item.name) +
                              '</a>'
                            : escapeText(item.name)) +
                        (item.options
                            ? ' <small>' + escapeText(item.options) + '</small>'
                            : '') +
                        '</p><p>' +
                        escapeText(
                            ec.resource.expand('${price} each', '', {
                                price: item.unitPrice.display,
                            }),
                        ) +
                        (item.availability && item.available
                            ? ' · ' + escapeText(item.availability.label)
                            : '') +
                        '</p>' +
                        (item.available
                            ? ''
                            : '<p class="shop-cart-unavailable" role="alert">' +
                              escapeText(
                                  ec.l10n.localize(
                                      'This item cannot be bought now. Remove it to check out.',
                                  ),
                              ) +
                              '</p>') +
                        item.adjustments
                            .map(
                                (adjustment) =>
                                    '<p class="shop-cart-adjustment">' +
                                    escapeText(adjustment.label) +
                                    ' ' +
                                    escapeText(adjustment.amount.display) +
                                    '</p>',
                            )
                            .join('') +
                        '<form method="post" action="' +
                        action('update') +
                        '" class="shop-cart-quantity">' +
                        changeFields(cart) +
                        hidden('orderItemSeqId', item.orderItemSeqId) +
                        '<label>' +
                        escapeText(ec.l10n.localize('Quantity')) +
                        ' <input type="number" name="quantity" min="0" max="999" step="1" inputmode="numeric" value="' +
                        escapeText(item.quantity) +
                        '"></label><button type="submit">' +
                        escapeText(ec.l10n.localize('Update')) +
                        '</button></form><form method="post" action="' +
                        action('remove') +
                        '" class="shop-cart-remove">' +
                        changeFields(cart) +
                        hidden('orderItemSeqId', item.orderItemSeqId) +
                        '<button type="submit">' +
                        escapeText(
                            ec.resource.expand('Remove ${name}', '', {
                                name: item.name,
                            }),
                        ) +
                        '</button></form><p class="shop-cart-line-total">' +
                        escapeText(item.total.display) +
                        '</p></li>',
                )
                .join('') +
            '</ul>',
    )
    parts.push(
        '<section class="shop-cart-codes" aria-label="' +
            escapeText(ec.l10n.localize('Promotion codes')) +
            '">' +
            cart.promoCodes
                .map(
                    (code) =>
                        '<form method="post" action="' +
                        action('removeCode') +
                        '">' +
                        changeFields(cart) +
                        hidden('promoCode', code.code) +
                        '<p>' +
                        escapeText(code.code) +
                        (code.label ? ': ' + escapeText(code.label) : '') +
                        ' <button type="submit">' +
                        escapeText(
                            ec.resource.expand('Remove code ${code}', '', {
                                code: code.code,
                            }),
                        ) +
                        '</button></p></form>',
                )
                .join('') +
            '<form method="post" action="' +
            action('applyCode') +
            '">' +
            changeFields(cart) +
            '<label>' +
            escapeText(ec.l10n.localize('Promotion code')) +
            ' <input type="text" name="promoCode" maxlength="40" autocomplete="off"></label><button type="submit">' +
            escapeText(ec.l10n.localize('Apply')) +
            '</button></form></section>',
    )
    const totals = cart.totals
    parts.push(
        '<dl class="shop-cart-totals" id="ShopCartTotals" aria-live="polite"><dt>' +
            escapeText(ec.l10n.localize('Items')) +
            '</dt><dd>' +
            escapeText(totals.items.display) +
            '</dd>' +
            (totals.discounts.amount && Number(totals.discounts.amount) !== 0
                ? '<dt>' +
                  escapeText(ec.l10n.localize('Discounts')) +
                  '</dt><dd>' +
                  escapeText(totals.discounts.display) +
                  '</dd>'
                : '') +
            '<dt>' +
            escapeText(ec.l10n.localize('Shipping cost')) +
            '</dt><dd>' +
            escapeText(
                totals.shipping
                    ? totals.shipping.display
                    : ec.l10n.localize('Calculated at checkout'),
            ) +
            '</dd><dt>' +
            escapeText(ec.l10n.localize('Tax')) +
            '</dt><dd>' +
            escapeText(
                totals.tax
                    ? totals.tax.display
                    : ec.l10n.localize('Calculated at checkout'),
            ) +
            '</dd><dt>' +
            escapeText(ec.l10n.localize('Estimated total')) +
            '</dt><dd id="ShopCartTotal">' +
            escapeText(totals.total.display) +
            '</dd></dl>',
    )
    for (const item of cart.notices || [])
        parts.push(
            '<p class="shop-cart-notice">' + escapeText(item.text) + '</p>',
        )
    // P5: BeginCheckout (the cart's checkout, begun or resumed)
    parts.push(
        cart.checkoutPending
            ? '<p class="shop-checkout-note"><a href="' +
                  escapeText(base(context) + '/Checkout') +
                  '">' +
                  escapeText(ec.l10n.localize('Your checkout is in progress')) +
                  '</a></p>'
            : '<form method="post" class="shop-begin-checkout" action="' +
                  escapeText(base(context) + '/Checkout/begin') +
                  '">' +
                  tokenField() +
                  '<button type="submit">' +
                  escapeText(ec.l10n.localize('Check out')) +
                  '</button></form>',
    )
    return '<div class="shop-cart" id="ShopCart">' + parts.join('') + '</div>'
}
/* The cart's component: the plain page in its island. */
function cartComponent(context, cartView, notice) {
    return (
        cartHtml(context, cartView, notice) +
        island(context, 'ShopCart', 'Cart', {
            stateUrl: base(context) + '/Cart/state',
            actionBase: base(context) + '/Cart/',
            shopUrl: base(context) + '/',
            // the page's notice (an add, a sign-in's merge), shown by the island as the plain page shows it
            notice: notice || null,
        })
    )
}

/* ---- the cart page ---- */
/* The cart page: the shopper's getCart (the session's capability), rendered through the active release's cart page with
 * the cart component (view.cart the mini-cart), or in the PASS shell. {status, html} or {cartHtml}. */
function page(context) {
    const siteId = context.site.siteId
    const notice = takeNotice(siteId)
    const found = call(context, 'getCart', {})
    const cartView = found.result || null
    const errorNotice = found.error
        ? { kind: 'error', text: found.error.message }
        : null
    const shown = notice || errorNotice
    if (context.release) {
        const themed = portal().attempt('getShopPage', {
            siteId,
            pageKind: 'cart',
        })
        if (themed.result?.release) {
            themed.result.view = Object.assign({}, themed.result.view, {
                cart: cartView ? cartView.summary : { itemCount: 0 },
            })
            const rendered = theme().renderView(
                Object.assign({}, context, {
                    cartComponent: () =>
                        cartComponent(context, cartView, shown),
                }),
                'cart',
                themed.result,
            )
            if (rendered?.html)
                return { status: rendered.status, html: rendered.html }
        }
    }
    return {
        status: 200,
        html: null,
        cartHtml: cartComponent(context, cartView, shown),
    }
}

/* ---- the transitions ---- */
const wantsJson = () =>
    String(ec.web?.request?.getHeader('accept') || '').includes(
        'application/json',
    )
const param = (name) => {
    const value = ec.web?.parameters?.[name]
    if (value == null) return null
    if (typeof value === 'object' && value.length != null)
        return value.length ? String(value[0]) : null
    return String(value)
}
const STATUS = {
    NotFound: 404,
    AuthenticationRequired: 401,
    Unauthorized: 403,
    Conflict: 409,
    Unprocessable: 422,
    Tarpit: 429,
}
/* A JSON answer with its status (written here: ec.web.sendJsonResponse answers 200 or 500 and adds the request's
 * messages, such as a Mantle service's notes). */
function sendJson(status, body) {
    const response = ec.web?.response
    if (!response) return
    response.setStatus(status)
    response.setHeader('Cache-Control', 'no-store')
    response.setContentType('application/json;charset=UTF-8')
    response.write(JSON.stringify(body))
}
/* Answer a transition: JSON for the island ({ok, cart, summary} or {ok: false, error}), else a redirect with a notice. */
function respond(context, found, okText, location) {
    const siteId = context.site.siteId
    const response = ec.web?.response
    if (wantsJson()) {
        sendJson(
            found.error ? STATUS[found.error.kind] || 503 : 200,
            found.error
                ? {
                      ok: false,
                      error: {
                          kind: found.error.kind,
                          reason: found.error.reason,
                          message: found.error.message,
                          field: found.error.fieldErrors?.[0]?.field || null,
                      },
                  }
                : {
                      ok: true,
                      message: okText,
                      cart: found.result.cart,
                      summary: found.result.summary,
                      alreadyApplied: !!found.result.alreadyApplied,
                  },
        )
        return
    }
    notify(
        siteId,
        found.error
            ? {
                  kind: 'error',
                  text: found.error.message,
                  field: found.error.fieldErrors?.[0]?.field || null,
              }
            : { kind: 'ok', text: okText },
    )
    response?.sendRedirect(location || base(context) + '/Cart')
}
const productPath = (context, productId) =>
    base(context) +
    '/products/' +
    encodeURIComponent(String(productId || '')) +
    '/item'
const selection = () => ({
    productId: param('productId'),
    variantId: param('variantId'),
    quantity: param('quantity'),
})
/* Cart/add: the selection added (the cart made on the first add, its capability kept in this session). */
function add(context) {
    const chosen = selection()
    const found = call(context, 'addCartItem', {
        ...chosen,
        ...(param('expectedRevision')
            ? { expectedRevision: param('expectedRevision') }
            : {}),
        ...(param('operationId') ? { operationId: param('operationId') } : {}),
    })
    const added = found.result?.cart?.items?.find(
        (item) => item.productId === (chosen.variantId || chosen.productId),
    )
    respond(
        context,
        found,
        added
            ? ec.resource.expand(
                  'Added ${name} to your cart. Your cart has ${count} items.',
                  '',
                  {
                      name: added.name,
                      count: found.result?.summary?.itemCount ?? 0,
                  },
              )
            : ec.resource.expand(
                  'Added the item to your cart. Your cart has ${count} items.',
                  '',
                  { count: found.result?.summary?.itemCount ?? 0 },
              ),
        found.error
            ? productPath(context, chosen.productId) +
                  (chosen.variantId || chosen.quantity
                      ? '?' +
                        [
                            chosen.variantId
                                ? 'variantId=' +
                                  encodeURIComponent(chosen.variantId)
                                : '',
                            chosen.quantity
                                ? 'quantity=' +
                                  encodeURIComponent(chosen.quantity)
                                : '',
                        ]
                            .filter(Boolean)
                            .join('&')
                      : '')
            : null,
    )
}
/* Cart/quote (the plain Show price button): back to the product's page with the selection, which shows its quote. */
function quote(context) {
    const chosen = selection()
    const query = [
        chosen.variantId
            ? 'variantId=' + encodeURIComponent(chosen.variantId)
            : '',
        chosen.quantity
            ? 'quantity=' + encodeURIComponent(chosen.quantity)
            : '',
    ]
        .filter(Boolean)
        .join('&')
    ec.web?.response?.sendRedirect(
        productPath(context, chosen.productId) + (query ? '?' + query : ''),
    )
}
/* Purchase/quote (the island): the selection's quote as JSON (quoteSelection; nothing is added). */
function quoteJson(context) {
    const found = portal().attempt('quoteSelection', {
        siteId: context.site.siteId,
        ...selection(),
    })
    sendJson(
        found.error ? STATUS[found.error.kind] || 503 : 200,
        found.error
            ? {
                  ok: false,
                  error: {
                      kind: found.error.kind,
                      reason: found.error.reason,
                      message: found.error.message,
                      field: found.error.fieldErrors?.[0]?.field || null,
                  },
              }
            : {
                  ok: true,
                  label: found.result.label,
                  purchasable: found.result.purchasable,
                  total: found.result.total,
              },
    )
}
const changeInput = () => ({
    expectedRevision: param('expectedRevision'),
    ...(param('operationId') ? { operationId: param('operationId') } : {}),
})
function update(context) {
    const quantity = param('quantity')
    const found = call(context, 'updateCartItem', {
        ...changeInput(),
        orderItemSeqId: param('orderItemSeqId'),
        quantity,
    })
    respond(
        context,
        found,
        String(quantity) === '0'
            ? ec.l10n.localize('Removed the item.')
            : ec.l10n.localize('Updated your cart.'),
    )
}
function remove(context) {
    const found = call(context, 'removeCartItem', {
        ...changeInput(),
        orderItemSeqId: param('orderItemSeqId'),
    })
    respond(
        context,
        found,
        ec.l10n.localize(
            'Removed the item. Add it again from its page to put it back.',
        ),
    )
}
function applyCode(context) {
    const found = call(context, 'applyPromoCode', {
        ...changeInput(),
        promoCode: param('promoCode'),
    })
    respond(context, found, ec.l10n.localize('Applied the code to your cart.'))
}
function removeCode(context) {
    const found = call(context, 'removePromoCode', {
        ...changeInput(),
        promoCode: param('promoCode'),
    })
    respond(context, found, ec.l10n.localize('Removed the code.'))
}
/* Cart/state (the islands): the cart as JSON, and the session's form token for the island's posts (a page a shared cache
 * keeps has none, and the session may have started with the island's own first request; same-origin only). */
function state(context) {
    const found = call(context, 'getCart', {})
    sendJson(
        200,
        found.error
            ? {
                  ok: false,
                  error: {
                      kind: found.error.kind,
                      message: found.error.message,
                  },
                  formToken: ec.web.sessionToken,
              }
            : {
                  ok: true,
                  cart: found.result.cart,
                  summary: found.result.summary,
                  formToken: ec.web.sessionToken,
              },
    )
}
const actions = {
    add,
    quote,
    update,
    remove,
    applyCode,
    removeCode,
    state,
    quoteJson,
}
function act(context, name) {
    if (!actions[name]) throw new Error('Unknown cart action ' + name)
    return actions[name](context)
}

/* ---- sign-in and sign-out (Account.js) ---- */
/* Whether a site's mounts include a Shop. */
const shopSite = (siteInfo) =>
    (siteInfo?.mounts || []).some((mount) => mount.app === 'shop')
/* After a sign-in: the session's cart attached to the account (or merged into its cart), its new capability kept. Never
 * fails the sign-in. */
function signedIn(siteId, token, siteInfo) {
    if (!siteId || !shopSite(siteInfo)) return null
    try {
        const result = ec.service
            .sync()
            .throwOnError(true)
            .name('pass.Facade.call#Operation')
            .parameters({
                operation: 'attachCart',
                input: { siteId, ...(token ? { token } : {}) },
            })
            // its own transaction: a refusal here must not mark the sign-in's rollback-only (F-SP4-2)
            .requireNewTransaction(true)
            .call().result
        if (result?.token) keep(siteId, result)
        if (result?.merged)
            notify(siteId, {
                kind: 'ok',
                text: result.unavailableItems?.length
                    ? ec.resource.expand(
                          'We added the items from this browser to your cart. Not available now: ${names}.',
                          '',
                          { names: result.unavailableItems.join(', ') },
                      )
                    : ec.l10n.localize(
                          'We added the items from this browser to your cart.',
                      ),
            })
        return result
    } catch (error) {
        ec.message.clearErrors()
        ec.logger.warn('Shop cart not attached at sign-in: ' + error.message)
        return null
    }
}
/* Before a sign-out: the account's carts released (their capabilities rotated) and the session's capability dropped.
 * Never fails the sign-out. */
function signingOut(siteId, siteInfo) {
    if (!siteId) return
    const attributes = session()
    const token = tokenOf(siteId)
    attributes?.remove(tokenKey(siteId))
    attributes?.remove(noticeKey(siteId))
    if (!shopSite(siteInfo)) return
    try {
        ec.service
            .sync()
            .throwOnError(true)
            .name('pass.Facade.call#Operation')
            .parameters({
                operation: 'releaseCart',
                input: { siteId, ...(token ? { token } : {}) },
            })
            // its own transaction: a refusal here must not mark the sign-out's rollback-only (F-SP4-2)
            .requireNewTransaction(true)
            .call()
    } catch (error) {
        ec.message.clearErrors()
        ec.logger.warn('Shop cart not released at sign-out: ' + error.message)
    }
}
;({
    tokenOf,
    keep,
    call,
    purchaseHtml,
    cartHtml,
    cartComponent,
    page,
    act,
    signedIn,
    signingOut,
    takeNotice,
    tokenKey,
    // P5: the checkout pages' notice on the cart
    notify,
})
