/* English version of the editor's "Guide" tab (Polish original: knowledge-guide.js).
 * Same section ids and structure; registered as ESNKnowledgeGuide.byLang.en. */
(function (global) {
  function F(s) { return s.replace(/§§§/g, "```"); }

  var SECTIONS = [
    { id: "start", title: "1. How it works", md: F(
      ":::summary In short\n" +
      "- **Content** is an article, a course lesson or a “cheat sheet” (a short reference).\n" +
      "- You write in **markdown** and insert ready-made **blocks** (buttons above the text field). A **live preview** is shown on the right.\n" +
      "- An **editor** saves a draft and sends it for review. An **administrator** approves (publishes) it or rejects it with a comment.\n" +
      "- Published content that you edit does not disappear: changes wait as a *pending version* and the public still sees the old version until approval.\n" +
      ":::\n\n" +
      "The content list in the panel has a search box (title, description, tags, author), filters for type, level and status, and sorting.\n\nStatuses: **Draft** (only you and the admin), **In review** (locked for the editor until a decision), **Rejected** (read the comment and fix it), **Published**.\n") },

    { id: "pierwsza", title: "2. Your first content, step by step", md: F(
      "1. **+ New content** → choose the *Type* (article / course lesson / cheat sheet) and the *Level*.\n" +
      "2. Enter the **Title**, a short **Description** (shown on the list) and up to 8 **tags**.\n" +
      "3. Choose the mode above the text field: **Simple (blocks)** – you add blocks from the list (frames, tables, steps, diagrams, code, widget), fill in the form fields and reorder with the arrows, and the markdown is generated for you; **Advanced** – you write markdown by hand and the buttons insert ready-made blocks. You can switch modes without losing content (your choice is remembered).\n" +
      "   In simple mode there is an **Insert template…** list next to the add buttons (e.g. “Lesson (template)”, “Step-by-step tutorial”). Into empty content the template goes in whole; into existing content it is appended at the end. Change the texts in the blocks and delete what you do not need. Templates live in `knowledge-templates.js` (the `ESNKnowledgeDocTemplates` object; English versions in `knowledge-templates-en.js`).\n" +
      "4. **Save** (creates a draft). Only after saving can you upload **images**.\n" +
      "5. Check the preview, also on a phone. Then **Submit for review**.\n" +
      "6. Course lesson: choose the *Course* and the *Position* (lesson order; courses are created by the administrator in the “Courses” tab).\n") },

    { id: "bloki", title: "3. Blocks – building an article from pieces", intro: F(
      "A block starts with a line `:::name Title` and ends with a lone `:::` line. Blocks **cannot be nested** (a block inside a block will not work). Everything outside blocks is plain markdown: `##` headings, lists, **bold**, `code`, tables, links.\n"),
      examples: [
        { title: "Summary (at the start of an article)", src: ":::summary Quick summary\n- An ADC turns voltage into a number\n- 12 bits means 4096 levels\n:::" },
        { title: "Notes: note / info / warn / danger / ok", src: ":::warn Warning\nESP32 GPIO34–39 are input-only.\n:::\n\n:::danger Critical\nDo not apply 5 V to a 3.3 V pin.\n:::\n\n:::ok Solution\nUse a voltage divider.\n:::" },
        { title: "Key – value (parameters)", src: ":::kv\nCPU | Xtensa LX6 · 240 MHz\nADC | 12-bit · 18 channels\nSupply | 3.3 V\n:::" },
        { title: "Statistics (number tiles)", src: ":::stats\nBaud | 115200 | bps | green\nBuffer | 64 | B | orange\nBits | 10 | per byte | accent\n:::\n\nColumns: label | value | unit | colour (green, orange, accent)." },
        { title: "Pros and cons", src: ":::pros PROS\n- simple\n- cheap\n:::\n\n:::cons CONS\n- slow\n:::" },
        { title: "Card", src: ":::card Card title\nCard content in **markdown**.\n:::" },
        { title: "Grey frame (neutral)", src: ":::neutral Additional information\nSomething secondary that is neither a warning nor a tip.\n:::" },
        { title: "Steps (Title | description)", src: ":::steps Uploading the program\nConnect the board | With a USB cable that carries data\nChoose the port | In the Tools → Port menu\nClick Upload | Wait for the completion message\n:::" },
        { title: "Timeline (Date | Title | description)", src: ":::timeline Microprocessor history\n1971 | Intel 4004 | The first microprocessor, 4 bits\n1978 | Intel 8086 | The x86 architecture\n1985 | ARM1 | The start of the ARM family\n:::" },
        { title: "Progress bar (Label | 0–100 | description | colour)", src: ":::progress\nRAM | 62 | 320 KB of 512 KB | orange\nFlash | 35 | 1.4 MB of 4 MB | green\nCPU | 90 | load too high | red\n:::" },
        { title: "Definitions (Term | description)", src: ":::def\nISR | Interrupt service routine – a short function called by hardware\nDMA | Moving data without involving the core\n:::" },
        { title: "Checklist", src: ":::checklist\n- [x] Voltages checked\n- [ ] Tested on a breadboard\n:::" },
        { title: "Collapsible section", src: ":::details Show the solution\nThe solution is here, visible after a click.\n:::" },
        { title: "Tabs (sections after “=== Title”)", src: ":::tabs\n=== Arduino\nThe first tab, **markdown** works.\n=== MicroPython\nThe second tab.\n:::" },
        { title: "Code with syntax highlighting", src: "§§§cpp Blinking an LED\nvoid setup() { pinMode(2, OUTPUT); }\nvoid loop() { digitalWrite(2, !digitalRead(2)); delay(500); }\n§§§\n\nLanguages: cpp, c, arduino, python, bash, yaml, json, ini, rust, js, html. A title can follow the language name." }
      ] },

    { id: "obrazy", title: "4. Images and graphics", intro: F(
      ":::note Three kinds of graphics\n" +
      "- **Raster image** (photo, screenshot): the **Images** section below the text field → choose a file → *Upload* → *Insert*. JPEG, PNG, WebP and GIF are allowed; the server strips metadata (e.g. GPS) and determines the file type itself.\n" +
      "- **Vector drawing** (schematic, diagram): a `:::figure Caption` block with `<svg>` code. No scripts and no external references.\n" +
      "- **Animation / interaction**: a widget (next section).\n" +
      ":::\n\n" +
      "An image placed alone in its own paragraph is shown as a **figure with a caption** – the caption is the alternative text: `![Caption and description](/static/media/…)`.\n\n" +
      ":::warn Rules\n" +
      "- Use **only images uploaded in the panel** (not links to other sites – this protects readers from tracking).\n" +
      "- Upload only **your own** photos and graphics, or ones under a free licence (give the author in the caption). Do not copy schematics from books and datasheets.\n" +
      "- Limits: up to 30 images per content item, a few MB per file (depending on server configuration), and an hourly upload limit.\n" +
      "- Deleting an image in the panel deletes the file – if it was inserted, a message appears in the content instead of the image.\n" +
      ":::\n\n" +
      "Below is an SVG drawing example – code and result:\n"),
      examples: [{ title: "SVG drawing", src: ":::figure Voltage divider\n<svg viewBox=\"0 0 200 80\" xmlns=\"http://www.w3.org/2000/svg\">\n  <rect x=\"20\" y=\"25\" width=\"60\" height=\"30\" rx=\"4\" fill=\"none\" stroke=\"#56e1fd\" stroke-width=\"2\"/>\n  <text x=\"50\" y=\"45\" text-anchor=\"middle\" fill=\"#e6edf3\" font-size=\"14\">R1</text>\n  <path d=\"M80 40 H150\" stroke=\"#3fb950\" stroke-width=\"2\"/>\n</svg>\n:::" }] },

    { id: "diagramy", title: "4a. Diagrams drawn by the platform", intro: F(
      "Instead of uploading an image you can describe a diagram in text – the platform draws it in the site's style (colours follow the theme, sharp on every screen, editable). Three kinds:\n\n" +
      "- **`:::flow`** – an algorithm. Nodes: `(id) Text` = start/end, `[id] Text` = step, `{id} Text` = decision. Arrows: `a -> b` or `a -> b : label`. An arrow to an earlier node makes a loop.\n" +
      "- **`:::er`** – a database. Table: `name: column PK, column FK, column`. Relation: `a 1--* b : label` (markers `1`, `0..1`, `*`, `0..*`, `1..*`).\n" +
      "- **`:::sequence`** – communication. The first line lists participants separated by commas, then `A -> B : message` (`-->` = dashed line, e.g. a reply).\n\n" +
      "Limits: 40 nodes/messages, 16 tables. A syntax error shows a readable message instead of the diagram. When you need something these blocks cannot do – upload an image or draw an SVG.\n"),
      examples: [
        { title: "Algorithm (flow)", src: ":::flow Sensor reading with validation\n(s) Start\n[a] Read the ADC\n{c} Value in range?\n[b] Store in the buffer\n(e) End\ns -> a\na -> c\nc -> b : yes\nc -> a : no\nb -> e\n:::" },
        { title: "Database (er)", src: ":::er ESN Platform\nusers: id PK, login, email\nprojects: id PK, owner_id FK, title\ncomponents: id PK, name, category\nproject_components: project_id FK, component_id FK\nusers 1--* projects : owns\nprojects 1--* project_components : contains\ncomponents 1--* project_components : used in\n:::" },
        { title: "Communication (sequence)", src: ":::sequence Frame with acknowledgement\nMCU, PC\nMCU -> PC : frame (SYNC, data, CRC)\nPC -> PC : check CRC\nPC --> MCU : ACK\n:::" }
      ] },

    { id: "widgety", title: "5. Widgets (your own animations and calculators)", intro: F(
      "A widget is a small, **self-contained** HTML + CSS + JS page displayed in an isolated frame. It has no access to the network, to the page or to your data (sandbox + CSP) – that is why scripts can safely run in it.\n\n" +
      "**How to add one:** the *Widgets* section → choose a **template** and enter a name (a–z, 0–9, -, _) → *Add widget*. The editor inserts a `:::widget name 320` block for you (the number = height in px; the widget still fits its content within 80–1200).\n\n" +
      "**Rules:** no external resources (no `<script src>`, CDN, or images from the internet – only `data:`), up to 8 widgets per content item, up to 60 KB each and 200 KB in total. Use `textContent` instead of `innerHTML` for user-supplied data.\n\n" +
      "The templates below work live – try them:\n"), templates: true,
      outro: F(
      "**A custom widget from Claude.** In a separate chat (with the ESN-Platform project attached) paste a description, e.g.:\n\n" +
      "§§§text Prompt\nWrite an ESN widget for an article about PWM: a single HTML file with <style> and <script>, no external resources and no fetch/XHR.\nDark theme (transparent background, text #e6edf3, accent #56e1fd), system font, works from 320 px wide.\nA duty-cycle slider 0–100%, a waveform chart in SVG, the average voltage result. Texts in English.\n§§§\n\n" +
      "Paste the resulting code into the widget in the editor (the code field) and check it in the live preview.\n") },

    { id: "kursy", title: "6. Courses and lessons", md: F(
      "- A course is created by the **administrator** (the *Courses* tab: title, description, level).\n" +
      "- A lesson is content of type *Course lesson* with a chosen course. The order is set by the **Position** field (smaller = earlier); “Previous/Next lesson” buttons are created automatically.\n" +
      "- A course appears publicly when it has at least one published lesson.\n" +
      "- A good lesson: a goal at the start (`:::summary`), one idea, an example, a mini quiz or a task at the end.\n") },

    { id: "lista", title: "7. Checklist before submitting", md: F(
      ":::ok Check\n" +
      "- The title is specific and the description is 1–2 sentences.\n" +
      "- Numbers, voltages and parameters are checked in the manufacturer's documentation (not from memory).\n" +
      "- Figures have captions; images are your own or under a free licence.\n" +
      "- Every widget works in the preview, also after setting extreme values.\n" +
      "- The look on a narrow screen (phone) is checked.\n" +
      "- No copyrighted material.\n" +
      ":::\n") },

    { id: "admin", title: "8. For the administrator", md: F(
      "- **For approval**: the list of content awaiting a decision. Open it, review the preview and widgets, then **Approve** (publishes) or **Reject** with a reason (the editor sees it in the editor).\n" +
      "- **Save and publish**: publishing your own content without the queue. **Unpublish**: hides the content publicly (it stays a draft).\n" +
      "- An editor can delete only their own unpublished content; an admin can delete any.\n" +
      "- The status change history is in the section below the editor.\n" +
      "- Technical details and security: the files `docs/WIEDZA.md` and `docs/BEZPIECZENSTWO.md` in the repository.\n") },

    { id: "faq", title: "9. Common problems", md: F(
      ":::kv\n" +
      "A block does not render | The closing `:::` is missing on its own line, or the block is inside another block (nesting does not work)\n" +
      "“Widget missing” | The name after `:::widget` differs from the name in the Widgets section\n" +
      "An image shows a message instead of the photo | The link does not point to a file uploaded in the panel – upload the image and use *Insert*\n" +
      "I cannot upload an image | Click *Save* first (the content must exist); check the format and the hourly limit\n" +
      "I cannot edit | The content is *In review* – wait for the administrator's decision\n" +
      "The widget is cut off | Give a larger height in `:::widget name 480`\n" +
      ":::\n") }
  ];

  var G = global.ESNKnowledgeGuide;
  if (G) { G.byLang = G.byLang || {}; G.byLang.en = SECTIONS; }
})(window);
