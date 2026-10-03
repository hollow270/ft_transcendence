# first time only

### clone the repo

### switch to your branch (it's already created)
`git checkout <your-42-login>`

### you can now start your work



# daily workflow cycle

## update your branch with the latest main
### switch to you personal branch
`git checkout <42-login>`

### fetch latest changes from github
`git fetch origin`

### merge the latest main into your personal branch
`git merge origin/main`

## work and commit progress
### add any files that should never be commited to .gitignore (such as .env)

### stage them
`git add .`

### inspect untracker/modified files
`git status`

### commit with a descriptive message
`git commit -m "feature: details"`

## push to github and open a pull request
### sync main one last time to make sure there are no new updates before pushing
`git fetch origin`
`git merge origin/main`

### push your personal branch to github
`git push origin <42-login>`

* Go to the **GitHub Repository** page in your browser.
* Click **"Compare &amp; pull request"**.
* Set the **Base branch** to `main` and the **Compare branch** to `42-login`.
* Assign at least 1 reviewer (tech leads, aayache/yhajbi).
* Once approved, perform a "Squash and Merge" (or standard merge) into `main`.

## post-merge reset for your next task
### switch to main and pull the newly merged code
`git checkout main`
`git pull origin main`

### switch back to your personal branch and merge updated main into it
`git checkout <42-login>`
`git merge main`



# mandatory rules of operations
* `main` is strictly *protected* - nobody pushes directly to it. every new addition should pass through the pull request system.
* never commit sensitive files or build dependencies - always check git status before commiting to ensure `.env, ...` are not staged.
* sync daily - run `git merge origin/main` on your personal branch every time you start coding. leaving your branch out of sync for days increases the risk of severe merge conflicts.
* never force push (`git push -f`) - especially on main or any shared branches (probably won't be any shared branch).
* if the pull request has merge conflicts, resolve them either on the github code editor or on your personal branch, push again and wait for review.
