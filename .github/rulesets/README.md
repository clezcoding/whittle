# Rulesets

`main.json` is the branch protection for `main`, in the format GitHub's *Import a ruleset* accepts: *Settings, Rules, Rulesets, New ruleset, Import a ruleset*. It is kept here so the setting is reviewable and reproducible. Importing it is a repository setting only the owner can change; nothing in this repository applies it automatically.

What it enforces, with **no bypass actors** (administrators included, which is what OpenSSF Scorecard's *Branch-Protection* check looks for):

- no deleting or force-pushing `main`, linear history
- every change through a pull request, squash merge only, stale approvals dismissed on new pushes, review threads resolved
- the single status check **CI passed** must be green on an up-to-date branch

`required_approving_review_count` is `0` on purpose: with one maintainer, a required second reviewer would block every merge. Raise it to `1` as soon as there is a second maintainer; Kodiak keeps working either way.
