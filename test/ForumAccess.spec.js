const S = 'mantle.public.SiteServices.',
    F = 'mantle.forum.ForumServices.',
    M = 'mantle.forum.ModerationServices.'
const run = (name, input) =>
    call(name, {
        input: name.endsWith('store#Category')
            ? { operationId: ec.user.randomString(32), ...input }
            : input,
    }).result
const party = {}
let siteId, parentId, childId, helpId, helpPost, reviewId
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
feature('a public child never widens an unpublished or restricted ancestor', {
    when() {
        siteId = run(S + 'create#Site', {
            name: 'Access matrix',
            ownerPartyId: ec.user.userAccount.partyId,
        }).siteId
        run(S + 'update#Site', {
            siteId,
            state: 'published',
            expectedRevision: 1,
        })
        parentId = run(F + 'store#Category', {
            siteId,
            name: 'Restricted parent',
        }).contactListId
        childId = run(F + 'store#Category', {
            siteId,
            name: 'Public child',
            parentContactListId: parentId,
        }).contactListId
        run(F + 'set#CategoryAccess', {
            siteId,
            contactListId: childId,
            visibility: 'public',
            publicationState: 'published',
            expectedRevision: 1,
            confirm: true,
        })
        logout()
        const disabled = failure(F + 'get#Category', {
            siteId,
            contactListId: childId,
        })
        login('john.doe')
        run(F + 'set#CategoryAccess', {
            siteId,
            contactListId: parentId,
            visibility: 'category',
            publicationState: 'published',
            expectedRevision: 1,
            confirm: true,
        })
        logout()
        const restricted = failure(F + 'get#Category', {
            siteId,
            contactListId: childId,
        })
        login('john.doe')
        return { disabled, restricted }
    },
    then({ disabled, restricted }) {
        disabled.includes('not found')
        restricted.includes('not found')
    },
})
feature(
    'category staff cannot bypass the ancestor ceiling or an ended site membership',
    {
        when() {
            sys(() => {
                for (const name of ['alice', 'bob']) {
                    party[name] = call(
                        'mantle.party.PartyServices.create#Person',
                        { firstName: name, lastName: 'Public' },
                    ).partyId
                    call('mantle.party.PartyServices.create#PartyUserAccount', {
                        partyId: party[name],
                        username: 'pass.access.' + name,
                        emailAddress: name + '@example.test',
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
                }
                call('create#mantle.marketing.contact.ContactListParty', {
                    contactListId: childId,
                    partyId: party.alice,
                    statusId: 'CLPT_ACCEPTED',
                    roleTypeId: 'ListModerator',
                    fromDate: at - 1000,
                })
            })
            login('pass.access.alice', 'moqui1!!')
            const ceiling = failure(F + 'get#Category', {
                siteId,
                contactListId: childId,
            })
            login('john.doe')
            run(S + 'set#Membership', {
                siteId,
                targetPartyId: party.alice,
                state: 'ended',
                expectedRevision: 1,
                reason: 'Membership revoked',
            })
            login('pass.access.alice', 'moqui1!!')
            const ended = failure(F + 'get#Category', {
                siteId,
                contactListId: childId,
            })
            return { ceiling, ended }
        },
        then({ ceiling, ended }) {
            ceiling.includes('not found')
            ended.includes('not found')
        },
    },
)
feature(
    'help threads are visible only to the current member who participates',
    {
        when() {
            helpId = run(F + 'store#Category', {
                siteId,
                name: 'Help',
            }).contactListId
            run(F + 'set#CategoryAccess', {
                siteId,
                contactListId: helpId,
                visibility: 'help',
                publicationState: 'published',
                expectedRevision: 1,
                confirm: true,
            })
            sys(() => {
                const list = ec.entity
                    .find('mantle.marketing.contact.ContactList')
                    .condition('contactListId', helpId)
                    .one()
                list.set('postingEnumId', 'ClpAnyUser')
                list.update()
            })
            login('pass.access.bob', 'moqui1!!')
            helpPost = run(F + 'publish#Post', {
                siteId,
                contactListId: helpId,
                title: 'Private help request',
                body: 'Sensitive help body',
                operationId: 'access-help-001',
            }).postId
            const own = run(F + 'get#Posts', {
                siteId,
                rootCommEventId: helpPost,
            }).postList.length
            login('john.doe')
            run(S + 'set#Membership', {
                siteId,
                targetPartyId: party.alice,
                state: 'active',
                expectedRevision: 2,
                reason: 'Restore membership',
            })
            login('pass.access.alice', 'moqui1!!')
            const other = failure(F + 'get#Topic', {
                siteId,
                rootCommEventId: helpPost,
            })
            return { own, other }
        },
        then({ own, other }) {
            own === 1
            other.includes('not found')
        },
    },
)
feature(
    'pending edits invalidate review evidence and staff notes remain private',
    {
        when() {
            const review = run(M + 'find#Reviews', {
                siteId,
                contactListId: helpId,
            }).reviewList.find((r) => r.targetId === helpPost)
            reviewId = review.reviewId
            const claim = run(M + 'claim#Review', {
                siteId,
                reviewId,
                expectedRevision: review.revision,
            })
            const note = run(M + 'add#ReviewNote', {
                siteId,
                reviewId,
                body: 'Private evidence review',
                operationId: 'access-note-001',
            })
            login('pass.access.bob', 'moqui1!!')
            run(F + 'update#Post', {
                siteId,
                postId: helpPost,
                body: 'Revised sensitive help',
                expectedRevision: 1,
            })
            const privateNote = failure(M + 'get#Review', { siteId, reviewId })
            login('john.doe')
            const stale = failure(M + 'decide#Review', {
                siteId,
                reviewId,
                expectedRevision: claim.revision,
                decision: 'approved',
                reason: 'Stale evidence',
            })
            const current = run(M + 'get#Review', { siteId, reviewId })
            return {
                stale,
                privateNote,
                notes: current.notes.length,
                revision: current.post.revision,
            }
        },
        then({ stale, privateNote, notes, revision }) {
            stale.includes('reload')
            privateNote.includes('Scoped moderator')
            notes === 1
            revision === 2
        },
    },
)
feature('the last owner cannot leave or be ended', {
    when() {
        const mine = ec.user.userAccount.partyId
        return {
            leave: failure(S + 'leave#Site', { siteId, expectedRevision: 1 }),
            end: failure(S + 'set#Membership', {
                siteId,
                targetPartyId: mine,
                state: 'ended',
                expectedRevision: 1,
                reason: 'Attempt last-owner removal',
            }),
        }
    },
    then({ leave, end }) {
        leave.includes('another active owner')
        end.includes('another active owner')
    },
})
feature(
    'category moves rebind review scope and conceal old evidence from former category staff',
    {
        when() {
            sys(() =>
                call('create#mantle.marketing.contact.ContactListParty', {
                    contactListId: helpId,
                    partyId: party.alice,
                    statusId: 'CLPT_ACCEPTED',
                    roleTypeId: 'ListModerator',
                    fromDate: at - 1000,
                }),
            )
            const target = run(F + 'store#Category', {
                siteId,
                name: 'Restricted destination',
            }).contactListId
            run(F + 'set#CategoryAccess', {
                siteId,
                contactListId: target,
                visibility: 'category',
                publicationState: 'published',
                expectedRevision: 1,
                confirm: true,
            })
            const preview = run(M + 'preview#TopicAction', {
                siteId,
                rootCommEventId: helpPost,
                targetContactListId: target,
            })
            run(M + 'apply#TopicAction', {
                siteId,
                rootCommEventId: helpPost,
                targetContactListId: target,
                action: 'category',
                expectedRevision: preview.expectedRevision,
                expectedGeneration: preview.expectedGeneration,
                confirmAudience: true,
                reason: 'Restrict the help request audience',
            })
            const category = ec.entity
                .find('mantle.forum.ForumReviewItem')
                .disableAuthz()
                .condition('reviewId', reviewId)
                .one().contactListId
            const ordinal = run(F + 'get#Posts', {
                siteId,
                rootCommEventId: helpPost,
            }).postList[0].ordinal
            login('pass.access.alice', 'moqui1!!')
            const evidence = failure(M + 'get#Review', { siteId, reviewId }),
                audit = run(M + 'find#Actions', {
                    siteId,
                    contactListId: helpId,
                }).actionList
            return {
                category,
                target,
                ordinal,
                evidence,
                leaked: audit.some(
                    (action) =>
                        action.targetId === helpPost ||
                        action.targetId === reviewId,
                ),
            }
        },
        then({ category, target, ordinal, evidence, leaked }) {
            category === target
            ordinal === 1
            evidence.includes('not found')
            leaked === false
        },
    },
)

feature(
    'category membership decisions require current revisions and reauthentication for roles',
    {
        when() {
            login('john.doe')
            const input = {
                siteId,
                contactListId: helpId,
                targetPartyId: party.bob,
                state: 'active',
                reason: 'Category participation',
            }
            const missingRevision = failure(F + 'set#CategoryMember', input)
            const added = run(F + 'set#CategoryMember', {
                ...input,
                expectedRevision: 0,
            })
            const stale = failure(F + 'set#CategoryMember', {
                ...input,
                expectedRevision: 0,
            })
            const noAuth = failure(F + 'set#CategoryMember', {
                ...input,
                expectedRevision: added.revision,
                roleTypeId: 'ListModerator',
            })
            const current = run(F + 'find#CategoryMembers', {
                siteId,
                contactListId: helpId,
            }).memberList.find((m) => m.partyId === party.bob)
            return { missingRevision, added, stale, noAuth, current }
        },
        then({ missingRevision, added, stale, noAuth, current }) {
            missingRevision.includes('State changed')
            added.revision === 1
            stale.includes('State changed')
            noAuth.length > 0
            current.revision === 1
            current.roleTypeId == null
        },
    },
)
feature('site pages expose only their explicitly approved wiki version', {
    when() {
        login('john.doe')
        const wiki = (verb, input) =>
            call('org.moqui.impl.WikiServices.' + verb, input)
        let wikiPageId, first, second
        sys(() => {
            wiki('create#WikiSpace', {
                wikiSpaceId: 'PASSWIKI',
                description: 'Public page publication fixture',
            })
            wikiPageId = wiki('update#WikiPage', {
                wikiSpaceId: 'PASSWIKI',
                pageName: 'Guidelines',
                pageText: 'Approved guidelines\n',
            }).wikiPageId
            first = wiki('get#WikiPageHistory', { wikiPageId }).versionList[0]
                .versionName
            wiki('set#PublishedVersion', {
                wikiPageId,
                publishedVersionName: first,
            })
        })
        run(S + 'publish#SitePage', {
            siteId,
            pageRole: 'guidelines',
            wikiPageId,
            versionName: first,
            expectedRevision: 0,
        })
        sys(() => {
            wiki('update#WikiPage', {
                wikiSpaceId: 'PASSWIKI',
                wikiPageId,
                pageName: 'Guidelines',
                pageText: 'Unapproved replacement\n',
            })
            second = wiki('get#WikiPageHistory', { wikiPageId }).versionList[0]
                .versionName
        })
        logout()
        const body = run(S + 'get#SitePage', { siteId, pageRole: 'guidelines' })
            .page.body
        login('john.doe')
        sys(() =>
            wiki('set#PublishedVersion', {
                wikiPageId,
                publishedVersionName: second,
            }),
        )
        logout()
        const changed = failure(S + 'get#SitePage', {
            siteId,
            pageRole: 'guidelines',
        })
        login('john.doe')
        return { body, changed, first, second }
    },
    then({ body, changed, first, second }) {
        first !== second
        body.includes('Approved guidelines')
        !body.includes('Unapproved replacement')
        changed.includes('not found')
    },
})

feature(
    'the last bound category owner cannot leave through a legacy mailbox service',
    {
        when() {
            login('john.doe')
            const left = failure(F + 'leave#Category', {
                siteId,
                contactListId: helpId,
            })
            return { left }
        },
        then({ left }) {
            left.includes('another active category owner') ||
                left.includes('last owner of a mailbox')
        },
    },
)
