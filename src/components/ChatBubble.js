import React from 'react';
import './ChatBubble.css';

function ChatBubble({ message, position = 'left' }) {
  return (
    <div className={`chat-bubble ${position}`}>
      <div className="chat-bubble-content">
        <p>{message}</p>
      </div>
      <div className="chat-bubble-arrow"></div>
    </div>
  );
}

export default ChatBubble;

