import React, { useState } from 'react';

function NameInputScreen({ onSubmit }) {
  const [name, setName] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (name.trim()) {
      onSubmit(name.trim());
    }
  };

  return (
    <div className="screen-container">
      <h2>Before we get started, enter your name</h2>
      <form onSubmit={handleSubmit}>
        <input 
          type="text" 
          value={name} 
          onChange={(e) => setName(e.target.value)} 
          placeholder="Enter your name"
        />
        <button type="submit">Submit</button>
      </form>
    </div>
  );
}

export default NameInputScreen;
