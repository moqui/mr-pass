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
        // The browser specs start several topics in one run; an established owner is past the new-member daily cap.
        state.set('trustLevel', 'member')
        state.update()
        // A second member with a public profile, so the browser specs can exchange private messages.
        const reader = call('mantle.party.PartyServices.create#Person', {
            firstName: 'Forum',
            lastName: 'Reader',
        }).partyId
        call('mantle.party.PartyServices.create#PartyUserAccount', {
            partyId: reader,
            username: 'pass.http.reader',
            emailAddress: 'reader@example.test',
            newPassword: 'moqui1!!',
            newPasswordVerify: 'moqui1!!',
        })
        call('create#mantle.public.PublicSiteParty', {
            siteId,
            partyId: reader,
            state: 'active',
            role: 'member',
            revision: 1,
        })
        // Only the recipient needs a handle; the owner's profile is created by the remote profile check.
        call('create#mantle.public.PublicSiteProfile', {
            siteId,
            partyId: reader,
            handle: 'reader',
            displayName: 'reader',
            discoverability: 'members',
            revision: 1,
        })
        return published
    },
    then(result) {
        result.state === 'published'
    },
})
