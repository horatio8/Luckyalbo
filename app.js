/* Albo's Luck — interactive logic.
   Ported from the Claude Design prototype (DCLogic class) to vanilla JS.
   Tunable config below mirrors the design's editable props. */
(function () {
  'use strict';

  var CONFIG = {
    pledgeStart: 187432,
    pledgeGoal: 250000,
    showCalculator: true,
    showQuiz: true
  };

  // ----- formatting helpers -----
  function fmt(n) { return '$' + Math.round(n).toLocaleString('en-AU'); }
  function fmtN(n) { return Math.round(n).toLocaleString('en-AU'); }

  // ----- application state -----
  var state = {
    count: CONFIG.pledgeStart,
    purchase: 620000,
    current: 1180000,
    years: 10,
    rate: 0.47,
    quiz: { q1: null, q2: null, q3: null },
    formError: '',
    phase: 'form',
    pledgeNo: null,
    sentState: null,
    sentPostcode: null,
    sentName: '',
    donationFreq: 'once',
    donationSel: null,
    customAmount: '',
    donatedAmount: null,
    copied: ''
  };

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  // ----- postcode -> state lookup -----
  function postcodeState(pcRaw) {
    var pc = parseInt(pcRaw, 10);
    if (isNaN(pc)) return null;
    if ((pc >= 2600 && pc <= 2618) || (pc >= 2900 && pc <= 2920) || (pc >= 200 && pc <= 299)) return 'ACT';
    if ((pc >= 1000 && pc <= 2599) || (pc >= 2619 && pc <= 2899) || (pc >= 2921 && pc <= 2999)) return 'NSW';
    if ((pc >= 3000 && pc <= 3999) || (pc >= 8000 && pc <= 8999)) return 'VIC';
    if ((pc >= 4000 && pc <= 4999) || (pc >= 9000 && pc <= 9999)) return 'QLD';
    if (pc >= 5000 && pc <= 5999) return 'SA';
    if (pc >= 6000 && pc <= 6999) return 'WA';
    if (pc >= 7000 && pc <= 7999) return 'TAS';
    if (pc >= 800 && pc <= 999) return 'NT';
    return null;
  }
  function senatorsFor(st) { return (st === 'ACT' || st === 'NT') ? 2 : 12; }
  function stateName(st) {
    return ({ NSW: 'New South Wales', VIC: 'Victoria', QLD: 'Queensland', WA: 'Western Australia', SA: 'South Australia', TAS: 'Tasmania', ACT: 'the ACT', NT: 'the Northern Territory' })[st] || st;
  }

  // ===================================================================
  //  LIVE COUNTER + DASHBOARD
  // ===================================================================
  function renderCount() {
    $$('[data-count]').forEach(function (el) { el.textContent = fmtN(state.count); });

    var goal = CONFIG.pledgeGoal;
    var goalPct = Math.min(100, (state.count / goal) * 100);
    var goalEl = $('#goalFill');
    if (goalEl) goalEl.style.width = goalPct + '%';
    var gp = $('[data-goal-pct]'); if (gp) gp.textContent = Math.round(goalPct) + '%';
    var gf = $('[data-goal]'); if (gf) gf.textContent = fmtN(goal);

    renderStates();
  }

  function renderStates() {
    var host = $('#stateBars');
    if (!host) return;
    var stateDefs = [['NSW', 0.312], ['VIC', 0.258], ['QLD', 0.206], ['WA', 0.104], ['SA', 0.066], ['TAS', 0.022], ['ACT', 0.020], ['NT', 0.012]];
    var counts = stateDefs.map(function (d) { return [d[0], Math.round(state.count * d[1])]; });
    var maxC = Math.max.apply(null, counts.map(function (c) { return c[1]; }));

    // build once, then update widths/labels in place for smooth transitions
    if (!host.childNodes.length) {
      counts.forEach(function (c) {
        var row = document.createElement('div');
        row.style.cssText = 'display: grid; grid-template-columns: 52px 1fr 92px; gap: 14px; align-items: center;';
        row.innerHTML =
          '<span style="font-family: \'Space Mono\', monospace; font-weight: 700; font-size: 14px; color: #FBF4DE;">' + c[0] + '</span>' +
          '<div style="height: 18px; background: rgba(0,0,0,.3); border-radius: 5px; overflow: hidden;">' +
            '<div data-fill style="width:0%; height: 100%; border-radius: 5px; background: linear-gradient(90deg,#C9A227,#F5C518 70%,#FCD34D); box-shadow: 0 1px 0 rgba(0,0,0,.25) inset, 0 0 14px rgba(245,197,24,.35); transition: width 1.1s cubic-bezier(.2,.8,.2,1);"></div>' +
          '</div>' +
          '<span data-num style="font-family: \'Space Mono\', monospace; font-size: 13px; color: #cdbf94; text-align: right;"></span>';
        host.appendChild(row);
      });
    }
    var rows = host.children;
    counts.forEach(function (c, i) {
      var row = rows[i];
      if (!row) return;
      var w = maxC ? Math.max(6, (c[1] / maxC) * 100) : 0;
      $('[data-fill]', row).style.width = w + '%';
      $('[data-num]', row).textContent = fmtN(c[1]);
    });
  }

  // ===================================================================
  //  HYPOCRISY CALCULATOR
  // ===================================================================
  var RATES = [['30%', 0.30], ['37%', 0.37], ['45%', 0.45], ['47%', 0.47]];

  function buildRateOptions() {
    var host = $('#rateOptions');
    if (!host) return;
    host.innerHTML = '';
    RATES.forEach(function (r) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = r[0];
      btn.dataset.rate = r[1];
      btn.addEventListener('click', function () { state.rate = r[1]; renderCalc(); });
      host.appendChild(btn);
    });
  }

  function renderCalc() {
    var gain = Math.max(0, state.current - state.purchase);
    var taxOld = gain * 0.235;
    var idxCost = state.purchase * Math.pow(1.015, state.years);
    var gainNew = Math.max(0, state.current - idxCost);
    var taxNew = gainNew * state.rate;
    var diff = Math.max(0, taxNew - taxOld);
    var mult = taxOld > 0 ? (taxNew / taxOld) : 0;

    var set = function (sel, val) { var el = $(sel); if (el) el.textContent = val; };
    set('[data-purchase]', fmt(state.purchase));
    set('[data-current]', fmt(state.current));
    set('[data-years]', state.years + (state.years === 1 ? ' year' : ' years'));
    set('[data-gain]', fmt(gain));
    set('[data-tax-old]', fmt(taxOld));
    set('[data-tax-new]', fmt(taxNew));
    set('[data-diff]', fmt(diff));
    set('[data-mult]', mult >= 1.05 ? (mult.toFixed(1) + '×') : '—');
    set('[data-calc-line]', 'Albo saved ' + fmt(diff) + ' by selling before he changed the rules. You’ll pay ' + fmt(diff) + ' more because you didn’t.');

    // rate button styles
    $$('#rateOptions button').forEach(function (btn) {
      var active = Math.abs(state.rate - parseFloat(btn.dataset.rate)) < 0.001;
      btn.style.cssText =
        'flex: 1; padding: 12px 6px; cursor: pointer; border-radius: 6px;' +
        "font-family: 'Space Mono', monospace; font-size: 15px; font-weight: 700;" +
        'border: ' + (active ? '2px solid #C2362B' : '2px solid #d8cba6') + ';' +
        'background: ' + (active ? '#C2362B' : '#fff') + ';' +
        'color: ' + (active ? '#fff' : '#7a6f53') + ';' +
        'transition: all .15s ease;';
    });
  }

  function wireCalc() {
    if (!CONFIG.showCalculator) { var s = $('#calculator'); if (s) s.style.display = 'none'; return; }
    buildRateOptions();
    var p = $('#inPurchase'), c = $('#inCurrent'), y = $('#inYears');
    if (p) p.addEventListener('input', function (e) { state.purchase = +e.target.value; renderCalc(); });
    if (c) c.addEventListener('input', function (e) { state.current = +e.target.value; renderCalc(); });
    if (y) y.addEventListener('input', function (e) { state.years = +e.target.value; renderCalc(); });
    renderCalc();
  }

  // ===================================================================
  //  QUIZ
  // ===================================================================
  var QUIZ = [
    { key: 'q1', n: '01', text: 'Did you sell your investment property before Budget night?' },
    { key: 'q2', n: '02', text: 'Did you know the CGT discount was about to be abolished?' },
    { key: 'q3', n: '03', text: 'Are you the Prime Minister of Australia?' }
  ];

  function buildQuiz() {
    if (!CONFIG.showQuiz) { var s = $('#quiz'); if (s) s.style.display = 'none'; return; }
    var host = $('#quizQuestions');
    if (!host) return;
    host.innerHTML = '';
    QUIZ.forEach(function (q) {
      var card = document.createElement('div');
      card.style.cssText = 'background: #221f1a; border: 1px solid rgba(245,197,24,.2); border-radius: 12px; padding: 22px 24px;';
      card.innerHTML =
        '<div style="display: flex; gap: 14px; align-items: flex-start; margin-bottom: 16px;">' +
          '<span style="font-family: \'DM Serif Display\', serif; font-size: 26px; color: #F5C518; line-height: 1;">' + q.n + '</span>' +
          '<p style="font-size: 17px; color: #ece2c4; margin: 0; line-height: 1.4; padding-top: 2px;">' + q.text + '</p>' +
        '</div>' +
        '<div style="display: flex; gap: 12px;">' +
          '<button type="button" data-q="' + q.key + '" data-v="yes">Yes</button>' +
          '<button type="button" data-q="' + q.key + '" data-v="no">No</button>' +
        '</div>';
      host.appendChild(card);
    });
    $$('#quizQuestions button').forEach(function (btn) {
      btn.addEventListener('click', function () {
        state.quiz[btn.dataset.q] = btn.dataset.v;
        renderQuiz();
      });
    });
    renderQuiz();
  }

  function renderQuiz() {
    var q = state.quiz;
    $$('#quizQuestions button').forEach(function (btn) {
      var active = q[btn.dataset.q] === btn.dataset.v;
      var yes = btn.dataset.v === 'yes';
      btn.style.cssText =
        'flex: 1; padding: 14px 10px; cursor: pointer; border-radius: 8px;' +
        "font-family: 'Libre Franklin', sans-serif; font-weight: 800; font-size: 15px;" +
        'letter-spacing: .04em; text-transform: uppercase; transition: all .15s ease;' +
        'border: ' + (active ? '2px solid #F5C518' : '2px solid rgba(245,197,24,.25)') + ';' +
        'background: ' + (active ? (yes ? '#1B7340' : '#C2362B') : 'rgba(255,255,255,.04)') + ';' +
        'color: ' + (active ? '#fff' : '#cdbf94') + ';';
    });

    var done = !!(q.q1 && q.q2 && q.q3);
    var result = $('#quizResult');
    if (!result) return;
    if (done) {
      var luckyAlbo = q.q3 === 'yes' && q.q1 === 'yes' && q.q2 === 'yes';
      $('[data-quiz-title]').textContent = luckyAlbo
        ? 'Extraordinary. You’re exactly as lucky as Albo.'
        : 'Sorry — you’re not as lucky as Albo.';
      $('[data-quiz-sub]').textContent = luckyAlbo
        ? 'You sold first, you knew what was coming, and you run the country. Lucky you. Everyone else gets the pledge.'
        : 'You didn’t sell before the rules changed. You didn’t get the memo. And you’re not the Prime Minister. But you can still pledge your vote.';
      result.style.display = 'block';
    } else {
      result.style.display = 'none';
    }
  }

  // ===================================================================
  //  PLEDGE FORM / PHASES
  // ===================================================================
  function showPhase() {
    $('#phaseForm').style.display = state.phase === 'form' ? 'block' : 'none';
    $('#phaseDonate').style.display = state.phase === 'donate' ? 'block' : 'none';
    $('#phaseConfirm').style.display = state.phase === 'confirm' ? 'block' : 'none';
  }

  function scrollPledgeTop() {
    var sec = $('#pledge');
    if (sec) window.scrollTo({ top: sec.getBoundingClientRect().top + window.pageYOffset - 70, behavior: 'smooth' });
  }

  function submit(e) {
    e.preventDefault();
    var first = ($('#fFirst').value || '').trim();
    var last = ($('#fLast').value || '').trim();
    var email = ($('#fEmail').value || '').trim();
    var postcode = ($('#fPostcode').value || '').trim();
    var err = $('#formError');
    var fail = function (msg) { err.textContent = msg; err.style.display = 'block'; };

    if (!first || !last) { fail('Please enter your first and last name.'); return; }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { fail('Please enter a valid email address.'); return; }
    if (!/^\d{4}$/.test(postcode)) { fail('Please enter a valid 4-digit Australian postcode.'); return; }
    var st = postcodeState(postcode);
    if (!st) { fail("That postcode doesn't match an Australian state. Check it and try again."); return; }

    err.style.display = 'none';
    state.count += 1;
    state.pledgeNo = state.count;
    state.sentState = st;
    state.sentPostcode = postcode;
    state.sentName = first + ' ' + last;
    state.phase = 'donate';

    renderCount();
    renderDonate();
    renderConfirm();
    showPhase();
    scrollPledgeTop();
  }

  // ===================================================================
  //  DONATE
  // ===================================================================
  var FREQ = [['once', 'One-off'], ['monthly', 'Monthly']];
  var TIERS = [[26, 'How-to-vote cards', false], [65, 'Most popular', true], [265, 'A run of online ads', false], [550, 'A day of doorknocking', false], [1500, 'A local billboard', false]];

  function effectiveAmount() {
    var custom = parseInt((state.customAmount || '').replace(/[^0-9]/g, ''), 10);
    if (!isNaN(custom) && custom > 0) return custom;
    return state.donationSel || 0;
  }

  function buildDonate() {
    // frequency toggle
    var fh = $('#freqOptions');
    fh.innerHTML = '';
    FREQ.forEach(function (f) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = f[1];
      btn.dataset.freq = f[0];
      btn.addEventListener('click', function () { state.donationFreq = f[0]; renderDonate(); });
      fh.appendChild(btn);
    });

    // tiers
    var th = $('#donationTiers');
    th.innerHTML = '';
    TIERS.forEach(function (t) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.dataset.amt = t[0];
      btn.dataset.popular = t[2] ? '1' : '';
      btn.innerHTML =
        '<span data-amt-label></span>' +
        '<span data-tag-label></span>';
      $('[data-amt-label]', btn).textContent = '$' + t[0].toLocaleString('en-AU');
      $('[data-tag-label]', btn).textContent = t[1];
      btn.addEventListener('click', function () {
        state.donationSel = t[0];
        state.customAmount = '';
        if ($('#customAmt')) $('#customAmt').value = '';
        renderDonate();
      });
      th.appendChild(btn);
    });
    // custom field
    var custom = document.createElement('div');
    custom.style.cssText = 'border: 2px dashed #c9b884; border-radius: 12px; padding: 14px 12px; display: flex; flex-direction: column; justify-content: center; gap: 4px;';
    custom.innerHTML =
      '<span style="font-size: 11px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; color: #9a8c62;">Other</span>' +
      '<div style="display: flex; align-items: baseline; gap: 2px;">' +
        '<span style="font-family: \'DM Serif Display\', serif; font-size: 22px; color: #161412;">$</span>' +
        '<input id="customAmt" type="text" inputmode="numeric" placeholder="—" style="width: 100%; border: none; background: transparent; font-family: \'DM Serif Display\', serif; font-size: 22px; color: #161412; outline: none; padding: 0;">' +
      '</div>';
    th.appendChild(custom);
    $('#customAmt').addEventListener('input', function (e) {
      state.customAmount = e.target.value;
      state.donationSel = null;
      renderDonate();
    });

    $('#donateBtn').addEventListener('click', donate);
    $('#skipDonateBtn').addEventListener('click', skipDonate);
    renderDonate();
  }

  function renderDonate() {
    var freq = state.donationFreq;
    $$('#freqOptions button').forEach(function (btn) {
      var active = freq === btn.dataset.freq;
      btn.style.cssText =
        'flex: 1; padding: 11px 8px; cursor: pointer; border-radius: 7px; border: none;' +
        "font-family: 'Libre Franklin', sans-serif; font-weight: 800; font-size: 14px;" +
        'letter-spacing: .03em; transition: all .15s ease;' +
        'background: ' + (active ? '#161412' : 'transparent') + ';' +
        'color: ' + (active ? '#F5C518' : '#7a6f53') + ';';
    });

    var hasCustom = !!(state.customAmount && parseInt(state.customAmount.replace(/[^0-9]/g, ''), 10) > 0);
    $$('#donationTiers button').forEach(function (btn) {
      var amt = parseInt(btn.dataset.amt, 10);
      var popular = btn.dataset.popular === '1';
      var active = !hasCustom && state.donationSel === amt;
      btn.style.cssText =
        'display: flex; flex-direction: column; gap: 4px; text-align: left;' +
        'padding: 14px 14px; cursor: pointer; border-radius: 12px;' +
        'background: ' + (active ? '#1B7340' : '#fff') + ';' +
        'border: ' + (active ? '2px solid #1B7340' : (popular ? '2px solid #C9A227' : '2px solid #e2d4a6')) + ';' +
        'box-shadow: ' + (active ? '0 6px 0 #0d4327' : 'none') + ';' +
        'transition: all .14s ease;';
      $('[data-amt-label]', btn).style.cssText = "font-family: 'DM Serif Display', serif; font-size: 26px; line-height: 1; color: " + (active ? '#fff' : '#161412') + ';';
      $('[data-tag-label]', btn).style.cssText = 'font-size: 11px; font-weight: 700; letter-spacing: .02em; text-transform: uppercase; color: ' + (active ? '#9fe0bb' : (popular ? '#B8860B' : '#9a8c62')) + ';';
    });

    var effAmt = effectiveAmount();
    var freqWord = freq === 'monthly' ? '/mo' : '';
    $('#donateBtn').textContent = effAmt > 0 ? ('Donate $' + effAmt.toLocaleString('en-AU') + freqWord) : 'Choose an amount';
    $('[data-donate-blurb]').textContent = effAmt > 0
      ? (freq === 'monthly'
          ? '$' + effAmt.toLocaleString('en-AU') + ' a month keeps the pressure on every senator who backs the change.'
          : 'A one-off $' + effAmt.toLocaleString('en-AU') + ' goes straight to reaching more voters before the Senate votes.')
      : 'Every dollar is spent reaching voters in the states where the Senate vote is closest.';

    // pledge number in the donate banner
    $$('[data-pledge-no]').forEach(function (el) { el.textContent = state.pledgeNo ? fmtN(state.pledgeNo) : ''; });
  }

  function donate() {
    var amt = effectiveAmount();
    if (amt <= 0) return;
    state.donatedAmount = amt;
    state.phase = 'confirm';
    renderConfirm();
    showPhase();
    scrollPledgeTop();
  }

  function skipDonate() {
    state.donatedAmount = null;
    state.phase = 'confirm';
    renderConfirm();
    showPhase();
    scrollPledgeTop();
  }

  // ===================================================================
  //  CONFIRMATION + SENATOR EMAIL + SHARE
  // ===================================================================
  var SHARE_LINES = [
    "Albo sold his property under the old rules. Then he changed them for everyone else. That's not reform — that's luck. #AlbosLuck",
    'I want the same CGT deal the Prime Minister got. #AlbosLuck',
    'Rules for thee, not for me. #AlbosLuck'
  ];

  function buildEmail() {
    var st = state.sentState, pc = state.sentPostcode, name = state.sentName;
    var subject = 'A constituent in ' + (pc || '0000') + ' wants the same CGT deal the Prime Minister got';
    var body =
'Dear Senator,\n\n' +
'My name is ' + (name || '[your name]') + '. I am a voter in ' + (st || '[state]') + '.\n\n' +
'I note that Prime Minister Albanese sold his Marrickville investment property and claimed the 50% CGT discount before announcing its abolition in the 2026 Budget.\n\n' +
'I would like the same deal the Prime Minister gave himself.\n\n' +
'Since that is not possible under the proposed changes, I am writing to inform you that I will not vote for any senator or political party that supports the Treasury Laws Amendment (Tax Reform No. 1) Bill 2026 in its current form.\n\n' +
'If the 50% CGT discount was good enough for the Prime Minister\'s property sale, it should be good enough for every Australian.\n\n' +
fmtN(state.count) + ' Australians have made this same pledge.\n\n' +
'Yours sincerely,\n' +
(name || '[your name]') + '\n' +
(pc || '0000') + ', ' + (st || '[state]');
    return { subject: subject, body: body };
  }

  function copyText(key, text, labelEl, doneLabel, normalLabel) {
    try { if (navigator.clipboard) navigator.clipboard.writeText(text); } catch (e) {}
    if (labelEl) {
      labelEl.textContent = doneLabel;
      setTimeout(function () { labelEl.textContent = normalLabel; }, 1800);
    }
  }

  function renderConfirm() {
    var st = state.sentState;
    var email = buildEmail();
    $('[data-email-subject]').textContent = email.subject;
    $('[data-email-body]').textContent = email.body;

    $$('[data-pledge-no]').forEach(function (el) { el.textContent = state.pledgeNo ? fmtN(state.pledgeNo) : ''; });

    var senLine = st ? ('Personalised emails dispatched to all ' + senatorsFor(st) + ' senators for ' + stateName(st) + '.') : '';
    $('[data-sen-line]').textContent = senLine;

    var dl = $('[data-donated-line]');
    if (state.donatedAmount) {
      dl.innerHTML = '<span style="font-size: 14px;">♥</span>' +
        'Thank you — your $' + state.donatedAmount.toLocaleString('en-AU') + (state.donationFreq === 'monthly' ? '/mo' : '') + ' donation is confirmed.';
      dl.style.display = 'inline-flex';
    } else {
      dl.style.display = 'none';
    }

    // copy email button
    var copyBtn = $('#copyEmailBtn');
    copyBtn.onclick = function () {
      copyText('email', 'Subject: ' + email.subject + '\n\n' + email.body, copyBtn, 'Copied ✓', 'Copy this email');
    };

    // share items
    var sh = $('#shareItems');
    sh.innerHTML = '';
    SHARE_LINES.forEach(function (text) {
      var row = document.createElement('div');
      row.style.cssText = 'background: #103f27; border: 1px solid rgba(201,162,39,.35); border-radius: 10px; padding: 16px 18px; display: flex; gap: 14px; align-items: center; justify-content: space-between;';
      row.innerHTML =
        '<p style="font-size: 14px; color: #ece2c4; margin: 0; line-height: 1.45;">' + text + '</p>' +
        '<button type="button" style="flex-shrink: 0; background: transparent; color: #F5C518; border: 1.5px solid #F5C518; border-radius: 6px; padding: 9px 14px; font-size: 12px; font-weight: 800; letter-spacing: .04em; text-transform: uppercase; cursor: pointer; font-family: \'Libre Franklin\', sans-serif;">Copy</button>';
      var btn = $('button', row);
      btn.addEventListener('click', function () { copyText('s', text, btn, 'Copied ✓', 'Copy'); });
      sh.appendChild(row);
    });
  }

  function reset() {
    state.phase = 'form';
    state.formError = '';
    state.pledgeNo = null;
    state.donationSel = null;
    state.customAmount = '';
    state.donatedAmount = null;
    $('#formError').style.display = 'none';
    showPhase();
    scrollPledgeTop();
  }

  // ===================================================================
  //  SCROLL ANIMATIONS — reveal, pokies reel, money rain
  // ===================================================================
  var moneyFired = false;

  function rainMoney() {
    var layer = $('#moneyLayer');
    if (!layer || moneyFired) return;
    moneyFired = true;
    var w = layer.clientWidth || 1000;
    var h = layer.clientHeight || 600;
    var total = 46;
    for (var i = 0; i < total; i++) {
      var s = document.createElement('span');
      var isEmoji = Math.random() < 0.22;
      s.textContent = isEmoji ? (Math.random() < 0.5 ? '💰' : '🪙') : '$';
      var size = 16 + Math.random() * 30;
      var dur = 2.4 + Math.random() * 2.6;
      var delay = Math.random() * 1.4;
      var fall = h + 120;
      var spin = (Math.random() < 0.5 ? -1 : 1) * (180 + Math.random() * 540);
      s.style.cssText =
        'position:absolute;top:-40px;left:' + (Math.random() * w) + 'px;' +
        'font-family:"DM Serif Display",serif;font-weight:700;' +
        'font-size:' + size + 'px;line-height:1;' +
        (isEmoji ? '' : 'color:#F5C518;text-shadow:0 2px 0 #B8860B,0 0 14px rgba(245,197,24,.55);') +
        'will-change:transform,opacity;' +
        '--fall:' + fall + 'px;--spin:' + spin + 'deg;' +
        'animation:moneyFall ' + dur + 's cubic-bezier(.4,.05,.6,1) ' + delay + 's forwards;';
      (function (node, dur, delay) {
        layer.appendChild(node);
        setTimeout(function () { if (node.parentNode) node.remove(); }, (dur + delay) * 1000 + 200);
      })(s, dur, delay);
    }
  }

  function setupScroll() {
    var reveals = $$('[data-reveal]');
    var reels = $$('[data-reel]');
    reels.forEach(function (el, i) { el.dataset.reelIndex = i; });

    function playReel(el) {
      var i = parseInt(el.dataset.reelIndex || '0', 10);
      var d = Math.min(i, 6) * 0.09;
      el.style.animation = 'none';
      void el.offsetWidth;
      el.style.animation = 'reelLand .72s cubic-bezier(.18,.9,.25,1.12) both';
      el.style.animationDelay = d + 's';
      var dot = el.querySelector('span');
      if (dot) {
        dot.style.animation = 'none';
        void dot.offsetWidth;
        dot.style.animation = 'dingPulse .55s ease ' + (d + 0.4) + 's 1';
      }
    }

    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (ents) {
        ents.forEach(function (e) {
          if (e.isIntersecting) {
            if (e.target.hasAttribute('data-reel')) playReel(e.target);
            else { e.target.style.opacity = '1'; e.target.style.transform = 'none'; }
            io.unobserve(e.target);
          }
        });
      }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
      reveals.forEach(function (el) { io.observe(el); });
      reels.forEach(function (el) { io.observe(el); });

      var burst = $('[data-money-burst]');
      if (burst) {
        var mio = new IntersectionObserver(function (ents) {
          ents.forEach(function (e) {
            if (e.isIntersecting) { rainMoney(); mio.unobserve(e.target); }
          });
        }, { threshold: 0.3 });
        mio.observe(burst);
      }
    } else {
      reels.forEach(playReel);
      reveals.forEach(function (el) { el.style.opacity = '1'; el.style.transform = 'none'; });
    }

    // safety fallback
    setTimeout(function () {
      reveals.forEach(function (el) { el.style.opacity = '1'; el.style.transform = 'none'; });
      reels.forEach(function (el) { if (getComputedStyle(el).opacity === '0') playReel(el); });
    }, 3200);
  }

  // ===================================================================
  //  NAV DONATE BUTTON
  // ===================================================================
  function wireNav() {
    var btn = $('#donateNav');
    if (!btn) return;
    btn.addEventListener('click', function () {
      if (state.phase === 'confirm' || state.phase === 'donate') {
        state.phase = 'donate';
        showPhase();
      }
      scrollPledgeTop();
    });
  }

  // ===================================================================
  //  INIT
  // ===================================================================
  function init() {
    renderCount();
    wireCalc();
    buildQuiz();
    buildDonate();
    showPhase();
    wireNav();
    setupScroll();

    $('#pledgeForm').addEventListener('submit', submit);
    $('#resetBtn').addEventListener('click', reset);

    // live ticking counter
    setInterval(function () {
      state.count += (1 + Math.floor(Math.random() * 4));
      renderCount();
    }, 3400);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
