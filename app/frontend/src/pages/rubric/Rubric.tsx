import React, { useState, useEffect, useRef } from "react";
import { chatApi, ChatAppResponse, ChatAppRequest, ChatAppResponseOrError } from "../../api";
import { useLogin, getToken } from "../../authConfig";
import { useMsal } from "@azure/msal-react";
import { Answer } from "../../components/Answer";
import { AnalysisPanel, AnalysisPanelTabs } from "../../components/AnalysisPanel";
import styles from "./Rubric.module.css";
import "bootstrap/dist/css/bootstrap.min.css";
import Spinner from "react-bootstrap/Spinner";
import Modal from "react-bootstrap/Modal";
import Button from "react-bootstrap/Button";
import Select from "react-select";

import Papa from "papaparse";

interface ResponseItem {
    criterion: string;
    response: string;
    choices: ChatAppResponse["choices"];
}

const RubricEvaluation = () => {
    const [runAnalysis, setRunAnalysis] = useState(false);

    const [rubricCriteria, setRubricCriteria] = useState<string[]>([
        "Is our liability limited, if so what is the amount of the liability cap?",
        "What losses are included and excluded from our liability? (e.g. confidentiality, data breaches)"
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

    useEffect(() => {
        // Make a request to the backend to get the SAS URL of the default CSV file
        fetch("/get_default_csv_sas_url")
            .then(response => response.text())
            .then(csvSasUrl => {
                // Fetch the CSV file and parse it
                fetch(csvSasUrl)
                    .then(response => response.text())
                    .then(csv => {
                        Papa.parse(csv, {
                            complete: function (results) {
                                console.log("CSV parsed successfully", results.data);
                                const criteria = results.data
                                    .slice(1) // Skip the first row
                                    .filter((row: any) => row[0]) // Filter out empty rows
                                    .map((row: any) => row[0]); // Extract the first (and only) element from each row array
                                setRubricCriteria(criteria);
                            }
                        });
                    });
            });
    }, []);

    useEffect(() => {
        // Fetch the list of existing rubric files
        fetch("/get_rubric_files")
            .then(response => response.json())
            .then(data => {
                const rubricFiles = data.rubric_files.map((fileName: string) => ({
                    fileName: fileName,
                    fileUrl: `/get_default_csv_sas_url?file=${fileName}` // Change this URL to the endpoint that returns the SAS URL of a specific file
                }));
    
                // Add the default CSV file
                const defaultFile = {
                    fileName: 'rubric.csv',  // replace with your default filename
                    fileUrl: '/get_default_csv_sas_url'  // replace with the endpoint that returns the SAS URL of the default file
                };
                rubricFiles.unshift(defaultFile);
    
                setUploadedFiles(rubricFiles);
            });
    }, []);

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
    const [uploadedFiles, setUploadedFiles] = useState<{ fileName: string; fileUrl: string }[]>([]);

    const handleFileUpload = (fileList: FileList | null) => {
        if (fileList && fileList.length > 0) {
            setIsUploading(true);
            const file = fileList[0];
            setUploadedFileName(file.name);

            // Create a FormData object and append the file
            const formData = new FormData();
            formData.append("file", file);

            // Create a new XMLHttpRequest
            const xhr = new XMLHttpRequest();

            // Set up the request
            xhr.open("POST", "/upload", true);

            // Set up a listener to track upload progress
            xhr.upload.onprogress = event => {
                if (event.lengthComputable) {
                    const percentComplete = Math.round((event.loaded / event.total) * 100);
                    setUploadProgress(percentComplete); // Update the state with the progress
                }
            };

            // When a file is uploaded, add an object containing the file name and the SAS URL to uploadedFiles
            xhr.onloadend = () => {
                if (xhr.status === 200) {
                    console.log("File upload successful");

                    // The backend should return the SAS URL of the uploaded CSV file
                    const csvSasUrl = xhr.responseText;

                    setUploadedFiles(prevState => [...prevState, { fileName: file.name, fileUrl: csvSasUrl }]);
                } else {
                    console.error("File upload failed");
                }
                setIsUploading(false);
                setUploadProgress(0); // Reset the progress
            };

            // Send the FormData
            xhr.send(formData);

            const [uploadedFiles, setUploadedFiles] = useState<{ fileName: string; fileUrl: string }[]>([]);

            // ...

            const csvSasUrl = xhr.responseText; // Declare the csvSasUrl variable
            setUploadedFiles(prevState => [...prevState, { fileName: file.name, fileUrl: csvSasUrl }]);
        }
    };

    const clearResponses = () => {
        setResponses([]);
        setRunAnalysis(false);
    };

    const handleFileUpload_csv = (fileList: FileList | null) => {
        if (fileList && fileList.length > 0) {
            const file = fileList[0];
            const filename = file.name;

            // Create a FormData object and append the file
            const formData = new FormData();
            formData.append("file", file);

            // Create a new XMLHttpRequest
            const xhr = new XMLHttpRequest();

            // Set up the request
            xhr.open("POST", "/upload_rubric", true); // Change the endpoint to '/upload_rubric'

            // Set up a listener for when the request finishes
            xhr.onloadend = () => {
                if (xhr.status === 200) {
                    console.log("File upload successful");

                    // The backend should return the SAS URL of the uploaded CSV file
                    const csvSasUrl = xhr.responseText;

                    setUploadedFiles(prevState => [...prevState, { fileName: file.name, fileUrl: csvSasUrl }]);

                    // Fetch the CSV file and parse it
                    fetch(csvSasUrl)
                        .then(response => {
                            console.log("Fetch response status:", response.status);
                            return response.text();
                        })
                        .then(csv => {
                            console.log("CSV content:", csv);
                            Papa.parse(csv, {
                                complete: function (results) {
                                    console.log("CSV parsed successfully", results.data);
                                    const criteria = results.data
                                        .slice(1) // Skip the first row
                                        .filter((row: any) => row[0]) // Filter out empty rows
                                        .map((row: any) => row[0]); // Extract the first (and only) element from each row array
                                    setRubricCriteria(criteria);
                                }
                            });
                        });
                } else {
                    console.error("File upload failed");
                }
            };

            // Send the FormData
            xhr.send(formData);
        }
    };

    const handleFileSelection = (selectedFileUrl: string) => {
        // Fetch the selected CSV file and parse it
        fetch(selectedFileUrl)
            .then(response => response.text())
            .then(csv => {
                Papa.parse(csv, {
                    complete: function (results) {
                        const criteria = results.data.filter((row: any) => row[0]).map((row: any) => row[0]);
                        setRubricCriteria(criteria);
                    }
                });
            });
    };
        

    const [uploadProgress, setUploadProgress] = useState(0);
    const onDragOver = (event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
    };

    const onDrop = (event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        handleFileUpload(event.dataTransfer.files);
    };

    const [showModal, setShowModal] = useState(false);
    const handleClose = () => {
        setShowModal(false);
        setUploadedFiles([]); // Clear the list of uploaded files
    };
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
        let isMounted = true;

        if (runAnalysis) {
            (async () => {
                if (isMounted) {
                    setIsAnalyzing(true);
                }
                await processAllQuestions();
                if (isMounted) {
                    setIsAnalyzing(false);
                }
            })();
        }

        return () => {
            isMounted = false;
        };
    }, [runAnalysis]); // Add runAnalysis as a dependency

    return (
        <div className={styles.uploadBtnWrapper}>
            {isAnalyzing ? (
                <div className="spinnerContainer">
                    <Spinner animation="border" role="status">
                        <span className="sr-only">Analysing...</span>
                    </Spinner>
                </div>
            ) : null}
            // Dropdown menu to select a file 
            <select onChange={e => handleFileSelection(e.target.value)}>
                {uploadedFiles.map((file, index) => (
                    <option key={index} value={file.fileUrl}>
                        {file.fileName}
                    </option>
                ))}
            </select>
            <div className={styles.uploadButtonContainer}>
                <div className={styles.banner}>
                    <button type="button" className={styles.btn} onClick={handleShow}>
                        Upload PDF
                    </button>
                    <button type="button" className={styles.btn} onClick={() => setRunAnalysis(true)}>
                        Run Analysis
                    </button>
                    <button type="button" className={styles.btn} onClick={() => fileInputRef.current?.click()}>
                        Upload Rubric
                    </button>
                    <button type="button" className={styles.btn} onClick={clearResponses}>
                        Clear Results
                    </button>

                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".csv"
                        style={{ display: "none" }}
                        onChange={event => handleFileUpload_csv(event.target.files)}
                    />
                </div>
            </div>
            <Modal show={showModal} onHide={handleClose}>
                <Modal.Header closeButton>
                    <Modal.Title>Upload PDF</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <input ref={fileInputRef} type="file" accept=".pdf" style={{ display: "none" }} onChange={event => handleFileUpload(event.target.files)} />
                    <div id={styles.drop_zone} onDragOver={onDragOver} onDrop={onDrop} onClick={() => fileInputRef.current?.click()}>
                        {isUploading ? (
                            <p>Uploading {uploadedFileName}...</p>
                        ) : (
                            <div id={styles.drop_zone_inner}>
                                <p>
                                    Drop files here or <span id={styles.click_upload}>click to upload</span>
                                </p>
                            </div>
                        )}
                    </div>
                    {isUploading && (
                        <div className={styles.progress_bar_container}>
                            <div className={styles.progress}>
                                <div
                                    className={styles.progress_bar}
                                    role="progressbar"
                                    style={{ width: `${uploadProgress}%` }}
                                    aria-valuenow={uploadProgress}
                                    aria-valuemin={0}
                                    aria-valuemax={100}
                                >
                                    {uploadProgress}%
                                </div>
                            </div>
                        </div>
                    )}
                    <ul>
                        {uploadedFiles.map((file, index) => (
                            <li key={index}>{file.fileName}</li>
                        ))}
                    </ul>
                </Modal.Body>

                <Modal.Footer>
                    {isUploading && (
                        <button type="button" className={styles.uploadInProgressButton} disabled>
                            Intelligent Document Processing...
                            <>
                                <p>Processing {uploadedFileName}...</p>
                                <Spinner animation="border" role="status">
                                    <span className="sr-only">Processing...</span>
                                </Spinner>
                                <div className="progress-bar-container">
                                    <div className="progress-bar" style={{ width: `${uploadProgress}%` }}></div>
                                </div>
                            </>
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
