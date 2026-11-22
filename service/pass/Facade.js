/* PASS owns presentation and one configured authority, never a business replica: in process when pass@backend-url is
   empty, else over REST or gRPC (Transport.js). */
// Smithy's operations are in their own file, a copy of Mantle's SmithySchema.js (plan/design-smithy.md §4.1), as Schema.js is
// of its ForumSchema.js; a name is in one of the two
const schema = {
    ...ec.resource.script('component://mr-pass/service/pass/Schema.js'),
    ...ec.resource.script('component://mr-pass/service/pass/SmithySchema.js'),
}
const fail = (kind, text) => {
    const e = new Error(text)
    e.moquiErrorKind = kind
    throw e
}
/* The remote transports, REST and gRPC, behind one set of functions (Transport.js). */
const transport = () =>
    ec.resource.script('component://mr-pass/service/pass/Transport.js')
const statusKind = (status) => transport().statusKind(status)
/* The type a file is answered with from the site's origin (SEC-PSF-08): its own when inert (an image, a font, audio or
   video, a PDF, plain text or CSV, an archive), else application/octet-stream, so no file a visitor uploaded or pushed (a
   release file named x.js) is a script or a style sheet the site's pages could load; with a sandboxing policy, as
   Smithy's raw route answers. Mantle's PassAuthority.js keeps the same list for the remote transports. */
const INERT_TYPES =
    /^(?:image\/(?:png|jpeg|gif|webp|avif|svg\+xml)|font\/(?:woff2?|ttf|otf)|(?:audio|video)\/[a-z0-9.+-]+|application\/(?:pdf|zip|gzip|x-gzip|x-tar|octet-stream)|text\/(?:plain|csv))$/
function servedType(type) {
    const base = String(type || '').split(';')[0].trim().toLowerCase()
    return INERT_TYPES.test(base) ? String(type) : 'application/octet-stream'
}
const SANDBOX = "default-src 'none'; sandbox"
/* Whether a download is sandboxed: always, but a PDF shown inline, which a browser will not display in a sandbox and whose
   viewer has an origin of its own (the framework's web::user_file_inline). */
const sandboxed = (type, disposition) =>
    !(
        /^inline\b/i.test(String(disposition || '')) &&
        String(type || '').split(';')[0].trim().toLowerCase() === 'application/pdf'
    )
/* The REST client of an authority path (Transport.js), kept for callers of the REST API. */
const authorityClient = (siteId, path, method) =>
    transport().authorityClient(siteId, path, method)
/* In local mode no authority's run() checks the caller, so the authority's login-key rule (Mantle's PassAuthority.js) is
   applied here: a user who came by a login key (the api_key or login_key header, ec.user.loginKeyKind, or a session that
   such a header started) calls only an installed app's operations (APP_KEY_OPERATIONS), and only with a device's key; an
   access token or a session's key calls none (SEC-PSF-01). */
function checkLoginKey(operation) {
    const request = ec.web?.request
    const headerKey = request
        ? request.getHeader('api_key') || request.getHeader('login_key') || ''
        : ''
    const headerLogin = !!ec.web?.sessionAttributes?.moquiHeaderLogin
    const kind = ec.user.userId ? ec.user.loginKeyKind || null : null
    if (!headerKey && !headerLogin && !kind) return
    const appOperations = ec.resource.script(
        'component://mr-mantle/script/PassAuthority.js',
    ).APP_KEY_OPERATIONS
    if (kind !== 'device' || !appOperations.includes(operation))
        fail(
            'Unauthorized',
            "accessDenied: A login key calls only an installed app's operations, and an access token none; sign in to the site",
        )
}
function call(operation, input) {
    const def = schema[operation]
    if (!def || Object.keys(input).some((k) => !def.fields.includes(k)))
        fail('Unprocessable', ec.l10n.localize('Unsupported operation or input'))
    const backend = ec.factory.getConfValue('pass@backend-url')
    if (!backend) checkLoginKey(operation)
    if (!backend)
        return ec.service
            .sync()
            .throwOnError(true)
            .name(def.service)
            .parameters({ input })
            .call().result
    return transport().call(operation, input, def)
}
function download(siteId, attachmentId, variant) {
    const backend = ec.factory.getConfValue('pass@backend-url')
    if (!backend) {
        const result = call('getAttachment', {
            siteId,
            attachmentId,
            ...(variant ? { variant } : {}),
        })
        // as downloadFile and the remote authority answer a file (SEC-PSF-08): an inert type, sandboxed
        const type = servedType(result.attachment.mimeType)
        const disposition =
            (result.attachment.variant === 'thumbnail'
                ? 'inline'
                : 'attachment') +
            '; filename="' +
            String(result.attachment.filename).replace(/["\\\r\n]/g, '_') +
            '"'
        ec.web.response.setContentType(type)
        ec.web.response.setHeader('Cache-Control', 'no-store')
        ec.web.response.setHeader('X-Content-Type-Options', 'nosniff')
        ec.web.response.setHeader('Content-Disposition', disposition)
        if (sandboxed(type, disposition))
            ec.web.response.setHeader('Content-Security-Policy', SANDBOX)
        const stream = ec.resource
            .getLocationReference(result.location)
            .openStream()
        try {
            ec.web.response.write(stream.readAllBytes())
        } finally {
            stream.close()
        }
        return
    }
    transport().download(siteId, attachmentId, variant)
}
/* An export or report download: the authority rechecks the requester and the expiry. */
function downloadExport(siteId, exportId) {
    const backend = ec.factory.getConfValue('pass@backend-url')
    if (!backend) {
        const result = call('getExport', { siteId, exportId })
        const type = servedType(result.export.mimeType)
        ec.web.response.setContentType(type)
        ec.web.response.setHeader('Cache-Control', 'no-store')
        ec.web.response.setHeader('X-Content-Type-Options', 'nosniff')
        ec.web.response.setHeader('Content-Security-Policy', SANDBOX)
        ec.web.response.setHeader(
            'Content-Disposition',
            'attachment; filename="' +
                String(result.export.filename).replace(/["\\\r\n]/g, '_') +
                '"',
        )
        const stream = ec.resource
            .getLocationReference(result.location)
            .openStream()
        try {
            ec.web.response.write(stream.readAllBytes())
        } finally {
            stream.close()
        }
        return
    }
    transport().downloadExport(siteId, exportId)
}
/* A file an operation answers, rechecked by the authority (the Support app's case file and return label; Customer Service
   P15): its result's file and, in process, its location. options (Smithy's archive): disposition, the whole
   Content-Disposition in place of the one made from the file's name, and streamed, to read and write the file a window
   at a time. Every header is set before the body. Through a remote frontend the transport's own answer is forwarded. */
function downloadFile(siteId, operation, input, options) {
    const backend = ec.factory.getConfValue('pass@backend-url')
    if (!backend) {
        const result = call(operation, { siteId, ...input })
        // Smithy DG5: the authority's operation sent the file as this response itself (a run's artifact, send#RunArtifact)
        if (result.sent === true) return
        const headers = () => {
            const type = servedType(result.file.mimeType)
            const disposition =
                options?.disposition ||
                'attachment; filename="' + String(result.file.filename).replace(/["\\\r\n]/g, '_') + '"'
            ec.web.response.setContentType(type)
            if (sandboxed(type, disposition)) ec.web.response.setHeader('Content-Security-Policy', SANDBOX)
            // Shop P8 (F75): the authority lets a public product image of the current generation be kept a minute; else no-store
            ec.web.response.setHeader(
                'Cache-Control',
                result.file.cacheControl === 'public, max-age=60' ? result.file.cacheControl : 'no-store',
            )
            ec.web.response.setHeader('X-Content-Type-Options', 'nosniff')
            ec.web.response.setHeader('Content-Disposition', disposition)
        }
        // the authority checked the asker; the file is read as the authority reads it (a record's content may sit in the
        // database resource store, which a public account may not read itself), before anything is written
        const wasDisabled = ec.artifactExecution.disableAuthz()
        let bytes
        try {
            const stream = ec.resource
                .getLocationReference(result.location)
                .openStream()
            try {
                if (options?.streamed) {
                    // a large file (a repository's archive): its headers, then a window at a time
                    headers()
                    for (let at = 0; ; ) {
                        const window = stream.read(at, RANGE_WINDOW)
                        if (!window.length) break
                        ec.web.response.write(window)
                        at += window.length
                    }
                    return
                }
                bytes = stream.readAllBytes()
            } finally {
                stream.close()
            }
        } finally {
            if (!wasDisabled) ec.artifactExecution.enableAuthz()
        }
        headers()
        ec.web.response.write(bytes)
        return
    }
    transport().downloadOperation(siteId, operation, { siteId, ...input })
}
/* The bytes a ranged download reads and writes at a time. */
const RANGE_WINDOW = 1024 * 1024
/* A granted download (impl-shop P6): the browser's byte range asked of the authority, which rechecks the grant and its
   capability, and the file streamed with it: in process only its range read (206, or 416 outside it), through a remote
   frontend the authority's own ranged answer forwarded (REST or gRPC). */
function downloadRanged(siteId, operation, input) {
    const range = String(ec.web.request.getHeader('Range') || '').trim()
    const asked = {
        siteId,
        ...input,
        ...(/^bytes=\d*-\d*$/.test(range) ? { range } : {}),
    }
    if (ec.factory.getConfValue('pass@backend-url'))
        return transport().downloadOperation(siteId, operation, asked)
    const result = call(operation, asked)
    const response = ec.web.response
    response.setHeader('Cache-Control', 'no-store')
    response.setHeader('X-Content-Type-Options', 'nosniff')
    response.setHeader('Accept-Ranges', 'bytes')
    response.setHeader(
        'Content-Disposition',
        'attachment; filename="' +
            String(result.file.filename).replace(/["\\\r\n]/g, '_') +
            '"',
    )
    const r = result.range
    if (r && r.unsatisfiable) {
        response.setStatus(416)
        response.setHeader('Content-Range', 'bytes */' + result.file.size)
        return
    }
    response.setContentType(servedType(result.file.mimeType))
    response.setHeader('Content-Security-Policy', SANDBOX)
    if (r) {
        response.setStatus(206)
        response.setHeader(
            'Content-Range',
            'bytes ' + r.start + '-' + r.end + '/' + result.file.size,
        )
    }
    // only the range is read, a window at a time (Shop F88)
    const start = r ? r.start : 0
    const end = r ? r.end : result.file.size - 1
    const wasDisabled = ec.artifactExecution.disableAuthz()
    try {
        const stream = ec.resource
            .getLocationReference(result.location)
            .openStream()
        try {
            for (let at = start; at <= end; ) {
                const bytes = stream.read(
                    at,
                    Math.min(RANGE_WINDOW, end - at + 1),
                )
                if (!bytes.length) break
                response.write(bytes)
                at += bytes.length
            }
        } finally {
            stream.close()
        }
    } finally {
        if (!wasDisabled) ec.artifactExecution.enableAuthz()
    }
}
;({
    call,
    download,
    downloadExport,
    downloadFile,
    downloadRanged,
    authorityClient,
    statusKind,
    servedType,
    sandboxed,
})
