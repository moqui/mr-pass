/* Smithy's diff rows (plan/design-smithy.md §9, §11): the lines of a file's diff as escaped markup with both line numbers,
 * the changed words of a deleted line and the added line it pairs with marked, a hunk's header with its context, the gap
 * of unchanged lines between hunks as a link to those lines of the file, and the same lines side by side (split). The
 * merge request's Changes page (SmithyReview.js) adds its comment links and threads around these rows; a commit's and a
 * comparison's Changes (Smithy.js, Changes.html.fancy) use them as they are. Text from a repository is escaped here and
 * never read as markup. Plain HTML: no script. CC0 plus patent grant. */
const esc = text =>
    String(text ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;")

/* A unified diff's lines with the line numbers of both sides: {kind: h (a hunk's header), m (the file's header lines), a
 * (added), d (deleted) or c (context), text, oldNo, newNo}. */
function diffLines(unifiedDiff) {
    const lines = String(unifiedDiff ?? "").split("\n")
    if (lines.length > 1 && lines[lines.length - 1] === "") lines.pop()
    let oldNo = 0
    let newNo = 0
    let inHunk = false
    return lines.map(raw => {
        const line = raw.replace(/\r$/, "")
        const hunk = /^@@ -([0-9]+)(?:,([0-9]+))? \+([0-9]+)(?:,([0-9]+))? @@/.exec(line)
        if (hunk) {
            oldNo = Number(hunk[1])
            newNo = Number(hunk[3])
            inHunk = true
            return {kind: "h", text: line, oldStart: oldNo, newStart: newNo}
        }
        if (!inHunk || line.startsWith("\\")) return {kind: "m", text: line}
        if (line.startsWith("+")) return {kind: "a", text: line.slice(1), newNo: newNo++}
        if (line.startsWith("-")) return {kind: "d", text: line.slice(1), oldNo: oldNo++}
        return {kind: "c", text: line.slice(1), oldNo: oldNo++, newNo: newNo++}
    })
}
/* The same lines from the host's hunks ({oldStart, oldLines, newStart, newLines, lines: [{tag, oldNo, newNo, text}]}). */
function hunkLines(hunks) {
    const out = []
    for (const hunk of hunks || []) {
        out.push({
            kind: "h",
            text: "@@ -" + hunk.oldStart + "," + hunk.oldLines + " +" + hunk.newStart + "," + hunk.newLines + " @@",
            oldStart: Number(hunk.oldStart),
            newStart: Number(hunk.newStart)
        })
        for (const line of hunk.lines || [])
            out.push(
                line.tag === "insert"
                    ? {kind: "a", text: line.text ?? "", newNo: line.newNo}
                    : line.tag === "delete"
                      ? {kind: "d", text: line.text ?? "", oldNo: line.oldNo}
                      : {kind: "c", text: line.text ?? "", oldNo: line.oldNo, newNo: line.newNo}
            )
    }
    return out
}

/* One part of a long diff: the lines of the hunks from line part*size (0-based) up to size lines, counted without the
 * hunks' headers, and the count of parts. A part that starts inside a hunk starts with a header marked cont, which has no
 * gap before it. Only the lines of the part are made. With sent ({total, offset}: a file's diffLineCount and
 * diffLineOffset) the host sent only the part's lines, from line offset of total, a hunk it cut at its start with
 * skippedLines (the page asks for its part, so a large file's other lines never become values). */
function hunkPart(hunks, part, size, sent) {
    const lines = []
    let total = 0
    if (sent) total = Number(sent.total) || 0
    else for (const hunk of hunks || []) total += (hunk.lines || []).length
    const parts = Math.max(1, Math.ceil(total / size))
    const from = sent ? Math.floor((Number(sent.offset) || 0) / size) * size : Math.min(Math.max(0, part), parts - 1) * size
    const to = from + size
    let at = sent ? Number(sent.offset) || 0 : 0
    for (const hunk of hunks || []) {
        const count = (hunk.lines || []).length
        if (at + count <= from || at >= to) {
            at += count
            continue
        }
        const start = Math.max(0, from - at)
        const header = {kind: "h", oldStart: Number(hunk.oldStart), newStart: Number(hunk.newStart)}
        if (start === 0 && !(sent && Number(hunk.skippedLines) > 0))
            header.text = "@@ -" + hunk.oldStart + "," + hunk.oldLines + " +" + hunk.newStart + "," + hunk.newLines + " @@"
        else {
            const first = hunk.lines[start]
            header.cont = true
            header.text = "@@ … continued from line " + (first.newNo ?? first.oldNo) + " @@"
        }
        lines.push(header)
        for (let k = start; k < count && at + k < to; k++) {
            const line = hunk.lines[k]
            lines.push(
                line.tag === "insert"
                    ? {kind: "a", text: line.text ?? "", newNo: line.newNo}
                    : line.tag === "delete"
                      ? {kind: "d", text: line.text ?? "", oldNo: line.oldNo}
                      : {kind: "c", text: line.text ?? "", oldNo: line.oldNo, newNo: line.newNo}
            )
        }
        at += count
    }
    return {lines, parts, part: from / size}
}

/* The same part of lines already made (from a unified text): {lines, parts, part}, as hunkPart. */
function linesPart(all, part, size) {
    const body = line => line.kind === "a" || line.kind === "d" || line.kind === "c"
    let total = 0
    for (const line of all) if (body(line)) total++
    const parts = Math.max(1, Math.ceil(total / size))
    const from = Math.min(Math.max(0, part), parts - 1) * size
    const to = from + size
    const lines = []
    let at = 0
    let header = null
    // the hunk's lines before the part, and whether its header is out yet
    let skipped = 0
    let out = false
    for (const line of all) {
        if (line.kind === "h") {
            header = line
            skipped = 0
            out = false
            continue
        }
        if (body(line)) at++
        if (at <= from) {
            skipped++
            continue
        }
        if (at > to) break
        if (!out && header) {
            lines.push(skipped ? {kind: "h", cont: true, text: "@@ … continued from line " + (line.newNo ?? line.oldNo) + " @@"} : header)
            out = true
        }
        lines.push(line)
    }
    return {lines, parts, part: from / size}
}

// words, runs of white space, and each other character are the units a changed line is compared by
const TOKENS = /[A-Za-z0-9_]+|\s+|[^A-Za-z0-9_\s]/g
// a pair of lines longer than this, or with more units, is marked as a whole (the comparison is quadratic)
const MAX_LINE = 1000
const MAX_TOKENS = 400
/* The changed units of two lines: the longest common subsequence of their units is unchanged; returns the escaped markup
 * of each side with its changed runs in <span class="x">, or null when the lines share too little to be worth marking.
 * scratch ({table}) is a table to reuse for the comparison, grown as needed: a page marks thousands of pairs, and a table
 * of their own for each was as many arrays for the collector (SmithyDiffScale). */
function wordMarks(before, after, scratch = {}) {
    if (before.length > MAX_LINE || after.length > MAX_LINE) return null
    const a = before.match(TOKENS) || []
    const b = after.match(TOKENS) || []
    if (a.length > MAX_TOKENS || b.length > MAX_TOKENS) return null
    const n = a.length
    const m = b.length
    // the lengths of the common subsequences of a[i..] and b[j..] at i * width + j, the last row and column 0
    const width = m + 1
    if (!scratch.table || scratch.table.length < (n + 1) * width)
        scratch.table = new Int32Array(Math.max((n + 1) * width, 1024))
    const t = scratch.table
    for (let j = 0; j <= m; j++) t[n * width + j] = 0
    for (let i = n - 1; i >= 0; i--) {
        t[i * width + m] = 0
        for (let j = m - 1; j >= 0; j--)
            t[i * width + j] =
                a[i] === b[j] ? t[(i + 1) * width + j + 1] + 1 : Math.max(t[(i + 1) * width + j], t[i * width + j + 1])
    }
    const keepA = new Array(n).fill(false)
    const keepB = new Array(m).fill(false)
    let shared = 0
    for (let i = 0, j = 0; i < n && j < m; ) {
        if (a[i] === b[j]) {
            keepA[i++] = true
            keepB[j++] = true
            shared++
        } else if (t[(i + 1) * width + j] >= t[i * width + j + 1]) i++
        else j++
    }
    // white space alone in common is no likeness: such lines are a rewrite, marked as a whole
    const sharedText = a.filter((_, i) => keepA[i]).join("")
    if (!sharedText.trim() || sharedText.length * 3 < Math.min(before.length, after.length)) return null
    const markup = (tokens, keep) => {
        let out = ""
        let open = false
        tokens.forEach((token, i) => {
            if (!keep[i] && !open) {
                out += '<span class="x">'
                open = true
            } else if (keep[i] && open) {
                out += "</span>"
                open = false
            }
            out += esc(token)
        })
        return out + (open ? "</span>" : "")
    }
    return shared ? [markup(a, keepA), markup(b, keepB)] : null
}
/* The lines with the markup of each text line (html): a run of deleted lines followed by a run of added lines is paired
 * line by line, and each pair's changed words are marked. Returns the same array. */
function marked(lines) {
    const scratch = {}
    const first = lines.findIndex(line => line.kind === "h")
    if (first > 0) lines.splice(0, first)
    for (const line of lines) if (line.kind === "a" || line.kind === "d" || line.kind === "c") line.html = esc(line.text)
    for (let i = 0; i < lines.length; ) {
        if (lines[i].kind !== "d") {
            i++
            continue
        }
        let d = i
        while (d < lines.length && lines[d].kind === "d") d++
        let a = d
        while (a < lines.length && lines[a].kind === "a") a++
        const pairs = Math.min(d - i, a - d)
        for (let k = 0; k < pairs; k++) {
            const marks = wordMarks(lines[i + k].text, lines[d + k].text, scratch)
            if (marks) {
                lines[i + k].html = marks[0]
                lines[d + k].html = marks[1]
            }
        }
        i = a
    }
    return lines
}
/* A hunk header's markup: its ranges and, apart, the context git names after them (a function's line). */
function hunkHtml(text) {
    const found = /^(@@ [^@]* @@)(.*)$/.exec(text)
    return found ? esc(found[1]) + (found[2].trim() ? ' <span class="fn">' + esc(found[2].trim()) + "</span>" : "") : esc(text)
}
/* The unchanged lines before a hunk and between two hunks, in new-side numbers: Map(index of the hunk's line -> {from,
 * to}). The diff does not say whether lines follow the last hunk, so no gap is made there. */
function gaps(lines) {
    const out = new Map()
    let lastNew = 0
    lines.forEach((line, i) => {
        if (line.kind === "h" && line.cont) return
        if (line.kind === "h") {
            const from = lastNew + 1
            const to = (line.newStart || 1) - 1
            if (to >= from) out.set(i, {from, to})
        } else if (line.newNo != null) lastNew = line.newNo
    })
    return out
}
/* A gap's row: the count of unchanged lines and a link to them in the file at the new side (fileHref(line) is the address
 * of a line of the file, or null where the file cannot be linked). */
function gapHtml(gap, fileHref, split) {
    const count = gap.to - gap.from + 1
    const label = (count === 1 ? "1 unchanged line" : count + " unchanged lines") + " (" + gap.from + "–" + gap.to + ")"
    const href = fileHref ? fileHref(gap.from) : null
    const body = href ? '<a href="' + esc(href) + '">⋯ ' + esc(label) + "</a>" : "⋯ " + esc(label)
    return '<div class="' + (split ? "sr g" : "l g") + '">' + body + "</div>"
}
/* The rows of a file side by side: each row an old and a new half; context on both, a deleted line's run beside the added
 * run that follows it, and a hunk's header across. Returns [{kind: "h"|"m", line} | {kind: "row", left, right}]. */
function splitRows(lines) {
    const rows = []
    for (let i = 0; i < lines.length; ) {
        const line = lines[i]
        if (line.kind === "h" || line.kind === "m") {
            rows.push({kind: line.kind, line, index: i})
            i++
        } else if (line.kind === "c") {
            rows.push({kind: "row", left: line, right: line, index: i})
            i++
        } else {
            let d = i
            while (d < lines.length && lines[d].kind === "d") d++
            let a = d
            while (a < lines.length && lines[a].kind === "a") a++
            const olds = lines.slice(i, d)
            const news = lines.slice(d, a)
            for (let k = 0; k < Math.max(olds.length, news.length); k++)
                rows.push({kind: "row", left: olds[k] || null, right: news[k] || null, index: k < olds.length ? i + k : d + k})
            i = a
        }
    }
    return rows
}
/* A file's added and deleted counts as GitHub's five squares: [added, deleted, unchanged] squares. */
function stat(insertions, deletions) {
    const total = (Number(insertions) || 0) + (Number(deletions) || 0)
    if (!total) return [0, 0, 5]
    const added = Math.round((5 * insertions) / Math.max(total, 5))
    const deleted = Math.round((5 * deletions) / Math.max(total, 5))
    return [added, deleted, Math.max(0, 5 - added - deleted)]
}
const statHtml = (insertions, deletions) => {
    const [a, d, u] = stat(insertions, deletions)
    return (
        '<span class="smithy-stat" aria-label="' +
        esc((Number(insertions) || 0) + " added, " + (Number(deletions) || 0) + " deleted") +
        '"><span class="p">+' +
        (Number(insertions) || 0) +
        '</span> <span class="m">−' +
        (Number(deletions) || 0) +
        '</span> <span aria-hidden="true">' +
        '<i class="a"></i>'.repeat(a) +
        '<i class="d"></i>'.repeat(d) +
        "<i></i>".repeat(u) +
        "</span></span>"
    )
}
const IMAGE = /\.(png|jpe?g|gif|webp|avif|bmp|ico)$/i
/* A binary image's two sides, each its raw file at a commit (oldSrc, newSrc may be null for an added or deleted file). */
function imageHtml(oldSrc, newSrc, name) {
    const side = (src, label) =>
        '<figure class="' + label.toLowerCase() + '"><figcaption>' + label + "</figcaption>" + (src ? '<img src="' + esc(src) + '" alt="' + esc(label + ": " + name) + '" loading="lazy">' : "<p>None</p>") + "</figure>"
    return '<div class="smithy-imgdiff">' + side(oldSrc, "Before") + side(newSrc, "After") + "</div>"
}
/* The plain rows of a file (no comments): unified or split, with the gaps linked by fileHref. For a commit's and a
 * comparison's Changes. */
function plainHtml(lines, {split = false, fileHref = null} = {}) {
    marked(lines)
    const before = gaps(lines)
    const num = n => '<span class="n">' + (n ?? "") + "</span>"
    if (!split)
        return (
            '<div class="smithy-lines">' +
            lines
                .map((line, i) => {
                    const gap = before.has(i) ? gapHtml(before.get(i), fileHref) : ""
                    if (line.kind === "h") return gap + '<div class="l h">' + hunkHtml(line.text) + "</div>"
                    if (line.kind === "m") return '<div class="l m">' + esc(line.text) + "</div>"
                    const sign = line.kind === "a" ? "+" : line.kind === "d" ? "-" : " "
                    return '<div class="l ' + line.kind + '">' + num(line.oldNo) + num(line.newNo) + sign + line.html + "</div>"
                })
                .join("") +
            "</div>"
        )
    return (
        '<div class="smithy-split">' +
        splitRows(lines)
            .map(row => {
                if (row.kind === "h") return (before.has(row.index) ? gapHtml(before.get(row.index), fileHref, true) : "") + '<div class="sr h">' + hunkHtml(row.line.text) + "</div>"
                if (row.kind === "m") return '<div class="sr m">' + esc(row.line.text) + "</div>"
                const half = (line, side) =>
                    line
                        ? '<span class="n">' + (side === "L" ? line.oldNo : line.newNo) + '</span><span class="t ' + (line.kind === "c" ? "c" : side === "L" ? "d" : "a") + '">' + line.html + "</span>"
                        : '<span class="n e"></span><span class="t e"></span>'
                return '<div class="sr">' + half(row.left, "L") + half(row.right, "R") + "</div>"
            })
            .join("") +
        "</div>"
    )
}

;({esc, diffLines, hunkLines, hunkPart, linesPart, wordMarks, marked, hunkHtml, gaps, gapHtml, splitRows, stat, statHtml, IMAGE, imageHtml, plainHtml})
