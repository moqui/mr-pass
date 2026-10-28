// S2 participation: tags, reactions, accepted answers, polls, bookmarks, history, wiki posts and author deletion.
const S = 'mantle.public.SiteServices.',
    F = 'mantle.forum.ForumServices.',
    M = 'mantle.forum.ModerationServices.'
const run = (name, input) =>
    call(name, {
        input: /store#(Category|Tag)$|merge#Tag$/.test(name)
            ? { operationId: ec.user.randomString(32), ...input }
            : input,
    }).result
const publish = (input) =>
    run(F + 'publish#Post', { operationId: ec.user.randomString(32), ...input })
const party = {}
let siteId, qaId, privateId, rootId, replyId, otherReplyId, pollId
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
/* Posting gates are covered elsewhere: here every actor is past first-post review and the posting interval. */
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
const entity = (name, fields) =>
    sys(() => ec.entity.find(name).condition(fields).one())
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
feature('owners create site tags; restricted tags reveal no category', {
    when() {
        party.owner = ec.user.userAccount.partyId
        siteId = run(S + 'create#Site', {
            name: 'Participation',
            ownerPartyId: party.owner,
        }).siteId
        run(S + 'update#Site', {
            siteId,
            state: 'published',
            expectedRevision: 1,
        })
        qaId = run(F + 'store#Category', {
            siteId,
            name: 'Questions',
            mode: 'qa',
        }).contactListId
        privateId = run(F + 'store#Category', {
            siteId,
            name: 'Staff',
        }).contactListId
        run(F + 'set#CategoryAccess', {
            siteId,
            contactListId: qaId,
            visibility: 'public',
            publicationState: 'published',
            expectedRevision: 1,
            confirm: true,
        })
        run(F + 'set#CategoryAccess', {
            siteId,
            contactListId: privateId,
            visibility: 'category',
            publicationState: 'published',
            expectedRevision: 1,
            confirm: true,
        })
        run(F + 'store#Tag', { siteId, name: 'Install Help' })
        run(F + 'store#Tag', { siteId, name: 'setup' })
        run(F + 'store#Tag', {
            siteId,
            name: 'secret-plans',
            allowedCategories: [privateId],
        })
        sys(() => {
            for (const name of ['ana', 'ben', 'cy']) {
                party[name] = call('mantle.party.PartyServices.create#Person', {
                    firstName: name,
                    lastName: 'Member',
                }).partyId
                call('mantle.party.PartyServices.create#PartyUserAccount', {
                    partyId: party[name],
                    username: 'pass.part.' + name,
                    emailAddress: name + '.part@example.test',
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
                    contactListId: qaId,
                    partyId: party[name],
                    statusId: 'CLPT_ACCEPTED',
                    fromDate: at - 1000,
                })
            }
        })
        const duplicate = failure(F + 'store#Tag', {
            siteId,
            name: 'install help',
        })
        logout()
        const anonymous = run(F + 'find#Tags', { siteId }).tagList
        return { duplicate, anonymous }
    },
    then({ duplicate, anonymous }) {
        duplicate.includes('already used')
        anonymous.map((t) => t.name).join() === 'Install Help,setup'
    },
})
feature('a tagged question lists by tag, and a hidden tag is refused', {
    when() {
        login('pass.part.ana', 'moqui1!!')
        ready(party.ana)
        const root = publish({
            siteId,
            contactListId: qaId,
            title: 'How do I install?',
            body: '<p>Steps please</p>',
            tags: ['install-help', 'Setup', 'setup'],
            poll: {
                question: 'Which platform?',
                options: ['Linux', 'macOS', 'Windows'],
                maxChoices: 1,
                resultsPolicy: 'voted',
                allowChange: false,
            },
        })
        rootId = root.rootCommEventId
        ready(party.ana)
        const hidden = failure(F + 'publish#Post', {
            siteId,
            contactListId: qaId,
            title: 'Leak',
            body: 'x',
            tags: ['secret-plans'],
        })
        logout()
        return {
            hidden,
            tagged: run(F + 'find#Topics', { siteId, tag: 'install-help' }),
            tags: run(F + 'find#Tags', { siteId }).tagList,
            topic: run(F + 'get#Topic', { siteId, rootCommEventId: rootId })
                .topic,
        }
    },
    then({ hidden, tagged, tags, topic }) {
        hidden.includes('not found')
        tagged.topicList.length === 1
        tagged.topicList[0].tags.join() === 'Install Help,setup'
        topic.tags.length === 2
        tags.find((t) => t.name === 'setup').topicCount === 1
    },
})
feature('reactions are idempotent desired states and never self-reactions', {
    when() {
        login('pass.part.ben', 'moqui1!!')
        ready(party.ben)
        replyId = publish({
            siteId,
            rootCommEventId: rootId,
            body: '<p>Use the installer</p>',
        }).postId
        const self = failure(F + 'set#Reaction', {
            siteId,
            postId: replyId,
            reactionKey: 'like',
            active: true,
        })
        login('pass.part.cy', 'moqui1!!')
        ready(party.cy)
        otherReplyId = publish({
            siteId,
            rootCommEventId: rootId,
            body: '<p>Or build from source</p>',
        }).postId
        for (let i = 0; i < 2; i++)
            run(F + 'set#Reaction', {
                siteId,
                postId: replyId,
                reactionKey: 'like',
                active: true,
            })
        const unknown = failure(F + 'set#Reaction', {
            siteId,
            postId: replyId,
            reactionKey: 'angry',
            active: true,
        })
        const posts = run(F + 'get#Posts', { siteId, rootCommEventId: rootId })
        run(F + 'set#Reaction', {
            siteId,
            postId: replyId,
            reactionKey: 'like',
            active: false,
        })
        const after = entity('mantle.forum.ForumPostState', {
            communicationEventId: replyId,
        })
        return { self, unknown, posts, after }
    },
    then({ self, unknown, posts, after }) {
        self.includes('own post')
        unknown.includes('Unknown reaction')
        const reply = posts.postList.find((p) => p.postId === replyId)
        reply.reactions.like === 1
        reply.myReactions.join() === 'like'
        Number(after.reactionCount) === 0
    },
})
feature('the question author accepts an answer without closing the topic', {
    when() {
        login('pass.part.ben', 'moqui1!!')
        const stranger = failure(F + 'accept#Answer', {
            siteId,
            rootCommEventId: rootId,
            postId: replyId,
            expectedRevision: run(F + 'get#Topic', {
                siteId,
                rootCommEventId: rootId,
            }).topic.revision,
        })
        login('pass.part.ana', 'moqui1!!')
        const topic = run(F + 'get#Topic', {
            siteId,
            rootCommEventId: rootId,
        }).topic
        const notReply = failure(F + 'accept#Answer', {
            siteId,
            rootCommEventId: rootId,
            postId: rootId,
            expectedRevision: topic.revision,
        })
        run(F + 'accept#Answer', {
            siteId,
            rootCommEventId: rootId,
            postId: replyId,
            expectedRevision: topic.revision,
        })
        const accepted = run(F + 'get#Topic', {
            siteId,
            rootCommEventId: rootId,
        }).topic
        logout()
        return {
            stranger,
            notReply,
            accepted,
            solved: run(F + 'find#Topics', { siteId, solved: 'Y' }).topicList,
            open: run(F + 'find#Topics', { siteId, solved: 'N' }).topicList,
        }
    },
    then({ stranger, notReply, accepted, solved, open }) {
        stranger.includes('question author')
        notReply.includes('visible reply')
        accepted.acceptedAnswerId === replyId
        !accepted.closed
        solved.length === 1
        open.length === 0
    },
})
feature(
    'a ballot is one per member, locked when changes are off, and results follow policy',
    {
        when() {
            pollId = entity('mantle.forum.ForumPoll', {
                communicationEventId: rootId,
            }).pollId
            login('pass.part.ben', 'moqui1!!')
            const before = run(F + 'get#Poll', { siteId, pollId }).poll
            const tooMany = failure(F + 'vote#Poll', {
                siteId,
                pollId,
                optionIds: ['1', '2'],
            })
            const voted = run(F + 'vote#Poll', {
                siteId,
                pollId,
                optionIds: ['1'],
            }).poll
            const change = failure(F + 'vote#Poll', {
                siteId,
                pollId,
                optionIds: ['2'],
            })
            logout()
            const anonymous = failure(F + 'vote#Poll', {
                siteId,
                pollId,
                optionIds: ['1'],
            })
            return { before, tooMany, voted, change, anonymous }
        },
        then({ before, tooMany, voted, change, anonymous }) {
            before.voterCount === null
            before.options[0].voteCount === null
            tooMany.includes('Choose from 1')
            voted.voterCount === 1
            voted.options[0].voteCount === 1
            voted.myChoices.join() === '1'
            change.includes('cannot be changed')
            anonymous.includes('Sign in')
        },
    },
)
feature('bookmarks are personal and saved once per post', {
    when() {
        login('pass.part.cy', 'moqui1!!')
        const saved = run(F + 'store#Bookmark', {
            siteId,
            postId: replyId,
            note: 'Try this',
            remindAt: Date.now() + 3600000,
        })
        const repeat = run(F + 'store#Bookmark', {
            siteId,
            postId: replyId,
            note: 'Try this first',
            expectedRevision: saved.revision,
        })
        login('pass.part.ben', 'moqui1!!')
        const others = run(F + 'find#Bookmarks', { siteId }).bookmarkList
        const steal = failure(F + 'remove#Bookmark', {
            siteId,
            bookmarkId: saved.bookmarkId,
        })
        return { saved, repeat, others, steal }
    },
    then({ saved, repeat, others, steal }) {
        repeat.bookmarkId === saved.bookmarkId
        repeat.revision === 2
        others.length === 0
        steal.includes('not found')
    },
})
feature('a due reminder becomes one in-app notice', {
    when() {
        sys(() =>
            ec.entity
                .find('mantle.forum.ForumBookmark')
                .condition({ siteId, partyId: party.cy })
                .updateAll({ remindAt: Date.now() - 1000 }),
        )
        call('mantle.forum.ForumServices.remind#Bookmarks', {})
        call('mantle.forum.ForumServices.remind#Bookmarks', {})
        login('pass.part.cy', 'moqui1!!')
        const reminded = sys(() =>
            ec.entity
                .find('mantle.forum.ForumBookmark')
                .condition({ siteId, partyId: party.cy })
                .one(),
        )
        return {
            reminded,
            list: run('mantle.forum.DeliveryServices.find#Notifications', {
                siteId,
            }).notificationList,
        }
    },
    then({ reminded, list }) {
        reminded.remindedAt != null
        list.length === 1
        list[0].postId === replyId
    },
})
feature(
    'history shows public revisions, compares them, and restore is a new revision',
    {
        when() {
            login('pass.part.ben', 'moqui1!!')
            const st = () =>
                entity('mantle.forum.ForumPostState', {
                    communicationEventId: replyId,
                })
            run(F + 'update#Post', {
                siteId,
                postId: replyId,
                body: '<p>Use the installer</p><p>Then restart</p>',
                expectedRevision: st().revision,
            })
            login('pass.part.cy', 'moqui1!!')
            const history = run(F + 'get#PostHistory', {
                siteId,
                postId: replyId,
            })
            const diff = run(F + 'compare#PostRevisions', {
                siteId,
                postId: replyId,
                fromRevision: 1,
                toRevision: 2,
            }).diff
            const restoreDenied = failure(F + 'restore#PostRevision', {
                siteId,
                postId: replyId,
                revision: 1,
                expectedRevision: 2,
            })
            login('pass.part.ben', 'moqui1!!')
            const restored = run(F + 'restore#PostRevision', {
                siteId,
                postId: replyId,
                revision: 1,
                expectedRevision: 2,
            })
            const stale = failure(F + 'restore#PostRevision', {
                siteId,
                postId: replyId,
                revision: 1,
                expectedRevision: 2,
            })
            return { history, diff, restoreDenied, restored, stale, body: st() }
        },
        then({ history, diff, restoreDenied, restored, stale }) {
            history.revisionList.length === 2
            history.revisionList[0].current
            diff.stats.insertions === 1
            diff.html.includes('Then restart')
            restoreDenied.includes('not permitted')
            restored.revision === 3
            stale.includes('reload')
        },
    },
)
feature(
    'a wiki post accepts versioned edits from basic members, not new ones',
    {
        when() {
            login('john.doe')
            run(M + 'apply#TopicAction', {
                siteId,
                rootCommEventId: rootId,
                action: 'wiki',
                postId: otherReplyId,
                active: true,
                reason: 'Community answer',
                expectedRevision: run(F + 'get#Topic', {
                    siteId,
                    rootCommEventId: rootId,
                }).topic.revision,
            })
            login('pass.part.ana', 'moqui1!!')
            const st = entity('mantle.forum.ForumPostState', {
                communicationEventId: otherReplyId,
            })
            const edited = run(F + 'update#Post', {
                siteId,
                postId: otherReplyId,
                body: '<p>Or build from source with make</p>',
                expectedRevision: st.revision,
            })
            const conflict = failure(F + 'update#Post', {
                siteId,
                postId: otherReplyId,
                body: '<p>Stale</p>',
                expectedRevision: st.revision,
            })
            ready(party.ana, 'new')
            const newMember = failure(F + 'update#Post', {
                siteId,
                postId: otherReplyId,
                body: '<p>Again</p>',
                expectedRevision: edited.revision,
            })
            ready(party.ana, 'basic')
            const revision = entity('mantle.forum.ForumPostRevision', {
                communicationEventId: otherReplyId,
                revision: edited.revision,
            })
            return { edited, conflict, newMember, revision }
        },
        then({ edited, conflict, newMember, revision }) {
            edited.revision === 2
            conflict.includes('reload')
            newMember.includes('not permitted')
            revision.editorPartyId === party.ana
        },
    },
)
feature(
    'authors cannot delete a post replies depend on; deletion clears the answer and bookmark target',
    {
        when() {
            login('pass.part.cy', 'moqui1!!')
            ready(party.cy)
            publish({
                siteId,
                rootCommEventId: rootId,
                parentCommEventId: replyId,
                body: '<p>Thanks, that worked</p>',
            })
            login('pass.part.ben', 'moqui1!!')
            const st = entity('mantle.forum.ForumPostState', {
                communicationEventId: replyId,
            })
            const dependent = failure(F + 'delete#Post', {
                siteId,
                postId: replyId,
                expectedRevision: st.revision,
            })
            login('john.doe')
            run(F + 'delete#Post', {
                siteId,
                postId: replyId,
                expectedRevision: st.revision,
                reason: 'Outdated advice',
            })
            login('pass.part.cy', 'moqui1!!')
            const bookmarks = run(F + 'find#Bookmarks', { siteId }).bookmarkList
            logout()
            return {
                dependent,
                bookmarks,
                topic: run(F + 'get#Topic', { siteId, rootCommEventId: rootId })
                    .topic,
                posts: run(F + 'get#Posts', { siteId, rootCommEventId: rootId })
                    .postList,
            }
        },
        then({ dependent, bookmarks, topic, posts }) {
            dependent.includes('Replies depend')
            bookmarks.length === 1
            bookmarks[0].unavailable && !bookmarks[0].postId
            topic.acceptedAnswerId === null
            !posts.some((p) => p.postId === replyId)
        },
    },
)
feature('server pages show tags, polls, reactions, history and bookmarks', {
    when() {
        login('john.doe')
        run(S + 'store#Mounts', {
            siteId,
            expectedRevision: 2,
            mounts: [
                { app: 'forum', pathPrefix: '/forum' },
                { app: 'account', pathPrefix: '/account' },
                { app: 'members', pathPrefix: '/members' },
                { app: 'sites', pathPrefix: '/sites' },
            ],
            hosts: [{ hostname: 'part.example.test', canonical: true }],
        })
        const render = (path, params) => {
            const out = ec.screen
                .makeTest()
                .rootScreen('component://mr-pass/screen/Pass.xml')
                .render(
                    path,
                    {
                        resolvedSiteId: siteId,
                        publicHost: 'part.example.test',
                        publicPath: '/forum',
                        ...params,
                    },
                    null,
                )
            return { html: out.output, errors: out.errorMessages }
        }
        const slug = run(F + 'get#Topic', { siteId, rootCommEventId: rootId })
            .topic.slug
        login('pass.part.cy', 'moqui1!!')
        return {
            tags: render('Forum/Tags', {}),
            topic: render('Forum/Topics/TopicDetail', {
                rootCommEventId: rootId,
                requestedTopicSlug: slug,
            }),
            history: render('Forum/Topics/PostHistory', {
                postId: otherReplyId,
                fromRevision: '1',
                toRevision: '2',
            }),
            bookmarks: render('Forum/Bookmarks', {}),
        }
    },
    then({ tags, topic, history, bookmarks }) {
        tags.errors.length === 0
        tags.html.includes('/forum?tag=Install%20Help')
        topic.errors.length === 0
        topic.html.includes('Which platform?')
        topic.html.includes('name="formAction" value="setReaction"')
        topic.html.includes('Wiki post')
        topic.html.includes('PassTopicDetailStoreBookmark')
        history.errors.length === 0
        history.html.includes('moqui-diff')
        history.html.includes('make')
        bookmarks.errors.length === 0
        bookmarks.html.includes('Unavailable post')
    },
})
