# Inixiative Platform Architecture

## What It Is

**Inixiative** is infrastructure for tokenized ownership and programmable escrows. Apps register as "Spaces" on the platform and use Inixiative to handle the hard parts: user accounts, token issuance, fund management, milestone verification, and voting.

Think of it as Shopify for tokenized projects — you bring the domain expertise (cattle, real estate, film), we handle the financial plumbing.

---

## Core Entities

### Platform Level (Inixiative manages)

**Category** — Platform-defined groupings for discovery
- Real Estate, Livestock, Energy, Film, Governance, etc.
- A Space can belong to multiple categories
- Used for marketplace browsing and filtering

**Space** — A registered app/business building on Inixiative
- Has its own branding, users, domain
- Belongs to one or more Categories
- Defines its own Tag Schema (see below)
- Creates Initiatives on behalf of its users

**User** — A person on the platform
- Single identity across all Spaces (SSO)
- Has a wallet (managed or self-custodied)
- Can invest in initiatives across any Space

### Project Level (Spaces create via API)

**Inixiative** — A one-time project with a defined end
- Fundraise → Execute → Resolve
- Issues tokens representing ownership shares
- Has milestones that gate fund release
- Example: "Purchase 25 head of cattle"

**Instituxion** — An ongoing entity with continuous operations
- Issues tokens representing perpetual ownership
- Distributes dividends over time
- Example: "Highland Cattle Trust" that operates indefinitely

**Milestone** — A condition that releases escrowed funds
- Defined by the Space when creating a project
- Verification can be: manual approval, Space attestation, token holder vote, oracle, or time-based
- Funds stay locked until milestones are verified

**Investment** — A user's stake in a project
- Tracked both on-chain (tokens) and off-chain (database)
- Gives voting rights on milestone approvals

---

## The Tag Schema System

**Problem**: Inixiative shouldn't need to know that "Angus" and "Scottish Highland" are cattle breeds, or that "2BR/1BA" describes an apartment. But initiatives need rich, filterable metadata specific to their domain.

**Solution**: Spaces register their own Tag Schema. Inixiative stores and displays it generically.

### How It Works

1. **Space defines its schema** when registering:
   - Livestock defines: Breed, Age Range, Location, Purpose (dairy/beef/breeding)
   - Real Estate defines: Property Type, Bedrooms, Square Footage, Zoning

2. **Space provides tag values** when creating initiatives:
   - "Breed: Scottish Highland, Purpose: Beef, Location: Victoria AU"

3. **Inixiative stores tags as structured data** without understanding them

4. **Inixiative displays tags** in the marketplace/UI using the schema's display rules

5. **Users can filter** by tags within a Space or Category

### What This Enables

- Livestock can add "Heat Resistant" or "Experimental Crossbreed" without Inixiative code changes
- Real Estate can distinguish "Commercial" from "Residential" with different tag sets
- Each Space controls its own taxonomy
- Inixiative remains domain-agnostic

---

## How Spaces Interact with Inixiative

```
┌──────────────────────────────────────────────────────────┐
│                    INIXIATIVE PLATFORM                   │
│                                                          │
│   Users    Categories    Tokens    Escrows    Voting     │
│     │          │           │          │          │       │
│     └──────────┴───────────┴──────────┴──────────┘       │
│                         API                              │
└──────────────────────────────────────────────────────────┘
                           │
         ┌─────────────────┼─────────────────┐
         │                 │                 │
    ┌────┴────┐      ┌─────┴─────┐     ┌────┴────┐
    │Livestock│      │Real Estate│     │  Film   │
    │ (Space) │      │  (Space)  │     │ (Space) │
    └─────────┘      └───────────┘     └─────────┘
         │                 │                 │
    Tag Schema:       Tag Schema:       Tag Schema:
    - Breed           - Property Type   - Genre
    - Age             - Bedrooms        - Budget Range
    - Location        - Zoning          - Director
    - Purpose         - Sq Footage      - Stage
```

### What Lives Where

| Concern | Who Owns It |
|---------|-------------|
| User accounts, auth, SSO | Inixiative |
| Wallet management | Inixiative |
| Token deployment | Inixiative |
| Escrow & fund release | Inixiative |
| Milestone verification logic | Inixiative |
| Voting mechanics | Inixiative |
| Categories | Inixiative |
| Tag Schema definition | Space |
| Tag values per initiative | Space |
| Domain-specific UI | Space |
| Domain-specific business logic | Space |

---

## Key Architectural Principles

1. **One token per project** — Each initiative/instituxion gets its own ERC-20. Clear ownership, standard tooling.

2. **Namespaced identifiers** — `inixiative:livestock:proj-123` makes origin and ownership unambiguous.

3. **Schema extensibility** — Spaces define their own metadata. Inixiative doesn't need to understand cattle breeds.

4. **Verification is pluggable** — Start with "trust the Space" attestations. Add oracles, voting, or external verification later without rewriting.

5. **Single user identity** — Log in once, invest across any Space. Spaces don't manage separate user databases.

6. **Separation of concerns** — Livestock knows cattle. Inixiative knows tokens and escrows. Neither duplicates the other.

---

## User Journeys

### Investor
1. Discovers initiative on Livestock (or Inixiative marketplace)
2. Logs in via Inixiative SSO (or creates account)
3. Invests USDC → receives tokens
4. Funds held in escrow
5. Votes on milestone completion (if required)
6. Receives proceeds when project resolves

### Space Operator (e.g., Livestock)
1. Registers Space on Inixiative
2. Defines Tag Schema for their domain
3. Creates initiatives via API with tags
4. Submits milestone proofs when conditions are met
5. Receives released funds from escrow
6. Distributes proceeds to token holders (via Inixiative)

### Platform Admin (Inixiative)
1. Approves Space registrations
2. Manages Categories
3. Reviews disputed milestones (if escalated)
4. Monitors for fraud/abuse

---

## Open Questions

1. **Wallet custody model** — Smart wallets (Privy/Dynamic), self-custody, or hybrid? Depends on target users.

2. **Verification trust** — How much do we trust Space attestations? Should Spaces stake tokens that get slashed on fraud?

3. **Secondary trading** — Can tokens be traded? Build orderbook or integrate DEX?

4. **Failed projects** — Refund mechanics when milestones aren't met?

5. **Regulatory** — These are likely securities. Compliance strategy?

6. **Tag schema governance** — Can Spaces change their schema after initiatives exist? Migration path?

---

## Why This Works

**For Spaces**: They get token infrastructure, escrow, voting, and user management without building it. Focus on their domain.

**For Investors**: Single account across all investment types. Milestone-gated escrows protect against rugs.

**For Inixiative**: Platform effects — more Spaces means more initiatives means more users means more Spaces.

**The Tag Schema system** is the key insight: it lets Inixiative be a generic platform while Spaces maintain rich, domain-specific data. Livestock doesn't have to explain cattle to us. We just store and display what they tell us.
