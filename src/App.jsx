// ─────────────────────────────────────────────────────────────────────────
// PINGS — ported from the Claude Artifact into a standalone Vite project.
//
// Three things in this file call https://api.anthropic.com directly
// (headline rewriting, category classification, GK quiz generation) and one
// fetches RSS through a public CORS proxy. Both worked automatically inside
// the Claude Artifacts sandbox, but will NOT work once this is deployed on
// its own — there's no API key attached client-side, and calling Anthropic
// directly from the browser isn't a safe pattern anyway (it would expose
// your key). The /pings-backend project already has equivalent server-side
// logic (src/services/claude.js, src/services/rss.js) for exactly this.
// Once that backend is deployed, replace those fetch() calls with calls to
// your backend's /news, /vocabulary, /gk, /exam/quiz endpoints instead.
// Search this file for "api.anthropic.com" and "allorigins.win" to find them.
// ─────────────────────────────────────────────────────────────────────────

import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Sun, BookOpen, ListChecks, Clock3, ChevronRight, ChevronLeft, ChevronDown, Grid3x3, Home, User, Newspaper, Trophy, TrendingUp, ListOrdered, Video, Lightbulb, Briefcase, Flag, Landmark, Globe, Clapperboard, MoreVertical, Check, Phone, Search, X, Wallet, Coffee, Cpu, FlaskConical, Plane, GraduationCap, PenLine, Image as ImageIcon, Info, MoreHorizontal, Share2, Bookmark, Award, Flame, Star, Play, Tv, Languages, Lock, Compass, Mail, Link2, Send, MessageCircle, Folder as FolderIcon, Plus, Settings, History as HistoryIcon, Trash2, LogOut, ClipboardCheck, RotateCcw, FileText as FileTextIcon, Shield as ShieldIcon, Bell, SlidersHorizontal, Triangle, Moon, MousePointerClick, Navigation } from "lucide-react";

// ---- Sources: real Bangladeshi newspaper RSS feeds, tagged by language ----
const SOURCES = [
  { id: "dailystar", name: "The Daily Star", url: "https://www.thedailystar.net/frontpage/rss.xml", lang: "en" },
  { id: "newage", name: "New Age", url: "https://www.newagebd.net/rss.xml", lang: "en" },
  { id: "dhakatribune", name: "Dhaka Tribune", url: "https://www.dhakatribune.com/feed", lang: "en" },
  { id: "prothomalo", name: "Prothom Alo", url: "https://www.prothomalo.com/feed/", lang: "bn" },
  { id: "jugantor", name: "Jugantor", url: "https://www.jugantor.com/rss.xml", lang: "bn" },
  { id: "kalerkantho", name: "Kaler Kantho", url: "https://www.kalerkantho.com/rss.xml", lang: "bn" },
  { id: "banglanews24", name: "Banglanews24", url: "https://www.banglanews24.com/rss/rss.xml", lang: "bn" },
  { id: "jagonews24", name: "Jago News 24", url: "https://www.jagonews24.com/rss/rss.xml", lang: "bn" },
];

const PROXY = "https://api.allorigins.win/raw?url=";

const TOPIC_CATEGORIES = [
  { id: "all", icon: Grid3x3, en: "All", bn: "সব" },
  { id: "national", icon: Flag, en: "National", bn: "জাতীয়" },
  { id: "politics", icon: Landmark, en: "Politics", bn: "রাজনীতি" },
  { id: "business", icon: TrendingUp, en: "Business & Finance", bn: "ব্যবসা ও অর্থ" },
  { id: "sports", icon: Trophy, en: "Sports", bn: "খেলা" },
  { id: "entertainment", icon: Clapperboard, en: "Entertainment", bn: "বিনোদন" },
  { id: "lifestyle", icon: Coffee, en: "Lifestyle", bn: "লাইফস্টাইল" },
  { id: "technology", icon: Cpu, en: "Technology", bn: "প্রযুক্তি" },
  { id: "science", icon: FlaskConical, en: "Science", bn: "বিজ্ঞান" },
  { id: "travel", icon: Plane, en: "Travel", bn: "ভ্রমণ" },
  { id: "education", icon: GraduationCap, en: "Education", bn: "শিক্ষা" },
  { id: "job", icon: Briefcase, en: "Job", bn: "চাকরি" },
  { id: "editorial", icon: PenLine, en: "Editorial", bn: "সম্পাদকীয়" },
  { id: "world", icon: Globe, en: "World", bn: "আন্তর্জাতিক" },
];

const CATEGORIES = {
  bn: TOPIC_CATEGORIES.map((c) => c.bn),
  en: TOPIC_CATEGORIES.map((c) => c.en),
};

const TABS = [
  { id: "myfeed", icon: Newspaper, en: "My Feed", bn: "আমার ফিড" },
  { id: "fifa", icon: Trophy, en: "FIFA World Cup", bn: "ফিফা বিশ্বকাপ" },
  { id: "ritual", icon: Clock3, en: "Daily Ritual", bn: "দৈনিক রিচুয়াল" },
  { id: "trending", icon: TrendingUp, en: "Trending", bn: "ট্রেন্ডিং" },
  { id: "timelines", icon: ListOrdered, en: "Timelines", bn: "টাইমলাইন" },
  { id: "videos", icon: Video, en: "Videos", bn: "ভিডিও" },
  { id: "insight", icon: Lightbulb, en: "Insight", bn: "ইনসাইট" },
  { id: "vocabulary", icon: Languages, en: "Vocabulary", bn: "শব্দভাণ্ডার" },
  { id: "gk", icon: Compass, en: "General Knowledge", bn: "সাধারণ জ্ঞান" },
  { id: "jobnews", icon: Briefcase, en: "Job News", bn: "চাকরির খবর" },
];

const GRADIENTS = [
  "linear-gradient(160deg,#0B3D2E,#04673F 55%,#0F1B14)",
  "linear-gradient(160deg,#3B0F17,#7A1B2C 55%,#1A0507)",
  "linear-gradient(160deg,#2C2007,#7A5C1E 55%,#140F02)",
  "linear-gradient(160deg,#0E2A3B,#1C5C7A 55%,#04121A)",
  "linear-gradient(160deg,#2B0F3B,#5C1E7A 55%,#12041A)",
];

const FALLBACK = {
  bn: [
    {
      id: "f1",
      source: "Prothom Alo",
      headline: "বাজেট অধিবেশন শুরু, নতুন কর কাঠামো নিয়ে আলোচনা",
      summary:
        "জাতীয় সংসদে বাজেট অধিবেশন শুরু হয়েছে। অর্থমন্ত্রী নতুন কর কাঠামো ও রাজস্ব আদায়ের লক্ষ্যমাত্রা নিয়ে বিস্তারিত তুলে ধরেন। ব্যবসায়ী মহল থেকে মিশ্র প্রতিক্রিয়া এসেছে। আগামী সপ্তাহে এ নিয়ে আরও আলোচনা হবে বলে জানা গেছে।",
      time: "2h ago",
      link: "#",
      image: null,
      category: "business",
    },
    {
      id: "f3",
      source: "Kaler Kantho",
      headline: "ঢাকায় নতুন মেট্রোরেল স্টেশন উদ্বোধন",
      summary:
        "রাজধানীতে মেট্রোরেলের নতুন একটি স্টেশন উদ্বোধন করা হয়েছে। এতে যাত্রীদের যাতায়াত সহজ হবে বলে জানিয়েছেন কর্তৃপক্ষ। প্রথম দিনেই বহু যাত্রী নতুন স্টেশন ব্যবহার করেছেন।",
      time: "5h ago",
      link: "#",
      image: null,
      category: "national",
    },
  ],
  en: [
    {
      id: "f2",
      source: "The Daily Star",
      headline: "Export earnings rise 8% in first half of fiscal year",
      summary:
        "Bangladesh's export earnings grew 8% year-on-year in the first half of the fiscal year, driven largely by the readymade garment sector. Officials credited diversification into new markets and improved compliance standards for the growth, though rising input costs remain a concern for manufacturers.",
      time: "3h ago",
      link: "#",
      image: null,
      category: "business",
    },
    {
      id: "f4",
      source: "Dhaka Tribune",
      headline: "New metro rail station opens in the capital",
      summary:
        "A new metro rail station opened in Dhaka on Thursday, aimed at easing commuter travel across the city. Authorities said thousands of passengers used the new station on its first day, and further extensions are planned for later this year.",
      time: "5h ago",
      link: "#",
      image: null,
      category: "national",
    },
  ],
};

const UI = {
  bn: {
    fetching: "সংবাদ আনা হচ্ছে... fetching news…",
    doubleTapHint: "সম্পূর্ণ খবর পড়তে ডাবল ট্যাপ করুন",
    swipeHint: "পরবর্তী খবরের জন্য উপরে সোয়াইপ করুন",
    onboardTitle: "Pings",
    onboardTag: "Get pinged. In sixty words.",
    onboardQ: "আপনি কোন ভাষায় খবর পড়তে চান?",
    optEn: "English",
    optBn: "বাংলা",
    changeLang: "ভাষা",
    comingSoon: "শীঘ্রই আসছে",
    comingSoonSub: "এই সেকশনটি ব্যাকএন্ড তৈরি হলে চালু হবে।",
  },
  en: {
    fetching: "Fetching news…",
    doubleTapHint: "Double tap to read the full story",
    swipeHint: "SWIPE UP FOR NEXT STORY",
    onboardTitle: "Pings",
    onboardTag: "Get pinged. In sixty words.",
    onboardQ: "Which language would you like your news in?",
    optEn: "English",
    optBn: "বাংলা",
    changeLang: "Lang",
    comingSoon: "Coming soon",
    comingSoonSub: "This section goes live once the backend is built.",
  },
};

function wordTruncate(text, n) {
  const words = text.trim().split(/\s+/);
  if (words.length <= n) return text.trim();
  return words.slice(0, n).join(" ") + "…";
}

function stripHtml(html) {
  const tmp = document.createElement("div");
  tmp.innerHTML = html || "";
  return tmp.textContent || tmp.innerText || "";
}

function timeAgo(dateStr) {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "";
  const diffMin = Math.floor((Date.now() - d.getTime()) / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;
  return `${Math.floor(diffH / 24)}d ago`;
}

function extractImage(item) {
  const media = item.querySelector("thumbnail, [nodeName='media:thumbnail']");
  if (media?.getAttribute("url")) return media.getAttribute("url");
  const mediaContent = item.querySelector("content, [nodeName='media:content']");
  if (mediaContent?.getAttribute("url")) return mediaContent.getAttribute("url");
  const enclosure = item.querySelector("enclosure");
  if (enclosure?.getAttribute("url") && (enclosure.getAttribute("type") || "").includes("image")) {
    return enclosure.getAttribute("url");
  }
  const desc = item.querySelector("description")?.textContent || "";
  const match = desc.match(/<img[^>]+src=["']([^"']+)["']/i);
  return match ? match[1] : null;
}

async function fetchFeed(source) {
  const res = await fetch(PROXY + encodeURIComponent(source.url));
  if (!res.ok) throw new Error("bad status");
  const text = await res.text();
  const xml = new DOMParser().parseFromString(text, "text/xml");
  const items = Array.from(xml.querySelectorAll("item")).slice(0, 8);
  return items.map((item, i) => {
    const title = item.querySelector("title")?.textContent?.trim() || "";
    const descRaw = item.querySelector("description")?.textContent || "";
    const link = item.querySelector("link")?.textContent?.trim() || "#";
    const pubDate = item.querySelector("pubDate")?.textContent || "";
    const clean = stripHtml(descRaw);
    return {
      id: `${source.id}-${i}`,
      source: source.name,
      headline: title,
      summary: wordTruncate(clean || title, 60),
      time: timeAgo(pubDate),
      rawDate: pubDate ? new Date(pubDate) : null,
      link,
      image: extractImage(item),
    };
  });
}

async function rewriteHeadlineChunk(headlines, lang) {
  if (headlines.length === 0) return headlines;
  const langName = lang === "bn" ? "Bengali" : "English";
  const prompt =
    `You will get a JSON array of ${headlines.length} news headlines in ${langName}. ` +
    `Rewrite each one in different wording and sentence structure than the original — a fresh, editorially clean phrasing — ` +
    `while keeping the exact same facts, names, numbers, and meaning. Do not change what happened, do not add opinion or ` +
    `speculation, do not sensationalize, and do not make it sound contradictory or controversial compared to the source. ` +
    `Keep each rewritten headline roughly the same length as the original and in ${langName}. ` +
    `Respond with ONLY a JSON array of ${headlines.length} strings, same order, no other text, no markdown fences.\n\n` +
    JSON.stringify(headlines);
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1000,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    const data = await res.json();
    const raw = (data.content || []).map((c) => c.text || "").join("");
    const clean = raw.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean);
    if (Array.isArray(parsed) && parsed.length === headlines.length && parsed.every((h) => typeof h === "string" && h.trim())) {
      return parsed;
    }
    return headlines;
  } catch {
    return headlines; // fall back to original headlines if the rewrite call fails
  }
}

async function rewriteHeadlines(headlines, lang) {
  const chunkSize = 8;
  const chunks = [];
  for (let i = 0; i < headlines.length; i += chunkSize) chunks.push(headlines.slice(i, i + chunkSize));
  const results = await Promise.all(chunks.map((c) => rewriteHeadlineChunk(c, lang)));
  return results.flat();
}

const CATEGORY_IDS = TOPIC_CATEGORIES.filter((c) => c.id !== "all").map((c) => c.id);

async function classifyCategoryChunk(stories) {
  if (stories.length === 0) return [];
  const prompt =
    `Classify each of these ${stories.length} news items into exactly ONE category from this fixed list of ids: ` +
    `${JSON.stringify(CATEGORY_IDS)}. Each item is given as "headline — summary". Pick the single best-fitting ` +
    `category id for each item based on its actual subject matter. ` +
    `Respond with ONLY a JSON array of ${stories.length} strings, each one exactly matching one of the ids in the ` +
    `list above, same order as the items, no other text, no markdown fences.\n\n` +
    JSON.stringify(stories.map((s) => `${s.headline} — ${s.summary}`));
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1000,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    const data = await res.json();
    const raw = (data.content || []).map((c) => c.text || "").join("");
    const clean = raw.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean);
    if (Array.isArray(parsed) && parsed.length === stories.length) {
      return parsed.map((id) => (CATEGORY_IDS.includes(id) ? id : "national"));
    }
    return stories.map(() => "national");
  } catch {
    return stories.map(() => "national"); // safe fallback category if classification fails
  }
}

async function classifyCategories(stories) {
  const chunkSize = 8;
  const chunks = [];
  for (let i = 0; i < stories.length; i += chunkSize) chunks.push(stories.slice(i, i + chunkSize));
  const results = await Promise.all(chunks.map((c) => classifyCategoryChunk(c)));
  return results.flat();
}

const RITUAL_REASONS = [
  { id: "inform", icon: Sun, iconBg: "#FFE1A8", en: "To stay informed daily", bn: "প্রতিদিন খবর জানার জন্য" },
  { id: "habit", icon: BookOpen, iconBg: "#DDEBFF", en: "To build a reading habit", bn: "পড়ার অভ্যাস গড়ার জন্য" },
  { id: "simplify", icon: ListChecks, iconBg: "#D6F0E6", en: "To simplify news", bn: "খবর সহজভাবে জানার জন্য" },
  { id: "savetime", icon: Clock3, iconBg: "#2B2B2E", iconColor: "#fff", en: "To save time by reading important updates at one place", bn: "এক জায়গায় গুরুত্বপূর্ণ খবর পড়ে সময় বাঁচানোর জন্য" },
];

const AGE_OPTIONS = [
  { id: "u18", en: "Under 18", bn: "১৮ এর নিচে" },
  { id: "18-24", en: "18–24", bn: "১৮–২৪" },
  { id: "25-34", en: "25–34", bn: "২৫–৩৪" },
  { id: "35-44", en: "35–44", bn: "৩৫–৪৪" },
  { id: "45p", en: "45+", bn: "৪৫+" },
];

const GENDER_OPTIONS = [
  { id: "male", en: "Male", bn: "পুরুষ" },
  { id: "female", en: "Female", bn: "মহিলা" },
  { id: "other", en: "Other", bn: "অন্যান্য" },
  { id: "na", en: "Prefer not to say", bn: "বলতে চাই না" },
];

const BADGE_TIERS = [
  { id: "rookie", threshold: 1, en: "Ritual Rookie", bn: "রিচুয়াল রুকি", colors: ["#8a8078", "#5b554c"] },
  { id: "week", threshold: 7, en: "Week Warrior", bn: "সপ্তাহ যোদ্ধা", colors: ["#C0C0C0", "#8a8078"] },
  { id: "fortnight", threshold: 14, en: "Fortnight Flame", bn: "পাক্ষিক শিখা", colors: ["#E8A33D", "#C8102E"] },
  { id: "month", threshold: 30, en: "Monthly Master", bn: "মাসিক মাস্টার", colors: ["#7DE0C4", "#2F6FED"] },
];

function badgesForStreak(streak) {
  return BADGE_TIERS.filter((b) => streak >= b.threshold).map((b) => b.id);
}

function getBadgeTier(id) {
  return BADGE_TIERS.find((b) => b.id === id) || BADGE_TIERS[0];
}

function DailyRitualOnboarding({ lang, onComplete }) {
  const [step, setStep] = useState(0);
  const [age, setAge] = useState(null);
  const [gender, setGender] = useState(null);
  const [newsPrefs, setNewsPrefs] = useState([]);
  const [newsOther, setNewsOther] = useState("");
  const [showOtherInput, setShowOtherInput] = useState(false);
  const [reason, setReason] = useState("savetime");
  const [finished, setFinished] = useState(false);

  const T = {
    en: {
      heading: "A few questions to help us shape your daily ritual experience",
      stepOf: (n) => `Step ${n} of 4`,
      qAge: "What's your age range?",
      qGender: "What's your gender?",
      qNews: "What kind of news do you prefer?",
      qReason: "Why do you want to start daily ritual?",
      others: "Others",
      othersPlaceholder: "Tell us what else you'd like to see…",
      next: "Next",
      back: "Back",
      finish: "Start My Ritual",
      doneTitle: "7-Day Streak Started!",
      doneSub: "Come back daily to keep it going and unlock more badges.",
      badgeNote: "This badge now shows next to your profile picture.",
      goFeed: "Go to My Feed",
    },
    bn: {
      heading: "আপনার দৈনিক রিচুয়াল অভিজ্ঞতা সাজাতে কয়েকটি প্রশ্ন",
      stepOf: (n) => `ধাপ ${n} / ৪`,
      qAge: "আপনার বয়সসীমা কত?",
      qGender: "আপনার লিঙ্গ কী?",
      qNews: "আপনি কেমন খবর পছন্দ করেন?",
      qReason: "কেন আপনি দৈনিক রিচুয়াল শুরু করতে চান?",
      others: "অন্যান্য",
      othersPlaceholder: "আর কী দেখতে চান লিখুন…",
      next: "পরবর্তী",
      back: "পেছনে",
      finish: "রিচুয়াল শুরু করুন",
      doneTitle: "৭ দিনের স্ট্রিক শুরু হয়েছে!",
      doneSub: "স্ট্রিক ধরে রাখতে ও আরও ব্যাজ পেতে প্রতিদিন ফিরে আসুন।",
      badgeNote: "এই ব্যাজ এখন আপনার প্রোফাইল ছবির পাশে দেখাবে।",
      goFeed: "আমার ফিডে যান",
    },
  };
  const s = T[lang === "bn" ? "bn" : "en"];

  const toggleNewsPref = (id) => {
    setNewsPrefs((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const canProceed =
    (step === 0 && reason) ||
    (step === 1 && age) ||
    (step === 2 && gender) ||
    (step === 3 && (newsPrefs.length > 0 || newsOther.trim()));

  const handleNext = () => {
    if (step < 3) {
      setStep((st) => st + 1);
    } else {
      setFinished(true);
      onComplete?.({ age, gender, newsPrefs, newsOther, reason });
    }
  };
  const handleBack = () => setStep((st) => Math.max(0, st - 1));

  if (finished) {
    return (
      <div className="ritual-screen ritual-done-screen">
        <div className="ritual-badge-circle">
          <Award size={34} strokeWidth={1.8} color="#fff" />
        </div>
        <span className="ritual-badge-name">{lang === "bn" ? BADGE_TIERS[0].bn : BADGE_TIERS[0].en}</span>
        <h2 className="ritual-done-title">
          <Flame size={20} strokeWidth={2} color="var(--gold)" /> {s.doneTitle}
        </h2>
        <p className="ritual-done-sub">{s.doneSub}</p>
        <div className="ritual-streak-track">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className={`streak-dot ${i === 0 ? "filled" : ""}`}>{i + 1}</div>
          ))}
        </div>
        <p className="ritual-badge-note">{s.badgeNote}</p>
      </div>
    );
  }

  return (
    <div className="ritual-screen">
      <div className="ritual-card">
        <p className="ritual-eyebrow">{s.heading}</p>
        <span className="ritual-step-label">{s.stepOf(step + 1)}</span>

        {step === 0 && (
          <>
            <h2 className="ritual-question">{s.qReason}</h2>
            <div className="ritual-options">
              {RITUAL_REASONS.map((r) => {
                const Icon = r.icon;
                const isActive = reason === r.id;
                return (
                  <button
                    key={r.id}
                    className={`ritual-opt ${isActive ? "active" : ""}`}
                    onClick={() => setReason(r.id)}
                  >
                    <span className="ritual-icon-box" style={{ background: r.iconBg }}>
                      <Icon size={26} color={r.iconColor || "#2B2B2E"} strokeWidth={2} />
                    </span>
                    <span className="ritual-opt-label">{lang === "bn" ? r.bn : r.en}</span>
                  </button>
                );
              })}
            </div>
          </>
        )}

        {step === 1 && (
          <>
            <h2 className="ritual-question">{s.qAge}</h2>
            <div className="ritual-simple-list">
              {AGE_OPTIONS.map((o) => (
                <button
                  key={o.id}
                  className={`ritual-simple-opt ${age === o.id ? "active" : ""}`}
                  onClick={() => setAge(o.id)}
                >
                  {lang === "bn" ? o.bn : o.en}
                </button>
              ))}
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <h2 className="ritual-question">{s.qGender}</h2>
            <div className="ritual-simple-list">
              {GENDER_OPTIONS.map((o) => (
                <button
                  key={o.id}
                  className={`ritual-simple-opt ${gender === o.id ? "active" : ""}`}
                  onClick={() => setGender(o.id)}
                >
                  {lang === "bn" ? o.bn : o.en}
                </button>
              ))}
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <h2 className="ritual-question">{s.qNews}</h2>
            <div className="ritual-chip-grid">
              {TOPIC_CATEGORIES.filter((c) => c.id !== "all").map((c) => {
                const label = lang === "bn" ? c.bn : c.en;
                const active = newsPrefs.includes(c.id);
                return (
                  <button
                    key={c.id}
                    className={`ritual-chip ${active ? "active" : ""}`}
                    onClick={() => toggleNewsPref(c.id)}
                  >
                    {label}
                  </button>
                );
              })}
              <button
                className={`ritual-chip ${showOtherInput ? "active" : ""}`}
                onClick={() => setShowOtherInput((v) => !v)}
              >
                {s.others}
              </button>
            </div>
            {showOtherInput && (
              <input
                className="ritual-other-input"
                type="text"
                placeholder={s.othersPlaceholder}
                value={newsOther}
                onChange={(e) => setNewsOther(e.target.value)}
              />
            )}
          </>
        )}
      </div>

      <div className="ritual-nav-row">
        {step > 0 && (
          <button className="ritual-back" onClick={handleBack}>
            <ChevronLeft size={16} /> {s.back}
          </button>
        )}
        <button className="ritual-next" disabled={!canProceed} onClick={handleNext}>
          {step === 3 ? s.finish : s.next} <ChevronRight size={18} />
        </button>
      </div>
    </div>
  );
}

function DailyRitualFeed({ lang, ritualProfile, items, onMarkComplete, onPickDisplayBadge, savedNews, onToggleSaveNews }) {
  const T = {
    en: {
      streakDay: (n) => `Day ${n}`,
      markDone: "Mark Today's Ritual Complete",
      yourBadges: "Your Badges",
      feedTitle: "Picked for you",
      feedSub: "Based on the topics you chose when you started your ritual.",
      noMatch: "No stories match your chosen topics right now — showing everything instead.",
      nextBadge: (name, n) => `Next: ${name} at Day ${n}`,
    },
    bn: {
      streakDay: (n) => `দিন ${n}`,
      markDone: "আজকের রিচুয়াল সম্পন্ন করুন",
      yourBadges: "আপনার ব্যাজসমূহ",
      feedTitle: "আপনার জন্য নির্বাচিত",
      feedSub: "রিচুয়াল শুরু করার সময় আপনি যে বিষয়গুলো বেছে নিয়েছিলেন তার ভিত্তিতে।",
      noMatch: "আপনার পছন্দের বিষয়ে এখন কোনো খবর মিলছে না — তাই সব খবর দেখানো হচ্ছে।",
      nextBadge: (name, n) => `পরবর্তী: ${name}, দিন ${n}-এ`,
    },
  };
  const s = T[lang === "bn" ? "bn" : "en"];

  const streak = ritualProfile.streak || 1;
  const earnedBadges = ritualProfile.badges || ["rookie"];
  const displayBadge = getBadgeTier(ritualProfile.displayBadge || earnedBadges[earnedBadges.length - 1]);
  const nextTier = BADGE_TIERS.find((b) => !earnedBadges.includes(b.id));

  const prefs = ritualProfile.newsPrefs || [];
  const filtered = prefs.length > 0 ? items.filter((it) => prefs.includes(it.category)) : items;
  const feedItems = filtered.length > 0 ? filtered : items;

  return (
    <div className="ritual-feed-screen">
      <div className="ritual-feed-header">
        <div className="ritual-streak-badge">
          <span className="ritual-streak-flame"><Flame size={16} strokeWidth={2} color="var(--gold)" /></span>
          <span className="ritual-streak-day">{s.streakDay(streak)}</span>
        </div>
        <button className="ritual-mark-btn" onClick={onMarkComplete}>{s.markDone}</button>
      </div>

      <span className="vocab-section-label">{s.yourBadges}</span>
      <div className="ritual-badge-row">
        {BADGE_TIERS.map((tier) => {
          const earned = earnedBadges.includes(tier.id);
          const isDisplayed = displayBadge.id === tier.id;
          return (
            <button
              key={tier.id}
              className={`ritual-badge-chip ${earned ? "earned" : "locked"} ${isDisplayed ? "displayed" : ""}`}
              onClick={() => earned && onPickDisplayBadge(tier.id)}
              disabled={!earned}
              style={earned ? { background: `linear-gradient(160deg, ${tier.colors[0]}, ${tier.colors[1]})` } : {}}
            >
              {earned ? <Award size={16} strokeWidth={2} color="#fff" /> : <Lock size={14} strokeWidth={2} />}
              <span className="ritual-badge-chip-label">{lang === "bn" ? tier.bn : tier.en}</span>
            </button>
          );
        })}
      </div>
      {nextTier && (
        <p className="ritual-next-badge-note">{s.nextBadge(lang === "bn" ? nextTier.bn : nextTier.en, nextTier.threshold)}</p>
      )}

      <span className="vocab-section-label">{s.feedTitle}</span>
      <p className="timeline-sub">{s.feedSub}</p>
      {prefs.length > 0 && filtered.length === 0 && <p className="list-sample-note">{s.noMatch}</p>}

      <div className="list-items ritual-feed-list">
        {feedItems.map((it) => (
          <div key={it.id} className="list-row profile-saved-row">
            <a href={it.link} target="_blank" rel="noopener noreferrer" className="list-row-link">
              <span className="list-thumb">
                {it.image ? <img src={it.image} alt="" className="list-thumb-img" /> : <ImageIcon size={18} strokeWidth={1.6} color="var(--gold)" />}
              </span>
              <span className="list-row-text">
                <span className="list-headline">{it.headline}</span>
                <span className="list-time">{it.time}</span>
              </span>
            </a>
            <button
              className={`profile-remove-btn ${savedNews?.[it.id] ? "saved" : ""}`}
              onClick={() => onToggleSaveNews(it)}
              aria-label="Save"
            >
              <Bookmark size={15} strokeWidth={2} fill={savedNews?.[it.id] ? "currentColor" : "none"} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function CategoryNewsPopup({ category, lang, items, onNotifTap, onViewFeed, onClose }) {
  const T = {
    en: { viewFeed: "View filtered Feed", empty: "No live stories in this category yet.", tapHint: "Tap for the feed · double-tap for the source" },
    bn: { viewFeed: "ফিল্টার করা ফিডে যান", empty: "এই বিভাগে এখনো কোনো লাইভ খবর নেই।", tapHint: "ফিডের জন্য ট্যাপ করুন · উৎসের জন্য ডাবল-ট্যাপ করুন" },
  };
  const s = T[lang === "bn" ? "bn" : "en"];
  const Icon = category.icon;
  const label = lang === "bn" ? category.bn : category.en;
  const catItems = rankTrending((items || []).filter((it) => it.category === category.id), 30);

  return (
    <div className="share-overlay" onClick={onClose}>
      <div className="share-sheet cat-popup-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="share-sheet-handle" />
        <div className="cat-popup-header">
          <span className="cat-popup-title"><Icon size={17} strokeWidth={2} /> {label}</span>
          <span className="cat-popup-count">{catItems.length}</span>
        </div>
        <p className="cat-notif-hint">{s.tapHint}</p>

        {catItems.length === 0 ? (
          <p className="profile-empty-note">{s.empty}</p>
        ) : (
          <div className="cat-notif-list cat-popup-list">
            {catItems.map((it) => (
              <button key={it.id} className="cat-notif-row" onClick={() => onNotifTap(it, label)}>
                <span className="cat-notif-icon">
                  {it.image ? (
                    <img src={it.image} alt="" className="cat-notif-icon-img" />
                  ) : (
                    <Bell size={14} strokeWidth={2} color="var(--gold)" />
                  )}
                </span>
                <span className="cat-notif-text">
                  <span className="cat-notif-headline">{it.headline}</span>
                  <span className="list-time">{it.time}</span>
                </span>
              </button>
            ))}
          </div>
        )}

        <button className="quiz-next-btn cat-popup-feed-btn" onClick={onViewFeed}>
          {s.viewFeed}
        </button>
        <button className="share-cancel-btn" onClick={onClose}>Close</button>
      </div>
    </div>
  );
}

function CategoriesMenu({ lang, activeCategory, onSelect, onGoToPreferences, items, onViewAllTrending, newsPreferences, onNotifTap, onGoToTab }) {
  const [openCategory, setOpenCategory] = useState(null);
  const T = {
    en: {
      categories: "Categories", yourPrefs: "Your Preferences", yourPrefsSub: "Tap to open and set your preferences in Settings.",
      notifications: "Notifications", viewAll: "View All", empty: "No live stories loaded yet.", tapHint: "Tap for the feed · double-tap for the source",
      trending: "Trending", timelines: "Timelines", vocabulary: "Vocabulary", gk: "General Knowledge", jobs: "Job News", insight: "Insight", videos: "Videos",
      insightEmpty: "Insight is coming soon.",
    },
    bn: {
      categories: "বিভাগ", yourPrefs: "আপনার পছন্দ", yourPrefsSub: "সেটিংসে আপনার পছন্দ খুলতে ও সেট করতে ট্যাপ করুন।",
      notifications: "নোটিফিকেশন", viewAll: "সব দেখুন", empty: "এখনো কোনো লাইভ খবর লোড হয়নি।", tapHint: "ফিডের জন্য ট্যাপ করুন · উৎসের জন্য ডাবল-ট্যাপ করুন",
      trending: "ট্রেন্ডিং", timelines: "টাইমলাইনস", vocabulary: "শব্দভাণ্ডার", gk: "সাধারণ জ্ঞান", jobs: "চাকরির খবর", insight: "ইনসাইট", videos: "ভিডিও",
      insightEmpty: "ইনসাইট শীঘ্রই আসছে।",
    },
  };
  const s = T[lang === "bn" ? "bn" : "en"];
  const L = lang === "bn" ? "bn" : "en";

  const notifGroups = useMemo(() => {
    const interestedIds = Object.entries(newsPreferences || {})
      .filter(([, v]) => v === "interested")
      .map(([id]) => id);
    const cats = TOPIC_CATEGORIES.filter((c) => c.id !== "all");
    const candidateCats = interestedIds.length > 0 ? cats.filter((c) => interestedIds.includes(c.id)) : cats;

    const groups = candidateCats
      .map((cat) => {
        const catItems = rankTrending((items || []).filter((it) => it.category === cat.id), 2);
        return { cat, items: catItems };
      })
      .filter((g) => g.items.length > 0);

    return interestedIds.length > 0 ? groups : groups.slice(0, 5);
  }, [items, newsPreferences]);

  const trendingPreview = useMemo(
    () => rankTrending(items || [], 3).map((it) => ({ key: it.id, headline: it.headline, subtitle: it.time, image: it.image })),
    [items]
  );

  const timelinePreview = useMemo(() => {
    return [...(items || [])]
      .filter((it) => it.rawDate)
      .sort((a, b) => b.rawDate - a.rawDate)
      .slice(0, 3)
      .map((it) => ({ key: it.id, headline: it.headline, subtitle: it.time, image: it.image }));
  }, [items]);

  const vocabPreview = useMemo(() => {
    const pool = [...VOCAB_WORDS, ...LINKING_WORDS];
    return shuffleArray(pool)
      .slice(0, 3)
      .map((w) => ({ key: w.word, headline: w.word, subtitle: w.meaning || w.use }));
  }, []);

  const gkPreview = useMemo(() => {
    const nat = (GK_TOPICS.national?.[L] || []).slice(0, 2);
    const intl = (GK_TOPICS.international?.[L] || []).slice(0, 1);
    return [...nat, ...intl].map((t, i) => ({ key: `gk-${i}`, headline: t.heading, subtitle: null }));
  }, [L]);

  const jobPreview = useMemo(() => {
    const gov = (JOB_LISTINGS.government?.[L] || []).flatMap((o) => o.jobs.map((j) => ({ ...j, org: o.org })));
    const priv = (JOB_LISTINGS.private?.[L] || []).flatMap((o) => o.jobs.map((j) => ({ ...j, org: o.org })));
    return [...gov, ...priv].slice(0, 3).map((j, i) => ({ key: `job-${i}`, headline: j.title, subtitle: j.org }));
  }, [L]);

  const videoPreview = useMemo(
    () => (VIDEO_SAMPLE[L] || []).slice(0, 3).map((v, i) => ({ key: `vid-${i}`, headline: v.headline, subtitle: v.duration })),
    [L]
  );

  const PreviewSection = ({ icon: Icon, title, list, tabId, emptyMsg }) => (
    <div className="cat-notif-group">
      <button className="cat-notif-header-row cat-section-header-btn" onClick={() => onGoToTab(tabId)}>
        <h2 className="cat-menu-title cat-notif-title">
          <Icon size={17} strokeWidth={2} className="cat-section-title-icon" /> {title}
        </h2>
        <ChevronRight size={18} strokeWidth={2} color="var(--gold)" />
      </button>
      {list.length === 0 ? (
        <p className="profile-empty-note">{emptyMsg || s.empty}</p>
      ) : (
        <div className="cat-notif-list">
          {list.map((it) => (
            <button key={it.key} className="cat-notif-row" onClick={() => onGoToTab(tabId)}>
              <span className="cat-notif-icon">
                {it.image ? <img src={it.image} alt="" className="cat-notif-icon-img" /> : <Icon size={14} strokeWidth={2} color="var(--gold)" />}
              </span>
              <span className="cat-notif-text">
                <span className="cat-notif-headline">{it.headline}</span>
                {it.subtitle && <span className="list-time">{it.subtitle}</span>}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="cat-menu-screen">
      <h2 className="cat-menu-title"><Grid3x3 size={17} strokeWidth={2} className="cat-section-title-icon" /> {s.categories}</h2>
      <div className="cat-menu-line">
        {TOPIC_CATEGORIES.map((cat) => {
          const Icon = cat.icon;
          const label = lang === "bn" ? cat.bn : cat.en;
          const isActive = activeCategory === label;
          return (
            <button
              key={cat.id}
              className={`cat-menu-chip ${isActive ? "active" : ""}`}
              onClick={() => (cat.id === "all" ? onSelect(isActive ? null : label) : setOpenCategory(cat))}
            >
              <Icon size={16} strokeWidth={2} />
              <span className="cat-menu-chip-label">{label}</span>
            </button>
          );
        })}
      </div>

      <button className="cat-notif-header-row cat-section-header-btn" onClick={onGoToPreferences}>
        <h2 className="cat-menu-title cat-notif-title"><SlidersHorizontal size={17} strokeWidth={2} className="cat-section-title-icon" /> {s.yourPrefs}</h2>
        <ChevronRight size={18} strokeWidth={2} color="var(--gold)" />
      </button>
      <p className="cat-notif-hint">{s.yourPrefsSub}</p>

      <div className="cat-notif-header-row">
        <h2 className="cat-menu-title cat-notif-title"><Bell size={17} strokeWidth={2} className="cat-section-title-icon" /> {s.notifications}</h2>
        <button className="cat-notif-viewall" onClick={onViewAllTrending}>{s.viewAll}</button>
      </div>
      <p className="cat-notif-hint">{s.tapHint}</p>

      {notifGroups.length === 0 ? (
        <p className="profile-empty-note">{s.empty}</p>
      ) : (
        notifGroups.map(({ cat, items: catItems }) => {
          const Icon = cat.icon;
          const label = lang === "bn" ? cat.bn : cat.en;
          return (
            <div className="cat-notif-group" key={cat.id}>
              <button className="cat-notif-group-title cat-notif-group-title-btn" onClick={() => setOpenCategory(cat)}>
                <Icon size={13} strokeWidth={2} /> {label}
              </button>
              <div className="cat-notif-list">
                {catItems.map((it) => (
                  <button
                    key={it.id}
                    className="cat-notif-row"
                    onClick={() => onNotifTap(it, label)}
                  >
                    <span className="cat-notif-icon">
                      {it.image ? (
                        <img src={it.image} alt="" className="cat-notif-icon-img" />
                      ) : (
                        <Bell size={14} strokeWidth={2} color="var(--gold)" />
                      )}
                    </span>
                    <span className="cat-notif-text">
                      <span className="cat-notif-headline">{it.headline}</span>
                      <span className="list-time">{it.time}</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          );
        })
      )}

      <PreviewSection icon={TrendingUp} title={s.trending} list={trendingPreview} tabId="trending" />
      <PreviewSection icon={Clock3} title={s.timelines} list={timelinePreview} tabId="timelines" />
      <PreviewSection icon={Languages} title={s.vocabulary} list={vocabPreview} tabId="vocabulary" />
      <PreviewSection icon={Compass} title={s.gk} list={gkPreview} tabId="gk" />
      <PreviewSection icon={Briefcase} title={s.jobs} list={jobPreview} tabId="jobnews" />
      <PreviewSection icon={Lightbulb} title={s.insight} list={[]} tabId="insight" emptyMsg={s.insightEmpty} />
      <PreviewSection icon={Video} title={s.videos} list={videoPreview} tabId="videos" />

      {openCategory && (
        <CategoryNewsPopup
          category={openCategory}
          lang={lang}
          items={items}
          onNotifTap={(item, label) => { onNotifTap(item, label); setOpenCategory(null); }}
          onViewFeed={() => { onSelect(lang === "bn" ? openCategory.bn : openCategory.en); setOpenCategory(null); }}
          onClose={() => setOpenCategory(null)}
        />
      )}
    </div>
  );
}

function GoogleMark() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48">
      <path fill="#FFC107" d="M43.6 20.5H42V20.4H24v7.2h11.3C33.6 32 29.2 34.8 24 34.8c-6.1 0-11-5-11-11.1s4.9-11.1 11-11.1c2.8 0 5.3 1 7.3 2.7l5.4-5.4C33.1 6.9 28.8 5 24 5 13.5 5 5 13.6 5 24.2S13.5 43.4 24 43.4c9.8 0 18.7-7.1 18.7-19.7 0-1.1-.1-2.1-.3-3.2z"/>
      <path fill="#FF3D00" d="M6.3 14.5l5.9 4.3C13.9 15 18.6 12 24 12c2.8 0 5.3 1 7.3 2.7l5.4-5.4C33.1 6.9 28.8 5 24 5c-7.5 0-14 4.2-17.7 10.5z"/>
      <path fill="#4CAF50" d="M24 43.4c4.7 0 9-1.8 12.2-4.8l-5.6-4.7c-1.9 1.4-4.3 2.1-6.6 2.1-5.2 0-9.6-2.8-11.3-7l-5.9 4.5C10 39.1 16.5 43.4 24 43.4z"/>
      <path fill="#1976D2" d="M43.6 20.5H42V20.4H24v7.2h11.3c-.9 2.4-2.5 4.4-4.7 5.8l5.6 4.7c-.4.4 5.8-4.2 5.8-13.9 0-1.1-.1-2.1-.3-3.2z"/>
    </svg>
  );
}
function FacebookMark() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="12" fill="#1877F2" />
      <path fill="#fff" d="M15.1 12.7h-2v7.2h-3v-7.2H8.3v-2.6h1.8V8.4c0-1.7 1-2.9 2.9-2.9h2v2.6h-1.3c-.4 0-.7.3-.7.8v1.2h2l-.3 2.6z" />
    </svg>
  );
}
function LinkedInMark() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24">
      <rect width="24" height="24" rx="5" fill="#0A66C2" />
      <path fill="#fff" d="M7.2 9.8h2.5v7.6H7.2V9.8zm1.25-4a1.45 1.45 0 1 1 0 2.9 1.45 1.45 0 0 1 0-2.9zM11.3 9.8h2.4v1.05h.03c.34-.63 1.16-1.3 2.38-1.3 2.55 0 3.02 1.68 3.02 3.86v4h-2.5v-3.55c0-.85-.02-1.94-1.18-1.94-1.19 0-1.37.93-1.37 1.88v3.6h-2.5V9.8z" />
    </svg>
  );
}

function WhatsAppMark() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="#fff">
      <path d="M12 2C6.5 2 2 6.5 2 12c0 1.8.5 3.5 1.3 5L2 22l5.2-1.3c1.4.8 3.1 1.2 4.8 1.2 5.5 0 10-4.5 10-10S17.5 2 12 2zm5.9 14.2c-.2.7-1.4 1.3-2 1.4-.5.1-1.2.1-1.9-.1-.4-.1-1-.3-1.7-.6-3-1.3-4.9-4.3-5.1-4.5-.1-.2-1.2-1.6-1.2-3.1s.8-2.2 1.1-2.5c.3-.3.6-.4.8-.4h.6c.2 0 .5 0 .7.5.3.7.9 2.2 1 2.4.1.2.1.4 0 .6-.1.2-.2.4-.4.6-.2.2-.4.5-.5.6-.2.2-.4.4-.2.8.2.4 1 1.6 2.1 2.6 1.4 1.3 2.6 1.7 3 1.9.4.2.6.1.8-.1.2-.3.9-1 1.1-1.4.2-.3.5-.3.8-.2.3.1 2 1 2.4 1.1.4.2.6.3.7.4.1.3.1.7-.1 1.4z" />
    </svg>
  );
}

function XMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="#fff">
      <path d="M18.9 2H22l-7.6 8.7L23 22h-6.9l-5.4-6.9L4.6 22H1.5l8.1-9.3L1 2h7l4.9 6.4L18.9 2zm-1.2 18.2h1.9L7.4 3.7H5.4l12.3 16.5z" />
    </svg>
  );
}

function ShareSheet({ story, lang, onClose }) {
  const [copied, setCopied] = useState(false);
  const shareUrl = story?.link && story.link !== "#" ? story.link : "https://pings.app";
  const shareText = story?.headline || "Pings";

  const T = {
    en: { title: "Share via", copy: "Copy Link", copied: "Link copied!", more: "More Apps", cancel: "Cancel" },
    bn: { title: "শেয়ার করুন", copy: "লিংক কপি করুন", copied: "লিংক কপি হয়েছে!", more: "আরও অ্যাপ", cancel: "বাতিল" },
  };
  const s = T[lang === "bn" ? "bn" : "en"];

  const options = [
    {
      id: "whatsapp",
      label: "WhatsApp",
      bg: "#25D366",
      icon: <WhatsAppMark />,
      action: () => window.open(`https://wa.me/?text=${encodeURIComponent(shareText + " " + shareUrl)}`, "_blank"),
    },
    {
      id: "facebook",
      label: "Facebook",
      bg: "#1877F2",
      icon: <FacebookMark />,
      action: () => window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`, "_blank"),
    },
    {
      id: "linkedin",
      label: "LinkedIn",
      bg: "#0A66C2",
      icon: <LinkedInMark />,
      action: () => window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`, "_blank"),
    },
    {
      id: "x",
      label: "X",
      bg: "#000",
      icon: <XMark />,
      action: () => window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`, "_blank"),
    },
    {
      id: "telegram",
      label: "Telegram",
      bg: "#26A5E4",
      icon: <Send size={19} strokeWidth={2} color="#fff" />,
      action: () => window.open(`https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}`, "_blank"),
    },
    {
      id: "email",
      label: "Email",
      bg: "#6b6156",
      icon: <Mail size={19} strokeWidth={2} color="#fff" />,
      action: () => { window.location.href = `mailto:?subject=${encodeURIComponent(shareText)}&body=${encodeURIComponent(shareUrl)}`; },
    },
    {
      id: "copy",
      label: copied ? s.copied : s.copy,
      bg: "#D97757",
      icon: <Link2 size={19} strokeWidth={2} color="#fff" />,
      action: () => {
        navigator.clipboard?.writeText(shareUrl).then(() => setCopied(true));
      },
    },
  ];

  return (
    <div className="share-overlay" onClick={onClose}>
      <div className="share-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="share-sheet-handle" />
        <span className="share-sheet-title">{s.title}</span>
        <div className="share-grid">
          {options.map((o) => (
            <button key={o.id} className="share-opt" onClick={o.action}>
              <span className="share-opt-icon" style={{ background: o.bg }}>{o.icon}</span>
              <span className="share-opt-label">{o.label}</span>
            </button>
          ))}
          {typeof navigator !== "undefined" && navigator.share && (
            <button
              className="share-opt"
              onClick={() => navigator.share({ title: shareText, url: shareUrl })}
            >
              <span className="share-opt-icon" style={{ background: "#3a4a40" }}>
                <MessageCircle size={19} strokeWidth={2} color="#fff" />
              </span>
              <span className="share-opt-label">{s.more}</span>
            </button>
          )}
        </div>
        <button className="share-cancel-btn" onClick={onClose}>{s.cancel}</button>
      </div>
    </div>
  );
}

function FolderPickerSheet({ item, folders, lang, onPickFolder, onCreateFolder, onClose }) {
  const [newFolderName, setNewFolderName] = useState("");
  const [showNewInput, setShowNewInput] = useState(folders.length === 0);

  const T = {
    en: { title: "Save to Customise folder", newFolder: "New folder", placeholder: "Folder name", create: "Create & Save", cancel: "Cancel", empty: "No folders yet — create one below." },
    bn: { title: "কাস্টমাইজ ফোল্ডারে সংরক্ষণ করুন", newFolder: "নতুন ফোল্ডার", placeholder: "ফোল্ডারের নাম", create: "তৈরি করে সংরক্ষণ করুন", cancel: "বাতিল", empty: "এখনো কোনো ফোল্ডার নেই — নিচে একটি তৈরি করুন।" },
  };
  const s = T[lang === "bn" ? "bn" : "en"];

  const handleCreate = () => {
    const name = newFolderName.trim();
    if (!name) return;
    onCreateFolder(name);
    setNewFolderName("");
  };

  return (
    <div className="share-overlay" onClick={onClose}>
      <div className="share-sheet folder-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="share-sheet-handle" />
        <span className="share-sheet-title">{s.title}</span>
        <p className="folder-item-preview">{item.title}</p>

        {folders.length === 0 && <p className="list-sample-note">{s.empty}</p>}

        <div className="folder-list">
          {folders.map((f) => (
            <button key={f.id} className="folder-pick-row" onClick={() => onPickFolder(f.id)}>
              <span className="folder-pick-icon"><FolderIcon size={16} strokeWidth={2} /></span>
              <span className="folder-pick-name">{f.name}</span>
              <span className="folder-pick-count">{f.items.length}</span>
            </button>
          ))}
        </div>

        {showNewInput ? (
          <div className="folder-new-row">
            <input
              className="folder-new-input"
              type="text"
              placeholder={s.placeholder}
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              autoFocus
            />
            <button className="folder-create-btn" onClick={handleCreate} disabled={!newFolderName.trim()}>
              {s.create}
            </button>
          </div>
        ) : (
          <button className="folder-add-new-btn" onClick={() => setShowNewInput(true)}>
            <Plus size={15} strokeWidth={2} /> {s.newFolder}
          </button>
        )}

        <button className="share-cancel-btn" onClick={onClose}>{s.cancel}</button>
      </div>
    </div>
  );
}

const FIFA_KEYWORDS = {
  en: ["fifa", "world cup", "football", "soccer"],
  bn: ["ফিফা", "বিশ্বকাপ", "ফুটবল"],
};

function filterFifaItems(items, lang) {
  const kws = FIFA_KEYWORDS[lang === "bn" ? "bn" : "en"];
  return items.filter((it) => {
    const hay = `${it.headline} ${it.summary}`.toLowerCase();
    return kws.some((k) => hay.includes(k.toLowerCase()));
  });
}

const FIFA_FALLBACK = {
  en: [
    { id: "fw1", headline: "Host cities confirm final matchday schedules", time: "1h ago", link: "#", image: null },
    { id: "fw2", headline: "Defending champions name provisional squad", time: "3h ago", link: "#", image: null },
    { id: "fw3", headline: "Ticket sales open for quarter-final stage", time: "6h ago", link: "#", image: null },
  ],
  bn: [
    { id: "fw1", headline: "স্বাগতিক শহরগুলোর চূড়ান্ত ম্যাচ সূচি নিশ্চিত", time: "১ ঘণ্টা আগে", link: "#", image: null },
    { id: "fw2", headline: "চ্যাম্পিয়ন দলের অস্থায়ী স্কোয়াড ঘোষণা", time: "৩ ঘণ্টা আগে", link: "#", image: null },
    { id: "fw3", headline: "কোয়ার্টার-ফাইনালের টিকিট বিক্রি শুরু", time: "৬ ঘণ্টা আগে", link: "#", image: null },
  ],
};

function NewsListScreen({ title, items, lang, isSample }) {
  return (
    <div className="list-screen">
      <h2 className="list-title">{title}</h2>
      {isSample && (
        <p className="list-sample-note">
          {lang === "bn"
            ? "এই মুহূর্তে মিলে যাওয়া কোনো লাইভ খবর নেই — নমুনা দেখানো হচ্ছে।"
            : "No live stories matched this session — showing sample cards."}
        </p>
      )}
      <div className="list-items">
        {items.map((it) => (
          <a key={it.id} href={it.link} target="_blank" rel="noopener noreferrer" className="list-row">
            <span className="list-thumb">
              {it.image ? (
                <img src={it.image} alt="" className="list-thumb-img" />
              ) : (
                <ImageIcon size={18} strokeWidth={1.6} color="var(--gold)" />
              )}
            </span>
            <span className="list-row-text">
              <span className="list-headline">{it.headline}</span>
              <span className="list-time">{it.time}</span>
            </span>
          </a>
        ))}
      </div>
    </div>
  );
}

const TRENDING_CATEGORY_WEIGHT = {
  national: 3,
  politics: 3,
  sports: 2.5,
  world: 2.5,
  business: 2,
  entertainment: 2,
  technology: 1.5,
};

function rankTrending(items, count = 15) {
  const now = Date.now();
  const scored = items.map((it) => {
    const ageHours = it.rawDate ? Math.max(0.5, (now - it.rawDate.getTime()) / 3600000) : 6;
    const recencyScore = 1 / ageHours;
    const catWeight = TRENDING_CATEGORY_WEIGHT[it.category] || 1;
    const jitter = 0.85 + Math.random() * 0.3; // slight shuffle so it doesn't feel too mechanical
    return { ...it, _score: recencyScore * catWeight * jitter };
  });
  return scored.sort((a, b) => b._score - a._score).slice(0, count);
}

function TrendingScreen({ items, lang }) {
  const ranked = useMemo(() => rankTrending(items), [items]);

  const T = {
    en: {
      title: "Trending",
      sub: "The stories getting the most attention right now, from your live feed.",
      note: "Ranked using a mix of how recent each story is and its category — not real click or share counts, since that needs live analytics from a backend.",
      empty: "No live stories loaded yet — check My Feed to load today's news first.",
    },
    bn: {
      title: "ট্রেন্ডিং",
      sub: "আপনার লাইভ ফিড থেকে এখন সবচেয়ে বেশি নজর কাড়ছে এমন খবর।",
      note: "প্রতিটি খবরের সাম্প্রতিকতা ও বিভাগের সমন্বয়ে র‍্যাংক করা হয়েছে — প্রকৃত ক্লিক বা শেয়ার সংখ্যা নয়, কারণ এর জন্য ব্যাকএন্ড থেকে লাইভ অ্যানালিটিক্স প্রয়োজন।",
      empty: "এখনো কোনো লাইভ খবর লোড হয়নি — প্রথমে My Feed থেকে আজকের খবর লোড করুন।",
    },
  };
  const s = T[lang === "bn" ? "bn" : "en"];

  return (
    <div className="list-screen">
      <h2 className="list-title">{s.title}</h2>
      <p className="timeline-sub">{s.sub}</p>
      <p className="list-sample-note">{s.note}</p>

      {ranked.length === 0 ? (
        <p className="profile-empty-note">{s.empty}</p>
      ) : (
        <div className="list-items">
          {ranked.map((it, i) => (
            <a key={it.id} href={it.link} target="_blank" rel="noopener noreferrer" className="list-row trending-row">
              <span className={`trending-rank ${i < 3 ? "top" : ""}`}>{i + 1}</span>
              <span className="list-thumb">
                {it.image ? (
                  <img src={it.image} alt="" className="list-thumb-img" />
                ) : (
                  <ImageIcon size={18} strokeWidth={1.6} color="var(--gold)" />
                )}
              </span>
              <span className="list-row-text">
                <span className="list-headline">{it.headline}</span>
                <span className="list-time">{it.time}</span>
              </span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

const TIMELINE_SAMPLE = {
  en: [
    "Government announces new budget priorities",
    "Central bank holds interest rates steady",
    "Dhaka traffic authority unveils new bus routes",
    "Export sector posts steady quarterly growth",
    "University admission tests begin nationwide",
    "Weather office forecasts heavy monsoon rain",
    "National cricket team announces upcoming tour",
  ],
  bn: [
    "সরকার নতুন বাজেট অগ্রাধিকার ঘোষণা করেছে",
    "কেন্দ্রীয় ব্যাংক সুদের হার অপরিবর্তিত রেখেছে",
    "ঢাকা ট্রাফিক কর্তৃপক্ষ নতুন বাস রুট চালু করেছে",
    "রপ্তানি খাতে স্থিতিশীল প্রান্তিক প্রবৃদ্ধি",
    "সারাদেশে বিশ্ববিদ্যালয় ভর্তি পরীক্ষা শুরু",
    "আবহাওয়া অফিসের ভারী বর্ষণের পূর্বাভাস",
    "জাতীয় ক্রিকেট দলের আসন্ন সফর ঘোষণা",
  ],
};

function formatDayLabel(date, lang, today) {
  const diffDays = Math.round((today.setHours(0, 0, 0, 0) - new Date(date).setHours(0, 0, 0, 0)) / 86400000);
  if (diffDays === 0) return lang === "bn" ? "আজ" : "Today";
  if (diffDays === 1) return lang === "bn" ? "গতকাল" : "Yesterday";
  return date.toLocaleDateString(lang === "bn" ? "bn-BD" : "en-US", { weekday: "short", month: "short", day: "numeric" });
}

function filterByKeywords(items, keywords) {
  return items.filter((it) => {
    const hay = `${it.headline} ${it.summary}`.toLowerCase();
    return keywords.some((k) => hay.includes(k.toLowerCase()));
  });
}

const TRENDING_TOPICS = [
  {
    id: "flood2026",
    en: "Monsoon Flood-2026",
    bn: "বর্ষা বন্যা-২০২৬",
    keywords: {
      en: ["flood", "monsoon", "landslide", "waterlogged", "rain", "downpour"],
      bn: ["বন্যা", "বর্ষা", "ধস", "জলাবদ্ধ", "বৃষ্টি"],
    },
    sample: {
      en: [
        { headline: "Heavy rains trigger landslides in Cox's Bazar and Bandarban", daysAgo: 0 },
        { headline: "Chattogram roads submerged as monsoon rains intensify", daysAgo: 1 },
        { headline: "Emergency shelters opened as flood risk rises in hill districts", daysAgo: 2 },
        { headline: "Death toll climbs as rain-related incidents continue", daysAgo: 2 },
        { headline: "Train services suspended on Chattogram-Cox's Bazar line", daysAgo: 3 },
      ],
      bn: [
        { headline: "কক্সবাজার ও বান্দরবানে ভারী বর্ষণে ভূমিধস", daysAgo: 0 },
        { headline: "বর্ষার তীব্রতায় চট্টগ্রামের রাস্তা পানির নিচে", daysAgo: 1 },
        { headline: "পাহাড়ি জেলায় বন্যার শঙ্কায় জরুরি আশ্রয়কেন্দ্র খোলা", daysAgo: 2 },
        { headline: "বৃষ্টি-সংক্রান্ত ঘটনায় মৃতের সংখ্যা বাড়ছে", daysAgo: 2 },
        { headline: "চট্টগ্রাম-কক্সবাজার রেলপথে ট্রেন চলাচল বন্ধ", daysAgo: 3 },
      ],
    },
  },
];

function TopicTimelineDetail({ topic, items, lang, onBack }) {
  const kws = topic.keywords[lang === "bn" ? "bn" : "en"];
  const live = filterByKeywords(items, kws);
  const useSample = live.length === 0;
  const today = new Date();

  const rows = useSample
    ? topic.sample[lang === "bn" ? "bn" : "en"].map((s, i) => {
        const d = new Date();
        d.setDate(d.getDate() - s.daysAgo);
        return { id: `s${i}`, headline: s.headline, image: null, link: "#", rawDate: d, isSample: true };
      })
    : live;

  const grouped = [];
  rows.forEach((row) => {
    const dateKey = row.rawDate ? row.rawDate.toDateString() : "unknown";
    let group = grouped.find((g) => g.key === dateKey);
    if (!group) {
      group = {
        key: dateKey,
        label: row.rawDate ? formatDayLabel(new Date(row.rawDate), lang, new Date(today)) : "",
        rows: [],
      };
      grouped.push(group);
    }
    group.rows.push(row);
  });
  grouped.sort((a, b) => (a.key < b.key ? 1 : -1));

  return (
    <div className="list-screen">
      <button className="topic-back-btn" onClick={onBack}>
        <ChevronLeft size={16} strokeWidth={2} /> {lang === "bn" ? "টাইমলাইনে ফিরুন" : "Back to Timelines"}
      </button>
      <h2 className="list-title">{lang === "bn" ? topic.bn : topic.en}</h2>
      {useSample && (
        <p className="list-sample-note">
          {lang === "bn"
            ? "এই মুহূর্তে মিলে যাওয়া কোনো লাইভ খবর নেই — নমুনা দেখানো হচ্ছে।"
            : "No live stories matched this session — showing sample cards."}
        </p>
      )}
      {grouped.map((g) => (
        <div className="topic-date-group" key={g.key}>
          <span className="topic-date-label">{g.label}</span>
          <div className="list-items">
            {g.rows.map((it) => (
              <a key={it.id} href={it.link} target="_blank" rel="noopener noreferrer" className="list-row">
                <span className="list-thumb">
                  {it.image ? (
                    <img src={it.image} alt="" className="list-thumb-img" />
                  ) : (
                    <ImageIcon size={18} strokeWidth={1.6} color="var(--gold)" />
                  )}
                </span>
                <span className="list-row-text">
                  <span className="list-headline">{it.headline}</span>
                </span>
              </a>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function TimelineScreen({ items, lang }) {
  const [openTopic, setOpenTopic] = useState(null);
  const today = new Date();
  const samples = TIMELINE_SAMPLE[lang === "bn" ? "bn" : "en"];

  if (openTopic) {
    return (
      <TopicTimelineDetail
        topic={openTopic}
        items={items}
        lang={lang}
        onBack={() => setOpenTopic(null)}
      />
    );
  }

  const days = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const liveMatch = items.find(
      (it) => it.rawDate && it.rawDate.toDateString() === d.toDateString()
    );
    return {
      key: d.toDateString(),
      dateLabel: formatDayLabel(new Date(d), lang, new Date()),
      headline: liveMatch ? liveMatch.headline : samples[i % samples.length],
      link: liveMatch ? liveMatch.link : "#",
      isSample: !liveMatch,
    };
  });

  return (
    <div className="timeline-screen">
      <h2 className="timeline-title">{lang === "bn" ? "টাইমলাইন" : "Timelines"}</h2>
      <p className="timeline-sub">
        {lang === "bn" ? "প্রতিদিনের সবচেয়ে গুরুত্বপূর্ণ খবর" : "The most important headline, every day"}
      </p>

      <span className="topic-section-label">
        {lang === "bn" ? "চলমান বিষয়" : "Trending Topics"}
      </span>
      <div className="topic-pill-row">
        {TRENDING_TOPICS.map((tp) => (
          <button key={tp.id} className="topic-pill" onClick={() => setOpenTopic(tp)}>
            {lang === "bn" ? tp.bn : tp.en}
          </button>
        ))}
      </div>

      <div className="timeline-track">
        {days.map((d, i) => (
          <div className="timeline-entry" key={d.key}>
            <div className="timeline-dot-col">
              <span className="timeline-icon">
                <Star size={13} strokeWidth={2} fill="#1B1200" />
              </span>
              {i < days.length - 1 && <span className="timeline-line" />}
            </div>
            <div className="timeline-content">
              <span className="timeline-date">{d.dateLabel}</span>
              <a
                href={d.link}
                target="_blank"
                rel="noopener noreferrer"
                className="timeline-headline"
              >
                {d.headline}
              </a>
              {d.isSample && (
                <span className="timeline-sample-tag">
                  {lang === "bn" ? "নমুনা" : "Sample"}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const VIDEO_SAMPLE = {
  en: [
    { headline: "Flood-hit families rebuild after receding waters", sourceType: "tv", duration: "1:24" },
    { headline: "Highlights: national team's practice session ahead of tour", sourceType: "newspaper", duration: "0:48" },
    { headline: "Viral moment from parliament session draws reactions", sourceType: "x", duration: "0:32" },
    { headline: "Weather update: monsoon outlook for the week", sourceType: "tv", duration: "2:10" },
    { headline: "Street interview: commuters react to new bus routes", sourceType: "newspaper", duration: "1:05" },
    { headline: "Clip: finance minister's remarks on the new budget", sourceType: "x", duration: "0:41" },
  ],
  bn: [
    { headline: "পানি নামার পর ঘর গোছাতে ব্যস্ত বন্যাদুর্গত পরিবার", sourceType: "tv", duration: "১:২৪" },
    { headline: "সফরের আগে জাতীয় দলের অনুশীলনের মুহূর্ত", sourceType: "newspaper", duration: "০:৪৮" },
    { headline: "সংসদের ভাইরাল মুহূর্তে নানা প্রতিক্রিয়া", sourceType: "x", duration: "০:৩২" },
    { headline: "সাপ্তাহিক বর্ষার পূর্বাভাস নিয়ে আবহাওয়া আপডেট", sourceType: "tv", duration: "২:১০" },
    { headline: "নতুন বাস রুট নিয়ে যাত্রীদের প্রতিক্রিয়া", sourceType: "newspaper", duration: "১:০৫" },
    { headline: "বাজেট নিয়ে অর্থমন্ত্রীর বক্তব্যের ক্লিপ", sourceType: "x", duration: "০:৪১" },
  ],
};

function SourceTypeBadge({ type }) {
  if (type === "tv") return <Tv size={12} strokeWidth={2} />;
  if (type === "x") return <span className="x-mark">𝕏</span>;
  return <Newspaper size={12} strokeWidth={2} />;
}

function VideoScreen({ lang }) {
  const clips = VIDEO_SAMPLE[lang === "bn" ? "bn" : "en"];
  return (
    <div className="video-screen">
      <h2 className="list-title">{lang === "bn" ? "ভিডিও" : "Videos"}</h2>
      <p className="timeline-sub">
        {lang === "bn"
          ? "সংবাদপত্র, X ও টিভি চ্যানেল থেকে জনপ্রিয় ভিডিও"
          : "Trending clips pulled from newspapers, X, and TV channels"}
      </p>
      <p className="list-sample-note">
        {lang === "bn"
          ? "এই মুহূর্তে মিলে যাওয়া কোনো লাইভ ভিডিও নেই — নমুনা দেখানো হচ্ছে।"
          : "No live video feed connected yet — showing sample cards."}
      </p>
      <div className="video-grid">
        {clips.map((v, i) => (
          <div className="video-card" key={i}>
            <div className="video-thumb" style={{ background: GRADIENTS[i % GRADIENTS.length] }}>
              <span className="video-source-badge">
                <SourceTypeBadge type={v.sourceType} />
              </span>
              <span className="video-play-btn">
                <Play size={18} strokeWidth={0} fill="#fff" />
              </span>
              <span className="video-duration">{v.duration}</span>
            </div>
            <span className="video-headline">{v.headline}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const VOCAB_WORDS = [
  {
    word: "Exacerbate",
    pos: "verb",
    meaning: "To make a problem, bad situation, or negative feeling worse.",
    examples: [
      "Delays in relief supplies exacerbated the suffering of flood victims in the hill districts.",
      "Analysts warned that another rate hike could exacerbate the slowdown in private investment.",
      "Skipping warm-up exercises can exacerbate a minor muscle strain into a serious injury.",
    ],
  },
  {
    word: "Circumvent",
    pos: "verb",
    meaning: "To find a way around an obstacle, rule, or difficulty, often cleverly.",
    examples: [
      "The company was accused of circumventing import regulations by rerouting shipments through a third country.",
      "Some candidates tried to circumvent the exam's word limit by using smaller handwriting.",
      "The opposition claimed the ordinance was an attempt to circumvent parliamentary debate.",
    ],
  },
  {
    word: "Unprecedented",
    pos: "adjective",
    meaning: "Never having happened or existed before.",
    examples: [
      "The central bank described the currency's fall as unprecedented in the last two decades.",
      "The stadium saw an unprecedented turnout for the qualifying match.",
      "Universities reported an unprecedented number of applications this admission cycle.",
    ],
  },
  {
    word: "Corroborate",
    pos: "verb",
    meaning: "To confirm or give supporting evidence for a statement, theory, or finding.",
    examples: [
      "Independent witnesses corroborated the eyewitness account given to investigators.",
      "Satellite imagery corroborated the district office's report on the extent of flooding.",
      "The audit firm's findings corroborated the whistleblower's original complaint.",
    ],
  },
  {
    word: "Ramification",
    pos: "noun",
    meaning: "A consequence of an action or decision, especially one that is complex or unwelcome.",
    examples: [
      "Economists are still assessing the ramifications of the new tax policy on small businesses.",
      "The coach admitted the injury could have serious ramifications for the team's tournament chances.",
      "Legal experts debated the ramifications of the court's ruling on future land disputes.",
    ],
  },
  {
    word: "Pragmatic",
    pos: "adjective",
    meaning: "Dealing with problems in a sensible, practical way rather than by fixed theory or ideals.",
    examples: [
      "Officials called for a pragmatic approach to resettling families displaced by the flooding.",
      "The startup took a pragmatic view, prioritising cash flow over rapid expansion.",
      "Her pragmatic answer to the panel's question impressed the interview board.",
    ],
  },
  {
    word: "Vindicate",
    pos: "verb",
    meaning: "To clear someone of blame or suspicion, or to prove a claim or decision was justified.",
    examples: [
      "The audit ultimately vindicated the bank's handling of the disputed loan accounts.",
      "Years later, the discarded research paper was vindicated by new laboratory results.",
      "The manager felt vindicated when the risky strategy delivered record quarterly profits.",
    ],
  },
  {
    word: "Meticulous",
    pos: "adjective",
    meaning: "Showing great attention to detail; very careful and precise.",
    examples: [
      "The report was the result of meticulous research into the district's rainfall patterns.",
      "Her meticulous preparation for the viva left the examiners with few follow-up questions.",
      "The chef's meticulous plating has become the restaurant's signature.",
    ],
  },
  {
    word: "Contentious",
    pos: "adjective",
    meaning: "Likely to cause an argument; controversial.",
    examples: [
      "The land-acquisition clause remains the most contentious part of the bill.",
      "Selection for the national squad has always been a contentious issue among fans.",
      "The panel avoided the contentious question of budget cuts until the final session.",
    ],
  },
  {
    word: "Deteriorate",
    pos: "verb",
    meaning: "To become progressively worse.",
    examples: [
      "Relations between the two neighbouring countries deteriorated after the border incident.",
      "Doctors said the patient's condition began to deteriorate overnight.",
      "The road surface deteriorated rapidly after the second week of heavy rain.",
    ],
  },
  {
    word: "Feasible",
    pos: "adjective",
    meaning: "Possible to do easily or conveniently.",
    examples: [
      "Engineers confirmed the elevated expressway was technically feasible within the budget.",
      "It isn't feasible to finish the audit before the weekend deadline.",
      "A four-day work week may not be feasible for every industry.",
    ],
  },
  {
    word: "Impartial",
    pos: "adjective",
    meaning: "Treating all sides equally; not favouring one over another.",
    examples: [
      "The election commission promised an impartial investigation into the complaints.",
      "Referees are expected to remain impartial regardless of the crowd's reaction.",
      "An impartial panel of judges reviewed the disputed scores.",
    ],
  },
  {
    word: "Precarious",
    pos: "adjective",
    meaning: "Not securely held or in position; dangerously likely to fail or collapse.",
    examples: [
      "The family's precarious financial situation worsened after the factory closure.",
      "Rescue workers described the building's precarious structure after the landslide.",
      "His position on the team looked precarious following two poor performances.",
    ],
  },
  {
    word: "Substantiate",
    pos: "verb",
    meaning: "To provide evidence to support or prove a claim.",
    examples: [
      "The journalist could not substantiate the allegations before publication.",
      "Bank statements were used to substantiate the company's revenue claims.",
      "Witness testimony helped substantiate the victim's account of events.",
    ],
  },
  {
    word: "Volatile",
    pos: "adjective",
    meaning: "Liable to change rapidly and unpredictably, especially for the worse.",
    examples: [
      "Global oil prices remained volatile throughout the quarter.",
      "The situation at the border stayed volatile despite the ceasefire announcement.",
      "Currency markets turned volatile after the central bank's surprise statement.",
    ],
  },
];

const LINKING_WORDS = [
  {
    word: "Notwithstanding",
    use: "Despite / in spite of",
    examples: [
      "Notwithstanding the heavy rain, the exam centres remained open.",
      "Notwithstanding strong export figures, the trade deficit widened last quarter.",
      "The project continued notwithstanding objections from local residents.",
    ],
  },
  {
    word: "Insofar as",
    use: "To the extent that",
    examples: [
      "The policy is effective insofar as it addresses urban flooding, but rural areas remain exposed.",
      "The contract is valid insofar as both parties have signed the annexed schedule.",
      "His argument holds insofar as demand stays constant, which is unlikely this quarter.",
    ],
  },
  {
    word: "Thereby",
    use: "By that means / as a result",
    examples: [
      "The bank raised its reserve ratio, thereby tightening liquidity in the market.",
      "The board approved the merger, thereby ending months of speculation.",
      "She completed the certification early, thereby qualifying for the internal transfer.",
    ],
  },
  {
    word: "Hitherto",
    use: "Until now / up to this point",
    examples: [
      "The remote upazila had hitherto been cut off from the national grid.",
      "Hitherto unpublished data suggests the outbreak began weeks earlier than reported.",
      "The clause had hitherto gone unnoticed by both negotiating teams.",
    ],
  },
  {
    word: "Conversely",
    use: "On the other hand / in contrast",
    examples: [
      "Exports rose sharply; conversely, imports fell for the third straight month.",
      "Urban unemployment eased slightly; conversely, rural joblessness ticked upward.",
      "The visiting team's defence held firm; conversely, their attack created almost nothing.",
    ],
  },
  {
    word: "In light of",
    use: "Considering / because of",
    examples: [
      "In light of the flood forecast, authorities pre-positioned emergency supplies.",
      "In light of recent leaks, the company revised its data-security policy.",
      "In light of her strong portfolio, the panel waived the written test.",
    ],
  },
  {
    word: "Albeit",
    use: "Although / even though",
    examples: [
      "The economy grew, albeit at a slower pace than last quarter.",
      "The rescue operation succeeded, albeit after a tense six-hour search.",
      "He accepted the offer, albeit reluctantly, given the limited alternatives.",
    ],
  },
  {
    word: "Nonetheless",
    use: "Even so / however",
    examples: [
      "The team lost the match; nonetheless, their defence showed real improvement.",
      "The proposal faced criticism; nonetheless, the board approved it.",
      "Turnout was low; nonetheless, officials called the vote a success.",
    ],
  },
  {
    word: "Whereas",
    use: "In contrast to the fact that",
    examples: [
      "Exports rose in the garment sector, whereas leather goods saw a decline.",
      "The northern districts received heavy rainfall, whereas the south stayed dry.",
      "Some candidates focused on essay questions, whereas others prioritised the MCQs.",
    ],
  },
  {
    word: "Provided that",
    use: "On condition that",
    examples: [
      "The loan will be approved, provided that all documents are submitted on time.",
      "Students may retake the exam, provided that they register within a week.",
      "The project can proceed, provided that environmental clearance is granted.",
    ],
  },
];

function VocabularyScreen({ lang, onSwitchLang, savedVocab, onToggleSaveVocab }) {
  const [expanded, setExpanded] = useState({});
  const toggle = (key) => setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));

  if (lang !== "en") {
    return (
      <div className="vocab-locked-screen">
        <span className="vocab-lock-icon"><Lock size={26} strokeWidth={1.8} /></span>
        <span className="vocab-lock-title">Vocabulary is available in English mode</span>
        <p className="vocab-lock-sub">Switch to English to see today's newspaper vocabulary and linking words.</p>
        <button className="vocab-switch-btn" onClick={onSwitchLang}>Switch to English</button>
      </div>
    );
  }

  return (
    <div className="vocab-screen">
      <h2 className="list-title">Vocabulary</h2>
      <p className="timeline-sub">
        Uncommon, high-value words from serious English newspapers — the kind that show up in job and admission exams.
      </p>
      <p className="list-sample-note">
        Curated sample set for this demo — a live build would pull and rank words from the day's actual articles. Tap a word to see its examples.
      </p>

      <span className="vocab-section-label">Today's Words</span>
      <div className="vocab-list">
        {VOCAB_WORDS.map((w) => {
          const key = `w-${w.word}`;
          const isOpen = !!expanded[key];
          const isSaved = !!savedVocab[key];
          return (
            <div className="vocab-card" key={key} onClick={() => toggle(key)}>
              <div className="vocab-card-top">
                <span className="vocab-word">{w.word}</span>
                <span className="vocab-pos">{w.pos}</span>
                <button
                  className={`vocab-save-btn ${isSaved ? "saved" : ""}`}
                  onClick={(e) => { e.stopPropagation(); onToggleSaveVocab(key, { key, type: "vocab", word: w.word, pos: w.pos, meaning: w.meaning, examples: w.examples }); }}
                  aria-label="Save word"
                >
                  <Bookmark size={14} strokeWidth={2} fill={isSaved ? "currentColor" : "none"} />
                </button>
                <ChevronRight size={15} strokeWidth={2} className={`vocab-chevron ${isOpen ? "open" : ""}`} />
              </div>
              <p className="vocab-meaning">{w.meaning}</p>
              {isOpen && (
                <ul className="vocab-example-list">
                  {w.examples.map((ex, i) => (
                    <li key={i} className="vocab-example">{ex}</li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>

      <span className="vocab-section-label">Native Linking Words</span>
      <div className="vocab-list">
        {LINKING_WORDS.map((w) => {
          const key = `l-${w.word}`;
          const isOpen = !!expanded[key];
          const isSaved = !!savedVocab[key];
          return (
            <div className="vocab-card" key={key} onClick={() => toggle(key)}>
              <div className="vocab-card-top">
                <span className="vocab-word">{w.word}</span>
                <span className="vocab-pos">linker</span>
                <button
                  className={`vocab-save-btn ${isSaved ? "saved" : ""}`}
                  onClick={(e) => { e.stopPropagation(); onToggleSaveVocab(key, { key, type: "linker", word: w.word, pos: "linker", meaning: w.use, examples: w.examples }); }}
                  aria-label="Save word"
                >
                  <Bookmark size={14} strokeWidth={2} fill={isSaved ? "currentColor" : "none"} />
                </button>
                <ChevronRight size={15} strokeWidth={2} className={`vocab-chevron ${isOpen ? "open" : ""}`} />
              </div>
              <p className="vocab-meaning">{w.use}</p>
              {isOpen && (
                <ul className="vocab-example-list">
                  {w.examples.map((ex, i) => (
                    <li key={i} className="vocab-example">{ex}</li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const GK_TOPICS = {
  national: {
    en: [
      {
        daysAgo: 0,
        heading: "Bangladesh's 2026 General Election Concludes",
        points: [
          { text: "The general election and constitutional referendum were held on 12 February 2026.", link: "https://en.wikipedia.org/wiki/Yunus_ministry" },
          { text: "The vote followed the July Charter reform process negotiated during the interim government's tenure.", link: "https://en.wikipedia.org/wiki/Muhammad_Yunus" },
        ],
      },
      {
        daysAgo: 1,
        heading: "Tarique Rahman Sworn In as Prime Minister",
        points: [
          { text: "He took the oath of office on 17 February 2026, following the BNP-led alliance's election win.", link: "https://en.wikipedia.org/wiki/Yunus_ministry" },
          { text: "President Mohammed Shahabuddin administered the oath at Bangabhaban.", link: "https://en.wikipedia.org/wiki/Chief_Adviser_of_Bangladesh" },
        ],
      },
      {
        daysAgo: 2,
        heading: "Muhammad Yunus's Interim Government Concludes",
        points: [
          { text: "Nobel laureate Muhammad Yunus served as Chief Adviser from August 2024 to February 2026.", link: "https://en.wikipedia.org/wiki/Muhammad_Yunus" },
          { text: "His administration's July Charter was based on consensus among 30 political parties on constitutional and electoral reforms.", link: "https://en.wikipedia.org/wiki/Muhammad_Yunus" },
        ],
      },
      {
        daysAgo: 3,
        heading: "Monsoon Flooding Hits Southeastern Bangladesh",
        points: [
          { text: "Heavy rain has triggered landslides and flooding in Cox's Bazar, Bandarban, and Chattogram this July.", link: "https://www.thedailystar.net/news/bangladesh/news/chattogram-reeling-under-monsoon-fury-4219531" },
          { text: "Rain-related incidents, including landslides, have caused casualties in the Chattogram region.", link: "https://www.thedailystar.net/news/bangladesh/news/chattogram-reeling-under-monsoon-fury-4219531" },
        ],
      },
    ],
    bn: [
      {
        daysAgo: 0,
        heading: "বাংলাদেশের ২০২৬ সাধারণ নির্বাচন সম্পন্ন",
        points: [
          { text: "১২ ফেব্রুয়ারি ২০২৬ তারিখে সাধারণ নির্বাচন ও সংবিধান গণভোট অনুষ্ঠিত হয়।", link: "https://en.wikipedia.org/wiki/Yunus_ministry" },
          { text: "অন্তর্বর্তী সরকারের সময়ে আলোচিত জুলাই সনদ সংস্কার প্রক্রিয়ার পর এই নির্বাচন অনুষ্ঠিত হয়।", link: "https://en.wikipedia.org/wiki/Muhammad_Yunus" },
        ],
      },
      {
        daysAgo: 1,
        heading: "তারেক রহমান প্রধানমন্ত্রী হিসেবে শপথ নিলেন",
        points: [
          { text: "বিএনপি-নেতৃত্বাধীন জোটের নির্বাচনী বিজয়ের পর তিনি ১৭ ফেব্রুয়ারি ২০২৬-এ শপথ নেন।", link: "https://en.wikipedia.org/wiki/Yunus_ministry" },
          { text: "রাষ্ট্রপতি মোহাম্মদ শাহাবুদ্দিন বঙ্গভবনে তাকে শপথ পড়ান।", link: "https://en.wikipedia.org/wiki/Chief_Adviser_of_Bangladesh" },
        ],
      },
      {
        daysAgo: 2,
        heading: "মুহাম্মদ ইউনূসের অন্তর্বর্তী সরকারের মেয়াদ সমাপ্তি",
        points: [
          { text: "নোবেলজয়ী মুহাম্মদ ইউনূস ২০২৪ সালের আগস্ট থেকে ২০২৬ সালের ফেব্রুয়ারি পর্যন্ত প্রধান উপদেষ্টা হিসেবে দায়িত্ব পালন করেন।", link: "https://en.wikipedia.org/wiki/Muhammad_Yunus" },
          { text: "তার সরকারের জুলাই সনদ ৩০টি রাজনৈতিক দলের ঐকমত্যের ভিত্তিতে সাংবিধানিক ও নির্বাচনী সংস্কার নিয়ে গঠিত হয়।", link: "https://en.wikipedia.org/wiki/Muhammad_Yunus" },
        ],
      },
      {
        daysAgo: 3,
        heading: "দক্ষিণ-পূর্বাঞ্চলে বর্ষার বন্যা",
        points: [
          { text: "জুলাই মাসে ভারী বর্ষণে কক্সবাজার, বান্দরবান ও চট্টগ্রামে ভূমিধস ও বন্যা দেখা দিয়েছে।", link: "https://www.thedailystar.net/news/bangladesh/news/chattogram-reeling-under-monsoon-fury-4219531" },
          { text: "চট্টগ্রাম অঞ্চলে বৃষ্টি-সংক্রান্ত ঘটনায়, বিশেষত ভূমিধসে হতাহতের ঘটনা ঘটেছে।", link: "https://www.thedailystar.net/news/bangladesh/news/chattogram-reeling-under-monsoon-fury-4219531" },
        ],
      },
    ],
  },
  international: {
    en: [
      {
        daysAgo: 0,
        heading: "UN Leadership Continues Under Guterres",
        points: [
          { text: "António Guterres remains UN Secretary-General, in the closing stretch of his second term.", link: "https://www.un.org/sg/en/content/the-week-ahead-the-united-nations" },
        ],
      },
      {
        daysAgo: 1,
        heading: "UN Launches Global Dialogue on AI Governance",
        points: [
          { text: "The inaugural dialogue was held in Geneva this July, created under the 2024 Global Digital Compact.", link: "https://press.un.org/en/2026/db260706.doc.htm" },
          { text: "The Secretary-General said AI, used well and shared widely, could compress decades of development into years.", link: "https://press.un.org/en/2026/db260706.doc.htm" },
        ],
      },
      {
        daysAgo: 2,
        heading: "UN Releases Sustainable Development Goals Report 2026",
        points: [
          { text: "Deputy Secretary-General Amina Mohammed launched the report alongside DESA officials.", link: "https://press.un.org/en/2026/db260706.doc.htm" },
        ],
      },
      {
        daysAgo: 3,
        heading: "UN Holds Fifth Chiefs of Police Summit",
        points: [
          { text: "UNCOPS 2026 focused on international policing cooperation this July.", link: "https://news.un.org/en/story/2026/07/1167887" },
          { text: "Nearly 4,500 UN Police personnel currently serve across peace operations in about 80 countries.", link: "https://news.un.org/en/story/2026/07/1167887" },
        ],
      },
    ],
    bn: [
      {
        daysAgo: 0,
        heading: "গুতেরেসের নেতৃত্বে জাতিসংঘ চলমান",
        points: [
          { text: "আন্তোনিও গুতেরেস তার দ্বিতীয় মেয়াদের শেষ পর্যায়ে জাতিসংঘের মহাসচিব হিসেবে দায়িত্ব পালন করছেন।", link: "https://www.un.org/sg/en/content/the-week-ahead-the-united-nations" },
        ],
      },
      {
        daysAgo: 1,
        heading: "জাতিসংঘের এআই গভর্নেন্স নিয়ে গ্লোবাল ডায়ালগ শুরু",
        points: [
          { text: "২০২৪ সালের গ্লোবাল ডিজিটাল কমপ্যাক্টের আওতায় গঠিত এই প্রথম সংলাপ জেনেভায় অনুষ্ঠিত হয়েছে।", link: "https://press.un.org/en/2026/db260706.doc.htm" },
          { text: "মহাসচিব বলেন, সঠিকভাবে ব্যবহৃত ও ছড়িয়ে দেওয়া এআই কয়েক দশকের উন্নয়ন কয়েক বছরে সম্পন্ন করতে পারে।", link: "https://press.un.org/en/2026/db260706.doc.htm" },
        ],
      },
      {
        daysAgo: 2,
        heading: "জাতিসংঘের এসডিজি প্রতিবেদন ২০২৬ প্রকাশ",
        points: [
          { text: "উপ-মহাসচিব আমিনা মোহাম্মদ ডেসার কর্মকর্তাদের সাথে প্রতিবেদনটি উন্মোচন করেন।", link: "https://press.un.org/en/2026/db260706.doc.htm" },
        ],
      },
      {
        daysAgo: 3,
        heading: "জাতিসংঘের পঞ্চম চিফস অব পুলিশ সামিট অনুষ্ঠিত",
        points: [
          { text: "ইউএনসিওপিএস ২০২৬ জুলাই মাসে আন্তর্জাতিক পুলিশি সহযোগিতার ওপর কেন্দ্রীভূত ছিল।", link: "https://news.un.org/en/story/2026/07/1167887" },
          { text: "প্রায় ৮০টি দেশে জাতিসংঘের শান্তি অভিযানে প্রায় ৪,৫০০ পুলিশ সদস্য বর্তমানে কর্মরত।", link: "https://news.un.org/en/story/2026/07/1167887" },
        ],
      },
    ],
  },
};

const GK_SAMPLE_FILLERS = {
  national: {
    en: [
      { heading: "Bangladesh Bank Reviews Monetary Policy", points: [{ text: "The central bank reviewed its latest monetary policy stance." }] },
      { heading: "New Skill-Development Programme Announced", points: [{ text: "A new programme was announced to support job-seekers nationwide." }] },
      { heading: "Parliament Reviews Public Service Bill", points: [{ text: "A standing committee reviewed the draft public service bill." }] },
    ],
    bn: [
      { heading: "বাংলাদেশ ব্যাংকের মুদ্রানীতি পর্যালোচনা", points: [{ text: "কেন্দ্রীয় ব্যাংক সর্বশেষ মুদ্রানীতি অবস্থান পর্যালোচনা করেছে।" }] },
      { heading: "নতুন দক্ষতা উন্নয়ন কর্মসূচি ঘোষণা", points: [{ text: "চাকরিপ্রার্থীদের জন্য সারাদেশে নতুন একটি কর্মসূচি ঘোষণা করা হয়েছে।" }] },
      { heading: "সংসদে সরকারি চাকরি বিল পর্যালোচনা", points: [{ text: "একটি স্থায়ী কমিটি খসড়া সরকারি চাকরি বিল পর্যালোচনা করেছে।" }] },
    ],
  },
  international: {
    en: [
      { heading: "Regional Trade Forum Discusses Tariffs", points: [{ text: "A regional trade forum discussed new tariff coordination measures." }] },
      { heading: "UN Agency Issues Food-Security Outlook", points: [{ text: "A UN agency issued its quarterly food-security outlook." }] },
      { heading: "Summit Concludes on Climate Financing", points: [{ text: "A multilateral summit concluded with a joint statement on climate financing." }] },
    ],
    bn: [
      { heading: "আঞ্চলিক বাণিজ্য ফোরামে শুল্ক আলোচনা", points: [{ text: "একটি আঞ্চলিক বাণিজ্য ফোরামে নতুন শুল্ক সমন্বয় ব্যবস্থা নিয়ে আলোচনা হয়েছে।" }] },
      { heading: "জাতিসংঘের খাদ্য নিরাপত্তা প্রতিবেদন", points: [{ text: "জাতিসংঘের একটি সংস্থা ত্রৈমাসিক খাদ্য নিরাপত্তা প্রতিবেদন প্রকাশ করেছে।" }] },
      { heading: "জলবায়ু অর্থায়ন নিয়ে সম্মেলন সমাপ্ত", points: [{ text: "একটি বহুপাক্ষিক সম্মেলন জলবায়ু অর্থায়ন নিয়ে যৌথ বিবৃতির মাধ্যমে শেষ হয়েছে।" }] },
    ],
  },
};

function GKScreen({ lang, savedGK, onToggleSaveGK }) {
  const [category, setCategory] = useState("national");
  const [expanded, setExpanded] = useState(0); // 0-6 = daysAgo expanded, "summary", or null
  const topics = GK_TOPICS[category][lang === "bn" ? "bn" : "en"];
  const fillers = GK_SAMPLE_FILLERS[category][lang === "bn" ? "bn" : "en"];

  const T = {
    en: {
      title: "General Knowledge",
      sub: "Job-exam-relevant facts, aggregated day by day from everyday newspapers. Tap a heading to see its points.",
      national: "National",
      international: "International",
      viewFull: "View full news",
      summary: "Weekly Summary",
      summaryNote: "The week's most important points in this category, in one place.",
      sampleTag: "Sample",
    },
    bn: {
      title: "সাধারণ জ্ঞান",
      sub: "চাকরির পরীক্ষার জন্য গুরুত্বপূর্ণ তথ্য, প্রতিদিনের পত্রিকা থেকে দিনভিত্তিক সংকলিত। শিরোনামে ট্যাপ করে পয়েন্টগুলো দেখুন।",
      national: "জাতীয়",
      international: "আন্তর্জাতিক",
      viewFull: "সম্পূর্ণ খবর দেখুন",
      summary: "সাপ্তাহিক সারসংক্ষেপ",
      summaryNote: "এই বিভাগের সপ্তাহের সবচেয়ে গুরুত্বপূর্ণ তথ্য, এক জায়গায়।",
      sampleTag: "নমুনা",
    },
  };
  const s = T[lang === "bn" ? "bn" : "en"];
  const todayRef = new Date();

  const days = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const realTopic = topics.find((tp) => tp.daysAgo === i);
    const isSampleDay = !realTopic;
    const topic = isSampleDay ? fillers[i % fillers.length] : realTopic;
    const points = topic.points.map((p, idx) => ({ ...p, isSample: isSampleDay, key: `${i}-${idx}` }));
    return {
      daysAgo: i,
      label: formatDayLabel(new Date(d), lang, new Date(todayRef)),
      heading: topic.heading,
      points,
    };
  });

  const summaryPoints = topics.flatMap((tp, ti) =>
    tp.points.map((p, idx) => ({ ...p, heading: tp.heading, key: `sum-${ti}-${idx}` }))
  );

  const renderPoints = (points, showHeadingInline) => (
    <ul className="gk-bullet-list">
      {points.map((it) => {
        const saveKey = `${category}-${it.key}`;
        const isSaved = !!savedGK[saveKey];
        return (
          <li className="gk-bullet-item" key={it.key}>
            <span className="gk-bullet-dot" />
            <div className="gk-bullet-body">
              <div className="gk-bullet-head">
                {showHeadingInline && <span className="gk-summary-heading">{it.heading}</span>}
                {it.isSample && <span className="gk-sample-tag">{s.sampleTag}</span>}
                <button
                  className={`gk-save-btn ${isSaved ? "saved" : ""}`}
                  onClick={() =>
                    onToggleSaveGK(saveKey, {
                      key: saveKey,
                      type: "gk",
                      category,
                      heading: it.heading || null,
                      text: it.text,
                      link: it.link,
                    })
                  }
                  aria-label="Save"
                >
                  <Bookmark size={13} strokeWidth={2} fill={isSaved ? "currentColor" : "none"} />
                </button>
              </div>
              <p className="gk-bullet-text">{it.text}</p>
              {it.link && (
                <a className="gk-view-link" href={it.link} target="_blank" rel="noopener noreferrer">
                  {s.viewFull} →
                </a>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );

  return (
    <div className="gk-screen">
      <h2 className="list-title">{s.title}</h2>
      <p className="timeline-sub">{s.sub}</p>

      <div className="gk-toggle-row">
        <button
          className={`gk-toggle-btn ${category === "national" ? "active" : ""}`}
          onClick={() => { setCategory("national"); setExpanded(0); }}
        >
          {s.national}
        </button>
        <button
          className={`gk-toggle-btn ${category === "international" ? "active" : ""}`}
          onClick={() => { setCategory("international"); setExpanded(0); }}
        >
          {s.international}
        </button>
      </div>

      <div className="gk-accordion">
        <div className="gk-acc-item">
          <button
            className={`gk-acc-header gk-acc-summary ${expanded === "summary" ? "open" : ""}`}
            onClick={() => setExpanded((e) => (e === "summary" ? null : "summary"))}
          >
            <span className="gk-acc-title">{s.summary}</span>
            <ChevronRight size={16} strokeWidth={2} className={`gk-acc-chevron ${expanded === "summary" ? "open" : ""}`} />
          </button>
          {expanded === "summary" && (
            <div className="gk-acc-body">
              <p className="list-sample-note">{s.summaryNote}</p>
              {renderPoints(summaryPoints, true)}
            </div>
          )}
        </div>

        {days.map((d) => (
          <div className="gk-acc-item" key={d.daysAgo}>
            <button
              className={`gk-acc-header ${expanded === d.daysAgo ? "open" : ""}`}
              onClick={() => setExpanded((e) => (e === d.daysAgo ? null : d.daysAgo))}
            >
              <div className="gk-acc-header-text">
                <span className="gk-acc-date">{d.label}</span>
                <span className="gk-acc-title">{d.heading}</span>
              </div>
              <ChevronRight size={16} strokeWidth={2} className={`gk-acc-chevron ${expanded === d.daysAgo ? "open" : ""}`} />
            </button>
            {expanded === d.daysAgo && <div className="gk-acc-body">{renderPoints(d.points, false)}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}


const JOB_LISTINGS = {
  government: {
    en: [
      {
        org: "Bangladesh Public Service Commission",
        jobs: [
          { title: "46th BCS — Various Cadre Posts", posted: "2026-07-10", deadline: "Aug 15, 2026", link: "#" },
          { title: "Non-Cadre Recruitment Exam Notice", posted: "2026-07-06", deadline: "Jul 31, 2026", link: "#" },
        ],
      },
      {
        org: "Bangladesh Bank",
        jobs: [
          { title: "Assistant Director", posted: "2026-07-09", deadline: "Jul 28, 2026", link: "#" },
          { title: "Deputy General Manager", posted: "2026-07-02", deadline: "Jul 20, 2026", link: "#" },
        ],
      },
      {
        org: "Sonali Bank PLC",
        jobs: [{ title: "Senior Officer (General)", posted: "2026-07-05", deadline: "Aug 3, 2026", link: "#" }],
      },
      {
        org: "Directorate of Primary Education",
        jobs: [{ title: "Assistant Teacher", posted: "2026-07-01", deadline: "Aug 10, 2026", link: "#" }],
      },
      {
        org: "Bangladesh Police",
        jobs: [{ title: "Sub-Inspector", posted: "2026-06-28", deadline: "Aug 20, 2026", link: "#" }],
      },
    ],
    bn: [
      {
        org: "বাংলাদেশ পাবলিক সার্ভিস কমিশন",
        jobs: [
          { title: "৪৬তম বিসিএস — বিভিন্ন ক্যাডার পদ", posted: "2026-07-10", deadline: "১৫ আগস্ট, ২০২৬", link: "#" },
          { title: "নন-ক্যাডার নিয়োগ পরীক্ষার বিজ্ঞপ্তি", posted: "2026-07-06", deadline: "৩১ জুলাই, ২০২৬", link: "#" },
        ],
      },
      {
        org: "বাংলাদেশ ব্যাংক",
        jobs: [
          { title: "সহকারী পরিচালক", posted: "2026-07-09", deadline: "২৮ জুলাই, ২০২৬", link: "#" },
          { title: "উপ-মহাব্যবস্থাপক", posted: "2026-07-02", deadline: "২০ জুলাই, ২০২৬", link: "#" },
        ],
      },
      {
        org: "সোনালী ব্যাংক পিএলসি",
        jobs: [{ title: "সিনিয়র অফিসার (জেনারেল)", posted: "2026-07-05", deadline: "৩ আগস্ট, ২০২৬", link: "#" }],
      },
      {
        org: "প্রাথমিক শিক্ষা অধিদপ্তর",
        jobs: [{ title: "সহকারী শিক্ষক", posted: "2026-07-01", deadline: "১০ আগস্ট, ২০২৬", link: "#" }],
      },
      {
        org: "বাংলাদেশ পুলিশ",
        jobs: [{ title: "উপ-পরিদর্শক", posted: "2026-06-28", deadline: "২০ আগস্ট, ২০২৬", link: "#" }],
      },
    ],
  },
  private: {
    en: [
      {
        org: "Grameenphone",
        jobs: [
          { title: "Business Analyst", posted: "2026-07-09", deadline: "Jul 30, 2026", link: "#" },
          { title: "Software Engineer", posted: "2026-07-06", deadline: "Aug 2, 2026", link: "#" },
        ],
      },
      {
        org: "BRAC Bank",
        jobs: [{ title: "Relationship Manager", posted: "2026-07-08", deadline: "Jul 25, 2026", link: "#" }],
      },
      {
        org: "Standard Chartered Bank",
        jobs: [{ title: "Management Trainee Officer", posted: "2026-07-04", deadline: "Aug 5, 2026", link: "#" }],
      },
      {
        org: "Robi Axiata",
        jobs: [{ title: "Marketing Executive", posted: "2026-07-03", deadline: "Aug 8, 2026", link: "#" }],
      },
      {
        org: "Unilever Bangladesh",
        jobs: [{ title: "Graduate Trainee", posted: "2026-06-30", deadline: "Aug 18, 2026", link: "#" }],
      },
    ],
    bn: [
      {
        org: "গ্রামীণফোন",
        jobs: [
          { title: "বিজনেস অ্যানালিস্ট", posted: "2026-07-09", deadline: "৩০ জুলাই, ২০২৬", link: "#" },
          { title: "সফটওয়্যার ইঞ্জিনিয়ার", posted: "2026-07-06", deadline: "২ আগস্ট, ২০২৬", link: "#" },
        ],
      },
      {
        org: "ব্র্যাক ব্যাংক",
        jobs: [{ title: "রিলেশনশিপ ম্যানেজার", posted: "2026-07-08", deadline: "২৫ জুলাই, ২০২৬", link: "#" }],
      },
      {
        org: "স্ট্যান্ডার্ড চার্টার্ড ব্যাংক",
        jobs: [{ title: "ম্যানেজমেন্ট ট্রেইনি অফিসার", posted: "2026-07-04", deadline: "৫ আগস্ট, ২০২৬", link: "#" }],
      },
      {
        org: "রবি আজিয়াটা",
        jobs: [{ title: "মার্কেটিং এক্সিকিউটিভ", posted: "2026-07-03", deadline: "৮ আগস্ট, ২০২৬", link: "#" }],
      },
      {
        org: "ইউনিলিভার বাংলাদেশ",
        jobs: [{ title: "গ্র্যাজুয়েট ট্রেইনি", posted: "2026-06-30", deadline: "১৮ আগস্ট, ২০২৬", link: "#" }],
      },
    ],
  },
};

function JobNewsScreen({ lang }) {
  const [category, setCategory] = useState("government");
  const [expandedOrg, setExpandedOrg] = useState(0);
  const orgsRaw = JOB_LISTINGS[category][lang === "bn" ? "bn" : "en"];

  // sort organizations so the one with the most recent posting comes first
  const orgs = [...orgsRaw].sort((a, b) => {
    const latestA = Math.max(...a.jobs.map((j) => new Date(j.posted).getTime()));
    const latestB = Math.max(...b.jobs.map((j) => new Date(j.posted).getTime()));
    return latestB - latestA;
  });

  const T = {
    en: {
      title: "Job News",
      sub: "Government and private-sector job circulars, grouped by organization — latest first.",
      government: "Government",
      private: "Private",
      deadline: "Deadline",
      posted: "Posted",
      viewCircular: "View circular",
      openings: (n) => `${n} opening${n > 1 ? "s" : ""}`,
      note: "Sample listings for this demo — a live build would aggregate real circulars from newspapers, job sites, LinkedIn, and BDJobs. Tapping a headline takes you straight to that source.",
    },
    bn: {
      title: "চাকরির খবর",
      sub: "সরকারি ও বেসরকারি চাকরির বিজ্ঞপ্তি, প্রতিষ্ঠান অনুযায়ী সাজানো — সর্বশেষটি সবার আগে।",
      government: "সরকারি",
      private: "বেসরকারি",
      deadline: "শেষ তারিখ",
      posted: "প্রকাশিত",
      viewCircular: "বিজ্ঞপ্তি দেখুন",
      openings: (n) => `${n}টি পদ`,
      note: "এই ডেমোর জন্য নমুনা তালিকা — বাস্তব সংস্করণে সংবাদপত্র, জব সাইট, লিংকডইন ও বিডি জবস থেকে সত্যিকারের বিজ্ঞপ্তি সংগ্রহ করা হবে। শিরোনামে ট্যাপ করলে সরাসরি মূল উৎসে যাবেন।",
    },
  };
  const s = T[lang === "bn" ? "bn" : "en"];

  return (
    <div className="job-screen">
      <h2 className="list-title">{s.title}</h2>
      <p className="timeline-sub">{s.sub}</p>

      <div className="gk-toggle-row">
        <button
          className={`gk-toggle-btn ${category === "government" ? "active" : ""}`}
          onClick={() => { setCategory("government"); setExpandedOrg(0); }}
        >
          {s.government}
        </button>
        <button
          className={`gk-toggle-btn ${category === "private" ? "active" : ""}`}
          onClick={() => { setCategory("private"); setExpandedOrg(0); }}
        >
          {s.private}
        </button>
      </div>

      <p className="list-sample-note">{s.note}</p>

      <div className="gk-accordion">
        {orgs.map((o, oi) => (
          <div className="gk-acc-item" key={o.org}>
            <button
              className={`gk-acc-header ${expandedOrg === oi ? "open" : ""}`}
              onClick={() => setExpandedOrg((e) => (e === oi ? null : oi))}
            >
              <div className="gk-acc-header-text">
                <span className="gk-acc-date">{s.openings(o.jobs.length)}</span>
                <span className="gk-acc-title">{o.org}</span>
              </div>
              <ChevronRight size={16} strokeWidth={2} className={`gk-acc-chevron ${expandedOrg === oi ? "open" : ""}`} />
            </button>
            {expandedOrg === oi && (
              <div className="gk-acc-body">
                <div className="job-list">
                  {o.jobs.map((j, ji) => (
                    <div className="job-card" key={ji}>
                      <span className="job-icon-box"><Briefcase size={18} strokeWidth={1.8} /></span>
                      <div className="job-card-body">
                        <a className="job-title" href={j.link} target="_blank" rel="noopener noreferrer">
                          {j.title}
                        </a>
                        <div className="job-card-foot">
                          <span className="job-deadline">{s.deadline}: {j.deadline}</span>
                          <a className="job-link" href={j.link} target="_blank" rel="noopener noreferrer">
                            {s.viewCircular} →
                          </a>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}


function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildVocabQuiz(count = 6) {
  const pool = [
    ...VOCAB_WORDS.map((w) => ({ term: w.word, meaning: w.meaning })),
    ...LINKING_WORDS.map((w) => ({ term: w.word, meaning: w.use })),
  ];
  const picked = shuffleArray(pool).slice(0, Math.min(count, pool.length));
  return picked.map((q, i) => {
    const distractorPool = pool.filter((p) => p.term !== q.term);
    const distractors = shuffleArray(distractorPool).slice(0, 3).map((d) => d.meaning);
    const options = shuffleArray([
      { text: q.meaning, correct: true },
      ...distractors.map((d) => ({ text: d, correct: false })),
    ]);
    return { id: `vq-${i}`, question: `What does "${q.term}" mean?`, options };
  });
}

const GK_QUIZ = {
  en: [
    {
      question: "Who was sworn in as Bangladesh's Prime Minister on 17 February 2026?",
      options: ["Tarique Rahman", "Muhammad Yunus", "Sheikh Hasina", "Mohammed Shahabuddin"],
      correct: 0,
    },
    {
      question: "Who served as Chief Adviser of Bangladesh's interim government from 2024 to 2026?",
      options: ["Muhammad Yunus", "Tarique Rahman", "Mohammed Shahabuddin", "Khaleda Zia"],
      correct: 0,
    },
    {
      question: "Who is the current UN Secretary-General?",
      options: ["António Guterres", "Amina Mohammed", "Ban Ki-moon", "Kofi Annan"],
      correct: 0,
    },
    {
      question: "Where was the UN's inaugural Global Dialogue on AI Governance held this July?",
      options: ["Geneva", "New York", "Vienna", "Nairobi"],
      correct: 0,
    },
    {
      question: "Which districts were hit hardest by monsoon flooding and landslides in Bangladesh this July?",
      options: ["Cox's Bazar, Bandarban, Chattogram", "Sylhet, Rangpur, Khulna", "Dhaka, Gazipur, Narayanganj", "Barisal, Bhola, Patuakhali"],
      correct: 0,
    },
    {
      question: "Who launched the UN's Sustainable Development Goals Report 2026?",
      options: ["Deputy Secretary-General Amina Mohammed", "Secretary-General António Guterres", "UNICEF Director Catherine Russell", "WHO Director Tedros Adhanom"],
      correct: 0,
    },
    {
      question: "What is the capital of Bangladesh?",
      options: ["Dhaka", "Chattogram", "Khulna", "Rajshahi"],
      correct: 0,
    },
    {
      question: "Which river is the longest in the world?",
      options: ["Nile", "Amazon", "Yangtze", "Mississippi"],
      correct: 0,
    },
    {
      question: "In which year did Bangladesh gain independence?",
      options: ["1971", "1947", "1952", "1969"],
      correct: 0,
    },
    {
      question: "What is the national flower of Bangladesh?",
      options: ["Water Lily (Shapla)", "Rose", "Lotus", "Marigold"],
      correct: 0,
    },
    {
      question: "Which is the largest ocean in the world?",
      options: ["Pacific Ocean", "Atlantic Ocean", "Indian Ocean", "Arctic Ocean"],
      correct: 0,
    },
    {
      question: "Who is known as the Father of the Nation of Bangladesh?",
      options: ["Sheikh Mujibur Rahman", "Ziaur Rahman", "Suhrawardy", "A. K. Fazlul Huq"],
      correct: 0,
    },
    {
      question: "What is the currency of Bangladesh?",
      options: ["Taka", "Rupee", "Dinar", "Ringgit"],
      correct: 0,
    },
    {
      question: "In which year was SAARC founded?",
      options: ["1985", "1971", "1990", "1980"],
      correct: 0,
    },
    {
      question: "Which is the largest continent by area?",
      options: ["Asia", "Africa", "Europe", "North America"],
      correct: 0,
    },
    {
      question: "What is the national sport of Bangladesh?",
      options: ["Kabaddi", "Cricket", "Football", "Hockey"],
      correct: 0,
    },
    {
      question: "In which year was the United Nations founded?",
      options: ["1945", "1919", "1950", "1939"],
      correct: 0,
    },
    {
      question: "Which is the smallest country in the world by area?",
      options: ["Vatican City", "Monaco", "Nauru", "San Marino"],
      correct: 0,
    },
    {
      question: "What is the national bird of Bangladesh?",
      options: ["Oriental Magpie-Robin (Doel)", "Peacock", "Kingfisher", "Sparrow"],
      correct: 0,
    },
    {
      question: "Which strait separates Asia and North America?",
      options: ["Bering Strait", "Strait of Malacca", "Strait of Hormuz", "Palk Strait"],
      correct: 0,
    },
    {
      question: "Which river flows beside Dhaka city?",
      options: ["Buriganga", "Padma", "Jamuna", "Surma"],
      correct: 0,
    },
    {
      question: "What is the national fruit of Bangladesh?",
      options: ["Jackfruit", "Mango", "Banana", "Papaya"],
      correct: 0,
    },
    {
      question: "Which is the highest mountain in the world?",
      options: ["Mount Everest", "K2", "Kangchenjunga", "Lhotse"],
      correct: 0,
    },
    {
      question: "Which organization is the global governing body for football?",
      options: ["FIFA", "IOC", "UEFA", "ICC"],
      correct: 0,
    },
    {
      question: "Who wrote Bangladesh's national anthem?",
      options: ["Rabindranath Tagore", "Kazi Nazrul Islam", "Jasimuddin", "Sufia Kamal"],
      correct: 0,
    },
  ],
  bn: [
    {
      question: "১৭ ফেব্রুয়ারি ২০২৬-এ কে বাংলাদেশের প্রধানমন্ত্রী হিসেবে শপথ নেন?",
      options: ["তারেক রহমান", "মুহাম্মদ ইউনূস", "শেখ হাসিনা", "মোহাম্মদ শাহাবুদ্দিন"],
      correct: 0,
    },
    {
      question: "২০২৪ থেকে ২০২৬ সাল পর্যন্ত বাংলাদেশের অন্তর্বর্তী সরকারের প্রধান উপদেষ্টা কে ছিলেন?",
      options: ["মুহাম্মদ ইউনূস", "তারেক রহমান", "মোহাম্মদ শাহাবুদ্দিন", "খালেদা জিয়া"],
      correct: 0,
    },
    {
      question: "জাতিসংঘের বর্তমান মহাসচিব কে?",
      options: ["আন্তোনিও গুতেরেস", "আমিনা মোহাম্মদ", "বান কি মুন", "কফি আনান"],
      correct: 0,
    },
    {
      question: "এই জুলাইয়ে জাতিসংঘের প্রথম গ্লোবাল ডায়ালগ অন এআই গভর্নেন্স কোথায় অনুষ্ঠিত হয়?",
      options: ["জেনেভা", "নিউইয়র্ক", "ভিয়েনা", "নাইরোবি"],
      correct: 0,
    },
    {
      question: "এই জুলাইয়ে বর্ষার বন্যা ও ভূমিধসে বাংলাদেশের কোন জেলাগুলো সবচেয়ে বেশি ক্ষতিগ্রস্ত হয়?",
      options: ["কক্সবাজার, বান্দরবান, চট্টগ্রাম", "সিলেট, রংপুর, খুলনা", "ঢাকা, গাজীপুর, নারায়ণগঞ্জ", "বরিশাল, ভোলা, পটুয়াখালী"],
      correct: 0,
    },
    {
      question: "জাতিসংঘের সাসটেইনেবল ডেভেলপমেন্ট গোলস রিপোর্ট ২০২৬ কে উন্মোচন করেন?",
      options: ["উপ-মহাসচিব আমিনা মোহাম্মদ", "মহাসচিব আন্তোনিও গুতেরেস", "ইউনিসেফ পরিচালক ক্যাথরিন রাসেল", "হু পরিচালক টেড্রোস আধানম"],
      correct: 0,
    },
    {
      question: "বাংলাদেশের রাজধানী কোনটি?",
      options: ["ঢাকা", "চট্টগ্রাম", "খুলনা", "রাজশাহী"],
      correct: 0,
    },
    {
      question: "বিশ্বের দীর্ঘতম নদী কোনটি?",
      options: ["নীল নদ", "আমাজন", "ইয়াংজি", "মিসিসিপি"],
      correct: 0,
    },
    {
      question: "বাংলাদেশ কোন সালে স্বাধীনতা লাভ করে?",
      options: ["১৯৭১", "১৯৪৭", "১৯৫২", "১৯৬৯"],
      correct: 0,
    },
    {
      question: "বাংলাদেশের জাতীয় ফুল কোনটি?",
      options: ["শাপলা", "গোলাপ", "পদ্ম", "গাঁদা"],
      correct: 0,
    },
    {
      question: "বিশ্বের বৃহত্তম মহাসাগর কোনটি?",
      options: ["প্রশান্ত মহাসাগর", "আটলান্টিক মহাসাগর", "ভারত মহাসাগর", "সুমেরু মহাসাগর"],
      correct: 0,
    },
    {
      question: "বাংলাদেশের জাতির জনক কাকে বলা হয়?",
      options: ["শেখ মুজিবুর রহমান", "জিয়াউর রহমান", "সোহরাওয়ার্দী", "এ কে ফজলুল হক"],
      correct: 0,
    },
    {
      question: "বাংলাদেশের মুদ্রার নাম কী?",
      options: ["টাকা", "রুপি", "দিনার", "রিঙ্গিত"],
      correct: 0,
    },
    {
      question: "সার্ক কোন সালে প্রতিষ্ঠিত হয়?",
      options: ["১৯৮৫", "১৯৭১", "১৯৯০", "১৯৮০"],
      correct: 0,
    },
    {
      question: "আয়তনে বিশ্বের বৃহত্তম মহাদেশ কোনটি?",
      options: ["এশিয়া", "আফ্রিকা", "ইউরোপ", "উত্তর আমেরিকা"],
      correct: 0,
    },
    {
      question: "বাংলাদেশের জাতীয় খেলা কী?",
      options: ["কাবাডি", "ক্রিকেট", "ফুটবল", "হকি"],
      correct: 0,
    },
    {
      question: "জাতিসংঘ কোন সালে প্রতিষ্ঠিত হয়?",
      options: ["১৯৪৫", "১৯১৯", "১৯৫০", "১৯৩৯"],
      correct: 0,
    },
    {
      question: "আয়তনে বিশ্বের ক্ষুদ্রতম দেশ কোনটি?",
      options: ["ভ্যাটিকান সিটি", "মোনাকো", "নাউরু", "সান মারিনো"],
      correct: 0,
    },
    {
      question: "বাংলাদেশের জাতীয় পাখি কোনটি?",
      options: ["দোয়েল", "ময়ূর", "মাছরাঙা", "চড়ুই"],
      correct: 0,
    },
    {
      question: "এশিয়া ও উত্তর আমেরিকার মধ্যবর্তী প্রণালীর নাম কী?",
      options: ["বেরিং প্রণালী", "মালাক্কা প্রণালী", "হরমুজ প্রণালী", "পক প্রণালী"],
      correct: 0,
    },
    {
      question: "ঢাকা শহরের পাশ দিয়ে কোন নদী প্রবাহিত?",
      options: ["বুড়িগঙ্গা", "পদ্মা", "যমুনা", "সুরমা"],
      correct: 0,
    },
    {
      question: "বাংলাদেশের জাতীয় ফল কোনটি?",
      options: ["কাঁঠাল", "আম", "কলা", "পেঁপে"],
      correct: 0,
    },
    {
      question: "বিশ্বের সর্বোচ্চ পর্বতশৃঙ্গ কোনটি?",
      options: ["মাউন্ট এভারেস্ট", "কে২", "কাঞ্চনজঙ্ঘা", "লোৎসে"],
      correct: 0,
    },
    {
      question: "ফুটবলের বৈশ্বিক নিয়ন্ত্রক সংস্থা কোনটি?",
      options: ["ফিফা", "আইওসি", "উয়েফা", "আইসিসি"],
      correct: 0,
    },
    {
      question: "বাংলাদেশের জাতীয় সংগীত কে রচনা করেন?",
      options: ["রবীন্দ্রনাথ ঠাকুর", "কাজী নজরুল ইসলাম", "জসীমউদ্দীন", "সুফিয়া কামাল"],
      correct: 0,
    },
  ],
};

function buildGKQuiz(lang, count = 6) {
  const raw = shuffleArray(GK_QUIZ[lang === "bn" ? "bn" : "en"]).slice(0, count);
  return raw.map((q, i) => {
    const options = shuffleArray(
      q.options.map((text, idx) => ({ text, correct: idx === q.correct }))
    );
    return { id: `gq-${i}`, question: q.question, options };
  });
}

function buildSavedVocabQuiz(savedVocabMap, count = 6) {
  const pool = Object.values(savedVocabMap || {});
  if (pool.length === 0) return [];
  const openPool = [
    ...VOCAB_WORDS.map((w) => ({ term: w.word, meaning: w.meaning })),
    ...LINKING_WORDS.map((w) => ({ term: w.word, meaning: w.use })),
  ];
  const picked = shuffleArray(pool).slice(0, Math.min(count, pool.length));
  return picked.map((q, i) => {
    const distractorPool = openPool.filter((p) => p.term !== q.word);
    const distractors = shuffleArray(distractorPool).slice(0, 3).map((d) => d.meaning);
    const options = shuffleArray([
      { text: q.meaning, correct: true },
      ...distractors.map((d) => ({ text: d, correct: false })),
    ]);
    return { id: `svq-${i}`, question: `What does "${q.word}" mean?`, options };
  });
}

// Saved GK bullets are prose facts, not pre-authored MCQs, so this asks Claude to turn
// each saved fact into a question + 4 options (1 correct, 3 distractors), same batching
// pattern already used elsewhere in the app for headline rewriting/classification.
async function generateMCQFromFacts(facts, lang) {
  if (facts.length === 0) return [];
  const langName = lang === "bn" ? "Bengali" : "English";
  const prompt =
    `Create a multiple-choice quiz in ${langName} from these ${facts.length} general-knowledge facts. ` +
    `For each fact, write ONE clear question whose answer is a key detail from that fact, plus 4 answer options ` +
    `(1 correct option matching the fact, 3 plausible but incorrect distractors), all in ${langName}, options in random order. ` +
    `Respond with ONLY a JSON array of ${facts.length} objects shaped like ` +
    `{"question": "...", "options": ["...","...","...","..."], "correct": 0} where "correct" is the 0-3 index of the ` +
    `correct option. No other text, no markdown fences.\n\nFacts:\n` +
    JSON.stringify(facts.map((f) => f.text));
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1500,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    const data = await res.json();
    const raw = (data.content || []).map((c) => c.text || "").join("");
    const clean = raw.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean);
    if (Array.isArray(parsed) && parsed.length === facts.length) {
      return parsed
        .map((p, i) => ({
          id: `sgq-${i}`,
          question: p.question,
          options: (p.options || []).map((text, idx) => ({ text, correct: idx === p.correct })),
        }))
        .filter((q) => q.options.length === 4 && q.options.some((o) => o.correct));
    }
    return [];
  } catch {
    return [];
  }
}

async function buildSavedGKQuiz(savedGKMap, lang, count = 6) {
  const pool = Object.values(savedGKMap || {});
  if (pool.length === 0) return [];
  const picked = shuffleArray(pool).slice(0, Math.min(count, pool.length));
  return generateMCQFromFacts(picked, lang);
}

const EXAM_LENGTHS = [
  { id: "short", questions: 10, minutes: 6 },
  { id: "long", questions: 25, minutes: 15 },
];

function formatTime(totalSeconds) {
  const m = Math.floor(totalSeconds / 60);
  const sec = totalSeconds % 60;
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

function QuizRunner({ buildQuestions, lang, onComplete, poolSize, emptyMessage }) {
  const [lengthId, setLengthId] = useState("short");
  const [started, setStarted] = useState(false);
  const [questions, setQuestions] = useState([]);
  const [qIndex, setQIndex] = useState(0);
  const [answers, setAnswers] = useState({}); // qIndex -> option object
  const [submitted, setSubmitted] = useState(false);
  const [timeLeft, setTimeLeft] = useState(EXAM_LENGTHS[0].minutes * 60);
  const [runId, setRunId] = useState(0);
  const [building, setBuilding] = useState(false);
  const [buildFailed, setBuildFailed] = useState(false);
  const reportedRef = useRef(false);
  const selectedLength = EXAM_LENGTHS.find((l) => l.id === lengthId);

  const T = {
    en: {
      qOf: (a, b) => `Question ${a} of ${b}`,
      prev: "Previous",
      next: "Next",
      submit: "Submit Exam",
      retake: "Retake Quiz",
      scoreTitle: "Exam Submitted!",
      scoreLine: (s2, t2) => `You scored ${s2} out of ${t2}`,
      answered: (a, b) => `${a} of ${b} answered`,
      review: "Review Answers",
      yourAnswer: "Your answer",
      correctAnswer: "Correct answer",
      unanswered: "Not answered",
      start: "Start Exam",
      readyTitle: "Choose your exam",
      readySub: "Pick a format, then start when you're ready.",
      questionsLabel: (n) => `${n} Questions`,
      minutesLabel: (n) => `${n} min`,
      generating: "Preparing your exam…",
      buildFailed: "Couldn't generate this exam right now — try again.",
      tryAgain: "Try Again",
    },
    bn: {
      qOf: (a, b) => `প্রশ্ন ${a} / ${b}`,
      prev: "পূর্ববর্তী",
      next: "পরবর্তী",
      submit: "পরীক্ষা জমা দিন",
      retake: "আবার দিন",
      scoreTitle: "পরীক্ষা জমা হয়েছে!",
      scoreLine: (s2, t2) => `আপনি ${t2}-এর মধ্যে ${s2} পেয়েছেন`,
      answered: (a, b) => `${b}টির মধ্যে ${a}টি উত্তর দেওয়া হয়েছে`,
      review: "উত্তর পর্যালোচনা করুন",
      yourAnswer: "আপনার উত্তর",
      correctAnswer: "সঠিক উত্তর",
      unanswered: "উত্তর দেওয়া হয়নি",
      start: "পরীক্ষা শুরু করুন",
      readyTitle: "আপনার পরীক্ষা বেছে নিন",
      readySub: "একটি ফরম্যাট বেছে নিন, তারপর প্রস্তুত হলে শুরু করুন।",
      questionsLabel: (n) => `${n}টি প্রশ্ন`,
      minutesLabel: (n) => `${n} মিনিট`,
      generating: "আপনার পরীক্ষা প্রস্তুত হচ্ছে…",
      buildFailed: "এই মুহূর্তে পরীক্ষা তৈরি করা যায়নি — আবার চেষ্টা করুন।",
      tryAgain: "আবার চেষ্টা করুন",
    },
  };
  const s = T[lang === "bn" ? "bn" : "en"];

  const submitExam = useCallback(() => {
    setSubmitted(true);
  }, []);

  useEffect(() => {
    if (!started || submitted || questions.length === 0) return;
    if (timeLeft <= 0) {
      submitExam();
      return;
    }
    const t = setTimeout(() => setTimeLeft((sec) => sec - 1), 1000);
    return () => clearTimeout(t);
  }, [started, timeLeft, submitted, questions.length, submitExam]);

  const handleStart = async () => {
    setBuilding(true);
    setBuildFailed(false);
    const built = await Promise.resolve(buildQuestions(selectedLength.questions));
    setBuilding(false);
    if (!built || built.length === 0) {
      setBuildFailed(true);
      return;
    }
    setQuestions(built);
    setTimeLeft(selectedLength.minutes * 60);
    setStarted(true);
  };

  if (typeof poolSize === "number" && poolSize === 0) {
    return (
      <div className="quiz-runner">
        <div className="quiz-start-box">
          <span className="quiz-start-icon"><Bookmark size={26} strokeWidth={1.8} /></span>
          <p className="vocab-lock-sub">{emptyMessage}</p>
        </div>
      </div>
    );
  }

  if (!started) {
    return (
      <div className="quiz-runner" key={runId}>
        <div className="quiz-start-box">
          <span className="quiz-start-icon"><ClipboardCheck size={26} strokeWidth={1.8} /></span>
          <h3 className="quiz-start-title">{s.readyTitle}</h3>
          <p className="quiz-start-sub">{s.readySub}</p>

          <div className="exam-length-options">
            {EXAM_LENGTHS.map((l) => (
              <button
                key={l.id}
                className={`exam-length-card ${lengthId === l.id ? "active" : ""}`}
                onClick={() => setLengthId(l.id)}
              >
                <span className="exam-length-q">{s.questionsLabel(l.questions)}</span>
                <span className="exam-length-t">
                  <Clock3 size={12} strokeWidth={2} /> {s.minutesLabel(l.minutes)}
                </span>
              </button>
            ))}
          </div>

          {buildFailed && <p className="quiz-build-error">{s.buildFailed}</p>}

          <button className="quiz-next-btn quiz-start-btn" onClick={handleStart} disabled={building}>
            {building ? s.generating : buildFailed ? s.tryAgain : s.start}
          </button>
        </div>
      </div>
    );
  }

  const answeredCount = Object.keys(answers).length;
  const score = questions.reduce((sum, q, i) => sum + (answers[i]?.correct ? 1 : 0), 0);

  if (submitted) {
    const pct = Math.round((score / questions.length) * 100);
    if (!reportedRef.current) {
      reportedRef.current = true;
      onComplete?.({ score, total: questions.length });
    }
    return (
      <div className="quiz-result">
        <span className="quiz-result-icon"><Award size={30} strokeWidth={1.8} color="#fff" /></span>
        <h3 className="quiz-result-title">{s.scoreTitle}</h3>
        <p className="quiz-result-score">{s.scoreLine(score, questions.length)}</p>
        <div className="quiz-result-bar"><div className="quiz-result-bar-fill" style={{ width: `${pct}%` }} /></div>

        <div className="quiz-review">
          <span className="vocab-section-label">{s.review}</span>
          {questions.map((q, i) => {
            const picked = answers[i];
            const correctOpt = q.options.find((o) => o.correct);
            return (
              <div className="quiz-review-item" key={q.id}>
                <p className="quiz-review-q">{i + 1}. {q.question}</p>
                {picked ? (
                  <p className={`quiz-review-a ${picked.correct ? "correct" : "wrong"}`}>
                    {s.yourAnswer}: {picked.text}
                  </p>
                ) : (
                  <p className="quiz-review-a wrong">{s.unanswered}</p>
                )}
                {(!picked || !picked.correct) && (
                  <p className="quiz-review-a correct">{s.correctAnswer}: {correctOpt.text}</p>
                )}
              </div>
            );
          })}
        </div>

        <button
          className="quiz-retake-btn"
          onClick={() => {
            setStarted(false);
            setQuestions([]);
            setQIndex(0);
            setAnswers({});
            setSubmitted(false);
            setRunId((r) => r + 1);
            reportedRef.current = false;
          }}
        >
          <RotateCcw size={15} strokeWidth={2} /> {s.retake}
        </button>
      </div>
    );
  }

  const q = questions[qIndex];
  const isLast = qIndex === questions.length - 1;
  const currentAnswer = answers[qIndex];
  const lowTime = timeLeft <= 30;

  return (
    <div className="quiz-runner" key={runId}>
      <div className="quiz-top-row">
        <span className="quiz-q-count">{s.qOf(qIndex + 1, questions.length)}</span>
        <span className={`quiz-timer ${lowTime ? "low" : ""}`}>
          <Clock3 size={13} strokeWidth={2} /> {formatTime(timeLeft)}
        </span>
      </div>

      <div className="quiz-dot-row">
        {questions.map((_, i) => (
          <button
            key={i}
            className={`quiz-dot ${i === qIndex ? "active" : ""} ${answers[i] ? "answered" : ""}`}
            onClick={() => setQIndex(i)}
          >
            {i + 1}
          </button>
        ))}
      </div>

      <h3 className="quiz-question">{q.question}</h3>
      <div className="quiz-options">
        {q.options.map((opt, i) => (
          <button
            key={i}
            className={`quiz-opt ${currentAnswer === opt ? "picked" : ""}`}
            onClick={() => setAnswers((a) => ({ ...a, [qIndex]: opt }))}
          >
            {opt.text}
          </button>
        ))}
      </div>

      <span className="quiz-answered-count">{s.answered(answeredCount, questions.length)}</span>

      <div className="quiz-nav-row">
        <button className="quiz-prev-btn" disabled={qIndex === 0} onClick={() => setQIndex((i) => Math.max(0, i - 1))}>
          <ChevronLeft size={16} strokeWidth={2} /> {s.prev}
        </button>
        {isLast ? (
          <button className="quiz-next-btn quiz-submit-btn" onClick={submitExam}>
            {s.submit}
          </button>
        ) : (
          <button className="quiz-next-btn" onClick={() => setQIndex((i) => Math.min(questions.length - 1, i + 1))}>
            {s.next} <ChevronRight size={16} strokeWidth={2} />
          </button>
        )}
      </div>
    </div>
  );
}

function TestHistoryPanel({ lang, testHistory }) {
  const [filter, setFilter] = useState("vocab");

  const T = {
    en: {
      empty: "No tests taken yet — complete a quiz to see your history and analysis here.",
      emptyType: "No tests taken in this category yet.",
      analysis: "Analysis",
      totalTests: "Tests taken",
      avgScore: "Average score",
      bestScore: "Best score",
      recentTests: "Test History",
      vocab: "Vocabulary",
      gk: "General Knowledge",
    },
    bn: {
      empty: "এখনো কোনো পরীক্ষা দেওয়া হয়নি — একটি কুইজ সম্পন্ন করলে এখানে আপনার ইতিহাস ও বিশ্লেষণ দেখাবে।",
      emptyType: "এই বিভাগে এখনো কোনো পরীক্ষা দেওয়া হয়নি।",
      analysis: "বিশ্লেষণ",
      totalTests: "মোট পরীক্ষা",
      avgScore: "গড় স্কোর",
      bestScore: "সর্বোচ্চ স্কোর",
      recentTests: "পরীক্ষার ইতিহাস",
      vocab: "শব্দভাণ্ডার",
      gk: "সাধারণ জ্ঞান",
    },
  };
  const s = T[lang === "bn" ? "bn" : "en"];

  if (!testHistory || testHistory.length === 0) {
    return <p className="profile-empty-note">{s.empty}</p>;
  }

  const pctOf = (r) => Math.round((r.score / r.total) * 100);
  const runs = testHistory.filter((r) => r.type === filter);
  const avg = runs.length ? Math.round(runs.reduce((sum, r) => sum + pctOf(r), 0) / runs.length) : null;
  const best = runs.length ? Math.max(...runs.map(pctOf)) : null;

  return (
    <div className="test-history">
      <div className="gk-toggle-row">
        <button className={`gk-toggle-btn ${filter === "vocab" ? "active" : ""}`} onClick={() => setFilter("vocab")}>
          {s.vocab}
        </button>
        <button className={`gk-toggle-btn ${filter === "gk" ? "active" : ""}`} onClick={() => setFilter("gk")}>
          {s.gk}
        </button>
      </div>

      {runs.length === 0 ? (
        <p className="profile-empty-note">{s.emptyType}</p>
      ) : (
        <>
          <span className="vocab-section-label">{s.analysis}</span>
          <div className="stat-grid">
            <div className="stat-card">
              <span className="stat-value">{runs.length}</span>
              <span className="stat-label">{s.totalTests}</span>
            </div>
            <div className="stat-card">
              <span className="stat-value">{avg}%</span>
              <span className="stat-label">{s.avgScore}</span>
            </div>
            <div className="stat-card stat-card-wide">
              <span className="stat-value">{best}%</span>
              <span className="stat-label">{s.bestScore}</span>
            </div>
          </div>

          <span className="vocab-section-label">{s.recentTests}</span>
          <div className="test-history-list">
            {runs.map((r) => {
              const pct = pctOf(r);
              const dateLabel = new Date(r.date).toLocaleString(lang === "bn" ? "bn-BD" : "en-US", {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              });
              return (
                <div className="test-history-row" key={r.id}>
                  <span className={`test-history-icon ${r.type}`}>
                    {r.type === "vocab" ? <Languages size={16} strokeWidth={2} /> : <Compass size={16} strokeWidth={2} />}
                  </span>
                  <div className="test-history-body">
                    <span className="test-history-type">{r.type === "vocab" ? s.vocab : s.gk}</span>
                    <span className="test-history-date">{dateLabel}</span>
                  </div>
                  <span className={`test-history-pct ${pct >= 70 ? "good" : pct >= 40 ? "mid" : "low"}`}>
                    {r.score}/{r.total} · {pct}%
                  </span>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function ExamScreen({ lang, onSwitchLang, embedded, testHistory, onAddTestResult, savedVocab, savedGK }) {
  const [resourceMode, setResourceMode] = useState("open"); // saved | open | history
  const [contentType, setContentType] = useState("vocab"); // vocab | gk

  const T = {
    en: {
      title: "Take Part in Exam",
      sub: "Quick multiple-choice quizzes built from your Vocabulary and GK content.",
      savedTab: "Exam on Saved Resources",
      openTab: "Exam on Open Resources",
      historyTab: "Test History",
      vocabTab: "Vocabulary",
      gkTab: "GK",
      noSavedVocab: "You haven't saved any Vocabulary words yet. Bookmark some from the Vocabulary tab first.",
      noSavedGK: "You haven't saved any General Knowledge points yet. Bookmark some from the GK tab first.",
    },
    bn: {
      title: "পরীক্ষায় অংশ নিন",
      sub: "আপনার শব্দভাণ্ডার ও জিকে কনটেন্ট থেকে তৈরি সংক্ষিপ্ত এমসিকিউ কুইজ।",
      savedTab: "সংরক্ষিত রিসোর্স থেকে পরীক্ষা",
      openTab: "সব রিসোর্স থেকে পরীক্ষা",
      historyTab: "পরীক্ষার ইতিহাস",
      vocabTab: "শব্দভাণ্ডার",
      gkTab: "জিকে",
      noSavedVocab: "এখনো কোনো শব্দ সংরক্ষণ করেননি। প্রথমে Vocabulary ট্যাব থেকে কিছু বুকমার্ক করুন।",
      noSavedGK: "এখনো কোনো জিকে পয়েন্ট সংরক্ষণ করেননি। প্রথমে GK ট্যাব থেকে কিছু বুকমার্ক করুন।",
    },
  };
  const s = T[lang === "bn" ? "bn" : "en"];

  const reportResult = (type) => (result) => {
    onAddTestResult?.({
      id: `t-${Date.now()}`,
      type,
      score: result.score,
      total: result.total,
      date: new Date().toISOString(),
    });
  };

  const savedVocabCount = Object.keys(savedVocab || {}).length;
  const savedGKCount = Object.keys(savedGK || {}).length;
  const openGKCount = GK_QUIZ[lang === "bn" ? "bn" : "en"].length;
  const openVocabCount = VOCAB_WORDS.length + LINKING_WORDS.length;

  const isSaved = resourceMode === "saved";
  const buildQuestionsFn =
    contentType === "vocab"
      ? isSaved
        ? (count) => buildSavedVocabQuiz(savedVocab, count)
        : buildVocabQuiz
      : isSaved
      ? (count) => buildSavedGKQuiz(savedGK, lang, count)
      : (count) => buildGKQuiz(lang, count);

  const poolSize = contentType === "vocab" ? (isSaved ? savedVocabCount : openVocabCount) : isSaved ? savedGKCount : openGKCount;
  const emptyMessage = contentType === "vocab" ? s.noSavedVocab : s.noSavedGK;

  return (
    <div className={embedded ? "exam-embedded" : "exam-screen"}>
      {!embedded && (
        <>
          <h2 className="list-title">{s.title}</h2>
          <p className="timeline-sub">{s.sub}</p>
        </>
      )}

      <div className="gk-toggle-row exam-toggle-row">
        <button className={`gk-toggle-btn ${resourceMode === "saved" ? "active" : ""}`} onClick={() => setResourceMode("saved")}>
          {s.savedTab}
        </button>
        <button className={`gk-toggle-btn ${resourceMode === "open" ? "active" : ""}`} onClick={() => setResourceMode("open")}>
          {s.openTab}
        </button>
        <button className={`gk-toggle-btn ${resourceMode === "history" ? "active" : ""}`} onClick={() => setResourceMode("history")}>
          {s.historyTab}
        </button>
      </div>

      {resourceMode !== "history" && (
        <>
          <div className="gk-toggle-row exam-content-toggle">
            <button className={`gk-toggle-btn ${contentType === "vocab" ? "active" : ""}`} onClick={() => setContentType("vocab")}>
              {s.vocabTab}
            </button>
            <button className={`gk-toggle-btn ${contentType === "gk" ? "active" : ""}`} onClick={() => setContentType("gk")}>
              {s.gkTab}
            </button>
          </div>

          {contentType === "vocab" && lang !== "en" ? (
            <div className="vocab-locked-screen quiz-locked-inline">
              <span className="vocab-lock-icon"><Lock size={26} strokeWidth={1.8} /></span>
              <span className="vocab-lock-title">Vocabulary quiz is available in English mode</span>
              <p className="vocab-lock-sub">Switch to English to test yourself on today's words.</p>
              <button className="vocab-switch-btn" onClick={onSwitchLang}>Switch to English</button>
            </div>
          ) : (
            <QuizRunner
              key={`${resourceMode}-${contentType}`}
              buildQuestions={buildQuestionsFn}
              lang={lang}
              onComplete={reportResult(contentType)}
              poolSize={poolSize}
              emptyMessage={emptyMessage}
            />
          )}
        </>
      )}

      {resourceMode === "history" && <TestHistoryPanel lang={lang} testHistory={testHistory} />}
    </div>
  );
}


const PAUSE_DURATIONS = [
  { id: "30m", ms: 30 * 60 * 1000, en: "30 min", bn: "৩০ মিনিট" },
  { id: "1h", ms: 60 * 60 * 1000, en: "1 hour", bn: "১ ঘণ্টা" },
  { id: "2h", ms: 2 * 60 * 60 * 1000, en: "2 hours", bn: "২ ঘণ্টা" },
  { id: "4h", ms: 4 * 60 * 60 * 1000, en: "4 hours", bn: "৪ ঘণ্টা" },
  { id: "8h", ms: 8 * 60 * 60 * 1000, en: "8 hours", bn: "৮ ঘণ্টা" },
  { id: "tomorrow", ms: null, en: "Until tomorrow", bn: "আগামীকাল পর্যন্ত" },
];

function formatCountdown(ms) {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const sec = totalSec % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}

function SettingsDropdown({ options, value, onChange, anchorClass }) {
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.id === value) || options[0];
  return (
    <div className={`opt-dropdown-wrap ${anchorClass || ""}`}>
      <button className="opt-value-btn" onClick={() => setOpen((v) => !v)}>
        {current.label} <ChevronDown size={14} strokeWidth={2} />
      </button>
      {open && (
        <div className="opt-dropdown-menu">
          {options.map((o) => (
            <button
              key={o.id}
              className={`opt-dropdown-item ${o.id === value ? "active" : ""}`}
              onClick={() => { onChange(o.id); setOpen(false); }}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function OptToggleSwitch({ on, onClick }) {
  return (
    <button className={`opt-switch ${on ? "on" : ""}`} onClick={onClick}>
      <span className="opt-switch-knob" />
    </button>
  );
}

function SettingsScreen({
  lang,
  onSwitchLang,
  initialExpanded,
  notificationsOn,
  onSetNotificationsOn,
  pausedUntil,
  onSetPausedUntil,
  nowTick,
  newsPreferences,
  onSetNewsPreferences,
  hdImages,
  onSetHdImages,
  nightMode,
  onSetNightMode,
  autoPlay,
  onSetAutoPlay,
  textSize,
  onSetTextSize,
  onShareApp,
}) {
  const [expandedRow, setExpandedRow] = useState(initialExpanded || null); // 'notifications' | 'preferences' | null

  const T = {
    en: {
      language: "Language",
      english: "English",
      bengali: "বাংলা",
      notifications: "Notifications",
      on: "On",
      off: "Off",
      pauseNotif: "Pause Notifications",
      pauseSub: "Temporarily stop notifications for a set time — they'll turn back on automatically after.",
      pausedLine: (t2) => `Paused — resumes in ${t2}`,
      resumeNow: "Resume Now",
      yourPrefs: "Your Preferences",
      yourPrefsSub: "Tell us what you'd like to see more or less of.",
      all: "All",
      interested: "Interested",
      notInterested: "Not Interested",
      hdImages: "HD Images",
      nightMode: "Night Mode",
      nightModeSub: "For better readability at night",
      autoplay: "Autoplay",
      autoPlayOn: "On",
      autoPlayOff: "Off",
      autoPlayWifi: "Wi-Fi Only",
      textSize: "Text Size",
      textSizeDefault: "Default",
      textSizeLarge: "Large",
      shareApp: "Share this app",
    },
    bn: {
      language: "ভাষা",
      english: "English",
      bengali: "বাংলা",
      notifications: "নোটিফিকেশন",
      on: "চালু",
      off: "বন্ধ",
      pauseNotif: "নোটিফিকেশন পজ করুন",
      pauseSub: "নির্দিষ্ট সময়ের জন্য নোটিফিকেশন সাময়িকভাবে বন্ধ রাখুন — এরপর এগুলো স্বয়ংক্রিয়ভাবে চালু হয়ে যাবে।",
      pausedLine: (t2) => `পজ করা আছে — ${t2} পরে আবার চালু হবে`,
      resumeNow: "এখনই চালু করুন",
      yourPrefs: "আপনার পছন্দ",
      yourPrefsSub: "আপনি কী বেশি বা কম দেখতে চান আমাদের জানান।",
      all: "সব",
      interested: "আগ্রহী",
      notInterested: "অনাগ্রহী",
      hdImages: "এইচডি ছবি",
      nightMode: "নাইট মোড",
      nightModeSub: "রাতে আরও ভালো পড়ার জন্য",
      autoplay: "অটোপ্লে",
      autoPlayOn: "চালু",
      autoPlayOff: "বন্ধ",
      autoPlayWifi: "শুধু ওয়াইফাই",
      textSize: "টেক্সট সাইজ",
      textSizeDefault: "ডিফল্ট",
      textSizeLarge: "বড়",
      shareApp: "অ্যাপটি শেয়ার করুন",
    },
  };
  const s = T[lang === "bn" ? "bn" : "en"];

  const languageOptions = [
    { id: "en", label: s.english },
    { id: "bn", label: s.bengali },
  ];
  const autoplayOptions = [
    { id: "on", label: s.autoPlayOn },
    { id: "off", label: s.autoPlayOff },
    { id: "wifi", label: s.autoPlayWifi },
  ];
  const textSizeOptions = [
    { id: "default", label: s.textSizeDefault },
    { id: "large", label: s.textSizeLarge },
  ];

  const startPause = (duration) => {
    let ms = duration.ms;
    if (duration.id === "tomorrow") {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(7, 0, 0, 0);
      ms = tomorrow.getTime() - Date.now();
    }
    onSetPausedUntil(Date.now() + ms);
  };

  const isPaused = !!pausedUntil && pausedUntil > nowTick;
  const remainingMs = isPaused ? pausedUntil - nowTick : 0;

  const setCategoryPref = (catId, value) => {
    onSetNewsPreferences((prev) => ({ ...prev, [catId]: value }));
  };

  return (
    <div className="options-screen">
      <div className="opt-row">
        <span className="opt-icon"><Languages size={20} strokeWidth={1.8} /></span>
        <span className="opt-label">{s.language}</span>
        <SettingsDropdown options={languageOptions} value={lang} onChange={(v) => v !== lang && onSwitchLang()} />
      </div>
      <div className="opt-divider" />

      <button className="opt-row opt-row-clickable" onClick={() => setExpandedRow((r) => (r === "notifications" ? null : "notifications"))}>
        <span className="opt-icon"><Bell size={20} strokeWidth={1.8} /></span>
        <span className="opt-label">{s.notifications}</span>
        <ChevronRight size={16} strokeWidth={2} className={`opt-chevron ${expandedRow === "notifications" ? "open" : ""}`} />
      </button>
      {expandedRow === "notifications" && (
        <div className="opt-expand-panel">
          <div className="opt-expand-toprow">
            <span className="opt-expand-label">{s.notifications}</span>
            <OptToggleSwitch on={notificationsOn} onClick={() => onSetNotificationsOn((v) => !v)} />
          </div>
          {notificationsOn && (
            <div className="opt-pause-block">
              <span className="opt-expand-sublabel">{s.pauseNotif}</span>
              <p className="opt-expand-desc">{s.pauseSub}</p>
              {isPaused ? (
                <div className="pause-status-row">
                  <span className="pause-status-text">
                    <Clock3 size={13} strokeWidth={2} /> {s.pausedLine(formatCountdown(remainingMs))}
                  </span>
                  <button className="pause-resume-btn" onClick={() => onSetPausedUntil(null)}>{s.resumeNow}</button>
                </div>
              ) : (
                <div className="pause-chip-row">
                  {PAUSE_DURATIONS.map((d) => (
                    <button key={d.id} className="pause-chip-light" onClick={() => startPause(d)}>
                      {lang === "bn" ? d.bn : d.en}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
      <div className="opt-divider" />

      <button className="opt-row opt-row-clickable" onClick={() => setExpandedRow((r) => (r === "preferences" ? null : "preferences"))}>
        <span className="opt-icon"><SlidersHorizontal size={20} strokeWidth={1.8} /></span>
        <span className="opt-label">{s.yourPrefs}</span>
        <ChevronRight size={16} strokeWidth={2} className={`opt-chevron ${expandedRow === "preferences" ? "open" : ""}`} />
      </button>
      {expandedRow === "preferences" && (
        <div className="opt-expand-panel">
          <p className="opt-expand-desc">{s.yourPrefsSub}</p>
          <div className="pref-cat-list">
            {TOPIC_CATEGORIES.filter((c) => c.id !== "all").map((cat) => {
              const Icon = cat.icon;
              const current = newsPreferences[cat.id] || "all";
              return (
                <div className="pref-cat-row-light" key={cat.id}>
                  <span className="pref-cat-name-light">
                    <Icon size={14} strokeWidth={2} /> {lang === "bn" ? cat.bn : cat.en}
                  </span>
                  <div className="pref-cat-options">
                    <button className={`pref-opt-light ${current === "all" ? "active" : ""}`} onClick={() => setCategoryPref(cat.id, "all")}>
                      {s.all}
                    </button>
                    <button className={`pref-opt-light interested ${current === "interested" ? "active" : ""}`} onClick={() => setCategoryPref(cat.id, "interested")}>
                      {s.interested}
                    </button>
                    <button className={`pref-opt-light not-interested ${current === "not_interested" ? "active" : ""}`} onClick={() => setCategoryPref(cat.id, "not_interested")}>
                      {s.notInterested}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      <div className="opt-divider" />

      <div className="opt-row">
        <span className="opt-icon"><Triangle size={19} strokeWidth={1.8} /></span>
        <span className="opt-label">{s.hdImages}</span>
        <OptToggleSwitch on={hdImages} onClick={() => onSetHdImages((v) => !v)} />
      </div>
      <div className="opt-divider" />

      <div className="opt-row opt-row-tall">
        <span className="opt-icon"><Moon size={19} strokeWidth={1.8} /></span>
        <span className="opt-label-col">
          <span className="opt-label">{s.nightMode}</span>
          <span className="opt-sublabel">{s.nightModeSub}</span>
        </span>
        <OptToggleSwitch on={nightMode} onClick={() => onSetNightMode((v) => !v)} />
      </div>
      <div className="opt-divider" />

      <div className="opt-row">
        <span className="opt-icon"><Play size={19} strokeWidth={1.8} /></span>
        <span className="opt-label">{s.autoplay}</span>
        <SettingsDropdown options={autoplayOptions} value={autoPlay} onChange={onSetAutoPlay} />
      </div>
      <div className="opt-divider" />

      <div className="opt-row">
        <span className="opt-icon opt-icon-aa">Aa</span>
        <span className="opt-label">{s.textSize}</span>
        <SettingsDropdown options={textSizeOptions} value={textSize} onChange={onSetTextSize} />
      </div>
    </div>
  );
}


const TERMS_SECTIONS = {
  en: [
    { h: "1. Acceptance of Terms", p: "By creating a profile or using Pings in any way, you agree to be bound by these Terms and Conditions. If you don't agree with any part of them, please don't use the app." },
    { h: "2. What Pings Is", p: "Pings summarizes news from Bangladeshi and international newspapers into short, independently rewritten headlines, and offers a Vocabulary builder, General Knowledge digest, and practice exams for job and admission preparation (BCS, bank, and similar competitive exams)." },
    { h: "3. News Content & Attribution", p: "Headlines and summaries on Pings are rewritten in our own words based on publicly reported facts. We do not claim ownership of the underlying news events or the original reporting, and every story links back to its original source so you can read the full article there." },
    { h: "4. Your Account", p: "You may sign in with Google, Facebook, LinkedIn, or a phone number. You're responsible for keeping your sign-in details secure and for all activity under your account." },
    { h: "5. Acceptable Use", p: "Don't scrape, reverse-engineer, or resell Pings's content; don't misuse the quiz or exam features to disrupt other users; and don't upload or share anything unlawful, harassing, or infringing." },
    { h: "6. Intellectual Property", p: "The Pings app design, code, rewritten headlines, vocabulary entries, and quiz questions are owned by Pings. Underlying facts and any linked original articles remain the property of their respective publishers." },
    { h: "7. Educational Use Only", p: "GK facts, vocabulary, and quiz content are study aids, not official exam syllabi. Always cross-check against official circulars from BPSC, Bangladesh Bank, or the relevant exam authority before relying on them for exam preparation." },
    { h: "8. No Warranty", p: "Pings is provided \"as is.\" We work to keep content accurate and timely, but we don't guarantee it's error-free, complete, or uninterrupted." },
    { h: "9. Limitation of Liability", p: "To the extent permitted by law, Pings isn't liable for indirect or consequential losses arising from your use of the app, including decisions made based on its content." },
    { h: "10. Changes to These Terms", p: "We may update these Terms as the app evolves. Continuing to use Pings after changes means you accept the updated Terms." },
    { h: "11. Governing Law", p: "These Terms are governed by the laws of Bangladesh." },
  ],
  bn: [
    { h: "১. শর্তাবলীর গ্রহণযোগ্যতা", p: "প্রোফাইল তৈরি করে বা যেকোনোভাবে Pings ব্যবহার করে আপনি এই শর্তাবলী মেনে নিতে সম্মত হচ্ছেন। যদি আপনি এর কোনো অংশের সাথে একমত না হন, তাহলে দয়া করে অ্যাপটি ব্যবহার করবেন না।" },
    { h: "২. Pings কী", p: "Pings বাংলাদেশি ও আন্তর্জাতিক সংবাদপত্রের খবরকে সংক্ষিপ্ত, স্বতন্ত্রভাবে পুনর্লিখিত শিরোনামে রূপান্তরিত করে, এবং চাকরি ও ভর্তি পরীক্ষার (বিসিএস, ব্যাংক ও অন্যান্য প্রতিযোগিতামূলক পরীক্ষা) প্রস্তুতির জন্য শব্দভাণ্ডার বিল্ডার, সাধারণ জ্ঞান ডাইজেস্ট ও অনুশীলন পরীক্ষা প্রদান করে।" },
    { h: "৩. সংবাদ কনটেন্ট ও উৎস স্বীকৃতি", p: "Pings-তে শিরোনাম ও সারসংক্ষেপ প্রকাশ্যে প্রতিবেদিত তথ্যের ভিত্তিতে আমাদের নিজস্ব ভাষায় পুনর্লিখিত। আমরা মূল সংবাদ ঘটনা বা মূল প্রতিবেদনের মালিকানা দাবি করি না, এবং প্রতিটি খবর মূল উৎসের সাথে লিংক করা থাকে যাতে আপনি সেখানে সম্পূর্ণ প্রতিবেদন পড়তে পারেন।" },
    { h: "৪. আপনার অ্যাকাউন্ট", p: "আপনি Google, Facebook, LinkedIn, বা ফোন নম্বর দিয়ে সাইন ইন করতে পারেন। আপনার সাইন-ইন তথ্য নিরাপদ রাখা এবং আপনার অ্যাকাউন্টের অধীনে সব কার্যক্রমের দায়িত্ব আপনার।" },
    { h: "৫. গ্রহণযোগ্য ব্যবহার", p: "Pings-এর কনটেন্ট স্ক্র্যাপ, রিভার্স-ইঞ্জিনিয়ার বা পুনর্বিক্রয় করবেন না; অন্য ব্যবহারকারীদের বিঘ্নিত করতে কুইজ বা পরীক্ষার ফিচার অপব্যবহার করবেন না; এবং বেআইনি, হয়রানিমূলক বা লঙ্ঘনকারী কিছু আপলোড বা শেয়ার করবেন না।" },
    { h: "৬. মেধাসম্পদ", p: "Pings অ্যাপের ডিজাইন, কোড, পুনর্লিখিত শিরোনাম, শব্দভাণ্ডার এন্ট্রি ও কুইজ প্রশ্ন Pings-এর মালিকানাধীন। মূল তথ্য ও লিংক করা মূল প্রতিবেদন সংশ্লিষ্ট প্রকাশকদের সম্পত্তি থেকে যায়।" },
    { h: "৭. শুধুমাত্র শিক্ষামূলক ব্যবহার", p: "জিকে তথ্য, শব্দভাণ্ডার ও কুইজ কনটেন্ট পড়াশোনার সহায়ক, সরকারি পরীক্ষার সিলেবাস নয়। পরীক্ষার প্রস্তুতির জন্য নির্ভর করার আগে সবসময় বিপিএসসি, বাংলাদেশ ব্যাংক বা সংশ্লিষ্ট পরীক্ষা কর্তৃপক্ষের সরকারি বিজ্ঞপ্তির সাথে মিলিয়ে নিন।" },
    { h: "৮. কোনো ওয়ারেন্টি নেই", p: "Pings \"যেমন আছে\" ভিত্তিতে প্রদান করা হয়। আমরা কনটেন্ট নির্ভুল ও সময়োপযোগী রাখার চেষ্টা করি, তবে এটি ত্রুটিমুক্ত, সম্পূর্ণ বা নিরবচ্ছিন্ন থাকার নিশ্চয়তা দিই না।" },
    { h: "৯. দায়বদ্ধতার সীমাবদ্ধতা", p: "আইন দ্বারা অনুমোদিত পরিমাণে, অ্যাপ ব্যবহারের ফলে সৃষ্ট পরোক্ষ ক্ষতির জন্য Pings দায়ী নয়, এর কনটেন্টের ভিত্তিতে নেওয়া সিদ্ধান্তসহ।" },
    { h: "১০. শর্তাবলীর পরিবর্তন", p: "অ্যাপের বিকাশের সাথে সাথে আমরা এই শর্তাবলী আপডেট করতে পারি। পরিবর্তনের পর Pings ব্যবহার চালিয়ে যাওয়া মানে আপনি আপডেট করা শর্তাবলী গ্রহণ করছেন।" },
    { h: "১১. প্রযোজ্য আইন", p: "এই শর্তাবলী বাংলাদেশের আইন দ্বারা নিয়ন্ত্রিত।" },
  ],
};

const PRIVACY_SECTIONS = {
  en: [
    { h: "1. Information We Collect", p: "Your chosen language, saved news/vocabulary/GK items, custom folders, quiz history, Daily Ritual streak and badges, and app settings like Night Mode or Text Size." },
    { h: "2. How We Use It", p: "To personalize your feed, remember what you've saved, track your streaks and quiz progress, and apply your display preferences across the app." },
    { h: "3. Sign-In Providers", p: "In this build, signing in with Google, Facebook, LinkedIn, or a phone number is simulated for demonstration — no data is actually sent to those providers. A live version would follow each provider's standard OAuth flow and only request the minimum profile info needed (name, email)." },
    { h: "4. Where Your Data Lives", p: "This demo stores your data only for your current session, in your device's memory — not on a permanent server yet. Closing or refreshing the app clears it." },
    { h: "5. Cookies & Local Storage", p: "Pings does not currently use browser cookies or local storage to track you." },
    { h: "6. Data Sharing", p: "We do not sell your personal data to third parties. Any future advertising or analytics partners would be disclosed here before being enabled." },
    { h: "7. Children's Privacy", p: "Pings is not directed at children under 13, and we don't knowingly collect their personal information." },
    { h: "8. Your Rights", p: "You can review, export awareness of, or permanently delete your saved data at any time using the \"Delete Profile\" option in Settings." },
    { h: "9. Security", p: "We take reasonable measures to protect your information, though no method of electronic storage is 100% secure." },
    { h: "10. Changes to This Policy", p: "We'll update this page if our data practices change, particularly once a real backend and account system are introduced." },
  ],
  bn: [
    { h: "১. আমরা যে তথ্য সংগ্রহ করি", p: "আপনার পছন্দের ভাষা, সংরক্ষিত খবর/শব্দভাণ্ডার/জিকে আইটেম, কাস্টম ফোল্ডার, কুইজের ইতিহাস, Daily Ritual স্ট্রিক ও ব্যাজ, এবং নাইট মোড বা টেক্সট সাইজের মতো অ্যাপ সেটিংস।" },
    { h: "২. আমরা কীভাবে এটি ব্যবহার করি", p: "আপনার ফিড ব্যক্তিগতকৃত করতে, আপনি কী সংরক্ষণ করেছেন তা মনে রাখতে, আপনার স্ট্রিক ও কুইজ অগ্রগতি ট্র্যাক করতে, এবং অ্যাপ জুড়ে আপনার প্রদর্শন পছন্দ প্রয়োগ করতে।" },
    { h: "৩. সাইন-ইন প্রোভাইডার", p: "এই সংস্করণে Google, Facebook, LinkedIn বা ফোন নম্বর দিয়ে সাইন ইন করা প্রদর্শনের জন্য সিমুলেটেড — এই প্রোভাইডারদের কাছে আসলে কোনো তথ্য পাঠানো হয় না। লাইভ সংস্করণ প্রতিটি প্রোভাইডারের স্ট্যান্ডার্ড OAuth প্রক্রিয়া অনুসরণ করবে এবং শুধুমাত্র প্রয়োজনীয় ন্যূনতম প্রোফাইল তথ্য (নাম, ইমেইল) চাইবে।" },
    { h: "৪. আপনার তথ্য কোথায় থাকে", p: "এই ডেমো আপনার তথ্য শুধুমাত্র আপনার বর্তমান সেশনে, আপনার ডিভাইসের মেমরিতে সংরক্ষণ করে — এখনো কোনো স্থায়ী সার্ভারে নয়। অ্যাপ বন্ধ বা রিফ্রেশ করলে তা মুছে যায়।" },
    { h: "৫. কুকি ও লোকাল স্টোরেজ", p: "Pings বর্তমানে আপনাকে ট্র্যাক করতে ব্রাউজার কুকি বা লোকাল স্টোরেজ ব্যবহার করে না।" },
    { h: "৬. তথ্য শেয়ারিং", p: "আমরা আপনার ব্যক্তিগত তথ্য তৃতীয় পক্ষের কাছে বিক্রি করি না। ভবিষ্যতে কোনো বিজ্ঞাপন বা অ্যানালিটিক্স পার্টনার সক্রিয় করার আগে এখানে প্রকাশ করা হবে।" },
    { h: "৭. শিশুদের গোপনীয়তা", p: "Pings ১৩ বছরের কম বয়সী শিশুদের লক্ষ্য করে তৈরি নয়, এবং আমরা জেনেশুনে তাদের ব্যক্তিগত তথ্য সংগ্রহ করি না।" },
    { h: "৮. আপনার অধিকার", p: "সেটিংসে \"প্রোফাইল মুছুন\" অপশন ব্যবহার করে আপনি যেকোনো সময় আপনার সংরক্ষিত তথ্য পর্যালোচনা বা স্থায়ীভাবে মুছতে পারেন।" },
    { h: "৯. নিরাপত্তা", p: "আমরা আপনার তথ্য সুরক্ষিত রাখতে যুক্তিসঙ্গত ব্যবস্থা নিই, যদিও কোনো ইলেকট্রনিক সংরক্ষণ পদ্ধতিই ১০০% নিরাপদ নয়।" },
    { h: "১০. এই নীতির পরিবর্তন", p: "আমাদের ডেটা প্র্যাকটিস পরিবর্তিত হলে, বিশেষত একটি প্রকৃত ব্যাকএন্ড ও অ্যাকাউন্ট সিস্টেম চালু হলে, আমরা এই পেজ আপডেট করব।" },
  ],
};

function ProfileScreen({
  lang,
  onSwitchLang,
  openPrefsOnMount,
  onJumpConsumed,
  ritualProfile,
  onPickDisplayBadge,
  testHistory,
  onAddTestResult,
  savedNews,
  onToggleSaveNews,
  savedVocab,
  onToggleSaveVocab,
  savedGK,
  onToggleSaveGK,
  customFolders,
  onCreateEmptyFolder,
  onDeleteFolder,
  onRemoveFolderItem,
  notificationsOn,
  onSetNotificationsOn,
  pausedUntil,
  onSetPausedUntil,
  nowTick,
  newsPreferences,
  onSetNewsPreferences,
  hdImages,
  onSetHdImages,
  nightMode,
  onSetNightMode,
  autoPlay,
  onSetAutoPlay,
  textSize,
  onSetTextSize,
  onShareApp,
  onRateApp,
  onDeleteProfile,
}) {
  const [signedIn, setSignedIn] = useState(false);
  const [method, setMethod] = useState("");
  const [phone, setPhone] = useState("");
  const [showPhoneInput, setShowPhoneInput] = useState(false);
  const [view, setView] = useState(openPrefsOnMount ? "settings" : "main"); // main | saved | saved-news | saved-vocab | saved-gk | saved-custom | folder | history | exam | settings | terms | privacy | about | contact
  const cameFromPrefsJump = useRef(openPrefsOnMount);
  useEffect(() => {
    if (openPrefsOnMount) onJumpConsumed?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [activeFolderId, setActiveFolderId] = useState(null);
  const [newFolderName, setNewFolderName] = useState("");
  const [showNewFolderInput, setShowNewFolderInput] = useState(false);
  const [expandedVocabKey, setExpandedVocabKey] = useState(null);

  const T = {
    en: {
      title: "Sign in to Pings",
      sub: "To take part in exams, save your likes and bookmarks across devices.",
      google: "Continue with Google",
      facebook: "Continue with Facebook",
      linkedin: "Continue with LinkedIn",
      phone: "Continue with Phone Number",
      phonePlaceholder: "e.g. 017XXXXXXXX",
      sendCode: "Send Code",
      note: "Demo build — these buttons don't connect to real accounts yet; that needs the backend.",
      signOut: "Sign Out",
      streakDay: (n) => `Day ${n} of your reading streak`,
      shareBadge: "Share Badge",
      noBadge: "Complete Daily Ritual to earn your first badge.",
      profile: "Profile",
      saved: "Saved",
      history: "History",
      news: "News",
      vocabulary: "Vocabulary",
      gk: "General Knowledge",
      customise: "Customise",
      back: "Back",
      empty: "Nothing saved here yet.",
      newFolder: "New Folder",
      folderPlaceholder: "Folder name",
      create: "Create",
      emptyFolder: "This folder is empty.",
      deleteFolder: "Delete folder",
      historyNote: "Coming soon — this will show your recently viewed news, videos, and other content.",
      exam: "Take Part in Exam",
      saveHint: "Tap the bookmark on any news, vocabulary, or GK point to save it here automatically.",
      items: (n) => `${n} item${n === 1 ? "" : "s"}`,
      settings: "Settings",
      terms: "Terms and Conditions",
      privacy: "Privacy Policy",
      about: "About Us",
      contact: "Contact Us",
      notifications: "Push Notifications",
      dataSaver: "Data Saver Mode",
      autoPlay: "Auto-play Videos",
      settingsDemoNote: "These toggles are for demo purposes — settings will be saved once the backend is connected.",
      aboutBody:
        "Pings turns the day's news into 60-word, independently rewritten summaries from trusted Bangladeshi and international newspapers — no clickbait, just the story. Alongside news, it builds real exam-readiness with a Vocabulary trainer, a General Knowledge digest, and timed practice exams, all built for students, job seekers, and busy professionals preparing for BCS, bank, and other competitive exams.",
      aboutBody2:
        "Our goal is simple: staying informed and staying exam-ready should take the same sixty seconds. Every headline is rewritten in our own words and always links back to its original source, and every GK fact and quiz question is grounded in real, checkable information rather than filler.",
      contactBody: "Have feedback, a bug to report, or a partnership idea? We'd love to hear from you — we typically reply within 2–3 business days.",
      contactEmail: "support@pings.app",
      shareApp: "Share this app",
      rateApp: "Rate this app",
      deleteProfile: "Delete Profile",
      deleteConfirmTitle: "Delete your profile?",
      deleteConfirmBody: "This permanently clears your saved news, vocabulary, GK items, folders, ritual streak, and test history, and signs you out. This can't be undone.",
      deleteConfirmAction: "Delete Profile",
      cancel: "Cancel",
    },
    bn: {
      title: "Pings-তে সাইন ইন করুন",
      sub: "পরীক্ষায় অংশ নিতে, আপনার পছন্দ ও বুকমার্ক সংরক্ষণ করুন সব ডিভাইসে।",
      google: "Google দিয়ে চালিয়ে যান",
      facebook: "Facebook দিয়ে চালিয়ে যান",
      linkedin: "LinkedIn দিয়ে চালিয়ে যান",
      phone: "ফোন নম্বর দিয়ে চালিয়ে যান",
      phonePlaceholder: "যেমন ০১৭XXXXXXXX",
      sendCode: "কোড পাঠান",
      note: "ডেমো বিল্ড — এই বাটনগুলো এখনো আসল অ্যাকাউন্টের সাথে যুক্ত নয়; এর জন্য ব্যাকএন্ড দরকার।",
      signOut: "সাইন আউট",
      streakDay: (n) => `আপনার রিডিং স্ট্রিকের দিন ${n}`,
      shareBadge: "ব্যাজ শেয়ার করুন",
      noBadge: "প্রথম ব্যাজ পেতে Daily Ritual সম্পূর্ণ করুন।",
      profile: "প্রোফাইল",
      saved: "সংরক্ষিত",
      history: "ইতিহাস",
      news: "খবর",
      vocabulary: "শব্দভাণ্ডার",
      gk: "সাধারণ জ্ঞান",
      customise: "কাস্টমাইজ",
      back: "পেছনে",
      empty: "এখনো কিছু সংরক্ষণ করা হয়নি।",
      newFolder: "নতুন ফোল্ডার",
      folderPlaceholder: "ফোল্ডারের নাম",
      create: "তৈরি করুন",
      emptyFolder: "এই ফোল্ডারটি খালি।",
      deleteFolder: "ফোল্ডার মুছুন",
      historyNote: "শীঘ্রই আসছে — এখানে আপনার সম্প্রতি দেখা খবর, ভিডিও ও অন্যান্য কনটেন্ট দেখাবে।",
      exam: "পরীক্ষায় অংশ নিন",
      saveHint: "যেকোনো খবর, শব্দভাণ্ডার বা জিকে পয়েন্টের বুকমার্কে ট্যাপ করলে তা এখানে সংরক্ষিত হবে।",
      items: (n) => `${n}টি আইটেম`,
      settings: "সেটিংস",
      terms: "শর্তাবলী",
      privacy: "গোপনীয়তা নীতি",
      about: "আমাদের সম্পর্কে",
      contact: "যোগাযোগ করুন",
      notifications: "পুশ নোটিফিকেশন",
      dataSaver: "ডেটা সেভার মোড",
      autoPlay: "ভিডিও অটো-প্লে",
      settingsDemoNote: "এই টগলগুলো ডেমোর জন্য — ব্যাকএন্ড যুক্ত হলে সেটিংস সংরক্ষিত হবে।",
      aboutBody:
        "Pings প্রতিদিনের খবরকে বিশ্বস্ত বাংলাদেশি ও আন্তর্জাতিক সংবাদপত্র থেকে ৬০ শব্দের, স্বতন্ত্রভাবে পুনর্লিখিত সারসংক্ষেপে রূপান্তরিত করে — কোনো ক্লিকবেইট নয়, শুধু সংবাদ। খবরের পাশাপাশি, এটি শব্দভাণ্ডার প্রশিক্ষণ, সাধারণ জ্ঞান ডাইজেস্ট ও সময়ভিত্তিক অনুশীলন পরীক্ষার মাধ্যমে প্রকৃত পরীক্ষা-প্রস্তুতি তৈরি করে — শিক্ষার্থী, চাকরিপ্রার্থী ও ব্যস্ত পেশাজীবীদের জন্য যারা বিসিএস, ব্যাংক ও অন্যান্য প্রতিযোগিতামূলক পরীক্ষার প্রস্তুতি নিচ্ছেন।",
      aboutBody2:
        "আমাদের লক্ষ্য সহজ: তথ্য জানা এবং পরীক্ষার জন্য প্রস্তুত থাকা—দুটোই একই ষাট সেকেন্ডে হওয়া উচিত। প্রতিটি শিরোনাম আমাদের নিজস্ব ভাষায় পুনর্লিখিত এবং সবসময় মূল উৎসের সাথে লিংক করা থাকে, আর প্রতিটি জিকে তথ্য ও কুইজ প্রশ্ন বাস্তব, যাচাইযোগ্য তথ্যের ভিত্তিতে তৈরি, কোনো ফিলার নয়।",
      contactBody: "মতামত, কোনো সমস্যার রিপোর্ট, বা পার্টনারশিপের ধারণা থাকলে আমাদের জানান — আমরা সাধারণত ২-৩ কর্মদিবসের মধ্যে উত্তর দিই।",
      contactEmail: "support@pings.app",
      shareApp: "অ্যাপটি শেয়ার করুন",
      rateApp: "অ্যাপটি রেট করুন",
      deleteProfile: "প্রোফাইল মুছুন",
      deleteConfirmTitle: "আপনার প্রোফাইল মুছবেন?",
      deleteConfirmBody: "এতে আপনার সংরক্ষিত খবর, শব্দভাণ্ডার, জিকে আইটেম, ফোল্ডার, রিচুয়াল স্ট্রিক ও পরীক্ষার ইতিহাস স্থায়ীভাবে মুছে যাবে এবং আপনি সাইন আউট হয়ে যাবেন। এটি পূর্বাবস্থায় ফেরানো যাবে না।",
      deleteConfirmAction: "প্রোফাইল মুছুন",
      cancel: "বাতিল",
    },
  };
  const s = T[lang === "bn" ? "bn" : "en"];
  const hasBadge = !!(ritualProfile?.badges && ritualProfile.badges.length > 0);
  const displayBadgeTier = hasBadge ? getBadgeTier(ritualProfile.displayBadge || ritualProfile.badges[ritualProfile.badges.length - 1]) : null;

  const newsList = Object.values(savedNews || {});
  const vocabList = Object.values(savedVocab || {});
  const gkList = Object.values(savedGK || {});
  const activeFolder = (customFolders || []).find((f) => f.id === activeFolderId);

  const displayName = method === "Google" ? "Google User" : method === "Facebook" ? "Facebook User" : method === "LinkedIn" ? "LinkedIn User" : phone || "Pings User";
  const displayEmail = method && method !== phone ? `you@${method.toLowerCase()}.demo` : "you@pings.app";
  const avatarLetter = (displayName || "S").trim().charAt(0).toUpperCase();

  if (!signedIn) {
    return (
      <div className="signin-screen">
        <div className="signin-inner">
          <span className="profile-avatar"><User size={26} strokeWidth={2} /></span>
          <h2 className="signin-title">{s.title}</h2>
          <p className="signin-sub">{s.sub}</p>

          <div className="signin-opts">
            <button className="signin-btn" onClick={() => { setMethod("Google"); setSignedIn(true); }}>
              <GoogleMark /> <span>{s.google}</span>
            </button>
            <button className="signin-btn" onClick={() => { setMethod("Facebook"); setSignedIn(true); }}>
              <FacebookMark /> <span>{s.facebook}</span>
            </button>
            <button className="signin-btn" onClick={() => { setMethod("LinkedIn"); setSignedIn(true); }}>
              <LinkedInMark /> <span>{s.linkedin}</span>
            </button>
            <button className="signin-btn" onClick={() => setShowPhoneInput((v) => !v)}>
              <span className="phone-icon-wrap"><Phone size={18} strokeWidth={2} /></span>
              <span>{s.phone}</span>
            </button>

            {showPhoneInput && (
              <div className="phone-input-row">
                <input
                  className="phone-input"
                  type="tel"
                  placeholder={s.phonePlaceholder}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
                <button
                  className="phone-send-btn"
                  onClick={() => { setMethod(phone || "Phone"); setSignedIn(true); }}
                >
                  {s.sendCode}
                </button>
              </div>
            )}
          </div>

          <p className="signin-note">{s.note}</p>
        </div>
      </div>
    );
  }

  const SubHeader = ({ title, onBack, right, light }) => (
    <div className={`profile-subheader ${light ? "profile-subheader-light" : ""}`}>
      <button className="profile-back-btn" onClick={onBack}>
        <ChevronLeft size={18} strokeWidth={2} /> {s.back}
      </button>
      <span className="profile-subheader-title">{title}</span>
      {right || <span className="profile-subheader-spacer" />}
    </div>
  );

  if (view === "saved-news") {
    return (
      <div className="profile-screen profile-subview">
        <SubHeader title={`${s.news} (${newsList.length})`} onBack={() => setView("saved")} />
        {newsList.length === 0 && <p className="profile-empty-note">{s.empty}</p>}
        <div className="list-items profile-list-pad">
          {newsList.map((it) => (
            <div key={it.id} className="list-row profile-saved-row">
              <a href={it.link} target="_blank" rel="noopener noreferrer" className="list-row-link">
                <span className="list-thumb">
                  {it.image ? <img src={it.image} alt="" className="list-thumb-img" /> : <ImageIcon size={18} strokeWidth={1.6} color="var(--gold)" />}
                </span>
                <span className="list-row-text">
                  <span className="list-headline">{it.headline}</span>
                  <span className="list-time">{it.time}</span>
                </span>
              </a>
              <button className="profile-remove-btn" onClick={() => onToggleSaveNews(it)} aria-label="Remove">
                <Trash2 size={15} strokeWidth={2} />
              </button>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (view === "saved-vocab") {
    return (
      <div className="profile-screen profile-subview">
        <SubHeader title={`${s.vocabulary} (${vocabList.length})`} onBack={() => setView("saved")} />
        {vocabList.length === 0 && <p className="profile-empty-note">{s.empty}</p>}
        <div className="vocab-list profile-list-pad">
          {vocabList.map((w) => {
            const isOpen = expandedVocabKey === w.key;
            return (
              <div className="vocab-card" key={w.key} onClick={() => setExpandedVocabKey(isOpen ? null : w.key)}>
                <div className="vocab-card-top">
                  <span className="vocab-word">{w.word}</span>
                  <span className="vocab-pos">{w.pos}</span>
                  <button
                    className="profile-remove-btn profile-remove-btn-inline"
                    onClick={(e) => { e.stopPropagation(); onToggleSaveVocab(w.key, w); }}
                    aria-label="Remove"
                  >
                    <Trash2 size={14} strokeWidth={2} />
                  </button>
                </div>
                <p className="vocab-meaning">{w.meaning}</p>
                {isOpen && (
                  <ul className="vocab-example-list">
                    {w.examples.map((ex, i) => (
                      <li key={i} className="vocab-example">{ex}</li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  if (view === "saved-gk") {
    return (
      <div className="profile-screen profile-subview">
        <SubHeader title={`${s.gk} (${gkList.length})`} onBack={() => setView("saved")} />
        {gkList.length === 0 && <p className="profile-empty-note">{s.empty}</p>}
        <ul className="gk-bullet-list profile-list-pad">
          {gkList.map((it) => (
            <li className="gk-bullet-item" key={it.key}>
              <span className="gk-bullet-dot" />
              <div className="gk-bullet-body">
                <div className="gk-bullet-head">
                  {it.heading && <span className="gk-summary-heading">{it.heading}</span>}
                  <button className="gk-save-btn saved profile-remove-btn-inline" onClick={() => onToggleSaveGK(it.key, it)} aria-label="Remove">
                    <Trash2 size={13} strokeWidth={2} />
                  </button>
                </div>
                <p className="gk-bullet-text">{it.text}</p>
                {it.link && it.link !== "#" && (
                  <a className="gk-view-link" href={it.link} target="_blank" rel="noopener noreferrer">
                    {lang === "bn" ? "সম্পূর্ণ খবর দেখুন" : "View full news"} →
                  </a>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  if (view === "saved-custom") {
    return (
      <div className="profile-screen profile-subview">
        <SubHeader title={s.customise} onBack={() => setView("saved")} />
        <p className="profile-empty-note">{s.saveHint}</p>
        <div className="folder-list profile-list-pad">
          {(customFolders || []).map((f) => (
            <button key={f.id} className="folder-pick-row" onClick={() => { setActiveFolderId(f.id); setView("folder"); }}>
              <span className="folder-pick-icon"><FolderIcon size={16} strokeWidth={2} /></span>
              <span className="folder-pick-name">{f.name}</span>
              <span className="folder-pick-count">{f.items.length}</span>
              <ChevronRight size={16} strokeWidth={2} color="var(--gold)" />
            </button>
          ))}
        </div>
        {showNewFolderInput ? (
          <div className="folder-new-row">
            <input
              className="folder-new-input"
              type="text"
              placeholder={s.folderPlaceholder}
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              autoFocus
            />
            <button
              className="folder-create-btn"
              disabled={!newFolderName.trim()}
              onClick={() => { onCreateEmptyFolder(newFolderName.trim()); setNewFolderName(""); setShowNewFolderInput(false); }}
            >
              {s.create}
            </button>
          </div>
        ) : (
          <button className="folder-add-new-btn" onClick={() => setShowNewFolderInput(true)}>
            <Plus size={15} strokeWidth={2} /> {s.newFolder}
          </button>
        )}
      </div>
    );
  }

  if (view === "folder" && activeFolder) {
    return (
      <div className="profile-screen profile-subview">
        <SubHeader
          title={`${activeFolder.name} (${activeFolder.items.length})`}
          onBack={() => setView("saved-custom")}
          right={
            <button
              className="profile-remove-btn"
              onClick={() => { onDeleteFolder(activeFolder.id); setView("saved-custom"); }}
              aria-label={s.deleteFolder}
            >
              <Trash2 size={16} strokeWidth={2} />
            </button>
          }
        />
        {activeFolder.items.length === 0 && <p className="profile-empty-note">{s.emptyFolder}</p>}
        <div className="list-items profile-list-pad">
          {activeFolder.items.map((it) => (
            <div key={it.id} className="list-row profile-saved-row">
              <a href={it.link || "#"} target="_blank" rel="noopener noreferrer" className="list-row-link">
                <span className="list-thumb">
                  {it.image ? <img src={it.image} alt="" className="list-thumb-img" /> : <FolderIcon size={16} strokeWidth={1.6} color="var(--gold)" />}
                </span>
                <span className="list-row-text">
                  <span className="list-headline">{it.title}</span>
                  {it.subtitle && <span className="list-time">{it.subtitle}</span>}
                </span>
              </a>
              <button className="profile-remove-btn" onClick={() => onRemoveFolderItem(activeFolder.id, it.id)} aria-label="Remove">
                <Trash2 size={15} strokeWidth={2} />
              </button>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (view === "history") {
    return (
      <div className="profile-screen profile-subview">
        <SubHeader title={s.history} onBack={() => setView("main")} />
        <p className="profile-empty-note">{s.historyNote}</p>
      </div>
    );
  }

  if (view === "exam") {
    return (
      <div className="profile-screen profile-subview">
        <SubHeader title={s.exam} onBack={() => setView("main")} />
        <ExamScreen
          lang={lang}
          onSwitchLang={onSwitchLang}
          embedded
          testHistory={testHistory}
          onAddTestResult={onAddTestResult}
          savedVocab={savedVocab}
          savedGK={savedGK}
        />
      </div>
    );
  }

  if (view === "settings") {
    return (
      <div className="profile-screen profile-subview profile-subview-light">
        <SubHeader title={s.settings} onBack={() => setView("main")} light />
        <SettingsScreen
          lang={lang}
          onSwitchLang={onSwitchLang}
          initialExpanded={cameFromPrefsJump.current ? "preferences" : null}
          notificationsOn={notificationsOn}
          onSetNotificationsOn={onSetNotificationsOn}
          pausedUntil={pausedUntil}
          onSetPausedUntil={onSetPausedUntil}
          nowTick={nowTick}
          newsPreferences={newsPreferences}
          onSetNewsPreferences={onSetNewsPreferences}
          hdImages={hdImages}
          onSetHdImages={onSetHdImages}
          nightMode={nightMode}
          onSetNightMode={onSetNightMode}
          autoPlay={autoPlay}
          onSetAutoPlay={onSetAutoPlay}
          textSize={textSize}
          onSetTextSize={onSetTextSize}
          onShareApp={onShareApp}
        />
      </div>
    );
  }

  if (view === "terms") {
    const sections = TERMS_SECTIONS[lang === "bn" ? "bn" : "en"];
    return (
      <div className="profile-screen profile-subview">
        <SubHeader title={s.terms} onBack={() => setView("main")} />
        <div className="static-page-body">
          {sections.map((sec, i) => (
            <div key={i} className="static-page-section">
              <h3 className="static-page-heading">{sec.h}</h3>
              <p>{sec.p}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (view === "privacy") {
    const sections = PRIVACY_SECTIONS[lang === "bn" ? "bn" : "en"];
    return (
      <div className="profile-screen profile-subview">
        <SubHeader title={s.privacy} onBack={() => setView("main")} />
        <div className="static-page-body">
          {sections.map((sec, i) => (
            <div key={i} className="static-page-section">
              <h3 className="static-page-heading">{sec.h}</h3>
              <p>{sec.p}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (view === "about") {
    return (
      <div className="profile-screen profile-subview">
        <SubHeader title={s.about} onBack={() => setView("main")} />
        <div className="static-page-body">
          <p>{s.aboutBody}</p>
          <p>{s.aboutBody2}</p>
        </div>
      </div>
    );
  }

  if (view === "contact") {
    return (
      <div className="profile-screen profile-subview">
        <SubHeader title={s.contact} onBack={() => setView("main")} />
        <div className="static-page-body">
          <p>{s.contactBody}</p>
          <a className="gk-view-link" href={`mailto:${s.contactEmail}`}>{s.contactEmail}</a>
        </div>
      </div>
    );
  }

  if (view === "saved") {
    const rows = [
      { id: "saved-news", icon: Newspaper, label: s.news, count: newsList.length },
      { id: "saved-vocab", icon: Languages, label: s.vocabulary, count: vocabList.length },
      { id: "saved-gk", icon: Compass, label: s.gk, count: gkList.length },
      { id: "saved-custom", icon: FolderIcon, label: s.customise, count: (customFolders || []).length },
    ];
    return (
      <div className="profile-screen profile-subview">
        <SubHeader title={s.saved} onBack={() => setView("main")} />
        <div className="profile-menu-list profile-list-pad">
          {rows.map((r) => {
            const Icon = r.icon;
            return (
              <button key={r.id} className="profile-menu-row" onClick={() => setView(r.id)}>
                <span className="profile-menu-icon"><Icon size={18} strokeWidth={1.8} /></span>
                <span className="profile-menu-label">{r.label}</span>
                <span className="profile-menu-count">{r.count}</span>
                <ChevronRight size={17} strokeWidth={2} color="var(--gold)" />
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // main profile view
  return (
    <div className="profile-screen profile-main">
      <div className="profile-main-header">
        <span className="profile-main-title">{s.profile}</span>
        <div className="dots-wrap">
          <button className="profile-settings-btn" onClick={() => setShowSettingsMenu((v) => !v)}>
            <Settings size={18} strokeWidth={2} />
          </button>
        </div>
      </div>

      {showSettingsMenu && (
        <div className="share-overlay" onClick={() => setShowSettingsMenu(false)}>
          <div className="share-sheet settings-menu-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="share-sheet-handle settings-menu-handle" />
            <button className="interest-row settings-menu-row" onClick={() => { setView("settings"); setShowSettingsMenu(false); }}>
              <Settings size={16} strokeWidth={2} /> <span>{s.settings}</span>
            </button>
            <button className="interest-row settings-menu-row" onClick={() => { setView("terms"); setShowSettingsMenu(false); }}>
              <FileTextIcon size={16} strokeWidth={2} /> <span>{s.terms}</span>
            </button>
            <button className="interest-row settings-menu-row" onClick={() => { setView("privacy"); setShowSettingsMenu(false); }}>
              <ShieldIcon size={16} strokeWidth={2} /> <span>{s.privacy}</span>
            </button>
            <button className="interest-row settings-menu-row" onClick={() => { onShareApp?.(); setShowSettingsMenu(false); }}>
              <Share2 size={16} strokeWidth={2} /> <span>{s.shareApp}</span>
            </button>
            <button className="interest-row settings-menu-row" onClick={() => { onRateApp?.(); setShowSettingsMenu(false); }}>
              <Star size={16} strokeWidth={2} /> <span>{s.rateApp}</span>
            </button>
            <button className="interest-row settings-menu-row" onClick={() => { setView("about"); setShowSettingsMenu(false); }}>
              <Info size={16} strokeWidth={2} /> <span>{s.about}</span>
            </button>
            <button className="interest-row settings-menu-row" onClick={() => { setView("contact"); setShowSettingsMenu(false); }}>
              <Mail size={16} strokeWidth={2} /> <span>{s.contact}</span>
            </button>
            <button className="share-cancel-btn settings-menu-cancel" onClick={() => setShowSettingsMenu(false)}>Close</button>
          </div>
        </div>
      )}

      {showDeleteConfirm && (
        <div className="share-overlay" onClick={() => setShowDeleteConfirm(false)}>
          <div className="share-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="share-sheet-handle" />
            <span className="share-sheet-title">{s.deleteConfirmTitle}</span>
            <p className="delete-confirm-body">{s.deleteConfirmBody}</p>
            <button
              className="delete-confirm-btn"
              onClick={() => {
                onDeleteProfile?.();
                setSignedIn(false);
                setShowDeleteConfirm(false);
                setView("main");
              }}
            >
              {s.deleteConfirmAction}
            </button>
            <button className="share-cancel-btn" onClick={() => setShowDeleteConfirm(false)}>{s.cancel}</button>
          </div>
        </div>
      )}

      <div className="profile-avatar-wrap profile-avatar-wrap-lg">
        <span className="profile-avatar-letter">{avatarLetter}</span>
        {hasBadge && (
          <span className="profile-badge-dot" style={{ background: `linear-gradient(160deg, ${displayBadgeTier.colors[0]}, ${displayBadgeTier.colors[1]})` }}>
            <Award size={13} strokeWidth={2} color="#fff" />
          </span>
        )}
      </div>
      <span className="profile-display-name">{displayName}</span>
      <span className="profile-display-email">{displayEmail}</span>

      {hasBadge && (
        <div className="profile-badge-card">
          <span className="profile-badge-name">
            <Award size={14} strokeWidth={2} /> {lang === "bn" ? displayBadgeTier.bn : displayBadgeTier.en}
          </span>
          <span className="profile-streak-line">
            <Flame size={13} strokeWidth={2} color="var(--gold)" /> {s.streakDay(ritualProfile.streak || 1)}
          </span>
          {ritualProfile.badges.length > 1 && (
            <div className="profile-badge-mini-row">
              {ritualProfile.badges.map((bid) => {
                const tier = getBadgeTier(bid);
                const isActive = displayBadgeTier.id === bid;
                return (
                  <button
                    key={bid}
                    className={`profile-badge-mini ${isActive ? "active" : ""}`}
                    onClick={() => onPickDisplayBadge?.(bid)}
                    style={{ background: `linear-gradient(160deg, ${tier.colors[0]}, ${tier.colors[1]})` }}
                    aria-label={lang === "bn" ? tier.bn : tier.en}
                  >
                    <Award size={12} strokeWidth={2} color="#fff" />
                  </button>
                );
              })}
            </div>
          )}
          <button className="profile-share-btn">
            <Share2 size={14} strokeWidth={2} /> {s.shareBadge}
          </button>
        </div>
      )}

      <div className="profile-menu-list">
        <button className="profile-menu-row" onClick={() => setView("saved")}>
          <span className="profile-menu-icon"><Bookmark size={18} strokeWidth={1.8} /></span>
          <span className="profile-menu-label">{s.saved}</span>
          <ChevronRight size={17} strokeWidth={2} color="var(--gold)" />
        </button>
        <button className="profile-menu-row" onClick={() => setView("history")}>
          <span className="profile-menu-icon"><HistoryIcon size={18} strokeWidth={1.8} /></span>
          <span className="profile-menu-label">{s.history}</span>
          <ChevronRight size={17} strokeWidth={2} color="var(--gold)" />
        </button>
        <button className="profile-menu-row" onClick={() => setView("exam")}>
          <span className="profile-menu-icon"><ClipboardCheck size={18} strokeWidth={1.8} /></span>
          <span className="profile-menu-label">{s.exam}</span>
          <ChevronRight size={17} strokeWidth={2} color="var(--gold)" />
        </button>
        <button
          className="profile-menu-row profile-menu-row-danger"
          onClick={() => { setSignedIn(false); setShowPhoneInput(false); setView("main"); }}
        >
          <span className="profile-menu-icon"><LogOut size={18} strokeWidth={1.8} /></span>
          <span className="profile-menu-label">{s.signOut}</span>
        </button>
        <button
          className="profile-menu-row profile-menu-row-danger"
          onClick={() => setShowDeleteConfirm(true)}
        >
          <span className="profile-menu-icon"><Trash2 size={18} strokeWidth={1.8} /></span>
          <span className="profile-menu-label">{s.deleteProfile}</span>
        </button>
      </div>
    </div>
  );
}

function PingsLogo({ size = 28, dotColor = "#fff" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="8" cy="16" r="3" fill={dotColor} />
      <circle cx="17" cy="8" r="3" fill={dotColor} opacity="0.55" />
    </svg>
  );
}

function SplashScreen({ onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 3000);
    return () => clearTimeout(t);
  }, [onDone]);

  const letters = ["P", "I", "N", "G", "S"];
  const letterStart = 650; // ms, after the logo settles
  const letterGap = 130;

  return (
    <div className="splash-screen" onClick={onDone}>
      <span className="splash-icon-box">
        <PingsLogo size={68} />
      </span>
      <span className="splash-wordmark">
        {letters.map((ch, i) => (
          <span
            key={i}
            className="splash-letter"
            style={{ animationDelay: `${letterStart + i * letterGap}ms` }}
          >
            {ch}
          </span>
        ))}
      </span>
      <span className="splash-tag">
        <span className="splash-tag-part splash-tag-left" style={{ animationDelay: `${letterStart + letters.length * letterGap + 150}ms` }}>
          Get pinged.
        </span>{" "}
        <span className="splash-tag-part splash-tag-right" style={{ animationDelay: `${letterStart + letters.length * letterGap + 450}ms` }}>
          In sixty words.
        </span>
      </span>
    </div>
  );
}

function OnboardingScreen({ onSelect }) {
  return (
    <div className="onboard">
      <div className="onboard-inner">
        <span className="onboard-icon-box"><PingsLogo size={30} /></span>
        <span className="onboard-brand">Pings</span>
        <span className="onboard-tag">Get pinged. In sixty words.</span>
        <p className="onboard-q">পছন্দের ভাষা<br />Language preference</p>
        <div className="onboard-opts">
          <button className="onboard-btn" onClick={() => onSelect("en")}>
            <span className="opt-main">English</span>
          </button>
          <button className="onboard-btn" onClick={() => onSelect("bn")}>
            <span className="opt-main">বাংলা</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [lang, setLang] = useState(null); // null = onboarding not yet completed
  const [showSplash, setShowSplash] = useState(true);
  const [activeTab, setActiveTab] = useState("myfeed");
  const [tabDirection, setTabDirection] = useState(1);
  const [bottomNav, setBottomNav] = useState("home");
  const [showInterests, setShowInterests] = useState(false);
  const [ritualProfile, setRitualProfile] = useState(null); // { age, gender, newsPrefs, newsOther, reason, streak, badges, displayBadge }

  const markRitualDayComplete = () => {
    setRitualProfile((p) => {
      if (!p) return p;
      const streak = (p.streak || 1) + 1;
      const badges = badgesForStreak(streak);
      const newlyEarned = badges.length > (p.badges || []).length;
      return {
        ...p,
        streak,
        badges,
        displayBadge: newlyEarned ? badges[badges.length - 1] : p.displayBadge,
      };
    });
  };

  const pickDisplayBadge = (badgeId) => {
    setRitualProfile((p) => (p ? { ...p, displayBadge: badgeId } : p));
  };
  const [interests, setInterests] = useState([]);
  const [showSearch, setShowSearch] = useState(false);
  const [shareStory, setShareStory] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [items, setItems] = useState([]);
  const [status, setStatus] = useState("idle");
  const [category, setCategory] = useState(null);
  const [errorNote, setErrorNote] = useState("");
  const [index, setIndex] = useState(0);
  const [saved, setSaved] = useState({}); // id -> full news item (used for Saved > News)
  const [savedVocab, setSavedVocab] = useState({}); // key -> vocab/linker item
  const [savedGK, setSavedGK] = useState({}); // key -> gk bullet item
  const [customFolders, setCustomFolders] = useState([]); // [{id, name, items:[]}]
  const [folderPickerItem, setFolderPickerItem] = useState(null); // item pending "save to folder" from long-press
  const [testHistory, setTestHistory] = useState([]); // quiz attempt records for Take Part in Exam
  const [notificationsOn, setNotificationsOn] = useState(true);
  const [pausedUntil, setPausedUntil] = useState(null); // timestamp or null
  const [nowTick, setNowTick] = useState(Date.now());
  const [newsPreferences, setNewsPreferences] = useState({}); // categoryId -> 'all' | 'interested' | 'not_interested'
  const [hdImages, setHdImages] = useState(true);
  const [nightMode, setNightMode] = useState(false);
  const [autoPlay, setAutoPlay] = useState("wifi"); // on | off | wifi
  const [textSize, setTextSize] = useState("default"); // default | large
  const [toast, setToast] = useState(null);
  const [jumpToPrefs, setJumpToPrefs] = useState(false);
  const isFirstNightRender = useRef(true);
  const isFirstTextSizeRender = useRef(true);

  useEffect(() => {
    if (!pausedUntil) return;
    const interval = setInterval(() => {
      const now = Date.now();
      setNowTick(now);
      if (now >= pausedUntil) setPausedUntil(null);
    }, 1000);
    return () => clearInterval(interval);
  }, [pausedUntil]);

  useEffect(() => {
    if (isFirstNightRender.current) { isFirstNightRender.current = false; return; }
    setToast(
      nightMode
        ? (lang === "bn" ? "নাইট মোড চালু — এখনই কার্যকর" : "Night mode is on — applied right now")
        : (lang === "bn" ? "নাইট মোড বন্ধ — এখনই কার্যকর" : "Night mode is off — applied right now")
    );
    const t = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(t);
  }, [nightMode]);

  useEffect(() => {
    if (isFirstTextSizeRender.current) { isFirstTextSizeRender.current = false; return; }
    setToast(
      textSize === "large"
        ? (lang === "bn" ? "বড় টেক্সট সাইজ — এখনই কার্যকর" : "Large text size — applied right now")
        : (lang === "bn" ? "ডিফল্ট টেক্সট সাইজ — এখনই কার্যকর" : "Default text size — applied right now")
    );
    const t = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(t);
  }, [textSize]);
  const longPressTimer = useRef(null);
  const touchStartY = useRef(null);
  const touchStartX = useRef(null);
  const wheelLock = useRef(false);

  const t = lang ? UI[lang] : UI.en;

  const lastTapRef = useRef({ id: null, time: 0 });
  const handleStoryTap = (item) => {
    const now = Date.now();
    if (lastTapRef.current.id === item.id && now - lastTapRef.current.time < 300) {
      window.open(item.link, "_blank", "noopener,noreferrer");
      lastTapRef.current = { id: null, time: 0 };
    } else {
      lastTapRef.current = { id: item.id, time: now };
    }
  };

  const lastNotifTapRef = useRef({ id: null, time: 0 });
  const handleNotifTap = (item, categoryLabel) => {
    const now = Date.now();
    if (lastNotifTapRef.current.id === item.id && now - lastNotifTapRef.current.time < 400) {
      window.open(item.link, "_blank", "noopener,noreferrer");
      lastNotifTapRef.current = { id: null, time: 0 };
      return;
    }
    lastNotifTapRef.current = { id: item.id, time: now };
    setCategory(categoryLabel);
    setActiveTab("myfeed");
    setBottomNav("home");
  };

  const toggleSave = (item) =>
    setSaved((s) => {
      const copy = { ...s };
      if (copy[item.id]) delete copy[item.id];
      else copy[item.id] = item;
      return copy;
    });

  const toggleSavedVocab = (key, item) =>
    setSavedVocab((s) => {
      const copy = { ...s };
      if (copy[key]) delete copy[key];
      else copy[key] = item;
      return copy;
    });

  const toggleSavedGK = (key, item) =>
    setSavedGK((s) => {
      const copy = { ...s };
      if (copy[key]) delete copy[key];
      else copy[key] = item;
      return copy;
    });

  const createFolder = (name) => {
    const id = `folder-${Date.now()}`;
    setCustomFolders((f) => [...f, { id, name, items: [] }]);
    return id;
  };

  const addItemToFolder = (folderId, item) => {
    setCustomFolders((folders) =>
      folders.map((f) => (f.id === folderId ? { ...f, items: [...f.items, item] } : f))
    );
  };

  const removeItemFromFolder = (folderId, itemId) => {
    setCustomFolders((folders) =>
      folders.map((f) => (f.id === folderId ? { ...f, items: f.items.filter((it) => it.id !== itemId) } : f))
    );
  };

  const deleteFolder = (folderId) => {
    setCustomFolders((folders) => folders.filter((f) => f.id !== folderId));
  };

  const addTestResult = (record) => setTestHistory((h) => [record, ...h]);

  const startLongPress = (item) => {
    longPressTimer.current = setTimeout(() => {
      setFolderPickerItem(item);
    }, 550);
  };
  const cancelLongPress = () => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
  };

  const handlePickFolder = (folderId) => {
    addItemToFolder(folderId, { ...folderPickerItem, id: `item-${Date.now()}` });
    setFolderPickerItem(null);
  };
  const handleCreateFolderAndSave = (name) => {
    const id = createFolder(name);
    addItemToFolder(id, { ...folderPickerItem, id: `item-${Date.now()}` });
    setFolderPickerItem(null);
  };

  const load = useCallback(async (activeLang) => {
    setStatus("loading");
    setErrorNote("");
    setIndex(0);
    const relevantSources = SOURCES.filter((s) => s.lang === activeLang);
    const results = await Promise.allSettled(relevantSources.map(fetchFeed));
    let merged = [];
    let okCount = 0;
    results.forEach((r) => {
      if (r.status === "fulfilled") {
        okCount += 1;
        merged = merged.concat(r.value);
      }
    });
    if (okCount === 0) {
      setItems(FALLBACK[activeLang]);
      setStatus("fallback");
      setErrorNote("Live fetch didn't come through this time — showing sample cards with the same layout.");
    } else {
      merged.sort(() => Math.random() - 0.5);
      try {
        const [rewritten, categoryIds] = await Promise.all([
          rewriteHeadlines(merged.map((it) => it.headline), activeLang),
          classifyCategories(merged.map((it) => ({ headline: it.headline, summary: it.summary }))),
        ]);
        merged = merged.map((it, i) => ({
          ...it,
          headline: rewritten[i] || it.headline,
          category: categoryIds[i] || "national",
        }));
      } catch {
        // keep original headlines / fall back to a default category if either call fails
        merged = merged.map((it) => ({ ...it, category: it.category || "national" }));
      }
      setItems(merged);
      setStatus("live");
      if (okCount < relevantSources.length) {
        setErrorNote(`Fetched ${okCount} of ${relevantSources.length} ${activeLang === "en" ? "English" : "Bangla"} sources.`);
      }
    }
  }, []);

  useEffect(() => {
    if (lang) {
      setCategory(CATEGORIES[lang][0]);
      load(lang);
    }
  }, [lang, load]);

  const selectedCategoryId = useMemo(() => {
    if (!lang) return "all";
    const match = TOPIC_CATEGORIES.find((c) => (lang === "bn" ? c.bn : c.en) === category);
    return match ? match.id : "all";
  }, [category, lang]);

  const filteredItems = useMemo(() => {
    let base = items;
    if (selectedCategoryId !== "all") {
      base = base.filter((it) => it.category === selectedCategoryId);
    }
    if (!searchQuery.trim()) return base;
    const q = searchQuery.trim().toLowerCase();
    return base.filter(
      (it) => it.headline.toLowerCase().includes(q) || it.summary.toLowerCase().includes(q)
    );
  }, [items, searchQuery, selectedCategoryId]);

  useEffect(() => {
    setIndex(0);
  }, [searchQuery, selectedCategoryId]);

  const goNext = useCallback(() => {
    setIndex((i) => {
      if (i >= filteredItems.length - 1) {
        // reached the end — auto-refresh with fresh stories instead of getting stuck
        if (!searchQuery && status !== "loading") load(lang);
        return i;
      }
      return i + 1;
    });
  }, [filteredItems.length, searchQuery, status, load, lang]);
  const goPrev = useCallback(() => {
    setIndex((i) => Math.max(i - 1, 0));
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "ArrowDown" || e.key === " ") { e.preventDefault(); goNext(); }
      if (e.key === "ArrowUp") { e.preventDefault(); goPrev(); }
      if (e.key === "ArrowRight") { e.preventDefault(); switchTabBy(1); }
      if (e.key === "ArrowLeft") { e.preventDefault(); switchTabBy(-1); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goNext, goPrev]);

  const switchTabBy = useCallback((delta) => {
    setTabDirection(delta > 0 ? 1 : -1);
    setActiveTab((cur) => {
      const idx = TABS.findIndex((tb) => tb.id === cur);
      const nextIdx = (idx + delta + TABS.length) % TABS.length;
      return TABS[nextIdx].id;
    });
  }, []);

  const goToTab = useCallback((id) => {
    setActiveTab((cur) => {
      const curIdx = TABS.findIndex((tb) => tb.id === cur);
      const newIdx = TABS.findIndex((tb) => tb.id === id);
      setTabDirection(newIdx >= curIdx ? 1 : -1);
      return id;
    });
    setBottomNav("home");
  }, []);

  const onWheel = (e) => {
    if (wheelLock.current) return;
    const absX = Math.abs(e.deltaX);
    const absY = Math.abs(e.deltaY);
    if (absX > absY && absX > 25) {
      wheelLock.current = true;
      // swipe/scroll right => next tab, swipe/scroll left => previous tab
      e.deltaX < 0 ? switchTabBy(1) : switchTabBy(-1);
      setTimeout(() => { wheelLock.current = false; }, 450);
      return;
    }
    if (absY < 20 || activeTab !== "myfeed") return;
    wheelLock.current = true;
    if (e.deltaY > 0) goNext(); else goPrev();
    setTimeout(() => { wheelLock.current = false; }, 450);
  };

  const onTouchStart = (e) => {
    touchStartY.current = e.touches[0].clientY;
    touchStartX.current = e.touches[0].clientX;
  };
  const onTouchEnd = (e) => {
    if (touchStartY.current == null || touchStartX.current == null) return;
    const dy = touchStartY.current - e.changedTouches[0].clientY;
    const dx = touchStartX.current - e.changedTouches[0].clientX;
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 50) {
      // finger dragged right (dx negative) => next tab; dragged left (dx positive) => previous tab
      dx < 0 ? switchTabBy(1) : switchTabBy(-1);
    } else if (Math.abs(dy) > 50 && activeTab === "myfeed") {
      dy > 0 ? goNext() : goPrev();
    }
    touchStartY.current = null;
    touchStartX.current = null;
  };

  const switchLang = () => setLang((l) => (l === "en" ? "bn" : "en"));
  const toggleInterest = (id) =>
    setInterests((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const current = filteredItems[index];

  return (
    <div className={`app ${nightMode ? "night-mode" : ""} ${textSize === "large" ? "text-large" : ""}`}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Serif+Bengali:wght@500;700&family=Fraunces:opsz,wght@9..144,500;9..144,700&family=Hind+Siliguri:wght@400;500;600;700&family=IBM+Plex+Mono:wght@500&family=Space+Grotesk:wght@500;600;700&display=swap');

        :root {
          --ink: #0F1B14;
          --green: #04673F;
          --green-deep: #033B26;
          --paper: #FBF7EE;
          --red: #C8102E;
          --gold: #D97757;
        }
        * { box-sizing: border-box; }
        html, body { margin: 0; }

        /* Night Mode: darkens the light "paper" reading surfaces (story cards, ritual wizard, sign-in) */
        .night-mode .story-body {
          background: #14201A;
        }
        .night-mode .story-headline { color: #F1ECE1; }
        .night-mode .story-summary { color: #C9C2B4; }
        .night-mode .story-meta { color: #8a8f88; }
        .night-mode .story-brand { color: #7ee8ab; }
        .night-mode .story-icon-btn { color: #8a8f88; }
        .night-mode .ritual-screen {
          background: linear-gradient(175deg, #14201A 0%, #101A15 60%, #0C1410 100%);
        }
        .night-mode .ritual-question,
        .night-mode .ritual-eyebrow,
        .night-mode .ritual-simple-opt,
        .night-mode .ritual-chip,
        .night-mode .ritual-opt-label {
          color: #F1ECE1;
        }
        .night-mode .ritual-simple-opt,
        .night-mode .ritual-chip,
        .night-mode .ritual-opt {
          background: #1B2921;
        }

        /* Night Mode: also darkens the Settings / Options page */
        .night-mode .profile-subview-light {
          background: radial-gradient(circle at 20% 0%, var(--green-deep), var(--ink) 65%);
        }
        .night-mode .profile-subheader-light .profile-back-btn,
        .night-mode .profile-subheader-light .profile-subheader-title {
          color: var(--paper);
        }
        .night-mode .profile-subheader-light {
          border-bottom-color: rgba(251,247,238,0.14);
        }
        .night-mode .options-screen {
          background: #16241D;
          color: var(--paper);
        }
        .night-mode .opt-icon,
        .night-mode .opt-icon-aa,
        .night-mode .opt-label,
        .night-mode .opt-expand-label,
        .night-mode .opt-expand-sublabel {
          color: var(--paper);
        }
        .night-mode .opt-sublabel,
        .night-mode .opt-expand-desc {
          color: rgba(251,247,238,0.55);
        }
        .night-mode .opt-divider {
          background: rgba(251,247,238,0.1);
        }
        .night-mode .opt-chevron {
          color: rgba(251,247,238,0.4);
        }
        .night-mode .opt-value-btn {
          color: #7ee8ab;
        }
        .night-mode .opt-dropdown-menu {
          background: #1B2921;
          border-color: rgba(251,247,238,0.16);
        }
        .night-mode .opt-dropdown-item {
          color: var(--paper);
        }
        .night-mode .opt-dropdown-item:hover {
          background: rgba(251,247,238,0.08);
        }
        .night-mode .opt-dropdown-item.active {
          color: #7ee8ab;
        }
        .night-mode .opt-switch {
          background: rgba(251,247,238,0.18);
        }
        .night-mode .opt-switch.on {
          background: #3FBF7F;
        }
        .night-mode .opt-pause-block {
          border-top-color: rgba(251,247,238,0.12);
        }
        .night-mode .pause-chip-light {
          background: rgba(251,247,238,0.08);
          border-color: rgba(251,247,238,0.2);
          color: var(--paper);
        }
        .night-mode .pause-status-row {
          background: rgba(184,134,59,0.18);
          border-color: rgba(184,134,59,0.4);
        }
        .night-mode .pause-status-text {
          color: var(--gold);
        }
        .night-mode .pref-cat-row-light {
          background: rgba(251,247,238,0.06);
          border-color: rgba(251,247,238,0.14);
        }
        .night-mode .pref-cat-name-light {
          color: var(--paper);
        }
        .night-mode .pref-opt-light {
          background: rgba(251,247,238,0.06);
          border-color: rgba(251,247,238,0.18);
          color: rgba(251,247,238,0.65);
        }
        .night-mode .pref-opt-light.active {
          background: var(--paper);
          border-color: var(--paper);
          color: #1B2921;
        }
        .night-mode .static-page-body p {
          color: rgba(251,247,238,0.8);
        }

        /* Night Mode: covers every remaining page in the app so the whole
           experience goes dark together, not just the reading surfaces above. */
        .night-mode .list-screen,
        .night-mode .timeline-screen,
        .night-mode .video-screen,
        .night-mode .vocab-screen,
        .night-mode .vocab-locked-screen,
        .night-mode .gk-screen,
        .night-mode .job-screen,
        .night-mode .exam-screen,
        .night-mode .exam-embedded,
        .night-mode .ritual-feed-screen,
        .night-mode .cat-menu-screen,
        .night-mode .profile-screen,
        .night-mode .signin-screen,
        .night-mode .onboard {
          background: radial-gradient(circle at 20% 0%, var(--green-deep), var(--ink) 65%);
        }
        .night-mode .signin-screen,
        .night-mode .profile-screen.profile-main,
        .night-mode .vocab-locked-screen {
          background: radial-gradient(circle at 50% 30%, var(--green-deep), var(--ink) 75%);
        }
        .night-mode .onboard {
          background: radial-gradient(circle at 30% 20%, var(--green-deep), var(--ink) 70%);
        }

        .night-mode .list-screen, .night-mode .list-screen *,
        .night-mode .timeline-screen, .night-mode .timeline-screen *,
        .night-mode .video-screen, .night-mode .video-screen *,
        .night-mode .vocab-screen, .night-mode .vocab-screen *,
        .night-mode .vocab-locked-screen, .night-mode .vocab-locked-screen *,
        .night-mode .gk-screen, .night-mode .gk-screen *,
        .night-mode .job-screen, .night-mode .job-screen *,
        .night-mode .exam-screen, .night-mode .exam-screen *,
        .night-mode .exam-embedded, .night-mode .exam-embedded *,
        .night-mode .ritual-feed-screen, .night-mode .ritual-feed-screen *,
        .night-mode .cat-menu-screen, .night-mode .cat-menu-screen *,
        .night-mode .profile-screen, .night-mode .profile-screen *,
        .night-mode .signin-screen, .night-mode .signin-screen *,
        .night-mode .onboard, .night-mode .onboard * {
          color: var(--paper);
        }
        .night-mode .list-time, .night-mode .timeline-sub, .night-mode .list-sample-note,
        .night-mode .job-org, .night-mode .job-deadline, .night-mode .profile-empty-note,
        .night-mode .quiz-answered-count, .night-mode .signin-note, .night-mode .signin-sub,
        .night-mode .onboard-note, .night-mode .profile-display-email {
          color: rgba(251,247,238,0.55) !important;
        }
        .night-mode .list-row, .night-mode .job-card, .night-mode .vocab-card,
        .night-mode .gk-acc-item, .night-mode .cat-notif-row, .night-mode .quiz-runner,
        .night-mode .quiz-review-item, .night-mode .test-history-row, .night-mode .stat-card,
        .night-mode .pref-cat-row-dark, .night-mode .signin-btn, .night-mode .cat-prefs-link-row {
          background: rgba(251,247,238,0.06);
          border-color: rgba(251,247,238,0.14);
        }
        .night-mode .quiz-opt, .night-mode .exam-length-card {
          background: rgba(251,247,238,0.06);
        }
        .night-mode .list-title, .night-mode .cat-menu-title, .night-mode .vocab-lock-title,
        .night-mode .profile-display-name, .night-mode .quiz-question,
        .night-mode .ritual-badge-name, .night-mode .test-history-type {
          color: var(--paper) !important;
        }
        .night-mode .signin-btn { color: #262220 !important; }
        .night-mode .signin-btn * { color: #262220 !important; }
        .night-mode .interests-panel,
        .night-mode .interests-panel * {
          color: #000000 !important;
        }
        .night-mode .interests-title { color: #8a8078 !important; }
        .night-mode .interest-row:hover { background: #F5F2EA; }
        .night-mode .interest-row.active {
          color: #1B1200 !important;
          background: rgba(217,119,87,0.14);
        }
        .night-mode .interest-row-danger { color: #C8102E !important; }

        /* Text Size: Large bumps up font sizes on the main reading surfaces */
        .text-large .story-headline { font-size: 26px; }
        .text-large .story-summary { font-size: 17px; line-height: 1.75; }
        .text-large .list-headline { font-size: 15.5px; }
        .text-large .vocab-word { font-size: 18px; }
        .text-large .vocab-meaning { font-size: 15px; }
        .text-large .vocab-example { font-size: 14px; }
        .text-large .gk-bullet-text { font-size: 15px; }
        .text-large .timeline-headline { font-size: 15.5px; }
        .text-large .job-title { font-size: 15.5px; }
        .text-large .job-org { font-size: 13.5px; }
        .text-large .quiz-question { font-size: 18px; }
        .text-large .quiz-opt { font-size: 14.5px; }
        .text-large .opt-label { font-size: 16.5px; }
        .text-large .story-meta { font-size: 12.5px; }

        .app-toast {
          position: absolute;
          bottom: 90px;
          left: 50%;
          transform: translateX(-50%);
          z-index: 120;
          display: flex;
          align-items: center;
          gap: 7px;
          background: #1B2921;
          border: 1px solid rgba(126,232,171,0.4);
          color: #7ee8ab;
          padding: 9px 16px;
          border-radius: 20px;
          font-size: 12.5px;
          font-weight: 600;
          box-shadow: 0 8px 24px rgba(0,0,0,0.35);
          white-space: nowrap;
          animation: toastIn 0.2s ease;
        }
        @keyframes toastIn {
          from { opacity: 0; transform: translateX(-50%) translateY(8px); }
          to { opacity: 1; transform: translateX(-50%) translateY(0); }
        }

        .app {
          height: 100vh;
          width: 100%;
          background: #000;
          font-family: 'Hind Siliguri', 'Inter', sans-serif;
          overflow: hidden;
          position: relative;
        }

        .splash-screen {
          height: 100%;
          width: 100%;
          background: #FFFFFF;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 4px;
        }
        .splash-icon-box {
          width: 148px; height: 148px;
          border-radius: 38px;
          background: #DC143C;
          display: flex; align-items: center; justify-content: center;
          margin-bottom: 22px;
          box-shadow: 0 20px 40px -10px rgba(220,20,60,0.55);
          opacity: 0;
          animation: splashFadeIn 0.6s ease forwards;
        }
        .splash-wordmark {
          display: flex;
          font-family: 'Space Grotesk', sans-serif;
          font-weight: 700;
          font-size: 40px;
          letter-spacing: -0.01em;
          color: #0A0A0A;
        }
        .splash-letter {
          display: inline-block;
          opacity: 0;
          animation: splashLetterIn 0.4s ease forwards;
        }
        .splash-tag {
          margin-top: 14px;
          font-family: 'Space Grotesk', sans-serif;
          font-weight: 500;
          font-size: 14px;
          color: #DC143C;
        }
        .splash-tag-part {
          display: inline-block;
          opacity: 0;
          animation-duration: 0.5s;
          animation-timing-function: ease;
          animation-fill-mode: forwards;
        }
        .splash-tag-left { animation-name: splashInLeft; }
        .splash-tag-right { animation-name: splashInRight; }

        @keyframes splashFadeIn {
          from { opacity: 0; transform: scale(0.9); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes splashLetterIn {
          from { opacity: 0; transform: translateX(28px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes splashInLeft {
          from { opacity: 0; transform: translateX(-24px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes splashInRight {
          from { opacity: 0; transform: translateX(24px); }
          to { opacity: 1; transform: translateX(0); }
        }

        .onboard {
          height: 100%;
          width: 100%;
          background: linear-gradient(175deg, #FDF1E6 0%, #FCE9DA 60%, #FBDFC6 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
        }
        .onboard-inner {
          max-width: 380px;
          width: 100%;
          text-align: center;
        }
        .onboard-icon-box {
          width: 64px; height: 64px;
          border-radius: 18px;
          background: #DC143C;
          display: flex; align-items: center; justify-content: center;
          margin: 0 auto 14px;
          box-shadow: 0 10px 22px -6px rgba(220,20,60,0.5);
        }
        .onboard-brand {
          display: block;
          font-family: 'Space Grotesk', sans-serif;
          font-weight: 700;
          font-size: 34px;
          letter-spacing: -0.01em;
          color: #0A0A0A;
        }
        .onboard-tag {
          display: block;
          font-family: 'Space Grotesk', sans-serif;
          font-weight: 500;
          font-size: 14px;
          color: #DC143C;
          margin-bottom: 40px;
        }
        .onboard-q {
          color: rgba(251,247,238,0.9);
          font-size: 15px;
          line-height: 1.7;
          margin-bottom: 24px;
        }
        .onboard-opts {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .onboard-btn {
          background: rgba(251,247,238,0.08);
          border: 1px solid rgba(251,247,238,0.25);
          border-radius: 14px;
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 4px;
          cursor: pointer;
          transition: background 0.2s, border-color 0.2s;
        }
        .onboard-btn:hover {
          background: rgba(184,134,59,0.18);
          border-color: var(--gold);
        }
        .opt-main {
          font-family: 'Noto Serif Bengali', 'Fraunces', serif;
          font-size: 19px;
          font-weight: 700;
          color: var(--paper);
        }
        .opt-sub {
          font-size: 11.5px;
          color: rgba(251,247,238,0.55);
          font-family: 'IBM Plex Mono', monospace;
        }
        .onboard-note {
          margin-top: 22px;
          font-size: 11.5px;
          color: rgba(251,247,238,0.4);
        }

        .topbar {
          position: absolute;
          top: 0; left: 0; right: 0;
          z-index: 30;
          padding: 14px 16px 12px;
          background: linear-gradient(180deg, rgba(3,8,5,0.95) 0%, rgba(3,8,5,0.92) 60%, rgba(3,8,5,0.75) 85%, rgba(3,8,5,0) 100%);
          box-shadow: 0 1px 0 rgba(255,255,255,0.06);
        }
        .progress-row {
          display: flex;
          gap: 4px;
          margin-bottom: 12px;
        }
        .progress-seg {
          flex: 1;
          height: 3px;
          border-radius: 2px;
          background: rgba(255,255,255,0.25);
          overflow: hidden;
        }
        .progress-seg.done { background: var(--gold); }
        .actions-row {
          display: flex;
          justify-content: flex-end;
          align-items: center;
          gap: 6px;
          margin-bottom: 10px;
        }
        .pill-btn-sm {
          background: rgba(255,255,255,0.1);
          border: 1px solid rgba(255,255,255,0.22);
          color: var(--gold);
          border-radius: 14px;
          padding: 3px 9px;
          font-family: 'IBM Plex Mono', monospace;
          font-size: 9.5px;
          cursor: pointer;
          line-height: 1.4;
        }
        .dots-wrap {
          position: relative;
        }
        .dots-btn {
          background: rgba(255,255,255,0.1);
          border: 1px solid rgba(255,255,255,0.22);
          color: var(--gold);
          border-radius: 14px;
          width: 26px;
          height: 26px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
        }
        .dots-btn.active {
          background: var(--gold);
          border-color: var(--gold);
          color: #1B1200;
        }
        .search-row {
          display: flex;
          align-items: center;
          gap: 8px;
          background: rgba(251,247,238,0.08);
          border: 1px solid rgba(251,247,238,0.22);
          border-radius: 20px;
          padding: 7px 12px;
          margin-bottom: 10px;
        }
        .search-row-icon { color: rgba(251,247,238,0.55); flex: none; }
        .search-input {
          flex: 1;
          background: none;
          border: none;
          outline: none;
          color: var(--paper);
          font-size: 13px;
        }
        .search-input::placeholder { color: rgba(251,247,238,0.4); }
        .search-clear {
          background: none;
          border: none;
          color: rgba(251,247,238,0.6);
          cursor: pointer;
          display: flex;
        }
        .interests-panel {
          position: absolute;
          top: 32px;
          right: 0;
          z-index: 60;
          width: 220px;
          background: #FFFFFF;
          border: 1px solid #ECE7DD;
          border-radius: 12px;
          padding: 12px;
          box-shadow: 0 10px 30px rgba(0,0,0,0.18);
        }
        .interests-title {
          display: block;
          font-family: 'IBM Plex Mono', monospace;
          font-size: 10px;
          letter-spacing: 0.6px;
          text-transform: uppercase;
          color: #8a8078;
          margin-bottom: 8px;
        }
        .interests-list {
          display: flex;
          flex-direction: column;
          gap: 2px;
          max-height: 240px;
          overflow-y: auto;
        }
        .interest-row {
          display: flex;
          align-items: center;
          gap: 8px;
          background: none;
          border: none;
          color: #000000;
          font-size: 12.5px;
          padding: 8px 6px;
          border-radius: 8px;
          cursor: pointer;
          text-align: left;
        }
        .interest-row:hover { background: #F5F2EA; }
        .interest-row.active { color: #1B1200; background: rgba(217,119,87,0.14); }
        .interest-row-danger { color: #C8102E; }
        .interest-row-danger:hover { background: rgba(227,28,46,0.08); }
        .settings-menu-sheet {
          background: linear-gradient(175deg, #FDF1E6 0%, #FCE9DA 60%, #FBDFC6 100%) !important;
          max-height: 80vh;
          overflow-y: auto;
        }
        .settings-menu-sheet, .settings-menu-sheet * {
          color: #D97757 !important;
        }
        .settings-menu-handle {
          background: rgba(0,0,0,0.15) !important;
        }
        .settings-menu-row {
          border-bottom: 1px solid #F0EBE0;
        }
        .settings-menu-row:last-of-type {
          border-bottom: none;
        }
        .settings-menu-cancel {
          margin-top: 12px;
          background: #F5F2EA !important;
          border: 1px solid #E4DFD2 !important;
        }
        .interest-check { margin-left: auto; color: var(--gold); }
        .interests-done {
          margin-top: 8px;
          width: 100%;
          background: var(--gold);
          color: #1B1200;
          border: none;
          border-radius: 8px;
          padding: 8px;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
        }
        .tabs-row {
          display: flex;
          gap: 6px;
          overflow-x: auto;
          margin-bottom: 4px;
          padding-bottom: 4px;
          border-bottom: 1px solid rgba(255,255,255,0.12);
        }
        .tabs-row::-webkit-scrollbar { display: none; }
        .tab-btn {
          flex: none;
          font-family: 'IBM Plex Mono', monospace;
          font-size: 11.5px;
          letter-spacing: 0.3px;
          padding: 7px 13px;
          border-radius: 8px 8px 0 0;
          border: none;
          background: rgba(255,255,255,0.06);
          color: rgba(255,255,255,0.8);
          cursor: pointer;
          border-bottom: 2px solid transparent;
          white-space: nowrap;
        }
        .tab-btn.active {
          background: rgba(184,134,59,0.22);
          color: var(--paper);
          border-bottom: 2px solid var(--gold);
          font-weight: 700;
        }

        .categories {
          display: flex;
          gap: 8px;
          overflow-x: auto;
        }
        .categories::-webkit-scrollbar { display: none; }
        .chip {
          flex: none;
          font-size: 12.5px;
          padding: 5px 12px;
          border-radius: 20px;
          border: 1px solid rgba(255,255,255,0.3);
          background: rgba(0,0,0,0.25);
          color: rgba(255,255,255,0.85);
          cursor: pointer;
        }
        .chip.active {
          background: var(--gold);
          border-color: var(--gold);
          color: #1B1200;
          font-weight: 700;
        }

        .home-content {
          height: 100%;
          width: 100%;
          position: relative;
        }
        .tab-pane {
          height: 100%;
          width: 100%;
        }
        .slide-in-right {
          animation: slideInRight 0.32s ease;
        }
        .slide-in-left {
          animation: slideInLeft 0.32s ease;
        }
        @keyframes slideInRight {
          from { transform: translateX(48px); opacity: 0.3; }
          to { transform: translateX(0); opacity: 1; }
        }
        @keyframes slideInLeft {
          from { transform: translateX(-48px); opacity: 0.3; }
          to { transform: translateX(0); opacity: 1; }
        }
        .deck {
          height: 100%;
          width: 100%;
          position: relative;
        }
        .slide {
          position: absolute;
          inset: 0;
          display: flex;
          flex-direction: column;
          animation: fadein 0.35s ease;
        }
        @keyframes fadein { from { opacity: 0; transform: scale(1.02);} to { opacity: 1; transform: scale(1);} }

        .story-photo {
          flex: 0 0 42%;
          background-size: cover;
          background-position: center;
          position: relative;
        }
        .story-photo-fallback {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .story-photo-icons {
          position: absolute;
          top: 14px;
          right: 14px;
          display: flex;
          gap: 8px;
        }
        .photo-icon-btn {
          width: 28px; height: 28px;
          border-radius: 50%;
          background: rgba(0,0,0,0.4);
          border: none;
          color: #fff;
          display: flex; align-items: center; justify-content: center;
          cursor: pointer;
        }
        .photo-nav-arrows {
          position: absolute;
          right: 14px;
          bottom: 54px;
          display: flex;
          gap: 8px;
        }
        .photo-nav-arrows button {
          width: 30px; height: 30px;
          border-radius: 50%;
          background: rgba(0,0,0,0.4);
          border: 1px solid rgba(255,255,255,0.3);
          color: #fff;
          cursor: pointer;
        }
        .photo-save-share-pill {
          position: absolute;
          right: 14px;
          bottom: 14px;
          display: flex;
          align-items: center;
          gap: 8px;
          background: rgba(0,0,0,0.45);
          border: 1px solid rgba(255,255,255,0.25);
          border-radius: 20px;
          padding: 6px 12px;
        }
        .pill-icon-btn {
          background: none;
          border: none;
          color: #fff;
          cursor: pointer;
          display: flex;
          align-items: center;
        }
        .pill-icon-btn.saved { color: var(--gold); }
        .pill-divider {
          width: 1px;
          height: 16px;
          background: rgba(255,255,255,0.3);
        }

        .share-overlay {
          position: absolute;
          inset: 0;
          z-index: 100;
          background: rgba(0,0,0,0.55);
          display: flex;
          align-items: flex-end;
        }
        .share-sheet {
          width: 100%;
          background: #10201A;
          border-radius: 20px 20px 0 0;
          padding: 10px 20px calc(20px + env(safe-area-inset-bottom));
          animation: sheetUp 0.25s ease;
        }
        @keyframes sheetUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        .share-sheet-handle {
          width: 36px; height: 4px;
          border-radius: 3px;
          background: rgba(251,247,238,0.25);
          margin: 0 auto 14px;
        }
        .share-sheet-title {
          display: block;
          font-family: 'Fraunces', 'Noto Serif Bengali', serif;
          font-weight: 700;
          font-size: 15px;
          color: var(--paper);
          margin-bottom: 16px;
        }
        .share-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 16px 8px;
          margin-bottom: 18px;
        }
        .share-opt {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 6px;
          background: none;
          border: none;
          cursor: pointer;
        }
        .share-opt-icon {
          width: 48px; height: 48px;
          border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
        }
        .share-opt-label {
          font-size: 10.5px;
          color: rgba(251,247,238,0.75);
          text-align: center;
          line-height: 1.3;
        }
        .share-cancel-btn {
          width: 100%;
          background: rgba(251,247,238,0.08);
          border: 1px solid rgba(251,247,238,0.18);
          color: var(--paper);
          border-radius: 12px;
          padding: 12px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
        }

        .delete-confirm-body {
          font-size: 13px;
          color: rgba(251,247,238,0.75);
          line-height: 1.7;
          margin: 0 0 16px;
        }
        .delete-confirm-btn {
          width: 100%;
          background: #C8102E;
          color: #fff;
          border: none;
          border-radius: 12px;
          padding: 12px;
          font-size: 14px;
          font-weight: 700;
          cursor: pointer;
          margin-bottom: 10px;
        }

        .story-body {
          flex: 1;
          background: var(--paper);
          border-radius: 22px 22px 0 0;
          margin-top: -18px;
          position: relative;
          z-index: 5;
          padding: 18px 20px 100px;
          display: flex;
          flex-direction: column;
          overflow-y: auto;
        }
        .story-body-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 14px;
        }
        .story-brand {
          display: flex;
          align-items: center;
          gap: 7px;
          font-family: 'Fraunces', serif;
          font-weight: 700;
          font-size: 13.5px;
          color: #0A0A0A;
        }
        .story-brand-mark {
          width: 20px; height: 20px;
          border-radius: 6px;
          background: #DC143C;
          color: #fff;
          font-size: 11px;
          font-weight: 700;
          display: flex; align-items: center; justify-content: center;
        }

        .story-headline {
          font-family: 'Noto Serif Bengali', 'Fraunces', serif;
          font-weight: 700;
          font-size: 20px;
          line-height: 1.4;
          color: #1B2420;
          margin: 0 0 10px;
        }
        .story-summary {
          font-size: 14.5px;
          line-height: 1.7;
          color: #5b554c;
          margin: 0 0 14px;
        }
        .story-meta {
          font-size: 12px;
          color: #a39c90;
          margin-bottom: 18px;
        }
        .story-dbltap-hint {
          display: flex;
          align-items: center;
          gap: 5px;
          justify-content: center;
          color: #a39c90;
          font-size: 11.5px;
          font-weight: 600;
          margin-top: auto;
          padding-top: 6px;
        }

        .swipe-hint {
          position: absolute;
          bottom: 78px;
          left: 0; right: 0;
          text-align: center;
          z-index: 15;
          color: #a39c90;
          font-family: 'IBM Plex Mono', monospace;
          font-size: 10px;
          letter-spacing: 1px;
        }

        .loading-state {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          color: rgba(255,255,255,0.7);
          font-family: 'IBM Plex Mono', monospace;
          font-size: 13px;
          text-align: center;
          padding: 0 30px;
          z-index: 40;
          background: #0F1B14;
        }

        .placeholder-screen {
          height: 100%;
          width: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 8px;
          background: linear-gradient(175deg, #FDF1E6 0%, #FCE9DA 60%, #FBDFC6 100%);
          padding: 0 30px;
          text-align: center;
        }
        .placeholder-icon {
          font-size: 30px;
          color: var(--gold);
          margin-bottom: 6px;
        }
        .placeholder-title {
          font-family: 'Noto Serif Bengali', 'Fraunces', serif;
          font-size: 21px;
          font-weight: 700;
          color: var(--paper);
        }
        .placeholder-sub {
          font-family: 'IBM Plex Mono', monospace;
          font-size: 11px;
          letter-spacing: 1px;
          text-transform: uppercase;
          color: var(--gold);
        }
        .placeholder-note {
          font-size: 12.5px;
          color: rgba(251,247,238,0.5);
          max-width: 260px;
          line-height: 1.6;
          margin-top: 4px;
        }

        .list-screen {
          height: 100%;
          width: 100%;
          background: linear-gradient(175deg, #FDF1E6 0%, #FCE9DA 60%, #FBDFC6 100%);
          padding: 76px 18px 100px;
          overflow-y: auto;
        }
        .list-title {
          font-family: 'Fraunces', 'Noto Serif Bengali', serif;
          font-weight: 700;
          font-size: 21px;
          color: var(--paper);
          margin: 0 0 6px;
        }
        .list-sample-note {
          font-size: 11.5px;
          color: rgba(251,247,238,0.5);
          margin: 0 0 16px;
          line-height: 1.5;
        }
        .list-items {
          display: flex;
          flex-direction: column;
          gap: 10px;
          margin-top: 14px;
        }
        .list-row {
          display: flex;
          align-items: center;
          gap: 12px;
          background: rgba(251,247,238,0.06);
          border: 1px solid rgba(251,247,238,0.14);
          border-radius: 12px;
          padding: 10px;
          text-decoration: none;
        }
        .list-row:hover { background: rgba(251,247,238,0.1); }
        .list-thumb {
          flex: none;
          width: 52px; height: 52px;
          border-radius: 10px;
          overflow: hidden;
          background: rgba(255,255,255,0.08);
          display: flex; align-items: center; justify-content: center;
        }
        .list-thumb-img {
          width: 100%; height: 100%;
          object-fit: cover;
          display: block;
        }
        .list-row-text {
          display: flex;
          flex-direction: column;
          gap: 4px;
          min-width: 0;
        }
        .list-headline {
          font-size: 13.5px;
          font-weight: 600;
          color: var(--paper);
          line-height: 1.4;
        }
        .list-time {
          font-size: 11px;
          color: rgba(251,247,238,0.5);
        }

        .trending-row { gap: 10px; }
        .trending-rank {
          flex: none;
          width: 24px;
          text-align: center;
          font-family: 'Fraunces', serif;
          font-weight: 700;
          font-size: 16px;
          color: rgba(251,247,238,0.4);
        }
        .trending-rank.top {
          color: var(--gold);
          font-size: 19px;
        }

        .timeline-screen {
          height: 100%;
          width: 100%;
          background: linear-gradient(175deg, #FDF1E6 0%, #FCE9DA 60%, #FBDFC6 100%);
          padding: 76px 18px 100px;
          overflow-y: auto;
        }
        .timeline-title {
          font-family: 'Fraunces', 'Noto Serif Bengali', serif;
          font-weight: 700;
          font-size: 21px;
          color: var(--paper);
          margin: 0 0 4px;
        }
        .timeline-sub {
          font-size: 12px;
          color: rgba(251,247,238,0.55);
          margin: 0 0 22px;
        }
        .topic-section-label {
          display: block;
          font-family: 'IBM Plex Mono', monospace;
          font-size: 10.5px;
          letter-spacing: 1px;
          text-transform: uppercase;
          color: rgba(251,247,238,0.5);
          margin-bottom: 8px;
        }
        .topic-pill-row {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-bottom: 26px;
        }
        .topic-pill {
          background: rgba(200,16,46,0.16);
          border: 1px solid rgba(200,16,46,0.4);
          color: #ffb4bf;
          border-radius: 20px;
          padding: 8px 16px;
          font-size: 12.5px;
          font-weight: 700;
          cursor: pointer;
        }
        .topic-back-btn {
          display: flex;
          align-items: center;
          gap: 4px;
          background: none;
          border: none;
          color: rgba(251,247,238,0.7);
          font-size: 12.5px;
          font-weight: 600;
          cursor: pointer;
          padding: 0;
          margin-bottom: 16px;
        }
        .topic-date-group {
          margin-bottom: 20px;
        }
        .topic-date-label {
          display: block;
          font-family: 'IBM Plex Mono', monospace;
          font-size: 10.5px;
          letter-spacing: 0.6px;
          text-transform: uppercase;
          color: var(--gold);
          margin-bottom: 8px;
        }

        .timeline-track {
          display: flex;
          flex-direction: column;
        }
        .timeline-entry {
          display: flex;
          gap: 14px;
        }
        .timeline-dot-col {
          display: flex;
          flex-direction: column;
          align-items: center;
          flex: none;
        }
        .timeline-icon {
          width: 26px; height: 26px;
          border-radius: 50%;
          background: var(--gold);
          display: flex; align-items: center; justify-content: center;
          flex: none;
        }
        .timeline-line {
          width: 2px;
          flex: 1;
          background: rgba(251,247,238,0.18);
          margin: 4px 0;
        }
        .timeline-content {
          padding-bottom: 26px;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .timeline-date {
          font-family: 'IBM Plex Mono', monospace;
          font-size: 10.5px;
          letter-spacing: 0.6px;
          text-transform: uppercase;
          color: var(--gold);
        }
        .timeline-headline {
          font-size: 14px;
          font-weight: 600;
          color: var(--paper);
          line-height: 1.5;
          text-decoration: none;
        }
        .timeline-headline:hover { text-decoration: underline; }
        .timeline-sample-tag {
          align-self: flex-start;
          font-size: 9.5px;
          font-family: 'IBM Plex Mono', monospace;
          letter-spacing: 0.5px;
          text-transform: uppercase;
          color: rgba(251,247,238,0.45);
          border: 1px solid rgba(251,247,238,0.2);
          border-radius: 8px;
          padding: 1px 6px;
          margin-top: 2px;
        }

        .video-screen {
          height: 100%;
          width: 100%;
          background: linear-gradient(175deg, #FDF1E6 0%, #FCE9DA 60%, #FBDFC6 100%);
          padding: 76px 18px 100px;
          overflow-y: auto;
        }
        .video-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 14px;
          margin-top: 8px;
        }
        .video-card {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .video-thumb {
          position: relative;
          aspect-ratio: 9 / 14;
          border-radius: 12px;
          background-size: cover;
          background-position: center;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
        }
        .video-source-badge {
          position: absolute;
          top: 8px;
          left: 8px;
          width: 22px; height: 22px;
          border-radius: 6px;
          background: rgba(0,0,0,0.5);
          color: #fff;
          display: flex; align-items: center; justify-content: center;
        }
        .x-mark {
          font-size: 11px;
          font-weight: 700;
          line-height: 1;
        }
        .video-play-btn {
          width: 38px; height: 38px;
          border-radius: 50%;
          background: rgba(255,255,255,0.22);
          border: 1.5px solid rgba(255,255,255,0.7);
          display: flex; align-items: center; justify-content: center;
          padding-left: 2px;
        }
        .video-duration {
          position: absolute;
          bottom: 8px;
          right: 8px;
          background: rgba(0,0,0,0.6);
          color: #fff;
          font-size: 10px;
          font-family: 'IBM Plex Mono', monospace;
          padding: 2px 6px;
          border-radius: 6px;
        }
        .video-headline {
          font-size: 12.5px;
          font-weight: 600;
          color: var(--paper);
          line-height: 1.4;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .vocab-screen {
          height: 100%;
          width: 100%;
          background: linear-gradient(175deg, #FDF1E6 0%, #FCE9DA 60%, #FBDFC6 100%);
          padding: 76px 18px 100px;
          overflow-y: auto;
        }
        .vocab-section-label {
          display: block;
          font-family: 'IBM Plex Mono', monospace;
          font-size: 10.5px;
          letter-spacing: 1px;
          text-transform: uppercase;
          color: var(--gold);
          margin: 22px 0 10px;
        }
        .vocab-list {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .vocab-card {
          background: rgba(251,247,238,0.06);
          border: 1px solid rgba(251,247,238,0.14);
          border-radius: 12px;
          padding: 14px 16px;
          width: 100%;
          text-align: left;
          cursor: pointer;
          display: block;
          font-family: inherit;
        }
        .vocab-card:hover {
          background: rgba(251,247,238,0.09);
        }
        .vocab-save-btn {
          background: none;
          border: none;
          color: rgba(251,247,238,0.4);
          cursor: pointer;
          display: flex;
          margin-left: auto;
        }
        .vocab-save-btn.saved { color: var(--gold); }
        .vocab-chevron {
          color: rgba(251,247,238,0.4);
          transition: transform 0.2s ease;
          flex: none;
        }
        .vocab-chevron.open {
          transform: rotate(90deg);
          color: var(--gold);
        }
        .vocab-card-top {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 6px;
        }
        .vocab-word {
          font-family: 'Fraunces', serif;
          font-weight: 700;
          font-size: 16px;
          color: var(--paper);
        }
        .vocab-pos {
          font-family: 'IBM Plex Mono', monospace;
          font-size: 9.5px;
          letter-spacing: 0.5px;
          text-transform: uppercase;
          color: #1B1200;
          background: var(--gold);
          border-radius: 6px;
          padding: 2px 7px;
        }
        .vocab-meaning {
          font-size: 13px;
          color: rgba(251,247,238,0.85);
          line-height: 1.6;
          margin: 0 0 6px;
        }
        .vocab-example-list {
          margin: 0;
          padding: 0;
          list-style: none;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .vocab-example {
          font-size: 12.5px;
          font-style: italic;
          color: rgba(251,247,238,0.55);
          line-height: 1.6;
          padding-left: 14px;
          position: relative;
        }
        .vocab-example::before {
          content: "—";
          position: absolute;
          left: 0;
          opacity: 0.5;
        }

        .vocab-locked-screen {
          height: 100%;
          width: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 10px;
          background: linear-gradient(175deg, #FDF1E6 0%, #FCE9DA 60%, #FBDFC6 100%);
          padding: 0 34px;
          text-align: center;
        }
        .vocab-lock-icon {
          width: 56px; height: 56px;
          border-radius: 50%;
          background: rgba(251,247,238,0.1);
          color: var(--gold);
          display: flex; align-items: center; justify-content: center;
          margin-bottom: 6px;
        }
        .vocab-lock-title {
          font-family: 'Fraunces', serif;
          font-weight: 700;
          font-size: 17px;
          color: var(--paper);
          line-height: 1.4;
        }
        .vocab-lock-sub {
          font-size: 12.5px;
          color: rgba(251,247,238,0.55);
          line-height: 1.6;
          max-width: 260px;
          margin: 0 0 6px;
        }
        .vocab-switch-btn {
          background: var(--gold);
          color: #1B1200;
          border: none;
          border-radius: 20px;
          padding: 10px 20px;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
        }

        .gk-screen {
          height: 100%;
          width: 100%;
          background: linear-gradient(175deg, #FDF1E6 0%, #FCE9DA 60%, #FBDFC6 100%);
          padding: 76px 18px 100px;
          overflow-y: auto;
        }
        .gk-toggle-row {
          display: flex;
          gap: 8px;
          margin: 18px 0 4px;
        }
        .gk-toggle-btn {
          flex: 1;
          background: rgba(251,247,238,0.06);
          border: 1px solid rgba(251,247,238,0.18);
          color: rgba(251,247,238,0.7);
          border-radius: 10px;
          padding: 10px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
        }
        .gk-toggle-btn.active {
          background: var(--gold);
          border-color: var(--gold);
          color: #1B1200;
        }
        .gk-summary-heading {
          display: block;
          font-family: 'IBM Plex Mono', monospace;
          font-size: 10px;
          letter-spacing: 0.4px;
          text-transform: uppercase;
          color: var(--gold);
          margin-bottom: 3px;
        }
        .gk-accordion {
          display: flex;
          flex-direction: column;
          gap: 10px;
          margin-top: 16px;
        }
        .gk-acc-item {
          background: rgba(251,247,238,0.05);
          border: 1px solid rgba(251,247,238,0.14);
          border-radius: 12px;
          overflow: hidden;
        }
        .gk-acc-header {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          background: none;
          border: none;
          padding: 14px 16px;
          cursor: pointer;
          text-align: left;
        }
        .gk-acc-header.open {
          background: rgba(251,247,238,0.05);
        }
        .gk-acc-header-text {
          display: flex;
          flex-direction: column;
          gap: 3px;
          min-width: 0;
        }
        .gk-acc-date {
          font-family: 'IBM Plex Mono', monospace;
          font-size: 10px;
          letter-spacing: 0.6px;
          text-transform: uppercase;
          color: var(--gold);
        }
        .gk-acc-title {
          font-family: 'Fraunces', 'Noto Serif Bengali', serif;
          font-weight: 700;
          font-size: 14.5px;
          color: var(--paper);
          line-height: 1.4;
        }
        .gk-acc-summary .gk-acc-title {
          color: #ffb4bf;
        }
        .gk-acc-chevron {
          flex: none;
          color: rgba(251,247,238,0.4);
          transition: transform 0.2s ease;
        }
        .gk-acc-chevron.open {
          transform: rotate(90deg);
          color: var(--gold);
        }
        .gk-acc-body {
          padding: 4px 16px 16px;
          border-top: 1px solid rgba(251,247,238,0.1);
          padding-top: 14px;
        }
        .gk-bullet-list {
          list-style: none;
          margin: 0;
          padding: 0;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .gk-bullet-item {
          display: flex;
          gap: 10px;
        }
        .gk-bullet-dot {
          flex: none;
          width: 6px; height: 6px;
          border-radius: 50%;
          background: var(--gold);
          margin-top: 7px;
        }
        .gk-bullet-body {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .gk-bullet-head {
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .gk-save-btn {
          margin-left: auto;
          background: none;
          border: none;
          color: rgba(251,247,238,0.4);
          cursor: pointer;
          display: flex;
        }
        .gk-save-btn.saved { color: var(--gold); }
        .gk-cat-tag {
          font-family: 'IBM Plex Mono', monospace;
          font-size: 9px;
          letter-spacing: 0.5px;
          text-transform: uppercase;
          border-radius: 6px;
          padding: 2px 7px;
        }
        .gk-cat-tag.national {
          background: rgba(4,103,63,0.35);
          color: #8FE0BC;
        }
        .gk-cat-tag.international {
          background: rgba(184,134,59,0.25);
          color: var(--gold);
        }
        .gk-sample-tag {
          font-size: 9px;
          font-family: 'IBM Plex Mono', monospace;
          letter-spacing: 0.5px;
          text-transform: uppercase;
          color: rgba(251,247,238,0.4);
          border: 1px solid rgba(251,247,238,0.2);
          border-radius: 6px;
          padding: 1px 6px;
        }
        .gk-bullet-text {
          font-size: 13.5px;
          color: rgba(251,247,238,0.9);
          line-height: 1.6;
          margin: 0;
        }
        .gk-view-link {
          font-size: 11.5px;
          font-weight: 600;
          color: var(--gold);
          text-decoration: none;
        }
        .gk-view-link:hover { text-decoration: underline; }

        .job-screen {
          height: 100%;
          width: 100%;
          background: linear-gradient(175deg, #FDF1E6 0%, #FCE9DA 60%, #FBDFC6 100%);
          padding: 76px 18px 100px;
          overflow-y: auto;
        }
        .job-list {
          display: flex;
          flex-direction: column;
          gap: 10px;
          margin-top: 14px;
        }
        .job-card {
          display: flex;
          gap: 12px;
          background: rgba(251,247,238,0.06);
          border: 1px solid rgba(251,247,238,0.14);
          border-radius: 12px;
          padding: 14px 16px;
        }
        .job-icon-box {
          flex: none;
          width: 38px; height: 38px;
          border-radius: 10px;
          background: rgba(184,134,59,0.2);
          color: var(--gold);
          display: flex; align-items: center; justify-content: center;
        }
        .job-card-body {
          display: flex;
          flex-direction: column;
          gap: 3px;
          min-width: 0;
        }
        .job-title {
          font-size: 14px;
          font-weight: 700;
          color: var(--paper);
          line-height: 1.4;
          text-decoration: none;
        }
        .job-title:hover { text-decoration: underline; }
        .job-org {
          font-size: 12.5px;
          color: rgba(251,247,238,0.6);
        }
        .job-card-foot {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          margin-top: 6px;
        }
        .job-deadline {
          font-family: 'IBM Plex Mono', monospace;
          font-size: 10.5px;
          color: rgba(251,247,238,0.5);
        }
        .job-link {
          font-size: 11.5px;
          font-weight: 600;
          color: var(--gold);
          text-decoration: none;
          white-space: nowrap;
        }
        .job-link:hover { text-decoration: underline; }

        .exam-screen {
          height: 100%;
          width: 100%;
          background: linear-gradient(175deg, #FDF1E6 0%, #FCE9DA 60%, #FBDFC6 100%);
          padding: 76px 18px 100px;
          overflow-y: auto;
        }
        .exam-embedded {
          width: 100%;
        }
        .exam-toggle-row .gk-toggle-btn {
          font-size: 10px;
          padding: 10px 4px;
          line-height: 1.3;
        }
        .exam-content-toggle {
          margin-top: 10px;
        }
        .exam-content-toggle .gk-toggle-btn {
          font-size: 12.5px;
        }
        .quiz-build-error {
          font-size: 12px;
          color: #ff8f9c;
          text-align: center;
          margin: 0 0 10px;
        }
        .test-history {
          margin-top: 8px;
        }
        .stat-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 10px;
          margin: 10px 0 22px;
        }
        .stat-card {
          background: rgba(251,247,238,0.06);
          border: 1px solid rgba(251,247,238,0.14);
          border-radius: 12px;
          padding: 14px;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .stat-card-wide {
          grid-column: span 2;
        }
        .stat-value {
          font-family: 'Fraunces', serif;
          font-weight: 700;
          font-size: 22px;
          color: var(--gold);
        }
        .stat-label {
          font-size: 11px;
          color: rgba(251,247,238,0.6);
        }
        .test-history-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .test-history-row {
          display: flex;
          align-items: center;
          gap: 12px;
          background: rgba(251,247,238,0.05);
          border: 1px solid rgba(251,247,238,0.12);
          border-radius: 10px;
          padding: 10px 12px;
        }
        .test-history-icon {
          flex: none;
          width: 34px; height: 34px;
          border-radius: 10px;
          display: flex; align-items: center; justify-content: center;
          color: #fff;
        }
        .test-history-icon.vocab { background: #2F6FED; }
        .test-history-icon.gk { background: var(--green); }
        .test-history-body {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .test-history-type {
          font-size: 13px;
          font-weight: 600;
          color: var(--paper);
        }
        .test-history-date {
          font-size: 10.5px;
          color: rgba(251,247,238,0.5);
        }
        .test-history-pct {
          font-family: 'IBM Plex Mono', monospace;
          font-size: 11.5px;
          font-weight: 700;
          padding: 4px 8px;
          border-radius: 8px;
        }
        .test-history-pct.good { background: rgba(63,191,127,0.18); color: #7ee8ab; }
        .test-history-pct.mid { background: rgba(184,134,59,0.2); color: var(--gold); }
        .test-history-pct.low { background: rgba(227,28,46,0.18); color: #ff8f9c; }
        .quiz-locked-inline {
          height: auto;
          background: none;
          padding: 30px 10px 10px;
        }
        .quiz-runner {
          margin-top: 18px;
          background: rgba(251,247,238,0.05);
          border: 1px solid rgba(251,247,238,0.14);
          border-radius: 16px;
          padding: 18px;
        }
        .quiz-start-box {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          padding: 30px 10px 10px;
          gap: 6px;
        }
        .quiz-start-icon {
          width: 52px; height: 52px;
          border-radius: 50%;
          background: rgba(184,134,59,0.2);
          color: var(--gold);
          display: flex; align-items: center; justify-content: center;
          margin-bottom: 8px;
        }
        .quiz-start-title {
          font-family: 'Fraunces', 'Noto Serif Bengali', serif;
          font-weight: 700;
          font-size: 17px;
          color: var(--paper);
          margin: 0;
        }
        .quiz-start-sub {
          font-size: 12.5px;
          color: rgba(251,247,238,0.6);
          margin: 0 0 18px;
        }
        .quiz-start-btn {
          width: 100%;
          max-width: 220px;
        }
        .exam-length-options {
          display: flex;
          gap: 10px;
          width: 100%;
          margin-bottom: 18px;
        }
        .exam-length-card {
          flex: 1;
          background: rgba(251,247,238,0.06);
          border: 2px solid rgba(251,247,238,0.18);
          border-radius: 12px;
          padding: 14px 10px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 6px;
          cursor: pointer;
        }
        .exam-length-card.active {
          border-color: var(--gold);
          background: rgba(184,134,59,0.15);
        }
        .exam-length-q {
          font-family: 'Fraunces', serif;
          font-weight: 700;
          font-size: 15px;
          color: var(--paper);
        }
        .exam-length-t {
          display: flex;
          align-items: center;
          gap: 4px;
          font-family: 'IBM Plex Mono', monospace;
          font-size: 11px;
          color: rgba(251,247,238,0.6);
        }
        .quiz-top-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 12px;
        }
        .quiz-timer {
          display: flex;
          align-items: center;
          gap: 4px;
          font-family: 'IBM Plex Mono', monospace;
          font-size: 11.5px;
          font-weight: 700;
          color: rgba(251,247,238,0.7);
          background: rgba(251,247,238,0.08);
          border-radius: 8px;
          padding: 3px 8px;
        }
        .quiz-timer.low {
          color: #ff8f9c;
          background: rgba(227,28,46,0.15);
        }
        .quiz-dot-row {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          margin-bottom: 16px;
        }
        .quiz-dot {
          width: 26px; height: 26px;
          border-radius: 50%;
          background: rgba(251,247,238,0.08);
          border: 1px solid rgba(251,247,238,0.2);
          color: rgba(251,247,238,0.6);
          font-family: 'IBM Plex Mono', monospace;
          font-size: 10.5px;
          font-weight: 700;
          cursor: pointer;
        }
        .quiz-dot.answered {
          background: rgba(184,134,59,0.25);
          border-color: var(--gold);
          color: var(--gold);
        }
        .quiz-dot.active {
          border-color: #fff;
          color: #fff;
          background: rgba(251,247,238,0.18);
        }
        .quiz-q-count {
          display: block;
          font-family: 'IBM Plex Mono', monospace;
          font-size: 10.5px;
          letter-spacing: 0.6px;
          text-transform: uppercase;
          color: var(--gold);
        }
        .quiz-question {
          font-family: 'Fraunces', 'Noto Serif Bengali', serif;
          font-weight: 700;
          font-size: 16.5px;
          line-height: 1.5;
          color: var(--paper);
          margin: 0 0 16px;
        }
        .quiz-options {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .quiz-opt {
          background: rgba(251,247,238,0.06);
          border: 2px solid rgba(251,247,238,0.16);
          border-radius: 10px;
          padding: 12px 14px;
          font-size: 13.5px;
          color: var(--paper);
          text-align: left;
          cursor: pointer;
        }
        .quiz-opt.picked {
          border-color: #2F6FED;
          background: rgba(47,111,237,0.16);
          color: #cfe0ff;
        }
        .quiz-opt.correct {
          border-color: #3FBF7F;
          background: rgba(63,191,127,0.15);
          color: #baf5d3;
        }
        .quiz-opt.wrong {
          border-color: #E31C2E;
          background: rgba(227,28,46,0.15);
          color: #ffb4bf;
        }
        .quiz-answered-count {
          display: block;
          margin-top: 12px;
          font-size: 11px;
          color: rgba(251,247,238,0.5);
          text-align: center;
        }
        .quiz-nav-row {
          display: flex;
          gap: 10px;
          margin-top: 14px;
        }
        .quiz-prev-btn {
          display: flex;
          align-items: center;
          gap: 2px;
          background: rgba(251,247,238,0.08);
          border: 1px solid rgba(251,247,238,0.2);
          color: var(--paper);
          border-radius: 10px;
          padding: 12px 16px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
        }
        .quiz-prev-btn:disabled { opacity: 0.35; cursor: not-allowed; }
        .quiz-next-btn {
          flex: 1;
          background: var(--gold);
          color: #1B1200;
          border: none;
          border-radius: 10px;
          padding: 12px;
          font-size: 14px;
          font-weight: 700;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 4px;
          cursor: pointer;
        }
        .quiz-submit-btn {
          background: #C8102E;
          color: #fff;
        }
        .quiz-review {
          width: 100%;
          text-align: left;
          margin: 22px 0;
        }
        .quiz-review-item {
          background: rgba(251,247,238,0.05);
          border: 1px solid rgba(251,247,238,0.12);
          border-radius: 10px;
          padding: 12px 14px;
          margin-bottom: 8px;
        }
        .quiz-review-q {
          font-size: 13px;
          font-weight: 600;
          color: var(--paper);
          margin: 0 0 6px;
          line-height: 1.5;
        }
        .quiz-review-a {
          font-size: 12px;
          margin: 2px 0;
          line-height: 1.5;
        }
        .quiz-review-a.correct { color: #7ee8ab; }
        .quiz-review-a.wrong { color: #ff8f9c; }
        .quiz-result {
          margin-top: 30px;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          gap: 6px;
        }
        .quiz-result-icon {
          width: 60px; height: 60px;
          border-radius: 50%;
          background: linear-gradient(160deg, #E8A33D, #C8102E);
          display: flex; align-items: center; justify-content: center;
          margin-bottom: 8px;
        }
        .quiz-result-title {
          font-family: 'Fraunces', 'Noto Serif Bengali', serif;
          font-weight: 700;
          font-size: 19px;
          color: var(--paper);
          margin: 0;
        }
        .quiz-result-score {
          font-size: 13.5px;
          color: rgba(251,247,238,0.7);
          margin: 0 0 14px;
        }
        .quiz-result-bar {
          width: 100%;
          max-width: 220px;
          height: 8px;
          border-radius: 4px;
          background: rgba(251,247,238,0.12);
          overflow: hidden;
          margin-bottom: 20px;
        }
        .quiz-result-bar-fill {
          height: 100%;
          background: var(--gold);
        }
        .quiz-retake-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          background: rgba(251,247,238,0.1);
          border: 1px solid rgba(251,247,238,0.25);
          color: var(--paper);
          border-radius: 20px;
          padding: 10px 20px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
        }

        .ritual-screen {
          height: 100%;
          width: 100%;
          background: linear-gradient(175deg, #FDF1E6 0%, #FCE9DA 60%, #FBDFC6 100%);
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          padding: 24px 18px 160px;
        }
        .ritual-card {
          max-width: 640px;
          width: 100%;
          margin: 0 auto;
        }
        .ritual-eyebrow {
          text-align: center;
          color: #8A8078;
          font-size: 14px;
          line-height: 1.6;
          margin: 0 0 18px;
        }
        .ritual-question {
          text-align: center;
          font-family: 'Fraunces', 'Noto Serif Bengali', serif;
          font-weight: 700;
          font-size: 21px;
          color: #262220;
          margin: 0 0 26px;
        }
        .ritual-options {
          display: flex;
          flex-direction: column;
          gap: 14px;
        }
        .ritual-opt {
          display: flex;
          align-items: center;
          gap: 16px;
          background: #fff;
          border: 2px solid transparent;
          border-radius: 14px;
          padding: 14px 16px;
          box-shadow: 0 3px 10px rgba(80,50,20,0.08);
          cursor: pointer;
          text-align: left;
        }
        .ritual-opt.active {
          border-color: #2F6FED;
          box-shadow: 0 3px 14px rgba(47,111,237,0.18);
        }
        .ritual-icon-box {
          flex: none;
          width: 56px;
          height: 56px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .ritual-opt-label {
          font-size: 15.5px;
          font-weight: 600;
          color: #262220;
          line-height: 1.4;
        }
        .ritual-step-label {
          display: block;
          font-family: 'IBM Plex Mono', monospace;
          font-size: 10.5px;
          letter-spacing: 1px;
          text-transform: uppercase;
          color: #D97757;
          margin: 4px 0 4px;
        }

        .ritual-simple-list {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .ritual-simple-opt {
          background: #fff;
          border: 2px solid transparent;
          border-radius: 12px;
          padding: 14px 16px;
          font-size: 14.5px;
          font-weight: 600;
          color: #262220;
          text-align: left;
          cursor: pointer;
          box-shadow: 0 3px 10px rgba(80,50,20,0.08);
        }
        .ritual-simple-opt.active {
          border-color: #2F6FED;
          box-shadow: 0 3px 14px rgba(47,111,237,0.18);
        }

        .ritual-chip-grid {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }
        .ritual-chip {
          background: #fff;
          border: 2px solid transparent;
          border-radius: 20px;
          padding: 8px 16px;
          font-size: 13px;
          font-weight: 600;
          color: #4a453d;
          cursor: pointer;
          box-shadow: 0 2px 6px rgba(80,50,20,0.08);
        }
        .ritual-chip.active {
          border-color: #2F6FED;
          background: #EAF1FF;
          color: #1B4DB0;
        }
        .ritual-other-input {
          margin-top: 12px;
          width: 100%;
          border-radius: 10px;
          border: 1px solid rgba(0,0,0,0.12);
          background: #fff;
          color: #262220;
          padding: 11px 14px;
          font-size: 13.5px;
          outline: none;
        }

        .ritual-nav-row {
          position: fixed;
          right: 20px;
          bottom: 90px;
          left: 20px;
          display: flex;
          justify-content: flex-end;
          align-items: center;
          gap: 10px;
        }
        .ritual-back {
          background: rgba(0,0,0,0.06);
          color: #262220;
          border: none;
          border-radius: 24px;
          padding: 12px 18px;
          font-size: 14px;
          font-weight: 600;
          display: flex;
          align-items: center;
          gap: 4px;
          cursor: pointer;
        }
        .ritual-next {
          background: #E31C2E;
          color: #fff;
          border: none;
          border-radius: 24px;
          padding: 12px 22px;
          font-size: 15px;
          font-weight: 700;
          display: flex;
          align-items: center;
          gap: 4px;
          cursor: pointer;
          box-shadow: 0 6px 16px rgba(227,28,46,0.35);
        }
        .ritual-next:disabled {
          opacity: 0.4;
          cursor: not-allowed;
          box-shadow: none;
        }

        .ritual-done-screen {
          align-items: center;
          text-align: center;
          justify-content: center;
        }
        .ritual-badge-circle {
          width: 76px; height: 76px;
          border-radius: 50%;
          background: linear-gradient(160deg, #E8A33D, #C8102E);
          display: flex; align-items: center; justify-content: center;
          box-shadow: 0 10px 24px rgba(200,16,46,0.35);
          margin-bottom: 10px;
        }
        .ritual-badge-name {
          font-family: 'IBM Plex Mono', monospace;
          font-size: 11.5px;
          letter-spacing: 1px;
          text-transform: uppercase;
          color: #8A5A1E;
          margin-bottom: 18px;
        }
        .ritual-done-title {
          display: flex;
          align-items: center;
          gap: 8px;
          font-family: 'Fraunces', 'Noto Serif Bengali', serif;
          font-weight: 700;
          font-size: 21px;
          color: #262220;
          margin: 0 0 8px;
        }
        .ritual-done-sub {
          font-size: 13.5px;
          color: #6b6156;
          max-width: 320px;
          line-height: 1.6;
          margin: 0 0 22px;
        }
        .ritual-streak-track {
          display: flex;
          gap: 8px;
          margin-bottom: 20px;
        }
        .streak-dot {
          width: 30px; height: 30px;
          border-radius: 50%;
          background: #fff;
          border: 1px solid rgba(0,0,0,0.1);
          display: flex; align-items: center; justify-content: center;
          font-size: 11px;
          font-weight: 700;
          color: #a39c90;
        }
        .streak-dot.filled {
          background: #E31C2E;
          border-color: #E31C2E;
          color: #fff;
        }
        .ritual-badge-note {
          font-size: 12px;
          color: #8a8078;
          max-width: 260px;
          line-height: 1.6;
        }

        .ritual-feed-screen {
          height: 100%;
          width: 100%;
          background: linear-gradient(175deg, #FDF1E6 0%, #FCE9DA 60%, #FBDFC6 100%);
          padding: 76px 18px 100px;
          overflow-y: auto;
        }
        .ritual-feed-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          margin-bottom: 18px;
        }
        .ritual-streak-badge {
          display: flex;
          align-items: center;
          gap: 6px;
          background: rgba(227,28,46,0.15);
          border: 1px solid rgba(227,28,46,0.3);
          border-radius: 20px;
          padding: 6px 12px;
        }
        .ritual-streak-day {
          font-family: 'IBM Plex Mono', monospace;
          font-size: 12px;
          font-weight: 700;
          color: #ffb4bf;
        }
        .ritual-mark-btn {
          flex: 1;
          max-width: 220px;
          background: var(--gold);
          color: #1B1200;
          border: none;
          border-radius: 20px;
          padding: 8px 14px;
          font-size: 11.5px;
          font-weight: 700;
          cursor: pointer;
        }
        .ritual-badge-row {
          display: flex;
          gap: 8px;
          overflow-x: auto;
          margin: 10px 0 4px;
        }
        .ritual-badge-chip {
          flex: none;
          display: flex;
          align-items: center;
          gap: 6px;
          border-radius: 20px;
          padding: 7px 12px;
          border: 2px solid transparent;
          cursor: pointer;
          font-size: 11.5px;
          font-weight: 600;
          color: #fff;
        }
        .ritual-badge-chip.locked {
          background: rgba(251,247,238,0.06);
          color: rgba(251,247,238,0.4);
          cursor: not-allowed;
        }
        .ritual-badge-chip.displayed {
          border-color: #fff;
        }
        .ritual-badge-chip-label {
          white-space: nowrap;
        }
        .ritual-next-badge-note {
          font-size: 11px;
          color: rgba(251,247,238,0.45);
          margin: 0 0 20px;
        }
        .ritual-feed-list {
          margin-top: 12px;
        }

        .profile-badge-mini-row {
          display: flex;
          gap: 6px;
          margin: 4px 0 2px;
        }
        .profile-badge-mini {
          width: 24px; height: 24px;
          border-radius: 50%;
          border: 2px solid transparent;
          display: flex; align-items: center; justify-content: center;
          cursor: pointer;
        }
        .profile-badge-mini.active {
          border-color: #fff;
        }

        .cat-menu-screen {
          height: 100%;
          width: 100%;
          background: linear-gradient(175deg, #FDF1E6 0%, #FCE9DA 60%, #FBDFC6 100%);
          padding: 76px 18px 100px;
          overflow-y: auto;
        }
        .cat-menu-title {
          font-family: 'Fraunces', 'Noto Serif Bengali', serif;
          font-weight: 700;
          font-size: 22px;
          color: var(--paper);
          margin: 8px 0 20px;
        }
        .cat-menu-line {
          display: flex;
          flex-wrap: nowrap;
          overflow-x: auto;
          gap: 10px;
          padding-bottom: 6px;
        }
        .cat-menu-line::-webkit-scrollbar { display: none; }
        .cat-menu-chip {
          flex: none;
          display: flex;
          align-items: center;
          gap: 7px;
          background: rgba(251,247,238,0.06);
          border: 1px solid rgba(251,247,238,0.18);
          border-radius: 20px;
          padding: 10px 16px;
          cursor: pointer;
          color: rgba(251,247,238,0.75);
          white-space: nowrap;
        }
        .cat-menu-chip.active {
          background: var(--gold);
          border-color: var(--gold);
          color: #1B1200;
          font-weight: 700;
        }
        .cat-menu-chip-label {
          font-size: 13.5px;
          font-weight: 600;
        }
        .cat-prefs-label {
          margin-top: 26px;
        }
        .cat-prefs-title {
          margin-top: 0;
          margin-bottom: 4px;
        }
        .cat-notif-header-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-top: 30px;
        }
        .cat-section-header-btn {
          background: none;
          border: none;
          padding: 0;
          cursor: pointer;
          width: 100%;
        }
        .cat-section-title-icon {
          vertical-align: -3px;
          margin-right: 2px;
        }
        .cat-notif-title {
          margin: 8px 0 4px !important;
        }
        .cat-notif-viewall {
          background: none;
          border: none;
          color: var(--gold);
          font-size: 12.5px;
          font-weight: 700;
          cursor: pointer;
        }
        .cat-notif-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .cat-notif-hint {
          font-size: 10.5px;
          color: #8a8078;
          margin: -2px 0 12px;
        }
        .cat-notif-group {
          margin-bottom: 16px;
        }
        .cat-notif-group-title {
          display: flex;
          align-items: center;
          gap: 6px;
          font-family: 'IBM Plex Mono', monospace;
          font-size: 10.5px;
          letter-spacing: 0.5px;
          text-transform: uppercase;
          color: var(--gold);
          margin-bottom: 8px;
        }
        .cat-notif-group-title-btn {
          background: none;
          border: none;
          padding: 0;
          cursor: pointer;
          width: 100%;
          text-align: left;
        }
        .cat-popup-sheet {
          max-height: 78vh;
          display: flex;
          flex-direction: column;
          background: linear-gradient(175deg, #FDF1E6 0%, #FCE9DA 60%, #FBDFC6 100%);
        }
        .cat-popup-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 2px;
        }
        .cat-popup-title {
          display: flex;
          align-items: center;
          gap: 8px;
          font-family: 'Fraunces', 'Noto Serif Bengali', serif;
          font-weight: 700;
          font-size: 16px;
          color: #1B1200;
        }
        .cat-popup-count {
          font-family: 'IBM Plex Mono', monospace;
          font-size: 11px;
          color: var(--gold);
          background: rgba(184,134,59,0.18);
          border-radius: 10px;
          padding: 2px 8px;
        }
        .cat-popup-list {
          overflow-y: auto;
          margin-bottom: 14px;
          padding-right: 2px;
        }
        .cat-popup-feed-btn {
          margin-bottom: 10px;
        }
        .cat-popup-sheet .share-sheet-handle {
          background: rgba(0,0,0,0.15);
        }
        .cat-notif-row {
          display: flex;
          align-items: center;
          gap: 10px;
          width: 100%;
          background: rgba(0,0,0,0.04);
          border: 1px solid rgba(0,0,0,0.08);
          border-radius: 12px;
          padding: 10px 12px;
          text-decoration: none;
          font-family: inherit;
          cursor: pointer;
          text-align: left;
        }
        .cat-notif-icon {
          flex: none;
          width: 34px; height: 34px;
          border-radius: 50%;
          overflow: hidden;
          background: rgba(0,0,0,0.06);
          display: flex; align-items: center; justify-content: center;
        }
        .cat-notif-icon-img {
          width: 100%; height: 100%;
          object-fit: cover;
        }
        .cat-notif-text {
          display: flex;
          flex-direction: column;
          gap: 2px;
          min-width: 0;
        }
        .cat-notif-headline {
          font-size: 12.5px;
          font-weight: 600;
          color: var(--paper);
          line-height: 1.4;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .cat-prefs-link-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          width: 100%;
          background: rgba(251,247,238,0.05);
          border: 1px solid rgba(251,247,238,0.14);
          border-radius: 14px;
          padding: 16px;
          margin-top: 28px;
          cursor: pointer;
          text-align: left;
        }
        .cat-prefs-link-text {
          display: flex;
          flex-direction: column;
        }
        .pref-cat-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
          margin: 10px 0 22px;
        }
        .pref-cat-row-dark {
          background: rgba(251,247,238,0.05);
          border: 1px solid rgba(251,247,238,0.12);
          border-radius: 10px;
          padding: 10px 12px;
        }
        .pref-cat-name-dark {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 12.5px;
          font-weight: 600;
          color: var(--paper);
          margin-bottom: 8px;
        }
        .pref-cat-options {
          display: flex;
          gap: 6px;
        }
        .pref-opt-dark {
          flex: 1;
          background: rgba(251,247,238,0.06);
          border: 1px solid rgba(251,247,238,0.16);
          color: rgba(251,247,238,0.7);
          border-radius: 8px;
          padding: 6px 4px;
          font-size: 10.5px;
          font-weight: 600;
          cursor: pointer;
        }
        .pref-opt-dark.active {
          background: rgba(251,247,238,0.2);
          border-color: #fff;
          color: #fff;
        }
        .pref-opt-dark.interested.active {
          background: rgba(63,191,127,0.25);
          border-color: #3FBF7F;
          color: #7ee8ab;
        }
        .pref-opt-dark.not-interested.active {
          background: rgba(227,28,46,0.2);
          border-color: #E31C2E;
          color: #ff8f9c;
        }

        .profile-screen {
          height: 100%;
          width: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 10px;
          background: linear-gradient(175deg, #FDF1E6 0%, #FCE9DA 60%, #FBDFC6 100%);
          padding: 0 30px;
          text-align: center;
        }
        .profile-avatar-wrap {
          position: relative;
          margin-bottom: 6px;
        }
        .profile-avatar {
          width: 64px; height: 64px;
          border-radius: 50%;
          background: rgba(251,247,238,0.1);
          color: var(--gold);
          display: flex; align-items: center; justify-content: center;
          margin-bottom: 0;
        }
        .profile-badge-dot {
          position: absolute;
          right: -2px;
          bottom: -2px;
          width: 24px; height: 24px;
          border-radius: 50%;
          background: linear-gradient(160deg, #E8A33D, #C8102E);
          border: 2px solid var(--ink);
          display: flex; align-items: center; justify-content: center;
        }
        .profile-badge-card {
          margin-top: 14px;
          background: rgba(251,247,238,0.08);
          border: 1px solid rgba(251,247,238,0.2);
          border-radius: 14px;
          padding: 14px 18px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
        }
        .profile-badge-name {
          display: flex;
          align-items: center;
          gap: 6px;
          font-family: 'IBM Plex Mono', monospace;
          font-size: 11.5px;
          letter-spacing: 0.5px;
          text-transform: uppercase;
          color: var(--gold);
        }
        .profile-streak-line {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 12.5px;
          color: rgba(251,247,238,0.8);
        }
        .profile-share-btn {
          margin-top: 4px;
          background: var(--gold);
          color: #1B1200;
          border: none;
          border-radius: 20px;
          padding: 7px 16px;
          font-size: 12px;
          font-weight: 700;
          display: flex;
          align-items: center;
          gap: 5px;
          cursor: pointer;
        }

        .profile-screen.profile-main {
          justify-content: flex-start;
          padding: 24px 20px 100px;
          overflow-y: auto;
        }
        .profile-main-header {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 20px;
        }
        .profile-main-title {
          font-family: 'Fraunces', 'Noto Serif Bengali', serif;
          font-weight: 700;
          font-size: 22px;
          color: var(--paper);
        }
        .profile-settings-btn {
          width: 36px; height: 36px;
          border-radius: 50%;
          background: rgba(251,247,238,0.1);
          border: none;
          color: var(--gold);
          display: flex; align-items: center; justify-content: center;
          cursor: pointer;
        }
        .profile-settings-dropdown {
          top: 42px;
          width: 200px;
        }
        .settings-toggle-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: rgba(251,247,238,0.06);
          border: 1px solid rgba(251,247,238,0.14);
          border-radius: 12px;
          padding: 14px 16px;
        }
        .settings-toggle-pill {
          font-family: 'IBM Plex Mono', monospace;
          font-size: 10.5px;
          font-weight: 700;
          padding: 3px 9px;
          border-radius: 10px;
          background: rgba(63,191,127,0.2);
          color: #7ee8ab;
        }
        .settings-toggle-pill.off {
          background: rgba(251,247,238,0.1);
          color: rgba(251,247,238,0.5);
        }
        .options-screen {
          background: #FBFBFA;
          border-radius: 12px;
          margin-top: 4px;
          flex-shrink: 0;
        }
        .opt-row {
          display: flex;
          align-items: center;
          gap: 16px;
          width: 100%;
          background: none;
          border: none;
          padding: 18px 4px;
          text-align: left;
          cursor: default;
        }
        .opt-row-clickable { cursor: pointer; }
        .opt-row-tall { align-items: flex-start; }
        .opt-icon {
          flex: none;
          width: 22px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--gold);
        }
        .opt-icon-aa {
          font-family: 'Fraunces', serif;
          font-weight: 700;
          font-size: 15px;
          color: #2B2B2E;
        }
        .opt-label {
          flex: 1;
          font-size: 15.5px;
          color: #2B2B2E;
        }
        .opt-label-col {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .opt-sublabel {
          font-size: 11.5px;
          color: #8a8078;
        }
        .opt-chevron {
          color: var(--gold);
          transition: transform 0.2s ease;
        }
        .opt-chevron.open { transform: rotate(90deg); }
        .opt-divider {
          height: 1px;
          background: #ECE7DD;
          margin: 0 4px;
        }

        .opt-dropdown-wrap { position: relative; }
        .opt-value-btn {
          display: flex;
          align-items: center;
          gap: 4px;
          background: none;
          border: none;
          color: var(--gold);
          font-size: 15px;
          cursor: pointer;
          padding: 0;
        }
        .opt-dropdown-menu {
          position: absolute;
          top: 28px;
          right: 0;
          z-index: 20;
          background: #fff;
          border: 1px solid #ECE7DD;
          border-radius: 10px;
          box-shadow: 0 8px 24px rgba(0,0,0,0.12);
          overflow: hidden;
          min-width: 140px;
        }
        .opt-dropdown-item {
          display: block;
          width: 100%;
          background: none;
          border: none;
          text-align: left;
          padding: 10px 14px;
          font-size: 13.5px;
          color: #2B2B2E;
          cursor: pointer;
        }
        .opt-dropdown-item:hover { background: #F5F2EA; }
        .opt-dropdown-item.active { color: #2F6FED; font-weight: 700; }

        .opt-switch {
          flex: none;
          width: 42px; height: 24px;
          border-radius: 12px;
          background: #DDD8CC;
          border: none;
          position: relative;
          cursor: pointer;
          transition: background 0.2s ease;
        }
        .opt-switch.on { background: #2F6FED; }
        .opt-switch-knob {
          position: absolute;
          top: 3px; left: 3px;
          width: 18px; height: 18px;
          border-radius: 50%;
          background: #fff;
          box-shadow: 0 1px 3px rgba(0,0,0,0.25);
          transition: left 0.2s ease;
        }
        .opt-switch.on .opt-switch-knob { left: 21px; }

        .opt-expand-panel {
          padding: 4px 4px 18px;
        }
        .opt-expand-toprow {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 10px;
        }
        .opt-expand-label {
          font-size: 13.5px;
          font-weight: 600;
          color: #2B2B2E;
        }
        .opt-expand-sublabel {
          display: block;
          font-size: 13px;
          font-weight: 700;
          color: #2B2B2E;
          margin-bottom: 4px;
        }
        .opt-expand-desc {
          font-size: 12px;
          color: #8a8078;
          line-height: 1.6;
          margin: 0 0 10px;
        }
        .opt-pause-block {
          padding-top: 10px;
          border-top: 1px solid #ECE7DD;
        }
        .pause-chip-row {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }
        .pause-chip-light {
          background: #F5F2EA;
          border: 1px solid #E4DFD2;
          color: #2B2B2E;
          border-radius: 16px;
          padding: 6px 12px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
        }
        .pause-status-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          background: #FDF1E6;
          border: 1px solid #E8CFA6;
          border-radius: 10px;
          padding: 10px 12px;
        }
        .pause-status-text {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          font-weight: 600;
          color: #8A5A1E;
        }
        .pause-resume-btn {
          background: #D97757;
          color: #fff;
          border: none;
          border-radius: 14px;
          padding: 6px 12px;
          font-size: 11px;
          font-weight: 700;
          cursor: pointer;
          white-space: nowrap;
        }
        .pref-cat-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .pref-cat-row-light {
          background: #F5F2EA;
          border: 1px solid #ECE7DD;
          border-radius: 10px;
          padding: 10px 12px;
        }
        .pref-cat-name-light {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 12.5px;
          font-weight: 600;
          color: #2B2B2E;
          margin-bottom: 8px;
        }
        .pref-cat-options {
          display: flex;
          gap: 6px;
        }
        .pref-opt-light {
          flex: 1;
          background: #fff;
          border: 1px solid #E4DFD2;
          color: #6b6156;
          border-radius: 8px;
          padding: 6px 4px;
          font-size: 10.5px;
          font-weight: 600;
          cursor: pointer;
        }
        .pref-opt-light.active {
          background: #2B2B2E;
          border-color: #2B2B2E;
          color: #fff;
        }
        .pref-opt-light.interested.active {
          background: #3FBF7F;
          border-color: #3FBF7F;
          color: #fff;
        }
        .pref-opt-light.not-interested.active {
          background: #E31C2E;
          border-color: #E31C2E;
          color: #fff;
        }
        .static-page-body {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .static-page-body p {
          font-size: 13px;
          line-height: 1.7;
          color: #262220;
          margin: 0;
        }
        .static-page-section {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .static-page-heading {
          font-family: 'Fraunces', 'Noto Serif Bengali', serif;
          font-weight: 700;
          font-size: 14px;
          color: var(--gold);
          margin: 0;
        }
        .profile-avatar-wrap-lg {
          margin-bottom: 14px;
        }
        .profile-avatar-letter {
          width: 84px; height: 84px;
          border-radius: 50%;
          background: var(--green);
          border: 3px solid var(--gold);
          color: #fff;
          font-family: 'Fraunces', serif;
          font-size: 34px;
          font-weight: 700;
          display: flex; align-items: center; justify-content: center;
        }
        .profile-display-name {
          font-family: 'Fraunces', 'Noto Serif Bengali', serif;
          font-weight: 700;
          font-size: 19px;
          color: var(--paper);
          margin-bottom: 4px;
        }
        .profile-display-email {
          font-size: 12.5px;
          color: rgba(251,247,238,0.5);
          margin-bottom: 20px;
        }

        .profile-menu-list {
          width: 100%;
          display: flex;
          flex-direction: column;
          gap: 10px;
          margin-top: 18px;
        }
        .profile-menu-row {
          display: flex;
          align-items: center;
          gap: 12px;
          width: 100%;
          background: rgba(251,247,238,0.06);
          border: 1px solid rgba(251,247,238,0.14);
          border-radius: 12px;
          padding: 14px 16px;
          cursor: pointer;
          text-align: left;
        }
        .profile-menu-row-danger .profile-menu-icon,
        .profile-menu-row-danger .profile-menu-label {
          color: #ff8f9c;
        }
        .profile-menu-icon {
          color: var(--gold);
          display: flex;
        }
        .profile-menu-label {
          font-size: 14px;
          font-weight: 600;
          color: var(--paper);
          flex: 1;
        }
        .profile-menu-count {
          font-family: 'IBM Plex Mono', monospace;
          font-size: 12px;
          color: rgba(251,247,238,0.5);
        }

        .profile-subview {
          align-items: stretch;
          justify-content: flex-start;
          padding: 24px 18px 100px;
          overflow-y: auto;
          text-align: left;
        }
        .profile-subview-light {
          background: linear-gradient(175deg, #FDF1E6 0%, #FCE9DA 60%, #FBDFC6 100%);
        }
        .options-screen {
          width: 100%;
          color: #2B2B2E;
        }
        .profile-subheader-light .profile-back-btn,
        .profile-subheader-light .profile-subheader-title {
          color: #2B2B2E;
        }
        .profile-subheader-light {
          border-bottom: 1px solid #ECE7DD;
          padding-bottom: 14px;
        }
        .profile-subheader {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 18px;
        }
        .profile-back-btn {
          display: flex;
          align-items: center;
          gap: 2px;
          background: none;
          border: none;
          color: var(--gold);
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          padding: 0;
        }
        .profile-subheader-title {
          flex: 1;
          text-align: center;
          font-family: 'Fraunces', 'Noto Serif Bengali', serif;
          font-weight: 700;
          font-size: 15px;
          color: #1B1200;
        }
        .profile-subheader-spacer {
          width: 46px;
        }
        .profile-list-pad {
          margin-top: 6px;
        }
        .profile-empty-note {
          font-size: 12.5px;
          color: rgba(251,247,238,0.5);
          line-height: 1.6;
          text-align: center;
          margin: 20px 0;
        }
        .profile-saved-row {
          justify-content: space-between;
        }
        .list-row-link {
          display: flex;
          align-items: center;
          gap: 12px;
          text-decoration: none;
          flex: 1;
          min-width: 0;
        }
        .profile-remove-btn {
          flex: none;
          background: none;
          border: none;
          color: var(--gold);
          cursor: pointer;
          padding: 6px;
          display: flex;
        }
        .profile-remove-btn:hover { color: #ff8f9c; }
        .profile-remove-btn-inline {
          margin-left: auto;
        }

        .folder-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .folder-pick-row {
          display: flex;
          align-items: center;
          gap: 10px;
          width: 100%;
          background: rgba(251,247,238,0.06);
          border: 1px solid rgba(251,247,238,0.14);
          border-radius: 10px;
          padding: 12px 14px;
          cursor: pointer;
          text-align: left;
        }
        .folder-pick-icon { color: var(--gold); display: flex; }
        .folder-pick-name {
          flex: 1;
          font-size: 13.5px;
          font-weight: 600;
          color: var(--paper);
        }
        .folder-pick-count {
          font-family: 'IBM Plex Mono', monospace;
          font-size: 11px;
          color: rgba(251,247,238,0.5);
        }
        .folder-new-row {
          display: flex;
          gap: 8px;
          margin-top: 12px;
        }
        .folder-new-input {
          flex: 1;
          border-radius: 10px;
          border: 1px solid rgba(251,247,238,0.25);
          background: rgba(251,247,238,0.06);
          color: var(--paper);
          padding: 10px 12px;
          font-size: 13px;
          outline: none;
        }
        .folder-create-btn {
          background: var(--gold);
          color: #1B1200;
          border: none;
          border-radius: 10px;
          padding: 0 16px;
          font-size: 12.5px;
          font-weight: 700;
          cursor: pointer;
        }
        .folder-create-btn:disabled { opacity: 0.4; cursor: not-allowed; }
        .folder-add-new-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          width: 100%;
          margin-top: 12px;
          background: none;
          border: 1px dashed rgba(251,247,238,0.3);
          color: rgba(251,247,238,0.7);
          border-radius: 10px;
          padding: 12px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
        }
        .folder-item-preview {
          font-size: 13px;
          color: rgba(251,247,238,0.7);
          background: rgba(251,247,238,0.06);
          border-radius: 8px;
          padding: 8px 12px;
          margin-bottom: 14px;
        }

        .profile-title {
          font-family: 'Fraunces', 'Noto Serif Bengali', serif;
          font-size: 20px;
          font-weight: 700;
          color: var(--paper);
        }
        .profile-note {
          font-size: 12.5px;
          color: rgba(251,247,238,0.5);
          max-width: 260px;
          line-height: 1.6;
        }
        .signout-btn {
          margin-top: 14px;
          background: rgba(200,16,46,0.16);
          border: 1px solid rgba(200,16,46,0.4);
          color: #ffb4bf;
          border-radius: 20px;
          padding: 9px 22px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
        }

        .signin-screen {
          height: 100%;
          width: 100%;
          overflow-y: auto;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(175deg, #FDF1E6 0%, #FCE9DA 60%, #FBDFC6 100%);
          padding: 40px 24px 100px;
        }
        .signin-inner {
          max-width: 360px;
          width: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
        }
        .signin-title {
          font-family: 'Fraunces', 'Noto Serif Bengali', serif;
          font-weight: 700;
          font-size: 21px;
          color: var(--paper);
          margin: 10px 0 6px;
        }
        .signin-sub {
          font-size: 13px;
          color: rgba(251,247,238,0.6);
          margin: 0 0 24px;
          line-height: 1.6;
        }
        .signin-opts {
          display: flex;
          flex-direction: column;
          gap: 10px;
          width: 100%;
        }
        .signin-btn {
          display: flex;
          align-items: center;
          gap: 12px;
          width: 100%;
          background: #fff;
          border: 1px solid rgba(0,0,0,0.06);
          border-radius: 12px;
          padding: 12px 16px;
          font-size: 14px;
          font-weight: 600;
          color: #262220;
          cursor: pointer;
        }
        .signin-btn:hover { background: #f5f2ea; }
        .phone-icon-wrap {
          width: 20px; height: 20px;
          display: flex; align-items: center; justify-content: center;
          color: var(--green);
        }
        .phone-input-row {
          display: flex;
          gap: 8px;
          margin-top: -2px;
        }
        .phone-input {
          flex: 1;
          border-radius: 10px;
          border: 1px solid rgba(0,0,0,0.15);
          background: #fff;
          color: #262220;
          padding: 11px 12px;
          font-size: 13.5px;
          outline: none;
        }
        .phone-input::placeholder { color: #8a8078; }
        .phone-send-btn {
          background: var(--gold);
          color: #1B1200;
          border: none;
          border-radius: 10px;
          padding: 0 16px;
          font-size: 12.5px;
          font-weight: 700;
          cursor: pointer;
        }
        .signin-note {
          margin-top: 22px;
          font-size: 11px;
          color: rgba(251,247,238,0.4);
          line-height: 1.6;
        }

        .bottom-nav {
          position: absolute;
          left: 0; right: 0; bottom: 0;
          z-index: 50;
          display: flex;
          justify-content: space-around;
          align-items: center;
          padding: 10px 12px calc(10px + env(safe-area-inset-bottom));
          background: rgba(6,12,8,0.96);
          border-top: 1px solid rgba(255,255,255,0.1);
          backdrop-filter: blur(6px);
        }
        .bottom-nav-btn {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 3px;
          background: none;
          border: none;
          color: rgba(255,255,255,0.5);
          cursor: pointer;
          padding: 4px 18px;
        }
        .bottom-nav-btn span {
          font-size: 10.5px;
          font-family: 'IBM Plex Mono', monospace;
        }
        .bottom-nav-btn.active {
          color: var(--gold);
        }

        /* ---- Light page theme: every page background is now the cream
           gradient, so force dark text on all of them for readability.
           Modals (share sheet, folder picker, interests dropdown, the
           dark photo overlay on My Feed cards, and the bottom nav/topbar)
           are untouched on purpose — they still sit on dark surfaces. ---- */
        .list-screen, .list-screen *,
        .timeline-screen, .timeline-screen *,
        .video-screen, .video-screen *,
        .vocab-screen, .vocab-screen *,
        .vocab-locked-screen, .vocab-locked-screen *,
        .gk-screen, .gk-screen *,
        .job-screen, .job-screen *,
        .exam-screen, .exam-screen *,
        .exam-embedded, .exam-embedded *,
        .ritual-feed-screen, .ritual-feed-screen *,
        .cat-menu-screen, .cat-menu-screen *,
        .profile-screen, .profile-screen *,
        .signin-screen, .signin-screen *,
        .onboard, .onboard * {
          color: #262220;
        }
        .list-time, .timeline-sub, .list-sample-note, .job-org, .job-deadline,
        .profile-empty-note, .quiz-answered-count, .signin-note, .signin-sub,
        .onboard-note, .vocab-lock-sub, .opt-sub {
          color: #8a8078 !important;
        }
        .list-row, .job-card, .vocab-card, .gk-acc-item, .cat-notif-row,
        .quiz-runner, .quiz-review-item, .test-history-row, .stat-card,
        .pref-cat-row-dark, .signin-btn {
          background: rgba(0,0,0,0.04);
          border-color: rgba(0,0,0,0.08);
        }
        .quiz-opt, .exam-length-card, .pause-status-row {
          background: rgba(0,0,0,0.03);
        }
        .list-title, .cat-menu-title, .vocab-lock-title, .profile-display-name,
        .quiz-question, .ritual-badge-name, .test-history-type {
          color: #1B1200;
        }
      `}</style>


      {showSplash && <SplashScreen onDone={() => setShowSplash(false)} />}

      {!showSplash && !lang && <OnboardingScreen onSelect={setLang} />}

      {!showSplash && lang && (
        <>
          {(bottomNav === "home" || bottomNav === "categories") && (
            <div className="topbar">
              <div className="actions-row">
                <button className="pill-btn-sm" onClick={switchLang}>{lang === "en" ? "বাংলা" : "EN"}</button>
                <button
                  className={`dots-btn ${showSearch ? "active" : ""}`}
                  onClick={() => { setShowSearch((v) => !v); if (showSearch) setSearchQuery(""); }}
                  aria-label="Search"
                >
                  {showSearch ? <X size={16} strokeWidth={2} /> : <Search size={16} strokeWidth={2} />}
                </button>
                <div className="dots-wrap">
                  <button
                    className="dots-btn"
                    onClick={() => setShowInterests((s) => !s)}
                    aria-label="Interests"
                  >
                    <MoreVertical size={18} strokeWidth={2} />
                  </button>
                  {showInterests && (
                    <div className="interests-panel">
                      <span className="interests-title">
                        {lang === "bn" ? "আপনার আগ্রহ" : "Your Interests"}
                      </span>
                      <div className="interests-list">
                        {TOPIC_CATEGORIES.map((cat) => {
                          const label = lang === "bn" ? cat.bn : cat.en;
                          const Icon = cat.icon;
                          const active = interests.includes(cat.id);
                          return (
                            <button
                              key={cat.id}
                              className={`interest-row ${active ? "active" : ""}`}
                              onClick={() => toggleInterest(cat.id)}
                            >
                              <Icon size={16} strokeWidth={2} />
                              <span>{label}</span>
                              {active && <Check size={15} strokeWidth={2.5} className="interest-check" />}
                            </button>
                          );
                        })}
                      </div>
                      <button className="interests-done" onClick={() => setShowInterests(false)}>
                        {lang === "bn" ? "সম্পন্ন" : "Done"}
                      </button>
                    </div>
                  )}
                </div>
              </div>
              {showSearch && (
                <div className="search-row">
                  <Search size={15} strokeWidth={2} className="search-row-icon" />
                  <input
                    autoFocus
                    className="search-input"
                    type="text"
                    placeholder={lang === "bn" ? "খবর খুঁজুন…" : "Search stories…"}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                  {searchQuery && (
                    <button className="search-clear" onClick={() => setSearchQuery("")}>
                      <X size={14} strokeWidth={2} />
                    </button>
                  )}
                </div>
              )}
              {bottomNav === "home" && (
                <div className="tabs-row">
                  {TABS.map((tab) => (
                    <button
                      key={tab.id}
                      className={`tab-btn ${activeTab === tab.id ? "active" : ""}`}
                      onClick={() => goToTab(tab.id)}
                    >
                      {lang === "bn" ? tab.bn : tab.en}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {bottomNav === "home" && (
            <div
              className="home-content"
              onWheel={onWheel}
              onTouchStart={onTouchStart}
              onTouchEnd={onTouchEnd}
            >
              <div
                key={activeTab}
                className={`tab-pane ${tabDirection === 1 ? "slide-in-right" : "slide-in-left"}`}
              >
              {activeTab === "myfeed" && (
                <div className="deck">
                  {status === "loading" && <div className="loading-state">{t.fetching}</div>}

                  {status !== "loading" && !current && (
                    <div className="loading-state">
                      {lang === "bn" ? "কোনো খবর পাওয়া যায়নি" : "No stories match your search"}
                    </div>
                  )}

                  {status !== "loading" && current && (
                    <div
                      className="slide"
                      onTouchStart={() => startLongPress({ type: "news", title: current.headline, subtitle: current.time, link: current.link, image: current.image })}
                      onTouchEnd={cancelLongPress}
                      onTouchMove={cancelLongPress}
                      onMouseDown={() => startLongPress({ type: "news", title: current.headline, subtitle: current.time, link: current.link, image: current.image })}
                      onMouseUp={cancelLongPress}
                      onMouseLeave={cancelLongPress}
                    >
                      <div
                        className="story-photo"
                        style={{
                          backgroundImage: current.image
                            ? `url(${current.image})`
                            : GRADIENTS[index % GRADIENTS.length],
                        }}
                      >
                        {!current.image && (
                          <div className="story-photo-fallback">
                            <ImageIcon size={26} strokeWidth={1.6} color="var(--gold)" />
                          </div>
                        )}
                        <div className="story-photo-icons">
                          <button className="photo-icon-btn" aria-label="Info">
                            <Info size={15} strokeWidth={2} />
                          </button>
                          <button className="photo-icon-btn" aria-label="More">
                            <MoreHorizontal size={15} strokeWidth={2} />
                          </button>
                        </div>
                        <div className="photo-nav-arrows">
                          <button onClick={goPrev} aria-label="Previous">↑</button>
                          <button onClick={goNext} aria-label="Next">↓</button>
                        </div>
                        <div className="photo-save-share-pill">
                          <button
                            className={`pill-icon-btn ${saved[current.id] ? "saved" : ""}`}
                            onClick={() => toggleSave(current)}
                            aria-label="Save"
                          >
                            <Bookmark size={16} strokeWidth={2} fill={saved[current.id] ? "currentColor" : "none"} />
                          </button>
                          <span className="pill-divider" />
                          <button
                            className="pill-icon-btn"
                            aria-label="Share"
                            onClick={() => setShareStory(current)}
                          >
                            <Share2 size={16} strokeWidth={2} />
                          </button>
                        </div>
                      </div>

                      <div
                        className="story-body"
                        onDoubleClick={() => window.open(current.link, "_blank", "noopener,noreferrer")}
                        onTouchEnd={() => handleStoryTap(current)}
                      >
                        <div className="story-body-top">
                          <span className="story-brand">
                            <span className="story-brand-mark"><PingsLogo size={13} /></span> Pings
                          </span>
                        </div>

                        <h1 className="story-headline">{current.headline}</h1>
                        <p className="story-summary">{current.summary}</p>
                        <span className="story-meta">{current.time}</span>

                        <span className="story-dbltap-hint">
                          <MousePointerClick size={12} strokeWidth={2} /> {t.doubleTapHint}
                        </span>
                      </div>
                    </div>
                  )}

                  {status !== "loading" && (
                    <div className="swipe-hint">{t.swipeHint} · {filteredItems.length ? index + 1 : 0}/{filteredItems.length}</div>
                  )}
                </div>
              )}

              {activeTab === "ritual" && (
                ritualProfile ? (
                  <DailyRitualFeed
                    lang={lang}
                    ritualProfile={ritualProfile}
                    items={filteredItems}
                    onMarkComplete={markRitualDayComplete}
                    onPickDisplayBadge={pickDisplayBadge}
                    savedNews={saved}
                    onToggleSaveNews={toggleSave}
                  />
                ) : (
                  <DailyRitualOnboarding
                    lang={lang}
                    onComplete={(answers) =>
                      setRitualProfile({ ...answers, streak: 1, badges: ["rookie"], displayBadge: "rookie" })
                    }
                  />
                )
              )}

              {activeTab === "trending" && <TrendingScreen items={items} lang={lang} />}

              {activeTab === "fifa" && (() => {
                const fifaItems = filterFifaItems(items, lang);
                const usingSample = fifaItems.length === 0;
                return (
                  <NewsListScreen
                    title={lang === "bn" ? "ফিফা বিশ্বকাপ" : "FIFA World Cup"}
                    items={usingSample ? FIFA_FALLBACK[lang === "bn" ? "bn" : "en"] : fifaItems}
                    lang={lang}
                    isSample={usingSample}
                  />
                );
              })()}

              {activeTab === "timelines" && <TimelineScreen items={items} lang={lang} />}

              {activeTab === "videos" && <VideoScreen lang={lang} />}

              {activeTab === "vocabulary" && (
                <VocabularyScreen
                  lang={lang}
                  onSwitchLang={switchLang}
                  savedVocab={savedVocab}
                  onToggleSaveVocab={toggleSavedVocab}
                />
              )}

              {activeTab === "gk" && (
                <GKScreen lang={lang} savedGK={savedGK} onToggleSaveGK={toggleSavedGK} />
              )}

              {activeTab === "jobnews" && <JobNewsScreen lang={lang} />}

              {activeTab !== "myfeed" && activeTab !== "ritual" && activeTab !== "trending" && activeTab !== "fifa" && activeTab !== "timelines" && activeTab !== "videos" && activeTab !== "vocabulary" && activeTab !== "gk" && activeTab !== "jobnews" && (
                <div className="placeholder-screen">
                  <span className="placeholder-icon">◐</span>
                  <span className="placeholder-title">
                    {TABS.find((tb) => tb.id === activeTab)?.[lang === "bn" ? "bn" : "en"]}
                  </span>
                  <span className="placeholder-sub">{t.comingSoon}</span>
                  <span className="placeholder-note">{t.comingSoonSub}</span>
                </div>
              )}
              </div>
            </div>
          )}

          {bottomNav === "categories" && (
            <CategoriesMenu
              lang={lang}
              activeCategory={category}
              onSelect={(label) => { setCategory(label); setActiveTab("myfeed"); setBottomNav("home"); }}
              onGoToPreferences={() => { setJumpToPrefs(true); setBottomNav("profile"); }}
              items={items}
              onViewAllTrending={() => { setActiveTab("trending"); setBottomNav("home"); }}
              newsPreferences={newsPreferences}
              onNotifTap={handleNotifTap}
              onGoToTab={(tabId) => { setActiveTab(tabId); setBottomNav("home"); }}
            />
          )}

          {bottomNav === "profile" && (
            <ProfileScreen
              lang={lang}
              onSwitchLang={switchLang}
              openPrefsOnMount={jumpToPrefs}
              onJumpConsumed={() => setJumpToPrefs(false)}
              ritualProfile={ritualProfile}
              onPickDisplayBadge={pickDisplayBadge}
              testHistory={testHistory}
              onAddTestResult={addTestResult}
              savedNews={saved}
              onToggleSaveNews={toggleSave}
              savedVocab={savedVocab}
              onToggleSaveVocab={toggleSavedVocab}
              savedGK={savedGK}
              onToggleSaveGK={toggleSavedGK}
              customFolders={customFolders}
              onCreateEmptyFolder={createFolder}
              onDeleteFolder={deleteFolder}
              onRemoveFolderItem={removeItemFromFolder}
              notificationsOn={notificationsOn}
              onSetNotificationsOn={setNotificationsOn}
              pausedUntil={pausedUntil}
              onSetPausedUntil={setPausedUntil}
              nowTick={nowTick}
              newsPreferences={newsPreferences}
              onSetNewsPreferences={setNewsPreferences}
              hdImages={hdImages}
              onSetHdImages={setHdImages}
              nightMode={nightMode}
              onSetNightMode={setNightMode}
              autoPlay={autoPlay}
              onSetAutoPlay={setAutoPlay}
              textSize={textSize}
              onSetTextSize={setTextSize}
              onShareApp={() => setShareStory({ headline: "Pings — Get pinged. In sixty words.", link: "https://pings.app" })}
              onRateApp={() =>
                setToast(
                  lang === "bn"
                    ? "ডেমোতে অ্যাপ স্টোর নেই — বাস্তব সংস্করণে এটি রেটিং পেজ খুলবে।"
                    : "No app store in this demo — a live build would open the rating page here."
                )
              }
              onDeleteProfile={() => {
                setSaved({});
                setSavedVocab({});
                setSavedGK({});
                setCustomFolders([]);
                setRitualProfile(null);
                setTestHistory([]);
                setToast(lang === "bn" ? "প্রোফাইল মুছে ফেলা হয়েছে।" : "Profile deleted.");
              }}
            />
          )}

          <div className="bottom-nav">
            <button
              className={`bottom-nav-btn ${bottomNav === "categories" ? "active" : ""}`}
              onClick={() => setBottomNav("categories")}
            >
              <Navigation size={22} strokeWidth={2} />
              <span>{lang === "bn" ? "নেভিগেটর" : "Navigator"}</span>
            </button>
            <button
              className={`bottom-nav-btn ${bottomNav === "home" ? "active" : ""}`}
              onClick={() => { setBottomNav("home"); setActiveTab("myfeed"); load(lang); }}
            >
              <Newspaper size={22} strokeWidth={2} />
              <span>{lang === "bn" ? "ফিড" : "Feed"}</span>
            </button>
            <button
              className={`bottom-nav-btn ${bottomNav === "profile" ? "active" : ""}`}
              onClick={() => setBottomNav("profile")}
            >
              <User size={22} strokeWidth={2} />
              <span>{lang === "bn" ? "প্রোফাইল" : "Profile"}</span>
            </button>
          </div>

          {shareStory && (
            <ShareSheet story={shareStory} lang={lang} onClose={() => setShareStory(null)} />
          )}

          {folderPickerItem && (
            <FolderPickerSheet
              item={folderPickerItem}
              folders={customFolders}
              lang={lang}
              onPickFolder={handlePickFolder}
              onCreateFolder={handleCreateFolderAndSave}
              onClose={() => setFolderPickerItem(null)}
            />
          )}

          {toast && (
            <div className="app-toast">
              <Check size={14} strokeWidth={2.5} /> {toast}
            </div>
          )}
        </>
      )}
    </div>
  );
}
