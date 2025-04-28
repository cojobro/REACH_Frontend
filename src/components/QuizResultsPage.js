import React from 'react';
import './QuizResultsPage.css'; // We'll create this next

function QuizResultsPage({ score, totalQuestions, results }) {
  // results might be an array of objects like:
  // { question: '...', yourAnswer: '...', correctAnswer: '...', explanation: '...' }

  return (
    <div className="screen-container quiz-results-page">
      <div className="results-header">
        <h2>Quiz Complete!</h2>
      </div>

      <div className="results-summary">
        <h3>Summary</h3>
        {/* Placeholder for detailed results - we'll populate this later */}
        {results && results.length > 0 ? (
          results.map((result, index) => (
            <div key={index} className="result-item">
              <p><strong>Question {index + 1}:</strong> {result.question}</p>
              <p>Your Answer: {result.yourAnswer || 'Not Answered'}</p>
              <p>Correct Answer: {result.correctAnswer}</p>
              <p><i>Explanation:</i> {result.explanation || 'Explanation unavailable.'}</p>
            </div>
          ))
        ) : (
          <p>Loading results...</p>
        )}
      </div>

      {/* Optional: Add a button to go back or finish */}
      {/* <button className="button primary-button">Finish</button> */}

    </div>
  );
}

export default QuizResultsPage;
