(function () {
  "use strict";

  const SVG_NS = "http://www.w3.org/2000/svg";

  function svgElement(name, attributes, text) {
    const node = document.createElementNS(SVG_NS, name);
    Object.entries(attributes || {}).forEach(([key, value]) => node.setAttribute(key, String(value)));
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function compact(value) {
    return new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 0 }).format(value);
  }

  function exact(value) {
    return new Intl.NumberFormat("en").format(value);
  }

  function initNetlib(shell) {
    const dataNode = shell.querySelector(".viz-data");
    const enhanced = shell.querySelector(".viz-enhanced");
    const fallback = shell.querySelector(".viz-fallback");
    const canvas = shell.querySelector("[data-viz-canvas]");
    const wrap = shell.querySelector(".viz-chart-wrap");
    const selector = shell.querySelector("[data-viz-model]");
    const annotation = shell.querySelector("[data-viz-annotation]");
    const readout = shell.querySelector("[data-viz-readout]");
    const description = canvas.querySelector("desc");

    if (!dataNode || !enhanced || !fallback || !canvas || !wrap || !selector) return;

    let data;
    try {
      data = JSON.parse(dataNode.textContent);
    } catch (error) {
      return;
    }

    const models = data.models;
    const summary = data.summary;
    let metric = "coupling";
    let selectedName = "STIGLER";
    let frame = 0;

    fallback.hidden = true;
    enhanced.hidden = false;
    shell.classList.add("is-enhanced");

    function selectedModel() {
      return models.find((model) => model.name === selectedName) || models[models.length - 1];
    }

    function updateWords() {
      const model = selectedModel();
      const displayName = model.name === "STIGLER" ? "Stigler" : model.name;
      annotation.textContent = metric === "density"
        ? `Stigler fills 84.0% of its matrix; the Netlib median is ${summary.densityMedian.toFixed(2)}%. The vertical scale is logarithmic.`
        : `Stigler touches 8.4 rows per choice; ${summary.aboveStigler} of 98 Netlib models touch more.`;
      readout.textContent = `${displayName} · ${exact(model.rows)} rows × ${exact(model.cols)} columns · ${exact(model.nonzeros)} non-zero cells · ${model.density.toFixed(2)}% dense · ${model.coupling.toFixed(2)} rows touched per decision.`;
      description.textContent = `${metric === "density" ? "Percentage density" : "Rows touched per decision"} plotted against row count for 98 Netlib models and Stigler. ${displayName} is selected: ${model.rows} rows, ${model.cols} columns, ${model.density.toFixed(2)} percent density, ${model.coupling.toFixed(2)} rows touched per decision.`;
    }

    function scheduleRender() {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(render);
    }

    function render() {
      const width = Math.max(300, Math.floor(wrap.getBoundingClientRect().width));
      const mobile = width < 520;
      const height = mobile ? 410 : 370;
      const margin = mobile
        ? { top: 44, right: 16, bottom: 58, left: 57 }
        : { top: 44, right: 74, bottom: 58, left: 64 };
      const plotWidth = width - margin.left - margin.right;
      const plotHeight = height - margin.top - margin.bottom;
      const minRows = 10;
      const maxRows = 100000;

      const x = (rows) => margin.left + (Math.log10(rows) - Math.log10(minRows)) /
        (Math.log10(maxRows) - Math.log10(minRows)) * plotWidth;
      const y = metric === "density"
        ? (value) => margin.top + (Math.log10(100) - Math.log10(Math.max(0.02, value))) /
          (Math.log10(100) - Math.log10(0.02)) * plotHeight
        : (value) => margin.top + (30 - Math.min(30, value)) / 30 * plotHeight;

      const title = canvas.querySelector("title").cloneNode(true);
      const desc = description.cloneNode(true);
      canvas.replaceChildren(title, desc);
      canvas.setAttribute("viewBox", `0 0 ${width} ${height}`);

      const group = svgElement("g", { class: "viz-plot" });
      canvas.appendChild(group);

      const yTicks = metric === "density" ? [0.03, 0.1, 0.3, 1, 3, 10, 30, 100] : [0, 5, 10, 20, 30];
      yTicks.forEach((tick) => {
        const py = y(tick);
        group.appendChild(svgElement("line", {
          class: "viz-gridline", x1: margin.left, x2: width - margin.right,
          y1: py, y2: py,
        }));
        group.appendChild(svgElement("text", {
          class: "viz-axis-label", x: margin.left - 9, y: py + 4, "text-anchor": "end",
        }, metric === "density" ? `${tick}%` : tick));
      });

      [10, 100, 1000, 10000, 100000].forEach((tick) => {
        const px = x(tick);
        group.appendChild(svgElement("line", {
          class: "viz-tick", x1: px, x2: px, y1: height - margin.bottom, y2: height - margin.bottom + 6,
        }));
        group.appendChild(svgElement("text", {
          class: "viz-axis-label", x: px, y: height - margin.bottom + 23, "text-anchor": "middle",
        }, compact(tick)));
      });

      group.appendChild(svgElement("line", {
        class: "viz-axis", x1: margin.left, x2: width - margin.right,
        y1: height - margin.bottom, y2: height - margin.bottom,
      }));
      group.appendChild(svgElement("text", {
        class: "viz-axis-title", x: margin.left, y: 20,
      }, metric === "density" ? "Matrix filled (%) · log scale" : "Rows touched by one decision"));
      group.appendChild(svgElement("text", {
        class: "viz-axis-title", x: margin.left + plotWidth / 2, y: height - 10, "text-anchor": "middle",
      }, "Rows in the model · log scale"));

      if (metric === "coupling") {
        const top = y(summary.couplingQ3);
        const bottom = y(summary.couplingQ1);
        group.appendChild(svgElement("rect", {
          class: "viz-iqr", x: margin.left, y: top, width: plotWidth, height: bottom - top,
        }));
      }

      const benchmark = metric === "density" ? summary.densityMedian : summary.couplingMedian;
      const benchmarkY = y(benchmark);
      group.appendChild(svgElement("line", {
        class: "viz-median", x1: margin.left, x2: width - margin.right,
        y1: benchmarkY, y2: benchmarkY,
      }));
      group.appendChild(svgElement("text", {
        class: "viz-median-label", x: width - margin.right, y: benchmarkY - 7, "text-anchor": "end",
      }, `Netlib median · ${metric === "density" ? `${benchmark.toFixed(2)}%` : benchmark.toFixed(1)}`));

      const labels = new Set(["STIGLER", "AFIRO", "STOCFOR3"]);
      models.forEach((model) => {
        const px = x(model.rows);
        const py = y(metric === "density" ? model.density : model.coupling);
        const point = svgElement("circle", {
          class: `viz-point${model.name === "STIGLER" ? " viz-point-stigler" : ""}`,
          cx: px, cy: py, r: model.name === "STIGLER" ? 5.5 : 2.7,
        });
        point.appendChild(svgElement("title", {}, `${model.name}: ${model.rows} rows, ${model.density.toFixed(2)}% dense, ${model.coupling.toFixed(2)} rows touched per decision`));
        group.appendChild(point);

        const hit = svgElement("circle", {
          class: "viz-hit", cx: px, cy: py, r: 12, "data-model": model.name,
          "aria-hidden": "true",
        });
        hit.addEventListener("click", () => {
          selectedName = model.name;
          selector.value = selectedName;
          updateWords();
          scheduleRender();
        });
        group.appendChild(hit);

        if (model.name === selectedName) {
          group.appendChild(svgElement("circle", {
            class: "viz-selected-ring", cx: px, cy: py, r: model.name === "STIGLER" ? 10 : 8,
          }));
        }

        if (labels.has(model.name)) {
          let dx = 8;
          let dy = -9;
          let anchor = "start";
          if (model.name === "STOCFOR3") {
            dx = -7;
            dy = metric === "coupling" ? 18 : -9;
            anchor = "end";
          }
          if (mobile && model.name === "STIGLER") dy = -12;
          group.appendChild(svgElement("text", {
            class: model.name === "STIGLER" ? "viz-direct-label viz-direct-label-stigler" : "viz-direct-label",
            x: px + dx, y: py + dy, "text-anchor": anchor,
          }, model.name === "STIGLER" ? "Stigler" : model.name));
        }
      });

      updateWords();
    }

    shell.querySelectorAll('input[name="netlib-metric"]').forEach((input) => {
      input.addEventListener("change", () => {
        if (!input.checked) return;
        metric = input.value;
        updateWords();
        scheduleRender();
      });
    });
    selector.addEventListener("change", () => {
      selectedName = selector.value;
      updateWords();
      scheduleRender();
    });

    if ("ResizeObserver" in window) {
      const observer = new ResizeObserver(scheduleRender);
      observer.observe(wrap);
    } else {
      window.addEventListener("resize", scheduleRender, { passive: true });
    }
    updateWords();
    scheduleRender();
  }

  document.querySelectorAll('[data-viz="netlib"]').forEach(initNetlib);
}());

/* Post 3 · integrality and branch-and-bound. */
(function () {
  "use strict";

  function parseData(root, selector) {
    var node = root.querySelector(selector);
    if (!node) return null;
    try { return JSON.parse(node.textContent); }
    catch (error) { return null; }
  }

  document.querySelectorAll('[data-viz="integer-rounding"]').forEach(function (root) {
    var data = parseData(root, ".integrality-data");
    var enhanced = root.querySelector(".integrality-enhanced");
    var fallback = root.querySelector(".integrality-fallback");
    var readout = root.querySelector("[data-integrality-readout]");
    var buttons = Array.from(root.querySelectorAll("[data-integrality-step]"));
    if (!data || !enhanced || !fallback || !readout || !buttons.length) return;

    function select(key) {
      var step = data.steps.find(function (item) { return item.key === key; });
      if (!step) return;
      buttons.forEach(function (button) {
        button.setAttribute("aria-pressed", String(button.dataset.integralityStep === key));
      });
      root.querySelectorAll("[data-stage-point]").forEach(function (point) {
        point.classList.toggle("is-current", point.dataset.stagePoint === key);
      });
      readout.dataset.tone = step.tone;
      readout.innerHTML = "<small>" + step.label + "</small><strong>" + step.point
        + "</strong><b>" + step.value + "</b><p>" + step.message + "</p>";
    }

    buttons.forEach(function (button) {
      button.addEventListener("click", function () { select(button.dataset.integralityStep); });
    });
    fallback.hidden = true;
    enhanced.hidden = false;
    select("lp");
  });

  document.querySelectorAll('[data-viz="branch-bound"]').forEach(function (root) {
    var data = parseData(root, ".bnb-data");
    var enhanced = root.querySelector(".bnb-enhanced");
    var fallback = root.querySelector(".bnb-fallback");
    var certificate = root.querySelector("[data-bnb-certificate]");
    var buttons = Array.from(root.querySelectorAll("[data-bnb-step]"));
    if (!data || !enhanced || !fallback || !certificate || !buttons.length) return;

    function numeric(value) {
      if (value === null) return null;
      if (String(value).indexOf("/") === -1) return Number(value);
      var bits = String(value).split("/");
      return Number(bits[0]) / Number(bits[1]);
    }

    function select(index) {
      var snapshot = data.snapshots[index];
      if (!snapshot) return;
      buttons.forEach(function (button) {
        button.setAttribute("aria-pressed", String(Number(button.dataset.bnbStep) === index));
      });
      var lower = numeric(snapshot.lower);
      var upper = numeric(snapshot.upper);
      var heading = lower === null ? "No incumbent yet" : snapshot.lower + " ≤ z* ≤ " + snapshot.upper;
      var caption = lower === null ? "Before an integer solution is found" : "Certified maximisation interval";
      var chartMinimum = data.scale_minimum;
      var chartMaximum = data.scale_maximum;
      var chartSpan = chartMaximum - chartMinimum;
      var width = lower === null ? 100 : Math.max(0, Math.min(100, (upper - lower) / chartSpan * 100));
      var left = lower === null ? 0 : Math.max(0, Math.min(100, (lower - chartMinimum) / chartSpan * 100));
      var boundDetails = Object.keys(snapshot.open_bounds).map(function (name) {
        return name + " ≤ " + snapshot.open_bounds[name];
      });
      var open = boundDetails.length ? "Open bounds: " + boundDetails.join(", ") : "No open nodes remain";
      certificate.innerHTML = "<small>" + caption + "</small><strong>" + heading
        + "</strong><div class=\"bnb-interval\" aria-hidden=\"true\"><i style=\"--bnb-left:"
        + left + "%;--bnb-width:" + width + "%\"></i></div><p>" + snapshot.event
        + "</p><span>" + open + " · raw LP upper bound U = " + snapshot.upper + "</span>";
    }

    buttons.forEach(function (button) {
      button.addEventListener("click", function () { select(Number(button.dataset.bnbStep)); });
    });
    // Keep the complete branch tree visible; the controls add a live
    // certificate timeline below it rather than replacing the illustration.
    enhanced.hidden = false;
    select(0);
  });
}());
