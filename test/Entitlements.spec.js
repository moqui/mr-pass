// S3 entitlements: manual and subscription-sourced access grants, the subscription lifecycle handlers, qualifying
// sources, overlapping sources, expiry and the absence of any UserGroup change.
const S = 'mantle.public.SiteServices.',
    F = 'mantle.forum.ForumServices.',
    M = 'mantle.forum.ModerationServices.',
    N = 'mantle.forum.EntitlementServices.',
    SUB = 'mantle.product.subscription.'
const op = () => ec.user.randomString(32)
const run = (name, input) =>
    call(name, {
        input: /set#AccessGrant$|set#Sanction$|publish#Post$/.test(name)
            ? { operationId: op(), ...input }
            : input,
    }).result
const party = {}
let siteId, paidId, openId, firstSub, secondSub
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
const grants = (partyId, sourceType) =>
    list('mantle.public.PublicAccessGrant', { siteId, partyId, sourceType })
/* Whether the signed-in member can read the paid category. */
const readsPaid = () =>
    failure(F + 'get#Category', { siteId, contactListId: paidId }) === ''
const as = (name, work) => {
    login('pass.ent.' + name, 'moqui1!!')
    try {
        return work()
    } finally {
        login('john.doe')
    }
}
/* A paid order line for a member, then the Mantle fulfillment that calls the resource's handlers. */
function buyMonth(partyId) {
    return sys(() => {
        const orderId = ec.user.randomString(20)
        call('create#mantle.order.OrderHeader', {
            orderId,
            statusId: 'OrderApproved',
            entryDate: Date.now(),
        })
        call('create#mantle.order.OrderPart', {
            orderId,
            orderPartSeqId: '01',
            customerPartyId: partyId,
        })
        call('create#mantle.order.OrderItem', {
            orderId,
            orderItemSeqId: '01',
            orderPartSeqId: '01',
            productId: 'PASS_PAID_MONTH',
            quantity: 1,
            unitAmount: 5,
        })
        return call(
            'mantle.product.SubscriptionServices.fulfill#ProductSubscriptionResource',
            {
                orderId,
                orderItemSeqId: '01',
                productId: 'PASS_PAID_MONTH',
                subscriptionResourceId: 'PASS_PAID',
            },
        ).subscriptionId
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
feature(
    'a staff grant opens a restricted category to a member and lets them post',
    {
        when() {
            party.owner = ec.user.userAccount.partyId
            siteId = run(S + 'create#Site', {
                name: 'Entitlements',
                ownerPartyId: party.owner,
            }).siteId
            run(S + 'update#Site', {
                siteId,
                state: 'published',
                expectedRevision: 1,
            })
            paidId = run(F + 'store#Category', {
                siteId,
                operationId: op(),
                name: 'Paid',
            }).contactListId
            openId = run(F + 'store#Category', {
                siteId,
                operationId: op(),
                name: 'Open',
            }).contactListId
            for (const [contactListId, visibility] of [
                [paidId, 'category'],
                [openId, 'public'],
            ])
                run(F + 'set#CategoryAccess', {
                    siteId,
                    contactListId,
                    visibility,
                    publicationState: 'published',
                    expectedRevision: 1,
                    confirm: true,
                })
            sys(() => {
                for (const name of ['ana', 'ben', 'cy']) {
                    party[name] = call(
                        'mantle.party.PartyServices.create#Person',
                        {
                            firstName: name,
                            lastName: 'Subscriber',
                        },
                    ).partyId
                    call('mantle.party.PartyServices.create#PartyUserAccount', {
                        partyId: party[name],
                        username: 'pass.ent.' + name,
                        emailAddress: name + '.ent@example.test',
                        newPassword: 'moqui1!!',
                        newPasswordVerify: 'moqui1!!',
                    })
                    const userId = ec.entity
                        .find('moqui.security.UserAccount')
                        .condition('username', 'pass.ent.' + name)
                        .one().userId
                    call('create#moqui.security.public.VerifiedAddress', {
                        userId,
                        emailAddress: name + '.ent@example.test',
                        verifiedAt: at,
                    })
                    // Ben joins later through his subscription; the others are members now.
                    if (name !== 'ben')
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
            const before = as('ana', readsPaid)
            const noReason = failure(S + 'set#AccessGrant', {
                siteId,
                handle: 'ana',
                targetType: 'category',
                contactListId: paidId,
            })
            const granted = run(S + 'set#AccessGrant', {
                siteId,
                handle: 'ana',
                targetType: 'category',
                contactListId: paidId,
                reason: 'Sponsor',
            })
            const after = as('ana', readsPaid)
            const posted = as('ana', () =>
                run(F + 'publish#Post', {
                    siteId,
                    contactListId: paidId,
                    title: 'Paid members welcome',
                    body: '<p>Hello paid members</p>',
                }),
            )
            // Ana is a member now: she still cannot grant herself or reach a category she does not moderate.
            const selfGrant = as('ana', () =>
                failure(S + 'set#AccessGrant', {
                    siteId,
                    handle: 'ana',
                    targetType: 'category',
                    contactListId: openId,
                    reason: 'Me',
                }),
            )
            return { before, noReason, granted, after, posted, selfGrant }
        },
        then({ before, noReason, granted, after, posted, selfGrant }) {
            !before
            noReason.includes('reason')
            granted.revision === 1
            after
            posted.state === 'published'
            selfGrant.includes('moderator')
        },
    },
)
feature(
    'an operator binds a subscription resource to the category and its handlers',
    {
        when() {
            sys(() => {
                call(
                    'create#mantle.product.subscription.SubscriptionResource',
                    {
                        subscriptionResourceId: 'PASS_PAID',
                        description: 'Paid forum',
                    },
                )
                call(
                    'create#mantle.product.subscription.SubscriptionResource',
                    {
                        subscriptionResourceId: 'PASS_OTHER',
                        description: 'Other resource',
                        initServiceName:
                            'mantle.product.TenantSubscriptionServices.init#Tenant',
                    },
                )
                call('create#mantle.product.Product', {
                    productId: 'PASS_PAID_MONTH',
                    productTypeEnumId: 'PtDigital',
                    productName: 'Paid forum month',
                })
                call(
                    'create#mantle.product.subscription.ProductSubscriptionResource',
                    {
                        productId: 'PASS_PAID_MONTH',
                        subscriptionResourceId: 'PASS_PAID',
                        fromDate: at - 86400000,
                        availableTime: 1,
                        availableTimeUomId: 'TF_mon',
                    },
                )
            })
            const bound = run(S + 'store#SubscriptionBinding', {
                siteId,
                subscriptionResourceId: 'PASS_PAID',
                targetType: 'category',
                contactListId: paidId,
            })
            const resource = list(SUB + 'SubscriptionResource', {
                subscriptionResourceId: 'PASS_PAID',
            })[0]
            const rescope = failure(S + 'store#SubscriptionBinding', {
                siteId,
                subscriptionResourceId: 'PASS_PAID',
                targetType: 'site',
            })
            const foreign = failure(S + 'store#SubscriptionBinding', {
                siteId,
                subscriptionResourceId: 'PASS_OTHER',
                targetType: 'site',
            })
            const memberBinds = as('cy', () =>
                failure(S + 'store#SubscriptionBinding', {
                    siteId,
                    subscriptionResourceId: 'PASS_PAID',
                    targetType: 'category',
                    contactListId: paidId,
                }),
            )
            return { bound, resource, rescope, foreign, memberBinds }
        },
        then({ bound, resource, rescope, foreign, memberBinds }) {
            bound.subscriptionResourceId === 'PASS_PAID'
            resource.initServiceName === N + 'init#ForumAccess'
            resource.revokeAccessServiceName === N + 'revoke#ForumAccess'
            rescope.includes('keeps its scope')
            foreign.includes('other access services')
            memberBinds !== ''
        },
    },
)
feature(
    'a purchase grants only when the category qualifies subscriptions, and lets the buyer join',
    {
        when() {
            firstSub = buyMonth(party.ben)
            const rows = grants(party.ben, 'subscription')
            const joinBefore = as('ben', () =>
                failure(S + 'join#Site', { siteId }),
            )
            const readBefore = as('ben', readsPaid)
            const preview = run(F + 'preview#CategoryAccess', {
                siteId,
                contactListId: paidId,
                visibility: 'category',
                qualifyingSources: ['manual', 'subscription'],
            })
            run(F + 'set#CategoryAccess', {
                siteId,
                contactListId: paidId,
                visibility: 'category',
                publicationState: 'published',
                qualifyingSources: ['manual', 'subscription'],
                expectedRevision: preview.expectedRevision,
                confirm: true,
            })
            const badSource = failure(F + 'set#CategoryAccess', {
                siteId,
                contactListId: paidId,
                visibility: 'category',
                publicationState: 'published',
                qualifyingSources: ['organization'],
                expectedRevision: preview.expectedRevision + 1,
                confirm: true,
            })
            // The purchase qualifies the buyer to join only once the category counts subscriptions.
            const joinAfter = as('ben', () =>
                failure(S + 'join#Site', { siteId }),
            )
            const readAfter = as('ben', readsPaid)
            const groups = sys(() =>
                Array.from(
                    ec.entity
                        .find('moqui.security.UserGroupMember')
                        .condition(
                            'userId',
                            ec.entity
                                .find('moqui.security.UserAccount')
                                .condition('username', 'pass.ent.ben')
                                .one().userId,
                        )
                        .list(),
                ).filter((g) => g.userGroupId !== 'ALL_USERS'),
            )
            const membership = as('ben', () =>
                run(S + 'get#Membership', { siteId }),
            )
            return {
                rows,
                joinBefore,
                joinAfter,
                readBefore,
                preview,
                badSource,
                readAfter,
                groups,
                membership,
            }
        },
        then({
            rows,
            joinBefore,
            joinAfter,
            readBefore,
            preview,
            badSource,
            readAfter,
            groups,
            membership,
        }) {
            rows.length === 1
            rows[0].targetId === paidId && !rows[0].revokedAt
            joinBefore.includes('invitation')
            joinAfter === ''
            !readBefore
            preview.proposedQualifyingSources.join() === 'manual,subscription'
            badSource.includes('Qualifying sources')
            readAfter
            groups.length === 0
            membership.entitlements.some(
                (e) => e.sourceType === 'subscription' && e.active,
            )
        },
    },
)
feature('replayed handlers do not duplicate; renewal adds the next period', {
    when() {
        sys(() => {
            call(N + 'init#ForumAccess', { subscriptionId: firstSub })
            call(N + 'renew#ForumAccess', { subscriptionId: firstSub })
        })
        const afterReplay = grants(party.ben, 'subscription').length
        secondSub = buyMonth(party.ben)
        const rows = grants(party.ben, 'subscription')
        const first = list(SUB + 'Subscription', {
                subscriptionId: firstSub,
            })[0],
            second = list(SUB + 'Subscription', {
                subscriptionId: secondSub,
            })[0]
        return { afterReplay, rows, first, second }
    },
    then({ afterReplay, rows, first, second }) {
        afterReplay === 1
        rows.length === 2
        ec.user.timestampMillis(second.fromDate) ===
            ec.user.timestampMillis(first.thruDate)
    },
})
feature(
    'revoking one period keeps the current one; manual and subscription sources stay separate',
    {
        when() {
            // The renewal's period starts when the first ends: revoking it leaves the current period.
            sys(() =>
                call(N + 'revoke#ForumAccess', { subscriptionId: secondSub }),
            )
            const firstRevoked = as('ben', readsPaid)
            sys(() =>
                call(N + 'revoke#ForumAccess', { subscriptionId: firstSub }),
            )
            const bothRevoked = as('ben', readsPaid)
            // A replayed renewal does not lift a revocation.
            sys(() =>
                call(N + 'renew#ForumAccess', { subscriptionId: firstSub }),
            )
            const replayed = as('ben', readsPaid)
            const manual = run(S + 'set#AccessGrant', {
                siteId,
                handle: 'ben',
                targetType: 'category',
                contactListId: paidId,
                reason: 'Courtesy',
            })
            const withManual = as('ben', readsPaid)
            const subscriptionGrant = grants(party.ben, 'subscription')[0]
            const endSubscription = failure(S + 'end#AccessGrant', {
                siteId,
                grantId: subscriptionGrant.grantId,
                expectedRevision: Number(subscriptionGrant.revision),
                reason: 'No',
            })
            run(S + 'end#AccessGrant', {
                siteId,
                grantId: manual.grantId,
                expectedRevision: 1,
                reason: 'Courtesy over',
            })
            const manualEnded = as('ben', readsPaid)
            sys(() =>
                call(N + 'restore#ForumAccess', { subscriptionId: firstSub }),
            )
            const restored = as('ben', readsPaid)
            const found = run(S + 'find#AccessGrants', {
                siteId,
                contactListId: paidId,
                handle: 'ben',
            }).grantList
            return {
                firstRevoked,
                bothRevoked,
                replayed,
                withManual,
                endSubscription,
                manualEnded,
                restored,
                found,
            }
        },
        then({
            firstRevoked,
            bothRevoked,
            replayed,
            withManual,
            endSubscription,
            manualEnded,
            restored,
            found,
        }) {
            firstRevoked
            !bothRevoked
            !replayed
            withManual
            endSubscription.includes('follows its subscription')
            !manualEnded
            restored
            found.length === 3
            found.every((g) => g.sourceId === undefined && g.handle === 'ben')
        },
    },
)
feature(
    'the expiry job revokes an ended subscription once and skips one a renewal continued',
    {
        when() {
            // Time passes: both periods end, the first before the second.
            sys(() => {
                const day = 86400000
                for (const [subscriptionId, thru] of [
                    [firstSub, Date.now() - 3 * day],
                    [secondSub, Date.now() - day],
                ]) {
                    const sub = ec.entity
                        .find(SUB + 'Subscription')
                        .condition('subscriptionId', subscriptionId)
                        .one()
                    sub.set('fromDate', thru - 30 * day)
                    sub.set('thruDate', thru)
                    sub.update()
                    call(N + 'restore#ForumAccess', { subscriptionId })
                }
            })
            const expired = as('ben', readsPaid)
            sys(() =>
                call(
                    'mantle.product.SubscriptionServices.expire#SubscriptionAccess',
                ),
            )
            const first = list(SUB + 'Subscription', {
                    subscriptionId: firstSub,
                })[0],
                second = list(SUB + 'Subscription', {
                    subscriptionId: secondSub,
                })[0]
            const rows = grants(party.ben, 'subscription')
            const firstGrant = rows.find((g) => g.sourceId === firstSub),
                secondGrant = rows.find((g) => g.sourceId === secondSub)
            // A second run finds nothing left to do.
            sys(() =>
                call(
                    'mantle.product.SubscriptionServices.expire#SubscriptionAccess',
                ),
            )
            const again = list(SUB + 'Subscription', {
                subscriptionId: secondSub,
            })[0]
            return { expired, first, second, firstGrant, secondGrant, again }
        },
        then({ expired, first, second, firstGrant, secondGrant, again }) {
            !expired
            !!first.accessRevokedDate && !!second.accessRevokedDate
            !!second.destroyedDate
            !firstGrant.revokedAt
            !!secondGrant.revokedAt
            ec.user.timestampMillis(again.accessRevokedDate) ===
                ec.user.timestampMillis(second.accessRevokedDate)
        },
    },
)
feature('a suspended member stays out despite a grant', {
    when() {
        const before = as('ana', readsPaid)
        run(M + 'set#Sanction', {
            siteId,
            targetPartyId: party.ana,
            kind: 'suspend',
            reason: 'Cooling off',
        })
        const after = as('ana', readsPaid)
        const own = as('ana', () => run(S + 'get#Membership', { siteId }))
        return { before, after, own }
    },
    then({ before, after, own }) {
        before
        !after
        own.entitlements.some((e) => e.sourceType === 'manual' && e.active)
    },
})
feature(
    'approving a real order of a bound product writes the grant through the subscription lifecycle',
    {
        when() {
            const customerPartyId = 'JoeDist'
            const orderId = sys(() => {
                call(
                    'create#mantle.product.subscription.ProductSubscriptionResource',
                    {
                        productId: 'DEMO_DIG_SER',
                        subscriptionResourceId: 'PASS_PAID',
                        fromDate: at - 86400000,
                        availableTime: 1,
                        availableTimeUomId: 'TF_mon',
                    },
                )
                const created = call(
                    'mantle.order.OrderServices.create#Order',
                    {
                        vendorPartyId: 'ORG_ZIZI_RETAIL',
                        customerPartyId,
                        facilityId: 'ZIRET_WH',
                    },
                )
                call('mantle.order.OrderServices.add#OrderProductQuantity', {
                    orderId: created.orderId,
                    orderPartSeqId: created.orderPartSeqId,
                    productId: 'DEMO_DIG_SER',
                    quantity: 1,
                    unitAmount: 20,
                    requireInventory: false,
                })
                call(
                    'mantle.order.OrderServices.set#OrderBillingShippingInfo',
                    {
                        orderId: created.orderId,
                        orderPartSeqId: created.orderPartSeqId,
                        shippingPostalContactMechId: 'JoeDistAddr',
                        carrierPartyId: '_NA_',
                        shipmentMethodEnumId: 'ShMthGround',
                    },
                )
                call('mantle.order.OrderServices.place#Order', {
                    orderId: created.orderId,
                    requireInventory: false,
                })
                call('mantle.order.OrderServices.approve#Order', {
                    orderId: created.orderId,
                })
                return created.orderId
            })
            const sub = list(SUB + 'Subscription', {
                orderId,
                subscriberPartyId: customerPartyId,
                subscriptionResourceId: 'PASS_PAID',
            })[0]
            const rows = grants(customerPartyId, 'subscription')
            return { sub, rows }
        },
        then({ sub, rows }) {
            !!sub
            rows.length === 1
            rows[0].sourceId === sub.subscriptionId
            rows[0].targetType === 'category' && rows[0].targetId === paidId
        },
    },
)
feature('a site grant opens only categories that chose their qualifying sources', {
    when() {
        const backRoom = run(F + 'store#Category', {
            siteId,
            operationId: op(),
            name: 'Back room',
        }).contactListId
        run(F + 'set#CategoryAccess', {
            siteId,
            contactListId: backRoom,
            visibility: 'category',
            publicationState: 'published',
            expectedRevision: 1,
            confirm: true,
        })
        run(S + 'set#AccessGrant', {
            siteId,
            handle: 'cy',
            targetType: 'site',
            reason: 'Let in past closed registration',
        })
        const readsBackRoom = () =>
            failure(F + 'get#Category', { siteId, contactListId: backRoom }) === ''
        const before = as('cy', readsBackRoom)
        const c = list('mantle.forum.ForumCategory', { contactListId: backRoom })[0]
        run(F + 'set#CategoryAccess', {
            siteId,
            contactListId: backRoom,
            visibility: 'category',
            publicationState: 'published',
            qualifyingSources: ['manual'],
            expectedRevision: Number(c.policyRevision),
            confirm: true,
        })
        const after = as('cy', readsBackRoom)
        return { before, after }
    },
    then({ before, after }) {
        !before
        after
    },
})
