(function () {
  "use strict";

  function renderEquations() {
    document.querySelectorAll("[data-tex]").forEach(function (element) {
      if (!window.katex || element.dataset.mathState === "rendered") return;

      var fallback = element.innerHTML;
      try {
        window.katex.render(element.dataset.tex, element, {
          displayMode: element.classList.contains("display-math"),
          output: "htmlAndMathml",
          throwOnError: true,
          strict: "warn",
          trust: false
        });
        element.dataset.mathState = "rendered";
      } catch (error) {
        element.innerHTML = fallback;
        element.dataset.mathState = "fallback";
        console.error("Spatium Novum could not render an equation.", error);
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", renderEquations, { once: true });
  } else {
    renderEquations();
  }
}());
