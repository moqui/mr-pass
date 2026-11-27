// The Support app's Feedback page (impl-customer-service P13; design-customer-service §8 Feedback): the invitation's link shows
// the feedback form, the organization's name and the customer's label, never the case, and a GET submits nothing; a forged,
// expired or withdrawn link shows only guidance; an answer through the facade is checked by the authority (the rule that
// requires a comment for a low rating), kept once, a repeat answering the first, and the page then shows its receipt.
// Mantle's CaseFeedback spec covers the rules; the acceptance walks (SupportFeedbackHttp, RemoteHttp) post through the page.
// P15: a contact invited for the customer reads its own case in MyCases and CustomerCase; a colleague's case, another
// customer's and an uninvited account get nothing, and a case's CaseView link reads it signed out (Mantle's SupportPortal spec
// covers the rules; the acceptance walk SupportPagesHttp goes through the pages).
const fixtures = () =>
    ec.resource.script('component://mr-pass/test/Support/SupportFixtures.js')
const siteId = 'PASS_SUPPORT_PAGES'
let docs, people
const render = (path, parameters) => {
    const rendered = ec.screen
        .makeTest()
        .rootScreen('component://mr-pass/screen/Pass.xml')
        .render(
            path,
            {
                resolvedSiteId: siteId,
                publicHost: 'support.example.test',
                publicPath: '/' + path.toLowerCase(),
                ...parameters,
            },
            null,
        )
    return { html: rendered.output, errors: rendered.errorMessages }
}
function submit(values) {
    try {
        return ec.service
            .sync()
            .throwOnError(true)
            .name('pass.Facade.call#Operation')
            .parameters({
                operation: 'submitCaseFeedback',
                input: {
                    siteId,
                    token: docs.tokens.open,
                    values: JSON.stringify(values),
                    operationId: ec.user.randomString(20),
                },
            })
            .call().result
    } catch (error) {
        ec.message.clearErrors()
        return {
            kind: error.moquiErrorKind || 'Error',
            message: String(error.message),
        }
    }
}
const invitation = () =>
    ec.entity
        .find('mantle.party.FormInvitation')
        .condition('invitationId', docs.invitationId)
        .disableAuthz()
        .one()
spec({
    setupSpec() {
        login('john.doe')
        ec.artifactExecution.disableAuthz()
        const c = (name, parameters) =>
            ec.service
                .sync()
                .name(name)
                .parameters(parameters)
                .disableAuthz()
                .call()
        const { org, customer } = fixtures().parties('PASS_SUPPORT_PAGES')
        c('create#mantle.public.PublicSite', {
            siteId,
            name: 'Support pages',
            state: 'published',
            registrationMode: 'invitation',
            locale: 'en',
            timeZone: 'UTC',
            policyRevision: 1,
            generation: 1,
        })
        c('create#mantle.public.PublicSiteParty', {
            siteId,
            partyId: ec.user.userAccount.partyId,
            state: 'active',
            role: 'owner',
            revision: 1,
        })
        c('mantle.public.SiteServices.store#Mounts', {
            input: {
                siteId,
                expectedRevision: 1,
                mounts: [
                    { app: 'account', pathPrefix: '/account' },
                    { app: 'support', pathPrefix: '/support', targetId: org },
                ],
                hosts: [{ hostname: 'support.example.test', canonical: true }],
            },
        })
        docs = fixtures().feedback({
            prefix: 'PASS_SUPPORT_PAGES',
            org,
            customer,
        })
        people = fixtures().contacts({
            prefix: 'PASS_SUPPORT_PAGES',
            org,
            customer,
        })
        ec.artifactExecution.enableAuthz()
    },
})
feature(
    "the link shows the form and the customer's label, never the case, and a GET submits nothing; a bad link shows guidance",
    {
        when() {
            const page = render('Support/Feedback', { token: docs.tokens.open })
            const answeredAfterGet = invitation().formResponseId || null
            const bad = [
                'x'.repeat(48),
                docs.tokens.expired,
                docs.tokens.withdrawn,
            ].map((token) => render('Support/Feedback', { token }).html)
            return { page, answeredAfterGet, bad }
        },
        then({ page, answeredAfterGet, bad }) {
            page.errors.length === 0
            page.html.includes('How did we do?')
            page.html.includes(
                'Support Pages Service Co asks Support Pages Customer',
            )
            page.html.includes(
                'How satisfied are you with how we handled your request?',
            )
            page.html.includes('name="rating" value="5"')
            page.html.includes('data-visible-when=')
            page.html.includes('data-require-when=')
            page.html.includes('<script src="/js/moqui-form-when.js">')
            page.html.includes('action="/support/feedback/submit"')
            !page.html.includes(docs.requestId)
            !page.html.includes('Thermostat reads two degrees high')
            answeredAfterGet === null
            bad.every((html) =>
                html.includes('This feedback link is not available'),
            )
            bad.every((html) => !html.includes('Support Pages Customer'))
        },
    },
)
feature(
    'an answer is checked by the authority, kept once, and the page shows its receipt',
    {
        when() {
            const noComment = submit({ rating: '2' })
            const answered = submit({
                rating: '2',
                comment: 'It took a week to hear back',
            })
            const repeat = submit({ rating: '5' })
            const kept = invitation()
            const page = render('Support/Feedback', { token: docs.tokens.open })
            return { noComment, answered, repeat, kept, page }
        },
        then({ noComment, answered, repeat, kept, page }) {
            noComment.kind === 'Unprocessable'
            noComment.message.includes(
                'What could we have done better? is required',
            )
            answered.alreadyApplied === false
            answered.receipt.scoreText === '2 of 5'
            repeat.alreadyApplied === true
            kept.score === 2
            page.html.includes('Thank you')
            page.html.includes('2 of 5')
            !page.html.includes('name="rating"')
        },
    },
)
feature(
    "a contact reads its own cases; a colleague's, another customer's and an uninvited account's are not available",
    {
        when() {
            const operation = (operation, input) => {
                try {
                    return ec.service
                        .sync()
                        .throwOnError(true)
                        .name('pass.Facade.call#Operation')
                        .parameters({ operation, input: { siteId, ...input } })
                        .call().result
                } catch (error) {
                    ec.message.clearErrors()
                    return { kind: error.moquiErrorKind || 'Error' }
                }
            }
            login(people.contact, 'moqui')
            // a request's shopThemed and canonicalUrl set nothing the shell reads (SEC-PSF-85)
            const list = render('Support/MyCases', {
                shopThemed: '1',
                canonicalUrl: 'https://elsewhere.example.test/x',
            })
            const detail = render('Support/CustomerCase', {
                requestId: people.own,
            })
            const colleague = operation('getCustomerCase', {
                requestId: people.colleague,
            })
            const foreign = operation('getCustomerCase', {
                requestId: people.foreign,
            })
            login(people.outsider, 'moqui')
            const outsider = operation('findCustomerCases', {})
            const outsiderCase = operation('getCustomerCase', {
                requestId: people.own,
            })
            logout()
            const byLink = operation('getCustomerCase', { token: people.link })
            login('john.doe')
            return {
                list,
                detail,
                colleague,
                foreign,
                outsider,
                outsiderCase,
                byLink,
            }
        },
        then({
            list,
            detail,
            colleague,
            foreign,
            outsider,
            outsiderCase,
            byLink,
        }) {
            list.errors.length === 0
            list.html.includes('<!doctype html>')
            !list.html.includes('elsewhere.example.test')
            list.html.includes('Case OWN')
            !list.html.includes('Case COLLEAGUE')
            !list.html.includes('Case FOREIGN')
            detail.errors.length === 0
            detail.html.includes('About OWN')
            detail.html.includes('id="CaseReply"')
            colleague.kind === 'NotFound'
            foreign.kind === 'NotFound'
            outsider.caseList.length === 0
            outsiderCase.kind === 'NotFound'
            byLink.case.requestId === people.own
        },
    },
)
// a case's file is staged under the media root only for a caller the operation serves and only for a new operation: a repeat
// of an operation answers its first case and stages nothing, and a caller with no credential stages nothing (SEC-PSS-21, 22)
feature(
    'a repeated case operation answers its first case and leaves no staged file; a caller with no credential stages none',
    {
        when() {
            const folder =
                String(ec.factory.getConfValue('pass@media-root')).replace(/\/$/, '') + '/support'
            const stagedCount = () => {
                try {
                    return Array.from(
                        ec.resource.getLocationReference(folder).getDirectoryEntries() || [],
                    ).length
                } catch (error) {
                    return 0
                }
            }
            const create = (user, input) =>
                parallel(
                    1,
                    (thread, args) => {
                        if (args.user) login(args.user, 'moqui')
                        else logout()
                        const text = '%PDF-1.4 a case file'
                        try {
                            return ec.resource
                                .script('component://mr-mantle/service/mantle/request/SupportPortal.js')
                                .execute('createCustomerCase', {
                                    ...args.input,
                                    file: {
                                        name: 'case.pdf',
                                        size: text.length,
                                        contentType: 'application/pdf',
                                        write: (location) =>
                                            ec.resource.getLocationReference(location).putText(text),
                                    },
                                })
                        } catch (error) {
                            ec.message.clearErrors()
                            return { kind: error.moquiErrorKind || 'Error' }
                        }
                    },
                    { user, input: { siteId, ...input } },
                    { transaction: true, timeout: 30 },
                )[0]
            const before = stagedCount()
            const input = {
                requestName: 'Case with a file',
                description: 'The photo of the part',
                operationId: 'case-file-' + ec.user.randomString(12),
            }
            const first = create(people.contact, input)
            const afterFirst = stagedCount()
            const repeat = create(people.contact, input)
            const afterRepeat = stagedCount()
            const anonymous = create(null, {
                ...input,
                operationId: 'case-anon-' + ec.user.randomString(12),
            })
            const afterAnonymous = stagedCount()
            login('john.doe')
            return { before, first, afterFirst, repeat, afterRepeat, anonymous, afterAnonymous }
        },
        then({ before, first, afterFirst, repeat, afterRepeat, anonymous, afterAnonymous }) {
            !!first.requestId
            afterFirst === before
            repeat.requestId === first.requestId
            afterRepeat === before
            anonymous.kind === 'AuthenticationRequired'
            afterAnonymous === before
        },
    },
)
