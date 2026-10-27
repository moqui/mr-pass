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
