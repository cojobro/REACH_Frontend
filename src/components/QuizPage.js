import React, { useState } from 'react';
import './QuizPage.css'; 

// Accept props: quizQuestions, onQuizComplete, onBack
function QuizPage({ quizQuestions, onQuizComplete, onBack }) {
  // State to keep track of selected answers { questionId: selectedChoice }
  const [selectedAnswers, setSelectedAnswers] = useState({});
  // State to track the current question index
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);

  // Get the current question object
  const currentQuestion = quizQuestions[currentQuestionIndex];

  // Function to handle answer selection
  const handleAnswerSelect = (questionId, choice) => {
    setSelectedAnswers(prevAnswers => ({
      ...prevAnswers,
      [questionId]: choice
    }));
  };

  // Function to go to the previous question
  const handlePreviousQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(prevIndex => prevIndex - 1);
    }
  };

  // New handler for the main back navigation logic
  const handleBackNavigation = () => {
    if (currentQuestionIndex === 0) {
      onBack(); // Navigate back to the previous screen (PostLessonScreen)
    } else {
      handlePreviousQuestion(); // Go to the previous quiz question
    }
  };

  // Function to go to the next question
  const handleNextQuestion = () => {
    if (currentQuestionIndex < quizQuestions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    }
    // else: Handle quiz submission on the last question (later)
  };

  // Function to handle quiz submission
  const handleSubmitQuiz = () => {
    // 1. Calculate score
    let score = 0;
    quizQuestions.forEach(q => {
      if (selectedAnswers[q.id] === q.correctAnswer) {
        score++;
      }
    });

    // 2. Format results data
    const results = quizQuestions.map(q => ({
      question: q.question,
      yourAnswer: selectedAnswers[q.id] || null, // Mark unanswered if needed
      correctAnswer: q.correctAnswer,
      explanation: q.explanation || 'Explanation not available.' // Include explanation
    }));

    // 3. Call the completion handler passed from App.js
    onQuizComplete(score, results);
  };

  return (
    <>
      
    <div className="screen-container quiz-page">
      
      

      <div className="quiz-header">
        <h2>{`Quiz Question ${currentQuestionIndex + 1}`}</h2>
      </div>

      <div className="quiz-questions-container">
        {currentQuestion && (
          <div key={currentQuestion.id} className="question-container">
            <p className="question-text">{`${currentQuestionIndex + 1}. ${currentQuestion.question}`}</p>
           
            <div className="options-container">
              {currentQuestion.choices.map((choice, choiceIndex) => (
                <label key={choiceIndex} className="option-label">
                  <input 
                    type="radio" 
                    name={`question-${currentQuestion.id}`} 
                    value={choice}
                    checked={selectedAnswers[currentQuestion.id] === choice}
                    onChange={() => handleAnswerSelect(currentQuestion.id, choice)}
                    className="option-radio"
                  />
                  {choice}
                </label>
              ))}
            </div>
          </div>
        )}
      </div>
      
      {/* Navigation Buttons */}
      <div className="quiz-navigation">
        <button 
          onClick={handleBackNavigation} 
          className="button secondary-button"
        >
          Back
        </button>
        {currentQuestionIndex < quizQuestions.length - 1 ? (
          <button 
            onClick={handleNextQuestion} 
            disabled={!selectedAnswers[currentQuestion.id]} 
            className="button primary-button"
          >
            Next
          </button>
        ) : (
          <button 
            onClick={handleSubmitQuiz} 
            // disabled={!selectedAnswers[currentQuestion.id]} // Optional: Disable if no answer selected
            className="button primary-button"
          >
            Submit Quiz
          </button>
        )}
      </div>
    </div>
    </>
  );
}

export default QuizPage;
