// How PASS chooses its authority's transport (service/pass/Transport.js, mr-moqui plans/archive/Edge-Node.md §5.5 and decision
// 8): local with no pass@backend-url; rest or grpc when pass@backend-transport says; automatic is gRPC where the host
// has the binding and a gRPC endpoint is configured, else REST; edge: is gRPC on the link. Settings that cannot work
// are refused by name. This run has no gRPC client installed (Lite and Dev have none; a test run without --serve
// installs none), so the binding's "not built" is read as REST.
const transport = () =>
    ec.resource.script('component://mr-pass/service/pass/Transport.js')
function chosen(settings) {
    try {
        return transport().select(settings)
    } catch (error) {
        return { refused: String(error.message), kind: error.moquiErrorKind }
    }
}
feature(
    'the transport follows the settings, and automatic takes gRPC only where it can',
    {
        when() {
            const https = 'https://authority.example.test'
            return {
                local: chosen({
                    backend: '',
                    setting: 'grpc',
                    available: true,
                }),
                autoRest: chosen({
                    backend: https,
                    setting: '',
                    grpcUrl: 'grpcs://authority.example.test:4317',
                    available: false,
                }),
                autoNoEndpoint: chosen({
                    backend: https,
                    setting: '',
                    grpcUrl: '',
                    available: true,
                }),
                autoGrpc: chosen({
                    backend: https,
                    setting: '',
                    grpcUrl: 'grpcs://authority.example.test:5000',
                    available: true,
                }),
                forcedRest: chosen({
                    backend: https,
                    setting: 'REST',
                    grpcUrl: 'grpcs://a:1',
                    available: true,
                }),
                forcedGrpc: chosen({
                    backend: https,
                    setting: 'grpc',
                    grpcUrl: '',
                    available: true,
                }),
                forcedGrpcLite: chosen({
                    backend: https,
                    setting: 'grpc',
                    available: false,
                }),
                edge: chosen({
                    backend: 'edge:',
                    setting: '',
                    available: true,
                }),
                edgeForced: chosen({
                    backend: 'edge:',
                    setting: 'grpc',
                    available: true,
                }),
                edgeRest: chosen({
                    backend: 'edge:',
                    setting: 'rest',
                    available: true,
                }),
                edgeLite: chosen({
                    backend: 'edge:',
                    setting: '',
                    available: false,
                }),
                unknown: chosen({
                    backend: https,
                    setting: 'soap',
                    available: true,
                }),
                plainHttp: transport().grpcEndpointOf('http://10.0.0.5:8080/'),
                httpsPort: transport().grpcEndpointOf('https://[::1]:8443/rest'),
            }
        },
        then(c) {
            c.local.kind == 'local'
            c.autoRest.kind == 'rest'
            // an authority whose gRPC listener nobody named keeps REST
            c.autoNoEndpoint.kind == 'rest'
            c.autoGrpc.kind == 'grpc'
            c.autoGrpc.endpoint == 'grpcs://authority.example.test:5000'
            c.forcedRest.kind == 'rest'
            c.forcedGrpc.kind == 'grpc'
            // the authority's own HTTPS port, which answers gRPC over HTTP/2: its dedicated port is off by default
            c.forcedGrpc.endpoint == 'grpcs://authority.example.test:443'
            c.forcedGrpcLite.kind == 'Unavailable'
            c.forcedGrpcLite.refused.includes('needs gRPC')
            c.edge.kind == 'grpc'
            c.edge.endpoint == 'edge:'
            c.edgeForced.endpoint == 'edge:'
            c.edgeRest.refused.includes('gRPC only')
            c.edgeLite.refused.includes('needs gRPC')
            c.unknown.refused.includes('grpc, rest or empty')
            c.plainHttp == 'grpc://10.0.0.5:4317'
            c.httpsPort == 'grpcs://[::1]:8443'
        },
    },
)
feature(
    'a transport in clear text to another host is refused unless pass@backend-insecure says so (SEC-PSF-05)',
    {
        when() {
            return {
                restClear: chosen({
                    backend: 'http://authority.example.test',
                    setting: 'rest',
                    available: false,
                }),
                restLoopback: chosen({
                    backend: 'http://127.0.0.1:8091',
                    setting: 'rest',
                    available: false,
                }),
                restLocalhost: chosen({
                    backend: 'http://localhost:8091/',
                    setting: '',
                    available: false,
                }),
                restInsecure: chosen({
                    backend: 'http://authority.example.test',
                    setting: 'rest',
                    available: false,
                    insecure: true,
                }),
                grpcClear: chosen({
                    backend: 'https://authority.example.test',
                    setting: '',
                    grpcUrl: 'grpc://authority.example.test:4317',
                    available: true,
                }),
                grpcDerived: chosen({
                    backend: 'http://10.0.0.5:8080',
                    setting: 'grpc',
                    available: true,
                }),
                grpcLoopback: chosen({
                    backend: 'https://authority.example.test',
                    setting: 'grpc',
                    grpcUrl: 'grpc://[::1]:4317',
                    available: true,
                }),
                // a lookalike of a loopback name is another host
                lookalike: chosen({
                    backend: 'http://127.0.0.1.example.test',
                    setting: 'rest',
                    available: false,
                }),
                // the property is read by current(), and a direct REST client is refused the same
                current: withConf('pass@backend-url',
                    'http://authority.example.test',
                    () => {
                        try {
                            return transport().current()
                        } catch (error) {
                            return { refused: String(error.message) }
                        }
                    },
                ),
            }
        },
        then(c) {
            c.restClear.kind == 'Unavailable'
            c.restClear.refused.includes('clear text')
            c.restLoopback.kind == 'rest'
            c.restLocalhost.kind == 'rest'
            c.restInsecure.kind == 'rest'
            c.grpcClear.kind == 'Unavailable'
            c.grpcClear.refused.includes('pass@backend-grpc-url')
            c.grpcDerived.kind == 'Unavailable'
            c.grpcLoopback.kind == 'grpc'
            c.lookalike.kind == 'Unavailable'
            c.current.refused.includes('clear text')
        },
    },
)
feature(
    'with no gRPC in the host the binding says so, and the configured transport is REST',
    {
        when() {
            const built = transport().grpcAvailable()
            let thrown = ''
            try {
                ec.service.passAuthority('edge:')
            } catch (error) {
                thrown = String(error.message)
            }
            const rest = withConf('pass@backend-url',
                'https://authority.example.test',
                () =>
                    withConf('pass@backend-grpc-url',
                        'grpcs://authority.example.test:4317',
                        () => transport().current(),
                    ),
            )
            const edge = withConf('pass@backend-url', 'edge:', () => {
                try {
                    return transport().current()
                } catch (error) {
                    return { refused: String(error.message) }
                }
            })
            return { built, thrown, rest, edge, local: transport().current() }
        },
        then({ built, thrown, rest, edge, local }) {
            built === false
            thrown == 'gRPC not built into this host'
            rest.kind == 'rest'
            edge.refused.includes('needs gRPC')
            local.kind == 'local'
        },
    },
)
// OWASP ASVS 5.0.0 v5.0.0-13.2.3, PASS's in-process proof (docs/ASVS-Matrix.md, V13): no default credential between a
// PASS frontend and its authority. mr-pass ships pass@client-secret empty, and a frontend with no secret (or the
// CHANGEME placeholder) calls no remote authority; the authority registers a client only by the secret its conf gives that
// client (pass-authority/client[id]@secret, compared by digest: framework service/org/moqui/public/Account.js
// clientRegistered), so no client is registered by an empty secret, a guessed one, or none configured.
// Does not prove: the strength of the secret an operator sets (the example conf keeps it in runtime/.env), nor the gRPC
// listener's check, which is the same comparison in Rust (pass_authority.rs).
feature('v5.0.0-13.2.3: no PASS client is registered by an empty, placeholder or guessed secret', {
    when() {
        const account = ec.resource.script('component://framework/service/org/moqui/public/Account.js')
        const registered = (id, secret) => account.clientRegistered(id, secret, 'PASS_HTTP') === true
        const built = () => {
            try {
                transport().authorityClient('PASS_HTTP', 'site', 'GET')
                return 'built'
            } catch (error) {
                return String(error.message)
            }
        }
        const frontend = (secret) =>
            withConf('pass@backend-url', 'https://authority.example.test', () =>
                withConf('pass@client-id', 'test', () =>
                    secret == null ? built() : withConf('pass@client-secret', secret, built),
                ),
            )
        return {
            shipped: ec.factory.isConfValueSet('pass@client-secret'),
            noSecret: frontend(null),
            placeholder: frontend('CHANGEME'),
            set: frontend('an operator secret'),
            empty: registered('test', ''),
            guessed: ['test', 'secret', 'changeme', 'CHANGEME', 'password', 'admin', 'test-deployment'].filter((g) => registered('test', g)),
            unconfigured: [registered('nosuchclient', ''), registered('edge', ''), registered('edge', 'edge')],
            right: registered('test', 'test-deployment-secret'),
        }
    },
    then({ shipped, noSecret, placeholder, set, empty, guessed, unconfigured, right }) {
        shipped === false
        noSecret.includes('Remote authority is not configured')
        placeholder.includes('Remote authority is not configured')
        !empty
        guessed.length === 0
        unconfigured.every((r) => r === false)
        // the controls: a frontend with a secret set builds its call, and the configured secret registers its client
        set === 'built'
        right === true
    },
})
// OWASP ASVS 5.0.0 v5.0.0-16.5.2, PASS's in-process proof (docs/ASVS-Matrix.md, V16): a remote frontend whose authority
// cannot be reached fails closed and at once. The frontend keeps no business data and nothing kept is served when the
// authority cannot answer (ShopOperations "site information is kept by generation ..."): here the site information every
// page reads fails in well under a second, with no answer and no client secret in its error. The authority is loopback's
// discard port, where nothing listens on a test machine; REST follows no redirect and gives up after 30 seconds
// (Transport.js authorityClient), a time this proof does not wait out.
// Does not prove: the text a visitor sees, which is the framework's error page (an error id on a production instance; the
// connection error names the authority's address, which a development instance shows), nor the gRPC transport's 10 second
// connect and 30 second call timeouts, nor an authority that answers slowly.
feature('v5.0.0-16.5.2: an authority that cannot be reached fails the call at once, with nothing served', {
    when() {
        const outcome = (operation, input) => {
            try {
                return { result: call('pass.Facade.call#Operation', { operation, input }).result }
            } catch (error) {
                ec.message.clearErrors()
                return { result: null, message: String(error.message) }
            }
        }
        const started = Date.now()
        const read = withConf('pass@backend-url', 'http://127.0.0.1:9', () =>
            withConf('pass@client-id', 'test', () =>
                withConf('pass@client-secret', 'proof-client-secret', () =>
                    withConf('pass@backend-transport', 'rest', () =>
                        outcome('getSiteInfo', { siteId: 'PASS_HTTP', hostname: '127.0.0.1' }),
                    ),
                ),
            ),
        )
        return { read, ms: Date.now() - started, local: transport().current().kind }
    },
    then({ read, ms, local }) {
        read.result == null
        // the control: the call was sent, and failed at the connection (not refused before it)
        read.message.includes('http://127.0.0.1:9/rest/s1/pass/v1/sites/PASS_HTTP/')
        !read.message.includes('proof-client-secret')
        ms < 3000
        // and with no authority set the frontend is local again
        local === 'local'
    },
})
