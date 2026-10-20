/* fill in these four values once. every legal page picks them up. */
window.LEGAL = {
  name: "Xander Lee Zhuo Yi",         // your full name, or your business name
  email: "xanderlzy@gmail.com",        // contact + data protection officer email
  date: "20 October 2026",         // effective date, e.g. "20 October 2026"
  region: "asia-southeast1 (singapore)"        // firestore region you picked, e.g. "asia-southeast1 (singapore)"
};
document.querySelectorAll("[data-l]").forEach(function (e) {
  var k = e.dataset.l, v = window.LEGAL[k];
  e.textContent = v || "[" + k + "]";
  if (!v) e.classList.add("ph");
  if (v && k === "email" && e.tagName === "A") e.href = "mailto:" + v;
});
