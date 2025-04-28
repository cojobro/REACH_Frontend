import React from 'react';

/* component displayed after the last lesson, offering next steps */
function PostLessonScreen({ onSelectChatbot, onSelectQuiz, onBack }) {
  return (
    <>
      <button onClick={onBack} className="back-button top-left-back">
        Back to Lessons
      </button>
      <div className="screen-container post-lesson-screen">
        <h2>You've completed the lessons.</h2>
        <p>What would you like to do next?</p>
        <div className="post-lesson-options">
          <button onClick={onSelectChatbot} className="big-button">
            Chatbot
          </button>
          <button onClick={onSelectQuiz} className="big-button">
            Quiz
          </button>
        </div>
      </div>
    </>
  );
}

export default PostLessonScreen;
