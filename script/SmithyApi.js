/* Smithy's Forgejo API (plan/design-smithy.md §4.5): the part of Forgejo's REST API at /api/v1 that a Forgejo client (tea, fj, an
   editor's pull request view) calls to sign in, list repositories, and read, comment on, review and merge pull requests, which are
   Smithy's merge requests. It answers only on a public site's host whose site mounts Smithy at its root; on every other host, and
   under a path mount, /api/v1 stays the framework's (chain.doFilter()).

   A caller signs in with a Smithy access token (Account, Git access) in `Authorization: token <t>` or `Bearer <t>`; without one the
   request is anonymous and reads what a visitor reads. A session cookie, Basic auth and an api_key header are never used here, so a
   page cannot call the API with a visitor's session. Every route calls the PASS operations the Smithy pages call (Facade.js), so
   the same view and edit rules hold; this file checks no permission of its own. CC0 plus patent grant. */
const facade = () => ec.resource.script('component://mr-pass/service/pass/Facade.js')
const VERSION = '11.0.0+smithy'
const PAGE_DEFAULT = 50
const PAGE_MAX = 100
// a list scans at most this many rows of an operation's cursor before it pages them
const SCAN_MAX = 1000
const SECTIONS = ['pulls', 'issues', 'labels', 'assignees', 'statuses', 'branches', 'git', 'contents', 'issue_config', 'issue_templates', 'commits']
// Forgejo's reactions and Smithy's (the forum's like, thanks, insightful, agree, laugh)
const REACTIONS = { '+1': 'like', laugh: 'laugh', heart: 'thanks', hooray: 'agree', eyes: 'insightful' }
const MERGE_METHODS = { merge: 'merge', squash: 'squash', rebase: 'rebase', 'rebase-merge': 'rebase', 'fast-forward-only': 'fastForward' }
const REVIEW_STATES = { approved: 'APPROVED', changes: 'REQUEST_CHANGES', commented: 'COMMENT', requested: 'REQUEST_REVIEW' }
const REVIEW_EVENTS = { APPROVED: 'approve', APPROVE: 'approve', REQUEST_CHANGES: 'request_changes', COMMENT: 'comment' }

class ApiError extends Error {
    constructor(status, message) {
        super(message)
        this.status = status
    }
}
const refuse = (status, message) => {
    throw new ApiError(status, message)
}
const KIND_STATUS = { NotFound: 404, Unauthorized: 403, Forbidden: 403, Unprocessable: 422, Conflict: 409, Invalid: 422, Tarpit: 429, TooManyRequests: 429 }

/* One PASS operation; an input key whose value is undefined is left out (the schema refuses an unknown key). */
function op(name, input) {
    const given = {}
    for (const [key, value] of Object.entries(input)) if (value !== undefined) given[key] = value
    try {
        return facade().call(name, given)
    } catch (error) {
        ec.message.clearErrors()
        const kind = error?.moquiErrorKind
        let status = KIND_STATUS[kind] || 500
        // a refusal to somebody not signed in asks them to sign in
        if (status === 403 && !ec.user.userId) status = 401
        const text = String(error?.message || 'error').split('\n')[0].replace(/^(Error: )+/, '')
        if (status === 500) ec.logger.warn('Smithy API ' + name + ' failed (' + String(kind || 'error') + '): ' + text)
        throw new ApiError(status, status === 500 ? 'The request could not be answered' : text)
    }
}
/* The same, null when the operation refuses. */
function attempt(name, input) {
    try {
        return op(name, input)
    } catch (error) {
        if (error instanceof ApiError) return null
        throw error
    }
}
const list = (value) => Array.from(value || [])
const iso = (value) => {
    if (value == null || value === '') return null
    const n = Number(value)
    return Number.isFinite(n) ? new Date(n).toISOString() : String(value)
}
const operationId = () => 'api-' + ec.user.randomString(32)
/* A stable positive integer for a text id: its digits, else a hash (Forgejo's ids are integers). */
function intId(text) {
    const digits = String(text ?? '').replace(/\D/g, '')
    if (digits && digits.length <= 15) return Number(digits)
    let hash = 0
    for (const ch of String(text ?? '')) hash = (hash * 31 + ch.charCodeAt(0)) % 2147483647
    return hash || 1
}

/* ---- the request ---- */

/* The site of a host: its <public-site> in the conf, or null. */
function siteOf(host) {
    if (!host || !/^[a-z0-9.-]+$/.test(host)) return null
    try {
        return ec.factory.getConfValue('webapp-list/webapp[webroot]/public-site[' + host + ']@site-id') || null
    } catch (error) {
        return null
    }
}
function hostOf(request) {
    return String(request.serverName || '').trim().replace(/\.$/, '').toLowerCase()
}
/* Whether the site mounts Smithy at the root of the host (getSiteInfo's mounts). */
function smithyAtRoot(siteId, host) {
    const info = attempt('getSiteInfo', { siteId, hostname: host })
    return !!info && list(info.mounts).some((m) => m.app === 'smithy' && (m.pathPrefix === '/' || m.pathPrefix === ''))
}
/* Signs the request in by its access token, or leaves it anonymous; a bad token is 401. */
function signIn(request) {
    const header = String(request.getHeader('authorization') || '').trim()
    const given = /^(?:token|bearer)\s+(\S+)$/i.exec(header)
    if (ec.user.userId) ec.user.logoutLocal()
    if (!given) {
        if (/^(?:token|bearer)\b/i.test(header)) refuse(401, 'token is invalid')
        return
    }
    const ok = ec.user.loginUserKey(given[1], 'git')
    if (!ok || ec.user.loginKeyKind !== 'token') {
        ec.message.clearErrors()
        if (ec.user.userId) ec.user.logoutLocal()
        refuse(401, 'token is invalid')
    }
}
function query(request) {
    const out = {}
    for (const part of String(request.queryString || '').split('&')) {
        if (!part) continue
        const at = part.indexOf('=')
        const name = decodeURIComponent((at < 0 ? part : part.slice(0, at)).replace(/\+/g, ' '))
        const value = at < 0 ? '' : decodeURIComponent(part.slice(at + 1).replace(/\+/g, ' '))
        if (!(name in out)) out[name] = value
    }
    return out
}
function body(request) {
    const text = String(request.bodyText() || '').trim()
    if (!text) return {}
    try {
        const parsed = JSON.parse(text)
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : refuse(422, 'The body is a JSON object')
    } catch (error) {
        if (error instanceof ApiError) throw error
        refuse(400, 'The body is not JSON')
    }
}
function requireUser() {
    if (!ec.user.userId) refuse(401, 'A token is required')
}

/* ---- the answer ---- */

function send(response, status, value, headers) {
    response.setStatus(status)
    for (const [name, text] of Object.entries(headers || {})) response.setHeader(name, text)
    if (value === undefined) return
    if (typeof value === 'string') {
        response.setContentType('text/plain; charset=UTF-8')
        response.write(value)
        return
    }
    response.setContentType('application/json; charset=UTF-8')
    response.write(JSON.stringify(value))
}
/* One page of rows by limit and page, with X-Total-Count and the Link header Forgejo sends. */
function paged(c, rows) {
    const limit = Math.min(PAGE_MAX, Math.max(1, parseInt(c.query.limit, 10) || PAGE_DEFAULT))
    const page = Math.max(1, parseInt(c.query.page, 10) || 1)
    const last = Math.max(1, Math.ceil(rows.length / limit))
    const url = (n) => {
        const q = { ...c.query, limit: String(limit), page: String(n) }
        const text = Object.entries(q).map(([k, v]) => encodeURIComponent(k) + '=' + encodeURIComponent(v)).join('&')
        return '<' + c.base + c.requestPath + '?' + text + '>'
    }
    const links = []
    if (page < last) links.push(url(page + 1) + '; rel="next"', url(last) + '; rel="last"')
    if (page > 1) links.push(url(1) + '; rel="first"', url(Math.min(page - 1, last)) + '; rel="prev"')
    const headers = { 'X-Total-Count': String(rows.length) }
    if (links.length) headers.Link = links.join(', ')
    return { status: 200, value: rows.slice((page - 1) * limit, page * limit), headers }
}
const ok = (value, status) => ({ status: status || 200, value })

/* ---- Forgejo's shapes ---- */

function user(handle, displayName) {
    if (!handle) return null
    return { id: intId(handle), login: handle, login_name: '', full_name: displayName || '', email: '', avatar_url: '', username: handle }
}
const author = (a) => (a && a.handle ? user(a.handle, a.displayName) : null)

function ownerOf(path) {
    const parts = String(path).split('/')
    return parts.slice(0, -1).join('/')
}
/* A repository; a light one has its name, owner and address only (a pull request's head and base). */
function repoJson(c, view, rest) {
    const r = view.repository || view
    const path = r.repositoryPath
    const owner = ownerOf(path)
    const out = {
        id: intId(r.repositoryId || path),
        name: r.slug || path.split('/').pop(),
        full_name: path,
        owner: { id: intId(owner), login: owner, full_name: owner, username: owner },
        html_url: c.base + '/' + path,
        clone_url: c.base + '/' + path + '.git',
        ssh_url: view.cloneUrls?.ssh || '',
    }
    if (rest === 'light') return out
    const caps = view.capabilities || {}
    return {
        ...out,
        description: r.description || '',
        private: r.effectiveVisibility !== 'public',
        internal: r.effectiveVisibility === 'internal',
        fork: !!r.forkOf,
        mirror: !!r.mirror,
        archived: !!r.archived,
        empty: false,
        default_branch: r.defaultBranch || 'main',
        clone_url: view.cloneUrls?.https || out.clone_url,
        website: '',
        stars_count: 0,
        forks_count: Number(r.forkCount || 0),
        open_issues_count: Number(view.counts?.openIssues || 0),
        open_pr_counter: Number(view.counts?.openMergeRequests || 0),
        has_issues: r.features?.issues !== false,
        has_pull_requests: r.features?.mergeRequests !== false,
        has_wiki: false,
        has_releases: true,
        has_actions: !!r.features?.pipelines,
        updated_at: iso(r.lastPushAt),
        permissions: { admin: !!caps.canAdminister, push: !!caps.canPush, pull: true },
        allow_merge_commits: true,
        allow_squash_merge: true,
        allow_rebase: true,
        allow_rebase_explicit: true,
        allow_fast_forward_only_merge: true,
        // Smithy has no operation that updates a merge request's branch from its target
        allow_rebase_update: false,
        default_delete_branch_after_merge: false,
        default_merge_style: Object.entries(MERGE_METHODS).find(([, m]) => m === r.defaultMergeMethod)?.[0] || 'merge',
    }
}
function labelJson(label, index) {
    const id = /^\d{1,15}$/.test(String(label.labelId)) ? Number(label.labelId) : index + 1
    return { id, name: label.name, color: String(label.color || '').replace(/^#/, ''), description: label.description || '', exclusive: false, is_archived: false, url: '' }
}
function prState(state) {
    return state === 'merged' || state === 'closed' ? 'closed' : 'open'
}
function prJson(c, mr, extra) {
    const x = extra || {}
    const number = Number(mr.mergeRequestNum ?? mr.number)
    const light = (path) => (path ? repoJson(c, { repositoryPath: path, slug: path.split('/').pop() }, 'light') : null)
    const head = mr.sourceRepositoryPath || mr.repositoryPath
    return {
        id: number,
        number,
        title: mr.title,
        body: x.body ?? null,
        html_url: c.base + '/' + mr.repositoryPath + '/pulls/' + number,
        diff_url: c.base + '/' + mr.repositoryPath + '/pulls/' + number + '.diff',
        url: c.base + '/api/v1/repos/' + mr.repositoryPath + '/pulls/' + number,
        user: author(mr.author) || user(mr.authorHandle),
        state: prState(mr.state),
        draft: mr.state === 'draft',
        is_locked: false,
        merged: mr.state === 'merged',
        mergeable: mr.mergeable === true,
        flow: 0,
        head: { ref: mr.sourceRef, label: mr.sourceRef, sha: mr.headCommitId || '', repo: light(head), repo_id: intId(head) },
        base: { ref: mr.targetRef, label: mr.targetRef, sha: x.baseSha || mr.baseCommitId || '', repo: light(mr.repositoryPath), repo_id: intId(mr.repositoryPath) },
        merge_base: x.mergeBase || mr.baseCommitId || '',
        created_at: iso(mr.createdAt),
        updated_at: iso(mr.updatedAt),
        closed_at: iso(mr.closedAt || mr.mergedAt),
        merged_at: iso(mr.mergedAt),
        merge_commit_sha: null,
        merged_by: mr.mergedBy ? user(mr.mergedBy) : null,
        comments: Number(mr.commentCount || 0),
        additions: x.additions ?? null,
        deletions: x.deletions ?? null,
        changed_files: x.changedFiles ?? null,
        labels: [],
        assignees: [],
        requested_reviewers: (x.reviewers || []).filter((r) => r.state === 'requested').map((r) => user(r.handle, r.displayName)),
    }
}
function issueJson(c, issue, labels, body) {
    return {
        id: Number(issue.issueNumber),
        number: Number(issue.issueNumber),
        title: issue.title,
        body: body ?? '',
        html_url: c.base + '/' + issue.repositoryPath + '/issues/' + issue.issueNumber,
        user: author(issue.author),
        state: issue.state === 'closed' ? 'closed' : 'open',
        is_locked: false,
        comments: Number(issue.commentCount || 0),
        created_at: iso(issue.createdAt),
        updated_at: iso(issue.updatedAt),
        closed_at: iso(issue.closedAt),
        labels: list(issue.labels).map((label) => {
            const index = labels.findIndex((l) => l.labelId === (label.labelId ?? label))
            return index >= 0 ? labelJson(labels[index], index) : labelJson({ labelId: label.labelId, name: label.name || String(label), color: label.color }, 0)
        }),
        assignees: list(issue.assignees).map((a) => (typeof a === 'string' ? user(a) : author(a))),
        pull_request: null,
        repository: { full_name: issue.repositoryPath, name: issue.repositoryPath.split('/').pop(), owner: ownerOf(issue.repositoryPath) },
    }
}
function commitJson(c, repoPath, commit) {
    const message = commit.message || commit.summary || ''
    return {
        sha: commit.commitId,
        url: c.base + '/api/v1/repos/' + repoPath + '/git/commits/' + commit.commitId,
        html_url: c.base + '/' + repoPath + '/-/commit/' + commit.commitId,
        author: commit.authorHandle ? user(commit.authorHandle, commit.authorName) : null,
        committer: null,
        commit: {
            message,
            author: { name: commit.authorName || '', email: '', date: iso(commit.authorDate || commit.date) },
            committer: { name: commit.committerName || commit.authorName || '', email: '', date: iso(commit.commitDate || commit.authorDate || commit.date) },
        },
        parents: list(commit.parentIds).map((sha) => ({ sha })),
        created: iso(commit.commitDate || commit.authorDate || commit.date),
    }
}

/* ---- comment ids: a record's posts, numbered so an id names its issue or merge request ---- */

// id = (number * 2 + (merge request ? 1 : 0)) * 1000000 + the post's ordinal in its conversation
const commentId = (record, ordinal) => (record.number * 2 + (record.mr ? 1 : 0)) * 1000000 + Number(ordinal)
function commentRecord(id) {
    const n = Number(id)
    if (!Number.isSafeInteger(n) || n < 1000000) refuse(404, 'Not found')
    const key = Math.floor(n / 1000000)
    return { number: Math.floor(key / 2), mr: key % 2 === 1, ordinal: n % 1000000 }
}

/* ---- the repository and its records ---- */

function repository(c, path) {
    const found = op('resolveSmithyPath', { siteId: c.siteId, path })
    if (found.kind !== 'repository' || !found.repositoryId) refuse(404, 'Not found')
    return { repositoryId: found.repositoryId, path: found.canonicalPath || path }
}
function mergeRequest(c, repo, number) {
    return op('getMergeRequest', { siteId: c.siteId, repositoryId: repo.repositoryId, mergeRequestNum: Number(number) })
}
/* An issues/{n} route's record: the issue of that number, else the merge request (Smithy's #n rule). */
function record(c, repo, number) {
    const n = Number(number)
    if (!Number.isSafeInteger(n) || n < 1) refuse(404, 'Not found')
    const issue = attempt('getIssue', { siteId: c.siteId, repositoryId: repo.repositoryId, issueNumber: n })
    if (issue) return { number: n, mr: false, issue: issue.issue, topic: issue.issue.topic }
    const mr = mergeRequest(c, repo, n)
    return { number: n, mr: true, mergeRequest: mr, topic: mr.mergeRequest.topic }
}
/* Every post of a conversation, the first (the record's text) included, up to SCAN_MAX. */
function posts(c, topic) {
    const out = []
    let cursor
    while (out.length < SCAN_MAX) {
        const page = op('getPosts', { siteId: c.siteId, rootCommEventId: topic.rootCommEventId, limit: 100, cursor })
        out.push(...list(page.postList))
        cursor = page.nextCursor
        if (!cursor || !list(page.postList).length) break
    }
    return out
}
function rootPost(c, topic) {
    const page = attempt('getPosts', { siteId: c.siteId, rootCommEventId: topic.rootCommEventId, limit: 1 })
    return list(page?.postList).find((p) => Number(p.ordinal) === 1) || null
}
function commentJson(c, rec, post) {
    const kind = rec.mr ? 'pulls' : 'issues'
    const id = commentId(rec, post.ordinal)
    return {
        id,
        body: String(post.body ?? ''),
        user: author(post.author),
        created_at: iso(post.entryDate),
        updated_at: iso(post.lastUpdatedStamp || post.entryDate),
        html_url: c.base + '/' + c.repo.path + '/' + kind + '/' + rec.number + '#issuecomment-' + id,
        issue_url: c.base + '/api/v1/repos/' + c.repo.path + '/issues/' + rec.number,
        pull_request_url: rec.mr ? c.base + '/api/v1/repos/' + c.repo.path + '/pulls/' + rec.number : '',
    }
}
/* The posts of line comments (a merge request's review threads), which the comments list leaves to the reviews. */
function threadPostIds(c, rec) {
    if (!rec.mr) return new Set()
    const changes = attempt('getMergeRequestChanges', { siteId: c.siteId, repositoryId: c.repo.repositoryId, mergeRequestNum: rec.number })
    return new Set(list(changes?.threadList).flatMap((t) => list(t.postList).map((p) => p.postId)))
}
function reactionsJson(c, post) {
    const out = []
    const mine = list(post.myReactions)
    const me = mine.length ? currentUser(c) : null
    for (const [forgejo, smithy] of Object.entries(REACTIONS)) {
        const count = Number(post.reactions?.[smithy] || 0)
        const own = mine.includes(smithy)
        for (let i = 0; i < count; i++) out.push({ content: forgejo, user: own && i === 0 ? me : null, created_at: iso(post.entryDate) })
    }
    return out
}
function currentUser(c) {
    if (!ec.user.userId) return null
    if (c.me === undefined) {
        const info = attempt('getSiteInfo', { siteId: c.siteId, hostname: c.host })
        c.me = info?.profile?.handle ? user(info.profile.handle, info.profile.displayName) : user(ec.user.username)
    }
    return c.me
}
function setReaction(c, post, content, active) {
    const key = REACTIONS[content]
    if (!key) refuse(422, 'Smithy has no reaction ' + content)
    op('setReaction', { siteId: c.siteId, postId: post.postId, reactionKey: key, active })
}
function findPost(c, id) {
    const parts = commentRecord(id)
    const rec = record(c, c.repo, parts.number)
    if (rec.mr !== parts.mr) refuse(404, 'Not found')
    const post = posts(c, rec.topic).find((p) => Number(p.ordinal) === parts.ordinal)
    if (!post || parts.ordinal === 1) refuse(404, 'Not found')
    return { rec, post }
}

/* ---- diffs ---- */

function unifiedDiff(files) {
    const out = []
    for (const f of files) {
        const oldPath = f.oldPath || f.path
        out.push('diff --git a/' + oldPath + ' b/' + f.path)
        if (f.status === 'added') out.push('new file mode 100644')
        if (f.status === 'deleted') out.push('deleted file mode 100644')
        if (oldPath !== f.path) out.push('rename from ' + oldPath, 'rename to ' + f.path)
        const hunks = list(f.hunks)
        if (f.binary) {
            out.push('Binary files a/' + oldPath + ' and b/' + f.path + ' differ')
            continue
        }
        if (!hunks.length) continue
        out.push(f.status === 'added' ? '--- /dev/null' : '--- a/' + oldPath)
        out.push(f.status === 'deleted' ? '+++ /dev/null' : '+++ b/' + f.path)
        for (const h of hunks) {
            out.push('@@ -' + h.oldStart + ',' + h.oldLines + ' +' + h.newStart + ',' + h.newLines + ' @@')
            for (const line of list(h.lines)) {
                const mark = line.tag === 'delete' ? '-' : line.tag === 'insert' ? '+' : ' '
                out.push(mark + String(line.text ?? '').replace(/\r?\n$/, ''))
            }
        }
    }
    return out.length ? out.join('\n') + '\n' : ''
}
function withBinary(diffs, files) {
    const byPath = new Map(list(files).map((f) => [f.path, f]))
    return list(diffs).map((d) => ({ ...byPath.get(d.path), ...d }))
}

/* ---- the routes ---- */

function prList(c) {
    const state = c.query.state || 'open'
    if (!['open', 'closed', 'all'].includes(state)) refuse(422, 'state is open, closed or all')
    const head = (c.query.head || '').replace(/^[^:]*:/, '')
    const rows = []
    let cursor
    while (rows.length < SCAN_MAX) {
        const page = op('findMergeRequests', {
            siteId: c.siteId,
            repositoryId: c.repo.repositoryId,
            state: 'all',
            authorHandle: c.query.poster || undefined,
            limit: 100,
            cursor,
        })
        rows.push(...list(page.mergeRequestList))
        cursor = page.nextCursor
        if (!cursor || !list(page.mergeRequestList).length) break
    }
    let found = rows.filter((mr) => (state === 'all' || prState(mr.state) === state) && (!head || mr.sourceRef === head))
    const time = (mr, field) => Number(mr[field] || 0)
    const sorts = {
        oldest: (a, b) => time(a, 'createdAt') - time(b, 'createdAt'),
        recentupdate: (a, b) => time(b, 'updatedAt') - time(a, 'updatedAt'),
        leastupdate: (a, b) => time(a, 'updatedAt') - time(b, 'updatedAt'),
    }
    found = found.sort(sorts[c.query.sort] || ((a, b) => time(b, 'createdAt') - time(a, 'createdAt')))
    return paged(c, found.map((mr) => prJson(c, mr)))
}
function prGet(c, number) {
    const got = mergeRequest(c, c.repo, number)
    const mr = got.mergeRequest
    const changes = attempt('getMergeRequestChanges', { siteId: c.siteId, repositoryId: c.repo.repositoryId, mergeRequestNum: Number(number) })
    const refs = attempt('findRefs', { siteId: c.siteId, repositoryId: c.repo.repositoryId, refType: 'branch', query: mr.targetRef, limit: 20 })
    const target = list(refs?.refList).find((r) => r.name === mr.targetRef)
    const root = rootPost(c, mr.topic)
    return prJson(c, mr, {
        body: root ? String(root.body ?? '') : '',
        reviewers: list(got.reviewerList),
        additions: changes ? Number(changes.insertions || 0) : null,
        deletions: changes ? Number(changes.deletions || 0) : null,
        changedFiles: changes ? list(changes.fileList).length : null,
        mergeBase: changes?.mergeBaseId,
        baseSha: target?.commitId,
    })
}
function prCreate(c) {
    requireUser()
    const b = body(c.request)
    if (!b.title || !b.head || !b.base) refuse(422, 'title, head and base are required')
    const given = String(b.head)
    const at = given.indexOf(':')
    const branch = at < 0 ? given : given.slice(at + 1)
    const owner = at < 0 ? '' : given.slice(0, at)
    let sourceRepositoryId
    if (owner && owner !== ownerOf(c.repo.path)) sourceRepositoryId = repository(c, owner + '/' + c.repo.path.split('/').pop()).repositoryId
    const made = op('createMergeRequest', {
        siteId: c.siteId,
        repositoryId: c.repo.repositoryId,
        sourceRepositoryId,
        sourceRef: branch,
        targetRef: String(b.base),
        title: String(b.title),
        body: b.body == null ? undefined : String(b.body),
        sourceFormat: 'markdown',
        reviewerHandles: Array.isArray(b.reviewers) && b.reviewers.length ? b.reviewers.map(String) : undefined,
        operationId: operationId(),
    })
    // the new merge request as it is read, without its diff's counts (a GET has them)
    const got = mergeRequest(c, c.repo, made.mergeRequestNum)
    return ok(prJson(c, got.mergeRequest, { body: b.body == null ? '' : String(b.body), reviewers: list(got.reviewerList) }), 201)
}
function prEdit(c, number) {
    requireUser()
    const b = body(c.request)
    const got = mergeRequest(c, c.repo, number)
    const mr = got.mergeRequest
    const base = { siteId: c.siteId, repositoryId: c.repo.repositoryId, mergeRequestNum: Number(number) }
    if (b.title !== undefined || b.base !== undefined)
        op('updateMergeRequest', {
            ...base,
            title: b.title === undefined ? undefined : String(b.title),
            targetRef: b.base === undefined ? undefined : String(b.base),
            expectedRevision: mr.revision,
        })
    if (b.body !== undefined) editRoot(c, mr.topic, String(b.body ?? ''))
    if (b.state !== undefined) {
        if (!['open', 'closed'].includes(b.state)) refuse(422, 'state is open or closed')
        if (b.state !== prState(mr.state)) {
            const now = mergeRequest(c, c.repo, number).mergeRequest
            op('setMergeRequestState', { ...base, state: b.state, expectedRevision: now.revision })
        }
    }
    if (Array.isArray(b.labels) && b.labels.length) refuse(422, 'Smithy merge requests have no labels')
    return ok(prGet(c, number), 201)
}
function editRoot(c, topic, text) {
    const root = rootPost(c, topic)
    if (!root) refuse(404, 'Not found')
    op('updatePost', { siteId: c.siteId, postId: root.postId, body: text, sourceFormat: 'markdown', expectedRevision: root.revision, reason: 'Edited through the API' })
}
function prMerge(c, number) {
    requireUser()
    const b = body(c.request)
    const method = MERGE_METHODS[b.Do || 'merge']
    if (!method) refuse(422, 'Smithy merges by merge, squash, rebase or fast-forward-only')
    const mr = mergeRequest(c, c.repo, number).mergeRequest
    const title = b.MergeTitleField ? String(b.MergeTitleField) : ''
    const text = b.MergeMessageField ? String(b.MergeMessageField) : ''
    op('mergeMergeRequest', {
        siteId: c.siteId,
        repositoryId: c.repo.repositoryId,
        mergeRequestNum: Number(number),
        mergeMethod: method,
        message: title || text ? [title, text].filter(Boolean).join('\n\n') : undefined,
        deleteSourceBranch: b.delete_branch_after_merge === undefined ? undefined : !!b.delete_branch_after_merge,
        expectedHeadCommitId: b.head_commit_id ? String(b.head_commit_id) : undefined,
        expectedRevision: mr.revision,
    })
    return ok(undefined, 200)
}
function prCommits(c, number) {
    const changes = op('getMergeRequestChanges', { siteId: c.siteId, repositoryId: c.repo.repositoryId, mergeRequestNum: Number(number) })
    return paged(c, list(changes.commitList).map((commit) => commitJson(c, c.repo.path, commit)))
}
function prDiff(c, number) {
    const changes = op('getMergeRequestChanges', { siteId: c.siteId, repositoryId: c.repo.repositoryId, mergeRequestNum: Number(number), withDiffs: true })
    return ok(unifiedDiff(withBinary(changes.fileDiffList, changes.fileList)))
}
function reviews(c, number) {
    const got = mergeRequest(c, c.repo, number)
    const changes = attempt('getMergeRequestChanges', { siteId: c.siteId, repositoryId: c.repo.repositoryId, mergeRequestNum: Number(number) })
    const threads = list(changes?.threadList)
    return list(got.reviewerList).map((r, index) => {
        const comments = threads.flatMap((t) => list(t.postList).filter((p) => p.author?.handle === r.handle).map((p) => ({ thread: t, post: p })))
        return {
            id: index + 1,
            body: '',
            user: user(r.handle, r.displayName),
            state: REVIEW_STATES[r.state] || 'COMMENT',
            dismissed: false,
            stale: !!r.reviewedCommitId && r.reviewedCommitId !== got.mergeRequest.headCommitId,
            official: r.state === 'approved',
            commit_id: r.reviewedCommitId || '',
            submitted_at: iso(got.mergeRequest.updatedAt),
            html_url: c.base + '/' + c.repo.path + '/pulls/' + number + '#review-' + (index + 1),
            pull_request_url: c.base + '/api/v1/repos/' + c.repo.path + '/pulls/' + number,
            comments_count: comments.length,
            comments,
        }
    })
}
function review(c, number, id) {
    const found = reviews(c, number).find((r) => r.id === Number(id))
    if (!found) refuse(404, 'Not found')
    return found
}
const reviewOut = (r) => {
    const { comments, ...rest } = r
    return rest
}
function reviewComments(c, number, id) {
    const r = review(c, number, id)
    const rec = { number: Number(number), mr: true }
    const ordinals = new Map(posts(c, mergeRequest(c, c.repo, number).mergeRequest.topic).map((p) => [p.postId, p.ordinal]))
    return r.comments.map(({ thread, post }, index) => {
        const ordinal = ordinals.get(post.postId)
        const cid = ordinal ? commentId(rec, ordinal) : commentId(rec, 900000 + index)
        return {
            id: cid,
            body: String(post.body ?? ''),
            user: author(post.author),
            created_at: iso(post.createdAt),
            updated_at: iso(post.createdAt),
            html_url: c.base + '/' + c.repo.path + '/pulls/' + number + '#issuecomment-' + cid,
            path: thread.path,
            position: thread.newLine == null ? 0 : Number(thread.newLine),
            original_position: thread.oldLine == null ? 0 : Number(thread.oldLine),
            commit_id: thread.commitId || '',
            original_commit_id: thread.commitId || '',
            diff_hunk: '',
            pull_request_review_id: r.id,
            resolver: thread.resolved ? r.user : null,
        }
    })
}
function reviewCreate(c, number) {
    requireUser()
    const b = body(c.request)
    const decision = REVIEW_EVENTS[String(b.event || 'COMMENT').toUpperCase()]
    if (!decision) refuse(422, 'event is APPROVED, REQUEST_CHANGES or COMMENT')
    const commentList = (Array.isArray(b.comments) ? b.comments : []).map((m) => ({
        path: String(m.path || ''),
        body: String(m.body || ''),
        sourceFormat: 'markdown',
        ...(Number(m.new_position) > 0 ? { newLine: Number(m.new_position) } : Number(m.old_position) > 0 ? { oldLine: Number(m.old_position) } : {}),
    }))
    op('submitReview', {
        siteId: c.siteId,
        repositoryId: c.repo.repositoryId,
        mergeRequestNum: Number(number),
        decision,
        body: b.body == null ? undefined : String(b.body),
        sourceFormat: 'markdown',
        commentList: commentList.length ? commentList : undefined,
        operationId: operationId(),
    })
    const me = currentUser(c)
    const mine = reviews(c, number).find((r) => r.user?.login === me?.login)
    return ok(mine ? reviewOut(mine) : {}, 200)
}
function requestedReviewers(c, number, add) {
    requireUser()
    const b = body(c.request)
    const asked = (Array.isArray(b.reviewers) ? b.reviewers : []).map(String)
    const got = mergeRequest(c, c.repo, number)
    const now = list(got.reviewerList).filter((r) => r.state === 'requested').map((r) => r.handle)
    const next = add ? [...new Set([...now, ...asked])] : now.filter((h) => !asked.includes(h))
    op('setMergeRequestReviewers', {
        siteId: c.siteId,
        repositoryId: c.repo.repositoryId,
        mergeRequestNum: Number(number),
        reviewerHandles: next,
        expectedRevision: got.mergeRequest.revision,
    })
    return ok(add ? asked.map((h) => ({ id: 0, user: user(h), state: 'REQUEST_REVIEW' })) : undefined, add ? 201 : 204)
}
function statuses(c, sha) {
    const commit = op('getCommit', { siteId: c.siteId, repositoryId: c.repo.repositoryId, commitId: sha })
    const rows = list(commit.statusList).map((s, index) => ({
        id: index + 1,
        context: s.context || '',
        status: String(s.state || 'pending').toLowerCase(),
        description: s.description || null,
        target_url: s.targetUrl || null,
        created_at: iso(s.createdAt || s.updatedAt || commit.commit?.commitDate),
        updated_at: iso(s.updatedAt || s.createdAt || commit.commit?.commitDate),
    }))
    return paged(c, rows)
}
function glob(pattern, name) {
    const re = '^' + String(pattern).split('*').map((part) => part.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*') + '$'
    return new RegExp(re).test(name)
}
function branch(c, name) {
    const refs = op('findRefs', { siteId: c.siteId, repositoryId: c.repo.repositoryId, refType: 'branch', query: name, limit: 50 })
    const ref = list(refs.refList).find((r) => r.name === name)
    if (!ref) refuse(404, 'Not found')
    // the rules are a Maintainer's to read; a caller who may not has no required checks to know of
    const rules = list(attempt('getBranchRules', { siteId: c.siteId, repositoryId: c.repo.repositoryId })?.ruleList).filter((r) => glob(r.refPattern, name))
    const contexts = [...new Set(rules.flatMap((r) => list(r.requiredStatusContexts)))]
    return {
        name,
        commit: { id: ref.commitId, message: ref.summary || '', timestamp: iso(ref.date) },
        protected: !!ref.protected || rules.length > 0,
        enable_status_check: contexts.length > 0,
        status_check_contexts: contexts,
    }
}
function gitCommit(c, sha, diff) {
    const got = op('getCommit', { siteId: c.siteId, repositoryId: c.repo.repositoryId, commitId: sha })
    if (!diff) {
        return {
            ...commitJson(c, c.repo.path, got.commit),
            stats: { total: Number(got.insertions || 0) + Number(got.deletions || 0), additions: Number(got.insertions || 0), deletions: Number(got.deletions || 0) },
        }
    }
    // a commit's hunks come a path at a time
    const files = list(got.fileList).slice(0, 300)
    const diffs = files.map((f) => {
        const one = attempt('getCommit', { siteId: c.siteId, repositoryId: c.repo.repositoryId, commitId: sha, path: f.path })
        return { ...f, ...(list(one?.fileDiffList).find((d) => d.path === f.path) || {}) }
    })
    return unifiedDiff(diffs)
}
function contents(c, path) {
    const ref = c.query.ref || undefined
    const repo = op('getRepository', { siteId: c.siteId, repositoryId: c.repo.repositoryId })
    const blob = op('getBlob', { siteId: c.siteId, repositoryId: c.repo.repositoryId, refPath: (ref || repo.repository.defaultBranch) + '/' + path, plain: true })
    if (blob.binary || blob.tooLarge || blob.text == null) refuse(422, 'Smithy answers the contents of a text file only')
    return {
        type: 'file',
        name: path.split('/').pop(),
        path,
        sha: blob.blobId,
        size: Number(blob.size || 0),
        encoding: 'base64',
        content: StringUtilities.base64Encode(String(blob.text)),
        html_url: c.base + '/' + c.repo.path + '/-/blob/' + (ref || repo.repository.defaultBranch) + '/' + path,
    }
}
/* A repository's labels. The path resolved, so the caller views it; Not Found then means issues are off, which Forgejo
   answers as no labels. */
function labels(c) {
    try {
        return list(op('findLabels', { siteId: c.siteId, repositoryId: c.repo.repositoryId }).labelList)
    } catch (error) {
        if (error instanceof ApiError && error.status === 404) return []
        throw error
    }
}
function issueList(c) {
    if (c.query.type === 'pulls') return paged(c, [])
    const state = c.query.state || 'open'
    if (!['open', 'closed', 'all'].includes(state)) refuse(422, 'state is open, closed or all')
    const all = labels(c)
    const names = (c.query.labels || '').split(',').map((s) => s.trim()).filter(Boolean)
    const labelIds = names.length
        ? names.map((name) => all.find((l, i) => l.name === name || String(labelJson(l, i).id) === name)?.labelId).filter(Boolean)
        : undefined
    if (names.length && labelIds.length !== names.length) return paged(c, [])
    const rows = []
    let cursor
    while (rows.length < SCAN_MAX) {
        const page = op('findIssues', {
            siteId: c.siteId,
            repositoryId: c.repo.repositoryId,
            state,
            labelIds,
            assigneeHandle: c.query.assigned_by || undefined,
            authorHandle: c.query.created_by || undefined,
            query: c.query.q || undefined,
            sort: c.query.sort === 'latest' || c.query.sort === 'oldest' ? 'created' : 'activity',
            limit: 100,
            cursor,
        })
        rows.push(...list(page.issueList))
        cursor = page.nextCursor
        if (!cursor || !list(page.issueList).length) break
    }
    if (c.query.sort === 'oldest') rows.reverse()
    return paged(c, rows.map((issue) => issueJson(c, issue, all)))
}
function issueGet(c, number) {
    const rec = record(c, c.repo, number)
    const root = rootPost(c, rec.topic)
    if (rec.mr) {
        const mr = rec.mergeRequest.mergeRequest
        const pr = prJson(c, mr, { body: root ? String(root.body ?? '') : '' })
        return { ...pr, pull_request: { merged: mr.state === 'merged', merged_at: iso(mr.mergedAt), html_url: pr.html_url } }
    }
    return issueJson(c, rec.issue, labels(c), root ? String(root.body ?? '') : '')
}
function issueCreate(c) {
    requireUser()
    const b = body(c.request)
    if (!b.title) refuse(422, 'title is required')
    const all = labels(c)
    const labelIds = (Array.isArray(b.labels) ? b.labels : []).map((id) => {
        const found = all.find((l, i) => labelJson(l, i).id === Number(id))
        return found ? found.labelId : refuse(422, 'No label ' + id)
    })
    const made = op('createIssue', {
        siteId: c.siteId,
        repositoryId: c.repo.repositoryId,
        title: String(b.title),
        body: b.body == null ? undefined : String(b.body),
        sourceFormat: 'markdown',
        labelIds: labelIds.length ? labelIds : undefined,
        assigneeHandles: Array.isArray(b.assignees) && b.assignees.length ? b.assignees.map(String) : undefined,
        operationId: operationId(),
    })
    const number = made.issueNumber ?? made.issue?.issueNumber
    return ok(issueGet(c, number), 201)
}
function issueEdit(c, number) {
    requireUser()
    const rec = record(c, c.repo, number)
    if (rec.mr) return prEdit(c, number)
    const b = body(c.request)
    const base = { siteId: c.siteId, repositoryId: c.repo.repositoryId, issueNumber: rec.number }
    const fresh = () => op('getIssue', base).issue
    if (b.title !== undefined) op('updateIssue', { ...base, title: String(b.title), expectedRevision: fresh().revision })
    if (b.body !== undefined) editRoot(c, rec.topic, String(b.body ?? ''))
    if (Array.isArray(b.assignees)) op('setIssueAssignees', { ...base, assigneeHandles: b.assignees.map(String), expectedRevision: fresh().revision })
    if (b.state !== undefined) {
        if (!['open', 'closed'].includes(b.state)) refuse(422, 'state is open or closed')
        const now = fresh()
        if (now.state !== b.state)
            op('setIssueState', { ...base, state: b.state, reason: b.state === 'closed' ? 'completed' : undefined, expectedRevision: now.revision })
    }
    return ok(issueGet(c, number), 201)
}
function issueLabels(c, number, method, labelId) {
    const rec = record(c, c.repo, number)
    if (method === 'GET') return ok(rec.mr ? [] : issueGet(c, number).labels)
    requireUser()
    if (rec.mr) refuse(422, 'Smithy merge requests have no labels')
    const all = labels(c)
    const smithyId = (id) => {
        const found = all.find((l, i) => labelJson(l, i).id === Number(id) || l.name === String(id))
        return found ? found.labelId : refuse(422, 'No label ' + id)
    }
    const current = list(rec.issue.labels).map((l) => l.labelId ?? l)
    let next
    if (method === 'DELETE') next = labelId === undefined ? [] : current.filter((id) => id !== smithyId(labelId))
    else {
        const asked = (Array.isArray(body(c.request).labels) ? body(c.request).labels : []).map(smithyId)
        next = method === 'PUT' ? asked : [...new Set([...current, ...asked])]
    }
    op('setIssueLabels', { siteId: c.siteId, repositoryId: c.repo.repositoryId, issueNumber: rec.number, labelIds: next, expectedRevision: rec.issue.revision })
    if (method === 'DELETE') return ok(undefined, 204)
    return ok(issueGet(c, number).labels)
}
function comments(c, number) {
    const rec = record(c, c.repo, number)
    const skip = threadPostIds(c, rec)
    return posts(c, rec.topic)
        .filter((p) => Number(p.ordinal) > 1 && !skip.has(p.postId))
        .map((p) => commentJson(c, rec, p))
}
function commentCreate(c, number) {
    requireUser()
    const b = body(c.request)
    if (!b.body) refuse(422, 'body is required')
    const rec = record(c, c.repo, number)
    const made = op('publishPost', { siteId: c.siteId, rootCommEventId: rec.topic.rootCommEventId, body: String(b.body), sourceFormat: 'markdown', operationId: operationId() })
    const post = posts(c, rec.topic).find((p) => p.postId === made.postId)
    return ok(post ? commentJson(c, rec, post) : { id: 0, body: String(b.body), user: currentUser(c), created_at: new Date().toISOString() }, 201)
}
function commentEdit(c, id) {
    requireUser()
    const b = body(c.request)
    if (b.body == null) refuse(422, 'body is required')
    const { rec, post } = findPost(c, id)
    op('updatePost', { siteId: c.siteId, postId: post.postId, body: String(b.body), sourceFormat: 'markdown', expectedRevision: post.revision, reason: 'Edited through the API' })
    const now = posts(c, rec.topic).find((p) => p.postId === post.postId) || post
    return ok(commentJson(c, rec, now))
}
function reactions(c, target, method) {
    if (method === 'GET') return paged(c, reactionsJson(c, target))
    requireUser()
    const b = body(c.request)
    setReaction(c, target, String(b.content || ''), method === 'POST')
    return method === 'POST' ? ok({ content: String(b.content), user: currentUser(c), created_at: new Date().toISOString() }, 201) : ok(undefined, 200)
}
function timeline(c, number) {
    return paged(
        c,
        comments(c, number).map((m) => ({ ...m, type: 'comment' })),
    )
}
function assignees(c) {
    const found = op('findAssignees', { siteId: c.siteId, repositoryId: c.repo.repositoryId, limit: 100 })
    return list(found.handleList).map((h) => (typeof h === 'string' ? user(h) : user(h.handle, h.displayName)))
}

/* The routes under repos/{path}/: the repository's path is every segment before the first section word. */
function repoRoute(c, segments, method) {
    let at = segments.findIndex((s, i) => i >= 2 && SECTIONS.includes(s))
    if (at < 0) at = segments.length
    c.repo = repository(c, segments.slice(0, at).join('/'))
    const [section, ...rest] = segments.slice(at)
    const key = [method, section || '', ...rest.map((s) => (/^\d+$/.test(s) ? '#' : /^\d+\.diff$/.test(s) ? '#.diff' : s))].join(' ')
    const n = rest[0]
    if (!section) {
        if (method !== 'GET') refuse(405, 'Method not allowed')
        return ok(repoJson(c, op('getRepository', { siteId: c.siteId, repositoryId: c.repo.repositoryId })))
    }
    if (section === 'branches' && method === 'GET' && rest.length) return ok(branch(c, rest.join('/')))
    if (section === 'contents' && method === 'GET' && rest.length) return ok(contents(c, rest.join('/')))
    if (section === 'statuses' && method === 'GET' && rest.length === 1) return statuses(c, rest[0])
    if (section === 'git' && rest[0] === 'commits' && rest.length === 2 && method === 'GET') {
        const sha = rest[1]
        return sha.endsWith('.diff') ? ok(gitCommit(c, sha.slice(0, -5), true)) : ok(gitCommit(c, sha, false))
    }
    switch (key) {
        case 'GET pulls':
            return prList(c)
        case 'POST pulls':
            return prCreate(c)
        case 'GET pulls #':
            return ok(prGet(c, n))
        case 'GET pulls #.diff':
            return prDiff(c, n.slice(0, -5))
        case 'PATCH pulls #':
            return prEdit(c, n)
        case 'POST pulls # merge':
            return prMerge(c, n)
        case 'GET pulls # merge':
            return mergeRequest(c, c.repo, n).mergeRequest.state === 'merged' ? ok(undefined, 204) : refuse(404, 'Not merged')
        case 'POST pulls # update':
            refuse(422, 'Smithy has no update of a merge request\'s branch from its target; merge or rebase it locally and push')
        case 'GET pulls # commits':
            return prCommits(c, n)
        case 'GET pulls # files':
            return paged(c, list(op('getMergeRequestChanges', { siteId: c.siteId, repositoryId: c.repo.repositoryId, mergeRequestNum: Number(n) }).fileList).map((f) => ({
                filename: f.path,
                previous_filename: f.oldPath || '',
                status: f.status === 'deleted' ? 'removed' : f.status,
                additions: Number(f.insertions || 0),
                deletions: Number(f.deletions || 0),
                changes: Number(f.insertions || 0) + Number(f.deletions || 0),
            })))
        case 'GET pulls # reviews':
            return paged(c, reviews(c, n).map(reviewOut))
        case 'POST pulls # reviews':
            return reviewCreate(c, n)
        case 'GET pulls # reviews #':
            return ok(reviewOut(review(c, n, rest[2])))
        case 'GET pulls # reviews # comments':
            return ok(reviewComments(c, n, rest[2]))
        case 'POST pulls # requested_reviewers':
            return requestedReviewers(c, n, true)
        case 'DELETE pulls # requested_reviewers':
            return requestedReviewers(c, n, false)
        case 'GET issues':
            return issueList(c)
        case 'POST issues':
            return issueCreate(c)
        case 'GET issues #':
            return ok(issueGet(c, n))
        case 'PATCH issues #':
            return issueEdit(c, n)
        case 'GET issues # comments':
            return ok(comments(c, n))
        case 'POST issues # comments':
            return commentCreate(c, n)
        case 'PATCH issues comments #':
            return commentEdit(c, n)
        case 'GET issues comments #': {
            const { rec, post } = findPost(c, n)
            return ok(commentJson(c, rec, post))
        }
        case 'GET issues comments # reactions':
        case 'POST issues comments # reactions':
        case 'DELETE issues comments # reactions':
            return reactions(c, findPost(c, n).post, method)
        case 'GET issues # reactions':
        case 'POST issues # reactions':
        case 'DELETE issues # reactions': {
            const root = rootPost(c, record(c, c.repo, n).topic)
            if (!root) refuse(404, 'Not found')
            return reactions(c, root, method)
        }
        case 'GET issues # labels':
        case 'POST issues # labels':
        case 'PUT issues # labels':
        case 'DELETE issues # labels':
            return issueLabels(c, n, method)
        case 'DELETE issues # labels #':
            return issueLabels(c, n, method, rest[2])
        case 'GET issues # timeline':
            return timeline(c, n)
        case 'GET labels':
            return paged(c, labels(c).map(labelJson))
        case 'GET assignees':
            return ok(assignees(c))
        case 'GET issue_config':
            return ok({ blank_issues_enabled: true, contact_links: [] })
        case 'GET issue_templates':
            return ok([])
    }
    refuse(404, 'Not found')
}
function repositories(c, input) {
    const rows = []
    let cursor
    while (rows.length < SCAN_MAX) {
        const page = op('findRepositories', { siteId: c.siteId, ...input, sort: 'name', limit: 100, cursor })
        rows.push(...list(page.repositoryList))
        cursor = page.nextCursor
        if (!cursor || !list(page.repositoryList).length) break
    }
    return paged(c, rows.map((r) => repoJson(c, r)))
}
function route(c, method, segments) {
    const [first, ...rest] = segments
    const path = segments.join('/')
    if (method === 'GET' && path === 'version') return ok({ version: VERSION })
    if (method === 'GET' && path === 'settings/api')
        return ok({ max_response_items: PAGE_MAX, default_paging_num: PAGE_DEFAULT, default_git_trees_per_page: 1000, default_max_blob_size: 10485760 })
    if (method === 'GET' && path === 'user') {
        requireUser()
        return ok({ ...currentUser(c), is_admin: false, active: true, created: null, last_login: null })
    }
    if (method === 'GET' && path === 'user/repos') {
        requireUser()
        return repositories(c, { mine: true })
    }
    if (first === 'orgs' && rest.length >= 2 && rest[rest.length - 1] === 'repos') {
        const groupPath = rest.slice(0, -1).join('/')
        const found = op('resolveSmithyPath', { siteId: c.siteId, path: groupPath })
        if (found.kind !== 'group' || !found.groupId) refuse(404, 'Not found')
        if (method === 'GET') return repositories(c, { groupId: found.groupId })
        if (method === 'POST') {
            requireUser()
            const b = body(c.request)
            if (!b.name) refuse(422, 'name is required')
            const made = op('createRepository', {
                siteId: c.siteId,
                groupId: found.groupId,
                slug: String(b.name),
                name: String(b.name),
                description: b.description == null ? undefined : String(b.description),
                visibility: b.private ? 'private' : 'public',
                withReadme: !!b.auto_init,
                operationId: operationId(),
            })
            return ok(repoJson(c, op('getRepository', { siteId: c.siteId, repositoryId: made.repositoryId })), 201)
        }
    }
    if (method === 'GET' && path === 'users/search') {
        const q = String(c.query.q || '').trim().replace(/^@/, '')
        // Smithy finds a person by their exact handle only
        const found = q ? attempt('getProfile', { siteId: c.siteId, handle: q }) : null
        const handle = found?.profile?.handle || found?.handle
        return ok({ ok: true, data: handle ? [user(handle, found.profile?.displayName || found.displayName)] : [] })
    }
    if (first === 'repos' && rest.length >= 2) return repoRoute(c, rest, method)
    refuse(404, 'Not found')
}

/* One API request on a site that mounts Smithy at its root: {status, value, headers}, written to the response. */
function handle(request, response, siteId, host) {
    ec.web?.declineSession?.()
    const scheme = 'https'
    const c = { request, siteId, host, base: scheme + '://' + host, query: query(request), requestPath: String(request.requestURI || '').split('?')[0] }
    const method = String(request.method || 'GET').toUpperCase()
    const segments = c.requestPath
        .replace(/^\/api\/v1\/?/, '')
        .split('/')
        .filter(Boolean)
        .map((s) => decodeURIComponent(s))
    ec.context.sharedMap.passSmithyApi = true
    try {
        signIn(request)
        const answer = route(c, method === 'HEAD' ? 'GET' : method, segments)
        send(response, answer.status, method === 'HEAD' ? undefined : answer.value, { ...answer.headers, 'Cache-Control': 'no-store' })
    } catch (error) {
        if (!(error instanceof ApiError)) {
            ec.message.clearErrors()
            ec.logger.warn('Smithy API ' + method + ' ' + c.requestPath + ' failed: ' + String(error?.message || error).split('\n')[0])
        }
        const status = error instanceof ApiError ? error.status : 500
        send(response, status, { message: status === 500 ? 'The request could not be answered' : error.message, url: 'https://forgejo.org/docs/latest/user/api-usage/' }, { 'Cache-Control': 'no-store' })
    } finally {
        ec.context.sharedMap.passSmithyApi = false
    }
}
/* The filter: the API's site, or the framework's /api/v1. */
function doFilter(request, response, chain) {
    const host = hostOf(request)
    const siteId = siteOf(host)
    if (!siteId) return chain.doFilter()
    ec.context.sharedMap.passSmithyApi = true
    let atRoot
    try {
        atRoot = smithyAtRoot(siteId, host)
    } finally {
        ec.context.sharedMap.passSmithyApi = false
    }
    if (!atRoot) return chain.doFilter()
    handle(request, response, siteId, host)
}
;({ doFilter, handle, siteOf, smithyAtRoot, commentRecord, unifiedDiff })
