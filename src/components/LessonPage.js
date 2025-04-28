import React, { useState, useEffect } from 'react';
import TypewriterMarkdown from './TypewriterMarkdown';

/* component to render a lesson page with navigation and content fetching */
function LessonPage({ lesson, onNext, onBack, isFirst, isLast }) {
  /* state variables to track slide content, loading status, and error messages */
  const [slideContent, setSlideContent] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  /* effect to fetch slide content when lesson changes */
  useEffect(() => {
    if (lesson && lesson.header) {
      const fetchSlideContent = async () => {
        setIsLoading(true);
        setError(null);
        setSlideContent('');
        console.log(`fetching content for: ${lesson.header}`);

        try {
          const response = await fetch('http://localhost:5000/api/generateSlide', {
            method: 'post',
            headers: {
              'content-type': 'application/json',
            },
            body: JSON.stringify({ lessonHeader: lesson.header })
          });

          if (!response.ok) {
            throw new Error(`http error! status: ${response.status}`);
          }

          const data = await response.json();
          console.log("received slide content:", data);
          setSlideContent(data.slideContent || 'no content generated.');

        } catch (err) {
          console.error("failed to fetch slide content:", err);
          setError('failed to load lesson content. please try again later.');
          setSlideContent('');
        } finally {
          setIsLoading(false);
        }
      };

      const timer = setTimeout(() => {
        fetchSlideContent();
      }, 100);

      return () => clearTimeout(timer);
    } else {
      setSlideContent('no lesson selected.');
      setError(null);
      setIsLoading(false);
    }

  }, [lesson]);

  /* render lesson page with navigation and content */
  return (
    <div className="lesson-container">
      <h2>{lesson ? <><i className={lesson.icon}></i> {lesson.header}</> : 'lesson'}</h2>
      <div className="lesson-content-box">
        {isLoading && <div className="spinner-container"><div className="spinner"></div></div>}
        {error && <div className="error">{error}</div>}
        {!isLoading && !error && (
  <div className="lesson-content markdown-content">
    <TypewriterMarkdown 
      content={slideContent} 
      speed={15}
    />
  </div>
)}
      </div>
      <div className="lesson-navigation">
      <button onClick={onBack} disabled={isFirst}>Back</button>
      <button onClick={onNext}>Next</button>
      </div>
    </div>
  );
}

export default LessonPage;
