// Smithy's Forgejo API (plan/design-smithy.md §4.5, script/SmithyApi.js): its filter called as the webroot calls it, with a request
// and a response object, on the site with Smithy at the root of smithy.localhost (test/MoquiConf.xml). CC0 plus patent grant.
const fixtures = () => ec.resource.script("component://mr-pass/test/Smithy/SmithyFixtures.js")
const api = () => ec.resource.script("component://mr-pass/script/SmithyApi.js")
const SITE = "SMITHY_ROOT"
const HOST = "smithy.localhost"
const MARIA = "pass.api.maria"
const STRANGER = "pass.api.stranger"
const s = {}

/* The site's mounts: Smithy at prefix, with the Account app. */
function mounts(prefix) {
    const site = ec.entity.find("mantle.public.PublicSite").condition("siteId", SITE).disableAuthz().one()
    fixtures().run("mantle.public.SiteServices.store#Mounts", {
        input: {
            siteId: SITE,
            expectedRevision: site.revision ?? site.policyRevision,
            mounts: [
                {app: "account", pathPrefix: "/account"},
                {app: "smithy", pathPrefix: prefix}
            ],
            hosts: [{hostname: HOST, canonical: true}]
        }
    })
}
/* A token of an account, made by its Git access operation. */
function token(username, name) {
    login(username, "moqui1!!")
    try {
        const made = fixtures().operation("createAccessToken", {siteId: SITE, name, password: "moqui1!!", operationId: "api-spec-" + name})
        if (!made.token) throw new Error("no token: " + JSON.stringify(made))
        return made.token
    } finally {
        login("john.doe")
    }
}
/* One request through the filter: {status, headers, json, text, passed} (passed: it went on to the framework). */
function call(method, path, {token: given, body, host = HOST, authorization} = {}) {
    const [pathOnly, queryString] = path.split("?")
    const headers = {}
    if (given) headers.authorization = "token " + given
    if (authorization) headers.authorization = authorization
    const request = {
        method,
        requestURI: "/api/v1/" + pathOnly,
        queryString: queryString || null,
        serverName: host,
        getHeader: name => headers[String(name).toLowerCase()] ?? null,
        bodyText: () => (body === undefined ? "" : JSON.stringify(body))
    }
    const response = {
        status: 200,
        headers: {},
        body: "",
        setStatus(code) {
            this.status = code
        },
        setHeader(name, value) {
            this.headers[name.toLowerCase()] = value
        },
        setContentType(type) {
            this.headers["content-type"] = type
        },
        write(value) {
            this.body += value
        }
    }
    let passed = false
    try {
        api().doFilter(request, response, {doFilter: () => (passed = true)})
    } finally {
        login("john.doe")
    }
    let json = null
    if (String(response.headers["content-type"] || "").startsWith("application/json")) json = JSON.parse(response.body)
    return {status: response.status, headers: response.headers, json, text: response.body, passed}
}

spec({
    requires: ["git"],
    setupSpec() {
        login("john.doe")
        const f = fixtures()
        f.site(SITE, HOST)
        mounts("/")
        s.group = f.group(SITE, "maria", "public")
        s.repo = f.repository(SITE, s.group, "project", "public", {"README.md": "# Project\n", "src/a.js": "const a = 1\n"}).repositoryId
        s.secret = f.repository(SITE, s.group, "secret", "private", {"README.md": "# Secret\n"}).repositoryId
        for (const [name, file] of [["fix/one", "src/one.js"], ["fix/two", "src/two.js"]]) {
            f.run("org.moqui.git.GitServices.create#GitRef", {repositoryId: s.repo, refName: name, refType: "branch"})
            f.run("org.moqui.git.GitServices.commit#GitFiles", {repositoryId: s.repo, branch: name, message: "Add " + file, fileMap: {[file]: "export const x = 1\n"}})
        }
        f.account(SITE, MARIA, {confirmed: true, handle: "maria", settled: true, groupId: s.group, role: "SmrMaintainer"})
        f.account(SITE, STRANGER, {confirmed: true, handle: "stranger", settled: true})
        s.maria = token(MARIA, "maria-api")
        s.stranger = token(STRANGER, "stranger-api")
    }
})

feature("Smithy API sign-in: anonymous reads, a token names its account, a bad token and a session are refused", {
    when() {
        return {
            version: call("GET", "version"),
            anonymous: call("GET", "user"),
            bad: call("GET", "user", {token: "not-a-token"}),
            basic: call("GET", "user", {authorization: "Basic am9obi5kb2U6bW9xdWk="}),
            maria: call("GET", "user", {token: s.maria}),
            bearer: call("GET", "user", {authorization: "Bearer " + s.maria}),
            publicRepo: call("GET", "repos/maria/project"),
            write: call("POST", "repos/maria/project/pulls", {body: {title: "x", head: "fix/one", base: "main"}})
        }
    },
    then({version, anonymous, bad, basic, maria, bearer, publicRepo, write}) {
        version.status === 200
        typeof version.json.version === "string"
        // john.doe is signed in around each call: the API reads no session, so this is anonymous
        anonymous.status === 401
        bad.status === 401
        basic.status === 401
        maria.status === 200
        maria.json.login === "maria"
        bearer.json.login === "maria"
        maria.headers["cache-control"] === "no-store"
        publicRepo.status === 200
        publicRepo.json.full_name === "maria/project"
        publicRepo.json.private === false
        publicRepo.json.permissions.push === false
        write.status === 401
    }
})

feature("Smithy API: a private repository is 404 to a stranger and to nobody, and read by its member", {
    when() {
        return {
            nobody: call("GET", "repos/maria/secret"),
            stranger: call("GET", "repos/maria/secret/pulls", {token: s.stranger}),
            member: call("GET", "repos/maria/secret", {token: s.maria}),
            missing: call("GET", "repos/maria/none", {token: s.maria})
        }
    },
    then({nobody, stranger, member, missing}) {
        nobody.status === 404
        stranger.status === 404
        member.status === 200
        member.json.private === true
        member.json.permissions.push === true
        missing.status === 404
    }
})

feature("Smithy API pull requests: create, list in pages, filter by head, read, diff, comment and merge", {
    when() {
        const out = {}
        out.one = call("POST", "repos/maria/project/pulls", {token: s.maria, body: {title: "Add one", head: "maria:fix/one", base: "main", body: "It adds *one*."}})
        out.two = call("POST", "repos/maria/project/pulls", {token: s.maria, body: {title: "Add two", head: "fix/two", base: "main"}})
        out.page1 = call("GET", "repos/maria/project/pulls?state=open&sort=oldest&limit=1&page=1")
        out.page2 = call("GET", "repos/maria/project/pulls?state=open&sort=oldest&limit=1&page=2")
        out.head = call("GET", "repos/maria/project/pulls?state=all&head=" + encodeURIComponent("fix/two"))
        const n = out.one.json?.number
        out.got = call("GET", "repos/maria/project/pulls/" + n, {token: s.maria})
        out.diff = call("GET", "repos/maria/project/pulls/" + n + ".diff")
        // a signed-in visitor comments (maria posted the merge request a moment ago, and the forum asks 10 seconds between posts)
        out.comment = call("POST", "repos/maria/project/issues/" + n + "/comments", {token: s.stranger, body: {body: "Looks good."}})
        out.comments = call("GET", "repos/maria/project/issues/" + n + "/comments")
        out.reviews = call("GET", "repos/maria/project/pulls/" + n + "/reviews", {token: s.maria})
        out.labels = call("GET", "repos/maria/project/labels")
        out.strangerMerge = call("POST", "repos/maria/project/pulls/" + n + "/merge", {token: s.stranger, body: {Do: "merge"}})
        out.merge = call("POST", "repos/maria/project/pulls/" + n + "/merge", {token: s.maria, body: {Do: "merge"}})
        out.merged = call("GET", "repos/maria/project/pulls/" + n)
        out.closed = call("GET", "repos/maria/project/pulls?state=closed")
        return out
    },
    then({one, two, page1, page2, head, got, diff, comment, comments, reviews, labels, strangerMerge, merge, merged, closed}) {
        one.status === 201
        two.status === 201
        one.json.html_url === "https://smithy.localhost/maria/project/pulls/" + one.json.number
        one.json.head.ref === "fix/one"
        one.json.base.ref === "main"
        one.json.user.login === "maria"
        // limit and page, with Forgejo's headers
        page1.json.length === 1
        page1.json[0].number === one.json.number
        page1.headers["x-total-count"] === "2"
        page1.headers.link.includes('rel="next"')
        page1.headers.link.includes("page=2")
        page2.json[0].number === two.json.number
        !page2.headers.link.includes('rel="next"')
        head.json.length === 1
        head.json[0].head.ref === "fix/two"
        got.json.body.includes("one")
        got.json.changed_files === 1
        got.json.additions === 1
        got.json.mergeable === true
        got.json.head.sha.length === 40
        diff.status === 200
        diff.text.startsWith("diff --git a/src/one.js b/src/one.js\n")
        diff.text.includes("+export const x = 1\n")
        comment.status === 201
        comment.json.body.includes("Looks good.")
        comment.json.user.login === "stranger"
        comments.json.some(row => row.id === comment.json.id)
        reviews.status === 200
        Array.isArray(reviews.json)
        labels.status === 200
        Array.isArray(labels.json)
        // the page's rule: a stranger merges nothing
        strangerMerge.status === 403
        merge.status === 200
        merged.json.merged === true
        merged.json.state === "closed"
        closed.json.some(row => row.number === one.json.number)
    }
})

feature("Smithy API mounting: under a path mount, and on another host, /api/v1 stays the framework's", {
    when() {
        const other = call("GET", "version", {host: "localhost"})
        mounts("/code")
        let path
        try {
            path = call("GET", "version")
        } finally {
            mounts("/")
        }
        return {other, path, root: call("GET", "version")}
    },
    then({other, path, root}) {
        other.passed === true
        other.text === ""
        path.passed === true
        path.text === ""
        root.passed === false
        root.status === 200
    }
})
