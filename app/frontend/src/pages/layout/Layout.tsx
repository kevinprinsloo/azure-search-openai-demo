import { useState } from "react";
import { Outlet, NavLink, Link } from "react-router-dom";

import styles from "./Layout.module.css";

import { useLogin } from "../../authConfig";

import { LoginButton } from "../../components/LoginButton";

import logo from "../../assets/MyLogo.png";

const Layout = () => {
    const [showUploadModal, setShowUploadModal] = useState(false);

    const [selectedFile, setSelectedFile] = useState<File | null>(null);

    const processFile = (file: File) => {
        setSelectedFile(file);
    };

    return (
        <div className={styles.layout}>
            <header className={styles.header} role={"banner"}>
                <div className={styles.headerTop}>
                    <div className={styles.headerContainer}>
                        <div className={styles.logoContainer}>
                            <img src={logo} alt="Logo" className={styles.logo} />
                            <h1 className={styles.title}>Intelligent Document Interrogation</h1>
                        </div>
                        <nav>
                            <ul className={styles.headerNavList}>
                                <li>
                                    <NavLink to="/" className={({ isActive }) => (isActive ? styles.headerNavPageLinkActive : styles.headerNavPageLink)}>
                                        Home
                                    </NavLink>
                                </li>
                                <li className={styles.headerNavLeftMargin}>
                                    <NavLink to="/qa" className={({ isActive }) => (isActive ? styles.headerNavPageLinkActive : styles.headerNavPageLink)}>
                                        Ask a question
                                    </NavLink>
                                </li>
                                <li className={styles.headerNavLeftMargin}>
                                    <NavLink to="/rubric" className={({ isActive }) => (isActive ? styles.headerNavPageLinkActive : styles.headerNavPageLink)}>
                                        Critria Evaluation
                                    </NavLink>
                                </li>
                            </ul>
                        </nav>
                        <h4 className={styles.headerRightText}>Login </h4>
                        {useLogin && <LoginButton />}
                    </div>
                </div>
                <div className={styles.headerBottom}></div>
            </header>
            <Outlet />
        </div>
    );
};

export default Layout;
