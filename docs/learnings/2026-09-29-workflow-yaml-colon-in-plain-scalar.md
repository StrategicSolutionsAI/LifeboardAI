# A curl header broke the scheduled-jobs workflow before it ever ran

**Problem** — On the first push to main, `.github/workflows/scheduled-jobs.yml` failed in 0 s with "This run likely failed because of a workflow file issue", and `gh workflow list` showed it by file path instead of its `name:`. Task reminders and calendar-feed refreshes would never have run.

**Approach** — A 0 s failure plus a workflow listed by path means GitHub could not parse the file, so the job logic was irrelevant. The API gave no annotation (`check-runs` for the suite was empty), so parsed it locally with the repo's own YAML library: `node -e 'require("js-yaml").load(fs.readFileSync(f,"utf8"))'` (no PyYAML or actionlint on this machine). It reported "bad indentation of a mapping entry (36:49)" — the `: ` in `-H "Authorization: Bearer …"`.

**Solution** — `run: curl … -H "Authorization: Bearer $CRON_SECRET" …` is a plain scalar, and a colon followed by a space inside a plain scalar starts a new mapping entry; the double quotes around the header don't help because the scalar starts with `curl`. Both steps became block scalars (`run: |`). Commit 680d578.

**Rule** — Never write a one-line `run:` that contains `: ` (HTTP headers, JSON, `key: value` echoes); use `run: |`. Before pushing any workflow change, parse every file in `.github/workflows/` with js-yaml — scheduled-only workflows are otherwise never validated until they reach the default branch.

**Dead ends** — Reading the run log (`gh run view --log-failed` is empty for a file that never parsed) and the check-run annotations API (returned nothing).
