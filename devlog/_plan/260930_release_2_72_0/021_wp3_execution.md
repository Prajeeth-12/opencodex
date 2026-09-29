# 021 wp3 execution: promotion and release

| Step | Evidence |
|---|---|
| Candidate | C = dev `1cd9d25517` (#6240 squash), version sources 2.72.0 |
| Pre-move | #6243 → dev `73289d46ae` (2.73.0), `maintainer-sponsored` after review |
| Preview promotion | `codex/promote-preview-2.72.0`: `-s ours` merge of origin/preview + sync to 2.72.0-preview.20260930 (`14ccfe1a1a`); diff vs C = four version sources; PR #6245 merged (merge commit) → preview `4f9e3f0afb` |
| Main promotion | `codex/promote-main-2.72.0`: `-s ours` merge of origin/main (`77cb00512f`), tree equals C; PR #6246 merged → main `5ab6d52b2a` |
| Push-event gates | preview: Cross-platform CI 36597831993, Service lifecycle 36597831950; main: Cross-platform CI 36597841262, Service lifecycle 36597841450 |

Dispatches (after both gates of a SHA succeed), preview first:

```sh
gh workflow run release.yml -R lidge-jun/opencodex --ref preview -f version=2.72.0-preview.20260930 -f tag=preview -f dry-run=false -f expected-sha=4f9e3f0afbbcf54a2b0421db8e962ec3d5682d5e
gh workflow run release.yml -R lidge-jun/opencodex --ref main -f version=2.72.0 -f tag=latest -f dry-run=false -f expected-sha=5ab6d52b2a4da722d398e4ab50a6c621ac3ce087
```
