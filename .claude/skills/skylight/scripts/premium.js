/* Skylight runtime. Every frame is a pure function of t (seconds), driven by one paused GSAP timeline (HyperFrames).
   Numbers come from reference/style.md.
   build.py writes the elements; this file moves them. Elements carry data-on / data-off and data-fx. */
(function () {
  var FPS = 30, W = 1080, H = 1920;
  var FOCUS_F = 5;        // every cut lands soft and pulls into focus over 4-6 frames 
  var FOCUS_PX = 16;      // ~12 px at 1080 tall in the reference -> ~16 px at 1920
  var SLIDE = 0.065, SLIDE_T = 0.5;   // "pan right": a HARD cut, then the new shot slides ~6.5% of the width and settles in 0.5 s
                                      // with a little horizontal blur while it pulls focus 
  var WHIP_T = 0.6;       // vertical whip sky -> night 
  var RET_T = 0.5;        // back to A-roll: lands ~104% and settles, soft airy whoosh
  var root = document.getElementById('root');
  var all = Array.prototype.slice.call(root.querySelectorAll('[data-on]'));
  var hb = document.getElementById('hbf'), vb = document.getElementById('vbf');

  function clamp(x) { return Math.max(0, Math.min(1, x)); }
  function eo(x) { x = clamp(x); return 1 - Math.pow(1 - x, 3); }
  function eio(x) { x = clamp(x); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; }
  function eback(x) { x = clamp(x); var c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); }
  function rng(seed) {
    var s = (seed * 2654435761) >>> 0 || 1;
    return function () { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return (s % 1000003) / 1000003; };
  }
  function num(v, d) { return v == null || v === '' ? d : +v; }

  // ---------- fit bold lines to the frame once the fonts are in
  // a page is measured the first time it is on screen (a hidden element measures 0), once the fonts are in
  function fitPage(cap) {
    if (cap._fit || !document.fonts || !document.fonts.check('700 100px PCSans')) return;
    cap.querySelectorAll('[data-fit]').forEach(function (el) {
      var max = +el.dataset.fit, fs = parseFloat(el.style.fontSize), guard = 0;
      while (el.getBoundingClientRect().width > max && fs > 30 && guard++ < 80) { fs -= 3; el.style.fontSize = fs + 'px'; }
    });
    cap._fit = true;
  }

  // ---------- scene layers: in / out transitions
  function sceneAt(el, t, on, off) {
    var d = el.dataset, age = t - on, x = 0, y = 0, s = 1, blur = 0, dir = null;
    var tin = d.tin || 'focus', tout = d.tout || 'cut', outAt = num(d.outat, off);
    if (tin === 'pan') { var p = eo(age / SLIDE_T), sh = (1 - p) * SLIDE * W; x = sh; s = 1 + 2.1 * sh / W; if (p < 1) dir = ['h', (1 - p) * 26]; }
    if (tin === 'whipup') { var q = eio(age / WHIP_T); y = (1 - q) * H; if (q < 1) dir = ['v', Math.sin(q * Math.PI) * 60]; }
    if (tin === 'return') { s = 1.045 - 0.045 * eo(age / RET_T); }
    if (tin === 'rise') { y = (1 - eo(age / 0.5)) * 220; blur = Math.max(blur, (1 - eo(age / 0.5)) * 18); }
    if (tin !== 'none' && tin !== 'whipup') blur = Math.max(blur, FOCUS_PX * (1 - eo(age * FPS / FOCUS_F)));
    if (t >= outAt) {          // the outgoing half of a push: slides away while the next scene comes in
      var oa = t - outAt;
      if (tout === 'whipup') { var qo = eio(oa / WHIP_T); y -= qo * H; dir = ['v', Math.sin(qo * Math.PI) * 60]; }
    }
    if (d.drift) { var dr = d.drift.split(',').map(Number); s *= 1 + dr[0] * clamp(age / Math.max(0.5, off - on)); x += dr[1] * age; y += dr[2] * age; }
    el.style.transform = 'translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px) scale(' + s.toFixed(4) + ')';
    var f = [];
    if (dir && dir[1] > 1) {
      var flt = dir[0] === 'h' ? hb : vb;
      flt.querySelector('feGaussianBlur').setAttribute('stdDeviation', dir[0] === 'h' ? dir[1].toFixed(1) + ' 0' : '0 ' + dir[1].toFixed(1));
      f.push('url(#' + flt.id + ')');
    }
    if (blur > 0.3) f.push('blur(' + blur.toFixed(2) + 'px)');
    el.style.filter = f.length ? f.join(' ') : 'none';
  }

  // ---------- words: blur-in, glitch-in letter by letter, write-out, pop
  function wordAt(el, t) {
    var d = el.dataset, t0 = +d.t, age = t - t0, fx = d.wfx || 'blur';
    if (fx === 'glitch' || fx === 'write') {
      var ls = el.children, r = rng(+d.seed || 7);
      for (var i = 0; i < ls.length; i++) {
        var li = ls[i], la;
        if (fx === 'glitch') la = age - r() * 0.36;          // letters land out of order over ~0.4 s ("b e" -> "bre k r" -> "breakthrough")
        else la = age - i / num(d.cps, 26);                 // writes out letter by letter
        var v = eo(la * FPS / 3);
        li.style.opacity = la < 0 ? 0 : v.toFixed(3);
        li.style.filter = la < 0 || v > 0.99 ? 'none' : 'blur(' + ((1 - v) * 10).toFixed(2) + 'px)';
        li.style.transform = fx === 'glitch' && la >= 0 && la < 2 / FPS ? 'translateX(' + ((r() - 0.5) * 14).toFixed(1) + 'px)' : 'none';
      }
      return;
    }
    var p = eo(age * FPS / 5);
    if (age < 0) { el.style.opacity = 0; el.style.filter = 'none'; el.style.transform = 'none'; return; }
    if (fx === 'pop') {
      var sc = age < 0.067 ? 0.6 + 0.48 * (age / 0.067) : age < 0.133 ? 1.08 - 0.1 * ((age - 0.067) / 0.067) : 1;
      el.style.opacity = clamp(age * FPS / 2).toFixed(3); el.style.transform = 'scale(' + sc.toFixed(3) + ')'; el.style.filter = 'none'; return;
    }
    var bl = fx === 'bigblur' ? 22 : 10;
    el.style.opacity = p.toFixed(3);
    el.style.filter = p < 0.99 ? 'blur(' + ((1 - p) * bl).toFixed(2) + 'px)' : 'none';
    el.style.transform = p < 0.99 ? 'translateY(' + ((1 - p) * 10).toFixed(1) + 'px)' : 'none';
  }

  // ---------- small pieces
  function popAt(el, age) {        // pills, logos, labels: 0.7 -> 1.06 -> 1 in ~5 frames
    var s = age < 0 ? 0.7 : age < 0.1 ? 0.7 + 0.36 * eo(age / 0.1) : 1.06 - 0.06 * eo((age - 0.1) / 0.08);
    el.style.opacity = clamp(age * FPS / 3).toFixed(3);
    el.style.transform = (el.dataset.base || '') + ' scale(' + s.toFixed(3) + ')';
  }
  function drawAt(el, age, dur) {   // SVG strokes that draw on (arrows, swoosh, rules)
    var p = eo(age / dur);
    el.querySelectorAll('.st').forEach(function (s) {
      var L = +s.dataset.len || 1500; s.style.strokeDasharray = L; s.style.strokeDashoffset = (L * (1 - p)).toFixed(1);
    });
    el.querySelectorAll('.head').forEach(function (h) { h.style.opacity = p > 0.85 ? ((p - 0.85) / 0.15).toFixed(2) : 0; });
  }
  function selAt(el, age) {         // selector box: corner brackets glitch in (flicker 3 frames), then expand to fit
    var f = Math.floor(age * FPS + 1e-3);
    var vis = f < 0 ? 0 : f < 3 ? (f % 2 === 0 ? 1 : 0.25) : 1;
    var s = f < 3 ? 0.82 : 0.82 + 0.18 * eo((age - 3 / FPS) / 0.22);
    el.style.opacity = vis; el.style.transform = 'scale(' + s.toFixed(3) + ')';
  }
  function wipeAt(el, age) {        // highlight box wipes in left to right
    var p = eo(age / 0.25);
    el.style.clipPath = 'inset(0 ' + ((1 - p) * 100).toFixed(1) + '% 0 0 round 6px)';
    el.style.opacity = age < 0 ? 0 : 1;
  }
  function barAt(el, t) {           // bars grow / drop on the spoken word, ease-out ~0.5 s
    var ks = JSON.parse(el.dataset.keys), v = ks[0][1], grey = 0;
    for (var i = 0; i < ks.length; i++) {
      var k = ks[i];
      if (t >= k[0]) {
        var prev = i ? ks[i - 1][1] : k[1], p = eo((t - k[0]) / 0.5);
        v = prev + (k[1] - prev) * p;
        if (k[2]) grey = p;
      }
    }
    var tr = el.parentNode, hgt = tr.clientHeight || +el.dataset.h;
    el.style.height = (v * hgt).toFixed(1) + 'px';
    el.style.filter = grey ? 'grayscale(' + grey.toFixed(2) + ')' : 'none';
    var lab = el.parentNode.querySelector('.blab');
    if (lab) lab.style.bottom = (v * hgt - 22).toFixed(1) + 'px';
  }
  function orbsAt(el, t, on) {
    var d = el.dataset, age = t - on, m = num(d.merge, 1e9), os = el.querySelectorAll('.orb'), fl = el.querySelector('.bloom');
    var P = JSON.parse(d.pos);                 // [[x,y],[x,y]] start positions, px
    var C = [+d.cx, +d.cy];
    for (var i = 0; i < os.length; i++) {
      var o = os[i], ph = i * 2.1;
      var x = P[i][0] + Math.sin(age * 0.9 + ph) * 14, y = P[i][1] + Math.cos(age * 0.7 + ph) * 12;   // slow drift ~10 px/s
      var s = 1 + 0.035 * Math.sin(age * 2.2 + ph);                                                     // breathing halo
      if (t >= m - 0.45) { var p = eio((t - (m - 0.45)) / 0.45); x += (C[0] - x) * p; y += (C[1] - y) * p; }
      var lb = o.querySelector('.olab');
      if (lb) lb.style.opacity = t >= m - 0.25 ? 0 : clamp((age - 0.3) * FPS / 5).toFixed(3);
      if (t >= m) { s *= 1.25; o.style.opacity = i === 0 ? 1 : 0; }
      else o.style.opacity = clamp(age * FPS / 6).toFixed(3);
      o.style.transform = 'translate(' + (x - 120).toFixed(1) + 'px,' + (y - 120).toFixed(1) + 'px) scale(' + s.toFixed(3) + ')';
    }
    if (fl) {                                   // merge: a white-blue bloom for ~4 frames
      var fa = t - m;
      fl.style.opacity = fa < 0 || fa > 0.3 ? 0 : (1 - fa / 0.3).toFixed(3);
      fl.style.transform = 'translate(' + (C[0] - 300) + 'px,' + (C[1] - 300) + 'px) scale(' + (0.6 + fa * 2.2).toFixed(3) + ')';
    }
  }
  function daysAt(el, t) {          // calendar cells light one by one, then the extra ones fade back out
    var ks = JSON.parse(el.dataset.keys), cells = el.querySelectorAll('.day');
    for (var i = 0; i < cells.length; i++) {
      var v = 0, prevN = 0;
      for (var k = 0; k < ks.length; k++) {
        var kt = ks[k][0], kn = ks[k][1], kd = ks[k][2] || 0.6;
        if (t < kt) break;
        if (kn >= prevN) {
          if (i < prevN) v = 1;
          else if (i < kn) { var ot = kt + (i - prevN) / Math.max(1, kn - prevN) * kd; v = t < ot ? 0 : eo((t - ot) * FPS / 4); }
        } else if (i >= kn && i < prevN) {
          var ft = kt + (prevN - 1 - i) / Math.max(1, prevN - kn) * kd; v = t < ft ? 1 : 1 - eo((t - ft) * FPS / 5);
        } else if (i < kn) v = 1;
        prevN = kn;
      }
      var df = cells[i].firstChild, sp = cells[i].lastChild;
      df.style.opacity = v.toFixed(3);
      df.style.transform = 'scale(' + (0.6 + 0.4 * v).toFixed(3) + ')';
      sp.style.color = v > 0.5 ? '#ffffff' : '#9a9ea8';
    }
  }
  function lineAt(el, t, on) {      // line graph draws left to right
    var d = el.dataset, p = eio((t - num(d.t, on)) / num(d.dur, 1.4));
    var path = el.querySelector('.st'), L = +path.dataset.len;
    path.style.strokeDasharray = L; path.style.strokeDashoffset = (L * (1 - p)).toFixed(1);
    var dot = el.querySelector('.ldot');
    if (dot && path.getPointAtLength) { var pt = path.getPointAtLength(L * p); dot.setAttribute('cx', pt.x); dot.setAttribute('cy', pt.y); dot.style.opacity = p > 0.02 ? 1 : 0; }
  }
  function namecardAt(el, age) {
    var nm = el.querySelector('.nm'), ru = el.querySelector('.ru'), ti = el.querySelector('.ti');
    nm.style.opacity = eo(age * FPS / 5); nm.style.filter = 'blur(' + ((1 - eo(age * FPS / 5)) * 8).toFixed(1) + 'px)';
    ru.style.transform = 'scaleX(' + eo((age - 0.1) / 0.3).toFixed(3) + ')';
    ti.style.opacity = eo((age - 0.25) * FPS / 6);
  }
  function tiltAt(el, age) {        // the object in the sky turns slowly
    var r = +el.dataset.r || -28, sp = +el.dataset.spin || 1.6;
    el.style.transform = 'rotate(' + (r + age * sp).toFixed(2) + 'deg) translateY(' + (Math.sin(age * 0.8) * 8).toFixed(1) + 'px)';
  }

  function slideAt(el, age) {       // a cloud layer drifting across the plate (parallax)
    el.style.transform = 'translateX(' + (num(el.dataset.vx, -30) * age).toFixed(1) + 'px)';
  }
  function objAt(el, age) {         // a cut-out object in a generated world: enters, then floats and turns slowly
    var d = el.dataset, e = d.enter || 'rise', r = num(d.r, 0) + age * num(d.spin, 1.2), ph = num(d.ph, 0);
    var y = Math.sin(age * 0.9 + ph) * num(d.bob, 10), x = 0, s = 1, o = 1, bl = 0;
    if (e === 'rise') { var p = eo(age / 0.6); y += (1 - p) * 320; bl = (1 - p) * 16; o = clamp(age * FPS / 4); }
    else if (e === 'drop') { var q = eback(age / 0.55); y -= (1 - q) * 520; o = clamp(age * FPS / 3); }
    else if (e === 'pop') { s = age < 0.1 ? 0.6 + 0.46 * eo(age / 0.1) : 1.06 - 0.06 * eo((age - 0.1) / 0.1); o = clamp(age * FPS / 3); }
    else if (e === 'fade') { o = eo(age / 0.4); bl = (1 - o) * 10; }
    el.style.opacity = o.toFixed(3);
    el.style.transform = 'translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px) rotate(' + r.toFixed(2) + 'deg) scale(' + s.toFixed(3) + ')';
    el.style.filter = (el.dataset.f0 || (el.dataset.f0 = el.style.filter || 'none')) + (bl > 0.3 ? ' blur(' + bl.toFixed(1) + 'px)' : '');
  }
  function sparkleAt(el, age) {      // glowing specks drifting up, twinkling
    var ks = el.children, r = rng(+el.dataset.seed || 5);
    for (var i = 0; i < ks.length; i++) {
      var x0 = r() * W, y0 = r() * H, sp = 20 + r() * 50, sz = 0.3 + r() * 0.9, tw = r() * 6;
      var y = ((y0 - age * sp) % H + H) % H;
      ks[i].style.transform = 'translate(' + (x0 + Math.sin(age + tw) * 12).toFixed(1) + 'px,' + y.toFixed(1) + 'px) scale(' + sz.toFixed(2) + ')';
      ks[i].style.opacity = (0.35 + 0.65 * Math.abs(Math.sin(age * 2.2 + tw))).toFixed(2);
    }
  }

  function renderAt(t) {
    for (var i = 0; i < all.length; i++) {
      var el = all[i], d = el.dataset, on = +d.on, off = +d.off;
      var vis = t >= on && t < off;
      el.style.display = vis ? '' : 'none';
      if (!vis) continue;
      if (el.classList.contains('cap')) fitPage(el);
      var age = t - (d.t != null && d.fx !== 'word' && d.fx !== 'line' ? +d.t : on), fx = d.fx;
      if (fx === 'scene') sceneAt(el, t, on, off);
      else if (fx === 'word') wordAt(el, t);
      else if (fx === 'pop') popAt(el, age);
      else if (fx === 'draw') drawAt(el, age, num(d.dur, 0.4));
      else if (fx === 'sel') selAt(el, age);
      else if (fx === 'wipe') wipeAt(el, age);
      else if (fx === 'bar') barAt(el, t);
      else if (fx === 'orbs') orbsAt(el, t, on);
      else if (fx === 'line') lineAt(el, t, on);
      else if (fx === 'days') daysAt(el, t);
      else if (fx === 'slide') slideAt(el, age);
      else if (fx === 'obj') objAt(el, age);
      else if (fx === 'sparkle') sparkleAt(el, age);
      else if (fx === 'namecard') namecardAt(el, age);
      else if (fx === 'tilt') tiltAt(el, age);
      else if (fx === 'fade') el.style.opacity = clamp(age / num(d.dur, 0.2)).toFixed(3);
      else if (fx === 'rise') {
        var pr = eo(age / num(d.dur, 0.55));
        el.style.transform = (d.base || '') + ' translateY(' + ((1 - pr) * num(d.dy, 260)).toFixed(1) + 'px)';
        el.style.filter = pr < 0.99 ? 'blur(' + ((1 - pr) * 16).toFixed(1) + 'px)' : 'none';
        el.style.opacity = clamp(age * FPS / 4).toFixed(3);
      }
    }
  }

  var proxy = { t: 0 };
  var DUR = +root.dataset.duration;
  var tl = gsap.timeline({ paused: true });
  tl.to(proxy, { t: DUR, duration: DUR, ease: 'none', onUpdate: function () { renderAt(proxy.t); } }, 0);
  window.__timelines = window.__timelines || {};
  window.__timelines['main'] = tl;
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { renderAt(proxy.t); });
  renderAt(0);
})();
