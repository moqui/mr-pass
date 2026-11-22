/* Smithy's site (Dogfood DG7, D15, §5.8, §5.9, §7; plan/design-smithy.md §6 Search, §13, §15.8): the Search page, a
 * repository's Docs (a page of its docs directory at a branch or tag, the ref picker, the table of contents, the page's
 * headings and the docs search), its Releases and a release (ReleaseDetail: notes, files with their sizes and SHA-256, the
 * source archives, and a Maintainer's forms), a release file's download, a group's addons.xml for ./moq component-get, the
 * Landing section of a group's Settings and the Redirects tab of the site's Settings. Every read is the authority's (Mantle's
 * SmithySite.js through pass.Facade.call#Operation), which keeps each record's own rule; a page leaves out only what would
 * be refused. The paths a DG7 read gives are from the host's root, the mount included (Smithy.js rooted). Rendered text
 * (a docs page, release notes) was cleaned by the authority; its relative links are made the repository's pages here
 * (Smithy.js rewriteLinks). Pages are plain HTML built as escaped markup (SmithyForms.js h), and the forms post to
 * Smithy/Do with the session token. CC0 plus patent grant. */
const smithy = ec.resource.script("component://mr-pass/screen/Smithy/Smithy.js")
const forms = ec.resource.script("component://mr-pass/screen/Smithy/SmithyForms.js")
const {portal, fail, need, maybe, param, enc, query, dateText, sizeText, shortId, rooted, plain} = smithy
const {Markup, h, attributes, hidden, contextOf, banner, gate, formOf, open, input, textarea, select, check, submit, hint, confirmCard} =
    forms
const issues = () => ec.resource.script("component://mr-pass/screen/Smithy/SmithyIssues.js")

// ===== Search (design §6 Search, §13.5) =====
/* The kinds searchSite answers, in its order, with their words. */
const KINDS = [
    ["repository", "Repositories"],
    ["group", "Groups"],
    ["component", "Components"],
    ["issue", "Issues"],
    ["mergeRequest", "Merge requests"],
    ["docs", "Docs"],
    ["topic", ec.l10n.localize("Forum topics")]
]
const kindText = kind => KINDS.find(([key]) => key === kind)?.[1] || kind
/* The place a search is narrowed to (?in=<group or repository path>): {groupId or repositoryId, path, kind}, or null. */
function placeOf(siteId, within) {
    if (!within || !/^[A-Za-z0-9_.-]{1,100}(?:\/[A-Za-z0-9_.-]{1,100}){0,4}$/.test(within)) return null
    const found = maybe("resolveSmithyPath", {siteId, path: within})
    if (found?.kind === "group") return {groupId: found.groupId, path: found.canonicalPath || within, kind: "group"}
    if (found?.kind === "repository") return {repositoryId: found.repositoryId, path: found.canonicalPath || within, kind: "repository"}
    return null
}
/* Search (design §6), at -/search?q=: one box over the public projections, the kinds as a filter, narrowed to a group or a
 * repository by ?in=. Several kinds give at most ten results each, with a link to more of one kind; one kind is paged.
 * Each result is what the operation answers: its kind, title, snippet, place and day. Never kept by a cache (an issue may
 * become confidential). */
function search(siteId, bases, siteInfo, self) {
    const c = contextOf(bases, siteInfo, self, smithy.takeFlash())
    const action = c.base + "/-/search"
    const q = String(param("q") || "")
        .trim()
        .slice(0, 200)
    const kind = KINDS.some(([key]) => key === param("kind")) ? param("kind") : ""
    const place = placeOf(siteId, param("in"))
    const cursor = param("cursor")
    const link = more => action + query({q, kind, in: place?.path, ...(more || {})})
    const form = h`<form method="get" action="${action}" class="card" role="search" id="SmithySearch"><label>Search <input type="search" name="q" value="${q}" maxlength="200" required></label> <label>Show <select name="kind"><option value="">Everything</option>${KINDS.map(
        ([key, text]) => h`<option value="${key}"${attributes({selected: key === kind})}>${text}</option>`
    )}</select></label>${place ? h`${hidden("in", place.path)} <span>in <a href="${c.base}/${enc(place.path)}">${place.path}</a> · <a href="${action + query({q, kind})}">everywhere</a></span>` : ""} <button>Search</button></form>`
    const head = h`<h1>Search</h1>${banner(c)}${form}`
    if (!q) return {html: h`${head}<p class="card" id="SmithySearchHint">Search repositories, groups, components, issues, merge requests, docs and forum topics: what you may see of each.</p>`.html}
    const out = portal.attempt("searchSite", {
        siteId,
        query: q,
        ...(kind ? {types: kind, limit: 20} : {}),
        ...(place?.groupId ? {groupId: place.groupId} : {}),
        ...(place?.repositoryId ? {repositoryId: place.repositoryId} : {}),
        ...(kind && cursor ? {cursor} : {})
    })
    if (out.error) return {html: h`${head}<p role="alert" class="error" id="SmithySearchError">${out.error.message}</p>`.html}
    const results = out.result.resultList || []
    const sections = KINDS.map(([key]) => [key, results.filter(result => result.type === key)]).filter(([, list]) => list.length)
    const row = result => {
        const href = rooted(result.path)
        const facts = [result.repositoryPath && result.type !== "repository" ? result.repositoryPath : null, dateText(result.date)].filter(Boolean)
        // a title and a snippet are text of an index (a docs page, a topic, a component.xml): escaped, and plain text
        const title = plain(result.title)
        return h`<li class="wrap smithy-row">${href ? h`<a href="${href}">${title}</a>` : title}${
            facts.length ? h` <small>${facts.join(" · ")}</small>` : ""
        }${result.snippet ? h`<br><small>${plain(result.snippet)}</small>` : ""}</li>`
    }
    return {
        html: h`${head}${
            sections.length
                ? sections.map(
                      ([key, list]) =>
                          h`<section class="card" id="SmithySearch_${key}" aria-label="${kindText(key)}"><h2>${kindText(key)}</h2><ul>${list.map(row)}</ul>${
                              !kind && list.length >= 10 ? h`<p><a href="${link({kind: key})}">More ${kindText(key).toLowerCase()}</a></p>` : ""
                          }</section>`
                  )
                : h`<p class="card" id="SmithySearchNone">Nothing found${kind ? " among " + kindText(kind).toLowerCase() : ""}.</p>`
        }${out.result.nextCursor ? h`<p><a href="${link({cursor: out.result.nextCursor})}" id="SmithySearchMore">More results</a></p>` : ""}`.html
    }
}

// ===== Docs (design §13.2) =====
/* The docs directory of a repository, as the authority reads it (SmithyRepository.docsPath, docs by default). */
const docsRoot = path =>
    String(path || "docs")
        .replace(/^\/+|\/+$/g, "")
        .split("/")
        .filter(segment => segment && segment !== "." && segment !== "..")
        .join("/") || "docs"
/* Docs (design §13.2), at -/docs/<refPath>: a page of the repository's docs directory at a branch, a tag or a commit
 * (getDocsPage), with the ref picker (a GET form whose choice, a branch or a tag the read named, is redirected: {redirect};
 * any other choice is not taken), the table of contents (beside
 * the page; a drawer above it on a phone), the page's headings, "Edit this page" at a branch, and the docs search box. A
 * relative link to a Markdown file of the directory is its Docs page, another file of the repository its Blob page, an
 * image its raw file; a link that leaves the repository has no address. Not Found where docs are off. */
function docs(shell, refPath, bases, siteInfo, self) {
    if (!shell.repository.features?.docs) fail()
    const c = contextOf(bases, siteInfo, self, shell.flash)
    const r = shell.repository
    const u = smithy.urls(c.base, r.repositoryPath)
    const found = need("getDocsPage", {siteId: shell.siteId, repositoryId: r.repositoryId, refPath: refPath || ""})
    const ref = found.ref?.kind === "commit" ? found.ref.commitId : found.ref?.name || ""
    const picked = param("ref")
    // the picker's choice: a branch or a tag of the list it was made from (or the ref shown), never a path of the parameter's
    if (picked && (picked === ref || (found.refList || []).some(row => ["branch", "tag"].includes(row.kind) && row.name === picked)))
        return {redirect: u.section("docs", picked)}
    const root = docsRoot(r.docsPath)
    const page = String(found.path || "")
    const href = path => u.section("docs", ref + "/" + path)
    const directory = page.split("/").slice(0, -1).join("/")
    const html = smithy.rewriteLinks(found.html, u, ref, root + (directory ? "/" + directory : ""), {root, href})
    const refs = found.refList || []
    const picker = h`<form method="get" action="${u.section("docs")}" class="smithy-inline" id="SmithyDocsRef"><label>Version <select name="ref">${["branch", "tag"].map(
        refKind => {
            const list = refs.filter(row => row.kind === refKind)
            return list.length
                ? h`<optgroup label="${refKind === "branch" ? "Branches" : "Tags"}">${list.map(
                      row => h`<option value="${row.name}"${attributes({selected: row.name === ref})}>${row.name}</option>`
                  )}</optgroup>`
                : ""
        }
    )}${found.ref?.kind === "commit" ? h`<option value="${ref}" selected>${shortId(ref)}</option>` : ""}</select></label> <button>Show</button></form>`
    const contents = h`<ul>${(found.tocList || []).map(
        entry =>
            h`<li style="padding-left:${Math.min(Number(entry.depth) || 0, 6)}rem">${
                entry.path
                    ? h`<a href="${href(entry.path)}"${attributes({"aria-current": entry.path === page ? "page" : null})}>${entry.title}</a>`
                    : h`<strong>${entry.title}</strong>`
            }</li>`
    )}</ul>`
    const headings = (found.headingList || []).filter(heading => Number(heading.level) >= 2 && Number(heading.level) <= 3)
    const searchBox = h`<form method="get" action="${c.base}/-/search" role="search" class="card" id="SmithyDocsSearch"><label>Search the docs <input type="search" name="q" maxlength="200" required></label>${hidden("kind", "docs")}${hidden("in", r.repositoryPath)} <button>Search</button><br><small>The docs at the default branch.</small></form>`
    const editHref = c.signedIn && !r.archived ? rooted(found.editPath) : null
    return {
        html: h`<div class="smithy-docs"><nav class="card smithy-toc smithy-wide" aria-label="Contents" id="SmithyDocsContents"><h2>Contents</h2>${contents}</nav><div>${searchBox}<details class="card smithy-toc smithy-narrow" id="SmithyDocsDrawer"><summary>Contents</summary>${contents}</details><p class="wrap">${picker}${
            editHref ? h` · <a href="${editHref}" id="SmithyDocsEdit">${ec.l10n.localize("Edit this page")}</a>` : ""
        } · <a href="${u.blob(ref, root + "/" + page)}">Source</a></p>${
            headings.length
                ? h`<details class="card" id="SmithyDocsHeadings"><summary>On this page</summary><ul>${headings.map(
                      heading => h`<li style="padding-left:${Number(heading.level) - 2}rem"><a href="#${heading.anchor}">${heading.text}</a></li>`
                  )}</ul></details>`
                : ""
        }<article class="card wrap smithy-body" id="SmithyDocsPage">${new Markup(html)}</article></div></div>`.html
    }
}

// ===== Releases (design §13.3) =====
/* Who changes a repository's releases: a Maintainer with a confirmed address of a repository that is not archived (the
 * repository's capabilities; the authority checks each write). */
const canRelease = shell => !!shell.capabilities?.canMerge
const releaseHref = (u, tag) => u.section("releases", tag)
/* A release's files (design §13.3): name with its download, size and SHA-256; an image's name; a Maintainer's Remove. */
function assetsOf(c, u, release, editable) {
    const assets = release.assetList || []
    if (!assets.length) return h`<p id="SmithyReleaseNoAssets"><small>This release has no files.</small></p>`
    return h`<ul class="smithy-asset" id="SmithyReleaseAssets">${assets.map(asset => {
        const download = rooted(asset.path)
        return h`<li class="wrap" id="SmithyAsset_${asset.assetId}">${
            asset.assetKind === "image"
                ? h`<strong>${asset.name}</strong> <small>container image</small> <code>${asset.imageName}</code>`
                : h`${download ? h`<a href="${download}" rel="nofollow">${asset.name}</a>` : h`<strong>${asset.name}</strong>`}${
                      asset.sizeBytes != null ? h` <small>${sizeText(asset.sizeBytes)}</small>` : ""
                  }${asset.sha256 ? h`<br><small>SHA-256 <code>${asset.sha256}</code></small>` : ""}`
        }${editable ? h` <small><a href="${releaseHref(u, release.tag)}${query({removeAsset: asset.assetId})}">Remove</a></small>` : ""}</li>`
    })}</ul>`
}
/* One release as a card of the list: its name and tag, its state, day, notes and files. */
function releaseCard(c, u, release) {
    const notes = release.notesHtml ? smithy.rewriteLinks(release.notesHtml, u, release.tag || "", "") : ""
    return h`<article class="card" id="SmithyRelease_${String(release.tag || "").replace(/[^A-Za-z0-9_-]/g, "_")}"><h3 class="wrap"><a href="${releaseHref(u, release.tag)}">${release.name || release.tag}</a> <small class="smithy-chip">${release.published ? "Published" : "Draft"}</small></h3><p><small>${release.tag}${
        release.publishedAt ? " · " + dateText(release.publishedAt) : ""
    }${release.commitId ? h` · <a href="${u.commit(release.commitId)}"><code>${shortId(release.commitId)}</code></a>` : ""}</small></p>${
        notes ? h`<div class="wrap smithy-body">${new Markup(notes)}</div>` : ""
    }${assetsOf(c, u, release, false)}</article>`
}
/* Releases (design §13.3), at -/releases: the repository's releases newest first, a draft for a Maintainer alone (findReleases),
 * by cursor; New release from a tag for a Maintainer. */
function releases(shell, bases, siteInfo, self) {
    const c = contextOf(bases, siteInfo, self, shell.flash)
    const r = shell.repository
    const u = smithy.urls(c.base, r.repositoryPath)
    const cursor = param("cursor")
    const found = need("findReleases", {siteId: shell.siteId, repositoryId: r.repositoryId, limit: 20, ...(cursor ? {cursor} : {})})
    const list = found.releaseList || []
    let create = ""
    if (canRelease(shell)) {
        const released = new Set(list.map(release => release.tag))
        const tags = (maybe("findRefs", {siteId: shell.siteId, repositoryId: r.repositoryId, refType: "tag", namesOnly: true, limit: 100})?.refList || [])
            .map(ref => ref.name)
            .filter(tag => !released.has(tag))
        const f = formOf(c, "storeRelease", "new")
        create = tags.length
            ? h`<details class="card" id="SmithyNewRelease"${attributes({open: !!f.error || !!f.preview})}><summary><strong>New release</strong></summary>${open(c, f, {plain: true})}${hidden("repositoryId", r.repositoryId)}${hidden(
                  "operationId",
                  portal.operationId()
              )}${select(f, "tag", "Tag", tags.map(tag => [tag, tag]), {hint: "A release is made of a tag the repository has. Push the tag first."})}${input(f, "name", "Name", {
                  maxlength: 250,
                  hint: "Empty: the tag's name."
              })}${issues().textField(f, "Notes", {required: false, rows: 10, island: true})}${check("published", "Publish it now", f.value("published") === "true")}${hint(
                  "A draft is seen by Maintainers only. Publishing adds the files the tag's latest successful pipeline run uploaded."
              )}${check("announce", "Announce it in the news", f.value("announce") === true || f.value("announce") === "true")}${hint(
                  "A topic in the news category of the nearest group that has one, when it is published."
              )}${issues().textButtons(c, f, "Save release")}${issues().island(c, siteInfo, f, "Notes")}</details>`
            : h`<p class="card" id="SmithyNewReleaseNone">Every tag has a release, or there is no tag yet. Push a tag to make a release of it.</p>`
    }
    return {
        html: h`<h2>Releases</h2>${create}<section id="SmithyReleaseList" aria-label="Releases">${
            list.length ? list.map(release => releaseCard(c, u, release)) : h`<p class="card">No releases yet.</p>`
        }</section>${found.nextCursor ? h`<p><a href="${u.section("releases")}${query({cursor: found.nextCursor})}" id="SmithyReleasesMore">More releases</a></p>` : ""}`
            .html
    }
}
/* The files of the tag's latest successful pipeline run (not a merge request's), for Attach a run's file: at most three jobs
 * read, and only when the page is asked for them (?attach=artifact). */
function runFiles(shell, tag) {
    if (!shell.repository.features?.pipelines) return []
    const key = {siteId: shell.siteId, repositoryId: shell.repository.repositoryId}
    const run = (maybe("findPipelineRuns", {...key, refName: "refs/tags/" + tag, state: "success", limit: 5})?.runList || []).find(
        row => !row.mergeRequestNum
    )
    if (!run) return []
    const jobs = (maybe("getPipelineRun", {...key, runNum: run.runNum})?.jobList || []).slice(0, 3)
    return jobs.flatMap(job =>
        (maybe("getJobRun", {...key, runNum: run.runNum, jobRunId: job.jobRunId})?.artifactList || [])
            .filter(artifact => artifact.artifactKind !== "report")
            .map(artifact => ({artifactId: artifact.artifactId, label: plain(artifact.name) + " (" + plain(job.jobName) + ", run #" + run.runNum + ")"}))
    )
}
/* ReleaseDetail (design §13.3), at -/releases/<tag>, in the repository's shell: the release (getRelease) with its state, day,
 * commit, notes, files (sizes, SHA-256, downloads), the tag's source archives and its component; for a Maintainer (canEdit)
 * the forms: the name and notes (the composer), Publish or Make it a draft (asked again on ?confirm=publish, unpublish),
 * Announce, a file attached by upload, from the tag's pipeline run (?attach=artifact) or as a container image's name, Remove
 * (asked again on ?removeAsset=) and Withdraw (asked again on ?confirm=delete). A draft is Not Found but to a Maintainer. */
function releaseDetail(shell, tag, bases, siteInfo, self) {
    const c = contextOf(bases, siteInfo, self, shell.flash)
    const r = shell.repository
    const u = smithy.urls(c.base, r.repositoryPath)
    const found = need("getRelease", {siteId: shell.siteId, repositoryId: r.repositoryId, tag: String(tag || "")})
    const release = found.release
    const editable = !!found.capabilities?.canEdit
    const page = releaseHref(u, release.tag)
    const key = h`${hidden("repositoryId", r.repositoryId)}${hidden("tag", release.tag)}`
    const forumMounted = (siteInfo.mounts || []).some(mount => mount.app === "forum")
    const head = h`<article id="SmithyReleaseHead" class="wrap"><h2>${release.name || release.tag} <small class="smithy-chip" id="SmithyReleaseState">${release.published ? "Published" : "Draft"}</small></h2><p><small>Tag ${release.tag}${
        release.publishedAt ? " · published " + dateText(release.publishedAt) : ""
    }${release.commitId ? h` · <a href="${u.commit(release.commitId)}"><code>${shortId(release.commitId)}</code></a>` : ""} · <a href="${u.tree(release.tag, "")}">Files at this tag</a> · <a href="${u.section("releases")}">All releases</a>${
        release.announcementTopicId
            ? forumMounted
                ? h` · <a href="${bases.forum || ""}/t/${encodeURIComponent(release.announcementTopicId)}">Announced in the news</a>`
                : " · announced in the news"
            : ""
    }</small></p></article>`
    // the questions asked again, each on the release's own page
    const asked = param("confirm")
    if (editable && asked === "delete")
        return {
            html: h`${head}${confirmCard(c, "deleteRelease", {
                title: "Withdraw the release " + release.tag,
                lines: [
                    "This withdraws the release " + (release.name || release.tag) + " and removes its " + (release.assetList || []).length + " files, which cannot be undone.",
                    "The tag " + release.tag + " stays, and a release can be made of it again."
                ],
                fields: {repositoryId: r.repositoryId, tag: release.tag, expectedRevision: release.revision},
                button: "Withdraw release",
                cancelHref: page,
                returnTo: page + "?confirm=delete",
                successTo: u.section("releases")
            })}`.html
        }
    if (editable && (asked === "publish" || asked === "unpublish") && (asked === "publish") !== !!release.published) {
        const f = formOf(c, "storeRelease", "publish")
        const publish = asked === "publish"
        return {
            html: h`${head}${open(c, f, {
                title: (publish ? "Publish " : "Make a draft of ") + release.tag,
                returnTo: page + "?confirm=" + asked,
                successTo: page
            })}${key}${hidden("expectedRevision", release.revision)}${hidden("published", publish ? "true" : "false")}${hidden("confirm", "yes")}<p>${
                publish
                    ? "Everyone who may see this repository will see the release and download its files. The files the tag's latest successful pipeline run uploaded are added to it."
                    : "Only this repository's Maintainers will see the release; its files stay, and its downloads are refused to everyone else."
            }</p>${publish ? check("announce", "Announce it in the news", false) : ""}${
                publish ? hint("A topic in the news category of the nearest group that has one.") : ""
            }<p><button>${publish ? "Publish release" : "Make it a draft"}</button> <a href="${page}">Cancel</a></p></form>`.html
        }
    }
    const removing = editable && param("removeAsset") ? (release.assetList || []).find(asset => asset.assetId === param("removeAsset")) : null
    if (removing)
        return {
            html: h`${head}${confirmCard(c, "removeReleaseAsset", {
                title: "Remove " + removing.name,
                lines: ["This removes the file " + removing.name + " from the release " + release.tag + " and deletes it, which cannot be undone."],
                fields: {repositoryId: r.repositoryId, assetId: removing.assetId},
                button: "Remove file",
                cancelHref: page,
                returnTo: page + query({removeAsset: removing.assetId}),
                successTo: page
            })}`.html
        }
    const notes = release.notesHtml ? smithy.rewriteLinks(release.notesHtml, u, release.tag, "") : ""
    const archives = (found.archiveList || [])
        .map(archive => ({format: archive.format, href: rooted(archive.path)}))
        .filter(archive => archive.href)
    const body = h`${
        notes ? h`<section class="card wrap smithy-body" id="SmithyReleaseNotes" aria-label="Notes">${new Markup(notes)}</section>` : ""
    }<section class="card" id="SmithyReleaseFiles" aria-label="Files"><h3>Files</h3>${assetsOf(c, u, release, editable)}${
        archives.length
            ? h`<p><small>Source code: ${archives.map((archive, i) => h`${i ? " · " : ""}<a href="${archive.href}" rel="nofollow">${archive.format}</a>`)}${
                  c.signedIn || smithy.publicRepository(r) ? "" : " (for a signed-in account)"
              }</small></p>`
            : ""
    }</section>${
        found.component
            ? h`<p class="card" id="SmithyReleaseComponent">The Moqui component <strong>${found.component.name}</strong>${
                  found.component.version ? " " + found.component.version : ""
              }${(found.component.dependsOn || []).length ? ", depending on " + found.component.dependsOn.join(", ") : ""}.</p>`
            : ""
    }`
    if (!editable) return {html: h`${head}${body}`.html}
    // the notes as stored, which the authority gives a Maintainer for the edit form
    return {html: h`${head}${body}${maintainerForms(c, shell, {...release, notes: found.notes ?? release.notes}, key, page, siteInfo)}`.html}
}
/* A Maintainer's forms of a release (design §13.3). */
function maintainerForms(c, shell, release, key, page, siteInfo) {
    const r = shell.repository
    const actions = h`<p class="card" id="SmithyReleaseActions">${
        release.published
            ? h`<a href="${page}?confirm=unpublish">Make it a draft</a>`
            : h`<a href="${page}?confirm=publish" id="SmithyReleasePublish"><strong>Publish</strong></a>`
    } · <a href="${page}?confirm=delete" id="SmithyReleaseDelete">Withdraw release</a></p>`
    const announce =
        release.published && !release.announcementTopicId
            ? h`${open(c, formOf(c, "storeRelease", "announce"), {title: "Announce"})}${key}${hidden("expectedRevision", release.revision)}${hidden(
                  "announce",
                  "true"
              )}<p>A topic in the news category of the nearest group that has one, with the release's notes.</p>${submit("Announce the release")}`
            : ""
    const edit = formOf(c, "storeRelease", "edit")
    // an unnamed release (the authority names it by its tag) has an empty field, and the name is sent only when changed
    // (was_name), so a save of its notes does not make the tag its name
    const editForm = h`${open(c, edit, {title: "Name and notes"})}${key}${hidden("expectedRevision", release.revision)}${input(edit, "name", "Name", {
        value: release.name && release.name !== release.tag ? release.name : "",
        was: true,
        maxlength: 250,
        hint: "Empty: the tag's name."
    })}${issues().textField(edit, "Notes", {required: false, rows: 10, island: true, value: release.notes || ""})}${hint(
        release.notes == null && release.notesHtml ? "The notes are replaced by what you write here; empty keeps them as they are." : ""
    )}${issues().textButtons(c, edit, "Save")}${issues().island(c, siteInfo, edit, "Notes")}`
    // a file: an upload, a file of the tag's pipeline run, or a container image's name
    const file = formOf(c, "addReleaseAsset", "file")
    const upload = h`<form method="post" enctype="multipart/form-data" class="card" id="${file.id}" action="${c.base}/-/do/addReleaseAsset"><h3>Attach a file</h3>${
        file.error ? h`<p role="alert" class="error" id="${file.id}_error">${file.error.message}</p>` : ""
    }${hidden("moquiSessionToken", ec.web.sessionToken)}${hidden("returnTo", page)}${hidden("formKey", "file")}${key}${hidden("operationId", portal.operationId())}<label>File * <input type="file" name="file" required></label>${input(
        file,
        "name",
        "Name",
        {maxlength: 120, hint: "Empty: the file's own name. Letters, digits, '.', '_', '+', '-' and spaces. A file uploaded here is at most 10 MiB; a pipeline run of the tag uploads larger ones."}
    )}${submit("Attach file")}`
    const artifacts = param("attach") === "artifact" ? runFiles(shell, release.tag) : null
    const run = formOf(c, "addReleaseAsset", "artifact")
    const fromRun = shell.repository.features?.pipelines
        ? artifacts == null
            ? h`<p><a href="${page}?attach=artifact#Smithy_addReleaseAsset_artifact" id="SmithyReleaseRunFiles">Attach a file of the tag's pipeline run</a></p>`
            : artifacts.length
              ? h`${open(c, run, {title: "Attach a pipeline run's file", returnTo: page + "?attach=artifact"})}${key}${hidden("operationId", portal.operationId())}${select(
                    run,
                    "artifactId",
                    "File",
                    artifacts.map(artifact => [artifact.artifactId, artifact.label])
                )}${input(run, "name", "Name", {maxlength: 120, hint: "Empty: the file's own name."})}${submit("Attach file")}`
              : h`<p class="card" id="Smithy_addReleaseAsset_artifact">The tag has no successful pipeline run with files.</p>`
        : ""
    const image = formOf(c, "addReleaseAsset", "image")
    const imageForm = h`${open(c, image, {title: "Name a container image"})}${key}${hidden("operationId", portal.operationId())}${input(image, "imageName", "Image", {
        required: true,
        maxlength: 255,
        placeholder: "registry.example.org/moqui/moqui:1.2.0"
    })}${input(image, "name", "Name", {maxlength: 120, hint: "Empty: the image's name."})}${submit("Add image")}`
    return h`<section id="SmithyReleaseEdit" aria-label="Change the release">${actions}${announce}${editForm}${upload}${fromRun}${imageForm}</section>`
}
/* asset (design §4.4: -/release-assets/<assetId>/<name>): a release's file for a caller who reads the release
 * (downloadReleaseAsset), streamed by the facade as an attachment named by the authority, nosniff and never kept by a cache. */
function asset(siteId, repositoryId, assetId) {
    if (!assetId || !repositoryId) fail()
    try {
        ec.resource
            .script("component://mr-pass/service/pass/Facade.js")
            .downloadFile(siteId, "downloadReleaseAsset", {repositoryId, assetId}, {streamed: true})
    } catch (error) {
        ec.message.clearErrors()
        fail(error.moquiErrorKind === "NotFound" ? "NotFound" : error.moquiErrorKind || "NotFound", portal.refusal(error.message).text)
    }
}

// ===== a group's addons.xml (design §13.4) =====
/* addons (design §4.4: <group>/-/addons.xml): the components of the group and those below it the caller may view, in the
 * format ./moq component-get reads (getAddons' text as it is), as text/xml. A visitor's copy of a public group's file may be
 * kept by a cache for five minutes; anything else (a signed-in account's, which may list members-only components) is
 * no-store. */
function addons(shell) {
    const found = need("getAddons", {siteId: shell.siteId, groupId: shell.group.groupId})
    const shared =
        shell.visibility === "public" && !shell.hidden && ec.resource.script("component://mr-pass/screen/Shared/Headers.js").anonymous()
    const response = ec.web.response
    response.setContentType("text/xml; charset=utf-8")
    response.setHeader("X-Content-Type-Options", "nosniff")
    response.setHeader("Cache-Control", shared ? "public, max-age=300" : "no-store")
    if (shared) response.setHeader("Vary", "Cookie")
    response.write(String(found.xml || ""))
}

// ===== Settings: a group's landing page (design §11 GroupSettings General, §13.1) =====
/* The Landing section of a group's General tab, for its Owner: the Markdown file of a repository whose text is the group's
 * page, and the news category whose latest topics it shows (setGroupLanding). The file's fields hold what getGroupLanding
 * read (empty when the file is gone); the category's present value is not answered by the authority, so its field is
 * empty: a category typed replaces it, and "No news category" removes it. */
function landingSettings(shell, c) {
    const landing = maybe("getGroupLanding", {siteId: shell.siteId, groupId: shell.group.groupId}) || {}
    const f = formOf(c, "setGroupLanding")
    return h`${open(c, f, {title: "Landing page"})}${hidden("groupId", shell.group.groupId)}${hidden("expectedRevision", shell.group.revision)}<p>The group's page shows a Markdown file of a repository in place of its description, read at that repository's default branch and edited as any file is. The repository must be seen by everyone who sees the group.</p>${input(
        f,
        "landingRepositoryPath",
        "Repository",
        {value: landing.sourceRepositoryPath || "", was: true, maxlength: 250, placeholder: shell.group.groupPath + "/site", hint: "Its path. Empty with an empty file: the group's description again."}
    )}${input(f, "landingPath", "File", {value: landing.sourcePath || "", was: true, maxlength: 500, placeholder: "landing.md"})}${input(
        f,
        "newsContactListId",
        "News category",
        {
            maxlength: 40,
            hint:
                "The id of a forum category whose latest topics the page shows as news, readable by everyone who sees the group; empty leaves it as it is." +
                ((landing.newsList || []).length ? " The page shows news now." : "")
        }
    )}${check("clearNews", "No news category", false)}${submit("Save landing page")}`
}

// ===== Site settings: Redirects (design §11 SiteSettings, §13.6) =====
const SOURCES = [
    ["manual", "By hand"],
    ["site", ec.l10n.localize("The old site")],
    ["forum", ec.l10n.localize("The old forum")],
    ["github", "GitHub"]
]
const sourceText = source => SOURCES.find(([key]) => key === source)?.[1] || source || ""
/* The Redirects tab of the site's Settings, for its owners and operators (the page is theirs alone, Forms.site): the table of
 * old paths (findRedirects, searched and filtered by source, by cursor), Add (storeRedirect), Delete (asked again on
 * ?delete=<redirectId>) and Import a CSV of a site's move (importRedirects). The resolver answers an old path with a 301 to
 * its target before Not Found. */
function redirects(siteId, c, head, root) {
    const q = param("q")
    const source = SOURCES.some(([key]) => key === param("source")) ? param("source") : null
    const deleting = param("delete")
    if (deleting) {
        // the row is read again, so the question names what is deleted
        const row = (need("findRedirects", {siteId, ...(param("old") ? {query: param("old")} : {}), limit: 100}).redirectList || []).find(
            item => item.redirectId === deleting
        )
        if (row)
            return {
                html: h`${head}${confirmCard(c, "deleteRedirect", {
                    title: "Delete the redirect of " + (row.oldHost || "") + row.oldPath,
                    lines: ["An old link to " + (row.oldHost ? "https://" + row.oldHost : "") + row.oldPath + " stops leading to " + row.targetPath + " and answers Not Found."],
                    fields: {redirectId: row.redirectId},
                    button: "Delete redirect",
                    cancelHref: root,
                    returnTo: root + query({delete: row.redirectId, old: row.oldPath}),
                    successTo: root
                })}`.html
            }
    }
    const cursor = param("cursor")
    const found = need("findRedirects", {siteId, limit: 50, ...(q ? {query: q} : {}), ...(source ? {source} : {}), ...(cursor ? {cursor} : {})})
    const list = found.redirectList || []
    const find = h`<form method="get" action="${root}" class="card" role="search" id="SmithyRedirectFind"><label>Find <input type="search" name="q" value="${q || ""}" maxlength="200"></label> <label>From <select name="source"><option value="">Anywhere</option>${SOURCES.map(
        ([key, text]) => h`<option value="${key}"${attributes({selected: key === source})}>${text}</option>`
    )}</select></label> <button>Find</button>${q || source ? h` <a href="${root}">Clear</a>` : ""}</form>`
    const rows = list.map(
        row =>
            h`<li class="wrap smithy-row" id="SmithyRedirect_${row.redirectId}"><code>${row.oldHost ? row.oldHost : ""}${row.oldPath}</code> → <code>${row.targetPath}</code> <small>${sourceText(row.source)}${
                row.note ? " · " + row.note : ""
            } · <a href="${root}${query({delete: row.redirectId, old: row.oldPath})}">${ec.l10n.localize("Delete")}</a></small></li>`
    )
    const add = formOf(c, "storeRedirect")
    const load = formOf(c, "importRedirects")
    return {
        html: h`${head}<p>An old address of this site, or of a site it replaces, that no page takes now leads to its target with a permanent redirect (301), so old links and search results still land where they should.</p>${find}<section class="card" id="SmithyRedirectList" aria-label="Redirects">${
            rows.length ? h`<ul>${rows}</ul>` : h`<p>${q || source ? ec.l10n.localize("No redirect matches.") : "No redirects yet."}</p>`
        }${found.nextCursor ? h`<p><a href="${root}${query({q, source, cursor: found.nextCursor})}">More redirects</a></p>` : ""}</section>${open(c, add, {
            title: "Add a redirect"
        })}${hidden("operationId", portal.operationId())}${input(add, "oldPath", "Old address", {
            required: true,
            maxlength: 1000,
            placeholder: "/m/docs/framework",
            hint: "A path starting with /, or a whole address (https://forum.example.org/t/12) whose host is kept."
        })}${input(add, "oldHost", "Old host", {maxlength: 255, hint: "Empty: any of this site's hosts."})}${input(add, "targetPath", "Target", {
            required: true,
            maxlength: 1000,
            placeholder: "/moqui/mr-moqui/-/docs",
            hint: "A path of this site, or an https address of one of its hosts."
        })}${input(add, "note", "Note", {maxlength: 255})}${submit("Add redirect")}${open(c, load, {title: "Import a site's move"})}<p>One redirect a line: the old address, the target and an optional note, separated by commas (CSV). An old address the table has takes the new target, so an import runs twice safely; a line that is not taken is named in the notice.</p>${textarea(
            load,
            "csv",
            "Lines",
            {required: true, rows: 8, maxlength: 2000000}
        )}${select(load, "source", "From", SOURCES, {value: "site"})}${submit("Import")}`.html
    }
}
;({search, docs, docsRoot, releases, releaseDetail, asset, addons, landingSettings, redirects})
