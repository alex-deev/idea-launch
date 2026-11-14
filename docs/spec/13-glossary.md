## 13. Glossary

| Term | Meaning |
|---|---|
| **Scope blueprint** | AI-generated project plan rendered as a `SCOPE_WIDGET` |
| **Publish (Approve & Publish)** | Client approval that normalizes the blueprint and opens the project for builder offers (`OPEN_FOR_BIDS`) |
| **Offer** | First-class builder proposal (one per builder/project): total (milestones auto-calc 30/40/30 over 3 milestones), long-term cost terms, and milestone due dates |
| **Selected offer** | The single offer chosen by the client for negotiation; other non-terminal offers are blocked from acceptance until selection changes |
| **Final offer** | Builder-marked, decision-ready negotiated terms for the selected offer |
| **Escrow** | Project funds (`totalEscrow`) funded on acceptance of the final offer and released per milestone |
| **Probationary** | New builder state with a `$1,500` budget cap |
| **Deliverable spec** | Per-milestone contract (kind/label/required fields/notes) declared in offer terms and copied to `Milestone.deliverableSpec` on acceptance; governs typed demo submissions |
| **Demo widget** | Builder's typed milestone submission (`DEMO_WIDGET`, kind-aware link/artifact + instructions; `demoUrl`/`accessUrl` mirrors for legacy), reviewed/approved by the client |
| **Release percent** | Share of escrow aligned to milestone payout (30/40/30) |
| **Refund tier** | Progressive refund percentage applied on cancellation by highest released stage |
