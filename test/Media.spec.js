const S = 'mantle.public.SiteServices.',
    F = 'mantle.forum.ForumServices.'
const run = (name, input) => call(name, { input }).result
let siteId, categoryId, cleanId, badId, rootId
const started = Date.now()
function failure(work) {
    try {
        work()
        return ''
    } catch (error) {
        ec.message.clearErrors()
        return String(error.message)
    }
}
function upload(text) {
    return ec.resource
        .script('component://mr-mantle/service/mantle/forum/Forum.js')
        .execute('stageAttachment', {
            siteId,
            contactListId: categoryId,
            file: {
                name: 'fixture.txt',
                size: text.length,
                contentType: 'text/plain',
                write(location) {
                    ec.resource.getLocationReference(location).putText(text)
                },
            },
        }).attachment
}
spec({
    stepwise: true,
    setupSpec() {
        login('john.doe')
        ec.user.setEffectiveTime(started)
    },
    cleanupSpec() {
        login('john.doe')
    },
})
feature('staging is actor-owned and scanner rejection is quarantined', {
    when() {
        siteId = run(S + 'create#Site', {
            name: 'Media fixture',
            ownerPartyId: ec.user.userAccount.partyId,
        }).siteId
        run(S + 'update#Site', {
            siteId,
            state: 'published',
            expectedRevision: 1,
        })
        categoryId = run(F + 'store#Category', {
            siteId,
            name: 'Media',
            operationId: 'media-category-001',
        }).contactListId
        run(F + 'set#CategoryAccess', {
            siteId,
            contactListId: categoryId,
            visibility: 'public',
            publicationState: 'published',
            confirm: true,
            expectedRevision: 1,
        })
        const old = ec.artifactExecution.disableAuthz()
        let clean, bad
        try {
            clean = upload('clean fixture')
            bad = upload('quarantine fixture')
        } finally {
            if (!old) ec.artifactExecution.enableAuthz()
        }
        cleanId = clean.attachmentId
        badId = bad.attachmentId
        const staged = failure(() =>
            run(F + 'get#Attachment', { siteId, attachmentId: cleanId }),
        )
        return { clean, bad, staged }
    },
    then({ clean, bad, staged }) {
        clean.scanState === 'clean'
        bad.scanState === 'quarantined'
        staged.includes('not found')
    },
})
feature(
    'failed finalization rolls back post, revision, receipt and outbox together',
    {
        when() {
            const operationId = 'media-rollback-001',
                error = failure(() =>
                    run(F + 'publish#Post', {
                        siteId,
                        contactListId: categoryId,
                        title: 'Atomic failure',
                        body: 'Must roll back',
                        operationId,
                        attachmentIds: [cleanId, badId],
                    }),
                )
            const count = (name) =>
                ec.entity
                    .find(name)
                    .disableAuthz()
                    .condition('siteId', siteId)
                    .count()
            const state = ec.entity
                .find('mantle.forum.ForumAttachment')
                .disableAuthz()
                .condition('attachmentId', cleanId)
                .one()
            return {
                error,
                topics: count('mantle.forum.ForumTopic'),
                outbox: count('mantle.forum.ForumOutbox'),
                receipts: count('mantle.forum.ForumOperationReceipt'),
                bound: state.communicationEventId,
            }
        },
        then({ error, topics, outbox, receipts, bound }) {
            error.includes('scanning')
            topics === 0
            outbox === 0
            receipts === 1
            bound === null
        },
    },
)
feature(
    'downloads follow current publication and abandoned staging expires after seven days',
    {
        when() {
            rootId = run(F + 'publish#Post', {
                siteId,
                contactListId: categoryId,
                title: 'Attached',
                body: 'Safe file',
                operationId: 'media-valid-001',
                attachmentIds: [cleanId],
            }).rootCommEventId
            logout()
            const visible = run(F + 'get#Attachment', {
                siteId,
                attachmentId: cleanId,
            }).attachment.filename
            login('john.doe')
            run(F + 'set#CategoryAccess', {
                siteId,
                contactListId: categoryId,
                visibility: 'members',
                publicationState: 'published',
                confirm: true,
                expectedRevision: 2,
            })
            logout()
            const hidden = failure(() =>
                run(F + 'get#Attachment', { siteId, attachmentId: cleanId }),
            )
            login('john.doe')
            ec.user.setEffectiveTime(started + 8 * 86400000)
            const cleanup = call(
                'mantle.forum.MediaWorkerServices.cleanup#StagedAttachments',
                {},
            )
            return {
                visible,
                hidden,
                removed: cleanup.removedCount,
                remaining: ec.entity
                    .find('mantle.forum.ForumAttachment')
                    .disableAuthz()
                    .condition('attachmentId', badId)
                    .count(),
            }
        },
        then({ visible, hidden, removed, remaining }) {
            visible === 'fixture.txt'
            hidden.includes('not found')
            removed === 1
            remaining === 0
        },
    },
)

feature(
    'profile avatars finalize only scanned actor-owned images and follow profile visibility',
    {
        when() {
            login('john.doe')
            const old = ec.artifactExecution.disableAuthz()
            let attachment
            try {
                attachment = ec.resource
                    .script(
                        'component://mr-mantle/service/mantle/forum/Forum.js',
                    )
                    .execute('stageAttachment', {
                        siteId,
                        purpose: 'avatar',
                        file: {
                            name: 'avatar.png',
                            size: 13,
                            contentType: 'image/png',
                            write(location) {
                                ec.resource
                                    .getLocationReference(location)
                                    .putText('fixture image')
                            },
                        },
                    }).attachment
            } finally {
                if (!old) ec.artifactExecution.enableAuthz()
            }
            const profile = run(S + 'store#Profile', {
                siteId,
                handle: 'media-owner',
                displayName: 'Media owner',
                discoverability: 'hidden',
                avatarId: attachment.attachmentId,
                expectedRevision: 0,
            }).profile
            const owner = run(F + 'get#Attachment', {
                siteId,
                attachmentId: attachment.attachmentId,
            }).attachment
            const remove = failure(() =>
                run(F + 'remove#StagedAttachment', {
                    siteId,
                    attachmentId: attachment.attachmentId,
                }),
            )
            logout()
            const hidden = failure(() =>
                run(F + 'get#Attachment', {
                    siteId,
                    attachmentId: attachment.attachmentId,
                }),
            )
            login('john.doe')
            run(S + 'store#Profile', {
                siteId,
                handle: profile.handle,
                displayName: profile.displayName,
                discoverability: 'public',
                expectedRevision: profile.revision,
            })
            logout()
            const visible = run(F + 'get#Attachment', {
                siteId,
                attachmentId: attachment.attachmentId,
            }).attachment.filename
            login('john.doe')
            const state = ec.entity
                .find('mantle.forum.ForumAttachment')
                .condition('attachmentId', attachment.attachmentId)
                .disableAuthz()
                .one()
            return {
                profile,
                owner,
                remove,
                hidden,
                visible,
                expiry: state.expiresAt,
                body: state.communicationEventId,
            }
        },
        then({ profile, owner, remove, hidden, visible, expiry, body }) {
            profile.avatarId === owner.attachmentId
            remove.includes('not found')
            hidden.includes('not found')
            visible === 'avatar.png'
            expiry == null
            body == null
        },
    },
)

feature(
    'post attachment removal is atomic and profile media cannot be republished as post media',
    {
        when() {
            login('john.doe')
            const removed = run(F + 'update#Post', {
                siteId,
                postId: rootId,
                body: 'Removed the old attachment',
                reason: 'Remove attachment',
                expectedRevision: 1,
                attachmentIds: [],
            })
            const hidden = failure(() =>
                run(F + 'get#Attachment', { siteId, attachmentId: cleanId }),
            )
            const avatar = run(S + 'get#Profile', {
                siteId,
                handle: 'media-owner',
            }).profile.avatarId
            const refused = failure(() =>
                run(F + 'update#Post', {
                    siteId,
                    postId: rootId,
                    body: 'Do not republish profile media',
                    reason: 'Try forbidden media reuse',
                    expectedRevision: 2,
                    attachmentIds: [avatar],
                }),
            )
            const state = ec.entity
                .find('mantle.forum.ForumPostState')
                .condition('communicationEventId', rootId)
                .disableAuthz()
                .one()
            return {
                removed,
                hidden,
                refused,
                revision: Number(state.revision),
            }
        },
        then({ removed, hidden, refused, revision }) {
            removed.revision === 2
            hidden.includes('not found')
            refused.includes('scanning')
            revision === 2
        },
    },
)
