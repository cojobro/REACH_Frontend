import React from 'react';
import './LessonProgress.css'; 

function LessonProgress({ current, total }) {
 
  const currentLessonNumber = current + 1;
  
  return (
    <div className="lesson-progress-dashboard">
      Lesson {currentLessonNumber} of {total}
    </div>
  );
}

export default LessonProgress;
