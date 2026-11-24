# Smithy: implementation record

What is built of [design-smithy](design-smithy.md), by phase of
[Dogfood](../../../../../plans/Dogfood.md#13-phases). Each phase lists what differs from the design and what is left.

## DG1: public read

| Area | Implementation |
| --- | --- |
| Registration | `service/pass/Apps.js` (`smithy`, base `/code`), `screen/Pass.xml`, the header's Smithy branch, `SmithySchema.js` (a copy of Mantle's, merged by `Facade.js`), `Routes.js`, `Shared/Portal.js` reasons |
| Routes | `service/pass/SmithyRoutes.js`, called by `resolve#Route` for a Smithy mount: names, then a section after `/-/`; GitHub's forms and a name not in its stored case redirect after Mantle's view check |
| Pages | `screen/Smithy/`: Home, Explore, AccountDetail, GroupDetail (Overview, Repositories, Members), RepositoryDetail (Files, Blob, Commits, Branches, Tags), CommitDetail, Compare; `raw` and `redirect` are transitions. HTML with no script |
| Mantle | `mr-mantle` `mantle.smithy`: `SmithyEntities.xml`, `SmithyCore.js` (site, group and repository access, the name set, path lookup), `Smithy.js` (16 read operations), `create#Group`, `create#Repository`, `bind#Repository`; `check#GitRepositoryAuthz` gives Smithy's answer for a repository with a Smithy row |
| Tests | `test/Smithy/Smithy.spec.js`, `SmithyAccess.spec.js`; Mantle's `test/smithy/` (SmithyVisibility, SmithyRoles, SmithyNames, SmithyPaths) |

Differences from the design:

- Links carry a ref's short name, not its full name.
- A list sorted by "pushed" is in path order; there is no stored push date yet.
- A commit of more than 100 files shows its file list, and a file's diff when asked.
- `getSmithyHome` does not make the `SmithySite` row.

Not built: syntax highlighting and the tree and diff islands, a page rendered on a root mount in a spec. Blame, the
archive download and the client walk (`SmithyWalk`) came with DG2.

## DG2: accounts and push

| Area | Implementation |
| --- | --- |
| Routes | `SmithyRoutes.js` routes `new/group`, `new/repository`, `-/site[/<tab>]`, `-/do/<name>`, a group's `-/settings[/<tab>]` and a repository's `-/settings[/<tab>]`. The grammar has every tab of design §4.4; a tab of a later phase is Not Found (`BUILT_TABS`: the site's `settings`, `requests`, `quotas`; a group's `general`, `quota`, `delete`; a repository's `general`, `members`, `branch-rules`, `webhooks`, `archive`) |
| Forms | `screen/Smithy/Do.xml`: 29 `post` transitions, one for each write operation and named for it. `SmithyForms.js` `run` builds the operation's input from the form's fields (`DO`), calls it in its own transaction, and answers 303: to the page of what was made or changed, or back to the form's `returnTo` (a path under the mount) with the refusal's text and what was typed. That is kept in the session for the one next page (`Smithy.js` `setFlash`, `takeFlash`; dropped after two minutes; a password, a secret and a typed path are not kept). The framework checks the session token before a transition runs |
| Pages | `screen/Smithy/New/Group`, `New/Repository`, `Site`, `GroupDetail/Settings`, `RepositoryDetail/Settings`, `Account/GitAccess`; GroupMembers, GroupRepositories, Branches, Tags, the empty repository's page, the shells and the header gained their DG2 parts. The pages that write are built in `SmithyForms.js` as escaped markup (its `h`), with no script |
| Confirmation | A visibility change (a group's, a repository's), archive and unarchive, transfer, a delete (a group, a repository, a branch, a tag) and removing a key or a token are asked again on a page of their own, a GET of the same page with `?confirm=`, which names the target and the consequence; a group's and a repository's delete take the path typed (`confirmPath`). The transition refuses such an action without that page's answer |
| Access | A tab is shown by the role the read answers: a repository's Settings to a Maintainer (`capabilities.role`), its Archive tab and the Members' forms to an Owner, a group's Settings to an Owner (`myRole`), SiteSettings to the site's owners and operators (`getSiteInfo`'s `canManageSite` and the revision `getSmithySettings` gives them alone). Anyone else gets Not Found. An account without a confirmed address sees "Confirm your email address" in place of a form |
| Git access | `Account/GitAccess` (Not Found on a site with no Smithy mount): SSH keys and access tokens, Add and Remove, the password asked again. A new token is in the session for the one page after its form, which shows it once; it is in no address, and the page is `no-store` |
| Header | Smithy's branch has New repository, New group, Site settings (the site's owners), My account, Git access and Sign out (a form to Account's `endSession`) for a signed-in account |
| Caching | A publicly cached answer now has `Vary: Cookie` (`Shared/Headers.js`, for every app), so after a sign-in the browser does not show the anonymous copy of a page it kept |
| Blame | `RepositoryDetail/Blame` (`-/blame/<refPath>`, `getBlame`): a table of the file's lines, escaped, each run with its commit linked where it starts (`#L10` anchors); a file with no blame (binary, in Git LFS, too large, a history past the limit) shows the refusal's text. Linked from the file's page |
| Archive | The `archive` transition of `RepositoryDetail` (`-/archive/<ref>.zip`, `.tar.gz`, `downloadArchive`), streamed by `Facade.js` `downloadFile`, as an attachment named `<slug>-<ref>.<format>` by the raw file's safe-name code, `no-store`. For a signed-in account: a visitor who may view the repository is sent to sign in. The links are on the root of Files and on each tag, for a signed-in account |
| Registries | `SmithySchema.js` and `Routes.js` are copies of Mantle's with the 37 DG2 operations (53 Smithy operations in all) |
| Tests | `test/Smithy/Smithy.spec.js` (the DG2 paths; one render of a repository's Settings; Git access with a token a public account makes through its form, shown once; one render of Blame; the archive transition's headers and a visitor sent to sign in; a form's post, its refusal on the form, an ending action not run without its confirmation, a return address off the mount not used; the registries), `SmithyAccess.spec.js` (a confirmed address on a form's post; Developer, Maintainer and Owner, one holder and one non-holder each; the tabs by role; no Smithy write among the bearer writes). Acceptance: `test/acceptance/client/SmithyWalk.spec.js` with `test/acceptance/SmithyWalkFixtures.spec.js` |

Differences from the design:

- A group's members are changed on its Members page (design §6 GroupMembers), not on a tab of its Settings.
- GitAccess's forms post to Smithy's `Do` (design §1), so they return to the Account page by a fixed address, not by the
  form's `returnTo`.
- Every visibility change is confirmed, a narrowing too, and so are a branch's or a tag's delete and removing a key or a
  token; the design asks it for an audience-widening or destructive save.
- A refusal returns to the form by a redirect (303) with its text in the session, not as the answer to the post.
- NewRepository lists the groups `findGroups` (`mine`) answers, the caller's role in each not known; a group where the
  caller is less than a Maintainer is refused on the post. All three visibilities are offered, and a wider one than the
  group's is refused on the post.
- The password is asked on each change of the git access (Mantle's rule), not only for an older session.
- Sizes in SiteSettings and Quotas are typed in MiB and sent in bytes.
- `SmithyWalk` is an acceptance spec, not a regression one: it takes about five seconds, and the regression client
  suite's budget (9 s, 7.0 s used) has no room for it. It also checks the pages that write at 390 px, which the design
  gives to `SmithyPhone`.
- The session token's check is the framework's request check, which a server spec's render does not make, and a server
  spec has no HTTP server to make a real request of: `Smithy` reads it from `Do.xml` (every transition a `post`, none
  opting out) and the acceptance walk `SmithyWalk` posts without a token (401).
- Quotas: a field holds the account's or group's own limit (`getQuotaUsage`'s `ownLimits`), with the limit in effect
  as its hint; only a changed field is sent, and an emptied one gives up the own limit.
- Dates are shown as the day in the signed-in account's time zone, or the site's for a visitor. A member's end date and a
  token's expiry are typed as a day and sent as the end of that day (`yyyy-MM-dd 23:59:59`).
- What a form leaves in the session (a notice, a refusal, a new token) is dropped by `Pass.xml` on the next request of
  the account in any app once it is two minutes old, and when its page shows it.

Not built: a group's avatar and its issue repository (General); pinning a repository (`pinnedSequence`); the Redirects
tab of SiteSettings (DG7); `SmithyAccessWalk` (design §19.3, the per-operation acceptance table) and `SmithyPhone` as a
spec of its own; an archive for a visitor (the authority serves one to a signed-in account until it has a limit by
client).

## DG3: issues

| Area | Implementation |
| --- | --- |
| Routes | `SmithyRoutes.js` routes a repository's `-/issues`, `-/issues/new`, `-/issues/<n>`, `-/labels`, `-/milestones[/<id>]`, a group's `-/issues`, and the island `-/island/Composer.qvue` (`.qvt`, `.qjs`) |
| Pages | `screen/Smithy/SmithyIssues.js` builds them as escaped markup with `SmithyForms.js`'s helpers: `RepositoryDetail/Issues`, `Labels` and `Milestones`, `GroupDetail/Issues`, `NewIssue` and `IssueDetail` (the last two in the repository's shell, as CommitDetail is). A repository with issues off has none of them (Not Found) and no Issues tab |
| Issues list | Open and Closed with the counts `findIssues` answers, a GET form of filters (text, label, milestone, author, assignee, sort), "Confidential only" for an Owner alone, More by cursor. A group's list has the repository on each row, and its New issue asks for the repository (a GET form whose choice is redirected) |
| IssueDetail | `getIssue`, then the conversation: the posts of the issue's record topic by the forum's `getPosts` (author, day, "edited", "Waiting for review", "Owners only", a state change as one line), each body cleaned again here (`StringUtilities.cleanHtml`). Reactions are buttons for who may react. Forms by the read's `capabilities`: a comment (Markdown, with "Owners only" for an Owner of a confidential issue), a post's edit (`?edit=`, `getEditablePost`, `updatePost`) and report (`?report=`, `flagPost`), the title, labels, assignees (the handles `findAssignees` answers), milestone, Close as completed or not planned, Close as a duplicate (a Reporter), Reopen, the watch level (`getPreferences`, `setPreferences` with the topic's scope), and who reads it. The side blocks are `details`, closed, with the present value in the summary. The reporter of a confidential issue gets no block for a field the projection does not give |
| Confidential | The mark on NewIssue with who will read it; a chip on the list and the page for those who see it. Changing it is asked again on `?confirm=confidential`: make confidential; make public as it is, with the conversation shown under the question; or make a new public issue with a title and text written there (`asNewIssue`) |
| NewIssue | Title, a Markdown textarea, Confidential, and for a Reporter labels, assignees and milestone. A visitor gets Sign in, an account without a confirmed address "Confirm your email address", an archived repository a sentence |
| Preview | Every form of a text has a Preview button (`formaction` to `Do/previewPost`), which keeps what was typed and the authority's rendering in the session for the form's next page (the flash), and answers 303 back to the form. Nothing is stored |
| Island | `screen/Smithy/Islands/Composer.qvue` (`WebrootPublic.qvt.js` island mode), mounted in the one text form of a page: a Markdown or rich text (`m-rich-text`) toggle and a preview in the page (`Do/previewPost` as JSON). The plain textarea and `sourceFormat` stay the form's fields, kept in step, so the form posts as the plain one does. Quasar's stylesheets load only when rich text is chosen |
| Forms | `Do.xml` has 16 more `post` transitions (45): `createIssue`, `updateIssue`, `setIssueState`, `setIssueLabels`, `setIssueAssignees`, `setIssueMilestone`, `setIssueConfidential` (confirmed), `storeLabel`, `deleteLabel` (confirmed on `?delete=`), `storeMilestone`, the forum's `publishPost`, `updatePost`, `setReaction`, `flagPost`, `setPreferences`, and `previewPost` |
| Shells | The Issues tab of a repository (when issues are on) and of a group, with the open count `findIssues` answers for the caller. CommitDetail lists the issues its commit names; one the caller may not see is in "items not shown" only |
| Caching | No issue page (`-/issues…`, `-/labels`, `-/milestones…`) and no commit page (`-/commit/<id>`, which lists the titles of its issues) is kept by a cache, for a visitor either (`Shared/Headers.js`), since an issue may become confidential after a cache kept its page. The shells' Issues tab has its count only for a signed-in account, so a publicly cached shell carries none |
| Forum composer | `Forum/Compose.qvue` has "Write in": rich text or Markdown (a textarea), sent as `sourceFormat` on publish and on preview (`Compose.xml` preview takes the schema's fields) |
| Registries | `SmithySchema.js` and `Routes.js` are copies of Mantle's with the 15 DG3 operations (68 Smithy operations), `Schema.js` of `ForumSchema.js` with `sourceFormat` |
| Labels and Milestones | `RepositoryDetail/Labels`: each label with its colour (one of the names Projects' labels have), description and open count; a Maintainer adds, edits and deletes the repository's own (a label of the organization's, `editable` false, is shown without them). `RepositoryDetail/Milestones`: open and closed with the due date and the share closed, one milestone with its issues; a Maintainer adds, edits and closes |
| BOSS | Projects' WorkItemDetail (`mr-boss` `screen/Shared/WorkItemDetail.xml`, `get#WorkItemDetail`'s `issue`) shows `#<n>` beside the key, linked to the public page (the site's canonical host and Smithy mount), and a Public conversation box with the posts Mantle's `get#Posts` gives the user, apart from Chatter; the Edit dialog does not offer the description of a task that is an issue. The issue comes from Mantle's `get#TaskIssue`. A confidential issue's task (`get#VisibleProjectInfo` `hiddenItemIds`) is left out of BOSS's own reads of tasks through `service/ironstone/projects/HiddenItems.js` (mr-boss `plan/impl-projects.md` §10) |
| Tests | `test/Smithy/Smithy.spec.js` (the DG3 paths; one render each of Issues, IssueDetail and NewIssue; a create through `Do`, its refusal, an unconfirmed account and a preview; a commit's linked issue on the CommitDetail render), `SmithyAccess.spec.js` (a confidential issue on its page by caller, with no screen rendered, and triage by role), `test/Forum/Forum.spec.js` (a Markdown post through Compose's publish), mr-boss `test/Projects/WorkItemDetail.spec.js` (an issue's task; a confidential issue's task hidden from the project's manager). Acceptance: `SmithyWalk` files an issue in the island (the toggle, the preview), edits its text and closes it, and has the issue pages in its 390 px list |

Differences from the design:

- NewIssue has a preview without JavaScript (the design has none there): the Preview button posts the form to
  `Do/previewPost`.
- The island is the text's editor only (the toggle and the preview). It has no mentions, uploads or drafts, and
  IssueDetail has no post stream island: the conversation is the server's pages.
- The island is not Forum's `Compose.qvue` with a Markdown mode but a component of its own, since it edits the text of
  a plain form that is posted to `Do`.
- An issue page is `no-store` for a visitor too; DG1's read pages are public for a minute.
- Assignees are chosen from `findAssignees`' handles (a text field of handles on NewIssue).
- A merge request linked to an issue is shown as text until DG4 builds its page.
- The forum's own topic page has no reply form without JavaScript, so nothing there takes Markdown; its composer does.
- A refusal of the gate for posting too soon or too often shows PASS's text for its kind ("Too many attempts…"), not the
  gate's own sentence.
- The Issues tab's count is one more `findIssues` call on each page of a group, and of a repository with issues on,
  for a signed-in account; a visitor's tab has no count.
- Forum composer: a post the Discourse import wrote has a Markdown revision whose source is the source site's raw text,
  and `getEditablePost` answers nothing that tells it from a post written in Markdown here. So such a post now opens
  in the composer's Markdown mode with that raw text, where before it opened as its cleaned HTML in rich text. Telling
  them apart needs a mark from Mantle (the import's map of posts).
- Forum composer: there is no compose form without JavaScript (`Shared/Compose.html.fancy` says so), so none sends a
  format. A browser recovery copy kept before the composer had Markdown is rich text: it is restored as rich text,
  as the post's own format when it is the post's unchanged text, and not kept when the post is Markdown now.
- A group's "New issue in" lists a hundred repositories by name, with a text filter for a group that has more.

Not built: attachments on an issue or a comment; a post's history page and bookmarks in Smithy; `markRead`; the linked
discussion (built in DG6); the group's issue repository in GroupSettings; a sort or filter by reaction; `SmithyAccessWalk` and
`SmithyPhone`.


## DG4: merge requests, forks, editing, the agreement

| Area | Implementation |
| --- | --- |
| Routes | `SmithyRoutes.js` routes a repository's `-/merge-requests`, `-/merge-requests/new`, `-/merge-requests/<n>` and its `/commits`, `/changes`, `/checks`, `-/fork` and `-/forks`, `-/edit/<refPath>`, `-/new/<refPath>`, `-/upload/<refPath>`, `-/delete/<refPath>`, the Agreement tab of a group's and a repository's Settings, and the islands `-/island/DiffReview.qvue` and `-/island/Editor.qvue` (`.qvt`, `.qjs`). The grammar had them; `compare/<base>...<fork-path>:<ref>` was DG1's |
| Pages | `screen/Smithy/SmithyReview.js` builds them as escaped markup with `SmithyForms.js`'s helpers and `SmithyIssues.js`'s conversation: `RepositoryDetail/MergeRequests`, `NewMergeRequest` (in the repository's shell), `MergeRequestDetail` (the shell, the merge request's head and its tabs) with `Overview`, `Commits`, `Changes` and `Checks`, `RepositoryDetail/Fork`, `RepositoryDetail/Edit`, and the Agreement tab. A repository with merge requests off has none of the merge request pages and no tab |
| MergeRequests | Open, Merged and Closed with the counts `findMergeRequests` answers, a GET form of filters (text, author, reviewer, target branch, drafts only), More by cursor. A row has the number, title, state, source (a fork's path before its branch, or "pushed for review") and target, the checks' state, approvals, the agreement's mark and comments |
| NewMergeRequest | A GET form of the target branch and the source (`group/repository:branch` for a fork's), then `getCompare`'s commits, file count and whether it merges cleanly, and the form: title (the oldest commit's summary), a Markdown text with a preview and the composer's island, draft, and reviewers for who may review. A fork's page points to its parent's form with the fork's branch as the source. Opened from Compare ("Open a merge request" when the head is ahead) and from a branch's row |
| Overview | `getMergeRequest`, then the conversation as on an issue (`getPosts` of its record topic; reply, edit, report, reactions, the watch level). The review form (Comment; Approve and Request changes by `canApprove`) is `submitReview`. Beside them: the title and Draft (`updateMergeRequest`), reviewers and their decisions (`setMergeRequestReviewers`), the checks of the head with links and "Required", the agreement box (Signed, or who is missing what, the file's Contributing section, Sign, Check again, a bot's operator), linked issues, the fetch line, and the merge box. Close is asked again on `?confirm=close`, Reopen is not |
| Merge box | For `canMerge`: the methods the branch rule allows, a message and "Delete the source branch" (a branch of this repository only), a GET form to `?confirm=merge`, which names the target branch, the method, what happens to the source branch and what is not ready, and posts `mergeMergeRequest` with the head it saw. For anyone else a sentence. Both list why a merge would be refused: a draft, conflicts (with the paths) and the authority's reasons (`missingList`: required checks not passed, approvals missing, the agreement not signed); the squash that would fold a signature is said under the method and refused by the authority on the post. Who may not merge reads the role the branch asks for (`branchRules.mergeRole`) |
| Changes | `getMergeRequestChanges` with diffs, rendered here: each file's diff as escaped lines (from the host's hunks, which are data; its own markup is not used), every line with its number, an anchor (`F<file>R<new line>` or `L<old line>`) and, for who may comment, the number as a link (`?line=`) that shows that line's comment form under it (`createReviewComment`). A thread is under its line with its posts cleaned, a reply form and Resolve or Reopen (`resolveReviewThread`); an outdated or resolved thread is folded (a `details`); an outdated one, and one whose line is not in the shown diff, is above its file's diff. A large diff shows a file's changes on `?path=`. The review form is here too |
| DiffReview island | `Islands/DiffReview.qvue`, with `/js/WebrootCode.js` in the page's scripts before `WebrootPublic.qvt.js`: a click on a line's number opens the comment form in place (an ordinary form, posted as the plain one), and "Side by side" shows a file in `m-diff-view` from its raw texts at the merge base and the head (`-/raw/<commit>/<path>`) |
| Fork | `-/fork`: namespace (the account's own, or a group of `findGroups` `mine`), path, name and visibility no wider than the parent; the page names the source and is the confirmation (`forkRepository`). `-/forks`: `findForks`, each with Compare. The shell has Fork for a signed-in account, the forks count and "Forked from"; Compare links a fork to its parent's comparison |
| Edit | `getEditContext`, then three views of one page, chosen by what the last step left in the session (the flash): the editor (the path, which renames when changed, and the text in a textarea; Preview for Markdown through `previewPost`), the save step (the commit message with a default by action, the destinations with the default first, the new branch's name, the merge request's title; the text and the blob it started from carried in the form), and the conflict of an edit (the file now beside the caller's text; keep editing, save over it, or discard). A new file at a path that has a file is told so on the save step; an upload to such a path says it replaces the file and names the blob that is there. A flash is the page's only when its repository, branch and path are the page's; the step reads `getEditContext` first, so it keeps nothing for who may not edit there, and refuses a text over the site's edit size without keeping it. Every textarea writes a newline after its tag, so a text's own first newline survives the HTML parser. `editFile` is the step between them: a transition of `Do` that is no operation and stores nothing but the flash. `commitFile` saves, and answers the file's page or the new merge request. Delete is the save step alone. Upload stages its file in the step (`stageAttachment` with the purpose `repositoryFile` and the repository) and names the attachment in the save; an empty path, or one ending in a slash, takes the file's own name. A file that is not editable says why in words (`getEditContext`'s `reason`) |
| Editor island | `Islands/Editor.qvue`: `m-code-editor` over the plain textarea, which stays the form's field, with the language of the path |
| Sign | The agreement box's Sign opens the edit page of the agreement's file with `?sign=<n>`: the page `getMergeRequest`'s `signPath` names for the caller: the source branch (a fork's too) for the author who may commit there, so the signature is a commit of the merge request, else the target branch, where the save of an account that may not push is a proposal (the author's own goes to the same merge request, another account's opens one). The box says what each author is missing in words, and where a bot's operator stands. The page shows how to sign when it is reached so or when `getEditContext` says `agreementFile`: the account's own line under both lists, with the handle shown and no legal name written |
| Settings | Agreement tab of `GroupDetail/Settings` and `RepositoryDetail/Settings` for an Owner (`getAgreement`, `setAgreement`): inherit, off or required, the file, what is in effect and from where, and how many branch rules change. Merge requests on or off was already General's (DG2) |
| Commit pages | CommitDetail shows "Contained in" (`getCommit.refList`), the merge requests of the commit when the read gives them, and the author's handle where `commit.authorHandle` is given (Commits, Compare and a merge request's Commits too). A merge request on an issue is a link |
| Forms | `Do.xml` has 15 more `post` transitions (60): `createMergeRequest`, `updateMergeRequest`, `setMergeRequestReviewers`, `submitReview`, `createReviewComment`, `resolveReviewThread`, `setMergeRequestState` (a close confirmed), `mergeMergeRequest` (confirmed), `forkRepository`, `editFile` (a step), `commitFile`, `setAgreement`, `recheckAgreement`, `declareBotOperator`, `confirmBotOperator` |
| Redirects | A page's redirect is answered in `pre-actions`, before the shell is written: Files' ref picker and a tree path that is a file (`RepositoryDetail/Files.xml`), and Compare's form (`Compare.xml`), as the group's New issue was in DG3. In `actions` the shell had been written already, so the redirect did not reach the browser |
| Caching | The merge request, edit and fork pages are `no-store` for a visitor too (`Shared/Headers.js`); the Merge requests tab has its count only for a signed-in account |
| Compare | DG1's Compare shows a comparison's diff again: the host gives it as hunks, not as unified text, and `Smithy.js` `changedFiles` writes the unified text from them |
| Markup | `SmithyForms.js` `h` knows the markup it built by a symbol (`Symbol.for`), not by its class: each page script loads its own copy of `SmithyForms.js`, so markup made in `SmithyIssues.js` was escaped as text when `SmithyReview.js` wrote it |
| Tests | `test/Smithy/SmithyReview.spec.js` (one render each of MergeRequests, Overview, Changes, Edit and its save step; a save through `Do` to the branch, to a new branch with a merge request, as a proposal, the conflict, and a staged upload), `Smithy.spec.js` (the DG4 paths, with a fork's head whose ref has a slash; the registries), `SmithyAccess.spec.js` (the DG4 rules). Acceptance: `test/acceptance/client/SmithyContribution.spec.js` with `test/acceptance/SmithyContributionFixtures.spec.js` (below) |

Differences from the design:

- A new line comment works without JavaScript (the design gives it to the island alone): a line's number links to the
  page with that line's form.
- The DiffReview island is not a second rendering of the diff on the model of Projects' `Changes.qvue`. It works on the
  server's diff: the comment form in place and one file side by side. It has no file tree and no pending review that is
  submitted at once (`submitReview`'s `commentList` is not sent); a line comment is posted when written. A phone has the
  same unified diff.
- Signing is the file's edit (§9.5) with instructions, not `signAgreement`: the account types its line. `signAgreement`
  has no form.
- The save is two pages without JavaScript and with it (the island is the editor only, not a dialog), and the text
  between them is kept in the session, as a preview is.
- A merge request's text is edited as its first post is (the conversation's Edit); `updateMergeRequest` here changes
  the title and Draft. The target branch is not changed on the page.
- Close is confirmed as a merge is; "delete the source branch" is part of the merge's confirmation, not a step of its
  own.
- Rename has no path of its own: it is Edit with the path changed.
- MergeRequestChecks shows the statuses alone until DG5 (no pipeline runs).
- The review form's summary is a plain Markdown textarea with no preview: a page has one composer island, and the
  comment form has it.

- `SmithyContribution` makes no `git push`, to a fork or to `refs/for/`: a client spec is a pure client with no git.
  What it shows instead: the fork's commits are saves on the fork's own pages (an edit, an upload and the signature,
  each `commitFile` to the branch, which is the framework's `commit#GitFiles`), and the merge request "pushed for
  review" is made by the fixtures through `commitFile` with the proposal destination (`commit#GitFiles` `asProposal`).
  A real push to a fork and to `refs/for/<branch>` is covered by the framework's git-client tests only
  (`crates/moqui-git`), not by anything in mr-pass. The outside accounts have a forum state past their first posts,
  so the post gate does not hold their merge requests; a held one's page is SmithyAccess's.
- What the walk does show, in a browser: fork on the page; an edit, an upload and Sign in the fork; the merge request
  from the fork; "Not signed" and then "Signed"; a line comment opened in place and a file side by side (DiffReview);
  a Maintainer's merge after the confirmation; the fixtures' merge request listed as pushed for review with its fetch
  line; a third account's edit in the code editor (Editor) saved as a proposal; and the redirects of Files and Compare
  over HTTP, with `no-store`. Its 390 px check covers, as that third account (a viewer with no role): the merge request
  list, one merge request's Overview, Commits, Changes and Checks, the new merge request form, Fork, Forks, and the
  Edit, New file, Upload and Delete pages. It does not cover the settings' Agreement tab, the merge and close
  confirmations, or any page as a Maintainer at that width.

Not built: `signAgreement`'s form; the forum's post stream island on Overview; thread excerpts in the conversation; the
file tree (`m-file-tree`) on Changes; attachments; a group's merge request list; `SmithyAccessWalk` and `SmithyPhone`
as specs of their own (`SmithyContribution` checks this phase's pages at 390 px).

## DG5: pipelines

| Area | Implementation |
| --- | --- |
| Routes | `SmithyRoutes.js` routes a repository's `-/pipelines`, `-/pipelines/<n>`, `-/pipelines/<n>/jobs/<jobRunId>`, `-/pipelines/<n>/jobs/<jobRunId>/log` (added: the log's JSON), `-/artifacts/<artifactId>/<name>`, the Pipelines tab of a group's and a repository's Settings, and the island `-/island/JobLog.qvue` (`.qvt`, `.qjs`). The rest of the grammar was DG1's |
| Pages | `screen/Smithy/SmithyPipelines.js` builds them as escaped markup with `SmithyForms.js`'s helpers: `RepositoryDetail/Pipelines` and `PipelineDetail` (in the repository's shell, read in `pre-actions`, so a run the caller may not read is the framework's Not Found before the shell is written), and the settings tabs. The repository's shell has the Pipelines tab where pipelines are on; with them off every pipeline page is Not Found |
| Pipelines | `findPipelineRuns`: each run with its number and pipeline, state, an Outside run chip, the event, the branch or merge request, the commit, who asked, the day, the duration, the jobs and failed tests, and the run's message; a GET form of filters (branch, event, state), More by cursor. Run pipeline (`canRun`) is a form of the manual pipelines the read names (`pipelineList`) and a branch or tag, or a sentence when the default branch's `ci.xml` has none |
| PipelineDetail | `getPipelineRun`: the header (state, event, ref or merge request, commit, who, times, trusted or an outside run, the built-in pipeline, the message), the waiting banner with Approve and run (`canApprove`; a sentence for anyone else), Cancel (`canCancel`, asked again on `?confirm=cancel`), Run again (`canRerun`, `rerunPipelineRun`), and the jobs in stages (a job with no `needs` in the first, any other one stage after the latest it needs). With a job (`getJobRun`): the run's jobs as a row of chips (one scrolling row on a phone), the job's facts and Retry (`canRetry`, an ended job; the answer is the new attempt's page), its steps, its log, its failed tests (suite, name, the file and line linked to Blob at the run's commit for a relative path, the time, the message) and its artifacts and reports (a download each, with size, checksum and expiry) |
| Log | `getJobLog`, a page at a time: while the job runs the chunks after `?after=` (500 at most), once it has ended the stored log from `?offset=`, cut at its last whole line; `?line=` numbers the page's first line. Each line has its number and anchor (`#L10`), is escaped, and has its terminal escapes and other control characters taken out (of a line a carriage return rewrote, its last text). Load more links the next page; a running job's page has Refresh |
| JobLog island | `Islands/JobLog.qvue` on a running job's page: reads `…/jobs/<id>/log` (the `log` transition of `PipelineDetail`: the next lines as JSON, `getJobLog` with `watch` for a signed-in reader) every `pollSeconds` (2), every 15 s while the notification socket is open, and at once on a message of topic `GitCiJobLog` with the job's id as its sub-topic; appends each line as text (DOM text nodes, never markup), updates the job's state chip, hides Refresh and Load more, and stops when the job has ended. The socket is `moqui.NotificationClient` on `/notws` for a signed-in reader only |
| Artifacts | The `artifact` transition of `PipelineDetail` (`downloadArtifact`), streamed by `Facade.js` `downloadFile` as an attachment named by the authority, `nosniff`, `no-store`. A visitor who may view the repository downloads too (the operation's need is any) |
| Checks | A merge request's Checks tab and the Overview's box: a `ci/` check links to its run on this site (`checkList[].path`) or else to its https target, a required context with no status reads "expected", `ciFileChanged` is said ("a Maintainer merges it"), and `missingList` as before; the Overview's box lists the head's runs (`runList`); the Checks tab reads each run again (`getPipelineRun`, ten at most) for its jobs, the failed tests of up to five failed jobs (`getJobRun`), and Approve and run where `canApprove` |
| Commit | CommitDetail lists the commit's runs (`findPipelineRuns` by `commitId`, where pipelines are on), and a `ci/<pipeline>/<job>` status links to its pipeline's newest run on this site in place of the address the engine wrote |
| Settings | Repository › Pipelines (a Maintainer's tab): Runners (`getPipelineSettings`: the month's runner minutes of the owner, the allowed pools with their trust and whose they are, the pools chosen and when outside runs wait; the form for the group's Owner, `canStore`, else read only with who changes them), Secrets (`findCiSecrets`: name, scope, environment, added, last used; Add; Replace the value with the scope; Delete asked again on `?delete=<secretId>`) and Environments (`findCiEnvironments`: name, branches allowed, approval required; Add, Edit, Delete asked again on `?deleteEnvironment=<id>`). A secret's value is a password field, never written back, and `value` is in `SmithyForms.js` `SECRET`, so a refusal keeps nothing of it for the next page. Group › Pipelines (an Owner's): the Runners form (`storePipelineSettings`). SiteSettings has "When an outside run waits" (`storeSmithySettings` `outsideRunApproval`) |
| Forms | `Do.xml` has 10 more `post` transitions (80): `runPipeline` and `rerunPipelineRun` (to the run's page; the notice says a run the check refused, its message without the code, or one that waits), `cancelPipelineRun` (confirmed), `retryJobRun`, `approvePipelineRun`, `storeCiSecret`, `deleteCiSecret` (confirmed), `storeCiEnvironment` (the branches allowed sent only when changed), `deleteCiEnvironment` (confirmed), `storePipelineSettings` |
| Caching | `Shared/Headers.js`: `-/pipelines…` and `-/artifacts/…` are `no-store` for a visitor too (a log holds whatever a job printed, and a merge request's run is hidden with it) |
| Registries | `SmithySchema.js` and `Routes.js` are copies of Mantle's with the 18 DG5 operations (113 Smithy operations), compared with `cmp`; `Shared/Portal.js` reasons unchanged |
| Tests | `test/Smithy/SmithyReview.spec.js` (one render of a running job's page as the run's Owner: the log escaped with its escapes and a progress bar's earlier text out, a failed test linked to its line at the run's commit, an artifact's link, the waiting banner with Approve and run, the step escaped, the chips, the island, the tab; the run's page as a viewer through `runPage`: no Approve, no Cancel, the jobs in two stages; Run pipeline through `Do` refused with `quotaExceeded` and the refusal on the form, read through `pipelines`). The run and its jobs are rows the feature makes (a spec cannot play the runner); it takes 0.09 s. `Smithy.spec.js` (the DG5 paths, the routes through the resolver, the cache policy, Do's 80 posts, the registries), `SmithyAccess.spec.js` (a Maintainer's settings tabs with Pipelines) |

Differences from the design:

- The grammar has `-/pipelines/<n>/jobs/<jobRunId>/log`, the log's JSON for the island (a transition of `PipelineDetail`, as `artifact` is).
- The log is read by chunk while a job runs and by byte offset once it has ended (Mantle's `getJobLog` gives both); a page
  is 500 chunks or 256 KB, and its lines are numbered from the page's first (`?line=`), not from the log's start, when
  reached by Load more.
- The island polls as the design says and reads at once on a notification; it opens the socket at `/notws` itself (the
  public island's config has no notification endpoint). On a host that refuses `/notws`, or for a visitor, it only polls.
- Run again (`rerunPipelineRun`) is on the run's page; the design's catalog has no re-run. Retry is offered for any ended
  job.
- Cancel and the deletes of a secret and of an environment are asked again on a page of their own; Approve is not.
- A repository's Pipelines tab is one page (Runners, Secrets, Environments). Its runners are the group's: a Maintainer
  reads them and the group's Owner saves them there or on the group's tab. A personal repository's are read only.
- `getPipelineSettings` gives the pool and the approval in effect and the group they come from, not the group's own value:
  the form shows the value in effect, so a save on a subgroup stores an inherited pool as its own.
- A ci/ status on CommitDetail and the checks links to its run on this site, not to the engine's address on the canonical
  host.
- The Checks tab reads each run again for its jobs and failed tests: up to ten `getPipelineRun` and five `getJobRun` calls.
- With pipelines off the pipeline pages are Not Found, runs from before included.

Findings for other lanes:

- Framework: `org.moqui.git.GitCiServices.find#CiEnvironments` (`crates/moqui-git/src/ci/service.rs`) does not return
  `allowedRefs`, so Mantle's `findCiEnvironments` answers it empty and the page shows "Protected branches only". The edit
  form sends the field only when it was changed, so a save does not clear it.

Not built: the acceptance walk `SmithyPipeline` (design §19.3: a push runs on the fake host type, the log and a failed
test on the run's page, a red run blocking the merge); the 390 px check of these pages in a browser (they reuse the
shell's scrolling tabs and code blocks; `SmithyWalk` was not extended); the Commits list's checks per commit; the
built-in pipeline named on Pipelines for a component with no `ci.xml` before it has run; a group's list of runs (DG10's deploy
environments are built: see DG10 below).

## DG6: the forum inside Smithy, the lists, moderation in a scope

| Area | Implementation |
| --- | --- |
| Scope and link base | `Shared/View.js` `load` takes a **scope** (`{contactListId, base, moderationBase, enabled, canModerate, name}`; null on the site's own forum) after the identity. With a scope, links are built from `scope.base` where they were built from `bases.forum` (a topic, a post, a tag, a category, a draft, a post's history) and a review's from `scope.moderationBase`, and the reads that take one are given `scopeContactListId` (`findTopics`, `findCategories`, `searchForum`, `findTags`, `getTopic`, `findReviews`, `findActions`; `inputFor` sends it to the operations whose schema has it). A category asked for inside a scope must be in its subtree (`requireInScope`, by `findCategories` with the scope), and a topic of another category is Not Found there (`getTopic` with the scope). `Page.html.fancy` and `TopicEnhance.html.fancy` take the link base from the screen's `forumScope` (the enhanced stream's `forumBase` too), `Post.xml` and `TopicDetail.xml` redirect within it, Compose's `state` offers the scope's categories with the scope's own chosen for a new topic, and the feed is the scope's (`getFeed` with the scope). `Pass.xml` sets `forumScope` to null for every request; the shell that mounts the forum sets it |
| The forum in a shell | `GroupDetail.xml` and `RepositoryDetail.xml` mount the forum's own root screen (`Forum.xml`) as their `Forum` subscreen, so `/<group>/-/forum[/…]` and `/<group>/<repo>/-/forum[/…]` are the forum's own screens (Topics, a topic with its enhanced stream and its forms, Categories, a category, Tags, Search, Compose with its island, a post's permalink, a post's history, the feed), with every transition at its own place, inside the group's or the repository's shell with the Forum tab. `Forum.xml` shows the forum's navigation for the scope (Topics, Categories, Tags, Search, New topic, Moderation, RSS). The page's title is an `h2` there, under the shell's `h1`. A group or a repository whose forum is off has no Forum tab and its forum pages are Not Found. `/forum` is unchanged |
| Routes | `SmithyRoutes.js` `forumSection` maps the rest of the path after `-/forum` as the forum's own resolver maps a path after its mount: `t/<id>/<slug>[.qvue][/<transition>]` (with `topicId` and `topicSlug` as the resolver's own outputs), `p/<id>` (`postId`), `feed`, and a screen of the forum that has a scope (Topics, Topics/List, Topics/TopicDetail, Topics/PostHistory, Categories, Categories/List, Categories/CategoryDetail, Tags, Search, Compose), then at most a transition's name. The forum's other screens (Messages, Drafts, Bookmarks, Guidelines, Settings, Moderation, Reports) stay the site's and are Not Found under a scope. `moderationSection` maps `-/moderation[/ReviewQueue|ReviewDetail|MemberDetail|Log[/<transition>]]`, `-/moderation/report` and `-/moderation/hide`. `-/held-report/<token>` is `Smithy/Do/heldReport`. The Forum tab of a group's and a repository's Settings is routed. `pass.RouteServices.resolve#Route` also routes the forum's `held-mail/<token>[/claim]` |
| Canonical | A topic read inside a scope has the site forum's address as its one canonical (`<link rel="canonical">` to `/forum/t/<id>/<slug>`) where the site mounts the forum; the scoped page is not redirected there, and a wrong slug redirects within the scope. On a site with no forum mount the canonical is the scope's own address |
| Shells | `Smithy.js` `scopesOf`: `forumScope` (the read's `forum.contactListId` and `enabled`) and `moderationScope` (`forum.moderationContactListId`, for the scope's Owners and the site's staff; a repository with no category of its own has its group's). Tabs: Forum when it is on; Moderation for who has the moderation scope. A hidden group or repository has a Hidden chip and a sentence for those who still see it (everyone else gets Mantle's Not Found). A signed-in account has "Report this group/repository", and who may hide (`capabilities.canHide`) "Hide it" or "Show it again" beside it |
| Settings: Forum | The `forum` tab of `GroupDetail/Settings` and `RepositoryDetail/Settings` for an Owner (`SmithyScope.js` `forumSettings`): the forum on or off (`setScopeForum`; a repository's makes its subcategory), linking an existing category by its id, and the sentence that the category's readers follow the group's or the repository's visibility. Once on: the mailing list (below). For a group: the address for security reports (`storeIssueMailRoute`: the address, the repository that takes the reports, on or off for the site's staff; the present route from `getGroup`'s `forum.issueMailRoute`) |
| Mailing lists | On the Forum tab of a scope whose forum is on. For an owner of the site: the category's mode (`storeCategory` `mode`: discussion, questions, list) and the list's address (`findRoutes`, `storeRoute` with the category); a scope's Owner who is no owner of the site reads which it is. For a list: **Import an archive** (`importMbox` by the name and SHA-256 of an mbox file in the server's import directory; the start leads to `?importId=`, which shows the run's stage and its report from `getMboxImport`: messages, topics, replies, already there, attachments left out, unknown character set, too long, empty, unreadable, failed; starting the same file again resumes it) and **Invite the list's members** (`inviteListMembers` with addresses pasted, up to 500; the answer's counts are the notice). The held-message sentence names the review queue |
| Invitation and held mail | A list invitation's link is `Account/Invitation` (Mantle's `redeemInvitation` subscribes the account to the list); for a visitor the page now says to sign in with the invited address, or to register with it, and accept. `Forum/HeldMail` (`<forum>/held-mail/<token>`) is the page of a held list message's link: a visitor is asked to sign in or register and come back, an account posts the message with a form (`claim`, `claimHeldMail`), and a used or expired link says so |
| Moderation in a scope | `Smithy/Moderation.xml` mounts the forum's own `ReviewQueue`, `ReviewDetail`, `MemberDetail` and `Log` screens, in the group's or the repository's shell, with the moderation scope and its link base, for who has the scope (`SmithyScope.js` `moderation`); anyone else gets Not Found. `View.js` gives the review queue and the log the scope, or one category of it (`?contactListId=`, checked to be in the scope). A review of a reported repository or group shows where it is and what each decision does (`getReview`'s `target`; rejected hides it); a held message's review shows who sent it, its subject and until when it waits (`held`), with its text in the item's detail |
| Report and Hide | `Smithy/Moderation/Report` (`-/moderation/report`): a confirmed account reports the group or the repository with a reason and a note (`reportSmithyTarget`), and returns to its page. `Smithy/Moderation/Hide` (`-/moderation/hide`): the confirmation of Hide and of showing again, which names the target and what follows and takes a reason (`hideSmithyTarget`, refused by its transition without that page's answer); Not Found for who may not hide. Linked from the shell, a repository's Archive tab and a group's Delete tab |
| Held report | `-/held-report/<token>` is the GET transition `heldReport` of `Smithy/Do`: a whole page in the site's shell (the shared header and footer templates), `no-store`, that writes nothing. A visitor gets Sign in (and Register where registration is open) with the link as the return address; an account gets a form that posts `claimHeldReport` with the session token and goes to the confidential issue; a refused claim returns to the page, which says a link is used or gone |
| A topic made an issue | A topic shown in a scope has "Make an issue" for a role that may triage (`SmithyScope.js` `topicTools`, a section of `Forum/Topics/TopicDetail.xml` shown in a scope alone): the repository (the scope's, or the group's repositories with issues on), the title, the posts to quote, Confidential; `convertTopicToIssue` goes to the new issue. The topic's Related card shows the issue as a link (`getTopicLinks`' `path`), and the issue's page a Discussion card (`issue.discussion`) |
| Link cards | A topic's Related lists an issue, a merge request and a release with its page's link where the read gives one. A merge request's Overview has the Discussion card when `getMergeRequest` gives a `discussion`. Releases have no page yet (DG7) |
| Forms | `Do.xml` has 10 more `post` transitions (70): `setScopeForum`, `reportSmithyTarget`, `hideSmithyTarget` (confirmed), `convertTopicToIssue`, `storeIssueMailRoute`, `claimHeldReport`, and the forum's `storeCategory`, `storeRoute`, `importMbox` and `inviteListMembers`; and the one GET, `heldReport`. A form's `done` is given the operation's input |
| Caching | `Shared/Headers.js`: the forum's pages inside a shell and the scope's moderation pages are `no-store` for a visitor too, as the forum's own are |
| Not Found | A group's and a repository's Settings, Report and Hide build their page in `pre-actions`, and Moderation checks its caller in `always-actions`: who may not see one gets the framework's Not Found (404) before any of the shell is written. Until now a Settings page refused in `actions`, after the shell, and the answer was an error page with the shell's start |
| Registries | `SmithySchema.js` and `Routes.js` are copies of Mantle's with the 6 DG6 operations (95 Smithy operations), `Schema.js` of `ForumSchema.js` with `scopeContactListId` and the four list operations |
| Tests | `test/Smithy/Smithy.spec.js` (the DG6 paths; one render of the forum's topic list inside a group's shell; a held report's page, a refused claim and the sender's claim through `Do`; Report and Hide through `Do`; a topic made an issue through `Do` and the issue's Discussion card; the registries and the cache policy), `SmithyAccess.spec.js` (moderation in a scope is its Owners': the page's own rule and the queue's read, with no screen rendered). Acceptance: `SmithyWalk` has a second feature (below) |

Differences from the design:

- The forum's screens are mounted under the shells, so a scoped page's screen path is
  `/Smithy/GroupDetail/Forum/<the forum's own screen path>` (the design has one screen `Smithy/GroupDetail/Forum` with
  `forumPath`); `forumPath` is still a screen parameter. `Smithy/Moderation` is likewise the shell with the forum's
  moderation screens under it.
- `-/moderation/report` and `-/moderation/hide` are added to the grammar (the design names no path for Report's form and
  Hide's confirmation). Report and Hide are links under the shell's tabs, not an overflow menu. Hide is not a control of
  ReviewDetail itself: the decision "rejected" hides, as Mantle's `decideReview` does it, and the page says so.
- A group's tabs have Moderation (the design has it under no tab), for who moderates the scope; a repository's too.
- `heldReport` is a GET that shows a page and writes nothing; the claim is the page's form (the design's link "files the
  report"). So a mail scanner that follows the link files nothing, and the claim has the session token.
- The archive is not uploaded on the page: as the Discourse import does, the operator puts the file in
  `pass@import-dir` and the page names it with its checksum (Mantle's `importMbox`). Resume is starting the same file
  again; there is no list of a category's past runs (Mantle has no read of them), so a run is reached by its start's
  redirect or its `?importId=` address.
- Invitations: addresses are pasted, 500 at a time, with no file upload; there are no standing counts of invited and
  confirmed and no "send again" (Mantle's `inviteListMembers` answers the counts of one call and skips an address with
  an open invitation; an invitation lasts 14 days, after which the same address is invited again).
- The invitation is not one click for a new person: the link leads to `Account/Invitation`, where the person signs in
  or registers with the invited address and accepts.
- A list's mode and address are set by an owner of the site (Mantle's `storeCategory` and `storeRoute`), not by a
  scope's Owner who is only that; the import and the invitations are the scope Owner's.
- One canonical a topic only where the site mounts the forum. With no `/forum` mount a topic of a repository's
  subcategory is read at the repository's and at its group's forum address, each its own canonical: Mantle does not
  say which scope is a topic's nearest.
- The scope's forum has no page for Messages, Drafts, Bookmarks and Guidelines; those are the site forum's, and are
  reached only where the site mounts it.

Acceptance: `SmithyWalk`'s second feature, at 390 px on `SmithyWalkFixtures`' group with its forum on: the group's
forum and a topic are read (the enhanced stream takes the server's posts' place, its links the scope's, its canonical
the site forum's, no sideways scroll); an account with a confirmed address and no role writes a topic in the scope's
composer, which has the group's category chosen and no other, and lands on the scope's topic page; it opens the report
form from the repository's page; and it gets Not Found for the scope's moderation and the Forum tab of the settings.
The report's post is the server spec's: an account's posts are ten seconds apart, and a walk does not wait.

Not built: a render of the scope's moderation pages and of the settings' Forum tab in a spec (checked by hand in a
scratch spec, which is not kept); the phone width of the moderation, Report, Hide and settings pages; a group's or a
repository's forum on a remote PASS frontend (D1: Smithy runs where the git data is); `SmithyAccessWalk` and
`SmithyPhone` as specs of their own.

### DG6 review fixes

Matching Mantle's fixes of its DG6 review:

- `Shared/Portal.js` has the reason `repositoryHidden` (a hidden repository is not forked: "This repository is hidden."),
  last as in Mantle's `PassAuthority.js`; ShopAccess's parity check covers it.
- Mail counts as authenticated by the gateway only in an `Authentication-Results` field whose authserv-id is in
  `smtp-server@authserv-id`: `InboundMail.spec.js` sets it to its fixture mail's `gw.example.test`. No other spec posts by mail.
- A held list message's link is in the forum its list is read in: `SmithyRoutes.js` `forumSection` maps
  `held-mail/<token>[/claim]` under a scope's `/-/forum` to the forum's own `HeldMail` (mounted under the shell with the
  rest of the forum), and `<forum mount>/held-mail/<token>` stays. After a claim `HeldMail` goes to the topic in the
  scope's base, or the forum mount's; its title is an `h2` inside a shell.
- Scoped results: a scope's `MemberDetail` asks `getMember` with the scope's category (or a category of its subtree,
  checked); for a caller who moderates only as a scope's Owner it shows the posts there and the moderation there
  (`scopeActivity`), no site-wide membership or trust, and no trust form (a sanction's form has the category). A
  review's reports are listed (`Page.html.fancy`, "Reports"); a report whose reporter is withheld reads "by a member",
  else it links the reporter's member page. The reported group or repository is shown on a review in the site's queue
  too (`reviewTarget`), and linked, with "Show it again", only when the caller may open it (`resolveSmithyPath`): the
  site's staff decide reports on what they may not view. `inviteListMembers`' notice says how many were not sent for
  the day's limit (`limitedCount`). The Forum tab's "Link an existing category" is shown to the site's owners and
  operators alone (`canManageSite`), and its hint says a category that would open to more readers is refused.
  `convertTopicToIssue`'s refusal of a topic read by fewer than the repository's issues shows its own text in the form.
- `Smithy.spec.js` renders `Smithy/Do/heldReport` once (signed in); the visitor's content is checked through
  `SmithyScope.js` `heldReportBody`, the page's content without the site's shell. The grammar test has the scoped
  `held-mail` paths.
- `docs/Deployment.md`: Smithy's `git-ci` `run-check-service` (`mantle.smithy.SmithyServices.check#PipelineRun`, named
  by Mantle's `MoquiConf.xml`: a hidden repository runs no CI), `smtp-server@authserv-id` on the authority for any mail to
  count, a list's links in its group's or repository's forum with no `/forum` mount, linking a category being the
  site's owners', and the invitations' day limit.
- The registries (`Schema.js`, `SmithySchema.js`, `Routes.js`) are unchanged copies of Mantle's (compared with `cmp`).

### DG5 review fixes

From the review of the DG5 pages (81b9b21), matching Mantle's fixes of its DG5 review:

- **Log bounds.** A page of a running job's log, and each read of the log's JSON, holds the chunks up to about 256 KB
  (the first always; `SmithyPipelines.js` `LOG_PAGE_BYTES`), and its `after` is the last chunk it holds; an ended log's
  page is cut at its last whole line within it. The island (`Islands/JobLog.qvue`) waits `pollSeconds` before the next
  read when a read says there is more, as it does otherwise. Load more on a running job carries `offset` as well as
  `after`.
- **Runners form.** The Pipelines tab's form holds the group's own values (`getPipelineSettings` `own`, empty where it
  follows the group above), each with the value in effect and where it comes from as its hint (`inheritedFrom`), "As the
  group above says" as the empty choice, and "never" only where `canSetNever` (the top-level group's Owner); `storePipelineSettings` sends only a changed field (`changed`, by `was_<name>`),
  and an emptied one gives up the group's own value.
- **Pipelines off.** The `log` and `artifact` transitions read the repository first and are Not Found where pipelines are
  off, as the pages are.
- **A failed test's link.** `testPath` refuses a path with a `.` or `..` segment, an empty one, a backslash or a control
  character (after a leading `./`), so a report's path cannot lead anywhere else on the site.
- **Control characters.** A log's lines, a test's suite, name, file and message, a step's name and command, and a run's and
  a job's message lose C0 (but tab and newline), DEL, C1 (U+0080 to U+009F) and the bidirectional overrides and isolates
  (U+202A to U+202E, U+2066 to U+2069), with terminal escapes (`plain`).
- **The notification socket.** The island's socket path is the `pass@notification-endpoint` property (`/notws` when it is
  not set; empty: no socket, the island polls), passed in its configuration; a socket that closes before it ever opened
  (a host that refuses it) is given up, and `stop()` closes the client (its listeners off, no reopening).
- **Cost.** The merge request's Checks tab reads a run again (`getPipelineRun`) for at most three runs of its list (one that
  waits for approval first, then one that failed) and a job's failed tests (`getJobRun`) for at most two; the other rows
  are what `runList` gives. CommitDetail links a `ci/<pipeline>/<job>` status to the run and job its target names (the
  engine writes the run's page), on this site, not to the newest run of the pipeline; it makes no run read beyond
  `findPipelineRuns`.
- **Artifacts sent by the authority.** `Facade.js` `downloadFile` writes nothing when the operation answers `sent` (Mantle's
  `downloadArtifact` now sends the file as the response itself, `send#RunArtifact`), so the name in its
  `Content-Disposition` is the engine's.
- **Tests.** `SmithyReview.spec.js` has a feature by page function and transition render: the log's JSON is `no-store`,
  Not Found for a job that is not the run's and with pipelines off, and an upload is Not Found with pipelines off; Cancel
  is not run without `confirm=yes`; a refused secret's save keeps its name and not its value for the form; the group's
  runners form holds its own values with `was_` fields and the value in effect. The artifact's `Content-Disposition` is
  not checked here: the engine sends it and needs the artifact's content, which a spec's rows do not have (Mantle's and
  the framework's specs).

## DG7: the site

| Area | Implementation |
| --- | --- |
| Routes | `SmithyRoutes.js` routes `search` (at `-/search`: the framework's `/search` proxy takes `/search`), a repository's `-/docs[/<refPath>]`, `-/releases`, `-/releases/<tag>` (the tag every remaining segment), `-/release-assets/<assetId>/<name>` (the `asset` transition of `ReleaseDetail`), a group's `-/addons.xml` (the `addons` transition of `GroupDetail`) and the Redirects tab of the site's settings (`-/site/redirects`). The grammar had them |
| Redirects | `pass.RouteServices.resolve#Route` catches a Not Found (no mount, a Smithy path that names nothing, a page not built) and asks `Smithy.js` `movedPath`, which calls Mantle's `resolve#Redirect` (not an operation) with the site, the request's host and its path, and keeps a target that is a path on this site or an https address of one of the site's own hosts (`getSiteInfo` with that host answers only for one); the answer is `/Smithy/redirect` with the location, a 301 with the request's query. Not on a remote frontend (`pass@backend-url`), which has no Mantle |
| Pages | `screen/Smithy/SmithySite.js` builds them as escaped markup with `SmithyForms.js`'s helpers: `Search`, `RepositoryDetail/Docs` (read in `pre-actions`), `RepositoryDetail/Releases`, `ReleaseDetail` (in the repository's shell, read in `pre-actions`), the `asset` and `addons` transitions, the Landing section of a group's General settings and the Redirects tab. `Smithy.js` builds the Overview (with the landing) and Explore (with components) |
| Overview | `getGroupLanding`: the landing text, its relative links made pages of its repository at the branch it was read at (`rewriteLinks` with `sourceRef` and the file's directory), Source and, for a signed-in account, Edit this page (`editPath`); without it the description. Beside it (one column on a phone): the latest release, news and activity, each linked by the path the read gives; pinned repositories (`pinnedList`) and subgroups below. Home shows the home group's |
| Explore | Components (`findComponents`): name, version, depends-on, the repository and its latest release; the kind filter has Components, and Everything shows the three lists |
| Search | `/-/search?q=&kind=&in=`: one box; the kinds (`searchSite` `types`) as a select; `in` a group's or repository's path (`resolveSmithyPath`) narrows it. Several kinds: a section a kind with at most ten results and "More <kind>" (the same search of that kind); one kind: twenty a page with More results by cursor. A result is its title linked by its path, its place and day, and its snippet. A query under two characters shows the refusal. The header has the search box |
| Docs | `getDocsPage`: the page (cleaned by the authority) with its links rewritten (`rewriteLinks` with `docs`: a Markdown file inside the docs directory is its Docs page at the ref with its anchor, any other file of the repository its Blob page, an image raw, a path leaving the repository no address); the ref picker (branches and tags of `refList`, a GET form redirected in `pre-actions` to the directory's index at that ref); the contents (`tocList`, beside the page, a closed `details` above it under 40 rem); On this page (the h2 and h3 anchors); Edit this page (a branch, a signed-in account); Source; a docs search box (`-/search` with `kind=docs` and `in`). Not Found where docs are off. The repository's shell has the Docs tab where docs are on |
| Releases | `findReleases` (twenty, by cursor): each release's name, Draft or Published, tag, day, commit, notes (links made the repository's pages at the tag) and files. For a Maintainer (`capabilities.canMerge`: a confirmed Maintainer of a repository not archived) New release: a tag of `findRefs` that has no release on the page, the name, the notes (the composer's island and Preview), Publish it now, Announce (`storeRelease` with `operationId`; the answer is the release's page). The shell has the Releases tab always |
| ReleaseDetail | `getRelease`: the head (name, state, tag, day, commit, Files at this tag, the announcement, linked to the forum's topic where the site mounts the forum), the notes, the files (a download, size, SHA-256; an image's name), the source archives (`archiveList`) and the component. For `canEdit`: Publish or Make it a draft, asked on `?confirm=publish` or `?confirm=unpublish` (Announce offered with Publish), Withdraw on `?confirm=delete` (to the list), Remove a file on `?removeAsset=<id>`, Announce for a published release not yet announced, Name and notes (the composer; the notes sent only when written), Attach a file (multipart; `run` stages it with `stageAttachment` purpose `repositoryFile` and sends its `attachmentId`), a file of the tag's latest successful pipeline run (on `?attach=artifact`: `findPipelineRuns` of `refs/tags/<tag>`, `getPipelineRun`, `getJobRun` of at most three jobs) and a container image's name |
| Downloads | `ReleaseDetail/asset`: `downloadReleaseAsset` streamed by `Facade.js` `downloadFile` as an attachment named by the authority, `nosniff`, `no-store`; a file backed by a run's artifact the authority sends itself (`sent`, as `downloadArtifact`). The archive transition (`-/archive/…`) now serves a public, unhidden repository's archive to a visitor too, as Mantle allows (addons.xml's archive locations), and the Files and Tags pages link it for a visitor of such a repository |
| Site settings: pipelines | `storeSmithySettings` takes `outsideRunMaxJobs`: "Most jobs of an outside run" on `/-/site`, sent only when changed |
| addons.xml | `GroupDetail/addons`: `getAddons`' text as it is, `text/xml; charset=utf-8`, `nosniff`; `public, max-age=300` with `Vary: Cookie` for a visitor of a public group that is not hidden, else `no-store` |
| Landing settings | The General tab of a group's Settings (its Owner's) has Landing page: the repository and the file (what `getGroupLanding` read, sent together only when one was changed), the news category's id (sent when typed) and No news category (sends it empty): `setGroupLanding` |
| Site settings | The Redirects tab (`-/site/redirects`, the site's owners and operators): the table (`findRedirects`, a search and a source filter, fifty a page by cursor), Add (`storeRedirect`: old address, old host, target, note), Delete asked on `?delete=<id>` (the row read again by `findRedirects`), Import (`importRedirects`: CSV pasted, the source; the notice counts new and changed and names the first five lines not taken) |
| Forms | `Do.xml` has 8 more `post` transitions (88): `setGroupLanding`, `storeRelease` (a change of `published` on an existing release confirmed), `deleteRelease` (confirmed), `addReleaseAsset` (an upload staged first: `upload`), `removeReleaseAsset` (confirmed), `storeRedirect`, `deleteRedirect` (confirmed), `importRedirects`. `run` takes a form whose fields are not the operation's one to one (`adjust`: the composer's `body` is `notes`; the landing's fields sent only when changed) |
| Caching | `Shared/Headers.js`: `-/search` and `-/release-assets/…` are `no-store` for a visitor too; Docs, Releases and a release are read pages (public for a minute to a visitor) |
| Registries | `SmithySchema.js` and `Routes.js` are copies of Mantle's with the 17 DG7 operations (130 Smithy operations), compared with `cmp` |
| Tests | `test/Smithy/Smithy.spec.js`: the DG7 paths in the grammar; a visitor's archive of a public repository (the archive feature, changed); an old path of the site's table through the resolver (one route) and one that is not in it; one render of a Docs page (a link to a page of the directory and its anchor, one to a file outside it, the authority's cleaning kept, a heading's anchor, the contents, the ref picker with the tag, Edit, the docs search, the tab); one render of ReleaseDetail as the group's Owner (the notes cleaned, a file with its size and SHA-256 and its download, an image's name, the source archive, the Maintainer's forms) and the same page by its function as a confirmed account with no role (the files, none of the forms); one render of a group's `addons.xml` (text/xml, `no-store` for a signed-in account, the operation's text); Do's 88 posts; the registries and the cache policy. `SmithyAccess.spec.js`: the repository's tabs with Releases. The release and its image are made through the operations, its file as a row (no file is read) |

Differences from the design:

- The Search page's place is `?in=<path>` (the design's "scope"), and the kinds are one select, not several filters.
- Docs search is the Search page with `kind=docs` and the repository, not a box of its own results.
- The ref picker goes to the directory's index at the chosen ref, not to the same page there (which may not be).
- A release's notes are rendered by the authority and shown; the edit form holds the notes' source, which `getRelease`
  gives a Maintainer (`notes`, since the review); what is written replaces them, an empty field keeps them.
- Publishing and making a draft again are asked on a page of their own (the design says nothing of it); Announce is
  offered there and on a published release.
- A release's file download is `no-store` for a public repository too (the facade's rule; a release may be withdrawn).
- The news category is named by its id on the Landing section; its present value is not shown (no read answers it).
- Redirects: a CSV is pasted, not uploaded; there is no edit of a redirect on the page (delete and add again, or import:
  an old address the table has takes the new target).
- Pinned repositories are what the read gives; pinning a repository has no page yet.

Findings for other lanes:

- Mantle: `getGroup` or `getGroupLanding` does not answer the group's `newsContactListId` (nor its landing file when the
  file is gone), so the Landing form cannot show them. (The notes' source and a field refusal of a name with `<` or `>`
  are Mantle's since its review.)

Not built: the acceptance walks of the site (the old links of the inventory landing where they should; `component-get`
from the staging host); the 390 px check of these pages in a browser (the Docs contents drawer and the Overview's one
column are CSS, not checked in a browser); an edit of a redirect; a group's Releases page (`findReleases` by `groupId`); a
docs page cached by PASS (Mantle caches the rendering by blob id).

### DG7 review fixes

From the review of the DG7 pages (760173c), matching Mantle's fixes of its review:

- **Archives.** Files links a visitor of a public repository to the archive at a branch or a tag only (`tree.ref.kind`),
  not at a commit id, which Mantle serves a signed-in account alone; Tags and a release link a tag's.
- **A job's log.** `readLog` takes Mantle's bounds as they are: `more` is `getJobLog`'s `more` (its chunk limit or its
  byte bound cut the answer), or an ended log's `nextOffset` short of `logBytes`; `after` and `offset` are the answer's
  `nextChunkSeq` and `nextOffset`, which Mantle moves back over what it left out. PASS's own byte cut of a running job's
  chunks (`LOG_PAGE_BYTES`, which kept `after` but not `offset`, so a job that ended between two reads lost the chunks
  past the cut) is gone; an ended log's piece with more still ends at its last whole line, with `offset` moved to it. So
  Load more appears on a running job whose log is longer than one read (it did not: the page counted 500 chunks of a
  read that holds 100).
- **A ci/ check's link.** CommitDetail and a merge request's checks link a `ci/` status to its own run on this site (the
  run and job its target names, or the authority's `path`) or to nothing, never to its https target; a status of another
  context keeps its https target.
- **Redirects.** `redirectRoute` puts the request's query before the target's `#fragment` (`withQuery`). `ownAddress`
  refuses the site's theme preview host (`ShopPreview.js` `isPreviewHost`), as Mantle's `siteTarget` does. `movedPath`
  refuses a target that is the path asked for on the same host, as `resolve#Redirect` looks a path up (no query or
  fragment, no trailing slash, percent-decoded, lower case), so a row cannot answer itself in a loop.
- **Plain text.** `plain` (and its `ANSI` and `CONTROL`) moved to `Smithy.js`, and is used also on a job's name and matrix
  key, its image and its needs, a pipeline's name (run lists, a run's head, Cancel, Run pipeline's choices, Checks, a
  commit's runs), an artifact's name (a job's artifacts, Attach a pipeline run's file), a run's ref text, a search result's
  title and snippet, a component's description in Explore, and a check's context and description.
- **Docs ref picker.** The choice is redirected only when it is a branch or a tag of the page's `refList` (or the ref shown);
  any other value is not taken, so the parameter cannot name a path. The page is read first.
- **A release's file upload.** `run` asks `getRelease` first (`uploadCheck`) and stages the file only for
  `capabilities.canEdit`; a release that is not there is Not Found's refusal, anyone else's is refused before anything
  is stored. A file staged for a write that is then refused is removed (`removeStagedAttachment`).
- **An unnamed release.** Mantle names an unnamed release by its tag, so the edit form's Name is empty when the name is the
  tag, and is sent only when changed (`was_name`; `storeRelease` `changed`): a save of the notes leaves the release
  unnamed. The notes' editor is filled from `getRelease`'s `notes` (Mantle now gives a Maintainer the stored text).
- **Tests.** Smithy: an old path's target checked again (rows the writer would refuse: another host, a port, a user part,
  a backslash, `//`, the preview host; a loop on the same host, the same row from another host kept); `withQuery`; one
  render of Search (the query and a result's title escaped); a visitor's `addons.xml` (`public, max-age=300`,
  `Vary: Cookie`); Make it a draft without `confirm=yes` refused; the release's `was_name`; the Docs and ReleaseDetail
  renders no longer check Mantle's cleaning again. SmithyReview: the checks with a `ci/` status that has an https target
  (no link) and another context's (linked); the log's JSON rendered once, its Not Found cases (another job, pipelines
  off) and an upload's with pipelines off through `logJson` and `artifact`; `testPath`'s refusals; `plain` on C0, C1, DEL,
  bidi and terminal escapes. Load more on a running job is not checked by a render: it needs Mantle's `more`.
- **Registries.** Not copied again: Mantle's working `SmithySchema.js` and `PassRoutes.js` now hold DG8's operations
  (`resolveRedirect` and the GitHub import's), whose `cancelImport` is also the forum's mbox `cancelImport`
  (`ForumSchema.js`), so one facade could not hold both. PASS keeps the DG7 copies (130 operations) until Mantle renames
  it; the registries' check of Smithy's spec fails until then.

## DG8: the GitHub import and push mirrors

| Area | Implementation |
| --- | --- |
| Routes | `SmithyRoutes.js` routes `import` and `import/<importId>` (`/Smithy/Import`), the Import tab of a group's Settings and the Mirrors tab of a repository's. The grammar had them |
| Pages | `screen/Smithy/SmithyImport.js` builds them as escaped markup with `SmithyForms.js`'s helpers: the Import tab (`groupImport`), an import's page and the site's imports (`Smithy/Import.xml`, `importPageView`), and the Mirrors tab (`mirrors`). Every read and write is Mantle's (`SmithyImport.js` through the facade); what the caller may not see is Not Found |
| Import tab | A group's Owner or an operator: the GitHub repository (`owner/name`), a token in a password field never filled back, a new repository (its slug) or one of the group's, issues and pull requests, and `publishPrivate` with its warning (`startGitHubImport`, which goes to the import's page); the group's imports below (`findGitHubImports`). An account without a confirmed address is told to confirm in place of the form |
| An import's page | `B/import/<importId>` (`getGitHubImport`): the stage in words, counts by type (imported, seen at GitHub, failed), the wait on GitHub's rate limit with the time it goes on, the report (escaped), what an import never carries, Refresh (a link), Resume with a token once the run ended or Replace token while it runs (`resumeGitHubImport`), and Stop asked again on `?confirm=cancel` (`cancelGitHubImport`). `B/import` is the site's imports, for an operator |
| Mirrors tab | A Maintainer: each mirror with its address, refs, delete refs, enabled, whether it has a credential, the last push and its result and error, the next attempt; Push now (`pushMirror`), Edit, and Delete asked again (`deleteMirror`); New mirror. The form (`mirrorFields`): an https address with no credential in it, the username and the secret apart (the secret write-only), the host key's fingerprint for SSH, the refs, delete refs, enabled, and "Remove the credential" for a mirror that has one (`removeCredential`) |
| Secrets | `token` and `secret` are in `SmithyForms.js`' `SECRET`, and the mirror form adds `username` (`notKept`): a refused form keeps none of them for the next page, and a kept `url` loses its user part (after leading space too), a webhook's too. None is ever in an address |
| Forms | `Do.xml` has 6 more `post` transitions: `startGitHubImport`, `resumeGitHubImport`, `cancelGitHubImport` (confirmed), `storeMirror`, `deleteMirror` (confirmed), `pushMirror` |
| Redirects | `Smithy.js` `movedPath` asks the facade's `resolveRedirect` (an operation since Mantle's DG7 review), so an imported repository's old GitHub paths and the site's table answer on a remote frontend too |
| Caching | `Shared/Headers.js`: `import…` pages are `no-store` for a visitor too, as `new…` are |
| Reasons | `Shared/Portal.js` has `sourceRefused`, `importActive`, `numbersTaken` and `secretRequired`, as Mantle's `PassAuthority.js` |
| Registries | `SmithySchema.js` and `Routes.js` are copies of Mantle's again, with the 9 DG8 operations: the import's are named for GitHub (`startGitHubImport` and the rest), so the forum's mbox `cancelImport` keeps its name and one facade holds both (the DG7 note's wait is over) |
| Tests | `test/Smithy/SmithyImport.spec.js` on Mantle's recorded GitHub responses (`mantle@smithy-github-api`): an import started through its form goes to its page, a refusal returns to the form, the token in no address, flash or page; an import's page (stage, counts, the wait with its time, the report escaped, Resume and Stop); Stop without its confirmation refused; a refused mirror form keeping no secret, username or user part of its address; the Settings page rendered once; the mirror list and its form through page functions. `SmithyAccess.spec.js`: an import is its group's Owners' and the mirrors a Maintainer's (a Developer gets Not Found, as for an import that is not there); the operator's list and another site's import are Not Found. `Smithy.spec.js`: the DG8 paths |

Differences from the design:

- The start form is on the group's Import tab, not at `B/import`, which lists the site's imports for an operator; the
  group is the tab's.
- Resume takes a token: it is dropped when a run ends, so a run that ended needs one again; a running import's token
  can be replaced.
- Until the framework's mirrors were in, the Mirrors tab said "Push mirrors are not available on this server yet"
  (Mantle's `notBuilt`); that branch is gone.

Not built: `SmithyAccessWalk` and `SmithyPhone` as specs of their own; the phone width of the import and mirror pages
in a browser. Not shown: an import against GitHub's live API (the pages run on recorded responses), and a mirror
pushing to a real server.

## DG10: deploy environments and deployments

| Area | Implementation |
| --- | --- |
| Environments | Settings › Pipelines (`SmithyPipelines.js` `repositorySettings`): the DG5 environment form extended with the target URL (https, no user part), the token (a password field, sent only when typed, never written back or kept in a flash), the required pipeline, the data types (empty: the target's defaults) and the clone URL, each text sent only when changed; the list shows them, whether a token is set, who waits for approval in words (`approvalFor`: every deployment, or only one of a branch no rule protects) and the last deployment. The addresses are a Maintainer's, and only a Maintainer has this tab. No approver group (Smithy has none for now). |
| Deployments | `-/pipelines/deployments` (`RepositoryDetail/Deployments.xml`, `deployments`): `findDeployments` a page at a time, and Request deploy (`requestDeploy`) where `canDeploy`, going to the new deployment's page. Runs and Deployments are two tabs of Pipelines. |
| A deployment | `-/pipelines/deployments/<deploymentId>` (`DeploymentDetail.xml`, `deploymentPage`): `getDeployment`, "Needs a Maintainer's approval" when the deployment says so (`approvalRequired`, which also adds the approval step), its steps with the run linked, the authority's message escaped, the target's result; Approve, Refuse (a reason, `?confirm=refuse`) and Cancel (`?confirm=cancel`) through Do (`decideDeploy`, `cancelDeploy`, Refuse and Cancel refused without `confirm=yes`). |
| Tests | `SmithyDeploy` (an environment through Do and the token in no page or flash, one render each of Deployments and DeploymentDetail, access, the confirmations); routes and Do's count in `Smithy`. |

Not built: the deploy pages at 390 px in a browser; filters on Deployments.

## DG11: the Forgejo API

| Area | Implementation |
| --- | --- |
| Filter | `script/SmithyApi.js`, the `SmithyApi` filter on `/api/v1/*` in `MoquiConf.xml`: the site by host, `getSiteInfo` for the mount (Smithy at `/` or pass the request on), token or Bearer sign-in with `loginUserKey(key, "git")`, routing, Forgejo JSON, `limit`/`page` with `X-Total-Count` and `Link`. Design §4.5. |
| Access | `Facade.js` `checkLoginKey`: with `passSmithyApi` set, an access token calls `SMITHY_API_OPERATIONS`, the pages' own operations, so the pages' rules decide. |
| Framework | `ec.user.loginUserKey(key, scope)`: the scope argument signs in a scoped key (mr-moqui). |
| Web URLs | `pulls/<n>` is a compatibility form of `-/merge-requests/<n>` (mr-mantle `SmithyCore.js`). |
| Tests | `SmithyApi`: sign-in and refusals, a private repository 404 to a stranger and to nobody, merge requests created, listed in pages, filtered, read, diffed, commented and merged (and a stranger's merge refused), and the mount rule. |

Not built: `pulls/{n}/update`, merge request labels, a search by part of a name, a repository under `user/`, binary contents, remote mode (design §4.5).
