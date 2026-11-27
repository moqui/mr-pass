const A = 'org.moqui.public.AccountServices.'
const callAccount = (name, input) => call(A + name, { input }).result
const capture = ec.factory.getTool('MailCapture')
let accountId, verificationToken, staleToken, secret
function sys(work) {
    const was = ec.artifactExecution.disableAuthz()
    try {
        return work()
    } finally {
        if (!was) ec.artifactExecution.enableAuthz()
    }
}
function fails(work) {
    try {
        work()
        return ''
    } catch (e) {
        ec.message.clearErrors()
        return String(e.message || e)
    }
}
spec({
    stepwise: true,
    setupSpec() {
        login('john.doe')
        capture.enable()
        sys(() => {
            call('create#moqui.basic.email.EmailServer', {
                emailServerId: 'PASS_TEST_MAIL',
                smtpHost: 'smtp.example.test',
                smtpPort: 25,
            })
            call('create#moqui.basic.email.EmailTemplate', {
                emailTemplateId: 'PASS_TEST_VERIFY',
                emailServerId: 'PASS_TEST_MAIL',
                fromAddress: 'community@example.test',
                subject: 'Verify your address',
                bodyScreenLocation: 'component://mr-pass/test/Account/VerifyEmail.xml',
            })
        })
    },
    cleanupSpec() {
        capture.reset()
        login('john.doe')
    },
})
feature('registration stores a disabled account and only a token digest', {
    when() {
        logout()
        // Someone else asks first; the owner's own request replaces that challenge.
        callAccount('begin#Registration', {
            emailAddress: 'pass.identity@example.test',
        })
        // the mail goes on a worker (SEC-PSA-06)
        ec.factory.waitWorkerPoolEmpty(50)
        staleToken = capture.last().body.match(/[A-Za-z0-9_-]{64}/)[0]
        callAccount('begin#Registration', {
            emailAddress: 'pass.identity@example.test',
        })
        ec.factory.waitWorkerPoolEmpty(50)
        const message = capture.last()
        verificationToken = message.body.match(/[A-Za-z0-9_-]{64}/)[0]
        const account = ec.entity
            .find('moqui.security.UserAccount')
            .disableAuthz()
            .condition('emailAddress', 'pass.identity@example.test')
            .one()
        accountId = account.userId
        const challenge = ec.entity
            .find('moqui.security.public.RegistrationChallenge')
            .disableAuthz()
            .condition('userId', accountId)
            .condition('consumedAt', null)
            .one()
        return {
            disabled: account.disabled,
            hash: challenge.tokenHash,
            partyId: account.partyId,
            stale: fails(() =>
                callAccount('verify#Registration', {
                    token: staleToken,
                    newPassword: 'attacker1!!',
                }),
            ),
        }
    },
    then({ disabled, hash, partyId, stale }) {
        disabled === 'Y'
        hash !== verificationToken
        partyId === null
        stale.includes('expired')
    },
})
feature('verification is single use and registration adds no internal groups', {
    when() {
        const asked = callAccount('verify#Registration', {
            token: verificationToken,
        })
        const weak = fails(() =>
            callAccount('verify#Registration', {
                token: verificationToken,
                newPassword: 'short',
            }),
        )
        const result = callAccount('verify#Registration', {
            token: verificationToken,
            newPassword: 'moqui1!!',
        })
        const replay = fails(() =>
            callAccount('verify#Registration', {
                token: verificationToken,
                newPassword: 'moqui1!!',
            }),
        )
        const groups = ec.entity
            .find('moqui.security.UserGroupMember')
            .disableAuthz()
            .condition('userId', accountId)
            .condition('userGroupId', 'not-equals', 'ALL_USERS')
            .count()
        return { asked, weak, result, replay, groups }
    },
    then({ asked, weak, result, replay, groups }) {
        asked.passwordRequired === true
        weak.includes('policy')
        result.verified === true
        replay.includes('expired')
        groups === 0
    },
})
feature('a required second factor cannot be bypassed to issue a delegation', {
    when() {
        login('john.doe')
        sys(() =>
            call('create#moqui.security.UserAuthcFactor', {
                factorId: 'PASS_TEST_FACTOR',
                userId: accountId,
                factorTypeEnumId: 'UafSingleUse',
                factorOption: ec.user.singleUseCodeHash('12345678'),
                needsValidation: 'N',
                fromDate: Date.now() - 60000,
            }),
        )
        logout()
        const result = callAccount('start#Session', {
            username: 'pass.identity@example.test',
            password: 'moqui1!!',
        })
        const refusal = fails(() =>
            callAccount('issue#Delegation', {
                siteId: 'PASS_AUTH',
                clientId: 'test',
                clientSecret: 'test-deployment-secret',
            }),
        )
        const wrongCode = fails(() =>
            callAccount('complete#Session', { code: '00000000' }),
        )
        return { result, refusal, wrongCode }
    },
    then({ result, refusal, wrongCode }) {
        result.authenticated === false
        result.secondFactorRequired === true
        refusal.includes('Complete authentication')
        wrongCode.includes('Sign-in failed')
    },
})
feature('completing the factor issues a client and site scoped credential', {
    when() {
        const factor = callAccount('complete#Session', { code: '12345678' })
        const delegated = callAccount('issue#Delegation', {
            siteId: 'PASS_AUTH',
            clientId: 'test',
            clientSecret: 'test-deployment-secret',
        })
        secret = delegated.credential
        const row = ec.entity
            .find('moqui.security.public.DelegatedSession')
            .disableAuthz()
            .condition('userId', accountId)
            .one()
        const wrongClient = fails(() =>
            sys(() =>
                ec.resource
                    .script(
                        'component://framework/service/org/moqui/public/Account.js',
                    )
                    .authenticateDelegation(secret, 'other', 'PASS_AUTH'),
            ),
        )
        return { factor, delegated, digest: row.tokenHash, wrongClient }
    },
    then({ factor, delegated, digest, wrongClient }) {
        factor.authenticated === true
        delegated.credential.length === 64
        digest !== secret
        wrongClient.includes('expired')
    },
})
feature('backend account disable revokes an otherwise unexpired credential', {
    when() {
        sys(() => {
            const account = ec.entity
                .find('moqui.security.UserAccount')
                .condition('userId', accountId)
                .one()
            account.set('disabled', 'Y')
            account.update()
        })
        return {
            error: fails(() =>
                sys(() =>
                    ec.resource
                        .script(
                            'component://framework/service/org/moqui/public/Account.js',
                        )
                        .authenticateDelegation(secret, 'test', 'PASS_AUTH'),
                ),
            ),
        }
    },
    then({ error }) {
        error.includes('expired')
    },
})
feature('registration answers alike for a claimed address and one that cannot make an account (SEC-PSA-06)', {
    when() {
        sys(() => {
            call('create#moqui.security.UserAccount', {
                userId: 'PASS_ID_TAKEN',
                username: 'pass.taken@example.test',
                emailAddress: 'pass.taken.other@example.test',
                disabled: 'N',
            })
            // stored with capitals: the lookups ignore case, as create#UserAccount's own checks do
            call('create#moqui.security.UserAccount', {
                userId: 'PASS_ID_MIXED',
                username: 'Pass.MixedName@Example.test',
                emailAddress: 'Pass.Mixed@Example.test',
                disabled: 'N',
            })
        })
        logout()
        const fresh = callAccount('begin#Registration', {
            emailAddress: 'pass.fresh@example.test',
        })
        const claimed = callAccount('begin#Registration', {
            emailAddress: 'pass.identity@example.test',
        })
        const taken = fails(() =>
            callAccount('begin#Registration', {
                emailAddress: 'pass.taken@example.test',
            }),
        )
        const takenAnswer = taken
            ? null
            : callAccount('begin#Registration', {
                  emailAddress: 'pass.taken@example.test',
              })
        const mixed = fails(() =>
            callAccount('begin#Registration', { emailAddress: 'pass.mixed@example.test' }),
        )
        const mixedName = fails(() =>
            callAccount('begin#Registration', { emailAddress: 'pass.mixedname@example.test' }),
        )
        const accounts = sys(() =>
            ec.entity
                .find('moqui.security.UserAccount')
                .condition('username', 'in', ['pass.mixed@example.test', 'pass.mixedname@example.test'])
                .count(),
        )
        ec.factory.waitWorkerPoolEmpty(50)
        login('john.doe')
        return { fresh, claimed, taken, takenAnswer, mixed, mixedName, accounts }
    },
    then({ fresh, claimed, taken, takenAnswer, mixed, mixedName, accounts }) {
        taken === ''
        mixed === '' && mixedName === ''
        accounts === 0
        claimed.message === fresh.message
        takenAnswer.message === fresh.message
    },
})
feature('verification throttling survives failed challenge transactions', {
    when() {
        let last = ''
        for (let i = 0; i < 22; i++)
            last = fails(() =>
                callAccount('verify#Registration', {
                    token: 'invalid-throttle-fixture',
                }),
            )
        return { last }
    },
    then({ last }) {
        last.includes('Wait before requesting')
    },
})
