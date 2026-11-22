/* A store feed at the Shop mount's reserved feed path (impl-commerce P14; design-commerce §9 FeedDetail, design-shop §13.2):
 * feeds/{feedKey}.{extension} (resolve#Route) answers the feed's active build from the authority (getShopFeed, local or
 * remote), which serves it only while every product in it is public at the site's current generation; anything else is
 * 404. The answer is never cached by the browser or a proxy (no-store, as every PASS route by default), so a withdrawal
 * takes the feed down at once; a consumer may revalidate by the build's digest (ETag). CC0 plus patent grant. */
const portal = () =>
    ec.resource.script('component://mr-pass/screen/Shared/Portal.js')

/* The feed of a site's Shop by its key and extension: {status, contentType, body, digest}. */
function feedOf(context, feedKey, extension) {
    const found = portal().attempt('getShopFeed', {
        siteId: context.site.siteId,
        feedKey,
        extension,
    })
    if (found.error)
        return {
            status: found.error.kind === 'NotFound' ? 404 : 503,
            contentType: 'text/plain; charset=utf-8',
            body:
                (found.error.kind === 'NotFound'
                    ? ec.l10n.localize('This feed is not available.')
                    : ec.l10n.localize('This feed cannot be read just now.')) +
                '\n',
            digest: null,
        }
    return {
        status: 200,
        contentType: found.result.contentType,
        body: String(found.result.content || ''),
        digest: found.result.digest || null,
    }
}
/* Write the feed as the response. */
function serve(context, feedKey, extension) {
    const feed = feedOf(context, feedKey, extension)
    const response = ec.web?.response
    if (!response) return feed
    response.setStatus(feed.status)
    response.setContentType(feed.contentType)
    response.setHeader('X-Content-Type-Options', 'nosniff')
    response.setHeader('Cache-Control', 'no-store')
    if (feed.digest)
        response.setHeader('ETag', '"' + String(feed.digest).slice(0, 64) + '"')
    response.write(feed.body)
    return feed
}
;({ feedOf, serve })
