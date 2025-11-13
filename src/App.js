// App.js
import React, { useState } from 'https://esm.sh/react';
import ReactDOM from 'https://esm.sh/react-dom/client';

import NewGame from './components/NewGame.js';
import GuestList from './components/GuestList.js';
import InviteLinks from './components/InviteLinks.js';

function App() {
  console.log("🔍 App loaded");

  const [step, setStep] = useState(0);
  const [eventData, setEventData] = useState(null);

  return (
    <div style={{ padding: '2rem', fontFamily: 'system-ui' }}>
      <p>🧪 App is rendering</p>

      {step === 0 && (
        <NewGame
          onNext={(data) => {
            setEventData(data);
            setStep(1);
          }}
        />
      )}

      {step === 1 && (
        <GuestList
          data={eventData}
          onNext={(data) => {
            setEventData(data);
            setStep(2);
          }}
        />
      )}

      {step === 2 && <InviteLinks data={eventData} />}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
