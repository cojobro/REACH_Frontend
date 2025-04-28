import React from 'react';

function WelcomeScreen({ onBegin }) {
  return (
    <div className="screen-container">
      <div className="welcome-icon">
        <i className="fas fa-hands-holding-child"></i>
      </div>
      <h1>Welcome to R.E.A.C.H.</h1>
      <button onClick={onBegin}>Begin</button>
    </div>
  );
}

export default WelcomeScreen;
