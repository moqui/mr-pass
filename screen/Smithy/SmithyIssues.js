/* Smithy's issue pages (Dogfood DG3; plan/design-smithy.md §8, §12.1): a repository's and a group's Issues, NewIssue,
 * IssueDetail with its conversation, Labels and Milestones. An issue is the authority's public projection of a task
 * (getIssue, findIssues) and its conversation the posts of the issue's record topic, read and written with the forum's own
 * operations (getPosts, publishPost, updatePost, setReaction, flagPost, setPreferences). Every page is plain HTML built
 * here as escaped markup (SmithyForms.js h); its forms post to Smithy/Do with the session token. A post's body is the
 * authority's rendered and cleaned markup, cleaned here once more before it is written into a page. Where a page has a form
 * with a text, the composer's island (Smithy/Islands/Composer.qvue) replaces the plain textarea when JavaScript runs.
 * What the caller may not see (a confidential issue, an issue of a repository with issues off) is Not Found. No issue page
 * is kept by a cache (Shared/Headers.js). CC0 plus patent grant. */
const smithy = ec.resource.script("component://mr-pass/screen/Smithy/Smithy.js")
const forms = ec.resource.script("component://mr-pass/screen/Smithy/SmithyForms.js")
const {portal, fail, need, maybe, param, enc, query, dateText, holds} = smithy
const {Markup, h, attributes, hidden, contextOf, gate, formOf, open, input, textarea, select, submit, hint, tabsOf, confirmCard} =
    forms

/* The addresses of a repository's issue pages under the mount's base. */
function urlsOf(base, repositoryPath) {
    const u = smithy.urls(base, repositoryPath)
    const list = u.section("issues")
    return {
        u,
        list,
        fresh: list + "/new",
        issue: number => list + "/" + encodeURIComponent(number),
        labels: u.section("labels"),
        milestones: u.section("milestones"),
        milestone: id => u.section("milestones") + "/" + encodeURIComponent(id)
    }
}
/* A repository with issues turned off has no issue pages (design §1). */
function requireIssues(shell) {
    if (!shell.repository.features?.issues) fail()
}
const clean = html => new Markup(String(StringUtilities.cleanHtml(String(html || ""))))
/* A label's colour is one of the names Projects' labels have; the chip's border is drawn in it. */
const COLORS = {
    grey: "#9e9e9e",
    blue: "#2196f3",
    indigo: "#3f51b5",
    purple: "#9c27b0",
    pink: "#e91e63",
    red: "#f44336",
    orange: "#ff9800",
    amber: "#ffc107",
    green: "#4caf50",
    teal: "#009688",
    cyan: "#00bcd4",
    brown: "#795548"
}
const labelChip = label =>
    h`<small class="smithy-chip smithy-label"${attributes({style: Object.hasOwn(COLORS, label.color || "") ? "border-color:" + COLORS[label.color] : null})}>${label.name}</small>`
const stateText = issue =>
    issue.state === "closed"
        ? "Closed" + ({completed: " as completed", notPlanned: " as not planned", duplicate: " as a duplicate"}[issue.stateReason] || "")
        : "Open"
const person = (c, who) =>
    who?.handle
        ? h`<a href="${c.base}/${enc(who.handle)}">${who.displayName || who.handle}</a> <small>@${who.handle}</small>`
        : h`${who?.displayName || "An account"}`
/* A checkbox that keeps what a refused or previewed post had. */
const box = (f, name, label, checked, value) => {
    const typed = f.value(name, null)
    const on = typed === null || typed === "" ? !!checked : value == null ? typed === "true" : typed.split(/[\s,]+/).includes(value)
    return h`<label><input type="checkbox" name="${name}" value="${value ?? "true"}"${attributes({checked: on})}> ${label}</label>`
}
/* The sections of a repository's issues: the list, Labels and Milestones. */
const sections = (iu, current) =>
    tabsOf(
        ec.l10n.localize("Issue sections"),
        [
            ["issues", "Issues", iu.list],
            ["labels", "Labels", iu.labels],
            ["milestones", "Milestones", iu.milestones]
        ],
        current
    )

/* The filters of an Issues list, from the request: what findIssues takes, and what a link of the page carries. */
function filtersOf(owner) {
    const state = param("state") === "closed" ? "closed" : "open"
    const sort = param("sort") === "activity" ? "activity" : "created"
    const handle = name =>
        String(param(name) || "")
            .replace(/^@/, "")
            .trim()
    const shown = {
        state,
        q: param("q") || "",
        label: param("label") || "",
        milestone: param("milestone") || "",
        assignee: handle("assignee"),
        author: handle("author"),
        sort,
        // an Owner's filter; nobody else's request reaches the authority with it
        confidential: owner && param("confidential") === "only" ? "only" : ""
    }
    return {
        shown,
        input: {
            state,
            sort,
            limit: 30,
            ...(shown.q ? {query: shown.q} : {}),
            ...(shown.label ? {labelIds: [shown.label]} : {}),
            ...(shown.milestone ? {milestoneId: shown.milestone} : {}),
            ...(shown.assignee ? {assigneeHandle: shown.assignee} : {}),
            ...(shown.author ? {authorHandle: shown.author} : {}),
            ...(shown.confidential ? {confidential: "only"} : {}),
            ...(param("cursor") ? {cursor: param("cursor")} : {})
        },
        // a link of the page: the filters, with what it changes
        link: (path, more) =>
            path +
            query({
                ...shown,
                state: shown.state === "open" ? null : shown.state,
                sort: shown.sort === "created" ? null : shown.sort,
                ...(more || {})
            })
    }
}
/* The rows of an Issues list: number, title and labels, then the rest on a second line (design §8 Issues, Phone). */
function issueRows(c, list, withRepository) {
    return list.map(issue => {
        const iu = urlsOf(c.base, issue.repositoryPath)
        return h`<article class="card smithy-row" id="SmithyIssue_${issue.issueNumber}"><h3 class="wrap"><a href="${iu.issue(issue.issueNumber)}">${issue.title}</a> <small>#${issue.issueNumber}</small>${
            issue.confidential ? h` <small class="smithy-chip">Confidential</small>` : ""
        }${(issue.labels || []).map(label => h` ${labelChip(label)}`)}</h3><p><small>${withRepository ? issue.repositoryPath + " · " : ""}${stateText(issue)} · opened ${dateText(issue.createdAt)}${
            issue.author?.handle ? " by @" + issue.author.handle : ""
        }${issue.milestone?.name ? " · " + issue.milestone.name : ""}${
            (issue.assignees || []).length ? " · assigned to " + issue.assignees.map(a => "@" + a.handle).join(", ") : ""
        } · ${Number(issue.commentCount) || 0} ${Number(issue.commentCount) === 1 ? "comment" : "comments"}</small></p></article>`
    })
}
/* The Open and Closed tabs with their counts, the filter form and the rows of an Issues list. */
function listBody(c, path, filters, found, o) {
    const s = filters.shown
    const counts = found.counts || {}
    const none = formOf(c, "")
    const tab = (state, label, count) =>
        h`<a href="${filters.link(path, {state: state === "open" ? null : state, cursor: null})}"${attributes({"aria-current": s.state === state ? "page" : null})}>${label}${
            count == null ? "" : h` <small>${count}</small>`
        }</a>`
    return h`<nav aria-label="Issue states" class="card smithy-tabs" id="SmithyIssueStates">${tab("open", "Open", counts.open)}${tab("closed", "Closed", counts.closed)}</nav><form method="get" action="${path}" class="card" role="search" id="SmithyIssueFind">${
        s.state === "open" ? "" : hidden("state", s.state)
    }<label>Search <input type="search" name="q" value="${s.q}" maxlength="200"></label>${
        o.labels?.length ? select(none, "label", "Label", [["", "Any label"], ...o.labels.map(l => [l.labelId, l.name])], {value: s.label}) : ""
    }${
        o.milestones?.length
            ? select(none, "milestone", "Milestone", [["", "Any milestone"], ...o.milestones.map(m => [m.milestoneId, m.name])], {
                  value: s.milestone
              })
            : ""
    }<label>Author <input name="author" value="${s.author}" maxlength="39" placeholder="handle"></label><label>Assignee <input name="assignee" value="${s.assignee}" maxlength="39" placeholder="handle"></label>${select(
        none,
        "sort",
        ec.l10n.localize("Sort by"),
        [
            ["created", "Newest"],
            ["activity", "Last activity"]
        ],
        {value: s.sort}
    )}${
        o.owner
            ? h`<label><input type="checkbox" name="confidential" value="only"${attributes({checked: s.confidential === "only"})}> Confidential only</label>`
            : ""
    }<p><button>Show</button></p></form><section id="SmithyIssueList" aria-label="Issues">${
        found.issueList?.length ? issueRows(c, found.issueList, o.withRepository) : h`<p class="card">No issues to show.</p>`
    }</section>${found.nextCursor ? h`<p><a href="${filters.link(path, {cursor: found.nextCursor})}" id="SmithyIssuesMore">More issues</a></p>` : ""}`
}
/* Issues (design §8 Issues): a repository's issues, open or closed, filtered by label, milestone, assignee, author and
 * text, by cursor. */
function issues(shell, bases, siteInfo, self) {
    requireIssues(shell)
    const c = contextOf(bases, siteInfo, self, shell.flash)
    const siteId = shell.siteId
    const repositoryId = shell.repository.repositoryId
    const iu = urlsOf(c.base, shell.repository.repositoryPath)
    const owner = !!shell.capabilities.canOwn
    const filters = filtersOf(owner)
    const found = need("findIssues", {siteId, repositoryId, ...filters.input})
    return {
        html: h`${sections(iu, "issues")}<p id="SmithyNewIssueLink"><a href="${iu.fresh}">${ec.l10n.localize("New issue")}</a></p>${listBody(c, iu.list, filters, found, {
            owner,
            labels: maybe("findLabels", {siteId, repositoryId})?.labelList || [],
            milestones: maybe("findMilestones", {siteId, repositoryId, state: "all"})?.milestoneList || []
        })}`.html
    }
}
/* The repositories of a group and its subgroups a new issue may be filed in: the first hundred by name, or those the
 * request's text (rq) finds, for a group with more. */
function issueRepositories(siteId, groupId) {
    const repositoryQuery = param("rq")
    const found =
        maybe("findRepositories", {
            siteId,
            groupId,
            includeSubgroups: true,
            sort: "name",
            limit: 100,
            ...(repositoryQuery ? {query: repositoryQuery} : {})
        }) || {}
    return {repositories: (found.repositoryList || []).filter(r => r.features?.issues && !r.archived), nextCursor: found.nextCursor || null}
}
/* The address a group's "New issue in" choice goes to (the screen's pre-actions redirect there before anything renders), or
 * null when the request makes none; Not Found for a repository that is not one of the group's with issues on. */
function groupNewIssue(siteId, groupId, base) {
    const chosen = param("go") ? param("newIn") : null
    if (!chosen) return null
    const target = issueRepositories(siteId, groupId).repositories.find(r => r.repositoryId === chosen)
    if (!target) fail()
    return urlsOf(base || "", target.repositoryPath).fresh
}
/* GroupIssues (design §6): the issues of the group's repositories and its subgroups' that the caller may view, each row
 * with its repository; New issue asks for the repository first (groupNewIssue answers its choice). */
function groupIssues(shell, bases, siteInfo, self) {
    const c = contextOf(bases, siteInfo, self, shell.flash)
    const siteId = shell.siteId
    const groupId = shell.group.groupId
    const path = shell.root + "/-/issues"
    const repositoryQuery = param("rq")
    const listed = issueRepositories(siteId, groupId)
    const repositories = listed.repositories
    const filters = filtersOf(false)
    const found = need("findIssues", {siteId, groupId, ...filters.input})
    return {
        html: h`<h2>Issues</h2>${
            repositories.length
                ? h`<form method="get" action="${path}" class="card" id="SmithyGroupNewIssue">${select(
                      formOf(c, ""),
                      "newIn",
                      ec.l10n.localize("New issue in"),
                      repositories.map(r => [r.repositoryId, r.repositoryPath]),
                      {value: shell.group.issueRepositoryId || repositories[0].repositoryId}
                  )}${
                      listed.nextCursor || repositoryQuery
                          ? h`<label>Find a repository <input type="search" name="rq" value="${repositoryQuery || ""}" maxlength="100"></label>`
                          : ""
                  }<p><button name="go" value="1">${ec.l10n.localize("New issue")}</button>${
                      listed.nextCursor || repositoryQuery ? h` <button>Find</button>` : ""
                  }</p></form>`
                : repositoryQuery
                  ? h`<p class="card">No repository of this group with issues on matches. <a href="${path}">Show all</a></p>`
                  : ""
        }${listBody(c, path, filters, found, {withRepository: true})}`.html
    }
}

/* The composer's island (design §8 NewIssue): where JavaScript runs it takes the place of the plain textarea of the form
 * formId, with a Markdown and rich text toggle and a preview in the page. The plain form stays as it is without it. */
const ISLAND_SCRIPTS = [
    "/libs/vue/vue.runtime.global.prod.js",
    "/libs/quasar/quasar.umd.prod.js",
    "/libs/quasar/lang/en-US.umd.prod.js",
    "/libs/quasar/icon-set/material-symbols-outlined.umd.prod.js",
    "/js/MoquiLib.js",
    "/js/MoquiL10n.js",
    "/js/WebrootVue.qvt.render.js",
    "/js/WebrootVue.qvt.js",
    "/js/WebrootPublic.qvt.js"
]
const COMPOSER = "SmithyComposer"
// an island's own texts in the visitor's language, which a public page has no catalog for
const {islandMessages} = ec.resource.script("component://webroot/script/IslandMessages.js")
/* One island's config and, unless another island of the page has them already, the scripts (more: the widgets an island
 * needs, loaded before WebrootPublic.qvt.js mounts it). */
function islandOf(mount, name, c, siteInfo, context, o = {}) {
    const config = {
        shell: "island",
        sessionToken: ec.web.sessionToken,
        locale: siteInfo.site?.locale || "en",
        timeZone: siteInfo.site?.timeZone || "UTC",
        quasar: {dark: "auto"},
        quasarLang: "enUS",
        qvt: {build: "runtime", handles: ["static-template", "bundled-qvue"]},
        route: {name: "smithy-" + name.toLowerCase(), basePath: c.base + "/-/island/" + name, title: name, renderModes: ["qvue"]},
        messages: islandMessages(["component://mr-pass/screen/Smithy/Islands/" + name + ".qvue"]),
        context,
        labels: {loading: o.loading || "Loading", notFound: ""}
    }
    const scripts = ISLAND_SCRIPTS.slice(0, -1).concat(o.scripts || [], ISLAND_SCRIPTS.slice(-1))
    return new Markup(
        '<script type="application/json" data-moqui-island="' +
            mount +
            '">' +
            JSON.stringify(config).split("<").join("\\u003c") +
            "</script>" +
            (o.noScripts ? "" : scripts.map(src => '<script src="' + src + '"></script>').join(""))
    )
}
function island(c, siteInfo, f, label, o) {
    if (o) return islandOf(COMPOSER, "Composer", c, siteInfo, {formId: f.id, previewOf: f.name, previewUrl: c.base + "/-/do/previewPost", label}, o)
    const config = {
        shell: "island",
        sessionToken: ec.web.sessionToken,
        locale: siteInfo.site?.locale || "en",
        timeZone: siteInfo.site?.timeZone || "UTC",
        quasar: {dark: "auto"},
        quasarLang: "enUS",
        qvt: {build: "runtime", handles: ["static-template", "bundled-qvue"]},
        route: {name: "smithy-composer", basePath: c.base + "/-/island/Composer", title: ec.l10n.localize("Composer"), renderModes: ["qvue"]},
        messages: islandMessages(["component://mr-pass/screen/Smithy/Islands/Composer.qvue"]),
        context: {formId: f.id, previewOf: f.name, previewUrl: c.base + "/-/do/previewPost", label},
        labels: {loading: "Loading the editor", notFound: ""}
    }
    return new Markup(
        '<script type="application/json" data-moqui-island="' +
            COMPOSER +
            '">' +
            JSON.stringify(config).split("<").join("\\u003c") +
            "</script>" +
            ISLAND_SCRIPTS.map(src => '<script src="' + src + '"></script>').join("")
    )
}
/* A form's text: the preview asked for last (the authority's cleaned markup), the Markdown textarea, and the place the
 * island takes. The form's buttons follow (textButtons). */
function textField(f, label, o = {}) {
    const format = f.value("sourceFormat", o.sourceFormat || "markdown") === "html" ? "html" : "markdown"
    return h`${
        f.preview
            ? h`<section class="smithy-preview" id="${f.id}_preview" aria-label="Preview"><h3>Preview</h3><div class="wrap">${new Markup(f.preview)}</div></section>`
            : ""
    }${hidden("sourceFormat", format)}${textarea(f, "body", label, {
        value: o.value,
        required: o.required !== false,
        rows: o.rows || 8,
        maxlength: 100000,
        // a text written as rich text is edited here as its markup
        hint: format === "html" ? "This text is rich text: its HTML markup." : "Markdown: **bold**, `code`, lists, links and fenced code blocks."
    })}${o.island ? h`<div id="${COMPOSER}" style="display:none"></div>` : ""}`
}
const textButtons = (c, f, label, more) =>
    h`<p><button>${label}</button> <button formaction="${c.base}/-/do/previewPost" formnovalidate name="previewOf" value="${f.name}">Preview</button>${more || ""}</p></form>`

/* NewIssue (design §8 NewIssue): title, text, the Confidential mark with who will read it, and for a Reporter labels,
 * assignees and milestone. A visitor is sent to sign in; an account without a confirmed address is told to confirm it. */
function newIssue(shell, bases, siteInfo, self) {
    requireIssues(shell)
    const c = contextOf(bases, siteInfo, self, shell.flash)
    const siteId = shell.siteId
    const repositoryId = shell.repository.repositoryId
    const iu = urlsOf(c.base, shell.repository.repositoryPath)
    const caps = shell.capabilities
    const head = h`${sections(iu, "issues")}<h2>${ec.l10n.localize("New issue")}</h2>`
    const closed = gate(c, c.signedIn ? caps.confirmed : null)
    if (closed) return {html: h`${head}${closed}`.html}
    if (shell.repository.archived || caps.canFileIssue === false)
        return {
            html: h`${head}<p class="card" id="SmithyNoAccess">${shell.repository.archived ? "This repository is archived: no issue is filed in it." : "You cannot file an issue here."}</p>`
                .html
        }
    const f = formOf(c, "createIssue")
    const triage = !!caps.canTriage
    const labels = triage ? maybe("findLabels", {siteId, repositoryId})?.labelList || [] : []
    const milestones = triage ? maybe("findMilestones", {siteId, repositoryId, state: "open"})?.milestoneList || [] : []
    return {
        html: h`${head}${open(c, f)}${hidden("repositoryId", repositoryId)}${hidden("operationId", portal.operationId())}${input(f, "title", "Title", {
            required: true,
            maxlength: 250
        })}${textField(f, "Text", {island: true, rows: 12})}${box(
            f,
            "confidential",
            "Confidential",
            false
        )}${hint("Only the owners of this repository and of its group, and the site's operators, read a confidential issue and answer you. Use it to report a security problem. Everyone who may see this repository reads any other issue.")}${
            triage
                ? h`${labels.length ? h`<fieldset><legend>Labels</legend>${labels.map(label => box(f, "labelIds", label.name, false, label.labelId))}</fieldset>` : ""}${input(
                      f,
                      "assigneeHandles",
                      "Assignees",
                      {maxlength: 400, hint: ec.l10n.localize("Handles, separated by commas.")}
                  )}${milestones.length ? select(f, "milestoneId", "Milestone", [["", "None"], ...milestones.map(m => [m.milestoneId, m.name])]) : ""}`
                : ""
        }${textButtons(c, f, "Create issue")}${island(c, siteInfo, f, "Text")}`.html
    }
}

const REACTIONS = ["like", "thanks", "insightful", "agree", "laugh"]
const WATCH = [
    ["Normal", ec.l10n.localize("Normal: when you are mentioned or answered")],
    ["Watching", ec.l10n.localize("Watching: every comment")],
    ["Tracking", ec.l10n.localize("Tracking: a count of new comments")],
    ["Muted", ec.l10n.localize("Muted: nothing")]
]
/* One post of the conversation: the author, the day, its marks (edited, waiting for review, Owners only), the body, the
 * reactions as buttons for who may react, and Edit and Report by capability. A state change is one line. */
function postRow(c, row, here) {
    const id = "post-" + row.postId
    if (row.kind === "event" || row.postKind === "event")
        return h`<p class="smithy-event" id="${id}"><small>${row.eventText ? row.eventText : clean(row.body)} · ${dateText(row.entryDate)}</small></p>`
    const can = row.capabilities || {}
    const counts = row.reactions || {}
    const mine = row.myReactions || []
    const shown = REACTIONS.filter(key => can.canReact || counts[key])
    const links = [
        can.canEdit ? h`<a href="${here({edit: row.postId})}#Smithy_updatePost">Edit</a>` : null,
        // each post by its own capability
        can.canFlag && c.signedIn ? h`<a href="${here({report: row.postId})}#Smithy_flagPost">Report</a>` : null
    ].filter(Boolean)
    return h`<article class="card smithy-post" id="${id}"><h3 class="post-meta">${person(c, row.author)} <small>· ${dateText(row.entryDate)}${
        row.hasHistory ? " · edited" : ""
    }</small>${row.visibility === "pending" ? h` <small class="smithy-chip">Waiting for review</small>` : ""}${
        row.visibility === "staff" ? h` <small class="smithy-chip">Owners only</small>` : ""
    }</h3>${
        row.visibility === "deleted" ? h`<p><small>This comment was removed.</small></p>` : h`<div class="wrap smithy-body">${clean(row.body)}</div>`
    }${
        shown.length
            ? h`<div class="reactions" aria-label="Reactions">${shown.map(key =>
                  can.canReact
                      ? h`${open(c, formOf(c, "setReaction", row.postId + "-" + key), {plain: true, returnTo: here() + "#" + id})}${hidden("postId", row.postId)}${hidden(
                            "reactionKey",
                            key
                        )}${hidden("active", mine.includes(key) ? "false" : "true")}<button aria-pressed="${mine.includes(key) ? "true" : "false"}">${key} ${counts[key] || 0}</button></form>`
                      : h`<span>${key} ${counts[key]} </span>`
              )}</div>`
            : ""
    }${links.length ? h`<p><small>${links.map((link, i) => h`${i ? " · " : ""}${link}`)}</small></p>` : ""}</article>`
}
/* A side block of an issue: what it holds now, and under it, collapsed, the form of who may change it. */
const side = (id, title, now, form) =>
    form
        ? h`<details class="card" id="${id}"><summary><strong>${title}</strong> ${now}</summary>${form}</details>`
        : h`<section class="card" id="${id}"><p><strong>${title}</strong> ${now}</p></section>`

/* IssueDetail (design §8 IssueDetail): the title, state and marks, the conversation with a reply form, and the side blocks
 * (labels, assignees, milestone, linked commits, merge requests and refs, notifications), each with the form of who may
 * change it. ?confirm=confidential asks again before who reads the issue changes; ?edit= and ?report= show a post's form. */
function issueDetail(shell, issueNumber, bases, siteInfo, self, asked) {
    // what the request asks of the page (?confirm=, ?cursor=, ?edit=, ?report=); asked gives them in the request's place
    const ask = name => (asked ? (asked[name] ?? null) : param(name))
    requireIssues(shell)
    const siteId = shell.siteId
    const repositoryId = shell.repository.repositoryId
    const number = Number(issueNumber)
    const found = need("getIssue", {siteId, repositoryId, issueNumber: number})
    const issue = found.issue
    const caps = found.capabilities || {}
    const c = contextOf(bases, siteInfo, self, shell.flash)
    const iu = urlsOf(c.base, shell.repository.repositoryPath)
    const root = issue.topic?.rootCommEventId || null
    const key = h`${hidden("repositoryId", repositoryId)}${hidden("issueNumber", number)}${hidden("expectedRevision", issue.revision)}`
    const head = h`${sections(iu, "issues")}<article id="SmithyIssue" class="wrap"><h2>${issue.title} <small>#${issue.issueNumber}</small></h2><p><strong class="smithy-chip" id="SmithyIssueState">${stateText(issue)}</strong>${
        issue.state === "closed" && issue.stateReason === "duplicate" && issue.duplicateOfNumber
            ? h` of <a href="${iu.issue(issue.duplicateOfNumber)}">#${issue.duplicateOfNumber}</a>`
            : ""
    }${
        issue.confidential
            ? h` <strong class="smithy-chip" id="SmithyIssueConfidential">Confidential</strong> <small>Only the owners here and the site's operators read it, and its reporter what was filed and the answers.</small>`
            : ""
    }</p><p><small>Opened ${dateText(issue.createdAt)} by ${person(c, issue.author)}${issue.author?.imported ? " (imported)" : ""}${
        issue.closedAt ? " · closed " + dateText(issue.closedAt) : ""
    }${issue.workItemKey ? " · work item " + issue.workItemKey : ""}</small></p></article>${
        found.pending ? h`<p role="status" class="card" id="SmithyIssuePending">Waiting for review: this issue is shown to others once a moderator has approved it.</p>` : ""
    }`
    const cursor = ask("cursor")
    const posts = root ? need("getPosts", {siteId, rootCommEventId: root, limit: 30, ...(cursor ? {cursor} : {})}) : {postList: []}
    // the page's own address with the conversation's page kept (a reaction, an edit and a report return to it)
    const here = more => self + query({cursor, ...(more || {})})
    // the posts' own capabilities are the forum's, for this reader of this record
    const conversation = h`<section id="SmithyConversation" aria-label="Conversation">${(posts.postList || []).map(row => postRow(c, row, here))}${
        posts.nextCursor ? h`<p><a href="${self}${query({cursor: posts.nextCursor})}" id="SmithyPostsMore">Later comments</a></p>` : ""
    }</section>`

    // who reads the issue changes: asked again on this page, which shows the posts first
    if (ask("confirm") === "confidential" && caps.canSetConfidential) {
        const asked = self + query({confirm: "confidential"})
        if (!issue.confidential)
            return {
                html: h`${head}${confirmCard(c, "setIssueConfidential", {
                    title: "Make #" + issue.issueNumber + " confidential",
                    lines: [
                        "After this only the owners of " +
                            shell.repository.repositoryPath +
                            " and of its group, the site's operators, and its reporter read this issue. For everyone else its number answers Not Found.",
                        "What was already sent by email is not recalled."
                    ],
                    fields: {repositoryId, issueNumber: number, confidential: "true", expectedRevision: issue.revision},
                    button: "Make confidential",
                    cancelHref: self,
                    returnTo: asked,
                    successTo: self
                })}`.html
            }
        const fresh = formOf(c, "setIssueConfidential", "new")
        return {
            html: h`${head}${confirmCard(c, "setIssueConfidential", {
                title: "Make #" + issue.issueNumber + " public as it is",
                lines: [
                    "Everyone who may see " +
                        shell.repository.repositoryPath +
                        " will read this issue and every approved comment below that is not marked Owners only. Read them first.",
                    "This cannot be taken back for what is mailed to its watchers afterwards."
                ],
                fields: {repositoryId, issueNumber: number, confidential: "false", expectedRevision: issue.revision},
                button: "Make public",
                cancelHref: self,
                returnTo: asked,
                successTo: self
            })}${open(c, fresh, {title: "Or make a new public issue", returnTo: asked})}${key}${hidden("confidential", "true")}${hidden("asNewIssue", "true")}${hidden(
                "confirm",
                "yes"
            )}${hidden("operationId", portal.operationId())}<p>The new issue gets its own number and conversation, with the title and text you write here. This one stays confidential and links to it.</p>${input(
                fresh,
                "title",
                "Title",
                {required: true, maxlength: 250}
            )}${textField(fresh, "Text")}${textButtons(c, fresh, "Create the public issue", h` <a href="${self}">Cancel</a>`)}${conversation}`.html
        }
    }

    // the main column's form: a post's edit or report when asked, else the reply
    const signedIn = c.signedIn
    const confirmed = shell.capabilities.confirmed
    let form = ""
    let hasText = null
    const editId = ask("edit")
    const reportId = ask("report")
    if (editId && signedIn) {
        const editable = maybe("getEditablePost", {siteId, postId: editId})?.draft
        // a post of this issue's conversation that the caller may edit, or nothing
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
        )}${textField(f, "Comment", {island: true})}${
            issue.confidential && caps.canSetConfidential
                ? h`${box(f, "ownersOnly", "Owners only", false)}${hint("The reporter does not read a comment marked Owners only, and is not mailed it.")}`
                : ""
        }${textButtons(c, f, "Comment")}`
    } else if (shell.repository.archived) form = h`<p class="card">This repository is archived: its issues are read only.</p>`

    // Close and Reopen, with the reason; a Reporter marks a duplicate
    let state = ""
    if (caps.canSetState && confirmed !== false) {
        const f = formOf(c, "setIssueState")
        state =
            issue.state === "closed"
                ? h`${open(c, f)}${key}${hidden("state", "open")}${submit("Reopen issue")}`
                : h`${open(c, f)}${key}${hidden("state", "closed")}<p><button name="reason" value="completed">Close as completed</button> <button name="reason" value="notPlanned">Close as not planned</button></p></form>${
                      caps.canTriage
                          ? h`${open(c, formOf(c, "setIssueState", "duplicate"))}${key}${hidden("state", "closed")}${hidden("reason", "duplicate")}${input(
                                formOf(c, "setIssueState", "duplicate"),
                                "duplicateOfNumber",
                                "This is a duplicate of issue number",
                                {required: true, inputmode: "numeric", maxlength: 9, pattern: "[1-9][0-9]{0,8}"}
                            )}${submit("Close as a duplicate")}`
                          : ""
                  }`
    }

    // the side blocks; the reporter of a confidential issue is not given these fields, and has no block for them
    const triage = !!caps.canTriage && confirmed !== false
    const blocks = []
    if (caps.canEdit && confirmed !== false) {
        const f = formOf(c, "updateIssue")
        blocks.push(
            h`<details class="card" id="SmithyIssueTitle"${attributes({open: !!f.error})}><summary><strong>Title</strong></summary>${open(c, f, {plain: true})}${key}${input(f, "title", "Title", {value: issue.title, required: true, maxlength: 250})}${submit("Save title")}</details>`
        )
    }
    if (issue.labels || triage) {
        const all = triage ? maybe("findLabels", {siteId, repositoryId})?.labelList || [] : []
        const on = (issue.labels || []).map(l => l.labelId)
        const f = formOf(c, "setIssueLabels")
        blocks.push(
            side(
                "SmithyIssueLabels",
                "Labels",
                (issue.labels || []).length ? (issue.labels || []).map(l => h`${labelChip(l)} `) : "None",
                triage && all.length
                    ? h`${open(c, f, {plain: true})}${key}${all.map(l => box(f, "labelIds", l.name, on.includes(l.labelId), l.labelId))}${submit("Save labels")}`
                    : null
            )
        )
    }
    if (issue.assignees || triage) {
        const f = formOf(c, "setIssueAssignees")
        const now = (issue.assignees || []).map(a => a.handle)
        const choices = triage ? maybe("findAssignees", {siteId, repositoryId, limit: 100})?.handleList || [] : []
        const handles = [...new Set([...now, ...choices.map(a => a.handle)])].filter(Boolean)
        blocks.push(
            side(
                "SmithyIssueAssignees",
                "Assignees",
                now.length ? (issue.assignees || []).map((a, i) => h`${i ? ", " : ""}<a href="${c.base}/${enc(a.handle)}">@${a.handle}</a>`) : "None",
                triage
                    ? h`${open(c, f, {plain: true})}${key}${
                          handles.length
                              ? handles.map(handle => box(f, "assigneeHandles", "@" + handle, now.includes(handle), handle))
                              : input(f, "assigneeHandles", "Handles", {maxlength: 400, hint: "Separated by commas."})
                      }${submit("Save assignees")}`
                    : null
            )
        )
    }
    if (issue.milestone !== undefined || triage) {
        const f = formOf(c, "setIssueMilestone")
        const open_ = triage ? maybe("findMilestones", {siteId, repositoryId, state: "open"})?.milestoneList || [] : []
        const m = issue.milestone
        const choices = [["", "None"], ...open_.map(x => [x.milestoneId, x.name])]
        if (m?.milestoneId && !open_.some(x => x.milestoneId === m.milestoneId)) choices.push([m.milestoneId, m.name])
        blocks.push(
            side(
                "SmithyIssueMilestone",
                "Milestone",
                m?.name ? h`<a href="${iu.milestone(m.milestoneId)}">${m.name}</a>${m.dueDate ? " · due " + dateText(m.dueDate) : ""}` : "None",
                triage
                    ? h`${open(c, f, {plain: true})}${key}${select(f, "milestoneId", "Milestone", choices, {value: m?.milestoneId || ""})}${submit(ec.l10n.localize("Save milestone"))}`
                    : null
            )
        )
    }
    // DG6 (design §8.2 discussion): the forum topic the issue was made from, or that discusses it (a link card)
    const discussion = ec.resource
        .script("component://mr-pass/screen/Smithy/SmithyScope.js")
        .discussionCard(shell, issue.discussion, bases, siteInfo)
    if (discussion) blocks.push(discussion)
    const commits = issue.linkedCommits || []
    const requests = issue.linkedMergeRequests || []
    const refs = issue.linkedRefs || []
    if (commits.length || requests.length || refs.length)
        blocks.push(
            h`<section class="card" id="SmithyIssueLinked" aria-label="Linked"><p><strong>Linked</strong></p>${commits.map(commit => {
                const u = smithy.urls(c.base, commit.repositoryPath || shell.repository.repositoryPath)
                return h`<p class="wrap"><a href="${u.commit(commit.commitId)}"><code>${String(commit.commitId).slice(0, 8)}</code></a> ${commit.summary}</p>`
            })}${requests.map(
                // one of another repository links there
                request =>
                    h`<p class="wrap"><a href="${smithy.urls(c.base, request.repositoryPath || shell.repository.repositoryPath).section("merge-requests")}/${request.mergeRequestNum}">!${request.mergeRequestNum}</a> ${request.title} <small>${request.state}</small></p>`
            )}${refs.map(ref => {
                const name = String(ref.refName || "").replace(/^refs\/(?:heads|tags)\//, "")
                return h`<p class="wrap"><a href="${iu.u.tree(name, "")}">${name}</a> <small>${ref.refType}</small></p>`
            })}</section>`
        )
    if (signedIn && root) {
        const preferences = maybe("getPreferences", {siteId, scopeType: "topic", scopeId: root})
        if (preferences) {
            const f = formOf(c, "setPreferences")
            const level = preferences.preferences?.watchLevel || "Normal"
            blocks.push(
                side(
                    "SmithyIssueWatch",
                    "Notifications",
                    level,
                    h`${open(c, f, {plain: true})}${hidden("scopeType", "topic")}${hidden("scopeId", root)}${hidden("expectedRevision", preferences.revision ?? 0)}${select(f, "watchLevel", "Tell me about", WATCH, {value: level})}${submit("Save")}`
                )
            )
        }
    }
    if (caps.canSetConfidential)
        blocks.push(
            h`<section class="card" id="SmithyIssueAudience"><p><a href="${self}${query({confirm: "confidential"})}">${issue.confidential ? "Make this issue public" : "Make this issue confidential"}</a></p></section>`
        )
    return {
        html: h`${head}<div class="smithy-issue"><div>${conversation}<span id="SmithyConversationEnd"></span>${form || ""}${state}</div><aside class="smithy-side" aria-label="About this issue">${blocks}</aside></div>${
            hasText ? island(c, siteInfo, hasText, hasText.name === "publishPost" ? "Comment" : "Text") : ""
        }`.html
    }
}

/* Labels (design §8 Labels): each label with its colour, description and open issue count; a Maintainer makes, changes and,
 * after confirming on ?delete=, deletes one. */
function labels(shell, bases, siteInfo, self) {
    requireIssues(shell)
    const c = contextOf(bases, siteInfo, self, shell.flash)
    const siteId = shell.siteId
    const repositoryId = shell.repository.repositoryId
    const iu = urlsOf(c.base, shell.repository.repositoryPath)
    const list = need("findLabels", {siteId, repositoryId}).labelList || []
    const edits = holds(shell.capabilities.role, "maintainer") && shell.capabilities.confirmed !== false
    const head = h`${sections(iu, "labels")}<h2>Labels</h2>`
    const doomed = edits ? list.find(label => label.labelId === param("delete") && label.editable !== false) : null
    if (doomed)
        return {
            html: h`${head}${confirmCard(c, "deleteLabel", {
                title: "Delete the label " + doomed.name,
                lines: ["This removes the label " + doomed.name + " from every issue that has it. It cannot be undone."],
                fields: {repositoryId, labelId: doomed.labelId},
                button: "Delete label",
                cancelHref: iu.labels,
                returnTo: iu.labels + query({delete: doomed.labelId}),
                successTo: iu.labels
            })}`.html
        }
    const fields = (f, label) =>
        h`${input(f, "name", "Name", {value: label.name || "", required: true, maxlength: 100})}${select(
            f,
            "color",
            "Colour",
            Object.keys(COLORS).map(name => [name, name]),
            {value: Object.hasOwn(COLORS, label.color || "") ? label.color : "grey"}
        )}${input(f, "description", "Description", {value: label.description || "", maxlength: 255})}`
    const fresh = formOf(c, "storeLabel")
    return {
        html: h`${head}<section id="SmithyLabelList" aria-label="Labels">${list.length ? "" : h`<p class="card">This repository has no label.</p>`}${list.map(label => {
            const f = formOf(c, "storeLabel", label.labelId)
            // a label of the organization's (not this repository's project's own) is changed in Projects, not here
            const own = edits && label.editable !== false
            return h`<article class="card smithy-row" id="SmithyLabel_${label.labelId}"><h3 class="wrap">${labelChip(label)}</h3><p><small>${label.description ? label.description + " · " : ""}<a href="${iu.list}${query({label: label.labelId})}">${Number(label.openIssueCount) || 0} open</a>${
                own ? h` · <a href="${iu.labels}${query({delete: label.labelId})}" aria-label="Delete ${label.name}">${ec.l10n.localize("Delete")}</a>` : ""
            }</small></p>${
                own
                    ? h`<details${attributes({open: !!f.error})}><summary>Edit</summary>${open(c, f, {plain: true})}${hidden("repositoryId", repositoryId)}${hidden("labelId", label.labelId)}${hidden(
                          "expectedRevision",
                          label.revision
                      )}${fields(f, label)}${submit("Save label")}</details>`
                    : ""
            }</article>`
        })}</section>${
            edits
                ? h`${open(c, fresh, {title: "New label"})}${hidden("repositoryId", repositoryId)}${hidden("labelId", "")}${hidden("operationId", portal.operationId())}${fields(fresh, {})}${submit("Add label")}`
                : ""
        }`.html
    }
}
/* Milestones (design §8 Milestones): open and closed milestones with the due date and the share of closed issues, and one
 * milestone with its issues; a Maintainer makes, changes and closes one. */
function milestones(shell, milestoneId, bases, siteInfo, self) {
    requireIssues(shell)
    const c = contextOf(bases, siteInfo, self, shell.flash)
    const siteId = shell.siteId
    const repositoryId = shell.repository.repositoryId
    const iu = urlsOf(c.base, shell.repository.repositoryPath)
    const list = need("findMilestones", {siteId, repositoryId, state: "all"}).milestoneList || []
    const edits = holds(shell.capabilities.role, "maintainer") && shell.capabilities.confirmed !== false
    const progress = m => {
        const closed = Number(m.closedIssueCount) || 0
        const all = closed + (Number(m.openIssueCount) || 0)
        return all ? closed + " of " + all + " closed (" + Math.round((closed * 100) / all) + "%)" : "no issues"
    }
    const fields = (f, m) =>
        h`${input(f, "name", "Name", {value: m.name || "", required: true, maxlength: 100})}${textarea(f, "description", "Description", {
            value: m.description || "",
            maxlength: 2000
        })}${input(f, "dueDate", "Due", {value: m.dueDate ? dateText(m.dueDate) : "", type: "date"})}${select(
            f,
            "state",
            "State",
            [
                ["open", "Open"],
                ["closed", "Closed"]
            ],
            {value: m.state || "open"}
        )}`
    const line = m => h`<small>${m.state === "closed" ? "Closed" : "Open"}${m.dueDate ? " · due " + dateText(m.dueDate) : ""} · ${progress(m)}</small>`
    if (milestoneId) {
        const m = list.find(item => item.milestoneId === milestoneId)
        if (!m) fail()
        const filters = filtersOf(false)
        const found = need("findIssues", {siteId, repositoryId, ...filters.input, milestoneId, state: "all"})
        const f = formOf(c, "storeMilestone", m.milestoneId)
        return {
            html: h`${sections(iu, "milestones")}<h2 class="wrap">${m.name}</h2><p>${line(m)}</p>${m.description ? h`<p class="card smithy-pre">${m.description}</p>` : ""}<section id="SmithyIssueList" aria-label="Issues">${
                found.issueList?.length ? issueRows(c, found.issueList, false) : h`<p class="card">No issues in this milestone.</p>`
            }</section>${found.nextCursor ? h`<p><a href="${iu.milestone(milestoneId)}${query({cursor: found.nextCursor})}">More issues</a></p>` : ""}${
                edits
                    ? h`${open(c, f, {title: ec.l10n.localize("Edit this milestone")})}${hidden("repositoryId", repositoryId)}${hidden("milestoneId", m.milestoneId)}${hidden("expectedRevision", m.revision)}${fields(f, m)}${submit(ec.l10n.localize("Save milestone"))}`
                    : ""
            }`.html
        }
    }
    const fresh = formOf(c, "storeMilestone")
    const rows = state =>
        list
            .filter(m => (m.state === "closed") === (state === "closed"))
            .map(
                m =>
                    h`<article class="card smithy-row" id="SmithyMilestone_${m.milestoneId}"><h3 class="wrap"><a href="${iu.milestone(m.milestoneId)}">${m.name}</a></h3><p>${line(m)}</p></article>`
            )
    const closed = rows("closed")
    return {
        html: h`${sections(iu, "milestones")}<h2>Milestones</h2><section id="SmithyMilestoneList" aria-label="Milestones">${list.length ? "" : h`<p class="card">This repository has no milestone.</p>`}${rows("open")}${
            closed.length ? h`<h3>Closed</h3>${closed}` : ""
        }</section>${
            edits
                ? h`${open(c, fresh, {title: "New milestone"})}${hidden("repositoryId", repositoryId)}${hidden("milestoneId", "")}${hidden("operationId", portal.operationId())}${fields(fresh, {})}${submit(ec.l10n.localize("Add milestone"))}`
                : ""
        }`.html
    }
}
;({
    issues,
    groupIssues,
    groupNewIssue,
    newIssue,
    issueDetail,
    labels,
    milestones,
    urlsOf,
    // what SmithyReview.js builds a merge request's conversation with
    clean,
    person,
    box,
    island,
    islandOf,
    ISLAND_SCRIPTS,
    textField,
    textButtons,
    postRow,
    side,
    WATCH
})
