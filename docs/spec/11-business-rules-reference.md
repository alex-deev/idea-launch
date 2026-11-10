## 11. Business Rules Reference

| Rule | Implementation |
|---|---|
| Milestone stages | 4 fixed stages: Agreement, Initial Demo, Final Demo, Deployment |
| Escrow amounts | Integer cents; seed total `$1,000.00` |
| Release percentages | Seed: 0 / 30 / 40 / 30 |
| Late penalty | 5% of milestone amount, rounded, if submitted after `dueDate`; accumulated in `project.latePenaltyTotal` |
| Refund on cancel | Released stage ≥ 3 → 60%; ≥ 2 → 90%; else 100% |
| Probationary builder cap | `$1,500.00` (`150000` cents) enforced only in the frontend offer button |
| Extension | +48 hours, requested flag only; no approval flow |
| Quality rating | Integer 1–5 after `COMPLETED` or `CANCELLED`, one score per project |
| Scope approval | Moves project to `OPEN_FOR_BIDS` |
| Offer acceptance | Moves project to `ACTIVE` and calls `fundEscrow`: mock payments auto-succeed and activate; real Stripe returns a pending intent/client secret and leaves the project unactivated until funded |
| Milestone payout | `approve_milestone` calls `releaseMilestone`: mock transfers auto-pay; real Stripe transfers may stay pending |
| Payments | No webhooks yet; funding/payout status is set synchronously by the provider call |
| Completion | Automatic when all milestones are `RELEASED`/`COMPLETED` |

---

