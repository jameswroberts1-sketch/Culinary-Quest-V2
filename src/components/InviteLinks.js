// components/InviteLinks.js
import React from 'https://esm.sh/react';

export default function InviteLinks({ data }) {
  if (!data || !data.guests || !data.organiser) {
    return <p>⚠️ Invalid event data. Please go back and create an event.</p>;
  }

  const base = window.location.origin + window.location.pathname;

  const links = [data.organiser, ...data.guests].map((name, i) => ({
    name,
    url: `${base}?game=${data.gameId}&c=${i}`
  }));

  return (
    <div>
      <h2>🔗 Guest Invite Links</h2>
      <p>Share these links to invite guests</p>

      <ul>
        {links.map((l, i) => (
          <li key={i}>
            <strong>{l.name}</strong>: <code>{l.url}</code>
          </li>
        ))}
      </ul>

      <p><strong>Game ID:</strong> {data.gameId}</p>
      <p><strong>Status:</strong> {data.status}</p>
    </div>
  );
}
