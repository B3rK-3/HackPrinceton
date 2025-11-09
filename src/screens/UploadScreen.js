import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import ChatBubble from "../components/ChatBubble";
import "./UploadScreen.css";
import {API_ENDPOINTS} from "../config/api";
import { getUserId } from "../utils/auth";

function UploadScreen() {
    const navigate = useNavigate();
    const [files, setFiles] = useState([]);
    const [scheduleFile, setScheduleFile] = useState(null);

    const handleFileChange = (e) => {
        const selectedFiles = Array.from(e.target.files).filter(
            (file) => file.type === "application/pdf"
        );
        setFiles(selectedFiles);
    };

    const handleScheduleFileChange = (e) => {
        if (e.target.files[0] && e.target.files[0].type === "application/pdf") {
            setScheduleFile(e.target.files[0]);
        }
    };

    const handleUpload = async () => {
        // Convert ArrayBuffers to Uint8Array for raw bytes
        const base64Files = await Promise.all(
            files.map((file) => {
                return new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => {
                        // result looks like: "data:application/pdf;base64,JVBERi0xLjQKJc..."
                        // we remove the metadata prefix:
                        const base64String = reader.result.split(",")[1];
                        resolve(base64String);
                    };
                    reader.onerror = reject;
                    reader.readAsDataURL(file); // Reads file as base64
                });
            })
        );

        let base64Schedule;
        if (scheduleFile) {
            base64Schedule = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => {
                    // result looks like: "data:application/pdf;base64,JVBERi0xLjQKJc..."
                    // we remove the metadata prefix:
                    const base64String = reader.result.split(",")[1];
                    resolve(base64String);
                };
                reader.onerror = reject;
                reader.readAsDataURL(scheduleFile); // Reads file as base64
            });
        }

        console.log(base64Files);
        fetch(API_ENDPOINTS['SCHEDULE'], {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                userId: getUserId(),
                userInput: "",
                pdfs: base64Files,
            }),
        });

        navigate("/loading");
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        e.stopPropagation();
    };

    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        const droppedFiles = Array.from(e.dataTransfer.files).filter(
            (file) => file.type === "application/pdf"
        );
        setFiles((prev) => [...prev, ...droppedFiles]);
    };

    return (
        <div className="upload-screen">
            <Navbar />
            <div className="upload-container">
                <div className="upload-title-section">
                    <h1 className="upload-title">Upload Your Documents</h1>
                    <div className="upload-elephant-group">
                        <img
                            src="/elephant2.png"
                            alt="Elephant"
                            className="upload-elephant"
                        />
                        <ChatBubble
                            message="Upload your PDFs and I'll help you organize your learning!"
                            position="left"
                        />
                    </div>
                </div>
                <p className="upload-description">
                    Upload your course materials as PDF files. Make sure to
                    include a schedule file along with your course material to
                    schedule questions effectively.
                </p>

                <div className="upload-section">
                    <h2 className="section-title">Course Materials (PDF)</h2>
                    <div
                        className="upload-area"
                        onDragOver={handleDragOver}
                        onDrop={handleDrop}
                    >
                        <input
                            type="file"
                            id="course-files"
                            multiple
                            accept=".pdf"
                            onChange={handleFileChange}
                            className="file-input"
                        />
                        <label htmlFor="course-files" className="upload-label">
                            <span className="upload-icon">📄</span>
                            <span>Click to upload or drag and drop</span>
                            <span className="upload-hint">PDF files only</span>
                        </label>
                        {files.length > 0 && (
                            <div className="files-list">
                                <p className="files-count">
                                    {files.length} file(s) selected
                                </p>
                                {files.map((file, index) => (
                                    <div key={index} className="file-item">
                                        {file.name}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <div className="upload-section">
                    <h2 className="section-title">Schedule File (PDF)</h2>
                    <div className="upload-area">
                        <input
                            type="file"
                            id="schedule-file"
                            accept=".pdf"
                            onChange={handleScheduleFileChange}
                            className="file-input"
                        />
                        <label htmlFor="schedule-file" className="upload-label">
                            <span className="upload-icon">📅</span>
                            <span>Click to upload schedule file</span>
                            <span className="upload-hint">PDF file only</span>
                        </label>
                        {scheduleFile && (
                            <div className="files-list">
                                <div className="file-item">
                                    {scheduleFile.name}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <button
                    onClick={handleUpload}
                    className="upload-button"
                    disabled={files.length === 0}
                >
                    Upload and Continue
                </button>
            </div>

            {/* Decorative blue circles */}
            <div className="circle circle-1"></div>
            <div className="circle circle-2"></div>
            <div className="circle circle-3"></div>
            <div className="circle circle-4"></div>
        </div>
    );
}

export default UploadScreen;
