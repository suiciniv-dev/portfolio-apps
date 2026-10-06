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
  if (clima && Date.now() - clima.t < 30 * 60e3) return;
  if (!window.fetch) return;
  fetch('https://api.open-meteo.com/v1/forecast?latitude=-29.92&longitude=-51.18&current=temperature_2m,weather_code&timezone=America%2FSao_Paulo')
    .then(function (r) { return r.json(); })
    .then(function (j) {
      if (!j || !j.current) return;
      clima = { t: Date.now(), temp: Math.round(j.current.temperature_2m), code: j.current.weather_code };
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
    var px = x + 62;
    R(px, y + 5, 35, 33, '#0d1712');
    R(px, y + 5, 35, 7, '#14251b');
    txt(g, 'SENNA', px + 2, y + 6, '#5cf2a0');
    R(px + 3, y + 15, 7, 3, '#cfd6e6'); R(px + 4, y + 14, 4, 1, '#cfd6e6');
    if (chove()) { P(px + 4, y + 19, '#6cc6ff'); P(px + 7, y + 20, '#6cc6ff'); P(px + 9, y + 19, '#6cc6ff'); }
    var tmp = clima ? clima.temp + '°' : '21°';
    txt(g, tmp, px + 13, y + 14, '#eafff3');
    R(px + 3, y + 23, 29, 1, '#1f3a2a'); R(px + 3, y + 23, 18, 1, '#5cf2a0');
    R(px + 3, y + 26, 22, 1, '#2a3a32'); R(px + 3, y + 29, 26, 1, '#2a3a32'); R(px + 3, y + 32, 16, 1, '#2a3a32');
    R(px + 3, y + 35, 29, 1, '#1f3a2a'); R(px + 3, y + 35, Math.round(29 * .64), 1, '#f0a83c');
    if (st.toast > 0) {
      var tx = x + 60 + Math.max(0, st.toastX), ty = y + 40;
      R(tx, ty, 37, 8, '#232733'); R(tx, ty, 37, 1, '#33384a');
      R(tx + 2, ty + 2, 4, 4, '#5cf2a0');
      R(tx + 8, ty + 2, 20, 1, '#e6e9f2'); R(tx + 8, ty + 4, 26, 1, '#8e96aa');
    }
    R(sx, sy + 45, sw, 4, '#0a0d16'); R(sx + 44, sy + 46, 2, 2, '#6cc6ff'); R(sx + 48, sy + 46, 2, 2, '#3a4560'); R(sx + 52, sy + 46, 2, 2, '#3a4560');
    R(x, y + 53, 102, 3, '#0f0e13'); P(x + 98, y + 54, '#5cf2a0');
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
        balao('fred', T('Fred, o spitz alemão. Au! Au!', 'Fred, the German spitz. Woof! Woof!'));
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
  var t1 = $('#tabV1'), t2 = $('#tabV2'), p1 = $('#sennaV1'), p2 = $('#sennaV2');
  if (!t1) return;
  function aba(v) {
    var um = v === 1;
    t1.setAttribute('aria-selected', um); t2.setAttribute('aria-selected', !um);
    t1.tabIndex = um ? 0 : -1; t2.tabIndex = um ? -1 : 0;
    p1.hidden = !um; p2.hidden = um;
    Som.play('blip');
  }
  t1.addEventListener('click', function () { aba(1); });
  t2.addEventListener('click', function () { aba(2); });
  [t1, t2].forEach(function (t) { t.addEventListener('keydown', function (e) { if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { var v = t === t1 ? 2 : 1; aba(v); (v === 1 ? t1 : t2).focus(); } }); });

  var box = $('#sennaToasts'), rel = $('#sennaRelogio');
  var DIA = [
    ['08:57', T('Reunião em 3 minutos', 'Meeting in 3 minutes'), T('Daily do time. O link já está no Teams.', 'Team daily. The link is in Teams.')],
    ['09:40', T('PR para revisar', 'PR to review'), T('Chegou um PR novo esperando a sua revisão.', 'A new PR is waiting for your review.')],
    ['11:12', T('Merge feito', 'Merged'), T('O seu PR foi aprovado e entrou na main.', 'Your PR was approved and merged into main.')],
    ['14:30', T('Vai chover', 'Rain ahead'), T('Chuva às 17h em Canoas. Leva o guarda-chuva.', 'Rain at 5 PM in Canoas. Take an umbrella.')],
    ['16:05', T('Limite do Claude', 'Claude limit'), T('85% da semana usada. Libera quinta às 9h.', '85% of the week used. Resets Thursday at 9 AM.')],
    ['18:00', T('Lembrete', 'Reminder'), T('Bater o ponto.', 'Clock out.')]
  ];
  var i = 0, timer = null, vis = false;
  function passo() {
    if (!vis || p2.hidden) { timer = setTimeout(passo, 1200); return; }
    if (i >= DIA.length) {
      $$('.toast-d', box).forEach(function (t) { t.classList.add('sai'); });
      setTimeout(function () { box.innerHTML = ''; rel.textContent = '08:55'; }, 400);
      i = 0; timer = setTimeout(passo, 2600); return;
    }
    var d = DIA[i++], tp = $('#snTemp');
    if (tp && clima) tp.textContent = clima.temp + '°';
    rel.textContent = d[0];
    var el = document.createElement('div');
    el.className = 'toast-d';
    el.innerHTML = '<i>S</i><b>' + esc(d[1]) + '<span>Senna · ' + d[0] + '</span></b><p>' + esc(d[2]) + '</p>';
    box.appendChild(el);
    var all = $$('.toast-d', box);
    if (all.length > 3) { var v = all[0]; v.classList.add('sai'); setTimeout(function () { v.remove(); }, 320); }
    timer = setTimeout(passo, 3300);
  }
  if ('IntersectionObserver' in window) new IntersectionObserver(function (es) { vis = es[0].isIntersecting; }, { threshold: .3 }).observe(p2.parentNode);
  else vis = true;
  passo();

  var cv = $('#orb'), c = cv.getContext('2d'), estado = $('#orbEstado'), falaEl = $('#orbFala');
  var EST = {
    idle: [[47, 191, 99], T('Em repouso', 'Idle'), .8],
    ouvindo: [[57, 255, 20], T('Ouvindo', 'Listening'), 1.4],
    pensando: [[255, 176, 32], T('Pensando', 'Thinking'), 1],
    falando: [[56, 189, 248], T('Falando', 'Speaking'), 1.2]
  };
  var atual = 'idle', fr = 0, roteiro = [];
  function orb() {
    fr++;
    var e = EST[atual], col = e[0];
    c.clearRect(0, 0, 40, 40);
    var r = 11 + Math.sin(fr / (atual === 'pensando' ? 2 : 5)) * e[2] * 1.5;
    for (var y = 0; y < 40; y++) for (var x = 0; x < 40; x++) {
      var dx = x - 19.5, dy = y - 19.5, d = Math.sqrt(dx * dx + dy * dy);
      var ang = Math.atan2(dy, dx), wob = Math.sin(ang * 5 + fr / 3) * (atual === 'falando' ? 1.6 : .7);
      if (d < r + wob) {
        var k = 1 - d / (r + 2);
        var a = Math.max(.15, k);
        if (((x + y + (fr >> 1)) % 4 === 0) && d > r - 4) a = 1;
        c.fillStyle = 'rgba(' + col[0] + ',' + col[1] + ',' + col[2] + ',' + a.toFixed(2) + ')';
        c.fillRect(x, y, 1, 1);
      } else if (d < r + 4 + wob && ((x * 7 + y * 3 + fr) % 9 === 0)) {
        c.fillStyle = 'rgba(' + col[0] + ',' + col[1] + ',' + col[2] + ',.5)';
        c.fillRect(x, y, 1, 1);
      }
    }
    estado.textContent = e[1];
    estado.style.color = 'rgb(' + col.join(',') + ')';
  }
  setInterval(function () { if (!p1.hidden) orb(); }, lento ? 1000 : 90);
  orb();
  $('#orbCmds').addEventListener('click', function (e) {
    var b = e.target.closest('[data-fala]'); if (!b) return;
    roteiro.forEach(clearTimeout); roteiro = [];
    var txt = b.getAttribute('data-fala');
    if (txt === '@hora') { var d = new Date(); txt = T('São ', 'It\'s ') + pad(d.getHours()) + ':' + pad(d.getMinutes()) + '.'; }
    if (EN) txt = ({ 'Tem 3 PRs esperando o seu review. Abrindo.': '3 PRs are waiting for your review. Opening them.', 'Amanhã tem chuva a partir das 15 horas.': 'Rain tomorrow from 3 PM.', 'Tocando a sua playlist.': 'Playing your playlist.' })[txt] || txt;
    atual = 'ouvindo'; falaEl.innerHTML = '&nbsp;'; Som.play('blip');
    roteiro.push(setTimeout(function () { atual = 'pensando'; }, 1200));
    roteiro.push(setTimeout(function () { atual = 'falando'; falaEl.textContent = txt; Som.play('oi'); }, 2500));
    roteiro.push(setTimeout(function () { atual = 'idle'; }, 5200));
  });
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
        setTimeout(function () { sheet.classList.remove('on'); ocupado = false; }, 1100);
      }, lento ? 100 : 950);
    });
  });
})();

(function () {
  var city = $('#tnCity'), mods = $('#tnMods'), cap = $('#tnCap'), pick = $$('[data-tn]');
  if (!city) return;
  var MODS = [
    ['BH', T('Banco de horas', 'Hour bank')], ['ES', T('Escalas', 'Schedules')], ['MT', T('Motoristas', 'Drivers')], ['FP', T('Folha', 'Payroll')],
    ['RE', T('Relógios REP', 'Time clocks')], ['AP', T('App mobile', 'Mobile app')], ['PG', T('Portal do gestor', 'Manager portal')], ['PC', T('Portal do colaborador', 'Employee portal')]
  ];
  var TN = {
    mercado: { usa: ['BH', 'ES', 'FP', 'RE', 'PG', 'PC'], cap: T('Supermercado: escala de fim de semana, banco de horas e relógio na entrada da loja.', 'Supermarket: weekend schedules, hour bank and a time clock at the store door.') },
    transp: { usa: ['BH', 'MT', 'FP', 'AP', 'PG', 'PC'], cap: T('Transportadora: jornada de motorista e ponto pelo app, até sem sinal na estrada.', 'Trucking: driver hours and clocking in from the app, even with no signal on the road.') },
    fabrica: { usa: ['BH', 'ES', 'FP', 'RE', 'AP', 'PG'], cap: T('Indústria: turnos, vários relógios e exportação para a folha.', 'Factory: shifts, many time clocks and export to payroll.') }
  };
  var atual = 'mercado', c = city.getContext('2d'), fr = 0;
  mods.innerHTML = MODS.map(function (m) { return '<div class="tn-mod" data-m="' + m[0] + '"><b>' + m[0] + '</b><span>' + esc(m[1]) + '</span></div>'; }).join('');
  function R(x, y, w, h, col) { c.fillStyle = col; c.fillRect(x, y, w, h); }
  function predio(x, sel, tipo) {
    var on = sel, wall = on ? '#3b5a8a' : '#262130', win = on ? '#ffd27a' : '#3a3346', roof = on ? '#6cc6ff' : '#3a3346';
    if (tipo === 'mercado') {
      R(x, 22, 40, 26, wall); R(x - 2, 18, 44, 4, roof);
      R(x + 4, 26, 32, 4, on ? '#ee7a5b' : '#3a3346');
      for (var i = 0; i < 4; i++) R(x + 4 + i * 9, 34, 6, 6, win);
      R(x + 16, 40, 8, 8, '#1a1520');
    } else if (tipo === 'transp') {
      R(x, 26, 34, 22, wall); R(x, 23, 34, 3, roof);
      R(x + 4, 32, 10, 16, '#1a1520'); R(x + 18, 32, 10, 16, '#1a1520');
      var tx = on ? (fr % 60) - 10 : 6;
      R(x + 6 + tx, 41, 14, 6, on ? '#e8e2d4' : '#3a3346'); R(x + 20 + tx, 43, 5, 4, on ? '#ee7a5b' : '#3a3346');
      R(x + 8 + tx, 47, 2, 1, '#000'); R(x + 21 + tx, 47, 2, 1, '#000');
    } else {
      R(x, 28, 38, 20, wall); R(x + 2, 22, 6, 6, wall); R(x + 12, 24, 6, 4, wall);
      R(x + 26, 10, 5, 18, on ? '#8a8fa0' : '#2e2938');
      if (on) for (var s = 0; s < 3; s++) R(x + 26 + ((fr >> 2) + s) % 3, 8 - s * 3 - ((fr >> 1) % 3), 3, 2, 'rgba(220,220,230,' + (.6 - s * .15) + ')');
      for (var j = 0; j < 4; j++) R(x + 3 + j * 9, 34, 5, 4, win);
    }
  }
  function draw() {
    fr++;
    R(0, 0, 160, 56, '#0e0b12');
    R(0, 48, 160, 8, '#1d1824');
    for (var x = 0; x < 160; x += 10) R(x + ((fr >> 1) % 10), 51, 5, 1, '#3a3346');
    predio(8, atual === 'mercado', 'mercado');
    predio(62, atual === 'transp', 'transp');
    predio(112, atual === 'fabrica', 'fabrica');
  }
  function escolhe(k) {
    atual = k;
    pick.forEach(function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-tn') === k); });
    $$('.tn-mod', mods).forEach(function (m) { var on = TN[k].usa.indexOf(m.getAttribute('data-m')) >= 0; m.classList.toggle('on', on); m.classList.toggle('off', !on); });
    cap.textContent = TN[k].cap + ' ' + T('Mesma base, cada empresa só vê o que é dela.', 'Same codebase, and each company only sees its own data.');
    draw();
  }
  pick.forEach(function (b) { b.addEventListener('click', function () { Som.play('blip'); escolhe(b.getAttribute('data-tn')); }); });
  escolhe('mercado');
  var vis = false;
  if ('IntersectionObserver' in window) new IntersectionObserver(function (es) { vis = es[0].isIntersecting; }).observe(city);
  setInterval(function () { if (vis && !lento) draw(); }, 110);
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
