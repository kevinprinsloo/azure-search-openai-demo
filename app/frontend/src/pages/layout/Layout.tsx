import { useState } from "react";
import { Outlet, NavLink, Link } from "react-router-dom";

import styles from "./Layout.module.css";

import { useLogin } from "../../authConfig";

import { LoginButton } from "../../components/LoginButton";


const Layout = () => {
    const [showUploadModal, setShowUploadModal] = useState(false);

    const [selectedFile, setSelectedFile] = useState<File | null>(null);

    const processFile = (file: File) => {
        setSelectedFile(file);
    };

    const handleUploadClick = async () => {
        if (selectedFile) {
            try {
                const formData = new FormData();
                formData.append("file", selectedFile);

                const response = await fetch("http://localhost:3000/upload", {
                    method: "POST",
                    body: formData
                });

                if (response.ok) {
                    console.log("File uploaded successfully");
                    setShowUploadModal(false);
                } else {
                    console.error("Error uploading file");
                }
            } catch (error) {
                console.error("Error uploading file:", error);
            }
        }
    };

    return (
        <div className={styles.layout}>
            <header className={styles.header} role={"banner"}>
                <div className={styles.headerTop}>
                    <div className={styles.headerContainer}>
                        <Link to="/" className={styles.headerTitleContainer}>
                            <h3 className={styles.headerTitle}>AI on Enterprise data </h3>
                        </Link>
                        <nav>
                            <ul className={styles.headerNavList}>
                                <li>
                                    <NavLink to="/" className={({ isActive }) => (isActive ? styles.headerNavPageLinkActive : styles.headerNavPageLink)}>
                                        Chat
                                    </NavLink>
                                </li>
                                <li className={styles.headerNavLeftMargin}>
                                    <NavLink to="/qa" className={({ isActive }) => (isActive ? styles.headerNavPageLinkActive : styles.headerNavPageLink)}>
                                        Ask a question
                                    </NavLink>
                                </li>
                            </ul>
                        </nav>
                        <h4 className={styles.headerRightText}>Data Secured - Azure Cloud Platform</h4>
                        {useLogin && <LoginButton />}
                    </div>
                </div>
                <div className={styles.headerBottom}>
                </div>
            </header>
            <Outlet />
        </div>
    );
};

export default Layout;
