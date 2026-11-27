/* Shop's checkout, payment result and order confirmation pages (impl-shop P5; design-shop §6 Checkout, PaymentResult,
 * OrderConfirmation, §7.2-§7.3, §8; F37-F41). The authority keeps the checkout (Mantle's ShopCheckoutServices); this
 * frontend keeps, in its own server session and never in a page, cookie or URL it makes, the cart capability
 * (Shop/ShopCart.js), each submitted checkout's return key (the narrow capability its result is read with, also from a
 * provider's return or a refreshed session) and a guest's order links. Every page is no-store (Shared/Headers.js's
 * default); the payment relay's alone adds the hosted payment page to its form-action.
 *
 * - The plain HTML forms work without JavaScript: contact, addresses, delivery, payment and review each post to a
 *   transition of Checkout, answered by a redirect to the page with a notice; every change sends the revision the shopper
 *   saw and an operation id, so another window's older form is refused and a double submit answers once.
 * - Submitting goes to PaymentResult, which links the provider's page: the test gateway's page, or for Authorize.Net
 *   Accept Hosted the relay (PaymentRelay), a GET that asks the authority for a fresh form token on each visit and posts
 *   it at once (a same-origin script, Checkout/enhance). The provider returns the payer to Checkout/return with the
 *   reference and key, which only looks the payment up. PaymentResult polls the result, bounded and with backoff, with the
 *   same script; a timeout says the payment is still processing, never paid or declined.
 * - OrderConfirmation, once the order is placed: its reference, lines, totals, payment and delivery, the QR of the
 *   signed-in order page, and what to do next; a guest's order link (its SalesOrder capability) is kept here.
 * CC0 plus patent grant. */
const portal = () =>
    ec.resource.script('component://mr-pass/screen/Shared/Portal.js')
const carts = () =>
    ec.resource.script('component://mr-pass/screen/Shop/ShopCart.js')
const theme = () =>
    ec.resource.script('component://mr-pass/screen/Shop/ShopTheme.js')
const esc = (text) =>
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
const base = (context) => context.mount.base || ''
const session = () => {
    try {
        return ec.web?.sessionAttributes || null
    } catch (error) {
        return null
    }
}
const param = (name) => {
    const value = ec.web?.parameters?.[name]
    if (value == null) return null
    if (typeof value === 'object' && value.length != null)
        return value.length ? String(value[0]) : null
    return String(value)
}
const cleanRef = (value) =>
    String(value || '')
        .replace(/[^A-Za-z0-9_-]/g, '')
        .slice(0, 40)
/* A small map kept in the session under a key ({reference: key}, {orderId: token}), the newest ten. */
function sessionMap(key) {
    const attributes = session()
    try {
        return JSON.parse(String(attributes?.[key] || '{}')) || {}
    } catch (error) {
        return {}
    }
}
function keepIn(key, name, value) {
    const attributes = session()
    if (!attributes || !name || !value) return
    const map = sessionMap(key)
    delete map[name]
    map[name] = String(value)
    const names = Object.keys(map)
    for (const old of names.slice(0, Math.max(0, names.length - 10)))
        delete map[old]
    attributes[key] = JSON.stringify(map)
}
const keysKey = (siteId) => 'passShopCheckout:' + siteId
const ordersKey = (siteId) => 'passShopOrders:' + siteId
const noticeKey = (siteId) => 'passShopCheckoutNotice:' + siteId
const keyOf = (siteId, reference) =>
    reference ? sessionMap(keysKey(siteId))[reference] || null : null
/* A checkout operation with the session's cart capability (and a reference's key when it has one): {result} or {error}. */
function call(context, operation, input) {
    const siteId = context.site.siteId
    const extra = {}
    if (input?.reference) {
        const key = keyOf(siteId, input.reference)
        if (key) extra.key = key
    }
    const found = carts().call(context, operation, {
        ...(input || {}),
        ...extra,
    })
    if (found.result?.returnKey && found.result.checkout?.reference)
        keepIn(
            keysKey(siteId),
            found.result.checkout.reference,
            found.result.returnKey,
        )
    if (found.result?.orderToken && found.result.confirmation?.orderId)
        keepIn(
            ordersKey(siteId),
            found.result.confirmation.orderId,
            found.result.orderToken,
        )
    if (found.result) {
        delete found.result.returnKey
        delete found.result.orderToken
    }
    return found
}
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
/* Shop P9 (design-shop §18.1 "Accessibility and devices"): an error notice is an alert with an id the refused field names
 * (aria-describedby); it takes the focus itself when no field of the page is named (markInvalid gives the field the focus). */
const noticeHtml = (notice) =>
    notice
        ? '<p class="shop-notice shop-notice-' +
          (notice.kind === 'error' ? 'error' : 'ok') +
          '" role="' +
          (notice.kind === 'error' ? 'alert' : 'status') +
          '"' +
          (notice.kind === 'error'
              ? ' id="ShopNotice" tabindex="-1"' +
                (notice.field ? '' : ' autofocus')
              : '') +
          '>' +
          esc(notice.text) +
          '</p>'
        : ''
/* The refused field of an error notice, when the page has it: invalid, described by the notice and focused (without
 * script, by autofocus); otherwise the notice takes the focus. */
function markInvalid(html, notice) {
    if (notice?.kind !== 'error' || !notice.field) return html
    if (!/^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(notice.field))
        return html.replace(' tabindex="-1">', ' tabindex="-1" autofocus>')
    const found = new RegExp('<input([^>]*?) name="' + notice.field + '"')
    // a hidden field (the revision, the operation id) cannot take the focus: the notice does
    const match = found.exec(html)
    if (!match || match[1].includes('type="hidden"'))
        return html.replace(' tabindex="-1">', ' tabindex="-1" autofocus>')
    return html.replace(
        found,
        '<input$1 aria-invalid="true" aria-describedby="ShopNotice" autofocus name="' +
            notice.field +
            '"',
    )
}
const hidden = (name, value) =>
    '<input type="hidden" name="' + name + '" value="' + esc(value ?? '') + '">'
const formToken = () =>
    ec.web ? hidden('moquiSessionToken', ec.web.sessionToken) : ''
const changeFields = (checkout) =>
    formToken() +
    hidden('expectedRevision', checkout.revision) +
    hidden('operationId', portal().operationId())
const field = (label, name, value, extra) =>
    '<label>' +
    esc(label) +
    ' <input name="' +
    name +
    '" value="' +
    esc(value ?? '') +
    '"' +
    (extra || '') +
    '></label>'
const enhanceScript = (context) =>
    '<script src="' + esc(base(context) + '/Checkout/enhance') + '"></script>'

/* ---- the checkout page ---- */
/* An address's fields; the delivery address's street, city and postal code are required, a billing address's only when
 * it is used (the authority checks it then). */
function addressFields(prefix, address) {
    const required = prefix ? '' : ' required'
    const n = (name) =>
        prefix ? prefix + name.charAt(0).toUpperCase() + name.slice(1) : name
    const a = address || {}
    return (
        field(ec.l10n.localize('Name'), n('toName'), a.toName, ' autocomplete="name"') +
        field(
            ec.l10n.localize('Street address'),
            n('address1'),
            a.address1,
            ' autocomplete="address-line1"' + required,
        ) +
        field(
            ec.l10n.localize('Apartment, suite'),
            n('address2'),
            a.address2,
            ' autocomplete="address-line2"',
        ) +
        field(
            ec.l10n.localize('City'),
            n('city'),
            a.city,
            ' autocomplete="address-level2"' + required,
        ) +
        field(
            ec.l10n.localize('State or province'),
            n('stateProvinceGeoId'),
            a.stateProvinceGeoId,
            ' autocomplete="address-level1"',
        ) +
        field(
            ec.l10n.localize('Postal code'),
            n('postalCode'),
            a.postalCode,
            ' autocomplete="postal-code"' + required,
        ) +
        field(
            ec.l10n.localize('Country'),
            n('countryGeoId'),
            a.countryGeoId || 'USA',
            ' autocomplete="country"',
        )
    )
}
const money = (value) => (value ? esc(value.display) : '')
/* The checkout's plain page: contact, addresses, delivery, payment and review, each a form of its own. */
function checkoutHtml(context, view, deliveryOptions, notice) {
    const c = view.checkout
    const action = (name) => esc(base(context) + '/Checkout/' + name)
    const parts = [noticeHtml(notice)]
    for (const change of c.review || [])
        parts.push(
            '<p class="shop-checkout-review" role="alert">' +
                esc(change.text) +
                '</p>',
        )
    for (const item of c.notices || [])
        parts.push('<p class="shop-cart-notice">' + esc(item.text) + '</p>')
    // Contact
    parts.push(
        '<section class="shop-checkout-step" id="CheckoutContact" aria-labelledby="CheckoutContactTitle"><h2 id="CheckoutContactTitle">' +
            esc(ec.l10n.localize('Contact')) +
            '</h2><form method="post" action="' +
            action('contact') +
            '">' +
            changeFields(c) +
            (c.contact.fromAccount
                ? '<p>' + esc(c.contact.emailAddress) + '</p>'
                : field(
                      ec.l10n.localize('Email'),
                      'emailAddress',
                      c.contact.emailAddress,
                      ' type="email" autocomplete="email" required',
                  )) +
            field(
                ec.l10n.localize('Name'),
                'name',
                c.contact.name,
                ' autocomplete="name" required',
            ) +
            (c.contact.phoneMode === 'hidden'
                ? ''
                : field(
                      ec.l10n.localize(
                          c.contact.phoneMode === 'required'
                              ? 'Phone'
                              : 'Phone (optional)',
                      ),
                      'phone',
                      c.contact.phone,
                      ' type="tel" autocomplete="tel"',
                  )) +
            '<button type="submit">' +
            esc(ec.l10n.localize('Save contact')) +
            '</button></form></section>',
    )
    // Addresses
    if (c.addresses.needed)
        parts.push(
            '<section class="shop-checkout-step" id="CheckoutAddresses" aria-labelledby="CheckoutAddressesTitle"><h2 id="CheckoutAddressesTitle">' +
                esc(ec.l10n.localize('Delivery address')) +
                '</h2>' +
                (c.addresses.shipping
                    ? '<p>' + esc(c.addresses.shipping.text) + '</p>'
                    : '') +
                (c.addresses.suggestion
                    ? '<form method="post" action="' +
                      action('addresses') +
                      '">' +
                      changeFields(c) +
                      hidden('useSuggestion', 'true') +
                      '<p>' +
                      esc(
                          ec.resource.expand(
                              'The carrier suggests: ${suggestion}',
                              '',
                              { suggestion: c.addresses.suggestion.text },
                          ),
                      ) +
                      '</p><button type="submit">' +
                      esc(ec.l10n.localize('Use the suggested address')) +
                      '</button></form>'
                    : '') +
                '<form method="post" action="' +
                action('addresses') +
                '">' +
                changeFields(c) +
                addressFields('', c.addresses.shipping) +
                '<label><input type="checkbox" name="billingSame" value="true"' +
                (c.addresses.billingSame ? ' checked' : '') +
                '> ' +
                esc(ec.l10n.localize('Billing address is the same')) +
                '</label><fieldset><legend>' +
                esc(ec.l10n.localize('Billing address (when different)')) +
                '</legend>' +
                addressFields('billing', c.addresses.billing) +
                '</fieldset><button type="submit">' +
                esc(ec.l10n.localize('Save address')) +
                '</button></form></section>',
        )
    // Delivery
    if (c.delivery.needed)
        parts.push(
            '<section class="shop-checkout-step" id="CheckoutDelivery" aria-labelledby="CheckoutDeliveryTitle"><h2 id="CheckoutDeliveryTitle">' +
                esc(ec.l10n.localize('Delivery method')) +
                '</h2>' +
                (!c.addresses.shipping
                    ? '<p>' +
                      esc(
                          ec.l10n.localize(
                              'Enter the delivery address to see delivery options.',
                          ),
                      ) +
                      '</p>'
                    : deliveryOptions?.length
                      ? '<form method="post" action="' +
                        action('delivery') +
                        '">' +
                        changeFields(c) +
                        '<fieldset><legend>' +
                        esc(ec.l10n.localize('Choose delivery')) +
                        '</legend>' +
                        deliveryOptions
                            .map(
                                (option) =>
                                    '<label><input type="radio" name="option" required value="' +
                                    esc(
                                        option.carrierPartyId +
                                            ':' +
                                            option.shipmentMethodEnumId,
                                    ) +
                                    '"' +
                                    (option.selected && c.delivery.done
                                        ? ' checked'
                                        : '') +
                                    '> ' +
                                    esc(option.label) +
                                    ' ' +
                                    money(option.amount) +
                                    '</label>',
                            )
                            .join('') +
                        '</fieldset><button type="submit">' +
                        esc(ec.l10n.localize('Choose delivery')) +
                        '</button></form>'
                      : '<p role="alert">' +
                        esc(
                            ec.l10n.localize(
                                'No delivery is offered to this address.',
                            ),
                        ) +
                        '</p>') +
                '</section>',
        )
    // Payment
    if (c.payment.needed)
        parts.push(
            '<section class="shop-checkout-step" id="CheckoutPayment" aria-labelledby="CheckoutPaymentTitle"><h2 id="CheckoutPaymentTitle">' +
                esc(ec.l10n.localize('Payment')) +
                '</h2>' +
                (c.payment.options.length
                    ? '<form method="post" action="' +
                      action('payment') +
                      '">' +
                      changeFields(c) +
                      '<fieldset><legend>' +
                      esc(ec.l10n.localize('Choose how to pay')) +
                      '</legend>' +
                      c.payment.options
                          .map(
                              (option) =>
                                  '<label><input type="radio" name="paymentOptionId" required value="' +
                                  esc(option.paymentOptionId) +
                                  '"' +
                                  (c.payment.selected?.paymentOptionId ===
                                  option.paymentOptionId
                                      ? ' checked'
                                      : '') +
                                  '> ' +
                                  esc(option.label) +
                                  ' ' +
                                  esc(
                                      ec.resource.expand(
                                          "(on ${provider}'s page)",
                                          '',
                                          { provider: option.provider },
                                      ),
                                  ) +
                                  '</label>',
                          )
                          .join('') +
                      '</fieldset>' +
                      (c.payment.options.some((option) => option.canSave)
                          ? '<label><input type="checkbox" name="savePaymentMethod" value="true"' +
                            (c.payment.savePaymentMethod ? ' checked' : '') +
                            '> ' +
                            esc(
                                ec.l10n.localize(
                                    'Keep this card for my next order',
                                ),
                            ) +
                            '</label>'
                          : '') +
                      '<button type="submit">' +
                      esc(ec.l10n.localize('Choose payment')) +
                      '</button></form><p><small>' +
                      esc(
                          ec.l10n.localize(
                              "You pay on the payment provider's page; this site never sees your card.",
                          ),
                      ) +
                      '</small></p>'
                    : '<p role="alert">' +
                      esc(
                          ec.l10n.localize(
                              'This store cannot take payments now.',
                          ),
                      ) +
                      '</p>') +
                '</section>',
        )
    // ReviewPurchase
    const t = c.totals
    parts.push(
        '<section class="shop-checkout-step" id="CheckoutReview" aria-labelledby="CheckoutReviewTitle"><h2 id="CheckoutReviewTitle">' +
            esc(ec.l10n.localize('Review your order')) +
            '</h2><ul class="shop-checkout-lines">' +
            c.lines
                .map(
                    (line) =>
                        '<li>' +
                        esc(line.name) +
                        (line.options
                            ? ' <small>' + esc(line.options) + '</small>'
                            : '') +
                        ' × ' +
                        esc(line.quantity) +
                        ' <span>' +
                        money(line.total) +
                        '</span></li>',
                )
                .join('') +
            '</ul><dl class="shop-checkout-totals" id="CheckoutTotals" aria-live="polite"><dt>' +
            esc(ec.l10n.localize('Items')) +
            '</dt><dd>' +
            money(t.items) +
            '</dd>' +
            (t.discounts && Number(t.discounts.amount) !== 0
                ? '<dt>' +
                  esc(ec.l10n.localize('Discounts')) +
                  '</dt><dd>' +
                  money(t.discounts) +
                  '</dd>'
                : '') +
            (t.shipping
                ? '<dt>' +
                  esc(ec.l10n.localize('Delivery charge')) +
                  '</dt><dd>' +
                  money(t.shipping) +
                  '</dd>'
                : '') +
            '<dt>' +
            esc(ec.l10n.localize('Tax')) +
            '</dt><dd>' +
            money(t.tax) +
            '</dd><dt>' +
            esc(ec.l10n.localize('Total')) +
            '</dt><dd id="CheckoutTotal">' +
            money(t.total) +
            '</dd><dt>' +
            esc(ec.l10n.localize('Amount due now')) +
            '</dt><dd>' +
            money(t.dueNow) +
            '</dd></dl>' +
            (c.missing.length
                ? '<p>' +
                  esc(
                      ec.resource.expand(
                          'Complete ${steps} to place your order.',
                          '',
                          { steps: c.missing.join(', ') },
                      ),
                  ) +
                  '</p>'
                : '<form method="post" action="' +
                  action('submit') +
                  '" id="CheckoutSubmit">' +
                  changeFields(c) +
                  recurringFields(c) +
                  optInFields(c) +
                  (c.terms.required
                      ? hidden('termsVersion', c.terms.version) +
                        '<label><input type="checkbox" name="acceptTerms" value="true" required> ' +
                        (c.terms.url
                            ? ec.resource.expand(
                                  'I accept the <a href="${href}">${title}</a>',
                                  '',
                                  {
                                      href: esc(c.terms.url),
                                      title: esc(c.terms.title),
                                  },
                              )
                            : esc(
                                  ec.resource.expand('I accept the ${title}', '', {
                                      title: c.terms.title,
                                  }),
                              )) +
                        '</label>'
                      : '') +
                  '<button type="submit">' +
                  ec.resource.expand('Place order and pay ${amount}', '', {
                      amount: money(t.dueNow),
                  }) +
                  '</button></form>') +
            '</section>',
    )
    return markInvalid(
        '<div class="shop-checkout" id="ShopCheckout"><h1>' +
            esc(ec.l10n.localize('Checkout')) +
            '</h1>' +
            parts.join('') +
            '</div>',
        notice,
    )
}
/* The page through the active release's checkout page kind with the shop.checkout component, or in the PASS shell.
 * {html} for the release's whole document, else {bodyHtml}. */
function themed(context, componentHtml, title) {
    if (context.release) {
        const found = portal().attempt('getShopPage', {
            siteId: context.site.siteId,
            pageKind: 'checkout',
        })
        if (found.result?.release) {
            found.result.view = Object.assign({}, found.result.view, {
                page: Object.assign({}, found.result.view?.page, { title }),
            })
            const rendered = theme().renderView(
                Object.assign({}, context, {
                    checkoutComponent: () => componentHtml,
                }),
                'checkout',
                found.result,
            )
            if (rendered?.html)
                return { status: rendered.status, html: rendered.html }
        }
    }
    return { status: 200, html: null, bodyHtml: componentHtml, title }
}
/* Checkout: the cart's checkout (begun by the cart's Checkout button); without one, back to the cart. */
function page(context) {
    const siteId = context.site.siteId
    const notice = takeNotice(siteId)
    const found = call(context, 'getCheckout', {})
    if (found.error) return { redirect: base(context) + '/Cart' }
    const view = found.result
    if (['paymentPending', 'placementPending'].includes(view.checkout.state))
        return {
            redirect:
                base(context) +
                '/PaymentResult?ref=' +
                encodeURIComponent(view.checkout.reference),
        }
    if (view.checkout.state === 'completed')
        return {
            redirect:
                base(context) +
                '/OrderConfirmation?ref=' +
                encodeURIComponent(view.checkout.reference),
        }
    const options =
        view.checkout.delivery.needed && view.checkout.addresses.shipping
            ? call(context, 'getDeliveryOptions', {}).result?.options || []
            : []
    return themed(
        context,
        checkoutHtml(context, view, options, notice),
        ec.l10n.localize('Checkout'),
    )
}

/* ---- the transitions ---- */
const back = (context, found, okText, location) => {
    notify(
        context.site.siteId,
        found.error
            ? {
                  kind: 'error',
                  text:
                      found.error.fieldErrors?.[0]?.message ||
                      found.error.message,
                  field: found.error.fieldErrors?.[0]?.field || null,
              }
            : { kind: 'ok', text: okText },
    )
    ec.web?.response?.sendRedirect(location || base(context) + '/Checkout')
}
/* The store's optional emails (Commerce P9 follow-up): separate boxes, none checked but by the buyer, each saying what it is
 * and is not; the receipt and order notices come either way. */
function optInFields(c) {
    const offered = c.optIns || []
    if (!offered.length) return ''
    return (
        '<fieldset class="shop-checkout-optins" id="CheckoutOptIns"><legend>' +
        esc(ec.l10n.localize('Optional emails')) +
        '</legend>' +
        offered
            .map(
                (o) =>
                    '<label><input type="checkbox" name="optIn" value="' +
                    esc(o.optInId) +
                    '"' +
                    (o.chosen ? ' checked' : '') +
                    '> ' +
                    esc(o.label) +
                    '</label><p><small>' +
                    esc(o.statement) +
                    (o.alreadyOn
                        ? ' ' +
                          esc(ec.l10n.localize('Already on for your account.'))
                        : '') +
                    '</small></p>',
            )
            .join('') +
        '<p><small>' +
        esc(
            ec.l10n.localize(
                'Not needed for your order: your receipt and order updates come either way.',
            ),
        ) +
        '</small></p></fieldset>'
    )
}
/* Every value of a repeated form field. */
const params = (name) => {
    const value = ec.web?.parameters?.[name]
    if (value == null) return []
    if (typeof value === 'object' && value.length != null)
        return Array.from(value).map(String)
    return [String(value)]
}
const changeInput = () => ({
    expectedRevision: param('expectedRevision'),
    ...(param('operationId') ? { operationId: param('operationId') } : {}),
})
function begin(context) {
    const found = call(context, 'beginCheckout', {})
    if (found.error) {
        carts().notify(context.site.siteId, {
            kind: 'error',
            text: found.error.message,
        })
        ec.web?.response?.sendRedirect(base(context) + '/Cart')
        return
    }
    ec.web?.response?.sendRedirect(base(context) + '/Checkout')
}
function contact(context) {
    const found = call(context, 'setCheckoutContact', {
        ...changeInput(),
        emailAddress: param('emailAddress'),
        name: param('name'),
        phone: param('phone'),
    })
    back(context, found, ec.l10n.localize('Saved your contact details.'))
}
const ADDRESS_FIELDS = [
    'toName',
    'address1',
    'address2',
    'city',
    'stateProvinceGeoId',
    'postalCode',
    'countryGeoId',
]
function addresses(context) {
    const input = { ...changeInput() }
    if (param('useSuggestion')) input.useSuggestion = 'true'
    else {
        for (const name of ADDRESS_FIELDS)
            if (param(name) != null) input[name] = param(name)
        const same = param('billingSame') === 'true'
        input.billingSame = same ? 'true' : 'false'
        if (!same)
            for (const name of ADDRESS_FIELDS) {
                const billing =
                    'billing' + name.charAt(0).toUpperCase() + name.slice(1)
                if (param(billing) != null) input[billing] = param(billing)
            }
    }
    back(
        context,
        call(context, 'setCheckoutAddresses', input),
        ec.l10n.localize('Saved the address.'),
    )
}
function delivery(context) {
    const [carrierPartyId, shipmentMethodEnumId] = String(
        param('option') || ':',
    ).split(':')
    back(
        context,
        call(context, 'selectDelivery', {
            ...changeInput(),
            carrierPartyId,
            shipmentMethodEnumId,
        }),
        ec.l10n.localize('Chose the delivery.'),
    )
}
function payment(context) {
    const found = call(context, 'selectPayment', {
        ...(param('operationId') ? { operationId: param('operationId') } : {}),
        paymentOptionId: param('paymentOptionId'),
        savePaymentMethod:
            param('savePaymentMethod') === 'true' ? 'true' : 'false',
    })
    back(context, found, ec.l10n.localize('Chose how to pay.'))
}
/* Shop P7: a subscription's renewal terms (CheckoutView's recurring): the price and term, and for an automatic offer the
   consent to renewal charges of the card kept now, unchecked until the buyer checks it and required to subscribe. */
function recurringFields(c) {
    const r = c.recurring
    if (!r) return ''
    return (
        '<fieldset class="shop-recurring"><legend>' +
        ec.resource.expand('${name}: ${price} every ${term}', '', {
            name: esc(r.name),
            price: money(r.price),
            term: esc(r.termText),
        }) +
        '</legend>' +
        (r.consentRequired
            ? '<label><input type="checkbox" name="recurringConsent" value="true" required> ' +
              esc(r.statement) +
              '</label>'
            : '<p>' + esc(r.statement) + '</p>') +
        '</fieldset>'
    )
}
/* Marketing follow-up 4: the visitor key this browser holds (Marketing's first-party mkt_vk cookie), sent with the submit so the
   authority may keep its digest with the order for attribution; none when the browser asks not to be tracked (TrackingLib.js
   checkoutKeyInput, shared with Register's payment start). The authority decides whether it is kept. */
const visitorKeyInput = () =>
    ec.resource
        .script('component://mr-pass/script/TrackingLib.js')
        .checkoutKeyInput(ec.web?.request)
/* Checkout/submit: frozen and paid; the result page links the provider's page (a change found is shown on the checkout). */
function submit(context) {
    const found = call(context, 'submitCheckout', {
        ...changeInput(),
        termsVersion: param('termsVersion'),
        acceptTerms: param('acceptTerms') === 'true' ? 'true' : 'false',
        // Shop P7: a subscription's renewal consent, sent only when the buyer checked it
        ...(param('recurringConsent') === 'true'
            ? { recurringConsent: 'true' }
            : {}),
        optIns: params('optIn')
            .filter((id) => /^[A-Za-z]{1,30}$/.test(id))
            .join(','),
        ...visitorKeyInput(),
    })
    if (found.error) return back(context, found, '')
    const c = found.result.checkout
    ec.web?.response?.sendRedirect(
        base(context) +
            (c.state === 'completed'
                ? '/OrderConfirmation'
                : '/PaymentResult') +
            '?ref=' +
            encodeURIComponent(c.reference),
    )
}
/* Checkout/return: a provider's return. Only the reference and key are read; whatever else the provider or browser adds is
 * ignored. The key is kept in this session only after the authority read the checkout with it (SEC-PSF-82), so a return
 * after the session ended reads the result too, and a link with a made-up or another shopper's pair puts nothing of use in
 * a visitor's session: the pair alone reads the payment's state, never its payment page (the authority's rule). The key
 * is returnToken, a name the request log leaves out (SEC-PSS-02); key is its name in a return address made before. */
function returned(context) {
    const reference = cleanRef(param('ref'))
    const key = String(param('returnToken') || param('key') || '')
        .replace(/[^A-Za-z0-9_-]/g, '')
        .slice(0, 128)
    // the payer is back: the payment looked up now (the result page then shows what the provider said)
    if (reference) {
        const presented = key || keyOf(context.site.siteId, reference)
        const found = carts().call(context, 'getCheckoutPaymentResult', {
            reference,
            ...(presented ? { key: presented } : {}),
            returned: 'true',
        })
        if (key && found.result?.checkout)
            keepIn(keysKey(context.site.siteId), reference, key)
    }
    ec.web?.response?.sendRedirect(
        base(context) + '/PaymentResult?ref=' + encodeURIComponent(reference),
    )
}
const STATUS = {
    NotFound: 404,
    AuthenticationRequired: 401,
    Unauthorized: 403,
    Conflict: 409,
    Unprocessable: 422,
    Tarpit: 429,
}
function sendJson(status, body) {
    const response = ec.web?.response
    if (!response) return
    response.setStatus(status)
    response.setHeader('Cache-Control', 'no-store')
    response.setContentType('application/json;charset=UTF-8')
    response.write(JSON.stringify(body))
}
/* PaymentResult/state (the result page's polling): the payment's state as JSON. */
function resultState(context) {
    const found = call(context, 'getCheckoutPaymentResult', {
        reference: cleanRef(param('ref')),
    })
    sendJson(
        found.error ? STATUS[found.error.kind] || 503 : 200,
        found.error
            ? {
                  ok: false,
                  error: {
                      kind: found.error.kind,
                      message: found.error.message,
                  },
              }
            : {
                  ok: true,
                  state: found.result.checkout.state,
                  attempt: found.result.checkout.attempt?.state || null,
              },
    )
}
/* Checkout/enhance: the pages' same-origin script (PASS's CSP allows only 'self' scripts): the relay posts its form at
 * once, and the result page polls its state with backoff (about two minutes in all), reloading when it changes. */
const ENHANCE = `(function () {
    var relay = document.getElementById('ShopPaymentRelay')
    if (relay) { relay.submit(); return }
    var result = document.getElementById('ShopPaymentResult')
    if (!result || !result.getAttribute('data-poll')) return
    var url = result.getAttribute('data-poll'), state = result.getAttribute('data-state')
    var waits = [1, 2, 3, 5, 8, 13, 21, 34, 34], i = 0
    function poll() {
        if (i >= waits.length) {
            var note = document.getElementById('ShopPaymentStill')
            if (note) note.hidden = false
            return
        }
        setTimeout(function () {
            var request = new XMLHttpRequest()
            request.open('GET', url)
            request.setRequestHeader('Accept', 'application/json')
            request.onload = function () {
                try {
                    var body = JSON.parse(request.responseText)
                    if (body.ok && (body.state + ':' + body.attempt) !== state) { location.reload(); return }
                } catch (e) {}
                i++; poll()
            }
            request.onerror = function () { i++; poll() }
            request.send()
        }, waits[i] * 1000)
    }
    poll()
})()
`
function enhance() {
    const response = ec.web?.response
    if (!response) return
    response.setHeader('Cache-Control', 'no-store')
    response.setContentType('application/javascript;charset=UTF-8')
    response.write(ENHANCE)
}

/* ---- the payment's result ---- */
function resultHtml(context, view, notice) {
    const c = view.checkout
    const a = c.attempt
    const reference = encodeURIComponent(c.reference)
    const parts = [noticeHtml(notice)]
    const state = c.state + ':' + (a?.state || '')
    let poll = false
    if (c.state === 'paymentPending' && a?.state === 'pending') {
        parts.push(
            '<p><strong>' +
                esc(a.message) +
                '</strong> ' +
                money(a.amount) +
                '</p>',
        )
        const provider = a.providerForm
            ? base(context) + '/PaymentRelay?ref=' + reference
            : a.providerUrl
        if (provider)
            parts.push(
                '<p><a class="shop-pay-link" href="' +
                    esc(provider) +
                    '">' +
                    esc(ec.l10n.localize('Continue to the payment page')) +
                    '</a></p>',
            )
        poll = true
    } else if (c.state === 'paymentPending') {
        parts.push(
            '<p><strong>' +
                esc(
                    a?.message ||
                        ec.l10n.localize('We are confirming your payment.'),
                ) +
                '</strong></p>',
        )
        poll = true
    } else if (c.state === 'placementPending') {
        parts.push(
            '<p><strong>' +
                esc(ec.l10n.localize('Your payment is approved.')) +
                '</strong> ' +
                esc(
                    ec.l10n.localize(
                        'We are finishing your order; this page shows it when it is ready.',
                    ),
                ) +
                '</p>',
        )
        poll = true
    } else if (['ready', 'editing', 'reviewRequired'].includes(c.state))
        parts.push(
            '<p role="alert"><strong>' +
                esc(
                    a?.message ||
                        ec.l10n.localize('Your payment did not complete.'),
                ) +
                '</strong></p><form method="post" action="' +
                esc(base(context) + '/Checkout/resume') +
                '">' +
                formToken() +
                hidden('ref', c.reference) +
                '<button type="submit">' +
                esc(ec.l10n.localize('Back to checkout')) +
                '</button></form>',
        )
    else
        parts.push(
            '<p>' +
                esc(ec.l10n.localize('This checkout is no longer open.')) +
                '</p>',
        )
    parts.push(
        '<p id="ShopPaymentStill" hidden>' +
            esc(
                ec.l10n.localize(
                    'Your payment is still processing. We will email you when your order is confirmed; you can also check again later.',
                ),
            ) +
            '</p>' +
            '<p><a href="' +
            esc(base(context) + '/PaymentResult?ref=' + reference) +
            '">' +
            esc(ec.l10n.localize('Check again')) +
            '</a></p>',
    )
    return (
        '<section class="shop-payment-result" id="ShopPaymentResult" aria-live="polite" data-state="' +
        esc(state) +
        '"' +
        (poll
            ? ' data-poll="' +
              esc(base(context) + '/PaymentResult/state?ref=' + reference) +
              '"'
            : '') +
        '><h1>' +
        esc(ec.l10n.localize('Payment')) +
        '</h1>' +
        markInvalid(parts.join(''), notice) +
        '</section>' +
        (poll ? enhanceScript(context) : '')
    )
}
/* PaymentResult: the attempt's state for the checkout's reference (its key from this session, or the cart's capability);
 * a placed order goes to its confirmation. */
function resultPage(context) {
    const reference = cleanRef(param('ref'))
    const found = call(context, 'getCheckoutPaymentResult', { reference })
    if (found.error)
        return themed(
            context,
            '<section class="shop-payment-result"><h1>' +
                esc(ec.l10n.localize('Payment')) +
                '</h1><p role="alert">' +
                esc(found.error.message) +
                '</p></section>',
            ec.l10n.localize('Payment'),
        )
    if (found.result.checkout.state === 'completed')
        return {
            redirect:
                base(context) +
                '/OrderConfirmation?ref=' +
                encodeURIComponent(reference),
        }
    return themed(
        context,
        resultHtml(context, found.result, takeNotice(context.site.siteId)),
        ec.l10n.localize('Payment'),
    )
}
/* Checkout/resume: a resolved attempt without a payment, back to the checkout (a refreshed session gets the cart again). */
function resume(context) {
    const reference = cleanRef(param('ref'))
    const found = call(context, 'resumeCheckout', { reference })
    if (found.result?.token)
        carts().keep(context.site.siteId, { token: found.result.token })
    back(context, found, ec.l10n.localize('Your checkout is open again.'))
}

/* ---- the payment relay (F37) ---- */
/* PaymentRelay: a fresh form token for the pending hosted payment, posted at once to the provider's page (only this
 * route's CSP allows that form-action); the token is in this page alone, which nothing keeps (no-store). */
/* Whether a relay form's address is the hosted payment page the relay routes' CSP form-action names (Authorize.Net's
 * Accept Hosted, production or sandbox): the relays post a payment token to it and to nothing else (SEC-PSS-64). */
const relayFormUrl = (url) =>
    /^https:\/\/(accept|test)\.authorize\.net\//.test(String(url || ''))
function relayPage(context) {
    const reference = cleanRef(param('ref'))
    const answered = call(context, 'getCheckoutPaymentForm', { reference })
    const found =
        answered.error || relayFormUrl(answered.result?.formUrl)
            ? answered
            : {
                  error: {
                      kind: 'Unavailable',
                      message: ec.l10n.localize(
                          'The payment page cannot be opened now.',
                      ),
                  },
              }
    if (found.error)
        return themed(
            context,
            '<section class="shop-payment-result"><h1>' +
                esc(ec.l10n.localize('Payment')) +
                '</h1><p role="alert">' +
                esc(found.error.message) +
                '</p><p><a href="' +
                esc(
                    base(context) +
                        '/PaymentResult?ref=' +
                        encodeURIComponent(reference),
                ) +
                '">' +
                esc(ec.l10n.localize('Back to your payment')) +
                '</a></p></section>',
            ec.l10n.localize('Payment'),
        )
    const form = found.result
    const html =
        '<section class="shop-payment-relay"><h1>' +
        esc(ec.l10n.localize('Payment')) +
        '</h1><form method="post" id="ShopPaymentRelay" action="' +
        esc(form.formUrl) +
        '">' +
        Object.entries(form.fields || {})
            .map(([name, value]) => hidden(esc(name), value))
            .join('') +
        '<p>' +
        esc(ec.l10n.localize('Taking you to the payment page.')) +
        '</p><button type="submit">' +
        esc(ec.l10n.localize('Continue to the payment page')) +
        '</button></form></section>' +
        enhanceScript(context)
    return themed(context, html, ec.l10n.localize('Payment'))
}

/* ---- the order confirmation ---- */
function confirmationHtml(context, view) {
    const o = view.confirmation
    // the reference alone (another device, F85): the order's state, nothing of the buyer
    const orderStatus =
        ec.resource.expand('Order <strong>${orderId}</strong>', '', {
            orderId: esc(o.orderId),
        }) +
        ' · ' +
        esc(o.statusText)
    if (o.minimal)
        return (
            '<section class="shop-confirmation" id="ShopConfirmation"><h1>' +
            esc(ec.l10n.localize('Thank you for your order')) +
            '</h1><p role="status">' +
            orderStatus +
            '</p><p>' +
            esc(ec.l10n.localize('We emailed the details.')) +
            ' ' +
            esc(
                ec.l10n.localize(
                    'Open the order from that email, or sign in, to see it.',
                ),
            ) +
            '</p></section>'
        )
    const qr = (() => {
        try {
            return o.orderUrl
                ? ec.resource.barcodeSvg('QR', o.orderUrl, {
                      moduleWidth: '1mm',
                      quietZone: 4,
                  })
                : ''
        } catch (error) {
            ec.logger.warn(
                'Shop order confirmation QR not made: ' + error.message,
            )
            return ''
        }
    })()
    const accountBase = ec.context.get('passBases')?.account ?? '/account'
    return (
        '<section class="shop-confirmation" id="ShopConfirmation"><h1>' +
        esc(ec.l10n.localize('Thank you for your order')) +
        '</h1><p role="status">' +
        orderStatus +
        (o.placedDate ? ' · ' + esc(o.placedDate) : '') +
        '</p><p>' +
        esc(
            ec.resource.expand('We sent the details to ${email}.', '', {
                email: o.contactEmail,
            }),
        ) +
        ' ' +
        esc(ec.l10n.localize('We will email you as your order moves on.')) +
        '</p><ul class="shop-checkout-lines">' +
        o.lines
            .map(
                (line) =>
                    '<li>' +
                    esc(line.name) +
                    ' × ' +
                    esc(line.quantity) +
                    ' <span>' +
                    money(line.total) +
                    '</span></li>',
            )
            .join('') +
        '</ul><dl class="shop-checkout-totals"><dt>' +
        esc(ec.l10n.localize('Items')) +
        '</dt><dd>' +
        money(o.totals.items) +
        '</dd>' +
        (o.totals.shipping
            ? '<dt>' +
              esc(ec.l10n.localize('Delivery charge')) +
              '</dt><dd>' +
              money(o.totals.shipping) +
              '</dd>'
            : '') +
        '<dt>' +
        esc(ec.l10n.localize('Tax')) +
        '</dt><dd>' +
        money(o.totals.tax) +
        '</dd><dt>' +
        esc(ec.l10n.localize('Total')) +
        '</dt><dd>' +
        money(o.totals.total) +
        '</dd><dt>' +
        esc(ec.l10n.localize('Payment')) +
        '</dt><dd>' +
        esc(o.payment.text) +
        '</dd>' +
        (o.delivery
            ? '<dt>' +
              esc(ec.l10n.localize('Delivery to')) +
              '</dt><dd>' +
              esc(o.delivery.address) +
              ' (' +
              esc(o.delivery.method) +
              ')</dd>'
            : '') +
        '</dl>' +
        (qr
            ? '<figure class="shop-order-qr"><div aria-hidden="true">' +
              qr +
              '</div><figcaption>' +
              esc(
                  ec.l10n.localize(
                      'Scan to open this order after you sign in',
                  ),
              ) +
              '</figcaption></figure>'
            : '') +
        '<nav aria-label="' +
        esc(ec.l10n.localize('Next steps')) +
        '"><p><a href="' +
        esc(base(context) + '/') +
        '">' +
        esc(ec.l10n.localize('Continue shopping')) +
        '</a></p>' +
        (o.guest
            ? '<p>' +
              ec.resource.expand(
                  '<a href="${href}">Create an account with ${email}</a> to see this order later.',
                  '',
                  {
                      href: esc(accountBase + '/Register'),
                      email: esc(o.contactEmail),
                  },
              ) +
              ' ' +
              esc(
                  ec.l10n.localize(
                      'Once you verify that address, this order moves to your account, and the links we email open it after you sign in.',
                  ),
              ) +
              '</p>'
            : '') +
        '</nav></section>'
    )
}
/* OrderConfirmation: the placed order for the checkout's reference (its key from this session), a placed cart's capability
 * or the signed-in customer, else the guest's order link kept in this session. */
function confirmationPage(context) {
    const reference = cleanRef(param('ref'))
    let found = call(context, 'getOrderConfirmation', { reference })
    if (found.error) {
        const tokens = Object.values(sessionMap(ordersKey(context.site.siteId)))
        for (const orderToken of tokens.reverse()) {
            const byLink = call(context, 'getOrderConfirmation', { orderToken })
            if (byLink.result?.confirmation?.reference === reference) {
                found = byLink
                break
            }
        }
    }
    if (found.error)
        return themed(
            context,
            '<section class="shop-confirmation"><h1>' +
                esc(ec.l10n.localize('Your order')) +
                '</h1><p role="alert">' +
                esc(found.error.message) +
                '</p></section>',
            ec.l10n.localize('Order'),
        )
    return themed(
        context,
        confirmationHtml(context, found.result),
        ec.l10n.localize('Order confirmation'),
    )
}

const actions = {
    begin,
    contact,
    addresses,
    delivery,
    payment,
    submit,
    returned,
    resume,
    resultState,
    enhance,
}
function act(context, name) {
    if (!actions[name]) throw new Error('Unknown checkout action ' + name)
    return actions[name](context)
}
;({
    page,
    resultPage,
    relayPage,
    relayFormUrl,
    confirmationPage,
    act,
    checkoutHtml,
    // Shop P9: the labelled, focused error (ShopCheckout spec)
    noticeHtml,
    markInvalid,
    keysKey,
    ordersKey,
    // Shop P6: the guest's order links kept in this session, and the themed page, for the order and account pages
    orderLinkOf: (siteId, orderId) =>
        orderId ? sessionMap(ordersKey(siteId))[orderId] || null : null,
    keepOrderLink: (siteId, orderId, token) =>
        keepIn(ordersKey(siteId), orderId, token),
    orderLinks: (siteId) => sessionMap(ordersKey(siteId)),
    themed,
})
