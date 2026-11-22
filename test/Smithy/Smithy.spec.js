// Smithy (Dogfood DG1; plan/design-smithy.md §4.4, §7, §19.1): the route resolver's grammar (service/pass/SmithyRoutes.js, the
// smithy branch of pass.RouteServices.resolve#Route) with the name lookup stubbed, then through the resolver on a site with a
// group and a repository; one render each of Files, Blob and CommitDetail with its checks; and the operations PASS registers
// against Mantle's. DG2 (§4.4, §11): the paths of the pages that write, one render of a repository's Settings and one of
// Account's Git access, and a form's post through Smithy/Do: the redirect after a write, a refusal shown on its form, the
// confirmation an ending action needs, and the session token. Mantle's SmithyPaths, SmithyVisibility and SmithyRoles specs
// cover the rules behind the reads, and its DG2 specs those behind the writes. DG3 (§8): the issue paths, one render each of
// Issues, IssueDetail (the conversation's rendered Markdown, cleaned; the reactions and the forms by capability) and
// NewIssue, and an issue filed through Smithy/Do, its refusal and its preview. Mantle's SmithyIssues, SmithyIssueProjection
// and SmithyConfidential specs cover the rules behind them. DG4 (§9): the paths of the merge request, fork and edit pages and
// their cache policy; the pages themselves are SmithyReview's spec. DG6 (§4.4, §12.3 to §12.5; Dogfood §6): the paths of the
// forum inside a group's and a repository's shell, of the scope's moderation pages and of a held report's link; one render
// of the forum's topic list inside a group's shell (the scope's topics alone, links from the scoped base, the shell's tabs);
// a held report's page and its claim through Smithy/Do; Report and Hide through Smithy/Do; a topic made an issue. Mantle's
// SmithyForumScope, SmithyModerationTargets and SmithyHeldReports specs cover the rules behind them. DG5 (§4.4, §10): the
// paths of the pipeline pages (the runs, a run, a job, its log's JSON, an upload, the settings' Pipelines tab), their cache
// policy and Do's ten pipeline transitions; the pages themselves are SmithyReview's spec. DG10: the paths of the deployments
// and a deployment, and Do's three deployment transitions; the pages are SmithyDeploy's spec. DG7 (§4.4, §13): the paths of the
// site's pages (Search, Docs, Releases, a release and its file, a group's addons.xml, the site's Redirects tab), an old path
// of the site's table answered by the resolver with its redirect and its target checked again (another host, a port, a user
// part, a backslash, //, the preview host, a loop), one render of Search at the screen its request path resolves to
// (-/search, at a root mount too, whose first segment the framework does not take; what was asked and found escaped), one
// of a Docs page (its links made Docs, Blob and raw links) and one of ReleaseDetail (its files, a Maintainer's forms; the
// same page as an account with no role through its page function; Make it a draft refused without confirm=yes), and a group's
// addons.xml as text/xml (a visitor's kept by a cache for five minutes). Mantle's SmithyDocs,
// SmithyReleases, SmithyComponents, SmithySearch and SmithyRedirects specs cover the rules behind them.
const fixtures = () => ec.resource.script("component://mr-pass/test/Smithy/SmithyFixtures.js")
const routes = () => ec.resource.script("component://mr-pass/service/pass/SmithyRoutes.js")
const SITE = "PASS_SMITHY"
const HOST = "smithy.example.test"
const KEYS = "pass.smithy.keys"
const ROOT_SITE = "PASS_SMITHY_ROOT"
const ROOT_HOST = "smithy-root.example.test"
const PLAIN = "pass.smithy.plain"
const REPORTS = "pass.smithy.reports"
const SENDER = "pass.smithy.sender"
const state = {}
// what the authority would answer for a lowered name path
const NAMES = {
    moqui: {kind: "group", groupId: "G1", canonicalPath: "moqui"},
    "moqui/addons": {kind: "group", groupId: "G2", canonicalPath: "moqui/addons"},
    "moqui/mr-moqui": {kind: "repository", repositoryId: "R1", canonicalPath: "moqui/mr-moqui"},
    "moqui/addons/mantle-usl": {kind: "repository", repositoryId: "R2", canonicalPath: "moqui/addons/mantle-usl"},
    jane: {kind: "account", handle: "jane", canonicalPath: "jane"},
    "moqui/old-name": {kind: "redirect", redirectPath: "moqui/mr-moqui"},
    "moqui/mr-moqui/pull/7": {kind: "redirect", redirectPath: "moqui/mr-moqui/-/merge-requests/7"},
    "Moqui/mr-moqui/blob/main/Docs/README.md": {kind: "redirect", redirectPath: "moqui/mr-moqui/-/blob/main/Docs/README.md"},
    "moqui/mr-moqui/blob/main/LICENSE": {kind: "redirect", redirectPath: "moqui/mr-moqui/-/blob/main/LICENSE"},
    "moqui/mr-moqui/blob/main/x.git": {kind: "redirect", redirectPath: "moqui/mr-moqui/-/blob/main/x.git"}
}
const asked = []
function parse(path, base) {
    try {
        return routes().parse(path, base == null ? "/code" : base, name => {
            asked.push(name)
            // the authority lowers a name path itself; a form GitHub has is answered as it was typed
            return NAMES[name] || (/\/(?:blob|pull)\//.test(name) ? null : NAMES[name.toLowerCase()]) || null
        })
    } catch (error) {
        return {kind: error.moquiErrorKind || "Error"}
    }
}
spec({
    requires: ["git"],
    setupSpec() {
        login("john.doe")
        const f = fixtures()
        f.site(SITE, HOST)
        state.group = f.group(SITE, "pass-smg", "public")
        // a public account with a confirmed address, for its own git access
        f.account(SITE, KEYS, {confirmed: true})
        const made = f.repository(SITE, state.group, "web", "public", {
            "README.md": "# Web sample\n\nThe *web* repository.\n\n<script>alert(1)</script>\n",
            "docs/Guide.md":
                "# Guide\n\n[Up](../README.md) [Out](../../../etc/passwd) [Site](https://example.test/a) ![Logo](img/logo.png)\n",
            'docs/n\u00e9"w.txt': "plain <b>text</b>\n",
            // DG7: the docs directory's index, with a link to a page of it, one to a file outside it, and a script
            "docs/README.md": "# Web docs\n\nSee [the guide](Guide.md#start) and [the code](../src/main.js).\n\n<script>alert(5)</script>\n\n## Install\n",
            "src/main.js": "const a = 1\nif (a < 2) console.log('<script>alert(1)</script>')\n"
        })
        state.repo = made.repositoryId
        state.first = made.commitId
        // a branch whose name has a slash, with a second commit on main after it
        f.run("org.moqui.git.GitServices.create#GitRef", {repositoryId: state.repo, refName: "feature/login", refType: "branch"})
        state.second = f.commit(state.repo, "Greet everyone & all\n\nA longer note.", {
            "src/main.js": "const a = 1\nconsole.log('hello')\n"
        })
        // DG3: issues on, a label, an issue of the site's owner written in Markdown, and an account with no confirmed address
        f.issuesOn(SITE, state.repo)
        state.label = f.run("mantle.smithy.SmithyIssueServices.store#Label", {
            input: {
                siteId: SITE,
                repositoryId: state.repo,
                name: "bug",
                color: "red",
                description: "Something is wrong",
                operationId: "pass-smg-label-1"
            }
        }).result.labelId
        state.issue = f.issue(SITE, state.repo, {
            title: "Tree page breaks <b>",
            body: "It **breaks** on `main`.\n\n<script>alert(1)</script>\n",
            labelIds: [state.label]
        })
        // the second commit is linked to the issue, as a push that names it would link it
        f.run("mantle.work.GitServices.add#TaskCommit", {
            workEffortId: f.operation("getIssue", {siteId: SITE, repositoryId: state.repo, issueNumber: state.issue.issueNumber}).issue
                .workItemKey,
            repositoryId: state.repo,
            commitId: state.second
        })
        f.account(SITE, PLAIN)
        // DG6: the group's forum on, with a topic in its category; a second group with a topic of its own
        state.category = f.forumOn(SITE, {groupId: state.group})
        state.topic = f.topic(SITE, state.category, "Scoped <hello>", "Inside the *group*.")
        state.other = f.group(SITE, "pass-smo", "public")
        f.topic(SITE, f.forumOn(SITE, {groupId: state.other}), "Elsewhere", "Another group's topic.")
        // an account with a confirmed address whose first posts are past, which reports a repository
        f.account(SITE, REPORTS, {confirmed: true, settled: true})
        // and one whose confirmed address sent a report by mail before it had the account
        f.account(SITE, SENDER, {confirmed: true, settled: true})
        // DG7: docs on; a published release of the tag v1.0 with a container image's name and a file (a row: no file is
        // read here); an old path of the site's table
        f.turnOn(SITE, state.repo, {docsEnabled: true})
        f.run("org.moqui.git.GitServices.create#GitRef", {repositoryId: state.repo, refName: "v1.0", refType: "tag"})
        const release = f.operation("storeRelease", {
            siteId: SITE,
            repositoryId: state.repo,
            tag: "v1.0",
            name: "First & best",
            notes: "The **first** one.\n\n<script>alert(6)</script>\n",
            sourceFormat: "markdown",
            published: true,
            operationId: "pass-smg-release-1"
        })
        if (!release.tag) throw new Error("No release: " + release.message)
        f.operation("addReleaseAsset", {
            siteId: SITE,
            repositoryId: state.repo,
            tag: "v1.0",
            imageName: "registry.example.test/web:1.0",
            operationId: "pass-smg-asset-1"
        })
        const image = ec.entity.find("mantle.smithy.SmithyReleaseAsset").condition({repositoryId: state.repo}).disableAuthz().one()
        f.run("create#mantle.smithy.SmithyReleaseAsset", {
            assetId: "PASS_SMG_A1",
            siteId: SITE,
            repositoryId: state.repo,
            workEffortId: image.workEffortId,
            tagName: "v1.0",
            name: "web-1.0.zip",
            assetKindEnumId: "SakFile",
            contentLocation: "dbresource://pass-smg/web-1.0.zip",
            sizeBytes: 2048,
            sha256: "ab".repeat(32),
            createdAt: Date.now()
        })
        f.operation("storeRedirect", {siteId: SITE, oldPath: "/m/docs/web", targetPath: "/code/pass-smg/web/-/docs", operationId: "pass-smg-redirect-1"})
        // rows of the table its writer would refuse (an old import, a host since gone), which the resolver checks again; the
        // site's theme preview host
        f.run("create#mantle.public.PublicSiteHost", {hostname: "preview." + HOST, siteId: SITE, hostKindEnumId: "PshkPreview"})
        const moves = {
            own: "https://" + HOST + "/code/pass-smg/web",
            other: "https://other.example.test/x",
            port: "https://" + HOST + ":8443/x",
            at: "https://" + HOST + "@evil.example.test/x",
            backslash: "/\\evil.example.test/x",
            doubled: "//evil.example.test/x",
            preview: "https://preview." + HOST + "/x",
            loop: "/M/Loop/?a=1",
            loopHost: "https://" + HOST + "/M/loop2/"
        }
        for (const [name, targetPath] of Object.entries(moves))
            f.run("create#mantle.smithy.SmithyRedirect", {
                redirectId: "PASS_SMG_MOVE_" + name,
                siteId: SITE,
                oldPath: name === "loop" ? "/m/loop" : name === "loopHost" ? "/m/loop2" : "/m/move/" + name,
                targetPath,
                sourceEnumId: "SrsManual"
            })
    }
})
feature("the grammar: names, then a section after /-/, with the authority telling a group, a repository and an account apart", {
    when() {
        asked.length = 0
        const out = {
            home: parse(""),
            explore: parse("explore"),
            group: parse("moqui"),
            subgroup: parse("moqui/addons"),
            repository: parse("moqui/mr-moqui"),
            nested: parse("moqui/addons/mantle-usl/-/tags"),
            account: parse("jane"),
            accountSection: parse("jane/-/members"),
            members: parse("moqui/-/members"),
            groupRepositories: parse("moqui/addons/-/repositories"),
            // a ref with a slash is not split here: the authority's read splits refPath
            tree: parse("moqui/mr-moqui/-/tree/feature/login/src/Main%20File.rs"),
            blob: parse("moqui/mr-moqui/-/blob/main/README.md"),
            blobBare: parse("moqui/mr-moqui/-/blob"),
            raw: parse("moqui/mr-moqui/-/raw/v1.0/a.qvue"),
            commits: parse("moqui/mr-moqui/-/commits"),
            commit: parse("moqui/mr-moqui/-/commit/0123ABCdef"),
            commitBad: parse("moqui/mr-moqui/-/commit/main"),
            compare: parse("moqui/mr-moqui/-/compare/main...feature/login"),
            compareFork: parse("moqui/mr-moqui/-/compare/main...jane/mr-moqui:fix"),
            compareHead: parse("moqui/mr-moqui/-/compare/topic"),
            branches: parse("moqui/mr-moqui/-/branches"),
            // a later phase's section is in the grammar, and not routed until its screen is built
            pipeline: parse("moqui/mr-moqui/-/pipelines/7"),
            // DG5: the runs, a job, its log's JSON, an upload, and the settings' Pipelines tab
            pipelines: parse("moqui/mr-moqui/-/pipelines"),
            pipelineJob: parse("moqui/mr-moqui/-/pipelines/7/jobs/J_1"),
            pipelineLog: parse("moqui/mr-moqui/-/pipelines/7/jobs/J_1/log"),
            pipelineJobBad: parse("moqui/mr-moqui/-/pipelines/7/steps/J_1"),
            pipelineLogBad: parse("moqui/mr-moqui/-/pipelines/7/jobs/J_1/raw"),
            artifact: parse("moqui/mr-moqui/-/artifacts/A_1/results.tar.gz"),
            pipelinesTab: parse("moqui/-/settings/pipelines"),
            // DG10: the deployments and a deployment
            deployments: parse("moqui/mr-moqui/-/pipelines/deployments"),
            deployment: parse("moqui/mr-moqui/-/pipelines/deployments/D_1"),
            deploymentBad: parse("moqui/mr-moqui/-/pipelines/deployments/D_1/steps"),
            // DG4: merge requests, a fork's head with a slash in its ref, the fork pages, a file's edit and the islands
            mergeRequests: parse("moqui/mr-moqui/-/merge-requests"),
            mergeRequestNew: parse("moqui/mr-moqui/-/merge-requests/new"),
            mergeRequest: parse("moqui/mr-moqui/-/merge-requests/7"),
            mergeRequestChanges: parse("moqui/mr-moqui/-/merge-requests/7/changes"),
            mergeRequestBad: parse("moqui/mr-moqui/-/merge-requests/7/files"),
            compareForkSlash: parse("moqui/mr-moqui/-/compare/release/1.x...jane/mr-moqui:fix/tree-page"),
            fork: parse("moqui/mr-moqui/-/fork"),
            forks: parse("moqui/mr-moqui/-/forks"),
            edit: parse("moqui/mr-moqui/-/edit/feature/login/docs/Guide.md"),
            newFile: parse("moqui/mr-moqui/-/new/main/docs"),
            upload: parse("moqui/mr-moqui/-/upload/main"),
            remove: parse("moqui/mr-moqui/-/delete/main/AUTHORS.md"),
            editBare: parse("moqui/mr-moqui/-/edit"),
            diffIsland: parse("-/island/DiffReview.qvue"),
            agreementTab: parse("moqui/mr-moqui/-/settings/agreement"),
            // DG3: the issue pages of a repository and of a group, and the composer's island
            issues: parse("moqui/mr-moqui/-/issues"),
            issueNew: parse("moqui/mr-moqui/-/issues/new"),
            issue: parse("moqui/mr-moqui/-/issues/12"),
            issueZero: parse("moqui/mr-moqui/-/issues/012"),
            issueDeeper: parse("moqui/mr-moqui/-/issues/12/edit"),
            labels: parse("moqui/mr-moqui/-/labels"),
            milestone: parse("moqui/mr-moqui/-/milestones/M_1"),
            groupIssues: parse("moqui/-/issues"),
            island: parse("-/island/Composer.qvue"),
            islandBad: parse("-/island/composer.html"),
            // redirects: the stored case, a .git suffix, a renamed path (the section kept), a compatibility form
            mixedCase: parse("Moqui/MR-Moqui/-/tree/Main"),
            dotGit: parse("moqui/mr-moqui.git", ""),
            renamed: parse("moqui/old-name/-/commits/main"),
            compatibility: parse("moqui/mr-moqui/pull/7"),
            // a form GitHub has, with a file's path: only the name prefix is checked, the rest keeps its case
            githubBlob: parse("Moqui/mr-moqui/blob/main/Docs/README.md"),
            // one whose rest is all valid names keeps its case too, and a file x.git keeps its name
            githubUpper: parse("moqui/mr-moqui/blob/main/LICENSE"),
            githubGit: parse("moqui/mr-moqui/blob/main/x.git"),
            // an empty segment redirects to the one address of the page, never to another host's
            doubled: parse("//moqui//mr-moqui/-/tree/main/", ""),
            dotFile: parse("moqui/mr-moqui/-/blob/main/.gitignore"),
            archive: parse("moqui/mr-moqui/-/archive/v1.0.tar.gz"),
            // Not Found
            dotDot: parse("moqui/mr-moqui/-/tree/main/../secret"),
            encodedSlash: parse("moqui/mr-moqui/-/tree/main%2Fx"),
            unknownSection: parse("moqui/mr-moqui/-/nothing"),
            emptySection: parse("moqui/mr-moqui/-"),
            groupTree: parse("moqui/-/tree/main"),
            unknownName: parse("moqui/tree"),
            badName: parse("-moqui"),
            sixNames: parse("a1/b1/c1/d1/e1/f1"),
            reserved: parse("explore/moqui"),
            newThing: parse("new/thing"),
            // DG2: the create pages, the site's settings, a form's transition, and the settings of a group and a repository
            newGroup: parse("new/group"),
            newRepository: parse("new/repository"),
            site: parse("-/site"),
            siteTab: parse("-/site/requests"),
            siteBad: parse("-/site/nothing"),
            form: parse("-/do/createRepository"),
            formBad: parse("-/do/Create-repository"),
            groupSettings: parse("moqui/-/settings/delete"),
            repositorySettings: parse("moqui/mr-moqui/-/settings/branch-rules"),
            repositorySettingsBad: parse("moqui/mr-moqui/-/settings/nothing"),
            // DG6: the forum inside a group's and a repository's shell, mapped as the forum's own paths are; the scope's
            // moderation pages; a held report's link
            forum: parse("moqui/-/forum"),
            forumTopic: parse("moqui/-/forum/t/T_100/hello-world"),
            forumTopicState: parse("moqui/mr-moqui/-/forum/t/T_100/hello-world.qvue/state"),
            forumTopicBad: parse("moqui/-/forum/t/bad%20id/x"),
            forumPost: parse("moqui/-/forum/p/P_9"),
            forumCategory: parse("moqui/-/forum/Categories/CategoryDetail"),
            forumCompose: parse("moqui/mr-moqui/-/forum/Compose.qvue"),
            forumPublish: parse("moqui/-/forum/Compose/publish"),
            forumFeed: parse("moqui/-/forum/feed"),
            // a held list message's link of a list in the scope, and its claim
            forumHeld: parse("moqui/mr-moqui/-/forum/held-mail/abcDEF_123-456"),
            forumHeldClaim: parse("moqui/-/forum/held-mail/abcDEF_123-456/claim"),
            forumHeldBad: parse("moqui/-/forum/held-mail/abcDEF_123-456/post"),
            // the forum's pages that have no scope stay the site's own
            forumSettings: parse("moqui/-/forum/Settings/Mail"),
            forumMessages: parse("moqui/-/forum/Messages"),
            forumModeration: parse("moqui/-/forum/Moderation/ReviewQueue"),
            moderation: parse("moqui/-/moderation"),
            moderationSave: parse("moqui/mr-moqui/-/moderation/ReviewDetail/save"),
            moderationReport: parse("moqui/mr-moqui/-/moderation/report"),
            moderationHide: parse("moqui/-/moderation/hide"),
            moderationBad: parse("moqui/-/moderation/Settings"),
            forumTab: parse("moqui/-/settings/forum"),
            heldReport: parse("-/held-report/abcDEF_123-456"),
            heldReportBad: parse("-/held-report/a/b"),
            // DG7: the site's pages
            // Search is under -/: the framework's /search proxy takes /search on every host (the user's call)
            search: parse("-/search"),
            searchDeeper: parse("-/search/x"),
            // the old path is a name now (a reserved word, so no group has it)
            oldSearch: parse("search"),
            docs: parse("moqui/mr-moqui/-/docs"),
            docsPage: parse("moqui/mr-moqui/-/docs/v1.0/guide/intro.md"),
            releases: parse("moqui/mr-moqui/-/releases"),
            release: parse("moqui/mr-moqui/-/releases/release/1.0"),
            releaseAsset: parse("moqui/mr-moqui/-/release-assets/A_1/web-1.0.zip"),
            releaseAssetBad: parse("moqui/mr-moqui/-/release-assets/A_1"),
            addons: parse("moqui/addons/-/addons.xml"),
            addonsDeeper: parse("moqui/-/addons.xml/x"),
            siteRedirects: parse("-/site/redirects")
        }
        return {out, asked: asked.slice(), built: routes().BUILT}
    },
    then({out, asked, built}) {
        out.home.screenPath === "/Smithy/Home"
        out.explore.screenPath === "/Smithy/Explore"
        out.group.screenPath === "/Smithy/GroupDetail/Overview"
        out.group.screenParameters.groupId === "G1"
        out.subgroup.screenPath === "/Smithy/GroupDetail/Overview"
        out.subgroup.screenParameters.namePath === "moqui/addons"
        out.repository.screenPath === "/Smithy/RepositoryDetail/Files"
        out.repository.screenParameters.repositoryId === "R1"
        out.repository.screenParameters.refPath === ""
        out.nested.screenPath === "/Smithy/RepositoryDetail/Tags"
        out.nested.screenParameters.repositoryId === "R2"
        out.account.screenPath === "/Smithy/AccountDetail"
        out.account.screenParameters.handle === "jane"
        out.accountSection.kind === "NotFound"
        out.members.screenPath === "/Smithy/GroupDetail/Members"
        out.groupRepositories.screenParameters.groupId === "G2"
        out.tree.screenPath === "/Smithy/RepositoryDetail/Files"
        out.tree.screenParameters.refPath === "feature/login/src/Main File.rs"
        out.blob.screenPath === "/Smithy/RepositoryDetail/Blob"
        out.blob.screenParameters.refPath === "main/README.md"
        out.blobBare.kind === "NotFound"
        // a file whose name ends like a render mode is a parameter, never part of the screen path
        out.raw.screenPath === "/Smithy/RepositoryDetail/raw"
        out.raw.screenParameters.refPath === "v1.0/a.qvue"
        out.commits.screenPath === "/Smithy/RepositoryDetail/Commits"
        out.commit.screenPath === "/Smithy/CommitDetail"
        out.commit.screenParameters.commitId === "0123abcdef"
        out.commitBad.kind === "NotFound"
        out.compare.screenPath === "/Smithy/Compare"
        out.compare.screenParameters.base === "main"
        out.compare.screenParameters.head === "feature/login"
        out.compareFork.screenParameters.headRepositoryPath === "jane/mr-moqui"
        out.compareFork.screenParameters.head === "fix"
        out.compareHead.screenParameters.base === ""
        out.compareHead.screenParameters.head === "topic"
        out.branches.screenPath === "/Smithy/RepositoryDetail/Branches"
        out.pipeline.screenPath === "/Smithy/PipelineDetail"
        out.pipeline.screenParameters.runNum === "7"
        built.includes("/Smithy/PipelineDetail")
        out.pipelines.screenPath === "/Smithy/RepositoryDetail/Pipelines"
        built.includes(out.pipelines.screenPath)
        out.pipelineJob.screenParameters.jobRunId === "J_1"
        out.pipelineLog.screenPath === "/Smithy/PipelineDetail/log"
        out.pipelineLog.screenParameters.jobRunId === "J_1"
        built.includes(out.pipelineLog.screenPath)
        out.pipelineJobBad.kind === "NotFound"
        out.pipelineLogBad.kind === "NotFound"
        out.artifact.screenPath === "/Smithy/PipelineDetail/artifact"
        out.artifact.screenParameters.artifactId === "A_1"
        built.includes(out.artifact.screenPath)
        out.pipelinesTab.screenParameters.tab === "pipelines"
        out.deployments.screenPath === "/Smithy/RepositoryDetail/Deployments"
        built.includes(out.deployments.screenPath)
        out.deployment.screenPath === "/Smithy/DeploymentDetail"
        out.deployment.screenParameters.deploymentId === "D_1"
        built.includes(out.deployment.screenPath)
        out.deploymentBad.kind === "NotFound"
        out.mergeRequests.screenPath === "/Smithy/RepositoryDetail/MergeRequests"
        out.mergeRequestNew.screenPath === "/Smithy/NewMergeRequest"
        out.mergeRequest.screenPath === "/Smithy/MergeRequestDetail/Overview"
        out.mergeRequest.screenParameters.mergeRequestNum === "7"
        out.mergeRequestChanges.screenPath === "/Smithy/MergeRequestDetail/Changes"
        built.includes(out.mergeRequestChanges.screenPath)
        out.mergeRequestBad.kind === "NotFound"
        // the base and the fork's ref keep their slashes; the fork's path is before the colon
        out.compareForkSlash.screenParameters.base === "release/1.x"
        out.compareForkSlash.screenParameters.headRepositoryPath === "jane/mr-moqui"
        out.compareForkSlash.screenParameters.head === "fix/tree-page"
        out.fork.screenPath === "/Smithy/RepositoryDetail/Fork"
        out.forks.screenPath === "/Smithy/RepositoryDetail/Fork"
        out.edit.screenPath === "/Smithy/RepositoryDetail/Edit"
        out.edit.screenParameters.editAction === "edit"
        out.edit.screenParameters.refPath === "feature/login/docs/Guide.md"
        out.newFile.screenParameters.editAction === "new"
        out.upload.screenParameters.editAction === "upload"
        out.remove.screenParameters.editAction === "delete"
        built.includes(out.remove.screenPath)
        out.editBare.kind === "NotFound"
        built.includes(out.diffIsland.screenPath)
        out.agreementTab.screenParameters.tab === "agreement"
        out.issues.screenPath === "/Smithy/RepositoryDetail/Issues"
        out.issueNew.screenPath === "/Smithy/NewIssue"
        out.issue.screenPath === "/Smithy/IssueDetail"
        out.issue.screenParameters.issueNumber === "12"
        out.issue.screenParameters.repositoryId === "R1"
        built.includes("/Smithy/IssueDetail")
        out.issueZero.kind === "NotFound"
        out.issueDeeper.kind === "NotFound"
        out.labels.screenPath === "/Smithy/RepositoryDetail/Labels"
        out.milestone.screenPath === "/Smithy/RepositoryDetail/Milestones"
        out.milestone.screenParameters.milestoneId === "M_1"
        out.groupIssues.screenPath === "/Smithy/GroupDetail/Issues"
        out.groupIssues.screenParameters.groupId === "G1"
        out.island.screenPath === "/Smithy/Islands/Composer.qvue"
        built.includes(out.island.screenPath)
        out.islandBad.kind === "NotFound"
        out.mixedCase.screenPath === "/Smithy/redirect"
        out.mixedCase.screenParameters.location === "/code/moqui/mr-moqui/-/tree/Main"
        out.dotGit.screenParameters.location === "/moqui/mr-moqui"
        out.renamed.screenParameters.location === "/code/moqui/mr-moqui/-/commits/main"
        out.compatibility.screenParameters.location === "/code/moqui/mr-moqui/-/merge-requests/7"
        out.githubBlob.screenParameters.location === "/code/moqui/mr-moqui/-/blob/main/Docs/README.md"
        out.githubUpper.screenParameters.location === "/code/moqui/mr-moqui/-/blob/main/LICENSE"
        out.githubGit.screenParameters.location === "/code/moqui/mr-moqui/-/blob/main/x.git"
        out.doubled.screenPath === "/Smithy/redirect"
        out.doubled.screenParameters.location === "/moqui/mr-moqui/-/tree/main"
        out.dotFile.screenParameters.refPath === "main/.gitignore"
        // raw and archive are transitions of RepositoryDetail
        out.archive.screenPath === "/Smithy/RepositoryDetail/archive"
        out.archive.screenParameters.ref === "v1.0"
        out.archive.screenParameters.format === "tar.gz"
        out.dotDot.kind === "NotFound"
        out.encodedSlash.kind === "NotFound"
        out.unknownSection.kind === "NotFound"
        out.emptySection.kind === "NotFound"
        // /-/ always starts a section, so a group's section word is never taken for a name, and a name never for a section
        out.groupTree.kind === "NotFound"
        out.unknownName.kind === "NotFound"
        asked.includes("moqui/tree")
        out.badName.kind === "NotFound"
        out.sixNames.kind === "NotFound"
        // a reserved first segment is a fixed form and never asked of the authority as a name
        out.reserved.kind === "NotFound"
        out.newThing.kind === "NotFound"
        !asked.some(name => /^(?:explore|new|-moqui)/.test(name))
        out.newGroup.screenPath === "/Smithy/New/Group"
        out.newRepository.screenPath === "/Smithy/New/Repository"
        out.site.screenPath === "/Smithy/Site"
        out.site.screenParameters.tab == null
        out.siteTab.screenParameters.tab === "requests"
        out.siteBad.kind === "NotFound"
        out.form.screenPath === "/Smithy/Do/createRepository"
        out.formBad.kind === "NotFound"
        out.groupSettings.screenPath === "/Smithy/GroupDetail/Settings"
        out.groupSettings.screenParameters.groupId === "G1"
        out.groupSettings.screenParameters.tab === "delete"
        out.repositorySettings.screenPath === "/Smithy/RepositoryDetail/Settings"
        out.repositorySettings.screenParameters.repositoryId === "R1"
        out.repositorySettings.screenParameters.tab === "branch-rules"
        out.repositorySettingsBad.kind === "NotFound"
        out.forum.screenPath === "/Smithy/GroupDetail/Forum"
        out.forum.screenParameters.groupId === "G1"
        out.forumTopic.screenPath === "/Smithy/GroupDetail/Forum/Topics/TopicDetail"
        out.forumTopic.topicId === "T_100"
        out.forumTopic.topicSlug === "hello-world"
        out.forumTopic.screenParameters.forumPath === "t/T_100/hello-world"
        // a render mode on the slug and a transition after it, as on the forum's own topic
        out.forumTopicState.screenPath === "/Smithy/RepositoryDetail/Forum/Topics/TopicDetail.qvue/state"
        out.forumTopicState.topicSlug === "hello-world"
        out.forumTopicState.screenParameters.repositoryId === "R1"
        out.forumTopicBad.kind === "NotFound"
        out.forumPost.screenPath === "/Smithy/GroupDetail/Forum/Post"
        out.forumPost.postId === "P_9"
        out.forumCategory.screenPath === "/Smithy/GroupDetail/Forum/Categories/CategoryDetail"
        out.forumCompose.screenPath === "/Smithy/RepositoryDetail/Forum/Compose.qvue"
        out.forumPublish.screenPath === "/Smithy/GroupDetail/Forum/Compose/publish"
        out.forumFeed.screenPath === "/Smithy/GroupDetail/Forum/feed"
        out.forumHeld.screenPath === "/Smithy/RepositoryDetail/Forum/HeldMail"
        out.forumHeld.screenParameters.token === "abcDEF_123-456"
        out.forumHeldClaim.screenPath === "/Smithy/GroupDetail/Forum/HeldMail/claim"
        out.forumHeldBad.kind === "NotFound"
        out.forumSettings.kind === "NotFound"
        out.forumMessages.kind === "NotFound"
        out.forumModeration.kind === "NotFound"
        out.moderation.screenPath === "/Smithy/Moderation"
        out.moderation.screenParameters.groupId === "G1"
        out.moderationSave.screenPath === "/Smithy/Moderation/ReviewDetail/save"
        out.moderationSave.screenParameters.repositoryId === "R1"
        out.moderationReport.screenPath === "/Smithy/Moderation/Report"
        out.moderationHide.screenPath === "/Smithy/Moderation/Hide"
        out.moderationBad.kind === "NotFound"
        out.forumTab.screenParameters.tab === "forum"
        out.heldReport.screenPath === "/Smithy/Do/heldReport"
        out.heldReport.screenParameters.token === "abcDEF_123-456"
        out.heldReportBad.kind === "NotFound"
        out.search.screenPath === "/Smithy/Search"
        built.includes(out.search.screenPath)
        out.searchDeeper.kind === "NotFound"
        out.oldSearch.kind === "NotFound"
        asked.includes("search")
        out.docs.screenPath === "/Smithy/RepositoryDetail/Docs"
        out.docs.screenParameters.refPath === ""
        out.docsPage.screenParameters.refPath === "v1.0/guide/intro.md"
        built.includes(out.docs.screenPath)
        out.releases.screenPath === "/Smithy/RepositoryDetail/Releases"
        built.includes(out.releases.screenPath)
        // a tag keeps its slashes
        out.release.screenPath === "/Smithy/ReleaseDetail"
        out.release.screenParameters.tag === "release/1.0"
        built.includes(out.release.screenPath)
        out.releaseAsset.screenPath === "/Smithy/ReleaseDetail/asset"
        out.releaseAsset.screenParameters.assetId === "A_1"
        built.includes(out.releaseAsset.screenPath)
        out.releaseAssetBad.kind === "NotFound"
        out.addons.screenPath === "/Smithy/GroupDetail/addons"
        out.addons.screenParameters.groupId === "G2"
        built.includes(out.addons.screenPath)
        out.addonsDeeper.kind === "NotFound"
        out.siteRedirects.screenParameters.tab === "redirects"
    }
})
feature("the resolver routes a Smithy mount by segment, so compare's ... passes and .. does not, here or in another app", {
    when() {
        const f = fixtures()
        return {
            repository: f.route(SITE, HOST, "/code/pass-smg/web"),
            tree: f.route(SITE, HOST, "/code/pass-smg/web/-/tree/feature/login/docs"),
            compare: f.route(SITE, HOST, "/code/pass-smg/web/-/compare/main...feature/login"),
            group: f.route(SITE, HOST, "/code/pass-smg/-/members"),
            stored: f.route(SITE, HOST, "/code/Pass-SMG/web.git"),
            slashes: f.route(SITE, HOST, "/code//pass-smg/web/"),
            // DG8: a group's Import tab and an import's page are routed
            later: f.route(SITE, HOST, "/code/pass-smg/-/settings/import"),
            importRun: f.route(SITE, HOST, "/code/import/SMI_1"),
            // DG7: an old path of the site's table, which no mount takes, is answered with its redirect
            moved: f.route(SITE, HOST, "/m/docs/web/"),
            gone: f.route(SITE, HOST, "/m/docs/other"),
            // DG5's pages are routed (the page answers Not Found where pipelines are off)
            pipelines: f.route(SITE, HOST, "/code/pass-smg/web/-/pipelines"),
            pipelinesTab: f.route(SITE, HOST, "/code/pass-smg/web/-/settings/pipelines"),
            // DG4's pages are routed
            mergeRequests: f.route(SITE, HOST, "/code/pass-smg/web/-/merge-requests"),
            agreement: f.route(SITE, HOST, "/code/pass-smg/web/-/settings/agreement"),
            issue: f.route(SITE, HOST, "/code/pass-smg/web/-/issues/3"),
            dotDot: f.route(SITE, HOST, "/code/pass-smg/web/-/tree/main/../x"),
            unknown: f.route(SITE, HOST, "/code/pass-smg/nothing"),
            account: f.route(SITE, HOST, "/account/../code/explore"),
            // DG2's pages are routed; a settings tab of a later phase is not
            created: f.route(SITE, HOST, "/code/new/repository"),
            form: f.route(SITE, HOST, "/code/-/do/createRepository"),
            site: f.route(SITE, HOST, "/code/-/site/quotas"),
            siteLater: f.route(SITE, HOST, "/code/-/site/redirects"),
            groupSettings: f.route(SITE, HOST, "/code/pass-smg/-/settings"),
            webhooks: f.route(SITE, HOST, "/code/pass-smg/web/-/settings/webhooks"),
            mirrors: f.route(SITE, HOST, "/code/pass-smg/web/-/settings/mirrors")
        }
    },
    then({
        moved,
        gone,
        repository,
        tree,
        compare,
        group,
        stored,
        slashes,
        later,
        pipelines,
        pipelinesTab,
        mergeRequests,
        agreement,
        issue,
        dotDot,
        unknown,
        account,
        created,
        form,
        site,
        siteLater,
        groupSettings,
        webhooks,
        mirrors,
        importRun
    }) {
        created.screenPath === "/Smithy/New/Repository"
        form.screenPath === "/Smithy/Do/createRepository"
        site.screenParameters.tab === "quotas"
        siteLater.screenParameters.tab === "redirects"
        groupSettings.screenPath === "/Smithy/GroupDetail/Settings"
        groupSettings.screenParameters.groupId === state.group
        webhooks.screenPath === "/Smithy/RepositoryDetail/Settings"
        webhooks.screenParameters.tab === "webhooks"
        mirrors.screenParameters.tab === "mirrors"
        importRun.screenPath === "/Smithy/Import"
        importRun.screenParameters.importId === "SMI_1"
        repository.screenPath === "/Smithy/RepositoryDetail/Files"
        repository.screenParameters.repositoryId === state.repo
        repository.screenParameters.namePath === "pass-smg/web"
        tree.screenParameters.refPath === "feature/login/docs"
        compare.screenPath === "/Smithy/Compare"
        compare.screenParameters.head === "feature/login"
        group.screenPath === "/Smithy/GroupDetail/Members"
        group.screenParameters.groupId === state.group
        stored.screenPath === "/Smithy/redirect"
        stored.screenParameters.location === "/code/pass-smg/web"
        slashes.screenPath === "/Smithy/redirect"
        slashes.screenParameters.location === "/code/pass-smg/web"
        later.screenParameters.tab === "import"
        moved.screenPath === "/Smithy/redirect"
        moved.screenParameters.location === "/code/pass-smg/web/-/docs"
        gone.kind === "NotFound"
        pipelines.screenPath === "/Smithy/RepositoryDetail/Pipelines"
        pipelinesTab.screenParameters.tab === "pipelines"
        mergeRequests.screenPath === "/Smithy/RepositoryDetail/MergeRequests"
        agreement.screenParameters.tab === "agreement"
        // DG3's pages are routed (the page answers Not Found for a number the repository does not have)
        issue.screenPath === "/Smithy/IssueDetail"
        issue.screenParameters.issueNumber === "3"
        dotDot.kind === "NotFound"
        unknown.kind === "NotFound"
        account.kind === "NotFound"
    }
})
feature("Files shows the tree at a branch with a slash, links by the ref's name, the rendered README and the clone box", {
    when() {
        const page = fixtures().render(SITE, HOST, "/code/pass-smg/web/-/tree/feature/login", "Smithy/RepositoryDetail/Files", {
            repositoryId: state.repo,
            namePath: "pass-smg/web",
            refPath: "feature/login"
        })
        return {page, html: page.html}
    },
    then({page, html}) {
        page.errors.length === 0
        // the shell: breadcrumb, clone addresses, tabs
        html.includes('<a href="/code/pass-smg">pass-smg</a>')
        html.includes('id="SmithyClone"')
        html.includes("/git/pass-smg/web.git")
        html.includes('<a href="/code/pass-smg/web" aria-current="page">Files</a>')
        html.includes('<a href="/code/pass-smg/web/-/commits">Commits</a>')
        // the header is Smithy's
        html.includes('<a href="/code/explore">Explore</a>')
        // the tree, by the branch's name
        html.includes('<option value="feature/login" selected>feature/login</option>')
        html.includes('<a href="/code/pass-smg/web/-/tree/feature/login/docs">docs/</a>')
        // the clone box has the page URL only where Smithy is the site's root app; here it mounts at /code
        !html.includes("Page URL")
        html.includes('<a href="/code/pass-smg/web/-/blob/feature/login/README.md">README.md</a>')
        html.includes('href="/code/pass-smg/web/-/commit/' + state.first + '"')
        html.includes("First commit")
        html.includes('href="/code/pass-smg/web/-/commits/feature/login"')
        // the README is rendered by the authority and cleaned: its markup, and none of its script (below)
        html.includes('id="SmithyReadme"')
        html.includes("<em>web</em>")
        html.includes("Web sample</h1>")
        // readable with no JavaScript: the page loads no script
        !html.includes("<script")
    }
})
feature("Blob shows rendered Markdown with its relative links and images made the repository's own pages", {
    when() {
        const page = fixtures().render(
            SITE,
            HOST,
            "/code/pass-smg/web/-/blob/main/docs/Guide.md",
            "Smithy/RepositoryDetail/Blob",
            {
                repositoryId: state.repo,
                namePath: "pass-smg/web",
                refPath: "main/docs/Guide.md"
            }
        )
        const smithy = ec.resource.script("component://mr-pass/screen/Smithy/Smithy.js")
        const links = (page.html.match(/<(?:a|img)\b[^>]*>(?=Up<|Out<|Site<)|<img\b[^>]*alt="Logo"[^>]*>/g) || [])
            .map(tag => /(?:href|src)="([^"]*)"/.exec(tag)?.[1])
            .join(" ")
        return {page, links, html: page.html, code: smithy.codeHtml("const a = 1\nif (a < 2) b('<i>')\n")}
    },
    then({page, links, html, code}) {
        page.errors.length === 0
        html.includes('id="SmithyRendered"')
        // a relative link is the file's page at the shown ref, resolved against the file's directory; one that would leave
        // the repository's tree has no address; an absolute one is left alone; an image is its raw file
        links ===
            "/code/pass-smg/web/-/blob/main/README.md # https://example.test/a /code/pass-smg/web/-/raw/main/docs/img/logo.png"
        // its own links are built from what was read, not from the request's path
        html.includes('<a href="/code/pass-smg/web/-/blob/main/docs/Guide.md?plain=1">Source</a>')
        html.includes('<a href="/code/pass-smg/web/-/raw/main/docs/Guide.md">Raw</a>')
        html.includes('<a href="/code/pass-smg/web/-/blame/main/docs/Guide.md">Blame</a>')
        html.includes('<a href="/code/pass-smg/web/-/commits/main/docs/Guide.md">History</a>')
        html.includes('href="/code/pass-smg/web/-/blob/' + state.second + '/docs/Guide.md">Permalink</a>')
        html.includes('<a href="/code/pass-smg/web/-/tree/main/docs">docs</a>')
        !html.includes("<script")
        // a file's text is escaped, with a number and an anchor for each line
        code ===
            '<span id="L1"><a class="n" href="#L1">1</a>const a = 1</span>\n<span id="L2"><a class="n" href="#L2">2</a>if (a &lt; 2) b(&#39;&lt;i&gt;&#39;)</span>'
    }
})
feature("raw serves a file as plain text or a download, never as a page: its type, nosniff, a sandbox and a safe name", {
    when() {
        const f = fixtures()
        const call = (requestHeaders, user) => {
            if (!user) logout()
            try {
                return f.render(
                    SITE,
                    HOST,
                    "/code/pass-smg/web/-/raw/main/docs/n%C3%A9%22w.txt",
                    "Smithy/RepositoryDetail/raw",
                    {repositoryId: state.repo, namePath: "pass-smg/web", refPath: 'main/docs/n\u00e9"w.txt'},
                    requestHeaders
                )
            } finally {
                login("john.doe")
            }
        }
        const raw = call(null, false)
        const session = call({Cookie: "moqui.session=abc"}, false)
        return {
            raw,
            type: raw.header("Content-Type"),
            sniff: raw.header("X-Content-Type-Options"),
            csp: raw.header("Content-Security-Policy"),
            disposition: raw.header("Content-Disposition"),
            cache: raw.header("Cache-Control"),
            vary: raw.header("Vary"),
            sessionCache: session.header("Cache-Control"),
            download: ec.resource.script("component://mr-pass/screen/Smithy/Smithy.js").disposition(false, 'a\r\nb\u00e9".svg')
        }
    },
    then({raw, type, sniff, csp, disposition, cache, vary, sessionCache, download}) {
        raw.errors.length === 0
        raw.html === "plain <b>text</b>\n"
        type.startsWith("text/plain")
        sniff === "nosniff"
        csp === "default-src 'none'; sandbox"
        disposition === "inline; filename=\"n__w.txt\"; filename*=UTF-8''n%C3%A9%22w.txt"
        download === "attachment; filename=\"ab__.svg\"; filename*=UTF-8''ab%C3%A9%22.svg"
        // public for a minute only for a request with no session cookie and no signed-in user
        cache === "public, max-age=60"
        // and that answer is for a request with no cookie: after a sign-in the browser asks again
        vary === "Cookie, Accept-Language"
        sessionCache === "no-store"
    }
})
feature("the redirect answers 301 to a path on this site, is never cached, and refuses another host's; an old path's target is checked again", {
    when() {
        const f = fixtures()
        const to = location => f.render(SITE, HOST, "/code/Pass-SMG/web", "Smithy/redirect", {location})
        const smithy = ec.resource.script("component://mr-pass/screen/Smithy/Smithy.js")
        const good = to("/code/pass-smg/web/-/tree/main")
        const bad = to("//evil.example/x")
        return {
            status: good.status,
            location: good.header("Location"),
            cache: good.header("Cache-Control"),
            bad,
            badLocation: bad.header("Location"),
            guard: ["/a/b?x=1", "//host/a", "/\\host/a", "/a\u0001b", "https://host/a", "a/b", ""]
                .map(l => smithy.siteLocal(l))
                .join(" "),
            // a target of the table: only a path of this site or an https address of one of its own hosts (not its preview
            // host, another host, a port it does not have, a user part, a backslash or //), and never the path asked for
            moves: ["own", "other", "port", "at", "backslash", "doubled", "preview"].map(name => smithy.movedPath(SITE, HOST, "/m/move/" + name) || "-").join(" "),
            loops: [smithy.movedPath(SITE, HOST, "/m/loop"), smithy.movedPath(SITE, HOST, "/m/loop2"), smithy.movedPath(SITE, "other." + HOST, "/m/loop2")]
                .map(target => target || "-")
                .join(" "),
            // the request's query goes before the target's fragment
            query: [smithy.withQuery("/a#top", "x=1"), smithy.withQuery("/a?b=2#top", "x=1"), smithy.withQuery("/a", "")].join(" ")
        }
    },
    then({status, location, cache, bad, badLocation, guard, moves, loops, query}) {
        status === 301
        location === "/code/pass-smg/web/-/tree/main"
        cache === "no-store"
        // a refusal is the framework's Not Found, with no Location
        bad.errors.length === 1
        bad.errors[0].includes("Page not found")
        badLocation == null
        guard === "true false false false false false false"
        moves === "https://" + HOST + "/code/pass-smg/web - - - - - -"
        loops === "- - https://" + HOST + "/M/loop2/"
        query === "/a?x=1#top /a?b=2&x=1#top /a"
    }
})
feature("CommitDetail shows the message, the parent, the changed file and its diff as escaped unified text", {
    when() {
        const page = fixtures().render(SITE, HOST, "/code/pass-smg/web/-/commit/" + state.second, "Smithy/CommitDetail", {
            repositoryId: state.repo,
            namePath: "pass-smg/web",
            commitId: state.second
        })
        return {page, html: page.html}
    },
    then({page, html}) {
        page.errors.length === 0
        html.includes("<h2>Greet everyone &amp; all</h2>")
        html.includes("A longer note.")
        html.includes("<code>" + state.second + "</code>")
        html.includes('href="/code/pass-smg/web/-/commit/' + state.first + '"')
        html.includes('<a href="/code/pass-smg/web/-/commits" aria-current="page">Commits</a>')
        html.includes("1 file changed")
        html.includes('<a href="#file-1" title="src/main.js"><span class="st st-modified" aria-hidden="true"></span>src/main.js</a>')
        // the issue the commit is linked to, by its number and title (one the caller may not see is only counted)
        html.includes('<a href="/code/pass-smg/web/-/issues/1">#1</a> Tree page breaks &lt;b&gt;</p>')
        // both line numbers, the changed words marked, the text escaped
        html.includes('<div class="l a"><span class="n"></span><span class="n">2</span>+console.log(&#39;<span class="x">hello</span>&#39;)</div>')
        html.includes('<div class="l d"><span class="n">2</span><span class="n"></span>-<span class="x">if (a &lt; 2) </span>console.log(&#39;<span class="x">&lt;script&gt;alert(1)&lt;/script&gt;</span>&#39;)</div>')
        html.includes('<a class="smithy-viewfile" href="/code/pass-smg/web/-/blob/' + state.second + '/src/main.js">View file</a>')
        !html.includes("<script")
    }
})
feature(
    "a repository's Settings shows a Maintainer's tabs and the General form, which posts to Smithy/Do with the session token",
    {
        when() {
            const page = fixtures().render(SITE, HOST, "/code/pass-smg/web/-/settings", "Smithy/RepositoryDetail/Settings", {
                repositoryId: state.repo,
                namePath: "pass-smg/web"
            })
            return {page, html: page.html, token: ec.web.sessionToken, cache: page.header("Cache-Control")}
        },
        then({page, html, token, cache}) {
            page.errors.length === 0
            // the shell's tab, and the settings' own: the site's operator is an Owner, so Archive is there
            html.includes('<a href="/code/pass-smg/web/-/settings" aria-current="page">Settings</a>')
            html.includes('<a href="/code/pass-smg/web/-/settings" aria-current="page">General</a>')
            html.includes('<a href="/code/pass-smg/web/-/settings/branch-rules">Branch rules</a>')
            html.includes('<a href="/code/pass-smg/web/-/settings/archive">Archive</a>')
            // a plain form: its transition, the session token, where a refusal returns, the revision it edits
            html.includes('<form method="post" class="card" id="Smithy_updateRepository" action="/code/-/do/updateRepository">')
            token.length > 0
            html.includes('<input type="hidden" name="moquiSessionToken" value="' + token + '">')
            html.includes('<input type="hidden" name="returnTo" value="/code/pass-smg/web/-/settings">')
            html.includes('name="expectedRevision"')
            html.includes('<option value="main" selected>main</option>')
            html.includes('<option value="feature/login">feature/login</option>')
            html.includes('name="mergeRequestsEnabled" value="true" checked')
            // the header's signed-in links, and Sign out as a form
            html.includes('<a href="/code/new/repository">New repository</a>')
            html.includes('<a href="/account/GitAccess">Git access</a>')
            html.includes('id="SmithySignOut"')
            !html.includes("<script")
            cache === "no-store"
        }
    }
)
feature("Git access: a public account makes a token through its form, sees it once on the next page, and it is in no address", {
    when() {
        const f = fixtures()
        const smithy = ec.resource.script("component://mr-pass/screen/Smithy/Smithy.js")
        login(KEYS, "moqui1!!")
        try {
            // the form's post: createAccessToken through Smithy/Do, the password given again; the flash stays for the page
            const made = f.post(
                SITE,
                HOST,
                "createAccessToken",
                {name: "spec ci", password: "moqui1!!", operationId: "pass-smg-token-1"},
                true,
                true
            )
            const token = made.flash.token?.token || ""
            const page = f.render(SITE, HOST, "/account/GitAccess", "Account/GitAccess", {})
            return {made, token, page, html: page.html, cache: page.header("Cache-Control"), after: smithy.takeFlash()}
        } finally {
            login("john.doe")
        }
    },
    then({made, token, page, html, cache, after}) {
        made.errors.length === 0
        made.status === 303
        made.location === "/account/GitAccess"
        made.cache === "no-store"
        token.length >= 20
        page.errors.length === 0
        html.includes('id="SmithyNewToken"')
        html.includes(">" + token + "</code>")
        html.split(token).length === 2
        // the page took it: the next page has none
        after.token == null
        cache === "no-store"
        // the token is listed by its name, with Revoke asked again on its own page
        html.includes('<h3 class="wrap">spec ci</h3>')
        html.includes('href="/account/GitAccess?confirm=token&amp;id=')
        // the forms post to Smithy/Do, and the password is asked again
        html.includes('action="/code/-/do/addSshKey"')
        html.includes('action="/code/-/do/createAccessToken"')
        html.includes('name="publicKey"')
        html.includes('<input type="password" name="password" autocomplete="current-password">')
        !html.includes("<script")
    }
})
feature("Blame shows each run of lines with the commit that last changed it, as escaped text", {
    when() {
        const page = fixtures().render(
            SITE,
            HOST,
            "/code/pass-smg/web/-/blame/main/src/main.js",
            "Smithy/RepositoryDetail/Blame",
            {
                repositoryId: state.repo,
                namePath: "pass-smg/web",
                refPath: "main/src/main.js"
            }
        )
        return {page, html: page.html, route: fixtures().route(SITE, HOST, "/code/pass-smg/web/-/blame/main/src/main.js")}
    },
    then({page, html, route}) {
        route.screenPath === "/Smithy/RepositoryDetail/Blame"
        route.screenParameters.refPath === "main/src/main.js"
        page.errors.length === 0
        html.includes('id="SmithyBlame"')
        // the first line is the first commit's, the second the commit that changed it; each is linked once, where its run starts
        html.includes('<tr id="L1" class="s"><td><a href="/code/pass-smg/web/-/commit/' + state.first + '" title="First commit">')
        html.includes(
            '<tr id="L2" class="s"><td><a href="/code/pass-smg/web/-/commit/' +
                state.second +
                '" title="Greet everyone &amp; all">'
        )
        html.includes("<pre>console.log(&#39;hello&#39;)</pre>")
        html.includes('<a href="/code/pass-smg/web/-/blob/main/src/main.js">File</a>')
        !html.includes("<script")
    }
})
feature("archive serves a ref's tree as an attachment, never cached, to a signed-in account and to a visitor of a public repository", {
    when() {
        const f = fixtures()
        const get = () =>
            f.render(SITE, HOST, "/code/pass-smg/web/-/archive/feature/login.zip", "Smithy/RepositoryDetail/archive", {
                repositoryId: state.repo,
                namePath: "pass-smg/web",
                ref: "feature/login",
                format: "zip"
            })
        const signedIn = get()
        logout()
        let visitor
        try {
            visitor = get()
        } finally {
            login("john.doe")
        }
        return {
            signedIn,
            route: f.route(SITE, HOST, "/code/pass-smg/web/-/archive/feature/login.zip"),
            disposition: signedIn.header("Content-Disposition"),
            cache: signedIn.header("Cache-Control"),
            sniff: signedIn.header("X-Content-Type-Options"),
            visitor,
            visitorLocation: visitor.header("Location"),
            visitorCache: visitor.header("Cache-Control")
        }
    },
    then({signedIn, route, disposition, cache, sniff, visitor, visitorLocation, visitorCache}) {
        route.screenPath === "/Smithy/RepositoryDetail/archive"
        route.screenParameters.ref === "feature/login"
        route.screenParameters.format === "zip"
        signedIn.errors.length === 0
        signedIn.html.startsWith("PK")
        disposition === "attachment; filename=\"web-feature-login.zip\"; filename*=UTF-8''web-feature-login.zip"
        cache === "no-store"
        sniff === "nosniff"
        // a public repository's archive is anyone's (addons.xml's archive locations for ./moq component-get)
        visitor.html.startsWith("PK")
        visitorLocation == null
        visitorCache === "no-store"
    }
})
feature("a release's file is answered as an inert type with a sandbox: a script's name gives no script of the site (SEC-PSF-08)", {
    when() {
        const f = fixtures()
        const image = ec.entity.find("mantle.smithy.SmithyReleaseAsset").condition({assetId: "PASS_SMG_A1"}).disableAuthz().one()
        f.run("create#mantle.smithy.SmithyReleaseAsset", {
            assetId: "PASS_SMG_A2",
            siteId: SITE,
            repositoryId: state.repo,
            workEffortId: image.workEffortId,
            tagName: "v1.0",
            name: "x.js",
            assetKindEnumId: "SakFile",
            contentLocation: "dbresource://pass-smg/x.js",
            sizeBytes: 9,
            sha256: "cd".repeat(32),
            createdAt: Date.now()
        })
        const was = ec.artifactExecution.disableAuthz()
        try {
            ec.resource.getLocationReference("dbresource://pass-smg/x.js").putText("alert(8);")
        } finally {
            if (!was) ec.artifactExecution.enableAuthz()
        }
        const file = f.render(SITE, HOST, "/code/pass-smg/web/-/release-assets/PASS_SMG_A2/x.js", "Smithy/ReleaseDetail/asset", {
            repositoryId: state.repo,
            assetId: "PASS_SMG_A2"
        })
        const facade = ec.resource.script("component://mr-pass/service/pass/Facade.js")
        const authority = ec.resource.script("component://mr-mantle/script/PassAuthority.js")
        const types = ["application/javascript", "text/javascript; charset=utf-8", "text/css", "text/html", "image/svg+xml", "image/png",
            "text/plain; charset=utf-8", "application/pdf", "font/woff2", "application/zip"]
        return {
            file,
            type: file.header("Content-Type"),
            csp: file.header("Content-Security-Policy"),
            local: types.map(type => facade.servedType(type)),
            remote: types.map(type => authority.servedType(type)),
            // a PDF shown inline is not sandboxed, so it displays (the framework's rule); anything else is
            sandbox: [
                ["application/pdf", "inline"],
                ["application/pdf", 'attachment; filename="q.pdf"'],
                ["image/png", "inline"],
                ["application/octet-stream", 'attachment; filename="x.js"']
            ].map(([kind, disposition]) => facade.sandboxed(kind, disposition))
        }
    },
    then({file, type, csp, local, remote, sandbox}) {
        sandbox == [false, true, true, true]
        file.errors.length === 0
        file.html === "alert(8);"
        type.startsWith("application/octet-stream")
        csp === "default-src 'none'; sandbox"
        local ==
            ["application/octet-stream", "application/octet-stream", "application/octet-stream", "application/octet-stream", "image/svg+xml",
                "image/png", "text/plain; charset=utf-8", "application/pdf", "font/woff2", "application/zip"]
        // the remote transports answer the same types (Mantle's PassAuthority.js keeps the list)
        remote == local
    }
})
feature("a form's post answers 303: to its page after a write, back to the form with the refusal; an ending action asks again", {
    when() {
        const f = fixtures()
        const smithy = ec.resource.script("component://mr-pass/screen/Smithy/Smithy.js")
        const forms = ec.resource.script("component://mr-pass/screen/Smithy/SmithyForms.js")
        const branches = "/code/pass-smg/web/-/branches"
        const create = (name, operationId, keep) =>
            f.post(
                SITE,
                HOST,
                "createRef",
                {repositoryId: state.repo, refType: "branch", name, fromRevision: "main", operationId, returnTo: branches},
                true,
                keep
            )
        const made = create("topic", "pass-smg-ref-1")
        // the same name again is refused; the flash is kept, as the form's page would find it
        const again = create("topic", "pass-smg-ref-2", true)
        const shell = smithy.repositoryShell(SITE, state.repo, "/code", branches)
        const view = smithy.refs(shell, "branch")
        const shown = forms.refForms(shell, "branch", view, {smithy: "/code", account: "/account"}, {authenticated: true})
        // an ending action without its confirmation page's answer is not run, and a return address off the mount is not used
        const unasked = f.post(SITE, HOST, "deleteRef", {
            repositoryId: state.repo,
            refType: "branch",
            name: "topic",
            returnTo: "//evil.example/x"
        })
        // a test render does not make the framework's request checks, so the session token's is read from the screen: every
        // transition of Do is a post, and none opts out of the token (SmithyWalk posts without one)
        const screen = String(ec.resource.getLocationText("component://mr-pass/screen/Smithy/Do.xml") || "")
        return {
            made,
            again,
            shown: shown.createHtml,
            names: view.rows.map(row => row.name),
            deleteHref: view.rows.find(row => row.name === "topic")?.deleteHref,
            unasked,
            transitions: (screen.match(/<transition /g) || []).length,
            posts: (screen.match(/<transition name="[A-Za-z]+" method="post">/g) || []).length,
            forms: Object.keys(forms.DO).filter(name => screen.includes('<transition name="' + name + '" method="post">')).length,
            optOut: screen.includes("require-session-token")
        }
    },
    then({made, again, shown, names, deleteHref, unasked, transitions, posts, forms, optOut}) {
        made.status === 303
        made.location === "/code/pass-smg/web/-/branches"
        made.cache === "no-store"
        made.flash.notice === "Created topic."
        again.status === 303
        again.location === "/code/pass-smg/web/-/branches"
        again.flash.form === "createRef"
        again.flash.error.message.length > 0
        // the refusal is on the form, with what was typed
        shown.includes('<p role="alert" class="error" id="Smithy_createRef_error">')
        shown.includes('name="name" value="topic"')
        names.includes("topic")
        deleteHref === "/code/pass-smg/web/-/branches?delete=topic"
        unasked.status === 303
        unasked.location === "/code/"
        unasked.flash.error.message === "Confirm this change on its own page first."
        // DG6's heldReport alone is a GET: the page of a held report's link, which writes nothing
        transitions === 98
        posts === 97
        forms === 97
        optOut === false
    }
})
feature("Issues lists a repository's open issues with their counts, labels and filters; the shell has the tab with its count", {
    when() {
        const page = fixtures().render(SITE, HOST, "/code/pass-smg/web/-/issues", "Smithy/RepositoryDetail/Issues", {
            repositoryId: state.repo,
            namePath: "pass-smg/web"
        })
        return {page, html: page.html, cache: page.header("Cache-Control"), n: state.issue.issueNumber}
    },
    then({page, html, cache, n}) {
        page.errors.length === 0
        // the shell's tab has the open count the authority answers for this caller
        html.includes('<a href="/code/pass-smg/web/-/issues" aria-current="page">Issues <small>1</small></a>')
        html.includes('<a href="/code/pass-smg/web/-/issues" aria-current="page">Open <small>1</small></a>')
        html.includes('<a href="/code/pass-smg/web/-/issues?state=closed">Closed <small>0</small></a>')
        html.includes('<a href="/code/pass-smg/web/-/issues/' + n + '">Tree page breaks &lt;b&gt;</a> <small>#' + n + "</small>")
        html.includes('style="border-color:#f44336">bug</small>')
        // the filters are a GET form; "Confidential only" is the Owner's (the site's operator is one)
        html.includes('<form method="get" action="/code/pass-smg/web/-/issues" class="card" role="search" id="SmithyIssueFind">')
        html.includes('<option value="' + state.label + '">bug</option>')
        html.includes('name="confidential" value="only"')
        html.includes('<a href="/code/pass-smg/web/-/issues/new">New issue</a>')
        html.includes('<a href="/code/pass-smg/web/-/labels">Labels</a>')
        !html.includes("<script")
        cache === "no-store"
    }
})
feature("IssueDetail shows the conversation's Markdown rendered and cleaned, and the forms a confirmed viewer may use", {
    when() {
        const f = fixtures()
        const path = "/code/pass-smg/web/-/issues/" + state.issue.issueNumber
        login(KEYS, "moqui1!!")
        try {
            const page = f.render(SITE, HOST, path, "Smithy/IssueDetail", {
                repositoryId: state.repo,
                namePath: "pass-smg/web",
                issueNumber: String(state.issue.issueNumber)
            })
            return {page, html: page.html, cache: page.header("Cache-Control"), n: state.issue.issueNumber}
        } finally {
            login("john.doe")
        }
    },
    then({page, html, cache, n}) {
        page.errors.length === 0
        html.includes("<h2>Tree page breaks &lt;b&gt; <small>#" + n + "</small></h2>")
        html.includes('id="SmithyIssueState">Open</strong>')
        !html.includes('id="SmithyIssueConfidential"')
        // the first post: Markdown rendered by the authority and cleaned, so its script is gone
        html.includes("<strong>breaks</strong>")
        html.includes("<code>main</code>")
        !html.includes("alert(1)")
        // a confirmed viewer reacts and comments; the forms post to Smithy/Do with the session token
        html.includes('action="/code/-/do/setReaction"')
        html.includes('<button aria-pressed="false">like 0</button>')
        html.includes('id="Smithy_publishPost" action="/code/-/do/publishPost"')
        html.includes('<input type="hidden" name="rootCommEventId" value="' + state.issue.rootCommEventId + '">')
        html.includes('<input type="hidden" name="sourceFormat" value="markdown">')
        html.includes('<textarea name="body" rows="8" maxlength="100000" required>')
        html.includes('formaction="/code/-/do/previewPost"')
        // where JavaScript runs, the composer's island takes the textarea's place
        html.includes('<script type="application/json" data-moqui-island="SmithyComposer">')
        html.includes('"basePath":"/code/-/island/Composer"')
        // the label is shown; triage, the state and who reads it are not a viewer's
        html.includes('id="SmithyIssueLabels"')
        html.includes(">bug</small>")
        !html.includes("Smithy_setIssueLabels")
        !html.includes("Smithy_setIssueState")
        !html.includes("SmithyIssueAudience")
        !html.includes("Smithy_updateIssue")
        cache === "no-store"
    }
})
feature("NewIssue has the title, a Markdown text with a preview, and the Confidential mark with who will read it", {
    when() {
        const f = fixtures()
        login(KEYS, "moqui1!!")
        try {
            const page = f.render(SITE, HOST, "/code/pass-smg/web/-/issues/new", "Smithy/NewIssue", {
                repositoryId: state.repo,
                namePath: "pass-smg/web"
            })
            return {page, html: page.html, token: ec.web.sessionToken}
        } finally {
            login("john.doe")
        }
    },
    then({page, html, token}) {
        page.errors.length === 0
        html.includes('<form method="post" class="card" id="Smithy_createIssue" action="/code/-/do/createIssue">')
        html.includes('<input type="hidden" name="moquiSessionToken" value="' + token + '">')
        html.includes('<input type="hidden" name="returnTo" value="/code/pass-smg/web/-/issues/new">')
        html.includes('<input type="text" name="title" value="" maxlength="250" required>')
        html.includes('<textarea name="body" rows="12" maxlength="100000" required>')
        html.includes('<input type="checkbox" name="confidential" value="true"> Confidential</label>')
        html.includes("Only the owners of this repository and of its group")
        html.includes('formaction="/code/-/do/previewPost" formnovalidate name="previewOf" value="createIssue">Preview</button>')
        html.includes('data-moqui-island="SmithyComposer"')
        // labels, assignees and the milestone are a Reporter's
        !html.includes('name="labelIds"')
        !html.includes('name="assigneeHandles"')
    }
})
feature("an issue filed through Smithy/Do goes to its new number; a refusal and a preview return to the form with what was typed", {
    when() {
        const f = fixtures()
        const form = "/code/pass-smg/web/-/issues/new"
        const file = (username, fields) => {
            login(username, "moqui1!!")
            try {
                return f.post(SITE, HOST, fields.previewOf ? "previewPost" : "createIssue", {
                    repositoryId: state.repo,
                    sourceFormat: "markdown",
                    returnTo: form,
                    ...fields
                })
            } finally {
                login("john.doe")
            }
        }
        const made = file(KEYS, {title: "From the form", body: "Filed *here*.", operationId: "pass-smg-issue-form-1"})
        return {
            made,
            number: Number(/\/issues\/([0-9]+)$/.exec(made.location || "")?.[1]),
            first: state.issue.issueNumber,
            refused: file(KEYS, {title: "", body: "Text that is kept", operationId: "pass-smg-issue-form-2"}),
            unconfirmed: file(PLAIN, {title: "No address", body: "Text", operationId: "pass-smg-issue-form-3"}),
            preview: file(KEYS, {previewOf: "createIssue", title: "Kept title", body: "**bold** <script>alert(2)</script>"})
        }
    },
    then({made, number, first, refused, unconfirmed, preview}) {
        made.errors.length === 0
        made.status === 303
        made.cache === "no-store"
        number > first
        made.location === "/code/pass-smg/web/-/issues/" + number
        made.flash.notice.length > 0
        // a refusal is shown on the form, with the text kept
        refused.status === 303
        refused.location === "/code/pass-smg/web/-/issues/new"
        refused.flash.form === "createIssue"
        refused.flash.error.message.length > 0
        refused.flash.values.body === "Text that is kept"
        unconfirmed.location === "/code/pass-smg/web/-/issues/new"
        unconfirmed.flash.error.message === "Confirm your email address to do this."
        // a preview stores nothing: the cleaned rendering and what was typed, for the form's next page
        preview.status === 303
        preview.location === "/code/pass-smg/web/-/issues/new"
        preview.flash.form === "createIssue"
        preview.flash.preview.includes("<strong>bold</strong>")
        !preview.flash.preview.includes("<script")
        preview.flash.values.title === "Kept title"
    }
})
feature("Labels asks again before a delete and shows an organization's label without controls; a group's New issue redirects", {
    when() {
        const f = fixtures()
        const smithy = ec.resource.script("component://mr-pass/screen/Smithy/Smithy.js")
        const issues = ec.resource.script("component://mr-pass/screen/Smithy/SmithyIssues.js")
        // a label of the party that owns the repository's project (an organization's, in Projects): shown, and not this
        // repository's to change
        const owner = ec.user.userAccount.partyId
        f.run("update#mantle.work.effort.WorkEffort", {
            workEffortId: ec.entity.find("mantle.smithy.SmithyRepository").condition("repositoryId", state.repo).disableAuthz().one()
                .workEffortId,
            ownerPartyId: owner
        })
        f.run("create#mantle.work.effort.WorkEffortCategory", {
            categoryTypeEnumId: "WcatLabel",
            description: "org-wide",
            colorName: "blue",
            ownerPartyId: owner
        })
        // the list, by the page's own function with no screen rendered; the confirmation is the one render, a GET
        const path = "/code/pass-smg/web/-/labels"
        const shell = smithy.repositoryShell(SITE, state.repo, "/code", path)
        const list = issues.labels(shell, {smithy: "/code", account: "/account"}, {authenticated: true, site: {}}, path).html
        const row = name =>
            (list.split('<article class="card smithy-row"').find(part => part.includes(">" + name + "</small></h3>")) || "").split(
                "</article>"
            )[0]
        const asked = f.render(SITE, HOST, path, "Smithy/RepositoryDetail/Labels", {
            repositoryId: state.repo,
            namePath: "pass-smg/web",
            delete: state.label
        })
        const group = f.render(SITE, HOST, "/code/pass-smg/-/issues", "Smithy/GroupDetail/Issues", {
            groupId: state.group,
            namePath: "pass-smg",
            newIn: state.repo,
            go: "1"
        })
        return {
            own: row("bug"),
            shared: row("org-wide"),
            asked,
            still: f.operation("findLabels", {siteId: SITE, repositoryId: state.repo}).labelList.some(l => l.labelId === state.label),
            group,
            groupLocation: group.header("Location")
        }
    },
    then({own, shared, asked, still, group, groupLocation}) {
        // the repository's own label: Edit and Delete, the delete a link to the page that asks again
        own.includes('href="/code/pass-smg/web/-/labels?delete=' + state.label + '"')
        own.includes('action="/code/-/do/storeLabel"')
        // the organization's: its chip and count, no control
        shared.includes("org-wide")
        !shared.includes("?delete=")
        !shared.includes("<form")
        // the confirmation names the label and posts with confirm=yes; showing it deleted nothing
        asked.errors.length === 0
        asked.html.includes("<h2>Delete the label bug</h2>")
        asked.html.includes('id="Smithy_deleteLabel" action="/code/-/do/deleteLabel"')
        asked.html.includes('<input type="hidden" name="confirm" value="yes">')
        !asked.html.includes('id="SmithyLabelList"')
        still === true
        // New issue in a group goes to the chosen repository's form
        groupLocation === "/code/pass-smg/web/-/issues/new"
    }
})
feature("a post of another conversation is not edited on an issue's page", {
    when() {
        const f = fixtures()
        const smithy = ec.resource.script("component://mr-pass/screen/Smithy/Smithy.js")
        const issues = ec.resource.script("component://mr-pass/screen/Smithy/SmithyIssues.js")
        const other = f.issue(SITE, state.repo, {title: "Another issue", body: "Its own text"})
        const path = "/code/pass-smg/web/-/issues/" + state.issue.issueNumber
        const page = postId => {
            try {
                const shell = smithy.repositoryShell(SITE, state.repo, "/code", path)
                const html = issues.issueDetail(
                    shell,
                    String(state.issue.issueNumber),
                    {smithy: "/code", account: "/account"},
                    {authenticated: true, site: {}},
                    path,
                    {edit: postId}
                ).html
                return html.includes('id="Smithy_updatePost"') ? "form" : "none"
            } catch (error) {
                ec.message.clearErrors()
                return error.moquiErrorKind
            }
        }
        // the first post of an issue is its root event
        return {own: page(state.issue.rootCommEventId), other: page(other.rootCommEventId)}
    },
    then({own, other}) {
        own === "form"
        other === "NotFound"
    }
})
feature("the forum's topic list inside a group's shell: the scope's topics alone, links from the scoped base, the shell's tabs", {
    when() {
        const f = fixtures()
        const path = "/code/pass-smg/-/forum"
        const page = f.render(SITE, HOST, path, "Smithy/GroupDetail/Forum", {
            groupId: state.group,
            namePath: "pass-smg",
            forumPath: ""
        })
        return {
            html: page.html,
            errors: page.errors,
            // a topic and a post of the scope are the forum's own screens under the shell, named as the forum's own are
            topic: f.route(SITE, HOST, path + "/t/" + state.topic + "/scoped-hello"),
            post: f.route(SITE, HOST, path + "/p/" + state.topic),
            unscoped: f.route(SITE, HOST, path + "/Settings/Mail"),
            // a repository that has no forum has no forum pages
            off: f.render(SITE, HOST, "/code/pass-smg/web/-/forum", "Smithy/RepositoryDetail/Forum", {
                repositoryId: state.repo,
                namePath: "pass-smg/web",
                forumPath: ""
            }).errors
        }
    },
    then({html, errors, topic, post, unscoped, off}) {
        errors.length === 0
        // the group's shell, with the Forum tab
        html.includes('<a href="/code/pass-smg/-/forum" aria-current="page">Forum</a>')
        html.includes('<a href="/code/pass-smg/-/repositories">Repositories</a>')
        // the forum's own page: its navigation and the topic, each link from the scope's base
        html.includes('id="PassForumScopeNav"')
        html.includes('<a href="/code/pass-smg/-/forum/Categories">Categories</a>')
        html.includes('<a href="/code/pass-smg/-/forum/t/' + state.topic + '/scoped-hello">Scoped &lt;hello&gt;</a>')
        html.includes('<a href="/code/pass-smg/-/forum?view=top">Top</a>')
        // the scope filters: another group's topic is not listed, and no link is the site forum's
        !html.includes("Elsewhere")
        !html.includes('href="/forum')
        topic.screenPath === "/Smithy/GroupDetail/Forum/Topics/TopicDetail"
        topic.topicId === state.topic
        topic.topicSlug === "scoped-hello"
        topic.screenParameters.groupId === state.group
        post.screenPath === "/Smithy/GroupDetail/Forum/Post"
        post.postId === state.topic
        unscoped.kind === "NotFound"
        off.join(" ").includes("Page not found")
    }
})
feature(
    "a held report's link: a visitor is asked to sign in, its sender's account files it, and a link that is used or gone says so",
    {
        when() {
            const f = fixtures()
            const token = "pass-smg-no-such-token"
            const path = "/code/-/held-report/" + token
            // the claim of a link that names nothing returns to the link's page, which says so
            const claim = f.post(
                SITE,
                HOST,
                "claimHeldReport",
                {token, operationId: "pass-smg-held-1", returnTo: path},
                true,
                true
            )
            const page = f.render(SITE, HOST, path, "Smithy/Do/heldReport", {token})
            // a visitor's content, through the page's own function (the page is rendered once, signed in)
            const visitor = ec.resource
                .script("component://mr-pass/screen/Smithy/SmithyScope.js")
                .heldReportBody(
                    token,
                    {smithy: "/code", account: "/account"},
                    {authenticated: false, site: {registrationMode: "closed"}},
                    path,
                    {}
                )
            // a report that waits for its sender (mail to a report address from an address that had no account), with its
            // link's token known here: the account whose confirmed address sent it files it
            const sent = "pass-smg-held-token"
            f.run("create#mantle.forum.ForumHeldMail", {
                heldId: "PASS_SMG_HELD",
                siteId: SITE,
                contactListId: state.category,
                targetType: "issue",
                targetId: state.repo,
                senderAddress: SENDER + "@example.test",
                subject: "A hole in the wall",
                body: "<p>Where the hole is.</p>",
                tokenHash: ec.user.singleUseCodeHash(sent),
                state: "held",
                createdAt: Date.now(),
                expiresAt: Date.now() + 86400000
            })
            login(SENDER, "moqui1!!")
            const filed = f.post(SITE, HOST, "claimHeldReport", {
                token: sent,
                operationId: "pass-smg-held-2",
                returnTo: "/code/-/held-report/" + sent
            })
            login("john.doe")
            const number = Number(
                String(filed.location || "")
                    .split("/")
                    .pop()
            )
            return {
                routed: f.route(SITE, HOST, path),
                claim,
                page,
                visitor,
                token,
                filed,
                number,
                issue: f.operation("getIssue", {siteId: SITE, repositoryId: state.repo, issueNumber: number}).issue
            }
        },
        then({routed, claim, page, visitor, token, filed, number, issue}) {
            routed.screenPath === "/Smithy/Do/heldReport"
            routed.screenParameters.token === token
            claim.status === 303
            claim.location === "/code/-/held-report/" + token
            claim.cache === "no-store"
            claim.flash.error.notFound === true
            // a whole page in the site's shell, never kept by a cache, whose form posts the claim with the session token
            page.header("Cache-Control") === "no-store"
            page.html.includes("Sign out")
            page.html.includes('id="Smithy_claimHeldReport" action="/code/-/do/claimHeldReport"')
            page.html.includes('name="token" value="' + token + '"')
            page.html.includes('id="SmithyHeldGone"')
            // a visitor is sent to sign in and back, with no form
            visitor.includes('href="/account/Login?returnTo=%2Fcode%2F-%2Fheld-report%2F' + token + '"')
            !visitor.includes("claimHeldReport")
            // the sender's claim goes to the confidential issue the report became
            filed.status === 303
            filed.location === "/code/pass-smg/web/-/issues/" + number
            filed.flash.notice === "Your report was filed as the confidential issue #" + number + "."
            issue.confidential === true
            issue.title === "A hole in the wall"
        }
    }
)
feature(
    "Report files an item in the scope's queue; Hide is asked again, and what is hidden is Not Found to others and marked for its Owner",
    {
        when() {
            const f = fixtures()
            const smithy = ec.resource.script("component://mr-pass/screen/Smithy/Smithy.js")
            const spare = f.repository(SITE, state.group, "spare", "public")
            const target = {targetType: "repository", targetId: spare.repositoryId}
            const root = "/code/pass-smg/spare"
            // a confirmed account that has no role reports the repository
            login(REPORTS, "moqui1!!")
            const reported = f.post(SITE, HOST, "reportSmithyTarget", {
                ...target,
                reason: "spam",
                note: "Advertising",
                operationId: "pass-smg-report-1",
                returnTo: root + "/-/moderation/report",
                successTo: root
            })
            login("john.doe")
            const queue = f.operation("findReviews", {siteId: SITE, scopeContactListId: state.category})
            const hide = confirm =>
                f.post(SITE, HOST, "hideSmithyTarget", {
                    ...target,
                    hidden: "true",
                    reason: "Spam",
                    expectedRevision: f.operation("getRepository", {siteId: SITE, repositoryId: spare.repositoryId}).repository
                        .revision,
                    returnTo: root + "/-/moderation/hide",
                    successTo: root,
                    ...(confirm ? {confirm: "yes"} : {})
                })
            const unasked = hide(false)
            const hidden = hide(true)
            const shell = smithy.repositoryShell(SITE, spare.repositoryId, "/code", root)
            login(REPORTS, "moqui1!!")
            const other = f.operation("getRepository", {siteId: SITE, repositoryId: spare.repositoryId})
            login("john.doe")
            return {
                reported,
                queued: (queue.reviewList || []).some(
                    item => item.targetType === "repository" && item.targetId === spare.repositoryId
                ),
                unasked,
                hidden,
                marked: shell.hidden,
                other
            }
        },
        then({reported, queued, unasked, hidden, marked, other}) {
            reported.status === 303
            reported.location === "/code/pass-smg/spare"
            reported.flash.notice === "Your report was sent to the moderators."
            // the report waits in the queue of the group above the repository
            queued === true
            unasked.flash.error.message === "Confirm this change on its own page first."
            hidden.status === 303
            hidden.location === "/code/pass-smg/spare"
            hidden.flash.notice.startsWith("It is hidden")
            marked === true
            other.kind === "NotFound"
        }
    }
)
feature(
    "a topic of the scope is made an issue through Smithy/Do, and the issue's page links its discussion in the group's forum",
    {
        when() {
            const f = fixtures()
            const scope = ec.resource.script("component://mr-pass/screen/Smithy/SmithyScope.js")
            const smithy = ec.resource.script("component://mr-pass/screen/Smithy/Smithy.js")
            const made = f.post(SITE, HOST, "convertTopicToIssue", {
                repositoryId: state.repo,
                rootCommEventId: state.topic,
                postIds: state.topic,
                title: "From the forum",
                operationId: "pass-smg-convert-1",
                returnTo: "/code/pass-smg/-/forum/t/" + state.topic + "/scoped-hello"
            })
            const number = Number(
                String(made.location || "")
                    .split("/")
                    .pop()
            )
            const issue = f.operation("getIssue", {siteId: SITE, repositoryId: state.repo, issueNumber: number}).issue
            const shell = smithy.repositoryShell(SITE, state.repo, "/code", "/code/pass-smg/web/-/issues/" + number)
            return {
                made,
                number,
                card: String(
                    scope.discussionCard(shell, issue?.discussion, {smithy: "/code", forum: "/forum"}, {mounts: []}).html || ""
                ),
                links: f.operation("getTopicLinks", {siteId: SITE, rootCommEventId: state.topic}).linkList || []
            }
        },
        then({made, number, card, links}) {
            made.status === 303
            made.location === "/code/pass-smg/web/-/issues/" + number
            made.flash.notice === "Issue #" + number + " was made from the topic."
            // the site mounts no forum, so the discussion is in the group's
            card.includes('<a href="/code/pass-smg/-/forum/t/' + state.topic + '">')
            links.some(link => link.sourceType === "issue")
        }
    }
)
feature("Smithy's registrations agree: the app, PASS's copy of Mantle's operations, their routes, and the cache policy", {
    when() {
        const text = location => String(ec.resource.getLocationText(location) || "")
        const pass = "component://mr-pass/service/pass/SmithySchema.js"
        const operations = Object.keys(ec.resource.script(pass))
        const routed = ec.resource.script("component://mr-pass/service/pass/Routes.js").map(r => r[2])
        const forum = ec.resource.script("component://mr-pass/service/pass/Schema.js")
        const headers = ec.resource.script("component://mr-pass/screen/Shared/Headers.js")
        return {
            app: ec.resource.script("component://mr-pass/service/pass/Apps.js").smithy,
            authorityApp: ec.resource.script("component://mr-mantle/service/mantle/public/PublicApps.js").apps.smithy,
            // a remote PASS host has no Mantle and the authority has no PASS, so each keeps a copy; change both together
            schema: text(pass).length > 0 && text(pass) === text("component://mr-mantle/service/mantle/smithy/SmithySchema.js"),
            count: operations.length,
            unrouted: operations.filter(name => !routed.includes(name)),
            // a name is in one of the two schema files
            twice: operations.filter(name => forum[name]),
            anonymous: headers.policyOf("smithy", "/moqui/mr-moqui/-/tree/main", true).cacheControl,
            signedIn: headers.policyOf("smithy", "/moqui/mr-moqui/-/tree/main", false).cacheControl,
            ownPath: headers.policyOf("smithy", "/-/do/createIssue", true).cacheControl,
            commitsList: headers.policyOf("smithy", "/moqui/mr-moqui/-/commits/main", true).cacheControl,
            // an issue page is kept by no cache, for a visitor either (an issue may become confidential)
            issuePages: ["/moqui/mr-moqui/-/issues", "/moqui/mr-moqui/-/issues/12", "/moqui/-/issues", "/moqui/mr-moqui/-/labels", "/moqui/mr-moqui/-/commit/0123abc"]
                .map(path => headers.policyOf("smithy", path, true).cacheControl)
                .join(" "),
            // nor a merge request's pages (one may be held for review), a file's edit or the fork pages (DG4)
            reviewPages: ["/moqui/mr-moqui/-/merge-requests", "/moqui/mr-moqui/-/merge-requests/7/changes", "/moqui/mr-moqui/-/edit/main/a.md", "/moqui/mr-moqui/-/fork"]
                .map(path => headers.policyOf("smithy", path, true).cacheControl)
                .join(" "),
            // nor the forum's pages inside a shell (the forum's own are not) and the scope's moderation pages (DG6)
            scopePages: ["/moqui/-/forum", "/moqui/mr-moqui/-/forum/t/T1/hello", "/moqui/-/moderation"]
                .map(path => headers.policyOf("smithy", path, true).cacheControl)
                .join(" "),
            // nor a pipeline's pages, a job's log and an upload (DG5): a log holds whatever a job printed
            pipelinePages: ["/moqui/mr-moqui/-/pipelines", "/moqui/mr-moqui/-/pipelines/3/jobs/J1", "/moqui/mr-moqui/-/pipelines/3/jobs/J1/log", "/moqui/mr-moqui/-/artifacts/A1/x.tar.gz", "/moqui/mr-moqui/-/pipelines/deployments/D1"]
                .map(path => headers.policyOf("smithy", path, true).cacheControl)
                .join(" "),
            // DG7: Search (it lists issues) and a release's file are kept by no cache; Docs and Releases are read pages
            sitePages: ["/-/search", "/moqui/mr-moqui/-/release-assets/A1/x.zip", "/moqui/mr-moqui/-/docs/main/a.md", "/moqui/mr-moqui/-/releases/v1"]
                .map(path => headers.policyOf("smithy", path, true).cacheControl)
                .join(" ")
        }
    },
    then({app, authorityApp, schema, count, unrouted, twice, anonymous, signedIn, ownPath, issuePages, reviewPages, commitsList, scopePages, pipelinePages, sitePages}) {
        app.screen === "Smithy"
        app.base === "/code"
        authorityApp.root === true
        schema === true
        count === 145
        unrouted.length === 0
        twice.length === 0
        anonymous === "public, max-age=60"
        signedIn === "no-store"
        ownPath === "no-store"
        // and so is a commit's page, which names its issues; the list of commits is not
        issuePages === "no-store no-store no-store no-store no-store"
        commitsList === "public, max-age=60"
        reviewPages === "no-store no-store no-store no-store"
        scopePages === "no-store no-store no-store"
        pipelinePages === "no-store no-store no-store no-store no-store"
        sitePages === "no-store no-store public, max-age=60 public, max-age=60"
    }
})
feature("Docs shows a page of the docs directory: its links made Docs, Blob and raw links, its contents and headings, cleaned", {
    when() {
        const page = fixtures().render(SITE, HOST, "/code/pass-smg/web/-/docs/main", "Smithy/RepositoryDetail/Docs", {
            repositoryId: state.repo,
            namePath: "pass-smg/web",
            refPath: "main"
        })
        const links = (page.html.match(/<a [^>]*>(?:the guide|the code)</g) || []).map(tag => /href="([^"]*)"/.exec(tag)[1]).join(" ")
        return {page, html: page.html, links}
    },
    then({page, html, links}) {
        page.errors.length === 0
        !html.includes("Error rendering")
        html.includes('id="SmithyDocsPage"')
        // a page of the directory is its Docs page with its anchor; a file outside it is its Blob page
        links === "/code/pass-smg/web/-/docs/main/Guide.md#start /code/pass-smg/web/-/blob/main/src/main.js"
        html.includes('<h2 id="h-install">')
        html.includes('<a href="#h-install">Install</a>')
        // the contents, the ref picker with the tag, Edit at a branch, the docs search, and the tab
        html.includes('<a href="/code/pass-smg/web/-/docs/main/Guide.md">Guide</a>')
        html.includes('<option value="v1.0">v1.0</option>')
        html.includes('href="/code/pass-smg/web/-/edit/main/docs/README.md" id="SmithyDocsEdit"')
        html.includes('<form method="get" action="/code/-/search" role="search" class="card" id="SmithyDocsSearch">')
        html.includes('<a href="/code/pass-smg/web/-/docs" aria-current="page">Docs</a>')
    }
})
feature("Search is reached by its request path, at a root mount too, where the framework takes no segment of it; it escapes what was asked and what it found, and links a result by the authority's path", {
    when() {
        const f = fixtures()
        // Smithy at a site's root (the user's call): the framework's /search proxy (a servlet of the default conf)
        // answers /search on every host ahead of any screen, so the page, the header's box and the docs box use -/search
        f.run("create#mantle.public.PublicSite", {siteId: ROOT_SITE, name: "Smithy at the root", state: "published", registrationMode: "invitation", locale: "en", timeZone: "UTC", policyRevision: 1, generation: 1})
        f.run("create#mantle.public.PublicSiteParty", {siteId: ROOT_SITE, partyId: ec.user.userAccount.partyId, state: "active", role: "owner", revision: 1})
        f.run("mantle.public.SiteServices.store#Mounts", {
            input: {siteId: ROOT_SITE, expectedRevision: 1, mounts: [{app: "account", pathPrefix: "/account"}, {app: "smithy", pathPrefix: "/"}], hosts: [{hostname: ROOT_HOST, canonical: true}]}
        })
        const atRoot = f.route(ROOT_SITE, ROOT_HOST, "/-/search")
        // the page as a request reaches it: the resolver's screen for the path, rendered under Pass.xml
        const routed = f.route(SITE, HOST, "/code/-/search")
        const page = f.render(SITE, HOST, "/code/-/search", routed.screenPath.slice(1), {...routed.screenParameters, q: "breaks <b", kind: "issue"})
        const actions = [...page.html.matchAll(/<form [^>]*action="([^"]*)"[^>]*id="(SmithySearchBox|SmithySearch)"/g)].map(m => m[2] + " " + m[1])
        return {atRoot, routed, page, html: page.html, actions, reserved: ec.web.reservedPaths}
    },
    then({atRoot, routed, page, html, actions, reserved}) {
        atRoot.screenPath === "/Smithy/Search"
        routed.screenPath === "/Smithy/Search"
        // a servlet's or the host's segment is never the first of a path Smithy answers at the root
        reserved.includes("search")
        !reserved.includes("-")
        actions.join(", ") === "SmithySearchBox /code/-/search, SmithySearch /code/-/search"
        page.errors.length === 0
        html.includes('value="breaks &lt;b"')
        !html.includes("breaks <b")
        html.includes('id="SmithySearch_issue"')
        html.includes('<a href="/code/pass-smg/web/-/issues/1">Tree page breaks &lt;b&gt; (#1)</a>')
    }
})
feature("a release's page shows its notes and its files with size and SHA-256; a Maintainer's forms only for a Maintainer; a change of its state asks again; addons.xml is text/xml", {
    when() {
        const f = fixtures()
        const page = f.render(SITE, HOST, "/code/pass-smg/web/-/releases/v1.0", "Smithy/ReleaseDetail", {
            repositoryId: state.repo,
            namePath: "pass-smg/web",
            tag: "v1.0"
        })
        // an account with no role reads the same release through the page's function
        login(KEYS, "moqui1!!")
        let viewer
        try {
            const smithy = ec.resource.script("component://mr-pass/screen/Smithy/Smithy.js")
            const self = "/code/pass-smg/web/-/releases/v1.0"
            viewer = ec.resource
                .script("component://mr-pass/screen/Smithy/SmithySite.js")
                .releaseDetail(smithy.repositoryShell(SITE, state.repo, "/code", self), "v1.0", {smithy: "/code", account: "/account"}, {authenticated: true, mounts: []}, self).html
        } finally {
            login("john.doe")
        }
        const addonsOf = () => f.render(SITE, HOST, "/code/pass-smg/-/addons.xml", "Smithy/GroupDetail/addons", {groupId: state.group, namePath: "pass-smg"})
        const addons = addonsOf()
        // a visitor's copy of a public group's file may be kept by a cache for a while, one per cookie
        logout()
        let visitor
        try {
            visitor = addonsOf()
        } finally {
            login("john.doe")
        }
        // Make it a draft without its confirmation page's answer is not run
        const revision = f.operation("getRelease", {siteId: SITE, repositoryId: state.repo, tag: "v1.0"}).release.revision
        const unpublish = f.post(SITE, HOST, "storeRelease", {
            repositoryId: state.repo,
            tag: "v1.0",
            expectedRevision: revision,
            published: "false",
            returnTo: "/code/pass-smg/web/-/releases/v1.0"
        })
        const published = f.operation("getRelease", {siteId: SITE, repositoryId: state.repo, tag: "v1.0"}).release.published
        return {page, html: page.html, viewer, addons, visitor, unpublish, published}
    },
    then({page, html, viewer, addons, visitor, unpublish, published}) {
        page.errors.length === 0
        !html.includes("Error rendering")
        html.includes('<small class="smithy-chip" id="SmithyReleaseState">Published</small>')
        html.includes("First &amp; best")
        html.includes("<strong>first</strong>")
        // a named release's name in its edit form, sent back only when changed
        html.includes('<input type="hidden" name="was_name" value="First &amp; best">')
        // the file: its download through the release's path, its size and checksum; the image's name
        html.includes('<a href="/code/pass-smg/web/-/release-assets/PASS_SMG_A1/web-1.0.zip" rel="nofollow">web-1.0.zip</a> <small>2.0 KiB</small>')
        html.includes("SHA-256 <code>" + "ab".repeat(32) + "</code>")
        html.includes("<code>registry.example.test/web:1.0</code>")
        html.includes('<a href="/code/pass-smg/web/-/archive/v1.0.zip" rel="nofollow">zip</a>')
        // a Maintainer's forms, each posting to Smithy/Do
        html.includes('id="SmithyReleaseDelete"')
        html.includes('action="/code/-/do/storeRelease"')
        html.includes('enctype="multipart/form-data"')
        html.includes('action="/code/-/do/addReleaseAsset"')
        html.includes("/code/pass-smg/web/-/releases/v1.0?removeAsset=PASS_SMG_A1")
        html.includes('<a href="/code/pass-smg/web/-/releases" aria-current="page">Releases</a>')
        // an account with no role reads the files and has none of the forms
        viewer.includes("web-1.0.zip")
        !viewer.includes("/-/do/")
        !viewer.includes("removeAsset")
        !viewer.includes("SmithyReleaseDelete")
        // the group's addons.xml: the operation's text as text/xml, kept by no cache for a signed-in account
        addons.errors.length === 0
        String(addons.header("Content-Type")).startsWith("text/xml")
        addons.header("Cache-Control") === "no-store"
        addons.html.startsWith('<?xml version="1.0" encoding="UTF-8"?>')
        addons.html.includes("<addons>")
        visitor.header("Cache-Control") === "public, max-age=300"
        visitor.header("Vary") === "Cookie"
        unpublish.flash.error.message === "Confirm this change on its own page first."
        published === true
    }
})
feature("every app's default base is refused as a group's path, so a group never takes a mount's place", {
    when() {
        const apps = ec.resource.script("component://mr-pass/service/pass/Apps.js")
        const taken = []
        for (const app of Object.values(apps)) {
            const pathSegment = app.base.slice(1)
            try {
                fixtures().run("mantle.smithy.SmithyServices.create#Group", {siteId: SITE, pathSegment, visibility: "public"})
                taken.push(pathSegment + " was made")
            } catch (error) {
                if (!/nameTaken|nameInvalid|That name is taken/.test(String(error.message)))
                    taken.push(pathSegment + ": " + String(error.message).slice(0, 120))
            }
        }
        return {taken, count: Object.keys(apps).length}
    },
    then({taken, count}) {
        count === 11
        taken.length === 0
    }
})
