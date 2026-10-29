# IronStoa PASS — Public Application Software Suite

PASS is the public-facing component for Modern Rust Moqui. Its Forum uses Mantle MAILBOX lists and
CommunicationEvent posts, with a dedicated public shell, explicit publication, public accounts,
moderation, read markers, protected attachments, and outbound notifications.

The component has a framework-only static dependency. Local deployments load Mantle. Remote
frontends need only framework, webroot, and PASS; they use one operator-configured Mantle authority
without loading its entity catalog or copying its Party records. BOSS is not a runtime dependency.

The [Forum design](plan/design-forum.md) defines the stages; what is built and verified, and what is deferred, is in
[the implementation record](plan/implementation-forum.md). Operators start with [Deployment](docs/Deployment.md).

## Starting a community

Install the matching framework and Mantle changes alongside PASS. Provision a disabled site as
an operator, configure its registered hosts and mounts, configure verification mail and media
scanning, then explicitly publish the site and selected categories. Registration starts closed.
An existing mailbox's `isPublic=Y` does not publish it to the internet. Adopted mailboxes must
finish metadata conversion and reconcile failures before publication.

Backend URLs, credentials, sender/template allowlists, SSO flows, callback URLs, storage, and
scanner bindings belong in operator configuration. They are never accepted from public requests.
See [Deployment](docs/Deployment.md) for configuration examples and recovery procedures.

## Development checks

Run from the mr-moqui workspace root with the existing compiler and incremental development build:

```sh
./moq build -- --features moqui-host/image
./moq test mr-pass mr-mantle mr-boss --nobuild --spec Forum,ForumAccess,Media,PublicIdentity,SsoHandoff,Outbox,Mailboxes,InboxMailboxes,Participation,Moderation,Conversations,InboundMail,Entitlements,Subscriptions,Integrations,Operations,Import,CommsModeration --db snapshot
./moq test-client mr-pass --nobuild --serve --spec ForumHttp
./moq test mr-pass --nobuild --spec Scale --db snapshot -D pass_scale_test=true
./moq run --nobuild lint --screens
```

JavaScript service and browser specs run through Moqui, without Node as a test dependency.
`RemoteHttp` and `RemoteFixtures` use two independent runtimes; see the deployment guide.
Test-only configuration, scanner, and captured email fixtures must not be used as production
provider configuration.

## License

[CC0 1.0 Universal with an additional Grant of Patent License](LICENSE.md).
