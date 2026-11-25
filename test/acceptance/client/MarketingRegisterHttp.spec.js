// PASS Marketing's Register and Registration over HTTP (IronStone impl-marketing P17; design-marketing §16.3 scenario 13, its public
// half), on MarketingRegisterFixtures' PASS_HTTP data, with plain requests: a visitor reserves two free places from the Event page's
// Register link, names the attendees and accepts the terms; the places are held until the receipt's link, mailed to the buyer,
// opens Registration (the token leaves the address) and its "Confirm my places" confirms them (SEC-PSS-88); two visitors race for
// the last seat and one is waitlisted; the confirmed buyer shows an entry code once and cancels one place, and the waiting place is
// offered; a forged link shows the same "not available". The records and the captured mail are read as john.doe over the
// authority's entity REST (params.authority, else this server).
const BASE = server.url.replace(/\/$/, "")
const AUTHORITY = String(params.authority || BASE).replace(/\/$/, "")
const OFFER = "PASS_HTTP_MR_OFFER_FREE"
const TICKET = "PASS_HTTP_MR_OFFER_FREE_T"
const operationId = () => "op" + Date.now() + Math.floor(Math.random() * 1e6)
const admin = () => session({user: "john.doe"})
const read = (who, entity, values) => who.get(AUTHORITY + "/rest/e1/" + entity, {params: values, accept: "json"}).json()
const referenceOf = page =>
    /name="ref" value="([A-Za-z0-9_-]+)"/.exec(page)?.[1] || /ref=([A-Za-z0-9_-]+)/.exec(page)?.[1] || null
function reserve(visitor, quantity, email) {
    return visitor.post(BASE + "/marketing/Register/reserve", {
        form: {
            offer: OFFER,
            ticketIds: TICKET,
            ["quantity_" + TICKET]: String(quantity),
            buyerName: "Http buyer",
            buyerEmail: email,
            operationId: operationId()
        },
        follow: true
    }).text
}
// the token of the newest receipt link mailed to an address (the captured mail, read over entity REST)
function receiptToken(who, address) {
    for (const message of read(who, "moqui.basic.email.EmailMessage", {toAddresses: address, orderByField: "-sentDate", pageSize: 5})) {
        const found = /\/Registration\?token=([A-Za-z0-9_%-]+)/.exec(String(message.body || ""))
        if (found) return decodeURIComponent(found[1])
    }
    return null
}
feature("a visitor registers two free places from the Event page and confirms them from the receipt's link; Registration opens", {
    when() {
        const visitor = session()
        const event = visitor.get(BASE + "/marketing/Event?offer=" + OFFER).text
        const choice = visitor.get(BASE + "/marketing/Register?offer=" + OFFER).text
        const answers = reserve(visitor, 2, "first.mr@example.test")
        const ref = referenceOf(answers)
        const receipt = visitor.post(BASE + "/marketing/Register/complete", {
            form: {
                ref,
                placeCount: "2",
                fieldNames: "",
                questionScope: "attendee",
                termsRevision: "0",
                attendeeName_0: "Http buyer",
                attendeeName_1: "Http guest",
                acceptTerms: "Y",
                operationId: operationId()
            },
            follow: true
        }).text
        // a visitor's free places wait for the buyer's address (SEC-PSS-88): the receipt mailed there links to Registration, whose
        // "Confirm my places" confirms them; opening the link alone confirms nothing
        // one signed-in reader for the polls: a sign-in each poll would count against the sign-in limits of the walks after it
        const records = admin()
        const token = waitUntil(() => receiptToken(records, "first.mr@example.test"), {timeout: 20})
        const opened = visitor.get(BASE + "/marketing/Registration?token=" + token, {follow: true}).text
        const confirmed = visitor.post(BASE + "/marketing/Registration/confirm", {form: {ref}, follow: true}).text
        const mine = visitor.get(BASE + "/marketing/Registration?ref=" + ref).text
        const places = read(records, "mantle.work.registration.EventRegistration", {reservationId: ref})
        return {event, choice, answers, receipt, opened, confirmed, mine, places}
    },
    then(r) {
        r.event.includes('id="EventRegister"')
        r.choice.includes('id="RegistrationChoice"')
        r.answers.includes('id="RegistrationAnswers"') && r.answers.includes("Doors open ten minutes before.")
        r.receipt.includes('id="RegistrationReceipt"') && r.receipt.includes("Held")
        r.opened.includes('id="ConfirmRegistration"')
        !r.confirmed.includes('id="ConfirmRegistration"')
        r.mine.includes('id="MyRegistration"') && r.mine.includes("Http guest") && r.mine.includes("Show my entry code")
        r.places.length == 2 && r.places.every(place => place.statusId == "EvrConfirmed")
    }
})
feature("two visitors race for the last seat: one is held, the other waitlisted; a cancellation offers the waiting place", {
    when() {
        const first = session(),
            second = session()
        const held = reserve(first, 1, "race.one.mr@example.test")
        const waiting = reserve(second, 1, "race.two.mr@example.test")
        const heldRef = referenceOf(held),
            waitingRef = referenceOf(waiting)
        const records = admin()
        const heldPlace = read(records, "mantle.work.registration.EventRegistration", {reservationId: heldRef})[0]
        const waitingBefore = read(records, "mantle.work.registration.EventRegistration", {reservationId: waitingRef})[0]
        // the held visitor completes and then cancels: the waiting place is offered
        first.post(BASE + "/marketing/Register/complete", {
            form: {
                ref: heldRef,
                placeCount: "1",
                fieldNames: "",
                questionScope: "attendee",
                termsRevision: "0",
                attendeeName_0: "Http buyer",
                acceptTerms: "Y",
                operationId: operationId()
            },
            follow: true
        })
        const cancelled = first.post(BASE + "/marketing/Registration/cancel", {
            form: {ref: heldRef, confirm: "Y", reason: "Cannot come", operationId: operationId()},
            follow: true
        }).text
        const offered = waitUntil(
            () => {
                const place = read(records, "mantle.work.registration.EventRegistration", {reservationId: waitingRef})[0]
                return place.statusId == "EvrHeld" ? place : null
            },
            {timeout: 20}
        )
        const forged = session().get(BASE + "/marketing/Registration?token=" + "x".repeat(48)).text
        return {heldPlace, waitingBefore, cancelled, offered, forged}
    },
    then(r) {
        r.heldPlace.statusId == "EvrHeld"
        r.waitingBefore.statusId == "EvrWaitlisted"
        r.cancelled.includes("Cancelled")
        r.offered.statusId == "EvrHeld"
        r.forged.includes("This registration is not available")
    }
})
