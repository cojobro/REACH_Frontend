import React from 'react';

function IntroductionScreen({ userName, onStartLessons }) {
  return (
    <div className="screen-container introduction-screen">
      <div className="intro-icon">
        <i className="fas fa-book-open"></i>
      </div>
      <h1>Welcome, {userName}</h1>
      <p>This application is designed to provide information and support for parents of children undergoing cancer treatment.</p>
      <p>You'll go through a series of short lessons covering important topics. You can navigate back and forth using the buttons provided.</p>
      <button onClick={onStartLessons}>Start Learning</button>
    </div>
  );
}

export default IntroductionScreen;
