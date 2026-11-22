/* Smithy's pages that write (Dogfood DG2; plan/design-smithy.md §1, §4.4, §6, §11): NewGroup, NewRepository, SiteSettings, a
 * group's Settings and Members, a repository's Settings, creating and deleting a branch or tag, and Account's Git access; the
 * forms and transitions of DG3's issue pages (SmithyIssues.js) are made with what is here. Each
 * page is plain HTML whose forms post to a transition of Smithy/Do with the session token (run, below): the transition calls
 * one operation through the facade (Shared/Portal.js attempt), then answers 303, to the canonical page after a write, or back
 * to the form with the refusal's text and what was typed (Smithy.js setFlash). An ending or audience-widening action
 * (delete, transfer, archive, a visibility change, removing a key) is asked again on a page that names the target and the
 * consequence, and its transition refuses without that page's answer. The authority checks every write; a page only leaves
 * out what would be refused. Text is escaped by h, below, unless it is markup built here. CC0 plus patent grant. */
const smithy = ec.resource.script("component://mr-pass/screen/Smithy/Smithy.js")
const {portal, fail, need, maybe, param, esc, enc, query, dateText, sizeText, holds} = smithy

/* Markup built here; anything else h is given is escaped. It is known by a symbol, which no data read from the authority or
 * the request can carry, and which every page script shares (each loads its own copy of this one). */
const MARKUP = Symbol.for("pass.smithy.markup")
class Markup {
    constructor(html) {
        this.html = String(html)
        this[MARKUP] = true
    }
}
const toHtml = value =>
    value == null || value === false || value === true
        ? ""
        : Array.isArray(value)
          ? value.map(toHtml).join("")
          : typeof value === "object" && value[MARKUP] === true
            ? value.html
            : esc(value)
const h = (strings, ...values) =>
    new Markup(strings.reduce((out, part, i) => out + part + (i < values.length ? toHtml(values[i]) : ""), ""))
const attributes = map =>
    new Markup(
        Object.entries(map)
            .filter(([, value]) => value != null && value !== false)
            .map(([name, value]) => " " + name + (value === true ? "" : '="' + esc(value) + '"'))
            .join("")
    )
const hidden = (name, value) => h`<input type="hidden" name="${name}" value="${value ?? ""}">`

/* What a page's forms share: the mount's base, the Account app's base, the page's own address and the last post's flash. */
function contextOf(bases, siteInfo, self, flash) {
    return {
        base: bases.smithy || "",
        account: bases.account ?? "/account",
        self,
        signedIn: !!siteInfo?.authenticated,
        flash: flash || {}
    }
}
/* The notice of the last post, for a page with no group or repository shell. */
const banner = c => (c.flash.notice ? h`<p role="status" class="card" id="SmithyNotice">${c.flash.notice}</p>` : "")
/* In place of a form: the sign-in link, or "Confirm your email address" (design §5.5); null when the caller may write. */
function gate(c, confirmed) {
    if (!c.signedIn)
        return h`<p class="card" id="SmithySignIn">Sign in to continue. <a href="${c.account}/Login?returnTo=${encodeURIComponent(c.self)}">Sign in</a></p>`
    if (confirmed === false)
        return h`<p class="card" id="SmithyConfirmAddress">Confirm your email address to do this. <a href="${c.account}/Settings">Open your account</a></p>`
    return null
}
/* One form of a page: name is its transition of Smithy/Do, key tells one of several of that name apart (a rule's id). It has
 * the last post's refusal and typed values when that post was this form's. */
function formOf(c, name, key) {
    const flash = c.flash
    const mine = flash.form === name && String(flash.key || "") === String(key || "")
    const error = mine ? flash.error : null
    return {
        name,
        key: key || "",
        id: "Smithy_" + name + (key ? "_" + String(key).replace(/[^A-Za-z0-9_-]/g, "_") : ""),
        error,
        // a text's preview, asked from this form (the previewPost transition): the authority's cleaned markup
        preview: mine && flash.preview ? String(flash.preview) : null,
        value: (field, fallback) =>
            mine && flash.values && Object.hasOwn(flash.values, field) ? flash.values[field] : (fallback ?? ""),
        invalid: field => !!error && error.field === field
    }
}
/* A form's start: its refusal, the session token, where a refusal returns (returnTo) and, when it differs, where a success
 * goes (successTo). */
function open(c, f, options = {}) {
    return h`<form method="post" class="${options.plain ? "smithy-inline" : "card"}" id="${f.id}" action="${c.base}/-/do/${f.name}">${
        options.title ? h`<h2>${options.title}</h2>` : ""
    }${
        f.error
            ? h`<p role="alert" class="error" id="${f.id}_error">${f.error.message}${
                  f.error.signIn ? h` <a href="${c.account}/Login?returnTo=${encodeURIComponent(c.self)}">Sign in again</a>` : ""
              }</p>`
            : ""
    }${hidden("moquiSessionToken", ec.web.sessionToken)}${hidden(
        "returnTo",
        options.returnTo ?? c.self
    )}${options.successTo ? hidden("successTo", options.successTo) : ""}${f.key ? hidden("formKey", f.key) : ""}`
}
const described = (f, name) => (f.invalid(name) ? {"aria-invalid": "true", "aria-describedby": f.id + "_error"} : {})
const hint = text => (text ? h`<p><small>${text}</small></p>` : "")
function input(f, name, label, options = {}) {
    return h`<label>${label}${options.required ? " *" : ""} <input${attributes({
        type: options.type || "text",
        name,
        // a secret is never written back into a page
        value: options.secret ? null : f.value(name, options.value),
        maxlength: options.maxlength,
        required: !!options.required,
        pattern: options.pattern,
        autocomplete: options.autocomplete,
        inputmode: options.inputmode,
        min: options.min,
        step: options.step,
        placeholder: options.placeholder,
        ...described(f, name)
    })}></label>${options.was ? hidden("was_" + name, options.value ?? "") : ""}${hint(options.hint)}`
}
function textarea(f, name, label, options = {}) {
    return h`<label>${label}${options.required ? " *" : ""} <textarea${attributes({
        name,
        rows: options.rows || 3,
        maxlength: options.maxlength,
        required: !!options.required,
        ...described(f, name)
        // a newline right after the tag is dropped by the HTML parser: one is written, so a text's own first newline stays
    })}>${"\n"}${f.value(name, options.value)}</textarea></label>${hint(options.hint)}`
}
function select(f, name, label, choices, options = {}) {
    const chosen = String(f.value(name, options.value))
    return h`<label>${label} <select${attributes({name, ...described(f, name)})}>${choices.map(
        ([value, text]) => h`<option value="${value}"${attributes({selected: String(value) === chosen})}>${text}</option>`
    )}</select></label>${hint(options.hint)}`
}
const check = (name, label, checked, value) =>
    h`<label><input type="checkbox" name="${name}" value="${value ?? "true"}"${attributes({checked: !!checked})}> ${label}</label>`
const submit = (label, more) => h`<p><button>${label}</button>${more || ""}</p></form>`

const VISIBILITY = [
    ["public", ec.l10n.localize("Public: anyone may read it")],
    ["members", ec.l10n.localize("Members: the members of this site")],
    ["private", ec.l10n.localize("Private: only those given a role")]
]
/* The visibilities no wider than a ceiling (a group's, for what is inside it). */
const visibilities = ceiling => {
    const at = VISIBILITY.findIndex(([value]) => value === ceiling)
    return VISIBILITY.slice(at < 0 ? 0 : at)
}
const visibilityText = value =>
    ({public: "anyone, signed in or not", members: "every member of this site", private: "only those given a role"})[value] ||
    value
const ROLES = [
    ["guest", "Guest"],
    ["reporter", "Reporter"],
    ["developer", "Developer"],
    ["maintainer", "Maintainer"],
    ["owner", "Owner"]
]
/* A create policy as the settings projection names it (operators, request, verified), whichever way the authority writes it. */
const policyOf = value =>
    String(value || "")
        .replace(/^Scp/, "")
        .toLowerCase()
const POLICIES = [
    ["operators", ec.l10n.localize("Operators only")],
    ["request", ec.l10n.localize("By request, approved by an operator")],
    ["verified", ec.l10n.localize("Any account with a confirmed address")]
]
const NAME_PATH = /^[a-z0-9][a-z0-9_-]{1,38}(?:\/[a-z0-9][a-z0-9_-]{1,38}){0,4}$/
/* A size in bytes as the MiB a form shows, to three decimals at most; a form sends back only a size that was changed. */
const mibOf = bytes =>
    bytes == null || bytes === "" || !Number.isFinite(Number(bytes)) ? "" : String(Number((Number(bytes) / 1048576).toFixed(3)))
const tabsOf = (label, tabs, current) =>
    h`<nav aria-label="${label}" class="card smithy-tabs">${tabs.map(([tab, text, href]) => h`<a href="${href}"${attributes({"aria-current": tab === current ? "page" : null})}>${text}</a>`)}</nav>`

/* A page that asks again before an ending or audience-widening action: the target and the consequence (lines), the action's
 * fields, and for a delete the path typed. A refusal returns here; a success goes to successTo unless the action has its own
 * page. */
function confirmCard(c, name, o) {
    const f = formOf(c, name)
    return h`${open(c, f, {title: o.title, returnTo: o.returnTo, successTo: o.successTo})}${o.lines.map(line => h`<p>${line}</p>`)}${Object.entries(
        o.fields
    ).map(([field, value]) => hidden(field, value))}${hidden("confirm", "yes")}${
        o.typed ? input(f, o.typed.name, o.typed.label, {required: true, autocomplete: "off", secret: true}) : ""
    }<p><button>${o.button}</button> <a href="${o.cancelHref}">Cancel</a></p></form>`
}

/* NewGroup (design §6): create or request a top-level group by the site's policy, or a subgroup of ?parent= by its Owner. */
function newGroup(siteId, bases, siteInfo, self) {
    const c = contextOf(bases, siteInfo, self, smithy.takeFlash())
    const parentPath = String(param("parent") || "").toLowerCase()
    const head = title => h`<h1>${title}</h1>${banner(c)}`
    let parent = null
    if (parentPath) {
        if (!NAME_PATH.test(parentPath)) fail()
        const found = need("resolveSmithyPath", {siteId, path: parentPath})
        if (found.kind !== "group") fail()
        parent = need("getGroup", {siteId, groupId: found.groupId})
    }
    const title = parent ? ec.resource.expand("New subgroup of ${path}", "", {path: parent.group.groupPath}) : ec.l10n.localize("New group")
    // the policy projection: the three policies, and what the caller may start
    const settings = maybe("getSmithySettings", {siteId}) || {}
    const confirmed = !c.signedIn ? null : parent ? parent.capabilities.confirmed : settings.capabilities?.confirmed
    const closed = gate(c, confirmed)
    if (closed) return {html: h`${head(title)}${closed}`.html}
    const body = f =>
        h`${input(f, "pathSegment", "Path", {
            required: true,
            maxlength: 39,
            pattern: "[a-z0-9][a-z0-9_\\-]{1,38}",
            autocomplete: "off",
            hint:
                "2 to 39 lower case letters, digits, underscores or hyphens. It is the group's address: " +
                c.base +
                "/" +
                (parent ? parent.group.groupPath + "/" : "") +
                "<path>"
        })}${input(f, "name", "Name", {maxlength: 255})}${textarea(f, "description", "Description", {maxlength: 2000})}`
    if (parent) {
        if (!parent.capabilities.canCreateSubgroup)
            return {
                html: h`${head(title)}<p class="card" id="SmithyNoAccess">Only an Owner of ${parent.group.groupPath} makes a subgroup of it.</p>`
                    .html
            }
        const f = formOf(c, "createSubgroup")
        return {
            html: h`${head(title)}${open(c, f)}${hidden("groupId", parent.group.groupId)}${hidden("operationId", portal.operationId())}${body(f)}${select(
                f,
                "visibility",
                "Visibility",
                visibilities(parent.group.visibility),
                {value: parent.group.visibility, hint: "A subgroup is no wider than its group."}
            )}${submit("Create subgroup")}`.html
        }
    }
    const policy = policyOf(settings.groupCreate)
    const owner = !!siteInfo.capabilities?.canManageSite
    const says = owner
        ? ec.l10n.localize("You manage this site, so the group is created at once and you are its Owner.")
        : policy === "operators"
          ? ec.l10n.localize("On this site only its operators create groups.")
          : policy === "verified"
            ? ec.l10n.localize("The group is created at once and you are its Owner.")
            : "Groups on this site are made by request. An operator reviews yours; when it is approved the group opens and you are its Owner. You may have one request waiting."
    if (policy === "operators" && !owner) return {html: h`${head(title)}<p class="card" id="SmithyGroupPolicy">${says}</p>`.html}
    if (!owner && settings.capabilities?.groupRequestWaiting)
        return {
            html: h`${head(title)}<p class="card" id="SmithyGroupPolicy">${says}</p><p class="card" id="SmithyRequestWaiting">Your request for a group is waiting for an operator's decision.</p>`
                .html
        }
    const f = formOf(c, "requestGroup")
    const byRequest = !owner && policy !== "verified"
    return {
        html: h`${head(title)}<p class="card" id="SmithyGroupPolicy">${says}</p>${open(c, f)}${hidden("operationId", portal.operationId())}${body(f)}${select(
            f,
            "visibility",
            "Visibility",
            VISIBILITY,
            {value: "private"}
        )}${byRequest ? textarea(f, "reason", "Why you need this group", {maxlength: 2000, required: true}) : ""}${submit(byRequest ? "Request group" : "Create group")}`
            .html
    }
}
/* NewRepository (design §6): in the account's own namespace, or in a group where the caller is a Maintainer. */
function newRepository(siteId, bases, siteInfo, self) {
    const c = contextOf(bases, siteInfo, self, smithy.takeFlash())
    const head = h`<h1>New repository</h1>${banner(c)}`
    const settings = maybe("getSmithySettings", {siteId}) || {}
    const closed = gate(c, c.signedIn ? settings.capabilities?.confirmed : null)
    if (closed) return {html: h`${head}${closed}`.html}
    const groups = maybe("findGroups", {siteId, mine: true, limit: 100})?.groupList || []
    const namespace = String(param("namespace") || "").toLowerCase()
    const handle = siteInfo.profile?.handle
    const f = formOf(c, "createRepository")
    const policy = policyOf(settings.repositoryCreate)
    return {
        html: h`${head}${open(c, f)}${hidden("operationId", portal.operationId())}${select(
            f,
            "groupId",
            "Namespace",
            [["", handle ? "Your own: " + handle : "Your own namespace"], ...groups.map(g => [g.groupId, g.groupPath])],
            {
                value: groups.find(g => g.groupPath === namespace)?.groupId || "",
                hint:
                    "A group's repository needs its Maintainer." +
                    (policy === "operators"
                        ? " On this site only its operators make a repository of their own."
                        : handle
                          ? ""
                          : " Choose a handle in your account before making one of your own.")
            }
        )}${input(f, "slug", "Path", {
            required: true,
            maxlength: 100,
            pattern: "[a-z0-9_][a-z0-9_.\\-]{0,99}",
            autocomplete: "off",
            hint: "Lower case letters, digits, underscores, hyphens and dots. It is the last part of the repository's address."
        })}${input(f, "name", "Name", {maxlength: 255})}${textarea(f, "description", "Description", {maxlength: 255})}${select(
            f,
            "visibility",
            "Visibility",
            VISIBILITY,
            {
                value: "private",
                hint: "A repository is no wider than its group."
            }
        )}${check("withReadme", "Start with a README", false)}${submit("Create repository")}`.html
    }
}

/* Whose limits getQuotaUsage answers: a group's path or an account's handle. */
const ownerText = owner =>
    owner && typeof owner === "object" ? owner.groupPath || (owner.handle ? "@" + owner.handle : "") : owner || ""
/* What a quota page shows of getQuotaUsage: each limit beside its use. */
function quotaTable(found) {
    const limits = found.limits || {}
    const usage = found.usage || {}
    const row = (label, key, format) =>
        limits[key] == null && usage[key] == null
            ? ""
            : h`<tr><th scope="row">${label}</th><td>${usage[key] == null ? "" : format(usage[key])}</td><td>${limits[key] == null ? "No limit" : format(limits[key])}</td></tr>`
    return h`<div class="card table-wrap"><table class="lines" id="SmithyQuota"><thead><tr><th scope="col">${ownerText(found.owner)}</th><th scope="col">Used</th><th scope="col">Limit</th></tr></thead><tbody>${row(
        "Repositories",
        "repositories",
        String
    )}${row("Repository size", "repositoryBytes", sizeText)}${row("Git LFS", "lfsBytes", sizeText)}${row("Runner minutes this month", "runnerMinutes", String)}</tbody></table></div>`
}
/* SiteSettings (design §11): who may create, the kind of a new repository, the default quotas and (DG5) when an outside
 * pipeline run waits for approval; the group requests and
 * their decision; an account's or a group's limits. The site's owners and operators only; Not Found for anyone else. */
function site(siteId, bases, siteInfo, self, tab) {
    const settings = need("getSmithySettings", {siteId})
    // the authority answers the site's own fields, with their revision, to its owners and operators alone
    if (!siteInfo.capabilities?.canManageSite || settings.revision == null) fail()
    const c = contextOf(bases, siteInfo, self, smithy.takeFlash())
    const root = c.base + "/-/site"
    const current = tab || "settings"
    const head = h`<h1>Site settings</h1>${banner(c)}${tabsOf(
        "Site settings",
        [
            ["settings", "Settings", root],
            ["requests", "Group requests", root + "/requests"],
            ["quotas", "Quotas", root + "/quotas"],
            ["redirects", "Redirects", root + "/redirects"]
        ],
        current
    )}`
    // DG7: the site's table of old paths (SmithySite.js)
    if (current === "redirects")
        return ec.resource.script("component://mr-pass/screen/Smithy/SmithySite.js").redirects(siteId, c, head, root + "/redirects")
    if (current === "requests") {
        const cursor = param("cursor")
        const found = need("findGroupRequests", {siteId, status: "requested", limit: 30, ...(cursor ? {cursor} : {})})
        const rows = (found.requestList || []).map(r => {
            const g = r.group || {}
            const f = formOf(c, "decideGroupRequest", g.groupId)
            return h`<article class="card smithy-row" id="SmithyRequest_${g.groupId}"><h3 class="wrap">${g.groupPath} <small class="smithy-chip">${g.visibility}</small></h3><p>${
                g.name
            }${g.description ? " · " + g.description : ""}</p><p><small>Asked by ${r.requestedBy ? "@" + r.requestedBy : "an account"}${
                r.createdAt ? " on " + dateText(r.createdAt) : ""
            }</small></p>${r.requestReason ? h`<p class="smithy-pre">${r.requestReason}</p>` : ""}${open(c, f, {plain: true})}${hidden("groupId", g.groupId)}${hidden(
                "expectedRevision",
                g.revision
            )}${input(f, "reason", "Reason, sent to the requester", {maxlength: 2000})}<p><button name="decision" value="approve">Approve</button> <button name="decision" value="refuse">Refuse</button></p></form></article>`
        })
        return {
            html: h`${head}<section id="SmithyRequestList" aria-label="Group requests">${rows.length ? rows : h`<p class="card">No group requests are waiting.</p>`}</section>${
                found.nextCursor ? h`<p><a href="${root}/requests${query({cursor: found.nextCursor})}">More requests</a></p>` : ""
            }`.html
        }
    }
    if (current === "quotas") {
        const of = String(param("of") || "")
            .replace(/^@/, "")
            .toLowerCase()
        const find = h`<form method="get" action="${root}/quotas" class="card" role="search" id="SmithyQuotaFind"><label>Account handle or group path <input name="of" value="${of}" maxlength="200" required></label><button>Show</button></form>`
        if (!of) return {html: h`${head}${find}`.html}
        const target = NAME_PATH.test(of) ? maybe("resolveSmithyPath", {siteId, path: of}) : null
        const who =
            target?.kind === "group"
                ? {groupId: target.groupId}
                : target?.kind === "account"
                  ? {handle: target.handle || of}
                  : null
        const found = who ? portal.attempt("getQuotaUsage", {siteId, ...who}) : null
        if (!found || found.error)
            return {
                html: h`${head}${find}<p role="alert" class="error">${found?.error?.message || "No account or group has that name."}</p>`
                    .html
            }
        const q = found.result
        const limits = q.limits || {}
        // a field holds the account's or group's own limit (empty where it has none), never the limit in effect, which may
        // be the site's default: saving sends only what was changed, and a field emptied gives up its own limit
        const own = q.ownLimits || {}
        const f = formOf(c, "setQuota")
        const limit = (name, label, key, show) =>
            input(f, name, label, {
                value: show(own[key]),
                was: true,
                inputmode: "decimal",
                maxlength: 15,
                hint: limits[key] == null
                    ? ec.l10n.localize("In effect now: no limit. This is its own limit; empty follows the default.")
                    : ec.resource.expand("In effect now: ${value}. This is its own limit; empty follows the default.", "", {value: show(limits[key])})
            })
        const whole = value => (value == null ? "" : String(value))
        return {
            html: h`${head}${find}${quotaTable(q)}${open(c, f, {title: "Limits of " + (ownerText(q.owner) || of), returnTo: root + "/quotas" + query({of})})}${
                who.groupId ? hidden("groupId", who.groupId) : hidden("handle", who.handle)
            }${hidden("expectedRevision", q.revision)}${who.handle ? limit("maxRepositories", "Repositories", "repositories", whole) : ""}${limit(
                "maxRepositoryBytes",
                "Size of a repository, MiB",
                "repositoryBytes",
                mibOf
            )}${limit("maxLfsBytes", "Git LFS, MiB", "lfsBytes", mibOf)}${limit("runnerMinutesMonthly", "Runner minutes a month", "runnerMinutes", whole)}${
                who.handle
                    ? h`${select(
                          f,
                          "bot",
                          ec.l10n.localize("This account is a bot"),
                          [
                              ["false", "No"],
                              ["true", "Yes"]
                          ],
                          {value: q.bot ? "true" : "false"}
                      )}${hidden("was_bot", q.bot ? "true" : "false")}${input(f, "botOperatorHandle", ec.l10n.localize("The bot's operator (a handle)"), {value: q.botOperatorHandle || "", was: true, maxlength: 39})}`
                    : ""
            }${input(f, "reason", "Reason", {maxlength: 2000})}${submit("Save limits")}`.html
        }
    }
    const f = formOf(c, "storeSmithySettings")
    // a number is sent only when it was changed, so a size shown rounded is not stored rounded
    const number = (name, label, value, more) =>
        input(f, name, label, {value: value ?? "", was: true, inputmode: "decimal", maxlength: 15, ...(more || {})})
    const policy = (name, label) => select(f, name, label, POLICIES, {value: policyOf(settings[name])})
    return {
        html: h`${head}${open(c, f)}${hidden("expectedRevision", settings.revision)}<fieldset><legend>Who may create</legend>${policy("groupCreate", "A group")}${policy(
            "repositoryCreate",
            "A repository of their own"
        )}${policy("forkCreate", "A fork")}</fieldset><fieldset><legend>New repositories</legend>${select(
            f,
            "repositoryKind",
            "Kind",
            [
                ["db", "db: kept in the database"],
                ["local", "local: kept in a directory of this server"]
            ],
            {
                value: settings.repositoryKind || "db",
                hint: "The kind of every repository made on a page. An account does not choose it."
            }
        )}${input(f, "homeGroupPath", "Home group", {value: settings.homeGroupPath || "", maxlength: 200, hint: "The path of the group whose page is this site's home; empty shows Explore."})}${number(
            "maxEditBytes",
            "Largest file edited on its page, MiB",
            mibOf(settings.maxEditBytes)
        )}</fieldset><fieldset><legend>Default limits of an account</legend>${number("defaultMaxRepositories", "Repositories", settings.defaultMaxRepositories)}${number(
            "defaultRepositoryBytes",
            "Size of a repository, MiB",
            mibOf(settings.defaultRepositoryBytes)
        )}${number("defaultLfsBytes", "Git LFS, MiB", mibOf(settings.defaultLfsBytes))}${number(
            "defaultRunnerMinutes",
            "Runner minutes a month",
            settings.defaultRunnerMinutes
        )}</fieldset><fieldset><legend>Default limits of a group</legend>${number("groupRepositoryBytes", "Size of a repository, MiB", mibOf(settings.groupRepositoryBytes))}${number(
            "groupLfsBytes",
            "Git LFS, MiB",
            mibOf(settings.groupLfsBytes)
        )}${number("groupRunnerMinutes", "Runner minutes a month", settings.groupRunnerMinutes)}</fieldset><fieldset><legend>Pipelines</legend>${select(
            f,
            "outsideRunApproval",
            "When an outside run waits",
            [
                ["first", ec.l10n.localize("A first contribution's runs wait for a Maintainer's approval")],
                ["always", ec.l10n.localize("Every outside run waits for a Maintainer's approval")],
                ["never", ec.l10n.localize("Outside runs start without an approval")]
            ],
            {
                value: settings.outsideRunApproval || "first",
                hint: "An outside run is one of a fork's merge request, a push for review, or an account below Developer. A group may say otherwise for its repositories."
            }
        )}${number("outsideRunMaxJobs", "Most jobs of an outside run", settings.outsideRunMaxJobs, {
            hint: "An outside run with more jobs than this is refused."
        })}</fieldset>${submit("Save settings")}`
            .html
    }
}

/* The forms a members list gets (a group's Members page, a repository's Members tab): for its Owner, Add by handle and, on
 * each member whose role is this record's own, Change and Remove. set is the transition, id the record's id field. */
function memberForms(c, set, id, members, canChange) {
    if (!canChange) return {add: "", row: () => ""}
    const add = formOf(c, set)
    return {
        add: h`${open(c, add, {title: "Add a member"})}${hidden(id.name, id.value)}${input(add, "handle", "Handle", {
            required: true,
            maxlength: 39,
            autocomplete: "off"
        })}${select(add, "role", "Role", ROLES, {value: "developer"})}${input(add, "thruDate", "Until (optional)", {type: "date", hint: "The role ends at the end of that day."})}${submit("Add member")}`,
        row: m => {
            if (!m.own || !m.handle) return ""
            const f = formOf(c, set, m.handle)
            const key = h`${hidden(id.name, id.value)}${hidden("handle", m.handle)}${hidden("expectedRevision", m.revision)}`
            // an empty role removes the member
            return h`${open(c, f, {plain: true})}${key}${select(f, "role", "Role of " + m.handle, ROLES, {value: m.role})}<button>Change role</button></form>${open(
                c,
                formOf(c, set, m.handle + "-remove"),
                {plain: true}
            )}${key}${hidden("role", "")}<button aria-label="Remove ${m.handle}">Remove</button></form>`
        }
    }
}
/* GroupMembers' forms (design §6): its Owner adds a member by handle, changes a role and removes; a member leaves. */
function groupMembers(shell, view, bases, siteInfo, self) {
    const c = contextOf(bases, siteInfo, self, shell.flash)
    const owner = holds(shell.myRole, "owner")
    const forms = memberForms(
        c,
        "setGroupMember",
        {name: "groupId", value: shell.group.groupId},
        view.members,
        owner && shell.capabilities.confirmed !== false
    )
    for (const member of view.members) member.formsHtml = forms.row(member).html || ""
    const mine = siteInfo.profile?.handle
    const leave = formOf(c, "leaveGroup")
    return {
        addHtml: (owner && shell.capabilities.confirmed === false ? gate(c, false) : forms.add).html || "",
        leaveHtml:
            mine && view.members.some(m => m.own && m.handle === mine)
                ? h`${open(c, leave, {title: "Leave this group", successTo: c.base + "/explore"})}${hidden("groupId", shell.group.groupId)}<p>You give up your role in ${shell.group.groupPath} and in everything inside it.</p>${submit("Leave group")}`
                      .html
                : ""
    }
}
/* GroupSettings (design §6): General (name, description, the issue repository; visibility; the path), Agreement, Forum
 * (DG6), Pipelines (DG5: the runner pools, when outside runs wait, the month's minutes), Quota and Delete (with Hide, for
 * who may hide), for an Owner; Not Found for anyone else. */
function groupSettings(shell, bases, siteInfo, self, tab) {
    if (!holds(shell.myRole, "owner")) fail()
    const c = contextOf(bases, siteInfo, self, shell.flash)
    const g = shell.group
    const root = shell.root + "/-/settings"
    const current = tab || "general"
    const head = h`<h2>Settings</h2>${tabsOf(
        "Group settings",
        [
            ["general", "General", root],
            ["agreement", "Agreement", root + "/agreement"],
            ["forum", "Forum", root + "/forum"],
            ["pipelines", "Pipelines", root + "/pipelines"],
            ["quota", "Quota", root + "/quota"],
            ["import", "Import", root + "/import"],
            ["delete", "Delete", root + "/delete"]
        ],
        current
    )}`
    const closed = gate(c, shell.capabilities.confirmed)
    // DG4: the contributor agreement of the group's repositories (SmithyReview.js, read when the tab is asked)
    if (current === "agreement")
        return ec.resource
            .script("component://mr-pass/screen/Smithy/SmithyReview.js")
            .agreementSettings({siteId: shell.siteId, groupId: g.groupId}, g.groupPath, head.html, bases, siteInfo, self, shell.flash, shell.capabilities.confirmed)
    // DG6: the group's forum, its mailing list and its address for security reports (SmithyScope.js)
    if (current === "forum")
        return ec.resource.script("component://mr-pass/screen/Smithy/SmithyScope.js").forumSettings(shell, head.html, bases, siteInfo, self)
    // DG5: the runners of the group's repositories (SmithyPipelines.js)
    if (current === "pipelines")
        return ec.resource.script("component://mr-pass/screen/Smithy/SmithyPipelines.js").groupSettings(shell, head.html, bases, siteInfo, self)
    if (current === "quota") {
        const found = portal.attempt("getQuotaUsage", {siteId: shell.siteId, groupId: g.groupId})
        return {
            html: h`${head}${found.error ? h`<p role="alert" class="error">${found.error.message}</p>` : quotaTable(found.result)}${
                siteInfo.capabilities?.canManageSite
                    ? h`<p><a href="${c.base}/-/site/quotas${query({of: g.groupPath})}">Change these limits</a></p>`
                    : h`<p>An operator of the site sets these limits.</p>`
            }`.html
        }
    }
    // DG8: the GitHub import into the group (SmithyImport.js); the list stays when the start form is closed
    if (current === "import")
        return ec.resource.script("component://mr-pass/screen/Smithy/SmithyImport.js").groupImport(shell, head, c, closed)
    if (closed) return {html: h`${head}${closed}`.html}
    if (current === "delete")
        return {
            html: h`${head}${confirmCard(c, "deleteGroup", {
                title: "Delete " + g.groupPath,
                lines: [
                    "This removes the group " +
                        g.groupPath +
                        " and its members' roles, and cannot be undone. A group that still has a repository or a subgroup is not deleted.",
                    "Type the group's path to confirm."
                ],
                fields: {groupId: g.groupId, expectedRevision: g.revision},
                typed: {name: "confirmPath", label: "Path of the group"},
                button: "Delete group",
                cancelHref: root,
                successTo: c.base + "/explore"
            })}${ec.resource.script("component://mr-pass/screen/Smithy/SmithyScope.js").hideLink(shell)}`.html
        }
    const wanted = param("confirm") === "visibility" ? param("visibility") : null
    if (wanted && VISIBILITY.some(([value]) => value === wanted) && wanted !== g.visibility) {
        const inside = (Number(g.repositoryCount) || 0) + " repositories and " + (Number(g.subgroupCount) || 0) + " subgroups"
        return {
            html: h`${head}${confirmCard(c, "updateGroup", {
                title: "Change who may see " + g.groupPath,
                lines: [
                    "The group " +
                        g.groupPath +
                        " is seen by " +
                        visibilityText(g.visibility) +
                        ". After this it is seen by " +
                        visibilityText(wanted) +
                        ".",
                    "It holds " +
                        inside +
                        ". None of them is seen more widely than the group, so narrowing the group narrows them too; widening it shows each as widely as its own setting allows."
                ],
                fields: {groupId: g.groupId, visibility: wanted, expectedRevision: g.revision},
                button: ec.l10n.localize("Change visibility"),
                cancelHref: root,
                returnTo: root + query({confirm: "visibility", visibility: wanted}),
                successTo: root
            })}`.html
        }
    }
    const general = formOf(c, "updateGroup")
    const rename = formOf(c, "renameGroup")
    return {
        html: h`${head}${open(c, general, {title: "General"})}${hidden("groupId", g.groupId)}${hidden("expectedRevision", g.revision)}${input(
            general,
            "name",
            "Name",
            {
                value: g.name,
                maxlength: 255,
                required: true
            }
        )}${textarea(general, "description", "Description", {value: g.description || "", maxlength: 2000})}${submit(
            "Save"
        )}<form method="get" action="${root}" class="card" id="SmithyGroupVisibility"><h2>Visibility</h2><input type="hidden" name="confirm" value="visibility">${select(
            formOf(c, ""),
            "visibility",
            "Who may see this group",
            VISIBILITY,
            {value: g.visibility, hint: ec.l10n.localize("You are asked to confirm on the next page.")}
        )}<p><button>${ec.l10n.localize("Change visibility")}</button></p></form>${open(c, rename, {title: "Path"})}${hidden("groupId", g.groupId)}${hidden("expectedRevision", g.revision)}${input(
            rename,
            "pathSegment",
            "Path",
            {value: g.pathSegment, required: true, maxlength: 39, pattern: "[a-z0-9][a-z0-9_\\-]{1,38}", autocomplete: "off"}
        )}<p>Renaming changes the address of the group and of every repository in it, for pages and for git. The old addresses redirect until something else takes the name.</p>${submit(
            "Rename group"
        )}${ec.resource.script("component://mr-pass/screen/Smithy/SmithySite.js").landingSettings(shell, c)}`.html
    }
}

const METHODS = [
    ["merge", "Merge commit"],
    ["squash", "Squash"],
    ["rebase", "Rebase"],
    ["fastForward", "Fast-forward"]
]
const EVENTS = [
    ["push", ec.l10n.localize("A branch is pushed")],
    ["tag", ec.l10n.localize("A tag is pushed")],
    ["merge_request", ec.l10n.localize("A merge request changes")]
]
const listOf = value =>
    (Array.isArray(value) ? value.map(String) : String(value || "").split(",")).map(item => item.trim()).filter(Boolean)
const yes = value => value === true || value === "Y" || value === "true"

/* A branch rule's fields (design §11), for a new rule and for an edit. */
function ruleFields(f, rule) {
    const methods = listOf(rule.allowedMergeMethods)
    return h`${input(f, "refPattern", "Branch or pattern", {value: rule.refPattern || "", required: true, maxlength: 250, hint: "A branch's name, or a pattern such as release/*."})}${check(
        "allowForcePush",
        "Allow a force push",
        yes(rule.allowForcePush)
    )}${check("allowDelete", "Allow the branch to be deleted", yes(rule.allowDelete))}${check("requireMergeRequest", "Change it only by a merge request", yes(rule.requireMergeRequest))}${input(
        f,
        "requiredApprovals",
        "Approvals a merge needs",
        {value: rule.requiredApprovals ?? "", inputmode: "numeric", maxlength: 2}
    )}${check("dismissStaleApprovals", "A new commit dismisses the approvals", yes(rule.dismissStaleApprovals))}${input(
        f,
        "requiredStatusContexts",
        "Checks a merge needs",
        {
            value: listOf(rule.requiredStatusContexts).join(", "),
            maxlength: 1000,
            hint: "The names of commit statuses, separated by commas."
        }
    )}<fieldset><legend>Merge methods allowed (none checked: any)</legend>${METHODS.map(([value, text]) => check("allowedMergeMethods", text, methods.includes(value), value))}</fieldset>`
}
/* A webhook's fields; its secret is write-only. */
function hookFields(f, hook) {
    const events = listOf(hook.events)
    return h`${input(f, "url", "URL", {value: hook.url || "", type: "url", required: true, maxlength: 2000})}${input(
        f,
        "description",
        "Description",
        {
            value: hook.description || "",
            maxlength: 255
        }
    )}<fieldset><legend>Events (none checked: all)</legend>${EVENTS.map(([value, text]) => check("events", text, events.includes(value), value))}</fieldset>${input(
        f,
        "secret",
        "Secret",
        {
            type: "password",
            secret: true,
            maxlength: 255,
            autocomplete: "off",
            hint: hook.hasSecret
                ? ec.l10n.localize("It has a secret, which is not shown. Leave this empty to keep it.")
                : ec.l10n.localize("Signs each delivery (X-Hub-Signature-256). It is not shown again after it is saved.")
        }
    )}${check("active", "Active", hook.webhookId ? yes(hook.active) : true)}`
}
/* What a role reaches of a repository's Settings (design §11): the tabs, a Maintainer's and for an Owner Archive too, and
 * whether it changes the members (an Owner; a Maintainer reads them). Less than a Maintainer has no Settings: Not Found. */
function settingsAccess(shell) {
    const role = shell.capabilities.role
    if (!holds(role, "maintainer")) fail()
    const owner = holds(role, "owner")
    return {tabs: ["general", "members", "branch-rules", "webhooks", "mirrors", "pipelines", ...(owner ? ["agreement", "forum", "archive"] : [])], changesMembers: owner}
}
/* RepositorySettings (design §11): General, Members, Branch rules, Webhooks, (DG8) Mirrors and (DG5) Pipelines for a Maintainer, Archive for
 * an Owner; a tab
 * the caller's role does not reach is Not Found, as the whole page is for less than a Maintainer. */
function repositorySettings(shell, bases, siteInfo, self, tab) {
    const access = settingsAccess(shell)
    const owner = access.changesMembers
    const current = tab || "general"
    if (!access.tabs.includes(current)) fail()
    const c = contextOf(bases, siteInfo, self, shell.flash)
    const r = shell.repository
    const siteId = shell.siteId
    const id = r.repositoryId
    const root = smithy.urls(shell.base, r.repositoryPath).section("settings")
    const at = name => (name === "general" ? root : root + "/" + name)
    const head = h`<h2>Settings</h2>${tabsOf(
        ec.l10n.localize("Repository settings"),
        [
            ["general", "General", root],
            ["members", "Members", at("members")],
            ["branch-rules", "Branch rules", at("branch-rules")],
            ["webhooks", "Webhooks", at("webhooks")],
            ["mirrors", "Mirrors", at("mirrors")],
            ["pipelines", "Pipelines", at("pipelines")],
            ...(owner
                ? [
                      ["agreement", "Agreement", at("agreement")],
                      ["forum", "Forum", at("forum")],
                      ["archive", "Archive", at("archive")]
                  ]
                : [])
        ],
        current
    )}`
    const closed = gate(c, shell.capabilities.confirmed)
    // DG4: the contributor agreement, an Owner's (SmithyReview.js, read when the tab is asked)
    if (current === "agreement")
        return ec.resource
            .script("component://mr-pass/screen/Smithy/SmithyReview.js")
            .agreementSettings({siteId, repositoryId: id}, r.repositoryPath, head.html, bases, siteInfo, self, shell.flash, shell.capabilities.confirmed)
    // DG6: the repository's forum (its subcategory) and its mailing list, an Owner's (SmithyScope.js)
    if (current === "forum")
        return ec.resource.script("component://mr-pass/screen/Smithy/SmithyScope.js").forumSettings(shell, head.html, bases, siteInfo, self)
    // DG5: the runners, secrets and environments (SmithyPipelines.js)
    if (current === "pipelines")
        return ec.resource.script("component://mr-pass/screen/Smithy/SmithyPipelines.js").repositorySettings(shell, head.html, bases, siteInfo, self)
    // DG8: the push mirrors (SmithyImport.js)
    if (current === "mirrors")
        return ec.resource.script("component://mr-pass/screen/Smithy/SmithyImport.js").mirrors(shell, head, c, closed)
    const page = body => ({html: h`${head}${body}`.html})
    const common = h`${hidden("repositoryId", id)}`
    if (current === "members") {
        const cursor = param("cursor")
        const found = need("findRepositoryMembers", {siteId, repositoryId: id, limit: 30, ...(cursor ? {cursor} : {})})
        const members = (found.memberList || []).map(m => ({...m, own: !m.fromPath || m.fromPath === r.repositoryPath}))
        const forms = memberForms(c, "setRepositoryMember", {name: "repositoryId", value: id}, members, owner && !closed)
        return page(
            h`<section id="SmithyMemberList" aria-label="Members">${
                members.length ? "" : h`<p class="card">${ec.l10n.localize("No members to show.")}</p>`
            }${members.map(
                m =>
                    h`<article class="card smithy-row"><h3>${m.displayName || m.handle || "Member"}${m.handle ? h` <small>@${m.handle}</small>` : ""}</h3><p><strong>${m.role}</strong>${
                        m.own ? "" : " · from " + m.fromPath
                    }${m.fromDate ? " · since " + dateText(m.fromDate) : ""}${m.thruDate ? " · until " + dateText(m.thruDate) : ""}</p>${forms.row(m)}</article>`
            )}</section>${found.nextCursor ? h`<p><a href="${at("members")}${query({cursor: found.nextCursor})}">${ec.l10n.localize("More members")}</a></p>` : ""}${
                owner ? closed || forms.add : h`<p id="SmithyMembersReadOnly">An Owner changes the members.</p>`
            }`
        )
    }
    if (current === "branch-rules") {
        const rules = need("getBranchRules", {siteId, repositoryId: id}).ruleList || []
        const fresh = formOf(c, "storeBranchRule")
        return page(
            h`<section id="SmithyRuleList" aria-label="Branch rules">${rules.length ? "" : h`<p class="card">No branch has a rule: a Developer pushes to every branch, and a Maintainer forces and deletes.</p>`}${rules.map(
                rule => {
                    const f = formOf(c, "storeBranchRule", rule.branchRuleId)
                    const gone = formOf(c, "deleteBranchRule", rule.branchRuleId)
                    return h`<article class="card smithy-row" id="SmithyRule_${rule.branchRuleId}"><h3 class="wrap"><code>${rule.refPattern}</code></h3>${
                        closed
                            ? ""
                            : h`<details${attributes({open: !!f.error})}><summary>Edit</summary>${open(c, f, {plain: true})}${common}${hidden("branchRuleId", rule.branchRuleId)}${hidden(
                                  "operationId",
                                  portal.operationId()
                              )}${ruleFields(f, rule)}${submit("Save rule")}</details>${open(c, gone, {plain: true})}${common}${hidden("branchRuleId", rule.branchRuleId)}<p><button aria-label="Delete the rule of ${
                                  rule.refPattern
                              }">Delete rule</button></p></form>`
                    }</article>`
                }
            )}</section>${closed || h`${open(c, fresh, {title: "New rule"})}${common}${hidden("branchRuleId", "")}${hidden("operationId", portal.operationId())}${ruleFields(fresh, {})}${submit("Add rule")}`}`
        )
    }
    if (current === "webhooks") {
        const hooks = need("findWebhooks", {siteId, repositoryId: id}).webhookList || []
        const shown = param("deliveries")
        const fresh = formOf(c, "storeWebhook")
        return page(
            h`<section id="SmithyWebhookList" aria-label="Webhooks">${hooks.length ? "" : h`<p class="card">This repository has no webhook.</p>`}${hooks.map(
                hook => {
                    const f = formOf(c, "storeWebhook", hook.webhookId)
                    const key = h`${common}${hidden("webhookId", hook.webhookId)}`
                    const deliveries =
                        shown === hook.webhookId
                            ? maybe("findWebhookDeliveries", {siteId, repositoryId: id, webhookId: hook.webhookId, limit: 10})
                                  ?.deliveryList || []
                            : null
                    return h`<article class="card smithy-row" id="SmithyWebhook_${hook.webhookId}"><h3 class="wrap">${hook.url}${yes(hook.active) ? "" : h` <small class="smithy-chip">Inactive</small>`}</h3><p><small>${
                        hook.description ? hook.description + " · " : ""
                    }${listOf(hook.events).join(", ") || "all events"}${hook.hasSecret ? " · signed" : ""}${
                        hook.lastDeliveryDate
                            ? " · last delivery " +
                              dateText(hook.lastDeliveryDate) +
                              " (" +
                              (hook.lastDeliveryStatus ?? "no answer") +
                              ")"
                            : " · never delivered"
                    } · <a href="${at("webhooks")}${query({deliveries: hook.webhookId})}#SmithyWebhook_${hook.webhookId}">Recent deliveries</a></small></p>${
                        deliveries
                            ? h`<ul class="smithy-deliveries">${deliveries.length ? "" : h`<li>No deliveries yet.</li>`}${deliveries.map(
                                  d =>
                                      h`<li>${dateText(d.date)} · ${d.event} · ${yes(d.delivered) ? "delivered" : "not delivered"}${d.statusCode ? " (" + d.statusCode + ")" : ""}</li>`
                              )}</ul>`
                            : ""
                    }${
                        closed
                            ? ""
                            : h`${open(c, formOf(c, "testWebhook", hook.webhookId), {plain: true})}${key}<p><button aria-label="Send a test to ${hook.url}">Send a test</button></p></form><details${attributes(
                                  {
                                      open: !!f.error
                                  }
                              )}><summary>Edit</summary>${open(c, f, {plain: true})}${key}${hidden("operationId", portal.operationId())}${hookFields(f, hook)}${submit("Save webhook")}</details>${open(
                                  c,
                                  formOf(c, "deleteWebhook", hook.webhookId),
                                  {plain: true}
                              )}${key}<p><button aria-label="Delete the webhook to ${hook.url}">Delete webhook</button></p></form>`
                    }</article>`
                }
            )}</section>${closed || h`${open(c, fresh, {title: "New webhook"})}${common}${hidden("webhookId", "")}${hidden("operationId", portal.operationId())}${hookFields(fresh, {})}${submit("Add webhook")}`}`
        )
    }
    if (closed) return page(closed)
    const revision = hidden("expectedRevision", r.revision)
    if (current === "archive") {
        const tabPath = at("archive")
        const confirm = param("confirm")
        const asked = values => tabPath + query(values)
        if (confirm === "visibility") {
            const wanted = param("visibility")
            if (VISIBILITY.some(([value]) => value === wanted) && wanted !== r.visibility)
                return page(
                    confirmCard(c, "setRepositoryVisibility", {
                        title: "Change who may see " + r.repositoryPath,
                        lines: [
                            "The repository " +
                                r.repositoryPath +
                                " is seen by " +
                                visibilityText(r.visibility) +
                                ". After this it is seen by " +
                                visibilityText(wanted) +
                                ": its code, and what it has turned on.",
                            wanted === "public"
                                ? "Anyone will be able to read and clone it, without signing in."
                                : "It is never seen more widely than its group."
                        ],
                        fields: {repositoryId: id, visibility: wanted, expectedRevision: r.revision},
                        button: ec.l10n.localize("Change visibility"),
                        cancelHref: tabPath,
                        returnTo: asked({confirm, visibility: wanted}),
                        successTo: tabPath
                    })
                )
        }
        if (confirm === "archive")
            return page(
                confirmCard(c, "setRepositoryArchived", {
                    title: (r.archived ? "Unarchive " : "Archive ") + r.repositoryPath,
                    lines: [
                        r.archived
                            ? "The repository " + r.repositoryPath + " can be pushed to and changed again."
                            : "The repository " +
                              r.repositoryPath +
                              " becomes read only: nothing is pushed to it and its settings do not change. Its open merge requests are closed. It can be unarchived later."
                    ],
                    fields: {repositoryId: id, archived: r.archived ? "false" : "true", expectedRevision: r.revision},
                    button: r.archived ? "Unarchive" : "Archive",
                    cancelHref: tabPath,
                    returnTo: asked({confirm}),
                    successTo: tabPath
                })
            )
        const groups = maybe("findGroups", {siteId, mine: true, limit: 100})?.groupList || []
        const targets = [
            ["-", "Your own namespace"],
            ...groups.filter(g => g.groupId !== r.groupId).map(g => [g.groupId, g.groupPath])
        ]
        if (confirm === "transfer") {
            const target = targets.find(([value]) => value === param("target"))
            if (target)
                return page(
                    confirmCard(c, "transferRepository", {
                        title: "Transfer " + r.repositoryPath,
                        lines: [
                            "The repository " +
                                r.repositoryPath +
                                " moves to " +
                                (target[0] === "-" ? "your own namespace" : "the group " + target[1]) +
                                ". You need to be a Maintainer there.",
                            "Its address changes, for pages and for git; the old one redirects until something else takes it. Its members become those of the new place, and it is seen no more widely than the new group."
                        ],
                        fields: {
                            repositoryId: id,
                            targetGroupId: target[0] === "-" ? "" : target[0],
                            expectedRevision: r.revision
                        },
                        button: "Transfer repository",
                        cancelHref: tabPath,
                        returnTo: asked({confirm, target: target[0]})
                    })
                )
        }
        if (confirm === "delete")
            return page(
                confirmCard(c, "deleteRepository", {
                    title: "Delete " + r.repositoryPath,
                    lines: [
                        "This removes the repository " +
                            r.repositoryPath +
                            ": its branches, tags and history, its settings and its members' roles. It cannot be undone. A repository with forks or release files is not deleted.",
                        "Type the repository's path to confirm."
                    ],
                    fields: {repositoryId: id, expectedRevision: r.revision},
                    typed: {name: "confirmPath", label: "Path of the repository"},
                    button: "Delete repository",
                    cancelHref: tabPath,
                    returnTo: asked({confirm}),
                    successTo: c.base + "/explore"
                })
            )
        const ask = (word, title, body, button) =>
            h`<form method="get" action="${tabPath}" class="card" id="SmithyAsk_${word}"><h2>${title}</h2><input type="hidden" name="confirm" value="${word}">${body}<p><button>${button}</button></p></form>`
        const rename = formOf(c, "renameRepository")
        const none = formOf(c, "")
        return page(
            h`${ask(
                "visibility",
                "Visibility",
                select(
                    none,
                    "visibility",
                    ec.l10n.localize("Who may see this repository"),
                    visibilities(r.groupId ? shell.group?.visibility : null),
                    {
                        value: r.visibility,
                        hint: ec.l10n.localize("You are asked to confirm on the next page.")
                    }
                ),
                ec.l10n.localize("Change visibility")
            )}${open(c, rename, {title: "Path"})}${common}${revision}${input(rename, "slug", "Path", {
                value: r.slug,
                required: true,
                maxlength: 100,
                pattern: "[a-z0-9_][a-z0-9_.\\-]{0,99}",
                autocomplete: "off"
            })}<p>Renaming changes the repository's address, for pages and for git. The old address redirects until something else takes it.</p>${submit("Rename repository")}${ask(
                "transfer",
                "Transfer",
                select(none, "target", "Move this repository to", targets, {value: "-"}),
                "Transfer"
            )}${ask(
                "archive",
                r.archived ? "Unarchive" : "Archive",
                h`<p>${r.archived ? "This repository is archived: it is read only." : "An archived repository is read only."}</p>`,
                r.archived ? "Unarchive" : "Archive"
            )}${ask("delete", "Delete", h`<p>Deleting a repository cannot be undone.</p>`, "Delete this repository")}${ec.resource
                .script("component://mr-pass/screen/Smithy/SmithyScope.js")
                .hideLink(shell)}`
        )
    }
    const f = formOf(c, "updateRepository")
    const branches = (
        maybe("findRefs", {siteId, repositoryId: id, refType: "branch", namesOnly: true, limit: 100})?.refList || []
    ).map(ref => ref.name)
    const features = r.features || {}
    const defaultBranch = r.defaultBranch || ""
    return page(
        h`${open(c, f, {title: "General"})}${common}${revision}${input(f, "name", "Name", {value: r.name, required: true, maxlength: 255})}${textarea(
            f,
            "description",
            "Description",
            {
                value: r.description || "",
                maxlength: 255
            }
        )}${
            branches.length
                ? select(
                      f,
                      "defaultBranch",
                      "Default branch",
                      (branches.includes(defaultBranch) ? branches : [defaultBranch, ...branches].filter(Boolean)).map(name => [
                          name,
                          name
                      ]),
                      {value: defaultBranch}
                  )
                : ""
        }${select(
            f,
            "defaultMergeMethod",
            "Default merge method",
            // a merge request's default is a merge commit or a squash
            [...(r.defaultMergeMethod ? [] : [["", "As it is"]]), ...METHODS.slice(0, 2)],
            {
                value: r.defaultMergeMethod || ""
            }
        )}<fieldset><legend>Features</legend>${check("issuesEnabled", "Issues", features.issues)}${check("mergeRequestsEnabled", "Merge requests", features.mergeRequests)}${check(
            "pipelinesEnabled",
            "Pipelines",
            features.pipelines
        )}${check("forumEnabled", "Forum", features.forum)}${check("docsEnabled", "Docs", features.docs)}</fieldset>${input(
            f,
            "docsPath",
            ec.l10n.localize("Docs directory"),
            {
                value: r.docsPath ?? "",
                maxlength: 255,
                hint: "The directory the Docs pages render; docs when this is empty."
            }
        )}${submit("Save")}`
    )
}

/* Branches' and Tags' forms (design §7): a Developer creates one from a ref, a Maintainer deletes one after confirming. It
 * gives each row its Delete link, and answers the form and, for ?delete=<name>, the page that asks again. */
function refForms(shell, refType, view, bases, siteInfo) {
    const c = contextOf(bases, siteInfo, view.path, shell.flash)
    const id = shell.repository.repositoryId
    const branch = refType === "branch"
    const word = branch ? "branch" : "tag"
    const canDelete = !!shell.capabilities.canMerge
    for (const row of view.rows) row.deleteHref = canDelete && !row.isDefault ? view.path + query({delete: row.name}) : null
    const doomed = canDelete ? param("delete") : null
    if (doomed && doomed !== view.defaultBranch)
        return {
            confirmHtml: confirmCard(c, "deleteRef", {
                title: "Delete the " + word + " " + doomed,
                lines: [
                    "This removes the " +
                        word +
                        " " +
                        doomed +
                        " from " +
                        shell.repository.repositoryPath +
                        "." +
                        (branch
                            ? " Commits only it reaches are no longer listed, and an open merge request from it is closed."
                            : " A release made from it loses its tag.")
                ],
                fields: {repositoryId: id, refType, name: doomed},
                button: "Delete " + word,
                cancelHref: view.path,
                returnTo: view.path + query({delete: doomed}),
                successTo: view.path
            }).html,
            createHtml: ""
        }
    if (!shell.capabilities.canPush)
        return {
            confirmHtml: "",
            createHtml:
                shell.capabilities.signedIn &&
                shell.capabilities.confirmed === false &&
                holds(shell.capabilities.role, "developer")
                    ? gate(c, false).html
                    : ""
        }
    const f = formOf(c, "createRef")
    return {
        confirmHtml: "",
        createHtml:
            h`${open(c, f, {title: branch ? "New branch" : "New tag"})}${hidden("repositoryId", id)}${hidden("refType", refType)}${hidden("operationId", portal.operationId())}${input(
                f,
                "name",
                "Name",
                {required: true, maxlength: 250, autocomplete: "off"}
            )}${input(f, "fromRevision", ec.l10n.localize("From (a branch, a tag or a commit)"), {value: view.defaultBranch, required: true, maxlength: 250})}${
                branch ? "" : textarea(f, "message", "Message (optional; makes an annotated tag)", {maxlength: 2000})
            }${submit(branch ? "Create branch" : "Create tag")}`.html
    }
}

/* GitAccess (design §11; Account/GitAccess): the account's SSH keys and access tokens, with Add and Remove. A new token is
 * shown once, on the page after its form, and is in no address and no cache. Not Found on a site that mounts no Smithy. */
function gitAccess(siteId, bases, siteInfo, self) {
    if (!(siteInfo.mounts || []).some(mount => mount.app === "smithy")) fail()
    ec.web?.response?.setHeader("Cache-Control", "no-store")
    const c = contextOf(bases, siteInfo, self, smithy.takeFlash())
    // a token just made is shown on this one page, whatever else the page can show
    const made = c.flash.token
    const head = h`<h1>Git access</h1>${banner(c)}${
        made
            ? h`<section class="card" id="SmithyNewToken" role="status"><h2>Your new access token${made.name ? ": " + made.name : ""}</h2><p>Copy it now. It is not shown again.</p><p class="wrap"><code id="SmithyNewTokenValue">${made.token}</code></p><p>Git asks for a username and a password over HTTPS: give your username and this token.</p></section>`
            : ""
    }`
    if (!c.signedIn) return {html: h`${head}${gate(c)}`.html}
    const read = portal.attempt("findGitAccess", {siteId})
    if (read.error) return {html: h`${head}<p role="alert" class="error">${read.error.message}</p>`.html}
    const found = read.result
    const confirm = param("confirm")
    const key = confirm === "key" ? (found.sshKeyList || []).find(k => k.sshKeyId === param("id")) : null
    if (key)
        return {
            html: h`${head}${confirmCard(c, "removeSshKey", {
                title: ec.resource.expand("Remove the key ${name}", "", {name: key.name || key.fingerprint}),
                lines: [ec.resource.expand("Git over SSH stops accepting the key ${fingerprint} at once.", "", {fingerprint: key.fingerprint})],
                fields: {sshKeyId: key.sshKeyId},
                button: ec.l10n.localize("Remove key"),
                cancelHref: self
            })}`.html
        }
    const token = confirm === "token" ? (found.tokenList || []).find(t => t.tokenId === param("id")) : null
    if (token)
        return {
            html: h`${head}${confirmCard(c, "revokeAccessToken", {
                title: ec.resource.expand("Revoke the token ${name}", "", {name: token.name || token.tokenId}),
                lines: [ec.l10n.localize("Anything that uses this token stops working at once. A token cannot be restored.")],
                fields: {tokenId: token.tokenId},
                button: ec.l10n.localize("Revoke token"),
                cancelHref: self
            })}`.html
        }
    const again = f =>
        h`${input(f, "password", ec.l10n.localize("Your password"), {type: "password", secret: true, autocomplete: "current-password", hint: ec.l10n.localize("Asked again before your git access changes, unless you sign in only through another service.")})}${input(
            f,
            "code",
            ec.l10n.localize("Second-factor code, if you use one"),
            {secret: true, autocomplete: "one-time-code", inputmode: "numeric", maxlength: 12}
        )}`
    const addKey = formOf(c, "addSshKey")
    const addToken = formOf(c, "createAccessToken")
    const used = value => (value ? "last used " + dateText(value) : "never used")
    const closed = gate(c, found.confirmed)
    return {
        html: h`${head}<p>${found.sshAddress ? h`Git over SSH is at <code>${found.sshAddress}</code>. ` : ""}Reading a public repository needs no key or token. A push needs a role in the repository and a confirmed email address.</p><section id="SmithySshKeys" aria-label="SSH keys"><h2>SSH keys</h2>${
            (found.sshKeyList || []).length ? "" : h`<p class="card">You have no SSH key here.</p>`
        }${(found.sshKeyList || []).map(
            k =>
                h`<article class="card smithy-row"><h3 class="wrap">${k.name || "Key"}</h3><p class="wrap"><code>${k.fingerprint}</code></p><p><small>Added ${dateText(k.createdAt)} · ${used(
                    k.lastUsedAt
                )} · <a href="${self}${query({confirm: "key", id: k.sshKeyId})}">Remove</a></small></p></article>`
        )}${
            closed ||
            h`${open(c, addKey, {title: "Add an SSH key"})}${hidden("operationId", portal.operationId())}${input(addKey, "name", "Name", {required: true, maxlength: 100, placeholder: "My laptop"})}${textarea(
                addKey,
                "publicKey",
                "Public key",
                {
                    required: true,
                    rows: 4,
                    maxlength: 8000,
                    hint: "The one line of your public key file, such as ~/.ssh/id_ed25519.pub. Never the private key."
                }
            )}${again(addKey)}${submit("Add key")}`
        }</section><section id="SmithyTokens" aria-label="Access tokens"><h2>Access tokens</h2>${(found.tokenList || []).length ? "" : h`<p class="card">You have no access token.</p>`}${(
            found.tokenList || []
        ).map(
            t =>
                h`<article class="card smithy-row"><h3 class="wrap">${t.name || "Token"}</h3><p><small>Created ${dateText(t.createdAt)} · ${t.expiresAt ? "expires " + dateText(t.expiresAt) : "does not expire"} · ${used(
                    t.lastUsedAt
                )} · <a href="${self}${query({confirm: "token", id: t.tokenId})}">Revoke</a></small></p></article>`
        )}${
            closed
                ? ""
                : h`${open(c, addToken, {title: "Create an access token"})}${hidden("operationId", portal.operationId())}${input(
                      addToken,
                      "name",
                      "Name",
                      {
                          required: true,
                          maxlength: 100,
                          placeholder: "CI"
                      }
                  )}${input(addToken, "expiresAt", "Expires (optional)", {type: "date", hint: "At the end of that day, within a year. With no date the token expires in 90 days."})}${again(addToken)}<p><small>A token acts as you in git over HTTPS. It is shown once, on the next page.</small></p>${submit(
                      "Create token"
                  )}`
        }</section>`.html
    }
}

/* The transitions of Smithy/Do: each one operation of the same name. fields are the form's texts (sent when posted, so an
 * edit may clear one), optional the texts sent only when filled, flags its checkboxes (optionalFlags: sent only when
 * checked), numbers and mib its numbers (mib a size in MiB, sent in bytes), lists its repeated values joined with commas,
 * arrays its repeated or comma-separated values as a list (optionalArrays: sent only when there is one). done answers the page after a success when it
 * is not the form's own (given the result, the bases, the form's own page and the operation's input); confirm marks an
 * action that is asked again first; account one of Account's Git access. */
const groupPage = (result, c) => (result.groupPath ? c.base + "/" + enc(result.groupPath) : null)
/* DG5: a run's page (the authority's path under the mount), and what the notice says of the run asked for. */
const runPage = (result, c) => (result.path && smithy.siteLocal(result.path) ? c.base + result.path : null)
const runNotice = result =>
    result.state === "error"
        ? "Run #" + result.runNum + " did not start" + (result.message ? ": " + String(result.message).replace(/^[a-z][A-Za-z]{2,40}: /, "") : ".")
        : result.state === "waiting"
          ? "Run #" + result.runNum + " waits for a Maintainer's approval."
          : "Run #" + result.runNum + " was queued."
const repositoryPage = (result, c) => (result.repositoryPath ? c.base + "/" + enc(result.repositoryPath) : null)
const DO = {
    requestGroup: {
        fields: ["pathSegment", "name", "description", "visibility", "reason", "operationId"],
        done: (result, c) => (result.status === "requested" ? null : groupPage(result, c)),
        notice: result =>
            result.status === "requested"
                ? "Your request for the group " + result.groupPath + " was sent. You become its Owner when it is approved."
                : "The group " + result.groupPath + " was created."
    },
    createSubgroup: {
        fields: ["groupId", "pathSegment", "name", "description", "visibility", "operationId"],
        done: groupPage,
        notice: result => "The subgroup " + result.groupPath + " was created."
    },
    updateGroup: {
        fields: ["groupId", "name", "description", "visibility"],
        numbers: ["expectedRevision"],
        // a change of who may see the group is asked again first
        confirm: posted => posted.has("visibility"),
        notice: () => "The group was saved."
    },
    renameGroup: {
        fields: ["groupId", "pathSegment"],
        numbers: ["expectedRevision"],
        done: (result, c) => (result.groupPath ? c.base + "/" + enc(result.groupPath) + "/-/settings" : null),
        notice: result => "The group is now at " + result.groupPath + "."
    },
    deleteGroup: {
        fields: ["groupId", "confirmPath"],
        numbers: ["expectedRevision"],
        confirm: true,
        notice: () => "The group was deleted."
    },
    setGroupMember: {
        fields: ["groupId", "handle", "role", "thruDate"],
        days: ["thruDate"],
        numbers: ["expectedRevision"],
        notice: () => "The members were saved."
    },
    leaveGroup: {fields: ["groupId"], notice: () => "You left the group."},
    createRepository: {
        fields: ["groupId", "slug", "name", "description", "visibility", "operationId"],
        flags: ["withReadme"],
        done: repositoryPage,
        notice: result => "The repository " + result.repositoryPath + " was created."
    },
    updateRepository: {
        fields: ["repositoryId", "name", "description", "defaultBranch", "docsPath"],
        optional: ["defaultMergeMethod"],
        flags: ["issuesEnabled", "mergeRequestsEnabled", "pipelinesEnabled", "forumEnabled", "docsEnabled"],
        numbers: ["expectedRevision"],
        notice: () => "The repository was saved."
    },
    setRepositoryVisibility: {
        fields: ["repositoryId", "visibility"],
        numbers: ["expectedRevision"],
        confirm: true,
        notice: result => "The repository is now " + result.visibility + "."
    },
    renameRepository: {
        fields: ["repositoryId", "slug"],
        numbers: ["expectedRevision"],
        done: (result, c) => (result.repositoryPath ? c.base + "/" + enc(result.repositoryPath) + "/-/settings/archive" : null),
        notice: result => "The repository is now at " + result.repositoryPath + "."
    },
    transferRepository: {
        fields: ["repositoryId", "targetGroupId"],
        numbers: ["expectedRevision"],
        confirm: true,
        done: repositoryPage,
        notice: result => "The repository is now at " + result.repositoryPath + "."
    },
    setRepositoryArchived: {
        fields: ["repositoryId"],
        flags: ["archived"],
        numbers: ["expectedRevision"],
        confirm: true,
        notice: result =>
            result.archived
                ? "The repository is archived." +
                  (Number(result.closedMergeRequestCount)
                      ? " " + result.closedMergeRequestCount + " open merge requests were closed."
                      : "")
                : "The repository is no longer archived."
    },
    deleteRepository: {
        fields: ["repositoryId", "confirmPath"],
        numbers: ["expectedRevision"],
        confirm: true,
        notice: () => "The repository was deleted."
    },
    setRepositoryMember: {
        fields: ["repositoryId", "handle", "role", "thruDate"],
        days: ["thruDate"],
        numbers: ["expectedRevision"],
        notice: () => "The members were saved."
    },
    storeBranchRule: {
        fields: ["repositoryId", "branchRuleId", "refPattern", "requiredStatusContexts", "operationId"],
        flags: ["allowForcePush", "allowDelete", "requireMergeRequest", "dismissStaleApprovals"],
        numbers: ["requiredApprovals"],
        lists: ["allowedMergeMethods"],
        notice: () => "The branch rule was saved."
    },
    deleteBranchRule: {fields: ["repositoryId", "branchRuleId"], notice: () => "The branch rule was deleted."},
    storeWebhook: {
        fields: ["repositoryId", "webhookId", "url", "description", "operationId"],
        optional: ["secret"],
        flags: ["active"],
        lists: ["events"],
        notice: () => "The webhook was saved."
    },
    deleteWebhook: {fields: ["repositoryId", "webhookId"], notice: () => "The webhook was deleted."},
    // delivered or not, and nothing of what the other server said
    testWebhook: {
        fields: ["repositoryId", "webhookId"],
        notice: result => (result.delivered ? "The test was delivered." : "The test was not delivered.")
    },
    createRef: {
        fields: ["repositoryId", "refType", "name", "fromRevision", "operationId"],
        optional: ["message"],
        notice: result => "Created " + result.name + "."
    },
    deleteRef: {fields: ["repositoryId", "refType", "name"], confirm: true, notice: () => "It was deleted."},
    addSshKey: {
        fields: ["name", "publicKey", "operationId"],
        optional: ["password", "code"],
        account: true,
        notice: () => "The key was added."
    },
    removeSshKey: {fields: ["sshKeyId"], account: true, confirm: true, notice: () => "The key was removed."},
    // the token is shown once, on the page this redirects to, and is kept nowhere else
    createAccessToken: {
        fields: ["name", "expiresAt", "operationId"],
        days: ["expiresAt"],
        optional: ["password", "code"],
        account: true,
        token: true,
        notice: () => null
    },
    revokeAccessToken: {fields: ["tokenId"], account: true, confirm: true, notice: () => "The token was revoked."},
    storeSmithySettings: {
        fields: ["homeGroupPath", "groupCreate", "repositoryCreate", "forkCreate", "repositoryKind", "outsideRunApproval"],
        numbers: ["defaultMaxRepositories", "defaultRunnerMinutes", "groupRunnerMinutes", "outsideRunMaxJobs", "expectedRevision"],
        mib: ["defaultRepositoryBytes", "defaultLfsBytes", "groupRepositoryBytes", "groupLfsBytes", "maxEditBytes"],
        changed: [
            "outsideRunMaxJobs",
            "defaultMaxRepositories",
            "defaultRunnerMinutes",
            "groupRunnerMinutes",
            "defaultRepositoryBytes",
            "defaultLfsBytes",
            "groupRepositoryBytes",
            "groupLfsBytes",
            "maxEditBytes"
        ],
        notice: () => "The settings were saved."
    },
    decideGroupRequest: {
        fields: ["groupId", "decision", "reason"],
        numbers: ["expectedRevision"],
        notice: result => (result.status === "active" ? "The group was approved." : "The request was refused.")
    },
    setQuota: {
        fields: ["groupId", "handle", "bot", "botOperatorHandle", "reason"],
        numbers: ["maxRepositories", "runnerMinutesMonthly", "expectedRevision"],
        mib: ["maxRepositoryBytes", "maxLfsBytes"],
        changed: ["maxRepositories", "runnerMinutesMonthly", "maxRepositoryBytes", "maxLfsBytes", "bot", "botOperatorHandle"],
        // an emptied limit is sent as an empty text, which gives up the own limit
        emptyText: true,
        notice: () => "The limits were saved."
    },
    // DG3 (design §8, §15.4): issues, their labels and milestones, and the conversation's posts, which are the forum's
    // operations on the issue's record topic. A form of a text has a Preview button, which posts it to previewPost
    createIssue: {
        fields: ["repositoryId", "title", "body", "operationId"],
        optional: ["sourceFormat", "milestoneId"],
        flags: ["confidential"],
        optionalArrays: ["labelIds", "assigneeHandles"],
        // the new issue's page, beside the form's own
        done: (result, c, back) =>
            result.issueNumber && /\/-\/issues\/new$/.test(back) ? back.replace(/new$/, String(result.issueNumber)) : null,
        notice: result =>
            result.state === "pending"
                ? "Waiting for review: your issue is shown to others once a moderator has approved it."
                : "The issue was filed."
    },
    updateIssue: {
        fields: ["repositoryId", "title"],
        numbers: ["issueNumber", "expectedRevision"],
        notice: () => "The title was saved."
    },
    setIssueState: {
        fields: ["repositoryId", "state"],
        optional: ["reason"],
        numbers: ["issueNumber", "duplicateOfNumber", "expectedRevision"],
        notice: result => (result.state === "closed" ? "The issue was closed." : "The issue was reopened.")
    },
    setIssueLabels: {
        fields: ["repositoryId"],
        numbers: ["issueNumber", "expectedRevision"],
        arrays: ["labelIds"],
        notice: () => "The labels were saved."
    },
    setIssueAssignees: {
        fields: ["repositoryId"],
        numbers: ["issueNumber", "expectedRevision"],
        arrays: ["assigneeHandles"],
        notice: () => "The assignees were saved."
    },
    setIssueMilestone: {
        fields: ["repositoryId", "milestoneId"],
        numbers: ["issueNumber", "expectedRevision"],
        notice: () => "The milestone was saved."
    },
    // who reads the issue changes: asked again on a page of its own
    setIssueConfidential: {
        fields: ["repositoryId"],
        optional: ["title", "body", "sourceFormat", "operationId"],
        flags: ["confidential", "asNewIssue"],
        numbers: ["issueNumber", "expectedRevision"],
        confirm: true,
        done: (result, c, back) =>
            result.newIssueNumber ? back.replace(/\/-\/issues\/[0-9]+(?:[?#].*)?$/, "/-/issues/" + result.newIssueNumber) : null,
        notice: result =>
            result.newIssueNumber
                ? "This public issue was made from the confidential one, which stays confidential."
                : result.confidential
                  ? "The issue is confidential now."
                  : "The issue is public now."
    },
    storeLabel: {
        fields: ["repositoryId", "labelId", "name", "color", "description", "operationId"],
        numbers: ["expectedRevision"],
        notice: () => "The label was saved."
    },
    deleteLabel: {fields: ["repositoryId", "labelId"], confirm: true, notice: () => "The label was deleted."},
    storeMilestone: {
        fields: ["repositoryId", "milestoneId", "name", "description", "dueDate", "state", "operationId"],
        numbers: ["expectedRevision"],
        notice: () => "The milestone was saved."
    },
    publishPost: {
        fields: ["rootCommEventId", "body", "operationId"],
        optional: ["sourceFormat"],
        // an Owner's answer on a confidential issue that its reporter does not read
        optionalFlags: ["ownersOnly"],
        notice: result => (result.state === "pending" ? "Waiting for review: your comment is shown once it is approved." : "Your comment was added.")
    },
    updatePost: {
        fields: ["postId", "body", "reason"],
        optional: ["sourceFormat"],
        numbers: ["expectedRevision"],
        notice: () => "The text was saved."
    },
    setReaction: {fields: ["postId", "reactionKey"], flags: ["active"], notice: () => null},
    flagPost: {fields: ["postId", "reason", "operationId"], notice: () => "Your report was sent to the moderators."},
    setPreferences: {
        fields: ["scopeType", "scopeId", "watchLevel"],
        numbers: ["expectedRevision"],
        notice: () => "Your notifications for this issue were saved."
    },
    // DG4 (design §9, §15.5): merge requests, forks, a file's edit and the agreement
    createMergeRequest: {
        fields: ["repositoryId", "sourceRef", "targetRef", "title", "body", "operationId"],
        optional: ["sourceRepositoryId", "sourceFormat"],
        flags: ["draft"],
        optionalArrays: ["reviewerHandles"],
        // shown again after a refusal, never sent: the fork's path the form was opened with
        typedOnly: ["sourceRepositoryPath"],
        done: (result, c, back) => (result.mergeRequestNum ? back.replace(/\/new(?:[?#].*)?$/, "/" + result.mergeRequestNum) : null),
        notice: result =>
            result.state === "pending"
                ? "Waiting for review: your merge request is shown to others once a moderator has approved it."
                : "The merge request was opened."
    },
    updateMergeRequest: {
        fields: ["repositoryId", "title"],
        flags: ["draft"],
        numbers: ["mergeRequestNum", "expectedRevision"],
        notice: () => "The merge request was saved."
    },
    setMergeRequestReviewers: {
        fields: ["repositoryId"],
        numbers: ["mergeRequestNum", "expectedRevision"],
        arrays: ["reviewerHandles"],
        notice: () => "The reviewers were saved."
    },
    submitReview: {
        fields: ["repositoryId", "decision", "body", "operationId"],
        optional: ["sourceFormat"],
        numbers: ["mergeRequestNum"],
        notice: result =>
            result.state === "pending"
                ? "Waiting for review: your review is shown once it is approved."
                : result.reviewerState === "approved"
                  ? "You approved this merge request."
                  : result.reviewerState === "changes"
                    ? "You asked for changes."
                    : "Your review was added."
    },
    createReviewComment: {
        fields: ["repositoryId", "body", "operationId"],
        optional: ["threadId", "commitId", "path", "sourceFormat"],
        numbers: ["mergeRequestNum", "oldLine", "newLine"],
        notice: result => (result.state === "pending" ? "Waiting for review: your comment is shown once it is approved." : "Your comment was added.")
    },
    resolveReviewThread: {
        fields: ["repositoryId", "threadId"],
        numbers: ["mergeRequestNum"],
        flags: ["resolved"],
        notice: result => (result.resolved ? "The thread was resolved." : "The thread was reopened.")
    },
    // closing is asked again first; reopening is not
    setMergeRequestState: {
        fields: ["repositoryId", "state"],
        numbers: ["mergeRequestNum", "expectedRevision"],
        confirm: () => param("state") !== "open",
        notice: result => (result.state === "closed" ? "The merge request was closed." : "The merge request was reopened.")
    },
    // asked again on a page that names the target branch, the method and what happens to the source branch
    mergeMergeRequest: {
        fields: ["repositoryId", "mergeMethod", "expectedHeadCommitId"],
        optional: ["message"],
        flags: ["deleteSourceBranch"],
        numbers: ["mergeRequestNum", "expectedRevision"],
        confirm: true,
        notice: () => "The merge request was merged."
    },
    forkRepository: {
        fields: ["repositoryId", "targetGroupId", "slug", "name", "visibility", "operationId"],
        done: repositoryPage,
        notice: result => "The fork " + result.repositoryPath + " was created."
    },
    // not an operation: one step of a file's edit to the next (step, below), the text kept for that one page
    editFile: {
        fields: ["repositoryId", "branch", "action", "path", "newPath", "content", "baseBlobId", "message", "stage"],
        step: true,
        previewField: "content"
    },
    commitFile: {
        fields: ["repositoryId", "branch", "action", "path", "content", "message", "operationId"],
        optional: ["newPath", "attachmentId", "baseBlobId", "destination", "newBranchName", "mergeRequestTitle"],
        // the new merge request, or the file where it was committed
        done: (result, c, back) => {
            const root = back.split("/-/")[0]
            if (result.mergeRequestNum) return root + "/-/merge-requests/" + result.mergeRequestNum
            const path = param("action") === "rename" ? param("newPath") : param("path")
            const branch = result.branch || param("branch")
            if (!branch || !path) return root
            return param("action") === "delete"
                ? root + "/-/tree/" + enc(branch + (path.includes("/") ? "/" + path.slice(0, path.lastIndexOf("/")) : ""))
                : root + "/-/blob/" + enc(branch + "/" + path)
        },
        notice: result =>
            result.mergeRequestNum
                ? "Your change is in merge request !" + result.mergeRequestNum + "."
                : "Committed" + (result.branch ? " to " + result.branch : "") + "."
    },
    setAgreement: {
        fields: ["repositoryId", "groupId", "setting", "agreementPath"],
        numbers: ["expectedRevision"],
        notice: result => (result.effective === "required" ? "The agreement is required now." : "The agreement was saved: it is not required.")
    },
    recheckAgreement: {
        fields: ["repositoryId", "operationId"],
        numbers: ["mergeRequestNum"],
        notice: result => "The agreement was checked again" + (result.agreement?.state ? ": " + result.agreement.state + "." : ".")
    },
    declareBotOperator: {
        fields: ["repositoryId", "operationId"],
        numbers: ["mergeRequestNum"],
        notice: () => "Recorded. A Maintainer confirms it."
    },
    confirmBotOperator: {
        fields: ["repositoryId"],
        numbers: ["mergeRequestNum", "expectedRevision"],
        notice: () => "The bot's operator was confirmed."
    },
    // DG6 (design §12.3 to §12.5, §15.7): the forum of a group or a repository, Report and Hide, a held report, a topic
    // made an issue
    setScopeForum: {
        optional: ["repositoryId", "groupId", "contactListId"],
        flags: ["enabled"],
        numbers: ["expectedRevision"],
        notice: result => (result.enabled ? "The forum is on." : "The forum is off.")
    },
    reportSmithyTarget: {
        fields: ["targetType", "targetId", "reason", "note", "operationId"],
        notice: () => "Your report was sent to the moderators."
    },
    hideSmithyTarget: {
        fields: ["targetType", "targetId", "reason"],
        flags: ["hidden"],
        numbers: ["expectedRevision"],
        // asked again on its own page, which names the target and what follows
        confirm: true,
        notice: result => (result.hidden ? "It is hidden: Not Found to everyone but its owners and the site's moderators." : "It is shown again.")
    },
    convertTopicToIssue: {
        fields: ["repositoryId", "rootCommEventId", "title", "operationId"],
        arrays: ["postIds"],
        optionalFlags: ["confidential"],
        // the new issue's page, in the repository that was chosen
        done: (result, c, back, input) => {
            const path = result.repositoryPath || maybe("getRepository", {siteId: input.siteId, repositoryId: input.repositoryId})?.repository?.repositoryPath
            return path && result.issueNumber ? c.base + "/" + enc(path) + "/-/issues/" + result.issueNumber : null
        },
        notice: result => "Issue #" + result.issueNumber + " was made from the topic."
    },
    storeIssueMailRoute: {
        fields: ["groupId", "address"],
        optional: ["repositoryId"],
        flags: ["enabled"],
        numbers: ["expectedRevision"],
        notice: () => "The address for security reports was saved."
    },
    claimHeldReport: {
        fields: ["token", "operationId"],
        // the confidential issue the report became
        done: (result, c) =>
            result.repositoryPath && result.issueNumber ? c.base + "/" + enc(result.repositoryPath) + "/-/issues/" + result.issueNumber : null,
        notice: result => "Your report was filed as the confidential issue #" + result.issueNumber + "."
    },
    // the forum's own operations a scope's Owner uses on the Forum tab: the category's mode and its list address
    storeCategory: {
        fields: ["contactListId", "mode"],
        numbers: ["expectedRevision"],
        notice: () => "The forum's mode was saved."
    },
    storeRoute: {
        fields: ["contactListId", "address"],
        optional: ["routeId", "operationId"],
        flags: ["active"],
        numbers: ["expectedRevision"],
        notice: () => "The list's address was saved."
    },
    // a mailing list's archive and its members' invitations (Dogfood §6.3)
    importMbox: {
        fields: ["contactListId", "archiveName", "checksum"],
        optional: ["sourceName"],
        // the run's page
        done: (result, c, back) => (result.importId ? back.split(/[?#]/)[0] + query({importId: result.importId}) + "#SmithyListImport" : null),
        notice: () => "The import was started. This page shows its progress."
    },
    inviteListMembers: {
        fields: ["contactListId", "operationId"],
        arrays: ["addresses"],
        notice: result =>
            "Invited " +
            (Number(result.invited) || 0) +
            (result.alreadyInvited ? "; " + result.alreadyInvited + " had an invitation already" : "") +
            (result.invalidCount ? "; " + result.invalidCount + " were not addresses" : "") +
            (result.unsent ? "; " + result.unsent + " could not be mailed" : "") +
            (result.limitedCount ? "; " + result.limitedCount + " were not sent: the day's limit" : "") +
            "."
    },
    // DG5 (design §10, §11, §15.6): pipeline runs, a repository's secrets and environments, a group's runners. A run asked for
    // goes to its page; one the run check refused comes back with its state error and a message, which the notice says
    runPipeline: {
        fields: ["repositoryId", "pipelineName", "refName", "operationId"],
        done: runPage,
        notice: runNotice
    },
    rerunPipelineRun: {
        fields: ["repositoryId", "operationId"],
        numbers: ["runNum"],
        done: runPage,
        notice: runNotice
    },
    // asked again on the run's page (?confirm=cancel)
    cancelPipelineRun: {
        fields: ["repositoryId"],
        numbers: ["runNum"],
        confirm: true,
        notice: () => "The run was cancelled."
    },
    retryJobRun: {
        fields: ["repositoryId", "jobRunId", "operationId"],
        numbers: ["runNum"],
        // the new attempt's page, beside the job's
        done: (result, c, back) => {
            const page = back.split(/[?#]/)[0]
            if (!result.jobRunId || !/\/-\/pipelines\/[0-9]+(?:\/jobs\/[^/]+)?$/.test(page)) return null
            return page.replace(/\/jobs\/[^/]+$/, "") + "/jobs/" + encodeURIComponent(result.jobRunId)
        },
        notice: () => "The job runs again, as a new attempt."
    },
    approvePipelineRun: {
        fields: ["repositoryId"],
        numbers: ["runNum"],
        notice: () => "Approved: the run's jobs are queued."
    },
    // a secret's value is sent once and never kept for the next page (SECRET); a replaced one keeps its name
    storeCiSecret: {
        fields: ["repositoryId", "secretId", "name", "value", "scope", "environmentId", "operationId"],
        notice: () => "The secret was saved. Its value is not shown again."
    },
    deleteCiSecret: {fields: ["repositoryId", "secretId"], confirm: true, notice: () => "The secret was deleted."},
    // DG10: and its deploy target; the token is sent only when typed and never kept for the next page (SECRET), the target's
    // and the clone's addresses are kept without a user part (inputOf)
    storeCiEnvironment: {
        // the target's token is no field: an item of the vault named (vaultId), which a member makes in their client
        fields: ["repositoryId", "environmentId", "name", "allowedRefs", "targetUrl", "vaultId", "requiredPipeline", "dataTypes", "cloneUrl", "operationId"],
        flags: ["approvalRequired"],
        // the texts are sent only when changed (the form shows the value it read beside each)
        changed: ["allowedRefs", "targetUrl", "vaultId", "requiredPipeline", "dataTypes", "cloneUrl"],
        // and what the engine cleared for the change (SEC-GIT-91): the secrets' values, to give again
        notice: result => "The environment was saved." + (result?.cleared ? " " + String(result.cleared) : "")
    },
    deleteCiEnvironment: {fields: ["repositoryId", "environmentId"], confirm: true, notice: () => "The environment was deleted."},
    // DG10 (design §10 Deploy environments): a deployment asked for goes to its page; Refuse and Cancel are asked again on
    // the deployment's page (?confirm=refuse, ?confirm=cancel), Approve is not
    requestDeploy: {
        fields: ["repositoryId", "environmentId", "refName", "operationId"],
        done: (result, c, back) => {
            const page = back.split(/[?#]/)[0]
            return result.deploymentId && /\/-\/pipelines\/deployments$/.test(page) ? page + "/" + encodeURIComponent(result.deploymentId) : null
        },
        notice: result =>
            result.state === "failed"
                ? "The deployment did not start" + (result.message ? ": " + String(result.message).replace(/^[a-z][A-Za-z]{2,40}: /, "") : ".")
                : "The deployment was asked for. It waits for the environment's pipeline" + (result.runNum ? ", run #" + result.runNum : "") + "."
    },
    decideDeploy: {
        fields: ["repositoryId", "deploymentId", "decision", "reason"],
        confirm: () => param("decision") !== "approve",
        // a deployment with a lease (its environment's vault holds the target's token): the approver goes on to the lease
        // dialog, where approving the lease is the decision; on this server, else back to the page, which links to it
        done: result => {
            const dialog = result.leaseId ? leaseDialog(result.leaseId) : null
            return dialog && smithy.siteLocal(dialog) ? dialog : null
        },
        notice: result =>
            result.leaseId
                ? "The deployment goes on once the lease of its target's token is approved in the lease dialog."
                : result.state === "refused"
                  ? "The deployment was refused."
                  : "Approved: the deployment goes on."
    },
    cancelDeploy: {fields: ["repositoryId", "deploymentId"], confirm: true, notice: () => "The deployment was cancelled."},
    storePipelineSettings: {
        fields: ["groupId", "runnerPoolId", "outsideRunnerPoolId", "outsideRunApproval"],
        numbers: ["expectedRevision"],
        // only a field that was changed is sent; one emptied gives up the group's own value (it follows the group above)
        changed: ["runnerPoolId", "outsideRunnerPoolId", "outsideRunApproval"],
        notice: () => "The pipeline settings were saved."
    },
    // DG7 (design §13, §15.8): a group's landing page, releases and their files, the site's table of old paths. A group's
    // landing file is sent when its repository or path was changed (both together), its news category when one is typed
    // or "No news category" is checked
    setGroupLanding: {
        fields: ["groupId", "landingRepositoryPath", "landingPath", "newsContactListId"],
        numbers: ["expectedRevision"],
        adjust: input => {
            const same = name => (param(name) ?? "") === (param("was_" + name) ?? "")
            if (same("landingRepositoryPath") && same("landingPath")) {
                delete input.landingRepositoryPath
                delete input.landingPath
            }
            if (param("clearNews") === "true") input.newsContactListId = ""
            else if (!input.newsContactListId) delete input.newsContactListId
        },
        notice: () => "The landing page was saved."
    },
    // a release of a tag (operationId) or a change of one (expectedRevision); its notes are the composer's text (body), sent
    // only when written; publishing or withdrawing a published one is asked again on the release's page
    storeRelease: {
        fields: ["repositoryId", "tag", "name", "body"],
        optional: ["published", "sourceFormat", "operationId"],
        optionalFlags: ["announce"],
        numbers: ["expectedRevision"],
        // the name of a release's edit form is sent only when changed (an unnamed release's empty field stays unnamed)
        changed: ["name"],
        confirm: posted => posted.has("expectedRevision") && posted.has("published"),
        adjust: input => {
            if (input.body) input.notes = input.body
            delete input.body
            if (!input.notes) delete input.sourceFormat
        },
        // a new release's page; a change stays on the page it was made on
        done: (result, c, back) => {
            const page = back.split(/[?#]/)[0]
            return result.tag && /\/-\/releases$/.test(page) ? page + "/" + enc(result.tag) : null
        },
        notice: result => "The release " + result.tag + " was saved." + (result.announcementTopicId ? " It is announced in the news." : "")
    },
    deleteRelease: {fields: ["repositoryId", "tag"], numbers: ["expectedRevision"], confirm: true, notice: () => "The release was withdrawn."},
    addReleaseAsset: {
        fields: ["repositoryId", "tag", "operationId"],
        optional: ["name", "artifactId", "imageName"],
        upload: true,
        // before a file is staged: only who may change the release (its capabilities), so a refused upload stores nothing
        uploadCheck: (input, siteId) => {
            const found = portal.attempt("getRelease", {siteId, repositoryId: input.repositoryId || "", tag: input.tag || ""})
            if (found.result?.capabilities?.canEdit) return null
            return found.error?.kind === "NotFound"
                ? {message: found.error.message || "This release was not found.", field: null, notFound: true}
                : {message: "Only a Maintainer of this repository adds files to its releases.", field: null, reason: "accessDenied"}
        },
        notice: () => "The file was added to the release."
    },
    removeReleaseAsset: {fields: ["repositoryId", "assetId"], confirm: true, notice: () => "The file was removed from the release."},
    storeRedirect: {
        fields: ["oldPath", "targetPath", "note", "operationId"],
        optional: ["oldHost", "redirectId"],
        notice: () => "The redirect was saved."
    },
    deleteRedirect: {fields: ["redirectId"], confirm: true, notice: () => "The redirect was deleted."},
    importRedirects: {
        fields: ["csv", "source"],
        notice: result => {
            const failed = result.failedList || []
            return (
                "Imported: " +
                (Number(result.created) || 0) +
                " new, " +
                (Number(result.updated) || 0) +
                " changed" +
                (failed.length
                    ? "; " +
                      failed.length +
                      " lines not taken: " +
                      failed
                          .slice(0, 5)
                          .map(line => "line " + line.line + " (" + String(line.message || "").replace(/^[a-zA-Z]+(\[[a-zA-Z]+\])?: /, "") + ")")
                          .join(", ") +
                      (failed.length > 5 ? ", ..." : "")
                    : "") +
                "."
            )
        }
    },
    // DG8 (design §11 Import, §15.9): the GitHub import, whose token is never kept for the next page (SECRET); its options
    // are the form's checkboxes as the operation's map, and a new repository's path is sent only for a new one
    startGitHubImport: {
        fields: ["groupId", "sourceRepository", "slug", "repositoryId", "token", "operationId"],
        adjust: input => {
            input.options = {
                issues: param("issues") === "true",
                pullRequests: param("pullRequests") === "true",
                ...(param("publishPrivate") === "true" ? {publishPrivate: true} : {})
            }
            if (input.repositoryId) delete input.slug
            else delete input.repositoryId
        },
        done: (result, c) => (result.importId ? c.base + "/import/" + encodeURIComponent(result.importId) : null),
        notice: () => "The import started. It goes on in steps, and this page shows where it is."
    },
    resumeGitHubImport: {
        fields: ["importId"],
        optional: ["token"],
        numbers: ["expectedRevision"],
        notice: () => "The import goes on."
    },
    // asked again on the import's page (?confirm=cancel)
    cancelGitHubImport: {
        fields: ["importId"],
        numbers: ["expectedRevision"],
        confirm: true,
        notice: () => "The import was stopped. What it brought stays."
    },
    // a mirror's secret is sent only when typed and never kept for the next page (SECRET), nor is its username (notKept)
    storeMirror: {
        fields: ["repositoryId", "mirrorId", "url", "refs", "operationId"],
        optional: ["username", "secret"],
        notKept: ["username"],
        optionalFlags: ["removeCredential"],
        flags: ["deleteRefs", "enabled"],
        notice: () => "The mirror was saved."
    },
    deleteMirror: {fields: ["repositoryId", "mirrorId"], confirm: true, notice: () => "The mirror was deleted."},
    pushMirror: {fields: ["repositoryId", "mirrorId"], notice: () => "The mirror's push was queued."},
    // not a write: the text of the form named by previewOf, as the authority would show it (preview, below)
    previewPost: {fields: ["body"], optional: ["sourceFormat"], preview: true}
}
/* The forms whose text Preview shows (a file's edit previews its Markdown: previewField). */
const PREVIEWED = ["createIssue", "publishPost", "updatePost", "setIssueConfidential", "createMergeRequest", "editFile", "storeRelease"]
/* What is never written back into a page after a refusal (a form adds its own: notKept). */
const SECRET = ["password", "code", "secret", "confirmPath", "value", "token"]
/* The addresses kept for the next page without a user part (a mirror's, and DG10 an environment's target and clone). */
const ADDRESSES = ["url", "targetUrl", "cloneUrl"]
/* An address as it is kept: with an @ anywhere, everything to the last @ goes, after a scheme with its slashes when it
 * has one (https://, https:/), so no form of a user part (user:pw@host, https:/u:pw@host, a / or another @ in the
 * password) is kept; leading space is trimmed first. */
function addressKept(text) {
    const t = String(text).trimStart()
    if (!t.includes("@")) return t
    const scheme = /^[A-Za-z][A-Za-z0-9+.-]*:\/+/.exec(t)?.[0] || ""
    return scheme + t.slice(t.lastIndexOf("@") + 1)
}
/* An operation's input from the posted form, by its entry of DO; and what was typed, to show again after a refusal. */
function inputOf(spec) {
    const parameters = ec.web.parameters
    const posted = new Set(Object.keys(parameters))
    const many = name => {
        const value = parameters[name]
        if (value == null || value === "") return []
        return typeof value === "object" && value.length != null ? Array.from(value).map(String) : [String(value)]
    }
    const input = {}
    const typed = {}
    // a post's text is kept whole, up to the longest a site allows
    // a form's own credentials (notKept) are not kept either, and an address is kept without a user part (user:password@)
    const keep = (name, value) => {
        if (SECRET.includes(name) || (spec.notKept || []).includes(name) || value == null) return
        const text = String(value).slice(0, name === "content" ? 2000000 : name === "body" ? 100000 : 4000)
        typed[name] = ADDRESSES.includes(name) ? addressKept(text) : text
    }
    for (const name of spec.fields || [])
        if (posted.has(name)) {
            input[name] = param(name) ?? ""
            keep(name, input[name])
        }
    for (const name of spec.typedOnly || []) if (param(name) != null) keep(name, param(name))
    for (const name of spec.optional || [])
        if (param(name) != null) {
            input[name] = param(name)
            keep(name, input[name])
        }
    for (const name of spec.flags || []) {
        input[name] = param(name) === "true"
        keep(name, input[name])
    }
    for (const name of spec.optionalFlags || [])
        if (param(name) === "true") {
            input[name] = true
            keep(name, true)
        }
    for (const name of spec.numbers || [])
        if (posted.has(name)) {
            const value = param(name)
            input[name] =
                value == null
                    ? spec.emptyText && name !== "expectedRevision"
                        ? ""
                        : null
                    : /^[0-9]{1,15}$/.test(value)
                      ? Number(value)
                      : value
            keep(name, value ?? "")
        }
    for (const name of spec.mib || [])
        if (posted.has(name)) {
            const value = param(name)
            input[name] =
                value == null
                    ? spec.emptyText
                        ? ""
                        : null
                    : /^[0-9]{1,12}(?:\.[0-9]{1,12})?$/.test(value)
                      ? Math.round(Number(value) * 1048576)
                      : value
            keep(name, value ?? "")
        }
    for (const name of spec.lists || []) input[name] = many(name).join(",")
    // a list the operation takes as one: checked boxes, or names typed with commas or spaces between (a handle with its @)
    const listed = name =>
        many(name)
            .flatMap(value => value.split(/[\s,]+/))
            .map(value => value.replace(/^@/, ""))
            .filter(Boolean)
    for (const name of spec.arrays || []) {
        input[name] = listed(name)
        keep(name, input[name].join(", "))
    }
    for (const name of spec.optionalArrays || []) {
        const values = listed(name)
        if (values.length) input[name] = values
        keep(name, values.join(", "))
    }
    // a field the form showed with its value (was_<name>) is sent only when that was changed
    for (const name of spec.changed || [])
        if (posted.has("was_" + name) && (param(name) ?? "") === (param("was_" + name) ?? "")) delete input[name]
    // a day typed as a date means the whole of that day
    for (const name of spec.days || []) if (/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(input[name] || "")) input[name] += " 23:59:59"
    return {input, typed, posted}
}
/* A path under the mount, or null: where a form may send the browser. */
const under = (base, location) =>
    smithy.siteLocal(location) && (location === base || location.startsWith(base + "/") || location.startsWith(base + "?"))
        ? location
        : null
/* The framework's lease dialog for a lease (System › Vaults › Lease, plans/Vault-Instances.md §3.7 of mr-moqui), where an
 * approver of its vault opens it in their browser. In local mode on this server: a path on this host when it serves the
 * framework's screens, else (a site on a host of its own that refuses them: /qapps is Not Found there, and its session
 * is the host's) the webapp's own host, where the person signs in to the apps. Otherwise on the authority's web address
 * (pass@backend-web-url). Null when neither is known. */
function leaseDialog(leaseId) {
    const path = "/qapps/system/Vaults/Lease?leaseId=" + encodeURIComponent(String(leaseId))
    const transport = ec.resource.script("component://mr-pass/service/pass/Transport.js")
    if (transport.current().kind === "local") {
        if (ec.web.servesFrameworkScreens) return path
        const root = String(ec.web.getWebappRootUrl(true, true) || "").replace(/\/$/, "")
        return /^https?:\/\//.test(root) ? root + path : null
    }
    try {
        return transport.webBase() + path
    } catch (error) {
        return null
    }
}
/* One transition of Smithy/Do (Do.xml): the form's operation, then 303, to the page of what was made or changed with a
 * notice, or back to the form with the refusal. The framework has checked the session token before this runs. */
function run(name, siteId, bases) {
    const spec = Object.hasOwn(DO, name) ? DO[name] : null
    if (!spec) fail()
    ec.web.response.setHeader("Cache-Control", "no-store")
    const c = {base: bases.smithy || "", account: bases.account ?? "/account"}
    const gitAccessPage = c.account + "/GitAccess"
    const back = spec.account ? gitAccessPage : under(c.base, param("returnTo")) || c.base + "/"
    if (!ec.user.userId) return smithy.seeOther(c.account + "/Login?returnTo=" + encodeURIComponent(back))
    if (spec.preview) return preview(siteId, back)
    if (spec.step) return step(name, spec, siteId, back)
    const {input, typed, posted} = inputOf(spec)
    const refuse = error => {
        // what was typed is kept for the form's next page, but not for a record the caller may not see
        smithy.setFlash({form: name, key: param("formKey") || "", error, values: error.notFound ? {} : typed})
        smithy.seeOther(back)
    }
    const confirm = typeof spec.confirm === "function" ? spec.confirm(posted) : !!spec.confirm
    if (confirm && param("confirm") !== "yes") return refuse({message: "Confirm this change on its own page first.", field: null})
    // DG7: a form whose fields are not the operation's one to one (adjust), and a release's file uploaded with its form
    if (spec.adjust) spec.adjust(input, posted)
    let stagedId = null
    if (spec.upload && ec.web.multiPartParameters?.file) {
        const checked = spec.uploadCheck ? spec.uploadCheck(input, siteId) : null
        if (checked) return refuse(checked)
        const staged = portal.attempt(
            "stageAttachment",
            {siteId, purpose: "repositoryFile", repositoryId: input.repositoryId || "", file: ec.web.multiPartParameters.file},
            {newTransaction: true}
        )
        const attachment = staged.result?.attachment
        if (!attachment) return refuse({message: staged.error?.message || "Choose a file to upload.", field: "file"})
        if (attachment.scanState && attachment.scanState !== "clean")
            return refuse({message: "The file was held by the scanner and was not added.", field: "file"})
        input.attachmentId = attachment.attachmentId
        stagedId = attachment.attachmentId
    }
    // in its own transaction, so a refusal does not undo this transition's answer
    const out = portal.attempt(name, {siteId, ...input}, {newTransaction: true})
    // a file staged for a write that was refused is not kept
    if (out.error && stagedId) portal.attempt("removeStagedAttachment", {siteId, attachmentId: stagedId}, {newTransaction: true})
    // a change of the account's git access asks for the password again: that refusal is not a sign-in's
    if (out.error && spec.account && out.error.kind === "AuthenticationRequired") {
        // the password (and the second factor's code) again; or, for an account that has no password, a fresh sign-in
        const again = out.error.reason === "recentSignInRequired"
        return refuse({
            message: again ? out.error.message : "Enter your password again, and your second-factor code if you use one.",
            field: again ? null : "password",
            signIn: again
        })
    }
    if (out.error)
        return refuse({
            message: out.error.message,
            field: out.error.fieldErrors?.[0]?.field || null,
            reason: out.error.reason || null,
            ...(out.error.kind === "NotFound" ? {notFound: true} : {})
        })
    const result = out.result || {}
    smithy.setFlash({
        notice: spec.notice(result),
        ...(spec.token && result.token ? {token: {name: input.name || "", token: String(result.token)}} : {})
    })
    smithy.seeOther(
        (spec.done && spec.done(result, c, back, {siteId, ...input})) || (spec.account ? gitAccessPage : under(c.base, param("successTo")) || back)
    )
}
/* editFile (design §9.5): one step of a file's edit to the next. What was typed is kept in the session for the one next page
 * of the edit (the save step, or the editor again), which the form's returnTo names; nothing is written. The step first
 * reads the edit's context, so an account that may not view the repository, or a path that is not there, stores nothing
 * (Not Found), and a text over the site's edit size is refused and not kept (editGuard, which a preview of a file's text
 * passes too). An upload's file is staged with the authority
 * here (stageAttachment, scanned), and the save names its attachment. */
function editGuard(name, siteId, back) {
    const repositoryId = param("repositoryId") || ""
    const path = param("path") || ""
    const context = portal.attempt(
        "getEditContext",
        {siteId, repositoryId, refPath: (param("branch") || "") + (path ? "/" + path : ""), editAction: param("action") || "update"},
        {newTransaction: true}
    )
    if (context.error || context.result.editable === false) fail()
    const limit = Number(context.result.maxEditBytes) || 1048576
    // the size in bytes of what was typed (UTF-8)
    const size = encodeURIComponent(param("content") || "").replace(/%[0-9A-F]{2}/g, "x").length
    if (size <= limit) return true
    // nothing of the text is kept
    smithy.setFlash({
        form: name,
        key: param("formKey") || "",
        values: {repositoryId, branch: param("branch") || "", path},
        stage: "edit",
        error: {message: "This text is larger than a file edited on its page may be (" + sizeText(limit) + "). Change the file with git.", field: "content"}
    })
    smithy.seeOther(back)
    return false
}
function step(name, spec, siteId, back) {
    if (!editGuard(name, siteId, back)) return
    const {typed} = inputOf(spec)
    const stage = param("stage") === "edit" ? "edit" : "save"
    const repositoryId = param("repositoryId") || ""
    let error = null
    if (param("action") === "upload" && stage === "save") {
        const file = ec.web.multiPartParameters?.file
        const staged = file ? portal.attempt("stageAttachment", {siteId, purpose: "repositoryFile", repositoryId, file}, {newTransaction: true}) : null
        const attachment = staged?.result?.attachment
        if (!attachment) error = {message: staged?.error?.message || "Choose a file to upload.", field: "file"}
        else if (attachment.scanState && attachment.scanState !== "clean") error = {message: "The file was held by the scanner and was not uploaded.", field: "file"}
        else {
            typed.attachmentId = attachment.attachmentId
            typed.fileName = String(attachment.filename || "")
            const to = String(typed.newPath || "")
            if (!to || to.endsWith("/")) typed.newPath = to + typed.fileName
        }
    }
    smithy.setFlash({form: name, key: param("formKey") || "", values: typed, ...(error ? {error, stage: "edit"} : {stage})})
    smithy.seeOther(back)
}
/* previewPost (design §8 NewIssue): the text of a form as the authority would show it, cleaned. A plain form's Preview button
 * posts here and is answered 303 back to the form, which shows the preview above what was typed; the composer's island asks
 * for JSON. Nothing is stored but the one next page's flash. */
function preview(siteId, back) {
    const of = PREVIEWED.includes(param("previewOf")) ? param("previewOf") : null
    if (!of) fail()
    // a file's text is kept for the next page as a step keeps it: only for who may edit there, and within the edit size
    if (DO[of].step && !editGuard(of, siteId, back)) return
    const sourceFormat = param("sourceFormat") === "html" ? "html" : "markdown"
    // in its own transaction, as a write is: a refusal does not undo this transition's answer
    const out = portal.attempt("previewPost", {siteId, body: param(DO[of].previewField || "body") || "", sourceFormat}, {newTransaction: true})
    const html = out.error ? null : String(StringUtilities.cleanHtml(out.result.body || ""))
    if (String(ec.web.request.getHeader("accept") || "").includes("application/json"))
        return ec.web.sendJsonResponse(out.error ? {error: out.error.message} : {body: html})
    smithy.setFlash({
        form: of,
        key: param("formKey") || "",
        values: inputOf(DO[of]).typed,
        ...(out.error ? {error: {message: out.error.message, field: "body"}} : {preview: html || "<p>Nothing to preview.</p>"})
    })
    smithy.seeOther(back)
}
;({
    newGroup,
    newRepository,
    site,
    groupMembers,
    groupSettings,
    settingsAccess,
    repositorySettings,
    refForms,
    gitAccess,
    run,
    leaseDialog,
    DO,
    PREVIEWED,
    inputOf,
    // what SmithyIssues.js and SmithyReview.js build their pages with
    visibilities,
    Markup,
    h,
    attributes,
    hidden,
    contextOf,
    banner,
    gate,
    formOf,
    open,
    input,
    textarea,
    select,
    check,
    submit,
    hint,
    tabsOf,
    confirmCard
})
