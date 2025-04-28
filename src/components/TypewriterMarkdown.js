import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';

/* component that combines reactmarkdown with a typewriter-like reveal effect */
function TypewriterMarkdown({ content, speed = 30 }) {
  /* state and refs for managing content visibility and scroll behavior */
  const [visibleContent, setVisibleContent] = useState('');
  const [isComplete, setIsComplete] = useState(false);
  const timeoutRef = useRef(null);
  const contentRef = useRef(null); // reference to the content container
  const userScrolledRef = useRef(false); // track if user has manually scrolled
  
  /* function to scroll the parent container to the bottom */
  const scrollToBottom = () => {
    // find the parent lesson-content-box
    const parentBox = contentRef.current?.closest('.lesson-content-box');
    if (parentBox && !userScrolledRef.current) {
      // only auto-scroll if user hasn't manually scrolled up
      parentBox.scrollTop = parentBox.scrollHeight;
    }
  };

  /* setup scroll detection */
  useEffect(() => {
    const handleScroll = (e) => {
      const parentBox = contentRef.current?.closest('.lesson-content-box');
      if (parentBox) {
        // if user scrolls up (scroll position isn't at the bottom)
        if (parentBox.scrollHeight - parentBox.scrollTop > parentBox.clientHeight + 50) {
          userScrolledRef.current = true;
        } else {
          // user is at the bottom again
          userScrolledRef.current = false;
        }
      }
    };

    const parentBox = contentRef.current?.closest('.lesson-content-box');
    if (parentBox) {
      parentBox.addEventListener('scroll', handleScroll);
      return () => parentBox.removeEventListener('scroll', handleScroll);
    }
  }, []);
  
  /* effect to handle content updates */
  useEffect(() => {
    // reset when new content is received
    setVisibleContent('');
    setIsComplete(false);
    userScrolledRef.current = false; // reset user scroll state for new content
    
    if (!content) return;
    
    let currentIndex = 0;
    const contentLength = content.length;

    /* function to add the next character */
    const typeNextCharacter = () => {
      if (currentIndex < contentLength) {
        setVisibleContent(prev => prev + content[currentIndex]);
        currentIndex++;
        // schedule scroll after state update
        setTimeout(scrollToBottom, 0);
        // continue typing
        timeoutRef.current = setTimeout(typeNextCharacter, speed);
      } else {
        setIsComplete(true);
        // final scroll to ensure we're at the bottom
        setTimeout(scrollToBottom, 0);
      }
    };
    
    // start the animation
    timeoutRef.current = setTimeout(typeNextCharacter, speed);
    
    // clean up
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [content, speed]);
  
  /* render the markdown content with typewriter effect */
  return (
    <div 
      ref={contentRef}
      className={`typewriter-markdown ${isComplete ? 'complete' : ''}`}
    >
      <ReactMarkdown>{visibleContent}</ReactMarkdown>
    </div>
  );
}

export default TypewriterMarkdown;