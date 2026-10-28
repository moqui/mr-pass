const S = 'mantle.public.SiteServices.',
    F = 'mantle.forum.ForumServices.',
    D = 'mantle.forum.DeliveryServices.'
const run = (service, input) =>
    call(service, {
        input: service.endsWith('store#Category')
            ? { operationId: ec.user.randomString(32), ...input }
            : input,
    }).result
const capture = ec.factory.getTool('MailCapture'),
    baseTime = Date.now()
let siteId, categoryId, rootId, recipient, badRecipient
function sys(work) {
    const old = ec.artifactExecution.disableAuthz()
    try {
        return work()
    } finally {
        if (!old) ec.artifactExecution.enableAuthz()
    }
}
spec({
    stepwise: true,
    setupSpec() {
        login('john.doe')
        ec.user.setEffectiveTime(baseTime)
        capture.enable()
        capture.clear()
    },
    cleanupSpec() {
        capture.reset()
        login('john.doe')
    },
})
feature('prepare a registered sender and independent recipients', {
    when() {
        siteId = run(S + 'create#Site', {
            name: 'Delivery community',
            ownerPartyId: ec.user.userAccount.partyId,
        }).siteId
        run(S + 'store#Mounts', {
            siteId,
            expectedRevision: 1,
            mounts: [
                { app: 'forum', pathPrefix: '/forum' },
                { app: 'account', pathPrefix: '/account' },
            ],
            hosts: [{ hostname: 'outbox.example.test', canonical: true }],
        })
        run(S + 'update#Site', {
            siteId,
            state: 'published',
            expectedRevision: 2,
        })
        categoryId = run(F + 'store#Category', {
            siteId,
            name: 'Mail',
        }).contactListId
        run(F + 'set#CategoryAccess', {
            siteId,
            contactListId: categoryId,
            visibility: 'public',
            publicationState: 'published',
            expectedRevision: 1,
            confirm: true,
        })
        sys(() => {
            call('create#moqui.basic.email.EmailServer', {
                emailServerId: 'PASS_NOTICE_MAIL',
                smtpHost: 'smtp.example.test',
                smtpPort: 25,
            })
            call('create#moqui.basic.email.EmailTemplate', {
                emailTemplateId: 'PASS_TEST_NOTICE',
                emailServerId: 'PASS_NOTICE_MAIL',
                fromAddress: 'community@example.test',
                subject: 'Forum notice',
                bodyScreenLocation: 'component://mr-pass/test/NoticeEmail.xml',
            })
            recipient = call('mantle.party.PartyServices.create#Person', {
                firstName: 'Notice',
                lastName: 'Recipient',
            }).partyId
            badRecipient = call('mantle.party.PartyServices.create#Person', {
                firstName: 'No',
                lastName: 'Mailbox',
            }).partyId
            const ua = call(
                'mantle.party.PartyServices.create#PartyUserAccount',
                {
                    partyId: recipient,
                    username: 'pass.notice',
                    emailAddress: 'notice@example.test',
                    newPassword: 'moqui1!!',
                    newPasswordVerify: 'moqui1!!',
                },
            )
            const account = ec.entity
                .find('moqui.security.UserAccount')
                .condition('username', 'pass.notice')
                .one()
            call('create#moqui.security.public.VerifiedAddress', {
                userId: account.userId,
                emailAddress: account.emailAddress,
                verifiedAt: baseTime,
            })
            for (const partyId of [recipient, badRecipient]) {
                call('create#mantle.public.PublicSiteParty', {
                    siteId,
                    partyId,
                    state: 'active',
                    role: 'member',
                    revision: 1,
                    joinedAt: baseTime,
                })
                call('create#mantle.marketing.contact.ContactListParty', {
                    contactListId: categoryId,
                    partyId,
                    fromDate: baseTime - 60000,
                    statusId: 'CLPT_ACCEPTED',
                })
                call('create#mantle.forum.ForumPreference', {
                    siteId,
                    partyId,
                    scopeType: 'category',
                    scopeId: categoryId,
                    watchLevel: 'Watching',
                    revision: 1,
                })
            }
        })
        run(D + 'store#MailSettings', {
            siteId,
            senderAddress: 'community@example.test',
            senderName: 'Community',
            templateId: 'PASS_TEST_NOTICE',
            expectedRevision: 0,
        })
        return run(F + 'publish#Post', {
            siteId,
            contactListId: categoryId,
            title: 'A visible notice',
            body: 'An approved post',
            operationId: 'outbox-post-001',
        })
    },
    then(post) {
        post.state === 'published'
        rootId = post.rootCommEventId
    },
})
feature(
    'one failed delivery does not stop another recipient or duplicate a send',
    {
        when() {
            capture.clear()
            call('mantle.forum.DeliveryWorkerServices.dispatch#Outbox', {})
            call('mantle.forum.DeliveryWorkerServices.dispatch#Outbox', {})
            const deliveries = ec.entity
                .find('mantle.forum.ForumDelivery')
                .disableAuthz()
                .condition('siteId', siteId)
                .list()
            return {
                sent: capture.count(),
                deliveries: Array.from(deliveries).map((v) => ({
                    partyId: v.partyId,
                    channel: v.channel,
                    state: v.state,
                })),
                publicRows: ec.entity
                    .find('mantle.party.communication.CommunicationEventParty')
                    .disableAuthz()
                    .condition('communicationEventId', rootId)
                    .condition('partyId', recipient)
                    .count(),
            }
        },
        then({ sent, deliveries, publicRows }) {
            sent === 1
            deliveries.some(
                (v) =>
                    v.partyId === badRecipient &&
                    v.channel === 'email' &&
                    v.state === 'failed',
            )
            deliveries.some(
                (v) =>
                    v.partyId === recipient &&
                    v.channel === 'email' &&
                    v.state === 'sent',
            )
            deliveries.some(
                (v) =>
                    v.partyId === recipient &&
                    v.channel === 'in-app' &&
                    v.state === 'sent',
            )
            publicRows === 0
        },
    },
)
feature(
    'email opt-out is idempotent and preserves membership and in-app delivery',
    {
        when() {
            const sent = capture.last(),
                headers = sent.headers
            const header = Object.entries(headers).find(
                ([key]) => key.toLowerCase() === 'list-unsubscribe',
            )[1]
            const token = String(header).match(/token=([A-Za-z0-9_-]+)/)[1]
            run(D + 'apply#OptOut', { siteId, token })
            run(D + 'apply#OptOut', { siteId, token })
            ec.user.setEffectiveTime(baseTime + 20000)
            const published = run(F + 'publish#Post', {
                siteId,
                rootCommEventId: rootId,
                body: 'A later reply',
                operationId: 'outbox-post-002',
            })
            capture.clear()
            call('mantle.forum.DeliveryWorkerServices.dispatch#Outbox', {})
            const outbox = ec.entity
                .find('mantle.forum.ForumOutbox')
                .disableAuthz()
                .condition('communicationEventId', published.postId)
                .one()
            const inApp = ec.entity
                .find('mantle.forum.ForumDelivery')
                .disableAuthz()
                .condition({
                    outboxId: outbox.outboxId,
                    partyId: recipient,
                    channel: 'in-app',
                    state: 'sent',
                })
                .count()
            const membership = ec.entity
                .find('mantle.public.PublicSiteParty')
                .disableAuthz()
                .condition({ siteId, partyId: recipient })
                .one()
            return {
                emailCount: capture.count(),
                inApp,
                state: membership.state,
            }
        },
        then({ emailCount, inApp, state }) {
            emailCount === 0
            inApp === 1
            state === 'active'
        },
    },
)
feature(
    'interrupted sends become uncertain and require revision-bound provider reconciliation',
    {
        when() {
            let deliveryId
            sys(() => {
                const delivery = ec.entity
                    .find('mantle.forum.ForumDelivery')
                    .condition({ siteId, partyId: recipient, channel: 'email' })
                    .one()
                deliveryId = delivery.deliveryId
                delivery.set('state', 'sending')
                delivery.set('startedAt', baseTime - 600000)
                delivery.update()
            })
            call('mantle.forum.DeliveryWorkerServices.reconcile#Delivery', {
                deliveryId,
            })
            const before = ec.entity
                .find('mantle.forum.ForumDelivery')
                .disableAuthz()
                .condition('deliveryId', deliveryId)
                .one()
            const state = before.state,
                rev = Number(before.revision)
            const result = run(D + 'resolve#Delivery', {
                siteId,
                deliveryId,
                expectedRevision: rev,
                decision: 'confirmed-sent',
                reason: 'Provider test ledger confirms acceptance',
            })
            let stale = ''
            try {
                run(D + 'resolve#Delivery', {
                    siteId,
                    deliveryId,
                    expectedRevision: rev,
                    decision: 'confirmed-not-sent',
                    reason: 'Stale operator form',
                })
            } catch (error) {
                ec.message.clearErrors()
                stale = String(error.message)
            }
            return { state, result, stale }
        },
        then({ state, result, stale }) {
            state === 'uncertain'
            result.state === 'sent'
            stale.includes('reload')
        },
    },
)
feature(
    'an interrupted in-app notice retries instead of waiting for an operator',
    {
        when() {
            let deliveryId
            sys(() => {
                const delivery = ec.entity
                    .find('mantle.forum.ForumDelivery')
                    .condition({
                        siteId,
                        partyId: recipient,
                        channel: 'in-app',
                    })
                    .list()[0]
                deliveryId = delivery.deliveryId
                delivery.set('state', 'sending')
                delivery.set('startedAt', baseTime - 600000)
                delivery.update()
            })
            call('mantle.forum.DeliveryWorkerServices.reconcile#Delivery', {
                deliveryId,
            })
            return {
                state: ec.entity
                    .find('mantle.forum.ForumDelivery')
                    .disableAuthz()
                    .condition('deliveryId', deliveryId)
                    .one().state,
            }
        },
        then({ state }) {
            state === 'retry'
        },
    },
)
const member = {}
let clock = baseTime + 60000,
    secondRoot
/* Each post moves the effective clock past the posting interval. */
function post(input) {
    clock += 20000
    ec.user.setEffectiveTime(clock)
    return run(F + 'publish#Post', {
        siteId,
        operationId: ec.user.randomString(32),
        ...input,
    })
}
function deliveries(postId) {
    const outbox = sys(() =>
        ec.entity
            .find('mantle.forum.ForumOutbox')
            .condition({ communicationEventId: postId, eventType: 'post' })
            .one(),
    )
    return outbox
        ? sys(() =>
              Array.from(
                  ec.entity
                      .find('mantle.forum.ForumDelivery')
                      .condition('outboxId', outbox.outboxId)
                      .list(),
              ).map((v) => ({
                  partyId: v.partyId,
                  channel: v.channel,
                  reason: v.reason,
                  state: v.state,
              })),
          )
        : []
}
const of = (list, partyId, channel) =>
    list.find((v) => v.partyId === partyId && v.channel === channel)
const setPreferences = (user, input) => {
    login(user, 'moqui1!!')
    const current = run(D + 'get#Preferences', {
        siteId,
        scopeType: input.scopeType,
        scopeId: input.scopeId,
    })
    run(D + 'set#Preferences', {
        siteId,
        expectedRevision: current.revision,
        ...input,
    })
    login('john.doe')
}
feature('members with verified addresses and handles for preference checks', {
    when() {
        sys(() => {
            for (const name of ['first', 'mention', 'thread']) {
                const partyId = call(
                    'mantle.party.PartyServices.create#Person',
                    {
                        firstName: name,
                        lastName: 'Member',
                    },
                ).partyId
                call('mantle.party.PartyServices.create#PartyUserAccount', {
                    partyId,
                    username: 'pass.notice.' + name,
                    emailAddress: name + '.notice@example.test',
                    newPassword: 'moqui1!!',
                    newPasswordVerify: 'moqui1!!',
                })
                const account = ec.entity
                    .find('moqui.security.UserAccount')
                    .condition('username', 'pass.notice.' + name)
                    .one()
                call('create#moqui.security.public.VerifiedAddress', {
                    userId: account.userId,
                    emailAddress: account.emailAddress,
                    verifiedAt: baseTime,
                })
                call('create#mantle.public.PublicSiteParty', {
                    siteId,
                    partyId,
                    state: 'active',
                    role: 'member',
                    revision: 1,
                    joinedAt: baseTime,
                })
                call('create#mantle.public.PublicSiteProfile', {
                    siteId,
                    partyId,
                    handle: name,
                    displayName: name,
                    discoverability: 'members',
                    revision: 1,
                })
                call('create#mantle.marketing.contact.ContactListParty', {
                    contactListId: categoryId,
                    partyId,
                    fromDate: baseTime - 60000,
                    statusId: 'CLPT_ACCEPTED',
                })
                member[name] = partyId
            }
        })
        setPreferences('pass.notice.first', {
            scopeType: 'site',
            scopeId: '_SITE_',
            watchLevel: 'WatchingFirstPost',
        })
        setPreferences('pass.notice.thread', {
            scopeType: 'topic',
            scopeId: rootId,
            watchLevel: 'Watching',
            emailMode: 'Notifications',
        })
        return {}
    },
    then() {
        Object.keys(member).length === 3
    },
})
feature(
    'first-post watching, mentions, muting and topic precedence decide each notice',
    {
        when() {
            capture.clear()
            secondRoot = post({
                contactListId: categoryId,
                title: 'Second topic',
                body: '<p>A new topic</p>',
            }).rootCommEventId
            const reply = post({
                rootCommEventId: secondRoot,
                body: '<p>Thanks @mention for the idea</p>',
            }).postId
            call('mantle.forum.DeliveryWorkerServices.dispatch#Outbox', {})
            setPreferences('pass.notice.mention', {
                scopeType: 'topic',
                scopeId: secondRoot,
                watchLevel: 'Muted',
            })
            const muted = post({
                rootCommEventId: secondRoot,
                body: '<p>Again @mention</p>',
            }).postId
            call('mantle.forum.DeliveryWorkerServices.dispatch#Outbox', {})
            return {
                root: deliveries(secondRoot),
                reply: deliveries(reply),
                muted: deliveries(muted),
            }
        },
        then({ root, reply, muted }) {
            of(root, member.first, 'in-app').reason === 'first-post'
            !of(reply, member.first, 'in-app')
            of(reply, member.mention, 'in-app').reason === 'mention'
            !of(muted, member.mention, 'in-app')
        },
    },
)
feature(
    'mailing-list mode emails every post; digest mode waits for the digest',
    {
        when() {
            setPreferences('pass.notice.first', {
                scopeType: 'category',
                scopeId: categoryId,
                emailMode: 'EveryPost',
            })
            setPreferences('pass.notice.mention', {
                scopeType: 'site',
                scopeId: '_SITE_',
                emailMode: 'Digest',
                digestPeriod: 'daily',
            })
            const reply = post({
                rootCommEventId: rootId,
                body: '<p>A reply for @mention</p>',
            }).postId
            call('mantle.forum.DeliveryWorkerServices.dispatch#Outbox', {})
            const list = deliveries(reply)
            const topicOverride = (() => {
                try {
                    setPreferences('pass.notice.first', {
                        scopeType: 'topic',
                        scopeId: rootId,
                        emailMode: 'EveryPost',
                    })
                    return ''
                } catch (e) {
                    ec.message.clearErrors()
                    login('john.doe')
                    return String(e.message)
                }
            })()
            return { list, topicOverride }
        },
        then({ list, topicOverride }) {
            of(list, member.first, 'email').reason === 'every-post'
            !of(list, member.first, 'in-app')
            of(list, member.mention, 'in-app').reason === 'mention'
            !of(list, member.mention, 'email')
            topicOverride.includes('mailing-list')
        },
    },
)
feature('a digest names accessible topics once per period', {
    when() {
        capture.clear()
        call('mantle.forum.DeliveryWorkerServices.send#Digests', {})
        call('mantle.forum.DeliveryWorkerServices.send#Digests', {})
        const prepared = sys(() =>
            Array.from(
                ec.entity
                    .find('mantle.forum.ForumDelivery')
                    .condition({
                        siteId,
                        partyId: member.mention,
                        channel: 'digest',
                    })
                    .list(),
            ),
        )
        call('mantle.forum.DeliveryWorkerServices.dispatch#Outbox', {})
        const digest = capture
            .getMessages()
            .filter((m) => m.toList.includes('mention.notice@example.test'))
        return { prepared: prepared.length, digest }
    },
    then({ prepared, digest }) {
        prepared === 1
        digest.length === 1
        digest[0].body.includes('Your forum digest')
    },
})
feature('replies thread under the mail the member already received', {
    when() {
        capture.clear()
        const reply = post({
            rootCommEventId: rootId,
            body: '<p>Threaded reply</p>',
        })
        call('mantle.forum.DeliveryWorkerServices.dispatch#Outbox', {})
        const first = capture
            .getMessages()
            .find((m) => m.toList.includes('thread.notice@example.test'))
        capture.clear()
        post({
            rootCommEventId: rootId,
            parentCommEventId: reply.postId,
            body: '<p>A reply to the reply</p>',
        })
        call('mantle.forum.DeliveryWorkerServices.dispatch#Outbox', {})
        const second = capture
            .getMessages()
            .find((m) => m.toList.includes('thread.notice@example.test'))
        return { first, second }
    },
    then({ first, second }) {
        first.messageId.length > 0
        second.inReplyTo === first.messageId
        second.references.includes(first.messageId)
        second.headers['List-Id'].startsWith(siteId)
    },
})
feature(
    'own posts reach mailing-list mode only when asked; an opt-out may stop the whole site',
    {
        when() {
            setPreferences('pass.notice.first', {
                scopeType: 'category',
                scopeId: categoryId,
                includeOwn: true,
            })
            login('pass.notice.first', 'moqui1!!')
            // Past first-post review, so the post is delivered at once.
            sys(() =>
                call('create#mantle.forum.ForumMemberState', {
                    siteId,
                    partyId: member.first,
                    trustLevel: 'basic',
                    approvedContributions: 10,
                    dailyTopics: 0,
                    dailyReplies: 0,
                    revision: 1,
                }),
            )
            let own
            try {
                own = post({
                    rootCommEventId: rootId,
                    body: '<p>My own post</p>',
                })
            } catch (e) {
                ec.message.clearErrors()
                own = { error: String(e.message) }
            }
            login('john.doe')
            call('mantle.forum.DeliveryWorkerServices.dispatch#Outbox', {})
            const ownMail = own.postId
                ? of(deliveries(own.postId), member.first, 'email')
                : null
            capture.clear()
            post({ rootCommEventId: rootId, body: '<p>One more</p>' })
            call('mantle.forum.DeliveryWorkerServices.dispatch#Outbox', {})
            const mail = capture
                .getMessages()
                .find((m) => m.toList.includes('first.notice@example.test'))
            const header = Object.entries(mail.headers).find(
                ([key]) => key.toLowerCase() === 'list-unsubscribe',
            )[1]
            const token = String(header).match(/token=([A-Za-z0-9_-]+)/)[1]
            const choices = run(D + 'inspect#OptOut', { siteId, token })
            run(D + 'apply#OptOut', { siteId, token, scopeType: 'site' })
            login('pass.notice.first', 'moqui1!!')
            const site = run(D + 'get#Preferences', {
                siteId,
                scopeType: 'site',
                scopeId: '_SITE_',
            }).delivery
            login('john.doe')
            return { own, ownMail, choices, site }
        },
        then({ own, ownMail, choices, site }) {
            ownMail?.reason === 'every-post'
            choices.optOut['Or choose'].includes('all forum email')
            site.suppressed === 'Y'
            site.emailMode === 'None'
        },
    },
)
feature(
    'account, category and unsubscribe screens offer every delivery choice',
    {
        when() {
            const render = (path, params) => {
                const out = ec.screen
                    .makeTest()
                    .rootScreen('component://mr-pass/screen/Pass.xml')
                    .render(
                        path,
                        {
                            resolvedSiteId: siteId,
                            publicHost: 'outbox.example.test',
                            publicPath: '/forum',
                            ...params,
                        },
                        null,
                    )
                return { html: out.output, errors: out.errorMessages }
            }
            login('pass.notice.thread', 'moqui1!!')
            const settings = render('Account/Settings', {}),
                category = render('Forum/Categories/CategoryDetail', {
                    contactListId: categoryId,
                }),
                notices = render('Account/Notifications', {})
            login('john.doe')
            return { settings, category, notices }
        },
        then({ settings, category, notices }) {
            settings.errors.length === 0
            settings.html.includes('value="EveryPost"')
            settings.html.includes('name="digestPeriod"')
            category.errors.length === 0
            category.html.includes('PassCategoryDetailSetPreferences')
            notices.errors.length === 0
            notices.html.includes('Unread · watching')
        },
    },
)
