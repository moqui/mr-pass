/* Screen definitions select fixed operations, forms and public projections. CC0 plus patent grant. */
const call = (op, input) =>
    ec.service
        .sync()
        .throwOnError(true)
        .name('pass.Facade.call#Operation')
        .parameters({ operation: op, input })
        .call().result
const field = (name, label, type = 'text', options = null) => ({
    name,
    label,
    type,
    options,
})
const text = (name, label) => field(name, label)
const form = (op, label, fields) => ({ op, label, fields })
const definitions = {
    Topics: {
        title: 'Latest topics',
        read: 'findTopics',
        list: 'topicList',
        link: 'topic',
        params: ['view', 'tag', 'solved', 'period'],
    },
    Tags: {
        title: 'Tags',
        read: 'findTags',
        list: 'tagList',
        link: 'tag',
        params: ['query'],
    },
    Bookmarks: {
        title: 'Bookmarks',
        read: 'findBookmarks',
        list: 'bookmarkList',
        link: 'post',
        forms: [
            form('storeBookmark', 'Edit bookmark', [
                text('bookmarkId', 'Bookmark'),
                text('note', 'Note'),
                field('remindAt', 'Remind me at', 'datetime'),
                field('expectedRevision', 'Bookmark revision', 'number'),
            ]),
            form('removeBookmark', 'Remove bookmark', [
                text('bookmarkId', 'Bookmark'),
            ]),
        ],
    },
    PostHistory: {
        title: 'Post history',
        read: 'getPostHistory',
        list: 'revisionList',
        params: ['postId'],
        forms: [
            form('restorePostRevision', 'Restore this revision', [
                field('revision', 'Revision to restore', 'number'),
                text('reason', 'Reason'),
                field('expectedRevision', 'Current revision', 'number'),
            ]),
        ],
    },
    Categories: {
        title: 'Categories',
        read: 'findCategories',
        list: 'categoryList',
        link: 'category',
    },
    CategoryDetail: {
        title: 'Category topics',
        read: 'findTopics',
        list: 'topicList',
        link: 'topic',
        params: ['contactListId'],
        forms: [
            form('joinCategory', 'Join category', []),
            form('leaveCategory', 'Leave category', []),
        ],
    },
    Search: {
        title: 'Search',
        read: 'searchForum',
        list: 'topicList',
        link: 'topic',
        params: ['query', 'contactListId'],
        optional: 'query',
    },
    Guidelines: {
        title: 'Community guidelines',
        read: 'getSitePage',
        params: ['pageRole'],
        defaults: { pageRole: 'guidelines' },
        body: 'page',
    },
    TopicDetail: {
        title: 'Topic',
        read: 'getPosts',
        list: 'postList',
        params: ['rootCommEventId'],
        stream: true,
        forms: [
            form('setPreferences', 'Topic notifications', [
                field('watchLevel', 'Notifications', 'select', [
                    'Normal',
                    'Muted',
                    'Tracking',
                    'Watching',
                ]),
                field('emailMode', 'Email', 'select', [
                    'Notifications',
                    'None',
                ]),
                field('expectedRevision', 'Preference revision', 'hidden'),
            ]),
            form('flagPost', 'Report a post', [
                text('postId', 'Post'),
                text('reason', 'Reason'),
            ]),
            form('setReaction', 'React', []),
            form('votePoll', 'Vote', []),
            form('storeBookmark', 'Bookmark a post', [
                text('postId', 'Post'),
                text('note', 'Note'),
                field('remindAt', 'Remind me at', 'datetime'),
            ]),
            form('acceptAnswer', 'Accept an answer', [
                text('postId', 'Answer (empty to clear)'),
                field('expectedRevision', 'Topic revision', 'number'),
            ]),
            form('deletePost', 'Delete a post', [
                text('postId', 'Post'),
                text('reason', 'Reason'),
                field('expectedRevision', 'Post revision', 'number'),
            ]),
            form('previewTopicAction', 'Preview category move', [
                text('targetContactListId', 'Destination category'),
            ]),
            form('applyTopicAction', 'Moderate topic', [
                field('action', 'Action', 'select', [
                    'close',
                    'reopen',
                    'title',
                    'category',
                    'wiki',
                ]),
                text('targetContactListId', 'Destination category'),
                text('postId', 'Post (wiki)'),
                field('active', 'Wiki mode on', 'checkbox'),
                field(
                    'confirmAudience',
                    'I reviewed the destination audience',
                    'checkbox',
                ),
                field(
                    'expectedGeneration',
                    'Audience generation from preview',
                    'number',
                ),
                text('title', 'Title'),
                text('reason', 'Reason'),
                field('expectedRevision', 'Current topic revision', 'number'),
            ]),
        ],
    },
    Compose: { title: 'Write a topic or reply', compose: true },
    Drafts: {
        title: 'Your drafts',
        read: 'findDrafts',
        list: 'draftList',
        link: 'draft',
        forms: [
            form('discardDraft', 'Discard draft', [
                text('draftId', 'Draft'),
                field('expectedRevision', 'Revision', 'number'),
            ]),
        ],
    },
    MemberDetail: {
        title: 'Community profile',
        read: 'getProfile',
        params: ['handle'],
        detail: 'profile',
        optional: 'handle',
    },
    Settings: {
        title: 'Account settings',
        account: true,
        forms: [
            form('manageAccount', 'Change password', [
                field('action', 'Security action', 'select', ['password']),
                field('oldPassword', 'Current password', 'password'),
                field('newPassword', 'New password', 'password'),
                field('newPasswordVerify', 'Confirm new password', 'password'),
                text('code', 'Authentication code (when required)'),
            ]),
            form('endSession', 'Sign out', []),
            form('storeProfile', 'Save profile', [
                text('handle', 'Handle'),
                text('displayName', 'Display name'),
                field('bio', 'Biography', 'textarea'),
                field('discoverability', 'Profile visibility', 'select', [
                    'members',
                    'public',
                    'hidden',
                ]),
                text('locale', 'Locale'),
                text('timeZone', 'Time zone'),
                field('expectedRevision', 'Profile revision', 'number'),
            ]),
            form('setPreferences', 'Save delivery preferences', [
                field('watchLevel', 'Notifications', 'select', [
                    'Normal',
                    'Muted',
                    'Tracking',
                    'Watching',
                ]),
                field('emailMode', 'Email', 'select', [
                    'Notifications',
                    'None',
                ]),
                field('expectedRevision', 'Preference revision', 'number'),
            ]),
            form('leaveSite', 'Leave this site', [
                field('expectedRevision', 'Membership revision', 'number'),
            ]),
        ],
    },
    Notifications: {
        title: 'Notifications',
        read: 'findNotifications',
        list: 'notificationList',
        link: 'post',
        params: ['view'],
        forms: [
            form('markNotifications', 'Mark read', [
                field('all', 'Mark every unread notification read', 'checkbox'),
            ]),
        ],
    },
    Unsubscribe: {
        title: 'Email preferences',
        read: 'inspectOptOut',
        params: ['token'],
        detail: 'optOut',
        forms: [form('applyOptOut', 'Stop forum email', [])],
    },
    Login: {
        title: 'Sign in',
        account: true,
        forms: [
            form('startSession', 'Sign in', [
                text('username', 'Email or username'),
                field('password', 'Password', 'password'),
            ]),
            form('requestRecovery', 'Send recovery instructions', [
                field('emailAddress', 'Email', 'email'),
            ]),
        ],
    },
    SecondFactor: {
        title: 'Verify sign-in',
        account: true,
        forms: [
            form('completeSession', 'Verify', [
                text('code', 'Authentication code'),
            ]),
        ],
    },
    Register: {
        title: 'Join the community',
        account: true,
        forms: [
            form('beginRegistration', 'Send verification', [
                field('emailAddress', 'Email', 'email'),
                text('invitationToken', 'Invitation code (when required)'),
            ]),
            form('verifyRegistration', 'Verify address', [
                text('token', 'Verification code'),
                field('newPassword', 'Choose a password', 'password'),
            ]),
            form('joinSite', 'Join this site', []),
        ],
    },
    Invitation: {
        title: 'Invitation',
        read: 'inspectInvitation',
        params: ['token'],
        optional: 'token',
        forms: [
            form('redeemInvitation', 'Accept invitation', [
                text('token', 'Invitation code'),
            ]),
        ],
    },
    ReviewQueue: {
        title: 'Review queue',
        read: 'findReviews',
        list: 'reviewList',
        link: 'review',
    },
    ReviewDetail: {
        title: 'Review decision',
        read: 'getReview',
        params: ['reviewId'],
        detail: 'review',
        forms: [
            form('addReviewNote', 'Add a private staff note', [
                field('body', 'Staff note', 'textarea'),
            ]),
            form('claimReview', 'Claim review', [
                field('expectedRevision', 'Review revision', 'number'),
            ]),
            form('decideReview', 'Record decision', [
                field('decision', 'Decision', 'select', [
                    'approved',
                    'rejected',
                    'dismissed',
                ]),
                text('reason', 'Reason'),
                field('expectedRevision', 'Review revision', 'number'),
            ]),
        ],
    },
    MemberModeration: {
        title: 'Member moderation',
        read: 'getMember',
        list: 'sanctionList',
        params: ['targetPartyId', 'contactListId'],
        detail: 'membership',
        optional: 'targetPartyId',
        forms: [
            form('endSanction', 'End a sanction', [
                text('sanctionId', 'Sanction'),
                field('expectedRevision', 'Sanction revision', 'number'),
                text('reason', 'Reason'),
            ]),
            form('setSanction', 'Apply sanction', [
                text('targetPartyId', 'Member'),
                text('contactListId', 'Category (optional)'),
                field('kind', 'Sanction', 'select', ['silence', 'suspend']),
                text('thruDate', 'Expires at'),
                text('reason', 'Reason'),
            ]),
        ],
    },
    Log: { title: 'Moderation log', read: 'findActions', list: 'actionList' },
    Sites: {
        title: 'Your sites',
        read: 'findSites',
        list: 'siteList',
        link: 'site',
        forms: [
            form('createSite', 'Create disabled site', [
                text('name', 'Site name'),
                text('ownerPartyId', 'Owner party'),
                text('locale', 'Locale'),
                text('timeZone', 'Time zone'),
            ]),
        ],
    },
    SiteDetail: {
        title: 'Site settings',
        read: 'getSiteInfo',
        detail: 'site',
        forms: [
            form('storeMounts', 'Save registered hosts and mounts', [
                text('hostname', 'Host name (operator only)'),
                text('forumMount', 'Forum path'),
                text('accountMount', 'Account path'),
                text('membersMount', 'Members path'),
                text('sitesMount', 'Site settings path'),
                field('expectedRevision', 'Site revision', 'number'),
            ]),
            form('setSiteRole', 'Delegate a site role', [
                text('targetPartyId', 'Member'),
                field('role', 'Role', 'select', [
                    'member',
                    'moderator',
                    'owner',
                ]),
                field('expectedRevision', 'Membership revision', 'number'),
                field('password', 'Current password', 'password'),
                text('code', 'Authentication code'),
                text('reason', 'Decision reason'),
            ]),
            form('publishSitePage', 'Publish a site page', [
                field('pageRole', 'Page', 'select', ['guidelines', 'about']),
                text('wikiPageId', 'Wiki page'),
                text('versionName', 'Published version'),
                field('expectedRevision', 'Publication revision', 'number'),
            ]),
            form('updateSite', 'Save site identity', [
                text('name', 'Name'),
                text('locale', 'Locale'),
                text('timeZone', 'Time zone'),
                field('state', 'Publication', 'select', [
                    'disabled',
                    'published',
                ]),
                field('expectedRevision', 'Site revision', 'number'),
            ]),
            form('updateMembershipPolicy', 'Save registration policy', [
                field('registrationMode', 'Registration', 'select', [
                    'closed',
                    'invitation',
                    'open',
                ]),
                field('expectedRevision', 'Site revision', 'number'),
            ]),
        ],
    },
    CategorySettings: {
        title: 'Category settings',
        read: 'findCategories',
        list: 'categoryList',
        forms: [
            form('bindMailbox', 'Adopt an existing mailbox', [
                text('contactListId', 'Mailbox'),
                field(
                    'confirm',
                    'I have reviewed the mailbox audience',
                    'checkbox',
                ),
            ]),
            form('storeCategory', 'Save category', [
                text('contactListId', 'Category (empty for new)'),
                text('name', 'Name'),
                text('parentContactListId', 'Parent category'),
                field(
                    'confirmAudience',
                    'I have reviewed the parent audience change',
                    'checkbox',
                ),
                text('slug', 'URL label'),
                field('mode', 'Discussion style', 'select', [
                    'discussion',
                    'qa',
                ]),
                field('rules', 'Rules', 'textarea'),
                field('expectedRevision', 'Category revision', 'number'),
            ]),
            form('storeTag', 'Save tag', [
                text('tagId', 'Tag (empty for new)'),
                text('name', 'Name'),
                text('description', 'Description'),
                text(
                    'allowedCategories',
                    'Limit to categories (comma separated)',
                ),
                field('expectedRevision', 'Tag revision', 'number'),
            ]),
            form('mergeTag', 'Merge tags', [
                text('tagId', 'Tag to merge'),
                text('targetTagId', 'Merge into'),
                text('reason', 'Reason'),
                field('expectedRevision', 'Tag revision', 'number'),
            ]),
            form('previewCategoryAccess', 'Preview publication', [
                text('contactListId', 'Category'),
                field('visibility', 'Audience', 'select', [
                    'public',
                    'members',
                    'category',
                    'help',
                ]),
            ]),
            form('setCategoryAccess', 'Confirm publication', [
                text('contactListId', 'Category'),
                field('visibility', 'Audience', 'select', [
                    'public',
                    'members',
                    'category',
                    'help',
                ]),
                field('publicationState', 'Publication', 'select', [
                    'disabled',
                    'published',
                ]),
                field('expectedRevision', 'Category revision', 'number'),
                field('confirm', 'I have reviewed the audience', 'checkbox'),
            ]),
        ],
    },
    Members: {
        title: 'Members and invitations',
        read: 'findMembers',
        list: 'memberList',
        forms: [
            form('setMembership', 'Change membership', [
                text('targetPartyId', 'Member'),
                field('state', 'Membership', 'select', [
                    'active',
                    'pending',
                    'suspended',
                    'ended',
                ]),
                field('expectedRevision', 'Revision', 'number'),
                text('reason', 'Decision reason'),
            ]),
            form('setCategoryMember', 'Change category membership or role', [
                text('contactListId', 'Category'),
                text('targetPartyId', 'Member'),
                field('state', 'Membership', 'select', ['active', 'ended']),
                field('roleTypeId', 'Category role', 'select', [
                    '',
                    'ListModerator',
                    'ListOwner',
                ]),
                field(
                    'expectedRevision',
                    'Membership revision (zero for a new member)',
                    'number',
                ),
                text('reason', 'Decision reason'),
                field(
                    'password',
                    'Reauthenticate for role changes',
                    'password',
                ),
                text('code', 'Second-factor code if required'),
            ]),
            form('createInvitation', 'Create invitation', [
                field('emailAddress', 'Verified recipient email', 'email'),
            ]),
        ],
    },
    Policies: {
        title: 'Forum policies',
        read: 'getPolicy',
        detail: 'policy',
        forms: [
            form('storePolicy', 'Save contribution policy', [
                field(
                    'firstContributionCount',
                    'Contributions requiring approval',
                    'number',
                ),
                field(
                    'postIntervalSeconds',
                    'Minimum seconds between posts',
                    'number',
                ),
                field('expectedRevision', 'Site revision', 'number'),
            ]),
        ],
    },
    Mail: {
        title: 'Forum mail delivery',
        read: 'findDeliveries',
        list: 'deliveryList',
        forms: [
            form(
                'resolveDelivery',
                'Reconcile a failed or uncertain delivery',
                [
                    text('deliveryId', 'Delivery'),
                    field('expectedRevision', 'Delivery revision', 'number'),
                    field('decision', 'Confirmed provider outcome', 'select', [
                        'retry',
                        'confirmed-sent',
                        'confirmed-not-sent',
                    ]),
                    text('reason', 'Evidence and reason'),
                ],
            ),
            form('storeMailSettings', 'Save outbound mail', [
                field('senderAddress', 'Registered sender', 'email'),
                text('senderName', 'Sender name'),
                text('templateId', 'Registered template'),
                field('expectedRevision', 'Revision', 'number'),
            ]),
        ],
    },
    Operations: {
        title: 'Forum health',
        read: 'getHealth',
        detail: 'health',
        list: 'runList',
        forms: [
            form('manageRun', 'Recover a checkpointed job', [
                text('runId', 'Run'),
                field('action', 'Action', 'select', [
                    'retry',
                    'cancel',
                    'resume',
                ]),
                text('reason', 'Reason'),
            ]),
        ],
    },
}
const rowActions = {
    Drafts: {
        key: 'draftId',
        label: 'Discard',
        form: 'PassDraftsDiscardDraft',
    },
    Bookmarks: {
        key: 'bookmarkId',
        label: 'Edit or remind',
        form: 'PassBookmarksStoreBookmark',
    },
    MemberModeration: {
        key: 'sanctionId',
        label: 'End sanction',
        form: 'PassEndSanctionForm',
    },
    Mail: {
        key: 'deliveryId',
        label: 'Reconcile',
        form: 'PassMailResolveDelivery',
    },
}
function inputFor(op, siteId, parameters) {
    const schema = ec.resource.script(
        'component://mr-pass/service/pass/Schema.js',
    )[op]
    const input = {}
    for (const k of schema.fields) {
        if (k === 'siteId') {
            input.siteId = siteId
            continue
        }
        if (parameters[k] != null && parameters[k] !== '')
            input[k] = parameters[k]
    }
    for (const k of [
        'attachmentIds',
        'deliveryIds',
        'renderedPostIds',
        'optionIds',
    ])
        if (k in input && !Array.isArray(input[k])) input[k] = [input[k]]
    // Free-text lists from plain forms are comma separated.
    for (const k of ['tags', 'allowedCategories'])
        if (typeof input[k] === 'string')
            input[k] = input[k]
                .split(',')
                .map((v) => v.trim())
                .filter(Boolean)
    for (const k of [
        'expectedRevision',
        'sequenceNum',
        'limit',
        'ordinal',
        'revision',
        'fromRevision',
        'toRevision',
    ])
        if (k in input) input[k] = Number(input[k])
    // A browser datetime-local value is local time; send epoch milliseconds.
    if (typeof input.remindAt === 'string')
        input.remindAt = new Date(input.remindAt).getTime()
    for (const k of [
        'confirm',
        'confirmAudience',
        'markUnread',
        'approvalRequired',
        'all',
        'active',
    ])
        if (k in input)
            input[k] =
                input[k] === true || input[k] === 'true' || input[k] === 'on'
    for (const key of ['hosts', 'mounts', 'config', 'poll'])
        if (typeof input[key] === 'string') input[key] = JSON.parse(input[key])
    return input
}
function load(name, siteId, parameters, bases, identity) {
    if (!definitions[name]) throw new Error('Unknown PASS screen')
    const def = { ...definitions[name] },
        view = {
            ...def,
            rows: [],
            details: [],
            forms: def.forms || [],
            formValues: {},
            next: null,
        }
    if (name === 'Members') {
        if (parameters.contactListId) {
            def.read = 'findCategoryMembers'
            view.forms = view.forms.filter(
                (form) => form.op === 'setCategoryMember',
            )
            view.title = 'Category members and roles'
        } else
            view.forms = view.forms.filter(
                (form) => form.op !== 'setCategoryMember',
            )
    }
    if (
        !identity?.authenticated &&
        [
            'Drafts',
            'Bookmarks',
            'Settings',
            'Notifications',
            'ReviewQueue',
            'ReviewDetail',
            'MemberModeration',
            'Log',
            'Sites',
            'SiteDetail',
            'CategorySettings',
            'Members',
            'Policies',
            'Mail',
            'Operations',
        ].includes(name)
    ) {
        view.needsLogin = true
        view.forms = []
        return view
    }
    if (name === 'CategoryDetail') {
        view.category = call('getCategory', {
            siteId,
            contactListId: parameters.contactListId,
        }).category
        view.title = view.category.name
        view.body = StringUtilities.cleanHtml(view.category.rules || '')
        if (!identity?.authenticated || identity.membershipState !== 'active')
            view.forms = []
    }
    if (name === 'Sites' && System.getProperty('pass_backend_url'))
        view.forms = view.forms.filter((form) => form.op !== 'createSite')
    if (name === 'Login' && identity?.ssoFlows?.length)
        view.forms = [
            ...view.forms,
            form('startSso', 'Sign in with your provider', [
                field(
                    'authFlowId',
                    'Provider',
                    'select',
                    identity.ssoFlows.map((flow) => flow.flowId),
                ),
            ]),
        ]
    if (name === 'TopicDetail') {
        // The screen's pre-actions already read the topic for its canonical URL.
        const metadata =
            parameters.topicMetadata ||
            call('getTopic', {
                siteId,
                rootCommEventId: parameters.rootCommEventId,
            }).topic
        view.title = metadata.title
        view.topic = metadata
        view.canReply = metadata.capabilities.canReply
        view.canFlag = metadata.capabilities.canFlag
        view.canAccept = metadata.capabilities.canAccept
        view.signedIn = !!identity?.authenticated
        view.formValues.applyTopicAction = {
            expectedRevision: metadata.revision,
        }
        view.formValues.acceptAnswer = { expectedRevision: metadata.revision }
        view.forms = view.forms.filter((form) =>
            form.op === 'setPreferences'
                ? identity?.membershipState === 'active'
                : form.op === 'flagPost'
                  ? metadata.capabilities.canFlag
                  : ['storeBookmark', 'deletePost'].includes(form.op)
                    ? !!identity?.authenticated
                    : form.op === 'acceptAnswer'
                      ? metadata.capabilities.canAccept
                      : ['setReaction', 'votePoll'].includes(form.op)
                        ? false
                        : metadata.capabilities.canModerate,
        )
        if (identity?.membershipState === 'active') {
            const preferences = call('getPreferences', {
                siteId,
                scopeType: 'topic',
                scopeId: parameters.rootCommEventId,
            })
            view.formValues.setPreferences = {
                scopeType: 'topic',
                scopeId: parameters.rootCommEventId,
                watchLevel: preferences.preferences.watchLevel || 'Normal',
                emailMode: preferences.delivery.emailMode || 'Notifications',
                expectedRevision: preferences.revision,
            }
        }
    }
    if (name === 'Settings' && identity?.authenticated) {
        view.formValues.storeProfile = { expectedRevision: 0 }
        if (!identity.membershipState) {
            view.forms = view.forms.filter((form) =>
                ['endSession', 'manageAccount', 'startSso'].includes(form.op),
            )
            if (identity.site.registrationMode === 'open')
                view.forms.push(form('joinSite', 'Join this community', []))
        }
        if (identity.profile?.handle) {
            const profile = call('getProfile', {
                siteId,
                handle: identity.profile.handle,
            }).profile
            view.formValues.storeProfile = {
                ...profile,
                expectedRevision: profile.revision,
            }
        }
        if (identity.membershipState) {
            const preferences = call('getPreferences', { siteId })
            view.formValues.setPreferences = {
                watchLevel: preferences.preferences.watchLevel || 'Normal',
                emailMode: preferences.delivery.emailMode || 'Notifications',
                expectedRevision: preferences.revision,
            }
            view.formValues.leaveSite = {
                expectedRevision: call('getMembership', { siteId }).membership
                    .revision,
            }
        }
    }
    if (def.read && (!def.optional || parameters[def.optional])) {
        const data = call(
            def.read,
            inputFor(def.read, siteId, { ...def.defaults, ...parameters }),
        )
        view.rows = data[def.list] || []
        const detail = data[def.detail] || (name === 'Operations' ? data : null)
        if (name === 'MemberDetail' && detail?.avatarId)
            view.avatarHref =
                bases.members +
                '/MemberDetail/download?attachmentId=' +
                encodeURIComponent(detail.avatarId) +
                '&variant=thumbnail'
        view.details = detail
            ? Object.entries(detail).filter(
                  ([k, v]) => v != null && typeof v !== 'object',
              )
            : []
        view.notes = name === 'ReviewDetail' ? data.notes : []
        view.body =
            name === 'ReviewDetail'
                ? data.post?.body
                : def.body
                  ? data[def.body]?.body
                  : null
        if (name === 'MemberDetail' && detail) {
            // The bio is member-written rich text: show it sanitized, and list the member's visible topics.
            view.details = view.details.filter(
                ([k]) => !['bio', 'avatarId', 'revision'].includes(k),
            )
            view.body = detail.bio
                ? StringUtilities.cleanHtml(detail.bio)
                : null
            const activity = call('findTopics', {
                siteId,
                authorHandle: detail.handle,
                limit: 30,
            })
            view.rows = activity.topicList || []
            view.activityTitle = 'Topics started'
            def.link = 'topic'
        }
        view.next = data.nextCursor
        if (view.next) {
            const params = inputFor(def.read, siteId, {
                ...def.defaults,
                ...parameters,
            })
            delete params.siteId
            delete params.cursor
            delete params.around
            const query = Object.entries(params)
                .filter(
                    ([key, value]) =>
                        value != null && typeof value !== 'object',
                )
                .map(
                    ([key, value]) =>
                        encodeURIComponent(key) +
                        '=' +
                        encodeURIComponent(String(value)),
                )
            query.push('cursor=' + encodeURIComponent(view.next))
            view.nextHref = '?' + query.join('&')
        }
        view.revision = data.revision
        if (name === 'PostHistory') {
            view.forms = data.canRestore ? view.forms : []
            view.formValues.restorePostRevision = {
                expectedRevision: data.revision,
            }
            view.backHref =
                bases.forum + '/p/' + encodeURIComponent(data.postId)
            if (parameters.fromRevision && parameters.toRevision)
                view.diffHtml = call('comparePostRevisions', {
                    siteId,
                    postId: parameters.postId,
                    fromRevision: Number(parameters.fromRevision),
                    toRevision: Number(parameters.toRevision),
                }).diff.html
        }
        for (const row of view.rows) {
            if (name === 'PostHistory') {
                row.label =
                    'Revision ' +
                    row.revision +
                    (row.current ? ' (current)' : '') +
                    ' · ' +
                    (row.editor?.displayName ||
                        row.editor?.handle ||
                        'Community member')
                row.snippet = row.reason || null
                if (row.revision > 1)
                    row.href =
                        '?postId=' +
                        encodeURIComponent(parameters.postId) +
                        '&fromRevision=' +
                        (row.revision - 1) +
                        '&toRevision=' +
                        row.revision
                continue
            }
            if (def.link === 'tag')
                row.href = bases.forum + '?tag=' + encodeURIComponent(row.name)
            if (name === 'TopicDetail' && row.pollId)
                row.poll = call('getPoll', { siteId, pollId: row.pollId }).poll
            if (def.link === 'topic')
                row.href =
                    bases.forum +
                    '/t/' +
                    encodeURIComponent(row.rootCommEventId) +
                    '/' +
                    encodeURIComponent(
                        String(row.title || 'topic')
                            .toLowerCase()
                            .replace(/[^a-z0-9]+/g, '-')
                            .replace(/^-|-$/g, '') || 'topic',
                    )
            // A notification opens its post, which resolves the topic and position after a fresh access check.
            if (def.link === 'post' && row.postId)
                row.href = bases.forum + '/p/' + encodeURIComponent(row.postId)
            if (name === 'Notifications')
                row.state = row.read ? 'Read' : 'Unread'
            // A row action fills its form with this row's ID and revision instead of asking for them.
            const action = rowActions[name]
            if (action && row[action.key])
                row.action = {
                    label: action.label,
                    href:
                        '?' +
                        action.key +
                        '=' +
                        encodeURIComponent(row[action.key]) +
                        (row.revision != null
                            ? '&expectedRevision=' +
                              encodeURIComponent(row.revision)
                            : '') +
                        '#' +
                        action.form,
                }
            if (def.link === 'category')
                row.href =
                    bases.forum +
                    '/Categories/CategoryDetail?contactListId=' +
                    encodeURIComponent(row.contactListId)
            if (def.link === 'draft')
                row.href =
                    bases.forum +
                    '/Compose?draftId=' +
                    encodeURIComponent(row.draftId)
            if (def.link === 'review')
                row.href =
                    bases.forum +
                    '/Moderation/ReviewDetail?reviewId=' +
                    encodeURIComponent(row.reviewId)
            if (def.link === 'site') row.href = bases.sites + '/SiteDetail'
            if (row.entryDate)
                row.dateText = ec.l10n.format(
                    new Date(
                        Number.isFinite(Number(row.entryDate))
                            ? Number(row.entryDate)
                            : String(row.entryDate),
                    ),
                    'MMM d, yyyy h:mm a',
                )
            row.label =
                row.title ||
                row.name ||
                row.displayName ||
                row.reviewId ||
                row.siteId ||
                row.deliveryId ||
                row.action ||
                row.draftId ||
                row.partyId ||
                row.runId ||
                row.sanctionId ||
                row.postId
        }
    }
    return view
}
function save(name, siteId, parameters) {
    const def = definitions[name]
    if (parameters.formAction === 'storeMounts')
        parameters = {
            ...parameters,
            hosts: parameters.hostname
                ? [{ hostname: parameters.hostname, canonical: true }]
                : [],
            mounts: [
                { app: 'forum', pathPrefix: parameters.forumMount || '/forum' },
                {
                    app: 'account',
                    pathPrefix: parameters.accountMount || '/account',
                },
                {
                    app: 'members',
                    pathPrefix: parameters.membersMount || '/members',
                },
                { app: 'sites', pathPrefix: parameters.sitesMount || '/sites' },
            ],
        }
    if (parameters.formAction === 'storePolicy')
        parameters = {
            ...parameters,
            config: {
                firstContributionCount: Number(
                    parameters.firstContributionCount || 2,
                ),
                postIntervalSeconds: Number(
                    parameters.postIntervalSeconds || 10,
                ),
            },
        }
    const form = def.forms?.find((f) => f.op === parameters.formAction)
    if (!form) {
        const e = new Error('Unknown form action')
        e.moquiErrorKind = 'Unprocessable'
        throw e
    }
    if (
        def.account &&
        [
            'startSession',
            'completeSession',
            'beginRegistration',
            'verifyRegistration',
            'requestRecovery',
            'endSession',
            'manageAccount',
            'startSso',
        ].includes(form.op)
    )
        return ec.resource
            .script('component://mr-pass/service/pass/Account.js')
            .call(form.op, parameters, siteId)
    return call(
        form.op,
        inputFor(form.op, siteId, {
            ...parameters,
            operationId: parameters.operationId || ec.user.randomString(32),
        }),
    )
}
function preview(result, back) {
    const encode = (value) => WebUtilities.encodeHtml(String(value ?? ''))
    const audience = (value) =>
        ({
            public: 'Anyone, including visitors who are not signed in',
            members: 'Active site members',
            category: 'Granted category members',
            help: 'Participants in their own discussions',
        })[value] ||
        value ||
        ''
    const category = result.category || {}
    const revision = result.expectedRevision ?? category.policyRevision
    const generation = result.expectedGeneration
    const params = []
    if (revision != null)
        params.push('expectedRevision=' + encodeURIComponent(revision))
    if (generation != null)
        params.push('expectedGeneration=' + encodeURIComponent(generation))
    if (category.contactListId)
        params.push(
            'contactListId=' + encodeURIComponent(category.contactListId),
        )
    return (
        '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Review audience</title><main style="max-width:45rem;margin:2rem auto;padding:1rem;font:1rem/1.6 system-ui"><h1>Review audience</h1><p>Current audience: ' +
        encode(audience(result.sourceVisibility || category.visibility)) +
        '</p><p>Proposed audience: ' +
        encode(audience(result.targetVisibility || result.proposedVisibility)) +
        '</p><p>Discussions or posts affected: ' +
        encode(result.topicCount ?? result.visiblePostCount ?? 0) +
        '</p><p>Existing email cannot be retracted. Future reads and deliveries use the new audience.</p><a href="' +
        encode(back + (params.length ? '?' + params.join('&') : '')) +
        '">Return to confirm the change</a></main></html>'
    )
}
/* The link is pasted into mail, so it is absolute on the site's own host. */
function invitationResult(result, bases, origin) {
    const encode = (value) => WebUtilities.encodeHtml(String(value || ''))
    if (!result.token)
        return '<!doctype html><html lang="en"><meta charset="utf-8"><title>Invitation</title><p>This invitation was already created. Its one-time code is no longer displayed. Revoke it and create a new invitation if the code was lost.</p></html>'
    const link =
        origin +
        bases.account +
        '/Invitation?token=' +
        encodeURIComponent(result.token)
    return (
        '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Invitation created</title><main><h1>Invitation created</h1><p>Share this link with the intended recipient. The code is displayed once.</p><p><a href="' +
        encode(link) +
        '">' +
        encode(link) +
        '</a></p><p><a href="' +
        encode(bases.forum + '/Settings/Members') +
        '">Return to members</a></p></main></html>'
    )
}
;({ load, save, inputFor, preview, invitationResult })
