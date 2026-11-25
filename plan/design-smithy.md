# IronStone PASS: Smithy design

Nov 13, 2026 · Design, revised the same day from its review. DG1 is being built against it: the framework's F1 and
F2, mantle's entities, seed data and reads, and pass's routes and pages are in the working trees, not committed. This
is phase DG0 of [Dogfood](../../../../../plans/Dogfood.md#13-phases): the
page-by-page design of **Smithy**, the public git hosting app of mr-pass. Its rules and entities are in mr-mantle
(package `mantle.smithy`), and the framework stays the git host (Dogfood D2, D3). The phases DG1 to DG8 and DG10 build
against this document, in three lanes at once (the framework, mr-mantle, mr-pass), so it is a contract: the entity
fields of [§14](#14-data-model), the operations of [§15](#15-service-and-api-catalog) and the URL grammar of
[§4](#4-deployment-names-and-urls) are exact. What a later phase may still refine is marked "refined in its phase".

Dogfood fixes the decisions (D1 to D19) and this document does not reopen them. DG9 (production and cutover) is not
built. Questions 6, 8, 9, 10 and 12 of [Dogfood §16](../../../../../plans/Dogfood.md#16-risks-and-open-questions) take
the plan's proposal ([§20](#20-decided)). The inventories of the outside systems are named, empty tables in
[§18](#18-inventories-and-migration), filled before DG9.

**Inputs:** [Dogfood](../../../../../plans/Dogfood.md) §5 to §10, §12 and §13; [Forum design](design-forum.md) §1,
§4, §5, §10, §13.1, §14 and §15, whose form this document copies; [Deployment](../docs/Deployment.md) "Adding an app";
[Practices-App-Dev](../../../../../docs/dev/Practices-App-Dev.md);
[Git-Hosting](../../../../../docs/interfaces/Git-Hosting.md);
[impl-projects §9](../../mr-boss/plan/impl-projects.md#9-addendum-the-client-portal-in-mr-pass); and the code named in
[§3](#3-what-exists-and-is-reused). A name in this document is an existing one only where §3 or §14.1 says so; every
other entity, service, operation, field and screen is **new**.

**Sections:** [1 shell](#1-shell) · [2 screens](#2-screens) · [3 what exists](#3-what-exists-and-is-reused) ·
[4 deployment, names and URLs](#4-deployment-names-and-urls) · [5 access](#5-access) ·
[6 groups and discovery](#6-groups-and-discovery-screens) · [7 code](#7-code-screens) · [8 issues](#8-issues) ·
[9 merge requests](#9-merge-requests-forks-and-editing) · [10 pipelines](#10-pipelines-and-deploys) ·
[11 settings and account](#11-settings-account-and-import) ·
[12 conversations and moderation](#12-conversations-the-gate-and-moderation) · [13 the site](#13-the-site) ·
[14 data](#14-data-model) · [15 operations](#15-service-and-api-catalog) · [16 needs](#16-framework-and-data-needs) ·
[17 outputs](#17-documents-and-outputs) · [18 inventories](#18-inventories-and-migration) ·
[19 validation](#19-validation) · [20 decided](#20-decided) · [21 open](#21-open).

## 1. Shell

Root screen `screen/Smithy.xml`, a `subscreens-item` of `screen/Pass.xml`, shown under the site's brand; icon
`sym_o_construction`. Smithy registers as the app `smithy` ([§4.1](#41-registration)). It may be a site's root app, as
Forum and Shop may. Its default mount is `/code`; on moqui.org it mounts at `/`. `B` below is the mount's base path
(empty at `/`).

Smithy uses PASS's public shell (`screen/Shared/Page.html.fancy`, `Header.html.fancy`, `Footer.html.fancy`), with its
own branch of the header's navigation. There is no BOSS drawer and no terminal form. A public account has only the
automatic `ALL_USERS` group; Smithy's roles are rows in data ([§5](#5-access)).

Navigation, depth two:

- Site header: brand (to `B/`), Explore, Forum (when the site mounts it), Docs (the home group's documentation
  repository, when set), the search box, New (group, repository; signed in only), and the account control (Sign in and
  Register, or the Account hub, Git access and Sign out).
- A group's shell: the breadcrumb `group / subgroup`, the visibility chip, and the tabs Overview, Repositories, Issues,
  Forum, Members, Settings. A tab the caller may not use is absent.
- A repository's shell: the breadcrumb `group / subgroup / repository`, the visibility chip, an Archived or Mirror
  chip, the clone box (HTTPS and SSH addresses, the page URL first), Fork with its count, and the tabs Files, Commits,
  Branches, Tags, Issues, Merge requests, Pipelines, Releases, Docs, Forum, Settings. A feature turned off
  (`SmithyRepository.issuesEnabled` and its siblings) removes its tab and makes its pages Not Found.
- A personal namespace (`B/<handle>`) has one page: the account's public profile card and its repositories.

Rules for every page:

- Public pages are server-rendered HTML with ordinary links and bounded lists, readable without JavaScript. A `.qvue`
  island enhances a page where the screen's subsection says so: the diff with line comments, the composer, the code
  editor, the live job log. The page under an island is the same authorized projection.
- A form posts to a transition of `Smithy/Do` ([§4.4](#44-the-url-grammar)) with the session token, and the transition
  calls `pass.Facade.call#Operation`. A page never calls a Mantle or framework service directly.
- What the caller may not see is Not Found, with the same page as a path that does not exist. A signed-out caller sees
  a Sign in link in the header, never a hint that the path exists.
- Every page works at 390 px and on the desktop. On a phone the tabs are one scrolling row, the clone box and the
  secondary columns collapse, and code scrolls sideways inside its block, never the page.
- Rendered text (Markdown and rich text) passes `StringUtilities.cleanHtml`, as forum posts do. Code is highlighted by
  the framework's code widgets (`/js/WebrootCode.js`, loaded before `WebrootPublic.qvt.js` mounts).
- Localization, time zone, light and dark colors and reduced motion follow the framework, as Forum's pages do.

## 2. Screens

**Scope and stages:** every row is `new`. The stage is the Dogfood phase that first builds the screen; a later phase
that adds to it is named after a slash. Paths are relative to mr-pass `screen/`. Each row has one definition in §6 to
§13. `Context` is what the route resolver gives the screen as `screenParameters`.

| Screen | Path | Archetype | Impl | Purpose | Main record | Reused | Roles | Scope/stage | Context |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Home | Smithy/Home | landing | html | The home group's page, or Explore when the site has none | SmithySite, SmithyGroup | GroupOverview | anyone | new DG1/DG7 | site |
| Explore | Smithy/Explore | list | html | Groups, repositories and components, with a search | SmithyGroup, SmithyRepository | own | anyone | new DG1/DG7 | site, query |
| Search | Smithy/Search | list | html | One box over the public projections | search projections | Forum search projection | anyone | new DG7 | site, query, scope |
| NewGroup | Smithy/New/Group | editor | html | Create or request a group, or a subgroup | SmithyGroup | own | confirmed account | new DG2 | site, parent group |
| NewRepository | Smithy/New/Repository | editor | html | Create a repository in a group or in the account's namespace | SmithyRepository | own | confirmed account | new DG2 | site, namespace |
| AccountDetail | Smithy/AccountDetail | detail | html | A personal namespace: profile card and repositories | PublicSiteProfile, SmithyRepository | Members/MemberDetail card | anyone | new DG1 | site, handle |
| GroupOverview | Smithy/GroupDetail/Overview | landing | html | Landing text, pinned repositories, news, releases, activity | SmithyGroup | Docs renderer (DG7) | viewer | new DG1/DG7 | site, group |
| GroupRepositories | Smithy/GroupDetail/Repositories | list | html | The group's repositories and subgroups | SmithyRepository | own | viewer | new DG1 | site, group |
| GroupIssues | Smithy/GroupDetail/Issues | list | html | Issues across the group's repositories | SmithyIssue | Issues list | viewer | new DG3 | site, group, filters |
| GroupMembers | Smithy/GroupDetail/Members | list | html | Members and their roles | SmithyGroupParty | own | viewer; Owner edits | new DG1/DG2 | site, group |
| GroupSettings | Smithy/GroupDetail/Settings | settings | html | General, Agreement, Forum, Pipelines, Quota, Import, Delete | SmithyGroup | own | Owner | new DG2/DG4 to DG8 | site, group, tab |
| GroupForum | Smithy/GroupDetail/Forum | list | html + qvue | The forum's pages in the group's scope | ForumCategory | Forum screens, Shared/View.js | category reader | new DG6 | site, group, forum path |
| Files | Smithy/RepositoryDetail/Files | detail | html | Tree at a ref, README, last commit | GitRepository tree | m-file-tree | viewer | new DG1 | site, repository, refPath |
| Blob | Smithy/RepositoryDetail/Blob | detail | html | A file: text, rendered Markdown, image, or a download link | git blob | m-code-editor read only | viewer | new DG1 | site, repository, refPath |
| Blame | Smithy/RepositoryDetail/Blame | detail | html | A file with the commit of each line | git blame | own | viewer | new DG1 | site, repository, refPath |
| Edit | Smithy/RepositoryDetail/Edit | editor | html + qvue | Edit, new file, rename, delete, upload; the save is a commit | git blob | m-code-editor | confirmed viewer | new DG4 | site, repository, refPath, action |
| Commits | Smithy/RepositoryDetail/Commits | list | html | History of a ref or a path, with checks | git log | own | viewer | new DG1/DG5 | site, repository, refPath |
| Branches | Smithy/RepositoryDetail/Branches | list | html | Branches, ahead and behind, protection | GitRef | own | viewer; Developer acts | new DG1/DG2 | site, repository |
| Tags | Smithy/RepositoryDetail/Tags | list | html | Tags and their releases | GitRef | own | viewer; Developer acts | new DG1/DG2 | site, repository |
| CommitDetail | Smithy/CommitDetail | detail | html | A commit: message, files, diff, checks, linked items | git commit | m-diff-view | viewer | new DG1/DG3/DG5 | site, repository, commitId |
| Compare | Smithy/Compare | detail | html | Two refs: commits and diff; opens a merge request | git compare | m-diff-view | viewer | new DG1/DG4 | site, repository, base, head |
| Issues | Smithy/RepositoryDetail/Issues | list | html | A repository's issues | SmithyIssue | own | viewer | new DG3 | site, repository, filters |
| NewIssue | Smithy/NewIssue | editor | html + qvue | File an issue, confidential or not | SmithyIssue | Forum composer | confirmed viewer | new DG3 | site, repository |
| IssueDetail | Smithy/IssueDetail | detail | html + qvue | An issue and its conversation | SmithyIssue + ForumTopic | Forum post stream and composer | viewer | new DG3 | site, repository, issueNumber |
| Labels | Smithy/RepositoryDetail/Labels | list | html | Labels of the repository's project | WorkEffortCategory | own | viewer; Maintainer edits | new DG3 | site, repository |
| Milestones | Smithy/RepositoryDetail/Milestones | list | html | Milestones with their issues' progress | WorkEffort milestone | own | viewer; Maintainer edits | new DG3 | site, repository, milestoneId |
| MergeRequests | Smithy/RepositoryDetail/MergeRequests | list | html | A repository's merge requests | GitMergeRequest | own | viewer | new DG4 | site, repository, filters |
| NewMergeRequest | Smithy/NewMergeRequest | editor | html + qvue | Open a merge request from a branch or a fork | GitMergeRequest | Compare, Forum composer | confirmed viewer | new DG4 | site, repository, base, head |
| MergeRequestOverview | Smithy/MergeRequestDetail/Overview | detail | html + qvue | Conversation, reviewers, checks, agreement, merge | GitMergeRequest + SmithyMergeRequest | Forum post stream | viewer | new DG4 | site, repository, mergeRequestNum |
| MergeRequestCommits | Smithy/MergeRequestDetail/Commits | list | html | The commits of the merge request | git log | Commits rows | viewer | new DG4 | the same |
| MergeRequestChanges | Smithy/MergeRequestDetail/Changes | detail | qvue + html | The diff with line comments | git diff + anchors | m-diff-view | viewer | new DG4 | the same, path |
| MergeRequestChecks | Smithy/MergeRequestDetail/Checks | list | html | Statuses and pipeline runs of the head | GitCommitStatus | Pipelines rows | viewer | new DG4/DG5 | the same |
| Fork | Smithy/RepositoryDetail/Fork | editor | html | Fork into a namespace; the repository's forks | SmithyRepository | own | confirmed viewer | new DG4 | site, repository |
| Pipelines | Smithy/RepositoryDetail/Pipelines | list | html | Pipeline runs | GitPipelineRun | own | viewer | new DG5 | site, repository, filters |
| PipelineDetail | Smithy/PipelineDetail | detail | html + qvue | Jobs, a job's log as it runs, failed tests, artifacts | GitPipelineRun, GitJobRun | own | viewer | new DG5 | site, repository, runNum, jobRunId |
| Releases | Smithy/RepositoryDetail/Releases | list | html | Releases with notes and assets | Mantle release | own | viewer | new DG7 | site, repository |
| ReleaseDetail | Smithy/ReleaseDetail | detail | html | One release: notes, assets, checksums | Mantle release, SmithyReleaseAsset | own | viewer; Maintainer edits | new DG7 | site, repository, tag |
| Docs | Smithy/RepositoryDetail/Docs | detail | html | `docs/` rendered at a branch or tag | git blob | Markdown renderer | viewer | new DG7 | site, repository, refPath |
| RepositoryForum | Smithy/RepositoryDetail/Forum | list | html + qvue | The forum's pages in the repository's scope | ForumCategory | Forum screens, Shared/View.js | category reader | new DG6 | site, repository, forum path |
| RepositorySettings | Smithy/RepositoryDetail/Settings | settings | html | General, Members, Branch rules, Webhooks, Mirrors, Pipelines, Agreement, Forum, Archive | SmithyRepository, GitBranchRule, GitWebhook | own | Maintainer; Owner for some tabs | new DG2/DG4 to DG8 | site, repository, tab |
| ScopeModeration | Smithy/Moderation | list | html | The forum's review queue and log in a group's or a repository's scope | ForumReviewItem | Forum/Moderation screens | Owner of the scope | new DG6 | site, group or repository |
| SiteSettings | Smithy/Site | settings | html | Who may create, default quotas, group requests, redirects | SmithySite | own | site owner, operator | new DG2/DG7 | site, tab |
| GitAccess | Account/GitAccess | settings | html | SSH keys and access tokens; a card of the Account hub | UserSshKey, login keys | Account hub | self | new DG2 | site, self |
| Import | Smithy/Import | wizard | html | Import a GitHub repository's issues and pull requests | SmithyImportRun | own | operator, group Owner | new DG8 | site, group, importId |
| Do | Smithy/Do | task | xml | Transitions only: every form of the app posts here | none | own | by operation | new DG1 | site, returnTo |

45 rows. Dogfood §5.4 names fewer: its GroupDetail, RepositoryDetail, MergeRequestDetail and Settings are the tab
groups above, and SiteSettings, AccountDetail, ScopeModeration, Labels, Milestones, Fork, NewGroup, NewRepository,
NewMergeRequest, Search and Do are this design's additions.

## 3. What exists and is reused

Paths: **fw** is `runtime/components/base/framework/`, **mantle** is `runtime/components/addon/mr-mantle/`, **pass** is
this component, **boss** is `runtime/components/addon/mr-boss/`. Each row was read for this design.

| Ref | Where | What it gives Smithy |
| --- | --- | --- |
| R1 | mantle `service/mantle/public/PublicApps.js` | `apps` (the registry: `root`, `onePerSite`, `target`, `readiness`, `accountCard`), `reservedPaths`, `mount`, `pageUrl`. Smithy adds its entry and reads `reservedPaths` for the name set. |
| R2 | pass `service/pass/Apps.js`, `Schema.js`, `Routes.js`, `RouteServices.xml` (`resolve#Route`), `Facade.xml` (`call#Operation`), `Transport.js` | The app registry, the operation and route tables, the resolver that picks the longest mount and gives `screenPath` and `screenParameters`, and the facade every page calls. |
| R3 | mantle `service/mantle/forum/ForumCore.js` | `fail(kind, message)`, `missing()`, `invalid()`, `requireUser()`, `site(id, staff)`, `member`, `isOperator`, `sanctioned`, `categoryAccess` (the evaluator), `category`, `topic` (which branches on `ForumTopic.kind`), `receipt` (idempotent writes by `operationId`), `revision`, `review`, `audit`, `systemAudit`, `staff`, `policy`, `trustLevel`. `SmithyCore.js` is written on this model and calls these. |
| R4 | mantle `service/mantle/forum/Forum.js` | `methods.publishPost` (the checks the gate is extracted from, [§12.2](#122-the-post-gate)), `applyRules`, `TRUST_EFFECTS`, the handle rule of `storeProfile` (`^[a-z0-9][a-z0-9_-]{2,31}$`). Every topic list filters `kind: 'category'`. |
| R5 | mantle `service/mantle/forum/ForumSchema.js`, `script/PassRoutes.js`, `script/PassApi.js`, `script/PassAuthority.js` | Mantle's copies of the operation and route tables, `TOKEN_WRITES` and the refusal `REASONS`. |
| R6 | mantle `entity/PublicEntities.xml` | `PublicSite`, `PublicSiteHost`, `PublicSiteApp`, `PublicSiteParty`, `PublicSiteProfile` (`handle`, unique per site), `PublicAccessGrant`, `PublicDiscussionLink`. |
| R7 | mantle `entity/ForumEntities.xml` | `ForumCategory`, `ForumTopic` (`kind`, `contactListId`, `unlisted`), `ForumPostState`, `ForumPostRevision` (`sourceFormat`, `sourceText`), `ForumReviewItem` (`targetType`, `targetId`, `contactListId`), `ForumModerationAction`, `ForumSanction`, `ForumMemberState`, `ForumRule`, `ForumMailRoute`, `ForumOperationReceipt`, `ForumImportRun`, `ForumImportMap`, `ForumLegacyUrl`, the view `ForumPostSearch`. |
| R8 | mantle `service/mantle/work/GitServices.xml` | `check#GitRepositoryAuthz` (the one check, extended in [§5.4](#54-the-one-check)), `get#RepositoryProjects`, `find#TaskReferences`, `apply#CommitKeywords`, `link#MergeRequestItems`, `handle#MergeRequestEvent`, `create#ReviewComment`, `store#ReviewAnchor`, `resolve#ReviewThread`, `get#ReviewThreads`, `refresh#ReviewAnchors`, `create#ProjectRepository`, `add#ProjectRepository`. |
| R9 | mantle `entity/WorkEffortEntities.xml`, `PartyEntities.xml` | `WorkEffortGitRepository`, `WorkEffortGitCommit`, `WorkEffortGitMergeRequest`, `WorkEffortGitRef`; `WorkEffort.visibilityEnumId` (`WevGeneral`, `WevConfidential`), `resolutionEnumId` (`WerCompleted`, `WerWontComplete`, `WerDuplicate`), the statuses `WeInPlanning` to `WeCancelled`; `WorkEffortCategory` of type `WcatLabel`; `WetMilestone`, `WetRelease`; `CommunicationEventGitAnchor`. |
| R10 | fw `service/org/moqui/git/GitServices.xml` | `get#GitRefs`, `get#GitLog`, `get#GitCommit`, `get#GitCommitDiff`, `get#GitBlob`, `get#GitTree`, `get#GitCompare`, `get#GitCloneUrls`, `get#GitCommitStatuses`, `create#GitCommitStatus`, `get#GitRepositoryAccess`, `find#GitRepositories`, `init#GitRepository`, `update#GitRepository`, `archive#GitRepository`, `unarchive#GitRepository`, `create#GitRef`, `delete#GitRef`, `commit#GitFiles` (default branch only today), `get#GitBranchRules`, `store#GitBranchRule`, `delete#GitBranchRule`, `find#GitWebhooks`, `store#GitWebhook`, `delete#GitWebhook`, `test#GitWebhook`, `find#GitWebhookDeliveries`, `push#GitMirror` (SSH, one mirror a repository). |
| R11 | fw `service/org/moqui/git/GitReviewServices.xml` | `create#MergeRequest`, `get#MergeRequest`, `update#MergeRequest`, `set#MergeRequestReviewers`, `submit#MergeRequestReview` (`approve`, `request_changes`, `comment`), `close#MergeRequest`, `reopen#MergeRequest`, `merge#MergeRequest`, `find#MergeRequests`, `get#MergeRequestDiff`, `check#MergeRequest`. |
| R12 | fw `entity/ResourceEntities.xml` | `GitRepository` (`repositoryKind`, `storedBytes`, `archivedDate`, `pushMirrorRemoteId`), `GitRef`, `GitUpdate`, `GitCommitStatus`, `GitWebhook`, `GitBranchRule`, `GitMergeRequest` (`mergeRequestNum`, `statusId` `GmrDraft`, `GmrOpen`, `GmrMerged`, `GmrClosed`), `GitMergeRequestReviewer`, `GitLfsObject`. |
| R13 | fw `data/SecurityTypeData.xml`, mantle `data/MantleSetupData.xml` | `AT_GIT_REPOSITORY` (view to clone, fetch and read; create and update to push new refs and fast-forwards; delete to force a push or delete a ref); the `ALL_USERS` grant on the `GitRepositories` group whose `authzServiceName` is `check#GitRepositoryAuthz`; the `SSH_GIT` permission. |
| R14 | fw `service/org/moqui/impl/UserServices.xml` | `create#UserSshKey`, `delete#UserSshKey`, `create#UserAccessToken`, `revoke#UserAccessToken`. No list service was found; DG2 adds one. |
| R15 | boss `screen/Projects/Code/` | `Repositories`, `RepositoryDetail` (Files, Commits, Branches, Tags, Activity, Settings), `CommitDetail`, `Compare`, `MergeRequests`, `MergeRequestDetail` (Overview, Commits, Changes with `Changes.qvue`), `GitAccess`: the internal screens Smithy's pages mirror. Neither app depends on the other (D3). |
| R16 | fw `webroot/screen/webroot/js/WebrootCode.js`, `WebrootPublic.qvt.js` | The code widgets (`m-diff-view`, `m-file-tree`, `m-code-editor`) and the public shell's script. |
| R17 | mantle `service/mantle/public/AccountHub.js` | `emailVerified()`: the account's current address has a `moqui.security.public.VerifiedAddress` row with `verifiedAt`. The same check is copied in `Forum.js` (without `verifiedAt`), `ExternalAccess.js`, `StoreTopics.js`, `CartRecovery.js`, `StoreOperations.js`, `DeliveryWorker.js` and `ForumImport.js`; one shared helper replaces the copies ([§5.5](#55-the-confirmed-address-d17)). The row is written only by the framework's registration verify (`org/moqui/public/Account.js`). |

Not found in the code, and so a need of [§16](#16-framework-and-data-needs): a blame service, a service that gives a
tree as a zip or tar archive (`archive#GitRepository` archives the repository, it does not download it), a
`delete#GitRepository`, a list of an account's SSH keys and tokens, a service for a repository's and its LFS files'
usage, a `commit#GitFiles` that writes to a branch other than the default, and anything of forks, `refs/for` or
pipelines.

In progress when this was revised (DG1, uncommitted): the framework's `repositoryPath`, `set#GitRepositoryPath`,
`GitRepositoryPathRedirect` and anonymous read; mantle `entity/SmithyEntities.xml`, `data/SmithySetupData.xml`,
`service/mantle/smithy/` (`Smithy.js`, `SmithyCore.js`, `SmithySchema.js`, `SmithyServices.xml`) and
`service/mantle/public/ConfirmedAddress.js`; pass `service/pass/SmithyRoutes.js`, `SmithySchema.js` and
`screen/Smithy/`. Where this document and that code name the same thing, the names are the code's.

## 4. Deployment, names and URLs

### 4.1 Registration

By [Deployment](../docs/Deployment.md) "Adding an app":

| Place | Entry |
| --- | --- |
| mantle `PublicApps.js` `apps` | `smithy: { root: true, onePerSite: true, readiness: 'mantle.smithy.SmithyServices.check#AppReadiness', accountCard: 'mantle.smithy.SmithyServices.get#AccountCard', scope: 'component://mr-mantle/service/mantle/smithy/SmithyScope.js' }`. No target: Smithy is bound to no business record. `scope` is new ([§12.1](#121-where-a-conversation-lives-question-3)). |
| pass `service/pass/Apps.js` | `smithy: { screen: 'Smithy', base: '/code' }` |
| pass `screen/Pass.xml` | a `subscreens-item` named `Smithy` |
| pass `screen/Shared/Header.html.fancy` | the Smithy branch of the navigation ([§1](#1-shell)) |
| pass `Schema.js`, `Routes.js`, `service/pass/SmithySchema.js`, `service/pass/SmithyRoutes.js`; mantle `service/mantle/smithy/SmithySchema.js`, `script/PassRoutes.js` | the operations of [§15](#15-service-and-api-catalog). pass keeps an identical copy of mantle's `SmithySchema.js`, merged into `Schema.js`, and a spec keeps the copies identical. `SmithyRoutes.js` is the page resolver's Smithy branch (§4.4). |
| `TOKEN_WRITES` (pass `Transport.js`, mantle `PassApi.js`, `PassAuthority.js`) | none: Smithy has no bearer-link write ([§15](#15-service-and-api-catalog)) |
| `REASONS` (mantle `PassAuthority.js`) and pass `screen/Shared/Portal.js` `reasons` | `addressUnconfirmed`, `nameTaken`, `nameInvalid`, `quotaExceeded`, `limitReached`, `repositoryArchived`, `agreementUnsigned`, `checksRequired`, `squashFoldsSignature`, `fileChanged`, `notEditable`, `policyRefused` |
| pass `test/MoquiConf.xml` | `<mount path="/code" screen="Smithy"/>` on `PASS_HTTP`, and a site `SMITHY_ROOT` on host `smithy.localhost` with Smithy at `/`, Forum at `/forum` and Account at `/account` |
| the runtime's `<public-site>` | `<mount path="/" screen="Smithy"/>` on moqui.org |

Mantle services are in `service/mantle/smithy/`: `Smithy.js` (`methods.*` and `execute(name, input)`),
`SmithyCore.js` (names, the access evaluator, the path resolver), `SmithyScope.js` (what the forum asks of Smithy),
`SmithySchema.js`, `SmithyServices.xml` (one `{input}` to `{result}` wrapper an operation, as `ForumServices.xml`),
and from DG3 `SmithyIssues.js` with `SmithyIssueServices.xml`, DG4 `SmithyReview.js` and `SmithyAgreement.js` with
their service files, DG5 `SmithyPipelines.js`, DG7 `SmithySite.js`, DG8 `SmithyImport.js` (the service files are
named in [§15.1](#151-common-contract)). The gitECA rules are in mantle `service/Smithy.gitecas.xml`.

**One authority.** Smithy runs where the git data is (D1). Its operations still go through the facade, so the pages
are the same on a remote frontend later (Dogfood §15), but DG1 to DG10 test the local authority only.

**Seeding (DG1).** DG1's sixteen operations are reads. Groups and repositories are made in DG1 by two services that
are not operations, for operators, seed data and specs (`mantle.smithy.SmithyServices`, built):

- `create#Group` (`siteId`, `parentGroupId`, `pathSegment`, `name`, `description`, `visibility`; out `groupId`,
  `groupPath`): an active group. A top-level one is made by the site's owners and operators, a subgroup by an Owner of
  the parent. The caller gets an `SmrOwner` row (`SmithyGroupParty`). DG2's `requestGroup` and `createSubgroup` add the
  policy on top of it.
- `create#Repository` (`siteId`, `groupId`, `slug`, `name`, `description`, `visibility`, `repositoryId`,
  `repositoryKind`, `branch`; out `repositoryId`, `repositoryPath`): a new hosted repository, or, with `repositoryId`,
  the **bind** of a `GitRepository` that is there and has no Smithy row, of any kind, a `remote` mirror included (an
  operator only). It sets the path through `set#GitRepositoryPath`. This is how DG1 shows mirrors of GitHub. DG2's
  `createRepository` adds the policy, the quotas and the README. No separate bind service is needed.
- `SmithySite` is DG1's: `getSmithyHome` reads it, and the row is made with its defaults on the first read.
- A group's category (§12.5) is made from DG3, when the conversation needs its scope: `ensure#GroupCategory` makes it
  for a new group and, on first need, for a group made before DG3. DG1 and DG2 leave `contactListId` empty.

**The site rule.** Every operation takes `siteId` from the route. An input id (`groupId`, `repositoryId`, an import,
a redirect) whose row has another `siteId` is Not Found, as a row that does not exist.

**One instance, one name space for repositories.** `GitRepository.repositoryPath` is unique in the instance. Group
paths are unique in a site. A path a second site of the same instance has taken is `nameTaken` for the first.

### 4.2 The name set

A site has one set of first-segment names. In it are:

- the path of every top-level `SmithyGroup` of the site, in any state but refused;
- every `PublicSiteProfile.handle` of the site (a handle is a personal namespace, whether or not it has a repository);
- every entry of `PublicApps.reservedPaths`, compared without case;
- the first path segment of every `PublicSiteApp.pathPrefix` of the site, enabled or not;
- the first path segment of every site page's route (`PublicSitePage`, its mount's base and `pages/…`) and of every
  site redirect's path (`SitePages.js`), and the word `pages`;
- Smithy's own words, `SmithyCore.reservedNames`: `forum`, `account`, `members`, `sites`, `billing`, `supplier`,
  `support`, `shop`, `code` (the apps' default bases, kept here because Mantle does not read pass `Apps.js`; a pass
  spec fails when `Apps.js` has a base the list lacks), `explore`, `search`, `new`, `import`, `git`, `admin`, `api`,
  `help`,
  `about`, `docs`, `news`, `releases`, `security`, `settings`, `login`, `logout`, `register`, `robots.txt`,
  `sitemap.xml`, `favicon.ico`, `addons.xml`;
- the old first segment of an unexpired `SmithyPathRedirect`, for anyone but the party it belongs to.

Segments:

| Segment | Rule | Notes |
| --- | --- | --- |
| A handle | `^[a-z0-9][a-z0-9_-]{2,31}$` | as `storeProfile` checks today |
| A group's or subgroup's `pathSegment` | `^[a-z0-9][a-z0-9_-]{1,38}$` | a handle is always a valid group segment |
| A repository's `slug` | `^[a-z0-9_][a-z0-9_.-]{0,99}$`, with no `..`, not ending in `.`, `.git`, `.lock` or `.atom` | `SmithyRepository.name` keeps the case as typed (`PopCommerce`) |

- Every stored path is lower case. The page resolver lowers a request path before it looks it up, so
  `https://moqui.org/moqui/PopCommerce` finds `moqui/popcommerce` and is redirected to the stored case. The framework
  resolves a git path exactly first and then lower-cased (F2), so `git clone https://moqui.org/moqui/PopCommerce`, the
  name on GitHub, finds the same repository.
- Every Smithy path is also a valid framework path (`set#GitRepositoryPath`: one to eight segments of letters, digits,
  `.`, `_` and `-`, none starting with `.` or `-` or ending in `.git` or `.lock`).
- No segment begins with `-`, so `-` is never a name, and `/-/` always starts a section.
- Within one group, subgroup segments and repository slugs are one set: `moqui/addons` is a subgroup or a repository,
  never both. So is a personal namespace's set of slugs.
- Subgroups nest to four levels (`a/b/c/d`), so a repository path has two to five segments. A personal namespace has
  no subgroups.
- **Who checks.** `SmithyCore.nameFree(siteId, name, forPartyId)` is the one check. `create#Group`, `requestGroup`,
  `renameGroup` and Forum's `storeProfile` (a new or changed handle) call it, each after locking the site's
  `PublicSite` row, so a handle and a group path cannot be taken at the same time. `SitePages.js` refuses a page route
  or a redirect whose first segment is a group's path or a handle, by the same function. Every source of the set is
  read in Mantle.
- **Imported logins.** A GitHub login that is not a valid handle (1 or 2 characters, 33 to 39, or a taken name) gets
  the placeholder handle `gh-<login>`, cut to 32 characters, with a digit suffix when that is taken (DG8, §18.2).
- **Display.** A name's text (a group's name, a repository's name and description) is checked by the forum's rules as
  a post's text is ([§12.2](#122-the-post-gate)).

### 4.3 Rename, transfer and redirects

- **A repository** is renamed (a new slug) or transferred (another group, or the caller's namespace) by
  `SmithyCore.setPath`: the framework's `set#GitRepositoryPath` (F2), which keeps the old path as a
  `GitRepositoryPathRedirect`, and `SmithyRepository` (`slug`, `groupId` or `ownerPartyId`, `repositoryPath`), in one
  transaction. `repositoryId` does not change.
- **A group** is renamed by changing its `pathSegment`: `groupPath` of the group and of every subgroup below it, and
  `repositoryPath` of every repository below it, change in the same transaction, each repository with its
  `GitRepositoryPathRedirect`. The group's old path becomes a `SmithyPathRedirect` (kind `group`).
- **A handle** that changes moves the personal namespace the same way, with a `SmithyPathRedirect` (kind `account`).
- **A redirect holds until the path is taken.** A new group, handle or repository may take a path that only a redirect
  holds, after 90 days for another party and at once for the party the redirect belongs to; the redirect row is then
  deleted. The 90 days are Smithy's rule, checked in `nameFree` and before `setPath` (the framework lets a repository
  take a redirected path at once). Pages answer 301 to the new path; git serves the repository at the old path (F2).
- **A transfer** needs Owner of the repository and, in the target, Maintainer of the group or the caller's own
  namespace. The repository's visibility is narrowed to the target group's when it was wider, and the page says so
  before the save.

### 4.4 The URL grammar

The resolver is the `smithy` branch of `pass.RouteServices.resolve#Route`. Input: the path after the mount's base.
The check `path.includes('..')` that the resolver makes for every app is, for a Smithy mount, a check that no segment
is `.` or `..`, since `compare/main...topic` is a Smithy path.

**Step 1. Segments.** Split on `/`, drop empty segments, percent-decode each once. More than 40 segments, a segment
longer than 255 bytes, or a control character is Not Found.

**Step 2. Fixed forms**, by the first segment:

| Path | screenPath | screenParameters |
| --- | --- | --- |
| (empty) | `/Smithy/Home` | none |
| `explore` | `/Smithy/Explore` | none |
| `new/group`, `new/repository` | `/Smithy/New/Group`, `/Smithy/New/Repository` | none (the namespace is a query parameter) |
| `import`, `import/<importId>` | `/Smithy/Import` | `importId` |
| `-/search` | `/Smithy/Search` (not `search`: the framework's `/search` proxy, a servlet of its default conf, takes that path on every host; the user's call) | none |
| `-/site`, `-/site/<tab>` | `/Smithy/Site` | `tab` of `settings`, `requests`, `quotas`, `redirects` |
| `-/do/<name>` | `/Smithy/Do/<name>` | none; `<name>` matches `^[a-z][A-Za-z]{1,60}$` |
| `-/island/<Name>.qvue` (also `.qvt`, `.qjs`) | `/Smithy/Islands/<Name>.qvue` (a subscreen of `Smithy/Islands`, which has no page of its own) | none; ids are query parameters |
| `robots.txt`, `sitemap.xml` | `/Smithy/robots`, `/Smithy/sitemap` (transitions of the root screen) | none |
| `-/held-report/<token>` | `/Smithy/Do/heldReport` (DG6; the link of a held report's reply, §12.4) | `token` |

**Step 3. Names and section.** Otherwise split the segments at the first segment that is exactly `-`: the **name
segments** before it and the **section segments** after it, which keep their case and are bounded only by step 1.

- With a `-`: one to five name segments, each valid by §4.2 after lowering, else Not Found.
- With no `-` and one to five segments that are all valid names after lowering (the last after a `.git` suffix is
  removed and remembered): they are the name segments, and there is no section.
- With no `-` otherwise (more than five segments, or a segment that is no valid name, such as `Cargo.lock` or
  `.gitignore`): only a compatibility form can match (lookup 5). Nothing is lowered or validated but the candidate
  prefix lookup 5 tries.

**Step 4. Resolve the names.** The resolver calls the operation `resolveSmithyPath` with the joined, lowered name
path. Mantle looks up, in this order:

1. `SmithyRepository.repositoryPath` equal to the path: a **repository**.
2. `SmithyGroup.groupPath` equal to the path: a **group**.
3. one segment equal to a `PublicSiteProfile.handle`: an **account**.
4. `GitRepositoryPathRedirect`, then `SmithyPathRedirect` by the longest prefix: a **redirect** to the new path with
   the rest of the request appended. The redirect's final target (the repository, group or account it now names) is
   resolved and view-checked first; a target the caller may not view is Not Found, with no 301, so an old path never
   confirms a private group or repository.
5. with no section and three or more segments: for k from the smaller of 5 and the segment count less one, down to 2,
   the first k segments, when each is a valid name after lowering and together they are a repository the caller may
   view, and the remaining segments (as they came, case kept) are a **compatibility form** (below): a redirect. The
   resolver (`SmithyRoutes.js`) tries each candidate prefix with `resolveSmithyPath`, whose input stays a name path;
   lookups 1 to 4 are Mantle's.
6. otherwise Not Found.

`/<group>/<subgroup>` and `/<group>/<repo>` are told apart by lookups 1 and 2 alone: sibling names are one set
(§4.2), so at most one of them finds a row. The operation applies the view check of [§5](#5-access), and what the
caller may not see is Not Found, exactly as a path with no row. It returns `kind`, `groupId` or `repositoryId` or
`handle`, `canonicalPath`, and `redirectPath` for a redirect.

A page request whose path was not in the stored case, or that had the `.git` suffix, is redirected (301) to
`B/<canonicalPath>` with its section. A redirect result is a 301 to `B/<redirectPath>`. Both are the `redirect`
transition of the root screen (`/Smithy/redirect`), given its location.

**Step 5. The section**, for a group:

| Section | screenPath | screenParameters besides `groupId`, `namePath` |
| --- | --- | --- |
| none | `/Smithy/GroupDetail/Overview` | |
| `repositories` | `/Smithy/GroupDetail/Repositories` | |
| `issues` | `/Smithy/GroupDetail/Issues` | |
| `members` | `/Smithy/GroupDetail/Members` | |
| `settings`, `settings/<tab>` | `/Smithy/GroupDetail/Settings` | `tab` of `general`, `agreement`, `forum`, `pipelines`, `quota`, `import`, `delete` |
| `forum`, `forum/<rest>` | `/Smithy/GroupDetail/Forum` | `forumPath` (the rest, parsed as Forum's own paths are: `t/<id>/<slug>`, `p/<id>`, a screen name) |
| `moderation`, `moderation/<rest>` | `/Smithy/Moderation` | `moderationPath` |
| `addons.xml` | `/Smithy/GroupDetail/addons` (a transition) | |

For an account, no section is allowed: `/Smithy/AccountDetail` with `handle`.

For a repository (`repositoryId` and `namePath` are always given):

| Section | screenPath | Other screenParameters |
| --- | --- | --- |
| none | `/Smithy/RepositoryDetail/Files` | `refPath` empty: the default branch, the root |
| `tree/<refPath>` | `/Smithy/RepositoryDetail/Files` | `refPath` |
| `blob/<refPath>` | `/Smithy/RepositoryDetail/Blob` | `refPath` |
| `raw/<refPath>` | `/Smithy/RepositoryDetail/raw` (a transition) | `refPath` |
| `blame/<refPath>` | `/Smithy/RepositoryDetail/Blame` | `refPath` |
| `edit/<refPath>`, `new/<refPath>`, `upload/<refPath>`, `delete/<refPath>` | `/Smithy/RepositoryDetail/Edit` | `refPath`, `editAction` of `edit`, `new`, `upload`, `delete` |
| `commits`, `commits/<refPath>` | `/Smithy/RepositoryDetail/Commits` | `refPath` |
| `commit/<id>` | `/Smithy/CommitDetail` | `commitId`, 7 to 40 hex digits |
| `compare`, `compare/<spec>` | `/Smithy/Compare` | `base`, `head`, `headRepositoryPath` |
| `branches`, `tags` | `/Smithy/RepositoryDetail/Branches`, `/Tags` | |
| `archive/<ref>.zip`, `archive/<ref>.tar.gz` | `/Smithy/RepositoryDetail/archive` (a transition) | `ref`, `format` |
| `issues` | `/Smithy/RepositoryDetail/Issues` | |
| `issues/new` | `/Smithy/NewIssue` | |
| `issues/<n>` | `/Smithy/IssueDetail` | `issueNumber` |
| `labels` | `/Smithy/RepositoryDetail/Labels` | |
| `milestones`, `milestones/<id>` | `/Smithy/RepositoryDetail/Milestones` | `milestoneId` |
| `merge-requests` | `/Smithy/RepositoryDetail/MergeRequests` | |
| `merge-requests/new` | `/Smithy/NewMergeRequest` | |
| `merge-requests/<n>` | `/Smithy/MergeRequestDetail/Overview` | `mergeRequestNum` |
| `merge-requests/<n>/commits`, `/changes`, `/checks` | `/Smithy/MergeRequestDetail/Commits`, `/Changes`, `/Checks` | `mergeRequestNum` |
| `fork`, `forks` | `/Smithy/RepositoryDetail/Fork` | |
| `pipelines` | `/Smithy/RepositoryDetail/Pipelines` | |
| `pipelines/<n>`, `pipelines/<n>/jobs/<jobRunId>` | `/Smithy/PipelineDetail` | `runNum`, `jobRunId` |
| `pipelines/deployments` (DG10) | `/Smithy/RepositoryDetail/Deployments` | |
| `pipelines/deployments/<deploymentId>` (DG10) | `/Smithy/DeploymentDetail` | `deploymentId` |
| `releases` | `/Smithy/RepositoryDetail/Releases` | |
| `releases/<tag>` | `/Smithy/ReleaseDetail` | `tag` (every remaining segment, joined with `/`) |
| `release-assets/<assetId>/<name>` | `/Smithy/ReleaseDetail/asset` (a transition) | `assetId` |
| `artifacts/<artifactId>/<name>` | `/Smithy/PipelineDetail/artifact` (a transition) | `artifactId` |
| `docs`, `docs/<refPath>` | `/Smithy/RepositoryDetail/Docs` | `refPath` |
| `forum`, `forum/<rest>` | `/Smithy/RepositoryDetail/Forum` | `forumPath` |
| `moderation`, `moderation/<rest>` | `/Smithy/Moderation` | `moderationPath` |
| `settings`, `settings/<tab>` | `/Smithy/RepositoryDetail/Settings` | `tab` of `general`, `members`, `branch-rules`, `webhooks`, `mirrors`, `pipelines`, `agreement`, `forum`, `archive` |

**Paths that are not screens.** A path marked "a transition" is a read-only GET transition of the screen it is under
(`RepositoryDetail` has `raw` and `archive`, `GroupDetail` has `addons`, `ReleaseDetail` has `asset`,
`PipelineDetail` has `artifact`, the root screen `Smithy.xml` has `robots` and `sitemap`). Each calls its download
operation through the facade and sends the bytes; none is a row of §2. `Smithy/Islands` is a screen with no page,
whose subscreens are the `.qvue` islands; it is no row of §2 either. `Smithy/Do` is §2's last row.

**`archive/<ref>`.** The remaining segments are joined, and the format suffix is removed from the end: `.tar.gz`,
else `.zip`. What is left must be exactly a branch, a tag or a commit id, with no path after it (the whole tree is
archived). A tag named `v1.zip` is `archive/v1.zip.zip`.

Any other section is Not Found. `<n>` is 1 to 9 decimal digits with no leading zero. An id is
`^[A-Za-z0-9_-]{1,40}$`, as Forum's and Shop's ids are checked.

**`refPath`: a ref with slashes.** `refPath` is every segment after the section word, joined with `/`: a ref name
followed by a path in the tree, with nothing in the URL that separates them. The resolver does not read git; the
Mantle read splits it (`SmithyCore.splitRefPath(repositoryId, refPath)`), and every operation that takes `refPath`
uses that one function:

1. Empty: the default branch and the root.
2. Take each prefix of the segments, longest first. The first prefix that is the name of a branch (`refs/heads/<p>`)
   or a tag (`refs/tags/<p>`) is the ref, a branch before a tag of the same name; the rest is the path.
3. Else, when the first segment is 7 to 40 hex digits and names one commit, that commit is the ref and the rest is the
   path.
4. Else Not Found.

Git allows no branch `a` beside a branch `a/b`, so step 2 is ambiguous only between a branch and a tag, where the
longer name wins. The result names the ref's kind (`branch`, `tag`, `commit`), its full name and its commit, and the
pages build links from the full name. `docs/<refPath>` splits the same way, and the path is then relative to the
repository's docs directory.

**`compare/<spec>`.** Join the segments and split at the first `...`: `base` and `head`. A head of the form
`<repositoryPath>:<ref>` names a fork's ref and gives `headRepositoryPath`. With no `...`, the spec is the head and the
base is the default branch. Both sides are ref names or commit ids; neither is split into a path.

**Compatibility forms** (lookup 5). `issues/<n>` and `pull/<n>` redirect to `-/issues/<n>` and
`-/merge-requests/<n>`; `pulls` to `-/merge-requests`; `tree/…`, `blob/…`, `commit/<id>`, `commits/…`, `releases`,
`releases/tag/<tag>`, `issues` to the same form after `/-/`. They serve a GitHub URL whose host a person has changed
to moqui.org, and the links the importer rewrites.

**Git.** Where Smithy is mounted at `/`, `/<repositoryPath>.git` and `/<repositoryPath>` are clone addresses: on a
public-site host the framework sends `…/info/refs?service=git-upload-pack` (and `git-receive-pack`),
`POST …/git-upload-pack`, `POST …/git-receive-pack` and `…/info/lfs/…` to the git handler before the resolver runs
(F2), by the path as it came. Under another mount (`/code`) a page's URL does not clone, and the clone box shows
`/git/<repositoryPath>.git`, which works on every host of the instance. A path is matched exactly, then lower-cased.
SSH is
`ssh://git@<host>/<repositoryPath>.git`. An old one-segment `repositoryId` and a redirected path are still served.
With no credentials a repository the anonymous user may not view answers 401, so git asks for a login; with
credentials it answers 404 (F1).

**Islands and forms.** A `.qvue` island is a screen under `Smithy/Islands`, reached at `B/-/island/<Name>.qvue` with
ids in the query, so a file path that ends in `.qjs` or `.qvue` is never mistaken for a render mode. Forms post to
`B/-/do/<name>`; each transition of `Smithy/Do` calls one operation and redirects to the form's `returnTo`, which must
be a path under the same mount.

## 5. Access

### 5.1 Roles and visibility

Enumerations (mantle, seed data; [§14.3](#143-enumerations-and-statuses)):

- Visibility, `SmithyVisibility`: `SmvPublic`, `SmvMembers`, `SmvPrivate`, in that order from widest to narrowest.
- Role, `SmithyRole`: `SmrGuest` (10), `SmrReporter` (20), `SmrDeveloper` (30), `SmrMaintainer` (40), `SmrOwner` (50).
  The number is the rank (`sequenceNum`), and a higher rank holds everything a lower one does.

**Effective visibility** of a repository is the narrowest of its own `visibilityEnumId` and that of every group above
it. A write that would store a repository or a subgroup wider than its parent is refused (`policyRefused`), and the
evaluator still takes the narrowest, so bad data fails closed. A fork is no wider than its parent's effective
visibility while it names the parent. A personal namespace has no ceiling of its own.

| Effective visibility | Who may view |
| --- | --- |
| `SmvPublic` | anyone, signed in or not |
| `SmvMembers` | an active member of the site (`PublicSiteParty.state` `active`, in its dates, not suspended), and anyone with a role. As GitLab's "internal". To confirm with the user ([§21](#21-open) question 1) |
| `SmvPrivate` | an account with a role of Guest or higher |

Besides visibility, a repository or group is Not Found to everyone but its Owners and the site's staff while it is
hidden (`hiddenAt` set, [§12.3](#123-moderation-targets-report-and-hide)), a group is Not Found to everyone but its
requester and the operators until it is `SmgActive`, and everything is Not Found on a site that is not published, by
`ForumCore.site`'s rule.

### 5.2 The effective role

For a party P and a repository R, the effective role is the highest rank among:

1. P's active `SmithyRepositoryParty` row on R;
2. P's active `SmithyGroupParty` row on R's group and on each group above it (inheritance: group to subgroup to
   repository);
3. Owner, when R is in P's personal namespace (`SmithyRepository.ownerPartyId` is P);
4. the role P's **project roles** give, on the projects R is linked to by a current `WorkEffortGitRepository`, read as
   `check#GitRepositoryAuthz` reads them today:

   | Project role of the party (a current `WorkEffortParty`) | Smithy role |
   | --- | --- |
   | a lead role: `ProjectManager`, `Manager`, `ProgrammerLead`, `SysArchitect` | Maintainer |
   | any other role that is not a client role | Developer |
   | a client role (`Customer`, `CustomerBillTo`, `ClientManager`, `ClientBilling`) on a project whose `WstShareRepositories` is `Y` | Guest |
   | a client contact who signs in (`get#ClientProjectInfo` `isClient`) | Guest at most, whatever other row the party has, and only for a project that shares its repositories |

5. Owner, for an operator (`ForumCore.isOperator()`), on the pages. In git an operator has the framework's `ADMIN`
   grant already.

"Active" is in `fromDate` and `thruDate`. The effective role on a group is the same without rows 1, 3 and 4. A role is
the party's, so an internal account and a public account of one party hold the same role (question 12).

Who gets the first row: the account that makes a group (`create#Group`), or the requester when a request is approved
(`decideGroupRequest`), gets `SmrOwner` on it. A repository in a group has no row of its own at first: its group's
members hold their roles on it. A personal repository's Owner is its namespace's account (row 3).

A **suspension** of the party in the site (`ForumSanction` kind `suspend`) removes rows 1 to 4: the party reads as a
signed-out visitor does and writes nothing. A **silence** (kind `silence`, for the site or for the scope's category)
leaves the role and refuses every post ([§12.2](#122-the-post-gate)); a push by role is still allowed.

### 5.3 What each role may do

`viewer` is anyone who may view (§5.1). `confirmed` is a signed-in account with a confirmed address (§5.5).

| Capability | Minimum | Notes |
| --- | --- | --- |
| Read code, issues, merge requests, pipelines, releases, docs; clone and fetch | viewer | a confidential issue is §8.3's |
| File an issue (confidential too), comment, react, flag, watch | confirmed viewer | through the gate |
| Fork; push to `refs/for/*`; propose an edit of a file; open a merge request from a fork | confirmed viewer | the site's policy and limits apply |
| Edit the title and text of what one filed; close and reopen one's own issue or merge request | the author, confirmed | within the forum's edit window for text. A merge request's fields (`updateMergeRequest`) are its author's or a Developer's; an issue's title is its author's or a Reporter's |
| Label, assign, set a milestone, close, reopen, mark duplicate (issues and merge requests) | Reporter | |
| Push a branch or a tag, fast-forward; create a branch or tag on the page; commit an edit to a branch | Developer | branch rules narrow it |
| Approve or request changes in a review (a viewer's review is a comment); set reviewers | Developer | the author does not approve their own (framework). The framework lets a viewer request changes; Smithy's `submitReview` refuses both decisions from less than a Developer |
| Run, cancel and retry a pipeline | Developer | |
| Force a push, delete a branch or tag, push to a protected branch as its rule allows | Maintainer | |
| Merge; manage labels, milestones and releases | Maintainer | in the framework a merge needs update, and delete for a protected target (N-HOOKS), so a Developer cannot merge to a protected branch by any path |
| Read a repository's members (the Members tab, `findRepositoryMembers`) | Maintainer | an Owner changes them |
| Settings: General, Branch rules, Webhooks, Mirrors, Pipelines (secrets, environments), Approve and run, confirm a bot | Maintainer | |
| Create a repository in a group | Maintainer of the group | |
| Members, visibility, rename, transfer, archive, delete; the Agreement and Forum settings; create a subgroup; hide a repository of the group | Owner | the last Owner of a group cannot be removed |
| Read and edit confidential issues; moderate the scope's conversations; import | Owner | |

### 5.4 The one check

`mantle.work.GitServices.check#GitRepositoryAuthz` stays the `authzServiceName` of the `ALL_USERS` grant on
`GitRepositories` and answers for git over HTTP and SSH, for the framework's REST and for its hosting services. DG1
changes it to this rule, and Smithy's pages call the same function, so they agree:

```
in:  userId (none, or one with no UserAccount, for a request with no credentials), authzActionEnumId,
     artifactName (the repositoryId)
out: authzTypeEnumId: AUTHZT_ALLOW or AUTHZT_NONE

smithy  = mantle.smithy.SmithyServices.get#RepositoryRights(repositoryId, userId)
          -> { known, canView, role }        known is false when the repository has no SmithyRepository row
when smithy.known:        the answer is Smithy's alone
  allow VIEW               when smithy.canView
  allow CREATE and UPDATE  when smithy.canView and smithy.role >= Developer and confirmed(userId)
  allow DELETE             when smithy.canView and smithy.role >= Maintainer and confirmed(userId)
when not smithy.known:    the rights today's rule gives by project roles (view, create, update, delete), unchanged
```

- `get#RepositoryRights` is §5.1 and §5.2: `canView` from the effective visibility, the hidden and state rules and the
  role; `role` the effective role. It folds the project roles in through §5.2's table, so "the greater of the project
  roles and the Smithy rows" is one maximum, and it is computed once.
- When the repository has a Smithy row, nothing else is asked: a project member gets no more than `get#RepositoryRights`
  gives, so the fail-closed rules hold in git as on the pages (a hidden repository, an unpublished site, a suspension,
  no confirmed address). Project roles alone decide only for a repository with no Smithy row (a dev shop's
  Projects-only repository), which behaves exactly as today.
- An anonymous request is allowed VIEW on a repository that is public in effect, not hidden, on a published site, and
  nothing else.
- `AUTHZT_NONE` lets other grants decide, as today, so `ADMIN` keeps all.
- Branch rules narrow create, update and delete further in the framework, as today. Smithy leaves
  `GitBranchRule.pushUserGroupId` empty: public roles are not user groups.
- A push to `refs/for/*` needs VIEW only (F5). The confirmed address and the limits for it are checked by the
  pre-receive rule of §5.5.

How a page maps the same answer: a caller without VIEW gets Not Found from every operation. A caller with VIEW who
lacks the role an operation needs gets `Unauthorized` (`accessDenied`), and the page did not show the control, since
each read returns `capabilities`.

### 5.5 The confirmed address (D17)

- **The helper.** `mantle/service/mantle/public/ConfirmedAddress.js` (built in DG1): `confirmed(userId)` and
  `requireConfirmed()` (fails `Unauthorized` with `addressUnconfirmed`). DG2 replaces the copies of R17 with it.
- **What "confirmed" is**, a stored fact in each case, so a push by key or token is judged as a page is:
  - **A public account** (only `ALL_USERS`): its current `emailAddress` has a `VerifiedAddress` row with `verifiedAt`.
    That is what the helper checks today.
  - **An internal account** (a `UserAccount` with a current membership of a user group other than `ALL_USERS`,
    `ForumCore.internalParty`'s rule): confirmed when its `emailAddress` is set. An administrator made the account and
    set the address. DG2 adds this branch to the helper.
  - **A provider sign-in.** Today a sign-in through a provider writes no `VerifiedAddress` row: the flow's
    `AflVerifiedEmail` rule only links an existing account when the provider's `email_verified` claim is true and its
    `email` equals the account's address (`crates/moqui-core/src/service/sso.rs`). So "an address the site trusts" is
    not a session fact here. DG2 makes it a row: when a sign-in through a flow listed in `pass-authority@sso-flows` carries
    `email_verified` true for the account's current address, the `VerifiedAddress` row is written then (N-SSO-VERIFIED).
    Until that is built, an account that registered through a provider confirms its address by the mail link.
- **Every Smithy write** calls `requireConfirmed()` after `requireUser()`: the operations marked `confirmed` or a role
  in §15. An account without a confirmed address reads, and each page that offers a write shows "Confirm your email
  address" with the link to Account in place of the control.
- **Git.** The pre-receive gitECA rule `SmithyPushGate` (mantle `service/Smithy.gitecas.xml`, calling
  `mantle.smithy.SmithyGitServices.check#Push`) refuses a push, `refs/for/*` included, from an account without a
  confirmed address or under a suspension, with a message that names the Account page. It applies only to a repository
  that has a `SmithyRepository` row: for any other repository it returns at once, so a dev shop's Projects-only
  repository is pushed to as today. The same rule checks the quotas ([§11](#11-settings-account-and-import)) and, for
  `refs/for/*`, the limits of §9.3. A pre-receive rule can refuse with a message (checked in the review).
- **Mail.** A message from an address that is no account's confirmed address is not posted
  ([§12.4](#124-mail-in)).
- **What PASS accepts.** A page needs a session. A PASS operation takes a signed-in session, or, for a listed set of
  Dev AIDE operations, an installed app's device login key: a `UserLoginKey` with `deviceName`, the account's own,
  unexpired and not scoped, found by its SHA-256. The list is `APP_KEY_OPERATIONS` in mantle `script/PassAuthority.js`:
  `findMergeRequests`, `getMergeRequest`, `createMergeRequest`, `forkRepository`, `getAgreement`,
  `getMergeRequestChanges`, `createReviewComment`, `resolveReviewThread`, `submitReview`, `findPipelineRuns`,
  `getPipelineRun`, `getJobRun`, `getJobLog`, `rerunPipelineRun`, `retryJobRun`, `findIssues`, `getIssue` and
  `createIssue` ([design-dev-aide §21](../../../../../plans/design-dev-aide.md#21-dev-aide-with-a-group-server)).
  With such a key the account has its normal Smithy rights; merging is not on the list and stays on the page. A personal access token, a scoped key (`UserLoginKey.scope`, such as a gateway's)
  and a session key are refused for every PASS operation, reads included (`accessDenied`). Decided Nov 14, 2026.
- **An access token** (a login key) acts as its account in git and in the framework's REST (F9), where a write to a
  repository Smithy keeps is refused with Smithy's operation named (§9.1). Smithy has no bearer-link write.

## 6. Groups and discovery screens

**Notation.** An operation name (`getGroup`) is a row of [§15](#15-service-and-api-catalog). Every screen below loads
in the resolved site, takes its ids from the resolver, shows a control only when the read's `capabilities` allow it,
and keeps what was typed after a refusal. "Without JavaScript" says what a browser with scripts off can do; "Island"
names the `.qvue` enhancement; "Phone" is the 390 px layout where it differs from §1's rules.

### Home

**Path** `B/`. **Shows** the home group's GroupOverview, without the group shell's breadcrumb, when
`SmithySite.homeGroupId` is set and the caller may view it; else Explore. **Operations** `getSmithyHome`, then
GroupOverview's. **Without JavaScript** all of it.

### Explore

**Path** `B/explore`. **Shows** three lists with one search field and a kind filter: groups (name, description,
repository count), repositories (path, description, visibility, last push, fork count), and from DG7 components (name,
version, dependencies, repository). Only what the caller may view is listed, and counts are of what is listed.
**Operations** `findGroups`, `findRepositories`, `findComponents` (DG7). **Without JavaScript** all of it; the search
is a GET form. **Phone** one list at a time, chosen by the kind filter.

### Search

**Path** `B/-/search?q=`. **Shows** results over the public projections: repositories, issues, merge requests, docs
pages, forum topics, each with its kind, title, a snippet and its place. A scope (a group or a repository) narrows it.
**Operations** `searchSite`. **Without JavaScript** all of it. Rules in [§13.5](#135-search).

### NewGroup

**Path** `B/new/group` (`?parent=<groupPath>` for a subgroup). **Shows** path segment, name, description, visibility,
and, where the site's policy is by request, the reason; the page says which policy applies and what happens next.
**Operations** `getSmithySettings` (the policy projection), `requestGroup` or `createSubgroup`. **Without JavaScript**
all of it. Refusals shown at the field: `nameInvalid`, `nameTaken`, `policyRefused`, `limitReached`.

### NewRepository

**Path** `B/new/repository` (`?namespace=<groupPath or handle>`). **Shows** the namespace (the caller's own, and each
group where the caller is Maintainer), slug, name, description, visibility (no wider than the namespace allows),
"Start with a README". **Operations** `findGroups` (`mine`), `createRepository`. **Without JavaScript** all of it.

### AccountDetail

**Path** `B/<handle>`. **Shows** the profile card (`getProfile`, Forum's projection: handle, display name, avatar,
bio) and the repositories of the namespace the caller may view, forks marked. An imported placeholder account shows
its mark ([§18.2](#182-the-github-import)). A handle whose profile is not discoverable and that has no visible
repository is Not Found. **Operations** `getProfile` (exists), `findRepositories` (`ownerHandle`). **Without
JavaScript** all of it.

### GroupOverview

**Path** `B/<groupPath>`. **Shows** the landing text (DG7: a Markdown page of a content repository,
[§13.1](#131-landing); before DG7 the group's description), pinned repositories, the latest release, news (the
announcements category's latest topics), recent activity (pushes, merged merge requests, releases of repositories the
caller may view), and subgroups. **Operations** `getGroup`, `findRepositories` (`pinned`), `getGroupLanding` (DG7).
**Without JavaScript** all of it. **Phone** one column: landing text, pinned, release, news, activity.

### GroupRepositories

**Path** `B/<groupPath>/-/repositories`. **Shows** subgroups first, then repositories with a filter, a sort (name,
last push) and "Include subgroups"; New repository and New subgroup by capability. **Operations** `findGroups`
(`parentGroupId`), `findRepositories`. **Without JavaScript** all of it.

### GroupIssues

**Path** `B/<groupPath>/-/issues`. **Shows** the Issues list of [§8](#8-issues) over every repository of the group and
its subgroups that the caller may view and that has issues on, with the repository on each row. New issue asks for the
repository first; the group's `issueRepositoryId` is preselected. **Operations** `findIssues` (`groupId`).
**Without JavaScript** all of it.

### GroupMembers

**Path** `B/<groupPath>/-/members`. **Shows** members with handle, display name, role, where the role comes from (this
group or a group above), since, until. Owners see every member; another viewer sees the members whose profile is
discoverable. An Owner adds a member by handle with a role and an optional end date, changes a role, removes a member;
anyone leaves. **Operations** `findGroupMembers`, `setGroupMember`, `leaveGroup`. **Without JavaScript** all of it.
**Phone** stacked rows.

### GroupSettings

**Path** `B/<groupPath>/-/settings/<tab>`. Owner only; Not Found for others.

| Tab | Shows | Operations | Stage |
| --- | --- | --- | --- |
| General | name, description, avatar, visibility (with the count of repositories and subgroups a narrowing changes), path (rename, with the redirect explained), the issue repository | `getGroup`, `updateGroup`, `renameGroup`; from DG7 the Landing section (`setGroupLanding`) | DG2/DG7 |
| Agreement | off or required, the file's path; what "required" adds to branch rules | `getAgreement`, `setAgreement` | DG4 |
| Pipelines | the runner pools the operator allowed and which the group uses for trusted and for outside runs; the month's runner minutes | `getPipelineSettings`, `storePipelineSettings` | DG5 |
| Forum | the group's category: on, off, link an existing one; the security address | `setScopeForum`, `storeIssueMailRoute` | DG6 |
| Quota | usage against the limits; an operator edits the limits | `getQuotaUsage`, `setQuota` | DG2 |
| Import | the start form (the GitHub repository, a token, a new repository or one of the group's, what to import, publishPrivate with its warning) and the group's imports, each linking to its page `B/import/<importId>` | `startGitHubImport`, `findGitHubImports` | DG8 |
| Delete | delete an empty group, typed path to confirm | `deleteGroup` | DG2 |

**Without JavaScript** all of it.

### GroupForum

**Path** `B/<groupPath>/-/forum/…`. **Shows** the forum's own pages (Topics, a category, a topic, Compose, Search)
limited to the group's category and its subtree, inside the group's shell, with every link built from
`B/<groupPath>/-/forum` ([§12.5](#125-the-forum-inside-smithy)). `B/forum` stays the whole site's forum when it is
mounted. **Operations** Forum's, with `scopeContactListId`. **Without JavaScript**, **Island** and **Phone** as the
forum's pages are (design-forum §1): reading works without JavaScript, composing is the forum's island.

## 7. Code screens

The reads are the framework's hosting services behind Mantle operations that apply [§5](#5-access). Limits, the same
for every caller: a tree lists at most 1,000 entries (then "Show more" pages); a text file is shown to 1 MiB and
highlighted to 512 KiB; a diff shows at most 100 files and 20,000 changed lines, the rest named with their counts;
a log page is 30 commits. Anonymous clones, archives, blame and large diffs are capped by client (`host/guard.rs`,
F1), and a refusal by that cap is `Tarpit` with the retry time.

### Files

**Path** `B/<repositoryPath>`, `B/<repositoryPath>/-/tree/<refPath>`. **Shows** the ref picker (branches, tags), the
path's breadcrumb, the last commit of the path with its check state (DG5), the tree (name, kind, size, the last
commit's summary and date), and the directory's `README.md` rendered below. An empty repository shows the push
instructions with the clone addresses. Buttons by capability: New file, Upload (DG4), Download (zip, tar.gz), History.
**Operations** `getRepository`, `getTree`, `findRefs`, `downloadArchive`. **Without JavaScript** all of it; the ref
picker is a GET form. **Island** none in DG1; `m-file-tree` may enhance the tree with a collapsible side tree on the
desktop. **Phone** name and date only; the README follows the tree.

### Blob

**Path** `B/<repositoryPath>/-/blob/<refPath>`. **Shows** the file's header (path, size, the last commit) and the
content: text with line numbers and anchors (`#L10`, `#L10-L20`); Markdown rendered, with a Source toggle
(`?plain=1`); an image shown; a binary or LFS file as a download link with its size; a file over the limit as a notice
with Raw. Buttons: Raw, Blame, History, Edit and Delete (DG4, by `getEditContext`), Permalink (the commit's URL).
**Operations** `getBlob`, `downloadBlob` (Raw, at `-/raw/<refPath>`). **Without JavaScript** all of it, with plain
text. **Island** the read-only `m-code-editor` highlights the text. **Phone** the code block scrolls sideways.

Raw is served as `text/plain` or `application/octet-stream` with `nosniff` and `Content-Disposition: attachment` for
anything a browser would run or render (HTML, SVG, scripts), never as a page of the site.

### Blame

**Path** `B/<repositoryPath>/-/blame/<refPath>`. **Shows** the text with, beside each run of lines, the commit that
last changed it (short id, summary, author, date) linking to CommitDetail. **Operations** `getBlame`. **Without
JavaScript** all of it. **Phone** the commit column is the short id only. Needs N-BLAME.

### Commits

**Path** `B/<repositoryPath>/-/commits/<refPath>`. **Shows** the history of a ref, or of a path at a ref, by day:
summary, author, date, short id, the check state (DG5), linked issue numbers (DG3). Older
and Newer by `afterCommitId`. The author is the name in the commit. It is shown as an account's handle
(`commit.authorHandle`) only when that account pushed the commit to this repository (`GitUpdate.userId` of the update
that brought it, or the `Moqui-User-Id` trailer of a commit the server made) and its profile is discoverable; never
by the author's email alone, since anyone can push a commit with any address and would learn whose it is. DG1
returns `authorHandle` empty; the pushed-by rule is DG4's (N-PUSHER). **Operations** `findCommits`. **Without
JavaScript** all of it.

### Branches

**Path** `B/<repositoryPath>/-/branches`. **Shows** the default branch, then the others: last commit, ahead and
behind the default, a Protected chip, its open merge request, Compare. A Developer creates a branch from a ref; a
Maintainer deletes one. **Operations** `findRefs` (`refType` `branch`), `createRef`, `deleteRef` (DG2). **Without
JavaScript** all of it.

### Tags

**Path** `B/<repositoryPath>/-/tags`. **Shows** tags by date with their commit, the release of each (DG7) and the
downloads. A Developer creates a tag; a Maintainer deletes one. **Operations** `findRefs` (`refType` `tag`),
`createRef`, `deleteRef`. **Without JavaScript** all of it.

### CommitDetail

**Path** `B/<repositoryPath>/-/commit/<id>`. **Shows** the message, author and committer, parents, the branches and
tags that contain it (bounded), the checks of the commit (statuses and runs, DG5), the linked issues and merge requests
the caller may see (an item the caller may not see is counted, "1 item not shown", and never named), the file list
with counts, and the diff. **Operations** `getCommit`. **Without JavaScript** all of it: the diff is rendered on the
server as unified text. **Island** `m-diff-view` adds side by side, folding and highlighting. **Phone** unified only.

### Compare

**Path** `B/<repositoryPath>/-/compare/<base>...<head>`. **Shows** two ref pickers (the head may be a fork's ref),
ahead and behind, whether it merges cleanly, the commits and the diff, and Open merge request (DG4) when the head is
ahead. **Operations** `getCompare`, `findRefs`, `findForks` (DG4). **Without JavaScript** all of it. **Island** and
**Phone** as CommitDetail.

## 8. Issues

### 8.1 What an issue is

- An issue is a Mantle task of the repository's project, with a `SmithyIssue` row that gives it a number in the
  repository, its confidential mark and its conversation topic (D6). Smithy shows the public projection; BOSS
  Projects, when loaded, is the maintainers' view of the same task.
- **The project.** A repository with issues on has `SmithyRepository.workEffortId`, kept equal to a current
  `WorkEffortGitRepository` link. Turning issues on (`updateRepository`) uses the group's project
  (`SmithyGroup.workEffortId`) when the group has one, else makes a project for the repository
  (`create#ProjectRepository`'s project half; [§21](#21-open) question 2). Linking another existing project is done in
  BOSS Projects (`add#ProjectRepository`), not on a public page.
- **A group's tracker** is a repository: `SmithyGroup.issueRepositoryId`. An issue always belongs to one repository, so
  it always has a URL. The group's Issues page lists across repositories.
- **A task made in Projects** becomes an issue when it is public: a task with `WevGeneral` and no `SmithyIssue` gets
  one (`mantle.smithy.SmithyIssueServices.ensure#Issue`, called by a SECA on the task's create and visibility change).
  `WevGeneral` means "shared with the client" in Mantle today, and an import sets it by default where
  `WstShareNewItems` is `Y`, so the rule is narrow:
  - It applies only to a task of a project that is some `SmithyRepository.workEffortId` with `issuesEnabled` `Y`, or a
    `SmithyGroup.workEffortId` of a group with such a repository. A project that is only linked to a repository by
    `WorkEffortGitRepository` (a client's project in Projects) never gets issues.
  - There is no backfill: tasks that were `WevGeneral` before issues were turned on get no issue. A maintainer makes
    one public by saving its visibility again.
  - The issue goes to the project's one repository with issues on, else to the group's issue repository; with neither
    it stays without a number.
  - The first post is the task's description, through the gate (§12.2) as the task's creator, or as the site's system
    author when the creator has no account on the site; a refusal leaves the task without an issue and is logged.
  - When a task's visibility leaves `WevGeneral` (and it is not a confidential issue), the issue is Not Found to
    everyone below Reporter, in every list, search and link, until it is `WevGeneral` again. Its number is kept.
- **A transfer.** A repository that moves to another group keeps its `workEffortId`, so its issues, numbers and links
  stay. When that project is the old group's shared one (`SmithyGroup.workEffortId`), the transfer is refused
  (`Conflict`) until an Owner gives the repository a project of its own, which moves its issues' tasks to it.
- **The text.** The issue's title is the topic's title and the task's `workEffortName`. Its text is the topic's first
  post, with the post engine's revisions; the task's `description` is a plain-text copy written by the same service,
  never edited on its own for a task that has a `SmithyIssue`.

### 8.2 The public projection

Shared projection services (`mantle.work.PublicProjectionServices`, new; the Client portal uses them with a client as
the audience) return exactly these fields, and `getIssue` and `findIssues` return nothing else of the task:

| Field | From |
| --- | --- |
| `issueNumber`, `repositoryPath` | `SmithyIssue`, `SmithyRepository` |
| `title` | `WorkEffort.workEffortName` |
| `state` (`open`, `closed`), `stateReason` (`completed`, `notPlanned`, `duplicate`), `duplicateOfNumber` | §8.5 |
| `confidential` | `SmithyIssue.confidential` |
| `author`: `handle`, `displayName`, `avatarUrl`, `imported` | the reporter's `PublicSiteProfile` |
| `createdAt`, `updatedAt`, `closedAt` | the issue, its last visible activity, the close |
| `labels`: `labelId`, `name`, `color` | `WorkEffortCategory` of type `WcatLabel` applied to the task |
| `milestone`: `milestoneId`, `name`, `dueDate`, `state` | the task's milestone |
| `assignees`: `handle`, `displayName`, `avatarUrl` | assigned parties that have a profile on the site; one without a profile is not listed |
| `commentCount`, `reactionCounts` | the topic's visible posts |
| `linkedCommits`: `repositoryPath`, `commitId`, `summary`, `date` | `WorkEffortGitCommit`, for repositories the caller may view |
| `linkedMergeRequests`: `repositoryPath`, `mergeRequestNum`, `title`, `state` | `WorkEffortGitMergeRequest`, the same |
| `linkedRefs`: `refName`, `refType` | `WorkEffortGitRef`, current, the same |
| `discussion`: `rootCommEventId`, `title` | a forum topic linked by `PublicDiscussionLink` (DG6) |
| `topic`: `rootCommEventId`, `revision` | the conversation |
| `revision` | `SmithyIssue.revision` |
| `workItemKey`, `statusId` | the task's id and status, for Reporter and higher only |

**The reporter of a confidential issue** who is not an Owner gets exactly: `issueNumber`, `repositoryPath`, `title`,
`state`, `stateReason`, `confidential`, `author`, `createdAt`, `updatedAt`, `closedAt`, `commentCount` (of the posts
they may read), `topic`, `revision`. Not `labels`, `milestone`, `assignees`, `linked*`, `discussion`, `duplicateOfNumber`,
`reactionCounts` or `workItemKey`.

Never returned, to anyone through Smithy: Chatter notes and activity, time entries, estimates and actual time, cost
and rates, allocations, a party that is not the author or a listed assignee, the task's parent and children, its
purpose, priority and internal type, settings of the project, and any task that is not `WevGeneral` and not the
caller's own confidential issue. A commit, a merge request or another issue that names a task the caller may not see
shows it unnamed (a count). The conversation shows the topic's posts only: an internal note is Chatter and is not a
post.

### 8.3 Confidential issues

- Any confirmed viewer files one by the form's "Confidential" mark. The task is created `WevConfidential` and
  `SmithyIssue.confidential` is `Y`.
- **Who reads and edits it:** the Owners of the repository and of each group above it (an `SmrOwner` row, or the
  namespace's account), and site operators. For everyone else the number answers Not Found, and the issue is in no
  list, count, search result, feed, commit page or notification. A Maintainer is not an Owner and does not see it,
  and neither is a project manager: a project role gives Maintainer at most (§5.2).
- **In Projects.** A `WevConfidential` task that has a `SmithyIssue` is hidden from everyone but those Owners and
  operators: the project's managers, the task's own parties and `allProjects` users, who see `WevConfidential` tasks
  today (`ProjectServices.xml`), do not see it. Its Chatter and description are hidden with it. An Owner does not
  assign it to a party who is not an Owner. (N-BOSS-ISSUE.)
  - **How (decided in DG3's review, Nov 13, 2026).** A confidential issue's task is kept in a **companion project** of
    the repository (`SmithyRepository.confidentialWorkEffortId`, made on first need, never linked to the repository),
    whose only members are the internal accounts that are Owners of the repository or of a group above it, kept in step
    with every change of roles. Projects' ordinary rule (one sees the tasks of the projects one is on) then hides the
    task in every read, in BOSS and in Mantle. Making an issue confidential or public moves its task between the
    tracker's project and the companion; its id, time and notes stay.
  - `get#VisibleProjectInfo` `hiddenItemIds` (the confidential issues' tasks the user is no Owner of) stays as a second
    layer: Mantle's task reads and BOSS's own (`HiddenItems.js`) leave those ids out, and fail closed.
  - **Why.** The first build only filtered: every reader of tasks was to leave `hiddenItemIds` out. The review found
    about forty readers in BOSS and Mantle that still named or counted such a task (breadcrumbs, parent names, Today,
    the calendar, timers, timesheets, invoices, estimates, release notes, burndown, allocations, search rows,
    notifications, unlink and move). A filter each reader must remember does not hold; membership of a project is a
    rule every reader already applies.
- **The review queue and the classifier.** A held post of a confidential issue is read and decided by its Owners
  only, never by a site or category moderator or in BOSS Comms Moderation, and its text is never sent to the
  classifier (§12.1).
- **The reporter** keeps what they filed: `getIssue` gives the reporter the issue with their own posts and the posts
  an Owner addressed to them (a reply in the topic; every post of a confidential topic is addressed to the reporter
  unless the Owner marks it "Owners only", which is a post with `ForumPostState.visibility` `staff`, new). The
  reporter may reply, and sees the fields §8.2 lists for a reporter.
- **A `staff` post is checked for each reader, not for the topic.** It is not mailed to the reporter, and is in none
  of the reporter's notifications, post history, search results, post locations or counts (§12.1).
- Mail for a confidential issue goes to the Owners and the reporter only, with the title replaced by "Confidential
  issue #n" in the subject.
- An Owner makes it public with `setIssueConfidential`: as it is (the task becomes `WevGeneral`, every approved post
  that is not `staff` becomes public, and a `staff` post stays staff; the page shows the posts first), or as a new
  issue (a new number and topic with a title and text the Owner writes, which pass the gate, linked from the
  confidential one, which stays confidential). An Owner may also mark a public issue
  confidential; what was already mailed is not recalled, and the page says so.
- A commit that says `Fixes #n` for a confidential issue completes it and shows no link to anyone else.

### 8.4 Numbers and references

- `SmithyIssue.issueNumber` is allocated from `SmithyRepository.nextIssueNumber` under a lock of the repository's row,
  never `max + 1`. An imported issue keeps its GitHub number, and the import sets `nextIssueNumber` past the highest
  imported issue or pull request number. A merge request has the framework's `mergeRequestNum`, a separate sequence.
- The work item's key (`PROJ-12`) stays what Projects shows. Each finds the item (question 9).
- **In a commit message** pushed to repository R (`find#TaskReferences`, extended; scoped to R):
  - `#<n>`, where `#` is not preceded by a letter, digit, `_`, `/` or `&`: the issue numbered n in R; when R has no
    issue n, the merge request numbered n in R, as a link only.
  - `!<n>`: the merge request numbered n in R, as a link only.
  - `<repositoryPath>#<n>`: the issue n of that repository, as a link only, when the pusher may view it.
  - A reference right after `Fix`, `Fixes`, `Fixed`, `Close`, `Closes`, `Closed`, `Resolve`, `Resolves` or `Resolved`
    (any case, an optional `:`) marks its issue to complete, exactly as a key after those words does today, and
    `apply#CommitKeywords` completes it when the commit reaches the default branch, under its present rules (only
    commits made after the repository was linked; a task already complete is left). Only an issue of R is completed.
  - The existing key and `Task:` trailer rules are unchanged, and at most 50 candidates are read, as today.
- **In a merge request's title and text**, the same forms link, and a closing word sets
  `WorkEffortGitMergeRequest.completeOnMerge` (`link#MergeRequestItems`, extended the same way).
- **In rendered text** (posts, commit messages on pages): `#n`, `!n`, `<repositoryPath>#n`, `@handle` and a commit id
  of 7 to 40 hex digits become links when their target exists and the reader may see it; otherwise they stay text.

### 8.5 States, labels and milestones

The public sees open and closed with a reason. The project's status flow is the maintainers'.

| Public state | The task |
| --- | --- |
| `open` | any status but the three below |
| `closed`, `completed` | `WeComplete` or `WeClosed`, resolution `WerCompleted` or none |
| `closed`, `duplicate` | resolution `WerDuplicate`; `duplicateOfNumber` from the association `setIssueState` writes |
| `closed`, `notPlanned` | `WeCancelled`, or a closed status with resolution `WerWontComplete`, `WerCannotReproduce`, `WerInsufficient` or `WerIncomplete` |

`setIssueState` writes: `completed` sets `WeComplete` and `WerCompleted`; `notPlanned` sets `WeCancelled` and
`WerWontComplete`; `duplicate` sets `WeCancelled`, `WerDuplicate` and the link to the other issue; `open` sets the
first open status the task's status flow allows from where it is (`WeInPlanning` in the default flow) and
`WerUnresolved`. A transition the flow does not allow is `Unprocessable` and names the flow's allowed ones to a
Reporter. Each change is a line in the conversation ("closed as completed by @handle"), kept as a post of kind
`event` that has no text to moderate.

Labels are the project's `WcatLabel` categories; a Reporter applies them and a Maintainer makes, renames and deletes
them. Milestones are the project's (`WetMilestone`); a Reporter sets an issue's and a Maintainer makes and closes
them. Releases are §13.3.

### Issues

**Path** `B/<repositoryPath>/-/issues`. **Shows** Open and Closed counts, filters (label, milestone, assignee, author,
text), a sort (newest, last activity), rows of number, title, labels, author, age, comment count, and New issue. An
Owner has a "Confidential" filter; nobody else sees that it exists. **Operations** `findIssues`, `findLabels`,
`findMilestones`. **Without JavaScript** all of it: the filters are a GET form. **Phone** title, number and labels;
the rest on a second line.

### NewIssue

**Path** `B/<repositoryPath>/-/issues/new`. **Shows** title, text (Markdown by default, rich text by the composer's
toggle), attachments, the Confidential mark with one sentence on who will read it, and for a Reporter labels,
assignees and milestone. A signed-out visitor gets Sign in; an account without a confirmed address gets "Confirm your
email address". **Operations** `createIssue`, `previewPost` (exists, with `sourceFormat`), `stageAttachment` (exists).
**Without JavaScript** a title field and a plain Markdown textarea post the form; no preview, no upload. **Island**
the composer (`Smithy/Islands/Composer.qvue`, Forum's `Compose.qvue` with the Markdown mode): preview, mentions,
uploads, drafts. A result of `pending` shows "Waiting for review" and the issue to its author only.

### IssueDetail

**Path** `B/<repositoryPath>/-/issues/<n>`. **Shows** the title, number, state chip, the Confidential chip, author and
date; the conversation (the topic's posts in order, with edits, reactions and state-change lines); a side column of
labels, assignees, milestone, linked commits, merge requests and branches, the linked discussion, the watch level; and
the reply form with Close or Reopen. **Operations** `getIssue`; Forum's `getPosts`, `publishPost` (a reply, with
`rootCommEventId`), `updatePost`, `setReaction`, `flagPost`, `getPostHistory`, `markRead`, `setPreferences` (all
exist; they accept a record topic from DG3); `updateIssue`, `setIssueState`, `setIssueLabels`, `setIssueAssignees`,
`setIssueMilestone`, `setIssueConfidential`, `findAssignees`. **Without JavaScript** reading in bounded pages, the
reply (a Markdown textarea), close and reopen, and the side column's forms. **Island** the forum's post stream and
composer. **Phone** the side column follows the conversation, collapsed.

### Labels

**Path** `B/<repositoryPath>/-/labels`. **Shows** each label with its color, description and open issue count; a
Maintainer edits. **Operations** `findLabels`, `storeLabel`, `deleteLabel`. **Without JavaScript** all of it.

### Milestones

**Path** `B/<repositoryPath>/-/milestones`, `…/<milestoneId>`. **Shows** open and closed milestones with due date and
the share of closed issues; one milestone with its issues. A Maintainer edits. **Operations** `findMilestones`,
`storeMilestone`, `findIssues` (`milestoneId`). **Without JavaScript** all of it.

## 9. Merge requests, forks and editing

### 9.1 What Smithy adds to a merge request

A merge request is the framework's `GitMergeRequest`, with its reviewers, approvals, required checks and merge
methods. A `SmithyMergeRequest` row beside it holds the site, the conversation topic and the agreement's result.

- **The conversation** is a record topic ([§12.1](#121-where-a-conversation-lives-question-3)). The merge request's
  text is the topic's first post; `GitMergeRequest.description` is a plain-text copy.
- **A line comment** is a post of that topic with a `CommunicationEventGitAnchor` row on the same event; a reply is a
  post whose `parentCommEventId` is the thread's first post. So a line comment has revisions, moderation and mail as
  any post. `mantle.work.GitServices.get#ReviewThreads`, `resolve#ReviewThread` and `refresh#ReviewAnchors` read
  threads of both shapes (a `Comment` event filed on the merge request, as today, and a post with an anchor), and for
  a merge request that has a `SmithyMergeRequest`, `create#ReviewComment` writes the post, so Projects' Code and
  Smithy show the same threads. Refined in DG4's contract note.
- **A review** (`submitReview`) is the framework's `submit#MergeRequestReview` with its summary as a post.
- **Made outside the pages.** A merge request the framework creates (a push to `refs/for/*`, Projects) reaches Mantle
  by `handle#MergeRequestEvent`; `mantle.smithy.SmithyReviewServices.ensure#MergeRequest` then makes the
  `SmithyMergeRequest` and its topic, and computes the agreement.
- **The framework's writes do not go around Smithy** (N-HOOKS, with F9). For a repository that has a Smithy row:
  - the framework's REST (F9) asks `git-server` `rest-write-check-service`
    (`mantle.smithy.SmithyGitServices.check#RestWrite`) before each write. Every write is refused there
    (`GitKeptByApplication`), with Smithy's REST and its operation named (`ref.create` `createRef`,
    `mergeRequest.comment` `createReviewComment`, `mergeRequest.resolveThread` `resolveReviewThread`,
    `pipeline.rerun` `rerunPipelineRun`, `job.retry` `retryJobRun`, and the rest), so the confirmed address, the gate
    and the roles are the ones a page has. A read is allowed and says Smithy keeps the repository. One write is
    allowed: `commitStatus.create`, an outside CI's status, for which the framework needs the push right and refuses
    the contexts Smithy reserves;
  - the framework's review threads (REST `git/{id}/mergeRequests/{n}/threads` and `…/resolve`) are Mantle's, through
    `git-server` `review-thread-service` (`mantle.work.GitServices.handle#GitReviewThread`: find, comment, resolve).
    It checks the caller's view first, binds a thread to the merge request its path names (a thread of another one
    is Not Found), refuses a stale commit, and keeps a hidden merge request its author's alone;
  - the hosting offer (`offer-service`, `SmithyGitServices.add#HostingOffer`) adds Smithy's REST base, its page URL,
    forks and Mantle's task source to the framework's offer, for the site the client reaches; it names no account;
  - `merge#MergeRequest` to a protected branch needs delete (Maintainer), where it needs only update today; a
    Developer merges to an unprotected branch, as they could push to it;
  - `set#GitRepositoryPath` needs only update in the framework, so it is not exposed by REST for such a repository:
    the path changes only through `renameRepository` and `transferRepository` (Owner, `nameFree`, the 90 days);
  - the status contexts `agreement/` and `ci/` are the system's: `create#GitCommitStatus` refuses them from a user,
    whatever the user's rights, and only the agreement check and the engine write them.
- **States** are the framework's: draft, open, merged, closed.

### 9.2 Forks

- A fork is a new repository whose `GitRepository.forkOfRepositoryId` names its parent (F4). It shares the parent's
  objects.
- **Who:** a confirmed viewer, by the site's `forkCreateEnumId` policy, within the gate's limit for forks and the
  namespace's quota. **Where:** the caller's namespace, or a group where the caller is Maintainer.
- **Visibility:** the narrowest of the parent's effective visibility, the target namespace's ceiling and the caller's
  choice. `setRepositoryVisibility` refuses to widen a fork past its parent while it names one.
- A fork starts with issues, pipelines, forum and docs off and merge requests on. Its Compare and New merge request
  default to the parent as the target.
- A parent that has forks is not deleted (`Conflict`); it may be archived or transferred. Refined in DG4 with F4's
  rule for the fork network.
- A merge request from a fork has `GitMergeRequest.sourceRepositoryId`. Its author needs view of the target and push
  to the source.
- **Shared objects are not shared reads.** A fork network keeps one object store, so a commit of a private fork, or
  of a held push-to-review head, exists in the store a public parent reads. `getCommit`, `getBlob`, `getTree`,
  `downloadBlob`, `getBlame`, `getCompare` and `downloadArchive` accept a commit id only when the commit is reachable
  from a ref of that repository that the caller may read (its branches and tags, and the head of a merge request the
  caller may view). Any other id is Not Found. The framework gives the test (N-REACH), and git's upload-pack applies
  the same rule to a fetch by id.

### 9.3 Push-to-review

`git push origin HEAD:refs/for/main` from an account that may view (F5):

1. `SmithyPushGate` (§5.5) checks the confirmed address, the sanctions and the daily limit for merge requests.
2. The framework opens a merge request to `main`, or updates the open one of the same author, target and topic
   (`-o topic=…`; with no topic, the one without a topic), keeps the commits at `refs/merge-requests/<n>/head`, and
   takes `-o title=…`; with no title the first commit's summary.
3. `ensure#MergeRequest` makes the Smithy row and the topic. The text is the first commit's message body. When the
   gate holds the text, the merge request's page is Not Found to all but its author and the record's moderators until
   it is approved, and its `refs/merge-requests/<n>/head` is fetched by nobody else until then.
4. The answer to the push names the merge request's page.

`git fetch origin refs/merge-requests/12/head` fetches the head of a merge request the caller may view, a fork's and
a pushed one alike. The refs are not advertised.

**What a push to `refs/for/*` may add.** The objects go into the target's store, so `check#Push` caps them and counts
them against the pusher, not the target: at most 50 MiB a push and 200 MiB a day for an account without Developer
(site settings later; the numbers are DG4's to set), no LFS objects, and the bytes count in the pusher's own
`maxRepositoryBytes`, never in the target repository's quota. A closed, unmerged merge request's objects are
collected after 30 days.

### 9.4 The agreement check

The rule is [Contributions](../../../../../docs/dev/Contributions.md) and Dogfood §10. It is off by default.

**The setting.** `agreementEnumId` on a repository: `SmaInherit` (the default), `SmaOff`, `SmaRequired`; on a group:
`SmaInherit`, `SmaOff`, `SmaRequired`. The effective setting is the repository's, else the nearest group's above it
that is not `SmaInherit`, else off. `agreementPath` (default `AUTHORS.md`) is taken from the same row. Turning it on
for a repository adds the context `agreement/authors` to `requiredStatusContexts` of the branch rule of the default
branch (making the rule when there is none) and of every rule that requires a merge request; turning it off removes
it. For a group the page lists the repositories this changes.

**Parsing the file.** At a commit, the file at `agreementPath` is read as lines. Fenced code blocks are skipped.

- A list starts after an ATX heading whose text, trimmed and compared without case, is `Copyright Waiver` (the list
  `copyright`) or `Grant of Patent License` (the list `patent`), and ends at the next heading of the same or a higher
  level, or the end of the file.
- A signature is a line of a list that matches `^\s*[-*]\s+Written in (.+?) by (.+) - (\S+)\s*$`: the years, the
  legal name and the login. The login is compared in lower case.
- The template line under `Contributing` is in neither list, so it is no signature.

**Accounts and identities.**

- A commit's author is an account when the author's email, in lower case, is a confirmed address of the account
  (`VerifiedAddress` with `verifiedAt`), or has the form `<digits>+<login>@users.noreply.github.com` or
  `<login>@users.noreply.github.com` with `<login>` the account's linked GitHub login. The committer is not looked at:
  it is the server's for a page edit, a merge and a rebase.
- An account's logins are its handle on the site and its linked GitHub login, in lower case.

**The check**, for a merge request with target branch tip T, head H and commits C (the commits of H that T does not
have):

1. The people are the merge request's author and the author of each commit of C. A commit whose author is no account
   is missing: "commit `<id>`: `<name>` is not an account".
2. An account is **listed** in a list when a signature with one of its logins is in that list of the file at T or at
   H.
3. A listed signature is **the account's own** when the commit that added it was written by the account: among the
   commits reachable from the tip it was found at (T or H) that change the file (followed through a rename from
   `AUTHORS`), the latest non-merge commit whose parent does not have that line in that list and which has it; its
   author must be the account, by the rule above.
4. An account is **signed** when it is listed in both lists and both signatures are its own.
5. **A bot.** An account marked as a bot (`SmithyAccount.bot`) counts as signed when its operator
   (`botOperatorPartyId`) is signed, the operator has said so on this merge request (`declareBotOperator`), and a
   Maintainer has confirmed it (`confirmBotOperator`). Until then the status is pending.
6. The status `agreement/authors` is written for H with `create#GitCommitStatus`: `success` when every person is
   signed; `pending` for an unconfirmed bot; else `failure`, with a description that names up to five people and what
   each is missing (`copyright`, `patent`, "not their own commit"). Its target is the merge request's Overview.
   `SmithyMergeRequest` keeps the result (`agreementStateEnumId`, `agreementDetail`, `agreementCommitId`).

It is computed when the merge request opens, at each new head, when a push changes the file on the target branch (for
each open merge request to that branch), and by `recheckAgreement` (after an account confirms an address or links a
login). `SmithyAgreementSignature` caches step 3 by repository, ref, list and login, and is rebuilt when the file's
blob at the ref changes. The Dev AIDE's "has this author signed" (F18) reads the same service
(`mantle.smithy.SmithyAgreementServices.get#AuthorSigned`, also named `get#Signed`) through `git-server`
`agreement-check-service` (`SmithyGitServices.check#AuthorSigned`): known, required, signed, and `signUrl`, the file's
edit page on the default branch at the site's canonical host (https only). What is missing is said only to the author
or a Maintainer of the repository; anyone else learns signed or not.

**Merging.** A squash is refused (`squashFoldsSignature`) when C has a commit that adds a signature and C's commits
have more than one author account, since the squash would put one person's signature in another's commit; the page
offers a merge commit and a rebase. `mergeMergeRequest` checks it, and a gitECA rule of `Smithy.gitecas.xml` on the
merge's write refuses the same for a merge made another way. An unsigned merge request cannot be merged, because the
branch rule requires the context.

**Unsigned.** The Overview says who is missing what and links to the file's Contributing section and to Sign. Agents'
tools (MCP, A2A, Assist) refuse the diff of a merge request whose `agreementState` is `SmasUnsigned` or
`SmasPending` and give its description; `SmasOff` (no agreement is required) and `SmasSigned` are served. That rule
is in the tools (design-dev-aide P13), which read `agreementState`.

**Signing on the page.** `signAgreement` adds the account's line, `- Written in <years> by <legal name> - <handle>`,
at the end of both lists, as one commit by the account through §9.5's save: into the merge request's source when the
account may push there or the merge request is its own push-to-review, else as a new merge request to the default
branch. Nobody needs a clone to sign.

### 9.5 Editing a file on its page

- **Editable** when the ref is a branch, the repository is not archived and not a `remote` mirror, the file is text,
  is not an LFS pointer, and is at most `SmithySite.maxEditBytes` (default 1 MiB). Else `getEditContext` gives
  `editable: false` with the reason, and Edit is absent.
- **Destinations**, which `getEditContext` lists with the default first:

  | Destination | When | What the save does |
  | --- | --- | --- |
  | `branch` | the caller has update and `get#GitBranchRules` says a direct push is allowed | a commit on the branch |
  | `newBranch` | the caller has create (Developer) | a branch `<handle>-patch-<k>`, a commit on it, and a merge request to the edited branch; the default on a protected branch |
  | `proposal` | a confirmed viewer without push | a commit kept at `refs/merge-requests/<n>/head` and a merge request, with no fork (F5) |

- **The commit** is made by `commit#GitFiles` (extended, N-COMMIT): one file a commit; the author is the account's
  display name and confirmed address, the committer the server. It is recorded as a write, so gitECA rules, pipelines,
  the agreement check and the mirror follow.
- **A conflict.** The save sends `baseBlobId`, the blob the edit started from. When the file's blob on the branch is
  another, the answer is `Conflict` (`fileChanged`); the page reloads the current text beside the caller's and asks.
- New file, Rename, Delete and Upload are the same operation with another `action`. Upload takes a staged, scanned
  attachment (Forum's `stageAttachment`) of at most `maxEditBytes`; a larger file is told to use git and LFS.
- A page edit goes through the gate as a merge request does when it opens one, and counts in the daily limit.

### MergeRequests

**Path** `B/<repositoryPath>/-/merge-requests`. **Shows** Open, Merged, Closed counts; filters (author, reviewer,
target branch, draft, text); rows of number, title, author, source and target, the check state, approvals, the
agreement's mark when it is required, age. **Operations** `findMergeRequests`. **Without JavaScript** all of it.

### NewMergeRequest

**Path** `B/<repositoryPath>/-/merge-requests/new?base=&head=`. **Shows** the target and source pickers (a fork's
branches included), the commits and the file count, title (the first commit's summary), text, draft, and for a
Developer reviewers. **Operations** `getCompare`, `createMergeRequest`, `previewPost`. **Without JavaScript** all of
it with a Markdown textarea. **Island** the composer.

### MergeRequestOverview

**Path** `B/<repositoryPath>/-/merge-requests/<n>`. **Shows** title, number, state, author, `source → target`; the
conversation with review summaries and thread excerpts in order; a side column of reviewers and their decisions, the
checks' state with what is required and missing (`missingList`), the agreement panel (state, who is missing what,
Sign), linked issues, the watch level; the fetch line (`git fetch origin refs/merge-requests/<n>/head`); and the merge
box for a Maintainer: method, message, delete the source branch, and why merging is refused when it is.
**Operations** `getMergeRequest`; Forum's post operations as IssueDetail; `updateMergeRequest`,
`setMergeRequestReviewers`, `submitReview`, `setMergeRequestState`, `mergeMergeRequest`, `recheckAgreement`,
`signAgreement`, `declareBotOperator`, `confirmBotOperator`. **Without JavaScript** reading, a reply, a review with a
summary, close, reopen and merge. **Island** the forum's post stream and composer. **Phone** the side column follows.

### MergeRequestCommits

**Path** `…/merge-requests/<n>/commits`. **Shows** the commits of the merge request as Commits' rows, each with its
checks and whether its author has signed. **Operations** `getMergeRequestChanges` (`withDiffs` false). **Without
JavaScript** all of it.

### MergeRequestChanges

**Path** `…/merge-requests/<n>/changes`. **Shows** the file list and the diff of the merge base to the head, with the
line threads in place, outdated threads folded, and Resolve. **Operations** `getMergeRequestChanges`,
`createReviewComment`, `resolveReviewThread`, `submitReview`. **Without JavaScript** the diff as unified text,
rendered on the server, with each file's threads listed under it and a reply form per thread; a new line comment
needs the island. **Island** `Smithy/Islands/DiffReview.qvue` over `m-diff-view`, on the model of Projects'
`Changes.qvue`: click a line to comment, reply, resolve, side by side, file tree, a pending review that is submitted
at once. **Phone** unified only; a line is chosen by a tap on its number. **A large file** shows on its own page
(`?path=`) in parts of 10,000 lines (`?part=`), and the page asks for its part alone (`diffLineOffset`,
`diffLineLimit`), so the git host makes no values of the file's other lines: the commit's and the comparison's pages do
the same.

### MergeRequestChecks

**Path** `…/merge-requests/<n>/checks`. **Shows** every status of the head by context with its state, description and
target, the required ones marked, and from DG5 the pipeline runs with their jobs and failed tests, and "Approve and
run" for a Maintainer when a run waits. **Operations** `getMergeRequest`, `findPipelineRuns` (`mergeRequestNum`),
`approvePipelineRun`. **Without JavaScript** all of it.

### Fork

**Path** `B/<repositoryPath>/-/fork`, `…/-/forks`. **Shows** the fork form (namespace, slug, name, visibility with
its ceiling) and the repository's forks the caller may view. **Operations** `forkRepository`, `findForks`,
`findGroups` (`mine`). **Without JavaScript** all of it.

### Edit

**Path** `B/<repositoryPath>/-/edit/<refPath>` (and `new`, `upload`, `delete`). **Shows** the path (editable, which
is a rename), the editor, a Preview tab for Markdown, and the save dialog: the message (a default by action), the
destination with one line each on what it does, the new branch's name, the merge request's title. For the agreement
file the page offers "Add my signature". **Operations** `getEditContext`, `commitFile`, `previewPost`,
`stageAttachment`. **Without JavaScript** a textarea with the same save form. **Island** `Smithy/Islands/Editor.qvue`
over `m-code-editor`. **Phone** the editor fills the width and the save form follows it.

## 10. Pipelines and deploys

Built in DG5 and DG10, and refined in those phases: the engine and its records are the framework's (F7, F8), and the
names in [§14.5](#145-framework-records-for-ci-proposed) are proposals to it. What is fixed here is what Smithy needs.

**What Smithy needs from the engine**

- Runs listed and read by repository, ref, event, merge request and state, each with a number in its repository
  (`GitPipelineRun.runNum`).
- A job's log readable while it runs, by chunks after a sequence number (`GitRunLogChunk`), and as one blob when it
  has ended.
- Failed tests of a job as rows (suite, name, file, line, message) from the parsed JUnit reports.
- Artifacts and reports as downloads with size and checksum.
- A `trusted` mark on a run and a waiting state for approval, with services to approve, cancel and retry.
- Secrets that are write-only through the services (a read gives names and scopes), environments, and runner pools
  with a `trusted` mark.
- Each job's `GitCommitStatus` with the context `ci/<pipeline>/<job>` and the run's page as its target. The engine
  asks Mantle for the address (`git-ci` `run-url-service`, `mantle.smithy.SmithyPipelineServices.get#RunUrl`), since
  it knows no page.
- A hook before a run is queued (`git-ci` `run-check-service`, `mantle.smithy.SmithyPipelineServices.check#Run`),
  which answers allow, wait for approval, skip or refuse, whether the run is trusted, its owner and its pool. A hidden
  repository runs nothing, and `git-server` `outbound-check-service` (`SmithyGitServices.check#Outbound`) holds its
  webhooks, mirror pushes and fetches.

**The rules Smithy adds** (Dogfood §8.4, question 10), in `check#Run`:

- A run for a fork's merge request, for a pushed-to-review merge request, or asked by an account without Developer is
  **untrusted**: no secrets, a read-only cache, the group's outside pool.
- The first run of a contributor who has no merged merge request in the repository **waits** for a Maintainer's
  "Approve and run" (`approvePipelineRun`); an approval is for one head and its pusher: each new head of an outside merge request waits again until every account whose code runs (the author and the head's pusher) has had a merge request merged in the repository by another account, through a merge that changed the target (decided with the user, Nov 14, 2026; it replaces "the approval covers later heads").
- A repository in a personal namespace has no runs unless an operator gave the account runner minutes
  (`SmithyAccount.runnerMinutesMonthly`, default 0).
- Runner minutes are counted by month for the group or the account (`SmithyRunnerUsage`); a run that would start over
  the limit is refused with `quotaExceeded`, and the status says so.
- The gate's daily limit for pipeline runs applies to runs an account asks for by hand and to its outside runs.
- Pipelines off (`pipelinesEnabled` `N`) queues nothing.

### Pipelines

**Path** `B/<repositoryPath>/-/pipelines`. **Shows** runs, newest first: number, pipeline, event, ref or merge
request, the commit, who, state, duration; filters by ref, event and state; Run pipeline for a Developer (a pipeline
with the manual event, a ref). A repository with no `ci.xml` that is a Moqui component shows the built-in pipeline
(D11) by name. **Operations** `findPipelineRuns`, `runPipeline`. **Without JavaScript** all of it.

### PipelineDetail

**Path** `B/<repositoryPath>/-/pipelines/<n>`, `…/jobs/<jobRunId>`. **Shows** the run's header (state, event, ref,
commit, who, times, trusted or not, waiting for approval), its jobs in the order `needs` gives with state and
duration, and for one job its steps, its log, its failed tests (name, file and line as a link to Blob at the commit,
message), and its artifacts and reports as downloads. Cancel and Retry for a Developer, Approve and run for a
Maintainer. **Operations** `getPipelineRun`, `getJobRun`, `getJobLog`, `downloadArtifact`, `cancelPipelineRun`,
`retryJobRun`, `approvePipelineRun`. **Without JavaScript** all of it; a running job's log is the page so far, with a
Refresh link. **Island** `Smithy/Islands/JobLog.qvue` appends new chunks by polling `getJobLog` every two seconds
while the job runs; tailing over the notification socket is refined in DG5. **Phone** the job list is a row of chips
above the log, and the log scrolls sideways.

### Deploy environments (DG10)

A tab of RepositorySettings › Pipelines and a list on Pipelines. An environment (`GitCiEnvironment`) names a target
instance (its URL and a token, kept encrypted), the pipeline that must have passed for a commit, and whether a
Maintainer's approval is needed. `requestDeploy` (Developer) makes a `GitDeployment` for a commit: the engine runs the
environment's pipeline with the deploy event, waits for `decideDeploy` when approval is needed, then runs the deploy
step (Component-Deploy's fetch, preview and deploy on the target). The gate on the target instance, which refuses a
commit with no passed run of the pipeline, is the framework's. **Operations** `findCiEnvironments`,
`storeCiEnvironment`, `deleteCiEnvironment`, `findDeployments`, `getDeployment`, `requestDeploy`, `decideDeploy`,
`cancelDeploy`. Refined in DG10.

**Settings › Pipelines › Environments** (Maintainer): each environment's name, target URL, whether its vault holds its token,
required pipeline, who waits for a Maintainer's approval (every deployment, or only one of a branch no rule protects), data types, allowed branches, clone URL and last deployment; add and
edit (an https target and a clone URL with no user part, and the vault of the target's token, an operational vault the
Maintainer is a member of: the token is that vault's item bound to `GitCiEnvironment:<environmentId>:targetToken`,
made by a member in their client, and no field takes it; plans/Vault-Instances.md §4.6 of mr-moqui), Delete asked
again. **Deployments** at `B/<repositoryPath>/-/pipelines/deployments` (Developer): the
deployments, newest first, a page at a time (environment, commit, branch, state, who asked, dates), and Request deploy
(an environment and a branch, whose head is deployed) where `canDeploy`. **DeploymentDetail** at
`…/-/pipelines/deployments/<deploymentId>`: the state and its steps (waiting for the pipeline with its run linked,
waiting for approval, deploying, the end), who asked and who decided, the authority's message when it gives one, the
target's result; Approve and Refuse (with a reason, asked again) for an approver (`canDecide`), Cancel (asked again)
where `canCancel`. A deployment whose environment's vault holds the target's token has a lease (`lease`: waiting for an
approver of the vault, named; approved and by whom; ended), and approving it is opening the lease: Approve takes a
Maintainer with the vault's approve role on to the framework's lease dialog (System › Vaults › Lease, at the authority's
web address for a remote frontend), where their approval of the lease deploys it; any other Maintainer is told who
approves it (`vaultApproverRequired`). **Without JavaScript** all of it.

## 11. Settings, account and import

### RepositorySettings

**Path** `B/<repositoryPath>/-/settings/<tab>`. Maintainer and higher; Not Found for others. A tab the caller's role
does not reach is absent.

| Tab | Minimum | Shows | Operations | Stage |
| --- | --- | --- | --- | --- |
| General | Maintainer | name, description, default branch, default merge method, the features (issues, merge requests, pipelines, forum, docs), the docs directory | `getRepository`, `updateRepository` | DG2 |
| Members | Maintainer reads, Owner changes | members of the repository and those inherited from its groups; add by handle, role, end date | `findRepositoryMembers`, `setRepositoryMember` | DG2 |
| Branch rules | Maintainer | each rule: pattern, force push, delete, require a merge request, approvals, dismiss stale approvals, required contexts, merge methods | `getBranchRules`, `storeBranchRule`, `deleteBranchRule` | DG2 |
| Webhooks | Maintainer | URL, events, active, the last delivery; Test; deliveries | `findWebhooks`, `storeWebhook`, `deleteWebhook`, `testWebhook`, `findWebhookDeliveries` | DG2 |
| Mirrors | Maintainer | each push mirror: URL, refs, delete refs, enabled, has a credential, the last push, its result and error, the next attempt; add and edit (an https URL with no credential, username and secret apart, the secret write-only), Delete asked again, Push now. The framework's mirrors (F6), stored as the Maintainer, whose right is checked at each push (a mirror whose giver is no longer a Maintainer pauses); a new destination (scheme, host, port, user, host key) needs the secret again (`secretRequired`); a failure is told to the repository's Maintainers and Owners | `findMirrors`, `storeMirror`, `deleteMirror`, `pushMirror` | DG8 |
| Pipelines | Maintainer | secrets (names and scopes; a value is write-only), environments, the pools in use | `findCiSecrets`, `storeCiSecret`, `deleteCiSecret`, `findCiEnvironments`, `storeCiEnvironment`, `deleteCiEnvironment`, `getPipelineSettings` | DG5/DG10 |
| Agreement | Owner | inherit, off or required; the file; the rules it changes | `getAgreement`, `setAgreement` | DG4 |
| Forum | Owner | the repository's subcategory: on, off, link | `setScopeForum` | DG6 |
| Archive | Owner | visibility, rename, transfer, archive and unarchive, delete (typed path to confirm) | `setRepositoryVisibility`, `renameRepository`, `transferRepository`, `setRepositoryArchived`, `deleteRepository` | DG2 |

**Without JavaScript** all of it. Each audience-widening or destructive save names the target, the count of what
changes and the consequence before it is confirmed. A webhook's URL is checked by the framework's outbound rules; a
secret is never shown again after it is saved.

**Delete** removes the Smithy rows and the hosted repository (`delete#GitRepository`, which the framework does not
have yet: N-DELETE), and keeps the tasks of its issues in their project: the issues leave Smithy with the repository,
and Projects keeps the work items. A repository with forks, or with a release asset, is refused until those are gone.

**A new repository** (`createRepository`, DG2):

- `repositoryId` is a sequenced id, never the path, so a rename or a transfer changes no key.
- Its kind is the site's (`SmithySite.repositoryKind`, default `db`; a dev shop may set `local`). A caller does not
  choose it.
- Its default branch is `main`. "Start with a README" makes the first commit, by the account.
- It has no member rows: in a group its members are the group's; in a namespace its Owner is the account.
- Issues, pipelines, forum and docs start off, merge requests on.

**Quotas** (DG2). Usage is the framework's to report (N-USAGE: a repository's stored bytes without the objects it
shares with its fork parent, and its LFS bytes): Smithy does not read `GitObject` or `GitLfsObject`. A push is
checked by `check#Push` (§5.5) against the namespace's limit. LFS uploads do not pass pre-receive, so the LFS limit
is checked by a hook of the LFS batch API before an upload is accepted (N-LFS-HOOK), which calls
`mantle.smithy.SmithyGitServices.check#LfsUpload` with the repository, the user and the bytes. A count of
repositories (`maxRepositories`) is an account's limit only; a group has none.

**Before the gate** (DG2; the gate is DG3's, §12.2). DG2's writes that store a name or a description
(`requestGroup`, `createSubgroup`, `updateGroup`, `createRepository`, `updateRepository`) call
`ForumCore.sanctioned` (a suspension or a silence in the site refuses, `Unauthorized`) and `applyRules` on the text
(a `block` or an `approve` rule refuses, `Unprocessable`) directly, after `requireConfirmed()`. An account has at
most one group request waiting (`Conflict`). There is no daily limit in DG2: an account's repositories are bounded
by `maxRepositories`. DG3 moves these calls into the gate with the kinds `repository` and `group`, and DG6 adds
their daily limits (`limitReached`).

### SiteSettings

**Path** `B/-/site/<tab>`. The site's owners and operators only (`PublicSiteParty.role` `owner`, or
`ForumCore.isOperator()`); a site moderator has no part in it. The same holds for every operation of this screen.

| Tab | Shows | Operations | Stage |
| --- | --- | --- | --- |
| Settings | the home group; who may create a group, a personal repository, a fork (operators, by request, any confirmed account); the kind of a new repository (`db` or `local`); default quotas; the edit size limit | `getSmithySettings`, `storeSmithySettings` | DG2 |
| Requests | group requests waiting, with the requester and the reason; approve or refuse with a reason | `findGroupRequests`, `decideGroupRequest` | DG2 |
| Quotas | an account's or a group's limits and usage; mark an account as a bot with its operator | `getQuotaUsage`, `setQuota` | DG2 |
| Redirects | the table of old paths | `findRedirects`, `storeRedirect`, `deleteRedirect` | DG7 |

Defaults (question 8): a group by request (`ScpRequest`); a personal repository and a fork for any confirmed account
(`ScpVerified`); 5 personal repositories, 1 GiB a repository, 1 GiB of LFS for an account; no runner minutes for a
personal namespace. A dev shop sets operators only.

### GitAccess

**Path** `<account base>/GitAccess`, and a card of the Account hub (`get#AccountCard`: the counts of keys and tokens).
**Shows** the account's SSH keys (name, fingerprint, added, last used) and access tokens (name, created, expires, last
used), with Add and Remove. A new token is shown once. The page says which address clones over SSH and that a push
needs a confirmed address. **Operations** `findGitAccess`, `addSshKey`, `removeSshKey`, `createAccessToken`,
`revokeAccessToken`. **Without JavaScript** all of it. Each change asks for the password or the second factor again
when the session is older than the framework's re-authentication window, as Account's security actions do. The page
and its card are Smithy's: on a site that does not mount Smithy the page is Not Found and the hub has no card.

### Import

**Path** `B/import`, `B/import/<importId>`. An operator, or the Owner of the group the import goes to; Not Found for
anyone else. **Shows** at `B/import/<importId>` the run: its stage, counts by type (imported, seen at GitHub, failed), a
wait on GitHub's rate limit with the time it goes on, the items that could not be carried and what an import never
carries, Resume (with a token, needed once the run ended) and Cancel (asked again); at `B/import` the site's imports,
for an operator. The start form (the GitHub repository `owner/name`, a token that is never shown again, a new
repository or one of the group's, issues and pull requests, publishPrivate with its warning) is on the Import tab of
the group's Settings, with the group's imports; the group is the tab's, so the form does not ask for it. **Operations**
`startGitHubImport`, `getGitHubImport`, `findGitHubImports`, `resumeGitHubImport`, `cancelGitHubImport`. **Without
JavaScript** all of it; the run's page refreshes by a link. The mapping is [§18.2](#182-the-github-import).

## 12. Conversations, the gate and moderation

### 12.1 Where a conversation lives (question 3)

**Decision.** The conversation of an issue or a merge request is a `ForumTopic` of a new kind, `record`, beside
`category` and `private`. Its `ForumTopic.contactListId` is the **scope category**: the repository's category
(`SmithyRepository.contactListId`), else the category of the nearest group above it (a group always has one), else,
for a repository in a personal namespace, the site's account category (`SmithySite.accountContactListId`). Its
posts' `CommunicationEvent.contactListId` is empty, as a private conversation's is.

**Why the kind and not a flag on a category.** Read in the forum's code. `kind` has no enumeration; `category` and
`private` are defined by the writers, and `ForumCore.topic()` denies any other kind to everyone today.

- **Out by an explicit kind filter:** `findTopics` (latest, tag, author, top), `getFeed` (RSS and the sitemap), the
  legacy mailbox summary, the digest (`digestTopics`, `prepareDigest`) and `ForumOperations`' topic find (counters,
  export). A topic of another kind is in none of them with no change.
- **Out because the event's `contactListId` is empty:** `searchForum` (it reads `ForumPostSearch` by the event's
  `contactListId`), the activity counts and CSV, `previewCategoryAccess`, category watchers, and Comms' mailbox lists.
  This holds for that reason, not for the kind, so a record post's event must never get a `contactListId`.
- **Out only because `topic()` denies the kind:** everything that calls `topic()`. These open the moment DG3 adds the
  branch, and each needs its rule (the list below).
- `ForumCore.topic()` already branches on the kind (`private` goes to `privateTopic`). A third branch gives record
  topics their own access rule, which an issue needs: any confirmed viewer of the repository may reply, and a
  category's posting rule (list membership) would be wrong.
- Moderation takes its scope from a `contactListId`: `ForumReviewItem.contactListId`, `ForumModerationAction`,
  `ForumSanction`, `ForumRule`. Giving the topic the repository's category makes the scope the repository's with no
  new field (Dogfood §6.4, "a scope"). Who may read and decide a record's review item is narrower than the category's
  staff (item 6 below).

A hidden category for each repository's issues was the alternative. It would add a category to every tree, count and
access walk that then has to leave it out, and its posting rule would still be wrong.

**The changes this needs in `mantle.forum` and beside it** (DG3, the Mantle lane; N-KIND). Every path is named, so
that none is found later by a leak.

1. `ForumCore.topic()`: `kind === 'record'` goes to `recordTopic(t)`, which asks the scope module for the access and
   answers `missing()` when the caller may not read.
2. `PublicApps.apps.smithy.scope` names the scope module, `SmithyScope.js`, which `ForumCore` loads when the app is
   registered. It exports:
   - `recordAccess(rootCommEventId, actorPartyId)` (not `conversationAccess`, which is `ForumCore`'s name for a
     private conversation's access): finds the `SmithyIssue` or `SmithyMergeRequest` by its unique `rootCommEventId`
     and returns the evaluator's shape (`canRead`, `canReply`, `canEdit`, `canUpload`, `canFlag`, `canReact`,
     `canModerate`, `category` with the scope's `contactListId`), or null.
     - `canRead` is the record's read rule (§5, §8.3).
     - `canReply`, `canEdit`, `canUpload`, `canFlag` and `canReact` need a confirmed address (§5.5), a reader who is
       not silenced, and a repository that is not archived. So Forum's `setReaction`, `flagPost` and `updatePost`,
       which check no address themselves, are refused for an unconfirmed account on a record.
     - `canModerate` needs view of the record first. Then: for a confidential issue, its Owners and operators only;
       for any other record, an Owner of the scope (`categoryOwner`), or the site's or the category's moderators who
       may view the repository. A site moderator who may not view a private repository does not moderate its
       conversations.
   - `postAccess(postId, actorPartyId)`: whether the party may read one post (a `staff` post: Owners only; a pending
     one: its author and the record's moderators).
   - `categoryOwner(contactListId, actorPartyId)`: whether the party is Owner of the group or repository the category
     is bound to. `evaluateCategoryAccess` adds it to `moderate`, so an owner moderates the scope they own.
   - `recordPage(rootCommEventId)`: the page's path and title, for mail and notifications.
3. **Writers.** `publishPost` and `updatePost` write a record topic with the event's `contactListId` empty, the review
   item's `contactListId` the topic's, and no internal recipient rows (`allocateInternal` is skipped). `updatePost`
   calls the gate (§12.2) for the new revision, for every kind of topic.
4. **Refused for a record topic** (`Unprocessable`, each checked by kind before `topic()`'s result is used): tags and
   polls; drafts bound to it other than a reply's; `acceptAnswer`; `applyTopicAction` in every form (move, merge as
   source or as destination, split, which today makes a `kind: 'category'` topic from the selected posts, pin, unlist,
   slow mode, timers, wiki); `fireTimer`; `createCaseFromTopic`, `caseReply` (`publishCaseReply`),
   `draftArticleFromTopic`; `getTopicLinks` returns nothing. A record's posts are closed, reopened and hidden through
   Smithy's operations and `decideReview`, never moved into the forum.
5. **Readers that open with the branch**, each applying `recordAccess` and, for a post, `postAccess`: `getTopic`,
   `getPosts`, `getPostLocation`, `getPostHistory`, `findNotifications`, bookmarks, `markRead`, `setPreferences`,
   `findTags` counts (a record has none), and UniversalSearch results (a record post is returned by Smithy's search
   only, §13.5).
6. **The review queue.** For a review item whose target is a post of a record topic, `findReviews`, `getReview`,
   `claimReview`, `addReviewNote`, `decideReview`, `decideReviews`, `escalateReview` and `findActions` ask
   `recordAccess(...).canModerate`, not `staff(siteId, contactListId)`. BOSS Comms Moderation
   (`ironstone.comms.ModerationServices`) lists them through the same services and so gets the same answer.
   `findMyReviews` and `exportPersonal` give an author their own posts only, as today.
7. **The classifier.** `queueClassification` and `classifyPost` skip `private` today. They also skip every post of a
   confidential issue, so its text never goes to the external classifier service. Posts of other records are
   classified as forum posts are.
8. **Delivery.** `DeliveryWorker.audience` and `candidateSources` test only `private` today; a record takes its own
   branch: the topic's watchers, mentions and the parent post's author are candidates, each kept only when
   `recordAccess` and `postAccess` let that party read that post. The link is `recordPage`'s, with a reply token as
   any post has and the repository's list headers ([§12.4](#124-mail-in)). A `staff` post is mailed to Owners only.
9. **Readers outside the forum that have no kind check**, each given a `record` exclusion (a join to `ForumTopic` by
   the root, or the event's missing `contactListId` with the kind):
   - the search document of `CommunicationEvent` (`MantleDocumentData.xml`), which also feeds mr-marble's "Message
     Updated" notifications: record posts are not indexed there;
   - `mantle.party.CommunicationServices` `get#InternalThreadMessages`, which checks only `private` and applies no
     forum rule to an event without a category: a record thread is refused;
   - `find#PartyCommunicationEvents` (Mantle's REST) and `get#RecordTimeline`: record posts are left out.
10. **Mutations.** Retention tombstones treat a record post as a forum post (the text removed, the row kept);
    `Bootstrap.convert#Root` never touches a record topic.
11. A post kind `event` (a state-change line) and the visibility `staff` (§8.3) on `ForumPostState`.

`PublicDiscussionLink` is not what binds a record to its conversation: the two rows above hold it. The link's new
source types `issue`, `mergeRequest` and `release` (DG6) are for a forum topic that discusses one, and for a
release's announcement.

### 12.2 The post gate

One function in `ForumCore.js`, extracted from the checks of `Forum.js` `methods.publishPost` (DG3). `publishPost`,
`updatePost`, `postInbound` (mail) and every Smithy write that stores public text call it, and no Smithy write reaches
a row another
way.

```
gate({
  siteId, actorPartyId,
  contactListId,        // the scope category
  kind,                 // 'topic' | 'reply' | 'issue' | 'comment' | 'mergeRequest' | 'review' | 'reviewComment'
                        // | 'fork' | 'repository' | 'group' | 'pipelineRun'
  title, body,          // sanitized html of the revision; either may be absent
  sourceFormat,         // 'html' | 'markdown'
  canModerate,          // the caller moderates the scope: limits and holds do not apply
  isPrivate,            // a private conversation: no first-post hold
  slowIntervalSeconds, rootCommEventId,   // a reply in a topic in slow mode
  mailVerdict,          // { spam: boolean, reason } when the text came by mail (DG6)
}) -> {
  decision,             // 'allow' | 'hold' | 'refuse'
  reasonFamily,         // for a hold: 'first-post' | 'rule' | 'mail-verdict'
  refusal,              // for a refuse: { kind: 'Unauthorized' | 'Tarpit' | 'Unprocessable', reason, message }
  body, title,          // after censor rules
  flag,                 // a rule asked for a review item on an allowed post
  memberState,          // the locked ForumMemberState row
}
gateCommit(result, { pending })   // after the write: lastPostedAt, the day's counters, approvedContributions
```

The checks, in order; the first that fails decides:

1. D17: `requireConfirmed()`. Refuse `Unauthorized` (`addressUnconfirmed`).
2. Sanctions: a suspension in the site, or a silence in the site or the scope. Refuse `Unauthorized`.
3. The interval between posts (`postIntervalSeconds`) and a topic's slow mode. Refuse `Tarpit`.
4. The day's limit for the kind at the actor's trust level (the table below). Refuse `Tarpit` (`limitReached`).
5. For text: length (`maxPostLength`; a title at most 250), and the links, images and mentions the trust level allows.
   Refuse `Unprocessable`.
6. The rules (`applyRules`) on the body and on the title. A `block` rule refuses (`Unprocessable`); a `censor` rule
   changes the text; an `approve` rule holds (`rule`); a `flag` rule sets `flag`.
7. The mail verdict: spam holds (`mail-verdict`).
8. The first contributions (`firstContributionCount`, of approved contributions of any kind in the site): hold
   (`first-post`).
9. Else allow.

Steps 3 to 8 are skipped for a caller who moderates the scope, as `publishPost` skips them today. A name's text (a
group's or repository's name and description, a label, a milestone) passes steps 1, 2, 5 and 6 with the kind
`repository` or `group`, and a `hold` there is a refusal: a name is not kept pending.

**Limits by trust level, a day.** The forum's two rows are `TRUST_EFFECTS` today. The others are new keys of it, set
by the site's policy like the rest.

| Kind | Counter | New | Basic | Member | Regular |
| --- | --- | --- | --- | --- | --- |
| `topic` | `dailyTopics` | 3 | 10 | 20 | 20 |
| `reply`, `comment`, `review`, `reviewComment` | `dailyReplies` | 10 | 50 | 100 | 100 |
| `issue` | `issue` | 3 | 10 | 20 | 20 |
| `mergeRequest` (a page edit that opens one included) | `mergeRequest` | 2 | 10 | 20 | 20 |
| `fork` | `fork` | 2 | 5 | 20 | 20 |
| `repository`, `group` | `repository` | 1 | 3 | 10 | 10 |
| `pipelineRun` (asked by hand, or an outside run) | `pipelineRun` | 5 | 20 | 50 | 50 |

The new counters are keys of `ForumMemberState.dailyCounts` (new, JSON, reset with `dayKey`). Trust is the party's in
the site: what was earned in the forum counts for a first issue, and an approved issue counts toward the forum's
levels. The gate with the kinds `issue` and `comment` is DG3's, and DG3 moves DG2's direct checks of names into it
(the kinds `repository` and `group`, §11 "Before the gate"); `mergeRequest`, `review` and `reviewComment` are
DG4's; the limits for `fork`, `repository`, `group` and `pipelineRun` are DG6's (until then those kinds pass steps 1,
2 and 6 only).

**Every write that stores public text lists the gate's refusals.** Besides the operations §15 marks: `updatePost`
(a new revision), `ensure#Issue` (§8.1), `convertTopicToIssue` and `setIssueConfidential` with `asNewIssue` (the new
title and text), `updateIssue`, `updateMergeRequest` (the title), `storeLabel`, `storeMilestone`, `storeRelease`,
and from DG3 `updateGroup`, `createSubgroup`, `requestGroup`, `createRepository` and `updateRepository` (name and
description).

**A hold.** The row is written with its first post `pending`, and a `ForumReviewItem` (target `post`, the scope's
`contactListId`, the reason family) is filed with `ForumCore.review`. The author sees their item with "Waiting for
review"; the scope's moderators see it in the queue; everyone else gets Not Found. Approval by the forum's
`decideReview` publishes it and queues the mail.

### 12.3 Moderation targets: Report and Hide

- New `ForumReviewItem.targetType` values `repository` and `group`, with `targetId` the `repositoryId` or `groupId`
  and `contactListId` the scope category (DG6). The values today are `post`, `topic`, `account` and `review`.
- **Report** (`reportSmithyTarget`): a confirmed viewer reports a repository or a group with a reason and a note. It
  files a review item of the family `flag`, one active item a target, with each report kept (`ForumReviewReport`), as
  a flagged post is.
- **Hide** (`hideSmithyTarget`): sets `hiddenAt`, `hiddenByPartyId` and `hideReason` on the row and writes the audit
  (`ForumCore.audit` with the target type). A hidden repository or group is Not Found to all but its Owners and the
  site's staff, on the pages and in git. Who may hide: an Owner of a group, for a repository or subgroup of it; the
  site's owners, moderators and operators, for anything. What staff hid, an Owner cannot unhide.
- `decideReview` for these target types offers Dismiss and Hide, through a handler `SmithyScope.js` exports
  (`decideTarget`).
- **The pages.** `Smithy/Moderation` shows the forum's moderation screens (`Forum/Moderation/ReviewQueue`,
  `ReviewDetail` and `Log`) for the scope's category and its subtree, inside the group's or repository's shell, for the
  Owners who are public accounts. Internal moderators use BOSS Comms as now.
- **Held items** are shown to the Owners of the scope, which is how a report by mail from an unconfirmed sender waits.
- **The controls** (DG6): Report is in the overflow menu of a repository's and a group's shell, for a confirmed
  viewer. Hide and Unhide are on `Smithy/Moderation`'s review detail for the target, and on the Archive tab of
  RepositorySettings and the Delete tab of GroupSettings for those who may hide.
- **A private group's category.** A category bound to a group or repository takes its readers from Smithy: for
  `SmvPrivate` its readers and posters are the accounts with a Guest role or higher (`evaluateCategoryAccess` asks the
  scope module, as it asks `categoryOwner`), not list members. For `SmvMembers` and `SmvPublic` the category's own
  `members` and `public` visibility say the same thing already (DG6).
- Smithy has no moderation rows of its own (D18). The services and rows keep their `Forum` names.

### 12.4 Mail in

- **Reply by email** to an issue's or a merge request's mail is the post engine's: the reply token names the topic,
  and `postInbound` posts through the gate as the confirmed sender.
- **The mail verdict** (DG6): the listener or the email ECA passes the gateway's spam verdict to `processInbound`,
  which gives it to the gate as `mailVerdict`; spam is held.
- **List headers.** A category in mailing-list mode has its own `List-Id`, `List-Post` and `List-Archive`
  (`DeliveryWorker.js` writes one `List-Id` a site today). A record topic's mail carries
  `List-Id: <repositoryPath with / as .>.<host>`, so a mail filter can tell a repository's mail.
- **A security address** (`storeIssueMailRoute`): a `ForumMailRoute` with the new `targetType` `issue` and `targetId`
  the repository. A message to it from a confirmed address files a confidential issue as that account. A message from
  any other address is not posted: the sender gets one reply with a link, and the message waits as a held item
  (`ForumReviewItem` of family `mail-held`, its text in `detail`) that the Owners read in the queue, and nobody else
  (item 6 of §12.1). The link is `B/-/held-report/<token>` (§4.4), which leads to Register or Sign in and back; when
  the account's confirmed address is the sender's, `claimHeldReport` files the issue from
  the held message. A held message is dropped after 30 days.
- The mailing lists themselves (the mbox importer, the invitations, the cutover) are the forum's and are in
  design-forum and Dogfood §6.3; DG6 builds them there.

### 12.5 The forum inside Smithy

- **Categories.** A group has a category (a MAILBOX `ContactList` and a `ForumCategory`, published with the group,
  its visibility no wider than the group's): it is the scope even when the group shows no forum. It is made by
  `ensure#GroupCategory` from DG3, when a group becomes active and, for a group made in DG1 or DG2, on first need. A
  top-level group's category is under the site's forum root, and a subgroup's is a child of its parent group's. A
  repository gets a subcategory only when its Forum is turned on
  (`setScopeForum`), under its group's category. `setScopeForum` may link an existing category of the site in place of
  making one, when the caller owns it. A visibility change of the group or repository narrows the category in the
  same transaction.
- **Scope and link base.** `screen/Shared/View.js`, `Page.html.fancy`, `Header.html.fancy` and
  `TopicEnhance.html.fancy` take a **scope** (`scopeContactListId`: a category and its subtree) and a **link base**
  where they use `bases.forum` today. Forum's reads (`findTopics`, `findCategories`, `searchForum`, `getFeed`) take
  `scopeContactListId` and return only the subtree. A topic of another category asked for inside a scope is Not Found
  there.
- **Topic to issue.** `convertTopicToIssue` (a Reporter of the repository who may read the topic) makes an issue whose
  text quotes the selected posts and links the topic by `PublicDiscussionLink` (source type `issue`), on
  `create#CaseFromTopic`'s model. The topic stays. Its control is "Make an issue" in the topic tools of a topic shown
  in a group's or a repository's forum (GroupForum, RepositoryForum), which asks for the repository, the title and
  the posts. The new issue's title and text pass the gate as the caller's.
- **A release's announcement** is a topic of the group's announcements category, linked with the source type
  `release` (§13.3).

## 13. The site

Built in DG7 and refined there. The site is Smithy (D15).

### 13.1 Landing

The home group's Overview is the landing page of the site. Its text is a Markdown file of a content repository:
`SmithyGroup.landingRepositoryId` and `landingPath` (for example `moqui/site`, `landing.md`), read at the default
branch through the framework's `git://` location, rendered with `ec.resource.markdownHtml` and cleaned. It is edited
as any file is (§9.5). Around it: pinned repositories (`SmithyRepository.pinnedSequence`), the latest release of the
group's repositories, news (the latest topics of `SmithyGroup.newsContactListId`, an announcements category, with its
RSS), and activity. `setGroupLanding` is the Landing section of GroupSettings' General tab (DG7). Other pages of the
site (the license, the AI policy, how to contribute, the board) are files of
the same repository, shown by Docs.

### 13.2 Docs

**Screen Docs**, `B/<repositoryPath>/-/docs/<refPath>`. **Shows** a Markdown file of the repository's docs directory
(`SmithyRepository.docsPath`, default `docs`) at a branch or tag: the page, a ref picker, a table of contents from the
directory tree (`README.md` of a directory is its index), the page's headings, "Edit this page" (§9.5), and the docs
search box. `docs` with no path shows `README.md` of the directory at the default branch.

- Relative links between Markdown files become Docs links at the same ref; a link to another file of the repository
  becomes a Blob link; an image is served from Raw at the same ref. A path that leaves the repository is not followed.
- Heading anchors are stable (the lower-cased text with `-`), so old deep links can be mapped.
- The rendered page is cached by blob id.

**Operations** `getDocsPage`, `findRefs`, `searchSite` (`types` `docs`). **Without JavaScript** all of it. **Phone**
the contents are a drawer above the page.

### 13.3 Releases

A release is Mantle's release (`WetRelease`) of the repository's project, with its tag (a `WorkEffortGitRef` of the
tag), its published notes, and assets.

- `SmithyReleaseAsset`: a file a pipeline uploaded for the tag (a `GitRunArtifact` of a run for that tag, copied so
  its retention does not remove it) or one a Maintainer uploads, with its size and SHA-256; or a container image's
  name. The file is at the row's `contentLocation`, read and written through `ec.resource`; the row names no blob.
- Downloads are public for a repository the caller may view, at `-/release-assets/<assetId>/<name>`.
- Publishing a release may announce it (`storeRelease` with `announce`): a topic in the group's announcements
  category, linked.
- A draft release is visible to Maintainers only.

**Screens Releases and ReleaseDetail.** **Shows** releases newest first with tag, date, notes and assets with their
checksums; one release with the same and the source archives of its tag. **Operations** `findReleases`, `getRelease`,
`storeRelease`, `deleteRelease`, `addReleaseAsset`, `removeReleaseAsset`, `downloadReleaseAsset`. **Without
JavaScript** all of it.

### 13.4 The component directory

- A repository whose root has a `component.xml` at the default branch is a Moqui component. A post-receive gitECA rule
  reads it when the default branch or a tag moves and keeps `componentName`, `componentVersion` and
  `componentDependsOn` on `SmithyRepository`.
- Explore's Components list and `findComponents` show name, version, dependencies, repository and latest release, for
  what the caller may view.
- A group serves `B/<groupPath>/-/addons.xml`: the public components of the group and its subgroups, in the format
  `./moq component-get` reads, each with its clone address and its release tags. A `myaddons.xml` entry of the server
  lets `component-get` take a component from it. Members-only and private components are not in it; a team's group
  server serves those to a token, refined in DG7.

### 13.5 Search

One box over the public projections of each app, each keeping its own access rule (design-forum §13.1).

| Type | Source | Rule applied before a snippet or a count |
| --- | --- | --- |
| `repository`, `group`, `component` | Smithy rows | the view rule of §5 |
| `issue` | `SmithyIssue`, the topic's approved posts | §8.2 and §8.3 |
| `mergeRequest` | `GitMergeRequest`, `SmithyMergeRequest`, the topic's approved posts | the view rule; a held one left out |
| `docs` | the docs directory at the default branch | the view rule |
| `topic` | Forum's `searchForum` | the forum's |

A stale index hit is checked against the current rule before it is shown. Code search is later (F12).

### 13.6 Redirects

`SmithyRedirect`: one table of old paths, of moqui.org and of forum.moqui.org, to new ones, checked in DG7 against
the inventory ([§18.1](#181-inventories)). The host's request for a path no app's mount and no Smithy name takes is
looked up there before Not Found. Forum's `ForumLegacyUrl` keeps the Discourse URLs.

## 14. Data model

### 14.1 Existing records relied on

| Record | Used for |
| --- | --- |
| `mantle.public.PublicSite`, `PublicSiteApp`, `PublicSiteParty`, `PublicSiteProfile` | the site, the mount, site membership (the `SmvMembers` audience, site staff), the handle that is a personal namespace |
| `moqui.resource.GitRepository` and the other `Git*` rows of §3 R12 | the hosted repository; `description`, `branch`, `archivedDate`, `storedBytes`, `repositoryKind` are read from it and not copied |
| `mantle.work.effort.WorkEffort` (project, task, milestone, release), `WorkEffortParty`, `WorkEffortCategory`, `WorkEffortGitRepository`, `WorkEffortGitCommit`, `WorkEffortGitMergeRequest`, `WorkEffortGitRef` | issues, labels, milestones, releases and their links |
| `mantle.forum.ForumCategory` with its `ContactList` | the scope category of a group or repository |
| `mantle.forum.ForumTopic`, `ForumPostState`, `ForumPostRevision`, `CommunicationEvent` | the conversation of an issue or a merge request |
| `CommunicationEventGitAnchor` | the line of a line comment |
| `ForumReviewItem`, `ForumReviewReport`, `ForumModerationAction`, `ForumSanction`, `ForumMemberState`, `ForumRule`, `ForumPolicy` | moderation, trust and limits; Smithy has no rows of its own for them |
| `ForumOperationReceipt` | idempotent writes (`ForumCore.receipt`) |
| `moqui.security.public.VerifiedAddress` | the confirmed address |
| `moqui.security.UserSshKey` and login keys | Git access |

### 14.2 Records of `mantle.smithy`

New, in mantle `entity/SmithyEntities.xml`. `*` marks a primary key field. Every row has `siteId`. Types are the
framework's field types. Ordinary last-updated stamps follow the repository's conventions. `revision` starts at 1 and
is checked with `expectedRevision` (`ForumCore.revision`).

**SmithySite** (DG1): one row a site that mounts Smithy; made with defaults on first read.

| Field | Type | Notes |
| --- | --- | --- |
| `siteId` * | id | `PublicSite` |
| `homeGroupId` | id | the group whose Overview is `B/`; empty: Explore |
| `groupCreateEnumId` | id | `SmithyCreatePolicy`; default `ScpRequest` |
| `repositoryCreateEnumId` | id | personal repositories; default `ScpVerified` |
| `forkCreateEnumId` | id | default `ScpVerified` |
| `accountContactListId` | id | the scope category of personal namespaces' conversations; made on first need by `ensure#AccountCategory` (DG3), under the site's forum root, readable by nobody as a category |
| `defaultMaxRepositories` | number-integer | an account's; default 5 |
| `defaultRepositoryBytes` | number-integer | an account's, a repository; default 1073741824 |
| `defaultLfsBytes` | number-integer | an account's; default 1073741824 |
| `defaultRunnerMinutes` | number-integer | an account's, a month; default 0 |
| `groupRepositoryBytes` | number-integer | a group's default, a repository; default 5368709120 |
| `groupLfsBytes` | number-integer | a group's default; default 5368709120 |
| `groupRunnerMinutes` | number-integer | a group's default, a month; default 2000 |
| `maxEditBytes` | number-integer | the page editor's limit; default 1048576 |
| `repositoryKind` | text-short | the kind of a new repository: `db` (the default) or `local`, the framework's `GitRepository.repositoryKind` values (DG2) |
| `revision` | number-integer | |

Relationship: one `PublicSite`.

**SmithyGroup** (DG1; settings fields used from the phase named)

| Field | Type | Notes |
| --- | --- | --- |
| `groupId` * | id | |
| `siteId` | id | |
| `parentGroupId` | id | empty for a top-level group |
| `pathSegment` | text-short | lower case, §4.2 |
| `groupPath` | text-medium | the full path, lower case (`moqui`, `moqui/addons`) |
| `name` | text-medium | |
| `description` | text-long | plain text |
| `avatarId` | id | as `PublicSiteProfile.avatarId` |
| `visibilityEnumId` | id | `SmithyVisibility` |
| `statusId` | id | `SmgRequested`, `SmgActive`, `SmgRefused` |
| `requestedByPartyId` | id | |
| `requestReason` | text-long | |
| `decidedByPartyId` | id | |
| `decidedAt` | date-time | |
| `decisionReason` | text-long | |
| `contactListId` | id | the group's category, made by `ensure#GroupCategory` from DG3 (§4.1); a subgroup's category is a child of its parent group's |
| `newsContactListId` | id | the announcements category (DG7) |
| `workEffortId` | id | one project for all of the group's repositories, optional (DG3) |
| `issueRepositoryId` | id | the group's tracker (DG3) |
| `landingRepositoryId` | id | DG7 |
| `landingPath` | text-medium | DG7 |
| `agreementEnumId` | id | `SmithyAgreement`; default `SmaInherit` (DG4) |
| `agreementPath` | text-medium | default `AUTHORS.md` |
| `runnerPoolId` | id | trusted runs (DG5) |
| `outsideRunnerPoolId` | id | untrusted runs (DG5) |
| `maxRepositoryBytes` | number-integer | empty: the site's default |
| `maxLfsBytes` | number-integer | the same |
| `runnerMinutesMonthly` | number-integer | the same |
| `hiddenAt` | date-time | DG6 |
| `hiddenByPartyId` | id | |
| `hideReason` | text-long | |
| `createdByPartyId` | id | |
| `createdAt` | date-time | |
| `revision` | number-integer | |

Indexes: `SMITHY_GROUP_PATH` unique (`siteId`, `groupPath`); `SMITHY_GROUP_PARENT` (`siteId`, `parentGroupId`,
`pathSegment`); `SMITHY_GROUP_CATEGORY` (`contactListId`). Relationships: one `PublicSite`; one `SmithyGroup` titled
Parent; one `ForumCategory`; one-nofk `Enumeration` for the two enum fields; one `StatusItem`. A subgroup inherits the
settings fields it leaves empty from the nearest group above.

**SmithyGroupParty** (DG1)

| Field | Type | Notes |
| --- | --- | --- |
| `groupId` * | id | |
| `partyId` * | id | |
| `siteId` | id | |
| `roleEnumId` | id | `SmithyRole`; audit-logged |
| `fromDate` | date-time | |
| `thruDate` | date-time | an end date; empty: none |
| `addedByPartyId` | id | |
| `revision` | number-integer | |

Index: `SMITHY_GROUP_PARTY` (`siteId`, `partyId`). Relationships: one `SmithyGroup`, one `Party`. One row a party a
group; a change of role updates it, and the audit log keeps the history.

**SmithyRepository** (DG1)

| Field | Type | Notes |
| --- | --- | --- |
| `repositoryId` * | id | `GitRepository` |
| `siteId` | id | |
| `groupId` | id | exactly one of `groupId` and `ownerPartyId` is set |
| `ownerPartyId` | id | a personal namespace |
| `slug` | text-medium | lower case, §4.2 |
| `repositoryPath` | text-medium | equal to `GitRepository.repositoryPath`; written only by `SmithyCore.setPath`, which writes both |
| `name` | text-medium | as typed |
| `visibilityEnumId` | id | `SmithyVisibility` |
| `issuesEnabled` | text-indicator | default `N` |
| `mergeRequestsEnabled` | text-indicator | default `Y` |
| `pipelinesEnabled` | text-indicator | default `N` |
| `forumEnabled` | text-indicator | default `N` |
| `docsEnabled` | text-indicator | default `N` |
| `docsPath` | text-medium | default `docs` |
| `workEffortId` | id | the project of its issues (DG3) |
| `contactListId` | id | its forum subcategory, when it has one (DG6) |
| `nextIssueNumber` | number-integer | starts at 1 (DG3) |
| `agreementEnumId` | id | `SmithyAgreement`; default `SmaInherit` (DG4) |
| `agreementPath` | text-medium | empty: inherited |
| `pinnedSequence` | number-integer | pinned on its group's Overview when set |
| `componentName` | text-medium | from `component.xml` (DG7) |
| `componentVersion` | text-short | |
| `componentDependsOn` | text-long | names, comma separated |
| `componentCommitId` | text-short | the commit it was read at |
| `hiddenAt` | date-time | DG6 |
| `hiddenByPartyId` | id | |
| `hideReason` | text-long | |
| `createdByPartyId` | id | |
| `createdAt` | date-time | |
| `revision` | number-integer | |

Indexes: `SMITHY_REPO_PATH` unique (`repositoryPath`); `SMITHY_REPO_GROUP` (`siteId`, `groupId`, `slug`);
`SMITHY_REPO_OWNER` (`siteId`, `ownerPartyId`, `slug`); `SMITHY_REPO_PROJECT` (`workEffortId`);
`SMITHY_REPO_COMPONENT` (`siteId`, `componentName`); `SMITHY_REPO_CATEGORY` (`contactListId`). Relationships: one
`GitRepository`, one `SmithyGroup`, one `Party` titled Owner, one `WorkEffort`, one `ForumCategory`. The fork parent is
`GitRepository.forkOfRepositoryId` and is not copied.

**SmithyRepositoryParty** (DG1)

| Field | Type | Notes |
| --- | --- | --- |
| `repositoryId` * | id | |
| `partyId` * | id | |
| `siteId` | id | |
| `roleEnumId` | id | `SmithyRole`; audit-logged |
| `fromDate` | date-time | |
| `thruDate` | date-time | |
| `addedByPartyId` | id | |
| `revision` | number-integer | |

Index: `SMITHY_REPO_PARTY` (`siteId`, `partyId`). Relationships: one `SmithyRepository`, one `Party`.

**SmithyAccount** (DG2; made when first needed): an account's Smithy settings in a site.

| Field | Type | Notes |
| --- | --- | --- |
| `siteId` * | id | |
| `partyId` * | id | |
| `githubLogin` | text-medium | lower case; set at a sign-in through the GitHub provider, or by the import for a placeholder; a GitHub Enterprise login is kept as `login@host` |
| `githubUserId` | text-short | GitHub's own id (a login can be renamed and reused, the id not): set by the import for a placeholder, moved to the account that claims it (DG8) |
| `githubHost` | text-medium | `github.com` (also when empty) or a GitHub Enterprise Server's host, from the API the import read |
| `placeholder` | text-indicator | `Y`: made by the import, not yet claimed (DG8) |
| `claimedAt` | date-time | |
| `bot` | text-indicator | DG4 |
| `botOperatorPartyId` | id | |
| `maxRepositories` | number-integer | empty: the site's default |
| `maxRepositoryBytes` | number-integer | the same |
| `maxLfsBytes` | number-integer | the same |
| `runnerMinutesMonthly` | number-integer | the same |
| `setByPartyId` | id | who last set a limit or the bot mark |
| `reason` | text-long | |
| `revision` | number-integer | |

Index: `SMITHY_ACCOUNT_LOGIN` unique (`siteId`, `githubLogin`); `SMITHY_ACCOUNT_GITHUB_ID` (`githubUserId`).

**SmithyGithubLink** (DG8): a GitHub id an account's sign-in proved, of no one site.

| Field | Type | Notes |
| --- | --- | --- |
| `userId` * | id | |
| `githubUserId` | text-short | |
| `githubHost` | text-medium | `github.com` or an Enterprise Server's host |
| `authFlowId` | id | the sign-in flow that proved it |
| `provenAt` | date-time | |

Written only by `handle#SsoLinked` (§18.2), so a claim made later, when a membership becomes active, claims only for
an id proven so and still the account's.

**SmithyPathRedirect** (DG2): the old path of a renamed group or handle.

| Field | Type | Notes |
| --- | --- | --- |
| `siteId` * | id | |
| `oldPath` * | text-medium | lower case |
| `redirectKindEnumId` | id | `SmithyRedirectKind`: `SrkGroup`, `SrkAccount` |
| `groupId` | id | the group that had the path |
| `partyId` | id | the account that had the handle |
| `createdAt` | date-time | |

**SmithyIssue** (DG3)

| Field | Type | Notes |
| --- | --- | --- |
| `repositoryId` * | id | |
| `issueNumber` * | number-integer | |
| `siteId` | id | |
| `workEffortId` | id | the task |
| `rootCommEventId` | id | the record topic |
| `confidential` | text-indicator | |
| `reporterPartyId` | id | |
| `createdAt` | date-time | |
| `revision` | number-integer | |

Indexes: `SMITHY_ISSUE_TASK` unique (`workEffortId`); `SMITHY_ISSUE_TOPIC` unique (`rootCommEventId`);
`SMITHY_ISSUE_LIST` (`siteId`, `repositoryId`, `confidential`). Relationships: one `SmithyRepository`, one
`WorkEffort`, one `ForumTopic`.

**SmithyMergeRequest** (DG4)

| Field | Type | Notes |
| --- | --- | --- |
| `mergeRequestId` * | id | `GitMergeRequest` |
| `siteId` | id | |
| `repositoryId` | id | the target |
| `rootCommEventId` | id | the record topic |
| `authorPartyId` | id | |
| `agreementStateEnumId` | id | `SmithyAgreementState`: `SmasOff`, `SmasSigned`, `SmasUnsigned`, `SmasPending`; an operation gives its code as `agreementState` |
| `agreementDetail` | text-long | JSON: who is missing what |
| `agreementCommitId` | text-short | the head it was computed for |
| `botOperatorPartyId` | id | the operator who declared |
| `botConfirmedByPartyId` | id | the Maintainer who confirmed |
| `runApprovedByPartyId` | id | "Approve and run" (DG5) |
| `runApprovedAt` | date-time | |
| `createdAt` | date-time | |
| `revision` | number-integer | |

Indexes: `SMITHY_MR_TOPIC` unique (`rootCommEventId`); `SMITHY_MR_REPO` (`siteId`, `repositoryId`).

**SmithyAgreementSignature** (DG4): a cache, rebuilt from the file.

| Field | Type | Notes |
| --- | --- | --- |
| `repositoryId` * | id | |
| `refName` * | text-medium | the branch |
| `listEnumId` * | id | `SmithyAgreementList`: `SalCopyright`, `SalPatent` |
| `login` * | text-medium | lower case |
| `siteId` | id | |
| `lineText` | text-medium | |
| `commitId` | text-short | the commit that added the line |
| `authorPartyId` | id | that commit's author, when an account |
| `blobId` | text-short | the file's blob the row was read from |
| `checkedAt` | date-time | |

**SmithyRunnerUsage** (DG5)

| Field | Type | Notes |
| --- | --- | --- |
| `siteId` * | id | |
| `ownerTypeEnumId` * | id | `SmithyQuotaOwner`: `SqoGroup` (the top-level group), `SqoAccount` |
| `ownerId` * | id | |
| `periodKey` * | id | `yyyy-MM` |
| `minutesUsed` | number-integer | |
| `runCount` | number-integer | |
| `updatedAt` | date-time | |

**SmithyReleaseAsset** (DG7)

| Field | Type | Notes |
| --- | --- | --- |
| `assetId` * | id | |
| `siteId` | id | |
| `repositoryId` | id | |
| `workEffortId` | id | the release |
| `tagName` | text-medium | |
| `name` | text-medium | the file's name |
| `assetKindEnumId` | id | `SmithyAssetKind`: `SakFile`, `SakImage` |
| `contentLocation` | text-medium | where the file is, read and written through `ec.resource`; the row names no blob |
| `imageName` | text-medium | a container image's name |
| `sizeBytes` | number-integer | |
| `sha256` | text-medium | |
| `pipelineRunId` | id | the run that uploaded it, when one did |
| `uploadedByPartyId` | id | |
| `createdAt` | date-time | |

Index: `SMITHY_ASSET_TAG` (`repositoryId`, `tagName`).

**SmithyRedirect** (DG7)

| Field | Type | Notes |
| --- | --- | --- |
| `redirectId` * | id | |
| `siteId` | id | |
| `oldHost` | text-medium | lower case; empty: the site's own hosts |
| `oldPath` | text-medium | |
| `targetPath` | text-medium | a path of the site, or an absolute https URL of one of its hosts |
| `sourceEnumId` | id | `SmithyRedirectSource`: `SrsSite`, `SrsForum`, `SrsGithub`, `SrsManual` |
| `note` | text-medium | |
| `createdAt` | date-time | |

Index: `SMITHY_REDIRECT_OLD` unique (`siteId`, `oldHost`, `oldPath`).

**SmithyImportRun** (DG8)

| Field | Type | Notes |
| --- | --- | --- |
| `importId` * | id | |
| `siteId` | id | |
| `groupId` | id | |
| `repositoryId` | id | the hosted repository it fills |
| `sourceEnumId` | id | `SmithyImportSource`: `SisGithub` |
| `sourceRepository` | text-medium | `owner/name` |
| `tokenRemoteId` | id | the `SystemMessageRemote` that holds the token, encrypted |
| `options` | text-long | JSON: what to import |
| `statusId` | id | status type `SmithyImport`: `SmiQueued`, `SmiPeople`, `SmiLabels`, `SmiIssues`, `SmiPulls`, `SmiComments`, `SmiLinks`, `SmiDone`, `SmiFailed`, `SmiCancelled`; an operation gives its code as `stage` |
| `cursorJson` | text-long | where to resume |
| `countsJson` | text-long | imported and GitHub's counts |
| `reportJson` | text-very-long | what could not be carried |
| `startedByPartyId` | id | |
| `createdAt` | date-time | |
| `finishedAt` | date-time | |
| `revision` | number-integer | |

**SmithyImportMap** (DG8)

| Field | Type | Notes |
| --- | --- | --- |
| `siteId` * | id | |
| `repositoryId` * | id | |
| `sourceType` * | id | `user`, `label`, `milestone`, `issue`, `pull`, `comment`, `review`, `reviewComment`, `reaction` |
| `sourceId` * | id-long | GitHub's id |
| `importId` | id | |
| `targetType` | id | |
| `targetId` | id | |
| `checksum` | text-short | of the source payload |
| `statusId` | id | status type `SmithyImportItem`: `SmmDone`, `SmmSkipped`, `SmmFailed` |
| `errorText` | text-long | |

Index: `SMITHY_IMPORT_STATE` (`siteId`, `repositoryId`, `sourceType`, `statusId`).

### 14.3 Enumerations and statuses

Seed data, new, in mantle `data/SmithySetupData.xml`.

| Type | Ids |
| --- | --- |
| `SmithyVisibility` | `SmvPublic` (1), `SmvMembers` (2), `SmvPrivate` (3) |
| `SmithyRole` | `SmrGuest` (10), `SmrReporter` (20), `SmrDeveloper` (30), `SmrMaintainer` (40), `SmrOwner` (50) |
| `SmithyAgreement` | `SmaInherit`, `SmaOff`, `SmaRequired` |
| `SmithyCreatePolicy` | `ScpOperators`, `ScpRequest`, `ScpVerified` |
| Status type `SmithyGroup` | `SmgRequested`, `SmgActive`, `SmgRefused`; transitions requested to active, requested to refused |
| `SmithyRedirectKind` (DG2) | `SrkGroup`, `SrkAccount` |
| `SmithyAgreementState`, `SmithyAgreementList` (DG4) | `SmasOff`, `SmasSigned`, `SmasUnsigned`, `SmasPending`; `SalCopyright`, `SalPatent` |
| `SmithyQuotaOwner` (DG5) | `SqoGroup`, `SqoAccount` |
| `SmithyAssetKind`, `SmithyRedirectSource` (DG7) | `SakFile`, `SakImage`; `SrsSite`, `SrsForum`, `SrsGithub`, `SrsManual` |
| `SmithyImportSource`; status types `SmithyImport`, `SmithyImportItem` (DG8) | `SisGithub`; the `Smi*` and `Smm*` statuses of §14.2 |

In an operation's input and result a visibility is `public`, `members` or `private`, a role is `guest`, `reporter`,
`developer`, `maintainer` or `owner`, and a policy is `operators`, `request` or `verified`: the enumeration's
`enumCode`.

### 14.4 Framework fields the design relies on

New in the framework, by the phase's item of [Dogfood §12](../../../../../plans/Dogfood.md#12-framework-changes).

| Item | Field or record | Notes |
| --- | --- | --- |
| F2 | `GitRepository.repositoryPath`, text-medium, unique index | Smithy writes it lower case, two to five segments joined with `/`; resolved exactly first and then lower-cased; empty for a repository with no path, which is found by its id. Written by `org.moqui.git.GitServices.set#GitRepositoryPath` (`repositoryId`, `repositoryPath`; out `oldRepositoryPath`) |
| F2 | `GitRepositoryPathRedirect`: `oldPath` * (text-medium), `repositoryId`, `createdDate` | an old path; removed when a repository takes the path |
| F3 | conf: an attribute of `<ssh-server>` that lets any account with a key use git | the name is the framework lane's |
| F4 | `GitRepository.forkOfRepositoryId`, id; `GitRepository.forkNetworkId`, id | the parent; the root of the fork network, for shared objects |
| F4 | `GitMergeRequest.sourceRepositoryId`, id | empty: the target repository |
| F5 | `GitMergeRequest.reviewTopic`, text-short; `GitMergeRequest.pushedForReview`, text-indicator | the `-o topic=` of a push to `refs/for/*`; whether the head is `refs/merge-requests/<n>/head` and not a branch. Refined in DG4 |
| F6 | `GitRepositoryMirror`: `mirrorId` *, `repositoryId`, `url`, `username`, the credential (encrypted, never returned: `hasCredential`), `hostKeyFingerprint`, `refPattern`, `deleteRefs`, `enabled`, `lastPushDate`, `lastResult`, `lastError`, `nextAttemptDate`, `attemptCount`, `createdByUserId`, `storedAuthzDisabled` | built in DG8: several mirrors a repository, over HTTPS or SSH with a pinned host key, forced to match ([Git-Hosting](../../../../../docs/interfaces/Git-Hosting.md#push-mirrors)). The older `pushMirrorRemoteId` and `pushMirrorRefs` on `GitRepository` are one SSH mirror, kept |

### 14.5 Framework records for CI (proposed)

Proposed to F7 and F8, beside the hosting rows in `moqui.resource`; refined in DG5 (and DG10 for the last two).
`*` marks a key.

| Record | Fields |
| --- | --- |
| `GitPipelineRun` | `pipelineRunId` *, `repositoryId`, `runNum` (unique with `repositoryId`), `pipelineName`, `definitionSource` (`file`, `builtin`), `event` (`push`, `merge-request`, `tag`, `schedule`, `manual`, `deploy`), `refName`, `commitId`, `mergeRequestId`, `sourceRepositoryId`, `triggeredByUserId`, `trusted`, `approvalState` (`none`, `waiting`, `approved`), `approvedByUserId`, `statusId` (`queued`, `waiting`, `running`, `success`, `failure`, `error`, `cancelled`), `environmentId`, `createdDate`, `startedDate`, `finishedDate` |
| `GitJobRun` | `jobRunId` *, `pipelineRunId`, `repositoryId`, `jobName`, `matrixKey`, `needs`, `runnerPoolId`, `image`, `statusId`, `exitCode`, `timeoutMinutes`, `instanceRef`, `tokenHash`, `tokenExpireDate`, `logBlobId`, `logBytes`, `minutesUsed`, `testCount`, `testFailedCount`, `commitStatusId`, `queuedDate`, `startedDate`, `finishedDate` |
| `GitJobStep` | `jobRunId` *, `stepSeq` *, `command`, `statusId`, `exitCode`, `firstChunkSeq`, `startedDate`, `finishedDate` |
| `GitRunLogChunk` | `jobRunId` *, `chunkSeq` *, `stepSeq`, `chunkText`, `createdDate`; removed when the job's log becomes one blob |
| `GitRunArtifact` | `artifactId` *, `jobRunId`, `pipelineRunId`, `repositoryId`, `artifactKind` (`artifact`, `report`, `cache`), `name`, `path`, `blobId`, `sizeBytes`, `sha256`, `cacheKey`, `protectedRef`, `keep`, `expireDate`, `createdDate` |
| `GitRunTestFailure` | `jobRunId` *, `testSeq` *, `suiteName`, `testName`, `filePath`, `lineNumber`, `message`, `durationMillis` |
| `GitCiSecret` | `secretId` *, `repositoryId`, `name`, `secretValue` (encrypted), `scope` (`protected`, `tags`, `environment`), `environmentId`, `createdByUserId`, `createdDate`, `lastUsedDate`; unique (`repositoryId`, `name`, `environmentId`) |
| `GitCiEnvironment` | `environmentId` *, `repositoryId`, `name`, `targetUrl`, `tokenRemoteId`, `requiredPipeline`, `approvalRequired`, `lastCommitId`, `lastDeployDate` |
| `GitRunnerPool` | `runnerPoolId` *, `description`, `instanceHostId`, `poolKind` (`container`, `registered`), `maxConcurrent`, `allowedImages`, `cpuLimit`, `memoryMb`, `diskMb`, `maxMinutes`, `egressRule`, `trusted`, `enabled` |
| `GitDeployment` (DG10) | `deploymentId` *, `environmentId`, `repositoryId`, `commitId`, `pipelineRunId`, `statusId` (`running`, `waiting`, `approved`, `refused`, `deployed`, `failed`), `requestedByUserId`, `decidedByUserId`, `createdDate`, `decidedDate`, `finishedDate`, `resultText` |

`GitRunTestFailure` and `GitDeployment` are this design's additions to the names Dogfood §8.2 lists.

### 14.6 Additions to `mantle.forum` and `mantle.public`

| Where | Addition | Phase |
| --- | --- | --- |
| `ForumTopic.kind` | the value `record` | DG3 |
| `ForumPostState` | `postKind` (id; empty for a post, `event` for a state-change line); the `visibility` value `staff` | DG3 |
| `ForumPostRevision.sourceFormat` | the value `markdown` beside `html`; `sourceText` holds the Markdown and `sanitizedBody` its cleaned HTML | DG3 |
| `ForumMemberState` | `dailyCounts` (text-medium, JSON by kind) | DG3 |
| `PublicApps.apps.<app>.scope` | a scope module (§12.1) | DG3 |
| `ForumReviewItem.targetType` | the values `repository`, `group`; the reason family `mail-held` and, for the gate, `mail-verdict` | DG6 |
| `ForumMailRoute` | `targetType` (id; empty or `category`, `issue`), `targetId` (id) | DG6 |
| `PublicDiscussionLink.sourceType` | the values `issue`, `mergeRequest`, `release` | DG6 |
| Forum's reads | the input `scopeContactListId` | DG6 |

## 15. Service and API catalog

### 15.1 Common contract

- An operation is an entry of mantle `SmithySchema.js` (`name: { service, fields }`), merged into pass `Schema.js`,
  with its route in `Routes.js` and `script/PassRoutes.js`. Its service takes PASS's `input` map and returns `result`.
  Every input has `siteId`, which the tables leave out.
- Services, by prefix: **S** `mantle.smithy.SmithyServices`, **I** `mantle.smithy.SmithyIssueServices`, **R**
  `mantle.smithy.SmithyReviewServices`, **A** `mantle.smithy.SmithyAgreementServices`, **P**
  `mantle.smithy.SmithyPipelineServices`, **W** `mantle.smithy.SmithySiteServices`, **X**
  `mantle.smithy.SmithyImportServices`. Not operations, called by rules and by the framework:
  `mantle.smithy.SmithyGitServices` (`check#Push`, `check#LfsUpload`, `check#Outbound`, `check#RestWrite`,
  `add#HostingOffer`, `check#AuthorSigned`, `read#Component`), `SmithyServices.get#RepositoryRights`,
  `check#AppReadiness`, `get#AccountCard`, `SmithyIssueServices.ensure#Issue`,
  `SmithyReviewServices.ensure#MergeRequest`, `SmithyAgreementServices.compute#Agreement` and `get#Signed`,
  `SmithyPipelineServices.check#Run` and `get#RunUrl`, `SmithyImportServices` (`run#Imports`, `handle#SsoLinked`,
  `handle#MembershipActive`, `handle#MirrorFailure`, `claim#GithubAccount`), and Mantle's
  `mantle.work.GitServices.handle#GitReviewThread`.
- Routes are under `/rest/s1/pass/v1/sites/{siteId}/smithy/`; the tables give the rest. `repositories/{repositoryId}`
  is written `r/{id}` and `groups/{groupId}` is `g/{id}` in the tables only.
- **Lists** take `limit` (30 by default, 100 at most) and an opaque `cursor`, and return `nextCursor`, as Forum's do
  (`ForumCore.page`).
- **Creates** take `operationId` and go through `ForumCore.receipt`: the same id and input answers the first result,
  another input is `Conflict`. A `store*` operation creates when its id field is empty and then needs `operationId`;
  with an id it is an edit.
- **A text check before the gate.** Until DG3 a DG2 write of a name or description refuses by `sanctioned` and
  `applyRules` directly (§11 "Before the gate"); from DG3 the refusals are the gate's.
- **Edits** take `expectedRevision`; a stale one is `Conflict` (`staleRevision`).
- **Needs**: `any` (no sign-in; the view rule still applies), `account` (signed in), `confirmed` (signed in, a
  confirmed address), a role (`Guest` to `Owner`, on the repository or group the input names, which implies
  `confirmed` for a write), `author` (who filed it, with a confirmed address), `site owner` (the site's owners and
  operators, never a moderator), `staff` (the site's owners, moderators and operators; used by moderation only),
  `operator`,
  `self`.
- **Refusals every operation shares**, which the tables do not repeat: `NotFound` for a record the caller may not
  view or that does not exist; `AuthenticationRequired` for a signed-out caller where the need is more than `any`;
  `Unauthorized` (`addressUnconfirmed`) without a confirmed address; `Unauthorized` (`accessDenied`) for a viewer
  without the role; `Unprocessable` for a field that fails its rule, with the field named; `Conflict`
  (`staleRevision`); `Tarpit` (`rateLimited`) from the client caps.
- **A bearer token.** No Smithy operation is a `TOKEN_WRITES` entry: none is authorized by a link's token. An access
  token is for git and the framework's REST; an installed app's device key reaches the Dev AIDE's listed operations
  (§5.5).
- **Reads return** the projection, the caller's `capabilities` for the record, and `revision` where it can be edited.
  Ids of internal records (a party id, a user id, a work effort id) are not returned, except `workItemKey` to a
  Reporter.

Projections named in the tables:

| Name | Fields |
| --- | --- |
| `group` | `groupId`, `groupPath`, `pathSegment`, `name`, `description`, `avatarUrl`, `visibility`, `parentGroupId`, `status`, `hidden`, `repositoryCount`, `subgroupCount`, `revision` |
| `repository` | `repositoryId`, `repositoryPath`, `slug`, `name`, `description`, `visibility`, `effectiveVisibility`, `groupId`, `ownerHandle`, `defaultBranch`, `archived`, `mirror`, `hidden`, `forkOf` (`repositoryPath`, `name`; when the caller may view it), `forkCount`, `features` (`issues`, `mergeRequests`, `pipelines`, `forum`, `docs`), `component` (`name`, `version`), `lastPushAt`, `revision` |
| `repositoryCapabilities` | `signedIn`, `confirmed`, `role`, `canFileIssue`, `canComment`, `canFork`, `canPropose`, `canPush`, `canReview`, `canTriage`, `canMerge`, `canAdminister`, `canOwn`, `canModerate` |
| `member` | `handle`, `displayName`, `avatarUrl`, `role`, `fromPath` (the group or repository the role is on), `fromDate`, `thruDate`, `revision` |
| `ref` | `kind` (`branch`, `tag`, `commit`), `name`, `fullName`, `commitId` |
| `commit` | `commitId`, `summary`, `message`, `authorName`, `authorHandle`, `authorDate`, `committerName`, `commitDate`, `parentIds`, `checkState`, `issueNumbers` |
| `issue` | §8.2 |
| `mergeRequest` | `mergeRequestNum`, `title`, `state` (`draft`, `open`, `merged`, `closed`), `author` (as an issue's), `sourceRepositoryPath`, `sourceRef`, `targetRef`, `pushedForReview`, `fetchRef`, `headCommitId`, `baseCommitId`, `mergeable`, `conflictPaths`, `mergeMethod`, `deleteSourceBranch`, `approvalCount`, `checkState`, `agreementState`, `commentCount`, `createdAt`, `updatedAt`, `mergedAt`, `mergedBy`, `closedAt`, `topic`, `revision` |
| `run` | `runNum`, `pipelineName`, `event`, `refName`, `commitId`, `mergeRequestNum`, `triggeredBy` (handle), `state`, `trusted`, `approvalState`, `createdAt`, `startedAt`, `finishedAt`, `jobCount`, `failedTestCount` |
| `job` | `jobRunId`, `jobName`, `matrixKey`, `needs`, `state`, `exitCode`, `image`, `queuedAt`, `startedAt`, `finishedAt`, `minutesUsed`, `testCount`, `testFailedCount` |
| `release` | `tag`, `name`, `notesHtml`, `published`, `publishedAt`, `commitId`, `assetList` (`assetId`, `name`, `assetKind`, `imageName`, `sizeBytes`, `sha256`), `announcementTopicId`, `revision` |
| download | the facade's download result, as Forum's `getAttachment` returns one: the name, the content type, the bytes or their location, and the cache rule |

### 15.2 DG1: public read (16)

| # | Operation | Service | Route | Input | Result | Refusals | Needs |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `resolveSmithyPath` | S `resolve#Path` | GET `resolve` | `path` | `kind` (`repository`, `group`, `account`, `redirect`), `groupId`, `repositoryId`, `handle`, `canonicalPath`, `redirectPath` | | any |
| 2 | `getSmithyHome` | S `get#Home` | GET `home` | | `homeGroupId`, `groupPath` (both empty: Explore) | | any |
| 3 | `findGroups` | S `find#Groups` | GET `groups` | `parentGroupId`, `query`, `mine`, `limit`, `cursor` | `groupList` of `group`, `nextCursor` | | any |
| 4 | `getGroup` | S `get#Group` | GET `g/{id}` | `groupId` | `group`, `ancestorList` (`groupId`, `groupPath`, `name`), `myRole`, `capabilities` (`canCreateRepository`, `canCreateSubgroup`, `canOwn`, `canModerate`, `confirmed`, `signedIn`) | | any |
| 5 | `findGroupMembers` | S `find#GroupMembers` | GET `g/{id}/members` | `groupId`, `limit`, `cursor` | `memberList` of `member`, `nextCursor` | | any |
| 6 | `findRepositories` | S `find#Repositories` | GET `repositories` | `groupId`, `includeSubgroups`, `ownerHandle`, `query`, `pinned`, `mine`, `sort` (`name`, `pushed`), `limit`, `cursor` | `repositoryList` of `repository`, `nextCursor` | | any |
| 7 | `getRepository` | S `get#Repository` | GET `r/{id}` | `repositoryId` | `repository`, `group`, `cloneUrls` (`page`, `https`, `ssh`), `myRole`, `capabilities` (`repositoryCapabilities`), `counts` (`openIssues`, `openMergeRequests`) | | any |
| 8 | `getTree` | S `get#Tree` | GET `r/{id}/tree` | `repositoryId`, `refPath`, `offset` | `ref`, `path`, `isFile`, `entryList` (`name`, `path`, `type`, `size`, `lfs`, `lastCommit`), `hasMore`, `lastCommit`, `readme` (`path`, `html`), `empty` | | any |
| 9 | `getBlob` | S `get#Blob` | GET `r/{id}/blob` | `repositoryId`, `refPath`, `plain` | `ref`, `path`, `size`, `binary`, `lfs`, `tooLarge`, `text`, `html` (rendered Markdown), `language`, `blobId`, `lastCommit` | | any |
| 10 | `downloadBlob` | S `download#Blob` | GET `r/{id}/raw` | `repositoryId`, `refPath` | download | | any |
| 11 | `getBlame` | S `get#Blame` | GET `r/{id}/blame` | `repositoryId`, `refPath` | `ref`, `path`, `text`, `hunkList` (`startLine`, `lineCount`, `commitId`, `summary`, `authorName`, `authorHandle`, `date`) | `Unprocessable` for a binary or too large file | any |
| 12 | `findCommits` | S `find#Commits` | GET `r/{id}/commits` | `repositoryId`, `refPath`, `afterCommitId`, `limit` | `ref`, `path`, `commitList` of `commit`, `hasMore` | | any |
| 13 | `getCommit` | S `get#Commit` | GET `r/{id}/commits/{commitId}` | `repositoryId`, `commitId`, `path`, `diffLineOffset`, `diffLineLimit` | `commit`, `fileList` (`path`, `oldPath`, `status`, `insertions`, `deletions`, `binary`), `insertions`, `deletions`, `fileDiffList`, `truncated`, `statusList`, `linkedIssues`, `linkedMergeRequests`, `hiddenItemCount` | | any |
| 14 | `getCompare` | S `get#Compare` | GET `r/{id}/compare` | `repositoryId`, `base`, `head`, `headRepositoryPath`, `withDiffs`, `diffLineOffset`, `diffLineLimit` | `baseCommitId`, `headCommitId`, `mergeBaseId`, `aheadBy`, `behindBy`, `commitList`, `commitsTruncated`, `fileList`, `fileDiffList`, `insertions`, `deletions`, `mergeable`, `conflictPaths`, `openMergeRequestNum` | | any |
| 15 | `findRefs` | S `find#Refs` | GET `r/{id}/refs` | `repositoryId`, `refType` (`branch`, `tag`), `query`, `limit`, `cursor` | `defaultBranch`, `refList` (`name`, `refType`, `commitId`, `summary`, `date`, `aheadBy`, `behindBy`, `protected`, `mergeRequestNum`, `releaseTag`), `nextCursor` | | any |
| 16 | `downloadArchive` | S `download#Archive` | GET `r/{id}/archive` | `repositoryId`, `refPath`, `format` (`zip`, `tar.gz`) | download | `Unprocessable` when `refPath` has a path after the ref; `Tarpit` over the client cap | any |

Notes for DG1:

- `getTree.type` is the framework's `get#GitTree` value, unchanged: `dir`, `file`, `executable`, `link`, `submodule`.
  The framework returns a whole directory; the operation pages it by `offset`, 1,000 entries a page, with `hasMore`.
  That is the one list that does not use a cursor, since a directory is one bounded read. A `refPath` that names a
  file returns `isFile` true with an empty `entryList`, and the page redirects to Blob. `getBlob` for a directory is
  `NotFound`.
- `commit.authorHandle` is empty in DG1 (§7 Commits); `commit.checkState` and `issueNumbers` are empty until DG5 and
  DG3.
- `getCommit` does not return the branches and tags that contain the commit: no framework service gives them
  (N-CONTAINS, DG4). CommitDetail shows them from DG4.
- A commit id is accepted only when it is reachable from a ref the caller may read. Before forks (DG4) every commit
  of a repository's store is the repository's own, so DG1 checks only that the commit exists; N-REACH is DG4's.
- `resolveSmithyPath` takes a name path (one to five segments). A `redirect` result is given only when its target is
  one the caller may view.
- `findGroupMembers` and `getGroup` are for a viewer of the group; `capabilities` are computed for the caller.

### 15.3 DG2: accounts and push (37)

| # | Operation | Service | Route | Input | Result | Refusals | Needs |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `getSmithySettings` | S `get#Settings` | GET `settings` | | for a site owner the `SmithySite` fields with `homeGroupPath` and `revision`; for anyone else `groupCreate`, `repositoryCreate`, `forkCreate` only | | any |
| 2 | `storeSmithySettings` | S `store#Settings` | PATCH `settings` | `homeGroupPath`, `groupCreate`, `repositoryCreate`, `forkCreate`, `defaultMaxRepositories`, `defaultRepositoryBytes`, `defaultLfsBytes`, `defaultRunnerMinutes`, `groupRepositoryBytes`, `groupLfsBytes`, `groupRunnerMinutes`, `maxEditBytes`, `repositoryKind`, `expectedRevision` | `revision` | | site owner |
| 3 | `requestGroup` | S `request#Group` | POST `groups` | `pathSegment`, `name`, `description`, `visibility`, `reason`, `operationId` | `groupId`, `groupPath`, `status` (`active` by the `verified` policy or for a site owner, `requested` by `request`); the caller is the Owner of an active one | `nameInvalid`, `nameTaken`, `policyRefused` (the `operators` policy), `Conflict` when the account has a request waiting; the text check | confirmed |
| 4 | `findGroupRequests` | S `find#GroupRequests` | GET `group-requests` | `status`, `limit`, `cursor` | `requestList` (`group`, `requestedBy` handle, `requestReason`, `createdAt`), `nextCursor` | | site owner |
| 5 | `decideGroupRequest` | S `decide#GroupRequest` | POST `g/{id}/decision` | `groupId`, `decision` (`approve`, `refuse`), `reason`, `expectedRevision` | `status`, `revision`; on approval the requester gets the `SmrOwner` row | `Conflict` when already decided | site owner |
| 6 | `createSubgroup` | S `create#Subgroup` | POST `g/{id}/subgroups` | `groupId`, `pathSegment`, `name`, `description`, `visibility`, `operationId` | `groupId`, `groupPath` | `nameInvalid`, `nameTaken`, `policyRefused` (wider than the parent, or a fifth level); the text check | Owner |
| 7 | `updateGroup` | S `update#Group` | PATCH `g/{id}` | `groupId`, `name`, `description`, `avatarId`, `visibility`, `issueRepositoryPath`, `expectedRevision` | `revision`, `narrowedCount` | `policyRefused` (wider than the parent); the text check | Owner |
| 8 | `renameGroup` | S `rename#Group` | POST `g/{id}/rename` | `groupId`, `pathSegment`, `expectedRevision` | `groupPath`, `revision` | `nameInvalid`, `nameTaken` | Owner |
| 9 | `deleteGroup` | S `delete#Group` | DELETE `g/{id}` | `groupId`, `confirmPath`, `expectedRevision` | `deleted` | `Conflict` when it has a repository or a subgroup | Owner |
| 10 | `setGroupMember` | S `set#GroupMember` | PATCH `g/{id}/members/{handle}` | `groupId`, `handle`, `role` (empty removes), `thruDate`, `expectedRevision` | `member` | `Unprocessable` for an unknown handle; `Conflict` when it would leave no Owner | Owner |
| 11 | `leaveGroup` | S `leave#Group` | DELETE `g/{id}/membership` | `groupId` | `left` | `Conflict` for the last Owner | account |
| 12 | `createRepository` | S `create#Repository` | POST `repositories` | `groupId` (empty: the caller's namespace), `slug`, `name`, `description`, `visibility`, `withReadme`, `operationId` | `repositoryId`, `repositoryPath` | `nameInvalid`, `nameTaken`, `policyRefused`, `quotaExceeded` (the account's `maxRepositories`); the text check | Maintainer of the group; confirmed, by the policy, for the namespace |
| 13 | `updateRepository` | S `update#Repository` | PATCH `r/{id}` | `repositoryId`, `name`, `description`, `defaultBranch`, `defaultMergeMethod`, `issuesEnabled`, `mergeRequestsEnabled`, `pipelinesEnabled`, `forumEnabled`, `docsEnabled`, `docsPath`, `pinnedSequence` (a number; empty unpins), `expectedRevision` | `revision` | `repositoryArchived`; the text check | Maintainer (`pinnedSequence`: Owner of the group) |
| 14 | `setRepositoryVisibility` | S `set#RepositoryVisibility` | PATCH `r/{id}/visibility` | `repositoryId`, `visibility`, `expectedRevision` | `visibility`, `effectiveVisibility`, `revision` | `policyRefused` (wider than its group or its fork parent) | Owner |
| 15 | `renameRepository` | S `rename#Repository` | POST `r/{id}/rename` | `repositoryId`, `slug`, `expectedRevision` | `repositoryPath`, `revision` | `nameInvalid`, `nameTaken` | Owner |
| 16 | `transferRepository` | S `transfer#Repository` | POST `r/{id}/transfer` | `repositoryId`, `targetGroupId` (empty: the caller's namespace), `expectedRevision` | `repositoryPath`, `visibility`, `revision` | `nameTaken`, `quotaExceeded`, `Conflict` while its issues are in the old group's shared project (§8.1), `Unauthorized` without Maintainer of the target | Owner |
| 17 | `setRepositoryArchived` | S `set#RepositoryArchived` | POST `r/{id}/archive` | `repositoryId`, `archived`, `expectedRevision` | `archived`, `closedMergeRequestCount`, `revision` | | Owner |
| 18 | `deleteRepository` | S `delete#Repository` | DELETE `r/{id}` | `repositoryId`, `confirmPath`, `expectedRevision` | `deleted` (N-DELETE) | `Conflict` with forks or release assets | Owner |
| 19 | `findRepositoryMembers` | S `find#RepositoryMembers` | GET `r/{id}/members` | `repositoryId`, `limit`, `cursor` | `memberList` of `member` (inherited ones included), `nextCursor` | | Maintainer (reads; an Owner changes, 20) |
| 20 | `setRepositoryMember` | S `set#RepositoryMember` | PATCH `r/{id}/members/{handle}` | `repositoryId`, `handle`, `role`, `thruDate`, `expectedRevision` | `member` | `Unprocessable` for an unknown handle | Owner |
| 21 | `getBranchRules` | S `get#BranchRules` | GET `r/{id}/branch-rules` | `repositoryId` | `ruleList` (`branchRuleId`, `refPattern`, `allowForcePush`, `allowDelete`, `requireMergeRequest`, `requiredApprovals`, `dismissStaleApprovals`, `requiredStatusContexts`, `allowedMergeMethods`) | | Maintainer |
| 22 | `storeBranchRule` | S `store#BranchRule` | POST `r/{id}/branch-rules` | `repositoryId`, `branchRuleId`, the fields of 21, `operationId` | `branchRuleId` | `repositoryArchived` | Maintainer |
| 23 | `deleteBranchRule` | S `delete#BranchRule` | DELETE `r/{id}/branch-rules/{branchRuleId}` | `repositoryId`, `branchRuleId` | `deleted` | | Maintainer |
| 24 | `findWebhooks` | S `find#Webhooks` | GET `r/{id}/webhooks` | `repositoryId` | `webhookList` (`webhookId`, `url`, `events`, `active`, `description`, `lastDeliveryDate`, `lastDeliveryStatus`, `hasSecret`) | | Maintainer |
| 25 | `storeWebhook` | S `store#Webhook` | POST `r/{id}/webhooks` | `repositoryId`, `webhookId`, `url`, `events`, `secret`, `active`, `description`, `operationId` | `webhookId` | `Unprocessable` for a URL the outbound rules refuse | Maintainer |
| 26 | `deleteWebhook` | S `delete#Webhook` | DELETE `r/{id}/webhooks/{webhookId}` | `repositoryId`, `webhookId` | `deleted` | | Maintainer |
| 27 | `testWebhook` | S `test#Webhook` | POST `r/{id}/webhooks/{webhookId}/test` | `repositoryId`, `webhookId` | `statusCode`, `delivered`, `errorText` | | Maintainer |
| 28 | `findWebhookDeliveries` | S `find#WebhookDeliveries` | GET `r/{id}/webhooks/{webhookId}/deliveries` | `repositoryId`, `webhookId`, `limit`, `cursor` | `deliveryList` (`event`, `date`, `statusCode`, `delivered`), `nextCursor` | | Maintainer |
| 29 | `createRef` | S `create#Ref` | POST `r/{id}/refs` | `repositoryId`, `refType`, `name`, `fromRevision`, `message`, `operationId` | `name`, `commitId` | `Conflict` when it exists; `Unauthorized` by a branch rule; `repositoryArchived` | Developer |
| 30 | `deleteRef` | S `delete#Ref` | DELETE `r/{id}/refs` | `repositoryId`, `refType`, `name` | `deleted` | `Unauthorized` by a branch rule; `Conflict` for the default branch | Maintainer |
| 31 | `findGitAccess` | S `find#GitAccess` | GET `me/git-access` | | `sshKeyList` (`sshKeyId`, `name`, `fingerprint`, `createdAt`, `lastUsedAt`), `tokenList` (`tokenId`, `name`, `createdAt`, `expiresAt`, `lastUsedAt`), `sshAddress`, `confirmed` | | self |
| 32 | `addSshKey` | S `add#SshKey` | POST `me/git-access/keys` | `name`, `publicKey`, `password`, `code`, `operationId` | `sshKeyId`, `fingerprint` | `Unprocessable` for a key the framework refuses; `Conflict` for a key in use | self, confirmed |
| 33 | `removeSshKey` | S `remove#SshKey` | DELETE `me/git-access/keys/{sshKeyId}` | `sshKeyId` | `deleted` | | self |
| 34 | `createAccessToken` | S `create#AccessToken` | POST `me/git-access/tokens` | `name`, `expiresAt`, `password`, `code`, `operationId` | `tokenId`, `token` (shown once, never kept in the receipt) | | self, confirmed |
| 35 | `revokeAccessToken` | S `revoke#AccessToken` | DELETE `me/git-access/tokens/{tokenId}` | `tokenId` | `revoked` | | self |
| 36 | `getQuotaUsage` | S `get#QuotaUsage` | GET `quota` | `groupId` or `handle` (empty: the caller) | (usage from N-USAGE) `owner`, `limits` and `usage`, each with `repositories`, `repositoryBytes`, `lfsBytes`, `runnerMinutes`; `bot`, `botOperatorHandle` | | self; Owner of the group; site owner |
| 37 | `setQuota` | S `set#Quota` | PATCH `quota` | `groupId` or `handle`, `maxRepositories` (with `handle` only; `Unprocessable` with `groupId`), `maxRepositoryBytes`, `maxLfsBytes`, `runnerMinutesMonthly`, `bot`, `botOperatorHandle`, `reason`, `expectedRevision` | `revision` | | site owner |

`password` and `code` are the framework's re-authentication fields, as Forum's `setSiteRole` takes them.

### 15.4 DG3: issues (15)

| # | Operation | Service | Route | Input | Result | Refusals | Needs |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `findIssues` | I `find#Issues` | GET `issues` | `repositoryId` or `groupId`, `state` (`open`, `closed`, `all`), `labelIds`, `milestoneId`, `assigneeHandle`, `authorHandle`, `query`, `confidential` (`only`; Owner), `sort` (`created`, `activity`), `limit`, `cursor` | `issueList` of `issue` (without `linked*`), `counts` (`open`, `closed`), `nextCursor` | | any |
| 2 | `getIssue` | I `get#Issue` | GET `r/{id}/issues/{issueNumber}` | `repositoryId`, `issueNumber` | `issue`, `capabilities` (`canEdit`, `canComment`, `canSetState`, `canTriage`, `canSetConfidential`, `canModerate`), `pending` | | any |
| 3 | `createIssue` | I `create#Issue` | POST `r/{id}/issues` | `repositoryId`, `title`, `body`, `sourceFormat` (`markdown`, `html`), `confidential`, `labelIds`, `assigneeHandles`, `milestoneId`, `attachmentIds`, `draftId`, `operationId` | `issueNumber`, `rootCommEventId`, `state` (`published`, `pending`) | the gate's (§12.2); `Unauthorized` for `labelIds`, `assigneeHandles` or `milestoneId` from less than a Reporter; `repositoryArchived` | confirmed |
| 4 | `updateIssue` | I `update#Issue` | PATCH `r/{id}/issues/{issueNumber}` | `repositoryId`, `issueNumber`, `title`, `expectedRevision` | `revision` | the gate's for the title | author (confirmed) within the edit window; Reporter |
| 5 | `setIssueState` | I `set#IssueState` | POST `r/{id}/issues/{issueNumber}/state` | `repositoryId`, `issueNumber`, `state` (`open`, `closed`), `reason` (`completed`, `notPlanned`, `duplicate`), `duplicateOfNumber`, `expectedRevision` | `state`, `stateReason`, `revision` | `Unprocessable` when the status flow has no way | author (not `duplicate`); Reporter |
| 6 | `setIssueLabels` | I `set#IssueLabels` | PATCH `r/{id}/issues/{issueNumber}/labels` | `repositoryId`, `issueNumber`, `labelIds`, `expectedRevision` | `labels`, `revision` | | Reporter |
| 7 | `setIssueAssignees` | I `set#IssueAssignees` | PATCH `r/{id}/issues/{issueNumber}/assignees` | `repositoryId`, `issueNumber`, `assigneeHandles`, `expectedRevision` | `assignees`, `revision` | `Unprocessable` for a handle that may not view the issue | Reporter |
| 8 | `setIssueMilestone` | I `set#IssueMilestone` | PATCH `r/{id}/issues/{issueNumber}/milestone` | `repositoryId`, `issueNumber`, `milestoneId`, `expectedRevision` | `milestone`, `revision` | | Reporter |
| 9 | `setIssueConfidential` | I `set#IssueConfidential` | POST `r/{id}/issues/{issueNumber}/confidential` | `repositoryId`, `issueNumber`, `confidential`, `asNewIssue`, `title`, `body`, `sourceFormat`, `expectedRevision`, `operationId` | `confidential`, `newIssueNumber`, `revision` | the gate's for a new issue's title and text | Owner |
| 10 | `findLabels` | I `find#Labels` | GET `r/{id}/labels` | `repositoryId` | `labelList` (`labelId`, `name`, `color`, `description`, `openIssueCount`, `revision`) | | any |
| 11 | `storeLabel` | I `store#Label` | POST `r/{id}/labels` | `repositoryId`, `labelId`, `name`, `color`, `description`, `expectedRevision`, `operationId` | `labelId`, `revision` | `nameTaken`; the gate's for the name | Maintainer |
| 12 | `deleteLabel` | I `delete#Label` | DELETE `r/{id}/labels/{labelId}` | `repositoryId`, `labelId` | `deleted` | | Maintainer |
| 13 | `findMilestones` | I `find#Milestones` | GET `r/{id}/milestones` | `repositoryId`, `state` (`open`, `closed`, `all`) | `milestoneList` (`milestoneId`, `name`, `description`, `dueDate`, `state`, `openIssueCount`, `closedIssueCount`, `revision`) | | any |
| 14 | `storeMilestone` | I `store#Milestone` | POST `r/{id}/milestones` | `repositoryId`, `milestoneId`, `name`, `description`, `dueDate`, `state`, `expectedRevision`, `operationId` | `milestoneId`, `revision` | the gate's for the name | Maintainer |
| 15 | `findAssignees` | I `find#Assignees` | GET `r/{id}/assignees` | `repositoryId`, `query`, `limit` | `handleList` (`handle`, `displayName`, `avatarUrl`): accounts with a role on the repository | | Reporter |

Forum operations that change with DG3, by name unchanged: `publishPost`, `updatePost` and `previewPost` take
`sourceFormat`; `publishPost` with a record topic's `rootCommEventId` is a comment (the gate's kind `comment`); and
`getPosts`, `updatePost`, `setReaction`, `flagPost`, `getPostHistory`, `markRead`, `setPreferences` and
`getPostLocation` accept a record topic. `findTopics`, `searchForum` and `getFeed` never return one.

### 15.5 DG4: merge requests, forks, editing, the agreement (21)

| # | Operation | Service | Route | Input | Result | Refusals | Needs |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `findMergeRequests` | R `find#MergeRequests` | GET `merge-requests` | `repositoryId` (or, for the Dev AIDE and a later group page, `groupId`), `state` (`open`, `draft`, `merged`, `closed`, `all`), `authorHandle`, `reviewerHandle`, `targetRef`, `query`, `limit`, `cursor` | `mergeRequestList` of `mergeRequest`, `counts` (`open`, `merged`, `closed`), `nextCursor` | | any |
| 2 | `getMergeRequest` | R `get#MergeRequest` | GET `r/{id}/merge-requests/{mergeRequestNum}` | `repositoryId`, `mergeRequestNum` | `mergeRequest`, `reviewerList` (`handle`, `displayName`, `state` of `requested`, `approved`, `changes`, `commented`, `reviewedCommitId`), `checkList` (`context`, `state`, `description`, `targetUrl`, `required`), `missingList`, `branchRules`, `agreement` (`required`, `state` of `off`, `signed`, `unsigned`, `pending`, `missingList` of `handle` or `name`, `commitId`, `missing`; `file`, `signPath`), `linkedIssues`, `capabilities` (`canEdit`, `canComment`, `canReview`, `canApprove`, `canSetState`, `canMerge`, `canSign`, `canConfirmBot`, `canModerate`), `pending` | | any |
| 3 | `getMergeRequestChanges` | R `get#MergeRequestChanges` | GET `r/{id}/merge-requests/{mergeRequestNum}/changes` | `repositoryId`, `mergeRequestNum`, `path`, `withDiffs`, `diffLineOffset`, `diffLineLimit` | `baseCommitId`, `headCommitId`, `mergeBaseId`, `commitList` (each `commit` with `signed`), `fileList`, `fileDiffList`, `insertions`, `deletions`, `truncated`, `threadList` (`threadId`, `path`, `oldLine`, `newLine`, `commitId`, `lineText`, `outdated`, `resolved`, `postList`) | | any |
| 4 | `createMergeRequest` | R `create#MergeRequest` | POST `r/{id}/merge-requests` | `repositoryId` (the target), `sourceRepositoryId`, `sourceRef`, `targetRef`, `title`, `body`, `sourceFormat`, `draft`, `reviewerHandles`, `operationId` | `mergeRequestNum`, `rootCommEventId`, `state` (`published`, `pending`) | the gate's; `Conflict` when the same source and target have an open one; `Unprocessable` when the source is not ahead; `Unauthorized` without push to the source; `repositoryArchived` | confirmed |
| 5 | `updateMergeRequest` | R `update#MergeRequest` | PATCH `r/{id}/merge-requests/{mergeRequestNum}` | `repositoryId`, `mergeRequestNum`, `title`, `targetRef`, `draft`, `mergeMethod`, `deleteSourceBranch`, `expectedRevision` | `revision` | the gate's for the title | author; Developer |
| 6 | `setMergeRequestReviewers` | R `set#Reviewers` | PATCH `r/{id}/merge-requests/{mergeRequestNum}/reviewers` | `repositoryId`, `mergeRequestNum`, `reviewerHandles`, `expectedRevision` | `reviewerList`, `revision` | `Unprocessable` for a handle that may not view | Developer |
| 7 | `submitReview` | R `submit#Review` | POST `r/{id}/merge-requests/{mergeRequestNum}/reviews` | `repositoryId`, `mergeRequestNum`, `decision` (`approve`, `request_changes`, `comment`), `body`, `sourceFormat`, `commentList` (pending line comments, each as 8's input), `operationId` | `postId`, `reviewerState`, `approvalCount`, `state` | the gate's; `Unauthorized` for `approve` or `request_changes` from less than a Developer, and for `approve` from the author | confirmed |
| 8 | `createReviewComment` | R `create#ReviewComment` | POST `r/{id}/merge-requests/{mergeRequestNum}/comments` | `repositoryId`, `mergeRequestNum`, `threadId` (a reply) or `commitId`, `path`, `oldLine`, `newLine`; `body`, `sourceFormat`, `operationId` | `postId`, `threadId`, `state` | the gate's; `Unprocessable` for a line that is not in the diff | confirmed |
| 9 | `resolveReviewThread` | R `resolve#ReviewThread` | POST `r/{id}/merge-requests/{mergeRequestNum}/threads/{threadId}/resolve` | `repositoryId`, `mergeRequestNum`, `threadId`, `resolved` | `resolved` | | the thread's or the merge request's author; Developer |
| 10 | `setMergeRequestState` | R `set#MergeRequestState` | POST `r/{id}/merge-requests/{mergeRequestNum}/state` | `repositoryId`, `mergeRequestNum`, `state` (`open`, `closed`), `expectedRevision` | `state`, `revision` | `Conflict` for a merged one | author; Reporter |
| 11 | `mergeMergeRequest` | R `merge#MergeRequest` | POST `r/{id}/merge-requests/{mergeRequestNum}/merge` | `repositoryId`, `mergeRequestNum`, `mergeMethod`, `message`, `deleteSourceBranch`, `expectedHeadCommitId`, `expectedRevision` | `commitId`, `mergeMethod`, `state` | `Conflict` when the head moved or it does not merge cleanly (with `conflictPaths` in the message); `checksRequired`; `agreementUnsigned`; `squashFoldsSignature`; `Unprocessable` for a method the rule does not allow or missing approvals | Maintainer |
| 12 | `forkRepository` | R `fork#Repository` | POST `r/{id}/forks` | `repositoryId`, `targetGroupId` (empty: the caller's namespace), `slug`, `name`, `visibility`, `operationId` | `repositoryId`, `repositoryPath` | `nameInvalid`, `nameTaken`, `policyRefused`, `quotaExceeded`, `limitReached` | confirmed |
| 13 | `findForks` | R `find#Forks` | GET `r/{id}/forks` | `repositoryId`, `limit`, `cursor` | `repositoryList` of `repository`, `nextCursor` | | any |
| 14 | `getEditContext` | R `get#EditContext` | GET `r/{id}/edit` | `repositoryId`, `refPath`, `editAction` | `ref`, `path`, `blobId`, `text`, `size`, `editable`, `reason`, `destinationList` (`destination`, `default`, `branchName`), `protected`, `agreementFile`, `suggestedBranch` | | any |
| 15 | `commitFile` | R `commit#File` | POST `r/{id}/commit` | `repositoryId`, `branch`, `action` (`create`, `update`, `rename`, `delete`, `upload`), `path`, `newPath`, `content`, `attachmentId`, `baseBlobId`, `message`, `destination` (`branch`, `newBranch`, `proposal`), `newBranchName`, `mergeRequestTitle`, `operationId` | `commitId`, `branch`, `mergeRequestNum`, `destination` | `fileChanged` (`Conflict`); `notEditable`; `Unauthorized` for a destination the caller does not have; the gate's for a save that opens a merge request; `repositoryArchived` | confirmed |
| 16 | `getAgreement` | A `get#Agreement` | GET `agreement` | `repositoryId` or `groupId`, `handle` (empty: the caller) | `setting` (`inherit`, `off`, `required`), `effective` (`off`, `required`), `inheritedFromPath`, `agreementPath`, `signed`, `missing` (`copyright`, `patent`), `changedRuleCount`, `revision` | | any (`handle` of another: Developer) |
| 17 | `setAgreement` | A `set#Agreement` | PATCH `agreement` | `repositoryId` or `groupId`, `setting`, `agreementPath`, `expectedRevision` | `effective`, `changedRuleCount`, `revision` | `Unprocessable` when the file is not at the path | Owner |
| 18 | `signAgreement` | A `sign#Agreement` | POST `r/{id}/agreement/sign` | `repositoryId`, `mergeRequestNum`, `legalName`, `years`, `operationId` | `commitId`, `mergeRequestNum` | `Conflict` when already signed; the save's refusals (15) | confirmed |
| 19 | `recheckAgreement` | A `recheck#Agreement` | POST `r/{id}/merge-requests/{mergeRequestNum}/agreement` | `repositoryId`, `mergeRequestNum` | `agreement` | | author; Developer |
| 20 | `declareBotOperator` | A `declare#BotOperator` | POST `r/{id}/merge-requests/{mergeRequestNum}/bot-operator` | `repositoryId`, `mergeRequestNum`, `operationId` | `agreement` | `Unprocessable` when the author is no bot or the caller is not its operator | confirmed (the bot's operator) |
| 21 | `confirmBotOperator` | A `confirm#BotOperator` | POST `r/{id}/merge-requests/{mergeRequestNum}/bot-operator/confirm` | `repositoryId`, `mergeRequestNum`, `expectedRevision` | `agreement` | `Conflict` when nothing is declared | Maintainer |

### 15.6 DG5: pipelines (17)

Refined in DG5.

| # | Operation | Service | Route | Input | Result | Refusals | Needs |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `findPipelineRuns` | P `find#Runs` | GET `r/{id}/pipelines` | `repositoryId`, `refName`, `event`, `state`, `mergeRequestNum`, `commitId`, `limit`, `cursor` | `runList` of `run`, `pipelineList` (names with the manual event), `nextCursor` | | any |
| 2 | `getPipelineRun` | P `get#Run` | GET `r/{id}/pipelines/{runNum}` | `repositoryId`, `runNum` | `run`, `jobList` of `job`, `capabilities` (`canCancel`, `canRetry`, `canApprove`) | | any |
| 3 | `getJobRun` | P `get#JobRun` | GET `r/{id}/pipelines/{runNum}/jobs/{jobRunId}` | `repositoryId`, `runNum`, `jobRunId` | `job`, `stepList` (`stepSeq`, `command`, `state`, `exitCode`, `firstChunkSeq`, `startedAt`, `finishedAt`), `failedTestList` (`suiteName`, `testName`, `filePath`, `lineNumber`, `message`), `artifactList` (`artifactId`, `artifactKind`, `name`, `sizeBytes`, `sha256`, `expiresAt`) | | any |
| 4 | `getJobLog` | P `get#JobLog` | GET `r/{id}/pipelines/{runNum}/jobs/{jobRunId}/log` | `repositoryId`, `runNum`, `jobRunId`, `afterChunkSeq`, `limit` | `chunkList` (`chunkSeq`, `stepSeq`, `text`), `nextChunkSeq`, `finished` | | any |
| 5 | `downloadArtifact` | P `download#Artifact` | GET `r/{id}/artifacts/{artifactId}` | `repositoryId`, `artifactId` | download | `NotFound` for a cache | any |
| 6 | `runPipeline` | P `run#Pipeline` | POST `r/{id}/pipelines` | `repositoryId`, `pipelineName`, `refName`, `operationId` | `runNum`, `state` | `quotaExceeded`, `limitReached`, `Unprocessable` for a pipeline without the manual event | Developer |
| 7 | `cancelPipelineRun` | P `cancel#Run` | POST `r/{id}/pipelines/{runNum}/cancel` | `repositoryId`, `runNum` | `state` | `Conflict` when it has ended | Developer; the account that asked for it |
| 8 | `retryJobRun` | P `retry#JobRun` | POST `r/{id}/pipelines/{runNum}/jobs/{jobRunId}/retry` | `repositoryId`, `runNum`, `jobRunId`, `operationId` | `jobRunId`, `state` | `quotaExceeded`; `Conflict` while it runs | Developer |
| 9 | `approvePipelineRun` | P `approve#Run` | POST `r/{id}/pipelines/{runNum}/approve` | `repositoryId`, `runNum` | `state`, `approvalState` | `Conflict` when it does not wait | Maintainer |
| 10 | `findCiSecrets` | P `find#Secrets` | GET `r/{id}/ci-secrets` | `repositoryId` | `secretList` (`secretId`, `name`, `scope`, `environmentName`, `createdAt`, `lastUsedAt`) | | Maintainer |
| 11 | `storeCiSecret` | P `store#Secret` | POST `r/{id}/ci-secrets` | `repositoryId`, `secretId`, `name`, `value`, `scope`, `environmentId`, `operationId` | `secretId` | `nameTaken` | Maintainer |
| 12 | `deleteCiSecret` | P `delete#Secret` | DELETE `r/{id}/ci-secrets/{secretId}` | `repositoryId`, `secretId` | `deleted` | | Maintainer |
| 13 | `findCiEnvironments` | P `find#Environments` | GET `r/{id}/ci-environments` | `repositoryId` | `environmentList` (`environmentId`, `name`, `targetUrl`, `requiredPipeline`, `approvalRequired`, `vaultId` (a Maintainer's), `hasToken`, `lastCommitId`, `lastDeployAt`) | | Developer |
| 14 | `storeCiEnvironment` | P `store#Environment` | POST `r/{id}/ci-environments` | `repositoryId`, `environmentId`, `name`, `operationId`, and from DG10 `targetUrl`, `vaultId` (no `token`: the token is an item of that vault), `requiredPipeline`, `approvalRequired` | `environmentId` | `nameTaken` | Maintainer |
| 15 | `deleteCiEnvironment` | P `delete#Environment` | DELETE `r/{id}/ci-environments/{environmentId}` | `repositoryId`, `environmentId` | `deleted` | `Conflict` with a secret scoped to it | Maintainer |
| 16 | `getPipelineSettings` | P `get#Settings` | GET `pipeline-settings` | `repositoryId` or `groupId` | `poolList` (`runnerPoolId`, `description`, `trusted`; the pools an operator allowed), `runnerPoolId`, `outsideRunnerPoolId`, `inheritedFromPath`, `usage` (`minutesUsed`, `runnerMinutesMonthly`, `periodKey`), `revision` | | Maintainer |
| 17 | `storePipelineSettings` | P `store#Settings` | PATCH `pipeline-settings` | `groupId`, `runnerPoolId`, `outsideRunnerPoolId`, `expectedRevision` | `revision` | `Unprocessable` for a pool the group may not use | Owner |

### 15.7 DG6: forum, lists and moderation (6)

| # | Operation | Service | Route | Input | Result | Refusals | Needs |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `setScopeForum` | S `set#ScopeForum` | PATCH `scope-forum` | `repositoryId` or `groupId`, `enabled`, `contactListId` (link an existing category), `expectedRevision` | `contactListId`, `enabled`, `revision` | `Unprocessable` for a category of another site or one the caller does not own; `policyRefused` for one wider than its owner | Owner |
| 2 | `reportSmithyTarget` | S `report#Target` | POST `reports` | `targetType` (`repository`, `group`), `targetId`, `reason`, `note`, `operationId` | `reported` | the gate's limits | confirmed |
| 3 | `hideSmithyTarget` | S `hide#Target` | POST `hidden` | `targetType`, `targetId`, `hidden`, `reason`, `expectedRevision` | `hidden`, `revision` | `Unauthorized` to unhide what staff hid | Owner of a group above the target; staff |
| 4 | `convertTopicToIssue` | I `convert#TopicToIssue` | POST `r/{id}/issues/from-topic` | `repositoryId`, `rootCommEventId`, `postIds`, `title`, `confidential`, `operationId` | `issueNumber` | `NotFound` for a topic the caller may not read; `Unprocessable` for a record topic; the gate's for the title and text | Reporter |
| 5 | `storeIssueMailRoute` | I `store#MailRoute` | POST `g/{id}/issue-mail-route` | `groupId`, `repositoryId`, `address`, `enabled`, `expectedRevision` | `routeId`, `revision` | `Unprocessable` for an address outside the site's route domains; `nameTaken` | Owner, and staff to enable |
| 6 | `claimHeldReport` | I `claim#HeldReport` | POST `held-reports/claim` (the page is `B/-/held-report/<token>`) | `token`, `operationId` | `repositoryPath`, `issueNumber` | `NotFound` for an unknown or expired token; `Unauthorized` when the account's confirmed address is not the sender's | confirmed |

Forum operations that change with DG6: `findTopics`, `findCategories`, `searchForum` and `getFeed` take
`scopeContactListId`; `findReviews`, `getReview`, `decideReview` and `findActions` accept the new target types and a
scope. The mbox importer, the list headers and the list invitations are Forum operations added to design-forum's
catalog in DG6, not Smithy's.

### 15.8 DG7: the site (16)

Refined in DG7.

| # | Operation | Service | Route | Input | Result | Refusals | Needs |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `getGroupLanding` | W `get#GroupLanding` | GET `g/{id}/landing` | `groupId` | `html`, `sourceRepositoryPath`, `sourcePath`, `editPath`, `pinnedList` of `repository`, `latestRelease` (`repositoryPath`, `release`), `newsList` (`rootCommEventId`, `title`, `date`, `path`), `activityList` (`kind`, `repositoryPath`, `title`, `actorHandle`, `date`, `path`) | | any |
| 2 | `setGroupLanding` | W `set#GroupLanding` | PATCH `g/{id}/landing` | `groupId`, `landingRepositoryPath`, `landingPath`, `newsContactListId`, `expectedRevision` | `revision` | `Unprocessable` when the file or the category is not found or is narrower than the group | Owner (GroupSettings, General, Landing) |
| 3 | `getDocsPage` | W `get#DocsPage` | GET `r/{id}/docs` | `repositoryId`, `refPath` | `ref`, `path`, `title`, `html`, `headingList` (`level`, `text`, `anchor`), `tocList` (`path`, `title`, `depth`), `editPath`, `refList` | | any |
| 4 | `findReleases` | W `find#Releases` | GET `releases` | `repositoryId` or `groupId`, `limit`, `cursor` | `releaseList` of `release` with `repositoryPath`, `nextCursor` | | any |
| 5 | `getRelease` | W `get#Release` | GET `r/{id}/releases/{tag}` | `repositoryId`, `tag` | `release`, `archiveList` (`format`, `path`), `capabilities` (`canEdit`) | | any (a draft: Maintainer) |
| 6 | `storeRelease` | W `store#Release` | POST `r/{id}/releases` | `repositoryId`, `tag`, `name`, `notes`, `sourceFormat`, `published`, `announce`, `expectedRevision`, `operationId` | `tag`, `announcementTopicId`, `revision` | `Unprocessable` for a tag that does not exist; the gate's for the notes | Maintainer |
| 7 | `deleteRelease` | W `delete#Release` | DELETE `r/{id}/releases/{tag}` | `repositoryId`, `tag`, `expectedRevision` | `deleted` | | Maintainer |
| 8 | `addReleaseAsset` | W `add#ReleaseAsset` | POST `r/{id}/releases/{tag}/assets` | `repositoryId`, `tag`, `name`, `attachmentId` or `artifactId` or `imageName`, `operationId` | `assetId`, `sha256`, `sizeBytes` | `nameTaken`, `quotaExceeded`; `Unprocessable` for a file the scanner refuses | Maintainer |
| 9 | `removeReleaseAsset` | W `remove#ReleaseAsset` | DELETE `r/{id}/release-assets/{assetId}` | `repositoryId`, `assetId` | `deleted` | | Maintainer |
| 10 | `downloadReleaseAsset` | W `download#ReleaseAsset` | GET `r/{id}/release-assets/{assetId}` | `repositoryId`, `assetId` | download | | any |
| 11 | `findComponents` | W `find#Components` | GET `components` | `groupId`, `query`, `limit`, `cursor` | `componentList` (`name`, `version`, `dependsOn`, `repositoryPath`, `description`, `latestTag`), `nextCursor` | | any |
| 12 | `getAddons` | W `get#Addons` | GET `g/{id}/addons` | `groupId` | `xml` | | any |
| 13 | `searchSite` | W `search#Site` | GET `search` | `query`, `types`, `groupId`, `repositoryId`, `limit`, `cursor` | `resultList` (`type`, `title`, `snippet`, `path`, `repositoryPath`, `date`), `nextCursor` | `Unprocessable` for a query under 2 characters | any |
| 14 | `findRedirects` | W `find#Redirects` | GET `redirects` | `query`, `source`, `limit`, `cursor` | `redirectList` (`redirectId`, `oldHost`, `oldPath`, `targetPath`, `source`, `note`), `nextCursor` | | site owner |
| 15 | `storeRedirect` | W `store#Redirect` | POST `redirects` | `redirectId`, `oldHost`, `oldPath`, `targetPath`, `note`, `operationId` | `redirectId` | `nameTaken`; `Unprocessable` for a target outside the site | site owner |
| 16 | `deleteRedirect` | W `delete#Redirect` | DELETE `redirects/{redirectId}` | `redirectId` | `deleted` | | site owner |

### 15.9 DG8: GitHub (9)

Built in DG8. The import's operations are named for GitHub (`startGitHubImport` and the rest), since the forum's mbox
import has `cancelImport`. Push mirrors are the framework's (F6,
[Git-Hosting](../../../../../docs/interfaces/Git-Hosting.md#push-mirrors)); a failure the framework tells the
mirror's giver of is told to the repository's Maintainers and Owners too (`handle#MirrorFailure`).

| # | Operation | Service | Route | Input | Result | Refusals | Needs |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `startGitHubImport` | X `start#Import` | POST `imports` | `groupId`, `sourceRepository`, `slug`, `repositoryId` (an existing mirror to fill), `token`, `options` (`issues`, `pullRequests`), `operationId` | `importId`, `repositoryId` | `nameTaken`; `Unprocessable` when GitHub refuses the token or the repository; `Conflict` while a run of the same source is active | Owner of the group; operator |
| 2 | `getGitHubImport` | X `get#ImportRun` | GET `imports/{importId}` | `importId` | `importId`, `repositoryPath`, `sourceRepository`, `stage`, `counts` (by type: `imported`, `source`, `failed`), `reportList` (`sourceType`, `sourceId`, `errorText`), `waitingUntil` (the API's rate limit), `revision` | | the same |
| 3 | `findGitHubImports` | X `find#ImportRuns` | GET `imports` | `groupId`, `limit`, `cursor` | `importList` (`importId`, `repositoryPath`, `sourceRepository`, `stage`, `createdAt`, `finishedAt`), `nextCursor` | | the same |
| 4 | `resumeGitHubImport` | X `resume#Import` | POST `imports/{importId}/resume` | `importId`, `token`, `expectedRevision` | `stage`, `revision` | `Conflict` while it runs | the same |
| 5 | `cancelGitHubImport` | X `cancel#Import` | POST `imports/{importId}/cancel` | `importId`, `expectedRevision` | `stage`, `revision` | | the same |
| 6 | `findMirrors` | X `find#Mirrors` | GET `r/{id}/mirrors` | `repositoryId` | `mirrorList` (`mirrorId`, `url`, `refs`, `deleteRefs`, `enabled`, `hasCredential`, `lastPushDate`, `lastResult`, `lastError`, `nextAttemptDate`) | | Maintainer |
| 7 | `storeMirror` | X `store#Mirror` | POST `r/{id}/mirrors` | `repositoryId`, `mirrorId`, `url`, `username`, `secret` (a token or a private key), `hostKeyFingerprint`, `refs`, `deleteRefs`, `enabled`, `removeCredential`, `operationId` | `mirrorId` | `Unprocessable` for a URL the outbound rules refuse or one with a credential in it; `secretRequired` for a new destination without the secret | Maintainer; stored as the Maintainer, whose right the framework checks at each push |
| 8 | `deleteMirror` | X `delete#Mirror` | DELETE `r/{id}/mirrors/{mirrorId}` | `repositoryId`, `mirrorId` | `deleted` | | Maintainer |
| 9 | `pushMirror` | X `push#Mirror` | POST `r/{id}/mirrors/{mirrorId}/push` | `repositoryId`, `mirrorId` | `queued` | `Conflict` while a push runs | Maintainer |

### 15.10 DG10: deploys (4)

Refined in DG10. `storeCiEnvironment` (DG5, 14) takes its target fields from this phase.

| # | Operation | Service | Route | Input | Result | Refusals | Needs |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `findDeployments` | P `find#Deployments` | GET `r/{id}/deployments` | `repositoryId`, `environmentId`, `limit`, `cursor` | `deploymentList` (`deploymentId`, `environmentName`, `commitId`, `runNum`, `state`, `requestedBy`, `decidedBy`, `createdAt`, `finishedAt`), `nextCursor` | | Developer |
| 2 | `getDeployment` | P `get#Deployment` | GET `r/{id}/deployments/{deploymentId}` | `repositoryId`, `deploymentId` | the row of 1 with `resultText`, `capabilities` (`canDecide`) | | Developer |
| 3 | `requestDeploy` | P `request#Deploy` | POST `r/{id}/deployments` | `repositoryId`, `environmentId`, `commitId` or `refName`, `operationId` | `deploymentId`, `runNum`, `state` | `Unprocessable` for a commit that is not on a protected branch or tag; `quotaExceeded` | Developer |
| 4 | `decideDeploy` | P `decide#Deploy` | POST `r/{id}/deployments/{deploymentId}/decision` | `repositoryId`, `deploymentId`, `decision` (`approve`, `refuse`), `reason` | `state` | `Conflict` when it does not wait; `checksRequired` when the pipeline has not passed | Maintainer |

141 operations: 16, 37, 15, 21, 17, 6, 16, 9 and 4.

## 16. Framework and data needs

Each is a work item for one lane. F1 to F9 are [Dogfood §12](../../../../../plans/Dogfood.md#12-framework-changes)'s;
the N items are what this design adds to them.

| Need | Lane | Phase | What |
| --- | --- | --- | --- |
| F1 | framework | DG1 | Anonymous read. For this design: the `authzServiceName` of the `ALL_USERS` grant is asked for a request with no credentials too (with no user), and its answer decides view; 401 with no credentials, 404 with them. |
| F2 | framework | DG1 | `repositoryPath` with `set#GitRepositoryPath`, `GitRepositoryPathRedirect`, the page URL as a clone address on a public-site host, clone URLs and webhook payloads from the path. A git path is resolved exactly first and then lower-cased (path, then redirect), so a mixed-case clone address finds a repository Smithy stored in lower case (§4.2). |
| N-BLAME | framework | DG1 | `org.moqui.git.GitServices.get#GitBlame` (`repositoryId`, `revision`, `path`; hunks of start line, line count, commit id, summary, author, date), with a size limit. |
| N-ARCHIVE | framework | DG1 | A tree at a revision as a zip or tar.gz stream (`get#GitArchive`), capped by client for anonymous callers. |
| N-TREE | framework | DG1 | `get#GitTree` with the last commit of each entry, bounded and paged (`hosting.rs` reads them today; the service's result is checked in DG1). |
| F3 | framework | DG2 | Git over SSH by key for any account. |
| N-KEYS | framework | DG2 | List services for an account's SSH keys and access tokens (`find#UserSshKeys`, `find#UserAccessTokens`), for the caller only. |
| N-PRERECEIVE | framework | DG2 | A pre-receive gitECA rule refuses a push with a message today (checked). Still needed: the rule is told the pushing user, the refs (`refs/for/*` included) and the size of the incoming pack. |
| N-CONFIRMED | mantle | DG1/DG2 | `mantle/public/ConfirmedAddress.js` (built in DG1 for public accounts). DG2: the internal-account branch (§5.5), and the copies of R17 replaced by it (`Forum.js`, whose copies do not check `verifiedAt`, `AccountHub.js`, `ExternalAccess.js`, `StoreTopics.js`, `CartRecovery.js`, `StoreOperations.js`, `DeliveryWorker.js`, `ForumImport.js`). |
| N-SSO-VERIFIED | framework | DG2 | A sign-in through a flow of `pass-authority@sso-flows` whose provider gives `email_verified` true for the account's current address writes the `VerifiedAddress` row. Today only the registration verify writes one. |
| N-DELETE | framework | DG2 | `org.moqui.git.GitServices.delete#GitRepository` (needs delete; removes the rows, the objects not shared with a fork network, the refs, rules, webhooks, statuses and redirects). None exists. |
| N-USAGE | framework | DG2 | `get#GitRepositoryUsage` (`repositoryId` or a list): stored bytes without the objects shared from a fork parent, LFS bytes, object count. Smithy does not read `GitObject` or `GitLfsObject`. |
| N-LFS-HOOK | framework | DG2 | The LFS batch API asks a configured service before it accepts an upload (repository, user, object sizes) and refuses with its message. LFS uploads do not pass pre-receive. |
| N-NAMES | mantle | DG1/DG2 | `SmithyCore.nameFree`, its call from Forum's `storeProfile`, and (DG2) from `SitePages.js` for a page route and a redirect. `SmithyCore.reservedNames` holds the apps' default bases, and a pass spec keeps it equal to `Apps.js`. |
| N-CHECK | mantle | DG1 | `check#GitRepositoryAuthz` by §5.4 (Smithy's answer alone when the repository has a Smithy row), and `get#RepositoryRights`. |
| N-KIND | mantle | DG3 | The topic kind `record` with every path of §12.1's list: the `topic()` branch; the scope module (`recordAccess`, `postAccess`, `categoryOwner`, `recordPage`); the writers; the refusals (tags, polls, `acceptAnswer`, `applyTopicAction` with move, merge, split, pin, unlist, timers, `fireTimer`, `createCaseFromTopic`, `caseReply`, `draftArticleFromTopic`, `getTopicLinks`); the readers (`getTopic`, `getPosts`, `getPostLocation`, `getPostHistory`, `findNotifications`, bookmarks, `findTags`, UniversalSearch); the review queue (`findReviews`, `getReview`, `claimReview`, `addReviewNote`, `decideReview`, `decideReviews`, `escalateReview`, `findActions`, BOSS Comms Moderation); the classifier (`queueClassification`, `classifyPost`); delivery (`DeliveryWorker.audience`, `candidateSources`); the outside readers (the `CommunicationEvent` search document and mr-marble's notifications, `get#InternalThreadMessages`, `find#PartyCommunicationEvents`, `get#RecordTimeline`); retention and `Bootstrap.convert#Root`. Also the post kind `event`, the visibility `staff` checked for each reader, and Markdown as a source format (§14.6). |
| N-GATE | mantle | DG3 | `ForumCore.gate` and `gateCommit`, called by `publishPost`, `updatePost`, `postInbound` and Smithy (§12.2); DG2's direct `sanctioned` and `applyRules` calls move into it. |
| N-PROJECTION | mantle | DG3 | `mantle.work.PublicProjectionServices` (§8.2), shared with the Client portal. |
| N-REFS | mantle | DG3 | `#n`, `!n` and `<repositoryPath>#n` in `find#TaskReferences`, `apply#CommitKeywords` and `link#MergeRequestItems` (§8.4). |
| N-BOSS-ISSUE | boss, mantle | DG3 | Projects' WorkItemDetail shows the issue number and the outward conversation of a task that has a `SmithyIssue`, and does not edit its description. A `WevConfidential` task that has a `SmithyIssue` is hidden in Projects (`get#VisibleProjectInfo` and the reads behind it) from everyone but the Smithy Owners of its repository and groups, and operators: a project manager is not an Owner for this unless they hold `SmrOwner` (§8.3). It is hidden by keeping the task in a companion project whose members are those Owners (§8.3), with `hiddenItemIds` as a second layer; `update#WorkItemField` and `update#TaskInfo` refuse the description of a task that is an issue. |
| F4 | framework | DG4 | Forks (§9.2), with a service that makes one (`fork#GitRepository`: source, new id, new path). |
| F5 | framework | DG4 | `refs/for/*`, `refs/merge-requests/*`, push options, `reviewTopic` and `pushedForReview`. |
| N-COMMIT | framework | DG4 | `commit#GitFiles` gains `branch`, `newBranch` (create it from `branch`), `asProposal` with `targetRef` and `mergeRequestId` (commit to `refs/merge-requests/<n>/head`), `expectedBlobIds` (path to blob id; a mismatch is a conflict), `authorName`, `authorEmail`, and returns the merge request it opened. It checks update for a branch and view for a proposal. Smithy's `commitFile` is its only caller for a repository with a Smithy row (N-HOOKS). |
| N-MRNUM | framework | DG4/DG8 | `create#MergeRequest` accepts a `sourceRepositoryId`, and for the import a given `mergeRequestNum`, final state and dates. |
| N-THREADS | mantle | DG4 | Review threads as posts with anchors, read by `get#ReviewThreads` beside today's (§9.1). |
| N-LOGIN | framework, mantle | DG8 | Built in DG8: the framework's `sso-linked-service` hook, called after a real SSO sign-in with the flow, the provider's host, the external id and login; Mantle's `handle#SsoLinked` records a GitHub id as `SmithyGithubLink` and claims placeholders (§18.2). |
| N-WRITE-ECA | framework | DG4 | Whether a gitECA rule on a merge's write can refuse it (the squash rule, §9.4). Else Projects' merge calls the Mantle check. |
| N-HOOKS | framework | DG4, F9 | For a repository with a Smithy row the framework's writes do not go around Mantle (§9.1): `merge#MergeRequest` to a protected branch needs delete; `create#GitCommitStatus` refuses the contexts `agreement/` and `ci/` from a user (`git-server` `reserved-status-contexts`; the system writes them); the REST of F9 asks `rest-write-check-service`, which Smithy answers by refusing every write but `commitStatus.create` and naming its own operation; its review threads are Mantle's (`review-thread-service`). Built with P11 and P12. |
| N-REACH | framework | DG4 | Whether a commit is reachable from a given set of refs of a repository, for the reads by commit id, and the same rule in upload-pack for a fetch by id (§9.2). |
| N-CONTAINS | framework | DG4 | The branches and tags that contain a commit, bounded, for CommitDetail (`getCommit.refList`, returned from DG4). |
| N-PUSHER | mantle | DG4 | The account that pushed a commit to a repository (from `GitUpdate`), for `commit.authorHandle` (§7 Commits). |
| F7, F8 | framework | DG5 | The engine and the drivers, with the records of §14.5 and the two hooks of §10. |
| N-SCOPE | pass, mantle | DG6 | Scope and link base in `Shared/View.js` and the forum's templates; `scopeContactListId` on the forum's reads (§12.5). |
| N-TARGETS | mantle | DG6 | The target types `repository` and `group`, the mail verdict, held mail, list headers by category (§12.3, §12.4). |
| N-ADDONS | framework | DG7 | `component-get` reads a server's `addons.xml` through a `myaddons.xml` entry. |
| F6 | framework | DG8 | Built: the push client over HTTPS and over SSH, `GitRepositoryMirror`, the queue and back-off; with it `fetch#GitRefs` and imported merge requests (N-MRNUM). |
| F9 | framework | P11, DG5 | Built: REST for repositories, merge requests, reviews, threads and runs. For a repository with a Smithy row its writes are refused there and made through Smithy's REST (N-HOOKS), so the confirmed address, the gate and the roles hold; a public account's token reaches only what §5 allows. |

## 17. Documents and outputs

| Output | Kind | From | Access |
| --- | --- | --- | --- |
| Every page of §2 | server HTML | its screen | the same authorized projection as the island's |
| Raw file, archive, release asset, artifact | download | `downloadBlob`, `downloadArchive`, `downloadReleaseAsset`, `downloadArtifact` | the view rule; never rendered as a page of the site |
| `addons.xml` of a group | XML | `getAddons` | public components only |
| `robots.txt`, `sitemap.xml` | text, XML | `Smithy/robots`, `Smithy/sitemap` | public groups, repositories, docs pages and releases; no issue, merge request, commit or blob page is listed, and `robots.txt` disallows `/-/raw/`, `/-/archive/`, `/-/blame/`, `/-/commits/` and `/-/compare/` |
| Mail for an issue, a merge request, a review | email | the post engine's outbox | each recipient's access checked at send time; reply by email |
| A release's announcement, news | forum topic and its RSS | `storeRelease`, Forum's `getFeed` | the category's |
| Commit status `agreement/authors` | `GitCommitStatus` | §9.4 | as the repository |
| Social metadata of a public page | HTML meta | the page | public repositories and groups only |

## 18. Inventories and migration

### 18.1 Inventories

The outside systems could not be read when this design was written. Each inventory is a named, empty table with its
columns, **filled before DG9**; DG7 and DG8 check their fixtures and redirects against them when they are filled.

**I1. GitHub repositories of the `moqui` organization**

| Repository | Default branch | Size | Open issues | Closed issues | Open pull requests | Closed pull requests | Releases | Workflows | Lands in (group and slug) | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |

Filled before DG9.

**I2. Discourse (forum.moqui.org)**

| Plugin or feature | In use | Data it holds | Decision (carry, drop, map to) | Notes |
| --- | --- | --- | --- | --- |

Filled before DG9, with the backup's date, size, and the counts of categories, topics, posts and users.

**I3. Google Groups lists**

| List address | Purpose | Members | Messages | First and last message | Export method | Lands in (category) | New address | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |

Filled before DG9.

**I4. moqui-site pages and URLs**

| Old URL | What it is | Kept, moved or dropped | New place (repository and path, or page) | Redirect target | Notes |
| --- | --- | --- | --- | --- | --- |

Filled before DG9. It includes the documentation at `https://moqui.org/m/docs/...` that
[Contributions](../../../../../docs/dev/Contributions.md) and each `AUTHORS.md` link to.

**I5. Hosting**

| Machine | Role (server, runner host, staging) | Provider | Size | Ports and DNS | Backup place | Notes |
| --- | --- | --- | --- | --- | --- | --- |

Filled before DG9.

### 18.2 The GitHub import

Built in DG8 and refined there, on the forum importer's shape (staged, resumable, safe to run twice) with
`SmithyImportRun` and `SmithyImportMap`. Tested on recorded API responses; a run against GitHub is a rehearsal for
DG9.

| GitHub | Becomes | Notes |
| --- | --- | --- |
| The repository | a hosted `db` repository made from its `remote` mirror, at `<group>/<slug>` | the mirror is DG1's; cutover turns it around |
| A user (an author, commenter, assignee, reviewer) | a placeholder account: a party and a `PublicSiteProfile` whose handle is the login in lower case when that is a valid, free handle, else `gh-<login>` cut to 32 characters with a digit suffix when taken (a login of 1, 2 or 33 to 39 characters is no valid handle), and a `SmithyAccount` with `githubLogin` and `placeholder` `Y` | by GitHub's id first (`githubUserId`, with `githubHost`), so a renamed or reused login is not another person; no email is stored; the name shows with an "imported" mark; claimed (`claimedAt`) as below, and the person's own account takes the placeholder's rows |
| A label, a milestone | the project's label, milestone | by name |
| An issue | a task (`WevGeneral`) and a `SmithyIssue` with the same number; the text as the topic's first post, Markdown kept as the source | state and reason mapped by §8.5; `createdAt` and the author kept |
| An issue comment | a post of the topic, with its date and author | no notification is sent for imported posts |
| A reaction | a `ForumReaction` where the forum has the reaction, else counted in the report | |
| A pull request | a `GitMergeRequest` with the same number in its final state, its head fetched from `refs/pull/<n>/head` to `refs/merge-requests/<n>/head`, and a `SmithyMergeRequest` with its topic | N-MRNUM; a merged one keeps its merge commit |
| A review | a review post with its decision | |
| A review comment | a post with a `CommunicationEventGitAnchor` | an outdated position is kept as `outdated` |
| A link `#n` or a GitHub URL of the same repository in text | left as text; it renders as a link by §8.4 and §4.4's compatibility forms | numbers are kept, so no rewrite is needed |
| An old GitHub URL | `SmithyRedirect` rows are not needed for issues and pull requests (the compatibility forms answer them); a row with `source` `github` is written only for what moved elsewhere | |

Not carried, and named in the run's report: issue and pull request edit history, GitHub Projects boards, Discussions,
draft releases' assets, check runs, and the `agreementState` of imported merge requests (they are in their final
state).

The run waits on the API's rate limit (`waitingUntil`), resumes from `cursorJson`, and writes nothing twice: each
source item has one `SmithyImportMap` row. The token is kept encrypted for the run and removed when it ends.

**The claim of a placeholder.** It is by the framework's `user-facade` `login` `sso-linked-service`
(`mantle.smithy.SmithyImportServices.handle#SsoLinked`, named in Mantle's `MoquiConf.xml`), which the framework calls
after a real SSO sign-in that linked or confirmed the account's provider id commits; an edit of
`UserAccount.externalUserId` by hand is no sign-in and calls nothing. Only an `OctGitHub` flow counts whose endpoints
are GitHub's own (its client type's defaults, or exactly github.com's addresses), or a GitHub Enterprise Server's own
addresses on the placeholder's `githubHost`, with the provider's host that GitHub's and the id the account's now. The
proof is recorded as `SmithyGithubLink`, and `claim#GithubAccount` then claims the placeholder of that id in each site
where the account is an active member and not suspended, each site apart. When a proven account's membership of a
site becomes active later, the rule `SmithyClaimOnMembership` claims that site's placeholders too, from the
`SmithyGithubLink`. The account takes the GitHub login and id (so the agreement counts its imported commits) and the
placeholder's records.

### 18.3 Rollout

DG1 alone is a public, read-only site over `remote` mirrors of GitHub. Each later phase ends usable (Dogfood §13). A
site that mounts Smithy starts with no group, the `ScpRequest` policy, and every feature of a new repository off but
merge requests.

## 19. Validation

By [the testing skill](../../../../../.agents/skills/testing/SKILL.md) and
[the two suites](../../../../../docs/Build-Test.md#the-two-suites).

- **Regression specs check rules.** Each is in the component that has the rule: Mantle's in mantle `test/smithy/` (and
  `test/forum/` for the forum's changes), the framework's as Rust tests, PASS's in pass `test/Smithy/`. A Mantle rule
  is not tested again through a page.
- **No sweep of Smithy's screens in regression**, and a screen is rendered at most once, where it has logic of its
  own.
- **Acceptance** holds the two walks Dogfood names, the per-operation access walk and the phone-width check, each
  written with its phase and run then.
- Budgets (`test/budget`) are not raised. A spec that cannot fit is moved to acceptance or cut.

### 19.1 Regression specs by phase

| Phase | Spec | Where | The rules it checks |
| --- | --- | --- | --- |
| DG1 | `SmithyNames` | mantle `test/smithy/` | segment rules; reserved words, mounts and `reservedPaths`; a handle refuses a group path and a group path a handle; a subgroup and a repository cannot share a name |
| DG1 | `SmithyVisibility` | mantle | effective visibility is the narrowest; anonymous views public only; a site member views members-only; private needs a role; a wider child is refused; hidden, requested and unpublished are Not Found |
| DG1 | `SmithyRoles` | mantle | inheritance group to subgroup to repository; the greater of project roles and membership rows; an expired row; a suspension; the answers of `check#GitRepositoryAuthz` for view, create, update and delete, with and without a Smithy row, and with no user; a project member of a hidden repository, or under a suspension, gets nothing when the repository has a Smithy row |
| DG1 | `SmithyPaths` | mantle | `resolveSmithyPath` (repository, group, account, redirect, compatibility form, Not Found for a hidden one, and for a redirect whose target the caller may not view; another site's id is Not Found); `splitRefPath` (a branch with slashes, the longest name, a branch before a tag, a commit id) |
| DG1 | `SmithyAccess` | pass `test/Smithy/` | §19.2: about seven rules, one holder and one non-holder each; started here, a rule added with its phase |
| DG1 | `Smithy` | pass `test/Smithy/` | the resolver's grammar (every row of §4.4 once, with its `screenPath` and `screenParameters`; `..` refused, `...` accepted in compare); one render of Files, of Blob and of CommitDetail, each with its checks; the registries' copies identical |
| DG1 | `SmithyWalk` | pass `test/client/` | the app's one golden-path client walk, at the desktop width only: Home, a repository, a file, a commit; extended with one step a phase. The phone width is an acceptance check (§19.3) |
| DG1 | git server tests | `crates/moqui-git/src/server/tests.rs`, `crates/moqui-host/tests/it/git_hosting.rs` | with the real `git` client: an anonymous clone of a public repository; 401 then 404 for a private one; clone by path, by old id, after a rename, by the page URL |
| DG2 | `SmithyCreatePolicy` | mantle | operators, by request (request, approve, refuse) and verified; a personal repository and its count limit |
| DG2 | `SmithyMembers` | mantle | only an Owner sets roles; the last Owner stays; an end date ends the role |
| DG2 | `SmithyRename` | mantle | rename and transfer change the path and leave a redirect; a redirect ends when the path is taken; a transfer narrows the visibility |
| DG2 | `SmithyQuota` | mantle | `check#Push` refuses over the repository's and the LFS limit; a fork counts its own objects |
| DG2 | `ConfirmedAddress` | mantle `test/public/` | the helper, for a public and an internal account; the push gate leaves a repository with no Smithy row alone; a Smithy write and a push refused without a confirmed address |
| DG2 | SSH tests | `crates/moqui-host` | a public account pushes by key; a Reporter's push is refused |
| DG3 | `SmithyIssues` | mantle | numbers under the lock; the state mapping both ways; label, assignee and milestone by role; the author's own edits; `ensure#Issue` only for a Smithy project with issues on, with no backfill, and Not Found when the task leaves `WevGeneral` |
| DG3 | `SmithyIssueProjection` | mantle | the fields of §8.2 and nothing else: a task with Chatter, time, cost, an estimate, an internal member and a non-public sibling leaks none of them; a hidden item is a count |
| DG3 | `SmithyConfidential` | mantle | Not Found to a stranger, a Developer and a Maintainer; read by an Owner; the reporter's own view; made public both ways; absent from lists, counts and mail; a `staff` post is not mailed to the reporter nor in their history; a held post is in no moderator's queue but an Owner's and is not classified; hidden in Projects from a project manager |
| DG3 | `SmithyReferences` | mantle | `#12`, `!12`, `<path>#12`; `Fixes #12` completes on the default branch only; a key still works; another repository's issue is not completed |
| DG3 | `ForumGate` | mantle `test/forum/` | allow, hold and refuse, the same from `publishPost`, from mail and from `createIssue`; each limit and its refusal kind |
| DG3 | `RecordTopics` | mantle `test/forum/` | a record topic is in no topic list, tag list, search, feed, sitemap or digest; its review item carries the scope's category; an Owner of the scope moderates it and a site moderator without view does not; move, merge, split, case and article actions are refused; it is in no internal thread read and no search document |
| DG3 | `Markdown` | mantle `test/forum/` | Markdown is rendered and cleaned; the source is kept in the revision; an edit keeps the format |
| DG4 | `SmithyMergeRequests` | mantle | a viewer's review is a comment and a Developer's approves or requests changes; a Maintainer merges; a merge request from a fork; a held one is Not Found to others |
| DG4 | `SmithyAgreement` | mantle | parsing (both lists, a line outside a list, a fenced block); "its own" by the adding commit's author; a GitHub noreply address; the status at open and at a new head; a bot; the squash refusal; off by default and the inheritance |
| DG4 | `SmithyForks` | mantle | a fork is no wider than its parent; the policy, the limit and the quota; a commit of a private fork is Not Found by id at its public parent; a push to `refs/for/*` over the byte cap is refused |
| DG4 | `SmithyEdit` | mantle | the three destinations by role and branch rule; the conflict by `baseBlobId`; a binary, an LFS pointer and a large file are not editable |
| DG4 | fork and push-to-review tests | `crates/moqui-git` | with the real `git` client: a fork shares objects; a merge across two repositories; `refs/for/main` opens and updates; `refs/merge-requests/<n>/head` is fetched by name and not advertised |
| DG5 | `SmithyPipelines` | mantle | `check#Run`: untrusted for a fork, a pushed merge request and a non-Developer; the first contribution waits; a personal repository without minutes; the monthly limit; secrets by role |
| DG5 | engine tests | `crates/moqui-git/src/ci/` | against the fake host type: planning, `needs`, the matrix, statuses, the job token's rights, masking, time-outs |
| DG6 | `SmithyForumScope` | mantle | a group's category is made with it and is no wider; a read with a scope returns the subtree only |
| DG6 | `SmithyModerationTargets` | mantle | a report files one item; a group's Owner hides a repository and it is Not Found in the page operations and in `get#RepositoryRights`; staff's hide is not undone by an Owner |
| DG6 | `SmithyHeldReports` | mantle | mail from a confirmed address files a confidential issue; from another address it is held, answered once, and filed by `claimHeldReport` |
| DG6 | `MailVerdict`, `ListHeaders`, `MboxImport` | mantle `test/forum/` | spam is held; a list category has its own headers; a small mbox imports once, threaded, and again with no duplicate |
| DG7 | `SmithyDocs` | mantle | a page at a branch and at a tag; links rewritten; a path outside the docs directory is Not Found; the output is cleaned |
| DG7 | `SmithyReleases`, `SmithyComponents`, `SmithySearch`, `SmithyRedirects` | mantle | a draft is a Maintainer's; `component.xml` read on a push; `addons.xml` lists public components only; each search type keeps its rule (a confidential issue and a private repository are not found); a redirect is used only when nothing takes the path |
| DG8 | `SmithyGithubImport` | mantle | on recorded responses: numbers kept; twice with no duplicate; a resume after a rate-limit wait; a placeholder claimed through the sign-in hook, only for GitHub's own endpoints and the placeholder's host, and again when a proven account's membership becomes active |
| DG8 | `SmithyMirrors`, push client tests | mantle, `crates/moqui-git` | settings by role and the secret never returned; a new host needs the secret again; a mirror whose giver is no longer a Maintainer pauses; a failure told to Maintainers and Owners; a push over HTTPS to a local server, forced to match |
| DG10 | `SmithyDeploy` | mantle | a deploy needs a passed run and, where set, an approval |

### 19.2 The one access spec: `SmithyAccess`

pass `test/Smithy/SmithyAccess.spec.js`, as PASS's other apps have one. It checks rules, not operations: about seven,
each with one holder and one non-holder on one operation, and the roles' own rules are Mantle's specs.

| Rule | Holder | Non-holder | On |
| --- | --- | --- | --- |
| Visibility: what a caller may not see is Not Found | anonymous on a public repository | anonymous on a members-only one, and a site member on a private one | `getRepository` |
| A write needs a confirmed address (D17) | a confirmed account | an account without one (`addressUnconfirmed`) | `createRepository` (DG2), then `createIssue` (DG3) |
| A viewer's write: anyone who may view files an issue | a stranger on a public repository | a stranger on a private one (Not Found) | `createIssue` (DG3) |
| Triage needs Reporter | a Reporter | a Guest (`accessDenied`) | `setIssueLabels` (DG3) |
| Code needs Developer | a Developer | a Reporter | `createRef` (DG2) |
| Settings need Maintainer | a Maintainer | a Developer | `storeBranchRule` (DG2) |
| Ownership needs Owner | an Owner | a Maintainer | `setRepositoryVisibility` (DG2) |
| Another site's record is Not Found | the site's own id | an id of another site | `getGroup` |

Fixtures: one group with a public, a members-only and a private repository, and one account for each actor a rule
names. In DG1 the spec has the first and the last rule.

This departs from Dogfood §14 on purpose. Dogfood asks for "every operation against anonymous, a signed-in stranger,
and each role, on a public, a members-only and a private repository"; the testing skill forbids that matrix in
regression ("one holder and one non-holder on one verb of the rule ... not every route for every group", no users by
modes matrices, and Mantle rules not tested again through an app). The per-operation table is an acceptance spec,
`SmithyAccessWalk` (§19.3).

### 19.3 Acceptance walks

| Walk | Where | Written in | Scenario |
| --- | --- | --- | --- |
| `SmithyContribution` | pass `test/acceptance/SmithyContribution.spec.js` | DG4 | An outside account forks `moqui/mr-moqui`, pushes a branch with the real `git` client, opens a merge request, is told to sign, signs on the page, and a Maintainer merges it. A second account pushes to `refs/for/main` and its merge request opens. A third edits a line of the docs on its page and the merge request opens. |
| `SmithyPipeline` | pass `test/acceptance/SmithyPipeline.spec.js` | DG5 | A push runs a pipeline on the fake host type, the log and the failed test show on the run's page, and the red run blocks the merge until a green one. |

| `SmithyAccessWalk` | pass `test/acceptance/SmithyAccessWalk.spec.js` | DG2, extended each phase | Driven by a table of every operation of §15 with its need; it fails when `SmithySchema.js` has an operation the table lacks. Each operation is called as the lowest actor that holds its need and as the highest that does not, and from a private repository as a stranger (Not Found). |
| `SmithyPhone` | pass `test/acceptance/client/SmithyPhone.spec.js` | DG1, extended each phase | `SmithyWalk`'s path at 390 px: no sideways page scroll, the tabs and the clone box usable. |

Each is run when it is written or changed, and with `./moq accept mr-pass` when asked. Rehearsals on real outside data
(a Discourse backup, a list's archive, GitHub's API, a runner on a second machine) are by hand, for DG9.

### 19.4 Completeness

45 screen rows in §2 with a definition each in §6 to §13 (the settings tabs and the site sections are defined with
their screen); the transitions and the island screens of §4.4 are not rows. 141 operations in §15, each named by the
screen or the control that uses it (`reportSmithyTarget` and `hideSmithyTarget` in §12.3, `convertTopicToIssue` in
§12.5, `claimHeldReport` in §12.4, `setGroupLanding` in §13.1); `findMergeRequests` with `groupId` has no page yet.
Every need of §16 has a lane and a phase.
The checks this document passed when written: the screen and operation counts, relative links, and that each existing
name of §3 is in the code.

## 20. Decided

| Decision | Rests on | Notes |
| --- | --- | --- |
| Smithy is a PASS app with its rules in `mantle.smithy`; the framework is the git host; Smithy and Projects' Code share what is underneath | D2, D3 | §4.1 |
| `repositoryId` is the key; `repositoryPath` is what URLs carry, lower case, with `/-/` before a section | D4 | §4.2, §4.4. Lower case, so the framework's exact comparison is enough and no second field is needed; the name as typed is `SmithyRepository.name` |
| Handles, group paths, mounts and reserved words are one name set, checked in one function | D4, Dogfood §5.1 | §4.2 |
| The resolver tells a subgroup from a repository by lookup, since sibling names are one set | D4 | §4.4 |
| Public, members, private; `members` is the site's active members (as GitLab's internal); a repository is no wider than its group | D5 | §5.1. A Guest's role matters for private only. To confirm with the user (§21 question 1) |
| Five roles as rows on a group or a repository, inherited downward; the greater of them and the project roles | D5 | §5.2 |
| One Mantle check, `check#GitRepositoryAuthz`, for git, REST and pages; for a repository with a Smithy row its answer is Smithy's alone; what a caller may not see is Not Found | D5 | §5.4 |
| An issue is a task with a `SmithyIssue`; it always belongs to a repository, and a group's tracker is a repository | D6 | §8.1. A group-level issue would have no URL in Dogfood §5.3 |
| Confidential issues: any account files, Owners (an `SmrOwner` row, not a project manager) read and edit, in Smithy and in Projects, the reporter keeps their own view; a held post is its Owners' to review and is not classified | D6, question 7 | §8.3, §12.1 |
| Forks and push-to-review; "merge request" is the one term | D7 | §9.2, §9.3 |
| The conversation is a `ForumTopic` of kind `record`, in the repository's category as its scope | D8, D9, question 3 | §12.1 |
| A record topic's every forum path is named and ruled (§12.1's eleven items), and its moderators need view of the record | D18 | §12.1 |
| The framework's writes do not go around Smithy for a repository with a Smithy row: its REST refuses them and names Smithy's operation; `agreement/` and `ci/` contexts are the system's; a merge to a protected branch needs Maintainer | D5, D17, D18 | §9.1, N-HOOKS |
| `SmithyAccess` checks about seven rules; the per-operation table is the acceptance spec `SmithyAccessWalk` | the testing skill, against Dogfood §14's wording | §19.2 |
| A line comment is a post with an anchor | D8 | §9.1; refined in DG4 |
| A group always has a category; a repository has one when its Forum is on | D9 | §12.5 |
| Smithy shows runs and keeps the trust, approval and quota rules; the engine and its records are the framework's | D10, D11 | §10 |
| The mirror and the importer; numbers kept, so old links work by the compatibility forms | D12 | §18.2 |
| The agreement is a status computed by §9.4's algorithm, off by default, a setting of a group or a repository | D13 | §9.4 |
| A page edit is one file, one commit, to the branch, a new branch or a proposal | D14 | §9.5 |
| The site is Smithy: the home group's Overview, Docs, Releases, the component directory | D15 | §13 |
| Repositories of moqui.org are `db` repositories; nothing in this design depends on the kind | D16 | |
| Every write needs a confirmed address, a stored fact for a public, an internal and a provider account, checked by one helper, in the gate and in the pre-receive rule of a repository with a Smithy row | D17 | §5.5 |
| No moderation rows of Smithy's own; one gate; the targets `repository` and `group` | D18 | §12.2, §12.3 |
| Nothing here names a provider | D19 | |
| `ci.xml` only | question 6 | |
| A personal repository and a fork for any confirmed account with small quotas; a group by request | question 8 | §11 SiteSettings |
| A number per repository beside the work item's key; `#n` is an issue first, `!n` a merge request | question 9 | §8.4 |
| Open CI: approval for a first contribution, an outside pool without secrets, quotas, no runs for a personal repository without minutes | question 10 | §10 |
| A role is the party's, so a maintainer's internal and public accounts hold the same role | question 12 | §5.2 |
| No bearer-link write; an access token is for git and the framework's REST | PASS's pattern | §5.5, §15.1 |
| PASS takes an installed app's device login key for the Dev AIDE's listed operations, with the account's normal rights; access tokens, scoped keys and session keys for none | the user, Nov 14, 2026 | §5.5 |
| The inventories are named, empty tables, filled before DG9; DG9 is not built | the build plan | §18.1 |

## 21. Open

1. **To confirm with the user: what members-only means.** This design takes `SmvMembers` as the site's active
   members, as GitLab's "internal", and a Guest role matters for a private repository only. Dogfood §5.2's table
   reads: "Guest | read a members-only or private one", which can be read as members-only needing a role. On
   moqui.org a site member is every registered account; on a dev shop's server, where registration is closed or by
   invitation, it is the people the shop invited. DG1 builds `SmithyVisibility` on this reading.
2. **A provider's login.** The agreement's identities and the claim of an imported placeholder need the GitHub login
   of an account that signs in through the provider. Where the framework keeps it, and how it reaches
   `SmithyAccount.githubLogin`, was not read for this design. DG4 checks it (N-LOGIN); until then the agreement
   matches by confirmed address and handle only.
   - Answered in DG8 (Nov 14, 2026): the framework calls `sso-linked-service` after a real SSO sign-in, and Mantle's
     `handle#SsoLinked` records the GitHub id (`SmithyGithubLink`) and claims the placeholders of that id (§18.2).
3. **The project of a personal repository's issues.** A project needs its owner in Mantle (an organization, a
   manager). Which organization owns the project made for a public account's repository, and whether BOSS Projects
   lists such projects, is DG3's check. Proposed: the site's operating organization owns them, in a status that keeps
   them out of Projects' default lists.
4. **A refusal from a rule on a merge's write.** A pre-receive rule refuses with a message today. Whether a gitECA
   rule on a merge's write can refuse it (N-WRITE-ECA) decides where the squash check sits for a merge that does not
   come through Smithy. DG4 checks; the design holds either way, with the check in the rule or in N-HOOKS' hook.
5. **A job's log, live.** Polling `getJobLog` is the first version. Whether a signed-out visitor may hold the
   notification socket for a public run's log is DG5's.
6. **Private components in `addons.xml`.** A dev shop's group server serves members-only components to a token. How
   `component-get` sends it is DG7's (N-ADDONS).
7. **A page URL as a clone address under a mount other than `/`.** The framework serves git at a page's URL by the
   path as it came, so it works where Smithy is the root app. Whether a mount such as `/code` should clone too (the
   host would remove the mount's base) is left until a site asks for it.
