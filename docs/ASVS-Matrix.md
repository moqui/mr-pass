# PASS: ASVS 5.0.0 matrix

PASS's standing against the OWASP Application Security Verification Standard (ASVS) 5.0.0 at levels 1 and 2: PASS
here is mr-pass with the Mantle services its operations reach. The framework's own matrix, how to read it and what the
statuses mean are in mr-moqui's [security proofs](https://github.com/moqui/mr-moqui/blob/master/docs/security/proofs/README.md);
the plan is mr-moqui's [Proofs-Initial](https://github.com/moqui/mr-moqui/blob/master/plans/Proofs-Initial.md).

Status 2026-11-18: one reading of the code at mr-pass `d2dfa67`, mr-mantle `dff2c9fe` and mr-moqui `bf7034ec9`,
with the findings recorded as fixed since then (SEC-PFS-82) taken in. PASS's own black-box proofs are in `test/proofs/` (`moqui test-client mr-pass --proofs`), named in the Proof column by spec and feature; its in-process proofs are server specs of `test/`, named `mr-pass <Spec>`. The topic of each row is in our words; the requirement's own text is in
[ASVS 5.0.0](https://github.com/OWASP/ASVS/tree/v5.0.0/5.0/en) (© The OWASP Foundation, CC BY-SA 4.0, cited by id
and not copied).

| Status | Meaning |
| --- | --- |
| Inherited | The framework's status carries over; PASS changes nothing. The row names the framework's status and links to it. |
| PASS | PASS's own code meets it; the evidence names where. |
| Configuration | Met when the operator sets something. |
| Gap | Not met today. |
| N/A | Does not apply to PASS, with the reason. |

Counts: 98 inherited, 56 met by PASS, 9 configuration, 53 gaps,
37 not applicable, of 253. An inherited row whose framework status is a Gap is a gap for PASS too.

## V1 Encoding and Sanitization

| Requirement | L | Topic | Status | Evidence | Proof |
| --- | --- | --- | --- | --- | --- |
| v5.0.0-1.1.1 | 2 | Decode input once, before any check | Inherited | framework: Framework ([V1](https://github.com/moqui/mr-moqui/blob/master/docs/security/proofs/V1-Encoding-and-Sanitization.md)) | - |
| v5.0.0-1.1.2 | 2 | Escape output last, at its consumer | PASS | `.html.fancy` pages escape at render; string-built HTML escapes as it is built (`Account/Hub.js` `esc`, `Shop/ShopCart.js` `escapeText`) | mr-pass Smithy spec "Search is reached by its request path ... it escapes what was asked and what it found ..." |
| v5.0.0-1.2.1 | 1 | Encoding fit to HTML, attribute and header contexts | PASS | `.html.fancy` escapes at render; `Account/Hub.js` puts every text and input name through `esc`; `Billing/InvoicePay.xml`'s inline text writes its values through `html()` (SEC-PSF-86 fixed) | - |
| v5.0.0-1.2.2 | 1 | Encoded values and safe schemes in built URLs | PASS | hrefs are local paths or `https` (`Shared/View.js` `link.href`); a return's `trackingUrl` and an event's `joinUrl` only as https (mr-mantle EntityLib `httpsUrl`, SEC-PSF-84 fixed); the shell's `canonicalUrl` is set by `Pass.xml`, never by a request (SEC-PSF-85 fixed) | mr-mantle EventRegistrations "with the seller's approval setting on, ..." (the join link); mr-pass SupportAccess "a contact reads its own cases ..." |
| v5.0.0-1.2.3 | 1 | Encoding for data put into script or JSON | PASS | `Shop/Catalog.js` `dataJson` escapes `<`, and `withHead` inserts the JSON-LD by a replacement function (SEC-PSF-87 fixed) | mr-pass ShopCatalog "a product's text with a replacement pattern goes into the head as it is (SEC-PSF-87)" |
| v5.0.0-1.2.4 | 1 | Bound parameters against SQL and query injection | Inherited | framework: Framework ([V1](https://github.com/moqui/mr-moqui/blob/master/docs/security/proofs/V1-Encoding-and-Sanitization.md)); entity finds only; no raw SQL in mr-pass or the PASS Mantle services (grep) | - |
| v5.0.0-1.2.5 | 1 | No shell command injection | Inherited | framework: Framework ([V1](https://github.com/moqui/mr-moqui/blob/master/docs/security/proofs/V1-Encoding-and-Sanitization.md)); no process started by mr-pass or the PASS services (grep) | - |
| v5.0.0-1.2.6 | 2 | Directory (LDAP) query injection | N/A | framework | - |
| v5.0.0-1.2.7 | 2 | XML path query injection | N/A | framework | - |
| v5.0.0-1.2.8 | 2 | TeX processor hardening | N/A | framework | - |
| v5.0.0-1.2.9 | 2 | Regex metacharacters escaped when patterns use data | PASS | word rules escaped (`forum/ForumCore.js` `escapeRegex`, `ForumModeration.js:376`); an owner's regex rule is a pattern by design, matched in linear time by the framework's `StringUtilities.regexTest` (SEC-PFS-90 fixed) | mr-pass Moderation spec "rules test safely and block, hold, flag or censor posts" |
| v5.0.0-1.3.1 | 1 | Rich-text HTML cleaned by a vetted sanitizer | PASS | posts cleaned at write and read (`ForumCore.js` `renderSource`), bios (`View.js`), shown in `m-html-view` with DOMPurify (map); SEC-PSF-81, SEC-PSF-09 (open) | `the_rich_text_editor_output_survives_the_safe_cleaning` (`service/validate.rs`); mr-pass Forum "write is idempotent and body is sanitized" |
| v5.0.0-1.3.2 | 1 | No eval or dynamic code over user input | PASS | mr-pass loads only fixed `component://` scripts (`service/pass/Facade.js`); theme `${}` runs only in the locked renderer (`Shop/ShopTheme.js`); site pages and Smithy's repository text are Markdown through `ec.resource.markdownHtml`, then `cleanHtml` (mr-mantle `SitePages.js`, `SmithySite.js`), posts cleaned (`ForumCore.js` `renderSource`), never a template; no `expand`, `template` or `script` over a user's text in mr-pass or the PASS services (grep); Smithy pipelines run on the CI engine's runners, not in the server | mr-pass TextNotCode "v5.0.0-1.3.2: a post's expressions and template directives stay text when saved, read and shown" |
| v5.0.0-1.3.3 | 2 | Character and length limits before risky sinks | PASS | schema checks: unknown field 422, Smithy strings 4,096 and 200,000 chars (`smithy/Smithy.js` `execute`); upload names `[a-zA-Z0-9_ -]`, 90 chars (`party/PortalMedia.js`, map) | mr-pass Marketing SubmitForm "an answer is kept once; over the client's limit, oversized or naming an unknown field ..." |
| v5.0.0-1.3.4 | 2 | Scriptable SVG from users cleaned | Gap | SEC-PFS-87 (Low: an imported forum attachment keeps `image/svg+xml`, uncleaned, served with its stored type in local mode); uploads refuse SVG; theme SVG cleaned when served (`ShopTheme.js:346`); Smithy raw sends SVG as text (map) | - |
| v5.0.0-1.3.5 | 2 | User Markdown, CSS and similar markup made safe | Gap | SEC-SCR-90 reaches Shop theme CSS; Markdown rendered then cleaned (`ForumCore.js` `renderSource`; site pages `cleanHtml`, map) | - |
| v5.0.0-1.3.6 | 2 | Outbound request forgery: destinations held to a list | Gap | SEC-PSS-82 (Medium: a product content row's location, any file or URL, is read and shown to visitors); mirrors `https` and the framework guard; GitHub API base from conf (map) | - |
| v5.0.0-1.3.7 | 2 | Templates never assembled from untrusted text | PASS | a theme renders only in the locked renderer, checked by `script/theme/expr.rs` and `markup.rs`; open: SEC-PSS-63 (Info), SEC-SCR-82 and -83 (crash and memory, likely) | mr-mantle ThemeAuthoring "a script or an onclick in a template is refused with its file and line ..."; `urls_forms_and_assembled_expressions` (`script/theme/tests.rs`) |
| v5.0.0-1.3.8 | 2 | Java naming lookup injection | N/A | framework | - |
| v5.0.0-1.3.9 | 2 | Cache server (memcache) injection | N/A | framework | - |
| v5.0.0-1.3.10 | 2 | Format strings from untrusted text | Inherited | framework: Framework ([V1](https://github.com/moqui/mr-moqui/blob/master/docs/security/proofs/V1-Encoding-and-Sanitization.md)) | - |
| v5.0.0-1.3.11 | 2 | Mail header and mailbox command injection | Inherited | framework: Framework ([V1](https://github.com/moqui/mr-moqui/blob/master/docs/security/proofs/V1-Encoding-and-Sanitization.md)); forum mail goes through `send#EmailTemplate` (map) | - |
| v5.0.0-1.4.1 | 2 | Memory-safe string and buffer handling | Inherited | framework: Framework ([V1](https://github.com/moqui/mr-moqui/blob/master/docs/security/proofs/V1-Encoding-and-Sanitization.md)); PASS is script on that engine | - |
| v5.0.0-1.4.2 | 2 | Integer overflow avoided | Inherited | framework: Framework ([V1](https://github.com/moqui/mr-moqui/blob/master/docs/security/proofs/V1-Encoding-and-Sanitization.md)) | - |
| v5.0.0-1.4.3 | 2 | No use after free or dangling pointers | Inherited | framework: Framework ([V1](https://github.com/moqui/mr-moqui/blob/master/docs/security/proofs/V1-Encoding-and-Sanitization.md)) | - |
| v5.0.0-1.5.1 | 1 | XML parsers refuse external entities | Inherited | framework: Framework ([V1](https://github.com/moqui/mr-moqui/blob/master/docs/security/proofs/V1-Encoding-and-Sanitization.md)) | - |
| v5.0.0-1.5.2 | 2 | Untrusted data deserialized safely | Inherited | framework: Framework ([V1](https://github.com/moqui/mr-moqui/blob/master/docs/security/proofs/V1-Encoding-and-Sanitization.md)) | - |

## V2 Validation and Business Logic

| Requirement | L | Topic | Status | Evidence | Proof |
| --- | --- | --- | --- | --- | --- |
| v5.0.0-2.1.1 | 1 | Documented format rules for each input item | Gap | likely: `ForumSchema.js`/`SmithySchema.js` list field names only; PASS's Mantle services take one untyped `input` map; the Apps-PASS maps record some rules as read from code (map) | - |
| v5.0.0-2.1.2 | 2 | Documented rules for consistency across related fields | Gap | none found in `plan/design-*.md` or the Apps-PASS maps | - |
| v5.0.0-2.1.3 | 2 | Documented business limits, per user and overall | PASS | Apps-PASS, -Commerce and -Forum-Smithy maps give each operation's per-requester, per-address and per-site limits (map) | V2Validation "v5.0.0-2.1.3: account recovery holds its documented limit of three requests an address" |
| v5.0.0-2.2.1 | 1 | Input checked against declared allowed forms | PASS | `Facade.js` and `PassAuthority.js` schema fields (422 otherwise); `Forum.js`/`Smithy.js` `execute` types and lengths; Shop quantity 1-999, rating 1-5, address lengths (map) | PASS: mr-mantle `pass/PassAuthority` "an operation runs its schema service and a field the schema does not list is the envelope's 422" |
| v5.0.0-2.2.2 | 1 | Validation enforced on the server, not client | PASS | the authority's `run()` and each Mantle service check the input again; frontend checks are repeated there | mr-moqui V6Authentication "v5.0.0-6.2.1: a new password shorter than the minimum length is refused"; PASS: mr-mantle `pass/PassAuthority` "an operation runs its schema service and a field the schema does not list ..." |
| v5.0.0-2.2.3 | 2 | Related fields checked to fit together | Gap | seen: `ShopCustomer.js:611-613` and `ShopCheckout.js:772-779` take any existing `Geo` as the state, not one of the chosen country; quote, delivery and return lines are checked against the order (map) | - |
| v5.0.0-2.3.1 | 1 | Multi-step flows run in order, no skips | PASS | one `StoreCheckout` row per cart with revision and terms version; `place#Order` only after approval at the frozen total (`ShopCheckout.js`); registration payment needs live holds (map) | PASS: mr-mantle `order/ShopCheckout` "an order changed after its submit is not placed; its approved payment is kept for staff" |
| v5.0.0-2.3.2 | 2 | Business limits enforced as documented | Gap | SEC-PSS-81, SEC-PSS-85, SEC-PSS-86, SEC-PFS-92, SEC-PFS-93 (open) | - |
| v5.0.0-2.3.3 | 2 | Business operations commit whole or roll back | PASS | Mantle services run in the service transaction; fulfillment steps each in their own with held rows; a placement after the provider's success kept for the job (map) | `a_body_failure_is_recorded_rolled_back_and_returns_empty_results` (`service/call_tests.rs`); PASS: mr-mantle `order/ShopCheckout` "a placement that fails after the provider's success keeps the payment and attempt ..." |
| v5.0.0-2.3.4 | 2 | Locks keep scarce things from being sold twice | PASS | event places held under the offer's and tickets' row locks (map); promotion and code limits under locked rows (`StorePromotions.js:994-1006`); checkout under the order's lock (`ShopCheckout.js:602`) | PASS: mr-mantle `work/EventRegistrations` "six requests at once for the last two seats: ... never more seats than the offer has" |
| v5.0.0-2.4.1 | 2 | Rate limits against automated excessive calls | Gap | per-requester `record#Attempt` limits on most writes; open SEC-PSS-84, SEC-PSS-88, SEC-PSS-89, SEC-PFS-92, SEC-PFS-93 | - |

## V3 Web Frontend Security

| Requirement | L | Topic | Status | Evidence | Proof |
| --- | --- | --- | --- | --- | --- |
| v5.0.0-3.2.1 | 1 | API answers and user files never shown in a page context | PASS | `Facade.js` `servedType`, `sandboxed`, `SANDBOX`; `PassApi.js` `SANDBOX`; Smithy raw route sandboxed; local `getAttachment` and `getExport` keep the stored type but as attachment (map) | Rust `web::tests::a_users_download_has_an_inert_type_and_the_sandbox`; mr-pass Smithy "raw serves a file as plain text or a download, never as a page ...", "a release's file is answered as an inert type with a sandbox ..." |
| v5.0.0-3.2.2 | 1 | Text put in the page as text, never as markup | PASS | islands on Vue's runtime build, posts in `m-html-view` (map); the one `v-html` is `Smithy/Islands/Composer.qvue:26`, a preview meant as HTML | V3WebFrontend "v5.0.0-3.2.2: the topic island shows a member's display name as text, never markup" |
| v5.0.0-3.3.1 | 1 | Cookies are Secure and named `__Host-` or `__Secure-` | Gap | `mkt_vk` has no prefix (`script/TrackingLib.js:59`); the framework's cookies | - |
| v5.0.0-3.3.2 | 2 | SameSite chosen for each cookie's purpose | PASS | `mkt_vk` `SameSite=Lax` (`TrackingLib.js:59`); the framework's cookies | mr-moqui V3WebFrontend "v5.0.0-3.3.2: the session cookie is SameSite=Lax"; SecurityDevice "a registration code makes one browser the device, once, with an HttpOnly SameSite=Strict cookie" |
| v5.0.0-3.3.3 | 2 | Cookies named `__Host-` unless meant for other hosts | Gap | `mkt_vk` (`TrackingLib.js:59`); the framework's cookies | - |
| v5.0.0-3.3.4 | 2 | Session cookie HttpOnly, its value sent only by Set-Cookie | PASS | `mkt_vk` HttpOnly; the authority's cookie stays in the frontend session (`passAuthorityCookie`), forwarded downloads drop `Set-Cookie` (map) | mr-moqui V3WebFrontend "v5.0.0-3.3.4: the session cookie is HttpOnly, out of reach of page scripts" |
| v5.0.0-3.4.1 | 1 | HSTS on every answer, a year, subdomains | Inherited | framework: Gap ([V3](https://github.com/moqui/mr-moqui/blob/master/docs/security/proofs/V3-Web-Frontend-Security.md)) | - |
| v5.0.0-3.4.2 | 1 | CORS answers only listed origins; wildcard never credentialed | Inherited | framework: Framework ([V3](https://github.com/moqui/mr-moqui/blob/master/docs/security/proofs/V3-Web-Frontend-Security.md)); framework; `PassApi.js` sets no CORS header | - |
| v5.0.0-3.4.3 | 2 | Global CSP: object-src and base-uri none, source allowlist | PASS | `screen/Shared/Headers.js` `CSP`: default-src and script-src `'self'`, no `'unsafe-eval'`, object-src `'none'` (SEC-PSF-04 fixed), base-uri `'none'` (SEC-PSF-90 fixed); the theme preview's own policy has base-uri `'none'` (`Shop/ShopPreview.js` `headers`) | mr-pass ShopAccess "an unpublished site or a disabled mount conceals the Shop; published, the root shows the store with the brand" |
| v5.0.0-3.4.4 | 2 | nosniff on every answer | Inherited | framework: Gap ([V3](https://github.com/moqui/mr-moqui/blob/master/docs/security/proofs/V3-Web-Frontend-Security.md)); framework; PASS pages, `PassApi.js:306`, downloads and tracking set it | - |
| v5.0.0-3.4.5 | 2 | A referrer policy keeps URLs from other sites | Gap | `Referrer-Policy: same-origin` on every page (`Headers.js` `apply`), `no-referrer` on tracking; a theme overrides it (SEC-PSF-83, SEC-SCR-91) | - |
| v5.0.0-3.4.6 | 2 | CSP frame-ancestors on every answer | Gap | every page `frame-ancestors 'none'` (`Headers.js`); the download and theme asset policies (`Facade.js` and `PassApi.js` `SANDBOX`, theme asset CSP (map)) have none | - |
| v5.0.0-3.5.1 | 1 | Cross-origin calls to sensitive functions need forgery proof | PASS | `mr-mantle/script/PassApi.js:295-303` (`x-csrf-token`, registered client, bearer, key header); PASS transitions keep the framework token | mr-moqui V3WebFrontend "v5.0.0-3.5.1: a POST changes data only with the session's anti-forgery token (csrf: #csrf)"; mr-moqui V3WebFrontend "v5.0.0-3.5.1: an entity REST POST without the session token is refused and creates nothing"; PASS: V3WebFrontend "v5.0.0-3.5.1: a PASS settings form saves only with the session's anti-forgery token", "v5.0.0-3.5.1: the authority API refuses a cookie-borne form post without the token header" |
| v5.0.0-3.5.2 | 1 | Preflight-based defence not passed by simple requests | Inherited | framework: Framework ([V3](https://github.com/moqui/mr-moqui/blob/master/docs/security/proofs/V3-Web-Frontend-Security.md)); framework; key and bearer writes need headers a browser preflights | - |
| v5.0.0-3.5.3 | 1 | No sensitive actions on GET, HEAD or OPTIONS | Gap | SEC-PSF-81; `Account/Sso` and `Marketing/Page?tc=` write on a GET (map) | - |
| v5.0.0-3.5.4 | 2 | Separate applications on separate host names | Configuration | site hosts as in `runtime/conf/MoquiSitesConf.xml` with `framework-routes="refuse"`; the authority REST stays on the business host (map) | V3WebFrontend "v5.0.0-3.5.4: a site's own host serves its apps and none of the framework's routes" |
| v5.0.0-3.5.5 | 2 | postMessage from untrusted origins or malformed dropped | PASS | `screen/Shop/ShopPreview.js:160` (parent source, `ok(e.origin)`, nonce, `type`) | V3WebFrontend "v5.0.0-3.5.5: the theme preview drops every message but its editor's well-formed one"; mr-boss ThemeEditorWalk (acceptance) "the preview answers only the editor's origin and nonce, and its host serves only the preview" (the real editor, and a live shop host that frames the preview) |
| v5.0.0-3.7.1 | 2 | Only supported, current client-side technologies | PASS | islands on Vue's runtime build; `object-src 'none'` (`Headers.js`) | V3WebFrontend "v5.0.0-3.7.1: PASS pages load only their own scripts, current Vue and Quasar, no plugins" |
| v5.0.0-3.7.2 | 2 | Off-site automatic redirects only to allowlisted hosts | PASS | `returnTo` kept only as a local path; a tracking link's destination checked when saved (`store#TrackingLink`); SSO callback from the client's conf (map) | mr-moqui V3WebFrontend "v5.0.0-3.7.2: the sign-in follows a returnTo on the site and never one off it"; mr-moqui V3WebFrontend "v5.0.0-3.7.2: the sign-in does not redirect off the site under a forged Host"; PASS: V3WebFrontend "v5.0.0-3.7.2: PASS's sign-in follows a returnTo on the site, never one off it" |

## V4 API and Web Service

| Requirement | L | Topic | Status | Evidence | Proof |
| --- | --- | --- | --- | --- | --- |
| v5.0.0-4.1.1 | 1 | Content-Type matches the body and names a charset | Inherited | framework: Gap ([V4](https://github.com/moqui/mr-moqui/blob/master/docs/security/proofs/V4-API-and-Web-Service.md)); framework; `PassApi.js` JSON without charset | - |
| v5.0.0-4.1.2 | 2 | Only browser pages redirect HTTP to HTTPS | Inherited | framework: Gap ([V4](https://github.com/moqui/mr-moqui/blob/master/docs/security/proofs/V4-API-and-Web-Service.md)); framework `/rest`; `PassApi` is a script servlet, not redirected (likely) | - |
| v5.0.0-4.1.3 | 2 | Clients cannot override headers a proxy sets | Configuration | framework; `x-pass-client-ip` passed by `PassApi.js:318`, used only for a registered client (map) | V4ApiWebService "v5.0.0-4.1.3: a visitor address header counts only from the registered PASS frontend" |
| v5.0.0-4.2.1 | 2 | HTTP message boundaries resist request smuggling | Inherited | framework: Framework ([V4](https://github.com/moqui/mr-moqui/blob/master/docs/security/proofs/V4-API-and-Web-Service.md)) | - |
| v5.0.0-4.3.1 | 2 | GraphQL queries limited by depth, amount or cost | N/A | no GraphQL | - |
| v5.0.0-4.3.2 | 2 | GraphQL introspection off in production | N/A | no GraphQL | - |
| v5.0.0-4.4.1 | 1 | WebSockets only over TLS | Inherited | framework: Configuration ([V4](https://github.com/moqui/mr-moqui/blob/master/docs/security/proofs/V4-API-and-Web-Service.md)); `Smithy/Islands/JobLog.qvue:49` the same | - |
| v5.0.0-4.4.2 | 2 | WebSocket handshake Origin checked against an allowlist | Inherited | framework: Framework ([V4](https://github.com/moqui/mr-moqui/blob/master/docs/security/proofs/V4-API-and-Web-Service.md)); framework `/notws` | - |
| v5.0.0-4.4.3 | 2 | Dedicated WebSocket tokens follow session rules | Inherited | framework: Framework ([V4](https://github.com/moqui/mr-moqui/blob/master/docs/security/proofs/V4-API-and-Web-Service.md)) | - |
| v5.0.0-4.4.4 | 2 | WebSocket tokens come from the authenticated HTTPS session | Inherited | framework: Framework ([V4](https://github.com/moqui/mr-moqui/blob/master/docs/security/proofs/V4-API-and-Web-Service.md)) | - |

## V5 File Handling

| Requirement | L | Topic | Status | Evidence | Proof |
| --- | --- | --- | --- | --- | --- |
| v5.0.0-5.1.1 | 2 | Documented upload types, sizes and safe serving | PASS | Apps-PASS maps give each upload's types and size (`PortalMedia.js` PDF/PNG/JPEG 10 MiB, forum six types, review photos, theme package), the download rule and the scanner's refusal (map) | V5FileHandling "v5.0.0-5.1.1: a forum upload of an undocumented type or an empty one is refused" |
| v5.0.0-5.2.1 | 1 | Upload size bounded to what server handles | Gap | inherits SEC-RTE-82 on PASS pages; own: 10 MiB in `PortalMedia.js` `stage` and `Forum.js` `stageAttachment`; `PassApi` `max-upload="11m"` (`mr-mantle/MoquiConf.xml:57`) | - |
| v5.0.0-5.2.2 | 1 | Upload extension and content match expected type | Gap | `Forum.js` `stageAttachment` (:2550-2562) trusts the declared type and keeps the given extension; `PortalMedia.js` `sniff` checks Supplier, Support and review files | - |
| v5.0.0-5.2.3 | 2 | Archive size and entry limits before expanding | PASS | no public upload is expanded: of mr-pass's scripts and the Mantle packages PASS's operations reach only `ForumImport.js` `stage#Import` (an operator's archive, from `pass@import-dir` only) and Commerce's theme package import (staff, its own byte and file bounds, no PASS operation) unpack an archive; `stage#Import` passes `pass@import-max-bytes` (2 GiB) and `pass@import-max-entries` (200,000) to the archive and its dump (SEC-PFS-112 fixed) | mr-pass SourceRules "v5.0.0-5.2.3: PASS unpacks no archive a visitor sends, only an operator's import"; mr-pass Import "an operator registers a checksummed archive from the import directory only" |
| v5.0.0-5.3.1 | 1 | Stored uploads never run as server code | Inherited | framework: Framework ([V5](https://github.com/moqui/mr-moqui/blob/master/docs/security/proofs/V5-File-Handling.md)); SEC-PFS-82 fixed: release notes and files go under the `mantle@content-root` setting, not a preference | - |
| v5.0.0-5.3.2 | 1 | File paths built from trusted data, not names | Gap | SEC-PSS-82 (a product content row names any file or URL and Shop publishes it); SEC-PFS-82 fixed | - |
| v5.0.0-5.4.1 | 2 | Download name set by server in Content-Disposition | PASS | download locations only from stored rows (map); `Facade.js` names from the stored row; upload names cleaned (`PortalMedia.js`, `Forum.js`) | mr-moqui V5FileHandling "v5.0.0-5.4.2: a quote in a requested file name stays inside one Content-Disposition"; PASS: V5FileHandling "v5.0.0-5.4.1: a download's file name is the server's, whatever the request names" |
| v5.0.0-5.4.2 | 2 | Served file names encoded against header injection | PASS | `Facade.js` replaces `"`, `\`, CR, LF in the quoted name; no `filename*` | mr-moqui V5FileHandling "v5.0.0-5.4.2: a quote in a requested file name stays inside one Content-Disposition"; PASS: V5FileHandling "v5.0.0-5.4.2: a file's uploaded name cannot add a header or a parameter to its download" |
| v5.0.0-5.4.3 | 2 | Untrusted files scanned for malware | Configuration | `pass@scanner-service` (none ships; uploads refused while empty; `pass@test-scanner` is a test stub) | V5FileHandling "v5.0.0-5.4.3: an upload the scanner flags stays in quarantine, never posted or served" (the fixtures' test scanner; a deployment's with the EICAR test file) |

## V6 Authentication

| Requirement | L | Topic | Status | Evidence | Proof |
| --- | --- | --- | --- | --- | --- |
| v5.0.0-6.1.1 | 1 | Brute-force defenses and lockout abuse documented | PASS | `Attack-Surface-Apps-PASS.md` "Public accounts", Limits (SEC-PSA-01) | the document (a documentation requirement): `Attack-Surface-Apps-PASS.md` "Public accounts", Limits; the framework's `Attack-Surface-Web.md` "Login lockout and passwords" |
| v5.0.0-6.1.2 | 2 | Documented list of banned context words | Gap | no list for PASS (none seen) | - |
| v5.0.0-6.1.3 | 2 | All sign-in pathways documented with their strength | PASS | `Attack-Surface-Apps-PASS.md` "Public accounts": sign-in, delegations, SSO handoff, business-host sign-in, git tokens | the document (a documentation requirement): `Attack-Surface-Apps-PASS.md` "Public accounts" |
| v5.0.0-6.2.1 | 1 | Minimum password length | Inherited | framework: Framework ([V6](https://github.com/moqui/mr-moqui/blob/master/docs/security/proofs/V6-Authentication.md)); `public/Account.js` `passwordAllowed`, then `update#PasswordInternal` | - |
| v5.0.0-6.2.2 | 1 | Users can change their password | PASS | `public/Account.js` `manage#Account` action `password`; mr-pass `screen/Account/Settings.xml` | V6Authentication "v5.0.0-6.2.2: a PASS account changes its password on Settings; only the new one signs in" |
| v5.0.0-6.2.3 | 1 | Change asks current and new password | Inherited | framework: Framework ([V6](https://github.com/moqui/mr-moqui/blob/master/docs/security/proofs/V6-Authentication.md)); `manage#Account` passes `oldPassword` to `update#Password` | - |
| v5.0.0-6.2.4 | 1 | New passwords screened against common passwords | Inherited | framework: Gap ([V6](https://github.com/moqui/mr-moqui/blob/master/docs/security/proofs/V6-Authentication.md)); framework (Gap) | - |
| v5.0.0-6.2.5 | 1 | No character-class composition rules | Inherited | framework: Gap ([V6](https://github.com/moqui/mr-moqui/blob/master/docs/security/proofs/V6-Authentication.md)); framework (Gap); `public/Account.js` `passwordAllowed` repeats the class rules | - |
| v5.0.0-6.2.6 | 1 | Password fields masked | Inherited | framework: Framework ([V6](https://github.com/moqui/mr-moqui/blob/master/docs/security/proofs/V6-Authentication.md)); mr-pass `Account/Login.xml`, `Register.xml`, `Settings.xml` use `<password/>` | - |
| v5.0.0-6.2.7 | 1 | Paste and password managers allowed | Inherited | framework: Framework ([V6](https://github.com/moqui/mr-moqui/blob/master/docs/security/proofs/V6-Authentication.md)); framework widget | - |
| v5.0.0-6.2.8 | 1 | Password checked exactly as entered | Inherited | framework: Framework ([V6](https://github.com/moqui/mr-moqui/blob/master/docs/security/proofs/V6-Authentication.md)) | - |
| v5.0.0-6.2.9 | 2 | Passwords of 64+ characters accepted | Inherited | framework: Framework ([V6](https://github.com/moqui/mr-moqui/blob/master/docs/security/proofs/V6-Authentication.md)) | - |
| v5.0.0-6.2.10 | 2 | No forced periodic password rotation | Inherited | framework: Configuration ([V6](https://github.com/moqui/mr-moqui/blob/master/docs/security/proofs/V6-Authentication.md)); framework (Configuration) | - |
| v5.0.0-6.2.11 | 2 | Context word list enforced on new passwords | Gap | none | - |
| v5.0.0-6.2.12 | 2 | New passwords screened against breached passwords | Inherited | framework: Gap ([V6](https://github.com/moqui/mr-moqui/blob/master/docs/security/proofs/V6-Authentication.md)); framework (Gap) | - |
| v5.0.0-6.3.1 | 1 | Anti brute-force and stuffing controls | Configuration | PASS's own: `public/Account.js` `throttle('session')` on every PASS sign-in (the site's form, the authority's `account/session` and `account/challenge`): 10 per name from any client and 20 per requester in 10 minutes, answered 429, no address exempt (SEC-PSA-01 fixed), beside the framework's lock of an account after failed passwords; Configuration: the framework's per-client `login` rate limit (web-protection, ten a minute) names the authority's two routes, not the site's form; the same accounts sign in at business-host `/Login` under the framework's rules | V6Authentication "v5.0.0-6.3.1: PASS's sign-in refuses an account name after ten tries, from any client", "v5.0.0-6.3.1: one client's sign-ins at PASS's route are limited after ten a minute" (opt-in, a deployment's) |
| v5.0.0-6.3.2 | 1 | No default or well-known accounts usable | Inherited | framework: Framework ([V6](https://github.com/moqui/mr-moqui/blob/master/docs/security/proofs/V6-Authentication.md)); framework; mr-pass ships no accounts | - |
| v5.0.0-6.3.3 | 2 | Multi-factor sign-in required | Configuration | the same flag gives public accounts an emailed code (`UserAccountEmail`); no factor enrollment on PASS pages | V6Authentication "v5.0.0-6.3.3: an account required to use a second factor never signs in by password alone" (a deployment's with --param mfa=required) |
| v5.0.0-6.3.4 | 2 | Every pathway documented, strength consistent | Inherited | framework: Gap ([V6](https://github.com/moqui/mr-moqui/blob/master/docs/security/proofs/V6-Authentication.md)); framework (Gap); delegations and the SSO handoff follow a full sign-in | - |
| v5.0.0-6.4.1 | 1 | System-made initial secrets random, brief, one-time | PASS | `public/Account.js` `beginRegistration`, `verifyRegistration`: 64-character token, digest kept, 1 hour, consumed once; placeholder password nobody knows | `login_tests.rs` `the_old_password_of_a_change_is_behind_the_login_gate` (reset expiry); PASS: V6Authentication "v5.0.0-6.4.1: a registration code works once, not after expiry, and never as a password" |
| v5.0.0-6.4.2 | 1 | No password hints or secret questions | Inherited | framework: Framework ([V6](https://github.com/moqui/mr-moqui/blob/master/docs/security/proofs/V6-Authentication.md)) | - |
| v5.0.0-6.4.3 | 2 | Password reset keeps the second factor | Inherited | framework: Gap ([V6](https://github.com/moqui/mr-moqui/blob/master/docs/security/proofs/V6-Authentication.md)); `request#Recovery` is `reset#Password` | - |
| v5.0.0-6.4.4 | 2 | Lost-factor recovery with identity proofing | Gap | no factor recovery for public accounts | - |
| v5.0.0-6.5.1 | 2 | One-time codes usable once | Inherited | framework: Framework ([V6](https://github.com/moqui/mr-moqui/blob/master/docs/security/proofs/V6-Authentication.md)) | - |
| v5.0.0-6.5.2 | 2 | Low-entropy lookup secrets stored slow-hashed, salted | Inherited | framework: Gap ([V6](https://github.com/moqui/mr-moqui/blob/master/docs/security/proofs/V6-Authentication.md)); framework (Gap) | - |
| v5.0.0-6.5.3 | 2 | Codes and TOTP seeds from a CSPRNG | Inherited | framework: Framework ([V6](https://github.com/moqui/mr-moqui/blob/master/docs/security/proofs/V6-Authentication.md)) | - |
| v5.0.0-6.5.4 | 2 | Codes carry at least 20 bits | Inherited | framework: Framework ([V6](https://github.com/moqui/mr-moqui/blob/master/docs/security/proofs/V6-Authentication.md)) | - |
| v5.0.0-6.5.5 | 2 | Code lifetimes bounded | Inherited | framework: Gap ([V6](https://github.com/moqui/mr-moqui/blob/master/docs/security/proofs/V6-Authentication.md)); framework (Gap) | - |
| v5.0.0-6.6.1 | 2 | SMS codes: verified numbers, alternatives, risk notice | N/A | PASS offers no SMS factor (likely) | - |
| v5.0.0-6.6.2 | 2 | Sent codes bound to their sign-in attempt | Inherited | framework: Gap ([V6](https://github.com/moqui/mr-moqui/blob/master/docs/security/proofs/V6-Authentication.md)); framework (Gap) | - |
| v5.0.0-6.6.3 | 2 | Sent-code guessing rate limited | Inherited | framework: Gap ([V6](https://github.com/moqui/mr-moqui/blob/master/docs/security/proofs/V6-Authentication.md)); framework; `throttle('session')` also covers `completeSession` | - |
| v5.0.0-6.8.1 | 2 | No identity spoofing across identity providers | Inherited | framework: Framework ([V6](https://github.com/moqui/mr-moqui/blob/master/docs/security/proofs/V6-Authentication.md)); PASS SSO goes through `login#User`, flows in `pass-authority@sso-flows` | - |
| v5.0.0-6.8.2 | 2 | Assertion signatures always verified | Inherited | framework: Gap ([V6](https://github.com/moqui/mr-moqui/blob/master/docs/security/proofs/V6-Authentication.md)) | - |
| v5.0.0-6.8.3 | 2 | SAML assertions single use | N/A | no SAML | - |
| v5.0.0-6.8.4 | 2 | IdP-reported strength and recency checked | Inherited | framework: Gap ([V6](https://github.com/moqui/mr-moqui/blob/master/docs/security/proofs/V6-Authentication.md)); framework (Gap) | - |

## V7 Session Management

| Requirement | L | Topic | Status | Evidence | Proof |
| --- | --- | --- | --- | --- | --- |
| v5.0.0-7.1.1 | 2 | Idle and absolute session limits documented with rationale | Gap | mr-pass `docs/Deployment.md:57-60` documents delegations (15 min idle, 12 h cap); the frontend's own session is the framework's; no rationale | - |
| v5.0.0-7.1.2 | 2 | Concurrent sessions per account: limit and behavior documented | Gap | inherited; delegations per account are unbounded (`framework/service/org/moqui/public/Account.js` `issueDelegation`) | - |
| v5.0.0-7.1.3 | 2 | Federated sign-in systems and session coordination documented | PASS | the authority as IdP of PASS frontends: mr-pass `docs/Deployment.md:57-65`, Attack-Surface-Apps-PASS.md "Delegations", "Single sign-on through the authority" (lifetimes, revocation, handoff) | the documents (a documentation requirement): mr-pass `docs/Deployment.md`; `Attack-Surface-Apps-PASS.md` "Delegations", "Single sign-on through the authority" |
| v5.0.0-7.2.1 | 1 | Server checks every session token | Inherited | framework: Framework ([V7](https://github.com/moqui/mr-moqui/blob/master/docs/security/proofs/V7-Session-Management.md)); framework; a delegation is checked at the authority by digest, client and site (`Account.js` `authenticateDelegation`) | - |
| v5.0.0-7.2.2 | 1 | Sessions use generated tokens, not fixed keys | Inherited | framework: Framework ([V7](https://github.com/moqui/mr-moqui/blob/master/docs/security/proofs/V7-Session-Management.md)); framework; a delegation is made at each sign-in (`Account.js` `issueDelegation`) | - |
| v5.0.0-7.2.3 | 1 | Session reference tokens random, unique, 128 bits or more | Inherited | framework: Framework ([V7](https://github.com/moqui/mr-moqui/blob/master/docs/security/proofs/V7-Session-Management.md)); framework; a delegation is 64 base64url characters from `getrandom` (`user/factor.rs` `random_string`, 384 bits), stored as a digest | - |
| v5.0.0-7.2.4 | 1 | New session token at sign-in and re-authentication | Gap | inherited; a remote frontend rotates its session when a delegation is answered (mr-pass `service/pass/Account.js` `rotateSession`) | - |
| v5.0.0-7.3.1 | 2 | Idle timeout ends the signed-in session | Inherited | framework: Framework ([V7](https://github.com/moqui/mr-moqui/blob/master/docs/security/proofs/V7-Session-Management.md)); framework; remote mode also ends a delegation after 15 min unused (`Account.js` `authenticateDelegation`) | - |
| v5.0.0-7.3.2 | 2 | Absolute lifetime ends the signed-in session | Gap | local mode inherits; remote mode caps a delegation at 12 h from issue (`Account.js` `authenticateDelegation`) | - |
| v5.0.0-7.4.1 | 1 | Ended session cannot be used again | PASS | sign-out revokes the delegation (mr-mantle `script/PassAuthority.js` account action `logout`, `revokedAt`) and rotates the frontend session (mr-pass `service/pass/Account.js` `endSession`); SEC-PSA-10 (gRPC handle, to check) | FW: `a_logout_ends_the_session_and_its_attributes` (`session_tests.rs`); PASS: V7SessionManagement "v5.0.0-7.4.1: a session signed out on Settings does not sign in again" |
| v5.0.0-7.4.2 | 1 | Disabled or deleted account loses its sessions | Inherited | framework: Framework ([V7](https://github.com/moqui/mr-moqui/blob/master/docs/security/proofs/V7-Session-Management.md)); framework; a delegation of a closed account is refused (`Account.js` `closed`) | - |
| v5.0.0-7.4.3 | 2 | Offer ending other sessions after a factor change | PASS | PASS's only factor change is the password (`Account.js` `manageAccount` `password`), which ends other sessions and every delegation (`accountStamp` in `authenticateDelegation`); a recovery ends in a password change | PasswordChangeGate (framework) "a new password ends the account's other sessions"; PASS: V7SessionManagement "v5.0.0-7.4.3: a new password ends the account's other sessions and its delegations" |
| v5.0.0-7.4.4 | 2 | Sign-out visible on every signed-in page | Gap | only Smithy's header has Sign out (mr-pass `screen/Shared/Header.html.fancy`); elsewhere My account, then "Profile and security", then Sign out (`screen/Account/Settings.xml` `endSession`) | - |
| v5.0.0-7.4.5 | 2 | Administrators end one user's or everyone's sessions | Inherited | framework: Framework ([V7](https://github.com/moqui/mr-moqui/blob/master/docs/security/proofs/V7-Session-Management.md)); framework; PASS operators are business-host administrators | - |
| v5.0.0-7.5.1 | 2 | Fresh sign-in before changing recovery or factor data | PASS | PASS changes only the password, with the old one (`Account.js` `manageAccount`); Smithy keys and tokens need a recent sign-in (`SmithyGit.js` reauthenticate, SEC-PFS-63 fixed) (map) | V7SessionManagement "v5.0.0-7.5.1: a password change on Settings needs the current password" |
| v5.0.0-7.5.2 | 2 | Users see and end their sessions after confirming | Gap | no session list in PASS; `manageAccount` `endVisit` takes a visit id no PASS page shows (`screen/Account/Settings.xml`), with no fresh sign-in | - |
| v5.0.0-7.6.1 | 2 | RP and IdP session lifetimes behave as documented | Gap | the authority's delegations keep their documented 15 min, 12 h and revocations (`Account.js`); the external IdP part is inherited; a gRPC session handle keeps no signed-in user after an account action (SEC-PSA-10 fixed) | - |
| v5.0.0-7.6.2 | 2 | No session made without the user's action | PASS | `startSso` is refused by `save`, and `Account/Sso` completes only with the session's `state` and `handoffId` (Attack-Surface-Apps-PASS.md "Single sign-on"); a delegation only after a password, factor or SSO exchange | PASS: SsoHandoff (mr-pass) "SSO callback is browser-bound and exchanges a single-use site-scoped code" |

## V8 Authorization

| Requirement | L | Topic | Status | Evidence | Proof |
| --- | --- | --- | --- | --- | --- |
| v5.0.0-8.1.1 | 1 | Documented rules for function and data access | PASS | Attack-Surface-Apps-PASS.md "Who the caller is", "Bearer links"; -Apps-PASS-Commerce.md and -Apps-PASS-Forum-Smithy.md per app (map) | the documents (a documentation requirement): `Attack-Surface-Apps-PASS.md` "Who the caller is", "Bearer links"; `-Apps-PASS-Commerce.md`, `-Apps-PASS-Forum-Smithy.md` |
| v5.0.0-8.1.2 | 2 | Documented rules for field read and write | Gap | no field rules by role or state; only each operation's input field list (mr-mantle `ForumSchema.js`, `SmithySchema.js`) and a few projections in the maps (`ThemeView.contract()`) | - |
| v5.0.0-8.2.1 | 1 | Functions only for explicitly permitted callers | Gap | the route table and schemas bound the operations (`PassAuthority.js` `run`), site and staff checks (`ForumCore.js` `site`, `staff`; round-3 C4); open: SEC-PFS-88 (`endSanction` asks no rank) | - |
| v5.0.0-8.2.2 | 1 | Records only for callers permitted that record | Gap | held: bearer links (`ExternalAccess.js` `check`), Forum `site()`/`category()`, Smithy `core.repository`, portals by the site's mount (round-3 C4, C6, C7, C9); open: SEC-PSS-81 (promo code by its id), SEC-PFS-84, SEC-PSF-82 | - |
| v5.0.0-8.2.3 | 2 | Fields only for callers permitted that field | PASS | a field an operation's schema does not list is 422 at the authority (`PassAuthority.js` `run`) and dropped by the frontend (`screen/Shared/View.js` `inputFor`); likely: nested values are not checked there | PassAuthority (mr-mantle) "an operation runs its schema service and a field the schema does not list is the envelope's 422" |
| v5.0.0-8.3.1 | 1 | Authorization decided on the server, not the client | PASS | mr-pass holds no data; the authority's `run()` and each Mantle service take the caller from `ec.user` and the site from the path, never from input (`PassAuthority.js`; round-3 C4) | FW: mr-moqui V8Authorization "v5.0.0-8.3.1: a user who may view Tools is refused a service run posted directly"; PASS: PassAuthority (mr-mantle) "a delegation needs a registered client and a good credential, and a write needs a session or a delegation" |
| v5.0.0-8.4.1 | 2 | One tenant cannot act on another tenant | Gap | sites held apart in Forum and Smithy operations (round-3 C2, C4 to C6) and a client to its sites (SEC-PSA-05 fixed); open: SEC-PFS-99 (another site's sender and template), SEC-PFS-85, SEC-PSS-83 | - |

## V9 Self-contained Tokens

| Requirement | L | Topic | Status | Evidence | Proof |
| --- | --- | --- | --- | --- | --- |
| v5.0.0-9.1.1 | 1 | Signature or MAC checked before token contents used | Inherited | framework: Framework ([V9](https://github.com/moqui/mr-moqui/blob/master/docs/security/proofs/V9-Self-contained-Tokens.md)); framework; PASS issues no self-contained token: delegations, links and codes are random references kept as digests | - |
| v5.0.0-9.1.2 | 1 | Signing algorithms from an allowlist, never none | Inherited | framework: Framework ([V9](https://github.com/moqui/mr-moqui/blob/master/docs/security/proofs/V9-Self-contained-Tokens.md)) | - |
| v5.0.0-9.1.3 | 1 | Verification keys only from configured trusted sources | Inherited | framework: Framework ([V9](https://github.com/moqui/mr-moqui/blob/master/docs/security/proofs/V9-Self-contained-Tokens.md)) | - |
| v5.0.0-9.2.1 | 1 | Token used only inside its validity window | Inherited | framework: Framework ([V9](https://github.com/moqui/mr-moqui/blob/master/docs/security/proofs/V9-Self-contained-Tokens.md)) | - |
| v5.0.0-9.2.2 | 2 | Token kind and purpose checked | Gap | inherited SEC-RTE-86: Authorize.Net and Shippo webhooks arrive through `/rest/sm` | - |
| v5.0.0-9.2.3 | 2 | Token accepted only when meant for this service | Inherited | framework: Framework ([V9](https://github.com/moqui/mr-moqui/blob/master/docs/security/proofs/V9-Self-contained-Tokens.md)) | - |
| v5.0.0-9.2.4 | 2 | Issued tokens name their audience | Inherited | framework: Framework ([V9](https://github.com/moqui/mr-moqui/blob/master/docs/security/proofs/V9-Self-contained-Tokens.md)) | - |

## V10 OAuth and OIDC

| Requirement | L | Topic | Status | Evidence | Proof |
| --- | --- | --- | --- | --- | --- |
| v5.0.0-10.1.1 | 2 | Tokens held only where they are used | PASS | delegation kept in the frontend session (`passDelegation`, `mr-pass/service/pass/Account.js` `finishSso`), sent only under `pass@backend-url` (SEC-PSF-05 fixed); Mantle's PayTrace client-credentials token sealed in the process cache, sent only to the gateway (`PayTrace.js` `accessToken`); the framework's mail gap is not on PASS's paths | V10OAuthOidc "v5.0.0-10.1.1: a delegation is taken only from the PASS frontend it was issued to"; mr-pass RemoteHttp (acceptance) "remote password authentication keeps credentials server-side and can save a private draft" |
| v5.0.0-10.1.2 | 2 | Callback values tied to the starting browser session | PASS | local mode: the framework's `login#User`; remote: 32-character state and 64-character verifier in the frontend session, `state` and `handoffId` must match (`mr-pass/service/pass/Account.js` `finishSso`); the authority's handoff is bound to the business-host session (`framework/service/org/moqui/public/Account.js` `startSso`, `completeSso`) | FW: moqui-host it `sso::an_oidc_login_creates_the_user_maps_groups_and_rotates_the_session` (tampered state), moqui-mail `oauth_tests::the_code_exchange_checks_state_pkce_scope_nonce_and_address`; PASS: mr-pass SsoHandoff "SSO callback is browser-bound ..." |
| v5.0.0-10.2.1 | 2 | Code flow protected from forged token requests | PASS | remote handoff: `state` and `handoffId` checked by the frontend (`finishSso`), the verifier digest by the authority (`public/Account.js` `exchangeSso`); local mode Inherited | FW: as 10.1.2; PASS: SsoHandoff "SSO callback is browser-bound ..." |
| v5.0.0-10.2.2 | 2 | Defense when several authorization servers are used | Inherited | framework: Gap ([V10](https://github.com/moqui/mr-moqui/blob/master/docs/security/proofs/V10-OAuth-and-OIDC.md)); provider sign-in is the framework's `login#User` (local mode and `start#Sso`); the frontend itself speaks to one authority | - |
| v5.0.0-10.3.1 | 2 | Resource server checks a token's audience | N/A | the PASS authority is not an OAuth resource or authorization server (see the framework's V10 notes) | - |
| v5.0.0-10.3.2 | 2 | Access decided by the token's delegation claims | N/A | the PASS authority is not an OAuth resource or authorization server (see the framework's V10 notes) | - |
| v5.0.0-10.3.3 | 2 | User taken from claims that never move | N/A | the PASS authority is not an OAuth resource or authorization server (see the framework's V10 notes) | - |
| v5.0.0-10.3.4 | 2 | Token's sign-in strength or age checked | N/A | the PASS authority is not an OAuth resource or authorization server (see the framework's V10 notes) | - |
| v5.0.0-10.4.1 | 1 | Redirect URIs matched exactly to registered ones | N/A | the PASS authority is not an OAuth resource or authorization server (see the framework's V10 notes) | - |
| v5.0.0-10.4.2 | 1 | Code used once; reuse revokes its tokens | N/A | the PASS authority is not an OAuth resource or authorization server (see the framework's V10 notes) | - |
| v5.0.0-10.4.3 | 1 | Authorization code lives at most ten minutes | N/A | the PASS authority is not an OAuth resource or authorization server (see the framework's V10 notes) | - |
| v5.0.0-10.4.4 | 1 | Each client limited to its needed grants | N/A | the PASS authority is not an OAuth resource or authorization server (see the framework's V10 notes) | - |
| v5.0.0-10.4.5 | 1 | Refresh token replay prevented for public clients | N/A | no refresh tokens; the authority's clients are confidential (secret) | - |
| v5.0.0-10.4.6 | 2 | PKCE required, S256 only, verifier checked | N/A | the PASS authority is not an OAuth resource or authorization server (see the framework's V10 notes) | - |
| v5.0.0-10.4.7 | 2 | Open client registration vetted and consented | N/A | clients are conf properties (`pass-authority/client[<id>]@secret`, `@sites`, `@callback`), no dynamic registration | - |
| v5.0.0-10.4.8 | 2 | Refresh tokens have a hard expiry | N/A | the PASS authority is not an OAuth resource or authorization server (see the framework's V10 notes) | - |
| v5.0.0-10.4.9 | 2 | Users can revoke refresh and reference tokens | N/A | the PASS authority is not an OAuth resource or authorization server (see the framework's V10 notes) | - |
| v5.0.0-10.4.10 | 2 | Confidential clients authenticate on back-channel calls | N/A | the PASS authority is not an OAuth resource or authorization server (see the framework's V10 notes) | - |
| v5.0.0-10.4.11 | 2 | Clients given only the scopes they need | N/A | the PASS authority is not an OAuth resource or authorization server (see the framework's V10 notes) | - |
| v5.0.0-10.5.1 | 2 | ID token nonce matched to the request | Inherited | framework: Framework ([V10](https://github.com/moqui/mr-moqui/blob/master/docs/security/proofs/V10-OAuth-and-OIDC.md)) | - |
| v5.0.0-10.5.2 | 2 | User identified by a stable provider subject | Inherited | framework: Gap ([V10](https://github.com/moqui/mr-moqui/blob/master/docs/security/proofs/V10-OAuth-and-OIDC.md)) | - |
| v5.0.0-10.5.3 | 2 | Provider metadata issuer must match the expected one | Inherited | framework: Gap ([V10](https://github.com/moqui/mr-moqui/blob/master/docs/security/proofs/V10-OAuth-and-OIDC.md)) | - |
| v5.0.0-10.5.4 | 2 | ID token audience is this client | Inherited | framework: Framework ([V10](https://github.com/moqui/mr-moqui/blob/master/docs/security/proofs/V10-OAuth-and-OIDC.md)) | - |
| v5.0.0-10.5.5 | 2 | Back-channel logout tokens checked | N/A | none | - |
| v5.0.0-10.6.1 | 2 | Provider allows only safe response types | N/A | the authority answers a delegation and a `subject` handle, no ID token | - |
| v5.0.0-10.6.2 | 2 | Provider resists forced logout | N/A | as 10.6.1 | - |
| v5.0.0-10.7.1 | 2 | User consents to each authorization | N/A | no consent step: the authority's clients are the operator's own conf-registered frontends of the site (assumption, see NOTES) | - |
| v5.0.0-10.7.2 | 2 | Consent prompt explains access, client and lifetime | N/A | as 10.7.1 | - |
| v5.0.0-10.7.3 | 2 | User reviews and withdraws granted consents | N/A | as 10.7.1 | - |

## V11 Cryptography

| Requirement | L | Topic | Status | Evidence | Proof |
| --- | --- | --- | --- | --- | --- |
| v5.0.0-11.1.1 | 2 | Written key management policy and key lifecycle | Inherited | framework: Gap ([V11](https://github.com/moqui/mr-moqui/blob/master/docs/security/proofs/V11-Cryptography.md)); framework; `pass@client-secret` and `pass-authority/client[<id>]@secret` changed by hand at both ends (Sealed-Secrets §3.11) | - |
| v5.0.0-11.1.2 | 2 | Maintained inventory of keys, algorithms and certificates | Inherited | framework: Gap ([V11](https://github.com/moqui/mr-moqui/blob/master/docs/security/proofs/V11-Cryptography.md)) | - |
| v5.0.0-11.2.1 | 2 | Crypto from validated libraries, no home-made primitives | Inherited | framework: Framework ([V11](https://github.com/moqui/mr-moqui/blob/master/docs/security/proofs/V11-Cryptography.md)) | - |
| v5.0.0-11.2.2 | 2 | Algorithms and keys swappable, data re-encryptable | Inherited | framework: Gap ([V11](https://github.com/moqui/mr-moqui/blob/master/docs/security/proofs/V11-Cryptography.md)) | - |
| v5.0.0-11.2.3 | 2 | Every primitive gives at least 128-bit security | Inherited | framework: Gap ([V11](https://github.com/moqui/mr-moqui/blob/master/docs/security/proofs/V11-Cryptography.md)) | - |
| v5.0.0-11.3.1 | 1 | No ECB or weak padding schemes | Inherited | framework: Gap ([V11](https://github.com/moqui/mr-moqui/blob/master/docs/security/proofs/V11-Cryptography.md)); framework; Mantle card numbers, PINs and identifiers are such fields | - |
| v5.0.0-11.3.2 | 1 | Authenticated ciphers and modes for stored data | Inherited | framework: Gap ([V11](https://github.com/moqui/mr-moqui/blob/master/docs/security/proofs/V11-Cryptography.md)) | - |
| v5.0.0-11.3.3 | 2 | Ciphertext tampering detected by AEAD or MAC | Inherited | framework: Gap ([V11](https://github.com/moqui/mr-moqui/blob/master/docs/security/proofs/V11-Cryptography.md)) | - |
| v5.0.0-11.4.1 | 1 | Approved hash functions only, never MD5 | Inherited | framework: Gap ([V11](https://github.com/moqui/mr-moqui/blob/master/docs/security/proofs/V11-Cryptography.md)) | - |
| v5.0.0-11.4.2 | 2 | Passwords stored with a slow password hash | Inherited | framework: Framework ([V11](https://github.com/moqui/mr-moqui/blob/master/docs/security/proofs/V11-Cryptography.md)); public accounts are framework accounts (`org/moqui/public/Account.js`) | - |
| v5.0.0-11.4.3 | 2 | Signature and integrity hashes collision resistant, long enough | Inherited | framework: Gap ([V11](https://github.com/moqui/mr-moqui/blob/master/docs/security/proofs/V11-Cryptography.md)) | - |
| v5.0.0-11.4.4 | 2 | Keys from passwords use a stretching KDF | Inherited | framework: Gap ([V11](https://github.com/moqui/mr-moqui/blob/master/docs/security/proofs/V11-Cryptography.md)) | - |
| v5.0.0-11.5.1 | 2 | Unguessable values from a CSPRNG, 128 bits or more | Inherited | framework: Gap ([V11](https://github.com/moqui/mr-moqui/blob/master/docs/security/proofs/V11-Cryptography.md)); PASS recovery and registration tokens are 64 characters (`public/Account.js`), but public accounts can also use the business host's `reset#Password` (SEC-PSA-11) | - |
| v5.0.0-11.6.1 | 2 | Approved key generation and signature algorithms | Inherited | framework: Gap ([V11](https://github.com/moqui/mr-moqui/blob/master/docs/security/proofs/V11-Cryptography.md)) | - |

## V12 Secure Communication

| Requirement | L | Topic | Status | Evidence | Proof |
| --- | --- | --- | --- | --- | --- |
| v5.0.0-12.1.1 | 1 | Only TLS 1.2 and 1.3, newest preferred | Inherited | framework: Framework ([V12](https://github.com/moqui/mr-moqui/blob/master/docs/security/proofs/V12-Secure-Communication.md)) | - |
| v5.0.0-12.1.2 | 2 | Recommended cipher suites, strongest preferred | Inherited | framework: Gap ([V12](https://github.com/moqui/mr-moqui/blob/master/docs/security/proofs/V12-Secure-Communication.md)) | - |
| v5.0.0-12.1.3 | 2 | mTLS client certificates checked before identity use | Inherited | framework: Framework ([V12](https://github.com/moqui/mr-moqui/blob/master/docs/security/proofs/V12-Secure-Communication.md)); framework; the gRPC authority takes a client secret, not a certificate | - |
| v5.0.0-12.2.1 | 1 | TLS for all external HTTP, no clear-text fallback | Inherited | framework: Configuration ([V12](https://github.com/moqui/mr-moqui/blob/master/docs/security/proofs/V12-Secure-Communication.md)); `runtime/conf/pass/MoquiPassConf.xml` puts the host's certificate in `cert/` and leaves `https-enabled` false | - |
| v5.0.0-12.2.2 | 1 | Publicly trusted certificates on public services | Inherited | framework: Configuration ([V12](https://github.com/moqui/mr-moqui/blob/master/docs/security/proofs/V12-Secure-Communication.md)) | - |
| v5.0.0-12.3.1 | 2 | Encrypted transport on every inbound and outbound link | Configuration | authority link refuses clear text to another host (`mr-pass/service/pass/Transport.js` `clearToAnotherHost`); the rest as framework | mr-pass Transport "a transport in clear text to another host is refused unless pass@backend-insecure says so (SEC-PSF-05)" |
| v5.0.0-12.3.2 | 2 | TLS clients check server certificates | Configuration | the authority client (`pass_authority/client.rs`, `grpcs://`) checks the certificate against the WebPKI roots and its name before sending anything, and takes no extra roots (an authority behind a private CA needs the REST transport, `pass@backend-url` over https, whose `RestClient` takes them); clear text to another host is refused by `Transport.js` `clearToAnotherHost` unless `pass@backend-insecure`, not by the Rust client, which takes `grpc://` from any script; SEC-OUT-83 (clear text from another script), SEC-OUT-93 (no private CA for grpcs) | `pass_authority/client_tests.rs` `the_authority_client_checks_the_authoritys_certificate_and_name` (mr-moqui, in-process); `tls_tests.rs` `the_outbound_http_client_checks_the_servers_certificate_and_name` (the REST transport); Transport "a transport in clear text to another host is refused unless pass@backend-insecure says so (SEC-PSF-05)" |
| v5.0.0-12.3.3 | 2 | TLS between internal HTTP services, no fallback | PASS | `Transport.js` refuses `http://` and `grpc://` to another host unless `pass@backend-insecure` (SEC-PSF-05 fixed) | PASS: Transport "a transport in clear text to another host is refused unless pass@backend-insecure says so" (mr-pass `test/Transport.spec.js`) |
| v5.0.0-12.3.4 | 2 | Internal TLS trusts only named CAs or pins | Inherited | framework: Gap ([V12](https://github.com/moqui/mr-moqui/blob/master/docs/security/proofs/V12-Secure-Communication.md)); authority link takes public roots only, no private CA yet (mr-pass `docs/Deployment.md`) | - |

## V13 Configuration

| Requirement | L | Topic | Status | Evidence | Proof |
| --- | --- | --- | --- | --- | --- |
| v5.0.0-13.1.1 | 2 | Every communication need and user-given target documented | PASS | `docs/security/Attack-Surface-Apps-PASS.md` "How PASS reaches the authority"; mr-pass `docs/Deployment.md` transports | n/a: a document |
| v5.0.0-13.2.1 | 2 | Backend links authenticated without static shared credentials | Gap | PASS server to authority: static `pass@client-secret` (mTLS planned, Sealed-Secrets §3.11); the edge-link form uses the link's certificate | - |
| v5.0.0-13.2.2 | 2 | Backend accounts hold least privilege | Gap | inherits SEC-TLS-86; a PASS client is held to its `pass-authority/client[<id>]@sites` (`PassAuthority.js` `run`, SEC-PSA-05 fixed) | - |
| v5.0.0-13.2.3 | 2 | No default credentials between services | PASS | `pass@client-secret` ships empty (mr-pass `MoquiConf.xml`), and a frontend whose secret is empty or `CHANGEME` calls no remote authority (`Transport.js` `authorityClient`, `isConfValueSet`); the authority compares the configured secret by digest and takes no empty one (`public/Account.js` `clientRegistered`, `System.propertyMatches`); nor one that is or ends with `CHANGEME` (SEC-PSA-81 fixed) | `generated_secrets_are_32_random_bytes_and_secret_names_are_known` (`context/tests.rs`); PASS: mr-pass Transport "v5.0.0-13.2.3: no PASS client is registered by an empty, placeholder or guessed secret" |
| v5.0.0-13.2.4 | 2 | Allowlist of external systems the app may reach | Inherited | framework: Configuration ([V13](https://github.com/moqui/mr-moqui/blob/master/docs/security/proofs/V13-Configuration.md)); `pass@backend-url` fixes the authority origin | - |
| v5.0.0-13.2.5 | 2 | Server allowlist of request and load targets | Inherited | framework: Configuration ([V13](https://github.com/moqui/mr-moqui/blob/master/docs/security/proofs/V13-Configuration.md)) | - |
| v5.0.0-13.3.1 | 2 | Secrets in a vault, not in source or artifacts | Inherited | framework: Gap ([V13](https://github.com/moqui/mr-moqui/blob/master/docs/security/proofs/V13-Configuration.md)); `pass@client-secret` and `pass-authority/client[<id>]@secret` in `.env` in clear | - |
| v5.0.0-13.3.2 | 2 | Least-privilege access to secrets | Inherited | framework: Gap ([V13](https://github.com/moqui/mr-moqui/blob/master/docs/security/proofs/V13-Configuration.md)) | - |
| v5.0.0-13.4.1 | 1 | No source-control metadata reachable | Inherited | framework: Configuration ([V13](https://github.com/moqui/mr-moqui/blob/master/docs/security/proofs/V13-Configuration.md)); `runtime/conf/pass/README.md` builds the PASS server with `./moq archive`; the authority runs from a checkout | - |
| v5.0.0-13.4.2 | 2 | Debug features off in production | Inherited | framework: Framework ([V13](https://github.com/moqui/mr-moqui/blob/master/docs/security/proofs/V13-Configuration.md)); `MoquiPassConf.xml` sets `production` | - |
| v5.0.0-13.4.3 | 2 | No directory listings served | Inherited | framework: Framework ([V13](https://github.com/moqui/mr-moqui/blob/master/docs/security/proofs/V13-Configuration.md)) | - |
| v5.0.0-13.4.4 | 2 | HTTP TRACE refused in production | Configuration | `MoquiPassConf.xml` sets `web-protection enabled="true"` | V13Configuration "v5.0.0-13.4.4: a TRACE request is refused and its request is never echoed" (a deployment's) |
| v5.0.0-13.4.5 | 2 | Internal API docs and monitoring not exposed | Inherited | framework: Framework ([V13](https://github.com/moqui/mr-moqui/blob/master/docs/security/proofs/V13-Configuration.md)) | - |

## V14 Data Protection

| Requirement | L | Topic | Status | Evidence | Proof |
| --- | --- | --- | --- | --- | --- |
| v5.0.0-14.1.1 | 2 | Sensitive data inventoried and given protection levels | Gap | no classification of PASS's personal data found; maps list bearer values and encrypted fields only | - |
| v5.0.0-14.1.2 | 2 | Each protection level has written handling rules | Gap | none found (follows 14.1.1) | - |
| v5.0.0-14.2.1 | 1 | Secrets never in URLs or query strings | Gap | bearer tokens in query and path by design (`token`, `orderToken`, `returnToken`, `/held-mail/{token}`), redacted (`identity.rs`), `Referrer-Policy: same-origin`; SEC-PSF-83 | - |
| v5.0.0-14.2.2 | 2 | Server-side caches keep no sensitive data | Gap | inherits; own: `Transport.js` `CACHED_READS` anonymous only (map), `Headers.js` `no-store` | - |
| v5.0.0-14.2.3 | 2 | No sensitive data to third-party trackers | Gap | SEC-PSF-83 (a theme's links get `unsafe-url`); SEC-PSF-81 (a post's outside image goes to list members' mail) | - |
| v5.0.0-14.2.4 | 2 | Data protection controls implemented as documented | Gap | no documented levels; SEC-PSF-07 (bearer values in session rows as written; left for the framework's session store), SEC-PFS-86 (an edited post's old text stays readable) | - |
| v5.0.0-14.3.1 | 1 | Client storage wiped when session ends | Gap | no `Clear-Site-Data`; `screen/Forum/Compose.qvue` recovery copy (`pass-compose:` keys) stays after sign-out | - |
| v5.0.0-14.3.2 | 2 | No-store headers on sensitive responses | PASS | `screen/Shared/Headers.js` `no-store` by default; anonymous catalog `public, max-age=60` only with no session cookie | mr-moqui V14DataProtection "v5.0.0-14.3.2: a screen's answer is Cache-Control no-store and never public" (does not require no-store); PASS: mr-pass `Shop/ShopCatalog` "the catalog routes are public for a minute only for an anonymous request; ..." |
| v5.0.0-14.3.3 | 2 | Browser storage holds no sensitive data | Gap | likely: unsent post copy in `localStorage` (`Compose.qvue`) | - |

## V15 Secure Coding and Architecture

| Requirement | L | Topic | Status | Evidence | Proof |
| --- | --- | --- | --- | --- | --- |
| v5.0.0-15.1.1 | 1 | Documented deadlines for patching vulnerable dependencies | Gap | none in mr-pass `README.md`, `docs/Deployment.md`; framework gap carries | - |
| v5.0.0-15.1.2 | 2 | Inventory of third-party components from trusted sources | Gap | mr-pass and Mantle add no third-party library (no `Cargo.toml`, `package.json` or vendored lib); framework gap carries | - |
| v5.0.0-15.1.3 | 2 | Resource-heavy features documented with availability defenses | PASS | `Attack-Surface-Apps-PASS*.md` limits: `record#Attempt` windows, upload caps, 60 s read cache, transport timeouts (map) | - (documentation) |
| v5.0.0-15.2.1 | 1 | Dependencies kept within the patching deadlines | Gap | framework gap carries | - |
| v5.0.0-15.2.2 | 2 | Defenses against resource exhaustion by heavy features | Gap | open: SEC-PFS-92 (drafts), SEC-PFS-93 (export queue); fixed: shop search counted (SEC-PSS-08), forum rules matched in linear time (SEC-PFS-90), `GET tags` bounded (SEC-PFS-98), REST downloads streamed (SEC-PSA-08); account limits by `record#Attempt` met | - |
| v5.0.0-15.2.3 | 2 | No test or development code exposed in production | Gap | `service/pass/test/` (`scan#File`, `classify#Post`, `authenticate="false"`) loads with the component; `scan#File` throws unless `pass@test-scanner` | - |
| v5.0.0-15.3.1 | 1 | Answers carry only the fields the caller needs | PASS | answers built per operation, `location` removed by the authority (map); `findWebhooks` answers a webhook URL as its origin with the rest masked and refuses user info (SEC-PFS-65 fixed) | mr-mantle SmithyRepositorySettings "a webhook's query is masked and its address holds no credential; ..." |
| v5.0.0-15.3.2 | 2 | Outbound calls do not follow redirects unless intended | Inherited | framework: Framework ([V15](https://github.com/moqui/mr-moqui/blob/master/docs/security/proofs/V15-Secure-Coding-and-Architecture.md)); framework client; `Transport.js` REST follows no redirect (map) | - |
| v5.0.0-15.3.3 | 2 | Writes accept only the fields each action intends | PASS | no `service-call` in mr-pass screens; top-level input held to the operation's `fields` (`Facade.js`; Mantle `PassApi.js` 422); `siteId` from the conf; nested values unchecked (map) | PASS: mr-mantle `test/pass/PassAuthority.spec.js` "an operation runs its schema service and a field the schema does not list ..." |
| v5.0.0-15.3.4 | 2 | Client address taken only from trusted proxy headers | Configuration | same selectors; `x-pass-client-ip` read only from a registered client (`PassApi.js`) (map) | V15SecureCoding "v5.0.0-15.3.4: a client's own proxy headers do not change the address PASS limits" |
| v5.0.0-15.3.5 | 2 | Strict typing and comparisons, no type juggling | PASS | no loose `==` or `!=` (other than with null) in mr-pass or Mantle's PASS scripts (`script/`, `service/mantle/forum`, `smithy`, `public`), by a scan; beyond them `account/InvoiceMatch.js:1120` has one numeric `compare(...) == 0` | mr-pass SourceRules "v5.0.0-15.3.5: PASS's scripts compare strictly: no loose == or != but against null" |
| v5.0.0-15.3.6 | 2 | JavaScript guarded against prototype pollution | PASS | account and SSO action names looked up as own names (`Object.hasOwn`, Mantle `PassApi.js`, `PassAuthority.js`; SEC-PSA-13 fixed) | mr-mantle PassAuthority "an account action named for a property of every object is Not Found (SEC-PSA-13)" |
| v5.0.0-15.3.7 | 2 | Defenses against HTTP parameter pollution | PASS | pages copy only the operation's schema fields (`View.js` `inputFor`); a path parameter replaces a body field, a body `siteId` unlike the path's is 422 (`PassApi.js`) (map) | V15SecureCoding "v5.0.0-15.3.7: a siteId or an unknown field added to a request is refused, not merged" |

## V16 Security Logging and Error Handling

| Requirement | L | Topic | Status | Evidence | Proof |
| --- | --- | --- | --- | --- | --- |
| v5.0.0-16.1.1 | 2 | Inventory of logs: events, format, storage, access, retention | Gap | no PASS log inventory in mr-pass docs | - |
| v5.0.0-16.2.1 | 2 | Log entries carry when, where, who and what | Gap | refusal line has a correlation id, not caller or site (`PassAuthority.js` `envelope`); framework gap carries | - |
| v5.0.0-16.2.2 | 2 | Synchronized clocks; timestamps in UTC or with offset | Inherited | framework: Configuration ([V16](https://github.com/moqui/mr-moqui/blob/master/docs/security/proofs/V16-Security-Logging-and-Error-Handling.md)); PASS logs through the framework and adds nothing | - |
| v5.0.0-16.2.3 | 2 | Logs go only to documented destinations | Inherited | framework: Framework ([V16](https://github.com/moqui/mr-moqui/blob/master/docs/security/proofs/V16-Security-Logging-and-Error-Handling.md)); PASS logs through `ec.logger` only | - |
| v5.0.0-16.2.4 | 2 | Logs in a common, machine-correlatable format | Inherited | framework: Framework ([V16](https://github.com/moqui/mr-moqui/blob/master/docs/security/proofs/V16-Security-Logging-and-Error-Handling.md)); plus a correlation id per refusal (`PassAuthority.js` `envelope`) | - |
| v5.0.0-16.2.5 | 2 | Sensitive data kept out of logs or masked | Gap | token names and token paths redacted (SEC-PSF-03, SEC-PSS-02 fixed); SEC-GIT-96 is Smithy's CI secret `value` (nothing leaks today) | - |
| v5.0.0-16.3.1 | 2 | Every sign-in attempt logged with its method | Gap | sign-in is the framework's `login#UserAccount`; framework gap carries | - |
| v5.0.0-16.3.2 | 2 | Refused authorization attempts logged | Gap | default local mode: a Mantle service's own refusal (`site()`, `check()`) is not logged (likely); remote mode logs each (`PassAuthority.js` `envelope`) | - |
| v5.0.0-16.3.3 | 2 | Documented security events and bypass attempts logged | Gap | wrong client secrets logged (`PassApi.js` `checkSecret`); no PASS event list | - |
| v5.0.0-16.3.4 | 2 | Unexpected errors and control failures logged | Inherited | framework: Framework ([V16](https://github.com/moqui/mr-moqui/blob/master/docs/security/proofs/V16-Security-Logging-and-Error-Handling.md)); remote mode also logs each failure with a correlation id (`envelope`) | - |
| v5.0.0-16.4.1 | 2 | Log output encoded against log injection | Gap | refusal keeps the first line only (`envelope`), CR and escapes pass; framework gap carries | - |
| v5.0.0-16.4.2 | 2 | Logs protected from reading and tampering | Inherited | framework: Configuration ([V16](https://github.com/moqui/mr-moqui/blob/master/docs/security/proofs/V16-Security-Logging-and-Error-Handling.md)); PASS logs through the framework and adds nothing | - |
| v5.0.0-16.4.3 | 2 | Logs shipped to a separate system | Inherited | framework: Configuration ([V16](https://github.com/moqui/mr-moqui/blob/master/docs/security/proofs/V16-Security-Logging-and-Error-Handling.md)); PASS logs through the framework and adds nothing | - |
| v5.0.0-16.5.1 | 2 | Generic error answers without internals | PASS | fixed texts except 409 and 422, whose own text passes the `INTERNAL` filters (`PassAuthority.js`); `decideReviews` answers each item's failure through the same envelope (SEC-PFS-104 fixed) | mr-mantle ForumStaffRules "SEC-PFS-104: a bulk review decision answers each item's failure as the authority's envelope does" |
| v5.0.0-16.5.2 | 2 | Safe behavior when external resources fail | PASS | REST transport 30 s with no redirect, gRPC 10 s and 30 s (`Transport.js`, the host's `pass_authority` client); an authority that answers a refusal is shown as fixed text (`Transport.js` `refused`); one that cannot be reached fails the call at once with the REST client's error, which names its address (a production instance's error page shows an error id); nothing kept is served when the site's generation cannot be read (map) | mr-pass Transport "v5.0.0-16.5.2: an authority that cannot be reached fails the call at once, with nothing served"; mr-pass ShopOperations "site information is kept by generation for a visitor not signed in; an authority that cannot answer serves nothing kept" |
| v5.0.0-16.5.3 | 2 | Failures fail closed, never open | PASS | an `isPreviewHost` error answers Unavailable (`screen/Shop/ShopPreview.js`, SEC-PSF-06 fixed) | mr-pass ShopPreview "a preview host check that fails answers Unavailable, never a live host of the site (SEC-PSF-06)" |

## V17 WebRTC

| Requirement | L | Topic | Status | Evidence | Proof |
| --- | --- | --- | --- | --- | --- |
| v5.0.0-17.1.1 | 2 | TURN relays only to non-reserved addresses | N/A | PASS has no calls: no mr-pass page or Mantle PASS service reaches call or TURN services | - |
| v5.0.0-17.2.1 | 2 | DTLS certificate key handled under a key policy | N/A | no calls | - |
| v5.0.0-17.2.2 | 2 | Approved DTLS cipher suites and SRTP profiles | N/A | no calls | - |
| v5.0.0-17.2.3 | 2 | SRTP authentication checked against RTP injection | N/A | no calls | - |
| v5.0.0-17.2.4 | 2 | Media server survives malformed SRTP packets | N/A | no calls | - |
| v5.0.0-17.3.1 | 2 | Signaling rate-limited to survive floods | N/A | no calls | - |
| v5.0.0-17.3.2 | 2 | Signaling survives malformed messages | N/A | no calls | - |
