const api = '/rest/s1/pass/v1/sites/PASS_HTTP'
// 15 features, about 64 seconds (2026-10-30): over 30 seconds, so moqui test-client runs it only with --slow, when its
// browser scenarios are needed.
spec({ slow: true })
feature('anonymous HTML reading and API use the same public projection', {
    when() {
        const s = session()
        return { html: s.get('/forum'), api: s.get(api + '/topics') }
    },
    then({ html, api }) {
        html.status === 200
        html.text.includes('Welcome to the community')
        api.status === 200
        api.json().topicList[0].title === 'Welcome to the community'
        !api.text.includes('emailAddress')
    },
})
feature('host and site substitution are refused', {
    when() {
        return {
            host: session().get('/forum', {
                headers: { Host: 'unknown.example' },
            }),
            site: session().get(api + '/topics', {
                params: { siteId: 'OTHER' },
            }),
        }
    },
    then({ host, site }) {
        host.status === 404
        site.status === 422
    },
})
feature('anonymous changes without CSRF are refused', {
    when() {
        return {
            res: session().post(api + '/posts', {
                json: {
                    title: 'forged',
                    body: 'forged',
                    operationId: 'forged-post-001',
                },
                csrf: false,
            }),
        }
    },
    then({ res }) {
        res.status === 403
    },
})
feature('phone reading presents ordinary links and accessible navigation', {
    when() {
        const page = browser.newPage({ viewport: { width: 390, height: 844 } })
        const navigation = page.goto('/forum')
        return {
            status: navigation.status,
            text: page.text(),
            links: page.evaluate(() =>
                Array.from(document.querySelectorAll('a')).map((a) => ({
                    text: a.textContent,
                    href: a.getAttribute('href'),
                })),
            ),
            overflow: page.evaluate(
                () => document.documentElement.scrollWidth > innerWidth,
            ),
        }
    },
    then({ status, text, links, overflow }) {
        status === 200
        text.includes('Welcome to the community')
        links.some((a) => a.text === 'Skip to discussion')
        links.some((a) => a.href.includes('/t/'))
        overflow === false
    },
})
feature(
    'signed-in composer loads the framework rich-text editor and retains a draft',
    {
        when() {
            const page = browser.newPage({
                viewport: { width: 1200, height: 900 },
            })
            page.goto('/account/Login')
            page.getByLabel('Email or username', { exact: true }).fill(
                'john.doe',
            )
            page.getByLabel('Password', { exact: true }).fill('moqui')
            page.getByRole('button', { name: 'Sign in', exact: true }).click()
            page.waitForURL('/forum')
            page.allowProblems(/Blocked script execution in 'about:srcdoc'/)
            const nav = page.goto('/forum/Compose')
            page.waitFor(
                () => !!document.querySelector('[contenteditable="true"]'),
                { timeout: 30 },
            )
            const category = page.evaluate(
                () =>
                    document.querySelector('select option:nth-child(2)').value,
            )
            page.locator('select').evaluate((element, value) => {
                element.value = value
                element.dispatchEvent(new Event('change', { bubbles: true }))
            }, category)
            page.getByLabel('Title', { exact: true }).fill(
                'Browser saved draft',
            )
            page.locator('[contenteditable="true"]').fill(
                'A recoverable contribution from the browser.',
            )
            page.waitFor(
                () => document.body.innerText.includes('Draft saved.'),
                { timeout: 30 },
            )
            const editorText = page.text(),
                hasEditor = page.evaluate(
                    () => !!document.querySelector('[contenteditable="true"]'),
                )
            page.screenshot('composer-ready')
            page.goto('/forum/Drafts')
            const saved = page.text().includes('Browser saved draft')
            page.getByRole('link', {
                name: 'Browser saved draft',
                exact: true,
            }).click()
            page.waitFor(
                () => !!document.querySelector('[contenteditable="true"]'),
                { timeout: 30 },
            )
            page.getByRole('button', { name: 'Publish', exact: true }).click()
            page.waitForURL(/\/forum\/t\//, { timeout: 30 })
            return {
                status: nav.status,
                text: editorText,
                hasEditor,
                saved,
                published: page.waitFor(
                    () =>
                        Array.from(document.querySelectorAll('iframe')).some(
                            (frame) =>
                                frame.contentDocument?.body?.textContent.includes(
                                    'A recoverable contribution from the browser.',
                                ),
                        ),
                    { timeout: 20 },
                ),
            }
        },
        then({ status, text, hasEditor, saved, published }) {
            status === 200
            hasEditor === true
            text.toLowerCase().includes('save draft')
            saved === true
            published === true
        },
    },
)
feature(
    'concurrent operation replays create one post and concurrent edits have one winner',
    {
        timeout: 60,
        when() {
            const page = browser.newPage()
            page.goto('/account/Login')
            page.getByLabel('Email or username', { exact: true }).fill(
                'john.doe',
            )
            page.getByLabel('Password', { exact: true }).fill('moqui')
            page.getByRole('button', { name: 'Sign in', exact: true }).click()
            page.waitForURL('/forum')
            page.allowProblems(
                /409 Conflict .*\/rest\/s1\/pass\/v1\/sites\/PASS_HTTP\/posts\//,
            )
            return page.evaluate(async () => {
                await new Promise((resolve) => setTimeout(resolve, 11000))
                const base = '/rest/s1/pass/v1/sites/PASS_HTTP',
                    headers = {
                        'Content-Type': 'application/json',
                        'X-CSRF-Token': document.querySelector(
                            'meta[name="moquiSessionToken"]',
                        ).content,
                    }
                const categories = await (
                        await fetch(base + '/categories')
                    ).json(),
                    input = {
                        contactListId: categories.categoryList[0].contactListId,
                        title: 'Concurrent durable create',
                        body: 'Exactly one canonical post',
                        operationId: 'client-concurrent-create-001',
                    }
                const creates = await Promise.all(
                    Array.from({ length: 8 }, async () => {
                        const response = await fetch(base + '/posts', {
                            method: 'POST',
                            headers,
                            body: JSON.stringify(input),
                        })
                        return {
                            status: response.status,
                            data: await response.json(),
                        }
                    }),
                )
                const postId = creates[0].data.postId
                const edits = await Promise.all(
                    Array.from({ length: 5 }, async (_, i) => {
                        const response = await fetch(
                            base + '/posts/' + postId,
                            {
                                method: 'PATCH',
                                headers,
                                body: JSON.stringify({
                                    body: 'Winning edit ' + i,
                                    expectedRevision: 1,
                                    reason: 'Concurrent edit fixture',
                                }),
                            },
                        )
                        return response.status
                    }),
                )
                const posts = await (
                    await fetch(base + '/topics/' + postId + '/posts')
                ).json()
                return {
                    statuses: creates.map((v) => v.status),
                    ids: creates.map((v) => v.data.postId),
                    edits,
                    count: posts.postList.length,
                    revision: posts.postList[0].revision,
                }
            })
        },
        then({ statuses, ids, edits, count, revision }) {
            statuses.every((status) => status === 200)
            new Set(ids).size === 1
            edits.filter((status) => status === 200).length === 1
            edits.filter((status) => status === 409).length === 4
            count === 1
            revision === 2
        },
    },
)
feature('keyboard skip navigation focuses the discussion without a pointer', {
    when() {
        const page = browser.newPage()
        page.goto('/forum')
        page.press('Tab')
        const focused = page.evaluate(() =>
            document.activeElement.classList.contains('skip'),
        )
        page.press('Enter')
        return {
            focused,
            target: page.evaluate(() => document.activeElement.id),
        }
    },
    then({ focused, target }) {
        focused === true
        target === 'main'
    },
})
feature('the browser can edit a post through its revision-protected composer', {
    when() {
        const page = browser.newPage()
        page.goto('/account/Login')
        page.getByLabel('Email or username', { exact: true }).fill('john.doe')
        page.getByLabel('Password', { exact: true }).fill('moqui')
        page.getByRole('button', { name: 'Sign in', exact: true }).click()
        page.waitForURL('/forum')
        page.allowProblems(/Blocked script execution in 'about:srcdoc'/)
        page.getByRole('link', {
            name: 'Concurrent durable create',
            exact: true,
        }).click()
        page.waitFor(() => !!document.querySelector('iframe'), { timeout: 20 })
        page.getByRole('link', { name: 'Edit post', exact: true }).click()
        page.waitFor(
            () => !!document.querySelector('[contenteditable="true"]'),
            { timeout: 20 },
        )
        page.locator('[contenteditable="true"]').fill(
            'An edit saved from the browser.',
        )
        page.getByLabel('Edit reason', { exact: true }).fill(
            'Browser revision acceptance',
        )
        page.waitFor(() => document.body.innerText.includes('Draft saved.'), {
            timeout: 20,
        })
        page.getByRole('button', { name: 'Publish', exact: true }).click()
        page.waitForURL(/\/forum\/t\//, { timeout: 20 })
        return {
            visible: page.waitFor(
                () =>
                    Array.from(document.querySelectorAll('iframe')).some(
                        (frame) =>
                            frame.contentDocument?.body?.textContent.includes(
                                'An edit saved from the browser.',
                            ),
                    ),
                { timeout: 20 },
            ),
        }
    },
    then({ visible }) {
        visible === true
    },
})
feature(
    'a composed poll can be voted on in the enhanced topic, and edits have a history',
    {
        when() {
            const page = browser.newPage({
                viewport: { width: 1200, height: 900 },
            })
            page.goto('/account/Login')
            page.getByLabel('Email or username', { exact: true }).fill(
                'john.doe',
            )
            page.getByLabel('Password', { exact: true }).fill('moqui')
            page.getByRole('button', { name: 'Sign in', exact: true }).click()
            page.waitForURL('/forum')
            page.allowProblems(/Blocked script execution in 'about:srcdoc'/)
            page.goto('/forum/Compose')
            page.waitFor(
                () => !!document.querySelector('[contenteditable="true"]'),
                { timeout: 30 },
            )
            const category = page.evaluate(
                () =>
                    document.querySelector('select option:nth-child(2)').value,
            )
            page.locator('select').evaluate((element, value) => {
                element.value = value
                element.dispatchEvent(new Event('change', { bubbles: true }))
            }, category)
            page.getByLabel('Title', { exact: true }).fill(
                'Favourite colour poll',
            )
            page.locator('[contenteditable="true"]').fill('Pick one colour.')
            page.getByLabel('Add a poll').click()
            page.getByLabel('Question', { exact: true }).fill('Which colour?')
            page.getByLabel('Choices, one per line', { exact: true }).fill(
                'Red\nBlue',
            )
            // The previous feature posted moments ago; a retry with the same operation ID waits out the posting interval.
            page.allowProblems(/429 Too Many Requests/)
            page.getByRole('button', { name: 'Publish', exact: true }).click()
            try {
                page.waitForURL(/\/forum\/t\//, { timeout: 12 })
            } catch (e) {
                page.getByRole('button', {
                    name: 'Publish',
                    exact: true,
                }).click()
                page.waitForURL(/\/forum\/t\//, { timeout: 30 })
            }
            page.waitFor(
                () =>
                    Array.from(document.querySelectorAll('button')).some(
                        (b) => b.textContent.trim() === 'Vote',
                    ),
                { timeout: 20 },
            )
            page.getByLabel('Blue', { exact: true }).click()
            page.getByRole('button', { name: 'Vote', exact: true }).click()
            const counted = page.waitFor(
                () => document.body.innerText.includes('Blue: 1'),
                { timeout: 20 },
            )
            const enhanced = page.evaluate(
                () => !document.getElementById('pass-ssr-posts'),
            )
            page.goto('/forum')
            page.getByRole('link', {
                name: 'Concurrent durable create',
                exact: true,
            }).click()
            page.waitFor(
                () =>
                    Array.from(document.querySelectorAll('a')).some(
                        (a) => a.textContent.trim() === 'History',
                    ),
                { timeout: 20 },
            )
            page.getByRole('link', { name: 'History', exact: true })
                .first()
                .click()
            page.waitForURL(/PostHistory/, { timeout: 20 })
            page.getByRole('link', { name: /^Revision 3/ })
                .first()
                .click()
            return {
                counted,
                enhanced,
                diff: page.waitFor(
                    () => !!document.querySelector('.moqui-diff'),
                    {
                        timeout: 20,
                    },
                ),
                text: page.text(),
            }
        },
        then({ counted, enhanced, diff, text }) {
            counted === true
            enhanced === true
            diff === true
            text.includes('An edit saved from the browser.')
        },
    },
)
feature(
    'members exchange a private message in the enhanced conversation view',
    {
        when() {
            const login = (page, user, password) => {
                page.goto('/account/Login')
                page.getByLabel('Email or username', { exact: true }).fill(user)
                page.getByLabel('Password', { exact: true }).fill(password)
                page.getByRole('button', {
                    name: 'Sign in',
                    exact: true,
                }).click()
                page.waitForURL('/forum')
                page.allowProblems(/Blocked script execution in 'about:srcdoc'/)
            }
            const sender = browser.newPage()
            login(sender, 'john.doe', 'moqui')
            sender.goto('/forum/Messages')
            sender
                .getByLabel('To (member handles, comma separated)', {
                    exact: true,
                })
                .fill('reader')
            sender
                .getByLabel('Subject', { exact: true })
                .fill('A private hello')
            sender
                .getByLabel('Message', { exact: true })
                .fill('Only the two of us can read this.')
            // The previous feature posted as this member moments ago; wait out the posting interval.
            sender.evaluate(
                () =>
                    new Promise((resolve) =>
                        setTimeout(() => resolve(true), 10500),
                    ),
            )
            sender
                .getByRole('button', {
                    name: 'New private message',
                    exact: true,
                })
                .click()
            sender.waitForURL(/saved=true/, { timeout: 20 })
            const reader = browser.newPage()
            login(reader, 'pass.http.reader', 'moqui1!!')
            reader.goto('/forum/Messages')
            reader
                .getByRole('link', { name: 'A private hello', exact: true })
                .click()
            reader.waitForURL(/ConversationDetail/, { timeout: 20 })
            const enhanced = reader.waitFor(
                () =>
                    !document.getElementById('pass-ssr-posts') &&
                    Array.from(document.querySelectorAll('iframe')).some(
                        (frame) =>
                            frame.contentDocument?.body?.textContent.includes(
                                'Only the two of us can read this.',
                            ),
                    ),
                { timeout: 20 },
            )
            const url = reader.url(),
                outsider = session().get(
                    '/forum/Messages/ConversationDetail' +
                        url.slice(url.indexOf('?')),
                )
            return { enhanced, text: reader.text(), outsider: outsider.status }
        },
        then({ enhanced, text, outsider }) {
            enhanced === true
            text.includes('Participants: ')
            outsider !== 200
        },
    },
)
feature('a newer authority draft requires an explicit recovery choice', {
    when() {
        const page = browser.newPage()
        page.goto('/account/Login')
        page.getByLabel('Email or username', { exact: true }).fill('john.doe')
        page.getByLabel('Password', { exact: true }).fill('moqui')
        page.getByRole('button', { name: 'Sign in', exact: true }).click()
        page.waitForURL('/forum')
        page.allowProblems(/Blocked script execution in 'about:srcdoc'/)
        page.goto('/forum/Compose')
        page.waitFor(
            () => !!document.querySelector('[contenteditable="true"]'),
            { timeout: 20 },
        )
        const category = page.evaluate(
            () => document.querySelector('select option:nth-child(2)').value,
        )
        page.locator('select').evaluate((element, value) => {
            element.value = value
            element.dispatchEvent(new Event('change', { bubbles: true }))
        }, category)
        page.getByLabel('Title', { exact: true }).fill('Conflict recovery')
        page.locator('[contenteditable="true"]').fill('Browser recovery text')
        page.waitFor(() => document.body.innerText.includes('Draft saved.'), {
            timeout: 20,
        })
        const draftId = page.evaluate(async () => {
            const key = Object.keys(localStorage).find(
                    (key) =>
                        key.startsWith('pass-compose-current:') &&
                        key.endsWith(':new'),
                ),
                draftId = localStorage.getItem(key),
                state = await (
                    await fetch('/forum/Compose/state?draftId=' + draftId)
                ).json()
            const response = await fetch('/forum/Compose/publish', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-Token': moqui.sessionToken,
                },
                body: JSON.stringify({
                    mode: 'draft',
                    draftId,
                    contactListId: state.categoryId,
                    expectedRevision: state.draft.revision,
                    title: 'Newer authority draft',
                    body: 'Authority text',
                    moquiSessionToken: moqui.sessionToken,
                }),
            })
            if (!response.ok) throw new Error('Concurrent draft fixture failed')
            return draftId
        })
        page.goto('/forum/Compose?draftId=' + draftId)
        page.waitFor(
            () => document.body.innerText.includes('Compare saved drafts'),
            { timeout: 20 },
        )
        page.getByRole('button', {
            name: 'Continue with browser text',
            exact: true,
        }).click()
        page.getByRole('button', { name: 'Save draft', exact: true }).click()
        page.waitFor(() => document.body.innerText.includes('Draft saved.'), {
            timeout: 20,
        })
        return {
            chosen: page
                .locator('[contenteditable="true"]')
                .evaluate((element) => element.innerText)
                .includes('Browser recovery text'),
        }
    },
    then({ chosen }) {
        chosen === true
    },
})
feature('a failed save retains browser text and the operation ID for retry', {
    when() {
        const page = browser.newPage()
        page.goto('/account/Login')
        page.getByLabel('Email or username', { exact: true }).fill('john.doe')
        page.getByLabel('Password', { exact: true }).fill('moqui')
        page.getByRole('button', { name: 'Sign in', exact: true }).click()
        page.waitForURL('/forum')
        page.allowProblems(/Blocked script execution in 'about:srcdoc'/)
        page.goto('/forum/Compose')
        page.waitFor(
            () => !!document.querySelector('[contenteditable="true"]'),
            { timeout: 20 },
        )
        page.evaluate(() => {
            window.passTestFetch = window.fetch
            window.fetch = (url, options) =>
                String(url).endsWith('/publish')
                    ? Promise.reject(new Error('The connection timed out'))
                    : window.passTestFetch(url, options)
        })
        const category = page.evaluate(
            () => document.querySelector('select option:nth-child(2)').value,
        )
        page.locator('select').evaluate((element, value) => {
            element.value = value
            element.dispatchEvent(new Event('change', { bubbles: true }))
        }, category)
        page.getByLabel('Title', { exact: true }).fill('Timeout recovery')
        page.locator('[contenteditable="true"]').fill('Retained after timeout')
        page.waitFor(
            () => document.body.innerText.includes('The connection timed out'),
            { timeout: 20 },
        )
        const retained = page.evaluate(() =>
            Object.keys(localStorage)
                .filter((key) => key.startsWith('pass-compose:'))
                .some((key) => {
                    const value = JSON.parse(localStorage.getItem(key))
                    return (
                        value.draft.body.includes('Retained after timeout') &&
                        /^[A-Za-z0-9_-]{32}$/.test(value.operationId)
                    )
                }),
        )
        page.evaluate(() => {
            window.fetch = window.passTestFetch
            delete window.passTestFetch
        })
        page.getByRole('button', { name: 'Save draft', exact: true }).click()
        page.waitFor(() => document.body.innerText.includes('Draft saved.'), {
            timeout: 20,
        })
        return { retained }
    },
    then({ retained }) {
        retained === true
    },
})
feature('sign-in ignores a return path that would leave the site', {
    when() {
        const page = browser.newPage()
        // A tab between the slashes is dropped by browsers, turning "/\t/host" into "//host".
        page.goto(
            '/account/Login?returnTo=' + encodeURIComponent('/\t/evil.example'),
        )
        page.getByLabel('Email or username', { exact: true }).fill('john.doe')
        page.getByLabel('Password', { exact: true }).fill('moqui')
        page.getByRole('button', { name: 'Sign in', exact: true }).click()
        page.waitForURL('/forum')
        return { url: page.url() }
    },
    then({ url }) {
        !url.includes('evil.example')
        url.endsWith('/forum')
    },
})
feature(
    'a signed-in cookie session still needs the CSRF token to change data',
    {
        when() {
            const page = browser.newPage()
            page.goto('/account/Login')
            page.getByLabel('Email or username', { exact: true }).fill(
                'john.doe',
            )
            page.getByLabel('Password', { exact: true }).fill('moqui')
            page.getByRole('button', { name: 'Sign in', exact: true }).click()
            page.waitForURL('/forum')
            page.allowProblems(/403 Forbidden .*\/posts/)
            return {
                status: page.evaluate(
                    (url) =>
                        fetch(url, {
                            method: 'POST',
                            credentials: 'same-origin',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                title: 'forged',
                                body: 'forged',
                                operationId: 'forged-signed-in-001',
                            }),
                        }).then((response) => response.status),
                    api + '/posts',
                ),
            }
        },
        then({ status }) {
            status === 403
        },
    },
)
feature(
    'the owner reaches the S3 screens: operations, activity, import, grants, privacy and topic links',
    {
        when() {
            const page = browser.newPage({
                viewport: { width: 1200, height: 900 },
            })
            page.goto('/account/Login')
            page.getByLabel('Email or username', { exact: true }).fill(
                'john.doe',
            )
            page.getByLabel('Password', { exact: true }).fill('moqui')
            page.getByRole('button', { name: 'Sign in', exact: true }).click()
            page.waitForURL('/forum')
            // The rich-text editor's sandboxed preview frame logs this; the other browser features allow it too.
            page.allowProblems(/Blocked script execution in 'about:srcdoc'/)
            const visit = (path) => {
                const nav = page.goto(path)
                return { status: nav.status, text: page.text() }
            }
            const operations = visit('/forum/Settings/Operations')
            // A preview through the ordinary form: what a counter rebuild would touch.
            page.evaluate(() => {
                const form = document.getElementById(
                    'PassOperationsPreviewOperation',
                )
                form.querySelector('select[name="operation"]').value =
                    'rebuild-counters'
                form.requestSubmit()
            })
            page.waitFor(
                () => document.body.innerText.includes('Review operation'),
                { timeout: 30 },
            )
            const preview = page.text()
            const activity = visit('/forum/Reports/Activity?interval=day')
            const importPage = visit('/forum/Settings/Import')
            const members = visit('/forum/Settings/Members')
            const policies = visit('/forum/Settings/Policies')
            const account = visit('/account/Settings')
            const topic = visit('/forum')
            const firstTopic = page.evaluate(() =>
                Array.from(document.querySelectorAll('a'))
                    .find((a) => a.getAttribute('href')?.includes('/t/'))
                    ?.getAttribute('href'),
            )
            const topicPage = visit(firstTopic)
            return {
                operations,
                preview,
                activity,
                importPage,
                members,
                policies,
                account,
                topic,
                topicPage,
            }
        },
        then(r) {
            r.operations.status === 200 &&
                r.operations.text.includes('Start an operation')
            r.operations.text.includes('Preview an operation')
            r.preview.includes('Topics:')
            r.activity.status === 200 &&
                r.activity.text.includes('Participation') &&
                r.activity.text.includes('Export a report as CSV')
            r.importPage.status === 200 &&
                r.importPage.text.includes('Register an archive')
            r.members.status === 200 && r.members.text.includes('Grant access')
            r.policies.status === 200 &&
                r.policies.text.includes('Save retention periods')
            r.account.status === 200 &&
                r.account.text.includes('Export or erase my data')
            r.topicPage.status === 200
            r.topicPage.text.includes('Link a product or article')
        },
    },
)
