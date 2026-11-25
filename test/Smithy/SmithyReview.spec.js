// Smithy's merge request, fork and file editing pages (Dogfood DG4; plan/design-smithy.md §9, §19.1): one render each of
// MergeRequests, a merge request's Overview (the conversation, the agreement box and the merge box of who may merge) and
// Changes (the diff escaped, a line comment at its line, a line's comment form), of the Edit page and of its save step; and
// a save through Smithy/Do for each destination (the branch, a new branch with a merge request, a proposal) and its
// conflict (the conflict view, a path that is taken, a text's first newline and its line endings); and the pages' own
// rules with no screen rendered (the confirmations, a check's target, Sign's link). The routes are in Smithy's spec and the access rules in SmithyAccess; the rules behind the operations are
// Mantle's (SmithyMergeRequests, SmithyAgreement, SmithyForks, SmithyEdit). DG5 (§10, §11): one render of a running job's
// page (its log escaped and without terminal escapes, a failed test linked to the file at the run's commit, an artifact's
// download, the run waiting with Approve and run for its Owner, the log's island), the same run's page as a viewer through
// its page function (no Approve), and Run pipeline through Smithy/Do with its refusal on the form; the log's JSON rendered
// once, its refusals and an upload's through the page functions, a test's path and plain text. The run and its job are
// rows made here, since a spec cannot play the engine's runner; Mantle's SmithyPipelines covers the rules behind them.
const fixtures = () => ec.resource.script("component://mr-pass/test/Smithy/SmithyFixtures.js")
const SITE = "PASS_SMITHY_REVIEW"
const HOST = "smithy-review.example.test"
const VIEWER = "pass.smr.viewer"
const R = "/code/pass-smr/review"
const s = {}
const AUTHORS =
    "# Authors\n\n## Contributing\n\n- Written in YEAR by NAME - LOGIN\n\n## Copyright Waiver\n\n- Written in 2026 by Someone Else - someone\n\n## Grant of Patent License\n\n- Written in 2026 by Someone Else - someone\n"
const as = (username, work) => {
    login(username, "moqui1!!")
    try {
        return work()
    } finally {
        login("john.doe")
    }
}
const id = () => ec.user.randomString(32)
const BASES = {smithy: "/code", account: "/account"}
const INFO = {authenticated: true, site: {}, profile: {}}
const scripts = () => ({
    smithy: ec.resource.script("component://mr-pass/screen/Smithy/Smithy.js"),
    review: ec.resource.script("component://mr-pass/screen/Smithy/SmithyReview.js"),
    pipelines: ec.resource.script("component://mr-pass/screen/Smithy/SmithyPipelines.js")
})
/* The Edit page's own view for the current user, with no screen rendered: it takes what the last step left in the session. */
function editPage(refPath, action) {
    const {smithy, review} = scripts()
    const self = R + "/-/" + action + "/" + refPath
    return review.edit(smithy.repositoryShell(SITE, s.repo, "/code", self), refPath, action, BASES, INFO, self).html
}
spec({
    requires: ["git"],
    setupSpec() {
        login("john.doe")
        const f = fixtures()
        f.site(SITE, HOST)
        s.group = f.group(SITE, "pass-smr", "public")
        const made = f.repository(SITE, s.group, "review", "public", {
            "README.md": "# Review sample\n",
            "AUTHORS.md": AUTHORS,
            "docs/Guide.md": "# Guide\n\nRead it.\n",
            "docs/Blank.md": "\nStarts after a blank line\n",
            "src/main.js": "const a = 1\nconsole.log(a)\n",
            // DG5: a pipeline with the manual event, for Run pipeline
            "ci.xml": '<ci><pipeline name="check" on="push manual"><job name="unit" image="moqui-build"><step run="true"/></job></pipeline></ci>\n'
        })
        s.first = made.commitId
        s.repo = made.repositoryId
        // a confirmed account with no role: it may view, comment and propose
        f.account(SITE, VIEWER, {confirmed: true})
        // a branch with a commit main does not have, and a merge request from it with a comment on its second line
        f.run("org.moqui.git.GitServices.create#GitRef", {repositoryId: s.repo, refName: "fix/greeting", refType: "branch"})
        s.head = f.run("org.moqui.git.GitServices.commit#GitFiles", {
            repositoryId: s.repo,
            branch: "fix/greeting",
            message: "Greet <everyone>\n\nA longer note.",
            fileMap: {"src/main.js": "const a = 1\nconsole.log('<script>alert(1)</script>', a)\n"}
        }).commitId
        // the agreement is required here: the merge request's authors have not signed
        const agreement = f.operation("getAgreement", {siteId: SITE, repositoryId: s.repo})
        s.agreement = f.operation("setAgreement", {
            siteId: SITE,
            repositoryId: s.repo,
            setting: "required",
            agreementPath: "AUTHORS.md",
            expectedRevision: agreement.revision
        })
        s.request = f.operation("createMergeRequest", {
            siteId: SITE,
            repositoryId: s.repo,
            sourceRef: "fix/greeting",
            targetRef: "main",
            title: "Greet & thank everyone",
            body: "It greets **all**.\n\n<script>alert(2)</script>\n",
            sourceFormat: "markdown",
            operationId: "pass-smr-request-1"
        })
        // a branch whose name needs encoding in a path, with a merge request of its own
        f.run("org.moqui.git.GitServices.create#GitRef", {repositoryId: s.repo, refName: "fix#1%2", refType: "branch"})
        f.run("org.moqui.git.GitServices.commit#GitFiles", {
            repositoryId: s.repo,
            branch: "fix#1%2",
            message: "A branch with a hash",
            fileMap: {"README.md": "# Review sample, again\n"}
        })
        s.odd = f.operation("createMergeRequest", {
            siteId: SITE,
            repositoryId: s.repo,
            sourceRef: "fix#1%2",
            targetRef: "main",
            title: "From an odd branch",
            body: "Text",
            sourceFormat: "markdown",
            operationId: "pass-smr-request-2"
        })
        s.comment = f.operation("createReviewComment", {
            siteId: SITE,
            repositoryId: s.repo,
            mergeRequestNum: s.request.mergeRequestNum,
            commitId: s.head,
            path: "src/main.js",
            newLine: 2,
            body: "Why a `script` here?\n\n<script>alert(3)</script>\n",
            sourceFormat: "markdown",
            operationId: "pass-smr-comment-1"
        })
    },
    cleanup() {
        login("john.doe")
    }
})
feature("MergeRequests lists a repository's open merge requests with their counts; the shell has the tab with its count", {
    when() {
        const page = fixtures().render(SITE, HOST, R + "/-/merge-requests", "Smithy/RepositoryDetail/MergeRequests", {
            repositoryId: s.repo,
            namePath: "pass-smr/review"
        })
        return {page, html: page.html, cache: page.header("Cache-Control"), setup: s}
    },
    then({page, html, cache, setup}) {
        setup.agreement.effective === "required"
        setup.request.mergeRequestNum === 1
        setup.comment.threadId != null
        page.errors.length === 0
        cache === "no-store"
        html.includes('<a href="' + R + '/-/merge-requests" aria-current="page">Merge requests <small>2</small></a>')
        html.includes('id="SmithyMergeRequestStates"')
        html.includes("Open <small>2</small>")
        // the title is text
        html.includes('<a href="' + R + '/-/merge-requests/1">Greet &amp; thank everyone</a> <small>!1</small>')
        html.includes('<a href="' + R + '/-/tree/fix/greeting">fix/greeting</a> → main')
        html.includes("Agreement not signed")
        html.includes('<a href="' + R + '/-/merge-requests/new">New merge request</a>')
        !html.includes("<script")
    }
})
feature("a merge request's Overview shows the conversation cleaned, the agreement box with Sign, and the merge box of who may merge", {
    when() {
        const page = fixtures().render(SITE, HOST, R + "/-/merge-requests/1", "Smithy/MergeRequestDetail/Overview", {
            repositoryId: s.repo,
            namePath: "pass-smr/review",
            mergeRequestNum: "1"
        })
        return {page, html: page.html, cache: page.header("Cache-Control")}
    },
    then({page, html, cache}) {
        page.errors.length === 0
        cache === "no-store"
        html.includes("<h2>Greet &amp; thank everyone <small>!1</small></h2>")
        html.includes('id="SmithyMergeRequestState">Open</strong>')
        html.includes('<a href="' + R + '/-/merge-requests/1/changes">Changes</a>')
        // the text is the authority's rendered Markdown, cleaned: none of its script
        html.includes("<strong>all</strong>")
        !html.includes("alert(2)")
        // the agreement: not signed, who is missing what, and Sign opens the edit page of the file the authority names
        html.includes('id="SmithyAgreement"')
        html.includes("Not signed")
        html.includes('id="SmithyAgreementMissing"')
        html.includes('<a href="' + R + '/-/edit/fix/greeting/AUTHORS.md?sign=1" id="SmithySign">')
        html.includes('<a href="' + R + '/-/blob/main/AUTHORS.md#contributing">How to sign</a>')
        // the site's owner may merge: the methods, asked again on the next page, and why it is not ready
        html.includes('<form method="get" action="' + R + '/-/merge-requests/1" id="SmithyMerge">')
        html.includes('<option value="merge"')
        html.includes('<li class="wrap">The contributor agreement is not signed</li>')
        html.includes('href="' + R + '/-/merge-requests/1?confirm=close"')
        html.includes("git fetch origin refs/merge-requests/1/head")
        // a comment's form with a preview, and the review form with Approve only for who may (not the author)
        html.includes('id="Smithy_publishPost"')
        html.includes('id="SmithyReview"')
        !html.includes('value="approve"')
    }
})
feature("Changes shows the diff as escaped text with an anchor a line, a line's thread at its line, and a line's comment form", {
    when() {
        const page = fixtures().render(SITE, HOST, R + "/-/merge-requests/1/changes", "Smithy/MergeRequestDetail/Changes", {
            repositoryId: s.repo,
            namePath: "pass-smr/review",
            mergeRequestNum: "1",
            // the link of the first line's number
            line: "F1R1"
        })
        const html = page.html
        const review = ec.resource.script("component://mr-pass/screen/Smithy/SmithyReview.js")
        return {
            page,
            html,
            at: ['id="F1R2"', 'id="thread-' + s.comment.threadId + '"'].map(text => html.indexOf(text)),
            scripts: ["/js/WebrootCode.js", "/js/WebrootPublic.qvt.js"].map(src => html.indexOf('<script src="' + src + '">')),
            lines: review
                .diffLines("--- a/x\n+++ b/x\n@@ -3,2 +3,3 @@ fn\n same\n-old\n+new\n+--- more\n")
                .map(line => line.kind + (line.oldNo ?? "") + ":" + (line.newNo ?? ""))
                .join(" ")
        }
    },
    then({page, html, at, scripts, lines}) {
        page.errors.length === 0
        html.includes("1 file changed")
        // the pushed text is escaped, its changed words marked, each line with its number, its anchor and the link to its comment form
        html.includes('+console.log(<span class="x">&#39;&lt;script&gt;alert(1)&lt;/script&gt;&#39;, </span>a)</div>')
        html.includes('<div class="l a" id="F1R2"><a class="n" href="' + R + '/-/merge-requests/1/changes?line=F1R2#F1R2" data-line="F1R2"')
        html.includes('<div class="l d" id="F1L2">')
        // the thread is under its line, its Markdown rendered and cleaned, with a reply form and Resolve
        at[0] > 0
        at[1] > at[0]
        html.includes("<code>script</code>")
        !html.includes("alert(3)")
        html.includes('id="Smithy_createReviewComment_' + s.comment.threadId + '"')
        html.includes("Resolve thread")
        // the form of the line asked for
        html.includes('<input type="hidden" name="newLine" value="1">')
        html.includes("Comment on line 1 of src/main.js")
        // the island's scripts: the diff widget before the public shell mounts it
        html.includes('data-moqui-island="SmithyDiffReview"')
        scripts[0] > 0
        scripts[1] > scripts[0]
        // a hunk's lines are numbered on both sides, and a line of the text that begins like a header is text
        lines === "m: m: h: c3:3 d4: a:4 a:5"
    }
})
feature("Changes side by side (view=split): each side's number is its own anchor and comment link, the changed words marked, the text escaped", {
    when() {
        const page = fixtures().render(SITE, HOST, R + "/-/merge-requests/1/changes", "Smithy/MergeRequestDetail/Changes", {
            repositoryId: s.repo,
            namePath: "pass-smr/review",
            mergeRequestNum: "1",
            view: "split",
            line: "F1L2"
        })
        const diff = ec.resource.script("component://mr-pass/screen/Smithy/SmithyDiff.js")
        const lines = diff.marked(diff.diffLines("@@ -1,1 +1,1 @@\n-a <b>\n+a <i>\n@@ -9,1 +9,1 @@ fn x\n-q\n+r\n"))
        return {
            page,
            html: page.html,
            marks: lines.filter(line => line.html).map(line => line.html).join("|"),
            gap: diff.gapHtml(diff.gaps(lines).get(3), n => "/f#L" + n),
            hunk: diff.hunkHtml(lines[3].text),
            stat: diff.stat(30, 10).join(",")
        }
    },
    then({page, html, marks, gap, hunk, stat}) {
        page.errors.length === 0
        html.includes('<div class="smithy-split" data-file="1">')
        html.includes('<a class="n" id="F1L2" href="' + R + '/-/merge-requests/1/changes?view=split&amp;line=F1L2#F1L2" data-line="F1L2"')
        html.includes('<span class="t a">console.log(<span class="x">&#39;&lt;script&gt;alert(1)&lt;/script&gt;&#39;, </span>a)</span>')
        html.includes('<input type="hidden" name="oldLine" value="2">')
        html.includes('aria-current="true">Split</a>')
        !html.includes("<script>alert")
        // a word's change is marked inside the escaped text; the lines between two hunks link to the file
        marks === "a &lt;<span class=\"x\">b</span>&gt;|a &lt;<span class=\"x\">i</span>&gt;|q|r"
        gap === '<div class="l g"><a href="/f#L2">⋯ 7 unchanged lines (2–8)</a></div>'
        hunk === '@@ -9,1 +9,1 @@ <span class="fn">fn x</span>'
        stat === "4,1,0"
    }
})
feature("a long diff is in parts: each part has its own lines, a part that starts inside a hunk a continued header and no gap", {
    when() {
        const diff = ec.resource.script("component://mr-pass/screen/Smithy/SmithyDiff.js")
        const hunk = (start, count) => ({
            oldStart: start,
            oldLines: count,
            newStart: start,
            newLines: count,
            lines: Array.from({length: count}, (_, k) => ({tag: "equal", oldNo: start + k, newNo: start + k, text: "t" + (start + k)}))
        })
        const hunks = [hunk(1, 5), hunk(20, 5)]
        const text = "@@ -1,5 +1,5 @@\n t1\n t2\n t3\n t4\n t5\n@@ -20,5 +20,5 @@\n t20\n t21\n t22\n t23\n t24\n"
        return {
            first: diff.hunkPart(hunks, 0, 4),
            second: diff.hunkPart(hunks, 1, 4),
            past: diff.hunkPart(hunks, 9, 4),
            fromText: diff.linesPart(diff.diffLines(text), 1, 4),
            gaps: diff.gaps(diff.hunkPart(hunks, 1, 4).lines),
            // the same part as the host sends it (diffLineOffset 4, diffLineLimit 4 of 10 lines): only its lines, the
            // first hunk cut at its start
            sent: diff.hunkPart(
                [
                    {...hunk(1, 5), lines: hunk(1, 5).lines.slice(4), skippedLines: 4},
                    {...hunk(20, 5), lines: hunk(20, 5).lines.slice(0, 3)}
                ],
                1,
                4,
                {total: 10, offset: 4}
            ),
            review: ec.resource.script("component://mr-pass/screen/Smithy/SmithyReview.js")
        }
    },
    then({first, second, past, fromText, gaps, sent, review}) {
        first.parts === 3
        first.lines.map(line => line.kind).join("") === "hcccc"
        first.lines[0].text === "@@ -1,5 +1,5 @@"
        // part 2: line 5 of the first hunk (a continued header), then the second hunk's header and 3 lines
        second.lines.map(line => line.kind).join("") === "hchccc"
        second.lines[0].cont === true
        second.lines[0].text === "@@ … continued from line 5 @@"
        second.lines[3].newNo === 20
        // a part past the last is the last
        past.part === 2
        past.lines.map(line => line.newNo ?? "h").join(",") === "h,23,24"
        fromText.lines.map(line => (line.kind === "h" ? (line.cont ? "+" : "h") : line.newNo)).join(",") === "+,5,h,20,21,22"
        // the continued header has no gap; the second hunk's gap is 6–19
        gaps.size === 1
        gaps.get(2).from === 6
        gaps.get(2).to === 19
        // a page asks the host for its part's lines alone, and makes the same part of them
        review.partAsk(3).diffLineOffset === 2 * review.PART_LINES
        review.partAsk(3).diffLineLimit === review.PART_LINES
        sent.parts === 3
        sent.part === 1
        JSON.stringify(sent.lines) === JSON.stringify(second.lines)
    }
})
feature("the Edit page has the file's text, the blob it starts from and, for the agreement's file, how to sign; its save step asks where", {
    when() {
        const f = fixtures()
        const path = R + "/-/edit/main/AUTHORS.md"
        const page = f.render(SITE, HOST, path, "Smithy/RepositoryDetail/Edit", {
            repositoryId: s.repo,
            namePath: "pass-smr/review",
            refPath: "main/AUTHORS.md",
            editAction: "edit"
        })
        const blob = /name="baseBlobId" value="([0-9a-f]{40})"/.exec(page.html)?.[1]
        const step = (fields, keep) =>
            f.post(
                SITE,
                HOST,
                "editFile",
                {repositoryId: s.repo, branch: "main", action: "update", path: "AUTHORS.md", newPath: "AUTHORS.md", baseBlobId: blob, stage: "save", returnTo: path, ...fields},
                true,
                keep
            )
        // Continue: the text goes to the save step, kept for that one page (the page's own view, with no second render)
        const kept = step({content: AUTHORS + "- Written in 2026 by A <Name> - john\n"}, true)
        const save = editPage("main/AUTHORS.md", "edit")
        // what a step kept is another page's only: the page of another file starts from its own text
        step({content: "not this file's\n"}, true)
        const other = editPage("main/docs/Blank.md", "edit")
        // a text over the site's edit size is refused and not kept; a repository that is not there keeps nothing either
        const large = step({content: "x".repeat(1048577)}, true)
        ec.resource.script("component://mr-pass/screen/Smithy/Smithy.js").takeFlash()
        const unseen = step({repositoryId: "pass-smr-none"}, true)
        const forms = ec.resource.script("component://mr-pass/screen/Smithy/SmithyForms.js")
        return {
            page,
            html: page.html,
            blob,
            kept,
            save,
            other,
            large,
            unseen,
            area: forms.textarea(forms.formOf({flash: {}}, "x"), "body", "Text", {value: "\nfirst line blank"}).html
        }
    },
    then({page, html, blob, kept, save, other, large, unseen, area}) {
        page.errors.length === 0
        blob.length === 40
        html.includes('<form method="post" class="card" id="Smithy_editFile" action="/code/-/do/editFile">')
        html.includes('name="newPath" value="AUTHORS.md"')
        html.includes("## Copyright Waiver")
        // how to sign: the account's own line under both lists, with no legal name written for it
        html.includes('id="SmithySignHelp"')
        html.includes("by &lt;your legal name&gt; - ")
        html.includes("Continue to save")
        html.includes('data-moqui-island="SmithyEditor"')
        kept.status === 303
        kept.location === R + "/-/edit/main/AUTHORS.md"
        kept.flash.stage === "save"
        // the save step: the message, the text carried, and the destinations with the default first
        save.includes('id="Smithy_commitFile" action="/code/-/do/commitFile"')
        save.includes('name="message" value="Update AUTHORS.md"')
        save.includes("- Written in 2026 by A &lt;Name&gt; - john")
        save.includes('<input type="hidden" name="baseBlobId" value="' + blob + '">')
        save.includes('id="SmithyDestinations"')
        save.includes('name="destination" value="newBranch"')
        save.includes("Back to the text")
        // the other file's page is its editor, with its own text; a file's first newline survives the HTML parser, which
        // drops one right after the tag, here and in every text field
        !other.includes('id="Smithy_commitFile"')
        !other.includes("not this file")
        other.includes('class="smithy-editor">\n\nStarts after a blank line')
        area.includes(">\n\nfirst line blank</textarea>")
        large.status === 303
        large.flash.error.field === "content"
        large.flash.values.content == null
        unseen.errors.length === 1
        unseen.flash.form == null
    }
})
feature("a save through Smithy/Do goes to the branch, to a new branch with a merge request, or as a proposal; a stale one is a conflict", {
    when() {
        const f = fixtures()
        const guide = branch =>
            f.operation("getEditContext", {siteId: SITE, repositoryId: s.repo, refPath: branch + "/docs/Guide.md", editAction: "update"})
        const save = (branch, fields) =>
            f.post(
                SITE,
                HOST,
                "commitFile",
                {
                    repositoryId: s.repo,
                    branch,
                    action: "update",
                    path: "docs/Guide.md",
                    message: "Update docs/Guide.md",
                    operationId: id(),
                    returnTo: R + "/-/edit/" + branch + "/docs/Guide.md",
                    ...fields
                },
                true,
                true
            )
        const start = guide("fix/greeting")
        const onMain = guide("main")
        // the branch: an Owner on a branch with no rule
        const branch = save("fix/greeting", {content: "# Guide\n\nRead it twice.\n", baseBlobId: start.blobId, destination: "branch"})
        // the same base again: the file has changed since
        const stale = save("fix/greeting", {content: "# Guide\n\nMine.\n", baseBlobId: start.blobId, destination: "branch"})
        // the page then shows both texts and asks (its own view, with no screen rendered)
        const conflict = editPage("fix/greeting/docs/Guide.md", "edit")
        // a new file at a path that has one is told so on the save step, never as a conflict of texts
        const taken = save("fix/greeting", {action: "create", content: "Another\n", destination: "branch", returnTo: R + "/-/new/fix/greeting/docs"})
        const takenPage = editPage("fix/greeting/docs", "new")
        // a form posts its lines with CRLF: the file keeps the line endings it is given by the authority's rule (LF here)
        const lines = save("fix/greeting", {
            action: "create",
            path: "docs/lines.txt",
            content: "a\r\nb\r\n",
            destination: "branch",
            returnTo: R + "/-/new/fix/greeting/docs"
        })
        const written = f.operation("getEditContext", {siteId: SITE, repositoryId: s.repo, refPath: "fix/greeting/docs/lines.txt", editAction: "update"})
        // a new branch with a merge request, to main
        const fresh = save("main", {
            content: "# Guide\n\nRead it on a branch.\n",
            baseBlobId: onMain.blobId,
            destination: "newBranch",
            newBranchName: "john-patch-1",
            mergeRequestTitle: "Guide: a branch"
        })
        // a proposal, from an account that may view and not push
        const viewer = as(VIEWER, () => ({
            context: guide("main"),
            proposal: save("main", {content: "# Guide\n\nRead it, proposed.\n", baseBlobId: onMain.blobId, destination: "proposal"})
        }))
        // an upload: the file staged with the authority for this repository (as the Upload page's step does), then saved
        const text = "Uploaded <notes>\n"
        // (the authority's script is called as the facade's service calls it; a file's writer does not cross a service call)
        const staged = ec.resource.script("component://mr-mantle/service/mantle/forum/Forum.js").execute("stageAttachment", {
            siteId: SITE,
            purpose: "repositoryFile",
            repositoryId: s.repo,
            file: {
                name: "notes.txt",
                size: text.length,
                contentType: "text/plain",
                write(location) {
                    ec.resource.getLocationReference(location).putText(text)
                }
            }
        })
        const upload = f.post(
            SITE,
            HOST,
            "commitFile",
            {
                repositoryId: s.repo,
                branch: "fix/greeting",
                action: "upload",
                path: "docs/notes.txt",
                attachmentId: staged.attachment?.attachmentId,
                message: "Upload docs/notes.txt",
                destination: "branch",
                operationId: id(),
                returnTo: R + "/-/upload/fix/greeting/docs"
            },
            true,
            true
        )
        const uploaded = f.operation("getEditContext", {
            siteId: SITE,
            repositoryId: s.repo,
            refPath: "fix/greeting/docs/notes.txt",
            editAction: "update"
        })
        const proposed = /\/merge-requests\/([0-9]+)$/.exec(viewer.proposal.location || "")?.[1]
        return {
            start,
            branch,
            stale,
            fresh,
            viewer,
            staged,
            upload,
            uploaded,
            conflict,
            taken,
            takenPage,
            lines,
            written,
            after: guide("fix/greeting"),
            proposed: proposed
                ? f.operation("getMergeRequest", {siteId: SITE, repositoryId: s.repo, mergeRequestNum: Number(proposed)}).mergeRequest
                : null
        }
    },
    then({start, branch, stale, fresh, viewer, staged, upload, uploaded, conflict, taken, takenPage, lines, written, after, proposed}) {
        conflict.includes('id="SmithyConflict"')
        conflict.includes("Read it twice.")
        conflict.includes("Mine.")
        conflict.includes("Save my text over the file as it is now")
        taken.status === 303
        ["nameTaken", "fileChanged"].includes(taken.flash.error.reason)
        takenPage.includes("A file is at that path.")
        !takenPage.includes('id="SmithyConflict"')
        takenPage.includes('id="Smithy_commitFile"')
        lines.location === R + "/-/blob/fix/greeting/docs/lines.txt"
        written.text === "a\nb\n"
        staged.attachment.filename === "notes.txt"
        upload.status === 303
        upload.location === R + "/-/blob/fix/greeting/docs/notes.txt"
        uploaded.text === "Uploaded <notes>\n"
        start.editable === true
        start.destinationList.some(d => d.destination === "branch")
        branch.status === 303
        branch.location === R + "/-/blob/fix/greeting/docs/Guide.md"
        branch.flash.notice === "Committed to fix/greeting."
        after.text === "# Guide\n\nRead it twice.\n"
        // nothing was saved, and the form's page shows both texts: the refusal names its reason and keeps what was typed
        stale.status === 303
        stale.location === R + "/-/edit/fix/greeting/docs/Guide.md"
        stale.flash.error.reason === "fileChanged"
        stale.flash.values.content === "# Guide\n\nMine.\n"
        fresh.status === 303
        fresh.location.startsWith(R + "/-/merge-requests/")
        fresh.flash.notice.startsWith("Your change is in merge request !")
        // the viewer is offered the proposal alone, and its save opens a merge request with no fork
        viewer.context.destinationList.map(d => d.destination).join(",") === "proposal"
        viewer.proposal.status === 303
        proposed.pushedForReview === true
        proposed.targetRef === "main"
    }
})
feature("page rules: a merge and a close ask again, a check's target is a link only when it is https and a ci/ check's only to its run, and Sign's link encodes its branch", {
    when() {
        const f = fixtures()
        const {smithy, review} = scripts()
        const self = R + "/-/merge-requests/" + s.odd.mergeRequestNum
        const key = {repositoryId: s.repo, mergeRequestNum: s.request.mergeRequestNum, returnTo: R + "/-/merge-requests/1"}
        // without the answer of its confirmation page neither runs
        const merge = f.post(SITE, HOST, "mergeMergeRequest", {...key, mergeMethod: "merge"})
        const close = f.post(SITE, HOST, "setMergeRequestState", {...key, state: "closed"})
        const shell = smithy.repositoryShell(SITE, s.repo, "/code", self)
        const request = review.requestShell(shell, String(s.odd.mergeRequestNum), BASES, INFO, self)
        return {
            merge,
            close,
            state: f.operation("getMergeRequest", {siteId: SITE, repositoryId: s.repo, mergeRequestNum: 1}).mergeRequest.state,
            // a status is reported by whoever holds the right: its target is never a script's or a plain http address
            checks: review.checks(shell, {
                found: {
                    checkList: [
                        {context: "ci/a", state: "success", targetUrl: "javascript:alert(1)"},
                        {context: "ci/b", state: "success", targetUrl: "http://example.test/b"},
                        {context: "ci/c", state: "success", targetUrl: "https://example.test/c"},
                        {context: "deploy/d", state: "success", targetUrl: "https://example.test/d"}
                    ]
                }
            }).html,
            // the author's Sign goes to the source branch, whose name has a # and a %
            sign: /<a href="([^"]*)" id="SmithySign">/.exec(review.overview(shell, request, BASES, INFO, self, {}).html)?.[1]
        }
    },
    then({merge, close, state, checks, sign}) {
        merge.status === 303
        merge.flash.error.message === "Confirm this change on its own page first."
        close.flash.error.message === "Confirm this change on its own page first."
        state === "open"
        !checks.includes("javascript:")
        !checks.includes('href="http://')
        // a ci/ check links to its own run on this site or to nothing, never to the address its writer gave
        !checks.includes("https://example.test/c")
        checks.includes(" · ci/c</p>")
        checks.includes('<a href="https://example.test/d" rel="nofollow noopener">deploy/d</a>')
        sign === R + "/-/edit/fix%231%252/AUTHORS.md?sign=" + s.odd.mergeRequestNum
    }
})
feature("a running job's page: its log escaped, a failed test linked, an artifact, Approve for an Owner only; Run pipeline's refusal on its form", {
    when() {
        const f = fixtures()
        const {smithy, pipelines} = scripts()
        // a run that waits for approval, with a job that runs (its log in chunks) and one after it: rows as the engine writes
        // them, since a spec cannot play the runner
        const run = "PSMR_RUN41"
        const job = "PSMR_JOB41"
        const now = ec.user.nowTimestamp
        f.run("update#mantle.smithy.SmithyRepository", {repositoryId: s.repo, pipelinesEnabled: "Y"})
        const rows = [
            ["moqui.resource.GitPipelineRun", {pipelineRunId: run, repositoryId: s.repo, runNum: 41, pipelineName: "check", definitionSource: "file", event: "push", refName: "refs/heads/main", commitId: s.first, trusted: "N", approvalState: "waiting", statusId: "waiting", statusMessage: "Waiting for a Maintainer's approval: a first contribution's runs wait for one", createdDate: now}],
            ["moqui.resource.GitJobRun", {jobRunId: job, pipelineRunId: run, repositoryId: s.repo, jobName: "unit", attempt: 1, statusId: "running", image: "moqui-build", nextChunkSeq: 3, testCount: 3, testFailedCount: 1, startedDate: now}],
            ["moqui.resource.GitJobRun", {jobRunId: job + "B", pipelineRunId: run, repositoryId: s.repo, jobName: "report", attempt: 1, needs: "unit", statusId: "waiting"}],
            ["moqui.resource.GitJobStep", {jobRunId: job, stepSeq: 1, command: "./moq test <web>", statusId: "running"}],
            ["moqui.resource.GitRunLogChunk", {jobRunId: job, chunkSeq: 1, stepSeq: 1, byteOffset: 0, chunkText: "\u001b[31mFAIL\u001b[0m <script>alert(9)</script>\n"}],
            ["moqui.resource.GitRunLogChunk", {jobRunId: job, chunkSeq: 2, stepSeq: 1, byteOffset: 45, chunkText: "progress 10%\rprogress 100%\nok\n"}],
            ["moqui.resource.GitRunTestFailure", {jobRunId: job, testSeq: 1, suiteName: "Main", testName: "greets <all>", filePath: "./src/main.js", lineNumber: 2, message: "expected <b>", durationMillis: 1200}],
            ["moqui.resource.GitRunArtifact", {artifactId: "PSMR_ART41", jobRunId: job, pipelineRunId: run, repositoryId: s.repo, artifactKind: "artifact", name: "results", sizeBytes: 2048, sha256: "0123456789abcdef0123", createdDate: now}]
        ]
        for (const [entity, fields] of rows) f.run("create#" + entity, fields)
        const self = R + "/-/pipelines/41/jobs/" + job
        const page = f.render(SITE, HOST, self, "Smithy/PipelineDetail", {repositoryId: s.repo, namePath: "pass-smr/review", runNum: "41", jobRunId: job})
        // the run's page as a viewer with no role, through its page function: no Approve, and the jobs in stages
        const viewer = as(VIEWER, () =>
            pipelines.runPage(smithy.repositoryShell(SITE, s.repo, "/code", R + "/-/pipelines/41"), "41", "", BASES, INFO, R + "/-/pipelines/41").html
        )
        // Run pipeline through Do: the group has no runner minutes, so it is refused, and the form shows why
        f.run("update#mantle.smithy.SmithyGroup", {groupId: s.group, runnerMinutesMonthly: 0})
        const list = R + "/-/pipelines"
        const posted = f.post(SITE, HOST, "runPipeline", {repositoryId: s.repo, pipelineName: "check", refName: "main", operationId: id(), returnTo: list}, true, true)
        const shown = pipelines.pipelines(smithy.repositoryShell(SITE, s.repo, "/code", list), BASES, INFO, list).html
        return {page, html: page.html, viewer, posted, shown}
    },
    then({page, html, viewer, posted, shown}) {
        page.errors.length === 0
        page.header("Cache-Control") === "no-store"
        html.includes('<h2>check <small>#41</small></h2>')
        html.includes('id="SmithyRunWaiting"')
        // the log: each line numbered, escaped, its terminal escapes and a progress bar's earlier text taken out
        html.includes('<span id="L1"><a class="n" href="#L1">1</a>FAIL &lt;script&gt;alert(9)&lt;/script&gt;</span>')
        html.includes('<span id="L2"><a class="n" href="#L2">2</a>progress 100%</span>')
        !html.includes("alert(9)</script>")
        !html.includes("\u001b")
        !html.includes("progress 10%")
        // the failed test linked to its line at the run's commit; the artifact's download
        html.includes('<a href="' + R + "/-/blob/" + s.first + '/src/main.js#L2">./src/main.js:2</a>')
        html.includes("greets &lt;all&gt;")
        html.includes('<a href="' + R + '/-/artifacts/PSMR_ART41/results.tar.gz" rel="nofollow">results</a>')
        // the run's Owner approves it; the jobs as chips; the step's command escaped; the log's island while the job runs
        html.includes('id="Smithy_approvePipelineRun"')
        html.includes('id="SmithyJobChips"')
        html.includes("<code>./moq test &lt;web&gt;</code>")
        html.includes('data-moqui-island="SmithyJobLogIsland"')
        html.includes('aria-current="page">Pipelines</a>')
        !viewer.includes("approvePipelineRun")
        viewer.includes("A Maintainer of this repository approves it.")
        viewer.includes("<h4>Stage 2</h4>")
        !viewer.includes("Cancel run")
        posted.status === 303
        posted.location === "/code/pass-smr/review/-/pipelines"
        posted.flash.error.reason === "quotaExceeded"
        shown.includes('id="Smithy_runPipeline_error"')
        shown.includes("no runner minutes")
        shown.includes('<option value="check" selected>check</option>')
    }
})
feature("pipeline page rules: the log's JSON is no-store and Not Found with pipelines off, an upload too; Cancel asks again; a refused secret keeps no value; the runners form holds the group's own values; a test's path stays in the repository; control characters are taken out", {
    when() {
        const f = fixtures()
        const {smithy, pipelines} = scripts()
        const job = "PSMR_JOB41"
        const page = R + "/-/pipelines/41"
        // the log's JSON rendered once; its refusals through the page functions (they refuse before anything is written)
        const on = f.render(SITE, HOST, page + "/jobs/" + job + "/log", "Smithy/PipelineDetail/log", {repositoryId: s.repo, namePath: "pass-smr/review", runNum: "41", jobRunId: job})
        const refusal = work => {
            try {
                work()
                return "none"
            } catch (error) {
                ec.message.clearErrors()
                return error.moquiErrorKind || String(error.message)
            }
        }
        const log = jobRunId => refusal(() => pipelines.logJson(SITE, s.repo, "41", jobRunId))
        const other = log("PSMR_NONE")
        // Cancel without its confirmation page's answer is not run
        const cancel = f.post(SITE, HOST, "cancelPipelineRun", {repositoryId: s.repo, runNum: 41, returnTo: page})
        const state = f.operation("getPipelineRun", {siteId: SITE, repositoryId: s.repo, runNum: 41}).run?.state
        // a secret's value is not kept for the form's next page when its save is refused
        const secret = f.post(SITE, HOST, "storeCiSecret", {
            repositoryId: s.repo,
            name: "bad name!",
            value: "s3cret-value",
            scope: "nowhere",
            operationId: id(),
            returnTo: R + "/-/settings/pipelines"
        })
        // with pipelines off, the log's JSON and an upload are Not Found
        f.run("update#mantle.smithy.SmithyRepository", {repositoryId: s.repo, pipelinesEnabled: "N"})
        const off = log(job)
        const fileOff = refusal(() => pipelines.artifact(SITE, s.repo, "PSMR_ART41"))
        f.run("update#mantle.smithy.SmithyRepository", {repositoryId: s.repo, pipelinesEnabled: "Y"})
        // the group's runners form holds its own values, each sent only when changed, with the value in effect as its hint
        const groupPage = "/code/pass-smr/-/settings/pipelines"
        const runners = pipelines.groupSettings(smithy.groupShell(SITE, s.group, "/code", groupPage), "", BASES, INFO, groupPage).html
        let lines = null
        try {
            lines = JSON.parse(on.html).lines
        } catch (error) {
            lines = null
        }
        return {
            on,
            lines,
            other,
            cancel,
            state,
            secret,
            off,
            fileOff,
            runners,
            // a failed test's file: a relative path of the repository only
            paths: ["/abs/a.js", "C:/a.js", "a/../b.js", "a//b.js", "a\\b.js", "a\u0001b.js", "", "./src/main.js", "src/a.js"]
                .map(path => pipelines.testPath(path) || "-")
                .join(" "),
            // C0 but tab and newline, DEL, C1, the bidirectional overrides and isolates, and terminal escapes
            shown: smithy.plain("a\u0000b\u0085c\u009bd\u202ee\u2067f\u007fg\u001b[31mh\u001b[0m\ti\nj")
        }
    },
    then({on, lines, other, cancel, state, secret, off, fileOff, runners, paths, shown}) {
        on.header("Cache-Control") === "no-store"
        Array.isArray(lines) && lines.length >= 2
        other === "NotFound"
        cancel.flash.error.message === "Confirm this change on its own page first."
        state === "waiting"
        secret.status === 303
        !!secret.flash.error
        secret.flash.values.name === "bad name!"
        !Object.hasOwn(secret.flash.values, "value")
        off === "NotFound"
        fileOff === "NotFound"
        paths === "- - - - - - - src/main.js src/a.js"
        shown === "abcdefgh\ti\nj"
        runners.includes('<input type="hidden" name="was_runnerPoolId" value="">')
        runners.includes("In effect now:")
        runners.includes('<option value="" selected>As the group above says</option>')
    }
})
