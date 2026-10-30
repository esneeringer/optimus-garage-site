# Put the site online (private test link for your phone)

This gets the site onto the real internet behind a password, so only you can open it.
It uses Render's free plan. `render.yaml` in this folder tells Render everything it needs.

## 1. Put the folder on GitHub

Create a new **private** repository on github.com (for example `optimus-garage-site`),
leave it empty, then in this folder run:

    git init
    git add .
    git commit -m "Optimus Garage site prototype"
    git branch -M main
    git remote add origin https://github.com/YOUR-NAME/optimus-garage-site.git
    git push -u origin main

## 2. Create the service on Render

1. Sign in at render.com and choose **New**, then **Blueprint**.
2. Connect your GitHub account and pick the repository.
3. Render reads `render.yaml` and asks for **SITE_PASSWORD**. Type a password you'll
   remember. This is the only thing it asks for.
4. Choose **Apply**. The first build takes a few minutes.

Render gives you a web address ending in `.onrender.com`.

## 3. Open it on your phone

Open the address on your phone. The browser asks for a username and password. Type
anything for the username and your SITE_PASSWORD for the password.

## Things to know

- **First load can be slow.** Free services go to sleep after 15 minutes without
  visits and take about a minute to wake up.
- **Bookings are not kept.** The free plan wipes the disk on every restart or
  redeploy, so `requests.log` disappears. During testing, read bookings in the
  service's **Logs** tab in Render, where each one is printed as it comes in.
- **Use made-up details** when you test. Don't use real customers' names, phones or
  addresses until we've chosen real storage.
- **Updating the site:** change the files, commit, and push to GitHub. Render rebuilds
  from the new version.
- **Forgot the password or want a new one?** Change `SITE_PASSWORD` under the service's
  Environment settings in Render.
- **Search engines:** the site tells them to ignore it, and the password blocks them
  anyway.

## Other hosts

Railway and similar services can run this too. They detect `npm start` on their own;
set `SITE_PASSWORD` as an environment variable and turn on a public domain.
