(function(){
  "use strict";

  /* ---------------------------------------------------------
     STATE
  --------------------------------------------------------- */
  let expr = "";              // current expression text being built
  let lastResultShown = "0";  // big number currently displayed
  let justEvaluated = false;  // true right after pressing "="
  let memory = parseFloat(localStorage.getItem("calc_memory") || "0");
  let angleMode = "deg";      // deg | rad
  let history = JSON.parse(localStorage.getItem("calc_history") || "[]");

  const exprLine = document.getElementById("exprLine");
  const resultLine = document.getElementById("resultLine");
  const extraPanel = document.getElementById("extraPanel");
  const panelTitle = document.getElementById("panelTitle");

  const navMap = {
    menu:       { section: "section-menu",       title: "Menu" },
    history:    { section: "section-history",    title: "History" },
    converter:  { section: "section-converter",  title: "Converter" },
    scientific: { section: "section-scientific", title: "Scientific" },
    settings:   { section: "section-settings",   title: "Settings" },
    theme:      { section: "section-theme",       title: "Appearance" }
  };
  let activeNav = null;

  /* ---------------------------------------------------------
     THEME (Classic White / Classic Black)
  --------------------------------------------------------- */
  const themeCards = document.querySelectorAll("[data-theme-option]");

  function applyTheme(value, persist){
    const t = value === "dark" ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", t);
    if(persist !== false) localStorage.setItem("calc_theme", t);
    themeCards.forEach(card => {
      card.classList.toggle("active", card.dataset.themeOption === t);
    });
  }

  themeCards.forEach(card => {
    card.addEventListener("click", () => applyTheme(card.dataset.themeOption));
  });

  document.getElementById("settingsThemeGoto").addEventListener("click", () => openPanel("theme"));

  /* ---------------------------------------------------------
     DISPLAY FORMATTING
  --------------------------------------------------------- */
  function formatNumber(n){
    if(!isFinite(n)) return "Error";
    const rounded = Math.round((n + Number.EPSILON) * 1e10) / 1e10;
    if(Math.abs(rounded) >= 1e15 || (Math.abs(rounded) < 1e-9 && rounded !== 0)){
      return rounded.toExponential(6);
    }
    const parts = rounded.toString().split(".");
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return parts.join(".");
  }

  function setResultText(text){
    resultLine.textContent = text;
    resultLine.classList.toggle("small", text.replace(/,/g, "").length > 10);
  }

  function updateMemoryTag(){
    const tag = document.getElementById("memTag");
    if(!tag) return;
    tag.hidden = memory === 0;
  }

  function updateDisplay(previewOnly){
    const memTag = memory !== 0 ? '<span class="mem-tag" id="memTag">M</span>' : "";
    if(expr.length){
      exprLine.innerHTML = memTag + expr;
    } else {
      exprLine.innerHTML = memTag + "\u00A0";
    }
    if(expr.length === 0){
      setResultText(justEvaluated ? lastResultShown : "0");
      return;
    }
    if(previewOnly){
      try{
        const val = evaluateExpression(expr);
        if(typeof val === "number" && isFinite(val)){
          setResultText(formatNumber(val));
        }
      }catch(e){ /* leave as-is while typing an incomplete expression */ }
    }
  }

  /* ---------------------------------------------------------
     SAFE EVALUATION ENGINE
  --------------------------------------------------------- */
  function evaluateExpression(rawExpr){
    let e = rawExpr
      .replace(/×/g, "*")
      .replace(/÷/g, "/")
      .replace(/−/g, "-")
      .replace(/π/g, "Math.PI")
      .replace(/\be\b/g, "Math.E")
      .replace(/sin\(/g, "sinD(")
      .replace(/cos\(/g, "cosD(")
      .replace(/tan\(/g, "tanD(")
      .replace(/log\(/g, "log10(")
      .replace(/ln\(/g, "Math.log(")
      .replace(/sqrt\(/g, "Math.sqrt(")
      .replace(/abs\(/g, "Math.abs(");

    const safePattern = /^[0-9+\-*/().\s%,MathPIElogsqrtinDabvcgn]*$/;
    if(!safePattern.test(e)){
      throw new Error("Invalid expression");
    }

    const sinD = d => angleMode === "deg" ? Math.sin(d * Math.PI / 180) : Math.sin(d);
    const cosD = d => angleMode === "deg" ? Math.cos(d * Math.PI / 180) : Math.cos(d);
    const tanD = d => angleMode === "deg" ? Math.tan(d * Math.PI / 180) : Math.tan(d);
    const log10 = v => Math.log10(v);

    e = e.replace(/[+\-*/.]+$/, m => m.replace(/[+\-*/.]$/, ""));

    if(e.trim() === "") throw new Error("empty");

    // eslint-disable-next-line no-new-func
    const fn = new Function("sinD","cosD","tanD","log10", `"use strict"; return (${e});`);
    const result = fn(sinD, cosD, tanD, log10);
    if(typeof result !== "number" || isNaN(result)) throw new Error("Invalid result");
    return result;
  }

  /* ---------------------------------------------------------
     HISTORY
  --------------------------------------------------------- */
  const historyList = document.getElementById("historyList");

  function saveHistory(){
    localStorage.setItem("calc_history", JSON.stringify(history));
  }

  function renderHistory(){
    historyList.innerHTML = "";
    if(history.length === 0){
      historyList.innerHTML = '<div class="history-empty">No calculations yet</div>';
      return;
    }
    history.slice().reverse().forEach(item => {
      const row = document.createElement("div");
      row.className = "history-item";
      const exprSpan = document.createElement("span");
      exprSpan.className = "h-expr";
      exprSpan.textContent = item.expr;
      const resultSpan = document.createElement("span");
      resultSpan.className = "h-result";
      resultSpan.textContent = item.result;
      row.appendChild(exprSpan);
      row.appendChild(resultSpan);
      row.addEventListener("click", () => {
        expr = item.expr;
        justEvaluated = false;
        openPanel("history");
        updateDisplay(true);
      });
      historyList.appendChild(row);
    });
  }

  function pushHistory(exprText, resultText){
    history.push({ expr: exprText, result: resultText });
    if(history.length > 100) history.shift();
    saveHistory();
    renderHistory();
  }

  document.getElementById("clearHistory").addEventListener("click", () => {
    history = [];
    saveHistory();
    renderHistory();
  });

  /* ---------------------------------------------------------
     BASIC CALCULATOR INTERACTIONS
  --------------------------------------------------------- */
  function appendToExpr(text){
    if(justEvaluated){
      const isOperator = /^[+\-−×÷]$/.test(text);
      expr = isOperator ? lastResultShown.replace(/,/g, "") + text : text;
      justEvaluated = false;
    } else {
      expr += text;
    }
    updateDisplay(true);
  }

  document.querySelectorAll("[data-num]").forEach(btn => {
    btn.addEventListener("click", () => appendToExpr(btn.dataset.num));
  });

  document.querySelectorAll("[data-op]").forEach(btn => {
    btn.addEventListener("click", () => appendToExpr(btn.dataset.op));
  });

  document.querySelectorAll("[data-action]").forEach(btn => {
    btn.addEventListener("click", () => {
      const action = btn.dataset.action;
      if(action === "clear"){
        expr = ""; justEvaluated = false; lastResultShown = "0";
        updateDisplay(false);
      } else if(action === "ce"){
        expr = ""; updateDisplay(true);
      } else if(action === "back"){
        if(justEvaluated){ expr = ""; justEvaluated = false; }
        else expr = expr.slice(0, -1);
        updateDisplay(true);
      } else if(action === "sign"){
        try{
          const match = expr.match(/(-?\d+\.?\d*)$/);
          if(match){
            const num = match[1];
            const negated = num.startsWith("-") ? num.slice(1) : "-" + num;
            expr = expr.slice(0, expr.length - num.length) + negated;
          } else if(expr === "" ){
            expr = "-";
          }
          updateDisplay(true);
        }catch(e){}
      } else if(action === "percent"){
        try{
          const val = evaluateExpression(expr || "0");
          expr = (val / 100).toString();
          updateDisplay(true);
        }catch(e){}
      } else if(action === "equals"){
        doEquals();
      }
    });
  });

  function doEquals(){
    if(expr.trim() === "") return;
    try{
      const val = evaluateExpression(expr);
      const formatted = formatNumber(val);
      pushHistory(expr, formatted);
      lastResultShown = formatted;
      const memTag = memory !== 0 ? '<span class="mem-tag" id="memTag">M</span>' : "";
      exprLine.innerHTML = memTag + expr;
      setResultText(formatted);
      expr = "";
      justEvaluated = true;
    }catch(e){
      setResultText("Error");
    }
  }

  /* ---------------------------------------------------------
     MEMORY
  --------------------------------------------------------- */
  function currentValue(){
    try{
      if(expr.trim() !== "") return evaluateExpression(expr);
      return parseFloat(lastResultShown.replace(/,/g, "")) || 0;
    }catch(e){ return 0; }
  }

  document.querySelectorAll("[data-mem]").forEach(btn => {
    btn.addEventListener("click", () => {
      const action = btn.dataset.mem;
      if(action === "MC"){ memory = 0; }
      else if(action === "MR"){ appendToExpr(formatNumber(memory).replace(/,/g, "")); }
      else if(action === "M+"){ memory += currentValue(); }
      else if(action === "M-"){ memory -= currentValue(); }
      else if(action === "MS"){ memory = currentValue(); }
      localStorage.setItem("calc_memory", memory);
      updateMemoryTag();
      updateDisplay(true);
    });
  });

  /* ---------------------------------------------------------
     SCIENTIFIC FUNCTIONS
  --------------------------------------------------------- */
  function wrapTrailingNumber(prefix, suffix){
    const match = expr.match(/(\d+\.?\d*)$/);
    if(match){
      const num = match[1];
      expr = expr.slice(0, expr.length - num.length) + prefix + num + suffix;
    } else {
      expr += prefix;
    }
  }

  document.querySelectorAll("[data-fn]").forEach(btn => {
    btn.addEventListener("click", () => {
      const fn = btn.dataset.fn;
      if(justEvaluated && ["sin","cos","tan","log","ln","sqrt","sq","cube","inv","abs"].includes(fn)){
        expr = lastResultShown.replace(/,/g, "");
        justEvaluated = false;
      } else if(justEvaluated){
        justEvaluated = false;
      }

      switch(fn){
        case "sin": wrapTrailingNumber("sin(", ")"); break;
        case "cos": wrapTrailingNumber("cos(", ")"); break;
        case "tan": wrapTrailingNumber("tan(", ")"); break;
        case "log": wrapTrailingNumber("log(", ")"); break;
        case "ln": wrapTrailingNumber("ln(", ")"); break;
        case "sqrt": wrapTrailingNumber("sqrt(", ")"); break;
        case "abs": wrapTrailingNumber("abs(", ")"); break;
        case "inv": wrapTrailingNumber("(1/(", "))"); break;
        case "sq": expr += "**2"; break;
        case "cube": expr += "**3"; break;
        case "pow": expr += "**"; break;
        case "pi": expr += "π"; break;
        case "e": expr += "e"; break;
        case "open": expr += "("; break;
        case "close": expr += ")"; break;
      }
      updateDisplay(true);
    });
  });

  function setAngleMode(mode){
    angleMode = mode;
    localStorage.setItem("calc_angle_mode", mode);
    ["modeDeg", "settingsDeg"].forEach(id => {
      document.getElementById(id)?.classList.toggle("active", mode === "deg");
    });
    ["modeRad", "settingsRad"].forEach(id => {
      document.getElementById(id)?.classList.toggle("active", mode === "rad");
    });
    if(expr.length) updateDisplay(true);
  }

  document.getElementById("modeDeg").addEventListener("click", () => setAngleMode("deg"));
  document.getElementById("modeRad").addEventListener("click", () => setAngleMode("rad"));
  document.getElementById("settingsDeg").addEventListener("click", () => setAngleMode("deg"));
  document.getElementById("settingsRad").addEventListener("click", () => setAngleMode("rad"));

  /* ---------------------------------------------------------
     NAV ROW
  --------------------------------------------------------- */
  function showSection(nav){
    const cfg = navMap[nav];
    if(!cfg) return;
    document.querySelectorAll(".section").forEach(s => s.classList.remove("visible"));
    document.getElementById(cfg.section)?.classList.add("visible");
    panelTitle.textContent = cfg.title;
  }

  function setNavActive(nav){
    document.querySelectorAll(".nav-btn").forEach(b => {
      b.classList.toggle("active", b.dataset.nav === nav);
    });
    activeNav = nav;
  }

  function openPanel(nav){
    showSection(nav);
    setNavActive(nav);
    extraPanel.classList.add("visible");
  }

  function closePanel(){
    extraPanel.classList.remove("visible");
    document.querySelectorAll(".nav-btn").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".section").forEach(s => s.classList.remove("visible"));
    activeNav = null;
  }

  function togglePanel(nav){
    if(activeNav === nav && extraPanel.classList.contains("visible")){
      closePanel();
    } else {
      openPanel(nav);
    }
  }

  document.querySelectorAll(".nav-btn").forEach(btn => {
    btn.addEventListener("click", () => togglePanel(btn.dataset.nav));
  });

  document.querySelectorAll("[data-goto]").forEach(btn => {
    btn.addEventListener("click", () => openPanel(btn.dataset.goto));
  });

  /* ---------------------------------------------------------
     SETTINGS ACTIONS
  --------------------------------------------------------- */
  document.getElementById("clearMemory").addEventListener("click", () => {
    memory = 0;
    localStorage.setItem("calc_memory", "0");
    updateMemoryTag();
    updateDisplay(true);
  });

  document.getElementById("clearHistorySettings").addEventListener("click", () => {
    history = [];
    saveHistory();
    renderHistory();
  });

  document.getElementById("resetCalc").addEventListener("click", () => {
    expr = "";
    lastResultShown = "0";
    justEvaluated = false;
    memory = 0;
    history = [];
    localStorage.setItem("calc_memory", "0");
    saveHistory();
    renderHistory();
    updateMemoryTag();
    updateDisplay(false);
  });

  /* ---------------------------------------------------------
     CONVERTER
  --------------------------------------------------------- */
  const unitData = {
    Length: {
      base: "meter (m)",
      units: {
        "meter (m)": 1,
        "kilometer (km)": 1000,
        "centimeter (cm)": 0.01,
        "millimeter (mm)": 0.001,
        "mile (mi)": 1609.34,
        "yard (yd)": 0.9144,
        "foot (ft)": 0.3048,
        "inch (in)": 0.0254
      }
    },
    Weight: {
      base: "kilogram (kg)",
      units: {
        "kilogram (kg)": 1,
        "gram (g)": 0.001,
        "milligram (mg)": 0.000001,
        "pound (lb)": 0.453592,
        "ounce (oz)": 0.0283495,
        "tonne (t)": 1000
      }
    },
    Volume: {
      base: "liter (L)",
      units: {
        "liter (L)": 1,
        "milliliter (mL)": 0.001,
        "gallon (gal)": 3.78541,
        "quart (qt)": 0.946353,
        "pint (pt)": 0.473176,
        "cup": 0.24
      }
    },
    Area: {
      base: "square meter (m²)",
      units: {
        "square meter (m²)": 1,
        "square kilometer (km²)": 1e6,
        "square foot (ft²)": 0.092903,
        "acre": 4046.86,
        "hectare (ha)": 10000
      }
    },
    Temperature: {
      base: "celsius (°C)",
      units: { "celsius (°C)": 1, "fahrenheit (°F)": 1, "kelvin (K)": 1 }
    }
  };

  const convCategory = document.getElementById("convCategory");
  const convFromUnit = document.getElementById("convFromUnit");
  const convToUnit = document.getElementById("convToUnit");
  const convFromValue = document.getElementById("convFromValue");
  const convToValue = document.getElementById("convToValue");

  Object.keys(unitData).forEach(cat => {
    const opt = document.createElement("option");
    opt.value = cat; opt.textContent = cat;
    convCategory.appendChild(opt);
  });

  function populateUnitSelects(){
    const cat = convCategory.value;
    const units = Object.keys(unitData[cat].units);
    convFromUnit.innerHTML = "";
    convToUnit.innerHTML = "";
    units.forEach(u => {
      const o1 = document.createElement("option"); o1.value = u; o1.textContent = u;
      const o2 = document.createElement("option"); o2.value = u; o2.textContent = u;
      convFromUnit.appendChild(o1);
      convToUnit.appendChild(o2);
    });
    convFromUnit.value = units[0];
    convToUnit.value = units[1] || units[0];
    runConversion();
  }

  function convertTemperature(value, from, to){
    let celsius;
    if(from.startsWith("celsius")) celsius = value;
    else if(from.startsWith("fahrenheit")) celsius = (value - 32) * 5/9;
    else celsius = value - 273.15;

    if(to.startsWith("celsius")) return celsius;
    if(to.startsWith("fahrenheit")) return celsius * 9/5 + 32;
    return celsius + 273.15;
  }

  function runConversion(){
    const cat = convCategory.value;
    const from = convFromUnit.value;
    const to = convToUnit.value;
    const value = parseFloat(convFromValue.value);
    if(isNaN(value)){ convToValue.value = ""; return; }

    let result;
    if(cat === "Temperature"){
      result = convertTemperature(value, from, to);
    } else {
      const data = unitData[cat].units;
      result = value * data[from] / data[to];
    }
    convToValue.value = formatNumber(result);
  }

  convCategory.addEventListener("change", populateUnitSelects);
  convFromUnit.addEventListener("change", runConversion);
  convToUnit.addEventListener("change", runConversion);
  convFromValue.addEventListener("input", runConversion);
  document.getElementById("convSwap").addEventListener("click", () => {
    const tmpUnit = convFromUnit.value;
    convFromUnit.value = convToUnit.value;
    convToUnit.value = tmpUnit;
    convFromValue.value = convToValue.value.replace(/,/g, "") || convFromValue.value;
    runConversion();
  });

  populateUnitSelects();

  /* ---------------------------------------------------------
     KEYBOARD SUPPORT
  --------------------------------------------------------- */
  window.addEventListener("keydown", (ev) => {
    const tag = ev.target.tagName;
    if(tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;

    const key = ev.key;
    if(/^[0-9]$/.test(key)){ appendToExpr(key); return; }
    if(key === "."){ appendToExpr("."); return; }
    if(key === "+"){ appendToExpr("+"); return; }
    if(key === "-"){ appendToExpr("−"); return; }
    if(key === "*"){ appendToExpr("×"); return; }
    if(key === "/"){ ev.preventDefault(); appendToExpr("÷"); return; }
    if(key === "("){ appendToExpr("("); return; }
    if(key === ")"){ appendToExpr(")"); return; }
    if(key === "%"){ document.querySelector('[data-action="percent"]')?.click(); return; }
    if(key === "Enter" || key === "="){ ev.preventDefault(); doEquals(); return; }
    if(key === "Backspace"){ document.querySelector('[data-action="back"]')?.click(); return; }
    if(key === "Escape"){ document.querySelector('[data-action="clear"]')?.click(); return; }
  });

  /* ---------------------------------------------------------
     INIT
  --------------------------------------------------------- */
  angleMode = localStorage.getItem("calc_angle_mode") || "deg";
  setAngleMode(angleMode);
  applyTheme(localStorage.getItem("calc_theme") || "light", false);
  updateMemoryTag();
  renderHistory();
  updateDisplay(false);
})();