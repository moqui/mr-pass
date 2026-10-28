# PASS Forum deployment

## Components and authority

Use matching framework, Mantle, and PASS source changes. Use a package with image support for
thumbnails and SSO support when enabling providers; readiness reports missing capabilities. The
default Dev package omits those capabilities. An image-enabled incremental Dev build is
`./moq build -- --features moqui-host/image`; Enterprise/Maximal provide image and SSO support. The authority loads Mantle and the
framework security, wiki, entity, job, search, and mail facilities. A local PASS instance loads
the authority in the same runtime. A remote presentation runtime loads framework, webroot, and
PASS, with its own framework session database and no Mantle business entity catalog. It does
not need BOSS. Do not expose internal worker services through additional REST/RPC routes.

Leave `pass_backend_url` unset for local mode. For remote mode, set these properties on the
frontend through deployment configuration or environment variables:

| Property | Purpose |
| --- | --- |
| `pass_backend_url` | Fixed authority origin/base URL; use TLS in production |
| `pass_client_id` | Registered deployment ID |
| `pass_client_secret` | Server-side deployment secret |

On the authority, register `pass_client_<id>_secret` and comma-separated
`pass_client_<id>_sites`. Register the exact frontend SSO callback URI in
`pass_client_<id>_callback`, such as `https://forum.example.test/account/Sso`.
Delegations are hashed, revocable, site/client scoped, and expire after 15 minutes without use;
use in the last five minutes extends them, up to twelve hours from sign-in, after which sign-in is
required again. A failed write retains its draft and operation ID. Every authority call carries the
deployment's client ID and secret (a credential is refused from any other caller) and the browser's
address, which the authority trusts only from a registered client for its rate limits. Password changes, account
termination/disable, or ending the issuing visit invalidate delegations. Credentials and the
authority's second-factor cookie stay in the frontend's server-side session.

## Host and mount bindings

Configure the public routing allowlist on each presentation runtime:

```xml
<webapp-list><webapp name="webroot">
    <public-site host="forum.example.test" site-id="OPERATOR_ASSIGNED_SITE_ID"
            screen-location="component://mr-pass/screen/Pass.xml"
            resolver-service="pass.RouteServices.resolve#Route">
        <mount path="/forum" screen="Forum"/>
        <mount path="/account" screen="Account"/>
        <mount path="/members" screen="Members"/>
        <mount path="/sites" screen="Sites"/>
    </public-site>
</webapp></webapp-list>
```

Use the operator's `mantle.public.SiteServices.store#Mounts` operation to register the same host
and app paths at the authority. Hostnames are unique; mounts must not overlap or occupy framework,
API, authentication, token, asset, or operational paths. Only Forum may use `/`. Keep the runtime
allowlist aligned when changing mounts, and reload runtime configuration after changing it.
Unknown public hosts are concealed. The request cannot replace the routed site or configured
backend. Existing framework token routes retain their handlers.

At a trusted proxy, configure the framework's proxy/origin settings for the actual deployment.
Do not trust arbitrary forwarded authority headers or use a wildcard origin policy in production.
Cookie-authenticated changes require the framework session token. Return paths stay local; SSO
handoffs use the exact registered callback, browser state, a server-held verifier, and an expiring
single-use exchange code. Configure allowed provider IDs in `pass_sso_flows`; they reuse the
framework OIDC/OAuth facilities and account/second-factor policy. SAML remains unavailable where
the framework package does not provide it.

## Provisioning and publication

Provision through an authenticated operator context using
`mantle.public.SiteServices.create#Site` with `input: {name, ownerPartyId, locale, timeZone}`.
The owner must be an existing backend Party. Sites start disabled with registration closed.
Use the Sites screen or the typed site operations to set identity, host/app bindings, registration
policy, owners, and exact-version wiki guidelines/about bindings. Owners cannot remove the last
active owner. Role delegation requires reauthentication and a decision reason. Membership decisions require
a current revision; legacy mailbox changes advance that same revision. Bound category owners
also require an active replacement before leaving or losing their role.

Create categories through `mantle.forum.ForumServices.store#Category` with a durable `operationId`.
Preview their audience before explicitly publishing with the current category revision.
Ancestors impose access ceilings. Public, site-member, category-member, and help audiences use
the same evaluator as bound mailbox operations. Help members see their own participation.
Category publication is independent of the legacy list's `isPublic` flag.

Adopt existing mailboxes through `bind#Mailbox`, confirming the current audience. The conversion
job seeds chronological ordinals, retains event IDs and closed state, and writes revision
snapshots without historic notifications. Publication and new bound posts stay blocked until
reconciliation succeeds. For an unbound legacy mailbox, an operator may call the internal
`mantle.forum.BootstrapServices.start#Mailbox` service first. Inspect failed roots, repair their
source metadata, then retry the checkpointed job. Existing personal markers prevent silent
ordinal renumbering.

## Mail, accounts, and media

Configure a framework EmailServer and verification EmailTemplate, and set
`pass_verification_template`. The verification template receives `verificationToken`; render a
link/code for the deployment's Register page. Never put provider credentials in site records.
Public signup creates a disabled framework account. Verification is single-use; verified site
joining links/creates the backend Party without assigning an internal group. Invitation signup
requires its intended email and a valid invitation token.

Register comma-separated `pass_sender_addresses` and `pass_mail_template_ids` on the authority.
The selected template's configured sender must match the registered sender. Configure per-site
mail settings through the Mail screen. Notification templates receive `title`, `siteId`,
`rootCommEventId`, `postId`, and `unsubscribeUrl`. Forum email opt-out changes delivery preferences,
not membership or in-app notifications. First contributions default to two approvals, ten seconds
between posts, and New contribution limits of three topics/ten replies per day.

Set `pass_media_root` to private backend storage and `pass_scanner_service` to an internal service
accepting `location` and `mimeType`, returning Boolean `clean`. The scanner must inspect actual
bytes and reject unsafe/mismatched content. Missing/failed scanning quarantines content. Forum
uploads accept at most 10 MiB and the S1 raster image, PDF, and plain-text types. HTML/SVG and
programs are rejected. Uploaded files finalize only with the current actor's permitted post.
Profile images use the same scanner and private storage, finalize against a revision-protected profile,
and follow its current visibility. Replaced avatars and detached post attachments expire after
seven days. Downloads and PNG thumbnails recheck current parent access; storage paths are never public DTOs.
The shared outbound multipart transport rebuilds bounded bodies from server-owned uploads, and
remote downloads use the framework response forwarding facility.

## Workers and recovery

Seed jobs dispatch outbox delivery and mailbox/tracking conversions each minute and clean expired
staging each hour. Staged, unfinalized uploads expire after seven days. Framework jobs clean expired
account challenges and throttle buckets. Confirm that the normal scheduler is running.

Workers page recipients in batches of 100. Public members receive no per-post recipient rows;
only enabled accounts with an active non-ALL_USERS group qualify for internal MAILBOX receipts,
including named recipients and mentions. Group changes take effect on new writes immediately.
Checkpointed conversions preserve conservative unread boundaries and never fabricate historic
individual receipts.

Use Operations for backend checks, scan backlog, outbox lag, failures, and checkpoint recovery.
Use Mail to reconcile delivery outcomes with provider evidence. Explicit SMTP transient rejection
retries with bounded exponential backoff, up to five attempts. Permanent failures stop.
Interrupted/ambiguous sends remain uncertain and are not automatically resent. Confirm provider
acceptance or non-acceptance before recording the resolution; retries recheck current access.
Each independent failed item is named in logs and peers continue. Security checks, revision
conflicts, and atomic post transactions fail closed.

Pagination uses random, actor/scope-bound cursor records expiring after 15 minutes; tokens expose
no internal identity or offset fields. A scheduled job removes expired cursor records.

PASS responses use `no-store` for public/private personalized reading and protected media; there
is no shared anonymous response cache to invalidate. Visibility generations advance on relevant
changes. The stream polls for changes and clears inaccessible content. The S1 search reads the
authority's database and rechecks policy; legacy indexed mailbox hits are revalidated before
projection and stale aggregate counts are suppressed.

## Reproducing the remote check

Start an authority fixture on a dedicated loopback port:

```sh
./moq test mr-pass --nobuild --spec ClientFixtures --db snapshot --serve 127.0.0.1:18091
```

Create a separate scratch runtime containing only symlinks to framework, webroot, tools, and PASS.
Copy the normal runtime configuration needed for the frontend and add the remote properties above,
using the isolated test client ID/secret from `test/MoquiConf.xml`. Do not copy Mantle or BOSS into
that runtime. Run `RemoteFixtures` with `MOQUI_RUNTIME` set to that directory, its remote conf,
and `--serve 127.0.0.1:18092`; it asserts the Mantle entity catalog is absent. Then run:

```sh
./moq test-client runtime/component/mr-pass/test/client/RemoteHttp.spec.js --nobuild --server http://127.0.0.1:18092
```

The test authenticates through the authority, saves a private draft, uploads/scans/publishes media,
downloads it through the frontend, then revokes anonymous access and verifies concealment. It
also uploads a profile image and verifies that changing profile visibility conceals the image.
Stop both disposable servers after the run. Live SMTP, IdP, DNS/TLS, and production scanner checks
remain deployment-specific; the specs use captured mail, a deterministic scanner, and isolated data.
