# Nach Yomi · Rabbi Yisrael Motzen

Every shiur from Rabbi Yisrael Motzen's **5 Minute Nach**, by sefer and perek, as audio that plays in your phone's own player (lock screen, speed control, remembers where you stopped).

**Open it:** https://ekra1.github.io/nach-yomi/
(On iPhone: Safari → Share → Add to Home Screen to keep it as an app.)

## How it works

- It is a plain static website: `index.html`, `app.js`, `nach.js`, `styles.css`, icons.
- `catalog.json` lists every shiur (YouTube id, title, date, length, whether audio is saved).
- `audio/<YouTube id>.m4a` is each shiur's audio (AAC, 48 kbps mono, about 2 MB each).
- GitHub Pages publishes the site (`.github/workflows/pages.yml`, on every push to `main`).
- `.github/workflows/update.yml` runs twice a day (and from the Actions tab → "Daily update" → Run workflow). It runs `scripts/update.py`, which checks the 5 Minute Nach playlist and the channel's feed, downloads new shiurim with yt-dlp, converts them with ffmpeg, updates `catalog.json`, commits, and republishes.

If YouTube blocks the download on GitHub's servers, the shiur still appears in the list with a "Watch on YouTube" link. To add the audio yourself from any computer with Python, `yt-dlp` and `ffmpeg`:

```
git clone https://github.com/ekra1/nach-yomi && cd nach-yomi
pip install -U yt-dlp
python3 scripts/update.py
git add -A && git commit -m "Add new shiurim" && git push
```

## Size

GitHub Pages sites can be up to 1 GB. At about 2 MB per shiur, that is roughly 450 shiurim. When `audio/` passes ~800 MB the daily job's summary says so; older sefarim can then move to a GitHub Release.

Shiurim © Rabbi Yisrael Motzen; source: [5 Minute Nach on YouTube](https://www.youtube.com/playlist?list=PLSK0XEJA9jdw).
