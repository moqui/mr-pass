// S2 private conversations: explicit participants, no staff browsing, blocks, history confirmation, policy,
// scoped report evidence with audited escalation, participant-only delivery and opt-in private search.
const S = 'mantle.public.SiteServices.',
    F = 'mantle.forum.ForumServices.',
    M = 'mantle.forum.ModerationServices.'
const run = (name, input) =>
    call(name, {
        input: /create#Conversation$|flag#Post$|store#Category$/.test(name)
            ? { operationId: ec.user.randomString(32), ...input }
            : input,
    }).result
const publish = (input) =>
    run(F + 'publish#Post', { operationId: ec.user.randomString(32), ...input })
const party = {}
let siteId, rootId, firstReply, secondReply, policyRevision
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
        name.endsWith('publish#Post') ? publish(input) : run(name, input)
        return ''
    } catch (error) {
        ec.message.clearErrors()
        return String(error.message)
    }
}
const list = (name, fields) =>
    sys(() => Array.from(ec.entity.find(name).condition(fields).list()))
function ready(partyId, trustLevel = 'basic') {
    sys(() => {
        const key = { siteId, partyId }
        let v = ec.entity
            .find('mantle.forum.ForumMemberState')
            .condition(key)
            .one()
        if (!v) {
            v = ec.entity.makeValue('mantle.forum.ForumMemberState')
            for (const [k, x] of Object.entries({
                ...key,
                dailyTopics: 0,
                dailyReplies: 0,
                revision: 1,
            }))
                v.set(k, x)
        }
        v.set('trustLevel', trustLevel)
        v.set('approvedContributions', 10)
        v.set('lastPostedAt', null)
        v.createOrUpdate()
    })
}
const revisionOf = (root) =>
    run(F + 'get#Topic', { siteId, rootCommEventId: root }).topic.revision
const at = Date.now()
spec({
    stepwise: true,
    setupSpec() {
        login('john.doe')
    },
    cleanup() {
        login('john.doe')
    },
})
feature('a basic member starts a conversation; a new member cannot', {
    when() {
        party.owner = ec.user.userAccount.partyId
        siteId = run(S + 'create#Site', {
            name: 'Conversations',
            ownerPartyId: party.owner,
        }).siteId
        run(S + 'update#Site', {
            siteId,
            state: 'published',
            expectedRevision: 1,
        })
        sys(() => {
            call('create#mantle.public.PublicSiteProfile', {
                siteId,
                partyId: party.owner,
                handle: 'owner',
                displayName: 'Site owner',
                discoverability: 'members',
                revision: 1,
            })
            for (const name of ['ann', 'ben', 'cy', 'dee']) {
                party[name] = call('mantle.party.PartyServices.create#Person', {
                    firstName: name,
                    lastName: 'Private',
                }).partyId
                call('mantle.party.PartyServices.create#PartyUserAccount', {
                    partyId: party[name],
                    username: 'pass.pm.' + name,
                    emailAddress: name + '.pm@example.test',
                    newPassword: 'moqui1!!',
                    newPasswordVerify: 'moqui1!!',
                })
                call('create#mantle.public.PublicSiteParty', {
                    siteId,
                    partyId: party[name],
                    state: 'active',
                    role: 'member',
                    joinedAt: at,
                    revision: 1,
                })
                call('create#mantle.public.PublicSiteProfile', {
                    siteId,
                    partyId: party[name],
                    handle: name,
                    displayName: name,
                    discoverability: 'members',
                    revision: 1,
                })
            }
        })
        login('pass.pm.dee', 'moqui1!!')
        ready(party.dee, 'new')
        const newMember = failure(F + 'create#Conversation', {
            siteId,
            participantHandles: ['ann'],
            title: 'Hello',
            body: '<p>Hi</p>',
        })
        login('pass.pm.ann', 'moqui1!!')
        ready(party.ann)
        const unknown = failure(F + 'create#Conversation', {
            siteId,
            participantHandles: ['ben', 'nobody'],
            title: 'Hello',
            body: '<p>Hi</p>',
        })
        const started = run(F + 'create#Conversation', {
            siteId,
            participantHandles: ['ben'],
            title: 'Our secret plan',
            body: '<p>The secret plan starts here</p>',
        })
        rootId = started.rootCommEventId
        return {
            newMember,
            unknown,
            started,
            topic: run(F + 'get#Topic', { siteId, rootCommEventId: rootId })
                .topic,
        }
    },
    then({ newMember, unknown, started, topic }) {
        newMember.includes('trust level')
        unknown.includes('One or more recipients cannot receive')
        !unknown.includes('nobody')
        started.state === 'published'
        topic.kind === 'private'
        topic.category === null
        topic.participants
            .map((p) => p.handle)
            .sort()
            .join() === 'ann,ben'
    },
})
feature(
    'only current participants read it: not visitors, other members or site staff',
    {
        when() {
            login('pass.pm.ben', 'moqui1!!')
            ready(party.ben)
            firstReply = publish({
                siteId,
                rootCommEventId: rootId,
                body: '<p>Count me in</p>',
            }).postId
            const benReads = run(F + 'get#Posts', {
                siteId,
                rootCommEventId: rootId,
            }).postList.length
            login('pass.pm.cy', 'moqui1!!')
            const member = failure(F + 'get#Posts', {
                siteId,
                rootCommEventId: rootId,
            })
            login('john.doe')
            const staff = failure(F + 'get#Topic', {
                siteId,
                rootCommEventId: rootId,
            })
            const listed = run(F + 'find#Topics', { siteId }).topicList
            logout()
            const anonymous = failure(F + 'get#Topic', {
                siteId,
                rootCommEventId: rootId,
            })
            return { benReads, member, staff, listed, anonymous }
        },
        then({ benReads, member, staff, listed, anonymous }) {
            benReads === 2
            member.includes('not found')
            staff.includes('not found')
            listed.length === 0
            anonymous.includes('not found')
        },
    },
)
feature(
    'adding a participant requires history confirmation; internal ones get receipts, public ones do not',
    {
        when() {
            login('pass.pm.ann', 'moqui1!!')
            const unconfirmed = failure(F + 'update#Participants', {
                siteId,
                rootCommEventId: rootId,
                participantHandles: ['owner'],
                expectedRevision: revisionOf(rootId),
            })
            run(F + 'update#Participants', {
                siteId,
                rootCommEventId: rootId,
                participantHandles: ['owner'],
                confirm: true,
                expectedRevision: revisionOf(rootId),
            })
            login('john.doe')
            const history = run(F + 'get#Posts', {
                siteId,
                rootCommEventId: rootId,
            }).postList.length
            login('pass.pm.ben', 'moqui1!!')
            ready(party.ben)
            secondReply = publish({
                siteId,
                rootCommEventId: rootId,
                body: '<p>Second reply with the secret word</p>',
            }).postId
            const receipts = list(
                'mantle.party.communication.CommunicationEventParty',
                {
                    communicationEventId: secondReply,
                },
            ).map((r) => r.partyId)
            return { unconfirmed, history, receipts }
        },
        then({ unconfirmed, history, receipts }) {
            unconfirmed.includes('Confirm')
            history === 2
            receipts.join() === party.owner
        },
    },
)
feature('blocks stop new contact, and the last owner cannot simply leave', {
    when() {
        login('pass.pm.cy', 'moqui1!!')
        run(F + 'set#MemberPreference', {
            siteId,
            targetHandle: 'ann',
            preference: 'block',
        })
        login('pass.pm.ann', 'moqui1!!')
        ready(party.ann)
        const blocked = failure(F + 'create#Conversation', {
            siteId,
            participantHandles: ['cy'],
            title: 'Hi cy',
            body: '<p>Hello</p>',
        })
        const addBlocked = failure(F + 'update#Participants', {
            siteId,
            rootCommEventId: rootId,
            participantHandles: ['cy'],
            confirm: true,
            expectedRevision: revisionOf(rootId),
        })
        const lastOwner = failure(F + 'set#ConversationState', {
            siteId,
            rootCommEventId: rootId,
            action: 'leave',
        })
        return { blocked, addBlocked, lastOwner }
    },
    then({ blocked, addBlocked, lastOwner }) {
        blocked.includes('cannot receive')
        addBlocked.includes('cannot receive')
        lastOwner.includes('another participant an owner')
    },
})
feature(
    'a removed participant loses access, archive is personal, search is opt-in',
    {
        when() {
            login('pass.pm.ann', 'moqui1!!')
            run(F + 'update#Participants', {
                siteId,
                rootCommEventId: rootId,
                targetHandles: ['ben'],
                expectedRevision: revisionOf(rootId),
            })
            run(F + 'set#ConversationState', {
                siteId,
                rootCommEventId: rootId,
                action: 'archive',
            })
            const inbox = run(F + 'find#Conversations', {
                siteId,
            }).conversationList
            const archived = run(F + 'find#Conversations', {
                siteId,
                view: 'archived',
            }).conversationList
            const privateHits = run(F + 'search#Forum', {
                siteId,
                query: 'secret',
                scope: 'private',
            }).topicList
            const publicHits = run(F + 'search#Forum', {
                siteId,
                query: 'secret',
            }).topicList
            login('pass.pm.ben', 'moqui1!!')
            const removed = failure(F + 'get#Posts', {
                siteId,
                rootCommEventId: rootId,
            })
            const benInbox = run(F + 'find#Conversations', {
                siteId,
            }).conversationList
            return {
                inbox,
                archived,
                privateHits,
                publicHits,
                removed,
                benInbox,
            }
        },
        then({ inbox, archived, privateHits, publicHits, removed, benInbox }) {
            inbox.length === 0
            archived.length === 1
            archived[0].participants.length === 2
            privateHits.length >= 1
            publicHits.length === 0
            removed.includes('not found')
            benInbox.length === 0
        },
    },
)
feature(
    'turning private messages off stops new conversations; replies follow their own setting',
    {
        when() {
            login('john.doe')
            policyRevision = run(M + 'get#Policy', { siteId }).revision
            policyRevision = run(M + 'store#Policy', {
                siteId,
                expectedRevision: policyRevision,
                config: { privateEnabled: false },
            }).revision
            login('pass.pm.ann', 'moqui1!!')
            ready(party.ann)
            const start = failure(F + 'create#Conversation', {
                siteId,
                participantHandles: ['dee'],
                title: 'Off',
                body: '<p>Off</p>',
            })
            const reply = publish({
                siteId,
                rootCommEventId: rootId,
                body: '<p>Replies still work</p>',
            })
            login('john.doe')
            policyRevision = run(M + 'store#Policy', {
                siteId,
                expectedRevision: policyRevision,
                config: { privateExistingReplies: false },
            }).revision
            login('pass.pm.ann', 'moqui1!!')
            ready(party.ann)
            const stopped = failure(F + 'publish#Post', {
                siteId,
                rootCommEventId: rootId,
                body: '<p>No more</p>',
            })
            const reads = run(F + 'get#Posts', {
                siteId,
                rootCommEventId: rootId,
            }).postList.length
            login('john.doe')
            run(M + 'store#Policy', {
                siteId,
                expectedRevision: policyRevision,
                config: { privateEnabled: true, privateExistingReplies: true },
            })
            return { start, reply, stopped, reads }
        },
        then({ start, reply, stopped, reads }) {
            start.includes('turned off')
            reply.state === 'published'
            stopped.includes('not permitted')
            reads === 4
        },
    },
)
feature(
    'a report shows staff adjacent posts only; wider context needs owner approval, all audited',
    {
        when() {
            login('john.doe')
            const flagged = run(M + 'flag#Post', {
                siteId,
                postId: secondReply,
                reason: 'Inappropriate',
            })
            const narrow = run(M + 'get#Review', {
                siteId,
                reviewId: flagged.reviewId,
            })
            run(M + 'escalate#Review', {
                siteId,
                reviewId: flagged.reviewId,
                reason: 'Need earlier messages',
            })
            run(M + 'escalate#Review', {
                siteId,
                reviewId: flagged.reviewId,
                reason: 'Approved for this report only',
                active: true,
            })
            const wide = run(M + 'get#Review', {
                siteId,
                reviewId: flagged.reviewId,
            })
            const audits = list('mantle.forum.ForumModerationAction', {
                siteId,
                targetId: flagged.reviewId,
            }).map((a) => a.action)
            return { narrow, wide, audits }
        },
        then({ narrow, wide, audits }) {
            narrow.context.length === 2
            wide.context.length === 3
            audits.filter((a) => a === 'private-evidence-view').length === 2
            audits.includes('escalation-requested')
            audits.includes('escalation-approved')
        },
    },
)
feature(
    'notifications go to current participants only, with a minimal email notice',
    {
        when() {
            call('mantle.forum.DeliveryWorkerServices.dispatch#Outbox', {})
            const outbox = list('mantle.forum.ForumOutbox', {
                siteId,
                eventType: 'post',
            }).map((b) => b.outboxId)
            const deliveries = list('mantle.forum.ForumDelivery', {
                siteId,
            }).filter(
                (d) => outbox.includes(d.outboxId) && d.channel === 'in-app',
            )
            return {
                recipients: [...new Set(deliveries.map((d) => d.partyId))],
            }
        },
        then({ recipients }) {
            !recipients.includes(party.cy)
            !recipients.includes(party.dee)
            recipients.includes(party.ann)
        },
    },
)
feature(
    'message screens show conversations, participants, profile actions and report context',
    {
        when() {
            login('john.doe')
            const s = sys(() =>
                ec.entity
                    .find('mantle.public.PublicSite')
                    .condition({ siteId })
                    .one(),
            )
            run(S + 'store#Mounts', {
                siteId,
                expectedRevision: s.revision ?? s.policyRevision,
                mounts: [
                    { app: 'forum', pathPrefix: '/forum' },
                    { app: 'account', pathPrefix: '/account' },
                    { app: 'members', pathPrefix: '/members' },
                    { app: 'sites', pathPrefix: '/sites' },
                ],
                hosts: [{ hostname: 'pm.example.test', canonical: true }],
            })
            const render = (path, params) => {
                const out = ec.screen
                    .makeTest()
                    .rootScreen('component://mr-pass/screen/Pass.xml')
                    .render(
                        path,
                        {
                            resolvedSiteId: siteId,
                            publicHost: 'pm.example.test',
                            publicPath: '/forum',
                            ...params,
                        },
                        null,
                    )
                return { html: out.output, errors: out.errorMessages }
            }
            const reviewId = list('mantle.forum.ForumReviewItem', {
                siteId,
                targetId: secondReply,
            })[0].reviewId
            const review = render('Forum/Moderation/ReviewDetail', { reviewId })
            login('pass.pm.ann', 'moqui1!!')
            return {
                review,
                messages: render('Forum/Messages/List', { view: 'archived' }),
                detail: render('Forum/Messages/ConversationDetail', {
                    rootCommEventId: rootId,
                }),
                profile: render('Members/MemberDetail', { handle: 'dee' }),
            }
        },
        then({ review, messages, detail, profile }) {
            review.errors.length === 0
            review.html.includes('Context shown for this report')
            messages.errors.length === 0
            messages.html.includes('Our secret plan')
            detail.errors.length === 0
            detail.html.includes('Participants: ')
            detail.html.includes('PassConversationDetailUpdateParticipants')
            profile.errors.length === 0
            profile.html.includes('PassMemberDetailSetMemberPreference')
            profile.html.includes('Send a private message')
        },
    },
)
feature(
    'Comms shows a private conversation to a current internal participant only',
    {
        when() {
            login('john.doe')
            const thread = sys(() =>
                call('mantle.party.CommunicationServices.get#InternalThread', {
                    rootCommEventId: rootId,
                }),
            )
            ec.message.clearErrors()
            login('pass.pm.ann', 'moqui1!!')
            run(F + 'update#Participants', {
                siteId,
                rootCommEventId: rootId,
                targetHandles: ['owner'],
                expectedRevision: revisionOf(rootId),
            })
            login('john.doe')
            let removed = ''
            try {
                const out = sys(() =>
                    call(
                        'mantle.party.CommunicationServices.get#InternalThread',
                        { rootCommEventId: rootId },
                    ),
                )
                removed = ec.message.hasError()
                    ? ec.message.getErrorsString()
                    : JSON.stringify(out.messageList || [])
            } catch (e) {
                removed = String(e.message)
            }
            ec.message.clearErrors()
            return { thread, removed }
        },
        then({ thread, removed }) {
            thread.forum.kind === 'private'
            thread.messageList.length >= 1
            !removed.includes('secret')
        },
    },
)
feature(
    'a removed internal participant cannot reply through Comms, and a suspended member lists nothing',
    {
        when() {
            login('john.doe')
            let reply = ''
            try {
                sys(() =>
                    call('mantle.party.CommunicationServices.create#Message', {
                        communicationEventTypeId: 'Message',
                        fromPartyId: party.owner,
                        rootCommEventId: rootId,
                        parentCommEventId: rootId,
                        subject: 'Re: Our secret plan',
                        body: 'Still here?',
                    }),
                )
                reply = ec.message.hasError()
                    ? ec.message.getErrorsString()
                    : 'posted'
            } catch (e) {
                reply = String(e.message)
            }
            ec.message.clearErrors()
            sys(() => {
                const m = ec.entity
                    .find('mantle.public.PublicSiteParty')
                    .condition({ siteId, partyId: party.ann })
                    .one()
                m.set('state', 'suspended')
                m.update()
            })
            login('pass.pm.ann', 'moqui1!!')
            const listed = run(F + 'find#Conversations', {
                siteId,
                view: 'archived',
            }).conversationList
            return { reply, listed }
        },
        then({ reply, listed }) {
            reply !== 'posted'
            reply.includes('not found')
            listed.length === 0
        },
    },
)
