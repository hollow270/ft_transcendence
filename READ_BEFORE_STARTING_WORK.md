# Git Workflow

## First time only

1. Clone the repo.
2. Switch to your personal branch (it's already created):

```bash
   git checkout <42-login>
```

3. You can now start your work.

---

## Daily workflow

### 1. Update your branch with the latest `main`

```bash
git checkout <42-login>
git fetch origin
git merge origin/main
```

### 2. Work and commit progress

1. Add any files that should never be committed to `.gitignore` (such as `.env`).
2. Stage your changes:

```bash
   git add .
```

3. Inspect untracked/modified files:

```bash
   git status
```

4. Commit with a descriptive message:

```bash
   git commit -m "feature: details"
```

### 3. Push to GitHub and open a pull request

1. Sync `main` one last time to make sure there are no new updates:

```bash
   git fetch origin
   git merge origin/main
```

2. Push your personal branch:

```bash
   git push origin <42-login>
```

3. On the **GitHub Repository** page:
   - Click **Compare & pull request**.
   - Set **Base** to `main` and **Compare** to `<42-login>`.
   - Assign at least 1 reviewer (tech leads: aayache / yhajbi).
   - Once approved, do a **Squash and Merge** (or a standard merge) into `main`.

### 4. Post-merge reset for your next task

1. Switch to `main` and pull the newly merged code:

```bash
   git checkout main
   git pull origin main
```

2. Switch back to your branch and merge the updated `main` into it:

```bash
   git checkout <42-login>
   git merge main
```

---

## Mandatory rules

- **`main` is protected.** Nobody pushes directly to it; every addition goes through a pull request.
- **Never commit sensitive files or build dependencies.** Always run `git status` before committing to make sure `.env` and similar files are not staged.
- **Sync daily.** Run `git merge origin/main` on your branch every time you start coding. Leaving it out of sync for days increases the risk of severe merge conflicts.
- **Never force push** (`git push -f`), especially on `main` or any shared branch.
- **Merge conflicts in a PR?** Resolve them in the GitHub editor or on your personal branch, push again, and wait for review.
