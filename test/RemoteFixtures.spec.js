// Run only in the dedicated remote frontend runtime described in README.
feature(
    'remote frontend has no Mantle entity catalog or copied business accounts',
    {
        ignore: !System.getProperty('pass_backend_url')
            ? 'Requires the dedicated remote frontend runtime'
            : false,
        when() {
            return {
                configured: !!System.getProperty('pass_backend_url'),
                mantle: ec.entity.isEntityDefined('mantle.party.Party'),
                forum: ec.entity.isEntityDefined('mantle.forum.ForumTopic'),
            }
        },
        then({ configured, mantle, forum }) {
            configured === true
            mantle === false
            forum === false
        },
    },
)
