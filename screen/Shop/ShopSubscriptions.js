/* Shop's subscription pages (impl-shop P7; design-shop §10 Subscriptions, SubscriptionDetail). The authority keeps every
 * record (Mantle's ShopSubscriptionServices); these pages are a signed-in verified buyer's, through the account pages'
 * helpers (Shop/ShopAccount.js), and render through the active release's checkout page kind or the PASS shell.
 *
 * - Subscriptions (/Subscriptions): each subscription's billing and access apart (a cancelled renewal keeps access to the
 *   paid term) and the store's offers; Subscribe begins the purchase and goes on to the checkout, which asks for the
 *   renewal consent of an automatic offer. PublicSite.subscriptionUrl points here (the Forum's "Manage your subscription").
 * - SubscriptionDetail (/Subscriptions/{contractId}): the plan, card and consent, the history of the purchase and each
 *   renewal, and the forms ChangeMethod (another kept card with consent), CancelRenewal (confirmed, at the revision),
 *   ResolveRenewal (charge a waiting renewal again) and RenewPrepaid (another prepaid term).
 * CC0 plus patent grant. */
const account = () =>
    ec.resource.script('component://mr-pass/screen/Shop/ShopAccount.js')
const h = () => account().helpers
const base = (context) => context.mount.base || ''
const esc = (text) => h().esc(text)
const money = (value) => (value ? esc(value.display) : '')
const cleanId = (value) =>
    String(value || '')
        .replace(/[^A-Za-z0-9_-]/g, '')
        .slice(0, 40)
const form = (context, path, fields, button, extra) =>
    '<form method="post" action="' +
    esc(base(context) + '/Subscriptions/' + path) +
    '">' +
    h().formToken() +
    h().hidden(
        'operationId',
        ec.user.randomString(20).replace(/[^A-Za-z0-9]/g, 'x'),
    ) +
    fields +
    '<button type="submit"' +
    (extra || '') +
    '>' +
    esc(button) +
    '</button></form>'
const refusal = (context, title, found, path) =>
    h().page(
        context,
        title,
        '<h1>' +
            esc(title) +
            '</h1><p role="alert">' +
            esc(found.error.message) +
            '</p>' +
            (found.error.kind === 'AuthenticationRequired'
                ? h().signIn(context, path)
                : ''),
    )
const stateLine = (s) =>
    '<p><strong>' +
    esc(s.billingText) +
    '</strong> · ' +
    esc(s.accessText) +
    (s.nextRenewalText
        ? ' · ' +
          esc(
              ec.resource.expand('Next charge ${amount} on ${date}', '', {
                  amount: s.nextAmount ? s.nextAmount.display : '',
                  date: s.nextRenewalText,
              }),
          )
        : '') +
    (s.cancelAtText
        ? ' · ' +
          esc(
              ec.resource.expand('Ends ${date}', '', { date: s.cancelAtText }),
          )
        : '') +
    '</p>'

/* ---- Subscriptions ---- */
function listPage(context) {
    const found = h().attempt(context, 'getSubscriptions', {})
    const title = ec.l10n.localize('Your subscriptions')
    if (found.error) return refusal(context, title, found, '/Subscriptions')
    const items = found.result.subscriptions
        .map(
            (s) =>
                '<li><h2><a href="' +
                esc(base(context) + '/Subscriptions/' + s.contractId) +
                '">' +
                esc(s.name) +
                '</a></h2><p>' +
                esc(
                    ec.resource.expand('${price} every ${term}', '', {
                        price: s.price ? s.price.display : '',
                        term: s.termText,
                    }),
                ) +
                '</p>' +
                stateLine(s) +
                (s.actionNeeded
                    ? '<p role="alert">' +
                      esc(ec.l10n.localize('Your renewal needs attention.')) +
                      '</p>'
                    : '') +
                '</li>',
        )
        .join('')
    const offers = found.result.offers
        .map(
            (o) =>
                '<li><p><strong>' +
                esc(o.name) +
                '</strong> ' +
                esc(
                    ec.resource.expand(
                        o.autoRenew
                            ? '${price} every ${term}, renews until you cancel'
                            : '${price} every ${term}, prepaid',
                        '',
                        {
                            price: o.price ? o.price.display : '',
                            term: o.termText,
                        },
                    ),
                ) +
                '</p>' +
                form(
                    context,
                    'purchase',
                    h().hidden('offerId', o.offerId),
                    ec.l10n.localize('Subscribe'),
                ) +
                '</li>',
        )
        .join('')
    return h().page(
        context,
        title,
        '<h1>' +
            esc(title) +
            '</h1>' +
            h().takeNotice(context.site.siteId) +
            '<section id="SubscriptionList">' +
            (items
                ? '<ul class="shop-subscriptions">' + items + '</ul>'
                : '<p>' +
                  esc(ec.l10n.localize('You have no subscriptions yet.')) +
                  '</p>') +
            '</section>' +
            (offers
                ? '<section id="Offers"><h2>' +
                  esc(ec.l10n.localize('Subscribe')) +
                  '</h2><ul>' +
                  offers +
                  '</ul></section>'
                : ''),
    )
}

/* ---- SubscriptionDetail ---- */
function detailPage(context, contractId) {
    const path = '/Subscriptions/' + cleanId(contractId)
    const found = h().attempt(context, 'getSubscription', {
        contractId: cleanId(contractId),
    })
    if (found.error)
        return refusal(context, ec.l10n.localize('Your subscription'), found, path)
    const s = found.result.subscription
    const id = h().hidden('contractId', s.contractId)
    const revision = h().hidden('expectedRevision', s.revision)
    const history = s.history
        .map(
            (row) =>
                '<tr><td>' +
                esc(row.periodText) +
                '</td><td>' +
                (row.orderId
                    ? '<a href="' +
                      esc(base(context) + '/Orders/' + row.orderId) +
                      '">' +
                      esc(row.orderId) +
                      '</a>'
                    : '') +
                '</td><td>' +
                money(row.amount) +
                '</td><td>' +
                esc(row.stateText) +
                (row.nextRetryText
                    ? esc(
                          ec.resource.expand(', next try ${date}', '', {
                              date: row.nextRetryText,
                          }),
                      )
                    : '') +
                '</td></tr>',
        )
        .join('')
    const methods = s.methods
        .map(
            (m) =>
                '<option value="' +
                esc(m.paymentMethodId) +
                '"' +
                (s.method?.paymentMethodId === m.paymentMethodId
                    ? ' selected'
                    : '') +
                '>' +
                esc(
                    m.brand
                        ? ec.resource.expand(
                              '${brand} ending ${last4}',
                              '',
                              { brand: m.brand, last4: m.last4 },
                          )
                        : ec.resource.expand('Card ending ${last4}', '', {
                              last4: m.last4,
                          }),
                ) +
                '</option>',
        )
        .join('')
    const resolve = s.actionNeeded
        ? '<section id="ResolveRenewal"><h2>' +
          esc(ec.l10n.localize('Your renewal')) +
          '</h2><p role="alert">' +
          esc(ec.l10n.localize('The renewal payment did not go through.')) +
          '</p>' +
          form(context, 'resume', id, ec.l10n.localize('Try the payment again')) +
          '</section>'
        : ''
    const change =
        s.autoRenew && s.canCancel
            ? '<section id="ChangeMethod"><h2>' +
              esc(ec.l10n.localize('Card for renewals')) +
              '</h2><p>' +
              esc(s.consentText) +
              '</p>' +
              (methods
                  ? form(
                        context,
                        'method',
                        id +
                            revision +
                            '<label>' +
                            esc(ec.l10n.localize('Card')) +
                            ' <select name="paymentMethodId">' +
                            methods +
                            '</select></label><label><input type="checkbox" name="consent" value="true" required> ' +
                            esc(
                                ec.resource.expand(
                                    'I agree to renewal charges of ${price} to this card every ${term} until I cancel',
                                    '',
                                    {
                                        price: s.price ? s.price.display : '',
                                        term: s.termText,
                                    },
                                ),
                            ) +
                            '</label>',
                        ec.l10n.localize('Use this card'),
                    )
                  : '') +
              '<p><a href="' +
              esc(base(context) + '/PaymentMethods') +
              '">' +
              esc(ec.l10n.localize('Add a card')) +
              '</a></p></section>'
            : ''
    const cancel = s.canCancel
        ? '<section id="CancelRenewal"><h2>' +
          esc(ec.l10n.localize('Cancel renewal')) +
          '</h2><p>' +
          esc(
              ec.resource.expand(
                  'Access lasts until ${date}; no further charges are made.',
                  '',
                  { date: s.paidThroughText },
              ),
          ) +
          '</p>' +
          form(
              context,
              'cancel',
              id +
                  revision +
                  '<label>' +
                  esc(ec.l10n.localize('Reason (optional)')) +
                  ' <input name="reason" maxlength="255"></label><label><input type="checkbox" name="confirmCancel" value="true" required> ' +
                  esc(
                      ec.resource.expand('Stop renewing ${name}', '', {
                          name: s.name,
                      }),
                  ) +
                  '</label>',
              ec.l10n.localize('Cancel renewal'),
          ) +
          '</section>'
        : ''
    const renew = s.renewOffer
        ? '<section id="RenewPrepaid"><h2>' +
          esc(ec.l10n.localize('Buy another term')) +
          '</h2><p>' +
          esc(
              ec.resource.expand(
                  '${price} for ${term}, starting when the current term ends.',
                  '',
                  {
                      price: s.renewOffer.price ? s.renewOffer.price.display : '',
                      term: s.renewOffer.termText,
                  },
              ),
          ) +
          '</p>' +
          form(context, 'purchase', id, ec.l10n.localize('Buy another term')) +
          '</section>'
        : ''
    return h().page(
        context,
        s.name,
        '<p><a href="' +
            esc(base(context) + '/Subscriptions') +
            '">' +
            esc(ec.l10n.localize('Your subscriptions')) +
            '</a></p><h1>' +
            esc(s.name) +
            '</h1>' +
            h().takeNotice(context.site.siteId) +
            '<section id="Subscription"><p>' +
            esc(
                ec.resource.expand('${price} every ${term}', '', {
                    price: s.price ? s.price.display : '',
                    term: s.termText,
                }),
            ) +
            (s.termsVersion
                ? ' · ' +
                  esc(
                      ec.resource.expand('Terms version ${version}', '', {
                          version: s.termsVersion,
                      }),
                  )
                : '') +
            '</p>' +
            stateLine(s) +
            (s.method
                ? '<p>' +
                  esc(
                      s.method.brand
                          ? ec.resource.expand(
                                'Renews with ${brand} ending ${last4}',
                                '',
                                {
                                    brand: s.method.brand,
                                    last4: s.method.last4,
                                },
                            )
                          : ec.resource.expand(
                                'Renews with card ending ${last4}',
                                '',
                                { last4: s.method.last4 },
                            ),
                  ) +
                  '</p>'
                : '') +
            '</section>' +
            resolve +
            '<section id="RenewalHistory"><h2>' +
            esc(ec.l10n.localize('History')) +
            '</h2><table><thead><tr><th>' +
            esc(ec.l10n.localize('Period')) +
            '</th><th>' +
            esc(ec.l10n.localize('Order')) +
            '</th><th>' +
            esc(ec.l10n.localize('Amount')) +
            '</th><th>' +
            esc(ec.l10n.localize('Renewal state')) +
            '</th></tr></thead><tbody>' +
            history +
            '</tbody></table></section>' +
            change +
            renew +
            cancel,
    )
}

/* ---- the forms ---- */
const param = (name) => h().param(name)
const operation = () =>
    param('operationId') ? { operationId: cleanId(param('operationId')) } : {}
const detailPath = () => '/Subscriptions/' + cleanId(param('contractId'))
function purchase(context) {
    const found = h().attempt(context, 'beginSubscriptionPurchase', {
        ...operation(),
        ...(param('offerId') ? { offerId: cleanId(param('offerId')) } : {}),
        ...(param('contractId')
            ? { contractId: cleanId(param('contractId')) }
            : {}),
    })
    if (found.error)
        return h().back(
            context,
            param('contractId') ? detailPath() : '/Subscriptions',
            found,
            '',
        )
    ec.web?.response?.sendRedirect(base(context) + '/Checkout')
}
function changeMethod(context) {
    const found = h().attempt(context, 'changeSubscriptionMethod', {
        ...operation(),
        contractId: cleanId(param('contractId')),
        paymentMethodId: cleanId(param('paymentMethodId')),
        consent: param('consent') === 'true' ? 'true' : 'false',
        expectedRevision: param('expectedRevision'),
    })
    // past the day's bound of a renewal's resumptions the card is kept and the renewal waits for the job (SEC-PSS-86)
    h().back(
        context,
        detailPath(),
        found,
        found.result?.notice?.message ||
            ec.l10n.localize('Renewals now use this card.'),
    )
}
function cancel(context) {
    if (param('confirmCancel') !== 'true')
        return h().back(
            context,
            detailPath(),
            {
                error: {
                    message: ec.l10n.localize(
                        'Confirm that you want to stop renewing',
                    ),
                },
            },
            '',
        )
    const found = h().attempt(context, 'cancelSubscription', {
        ...operation(),
        contractId: cleanId(param('contractId')),
        reason: String(param('reason') || '').slice(0, 255),
        expectedRevision: param('expectedRevision'),
    })
    h().back(
        context,
        detailPath(),
        found,
        ec.l10n.localize(
            'Renewal cancelled. Your access lasts to the end of the paid term.',
        ),
    )
}
function resume(context) {
    const found = h().attempt(context, 'resumeRenewal', {
        ...operation(),
        contractId: cleanId(param('contractId')),
    })
    h().back(
        context,
        detailPath(),
        found,
        ec.l10n.localize('The renewal was tried again.'),
    )
}

const actions = { purchase, changeMethod, cancel, resume }
const pages = {
    list: listPage,
    detail: (context) => detailPage(context, ec.context.get('contractId')),
}
;({
    act(context, name) {
        if (!actions[name])
            throw new Error('Unknown subscription action ' + name)
        return actions[name](context)
    },
    render(context, name) {
        if (!pages[name]) throw new Error('Unknown subscription page ' + name)
        return pages[name](context)
    },
})
