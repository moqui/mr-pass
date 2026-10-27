suite(['ForumHttp'], {
    server: {
        components: ['mr-pass'],
        specs: ['ClientFixtures'],
        conf: 'conf/MoquiLoadTestConf.xml',
    },
})
