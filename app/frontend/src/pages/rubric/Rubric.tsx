import React, { useState, useEffect, useRef } from "react";
import { chatApi, ChatAppResponse, ChatAppRequest, ChatAppResponseOrError } from "../../api";
import { useLogin, getToken } from "../../authConfig";
import { useMsal } from "@azure/msal-react";
import { Answer } from "../../components/Answer";
import { AnalysisPanel, AnalysisPanelTabs } from "../../components/AnalysisPanel";
import styles from "./Rubric.module.css";
import "bootstrap/dist/css/bootstrap.min.css";
import Spinner from "react-bootstrap/Spinner";
// import { uploadFile } from "./uploadFile";
import Modal from "react-bootstrap/Modal";
import Button from "react-bootstrap/Button";

import Select from "react-select";

interface ResponseItem {
    criterion: string;
    response: string;
    choices: ChatAppResponse["choices"];
}

const RubricEvaluation = () => {
    const [rubricCriteria, setRubricCriteria] = useState<string[]>([
        "Is our liability limited, if so what is the amount of the liability cap?",
        // "What losses are included and excluded from our liability? (e.g. confidentiality, data breaches)",
        // "Is the supplier’s liability limited, if so what is the amount of the cap?"
        // "What losses are included or excluded from the supplier’s liability?",
        // "Does the supplier provide an indemnity and if so what does this cover and what losses are included and excluded?",
        // "Do we provide an indemnity and if so what does this cover and what losses are included and excluded?",
        // "Is there a confidentiality clause in the agreement that protects our confidential information from disclosure?"
    ]);
    const [responses, setResponses] = useState<ResponseItem[]>([]);
    const [activeCitation, setActiveCitation] = useState<string>();
    const [activeAnalysisPanelTab, setActiveAnalysisPanelTab] = useState<AnalysisPanelTabs | undefined>(undefined);
    const [activeRubricIndex, setActiveRubricIndex] = useState<number | undefined>(undefined);
    const [splitterPosition, setSplitterPosition] = useState<number>(50);
    const [isAnalyzing, setIsAnalyzing] = useState(false);

    const [selectedCriteria, setSelectedCriteria] = useState<string | null>(null);
    const options = rubricCriteria.map(criteria => ({
        value: criteria,
        label: criteria
    }));

    const onShowCitation = (citation: string, index: number) => {
        setActiveCitation(citation);
        setActiveAnalysisPanelTab(AnalysisPanelTabs.CitationTab);
        setActiveRubricIndex(index);
    };

    const onToggleThoughtProcessTab = (index: number) => {
        if (activeAnalysisPanelTab === AnalysisPanelTabs.ThoughtProcessTab && activeRubricIndex === index) {
            setActiveAnalysisPanelTab(undefined);
        } else {
            setActiveAnalysisPanelTab(AnalysisPanelTabs.ThoughtProcessTab);
        }
        setActiveRubricIndex(index);
    };

    const onToggleSupportingContentTab = (index: number) => {
        if (activeAnalysisPanelTab === AnalysisPanelTabs.SupportingContentTab && activeRubricIndex === index) {
            setActiveAnalysisPanelTab(undefined);
        } else {
            setActiveAnalysisPanelTab(AnalysisPanelTabs.SupportingContentTab);
        }
        setActiveRubricIndex(index);
    };

    const onToggleTab = (tab: AnalysisPanelTabs, index: number) => {
        if (activeAnalysisPanelTab === tab && activeRubricIndex === index) {
            setActiveAnalysisPanelTab(undefined);
        } else {
            setActiveAnalysisPanelTab(tab);
        }

        setActiveRubricIndex(index);
    };

    const client = useLogin ? useMsal().instance : undefined;

    const makeApiRequest = async (question: string, retries = 5): Promise<ChatAppResponse> => {
        const request: ChatAppRequest = {
            messages: [{ content: question, role: "user" }],
            session_state: null // Add this line
        };

        const token = client ? await getToken(client) : undefined;

        try {
            const response = await chatApi(request, token);

            if (!response.ok) {
                throw new Error(`API request failed with status ${response.status}`);
            }

            const parsedResponse: ChatAppResponseOrError = await response.json();
            if ("error" in parsedResponse) {
                throw new Error(parsedResponse.error);
            }

            return parsedResponse as ChatAppResponse;
        } catch (error) {
            if (retries > 0) {
                // If request failed, wait for 1 second before retrying
                await new Promise(resolve => setTimeout(resolve, 1000));
                return makeApiRequest(question, retries - 1);
            } else {
                throw error;
            }
        }
    };

    // Function to process all rubric questions at once
    const processAllQuestions = async () => {
        try {
            const newResponses = await Promise.all(
                rubricCriteria.map(async criterion => {
                    const response = await makeApiRequest(criterion);
                    return {
                        criterion: criterion,
                        response: response.choices[0].message.content,
                        choices: response.choices
                    };
                })
            );

            setResponses(newResponses);
        } catch (error) {
            console.error("Error occurred:", error);
        }
    };

    // Resizing functions
    const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
        e.preventDefault();
        document.addEventListener("mousemove", handleMouseMove);
        document.addEventListener("mouseup", handleMouseUp);
    };

    const handleMouseMove = (e: MouseEvent) => {
        e.preventDefault();
        const containerWidth = document.getElementById("rubric-container")?.clientWidth || 0;
        const newPosition = (e.clientX / containerWidth) * 100;
        setSplitterPosition(newPosition);
    };

    const handleMouseUp = (e: MouseEvent) => {
        e.preventDefault();
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
    };

    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileUpload = async (fileList: FileList | null) => {
        if (fileList && fileList.length > 0) {
            setIsUploading(true); 
            const file = fileList[0];
            setUploadedFileName(file.name);
    
            // Create a FormData object and append the file
            const formData = new FormData();
            formData.append('file', file);
    
            // Send a POST request to the backend
            const response = await fetch('/upload', {
                method: 'POST',
                body: formData
            });
    
            if (!response.ok) {
                console.error('File upload failed');
            }
    
            setIsUploading(false); 
        }
    };

    const onButtonClick = () => {
        // `current` points to the mounted file input element
        fileInputRef.current?.click();
    };

    const onDragOver = (event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
    };

    const onDrop = (event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        handleFileUpload(event.dataTransfer.files);
    };

    const [showModal, setShowModal] = useState(false);
    const handleClose = () => setShowModal(false);
    const handleShow = () => setShowModal(true);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadedFileName, setUploadedFileName] = useState("");

    const [isDropdownFocused, setIsDropdownFocused] = useState(false);
    const handleDropdownFocus = () => {
        setIsDropdownFocused(true);
    };
    
    // Event handler for when the dropdown loses focus
    const handleDropdownBlur = () => {
        setIsDropdownFocused(false);
    };
    // Use an effect to process all rubric questions when the component is mounted
    useEffect(() => {
        let isMounted = true; // Add this line

        (async () => {
            if (isMounted) {
                setIsAnalyzing(true);
            }
            await processAllQuestions();
            if (isMounted) {
                setIsAnalyzing(false);
            }
        })();

        // Cleanup function
        return () => {
            isMounted = false;
        };
    }, []);
    

    return (
        <div className={styles.uploadBtnWrapper}>
            {isAnalyzing ? (
                <div className="spinnerContainer">
                    <Spinner animation="border" role="status">
                        <span className="sr-only">Analysing...</span>
                    </Spinner>
                </div>
            ) : null}
            <div className={styles.uploadButtonContainer}>
                <button type="button" className={styles.btn} onClick={handleShow}>
                    Upload PDF
                </button>
            </div>
            <Modal show={showModal} onHide={handleClose}>
                <Modal.Header closeButton>
                    <Modal.Title>Upload PDF</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <input ref={fileInputRef} type="file" accept=".pdf" style={{ display: "none" }} onChange={event => handleFileUpload(event.target.files)} />
                    <div className="dragDropZone" onDragOver={onDragOver} onDrop={onDrop} onClick={() => fileInputRef.current?.click()}>
                        {uploadedFileName ? <p>{uploadedFileName}</p> : <p>Drop files here to upload or click to select a file</p>}
                    </div>
                </Modal.Body>
                <Modal.Footer>
                    {isUploading && (
                        <button type="button" className={styles.uploadInProgressButton} disabled>
                            Uploading...
                        </button>
                    )}
                    <Button variant="secondary" onClick={handleClose}>
                        Close
                    </Button>
                </Modal.Footer>
            </Modal>
            <div className={styles.rubricWrapper}>
                <div id="rubric-container" className={styles.rubricContainer} style={{ width: `${splitterPosition}%` }}>
                    <p className={styles.instructions}>Select a criterion from the dropdown menu:</p>
                    <Select
                        className="select"
                        options={[{ value: "", label: "All Criteria" }, ...options]}
                        onChange={option => setSelectedCriteria(option ? option.value : null)}
                        onFocus={handleDropdownFocus}
                        onBlur={handleDropdownBlur}
                    />
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                <th>Criterion</th>
                                <th>Response</th>
                            </tr>
                        </thead>
                        <tbody>
                            {responses
                                .filter(item => !selectedCriteria || item.criterion === selectedCriteria)
                                .map((item, index) => (
                                    <tr key={index}>
                                        <td className={styles.criterion}>{item.criterion}</td>
                                        <td>
                                            <div className={styles.chatMessageGpt}>
                                                <Answer
                                                    isStreaming={false}
                                                    key={index}
                                                    answer={{ choices: item.choices }}
                                                    isSelected={activeRubricIndex === index && activeAnalysisPanelTab !== undefined}
                                                    onCitationClicked={c => onShowCitation(c, index)}
                                                    onThoughtProcessClicked={() => onToggleThoughtProcessTab(index)}
                                                    onSupportingContentClicked={() => onToggleSupportingContentTab(index)}
                                                    onFollowupQuestionClicked={q => {}}
                                                    showFollowupQuestions={false}
                                                />
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                        </tbody>
                    </table>
                </div>
                <div className={styles.resizeHandle} onMouseDown={handleMouseDown}></div>
                <div className={styles.chatAnalysisPanel} style={{ width: `calc(100% - ${splitterPosition + 1}%)` }}>
                    {responses.length > 0 && activeCitation && activeRubricIndex !== undefined && activeAnalysisPanelTab !== undefined && (
                        <AnalysisPanel
                            className=""
                            activeCitation={activeCitation}
                            activeTab={activeAnalysisPanelTab}
                            onActiveTabChanged={tab => onToggleTab(tab, activeRubricIndex)}
                            citationHeight="900px"
                            answer={{ choices: responses[activeRubricIndex].choices }}
                        />
                    )}
                </div>
            </div>
        </div>
    );
};

export default RubricEvaluation;
