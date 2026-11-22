/* The Support app's pages' helpers (Customer Service P15): one request parameter, the page's notice and error carried across
 * a post's redirect, a post's operation through the facade (Portal.js attempt) answered by a redirect, and a download. CC0
 * plus patent grant. */
const portal = ec.resource.script('component://mr-pass/screen/Shared/Portal.js')
/* A parameter's one value (a repeated one's first), or null. */
function param(name) {
    const value = ec.web.parameters[name]
    if (value == null || value === '') return null
    if (Array.isArray(value)) return value.length ? String(value[0]) : null
    if (typeof value === 'object' && value.length != null)
        return value.length ? String(value[0]) : null
    return String(value)
}
/* The page's notice and error from the last post, read once. */
function take() {
    const s = ec.web.sessionAttributes
    const out = {
        notice: s.passSupportNotice || null,
        error: s.passSupportError || null,
    }
    if (out.notice) s.remove('passSupportNotice')
    if (out.error) s.remove('passSupportError')
    return out
}
const query = (values) => {
    const text = Object.entries(values || {})
        .filter(([, v]) => v != null && v !== '')
        .map(([k, v]) => k + '=' + encodeURIComponent(v))
        .join('&')
    return text ? '?' + text : ''
}
/* Run a post's operation and redirect: to done(result) (a path and its parameters) with the result's receipt as the notice,
 * or back to the page with the refusal as the error. */
function post(operation, input, back, done) {
    const out = portal.attempt(operation, input)
    const s = ec.web.sessionAttributes
    if (out.error) {
        s.passSupportError = out.error.message
        ec.web.response.sendRedirect(back.path + query(back.params))
        return out
    }
    const next = done ? done(out.result) : back
    const message =
        out.result?.receipt?.message ||
        out.result?.stateText ||
        out.result?.statusText ||
        null
    if (message) s.passSupportNotice = message
    ec.web.response.sendRedirect(next.path + query(next.params))
    return out
}
/* A file an operation answers, streamed by the facade; a refusal shows the page's error. */
function download(siteId, operation, input, back) {
    try {
        ec.resource
            .script('component://mr-pass/service/pass/Facade.js')
            .downloadFile(siteId, operation, input)
    } catch (error) {
        ec.message.clearErrors()
        ec.web.sessionAttributes.passSupportError =
            ec.l10n.localize('This file is not available.')
        ec.web.response.sendRedirect(back.path + query(back.params))
    }
}
/* The base of a transition's page (its path without the transition's name). */
const base = (path, name) =>
    String(path).replace(new RegExp('/' + name + '$'), '')
/* An uploaded file, or null. */
const file = (name = 'file') => {
    const f = ec.web.multiPartParameters?.[name]
    return f && Number(f.size) > 0 ? f : null
}
/* A guest's order link for an order (impl-shop P6, F27): the SalesOrder capability Shop keeps in this session for the site
 * (Shop/ShopCheckout.js ordersKey; from the confirmation or the emailed link), which admits Support's requests for that one
 * order; null for a signed-in account or an order with none. IronStone Sales P17: also the link PASS Sales' CustomerOrder
 * keeps for a storeless order (Sales/Sales.js ordersKey). */
function orderLink(siteId, orderId) {
    if (!orderId || ec.user.userId) return null
    for (const key of ['passShopOrders:' + siteId, 'passSalesOrders:' + siteId]) {
        try {
            const map = JSON.parse(
                String(ec.web.sessionAttributes[key] || '{}'),
            )
            if (map?.[orderId]) return map[orderId]
        } catch (error) {
            // an unreadable map is no link
        }
    }
    return null
}
;({ portal, param, take, post, download, base, query, file, orderLink })
