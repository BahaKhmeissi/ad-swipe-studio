/*
 * Swipe Collector — runs inside the Meta Ad Library page as a bookmarklet.
 * The platform turns this whole function into a "javascript:" link, so it must
 * stay self-contained (no outside variables).
 *
 * collectorMain(platformUrl)            -> runs on facebook.com/ads/library
 * collectorMain(null, text, todayISO)   -> test mode: returns parsed ads for a text
 */
function collectorMain(PLATFORM, TEST_TEXT, TEST_TODAY) {
  var CTA = /^(shop now|order now|buy now|learn more|send whatsapp message|send message|whatsapp|sign up|book now|get offer|contact us|download|install now|apply now|subscribe|get quote|call now|see menu|watch more|get directions|listen now|play game|use app|donate now|request time|see more|commander|acheter|en savoir plus|envoyer un message|envoyer un message whatsapp|réserver|s'inscrire|obtenir l'offre)$/i;
  var DOMAIN = /^(?:[A-Z0-9-]+\.)+[A-Z]{2,}(?:\/\S*)?$|^(WHATSAPP|MESSENGER|FB\.ME|M\.ME|FB\.COM)$/;
  var TIMER = /^\d+:\d+\s*\/\s*\d+:\d+$/;
  var JUNK = /^(active|inactive|close|​|​|open dropdown|see ad details|see summary details|platforms|eu transparency|this ad has multiple versions)$/i;

  function parse(text, todayISO) {
    var today = todayISO ? new Date(todayISO) : new Date();
    var blocks = text.split(/Library ID:\s*/).slice(1);
    var ads = [];
    blocks.forEach(function (b) {
      var idm = b.match(/^(\d{6,})/);
      if (!idm) return;
      var id = idm[1];
      var sm = b.match(/Started running on\s+([A-Za-z]{3,9}\.? \d{1,2}, \d{4})/);
      var start = sm ? sm[1] : '';
      var days = 0;
      if (start) {
        var d = new Date(start.replace('.', ''));
        if (!isNaN(d)) days = Math.max(0, Math.round((today - d) / 864e5));
      }
      var dm = b.match(/(\d+) ads use this creative and text/);
      var dupes = dm ? parseInt(dm[1], 10) : 1;
      var lines = b.split('\n').map(function (l) { return l.replace(/​/g, '').trim(); });
      var si = -1;
      for (var i = 0; i < lines.length; i++) { if (/^Sponsored\b/.test(lines[i])) { si = i; break; } }
      if (si < 1) return;
      var advertiser = '';
      for (var j = si - 1; j >= 0; j--) { if (lines[j] && !JUNK.test(lines[j])) { advertiser = lines[j]; break; } }
      var rest = lines.slice(si + 1).filter(function (l) { return l && !JUNK.test(l) && !TIMER.test(l); });
      var ctaIdx = -1;
      for (var k = rest.length - 1; k >= 0; k--) { if (CTA.test(rest[k])) { ctaIdx = k; break; } }
      var cta = ctaIdx >= 0 ? rest[ctaIdx] : '';
      var content = ctaIdx >= 0 ? rest.slice(0, ctaIdx) : rest;
      var domIdx = -1;
      for (var m = 0; m < content.length; m++) { if (DOMAIN.test(content[m])) { domIdx = m; break; } }
      var copy, headline = '', desc = '', domain = '';
      if (domIdx >= 0) {
        domain = content[domIdx].toLowerCase();
        copy = content.slice(0, domIdx);
        headline = content[domIdx + 1] || '';
        desc = content.slice(domIdx + 2).join(' ');
      } else if (content.length > 1 && content[content.length - 1].length < 90) {
        copy = content.slice(0, -1);
        headline = content[content.length - 1];
      } else {
        copy = content;
      }
      ads.push({
        id: id, start: start, days: days, dupes: dupes, advertiser: advertiser,
        copy: copy.join('\n').slice(0, 3000), headline: headline.slice(0, 200),
        desc: desc.slice(0, 300), cta: cta, domain: domain
      });
    });
    return ads;
  }

  if (TEST_TEXT !== undefined) return parse(TEST_TEXT, TEST_TODAY);

  if (!/facebook\.com\/ads\/library/.test(location.href)) {
    alert('Swipe Collector: open a Meta Ad Library search page first (set Facebook language to English).');
    return;
  }
  var old = document.getElementById('__swipe_panel');
  if (old) old.remove();
  var panel = document.createElement('div');
  panel.id = '__swipe_panel';
  panel.style.cssText = 'position:fixed;top:16px;right:16px;z-index:2147483647;width:340px;background:#111827;color:#f9fafb;font:13px/1.4 Arial,sans-serif;padding:14px;border-radius:10px;box-shadow:0 10px 30px rgba(0,0,0,.4)';
  panel.innerHTML = '<b>Swipe Collector</b><div id="__swipe_msg" style="margin-top:6px">Scrolling to load ads…</div>';
  document.body.appendChild(panel);
  var msg = panel.querySelector('#__swipe_msg');

  var rounds = 8, n = 0;
  (function step() {
    window.scrollTo(0, document.body.scrollHeight);
    n++;
    msg.textContent = 'Scrolling to load ads… ' + n + '/' + rounds;
    if (n < rounds) { setTimeout(step, 1200); return; }
    setTimeout(finish, 800);
  })();

  function finish() {
    var text = document.body.innerText;
    var q = new URLSearchParams(location.search);
    var tot = (text.match(/~?[\d,.]+\s+results?/i) || [''])[0];
    var ads = parse(text);
    var payload = {
      v: 1, country: q.get('country') || '', kw: q.get('q') || '', total: tot,
      loaded: ads.length, at: new Date().toISOString(), ads: ads
    };
    var json = JSON.stringify(payload);
    var b64 = btoa(unescape(encodeURIComponent(json))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    var top = ads.slice().sort(function (a, b) { return (b.days + 10 * b.dupes) - (a.days + 10 * a.dupes); }).slice(0, 5);
    var esc = function (s) { return String(s).replace(/[&<>]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]; }); };
    msg.innerHTML = '<div>Keyword <b>' + esc(payload.kw) + '</b> · ' + esc(payload.country) + '<br>' +
      ads.length + ' ads read (' + esc(tot || 'total unknown') + ')</div>' +
      '<div style="margin:8px 0;color:#9ca3af">Top by score:<br>' +
      top.map(function (a) { return esc(a.days + 'd ×' + a.dupes + ' · ' + a.advertiser).slice(0, 60); }).join('<br>') + '</div>' +
      '<button id="__swipe_send" style="background:#22c55e;color:#04210f;border:0;padding:8px 10px;border-radius:6px;font-weight:bold;cursor:pointer">Send to platform</button> ' +
      '<button id="__swipe_copy" style="background:#374151;color:#fff;border:0;padding:8px 10px;border-radius:6px;cursor:pointer">Copy data</button> ' +
      '<button id="__swipe_x" style="background:none;color:#9ca3af;border:0;cursor:pointer">close</button>';
    panel.querySelector('#__swipe_send').onclick = function () {
      window.open(PLATFORM + '#import=' + b64, 'adswipe');
      msg.insertAdjacentHTML('beforeend', '<div style="margin-top:6px;color:#86efac">Sent. Switch to the platform tab.</div>');
    };
    panel.querySelector('#__swipe_copy').onclick = function () {
      navigator.clipboard.writeText(json).then(function () {
        msg.insertAdjacentHTML('beforeend', '<div style="margin-top:6px;color:#86efac">Copied. Paste it in the platform (Import box).</div>');
      });
    };
    panel.querySelector('#__swipe_x').onclick = function () { panel.remove(); };
  }
}
if (typeof module !== 'undefined') module.exports = { collectorMain: collectorMain };
