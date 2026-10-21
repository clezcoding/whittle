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

- [ ] Tests added or changed for the behaviour (a bug fix has a test that fails without it)
- [ ] Commits are signed off (`git commit -s`), unless you are the maintainer

- [ ] `make check` passes locally
- [ ] Screenshots attached for visible changes
- [ ] README / docs updated when behaviour changed
- [ ] `docs/ASSURANCE.md` updated if the safety layer, capabilities or release workflow changed
