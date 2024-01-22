import React from "react";
import { Link } from "react-router-dom";
import logo from "../../assets/MyLogo.png";
import styles from "./Loading.module.css";
import "./Loading.css";

const Loading: React.FC = () => {
    return (
        <div className="loading-container">
            <header>
                <img src={logo} alt="Logo" className="logo" /> 
                <h1 className={styles.TitleLogo}>Intelligent Multi-modal Document Interrogation</h1>
            </header>
            <main>
                <nav className="navigation-options">
                    <Link to="/chat" className="nav-option">
                        Chatbot
                    </Link>
                    <Link to="/rubric" className="nav-option">
                        Rubric
                    </Link>
                </nav>
            </main>
        </div>
    );
};

export default Loading;
