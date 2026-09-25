# Git history purge status

Runtime snapshots under `data/*.json` are environment state and may contain tenant/customer-derived operational data. They are ignored for future commits and tracked snapshots are removed from the current tree.

Removing files from the current tree does **not** remove them from existing Git commits, forks, clones, caches, CI artifacts, or GitHub history. **No history rewrite has been performed.**

If a security/privacy review requires historical removal, perform a separately approved history rewrite (for example with `git filter-repo`), rotate affected secrets independently, coordinate force-push/reclone steps, and verify provider caches/artifacts. Do not describe this repository as historically purged until that operation and verification have actually happened.
