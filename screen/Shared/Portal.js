/* The Billing, Supplier, Support and Shop apps' calls to the authority: one operation through the facade, answered as its
 * result or as a refusal a page can show without saying more than the kind allows. CC0 plus patent grant. */
const call = (operation, input, newTransaction) => {
    const caller = ec.service
        .sync()
        .throwOnError(true)
        .name('pass.Facade.call#Operation')
        .parameters({ operation, input })
    // Shop P4: a write a page's transition goes on past when it is refused runs in its own transaction, so the refusal
    // does not roll back the transition's
    return (newTransaction ? caller.requireNewTransaction(true) : caller).call()
        .result
}
const messages = {
    NotFound:
        ec.l10n.localize('This page is not available. The link may have expired or been replaced.'),
    AuthenticationRequired: ec.l10n.localize('Sign in to continue.'),
    Tarpit: ec.l10n.localize('Too many attempts. Wait a few minutes and try again.'),
    Unavailable: ec.l10n.localize('This is not available right now. Try again later.'),
}
/* The page's text of each reason a refusal may name (design-shop §7.3; impl-shop P1, F4): the same reasons as Mantle's
 * PassAuthority REASONS, which it passes to a remote frontend; a reason with null shows the refusal's own text. */
const reasons = {
    // the refusal's kind gives the text (a Not Found's is the Not Found text); a refusal of another kind shows its own
    notAvailable: null,
    signInRequired: messages.AuthenticationRequired,
    accessDenied: ec.l10n.localize('You do not have access to this.'),
    staleRevision:
        ec.l10n.localize('This changed since you opened it. Reload the page and try again.'),
    reviewRequired: ec.l10n.localize('Something changed. Review the details and try again.'),
    quoteExpired: ec.l10n.localize('This price has expired. Review the new price and try again.'),
    paymentDeclined:
        ec.l10n.localize('The payment was declined. Choose another way to pay or try again.'),
    rateLimited: messages.Tarpit,
    providerUnavailable: messages.Unavailable,
    // a change of a site's or a category's rights asks a recent sign-in (Mantle Forum.js reauthenticate)
    reauthRequired: ec.l10n.localize('Confirm it is you: sign in again, then do this again.'),
    // Shop P1: an operator's mount refusals
    mountTaken: null,
    rootNotAllowed: null,
    targetInvalid: null,
    // Shop P4: the cart's refusals (their own text: which item, which field)
    itemUnavailable: null,
    promoCodeInvalid: null,
    checkoutPending: null,
    valueInvalid: null,
    // Smithy (plan/design-smithy.md §4.1): its refusals, each with the refusal's own text (which name, which limit)
    addressUnconfirmed: ec.l10n.localize('Confirm your email address to do this.'),
    nameTaken: null,
    nameInvalid: null,
    quotaExceeded: null,
    limitReached: null,
    repositoryArchived: ec.l10n.localize('This repository is archived and cannot be changed.'),
    agreementUnsigned: null,
    checksRequired: null,
    squashFoldsSignature: null,
    fileChanged: ec.l10n.localize('This file changed since you opened it. Reload the page and try again.'),
    notEditable: null,
    policyRefused: null,
    // what a later phase builds
    notBuilt: ec.l10n.localize('This is not available yet.'),
    // Smithy DG2: a change of the git access by an account with no password needs a sign-in in the last 15 minutes
    recentSignInRequired: ec.l10n.localize('Sign in again to do this: you have been signed in for a while.'),
    // IronStone Sales P13: a quote above the seller's threshold is accepted signed in; one answered already shows its own text
    acceptanceSignInRequired:
        ec.l10n.localize('Sign in as a contact invited for your company to accept a quote of this amount.'),
    responseRecorded: null,
    // Smithy DG6: a repository a moderator hid is not forked
    repositoryHidden: ec.l10n.localize('This repository is hidden.'),
    // Smithy DG8: the GitHub import; each with the refusal's own text (which token, which repository)
    sourceRefused: null,
    importActive: null,
    numbersTaken: null,
    secretRequired: ec.l10n.localize('Give the secret again for the mirror’s new address, username or host key'),
    // Smithy: a deployment's lease is opened by an approver of its environment's vault; the refusal's own text says how
    vaultApproverRequired: null,
}
/* A refusal's reason, field and text from its message: "CODE: text" or "CODE[field]: text", the code Mantle's UPPER_SNAKE
 * (a local refusal) or the camelCase reason the transport puts back (a remote one). */
function refusal(message) {
    // a refusal that crossed service calls reads "Error: Error: CODE: text"
    const line = String(message || '')
        .split('\n')[0]
        .replace(/^(?:Error: )+/, '')
    const m =
        /^([A-Z][A-Z0-9_]+|[a-z][a-zA-Z0-9]+)(?:\[([A-Za-z][A-Za-z0-9_.]{0,63})\])?: ([^]*)$/.exec(
            line,
        )
    if (!m) return { reason: null, field: null, text: line }
    const reason = /^[A-Z]/.test(m[1])
        ? m[1].toLowerCase().replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase())
        : m[1]
    // a reason the authority does not pass to a remote frontend is not named locally either
    if (!Object.hasOwn(reasons, reason))
        return /^[a-z]/.test(m[1])
            ? { reason: null, field: null, text: line }
            : { reason: null, field: null, text: m[3] }
    return { reason, field: m[2] || null, text: m[3] }
}
/* Text a framework failure carries rather than a refusal a service wrote (Mantle's PassAuthority keeps the same back from a
 * remote frontend): a page shows the kind's text for it. */
const internal = (text) =>
    /:\/\/|\w#\w|\b(?:sql|database|constraint|exception|TypeError|ReferenceError|SyntaxError|RangeError|InternalError)\b|is not a function|is not defined|cannot read propert/i.test(
        text,
    ) || /\b[a-z][a-z0-9]*(?:\.[a-z][a-z0-9]*)+\.[A-Z]\w*/.test(text)
/* An operation's result, or {error: {kind, reason, message, fieldErrors}}: a NotFound or a sign-in says nothing of the
 * record; the same refusal reads the same through a remote frontend. */
function attempt(operation, input, options) {
    try {
        return { result: call(operation, input, !!options?.newTransaction) }
    } catch (error) {
        ec.message.clearErrors()
        const kind = error.moquiErrorKind || 'Unavailable'
        const { reason, field, text } = refusal(error.message)
        const own =
            ['Unprocessable', 'Conflict'].includes(kind) &&
            text &&
            !internal(text)
        return {
            error: {
                kind,
                reason,
                message:
                    (reason && reasons[reason]) ||
                    messages[kind] ||
                    (own ? text : messages.Unavailable),
                fieldErrors:
                    field && own ? [{ field, reason, message: text }] : [],
                
            },
        }
    }
}
/* A short random id for a request that must not run twice. */
const operationId = () => ec.user.randomString(32)
;({ call, attempt, refusal, reasons, operationId })
