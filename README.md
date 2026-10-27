# IronStoa PASS — Public Application Software Suite

**IronStoa PASS** (`mr-pass`) is the public-facing companion component to
[IronStone BOSS](https://github.com/moqui/mr-boss), built for
[Modern Rust Moqui](https://github.com/moqui/mr-moqui).

PASS brings community, publishing and commerce applications into one suite, with shared sites,
accounts, navigation, branding and integrations. Its separate repository and component support
public-facing deployments on different servers with their own access controls.

## Applications and status

This repository is in the design stage. The
[Forum and shared PASS foundation design](plan/design-forum.md) is the starting point.

| Application | Purpose | Status |
| --- | --- | --- |
| Forum | Community discussion, mailing lists, private communities and customer/member support | Full design with staged implementation |
| Blog/Publishing | Articles, publications, editorial workflows and subscriber delivery | Future app; shared contracts defined in the Forum design |
| Commerce | Public storefronts, customer accounts and paid-access flows | Future app; shared contracts defined in the Forum design |

## Shared foundation

The design supports multiple branded sites and local or remote
[Mantle](https://github.com/moqui/mr-mantle) backends. Forum shares Mailbox and CommunicationEvent
records with BOSS Comms; Publishing builds on versioned wiki content; Commerce uses shared store,
order and subscription services. PASS and BOSS have no runtime dependency on each other.

Integration examples include support discussions on a storefront, forum-backed article comments,
and subscription access to private forums or publications. The shared framework and Mantle
services keep identity, permissions and business records consistent across applications.

## License

[CC0 1.0 Universal with an additional Grant of Patent License](LICENSE.md), matching IronStone BOSS.
