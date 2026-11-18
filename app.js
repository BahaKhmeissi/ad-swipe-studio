/* Ad Swipe Studio — all logic runs in the browser. */
(function () {
  'use strict';

  // ---------- data ----------
  var COUNTRIES = [
    ['CG', 'Congo-Brazzaville', 'French', 'FCFA', 'Brazzaville, Pointe-Noire'],
    ['CD', 'DR Congo', 'French', 'USD / CDF', 'Kinshasa, Lubumbashi'],
    ['CI', "Côte d'Ivoire", 'French', 'FCFA', 'Abidjan, Bouaké'],
    ['SN', 'Senegal', 'French', 'FCFA', 'Dakar, Thiès'],
    ['CM', 'Cameroon', 'French', 'FCFA', 'Douala, Yaoundé'],
    ['GA', 'Gabon', 'French', 'FCFA', 'Libreville, Port-Gentil'],
    ['BJ', 'Benin', 'French', 'FCFA', 'Cotonou, Porto-Novo'],
    ['TG', 'Togo', 'French', 'FCFA', 'Lomé, Kara'],
    ['BF', 'Burkina Faso', 'French', 'FCFA', 'Ouagadougou, Bobo-Dioulasso'],
    ['ML', 'Mali', 'French', 'FCFA', 'Bamako, Sikasso'],
    ['GN', 'Guinea', 'French', 'GNF', 'Conakry, Kankan'],
    ['NE', 'Niger', 'French', 'FCFA', 'Niamey, Zinder'],
    ['TD', 'Chad', 'French', 'FCFA', "N'Djamena, Moundou"],
    ['CF', 'Central African Rep.', 'French', 'FCFA', 'Bangui'],
    ['MG', 'Madagascar', 'French', 'Ariary', 'Antananarivo, Toamasina'],
    ['MA', 'Morocco', 'French', 'MAD', 'Casablanca, Rabat, Marrakech'],
    ['DZ', 'Algeria', 'French', 'DZD', 'Alger, Oran, Constantine'],
    ['TN', 'Tunisia', 'French', 'TND', 'Tunis, Sfax, Sousse'],
    ['NG', 'Nigeria', 'English', 'NGN (₦)', 'Lagos, Abuja, Port Harcourt'],
    ['GH', 'Ghana', 'English', 'GHS (GH₵)', 'Accra, Kumasi'],
    ['KE', 'Kenya', 'English', 'KES (KSh)', 'Nairobi, Mombasa'],
    ['UG', 'Uganda', 'English', 'UGX', 'Kampala'],
    ['TZ', 'Tanzania', 'English', 'TZS', 'Dar es Salaam, Arusha'],
    ['RW', 'Rwanda', 'French', 'RWF', 'Kigali'],
    ['ZM', 'Zambia', 'English', 'ZMW', 'Lusaka'],
    ['ZA', 'South Africa', 'English', 'ZAR (R)', 'Johannesburg, Cape Town, Durban'],
    ['AO', 'Angola', 'Portuguese', 'AOA (Kz)', 'Luanda'],
    ['MZ', 'Mozambique', 'Portuguese', 'MZN', 'Maputo'],
    ['SA', 'Saudi Arabia', 'Arabic', 'SAR', 'Riyadh, Jeddah'],
    ['AE', 'United Arab Emirates', 'Arabic', 'AED', 'Dubai, Abu Dhabi'],
    ['FR', 'France', 'French', 'EUR', 'Paris, Lyon, Marseille'],
    ['BE', 'Belgium', 'French', 'EUR', 'Bruxelles, Liège']
  ];
  var KW = {
    French: 'varices\njambes\ndouleur\ncirculation\ncrème\nminceur\ndents\npeau\ncheveux\nmassage\nlivraison gratuite\npaiement à la livraison\ncommander maintenant\npromo',
    English: 'pain relief\nlegs\ncream\nslimming\nteeth whitening\nskin\nhair\nmassage\nfree delivery\npay on delivery\norder now\npromo\ngadget',
    Arabic: 'كريم\nألم\nتنحيف\nبشرة\nشعر\nالدفع عند الاستلام\nتوصيل مجاني\nعرض\ncrème\npaiement à la livraison',
    Portuguese: 'creme\ndor\npernas\nemagrecer\npele\ncabelo\nentrega grátis\npagamento na entrega\npromoção',
    Spanish: 'crema\ndolor\npiernas\nadelgazar\npiel\ncabello\nenvío gratis\npago contra entrega\noferta'
  };
  var KEY = 'adswipe_v1';
  var db = load();

  function load() {
    try { var d = JSON.parse(localStorage.getItem(KEY) || 'null'); if (d) return d; } catch (e) {}
    return { settings: { model: 'claude-opus-5-5' }, current: 'CG', countries: {}, products: [] };
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(db)); }
    catch (e) { alert('Could not save (browser storage full?). Back up and clear old countries.'); }
  }
  function C() {
    var c = db.current;
    if (!db.countries[c]) db.countries[c] = { ads: {}, runs: [], excluded: {}, keywords: null, language: null, analysis: null };
    return db.countries[c];
  }
  function countryInfo(code) {
    for (var i = 0; i < COUNTRIES.length; i++) if (COUNTRIES[i][0] === code) return COUNTRIES[i];
    return [code, code, 'French', '', ''];
  }

  // ---------- helpers ----------
  var $ = function (id) { return document.getElementById(id); };
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function libLink(id) { return 'https://www.facebook.com/ads/library/?id=' + id; }
  function searchUrl(country, kw) {
    return 'https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=' + encodeURIComponent(country) +
      '&q=' + encodeURIComponent(kw) + '&search_type=keyword_unordered&media_type=all';
  }
  function norm(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9À-ɏ؀-ۿ]+/g, ''); }

  // ---------- winners (same scoring as the skill) ----------
  function winners(country) {
    var cd = db.countries[country]; if (!cd) return [];
    var groups = {};
    Object.keys(cd.ads).forEach(function (id) {
      var a = cd.ads[id];
      var key = norm(a.copy).slice(0, 40) || ('id' + id);
      var g = groups[key];
      if (!g) g = groups[key] = { key: key, ids: [], advertisers: {}, days: 0, dupes: 0, best: a, kws: {} };
      g.ids.push(id);
      g.advertisers[a.advertiser] = 1;
      g.dupes += a.dupes || 1;
      (a.kws || []).forEach(function (k) { g.kws[k] = 1; });
      if (a.days >= g.days) { g.days = a.days; g.best = a; }
    });
    return Object.keys(groups).map(function (k) {
      var g = groups[k];
      g.advertiser = Object.keys(g.advertisers).join(', ');
      g.score = g.days + 10 * g.dupes;
      g.id = g.best.id;
      return g;
    }).sort(function (a, b) { return b.score - a.score; });
  }
  function topWinners(country, n, strongOnly, includeExcluded) {
    var cd = db.countries[country] || { excluded: {} };
    return winners(country).filter(function (g) {
      if (!includeExcluded && cd.excluded[g.key]) return false;
      if (strongOnly && !(g.days >= 25 || g.dupes >= 3)) return false;
      return true;
    }).slice(0, n);
  }

  // ---------- import ----------
  function importPayload(p) {
    if (!p || !p.ads) throw new Error('Not collector data');
    var code = (p.country || db.current || '').toUpperCase();
    if (code && code !== db.current) { db.current = code; }
    var cd = C();
    var added = 0;
    p.ads.forEach(function (a) {
      var prev = cd.ads[a.id];
      if (!prev) added++;
      a.kws = (prev && prev.kws) || [];
      if (p.kw && a.kws.indexOf(p.kw) < 0) a.kws.push(p.kw);
      cd.ads[a.id] = a;
    });
    cd.runs.push({ kw: p.kw, total: p.total, loaded: p.loaded, added: added, at: p.at || new Date().toISOString() });
    save();
    renderAll();
    toast('Imported "' + (p.kw || '?') + '" for ' + code + ': ' + p.loaded + ' ads read, ' + added + ' new.');
  }
  function fromB64(b64) {
    b64 = b64.replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4) b64 += '=';
    return JSON.parse(decodeURIComponent(escape(atob(b64))));
  }
  function checkHash() {
    var m = location.hash.match(/^#import=(.+)$/);
    if (!m) return;
    history.replaceState(null, '', location.pathname + location.search);
    try { importPayload(fromB64(m[1])); showStep(1); }
    catch (e) { alert('Import failed: ' + e.message); }
  }
  function toast(t) {
    var log = $('runLog');
    log.insertAdjacentHTML('afterbegin', '<div>✅ ' + esc(t) + '</div>');
  }

  // ---------- rendering ----------
  function renderCountrySelect() {
    $('country').innerHTML = COUNTRIES.map(function (c) {
      return '<option value="' + c[0] + '">' + esc(c[1]) + ' (' + c[0] + ')</option>';
    }).join('');
    if (!COUNTRIES.some(function (c) { return c[0] === db.current; })) {
      $('country').insertAdjacentHTML('beforeend', '<option value="' + esc(db.current) + '">' + esc(db.current) + '</option>');
    }
    $('country').value = db.current;
  }
  function renderStep1() {
    var cd = C(), info = countryInfo(db.current);
    var lang = cd.language || info[2];
    $('language').value = lang;
    $('keywords').value = cd.keywords || KW[lang] || KW.French;
    renderKwLinks();
    var runs = cd.runs.slice(-8).reverse();
    $('runLog').innerHTML = runs.length ? runs.map(function (r) {
      return '<div>' + esc(new Date(r.at).toLocaleString()) + ' · <b>' + esc(r.kw) + '</b> · ' + r.loaded + ' ads read of ' +
        esc(r.total || '?') + ' · ' + (r.added || 0) + ' new</div>';
    }).join('') : '<div class="muted">No searches imported yet for this country.</div>';
  }
  function renderKwLinks() {
    var cd = C();
    var done = {};
    cd.runs.forEach(function (r) { done[r.kw] = 1; });
    var kws = $('keywords').value.split('\n').map(function (s) { return s.trim(); }).filter(Boolean);
    $('kwLinks').innerHTML = kws.map(function (k) {
      return '<a target="_blank" rel="noopener" class="' + (done[k] ? 'done' : '') + '" href="' + esc(searchUrl(db.current, k)) + '">' +
        (done[k] ? '✓ ' : '') + esc(k) + '</a>';
    }).join('');
  }
  function renderSheet() {
    var cd = C(), info = countryInfo(db.current);
    $('sheetCountry').textContent = info[1];
    var strong = $('onlyStrong').checked, n = parseInt($('topN').value, 10) || 12;
    var all = winners(db.current);
    var rows = all.filter(function (g) { return !strong || g.days >= 25 || g.dupes >= 3; }).slice(0, n);
    var an = (cd.analysis && cd.analysis.byId) || {};
    var loaded = Object.keys(cd.ads).length;
    $('sheetStats').textContent = loaded + ' ads collected across ' + cd.runs.length + ' searches · ' + all.length +
      ' unique copies · showing ' + rows.length + '.';
    if (!rows.length) { $('winnersTable').innerHTML = '<tr><td class="muted">No winners yet. Collect some searches in step 1.</td></tr>'; return; }
    var head = '<tr><th>Use</th><th>#</th><th>Advertiser</th><th>Library ID</th><th>Days</th><th>Dupes</th><th>Score</th><th>Hook type</th><th>Ad copy</th><th>Headline</th><th>CTA</th><th>Landing</th></tr>';
    $('winnersTable').innerHTML = head + rows.map(function (g, i) {
      var a = g.best, x = an[g.id] || {};
      var off = cd.excluded[g.key];
      var landing = a.domain ? (/whatsapp|messenger|m\.me|fb\.me/.test(a.domain) ? 'No landing page – ' + a.domain : a.domain) : '';
      return '<tr class="' + (off ? 'off' : '') + '"><td><input type="checkbox" data-key="' + esc(g.key) + '" ' + (off ? '' : 'checked') + '></td>' +
        '<td>' + (i + 1) + '</td><td>' + esc(g.advertiser) + '</td><td>' +
        g.ids.map(function (id) { return '<a target="_blank" rel="noopener" href="' + libLink(id) + '">' + id + '</a>'; }).join('<br>') +
        '</td><td>' + g.days + '</td><td>' + g.dupes + '</td><td><b>' + g.score + '</b></td><td>' +
        esc(x.hook_type || '') + (x.relevant === false ? '<br><small>(Claude: not relevant)</small>' : '') + '</td>' +
        '<td class="copy">' + esc(a.copy) + '</td><td>' + esc(a.headline) + '</td><td>' + esc(a.cta) + '</td><td>' + esc(landing) + '</td></tr>';
    }).join('');
    var pats = (cd.analysis && cd.analysis.patterns) || [];
    $('patterns').innerHTML = pats.length ? pats.map(function (p) {
      return '<div class="pattern"><b>' + esc(p.name) + '</b><br>' + esc(p.description) +
        (p.example_ids && p.example_ids.length ? '<br><small>Seen in: ' + esc(p.example_ids.join(', ')) + '</small>' : '') + '</div>';
    }).join('') : 'Run "Analyze style with Claude" to name the patterns that repeat across winners.';
  }
  function renderStep3() {
    $('genCountry').textContent = countryInfo(db.current)[1];
    var h = db.products.slice().reverse();
    $('history').innerHTML = h.length ? h.map(function (p, i) {
      return '<div class="hist" data-i="' + (db.products.length - 1 - i) + '">' + esc(new Date(p.at).toLocaleString()) + ' · ' +
        esc(p.country) + ' · <b>' + esc(p.name) + '</b></div>';
    }).join('') : 'Nothing generated yet.';
  }
  function renderAll() { renderCountrySelect(); renderStep1(); renderSheet(); renderStep3(); }

  function showStep(n) {
    [1, 2, 3].forEach(function (i) { $('step' + i).classList.toggle('hidden', i !== n); });
    document.querySelectorAll('.steps button').forEach(function (b) { b.classList.toggle('active', +b.dataset.step === n); });
    if (n === 2) renderSheet();
    if (n === 3) renderStep3();
  }

  // ---------- exports ----------
  function sheetRows() {
    var cd = C(), an = (cd.analysis && cd.analysis.byId) || {};
    var rows = topWinners(db.current, parseInt($('topN').value, 10) || 12, $('onlyStrong').checked, false);
    var out = [['Rank', 'Advertiser', 'Library ID', 'Days running', 'Ads using creative', 'Score', 'Hook type', 'Ad copy (full)', 'Headline', 'CTA', 'Landing page', 'Ad Library link']];
    rows.forEach(function (g, i) {
      out.push([i + 1, g.advertiser, g.ids.join(' '), g.days, g.dupes, g.score, (an[g.id] || {}).hook_type || '',
        g.best.copy, g.best.headline, g.best.cta, g.best.domain, libLink(g.id)]);
    });
    return out;
  }
  function toTsv(rows) {
    return rows.map(function (r) {
      return r.map(function (v) { v = String(v == null ? '' : v); return /[\t\n"]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }).join('\t');
    }).join('\n');
  }
  function toCsv(rows) {
    return rows.map(function (r) {
      return r.map(function (v) { v = String(v == null ? '' : v); return '"' + v.replace(/"/g, '""') + '"'; }).join(',');
    }).join('\n');
  }
  function download(name, text, type) {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: type }));
    a.download = name; a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
  }

  // ---------- Claude ----------
  async function callClaude(system, userText, tools, maxTokens) {
    var key = db.settings.apiKey;
    if (!key) { $('settings').classList.remove('hidden'); throw new Error('Add your Claude API key in Settings first.'); }
    var messages = [{ role: 'user', content: userText }];
    var texts = [];
    for (var turn = 0; turn < 4; turn++) {
      var body = { model: db.settings.model || 'claude-opus-5-5', max_tokens: maxTokens || 8000, system: system, messages: messages };
      if (tools) body.tools = tools;
      var res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': key,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify(body)
      });
      var data = await res.json();
      if (!res.ok) throw new Error((data.error && data.error.message) || ('HTTP ' + res.status));
      (data.content || []).forEach(function (b) { if (b.type === 'text') texts.push(b.text); });
      if (data.stop_reason === 'pause_turn') {
        messages.push({ role: 'assistant', content: data.content });
        continue;
      }
      break;
    }
    return texts.join('\n');
  }
  function extractJson(text) {
    var f = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    var s = f ? f[1] : text;
    var a = s.indexOf('{'), b = s.lastIndexOf('}');
    if (a < 0 || b < 0) throw new Error('Claude did not return JSON');
    return JSON.parse(s.slice(a, b + 1));
  }
  function winnersForPrompt(list) {
    return list.map(function (g) {
      return { library_id: g.id, other_ids: g.ids.filter(function (i) { return i !== g.id; }), advertiser: g.advertiser,
        days_running: g.days, duplicates: g.dupes, score: g.score, copy: g.best.copy.slice(0, 1200),
        headline: g.best.headline, cta: g.best.cta, landing: g.best.domain || 'none (WhatsApp/Messenger or none)' };
    });
  }

  async function analyze() {
    var list = topWinners(db.current, Math.max(12, parseInt($('topN').value, 10) || 12), $('onlyStrong').checked, false);
    if (!list.length) return alert('No winners to analyze yet.');
    var info = countryInfo(db.current), btn = $('btnAnalyze');
    btn.disabled = true; btn.textContent = 'Analyzing…';
    try {
      var system = 'You are a senior direct-response ad strategist for cash-on-delivery e-commerce. You analyze public Meta Ad Library ads and extract the copywriting patterns that winners share. Reply with JSON only.';
      var user = 'Country: ' + info[1] + ' (' + info[0] + '). These are the longest-running / most duplicated active ads collected there (score = days running + 10 × duplicates):\n\n' +
        JSON.stringify(winnersForPrompt(list), null, 1) +
        '\n\nFor each ad give, in a few words each: whether it is relevant direct-response selling of a physical product (false for apps, games, finance, religion, services, clinics), hook type (pain question, bold promise, curiosity, social proof, urgency, story, price shock), structure, tone/length/emoji use, headline pattern, offer mechanics (cash on delivery, free delivery cities, price display, scarcity).\n' +
        'Then name the 2-3 style patterns that repeat across the RELEVANT winners (these are the swipe patterns), each with a one-line description written so a copywriter can reuse it, and the library_ids it was seen in.\n\n' +
        'Return exactly: {"winners":[{"library_id":"","relevant":true,"hook_type":"","structure":"","tone":"","headline_pattern":"","offer_mechanics":""}],"patterns":[{"name":"","description":"","example_ids":[""]}]}';
      var out = extractJson(await callClaude(system, user, null, 6000));
      var byId = {};
      (out.winners || []).forEach(function (w) { byId[String(w.library_id)] = w; });
      C().analysis = { byId: byId, patterns: out.patterns || [], at: new Date().toISOString() };
      save(); renderSheet();
    } catch (e) { alert('Analysis failed: ' + e.message); }
    finally { btn.disabled = false; btn.textContent = '✨ Analyze style with Claude'; }
  }

  async function generate() {
    var p = { name: $('pName').value.trim(), landing: $('pLanding').value.trim(), alibaba: $('pAlibaba').value.trim(), notes: $('pNotes').value.trim() };
    if (!p.name || !p.landing) return alert('Enter at least the product name and your landing page link.');
    var cd = C(), info = countryInfo(db.current), lang = cd.language || info[2];
    var all = topWinners(db.current, 15, false, false);
    var an = (cd.analysis && cd.analysis.byId) || {};
    var list = all.filter(function (g) { return !an[g.id] || an[g.id].relevant !== false; }).slice(0, 10);
    if (!list.length) return alert('Collect winners for this country first (step 1).');
    var btn = $('btnGenerate');
    btn.disabled = true; $('genStatus').textContent = 'Claude is reading your landing page and writing… (30-90 s)';
    $('ads').innerHTML = ''; $('facts').innerHTML = '';
    try {
      var system = [
        'You are a senior direct-response copywriter for cash-on-delivery e-commerce in ' + info[1] + '.',
        'You swipe the STRUCTURE, hook style, rhythm, emoji use and CTA of proven winning ads, never their exact sentences. Never copy another advertiser\'s brand, phone number or claims.',
        'Language: ' + lang + ', simple everyday words, local touches (cities: ' + info[4] + '; currency: ' + info[3] + '; delivery, payment on delivery, how people order on the landing page).',
        'Health/beauty compliance (Meta policy): no cure or guarantee claims, no before/after promises, no disease scare tactics, no "removes/eliminates" claims for medical conditions. Use soft wording (soulage la sensation de…, apporte une sensation de…, confort au quotidien). If the landing page says the product is cosmetic or does not treat disease, respect that.',
        'Facts: use ONLY facts found on the landing page or in the user\'s notes (price, bundles, delivery, payment, ordering method, ingredients, usage). Invent no studies, reviews, customer counts, discounts, stock scarcity or deadlines. If a fact is missing, put a clear placeholder like [PRIX] or [OFFRE].',
        'Headlines are short: under 40 characters.',
        'Use the web_fetch tool to read the landing page (and the Alibaba page if it loads; skip it if it fails). Then reply with JSON only.'
      ].join('\n');
      var user = 'PRODUCT\nName: ' + p.name + '\nLanding page: ' + p.landing + '\nAlibaba: ' + (p.alibaba || 'none') + '\nNotes from me: ' + (p.notes || 'none') +
        '\n\nWINNING ADS in ' + info[1] + ' (ranked by score = days running + 10 × duplicates):\n' + JSON.stringify(winnersForPrompt(list), null, 1) +
        '\n\nSWIPE PATTERNS found so far:\n' + JSON.stringify((cd.analysis && cd.analysis.patterns) || 'none yet: work them out from the winners') +
        '\n\nWrite the 2 BEST ad copies and 2 headlines for my product, each based on a DIFFERENT winning pattern, and say which winner (library_id) and pattern each one swipes. Version A and B should be good to A/B test against each other.\n' +
        'Return exactly: {"product_facts":{"price":"","offers":"","delivery":"","payment":"","order_method":"","usage":"","disclaimer":""},' +
        '"ads":[{"version":"A","source_winner_id":"","pattern":"","copy":"","headline":"","cta_button":"","why":""},{"version":"B",...}],' +
        '"warnings":["compliance or missing-fact notes"]}';
      var tools = [{ type: 'web_fetch_20260318', name: 'web_fetch', max_uses: 3 }];
      var out = extractJson(await callClaude(system, user, tools, 8000));
      var rec = { at: new Date().toISOString(), country: db.current, name: p.name, landing: p.landing, alibaba: p.alibaba, notes: p.notes, result: out };
      db.products.push(rec); save();
      showResult(rec); renderStep3();
      $('genStatus').textContent = 'Done.';
    } catch (e) { $('genStatus').textContent = ''; alert('Generation failed: ' + e.message); }
    finally { btn.disabled = false; }
  }

  function showResult(rec) {
    var r = rec.result || {}, f = r.product_facts || {};
    $('facts').innerHTML = '<div class="facts"><b>What Claude found on your page:</b> ' +
      ['price', 'offers', 'delivery', 'payment', 'order_method', 'usage', 'disclaimer'].filter(function (k) { return f[k]; })
        .map(function (k) { return '<br>• ' + esc(k.replace('_', ' ')) + ': ' + esc(f[k]); }).join('') + '</div>' +
      ((r.warnings || []).length ? '<div class="warn"><b>Check before posting:</b><br>' + r.warnings.map(esc).join('<br>') + '</div>' : '');
    $('ads').innerHTML = (r.ads || []).map(function (a, i) {
      return '<div class="ad"><h4>Version ' + esc(a.version || (i ? 'B' : 'A')) + '</h4>' +
        '<div class="meta">Pattern: ' + esc(a.pattern) + ' · swiped from <a target="_blank" rel="noopener" href="' + libLink(a.source_winner_id) + '">' + esc(a.source_winner_id) + '</a>' +
        (a.cta_button ? ' · Button: ' + esc(a.cta_button) : '') + '</div>' +
        '<div class="row" style="margin:4px 0"><b>Ad copy</b><button class="ghost" data-copy="c' + i + '">Copy</button></div>' +
        '<pre id="c' + i + '">' + esc(a.copy) + '</pre>' +
        '<div class="row" style="margin:4px 0"><b>Headline</b> <small class="muted">' + String(a.headline || '').length + ' chars</small><button class="ghost" data-copy="h' + i + '">Copy</button></div>' +
        '<div class="hl" id="h' + i + '">' + esc(a.headline) + '</div>' +
        (a.why ? '<p class="muted">' + esc(a.why) + '</p>' : '') + '</div>';
    }).join('');
    $('pName').value = rec.name; $('pLanding').value = rec.landing; $('pAlibaba').value = rec.alibaba || ''; $('pNotes').value = rec.notes || '';
  }

  // ---------- bookmarklet ----------
  function buildBookmarklet() {
    var platform = location.origin + location.pathname;
    var code = '(' + collectorMain.toString() + ')(' + JSON.stringify(platform) + ')';
    $('bookmarklet').href = 'javascript:' + encodeURIComponent(code);
    $('bookmarklet').onclick = function (e) { e.preventDefault(); alert('Drag this button to your bookmarks bar, then click it on a Meta Ad Library search page.'); };
  }

  // ---------- events ----------
  function bind() {
    window.name = 'adswipe';
    $('btnSettings').onclick = function () { $('settings').classList.toggle('hidden'); };
    $('apiKey').value = db.settings.apiKey || '';
    $('model').value = db.settings.model || 'claude-opus-5-5';
    $('btnSaveSettings').onclick = function () {
      db.settings.apiKey = $('apiKey').value.trim(); db.settings.model = $('model').value; save();
      $('settings').classList.add('hidden');
    };
    $('btnExport').onclick = function () {
      var copy = JSON.parse(JSON.stringify(db)); delete copy.settings.apiKey;
      download('ad-swipe-backup.json', JSON.stringify(copy), 'application/json');
    };
    $('restoreFile').onchange = function (e) {
      var f = e.target.files[0]; if (!f) return;
      f.text().then(function (t) {
        var d = JSON.parse(t); d.settings = Object.assign({}, d.settings, { apiKey: db.settings.apiKey });
        db = d; save(); renderAll(); alert('Backup restored.');
      }).catch(function (err) { alert('Restore failed: ' + err.message); });
    };
    document.querySelectorAll('.steps button').forEach(function (b) { b.onclick = function () { showStep(+b.dataset.step); }; });
    $('country').onchange = function () { db.current = this.value; C(); save(); renderAll(); };
    $('language').onchange = function () {
      var cd = C(); cd.language = this.value;
      if (!cd.keywords) $('keywords').value = KW[this.value] || '';
      save(); renderKwLinks();
    };
    $('keywords').oninput = function () { C().keywords = this.value; save(); renderKwLinks(); };
    $('btnPaste').onclick = function () {
      try { importPayload(JSON.parse($('pasteBox').value)); $('pasteBox').value = ''; }
      catch (e) { alert('Could not read that data: ' + e.message); }
    };
    $('btnToSheet').onclick = function () { showStep(2); };
    $('btnClearCountry').onclick = function () {
      if (confirm('Delete all collected ads and analysis for ' + countryInfo(db.current)[1] + '?')) {
        delete db.countries[db.current]; C(); save(); renderAll();
      }
    };
    $('onlyStrong').onchange = renderSheet;
    $('topN').onchange = renderSheet;
    $('winnersTable').onchange = function (e) {
      var k = e.target.dataset && e.target.dataset.key; if (!k) return;
      var cd = C(); if (e.target.checked) delete cd.excluded[k]; else cd.excluded[k] = true;
      save(); renderSheet();
    };
    $('btnAnalyze').onclick = analyze;
    $('btnCopyTsv').onclick = function () {
      var rows = sheetRows(), pats = (C().analysis && C().analysis.patterns) || [];
      if (pats.length) { rows.push([]); rows.push(['Swipe patterns']); pats.forEach(function (p) { rows.push([p.name, p.description]); }); }
      navigator.clipboard.writeText(toTsv(rows)).then(function () { alert('Copied. Open a Google Sheet, click A1 and paste (Ctrl/Cmd+V).'); });
    };
    $('btnCsv').onclick = function () { download('winners_' + db.current + '.csv', '﻿' + toCsv(sheetRows()), 'text/csv'); };
    $('btnGenerate').onclick = generate;
    $('ads').onclick = function (e) {
      var id = e.target.dataset && e.target.dataset.copy; if (!id) return;
      navigator.clipboard.writeText($(id).innerText).then(function () { e.target.textContent = 'Copied ✓'; setTimeout(function () { e.target.textContent = 'Copy'; }, 1500); });
    };
    $('history').onclick = function (e) {
      var el = e.target.closest('.hist'); if (!el) return;
      showResult(db.products[+el.dataset.i]);
    };
    window.addEventListener('hashchange', checkHash);
  }

  bind();
  buildBookmarklet();
  renderAll();
  checkHash();
})();
