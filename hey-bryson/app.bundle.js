(() => {
  // app/js/store.js
  var FREE_DEFAULTS = {
    strong: "nvidia/nemotron-3-ultra-550b-a55b:free",
    gemma: "google/gemma-4-31b-it:free",
    router: "openrouter/free",
    fast: "nvidia/nemotron-3.5-lightning:free"
  };
  var LS = {
    settings: "pearhub.settings",
    keys: "pearhub.keys",
    bots: "pearhub.bots",
    usage: "pearhub.usage",
    models: "pearhub.modelcache"
  };
  function read(k, fallback) {
    try {
      const v = localStorage.getItem(k);
      return v ? JSON.parse(v) : fallback;
    } catch {
      return fallback;
    }
  }
  function write(k, v) {
    localStorage.setItem(k, JSON.stringify(v));
  }
  var uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  var today = () => (/* @__PURE__ */ new Date()).toLocaleDateString("en-CA");
  function defaultSettings() {
    return {
      baseUrls: {},
      customName: "Custom",
      brain: {
        members: [
          { provider: "openrouter", model: FREE_DEFAULTS.strong },
          { provider: "openrouter", model: FREE_DEFAULTS.gemma },
          { provider: "openrouter", model: FREE_DEFAULTS.router }
        ],
        aggregator: { provider: "openrouter", model: FREE_DEFAULTS.strong }
      },
      idle: { enabled: false, idleAfterSec: 120, intervalSec: 8, maxTurns: 8, maxSessionsPerDay: 3, maxCostPerSession: 0.05, botIds: [], topic: "" },
      limits: { dailyRequests: 200 },
      voiceInput: { enabled: false, target: "chat", wakePhrase: "hey bryson" },
      tts: { engine: "browser", openaiModel: "gpt-4o-mini-tts", elevenModel: "eleven_flash_v2_5", readIdleAloud: false }
    };
  }
  function deepMerge(base, over) {
    if (!over || typeof over !== "object" || Array.isArray(over)) return over === void 0 ? base : over;
    const out = { ...base };
    for (const k of Object.keys(over)) out[k] = base && typeof base[k] === "object" && !Array.isArray(base[k]) ? deepMerge(base[k], over[k]) : over[k];
    return out;
  }
  var getSettings = () => deepMerge(defaultSettings(), read(LS.settings, {}));
  var saveSettings = (s) => write(LS.settings, s);
  var getKeys = () => read(LS.keys, {});
  var saveKeys = (k) => write(LS.keys, k);
  var getModelCache = () => read(LS.models, { at: 0, free: [], pricing: {} });
  var saveModelCache = (c2) => write(LS.models, c2);
  var ROLE_PRESETS = {
    "Electronics Engineer": { emoji: "\u{1F50C}", color: "#f5a524", prompt: "You are a senior electronics engineer. You know circuits, microcontrollers (ESP32, Arduino, STM32), motor controllers, batteries/BMS, UART/CAN/I2C/SPI, soldering, logic analyzers and PCB design. Give exact part numbers, pinouts, values and wiring steps, and call out electrical safety.", deep: true },
    "Game Dev": { emoji: "\u{1F3AE}", color: "#a78bfa", prompt: "You are a veteran game developer and designer (Unity, Godot, Unreal, web games). You help with mechanics, level design, game feel, shaders, performance and shipping. Give runnable code and concrete design ideas.", deep: true },
    "Coding Architect": { emoji: "\u{1F9F1}", color: "#60a5fa", prompt: "You are a principal software architect and expert programmer across Python, JavaScript/TypeScript, C/C++, Rust and web/mobile apps. You design clean systems and write complete, working, well-structured code with tests.", deep: true },
    "Reverse Engineering Expert": { emoji: "\u{1F9E9}", color: "#34d399", prompt: "You are an expert in reverse engineering software and hardware you own: Ghidra, disassembly, firmware dumps, Android APK analysis (jadx, apktool), Bluetooth LE sniffing and serial protocol decoding. Explain methods step by step and stay within legal use on the user's own devices.", deep: true },
    "Role-play Storyteller": { emoji: "\u{1F3AD}", color: "#f472b6", prompt: "You are a vivid, creative role-play storyteller. Stay in character, build immersive scenes, give characters distinct voices, keep continuity, and end turns with a hook that invites the user to act.", deep: false },
    "Custom": { emoji: "\u2728", color: "#8fd66b", prompt: "You are a helpful expert assistant.", deep: true }
  };
  var PROBLEM_SOLVER = `
How you work (always):
1. Restate the goal and constraints in one or two lines.
2. Think it through step by step.
3. Propose 2-3 distinct solutions and weigh their trade-offs.
4. Self-check: hunt for mistakes, missing steps or wrong assumptions, and fix them.
5. End with a clearly labelled "Final answer" giving the single best solution.
Be concrete (exact parts, values, commands, code). Be motivated and persistent: if the first idea fails, find another way. If something is uncertain, say so and say how to verify it.`;
  function presetBot(name, role, model, extra = {}) {
    const p = ROLE_PRESETS[role];
    return { id: uid(), name, role, emoji: p.emoji, color: p.color, prompt: p.prompt, deep: p.deep, provider: "openrouter", model, voice: "none", autoSpeak: false, createdAt: Date.now(), ...extra };
  }
  function defaultBots() {
    return [
      presetBot("Volt", "Electronics Engineer", FREE_DEFAULTS.strong, { voice: "judge" }),
      presetBot("Pixel", "Game Dev", FREE_DEFAULTS.gemma, { voice: "duo" }),
      presetBot("Forge", "Coding Architect", FREE_DEFAULTS.strong, { voice: "action" }),
      presetBot("Ghost", "Reverse Engineering Expert", FREE_DEFAULTS.strong, { voice: "boss" }),
      presetBot("Saga", "Role-play Storyteller", FREE_DEFAULTS.gemma, { voice: "narrator" })
    ];
  }
  function getBots() {
    let b = read(LS.bots, null);
    if (!b) {
      b = defaultBots();
      write(LS.bots, b);
    }
    return b;
  }
  var saveBots = (b) => write(LS.bots, b);
  function getUsage() {
    const u = read(LS.usage, null) || {};
    const t = today();
    if (u.day !== t) {
      u.day = t;
      u.requests = 0;
      u.errors = 0;
      u.promptTokens = 0;
      u.completionTokens = 0;
      u.cost = 0;
      u.idleSessions = 0;
    }
    u.total = u.total || { requests: 0, tokens: 0, cost: 0 };
    return u;
  }
  function addUsage({ requests = 0, errors = 0, prompt = 0, completion = 0, cost = 0, idleSessions = 0 }) {
    const u = getUsage();
    u.requests += requests;
    u.errors += errors;
    u.promptTokens += prompt;
    u.completionTokens += completion;
    u.cost += cost;
    u.idleSessions += idleSessions;
    u.total.requests += requests;
    u.total.tokens += prompt + completion;
    u.total.cost += cost;
    write(LS.usage, u);
    window.dispatchEvent(new CustomEvent("usage"));
    return u;
  }
  var dbp;
  function db() {
    if (!dbp) dbp = new Promise((res, rej) => {
      const r = indexedDB.open("pearhub", 1);
      r.onupgradeneeded = () => {
        const s = r.result.createObjectStore("conversations", { keyPath: "id" });
        s.createIndex("updatedAt", "updatedAt");
      };
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    return dbp;
  }
  async function tx(mode, fn) {
    const d = await db();
    return new Promise((res, rej) => {
      const t = d.transaction("conversations", mode);
      const s = t.objectStore("conversations");
      let out;
      const r = fn(s);
      if (r) r.onsuccess = () => {
        out = r.result;
      };
      t.oncomplete = () => res(out);
      t.onerror = () => rej(t.error);
    });
  }
  function stampMessages(c2) {
    for (const m of c2.messages) {
      if (!m.ts) m.ts = Date.now();
      m.at = new Date(m.ts).toISOString();
    }
    return c2;
  }
  var saveConv = (c2) => {
    c2.updatedAt = Date.now();
    stampMessages(c2);
    return tx("readwrite", (s) => s.put(JSON.parse(JSON.stringify(c2))));
  };
  var deleteConv = (id) => tx("readwrite", (s) => s.delete(id));
  var clearConvs = () => tx("readwrite", (s) => s.clear());
  async function listConvs() {
    const all = await tx("readonly", (s) => s.getAll());
    return (all || []).sort((a, b) => b.updatedAt - a.updatedAt);
  }
  function newConv(type, title, extra = {}) {
    return { id: uid(), type, title, createdAt: Date.now(), updatedAt: Date.now(), messages: [], ...extra };
  }

  // app/js/providers.js
  var PROVIDERS = {
    openrouter: {
      label: "OpenRouter",
      base: "https://openrouter.ai/api/v1",
      type: "openai",
      keyUrl: "https://openrouter.ai/keys",
      models: [FREE_DEFAULTS.strong, FREE_DEFAULTS.gemma, FREE_DEFAULTS.router, FREE_DEFAULTS.fast, "google/gemma-4-26b-a4b-it:free", "openai/gpt-5.6-luna", "openai/gpt-5.6-terra", "anthropic/claude-sonnet-5.5", "anthropic/claude-haiku-5.5", "google/gemini-3.8-flash", "x-ai/grok-4.7", "deepseek/deepseek-v4.1-flash", "deepseek/deepseek-v4-pro-0813", "qwen/qwen3.8-max-prime", "qwen/qwen3.8-flash"]
    },
    openai: { label: "OpenAI (ChatGPT)", base: "https://api.openai.com/v1", type: "openai", keyUrl: "https://platform.openai.com/api-keys", models: ["gpt-5.6-luna", "gpt-5.6-terra", "gpt-5.6-sol"] },
    xai: { label: "xAI (Grok)", base: "https://api.x.ai/v1", type: "openai", keyUrl: "https://console.x.ai", models: ["grok-4.7", "grok-4.6"] },
    anthropic: { label: "Anthropic (Claude)", base: "https://api.anthropic.com/v1", type: "anthropic", keyUrl: "https://console.anthropic.com/settings/keys", models: ["claude-sonnet-5.5", "claude-haiku-5.5", "claude-opus-5.5"] },
    gemini: { label: "Google Gemini", base: "https://generativelanguage.googleapis.com/v1beta/openai", type: "openai", keyUrl: "https://aistudio.google.com/apikey", models: ["gemini-3.8-flash", "gemini-3.5-flash-lite"] },
    custom: { label: "Custom (OpenAI-compatible)", base: "", type: "openai", keyUrl: "", models: [] }
  };
  var baseUrl = (p) => ((getSettings().baseUrls || {})[p] || PROVIDERS[p].base || "").replace(/\/+$/, "");
  var hasKey = (p) => p === "custom" ? !!baseUrl("custom") : !!getKeys()[p];
  var anyKey = () => Object.keys(PROVIDERS).some(hasKey);
  var modelLabel = (provider, model) => `${model}${provider !== "openrouter" ? " \xB7 " + PROVIDERS[provider].label.split(" ")[0] : ""}`;
  var ProviderError = class extends Error {
  };
  function friendly(status, body, provider) {
    var _a;
    let msg = body;
    try {
      let j = JSON.parse(body);
      if (Array.isArray(j)) j = j[0] || {};
      msg = ((_a = j.error) == null ? void 0 : _a.message) || j.error || j.message || body;
      if (typeof msg !== "string") msg = JSON.stringify(msg);
    } catch {
    }
    const name = PROVIDERS[provider].label;
    const hint = status === 401 || status === 403 ? ` Check your ${name} key in Settings.` : status === 402 ? " Out of credits on this account." : status === 429 ? " Rate limited (free models allow about 20 requests/min and 50/day without credits). Wait a bit or pick another model." : status === 404 || /not.*(found|exist)|no endpoints/i.test(msg) ? " That model id may have changed. Pick another model (Settings \u2192 Refresh free models)." : "";
    msg = String(msg).slice(0, 300).trim();
    if (!/[.!?]$/.test(msg)) msg += ".";
    return new ProviderError(`${name} error ${status}: ${msg}${hint}`);
  }
  function headersFor(provider) {
    const key = getKeys()[provider];
    if (PROVIDERS[provider].type === "anthropic") return { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" };
    const h = { "content-type": "application/json" };
    if (key) h.authorization = `Bearer ${key}`;
    if (provider === "openrouter") {
      h["HTTP-Referer"] = location.origin.startsWith("http") ? location.origin : "https://hey-bryson.local";
      h["X-Title"] = "HEY_BRYSON";
    }
    return h;
  }
  function mergeRoles(messages) {
    const out = [];
    for (const m of messages) {
      if (!m.content) continue;
      const last = out[out.length - 1];
      if (last && last.role === m.role) last.content += "\n\n" + m.content;
      else out.push({ role: m.role, content: m.content });
    }
    if (out[0] && out[0].role !== "user") out.unshift({ role: "user", content: "(continue)" });
    return out;
  }
  function priceCost(provider, model, prompt, completion) {
    var _a;
    if (provider !== "openrouter") return 0;
    const p = (_a = getModelCache().pricing) == null ? void 0 : _a[model];
    return p ? prompt * p[0] + completion * p[1] : 0;
  }
  async function chat(opts) {
    const { provider, model, system, signal, onDelta } = opts;
    if (!PROVIDERS[provider]) throw new ProviderError(`Unknown provider ${provider}`);
    if (!hasKey(provider)) throw new ProviderError(`No ${PROVIDERS[provider].label} key yet. Add one in Settings.`);
    const s = getSettings();
    const u = getUsage();
    if (u.requests >= (s.limits.dailyRequests || 200)) throw new ProviderError(`Daily request cap reached (${s.limits.dailyRequests}). Raise it in Settings \u2192 Limits if you want more.`);
    const messages = mergeRoles(opts.messages);
    let result;
    try {
      result = PROVIDERS[provider].type === "anthropic" ? await anthropicChat(provider, model, system, messages, signal, onDelta) : await openaiChat(provider, model, system, messages, signal, onDelta, opts.stream !== false);
    } catch (e) {
      if (e.name !== "AbortError") addUsage({ requests: 1, errors: 1 });
      if (e instanceof ProviderError || e.name === "AbortError") throw e;
      throw new ProviderError(`Could not reach ${PROVIDERS[provider].label}: ${e.message}.` + (/fetch/i.test(e.message) ? ` The browser could not read the reply. This usually means the key is wrong (${provider === "openai" ? "OpenAI hides key errors from browsers" : "check it in Settings"}), you're offline, or a network filter blocks it.${provider !== "openrouter" ? " Tip: use the same model through OpenRouter instead." : ""}` : ""));
    }
    const prompt = result.usage.prompt || estimateTokens((system || "") + messages.map((m) => m.content).join(" "));
    const completion = result.usage.completion || estimateTokens(result.text);
    const cost = typeof result.cost === "number" ? result.cost : priceCost(provider, model, prompt, completion);
    addUsage({ requests: 1, prompt, completion, cost });
    return { text: result.text, usage: { prompt, completion }, cost };
  }
  var estimateTokens = (s) => Math.ceil((s || "").length / 4);
  async function openaiChat(provider, model, system, messages, signal, onDelta, stream) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _i;
    const body = { model, messages: system ? [{ role: "system", content: system }, ...messages] : messages, stream };
    if (stream && provider !== "gemini") body.stream_options = { include_usage: true };
    const r = await fetch(`${baseUrl(provider)}/chat/completions`, { method: "POST", headers: headersFor(provider), body: JSON.stringify(body), signal });
    if (!r.ok) throw friendly(r.status, await r.text(), provider);
    const ctype = r.headers.get("content-type") || "";
    if (!stream || !ctype.includes("text/event-stream")) {
      const j = await r.json();
      if (j.error) throw friendly(j.error.code || 500, JSON.stringify(j), provider);
      const text2 = ((_c = (_b = (_a = j.choices) == null ? void 0 : _a[0]) == null ? void 0 : _b.message) == null ? void 0 : _c.content) ?? "";
      onDelta == null ? void 0 : onDelta(text2);
      return { text: text2, usage: { prompt: ((_d = j.usage) == null ? void 0 : _d.prompt_tokens) || 0, completion: ((_e = j.usage) == null ? void 0 : _e.completion_tokens) || 0 }, cost: (_f = j.usage) == null ? void 0 : _f.cost };
    }
    const reader = r.body.getReader();
    const dec = new TextDecoder();
    let buf = "", text = "", usage = {}, cost;
    for (; ; ) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let i;
      while ((i = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, i).trim();
        buf = buf.slice(i + 1);
        if (!line.startsWith("data:")) continue;
        const data = line.slice(5).trim();
        if (data === "[DONE]") continue;
        let j;
        try {
          j = JSON.parse(data);
        } catch {
          continue;
        }
        if (j.error) throw friendly(j.error.code || 500, JSON.stringify(j), provider);
        const d = (_i = (_h = (_g = j.choices) == null ? void 0 : _g[0]) == null ? void 0 : _h.delta) == null ? void 0 : _i.content;
        if (d) {
          text += d;
          onDelta == null ? void 0 : onDelta(text);
        }
        if (j.usage) {
          usage = { prompt: j.usage.prompt_tokens || 0, completion: j.usage.completion_tokens || 0 };
          if (typeof j.usage.cost === "number") cost = j.usage.cost;
        }
      }
    }
    return { text, usage, cost };
  }
  async function anthropicChat(provider, model, system, messages, signal, onDelta) {
    var _a, _b;
    const r = await fetch(`${baseUrl(provider)}/messages`, {
      method: "POST",
      headers: headersFor(provider),
      signal,
      body: JSON.stringify({ model, max_tokens: 4096, system: system || void 0, messages })
    });
    if (!r.ok) throw friendly(r.status, await r.text(), provider);
    const j = await r.json();
    const text = (j.content || []).filter((c2) => c2.type === "text").map((c2) => c2.text).join("");
    onDelta == null ? void 0 : onDelta(text);
    return { text, usage: { prompt: ((_a = j.usage) == null ? void 0 : _a.input_tokens) || 0, completion: ((_b = j.usage) == null ? void 0 : _b.output_tokens) || 0 } };
  }
  async function listModels(provider) {
    const h = headersFor(provider);
    delete h["content-type"];
    const r = await fetch(`${baseUrl(provider)}/models`, { headers: provider === "openrouter" ? {} : h });
    if (!r.ok) throw friendly(r.status, await r.text(), provider);
    const j = await r.json();
    const data = j.data || j.models || [];
    if (provider === "openrouter") {
      const pricing = {};
      const free = [];
      for (const m of data) {
        if (m.pricing) pricing[m.id] = [+m.pricing.prompt || 0, +m.pricing.completion || 0];
        if (m.id.endsWith(":free") || m.id === "openrouter/free") free.push(m.id);
      }
      saveModelCache({ at: Date.now(), free, pricing, all: data.map((m) => m.id) });
    }
    return data.map((m) => (m.id || m.name || "").replace(/^models\//, ""));
  }

  // app/js/markdown.js
  var esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c2) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c2]);
  function inline(s) {
    return s.replace(/`([^`]+)`/g, "<code>$1</code>").replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>").replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>").replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
  }
  function md(src) {
    const blocks = [];
    let text = esc(src || "");
    text = text.replace(/```[\w+-]*\n?([\s\S]*?)(```|$)/g, (_, code) => {
      blocks.push("<pre><code>" + code.replace(/\n$/, "") + "</code></pre>");
      return `\0${blocks.length - 1}\0`;
    });
    const out = [];
    let list = null;
    const close = () => {
      if (list) {
        out.push(`</${list}>`);
        list = null;
      }
    };
    for (const line of text.split("\n")) {
      let m;
      if (/^\u0000\d+\u0000$/.test(line.trim())) {
        close();
        out.push(line.trim());
        continue;
      }
      if (m = line.match(/^(#{1,6})\s+(.*)/)) {
        close();
        out.push(`<h${m[1].length < 3 ? 3 : 4}>${inline(m[2])}</h${m[1].length < 3 ? 3 : 4}>`);
        continue;
      }
      if (m = line.match(/^\s*[-*•]\s+(.*)/)) {
        if (list !== "ul") {
          close();
          out.push("<ul>");
          list = "ul";
        }
        out.push(`<li>${inline(m[1])}</li>`);
        continue;
      }
      if (m = line.match(/^\s*\d+[.)]\s+(.*)/)) {
        if (list !== "ol") {
          close();
          out.push("<ol>");
          list = "ol";
        }
        out.push(`<li>${inline(m[1])}</li>`);
        continue;
      }
      close();
      if (line.trim()) out.push(`<p>${inline(line)}</p>`);
    }
    close();
    return out.join("").replace(/\u0000(\d+)\u0000/g, (_, i) => blocks[+i]);
  }

  // app/js/wake.js
  var WAKE_VARIANTS = ["hey bryson", "hey brysen", "hey brison", "hey bryston", "hey brice on", "hey bryce on", "a bryson", "hay bryson", "hey, bryson"];
  var srSupported = () => !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  var norm = (s) => String(s || "").toLowerCase().replace(/[^a-z\s]/g, " ").replace(/\s+/g, " ").trim();
  function findWake(text, extra = []) {
    const t = norm(text);
    for (const v of [...extra.map(norm), ...WAKE_VARIANTS.map(norm)]) {
      if (!v) continue;
      const i = t.indexOf(v);
      if (i >= 0) return { woke: true, rest: t.slice(i + v.length).trim() };
    }
    return { woke: false, rest: "" };
  }
  function dictateOnce() {
    return new Promise((resolve, reject) => {
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SR) return reject(new Error("Speech recognition is not available in this browser"));
      const r = new SR();
      r.continuous = false;
      r.interimResults = false;
      r.lang = navigator.language || "en-US";
      let text = "";
      r.onresult = (e) => {
        for (let i = e.resultIndex; i < e.results.length; i++) if (e.results[i].isFinal) text += e.results[i][0].transcript;
      };
      r.onerror = (e) => reject(new Error(e.error === "not-allowed" ? "Microphone permission was blocked" : "Speech error: " + e.error));
      r.onend = () => resolve(text.trim());
      try {
        r.start();
      } catch (e) {
        reject(e);
      }
    });
  }
  function createWake({ onState, onQuestion, wakePhrase = "hey bryson", questionTimeoutMs = 8e3 }) {
    let rec = null, enabled = false, mode = "off", busy = false, timer = null;
    const set = (m, detail) => {
      mode = m;
      onState == null ? void 0 : onState(m, detail);
    };
    function arm() {
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (mode === "question") set("wake");
      }, questionTimeoutMs);
    }
    async function fire(q) {
      clearTimeout(timer);
      busy = true;
      set("busy", q);
      try {
        await onQuestion(q);
      } finally {
        busy = false;
        if (enabled) set("wake");
      }
    }
    function handle(e) {
      var _a;
      if (busy) return;
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        const text = ((_a = r[0]) == null ? void 0 : _a.transcript) || "";
        if (mode === "wake") {
          const w = findWake(text, [wakePhrase]);
          if (!w.woke) continue;
          set("question");
          arm();
          if (r.isFinal && w.rest) return fire(w.rest);
        } else if (mode === "question" && r.isFinal) {
          const w = findWake(text, [wakePhrase]);
          const q = (w.woke ? w.rest : norm(text)).trim();
          if (q) return fire(q);
        }
      }
    }
    function start() {
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SR) {
        set("unsupported");
        return false;
      }
      enabled = true;
      rec = new SR();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = navigator.language || "en-US";
      rec.onresult = handle;
      rec.onerror = (e) => {
        if (e.error === "not-allowed" || e.error === "service-not-allowed") {
          enabled = false;
          set("denied");
        }
      };
      rec.onend = () => {
        if (enabled) setTimeout(() => {
          try {
            rec.start();
          } catch {
          }
        }, 300);
      };
      try {
        rec.start();
      } catch {
      }
      set("wake");
      return true;
    }
    function stop() {
      enabled = false;
      clearTimeout(timer);
      try {
        rec == null ? void 0 : rec.stop();
      } catch {
      }
      rec = null;
      set("off");
    }
    return { start, stop, get mode() {
      return mode;
    }, get enabled() {
      return enabled;
    }, ask: fire };
  }

  // app/js/voice.js
  var VOICE_PRESETS = {
    none: { label: "No voice", pitch: 1, rate: 1, prefer: [], style: "" },
    narrator: {
      label: "Deep Wise Narrator",
      pitch: 0.6,
      rate: 0.88,
      prefer: ["male", "daniel", "george", "uk english male", "david"],
      eleven: "nPczCjzI2devNBz1zQrb",
      openai: "onyx",
      style: "Speak like a deep, calm, wise narrator: measured sentences, gentle gravitas, the occasional vivid image."
    },
    action: {
      label: "Gravelly Action Hero",
      pitch: 0.5,
      rate: 0.95,
      prefer: ["male", "fred", "mark", "guy"],
      openai: "ash",
      eleven: "SOYHLrjzK2X1ezoPC6cr",
      style: "Speak like a gravelly action-movie hero: short, punchy lines, tough confidence, zero fluff."
    },
    host: {
      label: "Sassy Talk-Show Host",
      pitch: 1.25,
      rate: 1.12,
      prefer: ["female", "samantha", "zira", "aria", "jenny"],
      openai: "coral",
      eleven: "cgSgspJ2msm6clMCkdW9",
      style: "Speak like a sassy, high-energy talk-show host: witty asides, playful sass, big reactions, always warm."
    },
    judge: {
      label: "No-Nonsense Courtroom Judge",
      pitch: 0.95,
      rate: 0.98,
      prefer: ["female", "karen", "moira", "susan"],
      openai: "sage",
      eleven: "EXAVITQu4vr4xnSDxMaL",
      style: "Speak like a blunt, no-nonsense courtroom judge: crisp verdicts, call out weak arguments, rule decisively."
    },
    kid: {
      label: "Cheerful Kid",
      pitch: 1.8,
      rate: 1.15,
      prefer: ["female", "junior", "samantha"],
      openai: "shimmer",
      eleven: "FGY2WhTYpPnrIDTdsKH5",
      style: "Speak like a cheerful, curious kid: simple words, lots of excitement, fun comparisons."
    },
    rapper: {
      label: "Cool Rapper Swagger",
      pitch: 0.85,
      rate: 1.08,
      prefer: ["male", "guy", "aaron"],
      openai: "verse",
      eleven: "IKne3meq5aSn9XLyUdCD",
      style: "Speak with cool rapper swagger: confident rhythm, slick wordplay, the odd rhyme, still clear and helpful."
    },
    duo: {
      label: "Slacker Teen Duo (two voices)",
      pitch: 1.05,
      rate: 1,
      pitch2: 0.75,
      rate2: 0.92,
      prefer: ["male"],
      prefer2: ["male", "fred"],
      openai: "echo",
      openai2: "fable",
      eleven: "CwhRBWXzGAHq8TQ4Fs17",
      eleven2: "TX3LPaxmHKxFdv7VOQHJ",
      duo: true,
      style: 'You are a duo of two laid-back slacker teens taking turns. Write as alternating lines starting with "A:" and "B:" \u2014 goofy, easily amused, but they still get the answer right.'
    },
    boss: {
      label: "Smooth Crime Boss",
      pitch: 0.7,
      rate: 0.85,
      prefer: ["male", "alex", "tom"],
      openai: "onyx",
      eleven: "cjVigY5qzO86Huf0OWal",
      style: 'Speak like a smooth, unhurried crime-boss character: polite menace, calm control, "let me make you an offer" energy.'
    },
    orator: {
      label: "Bold Politician-style Orator",
      pitch: 0.9,
      rate: 0.93,
      prefer: ["male", "daniel", "david"],
      openai: "ballad",
      eleven: "pNInz6obpgDQGcFmaJgB",
      style: "Speak like a bold, rousing orator at a rally: big promises, rule-of-three phrases, rhetorical questions, inspiring close."
    }
  };
  var ttsSupported = () => typeof window !== "undefined" && !!window.speechSynthesis && typeof window.SpeechSynthesisUtterance === "function";
  function systemVoices() {
    return ttsSupported() ? speechSynthesis.getVoices() : [];
  }
  function pickVoice(prefer, explicitName) {
    const vs = systemVoices().filter((v) => /^en/i.test(v.lang || "en"));
    const all = vs.length ? vs : systemVoices();
    if (explicitName) {
      const v = systemVoices().find((x) => x.name === explicitName);
      if (v) return v;
    }
    for (const p of prefer || []) {
      const v = all.find((x) => x.name.toLowerCase().includes(p));
      if (v) return v;
    }
    return all[0] || null;
  }
  function speakable(text) {
    return String(text || "").replace(/```[\s\S]*?```/g, " (code omitted) ").replace(/`([^`]+)`/g, "$1").replace(/[*_#>]+/g, "").replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").replace(/\s+/g, " ").trim().slice(0, 3e3);
  }
  function duoParts(text) {
    const lines = String(text).split(/\n+/).map((l) => l.trim()).filter(Boolean);
    const tagged = lines.filter((l) => /^(A|B)\s*:/i.test(l));
    if (tagged.length >= 2) return tagged.map((l) => ({ part: /^b/i.test(l) ? 1 : 0, text: l.replace(/^(A|B)\s*:\s*/i, "") }));
    return (String(text).match(/[^.!?]+[.!?]*/g) || [text]).map((s, i) => ({ part: i % 2, text: s.trim() })).filter((p) => p.text);
  }
  var audioEl = null;
  var queueToken = 0;
  function stopSpeaking() {
    queueToken++;
    if (ttsSupported()) speechSynthesis.cancel();
    if (audioEl) {
      audioEl.pause();
      audioEl = null;
    }
  }
  async function speak(text, bot) {
    var _a;
    const preset = VOICE_PRESETS[(bot == null ? void 0 : bot.voice) || "none"];
    if (!preset || (bot == null ? void 0 : bot.voice) === "none" || !(bot == null ? void 0 : bot.voice)) return;
    stopSpeaking();
    const token = queueToken;
    const clean = speakable(text);
    if (!clean) return;
    const parts = preset.duo ? duoParts(clean) : [{ part: 0, text: clean }];
    const engine = ((_a = getSettings().tts) == null ? void 0 : _a.engine) || "browser";
    if (engine !== "browser") {
      try {
        for (const p of parts) {
          if (token !== queueToken) return;
          await premiumSpeak(p.text, preset, p.part, bot, engine);
        }
        return;
      } catch (e) {
        console.warn("Premium TTS failed, falling back to browser voice", e);
        window.dispatchEvent(new CustomEvent("tts-error", { detail: e.message }));
      }
    }
    if (!ttsSupported()) {
      window.dispatchEvent(new CustomEvent("tts-unavailable"));
      return;
    }
    for (const p of parts) {
      if (token !== queueToken) return;
      await new Promise((res) => {
        const u = new SpeechSynthesisUtterance(p.text);
        const v = pickVoice(p.part ? preset.prefer2 : preset.prefer, p.part ? bot.voiceName2 : bot.voiceName);
        if (v) u.voice = v;
        u.pitch = Math.max(0, Math.min(2, (p.part ? preset.pitch2 : preset.pitch) * (bot.pitchMul || 1)));
        u.rate = Math.max(0.1, Math.min(3, (p.part ? preset.rate2 : preset.rate) * (bot.rateMul || 1)));
        u.onend = res;
        u.onerror = res;
        speechSynthesis.speak(u);
      });
    }
  }
  async function premiumSpeak(text, preset, part, bot, engine) {
    var _a, _b, _c;
    const keys = getKeys();
    const s = getSettings();
    let r;
    if (engine === "openai") {
      if (!keys.openai) throw new Error("No OpenAI key for OpenAI TTS");
      r = await fetch("https://api.openai.com/v1/audio/speech", {
        method: "POST",
        headers: { authorization: `Bearer ${keys.openai}`, "content-type": "application/json" },
        body: JSON.stringify({ model: ((_a = s.tts) == null ? void 0 : _a.openaiModel) || "gpt-4o-mini-tts", voice: (part ? preset.openai2 : preset.openai) || "alloy", input: text, instructions: preset.style, response_format: "mp3" })
      });
    } else {
      if (!keys.elevenlabs) throw new Error("No ElevenLabs key");
      const vid = (part ? bot.elevenVoiceId2 || preset.eleven2 : bot.elevenVoiceId || preset.eleven) || ((_b = s.tts) == null ? void 0 : _b.elevenVoiceId);
      if (!vid) throw new Error("No ElevenLabs voice for this preset");
      r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(vid)}`, {
        method: "POST",
        headers: { "xi-api-key": keys.elevenlabs, "content-type": "application/json", accept: "audio/mpeg" },
        body: JSON.stringify({ text, model_id: ((_c = s.tts) == null ? void 0 : _c.elevenModel) || "eleven_flash_v2_5" })
      });
    }
    if (!r.ok) throw new Error(`${engine} TTS error ${r.status}: ${(await r.text()).slice(0, 200)}`);
    addUsage({ requests: 1 });
    const url = URL.createObjectURL(await r.blob());
    await new Promise((res) => {
      audioEl = new Audio(url);
      audioEl.onended = res;
      audioEl.onerror = res;
      audioEl.play().catch(res);
    });
    URL.revokeObjectURL(url);
  }
  var voiceStyle = (bot) => (VOICE_PRESETS[bot == null ? void 0 : bot.voice] || VOICE_PRESETS.none).style;

  // app/js/app.js
  var $ = (q, el = document) => el.querySelector(q);
  var $$ = (q, el = document) => [...el.querySelectorAll(q)];
  var state = { view: "chat", chatBotId: null, chatConv: null, chatAbort: null, brainBusy: false, idle: null, lastActivity: Date.now(), histQuery: "", histType: "" };
  window.__pearhub = state;
  function systemPromptFor(bot) {
    let p = (bot.prompt || "").trim();
    if (bot.deep) p += "\n" + PROBLEM_SOLVER;
    const st = voiceStyle(bot);
    if (st) p += `

Speaking style: ${st}`;
    return p;
  }
  function toast(msg, ms = 2600) {
    const t = $("#toast");
    t.textContent = msg;
    t.classList.remove("hidden");
    clearTimeout(toast.t);
    toast.t = setTimeout(() => t.classList.add("hidden"), ms);
  }
  function openModal(html) {
    $("#modal-card").innerHTML = html;
    $("#modal").classList.remove("hidden");
    return $("#modal-card");
  }
  function closeModal() {
    $("#modal").classList.add("hidden");
    $("#modal-card").innerHTML = "";
  }
  $("#modal").addEventListener("click", (e) => {
    if (e.target.id === "modal") closeModal();
  });
  function download(name, text, type) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([text], { type }));
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(a.href);
      a.remove();
    }, 500);
  }
  var avatar = (b, size = 34) => `<div class="avatar" style="width:${size}px;height:${size}px;background:${esc(b.color || "#444")}33;border:1px solid ${esc(b.color || "#444")}">${esc(b.emoji || "\u{1F916}")}</div>`;
  var fmtTime = (ts) => new Date(ts).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  var botById = (id) => getBots().find((b) => b.id === id);
  var sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  function providerOptions(sel) {
    return Object.entries(PROVIDERS).map(([k, p]) => `<option value="${k}" ${k === sel ? "selected" : ""}>${esc(k === "custom" ? getSettings().customName || p.label : p.label)}</option>`).join("");
  }
  function modelPicker(prefix, provider, model) {
    return `<div class="member-row" data-picker="${prefix}"><select id="${prefix}-provider" class="pp">${providerOptions(provider)}</select>
  <input type="text" id="${prefix}-model" list="dl-${provider}" value="${esc(model)}" placeholder="model id" class="grow pm"></div>`;
  }
  function wirePickers(root = document) {
    $$("select.pp", root).forEach((s) => s.addEventListener("change", () => {
      const inp = s.parentElement.querySelector(".pm");
      inp.setAttribute("list", "dl-" + s.value);
      if (!inp.value || !s.dataset.keep) inp.value = PROVIDERS[s.value].models[0] || "";
    }));
  }
  function renderDatalists() {
    let host = $("#datalists");
    if (!host) {
      host = document.createElement("div");
      host.id = "datalists";
      document.body.appendChild(host);
    }
    const cache = getModelCache();
    host.innerHTML = Object.entries(PROVIDERS).map(([k, p]) => {
      const ids = [.../* @__PURE__ */ new Set([...k === "openrouter" ? cache.free || [] : [], ...p.models, ...k === "openrouter" ? (cache.all || []).slice(0, 400) : []])];
      return `<datalist id="dl-${k}">${ids.map((i) => `<option value="${esc(i)}">`).join("")}</datalist>`;
    }).join("");
  }
  function usageHtml(main = false) {
    const u = getUsage();
    const cap = getSettings().limits.dailyRequests || 200;
    const pct = Math.min(100, u.requests / cap * 100);
    return `<div>Today: <b ${main ? 'id="usage-requests"' : ""}>${u.requests}</b> / ${cap} requests</div>
  <div>${(u.promptTokens + u.completionTokens).toLocaleString()} tokens \xB7 $${u.cost.toFixed(4)}</div>
  <div class="muted">All time: ${u.total.requests} req \xB7 $${u.total.cost.toFixed(4)}</div><div class="bar"><i style="width:${pct}%"></i></div>`;
  }
  function renderUsage() {
    $("#usage").innerHTML = usageHtml(true);
    $$(".mobile-usage").forEach((e) => {
      const u = getUsage();
      e.textContent = `${u.requests}/${getSettings().limits.dailyRequests} req today \xB7 $${u.cost.toFixed(3)}`;
    });
  }
  window.addEventListener("usage", renderUsage);
  window.addEventListener("tts-unavailable", () => {
    if (state.ttsWarned) return;
    state.ttsWarned = true;
    toast("This browser has no built-in voices. To hear bots here, choose OpenAI or ElevenLabs voices in Settings \u2192 Voices.", 6e3);
  });
  window.addEventListener("tts-error", (e) => toast("Premium voice failed, using browser voice: " + e.detail, 4e3));
  function renderBanner() {
    const b = $("#banner");
    if (anyKey()) {
      b.classList.add("hidden");
      return;
    }
    b.innerHTML = `\u{1F44B} Add an API key to start. The quickest is a free <a href="https://openrouter.ai/keys" target="_blank" rel="noopener">OpenRouter key</a> \u2192 paste it in <a href="#" id="banner-go">Settings</a>.`;
    b.classList.remove("hidden");
    $("#banner-go").onclick = (e) => {
      e.preventDefault();
      show("settings");
    };
  }
  var renderers = {};
  function show(view) {
    var _a;
    state.view = view;
    $$("#nav button[data-view]").forEach((b) => b.classList.toggle("active", b.dataset.view === view));
    $$(".view").forEach((v) => v.classList.toggle("active", v.id === "view-" + view));
    const el = $("#view-" + view);
    if (el) el.scrollTop = 0;
    (_a = renderers[view]) == null ? void 0 : _a.call(renderers);
    renderBanner();
    renderUsage();
  }
  $$("#nav button[data-view]").forEach((b) => b.addEventListener("click", () => show(b.dataset.view)));
  ["keydown", "pointerdown", "wheel", "touchstart"].forEach((ev) => window.addEventListener(ev, () => {
    state.lastActivity = Date.now();
  }, { passive: true }));
  var tsHtml = (m) => m.ts ? `<time class="ts" datetime="${new Date(m.ts).toISOString()}">${fmtTime(m.ts)}</time>` : "";
  function msgHtml(m, i) {
    if (m.role === "system") return `<div class="muted small sysmsg" style="text-align:center">${esc(m.content)} \xB7 ${tsHtml(m)}</div>`;
    if (m.role === "user") return `<div class="msg user" data-i="${i}"><div class="bubble"><div class="who">You \xB7 ${tsHtml(m)}</div>${md(m.content)}</div></div>`;
    const b = botById(m.botId) || { emoji: m.emoji || "\u{1F916}", color: m.color || "#666", name: m.name };
    return `<div class="msg bot" data-i="${i}">${avatar(b)}<div class="bubble ${m.error ? "err" : ""}"><div class="who">${esc(m.name || b.name)} \xB7 <span>${esc(m.model || "")}</span> \xB7 ${tsHtml(m)} ${m.error ? "" : `<button class="btn small speak-btn" data-i="${i}" title="Read aloud" style="padding:0 6px;margin-left:4px">\u{1F50A}</button>`}</div><div class="content">${md(m.content)}</div></div></div>`;
  }
  renderers.chat = () => {
    var _a, _b;
    const bots = getBots();
    if (!state.chatBotId || !botById(state.chatBotId)) state.chatBotId = (_a = bots[0]) == null ? void 0 : _a.id;
    const bot = botById(state.chatBotId);
    const v = $("#view-chat");
    v.classList.add("split");
    v.innerHTML = `<div class="chat-side" id="chat-side"><div class="row" style="justify-content:space-between;padding:0 6px 8px"><b>Bots</b><button class="btn small" id="chat-newbot">+ New</button></div>
    ${bots.map((b) => `<div class="bot-item ${b.id === state.chatBotId ? "active" : ""}" data-id="${b.id}">${avatar(b)}<div class="meta"><b>${esc(b.name)}</b><small>${esc(b.role)} \xB7 ${esc(b.model)}</small></div></div>`).join("")}</div>
    <div class="chat-main">${bot ? `<div class="chat-head"><button class="btn small only-mobile" id="chat-bots">\u2630</button>${avatar(bot)}<div class="grow head-meta"><b id="chat-botname">${esc(bot.name)}</b><div class="muted small ell">${esc(modelLabel(bot.provider, bot.model))} \xB7 voice: ${esc((_b = VOICE_PRESETS[bot.voice || "none"]) == null ? void 0 : _b.label)}</div><div class="mobile-usage muted"></div></div>
      <label class="switch" title="Read every reply aloud"><input type="checkbox" id="chat-autospeak" ${bot.autoSpeak ? "checked" : ""}><span class="hide-mobile">Auto-speak</span><span class="only-mobile">\u{1F50A}</span></label>
      <button class="btn small" id="chat-stopvoice" title="Stop speaking">\u{1F507}</button><button class="btn small" id="chat-new" title="New chat"><span class="hide-mobile">New chat</span><span class="only-mobile">\uFF0B</span></button></div>
      <div class="thread" id="thread"></div>
      <div class="composer"><textarea id="chat-input" placeholder="Message ${esc(bot.name)}\u2026  (Enter to send, Shift+Enter for a new line)"></textarea>${srSupported() ? '<button class="btn" id="chat-dictate" title="Tap to talk">\u{1F3A4}</button>' : ""}<button class="btn primary" id="chat-send">Send</button></div>` : `<div class="empty">No bots yet. Create one in <b>Bots</b>.</div>`}</div>`;
    $$(".bot-item", v).forEach((el) => el.onclick = () => {
      state.chatBotId = el.dataset.id;
      state.chatConv = null;
      renderers.chat();
    });
    $("#chat-newbot").onclick = () => editBot(null);
    if (!bot) return;
    $("#chat-bots").onclick = () => $("#chat-side").classList.toggle("show");
    $("#chat-new").onclick = () => {
      state.chatConv = null;
      renderThread();
    };
    $("#chat-stopvoice").onclick = stopSpeaking;
    $("#chat-autospeak").onchange = (e) => {
      const bs = getBots();
      const b = bs.find((x) => x.id === bot.id);
      b.autoSpeak = e.target.checked;
      saveBots(bs);
      toast(e.target.checked ? `${b.name} will read replies aloud` : "Auto-speak off");
    };
    const inp = $("#chat-input");
    inp.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendChat();
      }
    });
    $("#chat-send").onclick = () => state.chatAbort ? state.chatAbort.abort() : sendChat();
    wireDictate("#chat-dictate", "#chat-input", () => sendChat());
    renderThread();
    renderUsage();
  };
  function renderThread() {
    const t = $("#thread");
    if (!t) return;
    const c2 = state.chatConv;
    const bot = botById(state.chatBotId);
    t.innerHTML = c2 && c2.messages.length ? c2.messages.map(msgHtml).join("") : `<div class="empty">${avatar(bot, 54)}<p><b>${esc(bot.name)}</b> \xB7 ${esc(bot.role)}</p><p class="small">${esc((bot.prompt || "").slice(0, 180))}\u2026</p></div>`;
    $$(".speak-btn", t).forEach((b) => b.onclick = () => {
      const m = state.chatConv.messages[+b.dataset.i];
      speak(m.content, botById(m.botId) || bot);
    });
    t.scrollTop = t.scrollHeight;
  }
  async function sendChat(opts = {}) {
    var _a;
    const inp = $("#chat-input");
    const text = (opts.text ?? inp.value).trim();
    if (!text) return;
    const bot = botById(state.chatBotId);
    if ((_a = state.idle) == null ? void 0 : _a.running) stopIdle("You started chatting, so idle talk stopped.");
    if (!state.chatConv) state.chatConv = newConv("chat", text.slice(0, 70), { botIds: [bot.id], botNames: [bot.name] });
    const c2 = state.chatConv;
    c2.messages.push({ role: "user", content: text, ts: Date.now() });
    inp.value = "";
    await saveConv(c2);
    renderThread();
    const m = { role: "assistant", botId: bot.id, name: bot.name, emoji: bot.emoji, color: bot.color, model: bot.model, provider: bot.provider, content: "", ts: Date.now() };
    c2.messages.push(m);
    renderThread();
    const el = $(`#thread .msg[data-i="${c2.messages.length - 1}"] .content`);
    el.innerHTML = '<span class="typing">thinking\u2026</span>';
    const send = $("#chat-send");
    send.textContent = "Stop";
    state.chatAbort = new AbortController();
    try {
      const hist = c2.messages.slice(0, -1).filter((x) => !x.error && x.role !== "system").slice(-20).map((x) => ({ role: x.role === "user" ? "user" : "assistant", content: x.content }));
      const r = await chat({
        provider: bot.provider,
        model: bot.model,
        system: systemPromptFor(bot),
        messages: hist,
        signal: state.chatAbort.signal,
        onDelta: (t) => {
          el.innerHTML = md(t);
          const th = $("#thread");
          if (th) th.scrollTop = th.scrollHeight;
        }
      });
      m.content = r.text || "(empty reply)";
      m.cost = r.cost;
      m.usage = r.usage;
    } catch (e) {
      if (e.name === "AbortError") {
        m.content = (el.textContent || "") + " [stopped]";
      } else {
        m.content = e.message;
        m.error = true;
      }
    }
    state.chatAbort = null;
    if ($("#chat-send")) $("#chat-send").textContent = "Send";
    m.ts = Date.now();
    await saveConv(c2);
    if (state.chatConv === c2) renderThread();
    const sb = botById(bot.id) || bot;
    if (opts.speakReply) await speak(m.content, sb.voice && sb.voice !== "none" ? sb : { ...sb, voice: "narrator" });
    else if (!m.error && sb.autoSpeak) speak(m.content, sb);
    return m;
  }
  function wireDictate(btnSel, inputSel, send) {
    const b = $(btnSel);
    if (!b) return;
    b.onclick = async () => {
      var _a;
      if ((_a = state.wake) == null ? void 0 : _a.enabled) state.wake.stop();
      b.textContent = "\u{1F534}";
      b.disabled = true;
      try {
        const t = await dictateOnce();
        if (t) {
          $(inputSel).value = t;
          send();
        } else toast("Didn\u2019t catch that. Try again.");
      } catch (e) {
        toast(e.message, 4e3);
      } finally {
        b.textContent = "\u{1F3A4}";
        b.disabled = false;
        if (getSettings().voiceInput.enabled) state.wake.start();
      }
    };
  }
  renderers.brain = () => {
    const s = getSettings();
    const v = $("#view-brain");
    v.innerHTML = `<h1>\u{1F9E0} Super Brain</h1><p class="sub">Asks ${s.brain.members.length} models the same question at once, then a judge model compares them, fixes mistakes and merges the best parts into one answer. Uses ${s.brain.members.length + 1} requests per question.</p>
  <div class="card"><div class="row" style="margin-bottom:8px">${s.brain.members.map((m) => `<span class="chip on">${esc(modelLabel(m.provider, m.model))}</span>`).join("")}<span class="chip">\u2696\uFE0F judge: ${esc(modelLabel(s.brain.aggregator.provider, s.brain.aggregator.model))}</span><button class="btn small" id="brain-edit">Edit models</button></div>
  <textarea id="brain-input" placeholder="Ask anything: electronics, games, code, reverse engineering\u2026" style="min-height:90px"></textarea>
  <div class="row" style="margin-top:10px"><label class="switch"><input type="checkbox" id="brain-speak"> Read the final answer aloud</label><span class="grow"></span><span class="mobile-usage muted"></span>${srSupported() ? '<button class="btn" id="brain-dictate" title="Tap to talk">\u{1F3A4}</button>' : ""}<button class="btn primary" id="brain-ask">Ask Super Brain</button></div></div>
  <div id="brain-out"></div>`;
    $("#brain-edit").onclick = () => {
      show("settings");
      setTimeout(() => {
        var _a;
        return (_a = $("#brain-section")) == null ? void 0 : _a.scrollIntoView({ behavior: "smooth" });
      }, 50);
    };
    $("#brain-ask").onclick = () => askBrain();
    wireDictate("#brain-dictate", "#brain-input", () => askBrain());
    $("#brain-input").addEventListener("keydown", (e) => {
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) askBrain();
    });
    renderUsage();
  };
  async function askBrain(opts = {}) {
    var _a, _b;
    if (state.brainBusy) return;
    const q = (opts.text ?? $("#brain-input").value).trim();
    if (!q) return;
    $("#brain-input").value = q;
    if ((_a = state.idle) == null ? void 0 : _a.running) stopIdle("You asked Super Brain, so idle talk stopped.");
    const s = getSettings();
    const members = s.brain.members;
    const agg = s.brain.aggregator;
    state.brainBusy = true;
    $("#brain-ask").disabled = true;
    const out = $("#brain-out");
    out.innerHTML = `<h2>Individual answers</h2><div class="answers">${members.map((m, i) => `<div class="answer" id="ans-${i}"><div class="ah"><b>${esc(modelLabel(m.provider, m.model))}</b><span class="st">\u23F3</span></div><div class="content muted">waiting\u2026</div></div>`).join("")}</div>
    <h2>\u2696\uFE0F Merged best answer</h2><p class="muted small" id="brain-asked">Asked ${fmtTime(Date.now())}</p><div class="card final" id="brain-final"><div class="bubble"><span class="typing">Waiting for the individual answers\u2026</span></div></div>`;
    const conv = newConv("superbrain", q.slice(0, 70), { botNames: ["Super Brain"] });
    conv.messages.push({ role: "user", content: q, ts: Date.now() });
    const system = "You are one expert in a panel answering the same question." + PROBLEM_SOLVER;
    const results = await Promise.allSettled(members.map((m, i) => chat({
      provider: m.provider,
      model: m.model,
      system,
      messages: [{ role: "user", content: q }],
      onDelta: (t) => {
        const c2 = $(`#ans-${i} .content`);
        if (c2) {
          c2.classList.remove("muted");
          c2.innerHTML = md(t);
        }
      }
    })));
    const good = [];
    results.forEach((r, i) => {
      var _a2;
      const card = $(`#ans-${i}`);
      const m = members[i];
      if (r.status === "fulfilled" && r.value.text.trim()) {
        good.push({ m, text: r.value.text });
        card.querySelector(".st").textContent = "\u2705 " + fmtTime(Date.now());
        card.querySelector(".content").innerHTML = md(r.value.text);
        conv.messages.push({ role: "assistant", name: m.model, model: m.model, provider: m.provider, content: r.value.text, ts: Date.now(), emoji: "\u{1F9E9}", color: "#60a5fa" });
      } else {
        const err = ((_a2 = r.reason) == null ? void 0 : _a2.message) || "Empty answer";
        card.querySelector(".st").textContent = "\u26A0\uFE0F";
        card.querySelector(".content").innerHTML = `<span style="color:var(--danger)">${esc(err)}</span>`;
        conv.messages.push({ role: "assistant", name: m.model, model: m.model, content: err, error: true, ts: Date.now() });
      }
    });
    const fin = $("#brain-final .bubble");
    if (!good.length) {
      fin.innerHTML = `<span style="color:var(--danger)">Every model failed, so there is nothing to merge. Check your keys and models in Settings.</span>`;
    } else {
      fin.innerHTML = '<span class="typing">Judge is comparing and merging\u2026</span>';
      const prompt = `Question:
${q}

Candidate answers from ${good.length} different AI models:

${good.map((g, i) => `### Answer ${i + 1} (${g.m.model})
${g.text}`).join("\n\n")}

Your job: compare the answers, point out errors, gaps or disagreements, then write the single best final answer that combines their strongest parts and fixes their mistakes. Use these sections: **Where they agree**, **Corrections & disagreements**, **Final answer**.`;
      try {
        const r = await chat({ provider: agg.provider, model: agg.model, system: "You are the Super Brain judge: a meticulous expert who critiques and synthesizes answers from several AI models into one best answer.", messages: [{ role: "user", content: prompt }], onDelta: (t) => {
          fin.innerHTML = md(t);
        } });
        fin.innerHTML = md(r.text) + `<p class="muted small">Merged by ${esc(agg.model)} \xB7 ${tsHtml({ ts: Date.now() })}</p>`;
        conv.messages.push({ role: "assistant", name: "Super Brain", model: agg.model, provider: agg.provider, content: r.text, final: true, ts: Date.now(), emoji: "\u{1F9E0}", color: "#8fd66b" });
        if (opts.speakReply) await speak(r.text, { voice: "narrator" });
        else if ((_b = $("#brain-speak")) == null ? void 0 : _b.checked) speak(r.text, { voice: "narrator" });
      } catch (e) {
        fin.innerHTML = `<span style="color:var(--danger)">Judge failed: ${esc(e.message)}</span><p class="muted small">Showing the first successful answer instead.</p>` + md(good[0].text);
        conv.messages.push({ role: "assistant", name: "Super Brain", model: agg.model, content: "Judge failed: " + e.message, error: true, ts: Date.now() });
      }
    }
    await saveConv(conv);
    state.brainBusy = false;
    const b = $("#brain-ask");
    if (b) b.disabled = false;
  }
  renderers.bots = () => {
    const bots = getBots();
    const v = $("#view-bots");
    v.innerHTML = `<div class="row"><div class="grow"><h1>\u{1F916} Bots</h1><p class="sub">Each bot has its own personality, job, model and voice. Bots with \u201CDeep problem-solving\u201D think step by step, propose several solutions, check their work and give a final best answer.</p></div><button class="btn primary" id="bot-new">+ New bot</button></div>
  <div class="bots-grid" id="bots-grid">${bots.map((b) => {
      var _a;
      return `<div class="bot-card" data-id="${b.id}"><div class="top">${avatar(b, 42)}<div class="grow"><b class="bname">${esc(b.name)}</b><div class="muted small">${esc(b.role)}</div></div></div>
    <p>${esc(b.prompt)}</p><div class="muted small">\u{1F9E0} ${esc(modelLabel(b.provider, b.model))}<br>\u{1F50A} ${esc(((_a = VOICE_PRESETS[b.voice || "none"]) == null ? void 0 : _a.label) || "No voice")}${b.autoSpeak ? " \xB7 auto-speak" : ""}</div>
    <div class="row"><button class="btn small b-chat">Chat</button><button class="btn small b-edit">Edit</button><button class="btn small b-voice" ${!b.voice || b.voice === "none" ? "disabled" : ""}>\u25B6 Voice</button><span class="grow"></span><button class="btn small danger b-del">Delete</button></div></div>`;
    }).join("") || '<div class="empty">No bots. Make one!</div>'}</div>`;
    $("#bot-new").onclick = () => editBot(null);
    $$(".bot-card", v).forEach((card) => {
      const id = card.dataset.id;
      $(".b-chat", card).onclick = () => {
        state.chatBotId = id;
        state.chatConv = null;
        show("chat");
      };
      $(".b-edit", card).onclick = () => editBot(id);
      $(".b-voice", card).onclick = () => previewVoice(botById(id));
      $(".b-del", card).onclick = () => {
        const b = botById(id);
        if (!confirm(`Delete ${b.name}? Its saved conversations stay in History.`)) return;
        saveBots(getBots().filter((x) => x.id !== id));
        toast(`Deleted ${b.name}`);
        renderers.bots();
      };
    });
  };
  function previewVoice(bot) {
    const p = VOICE_PRESETS[bot.voice || "none"];
    const line = p.duo ? `A: Dude, I'm ${bot.name}. B: And I'm also ${bot.name}. A: We're like, totally ready to help.` : `Hi, I'm ${bot.name}, your ${bot.role}. This is my ${p.label} voice. Let's solve something.`;
    if (ttsSupported() || getSettings().tts.engine !== "browser") toast(`\u{1F50A} Previewing ${p.label}`);
    speak(line, bot);
  }
  function editBot(id) {
    const existing = id ? botById(id) : null;
    const b = existing ? { ...existing } : { id: uid(), name: "", role: "Coding Architect", ...(() => {
      const p = ROLE_PRESETS["Coding Architect"];
      return { emoji: p.emoji, color: p.color, prompt: p.prompt, deep: true };
    })(), provider: "openrouter", model: FREE_DEFAULTS.strong, voice: "none", autoSpeak: false, createdAt: Date.now() };
    const voices = systemVoices();
    const card = openModal(`<h1>${existing ? "Edit bot" : "New bot"}</h1>
  <div class="row"><div style="width:80px"><label>Emoji</label><input type="text" id="bf-emoji" value="${esc(b.emoji)}" maxlength="4"></div><div style="width:70px"><label>Color</label><input type="color" id="bf-color" value="${esc(b.color)}" style="width:100%;height:40px;background:none;border:0"></div><div class="grow"><label>Name</label><input type="text" id="bf-name" value="${esc(b.name)}" placeholder="e.g. Sparky"></div></div>
  <label>Role preset</label><select id="bf-role">${Object.keys(ROLE_PRESETS).map((r) => `<option ${r === b.role ? "selected" : ""}>${esc(r)}</option>`).join("")}</select>
  <label>Personality / system prompt</label><textarea id="bf-prompt" style="min-height:110px">${esc(b.prompt)}</textarea>
  <label class="switch" style="margin-top:8px"><input type="checkbox" id="bf-deep" ${b.deep ? "checked" : ""}> Deep problem-solving (step by step, several solutions, self-check, final best answer)</label>
  <label>Model</label>${modelPicker("bf", b.provider, b.model)}
  <h2>\u{1F50A} Voice</h2>
  <div class="row"><div class="grow"><label>Voice preset</label><select id="bf-voice">${Object.entries(VOICE_PRESETS).map(([k, p]) => `<option value="${k}" ${k === (b.voice || "none") ? "selected" : ""}>${esc(p.label)}</option>`).join("")}</select></div>
  <div class="grow"><label>System voice (optional)</label><select id="bf-sysvoice"><option value="">Auto-pick for preset</option>${voices.map((x) => `<option ${x.name === b.voiceName ? "selected" : ""}>${esc(x.name)}</option>`).join("")}</select></div></div>
  <div class="row"><div class="grow"><label>Pitch adjust <span id="bf-pitchv">${(b.pitchMul || 1).toFixed(2)}</span>\xD7</label><input type="range" id="bf-pitch" min="0.5" max="1.5" step="0.05" value="${b.pitchMul || 1}" style="width:100%"></div>
  <div class="grow"><label>Speed adjust <span id="bf-ratev">${(b.rateMul || 1).toFixed(2)}</span>\xD7</label><input type="range" id="bf-rate" min="0.5" max="1.5" step="0.05" value="${b.rateMul || 1}" style="width:100%"></div></div>
  <p class="muted small" id="bf-style">${esc(VOICE_PRESETS[b.voice || "none"].style || "No speaking style added.")}</p>
  <div class="row"><label class="switch"><input type="checkbox" id="bf-autospeak" ${b.autoSpeak ? "checked" : ""}> Auto-speak replies</label><span class="grow"></span><button class="btn small" id="bf-preview">\u25B6 Preview voice</button></div>
  ${ttsSupported() ? "" : '<p class="muted small">This browser has no speech voices; voices work in Chrome on your Chromebook.</p>'}
  <div class="row" style="margin-top:18px;justify-content:flex-end"><button class="btn" id="bf-cancel">Cancel</button><button class="btn primary" id="bf-save">Save bot</button></div>`);
    wirePickers(card);
    let lastPreset = b.role;
    $("#bf-role").onchange = (e) => {
      const np = ROLE_PRESETS[e.target.value];
      const op = ROLE_PRESETS[lastPreset];
      if (!$("#bf-prompt").value.trim() || $("#bf-prompt").value === (op == null ? void 0 : op.prompt)) $("#bf-prompt").value = np.prompt;
      if (!existing || $("#bf-emoji").value === (op == null ? void 0 : op.emoji)) {
        $("#bf-emoji").value = np.emoji;
        $("#bf-color").value = np.color;
      }
      $("#bf-deep").checked = np.deep;
      lastPreset = e.target.value;
    };
    $("#bf-voice").onchange = (e) => {
      $("#bf-style").textContent = VOICE_PRESETS[e.target.value].style || "No speaking style added.";
    };
    $("#bf-pitch").oninput = (e) => {
      $("#bf-pitchv").textContent = (+e.target.value).toFixed(2);
    };
    $("#bf-rate").oninput = (e) => {
      $("#bf-ratev").textContent = (+e.target.value).toFixed(2);
    };
    const collect = () => ({
      ...b,
      name: $("#bf-name").value.trim(),
      emoji: $("#bf-emoji").value.trim() || "\u{1F916}",
      color: $("#bf-color").value,
      role: $("#bf-role").value,
      prompt: $("#bf-prompt").value,
      deep: $("#bf-deep").checked,
      provider: $("#bf-provider").value,
      model: $("#bf-model").value.trim(),
      voice: $("#bf-voice").value,
      voiceName: $("#bf-sysvoice").value || void 0,
      pitchMul: +$("#bf-pitch").value,
      rateMul: +$("#bf-rate").value,
      autoSpeak: $("#bf-autospeak").checked
    });
    $("#bf-preview").onclick = () => {
      const nb = collect();
      if (nb.voice === "none") return toast("Pick a voice preset first");
      previewVoice({ ...nb, name: nb.name || "your bot" });
    };
    $("#bf-cancel").onclick = () => {
      stopSpeaking();
      closeModal();
    };
    $("#bf-save").onclick = () => {
      var _a;
      const nb = collect();
      if (!nb.name) return toast("Give your bot a name");
      if (!nb.model) return toast("Pick a model");
      const bots = getBots();
      const i = bots.findIndex((x) => x.id === nb.id);
      if (i >= 0) bots[i] = nb;
      else bots.push(nb);
      saveBots(bots);
      stopSpeaking();
      closeModal();
      toast(`Saved ${nb.name}`);
      (_a = renderers[state.view]) == null ? void 0 : _a.call(renderers);
    };
  }
  renderers.idle = () => {
    const s = getSettings();
    const i = s.idle;
    const bots = getBots();
    const run = state.idle;
    const u = getUsage();
    const v = $("#view-idle");
    v.innerHTML = `<h1>\u{1F5E3}\uFE0F Idle Talk</h1><p class="sub">When you're away, picked bots talk to each other about a topic and take turns. Every session is capped and saved to History so you can read it later.</p>
  <div class="card"><div class="row"><label class="switch"><input type="checkbox" id="idle-enabled" ${i.enabled ? "checked" : ""}> Auto-start when I'm idle</label><span class="grow"></span>
    <label class="switch"><input type="checkbox" id="idle-read" ${s.tts.readIdleAloud ? "checked" : ""}> Read aloud in each bot's voice</label></div>
  <div class="row"><div class="grow"><label>Start after idle (seconds)</label><input type="number" id="idle-after" min="3" value="${i.idleAfterSec}"></div>
    <div class="grow"><label>Pause between turns (seconds)</label><input type="number" id="idle-interval" min="0" value="${i.intervalSec}"></div>
    <div class="grow"><label>Max turns per session (1-50)</label><input type="number" id="idle-turns" min="1" max="50" value="${i.maxTurns}"></div>
    <div class="grow"><label>Max auto sessions per day</label><input type="number" id="idle-sessions" min="0" value="${i.maxSessionsPerDay}"></div>
    <div class="grow"><label>Max $ per session (paid models)</label><input type="number" id="idle-cost" min="0" step="0.01" value="${i.maxCostPerSession}"></div></div>
  <label>Topic (leave blank for an open brainstorm)</label><input type="text" id="idle-topic" value="${esc(i.topic)}" placeholder="e.g. Designing a custom ESP32 display for an electric dirt bike">
  <label>Bots in the conversation (pick 2 or more)</label><div class="row" id="idle-bots">${bots.map((b) => `<label class="chip ${i.botIds.includes(b.id) ? "on" : ""}" style="cursor:pointer;margin:0"><input type="checkbox" value="${b.id}" ${i.botIds.includes(b.id) ? "checked" : ""} style="display:none">${esc(b.emoji)} ${esc(b.name)}</label>`).join("")}</div>
  <div class="row" style="margin-top:14px"><span class="muted small" id="idle-status">${(run == null ? void 0 : run.running) ? `Running \xB7 turn ${run.turn}/${run.maxTurns}` : `Idle sessions today: ${u.idleSessions}/${i.maxSessionsPerDay} \xB7 each session uses at most ${i.maxTurns} requests`}</span><span class="grow"></span>
    <button class="btn" id="idle-stop" ${(run == null ? void 0 : run.running) ? "" : "disabled"}>Stop</button><button class="btn primary" id="idle-start" ${(run == null ? void 0 : run.running) ? "disabled" : ""}>Start now</button></div></div>
  <div class="card"><div class="row"><b class="grow" id="idle-title">${run ? esc(run.conv.title) : "Live conversation"}</b>${run ? `<span class="muted small">$${run.cost.toFixed(4)}</span>` : ""}</div><div class="thread" id="idle-thread" style="padding:10px 0;max-height:none">${run ? run.conv.messages.map(msgHtml).join("") : '<div class="empty">Nothing yet. Press <b>Start now</b> or turn on auto-start.</div>'}</div></div>`;
    const save = () => {
      const st = getSettings();
      st.idle = {
        ...st.idle,
        enabled: $("#idle-enabled").checked,
        idleAfterSec: Math.max(3, +$("#idle-after").value || 120),
        intervalSec: Math.max(0, +$("#idle-interval").value || 0),
        maxTurns: Math.min(50, Math.max(1, +$("#idle-turns").value || 8)),
        maxSessionsPerDay: Math.max(0, +$("#idle-sessions").value || 0),
        maxCostPerSession: Math.max(0, +$("#idle-cost").value || 0),
        topic: $("#idle-topic").value,
        botIds: $$("#idle-bots input:checked").map((x) => x.value)
      };
      st.tts.readIdleAloud = $("#idle-read").checked;
      saveSettings(st);
    };
    $$("#view-idle input").forEach((x) => x.addEventListener("change", () => {
      save();
      if (x.closest("#idle-bots")) x.parentElement.classList.toggle("on", x.checked);
    }));
    $("#idle-start").onclick = () => {
      save();
      runIdle(true);
    };
    $("#idle-stop").onclick = () => stopIdle("Stopped by you.");
    $$("#idle-thread .speak-btn").forEach((b) => b.onclick = () => {
      const m = state.idle.conv.messages[+b.dataset.i];
      speak(m.content, botById(m.botId));
    });
  };
  function stopIdle(reason) {
    var _a;
    if ((_a = state.idle) == null ? void 0 : _a.running) {
      state.idle.stopReason = reason;
      state.idle.abort.abort();
      stopSpeaking();
      toast(reason);
    }
  }
  async function runIdle(manual) {
    var _a;
    if ((_a = state.idle) == null ? void 0 : _a.running) return;
    const s = getSettings();
    const cfg = s.idle;
    const bots = cfg.botIds.map(botById).filter(Boolean);
    if (bots.length < 2) {
      if (manual) toast("Pick at least 2 bots for Idle Talk");
      return;
    }
    const topic = cfg.topic.trim() || "Open brainstorm: pick an exciting idea in electronics, gaming or building a new program, and develop it together into something concrete.";
    const conv = newConv("idle", "Idle talk: " + (cfg.topic.trim() || "open brainstorm").slice(0, 60), { botIds: bots.map((b) => b.id), botNames: bots.map((b) => b.name), topic });
    conv.messages.push({ role: "system", content: `${manual ? "Started by you" : "Auto-started while you were idle"} \xB7 ${bots.map((b) => b.name).join(", ")} \xB7 max ${cfg.maxTurns} turns`, ts: Date.now() });
    const run = state.idle = { running: true, conv, turn: 0, maxTurns: cfg.maxTurns, cost: 0, abort: new AbortController() };
    addUsage({ idleSessions: 1 });
    await saveConv(conv);
    if (state.view === "idle") renderers.idle();
    let reason = `Reached the ${cfg.maxTurns}-turn cap for this session.`;
    for (let t = 0; t < cfg.maxTurns; t++) {
      if (run.abort.signal.aborted) break;
      const bot = bots[t % bots.length];
      const others = bots.filter((b) => b !== bot).map((b) => b.name).join(", ");
      const system = systemPromptFor(bot).replace(PROBLEM_SOLVER, "") + `

You are in a live group conversation with other AI bots: ${others}. Topic: ${topic}
Speak only as ${bot.name}. Keep each turn under 150 words. Build on or challenge what the others said and add at least one new, concrete idea. Do not write lines for the other bots.`;
      const msgs = [{ role: "user", content: `Topic: ${topic}
${t === 0 ? "You speak first. Kick things off." : "Here is the conversation so far."}` }];
      for (const m2 of conv.messages) if (m2.role === "assistant" && !m2.error) msgs.push(m2.botId === bot.id ? { role: "assistant", content: m2.content } : { role: "user", content: `${m2.name}: ${m2.content}` });
      if (t > 0) msgs.push({ role: "user", content: `(Your turn, ${bot.name}.)` });
      const m = { role: "assistant", botId: bot.id, name: bot.name, emoji: bot.emoji, color: bot.color, model: bot.model, provider: bot.provider, content: "", ts: Date.now() };
      conv.messages.push(m);
      run.turn = t + 1;
      if (state.view === "idle") renderers.idle();
      const el = () => $(`#idle-thread .msg[data-i="${conv.messages.length - 1}"] .content`);
      try {
        const r = await chat({ provider: bot.provider, model: bot.model, system, messages: msgs, signal: run.abort.signal, onDelta: (x) => {
          const e = el();
          if (e) e.innerHTML = md(x);
        } });
        m.content = (r.text || "").replace(new RegExp("^\\s*\\**" + bot.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\**\\s*:\\s*", "i"), "").trim() || "(no reply)";
        m.cost = r.cost;
        run.cost += r.cost || 0;
      } catch (e) {
        conv.messages.pop();
        if (e.name !== "AbortError") {
          reason = "Stopped because of an error: " + e.message;
        }
        break;
      }
      await saveConv(conv);
      if (state.view === "idle") renderers.idle();
      if (getSettings().tts.readIdleAloud) await speak(m.content, bot);
      if (cfg.maxCostPerSession > 0 && run.cost >= cfg.maxCostPerSession) {
        reason = `Reached the $${cfg.maxCostPerSession} cost cap for this session.`;
        break;
      }
      if (t < cfg.maxTurns - 1) {
        const end = Date.now() + cfg.intervalSec * 1e3;
        while (Date.now() < end && !run.abort.signal.aborted) await sleep(150);
      }
    }
    if (run.abort.signal.aborted) reason = run.stopReason || "Stopped.";
    conv.messages.push({ role: "system", content: `Session ended \xB7 ${reason}`, ts: Date.now() });
    run.running = false;
    await saveConv(conv);
    state.lastActivity = Date.now();
    if (state.view === "idle") renderers.idle();
  }
  setInterval(() => {
    var _a;
    const s = getSettings();
    const i = s.idle;
    if (!i.enabled || ((_a = state.idle) == null ? void 0 : _a.running) || state.chatAbort || state.brainBusy) return;
    if (Date.now() - state.lastActivity < i.idleAfterSec * 1e3) return;
    if (getUsage().idleSessions >= i.maxSessionsPerDay) return;
    runIdle(false);
  }, 1e3);
  function convToMd(c2) {
    var _a;
    const lines = [`# ${c2.title}`, "", `- Type: ${c2.type}`, `- Started: ${fmtTime(c2.createdAt)} (${new Date(c2.createdAt).toISOString()})`, `- Updated: ${fmtTime(c2.updatedAt)} (${new Date(c2.updatedAt).toISOString()})`, ((_a = c2.botNames) == null ? void 0 : _a.length) ? `- Bots: ${c2.botNames.join(", ")}` : "", c2.topic ? `- Topic: ${c2.topic}` : "", ""];
    for (const m of c2.messages) {
      const when = m.ts ? `${fmtTime(m.ts)} (${new Date(m.ts).toISOString()})` : "";
      if (m.role === "system") lines.push(`> ${m.content} \xB7 ${when}`, "");
      else lines.push(`**${m.role === "user" ? "You" : m.name}**${m.model ? ` (${m.model})` : ""} \xB7 ${when}${m.error ? " \xB7 ERROR" : ""}`, "", m.content, "");
    }
    return lines.filter((l, i, a) => !(l === "" && a[i - 1] === "")).join("\n");
  }
  var hl = (text, q) => {
    const e = esc(text);
    if (!q) return e;
    const re = new RegExp(esc(q).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
    return e.replace(re, (x) => `<mark>${x}</mark>`);
  };
  renderers.history = async () => {
    const v = $("#view-history");
    v.innerHTML = `<div class="row"><div class="grow"><h1>\u{1F558} History</h1><p class="sub">Every chat, Super Brain question and bot-to-bot talk, saved only in this browser (IndexedDB).</p></div>
  <button class="btn small" id="hist-exp-json">Export all JSON</button><button class="btn small" id="hist-exp-md">Export all Markdown</button></div>
  <div class="row" style="margin-bottom:12px"><input type="search" id="hist-search" class="grow" placeholder="Search titles and messages\u2026" value="${esc(state.histQuery)}" style="width:auto">
  <select id="hist-type" style="width:170px"><option value="">All types</option><option value="chat" ${state.histType === "chat" ? "selected" : ""}>Chats</option><option value="superbrain" ${state.histType === "superbrain" ? "selected" : ""}>Super Brain</option><option value="idle" ${state.histType === "idle" ? "selected" : ""}>Bot-to-bot</option></select></div>
  <div id="hist-list"></div>`;
    const all = await listConvs();
    const draw = () => {
      const q = state.histQuery.trim().toLowerCase();
      const items = all.filter((c2) => (!state.histType || c2.type === state.histType) && (!q || c2.title.toLowerCase().includes(q) || c2.messages.some((m) => (m.content || "").toLowerCase().includes(q))));
      $("#hist-list").innerHTML = items.length ? items.map((c2) => {
        const hit = q ? c2.messages.find((m) => (m.content || "").toLowerCase().includes(q)) : c2.messages.filter((m) => m.role !== "system").slice(-1)[0];
        let snip = ((hit == null ? void 0 : hit.content) || "").replace(/[*_`#>]+/g, "").replace(/\s+/g, " ");
        if (q && hit) {
          const k = snip.toLowerCase().indexOf(q);
          snip = (k > 60 ? "\u2026" : "") + snip.slice(Math.max(0, k - 60), k + 140);
        } else snip = snip.slice(0, 160);
        const who = hit ? hit.role === "user" ? "You" : hit.name || "" : "";
        return `<div class="hist-item" data-id="${c2.id}"><div class="grow"><div class="row"><span class="badge ${c2.type}">${c2.type === "idle" ? "bot-to-bot" : c2.type === "superbrain" ? "super brain" : "chat"}</span><span class="t">${hl(c2.title, q)}</span></div><div class="p">${hit ? `<span class="hit-meta">${esc(who)} \xB7 ${tsHtml(hit)}:</span> ` : ""}${hl(snip, q)}</div></div><div class="muted small" style="white-space:nowrap;text-align:right">Started ${fmtTime(c2.createdAt)}<br>Updated ${fmtTime(c2.updatedAt)}<br>${c2.messages.filter((m) => m.role !== "system").length} msgs</div></div>`;
      }).join("") : `<div class="empty">${all.length ? "No matches." : "No conversations yet."}</div>`;
      $$(".hist-item").forEach((el) => el.onclick = () => openConv(all.find((c2) => c2.id === el.dataset.id)));
    };
    $("#hist-search").oninput = (e) => {
      state.histQuery = e.target.value;
      draw();
    };
    $("#hist-type").onchange = (e) => {
      state.histType = e.target.value;
      draw();
    };
    $("#hist-exp-json").onclick = () => download(`hey-bryson-history-${today()}.json`, JSON.stringify({ exportedAt: (/* @__PURE__ */ new Date()).toISOString(), conversations: all.map(stampMessages) }, null, 2), "application/json");
    $("#hist-exp-md").onclick = () => download(`hey-bryson-history-${today()}.md`, all.map(convToMd).join("\n\n---\n\n"), "text/markdown");
    draw();
  };
  function openConv(c2) {
    const card = openModal(`<div class="row"><h1 class="grow">${esc(c2.title)}</h1><button class="btn small" id="cv-close">\u2715</button></div><p class="sub">${esc(c2.type)} \xB7 ${fmtTime(c2.createdAt)}${c2.botNames ? " \xB7 " + esc(c2.botNames.join(", ")) : ""}</p>
    <div class="thread" id="cv-thread" style="padding:0;max-height:55vh">${c2.messages.map(msgHtml).join("")}</div>
    <div class="row" style="margin-top:14px"><button class="btn small danger" id="cv-del">Delete</button><span class="grow"></span>${c2.type === "chat" ? '<button class="btn small" id="cv-cont">Continue chat</button>' : ""}<button class="btn small" id="cv-json">Export JSON</button><button class="btn small" id="cv-md">Export Markdown</button></div>`);
    $$(".speak-btn", card).forEach((b) => b.onclick = () => {
      const m = c2.messages[+b.dataset.i];
      speak(m.content, botById(m.botId) || { voice: "narrator", name: m.name });
    });
    $("#cv-close").onclick = closeModal;
    const fname = c2.title.replace(/[^\w-]+/g, "-").slice(0, 40);
    $("#cv-json").onclick = () => download(`${fname}.json`, JSON.stringify(stampMessages(c2), null, 2), "application/json");
    $("#cv-md").onclick = () => download(`${fname}.md`, convToMd(c2), "text/markdown");
    $("#cv-del").onclick = async () => {
      if (!confirm("Delete this conversation?")) return;
      await deleteConv(c2.id);
      closeModal();
      renderers.history();
    };
    const cont = $("#cv-cont");
    if (cont) cont.onclick = () => {
      var _a;
      if (!botById((_a = c2.botIds) == null ? void 0 : _a[0])) return toast("That bot was deleted");
      state.chatBotId = c2.botIds[0];
      state.chatConv = c2;
      closeModal();
      show("chat");
    };
  }
  var KEY_PROVIDERS = ["openrouter", "openai", "xai", "anthropic", "gemini"];
  renderers.settings = () => {
    var _a;
    const s = getSettings();
    const keys = getKeys();
    const cache = getModelCache();
    const v = $("#view-settings");
    v.innerHTML = `<h1>\u2699\uFE0F Settings</h1><p class="sub">API keys are stored only in this browser (localStorage) and are sent only to the provider they belong to. Nothing is hard-coded and there is no server.</p>
  <div class="card"><h2 style="margin-top:0">API keys</h2><p class="muted small">Only OpenRouter is needed: one free key reaches free models plus paid GPT, Claude, Gemini, Grok, DeepSeek and Qwen. Direct keys are optional.</p>
  ${KEY_PROVIDERS.map((p) => `<div class="keyrow"><div><span class="status-dot ${keys[p] ? "ok" : ""}"></span> ${esc(PROVIDERS[p].label)}</div><input type="password" id="key-${p}" value="${esc(keys[p] || "")}" placeholder="${p === "openrouter" ? "sk-or-v1-\u2026" : "optional"}" autocomplete="off">
    <div class="row" style="flex-wrap:nowrap"><button class="btn small" data-show="${p}">\u{1F441}</button><button class="btn small" data-test="${p}">Test</button><a class="btn small" href="${PROVIDERS[p].keyUrl}" target="_blank" rel="noopener">Get key</a></div></div>`).join("")}
  <div class="keyrow"><div><span class="status-dot ${keys.elevenlabs ? "ok" : ""}"></span> ElevenLabs (voices)</div><input type="password" id="key-elevenlabs" value="${esc(keys.elevenlabs || "")}" placeholder="optional, premium voices" autocomplete="off"><div class="row" style="flex-wrap:nowrap"><button class="btn small" data-show="elevenlabs">\u{1F441}</button><a class="btn small" href="https://elevenlabs.io/app/settings/api-keys" target="_blank" rel="noopener">Get key</a></div></div>
  <details><summary>Advanced: custom OpenAI-compatible server and base URLs</summary>
    <div class="row"><div class="grow"><label>Custom provider name</label><input type="text" id="custom-name" value="${esc(s.customName)}"></div><div class="grow"><label>Custom API key</label><input type="password" id="key-custom" value="${esc(keys.custom || "")}"></div></div>
    ${Object.keys(PROVIDERS).map((p) => `<label>${esc(PROVIDERS[p].label)} base URL</label><input type="text" id="base-${p}" value="${esc(s.baseUrls[p] || "")}" placeholder="${esc(PROVIDERS[p].base || "https://your-server/v1")}">`).join("")}
  </details>
  <div class="row" style="margin-top:14px;justify-content:flex-end"><span class="muted small" id="keys-msg"></span><button class="btn primary" id="save-keys">Save keys</button></div></div>

  <div class="card"><h2 style="margin-top:0">Free models</h2><p class="muted small">OpenRouter's free model list changes often. Free models allow about 20 requests/minute and 50/day (1,000/day once you've bought $10 of credits). Last refreshed: <span id="free-at">${cache.at ? fmtTime(cache.at) : "never"}</span>.</p>
  <div class="row"><button class="btn" id="refresh-free">Refresh free models</button><span class="muted small" id="free-count">${((_a = cache.free) == null ? void 0 : _a.length) ? cache.free.length + " free models: " + esc(cache.free.slice(0, 8).join(", ")) + (cache.free.length > 8 ? "\u2026" : "") : ""}</span></div></div>

  <div class="card" id="brain-section"><h2 style="margin-top:0">\u{1F9E0} Super Brain models</h2><p class="muted small">These answer every Super Brain question in parallel, then the judge merges them.</p>
  <div id="brain-members">${s.brain.members.map((m, i) => `<div class="row" style="flex-wrap:nowrap">${modelPicker("mem" + i, m.provider, m.model)}<button class="btn small danger" data-rm="${i}">\u2715</button></div>`).join("")}</div>
  <button class="btn small" id="brain-add">+ Add model</button>
  <label>\u2696\uFE0F Judge (merges the answers)</label>${modelPicker("agg", s.brain.aggregator.provider, s.brain.aggregator.model)}
  <div class="row" style="justify-content:flex-end"><button class="btn primary" id="save-brain">Save Super Brain</button></div></div>

  <div class="card"><h2 style="margin-top:0">\u{1F50A} Voices</h2><p class="muted small">Browser voices are free and built into Chrome. Premium voices cost money per use on your own OpenAI or ElevenLabs account (stock voices only).</p>
  <div class="row"><div class="grow"><label>Voice engine</label><select id="tts-engine"><option value="browser" ${s.tts.engine === "browser" ? "selected" : ""}>Browser (free)</option><option value="openai" ${s.tts.engine === "openai" ? "selected" : ""}>OpenAI TTS (uses OpenAI key)</option><option value="elevenlabs" ${s.tts.engine === "elevenlabs" ? "selected" : ""}>ElevenLabs stock voices</option></select></div>
  <div class="grow"><label>OpenAI TTS model</label><input type="text" id="tts-openai-model" value="${esc(s.tts.openaiModel)}"></div><div class="grow"><label>ElevenLabs model</label><input type="text" id="tts-eleven-model" value="${esc(s.tts.elevenModel)}"></div></div>
  <div class="row" style="justify-content:flex-end;margin-top:10px"><span class="muted small" id="tts-status">${ttsSupported() ? systemVoices().length + " browser voices found" : "This browser has no built-in voices. Pick OpenAI or ElevenLabs to hear bots here."}</span><button class="btn primary" id="save-tts">Save voices</button></div></div>

  <div class="card"><h2 style="margin-top:0">\u{1F399}\uFE0F \u201CHey Bryson\u201D wake word</h2><p class="muted small">While the app is open and the mic is on, say \u201CHey Bryson\u201D, then your question. HEY_BRYSON answers out loud. ${srSupported() ? "Chrome transcribes speech using Google\u2019s speech service." : '<b id="vi-unsupported">' + esc(NO_SR_MSG) + "</b>"}</p>
  <div class="row"><label class="switch"><input type="checkbox" id="vi-enabled" ${s.voiceInput.enabled && srSupported() ? "checked" : ""} ${srSupported() ? "" : "disabled"}> Listen for \u201CHey Bryson\u201D</label><span class="grow"></span>
  <div style="width:240px"><label>Send questions to</label><select id="vi-target"><option value="chat" ${s.voiceInput.target === "chat" ? "selected" : ""}>The bot open in Chat</option><option value="brain" ${s.voiceInput.target === "brain" ? "selected" : ""}>Super Brain</option></select></div></div></div>

  <div class="card"><h2 style="margin-top:0">Limits & usage</h2><div class="usage" style="margin:0 0 10px">${usageHtml()}</div>
  <div class="row"><div class="grow"><label>Max requests per day (safety cap for all features)</label><input type="number" id="limit-daily" min="1" value="${s.limits.dailyRequests}"></div><button class="btn primary" id="save-limits" style="margin-top:28px">Save</button></div></div>

  <div class="card"><h2 style="margin-top:0">Data</h2><div class="row"><button class="btn" id="data-bots">Export bots</button><button class="btn" id="data-import">Import bots</button><input type="file" id="data-file" accept=".json" class="hidden"><span class="grow"></span><button class="btn danger" id="data-clear">Clear history</button><button class="btn danger" id="data-reset">Reset everything</button></div></div>
  <p class="muted small" style="text-align:center">HEY_BRYSON v1.0 \xB7 runs entirely in your browser</p>`;
    wirePickers(v);
    $$("[data-show]", v).forEach((b) => b.onclick = () => {
      const i = $("#key-" + b.dataset.show);
      i.type = i.type === "password" ? "text" : "password";
    });
    $("#save-keys").onclick = () => {
      const k = { ...getKeys() };
      for (const p of [...KEY_PROVIDERS, "elevenlabs", "custom"]) {
        const val = $("#key-" + p).value.trim();
        if (val) k[p] = val;
        else delete k[p];
      }
      saveKeys(k);
      const st = getSettings();
      st.customName = $("#custom-name").value.trim() || "Custom";
      for (const p of Object.keys(PROVIDERS)) {
        const val = $("#base-" + p).value.trim();
        if (val) st.baseUrls[p] = val;
        else delete st.baseUrls[p];
      }
      saveSettings(st);
      toast("Keys saved in this browser");
      renderBanner();
      renderers.settings();
    };
    $$("[data-test]", v).forEach((b) => b.onclick = async () => {
      var _a2;
      const p = b.dataset.test;
      b.textContent = "\u2026";
      try {
        if (p === "openrouter") {
          const key = $("#key-openrouter").value.trim();
          const r = await fetch(`${baseUrl("openrouter")}/key`, { headers: { authorization: `Bearer ${key}` } });
          if (!r.ok) throw new Error("HTTP " + r.status);
          const j = await r.json();
          toast(`\u2705 OpenRouter key works${((_a2 = j.data) == null ? void 0 : _a2.is_free_tier) ? " (free tier)" : ""}`);
        } else {
          if (!hasKey(p)) throw new Error("Save the key first");
          const ids = await listModels(p);
          toast(`\u2705 ${PROVIDERS[p].label} works \xB7 ${ids.length} models`);
        }
        b.textContent = "\u2705";
      } catch (e) {
        b.textContent = "\u26A0\uFE0F";
        toast(`${PROVIDERS[p].label}: ${e.message}`, 5e3);
      }
    });
    $("#refresh-free").onclick = async () => {
      try {
        await listModels("openrouter");
        renderDatalists();
        toast(`Found ${getModelCache().free.length} free models`);
        renderers.settings();
      } catch (e) {
        toast(e.message, 5e3);
      }
    };
    const readMembers = () => $$("#brain-members [data-picker]").map((el) => ({ provider: $(".pp", el).value, model: $(".pm", el).value.trim() })).filter((m) => m.model);
    $("#brain-add").onclick = () => {
      const st = getSettings();
      st.brain.members = [...readMembers(), { provider: "openrouter", model: FREE_DEFAULTS.router }];
      saveSettings(st);
      renderers.settings();
      setTimeout(() => $("#brain-section").scrollIntoView(), 0);
    };
    $$("[data-rm]", v).forEach((b) => b.onclick = () => {
      const st = getSettings();
      const ms = readMembers();
      ms.splice(+b.dataset.rm, 1);
      st.brain.members = ms;
      saveSettings(st);
      renderers.settings();
      setTimeout(() => $("#brain-section").scrollIntoView(), 0);
    });
    $("#save-brain").onclick = () => {
      const ms = readMembers();
      if (!ms.length) return toast("Add at least one model");
      const st = getSettings();
      st.brain.members = ms;
      st.brain.aggregator = { provider: $("#agg-provider").value, model: $("#agg-model").value.trim() };
      saveSettings(st);
      toast("Super Brain saved");
    };
    $("#vi-enabled").onchange = (e) => setMic(e.target.checked);
    $("#vi-target").onchange = (e) => {
      const st = getSettings();
      st.voiceInput.target = e.target.value;
      saveSettings(st);
      toast(e.target.value === "brain" ? "Voice questions go to Super Brain" : "Voice questions go to the open bot");
    };
    $("#save-tts").onclick = () => {
      const st = getSettings();
      st.tts = { ...st.tts, engine: $("#tts-engine").value, openaiModel: $("#tts-openai-model").value.trim() || "gpt-4o-mini-tts", elevenModel: $("#tts-eleven-model").value.trim() || "eleven_flash_v2_5" };
      saveSettings(st);
      toast("Voice settings saved");
    };
    $("#save-limits").onclick = () => {
      const st = getSettings();
      st.limits.dailyRequests = Math.max(1, +$("#limit-daily").value || 200);
      saveSettings(st);
      renderUsage();
      toast("Limit saved");
      renderers.settings();
    };
    $("#data-bots").onclick = () => download("hey-bryson-bots.json", JSON.stringify(getBots(), null, 2), "application/json");
    $("#data-import").onclick = () => $("#data-file").click();
    $("#data-file").onchange = async (e) => {
      try {
        const arr = JSON.parse(await e.target.files[0].text());
        if (!Array.isArray(arr)) throw new Error("Not a bot list");
        const bots = getBots();
        for (const b of arr) if (b.name && b.model) bots.push({ ...b, id: uid() });
        saveBots(bots);
        toast(`Imported ${arr.length} bots`);
      } catch (err) {
        toast("Import failed: " + err.message);
      }
    };
    $("#data-clear").onclick = async () => {
      if (!confirm("Delete all saved conversations?")) return;
      await clearConvs();
      toast("History cleared");
    };
    $("#data-reset").onclick = async () => {
      if (!confirm("Reset everything: keys, bots, settings and history?")) return;
      await clearConvs();
      Object.keys(localStorage).filter((k) => k.startsWith("pearhub.")).forEach((k) => localStorage.removeItem(k));
      location.reload();
    };
  };
  var MIC_TEXT = { off: "Hey Bryson: off", wake: "Say \u201CHey Bryson\u201D", question: "Listening\u2026", busy: "Thinking\u2026", denied: "Mic blocked", unsupported: "Voice: not in this browser" };
  var NO_SR_MSG = "\u201CHey Bryson\u201D needs speech recognition, which this browser doesn\u2019t offer (DuckDuckGo and Firefox don\u2019t). Everything else works: just type, or tap the mic key on your keyboard to dictate. For the wake word, open HEY_BRYSON in Chrome.";
  function micUi(mode, detail) {
    const b = $("#mic-toggle");
    if (b) {
      b.classList.toggle("on", mode !== "off" && mode !== "denied" && mode !== "unsupported");
      b.querySelector("em").textContent = MIC_TEXT[mode] || mode;
      b.dataset.mode = mode;
    }
    const pill = $("#mic-pill");
    if (mode === "question") {
      pill.textContent = "\u{1F399}\uFE0F Listening for your question\u2026";
      pill.classList.remove("hidden");
    } else if (mode === "busy") {
      pill.textContent = "\u{1F9E0} " + (detail ? `\u201C${detail}\u201D` : "Thinking\u2026");
      pill.classList.remove("hidden");
    } else pill.classList.add("hidden");
    if (mode === "denied") toast("Microphone permission was blocked. Allow it in the address bar to use \u201CHey Bryson\u201D.", 5e3);
    if (mode === "unsupported" && state.micClicked) toast(NO_SR_MSG, 8e3);
  }
  async function routeVoiceQuestion(q) {
    const target = getSettings().voiceInput.target;
    if (target === "brain") {
      show("brain");
      await askBrain({ text: q, speakReply: true });
    } else {
      if (state.view !== "chat") show("chat");
      await sendChat({ text: q, speakReply: true });
    }
  }
  state.wake = createWake({ onState: micUi, onQuestion: routeVoiceQuestion, wakePhrase: getSettings().voiceInput.wakePhrase });
  function setMic(on) {
    const st = getSettings();
    st.voiceInput.enabled = on;
    saveSettings(st);
    if (on) state.wake.start();
    else state.wake.stop();
  }
  $("#mic-toggle").addEventListener("click", () => {
    state.micClicked = true;
    if (!srSupported()) {
      micUi("unsupported");
      return;
    }
    setMic(!state.wake.enabled);
  });
  async function handleLaunchParams() {
    const p = new URLSearchParams(location.search);
    const q = p.get("q");
    if (!q) return;
    history.replaceState(null, "", location.pathname);
    if (!anyKey()) {
      show("settings");
      toast("Add your OpenRouter key first, then ask again.", 4e3);
      return;
    }
    if (p.get("mode") === "brain") {
      show("brain");
      await askBrain({ text: q });
    } else {
      const b = getBots().find((x) => x.name.toLowerCase() === (p.get("bot") || "").toLowerCase());
      if (b) state.chatBotId = b.id;
      show("chat");
      await sendChat({ text: q });
    }
  }
  renderDatalists();
  if (ttsSupported()) speechSynthesis.onvoiceschanged = () => {
  };
  var c = getModelCache();
  if (!c.at || Date.now() - c.at > 864e5) listModels("openrouter").then(renderDatalists).catch(() => {
  });
  show("chat");
  if (!srSupported()) micUi("unsupported");
  else if (getSettings().voiceInput.enabled) state.wake.start();
  else micUi("off");
  handleLaunchParams();
})();
