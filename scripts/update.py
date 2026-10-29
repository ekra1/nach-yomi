#!/usr/bin/env python3
"""Daily update for the Nach Yomi library.

Finds new Rabbi Yisrael Motzen "5 Minute Nach" shiurim on YouTube, saves each one's
audio as audio/<video id>.m4a (AAC, 48 kbps mono) and adds it to catalog.json.
Runs in GitHub Actions (.github/workflows/update.yml); also runs on any computer
with Python 3, yt-dlp and ffmpeg:   python3 scripts/update.py [--limit N]

Sources: the 5 Minute Nach playlist (yt-dlp, flat listing) and the channel's RSS feed
(only Nach titles are taken from the channel, so Daf Yomi etc. are skipped).
A shiur whose audio cannot be downloaded is still listed (it links to YouTube) and is
retried on the next run.
"""
import json, os, re, subprocess, sys, tempfile, time, urllib.request
import xml.etree.ElementTree as ET

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CATALOG = os.path.join(ROOT, "catalog.json")
AUDIO = os.path.join(ROOT, "audio")
PLAYLIST_ID = "PLSK0XEJA9jdw"
CHANNEL_ID = "UC-BXhEPqRXcCeyiWu8iTYpg"
UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36"

# Nach sefarim: (key, chapters, aliases). Mirrors nach.js (the page parses titles itself).
SEFARIM = [("yehoshua",24,["yehoshua","yehoshuah","joshua"]),("shoftim",21,["shoftim","shofetim","judges"]),
 ("shmuel1",31,["@shmuel|samuel|shemuel#1"]),("shmuel2",24,["@shmuel|samuel|shemuel#2"]),
 ("melachim1",22,["@melachim|kings|melochim#1"]),("melachim2",25,["@melachim|kings|melochim#2"]),
 ("yeshayahu",66,["yeshayahu","yeshaya","yeshayah","yeshaiah","isaiah"]),
 ("yirmiyahu",52,["yirmiyahu","yirmiyah","yirmiya","yirmeyahu","yirmeyah","jeremiah"]),
 ("yechezkel",48,["yechezkel","yechezkal","yechezkiel","ezekiel"]),("hoshea",14,["hoshea","hosea","hoshaya"]),
 ("yoel",4,["yoel","joel"]),("amos",9,["amos"]),("ovadiah",1,["ovadiah","ovadia","ovadyah","obadiah"]),
 ("yonah",4,["yonah","yona","jonah"]),("michah",7,["michah","micha","micah"]),("nachum",3,["nachum","nahum"]),
 ("chavakuk",3,["chavakuk","chabakuk","habakkuk"]),("tzefaniah",3,["tzefaniah","tzefanyah","tzefanya","tzephaniah","zephaniah"]),
 ("chaggai",2,["chaggai","chagai","haggai"]),("zechariah",14,["zechariah","zecharia","zecharyah","zecharya"]),
 ("malachi",3,["malachi"]),("tehillim",150,["tehillim","tehilim","psalms","psalm"]),("mishlei",31,["mishlei","mishley","proverbs"]),
 ("iyov",42,["iyov","iyyov","job"]),("shirhashirim",8,["shir hashirim","shir ha shirim","shir hashirm","song of songs"]),
 ("rus",4,["rus","rut","ruth"]),("eichah",5,["eichah","eicha","eycha","lamentations"]),
 ("koheles",12,["koheles","kohelet","koheleth","ecclesiastes"]),("esther",10,["esther","ester"]),("daniel",12,["daniel"]),
 ("ezra",10,["ezra"]),("nechemiah",13,["nechemiah","nechemia","nechemyah","nehemiah"]),
 ("dh1",29,["@divrei hayamim|divrei hayomim|divrei ha yamim|chronicles#1"]),("dh2",36,["@divrei hayamim|divrei hayomim|divrei ha yamim|chronicles#2"])]
PARTS = {1: "1|i|alef|aleph|a", 2: "2|ii|beis|bet|bais|beit|b"}
TAIL = r"\s*[-:,.]?\s*(?:chapter|perek|chap|ch|#)?\.?\s*(\d{1,3})(?![\d:])"
RX = []
for key, n, aliases in SEFARIM:
    for a in aliases:
        if a.startswith("@"):
            base, part = a[1:].split("#")
            RX.append((key, n, re.compile(r"^(?:%s)\s+(?:%s)\b" % (base, PARTS[int(part)]) + TAIL)))
            RX.append((key, n, re.compile(r"^(?:%s)\s+(?:%s)\b" % (PARTS[int(part)], base) + TAIL)))
        else:
            RX.append((key, n, re.compile(r"^(?:%s)\b" % a.replace(" ", r"\s*") + TAIL)))

def parse_nach(title):
    t = re.sub(r"[\u2019'`\"]", "", (title or "").lower())
    t = re.sub(r"\s+", " ", re.sub(r"[^a-z0-9#:.\- ]", " ", t)).strip()
    t = re.sub(r"^(?:nach yomi|5 minute nach|five minute nach|navi)\s*[-:|]?\s*", "", t)
    for key, n, rx in RX:
        m = rx.match(t)
        if m and 1 <= int(m.group(1)) <= n:
            return {"sefer": key, "perek": int(m.group(1))}
    return None

def log(*a):
    print(time.strftime("%H:%M:%S"), *a, flush=True)

def run(cmd, timeout):
    return subprocess.run(["timeout", "-k", "5", str(timeout)] + cmd, capture_output=True, text=True)

def list_playlist():
    r = run(["yt-dlp", "--flat-playlist", "-J", "--no-warnings", "https://www.youtube.com/playlist?list=" + PLAYLIST_ID], 180)
    if r.returncode != 0:
        raise RuntimeError((r.stderr or r.stdout)[-400:])
    return [{"id": e["id"], "title": (e.get("title") or "").strip()} for e in json.loads(r.stdout).get("entries") or [] if e.get("id")]

def list_feed():
    req = urllib.request.Request("https://www.youtube.com/feeds/videos.xml?channel_id=" + CHANNEL_ID, headers={"user-agent": UA})
    with urllib.request.urlopen(req, timeout=30) as r:
        root = ET.fromstring(r.read())
    ns = {"a": "http://www.w3.org/2005/Atom", "yt": "http://www.youtube.com/xml/schemas/2015"}
    out = []
    for e in root.findall("a:entry", ns):
        out.append({"id": e.findtext("yt:videoId", namespaces=ns), "title": (e.findtext("a:title", namespaces=ns) or "").strip(),
                    "published": e.findtext("a:published", namespaces=ns)})
    return out

def download(vid, workdir):
    """yt-dlp -> AAC 48 kbps mono .m4a. Returns (path, duration_seconds, info)."""
    src = os.path.join(workdir, vid)
    url = "https://www.youtube.com/watch?v=" + vid
    attempts = [
        ["--remote-components", "ejs:github", "-f", "140/bestaudio/18/best"],
        ["--extractor-args", "youtube:player_client=web_embedded", "-f", "140/bestaudio/18/best/worst"],
        ["--extractor-args", "youtube:player_client=tv,mweb", "-f", "140/bestaudio/18/best/worst"],
    ]
    err = ""
    for extra in attempts:
        r = run(["yt-dlp", "-q", "--no-warnings", "--no-playlist", "--write-info-json"] + extra + ["-o", src + ".%(ext)s", url], 300)
        files = [f for f in os.listdir(workdir) if f.startswith(vid + ".") and not f.endswith((".part", ".json"))]
        if files:
            break
        err = (r.stderr or r.stdout)[-400:]
    else:
        raise RuntimeError("download failed: " + err)
    info = {}
    if os.path.exists(src + ".info.json"):
        info = json.load(open(src + ".info.json"))
    out = os.path.join(workdir, vid + ".out.m4a")
    r = run(["ffmpeg", "-nostdin", "-y", "-loglevel", "error", "-i", os.path.join(workdir, files[0]), "-vn", "-ac", "1",
             "-c:a", "aac", "-b:a", "48k", "-movflags", "+faststart", out], 600)
    if r.returncode != 0 or not os.path.exists(out):
        raise RuntimeError("ffmpeg failed: " + r.stderr[-300:])
    p = run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", out], 30)
    return out, float((p.stdout or "0").strip() or 0), info

def main():
    limit = int(sys.argv[sys.argv.index("--limit") + 1]) if "--limit" in sys.argv else 30
    cat = json.load(open(CATALOG, encoding="utf-8"))
    items = {i["id"]: i for i in cat["items"]}
    found, errors = {}, []
    try:
        for v in list_playlist():
            found[v["id"]] = v
    except Exception as e:
        errors.append("playlist: %s" % e)
    try:
        for v in list_feed():
            if v["id"] in found:
                found[v["id"]].setdefault("published", v["published"])
            elif parse_nach(v["title"]):
                found[v["id"]] = v
    except Exception as e:
        errors.append("feed: %s" % e)
    log("listed", len(found), "videos;", "errors:", errors or "none")

    added = 0
    for vid, v in found.items():
        if vid not in items and v.get("title") and v["title"] not in ("[Private video]", "[Deleted video]"):
            p = parse_nach(v["title"]) or {}
            items[vid] = {"id": vid, "title": v["title"], "sefer": p.get("sefer"), "perek": p.get("perek"),
                          "published": v.get("published"), "duration": 0, "audio": False}
            added += 1
            log("new shiur:", v["title"])

    os.makedirs(AUDIO, exist_ok=True)
    todo = [i for i in items.values() if not i.get("audio") or not os.path.exists(os.path.join(AUDIO, i["id"] + ".m4a"))]
    todo.sort(key=lambda i: i.get("published") or "", reverse=True)
    saved, failed = [], []
    with tempfile.TemporaryDirectory() as wd:
        for it in todo[:limit]:
            try:
                path, dur, info = download(it["id"], wd)
                os.replace(path, os.path.join(AUDIO, it["id"] + ".m4a"))
                it["audio"] = True
                it["duration"] = int(round(dur)) or it.get("duration") or 0
                if not it.get("published") and info.get("timestamp"):
                    it["published"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(info["timestamp"]))
                elif not it.get("published") and info.get("upload_date"):
                    d = info["upload_date"]; it["published"] = "%s-%s-%sT12:00:00Z" % (d[:4], d[4:6], d[6:])
                saved.append(it["id"]); log("saved audio:", it["title"], "(%ds)" % dur)
            except Exception as e:
                it["audio"] = os.path.exists(os.path.join(AUDIO, it["id"] + ".m4a"))
                failed.append({"id": it["id"], "title": it["title"], "error": str(e)[-300:]})
                log("FAILED:", it["title"], "-", str(e)[-300:])
            for f in os.listdir(wd):
                if f.startswith(it["id"]): os.remove(os.path.join(wd, f))

    out = sorted(items.values(), key=lambda i: i.get("published") or "", reverse=True)
    cat.update({"updated": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "count": len(out), "items": out})
    if found:
        cat["last_ok"] = int(time.time() * 1000)
    with open(CATALOG, "w", encoding="utf-8") as f:
        json.dump(cat, f, ensure_ascii=False, indent=1); f.write("\n")
    size = sum(os.path.getsize(os.path.join(AUDIO, f)) for f in os.listdir(AUDIO))
    summary = {"listed": len(found), "new_shiurim": added, "audio_saved": len(saved), "failed": failed,
               "list_errors": errors, "audio_files": len(os.listdir(AUDIO)), "audio_mb": round(size / 1e6, 1)}
    print(json.dumps(summary, ensure_ascii=False, indent=1))
    if os.environ.get("GITHUB_STEP_SUMMARY"):
        with open(os.environ["GITHUB_STEP_SUMMARY"], "a") as f:
            f.write("```json\n" + json.dumps(summary, ensure_ascii=False, indent=1) + "\n```\n")
            if size > 800e6:
                f.write("\n**Audio folder is over 800 MB; GitHub Pages sites are limited to 1 GB.**\n")
    # Fail the run (so GitHub emails the repo owner) only when nothing could be listed,
    # or when every download attempted failed.
    if not found or (failed and not saved):
        sys.exit(1)

if __name__ == "__main__":
    main()
