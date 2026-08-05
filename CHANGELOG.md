# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.0] - 2026-08-05

First stable release of FexAPI — a zero-config mock API CLI. Describe your endpoints in a schema file, run one command, and get a local server that returns realistic, deterministic data powered by Faker.js.

### Added
- **Schema-first workflow**: Define routes once in `schema.fexapi`, generate a spec, and serve it.
- **Deterministic data**: Seeded data ensures responses stay stable across runs, snapshots, and CI.
- `fexapi init`: Scaffolds `schema.fexapi`, `fexapi.config.js`, and sample schema files, featuring an interactive wizard for port, CORS, and starter routes.
- `fexapi generate`: Compiles your schema into a runnable API spec.
- `fexapi serve`: Starts the mock server on `localhost:4000` by default.
- `fexapi dev --watch`: Auto-reloads the server on schema or config changes, with hardened recovery if a reload fails.
- `fexapi format`: Reformats multiline schema files for readability.
- `--log` flag: Provides request/response timing output in both `serve` and `dev` modes.
- **Dynamic route params** (e.g. `/users/{id}`) and pagination envelopes.
- **Nested arrays and objects** support in schema definitions.
- **YAML-based custom schemas** for reusable data shapes.
- `fexapi.config.js` configuration file for overriding port, host, latency, CORS, and per-route status/behavior.
- Polished terminal UI featuring branded logs, colorized output, spinners, and summary cards after each run.

### Changed
- Moved generated API spec output to a cleaner `.cache` directory, keeping the project root tidy.
- Stricter schema-first enforcement: removed migration-based flows in favor of a single source of truth.
- Simplified and clearer `--help` output.

### Fixed
- Corrected routing and data handling for POST requests.
- Hardened schema and CLI argument validation for edge cases.

### Docs
- Published full documentation site with getting-started guides, CLI references, and CI examples for common stacks.
