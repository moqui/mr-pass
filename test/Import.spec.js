// S3 Discourse migration: a synthetic Discourse backup (pg_dump COPY blocks and an uploads tree) is registered by an
// operator with its checksum, staged, preflighted for staff, identity, group and plugin decisions, imported into a
// disabled site with a bad upload named while its peers succeed, replayed without duplicates, a changed source row
// resolved explicitly, reconciled, approved by the operator and a site owner and activated; legacy URLs then resolve
// after current access checks. Nothing sends mail and no imported account joins an internal group.
const S = 'mantle.public.SiteServices.',
    F = 'mantle.forum.ForumServices.',
    I = 'mantle.forum.ImportServices.',
    O = 'mantle.forum.OperationServices.'
const party = {}
let siteId, importId, replayId, changedId, dir
function sys(work) {
    const old = ec.artifactExecution.disableAuthz()
    try {
        return work()
    } finally {
        if (!old) ec.artifactExecution.enableAuthz()
    }
}
const run = (name, input) => call(name, { input }).result
function failure(name, input) {
    try {
        run(name, input)
        return ''
    } catch (error) {
        ec.message.clearErrors()
        return String(error.message)
    }
}
const entity = (name, fields) => sys(() => ec.entity.find(name).condition(fields).one())
const list = (name, fields) => sys(() => Array.from(ec.entity.find(name).condition(fields).list()))
const count = (name, fields) => sys(() => ec.entity.find(name).condition(fields).count())
/* Every pending operation run advanced until none has work left. */
function dispatchAll() {
    for (let i = 0; i < 20; i++) if (!sys(() => call(O + 'dispatch#Jobs', { budget: 500 })).processed) return
}
const mapOf = (sourceType, sourceId) =>
    entity('mantle.forum.ForumImportMap', { siteId, sourceType, sourceId: String(sourceId) })
const target = (sourceType, sourceId) => mapOf(sourceType, sourceId)?.targetId
function base62(hex) {
    const digits = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'
    let n = BigInt('0x' + hex),
        out = ''
    while (n > 0n) {
        out = digits[Number(n % 62n)] + out
        n /= 62n
    }
    return out
}
/* A Discourse-shaped dump: COPY blocks, tab-separated, backslash escapes, \N for null. */
function dump(sha1, firstSubBody) {
    const copy = (table, columns, rows) =>
        'COPY public.' + table + ' (' + columns.join(', ') + ') FROM stdin;\n' +
        rows.map((r) => r.join('\t')).join('\n') + (rows.length ? '\n' : '') + '\\.\n'
    const N = '\\N'
    return [
        '-- PostgreSQL database dump\n',
        'CREATE TABLE public.users (id integer);\n',
        copy('backup_metadata', ['id', 'name', 'value'], [['1', 'db_name', 'default']]),
        copy('users', ['id', 'username', 'username_lower', 'name', 'active', 'admin', 'moderator', 'trust_level', 'created_at', 'suspended_till'], [
            ['-1', 'system', 'system', 'system', 't', 't', 'f', '4', '2020-01-01 00:00:00', N],
            ['1', 'alice', 'alice', 'Alice Admin', 't', 't', 'f', '4', '2020-01-01 00:00:00.123456', N],
            ['2', 'bob', 'bob', 'Bob Builder', 't', 'f', 'f', '2', '2020-02-01 00:00:00', N],
            ['3', 'carol', 'carol', N, 't', 'f', 'f', '1', '2020-03-01 00:00:00', N],
            ['4', 'dave', 'dave', 'Dave Duplicate', 't', 'f', 'f', '1', '2020-03-01 00:00:00', N],
        ]),
        copy('user_emails', ['id', 'user_id', 'email', '"primary"'], [
            ['1', '1', 'alice@dsc.example.test', 't'],
            ['2', '2', 'bob@dsc.example.test', 't'],
            ['3', '4', 'dave@dsc.example.test', 't'],
        ]),
        copy('user_profiles', ['user_id', 'bio_raw'], [['2', 'I build **things**']]),
        copy('groups', ['id', 'name'], [['0', 'everyone'], ['10', 'insiders']]),
        copy('group_users', ['id', 'group_id', 'user_id'], [['1', '10', '2']]),
        copy('categories', ['id', 'name', 'slug', 'description', 'parent_category_id', 'position', 'read_restricted'], [
            ['3', 'Sub', 'sub', 'A subcategory', '1', '3', 'f'],
            ['1', 'General', 'general', 'General talk', N, '1', 'f'],
            ['2', 'Insiders', 'insiders', 'Members only', N, '2', 't'],
        ]),
        copy('category_groups', ['id', 'category_id', 'group_id', 'permission_type'], [['1', '2', '10', '1']]),
        copy('topics', ['id', 'title', 'slug', 'user_id', 'category_id', 'archetype', 'visible', 'closed', 'deleted_at', 'pinned_at', 'created_at', 'bumped_at', 'highest_post_number'], [
            ['10', 'Hello world', 'hello-world', '2', '1', 'regular', 't', 'f', N, N, '2021-01-01 10:00:00', '2021-01-02 10:00:00', '3'],
            ['11', 'Secret plans', 'secret-plans', '2', '2', 'regular', 't', 'f', N, N, '2021-01-03 10:00:00', '2021-01-03 10:00:00', '1'],
            ['12', 'Sub topic', 'sub-topic', '3', '3', 'regular', 't', 't', N, N, '2021-01-04 10:00:00', '2021-01-04 10:00:00', '1'],
            ['13', 'Private chat', 'private-chat', '1', N, 'private_message', 't', 'f', N, N, '2021-01-05 10:00:00', '2021-01-05 10:00:00', '2'],
        ]),
        copy('posts', ['id', 'topic_id', 'user_id', 'post_number', 'reply_to_post_number', 'raw', 'post_type', 'deleted_at', 'hidden', 'wiki', 'created_at'], [
            ['100', '10', '2', '1', N, 'Hello **world**\\n\\n![photo|100x100](upload://' + base62(sha1) + '.png)', '1', N, 'f', 'f', '2021-01-01 10:00:00'],
            ['102', '10', '1', '3', '2', 'Deleted reply', '1', '2021-01-02 09:00:00', 'f', 'f', '2021-01-02 08:00:00'],
            ['101', '10', '3', '2', '1', 'I agree <script>alert(1)</script>', '1', N, 'f', 'f', '2021-01-01 11:00:00'],
            ['103', '11', '2', '1', N, 'Insiders only', '1', N, 'f', 'f', '2021-01-03 10:00:00'],
            ['104', '12', '3', '1', N, firstSubBody, '1', N, 'f', 'f', '2021-01-04 10:00:00'],
            ['105', '13', '1', '1', N, 'Private hello', '1', N, 'f', 'f', '2021-01-05 10:00:00'],
            ['106', '13', '2', '2', '1', 'Private reply', '1', N, 'f', 'f', '2021-01-05 11:00:00'],
        ]),
        copy('topic_allowed_users', ['id', 'topic_id', 'user_id'], [['1', '13', '1'], ['2', '13', '2']]),
        copy('uploads', ['id', 'user_id', 'original_filename', 'filesize', 'url', 'sha1'], [
            ['1', '2', 'photo.png', '12', '/uploads/default/original/1X/' + sha1 + '.png', sha1],
            ['2', '3', 'broken.png', '12', '/uploads/default/original/1X/' + 'b'.repeat(40) + '.png', 'c'.repeat(40)],
        ]),
        copy('upload_references', ['id', 'upload_id', 'target_type', 'target_id'], [['1', '1', 'Post', '100'], ['2', '2', 'Post', '101']]),
        copy('post_actions', ['id', 'post_id', 'user_id', 'post_action_type_id', 'deleted_at', 'created_at'], [
            ['1', '100', '3', '2', N, '2021-01-01 12:00:00'],
            ['2', '100', '2', '2', N, '2021-01-01 12:00:00'],
            ['3', '101', '2', '8', N, '2021-01-01 12:00:00'],
        ]),
        copy('tags', ['id', 'name', 'description'], [['1', 'intro', N]]),
        copy('topic_tags', ['id', 'topic_id', 'tag_id'], [['1', '10', '1']]),
        copy('discourse_solved_solved_topics', ['id', 'topic_id', 'answer_post_id'], [['1', '10', '101']]),
        copy('polls', ['id', 'post_id', 'name', 'type', 'status', 'results', 'visibility', 'max', 'close_at'], [['1', '104', 'poll', 'regular', 'open', 'always', 'secret', N, N]]),
        copy('poll_options', ['id', 'poll_id', 'html'], [['1', '1', 'Yes'], ['2', '1', 'No']]),
        copy('poll_votes', ['poll_id', 'poll_option_id', 'user_id'], [['1', '1', '2']]),
        copy('topic_users', ['id', 'topic_id', 'user_id', 'last_read_post_number', 'notification_level'], [['1', '10', '2', '3', '3']]),
        copy('bookmarks', ['id', 'user_id', 'bookmarkable_type', 'bookmarkable_id', 'name', 'reminder_at', 'created_at'], [['1', '2', 'Post', '101', 'good', N, '2021-01-06 10:00:00']]),
        copy('permalinks', ['id', 'url', 'topic_id', 'post_id', 'category_id'], [['1', 'old/forum/thread/77', '10', N, N]]),
        copy('discourse_reactions_reactions', ['id', 'post_id'], [['1', '100']]),
    ].join('')
}
/* Writes a backup archive into the import directory and returns its name and SHA-256. */
function archive(name, firstSubBody) {
    return sys(() => {
        const root = String(System.getProperty('pass_import_dir')).replace(/\/$/, '')
        const work = root + '/work-' + name
        const image = 'fake png bytes'
        ec.resource.getLocationReference(work + '/photo.png').putText(image)
        const sha1 = ec.resource.digest(work + '/photo.png', 'sha1')
        ec.resource.getLocationReference(work + '/broken.png').putText('not what the sha1 says')
        ec.resource.getLocationReference(work + '/dump.sql').putText(dump(sha1, firstSubBody))
        ec.resource.writeTarGz(root + '/' + name, [
            { path: 'dump.sql', location: work + '/dump.sql' },
            { path: 'uploads/default/original/1X/' + sha1 + '.png', location: work + '/photo.png' },
            { path: 'uploads/default/original/1X/' + 'b'.repeat(40) + '.png', location: work + '/broken.png' },
        ])
        return { name, checksum: ec.resource.digest(root + '/' + name, 'sha256'), sha1 }
    })
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
feature('an operator registers a checksummed archive from the import directory only', {
    when() {
        party.owner = ec.user.userAccount.partyId
        siteId = run(S + 'create#Site', { name: 'Imported community', ownerPartyId: party.owner }).siteId
        sys(() => {
            // An existing account that holds one source member's address, and a member who is not an operator.
            for (const [name, email] of [['existing', 'dave@dsc.example.test'], ['member', 'member.imp@example.test']]) {
                party[name] = call('mantle.party.PartyServices.create#Person', { firstName: name, lastName: 'Importer' }).partyId
                call('mantle.party.PartyServices.create#PartyUserAccount', {
                    partyId: party[name],
                    username: 'pass.imp.' + name,
                    emailAddress: email,
                    newPassword: 'moqui1!!',
                    newPasswordVerify: 'moqui1!!',
                })
                const userId = ec.entity.find('moqui.security.UserAccount').condition('username', 'pass.imp.' + name).one().userId
                call('create#moqui.security.public.VerifiedAddress', { userId, emailAddress: email, verifiedAt: at })
            }
            call('create#mantle.public.PublicSiteParty', { siteId, partyId: party.member, state: 'active', role: 'owner', joinedAt: at, revision: 1 })
        })
        const first = archive('community-2024-01-01-000000-v3.2.0-20240101000000.tar.gz', 'Sub topic body')
        const traversal = failure(I + 'register#Import', { siteId, archiveName: '../etc/passwd', checksum: first.checksum })
        const wrongSum = failure(I + 'register#Import', { siteId, archiveName: first.name, checksum: 'a'.repeat(64) })
        login('pass.imp.member', 'moqui1!!')
        const notOperator = failure(I + 'register#Import', { siteId, archiveName: first.name, checksum: first.checksum })
        login('john.doe')
        const registered = run(I + 'register#Import', { siteId, archiveName: first.name, checksum: first.checksum, sourceName: 'Old community' })
        importId = registered.importId
        return { traversal, wrongSum, notOperator, registered }
    },
    then({ traversal, wrongSum, notOperator, registered }) {
        traversal.includes('import directory')
        wrongSum.includes('checksum')
        notOperator.includes('operator')
        registered.discourseVersion === '3.2.0' && registered.schemaVersion === '20240101000000'
    },
})
feature('staging reads the dump; preflight blocks unmapped staff, identities, restricted groups and plugins', {
    when() {
        run(I + 'stage#Import', { siteId, importId })
        dispatchAll()
        const detail = run(I + 'get#Import', { siteId, importId })
        return { detail }
    },
    then({ detail }) {
        detail.import.stage === 'staged'
        detail.preflight.counts.posts === 7 && detail.preflight.counts.users === 5
        detail.preflight.counts.post_actions === 2
        detail.preflight.blockers.some((b) => b.type === 'staff' && b.sourceId === '1')
        detail.preflight.blockers.some((b) => b.type === 'identity' && b.sourceId === '4')
        detail.preflight.blockers.some((b) => b.type === 'group' && b.sourceId === '10')
        detail.preflight.blockers.some((b) => b.type === 'feature' && b.sourceId === 'discourse_reactions_reactions')
        !detail.preflight.blockers.some((b) => b.type === 'identity' && b.sourceId === '2')
        detail.preflight.missingUploads === 0
    },
})
feature('mappings resolve the blockers; an identity joins only the account with the same verified address', {
    when() {
        const wrongAccount = failure(I + 'store#ImportMappings', {
            siteId,
            importId,
            mappings: [{ mappingType: 'identity', sourceId: '4', decision: 'map', targetId: party.member }],
        })
        const stored = run(I + 'store#ImportMappings', {
            siteId,
            importId,
            mappings: [
                { mappingType: 'identity', sourceId: '4', decision: 'map', targetId: party.existing },
                { mappingType: 'staff', sourceId: '1', decision: 'owner' },
                { mappingType: 'staff', sourceId: '-1', decision: 'member' },
                { mappingType: 'group', sourceId: '10', decision: 'grant' },
                { mappingType: 'feature', sourceId: 'discourse_reactions_reactions', decision: 'defer', reason: 'Likes cover it' },
            ],
            reason: 'Reviewed',
        })
        return { wrongAccount, stored }
    },
    then({ wrongAccount, stored }) {
        wrongAccount.includes('same verified address')
        stored.blockers === 0
    },
})
feature('the import creates the community in order, names a bad upload and sends nothing', {
    when() {
        run(I + 'run#Import', { siteId, importId, reason: 'Rehearsal' })
        dispatchAll()
        const runId = entity('mantle.forum.ForumImportRun', { importId }).importRunId
        const importRun = entity('mantle.forum.ForumJobRun', { runId })
        const failedItems = list('mantle.forum.ForumJobItem', { runId, state: 'failed' })
        const general = target('categories', '1'),
            insiders = target('categories', '2'),
            sub = target('categories', '3')
        const bob = target('users', '2'),
            dave = target('users', '4'),
            alice = target('users', '1')
        const hello = target('topics', '10'),
            secret = target('topics', '11'),
            chat = target('topics', '13')
        const reply = target('posts', '10:2'),
            deleted = target('posts', '10:3')
        const accounts = list('moqui.security.UserAccount', { partyId: bob })
        return {
            importRun,
            failedItems,
            stage: entity('mantle.forum.ForumImportRun', { importId }).stage,
            subParent: entity('mantle.forum.ForumCategory', { contactListId: sub }).parentContactListId,
            general,
            insidersVisibility: entity('mantle.forum.ForumCategory', { contactListId: insiders }).visibility,
            insidersGrant: count('mantle.public.PublicAccessGrant', { siteId, partyId: bob, targetId: insiders }),
            daveMapped: dave === party.existing,
            aliceRole: entity('mantle.public.PublicSiteParty', { siteId, partyId: alice }).role,
            chatKind: entity('mantle.forum.ForumTopic', { rootCommEventId: chat }).kind,
            participants: list('mantle.forum.ForumParticipant', { rootCommEventId: chat }).map((v) => v.partyId).sort(),
            replyBody: entity('mantle.party.communication.CommunicationEvent', { communicationEventId: reply }).body,
            replyParent: entity('mantle.party.communication.CommunicationEvent', { communicationEventId: reply }).parentCommEventId,
            rootBody: entity('mantle.party.communication.CommunicationEvent', { communicationEventId: hello }).body,
            rootSource: entity('mantle.forum.ForumPostRevision', { communicationEventId: hello, revision: 1 }).sourceText,
            deletedVisibility: entity('mantle.forum.ForumPostState', { communicationEventId: deleted }).visibility,
            attachments: list('mantle.forum.ForumAttachment', { communicationEventId: hello }),
            brokenUpload: mapOf('uploads', '2'),
            likes: list('mantle.forum.ForumReaction', { communicationEventId: hello }),
            tagged: count('mantle.forum.ForumTopicTag', { rootCommEventId: hello }),
            accepted: entity('mantle.forum.ForumTopic', { rootCommEventId: hello }).acceptedAnswerId,
            poll: list('mantle.forum.ForumPoll', { siteId })[0],
            marker: entity('mantle.forum.ForumTopicUser', { rootCommEventId: hello, partyId: bob }),
            bookmark: count('mantle.forum.ForumBookmark', { siteId, partyId: bob }),
            legacy: count('mantle.forum.ForumLegacyUrl', { siteId }),
            outbox: count('mantle.forum.ForumOutbox', { siteId }),
            emailModes: list('mantle.forum.ForumDeliveryPreference', { siteId, scopeType: 'site' }).map((v) => v.emailMode),
            groups: accounts.flatMap((a) => list('moqui.security.UserGroupMember', { userId: a.userId })).filter((g) => g.userGroupId !== 'ALL_USERS'),
            accounts: accounts.length,
            secret,
            reply,
        }
    },
    then(r) {
        r.stage === 'imported' && r.importRun.state === 'failed'
        // The bad upload is named, and the attachment that depends on it waits on it; everything else went in.
        r.failedItems.length === 2
        r.failedItems.some((i) => i.itemId === 'f|2' && i.errorText.includes('SHA-1'))
        r.failedItems.some((i) => i.itemId === 'g|101:2' && i.errorText.includes('Upload 2'))
        r.brokenUpload.state === 'failed' && r.brokenUpload.errorText.includes('Upload 2')
        r.subParent === r.general
        r.insidersVisibility === 'category' && r.insidersGrant === 1
        r.daveMapped && r.aliceRole === 'owner'
        r.chatKind === 'private' && r.participants.length === 2
        !r.replyBody.includes('script') && r.replyBody.includes('I agree')
        r.replyParent === target('topics', '10')
        r.rootBody.includes('<strong>world</strong>') && r.rootBody.includes('attachment: photo.png')
        r.rootSource.startsWith('Hello **world**')
        r.deletedVisibility === 'deleted'
        r.attachments.length === 1 && r.attachments[0].scanState === 'clean' && r.attachments[0].filename === 'photo.png'
        r.likes.length === 1
        r.tagged === 1 && r.accepted === r.reply
        r.poll.voterCount === 1 && r.poll.resultsPolicy === 'always'
        Number(r.marker.consumedOrdinal) === 3
        r.bookmark === 1 && r.legacy >= 6
        r.outbox === 0
        r.emailModes.length >= 4 && r.emailModes.every((m) => m === 'None')
        r.accounts === 1 && r.groups.length === 0
    },
})
feature('replaying the same snapshot duplicates nothing; a changed row is flagged and resolved explicitly', {
    when() {
        const topicsBefore = count('mantle.forum.ForumTopic', { siteId })
        const postsBefore = count('mantle.forum.ForumPostState', {})
        const same = archive('community-2024-01-02-000000-v3.2.0-20240101000000.tar.gz', 'Sub topic body')
        replayId = run(I + 'register#Import', { siteId, archiveName: same.name, checksum: same.checksum }).importId
        run(I + 'stage#Import', { siteId, importId: replayId })
        dispatchAll()
        run(I + 'run#Import', { siteId, importId: replayId })
        dispatchAll()
        const topicsAfter = count('mantle.forum.ForumTopic', { siteId })
        const postsAfter = count('mantle.forum.ForumPostState', {})
        const changed = archive('community-2024-01-03-000000-v3.2.0-20240101000000.tar.gz', 'Sub topic body, corrected')
        changedId = run(I + 'register#Import', { siteId, archiveName: changed.name, checksum: changed.checksum }).importId
        run(I + 'stage#Import', { siteId, importId: changedId })
        dispatchAll()
        run(I + 'run#Import', { siteId, importId: changedId })
        dispatchAll()
        const flagged = mapOf('posts', '12:1')
        const first = run(I + 'reconcile#Import', { siteId, importId: changedId })
        const blocked = run(I + 'get#Import', { siteId, importId: changedId }).reconciliation.blockers
        run(I + 'store#ImportMappings', {
            siteId,
            importId: changedId,
            mappings: [{ mappingType: 'change', sourceId: 'posts:12:1', decision: 'apply' }],
        })
        const post = target('posts', '12:1')
        const second = run(I + 'reconcile#Import', { siteId, importId: changedId })
        const remaining = run(I + 'get#Import', { siteId, importId: changedId }).reconciliation.blockers
        return {
            topicsBefore,
            topicsAfter,
            postsBefore,
            postsAfter,
            flagged,
            first,
            blocked,
            second,
            remaining,
            revision: entity('mantle.forum.ForumPostRevision', { communicationEventId: post, revision: 2 }),
            body: entity('mantle.party.communication.CommunicationEvent', { communicationEventId: post }).body,
        }
    },
    then(r) {
        r.topicsAfter === r.topicsBefore && r.postsAfter === r.postsBefore
        r.flagged.state === 'changed'
        r.blocked.some((b) => b.type === 'changed' && b.sourceId === 'posts:12:1')
        r.remaining.length === 0
        r.second.reconciliationRevision === r.first.reconciliationRevision + 1
        r.revision.sourceText === 'Sub topic body, corrected' && r.body.includes('corrected')
    },
})
feature('activation needs both approvals of this reconciliation, a frozen source and a backup', {
    when() {
        const rev = entity('mantle.forum.ForumImportRun', { importId: changedId }).reconciliationRevision
        const report = run(I + 'get#Import', { siteId, importId: changedId }).reconciliation
        const unapproved = failure(I + 'activate#Import', { siteId, importId: changedId, sourceFrozen: true, backupReference: 'snap-1', confirm: true })
        run(I + 'approve#Import', { siteId, importId: changedId, role: 'operator', expectedRevision: Number(rev) })
        const operatorOnly = failure(I + 'activate#Import', { siteId, importId: changedId, sourceFrozen: true, backupReference: 'snap-1', confirm: true })
        login('pass.imp.member', 'moqui1!!')
        const memberAsOperator = failure(I + 'approve#Import', { siteId, importId: changedId, role: 'operator', expectedRevision: Number(rev) })
        run(I + 'approve#Import', { siteId, importId: changedId, role: 'owner', expectedRevision: Number(rev) })
        login('john.doe')
        const noBackup = failure(I + 'activate#Import', { siteId, importId: changedId, sourceFrozen: true, confirm: true })
        const activated = run(I + 'activate#Import', { siteId, importId: changedId, sourceFrozen: true, backupReference: 'snap-1', confirm: true })
        return {
            report,
            unapproved,
            operatorOnly,
            memberAsOperator,
            noBackup,
            activated,
            site: entity('mantle.public.PublicSite', { siteId }),
        }
    },
    then(r) {
        r.report.topics.sourcePrivate === 1 && r.report.topics.importedPrivate === 1
        r.report.acceptedAnswers.source === 1 && r.report.acceptedAnswers.imported === 1
        r.report.uploads.failed === 1
        r.unapproved.includes('Both the operator and a site owner')
        r.operatorOnly.includes('Both')
        r.memberAsOperator.includes('operator')
        r.noBackup.includes('backup')
        r.activated.stage === 'active' && r.site.state === 'published'
    },
})
feature('legacy URLs resolve after current access checks', {
    when() {
        logout()
        const topicUrl = run(I + 'resolve#Permalink', { siteId, path: '/t/hello-world/10' })
        const postUrl = run(I + 'resolve#Permalink', { siteId, path: '/t/hello-world/10/2' })
        const oldUrl = run(I + 'resolve#Permalink', { siteId, path: 'old/forum/thread/77?page=2' })
        const category = run(I + 'resolve#Permalink', { siteId, path: '/c/general/1' })
        const restricted = failure(I + 'resolve#Permalink', { siteId, path: '/t/secret-plans/11' })
        login('john.doe')
        const general = target('categories', '1')
        const c = entity('mantle.forum.ForumCategory', { contactListId: general })
        run(F + 'set#CategoryAccess', {
            siteId,
            contactListId: general,
            visibility: 'members',
            publicationState: 'published',
            expectedRevision: Number(c.policyRevision),
            confirm: true,
        })
        logout()
        const afterRemoval = failure(I + 'resolve#Permalink', { siteId, path: '/t/hello-world/10' })
        login('john.doe')
        return { topicUrl, postUrl, oldUrl, category, restricted, afterRemoval }
    },
    then(r) {
        r.topicUrl.kind === 'topic' && r.topicUrl.rootCommEventId === target('topics', '10')
        r.postUrl.kind === 'post' && r.postUrl.postId === target('posts', '10:2')
        r.oldUrl.rootCommEventId === target('topics', '10')
        r.category.kind === 'category'
        r.restricted.includes('not found')
        r.afterRemoval.includes('not found')
    },
})
