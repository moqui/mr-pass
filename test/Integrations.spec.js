// S3 support and discussion contracts: case escalation with only the selected posts, exact case-reply previews,
// product and article discussion links, the article source gate across reads, search, feeds and email, and
// editorial drafts that stay unpublished.
const S = 'mantle.public.SiteServices.',
    F = 'mantle.forum.ForumServices.',
    D = 'mantle.forum.DeliveryServices.'
const op = () => ec.user.randomString(32)
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
    /publish#(Post|CaseReply)$/.test(name) ? postable() : null,
    call(name, {
        input: /publish#Post$|create#CaseFromTopic$|publish#CaseReply$|link#Discussion$|draft#ArticleFromTopic$|store#Category$/.test(
            name,
        )
            ? { operationId: op(), ...input }
            : input,
    }).result
)
const party = {}
let siteId = null,
    supportId,
    rootId,
    firstReply,
    secondReply,
    requestId
let articleTopic, wikiPageId, articleLinkId
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
const list = (name, fields) =>
    sys(() => Array.from(ec.entity.find(name).condition(fields).list()))
const as = (name, work) => {
    login('pass.int.' + name, 'moqui1!!')
    try {
        return work()
    } finally {
        login('john.doe')
    }
}
const wiki = (verb, input) =>
    sys(() => call('org.moqui.impl.WikiServices.' + verb, input))
/* Deliveries a member got for one post. */
const deliveriesFor = (partyId, postId) =>
    sys(() =>
        Array.from(
            ec.entity
                .find('mantle.forum.ForumDelivery')
                .condition({ siteId, partyId })
                .list(),
        ).filter(
            (d) =>
                ec.entity
                    .find('mantle.forum.ForumOutbox')
                    .condition('outboxId', d.outboxId)
                    .one()?.communicationEventId === postId,
        ),
    )
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
feature(
    'internal staff escalate a topic to a case with only the selected posts',
    {
        when() {
            party.owner = ec.user.userAccount.partyId
            siteId = run(S + 'create#Site', {
                name: 'Integrations',
                ownerPartyId: party.owner,
            }).siteId
            run(S + 'update#Site', {
                siteId,
                state: 'published',
                expectedRevision: 1,
            })
            supportId = run(F + 'store#Category', {
                siteId,
                name: 'Support',
            }).contactListId
            run(F + 'set#CategoryAccess', {
                siteId,
                contactListId: supportId,
                visibility: 'public',
                publicationState: 'published',
                expectedRevision: 1,
                confirm: true,
            })
            sys(() => {
                for (const name of ['ana', 'ben']) {
                    party[name] = call(
                        'mantle.party.PartyServices.create#Person',
                        {
                            firstName: name,
                            lastName: 'Customer',
                        },
                    ).partyId
                    call('mantle.party.PartyServices.create#PartyUserAccount', {
                        partyId: party[name],
                        username: 'pass.int.' + name,
                        emailAddress: name + '.int@example.test',
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
                for (const partyId of [party.ana, party.ben, party.owner]) {
                    call('create#mantle.marketing.contact.ContactListParty', {
                        contactListId: supportId,
                        partyId,
                        statusId: 'CLPT_ACCEPTED',
                        fromDate: at - 1000,
                    })
                    call('store#mantle.forum.ForumMemberState', {
                        siteId,
                        partyId,
                        trustLevel: 'basic',
                        approvedContributions: 10,
                        dailyTopics: 0,
                        dailyReplies: 0,
                        revision: 1,
                    })
                }
            })
            const root = as('ana', () =>
                run(F + 'publish#Post', {
                    siteId,
                    contactListId: supportId,
                    title: 'Printer will not start',
                    body: '<p>Order 1234 printer stays dark</p>',
                }),
            )
            rootId = root.rootCommEventId
            firstReply = as('ben', () =>
                run(F + 'publish#Post', {
                    siteId,
                    rootCommEventId: rootId,
                    body: '<p>Mine too, after the update</p>',
                }),
            ).postId
            secondReply = as('ana', () =>
                run(F + 'publish#Post', {
                    siteId,
                    rootCommEventId: rootId,
                    body: '<p>Unrelated aside</p>',
                }),
            ).postId
            const operationId = op()
            const created = run(F + 'create#CaseFromTopic', {
                siteId,
                rootCommEventId: rootId,
                postIds: [rootId, firstReply],
                reason: 'Hardware fault',
                operationId,
            })
            requestId = created.requestId
            const replay = run(F + 'create#CaseFromTopic', {
                siteId,
                rootCommEventId: rootId,
                postIds: [rootId, firstReply],
                reason: 'Hardware fault',
                operationId,
            })
            const request = list('mantle.request.Request', { requestId })[0]
            const comments = list('mantle.request.RequestCommEvent', {
                requestId,
            })
                .map(
                    (r) =>
                        list('mantle.party.communication.CommunicationEvent', {
                            communicationEventId: r.communicationEventId,
                        })[0],
                )
                .filter((e) => e.communicationEventId !== rootId)
            const customer = list('mantle.request.RequestParty', {
                requestId,
                roleTypeId: 'Customer',
            })
            const posts = as('ana', () =>
                run(F + 'get#Posts', { siteId, rootCommEventId: rootId }),
            ).postList
            const memberCase = as('ana', () =>
                failure(F + 'create#CaseFromTopic', {
                    siteId,
                    rootCommEventId: rootId,
                    postIds: [rootId],
                    reason: 'Mine',
                }),
            )
            const otherTopicPost = failure(F + 'create#CaseFromTopic', {
                siteId,
                rootCommEventId: rootId,
                postIds: ['NO_SUCH_POST'],
                reason: 'Wrong',
            })
            return {
                created,
                replay,
                request,
                comments,
                customer,
                posts,
                memberCase,
                otherTopicPost,
            }
        },
        then({
            created,
            replay,
            request,
            comments,
            customer,
            posts,
            memberCase,
            otherTopicPost,
        }) {
            replay.requestId === created.requestId
            request.requestTypeEnumId === 'RqtSupport'
            customer[0].partyId === party.ana
            comments.length === 1
            comments[0].body.includes('Mine too, after the update')
            !comments[0].body.includes('Unrelated aside')
            posts.length === 3
            !posts.some((p) => String(p.body).includes('From forum topic'))
            memberCase.includes('Internal staff')
            otherTopicPost.includes('visible posts')
        },
    },
)
feature(
    'case links are staff-only; a case reply publishes exactly what was previewed',
    {
        when() {
            const memberLinks = as('ana', () =>
                run(F + 'get#TopicLinks', { siteId, rootCommEventId: rootId }),
            )
            const staffLinks = run(F + 'get#TopicLinks', {
                siteId,
                rootCommEventId: rootId,
            })
            const body =
                '<p>We are sending a replacement <script>x()</script></p>'
            const preview = run(F + 'preview#CaseReply', {
                siteId,
                rootCommEventId: rootId,
                requestId,
                body,
            })
            const stale = failure(F + 'publish#CaseReply', {
                siteId,
                rootCommEventId: rootId,
                requestId,
                body: body + '<p>edited</p>',
                previewHash: preview.previewHash,
            })
            const published = run(F + 'publish#CaseReply', {
                siteId,
                rootCommEventId: rootId,
                requestId,
                body,
                previewHash: preview.previewHash,
            })
            const joined = list('mantle.request.RequestCommEvent', {
                requestId,
                communicationEventId: published.postId,
            })
            const wrongCase = failure(F + 'preview#CaseReply', {
                siteId,
                rootCommEventId: rootId,
                requestId: 'NO_SUCH_CASE',
                body,
            })
            return {
                memberLinks,
                staffLinks,
                preview,
                stale,
                published,
                joined,
                wrongCase,
            }
        },
        then({
            memberLinks,
            staffLinks,
            preview,
            stale,
            published,
            joined,
            wrongCase,
        }) {
            memberLinks.linkList.length === 0
            !memberLinks.capabilities.canCreateCase
            staffLinks.linkList.some(
                (l) => l.sourceType === 'case' && l.sourceId === requestId,
            )
            !preview.body.includes('script')
            preview.audience.includes('public')
            stale.includes('preview it again')
            published.state === 'published'
            joined.length === 1
            wrongCase.includes('not found')
        },
    },
)
feature('a linked product shows publicly only while a site store carries it', {
    when() {
        sys(() => {
            call('create#mantle.product.Product', {
                productId: 'PASS_PRINTER',
                productTypeEnumId: 'PtAsset',
                productName: 'Desk printer',
            })
            call('create#mantle.product.store.ProductStore', {
                productStoreId: 'PASS_STORE',
                storeName: 'PASS store',
            })
        })
        const linked = run(F + 'link#Discussion', {
            siteId,
            rootCommEventId: rootId,
            sourceType: 'product',
            sourceId: 'PASS_PRINTER',
        })
        const again = run(F + 'link#Discussion', {
            siteId,
            rootCommEventId: rootId,
            sourceType: 'product',
            sourceId: 'PASS_PRINTER',
        })
        const hidden = as('ana', () =>
            run(F + 'get#TopicLinks', { siteId, rootCommEventId: rootId }),
        ).linkList
        const staffSees = run(F + 'get#TopicLinks', {
            siteId,
            rootCommEventId: rootId,
        }).linkList.find((l) => l.sourceType === 'product')
        sys(() => {
            call('create#mantle.public.PublicSiteApp', {
                siteId,
                appMountId: 'store',
                app: 'store',
                pathPrefix: '/store',
                enabled: 'Y',
                targetId: 'PASS_STORE',
            })
            call('create#mantle.product.store.ProductStoreProduct', {
                productStoreId: 'PASS_STORE',
                productId: 'PASS_PRINTER',
            })
        })
        const shown = as('ana', () =>
            run(F + 'get#TopicLinks', { siteId, rootCommEventId: rootId }),
        ).linkList
        const joins = list(
            'mantle.party.communication.CommunicationEventProduct',
            { communicationEventId: rootId },
        )
        const memberLinks = as('ana', () =>
            failure(F + 'link#Discussion', {
                siteId,
                rootCommEventId: rootId,
                sourceType: 'product',
                sourceId: 'PASS_PRINTER',
            }),
        )
        return { linked, again, hidden, staffSees, shown, joins, memberLinks }
    },
    then({ linked, again, hidden, staffSees, shown, joins, memberLinks }) {
        again.linkId === linked.linkId
        !hidden.some((l) => l.sourceType === 'product')
        staffSees.published === false
        shown.some(
            (l) =>
                l.sourceType === 'product' &&
                l.published &&
                l.title === 'Desk printer',
        )
        joins.length === 1
        memberLinks !== ''
    },
})
feature(
    'an article discussion closes everywhere when the article is withdrawn',
    {
        when() {
            wiki('create#WikiSpace', {
                wikiSpaceId: 'PASSPUB',
                description: 'PASS publishing fixture',
            })
            wikiPageId = wiki('update#WikiPage', {
                wikiSpaceId: 'PASSPUB',
                pageName: 'Printer care',
                pageText: 'Keep it dusted\n',
            }).wikiPageId
            const version = wiki('get#WikiPageHistory', { wikiPageId })
                .versionList[0].versionName
            wiki('set#PublishedVersion', {
                wikiPageId,
                publishedVersionName: version,
            })
            articleTopic = as('ana', () =>
                run(F + 'publish#Post', {
                    siteId,
                    contactListId: supportId,
                    title: 'Comments on printer care',
                    body: '<p>Great article</p>',
                }),
            ).rootCommEventId
            articleLinkId = run(F + 'link#Discussion', {
                siteId,
                rootCommEventId: articleTopic,
                sourceType: 'article',
                sourceId: wikiPageId,
            }).linkId
            const secondTopic = failure(F + 'link#Discussion', {
                siteId,
                rootCommEventId: rootId,
                sourceType: 'article',
                sourceId: wikiPageId,
            })
            // Ana watches the discussion, so a reply would notify her.
            as('ana', () => {
                const current = run(D + 'get#Preferences', {
                    siteId,
                    scopeType: 'topic',
                    scopeId: articleTopic,
                })
                run(D + 'set#Preferences', {
                    siteId,
                    scopeType: 'topic',
                    scopeId: articleTopic,
                    watchLevel: 'Watching',
                    emailMode: 'None',
                    expectedRevision: current.revision,
                })
            })
            const openReply = run(F + 'publish#Post', {
                siteId,
                rootCommEventId: articleTopic,
                body: '<p>Thanks for reading</p>',
            }).postId
            sys(() =>
                call('mantle.forum.DeliveryWorkerServices.dispatch#Outbox', {}),
            )
            const openDeliveries = deliveriesFor(party.ana, openReply).length
            const readOpen = as('ana', () =>
                failure(F + 'get#Topic', {
                    siteId,
                    rootCommEventId: articleTopic,
                }),
            )
            // Withdraw the article: no published version.
            sys(() => {
                const page = ec.entity
                    .find('moqui.resource.wiki.WikiPage')
                    .condition('wikiPageId', wikiPageId)
                    .one()
                page.set('publishedVersionName', null)
                page.update()
            })
            const closedReply = run(F + 'publish#Post', {
                siteId,
                rootCommEventId: articleTopic,
                body: '<p>Article withdrawn for revision</p>',
            }).postId
            sys(() =>
                call('mantle.forum.DeliveryWorkerServices.dispatch#Outbox', {}),
            )
            const closedDeliveries = deliveriesFor(
                party.ana,
                closedReply,
            ).length
            const readClosed = as('ana', () =>
                failure(F + 'get#Topic', {
                    siteId,
                    rootCommEventId: articleTopic,
                }),
            )
            const listed = as('ana', () =>
                run(F + 'find#Topics', { siteId, contactListId: supportId }),
            ).topicList.map((t) => t.rootCommEventId)
            const searched = as('ana', () =>
                run(F + 'search#Forum', { siteId, query: 'printer care' }),
            ).topicList.map((t) => t.rootCommEventId)
            sys(() => {
                call('create#mantle.public.PublicSiteHost', {
                    hostname: 'integrations.example.test',
                    siteId,
                    canonical: 'Y',
                })
                call('create#mantle.public.PublicSiteApp', {
                    siteId,
                    appMountId: 'forum',
                    app: 'forum',
                    pathPrefix: '/',
                    enabled: 'Y',
                })
            })
            logout()
            const feed = run(F + 'get#Feed', { siteId })
            login('john.doe')
            const staffReads = failure(F + 'get#Topic', {
                siteId,
                rootCommEventId: articleTopic,
            })
            const unconfirmed = failure(F + 'detach#Discussion', {
                siteId,
                linkId: articleLinkId,
                reason: 'Keep the comments',
            })
            run(F + 'detach#Discussion', {
                siteId,
                linkId: articleLinkId,
                confirmAudience: true,
                reason: 'Keep the comments',
            })
            const readDetached = as('ana', () =>
                failure(F + 'get#Topic', {
                    siteId,
                    rootCommEventId: articleTopic,
                }),
            )
            return {
                secondTopic,
                openDeliveries,
                readOpen,
                closedDeliveries,
                readClosed,
                listed,
                searched,
                feed,
                staffReads,
                unconfirmed,
                readDetached,
            }
        },
        then({
            secondTopic,
            openDeliveries,
            readOpen,
            closedDeliveries,
            readClosed,
            listed,
            searched,
            feed,
            staffReads,
            unconfirmed,
            readDetached,
        }) {
            secondTopic.includes('already has a discussion')
            openDeliveries > 0
            readOpen === ''
            closedDeliveries === 0
            readClosed.includes('not found')
            !listed.includes(articleTopic)
            listed.includes(rootId)
            !searched.includes(articleTopic)
            !JSON.stringify(feed).includes('Comments on printer care')
            JSON.stringify(feed).includes('Printer will not start')
            staffReads === ''
            unconfirmed.includes('confirm the audience')
            readDetached === ''
        },
    },
)
feature(
    'an article drafted from a topic is an unpublished page with a review request',
    {
        when() {
            const disabled = failure(F + 'draft#ArticleFromTopic', {
                siteId,
                rootCommEventId: rootId,
                postIds: [rootId],
                reviewerUsername: 'john.doe',
            })
            const site = run(S + 'find#Sites', { siteId }).siteList[0]
            run(S + 'update#Site', {
                siteId,
                publishingWikiSpaceId: 'PASSPUB',
                expectedRevision: site.policyRevision,
            })
            const noReviewer = failure(F + 'draft#ArticleFromTopic', {
                siteId,
                rootCommEventId: rootId,
                postIds: [rootId],
                title: 'Printer start fix',
            })
            const draft = run(F + 'draft#ArticleFromTopic', {
                siteId,
                rootCommEventId: rootId,
                postIds: [rootId, firstReply],
                title: 'Printer start fix',
                reviewerUsername: 'john.doe',
                reason: 'Common question',
            })
            const page = list('moqui.resource.wiki.WikiPage', {
                wikiPageId: draft.wikiPageId,
            })[0]
            const reviews = list('moqui.resource.wiki.WikiPageReview', {
                wikiPageId: draft.wikiPageId,
            })
            const memberCards = as('ana', () =>
                run(F + 'get#TopicLinks', { siteId, rootCommEventId: rootId }),
            ).linkList
            const staff = run(F + 'get#TopicLinks', {
                siteId,
                rootCommEventId: rootId,
            })
            const readable = as('ana', () =>
                failure(F + 'get#Topic', { siteId, rootCommEventId: rootId }),
            )
            return {
                disabled,
                noReviewer,
                page,
                reviews,
                memberCards,
                staff,
                readable,
            }
        },
        then({
            disabled,
            noReviewer,
            page,
            reviews,
            memberCards,
            staff,
            readable,
        }) {
            disabled.includes('no publishing space')
            noReviewer.includes('internal reviewer')
            !page.publishedVersionName
            reviews.length === 1
            !memberCards.some((l) => l.sourceType === 'article')
            staff.linkList.some(
                (l) => l.sourceType === 'article' && l.published === false,
            )
            staff.capabilities.canDraftArticle
            readable === ''
        },
    },
)
