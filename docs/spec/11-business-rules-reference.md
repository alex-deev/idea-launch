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
| Offer acceptance | Moves project to `ACTIVE`; no payment/escrow funding |
| Completion | Automatic when all milestones are `RELEASED`/`COMPLETED` |

---

