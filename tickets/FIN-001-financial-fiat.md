# FIN-001: Financial System - Fiat (BACKLOG)

**Status**: 🆕 Not Started
**Assignee**: TBD
**Priority**: Low (Backlog)
**Created**: 2026-02-06
**Updated**: 2026-02-06

---

## Overview

Implement traditional fiat payment processing with subscription management, usage metering, invoicing, and multi-currency support. Alternative to Stripe (user expressed :vomit: reaction).

## Potential Providers

- **Paddle**: Merchant of record, handles tax/VAT
- **Lemon Squeezy**: Modern Paddle alternative
- **PayPal Commerce**: Global reach
- **Adyen**: Enterprise-grade, multi-currency
- **Braintree**: PayPal-owned, developer-friendly

## Key Components

- **Subscriptions**: Plan management, seat-based, usage-based
- **One-time payments**: Credits, addons
- **Invoicing**: Auto-generated, PDF download
- **Tax handling**: Automatic tax calculation
- **Multi-currency**: Support major currencies
- **Payment methods**: Cards, bank transfers, wallets
- **Dunning**: Failed payment recovery
- **Webhooks**: Payment events

## Reference

- User note: "I know stripe is the go to but... :vomit:"
- TODO.md: Line 22 (Missing Deps - `stripe`)

## Related Tickets

- **Blocked by**: None (backlog item)
- **Blocks**: None

---

_Backlog stub - research and prioritize later_
