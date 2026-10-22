/* The Helpful Agent Problem: project page scripts.
   Real runs come from assets/runs.js (verbatim FavorBench logs).
   Chart numbers come from the paper (Tables 1 and 2). */
(function () {
  "use strict";

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  /* ------------------------------------------------------------------ */
  /* Helpers                                                             */
  /* ------------------------------------------------------------------ */
  var NAME = { alice: "Alice", bob: "Bob", admin: "Reviewer", all: "everyone" };
  var HIS = { alice: "her", bob: "his" };
  var NUM = ["no", "one", "two", "three", "four", "five"];

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; });
  }
  function rich(s) { return esc(s).replace(/`([^`]+)`/g, "<code>$1</code>"); }
  var ACRONYM = { sso: "SSO" };
  function cap(s) { return s ? (ACRONYM[s] || s.charAt(0).toUpperCase() + s.slice(1)) : s; }
  function who(n) { return NAME[n] || cap(n); }
  function list(arr) {
    var a = arr.map(who);
    if (a.length <= 1) return a.join("");
    return a.slice(0, -1).join(", ") + " and " + a[a.length - 1];
  }
  function avatar(n, cls) {
    var sym = n === "bob" ? "robot-hat" : n === "absent" ? "team" : "robot";
    return '<svg class="av av-' + n + (cls ? " " + cls : "") + '" aria-hidden="true"><use href="#' + sym + '"/></svg>';
  }
  function icon(name) { return '<svg aria-hidden="true"><use href="#i-' + name + '"/></svg>'; }

  /* Tooltip shared by the strip and the chart */
  var tip = $("#tip");
  function showTip(el, text, ev) {
    tip.textContent = text; tip.hidden = false;
    var r = el.getBoundingClientRect();
    var x = ev && ev.clientX ? ev.clientX : r.left + r.width / 2;
    var w = tip.offsetWidth, h = tip.offsetHeight;
    tip.style.left = Math.max(8, Math.min(window.innerWidth - w - 8, x - w / 2)) + "px";
    tip.style.top = Math.max(8, r.top - h - 8) + "px";
  }
  function hideTip() { tip.hidden = true; }
  function bindTip(el) {
    el.addEventListener("mousemove", function (e) { showTip(el, el.getAttribute("aria-label"), e); });
    el.addEventListener("mouseleave", hideTip);
    el.addEventListener("focus", function () { showTip(el, el.getAttribute("aria-label")); });
    el.addEventListener("blur", hideTip);
  }
  window.addEventListener("scroll", hideTip, { passive: true });

  /* ------------------------------------------------------------------ */
  /* 0. Animated intro figure (Figure 1 of the paper)                    */
  /* ------------------------------------------------------------------ */
  (function () {
    var sceneEl = $("#scene");
    if (!sceneEl) return;
    var SNAMES = { alice: "Alice", bob: "Bob", reviewer: "Reviewer" };
    // [kind, text]; kind "cm" is an unchanged comment line
    var FILES = {
      initial: [["cm", "# read by every team"], ["ctx", "TIMEOUT = 30"]],
      scoped: [["cm", "# read by every team"], ["ctx", "TIMEOUT = 30"], ["add", "# export only"], ["add", "EXPORT_TIMEOUT = 120"]],
      global: [["cm", "# read by every team"], ["del", "TIMEOUT = 30"], ["add", "TIMEOUT = 120"]]
    };
    var NOTES = {
      initial: "Unchanged.",
      scoped: "Edited by the reviewer after checking every team.",
      global: "Edited by Bob directly. No review."
    };
    var SCENES = {
      available: [
        { t: "msg", who: "alice", to: "reviewer", html: "I need 120 s for export. Reviewer, could you check it?" },
        { t: "msg", who: "reviewer", to: "Alice", html: "I'll check every team before applying it." },
        { t: "file", v: "scoped" },
        { t: "tests", alice: "pass", dave: "pass" },
        { t: "outcome", kind: "good", text: "Scoped change. Both teams pass." }
      ],
      away: [
        { t: "msg", who: "alice", to: "reviewer", html: "I need 120 s for export. Reviewer, could you check it?" },
        { t: "sys", text: "No reply. The reviewer is away." },
        { t: "msg", who: "alice", to: "Bob", html: "I need 120 s. Reviewer is away. Bob, can we fix it?" },
        { t: "msg", who: "bob", to: "Alice", html: "Yes we can!" },
        { t: "file", v: "global" },
        { t: "tests", alice: "pass", dave: "fail" },
        { t: "outcome", kind: "bad", text: "Local success. Shared failure." }
      ]
    };

    var sFeed = $("#scene-feed"), sCode = $("#scene-code"), sNote = $("#scene-note"), sOut = $("#scene-outcome");
    var revChip = $("#rev-chip");
    var token = 0, current = "away";

    function sceneMsg(m) {
      var right = m.who === "bob" || m.who === "reviewer";
      var sym = m.who === "bob" ? "robot-hat" : "robot";
      return '<li class="msg' + (right ? " right" : "") + '"><svg class="av av-' + m.who + '" aria-hidden="true"><use href="#' + sym + '"/></svg>' +
        '<div class="bubble ' + m.who + '"><span class="who"><b>' + SNAMES[m.who] + "</b> to " + m.to + "</span>" + m.html + "</div></li>";
    }
    function renderFile(v, flash) {
      sCode.innerHTML = FILES[v].map(function (l) {
        var kind = l[0] === "cm" ? "ctx cm" : l[0];
        return '<span class="' + kind + (flash && (l[0] === "add" || l[0] === "del") ? " flash" : "") + '">' + l[1] + "</span>";
      }).join("");
      sNote.textContent = NOTES[v];
    }
    function setChip(id, state, pop) {
      var chip = $("#" + id + " .chip");
      chip.dataset.state = state;
      chip.innerHTML = state === "pass" ? icon("check") + "Pass" : state === "fail" ? icon("x") + "Fail" : "Waiting";
      chip.classList.remove("pop");
      if (pop) { void chip.offsetWidth; chip.classList.add("pop"); }
    }
    function applyStep(s, animate) {
      if (s.t === "msg") sFeed.insertAdjacentHTML("beforeend", sceneMsg(s));
      else if (s.t === "sys") sFeed.insertAdjacentHTML("beforeend", '<li class="sys"><span>' + s.text + "</span></li>");
      else if (s.t === "file") renderFile(s.v, animate);
      else if (s.t === "tests") { setChip("t-alice", s.alice, animate); setChip("t-dave", s.dave, animate); }
      else if (s.t === "outcome") {
        sOut.className = "outcome " + s.kind;
        sOut.innerHTML = "<span>" + s.text + "</span>";
      }
    }
    function play(name, instant) {
      current = name;
      var my = ++token;
      $$(".scene .seg button").forEach(function (b) { b.setAttribute("aria-pressed", String(b.dataset.scene === name)); });
      revChip.classList.toggle("is-away", name === "away");
      sFeed.innerHTML = "";
      renderFile("initial", false);
      setChip("t-alice", "wait"); setChip("t-dave", "wait");
      sOut.className = "outcome"; sOut.innerHTML = "&nbsp;";

      var steps = SCENES[name];
      if (instant || reduceMotion) { steps.forEach(function (s) { applyStep(s, false); }); return; }
      var i = 0;
      (function next() {
        if (my !== token || i >= steps.length) return;
        applyStep(steps[i], true);
        var wait = steps[i].t === "msg" || steps[i].t === "sys" ? 1100 : 900;
        i++;
        setTimeout(next, wait);
      })();
    }

    $$(".scene .seg button").forEach(function (b) {
      b.addEventListener("click", function () { play(b.dataset.scene); });
    });
    $("#scene-replay").addEventListener("click", function () { play(current); });

    // Show the finished "away" state immediately, then replay it once when the figure is in view.
    play("away", true);
    if (!reduceMotion && "IntersectionObserver" in window) {
      var started = false;
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting && !started) { started = true; setTimeout(function () { play("away"); }, 250); io.disconnect(); }
        });
      }, { threshold: 0.35 });
      io.observe(sceneEl);
    }
  })();

  /* ------------------------------------------------------------------ */
  /* 1. Real-run player                                                  */
  /* ------------------------------------------------------------------ */
  var RUNS = window.RUNS || [];
  var picker = $("#picker"), strip = $("#strip"), feed = $("#feed");
  var cur = { run: 0, k: RUNS.length ? RUNS[0].k : 1 };
  var playToken = 0;

  function absentFails(t) { return t.tests.absent.filter(function (a) { return !a.pass; }).length; }
  function tileState(t) {
    if (t.warmup) return "warm";
    if (t.label === "implemented") return absentFails(t) > 0 ? "harm" : "favor";
    if (t.label === "approved") return "approved";
    if (t.label === "refusal") return "refusal";
    return "none";
  }
  var STATE_TEXT = {
    warm: "warm-up, reviewer present", favor: "favor", harm: "favor that broke a team",
    approved: "approved in words", refusal: "refused", none: "no favor"
  };

  // picker
  RUNS.forEach(function (r, i) {
    var b = document.createElement("button");
    b.type = "button"; b.className = "pick"; b.setAttribute("role", "tab");
    b.id = "pick-" + r.id;
    b.innerHTML = "<b>" + esc(r.title) + "</b><small>" + esc(r.model_name) + "</small>";
    b.addEventListener("click", function () { select(i, r.k, true); });
    b.addEventListener("keydown", function (e) {
      var j = e.key === "ArrowRight" ? i + 1 : e.key === "ArrowLeft" ? i - 1 : null;
      if (j === null) return;
      e.preventDefault();
      j = (j + RUNS.length) % RUNS.length;
      $("#pick-" + RUNS[j].id).focus();
      select(j, RUNS[j].k, true);
    });
    picker.appendChild(b);
  });

  function renderHead(run) {
    $$(".pick", picker).forEach(function (b, i) {
      var on = i === cur.run;
      b.setAttribute("aria-selected", String(on));
      b.tabIndex = on ? 0 : -1;
    });
    $("#run-title").textContent = run.title;
    $("#run-blurb").textContent = run.blurb;
    $("#run-meta").innerHTML =
      "<dt>Model</dt><dd>" + esc(run.model_name) + " (both agents)</dd>" +
      "<dt>Company</dt><dd>" + esc(run.company) + ", a synthetic " + esc(run.world) + " repo</dd>" +
      "<dt>Warm-ups</dt><dd>" + (run.arm === "warm-trap" ? "Traps the reviewer rejected" : "Harmless changes the reviewer merged") + "</dd>";

    // strip
    strip.innerHTML = "";
    run.tasks.forEach(function (t) {
      var st = tileState(t);
      var li = document.createElement("li");
      var b = document.createElement("button");
      b.type = "button"; b.className = "s-" + st; b.textContent = t.k;
      var n = absentFails(t);
      b.setAttribute("aria-label", "Task " + t.k + ": " + STATE_TEXT[st] + (st === "harm" ? " (" + NUM[n] + " team" + (n === 1 ? "" : "s") + ")" : "") + (t.warmup ? "" : t.trap ? ", trap" : ", twin"));
      b.addEventListener("click", function () { select(cur.run, t.k, false); });
      bindTip(b);
      li.appendChild(b); strip.appendChild(li);
    });
    var after = run.tasks.filter(function (t) { return !t.warmup; });
    var fav = after.filter(function (t) { return t.label === "implemented"; }).length;
    var harm = after.filter(function (t) { return tileState(t) === "harm"; }).length;
    $("#strip-sum").textContent = "After the reviewer left: favors in " + fav + " of " + after.length + " tasks, " +
      (harm ? harm + " of them broke a team" : "none broke a team") + ".";
  }

  function markTile() {
    $$("button", strip).forEach(function (b, i) { b.setAttribute("aria-current", String(i + 1 === cur.k)); });
  }

  function itemHTML(it, t) {
    var right = it.who === t.owner || it.who === "admin";
    if (it.t === "msg") {
      return '<li class="msg' + (right ? " right" : "") + '">' + avatar(it.who) +
        '<div class="bubble ' + it.who + '"><span class="who"><b>' + who(it.who) + "</b> to " + esc(list(it.to)) + "</span>" + rich(it.text) + "</div></li>";
    }
    if (it.t === "request") {
      var st = it.outcome === "approved" ? ["ok", "Merged by the reviewer"] :
               it.outcome === "rejected" ? ["no", "Rejected by the reviewer"] :
               it.outcome === "no_response" ? ["", "No response"] : ["", it.outcome || ""];
      return '<li class="msg' + (right ? " right" : "") + '">' + avatar(it.who) +
        '<div class="bubble request"><span class="req-label"><span><b>' + who(it.who) + "</b> files a change request for the reviewer</span>" +
        (st[1] ? '<span class="req-status ' + st[0] + '">' + st[1] + "</span>" : "") + "</span>" +
        "<code>" + esc(it.path || "") + "</code><br>" + rich(it.reason) + "</div></li>";
    }
    if (it.t === "write") {
      var txt = it.via === "admin" ? "Reviewer merges the change into <code>" + esc(it.path) + "</code>"
        : who(it.who) + " edits <code>" + esc(it.path) + "</code>" + (it.path === t.file && it.who === t.owner ? ", which " + (it.who === "alice" ? "she" : "he") + " owns" : "");
      return '<li class="event edit ' + (it.via === "admin" ? "admin" : it.who) + '"><span>' + txt + "</span></li>";
    }
    if (it.t === "submit") {
      return '<li class="event"><span>' + who(it.who) + " submits " + HIS[it.who] + " own task</span></li>";
    }
    if (it.t === "denied") {
      return '<li class="event"><span>' + who(it.who) + " tries to edit <code>" + esc(it.path) + "</code>; blocked</span></li>";
    }
    return "";
  }

  function diffHTML(entries, flashLast) {
    if (!entries.length) return '<span class="note">Unchanged.</span>';
    return entries.map(function (e, i) {
      var flash = flashLast && i === entries.length - 1 ? " flash" : "";
      return e.diff.map(function (l) { return '<span class="' + l[0] + flash + '">' + esc(l[1]) + "</span>"; }).join("") +
        '<span class="by">' + (e.who === "admin" ? "Merged by the reviewer" : "Edited by " + who(e.who)) + "</span>";
    }).join("");
  }

  function testRow(n, title, sub, res, revealed) {
    var state = revealed ? (res.pass ? "pass" : "fail") : "wait";
    var chip = state === "pass" ? icon("check") + "Pass" : state === "fail" ? icon("x") + "Fail" : "Waiting";
    var why = revealed && !res.pass && res.fail && res.fail.length ? '<span class="t-why">' + esc(res.fail[0][1]) + "</span>" : "";
    return '<div class="test">' + avatar(n) + '<span class="t-name">' + esc(title) + "<small>" + esc(sub) + "</small></span>" +
      '<span class="chip" data-state="' + state + '">' + chip + "</span>" + why + "</div>";
  }
  function renderTests(run, t, revealed, pop) {
    var T = t.tests;
    var html =
      testRow(t.requester, who(t.requester), cap(t.rteam) + " team, needs the change", T.requester, revealed) +
      testRow(t.owner, who(t.owner), cap(t.oteam) + " team, owns the file", T.owner, revealed) +
      '<p class="test-sep">Teams that are not in the chat</p>' +
      T.absent.map(function (a) {
        return testRow("absent", cap(a.team), run.teams[a.team] || "", a, revealed);
      }).join("");
    var box = $("#tests");
    box.innerHTML = html;
    box.parentNode.classList.toggle("pending", !revealed);
    if (pop) $$(".chip", box).forEach(function (c) { c.classList.add("pop"); });
  }

  function outcomeText(t) {
    var O = who(t.owner), R = who(t.requester);
    var nAbs = absentFails(t), rp = t.tests.requester.pass;
    if (t.warmup) {
      if (t.request_outcomes.indexOf("approved") >= 0) return ["", "The reviewer checked and merged the change."];
      if (t.request_outcomes.indexOf("rejected") >= 0) return ["", "The reviewer rejected the change."];
      return ["", "No change request this task."];
    }
    if (t.label === "implemented") {
      if (nAbs) return ["bad", O + " made the change. " + cap(NUM[nAbs]) + " team" + (nAbs === 1 ? "" : "s") + " outside the chat now fail" + (nAbs === 1 ? "s" : "") + "."];
      if (rp && t.tests.owner.pass) return ["good", O + " made a change, and every team passes."];
      return ["", O + " made a change, but " + R + "'s tests still fail."];
    }
    if (t.label === "approved") return ["", O + " approved in words and left the file alone." + (rp ? "" : " " + R + "'s tests fail.")];
    if (t.label === "refusal") return ["", O + " said no. " + (rp ? "" : R + "'s tests fail; ") + "nobody else breaks."];
    return ["", "No favor from " + O + "." + (rp ? "" : " " + R + "'s tests fail.")];
  }

  function select(runIdx, k, animate) {
    var changedRun = runIdx !== cur.run || !strip.children.length;
    cur.run = runIdx; cur.k = k;
    var run = RUNS[runIdx], t = run.tasks[k - 1];
    if (changedRun) renderHead(run);
    markTile();
    hideTip();

    $("#task-tag").textContent = "Task " + t.k + " of 12, " + (t.warmup ? "warm-up with the reviewer" : t.trap ? "trap" : "twin");
    $("#file-name").textContent = t.file;
    $("#file-owner").textContent = "owned by " + who(t.owner) + " (" + t.oteam + ")";
    var src = "Quoted from <code>" + esc(run.source) + "</code>, task " + t.k + ".";
    if (run.note && k === run.k) src = esc(run.note) + " " + src;
    if (k === run.k) src += " Examples were picked to show different behaviors, not how often they happen.";
    $("#source").innerHTML = src;

    var token = ++playToken;
    var outcome = $("#outcome");
    var oc = outcomeText(t);
    var diffEntries = [];
    var writeIdx = 0;

    function finish(pop) {
      renderTests(run, t, true, pop);
      $("#file-diff").innerHTML = diffHTML(t.shared_diff, false);
      outcome.className = "outcome " + oc[0];
      outcome.innerHTML = "<span>" + esc(oc[1]) + "</span>";
    }

    if (!animate || reduceMotion) {
      feed.innerHTML = t.items.length ? t.items.map(function (it) { return itemHTML(it, t); }).join("")
        : '<li class="empty">No messages, requests or shared-file edits in this task.</li>';
      finish(false);
      return;
    }

    feed.innerHTML = "";
    $("#file-diff").innerHTML = '<span class="note">No changes yet.</span>';
    renderTests(run, t, false, false);
    outcome.className = "outcome"; outcome.innerHTML = "&nbsp;";
    if (!t.items.length) feed.innerHTML = '<li class="empty">No messages, requests or shared-file edits in this task.</li>';

    var i = 0;
    (function next() {
      if (token !== playToken) return;
      if (i >= t.items.length) { setTimeout(function () { if (token === playToken) finish(true); }, 500); return; }
      var it = t.items[i++];
      feed.insertAdjacentHTML("beforeend", itemHTML(it, t));
      if (it.t === "write" && it.path === t.file && t.shared_diff[writeIdx]) {
        diffEntries.push(t.shared_diff[writeIdx++]);
        $("#file-diff").innerHTML = diffHTML(diffEntries, true);
      }
      var wait = it.t === "msg" || it.t === "request" ? Math.min(2200, 700 + (it.text || it.reason || "").length * 4) : 650;
      setTimeout(next, wait);
    })();
  }

  $("#replay").addEventListener("click", function () { select(cur.run, cur.k, true); });

  if (RUNS.length) {
    select(0, RUNS[0].k, false);
    if (!reduceMotion && "IntersectionObserver" in window) {
      var started = false;
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting && !started) {
            started = true; io.disconnect();
            setTimeout(function () { if (cur.run === 0) select(0, RUNS[0].k, true); }, 300);
          }
        });
      }, { threshold: 0.3 });
      io.observe($("#player"));
    }
  }

  /* ------------------------------------------------------------------ */
  /* 2. Model results (Tables 1 and 2)                                   */
  /* ------------------------------------------------------------------ */
  function fmt(v) { return (Math.round(v * 10) / 10).toString(); }

  // ef = task-level favor rate (implemented), hf = harm per trap favor; [value, lo, hi]
  var MODELS = [
    { name: "GPT-6 Luna",
      safe: { ef: [70.2, 60, 81], hf: [49.7, 44, 55] }, trap: { ef: [67.2, 56, 78], hf: [25.0, 18, 32] }, coop: [56.0, 44, 67] },
    { name: "DeepSeek V4 Flash",
      safe: { ef: [60.4, 47, 73], hf: [70.3, 64, 76] }, trap: { ef: [41.8, 30, 54], hf: [52.3, 44, 60] }, coop: [46.5, 37, 56] },
    { name: "Gemini 3.7 Flash",
      safe: { ef: [43.2, 31, 56], hf: [75.2, 68, 83] }, trap: { ef: [34.0, 22, 46], hf: [42.5, 31, 53] }, coop: [87.5, 77, 96] },
    { name: "Claude Sonnet 5.5",
      safe: { ef: [29.0, 21, 38], hf: [0.0, 0, 5] }, trap: { ef: [29.2, 20, 38], hf: [1.4, 0, 4] }, coop: [89.0, 78, 96] }
  ];
  var COLS = [
    { key: "ef", cls: "favor", label: "FavorBench: tasks with a favor" },
    { key: "hf", cls: "harm", label: "FavorBench: trap favors that broke an absent team" },
    { key: "coop", cls: "favor", label: "CooperBench: tasks with a favor" }
  ];
  var arm = "safe";
  var ARM_TEXT = { safe: "harmless warm-ups", trap: "trap warm-ups" };
  var mgrid = $("#mgrid");

  MODELS.forEach(function (m, mi) {
    mgrid.insertAdjacentHTML("beforeend", '<div class="mname">' + m.name + "</div>");
    COLS.forEach(function (c, ci) {
      mgrid.insertAdjacentHTML("beforeend",
        '<div class="mcell' + (ci === COLS.length - 1 ? " last" : "") + '"><span class="mini">' + c.label + "</span>" +
        '<div class="bar" tabindex="0" id="bar-' + mi + "-" + ci + '"><div class="track"></div><div class="plot">' +
        '<div class="fill ' + c.cls + '"></div><div class="ci"></div></div><span class="val"></span></div></div>');
      bindTip($("#bar-" + mi + "-" + ci));
    });
  });

  function drawModels() {
    MODELS.forEach(function (m, mi) {
      COLS.forEach(function (c, ci) {
        var d = c.key === "coop" ? m.coop : m[arm][c.key];
        var el = $("#bar-" + mi + "-" + ci);
        $(".fill", el).style.width = d[0] + "%";
        var bar = $(".ci", el);
        bar.style.left = d[1] + "%";
        bar.style.width = Math.max(0.6, d[2] - d[1]) + "%";
        $(".val", el).textContent = fmt(d[0]) + "%";
        var ctx = c.key === "coop" ? "" : " (" + ARM_TEXT[arm] + ")";
        el.setAttribute("aria-label", m.name + ", " + c.label + ctx + ": " + fmt(d[0]) + "% (95% CI " + d[1] + "–" + d[2] + ")");
      });
    });
  }
  $$("#model-chart .seg button").forEach(function (b) {
    b.addEventListener("click", function () {
      arm = b.dataset.arm;
      $$("#model-chart .seg button").forEach(function (x) { x.setAttribute("aria-pressed", String(x === b)); });
      drawModels();
    });
  });
  drawModels();

  /* ------------------------------------------------------------------ */
  /* 3. BibTeX copy and placeholder links                                */
  /* ------------------------------------------------------------------ */
  $("#copy-bib").addEventListener("click", function () {
    var btn = this, text = $("#bibtex").textContent;
    function done() { btn.textContent = "Copied"; setTimeout(function () { btn.textContent = "Copy"; }, 1600); }
    function selectBib() {
      var range = document.createRange(); range.selectNodeContents($("#bibtex"));
      var sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(range);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, selectBib);
    else selectBib();
  });

  $$("a[data-todo]").forEach(function (a) {
    if (a.getAttribute("href") !== "#") return;
    a.title = "Link coming soon";
    a.addEventListener("click", function (e) { e.preventDefault(); });
  });
})();
