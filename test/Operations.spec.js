// S3 operations: previewed retention that changes nothing until applied, checkpointed runs whose failed item is named
// while peers continue, cancel and resume, site and personal exports with manifest checksums and no secrets, expiring
// downloads rechecked at download time, CSV formula neutralization, reviewed erasure that anonymizes, and activity
// aggregates that keep private conversations from category moderators.
const S = 'mantle.public.SiteServices.',
    F = 'mantle.forum.ForumServices.',
    O = 'mantle.forum.OperationServices.',
    M = 'mantle.forum.ModerationServices.'
const op = () => ec.user.randomString(32)
const DAY = 86400000
const party = {}
let siteId = null,
    categoryId,
    topicIds = [],
    deletedPostId,
    exportRunId,
    exportId
function sys(work) {
    const old = ec.artifactExecution.disableAuthz()
    try {
        return work()
    } finally {
        if (!old) ec.artifactExecution.enableAuthz()
    }
}
/* Posting gates are covered elsewhere: every publish starts with the members' posting clocks cleared. */
function postable() {
    if (!siteId) return
    sys(() => {
        for (const v of ec.entity
            .find('mantle.forum.ForumMemberState')
            .condition('siteId', siteId)
            .list()) {
            v.set('lastPostedAt', null)
            v.set('dailyTopics', 0)
            v.set('dailyReplies', 0)
            v.update()
        }
    })
}
const run = (name, input) => (
    /publish#Post$/.test(name) ? postable() : null,
    call(name, {
        input: /publish#Post$|store#Category$|set#Sanction$/.test(name)
            ? { operationId: op(), ...input }
            : input,
    }).result
)
function failure(name, input) {
    try {
        run(name, input)
        return ''
    } catch (error) {
        ec.message.clearErrors()
        return String(error.message)
    }
}
const as = (name, work) => {
    login('pass.ops.' + name, 'moqui1!!')
    try {
        return work()
    } finally {
        login('john.doe')
    }
}
const entity = (name, fields) =>
    sys(() => ec.entity.find(name).condition(fields).one())
const list = (name, fields) =>
    sys(() => Array.from(ec.entity.find(name).condition(fields).list()))
const dispatch = () => sys(() => call(O + 'dispatch#Jobs', {}))
const text = (location) => sys(() => ec.resource.getLocationText(location))
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
feature('a site with members, topics and old operational data', {
    when() {
        party.owner = ec.user.userAccount.partyId
        siteId = run(S + 'create#Site', {
            name: 'Operations',
            ownerPartyId: party.owner,
        }).siteId
        run(S + 'update#Site', {
            siteId,
            state: 'published',
            expectedRevision: 1,
        })
        categoryId = run(F + 'store#Category', {
            siteId,
            name: 'General',
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
            for (const name of ['ana', 'ben', 'cy']) {
                party[name] = call('mantle.party.PartyServices.create#Person', {
                    firstName: name,
                    lastName: 'Operator',
                }).partyId
                call('mantle.party.PartyServices.create#PartyUserAccount', {
                    partyId: party[name],
                    username: 'pass.ops.' + name,
                    emailAddress: name + '.ops@example.test',
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
                call('create#mantle.marketing.contact.ContactListParty', {
                    contactListId: categoryId,
                    partyId: party[name],
                    // Cy moderates the category only.
                    roleTypeId: name === 'cy' ? 'ListModerator' : null,
                    statusId: 'CLPT_ACCEPTED',
                    fromDate: at - 1000,
                })
                call('create#mantle.forum.ForumMemberState', {
                    siteId,
                    partyId: party[name],
                    trustLevel: 'basic',
                    approvedContributions: 10,
                    dailyTopics: 0,
                    dailyReplies: 0,
                    revision: 1,
                })
            }
        })
        for (const [name, title] of [
            ['ana', 'Welcome thread'],
            ['ben', 'Second thread'],
            ['ana', 'Third thread'],
        ])
            topicIds.push(
                as(name, () =>
                    run(F + 'publish#Post', {
                        siteId,
                        contactListId: categoryId,
                        title,
                        body: '<p>' + title + ' body</p>',
                    }),
                ).rootCommEventId,
            )
        deletedPostId = as('ana', () =>
            run(F + 'publish#Post', {
                siteId,
                rootCommEventId: topicIds[1],
                body: '<p>Regrettable reply</p>',
            }),
        ).postId
        sys(() => {
            // Old data past a 30-day period, and one recent delivery that must stay.
            const old = at - 60 * DAY
            const st = ec.entity
                .find('mantle.forum.ForumPostState')
                .condition('communicationEventId', deletedPostId)
                .one()
            st.set('visibility', 'deleted')
            st.set('deletedAt', old)
            st.update()
            const event = ec.entity
                .find('mantle.party.communication.CommunicationEvent')
                .condition('communicationEventId', deletedPostId)
                .one()
            event.set('entryDate', old)
            event.update()
            for (const [deliveryId, dueAt] of [
                ['OPS_OLD_DELIVERY', old],
                ['OPS_NEW_DELIVERY', at - DAY],
            ])
                call('create#mantle.forum.ForumDelivery', {
                    deliveryId,
                    siteId,
                    partyId: party.ben,
                    channel: 'email',
                    state: 'sent',
                    attempts: 1,
                    dueAt,
                    revision: 1,
                })
            call('create#mantle.forum.ForumJobRun', {
                runId: 'OPS_OLD_RUN',
                siteId,
                jobType: 'trust',
                state: 'complete',
                createdAt: old,
                successCount: 1,
                failedCount: 0,
            })
            call('create#mantle.forum.ForumJobItem', {
                runId: 'OPS_OLD_RUN',
                itemId: 'x',
                state: 'complete',
                attempts: 1,
            })
            call('create#mantle.public.PublicSiteInvitation', {
                invitationId: 'OPS_OLD_INVITE',
                tokenHash: 'ops-old-invite-hash',
                siteId,
                emailHash: 'x',
                inviterPartyId: party.owner,
                expiresAt: old,
            })
        })
        return { topics: topicIds.length }
    },
    then({ topics }) {
        topics === 3
    },
})
feature(
    'retention previews and dry runs change nothing; an applied run removes only what is past its period',
    {
        when() {
            const tooShort = failure(O + 'store#RetentionPolicy', {
                siteId,
                deliveryDays: 10,
                expectedRevision: 0,
                reason: 'Too short',
            })
            const stored = run(O + 'store#RetentionPolicy', {
                siteId,
                deliveryDays: 30,
                inboundDays: 0,
                deletedPostDays: 30,
                jobDays: 30,
                invitationDays: 30,
                expectedRevision: 0,
                reason: 'Keep a month',
            })
            const preview = run(O + 'preview#Operation', {
                siteId,
                operation: 'retention',
            })
            const dry = run(O + 'start#Operation', {
                siteId,
                operation: 'retention',
                reason: 'Check',
            })
            dispatch()
            const afterDry = {
                delivery: !!entity('mantle.forum.ForumDelivery', {
                    deliveryId: 'OPS_OLD_DELIVERY',
                }),
                invite: !!entity('mantle.public.PublicSiteInvitation', {
                    invitationId: 'OPS_OLD_INVITE',
                }),
            }
            const unconfirmed = failure(O + 'start#Operation', {
                siteId,
                operation: 'retention',
                dryRun: false,
                reason: 'Apply',
            })
            const applied = run(O + 'start#Operation', {
                siteId,
                operation: 'retention',
                dryRun: false,
                expectedRevision: preview.policyRevision,
                reason: 'Apply',
            })
            dispatch()
            const appliedRun = entity('mantle.forum.ForumJobRun', {
                runId: applied.runId,
            })
            const post = entity('mantle.forum.ForumPostState', {
                communicationEventId: deletedPostId,
            })
            const body = entity(
                'mantle.party.communication.CommunicationEvent',
                {
                    communicationEventId: deletedPostId,
                },
            ).body
            const revisions = list('mantle.forum.ForumPostRevision', {
                communicationEventId: deletedPostId,
            })
            return {
                tooShort,
                stored,
                preview,
                dry,
                afterDry,
                unconfirmed,
                appliedRun,
                oldDelivery: entity('mantle.forum.ForumDelivery', {
                    deliveryId: 'OPS_OLD_DELIVERY',
                }),
                newDelivery: entity('mantle.forum.ForumDelivery', {
                    deliveryId: 'OPS_NEW_DELIVERY',
                }),
                oldRun: entity('mantle.forum.ForumJobRun', {
                    runId: 'OPS_OLD_RUN',
                }),
                invite: entity('mantle.public.PublicSiteInvitation', {
                    invitationId: 'OPS_OLD_INVITE',
                }),
                post,
                body,
                revisions,
            }
        },
        then(r) {
            r.tooShort.includes('30 to 36500')
            r.stored.revision === 1
            r.preview.retention.deliveryDays.count === 1
            r.preview.retention.deletedPostDays.count === 1
            r.preview.retention.inboundDays.count === null
            r.dry.dryRun && r.dry.retention.jobDays.count === 1
            r.afterDry.delivery && r.afterDry.invite
            r.unconfirmed.includes('State changed')
            r.appliedRun.state === 'complete' &&
                Number(r.appliedRun.successCount) === 4
            !r.oldDelivery && !!r.newDelivery
            !r.oldRun && !r.invite
            r.post.visibility === 'deleted' && !!r.post.textRemovedAt
            !r.body
            r.revisions.length > 0 &&
                r.revisions.every(
                    (v) => !v.sourceText && v.publicHistoryAllowed === 'N',
                )
        },
    },
)
feature(
    'a site export names a failed item, finishes the others, and completes after a retry',
    {
        when() {
            const preview = run(O + 'preview#Operation', {
                siteId,
                operation: 'export-site',
            })
            exportRunId = run(O + 'start#Operation', {
                siteId,
                operation: 'export-site',
                reason: 'Portability',
            }).runId
            const config = JSON.parse(
                entity('mantle.forum.ForumJobRun', { runId: exportRunId })
                    .checkpoint,
            )
            exportId = config.exportId
            const root = String(System.getProperty('pass_media_root')).replace(
                /\/$/,
                '',
            )
            const dir = root + '/exports/' + exportId
            // A directory where one topic's file belongs makes that one item fail.
            sys(() =>
                ec.resource
                    .getLocationReference(
                        dir + '/topics/' + topicIds[1] + '.json/blocker',
                    )
                    .putText('x'),
            )
            dispatch()
            const failedRun = entity('mantle.forum.ForumJobRun', {
                runId: exportRunId,
            })
            const items = list('mantle.forum.ForumJobItem', {
                runId: exportRunId,
            })
            sys(() => {
                ec.resource
                    .getLocationReference(
                        dir + '/topics/' + topicIds[1] + '.json/blocker',
                    )
                    .delete()
                ec.resource
                    .getLocationReference(
                        dir + '/topics/' + topicIds[1] + '.json',
                    )
                    .delete()
            })
            run(O + 'manage#Run', {
                siteId,
                runId: exportRunId,
                action: 'retry',
                reason: 'Blocker removed',
            })
            dispatch()
            const doneRun = entity('mantle.forum.ForumJobRun', {
                runId: exportRunId,
            })
            const x = entity('mantle.forum.ForumExport', { exportId })
            const manifest = JSON.parse(text(dir + '/manifest.json'))
            const topicFile = manifest.files.find(
                (f) => f.path === 'topics/' + topicIds[0] + '.json',
            )
            const allText = manifest.files
                .map((f) => text(dir + '/' + f.path))
                .join('\n')
            const download = run(O + 'get#Export', { siteId, exportId })
            const otherUser = as('ben', () =>
                failure(O + 'get#Export', { siteId, exportId }),
            )
            return {
                preview,
                failedRun,
                items,
                doneRun,
                x,
                manifest,
                topicFile,
                topicDigest: sys(() =>
                    ec.resource.digest(dir + '/' + topicFile.path, 'sha256'),
                ),
                zipDigest: sys(() => ec.resource.digest(x.location, 'sha256')),
                allText,
                download,
                otherUser,
            }
        },
        then(r) {
            r.preview.topicCount === 3
            r.failedRun.state === 'failed'
            Number(r.failedRun.failedCount) === 1 &&
                Number(r.failedRun.successCount) === 2
            r.items.some(
                (i) =>
                    i.itemId === topicIds[1] &&
                    i.state === 'failed' &&
                    !!i.errorText,
            )
            r.doneRun.state === 'complete'
            r.x.kind === 'site' && r.x.mimeType === 'application/zip'
            r.manifest.schemaVersion === 1 && r.manifest.siteId === siteId
            r.manifest.files.some((f) => f.path === 'categories.json')
            r.topicFile.sha256 === r.topicDigest
            r.x.checksum === r.zipDigest
            r.allText.includes('Welcome thread body')
            !/tokenHash|password|secret/i.test(r.allText)
            r.download.export.exportId === exportId
            r.otherUser.includes('not found')
        },
    },
)
feature(
    'downloads are refused after expiry or after the requester loses the authority they needed',
    {
        when() {
            // Cy makes a category report as a moderator, then loses the role.
            const report = as('cy', () =>
                run(O + 'export#Report', {
                    siteId,
                    report: 'moderation',
                    contactListId: categoryId,
                }),
            )
            const before = as('cy', () =>
                failure(O + 'get#Export', {
                    siteId,
                    exportId: report.exportId,
                }),
            )
            sys(() => {
                const lp = ec.entity
                    .find('mantle.marketing.contact.ContactListParty')
                    .condition({ contactListId: categoryId, partyId: party.cy })
                    .one()
                lp.set('roleTypeId', null)
                lp.update()
            })
            const after = as('cy', () =>
                failure(O + 'get#Export', {
                    siteId,
                    exportId: report.exportId,
                }),
            )
            sys(() => {
                const x = ec.entity
                    .find('mantle.forum.ForumExport')
                    .condition('exportId', exportId)
                    .one()
                x.set('expiresAt', Date.now() - 1000)
                x.update()
            })
            const expired = failure(O + 'get#Export', { siteId, exportId })
            return { before, after, expired }
        },
        then({ before, after, expired }) {
            before === ''
            after.includes('moderator')
            expired.includes('not found')
        },
    },
)
feature('CSV reports neutralize formula text', {
    when() {
        run(M + 'set#Sanction', {
            siteId,
            targetPartyId: party.ben,
            kind: 'silence',
            reason: '=HYPERLINK("http://x")',
            thruDate: Date.now() + DAY,
        })
        const report = run(O + 'export#Report', {
            siteId,
            report: 'moderation',
        })
        const x = entity('mantle.forum.ForumExport', {
            exportId: report.exportId,
        })
        return { csv: text(x.location) }
    },
    then({ csv }) {
        csv.startsWith('createdAt,action,targetType,targetId,staff,reason')
        csv.includes(`"'=HYPERLINK(""http://x"")"`)
    },
})
feature('cancel stops a run between items; resume finishes it', {
    when() {
        const started = run(O + 'start#Operation', {
            siteId,
            operation: 'rebuild-counters',
            reason: 'Repair',
        })
        run(O + 'manage#Run', {
            siteId,
            runId: started.runId,
            action: 'cancel',
            reason: 'Not now',
        })
        dispatch()
        const cancelled = entity('mantle.forum.ForumJobRun', {
            runId: started.runId,
        })
        run(O + 'manage#Run', {
            siteId,
            runId: started.runId,
            action: 'resume',
            reason: 'Now',
        })
        dispatch()
        const resumed = entity('mantle.forum.ForumJobRun', {
            runId: started.runId,
        })
        return { cancelled, resumed }
    },
    then({ cancelled, resumed }) {
        cancelled.state === 'cancelled' && Number(cancelled.successCount) === 0
        resumed.state === 'complete' && Number(resumed.successCount) === 3
    },
})
feature("a personal export holds only the member's own data", {
    when() {
        const requested = as('ana', () =>
            run(O + 'request#PersonalDataAction', { siteId, kind: 'export' }),
        )
        dispatch()
        const request = entity('mantle.forum.ForumDataRequest', {
            requestId: requested.requestId,
        })
        const root = String(System.getProperty('pass_media_root')).replace(
            /\/$/,
            '',
        )
        const posts = JSON.parse(
            text(root + '/exports/' + request.exportId + '/posts.json'),
        )
        const mine = as('ana', () =>
            run(O + 'find#Exports', { siteId }),
        ).exportList
        const download = as('ana', () =>
            failure(O + 'get#Export', { siteId, exportId: request.exportId }),
        )
        const benDownload = as('ben', () =>
            failure(O + 'get#Export', { siteId, exportId: request.exportId }),
        )
        return { request, posts, mine, download, benDownload }
    },
    then({ request, posts, mine, download, benDownload }) {
        request.state === 'complete'
        posts.length === 3
        posts.every((p) => p.body.length >= 0) &&
            !posts.some((p) => String(p.body).includes('Second thread body'))
        mine.some(
            (x) => x.exportId === request.exportId && x.kind === 'personal',
        )
        download === ''
        benDownload.includes('not found')
    },
})
feature(
    'erasure is confirmed by the member, decided by an owner and anonymizes without deleting',
    {
        when() {
            const unconfirmed = as('ana', () =>
                failure(O + 'request#PersonalDataAction', {
                    siteId,
                    kind: 'erasure',
                }),
            )
            const requested = as('ana', () =>
                run(O + 'request#PersonalDataAction', {
                    siteId,
                    kind: 'erasure',
                    confirm: true,
                    reason: 'Leaving',
                }),
            )
            const duplicate = as('ana', () =>
                failure(O + 'request#PersonalDataAction', {
                    siteId,
                    kind: 'erasure',
                    confirm: true,
                }),
            )
            const memberDecides = as('ben', () =>
                failure(O + 'decide#DataRequest', {
                    siteId,
                    requestId: requested.requestId,
                    decision: 'approved',
                    reason: 'Sure',
                    expectedRevision: 1,
                }),
            )
            const pending = run(O + 'find#DataRequests', { siteId }).requestList
            run(O + 'decide#DataRequest', {
                siteId,
                requestId: requested.requestId,
                decision: 'approved',
                reason: 'Verified request',
                expectedRevision: 1,
            })
            dispatch()
            return {
                unconfirmed,
                requested,
                duplicate,
                memberDecides,
                pending,
                request: entity('mantle.forum.ForumDataRequest', {
                    requestId: requested.requestId,
                }),
                profile: entity('mantle.public.PublicSiteProfile', {
                    siteId,
                    partyId: party.ana,
                }),
                membership: entity('mantle.public.PublicSiteParty', {
                    siteId,
                    partyId: party.ana,
                }),
                party: entity('mantle.party.Party', { partyId: party.ana }),
                topic: entity('mantle.party.communication.CommunicationEvent', {
                    communicationEventId: topicIds[0],
                }),
                audit: list('mantle.forum.ForumModerationAction', {
                    siteId,
                    targetId: party.ana,
                    action: 'erasure-approved',
                }),
            }
        },
        then(r) {
            r.unconfirmed.includes('Confirm')
            r.requested.state === 'requested'
            r.duplicate.includes('already open')
            r.memberDecides.includes('owner')
            r.pending.some(
                (q) =>
                    q.requestId === r.requested.requestId && q.handle === 'ana',
            )
            r.request.state === 'complete'
            r.profile.handle.startsWith('former-') &&
                r.profile.displayName === 'Former member' &&
                !r.profile.bio
            r.membership.state === 'ended'
            !!r.party
            r.topic.fromPartyId === party.ana &&
                r.topic.body.includes('Welcome thread body')
            r.audit.length === 1
        },
    },
)
feature(
    'activity counts readable participation; private conversations stay with site staff',
    {
        when() {
            const owner = run(O + 'get#Activity', { siteId, interval: 'day' })
            sys(() => {
                const lp = ec.entity
                    .find('mantle.marketing.contact.ContactListParty')
                    .condition({ contactListId: categoryId, partyId: party.cy })
                    .one()
                lp.set('roleTypeId', 'ListModerator')
                lp.update()
            })
            const moderator = as('cy', () =>
                run(O + 'get#Activity', {
                    siteId,
                    contactListId: categoryId,
                    interval: 'week',
                }),
            )
            const moderatorSite = as('cy', () =>
                failure(O + 'get#Activity', { siteId }),
            )
            const tooLong = failure(O + 'get#Activity', {
                siteId,
                fromDate: Date.now() - 400 * DAY,
            })
            return { owner, moderator, moderatorSite, tooLong }
        },
        then({ owner, moderator, moderatorSite, tooLong }) {
            owner.participation.topics === 3
            owner.participation.contributors === 2
            owner.privateConversations != null && owner.delivery != null
            owner.buckets.length === 30
            moderator.privateConversations === null &&
                moderator.delivery === null
            moderator.notes.some((n) => n.includes('site staff'))
            moderator.participation.topics === 3
            moderatorSite.includes('moderator')
            tooLong.includes('366 days')
        },
    },
)
