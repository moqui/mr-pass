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
/* Policy settings shown by section; the authority enforces each bound. */
const POLICY_FIELDS = [
    [
        'firstContributionCount',
        'Posting: contributions requiring approval',
        'number',
    ],
    ['postIntervalSeconds', 'Posting: minimum seconds between posts', 'number'],
    ['editWindowHours', 'Posting: author edit window in hours', 'number'],
    ['maxPostLength', 'Posting: maximum post length', 'number'],
    ['slowModeSeconds', 'Posting: default slow mode seconds', 'number'],
    ['basicTopicsEntered', 'Trust (basic): topics entered', 'number'],
    ['basicPostsRead', 'Trust (basic): posts read', 'number'],
    ['basicReadingMinutes', 'Trust (basic): reading minutes', 'number'],
    ['basicVisitDays', 'Trust (basic): visiting days', 'number'],
    ['memberVisitDays', 'Trust (member): visiting days', 'number'],
    ['memberTopicsEntered', 'Trust (member): topics entered', 'number'],
    ['memberPostsRead', 'Trust (member): posts read', 'number'],
    ['memberReadingMinutes', 'Trust (member): reading minutes', 'number'],
    ['regularVisitDays', 'Trust (regular): visiting days', 'number'],
    ['regularTopicsEntered', 'Trust (regular): topics entered', 'number'],
    ['regularPostsRead', 'Trust (regular): posts read', 'number'],
    [
        'regularApprovedContributions',
        'Trust (regular): approved contributions',
        'number',
    ],
    [
        'abuseFreeDays',
        'Trust: days without sanctions before promotion',
        'number',
    ],
    ['flagHideCount', 'Moderation: reports that hide a post', 'number'],
    [
        'classifierEnabled',
        'Moderation: send posts to the approved classifier',
        'checkbox',
    ],
    [
        'privateEnabled',
        'Private messages: members may start conversations',
        'checkbox',
    ],
    [
        'privateMinTrust',
        'Private messages: minimum trust to start',
        'select',
        ['new', 'basic', 'member', 'regular'],
    ],
    [
        'privateRecipientLimit',
        'Private messages: recipients per conversation',
        'number',
    ],
    [
        'privateExistingReplies',
        'Private messages: replies continue when starting is off',
        'checkbox',
    ],
    [
        'privateFullBodyEmail',
        'Private messages: allow full message email',
        'checkbox',
    ],
    ['mediaMaxBytes', 'Media: maximum bytes per file', 'number'],
    ['mediaFilesPerPost', 'Media: files per post', 'number'],
]
const definitions = {
    Topics: {
        title: ec.l10n.localize('Latest topics'),
        read: 'findTopics',
        list: 'topicList',
        link: 'topic',
        params: ['view', 'tag', 'solved', 'period'],
    },
    Tags: {
        title: ec.l10n.localize('Tags'),
        read: 'findTags',
        list: 'tagList',
        link: 'tag',
        params: ['query'],
    },
    Bookmarks: {
        title: ec.l10n.localize('Bookmarks'),
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
        title: ec.l10n.localize('Post history'),
        read: 'getPostHistory',
        list: 'revisionList',
        params: ['postId'],
        forms: [
            form('restorePostRevision', 'Restore this revision', [
                field('revision', 'Revision to restore', 'number'),
                text('reason', 'Reason'),
                field('expectedRevision', 'Current revision', 'number'),
            ]),
            form('setPostHistory', ec.l10n.localize('Hide or show the earlier versions'), [
                field('history', 'Earlier versions are', 'select', [
                    'hidden',
                    'shown',
                ]),
                text('reason', 'Reason'),
            ]),
        ],
    },
    Categories: {
        title: ec.l10n.localize('Categories'),
        read: 'findCategories',
        list: 'categoryList',
        link: 'category',
    },
    CategoryDetail: {
        title: ec.l10n.localize('Category topics'),
        read: 'findTopics',
        list: 'topicList',
        link: 'topic',
        params: ['contactListId'],
        forms: [
            form('joinCategory', 'Join category', []),
            form('leaveCategory', 'Leave category', []),
            form('setPreferences', 'Category notifications', [
                field('watchLevel', 'Notifications', 'select', [
                    'Normal',
                    'Muted',
                    'Tracking',
                    'Watching',
                    'WatchingFirstPost',
                ]),
                field('emailMode', 'Email', 'select', [
                    'Notifications',
                    'None',
                    'Digest',
                    'EveryPost',
                ]),
                field('expectedRevision', 'Preference revision', 'hidden'),
            ]),
        ],
    },
    Search: {
        title: ec.l10n.localize('Search'),
        read: 'searchForum',
        list: 'topicList',
        link: 'topic',
        params: ['query', 'contactListId'],
        optional: 'query',
    },
    Guidelines: {
        title: ec.l10n.localize('Community guidelines'),
        read: 'getSitePage',
        params: ['pageRole'],
        defaults: { pageRole: 'guidelines' },
        body: 'page',
    },
    TopicDetail: {
        title: ec.l10n.localize('Topic'),
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
                    'Digest',
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
            form('previewTopicAction', 'Preview a move, split or merge', [
                field('action', 'Change', 'select', [
                    'category',
                    'move-posts',
                    'split',
                    'merge',
                ]),
                text('postIds', 'Selected posts (comma separated)'),
                text('targetRootCommEventId', 'Destination topic'),
                text('targetContactListId', 'Destination category'),
            ]),
            form('applyTopicAction', 'Moderate topic', [
                field('action', 'Action', 'select', [
                    'close',
                    'reopen',
                    'title',
                    'category',
                    'pin',
                    'unpin',
                    'unlist',
                    'list',
                    'slow',
                    'timer',
                    'delete',
                    'restore',
                    'wiki',
                    'move-posts',
                    'split',
                    'merge',
                ]),
                text('targetContactListId', 'Destination category'),
                text('targetRootCommEventId', 'Destination topic'),
                text('postIds', 'Selected posts (comma separated)'),
                text('postId', 'Post (wiki, delete or restore)'),
                field('active', 'Wiki mode on', 'checkbox'),
                field(
                    'slowIntervalSeconds',
                    'Slow mode seconds (0 ends it)',
                    'number',
                ),
                field('timerAction', 'Timer action', 'select', [
                    'close',
                    'reopen',
                    'unpin',
                    'unlist',
                    'list',
                    'cancel',
                ]),
                field('dueAt', 'Timer due at', 'datetime'),
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
            form('createCaseFromTopic', 'Escalate to a support case', [
                text(
                    'postIds',
                    'Posts to copy into the case (comma separated)',
                ),
                text('requestCategoryId', 'Support queue (optional)'),
                text('reason', 'Reason'),
            ]),
            form('previewCaseReply', 'Preview a public reply from a case', [
                text('requestId', 'Case'),
                field('body', 'Public reply', 'textarea'),
            ]),
            form('publishCaseReply', ec.l10n.localize('Publish the previewed reply'), []),
            form('linkDiscussion', 'Link a product or article', [
                field('sourceType', 'Source', 'select', ['product', 'article']),
                text('sourceId', 'Product or wiki page'),
                field('gate', 'Article access', 'select', ['narrow', 'none']),
                text('reason', 'Reason'),
            ]),
            form('detachDiscussion', 'Detach a linked discussion', [
                text('linkId', 'Link'),
                field(
                    'confirmAudience',
                    'I reviewed the category audience',
                    'checkbox',
                ),
                text('reason', 'Reason'),
            ]),
            form('draftArticleFromTopic', 'Draft an article from this topic', [
                text('title', 'Article title'),
                text('postIds', 'Posts to include (comma separated)'),
                text('reviewerUsername', 'Reviewer username'),
                text('reason', 'Note for the reviewer'),
            ]),
        ],
    },
    Compose: { title: ec.l10n.localize('Write a topic or reply'), compose: true },
    Conversations: {
        title: ec.l10n.localize('Messages'),
        read: 'findConversations',
        list: 'conversationList',
        link: 'conversation',
        params: ['view'],
        forms: [
            form('createConversation', 'New private message', [
                text(
                    'participantHandles',
                    'To (member handles, comma separated)',
                ),
                text('title', 'Subject'),
                field('body', 'Message', 'textarea'),
            ]),
        ],
    },
    ConversationDetail: {
        title: ec.l10n.localize('Conversation'),
        read: 'getPosts',
        list: 'postList',
        params: ['rootCommEventId'],
        stream: true,
        forms: [
            form('updateParticipants', 'Change participants', [
                text(
                    'participantHandles',
                    'Add members (handles, comma separated)',
                ),
                field(
                    'confirm',
                    'New participants will see the whole conversation',
                    'checkbox',
                ),
                text('targetHandles', 'Remove members (handles)'),
                text('ownerHandles', 'Make owners (handles)'),
                field('expectedRevision', 'Conversation revision', 'number'),
            ]),
            form('setConversationState', 'Archive or leave', [
                field('action', 'Action', 'select', [
                    'archive',
                    'unarchive',
                    'leave',
                ]),
            ]),
            form('flagPost', 'Report a post', [
                text('postId', 'Post'),
                text('reason', 'Reason'),
            ]),
            form('setReaction', 'React', []),
            form('releaseHeldMessage', ec.l10n.localize('Release a held message'), []),
            form('votePoll', 'Vote', []),
            form('storeBookmark', 'Bookmark a post', [
                text('postId', 'Post'),
                text('note', 'Note'),
                field('remindAt', 'Remind me at', 'datetime'),
            ]),
            form('deletePost', 'Delete a post', [
                text('postId', 'Post'),
                text('reason', 'Reason'),
                field('expectedRevision', 'Post revision', 'number'),
            ]),
        ],
    },
    Drafts: {
        title: ec.l10n.localize('Your drafts'),
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
        title: ec.l10n.localize('Community profile'),
        read: 'getProfile',
        params: ['handle'],
        detail: 'profile',
        optional: 'handle',
        forms: [
            form('setMemberPreference', ec.l10n.localize('Mute or block this member'), [
                text('targetHandle', 'Member'),
                field('preference', 'Preference', 'select', [
                    'none',
                    'mute',
                    'block',
                ]),
                field('expiresAt', 'Until (optional)', 'datetime'),
            ]),
        ],
    },
    Settings: {
        title: ec.l10n.localize('Account settings'),
        account: true,
        forms: [
            form('manageAccount', 'Change password', [
                field('action', ec.l10n.localize('Security action'), 'select', ['password']),
                field('oldPassword', 'Current password', 'password'),
                field('newPassword', 'New password', 'password'),
                field('newPasswordVerify', ec.l10n.localize('Confirm new password'), 'password'),
                text('code', ec.l10n.localize('Authentication code (when required)')),
            ]),
            form('endSession', 'Sign out', []),
            form('storeProfile', 'Save profile', [
                text('handle', 'Handle'),
                text('displayName', 'Display name'),
                field('bio', 'Biography', 'textarea'),
                field('discoverability', ec.l10n.localize('Profile visibility'), 'select', [
                    'members',
                    'public',
                    'hidden',
                ]),
                text('locale', 'Locale'),
                text('timeZone', 'Time zone'),
                field('expectedRevision', ec.l10n.localize('Profile revision'), 'number'),
            ]),
            form('setPreferences', ec.l10n.localize('Save delivery preferences'), [
                field('watchLevel', 'Notifications', 'select', [
                    'Normal',
                    'Muted',
                    'Tracking',
                    'Watching',
                    'WatchingFirstPost',
                ]),
                field('emailMode', 'Email', 'select', [
                    'Notifications',
                    'None',
                    'Digest',
                    'EveryPost',
                ]),
                field('digestPeriod', ec.l10n.localize('Digest frequency'), 'select', [
                    'daily',
                    'weekly',
                ]),
                field(
                    'includeOwn',
                    ec.l10n.localize('Include my own posts in mailing-list email'),
                    'checkbox',
                ),
                field('expectedRevision', 'Preference revision', 'number'),
            ]),
            form('leaveSite', ec.l10n.localize('Leave this site'), [
                field('expectedRevision', ec.l10n.localize('Membership revision'), 'number'),
            ]),
            form('requestPersonalDataAction', ec.l10n.localize('Export or erase my data'), [
                field('kind', 'Request', 'select', ['export', 'erasure']),
                text('reason', 'Note (optional)'),
                field(
                    'confirm',
                    ec.l10n.localize('For erasure: I understand my profile is anonymized and my memberships end'),
                    'checkbox',
                ),
            ]),
        ],
    },
    Notifications: {
        title: ec.l10n.localize('Notifications'),
        read: 'findNotifications',
        list: 'notificationList',
        link: 'post',
        params: ['view'],
        forms: [
            form('markNotifications', 'Mark read', [
                field('all', ec.l10n.localize('Mark every unread notification read'), 'checkbox'),
            ]),
            form('appealReview', ec.l10n.localize('Appeal a moderation decision'), [
                text('reviewId', 'Decision'),
                field('reason', ec.l10n.localize('Why it should be reconsidered'), 'textarea'),
            ]),
        ],
    },
    Unsubscribe: {
        title: ec.l10n.localize('Email preferences'),
        read: 'inspectOptOut',
        params: ['token'],
        detail: 'optOut',
        forms: [
            form('applyOptOut', ec.l10n.localize('Stop forum email'), [
                field('scopeType', 'Stop', 'select', ['', 'site']),
            ]),
        ],
    },
    Login: {
        title: ec.l10n.localize('Sign in'),
        account: true,
        forms: [
            form('startSession', 'Sign in', [
                text('username', ec.l10n.localize('Email or username')),
                field('password', 'Password', 'password'),
            ]),
            form('requestRecovery', ec.l10n.localize('Send recovery instructions'), [
                field('emailAddress', 'Email', 'email'),
            ]),
        ],
    },
    SecondFactor: {
        title: ec.l10n.localize('Verify sign-in'),
        account: true,
        forms: [
            form('completeSession', 'Verify', [
                text('code', 'Authentication code'),
            ]),
        ],
    },
    Register: {
        title: ec.l10n.localize('Join the community'),
        account: true,
        forms: [
            form('beginRegistration', ec.l10n.localize('Send verification'), [
                field('emailAddress', 'Email', 'email'),
                text('invitationToken', ec.l10n.localize('Invitation code (when required)')),
            ]),
            form('verifyRegistration', ec.l10n.localize('Verify address'), [
                text('token', ec.l10n.localize('Verification code')),
                field('newPassword', ec.l10n.localize('Choose a password'), 'password'),
            ]),
            form('joinSite', ec.l10n.localize('Join this site'), []),
        ],
    },
    Invitation: {
        title: ec.l10n.localize('Invitation'),
        read: 'inspectInvitation',
        params: ['token'],
        optional: 'token',
        forms: [
            form('redeemInvitation', 'Accept invitation', [
                text('token', ec.l10n.localize('Invitation code')),
            ]),
        ],
    },
    ReviewQueue: {
        title: ec.l10n.localize('Review queue'),
        read: 'findReviews',
        list: 'reviewList',
        link: 'review',
        forms: [form('decideReviews', 'Decide selected reviews', [])],
    },
    ReviewDetail: {
        title: ec.l10n.localize('Review decision'),
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
            form('escalateReview', 'Private context escalation', [
                text('reason', 'Reason'),
                field(
                    'active',
                    'Approve the requested escalation (site owner)',
                    'checkbox',
                ),
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
        title: ec.l10n.localize('Member moderation'),
        read: 'getMember',
        list: 'sanctionList',
        params: ['targetPartyId', 'contactListId'],
        detail: 'membership',
        optional: 'targetPartyId',
        forms: [
            form('endSanction', ec.l10n.localize('End a sanction'), [
                text('sanctionId', 'Sanction'),
                field('expectedRevision', 'Sanction revision', 'number'),
                text('reason', 'Reason'),
            ]),
            form('setTrust', 'Set or lock trust level', [
                text('targetPartyId', 'Member'),
                field('trustLevel', 'Trust level', 'select', [
                    'new',
                    'basic',
                    'member',
                    'regular',
                ]),
                field('locked', 'Lock this level', 'checkbox'),
                text('reason', 'Reason'),
                field('expectedRevision', 'Member state revision', 'number'),
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
    Log: { title: ec.l10n.localize('Moderation log'), read: 'findActions', list: 'actionList' },
    Sites: {
        title: ec.l10n.localize('Your sites'),
        read: 'findSites',
        list: 'siteList',
        link: 'site',
        forms: [
            form('createSite', ec.l10n.localize('Create disabled site'), [
                text('name', ec.l10n.localize('Site name')),
                text('ownerPartyId', ec.l10n.localize('Owner party')),
                text('locale', 'Locale'),
                text('timeZone', 'Time zone'),
            ]),
        ],
    },
    SiteDetail: {
        title: ec.l10n.localize('Site settings'),
        read: 'getSiteInfo',
        detail: 'site',
        forms: [
            form('storeMounts', ec.l10n.localize('Save registered hosts and mounts'), [
                text('hostname', ec.l10n.localize('Host name (operator only)')),
                text('forumMount', ec.l10n.localize('Forum path')),
                text('accountMount', ec.l10n.localize('Account path')),
                text('membersMount', ec.l10n.localize('Members path')),
                text('sitesMount', ec.l10n.localize('Site settings path')),
                field('expectedRevision', ec.l10n.localize('Site revision'), 'number'),
            ]),
            form('setSiteRole', ec.l10n.localize('Delegate a site role'), [
                text('targetPartyId', 'Member'),
                field('role', 'Role', 'select', [
                    'member',
                    'moderator',
                    'owner',
                ]),
                field('expectedRevision', ec.l10n.localize('Membership revision'), 'number'),
                text('reason', 'Decision reason'),
            ]),
            form('publishSitePage', ec.l10n.localize('Publish a site page'), [
                field('pageRole', 'Page', 'select', ['guidelines', 'about']),
                text('wikiPageId', 'Wiki page'),
                text('versionName', ec.l10n.localize('Published version')),
                field('expectedRevision', ec.l10n.localize('Publication revision'), 'number'),
            ]),
            form('updateSite', ec.l10n.localize('Save site identity'), [
                text('name', 'Name'),
                text('locale', 'Locale'),
                text('timeZone', 'Time zone'),
                text(
                    'subscriptionUrl',
                    ec.l10n.localize('Manage-subscription page (https address or local path)'),
                ),
                text(
                    'publishingWikiSpaceId',
                    ec.l10n.localize('Publishing wiki space for article drafts'),
                ),
                field('state', 'Publication', 'select', [
                    'disabled',
                    'published',
                ]),
                field('expectedRevision', ec.l10n.localize('Site revision'), 'number'),
            ]),
            form('updateMembershipPolicy', ec.l10n.localize('Save registration policy'), [
                field('registrationMode', 'Registration', 'select', [
                    'closed',
                    'invitation',
                    'open',
                ]),
                field('expectedRevision', ec.l10n.localize('Site revision'), 'number'),
            ]),
            form(
                'storeSubscriptionBinding',
                ec.l10n.localize('Bind a subscription resource (operator only)'),
                [
                    text('subscriptionResourceId', ec.l10n.localize('Subscription resource')),
                    field('targetType', 'Scope', 'select', [
                        'site',
                        'category',
                    ]),
                    text('contactListId', ec.l10n.localize('Category (for a category scope)')),
                    text('reason', 'Reason'),
                ],
            ),
        ],
    },
    CategorySettings: {
        title: ec.l10n.localize('Category settings'),
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
                text(
                    'qualifyingSources',
                    'Grant sources that qualify (manual, subscription)',
                ),
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
                text(
                    'qualifyingSources',
                    'Grant sources that qualify (manual, subscription)',
                ),
                field('expectedRevision', 'Category revision', 'number'),
                field('confirm', 'I have reviewed the audience', 'checkbox'),
            ]),
        ],
    },
    Members: {
        title: ec.l10n.localize('Members and invitations'),
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
            ]),
            form('createInvitation', 'Create invitation', [
                field('emailAddress', 'Verified recipient email', 'email'),
            ]),
            form('setAccessGrant', 'Grant access', [
                text('handle', 'Member handle'),
                field('targetType', 'Scope', 'select', ['site', 'category']),
                text('contactListId', 'Category (for a category grant)'),
                field('fromDate', 'From (optional)', 'datetime'),
                field('thruDate', 'Until (optional)', 'datetime'),
                text('reason', 'Reason'),
            ]),
            form('endAccessGrant', 'End a manual grant', [
                text('grantId', 'Grant'),
                field('expectedRevision', 'Grant revision', 'number'),
                text('reason', 'Reason'),
            ]),
        ],
    },
    Policies: {
        title: ec.l10n.localize('Forum policies'),
        read: 'getPolicy',
        detail: 'policy',
        list: 'ruleList',
        forms: [
            form('storePolicy', 'Save forum policy', [
                ...POLICY_FIELDS.map(([name, label, type, options]) =>
                    field(name, label, type, options),
                ),
                text('reason', 'Reason for this revision'),
                field('expectedRevision', 'Policy revision', 'number'),
            ]),
            form('storeRule', 'Save content rule', [
                text('ruleId', 'Rule (empty for new)'),
                field('ruleType', 'Match', 'select', ['word', 'regex', 'link']),
                text('pattern', 'Word, pattern or link domain'),
                field('action', 'Action', 'select', [
                    'block',
                    'approve',
                    'flag',
                    'censor',
                ]),
                text('contactListId', 'Only in category (optional)'),
                field('sequenceNum', 'Priority', 'number'),
                field('active', 'Enabled', 'checkbox'),
                text('reason', 'Reason'),
                field('expectedRevision', 'Rule revision', 'number'),
            ]),
            form('testRule', 'Test a rule', [
                field('ruleType', 'Match', 'select', ['word', 'regex', 'link']),
                text('pattern', 'Word, pattern or link domain'),
                field('body', 'Sample text', 'textarea'),
            ]),
            form('storeRetentionPolicy', 'Save retention periods', [
                field(
                    'deliveryDays',
                    'Delivery ledger: days to keep (0 keeps)',
                    'number',
                ),
                field(
                    'inboundDays',
                    'Inbound mail receipts: days to keep (0 keeps)',
                    'number',
                ),
                field(
                    'deletedPostDays',
                    'Text of deleted and rejected posts: days to keep (0 keeps)',
                    'number',
                ),
                field(
                    'jobDays',
                    'Finished operation runs: days to keep (0 keeps)',
                    'number',
                ),
                field(
                    'invitationDays',
                    'Expired invitations: days to keep (0 keeps)',
                    'number',
                ),
                field('expectedRevision', 'Retention revision', 'number'),
                text('reason', 'Reason'),
            ]),
        ],
    },
    Mail: {
        title: ec.l10n.localize('Forum mail delivery'),
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
            form('storeRoute', 'Save an inbound route', [
                text('routeId', 'Route (empty for new)'),
                field('address', 'Route address (registered domain)', 'email'),
                text(
                    'contactListId',
                    'Category for new topics (empty: replies only)',
                ),
                field('active', 'Enabled', 'checkbox'),
                field('expectedRevision', 'Route revision', 'number'),
            ]),
            form('testRoute', 'Send a route test to my own address', [
                text('routeId', 'Route'),
            ]),
            form('retryInbound', 'Retry a failed inbound message', [
                text('receiptId', 'Inbound message'),
            ]),
            form('storeMailSettings', 'Save outbound mail', [
                field('senderAddress', 'Registered sender', 'email'),
                text('senderName', 'Sender name'),
                text('templateId', 'Registered template'),
                field('expectedRevision', 'Revision', 'number'),
            ]),
        ],
    },
    Operations: {
        title: ec.l10n.localize('Forum health'),
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
            form('previewOperation', 'Preview an operation', [
                field('operation', 'Operation', 'select', [
                    'rebuild-counters',
                    'retry-deliveries',
                    'retention',
                    'export-site',
                ]),
                text('contactListId', 'Category (optional)'),
            ]),
            form('startOperation', 'Start an operation', [
                field('operation', 'Operation', 'select', [
                    'rebuild-counters',
                    'retry-deliveries',
                    'retention',
                    'export-site',
                ]),
                text('contactListId', 'Category (optional)'),
                field('dryRun', 'Retention dry run', 'select', [
                    'true',
                    'false',
                ]),
                field(
                    'expectedRevision',
                    'Retention policy revision from the preview',
                    'number',
                ),
                text('reason', 'Reason'),
            ]),
            form('decideDataRequest', 'Decide an erasure request', [
                text('requestId', 'Request'),
                field('decision', 'Decision', 'select', [
                    'approved',
                    'rejected',
                ]),
                text('reason', 'Reason'),
                field('expectedRevision', 'Request revision', 'number'),
            ]),
        ],
    },
    Import: {
        title: ec.l10n.localize('Community import'),
        read: 'findImports',
        list: 'importList',
        forms: [
            form('registerImport', 'Register an archive (operator)', [
                text('archiveName', 'Archive file in the import directory'),
                text('checksum', 'SHA-256 checksum'),
                text('sourceName', 'Source community name'),
            ]),
            form('stageImport', 'Stage and preflight the archive', [
                text('importId', 'Import'),
            ]),
            form('storeImportMappings', 'Record a decision', [
                text('importId', 'Import'),
                field('mappingType', 'Decision about', 'select', [
                    'identity',
                    'staff',
                    'group',
                    'feature',
                    'change',
                ]),
                text('sourceId', 'Source id (table:id for a change)'),
                field('decision', 'Decision', 'select', [
                    'map',
                    'create',
                    'inactive',
                    'owner',
                    'moderator',
                    'member',
                    'grant',
                    'snapshot',
                    'deny',
                    'preserve',
                    'defer',
                    'keep',
                    'apply',
                ]),
                text('targetId', 'Existing party (to map an identity)'),
                text('reason', 'Reason'),
            ]),
            form('runImport', 'Run the import', [
                text('importId', 'Import'),
                text('reason', 'Reason'),
            ]),
            form('reconcileImport', 'Reconcile', [text('importId', 'Import')]),
            form('approveImport', 'Approve the reconciliation', [
                text('importId', 'Import'),
                field('role', 'Approve as', 'select', ['operator', 'owner']),
                field('expectedRevision', 'Reconciliation revision', 'number'),
                text('reason', 'Reason'),
            ]),
            form('activateImport', 'Activate the imported community', [
                text('importId', 'Import'),
                field(
                    'sourceFrozen',
                    'The source community is frozen',
                    'checkbox',
                ),
                text('backupReference', 'Target backup reference'),
                field('confirm', 'Activate now', 'checkbox'),
            ]),
            form('cancelImport', 'Cancel the import', [
                text('importId', 'Import'),
                text('reason', 'Reason'),
            ]),
        ],
    },
    Activity: {
        title: ec.l10n.localize('Community activity'),
        read: 'getActivity',
        forms: [
            form('exportReport', 'Export a report as CSV', [
                field('report', 'Report', 'select', [
                    'activity',
                    'moderation',
                    'deliveries',
                ]),
                text('contactListId', 'Category (optional)'),
                field('fromDate', 'From', 'datetime'),
                field('thruDate', 'Until', 'datetime'),
            ]),
        ],
    },
}
const rowActions = {
    Policies: {
        key: 'ruleId',
        label: ec.l10n.localize('Edit rule'),
        form: 'PassPoliciesStoreRule',
    },
    Drafts: {
        key: 'draftId',
        label: ec.l10n.localize('Discard'),
        form: 'PassDraftsDiscardDraft',
    },
    Bookmarks: {
        key: 'bookmarkId',
        label: ec.l10n.localize('Edit or remind'),
        form: 'PassBookmarksStoreBookmark',
    },
    MemberModeration: {
        key: 'sanctionId',
        label: ec.l10n.localize('End sanction'),
        form: 'PassEndSanctionForm',
    },
    Mail: {
        key: 'deliveryId',
        label: ec.l10n.localize('Reconcile'),
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
        'reviewIds',
    ])
        if (k in input && !Array.isArray(input[k])) input[k] = [input[k]]
    // Free-text lists from plain forms are comma separated.
    for (const k of [
        'tags',
        'allowedCategories',
        'postIds',
        'participantHandles',
        'targetHandles',
        'ownerHandles',
        'qualifyingSources',
    ])
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
        'slowIntervalSeconds',
        'deliveryDays',
        'inboundDays',
        'deletedPostDays',
        'jobDays',
        'invitationDays',
    ])
        if (k in input) input[k] = Number(input[k])
    // A browser datetime-local value is local time; send epoch milliseconds.
    for (const k of ['remindAt', 'dueAt', 'expiresAt', 'fromDate', 'thruDate'])
        if (typeof input[k] === 'string')
            input[k] = new Date(input[k]).getTime()
    for (const k of [
        'confirm',
        'confirmAudience',
        'markUnread',
        'approvalRequired',
        'all',
        'active',
        'locked',
        'includeOwn',
        'dryRun',
        'mine',
        'sourceFrozen',
    ])
        if (k in input)
            input[k] =
                input[k] === true || input[k] === 'true' || input[k] === 'on'
    for (const key of ['hosts', 'mounts', 'config', 'poll', 'mappings'])
        if (typeof input[key] === 'string') input[key] = JSON.parse(input[key])
    return input
}
/* scope (Dogfood §6.1, design-smithy §12.5): null on the site's own forum; inside a group's or a repository's shell the
 * category whose subtree the page is limited to (contactListId), the link base that takes the forum base's place (base) and
 * the base of the scope's moderation pages (moderationBase). */
function load(name, siteId, parameters, bases, identity, scope) {
    if (!definitions[name]) throw new Error(ec.l10n.localize('Unknown PASS screen'))
    const forumBase = scope ? scope.base : bases.forum
    const moderationBase = scope
        ? scope.moderationBase
        : bases.forum + '/Moderation'
    // the reads that take a scope answer its subtree only; the scope is the page's, never the request's. The review
    // queue and the log take a category or a scope, not both: one category of the scope is asked for by itself
    if (scope) {
        const oneCategory =
            ['ReviewQueue', 'Log'].includes(name) && parameters.contactListId
        if (oneCategory) requireInScope(siteId, scope, parameters.contactListId)
        parameters = {
            ...parameters,
            scopeContactListId: oneCategory ? null : scope.contactListId,
        }
        // a member is moderated in the scope's category (or one of its subtree): an Owner of the scope reads what the
        // member did there, never across the site (getMember's scopeActivity)
        if (name === 'MemberModeration') {
            if (parameters.contactListId)
                requireInScope(siteId, scope, parameters.contactListId)
            else parameters.contactListId = scope.contactListId
        }
    }
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
            view.title = ec.l10n.localize('Category members and roles')
            view.forms = view.forms.filter((form) =>
                [
                    'setCategoryMember',
                    'setAccessGrant',
                    'endAccessGrant',
                ].includes(form.op),
            )
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
            'Conversations',
            'ConversationDetail',
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
            'Activity',
            'Import',
        ].includes(name)
    ) {
        view.needsLogin = true
        view.forms = []
        return view
    }
    if (name === 'CategoryDetail') {
        if (scope) requireInScope(siteId, scope, parameters.contactListId)
        view.category = call('getCategory', {
            siteId,
            contactListId: parameters.contactListId,
        }).category
        view.title = view.category.name
        view.body = StringUtilities.cleanHtml(view.category.rules || '')
        if (!identity?.authenticated || identity.membershipState !== 'active')
            view.forms = []
        else {
            const preferences = call('getPreferences', {
                siteId,
                scopeType: 'category',
                scopeId: parameters.contactListId,
            })
            view.formValues.setPreferences = {
                scopeType: 'category',
                scopeId: parameters.contactListId,
                watchLevel: preferences.preferences.watchLevel || 'Normal',
                emailMode: preferences.delivery.emailMode || 'Notifications',
                expectedRevision: preferences.revision,
            }
        }
    }
    if (name === 'Sites' && ec.factory.getConfValue('pass@backend-url'))
        view.forms = view.forms.filter((form) => form.op !== 'createSite')
    if (name === 'Login' && identity?.ssoFlows?.length)
        view.forms = [
            ...view.forms,
            form('startSso', ec.l10n.localize('Sign in with your provider'), [
                field(
                    'authFlowId',
                    'Provider',
                    'select',
                    identity.ssoFlows.map((flow) => flow.flowId),
                ),
            ]),
        ]
    if (name === 'TopicDetail' || name === 'ConversationDetail') {
        // The screen's pre-actions already read the topic for its canonical URL.
        // inside a scope a topic of another category is Not Found (getTopic with the scope)
        const metadata =
            parameters.topicMetadata ||
            call('getTopic', inputFor('getTopic', siteId, parameters)).topic
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
        if (name === 'ConversationDetail') {
            view.participantsText = (metadata.participants || [])
                .map(
                    (p) =>
                        (p.displayName || p.handle) +
                        (p.role === 'owner' ? ' (owner)' : ''),
                )
                .join(', ')
            view.formValues.updateParticipants = {
                expectedRevision: metadata.revision,
            }
        }
        view.forms = view.forms.filter((form) =>
            form.op === 'updateParticipants'
                ? metadata.capabilities.canManageParticipants
                : form.op === 'setConversationState'
                  ? true
                  : form.op === 'setPreferences'
                    ? identity?.membershipState === 'active'
                    : form.op === 'flagPost'
                      ? metadata.capabilities.canFlag
                      : ['storeBookmark', 'deletePost'].includes(form.op)
                        ? !!identity?.authenticated
                        : form.op === 'acceptAnswer'
                          ? metadata.capabilities.canAccept
                          : ['setReaction', 'votePoll', 'releaseHeldMessage'].includes(form.op)
                            ? false
                            : metadata.capabilities.canModerate,
        )
        if (name === 'TopicDetail') {
            // Related records: public product and article cards; case links only for internal staff.
            const links = call('getTopicLinks', {
                siteId,
                rootCommEventId: parameters.rootCommEventId,
            })
            view.links = (links.linkList || []).map(linkCard)
            const linkForms = {
                createCaseFromTopic: links.capabilities.canCreateCase,
                previewCaseReply: links.capabilities.canReplyFromCase,
                publishCaseReply: false,
                linkDiscussion: links.capabilities.canLinkDiscussion,
                detachDiscussion: links.capabilities.canLinkDiscussion,
                draftArticleFromTopic: links.capabilities.canDraftArticle,
            }
            view.forms = definitions.TopicDetail.forms.filter((form) =>
                form.op in linkForms
                    ? linkForms[form.op]
                    : view.forms.includes(form),
            )
        }
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
                view.forms.push(form('joinSite', ec.l10n.localize('Join this community'), []))
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
                digestPeriod: preferences.delivery.digestPeriod || 'daily',
                includeOwn: preferences.delivery.includeOwn === 'Y',
                expectedRevision: preferences.revision,
            }
            const membership = call('getMembership', { siteId })
            view.formValues.leaveSite = {
                expectedRevision: membership.membership.revision,
            }
            view.entitlements = membership.entitlements || []
            view.subscriptionUrl = membership.subscriptionUrl
            view.dataRequests = call('findDataRequests', {
                siteId,
                mine: true,
            }).requestList
            view.exports = call('findExports', { siteId }).exportList.filter(
                (x) => x.kind === 'personal',
            )
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
        if (name === 'ReviewDetail') {
            // the reports, each with its reporter only for the site's staff (null for a scope's moderator: "a member")
            view.reports = (data.reports || []).map((report) => ({
                reason: report.reason || '',
                evidence: report.evidence || '',
                reporterPartyId: report.reporterPartyId || null,
                createdAt: report.createdAt,
            }))
            // a reported group or repository (its path and whether it is hidden), for what a scope's page adds
            view.target = data.target || null
            // mail held from an address that is no account's: who sent it and until when it waits; its text is the
            // item's detail
            if (data.held) {
                const held = data.held
                const until = Number.isFinite(Number(held.expiresAt))
                    ? Number(held.expiresAt)
                    : String(held.expiresAt)
                view.details = view.details.concat(
                    [
                        [
                            ec.l10n.localize('Held mail'),
                            held.targetType === 'issue'
                                ? 'a report'
                                : 'a message to the list',
                        ],
                        [
                            'From',
                            (held.senderName ? held.senderName + ' ' : '') +
                                '<' +
                                held.senderAddress +
                                '>',
                        ],
                        ['Subject', held.subject],
                        [
                            ec.l10n.localize('Waits until'),
                            held.expiresAt
                                ? ec.l10n.format(new Date(until), 'MMM d, yyyy')
                                : null,
                        ],
                    ].filter(([, value]) => value != null && value !== ''),
                )
            }
        }
        view.context = name === 'ReviewDetail' ? data.context || null : null
        if (name === 'ReviewDetail' && !view.context)
            view.forms = view.forms.filter((f) => f.op !== 'escalateReview')
        view.body =
            name === 'ReviewDetail'
                ? data.post?.body
                : def.body
                  ? data[def.body]?.body
                  : null
        if (name === 'MemberDetail' && detail) {
            // Members act on others' profiles; a mute or block is private to the member who sets it.
            if (
                data.viewerPreference &&
                identity?.membershipState === 'active'
            ) {
                view.formValues.setMemberPreference = {
                    targetHandle: detail.handle,
                    preference: data.viewerPreference,
                }
                view.messageHref =
                    bases.forum +
                    '/Messages?participantHandles=' +
                    encodeURIComponent(detail.handle) +
                    '#PassConversationsCreateConversation'
            } else view.forms = []
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
            view.activityTitle = ec.l10n.localize('Topics started')
            def.link = 'topic'
        }
        view.next = data.nextCursor
        if (view.next) {
            const params = inputFor(def.read, siteId, {
                ...def.defaults,
                ...parameters,
            })
            delete params.siteId
            if (scope) delete params.scopeContactListId
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
        if (name === 'Policies') {
            // Plain digits: a number field rejects the grouped form ("100,000") the renderer would show.
            view.formValues.storePolicy = {
                ...Object.fromEntries(
                    Object.entries(data.policy).map(([k, v]) => [
                        k,
                        typeof v === 'number' ? String(v) : v,
                    ]),
                ),
                expectedRevision: data.revision,
            }
            view.formValues.storeRule = { active: true, sequenceNum: 0 }
            view.rows = call('findRules', { siteId }).ruleList.map((rule) => ({
                ...rule,
                title:
                    rule.ruleType +
                    ' “' +
                    rule.pattern +
                    '” → ' +
                    rule.action +
                    (rule.enabled === 'Y' ? '' : ' (disabled)'),
            }))
            view.details = []
        }
        if (name === 'MemberModeration' && data.scopeActivity) {
            // moderated as a scope's Owner: the member's posts and the actions on them in the scope, and a sanction
            // there; the trust level is the site's, not set here
            view.details = [
                [ec.l10n.localize('Posts here'), String(data.scopeActivity.postCount ?? 0)],
            ]
            view.scopeActions = (data.scopeActivity.actionList || []).map(
                (action) => ({
                    action: action.action,
                    reason: action.reason || '',
                    createdAt: action.createdAt,
                }),
            )
            view.forms = view.forms.filter((f) => f.op !== 'setTrust')
            view.formValues.setSanction = {
                targetPartyId: parameters.targetPartyId,
                contactListId: parameters.contactListId,
            }
        }
        if (name === 'MemberModeration' && data.memberState) {
            view.formValues.setTrust = {
                targetPartyId: parameters.targetPartyId,
                trustLevel: data.memberState.trustLevel || 'new',
                expectedRevision: data.memberState.revision ?? 0,
            }
            view.details = view.details.concat(
                Object.entries(data.memberState).filter(
                    ([k, v]) => v != null && k !== 'revision',
                ),
            )
        }
        if (name === 'Members') {
            view.grants = call('findAccessGrants', {
                siteId,
                ...(parameters.contactListId
                    ? { contactListId: parameters.contactListId }
                    : {}),
            }).grantList
            view.formValues.setAccessGrant = parameters.contactListId
                ? { targetType: 'category' }
                : { targetType: 'site' }
        }
        if (name === 'SiteDetail' && identity?.capabilities?.canManageSite)
            view.bindings = call('findSubscriptionBindings', {
                siteId,
            }).bindingList
        if (name === 'Operations') {
            view.exports = call('findExports', { siteId }).exportList
            view.dataRequests = call('findDataRequests', {
                siteId,
            }).requestList
            view.formValues.startOperation = {
                dryRun: 'true',
                ...(parameters.operation
                    ? { operation: parameters.operation }
                    : {}),
            }
        }
        if (name === 'Policies') {
            const retention = call('getRetentionPolicy', { siteId })
            view.formValues.storeRetentionPolicy = {
                ...Object.fromEntries(
                    Object.entries(retention.policy).map(([k, v]) => [
                        k,
                        String(v),
                    ]),
                ),
                expectedRevision: String(retention.revision),
            }
        }
        if (name === 'Import') {
            view.rows = (data.importList || []).map((v) => ({
                label: (v.sourceName || v.archiveName) + ' · ' + v.stage,
                href: '?importId=' + encodeURIComponent(v.importId),
                note:
                    'Discourse ' +
                    (v.discourseVersion || 'unknown version') +
                    ' · reconciliation ' +
                    (v.reconciliationRevision || 0),
            }))
            if (parameters.importId) {
                view.importDetail = call('getImport', {
                    siteId,
                    importId: parameters.importId,
                })
                const importId = parameters.importId
                for (const f of view.forms)
                    view.formValues[f.op] = {
                        ...(view.formValues[f.op] || {}),
                        importId,
                    }
                view.formValues.approveImport.expectedRevision = String(
                    view.importDetail.import.reconciliationRevision || 0,
                )
            }
        }
        if (name === 'Activity') {
            view.activity = data
            view.details = []
            view.exports = call('findExports', { siteId }).exportList.filter(
                (x) => x.kind !== 'personal' && x.kind !== 'site',
            )
        }
        if (name === 'Mail') {
            view.routes = call('findRoutes', { siteId }).routeList
            view.receipts = call('findInboundReceipts', {
                siteId,
                limit: 30,
            }).receiptList
            view.formValues.storeRoute = { active: true, expectedRevision: 0 }
        }
        if (name === 'Notifications') {
            view.outcomes = call('findMyReviews', { siteId }).reviewList
            if (!view.outcomes.length)
                view.forms = view.forms.filter((f) => f.op !== 'appealReview')
        }
        if (name === 'PostHistory') {
            view.forms = view.forms.filter((f) =>
                f.op === 'setPostHistory' ? data.canSetHistory : data.canRestore,
            )
            view.formValues.restorePostRevision = {
                expectedRevision: data.revision,
            }
            view.backHref = forumBase + '/p/' + encodeURIComponent(data.postId)
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
                row.href = forumBase + '?tag=' + encodeURIComponent(row.name)
            if (name === 'ReviewQueue')
                row.title =
                    row.reasonFamily +
                    ' · ' +
                    row.targetType +
                    (row.linkedReviewId ? ' · appeal' : '') +
                    ' · ' +
                    row.reviewId
            if (name === 'TopicDetail' && row.pollId)
                row.poll = call('getPoll', { siteId, pollId: row.pollId }).poll
            if (def.link === 'topic')
                row.href =
                    forumBase +
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
                row.href = forumBase + '/p/' + encodeURIComponent(row.postId)
            if (name === 'Notifications')
                row.state =
                    (row.read ? 'Read' : 'Unread') +
                    (row.reason ? ' · ' + row.reason.replace('-', ' ') : '')
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
                    forumBase +
                    '/Categories/CategoryDetail?contactListId=' +
                    encodeURIComponent(row.contactListId)
            if (def.link === 'conversation')
                row.href =
                    bases.forum +
                    '/Messages/ConversationDetail?rootCommEventId=' +
                    encodeURIComponent(row.rootCommEventId)
            if (name === 'Conversations' && row.participants)
                row.snippet = 'With ' + row.participants.join(', ')
            if (def.link === 'draft')
                row.href =
                    bases.forum +
                    '/Compose?draftId=' +
                    encodeURIComponent(row.draftId)
            if (def.link === 'review')
                row.href =
                    moderationBase +
                    '/ReviewDetail?reviewId=' +
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
/* The categories of a scope's subtree (findCategories with the scope), by id. */
function scopeCategories(siteId, scope) {
    const ids = new Set([String(scope.contactListId)])
    let cursor = null
    for (let page = 0; page < 20; page++) {
        const found = call('findCategories', {
            siteId,
            scopeContactListId: scope.contactListId,
            limit: 100,
            ...(cursor ? { cursor } : {}),
        })
        for (const c of found.categoryList || [])
            ids.add(String(c.contactListId))
        cursor = found.nextCursor
        if (!cursor) break
    }
    return ids
}
/* A topic or a category of another category asked for inside a scope is Not Found there (design-smithy §12.5). */
function requireInScope(siteId, scope, contactListId) {
    if (
        contactListId &&
        scopeCategories(siteId, scope).has(String(contactListId))
    )
        return
    const e = new Error('Page not found')
    e.moquiErrorKind = 'NotFound'
    throw e
}
/* A topic's related record as its card shows it: what it is and, for a record another app has a page of (an issue the
 * topic was made into, a merge request it discusses, a release it announces), that page's path on this site, which the
 * authority gives for a record the reader may see. */
function linkCard(link) {
    const kinds = {
        case: ec.l10n.localize('Support case'),
        product: 'Product',
        article: 'Article',
        issue: 'Issue',
        mergeRequest: 'Merge request',
        release: 'Release',
    }
    return {
        ...link,
        kindLabel: kinds[link.sourceType] || 'Article',
        href: /^\/(?![/\\])/.test(String(link.path || '')) ? link.path : null,
        label: link.title || link.sourceId,
    }
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
    // The decision form records one mapping.
    if (parameters.formAction === 'storeImportMappings')
        parameters = {
            ...parameters,
            mappings: JSON.stringify([
                Object.fromEntries(
                    [
                        'mappingType',
                        'sourceId',
                        'decision',
                        'targetId',
                        'reason',
                    ]
                        .filter((k) => parameters[k])
                        .map((k) => [k, String(parameters[k])]),
                ),
            ]),
        }
    // The policy form posts every setting; an unchecked box is an explicit false.
    if (parameters.formAction === 'storePolicy')
        parameters = {
            ...parameters,
            config: Object.fromEntries(
                POLICY_FIELDS.filter(
                    ([name, , type]) =>
                        type === 'checkbox' ||
                        (parameters[name] != null && parameters[name] !== ''),
                ).map(([name, , type]) => [
                    name,
                    type === 'number'
                        ? Number(parameters[name])
                        : type === 'checkbox'
                          ? ['true', 'on', true].includes(parameters[name])
                          : String(parameters[name]),
                ]),
            ),
        }
    // An unchecked box posts nothing; on the account form it means own posts stay out of mailing-list email.
    if (
        name === 'Settings' &&
        parameters.formAction === 'setPreferences' &&
        parameters.includeOwn == null
    )
        parameters = { ...parameters, includeOwn: false }
    const form = def.forms?.find((f) => f.op === parameters.formAction)
    if (!form) {
        const e = new Error(ec.l10n.localize('Unknown form action'))
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
            public: ec.l10n.localize('Anyone, including visitors who are not signed in'),
            members: ec.l10n.localize('Active site members'),
            category: ec.l10n.localize('Granted category members'),
            help: ec.l10n.localize('Participants in their own discussions'),
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
    for (const key of ['action', 'targetRootCommEventId'])
        if (result[key])
            params.push(key + '=' + encodeURIComponent(result[key]))
    if (result.selectedPostIds?.length && result.action !== 'merge')
        params.push(
            'postIds=' + encodeURIComponent(result.selectedPostIds.join(',')),
        )
    const selection = result.selectedPostIds
        ? '<p>Posts moved, with their replies: ' +
          encode(result.selectedPostIds.length) +
          ' (' +
          encode(result.replyCount ?? 0) +
          ' replies added to the selection)</p><p>Attachments moved: ' +
          encode(result.attachmentCount ?? 0) +
          '</p><p>Topic watchers are not copied to the destination: ' +
          encode(result.watcherCount ?? 0) +
          '</p>' +
          (result.acceptedAnswerAffected
              ? '<p>The accepted answer moves and is cleared.</p>'
              : '')
        : ''
    return (
        '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Review audience</title><main style="max-width:45rem;margin:2rem auto;padding:1rem;font:1rem/1.6 system-ui"><h1>Review audience</h1><p>Current audience: ' +
        encode(audience(result.sourceVisibility || category.visibility)) +
        '</p><p>Proposed audience: ' +
        encode(audience(result.targetVisibility || result.proposedVisibility)) +
        '</p><p>Discussions or posts affected: ' +
        encode(result.topicCount ?? result.visiblePostCount ?? 0) +
        '</p>' +
        selection +
        '<p>Existing email cannot be retracted. Future reads and deliveries use the new audience.</p><a href="' +
        encode(back + (params.length ? '?' + params.join('&') : '')) +
        '">Return to confirm the change</a></main></html>'
    )
}
/* The exact public body and audience of a reply from a case, with a form that publishes only this preview. */
function caseReplyPreview(result, parameters, back) {
    const encode = (value) => WebUtilities.encodeHtml(String(value ?? ''))
    const hidden = (name, value) =>
        '<input type="hidden" name="' +
        name +
        '" value="' +
        encode(value) +
        '">'
    return (
        '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Review public reply</title><main style="max-width:45rem;margin:2rem auto;padding:1rem;font:1rem/1.6 system-ui"><h1>Review public reply</h1><p>Audience: ' +
        encode(result.audience) +
        '</p><p>This is exactly what will be published. Nothing else from the case is copied.</p><article style="border:1px solid #888;padding:1rem">' +
        result.body +
        '</article><form method="post" action="' +
        encode(back + '/save') +
        '">' +
        hidden('moquiSessionToken', ec.web.sessionToken) +
        hidden('formAction', 'publishCaseReply') +
        hidden('operationId', ec.user.randomString(32)) +
        hidden('rootCommEventId', parameters.rootCommEventId) +
        hidden('requestId', parameters.requestId) +
        hidden('body', parameters.body) +
        hidden('previewHash', result.previewHash) +
        '<button>Publish this reply</button></form><p><a href="' +
        encode(back) +
        '">Return without publishing</a></p></main></html>'
    )
}
/* What an operation would touch, with a link back to start it with the revision the preview showed. */
function operationPreview(result, back) {
    const encode = (value) => WebUtilities.encodeHtml(String(value ?? ''))
    const lines = []
    if (result.topicCount != null) lines.push('Topics: ' + result.topicCount)
    if (result.deliveryCount != null)
        lines.push('Failed deliveries to retry: ' + result.deliveryCount)
    for (const item of Object.values(result.retention || {}))
        lines.push(
            item.label +
                ': ' +
                (item.days
                    ? item.count + ' older than ' + item.days + ' days'
                    : 'kept'),
        )
    const params =
        'operation=' +
        encodeURIComponent(result.operation) +
        (result.policyRevision != null
            ? '&expectedRevision=' + encodeURIComponent(result.policyRevision)
            : '')
    return (
        '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Review operation</title><main style="max-width:45rem;margin:2rem auto;padding:1rem;font:1rem/1.6 system-ui"><h1>Review operation</h1><p>' +
        encode(result.operation) +
        '</p><ul>' +
        lines.map((line) => '<li>' + encode(line) + '</li>').join('') +
        '</ul><p>Retention starts as a dry run; applying it needs the policy revision shown here. Nothing is pruned automatically.</p><a href="' +
        encode(back + '?' + params + '#PassOperationsStartOperation') +
        '">Return to start it</a></main></html>'
    )
}
/* Where an old URL of an imported community points now, or null when it names nothing this reader may see. */
function legacyUrl(siteId, path, bases, scope) {
    let found
    try {
        found = call('resolvePermalink', { siteId, path })
    } catch (e) {
        ec.message.clearErrors()
        return null
    }
    const forum = scope ? scope.base : bases.forum || ''
    if (found.kind === 'category')
        return (
            forum +
            '/Categories/CategoryDetail?contactListId=' +
            encodeURIComponent(found.contactListId)
        )
    if (found.kind === 'post')
        return forum + '/p/' + encodeURIComponent(found.postId)
    return forum + '/t/' + encodeURIComponent(found.rootCommEventId)
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
;({
    legacyUrl,
    requireInScope,
    load,
    save,
    inputFor,
    preview,
    caseReplyPreview,
    operationPreview,
    invitationResult,
})
