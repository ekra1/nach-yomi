import re
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

