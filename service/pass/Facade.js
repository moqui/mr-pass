/* PASS owns presentation and one configured authority, never a business replica. */
const schema = ec.resource.script('component://mr-pass/service/pass/Schema.js')
const fail = (kind, text) => {
    const e = new Error(text)
    e.moquiErrorKind = kind
    throw e
}
function call(operation, input) {
    const def = schema[operation]
    if (!def || Object.keys(input).some((k) => !def.fields.includes(k)))
        fail('Unprocessable', 'Unsupported operation or input')
    const backend = System.getProperty('pass_backend_url')
    if (!backend)
        return ec.service
            .sync()
            .throwOnError(true)
            .name(def.service)
            .parameters({ input })
            .call().result
    // The path/verb catalogue is packaged with PASS, so a remote frontend needs no Mantle metadata.
    const routes = ec.resource.script(
        'component://mr-pass/service/pass/Routes.js',
    )
    const route = routes.find(([method, path, op]) => op === operation)
    if (!route) fail('Unavailable', 'Remote operation is unavailable')
    const [method, pattern] = route,
        payload = { ...input }
    delete payload.siteId
    let path = pattern.replace(/\{([^}]+)\}/g, (_, name) => {
        const value = payload[name]
        delete payload[name]
        return encodeURIComponent(String(value || ''))
    })
    let url =
        String(backend).replace(/\/$/, '') +
        '/rest/s1/pass/v1/sites/' +
        encodeURIComponent(input.siteId) +
        '/' +
        path
    const client = ec.service.rest().uri(url).method(method).timeout(30)
    client.addHeader(
        'x-pass-client',
        System.getProperty('pass_client_id') || '',
    )
    const token = ec.web.sessionAttributes.passDelegation
    if (token) client.addHeader('authorization', 'Bearer ' + token)
    else if (method !== 'GET' && operation !== 'applyOptOut')
        fail('AuthenticationRequired', 'Sign in to continue')
    if (operation === 'stageAttachment') {
        if (!input.file || Number(input.file.size) > 10485760)
            fail('Unprocessable', 'Upload exceeds the size limit')
        const upload = client
            .multipart({
                file: input.file,
                contactListId: input.contactListId || '',
                purpose: input.purpose || 'post',
                draftId: input.draftId || '',
                altText: input.altText || '',
            })
            .send()
        if (Number(upload.statusCode) < 200 || Number(upload.statusCode) >= 300)
            fail(
                {
                    401: 'AuthenticationRequired',
                    403: 'Unauthorized',
                    404: 'NotFound',
                    409: 'Conflict',
                    422: 'Unprocessable',
                    429: 'Tarpit',
                }[Number(upload.statusCode)] || 'Unavailable',
                'Upload could not be completed',
            )
        return upload.jsonObject()
    }
    if (method === 'GET') {
        for (const [k, v] of Object.entries(payload))
            if (v != null) client.addBodyParameter(k, String(v))
    } else client.text(JSON.stringify(payload)).contentType('application/json')
    const response = client.call(),
        status = Number(response.statusCode)
    if (status === 401) {
        ec.web.sessionAttributes.remove('passDelegation')
        ec.web.sessionAttributes.remove('passSubject')
        if (method === 'GET' && token) return call(operation, input)
    }
    if (status < 200 || status >= 300)
        fail(
            {
                401: 'AuthenticationRequired',
                403: 'Unauthorized',
                404: 'NotFound',
                409: 'Conflict',
                422: 'Unprocessable',
                429: 'Tarpit',
            }[status] || 'Unavailable',
            'The authority could not complete this request',
        )
    return response.jsonObject()
}
function download(siteId, attachmentId, variant) {
    const backend = System.getProperty('pass_backend_url')
    if (!backend) {
        const result = call('getAttachment', {
            siteId,
            attachmentId,
            ...(variant ? { variant } : {}),
        })
        ec.web.response.setContentType(result.attachment.mimeType)
        ec.web.response.setHeader('Cache-Control', 'no-store')
        ec.web.response.setHeader('X-Content-Type-Options', 'nosniff')
        ec.web.response.setHeader(
            'Content-Disposition',
            (result.attachment.variant === 'thumbnail'
                ? 'inline'
                : 'attachment') +
                '; filename="' +
                String(result.attachment.filename).replace(/["\\\r\n]/g, '_') +
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
    const client = ec.service
        .rest()
        .uri(
            String(backend).replace(/\/$/, '') +
                '/rest/s1/pass/v1/sites/' +
                encodeURIComponent(siteId) +
                '/attachments/' +
                encodeURIComponent(attachmentId) +
                (variant ? '?variant=' + encodeURIComponent(variant) : ''),
        )
        .method('GET')
        .timeout(30)
        .followRedirects(false)
        .addHeader('x-pass-client', System.getProperty('pass_client_id') || '')
    if (ec.web.sessionAttributes.passDelegation)
        client.addHeader(
            'authorization',
            'Bearer ' + ec.web.sessionAttributes.passDelegation,
        )
    ec.web.response.forward(client.send(), {
        skipHeaders: ['set-cookie', 'x-csrf-token', 'moquisessiontoken'],
    })
}
;({ call, download })
