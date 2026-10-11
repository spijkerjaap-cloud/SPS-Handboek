(() => {
  "use strict";

  const canvas = document.getElementById("worldCanvas");
  const ctx = canvas.getContext("2d");
  const rail = [...document.querySelectorAll(".rail a")];
  const panels = [...document.querySelectorAll("[data-scene]")];
  const chapterGrid = document.getElementById("chapterGrid");
  const libraryCount = document.getElementById("libraryCount");
  const fullHandbook = document.getElementById("fullHandbook");
  const fullHandbookSearch = document.getElementById("fullHandbookSearch");
  const fullHandbookCount = document.getElementById("fullHandbookCount");
  const expandFullHandbook = document.getElementById("expandFullHandbook");
  const collapseFullHandbook = document.getElementById("collapseFullHandbook");
  const searchInput = document.getElementById("searchInput");
  const chapterSelect = document.getElementById("chapterSelect");
  const clearSearch = document.getElementById("clearSearch");
  const searchStatus = document.getElementById("searchStatus");
  const chapterJump = document.getElementById("chapterJump");
  const results = document.getElementById("results");
  const dialog = document.getElementById("detailDialog");
  const detailContext = document.getElementById("detailContext");
  const detailTitle = document.getElementById("detailTitle");
  const detailVisual = document.getElementById("detailVisual");
  const detailBody = document.getElementById("detailBody");
  const closeDialog = document.getElementById("closeDialog");

  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const palette = ["#5f8c78", "#4c9aa0", "#5f7fa8", "#b06f69", "#c7994d", "#fff9ef"];
  const islands = [
    { x: .68, y: .54, r: 155, color: "#d5c4a6" },
    { x: .29, y: .42, r: 92, color: "#c9d8d3" },
    { x: .51, y: .27, r: 76, color: "#c7994d" },
    { x: .78, y: .27, r: 72, color: "#b06f69" },
    { x: .21, y: .68, r: 80, color: "#5f7fa8" },
    { x: .48, y: .74, r: 88, color: "#4c9aa0" }
  ];

  let width = 0;
  let height = 0;
  let dpr = 1;
  let scroll = 0;
  let smoothScroll = 0;
  let pointerX = 0;
  let pointerY = 0;
  let libraryFilter = "all";
  let searchFilter = "all";
  let chapterFilter = "all";
  let fullQuery = "";

  function esc(value) {
    return String(value ?? "").replace(/[&<>"']/g, ch => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "\"": "&quot;",
      "'": "&#039;"
    })[ch]);
  }

  function norm(value) {
    return String(value || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/₂/g, "2");
  }

  function cleanSourceText(value) {
    return String(value || "")
      .replace(/!\s*Afbeelding met tekst[\s\S]*?\}/gi, "")
      .replace(/!\s*Afbeelding met tekst[\s\S]*?\{width="[^"]*"\s+height="[^"]*"\}/gi, "")
      .replace(/!\s*Afbeelding met tekst[^\n]*/gi, "")
      .replace(/(?:Door AI\s+)?gegenereerde inhoud is mogelijk onjuist\.?/gi, "")
      .replace(/\{width="[^"]*"\s+height="[^"]*"\}/gi, "")
      .replace(/^\s*[+|=-]{3,}.*$/gm, "")
      .replace(/(^|\n)\s*>\s*/g, "$1")
      .replace(/\s+>\s+/g, " ")
      .replace(/(^|\s)\*{1,3}([^*\n]+?)\*{1,3}(?=\s|$|[.,;:!?])/g, "$1$2")
      .replace(/(^|\n)\s*\*+\s*/g, "$1")
      .replace(/\*/g, "")
      .replace(/\s{2,}/g, " ")
      .trim();
  }

  function visualKind(item) {
    const title = String(item.title || "").toLowerCase();
    const context = String(item.context || "").toLowerCase();
    const text = `${context} ${title} ${item.cleanBody}`.toLowerCase();
    if (item.isMainTopic) {
      if (/opleiding|portfolio/.test(`${context} ${title}`)) return "portfolio";
      if (/organisatie|organogram/.test(title)) return "organization";
      if (/algemeen|patiënten categorieën/.test(title)) return "screening";
      if (/bijlagen/.test(title)) return "complication";
      if (/protocollen/.test(title)) return "specialty";
      return "overview";
    }
    if (/organogram/.test(title)) return "organization";
    if (/portfolio/.test(`${context} ${title}`) || /\bepa\b|\bkpe\b|\bcbd\b|reflectieverslag|360 graden feedback|case based/.test(text)) return "portfolio";
    if (/complic|ponv|hypox|reanim|workflow|instabil|spoed|emergency/.test(text)) return "complication";
    if (/bewaking|monitor|registratie|ontslag|post-sedatie|observatie|saturatie|ademhaling/.test(text)) return "monitor";
    if (/propofol|alfentanil|sedatie|analget|hypnot|medicatie|dosering|procedurele/.test(text)) return "sedation";
    if (/luchtweg|airway|asa|screening|anamnese|pre-oper|voorbereiding|obesitas|tracheostomie/.test(text)) return "screening";
    if (/protocollen|mdl|radiologie|longgeneeskunde|cardiologie|pijngeneeskunde|fertiliteit|gynaecologie|kno|neurochirurgie|diverse specialismen/.test(`${context} ${title}`)) return "specialty";
    if (/mdl|ercp|eus|coloscopie|cardio|broncho|radiologie|gynaec|fertiliteit|kno|pijn|neuro/.test(text)) return "specialty";
    return "overview";
  }

  function visualModel(kind) {
    const models = {
      screening: {
        title: "Screeningbesluit",
        text: "Patiënt, ingreep, ASA, luchtweg en supervisor vormen samen het startbesluit.",
        labels: ["ASA", "luchtweg", "overleg"],
        icon: `<span class="v-clipboard"></span><span class="v-airway"></span><span class="v-check one"></span><span class="v-check two"></span>`
      },
      sedation: {
        title: "Sedatiecyclus",
        text: "Plan maken, medicatie titreren, effect beoordelen en opnieuw bijsturen.",
        labels: ["plan", "titreren", "observeren"],
        icon: `<span class="v-syringe"></span><span class="v-drop one"></span><span class="v-drop two"></span><span class="v-wave"></span>`
      },
      monitor: {
        title: "Bewakingslus",
        text: "Monitorwaarden, klinische indruk, overdracht en ontslagcriteria blijven verbonden.",
        labels: ["SpO2", "kliniek", "ontslag"],
        icon: `<span class="v-screen"><i></i></span><span class="v-clock"></span><span class="v-oxygen">O2</span>`
      },
      complication: {
        title: "Opschaalroute",
        text: "Vroege signalen koppelen aan handelen, hulp vragen en vastleggen.",
        labels: ["herken", "handel", "bel"],
        icon: `<span class="v-warning">!</span><span class="v-flow a"></span><span class="v-flow b"></span><span class="v-phone"></span>`
      },
      specialty: {
        title: "Procedureprotocol",
        text: "Per specialisme zie je procedureverloop, risico's en nazorgafspraken.",
        labels: ["procedure", "risico", "nazorg"],
        icon: `<span class="v-tile a">MDL</span><span class="v-tile b">O2</span><span class="v-tile c">P</span><span class="v-path"></span>`
      },
      portfolio: {
        title: "Bekwaamheidsroute",
        text: "Praktijkuren, observaties, feedback en EPA's laten groei zien.",
        labels: ["uren", "KPE", "EPA"],
        icon: `<span class="v-book"></span><span class="v-badge a">EPA</span><span class="v-badge b">KPE</span><span class="v-badge c">CBD</span>`
      },
      overview: {
        title: "Naslagkaart",
        text: "Elk onderdeel is gekoppeld aan leren, terugvinden en toepassen.",
        labels: ["leer", "zoek", "pas toe"],
        icon: `<span class="v-book"></span><span class="v-clipboard small"></span><span class="v-check one"></span>`
      },
      organization: {
        title: "Bereikbaarheidskaart",
        text: "Rollen, namen en achterwacht staan bij elkaar als praktische contactkaart.",
        labels: ["rollen", "namen", "bereikbaarheid"],
        icon: `<span class="v-org top"></span><span class="v-org mid a"></span><span class="v-org mid b"></span><span class="v-org line one"></span><span class="v-org line two"></span><span class="v-phone org"></span>`
      }
    };
    return models[kind] || models.overview;
  }

  function visualHtml(item, compact = false) {
    const kind = visualKind(item);
    const model = visualModel(kind);
    return `<div class="visual-card visual-${kind} ${compact ? "compact" : ""}">
      <div class="visual-stage">${model.icon}</div>
      <div class="visual-caption">
        <strong>${esc(model.title)}</strong>
        ${compact ? "" : `<p>${esc(model.text)}</p>`}
        <div class="visual-tags">${model.labels.map(label => `<span>${esc(label)}</span>`).join("")}</div>
      </div>
    </div>`;
  }

  function miniVisualHtml(item) {
    const kind = visualKind(item);
    const model = visualModel(kind);
    return `<div class="mini-visual visual-${kind}" aria-hidden="true">
      <div class="mini-stage">${model.icon}</div>
    </div>`;
  }

  function topicSummary(item) {
    const model = visualModel(visualKind(item));
    if (visualKind(item) === "organization") return model.text;
    const cleaned = cleanSourceText(item.cleanBody || item.body || "")
      .replace(/\[\[(?:\/?table|image:[^\]]+)\]\]/g, " ")
      .replace(/\s+\|\|\s+/g, " ")
      .replace(/(?:^|\s)[•>-]\s*/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (!cleaned) return model.text;
    const firstStop = cleaned.search(/[.!?]\s/);
    const sentence = firstStop > 48 ? cleaned.slice(0, firstStop + 1) : cleaned;
    const max = 145;
    return sentence.length > max ? `${sentence.slice(0, max).replace(/\s+\S*$/, "")}...` : sentence;
  }

  function textSizeLabel(chars) {
    if (!chars) return "0 tekens";
    if (chars < 1000) return "<1k tekens";
    return `${Math.round(chars / 1000)}k tekens`;
  }

  function chapterCategory(doc, chapter) {
    const title = String(chapter.title || "").toLowerCase();
    if (doc === "praktijk") return "portfolio";
    if (/protocollen|bijlagen/.test(title)) return "protocol";
    return "handboek";
  }

  function itemCategory(item) {
    if (item.doc === "praktijk") return "portfolio";
    if (/protocollen|bijlagen/.test(String(item.context || "").toLowerCase())) return "protocol";
    return "handboek";
  }

  function filterLabel(value) {
    return {
      all: "Alles",
      handboek: "Handboek",
      praktijk: "Opleiding",
      portfolio: "Portfolio",
      protocol: "Protocollen"
    }[value] || value;
  }

  function matchesFilter(value, target, doc = "") {
    if (value === "all") return true;
    if (value === "praktijk") return doc === "praktijk" || target === "portfolio";
    return target === value;
  }

  function dataEntries() {
    return Object.entries(window.SPS_DATA || {});
  }

  function chapterKey(doc, chapterId) {
    return `${doc}|${chapterId}`;
  }

  function getChapters() {
    return dataEntries().flatMap(([doc, chapters]) => chapters.map(chapter => ({
      doc,
      id: chapter.id,
      key: chapterKey(doc, chapter.id),
      num: chapter.num || "",
      title: chapter.title || "",
      label: doc === "praktijk" ? "Opleiding & Portfolio" : `${chapter.num ? chapter.num + " " : ""}${chapter.title}`.trim(),
      category: chapterCategory(doc, chapter),
      count: (chapter.subs || []).length
    })));
  }

  function selectedChapterLabel() {
    if (chapterFilter === "all") return "alle hoofdstukken";
    return getChapters().find(chapter => chapter.key === chapterFilter)?.label || "gekozen hoofdstuk";
  }

  function matchesChapter(item) {
    return chapterFilter === "all" || chapterKey(item.doc, item.chapterId) === chapterFilter;
  }

  function resize() {
    width = innerWidth;
    height = innerHeight;
    dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawWorld();
  }

  function roundedBlob(cx, cy, radius, color, index) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate((index - 2) * .08 + smoothScroll * .18);
    ctx.beginPath();
    for (let i = 0; i < 24; i++) {
      const a = i / 24 * Math.PI * 2;
      const wobble = 1 + Math.sin(a * 3 + index) * .07 + Math.cos(a * 5 + smoothScroll) * .04;
      const x = Math.cos(a) * radius * wobble * 1.25;
      const y = Math.sin(a) * radius * wobble * .72;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    const grad = ctx.createLinearGradient(-radius, -radius, radius, radius);
    grad.addColorStop(0, "#fff3df");
    grad.addColorStop(.28, color);
    grad.addColorStop(1, "#9f886b");
    ctx.fillStyle = grad;
    ctx.shadowColor = "rgba(78,58,34,.22)";
    ctx.shadowBlur = 34;
    ctx.shadowOffsetY = 22;
    ctx.fill();
    ctx.shadowColor = "transparent";
    ctx.strokeStyle = "rgba(255,255,255,.35)";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }

  function drawIcon(cx, cy, kind, scale) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(scale, scale);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = 9;
    ctx.strokeStyle = "#fff8ec";
    ctx.fillStyle = "#2f3d34";
    if (kind === 0) {
      ctx.fillRect(-28, -30, 56, 48);
      ctx.strokeRect(-28, -30, 56, 48);
      ctx.beginPath();
      ctx.moveTo(-17, -2); ctx.lineTo(-5, -2); ctx.lineTo(3, -18); ctx.lineTo(15, 8); ctx.lineTo(25, -6);
      ctx.stroke();
    } else if (kind === 1) {
      ctx.beginPath();
      ctx.arc(0, -8, 28, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-16, 28); ctx.lineTo(16, 28); ctx.moveTo(0, -35); ctx.lineTo(0, 36);
      ctx.stroke();
    } else if (kind === 2) {
      ctx.rotate(-.35);
      ctx.fillRect(-38, -9, 76, 18);
      ctx.strokeRect(-38, -9, 76, 18);
      ctx.beginPath();
      ctx.moveTo(38, 0); ctx.lineTo(58, 0);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.moveTo(0, -36); ctx.lineTo(35, 26); ctx.lineTo(-35, 26); ctx.closePath();
      ctx.fillStyle = "#d9a657";
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawWorld() {
    ctx.clearRect(0, 0, width, height);
    const bg = ctx.createLinearGradient(0, 0, width, height);
    bg.addColorStop(0, "#e4edf0");
    bg.addColorStop(.52, "#f7f2e9");
    bg.addColorStop(1, "#d8e2d8");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    const zoom = 1 + smoothScroll * .09;
    const driftX = (pointerX * 22) - smoothScroll * 34;
    const driftY = (pointerY * 16) + Math.sin(smoothScroll * 1.7) * 18;

    ctx.save();
    ctx.translate(width / 2 + driftX, height / 2 + driftY);
    ctx.scale(zoom, zoom);
    ctx.translate(-width / 2, -height / 2);

    islands.forEach((island, index) => {
      const cx = island.x * width + Math.sin(smoothScroll + index) * 18;
      const cy = island.y * height + Math.cos(smoothScroll * .8 + index) * 13;
      const radius = island.r * Math.min(width / 1200, height / 780) * (innerWidth < 800 ? 1.35 : 1);
      roundedBlob(cx, cy, radius, island.color, index);
      drawIcon(cx, cy - radius * .08, index % 4, Math.max(.45, radius / 125));
    });

    ctx.strokeStyle = "rgba(64,51,35,.16)";
    ctx.lineWidth = 9;
    ctx.beginPath();
    for (let i = 0; i < islands.length; i++) {
      const island = islands[i];
      const x = island.x * width;
      const y = island.y * height;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.restore();

    const wash = ctx.createLinearGradient(0, 0, width * .8, 0);
    wash.addColorStop(0, "rgba(230,238,240,.88)");
    wash.addColorStop(.58, "rgba(247,242,233,.42)");
    wash.addColorStop(1, "rgba(230,238,240,0)");
    ctx.fillStyle = wash;
    ctx.fillRect(0, 0, width, height);
  }

  function onScroll() {
    const max = document.documentElement.scrollHeight - innerHeight;
    scroll = max > 0 ? scrollY / max : 0;
    const nearest = panels.reduce((best, panel, index) => {
      const rect = panel.getBoundingClientRect();
      const distance = Math.abs(rect.top + rect.height * .45 - innerHeight * .5);
      return distance < best.distance ? { index, distance } : best;
    }, { index: 0, distance: Infinity }).index;
    rail.forEach((dot, index) => dot.classList.toggle("active", index === nearest));
  }

  function tick() {
    smoothScroll = reduced ? scroll : smoothScroll + (scroll - smoothScroll) * .06;
    drawWorld();
    if (!reduced) requestAnimationFrame(tick);
  }

  function textToHtml(body) {
    const lines = cleanSourceText(body).split(/\n+/).map(line => line.trim()).filter(Boolean);
    let html = "";
    let list = false;
    let paragraphGroup = [];
    const flushParagraph = () => {
      if (!paragraphGroup.length) return;
      html += `<p>${esc(paragraphGroup.join(" "))}</p>`;
      paragraphGroup = [];
    };
    const closeList = () => {
      if (list) {
        html += "</ul>";
        list = false;
      }
    };
    const renderTable = rows => {
      if (!rows.length) return "";
      const maxCols = Math.max(...rows.map(row => row.length));
      const normalized = rows.map(row => [...row, ...Array(Math.max(0, maxCols - row.length)).fill("")]);
      return `<div class="doc-table-wrap"><table class="doc-table">${normalized.map((row, rowIndex) => `<tr>${row.map(cell => {
        const tag = rowIndex === 0 ? "th" : "td";
        return `<${tag}>${esc(cell)}</${tag}>`;
      }).join("")}</tr>`).join("")}</table></div>`;
    };
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      const image = line.match(/^\[\[image:([^\]]+)\]\]$/);
      if (image) {
        flushParagraph();
        closeList();
        html += `<figure class="doc-image"><img src="${esc(image[1])}" alt="Afbeelding uit het Word-document"><figcaption>Afbeelding uit het Word-document</figcaption></figure>`;
        continue;
      }
      if (line === "[[table]]") {
        flushParagraph();
        closeList();
        const rows = [];
        index += 1;
        while (index < lines.length && lines[index] !== "[[/table]]") {
          rows.push(lines[index].split(/\s+\|\|\s+/).map(cell => cell.trim()));
          index += 1;
        }
        html += renderTable(rows);
        continue;
      }
      const bullet = line.match(/^(?:•|>|-)\s*(.*)$/);
      const heading = line.length < 86 && /:$/u.test(line) && !bullet;
      if (bullet) {
        flushParagraph();
        if (!list) {
          html += "<ul>";
          list = true;
        }
        html += `<li>${esc(bullet[1])}</li>`;
      } else if (heading) {
        flushParagraph();
        closeList();
        html += `<h3>${esc(line.replace(/:$/, ""))}</h3>`;
      } else {
        closeList();
        paragraphGroup.push(line);
        if (paragraphGroup.join(" ").length > 520) flushParagraph();
      }
    }
    flushParagraph();
    if (list) html += "</ul>";
    return html || "<p>Geen tekst beschikbaar.</p>";
  }

  function organogramHtml() {
    const leadership = [
      {
        role: "Anesthesioloog / Medisch hoofd SPS",
        name: "Drs. Nienke Witsen",
        contact: "36530"
      },
      {
        role: "Leidinggevende anesthesiemedewerkers en sedatiepraktijkspecialisten",
        name: "H. el Moutaouakkil",
        contact: "27167"
      },
      {
        role: "Senior sedatiepraktijkspecialisten / Praktijkopleider",
        name: "Ge Beuken",
        contact: "VUmc 61886 · AMC 27365"
      }
    ];
    const supervisors = [
      { location: "Locatie VUmc", phone: "61615", pager: "-" },
      { location: "Locatie AMC", phone: "-", pager: "81 58332" }
    ];
    return `<section class="org-readable">
      <p class="org-intro">Gebruik dit onderdeel als snelle bereikbaarheidskaart. De belangrijkste rollen staan bovenaan; de achterwacht per locatie staat daaronder apart.</p>
      <div class="org-chart" aria-label="Organogram SPS">
        ${leadership.map((person, index) => `<article class="org-node level-${index + 1}">
          <span class="org-role">${esc(person.role)}</span>
          <strong>${esc(person.name)}</strong>
          <span class="org-contact">${esc(person.contact)}</span>
        </article>`).join("")}
      </div>
      <h3>Supervisor / achterwacht SPS</h3>
      <div class="org-contact-grid">
        ${supervisors.map(row => `<article>
          <strong>${esc(row.location)}</strong>
          <dl>
            <div><dt>Telefoonnummer</dt><dd>${esc(row.phone)}</dd></div>
            <div><dt>Sein</dt><dd>${esc(row.pager)}</dd></div>
          </dl>
        </article>`).join("")}
      </div>
    </section>`;
  }

  function flattenData() {
    const items = [];
    for (const [doc, chapters] of Object.entries(window.SPS_DATA || {})) {
      chapters.forEach(chapter => {
        (chapter.subs || []).forEach(section => {
          items.push({
            doc,
            chapterId: chapter.id,
            chapterTitle: chapter.title,
            chapterNum: chapter.num || "",
            id: section.id,
            num: section.num || section.id,
            title: section.title,
            body: section.body || "",
            cleanBody: cleanSourceText(section.body),
            context: doc === "praktijk" ? "Opleiding & Portfolio" : `${chapter.num || ""} ${chapter.title}`.trim()
          });
        });
      });
    }
    return items;
  }

  const items = flattenData();

  function renderChapterSelect() {
    const chapters = getChapters();
    chapterSelect.innerHTML = `<option value="all">Alle hoofdstukken</option>` + chapters.map(chapter => (
      `<option value="${esc(chapter.key)}">${esc(chapter.label)} (${chapter.count})</option>`
    )).join("");
  }

  function renderChapterJump() {
    const chapters = getChapters();
    const activeChapter = chapterFilter === "all" ? null : chapters.find(chapter => chapter.key === chapterFilter);
    if (activeChapter) {
      const scopedItems = items.filter(item => chapterKey(item.doc, item.chapterId) === activeChapter.key);
      chapterJump.innerHTML = `<div class="chapter-jump-head">
        <div>
          <span class="eyebrow">Gekozen hoofdstuk</span>
          <strong>${esc(activeChapter.label)}</strong>
        </div>
        <button class="quick-chip muted" type="button" data-chapter-choice="all">Alle hoofdstukken</button>
      </div>
      <div class="chapter-subnav">
        ${scopedItems.map(item => `<button class="chapter-subnav-item" type="button" data-open="${esc(item.doc)}|${esc(item.chapterId)}|${esc(item.id)}">
          <span>${esc(item.num)}</span>
          <strong>${esc(item.title)}</strong>
        </button>`).join("")}
      </div>`;
      return;
    }
    chapterJump.innerHTML = `<div class="chapter-jump-head">
      <div>
        <span class="eyebrow">Snel naar hoofdstuk</span>
        <strong>Kies een deel om gericht te zoeken</strong>
      </div>
    </div>
    <div class="chapter-choice-grid">
      ${chapters.map(chapter => `<button class="chapter-choice ${chapter.category === "protocol" ? "protocol" : ""}" type="button" data-chapter-choice="${esc(chapter.key)}">
        <span>${esc(chapter.doc === "praktijk" ? "Opleiding" : "Handboek")}</span>
        <strong>${esc(chapter.label)}</strong>
        <em>${chapter.count} onderdelen</em>
      </button>`).join("")}
    </div>`;
  }

  function openItem(item) {
    detailContext.textContent = item.context;
    detailTitle.textContent = `${item.num ? item.num + " · " : ""}${item.title}`;
    detailVisual.innerHTML = visualHtml(item);
    detailBody.innerHTML = item.id === "2.1" && item.chapterId === "2" ? organogramHtml() : textToHtml(item.body);
    dialog.showModal();
  }

  function renderChapters() {
    const colors = [palette[0], palette[1], palette[2], palette[3], palette[4]];
    const cards = [];
    let visibleChapters = 0;
    let visibleSubtopics = 0;
    for (const [doc, chapters] of Object.entries(window.SPS_DATA || {})) {
      chapters.forEach((chapter, index) => {
        const subs = chapter.subs || [];
        const category = chapterCategory(doc, chapter);
        if (!matchesFilter(libraryFilter, category, doc)) return;
        visibleChapters += 1;
        visibleSubtopics += subs.length;
        const first = {
          doc,
          isMainTopic: true,
          chapterId: chapter.id,
          context: doc === "praktijk" ? "Opleiding & Portfolio" : `${chapter.num || ""} ${chapter.title}`.trim(),
          title: chapter.title,
          cleanBody: cleanSourceText(subs.map(sub => `${sub.title} ${sub.body}`).join(" "))
        };
        const subCards = subs.map(sub => {
          const item = {
            doc,
            chapterId: chapter.id,
            context: first.context,
            title: sub.title,
            id: sub.id,
            num: sub.num || sub.id,
            body: sub.body || "",
            cleanBody: cleanSourceText(sub.body)
          };
          return `<button class="subtopic-card" type="button" data-item="${esc(sub.id)}" data-doc="${esc(doc)}" data-chapter="${esc(chapter.id)}">
            ${miniVisualHtml(item)}
            <span class="subtopic-copy">
              <span class="subtopic-num">${esc(item.num)}</span>
              <strong>${esc(item.title)}</strong>
              <span>${esc(topicSummary(item))}</span>
            </span>
          </button>`;
        }).join("");
        cards.push(`<article class="chapter-card" data-category="${esc(category)}" style="border-top:5px solid ${colors[index % colors.length]}">
          <div class="main-topic">
            ${visualHtml(first, true)}
            <div class="chapter-card-copy">
              <p class="eyebrow">${doc === "praktijk" ? "Opleiding" : "Handboek"}</p>
              <h3>${esc(`${chapter.num ? chapter.num + " " : ""}${chapter.title}`)}</h3>
              <p>${esc(topicSummary(first))}</p>
              <div class="chapter-meta">${subs.length} onderdelen · ${textSizeLabel(subs.reduce((n, sub) => n + (sub.body || "").length, 0))}</div>
              <button class="open-section" type="button" data-chapter-open="${esc(chapter.id)}" data-doc="${esc(doc)}">Open eerste onderdeel</button>
            </div>
          </div>
          <div class="subtopic-grid">${subCards}</div>
        </article>`);
      });
    }
    chapterGrid.innerHTML = cards.join("") || `<article class="empty-state"><h3>Geen onderdelen in deze selectie.</h3><p>Kies een andere filterknop om het handboek verder te bekijken.</p></article>`;
    libraryCount.textContent = `${visibleChapters} hoofdonderwerpen · ${visibleSubtopics} subonderwerpen`;
  }

  function fullChapterMatches(chapter, doc, terms) {
    if (!terms.length) return true;
    const hay = norm(`${doc} ${chapter.num || ""} ${chapter.title || ""} ${(chapter.subs || []).map(sub => `${sub.num || ""} ${sub.title || ""} ${sub.body || ""}`).join(" ")}`);
    return terms.every(term => hay.includes(term));
  }

  function fullSubMatches(sub, chapter, doc, terms) {
    if (!terms.length) return true;
    const hay = norm(`${doc} ${chapter.num || ""} ${chapter.title || ""} ${sub.num || ""} ${sub.title || ""} ${sub.body || ""}`);
    return terms.every(term => hay.includes(term));
  }

  function renderFullHandbook() {
    const terms = norm(fullQuery).split(/\s+/).filter(Boolean);
    const groups = [];
    let chapterCount = 0;
    let subCount = 0;

    for (const [doc, chapters] of Object.entries(window.SPS_DATA || {})) {
      chapters.forEach(chapter => {
        if (!fullChapterMatches(chapter, doc, terms)) return;
        const matchingSubs = (chapter.subs || []).filter(sub => fullSubMatches(sub, chapter, doc, terms));
        if (!matchingSubs.length) return;
        chapterCount += 1;
        subCount += matchingSubs.length;
        const context = doc === "praktijk" ? "Opleiding & Portfolio" : `${chapter.num || ""} ${chapter.title}`.trim();
        const bodyChars = matchingSubs.reduce((n, sub) => n + (sub.body || "").length, 0);
        const detailsOpen = terms.length ? " open" : "";
        groups.push(`<details class="full-chapter"${detailsOpen}>
          <summary>
            <span class="full-summary-copy">
              <span class="eyebrow">${doc === "praktijk" ? "Opleiding" : "Handboek"}</span>
              <strong>${esc(`${chapter.num ? chapter.num + " " : ""}${chapter.title}`)}</strong>
            </span>
            <span class="full-meta">${matchingSubs.length} onderdelen · ${textSizeLabel(bodyChars)}</span>
          </summary>
          <div class="full-sublist">
            ${matchingSubs.map(sub => {
              const item = {
                doc,
                chapterId: chapter.id,
                id: sub.id,
                num: sub.num || sub.id,
                title: sub.title,
                body: sub.body || "",
                cleanBody: cleanSourceText(sub.body),
                context
              };
              return `<article class="full-subtopic" id="full-${esc(doc)}-${esc(sub.id).replace(/[^a-zA-Z0-9_-]/g, "-")}">
                <div class="full-subhead">
                  ${miniVisualHtml(item)}
                  <div>
                    <p class="eyebrow">${esc(context)}</p>
                    <h3>${esc(`${item.num ? item.num + " · " : ""}${item.title}`)}</h3>
                  </div>
                  <button class="open-section full-open" type="button" data-full-open="${esc(doc)}|${esc(chapter.id)}|${esc(sub.id)}">Open kaart</button>
                </div>
                <div class="detail-body full-body">
                  ${item.id === "2.1" && item.chapterId === "2" ? organogramHtml() : textToHtml(item.body)}
                </div>
              </article>`;
            }).join("")}
          </div>
        </details>`);
      });
    }

    fullHandbook.innerHTML = groups.join("") || `<article class="empty-state"><h3>Geen volledige tekst gevonden.</h3><p>Maak de filterterm breder of wis het veld om alles te tonen.</p></article>`;
    fullHandbookCount.textContent = `${chapterCount} hoofdonderwerpen · ${subCount} subonderwerpen`;
  }

  function highlight(text, terms) {
    let out = esc(text);
    terms.forEach(term => {
      const safe = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      out = out.replace(new RegExp(`(${safe})`, "gi"), "<mark>$1</mark>");
    });
    return out;
  }

  function snippet(body, terms) {
    const lower = norm(body);
    let pos = terms.reduce((found, term) => {
      const p = lower.indexOf(term);
      return p >= 0 && (found < 0 || p < found) ? p : found;
    }, -1);
    if (pos < 0) pos = 0;
    const start = Math.max(0, pos - 80);
    return (start > 0 ? "..." : "") + body.slice(start, start + 230).replace(/\s+/g, " ") + (start + 230 < body.length ? "..." : "");
  }

  function renderBrowseState(scopedItems) {
    const byChapter = scopedItems.reduce((map, item) => {
      const key = chapterKey(item.doc, item.chapterId);
      if (!map.has(key)) map.set(key, { item, rows: [] });
      map.get(key).rows.push(item);
      return map;
    }, new Map());
    const groups = [...byChapter.values()].slice(0, 12);
    searchStatus.textContent = `${scopedItems.length} onderdelen beschikbaar in ${selectedChapterLabel()}.`;
    results.innerHTML = `<article class="empty-state search-help">
      <h3>Typ een zoekterm of kies een onderdeel.</h3>
      <p>Gebruik de hoofdstukkeuze om gericht binnen één protocolgroep te zoeken. De sneltermen hierboven vullen direct veelgebruikte termen in.</p>
    </article>` + groups.map(group => `<article class="browse-group">
      <div class="browse-group-head">
        <span class="eyebrow">${esc(group.item.doc === "praktijk" ? "Opleiding" : "Handboek")}</span>
        <h3>${esc(group.item.context)}</h3>
      </div>
      <div class="browse-links">
        ${group.rows.slice(0, 8).map(item => `<button type="button" data-open="${esc(item.doc)}|${esc(item.chapterId)}|${esc(item.id)}">
          <span>${esc(item.num)}</span>
          <strong>${esc(item.title)}</strong>
        </button>`).join("")}
      </div>
    </article>`).join("");
  }

  function search() {
    const rawQuery = searchInput.value.trim();
    const query = norm(rawQuery);
    const scopedItems = items.filter(item => matchesFilter(searchFilter, itemCategory(item), item.doc) && matchesChapter(item));
    if (!query) {
      renderBrowseState(scopedItems);
      return;
    }
    const terms = query.split(/\s+/).filter(Boolean);
    const ranked = scopedItems.map(item => {
      const category = itemCategory(item);
      const hay = norm(`${item.title} ${item.context} ${item.cleanBody}`);
      let score = 0;
      terms.forEach(term => {
        if (norm(item.title).includes(term)) score += 14;
        if (norm(item.context).includes(term)) score += 6;
        if (norm(item.num).includes(term)) score += 8;
        const hits = hay.split(term).length - 1;
        score += hits;
      });
      const hitCount = terms.reduce((n, term) => n + Math.max(0, hay.split(term).length - 1), 0);
      return { item, category, score, hitCount };
    }).filter(row => row.score > 0).sort((a, b) => b.score - a.score).slice(0, 40);

    if (!ranked.length) {
      searchStatus.textContent = `Geen resultaten binnen ${selectedChapterLabel()}.`;
      results.innerHTML = `<article class="empty-state"><h3>Niets gevonden voor "${esc(rawQuery)}".</h3><p>Probeer een bredere term, een afkorting of zet de zoekfilter terug naar Alles.</p></article>`;
      return;
    }

    searchStatus.textContent = `${ranked.length} resultaten voor "${rawQuery}" binnen ${selectedChapterLabel()}.`;
    results.innerHTML = `<div class="result-summary">${ranked.length} resultaten · ${esc(filterLabel(searchFilter))}</div>` + ranked.map(({ item, category, hitCount }) => `<article class="result-card" role="button" tabindex="0" data-open="${esc(item.doc)}|${esc(item.chapterId)}|${esc(item.id)}">
      ${miniVisualHtml(item)}
      <div class="result-copy">
        <p class="eyebrow">${esc(item.context)} · ${esc(filterLabel(category))}</p>
        <h3>${highlight(`${item.num ? item.num + " · " : ""}${item.title}`, terms)}</h3>
        <p>${highlight(snippet(item.cleanBody, terms), terms)}</p>
        <div class="result-meta">
          <span>${hitCount || 1} treffers</span>
          <span>Open volledige kaart</span>
        </div>
      </div>
    </article>`).join("");
  }

  function findItem(doc, chapterId, itemId) {
    return items.find(item => item.doc === doc && item.chapterId === chapterId && item.id === itemId);
  }

  addEventListener("resize", resize);
  addEventListener("scroll", onScroll, { passive: true });
  addEventListener("pointermove", event => {
    pointerX = event.clientX / innerWidth - .5;
    pointerY = event.clientY / innerHeight - .5;
  }, { passive: true });

  closeDialog.addEventListener("click", () => dialog.close());
  searchInput.addEventListener("input", search);
  chapterSelect.addEventListener("change", () => {
    chapterFilter = chapterSelect.value;
    renderChapterJump();
    search();
  });
  clearSearch.addEventListener("click", () => {
    searchInput.value = "";
    chapterFilter = "all";
    chapterSelect.value = "all";
    searchFilter = "all";
    document.querySelectorAll("[data-search-filter]").forEach(btn => btn.classList.toggle("active", btn.dataset.searchFilter === "all"));
    renderChapterJump();
    search();
    searchInput.focus();
  });
  document.querySelectorAll("[data-quick-search]").forEach(button => {
    button.addEventListener("click", () => {
      searchInput.value = button.dataset.quickSearch;
      search();
      searchInput.focus();
    });
  });
  fullHandbookSearch.addEventListener("input", () => {
    fullQuery = fullHandbookSearch.value.trim();
    renderFullHandbook();
  });
  expandFullHandbook.addEventListener("click", () => {
    fullHandbook.querySelectorAll("details").forEach(details => details.open = true);
  });
  collapseFullHandbook.addEventListener("click", () => {
    fullHandbook.querySelectorAll("details").forEach(details => details.open = false);
  });

  document.querySelectorAll("[data-filter]").forEach(button => {
    button.addEventListener("click", () => {
      libraryFilter = button.dataset.filter;
      document.querySelectorAll("[data-filter]").forEach(btn => btn.classList.toggle("active", btn === button));
      renderChapters();
    });
  });

  document.querySelectorAll("[data-search-filter]").forEach(button => {
    button.addEventListener("click", () => {
      searchFilter = button.dataset.searchFilter;
      document.querySelectorAll("[data-search-filter]").forEach(btn => btn.classList.toggle("active", btn === button));
      search();
    });
  });

  document.addEventListener("click", event => {
    const chip = event.target.closest("[data-item]");
    const chapter = event.target.closest("[data-chapter-open]");
    const result = event.target.closest("[data-open]");
    const fullOpen = event.target.closest("[data-full-open]");
    const chapterChoice = event.target.closest("[data-chapter-choice]");
    if (chapterChoice) {
      chapterFilter = chapterChoice.dataset.chapterChoice;
      chapterSelect.value = chapterFilter;
      renderChapterJump();
      search();
      searchInput.focus();
    }
    if (chip) {
      const item = findItem(chip.dataset.doc, chip.dataset.chapter, chip.dataset.item);
      if (item) openItem(item);
    }
    if (chapter) {
      const item = items.find(row => row.doc === chapter.dataset.doc && row.chapterId === chapter.dataset.chapterOpen);
      if (item) openItem(item);
    }
    if (result) {
      const [doc, chapterId, itemId] = result.dataset.open.split("|");
      const item = findItem(doc, chapterId, itemId);
      if (item) openItem(item);
    }
    if (fullOpen) {
      const [doc, chapterId, itemId] = fullOpen.dataset.fullOpen.split("|");
      const item = findItem(doc, chapterId, itemId);
      if (item) openItem(item);
    }
  });

  document.addEventListener("keydown", event => {
    if ((event.key === "Enter" || event.key === " ") && event.target.matches("[data-open]")) {
      event.preventDefault();
      event.target.click();
    }
  });

  renderChapters();
  renderChapterSelect();
  renderChapterJump();
  renderFullHandbook();
  search();
  resize();
  onScroll();
  if (reduced) drawWorld();
  else requestAnimationFrame(tick);

  if ("serviceWorker" in navigator && /^https?:$/.test(location.protocol)) {
    navigator.serviceWorker.register("service-worker.js").catch(() => {});
  }
})();
