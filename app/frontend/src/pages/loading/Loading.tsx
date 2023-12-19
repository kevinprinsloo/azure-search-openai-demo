import React from "react";
import { Link } from "react-router-dom";
import "./Loading.css";

const Loading: React.FC = () => {
  return (
    <div className="loading-container">
      <h1>Welcome please select a feature</h1>
      <div className="navigation-options">
        <Link to="/chat" className="nav-option">
          Chatbot
        </Link>
        <Link to="/rubic" className="nav-option">
          Rubric
        </Link>
      </div>
    </div>
  );
};

export default Loading;
