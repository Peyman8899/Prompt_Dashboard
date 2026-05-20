    const els = {
      app: document.getElementById("app"),
      transcript: document.getElementById("transcript"),
      prompt: document.getElementById("prompt"),
      output: document.getElementById("output"),
      groundTruth: document.getElementById("groundTruth"),
      caseTitle: document.getElementById("caseTitle"),
      apiKey: document.getElementById("apiKey"),
      apiNote: document.getElementById("apiNote"),
      model: document.getElementById("model"),
      metricsGrid: document.getElementById("metricsGrid"),
      weightedScore: document.getElementById("weightedScore"),
      scoreDetail: document.getElementById("scoreDetail"),
      metricCount: document.getElementById("metricCount"),
      evaluationReport: document.getElementById("evaluationReport"),
      transcriptWords: document.getElementById("transcriptWords"),
      promptWords: document.getElementById("promptWords"),
      groundTruthWords: document.getElementById("groundTruthWords"),
      tokenEstimate: document.getElementById("tokenEstimate"),
      placeholderState: document.getElementById("placeholderState"),
      transcriptChars: document.getElementById("transcriptChars"),
      promptChars: document.getElementById("promptChars"),
      outputChars: document.getElementById("outputChars"),
      groundTruthChars: document.getElementById("groundTruthChars"),
      outputScore: document.getElementById("outputScore"),
      outputStatus: document.getElementById("outputStatus"),
      groundTruthStatus: document.getElementById("groundTruthStatus"),
      autosaveStatus: document.getElementById("autosaveStatus"),
      promptMode: document.getElementById("promptMode"),
      savedPromptSelect: document.getElementById("savedPromptSelect"),
      promptSearch: document.getElementById("promptSearch"),
      promptList: document.getElementById("promptList"),
      libraryCount: document.getElementById("libraryCount"),
      drawer: document.getElementById("drawer"),
      fileInput: document.getElementById("fileInput"),
      toast: document.getElementById("toast")
    };

    const storageKey = "prompt-interview-dashboard-v1";
    const apiKeyStorageKey = "prompt-interview-dashboard-api-key";
    const promptLibraryStorageKey = "prompt-interview-dashboard-prompt-library";
    let metrics = [];
    let savedPrompts = [];
    const defaultMetrics = [
      {
        name: "Grounding",
        definition: "Claims are supported by transcript evidence and uncertainty is explicit.",
        score: ""
      },
      {
        name: "Completeness",
        definition: "The answer covers all requested sections and important clinical details.",
        score: ""
      },
      {
        name: "Ground truth match",
        definition: "The generated output aligns with the provided reference answer or expected extraction.",
        score: ""
      },
      {
        name: "Format control",
        definition: "The output follows the requested headings, schema, or JSON structure.",
        score: ""
      },
      {
        name: "Clinical safety",
        definition: "The answer avoids unsupported diagnoses or treatment advice and flags risk.",
        score: ""
      }
    ];
    const moves = {
      role: "You are a careful clinical prompt engineering assistant. Your task is to analyze the transcript and produce the requested output without inventing facts.",
      criteria: "Output requirements:\n- Separate confirmed facts from reasonable inferences.\n- Quote short transcript evidence when useful.\n- Mark missing or ambiguous information.\n- Use the exact schema or headings requested.",
      safety: "Clinical safety guardrails:\n- Do not diagnose beyond the transcript.\n- Do not recommend treatment unless explicitly asked.\n- Flag urgent red-flag symptoms for clinician review.\n- Preserve privacy and avoid unnecessary identifiers.",
      eval: "Before finalizing, check whether the answer is complete, grounded in the transcript, formatted correctly, and explicit about uncertainty."
    };

    const templates = {
      summarize: `You are a clinical documentation assistant preparing an interview-quality response.\n\nTask: Read the transcript and create a concise structured clinical summary.\n\nTranscript:\n{{transcript}}\n\nOutput format:\n1. Chief concern\n2. Relevant history\n3. Key symptoms and timeline\n4. Medications, allergies, and conditions mentioned\n5. Missing or ambiguous details\n6. Safety concerns or escalation flags\n\nRules:\n- Use only facts supported by the transcript.\n- Keep clinical uncertainty explicit.\n- Do not provide a diagnosis unless the transcript states one.`,
      extract: `You are an information extraction system for clinical transcripts.\n\nExtract structured data from this transcript:\n{{transcript}}\n\nReturn valid JSON with these keys:\n{\n  "patient_context": [],\n  "symptoms": [],\n  "diagnoses_mentioned": [],\n  "medications": [],\n  "allergies": [],\n  "procedures_or_tests": [],\n  "timeline": [],\n  "follow_up_items": [],\n  "uncertainties": []\n}\n\nRules:\n- Use null or [] when information is absent.\n- Do not infer demographics, medications, or diagnoses that are not stated.\n- Include transcript evidence snippets for high-impact fields.`,
      critique: `Act as a senior prompt engineering interviewer.\n\nReview this candidate prompt for a clinical transcript task:\n\nPROMPT:\n{{prompt}}\n\nClinical transcript context:\n{{transcript}}\n\nScore the prompt from 1-5 on:\n- Task clarity\n- Grounding and hallucination control\n- Output format control\n- Clinical safety\n- Handling of ambiguity and long input\n\nThen rewrite the prompt in a stronger interview-ready version.`,
      redteam: `You are evaluating a prompt for clinical safety and robustness.\n\nTranscript:\n{{transcript}}\n\nCandidate prompt:\n{{prompt}}\n\nIdentify:\n1. Where the prompt could cause unsupported clinical claims\n2. Where a long transcript could be mishandled\n3. Missing constraints or output requirements\n4. A safer revised prompt\n5. Three adversarial interview questions I should be ready to answer`
    };

    function wordCount(text) {
      const trimmed = text.trim();
      return trimmed ? trimmed.split(/\s+/).length : 0;
    }

    function formatNumber(value) {
      return new Intl.NumberFormat().format(value);
    }

    function toast(message) {
      els.toast.textContent = message;
      els.toast.classList.add("show");
      window.clearTimeout(toast.timer);
      toast.timer = window.setTimeout(() => els.toast.classList.remove("show"), 1800);
    }

    function updateStats() {
      const transcriptWords = wordCount(els.transcript.value);
      const promptWords = wordCount(els.prompt.value);
      const outputWords = wordCount(els.output.value);
      const groundTruthWords = wordCount(els.groundTruth.value);
      const estimate = Math.ceil((els.transcript.value.length + els.prompt.value.length + els.output.value.length + els.groundTruth.value.length) / 4);
      els.transcriptWords.textContent = formatNumber(transcriptWords);
      els.promptWords.textContent = formatNumber(promptWords);
      els.groundTruthWords.textContent = formatNumber(groundTruthWords);
      els.tokenEstimate.textContent = formatNumber(estimate);
      els.placeholderState.textContent = els.prompt.value.includes("{{transcript}}") ? "Found" : "Missing";
      els.placeholderState.style.color = els.prompt.value.includes("{{transcript}}") ? "var(--accent)" : "var(--rose)";
      els.transcriptChars.textContent = `${formatNumber(els.transcript.value.length)} chars`;
      els.promptChars.textContent = `${formatNumber(els.prompt.value.length)} chars`;
      els.outputChars.textContent = `${formatNumber(els.output.value.length)} chars`;
      els.groundTruthChars.textContent = `${formatNumber(els.groundTruth.value.length)} chars`;
      els.outputStatus.textContent = outputWords ? `${formatNumber(outputWords)} output words` : "Ready";
      els.groundTruthStatus.textContent = groundTruthWords ? `${formatNumber(groundTruthWords)} GT words` : "Optional reference";
    }

    function cloneDefaultMetrics() {
      return defaultMetrics.map((metric) => ({ ...metric }));
    }

    function normalizeMetrics(items) {
      return items.map((metric) => ({
        name: metric.name || "",
        definition: metric.definition || "",
        score: metric.score ?? ""
      }));
    }

    function loadApiKey() {
      els.apiKey.value = "";
      if (localStorage.getItem(apiKeyStorageKey)) {
        els.apiKey.placeholder = "Saved API key available";
        els.apiNote.textContent = "Saved key will be used for generation.";
      } else {
        els.apiKey.placeholder = "Paste OpenAI API key to save locally";
        els.apiNote.textContent = "Generation sends the transcript and prompt to OpenAI.";
      }
    }

    function saveApiKey() {
      const value = els.apiKey.value.trim();
      if (value) {
        localStorage.setItem(apiKeyStorageKey, value);
        els.apiKey.value = "";
        loadApiKey();
        toast("API key saved locally");
      }
    }

    function forgetApiKey() {
      localStorage.removeItem(apiKeyStorageKey);
      loadApiKey();
      toast("Saved API key removed");
    }

    function loadPromptLibrary() {
      try {
        const parsed = JSON.parse(localStorage.getItem(promptLibraryStorageKey) || "[]");
        savedPrompts = Array.isArray(parsed) ? parsed : [];
      } catch {
        savedPrompts = [];
      }
      renderSavedPrompts();
    }

    function savePromptLibrary() {
      localStorage.setItem(promptLibraryStorageKey, JSON.stringify(savedPrompts));
      renderSavedPrompts();
    }

    function renderSavedPrompts() {
      const current = els.savedPromptSelect.value;
      els.savedPromptSelect.innerHTML = '<option value="">Saved prompts...</option>';
      const sorted = [...savedPrompts].sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
      sorted.forEach((item) => {
        const option = document.createElement("option");
        option.value = item.id;
        option.textContent = item.name;
        els.savedPromptSelect.appendChild(option);
      });
      if (savedPrompts.some((item) => item.id === current)) {
        els.savedPromptSelect.value = current;
      }
      renderPromptList();
    }

    function selectedSavedPrompt() {
      return savedPrompts.find((item) => item.id === els.savedPromptSelect.value);
    }

    function renderPromptList() {
      const query = els.promptSearch.value.trim().toLowerCase();
      const selectedId = els.savedPromptSelect.value;
      const filtered = [...savedPrompts]
        .sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")))
        .filter((item) => {
          const haystack = `${item.name} ${item.prompt} ${(item.metrics || []).map((metric) => metric.name).join(" ")}`.toLowerCase();
          return !query || haystack.includes(query);
        });

      els.promptList.innerHTML = "";
      els.libraryCount.textContent = `${savedPrompts.length} prompt${savedPrompts.length === 1 ? "" : "s"}`;

      if (!filtered.length) {
        const empty = document.createElement("div");
        empty.className = "prompt-empty";
        empty.textContent = savedPrompts.length ? "No saved prompts match your search." : "No saved prompts yet. Save the current prompt and metrics to build your library.";
        els.promptList.appendChild(empty);
        return;
      }

      filtered.forEach((item) => {
        const card = document.createElement("button");
        card.type = "button";
        card.className = `prompt-card${item.id === selectedId ? " active" : ""}`;
        card.dataset.promptId = item.id;
        const metricCount = Array.isArray(item.metrics) ? item.metrics.length : 0;
        card.innerHTML = `
          <strong>${escapeHtml(item.name)}</strong>
          <span>${escapeHtml(promptPreview(item.prompt))}</span>
          <div class="prompt-card-meta">
            <span class="chip">${metricCount} metric${metricCount === 1 ? "" : "s"}</span>
            <span class="chip">${escapeHtml(formatDate(item.updatedAt))}</span>
          </div>
        `;
        els.promptList.appendChild(card);
      });
    }

    function promptPreview(value) {
      const text = String(value || "").replace(/\s+/g, " ").trim();
      return text ? text.slice(0, 120) : "Empty prompt";
    }

    function formatDate(value) {
      if (!value) return "Not dated";
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return "Not dated";
      return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    }

    function saveCurrentPromptSet() {
      const fallbackName = els.caseTitle.value.trim() || selectedSavedPrompt()?.name || "Clinical prompt";
      const name = prompt("Save prompt as:", fallbackName);
      if (!name) return;
      const now = new Date().toISOString();
      const existing = savedPrompts.find((item) => item.name.toLowerCase() === name.trim().toLowerCase());
      const item = {
        id: existing?.id || `prompt-${Date.now()}`,
        name: name.trim(),
        prompt: els.prompt.value,
        metrics: normalizeMetrics(metrics),
        updatedAt: now,
        createdAt: existing?.createdAt || now
      };
      if (existing) {
        Object.assign(existing, item);
      } else {
        savedPrompts.push(item);
      }
      savePromptLibrary();
      els.savedPromptSelect.value = item.id;
      renderPromptList();
      toast("Prompt and metrics saved");
    }

    function loadSelectedPromptSet() {
      const item = selectedSavedPrompt();
      if (!item) {
        toast("Choose a saved prompt first");
        return;
      }
      els.prompt.value = item.prompt || "";
      metrics = Array.isArray(item.metrics) && item.metrics.length ? normalizeMetrics(item.metrics) : cloneDefaultMetrics();
      els.evaluationReport.value = "";
      renderMetrics();
      saveDraft();
      toast("Prompt and metrics loaded");
    }

    function deleteSelectedPromptSet() {
      const item = selectedSavedPrompt();
      if (!item) {
        toast("Choose a saved prompt first");
        return;
      }
      if (!confirm(`Delete saved prompt "${item.name}"?`)) return;
      savedPrompts = savedPrompts.filter((saved) => saved.id !== item.id);
      els.savedPromptSelect.value = "";
      savePromptLibrary();
      toast("Saved prompt deleted");
    }

    function renderMetrics() {
      els.metricsGrid.querySelectorAll(".metric-row:not(.header)").forEach((row) => row.remove());
      metrics.forEach((metric, index) => {
        const row = document.createElement("div");
        row.className = "metric-row";
        row.innerHTML = `
          <input data-metric-field="name" data-index="${index}" value="${escapeHtml(metric.name)}" aria-label="Metric name">
          <input data-metric-field="definition" data-index="${index}" value="${escapeHtml(metric.definition)}" aria-label="Metric definition">
          <input data-metric-field="score" data-index="${index}" inputmode="decimal" value="${escapeHtml(String(metric.score ?? ""))}" aria-label="Metric score">
          <button type="button" data-remove-metric="${index}" title="Remove metric" aria-label="Remove metric">×</button>
        `;
        els.metricsGrid.appendChild(row);
      });
      updateScore();
    }

    function escapeHtml(value) {
      return String(value || "")
        .replaceAll("&", "&amp;")
        .replaceAll('"', "&quot;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;");
    }

    function updateScore() {
      const scored = metrics.filter((metric) => metric.score !== "" && !Number.isNaN(Number(metric.score)));
      const average = scored.length
        ? scored.reduce((sum, metric) => sum + Number(metric.score), 0) / scored.length
        : 0;
      els.weightedScore.textContent = `${average.toFixed(1)} / 5`;
      els.scoreDetail.textContent = scored.length
        ? `${scored.length} of ${metrics.length} metrics scored`
        : "No scored metrics yet";
      els.outputScore.textContent = scored.length ? `Score ${average.toFixed(1)} / 5` : "No score";
      els.metricCount.textContent = `${metrics.length} metric${metrics.length === 1 ? "" : "s"}`;
    }

    function saveDraft() {
      const payload = {
        title: els.caseTitle.value,
        transcript: els.transcript.value,
        prompt: els.prompt.value,
        output: els.output.value,
        groundTruth: els.groundTruth.value,
        metrics,
        evaluationReport: els.evaluationReport.value,
        savedPromptId: els.savedPromptSelect.value,
        savedAt: new Date().toISOString()
      };
      localStorage.setItem(storageKey, JSON.stringify(payload));
      els.autosaveStatus.textContent = "Autosaved locally";
      updateStats();
    }

    function loadDraft() {
      const raw = localStorage.getItem(storageKey);
      if (!raw) {
        els.prompt.value = templates.summarize;
        metrics = cloneDefaultMetrics();
        renderMetrics();
        updateStats();
        return;
      }
      try {
        const payload = JSON.parse(raw);
        els.caseTitle.value = payload.title || "";
        els.transcript.value = payload.transcript || "";
        els.prompt.value = payload.prompt || templates.summarize;
        els.output.value = payload.output || "";
        els.groundTruth.value = payload.groundTruth || "";
        metrics = Array.isArray(payload.metrics) && payload.metrics.length ? normalizeMetrics(payload.metrics) : cloneDefaultMetrics();
        els.evaluationReport.value = payload.evaluationReport || "";
        if (payload.savedPromptId) {
          els.savedPromptSelect.value = payload.savedPromptId;
        }
      } catch {
        els.prompt.value = templates.summarize;
        metrics = cloneDefaultMetrics();
      }
      renderMetrics();
      if (els.evaluationReport.value.trim()) {
        applyEvaluationScores(els.evaluationReport.value);
      }
      updateStats();
    }

    function insertAtCursor(textarea, text) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const before = textarea.value.slice(0, start);
      const after = textarea.value.slice(end);
      const prefix = before && !before.endsWith("\n") ? "\n\n" : "";
      textarea.value = `${before}${prefix}${text}${after}`;
      const cursor = start + prefix.length + text.length;
      textarea.focus();
      textarea.setSelectionRange(cursor, cursor);
      saveDraft();
    }

    function compilePrompt() {
      const title = els.caseTitle.value.trim();
      const transcript = els.transcript.value.trim();
      const prompt = els.prompt.value.trim();
      const compiled = prompt.includes("{{transcript}}")
        ? prompt.replaceAll("{{transcript}}", transcript || "[Paste transcript here]")
        : `${prompt}\n\nClinical transcript:\n${transcript || "[Paste transcript here]"}`;
      els.output.value = title ? `Case: ${title}\n\n${compiled}` : compiled;
      els.outputStatus.textContent = "Compiled prompt";
      saveDraft();
      toast("Compiled into the output pane");
    }

    async function generateOutput() {
      const apiKey = els.apiKey.value.trim() || localStorage.getItem(apiKeyStorageKey) || "";
      const model = els.model.value.trim() || "gpt-5-mini";
      const transcript = els.transcript.value.trim();
      const prompt = els.prompt.value.trim();

      if (!apiKey) {
        toast("Add an OpenAI API key first");
        els.apiKey.focus();
        return;
      }
      if (!transcript) {
        toast("Add the transcript first");
        els.transcript.focus();
        return;
      }
      if (!prompt) {
        toast("Add the prompt first");
        els.prompt.focus();
        return;
      }

      const button = document.getElementById("generateBtn");
      button.disabled = true;
      els.output.value = "Generating...";
      els.outputStatus.textContent = "Generating";
      updateStats();

      try {
        const response = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            apiKey,
            model,
            transcript,
            prompt,
            title: els.caseTitle.value.trim()
          })
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || "Generation failed");
        }
        els.output.value = data.output || "No text output returned.";
        els.outputStatus.textContent = "Generated output";
        saveDraft();
        toast("Generated output");
      } catch (error) {
        els.output.value = `Generation error:\n${error.message}`;
        els.outputStatus.textContent = "Generation error";
        updateStats();
        toast("Generation failed");
      } finally {
        button.disabled = false;
      }
    }

    async function evaluateOutput() {
      const apiKey = els.apiKey.value.trim() || localStorage.getItem(apiKeyStorageKey) || "";
      const model = els.model.value.trim() || "gpt-5-mini";
      const transcript = els.transcript.value.trim();
      const prompt = els.prompt.value.trim();
      const output = els.output.value.trim();
      const groundTruth = els.groundTruth.value.trim();
      const usableMetrics = metrics.filter((metric) => metric.name.trim() || metric.definition.trim());

      if (!apiKey) {
        toast("Add an OpenAI API key first");
        els.apiKey.focus();
        return;
      }
      if (!output || output === "Generating...") {
        toast("Generate or paste output first");
        els.output.focus();
        return;
      }
      if (!usableMetrics.length) {
        toast("Add at least one metric first");
        return;
      }

      const button = document.getElementById("evaluateBtn");
      button.disabled = true;
      metrics.forEach((metric) => {
        metric.score = "";
      });
      renderMetrics();
      els.evaluationReport.value = "Evaluating...";

      const rubric = usableMetrics
        .map((metric, index) => `${index + 1}. ${metric.name}: ${metric.definition}`)
        .join("\n");

      const groundTruthSection = groundTruth
        ? `\n\nGround truth reference to compare against:\n${groundTruth}`
        : "\n\nNo ground truth reference was provided. Evaluate using the transcript, prompt, rubric, and output only.";

      const evalPrompt = `Evaluate the model output using the rubric below. Score each metric from 0 to 5; all metrics count equally. If a ground truth reference is provided, compare the generated output against it and penalize missing, extra, or contradictory information.\n\nRubric:\n${rubric}\n\nReturn:\n1. Overall average score from 0-5\n2. Score for each metric from 0-5\n3. Evidence-based rationale for each score, including ground-truth mismatches when relevant\n4. Top 3 fixes to improve the prompt or output\n\nAlso include this exact machine-readable block at the end:\nSCORECARD_JSON\n{\"metric_scores\":[{\"name\":\"Metric name\",\"score\":4.0}]}\nEND_SCORECARD_JSON\n\nPrompt used:\n${prompt || "[No prompt provided]"}${groundTruthSection}\n\nModel output to evaluate:\n${output}`;

      try {
        const response = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            apiKey,
            model,
            transcript: transcript || "[No transcript provided]",
            prompt: evalPrompt,
            title: els.caseTitle.value.trim()
          })
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || "Evaluation failed");
        }
        els.evaluationReport.value = data.output || "No evaluation returned.";
        const synced = applyEvaluationScores(els.evaluationReport.value);
        saveDraft();
        toast(synced ? "Evaluation complete" : "Evaluation complete, scores need manual entry");
      } catch (error) {
        els.evaluationReport.value = `Evaluation error:\n${error.message}`;
        toast("Evaluation failed");
      } finally {
        button.disabled = false;
      }
    }

    function applyEvaluationScores(report) {
      let synced = false;
      const match = report.match(/SCORECARD_JSON\s*([\s\S]*?)\s*END_SCORECARD_JSON/i);
      if (match) {
        try {
          const parsed = JSON.parse(match[1]);
          if (Array.isArray(parsed.metric_scores)) {
            parsed.metric_scores.forEach((item, index) => {
              const score = Number(item.score);
              if (Number.isNaN(score)) return;
              const byName = findMetricByName(item.name);
              const target = byName || metrics[index];
              if (target) {
                target.score = clampScore(score);
                synced = true;
              }
            });
          }
        } catch {
          // Fall through to the plain-text parser below.
        }
      }

      if (!synced) {
        metrics.forEach((metric) => {
          const score = scoreFromReport(report, metric.name);
          if (score !== null) {
            metric.score = clampScore(score);
            synced = true;
          }
        });
      }

      if (synced) {
        renderMetrics();
      }
      return synced;
    }

    function findMetricByName(name) {
      const normalized = normalizeLabel(name);
      return metrics.find((metric) => normalizeLabel(metric.name) === normalized);
    }

    function normalizeLabel(value) {
      return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
    }

    function clampScore(score) {
      return Math.max(0, Math.min(5, Number(score))).toString();
    }

    function scoreFromReport(report, metricName) {
      const escaped = metricName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const patterns = [
        new RegExp(`[-•\\s]*${escaped}\\s*[:=-]\\s*([0-5](?:\\.\\d+)?)\\s*(?:/\\s*5)?`, "i"),
        new RegExp(`"${escaped}"\\s*[:=-]\\s*([0-5](?:\\.\\d+)?)\\s*(?:/\\s*5)?`, "i")
      ];
      for (const pattern of patterns) {
        const match = report.match(pattern);
        if (match) return Number(match[1]);
      }
      return null;
    }

    function addRubric() {
      const rubric = `\n\nInterview self-check:\n- Is the task unambiguous?\n- Does the prompt constrain the model to transcript evidence?\n- Is the output format testable?\n- Does it handle missing or conflicting clinical details?\n- Is there a safety instruction for escalation or uncertainty?`;
      insertAtCursor(els.output, rubric.trim());
      toast("Rubric added");
    }

    async function copyOutput() {
      await navigator.clipboard.writeText(els.output.value);
      toast("Output copied");
    }

    async function copyGroundTruth() {
      await navigator.clipboard.writeText(els.groundTruth.value);
      toast("Ground truth copied");
    }

    function useOutputAsGroundTruth() {
      if (!els.output.value.trim()) {
        toast("Generate or paste output first");
        els.output.focus();
        return;
      }
      els.groundTruth.value = els.output.value;
      saveDraft();
      toast("Output copied into ground truth");
    }

    function exportDraft() {
      const payload = {
        title: els.caseTitle.value,
        transcript: els.transcript.value,
        prompt: els.prompt.value,
        output: els.output.value,
        groundTruth: els.groundTruth.value,
        metrics,
        evaluationReport: els.evaluationReport.value,
        exportedAt: new Date().toISOString()
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const link = document.createElement("a");
      const slug = (payload.title || "prompt-interview-dashboard").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      link.href = URL.createObjectURL(blob);
      link.download = `${slug || "prompt-interview-dashboard"}.json`;
      link.click();
      URL.revokeObjectURL(link.href);
      toast("Exported practice file");
    }

    function importDraft(file) {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const payload = JSON.parse(reader.result);
          els.caseTitle.value = payload.title || "";
          els.transcript.value = payload.transcript || "";
          els.prompt.value = payload.prompt || "";
          els.output.value = payload.output || "";
          els.groundTruth.value = payload.groundTruth || "";
          metrics = Array.isArray(payload.metrics) && payload.metrics.length ? normalizeMetrics(payload.metrics) : cloneDefaultMetrics();
          els.evaluationReport.value = payload.evaluationReport || "";
          renderMetrics();
          saveDraft();
          toast("Imported practice file");
        } catch {
          toast("That file was not a dashboard export");
        }
      };
      reader.readAsText(file);
    }

    document.getElementById("generateBtn").addEventListener("click", generateOutput);
    document.getElementById("evaluateBtn").addEventListener("click", evaluateOutput);
    document.getElementById("compileBtn").addEventListener("click", compilePrompt);
    document.getElementById("rubricBtn").addEventListener("click", addRubric);
    document.getElementById("copyOutput").addEventListener("click", copyOutput);
    document.getElementById("copyGroundTruth").addEventListener("click", copyGroundTruth);
    document.getElementById("pasteOutputToGroundTruth").addEventListener("click", useOutputAsGroundTruth);
    document.getElementById("savePromptBtn").addEventListener("click", saveCurrentPromptSet);
    document.getElementById("loadPromptBtn").addEventListener("click", loadSelectedPromptSet);
    document.getElementById("deletePromptBtn").addEventListener("click", deleteSelectedPromptSet);
    document.getElementById("librarySaveBtn").addEventListener("click", saveCurrentPromptSet);
    document.getElementById("libraryLoadBtn").addEventListener("click", loadSelectedPromptSet);
    document.getElementById("libraryDeleteBtn").addEventListener("click", deleteSelectedPromptSet);
    els.savedPromptSelect.addEventListener("change", () => {
      renderPromptList();
      saveDraft();
    });
    els.promptSearch.addEventListener("input", renderPromptList);
    els.promptList.addEventListener("click", (event) => {
      const card = event.target.closest("[data-prompt-id]");
      if (!card) return;
      els.savedPromptSelect.value = card.dataset.promptId;
      renderPromptList();
      saveDraft();
    });
    els.promptList.addEventListener("dblclick", (event) => {
      const card = event.target.closest("[data-prompt-id]");
      if (!card) return;
      els.savedPromptSelect.value = card.dataset.promptId;
      loadSelectedPromptSet();
    });
    document.getElementById("saveApiKeyBtn").addEventListener("click", saveApiKey);
    document.getElementById("forgetApiKeyBtn").addEventListener("click", forgetApiKey);
    document.getElementById("addMetricBtn").addEventListener("click", () => {
      metrics.push({ name: "", definition: "", score: "" });
      renderMetrics();
      saveDraft();
      toast("Metric added");
    });
    document.getElementById("defaultMetricsBtn").addEventListener("click", () => {
      metrics = cloneDefaultMetrics();
      renderMetrics();
      saveDraft();
      toast("Default metrics loaded");
    });
    document.getElementById("exportBtn").addEventListener("click", exportDraft);
    document.getElementById("importBtn").addEventListener("click", () => els.fileInput.click());
    document.getElementById("templatesBtn").addEventListener("click", () => els.drawer.classList.add("open"));
    document.getElementById("closeDrawer").addEventListener("click", () => els.drawer.classList.remove("open"));
    document.getElementById("insertMove").addEventListener("click", () => {
      const value = els.promptMode.value;
      if (moves[value]) insertAtCursor(els.prompt, moves[value]);
      els.promptMode.value = "";
    });
    document.getElementById("resetBtn").addEventListener("click", () => {
      if (!confirm("Clear this dashboard draft?")) return;
      els.caseTitle.value = "";
      els.transcript.value = "";
      els.prompt.value = templates.summarize;
      els.output.value = "";
      els.groundTruth.value = "";
      saveDraft();
      toast("Dashboard reset");
    });

    document.querySelectorAll("[data-clear]").forEach((button) => {
      button.addEventListener("click", () => {
        const target = button.dataset.clear;
        els[target].value = "";
        saveDraft();
        toast(`${target[0].toUpperCase()}${target.slice(1)} cleared`);
      });
    });

    document.querySelectorAll("[data-expand]").forEach((button) => {
      button.addEventListener("click", () => {
        const pane = button.closest(".pane");
        const isExpanded = pane.classList.contains("expanded");
        document.querySelectorAll(".pane").forEach((item) => item.classList.remove("expanded"));
        els.app.classList.toggle("focus", !isExpanded);
        if (!isExpanded) pane.classList.add("expanded");
      });
    });

    document.querySelectorAll("[data-template]").forEach((button) => {
      button.addEventListener("click", () => {
        els.prompt.value = templates[button.dataset.template];
        els.drawer.classList.remove("open");
        saveDraft();
        toast("Template loaded");
      });
    });

    els.metricsGrid.addEventListener("input", (event) => {
      const field = event.target.dataset.metricField;
      if (!field) return;
      const index = Number(event.target.dataset.index);
      metrics[index][field] = event.target.value;
      updateScore();
      saveDraft();
    });

    els.metricsGrid.addEventListener("click", (event) => {
      const index = event.target.dataset.removeMetric;
      if (index === undefined) return;
      metrics.splice(Number(index), 1);
      renderMetrics();
      saveDraft();
      toast("Metric removed");
    });

    els.fileInput.addEventListener("change", (event) => {
      const [file] = event.target.files;
      if (file) importDraft(file);
      event.target.value = "";
    });

    [els.transcript, els.prompt, els.output, els.groundTruth, els.caseTitle, els.evaluationReport].forEach((field) => {
      field.addEventListener("input", saveDraft);
    });

    window.addEventListener("keydown", (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
        event.preventDefault();
        generateOutput();
      }
      if (event.key === "Escape") {
        els.drawer.classList.remove("open");
        els.app.classList.remove("focus");
        document.querySelectorAll(".pane").forEach((item) => item.classList.remove("expanded"));
      }
    });

    loadPromptLibrary();
    loadApiKey();
    loadDraft();
