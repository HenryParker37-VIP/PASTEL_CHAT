import React, { useEffect, useState, useRef } from 'react';

// Loops through `words`, typing and deleting each smoothly.
const TypewriterText = ({
  words = ['Hello', 'Welcome'],
  typingSpeed = 90,
  deletingSpeed = 50,
  holdTime = 1400,
  className = ''
}) => {
  const [text, setText] = useState('');
  const [wordIdx, setWordIdx] = useState(0);
  const [phase, setPhase] = useState('typing'); // typing | holding | deleting
  const timerRef = useRef(null);

  useEffect(() => {
    const current = words[wordIdx % words.length];

    if (phase === 'typing') {
      if (text.length < current.length) {
        timerRef.current = setTimeout(
          () => setText(current.slice(0, text.length + 1)),
          typingSpeed
        );
      } else {
        timerRef.current = setTimeout(() => setPhase('deleting'), holdTime);
      }
    } else if (phase === 'deleting') {
      if (text.length > 0) {
        timerRef.current = setTimeout(
          () => setText(current.slice(0, text.length - 1)),
          deletingSpeed
        );
      } else {
        setWordIdx((i) => i + 1);
        setPhase('typing');
      }
    }

    return () => clearTimeout(timerRef.current);
  }, [text, phase, wordIdx, words, typingSpeed, deletingSpeed, holdTime]);

  return (
    <span className={className}>
      {text}
      <span className="caret" />
    </span>
  );
};

export default TypewriterText;
