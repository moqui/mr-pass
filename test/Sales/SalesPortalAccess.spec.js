// PASS Sales' quote pages (IronStone impl-sales P13; design-sales §10 CustomerQuote, QuoteResponse, CustomerQuotes): a quote's
// link shows its offer with Accept and Decline; a forged link, a changed order ID and a receipt before any response read "not
// available" and show nothing of the quote; My quotes asks a visitor to sign in. The five operations are in both copies of the
// schema and the route list, respondSalesQuote a bearer write in the three TOKEN_WRITES lists and the PDF a download. Mantle's
// SalesPortal spec covers the rules (scope, binding, one response, the threshold); the acceptance tests SalesQuoteScenarios and
// SalesQuoteHttp go through the pages and a remote frontend. The issue is made without its PDF, so no print is rendered here.
// P17: an order's link (the storeless confirmation's OrderView) shows the order read only, with no form; a forged link and a quote's
// link read "not available"; My orders asks a visitor to sign in; the three order reads are in both copies and are no bearer write
// (Mantle's SalesPortal covers the rules; SalesOrderScenarios and SalesOrderHttp are the acceptance tests). The order is set placed
// directly, so no confirmation is sent or printed here.
const fx = () => ec.resource.script("component://mr-mantle/test/order/SalesQuoteIssueFixtures.js")
const siteId = "PASS_SALES_PAGES"
const host = "sales.example.test"
let quote
let order
const render = (path, parameters) => {
    const rendered = ec.screen
        .makeTest()
        .rootScreen("component://mr-pass/screen/Pass.xml")
        .render(
            path,
            {resolvedSiteId: siteId, publicHost: host, publicPath: "/" + path.replace(/^Sales/, "sales"), ...parameters},
            null
        )
    return {html: rendered.output, errors: rendered.errorMessages}
}
spec({
    setupSpec() {
        const f = fx().setup("PSP")
        const {orderId} = fx().proposedQuote(f, f.users.rep, f.orgA, f.accounts.a, f.contacts.mailed)
        const other = fx().proposedQuote(f, f.users.rep, f.orgA, f.accounts.a, null).orderId
        fx().system(() => {
            const make = fx().make
            make("mantle.public.PublicSite", {
                siteId,
                name: "Sales pages",
                state: "published",
                registrationMode: "invitation",
                locale: "en",
                timeZone: "UTC",
                policyRevision: 1,
                generation: 1
            })
            make("mantle.public.PublicSiteHost", {hostname: host, siteId, canonical: "Y"})
            make("mantle.public.PublicSiteApp", {
                siteId,
                appMountId: "sales",
                app: "sales",
                pathPrefix: "/sales",
                enabled: "Y",
                targetId: f.orgA
            })
            make("mantle.public.PublicSiteApp", {
                siteId,
                appMountId: "account",
                app: "account",
                pathPrefix: "/account",
                enabled: "Y"
            })
            // the issue as send#Quote makes it, without its PDF, and the recipient's link
            const order = fx().one("mantle.order.OrderHeader", {orderId})
            const part = fx().one("mantle.order.OrderPart", {orderId, orderPartSeqId: "01"})
            make("mantle.sales.quote.SalesQuoteIssue", {
                orderId,
                orderPartSeqId: "01",
                orderRevision: order.orderRevision,
                organizationPartyId: f.orgA,
                customerPartyId: f.accounts.a,
                issuedDate: ec.user.nowTimestamp,
                validFromDate: ec.user.nowTimestamp,
                validThruDate: part.validThruDate
            })
            const link = ec.resource.script("component://mr-mantle/service/mantle/party/ExternalAccess.js").create({
                recordType: "SalesOrder",
                recordId: orderId,
                scopes: "QuoteView,QuoteRespond",
                recordRevision: order.orderRevision,
                thruDate: part.validThruDate
            })
            quote = {orderId, other, token: link.token, url: link.url}
        })
        // P17: a direct order of A for account a, set placed without the placement's mail, and its OrderView link
        const seller = fx().system(() =>
            fx().addUser(f, "seller", [f.orgA], ["SALES_VIEW", "SALES_TEAM_VIEW", "SALES_ORDER_EDIT"])
        )
        const orders = "mantle.order.SalesOrderServices."
        const orderId2 = fx().as(seller, orders + "create#SalesOrder", {
            organizationPartyId: f.orgA,
            customerPartyId: f.accounts.a,
            otherPartyOrderId: "PO-PSP"
        }).orderId
        fx().as(seller, orders + "store#SalesOrderLine", {
            orderId: orderId2,
            orderRevision: fx().revision(orderId2),
            productId: f.product,
            quantity: 2
        })
        fx().system(() => {
            const header = ec.entity.find("mantle.order.OrderHeader").condition({orderId: orderId2}).one()
            header.statusId = "OrderPlaced"
            header.placedDate = ec.user.nowTimestamp
            header.update()
            const link = ec.resource
                .script("component://mr-mantle/service/mantle/party/ExternalAccess.js")
                .create({recordType: "SalesOrder", recordId: orderId2, scopes: "OrderView"})
            order = {orderId: orderId2, token: link.token, url: link.url, organizationPartyId: f.orgA}
        })
        logout()
    },
    cleanupSpec() {
        login("john.doe")
    }
})
feature(
    "a quote's link shows the offer with Accept and Decline; a forged link, a changed ID and an early receipt read not available",
    {
        when() {
            return {
                page: render("Sales/CustomerQuote", {token: quote.token}),
                forged: render("Sales/CustomerQuote", {token: "x".repeat(48)}).html,
                changed: render("Sales/CustomerQuote", {token: quote.token, orderId: quote.other}).html,
                receipt: render("Sales/QuoteResponse", {token: quote.token}).html,
                list: render("Sales/CustomerQuotes", {}).html
            }
        },
        then({page, forged, changed, receipt, list}) {
            quote.url.startsWith("https://" + host + "/sales/CustomerQuote?token=")
            page.errors.length === 0
            page.html.includes("Quote " + quote.orderId)
            page.html.includes('id="AcceptQuote"') && page.html.includes('id="DeclineQuote"')
            page.html.includes('name="acknowledge"') && page.html.includes('name="token" value="' + quote.token + '"')
            page.html.includes("Account a")
            ;[forged, changed].every(
                html =>
                    html.includes("This quote is not available") && !html.includes("Account a") && !html.includes("AcceptQuote")
            )
            receipt.includes("This receipt is not available") && !receipt.includes("Account a")
            list.includes("Sign in to see the quotes")
        }
    }
)
feature(
    "an order's link shows the order read only; a forged link and a quote's link read not available; My orders asks to sign in",
    {
        when() {
            return {
                page: render("Sales/CustomerOrder", {token: order.token}),
                forged: render("Sales/CustomerOrder", {token: "x".repeat(48)}).html,
                byQuoteLink: render("Sales/CustomerOrder", {token: quote.token}).html,
                list: render("Sales/CustomerOrders", {}).html
            }
        },
        then({page, forged, byQuoteLink, list}) {
            order.url.startsWith("https://" + host + "/sales/CustomerOrder?token=")
            page.errors.length === 0 && !page.html.includes("Error rendering")
            page.html.includes("Order " + order.orderId) && page.html.includes("PO-PSP") && page.html.includes("Account a")
            page.html.includes('id="OrderShipments"') && page.html.includes("Nothing has shipped yet")
            page.html.includes("No invoice yet")
            !page.html.includes("<form") && !page.html.includes("Request cancellation")
            ;[forged, byQuoteLink].every(html => html.includes("This order is not available") && !html.includes("Account a"))
            list.includes("Sign in to see your company&#39;s orders")
        }
    }
)
feature("the eight operations are in both schema copies and route lists; the quote's response is the one bearer write", {
    when() {
        const operations = [
            "findSalesQuotes",
            "getSalesQuote",
            "getSalesQuoteDocument",
            "respondSalesQuote",
            "getSalesQuoteResponse",
            // P17: the order reads, GETs and no bearer write
            "findSalesOrders",
            "getSalesOrder",
            "getSalesOrderDocument"
        ]
        const pass = ec.resource.script("component://mr-pass/service/pass/Schema.js")
        const mantle = ec.resource.script("component://mr-mantle/service/mantle/forum/ForumSchema.js")
        const routes = [
            ec.resource.script("component://mr-pass/service/pass/Routes.js"),
            ec.resource.script("component://mr-mantle/script/PassRoutes.js")
        ]
        const lists = [
            ec.resource.script("component://mr-pass/service/pass/Transport.js").TOKEN_WRITES,
            ec.resource.script("component://mr-mantle/script/PassApi.js").TOKEN_WRITES,
            ec.resource.script("component://mr-mantle/script/PassAuthority.js").TOKEN_WRITES
        ]
        return {
            schemas: operations.every(op => pass[op] && JSON.stringify(pass[op]) === JSON.stringify(mantle[op])),
            routed: operations.every(op => routes.every(list => list.filter(row => row[2] === op).length === 1)),
            post: routes[0].find(row => row[2] === "respondSalesQuote")[0],
            orderReads: ["findSalesOrders", "getSalesOrder", "getSalesOrderDocument"].every(
                op =>
                    routes.every(list => list.find(row => row[2] === op)[0] === "GET") && lists.every(list => !list.includes(op))
            ),
            writes: lists.every(list => list.includes("respondSalesQuote") && !list.includes("getSalesQuote"))
        }
    },
    then({schemas, routed, post, orderReads, writes}) {
        schemas === true
        routed === true
        post === "POST"
        orderReads === true
        writes === true
    }
})
// Sales P19 (the user's call of Nov 14): a cancelled order opens from its link marked Cancelled, read only: Support's ask page only (the
// site mounting Support for the organization), no cancellation, return or payment
feature("a cancelled order's link shows it marked Cancelled, with no cancellation, return or payment link", {
    when() {
        fx().system(() => {
            fx().make("mantle.public.PublicSiteApp", {
                siteId,
                appMountId: "support",
                app: "support",
                pathPrefix: "/support",
                enabled: "Y",
                targetId: order.organizationPartyId
            })
            const header = ec.entity.find("mantle.order.OrderHeader").condition({orderId: order.orderId}).one()
            header.statusId = "OrderCancelled"
            header.update()
        })
        return render("Sales/CustomerOrder", {token: order.token})
    },
    then(page) {
        page.errors.length === 0 && !page.html.includes("Error rendering")
        page.html.includes("Order " + order.orderId) && page.html.includes("<strong>Cancelled</strong>")
        page.html.includes("this order was cancelled and can no longer be changed")
        page.html.includes("Ask about this order") && !page.html.includes("Ask about or change this order")
        !page.html.includes("Request cancellation") && !page.html.includes("Request a return")
        !page.html.includes("Open in Billing") && !page.html.includes("<form")
    }
})
