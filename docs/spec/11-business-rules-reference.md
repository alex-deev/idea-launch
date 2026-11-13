## 11. Business Rules Reference

| Rule | Implementation |
|---|---|---|
| Milestone stages | 4 fixed stages: Agreement, Initial Demo, Final Demo, Deployment |
| Escrow amounts | Integer cents (agreed final total funded on acceptance) |
| Milestone price calculation | **Business-model auto-calc, read-only:** 0% / 30% / 40% / 30% of total escrow → Agreement $0.00 (no payout), Initial Demo 30%, Final Demo 40%, Deployment 30% (integer cents, remainder-adjusted to sum exactly). Titles/order fixed. |
| Publish / open for offers | **Approve & Publish**: approve blueprint normalizes milestones/total and moves project to `OPEN_FOR_BIDS` (visible to multiple builders; no exclusive first-claim). Clients may have at most **3** projects in `OPEN_FOR_BIDS` at a time (including negotiating/selected pre-funding); publish is blocked at the limit (SCOPING drafts remain unlimited). Slots free on `ACTIVE` or `CANCELLED`. |
| Offers | One active offer per builder per project. Builder may **revise/withdraw** only while `SUBMITTED` (not selected/blocked/terminal); **withdraw is final** for that project in MVP. Terms: total (drives milestones), long-term costs (structured, informational MVP), milestone due dates. Builders with **3 accepted/`ACTIVE` projects** (`builderId` assigned, offers accepted) cannot see or submit offers on new open project plans. |
| Selection & negotiation | Client selects one offer → `SELECTED`, other non-terminal offers `BLOCKED`. Pre-funding chat/term edits limited to client + selected builder. Builder marks offer **`FINAL`** for decision. **Cancel negotiation** → selection cleared, selected offer reverts to `SUBMITTED` retaining terms, blocked offers reopen. |
| Acceptance | Client accepts **`FINAL`** offer → apply agreed terms/due dates to project+milestones, assign builder, mark other offers `REJECTED`, fund escrow (mock activates; real Stripe may remain pending until funded). |
| Late penalty | 5% of milestone amount, rounded, if submitted after `dueDate`; accumulated in `project.latePenaltyTotal` (Agreement $0). |
| Demo review & revision (Direction A) | Applies to **Initial Demo** and **Final Demo** only. Client may **Approve** or **Reject** the **current** demo submission (reject requires reason; reject never releases funds). Rejection sets `CHANGES_REQUESTED` with `revisionRequestedAt` (soft 24h target) and reason; **each rejection resets** the 24h target. Builder resubmits the **same milestone** (new current submission); resubmission after the soft target is **allowed but flagged/overdue** (no hard block/escalation). Only the current, non-rejected reviewable submission may be approved (`approve_milestone` guarded). Multiple reject/resubmit cycles allowed. |
| Refund on cancel | Released stage ≥ 3 → 60%; ≥ 2 → 90%; else 100% (based on highest released stage number). |
| Probationary builder cap | `$1,500.00` (`150000` cents) enforced in UI and server-validated on acceptance. |
| Builder accepted-active project limit | Max **3** projects with `status=ACTIVE` per builder. At limit, builder cannot see available open project plans (`GET /api/projects?available=true` returns empty with `unavailableReason: "AT_CAPACITY"`) and cannot submit new offers. |
| Client open-for-bids project limit | Max **3** client-owned projects in `OPEN_FOR_BIDS` (count includes negotiating/selected but unfunded). “Approve & Publish” (`approve_scope`) is server-enforced and blocked at limit with clear count/guidance; `SCOPING` drafts are not limited. Slots free when a project becomes `ACTIVE` or `CANCELLED`. Grandfathered over-cap clients cannot publish new projects until below the limit. |
| Extension | +48 hours, requested flag only, post-acceptance (`ACTIVE`) flow; no approval flow. |
| Quality rating | Integer 1–5 after `COMPLETED` or `CANCELLED`, one score per project. |
| Milestone payout | `approve_milestone` releases via escrow: $0 Agreement without transfer; positive milestones transfer (mock auto-pay, real Stripe may stay pending). |
| Payments | No webhooks yet; funding/payout status set synchronously by provider call. |
| Completion | Automatic when all milestones are `RELEASED`/`COMPLETED`. |

---

