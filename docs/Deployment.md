# PASS deployment

## Components and authority

Use matching framework, Mantle, and PASS source changes. Use a package with image support for
thumbnails and SSO support when enabling providers; readiness reports missing capabilities. The
default Maximal package and Enterprise provide image and SSO support; Lite omits them. The authority loads Mantle and the
framework security, wiki, entity, job, search, and mail facilities. A local PASS instance loads
the authority in the same runtime. A remote presentation runtime loads framework, webroot, and
PASS, with its own framework session database and no Mantle business entity catalog. It does
not need BOSS. Do not expose internal worker services through additional REST/RPC routes.

Leave `pass@backend-url` unset for local mode. For remote mode, set these properties on the
frontend through deployment configuration or environment variables:

| Property | Purpose |
| --- | --- |
| `pass@backend-url` | Fixed authority origin/base URL, `https://`: an `http://` URL (or a `grpc://` `pass@backend-grpc-url`) to a host other than loopback is refused unless `moqui_conf__pass__backend_insecure=true`. `edge:` on an edge node: its local node, over the edge link |
| `pass@client-id` | Registered deployment ID |
| `pass@client-secret` | Server-side deployment secret |
| `pass@backend-transport` | `rest`, `grpc`, or empty for automatic (below) |
| `pass@backend-grpc-url` | The authority's gRPC listener for direct gRPC, such as `grpcs://boss.example.test:4317` |
| `pass@backend-insecure` | `true` lets the transport send the client secret and the visitors' delegations in clear text (`http://`, `grpc://`) to another host, on a private link only |
| `pass@backend-web-url` | The authority's web address for the browser's SSO front channel; defaults to an http(s) `pass@backend-url`, and is needed with `edge:` (the local node's host name, through the edge node's web access) |

The same operations go to the authority by one of three transports, which callers cannot tell apart (the same results
and error kinds; `service/pass/Transport.js`):

- **REST**: the authority's `/rest/s1/pass/v1/sites/<siteId>/...` routes at `pass@backend-url`, the client's ID and
  secret in headers. Every package has it.
- **gRPC, direct**: the authority's gRPC listener (`pass@backend-grpc-url`), one long-lived HTTP/2 connection; the
  client's ID and secret in metadata. In Maximal and Enterprise.
- **gRPC on the edge link**: `moqui_conf__pass__backend_url=edge:` on an edge node; its local node is the authority, and the link
  is the client (no secret, no public authority). Edge nodes are Maximal.

The transport rule: `pass@backend-transport` `rest` or `grpc` forces one. Empty is gRPC when the package has the
host's gRPC binding and a gRPC endpoint is set (`moqui_conf__pass__backend_url=edge:`, or `pass@backend-grpc-url`), else REST, so
a frontend never moves to an authority port nobody opened. Lite and Dev have no gRPC: REST is their default and a
supported mode for the long term. `grpc` with no `pass@backend-grpc-url` dials the `pass@backend-url` host on port
4317, and `edge:` takes gRPC only. Settings that cannot work fail each call as unavailable, naming the setting in the
log.

`grpc://` is plain HTTP/2: to an authority on another host it would send the client's secret, and the visitors'
credentials and data, in clear, so it is refused there (as `http://` is) unless `moqui_conf__pass__backend_insecure=true` (a private
link); use `grpcs://` otherwise. `grpcs://` trusts the WebPKI
roots only; an authority certificate from a private CA is not accepted yet.

On the authority, register `pass-authority/client[<id>]@secret` and comma-separated
`pass-authority/client[<id>]@sites`. Register the exact frontend SSO callback URI in
`pass-authority/client[<id>]@callback`, such as `https://forum.example.test/account/Sso`. For direct gRPC, also set
`moqui_conf__pass_authority__grpc_enabled=true`: the host's gRPC listener (port `pass-authority@grpc-port`, 4317, on
`pass-authority@grpc-host`; the OTLP receiver's port when that is on too) then takes PASS calls, TLS with the HTTPS
listener's certificate. With no certificate it serves plain h2c, and then takes PASS calls only on a loopback address,
unless `moqui_conf__pass_authority__grpc_insecure=true`. For an edge node, the local node's client ID for it is
`edge/node@pass-client` (default `edge`):
set `pass-authority/client[edge]@sites` and `pass-authority/client[edge]@callback` (no secret; the link authenticates it).
Delegations are hashed, revocable, site/client scoped, and expire after 15 minutes without use;
use in the last five minutes extends them, up to twelve hours from sign-in, after which sign-in is
required again. A failed write retains its draft and operation ID. Every authority call carries the
deployment's client ID and secret (a credential is refused from any other caller) and the browser's
address, which the authority trusts only from a registered client for its rate limits. Password changes, account
termination/disable, or ending the issuing visit invalidate delegations. Credentials and the
authority's session for a second factor in progress stay in the frontend's server-side session: REST keeps the
authority's session cookie, gRPC the same session as an opaque handle (the signed session id) that each account call
carries and the authority renews when it rotates the session.

### An edge node as the PASS server

A business whose authority (its BOSS server) runs in the office, behind a firewall, serves its sites from an edge
node: a small cloud server the authority dials out to and keeps one link open with (mr-moqui `docs/Run-Deploy.md`,
"A local server with an edge node", and `plans/archive/Edge-Node.md` §5.5). The edge node runs mr-pass with
`moqui_conf__pass__backend_url=edge:` (set in mr-moqui's `runtime/conf/edge/MoquiEdgeConf.xml`), so it calls the authority over gRPC
down the link, and the authority needs no public address, open port or client secret for it.

1. Pair the authority with the edge node: on the edge node, System › Edge Clients, make a pairing code; on the
   authority, System › Edge Node, Pair with an edge node, with the edge node's address and the code.
2. In the wizard's Discover step turn PASS on, choose the sites the edge node serves and enter the frontend's SSO
   callback. Apply writes `edge/node@pass-client` (`edge`), `pass-authority/client[edge]@sites` and `pass-authority/client[edge]@callback` to the
   authority's `runtime/.env`, and its Test step checks them and that the edge node has mr-pass.
3. On the edge node, set `pass@backend-web-url` to the authority's web address through the edge node (a host name with
   web access, which the wizard's Discover step sets too), for the SSO front channel, and add the sites' `public-site`
   bindings to its conf.

While the link is down every PASS page fails as unavailable; a read cache on the edge node is later work.

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
API, authentication, token, asset, or operational paths. One app per site may use `/`: Forum or Shop. Keep the runtime
allowlist aligned when changing mounts, and reload runtime configuration after changing it.
Unknown public hosts are concealed. The request cannot replace the routed site or configured
backend. Existing framework token routes retain their handlers.

At a trusted proxy, configure the framework's proxy/origin settings for the actual deployment.
Do not trust arbitrary forwarded authority headers or use a wildcard origin policy in production.
Cookie-authenticated changes require the framework session token. Return paths stay local; SSO
handoffs use the exact registered callback, browser state, a server-held verifier, and an expiring
single-use exchange code. Configure allowed provider IDs in `pass-authority@sso-flows`; they reuse the
framework OIDC/OAuth facilities and account/second-factor policy. SAML remains unavailable where
the framework package does not provide it.

## Several sites by host name

A server can give each PASS app a host of its own, such as the Forum at `forum.example.org` and the Shop at
`shop.example.com`, beside the business's own host with the apps under `webroot.xml` (mr-moqui `docs/Run-Deploy.md`,
"Several sites by host name", and its example `runtime/conf/MoquiSitesConf.xml`). Each such host has two elements in
the runtime's conf:

```xml
<webapp-list><webapp name="webroot">
    <root-screen host="forum\.example\.org" location="component://mr-pass/screen/Pass.xml" framework-routes="refuse"/>
    <public-site host="forum.example.org" site-id="OPERATOR_ASSIGNED_SITE_ID"
            screen-location="component://mr-pass/screen/Pass.xml" resolver-service="pass.RouteServices.resolve#Route">
        <mount path="/" screen="Forum"/>
        <mount path="/account" screen="Account"/>
    </public-site>
</webapp></webapp-list>
```

- **The host's root** is `Pass.xml`, PASS's site root, for every app: there is no wrapper screen per app. The app at the
  host's root is the `public-site`'s mount at `/` (Forum or Shop), with Account and any other app on its own path, as
  the authority's mounts for the site say (`store#Mounts`, with the host among the site's hosts).
- **The site** is bound by the `public-site`, the operator's conf, and never by a request: a `siteId` or
  `resolvedSiteId` a request sends does not change it, and a path no site route takes has no site.
- **`framework-routes="refuse"`** keeps the framework off the host: `/Login`, `/apps`, `/qapps`, `/rest`, the token
  routes, the servlets, the sockets, `/dav`, `/health`, `/metrics` and the HTTPS listener's gRPC services (the PASS
  authority among them) are Not Found there, and the shared `/js`, `/css`,
  `/libs` and `/images` are served. People sign in through the site's Account (`/account/Login`). A page the site does
  not have shows the framework's Not Found page.
- **On the business's host** stay what the framework serves: the apps, the authority's REST (`/rest/s1/pass`) for a
  remote PASS server, payment providers' webhooks and SSO callbacks. Point them at that host, not a site's.
- **Sessions.** Each host's session cookie is its own. PASS's Account is the sign-in across a deployment's sites (SSO
  through the authority); a person who signs in to a site is not signed in to the business's host.
- **Links** a site's pages make are paths on its host. Mail links come from the site's canonical host
  (`PublicSiteHost`), set at the authority; a framework link made in a request to the host (`getWebappRootUrl`) is the
  business host's, where the apps are.
- **An edge node** gives each host web access as an `EdgeHost` of the pairing, with a certificate for the name.

## Full stack

A higher-volume shop or other public site runs on three tiers (mr-moqui `docs/Run-Deploy.md`, "Full stack", its example
confs in `runtime/conf/full-stack/`, and `plans/Edge-Node2.md` §3, §4.7):

```
 visitors --https--> front node         per-app hosts: forum.example.org, shop.example.com, as terminate hosts
                         |  balanced over the edge members, sticky by the session cookie
                     edge cluster       the PASS servers: mr-pass with moqui_conf__pass__backend_url=edge:
                         |  each edge member calls the authority down its own link
                     local cluster      the authority: BOSS with Mantle, the business database
```

- **Per-app hosts on the front.** Each app has a host of its own, as in [Several sites by host name](#several-sites-by-host-name):
  `Pass.xml` is the host's root with `framework-routes="refuse"`, and a `public-site` puts the app at `/`. The bindings
  are in the edge members' conf (mr-moqui's `runtime/conf/full-stack/MoquiEdgeConf.xml`), not the front's: the front
  runs no mr-pass. Each edge member gives the front its sites' hosts as terminate hosts, so the front ends their TLS
  with its certificates for them (in its `runtime/cert`, or System › Certificates with ACME) and keeps a browser on one
  edge member by the session cookie.
- **The edge cluster as the PASS servers.** Every edge member runs mr-pass with `moqui_conf__pass__backend_url=edge:` and the same
  bindings; the frontend's session is a row in the edge cluster's database, so a browser that moves to another member
  stays signed in. `pass@backend-web-url` is the authority's web address through the stack (one of the local
  cluster's host names), for the SSO front channel.
- **The local cluster as the authority.** It pairs with the edge cluster once; the Edge Node wizard's PASS step writes
  `edge/node@pass-client` (`edge`), `pass-authority/client[edge]@sites` and `pass-authority/client[edge]@callback` to its `.env`, copied to every
  local member. Each edge member calls it down its own link, over gRPC with no client secret, balanced over the local
  cluster's live members (sticky by the sign-in in progress). Create the sites and bind their hosts and mounts there
  (`create#Site`, `store#Mounts`), the hosts the edge members' `public-site` bindings name.
- **Stopping any one node below the front** leaves the sites up: the front sends their requests to the other edge
  members, and each edge member calls the other local members.

## Billing and Supplier apps

Billing (an organization's customer invoices and their pay links) and Supplier (a supplier's quotes, purchase orders and
bills: Purchasing's SupplierHome, QuoteResponse and OrderAcknowledgement, and Accounting's BillUpload) are PASS apps beside
Forum. Each serves one internal organization, its mount's target, which only an operator sets:

```json
{"siteId": "...", "expectedRevision": 3, "mounts": [
  {"app": "forum", "pathPrefix": "/forum"}, {"app": "account", "pathPrefix": "/account"},
  {"app": "billing", "pathPrefix": "/billing", "targetId": "ORG_ID"},
  {"app": "supplier", "pathPrefix": "/supplier", "targetId": "ORG_ID"}]}
```

A site owner's save of the core mounts (SiteDetail) keeps them. Add `/billing` and `/supplier` to the runtime's
`<public-site>` mounts (screens `Billing` and `Supplier`). A site without Forum serves only these and Account, and its
pages show those apps' navigation. Readiness adds each app's checks: the target is an internal organization, the
organization has an invoice payment gateway (Billing), bill files can be scanned (Supplier) and the site has a canonical
host, from which every link Mantle mails is built.

- **Links.** An invoice's pay link (`/billing/InvoicePay?token=`) comes from Mantle's `send#Invoice`; a purchase order's
  link (`/supplier/OrderAcknowledgement?token=`, with BillUpload beside it) from `send#PurchaseOrder`, for the revision
  sent, and its bill-only link (`/supplier/BillUpload?token=`) from BOSS's order screen; a quote's link
  (`/supplier/QuoteResponse?token=`) from `send#QuoteRequest`. Once an order is revised, the older revision's link says
  so and acknowledges nothing, though it still takes a bill; a cancelled order's and a closed quote's links are revoked; each is an `ExternalAccessCapability` with
  only its token's digest kept. A link opens one record of its organization's site, until it expires or is revoked;
  anything else says the page is not available. A new pay link ends its issuer's earlier ones (the organization's, or
  a contact's). Every link lookup counts against a limit per requester, and a site needs a canonical host for links to be
  made. The requester is the browser's address a registered remote frontend forwards, else the request's own: behind a
  proxy or load balancer, configure the framework's trusted proxies (see Host and mount bindings) so it is the browser's,
  not one shared by every visitor.
- **Contacts.** `mantle.party.ExternalAccessServices.invite#Contact` invites a customer's or supplier's contact to the
  app; redeeming the invitation (Account's Invitation page) gives the account a contact grant for that party on that
  organization's app only. The account holds no user group. A signed-in contact sees the customer's invoices under Billing's Invoices and can make a
  pay link to share; a supplier's contact (invited by AP or, from BOSS's Supplier360, a buyer) sees the supplier's quotes,
  orders and bills on Supplier's SupplierHome. Set the site's registration to invitation so invited contacts can register.
- **Payment.** Set the organization's invoice payment gateway (`PartyAcctgPreference.invoicePayGatewayConfigId`, one of
  its PaymentGatewayOrganization bindings; BOSS Accounting Preferences). A hosted gateway takes the payer to its page from
  a link on the payment result and sends them back to `<billing mount>/InvoicePay/return?attemptId=&returnToken=`, whose
  reference reads that attempt on any device; the result comes from the gateway's details service, never from the
  return's parameters. The reference reads the attempt while it is pending and for a day after it settles. Keep the
  `resolve_PortalPayments` job running: it settles payments whose payer never comes back, and an attempt pending for
  seven days is taken as abandoned. The content security policy stays
  `form-action 'self'`: no form posts to the provider. The test gateway (`PaymentTestServices.hostedPending#...`) is for
  tests and demos only.
- **Bills.** A supplier's file is staged under `pass@media-root/bills`, checked to be the PDF, PNG or JPEG it says by its
  leading bytes, scanned by `pass@scanner-service` (at most 10 MiB) and becomes the incoming draft bill's file only when clean; a repeat of the request or of the
  supplier's bill number answers the first submission. AP reviews the bill in BOSS; nothing here approves it.
- **Quotes and acknowledgements.** A supplier saves a private draft of its quote and sends it, or acknowledges an order's
  current revision with its promised dates; either may carry a file, staged and scanned as a bill is (under
  `pass@media-root/supplier`), and a drop-ship supplier reports what it shipped. Each is a claim the buyers review in
  BOSS; a repeat answers the first receipt, and the posts are limited per requester.

A remote frontend posts a link's writes (a payment, a bill, a quote and its draft, an acknowledgement, a delivery report)
with no member session; the authority accepts those operations (`TOKEN_WRITES`) only from a registered deployment.

## Support app

The Support app (`screen/Support.xml`, the `support` mount) is Customer Service's customer pages, served for one internal
organization, its mount's target, like Billing and Supplier: `{"app": "support", "pathPrefix": "/support", "targetId":
"ORG_ID"}`, and `/support` in the runtime's `<public-site>` mounts (screen `Support`). Its pages are SupportHome (help),
MyCases, NewCustomerCase, CustomerCase, MyReturns, RequestReturn, CustomerReturn, CustomerArticle and Feedback. Readiness adds
the app's checks: the target is an internal organization with a service policy and a feedback delivery policy, and the site
has a canonical host. Which queues and case types a signed-in customer may file into, and which knowledge spaces its help
reads, are the organization's Support app settings (BOSS Customer Service › Settings › Service defaults; empty: the default
queue and every customer and public knowledge source).

- **Customers.** A customer's contact is invited from BOSS (Customer Service › Customers › a contact › Invite to support),
  through `invite#Contact` with the `support` app; redeeming the invitation (Account's Invitation page) lets the account see
  and file its own cases and returns, a customer administrator every case of the customer. A customer who is a person
  reaches their own cases and returns with no invitation, once their account's email is verified. Set the site's
  registration to invitation, or open for consumers. Matching an email domain never makes anyone a customer's contact.
- **Cases.** NewCustomerCase files a case in one of the offered queues (the queue's priority, assignment and service level),
  with the case type's template fields for the customer and a file; with an order selected it also asks to cancel the
  order's open lines ("Cancellation requested" for an agent unless the organization cancels at once). A queue's public form
  is `/support/NewCustomerCase?token=`, the queue's intake token (BOSS Channel routing); a sender the organization does not
  serve is held for review and reads nothing. CustomerCase shows the case's outward messages and the files shared with the
  customer only, and takes a reply, a file while open, a reopen within the window and a cancel; a case's link
  (`/support/CustomerCase?token=`) opens it signed out. Outside the queue team's working hours the pages say when the team
  replies next.
- **Returns.** RequestReturn offers an order's lines under a self-service return policy, within its window; the server picks
  the receiving facility. The RMA mail's link (`/support/CustomerReturn?token=`) shows the return, its label and tracking,
  takes evidence and a withdrawal before the goods are received.
- **Help.** SupportHome and CustomerArticle read the published pages of the organization's customer and public knowledge
  sources (a visitor only public ones); a rating counts once per page view, 30 in ten minutes per requester.
- **Files.** Case files and return evidence are staged under `pass@media-root/support` and scanned as a bill is (PDF, PNG or
  JPEG, at most 10 MB); downloads go through the facade, which a remote frontend streams.

- **Feedback.** A resolved case's customer gets one invitation by email from the organization's address, after the
  feedback delivery policy's delay (BOSS Customer Service › Settings › Service defaults); its link,
  `/support/Feedback?token=`, is an `ExternalAccessCapability` of the invitation that ends when the invitation expires,
  each send and reminder its own. Keep the `send_CaseFeedbackInvitations` job running (every 15 minutes, a bounded batch).
  The page shows the organization's feedback form as of now and the customer's name, never the case; a GET answers
  nothing, so a mail scanner following the link submits no rating; Send my answer posts the answer, which the authority
  checks again, keeps once and limits per requester (30 posts and 100 link lookups in ten minutes); a repeat shows the
  first answer's receipt. An expired, withdrawn or forged link shows only guidance. The page loads the framework's
  `/js/moqui-form-when.js` for the form's show and require rules (the CSP stays `script-src 'self'`).
- **Access.** A customer's account is a public account holding no user group; the Support pages answer only that customer's
  own records (another customer's case, return or file is "not available", whatever the request names). Where BOSS runs in
  the same runtime, its roots, Commons and Comms among them, are authorized only for its staff (`BOSS_USERS`), so a public
  account opens none of them; every Customer Service screen and service refuses it too.
- **Remote frontend.** `getCaseFeedbackInvitation`, `submitCaseFeedback` and the `support/...` operations are PASS operations
  served by Mantle's PassApi; the writes a link's token authorizes (the feedback answer, a queue form's request, a case link's
  reply, reopen and cancel, an article rating, an RMA link's evidence and withdrawal) are `TOKEN_WRITES`, accepted from a
  registered deployment without a member session.

## Sales app

The Sales app (`screen/Sales.xml`, the `sales` mount) is IronStone Sales' customer pages for one selling organization, its
mount's target: `{"app": "sales", "pathPrefix": "/sales", "targetId": "ORG_ID"}`, and `/sales` in the runtime's
`<public-site>` mounts (screen `Sales`). Its pages are CustomerQuotes (My quotes), CustomerQuote and QuoteResponse, and
CustomerOrders (My orders) and CustomerOrder. Readiness adds the app's checks: the target is an internal organization with Sales defaults and the commercial
revision a quote's issue binds (BOSS Sales › Settings › Defaults), and the site has a canonical host. Until a published site
has the app, a quote goes out with no link and customers cannot accept online (Sales' readiness says so).

- **Links.** Each recipient of a sent quote gets its own link in its mail (`/sales/CustomerQuote?token=`), made for that
  mail: an `ExternalAccessCapability` of the quote's issue, bound to the revision sent, ending with the quote's validity; only
  its token's digest is kept. Revising or withdrawing the quote revokes its links; a change to the quote ends the issue, and
  its links then open nothing. A link shows the offer and its PDF and takes the customer's acceptance (the revision and total
  confirmed, the terms acknowledged, a PO when the organization asks one, the acceptor's name and title) or decline; afterwards
  it shows the receipt, and a second submit answers the first. It never lists other quotes. The issued PDF carries the quote's
  page without a token, for a signed-in contact. Every link lookup counts against a limit per requester, and responses do too.
- **Orders.** A storeless sales order's confirmation (one the organization's Sales sends itself: a direct order or an accepted
  quote) carries the recipient's own link (`/sales/CustomerOrder?token=`), the order's `ExternalAccessCapability` (OrderView,
  for a year), made for that mail. It shows that one order read only: lines and totals, promised dates, the accepted quote,
  shipments with their tracking (a carrier's https link), invoices with their open amount, and the confirmation's PDF; there
  is no edit, cancel, reorder or payment on it. A cancelled order stays reachable by its link and under My orders, marked
  Cancelled and read only, with Support's ask page alone. A signed-in contact sees the customer's placed orders under My orders. A store's
  orders keep Shop's page (a store order's link opens the store's Shop site); CustomerOrders never lists them. Where the site
  mounts Support for the same organization, an order offers its Support pages (ask or change, request cancellation, request a
  return), which take the link for that order from the session; where it mounts Billing for it, a signed-in account's invoice
  opens Billing's InvoicePay, which checks the account's own Billing access (a contact needs a Billing invitation too).
- **High-value quotes.** With an acceptance threshold set for a currency (Sales › Settings › Defaults, unset by default), a
  quote above it is accepted only by a contact signed in; the link still shows it and can decline it.
- **Contacts.** A customer's contact is invited from BOSS (Sales › Accounts › an account or a contact › Invite to Sales),
  through `invite#Contact` with the `sales` app; redeeming the invitation lets the account see the customer's issued quotes
  under My quotes and on the Account hub's Quotes and orders card, and accept them signed in. A customer who is a person reaches
  their own quotes with no invitation once their account's email is verified. Set the site's registration to invitation.
- **Remote frontend.** The `sales/...` operations are PASS operations served by Mantle's PassApi; `respondSalesQuote` is a
  `TOKEN_WRITES` write a link's token authorizes, accepted from a registered deployment without a member session. The order
  operations (`findSalesOrders`, `getSalesOrder`, `getSalesOrderDocument`) are reads only.

## Marketing app

The Marketing app (`screen/Marketing.xml`, the `marketing` mount) is IronStone Marketing's public subscription pages for one
organization, its mount's target: `{"app": "marketing", "pathPrefix": "/marketing", "targetId": "ORG_ID"}`, and `/marketing` in the
runtime's `<public-site>` mounts (screen `Marketing`). Its pages are Subscribe, VerifySubscription, SubmitForm (a published
survey's form), the landing pages at `pages/{route}` and Event (a published event registration offer); unsubscribing and changing topics are the Account app's Email preferences page, so mount Account too. Readiness
adds the app's checks: the target is an internal organization, a list is offered, a form publication open, a landing page or an
event's registration offer published on the site (a mount with nothing published is named), the organization has a ready transactional sending profile, each offered list's policy names a
published confirmation template, and the site has a canonical host.

- **Publishing a list.** A list is offered only by its subscription policy (BOSS Marketing › Audiences › a list › Subscription
  policy): Public offer, this site, and the interval it is open. The list's legacy public flag offers nothing. Each offer shows
  the policy's own wording beside its consent box.
- **The sending profile.** The verification message is a transactional delivery of Comms' ledger from a ready sending profile of
  the organization for transactional mail (purpose Transactional, or none; a promotional profile never sends it. BOSS Marketing ›
  Settings › Sending profiles: an approved relay, a sender, a bounce domain with its hosted bounces@ account), with the
  confirmation template the policy names (a published Comms template of the organization: Marketing › Sends › Message templates).
  Without either, requests are kept, no message goes out and the app's readiness names what is missing. The message is attempted
  once the request commits (the ledger's job retries it); a profile's quiet hours delay it.
- **Requests.** Subscribe takes an address, an optional name, the offered lists the visitor ticks and the consent box, with PASS's
  request key. The answer is the same receipt whatever happened: the address's directory contact or a new person is filed pending
  (which one is never said), a member already, a refusal, a repeat of the key, a limit reached. Limits: 30 requests in ten minutes
  from a client, 1,000 an hour on a site, 5 an hour for an address (over any: the receipt, nothing recorded), and 3 verification
  messages a day to an address (over: the request kept, no message). The visitor's name is never put in the message.
- **Confirmation.** Each verification message carries its own link (`/marketing/VerifySubscription?token=`), seven days; only the
  token's digest is kept. Opening it changes nothing, so a mail scanner confirms nothing; the Confirm button accepts exactly the
  topics asked for that address, once, and a second click shows the first result. A withdrawal after the request is never
  undone by its link. Every link lookup counts against the requester's limit (100 in ten minutes).
- **Email preferences.** On the Account app's Email preferences page, by a list mail's link or signed in, the organization's lists
  offered on the site show with the recipient's state: turning one off unsubscribes it (with an optional reason, kept on the
  withdrawal), turning one on sends a verification message first (a signed-in account's verified address is accepted at once), and
  "No more email from" the organization leaves all its lists and withdraws its marketing email for that organization alone. A
  list of phone numbers (a text message topic) shows there too and may be left, never joined: joining is through an import or staff
  with evidence (a confirmation by the number itself is later).
- **Forms (SubmitForm).** A survey, lead form or registration questions built in BOSS Marketing › Surveys is answered here once a
  content author publishes it in Distribution with this site: to anyone (`/marketing/SubmitForm?publication=ID`, the link and QR
  Distribution shows), to signed-in accounts (the visitor signs in first), or by invitation (each recipient of an invitation send
  gets a link of their own, `/marketing/SubmitForm?token=`, which answers once; only the token's digest is kept, and the link ends
  with the publication or after 30 days). The page asks the form's published questions as of now with their show and require rules
  (the framework's `/js/moqui-form-when.js`; without it every question shows and the server checks the rules again), and the
  publication's subscription choice as a separate box with its own address, which files a pending request with its own
  verification message, as Subscribe does; an answer never subscribes anyone. A draft, closed or another site's form and a wrong
  link show the same "not available". An answer is checked on the server (only the form's questions, each value of its type, a
  question its rules hide refused) and kept once per request key; the receipt is the publication's own words, the same whatever was
  kept. Limits: 30 answers in ten minutes from a client and 1,000 an hour on a site; over either, an answer over 64 KB, or one naming
  a field the page never offered, gets the same receipt and nothing is kept. Responses are read in BOSS Marketing › Surveys ›
  Responses, never on PASS.
- **Lead forms.** A lead form opens only once a content author gives it a lead rule in BOSS Marketing › Leads › Lead rules: the
  sales team whose queue its answers go to, the Sales source, the questions mapped to the inquiry's name, organization, email and
  phone and to its notes, and a notice the page shows above Send. After an answer is kept, the server hands it to Sales once (a lead
  in that team's queue with the form's campaign, or the open lead with the same email it joins); the page never waits on it and
  shows the same receipt. A failed handoff keeps the answer and is tried again by the job `run_MarketingLeadCaptures` (registered in
  Admin's Jobs and recovery); no answer subscribes anyone, and a typed email address identifies nobody.
- **Landing pages.** A content author writes a storeless landing page in BOSS Marketing › Content › Landing pages on a site whose
  Marketing mount serves the organization (no store, no policy role or theme template; the site's default page template), saves
  versions of its text and publishes one from a date; the page is served at `/marketing/pages/{route}` in its window, the exact
  published version (`getMarketingPage`, read only), and a draft, scheduled, withdrawn or unknown page is Not Found. Its text is
  Markdown made clean HTML by the authority and sanitized again on the page (no script, event handler or style; the shell's CSP
  holds), and a paragraph of its own `[[subscribe LIST_ID]]` or `[[form PUBLICATION_ID]]` embeds a subscribe box (Subscribe's
  request, consent box and receipt) or a form's card linking SubmitForm, at most five a page, each shown only for a list offered or
  a form open on this site. Its text is kept in the organization's page space (a wiki space with restricted updates, made with the
  first page), which only the site page services write; themes stay Commerce's.
- **Tracking links.** A campaign's link is made in BOSS Marketing › Content › Tracking links (or a campaign's Tracking links box): a
  registered destination (a landing page of the organization's Marketing mount, or an https address on a host of a site that serves
  the organization or of its allowed list, Campaign defaults' "Tracking link hosts"), its source, medium and content from the
  organization's vocabulary, and the site whose address it gets: `https://{canonical host}/trk/{siteId}/{code}`, with its QR code on
  the link's page. PASS's own conf (`MoquiConf.xml`, loaded on the authority and on a remote frontend alike) registers the redirect
  (`/trk/*`, `script/TrackingRedirect.js`) and a send's open pixel (`/trk-o/*`, `script/TrackingPixel.js`) as web scripts, each limited
  per client by its `<rate-limit>` when per-client web protection is on (60 and 120 a minute). Each declines the session, runs as the
  anonymous request, asks the authority where the link goes (`resolveTrackingLink`) and records the visit (`recordTrackingEvent`),
  and redirects (302) or answers the image whatever was recorded; nothing of the request names a destination, and a disabled or
  ended link goes to its safe destination or a neutral "not available" page (404). The authority keeps its own limits: 30 events of
  a link from a client in ten minutes and 20,000 an hour on a site; over them the visitor is still redirected and nothing is kept.
  A visitor key (the `mkt_vk` cookie, HttpOnly, a year; its digest alone is kept) is set only when the organization's Campaign
  defaults count unique visitors ("Visitor keys", off by default) or the link is a consenting recipient's, and never for a browser
  that sends `Sec-GPC: 1` or `DNT: 1` or for a known scanner, crawler or prefetch, which is recorded apart and is never a conversion.
  A landing page's address with a link's code (`/marketing/pages/{route}?tc={code}`) records a page visit with the key the browser
  already holds. A send's message gives a recipient who allows tracking (the PcpTracking purpose) under a sending profile whose
  tracking policy is "consented recipients" each of the organization's tracking links with a personalized token (`?token=`, its
  digest kept, ninety days; the framework's request log redacts a `token` parameter) and the pixel; every other recipient gets each
  link's direct destination and no pixel. Commerce's Home counts the visits of a store's sites. The paths `/trk` and `/trk-o` are
  taken on every host of the deployment, so the framework reserves them (`ec.web.reservedPaths`, each declared servlet's
  first segment): no Smithy group, handle, site page, redirect or mount can take them.
- **Events.** An events manager makes a campaign's event in BOSS Marketing › Events (a calendar event they organize; its calendar's
  editors may change it there) and sets up its registration: one offer per occurrence (a repeating event's occurrences each their
  own), its seats, hold, waitlist, terms, this site and an optional store (a store order; storeless by default), its ticket types
  (free, or priced by a ticket product's own prices in the organization's currency), registration questions built in Surveys and
  its notices. Publishing asks that it is ready: an occurrence still to come, seats, a ticket type, a window that ends by the
  occurrence's end, this site published, a ready transactional sending profile, a payment gateway of the organization (or of the
  store) when a ticket has a price, and the questions published. The page is `/marketing/Event?offer={id}` (`getMarketingEvent`,
  read only): the offer's title and description (as text), its dates in the offer's time zone, where (an online event says so; the
  call link goes to registrants only), each ticket's price and availability (a guide until a place is reserved) and the terms. A
  draft, closed, past or another site's offer is Not Found. A landing page's paragraph `[[event OFFER_ID]]` shows the offer as a
  card linking its page.
- **Registrations.** The Event page's Register link opens `/marketing/Register?offer={id}`: the visitor chooses places of each
  ticket and gives a name and an address (`reserveRegistration`, an anonymous write bounded by PASS's request key and the authority's
  limits: ten requests a client in ten minutes, 500 a site an hour, five a buyer's address an hour, past which a request is refused
  and holds nothing); the places are held for the offer's hold minutes, or all waitlisted when they do not fit. The visitor names the
  attendees, answers the questions and accepts the terms (`completeRegistration`); a free registration is confirmed, a paid one pays
  on the payment provider's page (`startRegistrationPayment`; the offer's store's gateway, else the organization's), which returns to
  `/marketing/Register?ref=...&returnToken=...`. The provider's verified answer, never the return, confirms: the ticket order (storeless and
  taxed by the organization's own tax gateway, or the store's) is placed and approved, or waits in Sales' Awaiting approval list
  where the organization's Sales approval setting is on, the registration showing "payment received, awaiting the organizer's
  confirmation" with no ticket until then. The reservation's capability is kept in the visitor's session; the receipt's link opens
  `/marketing/Registration?token=...` (read once into the session, the address then `?ref=`), where the buyer sees each place, shows a
  confirmed place's entry code (the same code as in the ticket; the organizer issues a new one when it is lost) and cancels as the
  offer's cancellation rule allows (shown on Event, Register and Registration: until its deadline for its refund percentage, after it
  with no refund only where the rule allows, never after the start), a refund showing pending until the provider answers. The order is
  invoiced when it is approved, which captures its payment. A signed-in buyer whose own verified account bought it reaches it without a link. The payment step
  shows the amount due and Pay sends its key, so a price changed since is shown again, not charged. A provider page that takes a
  posted form (Authorize.Net Accept Hosted) is reached through `/marketing/RegistrationRelay` (`getRegistrationPaymentForm`, a fresh
  token each visit), the one Marketing route whose CSP adds `form-action https://accept.authorize.net https://test.authorize.net`; a
  proxy or CDN must pass its own `Content-Security-Policy` through. The six operations are POSTs in the deployment's token-write
  list. Jobs: `run_EventRegistrations` (every two minutes: payment results, hold expiry, waitlist offers, refunds) and
  `run_EventRegistrationNotices` (every fifteen minutes).
- **Remote frontend.** The `marketing/...` operations are PASS operations served by Mantle's PassApi (`getMarketingEvent` a read,
  as `getMarketingPage`); `requestSubscription` and
  `submitMarketingForm` (anonymous writes the transport lets through, bounded by the request key and the limits; an invitation's
  answer carries its link's token), `verifySubscription` (a link's token) and `recordTrackingEvent` (an anonymous write the authority's
  limits bound; a personalized link's token) are `TOKEN_WRITES`, accepted from a registered deployment without a member session.
  The registration's six operations are POSTs: `reserveRegistration` an anonymous write as `requestSubscription` is (the request key and
  the authority's limits), `completeRegistration`, `startRegistrationPayment`, `getRegistrationPaymentForm`, `getRegistration` and
  `cancelRegistration` carrying the reservation's capability, all six `TOKEN_WRITES`. The tracking web scripts reach the authority
  through the same transport, so a remote frontend records there with no Mantle of its own.
- **Visitor key through a remote frontend.** A remote frontend forwards the consented visitor key (its `mkt_vk` cookie) with a Shop
  checkout (`submitCheckout`'s `visitorKey`) and with Register's payment start (`startRegistrationPayment`'s `visitorKey`), so an order
  placed through it is attributed as a local one; the authority keeps only the key's digest, and only where a visit would keep the
  key. Both fields are new in the facade's schema: upgrade the authority before the PASS frontends, since an older authority refuses
  an operation naming a field it does not know.

## Shop app

Shop is a ProductStore's storefront (`screen/Shop.xml`, app `shop`; [design](../plan/design-shop.md),
[plan](../plan/impl-shop.md)). An operator mounts it with `store#Mounts`, its target the store (a ProductStore of an
internal organization); it may be the site's root app in place of Forum, and a site has one Shop mount. Account, Billing,
Support and the framework's paths keep their owners under a root Shop: the longest mount wins, and the framework's own
routes (`/rest`, `/static`, `/assets`, `/s`, `/u`, `/r` and the rest) are never a site's. For a root Shop the runtime's
`<public-site>` names `<mount path="/" screen="Shop"/>` beside the other apps' mounts. Shop's pages are concealed (Not
Found) until the site is published and its Shop mount enabled. The site's readiness (`checkReadiness`) adds Commerce's
store readiness (`mantle.product.StoreAdminServices.check#StoreReadiness`) under `shop`. On a Shop site the Account,
Billing and Support pages keep the PASS shell with the site's brand values from `PublicSite.theme` (a small JSON object:
`primaryColor`, `backgroundColor`, `textColor`, `surfaceColor` as six-digit hex colors, `logoUrl` a local path or https; an https logo's origin joins the shell's `img-src`).

Responses are `no-store` with the shell's CSP unless a route in `screen/Shared/Headers.js` says otherwise. Shop's
catalog routes (Home, `Categories`, `categories/{id}/{slug}`, `Search`, `products/{id}/{slug}`, `pages/{route}`,
`sitemap.xml`, `robots.txt`) are `public, max-age=60` with an ETag and `Vary: Cookie` to a request with no session cookie and no signed-in
user, and `no-store` otherwise; a CDN in front may keep them that minute. A withdrawal advances the site's generation and
reaches visitors within it.

**Catalog** (impl-shop P3; design-shop §5, §11). The pages show only what Commerce's publication resolver answers public
in the store for the site now, priced as the store's authority, with availability bands rather than quantities; a
product's or category's old slug redirects (301) to its canonical URL, a path the site redirects goes there, and anything
else not public is the theme's not-found page (404). A remote frontend keeps anonymous catalog reads for at most a minute,
keyed by the site's generation and release, and serves nothing cached when it cannot read the generation.

**Cart** (impl-shop P4; design-shop §6, §7.1). A cart is an open order of the store; the frontend keeps only the cart's
capability, in its own server session under the site (never a cookie or a URL), and sends it with each cart call. The cart
writes (`addCartItem`, `updateCartItem`, `removeCartItem`, `applyPromoCode`, `removePromoCode`) are `TOKEN_WRITES`, accepted
from a registered deployment; a visitor's first add has no capability yet and makes the cart. A guest's cart has no
party until its checkout begins, when its guest party is made. Cart creation, code tries and capability lookups are rate
limited by the visitor's address (a registered deployment's `x-pass-client-ip`), and a store's new guest carts by its
`PsstGuestCartsHourly` setting (1,000 an hour when unset; a store setting staff may change). Sign-in
attaches the session's cart to the account, or merges it into the account's own cart once; sign-out rotates the account's
carts' capabilities, so a shared browser keeps none. The Cart page (`/Cart`) and its transitions are `no-store`; a product
image is served at `media?productContentId=` after the authority checks its product is public. The purchase selection and
the cart are plain HTML forms; with JavaScript each is a trusted Vue island (`WebrootPublic.qvt.js` island mode loading
`Purchase.qvue` and `Cart.qvue`) over the same transitions.

**Checkout and payment** (impl-shop P5; design-shop §6, §7.2, §8). The Cart's Check out button begins the cart's
checkout (`/Checkout`: contact, delivery address, delivery option, payment option and review, each a plain form). Submitting
freezes it and starts the payment on the store's hosted payment gateway for the store's card payments
(`ProductStorePaymentGateway`, one whose gateway type has a hosted page: Authorize.Net with
`AuthorizeNetServices.authorizeHosted#Payment`, or the test gateway's `hostedPending`); `PaymentResult` links the provider's
page and polls the outcome (a same-origin script, `Checkout/enhance`); the provider returns the payer to
`{mount}/Checkout/return?ref=&returnToken=`, built from the site's canonical host, so the site needs one. For Authorize.Net Accept
Hosted the link goes to `PaymentRelay`, which asks the authority for a fresh form token on each visit and posts it to
Authorize.Net at once: only that route's CSP adds `form-action https://accept.authorize.net https://test.authorize.net`, and it
is `no-store`. Configure Authorize.Net's webhooks as `docs/AuthorizeNet.md` in mr-mantle says: a payer who never comes back
is reconciled by the webhook or by the `reconcile_StoreCheckouts` job (every five minutes), and `expire_StoreCheckouts`
expires unsubmitted checkouts; the store's readiness names either job when it is paused. The frontend keeps the checkout's
return key and a guest's order link in its server session, never in a page or URL it makes. The checkout's reads carry a
capability and are POSTs (`getCart` too), so no capability travels as a query parameter between a frontend and the
authority. A sign-in with no return path lands on the site's root app (Forum or Shop at `/`).

**Orders, account and downloads** (impl-shop P6; design-shop §9, §10). A signed-in buyer whose email is verified has
`/Account` (the store's purchases), `/Orders`, `/Orders/{orderId}`, `/Addresses`, `/PaymentMethods` and `/Downloads`; a
guest reaches the order of the session's order link (kept from the confirmation), or of an emailed link
`/Orders/Status?token=`, which the frontend keeps in its session and drops from the address. The order page links the
site's own Support pages with the order (Request a return, Ask a question, Request cancellation), so a Shop site needs a
Support mount targeting the store's organization (Commerce's readiness requires it). The order link reads; a guest's
return, question or cancellation by it also needs a one-time code the page emails to the order's address ("Email me a
code", 15 minutes, used once), so the organization needs an email address to send it from. A download (`/Downloads/file?grant=`)
issues a capability of ten minutes and streams the file at once with the browser's byte range; through a remote frontend
over REST the authority answers the range (206) itself. Cards are added on the store's gateway's hosted profile page:
for Authorize.Net through `MethodRelay`, whose CSP alone (with `PaymentRelay`) adds Authorize.Net's form-action. A Shop
order's digital lines are fulfilled once it is approved (POPC_DEFAULT's staff approve a new customer's order; a store can
turn Mantle's approval checks off with its `PsstOrdApprove*` settings): give the store a `PsetDownloadReady` store email
for the download notice and a `PsetInvoiceFinalized` one for the receipt; the `fulfill_StoreItems` and
`run_MessageDeliveries` jobs resume what a crash or a mail outage left. The PASS Account hub is `/account/Home`, the email
preferences page `/account/EmailPreferences` (a list link's token, its one-click POST at `EmailPreferences/oneClick`, and
each store's cart reminders).

**Operations** (impl-shop P8; design-shop §7.1, §8.4, §17.1). Mantle's `run_ShopOperations` job (hourly) retires expired
open carts through the order path once nothing of their money is unresolved (no checkout waiting, no unsettled attempt, no
payment that took money) and disables a retired cart's guest party that has nothing else; it also searches each recently
completed Accept Hosted checkout's reference once, after its form tokens expire, for a later second approval, which holds the
order (OhtPayment). `fulfill_StoreItems` also starts an approved Shop order whose fulfillment never started. A stuck placement
(a paid checkout whose order was not placed) is resolved in Commerce's CartDetail by a holder of
`COMMERCE_PLACEMENT_RESOLVE`: placed again, or its payment released or refunded and the cart cancelled. Withdrawing a Shop
mount (or restoring a theme) leaves placed orders and payments as they are; the reconciliation job still finishes open
attempts. Each job names its operation for the framework Monitor (`shop.checkout.reconcile`, `shop.fulfillment.run`,
`shop.operations.step`, ...). An existing store's adoption is previewed by Mantle's `preview#StoreAdoption` (read only:
template roles and wiki spaces mapped to the theme package with conversion findings, settings, gateways, facilities, emails,
and Commerce's publication proposal for a publisher to approve). On a remote frontend the site information every page reads
is kept for a visitor not signed in under the site's generation (read at most every two seconds); when the authority cannot
answer, nothing kept is served. Product images are `public, max-age=60` only under the current generation's link (`&v=`),
and only `dbresource://` and `component://` locations are read.

**Subscriptions, reviews, recovery and feeds** (impl-shop P7; impl-commerce P9, P10, P14). A store's recurring offers
(Commerce's paid-access editor, `store#RecurringOffer`) sell a term of a `SubscriptionResource`; a verified, signed-in buyer
subscribes with recorded off-session consent, and `/Subscriptions` lists the contracts (cancel keeps the paid term, change
the card, resolve a failed renewal). `store#RecurringOffer` keeps the site's `subscriptionUrl` on Shop's Subscriptions
page. Automatic renewal needs a gateway that charges a kept card off-session (Authorize.Net's CIM profile; the stored
credential indicators are untried against the sandbox, impl-shop F115). Review photos (PNG or JPEG) are staged under
`pass@media-root/reviews` and scanned by `pass@scanner-service` as the Billing and Support files are; with no scanner the
review keeps its text and refuses the photo. Cart recovery mails a signed-in customer who turned on the store's cart
reminders (`/account/EmailPreferences`) a link to `/Recover?recoveryToken=`, which the frontend keeps in its session; guests never get
one. A published product feed is served at `{mount}/feeds/{key}.xml` (or `.csv`) from its active build.

**Deploying a Shop site** (impl-shop P9). In order:
- **Hosts and mounts.** Give the site a canonical host (the provider's return address and every emailed link use it) and
  mount Shop with `store#Mounts` as an operator, at `/` or `/shop`, targeting the ProductStore; mount Account, Billing and
  Support beside it (Support targeting the store's organization: the order page's return, question and cancel links need
  it). For a root Shop add `<mount path="/" screen="Shop"/>` to the host's `<public-site>`; the other apps' paths and the
  framework's stay theirs. Publish the site once `checkReadiness` shows Shop's findings resolved.
- **Payments.** Bind the store's card payments (`ProductStorePaymentGateway`, `PiCreditCard`) to a gateway with a hosted page:
  Authorize.Net Accept Hosted (mr-mantle `docs/AuthorizeNet.md`: API login, transaction key, signature key, the webhook
  endpoint and its events; `merchantName` set) or, in development only, the test gateway's `hostedPending`. Keep the
  credentials in the authority's conf, never on a frontend. The checkout and payment-method pages keep PASS's CSP
  (`form-action 'self'`); only `PaymentRelay` and `MethodRelay` add `form-action https://accept.authorize.net
  https://test.authorize.net`, since Accept Hosted takes its form token by an HTML POST (impl-shop F37). A proxy or CDN
  must pass those routes' own `Content-Security-Policy` through, not replace it. Tax and shipping are the store's Mantle
  gateways (Shippo for rates and address checks), set in Commerce's CheckoutSettings.
- **Email.** The store's emails (`ProductStoreEmail`): order placed and approved, `PsetInvoiceFinalized` (the receipt),
  `PsetDownloadReady`, `PsetSubscriptionRenewal`, `PsetPaymentRetry` and the cart reminder; an email server the
  authority reaches.
- **Media.** `pass@media-root` on private storage and `pass@scanner-service` (below, "Mail, accounts, and media") for review
  photos; product images are read only from `dbresource://` and `component://` locations.
- **Caches.** Anonymous catalog pages are `public, max-age=60` with an ETag under the site's generation; everything with a
  session or a user is `no-store`. A CDN may keep catalog pages for that minute; it must keep nothing marked `no-store` and
  must forward cookies, since a cookieless anonymous catalog response is the only kind marked public and it sets none. Theme assets under
  `{mount}/theme/{digest}/` are `public, max-age=31536000, immutable`, whether the frontend is local or remote. A remote frontend keeps anonymous catalog reads and the site information under
  the generation, and serves nothing kept when the authority cannot answer it.
- **Jobs.** Mantle's jobs, each in its own transaction per item (one failing is named and the rest go on); keep them
  unpaused (the store's readiness names a paused checkout job) and watch their `operation` marks in the framework Monitor:

  | Job | Schedule | What it does |
  | --- | --- | --- |
  | `reconcile_StoreCheckouts` | every 5 minutes | finishes checkouts whose payer never returned: looks up the payment, places the order |
  | `expire_StoreCheckouts` | hourly | expires unsubmitted checkouts |
  | `fulfill_StoreItems` | every 5 minutes | captures, invoices and grants paid digital lines; resumes a crashed run; starts an approved Shop or renewal order whose fulfillment never started |
  | `run_MessageDeliveries` | every 2 minutes | sends the delivery ledger's notices (downloads, renewals), retrying a mail outage |
  | `run_StoreRenewals` | hourly | starts due renewals (one occurrence and order per period), retries failed ones, sends their notices |
  | `run_ShopOperations` | hourly | retires expired carts and their guest parties; searches recent Accept Hosted references for a second approval |
  | `run_CartRecovery` | every 10 minutes | sends cart reminders for stores that turned recovery on |
  | `run_StoreFeeds` | hourly | builds and publishes scheduled product feeds |
  | `expire_SubscriptionAccess` | every 10 minutes | revokes paid access once its term ends |

  A paid checkout whose order could not be placed (it changed after the payer paid, or its tries ran out) waits in
  Commerce's CartDetail for a holder of `COMMERCE_PLACEMENT_RESOLVE` to place it again or give the payment back.

**Themes** (impl-shop P2; design-shop §12). Commerce staff start a theme from the starter (`theme/starter/`, starter
`mr-pass/starter`), validate and publish it to a site's Shop mount (`mantle.public.ThemeServices`); with a published
release Shop's pages are the release's own documents instead of the PASS shell, and its assets are served under the
mount at `theme/{manifest digest}/{path}`, immutable. A remote frontend fetches the active release's manifest and files
over its authority connection (registered clients only), checks every digest and keeps the release; one it cannot
verify, or an engine or view API it does not have, shows a safe "not available" page. The renderer's budgets are
lowered in conf with `<resource-facade><theme-limits .../>` (mr-moqui `docs/ui/Themes.md`).
A release's images and fonts (`assets/*.png`, `.jpg`, `.gif`, `.webp`, `.woff2`) are pinned by the SHA-256 of their
bytes and named in the package by reference (`{digest, size, contentType}`), so the render package stays text; a frontend
reads an asset's bytes only when it is asked for, by release, path and digest (`getShopThemeAsset`, registered clients
only), and serves them `public, max-age=31536000, immutable`, also over gRPC. A release published before carries them as
base64 text, digest-checked like the text files, and still serves them.

**Theme preview host** (impl-commerce P5, F54; design-shop §12.6). Commerce's ThemeEditor frames a draft from a site's
preview host, which serves only `/preview/{token}` and its assets `/preview/{token}/asset/{path}` and answers Not Found for
every other path. To give a site one:
- bind the host to the site as a preview host (`store#Mounts` with `{hostname, preview: true}`; a PublicSiteHost row of
  kind `PshkPreview`, never canonical, which page links, `sitesFor` and readiness ignore);
- give the authority's runtime a `<public-site>` for it with one mount at the root, so it claims every path of the host,
  and Mantle's preview host check, so the framework's own routes are refused there:
  `<public-site host="preview.shop.example.com" site-id="SHOP_SITE" screen-location="component://mr-pass/screen/Pass.xml"
  resolver-service="pass.RouteServices.resolve#Route" host-check-service="mantle.public.ThemeServices.get#PreviewHost">
  <mount path="/" screen="Shop"/></public-site>`;
- set `pass@preview-frame-origins` to the BOSS origins that may frame it (`https://boss.example.com`; `http://localhost:*`
  in development). Unset, the preview is not framed at all.

Previews are served only by the authority's runtime (a remote frontend has no Mantle in process and treats every host as
live). A preview page is `no-store`, `noindex`, sends no referrer and has its own CSP (a script only by nonce, no form
action, `frame-ancestors` the origins above); its capability is the token in its path, valid for twenty minutes for one
site, theme draft and staff user. With the `host-check-service` the framework's own routes (`/apps`, `/qapps`, `/rest`,
`/Login`, the token routes and the rest) answer Not Found on the preview host, so nobody signs in there (Commerce F87);
the static files the preview loads (`/js`, `/css`, `/libs`, `/images`, `/static`, `/assets`) still answer. Keep the
preview host's name apart from the BOSS host's all the same.

## Smithy app

Smithy (`screen/Smithy.xml`; [design](../plan/design-smithy.md)) is public git hosting over the framework's git host and
Mantle's `mantle.smithy` services: groups, repositories, their code, their issues, their merge requests and their pipelines,
and the site around them (a group's landing page, Docs, Releases, the component directory, search and the old paths of a
site's move). It runs where the git data is, so mount it on the
authority's own instance. It is bound to no business record (no target), a site has one Smithy mount, and it may be the
site's root app:

```xml
<public-site host="code.example.org" site-id="EXAMPLE" screen-location="component://mr-pass/screen/Pass.xml"
        resolver-service="pass.RouteServices.resolve#Route">
    <mount path="/" screen="Smithy"/>
    <mount path="/forum" screen="Forum"/>
    <mount path="/account" screen="Account"/>
</public-site>
```

Or under a path beside another root app: `<mount path="/code" screen="Smithy"/>` (`/code` is its default base). The
site's own mount rows (`mantle.public.SiteServices.store#Mounts`, `{app: 'smithy', pathPrefix: '/'}` or `'/code'`) must
name the same path, as for every app.

Smithy decides whether a pipeline run may start and where a run's page is: Mantle's `MoquiConf.xml` names
`<git-ci run-check-service="mantle.smithy.SmithyPipelineServices.check#Run" run-url-service="mantle.smithy.SmithyPipelineServices.get#RunUrl"/>`,
and a runtime conf that sets `git-ci`'s `run-check-service` or `run-url-service` itself must name the same services. The
check fails closed: a hidden repository (or one in a hidden group, or a fork of a hidden one), a repository with pipelines
off and an owner with no runner minutes left run nothing (Pipelines, below).

- **Paths.** A page's path is names, then a section after `/-/`: `/<group>[/<subgroup>…]`, `/<group>/<repository>`,
  `/<group>/<repository>/-/tree/<ref>/<path>`, `/-/blob/…`, `/-/raw/…`, `/-/commits/<ref>`, `/-/commit/<id>`,
  `/-/blame/…`, `/-/compare/<base>...<head>`, `/-/branches`, `/-/tags`, `/-/archive/<ref>.zip`, `/-/issues`, `/-/issues/new`,
  `/-/issues/<n>`, `/-/labels`, `/-/milestones`, `/-/merge-requests`, `/-/merge-requests/new`, `/-/merge-requests/<n>` (and its
  `/commits`, `/changes`, `/checks`), `/-/pipelines`, `/-/pipelines/<n>`, `/-/pipelines/<n>/jobs/<id>` (and its `/log`, the log's
  lines as JSON), `/-/artifacts/<id>/<name>`, `/-/fork`, `/-/forks`, `/-/edit/<ref>/<path>` (and `/-/new/…`, `/-/upload/…`,
  `/-/delete/…`), `/-/forum[/…]`, `/-/moderation[/…]`, `/-/docs/<ref>/<path>`, `/-/releases`, `/-/releases/<tag>`,
  `/-/release-assets/<id>/<name>`, `/-/settings/<tab>`, and `/<group>/-/repositories`, `/-/issues`,
  `/-/forum[/…]`, `/-/members`, `/-/moderation[/…]`, `/-/addons.xml`, `/-/settings/<tab>`; `/explore` lists what the visitor
  may view (groups, repositories and components), `/-/search?q=` searches it, and `/new/group`, `/new/repository` and `/-/site` are
  the create pages and the site's settings. `service/pass/SmithyRoutes.js` holds the grammar, and Mantle tells a group from a repository
  and a ref from a path. A name in another case, a `.git` suffix, a renamed path and a GitHub form
  (`/<group>/<repository>/blob/main/README.md`) redirect (301) once Mantle has found something the visitor may view.
  Because the first segment of a path is a group or a handle, mount the other apps at their own paths and keep group
  names off them (Mantle reserves the mounts and the framework's routes).
- **Clone addresses.** The clone box shows the HTTPS and SSH addresses Mantle answers. Mounted at `/`, a repository's page
  URL is its clone address too (the framework sends git's requests on a public-site host to the git handler); under
  another mount the address is `/git/<path>.git`, which works on every host of the instance.
- **Access.** What a visitor may not view (a members-only or private repository, a hidden one, a group not yet active) is
  Not Found on every page and path, the same as what does not exist.
- **Caching.** A read page is `public, max-age=60` only for a request with no session cookie and no signed-in user, which
  sees public repositories alone, and that answer has `Vary: Cookie`; every other request, and every answer to a form's
  post, is `no-store` (`screen/Shared/Headers.js`). An issue page (`/-/issues…`, `/-/labels`, `/-/milestones…`) and a commit's page
  (`/-/commit/<id>`, which names its issues) are `no-store` for a visitor too: an issue may be made confidential, and no
  cache should still have its page. A merge request's pages (`/-/merge-requests…`; one may be held for review), the pages
  that edit a file and the fork pages are `no-store` for a visitor as well, and so are the forum's pages inside a group or a
  repository (`/-/forum…`), the moderation pages (`/-/moderation…`) and the pipeline pages, a job's log and an upload
  (`/-/pipelines…`, `/-/artifacts/…`: a log holds whatever a job printed), a release's file (`/-/release-assets/…`) and
  the Search page (`/-/search`, which lists issues). A group's `addons.xml` is `public, max-age=300` for a visitor of a
  public group and `no-store` otherwise. The Issues and Merge requests tabs show their
  counts to a signed-in account only. A raw file is served as
  plain text, a still image or a download, with `nosniff` and a sandboxing CSP, never as a page of the site.
- **Scripts.** The pages are plain HTML and load no script; code is shown as escaped text with line anchors (`#L10`).
  The one exception is a form with a text on an issue page (a new issue, a comment, an edit), shown to a signed-in
  account: it loads the framework's Vue scripts for the editor (`/-/island/Composer.qvue`, Markdown or rich text with a
  preview in the page). Without JavaScript the form is a Markdown textarea with a Preview button. Two more pages load
  them, with the framework's code widgets (`/js/WebrootCode.js`, which loads CodeMirror from `/libs/codemirror` when an
  editor mounts): a merge request's Changes (`/-/island/DiffReview.qvue`: a line's comment form opened in place, a file
  side by side) and a file's edit page (`/-/island/Editor.qvue`: the code editor over the plain textarea). Both pages
  work without them: the diff is escaped text with an anchor and a comment link for each line, the editor a textarea.
  A running job's page loads them for the live log (`/-/island/JobLog.qvue`): it reads the job's new lines from
  `…/jobs/<id>/log` every two seconds (a page or a read holds at most about 256 KB, and the next read waits as long), and at
  once when the framework's notification socket says the log grew (a signed-in account only; its path is the
  `pass@notification-endpoint` property, `/notws` when it is not set, and an empty value turns the socket off; a host
  that refuses the socket is given up after its first try); without it the page has Refresh and Load more. A log, a test's
  name and message and a step are shown as escaped text with terminal escapes, control characters and bidirectional
  overrides taken out.
- **Issues.** A repository's Maintainer turns issues on in its Settings (General); the repository then has the Issues
  tab, Labels and Milestones, and its project in Projects holds the tasks. An issue's conversation is posts of the
  forum's engine, so the site's posting policy, trust levels, word rules, review queue and notification mail apply to
  issues and comments as they do to topics, and a held one shows "Waiting for review" to its author. A confidential
  issue is read by the Owners of the repository and of the groups above it, the site's operators, and its reporter
  (what was filed and the answers); for everyone else its number is Not Found. An Owner makes it public, or a public one
  confidential, on the issue's page, which asks again first.
- **Merge requests.** A repository has them unless its Maintainer turns them off (Settings, General). One is opened from a
  branch (Branches, Compare, or `/-/merge-requests/new`), from a fork's branch (`<group>/<repository>:<branch>` as the
  source), by a push to `refs/for/<branch>` from any account that may view the repository, or by an edit on a file's
  page. Its conversation is posts of the forum's engine, as an issue's is, so the site's posting policy applies: one
  that is held shows "Waiting for review" to its author and is Not Found to everyone else until a moderator approves
  it. A merge and a close are asked again on a page of their own; who may merge, the allowed methods, the approvals and
  the required checks come from the branch rules (Settings, Branch rules). `git fetch origin refs/merge-requests/<n>/head`
  fetches one. These are set in mr-mantle's `MoquiConf.xml` on the `git-server` element, and must be kept when a
  runtime's conf replaces it: `review-start-hidden="true"` (a merge request from a push for review, a proposal or a
  fork is not readable until Smithy's handler has passed its text through the post gate),
  `reserved-status-contexts="agreement/,ci/"` (no user reports those checks; the agreement check and the CI engine
  do) and `merge-request-url` (the page a push's answer names). Mantle sets it to
  `/{repositoryPath}/-/merge-requests/{mergeRequestNum}`, which is right only where Smithy is the site's root app: with
  Smithy under a path, set it in the runtime's conf with that prefix (`/code/{repositoryPath}/-/merge-requests/{mergeRequestNum}`). The
  framework's `review-push`, `review-max-push-bytes` and `review-max-account-bytes` bound pushes for review
  ([Git-Hosting](../../../../../docs/interfaces/Git-Hosting.md)).
- **Pipelines.** The engine is the framework's ([Pipelines](../../../../../docs/interfaces/Pipelines.md): a runner
  machine that is not the server, an `InstanceHost` for it, the `moqui-build` image, `git-ci` `server-url`). A
  repository's Maintainer turns pipelines on (Settings, General); the repository then has the Pipelines tab, and a push or
  a merge request runs the pipelines of the `ci.xml` at its commit (a Moqui component with none runs the built-in one).
  What an operator sets up:
  - **Pools.** Smithy uses the enabled `GitRunnerPool` rows (System data or `org.moqui.git.GitCiServices.store#RunnerPool`)
    that have no `ownerId` (shared by the site) or the owner of the runs: `smithy:group:<groupId>` for a top-level group (its
    subgroups' repositories count under it) and `smithy:account:<siteId>:<partyId>` for an account's own repositories. A pool
    is `trusted` (runs of the repository's own branches and tags, pushed or asked for by a Developer, which get secrets) or
    not (outside runs: a fork's merge request, a push for review, an account below Developer; no secrets, a read-only
    cache). Allow at least one of each to a group, or outside runs have nowhere to run. A group's Owner chooses among the
    pools it is allowed (the group's Settings, Pipelines); with no choice the engine takes a pool of the job's pool name
    that takes the run's trust, the owner's before a shared one. A subgroup's form holds its own choices ("As the group
    above says" where it has none, with the choice in effect beside it), and a save changes only what was changed.
  - **Runner minutes.** Counted by month for each owner as its jobs end (`GitRunnerUsage`). A group has the site's
    default for a group (2000 a month until `/-/site` says otherwise, "Default limits of a group"), an account the
    default for an account (0: a personal repository runs nothing until an operator gives its account minutes on
    `/-/site/quotas`), each changeable for one group or account on `/-/site/quotas`. A run that would start with the
    month used up is refused (`quotaExceeded`), and so is a run by hand or a retry; the run's page and its check say why.
  - **Outside runs.** The first run of a contributor with no merged merge request waits for a Maintainer's "Approve and
    run" on the run's page or the merge request's Checks (`first`, the default); `/-/site` sets `always` or `never`, and a
    group's Owner may set its own. The forum's daily limit of pipeline runs (by trust level) bounds the runs an account asks
    for by hand and its outside runs.
  - **The run's page.** A status links to its run on the site's canonical host (a `PublicSiteHost` with `canonical`, and
    the Smithy mount), which `get#RunUrl` builds; a site with no canonical host writes statuses with no link.
  - **Secrets and environments.** A repository's Maintainer adds them on Settings, Pipelines: a secret's value is written
    once and never shown or kept for the next page; it is given to a trusted run of a protected branch, of a tag or of an
    environment the run is allowed.
- **Forks.** Site settings say who may fork (`/-/site`, with who may create). A fork goes to the account's own namespace,
  so the account needs a handle (its profile in the Account app), or to a group where it is a Maintainer; it is no
  wider than its parent, and a parent with forks is not deleted.
- **Editing a file.** A signed-in account with a confirmed address edits a text file on its page (Edit, New file,
  Upload, Delete; a rename is an edit of the path), up to the site's edit size (`/-/site`, "maxEditBytes", 1 MiB by
  default) and not a file in Git LFS. The save is a commit by the account: to the branch where it may push, to a new
  branch with a merge request (the default on a protected branch), or as a proposal with no fork when it may only
  view. The text of an unfinished edit is kept in the server session for the one next page (the save step, a preview,
  a conflict), up to two minutes. An upload (any type of file, at most the edit size and 10 MiB) is staged and scanned as a forum
  attachment is, so the media scanner must be configured for uploads to be accepted.
- **The contributor agreement.** Off by default. An Owner turns it on for a group or a repository (Settings, Agreement:
  inherit, off or required, and the file, `AUTHORS.md` by default, which must be in the repository first). Mantle then
  requires the check `agreement/authors` in the branch rules, computes it for every merge request, and the merge
  request's page says who is missing what, with a link that opens the file's edit page so the account adds its own
  line under both lists. An account is matched to a commit's author by its confirmed addresses.
- **Who may create.** The site's owners and operators set it on `/-/site` under the mount (Site settings in the header):
  who may create a group, a repository of their own and a fork (operators only; by request, which an operator approves or
  refuses on `/-/site/requests`; any account with a confirmed address), the kind of a repository made on a page (`db`, or
  `local` for a directory of the server), the default limits of an account and of a group, and on `/-/site/quotas` the
  limits of one account or group. Until the settings are saved, a group is by request and a repository of one's own is
  open to any confirmed account. A site owner's own group is created at once.
- **Writes.** Every write needs a signed-in account with a confirmed email address, so configure verification mail
  before opening the site (the Account app's settings are where an account confirms it). A form posts to `/-/do/<name>`
  under the mount with the session token and is answered by a redirect; an ending action (delete, transfer, archive, a
  visibility change) is asked again on a page of its own.
- **Git access.** `<account base>/GitAccess` (linked from the header, the clone box and the Account hub's card) is where
  an account adds an SSH key and makes an access token; it is Not Found on a site with no Smithy mount. A token is shown
  once. Over HTTPS git takes the account's username and a token. Git over SSH for a public account needs
  `<ssh-server git-any-account="true">` in the runtime's conf ([Git-Hosting](../../../../../docs/interfaces/Git-Hosting.md)):
  git by public key for any account, each repository's own check still deciding. Without it only accounts with the
  `SSH_GIT` permission use git over SSH, and the page's SSH address does not work for the others. A password login over
  SSH still needs `SSH_GIT` and `git-password-auth`. `<dav-server sftp-drives>` is a separate setting: look at it too
  before opening the SSH port of a public site.
- **The Forgejo API.** Where Smithy is mounted at `/`, the site answers a part of Forgejo's REST API at `/api/v1`, so
  Forgejo clients work with it: `tea login add --url https://code.example.org --token <token>`. Use an access token
  from Git access, sent as `Authorization: token <t>` or `Bearer <t>`. A token has its account's rights, and each route
  keeps its page's rules. Under a path mount (`/code`) and on other hosts, `/api/v1` stays the framework's. It works in
  local mode only: a remote frontend's authority refuses access tokens. Routes and limits:
  [design §4.5](../plan/design-smithy.md#45-the-forgejo-api).
- **Quotas.** A push is checked against the namespace's limits by Mantle's pre-receive rule. Git LFS uploads are checked
  by `<git-server lfs-upload-check-service>`, which mr-mantle's `MoquiConf.xml` sets; keep it when a runtime's conf
  replaces the `git-server` element.
- **Downloads.** A tree's zip or tar.gz (`/-/archive/<ref>.zip`, `.tar.gz`) of a public repository is served to anyone
  (addons.xml's archive locations need it), of any other to a signed-in account. `git-server` `archive-max-bytes` and `archive-max-files` bound it, and `blame-max-bytes` and
  `blame-max-commits` the Blame page.
- **Push.** A push needs a role of Developer or higher in the repository and a confirmed address; branch rules and
  webhooks are a repository's Settings (a Maintainer's), its members, visibility, transfer, archive and delete an Owner's.
- **The forum in a group and a repository.** A site has one forum. A group has a category in it, and its Owner shows it
  on the group's Settings, Forum tab ("Turn the forum on", which publishes the category); a repository's Owner turns its
  own subcategory on in the repository's Settings, once the forum of the group above is on. The category is read by
  whoever may view the group or the repository, never more widely. The forum's own pages are then at
  `/<group>/-/forum` and `/<group>/<repository>/-/forum`, limited to that category and what is below it, inside the
  group's or the repository's page with the Forum tab: the topic list, a topic (`…/-/forum/t/<id>/<slug>`), the
  categories, tags, search, the composer (a new topic starts in the scope's category) and the feed
  (`…/-/forum/feed`). `/forum`, where the site mounts it, stays the whole site's forum, and a topic's canonical address
  is the one there; a site need not mount `/forum` for the groups' forums to work (their mailing lists included: a
  list's links are in its group's or repository's forum), but Messages, Drafts, Bookmarks and the forum's own settings
  are pages of that mount only. Linking an existing category of the site in place of a group's or a repository's own
  is for the site's owners, and is refused when it would open the category to more readers than it has. A topic there has "Make an issue" for a Reporter of a
  repository: the issue quotes the chosen posts and each links the other.
- **Moderation in a group and a repository.** Smithy has no moderation of its own: what a public account writes (a
  topic, an issue, a comment, a merge request) passes the forum's gate, and what is held or reported waits in the
  forum's review queue. The Owners of a group see the queue and the log of their group's category and what is below it
  at `/<group>/-/moderation` (the Moderation tab), a repository's Owners at `/<group>/<repository>/-/moderation`; the
  site's own moderators keep `/forum/Moderation/ReviewQueue`, and internal moderators BOSS Comms. A signed-in account
  with a confirmed address reports a group or a repository ("Report this repository"); the report waits in the queue of
  the group above it, or the site's for a top-level group. An Owner of a group above, and the site's owners and
  moderators, hide a repository or a group ("Hide it", asked again with a reason, or the decision "rejected" on its
  report): it is then Not Found to everyone but its owners and the site's moderators, on its pages and in git, nothing
  is deleted, and they show it again the same way. What the site's staff hid, an Owner does not show again.
- **Security reports by mail.** A group's Owner names an address and the repository that takes the reports (Settings,
  Forum tab, "Security reports by mail"); an owner or a moderator of the site turns the address on. The address's
  domain must be one of `pass@route-domains` and its mail must reach the forum's inbound account, as a route address's
  does (Inbound email, below). Mail to it from an account's confirmed address files a confidential issue as that
  account. Mail from any other address is not posted: it is held for 30 days, its sender gets one reply a day with the
  link `/-/held-report/<token>` under Smithy's mount, and the repository's Owners see it waiting in their review queue.
  The link's page asks a visitor to sign in or register; the account whose confirmed address sent the message then
  files it with the page's form. Outbound mail must be configured for the reply to be sent.
- **The landing page.** The site's home (`/-/site`, "Home group") shows the home group's page. A group's Owner makes its
  page a Markdown file of a repository on the group's Settings, General, "Landing page": the repository's path and the
  file (`moqui/site`, `landing.md`), read at that repository's default branch, cleaned, and edited as any file is ("Edit
  this page"); the repository must be seen by everyone who sees the group. Its relative links lead to that repository's
  pages. Beside it: the group's pinned repositories, the latest published release of its repositories, news (the latest
  topics of a forum category whose id the Owner names there, readable by everyone who sees the group; a release
  "announced" posts there) and what happened lately in the repositories the visitor views. The site's other pages (the
  license, how to contribute) are files of the same repository, shown by Docs.
- **Docs.** A repository's Maintainer turns Docs on (Settings, General, with the directory, `docs` by default); the
  repository then has the Docs tab: `/-/docs` is the directory's `README.md` at the default branch, `/-/docs/<ref>/<path>`
  a Markdown page at a branch, a tag or a commit, with a picker of the branches and tags, the table of contents of the
  directory (a directory's `README.md` is its index; at most 500 files and five levels), the page's headings with stable
  anchors, Edit this page at a branch, and a search box (the docs at the default branch, on the Search page). A link to a
  Markdown file of the directory is its Docs page at the same ref, another file its file page, an image its raw file.
- **Releases.** A repository has the Releases tab: a release is Mantle's release of the repository's project, made of a
  tag by a Maintainer (New release on `/-/releases`, a draft until published) with a name and Markdown notes, which pass
  the forum's gate. Publishing (asked again on the release's page) adds the files the tag's latest successful pipeline run
  uploaded; a Maintainer attaches more (an upload of at most 10 MiB, scanned as an attachment is, or a file of the tag's
  pipeline run, or a container image's name), removes one, announces the release in the news category of the nearest
  group that has one, and withdraws it (the tag stays). A release's files count against the namespace's Git LFS limit.
  Downloads are for whoever may view the repository (a draft's for its Maintainers), as attachments named by Mantle,
  never kept by a cache; a file a pipeline run uploaded is sent from the run's artifact, which the release keeps. The
  source archives of the tag are the Files' downloads.
- **The component directory.** A repository whose root has a `component.xml` at its default branch is a Moqui
  component: Mantle reads its name, version and `depends-on` on each push (`Smithy.gitecas.xml`). Explore lists the
  components the visitor may view, with their latest release. Each group serves `/<group>/-/addons.xml`: the public
  components of the group and its subgroups, in the format `./moq component-get` reads, with the site's clone and archive
  addresses (from its canonical host; a public repository's archive needs no account). To take a component from it, copy its
  `repository` element and the `component` elements wanted into your `myaddons.xml`, or save the file as
  `myaddons.xml`:

  ```sh
  curl -s https://code.example.org/moqui/-/addons.xml > myaddons.xml
  ./moq component-get mr-example
  ```

  A members-only or private component is not in the file; take it with git and an access token (Git access).
- **Search.** `/-/search?q=` (the box in the header) searches repositories, groups, components, issues, merge requests, docs
  pages and forum topics, each by its own rule (a confidential issue, a held merge request and a private repository's
  items are found only by who may read them), narrowed to a kind, or to a group or a repository with `?in=<path>`.
  Code search is not built. The page is not at `/search`: the framework's default conf has its OpenSearch proxy
  there (a servlet, which answers on every host ahead of any page), so `/search` is never a page of a site.
- **Redirects for a site move.** The site's owners keep a table of old addresses on `/-/site/redirects`: an old path (or a
  whole address, whose host is kept: `https://forum.example.org/t/12`) and its target, a path of the site or an https
  address of one of its hosts. A request that no mount and no Smithy name takes is looked up there before Not Found,
  for the request's host and then for any of the site's hosts, and answered with a 301. For a move, give the old host
  names to the site as hosts too (Several sites by host name, above), then import the inventory as CSV on the same
  tab, one line an address (`old,target,note`; a first line of column names is skipped). An import runs twice safely: an
  old address it has takes the new target, and a line that is not taken is named in the notice. The forum's own Discourse
  addresses are its `ForumLegacyUrl` rows (Entitlements, operations and imports, below). Mantle's `resolve#Redirect` is
  local to the authority: a remote PASS frontend answers Not Found for an old path.

## Adding an app

An app registers in these places: its name, target type and readiness service in the authority's
`mr-mantle/service/mantle/public/PublicApps.js` (`root` if it may mount at `/`, `onePerSite` for one mount a site); its root
screen and default path in `service/pass/Apps.js`; a `subscreens-item` of `screen/Pass.xml`; its branch of the header's
navigation (`screen/Shared/Header.html.fancy`); its operations in `service/pass/Schema.js` and `Routes.js` with Mantle's
copies (`ForumSchema.js`, `script/PassRoutes.js`), which Forum's spec keeps identical, each mapping to a Mantle service
taking PASS's `input` map (an app may keep its operations in a file of its own that `service/pass/Facade.js` merges, as
Smithy's `SmithySchema.js` is a copy of Mantle's `service/mantle/smithy/SmithySchema.js`, kept identical by Smithy's spec); a bearer link's write in the three `TOKEN_WRITES` lists (`service/pass/Transport.js`, Mantle's
`script/PassApi.js` and `script/PassAuthority.js`); a refusal reason a page shows in `PassAuthority.js`'s `REASONS` and
`screen/Shared/Portal.js`'s `reasons`; its mount in the test runtime (`test/MoquiConf.xml`) and Portals' spec's list of
targeted apps. Then mount it in the runtime's `<public-site>`.

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
`pass-authority@verification-template`. The verification template receives `verificationToken`; render a
link/code for the deployment's Register page. Never put provider credentials in site records.
Public signup creates a disabled framework account. Verification is single-use; verified site
joining links/creates the backend Party without assigning an internal group. Invitation signup
requires its intended email and a valid invitation token.

Register comma-separated `pass@sender-addresses` and `pass@mail-template-ids` on the authority.
The selected template's configured sender must match the registered sender. A sender serves a site
when its domain is exactly one of the site's host names; for any other site (a sender of a parent
domain, `forum@example.com` for `forum.example.com`, or of a custom domain) name the site for it in
Mantle's `mantle@forum-sender-sites` (`forum@example.com=SITE_A;SITE_B, ...`). Configure per-site
mail settings through the Mail screen.

**Upgrading:** a site whose stored mail settings name a sender of a parent or other domain sends
nothing until the operator adds it to `mantle@forum-sender-sites`: the settings are checked against
the registration each time mail is sent, and the authority logs one error for the site, naming the
reason, until they hold again. Notification templates receive `title`, `siteId`,
`rootCommEventId`, `postId`, `postUrl`, `reason`, and `unsubscribeUrl`; mailing-list (Every post)
mail also receives the sanitized post as `body`, and a digest receives `topics` (`title`, `url`).
Private conversation notices carry only a generic title and link. Forum email opt-out changes
delivery preferences, not membership or in-app notifications, and may be widened to the whole
site. Replies thread under the member's earlier mail through In-Reply-To and References.
Posting policy defaults (two first contributions held for approval, ten seconds between posts,
trust-level daily and per-post limits) are set per site on the Policies screen, which accepts
only settings at least as strict as the defaults.

### Inbound email

Register the domains forum route addresses may use in comma-separated `pass@route-domains` on
the authority. Site owners then add route addresses on the Mail screen: a category address starts
topics and accepts replies; an address without a category accepts replies only. Each email notice
carries a reply address with a hashed, expiring token in its plus tag, issued to that recipient for
that thread. Point the route addresses at a hosted or shared mail account behind the trusted edge
gateway (`docs/interfaces/Mail-Inbound.md` in mr-moqui), fed by the mail listener, and name that account (its
`emailAccountId`) in `mantle@forum-inbound-accounts`: the forum reads a route's mail only from an account listed there,
whoever owns it, never from a person's or an organization's mailbox that holds the same address, nor from a synced
(IMAP or POP) account; mail to a route on any other account is logged as a warning and left alone. A route address that
is a person's or an organization's own address is refused. The `ForumInbound` email ECA handles each stored message. Set `smtp-server@authserv-id` on the authority to the gateway's authserv-id (one id: the
listener matches it exactly): mail counts as authenticated by the gateway only when the message's topmost
`Authentication-Results` field has that id. Left empty, a listener that verifies mail itself (an edge node, or
`smtp-server@internet`) writes and is trusted under its hostname; behind a gateway, no mail counts, so nothing is posted
or filed by mail. A sender must be one verified account
address with DMARC, or aligned DKIM, passing there. Nothing creates accounts from mail, and unknown senders get no reply.
Automatic replies and the forum's own mail are ignored, delivery reports mark hard bounces and
stop that member's email, and a failed message can be retried from the Mail screen. A mailing list's address and a
security report address answer an unknown sender once and hold the message (Mailing lists, below, and the Smithy
app's "Security reports by mail").

### Mailing lists

A mailing list is a category whose mode is `list`, with a route address of its own. On a site with Smithy the forms
are on a group's or a repository's Settings, Forum tab, once its forum is on; an owner of the site sets the mode and
the address, and the group's or the repository's Owner imports the archive and invites the members.

1. **The address and its mail route.** Choose the list's address (`dev@lists.example.org`) in a domain you receive
   mail for, and add that domain to `pass@route-domains`. Publish the domain's MX record to the edge gateway (or the
   mail server whose account the listener syncs), and its SPF, DKIM and DMARC records for the mail the list sends, as
   for every sending domain. Deliver the address to the forum's inbound account as every route address is delivered
   (Inbound email, above). Then set the category's mode to "Mailing list" and save the address ("List address"; on the
   site forum, the Categories and Mail settings).
2. **Headers.** A list category's mail carries its own `List-Id` (`"<name>" <dev.lists.example.org>`, the address with
   its `@` as a dot), `List-Post` (`<mailto:dev@lists.example.org>`) and `List-Archive` (the category's page), so a
   subscriber's mail filter tells the lists apart; other forum mail keeps the site's `List-Id`. An issue's or a merge
   request's mail carries `List-Id: <repository path with dots>.<host>`.
3. **Posting by mail** needs an account with a confirmed address, as on the pages. A message from an address that is
   no account's is not posted: it is held for 30 days, its sender gets one reply a day with a link
   (`<forum>/held-mail/<token>`, in the forum the list is read in: `/forum`, or for a list of a group or a repository
   `/<group>[/<repository>]/-/forum`) to sign in or register with that address and post it, and it is posted by itself when
   an account verifies that address. The list's moderators see it waiting in the review queue and may drop it.
4. **Spam.** Mail the gateway marked as spam (the listener's Junk folder, or `X-Spam-Flag`, `X-Spam-Status` or `X-Spam`
   on the message) is never posted and its sender is not answered: from an account it is held in the review queue with
   the reason `mail-verdict`; from any other address only its receipt is kept (Mail settings, Inbound messages).
5. **Importing an archive.** Put the old list's mbox file in the site's own directory under `pass@import-dir`
   (`<import-dir>/<siteId>/`, so one site's staff name no other site's file), take its SHA-256 (`shasum -a 256`), and
   start the import with the file's name and the checksum ("Import an archive"). Messages become topics and posts
   with their dates, threaded by `Message-ID`, `In-Reply-To` and `References`; an author is a profile with no account,
   kept by the hash of the address, and the posts become a person's own when an account verifies that address. No
   mail is sent. The run is advanced by `pass_dispatch_operations`; its page shows what was made and what was not
   carried (attachments, an unknown character set, a message that is too long, empty or unreadable). Starting the same
   file again resumes the run and makes nothing twice.
6. **Inviting the members.** Paste the old list's addresses ("Invite the list's members", up to 500 at a time). Each
   gets one invitation by mail, which needs outbound mail configured; its link is the Account app's Invitation page,
   where the person signs in or registers with that address and accepts, and is then sent every post of the list.
   Nobody is subscribed without it. An invitation lasts 14 days; an address with an open one is not mailed again.
   A scope's Owner who is no owner of the site invites a day's allowance by trust level, for the inviter and for the
   list; the notice says how many were not sent for it. The site's owners and operators have no such limit.
7. **Cutover.** Import the archive, invite the members, send a last message to the old list with the new address, and
   make the old list read only. Import the archive once more afterwards to carry what arrived in between.

### Automated classification

Classification is off by default. To offer it, set `pass@classifier-service` to an internal
service taking `siteId`, `postId`, `revision`, and `text` and returning `decision` (`review` or
`ok`), `model`, `version`, and `reason`; owners then enable it on the Policies screen. Results only
file review items. Keep provider credentials in that service's own configuration.

Set `pass@media-root` to private backend storage and `pass@scanner-service` to an internal service
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

Seed jobs dispatch outbox delivery, mailbox/tracking conversions, bookmark reminders, topic
timers and the classifier queue each minute, recompute trust every ten minutes, and prepare digests
and clean expired staging each hour. A topic timer rechecks its topic's category and its creator's
moderation access when it fires, and is cancelled otherwise. Staged, unfinalized uploads expire after seven days. Framework jobs clean expired
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

## Entitlements, operations and imports

Paid access uses Mantle subscriptions. An operator binds a `SubscriptionResource` to a site, category
or article in Site settings; the binding names the forum's access services on the resource, and a
resource that already has other services is refused. Order approval then grants access per
subscription period. Mantle's `expire_SubscriptionAccess` job (every ten minutes) calls each
resource's revoke and destroy services once after a subscription ends, skipping one a later
subscription continued, so keep it unpaused. Categories admit subscription grants only when their
qualifying sources include `subscription`. Set `subscriptionUrl` on the site to link members to the
page where they manage a subscription; Forum implements no checkout.

`pass_dispatch_operations` (every minute) advances operation runs: counter rebuild, delivery retry,
retention, site and personal exports, erasure and Discourse import stages. Each item runs in its own
transaction and each run advances in its own. Retention runs only when a site owner starts it with
the previewed policy revision; nothing prunes automatically. Exports and reports are written under
`pass@media-root/exports`, expire after seven days, recheck the requester's authority when
downloaded, and are removed by the cursor cleanup job. Set `publishingWikiSpaceId` on the site to
let internal staff draft articles from topics into that wiki space.

Set `pass@import-dir` to an operator-managed directory that holds Discourse backup archives. The
browser only names a file there and its SHA-256; imports expand into `pass@media-root/imports` and
run into a disabled site. Activation needs the operator's and a site owner's approval of the same
reconciliation, a frozen source and a backup reference. Proxies can send old community URLs to
`<forum mount>/legacy?path=...`; old `/t/slug/id` links redirect on their own.

## Reproducing the remote check

`RemoteHttp` and its `RemoteFixtures` are acceptance tests, in `test/acceptance/`. Start an authority fixture on a dedicated loopback port:

```sh
./moq test mr-pass --nobuild --acceptance --spec ClientFixtures,PortalFixtures,SupplierPortalFixtures,SupportFixtures --db snapshot --serve 127.0.0.1:18091
```

Create a separate scratch runtime containing only symlinks to framework, webroot, tools, and PASS.
Copy the normal runtime configuration needed for the frontend and add the remote properties above,
using the isolated test client ID/secret from `test/MoquiConf.xml`. Do not copy Mantle or BOSS into
that runtime. Run `RemoteFixtures` (`--acceptance`) with `MOQUI_RUNTIME` set to that directory, its remote conf,
and `--serve 127.0.0.1:18092`; it asserts the Mantle entity catalog is absent. Then run:

```sh
./moq test-client runtime/components/addon/mr-pass/test/acceptance/client/RemoteHttp.spec.js --nobuild --server http://127.0.0.1:18092
```

That run is REST; build the frontend with `--lite` to check REST on Lite. The same test runs over each gRPC transport
with the Maximal package (`--release`) on both runtimes.

gRPC direct (the authority on loopback serves h2c, which loopback allows). When the authority's conf turns on the
OTLP/gRPC receiver (`MoquiDevConf.xml` has `<receiver grpc-enabled="true"/>`), the PASS authority shares the receiver's
port (4317) and `pass-authority@grpc-port` is ignored: run the authority with a conf that leaves the receiver off, or
point `pass@backend-grpc-url` at 4317.

```sh
./moq test mr-pass --release --spec ClientFixtures,PortalFixtures --db snapshot --serve 127.0.0.1:18091 \
    -D moqui_conf__pass_authority__grpc_enabled=true -D moqui_conf__pass_authority__grpc_port=18093
# the frontend's conf: the remote properties above, and
#   moqui_conf__pass__backend_grpc_url=grpc://127.0.0.1:18093   moqui_conf__pass__backend_transport=grpc
MOQUI_RUNTIME=<frontend runtime> ./moq test mr-pass --release --nobuild --acceptance --spec RemoteFixtures --serve 127.0.0.1:18092
./moq test-client runtime/components/addon/mr-pass/test/acceptance/client/RemoteHttp.spec.js --nobuild --server http://127.0.0.1:18092
```

gRPC on the edge link: the frontend is an edge node, which the authority runtime pairs with. Pairing checks the edge
node's certificate by WebPKI, so its runtime needs a certificate for a public name of the machine in `cert/`
(`edge.example.test` below; a self-signed one is refused):

```sh
./moq test mr-pass --release --spec ClientFixtures,PortalFixtures --db snapshot --serve 127.0.0.1:18091 \
    -D moqui_conf__pass_authority__client__EDGE__sites=PASS_AUTH,PASS_HTTP \
    -D moqui_conf__pass_authority__client__EDGE__callback=https://frontend.example.test/account/Sso
# the frontend's conf: moqui_conf__pass__backend_url=edge:, moqui_conf__pass__backend_web_url=http://127.0.0.1:18091,
#   moqui_conf__instance__node_role=front_edge, moqui_conf__webapp_list__webapp__WEBROOT__https_listen_port=18443
#   (no pass@client-id or secret: the link is the client)
MOQUI_RUNTIME=<frontend runtime> ./moq test mr-pass --release --nobuild --acceptance --spec RemoteFixtures --serve 127.0.0.1:18092
# on the frontend, signed in as john.doe: System › Edge Clients, make a pairing code; on the authority
# (http://127.0.0.1:18091): System › Edge Node, pair with https://edge.example.test:18443 and the code, wait for Linked
./moq test-client runtime/components/addon/mr-pass/test/acceptance/client/RemoteHttp.spec.js --nobuild --server http://127.0.0.1:18092
```

Run the authority with `--acceptance --spec ClientFixtures,PortalFixtures,SupplierPortalFixtures,SupportFixtures` for the
Billing, Supplier and Support features; the browser walks `SupplierPortalHttp` and `SupportFeedbackHttp` run against the
same frontend too. The test
authenticates through the authority, saves a private draft, uploads/scans/publishes media,
downloads it through the frontend, then revokes anonymous access and verifies concealment. It
also uploads a profile image and verifies that changing profile visibility conceals the image, then opens a pay link,
starts its payment and sends a supplier's bill, and sends a supplier's quote with its file and acknowledgement through
the remote frontend.
Stop both disposable servers after the run. `./moq accept mr-pass` also runs RemoteHttp against its served server
(local authority, no remote frontend); it has its own fixture invoice, apart from PortalHttp's; on a build without image
support its two image features skip with that reason. Live SMTP, IdP, DNS/TLS, and production scanner checks
remain deployment-specific; the specs use captured mail, a deterministic scanner, and isolated data.
