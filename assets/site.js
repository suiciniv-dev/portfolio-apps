(function () {
'use strict';

var EN = /^en/i.test(document.documentElement.lang);
function T(pt, en) { return EN ? en : pt; }
function $(s, r) { return (r || document).querySelector(s); }
function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
var lento = matchMedia('(prefers-reduced-motion: reduce)').matches;
var params = new URLSearchParams(location.search);
var EMAIL = 'vinips00@gmail.com';
var store = {
  get: function (k, d) { try { var v = localStorage.getItem('sv.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set: function (k, v) { try { localStorage.setItem('sv.' + k, JSON.stringify(v)); } catch (e) {} }
};
function pad(n, w) { n = String(n); while (n.length < (w || 2)) n = '0' + n; return n; }
function hms(d) { return pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds()); }
function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
function rnd(a, b) { return a + Math.random() * (b - a); }

function canoas() {
  var f = params.get('hora');
  if (f != null && !isNaN(+f)) return { h: +f, m: 0 };
  try {
    var p = new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date());
    var o = {};
    p.forEach(function (x) { o[x.type] = x.value; });
    return { h: +o.hour % 24, m: +o.minute };
  } catch (e) {
    var d = new Date();
    return { h: d.getHours(), m: d.getMinutes() };
  }
}

var clima = store.get('clima', null);
(function () {
  if (clima && clima.max != null && Date.now() - clima.t < 30 * 60e3) return;
  if (!window.fetch) return;
  fetch('https://api.open-meteo.com/v1/forecast?latitude=-29.92&longitude=-51.18&current=temperature_2m,weather_code&daily=temperature_2m_max,temperature_2m_min&forecast_days=1&timezone=America%2FSao_Paulo')
    .then(function (r) { return r.json(); })
    .then(function (j) {
      if (!j || !j.current) return;
      clima = { t: Date.now(), temp: Math.round(j.current.temperature_2m), code: j.current.weather_code };
      if (j.daily && j.daily.temperature_2m_max) { clima.max = Math.round(j.daily.temperature_2m_max[0]); clima.min = Math.round(j.daily.temperature_2m_min[0]); }
      store.set('clima', clima);
    })
    .catch(function () {});
})();
function chove() { var c = clima && clima.code; return c != null && ((c >= 51 && c <= 67) || (c >= 80 && c <= 82) || c >= 95); }
function nublado() { var c = clima && clima.code; return c != null && (c === 2 || c === 3 || c === 45 || c === 48); }
function climaTxt() {
  if (!clima) return T('sem dados agora', 'no data right now');
  var c = clima.code, d;
  if (c === 0) d = T('céu limpo', 'clear sky');
  else if (c <= 3) d = T('algumas nuvens', 'some clouds');
  else if (c === 45 || c === 48) d = T('neblina', 'fog');
  else if (chove()) d = T('chuva', 'rain');
  else d = T('tempo fechado', 'overcast');
  return clima.temp + '°C, ' + d;
}

var Som = (function () {
  var ctx = null, mestre = null, silencio = null;
  var iOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  function ac() {
    if (!ctx) {
      var A = window.AudioContext || window.webkitAudioContext; if (!A) return null;
      ctx = new A();
      mestre = ctx.createGain(); mestre.gain.value = 1; mestre.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }
  function destrava() {
    if (silencio || !iOS) return;
    try {
      var n = 4410, buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf);
      function s(o, t) { for (var i = 0; i < t.length; i++) v.setUint8(o + i, t.charCodeAt(i)); }
      s(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); s(8, 'WAVE'); s(12, 'fmt ');
      v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
      v.setUint32(24, 44100, true); v.setUint32(28, 88200, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
      s(36, 'data'); v.setUint32(40, n * 2, true);
      silencio = new Audio(URL.createObjectURL(new Blob([buf], { type: 'audio/wav' })));
      silencio.loop = true; silencio.setAttribute('playsinline', '');
      var p = silencio.play(); if (p && p.catch) p.catch(function () {});
    } catch (e) {}
  }
  document.addEventListener('pointerdown', function () { destrava(); ac(); }, { once: true, capture: true });

  function nota(f, t, dur, tipo, vol, dest, ataque, f2) {
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.type = tipo || 'square';
    o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + (ataque || 0.01));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest || mestre);
    o.start(t); o.stop(t + dur + 0.05);
  }
  var ruidoBuf = null;
  function ruido(t, dur, vol, tipo, freq, dest) {
    if (!ruidoBuf) {
      ruidoBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      var d = ruidoBuf.getChannelData(0);
      for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    var s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = ruidoBuf; f.type = tipo || 'highpass'; f.frequency.value = freq || 800;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(dest || mestre);
    s.start(t, Math.random() * .5); s.stop(t + dur + 0.05);
  }
  function tom(f, t0, dur, tipo, vol, f2) { nota(f, ctx.currentTime + t0, dur, tipo, Math.min(.2, (vol || .04) * 1.9), null, .01, f2); }
  function chiado(t0, dur, vol, hp) { ruido(ctx.currentTime + t0, dur, Math.min(.25, (vol || .04) * 1.9), 'highpass', hp); }
  var S = {
    bip: function () { tom(2300, 0, .08, 'square', .035); tom(2300, .13, .1, 'square', .035); },
    conq: function () { tom(660, 0, .09, 'square', .035); tom(880, .09, .09, 'square', .035); tom(1320, .18, .24, 'square', .035); },
    toc: function () { chiado(0, .07, .07, 300); tom(150, 0, .07, 'triangle', .06); },
    quebra: function () { chiado(0, .28, .09, 200); tom(110, 0, .22, 'triangle', .08, 45); },
    glub: function () { tom(320, 0, .11, 'sine', .08, 180); tom(340, .15, .11, 'sine', .08, 170); tom(300, .3, .14, 'sine', .08, 150); },
    vrum: function () { tom(48, 0, .5, 'sawtooth', .04, 120); tom(110, .45, .55, 'sawtooth', .035, 70); chiado(0, .9, .02, 120); },
    clic: function () { tom(1500, 0, .025, 'square', .03); },
    pss: function () { chiado(0, .35, .05, 3200); },
    blip: function () { tom(900, 0, .04, 'square', .025); },
    tecla: function () { tom(rnd(500, 800), 0, .02, 'square', .015); },
    nota: function () { [523, 659, 784, 1046].forEach(function (f, i) { tom(f, i * .13, .12, 'triangle', .05); }); },
    erro: function () { tom(220, 0, .14, 'square', .035); tom(160, .15, .2, 'square', .035); },
    moeda: function () { tom(988, 0, .08, 'square', .04); tom(1319, .08, .32, 'square', .04); },
    oi: function () { tom(600, 0, .07, 'square', .03, 900); tom(900, .09, .08, 'square', .03, 700); },
    liga: function () { tom(180, 0, .3, 'square', .035, 720); tom(880, .3, .12, 'triangle', .04); tom(1320, .42, .2, 'triangle', .035); },
    miau: function () { tom(620, 0, .12, 'triangle', .06, 900); tom(900, .12, .3, 'triangle', .06, 520); },
    purr: function () { for (var i = 0; i < 14; i++) tom(48 + (i % 2) * 6, i * .07, .06, 'sawtooth', .03); },
    au: function () { tom(480, 0, .09, 'square', .045, 300); tom(500, .18, .1, 'square', .045, 290); },
    f1: function () { tom(160, 0, .5, 'sawtooth', .035, 1100); tom(900, .5, .25, 'sawtooth', .03, 600); tom(700, .75, .35, 'sawtooth', .03, 1300); },
    cheat: function () { [523, 659, 784, 1046, 1319].forEach(function (f, i) { tom(f, i * .07, .1, 'square', .03); }); tom(1568, .4, .4, 'triangle', .05); }
  };

  var BPM = 76, S16 = 60 / BPM / 4;
  var ACORDES = [
    [110.00, [220.00, 261.63, 329.63, 392.00]],
    [87.31, [174.61, 220.00, 261.63, 329.63]],
    [130.81, [196.00, 261.63, 329.63, 493.88]],
    [98.00, [196.00, 246.94, 293.66, 369.99]]
  ];
  var MELODIA = [
    { 0: 659.25, 3: 587.33, 6: 523.25, 10: 440, 14: 523.25 },
    { 0: 440, 3: 523.25, 6: 659.25, 10: 587.33, 13: 523.25 },
    { 0: 392, 3: 523.25, 6: 659.25, 8: 783.99, 12: 659.25 },
    { 0: 587.33, 3: 493.88, 6: 587.33, 10: 392, 14: 440 }
  ];
  var tocando = false, timer = null, prox = 0, passo = 0, bus = null, volta = 0, inicio = 0;
  function agenda() {
    while (prox < ctx.currentTime + 0.15) {
      var p = passo, t = prox, bar = p >> 4, s = p % 16, ch = ACORDES[bar], alt = volta % 2;
      if (s === 0) ch[1].forEach(function (f) { nota(f, t, S16 * 16, 'triangle', .016, bus, .35); });
      if (s === 0 || s === 8) nota(ch[0], t, S16 * 6, 'triangle', .11, bus, .02);
      if (s === 14) nota(ch[0] * 1.5, t, S16 * 2, 'triangle', .07, bus, .02);
      if (s % 2 === 0) nota(ch[1][[0, 1, 2, 3, 2, 1, 2, 3][s / 2]] * 2, t, S16 * 1.4, 'square', .012, bus, .005);
      if (alt && MELODIA[bar][s]) nota(MELODIA[bar][s], t, S16 * 3.5, 'triangle', .05, bus, .01);
      if (s === 0 || s === 10) nota(140, t, .16, 'sine', .3, bus, .003, 42);
      if (s === 4 || s === 12) ruido(t, .13, .07, 'bandpass', 1800, bus);
      if (s % 2 === 0) ruido(t, .03, s % 4 ? .018 : .03, 'highpass', 7000, bus);
      if (Math.random() < .04) ruido(t, .01, .02, 'highpass', 3000, bus);
      prox += S16 * (p % 2 === 0 ? 1.12 : 0.88);
      passo = (passo + 1) % 64;
      if (passo === 0) volta++;
    }
  }
  function liga() {
    if (!ac()) return false;
    destrava();
    var f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 3200;
    bus = ctx.createGain(); bus.gain.setValueAtTime(0.0001, ctx.currentTime); bus.gain.exponentialRampToValueAtTime(.7, ctx.currentTime + 1.2);
    bus.connect(f); f.connect(mestre);
    prox = ctx.currentTime + .05; inicio = prox; passo = 0; volta = 0;
    timer = setInterval(agenda, 25); agenda();
    tocando = true;
    return true;
  }
  function desliga() {
    if (!tocando) return;
    tocando = false;
    clearInterval(timer);
    var b = bus;
    b.gain.cancelScheduledValues(ctx.currentTime);
    b.gain.setValueAtTime(b.gain.value, ctx.currentTime);
    b.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + .5);
    setTimeout(function () { try { b.disconnect(); } catch (e) {} }, 700);
  }
  return {
    play: function (k) { try { if (ac() && S[k]) S[k](); } catch (e) {} },
    musica: function () { if (tocando) desliga(); else liga(); return tocando; },
    tocando: function () { return tocando; },
    batida: function () { return tocando && ctx ? Math.max(0, Math.floor((ctx.currentTime - inicio) / (60 / BPM))) % 2 : 0; }
  };
})();

function toast(ico, small, title, ms) {
  var box = $('#toasts'); if (!box) return;
  var el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = '<i>' + ico + '</i><small>' + esc(small) + '</small><b>' + esc(title) + '</b>';
  box.appendChild(el);
  while (box.children.length > 3) box.removeChild(box.firstChild);
  setTimeout(function () { el.classList.add('sai'); setTimeout(function () { el.remove(); }, 320); }, ms || 3400);
}

var SEG = [
  ['ligar', T('Setup ligado', 'Powered on'), T('Ligou o setup na entrada.', 'Powered on the setup at the door.'), T('Ligue o setup na entrada.', 'Power on the setup at the door.')],
  ['virar', T('Oi, sou eu', 'Hi, it\'s me'), T('Fez o Vini se virar.', 'Made Vini turn around.'), T('Clique em quem está na cadeira.', 'Click whoever is in the chair.')],
  ['racco', T('Amigo do Racco', 'Racco\'s friend'), T('Puxou papo com o Racco.', 'Chatted with Racco.'), T('Tem um guaxinim andando pela mesa.', 'There\'s a raccoon walking on the desk.')],
  ['chapeu', T('Mago', 'Wizard'), T('Botou o chapéu de mago no Vini.', 'Put the wizard hat on Vini.'), T('Olhe a estante.', 'Look at the shelf.')],
  ['bloco', T('Primeiro bloco', 'First block'), T('Quebrou o bloco de grama.', 'Broke the grass block.'), T('Algo na estante parece quebrável.', 'Something on the shelf looks breakable.')],
  ['pocao', T('Vida cheia', 'Full health'), T('Bebeu a poção vermelha.', 'Drank the red potion.'), T('Vermelho, na estante.', 'Red, on the shelf.')],
  ['fone', T('No fone', 'On the headphones'), T('Descobriu o que toca no fone.', 'Found out what\'s playing.'), T('Na ponta direita da mesa.', 'At the right end of the desk.')],
  ['lata', T('Combustível', 'Fuel'), T('Abriu o energético.', 'Opened the energy drink.'), T('Do lado do monitor do HUD.', 'Next to the HUD monitor.')],
  ['carro', 'C180', T('Acordou a C180.', 'Woke up the C180.'), T('Na parede, ou em miniatura.', 'On the wall, or in miniature.')],
  ['lampada', T('Luz', 'Lights'), T('Mexeu na luminária.', 'Played with the lamp.'), T('Está escuro aí?', 'Is it dark in there?')],
  ['rgb', '+10 FPS', T('Trocou o RGB do PC.', 'Changed the PC\'s RGB.'), T('O PC tem luzes.', 'The PC has lights.')],
  ['reverso', 'suiciniv', T('Leu o nome ao contrário.', 'Read the name backwards.'), T('Passe o mouse no nome lá em cima.', 'Hover the name at the top.')],
  ['hesoyam', 'HESOYAM', T('Digitou o código de San Andreas.', 'Typed the San Andreas code.'), T('Um código famoso de San Andreas. É só digitar.', 'A famous San Andreas code. Just type it.')],
  ['konami', '↑↑↓↓←→←→BA', T('Chamou todos os Raccos.', 'Called every Racco.'), T('↑ ↑ ↓ ↓ …', '↑ ↑ ↓ ↓ …')],
  ['sudo', T('Sem permissão', 'Permission denied'), T('Tentou sudo no Senna.', 'Tried sudo on Senna.'), T('O Senna tem um terminal lá embaixo.', 'Senna has a terminal down below.')],
  ['mimi', 'Mimi', T('Fez carinho na Mimi.', 'Petted Mimi.'), T('Tem uma gata andando pela mesa.', 'A cat is walking on the desk.')],
  ['lucifer', T('Lúcifer', 'Lucifer'), T('Achou o Lúcifer.', 'Found Lucifer.'), T('Olhe a janela: dois olhos amarelos.', 'Check the window: two yellow eyes.')],
  ['fred', 'Fred', T('Brincou com o Fred.', 'Played with Fred.'), T('Tem alguém debaixo da mesa.', 'Someone is under the desk.')],
  ['box', 'Box, box!', T('Ligou o motor da McLaren.', 'Fired up the McLaren.'), T('Na prateleira de cima tem um carro de corrida.', 'There is a race car on the top shelf.')],
  ['postit', 'Post-it', T('Leu um post-it da parede.', 'Read a sticky note on the wall.'), T('Tem recados na parede.', 'There are notes on the wall.')]
];
var achados = store.get('segredos', {});
function nAchados() { return SEG.filter(function (s) { return achados[s[0]]; }).length; }
function atualizaConta() {
  var t = nAchados() + '/' + SEG.length;
  var a = $('#contaSegredos'); if (a) a.textContent = t;
  var b = $('#conqConta'); if (b) b.textContent = t;
}
function conquista(id) {
  if (achados[id]) return false;
  var s = SEG.filter(function (x) { return x[0] === id; })[0];
  if (!s) return false;
  achados[id] = Date.now();
  store.set('segredos', achados);
  atualizaConta();
  setTimeout(function () {
    Som.play('conq');
    toast('★', T('Segredo ', 'Secret ') + nAchados() + '/' + SEG.length, s[1]);
    var p = $('#btnSegredos');
    if (p) { p.classList.remove('pulse'); void p.offsetWidth; p.classList.add('pulse'); }
    if (nAchados() === SEG.length) setTimeout(function () { toast('♛', T('Zerou', '100%'), T('Achou todos os segredos. Respeito.', 'You found every secret. Respect.'), 5000); Som.play('moeda'); }, 900);
  }, 250);
  return true;
}
function desenhaConquistas() {
  var ul = $('#conqList'); if (!ul) return;
  ul.innerHTML = SEG.map(function (s) {
    var ok = !!achados[s[0]];
    return '<li class="' + (ok ? 'ok' : '') + '"><i>' + (ok ? '★' : '?') + '</i><b>' + esc(ok ? s[1] : '???') + '</b><p>' + esc(ok ? s[2] : s[3]) + '</p></li>';
  }).join('');
}
(function () {
  var dlg = $('#conquistas'), btn = $('#btnSegredos');
  atualizaConta();
  if (!dlg || !btn) return;
  function abre() {
    desenhaConquistas();
    if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', '');
  }
  btn.addEventListener('click', abre);
  $('#conqFechar').addEventListener('click', function () { dlg.close ? dlg.close() : dlg.removeAttribute('open'); });
  dlg.addEventListener('click', function (e) { if (e.target === dlg) dlg.close(); });
  $('#conqReset').addEventListener('click', function () {
    achados = {}; store.set('segredos', achados); atualizaConta(); desenhaConquistas();
  });
  window.__abreSegredos = abre;
})();

(function () {
  var b = $('#btnSom'); if (!b) return;
  function pinta() {
    var on = Som.tocando();
    b.setAttribute('aria-pressed', on ? 'true' : 'false');
    b.classList.toggle('tocando', on);
    var r = on ? T('Desligar a música', 'Turn the music off') : T('Tocar uma música lo-fi', 'Play some lo-fi music');
    b.setAttribute('aria-label', r); b.title = r;
  }
  pinta();
  b.addEventListener('click', function () { Som.musica(); pinta(); });
})();

function copiar(btn) {
  var original = btn.getAttribute('data-original') || btn.textContent.trim();
  btn.setAttribute('data-original', original);
  function pronto() { btn.textContent = T('e-mail copiado ✓', 'email copied ✓'); Som.play('blip'); volta(2200); }
  function falhou() { btn.textContent = EMAIL; volta(4000); }
  function volta(ms) { clearTimeout(btn._t); btn._t = setTimeout(function () { btn.textContent = original; }, ms); }
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(EMAIL).then(pronto, falhou);
  else falhou();
}
document.addEventListener('click', function (e) {
  var b = e.target.closest('[data-copiar]');
  if (b) copiar(b);
});

var F3 = {
  '0': [7, 5, 5, 5, 7], '1': [2, 6, 2, 2, 7], '2': [7, 1, 7, 4, 7], '3': [7, 1, 3, 1, 7], '4': [5, 5, 7, 1, 1],
  '5': [7, 4, 7, 1, 7], '6': [7, 4, 7, 5, 7], '7': [7, 1, 1, 2, 2], '8': [7, 5, 7, 5, 7], '9': [7, 5, 7, 1, 7],
  ':': [0, 2, 0, 2, 0], '/': [1, 1, 2, 4, 4], '%': [5, 1, 2, 4, 5], '°': [2, 5, 2, 0, 0], '.': [0, 0, 0, 0, 2],
  '-': [0, 0, 7, 0, 0], '+': [0, 2, 7, 2, 0], '!': [2, 2, 2, 0, 2], '?': [6, 1, 2, 0, 2], ' ': [0, 0, 0, 0, 0],
  A: [2, 5, 7, 5, 5], B: [6, 5, 6, 5, 6], C: [3, 4, 4, 4, 3], D: [6, 5, 5, 5, 6], E: [7, 4, 6, 4, 7], F: [7, 4, 6, 4, 4],
  G: [3, 4, 5, 5, 3], H: [5, 5, 7, 5, 5], I: [7, 2, 2, 2, 7], J: [1, 1, 1, 5, 2], K: [5, 5, 6, 5, 5], L: [4, 4, 4, 4, 7],
  M: [5, 7, 7, 5, 5], N: [6, 5, 5, 5, 5], O: [2, 5, 5, 5, 2], P: [6, 5, 6, 4, 4], Q: [2, 5, 5, 6, 3], R: [6, 5, 6, 5, 5],
  S: [3, 4, 2, 1, 6], T: [7, 2, 2, 2, 2], U: [5, 5, 5, 5, 7], V: [5, 5, 5, 5, 2], W: [5, 5, 7, 7, 5], X: [5, 5, 2, 5, 5],
  Y: [5, 5, 2, 2, 2], Z: [7, 1, 2, 4, 7]
};
function txt(c, s, x, y, cor) {
  c.fillStyle = cor;
  s = String(s).toUpperCase();
  for (var i = 0; i < s.length; i++) {
    var gl = F3[s[i]] || F3[' '];
    for (var r = 0; r < 5; r++) for (var k = 0; k < 3; k++) if (gl[r] & (4 >> k)) c.fillRect(x + k, y + r, 1, 1);
    x += 4;
  }
}
function txtW(s) { return String(s).length * 4 - 1; }
function spr(rows, pal) {
  var h = rows.length, w = rows[0].length, c = document.createElement('canvas');
  c.width = w; c.height = h;
  var x = c.getContext('2d');
  for (var j = 0; j < h; j++) for (var i = 0; i < w; i++) {
    var ch = rows[j][i];
    if (ch !== '.' && pal[ch]) { x.fillStyle = pal[ch]; x.fillRect(i, j, 1, 1); }
  }
  return c;
}

var RACCO = [
  '................',
  '................',
  '................',
  '..BB........BB..',
  '..BBBBBBBBBBBB..',
  '..BBBBBBBBBBBB..',
  '.MMMMMBBBBMMMMM.',
  '.MMMMMBBBBMMMMM.',
  'BBBBBBLNNLBBBBBB',
  'BBBBBBLLLLBBBBBB',
  '..BBBBBBBBBBBB..',
  '..BBBBBBBBBBBB..',
  '...B.B....B.B...',
  '...B.B....B.B...'
];
var ACC = {
  TOP_HAT: [[5, 0, 6, 2, '#3b3446'], [5, 0, 1, 2, '#5a4f6b'], [5, 2, 6, 1, '#f5d66a'], [4, 3, 8, 1, '#3b3446']],
  GLASSES: [[3, 5, 3, 1, '#f5d66a'], [3, 8, 3, 1, '#f5d66a'], [3, 6, 1, 2, '#f5d66a'], [5, 6, 1, 2, '#f5d66a'], [10, 5, 3, 1, '#f5d66a'], [10, 8, 3, 1, '#f5d66a'], [10, 6, 1, 2, '#f5d66a'], [12, 6, 1, 2, '#f5d66a'], [6, 6, 4, 1, '#f5d66a']],
  HEADPHONES: [[3, 2, 10, 1, '#3f3a48'], [2, 3, 1, 2, '#3f3a48'], [13, 3, 1, 2, '#3f3a48'], [1, 5, 2, 3, '#3f3a48'], [13, 5, 2, 3, '#3f3a48'], [1, 6, 1, 1, '#7d7590'], [14, 6, 1, 1, '#7d7590']],
  SPROUT: [[7, 1, 1, 3, '#5e8a4a'], [5, 1, 2, 1, '#8fb573'], [6, 2, 1, 1, '#8fb573'], [8, 0, 2, 1, '#8fb573'], [8, 1, 1, 1, '#8fb573']],
  THUG: [[2, 6, 5, 2, '#050505'], [9, 6, 5, 2, '#050505'], [7, 6, 2, 1, '#050505'], [3, 6, 1, 1, '#5a5a6a'], [10, 6, 1, 1, '#5a5a6a'], [4, 10, 8, 1, '#f5c84a'], [7, 11, 2, 1, '#f5c84a']]
};
function racco(c, x, y, o) {
  o = o || {};
  var body = o.body || '#a39b90', pal = { B: body, L: '#eee7db', M: '#4a413b', N: '#0c0a08' };
  function px(i, j, w, h, cor) {
    c.fillStyle = cor;
    for (var a = 0; a < w; a++) {
      var xx = o.flip ? x + 15 - (i + a) : x + i + a;
      c.fillRect(xx, y + j, 1, h);
    }
  }
  var bob = o.bob ? 1 : 0;
  for (var j = 0; j < 14; j++) for (var i = 0; i < 16; i++) {
    var ch = RACCO[j][i];
    if (ch === '.') continue;
    if (j >= 12) {
      var par = (i === 3 || i === 10);
      if (o.step === 1 && par && j === 13) continue;
      if (o.step === 2 && !par && j === 13) continue;
      px(i, j, 1, 1, pal[ch]);
    } else if (o.wave && j >= 8 && j <= 9 && i >= 14) {
      px(i, j - 3, 1, 1, pal[ch]);
    } else {
      px(i, j + bob, 1, 1, pal[ch]);
    }
  }
  var lk = o.look || 0;
  if (o.sleep) {
    px(4, 7 + bob, 1, 1, '#f3efea'); px(11, 7 + bob, 1, 1, '#f3efea');
  } else if (o.blink) {
    px(4, 7 + bob, 1, 1, '#f3efea'); px(11, 7 + bob, 1, 1, '#f3efea');
  } else {
    px(4 + lk, 6 + bob, 1, 2, '#f3efea'); px(11 + lk, 6 + bob, 1, 2, '#f3efea');
  }
  (o.acc || []).forEach(function (a) { (ACC[a] || []).forEach(function (p) { px(p[0], p[1] + bob, p[2], p[3], p[4]); }); });
}

(function () {
  var b = $('#brandRacco'); if (!b) return;
  racco(b.getContext('2d'), 0, -1, {});
})();

(function () {
  var nome = $('#brandNome'), brand = $('#brand');
  if (!nome || !brand) return;
  var s = 'suiciniv';
  nome.innerHTML = s.split('').map(function (ch) { return '<b>' + ch + '</b>'; }).join('');
  var letras = $$('b', nome), virado = false, timer;
  function vira(on) {
    if (on === virado) return;
    virado = on;
    if (!on) { letras.forEach(function (l) { l.style.transform = ''; }); return; }
    var total = nome.offsetWidth;
    letras.forEach(function (l) {
      var alvo = total - (l.offsetLeft + l.offsetWidth);
      l.style.transform = 'translateX(' + (alvo - l.offsetLeft) + 'px)';
    });
    setTimeout(function () { if (virado) conquista('reverso'); }, 500);
  }
  brand.addEventListener('pointerenter', function (e) { if (e.pointerType === 'mouse') vira(true); });
  brand.addEventListener('pointerleave', function () { vira(false); });
  brand.addEventListener('focus', function () { vira(true); });
  brand.addEventListener('blur', function () { vira(false); });
  brand.addEventListener('touchstart', function () { vira(true); clearTimeout(timer); timer = setTimeout(function () { vira(false); }, 1800); }, { passive: true });
})();

var sessao = {
  get: function (k) { try { return sessionStorage.getItem('sv.' + k); } catch (e) { return null; } },
  set: function (k, v) { try { sessionStorage.setItem('sv.' + k, v); } catch (e) {} }
};

(function intro() {
  var el = $('#intro'); if (!el) return;
  if (params.has('pular') || params.has('skip') || sessao.get('ligou')) return;
  el.hidden = false;
  document.documentElement.style.overflow = 'hidden';
  var btn = $('#power'), boot = $('#boot'), hint = $('#introHint'), ico = $('#powerIco').getContext('2d');
  var POW = [
    '......X......',
    '...X..X..X...',
    '..X...X...X..',
    '.X....X....X.',
    '.X....X....X.',
    'X.....X.....X',
    'X.....X.....X',
    'X...........X',
    '.X.........X.',
    '.X.........X.',
    '..X.......X..',
    '...XX...XX...',
    '.....XXX.....'
  ];
  function pinta(cor) { ico.clearRect(0, 0, 13, 13); ico.drawImage(spr(POW, { X: cor }), 0, 0); }
  pinta('#ee7a5b');
  var feito = false;
  function fecha(ligou) {
    document.removeEventListener('keydown', tecla);
    sessao.set('ligou', '1');
    el.classList.add('saindo');
    setTimeout(function () {
      el.hidden = true;
      document.documentElement.style.overflow = '';
      if (window.__cena) window.__cena.ligar(ligou);
    }, lento ? 10 : 450);
  }
  function liga() {
    if (feito) return;
    feito = true;
    btn.classList.add('on'); pinta('#5cf2a0');
    hint.style.visibility = 'hidden';
    Som.play('liga');
    conquista('ligar');
    var LINHAS = [
      ['> suiciniv.dev bios 2026', ''],
      ['> senna', 'ok'],
      ['> controlsensors', 'ok'],
      ['> banditboard', 'ok'],
      ['> racco', T('acordando', 'waking up')]
    ];
    var passo = lento ? 0 : 170;
    LINHAS.forEach(function (l, i) {
      setTimeout(function () {
        var d = document.createElement('div');
        d.innerHTML = '<span>' + esc(l[0]) + '</span>' + (l[1] ? '<span class="dots"></span><b>' + esc(l[1]) + '</b>' : '');
        boot.appendChild(d);
        Som.play('tecla');
      }, 120 + i * passo);
    });
    setTimeout(function () {
      var b = document.createElement('div');
      b.className = 'boot-bar'; b.innerHTML = '<i></i>';
      boot.appendChild(b);
      requestAnimationFrame(function () { requestAnimationFrame(function () { b.classList.add('cheia'); }); });
    }, 120 + LINHAS.length * passo);
    setTimeout(function () { fecha(true); }, lento ? 400 : 120 + LINHAS.length * passo + 750);
  }
  function tecla(e) {
    if (e.key === 'Escape') { if (!feito) { feito = true; fecha(false); } }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); liga(); }
  }
  btn.addEventListener('click', liga);
  document.addEventListener('keydown', tecla);
  $('#introSkip').addEventListener('click', function () { if (!feito) { feito = true; fecha(false); } });
  setTimeout(function () { try { btn.focus({ preventScroll: true }); } catch (e) {} }, 50);
})();

function gta() {
  var velho = $('.gta'); if (velho) velho.remove();
  var el = document.createElement('div');
  el.className = 'gta';
  el.setAttribute('aria-live', 'polite');
  el.innerHTML = '<div class="gta-box">' + T('Cheat ativado', 'Cheat activated') + '<small>' + T('vida, colete e R$ 250.000', 'health, armor and $250,000') + '</small></div>' +
    '<div class="gta-hud"><div class="gta-bar gta-colete"><b></b></div><div class="gta-bar gta-vida"><b></b></div><div class="gta-din">$00000000</div></div>';
  document.body.appendChild(el);
  var din = el.querySelector('.gta-din'), t0 = performance.now();
  requestAnimationFrame(function () { el.classList.add('cheio'); });
  (function conta(t) {
    var k = Math.min(1, (t - t0) / 1400);
    din.textContent = '$' + pad(Math.round(250000 * k), 8);
    if (k < 1) requestAnimationFrame(conta);
  })(t0);
  setTimeout(function () { el.classList.add('sai'); setTimeout(function () { el.remove(); }, 600); }, 5200);
}

var Cena = (function () {
  var cv = $('#mesaCanvas'); if (!cv) return null;
  var W = 320, H = 180;
  var main = cv.getContext('2d'), g = main;
  var Lc = document.createElement('canvas'); Lc.width = W; Lc.height = H;
  var L = Lc.getContext('2d');
  function R(x, y, w, h, c) { g.fillStyle = c; g.fillRect(x, y, w, h); }
  function P(x, y, c) { g.fillStyle = c; g.fillRect(x, y, 1, 1); }

  var st = {
    f: 0, t: 0, hover: null, flash: null, flashAte: 0,
    virado: false, viradoAte: 0, chapeu: false, lampada: true, rgb: 0,
    bloco: 0, blocoFora: 0, cacos: [], pocao: true, pocaoVolta: 0,
    latas: 0, vapor: 0, notas: [], farol: 0, poster: 0,
    hesoyam: false, parada: 0,
    r: { x: 120, dir: 1, alvo: 120, pausa: 30, look: 0, wave: 0 },
    hud: [42, 51, 63, 38], spark: [], code: [], linha: null, toast: 0, toastX: 40,
    appOk: 0, aviao: -1, novo: 0, postit: null, postitVolta: 0, recado: 0,
    f1: 0, mimi: 0, lucifer: 0, fred: 0, coracoes: [],
    boot: $('#intro') && !$('#intro').hidden ? -1 : null
  };
  var ATRASO = { senna: 150, hud: 420, cel: 650, note: 820, lamp: 1000, pc: 1150, racco: 1500 };
  function liga(k) {
    if (st.boot === null) return true;
    if (st.boot < 0) return false;
    return Date.now() - st.boot > ATRASO[k];
  }
  function acendendo(k) { return st.boot > 0 && Date.now() - st.boot > ATRASO[k] && Date.now() - st.boot < ATRASO[k] + 170; }
  for (var s0 = 0; s0 < 22; s0++) st.spark.push(rnd(30, 60));

  var STARS = [[18, 18], [26, 23], [33, 16], [40, 28], [21, 33], [51, 19], [57, 31], [66, 17], [70, 27], [47, 37], [29, 40], [62, 41], [36, 22], [55, 25]];
  var PREDIOS = [[14, 7, 15], [21, 6, 24], [27, 9, 12], [36, 6, 20], [42, 9, 28], [51, 5, 14], [56, 8, 22], [64, 6, 11], [70, 4, 17]];
  var LUZES = [];
  PREDIOS.forEach(function (p) {
    for (var yy = 73 - p[2] + 2; yy < 72; yy += 3) for (var xx = p[0] + 1; xx < p[0] + p[1] - 1; xx += 2) if (Math.random() < .35) LUZES.push([xx, yy, Math.random()]);
  });
  var GOTAS = [];
  for (var i0 = 0; i0 < 26; i0++) GOTAS.push([rnd(14, 74), rnd(14, 74), rnd(1.5, 3)]);

  var BLOCO = spr([
    'GgGGGgGGgGGG',
    'GGGgGGGGGGgG',
    'gGGGGgGGGGGG',
    'DGgDDGDDgGDD',
    'DDGdDDDDDDGD',
    'DdDDDDdDDDDD',
    'DDDDdDDDDdDD',
    'DDdDDDDdDDDD',
    'DDDDDDDDDDdD',
    'dDDDDdDDDDDD',
    'DDDDDDDDdDDD',
    'DDdDDDDDDDDD'
  ], { G: '#5fae3b', g: '#86d05a', D: '#8b5a2b', d: '#5e3b1b' });
  var POCAO = spr([
    '...CCC...',
    '...ccc...',
    '...GoG...',
    '..GGoGG..',
    '.GrRRRRG.',
    'GRRrRRRRG',
    'GRRRRRRRG',
    'GRrRRRRRG',
    'GRRRRRRRG',
    '.GRRRRRG.',
    '..GGGGG..'
  ], { C: '#a0743f', c: '#7a5530', G: '#b8d4ea', o: '#3a3048', R: '#d8233a', r: '#ff7080' });
  var POCAO_V = spr([
    '...CCC...',
    '...ccc...',
    '...GoG...',
    '..GGoGG..',
    '.GoooooG.',
    'GoooooooG',
    'GoooooooG',
    'GoooooooG',
    'GRRRRRRRG',
    '.GRRRRRG.',
    '..GGGGG..'
  ], { C: '#a0743f', c: '#7a5530', G: '#b8d4ea', o: '#3a3048', R: '#d8233a' });
  var CHAPEU_ROWS = [
    '.........BB...',
    '........BBB...',
    '.......BBBB...',
    '......BBYBB...',
    '......BBBBB...',
    '.....BBBBBB...',
    '.....BBBBBBB..',
    '....BBBYBBBB..',
    '....BBBBBBBBB.',
    '...BBYBBBBMMB.',
    '...BBBBBBBBMB.',
    '..BBBBBBBBBBB.',
    'bbbbbbbbbbbbbb',
    '.bbbbbbbbbbbb.'
  ];
  var CHAPEU = spr(CHAPEU_ROWS, { B: '#2f4aa8', b: '#22377f', Y: '#ffd24a', M: '#ffd24a' });
  var MINI = spr([
    '......KKKKKKK.........',
    '....KKWWWKWWWKK.......',
    '..KKKKKKKKKKKKKKKK....',
    'LKKKKCCCCCCCCKKKKKKKT.',
    'KKKKKKKKKKKKKKKKKKKKK.',
    '.KKOOKKKKKKKKKKOOKKK..',
    '...OO..........OO.....'
  ], { K: '#121216', W: '#55709a', L: '#e8f0ff', T: '#d0283c', O: '#8f95a0', C: '#5a5f6a' });
  var CABECA_COSTAS = spr([
    '....HHHHHHH.....',
    '..HHHHHhHHHHH...',
    '.HHHhHHhHHhHHH..',
    '.HHhHHHhHHHhHHH.',
    'HHHhHHHhHHHhHHHH',
    'HHhHHHHhHHHhHhHH',
    'HHhHHHhHHHHhHhHH',
    'HHHhHHhHHHHhHHHH',
    'HHHhHHHhHHHhHHHH',
    'GHHHhHHhHHHhHHHG',
    'EHHHhHHHhHHhHHHE',
    'EHHHHhHHhHHhHHHE',
    '.HHHHhHHHhHHHHH.',
    '.zHHHHHHHHHHHHz.',
    '..zHHHHHHHHHHz..',
    '...SSHHHHHHSS...',
    '...SSSSSSSSSS...'
  ], { H: '#2b1a12', h: '#4d3123', E: '#e2ab8a', G: '#141216', z: '#5e3d2c', S: '#d9a183' });
  var CABECA_FRENTE = spr([
    '....HHHHHHH.....',
    '..HHHhHHHhHHH...',
    '.HHhHHHhHHHhHH..',
    '.HHHhHHhHHhHHHH.',
    'HHHHHHHHHHHHHHHH',
    'HHSSSSSSSSSSSSHH',
    'HSSSSSSSSSSSSSSH',
    'HSSKKKSSSSKKKSSH',
    '.SGGGGSSSSGGGGS.',
    'EGGWPGGGGGGPWGGE',
    'ESGSSGSssSGSSGSE',
    '.SSGGSSssSSGGSS.',
    '.zSSSSSssSSSSSz.',
    '.ZzSSSNSSNSSSzZ.',
    '.ZZZZZYYYYZZZZZ.',
    '..ZZYZMMMMZYZZ..',
    '...ZZZZYZZZZZ...'
  ], { H: '#2b1a12', h: '#4d3123', S: '#efc3a2', s: '#d49c7c', K: '#2b1a12', G: '#141216', W: '#f5efe8', P: '#2a1a13', E: '#e2ab8a', z: '#b98a70', Z: '#6e4a38', Y: '#8c624c', M: '#c27a6e', N: '#b9806a' });

  function fase(h) {
    if (h >= 8 && h < 17) return 'dia';
    if (h >= 17 && h < 19) return 'tarde';
    if (h >= 6 && h < 8) return 'manha';
    return 'noite';
  }

  function parede(ph) {
    var base = ph === 'dia' ? '#3a3046' : ph === 'noite' ? '#2a2236' : '#332a40';
    R(0, 0, W, 121, base);
    for (var x = 4; x < W; x += 10) R(x, 6, 1, 115, ph === 'dia' ? '#3e344b' : '#2e263a');
    R(0, 0, W, 3, '#1c1626'); R(0, 3, W, 3, '#221b2d');
    R(0, 117, W, 4, '#241c2e');
  }

  function janela(ph, f) {
    var x0 = 14, y0 = 14, w = 60, h = 60;
    R(x0 - 3, y0 - 3, w + 6, h + 6, '#3b2d24');
    R(x0 - 2, y0 - 2, w + 4, h + 4, '#5a4434');
    var bands = {
      noite: ['#0a0f26', '#0e1530', '#131c3e', '#18234a'],
      manha: ['#3a4a86', '#6f74ad', '#d69aa0', '#ffc890'],
      tarde: ['#2b2a5e', '#6b3f73', '#c0586a', '#f08a5d'],
      dia: ['#3f87dc', '#58a0ea', '#73b6f2', '#94cbf7']
    }[ph];
    if (nublado() || chove()) bands = ph === 'noite' ? ['#10131e', '#141824', '#181d2a', '#1c2230'] : ['#59657a', '#6b778b', '#7d899c', '#8f9aac'];
    for (var b = 0; b < 4; b++) R(x0, y0 + b * 15, w, 15, bands[b]);
    for (var bx = 0; bx < w; bx += 2) for (var b2 = 1; b2 < 4; b2++) P(x0 + bx + (b2 % 2), y0 + b2 * 15 - 1, bands[b2]);
    if (ph === 'noite' && !nublado() && !chove()) {
      STARS.forEach(function (s, i) { if ((f + i * 7) % 26 > 2) P(s[0], s[1], (i % 3) ? '#f6f1d0' : '#a9b6e8'); });
      var mx = 61, my = 20;
      R(mx + 1, my, 3, 1, '#f3e9c6'); R(mx, my + 1, 5, 3, '#f3e9c6'); R(mx + 1, my + 4, 3, 1, '#f3e9c6');
      P(mx + 1, my + 2, '#d8cda8'); P(mx + 3, my + 1, '#d8cda8');
    } else if (ph === 'dia' && !chove() && !nublado()) {
      var sx = 58, sy = 20;
      R(sx + 2, sy, 3, 1, '#fff2a8'); R(sx + 1, sy + 1, 5, 1, '#ffe27a'); R(sx, sy + 2, 7, 3, '#ffe27a'); R(sx + 1, sy + 5, 5, 1, '#ffe27a'); R(sx + 2, sy + 6, 3, 1, '#f5c84a');
    } else if (ph === 'tarde' || ph === 'manha') {
      R(36, 55, 9, 2, '#ffb36b'); R(35, 57, 11, 3, '#ff9a5c');
    }
    if (ph !== 'noite' || nublado()) {
      var cx = ((f * .25) % 90) - 20;
      nuvem(x0 + cx, 24, ph); nuvem(x0 + ((cx + 45) % 90) - 20, 36, ph);
    }
    var pc = ph === 'noite' ? '#080a18' : ph === 'dia' ? '#5d6f99' : '#2a2140';
    PREDIOS.forEach(function (p) { R(p[0], 74 - p[2], p[1], p[2], pc); });
    if (ph === 'noite' || ph === 'tarde') LUZES.forEach(function (l) { if (l[2] > .15 || (f >> 3) % 2) P(l[0], l[1], '#ffd27a'); });
    if (st.aviao >= 0) {
      var ax = 74 - st.aviao;
      if (ax > x0) { P(ax, 30, '#3a3a48'); P(ax + 1, 30, '#3a3a48'); if ((f >> 2) % 2) P(ax, 30, '#ff4a4a'); }
    }
    if (chove()) {
      GOTAS.forEach(function (d) {
        d[1] += d[2]; if (d[1] > 73) { d[1] = 14; d[0] = rnd(14, 74); }
        P(Math.floor(d[0]), Math.floor(d[1]), '#9ab8e8');
        if (d[1] < 72) P(Math.floor(d[0]), Math.floor(d[1]) + 1, '#6f8cc0');
      });
    }
    R(x0 + 29, y0, 2, h, '#5a4434'); R(x0, y0 + 29, w, 2, '#5a4434');
    P(x0 + 4, y0 + 4, 'rgba(255,255,255,.25)'); P(x0 + 5, y0 + 3, 'rgba(255,255,255,.25)'); P(x0 + 34, y0 + 34, 'rgba(255,255,255,.18)'); P(x0 + 35, y0 + 33, 'rgba(255,255,255,.18)');
    R(x0 - 5, y0 + h + 3, w + 10, 3, '#6b5240'); R(x0 - 5, y0 + h + 6, w + 10, 1, '#3b2d24');
  }
  function nuvem(x, y, ph) {
    var c = ph === 'noite' ? '#2a3044' : ph === 'dia' ? '#ffffff' : '#f5c8b8';
    x = Math.round(x);
    for (var i = 0; i < 12; i++) {
      var xx = x + i;
      if (xx < 14 || xx > 73) continue;
      var top = (i > 2 && i < 9) ? (i > 4 && i < 7 ? 0 : 1) : 2;
      R(xx, y + top, 1, 4 - top, c);
    }
  }

  function carro(x, y, farol) {
    var K = '#0d0d11', K3 = '#3b3b47', Wn = '#26334a', Wl = '#5f7aa3', C = '#b2b8c2';
    var rows = [
      [[16, 29, K]],
      [[14, 31, K], [17, 22, Wn], [24, 29, Wn]],
      [[12, 33, K], [15, 22, Wn], [24, 30, Wn], [16, 16, Wl], [25, 25, Wl]],
      [[10, 35, K], [13, 22, Wn], [24, 31, Wn]],
      [[4, 40, K], [12, 33, C]],
      [[2, 42, K], [5, 39, K3]],
      [[1, 43, K], [1, 3, '#e8f0ff'], [41, 43, '#d0283c']],
      [[1, 43, K], [2, 42, '#1d1d25']],
      [[1, 43, K]],
      [[2, 42, K]],
      [[3, 41, K]]
    ];
    rows.forEach(function (row, j) { row.forEach(function (s) { R(x + s[0], y + j, s[1] - s[0] + 1, 1, s[2]); }); });
    P(x + 16, y, '#55556a'); P(x + 20, y, '#55556a');
    [6, 31].forEach(function (wx) {
      var T0 = '#050507', Rm = '#9aa0aa', r = '#4d525c';
      R(x + wx + 2, y + 7, 4, 1, T0);
      R(x + wx + 1, y + 8, 6, 1, T0); R(x + wx + 2, y + 8, 4, 1, Rm);
      R(x + wx, y + 9, 8, 2, T0); R(x + wx + 1, y + 9, 6, 2, Rm); R(x + wx + 3, y + 9, 2, 2, r);
      R(x + wx + 1, y + 11, 6, 1, T0); R(x + wx + 2, y + 11, 4, 1, Rm);
      R(x + wx + 2, y + 12, 4, 1, T0);
    });
    if (farol) {
      g.fillStyle = 'rgba(255,240,180,.55)';
      for (var k = 0; k < 10; k++) g.fillRect(x - k - 1, y + 6 - Math.floor(k / 3), 1, 1 + Math.floor(k / 3) * 2);
    }
  }

  function poster(f) {
    var sh = st.poster > 0 ? (f % 2 ? 1 : 0) : 0;
    R(84, 16, 62, 42, '#120e16');
    R(86, 18, 58, 38, '#ece3d3');
    var cs = ['#24183a', '#3a1f4e', '#5a2658', '#7f2f60', '#a83c62', '#cf5560', '#e8705c', '#f2925f'];
    for (var i = 0; i < 8; i++) R(88, 20 + i * 3, 54, 3, cs[i]);
    [[96, 23], [121, 21], [134, 26], [103, 28], [139, 22]].forEach(function (s, k) { if ((f + k * 9) % 30 > 3) P(s[0], s[1], '#f6e7ff'); });
    var sun = [[111, 118, 0], [109, 120, 1], [108, 121, 2], [107, 122, 3], [107, 122, 4], [106, 123, 5], [106, 123, 6], [106, 123, 7], [106, 123, 8], [106, 123, 9]];
    sun.forEach(function (s) { if (s[2] !== 5 && s[2] !== 7 && s[2] !== 9) R(s[0], 34 + s[2], s[1] - s[0] + 1, 1, '#ffd27a'); });
    R(88, 44, 54, 10, '#1b1622'); R(88, 44, 54, 1, '#3a2d48');
    for (var d = 0; d < 54; d += 8) R(88 + ((d + Math.floor(f / 2)) % 54), 49, 4, 1, '#f2925f');
    R(88, 53, 54, 1, '#2a2236');
    carro(93 + sh, 33, st.farol > 0);
  }

  function estante(f) {
    R(150, 52, 106, 3, '#7a4f37'); R(150, 52, 106, 1, '#93623f'); R(150, 55, 106, 1, '#4a2f22');
    R(160, 56, 2, 4, '#3a2a20'); R(244, 56, 2, 4, '#3a2a20');
    var lf = '#5fae3b', ld = '#3f8a2a', sw = (f >> 4) % 2;
    R(246, 46, 8, 6, '#b8643f'); R(245, 45, 10, 2, '#c97a52');
    [[247, 41, 2, 4, lf], [250, 39, 2, 6, ld], [252, 42, 2, 3, lf], [245, 43, 2, 2, lf], [253, 40, 1, 2, lf]].forEach(function (l) { R(l[0], l[1], l[2], l[3], l[4]); });
    [[246, 56, 9], [249, 56, 13], [253, 56, 7]].forEach(function (v, k) {
      for (var yy = 0; yy < v[2]; yy++) {
        var xx = v[0] + (((yy + k * 2 + sw) >> 2) % 2);
        P(xx, v[1] + yy - 2, yy % 3 ? ld : lf);
        if (yy % 3 === 1) P(xx + 1, v[1] + yy - 2, lf);
      }
    });
    [[153, 4, 15, '#7a3b3b', '#a85a5a'], [157, 3, 13, '#3b5a7a', '#5a82a8'], [160, 4, 16, '#c9a227', '#e8c44a'], [164, 3, 12, '#3b7a52', '#5aa877'], [167, 4, 14, '#5a4a8a', '#7d6ab8']].forEach(function (b) {
      R(b[0], 52 - b[2], b[1], b[2], b[3]); R(b[0], 52 - b[2] + 2, b[1], 1, b[4]); R(b[0], 52 - 4, b[1], 1, b[4]);
    });
    R(171, 40, 2, 12, '#8a6a3a');
    if (st.blocoFora <= 0) {
      g.drawImage(BLOCO, 175, 40);
      var trinca = [[], [[178, 43], [179, 44], [180, 44], [181, 45]], [[178, 43], [179, 44], [180, 44], [181, 45], [183, 47], [182, 48], [177, 48], [176, 49], [184, 42]]][Math.min(2, st.bloco)];
      trinca.forEach(function (p) { P(p[0], p[1], '#1c120a'); });
    } else {
      var by = 46 + (Math.floor(f / 4) % 2);
      R(179, by, 4, 4, '#8b5a2b'); R(179, by, 4, 1, '#5fae3b');
    }
    st.cacos.forEach(function (c) { P(Math.round(c[0]), Math.round(c[1]), c[4]); });
    g.drawImage(st.pocao ? POCAO : POCAO_V, 190, 41);
    if (st.pocao && f % 30 < 6) P(194, 50 - Math.floor((f % 30) / 2), '#ffb0b8');
    g.drawImage(MINI, 203, 45);
    if (st.farol > 0) { P(202, 48, '#fff4c0'); P(201, 48, 'rgba(255,240,180,.6)'); }
    if (!st.chapeu) g.drawImage(CHAPEU, 229, 38);
  }

  var POSTITS = [[264, 24, '#ffe066', '#e0b93a'], [277, 27, '#ff9ec7', '#d9709c'], [290, 23, '#8fd3ff', '#5aa8d8'], [266, 41, '#a8f08a', '#72c45a']];
  function cortica(f) {
    var x = 259, y = 19;
    R(x, y, 46, 40, '#5a3d27'); R(x + 1, y + 1, 44, 38, '#7a5536');
    R(x + 2, y + 2, 42, 36, '#b88a5a');
    for (var i = 0; i < 40; i++) P(x + 3 + ((i * 17) % 40), y + 3 + ((i * 11) % 34), i % 2 ? '#a57848' : '#c99c6c');
    POSTITS.forEach(function (p, k) {
      if (st.postit && st.postit.k === k) return;
      if (st.postitVolta > Date.now() && st.postitK === k) return;
      R(p[0], p[1], 10, 10, p[2]); R(p[0], p[1] + 9, 10, 1, p[3]);
      R(p[0] + 2, p[1] + 3, 6, 1, p[3]); R(p[0] + 2, p[1] + 5, 5, 1, p[3]); R(p[0] + 2, p[1] + 7, 3, 1, p[3]);
      P(p[0] + 5, p[1], '#d6283c');
    });
    R(281, 39, 16, 16, '#f4f1ea'); R(283, 41, 12, 9, '#2a3550');
    R(283, 47, 12, 3, '#1b1622'); R(285, 45, 8, 2, '#0d0d11'); R(287, 44, 4, 1, '#0d0d11'); P(286, 47, '#9aa0aa'); P(291, 47, '#9aa0aa');
    P(289, 39, '#3a7bd5');
    if (st.postit) {
      var q = st.postit, c = POSTITS[q.k];
      R(Math.round(q.x), Math.round(q.y), 10, 10, c[2]); R(Math.round(q.x), Math.round(q.y) + 9, 10, 1, c[3]);
      R(Math.round(q.x) + 2, Math.round(q.y) + 4, 6, 1, c[3]);
    }
  }

  function notebook(f) {
    var x = 249, y = 91, on = liga('note');
    R(x, y, 37, 24, '#1f2026'); R(x + 1, y + 1, 35, 22, '#2c2d35'); P(x + 18, y + 1, '#4a4c58');
    var sx = x + 2, sy = y + 2, sw = 33, sh = 20;
    if (!on) { R(sx, sy, sw, sh, '#07070a'); }
    else if (acendendo('note')) { R(sx, sy, sw, sh, '#07070a'); R(sx, sy + 9, sw, 2, '#e8eef8'); }
    else {
      R(sx, sy, sw, sh, '#eef1f5');
      R(sx, sy, sw, 3, '#1565c0'); R(sx, sy, sw, 1, '#1e74d6');
      R(sx + 1, sy + 1, 1, 1, '#ffffff'); R(sx + 3, sy + 1, 4, 1, '#ffffff');
      R(sx + 8, sy, 9, 3, '#2a7de0'); P(sx + 9, sy + 1, '#ffffff'); P(sx + 11, sy + 1, '#ffffff'); P(sx + 13, sy + 1, '#ffffff'); P(sx + 15, sy + 1, '#ffffff');
      P(sx + 24, sy + 1, '#ffffff'); P(sx + 27, sy + 1, '#ffffff'); P(sx + 30, sy + 1, '#ffd54f'); P(sx + 31, sy + 1, '#e53935');
      R(sx, sy + 3, sw, 1, '#e3e7ee');
      [[1, 4, '#fde9e1'], [6, 4, '#e3e7ee'], [11, 5, '#e3e7ee'], [17, 4, '#e3e7ee'], [22, 5, '#e3e7ee']].forEach(function (t) { R(sx + t[0], sy + 3, t[1], 1, t[2]); });
      R(sx, sy + 4, sw, 2, '#ffffff'); R(sx + 1, sy + 4, 6, 1, '#c5ccd8'); R(sx + 8, sy + 4, 5, 1, '#1565c0'); R(sx + 14, sy + 4, 5, 1, '#c5ccd8'); R(sx + 20, sy + 4, 6, 1, '#c5ccd8');
      R(sx + 1, sy + 7, 31, 1, '#ffffff'); R(sx + 2, sy + 7, 6, 1, '#d0d5de'); R(sx + 25, sy + 7, 5, 1, '#1a4fa0');
      var cards = [[1, 9, 10, 11], [12, 9, 11, 7], [24, 9, 8, 6]];
      cards.forEach(function (c, k) {
        R(sx + c[0], sy + c[1], c[2], c[3], '#ffffff');
        R(sx + c[0] + 1, sy + c[1] + 1, Math.max(3, c[2] - 5), 1, '#4a5260');
        for (var r = 0; r < Math.floor((c[3] - 3) / 2); r++) {
          var ry = sy + c[1] + 3 + r * 2;
          var cor = k === 0 && r === 0 && st.novo > 0 ? '#bfe8cc' : '#d4d9e2';
          R(sx + c[0] + 1, ry, c[2] - 2, 1, cor);
          if (k === 0) R(sx + c[0] + c[2] - 4, ry, 2, 1, '#9aa3b2');
        }
      });
    }
    R(x - 3, y + 24, 43, 1, '#4a4c56');
    R(x - 4, y + 25, 45, 5, '#3a3c44');
    for (var kx = 0; kx < 17; kx++) { P(x - 1 + kx * 2, y + 26, '#4c4e58'); P(x + kx * 2, y + 27, '#4c4e58'); }
    R(x + 13, y + 28, 10, 1, '#4c4e58');
    R(x - 3, y + 30, 43, 1, '#24252b');
  }

  function mesa() {
    R(0, 120, W, 1, '#b07a52');
    R(0, 121, W, 10, '#8a5a3c');
    [[6, 123, 40], [70, 126, 30], [130, 124, 24], [210, 127, 44], [260, 123, 30], [40, 129, 22]].forEach(function (l) { R(l[0], l[1], l[2], 1, '#7c4f34'); });
    R(0, 131, W, 2, '#a06c48');
    R(0, 133, W, 4, '#5a3a29');
    R(0, 137, W, 43, '#130e18');
    R(0, 176, W, 4, '#1c1622');
    R(4, 137, 5, 40, '#3a261c'); R(311, 137, 5, 40, '#3a261c');
    R(14, 138, 46, 38, '#4a3222'); R(14, 138, 46, 1, '#5e4030');
    [140, 152, 164].forEach(function (yy) { R(16, yy, 42, 10, '#563a28'); R(33, yy + 4, 8, 2, '#c9a26b'); });
  }

  function luminaria() {
    var on = st.lampada && liga('lamp');
    R(8, 118, 14, 3, '#2e2b33'); R(10, 117, 10, 1, '#3e3a45');
    R(14, 98, 2, 19, '#2e2b33');
    for (var i = 0; i < 14; i++) P(15 + i, 98 - Math.floor(i * .75), '#2e2b33');
    R(27, 84, 10, 2, '#2e2b33'); R(25, 86, 14, 3, '#3a3640'); R(25, 86, 14, 1, '#4a4652');
    R(28, 89, 8, 1, on ? '#ffe9a8' : '#5a5560');
  }

  function celApp(f) {
    var x = 44, y = 92;
    R(x, y, 16, 29, '#0e0e12'); R(x + 1, y + 1, 14, 27, '#1b1b22');
    R(x + 1, y + 29, 14, 2, '#2e2b33');
    if (!liga('cel') || acendendo('cel')) { R(x + 2, y + 3, 12, 22, '#07070a'); if (acendendo('cel')) R(x + 2, y + 13, 12, 2, '#e8eef8'); return; }
    var sx = x + 2, sy = y + 3, ok = st.appOk > 0;
    R(sx, sy, 12, 22, '#121a2b');
    R(sx + 1, sy + 1, 10, 6, '#1e63c6'); R(sx + 1, sy + 1, 10, 1, '#2f7be0');
    R(sx + 2, sy + 2, 2, 2, '#5d8fd8'); P(sx + 2, sy + 2, '#e8f0ff');
    R(sx + 5, sy + 2, 3, 1, '#ffffff'); R(sx + 9, sy + 2, 2, 1, '#4ade80');
    R(sx + 2, sy + 5, 6, 1, '#ffffff');
    R(sx + 1, sy + 8, 10, 2, '#273049'); P(sx + 2, sy + 8, '#3b82f6');
    R(sx + 1, sy + 11, 10, 2, ok && f % 4 < 2 ? '#ffd0d0' : '#ff2a2a');
    R(sx + 1, sy + 14, 10, 2, '#00c000');
    R(sx + 1, sy + 17, 10, 3, '#1b2436');
    for (var i = 0; i < (ok ? 3 : 2); i++) { R(sx + 2 + i * 3, sy + 18, 2, 1, '#3a4458'); P(sx + 2 + i * 3, sy + 18, '#4ade80'); }
    R(sx, sy + 21, 12, 1, '#0b1020'); P(sx + 5, sy + 21, '#3b82f6'); P(sx + 6, sy + 21, '#3b82f6');
    R(x + 6, y + 26, 4, 1, '#3a3a44');
  }

  function celBandit(f) {
    var x = 66, y = 90;
    R(x, y, 22, 31, '#18181e'); R(x + 1, y + 1, 20, 29, '#2a2a33'); R(x + 1, y + 1, 20, 1, '#3a3a45');
    R(x + 3, y + 31, 16, 2, '#2e2b33');
    if (!liga('cel') || acendendo('cel')) { R(x + 2, y + 3, 18, 24, '#07070a'); if (acendendo('cel')) R(x + 2, y + 14, 18, 2, '#e8eef8'); P(x + 17, y + 4, '#5a5a66'); P(x + 16, y + 5, '#5a5a66'); return; }
    R(x + 2, y + 3, 18, 24, '#16130f');
    var p5 = 37 + Math.round(Math.sin(f / 40) * 6), p7 = 64;
    R(x + 4, y + 5, 14, 1, '#2b2419'); R(x + 4, y + 5, Math.round(14 * p5 / 100), 1, '#8fb573');
    R(x + 4, y + 7, 14, 1, '#2b2419'); R(x + 4, y + 7, Math.round(14 * p7 / 100), 1, '#f0a83c');
    var rr = st.r, sono = dormindo();
    g.save(); g.beginPath(); g.rect(x + 2, y + 3, 18, 24); g.clip();
    racco(g, x + 3, y + 10, { bob: Som.batida(), blink: (f % 50) < 2, sleep: sono, acc: st.hesoyam ? ['THUG'] : [] });
    g.restore();
    P(x + 17, y + 4, '#5a5a66'); P(x + 16, y + 5, '#5a5a66'); P(x + 16, y + 6, '#5a5a66'); P(x + 15, y + 7, '#5a5a66');
    R(x + 3, y + 31, 16, 2, '#2e2b33'); R(x + 9, y + 28, 4, 1, '#3a3a44');
  }

  function monitorSenna(f) {
    var x = 98, y = 58;
    R(x, y, 102, 56, '#0f0e13'); R(x + 1, y + 1, 100, 54, '#1b1a22');
    var sx = x + 3, sy = y + 3, sw = 96, sh = 49;
    if (!liga('senna') || acendendo('senna')) {
      R(sx, sy, sw, sh, '#07070a');
      if (acendendo('senna')) R(sx, sy + 23, sw, 3, '#e8eef8');
      R(x, y + 53, 102, 3, '#0f0e13'); P(x + 98, y + 54, '#ffb347');
      R(x + 46, y + 56, 10, 6, '#25232c'); R(x + 34, y + 62, 34, 2, '#25232c'); R(x + 34, y + 62, 34, 1, '#34313d');
      return;
    }
    R(sx, sy, sw, 25, '#131d36'); R(sx, sy + 25, sw, 24, '#0e1528');
    for (var d = 0; d < sw; d += 2) P(sx + d + ((sy + 25) % 2), sy + 24, '#0e1528');
    R(x + 5, y + 5, 54, 41, '#0b0f18');
    R(x + 5, y + 5, 54, 3, '#262c3c'); P(x + 7, y + 6, '#ff6257'); P(x + 9, y + 6, '#ffc857'); P(x + 11, y + 6, '#5cf2a0');
    R(x + 6, y + 9, 3, 36, '#10141f');
    var cores = ['#7aa2f7', '#c3e88d', '#f78c6c', '#89ddff', '#c792ea', '#ffcb6b', '#5c6370'];
    var linhas = st.code;
    for (var i = 0; i < linhas.length; i++) {
      var ly = y + 10 + i * 3, lx = x + 11 + linhas[i].ind * 2;
      P(x + 7, ly, '#2a3144');
      linhas[i].seg.forEach(function (s) { R(lx, ly, s[0], 1, cores[s[1]]); lx += s[0] + 1; });
    }
    if (st.linha) {
      var ly2 = y + 10 + linhas.length * 3, lx2 = x + 11 + st.linha.ind * 2, rest = st.linha.dig;
      st.linha.seg.forEach(function (s) {
        if (rest <= 0) return;
        var w = Math.min(s[0], rest); R(lx2, ly2, w, 1, cores[s[1]]); lx2 += w + (w === s[0] ? 1 : 0); rest -= s[0];
      });
      if ((f >> 2) % 2) R(lx2, ly2 - 1, 1, 3, '#e6e6e6');
    }
    var px = x + 62, my = y + 20, cx = px + 17;
    R(px, y + 5, 35, 33, '#14110f');
    R(px, y + 5, 35, 7, '#1b1714'); R(px, y + 12, 35, 1, '#2f2722');
    R(px + 2, y + 7, 3, 1, '#e8743b'); R(px + 2, y + 9, 3, 1, '#e8743b'); P(px + 2, y + 8, '#e8743b'); P(px + 4, y + 8, '#e8743b'); P(px + 3, y + 8, '#ffd9b0');
    txt(g, 'SENNA', px + 8, y + 6, '#ece4d8');
    R(cx - 5, my - 3, 11, 7, '#21170f'); R(cx - 3, my - 4, 7, 9, '#21170f');
    var NOS = [[-11, -5, '#7aa7f0'], [11, -5, '#7aa7f0'], [-12, 4, '#7aa7f0'], [12, 4, '#cfc6b8'], [-4, 6, '#8cc47a'], [5, -6, '#7aa7f0']];
    NOS.forEach(function (n) {
      var tx = cx + n[0], ty = my + n[1], passos = Math.max(Math.abs(n[0]), Math.abs(n[1]));
      for (var k = 2; k < passos; k++) P(Math.round(cx + n[0] * k / passos), Math.round(my + n[1] * k / passos), '#4a3526');
    });
    NOS.forEach(function (n) { R(cx + n[0], my + n[1], 2, 2, n[2]); });
    [[-14, -7], [-13, -8], [-15, -5]].forEach(function (d, k) { if ((f + k * 7) % 40 > 3) P(cx + d[0], my + d[1], '#e0704f'); });
    [[-15, 6], [-14, 8], [-12, 7]].forEach(function (d, k) { if ((f + k * 11) % 46 > 3) P(cx + d[0], my + d[1], '#e0704f'); });
    P(cx + 14, my - 7, '#f2c94c'); P(cx - 9, my - 7, '#a99bf5'); P(cx + 8, my - 8, '#a99bf5');
    if (st.toast > 0) { R(cx + 14, my - 2, 2, 2, '#f2c94c'); if ((f >> 2) % 2) { P(cx + 13, my - 3, '#fff1c9'); P(cx + 16, my - 3, '#fff1c9'); P(cx + 13, my, '#fff1c9'); P(cx + 16, my, '#fff1c9'); } }
    R(cx - 1, my - 1, 3, 3, '#e8743b'); P(cx, my, '#ffd9b0');
    var tmp = clima ? clima.temp + '°' : '21°';
    txt(g, tmp, px + 3, y + 31, '#ece4d8');
    R(px + 16, y + 32, 16, 1, '#2c2521'); R(px + 16, y + 32, 9, 1, '#e8743b');
    R(px + 16, y + 34, 16, 1, '#2c2521'); R(px + 16, y + 34, Math.round(16 * .64), 1, '#f2c94c');
    if (st.toast > 0) {
      var tx = x + 60 + Math.max(0, st.toastX), ty = y + 40;
      R(tx, ty, 37, 8, '#2b2b2b'); R(tx, ty, 37, 1, '#3c3c3c');
      R(tx + 2, ty + 2, 4, 4, '#e8743b'); R(tx + 3, ty + 3, 2, 2, '#1b1714');
      R(tx + 8, ty + 2, 20, 1, '#e6e6e6'); R(tx + 8, ty + 4, 26, 1, '#9a9a9a');
    }
    R(sx, sy + 45, sw, 4, '#0a0d16'); R(sx + 44, sy + 46, 2, 2, '#6cc6ff'); R(sx + 48, sy + 46, 2, 2, '#3a4560'); R(sx + 52, sy + 46, 2, 2, '#3a4560');
    R(x, y + 53, 102, 3, '#0f0e13'); P(x + 98, y + 54, '#e8743b');
    R(x + 46, y + 56, 10, 6, '#25232c'); R(x + 34, y + 62, 34, 2, '#25232c'); R(x + 34, y + 62, 34, 1, '#34313d');
  }

  function monitorHud(f) {
    var x = 205, y = 60;
    R(x, y, 30, 54, '#0f0e13'); R(x + 1, y + 1, 28, 52, '#1b1a22');
    R(x + 2, y + 2, 26, 49, '#04110a');
    if (!liga('hud') || acendendo('hud')) {
      R(x + 2, y + 2, 26, 49, '#07070a');
      if (acendendo('hud')) R(x + 2, y + 25, 26, 2, '#e8eef8');
      R(x, y + 51, 30, 3, '#0f0e13'); R(x + 11, y + 54, 8, 6, '#25232c'); R(x + 5, y + 60, 20, 2, '#25232c'); R(x + 5, y + 60, 20, 1, '#34313d');
      return;
    }
    txt(g, 'HUD', x + 4, y + 4, '#5cf2a0');
    if ((f >> 3) % 2) P(x + 25, y + 5, '#5cf2a0');
    var nomes = ['CPU', 'GPU', 'RAM'];
    for (var i = 0; i < 3; i++) {
      var yy = y + 11 + i * 9, v = st.hud[i];
      txt(g, nomes[i], x + 4, yy, '#7fdcae');
      var cor = v > 80 ? '#ff6257' : v > 65 ? '#ffc857' : '#5cf2a0';
      R(x + 4, yy + 6, 22, 2, '#103020'); R(x + 4, yy + 6, Math.round(22 * v / 100), 2, cor);
    }
    var gy = y + 39;
    R(x + 4, gy, 22, 10, '#06180e');
    st.spark.forEach(function (v, k) { var hh = Math.max(1, Math.round(v / 10)); R(x + 4 + k, gy + 10 - hh, 1, 1, '#5cf2a0'); if (hh > 1) R(x + 4 + k, gy + 11 - hh, 1, hh - 1, '#0e3a22'); });
    R(x, y + 51, 30, 3, '#0f0e13');
    R(x + 11, y + 54, 8, 6, '#25232c'); R(x + 5, y + 60, 20, 2, '#25232c'); R(x + 5, y + 60, 20, 1, '#34313d');
  }

  function tapete() {
    R(104, 123, 116, 7, '#1c1922'); R(104, 123, 116, 1, '#2a2530'); R(104, 129, 116, 1, '#141218');
    R(112, 124, 70, 4, '#2a2833');
    for (var i = 0; i < 34; i++) { P(113 + i * 2, 125, '#3e3b4a'); P(114 + i * 2, 126, '#3e3b4a'); }
    R(192, 125, 6, 3, '#2a2833'); R(193, 125, 4, 1, '#3e3b4a');
  }

  function lata(f) {
    var x = 238, y = 110;
    R(x, y, 6, 1, '#c7cbd3'); R(x, y + 1, 6, 10, '#141a14'); R(x, y + 1, 1, 10, '#28322a'); R(x, y + 10, 6, 1, '#0c0f0c');
    [[3, 2], [2, 3], [2, 4], [3, 4], [4, 4], [3, 5], [2, 6]].forEach(function (p) { P(x + p[0], y + p[1], '#7cff4f'); });
    if (st.vapor > 0) for (var i = 0; i < 3; i++) P(x + 2 + i, y - 2 - ((f + i * 3) % 5), 'rgba(220,230,255,.45)');
  }

  function fone() {
    var c = '#2c2b33', h = '#4a4856';
    g.save(); g.translate(43, 0);
    R(254, 108, 7, 1, c); P(252, 109, c); P(253, 109, c); P(261, 109, c); P(262, 109, c);
    P(251, 110, c); P(263, 110, c); R(250, 111, 1, 4, c); R(264, 111, 1, 4, c);
    P(255, 108, h); P(256, 108, h);
    R(248, 114, 5, 7, c); R(249, 115, 3, 5, '#e0764f'); R(262, 114, 5, 7, c); R(263, 115, 3, 5, '#e0764f');
    g.restore();
    st.notas.forEach(function (n) { var x = Math.round(n[0]), y = Math.round(n[1]); P(x, y, '#ffc857'); P(x, y - 1, '#ffc857'); P(x, y - 2, '#ffc857'); P(x + 1, y - 2, '#ffc857'); P(x - 1, y + 1, '#ffc857'); });
  }

  var RGB_MODOS = [
    function (f, i) { return 'hsl(' + ((f * 12 + i * 120) % 360) + ',95%,62%)'; },
    function () { return '#ee7a5b'; },
    function () { return '#5cf2a0'; },
    function () { return '#2a2833'; }
  ];
  function pc(f) {
    var x = 258, y = 140;
    R(x, y, 40, 37, '#0f0e13'); R(x + 1, y + 1, 38, 35, '#1a1920');
    R(x + 2, y + 2, 26, 33, '#121118');
    var modo = RGB_MODOS[liga('pc') ? st.rgb : 3];
    for (var i = 0; i < 3; i++) {
      var cy = y + 7 + i * 11, cx = x + 34, cor = modo(f, i);
      R(cx - 3, cy - 4, 7, 1, cor); R(cx - 3, cy + 4, 7, 1, cor); R(cx - 4, cy - 3, 1, 7, cor); R(cx + 4, cy - 3, 1, 7, cor);
      R(cx - 3, cy - 3, 7, 7, '#141319');
      var a = (f * (st.rgb === 3 ? 0 : 1)) % 4;
      if (a === 0) R(cx - 2, cy, 5, 1, '#2c2a35'); else if (a === 1) { P(cx - 2, cy - 2, '#2c2a35'); P(cx - 1, cy - 1, '#2c2a35'); P(cx + 1, cy + 1, '#2c2a35'); P(cx + 2, cy + 2, '#2c2a35'); }
      else if (a === 2) R(cx, cy - 2, 1, 5, '#2c2a35'); else { P(cx + 2, cy - 2, '#2c2a35'); P(cx + 1, cy - 1, '#2c2a35'); P(cx - 1, cy + 1, '#2c2a35'); P(cx - 2, cy + 2, '#2c2a35'); }
      P(cx, cy, '#3a3846');
    }
    R(x + 4, y + 18, 22, 4, '#24232c'); R(x + 4, y + 22, 22, 1, modo(f, 1));
    R(x + 6, y + 6, 8, 8, '#24232c'); R(x + 8, y + 8, 4, 4, '#2e2d38');
    P(x + 3, y + 3, liga('pc') ? '#5cf2a0' : '#3a2a20');
  }

  var FUNKOS = [
    { id: 'frodo', x: 153, faixa: '#2f4a2a', cabelo: '#5a3a22', roupa: '#4f6b3a', gola: '#8a6a3a' },
    { id: 'fsenna', x: 165, faixa: '#1d3f8f', cabelo: '#2b1a12', roupa: '#d7261e', gola: '#f3f1ec' },
    { id: 'bottas', x: 177, faixa: '#16161a', bone: '#f2f2f2', roupa: '#16161a', gola: '#00a19c' }
  ];
  function funko(k) {
    var x = k.x, y = 16;
    R(x, y, 10, 14, '#e9e6de'); R(x + 9, y, 1, 14, '#c9c5ba');
    R(x, y, 10, 3, k.faixa); P(x + 1, y + 1, '#ffd23f'); P(x + 2, y + 1, '#ffd23f');
    if (k.id === 'bottas') P(x + 7, y + 1, '#00a19c');
    R(x + 1, y + 4, 8, 8, '#2b2a33');
    var fx = x + 2, fy = y + 5;
    R(fx, fy + 1, 6, 3, '#f1c9a5');
    if (k.bone) { R(fx, fy, 6, 1, k.bone); R(fx - 1, fy + 1, 7, 1, k.bone); P(fx + 5, fy, '#00a19c'); }
    else { R(fx, fy, 6, 1, k.cabelo); P(fx, fy + 1, k.cabelo); P(fx + 5, fy + 1, k.cabelo); if (k.id === 'frodo') { P(fx + 2, fy + 1, k.cabelo); P(fx + 4, fy + 1, k.cabelo); } }
    P(fx + 1, fy + 2, '#141216'); P(fx + 4, fy + 2, '#141216');
    R(fx + 1, fy + 4, 4, 2, k.roupa); R(fx + 2, fy + 4, 2, 1, k.gola);
    P(x + 1, y + 4, 'rgba(255,255,255,.35)'); P(x + 2, y + 5, 'rgba(255,255,255,.2)');
    R(x + 1, y + 12, 8, 1, '#d9d4c8');
  }
  function mclaren(f) {
    var x = 193 + (st.f1 > 0 ? f % 2 : 0), y = 21;
    var Wt = '#f3f1ec', Rd = '#d7261e', Pn = '#121216', Hb = '#8a8f98';
    R(x + 24, y, 6, 1, Wt); R(x + 24, y + 1, 6, 1, Rd); R(x + 28, y, 2, 5, Rd);
    R(x + 15, y + 2, 9, 1, Wt); R(x + 13, y + 3, 14, 1, Wt);
    R(x + 5, y + 4, 23, 1, Wt); R(x + 3, y + 4, 2, 1, Wt);
    R(x + 1, y + 5, 27, 1, Rd);
    R(x + 9, y + 6, 18, 1, '#2a2a30');
    R(x, y + 6, 7, 1, Wt); R(x, y + 5, 1, 2, Rd);
    R(x + 12, y + 2, 2, 1, '#ffd23f'); P(x + 12, y + 3, '#ffd23f'); P(x + 13, y + 3, '#2e9e4f');
    [[6, 6], [23, 6]].forEach(function (c) {
      var cx = x + c[0], cy = y + c[1];
      R(cx - 1, cy - 2, 3, 1, Pn); R(cx - 2, cy - 1, 5, 3, Pn); R(cx - 1, cy + 2, 3, 1, Pn); P(cx, cy, Hb);
    });
    if (st.f1 > 0) for (var i = 0; i < 3; i++) P(x + 30 + i + (f % 3), y + 4 - i, 'rgba(200,200,210,' + (.5 - i * .15) + ')');
  }

  function prateleiraAlta(f) {
    R(150, 30, 78, 3, '#7a4f37'); R(150, 30, 78, 1, '#93623f'); R(150, 33, 78, 1, '#4a2f22');
    R(156, 34, 2, 3, '#3a2a20'); R(220, 34, 2, 3, '#3a2a20');
    FUNKOS.forEach(funko);
    mclaren(f);
  }

  var CHAO = 125, PULO_X = 60;
  var LADO = [
    ['T..........e..e.',
     'T..........HHHH.',
     '.T........HHMEH.',
     '.T........HHHHHN',
     '..TBBBBBBBBHHHH.',
     '..BBBBBBBBBBWW..',
     '..BBBBBBBBBBW...',
     '..BB.BB...BB.B..',
     '..W..W.....W..W.'],
    ['T..........e..e.',
     'T..........HHHH.',
     '.T........HHMEH.',
     '.T........HHHHHN',
     '..TBBBBBBBBHHHH.',
     '..BBBBBBBBBBWW..',
     '..BBBBBBBBBBW...',
     '...BB.B..B.BB...',
     '...W..W..W..W...']
  ];
  var PAL_MIMI = { H: '#efe6da', B: '#efe6da', M: '#b8957a', E: '#6f8fa8', N: '#d9a0a0', W: '#fbf6ee', T: '#9a948c', e: '#b8957a' };
  var PAL_LUCI = { H: '#141218', B: '#141218', M: '#141218', E: '#f2d33b', N: '#2c2433', W: '#141218', T: '#141218', e: '#2c2433' };
  var SPR_GATO = {
    mimi: [spr(LADO[0], PAL_MIMI), spr(LADO[1], PAL_MIMI)],
    lucifer: [spr(LADO[0], PAL_LUCI), spr(LADO[1], PAL_LUCI)]
  };
  var LUCI_SENTA = spr([
    '.k.......k.',
    '.kk.....kk.',
    '.KKKKKKKKK.',
    'KKKKKKKKKKK',
    'KKYyKKKYyKK',
    'KKKKKnKKKKK',
    '.KKKKKKKKK.',
    '..KKKKKKK..',
    '.KKKKKKKKK.',
    '.KKKKKKKKKt',
    '.KKKKKKKKKt',
    '.KKKKKKKKt.',
    '..KK...KK..'
  ], { k: '#2c2433', K: '#141218', Y: '#f2d33b', y: '#1a1405', n: '#3a2a30', t: '#141218' });
  var GATOS = {
    mimi: { x: 25, dir: 1, alvo: 25, pausa: 160, modo: 'senta', pts: [24, 40, 96, 120, 196, 226, 268, 292] },
    lucifer: { x: 58, dir: 1, alvo: 58, pausa: 420, modo: 'janela', t: 0, pts: [60, 92, 124, 200, 228, 270, 296] }
  };
  function gatoUpdate(k) {
    var c = GATOS[k];
    if (lento) return;
    if (c.modo === 'janela') { if (--c.pausa <= 0) { c.modo = 'desce'; c.t = 0; } return; }
    if (c.modo === 'desce' || c.modo === 'sobe') {
      if (++c.t >= 12) {
        if (c.modo === 'desce') { c.modo = 'senta'; c.x = PULO_X; c.pausa = 60; }
        else { c.modo = 'janela'; c.pausa = Math.floor(rnd(500, 1100)); }
      }
      return;
    }
    if (c.modo === 'senta') {
      if (--c.pausa > 0) return;
      c.volta = k === 'lucifer' && Math.random() < .3;
      c.alvo = c.volta ? PULO_X : c.pts[Math.floor(Math.random() * c.pts.length)];
      c.modo = 'anda';
      return;
    }
    if (st.f % 2) return;
    if (c.x === c.alvo) {
      if (c.volta) { c.modo = 'sobe'; c.t = 0; }
      else { c.modo = 'senta'; c.pausa = Math.floor(rnd(80, 260)); }
      return;
    }
    c.dir = c.alvo > c.x ? 1 : -1;
    c.x += c.dir;
  }
  function pulo(c) {
    var p = c.t / 12; if (c.modo === 'sobe') p = 1 - p;
    return [Math.round(52 + (PULO_X - 52) * p), Math.round(68 + (CHAO - 9 - 68) * p - Math.sin(Math.PI * p) * 10)];
  }
  function rectGato(k) {
    var c = GATOS[k];
    if (c.modo === 'janela') return [51, 68, 18, 9];
    if (c.modo === 'desce' || c.modo === 'sobe') { var q = pulo(c); return [q[0], q[1], 16, 9]; }
    if (c.modo === 'anda') return [c.x, CHAO - 10, 16, 11];
    return k === 'mimi' ? [c.x - 1, CHAO - 16, 14, 17] : [c.x - 1, CHAO - 14, 13, 15];
  }
  function ladoGato(img, x, y, dir) {
    if (dir >= 0) { g.drawImage(img, x, y); return; }
    g.save(); g.translate(x + 16, y); g.scale(-1, 1); g.drawImage(img, 0, 0); g.restore();
  }

  function mimiSenta(x, y, f) {
    var C = '#efe6da', c = '#d8cbb9', m = '#b8957a', W = '#fbf6ee', E = '#6f8fa8', p = '#1d2430';
    var pisca = st.mimi > 0 || (f % 70) < 2;
    R(x + 1, y, 1, 2, m); R(x + 9, y, 1, 2, m); P(x + 2, y + 1, m); P(x + 8, y + 1, m);
    R(x + 1, y + 2, 9, 1, C); P(x + 2, y + 2, m); P(x + 8, y + 2, m);
    R(x, y + 3, 11, 4, C); P(x + 4, y + 3, m); P(x + 6, y + 3, m); P(x + 5, y + 3, '#a0806a');
    R(x + 3, y + 4, 2, 1, m); R(x + 6, y + 4, 2, 1, m);
    if (pisca) { R(x + 2, y + 5, 2, 1, '#8a6a55'); R(x + 7, y + 5, 2, 1, '#8a6a55'); }
    else { P(x + 2, y + 5, E); P(x + 3, y + 5, p); P(x + 7, y + 5, E); P(x + 8, y + 5, p); }
    P(x + 5, y + 6, '#d9a0a0');
    R(x + 1, y + 7, 9, 1, C);
    R(x + 2, y + 8, 7, 1, W); R(x + 1, y + 9, 9, 3, W); R(x + 1, y + 9, 1, 3, C); R(x + 9, y + 9, 1, 3, C);
    R(x + 1, y + 12, 9, 2, C); R(x + 1, y + 12, 1, 2, c); R(x + 9, y + 12, 1, 2, c);
    R(x + 2, y + 14, 2, 1, W); R(x + 7, y + 14, 2, 1, W);
    var sw = st.mimi > 0 ? (f >> 1) % 2 : ((f >> 3) % 4 === 0 ? 1 : 0), cauda = '#9a948c';
    R(x + 10, y + 12, 1, 2, cauda); P(x + 11, y + 11, cauda); P(x + 11 + sw, y + 10, cauda); P(x + 11 + sw, y + 9, '#6f6a64'); P(x + 12 + sw, y + 8, '#6f6a64');
  }

  function lucifer(f) {
    var x = 52, y = 69, K = '#141218', k = '#2c2433', o = '#3a3342';
    P(x + 1, y, K); P(x + 6, y, K); R(x + 1, y + 1, 2, 1, K); R(x + 5, y + 1, 2, 1, K); P(x + 2, y + 1, k); P(x + 5, y + 1, k);
    R(x + 1, y + 2, 7, 1, K); R(x, y + 3, 9, 2, K);
    R(x + 1, y + 4, 12, 1, K); R(x + 1, y + 5, 13, 2, K); R(x + 9, y + 3, 3, 1, K);
    P(x + 4, y + 4, '#3a2a30');
    R(x, y + 7, 2, 1, K); R(x + 3, y + 7, 2, 1, K);
    var t = (f >> 4) % 3;
    R(x + 13, y + 7, 3, 1, K); P(x + 15 + (t === 1 ? 1 : 0), y + 6, K);
    R(x + 9, y + 3, 3, 1, o);
  }
  function olhosLucifer(f) {
    var c = GATOS.lucifer, Y = '#f2d33b', yy = '#1a1405', F = '#2c2433';
    var pisca = st.lucifer > 0 ? (f % 6 < 2) : (f % 90) < 3;
    if (c.modo === 'janela') {
      if (pisca) { R(54, 72, 2, 1, F); R(57, 72, 2, 1, F); return; }
      P(54, 72, Y); P(55, 72, yy); P(57, 72, Y); P(58, 72, yy);
      return;
    }
    if (c.modo === 'senta') {
      var x = c.x, y = CHAO - 13;
      if (pisca) { R(x + 2, y + 4, 2, 1, F); R(x + 7, y + 4, 2, 1, F); return; }
      P(x + 2, y + 4, Y); P(x + 3, y + 4, yy); P(x + 7, y + 4, Y); P(x + 8, y + 4, yy);
      return;
    }
    var q = c.modo === 'anda' ? [c.x, CHAO - 9] : pulo(c);
    var dir = c.modo === 'anda' ? c.dir : (c.modo === 'desce' ? 1 : -1);
    if (!pisca) P(dir >= 0 ? q[0] + 13 : q[0] + 2, q[1] + 2, Y);
  }

  function desenhaGato(k, f) {
    var c = GATOS[k];
    if (c.modo === 'janela') return;
    if (c.modo === 'desce' || c.modo === 'sobe') { var q = pulo(c); ladoGato(SPR_GATO[k][0], q[0], q[1], c.modo === 'desce' ? 1 : -1); }
    else if (c.modo === 'anda') ladoGato(SPR_GATO[k][(f >> 1) % 2], c.x, CHAO - 9, c.dir);
    else if (k === 'mimi') mimiSenta(c.x, CHAO - 15, f);
    else g.drawImage(LUCI_SENTA, c.x, CHAO - 13);
    if (k === 'lucifer') olhosLucifer(f);
  }
  function coracoes() {
    st.coracoes.forEach(function (h) { var hx = Math.round(h[0]), hy = Math.round(h[1]); P(hx, hy, '#ff7a9a'); P(hx + 2, hy, '#ff7a9a'); R(hx, hy + 1, 3, 1, '#ff7a9a'); P(hx + 1, hy + 2, '#ff7a9a'); });
  }

  var FRED_PAL = { e: '#e3a86c', F: '#f0c896', W: '#fbf1e3', K: '#1c1410', L: '#f7e3c6', T: '#fbf1e3', t: '#e6d6bd' };
  var FRED = [spr([
    '...e......e.....',
    '..eFe....eFe....',
    '..FFFFFFFFFF....',
    '.FFFFFFFFFFFF...',
    'FFFKFFFFFFKFFF..',
    'FFFFFLLLLFFFFF..',
    'WFFFFLKKLFFFFWt.',
    'WWFFFFLLFFFFWWTt',
    'WWWWWWWWWWWWWWTT',
    '.WWWWWWWWWWWWTTT',
    '.FWWWWWWWWWWFTT.',
    '.FFWWWWWWWWFF...',
    '.FFFFFFFFFFFF...',
    '..WW......WW....'
  ], FRED_PAL), spr([
    '...e......e.....',
    '..eFe....eFe....',
    '..FFFFFFFFFF....',
    '.FFFFFFFFFFFF...',
    'FFFKFFFFFFKFFFt.',
    'FFFFFLLLLFFFFFTt',
    'WFFFFLKKLFFFFWTT',
    'WWFFFFLLFFFFWWTT',
    'WWWWWWWWWWWWWWTT',
    '.WWWWWWWWWWWWTT.',
    '.FWWWWWWWWWWFT..',
    '.FFWWWWWWWWFF...',
    '.FFFFFFFFFFFF...',
    '..WW......WW....'
  ], FRED_PAL)];
  function fred(f) {
    var pulo = st.fred > 0 ? [0, 2, 3, 2, 0, 0][Math.min(5, (12 - st.fred) % 6)] : 0;
    var abana = (f >> (st.fred > 0 ? 0 : 2)) % 2;
    var x = 186, y = 162 - pulo;
    g.drawImage(FRED[abana], x, y);
    if (f % 80 < 2) { P(x + 3, y + 4, '#f0c896'); P(x + 10, y + 4, '#f0c896'); }
    if (st.fred > 8) { P(x - 3, y + 1, '#ffc857'); P(x - 4, y, '#ffc857'); P(x - 2, y, '#ffc857'); }
  }

  function vini(f) {
    var x0 = 145, y0 = 92 + Som.batida();
    var co = '#8e9fa4', cs = '#73858a', ch = '#a9b9bd', cap = '#7f9095', ci = '#56656a', sk = '#e2ab8a';
    R(141, 108, 24, 1, co); R(138, 109, 30, 1, co); R(136, 110, 34, 1, co);
    R(135, 111, 36, 26, co); R(135, 111, 3, 26, cs); R(168, 111, 3, 26, cs);
    R(140, 110, 6, 1, ch); R(160, 110, 6, 1, ch);
    R(146, 122, 1, 6, cs); R(160, 121, 1, 7, cs);
    if (!st.virado) {
      R(131, 113, 4, 17, cs); R(171, 113, 4, 17, cs); R(131, 113, 1, 17, '#66777c'); R(174, 113, 1, 17, '#66777c');
      R(142, 106, 22, 2, cap); R(140, 108, 26, 7, cap); R(141, 115, 24, 3, cap); R(143, 118, 20, 2, cap); R(146, 120, 14, 1, cap);
      R(141, 108, 1, 9, ci); R(164, 108, 1, 9, ci); R(143, 117, 20, 1, ci); R(146, 119, 14, 1, ci);
      R(143, 107, 20, 1, ch);
      g.drawImage(CABECA_COSTAS, x0, y0);
    } else {
      R(131, 113, 4, 17, cs); R(131, 113, 1, 17, '#66777c');
      var wv = (f >> 1) % 2;
      R(171, 103, 4, 10, cs);
      R(172 + wv, 97, 4, 6, sk); R(171 + wv, 96, 1, 3, sk);
      R(141, 106, 24, 3, cap); R(143, 109, 20, 2, cap); R(141, 106, 24, 1, ch);
      R(149, 107, 8, 3, ci); P(148, 109, '#f2f2ee'); P(157, 109, '#f2f2ee');
      g.drawImage(CABECA_FRENTE, x0, y0);
      if (f % 40 < 2) { R(x0 + 3, y0 + 9, 2, 1, '#efc3a2'); R(x0 + 11, y0 + 9, 2, 1, '#efc3a2'); }
    }
    if (st.chapeu) g.drawImage(CHAPEU, x0 + 1, y0 - 10);
    R(137, 128, 34, 46, '#1b1a21');
    R(139, 126, 30, 2, '#1b1a21'); R(139, 126, 30, 1, '#2f2c38');
    R(137, 128, 4, 46, '#25232d'); R(167, 128, 4, 46, '#25232d');
    R(147, 132, 1, 38, '#26242e'); R(160, 132, 1, 38, '#26242e');
    R(142, 138, 24, 1, '#26242e');
    R(152, 174, 4, 3, '#2a2830'); R(140, 177, 28, 2, '#1a1820'); P(141, 179, '#3a3846'); P(166, 179, '#3a3846');
  }

  function desenhaRacco(f) {
    var r = st.r, sono = dormindo();
    var andando = r.alvo !== Math.round(r.x) && r.pausa <= 0 && !sono;
    var step = andando ? 1 + ((f >> 1) % 2) : 0;
    var acc = st.hesoyam ? ['THUG'] : [];
    racco(g, Math.round(r.x), 112, { bob: Som.batida(), flip: r.dir < 0, step: step, blink: !andando && f % 46 < 2, sleep: sono, look: andando ? 0 : r.look, wave: r.wave > 0 && (f >> 1) % 2, acc: acc });
    if (sono) { var zz = (f >> 3) % 3; txt(g, 'Z', Math.round(r.x) + 13 + zz, 106 - zz * 2, '#a89a86'); }
    if (st.parada > 0) {
      var nomes = [['SPROUT'], ['HEADPHONES'], ['GLASSES'], ['TOP_HAT']], cores = ['#7ccba2', '#b9a6f2', '#a39b90', '#f59ac0'];
      for (var i = 0; i < 4; i++) {
        var px = -20 + (300 - st.parada) * 1.6 - i * 20;
        if (px > -16 && px < W) racco(g, Math.round(px), 112, { step: 1 + ((f >> 1) + i) % 2, acc: nomes[i], body: cores[i] });
      }
    }
  }

  function dormindo() { var h = canoas().h; return !liga('racco') || (h >= 1 && h < 6 && !st.hesoyam); }

  function luz(ph) {
    var lamp = st.lampada && liga('lamp');
    var dark = ph === 'noite' ? .42 : ph === 'dia' ? .04 : .2;
    if (!lamp) dark += ph === 'noite' ? .18 : .08;
    if (!liga('senna')) dark += .14;
    if (dark <= .01) return;
    L.globalCompositeOperation = 'source-over';
    L.clearRect(0, 0, W, H);
    L.fillStyle = 'rgba(10,6,22,' + dark + ')';
    L.fillRect(0, 0, W, H);
    L.globalCompositeOperation = 'destination-out';
    function hole(x, y, r, a) { var gr = L.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(0,0,0,' + a + ')'); gr.addColorStop(1, 'rgba(0,0,0,0)'); L.fillStyle = gr; L.fillRect(x - r, y - r, 2 * r, 2 * r); }
    if (liga('senna')) hole(149, 84, 74, .95);
    if (liga('hud')) hole(220, 86, 40, .9);
    if (liga('cel')) { hole(77, 106, 20, .8); hole(52, 106, 16, .7); }
    if (liga('note')) hole(267, 103, 30, .85);
    if (liga('pc')) hole(292, 158, 22, .55);
    hole(44, 44, 42, ph === 'dia' ? .9 : .45);
    if (lamp) { hole(32, 104, 50, .95); hole(48, 118, 36, .7); }
    hole(194, 168, 26, .45);
    L.globalCompositeOperation = 'source-over';
    g.drawImage(Lc, 0, 0);
    g.globalCompositeOperation = 'lighter';
    function glow(x, y, r, c) { var gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, c); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(x - r, y - r, 2 * r, 2 * r); }
    if (liga('senna')) glow(149, 84, 64, 'rgba(70,110,220,.08)');
    if (liga('hud')) glow(220, 86, 30, 'rgba(60,220,140,.08)');
    if (liga('note')) glow(267, 103, 26, 'rgba(120,170,255,.07)');
    if (lamp) glow(32, 104, 48, 'rgba(255,190,110,.13)');
    if (st.rgb === 0 && liga('pc')) glow(292, 158, 24, 'hsla(' + ((st.f * 12) % 360) + ',90%,60%,.12)');
    g.globalCompositeOperation = 'source-over';
  }

  function formigas(r, f) {
    var x = r[0] - 1, y = r[1] - 1, w = r[2] + 2, h = r[3] + 2, per = 2 * (w + h), i;
    for (i = 0; i < per; i++) {
      if ((i + f) % 4 > 1) continue;
      var px, py;
      if (i < w) { px = x + i; py = y; }
      else if (i < w + h) { px = x + w - 1; py = y + (i - w); }
      else if (i < 2 * w + h) { px = x + w - 1 - (i - w - h); py = y + h - 1; }
      else { px = x; py = y + h - 1 - (i - 2 * w - h); }
      P(px, py, '#ffc857');
    }
    var ax = x + Math.floor(w / 2), ay = y - 4 - ((f >> 2) % 2);
    if (ay > 1) { R(ax - 2, ay, 5, 1, '#ffc857'); R(ax - 1, ay + 1, 3, 1, '#ffc857'); P(ax, ay + 2, '#ffc857'); }
  }

  var OBJ = {
    janela: { r: [11, 11, 66, 66] },
    poster: { r: [84, 16, 62, 42] },
    livros: { r: [152, 36, 22, 16] },
    bloco: { r: [175, 40, 12, 12] },
    pocao: { r: [190, 41, 9, 11] },
    mini: { r: [203, 44, 22, 8] },
    chapeu: { r: [229, 38, 14, 14] },
    planta: { r: [244, 38, 12, 28] },
    cortica: { r: [259, 19, 46, 40] },
    lampada: { r: [8, 82, 32, 40] },
    app: { r: [44, 92, 16, 31] },
    banditboard: { r: [66, 90, 22, 33] },
    senna: { r: [98, 58, 102, 64] },
    hud: { r: [205, 60, 30, 62] },
    lata: { r: [237, 109, 8, 13] },
    cloud: { r: [245, 91, 45, 31] },
    fone: { r: [290, 106, 21, 15] },
    pc: { r: [258, 140, 40, 37] },
    frodo: { r: [153, 16, 10, 14] },
    fsenna: { r: [165, 16, 10, 14] },
    bottas: { r: [177, 16, 10, 14] },
    f1: { r: [193, 20, 30, 10] },
    lucifer: { r: [51, 68, 18, 9] },
    mimi: { r: [24, 107, 15, 16] },
    fred: { r: [184, 159, 20, 17] },
    vini: { r: [134, 90, 40, 46] },
    racco: { r: [0, 112, 16, 14] }
  };
  var NOMES = {
    janela: T('Lá fora, em Canoas', 'Outside, in Canoas'), poster: 'Mercedes C180', livros: T('Estante', 'Bookshelf'),
    bloco: T('Bloco de grama', 'Grass block'), pocao: T('Poção de vida', 'Health potion'), mini: 'Mercedes C180',
    chapeu: T('Chapéu de mago', 'Wizard hat'), planta: T('Planta', 'Plant'), cortica: T('Recados', 'Notes'),
    lampada: T('Luminária', 'Desk lamp'), app: 'Símix Ponto', banditboard: 'Banditboard', senna: 'Senna',
    hud: 'ControlSensors HUD', lata: T('Energético', 'Energy drink'), cloud: 'Símix Ponto Cloud',
    fone: T('Fone', 'Headphones'), pc: 'PC', vini: T('Eu', 'Me'), racco: 'Racco',
    frodo: 'Frodo', fsenna: 'Ayrton Senna', bottas: 'Valtteri Bottas', f1: 'McLaren MP4/4',
    lucifer: T('Lúcifer', 'Lucifer'), mimi: 'Mimi', fred: 'Fred'
  };
  var PROJ = { banditboard: 'banditboard', senna: 'senna', hud: 'hud', app: 'app', cloud: 'ponto-cloud' };

  function draw() {
    var f = st.f, ph = fase(canoas().h);
    parede(ph); janela(ph, f); if (GATOS.lucifer.modo === 'janela') { lucifer(f); olhosLucifer(f); } poster(f); cortica(f); prateleiraAlta(f); estante(f);
    mesa(); fred(f); luminaria(); celApp(f); celBandit(f); monitorSenna(f); monitorHud(f); notebook(f);
    tapete(); lata(f); fone(); pc(f);
    desenhaRacco(f);
    desenhaGato('mimi', f); desenhaGato('lucifer', f); coracoes();
    vini(f);
    luz(ph);
    if (ph === 'noite' || ph === 'tarde') olhosLucifer(f);
    var alvo = st.hover || (st.flashAte > Date.now() ? st.flash : null);
    if (alvo && OBJ[alvo]) formigas(OBJ[alvo].r, f);
  }

  var CODE_SEG = [
    function () { return { ind: 0, seg: [[6, 4], [8, 0], [5, 1]] }; },
    function () { return { ind: 1, seg: [[5, 0], [9, 3], [3, 6]] }; },
    function () { return { ind: 1, seg: [[3, 4], [7, 3], [4, 2], [6, 1]] }; },
    function () { return { ind: 2, seg: [[4, 0], [10, 3], [5, 2]] }; },
    function () { return { ind: 2, seg: [[8, 6]] }; },
    function () { return { ind: 1, seg: [[6, 4], [5, 5], [7, 3]] }; },
    function () { return { ind: 2, seg: [[5, 0], [6, 1], [3, 2]] }; },
    function () { return { ind: 0, seg: [[2, 6]] }; }
  ];
  for (var c0 = 0; c0 < 9; c0++) st.code.push(CODE_SEG[c0 % CODE_SEG.length]());

  function update() {
    st.f++;
    var f = st.f;
    if (!st.linha) { st.linha = CODE_SEG[Math.floor(Math.random() * CODE_SEG.length)](); st.linha.dig = 0; st.linha.tot = st.linha.seg.reduce(function (a, s) { return a + s[0]; }, 0); }
    st.linha.dig += 1;
    if (st.linha.dig > st.linha.tot + 4) { st.code.push(st.linha); st.linha = null; if (st.code.length > 10) st.code.shift(); }
    if (f % 6 === 0) {
      st.hud = st.hud.map(function (v, i) { return Math.max(18, Math.min(i === 2 ? 72 : 92, v + rnd(-6, 6))); });
      st.spark.push(st.hud[0]); st.spark.shift();
    }
    if (st.toast > 0) { st.toast--; st.toastX = Math.max(0, st.toastX - 6); }
    else if (f % 110 === 60) { st.toast = 60; st.toastX = 40; }
    if (st.appOk > 0) st.appOk--; else if (f % 160 === 100) { st.appOk = 16; st.novo = 30; }
    if (st.novo > 0) st.novo--;
    if (st.f1 > 0) st.f1--;
    if (st.mimi > 0) st.mimi--;
    if (st.lucifer > 0) st.lucifer--;
    if (st.fred > 0) st.fred--;
    st.coracoes = st.coracoes.filter(function (h) { h[1] -= .5; h[0] += Math.sin(h[1] / 3) * .3; return h[1] > 92; });
    if (st.aviao >= 0) { st.aviao += .5; if (st.aviao > 64) st.aviao = -1; } else if (f % 420 === 300) st.aviao = 0;
    if (st.farol > 0) st.farol--;
    if (st.poster > 0) st.poster--;
    if (st.vapor > 0) st.vapor--;
    if (st.blocoFora > 0) { st.blocoFora--; if (st.blocoFora === 0) st.bloco = 0; }
    st.cacos = st.cacos.filter(function (c) { c[0] += c[2]; c[1] += c[3]; c[3] += .35; return c[1] < 120; });
    st.notas = st.notas.filter(function (n) { n[1] -= .6; n[0] += Math.sin((n[1] + n[2]) / 3) * .5; return n[1] > 92; });
    if (st.postit) {
      var q = st.postit;
      q.vy = Math.min(2.4, q.vy + .25); q.y += q.vy; q.x += Math.sin(q.y / 6) * .8;
      if (q.y > 104) { st.postitK = q.k; st.postitVolta = Date.now() + 7000; st.postit = null; }
    }
    if (!st.pocao && Date.now() > st.pocaoVolta) st.pocao = true;
    if (st.virado && Date.now() > st.viradoAte) st.virado = false;
    if (st.parada > 0) st.parada--;
    var r = st.r;
    if (r.wave > 0) r.wave--;
    if (!dormindo() && !lento) {
      if (r.pausa > 0) {
        r.pausa--;
        if (r.pausa % 25 === 0) r.look = [0, -1, 1][Math.floor(Math.random() * 3)];
      } else if (Math.round(r.x) === r.alvo) {
        r.pausa = Math.floor(rnd(25, 80));
        var pontos = [50, 74, 118, 186, 214, 222, 270, 296];
        r.alvo = pontos[Math.floor(Math.random() * pontos.length)];
      } else {
        r.dir = r.alvo > r.x ? 1 : -1;
        r.x += r.dir;
      }
    }
    OBJ.racco.r[0] = Math.round(r.x);
    gatoUpdate('mimi'); gatoUpdate('lucifer');
    OBJ.mimi.r = rectGato('mimi'); OBJ.lucifer.r = rectGato('lucifer');
  }

  var hots = $('#hots'), tip = $('#sceneTip'), bal = $('#sceneBalao'), balT = null, BTN = {};
  Object.keys(OBJ).forEach(function (id) {
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'hot'; b.setAttribute('data-obj', id);
    b.setAttribute('aria-label', NOMES[id] + (PROJ[id] ? T(', ver projeto', ', see project') : ''));
    posiciona(b, OBJ[id].r);
    hots.appendChild(b); BTN[id] = b;
  });
  function posiciona(b, r) {
    b.style.left = (r[0] / W * 100) + '%'; b.style.top = (r[1] / H * 100) + '%';
    b.style.width = (r[2] / W * 100) + '%'; b.style.height = (r[3] / H * 100) + '%';
  }
  function ancora(el, r) {
    var cx = (r[0] + r[2] / 2) / W * 100;
    el.style.left = Math.max(12, Math.min(88, cx)) + '%';
    if (r[1] < 40) { el.style.top = ((r[1] + r[3]) / H * 100) + '%'; el.classList.add('baixo'); }
    else { el.style.top = (r[1] / H * 100) + '%'; el.classList.remove('baixo'); }
  }
  function mostraTip(id) {
    if (!id || !bal.hidden) { tip.hidden = true; return; }
    tip.innerHTML = esc(NOMES[id]) + (PROJ[id] ? ' <small>' + T('ver projeto ↓', 'see project ↓') + '</small>' : '');
    tip.hidden = false;
    ancora(tip, OBJ[id].r);
  }
  function balao(id, texto, ms) {
    var r = (OBJ[id] || OBJ.vini).r;
    bal.textContent = texto;
    bal.hidden = false;
    tip.hidden = true;
    ancora(bal, r);
    clearTimeout(balT);
    balT = setTimeout(function () { bal.hidden = true; }, ms || 4200);
  }
  hots.addEventListener('pointerover', function (e) {
    var b = e.target.closest('.hot'); if (!b) return;
    st.hover = b.getAttribute('data-obj'); mostraTip(st.hover); if (lento) draw();
  });
  hots.addEventListener('pointerout', function (e) {
    var b = e.target.closest('.hot'); if (!b) return;
    st.hover = null; mostraTip(null); if (lento) draw();
  });
  hots.addEventListener('focusin', function (e) { var b = e.target.closest('.hot'); if (b) { st.hover = b.getAttribute('data-obj'); mostraTip(st.hover); } });
  hots.addEventListener('focusout', function () { st.hover = null; mostraTip(null); });
  hots.addEventListener('click', function (e) {
    var b = e.target.closest('.hot'); if (!b) return;
    age(b.getAttribute('data-obj'));
    if (lento) draw();
  });

  function vai(id) {
    var el = document.getElementById(id); if (!el) return;
    el.scrollIntoView({ behavior: lento ? 'auto' : 'smooth', block: 'start' });
    el.classList.add('flash');
    setTimeout(function () { el.classList.remove('flash'); }, 1800);
  }
  function marca(id) { st.flash = id; st.flashAte = Date.now() + 2200; }
  var moldura = cv.parentNode.parentNode;
  function centraliza(id) {
    if (!OBJ[id] || moldura.scrollWidth <= moldura.clientWidth + 2) return;
    var r = OBJ[id].r, cx = (r[0] + r[2] / 2) / W * cv.clientWidth;
    moldura.scrollTo({ left: cx - moldura.clientWidth / 2, behavior: lento ? 'auto' : 'smooth' });
  }
  if (moldura.scrollWidth > moldura.clientWidth + 2) moldura.scrollLeft = (moldura.scrollWidth - moldura.clientWidth) * .52;

  var RECADOS = [
    T('“Não fazer deploy na sexta.”', '“No deploys on Friday.”'),
    T('“Revisar os PRs antes da daily.”', '“Review PRs before the daily.”'),
    T('“Comprar energético.”', '“Buy energy drinks.”'),
    T('“Terminar o portfólio.” ✓', '“Finish the portfolio.” ✓')
  ];
  var dicas = 0;
  function age(id) {
    marca(id);
    if (PROJ[id]) {
      Som.play('blip');
      if (id === 'senna') { st.toast = 60; st.toastX = 40; }
      if (id === 'app') st.appOk = 16;
      if (id === 'cloud') st.novo = 30;
      vai(PROJ[id]);
      return;
    }
    centraliza(id);
    switch (id) {
      case 'vini':
        Som.play('oi');
        st.virado = !st.virado; st.viradoAte = Date.now() + 6000;
        conquista('virar');
        balao('vini', st.chapeu ? T('Gostou do chapéu? É o mesmo do meu avatar do GitHub.', 'Like the hat? Same one as my GitHub avatar.') : T('Oi! Sou eu, o Vini. Pode mexer em tudo.', 'Hi! That\'s me, Vini. Feel free to touch everything.'));
        break;
      case 'racco':
        Som.play('oi');
        st.r.wave = 18; st.r.pausa = 40;
        conquista('racco');
        var falta = SEG.filter(function (s) { return !achados[s[0]] && s[0] !== 'racco' && s[0] !== 'ligar'; });
        balao('racco', falta.length ? T('Psiu… ', 'Psst… ') + falta[dicas++ % falta.length][3] : T('Você achou tudo. Respeito.', 'You found everything. Respect.'));
        break;
      case 'poster':
      case 'mini':
        Som.play('vrum');
        st.farol = 18; st.poster = 10;
        conquista('carro');
        balao(id, T('Mercedes C180. Vrum.', 'Mercedes C180. Vroom.'));
        break;
      case 'bloco':
        if (st.blocoFora > 0) { balao('bloco', T('Já foi. Ele volta daqui a pouco.', 'Gone. It respawns in a bit.')); break; }
        st.bloco++;
        if (st.bloco >= 3) {
          Som.play('quebra');
          for (var k = 0; k < 14; k++) st.cacos.push([rnd(176, 186), rnd(41, 50), rnd(-1.2, 1.2), rnd(-2, -.5), Math.random() < .3 ? '#5fae3b' : '#8b5a2b']);
          st.blocoFora = 180;
          conquista('bloco');
          balao('bloco', T('Pegou: 1 bloco de grama.', 'Picked up: 1 grass block.'));
        } else {
          Som.play('toc');
          balao('bloco', st.bloco === 1 ? T('Toc.', 'Tok.') : T('Toc, toc…', 'Tok, tok…'), 1600);
        }
        break;
      case 'pocao':
        if (!st.pocao) { balao('pocao', T('Vazia. Recarrega sozinha, tipo cooldown.', 'Empty. It refills on its own, like a cooldown.')); break; }
        Som.play('glub');
        st.pocao = false; st.pocaoVolta = Date.now() + 20000;
        conquista('pocao');
        balao('pocao', T('Glub, glub. Vida cheia para mais um deploy.', 'Glug, glug. Full health for another deploy.'));
        break;
      case 'chapeu':
        Som.play('moeda');
        st.chapeu = !st.chapeu;
        if (st.chapeu) conquista('chapeu');
        if (window.__retrato) window.__retrato(st.chapeu);
        balao(st.chapeu ? 'vini' : 'chapeu', st.chapeu ? T('Agora sim, cara de mago.', 'Now that looks like a wizard.') : T('De volta pra estante.', 'Back on the shelf.'));
        break;
      case 'fone':
        Som.play('nota');
        for (var n = 0; n < 4; n++) st.notas.push([rnd(293, 307), 112 + n * 3, rnd(0, 6)]);
        conquista('fone');
        balao('fone', T('No fone agora: Froid.', 'Now playing: Froid.'));
        break;
      case 'lata':
        Som.play('pss');
        st.latas++; st.vapor = 20;
        conquista('lata');
        balao('lata', T('Pssst. Lata número ' + (st.latas + 1) + ' de hoje.', 'Pssst. Can number ' + (st.latas + 1) + ' today.'));
        break;
      case 'lampada':
        Som.play('clic');
        st.lampada = !st.lampada;
        conquista('lampada');
        balao('lampada', st.lampada ? T('Clic. Melhor assim.', 'Click. Better.') : T('Clic. Modo caverna.', 'Click. Cave mode.'), 2200);
        break;
      case 'pc':
        Som.play('clic');
        st.rgb = (st.rgb + 1) % RGB_MODOS.length;
        conquista('rgb');
        balao('pc', [T('RGB arco-íris: +10 FPS.', 'Rainbow RGB: +10 FPS.'), T('Coral, a cor do site.', 'Coral, the site\'s color.'), T('Verde HUD.', 'HUD green.'), T('Desligado. Lá se vão os 10 FPS.', 'Off. There go the 10 FPS.')][st.rgb], 2600);
        break;
      case 'janela':
        Som.play('blip');
        var c = canoas();
        balao('janela', T('Canoas agora: ', 'Canoas right now: ') + pad(c.h) + ':' + pad(c.m) + (clima ? ', ' + climaTxt() : '') + '.');
        break;
      case 'livros':
        Som.play('blip');
        balao('livros', T('Clean Code, SOLID e Design Patterns. O resto veio da documentação.', 'Clean Code, SOLID and Design Patterns. The rest came from the docs.'));
        break;
      case 'planta':
        Som.play('blip');
        balao('planta', T('Sobrevive a deploy de sexta.', 'Survives Friday deploys.'));
        break;
      case 'mimi':
        Som.play('purr');
        st.mimi = 30;
        var gm = GATOS.mimi; if (gm.modo === 'anda') { gm.modo = 'senta'; gm.pausa = 90; }
        for (var hm = 0; hm < 3; hm++) st.coracoes.push([gm.x + rnd(1, 10), CHAO - 18 - hm * 4]);
        conquista('mimi');
        balao('mimi', T('Mimi. Ela manda na casa. Purrr…', 'Mimi. She runs the house. Purrr…'));
        break;
      case 'lucifer':
        Som.play('miau');
        st.lucifer = 18;
        var gl = GATOS.lucifer; if (gl.modo === 'anda') { gl.modo = 'senta'; gl.pausa = 90; }
        conquista('lucifer');
        balao('lucifer', T('Lúcifer. Gato preto, olho amarelo, zero arrependimento.', 'Lucifer. Black cat, yellow eyes, zero regrets.'));
        break;
      case 'fred':
        Som.play('au');
        st.fred = 12;
        conquista('fred');
        balao('fred', T('Fred. Au! Au!', 'Fred. Woof! Woof!'));
        break;
      case 'f1':
        Som.play('f1');
        st.f1 = 20;
        conquista('box');
        balao('f1', T('McLaren MP4/4, a do Senna em 1988. Montei bloco por bloco. Box, box!', 'McLaren MP4/4, Senna\'s 1988 car. I built it brick by brick. Box, box!'));
        break;
      case 'frodo':
        Som.play('blip');
        balao('frodo', T('Frodo. Ele também saiu de casa sem saber o tamanho da jornada.', 'Frodo. He also left home not knowing how long the journey was.'));
        break;
      case 'fsenna':
        Som.play('blip');
        balao('fsenna', T('Ayrton Senna. O ídolo.', 'Ayrton Senna. The legend.'));
        break;
      case 'bottas':
        Som.play('blip');
        balao('bottas', T('Valtteri Bottas, dos tempos de Mercedes.', 'Valtteri Bottas, from his Mercedes days.'));
        break;
      case 'cortica':
        Som.play('blip');
        if (!st.postit) {
          var livres = [0, 1, 2, 3].filter(function (k) { return !(st.postitVolta > Date.now() && st.postitK === k); });
          var kk = livres[Math.floor(Math.random() * livres.length)];
          st.postit = { k: kk, x: POSTITS[kk][0], y: POSTITS[kk][1], vy: 0 };
          conquista('postit');
          balao('cortica', RECADOS[kk]);
        }
        break;
    }
  }

  var visivel = true;
  if ('IntersectionObserver' in window) new IntersectionObserver(function (es) { visivel = es[0].isIntersecting; }, { threshold: 0 }).observe(cv);
  var ultimo = 0, FPS = lento ? 1 : 12;
  function loop(ts) {
    requestAnimationFrame(loop);
    if (!visivel || document.hidden) return;
    if (ts - ultimo < 1000 / FPS) return;
    ultimo = ts;
    update();
    posiciona(BTN.racco, OBJ.racco.r); posiciona(BTN.mimi, OBJ.mimi.r); posiciona(BTN.lucifer, OBJ.lucifer.r);
    draw();
  }
  update(); draw();
  requestAnimationFrame(loop);

  $$('#legend button').forEach(function (b) {
    b.addEventListener('click', function () { age(b.getAttribute('data-obj')); });
  });

  function icone(alvo, r) {
    var off = document.createElement('canvas'); off.width = W; off.height = H;
    var salvo = g, boot = st.boot;
    g = off.getContext('2d'); st.boot = null;
    var f = 0;
    if (r === 'banditboard') celBandit(f);
    if (r === 'senna') monitorSenna(f);
    if (r === 'hud') monitorHud(f);
    if (r === 'app') celApp(f);
    if (r === 'cloud') notebook(f);
    g = salvo; st.boot = boot;
    var o = OBJ[r].r, h = r === 'senna' || r === 'hud' ? o[3] - 2 : o[3];
    alvo.width = o[2]; alvo.height = h;
    alvo.getContext('2d').drawImage(off, o[0], o[1], o[2], h, 0, 0, o[2], h);
  }
  $$('.quest-ico').forEach(function (c) { try { icone(c, c.getAttribute('data-ico')); } catch (e) {} });

  var podeHover = matchMedia('(hover: hover)').matches;
  return {
    st: st,
    gatos: GATOS,
    age: age,
    hesoyam: function () {
      st.hesoyam = true;
      Som.play('cheat');
      gta();
      conquista('hesoyam');
      balao('racco', T('Respeito +. Agora eu sou o Racco de San Andreas.', 'Respect +. I\'m the San Andreas Racco now.'));
    },
    konami: function () {
      st.parada = 300;
      Som.play('nota');
      conquista('konami');
      balao('vini', T('Chegou a família toda: Haiku, Sonnet, Opus e Fable.', 'The whole family is here: Haiku, Sonnet, Opus and Fable.'));
    },
    wave: function () { st.r.wave = 24; st.r.pausa = 40; },
    ligar: function (ligou) {
      st.boot = ligou && !lento ? Date.now() : null;
      setTimeout(function () {
        balao('vini', podeHover ? T('Oi! Passa o mouse e clica nas coisas da mesa.', 'Hi! Hover and click things on the desk.') : T('Oi! Toca nas coisas da mesa.', 'Hi! Tap things on the desk.'), 4800);
      }, ligou ? 1900 : 300);
    },
    desenhaEm: function (c, nome) {
      var salvo = g; g = c; try { if (nome === 'lata') lata(0); } finally { g = salvo; }
    },
    sprites: { POCAO: POCAO, CHAPEU: CHAPEU, BLOCO: BLOCO }
  };
})();
window.__cena = Cena;

(function () {
  var cv = $('#retrato'); if (!cv) return;
  var c = cv.getContext('2d');
  var chapeu = false, pisca = false;
  var PAL = {
    H: '#2b1a12', h: '#4d3123', S: '#efc3a2', s: '#d49c7c', E: '#e2ab8a', K: '#2b1a12', G: '#2e2a33',
    W: '#f5efe8', P: '#2a1a13', N: '#c88e6e', B: '#4a2e20', b: '#6a4433', M: '#c27a6e', n: '#e3b08f', q: '#c9937a',
    T: '#8e9fa4', t: '#73858a', j: '#a9b9bd', k: '#55646a', X: '#f2f2ee', L: '#ffffff', z: '#b98a70', Z: '#6e4a38', Y: '#8c624c'
  };
  var SP = [
    [0, 11, 21, 'H'], [1, 9, 23, 'H'], [2, 7, 25, 'H'], [3, 6, 26, 'H'], [4, 5, 27, 'H'], [5, 5, 27, 'H'], [6, 5, 27, 'H'],
    [7, 5, 8, 'H'], [7, 9, 23, 'S'], [7, 24, 27, 'H'],
    [8, 5, 7, 'H'], [8, 8, 24, 'S'], [8, 25, 27, 'H'],
    [9, 5, 7, 'H'], [9, 8, 24, 'S'], [9, 25, 27, 'H'],
    [10, 6, 7, 'H'], [10, 8, 24, 'S'], [10, 25, 26, 'H'],
    [11, 6, 7, 'H'], [11, 8, 24, 'S'], [11, 25, 26, 'H'],
    [12, 6, 7, 'H'], [12, 8, 24, 'S'], [12, 25, 26, 'H'], [12, 9, 12, 'K'], [12, 20, 23, 'K'],
    [13, 6, 6, 'E'], [13, 7, 7, 'H'], [13, 8, 24, 'S'], [13, 25, 25, 'H'], [13, 26, 26, 'E'], [13, 10, 12, 'G'], [13, 20, 22, 'G'],
    [14, 6, 6, 'E'], [14, 7, 25, 'S'], [14, 26, 26, 'E'], [14, 8, 9, 'G'], [14, 13, 19, 'G'], [14, 23, 24, 'G'],
    [15, 6, 6, 'E'], [15, 7, 25, 'S'], [15, 26, 26, 'E'], [15, 9, 9, 'G'], [15, 13, 13, 'G'], [15, 19, 19, 'G'], [15, 23, 23, 'G'], [15, 10, 12, 'W'], [15, 11, 11, 'P'], [15, 20, 22, 'W'], [15, 21, 21, 'P'],
    [16, 6, 6, 'E'], [16, 7, 25, 'S'], [16, 26, 26, 'E'], [16, 9, 9, 'G'], [16, 13, 13, 'G'], [16, 19, 19, 'G'], [16, 23, 23, 'G'], [16, 16, 16, 's'], [16, 10, 10, 'L'], [16, 20, 20, 'L'],
    [17, 7, 25, 'S'], [17, 10, 12, 'G'], [17, 20, 22, 'G'], [17, 16, 16, 's'], [17, 7, 7, 'z'], [17, 25, 25, 'z'],
    [18, 7, 8, 'Z'], [18, 9, 9, 'z'], [18, 10, 22, 'S'], [18, 23, 23, 'z'], [18, 24, 25, 'Z'], [18, 16, 16, 's'],
    [19, 7, 9, 'Z'], [19, 10, 10, 'z'], [19, 11, 21, 'S'], [19, 22, 22, 'z'], [19, 23, 25, 'Z'], [19, 15, 15, 'N'], [19, 17, 17, 'N'], [19, 16, 16, 's'], [19, 13, 13, 'z'], [19, 19, 19, 'z'],
    [20, 8, 24, 'Z'], [20, 10, 10, 'Y'], [20, 22, 22, 'Y'], [20, 15, 17, 'Y'],
    [21, 8, 24, 'Z'], [21, 13, 19, 'M'], [21, 9, 9, 'Y'], [21, 23, 23, 'Y'],
    [22, 9, 23, 'Z'], [22, 12, 12, 'Y'], [22, 16, 16, 'Y'], [22, 20, 20, 'Y'],
    [23, 10, 22, 'Z'], [23, 14, 14, 'Y'], [23, 18, 18, 'Y'],
    [24, 11, 21, 'Z'], [24, 16, 16, 'Y'],
    [25, 7, 10, 'T'], [25, 11, 12, 'n'], [25, 13, 19, 'Z'], [25, 20, 21, 'n'], [25, 22, 25, 'T'], [25, 8, 10, 'j'], [25, 22, 24, 'j'],
    [26, 5, 11, 'T'], [26, 12, 20, 'n'], [26, 13, 19, 'q'], [26, 21, 27, 'T'], [26, 6, 9, 'j'], [26, 23, 26, 'j'],
    [27, 3, 29, 'T'], [27, 11, 12, 'k'], [27, 13, 19, 'q'], [27, 20, 21, 'k'],
    [28, 2, 30, 'T'], [28, 12, 20, 'k'], [28, 11, 11, 'X'], [28, 21, 21, 'X'],
    [29, 1, 31, 'T'], [29, 14, 18, 'k'], [29, 12, 13, 't'], [29, 19, 20, 't'], [29, 4, 8, 'j'], [29, 24, 28, 'j'],
    [30, 0, 31, 'T'], [30, 15, 17, 't'],
    [31, 0, 31, 'T'], [32, 0, 31, 'T'], [33, 0, 31, 'T'],
    [30, 0, 2, 't'], [31, 0, 2, 't'], [32, 0, 2, 't'], [33, 0, 2, 't'], [30, 29, 31, 't'], [31, 29, 31, 't'], [32, 29, 31, 't'], [33, 29, 31, 't'],
    [31, 9, 9, 't'], [32, 9, 9, 't'], [33, 9, 9, 't'], [31, 23, 23, 't'], [32, 23, 23, 't'], [33, 23, 23, 't'],
    [31, 6, 8, 'k'], [31, 24, 26, 'j']
  ];
  var HL = [[1, 12], [1, 13], [2, 12], [3, 11], [4, 11], [5, 10], [6, 10], [1, 16], [2, 16], [3, 15], [4, 15], [5, 14], [6, 14], [2, 21], [3, 20], [4, 20], [5, 19], [6, 19], [3, 25], [4, 24], [5, 24], [6, 23], [3, 8], [4, 8], [5, 7], [6, 7], [7, 6], [8, 26], [9, 26], [10, 25]];
  function desenha() {
    c.clearRect(0, 0, 32, 34);
    SP.forEach(function (s) { c.fillStyle = PAL[s[3]]; c.fillRect(s[1], s[0], s[2] - s[1] + 1, 1); });
    c.fillStyle = PAL.h;
    HL.forEach(function (p) { c.fillRect(p[1], p[0], 1, 1); });
    if (pisca) { c.fillStyle = PAL.S; c.fillRect(10, 15, 3, 1); c.fillRect(20, 15, 3, 1); c.fillStyle = PAL.P; c.fillRect(10, 16, 3, 1); c.fillRect(20, 16, 3, 1); c.fillStyle = PAL.G; c.fillRect(9, 16, 1, 1); c.fillRect(13, 16, 1, 1); c.fillRect(19, 16, 1, 1); c.fillRect(23, 16, 1, 1); }
    if (chapeu) c.drawImage(CHAPEU, 5, -4);
  }
  var CHAPEU = spr([
    '..............BBB.....',
    '.............BBBB.....',
    '............BBBBB.....',
    '...........BBBYBB.....',
    '..........BBBBBBB.....',
    '.........BBBBBBBB.....',
    '........BBBBBYBBBB....',
    '.......BBBBBBBBBBB....',
    '......BBBYBBBBBBBBB...',
    '.....BBBBBBBBBBMMBB...',
    '.....BBBBBBBBBBBMBB...',
    '....BBBBBBBBBBBBBBBB..',
    'bbbbbbbbbbbbbbbbbbbbbb',
    '.bbbbbbbbbbbbbbbbbbbb.'
  ], { B: '#2f4aa8', b: '#22377f', Y: '#ffd24a', M: '#ffd24a' });
  function piscar() { pisca = true; desenha(); setTimeout(function () { pisca = false; desenha(); }, 140); }
  desenha();
  if (!lento) setInterval(piscar, 4200);
  window.__retrato = function (on) { chapeu = on; desenha(); };
  cv.parentNode.addEventListener('click', function () {
    if (achados.chapeu && Cena) { Cena.st.chapeu = !Cena.st.chapeu; chapeu = Cena.st.chapeu; desenha(); Som.play('moeda'); }
    else { piscar(); Som.play('oi'); }
  });
})();

(function () {
  var inv = $('#inv'), tip = $('#itemTip'), wrap = $('.inv-wrap');
  if (!inv) return;
  var RAR = {
    com: [T('Comum', 'Common'), 'var(--r-com)'], mag: [T('Mágico', 'Magic'), 'var(--r-mag)'], rar: [T('Raro', 'Rare'), 'var(--r-rar)'],
    len: [T('Lendário', 'Legendary'), 'var(--r-len)'], rel: [T('Relíquia', 'Relic'), 'var(--r-rel)'], con: [T('Consumível', 'Consumable'), 'var(--r-con)']
  };
  var ITENS = [
    ['C#', 'len', T('Arma principal', 'Main weapon'), T('Equipada desde 2020. Backend, desktop, web e mobile.', 'Equipped since 2020. Backend, desktop, web and mobile.'), T('“Do suporte ao Pleno III com a mesma espada.”', '“From support to mid-level III with the same sword.”')],
    ['.NET', 'len', T('Armadura', 'Armor'), T('Do .NET 7 ao 10: ASP.NET Core, EF Core, Dapper, Hangfire, WCF.', '.NET 7 through 10: ASP.NET Core, EF Core, Dapper, Hangfire, WCF.')],
    ['ABP', 'rar', T('Escudo', 'Shield'), T('ABP Framework com DDD, multitenancy e OpenIddict na plataforma Cloud.', 'ABP Framework with DDD, multitenancy and OpenIddict on the Cloud platform.')],
    ['Blazor', 'rar', T('Cajado', 'Staff'), T('Server e WebAssembly. Levei o front para WASM: de 39 MB para 16 MB.', 'Server and WebAssembly. Moved the front end to WASM: 39 MB down to 16 MB.')],
    ['MAUI', 'rar', T('Amuleto', 'Amulet'), T('App de ponto na Google Play, na App Store e na Microsoft Store.', 'Time clock app on Google Play, the App Store and the Microsoft Store.')],
    ['PG', 'mag', T('Anel', 'Ring'), T('PostgreSQL na plataforma Cloud.', 'PostgreSQL on the Cloud platform.')],
    ['SQL', 'mag', T('Anel', 'Ring'), T('SQL Server, T-SQL, views e procedures no legado.', 'SQL Server, T-SQL, views and procedures in the legacy system.')],
    ['Azure', 'mag', T('Capa', 'Cloak'), T('App Service, Blob Storage, AI Vision Face, Maps e Application Insights.', 'App Service, Blob Storage, AI Vision Face, Maps and Application Insights.')],
    ['GHA', 'mag', T('Botas', 'Boots'), T('GitHub Actions: deploy no Azure e publicação nas lojas, sozinho.', 'GitHub Actions: Azure deploys and store releases, hands off.'), T('“+50% de velocidade de deploy.”', '“+50% deploy speed.”')],
    ['xUnit', 'mag', T('Elmo', 'Helm'), T('xUnit, bUnit e Playwright: uns 70 arquivos de teste que rodam a cada deploy.', 'xUnit, bUnit and Playwright: about 70 test files that run on every deploy.')],
    ['SigR', 'mag', T('Luvas', 'Gloves'), T('SignalR e Redis para tempo real, Hangfire para tarefas em segundo plano.', 'SignalR and Redis for real time, Hangfire for background jobs.')],
    ['Kotlin', 'rar', T('Arco', 'Bow'), T('Jetpack Compose e Compose Desktop no Banditboard.', 'Jetpack Compose and Compose Desktop in Banditboard.')],
    ['WinUI', 'com', T('Adaga', 'Dagger'), T('WinUI 3 no Senna v2 e WPF no ControlSensors.', 'WinUI 3 in Senna v2 and WPF in ControlSensors.')],
    ['Py', 'com', T('Pergaminho', 'Scroll'), T('O Senna v1 e as automações do dia a dia.', 'Senna v1 and everyday automations.')],
    ['VB', 'rel', T('Relíquia antiga', 'Ancient relic'), T('VB.NET e leitura de VB6: levei as regras do legado para .NET.', 'VB.NET and reading VB6: moved the legacy rules to .NET.'), T('“Ninguém mais sabe ler isto. Eu sei.”', '“Nobody can read this anymore. I can.”')],
    ['AI', 'mag', T('Familiar', 'Familiar'), T('Desenvolvimento com IA, com o Claude Code do lado todo dia.', 'AI-assisted development, with Claude Code by my side every day.'), T('“O Racco fica de olho no limite.”', '“Racco keeps an eye on the limit.”')],
    ['lata', 'con', T('Consumível', 'Consumable'), T('Energético. +foco por duas horas.', 'Energy drink. +focus for two hours.'), T('“Efeito colateral: mais um projeto pessoal.”', '“Side effect: one more side project.”')],
    ['pocao', 'con', T('Consumível', 'Consumable'), T('Poção de vida. Usar antes de deploy na sexta.', 'Health potion. Use before a Friday deploy.')]
  ];
  inv.innerHTML = ITENS.map(function (it, i) {
    var r = RAR[it[1]];
    var nome = it[0] === 'lata' ? T('Energético', 'Energy drink') : it[0] === 'pocao' ? T('Poção de vida', 'Health potion') : it[0];
    var inner = (it[0] === 'lata' || it[0] === 'pocao') ? '<canvas data-i="' + it[0] + '" aria-hidden="true"></canvas>' : '<b>' + esc(it[0]) + '</b>';
    return '<button type="button" class="slot" style="--rc:' + r[1] + '" data-i="' + i + '" aria-label="' + esc(nome + ', ' + r[0]) + '">' + inner + '</button>';
  }).join('');
  $$('canvas[data-i]', inv).forEach(function (c) {
    var k = c.getAttribute('data-i');
    if (k === 'pocao' && Cena) { c.width = 9; c.height = 11; c.getContext('2d').drawImage(Cena.sprites.POCAO, 0, 0); }
    if (k === 'lata' && Cena) { c.width = 6; c.height = 11; var x = c.getContext('2d'); x.translate(-238, -110); Cena.desenhaEm(x, 'lata'); }
    c.style.width = '34%';
  });
  var aberto = null;
  function mostra(btn) {
    var it = ITENS[+btn.getAttribute('data-i')], r = RAR[it[1]];
    var nome = it[0] === 'lata' ? T('Energético', 'Energy drink') : it[0] === 'pocao' ? T('Poção de vida', 'Health potion') : it[0];
    tip.style.setProperty('--rc', r[1]);
    tip.innerHTML = '<div class="it-n">' + esc(nome) + '</div><div class="it-t">' + esc(r[0] + ' · ' + it[2]) + '</div><div class="it-d">' + esc(it[3]) + '</div>' + (it[4] ? '<div class="it-f">' + esc(it[4]) + '</div>' : '');
    tip.hidden = false;
    var wb = wrap.getBoundingClientRect(), bb = btn.getBoundingClientRect();
    var left = bb.left - wb.left + bb.width / 2 - tip.offsetWidth / 2;
    left = Math.max(0, Math.min(wb.width - tip.offsetWidth, left));
    var top = bb.top - wb.top - tip.offsetHeight - 12;
    if (top < 0) top = bb.bottom - wb.top + 12;
    tip.style.left = left + 'px'; tip.style.top = top + 'px';
    $$('.slot', inv).forEach(function (s) { s.removeAttribute('data-on'); });
    btn.setAttribute('data-on', '');
    aberto = btn;
  }
  function esconde() { tip.hidden = true; if (aberto) aberto.removeAttribute('data-on'); aberto = null; }
  inv.addEventListener('pointerover', function (e) { var b = e.target.closest('.slot'); if (b && e.pointerType === 'mouse') { mostra(b); Som.play('tecla'); } });
  inv.addEventListener('pointerleave', function (e) { if (e.pointerType === 'mouse') esconde(); });
  inv.addEventListener('focusin', function (e) { var b = e.target.closest('.slot'); if (b) mostra(b); });
  inv.addEventListener('focusout', esconde);
  inv.addEventListener('click', function (e) { var b = e.target.closest('.slot'); if (!b) return; if (aberto === b) esconde(); else mostra(b); });
  document.addEventListener('pointerdown', function (e) { if (aberto && !e.target.closest('.inv')) esconde(); });
})();

(function () {
  var rows = $('#cbRows'), masc = $('#cbMascots'), falaEl = $('#cbFala'), cenas = $('#cbCenas');
  if (!rows || !masc) return;
  var MODELS = ['Haiku', 'Sonnet', 'Opus', 'Fable'];
  var POR = { Haiku: 'SPROUT', Sonnet: 'HEADPHONES', Opus: 'GLASSES', Fable: 'TOP_HAT' };
  var CENAS = {
    normal: { p5: 37, p7: 64, pf: 22, fala: T('Dia normal: piscam, olham para os lados, mexem as patas e acenam.', 'Normal day: they blink, look around, shuffle and wave.') },
    dormindo: { p5: 0, p7: 64, pf: 22, fala: T('Sessão de 5 horas zerada: todo mundo dormindo.', '5-hour session at zero: everyone is asleep.') },
    suando: { p5: 40, p7: 88, pf: 30, fala: T('A partir de 85% eles suam e ficam agitados.', 'From 85% on they sweat and get restless.') },
    vermelho: { p5: 40, p7: 97, pf: 30, fala: T('Acima de 90% vão ficando vermelhos, e de 95% em diante tremem.', 'Above 90% they turn red, and from 95% on they shake.') },
    esgotado: { p5: 40, p7: 100, pf: 30, fala: T('Limite geral em 100%: estouram e ficam chamuscados.', 'Overall limit at 100%: they burst and get singed.') },
    fable: { p5: 40, p7: 60, pf: 100, fala: T('O Fable tem limite próprio: em 100%, só ele esgota.', 'Fable has its own limit: at 100%, only it runs out.') }
  };
  var cena = 'normal';
  function level(p) { return p >= 85 ? '#e5604d' : p >= 60 ? '#f0a83c' : '#8fb573'; }
  function mix(a, b, t) {
    var x = [1, 3, 5].map(function (i) { return parseInt(a.slice(i, i + 2), 16); });
    var y = [1, 3, 5].map(function (i) { return parseInt(b.slice(i, i + 2), 16); });
    return '#' + x.map(function (v, i) { return pad(Math.round(v + (y[i] - v) * t).toString(16)); }).join('');
  }
  function feel(c, m) {
    var own = m === 'Fable' ? c.pf : null;
    var worst = Math.max(c.p5, c.p7, own == null ? 0 : own);
    var heat = Math.min(1, Math.max(0, (worst - 90) / 10));
    var mood = worst >= 99.5 ? 'out' : worst >= 85 ? 'sweaty' : c.p5 < .5 ? 'sleepy' : 'normal';
    return { mood: mood, heat: heat, pct: own == null ? c.p7 : own, own: own != null };
  }
  function svg(m, f, i) {
    var out = f.mood === 'out', sleepy = f.mood === 'sleepy', sweaty = f.mood === 'sweaty';
    var heat = out ? 0 : f.heat, base = '#a39b90';
    var body = out ? '#4e3530' : heat > 0 ? mix(base, '#ff3b2f', heat) : base;
    var fur = out ? '#6e5a52' : heat > 0 ? mix('#eee7db', '#ffb0a3', heat) : '#eee7db';
    var mask = out ? '#2a1f1c' : '#4a413b';
    var paint = { B: body, L: fur, M: mask, N: '#0c0a08' };
    function r(x, y, w, h, extra) { return '<rect x="' + x + '" y="' + y + '" width="' + (w + .04) + '" height="' + (h + .04) + '"' + (extra || '') + '/>'; }
    var torso = '', armL = '', armR = '', legA = '', legB = '';
    RACCO.forEach(function (row, y) {
      row.split('').forEach(function (ch, x) {
        if (ch === '.') return;
        var cell = r(x, y, 1, 1, ' fill="' + paint[ch] + '"');
        if (y >= 12) { if (x === 3 || x === 10) legA += cell; else legB += cell; }
        else if (y >= 8 && y <= 9 && x <= 1) armL += cell;
        else if (y >= 8 && y <= 9 && x >= 14) armR += cell;
        else torso += cell;
      });
    });
    var arms = i % 2 ? armL + '<g class="arm">' + armR + '</g>' : '<g class="arm">' + armL + '</g>' + armR;
    var eyes;
    if (out) eyes = [4, 11].map(function (c) { return '<path d="M' + (c - .45) + ' 6.05L' + (c + 1.45) + ' 7.95M' + (c - .45) + ' 7.95L' + (c + 1.45) + ' 6.05" stroke="#d8cfc2" stroke-width=".45" fill="none" shape-rendering="geometricPrecision"/>'; }).join('');
    else if (sleepy) eyes = [4, 11].map(function (c) { return r(c, 7.6, 1, .4, ' fill="#f3efea"'); }).join('');
    else eyes = '<g class="eyes">' + [4, 11].map(function (c) { return r(c, 6, 1, 2, ' fill="#f3efea"') + '<g class="lid">' + r(c, 6, 1, 2, ' fill="' + mask + '"') + r(c, 7.6, 1, .4, ' fill="#f3efea"') + '</g>'; }).join('') + '</g>';
    var acc = (ACC[POR[m]] || []).map(function (a) { return r(a[0], a[1], a[2], a[3], ' fill="' + a[4] + '"'); }).join('');
    var legs = '<g class="la">' + legA + '</g><g class="lb">' + legB + '</g>';
    var extra = '';
    if (sweaty) extra += r(15, 3, 1, 2, ' class="drop" fill="#8fd3f4"');
    if (sleepy) extra += '<g class="z" fill="#a89a86">' + r(13, 0, 3, 1) + r(15, 1, 1, 1) + r(14, 2, 1, 1) + r(13, 3, 3, 1) + '</g>';
    if (out) extra += '<g class="smoke" fill="#8a8078">' + r(7, 3, 1, 1) + r(8, 2, 1, 1, ' opacity=".6"') + '</g>';
    var cls = ['cl', sleepy && 'sleepy', heat > 0 && 'hot', heat >= .5 && 'shake', POR[m] === 'GLASSES' && 'nolook', out && 'dead'].filter(Boolean).join(' ');
    var style = '--d:' + (-(i * 2.3 + .7)).toFixed(1) + 's;--lx:' + (i % 2 ? -1 : 1) + 'px';
    return '<svg class="' + cls + '" style="' + style + '" viewBox="0 0 16 14" fill="' + body + '" shape-rendering="crispEdges" aria-hidden="true"><g class="all"><g class="bod">' + torso + arms + eyes + acc + '</g>' + legs + extra + '</g></svg>';
  }
  function row(nome, p, resta) {
    return '<div class="cb-row"><b>' + nome + '</b><span class="pct" style="color:' + level(p) + '">' + Math.round(p) + '%</span><div class="cb-bar"><i style="width:' + Math.min(100, p) + '%;background:' + level(p) + '"></i></div><span class="left">' + resta + '</span></div>';
  }
  function render() {
    var c = CENAS[cena];
    rows.innerHTML = row(T('Sessão', 'Session'), c.p5, c.p5 < .5 ? '5h 00m' : '2h 12m') + row(T('Semana', 'Week'), c.p7, '3d 4h');
    masc.innerHTML = MODELS.map(function (m, i) {
      var f = feel(c, m), out = f.mood === 'out';
      var cor = f.own ? level(f.pct) : '#a89a86', barra = f.own ? level(f.pct) : 'rgba(168,154,134,.55)';
      return '<div class="cb-m"><div class="mp" style="color:' + cor + '">' + Math.round(f.pct) + '%</div><div class="mb"><i style="width:' + Math.min(100, f.pct) + '%;background:' + barra + '"></i></div>' + svg(m, f, i) + '<div class="mn" style="color:' + (out ? '#e5604d' : '#ece3d6') + '">' + m + '</div><div class="ms">' + (out ? T('esgotado', 'out') : '&nbsp;') + '</div></div>';
    }).join('');
    falaEl.textContent = c.fala;
  }
  cenas.addEventListener('click', function (e) {
    var b = e.target.closest('[data-cena]'); if (!b) return;
    $$('[data-cena]', cenas).forEach(function (x) { x.removeAttribute('data-ativo'); });
    b.setAttribute('data-ativo', '1');
    cena = b.getAttribute('data-cena');
    Som.play('blip');
    render();
  });
  render();
})();

(function () {
  var win = $('#sennaWin');
  if (!win) return;
  function q(s) { return $(s, win); }
  function ic(d) { return '<svg viewBox="0 0 24 24" aria-hidden="true">' + d + '</svg>'; }
  function hhmm(m) { m = ((m % 1440) + 1440) % 1440; return pad(Math.floor(m / 60)) + ':' + pad(m % 60); }
  function dur(x) { var h = Math.floor(x / 60), m = x % 60; return h ? h + ' h ' + pad(m) : m + ' min'; }
  var MONO = '"Cascadia Mono","Cascadia Code",Consolas,ui-monospace,monospace', SANS = '"Segoe UI Variable Text","Segoe UI",system-ui,-apple-system,sans-serif';
  var I = {
    home: '<path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10v10h13V10"/><path d="M10 20v-5h4v5"/>',
    mem: '<path d="M4.5 4h4v16h-4zM10 4h4v16h-4z"/><path d="m15.6 5.3 3.9-1 3.6 15.4-3.9 1z"/>',
    trab: '<path d="M12 3.5 21 8l-9 4.5L3 8z"/><path d="m3 12.5 9 4.5 9-4.5M3 16.5 12 21l9-4.5"/>',
    avisos: '<path d="M3 12h4l2.5-7 5 14 2.5-7h4"/>',
    ajustes: '<circle cx="12" cy="12" r="3.2"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/>',
    sino: '<path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 1.5h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>',
    sol: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3 7 7M17 17l1.7 1.7M5.3 18.7 7 17M17 7l1.7-1.7"/>',
    nuvem: '<path d="M7 18h10a4 4 0 0 0 .4-8A6 6 0 0 0 6 11a3.5 3.5 0 0 0 1 7z"/>',
    chuva: '<path d="M7 14.5h10a4 4 0 0 0 .4-8A6 6 0 0 0 6 7.5a3.5 3.5 0 0 0 1 7z"/><path d="m8.5 18-1 2.5M12.5 18l-1 2.5M16.5 18l-1 2.5"/>',
    lua: '<path d="M19 14.5A7.5 7.5 0 0 1 9.5 5a7.5 7.5 0 1 0 9.5 9.5z"/>'
  };

  var OCULTO = T('nome oculto na demo', 'name hidden in the demo');
  var REPOS = [['senna', 'Senna'], ['clima', 'Canoas', 'clima'], ['band', 'Banditboard'], ['trab', T('trabalho', 'work')], ['port', 'portfolio-apps'], ['agenda', T('agenda', 'calendar'), 'agenda'], ['hud', 'ControlSensors'], ['perfil', 'suiciniv-dev']];
  var NOTAS = {
    senna: [T('decisão · C# com WinUI 3', 'decision · C# with WinUI 3'), T('decisão · avisos só do que importa', 'decision · alerts only for what matters'), T('descoberta · chat grande com cache frio sai caro', 'finding · a huge chat on a cold cache is expensive'), T('decisão · um handoff por branch', 'decision · one handoff per branch'), T('descoberta · texto com cara de ordem é selado', 'finding · text that looks like an order gets sealed'), T('decisão · memória em SQLite', 'decision · memory in SQLite'), T('descoberta · o mapa precisa de âncoras', 'finding · the map needs anchors'), T('handoff · mapa com zoom', 'handoff · map with zoom')],
    band: [T('decisão · sem token no celular', 'decision · no token on the phone'), T('decisão · paridade entre plataformas', 'decision · platform parity'), T('decisão · issues em português', 'decision · issues in Portuguese'), T('decisão · o Racco sua perto do limite', 'decision · Racco sweats near the limit'), T('handoff · release 1.17', 'handoff · release 1.17')],
    port: [T('handoff · main', 'handoff · main'), T('descoberta · a Pixelify fazia o C parecer O', 'finding · Pixelify made the C look like an O'), T('descoberta · String.replace e o $\'', 'finding · String.replace and $\''), T('decisão · Fred é só Fred', 'decision · Fred is just Fred'), T('decisão · projetos são do tempo livre', 'decision · side projects are free time'), T('descoberta · Raccos quentes saíam do celular', 'finding · hot Raccos escaped the phone')],
    hud: [T('decisão · código aberto', 'decision · open source'), T('descoberta · cada placa chama o sensor de um jeito', 'finding · every board names its sensors differently')],
    perfil: [T('decisão · README em inglês com bloco em PT', 'decision · README in English with a PT block'), T('decisão · capa animada', 'decision · animated cover'), T('descoberta · o GIF da mesa cabe em 96 quadros', 'finding · the desk GIF fits in 96 frames')]
  };
  var ESPERA0 = [
    { id: 'e1', repo: 'trab', t: T('PR do time para revisar', 'Team PR to review'), s: T('trabalho · ', 'work · ') + OCULTO },
    { id: 'e2', repo: 'hud', t: T('Bump actions/checkout de 4 para 5', 'Bump actions/checkout from 4 to 5'), s: 'ControlSensors · dependabot' }
  ];
  var ESPERA_NOVO = { id: 'e3', repo: 'band', t: T('Bump actions/setup-java de 4 para 5', 'Bump actions/setup-java from 4 to 5'), s: 'Banditboard · dependabot' };
  var PRS0 = [
    { id: 'p1', repo: 'band', t: T('Resumo de cota do Antigravity', 'Antigravity quota summary'), s: 'Banditboard', st: 'ok' },
    { id: 'p2', repo: 'senna', t: T('Mapa com zoom e foco', 'Map with zoom and focus'), s: 'Senna', st: '' },
    { id: 'p3', repo: 'port', t: T('Cursor em pixel art', 'Pixel art cursor'), s: 'portfolio-apps', st: 'draft' },
    { id: 'p4', repo: 'trab', t: T('PR seu no trabalho', 'Your PR at work'), s: T('trabalho · ', 'work · ') + OCULTO, st: 'ok' }
  ];
  var ISS0 = [
    { id: 'i2', repo: 'hud', t: T('Mostrar a temperatura do SSD', 'Show the SSD temperature'), s: 'ControlSensors' },
    { id: 'i3', repo: 'trab', t: T('Issue do trabalho', 'Work issue'), s: T('trabalho · ', 'work · ') + OCULTO }
  ];
  var ISS_NOVA = { id: 'i1', repo: 'band', t: T('Widget do Windows com tema claro', 'Light theme for the Windows widget'), s: 'Banditboard' };
  var AG = [[540, 'Daily'], [960, T('Planejamento', 'Planning')]];
  var DIAS = T(['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'], ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']);
  var EV = [
    [537, 'reuniao', T('Reunião em 3 minutos', 'Meeting in 3 minutes'), T('Daily do time. O link está no Teams.', 'Team daily. The link is in Teams.')],
    [582, 'pr', T('PR para revisar', 'PR to review'), T('O dependabot abriu um PR no Banditboard.', 'Dependabot opened a PR on Banditboard.'), function () { add('espera', ESPERA_NOVO); }],
    [672, 'merge', T('Merge feito', 'Merged'), T('Resumo de cota do Antigravity entrou na main.', 'Antigravity quota summary is in main.'), function () { del('prs', 'p1'); }],
    [801, 'issue', T('Issue nova', 'New issue'), T('Widget do Windows com tema claro, no Banditboard.', 'Light theme for the Windows widget, on Banditboard.'), function () { add('iss', ISS_NOVA); }],
    [870, 'chuva', T('Vai chover', 'Rain ahead'), T('Chuva às 17h em Canoas. Leva o guarda-chuva.', 'Rain at 5 PM in Canoas. Take an umbrella.'), function () { S.chuva = 82; }],
    [957, 'reuniao', T('Reunião em 3 minutos', 'Meeting in 3 minutes'), T('Planejamento. O link está no Teams.', 'Planning. The link is in Teams.')],
    [966, 'limite', T('Limite do Claude', 'Claude limit'), T('85% da semana usada. Libera quinta às 9h.', '85% of the week used. Resets Thursday at 9 AM.'), function () { S.semana = 85; }],
    [1080, 'lembrete', T('Lembrete', 'Reminder'), T('Bater o ponto. O app está logo ali embaixo.', 'Clock out. The app is right below.'), null, '#app']
  ];
  var TIPOS = [['pr', T('PR para revisar', 'PR to review')], ['issue', T('Issue nova', 'New issue')], ['merge', 'Merge'], ['reuniao', T('Reunião', 'Meeting')], ['lembrete', T('Lembrete', 'Reminder')], ['chuva', T('Chuva', 'Rain')], ['limite', T('Limite do Claude', 'Claude limit')]];
  var FONTES = [['GitHub', 3], [T('Calendário do Teams', 'Teams calendar'), 7], ['Open-Meteo', 11], ['E-mail', 5], ['Claude Code', 1]];
  var MEM = [
    ['hand', 'Handoff: main', 'portfolio-apps', T('hoje', 'today'), T('Mesa publicada. Próximo passo: deixar o Senna e o Cloud interativos e trocar o cursor por um em pixel art.', 'Desk published. Next step: make Senna and the Cloud interactive and swap the cursor for a pixel art one.')],
    ['dec', T('Por que C#', 'Why C#'), 'Senna', T('há 1 semana', '1 week ago'), T('Com WinUI 3 ele abre na hora, fica leve e fala direto com os avisos do Windows.', 'With WinUI 3 it opens instantly, stays light and talks straight to Windows notifications.')],
    ['des', T('Retomar chat grande custa caro', 'Resuming a huge chat is expensive'), 'Senna', T('há 6 dias', '6 days ago'), T('Com o cache frio, reabrir uma conversa enorme sai caro antes da primeira pergunta. Um handoff curto deixa o chat novo começar sabendo onde parou.', 'On a cold cache, reopening a huge conversation costs a lot before the first question. A short handoff lets a new chat start knowing where things stopped.')],
    ['dec', T('Sem token no celular', 'No token on the phone'), 'Banditboard', T('há 2 semanas', '2 weeks ago'), T('O celular nunca vê o token. Um hook no PC lê o uso e manda só o resumo, cifrado.', 'The phone never sees the token. A hook on the PC reads the usage and sends only the summary, encrypted.')],
    ['des', T('A Pixelify fazia o C parecer O', 'Pixelify made the C look like an O'), 'portfolio-apps', T('ontem', 'yesterday'), T('No título, "C#" virava "O#". Troquei pela Jersey 10.', 'In the title, "C#" turned into "O#". I switched to Jersey 10.')],
    ['dec', T('Avisos só do que importa', 'Alerts only for what matters'), 'Senna', T('há 1 semana', '1 week ago'), T('PR para revisar, merge, reunião, chuva e limite do Claude. O resto fica no painel, calado.', 'PR to review, merge, meeting, rain and Claude limit. The rest stays on the dashboard, quietly.')],
    ['des', T('String.replace e o $\'', 'String.replace and $\''), 'portfolio-apps', T('ontem', 'yesterday'), T('No texto de troca do JavaScript, $\' e $$ viram padrões. Para injetar código, split e join.', 'In a JavaScript replacement string, $\' and $$ are patterns. To inject code, use split and join.')],
    ['dec', T('Paridade entre plataformas', 'Platform parity'), 'Banditboard', T('há 3 semanas', '3 weeks ago'), T('Antes de publicar, conferir que cada plataforma tem as novidades da versão.', 'Before publishing, check that every platform has the release\'s new features.')],
    ['dec', T('Fred é só Fred', 'Fred is just Fred'), 'portfolio-apps', T('ontem', 'yesterday'), T('O cachorro debaixo da mesa não precisa de raça na legenda.', 'The dog under the desk doesn\'t need a breed in the caption.')]
  ];
  var TIPO_N = { dec: T('decisão', 'decision'), des: T('descoberta', 'finding'), hand: 'handoff' };
  var FIL = [['', T('tudo', 'all')], ['dec', T('decisões', 'decisions')], ['des', T('descobertas', 'findings')], ['hand', 'handoffs']];
  var SIDE = [['home', T('Início', 'Home')], ['mem', T('Memória', 'Memory')], ['trab', T('Trabalho', 'Work')], ['avisos', T('Avisos', 'Alerts')], ['ajustes', T('Ajustes', 'Settings')]];

  var S, on = {}, tela = 'home', memF = '', memAberto = -1;
  TIPOS.forEach(function (t) { on[t[0]] = true; });
  function novo() { S = { min: 510, espera: ESPERA0.slice(), prs: PRS0.slice(), iss: ISS0.slice(), chuva: 20, semana: 64, ev: 0, avisos: [], nao: 0, atual: 510 }; }
  function nomeRepo(id) { for (var i = 0; i < REPOS.length; i++) if (REPOS[i][0] === id) return REPOS[i][1]; return id; }

  function lbl(t, cls, extra) { return '<div class="sw-lbl' + (cls ? ' ' + cls : '') + '">' + t + (extra || '') + '</div>'; }
  function vHome() {
    return '<section class="sw-view" data-tela="home">' +
      '<div class="sw-grid" id="swGrid">' +
        '<div class="sw-card sw-map">' + lbl(T('MAPA', 'MAP'), '', ' <span id="swMapa"></span>') +
          '<canvas id="swGrafo" role="img" aria-label="' + T('Mapa de nós: repositórios, agenda, clima e anotações em volta do Senna', 'Node map: repositories, calendar, weather and notes around Senna') + '"></canvas>' +
          '<div class="sw-tip" id="swTip" hidden></div>' +
          '<div class="sw-zoom"><button type="button" data-z="1" aria-label="' + T('Aproximar', 'Zoom in') + '">+</button><button type="button" data-z="-1" aria-label="' + T('Afastar', 'Zoom out') + '">−</button><button type="button" data-z="0" aria-label="' + T('Enquadrar', 'Fit') + '">⊡</button><button type="button" data-z="2" aria-label="' + T('Mapa grande', 'Large map') + '">⤢</button></div>' +
          '<div class="sw-leg"><span><i class="k-repo"></i>' + T('repositório', 'repository') + '</span><span><i class="k-espera"></i>' + T('esperando você', 'waiting on you') + '</span><span><i class="k-pr"></i>' + T('PR seu', 'your PR') + '</span><span><i class="k-issue"></i>issue</span><span><i class="k-nota"></i>' + T('anotação', 'note') + '</span><span><i class="k-evento"></i>' + T('compromisso', 'event') + '</span></div>' +
        '</div>' +
        '<div class="sw-col">' +
          '<div class="sw-card sw-next">' + lbl(T('PRÓXIMO', 'NEXT')) + '<b class="sw-big" id="swNxH"></b><p id="swNxT"></p><small id="swNxS"></small></div>' +
          '<div class="sw-card sw-wait">' + lbl(T('ESPERANDO VOCÊ', 'WAITING ON YOU')) + '<div class="sw-wn"><b id="swWn"></b><span>' + T('PRs para revisar', 'PRs to review') + '</span></div><ol class="sw-ls" id="swWl"></ol></div>' +
        '</div>' +
      '</div>' +
      '<div class="sw-tiles"><div><b id="swK1"></b><span>' + T('PRS SEUS', 'YOUR PRS') + '</span></div><div><b id="swK2"></b><span>' + T('ISSUES · +1 FEITA', 'ISSUES · +1 DONE') + '</span></div><div><b id="swK3"></b><span>' + T('AGORA', 'NOW') + '</span></div><div class="az"><b id="swK4"></b><span>' + T('CHUVA', 'RAIN') + '</span></div><div class="lv"><b>1</b><span>E-MAILS</span></div></div>' +
      '<div class="sw-cards">' +
        '<div class="sw-card">' + lbl(T('CLIMA', 'WEATHER'), 'az') + '<div class="sw-cl"><b id="swCt"></b><div><span id="swCd"></span><small>Canoas</small></div></div><div class="sw-mm"><span id="swCmin"></span><span id="swCmax"></span></div><div class="sw-bar t"><i id="swCtb"></i></div><div class="sw-mm"><span>' + T('CHUVA', 'RAIN') + '</span><span id="swCp"></span></div><div class="sw-bar b"><i id="swCpb"></i></div><div class="sw-hs" id="swCh"></div></div>' +
        '<div class="sw-card">' + lbl(T('MEUS PRS', 'MY PRS'), '', ' <em id="swPn"></em>') + '<ol class="sw-ls" id="swPl"></ol></div>' +
        '<div class="sw-card">' + lbl(T('COMPROMISSOS', 'CALENDAR'), 'vd') + '<ul class="sw-ag" id="swAg"></ul></div>' +
        '<div class="sw-card">' + lbl(T('LIMITE DO CLAUDE', 'CLAUDE LIMIT'), 'co') + '<div class="sw-mm"><span>' + T('SESSÃO', 'SESSION') + '</span><b id="swL1"></b></div><div class="sw-bar c"><i id="swL1b"></i></div><div class="sw-mm"><span>' + T('SEMANA', 'WEEK') + '</span><b id="swL2"></b></div><div class="sw-bar a"><i id="swL2b"></i></div><small class="sw-fine">' + T('libera qui · 09:00', 'resets Thu · 09:00') + '</small></div>' +
      '</div>' +
    '</section>';
  }
  function vMem() {
    return '<section class="sw-view" data-tela="mem" hidden><div class="sw-card sw-memc">' + lbl(T('MEMÓRIA', 'MEMORY'), '', ' <span>' + T('100 doc · 506 trechos · 13 projetos', '100 docs · 506 chunks · 13 projects') + '</span>') +
      '<input type="search" class="sw-q" id="swQ" placeholder="' + T('buscar na memória…', 'search memory…') + '" autocomplete="off" spellcheck="false" aria-label="' + T('Buscar na memória', 'Search memory') + '">' +
      '<div class="sw-fil" role="group" aria-label="' + T('Tipo', 'Type') + '">' + FIL.map(function (f) { return '<button type="button" data-f="' + f[0] + '" aria-pressed="' + (f[0] === memF) + '">' + f[1] + '</button>'; }).join('') + '</div>' +
      '<ul class="sw-mem" id="swMl"></ul></div></section>';
  }
  function vTrab() {
    return '<section class="sw-view" data-tela="trab" hidden><div class="sw-two">' +
      '<div class="sw-card">' + lbl(T('MEUS PRS', 'MY PRS'), '', ' <em id="swPn2"></em>') + '<ol class="sw-ls" id="swPl2"></ol></div>' +
      '<div class="sw-card">' + lbl(T('MINHAS ISSUES', 'MY ISSUES'), '', ' <em id="swIn"></em>') + '<ol class="sw-ls" id="swIl"></ol>' +
        '<details class="sw-det"><summary>' + T('1 issue já feita esperando fechar', '1 issue done, waiting to be closed') + '</summary><p>' + T('Clima no painel do HUD · ControlSensors', 'Weather on the HUD panel · ControlSensors') + '</p></details></div>' +
    '</div></section>';
  }
  function vAvisos() {
    return '<section class="sw-view" data-tela="avisos" hidden><div class="sw-card">' + lbl(T('AVISOS DE HOJE', 'TODAY\'S ALERTS')) + '<ul class="sw-av" id="swAv"></ul></div></section>';
  }
  function vAjustes() {
    return '<section class="sw-view" data-tela="ajustes" hidden><div class="sw-two">' +
      '<div class="sw-card">' + lbl(T('AVISOS DO WINDOWS', 'WINDOWS ALERTS')) + '<ul class="sw-tg" id="swTg"></ul><small class="sw-fine">' + T('Desligado, o painel continua atualizando. Ele só não avisa.', 'When off, the dashboard keeps updating. It just doesn\'t tell you.') + '</small></div>' +
      '<div class="sw-card">' + lbl(T('FONTES', 'SOURCES')) + '<ul class="sw-fo" id="swFo"></ul></div>' +
    '</div></section>';
  }

  win.innerHTML =
    '<div class="sw-top">' +
      '<span class="sw-logo"><i></i>SENNA</span><span class="sw-hi" id="swHi"></span><span class="sw-sp"></span>' +
      '<span class="sw-src"><i></i><span id="swSrc">' + T('fontes em dia', 'sources up to date') + '</span><span class="sw-dot">·</span><b id="swHora"></b></span>' +
      '<button type="button" class="sw-find" data-v="mem" data-busca>' + T('buscar', 'search') + '<kbd>ctrl+k</kbd></button>' +
      '<button type="button" class="sw-bell" data-v="avisos" aria-label="' + T('Avisos', 'Alerts') + '">' + ic(I.sino) + '<em id="swNao" hidden></em></button>' +
      '<button type="button" class="sw-upd" id="swUpd">' + T('ATUALIZAR', 'REFRESH') + '</button>' +
      '<span class="sw-ctl"><button type="button" data-ctl aria-label="' + T('Minimizar', 'Minimize') + '">—</button><button type="button" data-ctl aria-label="' + T('Maximizar', 'Maximize') + '">▢</button><button type="button" data-ctl aria-label="' + T('Fechar', 'Close') + '">✕</button></span>' +
    '</div>' +
    '<div class="sw-body">' +
      '<nav class="sw-side" aria-label="' + T('Telas do Senna', 'Senna screens') + '">' + SIDE.map(function (s) { return '<button type="button" data-v="' + s[0] + '" aria-label="' + s[1] + '" title="' + s[1] + '">' + ic(I[s[0]]) + '</button>'; }).join('') + '</nav>' +
      '<div class="sw-main" id="swMain">' + vHome() + vMem() + vTrab() + vAvisos() + vAjustes() + '</div>' +
    '</div>' +
    '<div class="sw-toasts" id="swToasts" aria-live="polite"></div>';

  var cv = q('#swGrafo'), gx = cv.getContext('2d'), tip = q('#swTip');
  var W = 0, H = 0, DPR = 1, nodes = [], byId = {}, edges = [], cam = { x: 0, y: 0, k: 1 }, alvo = null, alpha = 1, hover = null, foco = null, tipN = null, hl = null, mexeu = false, raf = 0, arr = null, vis = false;
  var ELI = 2.55, RAIO = { core: 15, repo: 9, agenda: 9, clima: 9, hub: 6.5, nota: 2.6, espera: 4.6, pr: 4, issue: 3.6, evento: 4.4 };
  var MOLA = { hub: 30, nota: 16, espera: 30, pr: 30, issue: 30, evento: 26 };
  var CARGA = { core: 9, repo: 7, agenda: 7, clima: 7, hub: 4, nota: 1.6, espera: 2.6, pr: 2.6, issue: 2.6, evento: 2.6 };
  var KN = { repo: T('repositório', 'repository'), hub: T('anotações', 'notes'), nota: T('anotação', 'note'), espera: T('esperando você', 'waiting on you'), pr: T('PR seu', 'your PR'), issue: 'issue', evento: T('compromisso', 'event') };
  function folha(n) { return n.kind !== 'core' && n.kind !== 'repo' && n.kind !== 'agenda' && n.kind !== 'clima'; }
  function no(id, kind, pai, label, info, L) {
    var p = pai ? byId[pai] : null, a = Math.random() * 6.2832;
    var n = { id: id, kind: kind, pai: pai, label: label || '', info: info || '', x: p ? p.x + Math.cos(a) * 18 : 0, y: p ? p.y + Math.sin(a) * 18 : 0, vx: 0, vy: 0, s: lento ? 1 : 0, vivo: true, nasce: Date.now() };
    nodes.push(n); byId[id] = n;
    if (p) edges.push([p, n, L || MOLA[kind]]);
    return n;
  }
  function monta() {
    nodes = []; byId = {}; edges = [];
    no('core', 'core', null, 'SENNA').s = 1;
    REPOS.forEach(function (r, i) {
      var n = no(r[0], r[2] || 'repo', 'core', r[1], '', 200);
      n.ang = i / REPOS.length * 6.2832 - 1.96; n.s = 1;
    });
    ancora(true);
    Object.keys(NOTAS).forEach(function (k) {
      no('h-' + k, 'hub', k, '', '').s = 1;
      NOTAS[k].forEach(function (t, j) { no('n-' + k + j, 'nota', 'h-' + k, '', t).s = 1; });
    });
    S.espera.forEach(function (x) { no(x.id, 'espera', x.repo, '', x.t).s = 1; });
    S.prs.forEach(function (x) { no(x.id, 'pr', x.repo, '', x.t).s = 1; });
    S.iss.forEach(function (x) { no(x.id, 'issue', x.repo, '', x.t).s = 1; });
    [['Daily', T('hoje 09:00', 'today 09:00')], [T('Planejamento', 'Planning'), T('hoje 16:00', 'today 16:00')], ['Daily', T('amanhã 09:00', 'tomorrow 09:00')], ['Daily', T('depois de amanhã', 'the day after')]].forEach(function (e, i) { no('a' + i, 'evento', 'agenda', '', e[0] + ' · ' + e[1]).s = 1; });
    alpha = 1;
    for (var i = 0; i < (lento ? 420 : 220); i++) fisica();
  }
  function ancora(poe) {
    var A = W && H ? Math.max(.75, Math.min(2.6, W / H)) : 2.2, rx = 178 * Math.sqrt(A), ry = 178 / Math.sqrt(A);
    ELI = rx / ry;
    nodes.forEach(function (n) {
      if (n.ang == null) return;
      n.ax = Math.cos(n.ang) * rx; n.ay = Math.sin(n.ang) * ry;
      if (poe) { n.x = n.ax; n.y = n.ay; }
    });
    edges.forEach(function (e) { if (e[0].kind === 'core') e[2] = rx; });
  }
  function sincGrafo() {
    var quer = {};
    [['espera', S.espera], ['pr', S.prs], ['issue', S.iss]].forEach(function (g) {
      g[1].forEach(function (x) {
        quer[x.id] = 1;
        var n = byId[x.id];
        if (n) n.vivo = true;
        else { n = no(x.id, g[0], x.repo, '', x.t); n.pulso = !lento; }
      });
    });
    nodes.forEach(function (n) { if ((n.kind === 'espera' || n.kind === 'pr' || n.kind === 'issue') && !quer[n.id]) n.vivo = false; });
    alpha = Math.max(alpha, .4);
    acorda();
  }
  function fisica() {
    var n = nodes.length, i, j, a, b, dx, dy, d2, d, f;
    for (i = 0; i < n; i++) {
      a = nodes[i];
      for (j = i + 1; j < n; j++) {
        b = nodes[j];
        dx = b.x - a.x; dy = b.y - a.y; d2 = dx * dx + dy * dy;
        if (d2 > 40000) continue;
        if (d2 < .01) { dx = Math.random() - .5; dy = Math.random() - .5; d2 = .5; }
        f = CARGA[a.kind] * CARGA[b.kind] * 7 / d2 * alpha;
        d = Math.sqrt(d2); dx /= d; dy /= d;
        a.vx -= dx * f; a.vy -= dy * f; b.vx += dx * f; b.vy += dy * f;
      }
    }
    for (i = 0; i < edges.length; i++) {
      a = edges[i][0]; b = edges[i][1];
      dx = b.x - a.x; dy = b.y - a.y;
      if (a.kind === 'core') {
        dy *= ELI; d = Math.sqrt(dx * dx + dy * dy) || 1;
        f = (d - edges[i][2]) * .03 * alpha;
        b.vx -= dx / d * f; b.vy -= dy / d * f * ELI;
        continue;
      }
      d = Math.sqrt(dx * dx + dy * dy) || 1;
      f = (d - edges[i][2]) * .07 * alpha;
      dx /= d; dy /= d;
      a.vx += dx * f * .25; a.vy += dy * f * .25;
      b.vx -= dx * f; b.vy -= dy * f;
    }
    for (i = 0; i < n; i++) {
      a = nodes[i];
      if (a.kind === 'core' || a.fixo) { a.vx = a.vy = 0; continue; }
      if (a.ax != null) { a.vx += (a.ax - a.x) * .006; a.vy += (a.ay - a.y) * .006; }
      a.vx *= .78; a.vy *= .78;
      a.x += Math.max(-6, Math.min(6, a.vx)); a.y += Math.max(-6, Math.min(6, a.vy));
    }
    alpha = Math.max(.04, alpha * .993);
  }
  function tira(n) {
    nodes.splice(nodes.indexOf(n), 1); delete byId[n.id];
    edges = edges.filter(function (e) { return e[0] !== n && e[1] !== n; });
    if (hover === n) hover = null;
    if (tipN === n) tipN = null;
  }
  function passo() {
    for (var i = nodes.length - 1; i >= 0; i--) {
      var n = nodes[i];
      if (n.vivo && n.s < 1) n.s = Math.min(1, n.s + .06);
      else if (!n.vivo) { n.s -= .06; if (n.s <= 0 || lento) tira(n); }
    }
    fisica();
    if (alvo) {
      cam.x += (alvo.x - cam.x) * .16; cam.y += (alvo.y - cam.y) * .16; cam.k += (alvo.k - cam.k) * .16;
      if (Math.abs(alvo.x - cam.x) + Math.abs(alvo.y - cam.y) < .3 && Math.abs(alvo.k - cam.k) < .003) { cam = alvo; alvo = null; }
    }
  }
  function familia(n) {
    var f = {}; f[n.id] = 1;
    if (n.pai) f[n.pai] = 1;
    edges.forEach(function (e) {
      if (e[0] !== n) return;
      f[e[1].id] = 1;
      if (e[1].kind === 'hub') edges.forEach(function (e2) { if (e2[0] === e[1]) f[e2[1].id] = 1; });
    });
    return f;
  }
  function escala() { return Math.max(.8, Math.min(cam.k, 1.5)); }
  function circ(x, y, r, fill, stroke, lw) {
    gx.beginPath(); gx.arc(x, y, r, 0, 6.2832);
    if (fill) { gx.fillStyle = fill; gx.fill(); }
    if (stroke) { gx.strokeStyle = stroke; gx.lineWidth = lw || 1.3; gx.stroke(); }
  }
  function glifo(n, x, y, r) {
    gx.lineWidth = 1; gx.lineCap = 'round';
    if (n.kind === 'repo') {
      gx.strokeStyle = '#86a8dc';
      gx.strokeRect(x - r * .45, y - r * .22, r * .9, r * .6);
      gx.beginPath(); gx.moveTo(x - r * .45, y - r * .22); gx.lineTo(x - r * .45, y - r * .38); gx.lineTo(x - r * .1, y - r * .38); gx.lineTo(x, y - r * .22); gx.stroke();
    } else if (n.kind === 'agenda') {
      gx.strokeStyle = '#8cc47a'; gx.beginPath();
      for (var i = -1; i <= 1; i++) { gx.moveTo(x - r * .4, y + i * r * .3); gx.lineTo(x + r * .4, y + i * r * .3); }
      gx.stroke();
    } else if (n.kind === 'clima') {
      gx.strokeStyle = '#e6d9c4'; circ(x, y, r * .25, null, '#e6d9c4', 1);
      gx.beginPath();
      for (var a = 0; a < 8; a++) { var c = Math.cos(a * .785), s = Math.sin(a * .785); gx.moveTo(x + c * r * .42, y + s * r * .42); gx.lineTo(x + c * r * .6, y + s * r * .6); }
      gx.stroke();
    } else if (n.kind === 'hub') {
      gx.strokeStyle = '#e0704f';
      gx.strokeRect(x - r * .45, y - r * .35, r * .38, r * .7); gx.strokeRect(x + r * .07, y - r * .35, r * .38, r * .7);
    }
  }
  function rotulo(n, x, y, r, a) {
    var cnt = 0;
    edges.forEach(function (e) { if (e[0] === n && e[1].vivo) cnt += e[1].kind === 'hub' ? NOTAS[n.id].length : 1; });
    var txt = n.kind === 'clima' ? 'Canoas ' + (clima ? clima.temp : 21) + '°' : n.label;
    gx.font = '500 11px ' + SANS; gx.textAlign = 'center'; gx.textBaseline = 'top';
    var w = gx.measureText(txt).width;
    gx.fillStyle = 'rgba(20,17,15,.75)'; gx.fillRect(x - w / 2 - 3, y + r + 4, w + 6, 14);
    gx.fillStyle = 'rgba(235,227,215,' + a + ')'; gx.fillText(txt, x, y + r + 5);
    if (cnt && n.kind !== 'clima') { gx.font = '9px ' + SANS; gx.textAlign = 'left'; gx.fillStyle = 'rgba(143,133,122,' + a + ')'; gx.fillText(cnt, x + w / 2 + 3, y + r + 2); }
  }
  function desenha() {
    if (!W) return;
    var t = Date.now(), k = cam.k, ox = W / 2 - cam.x * k, oy = H / 2 - cam.y * k, fam = foco ? familia(foco) : null, hv = hover ? familia(hover) : null, es = escala();
    gx.setTransform(DPR, 0, 0, DPR, 0, 0);
    gx.clearRect(0, 0, W, H);
    var c = byId.core, cx = ox + c.x * k, cy = oy + c.y * k, g = gx.createRadialGradient(cx, cy, 0, cx, cy, 170 * Math.max(k, .6));
    g.addColorStop(0, 'rgba(232,116,59,.30)'); g.addColorStop(.35, 'rgba(232,116,59,.09)'); g.addColorStop(1, 'rgba(232,116,59,0)');
    gx.fillStyle = g; gx.fillRect(0, 0, W, H);
    var P = {};
    nodes.forEach(function (n, i) {
      var x = ox + n.x * k, y = oy + n.y * k;
      if (folha(n) && !lento) { x += Math.sin(t / 900 + i) * .7; y += Math.cos(t / 1100 + i * 1.7) * .7; }
      P[n.id] = [x, y];
    });
    edges.forEach(function (e) {
      var a = e[0], b = e[1], pa = P[a.id], pb = P[b.id];
      if (!pa || !pb) return;
      var dim = fam && !(fam[a.id] && fam[b.id]) ? .15 : 1, lit = hv && hv[a.id] && hv[b.id], al = b.s * dim;
      gx.strokeStyle = a.kind === 'core' ? 'rgba(222,165,96,' + ((lit ? .95 : .4) * al) + ')' : 'rgba(176,132,104,' + ((lit ? .9 : .32) * al) + ')';
      gx.lineWidth = lit ? 1.5 : a.kind === 'core' ? 1 : .8;
      gx.beginPath(); gx.moveTo(pa[0], pa[1]); gx.lineTo(pb[0], pb[1]); gx.stroke();
    });
    nodes.forEach(function (n) {
      var x = P[n.id][0], y = P[n.id][1], r = RAIO[n.kind] * es * n.s, a = fam && !fam[n.id] ? .22 : 1;
      if (r <= 0) return;
      gx.globalAlpha = a;
      if (n.kind === 'core') {
        var s = r * 1.05;
        gx.fillStyle = '#221812'; gx.strokeStyle = 'rgba(232,116,59,.9)'; gx.lineWidth = 1.4;
        gx.beginPath(); gx.moveTo(x - s + 5, y - s); gx.arcTo(x + s, y - s, x + s, y + s, 5); gx.arcTo(x + s, y + s, x - s, y + s, 5); gx.arcTo(x - s, y + s, x - s, y - s, 5); gx.arcTo(x - s, y - s, x + s, y - s, 5); gx.closePath(); gx.fill(); gx.stroke();
        circ(x, y, r * .5, null, '#e8743b', 2); circ(x, y, r * .2, '#ffd9b0');
        gx.font = '700 10px ' + MONO; gx.textAlign = 'center'; gx.textBaseline = 'top'; gx.fillStyle = '#e8743b';
        var L = 'SENNA', sp = 8.5;
        for (var j = 0; j < L.length; j++) gx.fillText(L[j], x + (j - 2) * sp, y + s + 7);
      } else if (n.kind === 'repo' || n.kind === 'agenda' || n.kind === 'clima') {
        circ(x, y, r, '#1c1a20', n.kind === 'repo' ? '#86a8dc' : n.kind === 'agenda' ? '#8cc47a' : '#cfc6b8', 1.3);
        glifo(n, x, y, r);
      } else if (n.kind === 'hub') {
        circ(x, y, r, '#2a1814', '#e0704f', 1.2); glifo(n, x, y, r);
      } else if (n.kind === 'nota') circ(x, y, r, '#e0704f');
      else if (n.kind === 'espera') circ(x, y, r, '#f2c94c');
      else if (n.kind === 'pr') circ(x, y, r, '#a99bf5');
      else if (n.kind === 'issue') { gx.fillStyle = '#f5a524'; gx.fillRect(x - r, y - r, r * 2, r * 2); }
      else if (n.kind === 'evento') { gx.fillStyle = '#8cc47a'; gx.beginPath(); gx.moveTo(x, y - r * 1.2); gx.lineTo(x + r * 1.2, y); gx.lineTo(x, y + r * 1.2); gx.lineTo(x - r * 1.2, y); gx.closePath(); gx.fill(); }
      if (n.pulso && t - n.nasce < 1800) { var p = (t - n.nasce) / 1800; circ(x, y, r + 2 + p * 22, null, 'rgba(255,240,210,' + ((1 - p) * .8) + ')', 1.5); }
      if (hl === n.id) circ(x, y, r + 4 + Math.sin(t / 160) * 1.5, null, '#fff', 1.4);
      else if (hover === n) circ(x, y, r + 3, null, 'rgba(255,255,255,.75)', 1);
    });
    nodes.forEach(function (n) {
      if (n.kind !== 'repo' && n.kind !== 'agenda' && n.kind !== 'clima') return;
      var a = fam && !fam[n.id] ? .22 : 1;
      gx.globalAlpha = a;
      rotulo(n, P[n.id][0], P[n.id][1], RAIO[n.kind] * es * n.s, a);
    });
    gx.globalAlpha = 1;
    if (tip && !tip.hidden) poeDica(P);
  }
  function acha(px, py) {
    var k = cam.k, ox = W / 2 - cam.x * k, oy = H / 2 - cam.y * k, best = null, bd = 1e9, es = escala();
    nodes.forEach(function (n) {
      if (!n.vivo) return;
      var dx = ox + n.x * k - px, dy = oy + n.y * k - py, d = dx * dx + dy * dy, r = Math.max(RAIO[n.kind] * es, 4) + 5;
      if (d < r * r && d < bd) { bd = d; best = n; }
    });
    return best;
  }
  function resumo(n) {
    var c = { espera: 0, pr: 0, issue: 0, nota: 0 }, p = [];
    edges.forEach(function (e) { if (e[0] === n && e[1].vivo) { if (e[1].kind === 'hub') c.nota += NOTAS[n.id].length; else c[e[1].kind]++; } });
    if (c.espera) p.push(c.espera + ' ' + T('esperando você', 'waiting on you'));
    if (c.pr) p.push(c.pr + (c.pr > 1 ? T(' PRs seus', ' PRs of yours') : T(' PR seu', ' PR of yours')));
    if (c.issue) p.push(c.issue + (c.issue > 1 ? ' issues' : ' issue'));
    if (c.nota) p.push(c.nota + (c.nota > 1 ? T(' anotações', ' notes') : T(' anotação', ' note')));
    if (n.id === 'trab') p.push(T('nomes ocultos na demo', 'names hidden in the demo'));
    return p.join(' · ') || T('tudo em dia', 'all clear');
  }
  function dica() {
    var n = hover || tipN;
    if (!n || !n.vivo) { tip.hidden = true; return; }
    var t, s;
    if (n.kind === 'core') { t = 'Senna'; s = T('o centro: repositórios, agenda, clima e memória', 'the center: repos, calendar, weather and memory'); }
    else if (n.kind === 'repo') { t = n.label; s = resumo(n); }
    else if (n.kind === 'clima') { t = 'Canoas · ' + (clima ? clima.temp : 21) + '°'; s = climaDesc() + ' · ' + S.chuva + T('% de chuva', '% chance of rain'); }
    else if (n.kind === 'agenda') { t = n.label; s = T('Daily às 09:00 e planejamento às 16:00', 'Daily at 9:00 and planning at 16:00'); }
    else if (n.kind === 'hub') { t = KN.hub; s = NOTAS[n.pai].length + T(' em ', ' in ') + nomeRepo(n.pai); }
    else { t = KN[n.kind]; s = n.info; }
    tip.innerHTML = '<b>' + esc(t) + '</b><span>' + esc(s) + '</span>';
    tip.hidden = false;
    tip._n = n;
  }
  function poeDica(P) {
    var n = tip._n, p = n && P[n.id];
    if (!p) return;
    var w = tip.offsetWidth, h = tip.offsetHeight, x = Math.max(6, Math.min(W - w - 6, p[0] - w / 2)), y = p[1] - h - RAIO[n.kind] * escala() - 10;
    if (y < 26) y = p[1] + RAIO[n.kind] * escala() + 12;
    tip.style.transform = 'translate(' + Math.round(x) + 'px,' + Math.round(y) + 'px)';
  }
  function fit(ja) {
    if (!W) return;
    var x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    nodes.forEach(function (n) { if (!n.vivo) return; x0 = Math.min(x0, n.x); x1 = Math.max(x1, n.x); y0 = Math.min(y0, n.y); y1 = Math.max(y1, n.y); });
    var lado = W < 520 ? 44 : 0, k = Math.max(.4, Math.min(1.7, Math.min((W - 30 - lado) / Math.max(80, x1 - x0 + 90), (H - 64) / Math.max(80, y1 - y0 + 36))));
    alvo = { x: (x0 + x1) / 2 + lado / 2 / k, y: (y0 + y1) / 2 + 4, k: k };
    if (ja || lento) { cam = alvo; alvo = null; }
    acorda();
  }
  function medir() {
    var w = cv.clientWidth, h = cv.clientHeight;
    if (!w || !h) return;
    DPR = Math.min(2, window.devicePixelRatio || 1);
    if (w !== W || h !== H) {
      var antes = W && H ? W / H : 0;
      W = w; H = h; cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
      if (Math.abs(W / H - antes) > .15) { ancora(true); alpha = 1; for (var i = 0; i < 160; i++) fisica(); }
      if (!mexeu) fit(true);
    }
    desenha();
  }
  function zoom(z) {
    if (z === 2) { q('#swGrid').classList.toggle('grande'); mexeu = false; foco = null; requestAnimationFrame(medir); return; }
    if (z === 0) { foco = null; tipN = null; dica(); mexeu = false; fit(); return; }
    var b = alvo || cam;
    alvo = { x: b.x, y: b.y, k: Math.max(.35, Math.min(3, b.k * (z > 0 ? 1.3 : 1 / 1.3))) };
    mexeu = true; acorda();
  }
  function clique(n) {
    Som.play('blip');
    if (!n || n === foco || n.kind === 'core') { foco = null; tipN = n && n.kind === 'core' ? n : null; mexeu = false; fit(); dica(); return; }
    if (n.kind === 'repo' || n.kind === 'agenda' || n.kind === 'clima') { foco = n; alvo = { x: n.x, y: n.y, k: Math.min(2.4, Math.max(cam.k * 1.5, 1.4)) }; mexeu = true; }
    tipN = n; dica(); acorda();
  }
  function pos(e) { var r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
  cv.addEventListener('pointerdown', function (e) {
    var p = pos(e);
    arr = { n: acha(p.x, p.y), x0: p.x, y0: p.y, cx: cam.x, cy: cam.y, mov: false, toque: e.pointerType === 'touch' };
    if (!arr.toque) try { cv.setPointerCapture(e.pointerId); } catch (er) {}
  });
  cv.addEventListener('pointermove', function (e) {
    var p = pos(e);
    if (arr) {
      if (Math.abs(p.x - arr.x0) + Math.abs(p.y - arr.y0) > 4) arr.mov = true;
      if (arr.toque || !arr.mov) return;
      if (arr.n && arr.n.kind !== 'core') {
        arr.n.x = cam.x + (p.x - W / 2) / cam.k; arr.n.y = cam.y + (p.y - H / 2) / cam.k; arr.n.vx = arr.n.vy = 0; arr.n.fixo = true;
        alpha = Math.max(alpha, .35);
      } else { cam.x = arr.cx - (p.x - arr.x0) / cam.k; cam.y = arr.cy - (p.y - arr.y0) / cam.k; alvo = null; }
      mexeu = true; cv.classList.add('arrasta'); acorda();
      return;
    }
    var n = acha(p.x, p.y);
    if (n !== hover) { hover = n; cv.classList.toggle('mao', !!n); dica(); acorda(); }
  });
  cv.addEventListener('pointerup', function () {
    if (!arr) return;
    var a = arr; arr = null; cv.classList.remove('arrasta');
    if (a.n) a.n.fixo = false;
    if (!a.mov) clique(a.n);
  });
  cv.addEventListener('pointercancel', function () { if (arr && arr.n) arr.n.fixo = false; arr = null; cv.classList.remove('arrasta'); });
  cv.addEventListener('pointerleave', function () { if (!arr && hover) { hover = null; cv.classList.remove('mao'); dica(); acorda(); } });

  function quadro() {
    raf = 0;
    if (!vis || document.hidden || tela !== 'home') return;
    passo(); desenha();
    raf = requestAnimationFrame(quadro);
  }
  function acorda() { if (!raf && vis && !document.hidden && tela === 'home') raf = requestAnimationFrame(quadro); }

  function add(l, x) { if (!S[l].some(function (y) { return y.id === x.id; })) S[l].unshift(x); sincGrafo(); }
  function del(l, id) { S[l] = S[l].filter(function (y) { return y.id !== id; }); sincGrafo(); }
  function climaDesc() {
    if (!clima) return T('algumas nuvens', 'some clouds');
    return chove() ? T('chuva', 'rain') : nublado() ? T('nublado', 'cloudy') : clima.code === 0 ? T('céu limpo', 'clear sky') : T('algumas nuvens', 'some clouds');
  }
  function chip(st) { return st === 'ok' ? '<span class="sw-chip ok">' + T('aprovado', 'approved') + '</span>' : st === 'draft' ? '<span class="sw-chip">' + T('rascunho', 'draft') + '</span>' : ''; }
  function itens(l, comChip) {
    return l.map(function (x, i) { return '<li data-hl="' + x.id + '"><em>' + pad(i + 1) + '</em><div><b>' + (comChip ? chip(x.st) : '') + esc(x.t) + '</b><small>' + esc(x.s) + '</small></div></li>'; }).join('');
  }
  function pintaDados() {
    q('#swWn').textContent = S.espera.length;
    q('#swWl').innerHTML = itens(S.espera);
    q('#swPn').textContent = q('#swPn2').textContent = S.prs.length;
    q('#swPl').innerHTML = q('#swPl2').innerHTML = itens(S.prs, true);
    q('#swIn').textContent = S.iss.length;
    q('#swIl').innerHTML = itens(S.iss);
    q('#swK1').textContent = S.prs.length;
    q('#swK2').textContent = S.iss.length;
    q('#swK4').textContent = q('#swCp').textContent = S.chuva + '%';
    q('#swCpb').style.width = S.chuva + '%';
    q('#swL2').textContent = S.semana + '%';
    q('#swL2b').style.width = S.semana + '%';
    var nn = 0, nt = 0;
    nodes.forEach(function (n) { if (n.vivo) { nn++; if (n.kind === 'nota') nt++; } });
    q('#swMapa').textContent = nn + T(' nós', ' nodes') + ' · 6 ' + T('repositórios', 'repositories') + ' · ' + nt + T(' anotações', ' notes');
    pintaAvisos();
  }
  function pintaHora() {
    var m = S.min, i, nx = null;
    q('#swHora').textContent = hhmm(m);
    q('#swHi').textContent = (m < 720 ? T('Bom dia', 'Good morning') : m < 1080 ? T('Boa tarde', 'Good afternoon') : T('Boa noite', 'Good evening')) + T(', visitante.', ', visitor.');
    for (i = 0; i < AG.length; i++) if (m < AG[i][0] + 30) { nx = [AG[i][0], AG[i][1], 0]; break; }
    if (!nx) nx = [AG[0][0], AG[0][1], 1];
    var falta = nx[0] + nx[2] * 1440 - m;
    q('#swNxH').textContent = hhmm(nx[0]);
    q('#swNxT').textContent = nx[1];
    q('#swNxS').textContent = (nx[2] ? T('amanhã', 'tomorrow') : T('hoje', 'today')) + ' · Teams · ' + (falta <= 0 ? T('agora', 'now') : T('em ', 'in ') + dur(falta));
    var dow = new Date().getDay();
    q('#swAg').innerHTML = [[540, AG[0][1], 0], [960, AG[1][1], 0], [540, AG[0][1], 1], [540, AG[0][1], 2]].map(function (a) {
      var cls = a[2] ? '' : m >= a[0] + 30 ? 'foi' : m >= a[0] ? 'ja' : '';
      return '<li class="' + cls + '"><b>' + hhmm(a[0]) + '</b><span>' + esc(a[1]) + '</span><small>' + (a[2] === 0 ? (cls === 'ja' ? T('agora', 'now') : T('hoje', 'today')) : a[2] === 1 ? T('amanhã', 'tomorrow') : DIAS[(dow + a[2]) % 7]) + '</small></li>';
    }).join('');
    var ses = Math.round(6 + ((m - 510) % 300) / 300 * 72);
    q('#swL1').textContent = ses + '%'; q('#swL1b').style.width = ses + '%';
    var tp = clima ? clima.temp : 21, mn = clima && clima.min != null ? clima.min : tp - 5, mx = clima && clima.max != null ? clima.max : tp + 2;
    if (mx <= mn) mx = mn + 1;
    q('#swK3').textContent = q('#swCt').textContent = tp + '°';
    q('#swCd').textContent = climaDesc();
    q('#swCmin').textContent = T('mín ', 'min ') + mn + '°'; q('#swCmax').textContent = T('máx ', 'max ') + mx + '°';
    q('#swCtb').style.width = Math.max(4, Math.min(100, (tp - mn) / (mx - mn) * 100)) + '%';
    var h0 = Math.floor(m / 60), hs = '';
    for (i = 0; i < 9; i++) {
      var h = (h0 + i) % 24, ico = S.chuva >= 80 && h >= 17 && h <= 21 ? I.chuva : (h >= 19 || h < 6) ? I.lua : chove() ? I.chuva : nublado() ? I.nuvem : I.sol;
      hs += '<span><small>' + (i ? pad(h) : T('agora', 'now')) + '</small>' + ic(ico) + '</span>';
    }
    q('#swCh').innerHTML = hs;
    if (tela === 'ajustes') pintaFontes();
  }
  function pintaAvisos() {
    q('#swAv').innerHTML = S.avisos.length ? S.avisos.map(function (a) {
      return '<li' + (a.mudo ? ' class="mudo"' : '') + '><b>' + a.h + '</b><div><strong>' + esc(a.t) + (a.mudo ? ' <span class="sw-chip">' + T('silenciado', 'muted') + '</span>' : '') + '</strong><p>' + esc(a.p) + '</p></div></li>';
    }).join('') : '<li class="sw-vazio">' + T('Nenhum aviso ainda. Ele trabalha calado.', 'No alerts yet. It works quietly.') + '</li>';
    var b = q('#swNao'); b.hidden = !S.nao; b.textContent = S.nao;
  }
  function pintaToggles() {
    q('#swTg').innerHTML = TIPOS.map(function (t) { return '<li><span>' + t[1] + '</span><button type="button" role="switch" class="sw-sw" data-tg="' + t[0] + '" aria-checked="' + on[t[0]] + '" aria-label="' + t[1] + '"><i></i></button></li>'; }).join('');
  }
  function pintaFontes() {
    var d = S.min - S.atual;
    q('#swFo').innerHTML = FONTES.map(function (f) { var x = (d + f[1]) % 15; return '<li><i></i><span>' + f[0] + '</span><small>' + (x < 1 ? T('agora', 'now') : T('há ', '') + x + T(' min', ' min ago')) + '</small></li>'; }).join('');
  }
  var VAR = { a: '[aáàâã]', e: '[eéê]', i: '[ií]', o: '[oóôõ]', u: '[uú]', c: '[cç]' };
  function norm(s) { return String(s).normalize ? s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase() : s.toLowerCase(); }
  function rx(s) { return new RegExp(norm(s).split('').map(function (ch) { return VAR[ch] || ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }).join(''), 'gi'); }
  function marca(s, re) { s = esc(s); return re ? s.replace(re, '<mark>$&</mark>') : s; }
  function pintaMem() {
    var raw = q('#swQ').value.trim(), qv = norm(raw), re = raw ? rx(raw) : null;
    var l = MEM.map(function (m, i) { return [m, i]; }).filter(function (p) { var m = p[0]; return (!memF || m[0] === memF) && (!qv || norm(m[1] + ' ' + m[2] + ' ' + m[4]).indexOf(qv) >= 0); });
    q('#swMl').innerHTML = l.length ? l.map(function (p) {
      var m = p[0], ab = p[1] === memAberto || !!qv;
      return '<li><button type="button" class="sw-mi" data-mem="' + p[1] + '" aria-expanded="' + ab + '"><span class="sw-chip t-' + m[0] + '">' + TIPO_N[m[0]] + '</span><b>' + marca(m[1], re) + '</b><small>' + esc(m[2]) + ' · ' + esc(m[3]) + '</small></button>' + (ab ? '<p>' + marca(m[4], re) + '</p>' : '') + '</li>';
    }).join('') : '<li class="sw-vazio">' + T('Nada na memória sobre isso.', 'Nothing in memory about that.') + '</li>';
  }
  function toast(h, t, p, link) {
    var box = q('#swToasts'), el = document.createElement(link ? 'a' : 'div');
    if (link) el.href = link;
    el.className = 'sw-toast';
    el.innerHTML = '<i class="sw-ti"></i><div><small>Senna · ' + h + '</small><b>' + esc(t) + '</b><p>' + esc(p) + '</p></div>';
    box.appendChild(el);
    while (box.children.length > 2) box.removeChild(box.firstChild);
    setTimeout(function () { el.classList.add('sai'); setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 400); }, 4600);
  }
  function avisa(ev) {
    var a = { h: hhmm(S.min), t: ev[2], p: ev[3], mudo: !on[ev[1]] };
    S.avisos.unshift(a);
    if (!a.mudo) { if (tela !== 'avisos') S.nao++; toast(a.h, a.t, a.p, ev[5]); }
  }
  function vai(t, busca) {
    tela = t;
    $$('.sw-view', win).forEach(function (v) { v.hidden = v.getAttribute('data-tela') !== t; });
    $$('.sw-side [data-v]', win).forEach(function (b) { if (b.getAttribute('data-v') === t) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
    if (t === 'avisos') S.nao = 0;
    if (t === 'mem') pintaMem();
    if (t === 'ajustes') pintaFontes();
    pintaAvisos();
    q('#swMain').scrollTop = 0;
    if (busca) setTimeout(function () { try { q('#swQ').focus({ preventScroll: true }); } catch (e) {} }, 30);
    if (t === 'home') { medir(); acorda(); }
  }
  function reinicia() {
    novo(); sincGrafo(); pintaDados(); pintaHora();
    q('#swToasts').innerHTML = '';
  }
  var fim = 0;
  function corre() {
    if (!vis || document.hidden) return;
    if (fim) { if (Date.now() > fim) { fim = 0; reinicia(); } return; }
    S.min += 3;
    var mudou = false;
    while (S.ev < EV.length && EV[S.ev][0] <= S.min) { var ev = EV[S.ev++]; if (ev[4]) ev[4](); avisa(ev); mudou = true; }
    if (S.min >= 1110) fim = Date.now() + 3500;
    if (mudou) pintaDados();
    pintaHora();
  }

  win.addEventListener('click', function (e) {
    var b = e.target.closest('button');
    if (!b || !win.contains(b)) return;
    if (b.hasAttribute('data-v')) { vai(b.getAttribute('data-v'), b.hasAttribute('data-busca')); Som.play('blip'); return; }
    if (b.hasAttribute('data-z')) { zoom(+b.getAttribute('data-z')); Som.play('clic'); return; }
    if (b.hasAttribute('data-tg')) { var k = b.getAttribute('data-tg'); on[k] = !on[k]; b.setAttribute('aria-checked', on[k]); Som.play('clic'); return; }
    if (b.hasAttribute('data-f')) { memF = b.getAttribute('data-f'); $$('[data-f]', win).forEach(function (x) { x.setAttribute('aria-pressed', x === b); }); pintaMem(); Som.play('clic'); return; }
    if (b.hasAttribute('data-mem')) { var i = +b.getAttribute('data-mem'); memAberto = memAberto === i ? -1 : i; pintaMem(); Som.play('clic'); return; }
    if (b.id === 'swUpd') {
      b.classList.add('gira'); q('#swSrc').textContent = T('atualizando…', 'refreshing…'); Som.play('blip');
      setTimeout(function () { b.classList.remove('gira'); q('#swSrc').textContent = T('fontes em dia', 'sources up to date'); S.atual = S.min; pintaFontes(); }, 900);
      return;
    }
    if (b.hasAttribute('data-ctl')) { Som.play('clic'); toast(hhmm(S.min), T('Continua na bandeja', 'Still in the tray'), T('Fechar só esconde a janela. Os avisos continuam chegando.', 'Closing only hides the window. Alerts keep coming.')); }
  });
  q('#swQ').addEventListener('input', pintaMem);
  win.addEventListener('pointerover', function (e) {
    var li = e.target.closest('[data-hl]'), id = li ? li.getAttribute('data-hl') : null;
    if (id !== hl) { hl = id; acorda(); }
  });

  novo(); monta(); pintaDados(); pintaHora(); pintaToggles(); vai('home');
  if ('ResizeObserver' in window) new ResizeObserver(function () { medir(); }).observe(cv);
  else window.addEventListener('resize', medir);
  if ('IntersectionObserver' in window) new IntersectionObserver(function (es) { vis = es[0].isIntersecting; if (vis) { medir(); acorda(); } }, { threshold: .15 }).observe(win);
  else { vis = true; medir(); }
  document.addEventListener('visibilitychange', acorda);
  setInterval(corre, lento ? 600 : 250);
})();

(function () {
  var term = $('#hudTerm'), grid = $('#hudGrid'), status = $('#hudStatus'), btn = $('#hudReboot');
  if (!term) return;
  var LINHAS = [
    ['> ControlSensors starting…', ''], ['> Loading hardware sensors', ''],
    ['> CPU ············ ', 'OK'], ['> GPU ············ ', 'OK'], ['> Memory ········· ', 'OK'],
    ['> Storage ········ ', 'OK'], ['> Weather ········ ', 'OK'], ['> Audio ·········· ', 'OK'],
    ['> Dashboard ready.', ''], ['SYSTEM ONLINE', '']
  ];
  var timers = [], vals = { cpu: 46, gpu: 54, ram: 61, ssd: 72, cl: 38, cg: 47 }, tick = null, rodou = false;
  function seg(p, n) {
    var on = Math.round(p / 100 * n), s = '';
    for (var i = 0; i < n; i++) s += '<i class="' + (i < on ? 'on' + (i >= n * .85 ? ' h' : i >= n * .65 ? ' w' : '') : '') + '"></i>';
    return '<div class="segs">' + s + '</div>';
  }
  function pinta() {
    var cl = clima ? clima.temp + '°' : '21°';
    grid.innerHTML =
      '<div class="hud-c"><span>CPU</span><b>' + Math.round(vals.cl + 20) + '<small>°C · ' + Math.round(vals.cpu) + '%</small></b>' + seg(vals.cpu, 12) + '</div>' +
      '<div class="hud-c"><span>GPU</span><b>' + Math.round(vals.cg + 18) + '<small>°C · ' + Math.round(vals.gpu) + '%</small></b>' + seg(vals.gpu, 12) + '</div>' +
      '<div class="hud-c"><span>' + T('Memória', 'Memory') + '</span><b>' + (vals.ram * .32).toFixed(1) + '<small> / 32 GB</small></b>' + seg(vals.ram, 12) + '</div>' +
      '<div class="hud-c"><span>' + T('Disco', 'Disk') + '</span><b>' + Math.round(vals.ssd) + '<small>% · NVMe</small></b>' + seg(vals.ssd, 12) + '</div>' +
      '<div class="hud-c"><span>' + T('Clima · Canoas', 'Weather · Canoas') + '</span><b>' + cl + '<small> ' + (chove() ? T('chuva', 'rain') : nublado() ? T('nublado', 'cloudy') : T('limpo', 'clear')) + '</small></b></div>' +
      '<div class="hud-c"><span>' + T('Áudio · fone', 'Audio · headphones') + '</span><b>♪<small> Froid</small></b>' + seg(62, 12) + '</div>';
  }
  function boot() {
    timers.forEach(clearTimeout); timers = []; clearInterval(tick);
    term.innerHTML = ''; term.hidden = false; grid.hidden = true; status.textContent = 'boot';
    LINHAS.forEach(function (l, i) {
      timers.push(setTimeout(function () {
        var d = document.createElement('div');
        d.innerHTML = esc(l[0]) + (l[1] ? '<span class="ok">' + l[1] + '</span>' : '');
        if (i === LINHAS.length - 1) d.className = 'ok';
        term.appendChild(d);
      }, lento ? 0 : 260 * i));
    });
    timers.push(setTimeout(function () {
      term.hidden = true; grid.hidden = false; status.textContent = 'online'; pinta();
      tick = setInterval(function () {
        ['cpu', 'gpu', 'ram', 'cl', 'cg'].forEach(function (k) { vals[k] = Math.max(8, Math.min(k === 'ram' ? 80 : 96, vals[k] + rnd(-5, 5))); });
        pinta();
      }, lento ? 4000 : 1200);
    }, lento ? 200 : 260 * LINHAS.length + 900));
  }
  btn.addEventListener('click', function () { Som.play('blip'); boot(); });
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (es) { if (es[0].isIntersecting && !rodou) { rodou = true; boot(); } }, { threshold: .4 }).observe(term.parentNode);
  } else boot();
})();

(function () {
  var clock = $('#mpClock'), net = $('#mpNet'), sheet = $('#mpSheet'), cam = $('#mpCam'), msg = $('#mpMsg'), list = $('#mpList'), qtd = $('#mpQtd'), face = $('#mpFace'), aviso = $('#mpToast'), sync = $('#mpSync');
  if (!clock) return;
  function tick() { clock.textContent = hms(new Date()); }
  tick(); setInterval(tick, 1000);
  var fc = face.getContext('2d');
  fc.fillStyle = '#8c98aa';
  fc.fillRect(8, 3, 8, 2); fc.fillRect(7, 5, 10, 8); fc.fillRect(8, 13, 8, 2); fc.fillRect(10, 15, 4, 2);
  fc.fillRect(4, 18, 16, 2); fc.fillRect(2, 20, 20, 4);
  fc.fillStyle = '#5f6b7e'; fc.fillRect(9, 8, 2, 1); fc.fillRect(13, 8, 2, 1);
  var online = true, ocupado = false, avisoT = null;
  function avisa(t) {
    aviso.textContent = t; aviso.classList.add('on');
    clearTimeout(avisoT); avisoT = setTimeout(function () { aviso.classList.remove('on'); }, 2400);
  }
  function conta() { qtd.textContent = list.children.length; }
  function sobe(t) {
    try { document.dispatchEvent(new CustomEvent('ponto', { detail: { h: $('b', t).textContent, tipo: $('small', t).textContent } })); } catch (e) {}
  }
  net.addEventListener('click', function () {
    online = !online;
    net.setAttribute('aria-pressed', online);
    net.textContent = online ? 'Online' : 'Offline';
    Som.play('clic');
    if (!online) { avisa(T('Sem internet. Pode registrar: fica salvo no aparelho.', 'No internet. Go ahead: it is saved on the device.')); return; }
    var pend = $$('.mp-tile.pend', list);
    if (!pend.length) { avisa(T('De volta à rede.', 'Back online.')); return; }
    sync.classList.add('gira');
    avisa(T('Sincronizando…', 'Syncing…'));
    pend.forEach(function (t, i) {
      setTimeout(function () {
        t.classList.remove('pend');
        sobe(t);
        if (i === pend.length - 1) {
          sync.classList.remove('gira');
          avisa(T('Sincronizado: ', 'Synced: ') + pend.length + T(' registro(s) enviado(s).', ' punch(es) sent.'));
          Som.play('blip');
        }
      }, 700 + i * 500);
    });
  });
  $$('[data-tipo]').forEach(function (b) {
    b.addEventListener('click', function () {
      if (ocupado) return;
      ocupado = true;
      var tipo = b.getAttribute('data-tipo');
      sheet.classList.add('on');
      cam.classList.remove('ok'); cam.classList.add('lendo');
      msg.textContent = T('Verificando o rosto…', 'Checking face…');
      setTimeout(function () {
        cam.classList.remove('lendo'); cam.classList.add('ok');
        Som.play('bip');
        var d = new Date(), el = document.createElement('div');
        el.className = 'mp-tile novo' + (online ? '' : ' pend');
        el.innerHTML = '<i></i><b>' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + '</b><small>' + tipo + '</small>';
        list.insertBefore(el, list.firstChild);
        while (list.children.length > 8) list.removeChild(list.lastChild);
        conta();
        msg.textContent = online ? T('Ponto registrado às ', 'Clocked in at ') + hms(d) + '.' : T('Salvo no aparelho. Sobe quando a rede voltar.', 'Saved on the device. It uploads when the network is back.');
        if (online) sobe(el);
        setTimeout(function () {
          sheet.classList.remove('on'); ocupado = false;
          if (online) avisa(T('Enviado. Já aparece no portal, logo abaixo.', 'Sent. It already shows up in the portal below.'));
        }, 1100);
      }, lento ? 100 : 950);
    });
  });
})();

(function () {
  var win = $('#cloudWin');
  if (!win) return;
  function q(s) { return $(s, win); }
  function sv(d) { return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="' + d + '"/></svg>'; }
  var P = {
    search: 'M15.5 14h-.8l-.3-.3A6.5 6.5 0 1 0 9.5 16a6.5 6.5 0 0 0 4.2-1.6l.3.3v.8l5 5 1.5-1.5-5-5zm-6 0a4.5 4.5 0 1 1 0-9 4.5 4.5 0 0 1 0 9z',
    sync: 'M12 4V1L8 5l4 4V6a6 6 0 0 1 5.3 8.8l1.5 1.5A8 8 0 0 0 12 4zm0 14a6 6 0 0 1-5.3-8.8L5.2 7.7A8 8 0 0 0 12 20v3l4-4-4-4v3z',
    filter: 'M4.3 5.6C6.3 8.2 10 13 10 13v6a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1v-6s3.7-4.8 5.7-7.4A1 1 0 0 0 19 4H5a1 1 0 0 0-.7 1.6z',
    tune: 'M3 17v2h6v-2H3zM3 5v2h10V5H3zm10 16v-2h8v-2h-8v-2h-2v6h2zM7 9v2H3v2h4v2h2V9H7zm14 4v-2H11v2h10zm-6-4h2V7h4V5h-4V3h-2v6z',
    headset: 'M12 1a9 9 0 0 0-9 9v7a3 3 0 0 0 3 3h3v-8H5v-2a7 7 0 0 1 14 0v2h-4v8h3a3 3 0 0 0 3-3v-7a9 9 0 0 0-9-9z',
    feedback: 'M20 2H4a2 2 0 0 0-2 2v18l4-4h14a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2zm-7 12h-2v-2h2v2zm0-4h-2V6h2v4z',
    help: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm1 17h-2v-2h2v2zm2.1-7.8-.9.9C13.5 12.9 13 13.5 13 15h-2v-.5a4 4 0 0 1 1.2-2.8l1.2-1.3A2 2 0 1 0 10 9H8a4 4 0 1 1 7.1 2.2z',
    bell: 'M12 22a2 2 0 0 0 2-2h-4a2 2 0 0 0 2 2zm6-6v-5c0-3.1-1.6-5.6-4.5-6.3V4a1.5 1.5 0 0 0-3 0v.7C7.6 5.4 6 7.9 6 11v5l-2 2v1h16v-1l-2-2z',
    full: 'M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z',
    drop: 'M7 10l5 5 5-5z',
    less: 'M12 8l-6 6 1.4 1.4 4.6-4.6 4.6 4.6L18 14z',
    left: 'M15.4 7.4 14 6l-6 6 6 6 1.4-1.4-4.6-4.6z',
    right: 'M10 6 8.6 7.4l4.6 4.6-4.6 4.6L10 18l6-6z',
    bookmark: 'M17 3H7a2 2 0 0 0-2 2v16l7-3 7 3V5a2 2 0 0 0-2-2z',
    dash: 'M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z',
    people: 'M16 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm-8 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm0 2c-2.3 0-7 1.2-7 3.5V19h14v-2.5C15 14.2 10.3 13 8 13zm8 0h-1c1.2.8 2 2 2 3.5V19h6v-2.5c0-2.3-4.7-3.5-7-3.5z',
    eye: 'M12 4.5C7 4.5 2.7 7.6 1 12c1.7 4.4 6 7.5 11 7.5s9.3-3.1 11-7.5c-1.7-4.4-6-7.5-11-7.5zM12 17a5 5 0 1 1 0-10 5 5 0 0 1 0 10zm0-8a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
    warn: 'M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z',
    edit: 'M3 17.2V21h3.8L17.8 10 14 6.2 3 17.2zM20.7 7a1 1 0 0 0 0-1.4l-2.3-2.3a1 1 0 0 0-1.4 0l-1.8 1.8 3.8 3.8L20.7 7z',
    print: 'M19 8H5a3 3 0 0 0-3 3v6h4v4h12v-4h4v-6a3 3 0 0 0-3-3zm-3 11H8v-5h8v5zm3-7a1 1 0 1 1 0-2 1 1 0 0 1 0 2zm-1-9H6v4h12V3z',
    cal: 'M19 4h-1V2h-2v2H8V2H6v2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zm0 16H5V9h14v11zM7 11h5v5H7z',
    biz: 'M12 7V3H2v18h20V7H12zM6 19H4v-2h2v2zm0-4H4v-2h2v2zm0-4H4V9h2v2zm0-4H4V5h2v2zm4 12H8v-2h2v2zm0-4H8v-2h2v2zm0-4H8V9h2v2zm0-4H8V5h2v2zm10 12h-8v-2h2v-2h-2v-2h2v-2h-2V9h8v10z',
    tree: 'M22 11V3h-7v3H9V3H2v8h7V8h2v10h4v3h7v-8h-7v3h-2V8h2v3z',
    cancel: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm5 13.6L15.6 17 12 13.4 8.4 17 7 15.6 10.6 12 7 8.4 8.4 7 12 10.6 15.6 7 17 8.4 13.4 12 17 15.6z',
    table: 'M10 10h5v11h-5zM17 21h3a2 2 0 0 0 2-2v-9h-5v11zm3-18H5a2 2 0 0 0-2 2v3h19V5a2 2 0 0 0-2-2zM3 19a2 2 0 0 0 2 2h3V10H3v9z',
    open: 'M19 19H5V5h7V3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7h-2v7zM14 3v2h3.6l-9.8 9.8 1.4 1.4L19 6.4V10h2V3h-7z',
    more: 'M12 8a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm0 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm0 6a2 2 0 1 0 0 4 2 2 0 0 0 0-4z',
    school: 'M5 13.2v4L12 21l7-3.8v-4L12 17l-7-3.8zM12 3 1 9l11 6 9-4.9V17h2V9L12 3z',
    add: 'M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z',
    refresh: 'M17.6 6.4A8 8 0 1 0 19.7 14h-2.1A6 6 0 1 1 12 6c1.7 0 3.1.7 4.2 1.8L13 11h7V4l-2.4 2.4z',
    cols: 'M10 18h5V5h-5v13zm-6 0h5V5H4v13zM16 5v13h5V5h-5z',
    gps: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zm9 3a9 9 0 0 0-8-8V1h-2v2a9 9 0 0 0-8 8H1v2h2a9 9 0 0 0 8 8v2h2v-2a9 9 0 0 0 8-8h2v-2h-2zm-9 8a7 7 0 1 1 0-14 7 7 0 0 1 0 14z',
    clock: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 18a8 8 0 1 1 0-16 8 8 0 0 1 0 16zm.5-13H11v6l5.3 3.2.7-1.3-4.5-2.6z',
    home: 'M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z',
    person: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm0 2c-2.7 0-8 1.3-8 4v2h16v-2c0-2.7-5.3-4-8-4z',
    globe: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm-1 17.9A8 8 0 0 1 4.2 10.2L9 15v1a2 2 0 0 0 2 2v1.9zm6.9-2.5A2 2 0 0 0 16 16h-1v-3a1 1 0 0 0-1-1H8v-2h2a1 1 0 0 0 1-1V7h2a2 2 0 0 0 2-2v-.4a8 8 0 0 1 2.9 12.8z',
    chart: 'M5 9.2h3V19H5zM10.6 5h2.8v14h-2.8zm5.6 8H19v6h-2.8z',
    shield: 'M12 1 3 5v6c0 5.6 3.8 10.7 9 12 5.2-1.3 9-6.4 9-12V5l-9-4zm-1 16-4-4 1.4-1.4 2.6 2.6 5.6-5.6L18 10l-7 7z',
    map: 'M20.5 3h-.2L15 5.1 9 3 3.4 4.9a.5.5 0 0 0-.4.5v15.1a.5.5 0 0 0 .7.5L9 18.9l6 2.1 5.6-1.9a.5.5 0 0 0 .4-.5V3.5a.5.5 0 0 0-.5-.5zM15 19l-6-2.1V5l6 2.1V19z',
    viewlist: 'M3 14h4v-4H3v4zm0 5h4v-4H3v4zM3 9h4V5H3v4zm5 5h13v-4H8v4zm0 5h13v-4H8v4zM8 5v4h13V5H8z',
    med: 'M19 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2zm-1 11h-4v4h-4v-4H6v-4h4V6h4v4h4v4z',
    sun: 'M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10zM2 13h2v-2H2v2zm18 0h2v-2h-2v2zM11 2v2h2V2h-2zm0 18v2h2v-2h-2zM6 5 4.6 3.6 3.6 4.6 5 6l1-1zm12.4 12.4 1.4 1.4 1-1-1.4-1.4-1 1zM19.4 4.6l-1-1L17 5l1 1 1.4-1.4zM5 18l1 1-1.4 1.4-1-1L5 18z'
  };
  var LOGO = '<svg viewBox="0 0 24 24" class="cw-lg" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M8.2 12.4l2.6 2.6 5-5.4"/></svg>';
  var MES = T(['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'], ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']);
  var MESA = T(['jan.', 'fev.', 'mar.', 'abr.', 'mai.', 'jun.', 'jul.', 'ago.', 'set.', 'out.', 'nov.', 'dez.'], ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']);
  var HOJE = new Date(); HOJE.setHours(12, 0, 0, 0);
  function dm(d) { return pad(d.getDate()) + '/' + pad(d.getMonth() + 1); }
  function dmy(d) { return dm(d) + '/' + d.getFullYear(); }
  function hm(x) { return pad(Math.floor(x / 60)) + ':' + pad(x % 60); }
  function sg(x) { return (x < 0 ? '-' : '') + hm(Math.abs(x)); }
  function agora() { var c = canoas(); return c.h * 60 + c.m; }
  function mesmoDia(a, b) { return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate(); }
  function rng(s) {
    var a = 2166136261;
    for (var i = 0; i < s.length; i++) { a ^= s.charCodeAt(i); a = Math.imul(a, 16777619); }
    return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  }

  var HOR = { adm: [510, 720, 780, 1098], loja: [420, 660, 720, 920], tarde: [820, 1080, 1140, 1320], mad: [240, 480, 540, 740], mot: [360, 660, 720, 920], ta: [360, 600, 660, 860], tb: [860, 1080, 1140, 1360], vis: [420, 720, 780, 1008] };
  var HORN = { adm: T('Padrão · seg a sex', 'Standard · Mon–Fri'), loja: T('Escala 6x1', '6x1 roster'), tarde: T('Escala 6x1 · tarde', '6x1 roster · late'), mad: T('Madrugada · 6x1', 'Early · 6x1'), mot: T('Motorista · 12x36', 'Driver · 12x36'), ta: T('Turno A', 'Shift A'), tb: T('Turno B', 'Shift B'), vis: T('Livre · home office', 'Flexible · home office') };
  var VISITANTE = [99, T('Visitante', 'Visitor'), T('Visitante do portfólio', 'Portfolio visitor'), -1, 'vis', 0];
  var TEN = {
    mercado: { nome: 'Mercado Demo Ltda', ori: 'rep', est: [T('Loja Centro', 'Downtown store'), T('Loja Bairro', 'Uptown store')], gente: [
      [14, 'Ana Ribeiro', T('Operadora de caixa', 'Cashier'), 0, 'loja', 1],
      [27, 'Bruno Costa', T('Repositor', 'Stock clerk'), 0, 'loja', 1, 'atestado'],
      [31, 'Carla Nunes', T('Fiscal de loja', 'Floor supervisor'), 1, 'tarde', 0],
      [38, 'Diego Martins', T('Açougueiro', 'Butcher'), 0, 'loja', 1],
      [45, 'Elaine Prado', T('Padeira', 'Baker'), 1, 'mad', 1],
      [52, 'Fábio Teles', T('Gerente de loja', 'Store manager'), 0, 'adm', 1],
      [66, 'Gisele Moraes', T('Operadora de caixa', 'Cashier'), 1, 'tarde', 0, 'falta'],
      [71, 'Henrique Alves', T('Auxiliar de padaria', 'Bakery assistant'), 1, 'mad', 0, 'ferias'],
      VISITANTE
    ] },
    transp: { nome: 'Transportes Demo Ltda', ori: 'app', est: [T('Matriz', 'Head office'), T('Filial Sul', 'South branch')], gente: [
      [103, 'Igor Pacheco', T('Motorista', 'Driver'), 0, 'mot', 1],
      [108, 'Júlia Campos', T('Despachante', 'Dispatcher'), 0, 'adm', 1],
      [115, 'Kleber Souza', T('Mecânico', 'Mechanic'), 1, 'adm', 0],
      [121, 'Lívia Rocha', T('Analista de frota', 'Fleet analyst'), 0, 'adm', 1, 'atestado'],
      [126, 'Márcio Dias', T('Motorista', 'Driver'), 1, 'mot', 1],
      [133, 'Natália Freitas', T('Auxiliar de logística', 'Logistics assistant'), 0, 'loja', 0],
      [140, 'Otávio Lemos', T('Motorista', 'Driver'), 1, 'mot', 0, 'ferias'],
      [147, 'Priscila Moura', T('Conferente', 'Checker'), 0, 'tarde', 1, 'falta']
    ] },
    fabrica: { nome: 'Indústria Demo S.A.', ori: 'rep', est: [T('Planta 1', 'Plant 1'), T('Planta 2', 'Plant 2')], gente: [
      [201, 'Rafael Antunes', T('Eletricista', 'Electrician'), 0, 'adm', 1],
      [204, 'Sabrina Lopes', T('Técnica de qualidade', 'Quality technician'), 0, 'ta', 1],
      [209, 'Tiago Barros', T('Operador de empilhadeira', 'Forklift operator'), 1, 'ta', 0],
      [213, 'Úrsula Mota', T('Analista de PCP', 'Planning analyst'), 0, 'adm', 1, 'atestado'],
      [218, 'Vítor Gomes', T('Supervisor de turno', 'Shift supervisor'), 1, 'tb', 1],
      [222, 'Wesley Cardoso', T('Torneiro', 'Lathe operator'), 1, 'tb', 0],
      [230, 'Yara Fontes', T('Operadora de máquina', 'Machine operator'), 0, 'ta', 1, 'falta'],
      [236, 'Zeca Moreira', T('Soldador', 'Welder'), 1, 'tb', 1]
    ] }
  };
  var VIS = [{ t: 426, c: 'RHO' }, { t: 734, c: 'RHO' }, { t: 777, c: 'RHO' }];
  var NOT = [];
  var st = { ten: 'mercado', v: 'painel', abertas: ['painel'], fechados: {}, filtros: {}, grupos: {}, mes: 0, dia: 0, colQ: '', conQ: '', est: '', fotos: {}, nao: 0 };
  var NAV = [['inicio', P.bookmark, T('Início', 'Home')], ['painel', P.dash, T('Painel', 'Dashboard')], ['colab', P.people, T('Colaboradores', 'Employees')], ['con', P.eye, T('Consulta diária', 'Daily view')], ['inc', P.warn, T('Inconsistências', 'Exceptions')], ['man', P.edit, T('Manutenção', 'Maintenance')], ['esp', P.print, T('Espelho do ponto', 'Timesheet')]];
  var NOMEV = { painel: T('Painel', 'Dashboard'), colab: T('Colaboradores', 'Employees'), con: T('Consulta diária', 'Daily view'), inc: T('Inconsistências', 'Exceptions') };
  var GRUPOS = [[T('Principal', 'Main'), T('Cadastros', 'Records')], [T('Ponto', 'Time'), T('Fechamento', 'Closing'), T('BH', 'HB'), T('Escalas', 'Rosters')], ['App', T('Documentos', 'Documents'), 'VTs', 'VRs'], [T('Configurações', 'Settings'), T('Segurança', 'Security'), T('Avançado', 'Advanced')]];

  function ten() { return TEN[st.ten]; }
  function est(p) { return p[3] < 0 ? 'Home office' : ten().est[p[3]]; }
  function horTxt(k) { var h = HOR[k]; return hm(h[0]) + ' ' + hm(h[1]) + '; ' + hm(h[2]) + ' ' + hm(h[3]); }
  function prevMin(k) { var h = HOR[k]; return h[1] - h[0] + h[3] - h[2]; }
  function diaSel() { var d = new Date(HOJE); d.setDate(d.getDate() + st.dia); return d; }
  function linha(p, d) {
    var hj = mesmoDia(d, HOJE), lim = hj ? agora() : 2000, dow = d.getDay(), folga = dow === 0 || (dow === 6 && (p[4] === 'adm' || p[4] === 'vis'));
    var h = HOR[p[4]], prev = folga ? 0 : prevMin(p[4]), bs = [], af = folga ? 'folga' : p[6] || '';
    if (p[0] === 99) {
      if (hj) bs = VIS.map(function (b) { return { t: b.t, o: 'app', c: b.c, novo: b.novo }; });
      else if (!folga) { var rv = rng('vis' + dmy(d)); bs = h.map(function (t) { return { t: t + Math.round((rv() - .5) * 16), o: 'app', c: 'RHO' }; }); }
    } else if (af !== 'falta' && af !== 'ferias' && af !== 'folga') {
      var r = rng(p[1] + dmy(d)), ori = ten().ori;
      for (var i = 0; i < 4; i++) {
        var t = h[i] + Math.round((r() - .55) * 16);
        if ((af === 'atestado' && i >= 2) || t > lim) break;
        bs.push({ t: t, o: ori, c: ori === 'app' ? 'RSE' : '' });
      }
    }
    var trab = 0;
    for (var j = 0; j + 1 < bs.length; j += 2) trab += bs[j + 1].t - bs[j].t;
    var abono = af === 'atestado' ? h[3] - h[2] : 0;
    var saldo = af === 'ferias' || af === 'folga' ? 0 : trab + abono - prev;
    return { p: p, bs: bs, trab: trab, prev: prev, saldo: saldo, af: af, abono: abono, inc: bs.length % 2 === 1 || af === 'falta' };
  }
  function linhas() { var d = diaSel(); return ten().gente.map(function (p) { return linha(p, d); }); }

  var AVC = {};
  function avatar(p) {
    if (AVC[p[1]]) return AVC[p[1]];
    var r = rng('av' + p[1]), c = document.createElement('canvas'), g = c.getContext('2d');
    c.width = c.height = 12;
    function pick(a) { return a[Math.floor(r() * a.length)]; }
    var pele = pick(['#f1c7a5', '#e0a97f', '#c68863', '#8d5a3b', '#5e3a24']), cab = pick(['#2b1d14', '#4a2f1d', '#7a4b26', '#c99a5b', '#1a1a1a', '#8a8a8a']);
    g.fillStyle = pick(['#cfe0f5', '#f5dccf', '#d9efd6', '#ece0f5', '#f5efcf']); g.fillRect(0, 0, 12, 12);
    g.fillStyle = pick(['#5b6b84', '#8a4f4f', '#3f7a5a', '#6a5a8a', '#b07a3a']); g.fillRect(1, 10, 10, 2);
    g.fillStyle = pele; g.fillRect(5, 8, 2, 2); g.fillRect(3, 3, 6, 6);
    g.fillStyle = cab; g.fillRect(3, 2, 6, 2); g.fillRect(2, 3, 1, 2); g.fillRect(9, 3, 1, 2);
    if (r() < .45) { g.fillRect(2, 5, 1, 5); g.fillRect(9, 5, 1, 5); }
    g.fillStyle = '#1b1b1b'; g.fillRect(4, 5, 1, 1); g.fillRect(7, 5, 1, 1);
    if (r() < .3) { g.fillStyle = '#3a3a3a'; g.fillRect(3, 5, 6, 1); g.fillStyle = '#9fc3e8'; g.fillRect(4, 5, 1, 1); g.fillRect(7, 5, 1, 1); }
    g.fillStyle = '#a0524a'; g.fillRect(5, 7, 2, 1);
    return (AVC[p[1]] = c.toDataURL());
  }
  function foto(p, vazia) { return '<span class="cw-av">' + (p[5] && !vazia ? '<img alt="" src="' + avatar(p) + '">' : sv(P.person)) + '</span>'; }

  win.innerHTML =
    '<div class="cw-bar">' +
      '<span class="cw-logo">' + LOGO + '<b>Símix</b><sup>®</sup></span>' +
      '<span class="cw-mods x2"><i>' + sv(P.globe) + '</i><i>' + sv(P.person) + '</i><i>' + sv(P.chart) + '</i><i>' + sv(P.shield) + '</i></span>' +
      '<span class="cw-sp"></span>' +
      '<button type="button" class="cw-ten" id="cwTen" aria-haspopup="true" aria-expanded="false"><span id="cwTenN"></span>' + sv(P.drop) + '</button>' +
      '<i class="x1">' + sv(P.search) + '</i>' +
      '<button type="button" class="cw-ib" id="cwSync" aria-label="' + T('Sincronizar', 'Sync') + '">' + sv(P.sync) + '</button>' +
      '<span class="cw-per x1">' + sv(P.filter) + '<b>' + MESA[HOJE.getMonth()] + '/' + HOJE.getFullYear() + '</b></span>' +
      '<i class="x2">' + sv(P.tune) + '</i><span class="cw-chat x2">' + sv(P.headset) + 'CHAT</span><i class="x2">' + sv(P.feedback) + '</i><i class="x2">' + sv(P.help) + '</i>' +
      '<button type="button" class="cw-ib cw-bell" id="cwBell" aria-label="' + T('Notificações', 'Notifications') + '" aria-expanded="false">' + sv(P.bell) + '<em id="cwBadge" hidden></em></button>' +
      '<i class="x2">' + sv(P.full) + '</i><span class="cw-avt">V</span>' +
      '<div class="cw-pop cw-tenm" id="cwTenM" hidden></div><div class="cw-pop cw-notm" id="cwNotM" hidden></div>' +
    '</div>' +
    '<div class="cw-mod">' + GRUPOS.map(function (g, i) { return '<span class="cw-g">' + g.map(function (x, j) { return '<button type="button" data-mod="' + i + j + '"' + (i + j === 0 ? ' class="on"' : '') + '>' + x + '</button>'; }).join('') + '</span>'; }).join('') + '</div>' +
    '<nav class="cw-nav" id="cwNav" aria-label="' + T('Menu do portal', 'Portal menu') + '">' + NAV.map(function (n) { return '<button type="button" data-v="' + n[0] + '">' + sv(n[1]) + '<span>' + n[2] + '</span>' + sv(P.drop) + '</button>'; }).join('') + '</nav>' +
    '<div class="cw-open" id="cwOpen"></div>' +
    '<div class="cw-load" id="cwLoad"></div>' +
    '<div class="cw-main" id="cwMain"></div>' +
    '<div class="cw-snack" id="cwSnack" role="status"></div>';

  function card(id, ico, tit, corpo) {
    var off = st.fechados[id];
    return '<section class="cw-card' + (off ? ' off' : '') + '" data-card="' + id + '"><header><span class="cw-ct">' + sv(P[ico]) + '<b>' + tit + '</b></span><span class="cw-ca">' +
      '<button type="button" data-busca="' + id + '" aria-label="' + T('Filtrar', 'Filter') + '">' + sv(P.search) + '</button><i>' + sv(P.open) + '</i><i>' + sv(P.more) + '</i>' +
      '<button type="button" data-fecha="' + id + '" aria-expanded="' + !off + '" aria-label="' + T('Recolher ', 'Collapse ') + tit + '">' + sv(P.less) + '</button></span></header>' +
      '<div class="cw-fil"' + (st.filtros[id] != null ? '' : ' hidden') + '><input type="search" data-filtro="' + id + '" placeholder="' + T('Filtrar…', 'Filter…') + '" value="' + esc(st.filtros[id] || '') + '"></div>' +
      '<div class="cw-cb">' + corpo + '</div></section>';
  }
  function tabela(cab, rows, vazio) {
    return '<div class="cw-scroll"><table class="cw-t"><thead><tr>' + cab.map(function (c) { return '<th>' + c + '</th>'; }).join('') + '</tr></thead><tbody>' +
      (rows.length ? rows.join('') : '<tr><td colspan="' + cab.length + '" class="cw-vazio">' + (vazio || T('Nenhum registro encontrado', 'No records found')) + '</td></tr>') + '</tbody></table></div>';
  }
  function tr(cells, txt, cls) { return '<tr data-txt="' + esc(txt.toLowerCase()) + '"' + (cls ? ' class="' + cls + '"' : '') + '>' + cells.map(function (c) { return '<td>' + c + '</td>'; }).join('') + '</tr>'; }
  function seta(t, up) { return t + ' <span class="cw-ord">' + (up ? '↑' : '↓') + '</span>'; }
  function ultimos() {
    var lim = agora(), regs = [];
    ten().gente.forEach(function (p) { linha(p, HOJE).bs.forEach(function (b) { if (b.t <= lim || p[0] === 99) regs.push([p[1], b.t, b.novo]); }); });
    regs.sort(function (a, b) { return b[1] - a[1]; });
    return tabela([T('Nome', 'Name'), seta(T('DataHora', 'DateTime'))], regs.slice(0, 9).map(function (r) { return tr([esc(r[0]), dm(HOJE) + ' ' + hm(r[1]) + (r[2] ? ' <span class="cw-app">app</span>' : '')], r[0], r[2] ? 'novo' : ''); }));
  }
  function mesRef() { return new Date(HOJE.getFullYear(), HOJE.getMonth() + st.mes, 1); }
  function noturno() {
    var m = mesRef(), r = rng('not' + st.ten + m.getMonth()), rows = [];
    var cand = ten().gente.filter(function (p) { return !p[6] && (p[4] === 'mad' || p[4] === 'tb' || p[4] === 'mot'); });
    var ult = st.mes === 0 ? HOJE.getDate() : 28;
    for (var i = 0; i < 4 && cand.length; i++) {
      var p = cand[(i + Math.floor(r() * 2)) % cand.length], d = new Date(m.getFullYear(), m.getMonth(), 1 + Math.floor(r() * ult));
      var v = p[4] === 'mad' ? 50 + Math.floor(r() * 25) : p[4] === 'tb' ? 30 + Math.floor(r() * 18) : 60 + Math.floor(r() * 220);
      rows.push([p, d, v]);
    }
    rows.sort(function (a, b) { return a[0][1] < b[0][1] ? -1 : 1; });
    return tabela(['CdFunc', seta('FuncNome', 1), T('Data', 'Date'), 'HrAdNot'], rows.map(function (x) { return tr([x[0][0], esc(x[0][1]), dm(x[1]), hm(x[2])], x[0][1]); }));
  }
  function vencimento() {
    var r = rng('venc' + st.ten), g = ten().gente.filter(function (p) { return p[0] !== 99 && !p[6]; }), rows = [];
    for (var i = 0; i < 2; i++) {
      var p = g.splice(Math.floor(r() * g.length), 1)[0], dias = r() < .5 ? 45 : 90, d = new Date(HOJE); d.setDate(d.getDate() + 3 + Math.floor(r() * 30));
      var adm = new Date(d); adm.setDate(adm.getDate() - dias);
      rows.push(tr([esc(p[1]), dm(d), dias, dm(adm)], p[1]));
    }
    return tabela([seta(T('Nome', 'Name'), 1), T('Data', 'Date'), T('Dias', 'Days'), T('Admissão', 'Hired')], rows);
  }
  function porCargo() {
    var gr = {}, ord = [];
    ten().gente.forEach(function (p) { if (!gr[p[2]]) { gr[p[2]] = []; ord.push(p[2]); } gr[p[2]].push(p); });
    return '<ul class="cw-gr">' + ord.map(function (c, i) {
      var ab = st.grupos[st.ten + i];
      return '<li data-txt="' + esc((c + ' ' + gr[c].map(function (p) { return p[1]; }).join(' ')).toLowerCase()) + '"><button type="button" data-grupo="' + i + '" aria-expanded="' + !!ab + '">' + sv(ab ? P.drop : P.right) + '<b>' + esc(c) + '</b> <span>(' + gr[c].length + ' ' + (gr[c].length > 1 ? T('registros', 'records') : T('registro', 'record')) + ')</span></button>' +
        (ab ? '<ul>' + gr[c].map(function (p) { return '<li>' + p[0] + ' · ' + esc(p[1]) + '</li>'; }).join('') + '</ul>' : '') + '</li>';
    }).join('') + '</ul>';
  }
  function banco() {
    var m = mesRef(), rows = ten().gente.filter(function (p) { return p[0] !== 99; }).map(function (p) { var r = rng('bh' + p[1] + m.getMonth()); return [p, Math.round(r() * 15000 - 1800)]; });
    rows.sort(function (a, b) { return b[1] - a[1]; });
    return tabela([T('Código', 'Code'), T('Nome', 'Name'), '<span class="x3">' + T('Estabelecimento', 'Site') + '</span>', seta(T('Saldo', 'Balance'))], rows.map(function (x) {
      var v = x[1], s = (v < 0 ? '-' : '') + Math.floor(Math.abs(v) / 60) + ':' + pad(Math.abs(v) % 60);
      return tr([x[0][0], esc(x[0][1]), '<span class="x3">' + esc(est(x[0])) + '</span>', '<b class="' + (v < 0 ? 'neg' : 'red') + '">' + s + '</b>'], x[0][1]);
    }));
  }
  function vPainel() {
    var m = mesRef();
    return '<div class="cw-fb"><i>' + sv(P.filter) + '</i><button type="button" class="cw-ib2" data-mes="-1" aria-label="' + T('Mês anterior', 'Previous month') + '">' + sv(P.left) + '</button>' +
      '<span class="cw-chip">' + sv(P.cal) + T('Período: ', 'Period: ') + pad(m.getMonth() + 1) + '/' + m.getFullYear() + sv(P.cancel) + '</span>' +
      '<button type="button" class="cw-ib2" data-mes="1" aria-label="' + T('Próximo mês', 'Next month') + '">' + sv(P.right) + '</button>' +
      '<span class="cw-chip x1">' + sv(P.biz) + T('Estabelecimento', 'Site') + sv(P.cancel) + '</span><span class="cw-chip x1">' + sv(P.tree) + T('Departamentos', 'Departments') + sv(P.cancel) + '</span>' +
      '<span class="cw-sp"></span><span class="cw-dash">' + T('Meu Dashboard', 'My dashboard') + '</span><i class="x1">' + sv(P.refresh) + '</i><i>' + sv(P.more) + '</i></div>' +
      '<div class="cw-cards">' +
        card('ult', 'table', T('Últimos Registros', 'Latest punches'), ultimos()) +
        card('not', 'table', T('Adicional noturno por dia', 'Night premium by day'), noturno()) +
        card('venc', 'table', T('Vencimento de contrato', 'Contract expiry'), vencimento()) +
        card('cargo', 'table', T('Colaboradores por Cargo', 'Employees by role'), porCargo()) +
        card('bh', 'table', T('Banco de Horas', 'Hour bank'), banco()) +
        card('mapa', 'map', T('Mapa de Registros (GPS)', 'Punch map (GPS)'), '<div class="cw-mapa"><canvas data-mapa></canvas><p class="cw-mapv" hidden>' + T('Nenhum registro com GPS hoje: aqui o ponto é no relógio.', 'No GPS punches today: here people clock in on the time clock.') + '</p></div>') +
      '</div>';
  }
  function rowsColab() {
    var qv = st.colQ.toLowerCase(), g = ten().gente.filter(function (p) { return !qv || (p[1] + ' ' + p[2] + ' ' + p[0]).toLowerCase().indexOf(qv) >= 0; });
    var vazia = !st.fotos[st.ten];
    q('#cwColN') && (q('#cwColN').textContent = (g.length ? '1-' + g.length : '0') + T(' de ', ' of ') + g.length);
    return g.length ? g.map(function (p) {
      var r = rng('alt' + p[1]), d = new Date(HOJE); d.setDate(d.getDate() - 2 - Math.floor(r() * 60));
      return '<tr><td><span class="cw-act"><i>' + sv(P.edit) + '</i><i>' + sv(P.drop) + '</i></span></td><td>' + foto(p, vazia) + '</td><td>' + p[0] + '</td><td><button type="button" class="cw-link" data-nome="' + esc(p[1]) + '">' + esc(p[1]) + '</button></td><td>' + esc(p[2]) + '</td><td class="x3">' + esc(est(p)) + '</td><td class="x4">' + esc(HORN[p[4]]) + ': ' + horTxt(p[4]) + '</td><td class="x4">' + dm(d) + ' ' + hm(480 + Math.floor(r() * 600)) + '</td></tr>';
    }).join('') : '<tr><td colspan="8" class="cw-vazio">' + T('Nenhum registro encontrado', 'No records found') + '</td></tr>';
  }
  function vColab() {
    var m = mesRef();
    return '<div class="cw-panel"><div class="cw-tb"><h3>' + T('Colaboradores', 'Employees') + sv(P.school) + '</h3>' +
      '<span class="cw-vis x1">' + sv(P.viewlist) + T('VISÕES', 'VIEWS') + sv(P.drop) + '</span>' +
      '<span class="cw-per2 x1">' + sv(P.left) + pad(m.getMonth() + 1) + ' - ' + MES[m.getMonth()] + sv(P.drop) + sv(P.right) + '</span>' +
      '<span class="cw-chipo x1">' + T('Ativos', 'Active') + ' ✕ ' + sv(P.drop) + '</span><span class="cw-sp"></span>' +
      '<label class="cw-search">' + sv(P.search) + '<input type="search" id="cwColQ" placeholder="' + T('Pesquisar', 'Search') + '" value="' + esc(st.colQ) + '" aria-label="' + T('Pesquisar colaborador', 'Search employee') + '"></label>' +
      '<button type="button" class="cw-novo" data-snack="novo">' + sv(P.add) + T('NOVO', 'NEW') + '</button></div>' +
      '<div class="cw-scroll"><table class="cw-t cw-colab"><thead><tr><th>' + T('Ações', 'Actions') + '</th><th>' + T('Foto', 'Photo') + '</th><th>' + T('Código', 'Code') + '</th><th>' + T('Nome', 'Name') + '</th><th>' + T('Cargo', 'Role') + '</th><th class="x3">' + T('Estabelecimento', 'Site') + '</th><th class="x4">' + T('Horário', 'Schedule') + '</th><th class="x4">' + T('Alteração', 'Changed') + '</th></tr></thead><tbody id="cwColB"></tbody></table></div>' +
      '<div class="cw-pg"><span id="cwColN"></span><i>' + sv(P.left) + '</i><i>' + sv(P.right) + '</i></div></div>';
  }
  function badge(x) {
    if (x.af === 'atestado') return '<span class="cw-bd or">' + sv(P.med) + T('Atestado', 'Sick note') + ' (' + hm(x.abono) + ')</span>';
    if (x.af === 'falta') return '<span class="cw-bd cz">' + T('Falta', 'Absent') + '</span>';
    if (x.af === 'ferias') return '<span class="cw-bd az">' + sv(P.sun) + T('Férias', 'Vacation') + '</span>';
    if (x.af === 'folga') return '<span class="cw-bd cz">' + T('Folga', 'Day off') + '</span>';
    return '';
  }
  function rowsConsulta() {
    var inc = st.v === 'inc', qv = st.conQ.toLowerCase();
    var ls = linhas().filter(function (x) { return (!inc || x.inc) && (!st.est || est(x.p) === st.est) && (!qv || (x.p[1] + ' ' + x.p[2]).toLowerCase().indexOf(qv) >= 0); });
    var tot = { s: 0, e: 0, f: 0, pr: 0, fa: 0 };
    var html = ls.map(function (x) {
      tot.s += x.saldo; if (x.saldo > 0) tot.e += x.saldo; else tot.f -= x.saldo;
      if (x.bs.length) tot.pr++;
      if (x.af === 'falta') tot.fa++;
      var bs = x.bs.map(function (b) { return '<span class="cw-b' + (b.novo ? ' novo' : '') + '">' + sv(b.o === 'app' ? P.gps : P.clock) + hm(b.t) + (b.c ? ' <small>' + b.c + '</small>' : '') + '</span>'; }).join('') + (x.bs.length % 2 ? '<span class="cw-q">?</span>' : '');
      return '<tr' + (x.p[0] === 99 ? ' class="cw-voce"' : '') + '><td><span class="cw-act"><i>' + sv(P.open) + '</i><i>' + sv(P.drop) + '</i></span></td><td><span class="cw-nm">' + foto(x.p) + esc(x.p[1]) + '</span></td>' +
        '<td class="x3"><span class="cw-hp">' + horTxt(x.p[4]) + (x.p[4] === 'vis' ? sv(P.home) : '') + '</span></td><td class="cw-bs">' + bs + '</td><td class="x4">' + hm(x.prev) + '</td><td>' + (x.trab ? hm(x.trab) : '') + '</td>' +
        '<td><b class="' + (x.saldo < 0 ? 'neg' : x.saldo > 0 ? 'pos' : '') + '">' + sg(x.saldo) + '</b></td><td>' + badge(x) + '</td></tr>';
    }).join('');
    q('#cwConB').innerHTML = html || '<tr><td colspan="8" class="cw-vazio">' + (inc ? T('Nenhuma inconsistência neste dia.', 'No exceptions on this day.') : T('Nenhum registro encontrado', 'No records found')) + '</td></tr>';
    q('#cwTot').innerHTML = [[T('Saldo', 'Balance'), sg(tot.s)], [T('Horas extras', 'Overtime'), hm(tot.e)], [T('Horas faltas', 'Missing hours'), hm(tot.f)], [T('Adicional noturno', 'Night premium'), '00:00'], [T('Total de presenças', 'Present'), tot.pr], [T('Total de faltas', 'Absences'), tot.fa]].map(function (r) { return '<div><span>' + r[0] + '</span><b>' + r[1] + '</b></div>'; }).join('');
  }
  function vConsulta() {
    var inc = st.v === 'inc', d = diaSel();
    return '<div class="cw-panel"><div class="cw-tb"><h3>' + (inc ? T('Inconsistências', 'Exceptions') : T('Consulta diária', 'Daily view')) + sv(P.school) + '</h3>' +
      '<span class="cw-fld"><small>' + T('Data', 'Date') + '</small><button type="button" data-dia="-1" aria-label="' + T('Dia anterior', 'Previous day') + '">' + sv(P.left) + '</button><b>' + dmy(d) + '</b>' + sv(P.cal) + '<button type="button" data-dia="1" aria-label="' + T('Próximo dia', 'Next day') + '"' + (st.dia >= 0 ? ' disabled' : '') + '>' + sv(P.right) + '</button></span>' +
      '<label class="cw-fld cw-sel"><small>' + T('Estabelecimento', 'Site') + '</small><select id="cwEst"><option value="">' + T('Todos', 'All') + '</option>' + ten().est.concat(st.ten === 'mercado' ? ['Home office'] : []).map(function (e) { return '<option' + (e === st.est ? ' selected' : '') + '>' + esc(e) + '</option>'; }).join('') + '</select></label>' +
      '<span class="cw-fld x1"><small>' + T('Departamento', 'Department') + '</small><b class="cw-ph">' + T('Departamento', 'Department') + '</b>' + sv(P.search) + '</span>' +
      '<span class="cw-sp"></span><label class="cw-search">' + sv(P.search) + '<input type="search" id="cwConQ" placeholder="' + T('Pesquisar', 'Search') + '" value="' + esc(st.conQ) + '" aria-label="' + T('Pesquisar na consulta', 'Search the daily view') + '"></label>' +
      '<button type="button" class="cw-ib2" data-recarrega aria-label="' + T('Recarregar', 'Reload') + '">' + sv(P.refresh) + '</button><i class="x1">' + sv(P.cols) + '</i></div>' +
      '<div class="cw-scroll"><table class="cw-t cw-con"><thead><tr><th>' + T('Ações', 'Actions') + '</th><th>' + T('Nome', 'Name') + '</th><th class="x3">' + T('Horário Prev.', 'Planned') + '</th><th>' + T('Horário Trab.', 'Worked') + '</th><th class="x4">' + T('Horas Prev.', 'Planned h') + '</th><th>' + T('Horas Trab.', 'Worked h') + '</th><th>' + T('Saldo', 'Balance') + '</th><th>' + T('Afastamento', 'Leave') + '</th></tr></thead>' +
      '<tbody id="cwConB"><tr><td colspan="8" class="cw-vazio"><span class="cw-prog"></span>' + T('Carregando…', 'Loading…') + '</td></tr></tbody></table></div>' +
      '<div class="cw-tot"><h4>' + T('Totais', 'Totals') + '</h4><div id="cwTot"></div></div></div>';
  }
  function desenhaMapa() {
    var cv = q('[data-mapa]');
    if (!cv) return;
    var w = cv.clientWidth, h = cv.clientHeight;
    if (!w || !h) return;
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
    var c = cv.getContext('2d'), r = rng('mapa');
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.fillStyle = '#eef0ea'; c.fillRect(0, 0, w, h);
    for (var i = 0; i < 9; i++) { c.fillStyle = i % 3 ? '#e4e2dc' : '#d5ead0'; c.beginPath(); c.ellipse(r() * w, r() * h, 20 + r() * 50, 12 + r() * 30, r() * 3, 0, 6.3); c.fill(); }
    c.strokeStyle = '#aad3f2'; c.lineWidth = 10; c.lineCap = 'round';
    c.beginPath(); c.moveTo(-10, h * .82); c.bezierCurveTo(w * .3, h * .58, w * .5, h * 1.02, w + 10, h * .66); c.stroke();
    c.strokeStyle = '#fff'; c.lineWidth = 3;
    for (i = 0; i < 7; i++) { c.beginPath(); var y = r() * h; c.moveTo(0, y); c.lineTo(w, y + (r() - .5) * 80); c.stroke(); }
    for (i = 0; i < 6; i++) { c.beginPath(); var x = r() * w; c.moveTo(x, 0); c.lineTo(x + (r() - .5) * 90, h); c.stroke(); }
    c.strokeStyle = '#f6cf77'; c.lineWidth = 4;
    c.beginPath(); c.moveTo(w * .55, -5); c.bezierCurveTo(w * .5, h * .4, w * .62, h * .6, w * .58, h + 5); c.stroke();
    var pins = [];
    ten().gente.forEach(function (p) {
      var x = linha(p, HOJE);
      if (!x.bs.length || x.bs[0].o !== 'app') return;
      var rp = rng('pin' + p[1]);
      pins.push([p[0] === 99 ? w * .5 : 20 + rp() * (w - 40), p[0] === 99 ? h * .45 : 18 + rp() * (h - 30), p[0] === 99]);
    });
    pins.forEach(function (pn) {
      var x = pn[0], y = pn[1], cor = pn[2] ? '#e53935' : '#1e6fd9';
      c.fillStyle = 'rgba(0,0,0,.18)'; c.beginPath(); c.ellipse(x, y + 1, 4, 1.6, 0, 0, 6.3); c.fill();
      c.fillStyle = cor; c.beginPath(); c.arc(x, y - 11, 6, Math.PI * .85, Math.PI * 2.15); c.lineTo(x, y); c.closePath(); c.fill();
      c.fillStyle = '#fff'; c.beginPath(); c.arc(x, y - 11, 2.2, 0, 6.3); c.fill();
      if (pn[2]) { c.font = '600 10px Roboto,"Segoe UI",sans-serif'; c.fillStyle = '#b71c1c'; c.textAlign = 'left'; c.fillText(T('você', 'you'), x + 8, y - 8); }
    });
    q('.cw-mapv').hidden = pins.length > 0;
  }
  function pintaTopo() {
    q('#cwTenN').textContent = ten().nome;
    var b = q('#cwBadge'), n = st.ten === 'mercado' ? st.nao : 0;
    b.hidden = !n; b.textContent = n;
    $$('#cwNav [data-v]', win).forEach(function (x) {
      var v = x.getAttribute('data-v'), on = v === st.v;
      x.classList.toggle('on', on);
      if (on) x.setAttribute('aria-current', 'page'); else x.removeAttribute('aria-current');
    });
    q('#cwOpen').innerHTML = st.abertas.map(function (v) { return '<button type="button" data-v="' + v + '"' + (v === st.v ? ' class="on"' : '') + '>' + NOMEV[v] + sv(P.drop) + '</button>'; }).join('');
  }
  function barra(ms) {
    var b = q('#cwLoad');
    b.classList.remove('on'); void b.offsetWidth; b.classList.add('on');
    clearTimeout(b._t); b._t = setTimeout(function () { b.classList.remove('on'); }, ms || 500);
  }
  var carga = null;
  function render() {
    var m = q('#cwMain');
    clearTimeout(carga);
    m.innerHTML = st.v === 'painel' ? vPainel() : st.v === 'colab' ? vColab() : vConsulta();
    m.scrollTop = 0;
    pintaTopo();
    if (st.v === 'painel') requestAnimationFrame(desenhaMapa);
    if (st.v === 'colab') {
      q('#cwColB').innerHTML = rowsColab();
      if (!st.fotos[st.ten]) carga = setTimeout(function () { st.fotos[st.ten] = 1; if (q('#cwColB')) q('#cwColB').innerHTML = rowsColab(); }, lento ? 0 : 450);
    }
    if (st.v === 'con' || st.v === 'inc') carga = setTimeout(function () { if (q('#cwConB')) rowsConsulta(); }, lento ? 0 : 650);
  }
  function vai(v) {
    if (v === 'inicio') v = 'painel';
    if (v === 'man') { snack(T('Manutenção fica fora desta demo.', 'Maintenance is not part of this demo.')); return; }
    if (v === 'esp') { snack(T('O meu espelho de ponto está lá embaixo.', 'My own timesheet is further down.'), '#espelho', T('ver ↓', 'see ↓')); return; }
    if (st.abertas.indexOf(v) < 0) st.abertas.push(v);
    st.v = v;
    barra(st.v === 'con' || st.v === 'inc' ? 700 : 400);
    render();
  }
  function snack(txt, href, lbl) {
    var s = q('#cwSnack');
    s.innerHTML = esc(txt) + (href ? ' <a href="' + href + '">' + esc(lbl) + '</a>' : '');
    s.classList.add('on');
    clearTimeout(s._t); s._t = setTimeout(function () { s.classList.remove('on'); }, href ? 5200 : 3200);
  }
  function fechaPops(menos) {
    [['#cwTenM', '#cwTen'], ['#cwNotM', '#cwBell']].forEach(function (x) { if (x[0] !== menos) { q(x[0]).hidden = true; q(x[1]).setAttribute('aria-expanded', 'false'); } });
  }
  function abrePop(sel, btn, html) {
    var p = q(sel), aberto = !p.hidden;
    fechaPops(sel);
    if (aberto) { p.hidden = true; q(btn).setAttribute('aria-expanded', 'false'); return; }
    p.innerHTML = html; p.hidden = false; q(btn).setAttribute('aria-expanded', 'true');
    var b = q(btn);
    p.style.left = Math.max(8, Math.min(win.clientWidth - p.offsetWidth - 8, b.offsetLeft + b.offsetWidth - p.offsetWidth)) + 'px';
  }
  function troca(k) {
    fechaPops();
    if (k === st.ten) return;
    st.ten = k; st.colQ = ''; st.conQ = ''; st.est = ''; st.filtros = {};
    barra(700);
    render();
    snack(T('Agora em ', 'Now in ') + ten().nome + T('. Mesma plataforma; cada empresa só vê os dados dela.', '. Same platform; each company only sees its own data.'));
  }

  win.addEventListener('click', function (e) {
    var b = e.target.closest('button,a');
    if (!b || !win.contains(b)) { if (!e.target.closest('.cw-pop')) fechaPops(); return; }
    if (b.id === 'cwTen') { Som.play('clic'); abrePop('#cwTenM', '#cwTen', Object.keys(TEN).map(function (k) { return '<button type="button" data-ten="' + k + '">' + (k === st.ten ? '✓ ' : '') + esc(TEN[k].nome) + '</button>'; }).join('')); return; }
    if (b.id === 'cwBell') {
      Som.play('clic');
      var lst = st.ten === 'mercado' ? NOT : [];
      abrePop('#cwNotM', '#cwBell', '<h5>' + T('Notificações', 'Notifications') + '</h5>' + (lst.length ? lst.map(function (n) { return '<p><b>' + T('Visitante', 'Visitor') + '</b> ' + T('registrou ponto às ', 'clocked in at ') + n.h + ' · ' + esc(n.tipo) + T(' · pelo app', ' · from the app') + '</p>'; }).join('') : '<p class="cw-vazio">' + T('Nenhuma notificação. Bata o ponto no app ali em cima.', 'No notifications. Clock in on the app above.') + '</p>'));
      if (st.ten === 'mercado') { st.nao = 0; pintaTopo(); }
      return;
    }
    fechaPops();
    if (b.hasAttribute('data-ten')) { Som.play('blip'); troca(b.getAttribute('data-ten')); return; }
    if (b.hasAttribute('data-v')) { Som.play('blip'); vai(b.getAttribute('data-v')); return; }
    if (b.hasAttribute('data-mod')) { Som.play('clic'); if (b.getAttribute('data-mod') !== '00') snack(T('Esta demo mostra só o módulo Principal.', 'This demo only shows the Main module.')); return; }
    if (b.hasAttribute('data-fecha')) {
      var id = b.getAttribute('data-fecha'), c = b.closest('.cw-card');
      st.fechados[id] = !st.fechados[id];
      c.classList.toggle('off', !!st.fechados[id]); b.setAttribute('aria-expanded', !st.fechados[id]);
      Som.play('clic');
      if (id === 'mapa' && !st.fechados[id]) requestAnimationFrame(desenhaMapa);
      return;
    }
    if (b.hasAttribute('data-busca')) {
      var cid = b.getAttribute('data-busca'), f = b.closest('.cw-card').querySelector('.cw-fil');
      f.hidden = !f.hidden;
      if (f.hidden) { st.filtros[cid] = null; f.querySelector('input').value = ''; filtra(cid, ''); } else { st.filtros[cid] = st.filtros[cid] || ''; f.querySelector('input').focus(); }
      Som.play('clic');
      return;
    }
    if (b.hasAttribute('data-grupo')) { var g = st.ten + b.getAttribute('data-grupo'); st.grupos[g] = !st.grupos[g]; var cb = b.closest('.cw-cb'); cb.innerHTML = porCargo(); Som.play('clic'); return; }
    if (b.hasAttribute('data-mes')) { st.mes = Math.max(-11, Math.min(0, st.mes + +b.getAttribute('data-mes'))); Som.play('clic'); barra(400); render(); return; }
    if (b.hasAttribute('data-dia')) { st.dia = Math.min(0, st.dia + +b.getAttribute('data-dia')); Som.play('clic'); barra(700); render(); return; }
    if (b.hasAttribute('data-recarrega') || b.id === 'cwSync') { Som.play('clic'); if (b.id === 'cwSync') { b.classList.add('gira'); setTimeout(function () { b.classList.remove('gira'); }, 800); } barra(700); render(); return; }
    if (b.hasAttribute('data-nome')) { st.conQ = b.getAttribute('data-nome'); Som.play('blip'); vai('con'); return; }
    if (b.hasAttribute('data-snack')) { Som.play('erro'); snack(T('Cadastro desligado na demo. Os dados aqui são inventados.', 'Sign-up is off in the demo. The data here is made up.')); return; }
  });
  document.addEventListener('click', function (e) { if (!win.contains(e.target)) fechaPops(); });
  win.addEventListener('keydown', function (e) { if (e.key === 'Escape') fechaPops(); });
  function filtra(id, v) {
    v = v.toLowerCase();
    $$('[data-card="' + id + '"] [data-txt]', win).forEach(function (r) { r.hidden = !!v && r.getAttribute('data-txt').indexOf(v) < 0; });
  }
  win.addEventListener('input', function (e) {
    var t = e.target;
    if (t.hasAttribute('data-filtro')) { st.filtros[t.getAttribute('data-filtro')] = t.value; filtra(t.getAttribute('data-filtro'), t.value); }
    else if (t.id === 'cwColQ') { st.colQ = t.value; q('#cwColB').innerHTML = rowsColab(); }
    else if (t.id === 'cwConQ') { st.conQ = t.value; rowsConsulta(); }
  });
  win.addEventListener('change', function (e) { if (e.target.id === 'cwEst') { st.est = e.target.value; barra(400); rowsConsulta(); } });
  document.addEventListener('ponto', function (e) {
    var x = e.detail || {}, p = String(x.h || '').split(':'), t = +p[0] * 60 + +p[1];
    if (isNaN(t)) return;
    VIS.push({ t: t, c: x.tipo || 'RHO', novo: 1 });
    VIS.sort(function (a, b) { return a.t - b.t; });
    NOT.unshift({ h: x.h, tipo: x.tipo === 'RSE' ? T('Serviço externo', 'Field service') : T('Home office', 'Home office') });
    st.nao++;
    if (st.ten !== 'mercado') return;
    pintaTopo();
    if (st.v === 'painel') { var cb = q('[data-card="ult"] .cw-cb'); if (cb) { cb.innerHTML = ultimos(); if (st.filtros.ult) filtra('ult', st.filtros.ult); } desenhaMapa(); }
    else if ((st.v === 'con' || st.v === 'inc') && st.dia === 0 && q('#cwConB') && !q('.cw-prog')) rowsConsulta();
  });
  if ('ResizeObserver' in window) new ResizeObserver(function () { if (st.v === 'painel') desenhaMapa(); }).observe(q('#cwMain'));
  render();
})();

(function () {
  var out = $('#termOut'), form = $('#termForm'), inp = $('#termIn'), quick = $('#termQuick');
  if (!out) return;
  var hist = [], hi = 0;
  function p(html, cls) { var el = document.createElement('p'); if (cls) el.className = cls; el.innerHTML = html; out.appendChild(el); out.scrollTop = out.scrollHeight; }
  function link(h, t) { return '<a href="' + h + '"' + (/^https?:/.test(h) ? ' target="_blank" rel="noopener noreferrer"' : '') + '>' + t + '</a>'; }
  p(T('Oi, eu sou o Senna, o assistente do Vini. Ele me deixou aqui pra te atender.', 'Hi, I\'m Senna, Vini\'s assistant. He left me here to help you.'));
  p(T('Digite <b>ajuda</b> ou use os botões aqui embaixo.', 'Type <b>help</b> or use the buttons below.'), 'dim');
  var C = {
    ajuda: function () { p(T('comandos: sobre · projetos · contato · email · cv · github · linkedin · whatsapp · clima · hora · segredos · racco · limpar', 'commands: about · projects · contact · email · resume · github · linkedin · whatsapp · weather · time · secrets · racco · clear')); },
    sobre: function () { p(T('Vinícius Pires da Silva. Desenvolvedor C# e .NET, Pleno III na Símix, em Canoas, RS. Começou no suporte em 2020 e aprendeu sozinho.', 'Vinícius Pires da Silva. C# and .NET developer, mid-level III at Símix, in Canoas, Brazil. Started in support in 2020 and is self-taught.')); },
    projetos: function () { p([link('#banditboard', 'banditboard/'), link('#senna', 'senna/'), link('#hud', 'controlsensors/'), link('#app', 'simix-ponto/'), link('#ponto-cloud', 'simix-ponto-cloud/')].join('  ')); },
    contato: function () { p('e-mail: ' + link('mailto:' + EMAIL, EMAIL) + '\nwhatsapp: ' + link('https://wa.me/5551982515375', '+55 51 98251-5375') + '\nlinkedin: ' + link('https://www.linkedin.com/in/viniciuspiresdasilva/', 'in/viniciuspiresdasilva')); },
    email: function () { if (navigator.clipboard) navigator.clipboard.writeText(EMAIL).then(function () { p(T('Copiei o e-mail: ', 'Copied the email: ') + EMAIL); }, function () { p(EMAIL); }); else p(EMAIL); },
    cv: function () { p(link('/assets/Curriculo-Vinicius-Pires-da-Silva.pdf', T('Currículo em PDF ↓', 'Résumé in Portuguese ↓')) + '  ' + link('/assets/Resume-Vinicius-Pires-da-Silva.pdf', 'Résumé in English ↓')); },
    github: function () { p(link('https://github.com/suiciniv-dev', 'github.com/suiciniv-dev') + '  ' + link('https://github.com/simix-viniciussilva', 'github.com/simix-viniciussilva')); },
    linkedin: function () { p(link('https://www.linkedin.com/in/viniciuspiresdasilva/', 'linkedin.com/in/viniciuspiresdasilva')); },
    whatsapp: function () { p(link('https://wa.me/5551982515375', T('Abrir conversa no WhatsApp ↗', 'Open a WhatsApp chat ↗'))); },
    clima: function () { p(T('Canoas agora: ', 'Canoas right now: ') + climaTxt() + '.'); },
    hora: function () { var c = canoas(); p(T('Em Canoas são ', 'It\'s ') + pad(c.h) + ':' + pad(c.m) + T('.', ' in Canoas.')); },
    segredos: function () { p(T('Segredos: ', 'Secrets: ') + nAchados() + '/' + SEG.length + '.'); if (window.__abreSegredos) window.__abreSegredos(); },
    racco: function () { p('  ▄▀▀▀▀▀▀▄\n ▐ ▀▄  ▄▀ ▌\n  ▀▄▄▄▄▄▄▀\n' + T('O Racco mandou um oi.', 'Racco says hi.')); if (Cena) Cena.wave(); },
    limpar: function () { out.innerHTML = ''; },
    ls: function () { C.projetos(); },
    hesoyam: function () { if (Cena) Cena.hesoyam(); p(T('Vida, colete e R$ 250.000.', 'Health, armor and $250,000.')); },
    oi: function () { p(T('Oi! Digite ajuda.', 'Hi! Type help.')); }
  };
  var ALIAS = { help: 'ajuda', about: 'sobre', projects: 'projetos', contact: 'contato', resume: 'cv', weather: 'clima', time: 'hora', secrets: 'segredos', clear: 'limpar', cls: 'limpar', hi: 'oi', hello: 'oi', ola: 'oi', 'olá': 'oi', dir: 'ls', '?': 'ajuda' };
  function roda(raw) {
    var cmd = raw.trim(); if (!cmd) return;
    hist.push(cmd); hi = hist.length;
    p(esc(cmd), 'eu');
    var low = cmd.toLowerCase(), base = low.split(/\s+/)[0];
    if (base === 'sudo') { Som.play('erro'); conquista('sudo'); p(T('Boa tentativa. Este incidente será reportado ao Racco.', 'Nice try. This incident will be reported to Racco.')); return; }
    if (/^rm\s+-rf/.test(low)) { Som.play('erro'); p(T('Aqui não. Tenho backup no git.', 'Not here. I have backups in git.')); return; }
    var k = C[base] ? base : ALIAS[base];
    if (k && C[k]) { Som.play('blip'); C[k](); }
    else { Som.play('erro'); p(T('Comando não encontrado: ', 'Command not found: ') + esc(base) + T('. Digite ajuda.', '. Type help.'), 'dim'); }
  }
  form.addEventListener('submit', function (e) { e.preventDefault(); roda(inp.value); inp.value = ''; });
  inp.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowUp') { if (hi > 0) { hi--; inp.value = hist[hi]; } e.preventDefault(); }
    else if (e.key === 'ArrowDown') { if (hi < hist.length) { hi++; inp.value = hist[hi] || ''; } e.preventDefault(); }
  });
  quick.addEventListener('click', function (e) { var b = e.target.closest('[data-cmd]'); if (b) roda(b.getAttribute('data-cmd')); });
})();



(function () {
  var buf = '', k = 0;
  var KON = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
  document.addEventListener('keydown', function (e) {
    var t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
    var key = e.key && e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (key === KON[k]) { k++; if (k === KON.length) { k = 0; if (Cena) Cena.konami(); } }
    else k = key === KON[0] ? 1 : 0;
    if (key && key.length === 1) {
      buf = (buf + key).slice(-12);
      if (/hesoyam$/.test(buf)) { buf = ''; if (Cena) Cena.hesoyam(); }
    }
  });
})();

(function () {
  var barra = $('#barra');
  function upd() {
    var h = document.documentElement, max = h.scrollHeight - h.clientHeight;
    if (barra) barra.style.width = (max > 0 ? h.scrollTop / max * 100 : 0).toFixed(1) + '%';
  }
  addEventListener('scroll', upd, { passive: true }); addEventListener('resize', upd); upd();

  if (!('IntersectionObserver' in window)) { $$('.assina').forEach(function (a) { a.classList.add('on'); }); return; }
  var io = new IntersectionObserver(function (es) {
    es.forEach(function (e) {
      if (!e.isIntersecting) return;
      e.target.classList.add('on');
      io.unobserve(e.target);
    });
  }, { threshold: .35 });
  $$('.assina').forEach(function (el) { io.observe(el); });

  var links = $$('.nav a'), secs = links.map(function (a) { return document.getElementById(a.getAttribute('href').slice(1)); });
  var nav = new IntersectionObserver(function (es) {
    es.forEach(function (e) {
      if (!e.isIntersecting) return;
      var i = secs.indexOf(e.target);
      links.forEach(function (a, j) { if (j === i) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current'); });
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  secs.forEach(function (s) { if (s) nav.observe(s); });
})();

})();
