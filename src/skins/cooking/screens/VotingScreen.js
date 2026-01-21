// path: src/skins/cooking/screens/VotingScreen.js
// Voting screen – shown to guests when organiser opens voting for the current host.
//
// IMPORTANT: Host cannot vote for their own event.
// IMPORTANT: Organiser normally navigates via hub; voting is for invite-link sessions (or organiser play mode).

import { readGame, updateGame } from "../../../engine/firestore.js";

function esc(str) {
  if (str == null) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getViewerFromInvite(game, inviteToken) {
  if (!inviteToken || !game || !Array.isArray(game.hostTokens)) return { idx: -1 };
  const idx = game.hostTokens.findIndex((t) => String(t) === String(inviteToken));
  return { idx };
}

function getCategories(game) {
  const setup = game && typeof game.setup === "object" ? game.setup : {};
  const mode = String(setup.mode || "simple").toLowerCase(); // "simple" | "category"
  const cats = Array.isArray(setup.categories) ? setup.categories : ["Food"];
  return { mode, cats };
}

export function render(root, model = {}, actions = {}) {
  if (!root) root = document.getElementById("app") || document.body;

  let cancelled = false;
  const cleanup = () => { cancelled = true; };

  const params = new URLSearchParams(window.location.search);
  const inviteToken = params.get("invite");
  const urlGameId = params.get("game");

  // Voting is only meaningful when we can identify the game
  const gameId = urlGameId || model.gameId;

  root.innerHTML = `
    <section class="menu-card">
      <div class="menu-hero">
        <img class="menu-logo" src="./src/skins/cooking/assets/cq-logo.png" alt="Culinary Quest" />
      </div>
      <div class="menu-ornament" aria-hidden="true"></div>

      <section class="menu-section">
        <div class="menu-course">MAIN</div>
        <h2 class="menu-h2">LOADING VOTING…</h2>
        <p class="menu-copy">Just a moment.</p>
      </section>
    </section>
  `;

  (async () => {
    try {
      if (!gameId) {
        root.innerHTML = `
          <section class="menu-card">
            <div class="menu-hero">
              <img class="menu-logo" src="./src/skins/cooking/assets/cq-logo.png" alt="Culinary Quest" />
            </div>
            <div class="menu-ornament" aria-hidden="true"></div>
            <section class="menu-section">
              <div class="menu-course">MAIN</div>
              <h2 class="menu-h2">VOTING LINK NEEDED</h2>
              <p class="menu-copy">
                Please open voting from your invite link.
              </p>
            </section>
          </section>
        `;
        return;
      }

      const game = await readGame(gameId);
      if (cancelled) return;

      if (!game) {
        root.innerHTML = `
          <section class="menu-card">
            <div class="menu-hero">
              <img class="menu-logo" src="./src/skins/cooking/assets/cq-logo.png" alt="Culinary Quest" />
            </div>
            <div class="menu-ornament" aria-hidden="true"></div>
            <section class="menu-section">
              <div class="menu-course">MAIN</div>
              <h2 class="menu-h2">CAN’T FIND THIS GAME</h2>
              <p class="menu-copy">That link doesn’t match an active Culinary Quest.</p>
            </section>
          </section>
        `;
        return;
      }

      const organiserName = (game.organiserName || "").trim() || "the organiser";
      const hosts = Array.isArray(game.hosts) ? game.hosts : [];
      const hostNames = hosts.map((h, i) => (h && h.name ? String(h.name).trim() : `Host ${i + 1}`));
      const viewer = getViewerFromInvite(game, inviteToken);
      const viewerIdx = viewer.idx;

      const voting = game && typeof game.voting === "object" ? game.voting : null;
      const isOpen = !!(voting && voting.open);
      const votingHostIndex = voting && Number.isFinite(Number(voting.hostIndex)) ? Number(voting.hostIndex) : -1;

      // If voting is not open, send guests back to Invite (it will show next event / status)
      if (!isOpen || votingHostIndex < 0) {
        if (actions && typeof actions.setState === "function") {
          actions.setState("invite");
          return;
        }
        root.innerHTML = `
          <section class="menu-card">
            <div class="menu-hero">
              <img class="menu-logo" src="./src/skins/cooking/assets/cq-logo.png" alt="Culinary Quest" />
            </div>
            <div class="menu-ornament" aria-hidden="true"></div>
            <section class="menu-section">
              <div class="menu-course">MAIN</div>
              <h2 class="menu-h2">VOTING ISN’T OPEN YET</h2>
              <p class="menu-copy">Please return to your invite screen.</p>
            </section>
          </section>
        `;
        return;
      }

      const hostName = hostNames[votingHostIndex] || `Host ${votingHostIndex + 1}`;

      // Eligibility (organiser finalises this). MVP expects eligibleTokens map keyed by invite token.
      const eligibleTokens =
        voting && voting.eligibleTokens && typeof voting.eligibleTokens === "object"
          ? voting.eligibleTokens
          : {};

      const eligible = inviteToken ? !!eligibleTokens[String(inviteToken)] : false;

      // Submission check (MVP: votes map keyed by invite token under votesByEvent[hostIndex])
      const votesByEvent =
        game.votesByEvent && typeof game.votesByEvent === "object" ? game.votesByEvent : {};
      const eventVotes =
        votesByEvent[String(votingHostIndex)] && typeof votesByEvent[String(votingHostIndex)] === "object"
          ? votesByEvent[String(votingHostIndex)]
          : {};
      const hasVoted = inviteToken ? !!eventVotes[String(inviteToken)] : false;

      const eligibleCount = Object.keys(eligibleTokens).length;
      const submittedCount = Object.keys(eventVotes).length;

      const { mode, cats } = getCategories(game);

      // Host cannot vote for their own event
      if (viewerIdx === votingHostIndex) {
        root.innerHTML = `
          <section class="menu-card">
            <div class="menu-hero">
              <img class="menu-logo" src="./src/skins/cooking/assets/cq-logo.png" alt="Culinary Quest" />
            </div>
            <div class="menu-ornament" aria-hidden="true"></div>

            <section class="menu-section">
              <div class="menu-course">MAIN</div>
              <h2 class="menu-h2">VOTING IS OPEN</h2>
              <p class="menu-copy">
                It’s your night, so you don’t score your own event — keeps it fair.
              </p>
              <p class="menu-copy">
                Take a breath. You’ve hosted — now everyone else gets to leave their feedback.
              </p>

              <div class="menu-divider" aria-hidden="true"></div>

              <p class="muted" style="text-align:center;">
                Votes received: ${submittedCount} of ${eligibleCount}
              </p>

              <p class="menu-copy" style="margin-top:10px;">
                When voting closes, you’ll be taken straight to what’s next.
              </p>
            </section>
          </section>
        `;
        return;
      }

      // Not eligible → gentle message (organiser controls eligibility on finalise screen)
      if (!eligible) {
        root.innerHTML = `
          <section class="menu-card">
            <div class="menu-hero">
              <img class="menu-logo" src="./src/skins/cooking/assets/cq-logo.png" alt="Culinary Quest" />
            </div>
            <div class="menu-ornament" aria-hidden="true"></div>
            <section class="menu-section">
              <div class="menu-course">MAIN</div>
              <h2 class="menu-h2">VOTING NOT ENABLED</h2>
              <p class="menu-copy">
                ${esc(organiserName)} hasn’t marked you as attending this night.
              </p>
              <p class="menu-copy">
                If that’s not right, ask ${esc(organiserName)} to include you for voting.
              </p>
            </section>
          </section>
        `;
        return;
      }

      // Already voted → thank you panel (no score hints)
      if (hasVoted) {
        root.innerHTML = `
          <section class="menu-card">
            <div class="menu-hero">
              <img class="menu-logo" src="./src/skins/cooking/assets/cq-logo.png" alt="Culinary Quest" />
            </div>
            <div class="menu-ornament" aria-hidden="true"></div>

            <section class="menu-section">
              <div class="menu-course">MAIN</div>
              <h2 class="menu-h2">VOTE RECEIVED</h2>
              <p class="menu-copy">
                Thanks — your vote is in for <strong>${esc(hostName)}</strong>.
              </p>
              <p class="menu-copy">
                We won’t show scores yet — results come once voting closes.
              </p>
              <p class="muted" style="text-align:center;margin-top:10px;">
                Votes received: ${submittedCount} of ${eligibleCount}
              </p>
            </section>
          </section>
        `;
        return;
      }

      // Render vote form
      const catRows =
        mode === "category"
          ? cats.map((c, i) => {
              const safe = esc(c || `Category ${i + 1}`);
              return `
                <label class="menu-copy" style="display:block;margin-top:10px;">
                  <strong>${safe}</strong>
                  <input class="input" type="number" min="1" max="10" step="1"
                    data-cat="${esc(c)}"
                    placeholder="1–10"
                    style="margin-top:6px;width:100%;"
                    />
                </label>
              `;
            }).join("")
          : `
              <label class="menu-copy" style="display:block;margin-top:10px;">
                <strong>Overall score</strong>
                <input class="input" type="number" min="1" max="10" step="1"
                  data-overall="1"
                  placeholder="1–10"
                  style="margin-top:6px;width:100%;"
                />
              </label>
            `;

      root.innerHTML = `
        <section class="menu-card">
          <div class="menu-hero">
            <img class="menu-logo" src="./src/skins/cooking/assets/cq-logo.png" alt="Culinary Quest" />
          </div>
          <div class="menu-ornament" aria-hidden="true"></div>

          <section class="menu-section">
            <div class="menu-course">MAIN</div>
            <h2 class="menu-h2">SCORE ${esc(hostName)}</h2>
            <p class="menu-copy">Score from 1 to 10. Keep it honest. Keep it kind.</p>

            ${catRows}

            <label class="menu-copy" style="display:block;margin-top:12px;">
              <strong>Comment (optional)</strong>
              <textarea class="input" id="voteComment" maxlength="250"
                placeholder="Up to 250 characters…"
                style="margin-top:6px;min-height:90px;width:100%;"></textarea>
              <div class="muted" style="text-align:right;font-size:11px;margin-top:4px;">
                <span id="commentCount">0</span>/250
              </div>
            </label>

            <div class="menu-actions" style="margin-top:14px;">
              <button class="btn btn-primary" id="submitVoteBtn">Submit vote</button>
            </div>
          </section>
        </section>
      `;

      const commentEl = root.querySelector("#voteComment");
      const countEl = root.querySelector("#commentCount");
      if (commentEl && countEl) {
        commentEl.addEventListener("input", () => {
          countEl.textContent = String(commentEl.value.length || 0);
        });
      }

      const btn = root.querySelector("#submitVoteBtn");
      if (!btn) return;

      btn.addEventListener("click", async () => {
        try {
          btn.disabled = true;

          const commentRaw = commentEl ? String(commentEl.value || "") : "";
          const comment = commentRaw.length > 250 ? commentRaw.slice(0, 250) : commentRaw;

          const vote = {
            submittedAt: new Date().toISOString(),
            comment
          };

          if (mode === "category") {
            const inputs = Array.from(root.querySelectorAll("input[data-cat]"));
            const scores = {};
            for (const inp of inputs) {
              const cat = inp.getAttribute("data-cat") || "";
              const v = Number(inp.value);
              if (!Number.isFinite(v) || v < 1 || v > 10) {
                alert("Please score each category from 1 to 10.");
                btn.disabled = false;
                return;
              }
              scores[cat] = v;
            }
            vote.scores = scores;
          } else {
            const inp = root.querySelector("input[data-overall]");
            const v = Number(inp && inp.value);
            if (!Number.isFinite(v) || v < 1 || v > 10) {
              alert("Please enter a score from 1 to 10.");
              btn.disabled = false;
              return;
            }
            vote.score = v;
          }

          if (!inviteToken) {
            alert("This vote link is missing an invite token.");
            btn.disabled = false;
            return;
          }

          // Store under votesByEvent.<hostIndex>.<inviteToken>
          const patch = {
            [`votesByEvent.${String(votingHostIndex)}.${String(inviteToken)}`]: vote
          };

          await updateGame(gameId, patch);
          if (cancelled) return;

          // After submit, re-render via state
          if (actions && typeof actions.setState === "function") {
            actions.setState("voting");
          } else {
            location.reload();
          }
        } catch (err) {
          console.error("[VotingScreen] submit failed", err);
          alert("Sorry — we couldn’t submit your vote. Please try again.");
          btn.disabled = false;
        }
      });
    } catch (err) {
      if (cancelled) return;
      console.error("[VotingScreen] failed", err);
      root.innerHTML = `
        <section class="menu-card">
          <div class="menu-hero">
            <img class="menu-logo" src="./src/skins/cooking/assets/cq-logo.png" alt="Culinary Quest" />
          </div>
          <div class="menu-ornament" aria-hidden="true"></div>
          <section class="menu-section">
            <div class="menu-course">MAIN</div>
            <h2 class="menu-h2">SOMETHING WENT WRONG</h2>
            <p class="menu-copy">Please refresh and try again.</p>
            <p class="muted" style="text-align:center;font-size:11px;">${esc(err && err.message ? err.message : String(err))}</p>
          </section>
        </section>
      `;
    }
  })();

  return cleanup;
}
