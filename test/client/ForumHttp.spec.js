const api = '/rest/s1/pass/v1/sites/PASS_HTTP'
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
