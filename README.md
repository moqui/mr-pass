# IronStone PASS - Public Application Software Suite

> **Not ready for production (before 0.1.0).** Like [MR Moqui](https://github.com/moqui/mr-moqui#readme), which it
> runs on, PASS is in early development. Its data model and stored data change without migrations, and a security
> review is under way with its findings recorded openly in the mr-moqui repository. Run it only on development
> machines, with no real business data or credentials, and not exposed to the internet. The full notice is at the top
> of the [mr-moqui README](https://github.com/moqui/mr-moqui#readme).

IronStone PASS is the public-facing application suite for [MR Moqui](https://github.com/moqui/mr-moqui), the Moqui
framework in Rust, and the companion of [IronStone BOSS](https://github.com/moqui/mr-boss). BOSS is where a
business's own people work. PASS is what its customers, suppliers, members and the public see: a community forum, a
shop, public git hosting, and the pages where a customer pays an invoice, accepts a quote, opens a support case or
registers for an event.

PASS has a shell of its own, apart from the one staff use. The Shop's and Smithy's pages are plain HTML that works
without JavaScript, with small islands where a page needs them (a cart, an editor, a running job's log). A site is
bound to a host name and puts each app at a path.

![A product page of the demo shop on the starter theme.](docs/images/shop-product.png)

## The apps

A site mounts the apps it wants. The paths are the defaults.

| App | Path | What it is | The public side of |
|---|---|---|---|
| Forum | `/forum`, or a site's root | Community forums and mailing lists: categories, topics and posts, public accounts, moderation, read markers, protected attachments, notices by mail. [Design](plan/design-forum.md), [built](plan/implementation-forum.md) | Comms' mailboxes |
| Shop | `/shop`, or a site's root | A store's storefront: the published catalog and search, a cart, guest or signed-in checkout on the store's hosted payment page, orders, downloads, saved addresses and cards, subscriptions, on the site's published theme. [Design](plan/design-shop.md), [built](plan/impl-shop.md), [UI review](plan/ui-review-shop.md) | Commerce |
| Smithy | `/code`, or a site's root | Public git hosting: groups and repositories, code and commits, issues, merge requests with reviews and checks, pipelines and deployments, releases, docs, forks, a GitHub import, and at a site's root a Forgejo-compatible API for tea and other clients. [Design](plan/design-smithy.md), [built](plan/implementation-smithy.md) | Projects' code |
| Billing | `/billing` | A customer's invoices, and payment from an invoice's link | Accounting |
| Supplier | `/supplier` | A supplier's quote, purchase order acknowledgement and bill | Purchasing, Accounting |
| Support | `/support` | Help articles, a customer's cases and returns, a cancel request for an order, feedback on a resolved case | Customer Service |
| Sales | `/sales` | A quote by its mailed link with accept or decline, a contact's quotes, a customer's orders with delivery and invoices | Sales |
| Marketing | `/marketing` | Subscribing to a list and confirming, survey and lead forms, landing pages, event registration with payment and entry codes; the tracking links at `/trk` | Marketing |
| Account | `/account` | Sign-in, registration, single sign-on, second factor, notifications, email preferences and unsubscribe, git access keys | |
| Members | `/members` | A member's public profile | |
| Sites | `/sites` | A site's owners manage its identity, hosts and apps | |

![A repository's page in Smithy, with test data.](docs/images/smithy-repository.png)

## How it runs

PASS depends only on the framework. The business data and logic it shows are Mantle's
([mr-mantle](https://github.com/moqui/mr-mantle)), reached in one of these ways, all covered in
[Deployment](docs/Deployment.md):

- **Beside Mantle**, in the same runtime: the simple case, and what a development checkout does
  ([Components and authority](docs/Deployment.md#components-and-authority)).
- **As a remote frontend**: a server with only the framework, webroot and PASS, which calls one Mantle authority the
  operator configures, over REST or gRPC. It does not load Mantle's entities or copy its party records.
- **On an edge node**, so the authority needs no public port
  ([An edge node as the PASS server](docs/Deployment.md#an-edge-node-as-the-pass-server)).
- **Several sites by host name** on one server, each with its own root
  ([Several sites by host name](docs/Deployment.md#several-sites-by-host-name)).

BOSS is not a runtime dependency: a published shop or forum runs without it. The editors for a shop's theme and
pages are Commerce's, in BOSS. mr-moqui's
[Run and Deploy](https://github.com/moqui/mr-moqui/blob/master/docs/Run-Deploy.md#pass-servers-with-a-boss-server-or-cluster)
has the topologies.

## Publishing is explicit

Nothing is public until an operator makes it so. A site is provisioned disabled; the operator sets its hosts and
mounts, verification mail and media scanning, and then publishes the site and the categories, store or repositories
it should show. Registration starts closed. An existing mailbox marked public is not published to the internet by
that mark; an adopted mailbox must finish its conversion first.

Backend URLs, credentials, sender and template allowlists, SSO flows, callback URLs, storage and scanner bindings are
operator configuration, and are never taken from a public request.
[Provisioning and publication](docs/Deployment.md#provisioning-and-publication) has the steps and the recovery
procedures.

## Get it and try it

In an [mr-moqui](https://github.com/moqui/mr-moqui#quick-start) checkout:

A plain `./moq run` has no public site, since a site is provisioned by an operator. To see the demo sites the specs
use, serve the test fixtures on a scratch database:

```sh
./moq component-get mr-pass mr-boss   # With mr-mantle; the demo shop's data comes with Commerce, in mr-boss
./moq test mr-pass --acceptance --spec ClientFixtures,ShopFixtures,SmithyWalkFixtures --db snapshot --serve 8091
```

Then open `http://shop.zizi.localhost:8091/` for the demo shop, and `http://127.0.0.1:8091/forum` and
`http://127.0.0.1:8091/code` for a forum and Smithy with test data. Ctrl-C stops the server and removes the scratch
database. For a site of your own, start with [Deployment](docs/Deployment.md).

## Developing

Read mr-moqui's [AGENTS.md](https://github.com/moqui/mr-moqui/blob/master/AGENTS.md) and
[application practices](https://github.com/moqui/mr-moqui/blob/master/docs/dev/Practices-App-Dev.md) first.

- [`plan/`](plan/) has the designs and what is built of each. The Forum design also defines the shared foundation
  and [how an app registers](plan/design-forum.md#131-shared-foundation-and-independent-app-use). The customer pages of Support, Sales and
  Marketing are designed with their BOSS apps, in mr-boss's `plan/`.
- `screen/<App>/` and `service/pass/` are the apps, `theme/starter/` the starter shop theme, and `script/` the
  tracking redirect and pixel and the Smithy API filter (`SmithyApi.js`).
- [docs/Deployment.md](docs/Deployment.md) has each app's setup and jobs, and [adding an app](docs/Deployment.md#adding-an-app).
- [docs/security/Attack-Surface-Apps-PASS.md](docs/security/Attack-Surface-Apps-PASS.md) is the security map, with
  [Commerce](docs/security/Attack-Surface-Apps-PASS-Commerce.md) and
  [Forum and Smithy](docs/security/Attack-Surface-Apps-PASS-Forum-Smithy.md); it is part of mr-moqui's
  [attack surface](https://github.com/moqui/mr-moqui/blob/master/docs/security/Attack-Surface.md).
- Tests are in two suites, described in [test/README.md](test/README.md):

```sh
./moq test mr-pass --spec Forum,ShopCart   # The regression specs you touched, while working
./moq test-apps                            # Every app component's regression suite, before a commit
./moq accept mr-pass                       # The acceptance suite, before a release or when asked
```

## License and Contributing

[CC0 1.0 Universal with a Grant of Patent License](LICENSE.md). To contribute code, sign
[AUTHORS.md](AUTHORS.md) in a commit from the account that submits the pull request; its Contributing
section has the details.
