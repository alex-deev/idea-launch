## 1. Overview

Idea Launch is a two-sided marketplace for scoping, comparing offers, funding, and delivering software projects:

- **Clients** describe an idea, receive an AI-generated scope blueprint, refine/approve and **publish** it, compare offers from multiple builders, select one to negotiate terms with, and fund a final milestone-based escrow agreement.
- **Builders** onboard (ecosystems + portfolio), review published plans, submit **one offer per project**, negotiate/finalize terms when selected, deliver staged demos, and receive escrow releases.
- Delivery is governed by four fixed stages (0/30/40/30 auto-calculated), late penalties, progressive refunds, extensions, and post-project quality ratings.
- Project interaction happens in a realtime chat room powered by Socket.io, with rich views/widgets (scope, offers/terms, demos) rendered inline; pre-funding negotiation chat is limited to client and selected builder.

**Status:** this specification is the **promoted target workflow** (V2 + V5 + V4-lite). Current implementation may lag behind parts of this spec; see §12 and [`docs/ideas/client-builder-offer-workflow.md`](../ideas/client-builder-offer-workflow.md).

---

