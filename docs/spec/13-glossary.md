## 13. Glossary

| Term | Meaning |
|---|---|
| **Scope blueprint** | AI-generated project plan rendered as a `SCOPE_WIDGET` |
| **Publish (Approve & Publish)** | Client approval that normalizes the blueprint and opens the project for builder offers (`OPEN_FOR_BIDS`) |
| **Offer** | First-class builder proposal (one per builder/project): total (milestones auto-calc 30/40/30 over 3 milestones), long-term cost terms, milestone due dates, and project-level `platformTargets` forming a uniform v2 deliverable bundle |
| **Selected offer** | The single offer chosen by the client for negotiation; other non-terminal offers are blocked from acceptance until selection changes |
| **Final offer** | Builder-marked, decision-ready negotiated terms/bundle (frozen). Can be **unfinalized** by the builder (pre-accept) to `SELECTED` for revision, then re-finalized |
| **Platform target / deliverable bundle (v2)** | Agreed set of platform targets applied uniformly to every milestone. Each milestone stores a v2 bundle spec `{ version: 2, targets, slots }` (pinned kind/platform/OS per target, e.g. `WEB`→`WEB_LINK`, mobile→`MOBILE_BUILD`, desktop→`DESKTOP_BUILD`); copied to milestones on acceptance and enforced on submissions |
| **Escrow** | Project funds (`totalEscrow`) funded on acceptance of the final offer and released per milestone |
| **Probationary** | New builder state with a `$1,500` budget cap |
| **Demo widget** | Builder's v2 bundle milestone submission (`DEMO_WIDGET`, one pinned deliverable per contracted target; `demoUrl`/`accessUrl` mirrors first slot), reviewed/approved atomically by the client |
| **Release percent** | Share of escrow aligned to milestone payout (30/40/30) |
| **Refund tier** | Progressive refund percentage applied on cancellation by highest released stage |
