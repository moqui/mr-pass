// S2 email participation: routes, scoped reply addresses, verified senders, deduplication, automatic mail,
// bounces, new topics by category address, attachment scanning and parity with web posting rules.
const S = 'mantle.public.SiteServices.',
    F = 'mantle.forum.ForumServices.',
    M = 'mantle.forum.ModerationServices.',
    D = 'mantle.forum.DeliveryServices.'
const run = (name, input) =>
    call(name, {
        input: /store#(Category|Route)$/.test(name)
            ? { operationId: ec.user.randomString(32), ...input }
            : input,
    }).result
const capture = ec.factory.getTool('MailCapture'),
    baseTime = Date.now()
const party = {}
let siteId, categoryId, rootId, token, annMessageId, emailTopic
function sys(work) {
    const old = ec.artifactExecution.disableAuthz()
    try {
        return work()
    } finally {
        if (!old) ec.artifactExecution.enableAuthz()
    }
}
function failure(name, input) {
    try {
        run(name, input)
        return ''
    } catch (error) {
        ec.message.clearErrors()
        return String(error.message)
    }
}
function upsert(entity, fields) {
    sys(() => {
        const v = ec.entity.makeValue(entity)
        for (const [k, x] of Object.entries(fields)) v.set(k, x)
        v.createOrUpdate()
    })
}
const list = (name, fields) =>
    sys(() => Array.from(ec.entity.find(name).condition(fields).list()))
let clock = baseTime
/* One inbound email through the forum's email ECA service. */
function receive({ to, from, subject, text, messageId, auth = true, extra = {}, parts }) {
    clock += 20000
    ec.user.setEffectiveTime(clock)
    return call(D + 'process#Inbound', {
        emailMessageId: null,
        headers: {
            'delivered-to': to,
            'message-id': messageId || '<' + ec.user.randomString(16) + '@sender.test>',
            ...(auth
                ? { 'authentication-results': 'gw.example.test; dmarc=pass header.from=sender.test' }
                : {}),
            ...extra,
        },
        fields: { from, subject: subject || 'Re: Welcome', toList: [to] },
        bodyPartList: parts || [{ contentType: 'text/plain; charset=utf-8', contentText: text }],
    }).result
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
        ec.user.setEffectiveTime(null)
        login('john.doe')
    },
})
feature('routes take registered domains and unique addresses', {
    when() {
        party.owner = ec.user.userAccount.partyId
        siteId = run(S + 'create#Site', { name: 'Inbound', ownerPartyId: party.owner }).siteId
        run(S + 'store#Mounts', {
            siteId,
            expectedRevision: 1,
            mounts: [
                { app: 'forum', pathPrefix: '/forum' },
                { app: 'account', pathPrefix: '/account' },
            ],
            hosts: [{ hostname: 'inbound.example.test', canonical: true }],
        })
        run(S + 'update#Site', { siteId, state: 'published', expectedRevision: 2 })
        categoryId = run(F + 'store#Category', { siteId, name: 'Support' }).contactListId
        run(F + 'set#CategoryAccess', {
            siteId,
            contactListId: categoryId,
            visibility: 'public',
            publicationState: 'published',
            expectedRevision: 1,
            confirm: true,
        })
        upsert('moqui.basic.email.EmailServer', {
            emailServerId: 'PASS_INBOUND_SERVER',
            smtpHost: 'smtp.example.test',
            smtpPort: 25,
        })
        upsert('moqui.basic.email.EmailTemplate', {
            emailTemplateId: 'PASS_TEST_INBOUND',
            emailServerId: 'PASS_INBOUND_SERVER',
            fromAddress: 'community@example.test',
            subject: 'Forum notice',
            bodyScreenLocation: 'component://mr-pass/test/NoticeEmail.xml',
        })
        run(D + 'store#MailSettings', {
            siteId,
            senderAddress: 'community@example.test',
            senderName: 'Community',
            templateId: 'PASS_TEST_INBOUND',
            expectedRevision: 0,
        })
        const unregistered = failure(D + 'store#Route', { siteId, address: 'support@elsewhere.test' })
        run(D + 'store#Route', { siteId, address: 'support@lists.example.test', contactListId: categoryId })
        run(D + 'store#Route', { siteId, address: 'help@lists.example.test', contactListId: categoryId })
        const duplicate = failure(D + 'store#Route', { siteId, address: 'Support@lists.example.test' })
        sys(() => {
            for (const name of ['ann', 'bob', 'cal']) {
                party[name] = call('mantle.party.PartyServices.create#Person', {
                    firstName: name,
                    lastName: 'Mail',
                }).partyId
                call('mantle.party.PartyServices.create#PartyUserAccount', {
                    partyId: party[name],
                    username: 'pass.mail.' + name,
                    emailAddress: name + '@sender.test',
                    newPassword: 'moqui1!!',
                    newPasswordVerify: 'moqui1!!',
                })
                const account = ec.entity
                    .find('moqui.security.UserAccount')
                    .condition('username', 'pass.mail.' + name)
                    .one()
                if (name !== 'cal')
                    call('create#moqui.security.public.VerifiedAddress', {
                        userId: account.userId,
                        emailAddress: account.emailAddress,
                        verifiedAt: baseTime,
                    })
                call('create#mantle.public.PublicSiteParty', {
                    siteId,
                    partyId: party[name],
                    state: 'active',
                    role: 'member',
                    revision: 1,
                    joinedAt: baseTime,
                })
                call('create#mantle.marketing.contact.ContactListParty', {
                    contactListId: categoryId,
                    partyId: party[name],
                    fromDate: baseTime - 60000,
                    statusId: 'CLPT_ACCEPTED',
                })
                call('create#mantle.forum.ForumPreference', {
                    siteId,
                    partyId: party[name],
                    scopeType: 'category',
                    scopeId: categoryId,
                    watchLevel: 'Watching',
                    revision: 1,
                })
            }
        })
        return { unregistered, duplicate }
    },
    then({ unregistered, duplicate }) {
        unregistered.includes('not registered')
        duplicate.includes('already routed')
    },
})
feature('a notice carries a scoped reply address and thread identity', {
    when() {
        rootId = run(F + 'publish#Post', {
            siteId,
            contactListId: categoryId,
            title: 'Welcome',
            body: '<p>Say hello</p>',
            operationId: ec.user.randomString(32),
        }).rootCommEventId
        call('mantle.forum.DeliveryWorkerServices.dispatch#Outbox', {})
        const mail = capture.getMessages().find((m) => m.toList.includes('ann@sender.test'))
        token = /^(?:support|help)\+([A-Za-z0-9_-]+)@lists\.example\.test$/.exec(mail.replyToList[0])[1]
        annMessageId = mail.messageId
        return { mail }
    },
    then({ mail }) {
        token.length === 32
        mail.headers['List-Id'].startsWith(siteId)
    },
})
feature('a verified reply posts once, without its quoted history, even through two aliases', {
    when() {
        const messageId = '<reply-1@sender.test>'
        const first = receive({
            to: 'support+' + token + '@lists.example.test',
            from: 'Ann <ann@sender.test>',
            messageId,
            text: 'Hello from my mail client.\n\nOn Monday, Community wrote:\n> Say hello\n',
        })
        const alias = receive({
            to: 'help@lists.example.test',
            from: 'ann@sender.test',
            messageId,
            text: 'Hello from my mail client.\n\nOn Monday, Community wrote:\n> Say hello\n',
        })
        const post = sys(() =>
            ec.entity
                .find('mantle.party.communication.CommunicationEvent')
                .condition('communicationEventId', first.postId || '')
                .one(),
        )
        return { first, alias, body: post?.body, count: list('mantle.forum.ForumInboundReceipt', { siteId }).length }
    },
    then({ first, alias, body, count }) {
        first.result === 'pending' || first.result === 'posted'
        alias.result === 'duplicate'
        body.includes('Hello from my mail client.')
        !body.includes('Say hello')
        count === 1
    },
})
feature('forged, forwarded, unverified and expired senders are held or refused without a post', {
    when() {
        const forged = receive({
            to: 'support+' + token + '@lists.example.test',
            from: 'ann@sender.test',
            auth: false,
            text: 'Forged',
        })
        const forwarded = receive({
            to: 'support+' + token + '@lists.example.test',
            from: 'bob@sender.test',
            text: 'Forwarded',
        })
        const unverified = receive({
            to: 'support@lists.example.test',
            from: 'cal@sender.test',
            subject: 'New question',
            text: 'Unverified',
        })
        sys(() =>
            ec.entity
                .find('mantle.forum.ForumReplyToken')
                .condition({ siteId, partyId: party.ann })
                .updateAll({ expiresAt: new Date(baseTime - 1000) }),
        )
        const expired = receive({
            to: 'support+' + token + '@lists.example.test',
            from: 'ann@sender.test',
            text: 'Too late',
        })
        return { forged, forwarded, unverified, expired }
    },
    then({ forged, forwarded, unverified, expired }) {
        forged.result === 'held'
        forwarded.result === 'held'
        forwarded.reason.includes('another member')
        unverified.result === 'held'
        expired.result === 'rejected'
    },
})
feature('automatic replies and our own mail are never posts', {
    when() {
        return {
            auto: receive({
                to: 'support@lists.example.test',
                from: 'bob@sender.test',
                text: 'I am away',
                extra: { 'auto-submitted': 'auto-replied' },
            }),
            own: receive({
                to: 'support@lists.example.test',
                from: 'community@example.test',
                text: 'Loop',
            }),
        }
    },
    then({ auto, own }) {
        auto.result === 'ignored'
        own.result === 'ignored'
    },
})
feature('a category address starts a topic under web rules; replies by thread reference find their topic', {
    when() {
        const started = receive({
            to: 'support@lists.example.test',
            from: 'bob@sender.test',
            subject: 'Re: Fwd: A new question by email',
            text: 'How do I start?',
        })
        emailTopic = started.postId
        const threaded = receive({
            to: 'support@lists.example.test',
            from: 'ann@sender.test',
            subject: 'Re: Welcome',
            text: 'Replying by thread reference',
            extra: { 'in-reply-to': annMessageId },
        })
        const threadedPost = list('mantle.forum.ForumPostState', {
            communicationEventId: threaded.postId || '',
        })[0]
        const root = list('mantle.party.communication.CommunicationEvent', {
            communicationEventId: emailTopic || '',
        })[0]
        return { started, threaded, threadedRoot: threadedPost?.rootCommEventId, root }
    },
    then({ started, threaded, threadedRoot, root }) {
        started.result === 'pending'
        root.subject === 'A new question by email'
        root.rootCommEventId == null
        ['pending', 'posted'].includes(threaded.result)
        threadedRoot === rootId
    },
})
feature('approval of an emailed post sends one notification, and feedback reached its author', {
    when() {
        const r = list('mantle.forum.ForumReviewItem', { targetId: emailTopic })[0]
        capture.clear()
        run(M + 'decide#Review', {
            siteId,
            reviewId: r.reviewId,
            decision: 'approved',
            reason: 'Fine',
            expectedRevision: r.revision,
        })
        call('mantle.forum.DeliveryWorkerServices.dispatch#Outbox', {})
        call('mantle.forum.DeliveryWorkerServices.dispatch#Outbox', {})
        const outbox = list('mantle.forum.ForumOutbox', { communicationEventId: emailTopic, eventType: 'post' })
        return {
            outbox: outbox.length,
            toAnn: capture.getMessages().filter((m) => m.toList.includes('ann@sender.test')).length,
        }
    },
    then({ outbox, toAnn }) {
        outbox === 1
        toAnn === 1
    },
})
feature('an attachment that fails scanning is held and the text still posts', {
    when() {
        const bytes = new Uint8Array(
            Array.from('quarantine fixture').map((c) => c.charCodeAt(0)),
        )
        return receive({
            to: 'support@lists.example.test',
            from: 'ann@sender.test',
            subject: 'Re: Welcome',
            extra: { 'in-reply-to': annMessageId },
            parts: [
                { contentType: 'text/plain', contentText: 'See the attached file' },
                { contentType: 'text/plain', filename: 'notes.txt', disposition: 'attachment', contentBytes: bytes },
            ],
        })
    },
    then(out) {
        ['pending', 'posted'].includes(out.result)
        out.reason.includes('held for scanning')
    },
})
feature('a hard bounce for a forum notice stops email to that member', {
    when() {
        const out = receive({
            to: 'support@lists.example.test',
            from: 'MAILER-DAEMON@mx.sender.test',
            subject: 'Undelivered Mail Returned to Sender',
            extra: { 'content-type': 'multipart/report; report-type=delivery-status' },
            parts: [
                { contentType: 'text/plain', contentText: 'Delivery failed.' },
                {
                    contentType: 'message/delivery-status',
                    contentText: 'Final-Recipient: rfc822; ann@sender.test\nStatus: 5.1.1\n\nMessage-ID: ' + annMessageId,
                },
            ],
        })
        const pref = list('mantle.forum.ForumDeliveryPreference', {
            siteId,
            partyId: party.ann,
            scopeType: 'site',
        })[0]
        return { out, pref }
    },
    then({ out, pref }) {
        out.result === 'bounce'
        out.reason.includes('Hard bounce')
        pref.suppressed === 'Y'
    },
})
feature('the mail screen shows routes and masked inbound outcomes', {
    when() {
        const out = ec.screen
            .makeTest()
            .rootScreen('component://mr-pass/screen/Pass.xml')
            .render(
                'Forum/Settings/Mail',
                {
                    resolvedSiteId: siteId,
                    publicHost: 'inbound.example.test',
                    publicPath: '/forum',
                },
                null,
            )
        return { html: out.output, errors: out.errorMessages }
    },
    then({ html, errors }) {
        errors.length === 0
        html.includes('support@lists.example.test')
        html.includes('Inbound messages')
        !html.includes('ann@sender.test')
        html.includes('PassMailStoreRoute')
    },
})
