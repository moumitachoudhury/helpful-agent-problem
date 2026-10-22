/* Contents rail: highlight the section currently being read. */
(function () {
  "use strict";
  var links = Array.prototype.slice.call(document.querySelectorAll(".rail a[href^='#']"));
  if (!links.length || !("IntersectionObserver" in window)) return;
  var byId = {};
  links.forEach(function (a) { byId[a.getAttribute("href").slice(1)] = a; });
  var sections = Object.keys(byId).map(function (id) { return document.getElementById(id); }).filter(Boolean);
  var visible = {};

  function update() {
    var current = null;
    sections.forEach(function (s) { if (visible[s.id] && !current) current = s.id; });
    if (!current) return;
    links.forEach(function (a) {
      var on = a.getAttribute("href") === "#" + current;
      if (on) a.setAttribute("aria-current", "true"); else a.removeAttribute("aria-current");
    });
  }

  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) { visible[e.target.id] = e.isIntersecting; });
    update();
  }, { rootMargin: "-20% 0px -55% 0px" });
  sections.forEach(function (s) { io.observe(s); });
})();
