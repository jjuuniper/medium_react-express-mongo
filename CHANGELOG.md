## [1.1.1](https://github.com/jjuuniper/medium_react-express-mongo/compare/v1.1.0...v1.1.1) (2026-01-24)


### Bug Fixes

* make Release workflow wait for CI Pipeline to complete ([46c9fca](https://github.com/jjuuniper/medium_react-express-mongo/commit/46c9fcae6a6414123b047e0cc4c50f47a35bf972))

## [1.1.0](https://github.com/jjuuniper/medium_react-express-mongo/compare/v1.0.8...v1.1.0) (2026-01-24)


### Features

* add /api/health endpoint for deployment verification ([fdc6058](https://github.com/jjuuniper/medium_react-express-mongo/commit/fdc6058fe3af1f0ad0260527c09dc31e1453d148))

## [1.0.8](https://github.com/jjuuniper/medium_react-express-mongo/compare/v1.0.7...v1.0.8) (2026-01-22)


### Bug Fixes

* Add imagePullSecrets to production values ([bd8312b](https://github.com/jjuuniper/medium_react-express-mongo/commit/bd8312b939867371a990c8966006cb9695215523))

## [1.0.7](https://github.com/jjuuniper/medium_react-express-mongo/compare/v1.0.6...v1.0.7) (2026-01-22)


### Bug Fixes

* Inject production secrets via Helm --set flags ([84d6a6b](https://github.com/jjuuniper/medium_react-express-mongo/commit/84d6a6bb6c67b8dcd44e963d0d6bc7ea7579eb45))

## [1.0.6](https://github.com/jjuuniper/medium_react-express-mongo/compare/v1.0.5...v1.0.6) (2026-01-19)


### Bug Fixes

* Add GHCR authentication to production deployment workflow ([49e37a5](https://github.com/jjuuniper/medium_react-express-mongo/commit/49e37a5947d9fb3e73604bd6ecb1bd0adbb3a680))

## [1.0.5](https://github.com/jjuuniper/medium_react-express-mongo/compare/v1.0.4...v1.0.5) (2026-01-19)


### Bug Fixes

* Implement two-stage Docker image tagging to resolve version timing issues ([39cf85b](https://github.com/jjuuniper/medium_react-express-mongo/commit/39cf85b4b14eec3a00cdb87c0b825d3877e2284f))

## [1.0.4](https://github.com/jjuuniper/medium_react-express-mongo/compare/v1.0.3...v1.0.4) (2026-01-19)


### Bug Fixes

* Fetch Git tags in CI workflow push-images job ([0a08dde](https://github.com/jjuuniper/medium_react-express-mongo/commit/0a08dde47246dc43baa165bbefc345ef8a682b27))

## [1.0.3](https://github.com/jjuuniper/medium_react-express-mongo/compare/v1.0.2...v1.0.3) (2026-01-19)


### Bug Fixes

* Use Git tags instead of package.json for Docker image versioning ([f93f3a7](https://github.com/jjuuniper/medium_react-express-mongo/commit/f93f3a7a30f8975bf91df2ad66c9c540fb332f4f))

## [1.0.2](https://github.com/jjuuniper/medium_react-express-mongo/compare/v1.0.1...v1.0.2) (2026-01-17)


### Bug Fixes

* Exclude Dependabot PRs from title validation check ([50bfd65](https://github.com/jjuuniper/medium_react-express-mongo/commit/50bfd65624efa187121effcdeb5b6928124126cb)), closes [#67](https://github.com/jjuuniper/medium_react-express-mongo/issues/67) [#68](https://github.com/jjuuniper/medium_react-express-mongo/issues/68) [#69](https://github.com/jjuuniper/medium_react-express-mongo/issues/69) [#70](https://github.com/jjuuniper/medium_react-express-mongo/issues/70)

## [1.0.1](https://github.com/jjuuniper/medium_react-express-mongo/compare/v1.0.0...v1.0.1) (2026-01-16)


### Bug Fixes

* Disable PR/issue commenting in release workflow to prevent errors on closed PRs ([db7ed44](https://github.com/jjuuniper/medium_react-express-mongo/commit/db7ed44dc258dadaee40d9e8e2a750f5f0b192c9))
* Upgrade bcrypt to 6.0.0 to resolve tar vulnerability (GHSA-8qq5-rm4j-mr97) ([e62aaa2](https://github.com/jjuuniper/medium_react-express-mongo/commit/e62aaa2f675fdaec4ddc2484f060bafdad9fd1a0))

## 1.0.0 (2026-01-16)


### Features

* restore complete CI/CD infrastructure to main ([a0ef3aa](https://github.com/jjuuniper/medium_react-express-mongo/commit/a0ef3aa0d899e9d1815935b301222cb26617ac2f))


### Bug Fixes

* upgrade release workflow to Node.js 20 ([5078490](https://github.com/jjuuniper/medium_react-express-mongo/commit/50784900b0d365d902af3d5497f15ace80fa7473))
