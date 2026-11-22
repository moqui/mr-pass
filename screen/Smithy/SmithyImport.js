/* Smithy's GitHub import and push mirrors (Dogfood DG8; plan/design-smithy.md §6 GroupSettings, §11 RepositorySettings and
 * Import, §18.2): the Import tab of a group's Settings (the start form and the group's imports), an import's own page
 * (B/import/<importId>: its stage, counts, the rate limit's wait, what could not be carried, Resume and Cancel), the site's
 * imports for an operator (B/import), and the Mirrors tab of a repository's Settings. Every read and write is the
 * authority's (Mantle's SmithyImport.js through pass.Facade.call#Operation), which checks the group's Owner (or an operator)
 * and the repository's Maintainer; a page leaves out only what would be refused, and what the caller may not see is Not
 * Found. A GitHub token and a mirror's secret are write-only: no page writes one back, the form's post keeps none for the
 * next page (SmithyForms.js SECRET) and none is ever in an address. Pages are plain HTML built as escaped markup
 * (SmithyForms.js h), and the forms post to Smithy/Do with the session token. CC0 plus patent grant. */
const smithy = ec.resource.script("component://mr-pass/screen/Smithy/Smithy.js")
const forms = ec.resource.script("component://mr-pass/screen/Smithy/SmithyForms.js")
const {portal, fail, need, maybe, param, enc, query, dateText} = smithy
const {h, attributes, hidden, contextOf, banner, formOf, open, input, select, check, submit, hint, confirmCard} = forms

/* A time as the pages show it, to the minute, in the signed-in account's time zone. */
function timeText(value) {
    if (value == null || value === "") return ""
    const time =
        typeof value === "number"
            ? value
            : typeof value.getTime === "function"
              ? value.getTime()
              : /^[0-9]{9,}$/.test(String(value))
                ? Number(value)
                : (ec.user.timestampMillis(value) ?? Date.parse(String(value)))
    return Number.isFinite(time) ? String(ec.l10n.format(new Date(time), "yyyy-MM-dd HH:mm")) : String(value)
}

// ===== the import =====
const STAGES = {
    queued: ec.l10n.localize("Waiting to start"),
    labels: ec.l10n.localize("Importing labels and milestones"),
    issues: ec.l10n.localize("Importing issues"),
    pulls: ec.l10n.localize("Importing pull requests"),
    comments: ec.l10n.localize("Importing comments and reviews"),
    links: ec.l10n.localize("Linking references"),
    done: "Done",
    failed: ec.l10n.localize("Stopped by a problem"),
    cancelled: "Stopped"
}
const ENDED = ["done", "failed", "cancelled"]
const stageText = stage => STAGES[stage] || stage || "Unknown"
const TYPES = {
    label: "Labels",
    milestone: "Milestones",
    issue: "Issues",
    pull: ec.l10n.localize("Pull requests"),
    comment: "Comments",
    review: "Reviews",
    reviewComment: ec.l10n.localize("Line comments"),
    reaction: "Reactions",
    user: "People"
}
const importPage = (c, importId) => c.base + "/import/" + encodeURIComponent(importId)
/* The list of imports: each its source, the repository, its stage and when it started. */
function importRows(c, list, empty) {
    return list.length
        ? h`<ul class="smithy-imports">${list.map(
              run =>
                  h`<li class="wrap smithy-row" id="SmithyImport_${run.importId}"><a href="${importPage(c, run.importId)}">${run.sourceRepository}</a>${
                      run.repositoryPath ? h` into <code>${run.repositoryPath}</code>` : ""
                  } <small class="smithy-chip">${stageText(run.stage)}</small> <small>started ${dateText(run.createdAt)}${
                      run.finishedAt ? " · ended " + dateText(run.finishedAt) : ""
                  }</small></li>`
          )}</ul>`
        : h`<p>${empty}</p>`
}
/* The Import tab of a group's Settings (design §6 GroupSettings, §11 Import), for its Owners and operators (the Settings page
 * is Not Found for anyone else): the start form, in place of which an account without a confirmed address is told to confirm
 * it (closed), and the group's imports. */
function groupImport(shell, head, c, closed) {
    const siteId = shell.siteId
    const g = shell.group
    const tabPath = shell.root + "/-/settings/import"
    const cursor = param("cursor")
    const found = need("findGitHubImports", {siteId, groupId: g.groupId, limit: 20, ...(cursor ? {cursor} : {})})
    const repositories = (
        maybe("findRepositories", {siteId, groupId: g.groupId, sort: "name", limit: 100})?.repositoryList || []
    ).filter(r => !r.mirror && !r.archived)
    const f = formOf(c, "startGitHubImport")
    const startForm = h`${open(c, f, {title: "Import from GitHub", returnTo: tabPath})}${hidden("groupId", g.groupId)}${hidden(
        "operationId",
        portal.operationId()
    )}<p>Brings a GitHub repository's labels, milestones, issues and pull requests into a repository of this group, with their numbers, comments, reviews and final states. People are shown by their GitHub login until they sign in here with GitHub. The code itself is pushed with git.</p>${input(
        f,
        "sourceRepository",
        "GitHub repository",
        {
            required: true,
            maxlength: 201,
            pattern: "[A-Za-z0-9_.\\-]{1,100}/[A-Za-z0-9_.\\-]{1,100}",
            autocomplete: "off",
            placeholder: "owner/name",
            hint: "Its owner and name, as in github.com/owner/name."
        }
    )}${input(f, "token", "GitHub token", {
        type: "password",
        secret: true,
        required: true,
        maxlength: 1000,
        autocomplete: "off",
        hint: "A token that may read the repository. It is kept encrypted while the import runs and dropped when it ends; it is not shown again."
    })}${select(
        f,
        "repositoryId",
        "Into",
        [["", "A new repository of this group"], ...repositories.map(r => [r.repositoryId, r.repositoryPath])],
        {
            value: "",
            hint: "A repository that has issues or merge requests of its own is refused: the import keeps GitHub's numbers."
        }
    )}${input(f, "slug", "Path of the new repository", {
        maxlength: 100,
        pattern: "[a-z0-9_][a-z0-9_.\\-]{0,99}",
        autocomplete: "off",
        hint: "For a new repository only. It is seen as widely as this group."
    })}<fieldset><legend>What to import</legend>${check("issues", "Issues", true)}${check("pullRequests", "Pull requests, as merge requests", true)}${hint(
        "Labels and milestones always come with them."
    )}</fieldset><fieldset><legend>A private GitHub repository</legend>${check(
        "publishPrivate",
        "Show its issues and pull requests here even though this group or repository is seen more widely",
        false
    )}${hint(
        "Without this, a repository that is private on GitHub is imported only into a private repository. With it, what only its GitHub members could read becomes visible to everyone who may see the repository here."
    )}</fieldset>${submit("Start import")}`
    return {
        html: h`${head}${closed || startForm}<section class="card" id="SmithyImportList" aria-label="Imports"><h2>Imports into this group</h2>${importRows(
            c,
            found.importList || [],
            "No import into this group yet."
        )}${found.nextCursor ? h`<p><a href="${tabPath}${query({cursor: found.nextCursor})}">More imports</a></p>` : ""}</section>`
            .html
    }
}
/* B/import (design §11 Import): the site's imports, for an operator; Not Found for anyone else (a group's Owner has its own on
 * the group's Settings). */
function siteImports(siteId, c) {
    const cursor = param("cursor")
    const found = portal.attempt("findGitHubImports", {siteId, limit: 30, ...(cursor ? {cursor} : {})})
    if (found.error) fail()
    return h`<h1>Imports</h1>${banner(c)}<p>Every import of this site. An import starts from a group's Settings, on its Import tab.</p><section class="card" id="SmithyImportList" aria-label="Imports">${importRows(
        c,
        found.result.importList || [],
        "No import yet."
    )}${found.result.nextCursor ? h`<p><a href="${c.base}/import${query({cursor: found.result.nextCursor})}">More imports</a></p>` : ""}</section>`
}
/* The counts of an import by type: what it brought, what GitHub had (seen so far) and what failed. */
function countsTable(counts) {
    const types = Object.keys(counts || {}).sort((a, b) => Object.keys(TYPES).indexOf(a) - Object.keys(TYPES).indexOf(b))
    if (!types.length) return h`<p>Nothing is counted yet.</p>`
    const n = value => String(Number(value) || 0)
    return h`<div class="table-wrap"><table class="lines" id="SmithyImportCounts"><thead><tr><th scope="col">What</th><th scope="col">Imported</th><th scope="col">Seen at GitHub</th><th scope="col">Failed</th></tr></thead><tbody>${types.map(
        type =>
            h`<tr><th scope="row">${TYPES[type] || type}</th><td>${n(counts[type].imported)}</td><td>${n(counts[type].source)}</td><td>${n(counts[type].failed)}</td></tr>`
    )}</tbody></table></div>`
}
/* What could not be carried: the items that failed, with their problem, and what the import never carries. */
function reportOf(run) {
    const items = run.reportList || []
    const notCarried = run.notCarried || {}
    const kinds = Object.entries(notCarried).filter(([kind]) => kind !== "never")
    return h`<section class="card" id="SmithyImportReport" aria-label="Report"><h3>What could not be carried</h3>${
        items.length
            ? h`<ul>${items.map(item => h`<li class="wrap">${TYPES[item.sourceType] ? TYPES[item.sourceType].replace(/s$/, "") : item.sourceType} ${item.sourceId}: ${item.errorText}</li>`)}</ul>`
            : h`<p>Nothing failed.</p>`
    }${kinds.map(
        ([kind, counts]) =>
            h`<p>Not carried, ${kind}: ${Object.entries(counts || {})
                .map(([what, count]) => what + " (" + (Number(count) || 0) + ")")
                .join(", ")}.</p>`
    )}${(notCarried.never || []).length ? h`<p>An import never carries ${notCarried.never.join("; ")}.</p>` : ""}</section>`
}
/* An import's page (design §11 Import): its source and repository, its stage, the counts, a wait on GitHub's rate limit with
 * the time it goes on, the report, and Resume (with a new token) and Cancel (asked again). Refreshed by a link. Not Found
 * to anyone but the group's Owners and operators. */
function importRun(siteId, c, importId) {
    const found = portal.attempt("getGitHubImport", {siteId, importId})
    if (found.error) fail()
    const run = found.result.importRun
    const page = importPage(c, run.importId)
    const group = maybe("getGroup", {siteId, groupId: run.groupId})?.group
    const groupTab = group ? c.base + "/" + enc(group.groupPath) + "/-/settings/import" : null
    const ended = ENDED.includes(run.stage)
    const key = h`${hidden("importId", run.importId)}${hidden("expectedRevision", run.revision)}`
    const head = h`<h1 class="wrap">Import of ${run.sourceRepository}</h1>${banner(c)}<p>${
        run.repositoryPath
            ? h`Into <a href="${c.base}/${enc(run.repositoryPath)}">${run.repositoryPath}</a>`
            : "Into a repository that is gone"
    }${groupTab ? h` · <a href="${groupTab}">The group's imports</a>` : ""}</p>`
    if (param("confirm") === "cancel" && !ended)
        return h`${head}${confirmCard(c, "cancelGitHubImport", {
            title: "Stop the import of " + run.sourceRepository,
            lines: [
                "The import stops where it is and its token is dropped. What it brought stays in " +
                    (run.repositoryPath || "the repository") +
                    ".",
                "It can be resumed later with a token, from where it stopped."
            ],
            fields: {importId: run.importId, expectedRevision: run.revision},
            button: "Stop the import",
            cancelHref: page,
            returnTo: page + "?confirm=cancel",
            successTo: page
        })}`
    const options = run.options || {}
    const what = [options.issues !== false ? "issues" : null, options.pullRequests !== false ? "pull requests" : null].filter(
        Boolean
    )
    const state = h`<section class="card" id="SmithyImportState" aria-label="State"><p><strong>${stageText(run.stage)}</strong>${
        run.running ? " · a step is running now" : ""
    }</p><p><small>Labels, milestones and ${what.join(" and ") || "nothing else"}${
        options.publishPrivate ? "; shown here even though the GitHub repository is private" : ""
    } · started ${timeText(run.createdAt)}${run.finishedAt ? " · ended " + timeText(run.finishedAt) : ""}</small></p>${
        run.waitingUntil
            ? h`<p role="status" id="SmithyImportWaiting">GitHub's rate limit holds this import. It goes on at ${timeText(run.waitingUntil)}.</p>`
            : ""
    }${ended ? "" : h`<p><a href="${page}" id="SmithyImportRefresh">Refresh</a> <small>The import goes on in steps whether this page is open or not.</small></p>`}</section>`
    const resume = formOf(c, "resumeGitHubImport", run.importId)
    const actions =
        run.stage === "done"
            ? h`<p class="card">This import is done. To bring what changed at GitHub since, start it again from the group's Settings: nothing it brought is made twice.</p>`
            : h`${open(c, resume, {title: ended ? "Resume" : "Give another token"})}${key}${input(
                  resume,
                  "token",
                  "GitHub token",
                  {
                      type: "password",
                      secret: true,
                      required: ended,
                      maxlength: 1000,
                      autocomplete: "off",
                      hint: ended
                          ? "The import's token was dropped when it stopped: give one to go on from where it stopped."
                          : "Replaces the token the import reads GitHub with, as when GitHub refuses the one it has."
                  }
              )}${submit(ended ? "Resume import" : "Replace token")}${ended ? "" : h`<p class="card"><a href="${page}?confirm=cancel" id="SmithyImportCancel">Stop the import</a></p>`}`
    return h`${head}${state}<section class="card" id="SmithyImportProgress" aria-label="Counts"><h3>Counts</h3>${countsTable(run.counts)}</section>${reportOf(run)}${actions}`
}
/* The Import page (Smithy/Import): an import's own page, or the site's imports. */
function importPageView(siteId, bases, siteInfo, self, importId) {
    const c = contextOf(bases, siteInfo, self, smithy.takeFlash())
    // a visitor is asked to sign in; no import is told of
    if (!c.signedIn) fail()
    return {html: (importId ? importRun(siteId, c, importId) : siteImports(siteId, c)).html}
}

// ===== push mirrors =====
/* The Mirrors tab of a repository's Settings (design §11), for a Maintainer: each push mirror (its address, refs, whether it
 * deletes refs, enabled, whether it has a credential, the last push with its result and error, the next attempt), Push now,
 * Edit, and Delete asked again; a new mirror. */
function mirrors(shell, head, c, closed) {
    const siteId = shell.siteId
    const id = shell.repository.repositoryId
    const tabPath = smithy.urls(shell.base, shell.repository.repositoryPath).section("settings") + "/mirrors"
    const page = body => ({html: h`${head}${body}`.html})
    const found = portal.attempt("findMirrors", {siteId, repositoryId: id})
    if (found.error)
        fail(
            found.error.kind === "NotFound" ? "NotFound" : found.error.kind,
            found.error.kind === "NotFound" ? null : found.error.message
        )
    const list = found.result.mirrorList || []
    const common = hidden("repositoryId", id)
    const deleting = list.find(m => m.mirrorId === param("delete"))
    if (deleting && !closed)
        return page(
            confirmCard(c, "deleteMirror", {
                title: ec.resource.expand("Delete the mirror to ${url}", "", {url: deleting.url}),
                lines: [ec.resource.expand("Pushes to ${url} stop, and its credential is removed. What was pushed there stays.", "", {url: deleting.url})],
                fields: {repositoryId: id, mirrorId: deleting.mirrorId},
                button: ec.l10n.localize("Delete mirror"),
                cancelHref: tabPath,
                returnTo: tabPath + query({delete: deleting.mirrorId}),
                successTo: tabPath
            })
        )
    const fresh = formOf(c, "storeMirror")
    return page(
        h`<p>A push mirror keeps another git server's copy of this repository the same as this one: after each push here, its refs are pushed there, forced to match.</p><section id="SmithyMirrorList" aria-label="Mirrors">${
            list.length ? "" : h`<p class="card">This repository has no push mirror.</p>`
        }${list.map(m => {
            const f = formOf(c, "storeMirror", m.mirrorId)
            const key = h`${common}${hidden("mirrorId", m.mirrorId)}`
            const facts = [
                m.refs ? "refs " + m.refs : "all branches and tags",
                m.deleteRefs ? "deletes refs this repository no longer has" : null,
                m.hasCredential ? "has a credential" : "no credential",
                m.lastPushDate
                    ? "last push " + timeText(m.lastPushDate) + (m.lastResult ? " (" + m.lastResult + ")" : "")
                    : "not pushed yet",
                m.nextAttemptDate ? "next attempt " + timeText(m.nextAttemptDate) : null
            ].filter(Boolean)
            return h`<article class="card smithy-row" id="SmithyMirror_${m.mirrorId}"><h3 class="wrap"><code>${m.url}</code>${m.enabled ? "" : h` <small class="smithy-chip">Disabled</small>`}</h3><p><small>${facts.join(" · ")}</small></p>${
                m.lastError ? h`<p class="error wrap"><small>${m.lastError}</small></p>` : ""
            }${
                closed
                    ? ""
                    : h`${open(c, formOf(c, "pushMirror", m.mirrorId), {plain: true})}${key}<p><button aria-label="Push now to ${m.url}">Push now</button></p></form><details${attributes(
                          {open: !!f.error}
                      )}><summary>Edit</summary>${open(c, f, {plain: true})}${key}${mirrorFields(f, m)}${submit("Save mirror")}</details><p><a href="${tabPath}${query(
                          {
                              delete: m.mirrorId
                          }
                      )}" aria-label="${ec.resource.expand("Delete the mirror to ${url}", "", {url: m.url})}">${ec.l10n.localize("Delete mirror")}</a></p>`
            }</article>`
        })}</section>${closed || h`${open(c, fresh, {title: ec.l10n.localize("New mirror")})}${common}${hidden("operationId", portal.operationId())}${mirrorFields(fresh, {})}${submit("Add mirror")}`}`
    )
}
/* A mirror's fields: the address with no credential in it, the username and secret apart (the secret write-only), the ref
 * patterns, whether refs are deleted, enabled. */
function mirrorFields(f, m) {
    const editing = !!m.mirrorId
    return h`${input(f, "url", "Address", {
        value: m.url || "",
        type: "url",
        required: true,
        maxlength: 2000,
        pattern: "https://[^\\s@]+",
        autocomplete: "off",
        placeholder: "https://git.example.org/group/repository.git",
        hint: "An https address, with no user or password in it: those go below."
    })}${input(f, "username", "Username", {
        maxlength: 255,
        autocomplete: "off",
        value: "",
        hint: editing
            ? "Leave this empty to keep the one it has."
            : "The account the other server knows the token by, when it asks for one."
    })}${input(f, "secret", "Token or password", {
        type: "password",
        secret: true,
        maxlength: 1000,
        autocomplete: "off",
        hint: m.hasCredential
            ? "It has a credential, which is not shown. Leave this empty to keep it."
            : "It is not shown again after it is saved."
    })}${input(f, "refs", "Refs", {
        value: m.refs || "",
        maxlength: 1000,
        placeholder: "refs/heads/*, refs/tags/*",
        hint: "Ref patterns, separated by commas. Empty: all branches and tags."
    })}${m.hasCredential ? check("removeCredential", "Remove the credential (leave the username and token empty)", false) : ""}${check("deleteRefs", "Delete the refs this repository no longer has", !!m.deleteRefs)}${check("enabled", "Enabled", editing ? !!m.enabled : true)}`
}
;({groupImport, importPageView, importRun, siteImports, mirrors, timeText})
