## What and why

<!-- One or two sentences. Link the issue: Fixes #123 -->

## Type

- [ ] Rule (YAML only)
- [ ] Bug fix
- [ ] Feature
- [ ] Docs / tooling

## Safety

- [ ] Nothing is deleted or moved without a preview and a way back
- [ ] New code paths go through `Safety::check`
- [ ] Tests use a fake home (`Context::for_home`), never the real one

## Checks

- [ ] `make check` passes locally
- [ ] Screenshots attached for visible changes
- [ ] README / docs updated when behaviour changed
