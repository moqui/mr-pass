spec({
    setupSpec() {
        login('john.doe')
        ec.artifactExecution.disableAuthz()
    },
    cleanupSpec() {
        ec.artifactExecution.enableAuthz()
    },
})
feature('provision a published HTTP test community', {
    when() {
        const siteId = 'PASS_HTTP',
            partyId = ec.user.userAccount.partyId
        call('create#mantle.public.PublicSite', {
            siteId,
            name: 'PASS HTTP community',
            state: 'published',
            registrationMode: 'closed',
            locale: 'en',
            timeZone: 'UTC',
            policyRevision: 1,
            generation: 1,
        })
        call('create#mantle.public.PublicSiteParty', {
            siteId,
            partyId,
            state: 'active',
            role: 'owner',
            revision: 1,
        })
        const run = (service, input) =>
            call(service, {
                input: service.endsWith('store#Category')
                    ? { operationId: ec.user.randomString(32), ...input }
                    : input,
            }).result
        run('mantle.public.SiteServices.store#Mounts', {
            siteId,
            expectedRevision: 1,
            mounts: [
                { app: 'forum', pathPrefix: '/forum' },
                { app: 'account', pathPrefix: '/account' },
                { app: 'members', pathPrefix: '/members' },
                { app: 'sites', pathPrefix: '/sites' },
            ],
            hosts: [{ hostname: '127.0.0.1', canonical: true }],
        })
        const category = run('mantle.forum.ForumServices.store#Category', {
            siteId,
            name: 'Welcome',
        })
        run('mantle.forum.ForumServices.set#CategoryAccess', {
            siteId,
            contactListId: category.contactListId,
            visibility: 'public',
            publicationState: 'published',
            confirm: true,
            expectedRevision: 1,
        })
        const published = run('mantle.forum.ForumServices.publish#Post', {
            siteId,
            contactListId: category.contactListId,
            title: 'Welcome to the community',
            body: '<p>Public server-rendered discussion.</p>',
            operationId: 'http-fixture-001',
        })
        const state = ec.entity
            .find('mantle.forum.ForumMemberState')
            .condition({ siteId, partyId })
            .one()
        state.set('lastPostedAt', Date.now() - 60000)
        state.update()
        return published
    },
    then(result) {
        result.state === 'published'
    },
})
