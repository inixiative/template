# Changelog

All notable changes to `@template/ui` will be documented in this file.

The format is based on Keep a Changelog and this project adheres to Semantic Versioning.

## [Unreleased]

### Added

- Design-system governance docs and DS lint script integration.
- New primitives: `Textarea`, `Checkbox`, `Switch`, `Alert`, `Skeleton`, `FormField`, `Stepper`, `DataTable`.
- Wizard composition APIs: `WizardProvider`, `useWizard`, `WizardStep`.
- Ladle scripts and foundational stories for primitives and page patterns.

### Changed

- Auth forms (`SignupForm`, `LoginForm`) migrated to `react-hook-form` + Zod and `FormField` composition.
- `Input` now consumes `FormField` context for consistent `id` and ARIA wiring.
- `Table` pagination/empty labels are now prop-driven for i18n override.
- `PasswordInput`, `SlugInput`, and `Breadcrumb` updated to align with i18n/a11y contract.
- Shared theme token taxonomy expanded (typography, elevation, motion, z-index).

### Deprecated

- None.

### Removed

- None.

### Fixed

- Design-system checks now fail on hardcoded colors and disallowed Tailwind color classes in DS surfaces.
