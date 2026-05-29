/* Collective Memory Visualizer */
(async function () {
  const data = await d3.json("memory-data.json");
  if (!data || !data.length) {
    document.getElementById("chart").innerHTML =
      '<p style="padding:40px;color:#6a6a7a">No data. Run: npm run export</p>';
    return;
  }

  // ── Color + shape config ──────────────────────────────────────
  const projects = [...new Set(data.map((d) => d.project))].sort();
  const types = [...new Set(data.map((d) => d.type))].sort();

  const projectColors = d3.scaleOrdinal()
    .domain(projects)
    .range([
      "#d4a574", "#7aa2c4", "#a4d4a0", "#d47a7a",
      "#c4a0d4", "#d4c474", "#74c4b4", "#d49474",
    ]);

  const typeShapes = {
    context: d3.symbolCircle,
    decision: d3.symbolDiamond,
    milestone: d3.symbolTriangle,
    learning: d3.symbolSquare,
    session_summary: d3.symbolStar,
  };

  const defaultShape = d3.symbolCircle;

  // ── State ─────────────────────────────────────────────────────
  let mode = "umap";
  let activeProjects = new Set(projects);
  let activeTypes = new Set(types);
  let searchTerm = "";
  let selectedId = null;

  // ── Panel toggles ─────────────────────────────────────────────
  const filtersPanel = document.getElementById("filters");
  const detailPanel = document.getElementById("detail");
  const filtersBtn = document.getElementById("toggle-filters");
  const detailBtn = document.getElementById("toggle-detail");

  function togglePanel(panel, btn) {
    const isOpen = panel.classList.contains("open");
    panel.classList.toggle("open", !isOpen);
    btn.classList.toggle("active", !isOpen);
    // Re-render after transition so chart uses correct dimensions
    setTimeout(render, 220);
  }

  filtersBtn.addEventListener("click", () => togglePanel(filtersPanel, filtersBtn));
  detailBtn.addEventListener("click", () => togglePanel(detailPanel, detailBtn));

  function openDetail() {
    if (!detailPanel.classList.contains("open")) {
      detailPanel.classList.add("open");
      detailBtn.classList.add("active");
    }
  }

  // ── Chart setup ───────────────────────────────────────────────
  const container = document.getElementById("chart");
  const margin = { top: 20, right: 20, bottom: 30, left: 40 };
  const svg = d3.select(container).append("svg");
  const g = svg.append("g");

  const tooltip = document.getElementById("tooltip");

  function dimensions() {
    const w = container.clientWidth;
    const h = container.clientHeight;
    return {
      width: Math.max(w - margin.left - margin.right, 100),
      height: Math.max(h - margin.top - margin.bottom, 100),
    };
  }

  // ── Scales ────────────────────────────────────────────────────
  function getScales() {
    const dim = dimensions();
    const filtered = getFiltered();

    if (!filtered.length) return { xScale: null, yScale: null, dim };

    let xDomain;
    if (mode === "timeline") {
      const dates = filtered.map((d) => new Date(d.created_at));
      xDomain = d3.extent(dates);
    } else {
      xDomain = d3.extent(filtered, (d) => d.x);
    }

    const yDomain = d3.extent(filtered, (d) => d.y);

    const xRange = (xDomain[1] - xDomain[0]) || 1;
    const yRange = (yDomain[1] - yDomain[0]) || 1;
    const xPad = xRange * 0.08;
    const yPad = yRange * 0.08;

    const xScale = mode === "timeline"
      ? d3.scaleTime()
          .domain([new Date(xDomain[0].getTime() - xPad), new Date(xDomain[1].getTime() + xPad)])
          .range([0, dim.width])
      : d3.scaleLinear()
          .domain([xDomain[0] - xPad, xDomain[1] + xPad])
          .range([0, dim.width]);

    const yScale = d3.scaleLinear()
      .domain([yDomain[0] - yPad, yDomain[1] + yPad])
      .range([dim.height, 0]);

    return { xScale, yScale, dim };
  }

  // ── Filter logic ──────────────────────────────────────────────
  function getFiltered() {
    return data.filter((d) => {
      if (!activeProjects.has(d.project)) return false;
      if (!activeTypes.has(d.type)) return false;
      if (searchTerm && !d.content.toLowerCase().includes(searchTerm)) return false;
      return true;
    });
  }

  // ── Recency scale (opacity: older → dim, newer → bright) ─────
  const timeExtent = d3.extent(data, (d) => new Date(d.created_at));
  const recencyScale = d3.scaleLinear()
    .domain(timeExtent)
    .range([0.3, 1.0]);

  function nodeOpacity(d) {
    return recencyScale(new Date(d.created_at));
  }

  // ── Type colors (for breakdown view) ─────────────────────────
  const typeColors = d3.scaleOrdinal()
    .domain(types)
    .range(["#7aa2c4", "#d4a574", "#a4d4a0", "#d47a7a", "#c4a0d4"]);

  // ── Render dispatcher ───────────────────────────────────────
  function render() {
    if (mode === "breakdown") {
      renderBreakdown();
    } else {
      renderScatter();
    }
  }

  // ── Breakdown (donut charts) ────────────────────────────────
  function renderBreakdown() {
    const dim = dimensions();
    const filtered = getFiltered();

    svg.attr("width", dim.width + margin.left + margin.right)
      .attr("height", dim.height + margin.top + margin.bottom);

    g.attr("transform", `translate(${margin.left},${margin.top})`);
    g.selectAll("*").remove();

    if (!filtered.length) return;

    const chartW = dim.width / 2;
    const radius = Math.min(chartW, dim.height) * 0.35;
    const innerRadius = radius * 0.55;

    const arc = d3.arc().innerRadius(innerRadius).outerRadius(radius);
    const hoverArc = d3.arc().innerRadius(innerRadius).outerRadius(radius + 6);
    const pie = d3.pie().value((d) => d[1]).sort(null).padAngle(0.02);

    // ── By Project (left) ──
    const projectData = d3.rollup(filtered, (v) => v.length, (d) => d.project);
    const projectGroup = g.append("g")
      .attr("transform", `translate(${chartW * 0.5},${dim.height / 2})`);

    projectGroup.selectAll("path")
      .data(pie([...projectData]))
      .join("path")
      .attr("d", arc)
      .attr("fill", (d) => projectColors(d.data[0]))
      .attr("stroke", "#0a0a0f")
      .attr("stroke-width", 1)
      .attr("opacity", 0.85)
      .style("cursor", "pointer")
      .on("mouseover", function (event, d) {
        d3.select(this).attr("d", hoverArc).attr("opacity", 1);
        tooltip.style.display = "block";
        tooltip.textContent = `${d.data[0]}: ${d.data[1]} memories`;
      })
      .on("mousemove", function (event) {
        tooltip.style.left = (event.offsetX + 12) + "px";
        tooltip.style.top = (event.offsetY - 20) + "px";
      })
      .on("mouseout", function () {
        d3.select(this).attr("d", arc).attr("opacity", 0.85);
        tooltip.style.display = "none";
      })
      .on("click", function (event, d) {
        showSliceDetail("project", d.data[0], projectColors(d.data[0]), filtered);
      });

    // Center label
    projectGroup.append("text")
      .attr("text-anchor", "middle")
      .attr("dy", "-0.2em")
      .attr("fill", "#6a6a7a")
      .attr("font-size", "10px")
      .attr("font-family", "inherit")
      .text("BY PROJECT");
    projectGroup.append("text")
      .attr("text-anchor", "middle")
      .attr("dy", "1.2em")
      .attr("fill", "#c8c8d4")
      .attr("font-size", "20px")
      .attr("font-family", "inherit")
      .text(filtered.length);

    // Project legend
    const projectLegend = projectGroup.append("g")
      .attr("transform", `translate(0,${radius + 24})`);
    [...projectData].forEach(([name, count], i) => {
      const row = projectLegend.append("g")
        .attr("transform", `translate(${-60},${i * 16})`);
      row.append("rect")
        .attr("width", 8).attr("height", 8).attr("rx", 2)
        .attr("fill", projectColors(name));
      row.append("text")
        .attr("x", 14).attr("y", 8)
        .attr("fill", "#c8c8d4")
        .attr("font-size", "10px")
        .attr("font-family", "inherit")
        .text(`${name} (${count})`);
    });

    // ── By Type (right) ──
    const typeData = d3.rollup(filtered, (v) => v.length, (d) => d.type);
    const typeGroup = g.append("g")
      .attr("transform", `translate(${chartW * 1.5},${dim.height / 2})`);

    typeGroup.selectAll("path")
      .data(pie([...typeData]))
      .join("path")
      .attr("d", arc)
      .attr("fill", (d) => typeColors(d.data[0]))
      .attr("stroke", "#0a0a0f")
      .attr("stroke-width", 1)
      .attr("opacity", 0.85)
      .style("cursor", "pointer")
      .on("mouseover", function (event, d) {
        d3.select(this).attr("d", hoverArc).attr("opacity", 1);
        tooltip.style.display = "block";
        tooltip.textContent = `${d.data[0]}: ${d.data[1]} memories`;
      })
      .on("mousemove", function (event) {
        tooltip.style.left = (event.offsetX + 12) + "px";
        tooltip.style.top = (event.offsetY - 20) + "px";
      })
      .on("mouseout", function () {
        d3.select(this).attr("d", arc).attr("opacity", 0.85);
        tooltip.style.display = "none";
      })
      .on("click", function (event, d) {
        showSliceDetail("type", d.data[0], typeColors(d.data[0]), filtered);
      });

    // Center label
    typeGroup.append("text")
      .attr("text-anchor", "middle")
      .attr("dy", "-0.2em")
      .attr("fill", "#6a6a7a")
      .attr("font-size", "10px")
      .attr("font-family", "inherit")
      .text("BY TYPE");
    typeGroup.append("text")
      .attr("text-anchor", "middle")
      .attr("dy", "1.2em")
      .attr("fill", "#c8c8d4")
      .attr("font-size", "20px")
      .attr("font-family", "inherit")
      .text(filtered.length);

    // Type legend
    const typeLegend = typeGroup.append("g")
      .attr("transform", `translate(0,${radius + 24})`);
    [...typeData].forEach(([name, count], i) => {
      const row = typeLegend.append("g")
        .attr("transform", `translate(${-60},${i * 16})`);
      row.append("rect")
        .attr("width", 8).attr("height", 8).attr("rx", 2)
        .attr("fill", typeColors(name));
      row.append("text")
        .attr("x", 14).attr("y", 8)
        .attr("fill", "#c8c8d4")
        .attr("font-size", "10px")
        .attr("font-family", "inherit")
        .text(`${name} (${count})`);
    });
  }

  // ── Scatter (UMAP / Timeline) ───────────────────────────────
  function renderScatter() {
    const { xScale, yScale, dim } = getScales();
    const filtered = getFiltered();

    svg.attr("width", dim.width + margin.left + margin.right)
      .attr("height", dim.height + margin.top + margin.bottom);

    g.attr("transform", `translate(${margin.left},${margin.top})`);
    g.selectAll("*").remove();

    if (!xScale || !filtered.length) return;

    // Axes
    const xAxis = mode === "timeline"
      ? d3.axisBottom(xScale).ticks(Math.max(2, Math.floor(dim.width / 100))).tickFormat(d3.timeFormat("%b %d"))
      : d3.axisBottom(xScale).ticks(Math.max(2, Math.floor(dim.width / 80)));

    g.append("g")
      .attr("transform", `translate(0,${dim.height})`)
      .call(xAxis)
      .selectAll("text,line,path")
      .attr("stroke", "#2a2a3a")
      .attr("fill", "#6a6a7a");

    g.append("g")
      .call(d3.axisLeft(yScale).ticks(Math.max(2, Math.floor(dim.height / 60))))
      .selectAll("text,line,path")
      .attr("stroke", "#2a2a3a")
      .attr("fill", "#6a6a7a");

    // Scale node size relative to chart area
    const area = dim.width * dim.height;
    const baseSize = Math.max(60, Math.min(120, area / 2000));
    const selectedSize = baseSize * 2.2;
    const hoverSize = baseSize * 1.8;

    // Nodes
    g.selectAll(".node")
      .data(filtered, (d) => d.id)
      .join("path")
      .attr("class", "node")
      .attr("d", (d) => {
        const shape = typeShapes[d.type] || defaultShape;
        return d3.symbol().type(shape).size(d.id === selectedId ? selectedSize : baseSize)();
      })
      .attr("transform", (d) => {
        const x = mode === "timeline"
          ? xScale(new Date(d.created_at))
          : xScale(d.x);
        const y = yScale(d.y);
        return `translate(${x},${y})`;
      })
      .attr("fill", (d) => projectColors(d.project))
      .attr("opacity", (d) => d.id === selectedId ? 1 : nodeOpacity(d))
      .attr("stroke", (d) => d.id === selectedId ? "#fff" : "none")
      .attr("stroke-width", 1.5)
      .style("cursor", "pointer")
      .on("mouseover", function (event, d) {
        d3.select(this).attr("opacity", 1).attr("d",
          d3.symbol().type(typeShapes[d.type] || defaultShape).size(hoverSize)()
        );
        tooltip.style.display = "block";
        tooltip.textContent = d.content.slice(0, 120) + (d.content.length > 120 ? "..." : "");
        tooltip.style.left = (event.offsetX + 12) + "px";
        tooltip.style.top = (event.offsetY - 20) + "px";
      })
      .on("mousemove", function (event) {
        tooltip.style.left = (event.offsetX + 12) + "px";
        tooltip.style.top = (event.offsetY - 20) + "px";
      })
      .on("mouseout", function (event, d) {
        d3.select(this)
          .attr("opacity", d.id === selectedId ? 1 : nodeOpacity(d))
          .attr("d", d3.symbol().type(typeShapes[d.type] || defaultShape).size(d.id === selectedId ? selectedSize : baseSize)());
        tooltip.style.display = "none";
      })
      .on("click", function (event, d) {
        selectedId = d.id;
        showDetail(d);
        openDetail();
        render();
      });
  }

  // ── Detail panel ──────────────────────────────────────────────
  function showDetail(d) {
    const panel = document.getElementById("detail");
    const date = new Date(d.created_at).toLocaleDateString("en-US", {
      year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
    });
    const tagsHtml = d.tags.length
      ? d.tags.map((t) => `<span class="tag">${t}</span>`).join("")
      : '<span class="tag">none</span>';

    panel.innerHTML = `
      <h3>Content</h3>
      <div class="detail-content">${escapeHtml(d.content)}</div>
      <h3>Metadata</h3>
      <div class="meta-row"><span class="meta-label">project</span><span class="meta-value">${d.project}</span></div>
      <div class="meta-row"><span class="meta-label">type</span><span class="meta-value">${d.type}</span></div>
      <div class="meta-row"><span class="meta-label">created</span><span class="meta-value">${date}</span></div>
      <div class="meta-row"><span class="meta-label">id</span><span class="meta-value" style="font-size:9px">${d.id.slice(0, 8)}</span></div>
      <h3 style="margin-top:12px">Tags</h3>
      <div style="margin-top:4px">${tagsHtml}</div>
    `;
  }

  function escapeHtml(str) {
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  // ── Slice detail (breakdown drill-down) ─────────────────────
  function showSliceDetail(field, value, color, filtered) {
    const memories = filtered
      .filter((d) => d[field] === value)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    const panel = document.getElementById("detail");
    const label = field === "project" ? "Project" : "Type";

    let html = `
      <h3>${label}: <span style="color:${color}">${value}</span></h3>
      <div style="margin-bottom:8px;font-size:11px;color:#6a6a7a">${memories.length} memories</div>
    `;

    for (const m of memories) {
      const date = new Date(m.created_at).toLocaleDateString("en-US", {
        month: "short", day: "numeric",
      });
      const typeTag = field === "project" ? m.type : m.project;
      html += `
        <div class="memory-list-item" data-id="${m.id}">
          <div class="memory-text">${escapeHtml(m.content)}</div>
          <div class="memory-meta">${date} · ${typeTag}</div>
        </div>`;
    }

    panel.innerHTML = html;
    openDetail();

    // Click a list item to drill into single memory detail
    panel.querySelectorAll(".memory-list-item").forEach((el) => {
      el.addEventListener("click", () => {
        const mem = data.find((d) => d.id === el.dataset.id);
        if (mem) showDetail(mem);
      });
    });
  }

  // ── Filters sidebar ──────────────────────────────────────────
  function buildFilters() {
    const sidebar = document.getElementById("filters");

    const projectCounts = d3.rollup(data, (v) => v.length, (d) => d.project);
    const typeCounts = d3.rollup(data, (v) => v.length, (d) => d.type);

    let html = "<h3>Projects</h3>";
    for (const p of projects) {
      const color = projectColors(p);
      html += `
        <label class="filter-item">
          <input type="checkbox" data-filter="project" data-value="${p}" checked>
          <span class="swatch" style="background:${color}"></span>
          ${p}
          <span class="count">${projectCounts.get(p) || 0}</span>
        </label>`;
    }

    html += "<h3>Types</h3>";
    for (const t of types) {
      html += `
        <label class="filter-item">
          <input type="checkbox" data-filter="type" data-value="${t}" checked>
          ${t}
          <span class="count">${typeCounts.get(t) || 0}</span>
        </label>`;
    }

    sidebar.innerHTML = html;

    sidebar.querySelectorAll("input[type=checkbox]").forEach((cb) => {
      cb.addEventListener("change", () => {
        const filter = cb.dataset.filter;
        const value = cb.dataset.value;
        const set = filter === "project" ? activeProjects : activeTypes;
        if (cb.checked) set.add(value); else set.delete(value);
        updateStats();
        render();
      });
    });
  }

  // ── Stats footer ──────────────────────────────────────────────
  function updateStats() {
    const filtered = getFiltered();
    const footer = document.getElementById("stats");

    const projectBreak = d3.rollup(filtered, (v) => v.length, (d) => d.project);

    let parts = [
      `<span class="stat-label">Total:</span><span class="stat-value">${filtered.length}/${data.length}</span>`,
    ];

    for (const [p, c] of projectBreak) {
      parts.push(`<span class="stat-label">${p}:</span><span class="stat-value">${c}</span>`);
    }

    footer.innerHTML = parts.join("");
  }

  // ── Mode toggle ───────────────────────────────────────────────
  document.querySelectorAll(".toggle-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".toggle-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      mode = btn.dataset.mode;
      render();
    });
  });

  // ── Search ────────────────────────────────────────────────────
  document.getElementById("search").addEventListener("input", (e) => {
    searchTerm = e.target.value.toLowerCase();
    updateStats();
    render();
  });

  // ── Resize ────────────────────────────────────────────────────
  window.addEventListener("resize", render);

  // ── Init ──────────────────────────────────────────────────────
  buildFilters();
  updateStats();
  render();
})();
