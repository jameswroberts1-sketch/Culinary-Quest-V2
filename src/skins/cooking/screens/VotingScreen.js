// path: src/skins/cooking/screens/VotingScreen.js
// Guest voting screen (invite-link only).
//
// Requirements:
// - blocks the host from voting
// - supports simple (single) scoring OR category scoring (1–10 ints)
// - saves to Firestore at: votesByEvent.<hostIndex>.<inviteToken>
// - supports a 250-char comment
// - easy organiser tracker: compare voting.eligibleTokens vs votesByEvent[hostIndex]

import { readGame, updateGame } from "../../../engine/firestore.js";

/* ---------------- helpers ---------------- */

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
      document.scrollingElement || document.documentElement || document.body;
    if (scroller && typeof scroller.scrollTo === "function") {
      scroller.scrollTo({ top: 0, left: 0, behavior: "auto" });
    } else if (scroller) {
      scroller.scrollTop = 0;
    }
  } catch (_) {}
}

function normToken(t) {
  return String(t || "").trim().toUpperCase();
}

function tokenListFromGame(game) {
  return Array.isArray(game && game.hostTokens)
    ? game.hostTokens
    : Array.isArray(game && game.tokens)
    ? game.tokens
    : [];
}

function scoringModelFromGame(game) {
  const setup =
    game && game.setup && typeof game.setup === "object" ? game.setup : {};

  const rawMode = String(setup.mode || "").toLowerCase();
  const byCategory = rawMode.includes("categor");

  let categories = Array.isArray(setup.categories) ? setup.categories : [];
  categories = categories.map((c) => String(c || "").trim()).filter(Boolean);

  // IMPORTANT: Food is mandatory and should be first in category mode.
  if (byCategory) {
    categories = ["Food", ...categories.filter((c) => c !== "Food")];
    categories = categories.slice(0, 4);
  } else {
    categories = [];
  }

  return { byCategory, categories };
}

function clampInt(n, min, max) {
  const x = Number(n);
  if (!Number.isFinite(x)) return null;
  const i = Math.round(x);
  if (i < min || i > max) return null;
  return i;
}

function getEventVotes(game, hostIndex) {
  const votesByEvent =
    game && game.votesByEvent && typeof game.votesByEvent === "object"
      ? game.votesByEvent
      : {};
  const ev =
    votesByEvent[hostIndex] || votesByEvent[String(hostIndex)] || {};
  return ev && typeof ev === "object" ? ev : {};
}

function countEligibleAndSubmitted(eligibleTokens, eventVotes) {
  const eligible =
    eligibleTokens && typeof eligibleTokens === "object" ? eligibleTokens : {};
  const keys = Object.keys(eligible).filter((k) => eligible[k]);
  const submitted = keys.reduce((acc, k) => acc + (eventVotes[k] ? 1 : 0), 0);
  return { eligibleCount: keys.length, submittedCount: submitted };
}

/* ---------------- screen ---------------- */

export function render(root, model = {}, actions = {}) {
  if (!root) {
    root =
      document.getElementById("cq-main") ||
      document.getElementById("app") ||
      document.body;
  }

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
        <h2 class="menu-h2">VOTING</h2>
        <p class="menu-copy" id="voteIntro">Loading your ballot…</p>
      </section>

      <div class="menu-divider" aria-hidden="true"></div>

      <section class="menu-section" id="voteBody"></section>
    </section>
  `;

  const introEl = root.querySelector("#voteIntro");
  const bodyEl = root.querySelector("#voteBody");

  (async () => {
    try {
      const qs = new URLSearchParams(window.location.search);
      const gameIdRaw = qs.get("game");
      const inviteRaw = qs.get("invite");

      const gameId = String(gameIdRaw || "").trim();
      const inviteTokenRaw = String(inviteRaw || "");
      const inviteToken = normToken(inviteTokenRaw);

      if (!gameId || !inviteToken) {
        if (introEl) {
          introEl.textContent =
            "This voting link is missing game or invite details. Please re-open the invite link you were sent.";
        }
        if (bodyEl) {
          bodyEl.innerHTML = `
            <p class="menu-copy">
              If you’re the organiser, open the game from the hub and re-send the correct invite.
            </p>
          `;
        }
        return;
      }

      const game = await readGame(gameId);
      if (cancelled) return;

      if (!game) {
        if (introEl) introEl.textContent = "We couldn’t find this Culinary Quest.";
        if (bodyEl) {
          bodyEl.innerHTML = `
            <p class="menu-copy">
              Please try opening the invite again, or ask the organiser to re-send it.
            </p>
          `;
        }
        return;
      }

      const hosts = Array.isArray(game.hosts) ? game.hosts : [];
      const tokens = tokenListFromGame(game).map(normToken);
      const viewerIndex = tokens.indexOf(inviteToken);

      if (viewerIndex < 0) {
        if (introEl) introEl.textContent = "This invite token doesn’t match any player in the game.";
        if (bodyEl) {
          bodyEl.innerHTML = `
            <p class="menu-copy">
              Please ask the organiser to re-send your link.
            </p>
          `;
        }
        return;
      }

      const voting =
        game.voting && typeof game.voting === "object" ? game.voting : null;

      if (!voting || !voting.open || !Number.isFinite(Number(voting.hostIndex))) {
        if (introEl) introEl.textContent = "Voting isn’t open yet.";
        if (bodyEl) {
          bodyEl.innerHTML = `
            <p class="menu-copy">
              Head back to the event screen — voting will appear here once the organiser opens it.
            </p>
            <div class="menu-actions" style="margin-top:12px;">
              <button class="btn btn-primary" id="backToEvent">Back to event</button>
            </div>
          `;
          const backBtn = bodyEl.querySelector("#backToEvent");
          if (backBtn && actions && typeof actions.setState === "function") {
            backBtn.addEventListener("click", () => actions.setState("invite"));
          }
        }
        return;
      }

      const hostIndex = Number(voting.hostIndex);
      const hostDoc = hosts[hostIndex] || {};
      const hostName = hostDoc.name || `Host ${hostIndex + 1}`;
      const viewerDoc = hosts[viewerIndex] || {};
      const viewerName = viewerDoc.name || `Guest`;

      if (introEl) {
        introEl.innerHTML = `
          Score <strong>${esc(hostName)}</strong>’s event
          <br><span class="muted" style="font-size:12px;">Your vote is private until the final reveal.</span>
        `;
      }

      const eligibleTokens =
        voting.eligibleTokens && typeof voting.eligibleTokens === "object"
          ? voting.eligibleTokens
          : {};

      const eventVotes = getEventVotes(game, hostIndex);
      const { eligibleCount, submittedCount } = countEligibleAndSubmitted(eligibleTokens, eventVotes);

      // IMPORTANT: Host cannot vote for their own event.
      if (viewerIndex === hostIndex) {
        if (bodyEl) {
          bodyEl.innerHTML = `
            <p class="menu-copy">
              <strong>You can’t vote for your own event.</strong>
              <br><br>
              You’ve hosted — now everyone else gets to leave their feedback.
            </p>

            <div class="menu-divider" aria-hidden="true"></div>

            <p class="menu-copy">
              <strong>Voting progress:</strong> ${submittedCount} / ${eligibleCount} votes received.
            </p>

            <p class="muted" style="margin-top:10px;font-size:12px;">
              When voting closes, you’ll be taken straight to what’s next.
            </p>

            <div class="menu-actions" style="margin-top:12px;">
              <button class="btn btn-primary" id="backToEvent">Back</button>
            </div>
          `;

          const backBtn = bodyEl.querySelector("#backToEvent");
          if (backBtn && actions && typeof actions.setState === "function") {
            backBtn.addEventListener("click", () => actions.setState("invite"));
          }
        }
        return;
      }

      // Not eligible
      if (!eligibleTokens[inviteToken]) {
        if (bodyEl) {
          bodyEl.innerHTML = `
            <p class="menu-copy">
              You’re not currently marked as eligible to vote for this event.
              <br><br>
              If you did attend, ask the organiser to include you when finalising the event.
            </p>

            <div class="menu-actions" style="margin-top:12px;">
              <button class="btn btn-primary" id="backToEvent">Back</button>
            </div>
          `;

          const backBtn = bodyEl.querySelector("#backToEvent");
          if (backBtn && actions && typeof actions.setState === "function") {
            backBtn.addEventListener("click", () => actions.setState("invite"));
          }
        }
        return;
      }

      // Already voted
      if (eventVotes[inviteToken] || eventVotes[inviteTokenRaw]) {
        if (bodyEl) {
          bodyEl.innerHTML = `
            <p class="menu-copy">
              <strong>Your vote is in.</strong>
              <br><br>
              Thanks, ${esc(viewerName)} — you’ve done your bit.
            </p>

            <div class="menu-divider" aria-hidden="true"></div>

            <p class="menu-copy">
              <strong>Voting progress:</strong> ${submittedCount} / ${eligibleCount} votes received.
            </p>

            <p class="muted" style="margin-top:10px;font-size:12px;">
              Results are revealed once voting closes.
            </p>

            <div class="menu-actions" style="margin-top:12px;">
              <button class="btn btn-primary" id="backToEvent">Back</button>
            </div>
          `;

          const backBtn = bodyEl.querySelector("#backToEvent");
          if (backBtn && actions && typeof actions.setState === "function") {
            backBtn.addEventListener("click", () => actions.setState("invite"));
          }
        }
        return;
      }

      const scoring = scoringModelFromGame(game);
      const minScore = 1;
      const maxScore = 10;

      const scoreFieldsHtml = scoring.byCategory
        ? `
          <p class="menu-copy">
            Score each category from <strong>${minScore}</strong> to <strong>${maxScore}</strong>.
          </p>

          <div style="margin-top:10px;">
            ${scoring.categories.map((c, i) => `
              <label class="menu-copy" style="text-align:left;margin-top:${i ? 10 : 0}px;">
                <strong>${esc(c)}</strong>
              </label>
              <input
                class="menu-input vote-score"
                type="number"
                inputmode="numeric"
                min="${minScore}"
                max="${maxScore}"
                step="1"
                data-cat="${esc(c)}"
                placeholder="${minScore}-${maxScore}"
              />
            `).join("")}
          </div>
        `
        : `
          <p class="menu-copy">
            Give one overall score from <strong>${minScore}</strong> to <strong>${maxScore}</strong>.
          </p>

          <label class="menu-copy" style="text-align:left;margin-top:10px;">
            <strong>Overall score</strong>
          </label>
          <input
            id="overallScore"
            class="menu-input"
            type="number"
            inputmode="numeric"
            min="${minScore}"
            max="${maxScore}"
            step="1"
            placeholder="${minScore}-${maxScore}"
          />
        `;

      bodyEl.innerHTML = `
        ${scoreFieldsHtml}

        <div class="menu-divider" aria-hidden="true"></div>

        <label class="menu-copy" for="voteComment" style="text-align:left;margin-top:10px;">
          <strong>Comment</strong> <span class="muted">(optional, max 250 chars)</span>
        </label>
        <textarea
          id="voteComment"
          class="menu-input"
          rows="3"
          maxlength="250"
          placeholder="A quick note for the host…"
        ></textarea>
        <div class="muted" style="text-align:right;font-size:11px;margin-top:4px;">
          <span id="commentCount">0</span>/250
        </div>

        <div class="menu-actions" style="margin-top:14px;">
          <button class="btn btn-primary" id="submitVote">Submit vote</button>
        </div>

        <p class="muted" style="text-align:center;margin-top:10px;font-size:11px;">
          Votes received: ${submittedCount} of ${eligibleCount}
        </p>
      `;

      const commentEl = bodyEl.querySelector("#voteComment");
      const countEl = bodyEl.querySelector("#commentCount");
      if (commentEl && countEl) {
        commentEl.addEventListener("input", () => {
          countEl.textContent = String((commentEl.value || "").length);
        });
      }

      const submitBtn = bodyEl.querySelector("#submitVote");
      if (!submitBtn) return;

      submitBtn.addEventListener("click", async () => {
        try {
          submitBtn.disabled = true;

          let record;

          if (scoring.byCategory) {
            const inputs = bodyEl.querySelectorAll(".vote-score");
            const scores = {};
            let total = 0;

            for (const el of inputs) {
              const cat = el.getAttribute("data-cat") || "";
              const val = clampInt(el.value, minScore, maxScore);
              if (val == null || Math.floor(Number(el.value)) !== Number(el.value)) {
                window.alert(`Please enter a whole number ${minScore}-${maxScore} for every category.`);
                submitBtn.disabled = false;
                return;
              }
              scores[cat] = val;
              total += val;
            }

            record = { mode: "category", scores, total };
          } else {
            const overallEl = bodyEl.querySelector("#overallScore");
            const raw = overallEl ? overallEl.value : "";
            const val = clampInt(raw, minScore, maxScore);
            if (val == null || Math.floor(Number(raw)) !== Number(raw)) {
              window.alert(`Please enter a whole number ${minScore}-${maxScore}.`);
              submitBtn.disabled = false;
              return;
            }
            record = { mode: "simple", score: val };
          }

          let comment = commentEl ? String(commentEl.value || "") : "";
          comment = comment.trim().slice(0, 250);

          const submittedAt = new Date().toISOString();

          // Tracker-friendly fields (no sensitive info)
          record.comment = comment;
          record.submittedAt = submittedAt;
          record.voterToken = inviteToken;
          record.voterIndex = viewerIndex;
          record.voterName = viewerName || null;

          // Store under votesByEvent.<hostIndex>.<inviteToken>
          const field = `votesByEvent.${hostIndex}.${inviteToken}`;
          await updateGame(gameId, { [field]: record });
          if (cancelled) return;

          bodyEl.innerHTML = `
            <p class="menu-copy">
              <strong>Vote submitted.</strong>
              <br><br>
              Thanks, ${esc(viewerName)}.
            </p>

            <p class="muted" style="margin-top:10px;font-size:12px;">
              You won’t see scores until voting closes.
            </p>

            <div class="menu-actions" style="margin-top:12px;">
              <button class="btn btn-primary" id="backToEvent">Back</button>
            </div>
          `;

          const backBtn = bodyEl.querySelector("#backToEvent");
          if (backBtn && actions && typeof actions.setState === "function") {
            backBtn.addEventListener("click", () => actions.setState("invite"));
          }
        } catch (err) {
          console.warn("[VotingScreen] submit failed", err);
          window.alert("Sorry — we couldn’t submit your vote just now. Please try again.");
          submitBtn.disabled = false;
        }
      });
    } catch (err) {
      console.error("[VotingScreen] Failed to load", err);
      if (cancelled) return;
      if (introEl) introEl.textContent = "Something went wrong loading voting.";
      if (bodyEl) bodyEl.innerHTML = `<p class="menu-copy">Please refresh and try again.</p>`;
    }
  })();

  return cleanup;
}
