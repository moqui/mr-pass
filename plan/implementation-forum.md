# PASS Forum implementation status

Updated October 28, 2026. The [design](design-forum.md) remains the acceptance specification.
The S1 and S2 implementations span mr-moqui/framework, mr-mantle, and mr-pass, with Comms
display changes in mr-boss. Existing BOSS inbox
regressions run against the shared mailbox changes; BOSS is not a PASS runtime dependency.

## Implemented foundation

| Area | Implementation |
| --- | --- |
| Ownership and data | Mantle site/host/mount, membership/profile/invitation, exact wiki-page binding and access grants; category/topic/post state and immutable revisions; private drafts, media, markers/preferences, review/audit/sanctions, outbox/delivery/receipts and checkpointed jobs. CommunicationEvent remains the post body, and MAILBOX lists retain membership and posting policy. |
| Access and publication | One current site/category/topic evaluator for PASS and bound mailbox entry points, ancestor ceilings, own help threads, publication, membership, sanctions and scoped staff. Sites and categories begin disabled; registration begins closed. A legacy public flag never publishes a site. Effective last-owner protection covers site membership and bound category roles. |
| Framework identity | Verification/recovery reuse native account/password policy and second-factor flows. Hashed single-use challenges, persistent attempt limits, server-side delegated credentials, audience/client/site checks, account/visit revocation, session rotation, registered SSO callback and verifier-bound handoff. Public registration assigns no internal group. |
| Routing and API | Operator-fixed host/app allowlists before public screen dispatch, preserved framework/token paths, versioned site API, explicit operation schemas and facade contracts, checked service errors, CSRF, safe correlation IDs, opaque actor/scope-bound expiring cursors and bounded pages. Global provisioning and workers are not public routes. |
| Local and remote | The same projections and capabilities through the local adapter or one configured HTTP authority. A remote frontend uses framework sessions with explicit remote identity, without Mantle's entity catalog, UserAccount/Party copies or business database. Server-owned multipart forwarding is bounded; protected response bodies stream through the frontend. |
| Posting and review | Revision-protected drafts/edits, sanitized preview and bodies, first-two-contribution approval, contribution limits, atomic ordinal allocation/post/revision/media/receipt/outbox writes, idempotent creates, reporting, expiring review claims, revision-bound decisions, staff notes, sanctions and immutable audit. Topic closure/title/category changes use current permissions and audience confirmation. |
| Mailbox and tracking | Enabled-account/non-ALL_USERS internal classification, internal-only MAILBOX receipt allocation including named recipients/mentions, exact displayed-ID receipts, separate public consumed/highest-seen markers, protected mark-unread and join boundaries. Legacy public mailbox summaries use markers. Conversions and metadata bootstrap checkpoint independent failures, retain IDs/closed state and block publication until reconciled. |
| Media and profiles | Actor/site-owned private staging, configured scanning and quarantine, atomic finalization, protected original/PNG thumbnail reads, executable format rejection and seven-day abandoned staging cleanup. Profile avatars reuse staging/scanning, have revision-protected publication and follow current profile visibility. Editing can detach post attachments atomically. |
| Discovery and delivery | Current-authority database search, stale legacy search-hit rechecks, safe snippets, canonical links/post locators, exact approved wiki binding, public RSS/Atom/sitemap and social metadata. Paged outbox recipients, channel deduplication/preferences, scoped email opt-out, bounded retries, uncertain-send reconciliation and named independent-item failures. |
| Operations | Readiness and health for authority/account configuration, mail, scanner, image/SSO package capability, outbox lag, delivery states and conversion jobs; checkpoint retry/cancel/resume and delivery reconciliation. No shared personalized/private response cache; visibility generations and polling refresh current projections. |

## Review fixes

An October 27 review of the S1 code corrected these before further work. Each has a spec.

| Area | Correction |
| --- | --- |
| Identity | A return path must be a plain local path (no control characters, so `/%09/host` cannot become `//host`), stored only after the action succeeds; redirects refuse control characters. Registration no longer stores a password before verification: the new account chooses it on the verification step, and a repeated request for an unverified address replaces the challenge rather than going silent. Remote sign-out always ends the local session. Every authority call carries the deployment secret; a delegated credential is refused from any other caller. Client secrets compare by digest. Authority rate limits use the browser address a registered client forwards. Delegations slide while in use, up to twelve hours. |
| Access | Help categories cannot be self-joined (which exposed every help thread). Only an operator, or an internal owner of the list, can bind an existing mailbox. Binding keeps internal list members' Comms access (read, post, named recipients, mentions, purpose) before publication. Staff suspensions and removals are not undone by rejoining. Staff sanction only lower-ranked parties, never themselves. |
| Integrity | Any edit rebinds a post's open reviews to the new revision. An omitted category field keeps its value, so a rename keeps the parent ceiling. Topic moves conflict only when either audience's policy revisions change. Search shows the current topic title, excludes unlisted topics, treats `%`/`_` literally and returns single-escaped snippets. An `around` window starts a few posts before its target. |
| Scale | Outbox preparation scans the parent author and topic/category/site watchers, not every site member, and keeps preparing within a time budget. Topic lists, search and mailbox summaries reuse access answers within one call. Public mailbox summaries count the 200 most recent topics. Idempotency and reading markers lock the actor's row, not the site or topic. Indexes cover attachment, review-target, notification, action-log, watcher, avatar, mailbox-topic and opt-out-expiry queries. |
| Delivery and operations | Notices link to the post, opt-out stops the scope that caused the mail, mounts at `/` produce correct URLs, and an interrupted in-app notice retries. Bootstrap runs, account cleanup and opt-out token cleanup isolate and name failures, with the error's first line. The generic REST catalogue `pass.rest.xml` was removed: the `PassApi` servlet is the only route to these services. |
| Screens | Notifications keep a read state, with an unread view and mark-all. Unsubscribe names what it stops and what it keeps. Member profiles show sanitized bios and the member's topics. Drafts, sanctions and deliveries have row actions that fill their forms. Posts have a Report link, and topic tools start at the current revision. Post headings are author and date. Composing waits for attachment scans. The editor is labelled, invitation links are absolute, and the CSP restricts scripts to the site. |

Local attachment downloads read the stored file into memory (bounded by the 10 MiB upload limit). Remote downloads stream through the frontend. Notification mail carries thread headers since S2 (below).

## Stage 2: full participation

S2 was built in five slices, each with its own spec, then a Comms parity and documentation pass.

| Area | Implementation |
| --- | --- |
| Topic participation | Site tags with normalized names, category limits that reveal no restricted category, counts over readable topics only, and merges that keep the old name as an alias. Idempotent reactions (no self-reactions) with counts cached on the post and topic for the Top view by period. Accepted answers in Q&A categories, chosen by the question author or a moderator, independent of closure and cleared when the reply is hidden or deleted. Polls with one ballot per party under the poll lock, choice limits, deadlines, results after voting/always/at close, optional voter names and optional vote changes. Private bookmarks with notes and reminders that become in-app notices. Post history with the framework line diff (`ec.resource.textDiff`), restore as a new revision through the edit path, wiki posts editable by basic-or-higher members, and author soft delete refused when replies depend on the post. |
| Moderation and trust | Versioned policy sections (posting, trust, moderation, private messages, media) that accept only values at least as strict as the defaults. Trust effects by level for daily topics/replies and per-post links, images and mentions; server-measured reading (topics entered, posts read, reading time, visiting days) feeds a checkpointed promotion job that never passes an owner lock or a recent sanction; owners set and lock levels. Word, pattern and link rules that block, hold for review, flag or censor, with a bounded test and refusal of backtracking patterns. Reports from two or more basic-or-higher members (policy-set) hide a post until staff decide. An after-commit classifier queue that only files review items and tolerates outages. Bulk decisions with per-item results, author appeals as linked review items, pins, unlisting, slow mode, topic timers rechecked when they fire, staff delete/restore, and move, split and merge that take whole reply subtrees, keep post IDs, renumber only the destination and leave a permalink for a merged topic. |
| Private conversations | Private topics with explicit participants and no category. Only current participants with active membership read them; site staff have no browsing path. Site policy and minimum trust gate new conversations; existing replies follow their own setting. Owners add members with a history confirmation, remove them and name owners; the last owner cannot leave others behind; archive is personal. Members mute or block others, which stops private contact and their notices. Reports on private posts show staff the post and the visible posts on either side; wider context needs a requested escalation approved by a site owner, and every view of private evidence is audited. Internal participants keep Comms receipts, public ones use markers, and private search is a separate opt-in scope. |
| Delivery preferences | Watch levels Muted, Normal, Tracking, Watching and Watching first post; email modes None, Notifications, Digest and Every post, resolved topic, category, then site, with opt-out suppression winning until the member chooses a mode again. Mentions notify readable members unless they muted the topic or the author; writing in a topic tracks it unless Watching is inherited. Mailing-list mode carries the sanitized post and, when asked, the member's own posts. A digest job prepares each due member's digest of currently readable topics, rechecked again at send, through the same retrying delivery path. Notices record their reason. |
| Email participation | `send#EmailTemplate` accepts `inReplyTo`, `references` and `replyToAddresses`, so replies thread under the member's earlier mail and carry a scoped reply address: a hashed, expiring token issued to that recipient for that thread. Operator-registered route domains, unique route addresses per category or for replies only. The `ForumInbound` email ECA takes the envelope recipient, requires one verified account address authenticated by the trusted gateway, matches tokens to their recipient, follows thread references, starts topics at category addresses, drops quoted history and signatures, stages and scans attachments, and posts as the sender through the web's gate in its own transaction. One receipt per message identity stops alias copies and replays. Automatic replies and the forum's own mail are ignored, delivery reports mark hard bounces and stop that member's email, members get a safe outcome notice, and staff can retry a failed message from the stored email. |
| Comms parity | Comms posts into bound categories already went through the forum gate; they now meet the same rules, trust limits, slow mode and review. Comms hides a private conversation from a removed internal participant and shows forum state (community topic or private conversation, answered, pinned) as chips in the Inbox thread header. |

New screens: Tags, Bookmarks, PostHistory, Messages (list and ConversationDetail). Topic detail, compose,
category detail and settings, policies, member moderation, review queue and detail, member profiles,
account settings, notifications, unsubscribe, search and mail settings gained the S2 forms above.

### S2 limits

- Private recipients are named members. Expanding an organization or group into a participant
  snapshot is not built, because PASS has no organization-group recipient source yet.
- The Regular trust threshold counts visiting days in total, not within a rolling 100 days.
- The BOSS moderation mount over the Mantle queue (§13.4) is not built; Comms shows forum state and
  posts through the shared gate.
- `replyToAddresses` is not kept on the stored EmailMessage (it has no Reply-To field), so sending a
  stored notice again would use the template's Reply-To. Forum notices are never re-sent that way.
- Inbound mail was exercised through the email ECA service with constructed header maps, not a
  live gateway, and digest/notice mail through captured mail.

## Screens

All 27 S1 screen definitions have their functional core in the dedicated public shell:

| Group | Screens |
| --- | --- |
| Reading and authoring | Topics, Categories, CategoryDetail, Search, Guidelines, TopicDetail, Compose, Drafts |
| Identity and personal settings | Login, SecondFactor, Register, Invitation, MemberDetail, Account Settings, Notifications, Unsubscribe |
| Moderation | ReviewQueue, ReviewDetail, MemberModeration, Moderation Log |
| Administration | Sites, SiteDetail, Category Settings, Members, Policies, Mail, Operations |

Forms use XML form widgets and native transitions. Reading pages render bounded server HTML with
ordinary links. Shared qvue stream/composer enhancement supplies the framework rich-text editor,
autosave, browser recovery, explicit conflict comparison, attachment staging and access polling.
The shell includes responsive layouts, keyboard skip navigation, focus targets and safe retry
states. Later-stage controls are absent.

## Verified checks

The following checks ran through the existing incremental development build with image support:

| Check | Result and coverage |
| --- | --- |
| Stage 2 (Oct 28) | 125/125 service features across 12 specs: the eight S1 specs plus Participation (11), Moderation (12), Conversations (11) and InboundMail (11), with Outbox extended to 13. An independent review of the whole S2 diff found ten defects; nine were fixed with checks (strict DMARC/DKIM alignment, no approval of a removed post, site-wide email stops over narrower modes, Comms replies to private conversations through the forum gate, suspended members' conversation lists, no classifier on private messages, trust contributions counted, long sanctions holding promotion, repeat-merge permalinks). 14/14 ForumHttp, including poll voting and revision compare in the enhanced stream and a private exchange between two members. 5/5 RemoteHttp with RemoteFixtures in a separate runtime, adding tags, bookmarks and a private message through the remote adapter. 1/1 Scale. Rust tests for `ec.resource.textDiff` and template thread and Reply-To fields. Screen lint with 0 parse failures. |
| Review re-run (Oct 27) | 72/72 service features, 12/12 ForumHttp, 4/4 RemoteHttp with RemoteFixtures in a separate runtime, 1/1 Scale, three `public_site` Rust tests, and screen lint with 0 parse failures. |
| Focused service suite | 62 features across Forum, ForumAccess, Media, PublicIdentity, SsoHandoff, Outbox, Mantle Mailboxes and BOSS InboxMailboxes. Covers policy ceilings/revocation, help threads, operation replay, moderation evidence, last owners, atomic rollback, profile media, marker conversion, exact-version wiki binding and isolated delivery failures. |
| Local browser suite | 10/10 ForumHttp checks: anonymous HTML/API agreement, host/site substitution, CSRF, phone layout, real rich-text editing and draft resume, concurrent replay/409 edits, keyboard focus, conflict comparison and failed-save recovery. |
| Separate remote runtimes | RemoteFixtures confirms no Mantle catalog or copied business accounts. 4/4 RemoteHttp checks cover anonymous reading, password/delegation/private drafts, multipart text/image publication/download/thumbnail/revocation, and avatar visibility. |
| JavaScript-disabled Chromium | Passed an explicit DevTools `Emulation.setScriptExecutionDisabled` smoke check. A probe script did not execute; the public index, topic body and ordinary post links remained readable with no page framework executing. |
| Scale | 1/1 opt-in Scale fixture with 10,000 posts and 100,000 category members: default 30-row windows, stable ordinal continuation/late windows, reply ordinal 10,001, paged recipient work and no public recipient-row fan-out. |
| Rust | Checked-service conflict regression, two public-route tests, six native SSO regressions and the type-generation golden fixture. |
| Screen validation | 981 screens scanned; zero expression/action/template parse failures; 817 Fancy template bodies compiled. Existing unrelated idiom/TUI advisories remain in the workspace lint output. |
| Source checks | XML/JavaScript formatting and Git whitespace checks on framework, Mantle and PASS changes. |

Service and browser specs use `moqui test` and `moqui test-client`; Node is not a test dependency.
The exact commands and remote runtime arrangement are in [Deployment](../docs/Deployment.md)
and the [README](../README.md). Expected negative security cases log failures during passing tests.
The shared fixture loader also reports the pre-existing BOSS demo CSV error and unavailable demo
SMTP server, logs their identities, and continues loading independent data.

## Deployment gates and scope

Configure real hostnames/TLS/proxy origins, authority credentials, verification/mail templates,
sender allowlists, providers, private storage, scanner bindings and scheduler outside source.
Readiness intentionally reports missing bindings/capabilities. Production SMTP, external IdP,
production scanner and domain/proxy integration were not exercised by the isolated fixtures.
Second-factor continuity and SSO handoff security have service coverage; the remote browser test
uses password authentication. Server-rendered reading was checked through HTTP, ordinary browser links and an explicit
JavaScript-disabled Chromium smoke check.

Search initially uses bounded database queries; mutable activity lists have deterministic tie
ordering rather than snapshot isolation across page requests. Search-provider-specific ranking
and production volume latency need deployment measurements. The tests above are verified cases,
not a claim that every permutation of the design's cross-site/access/provider matrix has run.

S3 remains deferred: integrations, imports, exports/retention and advanced reports. The framework wiki remains the authoring/versioning authority for S1 site pages.
