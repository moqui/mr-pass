// S1 authority contract; actual service checks run with artifact authorization enabled.
let siteId, categoryId, rootId
const S = 'mantle.public.SiteServices.',
    F = 'mantle.forum.ForumServices.'
const run = (service, input) =>
    call(service, {
        input: service.endsWith('store#Category')
            ? { operationId: ec.user.randomString(32), ...input }
            : input,
    }).result
const errors = (service, input) => {
    try {
        run(service, input)
        return ''
    } catch (e) {
        ec.message.clearErrors()
        return String(e.message || e)
    }
}
spec({
    stepwise: true,
    setupSpec() {
        login('john.doe')
    },
    cleanup() {
        login('john.doe')
    },
})
feature('provision disabled site and refuse anonymous publication', {
    when() {
        siteId = run(S + 'create#Site', {
            name: 'PASS test',
            ownerPartyId: ec.user.userAccount.partyId,
        }).siteId
        return run(S + 'find#Sites', {})
    },
    then(result) {
        result.siteList.some(
            (s) => s.siteId === siteId && s.state === 'disabled',
        )
    },
})
feature('category creation remains private until explicitly published', {
    when() {
        categoryId = run(F + 'store#Category', {
            siteId,
            name: 'Community',
        }).contactListId
        return run(F + 'get#Category', { siteId, contactListId: categoryId })
    },
    then(result) {
        result.category.publicationState === 'disabled'
        result.category.visibility === 'members'
    },
})
feature('publish explicit site and category; reject stale policy revisions', {
    when() {
        run(S + 'update#Site', {
            siteId,
            state: 'published',
            name: 'PASS test',
            expectedRevision: 1,
        })
        run(F + 'set#CategoryAccess', {
            siteId,
            contactListId: categoryId,
            visibility: 'public',
            publicationState: 'published',
            confirm: true,
            expectedRevision: 1,
        })
        return {
            error: errors(F + 'set#CategoryAccess', {
                siteId,
                contactListId: categoryId,
                visibility: 'public',
                publicationState: 'published',
                confirm: true,
                expectedRevision: 1,
            }),
        }
    },
    then({ error }) {
        error.includes('reload')
    },
})
feature('write is idempotent and body is sanitized', {
    when() {
        const input = {
            siteId,
            contactListId: categoryId,
            title: 'Hello forum',
            body: '<p>Hello</p><script>alert(1)</script>',
            operationId: 'forum-test-001',
        }
        const first = run(F + 'publish#Post', input)
        rootId = first.rootCommEventId
        const retry = run(F + 'publish#Post', input)
        const posts = run(F + 'get#Posts', { siteId, rootCommEventId: rootId })
        return {
            first,
            retry,
            posts,
            conflict: errors(F + 'publish#Post', {
                ...input,
                body: 'Different',
            }),
        }
    },
    then({ first, retry, posts, conflict }) {
        first.postId === retry.postId
        posts.postList.length === 1
        !posts.postList[0].body.includes('<script')
        conflict.includes('different input')
    },
})
feature('facades refuse actor overrides and cross-site identifiers', {
    when() {
        return {
            unsafe: errors(F + 'find#Topics', { siteId, fromPartyId: 'OTHER' }),
            wrong: errors(F + 'get#Topic', {
                siteId: 'OTHER',
                rootCommEventId: rootId,
            }),
        }
    },
    then({ unsafe, wrong }) {
        unsafe.includes('Unsupported field')
        wrong.includes('not found')
    },
})
feature('GET does not mark read; explicit marker uses revision checks', {
    when() {
        run(F + 'get#Posts', { siteId, rootCommEventId: rootId })
        const before = ec.entity
            .find('mantle.forum.ForumTopicUser')
            .disableAuthz()
            .condition({
                rootCommEventId: rootId,
                partyId: ec.user.userAccount.partyId,
            })
            .count()
        const marker = run(F + 'mark#Read', {
            siteId,
            rootCommEventId: rootId,
            ordinal: 1,
            expectedRevision: 0,
            renderedPostIds: [rootId],
        })
        const stale = errors(F + 'mark#Read', {
            siteId,
            rootCommEventId: rootId,
            ordinal: 1,
            expectedRevision: 0,
            renderedPostIds: [rootId],
        })
        return { before, marker, stale }
    },
    then({ before, marker, stale }) {
        before === 0
        marker.marker.markerRevision === 1
        stale.includes('reload')
    },
})
feature('server HTML reading renders the shared authorized projection', {
    when() {
        run(S + 'store#Mounts', {
            siteId,
            expectedRevision: 2,
            mounts: [
                { app: 'forum', pathPrefix: '/forum' },
                { app: 'account', pathPrefix: '/account' },
                { app: 'members', pathPrefix: '/members' },
                { app: 'sites', pathPrefix: '/sites' },
            ],
            hosts: [{ hostname: 'forum.example.test', canonical: true }],
        })
        const rendered = ec.screen
            .makeTest()
            .rootScreen('component://mr-pass/screen/Pass.xml')
            .render(
                'Forum/Topics/List',
                {
                    resolvedSiteId: siteId,
                    publicHost: 'forum.example.test',
                    publicPath: '/forum',
                },
                null,
            )
        return { html: rendered.output, errors: rendered.errorMessages }
    },
    then({ html, errors }) {
        errors.length === 0
        html.includes('Hello forum')
        html.includes('Skip to discussion')
        html.includes('/forum/t/')
    },
})
feature(
    'anonymous reading exposes approved public posts and no raw account fields',
    {
        when() {
            logout()
            const result = run(F + 'get#Posts', {
                siteId,
                rootCommEventId: rootId,
            })
            login('john.doe')
            return { result }
        },
        then({ result }) {
            result.postList.length === 1
            result.postList[0].author.emailAddress === undefined
            result.postList[0].fromPartyId === undefined
        },
    },
)
feature(
    'public authors are queued before delivery and receive no per-post recipient rows',
    {
        when() {
            const was = ec.artifactExecution.disableAuthz()
            let partyId
            try {
                partyId = call('mantle.party.PartyServices.create#Person', {
                    firstName: 'Public',
                    lastName: 'Forum',
                }).partyId
                call('mantle.party.PartyServices.create#PartyUserAccount', {
                    partyId,
                    username: 'pass.public',
                    emailAddress: 'pass.public@example.test',
                    newPassword: 'moqui1!!',
                    newPasswordVerify: 'moqui1!!',
                })
                call('create#mantle.public.PublicSiteParty', {
                    siteId,
                    partyId,
                    state: 'active',
                    role: 'member',
                    revision: 1,
                })
                call('create#mantle.marketing.contact.ContactListParty', {
                    contactListId: categoryId,
                    partyId,
                    fromDate: Date.now() - 60000,
                    statusId: 'CLPT_ACCEPTED',
                })
            } finally {
                if (!was) ec.artifactExecution.enableAuthz()
            }
            login('pass.public', 'moqui1!!')
            const published = run(F + 'publish#Post', {
                siteId,
                contactListId: categoryId,
                title: 'First contribution',
                body: 'Held for review',
                operationId: 'public-post-001',
            })
            const recipientRows = ec.entity
                .find('mantle.party.communication.CommunicationEventParty')
                .disableAuthz()
                .condition({ communicationEventId: published.postId, partyId })
                .count()
            const outbox = ec.entity
                .find('mantle.forum.ForumOutbox')
                .disableAuthz()
                .condition('communicationEventId', published.postId)
                .count()
            logout()
            const concealed = errors(F + 'get#Topic', {
                siteId,
                rootCommEventId: published.rootCommEventId,
            })
            login('john.doe')
            return { published, recipientRows, outbox, concealed }
        },
        then({ published, recipientRows, outbox, concealed }) {
            published.state === 'pending'
            recipientRows === 0
            outbox === 0
            concealed.includes('not found')
        },
    },
)
feature(
    'opaque continuation tokens conceal identity and enforce actor, scope and expiry',
    {
        when() {
            const old = ec.artifactExecution.disableAuthz()
            try {
                for (let ordinal = 2; ordinal <= 31; ordinal++) {
                    const communicationEventId = ec.user.randomString(32)
                    call(
                        'create#mantle.party.communication.CommunicationEvent',
                        {
                            communicationEventId,
                            communicationEventTypeId: 'Message',
                            contactListId: categoryId,
                            rootCommEventId: rootId,
                            fromPartyId: ec.user.userAccount.partyId,
                            subject: 'Cursor fixture',
                            body: 'Visible page ' + ordinal,
                            statusId: 'CeReceived',
                            entryDate: ec.user.nowTimestamp,
                        },
                    )
                    call('create#mantle.forum.ForumPostState', {
                        communicationEventId,
                        rootCommEventId: rootId,
                        ordinal,
                        revision: 1,
                        visibility: 'approved',
                        approvedRevision: 1,
                    })
                }
            } finally {
                if (!old) ec.artifactExecution.enableAuthz()
            }
            const first = run(F + 'get#Posts', {
                    siteId,
                    rootCommEventId: rootId,
                }),
                next = run(F + 'get#Posts', {
                    siteId,
                    rootCommEventId: rootId,
                    cursor: first.nextCursor,
                })
            const scope = errors(F + 'get#Posts', {
                siteId,
                rootCommEventId: rootId,
                around: rootId,
                cursor: first.nextCursor,
            })
            login('pass.public', 'moqui1!!')
            const actor = errors(F + 'get#Posts', {
                siteId,
                rootCommEventId: rootId,
                cursor: first.nextCursor,
            })
            login('john.doe')
            ec.user.setEffectiveTime(Date.now() + 16 * 60000)
            const expired = errors(F + 'get#Posts', {
                siteId,
                rootCommEventId: rootId,
                cursor: first.nextCursor,
            })
            ec.user.setEffectiveTime(null)
            return {
                cursor: first.nextCursor,
                first: first.postList.length,
                last: next.postList[0].ordinal,
                scope,
                actor,
                expired,
            }
        },
        then({ cursor, first, last, scope, actor, expired }) {
            ;/^[A-Za-z0-9_-]{32}$/.test(cursor)
            first === 30
            last === 31
            scope.includes('Invalid cursor')
            actor.includes('Invalid cursor')
            expired.includes('Invalid cursor')
        },
        cleanup() {
            ec.user.setEffectiveTime(null)
        },
    },
)
