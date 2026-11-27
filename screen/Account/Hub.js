/* The PASS Account hub and email preferences pages (impl-shop P6, F6; design-shop §9 Shared account screens, design-forum §8,
 * X6, X15), the PASS Account foundation's: Home shows one card per app the site mounts that registers one (getAccountHub:
 * Shop's AccountOverview summary, Billing's invoices, Support's cases and returns); EmailPreferences combines a list link's
 * unsubscribe (its token from ConsentServices' link, /EmailPreferences?token=, with RFC 8058's one-click POST), the
 * signed-in account's lists and each store's topics, cart reminders and review requests (getEmailPreferences,
 * storeEmailPreferences), and the Forum opt-out's page. A receipt's confirmation link (?confirmToken=, Commerce P9 follow-up)
 * shows the checkout's optional emails waiting for it, read only, and its one button confirms them. Plain forms; no-store.
 * CC0 plus patent grant. */
const portal = () =>
    ec.resource.script('component://mr-pass/screen/Shared/Portal.js')
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
const param = (name) => {
    const value = ec.web?.parameters?.[name]
    if (value == null) return null
    if (typeof value === 'object' && value.length != null)
        return value.length ? String(value[0]) : null
    return String(value)
}
const tokenParam = () =>
    String(param('token') || '')
        .replace(/[^A-Za-z0-9_-]/g, '')
        .slice(0, 128)
/* A receipt's confirmation code: confirmToken, a name the request log leaves out (SEC-PSF-03); confirm is its name in a
   receipt sent before. */
const confirmParam = () =>
    String(param('confirmToken') || param('confirm') || '')
        .replace(/[^A-Za-z0-9_.-]/g, '')
        .slice(0, 180)
const hidden = (name, value) =>
    '<input type="hidden" name="' +
    esc(name) +
    '" value="' +
    esc(value ?? '') +
    '">'
const formToken = () =>
    ec.web ? hidden('moquiSessionToken', ec.web.sessionToken) : ''
const loginLink = (path) =>
    '<p><a href="' +
    esc(
        (ec.context.get('passBases')?.account ?? '/account') +
            '/Login?returnTo=' +
            encodeURIComponent(path),
    ) +
    '">Sign in</a></p>'
function flash() {
    const attributes = ec.web?.sessionAttributes
    const text = attributes?.passAccountNotice
    if (!text) return ''
    attributes.remove('passAccountNotice')
    return '<p role="status" class="card">' + esc(text) + '</p>'
}

/* Home: the account's cards. */
function home(siteId, publicPath) {
    const found = portal().attempt('getAccountHub', { siteId })
    if (found.error)
        return (
            '<h1>My account</h1><p role="alert">' +
            esc(found.error.message) +
            '</p>' +
            (found.error.kind === 'AuthenticationRequired'
                ? loginLink(publicPath)
                : '')
        )
    const hub = found.result
    const cards = hub.cards
        .map(
            (card) =>
                '<section class="card" id="AccountCard_' +
                esc(card.app) +
                '" aria-labelledby="AccountCardTitle_' +
                esc(card.app) +
                '"><h2 id="AccountCardTitle_' +
                esc(card.app) +
                '">' +
                (card.url
                    ? '<a href="' +
                      esc(card.url) +
                      '">' +
                      esc(card.title) +
                      '</a>'
                    : esc(card.title)) +
                '</h2>' +
                (card.lines || [])
                    .map((line) => '<p>' + esc(line) + '</p>')
                    .join('') +
                (card.links || [])
                    .map(
                        (link) =>
                            '<a href="' +
                            esc(link.url) +
                            '">' +
                            esc(link.text) +
                            '</a>',
                    )
                    .join(' · ') +
                '</section>',
        )
        .join('')
    return (
        '<h1>My account</h1><p>' +
        esc(hub.account.name) +
        (hub.account.emailAddress
            ? ' · ' + esc(hub.account.emailAddress)
            : '') +
        '</p>' +
        (cards || '<p>Nothing here yet.</p>') +
        '<nav class="card" aria-label="Account settings"><a href="' +
        esc(hub.links.settings) +
        '">Profile and security</a> · <a href="' +
        esc(hub.links.emailPreferences) +
        '">Email preferences</a></nav>'
    )
}

/* EmailPreferences: the lists and topics, each a checkbox, saved together. */
function preferences(siteId, publicPath) {
    const token = tokenParam()
    const confirm = confirmParam()
    const found = portal().attempt('getEmailPreferences', {
        siteId,
        ...(confirm ? { confirm } : token ? { token } : {}),
    })
    if (found.error)
        return (
            '<h1>Email preferences</h1><p role="alert">' +
            esc(found.error.message) +
            '</p>' +
            (found.error.kind === 'AuthenticationRequired'
                ? loginLink(publicPath)
                : '')
        )
    const v = found.result
    if (v.mode === 'confirm') return confirmation(v, confirm, publicPath)
    const waiting = ' (waiting for you to confirm it from your order receipt)'
    // a choice waiting for its confirmation shows unchecked, so declining it is a box of its own (Commerce F124)
    const decline = (name, pending) =>
        pending
            ? '<label class="decline"><input type="checkbox" name="decline_' +
              esc(name) +
              '" value="true"> Decline this; never send it</label>'
            : ''
    const box = (name, checked, label, description) =>
        '<label><input type="checkbox" name="' +
        esc(name) +
        '" value="true"' +
        (checked ? ' checked' : '') +
        '> ' +
        esc(label) +
        '</label>' +
        (description ? '<p><small>' + esc(description) + '</small></p>' : '') +
        hidden(name + '__shown', 'true')
    // a list link subscribes again only a list it unsubscribed itself, within a day; any other needs the sign-in (SEC-PSS-44)
    const signInNote = (label) =>
        '<p>' + esc(label) + '<br><small>Sign in to subscribe.</small></p>'
    const lists = v.lists
        .map((list) =>
            v.mode === 'token' && list.canSubscribe === false
                ? signInNote(list.name)
                : box(
                      'list_' + list.contactListId,
                      list.subscribed,
                      list.name + (list.confirmPending ? waiting : ''),
                      list.description,
                  ) + decline('list_' + list.contactListId, list.confirmPending),
        )
        .join('')
    // IronStone Marketing P7: the sending organization's offered lists, with the recipient's state, the opt-out reasons and leaving
    // all of its email
    const marketing = v.marketing
    const stateNote = (state) =>
        state === 'pending'
            ? ' (waiting for you to confirm it from the message we sent)'
            : ''
    const marketingSet = marketing
        ? '<fieldset id="MarketingTopics"><legend>Email from ' +
          esc(marketing.organizationName) +
          '</legend>' +
          marketing.topics
              .map((topic) =>
                  // IronStone Marketing P22: a text message topic the person is not on is named, never turned on here (it is
                  // joined with a phone number where it is offered); one they are on may be left, as an email topic is
                  topic.channelEnumId === 'MdcSms' &&
                  topic.state !== 'subscribed' &&
                  topic.state !== 'pending'
                      ? '<p>' +
                        esc(topic.name + ' (' + topic.channelText + ')') +
                        '<br><small>' +
                        esc(
                            'Join it with your phone number where it is offered. Reply STOP to any text to leave.',
                        ) +
                        '</small></p>'
                      : v.mode === 'token' && topic.canSubscribe === false
                      ? signInNote(topic.name + ' (' + topic.channelText + ')')
                      : box(
                          'mkt_' + topic.contactListId,
                          topic.state === 'subscribed' ||
                              topic.state === 'pending',
                          topic.name +
                              ' (' +
                              topic.channelText +
                              ')' +
                              stateNote(topic.state),
                          topic.description,
                      ),
              )
              .join('') +
          '<p><small>Turning one on sends a message to confirm it first.</small></p>' +
          '<fieldset><legend>Why are you leaving? (optional)</legend>' +
          (marketing.reasons || [])
              .map(
                  (reason) =>
                      '<label><input type="radio" name="mktReason" value="' +
                      esc(reason.reasonId) +
                      '"> ' +
                      esc(reason.label) +
                      '</label>',
              )
              .join('') +
          '<label>Tell us more <input name="mktReasonText" maxlength="200"></label></fieldset>' +
          '<label><input type="checkbox" name="mktLeave" value="true"> No more email from ' +
          esc(marketing.organizationName) +
          '</label></fieldset>'
        : ''
    const topics = (v.topics || [])
        .map((topic) =>
            box(
                'topic_' + topic.topicId,
                topic.on,
                topic.name + (topic.confirmPending ? waiting : ''),
                topic.description,
            ) + decline('topic_' + topic.topicId, topic.confirmPending),
        )
        .join('')
    return (
        '<h1>Email preferences</h1>' +
        flash() +
        (v.mode === 'token'
            ? '<p>Email from ' +
              esc(v.organizationName) +
              ' to ' +
              esc(v.maskedAddress) +
              '</p>'
            : '<p>' + esc(v.emailAddress) + '</p>') +
        '<form method="post" class="card" id="EmailPreferencesForm" action="' +
        esc(publicPath + '/save') +
        '">' +
        formToken() +
        (token ? hidden('token', token) : '') +
        (lists
            ? '<fieldset><legend>Lists</legend>' + lists + '</fieldset>'
            : '') +
        marketingSet +
        (topics
            ? '<fieldset><legend>Store emails</legend>' + topics + '</fieldset>'
            : '') +
        (v.mode === 'token'
            ? '<label><input type="checkbox" name="unsubscribeAll" value="true"> No marketing email at all</label>'
            : '') +
        (lists || topics || marketingSet || v.mode === 'token'
            ? '<p><button type="submit">Save preferences</button></p>'
            : '<p>You are on no lists.</p>') +
        '</form>' +
        (v.signInToSubscribe
            ? '<p id="SignInToSubscribe">This link unsubscribes, and can undo that for a day. To subscribe to anything else, sign in.</p>' +
              loginLink(publicPath)
            : '') +
        (v.forumUrl
            ? '<p><a href="' + esc(v.forumUrl) + '">Forum email</a></p>'
            : '')
    )
}
/* A receipt's confirmation: the optional emails chosen at checkout, and one button that confirms them. */
function confirmation(v, confirm, publicPath) {
    const choices = (v.choices || [])
        .map(
            (choice) =>
                '<li>' +
                esc(choice.label) +
                ' <small>' +
                esc(choice.statement) +
                '</small></li>',
        )
        .join('')
    return (
        '<h1>Email preferences</h1>' +
        flash() +
        '<p>Optional emails from ' +
        esc(v.storeName) +
        ' to ' +
        esc(v.maskedAddress) +
        ', chosen at checkout:</p><ul id="ConfirmChoices">' +
        choices +
        '</ul>' +
        (v.confirmed
            ? '<p role="status">These are confirmed. You can change them on your email preferences page, or from any of these emails.</p>'
            : '<form method="post" class="card" id="ConfirmOptInsForm" action="' +
              esc(publicPath + '/save') +
              '">' +
              formToken() +
              hidden('confirmToken', confirm) +
              hidden('confirmNow', 'true') +
              '<p><button type="submit">Confirm these emails</button></p><p><small>Nothing is sent until you confirm. Your receipt and order updates come either way.</small></p></form>')
    )
}
/* EmailPreferences/save: the checked lists and topics (an unchecked one shown on the page is off); or a receipt link's
 * confirmation. */
function save(siteId, publicPath) {
    const back = publicPath.replace(/\/save$/, '')
    const confirm = confirmParam()
    if (confirm) {
        const confirmed = portal().attempt('storeEmailPreferences', {
            siteId,
            confirm,
            choices: JSON.stringify({
                confirm: param('confirmNow') === 'true',
            }),
        })
        ec.web.sessionAttributes.passAccountNotice = confirmed.error
            ? confirmed.error.message
            : 'Your choices are confirmed.'
        return ec.web.response.sendRedirect(
            back + '?confirmToken=' + encodeURIComponent(confirm),
        )
    }
    const parameters = ec.web.parameters
    const lists = {}
    const topics = {}
    const marketingTopics = {}
    const decline = { lists: [], topics: [] }
    for (const name of Object.keys(parameters)) {
        const declined = /^decline_(list|topic)_(.{1,80})$/.exec(name)
        if (declined && param(name) === 'true')
            decline[declined[1] === 'list' ? 'lists' : 'topics'].push(
                declined[2],
            )
        // IronStone Marketing P7: the organization's offered lists
        const offered = /^mkt_(.{1,80})__shown$/.exec(name)
        if (offered) marketingTopics[offered[1]] = param('mkt_' + offered[1]) === 'true'
        const shown = /^(list|topic)_(.{1,80})__shown$/.exec(name)
        if (!shown) continue
        const on = param(shown[1] + '_' + shown[2]) === 'true'
        if (shown[1] === 'list') lists[shown[2]] = on
        else topics[shown[2]] = on
    }
    const token = tokenParam()
    const found = portal().attempt('storeEmailPreferences', {
        siteId,
        ...(token ? { token } : {}),
        choices: JSON.stringify({
            lists,
            topics,
            decline,
            unsubscribeAll: param('unsubscribeAll') === 'true',
            ...(Object.keys(marketingTopics).length
                ? {
                      marketing: {
                          topics: marketingTopics,
                          reason: param('mktReason'),
                          reasonText: param('mktReasonText'),
                          leaveOrganization: param('mktLeave') === 'true',
                      },
                  }
                : {}),
        }),
    })
    ec.web.sessionAttributes.passAccountNotice = found.error
        ? found.error.message
        : 'Your preferences are saved.'
    ec.web.response.sendRedirect(
        back + (token ? '?token=' + encodeURIComponent(token) : ''),
    )
}
/* EmailPreferences/oneClick: RFC 8058's POST to a list link: the token's list unsubscribed, answered as JSON. */
function oneClick(siteId) {
    const found = portal().attempt('applyOneClickUnsubscribe', {
        siteId,
        token: tokenParam(),
    })
    ec.web.response.setStatus(found.error ? 404 : 200)
    ec.web.response.setContentType('application/json;charset=UTF-8')
    ec.web.response.write(
        JSON.stringify(found.error ? { ok: false } : { ok: true }),
    )
}
;({ home, preferences, save, oneClick })
