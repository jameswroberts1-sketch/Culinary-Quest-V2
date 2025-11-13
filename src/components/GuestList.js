// components/GuestList.js
import React, { useState } from 'https://esm.sh/react';

export default function GuestList({ data, onNext }) {
  const [guests, setGuests] = useState(['']);

  const updateGuest = (i, val) => {
    const updated = [...guests];
    updated[i] = val;
    setGuests(updated);
  };

  const addGuest = () => setGuests([...guests, '']);
  const removeGuest = (i) => setGuests(guests.filter((_, idx) => idx !== i));

  return (
    <div>
      <h2>👥 Add Guests</h2>
      <p>Organiser: <strong>{data.organiser}</strong></p>

      {guests.map((g, i) => (
        <div key={i}>
          <input value={g} onChange={(e) => updateGuest(i, e.target.value)} />
          {i > 0 && <button onClick={() => removeGuest(i)}>Remove</button>}
        </div>
      ))}

      <br />
      <button onClick={addGuest}>+ Add Guest</button><br /><br />
      <button onClick={() => {
        const filtered = guests.map(g => g.trim()).filter(Boolean);
        onNext({ ...data, guests: filtered, status: 'INVITING' });
      }}>
        Continue →
      </button>
    </div>
  );
}
