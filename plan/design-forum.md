# IronStoa PASS — Forum design

Oct 27, 2026 — draft; complete design with staged implementation. Documentation only.

**IronStoa PASS — Public Application Software Suite** is the public-facing companion to
**IronStone BOSS**. Its repository and component name are **`mr-pass`**. Forum serves community
sites such as forum.moqui.org and customer, supplier, partner and member communities, including
private and paid communities. Commerce and Blog/Publishing are future PASS apps. This document
fully designs Forum and the shared foundation; §13 defines the future apps' boundaries and
integration contracts, not their complete screen designs.

This document belongs to `mr-pass/plan/design-forum.md`. It was developed alongside the BOSS
designs; those documents remain shared design references, not runtime dependencies.

**Inputs:** [design guide](../../mr-boss/plan/design-doc-guide.md), [style guide](../../mr-boss/plan/style-guide.md),
[Commons/Comms §§12, 16, 19](../../mr-boss/plan/design-drawers-commons.md#12-comms-home-inbox-and-email),
[crosscut external access](../../mr-boss/plan/design-crosscut.md#5-external-access-and-shared-configuration),
[Customer Service](../../mr-boss/plan/design-customer-service.md), [Commerce research](../../mr-boss/plan/research-commerce.md),
[Marketing research](../../mr-boss/plan/research-marketing.md), and the implementation/reference sources in §3.
Screen and form summaries follow the design guide; PASS supplies its own shell and site roles.
There is no separate Forum research file. Existing, extended and proposed capabilities are
explicitly distinguished in §§14–16; a design service name is not a claim that it exists.

**Sections:** [1 shell](#1-shell) · [2 screens](#2-screens) · [3 evidence](#3-reference-evidence-and-disposition) ·
[4 deployment](#4-deployment-and-public-api) · [5 access](#5-identity-membership-and-access) ·
[6 discovery](#6-discovery-screens) · [7 topics](#7-topics-and-composition) ·
[8 accounts](#8-accounts-and-personal-screens) · [9 conversations](#9-private-conversations) ·
[10 moderation](#10-moderation) · [11 administration](#11-administration) ·
[12 delivery](#12-read-state-notifications-and-email) · [13 integrations](#13-pass-applications-and-boss-integration) ·
[14 data](#14-data-model) · [15 services](#15-service-and-api-catalog) ·
[16 needs](#16-framework-and-data-needs) · [17 outputs](#17-documents-and-outputs) ·
[18 migration](#18-migration-and-rollout) · [19 validation](#19-validation-and-completeness) ·
[20 decisions](#20-decided) · [21 open](#21-open).

## 1. Shell

Root `screen/Pass.xml`, displayed as IronStoa PASS or the site's configured brand; Forum icon
`sym_o_forum`. A deployment maps an allow-listed hostname to a `PublicSite` and an enabled app
mount. Default mounts are `/forum`, `/account`, `/members`, and `/sites` (site administration);
a forum-only site may mount Forum at `/`. Commerce and Publishing reserve configurable mounts,
conventionally `/shop` and `/blog`. Mounts may not overlap reserved authentication/API routes.
Screen paths below are component-relative identities, not assumptions about an external prefix.

PASS uses a dedicated public shell. The framework's current `PublicShell` serves checked token
routes, and is not a ready-made general website shell. Reuse its libraries, theme primitives,
login, editor and sanitized HTML widgets; add the normal host/mount routing and public shell
contract in PASS and the framework. No BOSS drawer, internal navigation or launcher grant is
required. `ALL_USERS` authorizes the authenticated public entry points; service checks determine
site, category, conversation and staff capabilities. Anonymous entry points expose reads and
explicit account/token workflows only, never arbitrary entity or service calls.

Navigation, depth two:

- Forum — Topics (landing), Categories, Tags, Search.
- My forum — Notifications, Bookmarks, Drafts, Messages; visible after sign-in.
- Community — member profile links, Guidelines, About; directory participation is opt-in.
- Moderation — Review queue, Member moderation, Moderation log; scoped staff only.
- Forum settings — Categories, Members, Policies, Mail, Operations, Import, Activity.
- Account — Sign in/Register or Profile/Settings/Sign out.
- Site administration — Sites and Site detail; site owners/operators only.
- Other enabled PASS apps — Shop and Publishing, with labels/mounts from the site.

The default landing is Latest topics, with category/tag filters, pinned announcements and a
New topic action. Signed-in users also have New, Unread and Top views and their notification
count; anonymous visitors have no personal counts. The site may choose Categories as landing.
The header contains brand, app navigation, search and account controls. A desktop category rail
collapses to a drawer on phones; the topic timeline collapses to a progress/jump control.

Public reading uses server-rendered HTML with ordinary links and bounded pages; qvue enhances
the topic stream and composer. Both use the same authorized projection. Canonical topic URLs
contain the immutable root ID and a decorative slug; post permalinks contain the immutable
communication-event ID. Old slugs redirect after access checks. No-JavaScript reading and feed
links work; composition requires JavaScript. Keyboard actions never capture editor typing;
focus, headings, skip links, live announcements and touch-sized actions are required. Rich
content uses framework sanitization, code blocks, accessible images and explicit attachment
controls. No arbitrary site-admin JavaScript is a theme setting. Localization, locale, time zone,
light/dark colors and reduced motion follow framework facilities. A dedicated TUI is deferred.

## 2. Screens

**Scope/stages:** all PASS-owned rows are `new`. S1 is the usable foundation; S2 completes forum
participation; S3 adds integrations, migration and advanced operations. A screen marked S1/S2
has an S1 functional core and the specifically named S2 additions below. Future Commerce and
Publishing screens are not claimed as designed here. Each row has exactly one screen definition
in §§6–11; simple dialogs remain forms on their parent. `Context` is PASS-local context, usable
by authorized extensions, and does not imply a BOSS Assist drawer.

| Screen | Path | Archetype | Impl | Purpose | Main record | Reused | Roles | Scope/stage | Context |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Topics | Forum/Topics | list | xml | Discover topic activity | CommunicationEvent + ForumTopic | own | reader | new S1 | site, filters |
| Categories | Forum/Categories | landing | xml | Browse category hierarchy | ContactList + ForumCategory | own | reader | new S1 | site |
| CategoryDetail | Forum/Categories/CategoryDetail | list | xml | Category topics, rules and membership | ContactList | own | category reader | new S1 | site, category, filters |
| Tags | Forum/Tags | list | xml | Browse tags and tagged topics | ForumTag | own | reader | new S2 | site, tag |
| Search | Forum/Search | list | xml | Search allowed forum content | authorized search projection | own | reader | new S1 | site, query |
| Guidelines | Forum/Guidelines | detail | xml | Read guidelines and about content | published WikiPage | Wiki services, own public view | reader | new S1 | site, published page |
| TopicDetail | Forum/Topics/TopicDetail | detail | qvue + html | Read and act on a topic | CommunicationEvent + ForumTopic | own | topic reader | new S1/S2 | site, root, selected posts |
| ComposeTopic | Forum/Compose | editor | qvue | Create, reply, edit and recover drafts | ForumDraft | framework editor | permitted author | new S1/S2 | site, category/root, draft |
| PostHistory | Forum/Topics/PostHistory | dialog | xml | Compare permitted post revisions | ForumPostRevision | framework diff renderer | permitted reader/staff | new S2 | site, post, revisions |
| Login | Account/Login | task | xml | Authenticate and recover an account | UserAccount | framework auth flow | anonymous | new S1 | site, return path |
| SecondFactor | Account/SecondFactor | task | xml | Finish required authentication | framework auth challenge | framework auth flow | pending challenge | new S1 | site, challenge |
| Registration | Account/Register | wizard | xml | Register, verify and join a site | registration challenge + PublicSiteParty | own over framework registration | anonymous/member | new S1 | site, challenge |
| Invitation | Account/Invitation | task | xml | Redeem an invitation | PublicSiteInvitation | own | token recipient | new S1 | site, token capability |
| MemberDetail | Members/MemberDetail | detail | xml | Read a public community profile | PublicSiteProfile | own | permitted reader | new S1 | site, profile |
| AccountSettings | Account/Settings | settings | xml | Manage profile, security and preferences | PublicSiteProfile + preferences | framework security actions | self | new S1/S2 | site, self |
| Notifications | Account/Notifications | list | xml | Act on personal notifications | notification projection | framework notifications | self | new S1 | site, filters |
| Bookmarks | Forum/Bookmarks | list | xml | Return to saved posts/topics | ForumBookmark | own | self | new S2 | site, filters |
| Drafts | Forum/Drafts | list | xml | Resume or discard drafts | ForumDraft | own | self | new S1 | site, self |
| Unsubscribe | Account/Unsubscribe | task | xml | Change email delivery by token | ForumDeliveryPreference | framework token/consent primitives | token recipient | new S1/S2 | scoped token |
| Conversations | Forum/Messages | list | xml | List private conversations | ForumTopic + ForumParticipant | own | participant | new S2 | site, filters |
| ConversationDetail | Forum/Messages/ConversationDetail | detail | qvue + html | Private topic stream and recipients | CommunicationEvent + ForumParticipant | TopicDetail stream/composer | participant | new S2 | site, root |
| ReviewQueue | Forum/Moderation/ReviewQueue | list | xml | Triage review work | ForumReviewItem | shared Mantle review projection | scoped moderator | new S1/S2 | site, filters, selection |
| ReviewDetail | Forum/Moderation/ReviewDetail | task | xml | Resolve a review item | ForumReviewItem | own | scoped moderator | new S1/S2 | site, review ID |
| MemberModeration | Forum/Moderation/MemberDetail | detail | xml | Review member conduct | ForumMemberState | own | scoped moderator | new S1/S2 | site, member |
| ModerationLog | Forum/Moderation/Log | list | xml | Inspect audit history | ForumModerationAction | own | scoped staff | new S1 | site, filters |
| Sites | Sites | list | xml | Select or provision a public site | PublicSite | own | operator/site owner | new S1 | allowed sites |
| SiteDetail | Sites/SiteDetail | settings | xml | Configure site identity and apps | PublicSite + hosts/mounts | own | site owner/operator | new S1 | site |
| CategorySettings | Forum/Settings/Categories | settings | xml | Manage categories and access | ForumCategory + ContactList | shared list services | site/category owner | new S1/S2 | site, category |
| Members | Forum/Settings/Members | list | xml | Manage membership and invitations | PublicSiteParty + ContactListParty | shared list services | scoped owner/moderator | new S1 | site, category, selection |
| ForumPolicies | Forum/Settings/Policies | settings | xml | Configure community controls | ForumPolicy | own | site owner | new S1/S2 | site, policy revision |
| MailDelivery | Forum/Settings/Mail | settings | xml | Configure and diagnose forum mail | ForumMailRoute + delivery ledger | shared mail services | site owner/mail operator | new S1/S2 | site, route |
| Operations | Forum/Settings/Operations | task | xml | Inspect and repair operational jobs | ForumJobRun | shared job facilities | site owner/operator | new S1/S3 | site, run |
| Migration | Forum/Settings/Import | wizard | xml | Stage, reconcile and cut over imports | ForumImportRun | own | operator + site owner | new S3 | site, import run |
| ActivityReports | Forum/Reports/Activity | report | xml | Inspect community/delivery health | aggregate projections | own | scoped staff | new S3 | site, date range |

## 3. Reference evidence and disposition

Source paths are relative to these checkouts: **Framework** = `mr-moqui`; **Mantle** =
`mr-moqui/runtime/component/mr-mantle`; **BOSS** = `mr-moqui/runtime/component/mr-boss`;
**Discourse** = `3p_other/discourse`; **phpBB** = `3p_other/phpbb`; **Odoo** = `3p_other/odoo/odoo`.
All are siblings under the working `moquiwork` directory except the components. Reviewed local
revisions: Mantle `909e43053c67`, BOSS `19af60169f2a`, Discourse `568a006ad8f5`, phpBB
`a4cea6406ff6`, Odoo `8ff0e7204c0c`. These identify inspected snapshots, not a latest-version claim.

| Ref | Verified source pointers | Contribution and disposition |
| --- | --- | --- |
| R1 | Mantle `entity/MarketingEntities.xml`, `service/mantle/marketing/ContactListServices.xml`; `entity/PartyEntities.xml`, `service/mantle/party/CommunicationServices.xml`; BOSS `screen/Comms/Inbox/Mail.qvue`, `service/ironstone/comms/InboxServices.xml` | Adopt existing list/thread data and Comms integration. Extend access and recipient allocation; public APIs cannot expose existing broad service parameter sets directly. |
| R2 | Discourse `frontend/discourse/app/templates/discovery/categories.gjs`, `frontend/discourse/app/templates/topic.gjs`, `frontend/discourse/app/components/topic-timeline.gjs`; `app/models/topic.rb`, `post.rb`, `category.rb`, `post_revision.rb`, `bookmark.rb` | Adopt topic-centric navigation, persistent composer, jump-to-unread, revisions and bookmarks. Chronological discussion is default; no phpBB-style signature/profile column. |
| R3 | Discourse `app/models/topic_user.rb`, `category_user.rb`, `lib/notification_levels.rb`, `app/models/post_reply_key.rb`, `invite.rb` | Adopt watching/tracking/mute, category first-post watching, resumable reading, invitation and reply-token concepts. Keep internal recipient state and forum email preferences distinct. |
| R4 | Discourse `app/models/reviewable.rb`, `reviewable_flagged_post.rb`, `reviewable_queued_post.rb`, `user_history.rb`, `topic_timer.rb`, `watched_word.rb`; `lib/trust_level.rb`, `lib/promotion.rb`; `plugins/discourse-ai`, `plugins/discourse-user-notes` | Adopt shared review queue, claims, history, trust controls and optional classifier. No automatic moderator authority from reputation; no autonomous AI bans/deletions. |
| R5 | Discourse `plugins/discourse-solved`, `plugins/discourse-reactions`, `plugins/poll`, `plugins/discourse-subscriptions`; `app/models/topic_allowed_user.rb`, `topic_allowed_group.rb` | Adopt independent accepted answers, reactions, polls, explicit private participants and subscription integration. Use Mantle entitlements instead of plugin payment storage. |
| R6 | phpBB `phpBB/styles/prosilver/template/viewforum_body.html`, `viewtopic_body.html`, `posting_editor.html`, `posting_poll_body.html`; `phpBB/language/en/acp/permissions_phpbb.php`; `phpBB/includes/mcp/mcp_main.php`, `mcp_topic.php`, `mcp_queue.php` | Adopt capability distinctions, saved drafts, poll options, bulk move/split/merge, soft-delete/restore and moderation diagnostics. Omit signatures, forum passwords and manual bump privileges; private access uses identity/membership. |
| R7 | Odoo `addons/website_forum/models/forum_forum.py`, `forum_post.py`, `forum_post_vote.py`; `addons/website_forum/views/forum_forum_templates_post.xml`, `forum_forum_templates_moderation.xml`; `addons/website_forum/controllers/website_forum.py` | Adopt category discussion/Q&A intent, answer filtering, accepted-answer affordances and website integration. Optional Q&A mode keeps the same chronological storage and accepted-answer highlight. Omit a separate karma ledger; PASS trust/reactions cover the need. |
| R8 | Odoo `addons/website_blog/models/website_blog.py`, `controllers/main.py`, `views/website_blog_templates.xml`, `views/website_blog_posts_loop.xml`; `addons/website_blog/__manifest__.py` | Future Publishing: publications, author/teaser/cover, taxonomy, scheduled visibility, archive/search and public-site integration. Full publishing screens deferred, contracts in §13. |
| R9 | Odoo `addons/website_sale/models/website.py`, `product_public_category.py`, `controllers/cart.py`, `payment.py`, `portal.py`; `addons/website_sale/__manifest__.py`; `addons/website`, `website_mail`, `website_payment`, `auth_signup`, `portal` | Future Commerce: site/store/account binding, public catalog, cart/checkout, portal and content integration. Full Commerce screens deferred. Website-builder parity and general arbitrary page-layout editing are outside this Forum design. |
| R10 | Framework `runtime/base-component/framework/entity/ResourceEntities.xml`, `service/org/moqui/impl/WikiServices.xml` under that same component; `docs/Mail-Inbound.md`; `runtime/base-component/framework/entity/ChatEntities.xml`; `crates/moqui-core/src/service/remote.rs`; Mantle `entity/ProductDefinitionEntities.xml`, `service/mantle/product/SubscriptionServices.xml` | Reuse wiki versions/reviews, mail ingestion, remote transport and subscription interfaces. Chat reactions/polls are keyed to ChatEvent and cannot be used as forum rows unchanged. |

Additional dispositions: Discourse migration is S3 (§18); phpBB import is deferred. Topic voting
as a separate feature-request ranking system, badges/leaderboards, live chat, events, federation,
a TUI and a general plugin/theme marketplace are deferred. RSS/Atom outputs and accessible HTML
are included. Q&A mode does not impose Odoo's one-answer limit or a second reply tree. No copying
of reference implementations is needed; the sources establish behavior and screen patterns.

## 4. Deployment and public API

### 4.1 Component and authority boundary

`mr-pass` has framework-only static requirements. Local mode additionally requires an installed
`mr-mantle` at startup; fail readiness if it is absent. This runtime requirement, rather than an
unconditional component dependency, lets a remote PASS host run without Mantle's business entity
catalog or database. The backend installs Mantle and the scoped API described here, not BOSS or
PASS screens. A colocated deployment may install all three; a dedicated forum may use only PASS
and Mantle. Authentication, mail and search features must be present in the selected runtime
package; readiness reports missing capabilities rather than pretending SSO/mail works everywhere.

The deployment selects one configured local or remote backend, never an endpoint from a request.
All hosted sites use that authority. Independent deployments may use different authorities;
accounts are shared across sites of one authority, not silently synchronized across databases.
PASS's remote host stores only operational configuration, sessions and permitted caches, not a
second party, membership, post, order or publication database. Its framework session represents
a delegated backend subject without provisioning a duplicate local UserAccount/Party; that
session support is part of PASS-AUTH, not assumed to work in the existing login flow. Drafts persist at the authority;
a browser recovery copy is disposable and isolated by account/site. No dual-write or eventual
replication scheme is part of this design.

The proposed `pass.*` facade exposes typed screen services. Local adapters call §15's domain
services; remote adapters call `/rest/s1/pass/v1/sites/{siteId}/...`, implemented by Mantle's
new `service/pass.rest.xml`. Generic Mantle REST/entity endpoints are not the public API. Host
resolution uses a configured host map plus backend-validated site/mount bindings; an arbitrary
Host header, query `siteId` or category ID cannot select another site's authority or content.

### 4.2 Authentication across deployments

Framework registration and a public-session bridge are new needs, not supplied by `remote-rest`
alone. The backend authenticates password/second-factor or its configured SSO flow and issues
a short-lived, audience-bound delegation credential to a registered PASS deployment. The browser
receives a local secure session cookie; backend credentials stay server-side. Credentials carry
subject, allowed site scope, client audience, expiry and revocable session identity. Every call
revalidates current membership and actions. Anonymous reads use an explicit anonymous context;
a deployment credential never impersonates a user or carries staff access by itself.

Login, recovery and SSO callbacks use registered origins and local return paths. CSRF checks
apply to cookie-authenticated changes. The remote adapter needs authenticated headers, timeout,
error and streaming support beyond today's basic `remote-rest` runner. Reuse framework outbound
transport; do not implement an ad hoc HTTP client in screens. Site owners configure policies;
operators configure backend addresses, credentials and gateway secrets outside public forms.

### 4.3 Common request and response contract

- Reads return allow-listed projections plus current capabilities, revision and continuation
  information. Public profiles expose handle/display name/avatar/bio and permitted activity,
  never raw Party/UserAccount, email, group memberships, private recipients or internal receipts.
- Lists use opaque scoped cursors and a stable sort with ID tie-breakers, 30 rows by default,
  maximum 100. Topic windows use stable post ordinals and a `before`, `after`, `around` or
  explicit post locator; access filtering happens before counts/snippets/paging.
- Public write DTOs accept content and target IDs only, never author, staff role, status,
  recipient-state, raw entity names, permission booleans or arbitrary service names. Explicit
  staff operations have separate capability checks. All entry points call the same rules.
- Creates, replies, uploads-finalization, import units and payment-driven grants use a client
  operation ID unique within site/actor/action. Same ID and payload returns the original result;
  a different payload conflicts. Store the deduplication record with the durable write.
- Edits and administrative decisions require `expectedRevision`; stale writes return conflict
  with a reload/compare path. Allocate per-thread ordinals under a transaction/lock, never
  `max + 1` without serialization. Notifications are queued after the durable change commits.
- HTTP results distinguish unauthenticated 401, known-but-forbidden action 403, concealed/missing
  resource 404, conflict 409, field validation 422, throttling 429 with retry time, and temporary
  backend failure 503. An error includes code, safe message, field errors and correlation ID;
  operational logs can identify the failed item without publishing bodies or secrets.
- Public HTML/API cache entries are site/locale/policy-generation scoped and contain only
  anonymous projections. Never shared-cache personalized/private content. Permission, deletion,
  moderation and publication changes invalidate caches/search and advance the generation before
  serving changed visibility; stale indexes are post-filtered against authoritative access.
- Realtime invalidations contain IDs/revisions only and are scoped per authorized site/topic.
  Clients refetch authorized projections; remote deployments proxy a backend subscription.
  Cursor polling is the fallback. Revoked subscriptions stop delivery and clear displayed data.

Network failures retain the draft and operation ID, show retry state and never report an
unconfirmed post as sent. Authorization is never served from a stale positive cache. Failed
independent mail deliveries/jobs continue with item-level results; a partially executed topic
move or access change must roll back.

## 5. Identity, membership and access

### 5.1 Identity and site roles

A public account has only automatic `ALL_USERS`; an internal account has an active membership in
at least one other `UserGroup`. Preserve this agreed distinction. PASS roles live in site/list
membership records, not UserGroups. Registration creates no internal group and derives party
identity at the backend. Separate accounts intended as separate privacy identities must have
separate parties; accounts sharing a Party share its messaging identity. Recipient fan-out treats
a party as internal if any enabled account for that party has an active internal group.

`PublicSiteParty` holds member, moderator or owner with joined/pending/active/suspended/ended
state. Site moderator authority covers that site's categories, not another site or BOSS.
`ContactListParty` retains `ListOwner`, `ListModerator` and ordinary membership. An existing list
owner remains its category owner, but cannot publish it to the internet without site-owner
approval. Operators provision sites and backend bindings through deployment authority; a new
public user cannot promote themselves to site owner. Framework registration creates/verifies the
UserAccount; the Mantle membership service idempotently creates or links its Party after verified
identity, preserving the framework/Mantle dependency direction. Failed joins leave a retryable
account without site grants, not a half-authorized membership. The last active site/list owner cannot be
removed without assigning a replacement.

Registration modes: closed, invitation, or verified open registration; closed is the new-site
default. Optional site approval follows email verification. Registration/recovery responses do
not disclose whether an email already exists. Verification tokens are hashed, single-use,
expiring and rate-limited. Invitations bind site, intended verified address, expiry, inviter and
allowed category/organization grants; defaults never include staff or internal groups. Changing
email requires fresh verification. SSO still checks local site eligibility; a provider's verified
email is accepted only under a configured trust policy.

Organization eligibility uses verified email domains or explicit invitations mapped by an owner
to an organization. Domain matching grants only the configured site/category relationship, not
arbitrary Party relationships or business authority. Purchasing a subscription likewise grants
only its declared resource scope. Authentication may be shared across sites; joining one site
never auto-joins another. Public registration or profile edits cannot search the internal party
directory. Member lookup is site-scoped and respects profile discovery and blocking.

### 5.2 Publication and effective access

A `ForumCategory` explicitly binds exactly one MAILBOX list to one site and its parent category.
One category tree cannot span sites or contain cycles. A hierarchy is navigation plus an access
ceiling: a child's effective access cannot exceed an ancestor's. Moving under a narrower parent
shows an impact preview and applies all affected visibility changes atomically. Multi-site
syndication is an explicit link, not a second binding that accidentally widens a mailbox.

New site publication is off. Existing mailbox `isPublic=Y` still means its existing internal
visibility, not publication. Published category modes are anonymous public, signed-in site
members, category members, or help (own threads). Restricted membership may come from a manual
membership, configured organization relationship or active entitlement; owners specify which
sources qualify. Expiry/revocation removes the corresponding source, not unrelated manual grants.
All published-category readers, including Comms users, use the shared access evaluator; the
legacy path remains for unbound mailboxes. `ClpAnyUser` retains help semantics and never becomes
an anonymous open-posting flag. Open community posting uses normal categories with eligible
members joining under site policy.

| Actor | Read | Write | Staff actions |
| --- | --- | --- | --- |
| Anonymous | Published public category/topic and permitted public profile | Registration/token workflows only | None |
| Active site member | Public/site-member content; restricted content only with qualifying grant | Join/post/reply by category policy, trust and sanctions | None by membership alone |
| Category member | Category-visible history, except hidden/pending staff content | By `postingEnumId`, topic state and capabilities | None unless list role grants it |
| Help non-member | Own participation threads only; no other subjects/counts | Start own thread/reply within it if eligible | None |
| Category owner/moderator | Category moderation projection | As permitted, including explicit audited overrides | Category-scoped review/topic/member actions |
| Site moderator/owner | Authorized site moderation projection | As permitted | Site/category scope; private-conversation limits still apply |
| Conversation participant | Explicitly granted private conversation | While active and eligible | Report; no site-wide staff power |

The evaluator returns `canDiscover`, `canRead`, `canStartTopic`, `canReply`, `canEdit`,
`canUpload`, `canReact`, `canVote`, `canInvite`, `canFlag`, `canModerate` and source reasons for
staff diagnostics. Read permission never follows merely from an old notification, a CEP row,
a reply token, a URL or a search hit. A pending/rejected post is visible only to its author and
scoped reviewers; it contributes no public snippet/count. Unlisted means absent from discovery
but otherwise still access-controlled, not private. Hidden/deleted content and its revisions,
quotes, media and previews obey the same restrictions. Silence blocks contribution but preserves
reading; site suspension removes member-only access and writes, without claiming it can prevent
anonymous reading of an otherwise public page. Account-wide disable remains a framework operator
operation, separate from a site's sanction.

**Needs:** PASS-SITE, PASS-AUTH, PASS-ACCESS, PASS-API (§16).

## 6. Discovery screens

**Service notation for all form tables.** A prefix denotes the fully qualified service file;
`F.find#Topics` means `mantle.forum.ForumServices.find#Topics`. These are proposed unless marked
existing. §15 defines their contracts; PASS screen transitions invoke the local/remote facade,
not direct entity CRUD. Prefixes: **S** = `mantle.public.SiteServices`; **A** =
`org.moqui.public.AccountServices`; **F** = `mantle.forum.ForumServices`; **M** =
`mantle.forum.ModerationServices`; **D** = `mantle.forum.DeliveryServices`; **O** =
`mantle.forum.OperationServices`; **I** = `mantle.forum.IntegrationServices`; **X** =
`mantle.forum.ImportServices`. Existing prefixes: **L** =
`mantle.marketing.ContactListServices`; **C** = `mantle.party.CommunicationServices`;
**W** = `org.moqui.impl.WikiServices`. Calls listed as existing need the shared-rule extensions
before they can be used for PASS; they are never blanket public grants.

**Common screen behavior.** Every screen loads in the resolved site, checks capabilities at load
and action time, retains valid inputs after failure, distinguishes loading/empty/unavailable,
and renders read-only controls when applicable. Restricted IDs are not found, not a teaser of
private content. A session expiry offers sign-in and safe return; it does not discard a draft.
Destructive or audience-widening actions confirm the target, count and consequences. Lists use
§4 paging and empty text with an allowed next action. All public and personal screens work on
phones; staff lists use stacked rows, and complex bulk/import previews may scroll horizontally
without hiding critical controls. Staff actions do not infer permission from a hidden button.

### Topics

**Layout:** list with view tabs, compact category/tag filters, pinned announcements, topic rows
(title, unread position, category, tags, reply count, last activity) and New topic. No inbox pane.

| Form | Kind | Purpose | Highlighted fields | Widgets | Services | Derived from |
| --- | --- | --- | --- | --- | --- | --- |
| TopicFind | find | Select discovery view | view, category, tag, solved, date range | chips, view tabs | — | R2 discovery |
| TopicList | list | Browse allowed topics | title, category, tags, unread, replies, activity | ordinary links, unread marker | F.find#Topics | R2 topic list |

**Actions/navigation:** New topic → ComposeTopic; row → saved unread position in TopicDetail;
category/tag → corresponding view. Latest sorts by last visible activity; New means created after
membership/last dismiss boundary and not visited; Unread means tracked/watched topics with newer
visible posts. Top uses visible reactions/replies over the selected period, excluding self and
removed activity, with deterministic ties; its aggregate is not authority. Dismiss New/Unread
updates only the current user's selected view boundary with confirmation, never other readers.
**States/source/needs:** signed-out omits personal views; empty offers Categories/New topic as
allowed. Source R2/R3. Needs PASS-TOPIC, PASS-READ, PASS-RENDER, PASS-SEARCH.

### Categories

**Layout:** landing tree/cards with name, description, permitted child categories and recent
visible activity. Counts never include inaccessible descendants.

| Form | Kind | Purpose | Highlighted fields | Widgets | Services | Derived from |
| --- | --- | --- | --- | --- | --- | --- |
| CategoryTree | list | Browse site categories | name, parent, description, latest topic, counts | tree, category chips | F.find#Categories | R2 categories; R6 subforums |

**Actions/navigation:** open CategoryDetail; authorized settings link → CategorySettings.
Hidden categories are omitted; discoverable restricted categories show their configured joining
instructions without topic metadata. Empty means no published categories. Source R1/R2/R6.
**Needs:** PASS-SITE, PASS-ACCESS, PASS-RENDER.

### CategoryDetail

**Layout:** category header/rules, parent breadcrumb, membership/notification controls and Topics
list fixed to this category. Child-topic inclusion is an explicit filter, default off.

| Form | Kind | Purpose | Highlighted fields | Widgets | Services | Derived from |
| --- | --- | --- | --- | --- | --- | --- |
| CategoryHeader | display | Explain access and rules | name, description, rules, membership, capabilities | sanitized rules, status | F.get#Category | R1 mailbox header; R7 guidelines |
| CategoryMembership | dialog | Join/request/leave | requested action, optional request note | capability-specific buttons | F.join#Category, F.leave#Category; underlying L.join#ContactList, L.leave#ContactList | R1 |
| CategoryPreferences | single | Set personal delivery | notification level, email mode, internal delivery when eligible | scoped preference choices | D.set#Preferences; underlying L.set#ContactListPartyDelivery | R1/R3 |
| CategoryTopics | list | Read category discussion | same as TopicList | same as Topics | F.find#Topics | Topics with fixed category |

**Actions/states:** pending join shows status and no private posts; leave confirms access and
notifications affected. Paid access shows entitlement status/link, not a misleading Join button.
Archived categories are readable under access rules and reject new posts/members. Settings is
scoped to owners. Source R1/R2/R7. **Needs:** PASS-ACCESS, PASS-TOPIC, PASS-DELIVERY.

### Tags

**Layout:** tag list, usage counts within allowed topics and tagged topic results. Tag names are
site-scoped; category-specific tags do not reveal restricted categories.

| Form | Kind | Purpose | Highlighted fields | Widgets | Services | Derived from |
| --- | --- | --- | --- | --- | --- | --- |
| TagFind | find | Find tags | text, category | search | — | R2/R7 |
| TagList | list | Browse tags | name, description, visible topic count | chips | F.find#Tags | R2 tags |
| TaggedTopics | list | Read matching topics | TopicList fields | same as Topics | F.find#Topics | Topics with fixed tag |

**Actions/states:** open a tag/TopicDetail; permitted staff manage names/merge aliases through
CategorySettings. No hidden usage counts. Source R2/R7. **Needs:** PASS-TOPIC, PASS-SEARCH.

### Search

**Layout:** search input, filters, results with highlighted sanitized snippets and ordinary links.

| Form | Kind | Purpose | Highlighted fields | Widgets | Services | Derived from |
| --- | --- | --- | --- | --- | --- | --- |
| SearchFind | find | Restrict query | text, category, tag, author handle, date, solved, title-only | site member lookup | — | R2 search; R6 forum search |
| SearchResults | list | Find permitted content | title, snippet, author, category, date | escaped highlighting | F.search#Forum | existing UniversalSearchServices pattern |

**Actions/states:** result opens exact post; queries are bounded, rate-limited and scoped on the
server. Private conversations are a separate opt-in search scope for participants, never mixed
into anonymous search or staff-wide search. If the index is unavailable, show unavailable with
retry and category browsing; no unfiltered fallback. Source R1/R2. **Needs:** PASS-SEARCH.

### Guidelines

**Layout:** published article, site title and About/Guidelines navigation. The configured page
must have a published version and an explicit site binding.

| Form | Kind | Purpose | Highlighted fields | Widgets | Services | Derived from |
| --- | --- | --- | --- | --- | --- | --- |
| PublishedSitePage | display | Read approved site content | title, published body, updated date | m-html-view | S.get#SitePage; underlying W.get#PublishedWikiPageText | framework wiki; R7 guidelines |

**Actions/states:** sign in/join links; absent/unpublished page is not found. Staff edit through
SiteDetail's version-aware form, not a public raw wiki route. Source R7/R10.
**Needs:** PASS-SITE, PASS-PUBLISH, PASS-RENDER.

## 7. Topics and composition

### TopicDetail

**Layout:** title/category/tags, chronological stream, accepted-answer summary, author cards,
reply context, right timeline and docked composer. The html fallback is the same projection in
bounded chronological pages. Phone layout uses full-width posts and a compact jump control.

| Form | Kind | Purpose | Highlighted fields | Widgets | Services | Derived from |
| --- | --- | --- | --- | --- | --- | --- |
| TopicHeader | display | Explain topic state | title, category, tags, solved, closed, pinned, timer | status chips | F.get#Topic | R2/R5 |
| PostStream | component | Read a bounded post window | author, date, body, attachments, reply context, edits, reactions | m-html-view, timeline, post anchors | F.get#Posts, F.mark#Read | R2/R3 |
| TopicPreferences | single | Track topic and delivery | watch level, email override | compact selector | D.set#Preferences | R3 |
| PostActions | component | React/save/report/solve | reaction key, bookmark note/reminder, report reason/note, accepted answer | action menu, dialogs | F.set#Reaction, F.store#Bookmark, M.flag#Post, F.accept#Answer | R2/R4/R5 |
| TopicTools | dialog | Moderate topic/selection | action, target category/root, selected post IDs, reason, timer, expected revision | selection, impact preview | M.preview#TopicAction, M.apply#TopicAction | R4/R6 |
| Poll | component | Vote and inspect results | question, choices, own selection, totals | radio/checkbox, accessible bars | F.vote#Poll, F.get#Poll | R5/R6 |
| TopicLinks | list | Inspect related public content or authorized staff records | source type, safe title, permitted destination | capability-filtered cards | I.get#TopicLinks | existing Chatter record links; R8/R9 |
| TopicHandoff | dialog | Link/escalate or create an article draft | action, target type/ID, title, selected post IDs, queue ID when creating a case, reason | selected-text/audience preview | I.create#CaseFromTopic, I.link#Discussion, I.draft#ArticleFromTopic | Customer Service case/article workflows; §13 |
| ReplyComposer | component | Reply with context | ComposeTopic fields | shared composer | F.store#Draft, F.publish#Post | ComposeTopic |

**Actions/navigation:** Reply/quote dock ComposeTopic; edit opens the same composer; author opens
MemberDetail; revision opens PostHistory. Permalinks resolve IDs after current authorization.
S1 includes replies, edits, attachments, reports, closure and basic title/category management;
S2 adds reactions, polls, bookmarks, solved/wiki mode and advanced topic tools. S3 adds related-record
links and case escalation; article-draft handoff appears only when a publication/editorial
adapter is enabled. Public users never see private case identifiers or staff-only links.

**Rules:** topic ordinals never renumber on deletion. They locate windows, not public counts.
A reply's parent must be a visible post in the same root. Inline reply previews and copied quotes
carry source IDs; rendering suppresses derived private/hidden excerpts when source access changes.
External pasted text is ordinary authored content, subject to moderation. A deleted post leaves
a content-free tombstone where needed for reply structure; counters count visible posts only.
Accepted answer is one visible reply in this topic, chosen by its author or moderator when Q&A
is enabled. Removal/hiding of that reply clears the public solved state with an audit entry.
Accepting never closes; `C.close#ListThread` continues to set root `CeResolved` and reject replies.

Authors may edit their ordinary posts for 24 hours by default; moderators may edit with reason.
Authors may soft-delete within that window only when no later reply depends on the post; otherwise
request moderation. A moderator may enable wiki mode; active basic-or-higher members with category
write access may propose direct versioned edits to that wiki post. All edits retain author,
editor, revision and reason; concurrent updates conflict. Historical text with removed private
material remains staff-restricted. Polls support single/multiple selection, closing time, hidden
or visible voter identities (anonymous totals default), optional vote changes and results after
vote/close. Choices lock after the first vote; structural change requires closing/replacing the
poll, preserving the original audit. One ballot per eligible party, updated transactionally.

**States/source/needs:** hidden/pending shows only an authorized explanation; closed/archived
shows read-only composer state; lost access clears cached body/draft attachments from the view.
Source R1–R9 and Customer Service. Needs PASS-TOPIC, PASS-ACCESS, PASS-READ, PASS-MOD,
PASS-MEDIA, PASS-RENDER, PASS-INTEGRATE.

### ComposeTopic

**Layout:** shared editor as a dock on desktop, full-page route on phones; mode is new topic,
reply or edit. Rich text uses the framework editor and sanitized canonical HTML; store source
format and source text for revision/import, but expose only sanitized rendered content.

| Form | Kind | Purpose | Highlighted fields | Widgets | Services | Derived from |
| --- | --- | --- | --- | --- | --- | --- |
| Compose | single | Write a topic/post | title for root, category, tags, body, parent, edit reason | framework rich text, site-scoped mentions | F.store#Draft, F.publish#Post, F.update#Post | R1 Compose; R2 composer |
| Attachments | component | Stage files | file, caption/alt text, removal | upload progress, image preview | F.stage#Attachment, F.remove#StagedAttachment | R1 attachments; R6 |
| PollEditor | dialog | Add a poll | question, options, multi-select maximum, closesAt, results policy, reveal voters, allow change | editable choices | F.store#Draft | R5/R6 |
| Preview | display | Inspect rendered draft | rendered body, links, media, validation | m-html-view | F.preview#Post | R2/R6 |

**Actions/navigation:** Publish/Save edit; Save draft/Discard/Cancel secondary. Publish is
idempotent and returns published or pending review, never sends pending content to subscribers.
Changing category rechecks access/uploads/mentions and warns of audience changes. Mention search
returns only eligible site profiles; a mention does not grant access. Unavailable backend retains
browser recovery text and operation ID; drafts autosave at the backend after idle input, with
revision conflict UI across tabs. Closing the composer never silently discards unsaved content.

**Attachments:** uploads are staged for actor/site, size/type limited and scanned through the
configured scanner; finalize only on a permitted post. Executable HTML/SVG is not served inline;
image/media derivatives retain the parent post's access. Authenticated downloads are checked at
request time; public URLs are valid only for currently published public content. Link previews
use a restricted fetcher with network/size/time limits and no credentials; private links produce
no remote preview. Abandoned staged uploads expire after seven days, with a job that logs each
failed cleanup and continues. Source R1/R2/R5/R6. **Needs:** PASS-TOPIC, PASS-MEDIA, PASS-API.

### PostHistory

**Layout:** revision list plus two-version compare; reused framework diff renderer, not a new
browser diff implementation.

| Form | Kind | Purpose | Highlighted fields | Widgets | Services | Derived from |
| --- | --- | --- | --- | --- | --- | --- |
| Revisions | list | Select history | revision, editor, date, reason | revision selectors | F.get#PostHistory | R2 post_revision |
| RevisionDiff | display | Compare text | from/to revision, diff | framework diff | F.compare#PostRevisions | Commons history/R10 |
| RestoreRevision | dialog | Restore permitted content | target revision, reason, expected revision | confirmation | F.restore#PostRevision | Commons restore/R10 |

**Actions/states:** restore creates a new revision and reruns sanitization/moderation; never
rewrites history. Public history excludes revisions redacted by staff and any formerly wider
private audience. Readers without history permission get current content only. Source R2/R10.
**Needs:** PASS-TOPIC, PASS-MOD.

## 8. Accounts and personal screens

### Login

**Context passed:** framework login/recovery flow with site branding, registered callback origin
and allow-listed local return path; adapter authenticates with the authority in remote mode.
No new password store, account-creation bypass or broad BOSS login redirect.

| Form | Kind | Purpose | Highlighted fields | Widgets | Services | Derived from |
| --- | --- | --- | --- | --- | --- | --- |
| SignIn | single | Authenticate | username/email, password, return path | framework login/SSO choices | A.start#Session | framework Login and sso |
| Recovery | single | Request recovery | verified email | framework recovery | A.request#Recovery | framework reset-password flow |

**Actions/states:** sign in → SecondFactor when required, then safe return; recover → generic
acknowledgement; register only when site policy permits. Network failure is distinct from invalid
credentials but does not expose account existence. **Needs:** PASS-AUTH, PASS-API.

### SecondFactor

**Context passed:** the framework factor challenge belonging to this authority/session, with
site return path. Challenge identity is opaque and expires; remote flow never skips second factor.

| Form | Kind | Purpose | Highlighted fields | Widgets | Services | Derived from |
| --- | --- | --- | --- | --- | --- | --- |
| FactorChallenge | single | Verify selected factor | challenge, factor response | existing factor controls | A.complete#Session | framework SecondFactor |

**Actions/states:** Verify/Use another enrolled method; expired challenge restarts Login. Existing
framework factor policy and recovery apply. **Needs:** PASS-AUTH.

### Registration

**Layout:** wizard: identity → verification → site/profile choices → pending approval or joined.
An already authenticated account skips identity creation and verifies only missing requirements.

| Form | Kind | Purpose | Highlighted fields | Widgets | Services | Derived from |
| --- | --- | --- | --- | --- | --- | --- |
| RegisterIdentity | wizard step | Request account/verification | email, password when local auth, site | framework password controls | A.begin#Registration | framework account flow; R3/R9 |
| VerifyAddress | wizard step | Redeem verification | opaque token or code | code entry | A.verify#Registration | R3 invitations/verification |
| JoinSite | wizard step | Request site membership | handle, display name, locale, guidelines acknowledgement/version, optional organization invitation | profile fields | S.join#Site | R3/R7 |
| JoinStatus | display | Show outcome | pending/active/rejected, safe reason, next step | status | S.get#Membership | R4 user approval |

**Actions/states:** Send verification/Resend with cooldown; submit site choices; closed sites show
invitation instructions. Accepting guidelines is recorded separately from optional email consent.
Handle uniqueness is site-scoped and checked server-side. Pending members cannot post. Source
R3/R7/R9. **Needs:** PASS-AUTH, PASS-SITE, PASS-ACCESS.

### Invitation

**Layout:** task showing site, inviter's public name, intended scope and expiry, without exposing
private category content before redemption.

| Form | Kind | Purpose | Highlighted fields | Widgets | Services | Derived from |
| --- | --- | --- | --- | --- | --- | --- |
| RedeemInvitation | single | Accept membership invitation | token, authenticated matching identity, guidelines acknowledgement | confirmation | S.inspect#Invitation, S.redeem#Invitation | R3 invite |

**Actions/states:** sign in/register then redeem once; mismatch, expired and revoked tokens offer
safe instructions without account lookup. Owner/moderator invitations require reauthentication
of the grantor at issuance and explicit scope confirmation. **Needs:** PASS-AUTH, PASS-SITE.

### MemberDetail

**Layout:** public profile header and allowed public contributions; no CRM/employee 360 fields.

| Form | Kind | Purpose | Highlighted fields | Widgets | Services | Derived from |
| --- | --- | --- | --- | --- | --- | --- |
| PublicProfile | display | Read community identity | handle, display name, avatar, bio, joined date | public card | S.get#Profile | R2/R7 profiles |
| MemberActivity | list | Browse visible contributions | topic, excerpt, date | ordinary links | F.find#Topics | R2 profile activity |
| MemberActions | dialog | Manage interaction | mute/block action, optional duration | confirmation | F.set#MemberPreference | R6 friend/foe; R2 mute |

**Actions/states:** Message when enabled/eligible, mute/block, own profile → AccountSettings.
Profile discoverability defaults to site members; authors' minimal attribution remains visible
on their public posts. Blocking stops private invitations/mentions/notifications, not public
moderation or the existence of public posts. **Needs:** PASS-SITE, PASS-ACCESS, PASS-PRIVATE.

### AccountSettings

**Layout:** tabs Profile, Security, Notifications/email, Memberships, Privacy. Security uses the
framework's account/password/second-factor services through the authority adapter.

| Form | Kind | Purpose | Highlighted fields | Widgets | Services | Derived from |
| --- | --- | --- | --- | --- | --- | --- |
| ProfileSettings | single | Edit site profile | handle, name, avatar, bio, locale, time zone, discoverability | media upload | S.store#Profile | R2/R7 profiles |
| SecuritySettings | component | Manage credentials | password/factors/sessions/verified address | framework account controls | A.manage#Account | framework account |
| DeliverySettings | single | Set defaults/overrides | notification level, email mode, digest frequency, own posts, ignored users | grouped preferences | D.get#Preferences, D.set#Preferences | R3/R6 |
| MembershipSettings | list | Inspect/join/leave | site/category, source, state, entitlement period | scoped actions | S.get#Membership, S.leave#Site, F.leave#Category | R1 memberships |
| PrivacyRequest | dialog | Export or request erasure | request type, scope, confirmation | confirmation | O.request#PersonalDataAction | R2 account privacy |

**Actions/states:** save each tab independently with revision check; leave confirms lost access
without deleting authored history. Erasure is a reviewed job preserving referential integrity and
required transaction/audit records; content disposition is explicit, never a cascading Party
delete. Public anonymity replaces attribution when approved. S2 adds advanced preferences.
**Needs:** PASS-AUTH, PASS-SITE, PASS-DELIVERY, PASS-OPS.

### Notifications

**Layout:** personal list with unread/type filters and read-all action for the current site.

| Form | Kind | Purpose | Highlighted fields | Widgets | Services | Derived from |
| --- | --- | --- | --- | --- | --- | --- |
| NoticeList | list | Read permitted notices | type, actor, safe excerpt, target, date, read state | notification links | D.find#Notifications | framework notifications/R3 |
| NoticeState | list, bulk | Mark notices read | selected notification IDs | selection | D.mark#Notifications | framework notifications |

**Actions/states:** opening resolves access again; revoked/removed target shows a generic notice
or disappears. Marking notification read does not mark unseen posts read. **Needs:** PASS-READ,
PASS-DELIVERY.

### Bookmarks

**Layout:** personal list by saved/reminder date with notes and filters.

| Form | Kind | Purpose | Highlighted fields | Widgets | Services | Derived from |
| --- | --- | --- | --- | --- | --- | --- |
| BookmarkList | list | Return to saved items | title, post, note, savedAt, remindAt | ordinary links | F.find#Bookmarks | R2 bookmark |
| BookmarkEdit | dialog | Edit/remove reminder | target, note, remindAt | date-time | F.store#Bookmark, F.remove#Bookmark | R2 bookmark |

**Actions/states:** open target; remove own bookmark; inaccessible targets lose cached title/body.
Bookmarks do not reuse Inbox flags because reminders and post targeting have distinct semantics.
**Needs:** PASS-TOPIC, PASS-DELIVERY.

### Drafts

**Layout:** personal list of draft topics, replies and edits, newest first.

| Form | Kind | Purpose | Highlighted fields | Widgets | Services | Derived from |
| --- | --- | --- | --- | --- | --- | --- |
| DraftList | list | Resume saved work | mode, title, target, updatedAt, conflict | draft status | F.find#Drafts | R2/R6 drafts |
| DiscardDraft | dialog | Remove draft and staged media | draft ID, expected revision | confirmation | F.discard#Draft | R6 drafts |

**Actions/states:** open ComposeTopic; loss of target permission disables publication and offers
copying one's own draft text without fetching private target excerpts. Autosave failures remain
visible; an empty list links to New topic. **Needs:** PASS-TOPIC, PASS-MEDIA.

### Unsubscribe

**Layout:** site-branded token task; GET shows choices only. A scoped one-click POST may disable
the identified delivery without login. Broader account changes require authentication.

| Form | Kind | Purpose | Highlighted fields | Widgets | Services | Derived from |
| --- | --- | --- | --- | --- | --- | --- |
| DeliveryOptOut | single | Stop selected forum email | token, topic/category/site delivery scope | explicit choices | D.inspect#OptOut, D.apply#OptOut | existing Comms Unsubscribe; R3 |
| DeliveryResult | display | Confirm resulting preference | changed scope, access retained, preferences link | status | D.get#Preferences with token-limited projection | Comms Unsubscribe |

**Actions/states:** idempotent confirmation; expired/invalid token reveals no profile. Forum opt-out
changes delivery only, unlike existing consent flows that may change `ContactListParty` status.
It does not cancel membership, organization eligibility or a paid subscription. Marketing and
Publishing opt-outs are separately named scopes. **Needs:** PASS-DELIVERY, PASS-AUTH.

## 9. Private conversations

Private conversations reuse `CommunicationEvent` roots/posts, the stream and composer. A
`ForumTopic` of kind private has no category list, and `ForumParticipant` is its authoritative
participant set; public users receive thread markers, not per-message recipient rows. Internal
participants receive their existing CEP state. Extend shared communication access/list services
so public participation never depends on the presence of a CEP row.

Named recipients are active eligible site members. Selecting a configured organization/group
expands to a displayed participant snapshot at send time; subsequent group changes do not add
readers silently. Adding someone grants the retained conversation history and requires explicit
confirmation by the conversation owner. Removal or leaving revokes all future access, including
old attachments; archive is merely a personal list preference. Former participants' authored
posts remain with normal attribution policy. Site suspension removes private access too.

New conversations require basic trust by default and can be disabled per site. Disabling stops
new member conversations/invitations but allows existing participants to read; owner policy may
also stop replies. Staff support contact remains available through a configured help category.
Blocking prevents new private contact and recipient additions. Staff cannot browse all private
messages: a report grants a scoped reviewer access to the reported post and the minimum adjacent
context (one visible post before/after); any expanded context requires a recorded escalation and
site-owner approval. Every such access is audited. No report permits cross-site access.

### Conversations

**Layout:** personal thread list with inbox/archived filters, unread counts and New message.

| Form | Kind | Purpose | Highlighted fields | Widgets | Services | Derived from |
| --- | --- | --- | --- | --- | --- | --- |
| ConversationList | list | Find own conversations | subject, participant names, last activity, unread | thread links | F.find#Conversations | R5 private topics |
| NewConversation | dialog | Start private discussion | recipients, subject, body | scoped recipient lookup, shared editor | F.create#Conversation | R5 private topics |

**Actions/states:** open ConversationDetail; disabled site omits New message and explains policy.
Recipient errors do not enumerate hidden members. **Needs:** PASS-PRIVATE, PASS-READ, PASS-TOPIC.

### ConversationDetail

**Layout:** TopicDetail stream/composer with participant header; no public tags, category discovery,
sharing, accepted answers or public SEO. Reads send private/no-store cache headers.

| Form | Kind | Purpose | Highlighted fields | Widgets | Services | Derived from |
| --- | --- | --- | --- | --- | --- | --- |
| ConversationStream | component | Read/reply | TopicDetail fields | same stream/composer | F.get#Topic, F.get#Posts, F.publish#Post, F.mark#Read | TopicDetail |
| Participants | list, editable rows | Manage explicit access | party, addedAt, active, inviter | scope confirmation | F.update#Participants | R5 |
| ConversationActions | dialog | Archive/leave/report | action, target post, reason | confirmation | F.set#ConversationState, M.flag#Post | R5/R6 |

**Actions/states:** leave confirms loss of history access; removing the final owner requires a
replacement or closure. No staff takeover through ordinary participant APIs. Source R5/R6.
**Needs:** PASS-PRIVATE, PASS-ACCESS, PASS-MOD.

## 10. Moderation

### 10.1 Shared behavior and initial policy

One Mantle review queue contains pending accounts, first/held posts, flags and classifier results.
Item states are pending → claimed → approved/rejected/dismissed, with reopening explicitly audited.
Claims expire after 30 minutes of inactivity; claiming does not grant permissions. Decision
transactions check expected revision, capability and current content revision. Flag reports keep
their original evidence snapshot under staff access; changed posts require re-review. Authors see
a safe outcome/reason and may appeal by creating a linked review item, not by reopening decisions.

Default controls, editable and versioned by site owners:

| Control | Initial value/behavior |
| --- | --- |
| Registration | Closed until an owner enables invitations/open signup; email verification always required for local registration |
| Trust | New → Basic after 5 topics, 20 visible posts and 10 measured reading minutes across 2 days; Member after 15 visiting days, 20 topics, 100 posts read and 60 minutes; Regular after 50 visiting days in 100 days, 100 topics, 500 posts read and 10 approved contributions; no confirmed abuse in the last 30 days for promotion |
| Trust effects | New: 3 topics/10 replies per day, 2 links, 1 image and 2 mentions per post; Basic: 10/50, 10 links/images and 5 mentions; Member/Regular: 20/100, 20 links/images and 10 mentions. Regular may propose taxonomy/wiki improvements, never acquires moderation merely from trust. Owner can lock a level with reason. |
| Rate control | One post per 10 seconds per actor, separate site/IP abuse limits; authenticated reads default 120/minute, anonymous 60/minute per client IP with deployment overrides for proxies; mail and web share contribution budgets |
| Approval | First 2 contributions from a new member queued; trusted invitations may bypass by explicit owner policy; upload scan failures remain held |
| Flag hide | 3 distinct Basic-or-higher flaggers may temporarily hide a post pending review; author/self/blocked duplicate flags add no count; flags from New still enter review. Site staff can restore with reason. |
| Automated classification | Optional and off by default; classify into review, with model/version/reason and no automatic bans or permanent deletion. Unavailable classifier leaves manual/rule moderation functioning. |
| Watched words | Per-rule block, approval, flag or display-censor action; original evidence staff-only; changed text is rechecked |
| Editing/deletion | Author window 24 hours; dependent-reply restriction and wiki behavior as §7; staff reasons required |
| Topic policy | Default open, no slow mode; selected slow mode imposes per-user minimum reply interval; archive/read restrictions still dominate timers |

Reading activity is bounded server-validated telemetry, not arbitrary client counters. Trust
recomputation is a scheduled per-site job; log a bad member record and continue. Higher trust
never bypasses category access, sanctions, upload limits or paid eligibility. Site owners may
choose less permissive settings; thresholds are explicit product defaults, not inherited
Discourse numbers or a claim that activity alone establishes identity.

Move/split/merge uses an impact preview listing destination audience, selected posts, descendant
replies, attachments, accepted answer, linked records and notification consequences. Reparent
selected reply subtrees together; reject a split that would leave a parent in another thread.
Preserve event IDs, allocate destination ordinals, retain old permalink aliases, and invalidate
read/index/cache projections. Watchers are not copied into an inaccessible destination. Internal
CEP state remains attached to stable event IDs; public markers for moved posts are conservatively
initialized so unseen destination content is not marked read. Private→public conversion is not
a bulk tool; create a redacted public draft through an explicit author/staff workflow instead.
Each root change is atomic; a bulk action reports successes/failures per independent root.

### ReviewQueue

**Layout:** list with type/category/state filters, age/priority, claim and bulk decisions.

| Form | Kind | Purpose | Highlighted fields | Widgets | Services | Derived from |
| --- | --- | --- | --- | --- | --- | --- |
| ReviewFind | find | Select work | category, type, state, assignee, age | filters | — | R4 reviewables |
| Reviews | list, bulk | Triage review work | type, target, reason, age, claimant, revision | selection, action counts | M.find#Reviews, M.claim#Review, M.decide#Reviews | R4/R6 queue |

**Actions/states:** claim/open ReviewDetail; bulk allowed only for a homogeneous action, with
per-item results. S1 handles first posts/accounts/flags; S2 adds classifiers and advanced rules.
**Needs:** PASS-MOD, PASS-ACCESS.

### ReviewDetail

**Layout:** evidence/current content side by side, report history, staff notes and decision bar.

| Form | Kind | Purpose | Highlighted fields | Widgets | Services | Derived from |
| --- | --- | --- | --- | --- | --- | --- |
| ReviewEvidence | display | Inspect authorized evidence | reported/current revision, reason, limited context | diff, sanitized content | M.get#Review | R4 |
| ReviewNotes | list + single | Coordinate privately | note text, author, date | plain staff notes | M.add#ReviewNote | R4/R6 |
| ReviewDecision | single | Resolve or escalate | decision, reason, optional sanction/duration, expected revision | explicit action choices | M.decide#Review | R4/R6 |

**Actions/states:** approve/reject, agree/dismiss flag, restore, refer to MemberModeration or
request private-context escalation. Stale evidence requires refresh; decisions never operate on
a changed revision silently. Notes remain staff-only. **Needs:** PASS-MOD, PASS-TOPIC.

### MemberModeration

**Layout:** site-local conduct summary, recent permitted posts/reports, sanctions and staff notes.

| Form | Kind | Purpose | Highlighted fields | Widgets | Services | Derived from |
| --- | --- | --- | --- | --- | --- | --- |
| MemberConduct | display | Inspect relevant history | trust, membership, confirmed flags, sanctions | timeline | M.get#Member | R4 user history/notes |
| Sanction | single | Warn/silence/suspend/restore | scope, action, reason, startsAt, endsAt, revision | date/time, impact preview | M.set#Sanction | R4/R6 warnings |
| StaffNote | single | Record private context | note, related review ID | plain text | M.add#MemberNote | R4 user-notes |
| TrustOverride | single | Set/clear an owner override | level, locked, reason, revision | owner-only choices | M.set#Trust | R4 trust |

**Actions/states:** category moderators can warn/silence within their categories; site suspension
requires site moderator/owner. Account-wide disable is an operator handoff, not this form.
Temporary sanctions expire through shared rules even if the housekeeping job is late.
**Needs:** PASS-MOD, PASS-ACCESS.

### ModerationLog

**Layout:** immutable action list with site/category/member/action/time filters and export.

| Form | Kind | Purpose | Highlighted fields | Widgets | Services | Derived from |
| --- | --- | --- | --- | --- | --- | --- |
| AuditFind | find | Locate actions | actor, target, category, action, date | filters | — | R4/R6 audit |
| AuditList | list | Inspect history | actor, scope, reason, before/after revision, outcome, correlation ID | safe detail links | M.find#Actions | R4 user_history |

**Actions/states:** open permitted source; exported projection has the same scope, with no bodies
or private notes unless separately authorized. No edit/delete action. **Needs:** PASS-MOD, PASS-OPS.

## 11. Administration

### Sites

**Layout:** list of sites the actor owns or operates, with readiness and enabled apps. Site
creation is an operator action; ordinary owners cannot enumerate unrelated sites.

| Form | Kind | Purpose | Highlighted fields | Widgets | Services | Derived from |
| --- | --- | --- | --- | --- | --- | --- |
| SiteList | list | Select a managed site | name, primary host, apps, state, readiness | status links | S.find#Sites | R9 multi-website |
| CreateSite | dialog | Provision a disabled site | name, primary hostname, locale, time zone, owner party | operator-scoped owner lookup | S.create#Site | R9 website setup |

**Actions/states:** create → SiteDetail with publication off; list empty suggests operator
provisioning. Host ownership/bindings are checked before activation. **Needs:** PASS-SITE, PASS-API.

### SiteDetail

**Layout:** tabs General/Brand, Domains & mounts, Membership, Pages, Owners, Readiness.

| Form | Kind | Purpose | Highlighted fields | Widgets | Services | Derived from |
| --- | --- | --- | --- | --- | --- | --- |
| SiteIdentity | single | Configure brand | name, logo, colors, locale, time zone, landing, publication state | constrained theme controls | S.update#Site | R9 website |
| HostsAndApps | list, editable rows | Bind routes | hostname, canonical flag, app, mount, target store/publication, enabled | collision validation | S.store#Mounts | R8/R9 website binding |
| SiteJoinPolicy | single | Configure eligibility | registration mode, approval, verified domains, organization mapping, guidelines page | scoped organization lookup | S.update#MembershipPolicy | R3/R9 |
| SitePages | single | Publish guidelines/about | page role, wikiPageId, selected version, expected revision | version picker/preview | S.publish#SitePage; underlying W.set#PublishedVersion | R10 published wiki |
| SiteOwners | list, editable rows | Delegate site roles | site party, role, active dates | reauthentication for promotion | S.set#SiteRole | R9 website users |
| Readiness | display | Inspect activation blockers | binding/auth/mail/search/media/API capability checks | named diagnostics | S.check#Readiness | new; these are all displayed fields |

**Actions/states:** publish/disable confirms audience/cache impact; changes are revision checked.
Operator-only hostname/backend binding changes require verified configuration; site owners cannot
edit deployment secrets. Publishing a page checks selected revision and prevents exposing a
private wiki space by simply changing its theme. **Needs:** PASS-SITE, PASS-AUTH, PASS-PUBLISH.

### CategorySettings

**Layout:** category tree plus selected category forms. Category roles can edit their own subtree
within inherited constraints; only site owners can attach existing mailboxes or publish them.

| Form | Kind | Purpose | Highlighted fields | Widgets | Services | Derived from |
| --- | --- | --- | --- | --- | --- | --- |
| CategoryAdminTree | list | Select/order categories | parent, name, sequence, state | framework tree | F.find#Categories with admin projection | R1/R6 |
| CategoryConfig | single | Create/update a category | name, description/rules, parent, order, slug, discussion/Q&A mode, archive state | parent selector, rich text | F.store#Category; underlying L.create#ContactList, L.update#ContactList | R1/R7 |
| CategoryAccess | single | Publish and constrain access | publication flag, visibility, posting policy, join approval, qualifying sources, default delivery | audience preview | F.preview#CategoryAccess, F.set#CategoryAccess | R1/R6 permissions |
| BindMailbox | dialog | Adopt an existing mailbox | contactListId, proposed parent, visibility, confirmation | impact preview | F.bind#Mailbox | new; these are the full input fields |
| TagSettings | list, editable rows | Manage taxonomy | tag name, description, allowed categories, alias/merge target | chips | F.store#Tag, F.merge#Tag | R2/R7 |

**Actions/states:** create/archive/unarchive, preview/reparent, bind/publish. Never delete a list
with posts through this UI. Changing visibility identifies existing public content/URLs and
requires confirmation; invalidation takes effect before success. Archive preserves access but
blocks new posts/members. Source R1/R6/R7. **Needs:** PASS-SITE, PASS-ACCESS, PASS-TOPIC.

### Members

**Layout:** site/category selector fixed to the actor's scope, active/pending/invited filters,
membership rows and invitation/member dialogs.

| Form | Kind | Purpose | Highlighted fields | Widgets | Services | Derived from |
| --- | --- | --- | --- | --- | --- | --- |
| MemberList | list, bulk | Inspect and approve membership | handle, role, source, state, dates | selected-row actions | S.find#Members, F.find#CategoryMembers | R1 mailbox members |
| MemberChange | dialog | Grant/end membership or role | target, scope, role, from/thru dates, reason, revision | scope confirmation | S.set#Membership, F.set#CategoryMember; underlying L.add#ContactListParty, L.remove#ContactListParty, L.decline#ContactListParty | R1 |
| InviteMember | dialog | Invite verified recipients | email, site/category scopes, expiry, optional organization, role | recipient entry, scope summary | S.create#Invitation, S.revoke#Invitation | R3 |

**Actions/states:** approve/decline pending members, revoke invite, end manual grant. Automatic
organization/subscription grants display their source and cannot be edited as if manually owned.
Bulk results are per member; last-owner and audience rules still apply. **Needs:** PASS-SITE,
PASS-ACCESS, PASS-AUTH.

### ForumPolicies

**Layout:** settings tabs Posting, Trust, Moderation, Private messages, Media, Retention. Settings
are versioned and validation shows effects before activation.

| Form | Kind | Purpose | Highlighted fields | Widgets | Services | Derived from |
| --- | --- | --- | --- | --- | --- | --- |
| PostingPolicy | single | Set contribution controls | approval counts, rate/size limits, edit window, default topic mode, slow mode defaults | numeric limits | M.store#Policy | R4/R6/R7 |
| TrustPolicy | single | Configure bounded trust rules | level thresholds, allowed actions, promotion window, abuse exclusion | capability matrix | M.store#Policy | R4 trust |
| ModerationRules | list, editable rows | Match content/risk | rule type, value/pattern, scope, action, enabled, priority | tested pattern preview | M.test#Rule, M.store#Rule | R4 watched words/screening |
| PrivatePolicy | single | Set private conversation policy | enabled, minimum trust, recipient limit, existing-reply policy, support category | scoped category selector | M.store#Policy | R5 |
| MediaPolicy | single | Set safe upload/preview limits | allowed types, bytes, files/post, scan requirement, preview enabled | deployment capability status | M.store#Policy | R6 attachments |
| RetentionPolicy | single | Configure reviewed retention jobs | content class, retention period, anonymize/delete mode, preview-only default | impact estimate | O.store#RetentionPolicy | R6 prune, adapted to explicit review |

**Actions/states:** Save draft policy/Test/Activate; activate requires expected revision and an
audit reason. Pattern tests have time/size limits. Security floors such as credential handling,
authorization and sanitization cannot be disabled here. AI settings reference an operator-approved
model profile and require explicit enablement; no provider secret form. **Needs:** PASS-MOD,
PASS-MEDIA, PASS-OPS.

### MailDelivery

**Layout:** routes, outbound identity, templates/preferences, delivery log, and bounded test.
S1 exposes outbound configuration; S2 adds list addresses and inbound diagnostics.

| Form | Kind | Purpose | Highlighted fields | Widgets | Services | Derived from |
| --- | --- | --- | --- | --- | --- | --- |
| MailRoutes | list, editable rows | Bind inbound destinations | verified address, category, enabled, allowed sender policy | capability status | D.store#Route | R1 mailbox email; framework inbound |
| OutboundDefaults | single | Configure site email | sender identity, reply domain, template IDs, digest schedule, default email mode | registered identity/template selectors | D.store#MailSettings | existing ContactList sends |
| DeliveryLog | list | Inspect individual outcomes | target ID, masked recipient, state, attempt time, safe error | status filters | D.find#Deliveries | ContactListCommStatus/R3 |
| MailTest | single | Send/process a bounded test | route, own verified destination, sample text | explicit send action | D.test#Route | framework mail setup |

**Actions/states:** test/retry a failed delivery after current access checks; reject duplicate
route addresses and unverified domains. Operators manage SMTP/OAuth credentials outside this
screen. Delivery failures name the item and do not roll back a published post. **Needs:**
PASS-DELIVERY, PASS-API, PASS-OPS.

### Operations

**Layout:** operational status, job runs and recovery forms. S1 includes health and failed delivery
visibility; S3 adds full rebuild/export/retention controls.

| Form | Kind | Purpose | Highlighted fields | Widgets | Services | Derived from |
| --- | --- | --- | --- | --- | --- | --- |
| Health | display | Inspect readiness/lag | backend, search lag, outbox age, scan failures, job failures | status cards | O.get#Health | framework ServiceJob pattern |
| JobRuns | list | Inspect independent work | job, item, state, progress, counts, last error, correlation ID | bounded log view | O.find#Runs | framework jobs |
| RecoveryJob | single | Run a scoped operation | operation, category/site scope, dryRun, source revision, reason | preview/confirm | O.preview#Operation, O.start#Operation, O.retry#Items | new; these are the full input fields |

**Actions/states:** operations are rebuild index/derived counts, retry deliveries, export,
anonymize approved requests, or apply retention. Dry-run is the default for retention; automatic
hard pruning is off. Jobs checkpoint, support cancellation between items and report partial
success. One failed item does not abort peers; security failures never broaden scope. No raw
SQL, arbitrary service runner or secret-bearing logs. **Needs:** PASS-OPS, PASS-SEARCH.

### Migration

**Layout:** wizard: source/preflight → mappings → dry-run → import → reconciliation → cutover.
All data-transfer and reconciliation behavior is specified in §18.

| Form | Kind | Purpose | Highlighted fields | Widgets | Services | Derived from |
| --- | --- | --- | --- | --- | --- | --- |
| ImportSource | wizard step | Register a source snapshot | source name, operator-managed archive reference, checksum, source version, target site | archive manifest | X.preflight#Discourse | Discourse models/R2–R5 |
| ImportMappings | wizard step | Resolve identity/access mapping | source IDs, target parties/categories, visibility, skipped feature disposition | exception table | X.store#Mappings | new; full editable fields are these mappings plus reason |
| ImportPreview | display | Inspect planned changes | entity counts, permissions, collisions, unsupported features, missing uploads | discrepancy table | X.preview#Import | source-model mapping (§18) |
| ImportRun | component | Run/resume controlled import | run ID, checkpoint, successes, failures, deferred dependencies | progress, item failures | X.run#Import, X.retry#ImportItems | framework job pattern |
| Cutover | single | Approve reconciled activation | run ID, reconciliation revision, source freeze acknowledgement, target backup reference, confirmation | checklist and explicit activate | X.reconcile#Import, X.activate#Import | new; these are the full input fields |

**Actions/states:** source remains read-only; unresolved visibility/identity errors block affected
records and cutover. No browser submission of database credentials or arbitrary filesystem paths.
Cancellation leaves a resumable staging run, not a half-public site. **Needs:** PASS-IMPORT,
PASS-OPS, PASS-ACCESS.

### ActivityReports

**Layout:** report tabs Participation, Moderation, Delivery and Capacity, period/category filters.

| Form | Kind | Purpose | Highlighted fields | Widgets | Services | Derived from |
| --- | --- | --- | --- | --- | --- | --- |
| ActivityFind | find | Scope report | period, category, metric, interval | date range | — | R4 admin reports |
| ActivityMetrics | list | Inspect aggregate health | visible topics/posts, active contributors, review age, decisions, delivery errors, storage/latency | charts with tabular equivalent | O.get#Activity | R4 reports; R9 website activity |

**Actions/states:** export authorized aggregates; suppression avoids exposing private conversation
activity to category moderators. Explain incomplete periods and failed jobs; no fabricated zeros.
Public rankings/member surveillance dashboards are not included. **Needs:** PASS-OPS, PASS-MOD.

## 12. Read state, notifications and email

### 12.1 Tracking and participant scale

Separate records express four choices: access membership, forum notification level, email mode,
and internal Inbox delivery. Joining a category does not imply emailing every post. Public users
default to category Normal and email notifications for direct replies/mentions; whole-list mail
is explicit opt-in. Internal defaults preserve existing CldInbox/CldMailboxOnly behavior.

Forum notification levels are Muted, Normal (direct replies/mentions), Tracking (also unread),
Watching (every new visible post), and category-only Watching first post. A topic override wins
over the category; otherwise category wins over the site default. Explicit Muted suppresses
ordinary forum notifications including mentions, but not account-security or moderation outcomes.
Authoring/replying sets Tracking only if the user has no explicit override. Category membership
and entitlement are evaluated separately. Email override follows topic → category → site;
options are None, Notifications, Digest, and Every post (category/site mailing-list mode).
Digest and Every post are alternate modes, not two sends; opt-out suppression wins over inherited
defaults until the user explicitly changes it. Include-own-posts is off by default.

Internal recipients retain `CommunicationEventParty` rows and existing read/flag/archive/snooze
semantics. This distinction applies to every MAILBOX, including unbound internal/private lists,
not only categories published through PASS. Public members, mentions and reply recipients do not receive these rows; their
`ForumTopicUser` marker records last consumed ordinal, highest seen ordinal, last visit, watch
choice and dismiss/archive state. Public lists must not enumerate all members per post just to
allocate state; recipient resolution for actual notifications/delivery is a paged background job.
Posting is bounded by the internal recipients and message size, not public member count. Unbound
mailboxes may use the same topic metadata/markers with no site binding; they remain unreachable
through public routes. Their existing access and internal-user behavior stay unchanged. Direct
non-mailbox messages outside the new private-conversation model keep their current semantics.

GET never marks read. A visible-window dwell update advances the consumption marker monotonically;
jumping to a post is an explicit reading-position jump, not evidence that every previous post was
read. Highest seen is kept separately for navigation. Unread counts count currently visible posts
after the consumption marker, not ordinal subtraction. Mark unread stores an explicit personal
boundary; stale delayed read requests cannot clear it (marker revision required). Internal reading
marks only displayed messages through the shared state service. Thread position is available to
internal readers too, but never fabricates individual read receipts. Receipts are visible only
to internal users authorized for that thread; never in public projections.

On first category join, existing history defaults read (capture current visible boundary), with
Mark unread available. On public→internal transition, retain the topic marker and write per-message
rows for future deliveries; derive older unread presentation from the pre-transition marker and
never invent historic individual read receipts. Record the tracking-mode effective boundary.
On internal→public transition, seed the thread marker conservatively to before the earliest
unread retained message, keep explicit watch preferences, stop future CEP allocation, and retain
historical CEP rows under internal-only projections. Inconsistent preexisting state may show extra
unread, but must not hide unread content. The conversion is checkpointed per party/topic and
new writes use the effective mode immediately; report failed conversions and retry them.

### 12.2 Notification and email processing

Publishing commits the post/revision and an outbox item atomically. Outbox workers resolve
current authorized recipients and deduplicate the same mention/reply/watch event. In-app and
email delivery are separate outcomes; reading a notification does not mark unseen posts read.
Scheduled digests materialize only currently accessible topics at send time. Large recipient
sets are paged; each delivery is independently committed/retryable with backoff and bounded
attempts, default 5 attempts then operator-visible failed state. One bad address does not abort
others. A lost worker lease may repeat work, so provider/message IDs and idempotency records are
required. Delivery state must represent uncertain provider outcomes rather than claiming exact
once transport over an ambiguous network failure.

Use existing `L.send#ContactListEmail` / `L.send#ContactListPartyEmail` where their addressing,
template and consent behavior fits, with new forum-specific recipient/preferences policy.
`ContactListCommStatus` is a per-list/event/address ledger with message ID; extend rather than
relabel membership as mail consent. Its existing `contactMechId` key means it is insufficient
alone for non-list private notifications, multi-event digests and repeated event types; the new
ForumDelivery ledger covers those and links to the existing row when applicable. Never bypass
suppression merely because a user is a category member. Framework notification projection is
restricted to the current recipient and current content visibility.

Outbound list messages include stable thread references, list identity, a scoped reply address,
a canonical authorized post link and scoped unsubscribe controls. Per-recipient sender names do
not disclose email addresses to other members. Private conversation emails default to a minimal
notification/link; full body delivery requires explicit site and recipient opt-in. Email cannot
retract material already delivered; audience changes prevent subsequent sends and downloads.

### 12.3 Inbound posting

The framework already accepts mail behind a trusted edge gateway (see `docs/Mail-Inbound.md`),
stores `EmailMessage`/attachments, and runs email ECAs/rules. The gateway handles internet SMTP,
spam/virus filtering and trusted authentication results. A new forum route handler consumes that
stored message, not a second SMTP server. Existing hosted/shared accounts or IMAP ingestion can
feed the same handler. Preserve the original envelope recipient including reply token/plus tag;
address normalization must not discard routing evidence before the handler sees it.

Routes resolve one site and category or reply capability. Reply tokens are opaque, hashed,
revocable and scoped to recipient, site and thread; they identify a permitted target, never grant
membership. A sender must match a verified account address with trusted gateway authentication
or configured verified transport evidence. Do not trust arbitrary From headers or untrusted
Authentication-Results. A mismatch, forwarded token, expired grant or ambiguous identity is
held/refused with an item-level reason. Category-address new topics require a verified eligible
member and the same posting/trust rules as web. Do not create public users automatically from
incoming mail.

Deduplicate by site/route plus message identity, sender and content fingerprint; reject conflicting
reuse of an existing source identity. Handle References/In-Reply-To through stored reply mappings,
not subject matching alone. A stripped subject prefix must not alter a reply's root. Quoted
history/signatures are removed conservatively with the original stored privately for diagnostics;
MIME is converted/sanitized and staged attachments follow web rules. Reject auto-replies, delivery
reports and own outgoing messages as posts; route bounces to the delivery ledger. The same
message delivered through multiple account aliases produces one forum post. Approved inbound
posts create normal outbox events without echoing the original sender unless requested.

Unknown/unauthenticated senders receive no automatic backscatter response; gateway refusal or
operator review applies. Verified members get safe rejection/approval-pending feedback that
contains none of another thread's content. Approval later sends one notification/delivery event.
All independent messages/recipients log failures and continue. A forum-handler failure does not
delete the already stored email; retrying reuses its ingestion identity.

### 12.4 Consent and opt-out

Forum delivery preference, publication subscription and marketing consent are separately named
purposes. Forum email opt-out does not end ContactListParty membership or Subscription access.
Reuse token hashing, expiry and one-click primitives from existing ConsentServices, but add a
forum delivery action rather than calling the existing membership-unsubscribe action unchanged.
GET renders choices; only POST changes state. Repeated one-click requests return the same result.
Hard bounce disables the failing address for sending and alerts its owner safely; changing to a
new verified address requires explicit resumption preferences, not automatic resubscription.

**Needs:** PASS-READ, PASS-DELIVERY, PASS-AUTH, PASS-OPS.

## 13. PASS applications and BOSS integration

### 13.1 Shared foundation and independent app use

Forum is the first PASS app. Commerce and Blog/Publishing use the same PublicSite, host/mount,
profile, membership, account, media, search-projection and entitlement contracts. A site may
install/enable any subset. No Forum page assumes a cart, no publication requires a store, and a
store can link support without exposing a private staff mailbox. A store mount binds an existing
`ProductStore`; a publishing mount binds a new publication grouping. Cross-app links carry stable
record IDs and resolve in the destination's site/authority, not arbitrary supplied URLs.

Navigation and account continuity are shared within a site. Across hostnames, use registered
SSO/session handoff with site eligibility rechecked, not a broadly scoped browser cookie.
The shared search service composes per-app public projections, preserving each app's ACL and
publication state; no raw UniversalSearch result is exposed to anonymous callers.

### 13.2 Future Commerce

Commerce's later document designs public catalog/category/product pages, merchandising content,
cart/checkout, customer account/orders and relevant portal flows using the existing store/order/
payment/shipping services. BOSS Commerce remains the staff channel/store-management surface.
These are different views of shared records, not separate order or customer stores. Reconcile
`research-commerce.md`'s open storefront question accordingly.

This Forum design supplies contracts for product-linked support categories/topics, a product's
related discussions, topic-to-case escalation, shared site/account links and membership checkout
handoff. `CommunicationEventProduct` links a topic to a product; `RequestCommEvent` or the existing
communication-record join links it to a case. Public product references expose only published
store products; order-specific support details stay in a private case/help thread. Creating a
case never republishes private staff notes. A deliberate reply-to-forum action previews its exact
public body and validates the audience before calling the normal post service.

Paid access uses existing `ProductSubscriptionResource`, `SubscriptionResource`, `Subscription`
and the interfaces `mantle.product.SubscriptionServices.init#SubscriptionResource`,
`renew#SubscriptionResourceAccess`, `revoke#SubscriptionResourceAccess`,
`restore#SubscriptionResourceAccess`, and `destroy#SubscriptionResource`. Implement new resource
handlers for site/category/publication access. A source-bound access grant records resource,
party, scope, effective dates and subscription identity. Payment success callbacks alone do not
grant access: the authoritative order/subscription lifecycle does, idempotently. Renewal extends
that source; expiry/revocation removes it while preserving independent manual/organization grants.
Restoration reinstates the authorized remaining period. Default is no grace period; a future
Commerce policy may explicitly define one. A paid subscription never adds a UserGroup. Forum
shows eligibility/expiry and a registered checkout/manage-subscription handoff; checkout and
payment-provider implementations are not redesigned in this file.

### 13.3 Future Blog/Publishing

The Publishing app's remit includes publication home/archive/search, articles, author profiles,
cover/teaser/taxonomy, editorial workspace, review queue, scheduling, previews, version history,
feeds, subscriber preferences and publication settings. Future roles are publication owner,
editor, author and subscriber, scoped by membership records without BOSS grants. Later
`design-publishing.md` supplies its full screen/form design; these contracts are decided now.

Existing framework `WikiBlog` is **one article's metadata**, not a publication container. It has
`wikiPageId`, title, author, summary, publishDate, SEO fields and image; `WikiBlogCategory` binds
wiki categories. `WikiPage` stores versioned content and `publishedVersionName`; WikiServices
already has `create#WikiBlog`, `update#WikiBlog`, `set#PublishedVersion`, `request#WikiPageReview`,
`decide#WikiPageReview`, `get#WikiPageVersionDiff` and `get#PublishedWikiPageText`. Reuse those
primitives. Add publication/site grouping, author-party attribution, locale/channel binding,
editorial status and a version-bound publication schedule; do not introduce a parallel article
body store. Framework content extensions remain framework-owned; Mantle owns site bindings,
entitlements and business links, so the framework does not acquire a Mantle dependency.

Editorial lifecycle is draft → review → approved → scheduled/published → withdrawn. A review
approves a particular revision, not every future edit. The public article reads a published
revision snapshot and matching metadata; a new draft does not overwrite it. Scheduling stores
the approved revision and intended site/time zone/instant; a worker rechecks approval and access
before publishing once. Reject or supersede a stale schedule explicitly. Preview capabilities
are short-lived, read-only and revision-scoped, excluded from public indexing/caches/feeds.
Withdrawal invalidates article/search/feed/media projections; it does not erase revision history.
The current single published pointer must not be repurposed for independent per-site releases:
a release binding records the exact content and metadata revision for its publication/locale.

Commons remains the general wiki authoring/version/review surface; Marketing provides campaign
and content-management contexts over the same articles. PASS Publishing supplies standalone
editorial and public screens over the same services, requiring neither BOSS app. Approved reviews
and scheduled releases are shared domain actions, not duplicate status machines in each UI.
Existing Marketing/Commons notes assigning blogs solely to Marketing are superseded by this
ownership split.

An article may link to one discussion topic in an explicitly selected category. Its comments
use Forum posts, reactions, moderation and subscriptions; there is no second comment store.
Create the linked topic idempotently on publication when comments are enabled, with only approved
public title/excerpt; repeated publishing does not create another thread. Article discussion
access is the intersection of article entitlement/publication access and category/topic access.
The same gate applies in Forum, Comms, search, media and email. Withdrawing/unpublishing the
article gates its discussion too until explicitly detached through an audited audience review.
For a paid article, the topic must not reveal its title/excerpts through a public category listing.
Use a restricted category or deny the mismatched binding at configuration time. With Forum disabled,
articles offer no discussion controls and retain their independent publishing/subscription flow.

Publishing and Commerce link products and articles through explicit source/target bindings,
validate each side's public access, and show related content through shared projections. Paid
publications use the same source-bound entitlement lifecycle as private forums. Publication
subscriber delivery can reuse the delivery/outbox primitives but has its own preference purpose,
selected published revision and opt-out; it neither subscribes a reader to all forum replies nor
treats a purchase as marketing consent.

### 13.4 Comms and Customer Service

Comms Inbox continues to show the same mailbox posts, with forum category/site attribution,
moderation visibility, accepted-answer/closed status and public-versus-private reply indication.
Its compose path, email ingestion and API all invoke the shared post gate. Internal users keep
individual message state. Public users remain out of BOSS, even if site/category moderators.

Add a Comms moderation mount over the Mantle queue for authorized internal moderators, using the
same review/action services. No dependency on PASS screens: reusable widgets can move to the
framework when justified, while BOSS renders its own queue/context. Comms needs topic-policy,
revision and draft-conflict handling so it cannot bypass review, restrictions or notifications.
`C.create#Message`, `get#InternalThread`, `set#InternalMessageState`, `close#ListThread` and list
find services gain shared-policy hooks for forum-bound data; security rules do not live only in
the new public facade. Existing unbound mailbox behavior remains the compatibility baseline.

For Customer Service, `I.create#CaseFromTopic` makes a scoped Request plus a stable topic link;
private case notes remain private. `I.publish#CaseReply` requires the CSR's forum posting rights,
previews the exact public body and never copies a complete case timeline. Article creation from
a resolved discussion produces an editorial draft with source links, attribution and a reviewer;
it is not automatic public publication. Support, product and article pointers do not grant access
to their linked internal records.

## 14. Data model

### 14.1 Existing records and services verified

| Existing artifact | Verified location / behavior | Reuse or extension |
| --- | --- | --- |
| mantle.marketing.contact.ContactList, ContactListParty | Mantle MarketingEntities; MAILBOX, postingEnumId, isPublic, defaultDeliveryEnumId, archivedDate; dated party role/status/delivery | Keep as category membership/posting basis; add explicit site/category binding and shared policy checks. |
| mantle.party.communication.CommunicationEvent | Mantle PartyEntities; root/parent IDs, subject/body, sender, contactListId, statusId, editedDate | Canonical root/post body; forum metadata never copies another authoritative body. |
| CommunicationEventParty | Same; party/role per-message read/flag/archive/snooze state | Keep internal state; stop allocating public-user rows in all MAILBOX lists and PASS private conversations. |
| CommunicationEventContent, CommunicationEventProduct, CommunicationEventRecord | Same; attachment and record/product joins | Reuse with current audience enforcement and public-safe projections. |
| ContactListCommStatus | MarketingEntities; key list/event/address, messageId unique | Reuse where applicable alongside the new generic forum delivery ledger. |
| Request, RequestCommEvent, RequestRecord | Mantle RequestEntities | Case escalation and explicit topic links; no automatic note publication. |
| ProductStore and its settings/content joins | Mantle ProductStoreEntities | Commerce site mounts and future storefront data. |
| Subscription, SubscriptionResource, ProductSubscriptionResource | Mantle ProductDefinitionEntities; lifecycle interfaces in SubscriptionServices | Implement scoped access-resource handlers; do not create a second billing ledger. |
| moqui.resource.wiki.WikiBlog, WikiBlogCategory, WikiPage, WikiSpace | Framework ResourceEntities; WikiServices publication/review/version methods | Article metadata/body/version foundation; needs publication grouping and release/schedule metadata. |
| moqui.chat.ChatEvent, ChatPoll, ChatPollOption, ChatPollVote | Framework ChatEntities | UI/algorithm patterns only; chat IDs/event log do not fit forum posts. |
| ContactListServices, CommunicationServices | R1 | Existing services are extended, not exposed unrestricted; see §15. |
| mantle.search.UniversalSearchServices.search#Universal | Mantle service/mantle/search/UniversalSearchServices.xml | Existing authorized search pattern; add site-aware public projections and current-access post-filter. |
| mantle.party.ConsentServices.create#UnsubscribeToken, check#UnsubscribeToken, resolve#UnsubscribeToken, apply#UnsubscribePreferences | Mantle service/mantle/party/ConsentServices.xml | Reuse token/consent mechanisms; existing membership-changing unsubscribe is not the forum delivery action. |
| org.moqui.impl.WikiServices publication/review methods | Framework service/org/moqui/impl/WikiServices.xml | Existing version-bound review; scheduled public release and publication metadata remain new. |

### 14.2 Proposed records

All following names are proposed. PK columns, relationships and uniqueness below are contract
requirements; ordinary created/updated audit fields follow repository conventions. Use framework
IDs and timestamps, not generated numeric URLs or a second global user ID. Lists may have no
ForumCategory, and communication events may have no forum metadata: that is normal legacy data.

| Proposed artifact / owner | Key and essential fields / relationships | Invariants and use |
| --- | --- | --- |
| mantle.public.PublicSite | siteId; name, state, locale, timeZone, theme settings, policyRevision | Disabled by default; no backend secrets in this row. |
| PublicSiteHost, PublicSiteApp | host key → siteId/canonical; siteId+appMountId → app, pathPrefix, enabled, target ID | Host unique per deployment; non-overlapping mounts; target is typed store/publication/forum binding. |
| PublicSiteParty, PublicSiteProfile | siteId+partyId; membership state, role, dates; handle, displayName, avatar, bio, discoverability | One effective site role per party, history audited; normalized handle unique within site. |
| PublicSiteInvitation | invitationId; token digest, site, verified-address binding, grant scopes, inviter, expiry, redeemed/revoked dates | Single redemption transaction; no raw token persistence or implicit staff grants. |
| PublicSitePage | siteId+pageRole; wikiPageId, selected published version, publication revision | Guidelines/about binding, checked before anonymous wiki projection. |
| PublicAccessGrant | grantId; party, site, targetType/ID, sourceType/ID, from/thru, revokedAt | Unique source/scope grant; combine qualifying manual/org/subscription sources without overwriting one another. |
| mantle.forum.ForumCategory | contactListId PK/FK; siteId, parentContactListId, sequence, slug, publication state, visibility, mode, rules, policyRevision | One site per MAILBOX; acyclic hierarchy; inherited access ceiling. |
| ForumTopic | rootCommEventId PK/FK; nullable siteId, kind category/private, revision, nextOrdinal, acceptedAnswerId, wiki default, pinned/unlisted, slow interval, visible activity/counters | Category roots retain CommunicationEvent.contactListId; private roots have none. Unbound mailbox metadata has no site and cannot enter the public API. Closed status derives from root CeResolved. |
| ForumPostState | communicationEventId PK/FK; rootCommEventId, ordinal, revision, visibility, approvedRevision, wiki flag, deletedAt/by/reason | Unique root+ordinal; stable post IDs; hidden/pending/deleted text never leaks through legacy readers. |
| ForumPostRevision | postId+revision; source format/text, sanitized snapshot, editor, date, reason, publicHistoryAllowed | Append-only; restore produces another revision; redacted evidence staff-only. |
| ForumParticipant | rootCommEventId+partyId; role, addedBy, addedAt, endedAt, invitation state | Explicit private-conversation authority; group additions materialize a snapshot. |
| ForumTopicUser | rootCommEventId+partyId; consumedOrdinal, highestSeenOrdinal, markerRevision, unreadBoundary, visit dates, watch override, archivedAt | One public marker per visited/participating topic; no public per-post fan-out. |
| ForumTrackingMode | partyId; current mode, effectiveAt, conversion checkpoint | Group-derived internal/public mode; transition behavior in §12. |
| ForumPreference, ForumDeliveryPreference | site+party+scopeType+scopeID; watch level; email mode, digest period, own-post flag, opt-out evidence | Distinct forum notification/email choices, no membership side effects. Scope uniqueness enforced. |
| ForumMemberPreference | siteId+partyId+targetPartyId; mute/block, expiry | Self-owned; no public block list. |
| ForumDraft | draftId; site/party, mode, root/parent/category, source, title/tags/poll draft, revision, updatedAt | Private, revision checked; staging references only, no published post until commit. |
| ForumAttachment | attachmentId; site/owner, staged draft or post/content join, media metadata, scan state, expiry | Exactly one active owner scope; derivatives inherit scope, finalization verifies staged owner. |
| ForumTag, ForumTopicTag, ForumTagAlias | site+tagId/name; root+tag; old slug → tag | Site-local taxonomy, scoped counts; merges preserve redirect aliases. |
| ForumReaction, ForumBookmark | post+party+reaction key; bookmarkId+party/root/post, note/reminder | Unique actor reaction; bookmark remains personal, distinct from Inbox flag. |
| ForumPoll, ForumPollOption, ForumPollVote | pollId/post; poll+optionId; poll+party+option | Ballot transaction enforces choice count, deadline and one eligible voter; post-vote structure immutable. |
| ForumReviewItem, ForumReviewReport, ForumReviewNote | reviewId/target/revision/state/claim; individual reporter/evidence; staff note | Deduplicate active review target/reason family; retain distinct reports, minimum private context and decision history. |
| ForumModerationAction, ForumMemberState, ForumSanction | actionId; site+party trust state; sanctionId with category/site scope, dates and reason | Append-only action audit; sanctions effective at read/write time; staff identity and before/after revision retained. |
| ForumPolicy, ForumRule, ForumTopicTimer | site+policyRevision; ruleId/type/action/config; timerId/root/action/due/revision | Versioned config; allow-listed timer actions; revision/scope rechecked when fired. |
| ForumOutbox, ForumDelivery | outboxId/event key/payload references; deliveryId/recipient/channel/scope/attempt/provider ID/state | Unique event+recipient+channel; queue after content transaction; distinguish permanent, retryable and uncertain outcomes. |
| ForumMailRoute, ForumReplyToken, ForumInboundReceipt | routeId/address/site/category; token digest/thread/recipient/expiry; ingestion source key/fingerprint/result | Route uniqueness, verified sender, no duplicate post on replay/alias delivery. |
| ForumOperationReceipt | site+actor+operationId/action; payload hash, result IDs, state | Idempotency stored with write; conflicting operation reuse rejected. |
| ForumJobRun, ForumJobItem | runId/site/type/checkpoint; run+source item/state/error/attempt | Item isolation, cancellation/checkpoint, retry and partial-success reports. |
| ForumImportRun, ForumImportMap, ForumPermalink | runId/source manifest/stage; source namespace+type+ID → target/checksum/state; old path → target ID | Never overwrite user identity by matching display name; aliases still check destination visibility. |
| mantle.public.PublicDiscussionLink | site+sourceType+sourceID → topic, audience/release gate | Product/article/case integration; one publication discussion per configured source; source access can narrow topic access. |
| framework public registration/delegation records | challenge/session IDs, hashed secrets, subject/client/site scopes, expiry/revocation | New generic framework capability; not stored in public profiles. |
| framework publishing extensions (future) | publication ID, WikiBlog association, author-party attribution, revision-bound release/review/schedule | Content/version ownership remains framework; PublicSite bindings and paid access remain Mantle. |

Index forum queries by site/category/visible last activity/root ID; posts by root/ordinal;
participants/markers by party/root; pending review by site/state/age; jobs/outbox by due state;
source grants by party/scope/effective dates. Keep list aggregation and trust recomputation off the
posting transaction. Page media, recipients and imports; never load every thread or member into
a request to compute one page. Counter repair is idempotent and does not redefine permissions.

Bootstrap existing category threads into ForumTopic/PostState in a checkpointed migration while
publication is disabled. Seed chronological ordinals by entryDate then event ID, retain stable
IDs and existing closed state, and set normal posts approved. Do not infer an accepted answer
from CeResolved. No existing list becomes internet-visible through this migration. Membership,
tracking and content conversions require reconciled counts before enabling the public binding.

## 15. Service and API catalog

The prefixes defined in §6 are new domain/facade namespaces except L/C/W. All reads return
capabilities and a safe projection; all writes use actor/site context, revision/idempotency rules
and the same access engine. The tables define operation families; names separated by commas
are individual services, not dynamically selected service strings from a browser.

| Proposed service family | Minimum contract | HTTP family under /rest/s1/pass/v1/sites/{siteId} |
| --- | --- | --- |
| S.find#Sites, create#Site, update#Site, store#Mounts, check#Readiness | Allowed sites; validated site/host/app config, owner provisioning, diagnostics. Global site creation is operator-only outside the per-site router. | /configuration, /mounts, /readiness |
| S.get#SitePage, publish#SitePage | page role → approved content; publish exact version after wiki/site access checks. | /pages/{role} |
| S.join#Site, leave#Site, get#Membership, find#Members, set#Membership, set#SiteRole, update#MembershipPolicy | Current subject join/leave; scoped staff membership/role changes, eligibility source and effective dates. | /membership, /members, /membership-policy |
| S.create#Invitation, inspect#Invitation, redeem#Invitation, revoke#Invitation | Bind verified recipient and allowed scopes; single-use redemption. | /invitations |
| S.get#Profile, store#Profile | Public-safe profile and self/staff-authorized changes; site handle uniqueness. | /profiles/{handle}, /me/profile |
| A.start#Session, complete#Session, request#Recovery, begin#Registration, verify#Registration, manage#Account | Backend auth/second-factor, generic recovery, verified registration and current-user security actions. Registered audience/session bridge; explicit action DTOs, never arbitrary user fields. | /account/session, /account/challenge, /account/recovery, /account/registration, /account/security |
| F.find#Categories, get#Category, store#Category, bind#Mailbox, preview#CategoryAccess, set#CategoryAccess | Discover/read safe category data; owner-only binding/config with audience preview and revision. | /categories |
| F.join#Category, leave#Category, find#CategoryMembers, set#CategoryMember | Scoped category membership, pending state, source grants and roles; wraps existing L operations. | /categories/{id}/membership, /categories/{id}/members |
| F.find#Topics, get#Topic, get#Posts, search#Forum, find#Tags | Scoped cursor lists/topic metadata/post windows/search; no actor-supplied visibility flags. | /topics, /topics/{id}/posts, /search, /tags |
| F.store#Tag, merge#Tag | Owner taxonomy edits/alias preservation with usage/audience checks. | /tags/{id} |
| F.store#Draft, find#Drafts, discard#Draft, preview#Post | Private revisioned draft, sanitized preview, staged-upload cleanup; preview never indexes. | /me/drafts, /preview |
| F.publish#Post, update#Post, restore#PostRevision | Validated new root/reply/edit, gate before write/fan-out, state published/pending, resulting IDs/revision/operation receipt. | /posts, /posts/{id}, /posts/{id}/restore |
| F.get#PostHistory, compare#PostRevisions | History/diff filtered by current content/history permissions. | /posts/{id}/revisions |
| F.stage#Attachment, remove#StagedAttachment | Actor-owned upload stage, scan status, bounded metadata; download handler independently checks parent access. | /attachments |
| F.mark#Read | Visible-window position and marker revision; monotone updates except explicit user mark-unread; internal message receipts only for rendered IDs. | /topics/{id}/read |
| F.set#Reaction, accept#Answer, vote#Poll, get#Poll | Idempotent desired reaction/answer state or ballot, actor eligibility, revision/counters; no arbitrary vote count. | /posts/{id}/reactions, /topics/{id}/answer, /polls/{id} |
| F.store#Bookmark, remove#Bookmark, find#Bookmarks, set#MemberPreference | Self-owned bookmarks/reminders and mute/block; private target-safe projections. | /me/bookmarks, /me/member-preferences |
| F.find#Conversations, create#Conversation, update#Participants, set#ConversationState | Explicit active participants, audience confirmation, block/eligibility checks; shared topic read/write services. | /conversations, /conversations/{id}/participants |
| M.find#Reviews, get#Review, claim#Review, add#ReviewNote, decide#Review, decide#Reviews, flag#Post | Scoped evidence, claim lease, immutable decision audit; batch results per item. Flags cannot supply arbitrary hidden evidence. | /reviews, /reviews/{id}/decision, /posts/{id}/flags |
| M.preview#TopicAction, apply#TopicAction | Allow-listed move/split/merge/close/reopen/pin/unlist/slow-mode/timer/delete/restore/wiki actions with explicit target, selection, reason and revision. | /topics/{id}/moderation/preview, /topics/{id}/moderation |
| M.get#Member, set#Sanction, add#MemberNote, set#Trust, find#Actions | Site/category authority; bounded private-evidence escalation; never account-wide admin by site role. Private escalation uses decide#Review with approval/reason. | /moderation/members, /moderation/actions |
| M.store#Policy, test#Rule, store#Rule | Typed policy sections/rules, bounded test, revisioned activation and audit. | /policies, /rules |
| D.get#Preferences, set#Preferences, inspect#OptOut, apply#OptOut | Self or token-scoped delivery choices, precedence/suppression and no membership mutation. | /me/preferences, /opt-out |
| D.find#Notifications, mark#Notifications | Current recipient projection, notice read state distinct from topic consumption. | /me/notifications |
| D.store#Route, store#MailSettings, find#Deliveries, test#Route | Registered sender/route bindings, safe delivery diagnostics and bounded own-address test. | /mail/routes, /mail/settings, /mail/deliveries, /mail/test |
| D.process#Inbound, dispatch#Outbox, send#Digest | Backend-only workers: original stored mail identity/recipient evidence; current recipient access; durable outcomes. No public arbitrary-send endpoint. | No public route |
| O.get#Health, find#Runs, preview#Operation, start#Operation, retry#Items, store#RetentionPolicy, request#PersonalDataAction, get#Activity | Scoped jobs with preview/checkpoint/per-item failures; self-data requests or authorized aggregates. | /operations, /operations/runs, /reports/activity, /me/data-requests |
| I.get#TopicLinks, create#CaseFromTopic, publish#CaseReply, link#Discussion, draft#ArticleFromTopic | Safe related-record projections, explicit links and audience-reviewed public text, idempotent link/draft creation; current source and destination authority. | /integrations/cases, /integrations/discussions, /integrations/article-drafts |
| X.preflight#Discourse, store#Mappings, preview#Import, run#Import, retry#ImportItems, reconcile#Import, activate#Import | Operator source manifest, scoped mappings, dry-run/restart, discrepancy report and gated activation. | /imports (operator and site-owner capability required) |

Reads use GET, creates/actions POST, revisions/settings PATCH, explicit personal removals DELETE;
GET never changes content/read/consent. Query/body fields are allow-listed per operation, uploaded
media uses the staged-upload handler, and permission decisions remain server-side. Metadata
lookup GETs return neither secret tokens nor arbitrary entity maps. Email worker and subscription
handler methods are internal-only, not exported through wildcard service routing.

Existing L/C services must call the same site/category/topic policy before deciding access or
allocating recipients. F.get#Category calls L.get#ContactListAccess plus the publication/site gate;
F.publish#Post uses the extended C.create#Message; internal reads/marks can reuse C.get#InternalThread
and C.set#InternalMessageState; M.apply#TopicAction delegates close/reopen to C.close#ListThread.
Today's get#InternalThread requires a user party and returns an entire thread: anonymous and
bounded public reads need the new F projections, not an anonymous flag on that existing service.
Extract common authorized window retrieval for both readers; internal whole-thread callers retain
compatibility while public requests stay bounded. Keep old parameter compatibility for trusted
internal callers, but public facades do not forward sender/status/recipient/party overrides. An API compatibility test compares
local and remote projections/errors, including anonymous and staff cases. The API is versioned
independently of screen paths; additive fields are allowed within v1, semantic/removal changes
require a new version and explicit adapter compatibility check.

## 16. Framework and data needs

These are the canonical PASS work items, rolled up by reference in
[BOSS design-crosscut §7.4](../../mr-boss/plan/design-crosscut.md#74-ironstoa-pass-needs). A need
may extend existing implementation; it does not reclassify all underlying facilities as missing.
Every screen's Needs labels must resolve here.

| Need | Kind / owner | Proposed as | Used by | Stub specification |
| --- | --- | --- | --- | --- |
| PASS-SITE | data model, service type, seed data / Mantle + PASS | PublicSite/hosts/mounts/roles/profiles; SiteServices and Pass shell | Sites, SiteDetail, discovery, accounts, future apps | Explicit publication, host binding, scoped roles, startup readiness, default disabled site. |
| PASS-AUTH | service type, data model / framework | registration/recovery challenges and delegated public sessions | Login, SecondFactor, Registration, Invitation, AccountSettings | Verified identity without internal groups; audience/site-scoped remote credentials, factor continuity, revocation. |
| PASS-API | service type, protocol client / framework + Mantle | authenticated adapter and restricted pass.rest.xml v1 | every facade/remote screen | Typed DTOs, current actor authorization, cursor/revision/idempotency/error contracts, configured endpoints only. |
| PASS-ACCESS | data model, service type / Mantle | shared site/category/topic/conversation access evaluator | all reads/writes including Comms/email | Publication plus legacy policy, hierarchy, source grants, current visibility and source-discussion gates. |
| PASS-TOPIC | data model, service type / Mantle | forum thread metadata, revisions/drafts/tags/reactions/polls/bookmarks | topic, composition, personal screens | Canonical CommunicationEvent body, stable IDs/ordinals, atomic transitions, independent solved/closed state. |
| PASS-READ | data model, service type / Mantle | ForumTopicUser, mode boundary, CEP allocation extensions | Topics, stream, Comms, notifications | Public markers/internal receipts, tracking-mode conversion, scalable counts and no public row fan-out. |
| PASS-PRIVATE | data model, service type / Mantle | explicit ForumParticipant and private preferences | Conversations, ConversationDetail, profiles | Snapshot group recipients, confirmed history grant, block rules, audited limited report access. |
| PASS-MOD | data model, service type, seed data / Mantle | review queue, audit, sanctions, policies/rules, timers/trust | moderation/settings and Comms mount | Revision-bound decisions, claims, bounded defaults, shared posting gate, optional AI queue only. |
| PASS-MEDIA | service type, tool / framework + Mantle | scoped staging/download/derivatives, scan hook, restricted preview fetch | composer, profile, publishing | Parent ACL at delivery, size/type checks, quarantine, staged expiry, sanitized rendering. |
| PASS-DELIVERY | data model, service type, seed data / Mantle + framework mail | preference/notification/outbox/delivery/route/reply/receipt services | personal/mail screens, email participation | Independent audience-safe sends, current access, verified inbound sender, one-click delivery opt-out, loop/dedup controls. |
| PASS-RENDER | render mode, shell item / framework + PASS | public host/mount shell and shared HTML/qvue projection | all public reading screens | Canonical ID routes, server HTML, metadata/feeds, inaccessible cache prevention, accessible enhancement. |
| PASS-SEARCH | service type, seed data / Mantle + framework search | site/app search projections and invalidation | Search, tags, topic lists, Operations | Filter before snippets/counts, verify stale hits, stable cursors, per-site repair. |
| PASS-PUBLISH | data model, service type / framework + Mantle | wiki publication/release binding and public page adapter | Guidelines, SiteDetail; future Publishing | Exact published revision, site/locale release metadata, future editorial/schedule contracts, no duplicate bodies. |
| PASS-INTEGRATE | data model, service type / Mantle | discussion links, support/public reply, entitlement resource handlers | Comms, support, future Commerce/Publishing | Idempotent links/grants, source ACL intersection, no private case-note copying or billing duplicate. |
| PASS-OPS | data model, service type / Mantle + framework jobs | checkpointed runs/items, retention/export/health reports | Operations, ActivityReports, account data requests | Independent failure tolerance, item diagnostics, cancel/retry, preview before destructive retention. |
| PASS-IMPORT | data model, service type / Mantle | staged Discourse importer/maps/permalinks/reconciliation | Migration | Repeatable archive import, strict identity/access checks, stable source mappings and gated cutover. |

No new general-purpose XML widget is required for S1 beyond existing forms/tree/editor/diff;
Forum stream/composer are custom qvue. If implementation extracts a reusable widget, follow
style-guide §8 for XSD, renderer/macros, Vue wrapper, HTML fallback, documentation and rendering
checks; this design does not silently assume a nonexistent widget. SSO/inbound mail/search/media
readiness checks account for build/package features and configured providers.

## 17. Documents and outputs

| Output | Kind | From screen/service | Derived from / access |
| --- | --- | --- | --- |
| Topic/category HTML, print view | server HTML / html-print | TopicDetail, CategoryDetail | Same current authorized projection; no print-only private fields. |
| RSS/Atom topic feed, sitemap, social metadata | public feed/XML/HTML | Topics, CategoryDetail | Published anonymous-visible items only; no private feed tokens in S1. |
| Post/reply/mention/list email, digest | email | D.dispatch#Outbox, send#Digest | R3 lists/preferences; recheck each recipient at send time. |
| Verification/invitation/recovery/moderation outcome | email/in-app | account and review flows | Minimal scoped identity/action information, no account enumeration. |
| Delivery/review/activity export | CSV/JSON | ModerationLog, MailDelivery, ActivityReports | Same staff scope; generated as an authorized expiring download. |
| Personal data export | archive | AccountSettings → Operations | Own data and currently permitted authored context; omit other users' secrets/private evidence. |
| Site forum export | versioned archive + manifest | Operations | Staff-authorized topics/posts/media/settings/mappings; exclude credentials and signing secrets, preserve visibility metadata. |
| Import preflight/reconciliation/cutover report | JSON/CSV + readable report | Migration | Source/target counts, checksums, mapping/errors and operator decisions; private evidence stays restricted. |
| Publishing feeds/subscriber email | future feed/email | future Publishing services | Selected published revision and separate publication consent; never draft content. |

Exports have schema version, source site/authority, creation time, stable IDs and checksums.
Export entitlement is rechecked when downloading; temporary files expire and are cleaned per
item. CSV fields are escaped safely and spreadsheet formula-leading user text is neutralized.
Backup/restore remains a deployment operation; application exports are portability tools, not a
claim of complete database disaster recovery.

## 18. Migration and rollout

### 18.1 Discourse migration contract

Support an operator-supplied Discourse backup database snapshot and upload archive first, with
an adapter version identified in the manifest. Do not connect the browser to production SQL or
run arbitrary uploaded scripts. Import into a disabled staging site on the authoritative backend.
A preflight verifies checksums, source schema, available features, upload references and source
visibility rules. Unknown source privacy semantics block the affected objects and activation;
unsupported optional plugin features are listed for explicit preserve-as-content or defer choice.

| Source | Target / transformation |
| --- | --- |
| Users, verified identity, profiles | UserAccount/Party + PublicSiteParty/Profile; map stable source IDs, preserve handle where unique, resolve conflicts explicitly. Do not import password hashes, sessions or automatic internal/staff groups. |
| Categories/subcategories, category permissions and groups | MAILBOX + ForumCategory; map source groups to explicit site/category/org grants. Missing mappings deny access, never default public. |
| Topics/posts/replies, closed/pinned/deleted states | CommunicationEvent + ForumTopic/PostState; preserve author/time/source IDs, reply graph and visibility; stable destination IDs/ordinals and source permalink aliases. |
| Source Markdown/raw and rendered text | Preserve source in revisions; render/sanitize anew. No trusted import of cooked HTML. Unhandled plugin markup is identified in report and converted to safe text or reviewed content. |
| Uploads, avatars, embedded media | Verified archive path/checksum → staged/scanned resources; rewrite only successfully mapped links; no fetching arbitrary external links as import side effects. |
| Edits, accepted answers, reactions, tags, bookmarks, polls | Map supported source records into corresponding entities, with visibility and actor checks. Likes become the default like reaction; plugin reaction keys map explicitly. |
| Watches, read positions and email preferences | Import mapped per-topic/category choices and positions; email sending remains disabled until cutover preferences are confirmed. A missing preference defaults to no imported bulk mail. |
| Private messages and allowed users/groups | Private topic + explicit participant snapshot, all private by default. Historical group expansion requires a reviewed source membership snapshot. |
| Sanctions, staff notes and moderation history | Restricted records with source actor/reason; source staff roles require explicit owner mapping before activation. |
| Legacy URLs | ForumPermalink → stable target IDs; old slug/post-number links resolve after current access checks, including moved/deleted content. |

Identity resolution never merges accounts by display name. A matching verified email produces a
candidate mapping requiring operator review; ambiguous/missing addresses create inactive
identities with retained attribution. Staff promotion is explicit. Existing SSO identities link
only through validated subject mapping. New local users activate with verification/recovery,
not imported passwords. Import operations may set historical authors/timestamps only through
operator-scoped internal services; these parameters are absent from public APIs.

Import order: identities/site groups → categories/grants → roots/posts/revisions → uploads and
rewritten references → reactions/polls/tags/participants → markers/preferences → indexes/counters/
permalinks. Persist source namespace/type/ID, checksum and destination ID for every unit. Replay
of the same snapshot is idempotent; changed source objects are reconciled explicitly rather
than duplicated. Dependent children wait for successful parents; one invalid post or upload
logs its source key and continues with independent work. A privacy/identity error never triggers
a permissive fallback. Resuming retries only failed/pending units and their dependencies.

Reconciliation compares source/target entity counts, visible/private/deleted counts, author and
parent mappings, accepted answers, participant grants, upload hashes, representative rendered
posts, source URLs and normalized content fingerprints. Unsupported features and missing media
are individually reported with accepted dispositions; they are not silently counted as success.
Private visibility, identity ambiguity, broken reply roots or unresolved owner mappings are hard
cutover blockers. Site owner and operator approve the reconciliation revision before activation.

Cutover: rehearse on a snapshot; freeze source writes and mail posting; take a final snapshot;
apply/reconcile the final delta by stable source mapping; back up the target; install canonical
host/redirect/mail routing; activate target reads/writes; then enable selected notifications and
mail. Import never emits historic new-post notifications. Until target writes begin, rollback
restores prior host/mail routing. After target writes begin, rollback requires write freeze and
reconciliation/export of new target writes; do not imply that switching DNS reverses data changes.
Retain read-only source/archive and mapping manifests for the configured migration retention.
phpBB import, continuous bidirectional synchronization and automatic import of every Discourse
plugin are deferred.

### 18.2 Delivery stages

| Stage | Deliverable | Exit condition |
| --- | --- | --- |
| S1 foundation | PASS shell/sites, explicit publication, local+remote APIs/auth, basic discovery/topic/editor/media, internal/public tracking, first-post/account/flag moderation, outbound notifications, baseline health | Local/remote access matrix passes; existing Mailboxes regressions pass; no accidental publication, public recipient fan-out or raw API exposure. |
| S2 full participation | Tags/reactions/polls/bookmarks/wiki/answers, private conversations, advanced moderation/trust/timers, full preferences, inbound/new-topic email and digests | Web/mail/Comms parity, retry/dedup and private-conversation tests pass; documented screens/features are complete through S2. |
| S3 integration/operations | Subscription access handlers, support/discussion contracts, Discourse migration, exports/retention/reports | Entitlement lifecycle and source-gate tests pass; migration rehearsal reconciled before any existing-community cutover. |
| Future apps | Separate Commerce and Blog/Publishing screen/form designs and implementation | Consume PASS contracts without duplicating identity, content, membership or business records. |

Index/mail/job lag, failed/uncertain deliveries, access-denial anomalies, scan backlog, conversion
failures and import discrepancies appear in operational diagnostics with site/item IDs. Logs do
not contain body text, passwords or tokens. Defaults have bounded limits; performance acceptance
includes a topic with 10,000 posts and a category with 100,000 public members: page reads remain
bounded and posting allocates no public per-message recipient rows. Queue throughput is measured
separately from request latency, with counts/lag reported rather than a fabricated timing promise.

## 19. Validation and completeness

### 19.1 Implementation acceptance scenarios

Use `moqui test` for service/authorization/model behavior and `moqui test-client` for browser
flows, as repository instructions require; Node is not a test dependency. Extend Mantle
`test/Mailboxes.spec.js` and BOSS `test/InboxMailboxes.spec.js`, and add PASS/remote contract tests.
Existing mailbox specs disable artifact authz for some service checks; add real artifact-authz
and anonymous route tests rather than treating those existing specs as proof of public safety.
Their newly created party-user fixtures do not currently assign internal groups: mark actors
intended to test internal CEP behavior with an explicit non-ALL_USERS group, and add parallel
ALL_USERS-only cases for public markers in bound and unbound mailboxes. Preserve the internal
behavior assertions instead of exempting test accounts from the new classification rule.

| Scenario | Required result |
| --- | --- |
| Public installation over existing internal data | No mailbox/site/page becomes internet-visible until explicitly bound and published; existing internal mailbox behavior assertions remain valid with correctly classified fixtures. |
| Access matrix | Anonymous, public member, internal member, help participant, category moderator, site moderator/owner and operator tested on public/member/private/help/paid data; denied metadata concealed. |
| Multi-site and remote parity | Host/site/category substitution fails; local/remote responses/capabilities/errors match; backend checks revocation despite still-valid frontend session; second factor not skipped. |
| Public API input | Author/status/role/entity/service overrides rejected; client capabilities ignored; POST CSRF enforced; idempotency reuse/conflict and revision conflict demonstrated. |
| Media/search/cache | Hidden/removed/private content cannot leak through snippets, counts, history, quote preview, attachment derivatives, feeds, social metadata or stale public caches. |
| Tracking scale and transitions | Bound and unbound MAILBOX posts and PASS private posts create no public CEP rows; internal recipients retain exact message state; joins, mentions, marker races, mark-unread, public↔internal conversion and retry preserve unread conservatively. |
| Topic integrity | Concurrent edits/replies, accepted answer independent of close, revision restore, parent validation, split/merge/move, aliases, deletion/restoration, counters and watcher visibility remain consistent. |
| Moderation | Queue before notification; claims expire; stale evidence conflicts; peer item failures continue; rate/trust controls shared across entry points; AI failure leaves rules/manual review usable. |
| Private conversations | Snapshot group recipients, block, participant removal, history confirmation, disabled starts, scoped report evidence and audited escalation; no global moderator search of private bodies. |
| Mail | Web/email posting parity, verified sender/token mapping, forged sender/reply token refusal, duplicate alias delivery, delayed retries, auto-reply/bounce loops, attachment quarantine and one post/notification outcome. |
| Delivery preferences | Topic/category/site precedence, mute, digest/list exclusivity, hard bounce, opt-out idempotence; forum opt-out retains membership/paid access and never changes publication/marketing choices. |
| Entitlements/support | Grant/renew/expire/revoke/restore/replayed events, overlapping grant sources; no UserGroup escalation; exact public case reply preview and no private case-note copying. |
| Publishing contracts | Draft/new revision not public; scheduled release bound to approval/revision; invalidation on withdrawal; article discussion gate enforced through Forum/Comms/email/search; Forum-disabled publication works. |
| Operational recovery | Backend timeout preserves draft/operation ID; failed import/delivery/job item named and peers continue; cancel/resume checkpoints; security/data-integrity failures remain strict. |
| Migration | Repeat import no duplicates, ambiguous identities and unmapped private groups blocked, parent/authorship/upload/URL reconciliation, no historic notifications, cutover/rollback after new writes handled explicitly. |
| Browser/accessibility | Desktop/phone, keyboard-only, focus restoration, screen-reader labels, reduced motion, JS-off public reading, public HTML paging and sanitized content. |

### 19.2 Design completeness and inventory reconciliation

This document contains 34 screen rows and 34 matching definitions (§§6–11), each with form
summaries, service references, source/derivation, actions/navigation or shared defaults, states,
and Needs. All 16 Needs IDs resolve to §16. Existing reused services are separated from proposed
families (§§14–15). Every reference feature family in §3 has an adopted/deferred/omitted disposition;
every original summary open question is resolved in §20.

[BOSS ss-inventory.md](../../mr-boss/plan/ss-inventory.md) remains the baseline-form inventory, not a place to invent PASS forms that
have no SimpleScreens predecessor. The Forum UI is new; framework login/wiki primitives and
Comms context are explicitly reused above. Existing WikiBlogs/EditWikiBlog forms are future
Publishing baselines, not claimed as fully designed or implemented here. [BOSS usl-inventory.md](../../mr-boss/plan/usl-inventory.md)
records the directly reused L/C services under PASS contexts and leaves Implemented in untouched;
new proposed services remain in this document until they exist. [BOSS crosscut §7.4](../../mr-boss/plan/design-crosscut.md#74-ironstoa-pass-needs) indexes all PASS
needs without changing the six-core-app historical roll-up counts. Commons/Comms, initial-design,
Commerce and Marketing references point here for the new ownership and shared contracts.

Documentation verification checks screen/definition counts, form table columns, service-prefix
coverage, Needs resolution, relative links/anchors and referenced source file existence. Runtime
tests above are acceptance requirements for implementation, not tests claimed to have run during
this documentation pass.

## 20. Decided

| Decision | Notes |
| --- | --- |
| Suite/component name | IronStoa PASS (Public Application Software Suite), repository/component mr-pass; companion to IronStone BOSS. |
| Document ownership | Full Forum design plus PASS foundation in mr-pass/plan/design-forum.md; BOSS integration documents link here. No app implementation in this pass. |
| App family | Forum first; Commerce and Blog/Publishing future apps with concrete shared contracts and separate future detailed designs. |
| Reference priorities | Existing Mailboxes/Mantle first, Discourse primary UI, phpBB functional breadth, Odoo Forum/Blog/Commerce shared-site and feature evidence. |
| Deployment | One component, several sites/apps, one local or remote authority per deployment; no BOSS dependency or duplicated business store. |
| Public exposure | Explicit site/category/content publication; anonymous read uses the shared access engine with a safe projection, never unfiltered legacy service access. |
| Accounts and roles | Registration/verification/session bridge in framework; site/list roles in data; ALL_USERS alone for public accounts; no public moderation/paid grant becomes a BOSS group. |
| Forum data | MAILBOX lists and CommunicationEvent threads; additive metadata and shared checks, independent accepted-answer/closed state. |
| Read tracking | Internal per-message CEP; public per-thread marker, including safe conversions and no public fan-out. |
| Private messaging | Included in S2, configurable; explicit participants, blocks and narrowly audited report access. |
| Email | Full outbound/digest/list and inbound replies/new topics designed; sender identity, deduplication and preference separation required. |
| Rendering | Dedicated PASS shell; XML forms and server HTML reading, qvue stream/composer, no dedicated TUI in scope. |
| Publishing | WikiBlog article metadata over versioned WikiPage, shared authoring/review with Commons/Marketing, future release grouping and scheduled publication; forum-backed discussion. |
| Commerce | Shared store/account/product/support and subscription entitlement contracts; storefront/checkout design later. |
| Migration | Discourse backup import first, staged/idempotent/reconciled; phpBB importer later. |
| Reliability | Continue independent failed items with named errors; fail closed for authorization, identity/privacy mapping and atomic integrity. |
| Delivery scope | Complete design with S1/S2/S3 build stages; future app documents do not dilute Forum completeness. |

## 21. Open

No blocking product/architecture choices remain for this design. Deployment-specific values
(hostnames, sender domains, gateway/model profiles, quotas and retention durations) are configured
through the named settings and readiness contracts; they are not missing implementation decisions.
Future Commerce and Blog/Publishing documents decide their own complete screen layouts, checkout
policies and editorial conveniences within §13's fixed data/access contracts. Repository ownership
is established: this document lives in `mr-pass/plan/`, with BOSS retaining its integration notes
and shared design references.
