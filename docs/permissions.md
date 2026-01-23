# Permissions & Access Control

Stub document — to be expanded.

---

## Three Layers, Separate Concerns

```
PLATFORM (Inixiative)
    │
    │   Infrastructure layer
    │   Escrow, tokens, governance primitives, identity
    │
    ▼
SPACES (e.g., Livestock)
    │
    │   Marketplace layer
    │   Templates, onboarding, support, tag schemas
    │   Does NOT manage initiatives
    │
    ▼
INITIATIVES
    │
    │   Self-governing entities
    │   Define their own roles and rules
    │   Space has no special authority here
```

---

## Platform Roles

| Role | What They Do |
|------|--------------|
| **Platform Admin** | Approve Spaces, manage categories, handle escalated disputes, platform settings |
| **Platform Staff** | Support, moderation, reporting |

---

## Space Roles

Spaces are thin — they're marketplaces, not initiative managers.

| Role | What They Do |
|------|--------------|
| **Space Owner** | Registered the Space, business responsibility |
| **Space Staff** | Manage the Space's frontend, templates, onboarding, support |

### What Spaces Do
- Define templates and rule sets for their domain
- Build the frontend/app for their market
- Provide tag schemas and classifications
- Onboard operators (help them create initiatives)
- Handle support and bug reports
- Facilitate dispute resolution (may integrate Kleros or similar)
- Take a revenue cut

### What Spaces DON'T Do
- Manage initiatives day-to-day
- Submit proofs on behalf of operators
- Make decisions within initiatives
- Have special authority over funded initiatives
- Control funds or governance

---

## Initiative Roles

**The initiative decides who is in charge.**

When an initiative is created, it defines its own roles:

| Role | What They Do |
|------|--------------|
| **Operator** | The representative running this project — submit proofs, post updates, receive funds |
| **Staff** | Helpers designated by the operator — limited permissions |
| **Participant** | Token holder — vote, view, receive proceeds |

### Initiative Self-Governance

The initiative's rules define:
- Who the operator is
- What the operator can do
- How the operator can be changed (if at all)
- What requires participant vote
- How funds are released

**Space has no special role here.** Once the initiative is created, it governs itself according to its own rules.

---

## The Separation

| Layer | Creates Rules | Enforces Rules | Manages Operations |
|-------|---------------|----------------|-------------------|
| Platform | Platform policies | Smart contracts | Platform itself |
| Space | Templates, defaults | Initiative inherits | Space frontend only |
| Initiative | Its own governance | Smart contracts | Operator + participants |

A Space might create the template that an initiative uses. But once created, the initiative is independent. The Space can't override the initiative's rules any more than a participant can.

---

## Visibility & Access Levels

Platform can constrain what Spaces offer. Spaces can constrain what initiatives can choose. But initiatives control their own visibility within those constraints.

| Level | Who Can See | Who Can Join |
|-------|-------------|--------------|
| **Public** | Anyone | Anyone |
| **Listed** | Anyone | Requires approval or invitation |
| **Unlisted** | Only with direct link | Link holders, or requires approval |
| **Private** | Participants only | Invitation only |

### Inheritance

```
Platform: "Financial initiatives require KYC tier 3"
    │
    ▼
Space: "Livestock initiatives default to Listed"
    │
    ▼
Initiative: "This project is Private, invitation only"
```

Each layer can restrict further but cannot exceed parent permissions.

---

## Initiative Sovereignty

Once funded, an initiative's rules are immutable (unless governance allows changes).

**Cannot be changed unilaterally:**
- Milestones and release conditions
- Escrow terms
- Governance/voting rules
- Operator designation (unless governance allows)
- Fund recipients

**Can be changed via governance:**
- If the initiative's rules allow amendments
- Requires participant vote (threshold defined at creation)
- Material changes may trigger exit rights

Neither Platform nor Space can override initiative governance. The rules are the authority.

---

## Open Questions

- How granular do initiative role permissions need to be?
- Can initiatives define custom roles beyond operator/staff/participant?
- Multi-sig requirements for operator actions?
- How does operator succession work if operator disappears?
- Dispute escalation path: Initiative → Space support → Platform?
- On-chain vs off-chain permission storage?

---

## Related Docs

- [Platform Architecture](platform-architecture.md) — System structure
- [Product Flows](product-flows.md) — User journeys (TODO)
