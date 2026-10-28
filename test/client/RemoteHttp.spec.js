feature(
    'remote frontend reads the authority without a local business catalog',
    {
        when() {
            const response = session().get('/forum')
            return { status: response.status, text: response.text }
        },
        then({ status, text }) {
            status === 200
            text.includes('Welcome to the community')
            text.includes('/t/')
        },
    },
)
feature(
    'remote password authentication keeps credentials server-side and can save a private draft',
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
                'Remote authority draft',
            )
            page.locator('[contenteditable="true"]').fill(
                'Saved through the server-side delegation.',
            )
            page.waitFor(
                () => document.body.innerText.includes('Draft saved.'),
                { timeout: 30 },
            )
            page.goto('/forum/Drafts')
            return {
                text: page.text(),
                html: page.evaluate(() => document.documentElement.outerHTML),
            }
        },
        then({ text, html }) {
            text.includes('Remote authority draft')
            !html.includes('passDelegation')
            !html.includes('test-deployment-secret')
        },
    },
)
feature(
    'remote multipart media is scanned, finalized, downloaded and concealed after revocation',
    {
        when() {
            const s = session()
            s.get('/account/Login')
            const login = s.post('/account/Login/save', {
                form: {
                    formAction: 'startSession',
                    username: 'john.doe',
                    password: 'moqui',
                },
            })
            const state = s.get('/forum/Compose/state').json(),
                contactListId = state.categories[0].contactListId
            const uploaded = s.post('/forum/Compose/upload', {
                multipart: {
                    contactListId,
                    file: {
                        fileName: 'remote.txt',
                        text: 'Remote streamed attachment',
                        contentType: 'text/plain',
                    },
                },
            })
            if (uploaded.status !== 200)
                return {
                    login: login.status,
                    upload: uploaded.status,
                    body: uploaded.text,
                }
            const attachment = uploaded.json().attachment
            const image = s
                .post('/forum/Compose/upload', {
                    multipart: {
                        contactListId,
                        file: {
                            fileName: 'pixel.png',
                            base64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGMQMgn7DwAClAGcHVtGXwAAAABJRU5ErkJggg==',
                            contentType: 'image/png',
                        },
                    },
                })
                .json().attachment
            const published = s.post('/forum/Compose/publish', {
                json: {
                    contactListId,
                    title: 'Remote media',
                    body: 'A protected attachment',
                    operationId: 'remote-media-001',
                    attachmentIds: [
                        attachment.attachmentId,
                        image.attachmentId,
                    ],
                },
            })
            if (published.status !== 200)
                return {
                    login: login.status,
                    upload: uploaded.status,
                    publish: published.status,
                    body: published.text,
                }
            const root = published.json().rootCommEventId,
                path =
                    '/forum/t/' +
                    root +
                    '/remote-media/download?attachmentId=' +
                    attachment.attachmentId
            const thumbnail = s.get(
                '/forum/t/' +
                    root +
                    '/remote-media/download?attachmentId=' +
                    image.attachmentId +
                    '&variant=thumbnail',
            )
            const downloaded = s.get(path),
                changed = s.post('/forum/Settings/Categories/save', {
                    form: {
                        formAction: 'setCategoryAccess',
                        contactListId,
                        visibility: 'members',
                        publicationState: 'published',
                        expectedRevision: 2,
                        confirm: 'true',
                    },
                }),
                hidden = session().get(path)
            return {
                login: login.status,
                upload: uploaded.status,
                publish: published.status,
                clean: attachment.scanState,
                download: downloaded.status,
                body: downloaded.text,
                changed: changed.status,
                hidden: hidden.status,
                thumbnail: thumbnail.status,
                imageType: thumbnail.header('content-type'),
            }
        },
        then({
            login,
            upload,
            publish,
            clean,
            download,
            body,
            changed,
            hidden,
            thumbnail,
            imageType,
        }) {
            login === 302
            upload === 200
            publish === 200
            clean === 'clean'
            download === 200
            body === 'Remote streamed attachment'
            changed === 302
            hidden === 404
            thumbnail === 200
            imageType === 'image/png'
        },
    },
)
feature(
    'remote profile images are scanned and obey current profile visibility',
    {
        when() {
            const s = session()
            s.get('/account/Login')
            s.post('/account/Login/save', {
                form: {
                    formAction: 'startSession',
                    username: 'john.doe',
                    password: 'moqui',
                },
            })
            const saved = s.post('/account/Settings/save', {
                form: {
                    formAction: 'storeProfile',
                    handle: 'remote-owner',
                    displayName: 'Remote owner',
                    discoverability: 'public',
                    expectedRevision: 0,
                },
            })
            const uploaded = s.post('/account/Settings/avatar', {
                multipart: {
                    file: {
                        fileName: 'avatar.png',
                        base64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGMQMgn7DwAClAGcHVtGXwAAAABJRU5ErkJggg==',
                        contentType: 'image/png',
                    },
                },
            })
            const profile = s.get('/members/MemberDetail?handle=remote-owner')
            const match = profile.text.match(
                /src="([^\"]*MemberDetail\/download[^\"]*)"/,
            )
            if (!match)
                return {
                    saved: saved.status,
                    uploaded: uploaded.status,
                    profile: profile.status,
                    html: profile.text,
                }
            const path = match[1].replace(/&amp;/g, '&'),
                image = session().get(path)
            const changed = s.post('/account/Settings/save', {
                form: {
                    formAction: 'storeProfile',
                    handle: 'remote-owner',
                    displayName: 'Remote owner',
                    discoverability: 'hidden',
                    expectedRevision: 2,
                },
            })
            return {
                saved: saved.status,
                uploaded: uploaded.status,
                profile: profile.status,
                image: image.status,
                type: image.header('content-type'),
                changed: changed.status,
                hidden: session().get(path).status,
            }
        },
        then({ saved, uploaded, profile, image, type, changed, hidden }) {
            saved === 302
            uploaded === 302
            profile === 200
            image === 200
            type === 'image/png'
            changed === 302
            hidden === 404
        },
    },
)
feature(
    'stage 2 reading and private messages work through the remote adapter',
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
            const tags = page.goto('/forum/Tags').status
            const bookmarks = page.goto('/forum/Bookmarks').status
            page.goto('/forum/Messages')
            page.getByLabel('To (member handles, comma separated)', {
                exact: true,
            }).fill('reader')
            page.getByLabel('Subject', { exact: true }).fill('Remote hello')
            page.getByLabel('Message', { exact: true }).fill(
                'Sent through the remote frontend.',
            )
            // Earlier features posted as this member; wait out the posting interval.
            page.evaluate(
                () =>
                    new Promise((resolve) =>
                        setTimeout(() => resolve(true), 10500),
                    ),
            )
            page.getByRole('button', {
                name: 'New private message',
                exact: true,
            }).click()
            page.waitForURL(/saved=true/, { timeout: 20 })
            return { tags, bookmarks, text: page.text() }
        },
        then({ tags, bookmarks, text }) {
            tags === 200
            bookmarks === 200
            text.includes('Remote hello')
        },
    },
)
