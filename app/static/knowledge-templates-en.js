/* English versions of the editor templates (widgets + content templates).
 * Polish originals live in knowledge-templates.js; this file only overrides texts, by template id.
 * ESNKnowledgeL10n.widgets() / .docs() return the list/object for the current UI language (Polish = originals).
 * New language: add a block to W / DOCS with the same ids. */
(function (global) {
  function L() { return [].slice.call(arguments).join("\n"); }
  var F = "```";

  // widgets: name, desc and [polish text in the code → translation] pairs (every pair must occur in the code – checked by tests)
  var W = { en: {
    pusty: { name: "Empty", desc: "HTML + CSS + JS skeleton", rep: [["Tytuł widgetu", "Widget title"], [">Kliknij<", ">Click<"], ["Kliknięto ' + n + ' razy", "Clicked ' + n + ' times"]] },
    dzielnik: { name: "Voltage divider", desc: "Vout from R1, R2, Vin", rep: [["Prąd: ", "Current: "]] },
    uart: { name: "UART frame animation", desc: "8N1 bits step by step", rep: [["Bajt (0–255)", "Byte (0–255)"], ["Wyślij ▶", "Send ▶"], ["Przebieg UART", "UART waveform"], ["Wybierz bajt i kliknij Wyślij.", "Pick a byte and click Send."], ["(bajt '", "(byte '"], ["LSB pierwszy", "LSB first"]] },
    quiz: { name: "Quiz", desc: "question with answers and a score", rep: [
      ["Wybierz odpowiedź.", "Choose an answer."],
      ["// Edytuj tylko tablicę Q: pytanie, odpowiedzi, indeks poprawnej (od 0), wyjaśnienie", "// Edit only the Q array: question, answers, index of the correct one (from 0), explanation"],
      ["Ile bitów ma rozdzielczość 12-bitowego ADC w liczbie poziomów?", "How many levels does a 12-bit ADC resolve?"],
      ["2^12 = 4096 poziomów (0–4095).", "2^12 = 4096 levels (0–4095)."],
      ["Który pin ESP32 jest bezpieczny jako wejście ADC1?", "Which ESP32 pin is a safe ADC1 input?"],
      ["GPIO34 to wejście tylko do odczytu, ADC1 – działa przy Wi-Fi.", "GPIO34 is an input-only pin on ADC1 – it works while Wi-Fi is on."],
      ["Wynik: ", "Score: "], ["Dobrze! ", "Correct! "], ["Niestety. ", "Wrong. "], ["Dalej →", "Next →"]] },
    zakladki: { name: "Code tabs", desc: "the same example in several languages", rep: [] },
    pwm: { name: "PWM duty cycle", desc: "waveform and average voltage", rep: [["Wypełnienie: ", "Duty cycle: "], ["Napięcie logiczne [V]", "Logic voltage [V]"], ["Przebieg PWM", "PWM waveform"], ["Napięcie średnie ≈", "Average voltage ≈"]] }
  } };

  var DOCS = { en: {
    project: {
      dokumentacja: { name: "Project documentation", desc: "goal, parameters, parts list, status", body: L(
        ":::summary About the project in brief",
        "- What it is and what it is for (one sentence).",
        "- Who it helps / in which situation it is useful.",
        "- Status: prototype / working / under construction.",
        ":::", "",
        "## Goal and requirements", "",
        "Describe the problem the project solves and its requirements (power, size, cost, range…).", "",
        ":::kv",
        "Microcontroller | e.g. ESP32-WROOM-32",
        "Power | e.g. 5 V from USB",
        "Communication | e.g. Wi-Fi, UART",
        "Run time | e.g. 8 h on battery",
        ":::", "",
        "## How it works", "",
        ":::flow Data flow",
        "(s) Start",
        "[a] Read the sensor",
        "[b] Process",
        "[c] Send the result",
        "s -> a", "a -> b", "b -> c",
        ":::", "",
        "## Parts used", "",
        ":::def",
        "Sensor | e.g. DS18B20 – temperature, 1-Wire bus",
        "Module | e.g. ESP32 DevKit – board with Wi-Fi",
        ":::", "",
        "## Code", "",
        F + "cpp Program fragment",
        "void setup() {", "  // configuration", "}", "", "void loop() {", "  // main work", "}",
        F, "",
        ":::note Conclusions and next ideas",
        "What worked, what to improve, what to add in the next version.",
        ":::") },
      instrukcja: { name: "Build guide", desc: "checklist, steps, notes", body: L(
        ":::summary What you will build",
        "One or two sentences about the result and the time it takes.",
        ":::", "",
        "## Before you start", "",
        ":::checklist",
        "- [ ] Part 1 (quantity)",
        "- [ ] Part 2 (quantity)",
        "- [ ] Tools: soldering iron, multimeter",
        ":::", "",
        ":::warn Safety",
        "List the hazards: high voltage, hot soldering iron, Li-Ion batteries.",
        ":::", "",
        "## Assembly", "",
        ":::steps Next steps",
        "Prepare the parts | Check that you have everything from the list",
        "Connect the circuit | Follow the schematic: power first, then signals",
        "Upload the program | Choose the board and port, click Upload",
        "Test | Check the voltages and that it works",
        ":::", "",
        "## Connections", "",
        ":::kv",
        "Sensor OUT | GPIO 34",
        "LED | GPIO 2 through a 330 Ω resistor",
        ":::", "",
        ":::details Common problems",
        "- Upload fails: check the USB cable (it must carry data) and the selected port.",
        "- Odd readings: check the common ground.",
        ":::") },
      dziennik: { name: "Work log", desc: "timeline of progress and measurements", body: L(
        ":::summary Status today",
        "In short: what already works and what is next.",
        ":::", "",
        ":::progress",
        "Hardware | 60 | prototype on a breadboard | green",
        "Software | 40 | reading works, no sending yet | orange",
        "Documentation | 20 | draft | accent",
        ":::", "",
        ":::timeline Log",
        "2026-01-05 | Idea | Choosing parts and requirements",
        "2026-01-12 | First prototype | Sensor reading works",
        "2026-01-20 | Problem | Supply noise – capacitor added",
        ":::", "",
        ":::pros WHAT WORKS",
        "- sensor reading",
        ":::", "",
        ":::cons TO IMPROVE",
        "- no enclosure",
        ":::") },
      krotki: { name: "Short description", desc: "summary + parameters", body: L(
        ":::summary Description",
        "- What the project does.",
        "- Its most important feature.",
        ":::", "",
        ":::stats",
        "Parts | 5 | pcs | accent",
        "Cost | 10 | USD | green",
        ":::") }
    },
    article: {
      lekcja: { name: "Lesson (template)", desc: "summary, explanation, example, quiz", body: L(
        ":::summary Quick summary",
        "- The most important idea of the lesson.",
        "- The second key point.",
        "- What you will learn.",
        ":::", "",
        "## The idea", "",
        "Explain the topic in plain language: first “why”, then “how”.", "",
        ":::def",
        "Term | Definition in one sentence",
        ":::", "",
        "## How it works", "",
        ":::flow How it works",
        "(s) Start", "[a] First step", "{b} Condition?", "[c] Second step", "(e) End",
        "s -> a", "a -> b", "b -> c : yes", "b -> a : no", "c -> e",
        ":::", "",
        "## Example", "",
        ":::tabs",
        "=== Arduino",
        F + "cpp Example",
        "void setup() {}", "void loop() {}",
        F,
        "=== MicroPython",
        F + "python Example",
        "print('hello')",
        F,
        ":::", "",
        ":::warn Typical mistake",
        "Describe the trap beginners fall into.",
        ":::", "",
        ":::checklist",
        "- [ ] What to check before applying it",
        ":::", "",
        ":::neutral Quiz (optional)",
        "Add a widget from the “Quiz” template in the Widgets section and insert it with a widget block.",
        ":::") },
      porownanie: { name: "Comparison of options", desc: "table, pros and cons, choice", body: L(
        ":::summary Which to choose",
        "- Option A: when.",
        "- Option B: when.",
        ":::", "",
        "| Feature | A | B |", "|---|---|---|", "| Cost | low | medium |", "| Complexity | low | high |", "",
        ":::pros A: PROS", "- simplicity", ":::", "",
        ":::cons A: CONS", "- limitations", ":::", "",
        ":::note Recommendation", "Beginners should start with A and move to B when A runs out of capability.", ":::") },
      poradnik: { name: "Step-by-step tutorial", desc: "requirements, steps, troubleshooting", body: L(
        ":::summary Goal of the tutorial", "What will work at the end.", ":::", "",
        ":::checklist", "- [ ] Required part", "- [ ] Required software", ":::", "",
        ":::steps Procedure", "First step | description", "Second step | description", "Third step | description", ":::", "",
        ":::details Troubleshooting", "- Symptom → cause → solution", ":::") }
    }
  } };

  function lang() { return (global.ESNI18n && global.ESNI18n.lang()) || "pl"; }
  function widgets() {
    var base = global.ESNKnowledgeTemplates || [], w = W[lang()];
    if (!w) return base;
    return base.map(function (t) {
      var o = w[t.id]; if (!o) return t;
      var code = t.code;
      (o.rep || []).forEach(function (p) { code = code.split(p[0]).join(p[1]); });
      return Object.assign({}, t, { name: o.name, desc: o.desc, code: code });
    });
  }
  function docs() {
    var base = global.ESNKnowledgeDocTemplates || {}, d = DOCS[lang()];
    if (!d) return base;
    var out = {};
    Object.keys(base).forEach(function (kind) {
      out[kind] = base[kind].map(function (t) { var o = (d[kind] || {})[t.id]; return o ? Object.assign({}, t, o) : t; });
    });
    return out;
  }
  global.ESNKnowledgeL10n = { widgets: widgets, docs: docs, _W: W, _DOCS: DOCS };
})(window);
