
// Nach sefarim (canonical order) + title parser. Shared by the page and the backend.
const SEFARIM = [["yehoshua", "Yehoshua", "יהושע", 24, ["yehoshua", "yehoshuah", "joshua"]], ["shoftim", "Shoftim", "שופטים", 21, ["shoftim", "shofetim", "shoftim", "judges"]], ["shmuel1", "Shmuel I", "שמואל א", 31, ["@shmuel|samuel|shmuel|shemuel#1"]], ["shmuel2", "Shmuel II", "שמואל ב", 24, ["@shmuel|samuel|shemuel#2"]], ["melachim1", "Melachim I", "מלכים א", 22, ["@melachim|kings|melochim#1"]], ["melachim2", "Melachim II", "מלכים ב", 25, ["@melachim|kings|melochim#2"]], ["yeshayahu", "Yeshayahu", "ישעיהו", 66, ["yeshayahu", "yeshaya", "yeshayah", "yeshaiah", "isaiah"]], ["yirmiyahu", "Yirmiyahu", "ירמיהו", 52, ["yirmiyahu", "yirmiyah", "yirmiya", "yirmeyahu", "yirmeyah", "jeremiah"]], ["yechezkel", "Yechezkel", "יחזקאל", 48, ["yechezkel", "yechezkal", "yechezkiel", "ezekiel"]], ["hoshea", "Hoshea", "הושע", 14, ["hoshea", "hosea", "hoshaya"]], ["yoel", "Yoel", "יואל", 4, ["yoel", "joel"]], ["amos", "Amos", "עמוס", 9, ["amos"]], ["ovadiah", "Ovadiah", "עובדיה", 1, ["ovadiah", "ovadia", "ovadyah", "obadiah"]], ["yonah", "Yonah", "יונה", 4, ["yonah", "yona", "jonah"]], ["michah", "Michah", "מיכה", 7, ["michah", "micha", "micah"]], ["nachum", "Nachum", "נחום", 3, ["nachum", "nahum"]], ["chavakuk", "Chavakuk", "חבקוק", 3, ["chavakuk", "chabakuk", "habakkuk"]], ["tzefaniah", "Tzefaniah", "צפניה", 3, ["tzefaniah", "tzefanyah", "tzefanya", "tzephaniah", "zephaniah"]], ["chaggai", "Chaggai", "חגי", 2, ["chaggai", "chagai", "haggai"]], ["zechariah", "Zechariah", "זכריה", 14, ["zechariah", "zecharia", "zecharyah", "zecharya"]], ["malachi", "Malachi", "מלאכי", 3, ["malachi"]], ["tehillim", "Tehillim", "תהלים", 150, ["tehillim", "tehilim", "psalms", "psalm"]], ["mishlei", "Mishlei", "משלי", 31, ["mishlei", "mishley", "proverbs"]], ["iyov", "Iyov", "איוב", 42, ["iyov", "iyyov", "job"]], ["shirhashirim", "Shir Hashirim", "שיר השירים", 8, ["shir hashirim", "shir ha shirim", "shir hashirm", "song of songs"]], ["rus", "Rus", "רות", 4, ["rus", "rut", "ruth"]], ["eichah", "Eichah", "איכה", 5, ["eichah", "eicha", "eycha", "lamentations"]], ["koheles", "Koheles", "קהלת", 12, ["koheles", "kohelet", "koheleth", "ecclesiastes"]], ["esther", "Esther", "אסתר", 10, ["esther", "ester"]], ["daniel", "Daniel", "דניאל", 12, ["daniel"]], ["ezra", "Ezra", "עזרא", 10, ["ezra"]], ["nechemiah", "Nechemiah", "נחמיה", 13, ["nechemiah", "nechemia", "nechemyah", "nehemiah"]], ["dh1", "Divrei Hayamim I", "דברי הימים א", 29, ["@divrei hayamim|divrei hayomim|divrei ha yamim|chronicles#1"]], ["dh2", "Divrei Hayamim II", "דברי הימים ב", 36, ["@divrei hayamim|divrei hayomim|divrei ha yamim|chronicles#2"]]];
const NACH_PART = {'1':1,'i':1,'alef':1,'aleph':1,'a':1,'2':2,'ii':2,'beis':2,'bet':2,'bais':2,'beit':2,'b':2};
const NACH_RX = (() => {
  const out = [], tail = String.raw`\s*[-:,.]?\s*(?:chapter|perek|chap|ch|#)?\.?\s*(\d{1,3})(?![\d:])`;
  for (const s of SEFARIM) {
    for (const a of s[4]) {
      if (a[0] === '@') {
        const [base, part] = a.slice(1).split('#');
        const parts = Object.keys(NACH_PART).filter(k => NACH_PART[k] === +part).join('|');
        out.push([s, new RegExp(String.raw`^(?:${base})\s+(?:${parts})\b` + tail)]);
        out.push([s, new RegExp(String.raw`^(?:${parts})\s+(?:${base})\b` + tail)]);
      } else out.push([s, new RegExp(String.raw`^(?:${a.replace(/ /g, String.raw`\s*`)})\b` + tail)]);
    }
  }
  return out;
})();
function nachNorm(t) {
  return String(t || '').toLowerCase().replace(/[\u2019'`"]/g, '').replace(/[^a-z0-9#:.\- ]/g, ' ').replace(/\s+/g, ' ').trim()
    .replace(/^(?:nach yomi|5 minute nach|five minute nach|navi)\s*[-:|]?\s*/, '');
}
function parseNach(title) {
  const t = nachNorm(title);
  for (const [s, rx] of NACH_RX) {
    const m = rx.exec(t);
    if (m) { const p = +m[1]; if (p >= 1 && p <= s[3]) return { sefer: s[0], perek: p }; }
  }
  return null;
}
function shiurSubtitle(title) {
  const m = /^[^-\u2013\u2014|:]*?\d{1,3}\s*[-\u2013\u2014|:]\s*(.+)$/.exec(String(title || '').trim());
  return m ? m[1].trim() : '';
}
