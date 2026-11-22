/* Smithy's DG6 pages (Dogfood §5.5, §6; plan/design-smithy.md §11, §12.3 to §12.5): what a group or a repository adds
 * around the forum's own pages. The forum's screens themselves are mounted under the group's and the repository's shell
 * (GroupDetail/RepositoryDetail's Forum, Smithy/Moderation) and render with the shell's scope and link base
 * (Smithy.js forumScopeOf, Shared/View.js load); nothing of them is repeated here. Here: who reaches the scope's moderation
 * pages (its Owners; Not Found for anyone else), Report and Hide of a group or a repository, the Forum tab of their
 * Settings (the forum on or off, the mailing list's address and mode, a list archive's import, inviting a list's members,
 * the address for security reports), the page of a held report's link, and "Make an issue" on a topic. Every form posts to
 * Smithy/Do with the session token (SmithyForms.js run); every read and write is the authority's, through the facade.
 * CC0 plus patent grant. */
const smithy = ec.resource.script("component://mr-pass/screen/Smithy/Smithy.js")
const forms = ec.resource.script("component://mr-pass/screen/Smithy/SmithyForms.js")
const {portal, fail, maybe, param, enc, query, holds} = smithy
const {h, attributes, hidden, contextOf, banner, gate, formOf, open, input, textarea, select, check, submit} = forms

/* What a moderation or settings page acts on: the shell's group or repository as a moderation target. */
function targetOf(shell) {
    const r = shell.repository
    return r
        ? {
              targetType: "repository",
              targetId: r.repositoryId,
              path: r.repositoryPath,
              word: "repository",
              revision: r.revision,
              root: smithy.urls(shell.base, r.repositoryPath).root,
              key: {repositoryId: r.repositoryId}
          }
        : {
              targetType: "group",
              targetId: shell.group.groupId,
              path: shell.group.groupPath,
              word: "group",
              revision: shell.group.revision,
              root: shell.root,
              key: {groupId: shell.group.groupId}
          }
}
/* Who may hide a group or a repository (design §12.3): the site's staff, and an Owner of a group above it, never by a
 * role on the target itself (the read's canHide). */
const mayHide = shell => !!shell.capabilities?.canHide

/* Smithy/Moderation (design §12.3), at -/moderation[/…] of a group or a repository: the shell, and for the forum's review
 * queue, a review, a member and the log the scope they are limited to (the read's moderationContactListId: the group's
 * category, a repository's own or its group's). They are the scope's Owners' and the site's staff's: anyone else gets Not
 * Found, as for a path that does not exist. report is a confirmed viewer's page and hide is for who may hide; each checks
 * its own caller (report, hide below), and neither has the queue's scope. */
function moderation(siteId, groupId, repositoryId, bases, path, moderationPath) {
    const shell = repositoryId
        ? smithy.repositoryShell(siteId, repositoryId, bases.smithy, path)
        : smithy.groupShell(siteId, groupId, bases.smithy, path)
    const own = ["report", "hide"].includes(String(moderationPath || ""))
    const scope = shell.moderationScope
    if (!own && !scope) fail()
    const t = targetOf(shell)
    return {
        group: repositoryId ? null : shell,
        repository: repositoryId ? shell : null,
        shell,
        scope: own ? null : scope,
        navHtml: own
            ? ""
            : h`<h2>Moderation</h2><nav aria-label="Moderation" class="card smithy-tabs" id="SmithyModerationNav"><a href="${scope.moderationBase}">Review queue</a><a href="${scope.moderationBase}/Log">Log</a>${
                  scope.enabled ? h`<a href="${scope.base}">Forum</a>` : ""
              }</nav><p><small>What waits for review around ${t.path}: held first posts and reports of its forum, issues and merge requests, reports of a repository or a subgroup inside it, and mail held from an address that is no account's.</small></p>`
                  .html
    }
}
const REASONS = [
    ["spam", ec.l10n.localize("Spam or advertising")],
    ["abuse", ec.l10n.localize("Abuse or harassment")],
    ["malware", ec.l10n.localize("Malware or a way to harm its users")],
    ["illegal", ec.l10n.localize("Something illegal")],
    ["other", "Something else"]
]
/* Report (design §12.3), at -/moderation/report: a confirmed viewer reports the group or the repository to the
 * moderators, with a reason and a note (reportSmithyTarget). */
function report(m, bases, siteInfo, self) {
    const shell = m.shell
    const c = contextOf(bases, siteInfo, self, shell.flash)
    const t = targetOf(shell)
    const head = h`<h2>Report this ${t.word}</h2>`
    const closed = gate(c, shell.capabilities?.confirmed)
    if (closed) return {html: h`${head}${closed}`.html}
    const f = formOf(c, "reportSmithyTarget")
    return {
        html: h`${head}${open(c, f, {successTo: t.root})}${hidden("targetType", t.targetType)}${hidden("targetId", t.targetId)}${hidden(
            "operationId",
            portal.operationId()
        )}<p>The moderators of ${t.path} and of this site read your report. It is not shown to anyone else.</p>${select(
            f,
            "reason",
            "What is wrong",
            REASONS,
            {
                value: "spam"
            }
        )}${textarea(f, "note", "What the moderators should know", {maxlength: 2000, rows: 4})}<p><button>Send report</button> <a href="${t.root}">Cancel</a></p></form>`
            .html
    }
}
/* Hide and Unhide (design §12.3), at -/moderation/hide: asked again on this page, which names the target and what follows
 * (hideSmithyTarget). Not Found for who may not hide. */
function hide(m, bases, siteInfo, self) {
    const shell = m.shell
    if (!mayHide(shell)) fail()
    const c = contextOf(bases, siteInfo, self, shell.flash)
    const t = targetOf(shell)
    const hiding = !shell.hidden
    const closed = gate(c, shell.capabilities?.confirmed)
    if (closed) return {html: h`<h2>${hiding ? "Hide" : "Unhide"} this ${t.word}</h2>${closed}`.html}
    const f = formOf(c, "hideSmithyTarget")
    return {
        html: h`${open(c, f, {title: (hiding ? "Hide " : "Unhide ") + t.path, successTo: t.root})}${hidden("targetType", t.targetType)}${hidden("targetId", t.targetId)}${hidden(
            "hidden",
            hiding ? "true" : "false"
        )}${hidden("expectedRevision", t.revision)}${hidden("confirm", "yes")}${
            hiding
                ? h`<p>After this the ${t.word} ${t.path}${
                      t.word === "group" ? " and everything inside it are" : " is"
                  } Not Found to everyone but ${t.word === "group" ? "its" : "its"} owners and the site's moderators: on its pages, in lists and search, and in git. Nothing is deleted, and it can be shown again.</p>`
                : h`<p>After this the ${t.word} ${t.path} is seen again by everyone its visibility allows. What a moderator of the site hid, only the site's moderators show again.</p>`
        }${input(f, "reason", "Reason", {required: true, maxlength: 500, hint: "Kept in the moderation log."})}<p><button>${
            hiding ? "Hide this " + t.word : "Show this " + t.word + " again"
        }</button> <a href="${t.root}">Cancel</a></p></form>`.html
    }
}
/* The Hide or Unhide link of a settings tab (a repository's Archive, a group's Delete; design §12.3), for who may hide. */
function hideLink(shell) {
    if (!mayHide(shell)) return ""
    const t = targetOf(shell)
    return h`<section class="card" id="SmithyHide"><h2>${shell.hidden ? "Hidden" : "Hide"}</h2><p>${
        shell.hidden
            ? "This " + t.word + " is hidden: Not Found to everyone but its owners and the site's moderators."
            : "Hiding makes this " +
              t.word +
              " Not Found to everyone but its owners and the site's moderators, and deletes nothing."
    }</p><p><a href="${t.root}/-/moderation/hide">${shell.hidden ? "Show it again" : "Hide this " + t.word}</a></p></section>`
}
/* A review of a group or a repository itself (a report; design §12.3), on the scope's ReviewDetail: where the target is
 * (getReview's target, for one the caller may view) and what each decision does. */
function reviewTarget(target, bases, siteId) {
    if (!target?.path) return ""
    const root = (bases.smithy || "") + "/" + enc(target.path)
    const word = target.targetType === "group" ? "group" : "repository"
    // the site's staff decide a report on what they may not view (design §12.3): its page is not linked for them
    const viewable = !!bases.smithy && !!maybe("resolveSmithyPath", {siteId, path: target.path})
    return h`<section class="card" id="SmithyReviewTarget"><h2>Reported ${word}</h2><p>${
        viewable ? h`<a href="${root}">${target.name || target.path}</a>` : h`<strong>${target.name || target.path}</strong>`
    } <small>${target.path} · ${target.visibility || ""}</small>${
        target.hidden ? h` <small class="smithy-chip">Hidden</small>` : ""
    }</p>${target.hidden && target.hideReason ? h`<p class="smithy-pre">${target.hideReason}</p>` : ""}${
        viewable ? "" : h`<p id="SmithyReviewTargetClosed">You decide this report, but this ${word} is not one you may open.</p>`
    }<p>The decision <strong>rejected</strong> hides this ${word}: it is then Not Found to everyone but its owners and the site's moderators, and nothing is deleted. <strong>dismissed</strong> leaves it as it is. ${
        target.hidden && viewable ? h`<a href="${root}/-/moderation/hide">Show it again</a>` : ""
    }</p></section>`.html
}

const LIST_MODES = [
    ["discussion", ec.l10n.localize("Discussion: topics and replies")],
    ["qa", ec.l10n.localize("Questions and answers")],
    ["list", ec.l10n.localize("Mailing list: mail to its address is a post, and its mail carries the list's own headers")]
]
const visibilityText = value =>
    ({public: "anyone, signed in or not", members: "every member of this site", private: "only those given a role"})[value] ||
    value
/* The Forum tab of a group's and a repository's Settings (design §6 GroupSettings, §11 RepositorySettings; Dogfood §6.1,
 * §6.3), for an Owner: the forum on or off (setScopeForum, which publishes the category or makes a repository's
 * subcategory), with the category's readers shown as following the group's or the repository's; and, once it is on, the
 * mailing list: its mode and address (the site's owners set them), an archive's import and its members' invitations; for
 * a group the address that files security reports (storeIssueMailRoute). head is the settings page's own heading and
 * tabs. */
function forumSettings(shell, head, bases, siteInfo, self) {
    const c = contextOf(bases, siteInfo, self, shell.flash)
    const siteId = shell.siteId
    const t = targetOf(shell)
    const scope = shell.forumScope
    const record = shell.repository || shell.group
    const top = new forms.Markup(head)
    const closed = gate(c, shell.capabilities?.confirmed)
    if (closed) return {html: h`${top}${closed}`.html}
    const on = !!scope?.enabled
    const key = Object.entries(t.key).map(([name, value]) => hidden(name, value))
    const f = formOf(c, "setScopeForum")
    const visibility = record.effectiveVisibility || record.visibility
    const state = h`${open(c, f, {title: "Forum"})}${key}${hidden("expectedRevision", t.revision)}${hidden("enabled", on ? "false" : "true")}<p id="SmithyForumState">${
        on
            ? h`The forum of ${t.path} is on: <a href="${scope.base}">${scope.base}</a>.`
            : shell.repository
              ? "This repository has no forum of its own: its issues and merge requests are discussed in its group's category. Turning it on makes a subcategory for it."
              : "This group's forum is off: its category is not shown. Turning it on publishes the category."
    }</p><p id="SmithyForumReaders">Its category is read by ${visibilityText(visibility)}: it follows the ${t.word}'s visibility.</p>${
        // linking a category of the site in place of the scope's own is for the site's owners and operators
        on || !siteInfo?.capabilities?.canManageSite
            ? ""
            : input(f, "contactListId", "Link an existing category (optional)", {
                  maxlength: 40,
                  hint:
                      "The id of a category of this site that no group or repository has, in place of the " +
                      t.word +
                      "'s own. Its topics are then read by who reads the " +
                      t.word +
                      "; a category that this would open to more readers is refused."
              })
    }${submit(on ? "Turn the forum off" : "Turn the forum on")}`
    const report = shell.group ? securityAddress(c, shell, siteId, siteInfo) : ""
    const moderationLink = shell.moderationScope
        ? h`<p><a href="${shell.moderationScope.moderationBase}">Moderation</a>: the review queue and the log of ${t.path}.</p>`
        : ""
    if (!on) return {html: h`${top}${state}${moderationLink}${report}`.html}
    return {html: h`${top}${state}${moderationLink}${listSettings(c, scope, siteId, siteInfo, self)}${report}`.html}
}
/* A group's address for security reports (design §12.4): mail to it from an account's confirmed address files a
 * confidential issue; from any other address it is held, and its sender is answered once with a link. An Owner names the
 * address and the repository; the site's staff turn it on. */
function securityAddress(c, shell, siteId, siteInfo) {
    const g = shell.group
    const route = shell.issueMailRoute
    const f = formOf(c, "storeIssueMailRoute")
    const repositories = (maybe("findRepositories", {siteId, groupId: g.groupId, limit: 100})?.repositoryList || []).filter(
        r => r.features?.issues
    )
    const staff = !!(siteInfo?.capabilities?.canModerateSite || siteInfo?.capabilities?.canManageSite)
    const chosen =
        repositories.find(r => r.repositoryPath === route?.repositoryPath)?.repositoryId || repositories[0]?.repositoryId || ""
    return h`${open(c, f, {title: "Security reports by mail"})}${hidden("groupId", g.groupId)}${hidden("expectedRevision", route?.revision ?? 0)}<p>Mail to this address from an account's confirmed address files a confidential issue, which only the owners read. Mail from any other address is not posted: it is held, its sender gets one reply with a link that files it, and until then it waits in the review queue of the repository's owners.</p>${
        route
            ? h`<p id="SmithyReportAddress">Now: ${route.address} · ${route.enabled ? "on" : "off"}${route.repositoryPath ? " · files in " + route.repositoryPath : ""}</p>`
            : ""
    }${
        repositories.length
            ? h`${input(f, "address", "Address", {
                  type: "email",
                  value: route?.address || "",
                  maxlength: 255,
                  required: true,
                  placeholder: "security@example.org",
                  hint: ec.l10n.localize("An address of a domain this site receives mail for.")
              })}${select(
                  f,
                  "repositoryId",
                  ec.l10n.localize("File the reports in"),
                  repositories.map(r => [r.repositoryId, r.repositoryPath]),
                  {value: chosen}
              )}${
                  staff
                      ? check("enabled", ec.l10n.localize("Receive reports at this address"), route ? route.enabled : true)
                      : h`${route?.enabled ? hidden("enabled", "true") : ""}<p><small>A moderator of the site turns a new or changed address on.</small></p>`
              }${submit(ec.l10n.localize("Save address"))}`
            : h`<p>Turn issues on in a repository of this group first: the reports are filed there.</p></form>`
    }`
}
/* The mailing list of a scope's category (Dogfood §6.3): its mode and address, which the site's owners set (the address's
 * domain is the site's to route), the import of an archive and the invitations of the old list's members, which the
 * scope's Owner runs. */
function listSettings(c, scope, siteId, siteInfo, self) {
    const contactListId = scope.contactListId
    const category = maybe("getCategory", {siteId, contactListId})?.category || {}
    const manager = !!siteInfo?.capabilities?.canManageSite
    const routes = manager ? maybe("findRoutes", {siteId})?.routeList || [] : []
    const route = routes.find(r => r.contactListId === contactListId && (!r.targetType || r.targetType === "category")) || null
    const isList = category.mode === "list"
    const mode = formOf(c, "storeCategory")
    const address = formOf(c, "storeRoute")
    const held = h`<p id="SmithyListHeld"><small>Posting needs an account with a confirmed address, by mail too. A message from an address that is no account's is not posted: it is held, its sender gets one reply with the link that makes the account, and it waits in <a href="${scope.moderationBase}">the review queue</a> for 30 days.</small></p>`
    const out = manager
        ? [
              h`${open(c, mode, {title: "Mailing list"})}${hidden("contactListId", contactListId)}${hidden("expectedRevision", category.policyRevision ?? "")}${select(
                  mode,
                  "mode",
                  "This forum is",
                  LIST_MODES,
                  {
                      value: category.mode || "discussion",
                      hint: "A mailing list's mail carries its own List-Id, List-Post and List-Archive, by its address."
                  }
              )}${submit("Save")}`,
              h`${open(c, address, {title: "List address"})}${hidden("contactListId", contactListId)}${hidden("routeId", route?.routeId || "")}${hidden(
                  "expectedRevision",
                  route?.revision ?? 0
              )}${hidden("operationId", portal.operationId())}${input(address, "address", "Address", {
                  type: "email",
                  value: route?.address || "",
                  required: true,
                  maxlength: 255,
                  placeholder: "dev@lists.example.org",
                  hint: "Mail to it starts a topic here, and a reply by mail is a post. Its domain must be one this site receives mail for (Deployment, Mailing lists)."
              })}${check("active", "Receive mail at this address", route ? route.enabled === "Y" || route.enabled === true : true)}${submit(ec.l10n.localize("Save address"))}${isList ? held : ""}`
          ]
        : [
              h`<section class="card" id="SmithyListMode"><h2>Mailing list</h2><p>${
                  isList
                      ? "This forum is a mailing list: mail to its address is a post, and its mail carries the list's own headers."
                      : "This forum is not a mailing list. An owner of the site makes it one and gives it its address."
              }</p>${isList ? held : ""}</section>`
          ]
    if (isList) out.push(listImport(c, scope, siteId, self), listInvitations(c, scope, siteId, self))
    return out
}
/* The import of a list's archive (Dogfood §6.3; on the model of Forum/Settings/Import): the operator puts the mbox file in
 * the site's own directory under the server's import directory (<import-dir>/<siteId>/), and the run is started here by
 * the file's name and checksum (importMbox). The page of a
 * run (?importId=, where the start's answer leads) shows its progress and what was not carried. Starting the same archive
 * again resumes it: nothing is made twice. */
const REPORT = [
    ["messages", ec.l10n.localize("Messages read")],
    ["topics", ec.l10n.localize("Topics made")],
    ["replies", ec.l10n.localize("Replies made")],
    ["duplicates", ec.l10n.localize("Already there")],
    ["attachments", ec.l10n.localize("Attachments left out")],
    ["unknownCharset", ec.l10n.localize("In a character set that could not be read")],
    ["tooLong", ec.l10n.localize("Too long")],
    ["empty", "Empty"],
    ["unreadable", "Unreadable"],
    ["failed", "Failed"]
]
function listImport(c, scope, siteId, self) {
    const contactListId = scope.contactListId
    const f = formOf(c, "importMbox")
    const shown = param("importId")
    const found = shown ? portal.attempt("getMboxImport", {siteId, importId: shown}) : null
    const run = found?.result?.import?.contactListId === contactListId ? found.result.import : null
    const report = run?.report || {}
    const here = self.split("?")[0]
    const known = REPORT.map(([name]) => name)
    return h`<section class="card" id="SmithyListImport"><h2>Import an archive</h2><p>An mbox file of the old list becomes topics and posts here, threaded by Message-ID, In-Reply-To and References, with their dates. An author is a profile by address, which the person makes theirs by registering with that address. No mail is sent.</p>${
        found?.error ? h`<p role="alert" class="error">${found.error.message}</p>` : ""
    }${
        run
            ? h`<div id="SmithyListImportRun"><h3 class="wrap">${run.sourceName || run.archiveName} <small class="smithy-chip">${run.stage}${
                  run.runState ? " · " + run.runState : ""
              }</small></h3><table class="lines">${[
                  ...REPORT,
                  ...Object.keys(report)
                      .filter(name => !known.includes(name))
                      .map(name => [name, name])
              ]
                  .filter(([name]) => report[name] != null && typeof report[name] !== "object")
                  .map(
                      ([name, label]) => h`<tr><th scope="row">${label}</th><td>${report[name]}</td></tr>`
                  )}</table><p><a href="${here}${query({
                  importId: run.importId
              })}#SmithyListImport">Refresh</a> · To resume a run that stopped, start the same file again below: what it has made is not made twice.</p></div>`
            : ""
    }${open(c, f, {plain: true, returnTo: here + "#SmithyListImport"})}${hidden("contactListId", contactListId)}${input(
        f,
        "archiveName",
        "Archive file",
        {
            value: run?.archiveName || "",
            required: true,
            maxlength: 200,
            hint: "The name of an mbox file in this site's directory under the server's import directory (Deployment, Mailing lists)."
        }
    )}${input(f, "checksum", "SHA-256 checksum of the file", {required: true, maxlength: 64, pattern: "[0-9A-Fa-f]{64}", autocomplete: "off"})}${input(
        f,
        "sourceName",
        "Name of the old list (optional)",
        {value: run?.sourceName || "", maxlength: 250}
    )}<p><button>${run ? "Start or resume the import" : "Start the import"}</button></p></form></section>`
}
/* Inviting a list's members (Dogfood §6.3): each address pasted here is sent one invitation (inviteListMembers). Its link
 * is the Account app's Invitation page, where the person signs in or registers with that address and accepts; that
 * subscribes the account to every post of this list. Nobody is subscribed without it. */
function listInvitations(c, scope, siteId, self) {
    const f = formOf(c, "inviteListMembers")
    return h`<section class="card" id="SmithyListInvitations"><h2>Invite the list's members</h2><p>Each address gets one invitation by mail. Its link confirms the address with an account (the person signs in, or registers with that address) and subscribes it to every post here. Nobody is subscribed without it. An address with an open invitation is not mailed again; an invitation lasts 14 days, after which sending the address again invites it again.</p>${open(
        c,
        f,
        {plain: true, returnTo: self.split("?")[0] + "#SmithyListInvitations"}
    )}${hidden("contactListId", scope.contactListId)}${hidden("operationId", portal.operationId())}${textarea(
        f,
        "addresses",
        "Addresses",
        {
            rows: 6,
            required: true,
            maxlength: 20000,
            hint: "Up to 500 at a time, one a line or separated by commas."
        }
    )}<p><button>Send invitations</button></p></form></section>`
}

/* The page of a held report's link (design §12.4), -/held-report/<token>: mail to a security address from an address that is
 * no account's was held, and its sender got this link. The page writes nothing: a visitor is asked to sign in or register
 * and comes back; a signed-in account files the report with the form (claimHeldReport, which needs the account's confirmed
 * address to be the sender's), and a used or expired link is said so on its refusal. It is a whole page of its own, in
 * the site's shell, and never kept by a cache. */
function heldReport(siteId, token, bases, siteInfo, self) {
    ec.web.response.setHeader("Cache-Control", "no-store")
    const context = {
        siteInfo,
        passBases: bases,
        passApp: "smithy",
        passPublicPage: false,
        publicPath: self,
        canonicalUrl: null,
        view: {title: "Your report"}
    }
    const response = ec.web.response
    response.setContentType("text/html")
    response.write(
        String(ec.resource.template("component://mr-pass/screen/Shared/Header.html.fancy", context)) +
            heldReportBody(token, bases, siteInfo, self, smithy.takeFlash()) +
            String(ec.resource.template("component://mr-pass/screen/Shared/Footer.html.fancy", context))
    )
}
/* The held report page's content inside the shell: Sign in (and Register) for a visitor, the claim's form for an account. */
function heldReportBody(token, bases, siteInfo, self, flash) {
    const c = contextOf(bases, siteInfo, self, flash)
    const f = formOf(c, "claimHeldReport")
    const back = encodeURIComponent(self)
    const body = !c.signedIn
        ? h`<p class="card" id="SmithySignIn">Your report is waiting. To file it, sign in with the address you sent it from, or register with that address and come back to this link. <a href="${c.account}/Login?returnTo=${back}">Sign in</a>${
              siteInfo?.site?.registrationMode === "open"
                  ? h` · <a href="${c.account}/Register?returnTo=${back}">Register</a>`
                  : ""
          }</p>`
        : h`${open(c, f)}${hidden("token", token)}${hidden("operationId", portal.operationId())}<p>Your message is filed as a confidential issue, which only the owners of the project and you read. It is filed as your account, so the address you sent it from must be this account's confirmed address.</p>${
              f.error?.notFound
                  ? h`<p id="SmithyHeldGone">This link was used already or has expired. A held message is kept for 30 days.</p>`
                  : ""
          }${submit("File my report")}`
    return h`<h1>Your report</h1>${banner(c)}${body}`.html
}

/* "Make an issue" (design §12.5) under a topic shown in a group's or a repository's forum, for a role that may triage: the
 * repository, the title and the posts whose text the issue quotes (convertTopicToIssue). The topic stays, and shows the
 * issue among its related records. Empty for anyone else, and for a private conversation. */
function topicTools(shell, view, bases, siteInfo, self) {
    const topic = view.topic
    if (!topic || !siteInfo?.authenticated) return ""
    const siteId = shell.siteId
    const repositories = shell.repository
        ? shell.capabilities?.canTriage && shell.repository.features?.issues
            ? [shell.repository]
            : []
        : holds(shell.myRole, "reporter")
          ? (maybe("findRepositories", {siteId, groupId: shell.group.groupId, limit: 100})?.repositoryList || []).filter(
                r => r.features?.issues
            )
          : []
    if (!repositories.length) return ""
    const c = contextOf(bases, siteInfo, self, shell.flash)
    const f = formOf(c, "convertTopicToIssue")
    const first = view.rows?.[0]?.postId
    return h`<details class="card" id="SmithyMakeIssue"${attributes({open: !!f.error})}><summary>Make an issue</summary>${open(c, f, {plain: true, returnTo: self + "#SmithyMakeIssue"})}${hidden(
        "rootCommEventId",
        topic.rootCommEventId
    )}${hidden("operationId", portal.operationId())}<p>The issue quotes the posts you choose and links this topic, which stays as it is.</p>${select(
        f,
        "repositoryId",
        "Repository",
        repositories.map(r => [r.repositoryId, r.repositoryPath]),
        {value: repositories[0].repositoryId}
    )}${input(f, "title", "Title", {value: topic.title || "", required: true, maxlength: 250})}<fieldset><legend>Posts to quote</legend>${(
        view.rows || []
    )
        .filter(row => row.postId && row.visibility !== "deleted")
        .map(row =>
            check(
                "postIds",
                (row.author?.displayName || row.author?.handle || "Community member") + " · " + (row.dateText || ""),
                row.postId === first,
                row.postId
            )
        )}</fieldset>${check("confidential", "Confidential: only the owners and I read the issue", false)}${submit("Make the issue")}</details>`
        .html
}
/* The discussion of an issue or a merge request (design §8.2 discussion; §12.5): the forum topic it was made from or that
 * discusses it, as a link card. In the repository's own forum when that is on, else in the site's. */
function discussionCard(shell, discussion, bases, siteInfo) {
    if (!discussion?.rootCommEventId) return ""
    const mounted = (siteInfo?.mounts || []).some(m => m.app === "forum")
    const base = shell.forumScope?.enabled
        ? shell.forumScope.base
        : mounted
          ? bases.forum || ""
          : shell.group?.groupPath
            ? shell.base + "/" + enc(shell.group.groupPath) + "/-/forum"
            : null
    const title = discussion.title || "Discussion"
    return h`<section class="card" id="SmithyDiscussion" aria-label="Discussion"><p><strong>Discussion</strong></p><p class="wrap">${
        base ? h`<a href="${base}/t/${encodeURIComponent(discussion.rootCommEventId)}">${title}</a>` : title
    }</p></section>`
}
;({moderation, report, hide, hideLink, reviewTarget, forumSettings, heldReport, heldReportBody, topicTools, discussionCard, targetOf, mayHide})
