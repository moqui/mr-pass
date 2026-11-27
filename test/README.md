# mr-pass tests

The specs are JavaScript, run by `moqui test` (on the server) and `moqui test-client` (against a running server, with
a browser), with no Node. They are in two suites, described in mr-moqui's
[Build-Test, The two suites](https://github.com/moqui/mr-moqui/blob/master/docs/Build-Test.md#the-two-suites). The
regression suite is `test/` and `test/client/`, within the budget in `test/budget`; the acceptance suite is
`test/acceptance/` and `test/acceptance/client/`, run only when asked or after adding or changing one of its tests.
`test/proofs/` holds PASS's security proofs: black-box client specs filed by OWASP ASVS 5.0.0 requirement, one file a
chapter (`V2Validation`, `V3WebFrontend`, `V4ApiWebService`, `V5FileHandling`, `V6Authentication`, `V10OAuthOidc`,
`V13Configuration`, `V15SecureCoding`, `V7SessionManagement` last), which `--proofs` runs and joins to
[ASVS-Matrix](../docs/ASVS-Matrix.md); they need the accounts the last feature of `ClientFixtures` and the theme preview
the last feature of `Shop/ShopWalkFixtures` set again on each run, or in the deployment profile `--param user=NAME` (and
`site`, `clientId`, `authorityUrl`, `siteHost`, `mfa=required`), with `--param bruteForce=yes`, one spec alone, for those
that use up the client's rate limits
([JS-Test-Client, Security proofs](https://github.com/moqui/mr-moqui/blob/master/docs/dev/JS-Test-Client.md#security-proofs)).
The in-process proofs, of what a client cannot see, are server specs here: `SourceRules` (strict comparisons, no archive
a visitor sends is unpacked), two features of `Transport` (no default client secret, an unreachable authority) and
`Forum/TextNotCode`.
In `test/` the specs are in subdirectories named for the `screen/` directory of the area they cover (`Forum`,
`Account`, ...).

`test/MoquiConf.xml` merges into the conf in test runs only. It has the test sites (`127.0.0.1` with every app
mounted, `smithy.localhost`, the demo shops `shop.zizi.localhost` and `digital.zizi.localhost`, a preview host,
the two `sites.localhost` hosts, and for the proofs `pass.sites.localhost`, their site on a host of its own, and
`preview.pass-http.localhost`, its theme preview host), the test scanner and classifier, and mail kept in the capture.
Test-only configuration, scanner, and captured email fixtures must not be used as production provider configuration.

## Development checks

Run from the mr-moqui workspace root:

```sh
./moq build
./moq test mr-pass mr-mantle mr-boss --nobuild --spec Forum,ForumAccess,TextNotCode,SourceRules,Media,PublicIdentity,SsoHandoff,Transport,PassAuthority,Outbox,Mailboxes,InboxMailboxes,Participation,Moderation,Conversations,InboundMail,Entitlements,Subscriptions,Integrations,Operations,Import,CommsModeration,Portals,AccountingPortals,SupplierPages,SupplierPortal,SupportAccess,CaseFeedback,SupportPortal,ShopAccess,ShopThemes,ShopCatalog,ShopCart,ShopCheckout,ShopAccount,ShopSubscriptions,ShopReviews,ShopPreview,ShopFeeds,StoreFeeds,ShopOperations,StoreAdoption,StoreCheckout,StoreFulfillment,ShopCustomer,CartRecovery,ThemeReleases,ThemeAuthoring,Smithy,SmithyReview,SmithyImport,SmithyAccess,SmithyDeploy,SmithyApi,SalesPortal,SalesPortalAccess,MarketingSubscriptions,MarketingAccess,SubmitForm,FormPublications,MarketingForms,MarketingPages,MarketingTracking,MarketingEvents,MarketingRegistration,Tracking,SitePages,EventRegistrationSetup,EventRegistrations --db snapshot
# Billing and Supplier in the browser, at 390 px and on the desktop; Shop's golden-path checkout walk
./moq test-client mr-pass --nobuild --serve --spec PortalHttp,ShopCheckoutWalk
# the security proofs, with the summary by requirement (proofs.md and proofs.json in the run's output directory)
./moq test-client mr-pass --nobuild --serve --proofs
./moq run --nobuild lint --screens
# the acceptance suite, only when asked or after adding or changing one of its tests
./moq accept mr-pass
```

The `--spec` list names PASS's regression specs and the Mantle and BOSS specs of the services PASS's pages call, so
it runs over all three components. The default build has every feature the specs need.

## The acceptance suite

Server specs are in `test/acceptance/`, browser and plain-request walks in `test/acceptance/client/`; a walk's
fixtures are a server spec named beside it.

**Forum**

- `ForumHttp`: the forum's browser scenarios.
- `SiteHostsHttp`, with `SiteHostsFixtures`: several sites by host name, the Forum and the Shop each at the root of
  its own host.

**Billing and Supplier**

- `SupplierPortalHttp`, with `SupplierPortalFixtures`: the Supplier app's browser scenarios.

**Support**

- `SupportFeedbackHttp` and `SupportPagesHttp`, with `SupportFixtures`: the Support app's browser scenarios.
- `SupportIsolation`: isolation between customers.

**Shop**

- `ShopMount`: Shop's mount at a site's root.
- `ShopThemeRelease`: its theme release.
- `ShopHttp` and `ShopRemoteHttp`, with `ShopFixtures`, and `ShopRemoteFixtures` for the remote frontend: the catalog
  walks over the demo Shop sites.
- `ShopCartHttp` in the browser and `ShopCartRemoteHttp` with plain requests, locally or through a remote frontend:
  the cart walks.
- `ShopCheckoutHttp`: checkout in the browser.
- `ShopAccessibilityHttp`: accessibility and device checks: a keyboard-only checkout at 390 px with announced totals
  and a labelled, focused refusal, reduced motion, the account pages at 390 px.
- `ShopPaymentScenarios`, `ShopOrderScenarios`, `ShopSubscriptionScenarios`: the payment, order and subscription
  scenarios on the server. [design-shop §18.1](../plan/design-shop.md) maps each scenario to its test in
  [impl-shop §8](../plan/impl-shop.md).
- `ShopOperationsScenarios`: adoption and operations: a legacy store's adoption preview and approved proposal, a
  withdrawn mount with an attempt reconciled, a remote frontend's outage.
- `ShopOrdersInCommerce`, after `ShopOrderScenarios`: Commerce's store operations over the Shop orders. It needs
  mr-boss.
- `ShopSubscriptionsInCommerce`: Commerce's subscription operations over a Shop subscription. It needs mr-boss.

**Smithy**

- `SmithyWalk`, with `SmithyWalkFixtures`: the golden-path walk: browsing, then a signed-in account creating a
  repository, the pages that write at 390 px, and the forum inside a group's page at 390 px (a topic, the composer
  and the report form).
- `SmithyContribution`, with `SmithyContributionFixtures`: the contribution walk: a fork, a merge request, signing
  the agreement on the page, a Maintainer's merge, a merge request of the kind a push for review opens, and a file
  fixed on its page. The fork's commits and that merge request are made through page saves and the proposal service,
  with no `git push`, which the framework's git-client tests cover.

**Sales**

- `SalesQuoteScenarios` (standalone) and the walk `SalesQuoteHttp`, with `SalesQuoteFixtures`, at 390 px and with
  plain requests that run the same through a remote frontend: the quote scenarios.
- `SalesOrderScenarios` (standalone) and the walk `SalesOrderHttp`, with `SalesOrderFixtures`: the order scenarios.
- `SalesPhonePages`, with `SalesPhoneFixtures`: its pages at 390 px: My quotes, a quote, a receipt, My orders and an
  order, signed in and by a link, none scrolling sideways.

**Marketing**

- `MarketingSubscribeHttp`, with `MarketingSubscribeFixtures`, with plain requests, and `MarketingRemoteHttp` through
  a remote frontend: the subscription walk.
- `MarketingFormHttp`, with `MarketingFormFixtures`: the form walk: an anonymous answer with the subscription choice,
  an invitation's link answered once.
- `MarketingPagesHttp`, with `MarketingPagesFixtures`: the landing page walk: a visitor subscribes from a published
  page's box, a draft not found.
- `MarketingTrackingHttp`, with `MarketingTrackingFixtures`: the tracking walk.
- `MarketingRegisterHttp`, with `MarketingRegisterFixtures`: the registration walk.
- `MarketingPhonePages`: its public pages at 390 px: language, heading, named controls and image alternatives, none
  scrolling sideways.

**The whole suite**

- `Scale`, with `-D pass_scale_test=true`: the large fixture.
- `RemoteHttp` and `RemoteFixtures`: the remote frontend, which use two independent runtimes; see
  [Reproducing the remote check](../docs/Deployment.md#reproducing-the-remote-check).
