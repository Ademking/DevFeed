// Applies saved theme and font before first paint (MV3 forbids inline scripts).
try {
  var root = document.documentElement;
  var theme = JSON.parse(localStorage.getItem("bdd:theme") || '"dark"');
  root.classList.toggle("dark", theme !== "light");
  root.style.colorScheme = theme === "light" ? "light" : "dark";
  var vars = JSON.parse(localStorage.getItem("bdd:fontVars") || "{}");
  for (var k in vars) root.style.setProperty(k, vars[k]);
} catch (e) {}
