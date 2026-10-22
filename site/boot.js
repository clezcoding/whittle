// Runs before first paint: theme from the saved choice, and a "js" flag so the reveal styles only apply when scripts work.
(function () {
  var d = document.documentElement;
  d.classList.add('js');
  try {
    var t = localStorage.getItem('whittle-theme');
    if (t === 'light' || t === 'dark') d.setAttribute('data-theme', t);
  } catch (e) { /* storage blocked: follow the system */ }
})();
