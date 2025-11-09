import React from 'react';
import './ChatBubble.css';

function ChatBubble({ message, position = 'right' }) {
  return (
    <div className={`chat-bubble ${position}`}>
      <div className="chat-bubble-content">
        <p>{message}</p>
      </div>
      <div className="chat-bubble-tail"></div>
    </div>
  );
}

export default ChatBubble;

