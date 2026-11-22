/* Shop's review page (Commerce P9; design-shop §5 PublicReviews and SubmitReview): /Review?productId= shows a product's
 * approved reviews a page at a time (getProductReviews: their summary, the author's chosen label, the store's reply, the
 * photos by digest) and, for a signed-in verified buyer whose order of it has arrived, SubmitReview: the rating, the text,
 * how the name is shown and up to three photos (submitProductReview, one photo a call: the first call writes the review, each
 * next one adds a photo to it at its new revision), or the edit of their own review, which waits for approval again. The
 * authority finds the purchase proof; nothing here names an order. Every page is no-store and renders through the active
 * release's checkout page kind or the PASS shell (ShopAccount.js helpers). CC0 plus patent grant. */
const account = () =>
    ec.resource.script('component://mr-pass/screen/Shop/ShopAccount.js').helpers
const MAX_PHOTOS = 3
const base = (context) => context.mount.base || ''
const cleanId = (value) =>
    String(value || '')
        .replace(/[^A-Za-z0-9_-]/g, '')
        .slice(0, 40)
const stars = (rating) => {
    const n = Math.max(0, Math.min(5, Math.round(Number(rating) || 0)))
    return '★'.repeat(n) + '☆'.repeat(5 - n)
}
const paragraphs = (text) =>
    String(text || '')
        .split(/\n{2,}/)
        .map(
            (part) =>
                '<p>' + account().esc(part).replace(/\n/g, '<br>') + '</p>',
        )
        .join('')
const reviewPath = (productId, cursor) =>
    '/Review?productId=' +
    encodeURIComponent(productId) +
    (cursor ? '&cursor=' + encodeURIComponent(cursor) : '')

/* One approved review: its rating, label, date, text, photos and the store's reply. */
function reviewHtml(review, storeName) {
    const esc = account().esc
    return (
        '<li class="shop-review" id="Review_' +
        esc(review.id) +
        '"><p><span class="shop-review-rating" aria-label="' +
        esc(
            ec.resource.expand('${rating} of 5 stars', '', {
                rating: review.rating,
            }),
        ) +
        '">' +
        stars(review.rating) +
        '</span> <strong>' +
        esc(review.authorLabel) +
        '</strong> <small>' +
        esc(review.dateText) +
        (review.verifiedPurchase
            ? ' · ' + esc(ec.l10n.localize('Verified purchase'))
            : '') +
        '</small></p>' +
        paragraphs(review.body) +
        (review.images.length
            ? '<p class="shop-review-photos">' +
              review.images
                  .map(
                      (image) =>
                          '<img src="' +
                          esc(image.url) +
                          '" alt="' +
                          esc(image.alt) +
                          '" loading="lazy" width="160">',
                  )
                  .join(' ') +
              '</p>'
            : '') +
        (review.reply
            ? '<blockquote class="shop-review-reply"><p><strong>' +
              esc(
                  storeName
                      ? ec.resource.expand('Reply from ${name}', '', {
                            name: storeName,
                        })
                      : ec.l10n.localize('Reply from the store'),
              ) +
              '</strong> <small>' +
              esc(review.reply.dateText) +
              '</small></p>' +
              paragraphs(review.reply.text) +
              '</blockquote>'
            : '') +
        '</li>'
    )
}
/* The rating summary of the approved reviews. */
function summaryHtml(summary) {
    const esc = account().esc
    if (!summary.count)
        return (
            '<p id="ReviewSummary">' +
            esc(ec.l10n.localize('No reviews yet.')) +
            '</p>'
        )
    return (
        '<div id="ReviewSummary"><p><strong>' +
        esc(
            ec.resource.expand('${average} of 5', '', {
                average: summary.average,
            }),
        ) +
        '</strong> ' +
        stars(summary.average) +
        ' · ' +
        esc(
            ec.resource.expand(
                summary.count === 1
                    ? '${count} review'
                    : '${count} reviews',
                '',
                { count: summary.count },
            ),
        ) +
        '</p><ul class="shop-review-distribution">' +
        summary.distribution
            .map(
                (row) =>
                    '<li>' +
                    esc(
                        ec.resource.expand('${stars} stars: ${count}', '', {
                            stars: row.stars,
                            count: row.count,
                        }),
                    ) +
                    '</li>',
            )
            .join('') +
        '</ul></div>'
    )
}
/* SubmitReview: a new review, or the author's own to change. */
function formHtml(context, view) {
    const { esc, hidden, formToken } = account()
    const own = view.own
    const rating = own?.rating || 5
    const photos = own?.images || []
    const room = Math.max(0, MAX_PHOTOS - photos.length)
    return (
        '<form method="post" enctype="multipart/form-data" id="SubmitReview" action="' +
        esc(base(context) + '/Review/submit') +
        '">' +
        formToken() +
        hidden('productId', view.productId) +
        (own
            ? hidden('productReviewId', own.id) +
              hidden('expectedRevision', own.revision)
            : '') +
        '<h2>' +
        esc(
            ec.l10n.localize(own ? 'Change your review' : 'Write a review'),
        ) +
        '</h2>' +
        (own
            ? '<p class="shop-review-own">' +
              esc(
                  ec.resource.expand(
                      'Your review: ${status}. A change waits for approval again.',
                      '',
                      { status: own.statusText },
                  ),
              ) +
              '</p>'
            : '') +
        '<label>' +
        esc(ec.l10n.localize('Rating')) +
        ' <select name="rating">' +
        [5, 4, 3, 2, 1]
            .map(
                (n) =>
                    '<option value="' +
                    n +
                    '"' +
                    (n === Number(rating) ? ' selected' : '') +
                    '>' +
                    esc(
                        ec.resource.expand(
                            n === 1 ? '${n} star' : '${n} stars',
                            '',
                            { n },
                        ),
                    ) +
                    '</option>',
            )
            .join('') +
        '</select></label>' +
        '<label>' +
        esc(ec.l10n.localize('Your product review')) +
        ' <textarea name="body" rows="6" maxlength="5000" required>' +
        esc(own?.body || '') +
        '</textarea></label>' +
        '<fieldset><legend>' +
        esc(ec.l10n.localize('Show my name as')) +
        '</legend><label><input type="radio" name="displayChoice" value="name"' +
        (own?.displayChoice !== 'anonymous' ? ' checked' : '') +
        '> ' +
        esc(ec.l10n.localize('My first name and initial')) +
        '</label> <label><input type="radio" name="displayChoice" value="anonymous"' +
        (own?.displayChoice === 'anonymous' ? ' checked' : '') +
        '> ' +
        esc(ec.l10n.localize('A customer')) +
        '</label></fieldset>' +
        (photos.length
            ? '<fieldset><legend>' +
              esc(ec.l10n.localize('Your photos')) +
              '</legend>' +
              photos
                  .map(
                      (photo) =>
                          '<label><input type="checkbox" name="removeImageSeqIds" value="' +
                          esc(photo.imageSeqId) +
                          '"> ' +
                          esc(
                              ec.resource.expand('Remove ${name}', '', {
                                  name: photo.filename,
                              }),
                          ) +
                          '</label>',
                  )
                  .join(' ') +
              '</fieldset>'
            : '') +
        Array.from(
            { length: room },
            (unused, index) =>
                '<label>' +
                esc(
                    ec.resource.expand('Photo ${n}', '', {
                        n: photos.length + index + 1,
                    }),
                ) +
                ' <input type="file" name="photo' +
                (index + 1) +
                '" accept="image/png,image/jpeg"></label>',
        ).join('') +
        '<p><small>' +
        esc(
            ec.l10n.localize(
                'Photos are PNG or JPEG, up to 10 MB each, and are shown once the review is approved.',
            ),
        ) +
        '</small></p>' +
        '<button type="submit">' +
        esc(
            ec.l10n.localize(own ? 'Save my review' : 'Send my review'),
        ) +
        '</button></form>'
    )
}
/* The review page: the product's approved reviews and, for its buyer, the form. */
function reviewPage(context) {
    const { esc, attempt, page, takeNotice, signIn, param } = account()
    const productId = cleanId(param('productId'))
    const found = attempt(context, 'getProductReviews', {
        productId,
        cursor: param('cursor'),
        limit: '10',
    })
    if (found.error)
        return page(
            context,
            ec.l10n.localize('Product reviews'),
            '<h1>' +
                esc(ec.l10n.localize('Product reviews')) +
                '</h1><p role="alert">' +
                esc(found.error.message) +
                '</p><p><a href="' +
                esc(base(context) + '/') +
                '">' +
                esc(ec.l10n.localize('Return to the store')) +
                '</a></p>',
        )
    const view = found.result
    const signedIn = !!ec.user.userId
    const write =
        view.own || view.canReview
            ? formHtml(context, view)
            : view.reviewRemoved
              ? '<p id="ReviewRemoved">' +
                esc(
                    ec.l10n.localize(
                        'The store removed your review of this product, so another cannot be written.',
                    ),
                ) +
                '</p>'
              : signedIn
              ? '<p id="ReviewNotAllowed">' +
                esc(
                    ec.l10n.localize(
                        'You can review this product once your order of it has arrived and your email address is verified.',
                    ),
                ) +
                '</p>'
              : '<div id="ReviewSignIn">' +
                signIn(
                    context,
                    reviewPath(productId),
                    '<a href="${href}">Sign in</a> to review a product you bought.',
                ) +
                '</div>'
    const heading = ec.resource.expand('Reviews of ${name}', '', {
        name: view.product.name,
    })
    return page(
        context,
        heading,
        '<h1>' +
            esc(heading) +
            '</h1><p><a href="' +
            esc(view.product.url) +
            '">' +
            esc(ec.l10n.localize('Back to the product')) +
            '</a></p>' +
            takeNotice(context.site.siteId) +
            '<section id="PublicReviews" aria-label="' +
            esc(ec.l10n.localize('Product reviews')) +
            '">' +
            summaryHtml(view.summary) +
            (view.reviews.length
                ? '<ul class="shop-reviews">' +
                  view.reviews
                      .map((review) => reviewHtml(review, view.storeName))
                      .join('') +
                  '</ul>'
                : '') +
            (view.nextCursor
                ? '<p><a rel="next" href="' +
                  esc(base(context) + reviewPath(productId, view.nextCursor)) +
                  '">' +
                  esc(ec.l10n.localize('More reviews')) +
                  '</a></p>'
                : '') +
            '</section><section id="ReviewWrite">' +
            write +
            '</section>',
    )
}
/* SubmitReview's post: the review with the first photo, then each other photo at the review's new revision; the notice
 * names a photo refused, and the page is shown again. */
function submit(context) {
    const { attempt, param, back } = account()
    const productId = cleanId(param('productId'))
    const files = Array.from({ length: MAX_PHOTOS }, (unused, index) => {
        const file = ec.web?.multiPartParameters?.['photo' + (index + 1)]
        return file && Number(file.size) > 0 ? file : null
    }).filter(Boolean)
    const removals = (() => {
        const value = ec.web?.parameters?.removeImageSeqIds
        if (value == null || value === '') return []
        return (
            typeof value === 'object' && value.length != null
                ? Array.from(value)
                : [value]
        ).map((v) => cleanId(v))
    })()
    const input = {
        productId,
        productReviewId: cleanId(param('productReviewId')) || null,
        expectedRevision: param('expectedRevision'),
        rating: param('rating'),
        body: param('body'),
        displayChoice: param('displayChoice') || 'name',
        removeImageSeqIds: removals.join(','),
        file: files[0] || null,
    }
    let found = attempt(context, 'submitProductReview', input)
    const refused = []
    if (!found.error && found.result.imageRefused)
        refused.push(found.result.imageRefused)
    for (const file of files.slice(1)) {
        if (found.error) break
        const next = attempt(context, 'submitProductReview', {
            productId,
            productReviewId: found.result.review.id,
            expectedRevision: found.result.review.revision,
            rating: input.rating,
            body: input.body,
            displayChoice: input.displayChoice,
            file,
        })
        if (next.error) {
            refused.push(next.error.message)
            break
        }
        found = next
        if (found.result.imageRefused) refused.push(found.result.imageRefused)
    }
    back(
        context,
        reviewPath(productId),
        found,
        refused.length
            ? ec.resource.expand(
                  'Thank you. Your review waits for approval; a photo was not added: ${reason}',
                  '',
                  { reason: refused.join('; ') },
              )
            : ec.l10n.localize(
                  'Thank you. Your review waits for approval before it is shown.',
              ),
    )
}
;({
    render: (context) => reviewPage(context),
    submit,
})
