# Are you a Manhattan Institute Urbanist?

> **Disclaimer:** Daniel Golliher made this site as a fun project in a personal capacity, not in an official capacity as a Manhattan Institute Fellow.

These 50 ideas are compiled from MI scholars and research: the 50 recommendations from a Manhattan Institute issue brief [“A Better Everyday Life in New York: 50 Practical Ideas to Renew NYC’s Promise of Opportunity”](https://manhattan.institute/article/a-better-everyday-life-in-new-york-50-practical-ideas-to-renew-nycs-promise-of-opportunity) (John Ketcham and Sean Speer, Oct. 20, 2026) as a swipe deck.

Each card gives the idea, why it matters, the research behind it (linked), and a link to Manhattan Institute’s full take in the brief. Like, pass, or super-like each idea. The swipe report scores agreement with MI (every card is one of the brief’s recommendations, so a like or super-like counts as agreement), breaks it down by area, and redraws an illustrated New York block with only the ideas you liked built on it.

The report card is drawn on a canvas, so a screenshot matches the saved image. Readers can save it as a post (4:5) or story (9:16), share it natively on phones, copy an emoji summary, or copy a link that reopens their report for friends (all 50 verdicts fit in a 17-character code in the URL hash). Swipes in progress stay in the reader’s browser. A deck finished on the site is sent to an anonymous tally: the 50 verdicts plus a random per-browser id, nothing else.

Card text is condensed from the brief. Companion to the [interactive edition](https://danielgolliher.github.io/better-everyday-life/). Single self-contained `index.html` plus icon files (`favicon.svg` is the master: a card swiped right, with a New York skyline and a “like” badge); no build step.

## Results tally

`tally/` is a Cloudflare Worker (`swiperight-tally.danielgolliher.workers.dev`) with a D1 database. It accepts only complete decks from swiperight.nyc (and localhost, flagged as test), keeps one row per browser (a retake replaces it), and never stores IPs.

- `GET /stats`: aggregate JSON for a future visualization (respondents, average agreement, a 10-point histogram, tier counts, agreement by area, and like/super/pass counts for each of the 50 ideas). Cached for 60 seconds.
- Deploy: `cd tally && wrangler deploy`. Schema: `wrangler d1 execute swiperight-tally --remote --file=schema.sql`.
- Raw rows: `wrangler d1 execute swiperight-tally --remote --command "SELECT * FROM results WHERE is_test = 0"`.
- Set `localStorage['sr-test'] = '1'` in a browser to mark its submissions as test rows.

Page views are counted with Google Analytics (G-N8GYXGJNET).

