// path: src/skins/cooking/screens/LinksScreen.js
// Organiser view – generates and displays per-host invite links.

import { readGame, updateGame } from "../../../engine/firestore.js";

const HOSTS_STORAGE_KEY   = "cq_hosts_v1";
const CURRENT_GAME_KEY    = "cq_current_game_id_v1";

// ----------------- helpers -----------------

function esc(str) {
  if (str == null) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Local hosts cache (used during organiser flow)
function hydrateHostsLocal(model = {}) {
  let hosts = [];

  if (Array.isArray(model.hosts) && model.hosts.length) {
    hosts = model.hosts.map((h) => ({
      name: h && typeof h.name === "string" ? h.name : ""
    }));
  }

  try {
    const raw = window.localStorage.getItem(HOSTS_STORAGE_KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      if (Array.isArray(saved) && saved.length) {
        saved.forEach((entry, idx) => {
          if (!hosts[idx]) hosts[idx] = { name: "" };
          if (entry && typeof entry.name === "string" && entry.name.trim()) {
            hosts[idx].name = entry.name;
          }
        });
      }
    }
  } catch (_) {}

  if (!hosts[0]) hosts[0] = { name: "" };
  return hosts;
}

function scrollToTop() {
  try {
    const scroller =
      document.scrollingElement ||
      document.documentElement ||
      document.body;
    if (scroller && typeof scroller.scrollTo === "function") {
      scroller.scrollTo({ top: 0, left: 0, behavior: "auto" });
    } else {
      scroller.scrollTop = 0;
      scroller.scrollLeft = 0;
    }
  } catch (_) {}
}

// Simple 10-char upper-case token
function generateToken() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 10; i++) {
    const idx = Math.floor(Math.random() * alphabet.length);
    out += alphabet[idx];
  }
  return out;
}

function buildBaseUrl() {
  // Keeps the current path (important for GitHub Pages)
  const { origin, pathname } = window.location;
  return origin + pathname;
}

function buildInvitePayload(organiserName, hostName, link) {
  const organiser =
    organiserName && String(organiserName).trim()
      ? String(organiserName).trim()
      : "the organiser";

  const host =
    hostName && String(hostName).trim()
      ? String(hostName).trim()
      : "there";

  // Plain text: works everywhere (Share Sheet, SMS, WhatsApp, etc.)
  const text =
`Hi ${host} — ${organiser} requests the pleasure of your company at a Culinary Quest.

Your private link:
${link}`;

  // HTML: pastes nicely into Outlook/Gmail/Slack etc. (where supported)
  const safeOrg = esc(organiser);
  const safeHost = esc(host);
  const safeLink = esc(link);

  const html =
`<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;line-height:1.35;">
  <div style="display:inline-block;padding:10px 14px;border-radius:999px;background:#f2f2f2;color:#111;">
    <strong>${safeOrg}</strong> requests the pleasure of <strong>${safeHost}</strong> to attend a <strong>Culinary Quest</strong>.
  </div>
  <div style="margin-top:10px;">
    <a href="${safeLink}" style="display:inline-block;padding:10px 14px;border-radius:12px;background:#111;color:#fff;text-decoration:none;">
      Open your private link
    </a>
  </div>
  <div style="margin-top:8px;font-size:12px;color:#666;">${safeLink}</div>
</div>`;

  return { text, html };
}

// ----------------- shell -----------------

function renderShell(root) {
  root.innerHTML = `
    <section class="menu-card">
      <div class="menu-hero">
        <img
          class="menu-logo"
          src="./src/skins/cooking/assets/cq-logo.png"
          alt="Culinary Quest"
        />
      </div>

      <div class="menu-ornament" aria-hidden="true"></div>

      <!-- ENTREE -->
      <section class="menu-section">
        <div class="menu-course">ENTRÉE</div>
        <h2 class="menu-h2">HOST INVITE LINKS</h2>
        <p class="menu-copy" id="linksIntro">
          One last step, then you’re ready to invite your hosts.
          We’ll generate a private link for each person in your Quest.
        </p>
      </section>

      <div class="menu-divider" aria-hidden="true"></div>

      <!-- MAIN -->
      <section class="menu-section">
        <div class="menu-course">MAIN</div>
        <h2 class="menu-h2">SHARE THESE LINKS</h2>
        <p class="menu-copy">
          Send each host <strong>their</strong> link only. Each link is unique to that person.
        </p>

        <div id="linksList">
          <p class="menu-copy">Preparing your links…</p>
        </div>
      </section>

      <div class="menu-ornament" aria-hidden="true"></div>

      <!-- FOOTER BUTTONS -->
      <p class="muted" id="linksSummary"
         style="text-align:center;margin-top:8px;font-size:11px;">
      </p>

      <p class="muted" style="text-align:center;margin-top:4px;font-size:11px;">
        LinksScreen – per-host invite URLs
      </p>
    </section>
  `;
}

// ----------------- main render -----------------

export function render(root, model = {}, actions = {}) {
  let cancelled = false;
  const cleanup = () => { cancelled = true; };

  if (!root) {
    root = document.getElementById("app") || document.body;
  }

  scrollToTop();
  renderShell(root);

  const introEl   = root.querySelector("#linksIntro");
  const listEl    = root.querySelector("#linksList");
  const summaryEl = root.querySelector("#linksSummary");

  // Work out gameId
  let gameId =
    (model && typeof model.gameId === "string" && model.gameId.trim()) || null;

  if (!gameId) {
    try {
      const stored = window.localStorage.getItem(CURRENT_GAME_KEY);
      if (stored && stored.trim()) gameId = stored.trim();
    } catch (_) {}
  }
  const effectiveGameId = gameId;

  if (!gameId) {
    if (introEl) {
      introEl.textContent =
        "We couldn’t find your game details. Please go back and complete the setup first.";
    }
    if (listEl) {
      listEl.innerHTML = `
        <p class="menu-copy">
          Once you’ve finished setting up your Quest, you’ll see a unique invite link
          for each host here.
        </p>
      `;
    }
    return cleanup;
  }

  (async () => {
    try {
      if (introEl) {
        introEl.textContent = "Loading your game and preparing invite links…";
      }

      const localHosts = hydrateHostsLocal(model);
      const game = await readGame(effectiveGameId);
      if (cancelled) return;

      if (!game) {
        console.warn("[LinksScreen] No such game:", effectiveGameId);
        if (introEl) {
          introEl.textContent = "We couldn’t load this game from the cloud.";
        }
        if (listEl) {
          listEl.innerHTML = `
            <p class="menu-copy">
              Please check your connection, then go back and try generating your links again.
            </p>
          `;
        }
        return;
      }

      const docHosts = Array.isArray(game.hosts) ? game.hosts : [];
      const hosts = docHosts.length ? docHosts : localHosts;
      const organiserName =
        (game.organiserName && String(game.organiserName)) ||
        (hosts[0] && hosts[0].name) ||
        (localHosts[0] && localHosts[0].name) ||
        "the organiser";

      if (!hosts.length) {
        if (introEl) {
          introEl.textContent =
            "We couldn’t find any hosts for this game.";
        }
        if (listEl) {
          listEl.innerHTML = `
            <p class="menu-copy">
              Please go back and add your hosts before generating invite links.
            </p>
          `;
        }
        return;
      }

      // Build / repair token array
      let tokens = Array.isArray(game.hostTokens)
        ? [...game.hostTokens]
        : Array.isArray(game.tokens)
        ? [...game.tokens]
        : [];

      let changed = false;
      for (let i = 0; i < hosts.length; i++) {
        if (!tokens[i] || typeof tokens[i] !== "string") {
          tokens[i] = generateToken();
          changed = true;
        }
      }

      if (changed) {
        // Store in new field; keep old "tokens" for backwards-compat just in case.
        await updateGame(effectiveGameId, {
          hostTokens: tokens,
          tokens: tokens
        });
        if (cancelled) return;
      }

      const baseUrl = buildBaseUrl();

      // Build rows for all hosts, then EXCLUDE organiser (index 0) from visible invite links.
      const allRows = hosts.map((host, idx) => {
        const rawName =
          host && typeof host.name === "string" && host.name.trim()
            ? host.name.trim()
            : "";
        const token = tokens[idx];
        const link = `${baseUrl}?game=${encodeURIComponent(
          effectiveGameId
        )}&invite=${encodeURIComponent(token)}`;

        return { idx, name: rawName, link };
      });

      // IMPORTANT: organiser (idx 0) uses the hub and does not need an invite link.
      const rows = allRows
        .filter((row) => row.idx !== 0)
        .map((row, i) => ({
          ...row,
          name: row.name || `Host ${i + 1}` // renumber fallbacks so first guest host is "Host 1"
        }));


      if (introEl) {
        introEl.innerHTML = `
          Okay <strong>${esc(
            organiserName
          )}</strong>, here are the private invite links for your Quest.
          Send each host their own link only – it’s how we keep everyone’s RSVP separate.
        `;
      }

if (listEl) {
  if (!rows.length) {
    listEl.innerHTML = `
      <p class="menu-copy">
        You don’t have any host links to share yet. Go back and add at least one host.
      </p>
    `;
  } else {
    const hint = navigator.share ? "Tap to send" : "Tap to email";
    listEl.innerHTML = `
      <div class="link-pill-list">
        ${rows
          .map(
            (row) => `
          <button
            class="link-pill"
            type="button"
            data-link="${esc(row.link)}"
            data-name="${esc(row.name)}"
          >
            <span class="link-pill-name">${esc(row.name)}</span>
            <span class="link-pill-hint">${hint}</span>
          </button>
        `
          )
          .join("")}
      </div>
    `;
  }
}

// Per-host pill handler: Share Sheet if available, else mailto, else copy
if (listEl) {
  const pillButtons = listEl.querySelectorAll(".link-pill");

  pillButtons.forEach((btn) => {
    btn.addEventListener("click", async () => {
      const link = btn.getAttribute("data-link");
      const name = btn.getAttribute("data-name") || "this host";
      if (!link) return;

      const org =
        organiserName && String(organiserName).trim()
          ? String(organiserName).trim()
          : "the organiser";

      const baseText = `Hi ${name} — ${org} requests the pleasure of your company at a Culinary Quest.`;
      const messageText = `${baseText}\n\n${link}`;

      // 1) Share Sheet (best on mobile). Prefer sharing a proper URL field.
      if (navigator.share) {
        try {
          const shareData = {
            title: "Culinary Quest invite",
            text: baseText,
            url: link,
          };

          // navigator.canShare can throw in some browsers; keep it safely wrapped.
          if (navigator.canShare) {
            let ok = true;
            try {
              ok = navigator.canShare(shareData);
            } catch (_) {
              ok = true; // if canShare is flaky, just try share()
            }
            if (!ok) {
              delete shareData.url;
              shareData.text = messageText;
            }
          }

          await navigator.share(shareData);
        } catch (err) {
          // IMPORTANT: Some targets (notably some Mail clients) can still open
          // but then report an error. Do NOT fall back to copy/paste.
          console.warn("[LinksScreen] Share returned an error; stopping.", err);
        }
        return;
      }

      // 2) Desktop fallback: open a pre-filled email (no copy/paste)
      try {
        const subject = encodeURIComponent("Culinary Quest invite");
        const body = encodeURIComponent(messageText);
        window.location.href = `mailto:?subject=${subject}&body=${body}`;
        return;
      } catch (_) {
        // fall through
      }

      // 3) Last resort: copy a clean message (not raw HTML)
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(messageText);
          window.alert(`Invite for ${name} copied. Paste it into your message.`);
        } else {
          window.prompt(`Copy the invite for ${name}:`, messageText);
        }
      } catch (_) {
        window.prompt(`Please copy the invite for ${name}:`, messageText);
      }
    });
  });
}

      if (summaryEl) {
        summaryEl.textContent = `Links ready for ${rows.length} host${
          rows.length === 1 ? "" : "s"
        }.`;
      }
        } catch (err) {
      if (cancelled) return; // ✅ ADD THIS LINE (first line inside catch)

      console.error("[LinksScreen] Failed to prepare links", err);

      if (introEl) {
        introEl.textContent = "Something went wrong while preparing your links.";
      }
      if (listEl) {
        listEl.innerHTML = `
          <p class="menu-copy">
            Please refresh the page or go back and try generating your links again.
          </p>
        `;
      }
    }
  })();
  return cleanup;
}
