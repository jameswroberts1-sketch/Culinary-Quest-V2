// path: src/skins/cooking/screens/FinaliseEventScreen.js
// Organiser-only screen: confirm who attended and open voting for the current host event.
//
// Writes:
//   voting.open = true
//   voting.hostIndex = <current host index>
//   voting.eligibleTokens = { "<INVITE_TOKEN>": true, ... }
//
// IMPORTANT:
// - Host cannot vote for their own event (host token is excluded from eligibleTokens).
// - Guests should never reach this screen (router blocks organiser states during guest sessions).

import { readGame, updateGame } from "../../../engine/firestore.js";

const CURRENT_GAME_KEY = "cq_current_game_id_v1";

function esc(str) {
  if (str == null) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function scrollToTop() {
  try {
    const scroller =
      document.scrollingElement ||
      document.documentElement ||
      document.body;
    if (scroller && typeof scroller.scrollTo === "function") {
      scroller.scrollTo({ top: 0, left: 0, behavior: "auto" });
    } else if (scroller) {
      scroller.scrollTop = 0;
    }
  } catch (_) {}
}

function getCurrentGameId(model) {
  if (model && typeof model.gameId === "string" && model.gameId.trim()) {
    return model.gameId.trim();
  }
  try {
    const stored = window.localStorage.getItem(CURRENT_GAME_KEY);
    return stored && stored.trim() ? stored.trim() : null;
  } catch (_) {
    return null;
  }
}

// Robust local-time parse for Safari/iOS: new Date(y, m-1, d, hh, mm)
function toLocalStartMs(dateStr, timeStr) {
  if (!dateStr) return null;
  const parts = String(dateStr).trim().split("-");
  if (parts.length !== 3) return null;

  const y = Number(parts[0]);
  const mo = Number(parts[1]);
  const d = Number(parts[2]);

  const t = timeStr && String(timeStr).trim() ? String(timeStr).trim() : "19:00";
  const tparts = t.split(":");
  const hh = Number(tparts[0] || 0);
  const mm = Number(tparts[1] || 0);

  const dt = new Date(y, mo - 1, d, hh, mm, 0, 0);
  const ms = dt.getTime();
  return Number.isFinite(ms) ? ms : null;
}

function pickActiveHostIndex(game, forcedHostIndex) {
  if (Number.isFinite(forcedHostIndex)) return Number(forcedHostIndex);

  const voting =
    game && game.voting && typeof game.voting === "object" ? game.voting : null;
  if (voting && voting.open && Number.isFinite(voting.hostIndex)) {
    return Number(voting.hostIndex);
  }

  const hosts = Array.isArray(game && game.hosts) ? game.hosts : [];
  const rsvps =
    game && game.rsvps && typeof game.rsvps === "object" ? game.rsvps : {};
  const nowMs = Date.now();

  const events = [];
  for (let i = 0; i < hosts.length; i++) {
    const r = rsvps[i] || rsvps[String(i)] || null;
    if (!r || !r.date) continue;
    const startMs = toLocalStartMs(r.date, r.time);
    if (!startMs) continue;
    events.push({ hostIndex: i, startMs });
  }

  events.sort((a, b) => a.startMs - b.startMs);
  const eligible = events.filter((e) => e.startMs <= nowMs);
  if (!eligible.length) return null;

  // Most recent event whose start time has passed
  return eligible[eligible.length - 1].hostIndex;
}

export function render(root, model = {}, actions = {}) {
  if (!root)
    root =
      document.getElementById("cq-main") ||
      document.getElementById("app") ||
      document.body;

  scrollToTop();

  let cancelled = false;
  const cleanup = () => {
    cancelled = true;
  };

  root.innerHTML = `
    <section class="menu-card">
      <div class="menu-hero">
        <img class="menu-logo" src="./src/skins/cooking/assets/cq-logo.png" alt="Culinary Quest" />
      </div>

      <div class="menu-ornament" aria-hidden="true"></div>

      <section class="menu-section">
        <div class="menu-course">MAIN</div>
        <h2 class="menu-h2">FINALISE EVENT</h2>
        <p class="menu-copy" id="finaliseIntro">
          Loading the latest attendance info…
        </p>
      </section>

      <div class="menu-divider" aria-hidden="true"></div>

      <section class="menu-section" id="finaliseBody"></section>
    </section>

    <div class="menu-ornament" aria-hidden="true"></div>
  `;

  const introEl = root.querySelector("#finaliseIntro");
  const bodyEl = root.querySelector("#finaliseBody");

  (async () => {
    try {
      const gameId = getCurrentGameId(model);
      if (!gameId) {
        if (introEl)
          introEl.textContent =
            "No current game is selected. Please return to the dashboard and open a Quest.";
        if (bodyEl) {
          bodyEl.innerHTML = `
            <div class="menu-actions" style="margin-top:10px;">
              <button class="btn btn-secondary" id="backDash">Back to dashboard</button>
            </div>
          `;
          const back = bodyEl.querySelector("#backDash");
          if (back && actions && typeof actions.setState === "function") {
            back.addEventListener("click", () =>
              actions.setState("gameDashboard")
            );
          }
        }
        return;
      }

      const game = await readGame(gameId);
      if (cancelled) return;

      if (!game) {
        if (introEl)
          introEl.textContent =
            "Sorry — we couldn’t load this game right now.";
        return;
      }

      const hosts = Array.isArray(game.hosts) ? game.hosts : [];
      const rsvps =
        game.rsvps && typeof game.rsvps === "object" ? game.rsvps : {};
      const availability =
        game.availability && typeof game.availability === "object"
          ? game.availability
          : {};

      // Token source of truth (Firestore)
      const tokens = Array.isArray(game.hostTokens)
        ? game.hostTokens
        : Array.isArray(game.tokens)
        ? game.tokens
        : [];

      if (!hosts.length) {
        if (introEl) introEl.textContent = "No hosts were found for this Quest.";
        return;
      }

      const forcedHostIndex = Number.isFinite(model.finaliseHostIndex)
        ? Number(model.finaliseHostIndex)
        : null;

      const hostIndex = pickActiveHostIndex(game, forcedHostIndex);

      if (!Number.isFinite(hostIndex)) {
        if (introEl)
          introEl.textContent =
            "No event is live yet (or no event time has been reached).";
        if (bodyEl) {
          bodyEl.innerHTML = `
            <p class="menu-copy">
              Once an event’s start time has been reached, you’ll be able to confirm attendance and open voting.
            </p>
            <div class="menu-actions" style="margin-top:12px;">
              <button class="btn btn-secondary" id="backDash">Back to dashboard</button>
            </div>
          `;
          const back = bodyEl.querySelector("#backDash");
          if (back && actions && typeof actions.setState === "function") {
            back.addEventListener("click", () =>
              actions.setState("gameDashboard")
            );
          }
        }
        return;
      }

      const hostDoc = hosts[hostIndex] || {};
      const hostName = hostDoc.name || `Host ${hostIndex + 1}`;
      const safeHost = esc(hostName);

      const hostRsvp = rsvps[hostIndex] || rsvps[String(hostIndex)] || {};
      const startMs = toLocalStartMs(hostRsvp.date, hostRsvp.time);
      const startLine = startMs
        ? new Date(startMs).toLocaleString(undefined, {
            weekday: "short",
            year: "numeric",
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })
        : "";

      const expected = [];
      const others = [];

      const getViewerMap = (idx) =>
        availability[idx] || availability[String(idx)] || null;

      for (let viewerIdx = 0; viewerIdx < hosts.length; viewerIdx++) {
        if (viewerIdx === hostIndex) continue; // host cannot vote
        const viewerDoc = hosts[viewerIdx] || {};
        const viewerName = viewerDoc.name || `Host ${viewerIdx + 1}`;
        const safeName = esc(viewerName);

        const token = tokens[viewerIdx] ? String(tokens[viewerIdx]).trim() : "";
        const vm = getViewerMap(viewerIdx);

        // If organiser hasn't filled availability, treat them as expected unless they explicitly can't attend.
        const isOrganiser = viewerIdx === 0;

        const cantAttend =
          vm && (vm[hostIndex] === true || vm[String(hostIndex)] === true);

        const hasResponded = !!vm;

        const defaultInclude =
          !cantAttend && (hasResponded || isOrganiser) ? true : false;

        const row = {
          viewerIdx,
          token,
          safeName,
          cantAttend: !!cantAttend,
          hasResponded: !!hasResponded,
          defaultInclude,
        };

        if (defaultInclude) expected.push(row);
        else others.push(row);
      }

      if (introEl) {
        introEl.innerHTML = `
          <strong>Finalise:</strong> <span>${safeHost}</span>
          ${
            startLine
              ? `<br><span class="muted" style="font-size:12px;">Scheduled: ${esc(
                  startLine
                )}</span>`
              : ""
          }
        `;
      }

      const missingTokens = expected
        .concat(others)
        .some((r) => !r.token);

      bodyEl.innerHTML = `
        <p class="menu-copy">
          Tick who should be able to vote for <strong>${safeHost}</strong>’s event.
          <br>
          <span class="muted" style="font-size:12px;">
            Pre-selected: people who have responded and did <em>not</em> mark themselves as unable to attend.
            You can override below.
          </span>
        </p>

        <div class="menu-divider" aria-hidden="true"></div>

        <h3 class="menu-h3" style="margin-top:10px;">Expected attendees</h3>
        <div id="expectedList" style="margin-top:8px;"></div>

        <div class="menu-divider" aria-hidden="true"></div>

        <h3 class="menu-h3" style="margin-top:10px;">Others</h3>
        <p class="muted" style="margin-top:4px;font-size:12px;">
          People who said they can’t attend (or haven’t responded yet). Tick to include them anyway.
        </p>
        <div id="othersList" style="margin-top:8px;"></div>

        ${
          missingTokens
            ? `
          <p class="muted" style="margin-top:12px;font-size:12px;">
            <strong>Note:</strong> One or more invite tokens are missing for this Quest. Open “Hosts &amp; links” once to generate tokens before opening voting.
          </p>
            `
            : ""
        }

        <div class="menu-actions" style="margin-top:14px;display:flex;gap:10px;flex-wrap:wrap;">
          <button class="btn btn-secondary" id="backDash">Back</button>
          <button class="btn btn-primary" id="openVotingBtn" ${
            missingTokens ? "disabled" : ""
          }>
            Open ${safeHost} event for voting
          </button>
        </div>

        <p class="muted" style="margin-top:10px;font-size:12px;">
          The host cannot vote for their own event.
        </p>
      `;

      const says = (r) => {
        const labelBits = [];
        if (r.cantAttend) labelBits.push("said they can’t attend");
        if (!r.hasResponded) labelBits.push("no response yet");
        return labelBits.length
          ? ` <span class="muted" style="font-size:11px;">(${esc(
              labelBits.join(", ")
            )})</span>`
          : "";
      };

      const expectedEl = bodyEl.querySelector("#expectedList");
      const othersEl = bodyEl.querySelector("#othersList");

      function rowHtml(r, checked) {
        return `
          <label class="link-pill" style="display:flex;align-items:center;gap:10px;margin:8px 0;">
            <input type="checkbox"
                   class="attendeeCheck"
                   data-token="${esc(r.token)}"
                   data-idx="${r.viewerIdx}"
                   ${checked ? "checked" : ""} />
            <span style="flex:1;">
              ${r.safeName}${says(r)}
            </span>
          </label>
        `;
      }

      if (expectedEl) {
        expectedEl.innerHTML = expected.length
          ? expected.map((r) => rowHtml(r, true)).join("")
          : `<p class="menu-copy">No expected attendees were detected.</p>`;
      }

      if (othersEl) {
        othersEl.innerHTML = others.length
          ? others.map((r) => rowHtml(r, false)).join("")
          : `<p class="menu-copy">No one else to include.</p>`;
      }

      const backBtn = bodyEl.querySelector("#backDash");
      if (backBtn && actions && typeof actions.setState === "function") {
        backBtn.addEventListener("click", () =>
          actions.setState("gameDashboard")
        );
      }

      const openBtn = bodyEl.querySelector("#openVotingBtn");
      if (openBtn) {
        openBtn.addEventListener("click", async () => {
          try {
            const checks = bodyEl.querySelectorAll(".attendeeCheck");
            const eligibleTokens = {};

            checks.forEach((cb) => {
              if (!cb || !cb.checked) return;
              const tok = cb.getAttribute("data-token");
              if (!tok) return;
              eligibleTokens[String(tok).trim()] = true;
            });

            // IMPORTANT: Host cannot vote for their own event.
            const hostTok = tokens[hostIndex]
              ? String(tokens[hostIndex]).trim()
              : "";
            if (hostTok && eligibleTokens[hostTok]) {
              delete eligibleTokens[hostTok];
            }

            await updateGame(gameId, {
              voting: {
                open: true,
                hostIndex,
                eligibleTokens,
                openedAt: new Date().toISOString(),
              },
            });
            if (cancelled) return;

            window.alert(`Voting is now open for ${hostName}.`);
            if (actions && typeof actions.setState === "function") {
              actions.setState("gameDashboard");
            }
          } catch (err) {
            console.warn("[FinaliseEventScreen] Open voting failed", err);
            window.alert(
              "Sorry — we couldn’t open voting just now. Please try again."
            );
          }
        });
      }
    } catch (err) {
      console.error("[FinaliseEventScreen] Failed to load", err);
      if (cancelled) return;
      if (introEl)
        introEl.textContent =
          "Something went wrong while preparing the finalise screen.";
      if (bodyEl) {
        bodyEl.innerHTML = `
          <p class="menu-copy">
            Please refresh the page or return to the dashboard and try again.
          </p>
        `;
      }
    }
  })();

  return cleanup;
}
