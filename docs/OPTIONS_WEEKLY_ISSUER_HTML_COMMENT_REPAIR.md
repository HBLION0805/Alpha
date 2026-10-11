# Issuer HTML comment repair — October 11, 2026

Independent review of 3253c49 found that the company-calendar parser removed
script/style blocks but not HTML comments. A complete Upcoming Events block
inside a comment could therefore create a false published future event.

The parser now removes HTML comments before identifying any named section.
Regression coverage rejects a comment-only October 13 event block, ignores that
block when a real section follows, rejects commented event rows and refuses a
commented explicit-empty upcoming section. No source call or stored record was
changed. The focused company suite passed 13/13.

All 82 actual issuer receipts were replayed against their original saved parsed
outputs with zero issues. All 11 parsed IR sources retained exact results:
MSFT, AVGO, AMD, LRCX, KLAC, ARM, CRWD, WDC, ADBE, AMAT and DELL. Every file hash
in the prior stage3 acceptance remained identical. Local evidence:
`data/runtime/options-weekly-sources/gap-repair-stage4/comment-p2-replay.json` and
`comment-p2-tests.txt` in the same directory.

SEC scope is explicitly 34,687 read rows: six rejected old records, 34,138
accepted rows outside the 30-day display window, 533 displayed rows and ten
additional recent DELL rows omitted by the 100-row display cap. Forty-three
referenced historical files were not fetched. The full raw responses remain
local; metadata is not a future earnings calendar or filing-body acquisition.

The PDF and PANW supplemental work is a separate commit. This repair does not
change the 36-company denominator, 4178, the finite runner or any execution gate.

## Unclosed-comment follow-up

Review of 355b3a4 found the same boundary issue for an HTML comment without a
closing delimiter. Both the company calendar and PANW supplement now remove
closed comments and comments extending through EOF before looking for sections.
Each parser has a future-event negative case and a visible-before-comment
control. The two suites passed 23/23 (company 14, supplement 9). All 82 real
issuer replays and the original PANW interpretation remained exact. No request
was made for this repair; the ongoing bounded page follow-up is separate.
