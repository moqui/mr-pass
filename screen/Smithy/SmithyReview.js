/* Smithy's merge request, fork and file editing pages (Dogfood DG4; plan/design-smithy.md §9, §15.5): a repository's
 * MergeRequests, NewMergeRequest, a merge request's Overview (the conversation, reviewers, checks, the agreement, the
 * merge box), Commits, Changes (the diff with line comments) and Checks, Fork, Edit (edit, new file, upload, rename and
 * delete, each saved as a commit) and the Agreement tab of a group's and a repository's Settings. A merge request is the
 * authority's projection (getMergeRequest, findMergeRequests) and its conversation the posts of its record topic, read and
 * written with the forum's operations as an issue's is (SmithyIssues.js). Every page is plain HTML built here as escaped
 * markup (SmithyForms.js h); its forms post to Smithy/Do with the session token. Text from a repository (a diff, a file) is
 * escaped here; a post's body is the authority's cleaned markup, cleaned once more. Where JavaScript runs an island takes
 * over a part of the plain page: the composer a text, DiffReview the diff's lines, Editor the file's textarea. What the
 * caller may not see (a merge request held for review, one of a private repository) is Not Found. None of these pages is
 * kept by a cache (Shared/Headers.js). CC0 plus patent grant. */
const smithy = ec.resource.script("component://mr-pass/screen/Smithy/Smithy.js")
const forms = ec.resource.script("component://mr-pass/screen/Smithy/SmithyForms.js")
const issuePages = ec.resource.script("component://mr-pass/screen/Smithy/SmithyIssues.js")
const {portal, fail, need, maybe, param, enc, query, dateText, holds, plain} = smithy
const {Markup, h, attributes, hidden, contextOf, gate, formOf, open, input, textarea, select, check, submit, hint, tabsOf, confirmCard} =
    forms
const {clean, person, textField, textButtons, postRow, side, WATCH} = issuePages

/* The addresses of a repository's merge request pages under the mount's base. */
function urlsOf(base, repositoryPath) {
    const u = smithy.urls(base, repositoryPath)
    const list = u.section("merge-requests")
    const one = number => list + "/" + encodeURIComponent(number)
    return {
        u,
        list,
        fresh: list + "/new",
        one,
        tab: (number, tab) => (tab && tab !== "overview" ? one(number) + "/" + tab : one(number))
    }
}
/* A repository with merge requests turned off has none of their pages (design §1). */
function requireMergeRequests(shell) {
    if (shell.repository.features?.mergeRequests === false) fail()
}
const listOf = value =>
    (Array.isArray(value) ? value.map(String) : String(value || "").split(",")).map(item => item.trim()).filter(Boolean)
const STATES = {draft: "Draft", open: "Open", merged: "Merged", closed: "Closed"}
const METHODS = [
    ["merge", "Merge commit"],
    ["squash", "Squash"],
    ["rebase", "Rebase"],
    ["fastForward", "Fast-forward"]
]
const methodText = value => METHODS.find(([key]) => key === value)?.[1] || value
// expected: a check a branch rule requires that has not reported on the head (DG5)
const CHECK_TEXT = {success: "passed", failure: "failed", error: "failed", pending: "running", missing: "missing", expected: "expected"}
const checkText = state => CHECK_TEXT[state] || state || ""
/* What an author is missing of the agreement, in words; a word that is not here is shown as it is. */
const MISSING_TEXT = {
    copyright: "no line under Copyright Waiver",
    patent: "no line under Grant of Patent License",
    copyrightNotOwn: "the line under Copyright Waiver was not added by a commit of their own account",
    patentNotOwn: "the line under Grant of Patent License was not added by a commit of their own account",
    copyrightUnverified: "the line under Copyright Waiver was added too far back to verify",
    patentUnverified: "the line under Grant of Patent License was added too far back to verify",
    notOnlySignatures: "the commit that signs must only add their line",
    account: "the commit's author is not an account of this site (no confirmed address matches it)",
    authorNotPusher: "a commit in their name was brought here by another account",
    pusherUnknown: "a commit in their name was brought here by no known account",
    botOperator: "a bot whose operator is not confirmed by a Maintainer",
    tooManyCommits: "it has too many commits to check each author",
    fileInvalid: "the agreement's file has a list heading twice"
}
/* Why a file is not edited on its page, in words. */
const NOT_EDITABLE = {
    notBranch: ec.l10n.localize("A file is edited on a branch, not on a tag or a commit."),
    archived: ec.l10n.localize("This repository is archived: nothing in it is changed."),
    mirror: ec.l10n.localize("This repository is a mirror of another one: it is changed there."),
    lfs: ec.l10n.localize("This file is kept in Git LFS: change it with git."),
    tooLarge: ec.l10n.localize("This file is too large to edit on its page: change it with git."),
    binary: ec.l10n.localize("This is a binary file: it is replaced by an upload, or with git.")
}
const AGREEMENT_TEXT = {signed: ec.l10n.localize("Agreement signed"), unsigned: ec.l10n.localize("Agreement not signed"), pending: ec.l10n.localize("Agreement waits for a bot's operator")}
/* A link only to an https address (a status's target is written by whoever reports it). */
const httpsOf = url => (/^https:\/\//.test(String(url || "")) ? String(url) : null)
/* The source of a merge request as the pages write it: the fork's path before its branch, or "pushed for review". */
function sourceOf(c, shell, m) {
    const other = m.sourceRepositoryPath && m.sourceRepositoryPath !== shell.repository.repositoryPath ? m.sourceRepositoryPath : null
    if (m.pushedForReview) return h`<span>pushed for review</span>`
    const u = smithy.urls(c.base, other || shell.repository.repositoryPath)
    return h`${other ? h`<a href="${u.root}">${other}</a>:` : ""}<a href="${u.tree(m.sourceRef, "")}">${m.sourceRef}</a>`
}

/* The filters of a MergeRequests list, from the request: what findMergeRequests takes, and what a link of the page carries. */
function filtersOf() {
    const state = ["merged", "closed", "draft"].includes(param("state")) ? param("state") : "open"
    const handle = name =>
        String(param(name) || "")
            .replace(/^@/, "")
            .trim()
    const shown = {state, q: param("q") || "", author: handle("author"), reviewer: handle("reviewer"), target: param("target") || ""}
    return {
        shown,
        input: {
            state,
            limit: 30,
            ...(shown.q ? {query: shown.q} : {}),
            ...(shown.author ? {authorHandle: shown.author} : {}),
            ...(shown.reviewer ? {reviewerHandle: shown.reviewer} : {}),
            ...(shown.target ? {targetRef: shown.target} : {}),
            ...(param("cursor") ? {cursor: param("cursor")} : {})
        },
        link: (path, more) => path + query({...shown, state: shown.state === "open" ? null : shown.state, ...(more || {})})
    }
}
/* MergeRequests (design §9 MergeRequests): a repository's merge requests, open, merged or closed with their counts, filtered
 * by author, reviewer, target branch, draft and text, by cursor. */
function mergeRequests(shell, bases, siteInfo, self) {
    requireMergeRequests(shell)
    const c = contextOf(bases, siteInfo, self, shell.flash)
    const ru = urlsOf(c.base, shell.repository.repositoryPath)
    const filters = filtersOf()
    const s = filters.shown
    const found = need("findMergeRequests", {siteId: shell.siteId, repositoryId: shell.repository.repositoryId, ...filters.input})
    const counts = found.counts || {}
    const tab = (state, label, count) =>
        h`<a href="${filters.link(ru.list, {state: state === "open" ? null : state, cursor: null})}"${attributes({"aria-current": s.state === state || (state === "open" && s.state === "draft") ? "page" : null})}>${label}${
            count == null ? "" : h` <small>${count}</small>`
        }</a>`
    const rows = (found.mergeRequestList || []).map(m => {
        const agreement = AGREEMENT_TEXT[m.agreementState]
        return h`<article class="card smithy-row" id="SmithyMergeRequest_${m.mergeRequestNum}"><h3 class="wrap"><a href="${ru.one(m.mergeRequestNum)}">${m.title}</a> <small>!${m.mergeRequestNum}</small>${
            m.state === "draft" ? h` <small class="smithy-chip">Draft</small>` : ""
        }${m.pending ? h` <small class="smithy-chip">Waiting for review</small>` : ""}</h3><p class="wrap"><small>${STATES[m.state] || m.state} · ${sourceOf(c, shell, m)} → ${m.targetRef} · opened ${dateText(m.createdAt)}${
            m.author?.handle ? " by @" + m.author.handle : ""
        }${m.checkState ? " · checks " + checkText(m.checkState) : ""} · ${Number(m.approvalCount) || 0} ${Number(m.approvalCount) === 1 ? "approval" : "approvals"}${
            agreement ? " · " + agreement : ""
        } · ${Number(m.commentCount) || 0} ${Number(m.commentCount) === 1 ? "comment" : "comments"}</small></p></article>`
    })
    return {
        html: h`<h2>Merge requests</h2><p id="SmithyNewMergeRequestLink"><a href="${ru.fresh}">${ec.l10n.localize("New merge request")}</a></p><nav aria-label="Merge request states" class="card smithy-tabs" id="SmithyMergeRequestStates">${tab("open", "Open", counts.open)}${tab("merged", "Merged", counts.merged)}${tab("closed", "Closed", counts.closed)}</nav><form method="get" action="${ru.list}" class="card" role="search" id="SmithyMergeRequestFind"><label>Search <input type="search" name="q" value="${s.q}" maxlength="200"></label><label>Author <input name="author" value="${s.author}" maxlength="39" placeholder="handle"></label><label>Reviewer <input name="reviewer" value="${s.reviewer}" maxlength="39" placeholder="handle"></label><label>Target branch <input name="target" value="${s.target}" maxlength="250"></label>${select(
            formOf(c, ""),
            "state",
            "Show",
            [
                ["open", "Open"],
                ["draft", "Drafts only"],
                ["merged", "Merged"],
                ["closed", "Closed"]
            ],
            {value: s.state}
        )}<p><button>Show</button></p></form><section id="SmithyMergeRequestList" aria-label="Merge requests">${
            rows.length ? rows : h`<p class="card">No merge requests to show.</p>`
        }</section>${found.nextCursor ? h`<p><a href="${filters.link(ru.list, {cursor: found.nextCursor})}" id="SmithyMergeRequestsMore">More merge requests</a></p>` : ""}`
            .html
    }
}

/* A head as a form or an address writes it: <repositoryPath>:<ref> for a fork's ref, else the ref. */
function headOf(text) {
    const value = String(text || "").trim()
    const colon = value.indexOf(":")
    return colon > 0 ? {headRepositoryPath: value.slice(0, colon).toLowerCase(), head: value.slice(colon + 1)} : {headRepositoryPath: null, head: value}
}
/* NewMergeRequest (design §9 NewMergeRequest), at -/merge-requests/new?base=&head=: the target and the source (a fork's
 * branch as <path>:<branch>), what the source has that the target lacks, then the title, the text, draft and, for a
 * Developer, reviewers. A visitor is sent to sign in; an account without a confirmed address is told to confirm it. */
function newMergeRequest(shell, bases, siteInfo, self) {
    requireMergeRequests(shell)
    const c = contextOf(bases, siteInfo, self, shell.flash)
    const siteId = shell.siteId
    const repository = shell.repository
    const ru = urlsOf(c.base, repository.repositoryPath)
    const caps = shell.capabilities
    const head = h`<h2>${ec.l10n.localize("New merge request")}</h2>`
    const closed = gate(c, c.signedIn ? caps.confirmed : null)
    if (closed) return {html: h`${head}${closed}`.html}
    if (repository.archived) return {html: h`${head}<p class="card" id="SmithyNoAccess">This repository is archived: no merge request is opened in it.</p>`.html}
    const f = formOf(c, "createMergeRequest")
    const base = String(f.value("targetRef", param("base") || repository.defaultBranch || "")).trim()
    const typedHead = f.value("sourceRepositoryPath", "")
        ? f.value("sourceRepositoryPath", "") + ":" + f.value("sourceRef", "")
        : f.value("sourceRef", param("head") || "")
    const {headRepositoryPath, head: headRef} = headOf(typedHead)
    const headText = (headRepositoryPath ? headRepositoryPath + ":" : "") + headRef
    // a fork's merge requests go to its parent by default (design §9.2)
    const parent = shell.forkOf
        ? h`<p class="card" id="SmithyForkTarget">This repository is a fork of <a href="${shell.forkOf.href}">${shell.forkOf.path}</a>. To send your work there, <a href="${urlsOf(c.base, shell.forkOf.path).fresh}${query({head: repository.repositoryPath + ":" + (headRef || repository.defaultBranch || "")})}">open the merge request in ${shell.forkOf.path}</a>.</p>`
        : ""
    const pick = h`<form method="get" action="${ru.fresh}" class="card" id="SmithyMergeRequestRefs"><label>Target branch <input name="base" value="${base}" maxlength="250" required></label><label>Source <input name="head" value="${headText}" maxlength="350" required></label>${hint(
        "A branch of this repository, or a fork's branch written group/repository:branch."
    )}<p><button>Compare</button></p></form>`
    if (!headRef) return {html: h`${head}${parent}${pick}`.html}
    const compared = portal.attempt("getCompare", {
        siteId,
        repositoryId: repository.repositoryId,
        head: headRef,
        ...(base ? {base} : {}),
        ...(headRepositoryPath ? {headRepositoryPath} : {}),
        checkMergeable: true
    })
    if (compared.error)
        return {
            html: h`${head}${parent}${pick}<p role="alert" class="error" id="SmithyCompareFailure">${
                compared.error.kind === "NotFound" ? "One of these branches was not found, or you may not see the fork." : compared.error.message
            }</p>`.html
        }
    const r = compared.result
    const u = ru.u
    const commits = (r.commitList || []).map(row => smithy.commitRow(u, c.base, row))
    const summary = h`<section class="card" id="SmithyMergeRequestCompare"><p><strong>${headText}</strong> → <strong>${base}</strong>: ${Number(r.aheadBy) || 0} ${Number(r.aheadBy) === 1 ? "commit" : "commits"}, ${
        (r.fileList || []).length
    } ${(r.fileList || []).length === 1 ? "file" : "files"} changed${r.mergeable === true ? " · merges cleanly" : r.mergeable === false ? " · conflicts" : ""} · <a href="${u.section("compare", base + "..." + headText)}">See the changes</a></p>${commits.map(
        row => h`<p class="wrap"><a href="${row.href}"><code>${row.shortId}</code></a> ${row.summary} <small>${row.authorName}</small></p>`
    )}</section>`
    if (!(Number(r.aheadBy) > 0))
        return {html: h`${head}${parent}${pick}${summary}<p class="card" id="SmithyNothingToMerge">The source has nothing the target lacks, so there is nothing to merge.</p>`.html}
    // the fork's id is the authority's answer for its path, which the caller may view
    const source = headRepositoryPath ? maybe("resolveSmithyPath", {siteId, path: headRepositoryPath}) : null
    if (headRepositoryPath && source?.kind !== "repository") fail()
    // the oldest commit names the merge request
    const first = (r.commitList || [])[(r.commitList || []).length - 1] || {}
    const body = String(first.message || "")
    return {
        html: h`${head}${parent}${pick}${summary}${open(c, f, {title: "Open the merge request", returnTo: ru.fresh + query({base, head: headText})})}${hidden("repositoryId", repository.repositoryId)}${
            source ? hidden("sourceRepositoryId", source.repositoryId) : ""
        }${headRepositoryPath ? hidden("sourceRepositoryPath", headRepositoryPath) : ""}${hidden("sourceRef", headRef)}${hidden("targetRef", base)}${hidden("operationId", portal.operationId())}${input(
            f,
            "title",
            "Title",
            {value: first.summary || "", required: true, maxlength: 250}
        )}${textField(f, "Description", {
            island: true,
            rows: 10,
            required: false,
            value: (r.commitList || []).length === 1 && body.includes("\n") ? body
                          .slice(body.indexOf("\n") + 1)
                          // the host's own trailer is not the author's text
                          .replace(/^Moqui-User-Id: .*$/gm, "")
                          .trim() : ""
        })}${issuePages.box(f, "draft", "Draft: not ready to merge yet", false)}${
            caps.canReview ? input(f, "reviewerHandles", "Reviewers", {maxlength: 400, hint: ec.l10n.localize("Handles, separated by commas.")}) : ""
        }${textButtons(c, f, "Open merge request")}${issuePages.island(c, siteInfo, f, "Description")}`.html
    }
}

/* A merge request's shell (design §9 MergeRequestOverview): its record for this caller and the head of its pages: title,
 * number, state, author, source and target, and the tabs. One held for review is Not Found to everyone but its author and
 * the moderators, for whom it is marked. Plain data, kept in the screen's context for the tab's own script. */
function requestShell(shell, mergeRequestNum, bases, siteInfo, self) {
    requireMergeRequests(shell)
    const number = Number(mergeRequestNum)
    const found = need("getMergeRequest", {siteId: shell.siteId, repositoryId: shell.repository.repositoryId, mergeRequestNum: number})
    const m = found.mergeRequest
    const c = contextOf(bases, siteInfo, self, shell.flash)
    const ru = urlsOf(c.base, shell.repository.repositoryPath)
    const word = /\/-\/merge-requests\/[0-9]+\/([a-z]+)/.exec(String(self || ""))?.[1] || "overview"
    const headHtml = h`<article id="SmithyMergeRequest" class="wrap"><h2>${m.title} <small>!${m.mergeRequestNum}</small></h2><p><strong class="smithy-chip" id="SmithyMergeRequestState">${STATES[m.state] || m.state}</strong> <span id="SmithyMergeRequestRefs">${sourceOf(c, shell, m)} → <a href="${ru.u.tree(m.targetRef, "")}">${m.targetRef}</a></span></p><p><small>Opened ${dateText(m.createdAt)} by ${person(c, m.author)}${
        m.mergedAt ? h` · merged ${dateText(m.mergedAt)}${m.mergedBy?.handle ? " by @" + m.mergedBy.handle : ""}` : ""
    }${m.closedAt && !m.mergedAt ? " · closed " + dateText(m.closedAt) : ""}</small></p></article>${
        found.pending
            ? h`<p role="status" class="card" id="SmithyMergeRequestPending">Waiting for review: this merge request is shown to others once a moderator has approved it.</p>`
            : ""
    }${tabsOf(
        "Merge request sections",
        [
            ["overview", "Overview", ru.one(number)],
            ["commits", "Commits", ru.tab(number, "commits")],
            ["changes", "Changes", ru.tab(number, "changes")],
            ["checks", "Checks", ru.tab(number, "checks")]
        ],
        word
    )}`.html
    return {found, number, headHtml}
}

/* The review form (design §9: a review is a decision with a summary): Comment for anyone who may, Approve and Request
 * changes for who may approve (a Developer who is not the author). */
function reviewForm(c, shell, request, returnTo) {
    const caps = request.found.capabilities || {}
    if (!caps.canReview || !["open", "draft"].includes(request.found.mergeRequest.state)) return ""
    const f = formOf(c, "submitReview")
    const decisions = [["comment", "Comment"], ...(caps.canApprove ? [["approve", "Approve"]] : []), ...(caps.canApprove || caps.canRequestChanges ? [["request_changes", "Request changes"]] : [])]
    return h`<details class="card" id="SmithyReview"${attributes({open: !!f.error})}><summary><strong>Review</strong></summary>${open(c, f, {plain: true, returnTo: returnTo || c.self})}${hidden("repositoryId", shell.repository.repositoryId)}${hidden(
        "mergeRequestNum",
        request.number
    )}${hidden("operationId", portal.operationId())}${hidden("sourceFormat", "markdown")}<fieldset><legend>Decision</legend>${decisions.map(
        ([value, text], i) => h`<label><input type="radio" name="decision" value="${value}"${attributes({checked: f.value("decision", "comment") === value || (!i && !f.value("decision", ""))})}> ${text}</label>`
    )}</fieldset>${textarea(f, "body", "Summary", {rows: 4, maxlength: 100000, hint: "Markdown."})}${submit("Submit review")}</details>`
}

/* What stands between a merge request and its merge, as the page says it: a draft, conflicts, and the authority's own
 * reasons (missingList: checks not passed, approvals missing, the agreement). The authority decides when the merge is asked. */
function blockersOf(found) {
    const m = found.mergeRequest
    const out = []
    if (m.state === "draft") out.push("It is a draft.")
    if (m.mergeable === false)
        out.push((m.conflictPaths || []).length
            ? ec.resource.expand("It does not merge cleanly: conflicts in ${paths}.", "", {paths: m.conflictPaths.join(", ")})
            : ec.l10n.localize("It does not merge cleanly."))
    for (const reason of found.missingList || []) out.push(String(reason?.text || reason?.context || reason))
    return out
}
/* The agreement box (design §9.4): signed, or who is missing what, with the file's Contributing section and Sign. */
function agreementBox(c, shell, request) {
    const found = request.found
    const m = found.mergeRequest
    const agreement = found.agreement || {}
    const caps = found.capabilities || {}
    if (!agreement.required && (!agreement.state || agreement.state === "off")) return ""
    const file = agreement.file || "AUTHORS.md"
    const u = smithy.urls(c.base, shell.repository.repositoryPath)
    // the page that edits the file is the authority's choice for this caller (signPath: the merge request's source branch
    // for its author who may commit there, a fork's too, else the target branch). The link is built here from the parts
    // signPath names, so a branch with "#" or "%" in its name is a path, whether or not signPath came encoded; a signPath
    // that names neither is used as given
    const given = agreement.signPath ? String(agreement.signPath) : null
    const sourcePath = m.sourceRepositoryPath || shell.repository.repositoryPath
    const places = [
        ...(m.sourceRef && !m.pushedForReview ? [[sourcePath, m.sourceRef]] : []),
        [shell.repository.repositoryPath, m.targetRef]
    ]
    const named = given
        ? places.find(([path, ref]) => [path + "/-/edit/" + ref + "/" + file, path + "/-/edit/" + enc(ref + "/" + file)].includes(given.replace(/^\//, "")))
        : places[places.length - 1]
    const signHref =
        (named ? smithy.urls(c.base, named[0]).section("edit", named[1] + "/" + file) : given.startsWith("/") ? given : c.base + "/" + given) +
        query({sign: request.number})
    const key = h`${hidden("repositoryId", shell.repository.repositoryId)}${hidden("mergeRequestNum", request.number)}`
    const missing = agreement.missingList || []
    const state = agreement.state
    return h`<section class="card" id="SmithyAgreement" aria-label="Contributor agreement"><p><strong>Contributor agreement</strong> <span class="smithy-chip">${
        state === "signed" ? "Signed" : state === "pending" ? "Pending" : "Not signed"
    }</span></p>${
        state === "signed"
            ? h`<p>The author of this merge request and of each of its commits has signed <a href="${u.blob(m.targetRef, file)}">${file}</a>.</p>`
            : h`<p>Code is merged only from people who have signed <a href="${u.blob(m.targetRef, file)}">${file}</a> under both of its lists, each by a commit of their own account. <a href="${u.blob(m.targetRef, file)}#contributing">How to sign</a></p>${
                  missing.length
                      ? h`<ul id="SmithyAgreementMissing">${missing.map(
                            item =>
                                h`<li class="wrap">${item.handle ? "@" + item.handle : item.name || (item.commitId ? ec.l10n.localize("An author") : ec.l10n.localize("This merge request"))}${item.commitId ? h` <small>(commit <code>${String(item.commitId).slice(0, 8)}</code>)</small>` : ""}: ${
                                    listOf(item.missing)
                                        .map(word => MISSING_TEXT[word] || word)
                                        .join("; ") || "has not signed"
                                }</li>`
                        )}</ul>`
                      : ""
              }${caps.canSign !== false && c.signedIn ? h`<p><a href="${signHref}" id="SmithySign">Sign</a>: add your own line to ${file} on its page.</p>` : ""}`
    }${
        state === "pending"
            ? h`<p id="SmithyBotOperator">${
                  agreement.botOperatorConfirmed
                      ? ec.l10n.localize("The bot's operator is confirmed.")
                      : agreement.botOperatorDeclared
                        ? ec.l10n.localize("The bot's operator has said it signed. A Maintainer confirms it.")
                        : ec.l10n.localize("The author is a bot: its operator, who has signed, says so here, and a Maintainer confirms it.")
              }</p>`
            : ""
    }${
        state === "pending" && c.signedIn && !agreement.botOperatorDeclared
            ? h`${open(c, formOf(c, "declareBotOperator"), {plain: true})}${key}${hidden("operationId", portal.operationId())}<p><button>I operate this bot and have signed</button></p></form>`
            : ""
    }${
        caps.canConfirmBot && state === "pending"
            ? h`${open(c, formOf(c, "confirmBotOperator"), {plain: true})}${key}${hidden("expectedRevision", m.revision)}<p><button>Confirm the bot's operator</button></p></form>`
            : ""
    }${
        state !== "signed" && (caps.canEdit || caps.canReview) && c.signedIn
            ? h`${open(c, formOf(c, "recheckAgreement"), {plain: true})}${key}${hidden("operationId", portal.operationId())}<p><button>Check again</button></p></form>`
            : ""
    }</section>`
}
/* The checks of the head: each status by context, a ci/ check linked to the run it came from on this site (DG5, the
 * authority's path) or to nothing, another one to its https target, the required ones marked (one not reported yet is "expected"), whether
 * the head changes ci.xml, and what keeps it from merging; with runs (the Overview's box) the head's runs as links. */
const checksHtml = (found, id, base, runs) => {
    const list = found.checkList || []
    const runList = runs ? found.runList || [] : []
    return h`<section class="card" id="${id}" aria-label="Checks"><p><strong>Checks</strong></p>${
        list.length ? "" : h`<p>No check has reported on the head commit.</p>`
    }${list.map(item => {
        const href = item.path
            ? (base || "") + item.path
            : String(item.context || "").startsWith("ci/")
              ? null
              : httpsOf(item.targetUrl)
        const context = plain(item.context)
        return h`<p class="wrap"><strong>${checkText(item.state)}</strong> · ${
            href ? h`<a href="${href}"${attributes({rel: item.path ? null : "nofollow noopener"})}>${context}</a>` : context
        }${item.required ? h` <small class="smithy-chip">Required</small>` : ""}${item.description ? " · " + plain(item.description) : ""}</p>`
    })}${
        runList.length
            ? h`<p id="SmithyChecksRuns"><small>Runs: ${runList.map(
                  (run, i) => h`${i ? ", " : ""}<a href="${(base || "") + run.path}">#${run.runNum} ${plain(run.pipelineName)}</a> ${run.state}`
              )}</small></p>`
            : ""
    }${
        found.ciFileChanged
            ? h`<p class="wrap" id="SmithyCiFileChanged">This merge request changes <code>ci.xml</code>: its required checks ran the jobs it defines, so a Maintainer merges it.</p>`
            : ""
    }${(found.missingList || []).length ? h`<ul id="SmithyChecksMissing">${(found.missingList || []).map(reason => h`<li class="wrap">${String(reason?.text || reason?.context || reason)}</li>`)}</ul>` : ""}</section>`
}

/* MergeRequestOverview (design §9): the conversation with a reply form, the review form, and the side column: reviewers and
 * their decisions, the checks, the agreement, mergeability, linked issues, the watch level, how to fetch it, and the merge
 * box with the allowed methods for who may merge, or why it is refused. ?confirm=merge and ?confirm=close ask again. */
function overview(shell, request, bases, siteInfo, self, asked) {
    const ask = name => (asked ? (asked[name] ?? null) : param(name))
    const siteId = shell.siteId
    const repositoryId = shell.repository.repositoryId
    const found = request.found
    const m = found.mergeRequest
    const caps = found.capabilities || {}
    const number = request.number
    const c = contextOf(bases, siteInfo, self, shell.flash)
    const ru = urlsOf(c.base, shell.repository.repositoryPath)
    const root = m.topic?.rootCommEventId || null
    const key = h`${hidden("repositoryId", repositoryId)}${hidden("mergeRequestNum", number)}${hidden("expectedRevision", m.revision)}`
    const live = ["open", "draft"].includes(m.state)
    const confirmed = shell.capabilities.confirmed
    const rules = found.branchRules || {}
    const allowed = listOf(rules.allowedMergeMethods)
    const methods = allowed.length ? METHODS.filter(([value]) => allowed.includes(value)) : METHODS
    const blockers = blockersOf(found)
    const ownBranch = !m.pushedForReview && (!m.sourceRepositoryPath || m.sourceRepositoryPath === shell.repository.repositoryPath)

    // a merge is asked again: the target, the method, what happens to the source branch
    if (ask("confirm") === "merge" && caps.canMerge && live) {
        const method = methods.some(([value]) => value === ask("mergeMethod")) ? ask("mergeMethod") : methods[0][0]
        const drop = ask("deleteSourceBranch") === "true" && ownBranch
        return {
            html: h`${confirmCard(c, "mergeMergeRequest", {
                title: "Merge !" + number + " into " + m.targetRef,
                lines: [
                    "This writes the changes of " + (m.pushedForReview ? "this merge request" : m.sourceRef) + " to the branch " + m.targetRef + " of " + shell.repository.repositoryPath + " as: " + methodText(method) + ". It cannot be undone here.",
                    drop ? "The source branch " + m.sourceRef + " is deleted after the merge." : "The source branch is kept.",
                    ...blockers.map(line => "Not ready: " + line)
                ],
                fields: {
                    repositoryId,
                    mergeRequestNum: number,
                    mergeMethod: method,
                    message: ask("message") || "",
                    deleteSourceBranch: drop ? "true" : "false",
                    expectedHeadCommitId: m.headCommitId || "",
                    expectedRevision: m.revision
                },
                button: "Merge",
                cancelHref: self,
                returnTo: self + query({confirm: "merge", mergeMethod: method, message: ask("message"), deleteSourceBranch: drop ? "true" : null}),
                successTo: self
            })}`.html
        }
    }
    if (ask("confirm") === "close" && caps.canSetState && live)
        return {
            html: h`${confirmCard(c, "setMergeRequestState", {
                title: "Close !" + number,
                lines: ["This closes the merge request without merging it. Its conversation stays, and it may be reopened while its source is there."],
                fields: {repositoryId, mergeRequestNum: number, state: "closed", expectedRevision: m.revision},
                button: "Close merge request",
                cancelHref: self,
                returnTo: self + query({confirm: "close"}),
                successTo: self
            })}`.html
        }

    const cursor = ask("cursor")
    const posts = root ? need("getPosts", {siteId, rootCommEventId: root, limit: 30, ...(cursor ? {cursor} : {})}) : {postList: []}
    const here = more => self + query({cursor, ...(more || {})})
    const conversation = h`<section id="SmithyConversation" aria-label="Conversation">${(posts.postList || []).map(row => postRow(c, row, here))}${
        posts.nextCursor ? h`<p><a href="${self}${query({cursor: posts.nextCursor})}" id="SmithyPostsMore">Later comments</a></p>` : ""
    }</section>`

    // the main column's form: a post's edit or report when asked, else the reply
    const signedIn = c.signedIn
    let form = ""
    let hasText = null
    const editId = ask("edit")
    const reportId = ask("report")
    if (editId && signedIn) {
        const editable = maybe("getEditablePost", {siteId, postId: editId})?.draft
        if (!editable || editable.rootCommEventId !== root) fail()
        const f = formOf(c, "updatePost")
        hasText = f
        form = h`${open(c, f, {title: "Edit the text", returnTo: here({edit: editId}) + "#" + f.id, successTo: here() + "#post-" + editId})}${hidden("postId", editId)}${hidden(
            "expectedRevision",
            editable.postRevision ?? editable.revision
        )}${textField(f, "Text", {value: editable.sourceText ?? editable.body ?? "", sourceFormat: editable.sourceFormat || "html", island: true})}${input(
            f,
            "reason",
            "Why you changed it",
            {required: true, maxlength: 250}
        )}${textButtons(c, f, "Save", h` <a href="${here()}#post-${editId}">Cancel</a>`)}`
    } else if (reportId && signedIn && (posts.postList || []).find(row => row.postId === reportId)?.capabilities?.canFlag) {
        const f = formOf(c, "flagPost")
        form = h`${open(c, f, {title: "Report a comment to the moderators", returnTo: here({report: reportId}) + "#" + f.id, successTo: here()})}${hidden("postId", reportId)}${hidden(
            "operationId",
            portal.operationId()
        )}${input(f, "reason", "What is wrong with it", {required: true, maxlength: 500})}<p><button>Report</button> <a href="${here()}#post-${reportId}">Cancel</a></p></form>`
    } else if (!signedIn) form = gate(c, null)
    else if (confirmed === false) form = gate(c, false)
    else if (caps.canComment && root) {
        const f = formOf(c, "publishPost")
        hasText = f
        form = h`${open(c, f, {title: "Add a comment", returnTo: self + "#" + f.id, successTo: self + "#SmithyConversationEnd"})}${hidden("rootCommEventId", root)}${hidden(
            "operationId",
            portal.operationId()
        )}${textField(f, "Comment", {island: true})}${textButtons(c, f, "Comment")}`
    } else if (shell.repository.archived) form = h`<p class="card">This repository is archived: its merge requests are read only.</p>`

    // Close (asked again) and Reopen
    let state = ""
    if (caps.canSetState && confirmed !== false && m.state !== "merged")
        state = live
            ? h`<p id="SmithyCloseLink"><a href="${self}${query({confirm: "close"})}">Close merge request</a></p>`
            : h`${open(c, formOf(c, "setMergeRequestState"))}${key}${hidden("state", "open")}${submit("Reopen merge request")}`

    const blocks = []
    if (caps.canEdit && confirmed !== false && live) {
        const f = formOf(c, "updateMergeRequest")
        blocks.push(
            h`<details class="card" id="SmithyMergeRequestEdit"${attributes({open: !!f.error})}><summary><strong>Title</strong></summary>${open(c, f, {plain: true})}${key}${input(f, "title", "Title", {value: m.title, required: true, maxlength: 250})}${check(
                "draft",
                "Draft: not ready to merge yet",
                m.state === "draft"
            )}${submit("Save")}</details>`
        )
    }
    // reviewers and their decisions; a Developer asks for them
    const reviewers = found.reviewerList || []
    const reviewerText = {requested: "asked", approved: "approved", changes: "asked for changes", commented: "commented"}
    {
        const f = formOf(c, "setMergeRequestReviewers")
        blocks.push(
            side(
                "SmithyReviewers",
                "Reviewers",
                reviewers.length
                    ? reviewers.map(
                          (r, i) => h`${i ? ", " : ""}${r.handle ? h`<a href="${c.base}/${enc(r.handle)}">@${r.handle}</a>` : r.displayName} <small>${reviewerText[r.state] || r.state}</small>`
                      )
                    : "None",
                shell.capabilities.canReview && confirmed !== false && live && holds(shell.capabilities.role, "developer")
                    ? h`${open(c, f, {plain: true})}${key}${input(f, "reviewerHandles", "Handles", {value: reviewers.map(r => r.handle).filter(Boolean).join(", "), maxlength: 400, hint: "Separated by commas."})}${submit("Save reviewers")}`
                    : null
            )
        )
    }
    blocks.push(h`${checksHtml(found, "SmithyMergeRequestChecks", c.base, true)}`)
    const box = agreementBox(c, shell, request)
    if (box) blocks.push(box)
    // mergeability and the merge box
    if (live) {
        const mergeForm = caps.canMerge
            ? h`<form method="get" action="${self}" id="SmithyMerge"><input type="hidden" name="confirm" value="merge">${select(formOf(c, ""), "mergeMethod", "Method", methods, {
                  value: m.mergeMethod || rules.defaultMergeMethod || methods[0][0],
                  hint: found.agreement?.required
                      ? "A squash is refused when it would put one person's signature of the agreement into another's commit: use a merge commit or a rebase then."
                      : null
              })}<label>Message <input name="message" maxlength="2000" placeholder="The default message"></label>${
                  ownBranch ? check("deleteSourceBranch", "Delete the source branch " + m.sourceRef + " after the merge", !!m.deleteSourceBranch) : ""
              }<p><button>Merge…</button></p>${hint(ec.l10n.localize("You are asked to confirm on the next page."))}</form>`
            : h`<p id="SmithyMergeWho">${shell.capabilities.signedIn ? "Merging to " + m.targetRef + " is for " + (rules.mergeRole === "developer" ? "a Developer" : "a Maintainer") + " of this repository or a higher role." : "A member with the role for it merges this."}</p>`
        blocks.push(
            h`<section class="card" id="SmithyMergeBox" aria-label="Merge"><p><strong>Merge</strong> ${
                m.mergeable === true ? "It merges cleanly." : m.mergeable === false ? "It has conflicts." : ""
            }</p>${blockers.length ? h`<ul id="SmithyMergeBlockers">${blockers.map(line => h`<li class="wrap">${line}</li>`)}</ul>` : ""}${mergeForm}</section>`
        )
    }
    // DG6: the forum topic that discusses the merge request, where the read gives one (a link card)
    const discussion = ec.resource
        .script("component://mr-pass/screen/Smithy/SmithyScope.js")
        .discussionCard(shell, found.discussion || m.discussion, bases, siteInfo)
    if (discussion) blocks.push(discussion)
    const issues = found.linkedIssues || []
    if (issues.length)
        blocks.push(
            h`<section class="card" id="SmithyMergeRequestIssues" aria-label="${ec.l10n.localize("Linked issues")}"><p><strong>Issues</strong></p>${issues.map(
                issue =>
                    h`<p class="wrap"><a href="${ru.u.section("issues")}/${issue.issueNumber}">#${issue.issueNumber}</a> ${issue.title || ""}${issue.state === "closed" ? h` <small class="smithy-chip">Closed</small>` : ""}</p>`
            )}</section>`
        )
    blocks.push(
        h`<section class="card" id="SmithyFetch" aria-label="Fetch"><p><strong>Fetch it</strong></p><pre class="smithy-pre"><code>git fetch origin ${m.fetchRef || "refs/merge-requests/" + number + "/head"}
git checkout FETCH_HEAD</code></pre></section>`
    )
    if (signedIn && root) {
        const preferences = maybe("getPreferences", {siteId, scopeType: "topic", scopeId: root})
        if (preferences) {
            const f = formOf(c, "setPreferences")
            const level = preferences.preferences?.watchLevel || "Normal"
            blocks.push(
                side(
                    "SmithyMergeRequestWatch",
                    "Notifications",
                    level,
                    h`${open(c, f, {plain: true})}${hidden("scopeType", "topic")}${hidden("scopeId", root)}${hidden("expectedRevision", preferences.revision ?? 0)}${select(f, "watchLevel", "Tell me about", WATCH, {value: level})}${submit("Save")}`
                )
            )
        }
    }
    return {
        html: h`<div class="smithy-issue"><div>${conversation}<span id="SmithyConversationEnd"></span>${form || ""}${
            signedIn && confirmed !== false ? reviewForm(c, shell, request, self + "#SmithyReview") : ""
        }${state}</div><aside class="smithy-side" aria-label="About this merge request">${blocks}</aside></div>${
            hasText ? issuePages.island(c, siteInfo, hasText, hasText.name === "publishPost" ? "Comment" : "Text") : ""
        }`.html
    }
}

/* MergeRequestCommits (design §9): the commits of the merge request, each with its checks and whether its author signed. */
function commits(shell, request, bases, siteInfo, self) {
    const c = contextOf(bases, siteInfo, self, shell.flash)
    const u = smithy.urls(c.base, shell.repository.repositoryPath)
    const found = need("getMergeRequestChanges", {
        siteId: shell.siteId,
        repositoryId: shell.repository.repositoryId,
        mergeRequestNum: request.number,
        withDiffs: false
    })
    const required = !!request.found.agreement?.required
    const rows = (found.commitList || []).map(item => {
        const row = smithy.commitRow(u, c.base, item)
        return h`<article class="card smithy-row"><p class="wrap"><a href="${row.href}">${row.summary || row.shortId}</a></p><p><small>${row.authorName}${
            row.authorHref ? h` <a href="${row.authorHref}">@${row.authorHandle}</a>` : ""
        } · ${row.date} · <a href="${row.href}"><code>${row.shortId}</code></a>${item.checkState ? " · checks " + checkText(item.checkState) : ""}${
            required && item.signed != null ? (item.signed ? " · author has signed" : " · author has not signed") : ""
        }</small></p></article>`
    })
    return {
        html: h`<section id="SmithyMergeRequestCommits" aria-label="${ec.l10n.localize("Commits")}">${rows.length ? rows : h`<p class="card">${ec.l10n.localize("No commits to show.")}</p>`}</section>`.html
    }
}
/* MergeRequestChecks (design §9): every status of the head by context, the required ones marked, and (DG5) the head's
 * pipeline runs with their jobs and failed tests, and Approve and run for a run that waits (SmithyPipelines.js). */
function checks(shell, request, bases, siteInfo, self) {
    const c = contextOf(bases || {smithy: shell.base}, siteInfo, self || "", shell.flash)
    const runs = (request.found.runList || []).length
        ? ec.resource.script("component://mr-pass/screen/Smithy/SmithyPipelines.js").requestRuns(c, shell, request)
        : ""
    return {html: h`${checksHtml(request.found, "SmithyChecks", shell.base)}${runs}`.html}
}

const diff = ec.resource.script("component://mr-pass/screen/Smithy/SmithyDiff.js")
const {diffLines, hunkLines} = diff
/* A line's key in the page: the file's place, the side (R the new text, L the old) and the line's number. */
const lineKey = (fileIndex, line) => "F" + fileIndex + (line.kind === "d" ? "L" + line.oldNo : "R" + line.newNo)
const LINE_KEY = /^F([1-9][0-9]{0,4})([LR])([1-9][0-9]{0,8})$/
/* One review thread: where it is, its marks, its comments, a reply form and Resolve or Reopen for who may. */
function threadHtml(c, o, thread) {
    const id = "thread-" + thread.threadId
    const reply = formOf(c, "createReviewComment", thread.threadId)
    const done = formOf(c, "resolveReviewThread", thread.threadId)
    const key = h`${hidden("repositoryId", o.repositoryId)}${hidden("mergeRequestNum", o.number)}${hidden("threadId", thread.threadId)}`
    const posts = (thread.postList || []).map(
        post =>
            h`<div class="smithy-post" id="post-${post.postId}"><p class="post-meta"><strong>${post.author?.handle ? "@" + post.author.handle : post.author?.displayName || "An account"}</strong> <small>· ${dateText(post.createdAt || post.entryDate)}${
                post.state === "pending" ? " · waiting for review" : ""
            }</small></p><div class="wrap smithy-body">${clean(post.body)}</div></div>`
    )
    const body = h`${posts}${
        o.canComment
            ? h`${open(c, reply, {plain: true, returnTo: o.self + "#" + id, successTo: o.self + "#" + id})}${key}${hidden("operationId", portal.operationId())}${hidden("sourceFormat", "markdown")}${textarea(reply, "body", "Reply", {rows: 2, maxlength: 100000, required: true})}<p><button>Reply</button></p></form>${open(c, done, {plain: true, returnTo: o.self + "#" + id})}${key}${hidden("resolved", thread.resolved ? "false" : "true")}<p><button>${thread.resolved ? "Reopen thread" : "Resolve thread"}</button></p></form>`
            : ""
    }`
    const where = "line " + (thread.newLine ?? thread.oldLine ?? "")
    const marks = h`${thread.outdated ? h` <small class="smithy-chip">Outdated</small>` : ""}${thread.resolved ? h` <small class="smithy-chip">Resolved</small>` : ""}`
    // an outdated or resolved thread is folded
    return thread.outdated || thread.resolved
        ? h`<details class="smithy-thread" id="${id}"${attributes({open: !!reply.error})}><summary>Comments on ${where}${marks}${thread.lineText ? h` <code>${String(thread.lineText).slice(0, 120)}</code>` : ""}</summary>${body}</details>`
        : h`<div class="smithy-thread" id="${id}"><p><small>Comments on ${where}</small></p>${body}</div>`
}
/* A file whose diff the page leaves out, and why: too large for the host to diff, too large for a page of files (a link
 * to the file alone), too large even alone (a link to the file), or no text change (a mode, an empty file). Also used by
 * a commit's and a comparison's Changes. */
// the most diff lines a file's own page shows at once; a longer diff is in parts
const PART_LINES = 10000
/* The lines of a file's diff the page of its part n (from 1) asks the authority for: only those are sent. */
const partAsk = n => ({diffLineOffset: (Math.max(1, n) - 1) * PART_LINES, diffLineLimit: PART_LINES})
/* The part the host sent of a file's diff ({total, offset}, for SmithyDiff.hunkPart), or null when it sent every line. */
const sentPart = fileDiff =>
    fileDiff?.diffLineCount != null ? {total: fileDiff.diffLineCount, offset: fileDiff.diffLineOffset || 0} : null
/* The links between the parts of a long diff: where this part is, and the parts before and after (href(n) for part n). */
function partsHtml(piece, href) {
    const n = piece.part + 1
    return h`<nav class="smithy-parts" aria-label="Diff parts">Part ${n} of ${piece.parts} (lines ${grouped(piece.part * PART_LINES + 1)}–${grouped(
        n * PART_LINES
    )} of the diff)${n > 1 ? h` <a href="${href(n - 1)}">Previous part</a>` : ""}${n < piece.parts ? h` <a class="smithy-btn" href="${href(n + 1)}">Next part</a>` : ""}</nav>`
}
const grouped = count => String(count).replace(/\B(?=([0-9]{3})+(?![0-9]))/g, ",")
function omitted(file, onePath, aloneHref, viewHref) {
    const changed = (Number(file.insertions) || 0) + (Number(file.deletions) || 0)
    const view = viewHref ? h` <a href="${viewHref}">${ec.l10n.localize("View file")}</a>` : ""
    if (file.tooLarge) return h`<p class="smithy-omitted">This file is too large to diff.${view}</p>`
    if (!changed) return h`<p class="smithy-omitted">${ec.l10n.localize("No text changes to show.")}</p>`
    if (!onePath) return h`<p class="smithy-omitted">Large diff: ${grouped(changed)} changed lines are not shown here. <a class="smithy-btn" href="${aloneHref}">Load diff</a>${view}</p>`
    return h`<p class="smithy-omitted">This diff is too large to show (${grouped(changed)} changed lines).${view}</p>`
}
/* MergeRequestChanges (design §9): the file tree, and each file's diff (SmithyDiff.js) as rows with both line numbers and
 * an anchor for each line, the changed words of a changed line marked, the unchanged lines between hunks as a link to them,
 * unified or (view=split) side by side, each file folded open in a <details>; a binary image as its two versions. The review
 * threads are at their lines (an outdated one above its file's diff, folded), with a reply form and Resolve per thread, and
 * "comment on this line": a line's number is a link (?line=) that shows the form under that line. Where JavaScript runs the
 * DiffReview island opens that form in place and shows a file in its editor's side-by-side view. */
function changes(shell, request, bases, siteInfo, self, asked) {
    const ask = name => (asked ? (asked[name] ?? null) : param(name))
    const c = contextOf(bases, siteInfo, self, shell.flash)
    const repositoryId = shell.repository.repositoryId
    const number = request.number
    const caps = request.found.capabilities || {}
    const live = ["open", "draft"].includes(request.found.mergeRequest.state)
    const canComment = !!caps.canComment && live && c.signedIn && shell.capabilities.confirmed !== false
    const onePath = ask("path")
    const split = ask("view") === "split"
    // a file alone shows its diff in parts of PART_LINES lines (part= counts from 1), and the host sends only that part's
    // lines: a whole file of 37,500 lines, made into values in each script that passed it on, could take the script's
    // memory past its limit for a page of 10,000 (SmithyDiffScale)
    const part = onePath ? Math.max(1, Number(ask("part")) || 1) : 1
    const found = need("getMergeRequestChanges", {
        siteId: shell.siteId,
        repositoryId,
        mergeRequestNum: number,
        withDiffs: true,
        ...(onePath ? {path: onePath, ...partAsk(part)} : {})
    })
    const u = smithy.urls(c.base, shell.repository.repositoryPath)
    const diffs = new Map((found.fileDiffList || []).map(d => [d.path, d]))
    // each file's hunks are let go once its rows are made
    found.fileDiffList = null
    const threads = found.threadList || []
    // the page's own address keeps the file asked for and the view; a line's link adds the line
    const keep = extra => self + query({path: onePath, view: split ? "split" : null, part: part > 1 ? part : null, ...extra})
    // a line's link is the page's address with line= last
    const linePrefix = keep({line: "X"}).replace(/X$/, "")
    const o = {repositoryId, number, canComment, self: keep({})}
    const wanted = LINE_KEY.exec(ask("line") || "")
    const islandFiles = []
    const fresh = formOf(c, "createReviewComment")
    const status = file => file.status || file.changeType || ""
    const files = (found.fileList || []).map((file, i) => {
        const index = i + 1
        // the page of one file shows that file alone (the file tree still lists them all)
        if (onePath && file.path !== onePath) return []
        const fileDiff = diffs.get(file.path)
        diffs.delete(file.path)
        const text = fileDiff?.unifiedDiff ?? fileDiff?.diff ?? null
        // the host's hunks, as data (never its markup); a unified text where that is what there is
        let hunks = fileDiff?.hunks?.length ? fileDiff.hunks : null
        if (fileDiff) fileDiff.hunks = null
        const piece = onePath && hunks ? diff.hunkPart(hunks, part - 1, PART_LINES, sentPart(fileDiff)) : null
        const lines = diff.marked(piece ? piece.lines : hunks ? hunkLines(hunks) : text ? diffLines(text) : [])
        // the host's lines go once the page's are made (a part of a large file holds no more than it must)
        hunks = null
        const parts = piece && piece.parts > 1 ? partsHtml(piece, n => keep({part: n > 1 ? n : null}) + "#file-" + index) : ""
        const before = diff.gaps(lines)
        const deleted = /^(deleted|delete|removed|D)$/i.test(status(file))
        const added = /^(added|add|new|A)$/i.test(status(file))
        const fileHref = found.headCommitId && !deleted ? line => u.blob(found.headCommitId, file.path) + "#L" + line : null
        const mine = threads.filter(thread => thread.path === file.path)
        // the keys of the lines shown, for the threads to find theirs: made only for a file with threads
        const keys = mine.length
            ? new Set(lines.filter(line => line.kind !== "h" && line.kind !== "m").map(line => lineKey(index, line)))
            : null
        const at = new Map()
        const above = []
        for (const thread of mine) {
            const key = thread.outdated ? null : thread.newLine != null && keys.has("F" + index + "R" + thread.newLine) ? "F" + index + "R" + thread.newLine : thread.oldLine != null && keys.has("F" + index + "L" + thread.oldLine) ? "F" + index + "L" + thread.oldLine : null
            if (key) at.set(key, [...(at.get(key) || []), thread])
            // a part of a long diff has the threads of its lines; the first part has the outdated ones and the rest
            else if (!piece || piece.part === 0) above.push(thread)
        }
        // what follows a line: its threads and, for the line asked for, the comment form (markup, or "" for most lines)
        const follow = (key, line, shown) => {
            const here = at.get(key)
            const formHere = canComment && wanted && wanted[0] === key
            if (!here && !formHere) return ""
            return h`${(here || []).map(thread => threadHtml(c, o, thread))}${
                formHere
                    ? h`${open(c, fresh, {returnTo: keep({line: key}) + "#" + fresh.id, successTo: o.self + "#" + key})}${hidden("repositoryId", repositoryId)}${hidden("mergeRequestNum", number)}${hidden(
                          "commitId",
                          found.headCommitId || ""
                      )}${hidden("path", file.path)}${hidden(line.kind === "d" ? "oldLine" : "newLine", shown)}${hidden("operationId", portal.operationId())}${hidden("sourceFormat", "markdown")}${textarea(
                          fresh,
                          "body",
                          "Comment on line " + shown + " of " + file.path,
                          {rows: 3, maxlength: 100000, required: true, hint: "Markdown."}
                      )}<p><button>Comment</button> <a href="${o.self}#${key}">Cancel</a></p></form>`
                    : ""
            }`.html
        }
        // a line's number: the link to its comment form, or to itself. The rows are built as strings (a page of many
        // thousand lines stays inside the script's memory); every text in them is escaped by diff.esc.
        const lineHref = canComment ? diff.esc(linePrefix) : ""
        const numberLink = (key, shown, id) =>
            '<a class="n"' + (id ? ' id="' + key + '"' : "") + ' href="' + (canComment ? lineHref + key + "#" + key : "#" + key) + '"' +
            (canComment ? ' data-line="' + key + '" aria-label="Comment on line ' + shown + '"' : ' aria-label="Line ' + shown + '"') + ">" + shown + "</a>"
        const out = []
        if (!split) {
            lines.forEach((line, li) => {
                if (before.has(li)) out.push(diff.gapHtml(before.get(li), fileHref))
                if (line.kind === "h") return out.push('<div class="l h">' + diff.hunkHtml(line.text) + "</div>")
                if (line.kind === "m") return out.push('<div class="l m">' + diff.esc(line.text) + "</div>")
                const key = lineKey(index, line)
                const shown = line.kind === "d" ? line.oldNo : line.newNo
                const sign = line.kind === "a" ? "+" : line.kind === "d" ? "-" : " "
                // the other side's number, after the link; the style puts the old side's number first
                const other = line.kind === "c" ? line.oldNo : ""
                out.push('<div class="l ' + line.kind + '" id="' + key + '">' + numberLink(key, shown, false) + '<span class="o">' + other + "</span>" + sign + line.html + "</div>" + follow(key, line, shown))
            })
        } else {
            for (const row of diff.splitRows(lines)) {
                if (row.kind === "h") {
                    if (before.has(row.index)) out.push(diff.gapHtml(before.get(row.index), fileHref, true))
                    out.push('<div class="sr h">' + diff.hunkHtml(row.line.text) + "</div>")
                    continue
                }
                if (row.kind === "m") {
                    out.push('<div class="sr m">' + diff.esc(row.line.text) + "</div>")
                    continue
                }
                const half = (line, side) => {
                    if (!line) return '<span class="n e"></span><span class="t e"></span>'
                    const shown = side === "L" ? line.oldNo : line.newNo
                    const cls = line.kind === "c" ? "c" : side === "L" ? "d" : "a"
                    return numberLink("F" + index + side + shown, shown, true) + '<span class="t ' + cls + '">' + line.html + "</span>"
                }
                // a context line's threads are on its new side
                const both = row.left && row.right && row.left === row.right
                out.push(
                    '<div class="sr">' + half(row.left, "L") + half(row.right, "R") + "</div>" +
                        (row.left && !both ? follow("F" + index + "L" + row.left.oldNo, {...row.left, kind: "d"}, row.left.oldNo) : "") +
                        (row.right ? follow("F" + index + "R" + row.right.newNo, row.right, row.right.newNo) : "")
                )
            }
        }
        islandFiles.push({index, path: file.path, oldPath: file.oldPath || file.path, status: status(file), binary: !!file.binary})
        const image = file.binary && diff.IMAGE.test(file.path)
        // a file's markup is a list of pieces, its rows as they were made, joined once for the whole page: a part of
        // 10,000 lines is megabytes of markup, and each template it went through held another whole copy of it, which
        // took the script past its memory limit (SmithyDiffScale)
        const body = out.length
            ? null
            : image
              ? new Markup(
                    diff.imageHtml(
                        !added && found.mergeBaseId ? u.raw(found.mergeBaseId, file.oldPath || file.path) : null,
                        !deleted && found.headCommitId ? u.raw(found.headCommitId, file.path) : null,
                        file.path
                    )
                )
              : file.binary
                ? h`<p>${ec.l10n.localize("Binary file.")}</p>`
                : omitted(file, onePath, keep({path: file.path}) + "#file-" + index, fileHref ? u.blob(found.headCommitId, file.path) : null)
        const head = h`<section class="card smithy-file" id="file-${index}"><details open><summary><h3 class="wrap">${file.oldPath && file.oldPath !== file.path ? file.oldPath + " → " : ""}${file.path} <small>${status(file)}</small> ${new Markup(
            diff.statHtml(file.insertions, file.deletions)
        )} <span data-smithy-tools="${index}"></span>${fileHref ? h` <a class="smithy-viewfile" href="${u.blob(found.headCommitId, file.path)}">${ec.l10n.localize("View file")}</a>` : ""}</h3></summary>${above.map(thread =>
            threadHtml(c, o, thread)
        )}${parts}`.html
        const tail = h`${parts}</details></section>`.html
        if (body) return [head + body.html + tail]
        out.unshift(head + h`<div class="${split ? "smithy-split" : "smithy-lines"}" data-file="${index}">`.html)
        out.push(h`</div><div data-smithy-side="${index}"></div>`.html + tail)
        return out
    })
    const config = {
        doUrl: c.base + "/-/do/createReviewComment",
        returnTo: o.self,
        repositoryId,
        mergeRequestNum: number,
        commitId: found.headCommitId || "",
        canComment,
        // each side of a file is its raw text at the merge base and at the head
        oldRaw: found.mergeBaseId ? u.section("raw", found.mergeBaseId) : null,
        newRaw: found.headCommitId ? u.section("raw", found.headCommitId) : null,
        files: islandFiles
    }
    const count = (found.fileList || []).length
    const viewLink = (value, label) =>
        h`<a href="${self + query({path: onePath, view: value})}"${attributes({"aria-current": (value === "split") === split ? "true" : null})}>${label}</a>`
    const threadCount = file => threads.filter(thread => thread.path === file.path && !thread.resolved).length
    const before = h`<section id="SmithyChanges" aria-label="${ec.l10n.localize("Changed files")}"><div class="smithy-difftools"><h3>${count === 1 ? ec.resource.expand("${count} file changed", "", {count: count}) : ec.resource.expand("${count} files changed", "", {count: count})} <small>+${Number(found.insertions) || 0} −${Number(found.deletions) || 0}</small></h3><nav aria-label="${ec.l10n.localize("Diff view")}" class="smithy-seg">${viewLink(null, "Unified")}${viewLink("split", "Split")}</nav></div>${
            found.truncated && !onePath ? h`<p class="card">${ec.l10n.localize("This change is large; only part of its diff is shown.")}</p>` : ""
        }${onePath ? h`<p><a href="${self + query({view: split ? "split" : null})}">${ec.l10n.localize("Show every file")}</a></p>` : ""}<div class="smithy-review"><nav aria-label="Files" class="smithy-filetree"><ul class="card" id="SmithyFileList">${(found.fileList || []).map(
            (file, i) =>
                h`<li class="wrap"><a href="${onePath && file.path !== onePath ? self + query({path: file.path, view: split ? "split" : null}) : ""}#file-${i + 1}" title="${file.path}"><span class="st st-${String(status(file)).toLowerCase()}" aria-hidden="true"></span>${file.path}</a> <small>${status(file)} +${Number(file.insertions) || 0} −${Number(file.deletions) || 0}${
                    threadCount(file) ? h` · ${threadCount(file)} ${threadCount(file) === 1 ? "thread" : "threads"}` : ""
                }</small></li>`
        )}</ul></nav><div class="smithy-filelist">`.html
    const after = h`</div></div></section>${c.signedIn && shell.capabilities.confirmed !== false ? reviewForm(c, shell, request, o.self + "#SmithyReview") : ""}<div id="SmithyDiffReview"></div>${issuePages.islandOf(
            "SmithyDiffReview",
            "DiffReview",
            c,
            siteInfo,
            config,
            {scripts: ["/js/WebrootCode.js"], loading: "Loading the diff tools"}
        )}`.html
    const pieces = [before]
    for (const file of files) for (const piece of file) pieces.push(piece)
    pieces.push(after)
    return {html: pieces.join("")}
}

/* Fork (design §9 Fork), at -/fork and -/forks: the form that makes a fork in the caller's namespace or in a group where it
 * may create (the page is the confirmation: it names the source and where the fork goes), and the repository's forks the
 * caller may view. */
function fork(shell, bases, siteInfo, self) {
    const c = contextOf(bases, siteInfo, self, shell.flash)
    const siteId = shell.siteId
    const repository = shell.repository
    const u = smithy.urls(c.base, repository.repositoryPath)
    const listing = smithy.sectionWord(self) === "forks"
    if (listing) {
        const cursor = param("cursor")
        const found = need("findForks", {siteId, repositoryId: repository.repositoryId, limit: 30, ...(cursor ? {cursor} : {})})
        const rows = (found.repositoryList || []).map(
            r =>
                h`<article class="card smithy-row"><h3 class="wrap"><a href="${c.base}/${enc(r.repositoryPath)}">${r.repositoryPath}</a>${
                    r.effectiveVisibility && r.effectiveVisibility !== "public" ? h` <small class="smithy-chip">${r.effectiveVisibility}</small>` : ""
                }</h3>${r.description ? h`<p>${r.description}</p>` : ""}<p><small><a href="${u.section("compare", r.repositoryPath + ":" + (r.defaultBranch || repository.defaultBranch || "main"))}">Compare with this repository</a></small></p></article>`
        )
        return {
            html: h`<h2>Forks of ${repository.repositoryPath}</h2><section id="SmithyForkList" aria-label="Forks">${
                rows.length ? rows : h`<p class="card">No forks to show.</p>`
            }</section>${found.nextCursor ? h`<p><a href="${u.section("forks")}${query({cursor: found.nextCursor})}">More forks</a></p>` : ""}${
                shell.forkHref ? h`<p><a href="${u.section("fork")}">Fork this repository</a></p>` : ""
            }`.html
        }
    }
    const head = h`<h2>Fork ${repository.repositoryPath}</h2>`
    const closed = gate(c, c.signedIn ? shell.capabilities.confirmed : null)
    if (closed) return {html: h`${head}${closed}`.html}
    if (shell.capabilities.canFork === false)
        return {html: h`${head}<p class="card" id="SmithyNoAccess">You cannot fork this repository: the site's policy for forks does not allow it for your account.</p>`.html}
    const groups = maybe("findGroups", {siteId, mine: true, limit: 100})?.groupList || []
    const handle = siteInfo.profile?.handle
    // reached by a merge request's Sign (a fork's own file is the agreement's file of its parent's merge request)
    const signing = /^[1-9][0-9]{0,8}$/.test(param("sign") || "") ? param("sign") : null
    const f = formOf(c, "forkRepository")
    const ceiling = repository.effectiveVisibility || repository.visibility || "private"
    return {
        html: h`${head}${open(c, f)}<p>A fork is your own copy of ${repository.repositoryPath}, with its branches and tags. It shares the objects it has in common, and is no wider than this repository. Work in it, then open a merge request back here.</p>${hidden("repositoryId", repository.repositoryId)}${hidden(
            "operationId",
            portal.operationId()
        )}${select(f, "targetGroupId", "Namespace", [["", handle ? "Your own: " + handle : "Your own namespace"], ...groups.map(g => [g.groupId, g.groupPath])], {
            hint: "A group's fork needs its Maintainer." + (handle ? "" : " Choose a handle in your account before making one of your own.")
        })}${input(f, "slug", "Path", {
            value: repository.slug || "",
            required: true,
            maxlength: 100,
            pattern: "[a-z0-9_][a-z0-9_.\\-]{0,99}",
            autocomplete: "off"
        })}${input(f, "name", "Name", {value: repository.name || "", maxlength: 255})}${select(f, "visibility", "Visibility", forms.visibilities(ceiling), {
            value: ceiling,
            hint: "A fork is no wider than its parent or its namespace."
        })}<p><button>${ec.l10n.localize("Fork")}</button> <a href="${u.root}">Cancel</a></p></form><p><a href="${u.section("forks")}">Forks of this repository</a></p>`.html
    }
}

const ACTIONS = {edit: "update", new: "create", upload: "upload", delete: "delete"}
const DESTINATION_TEXT = {
    branch: (ctx, d) => ec.resource.expand("Commit to ${branch}.", "", {branch: d.branchName || ctx.ref?.name || ec.l10n.localize("the branch")}),
    newBranch: ctx => ec.resource.expand(ctx.protected ? "Commit to a new branch and open a merge request to ${branch}, which is protected." : "Commit to a new branch and open a merge request to ${branch}.", "", {branch: ctx.ref?.name || ec.l10n.localize("the branch")}),
    proposal: ctx => ec.resource.expand("Propose the change: it is kept with a merge request to ${branch}, which opens at once. No fork is needed.", "", {branch: ctx.ref?.name || ec.l10n.localize("the branch")})
}
/* A block of text for a page, with its lines numbered by nothing: escaped, in a scrolling box. */
const textBox = (id, title, text) => h`<section class="card" id="${id}"><h3>${title}</h3><pre class="smithy-code"><code>${text}</code></pre></section>`
/* Edit (design §9.5, §9 Edit), at -/edit/<refPath> and -/new, -/upload, -/delete: a file's text in a textarea (the Editor
 * island makes it a code editor), a preview for Markdown, then the save step on a page of its own: the commit's message
 * and where it goes, the destinations getEditContext lists with the default first (the branch; a new branch with a merge
 * request; a proposal). The form carries the blob it started from; when the file changed since, the page shows both texts
 * and asks. What a step leaves for the next (the text, the choices, a refusal) is in the session for that one page. */
function edit(shell, refPath, editAction, bases, siteInfo, self) {
    const c = contextOf(bases, siteInfo, self, shell.flash)
    const siteId = shell.siteId
    const repository = shell.repository
    const u = smithy.urls(c.base, repository.repositoryPath)
    const action = Object.hasOwn(ACTIONS, editAction) ? editAction : fail()
    const title = {edit: "Edit", new: "New file", upload: ec.l10n.localize("Upload a file"), delete: "Delete"}[action]
    const closed = gate(c, c.signedIn ? shell.capabilities.confirmed : null)
    if (closed) return {html: h`<h2>${title}</h2>${closed}`.html}
    const ctx = need("getEditContext", {siteId, repositoryId: repository.repositoryId, refPath, editAction: ACTIONS[action]})
    const branch = ctx.ref?.name || ""
    const path = ctx.path || ""
    const fileHref = action === "edit" || action === "delete" ? u.blob(branch, path) : u.tree(branch, path)
    const head = h`<h2 class="wrap">${title}${action === "edit" || action === "delete" ? " " + path : path ? " in " + path : ""} <small>on ${branch}</small></h2>`
    if (ctx.editable === false)
        return {
            html: h`${head}<p class="card" id="SmithyNotEditable">${NOT_EDITABLE[ctx.reason] || "This file is not edited on its page."} <a href="${fileHref}">Back</a></p>`.html
        }
    const flash = c.flash
    // what a step left is this page's only when it is of this repository, branch and path (a new file's and an upload's
    // path is under the page's directory)
    const kept = flash.values || {}
    const here =
        kept.repositoryId === repository.repositoryId &&
        kept.branch === branch &&
        (action === "edit" || action === "delete"
            ? kept.path === path
            : kept.path === path || String(kept.path || "").startsWith(path ? path + "/" : ""))
    const ours = ["editFile", "commitFile"].includes(flash.form) && here
    const refused = ours ? flash.error || null : null
    // the forms of this page read the flash only when it is this page's
    const cx = ours ? c : {...c, flash: {}}
    const typed = (name, fallback) => (ours && flash.values && Object.hasOwn(flash.values, name) ? flash.values[name] : (fallback ?? ""))
    const destinations = (ctx.destinationList || []).filter(d => Object.hasOwn(DESTINATION_TEXT, d.destination))
    if (!destinations.length)
        return {html: h`${head}<p class="card" id="SmithyNotEditable">You cannot change this file here. <a href="${fileHref}">Back</a></p>`.html}
    const stepUrl = c.base + "/-/do/editFile"
    const startPath = action === "new" || action === "upload" ? (path ? path + "/" : "") : path
    const carried = h`${hidden("repositoryId", repository.repositoryId)}${hidden("branch", branch)}${hidden("action", ACTIONS[action])}${hidden("path", path)}`
    // the agreement's file: how to sign it (the account types its own line; nothing is written for it)
    const handle = siteInfo.profile?.handle
    // reached by a merge request's Sign (a fork's own file is the agreement's file of its parent's merge request)
    const signing = /^[1-9][0-9]{0,8}$/.test(param("sign") || "") ? param("sign") : null
    const sign =
(ctx.agreementFile || signing) && action === "edit"
            ? h`<section class="card" id="SmithySignHelp"><h3>Signing this file</h3><p>To sign, add one line of your own at the end of <strong>both</strong> lists, the one under “Copyright Waiver” and the one under “Grant of Patent License”, each in this form:</p><pre class="smithy-pre"><code>- Written in ${new Date().getFullYear()} by &lt;your legal name&gt; - ${handle || "<your handle>"}</code></pre><p>Type your legal name yourself, and leave every other line as it is. The save is a commit by your account, which is what makes the signature yours${
                  signing ? h`; it goes with merge request !${signing}, or opens one of its own when you may not push there` : ""
              }.</p></section>`
            : ""

    // the file changed since the edit began: both texts, and what to do
    // (an edit's only: a new file or an upload at a path that has a file is told so on the save step)
    if (ours && flash.form === "commitFile" && refused?.reason === "fileChanged" && action === "edit") {
        const stay = formOf(cx, "editFile", "conflict")
        return {
            html: h`${head}<p role="alert" class="error" id="SmithyConflict">This file was changed on ${branch} after you opened it. Nothing was saved. Compare the two texts, then choose.</p>${textBox("SmithyConflictTheirs", "The file now", ctx.text ?? "")}${textBox("SmithyConflictMine", "Your text", typed("content", ""))}<form method="post" class="card" id="${stay.id}" action="${stepUrl}">${hidden("moquiSessionToken", ec.web.sessionToken)}${hidden("returnTo", self)}${carried}${hidden("baseBlobId", ctx.blobId || "")}${hidden("newPath", typed("newPath", typed("path", path)))}<textarea name="content" hidden>${"\n"}${typed("content", "")}</textarea>${hidden("message", typed("message", ""))}<p><button name="stage" value="edit">Keep editing my text</button> <button name="stage" value="save">Save my text over the file as it is now</button> <a href="${self}">Discard my text and start from the file now</a></p></form>`
                .html
        }
    }

    // the save step: after the editor's Continue, after a refusal of the save, and at once for a delete
    const saving = action === "delete" || (ours && (flash.form === "commitFile" || flash.stage === "save") && !flash.preview)
    if (saving) {
        // the refusal of another page's save is not this one's
        const f = formOf(cx, "commitFile")
        const newPath = String(typed("newPath", flash.form === "commitFile" ? typed("path", startPath) : startPath)).replace(/^\/+/, "")
        const renamed = action === "edit" && newPath && newPath !== path
        const final = action === "edit" ? (renamed ? "rename" : "update") : ACTIONS[action]
        const target = action === "edit" ? path : newPath
        const message =
            {update: "Update " + path, rename: "Rename " + path + " to " + newPath, create: "Create " + newPath, upload: "Upload " + newPath, delete: "Delete " + path}[final] || ""
        const chosen = typed("destination", (destinations.find(d => d.default) || destinations[0]).destination)
        const suggested = destinations.find(d => d.destination === "newBranch")?.branchName || ctx.suggestedBranch || ""
        const opensRequest = destinations.some(d => d.destination !== "branch")
        // an upload to a path that has a file replaces it: the save names the blob that is there now, and says so. A new
        // file at such a path is refused (a file is at that path)
        const existing =
            final === "upload" && newPath && !newPath.endsWith("/")
                ? maybe("getEditContext", {siteId, repositoryId: repository.repositoryId, refPath: branch + "/" + newPath, editAction: "update"})
                : null
        const taken = f.error && ["nameTaken", "fileChanged"].includes(refused?.reason) && (final === "create" || final === "upload")
        if (taken) f.error = {...f.error, message: final === "upload" ? ec.l10n.localize("A file is at that path now. Commit again to replace it, or choose another path.") : ec.l10n.localize("A file is at that path. Choose another path.")}
        // the blob the save starts from: the file as it is now after a refusal that it changed (a delete asks again so),
        // the file an upload replaces, else what the edit began with
        const baseBlobId =
            final === "upload" ? existing?.blobId || "" : refused?.reason === "fileChanged" ? ctx.blobId || "" : typed("baseBlobId", ctx.blobId || "")
        return {
            html: h`${head}${open(cx, f, {title: "Save as a commit"})}${hidden("repositoryId", repository.repositoryId)}${hidden("branch", branch)}${hidden("action", final)}${hidden(
                "path",
                target
            )}${renamed ? hidden("newPath", newPath) : ""}${hidden("baseBlobId", baseBlobId)}${typed("attachmentId", "") ? hidden("attachmentId", typed("attachmentId", "")) : ""}${hidden(
                "operationId",
                portal.operationId()
            )}${final === "delete" || final === "upload" ? "" : h`<textarea name="content" hidden>${"\n"}${typed("content", ctx.text ?? "")}</textarea>`}<p id="SmithySaveWhat">${
                final === "delete"
                    ? h`This deletes <strong>${path}</strong> from ${branch}.`
                    : final === "rename"
                      ? h`This saves <strong>${path}</strong> as <strong>${newPath}</strong>.`
                      : existing?.blobId
                        ? h`This <strong>replaces</strong> the file <strong>${newPath}</strong> that is on ${branch} now${typed("fileName", "") ? " with " + typed("fileName", "") : ""}.`
                        : h`This saves <strong>${newPath || path}</strong>${final === "upload" && typed("fileName", "") ? " (" + typed("fileName", "") + ")" : ""}.`
            }</p>${input(f, "message", "Commit message", {value: typed("message", "") || message, required: true, maxlength: 2000})}<fieldset id="SmithyDestinations"><legend>Where it goes</legend>${destinations.map(
                d =>
                    h`<label><input type="radio" name="destination" value="${d.destination}"${attributes({checked: d.destination === chosen})}> ${DESTINATION_TEXT[d.destination](ctx, d)}</label>`
            )}</fieldset>${
                destinations.some(d => d.destination === "newBranch")
                    ? input(f, "newBranchName", "Name of the new branch", {value: typed("newBranchName", "") || suggested, maxlength: 250, hint: "Used when you commit to a new branch."})
                    : ""
            }${opensRequest ? input(f, "mergeRequestTitle", "Title of the merge request", {value: typed("mergeRequestTitle", ""), maxlength: 250, hint: "Empty: the commit message."}) : ""}<p><button>Commit</button>${
                action === "delete" ? "" : h` <button formaction="${stepUrl}" formnovalidate name="stage" value="edit">Back to the text</button>`
            } <a href="${fileHref}">Cancel</a></p></form>`.html
        }
    }

    // the editor
    const f = formOf(cx, "editFile")
    const markdown = /\.(?:md|markdown)$/i.test(String(typed("newPath", startPath)))
    const start = h`<form method="post" class="card" id="${f.id}" action="${stepUrl}"${attributes({enctype: action === "upload" ? "multipart/form-data" : null})}>${
        f.error ? h`<p role="alert" class="error" id="${f.id}_error">${f.error.message}</p>` : ""
    }${hidden("moquiSessionToken", ec.web.sessionToken)}${hidden("returnTo", self)}${carried}${hidden("baseBlobId", typed("baseBlobId", ctx.blobId || ""))}${input(f, "newPath", action === "edit" ? "Path (change it to rename the file)" : "Path of the file", {
        value: startPath,
        required: action !== "upload",
        maxlength: 1000,
        autocomplete: "off",
        hint: action === "upload" ? "Empty, or ending in a slash: the uploaded file's own name is added." : null
    })}`
    if (action === "upload")
        return {
            html: h`${head}${start}<label>File * <input type="file" name="file" required></label>${hint("At most " + smithy.sizeText(ctx.maxEditBytes || 1048576) + ". A larger file is pushed with git and Git LFS.")}<p><button name="stage" value="save">Continue</button> <a href="${fileHref}">Cancel</a></p></form>`
                .html
        }
    return {
        html: h`${head}${sign}${start}${
            f.preview ? h`<section class="smithy-preview" id="${f.id}_preview" aria-label="Preview"><h3>Preview</h3><div class="wrap">${new Markup(f.preview)}</div></section>` : ""
        }${hidden("sourceFormat", "markdown")}<label>Text <textarea name="content" rows="24" spellcheck="false" class="smithy-editor">${"\n"}${typed("content", ctx.text ?? "")}</textarea></label><div id="SmithyEditor" style="display:none"></div><p><button name="stage" value="save">Continue to save…</button>${
            markdown ? h` <button formaction="${c.base}/-/do/previewPost" formnovalidate name="previewOf" value="editFile">Preview</button>` : ""
        } <a href="${fileHref}">Cancel</a></p>${hint("The next page asks for the commit message and where the commit goes.")}</form>${issuePages.islandOf(
            "SmithyEditor",
            "Editor",
            c,
            siteInfo,
            {formId: f.id, fileName: String(typed("newPath", startPath))},
            {scripts: ["/js/WebrootCode.js"], loading: "Loading the editor"}
        )}`.html
    }
}

const SETTINGS = [
    ["inherit", ec.l10n.localize("Inherit: as the group above says")],
    ["off", ec.l10n.localize("Off: no agreement is required")],
    ["required", ec.l10n.localize("Required: every author signs the file")]
]
/* The Agreement tab of a group's or a repository's Settings (design §9.4, §11), for an Owner: inherit, off or required, the
 * file's path, what is in effect and where it comes from, and the branch rules the change touches. target is {groupId} or
 * {repositoryId}; head the tab's heading and its tabs, root the tab's address. */
function agreementSettings(target, name, head, bases, siteInfo, self, flash, confirmed) {
    const c = contextOf(bases, siteInfo, self, flash)
    const siteId = target.siteId
    const id = target.groupId ? {groupId: target.groupId} : {repositoryId: target.repositoryId}
    const found = need("getAgreement", {siteId, ...id})
    const closed = gate(c, confirmed)
    const f = formOf(c, "setAgreement")
    const now = h`<section class="card" id="SmithyAgreementNow"><p>In effect for ${name}: <strong>${found.effective === "required" ? "required" : "off"}</strong>${
        found.setting === "inherit" && found.inheritedFromPath ? " (from " + found.inheritedFromPath + ")" : ""
    }. The file is <code>${found.agreementPath || "AUTHORS.md"}</code>.</p><p>When it is required, a merge request is merged only when its author and the author of each of its commits has signed the file under both of its lists, each by a commit of their own account. The check <code>agreement/authors</code> is then required by the branch rule of the default branch and by every rule that asks for a merge request${
        found.changedRuleCount != null ? " (" + found.changedRuleCount + (Number(found.changedRuleCount) === 1 ? " rule" : " rules") + " would change)" : ""
    }.</p></section>`
    return {
        html: h`${new Markup(head)}${now}${
            closed ||
            h`${open(c, f, {title: "Agreement"})}${Object.entries(id).map(([field, value]) => hidden(field, value))}${hidden("expectedRevision", found.revision)}${select(f, "setting", "Contributor agreement", SETTINGS, {
                value: found.setting || "inherit"
            })}${input(f, "agreementPath", "The file", {value: found.agreementPath || "AUTHORS.md", required: true, maxlength: 250, hint: ec.l10n.localize("Its path in the repository. It must be there before the agreement is required.")})}${submit("Save")}`
        }`.html
    }
}
;({
    urlsOf,
    mergeRequests,
    newMergeRequest,
    requestShell,
    overview,
    commits,
    changes,
    checks,
    fork,
    edit,
    agreementSettings,
    diffLines,
    omitted,
    partsHtml,
    PART_LINES,
    partAsk,
    sentPart,
    lineKey
})
