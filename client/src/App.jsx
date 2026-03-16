import { useCallback, useEffect, useState } from "react";
import "./App.css";
import Terminal from "./components/terminal";
import FileTree from "./components/tree";
import socket from "./socket";
import Editor from "@monaco-editor/react";

import { getFileMode } from "./utils/getFileMode";

function App() {
  const [fileTree, setFileTree] = useState({});
  const [selectedFile, setSelectedFile] = useState("");
  const [selectedFileContent, setSelectedFileContent] = useState("");
  const [code, setCode] = useState("");
  const [previewKey, setPreviewKey] = useState(Date.now());

  const isSaved = selectedFileContent === code;

  useEffect(() => {
    if (!isSaved && code) {
      const timer = setTimeout(() => {
        socket.emit("file:change", {
          path: selectedFile,
          content: code,
        });
      }, 5 * 1000);
      return () => {
        clearTimeout(timer);
      };
    }
  }, [code, selectedFile, isSaved]);

  useEffect(() => {
    setCode("");
  }, [selectedFile]);

  useEffect(() => {
    setCode(selectedFileContent);
  }, [selectedFileContent]);

  const getFileTree = async () => {
    const response = await fetch("http://localhost:9000/files");
    const result = await response.json();
    setFileTree(result.tree);
  };

  const getFileContents = useCallback(async () => {
    if (!selectedFile) return;
    const response = await fetch(
      `http://localhost:9000/files/content?path=${selectedFile}`
    );
    const result = await response.json();
    setSelectedFileContent(result.content);
  }, [selectedFile]);

  useEffect(() => {
    if (selectedFile) getFileContents();
  }, [getFileContents, selectedFile]);

  useEffect(() => {
    socket.on("file:refresh", getFileTree);
    return () => {
      socket.off("file:refresh", getFileTree);
    };
  }, []);

  return (
    <div className="playground-container">
      <header className="top-bar">
        <div>
          <h1>Cloud IDE</h1>
          <p>Monaco editor with live preview</p>
        </div>
        <div className={`save-badge ${isSaved ? "saved" : "unsaved"}`}>
          {selectedFile ? (isSaved ? "Saved" : "Unsaved") : "No file selected"}
        </div>
      </header>

      <div className="editor-container">
        <div className="files">
          <div className="section-title">Explorer</div>
          <FileTree
            onSelect={(path) => {
              setSelectedFileContent("");
              setSelectedFile(path);
            }}
            tree={fileTree}
          />
        </div>
        <div className="editor">
          <div className="section-title editor-title">
            {selectedFile ? selectedFile.replaceAll("/", " / ") : "Select a file to start editing"}
          </div>
          <Editor
            height="100%"
            theme="vs-dark"
            language={getFileMode({ selectedFile })}
            value={code}
            onChange={(value) => setCode(value || "")}
            options={{
              minimap: { enabled: true },
              fontSize: 14,
              lineNumbers: "on",
              wordWrap: "on",
              smoothScrolling: true,
              scrollBeyondLastLine: false,
              automaticLayout: true,
            }}
          />
        </div>
        <div className="preview">
          <div className="preview-header">
            <p>Preview</p>
            <button onClick={() => setPreviewKey(Date.now())}>Reload</button>
          </div>
          <iframe
            key={previewKey}
            title="react-preview"
            src="http://localhost:8000"
          />
        </div>
      </div>
      <div className="terminal-container">
        <Terminal />
      </div>
    </div>
  );
}

export default App;
