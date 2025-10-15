import React, { useState } from 'react';
import { Upload, FileText, Loader, CheckCircle, AlertCircle } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import axios from 'axios';
import './App.css';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

function App() {
  const [isLoading, setIsLoading] = useState(false);
  const [summary, setSummary] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [stats, setStats] = useState(null);
  const [customText, setCustomText] = useState('');
  const [activeTab, setActiveTab] = useState('upload');

  const onDrop = async (acceptedFiles) => {
    const file = acceptedFiles[0];
    if (file) {
      await handleFileUpload(file);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf']
    },
    multiple: false
  });

  const handleFileUpload = async (file) => {
    setIsLoading(true);
    setError('');
    setSuccess('');
    setSummary('');
    setStats(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await axios.post(`${API_BASE_URL}/upload-pdf`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      setSummary(response.data.summary);
      setStats({
        originalLength: response.data.original_length,
        summaryLength: response.data.summary_length
      });
      setSuccess('PDF summarized successfully!');
    } catch (err) {
      setError(err.response?.data?.detail || 'An error occurred while processing the PDF');
    } finally {
      setIsLoading(false);
    }
  };

  const handleTextSummarize = async () => {
    if (!customText.trim()) {
      setError('Please enter some text to summarize');
      return;
    }

    setIsLoading(true);
    setError('');
    setSuccess('');
    setSummary('');
    setStats(null);

    try {
      const response = await axios.post(`${API_BASE_URL}/summarize-text`, {
        text: customText
      });

      setSummary(response.data.summary);
      setStats({
        originalLength: response.data.original_length,
        summaryLength: response.data.summary_length
      });
      setSuccess('Text summarized successfully!');
    } catch (err) {
      setError(err.response?.data?.detail || 'An error occurred while summarizing the text');
    } finally {
      setIsLoading(false);
    }
  };

  const clearAll = () => {
    setSummary('');
    setError('');
    setSuccess('');
    setStats(null);
    setCustomText('');
  };

  return (
    <div className="container">
      <header className="header">
        <h1>
          <FileText className="header-icon" />
          PDF Summarizer
        </h1>
        <p>Upload PDFs or paste text to get AI-powered summaries using Ollama</p>
      </header>

      <div className="tabs">
        <button 
          className={`tab ${activeTab === 'upload' ? 'active' : ''}`}
          onClick={() => setActiveTab('upload')}
        >
          <Upload size={20} />
          Upload PDF
        </button>
        <button 
          className={`tab ${activeTab === 'text' ? 'active' : ''}`}
          onClick={() => setActiveTab('text')}
        >
          <FileText size={20} />
          Paste Text
        </button>
      </div>

      <div className="card">
        {activeTab === 'upload' ? (
          <div className="upload-section">
            <h2>Upload PDF File</h2>
            <div
              {...getRootProps()}
              className={`dropzone ${isDragActive ? 'active' : ''}`}
            >
              <input {...getInputProps()} />
              <Upload size={48} className="upload-icon" />
              {isDragActive ? (
                <p>Drop the PDF file here...</p>
              ) : (
                <div>
                  <p>Drag & drop a PDF file here, or click to select</p>
                  <p className="file-types">Only PDF files are supported</p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="text-section">
            <h2>Paste Text to Summarize</h2>
            <textarea
              className="textarea"
              placeholder="Paste your text here..."
              value={customText}
              onChange={(e) => setCustomText(e.target.value)}
              rows={8}
            />
            <button 
              className="btn" 
              onClick={handleTextSummarize}
              disabled={isLoading || !customText.trim()}
            >
              {isLoading ? <Loader className="loading" /> : <FileText size={20} />}
              {isLoading ? 'Summarizing...' : 'Summarize Text'}
            </button>
          </div>
        )}

        {error && (
          <div className="error">
            <AlertCircle size={20} />
            {error}
          </div>
        )}

        {success && (
          <div className="success">
            <CheckCircle size={20} />
            {success}
          </div>
        )}

        {isLoading && (
          <div className="loading-section">
            <Loader className="loading" size={32} />
            <p>Processing your request...</p>
          </div>
        )}

        {summary && (
          <div className="summary-section">
            <div className="summary-header">
              <h3>Summary</h3>
              <button className="btn btn-secondary" onClick={clearAll}>
                Clear All
              </button>
            </div>
            
            {stats && (
              <div className="stats">
                <div className="stat">
                  <div className="stat-value">{stats.originalLength.toLocaleString()}</div>
                  <div className="stat-label">Original Characters</div>
                </div>
                <div className="stat">
                  <div className="stat-value">{stats.summaryLength.toLocaleString()}</div>
                  <div className="stat-label">Summary Characters</div>
                </div>
                <div className="stat">
                  <div className="stat-value">
                    {Math.round((1 - stats.summaryLength / stats.originalLength) * 100)}%
                  </div>
                  <div className="stat-label">Reduction</div>
                </div>
              </div>
            )}

            <div className="summary-content">
              {summary}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
