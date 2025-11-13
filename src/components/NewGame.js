// components/NewGame.js
import React, { useState } from 'https://esm.sh/react';

export default function NewGame({ onNext }) {
  const [eventName, setEventName] = useState('');
  const [organiser, setOrganiser] = useState('');

  return (
    <div>
      <h1>🎉 Create New Competition</h1>

      <label>Event Name</label><br />
      <input value={eventName} onChange={(e) => setEventName(e.target.value)} /><br /><br />

      <label>Your Name (Organiser)</label><br />
      <input value={organiser} onChange={(e) => setOrganiser(e.target.value)} /><br /><br />

      <button
        disabled={!eventName || !organiser}
        onClick={() => {
          onNext({
            gameId: 'cq_' + Math.random().toString(36).slice(2, 8),
            organiser,
            eventName,
            guests: [],
            status: 'DRAFT'
          });
        }}
      >
        Continue →
      </button>
    </div>
  );
}
