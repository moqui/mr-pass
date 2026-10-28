// S2 moderation: versioned policy, content rules, report hiding, classifier queue, trust, bulk decisions,
// appeals, slow mode, pins, timers and move/split/merge integrity.
const S = 'mantle.public.SiteServices.',
    F = 'mantle.forum.ForumServices.',
    M = 'mantle.forum.ModerationServices.',
    W = 'mantle.forum.ModerationWorkerServices.'
const run = (name, input) =>
    call(name, {
        input: /store#(Category|Rule)$|appeal#Review$|flag#Post$/.test(name)
            ? { operationId: ec.user.randomString(32), ...input }
            : input,
    }).result
const publish = (input) =>
    run(F + 'publish#Post', { operationId: ec.user.randomString(32), ...input })
const party = {}
let siteId, mainId, otherId, rootId, a1, a2, b1, secondRoot, policyRevision
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
const entity = (name, fields) =>
    sys(() => ec.entity.find(name).condition(fields).one())
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
const topicRevision = (root) =>
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
feature('policy sections merge, refuse laxer values and unknown keys', {
    when() {
        party.owner = ec.user.userAccount.partyId
        siteId = run(S + 'create#Site', {
            name: 'Moderation',
            ownerPartyId: party.owner,
        }).siteId
        run(S + 'update#Site', {
            siteId,
            state: 'published',
            expectedRevision: 1,
        })
        for (const name of ['main', 'other']) {
            const id = run(F + 'store#Category', { siteId, name }).contactListId
            run(F + 'set#CategoryAccess', {
                siteId,
                contactListId: id,
                visibility: name === 'main' ? 'public' : 'members',
                publicationState: 'published',
                expectedRevision: 1,
                confirm: true,
            })
            if (name === 'main') mainId = id
            else otherId = id
        }
        policyRevision = run(M + 'get#Policy', { siteId }).revision
        const lax = failure(M + 'store#Policy', {
            siteId,
            expectedRevision: policyRevision,
            config: { flagHideCount: 1 },
        })
        const unknown = failure(M + 'store#Policy', {
            siteId,
            expectedRevision: policyRevision,
            config: { anything: 1 },
        })
        policyRevision = run(M + 'store#Policy', {
            siteId,
            expectedRevision: policyRevision,
            config: { flagHideCount: 2, classifierEnabled: true },
        }).revision
        policyRevision = run(M + 'store#Policy', {
            siteId,
            expectedRevision: policyRevision,
            config: { postIntervalSeconds: 10 },
        }).revision
        return {
            lax,
            unknown,
            policy: run(M + 'get#Policy', { siteId }).policy,
        }
    },
    then({ lax, unknown, policy }) {
        lax.includes('flagHideCount must be 2–10')
        unknown.includes('Unsupported policy')
        policy.flagHideCount === 2
        policy.classifierEnabled === true
        policy.firstContributionCount === 2
    },
})
feature('rules test safely and block, hold, flag or censor posts', {
    when() {
        const nested = failure(M + 'test#Rule', {
            siteId,
            ruleType: 'regex',
            pattern: '(a+)+$',
            body: 'aaaa',
        })
        const tested = run(M + 'test#Rule', {
            siteId,
            ruleType: 'word',
            pattern: 'darn',
            body: 'Well darn it',
        })
        for (const [pattern, action] of [
            ['forbidden', 'block'],
            ['holdme', 'approve'],
            ['checkme', 'flag'],
            ['darn', 'censor'],
        ])
            run(M + 'store#Rule', {
                siteId,
                ruleType: 'word',
                pattern,
                action,
                reason: 'Test rule',
            })
        sys(() => {
            for (const name of ['ann', 'bea', 'cal', 'dee']) {
                party[name] = call('mantle.party.PartyServices.create#Person', {
                    firstName: name,
                    lastName: 'Mod',
                }).partyId
                call('mantle.party.PartyServices.create#PartyUserAccount', {
                    partyId: party[name],
                    username: 'pass.mod.' + name,
                    emailAddress: name + '.mod@example.test',
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
                for (const contactListId of [mainId, otherId])
                    call('create#mantle.marketing.contact.ContactListParty', {
                        contactListId,
                        partyId: party[name],
                        statusId: 'CLPT_ACCEPTED',
                        fromDate: at - 1000,
                    })
            }
        })
        login('pass.mod.ann', 'moqui1!!')
        ready(party.ann)
        rootId = publish({
            siteId,
            contactListId: mainId,
            title: 'Moderation topic',
            body: '<p>Root post</p>',
        }).rootCommEventId
        ready(party.ann)
        const blocked = failure(F + 'publish#Post', {
            siteId,
            rootCommEventId: rootId,
            body: '<p>This is forbidden text</p>',
        })
        ready(party.ann)
        const held = publish({
            siteId,
            rootCommEventId: rootId,
            body: '<p>please holdme</p>',
        })
        ready(party.ann)
        const flagged = publish({
            siteId,
            rootCommEventId: rootId,
            body: '<p>checkme out</p>',
        })
        ready(party.ann)
        const censored = publish({
            siteId,
            rootCommEventId: rootId,
            body: '<p>Well darn it</p>',
        })
        const reviews = (postId) =>
            list('mantle.forum.ForumReviewItem', {
                targetId: postId,
                reasonFamily: 'rule',
            }).length
        return {
            nested,
            tested,
            blocked,
            held,
            flagged,
            flagReviews: reviews(flagged.postId),
            heldReviews: reviews(held.postId),
            body: entity('mantle.party.communication.CommunicationEvent', {
                communicationEventId: censored.postId,
            }).body,
            source: entity('mantle.forum.ForumPostRevision', {
                communicationEventId: censored.postId,
                revision: 1,
            }).sourceText,
        }
    },
    then({
        nested,
        tested,
        blocked,
        held,
        flagged,
        flagReviews,
        heldReviews,
        body,
        source,
    }) {
        nested.includes('Nested repetition')
        tested.matched === true
        tested.censored.includes('■■■■')
        blocked.includes('does not allow')
        held.state === 'pending'
        heldReviews === 1
        flagged.state === 'published'
        flagReviews === 1
        body.includes('■■■■') && !body.includes('darn')
        source.includes('darn')
    },
})
feature(
    'two basic reporters hide a post; new members and the author add no count',
    {
        when() {
            ready(party.ann)
            a1 = publish({
                siteId,
                rootCommEventId: rootId,
                body: '<p>A disputed reply</p>',
            }).postId
            const self = failure(M + 'flag#Post', {
                siteId,
                postId: a1,
                reason: 'Mine',
            })
            login('pass.mod.dee', 'moqui1!!')
            ready(party.dee, 'new')
            run(M + 'flag#Post', { siteId, postId: a1, reason: 'Rude' })
            login('pass.mod.bea', 'moqui1!!')
            ready(party.bea)
            const first = run(M + 'flag#Post', {
                siteId,
                postId: a1,
                reason: 'Rude',
            })
            login('pass.mod.cal', 'moqui1!!')
            ready(party.cal)
            const second = run(M + 'flag#Post', {
                siteId,
                postId: a1,
                reason: 'Rude',
            })
            logout()
            const anonymous = run(F + 'get#Posts', {
                siteId,
                rootCommEventId: rootId,
            }).postList
            login('john.doe')
            const r = list('mantle.forum.ForumReviewItem', {
                targetId: a1,
                reasonFamily: 'flag',
            })[0]
            run(M + 'decide#Review', {
                siteId,
                reviewId: r.reviewId,
                decision: 'dismissed',
                reason: 'Not rude',
                expectedRevision: r.revision,
            })
            return {
                self,
                first,
                second,
                anonymous,
                restored: entity('mantle.forum.ForumPostState', {
                    communicationEventId: a1,
                }).visibility,
            }
        },
        then({ self, first, second, anonymous, restored }) {
            self.includes('own post')
            first.hidden === false
            second.hidden === true
            !anonymous.some((p) => p.postId === a1)
            restored === 'approved'
        },
    },
)
feature(
    'the classifier only files reviews, and an outage leaves posting working',
    {
        when() {
            login('pass.mod.bea', 'moqui1!!')
            ready(party.bea)
            const suspicious = publish({
                siteId,
                rootCommEventId: rootId,
                body: '<p>A suspicious offer</p>',
            }).postId
            ready(party.bea)
            const outage = publish({
                siteId,
                rootCommEventId: rootId,
                body: '<p>classifier outage</p>',
            })
            for (let i = 0; i < 3; i++) call(W + 'classify#Posts', {})
            const box = list('mantle.forum.ForumOutbox', {
                communicationEventId: outage.postId,
                eventType: 'classify',
            })[0]
            const filed = list('mantle.forum.ForumReviewItem', {
                targetId: suspicious,
                reasonFamily: 'classifier',
            })[0]
            return {
                outage,
                box,
                filed,
                visible: entity('mantle.forum.ForumPostState', {
                    communicationEventId: suspicious,
                }).visibility,
            }
        },
        then({ outage, box, filed, visible }) {
            outage.state === 'published'
            box.state === 'failed'
            JSON.parse(filed.detail).model === 'test-classifier'
            visible === 'approved'
        },
    },
)
feature(
    'bulk decisions report each item, and an author can appeal a rejection',
    {
        when() {
            login('john.doe')
            const pending = list('mantle.forum.ForumReviewItem', {
                siteId,
                reasonFamily: 'rule',
            }).filter((r) => r.state === 'pending')
            const bulk = run(M + 'decide#Reviews', {
                siteId,
                reviewIds: [
                    ...pending.map((r) => r.reviewId),
                    'NO_SUCH_REVIEW',
                ],
                decision: 'rejected',
                reason: 'Rule matches',
            })
            login('pass.mod.ann', 'moqui1!!')
            const appeal = run(M + 'appeal#Review', {
                siteId,
                reviewId: pending[0].reviewId,
                reason: 'Context matters',
            })
            login('pass.mod.bea', 'moqui1!!')
            const stranger = failure(M + 'appeal#Review', {
                siteId,
                reviewId: pending[0].reviewId,
                reason: 'Me too',
            })
            return { pending, bulk, appeal, stranger }
        },
        then({ pending, bulk, appeal, stranger }) {
            pending.length === 2
            bulk.results.filter((r) => r.ok).length === 2
            bulk.results.find((r) => r.reviewId === 'NO_SUCH_REVIEW').ok ===
                false
            entity('mantle.forum.ForumReviewItem', {
                reviewId: appeal.reviewId,
            }).linkedReviewId === pending[0].reviewId
            stranger.includes('not found')
        },
    },
)
feature(
    'reading telemetry and the recompute job promote a member; an owner lock holds',
    {
        when() {
            sys(() => {
                const m = ec.entity
                    .find('mantle.forum.ForumMemberState')
                    .condition({ siteId, partyId: party.dee })
                    .one()
                m.set('trustLevel', 'new')
                m.set('topicsEntered', 4)
                m.set('postsRead', 19)
                m.set('readingSeconds', 600)
                m.set('visitDays', 1)
                m.set('lastVisitDay', '2000-01-01')
                m.update()
            })
            login('pass.mod.dee', 'moqui1!!')
            const window = run(F + 'get#Posts', {
                siteId,
                rootCommEventId: rootId,
            }).postList
            run(F + 'mark#Read', {
                siteId,
                rootCommEventId: rootId,
                ordinal: Math.max(...window.map((p) => p.ordinal)),
                expectedRevision: 0,
                renderedPostIds: window.map((p) => p.postId),
            })
            const measured = entity('mantle.forum.ForumMemberState', {
                siteId,
                partyId: party.dee,
            })
            call(W + 'recompute#MemberTrust', { siteId, partyId: party.dee })
            const promoted = entity('mantle.forum.ForumMemberState', {
                siteId,
                partyId: party.dee,
            })
            login('john.doe')
            run(M + 'set#Trust', {
                siteId,
                targetPartyId: party.dee,
                trustLevel: 'new',
                locked: true,
                reason: 'Probation',
                expectedRevision: promoted.revision,
            })
            call(W + 'recompute#Trust', {})
            return {
                measured,
                promoted,
                locked: entity('mantle.forum.ForumMemberState', {
                    siteId,
                    partyId: party.dee,
                }),
            }
        },
        then({ measured, promoted, locked }) {
            Number(measured.topicsEntered) === 5
            Number(measured.postsRead) >= 20
            Number(measured.visitDays) === 2
            promoted.trustLevel === 'basic'
            locked.trustLevel === 'new'
            locked.trustLocked === 'Y'
        },
    },
)
feature(
    'slow mode spaces member replies and pins/unlists are audited topic state',
    {
        when() {
            login('john.doe')
            run(M + 'apply#TopicAction', {
                siteId,
                rootCommEventId: rootId,
                action: 'slow',
                slowIntervalSeconds: 3600,
                reason: 'Cool down',
                expectedRevision: topicRevision(rootId),
            })
            run(M + 'apply#TopicAction', {
                siteId,
                rootCommEventId: rootId,
                action: 'pin',
                reason: 'Important',
                expectedRevision: topicRevision(rootId),
            })
            login('pass.mod.cal', 'moqui1!!')
            ready(party.cal)
            b1 = publish({
                siteId,
                rootCommEventId: rootId,
                body: '<p>First reply in slow mode</p>',
            }).postId
            ready(party.cal)
            const second = failure(F + 'publish#Post', {
                siteId,
                rootCommEventId: rootId,
                body: '<p>Too soon</p>',
            })
            const topic = run(F + 'get#Topic', {
                siteId,
                rootCommEventId: rootId,
            }).topic
            login('john.doe')
            run(M + 'apply#TopicAction', {
                siteId,
                rootCommEventId: rootId,
                action: 'slow',
                slowIntervalSeconds: 0,
                reason: 'Done',
                expectedRevision: topicRevision(rootId),
            })
            return { second, topic }
        },
        then({ second, topic }) {
            second.includes('slow mode')
            topic.pinned === 'Y'
            Number(topic.slowIntervalSeconds) === 3600
        },
    },
)
feature('a due timer fires once; a timer on a moved topic is cancelled', {
    when() {
        run(M + 'apply#TopicAction', {
            siteId,
            rootCommEventId: rootId,
            action: 'timer',
            timerAction: 'close',
            dueAt: Date.now() + 60000,
            reason: 'Close tonight',
            expectedRevision: topicRevision(rootId),
        })
        ready(party.owner)
        secondRoot = publish({
            siteId,
            contactListId: mainId,
            title: 'Second topic',
            body: '<p>Second root</p>',
        }).rootCommEventId
        run(M + 'apply#TopicAction', {
            siteId,
            rootCommEventId: secondRoot,
            action: 'timer',
            timerAction: 'unlist',
            dueAt: Date.now() + 60000,
            reason: 'Unlist later',
            expectedRevision: topicRevision(secondRoot),
        })
        const preview = run(M + 'preview#TopicAction', {
            siteId,
            rootCommEventId: secondRoot,
            targetContactListId: otherId,
        })
        run(M + 'apply#TopicAction', {
            siteId,
            rootCommEventId: secondRoot,
            action: 'category',
            targetContactListId: otherId,
            confirmAudience: true,
            expectedGeneration: preview.expectedGeneration,
            reason: 'Wrong place',
            expectedRevision: topicRevision(secondRoot),
        })
        sys(() =>
            ec.entity
                .find('mantle.forum.ForumTopicTimer')
                .condition({ siteId })
                .updateAll({ dueAt: Date.now() - 1000 }),
        )
        call(W + 'fire#TopicTimers', {})
        call(W + 'fire#TopicTimers', {})
        return {
            closed: run(F + 'get#Topic', { siteId, rootCommEventId: rootId })
                .topic.closed,
            timers: list('mantle.forum.ForumTopicTimer', { siteId }),
        }
    },
    then({ closed, timers }) {
        closed === true
        timers.find((t) => t.rootCommEventId === rootId).state === 'done'
        timers.find((t) => t.rootCommEventId === secondRoot).state ===
            'cancelled'
    },
})
feature(
    'a split takes reply subtrees, keeps post IDs and renumbers only the destination',
    {
        when() {
            run(M + 'apply#TopicAction', {
                siteId,
                rootCommEventId: rootId,
                action: 'reopen',
                reason: 'Continue',
                expectedRevision: topicRevision(rootId),
            })
            login('pass.mod.bea', 'moqui1!!')
            ready(party.bea)
            a2 = publish({
                siteId,
                rootCommEventId: rootId,
                parentCommEventId: b1,
                body: '<p>Reply to the slow-mode reply</p>',
            }).postId
            login('john.doe')
            const preview = run(M + 'preview#TopicAction', {
                siteId,
                rootCommEventId: rootId,
                action: 'split',
                postIds: [b1],
            })
            const before = run(F + 'get#Topic', {
                siteId,
                rootCommEventId: rootId,
            }).topic.visiblePostCount
            const out = run(M + 'apply#TopicAction', {
                siteId,
                rootCommEventId: rootId,
                action: 'split',
                postIds: [b1],
                title: 'Split discussion',
                reason: 'Separate thread',
                expectedRevision: topicRevision(rootId),
            })
            const posts = run(F + 'get#Posts', {
                siteId,
                rootCommEventId: out.rootCommEventId,
            }).postList
            return {
                preview,
                out,
                posts,
                before,
                after: run(F + 'get#Topic', { siteId, rootCommEventId: rootId })
                    .topic.visiblePostCount,
                child: entity('mantle.party.communication.CommunicationEvent', {
                    communicationEventId: a2,
                }),
            }
        },
        then({ preview, out, posts, before, after, child }) {
            preview.selectedPostIds.length === 2
            preview.replyCount === 1
            out.rootCommEventId === b1
            posts.map((p) => p.postId).join() === b1 + ',' + a2
            posts.map((p) => p.ordinal).join() === '1,2'
            after === before - 2
            child.parentCommEventId === b1
            child.rootCommEventId === b1
        },
    },
)
feature(
    'a merge moves every post, leaves a permalink and drops the old topic',
    {
        when() {
            const target = run(F + 'get#Topic', {
                siteId,
                rootCommEventId: rootId,
            }).topic
            run(M + 'apply#TopicAction', {
                siteId,
                rootCommEventId: b1,
                action: 'merge',
                targetRootCommEventId: rootId,
                reason: 'Same subject',
                expectedRevision: topicRevision(b1),
            })
            logout()
            const moved = run(F + 'get#Topic', {
                siteId,
                rootCommEventId: b1,
            }).topic
            const location = run(F + 'get#PostLocation', { siteId, postId: a2 })
            const ordinals = list('mantle.forum.ForumPostState', {
                rootCommEventId: rootId,
            }).map((s) => Number(s.ordinal))
            return { target, moved, location, ordinals }
        },
        then({ target, moved, location, ordinals }) {
            moved.rootCommEventId === rootId
            moved.movedFrom === b1
            location.rootCommEventId === rootId
            new Set(ordinals).size === ordinals.length
            moved.visiblePostCount === target.visiblePostCount + 2
            entity('mantle.forum.ForumTopic', { rootCommEventId: b1 }) == null
        },
    },
)
feature(
    'staff and author screens show policy, rules, bulk review, trust and appeals',
    {
        when() {
            login('john.doe')
            run(S + 'store#Mounts', {
                siteId,
                expectedRevision: (({ revision, policyRevision }) =>
                    revision ?? policyRevision)(
                    entity('mantle.public.PublicSite', { siteId }),
                ),
                mounts: [
                    { app: 'forum', pathPrefix: '/forum' },
                    { app: 'account', pathPrefix: '/account' },
                    { app: 'members', pathPrefix: '/members' },
                    { app: 'sites', pathPrefix: '/sites' },
                ],
                hosts: [{ hostname: 'mod.example.test', canonical: true }],
            })
            const render = (path, params) => {
                const out = ec.screen
                    .makeTest()
                    .rootScreen('component://mr-pass/screen/Pass.xml')
                    .render(
                        path,
                        {
                            resolvedSiteId: siteId,
                            publicHost: 'mod.example.test',
                            publicPath: '/forum',
                            ...params,
                        },
                        null,
                    )
                return { html: out.output, errors: out.errorMessages }
            }
            const slug = run(F + 'get#Topic', {
                siteId,
                rootCommEventId: rootId,
            }).topic.slug
            const staff = {
                policies: render('Forum/Settings/Policies', {}),
                queue: render('Forum/Moderation/ReviewQueue', {}),
                member: render('Forum/Moderation/MemberDetail', {
                    targetPartyId: party.dee,
                }),
                topic: render('Forum/Topics/TopicDetail', {
                    rootCommEventId: rootId,
                    requestedTopicSlug: slug,
                }),
            }
            login('pass.mod.ann', 'moqui1!!')
            return { ...staff, notices: render('Account/Notifications', {}) }
        },
        then({ policies, queue, member, topic, notices }) {
            policies.errors.length === 0
            policies.html.includes('name="flagHideCount"')
            policies.html.includes('word “forbidden” → block')
            queue.errors.length === 0
            member.errors.length === 0
            member.html.includes('PassMemberModerationSetTrust')
            member.html.includes('topicsEntered')
            topic.errors.length === 0
            topic.html.includes('value="merge"')
            notices.errors.length === 0
            notices.html.includes('Moderation outcomes')
            notices.html.includes('appeal pending')
        },
    },
)
