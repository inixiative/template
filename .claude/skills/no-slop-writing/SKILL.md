---
name: no-slop-writing
description: Write external prose in a disciplined professional register that reads as human, not generic AI. Use for any document, proposal, memo, recommendation, executive summary, client or partner email, analytical deck, findings write-up, or anything that will be sent, published or presented to other people. Trigger on "write this up," "draft a proposal," "draft an email," "make this sound less like AI," or any request for polished external writing. Skip for structured outputs like JSON, code, or forms.
---

# No-Slop Writing

This skill sets a **genre**, not a personal voice. You are writing inside the advisory genre, the way a legal drafter writes inside the legal genre or a physician writes inside the clinical-note genre. The genre's conventions forbid slop structurally: a well-formed memorandum of advice has no room for a hype colon or a momentum-faking rhetorical question, the same way a contract has no room for them.

Professional deliverables are not places to "add voice." Voice is what leaks when the genre isn't holding. Hold the genre and the slop has nowhere to enter.

Read this file **and** both reference files before drafting a sentence:

- `references/register-anchors.md`: verbatim slop-free specimens of the genre. This is the target.
- `references/slop-quarantine.md`: the exact patterns that mark writing as generic-AI or vendor-marketing. These are rejected on sight.

Models imitate more reliably than they obey. The anchors are what you imitate; the quarantine is what you refuse.

---

## Register Generation Protocol (run in order, before any drafting)

**1. Genre transfer.** Never frame the task to yourself as "a proposal," "a blog post," "an email," or "a deck." Reframe it as a strong genre whose conventions predate AI:

- Proposals, scopes, terms, recommendations → a memorandum of advice from a senior advisor to an executive committee.
- Emails → correspondence between two senior operators who respect each other's time.
- Analytical decks → a consulting readout where each slide title is the finding and the body is the evidence for it.
- Explanations and findings → a briefing written by the person who did the analysis, for a peer who will act on it.

Generate inside that genre. Retitle and reformat as the requested deliverable afterward.

**2. Select the register by deliverable type.** Use the selector below. A slide deck and a memo are different genres even though both are professional.

**3. Anchor to the exemplars.** Read `references/register-anchors.md`. Pick the anchor matching the deliverable type and continue in exactly that register, the way you would extend a document already in progress. If an instruction in this file and an anchor ever conflict, the anchor wins.

**4. Load the quarantine.** Read `references/slop-quarantine.md`. Hold every pattern in it as a live prohibition while you draft, not as an afterthought at review.

**5. Generate from a fact table.** Slop is what fills space when there is nothing concrete to say. Before drafting, assemble the specific claims, numbers, names, dates, and decisions the piece must carry, from the source material. Every sentence must carry at least one item from that table or do structural work connecting two of them. When the table is thin, say so and ask for the missing facts. Never pad.

---

## Register selector

| Deliverable | Genre frame | Form | Register rules specific to this type |
|---|---|---|---|
| **Proposal / scope / SOW** | Memorandum of advice to an exec committee | Prose, sequenced | Strictest. Recommendations lead, each with a next action and a specific condition. No rhetorical questions, no emphasis fragments, no hype colons. Hedges must be concrete ("subject to vendor flexibility commitments"), never vague ("potentially transformative"). |
| **Memo / recommendation** | Memorandum of advice | Prose | As above. Structure: what we found → what we recommend → what has to be true → what happens first. |
| **Executive summary** | Opening of a consulting readout | Quantified headline + itemized substantiation | Lead with the number and the decision. Itemize the components. No throat-clearing. |
| **Analytical deck / slides** | Consulting readout | Action-title + evidence | Title is a full-sentence finding with a so-what. Body carries a number, a named comparator, or a decision on every line. Telegraphic is correct here; prose paragraphs are wrong. |
| **Findings / diagnostic** | Discovery readout | Claim + specific substantiation | Each finding states the claim, then the evidence, plainly. Balanced (what works and what doesn't). No editorializing adjectives. |
| **Email** | Correspondence between senior operators | Short prose | Direct, plain, no filler opener ("I hope this finds you well," "Just circling back"). Say the thing, state the ask, stop. |

The prohibitions in the quarantine apply across every row.

---

## Review as a rejector, not a rewriter

When reviewing or revising a draft, your own or someone else's, act as a rejector: flag the violating sentence and name the reason (cite the quarantine pattern), then regenerate that sentence inside the anchored register. Do not smooth prose in passing. A reviewer who rewrites line by line becomes a second author writing in the default register, and the default register is where slop lives.

---

## The genre's non-negotiables (summary; full detail in the quarantine)

The genre **demands**: fact density (numbers, names, decisions), sequenced recommendations, falsifiable "what needs to be true" framing, specific conditionality, plain substantiation, a named human owner for every decision (third person, consistent tense).

The genre **forbids**: objects acting in place of people (actorless participles like "a tool bought for..." followed by present-tense object verbs like "it surfaces," "keeps adding," "nobody owns it"); em dashes; "not X, it's Y" reframes; rhetorical questions as transitions; one-line emphasis fragments; colons used to hype rather than deliver; stacked synonym adjectives; affirmation openers; "it's worth noting"; truth-intensifiers ("actually," "genuinely," "really"); tacked-on reflective codas ("which is why..."); default rule-of-three; insight-cosplay metaphors ("load-bearing," "the through-line," "says the quiet part"); corporate-polish vocabulary (leverage, robust, seamless, empower, unlock, elevate, streamline, holistic, cutting-edge, best-in-class, myriad, foster, navigate-figurative); filler transitions ("Here's the thing," "That said," "At the end of the day," "In today's landscape").

If the craft is visible, it is too much. The reader of a good deliverable feels informed and moved to act, not impressed by the writing.
