# Optimus Garage Company: site prototype

A very basic mobile-first site. No packages to install.

## Run it

1. Install Node.js (version 18 or newer) from nodejs.org if you don't have it.
2. In this folder, run:

       node server.js

3. Open http://localhost:3000

To see it on your real phone, connect the phone to the same Wi-Fi and open
`http://<your computer's IP address>:3000`.

## What's here

- `public/index.html`: the landing page
- `public/styles.css`: colors and the slam button look (change the colors at the top of this file)
- `public/main.js`: the booking sheet, slam effects, and form
- `public/logo.svg`: the logo
- `server.js`: serves the page and receives booking requests

## Booking requests

When someone taps "Book a Time", their details (service, name, phone, address) are
saved to `requests.log` in this folder and printed in the terminal right away, so you
have the lead even if they stop before picking a time. That is the spot to connect
Jobber later (see `server.js`, the `/api/request` block).

## Picking a time (prototype)

Next they see a calendar and four arrival windows. The soonest open day is already
selected, so it takes two taps: a window, then "Lock it in". Their day and window are
saved to `requests.log` too (`/api/schedule`).

Open days, windows, how far ahead people can book, and the notice needed are set in
the `BIZ` block at the top of `public/main.js`. Some windows are marked full on
purpose to simulate busy days. Real availability will come from Jobber.

## Customer updates (prototype)

After locking in a time, the customer picks "Text me" or "Email me" (text is already selected),
then taps "See my updates" to open the tracker screen: status, estimated arrival,
address, and a call button. Their choice is saved to `requests.log` too.

The tracker currently shows made-up times and has a "Prototype only" row to preview
each of the four steps. To open it directly, use `http://localhost:3000/#track`
(or `#track3` to jump to "We're on the way"). Real updates and times come once this
is connected to Jobber.

Until then, you can also paste your Jobber Work Request link into
`JOBBER_REQUEST_URL` at the top of `public/main.js`.

## Putting it online

See `DEPLOY.md` for a step-by-step guide to a private test link you can open on your
phone. To try the password protection on your own computer first:

    SITE_PASSWORD=mypassword node server.js

(On Windows PowerShell: `$env:SITE_PASSWORD="mypassword"; node server.js`)
