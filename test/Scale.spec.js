// Explicit large fixture; opt in with -D pass_scale_test=true and --spec Scale.
const F = 'mantle.forum.ForumServices.',
    S = 'mantle.public.SiteServices.'
const run = (name, input) => call(name, { input }).result
const put = (name, fields) => {
    const value = ec.entity.makeValue(name)
    for (const [key, item] of Object.entries(fields)) value.set(key, item)
    value.create()
}
feature(
    '10,000 posts and 100,000 category members keep reading and recipient work bounded',
    {
        ignore:
            System.getProperty('pass_scale_test') !== 'true'
                ? 'Large isolated fixture; enable pass_scale_test'
                : false,
        timeout: 600,
        when() {
            login('john.doe')
            const old = ec.artifactExecution.disableAuthz()
            try {
                const siteId = run(S + 'create#Site', {
                    name: 'Scale fixture',
                    ownerPartyId: ec.user.userAccount.partyId,
                }).siteId
                run(S + 'update#Site', {
                    siteId,
                    state: 'published',
                    expectedRevision: 1,
                })
                const categoryId = run(F + 'store#Category', {
                    siteId,
                    name: 'Large community',
                    operationId: 'scale-category-001',
                }).contactListId
                run(F + 'set#CategoryAccess', {
                    siteId,
                    contactListId: categoryId,
                    visibility: 'public',
                    publicationState: 'published',
                    expectedRevision: 1,
                    confirm: true,
                })
                const root = run(F + 'publish#Post', {
                    siteId,
                    contactListId: categoryId,
                    title: 'A large topic',
                    body: 'Root',
                    operationId: 'scale-topic-001',
                }).rootCommEventId
                const at = ec.user.nowTimestamp,
                    author = ec.user.userAccount.partyId
                for (let ordinal = 2; ordinal <= 10000; ordinal++) {
                    const postId =
                        'PASS_SCALE_POST_' + String(ordinal).padStart(5, '0')
                    put('mantle.party.communication.CommunicationEvent', {
                        communicationEventId: postId,
                        communicationEventTypeId: 'Message',
                        contactListId: categoryId,
                        fromPartyId: author,
                        rootCommEventId: root,
                        parentCommEventId: root,
                        subject: 'A large topic',
                        body: 'Post ' + ordinal,
                        statusId: 'CeReceived',
                        entryDate: at,
                    })
                    put('mantle.forum.ForumPostState', {
                        communicationEventId: postId,
                        rootCommEventId: root,
                        ordinal,
                        revision: 1,
                        visibility: 'approved',
                        approvedRevision: 1,
                    })
                }
                const topic = ec.entity
                    .find('mantle.forum.ForumTopic')
                    .condition('rootCommEventId', root)
                    .one()
                topic.set('nextOrdinal', 10001)
                topic.set('visiblePostCount', 10000)
                topic.update()
                for (let member = 0; member < 100000; member++) {
                    const partyId =
                        'PASS_SCALE_MEMBER_' + String(member).padStart(6, '0')
                    put('mantle.party.Party', {
                        partyId,
                        partyTypeEnumId: 'PtyPerson',
                    })
                    put('mantle.public.PublicSiteParty', {
                        siteId,
                        partyId,
                        state: 'active',
                        role: 'member',
                        revision: 1,
                        joinedAt: at,
                    })
                    put('mantle.marketing.contact.ContactListParty', {
                        contactListId: categoryId,
                        partyId,
                        fromDate: at,
                        statusId: 'CLPT_ACCEPTED',
                    })
                }
                const first = run(F + 'get#Posts', {
                        siteId,
                        rootCommEventId: root,
                    }),
                    last = run(F + 'get#Posts', {
                        siteId,
                        rootCommEventId: root,
                        around: 'PASS_SCALE_POST_09995',
                    })
                const second = run(F + 'get#Posts', {
                    siteId,
                    rootCommEventId: root,
                    cursor: first.nextCursor,
                })
                ec.user.setEffectiveTime(ec.user.timestampMillis(at) + 20000)
                const reply = run(F + 'publish#Post', {
                    siteId,
                    rootCommEventId: root,
                    body: 'Still no public fan-out',
                    operationId: 'scale-reply-001',
                })
                const receipts = ec.entity
                    .find('mantle.party.communication.CommunicationEventParty')
                    .condition('communicationEventId', reply.postId)
                    .count()
                const box = ec.entity
                    .find('mantle.forum.ForumOutbox')
                    .condition('communicationEventId', reply.postId)
                    .one()
                const batch = call(
                    'mantle.forum.DeliveryWorkerServices.prepare#Outbox',
                    { outboxId: box.outboxId },
                ).result
                return {
                    first: first.postList.length,
                    nextOrdinal: second.postList[0].ordinal,
                    opaque: /^[A-Za-z0-9_-]{32}$/.test(first.nextCursor),
                    last: last.postList.length,
                    located: last.postList.some(
                        (post) => post.postId === 'PASS_SCALE_POST_09995',
                    ),
                    context: last.postList[0].ordinal,
                    receipts,
                    batch: batch.prepared,
                    prepared: batch.done,
                    ordinal: reply.ordinal,
                }
            } finally {
                if (!old) ec.artifactExecution.enableAuthz()
            }
        },
        then({
            first,
            nextOrdinal,
            opaque,
            last,
            located,
            context,
            receipts,
            batch,
            prepared,
            ordinal,
        }) {
            first === 30
            nextOrdinal === 31
            opaque === true
            // Five posts of context before the located post, through the last post.
            last === 11
            located === true
            context === 9990
            receipts === 0
            // Only the parent author and watchers are candidates, not the 100,000 members.
            batch <= 1
            prepared === true
            ordinal === 10001
        },
    },
)
