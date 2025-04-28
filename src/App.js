import React, { useState } from 'react';
import './App.css';
import WelcomeScreen from './components/WelcomeScreen';
import NameInputScreen from './components/NameInputScreen';
import IntroductionScreen from './components/IntroductionScreen';
import LessonPage from './components/LessonPage';
import LessonProgress from './components/LessonProgress';
import PostLessonScreen from './components/PostLessonScreen';
import ChatBot from './components/ChatBot';
import QuizPage from './components/QuizPage';
import QuizResultsPage from './components/QuizResultsPage';
import lessons from './var/lessons';

/* constants for different steps in the app */
const STEP_WELCOME = 0;
const STEP_NAME_INPUT = 1;
const STEP_INTRODUCTION = 2;
const STEP_LESSONS = 3;
const STEP_POST_LESSON = 4;
const STEP_CHATBOT = 5;
const STEP_QUIZ = 6;
const STEP_QUIZ_RESULTS = 7;

/* main app component */
function App() {
  /* state variables for current step, user name, and lesson index */
  const [currentStep, setCurrentStep] = useState(STEP_WELCOME);
  const [userName, setUserName] = useState('');
  const [currentLessonIndex, setCurrentLessonIndex] = useState(0);
  const [quizScore, setQuizScore] = useState(null);
  const [quizResultsData, setQuizResultsData] = useState([]);

  /* handler to begin the app */
  const handleBegin = () => {
    setCurrentStep(STEP_NAME_INPUT);
  };

  /* handler for name submission */
  const handleNameSubmit = (name) => {
    setUserName(name);
    setCurrentStep(STEP_INTRODUCTION);
  };

  /* handler to start lessons */
  const handleStartLessons = () => {
    setCurrentStep(STEP_LESSONS);
  };

  /* handler to go to the next lesson or the post-lesson screen */
  const handleNextLesson = () => {
    if (currentLessonIndex < lessons.length - 1) {
      setCurrentLessonIndex(currentLessonIndex + 1);
    } else {
      setCurrentStep(STEP_POST_LESSON);
    }
  };

  /* handler to go to the previous lesson */
  const handlePreviousLesson = () => {
    if (currentLessonIndex > 0) {
      setCurrentLessonIndex(currentLessonIndex - 1);
    }
  };

  /* handler to go back from post-lesson to the last lesson */
  const handleBackFromPostLesson = () => {
    setCurrentLessonIndex(lessons.length - 1); // Ensure we are on the last lesson index
    setCurrentStep(STEP_LESSONS);
  };

  /* handler for selecting the chatbot */
  const handleSelectChatbot = () => {
    console.log('chatbot selected');
    setCurrentStep(STEP_CHATBOT);
  };

  /* handler for selecting the quiz */
  const handleSelectQuiz = () => {
    console.log('quiz selected');
    setCurrentStep(STEP_QUIZ);
  };

  /* handler to go back from quiz to post-lesson */
  const handleBackFromQuiz = () => {
    setCurrentStep(STEP_POST_LESSON);
  };

  /* handler to go back from chatbot to post-lesson */
  const handleBackFromChatbot = () => {
    setCurrentStep(STEP_POST_LESSON);
  };

  /* handler for quiz submission */
  const handleQuizComplete = (score, results) => {
    setQuizScore(score);
    setQuizResultsData(results);
    setCurrentStep(STEP_QUIZ_RESULTS);
  };

  // Placeholder quiz questions - move or import from elsewhere if needed
  const quizQuestions = [
    {
      id: 1,
      question: "Question 1",
      choices: [
        "Answer 1.1",
        "Answer 1.2",
        "Answer 1.3",
        "Answer 1.4"
      ],
      correctAnswer: "Answer 1.2",
      explanation: "Explanation for Question 1. Correct answer is Answer 1.2."
    },
    {
      id: 2,
      question: "Question 2",
      choices: [
        "Answer 2.1",
        "Answer 2.2",
        "Answer 2.3",
        "Answer 2.4"
      ],
      correctAnswer: "Answer 2.3",
      explanation: "Explanation for Question 2. Correct answer is Answer 2.3."
    },
    {
      id: 3,
      question: "Question 3",
      choices: [
        "Answer 3.1",
        "Answer 3.2",
        "Answer 3.3",
        "Answer 3.4"
      ],
      correctAnswer: "Answer 3.1",
      explanation: "Explanation for Question 3. Correct answer is Answer 3.1."
    }
  ];

  /* render the app based on the current step */
  return (
    <div className={`App ${currentStep >= STEP_LESSONS && currentStep !== STEP_CHATBOT && currentStep !== STEP_QUIZ && currentStep !== STEP_QUIZ_RESULTS ? 'lesson-view' : ''}`}>
      {currentStep === STEP_WELCOME && (
        <WelcomeScreen onBegin={handleBegin} />
      )}
      {currentStep === STEP_NAME_INPUT && (
        <NameInputScreen onSubmit={handleNameSubmit} />
      )}
      {currentStep === STEP_INTRODUCTION && (
        <IntroductionScreen 
          userName={userName} 
          onStartLessons={handleStartLessons} 
        />
      )}
      {currentStep === STEP_LESSONS && (
        <LessonPage 
          lesson={lessons[currentLessonIndex]}
          onNext={handleNextLesson}
          onBack={handlePreviousLesson}
          isFirst={currentLessonIndex === 0}
          isLast={currentLessonIndex === lessons.length - 1}
        />
      )}
      {currentStep === STEP_POST_LESSON && (
        <PostLessonScreen 
          onSelectChatbot={handleSelectChatbot}
          onSelectQuiz={handleSelectQuiz}
          onBack={handleBackFromPostLesson} // Pass back handler
        />
      )}
      {currentStep === STEP_CHATBOT && (
        <ChatBot 
          onBack={handleBackFromChatbot} // Pass back handler
        />
      )}
      {currentStep === STEP_QUIZ && (
        <QuizPage 
          quizQuestions={quizQuestions}
          onQuizComplete={handleQuizComplete} 
          onBack={handleBackFromQuiz} // Pass back handler
        />
      )}
      {currentStep === STEP_QUIZ_RESULTS && (
        <QuizResultsPage 
          score={quizScore} 
          totalQuestions={3} 
          results={quizResultsData} 
        />
      )}
      {/* render progress bar only during lessons */}
      {currentStep === STEP_LESSONS && (
        <LessonProgress 
          current={currentLessonIndex}
          total={lessons.length} 
        />
      )}
    </div>
  );
}

export default App;
