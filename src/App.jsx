import { useState, useRef, useCallback } from 'react';
import Webcam from 'react-webcam';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Building2, Upload, Camera, FileOutput, Activity,
  AlertTriangle, CheckCircle2, ChevronRight, X, ScanEye,
  Info
} from 'lucide-react';
import './index.css';

function App() {
  const [activeTab, setActiveTab] = useState('upload');
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const webcamRef = useRef(null);
  const fileInputRef = useRef(null);

  // --- Handlers ---
  const handleTabChange = (tab) => {
    setActiveTab(tab);
    // Clear preview when switching to ensure fresh start, 
    // unless the user wants to keep the uploaded image. 
    // For this flow, it's cleaner to reset if they switch modes.
    setPreviewUrl(null);
    setSelectedFile(null);
    setResult(null);
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setResult(null);
    }
  };

  const captureWebcam = useCallback(() => {
    const imageSrc = webcamRef.current.getScreenshot();
    if (imageSrc) {
      fetch(imageSrc)
        .then(res => res.blob())
        .then(blob => {
          const file = new File([blob], "capture.jpg", { type: "image/jpeg" });
          setSelectedFile(file);
          setPreviewUrl(imageSrc);
          setResult(null);
        });
    }
  }, [webcamRef]);

  const clearSelection = (e) => {
    e.stopPropagation();
    setPreviewUrl(null);
    setSelectedFile(null);
    setResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const analyze = async () => {
    if (!selectedFile) return;
    setLoading(true);

    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      const res = await fetch('http://localhost:8000/predict', { method: 'POST', body: formData });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setResult(data);
    } catch (e) {
      alert("System Error: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const downloadReport = () => {
    if (!result) return;
    const doc = new jsPDF();
    const primaryColor = [3, 105, 161]; // Sky 700

    // -- Header Background --
    doc.setFillColor(...primaryColor);
    doc.rect(0, 0, 210, 40, 'F');

    // -- Logo (Mock Medical Cross) --
    doc.setFillColor(255, 255, 255);
    doc.circle(20, 20, 10, 'F');
    doc.setTextColor(...primaryColor);
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("+", 17.5, 22);

    // -- Header Text --
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.text("MedScan PACS", 36, 22);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text("RADIOLOGY DEPARTMENT", 36, 28);

    doc.text(`DATE: ${new Date().toLocaleDateString()}`, 190, 20, { align: 'right' });
    doc.text(`REF: ${Math.random().toString(36).substr(2, 6).toUpperCase()}`, 190, 28, { align: 'right' });

    // -- Patient Details Area --
    doc.setFillColor(248, 250, 252); // Slate 50
    doc.rect(14, 50, 182, 25, 'F');
    doc.setDrawColor(226, 232, 240); // Slate 200
    doc.rect(14, 50, 182, 25, 'S');

    doc.setTextColor(71, 85, 105); // Slate 600
    doc.setFontSize(9);
    doc.text("PATIENT NAME", 20, 58);
    doc.text("PATIENT ID", 100, 58);
    doc.text("MODALITY", 160, 58);

    doc.setTextColor(15, 23, 42); // Slate 900
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("John Doe (Mock)", 20, 65);
    doc.text("100-249-11", 100, 65);
    doc.text("Chest X-Ray", 160, 65);

    // -- Analysis Section --
    const isPneumonia = result.prediction === 'Pneumonia';
    const statusColor = isPneumonia ? [220, 38, 38] : [22, 163, 74];

    autoTable(doc, {
      startY: 85,
      head: [['DIAGNOSTIC METRIC', 'RESULT', 'STATUS']],
      body: [
        ['Primary Diagnosis', result.prediction, isPneumonia ? 'ABNORMAL' : 'NORMAL'],
        ['AI Confidence', `${(result.confidence * 100).toFixed(2)}%`, 'VERIFIED'],
        ['Severity Index', result.severity, '-']
      ],
      theme: 'grid',
      headStyles: {
        fillColor: primaryColor,
        textColor: 255,
        fontStyle: 'bold',
        halign: 'left'
      },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 70 },
        2: { textColor: statusColor, fontStyle: 'bold' }
      },
      styles: { fontSize: 10, cellPadding: 8, valign: 'middle' }
    });

    // -- Clinical Findings --
    let finalY = doc.lastAutoTable.finalY + 15;
    doc.setFontSize(12);
    doc.setTextColor(3, 105, 161);
    doc.setFont("helvetica", "bold");
    doc.text("CLINICAL FINDINGS", 14, finalY);

    finalY += 8;
    doc.setFontSize(10);
    doc.setTextColor(51, 65, 85);
    doc.setFont("helvetica", "normal");
    result.findings.forEach(finding => {
      doc.circle(18, finalY - 1, 1, 'F');
      doc.text(finding, 22, finalY);
      finalY += 8;
    });

    // -- Recommendation Box --
    finalY += 5;
    doc.setFillColor(240, 249, 255); // Sky 50
    doc.setDrawColor(186, 230, 253); // Sky 200
    doc.roundedRect(14, finalY, 182, 30, 2, 2, 'FD');

    doc.setTextColor(3, 105, 161);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("RECOMMENDATION", 20, finalY + 8);

    doc.setTextColor(15, 23, 42);
    doc.setFont("helvetica", "normal");
    doc.text(result.recommendation, 20, finalY + 18, { maxWidth: 170 });

    // -- Footer --
    const pageHeight = doc.internal.pageSize.height;
    doc.setDrawColor(203, 213, 225);
    doc.line(14, pageHeight - 30, 196, pageHeight - 30);

    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184); // Slate 400
    doc.text("Generated by MedScan AI v1.0 • Not a definitive diagnosis • Validation required", 14, pageHeight - 20);
    doc.text("Page 1 of 1", 196, pageHeight - 20, { align: "right" });

    doc.save("MedScan_Report.pdf");
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 font-sans text-slate-900 selection:bg-sky-100">
      {/* Header */}
      <motion.header
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="app-header"
      >
        <div className="brand-logo">
          <div className="logo-icon">
            <Building2 size={24} />
          </div>
          <div className="logo-text">
            <span className="brand-name">MedScan</span>
            <span className="brand-subtitle">Medical PACS</span>
          </div>
        </div>
        <div className="header-actions">
          <div className="user-role">
            <span className="dept-label">Radiology Dept</span>
            <span className="id-label">ID: 8829-XJ</span>
          </div>
          <div className="user-badge">
            <div className="status-dot-container">
              <div className="status-dot"></div>
              <div className="status-dot-ping"></div>
            </div>
            <span className="user-name">Dr. Authorized</span>
          </div>
        </div>
      </motion.header>

      <main className="main-content">
        {/* Left Col: Acquisition */}
        <motion.section
          initial={{ x: -20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="card acquisition-card"
        >
          <div className="card-header">
            <div className="header-title">
              <div className="icon-box">
                <ScanEye size={20} />
              </div>
              <span>Image Acquisition</span>
            </div>
            <div className={`status-indicator ${selectedFile ? 'active' : ''}`} />
          </div>

          <div className="tab-group">
            <button
              className={`tab-btn ${activeTab === 'upload' ? 'active' : ''}`}
              onClick={() => handleTabChange('upload')}
            >
              Upload Scan
              {activeTab === 'upload' && <motion.div layoutId="tab-underline" className="tab-underline" />}
            </button>
            <button
              className={`tab-btn ${activeTab === 'camera' ? 'active' : ''}`}
              onClick={() => handleTabChange('camera')}
            >
              Live Capture
              {activeTab === 'camera' && <motion.div layoutId="tab-underline" className="tab-underline" />}
            </button>
          </div>

          {/* Upload / Capture Area */}
          <div className="workspace-area">
            <AnimatePresence mode="wait">
              {activeTab === 'upload' ? (
                <motion.div
                  key="upload"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="upload-zone"
                  onClick={() => fileInputRef.current?.click()}
                >
                  {previewUrl ? (
                    <img src={previewUrl} className="preview-image" alt="Scan" />
                  ) : (
                    <div className="upload-placeholder">
                      <div className="upload-icon-circle">
                        <Upload size={40} />
                      </div>
                      <p className="upload-title">Click to Select Study</p>
                      <p className="upload-subtitle">DICOM / JPEG / PNG</p>
                    </div>
                  )}
                  <input ref={fileInputRef} type="file" hidden onChange={handleFileSelect} accept="image/*" />
                </motion.div>
              ) : (
                <motion.div
                  key="camera"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="camera-zone"
                >
                  {previewUrl ? (
                    <img src={previewUrl} className="preview-image" alt="Captured" />
                  ) : (
                    <>
                      <Webcam
                        ref={webcamRef}
                        screenshotFormat="image/jpeg"
                        className="webcam-feed"
                        videoConstraints={{ facingMode: "environment" }}
                      />
                      <div className="camera-controls">
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={captureWebcam}
                          className="btn-capture"
                        >
                          <div className="capture-dot"></div>
                          Capture Frame
                        </motion.button>
                      </div>
                    </>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Close Button */}
            <AnimatePresence>
              {previewUrl && (
                <motion.button
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.5 }}
                  onClick={clearSelection}
                  className="btn-clear"
                  title="Clear Selection"
                >
                  <X size={20} />
                </motion.button>
              )}
            </AnimatePresence>
          </div>

          <button
            className="btn-cta"
            disabled={!selectedFile || loading}
            onClick={analyze}
          >
            <div className="btn-content">
              {loading ? (
                <>
                  <div className="loader" />
                  <span>Processing Study...</span>
                </>
              ) : (
                <>
                  <span>Process Study</span>
                  <ChevronRight size={18} />
                </>
              )}
            </div>
          </button>
        </motion.section>

        {/* Right Col: Report */}
        <motion.section
          initial={{ x: 20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="card report-card"
        >
          <div className="card-header">
            <div className="header-title">
              <div className="icon-box">
                <Activity size={20} />
              </div>
              <span>Diagnostic Report</span>
            </div>
            {result && (
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={downloadReport}
                className="btn-secondary"
              >
                <FileOutput size={16} /> Export PDF
              </motion.button>
            )}
          </div>

          <div className="report-content">
            {!result ? (
              <div className="empty-state">
                <div className="empty-icon">
                  <Activity size={48} />
                </div>
                <h3>Ready for Analysis</h3>
                <p>Upload a chest X-ray scan or capture one to begin the AI diagnostic process.</p>
              </div>
            ) : (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="result-container"
              >
                {/* Status Banner */}
                <motion.div
                  initial={{ scale: 0.95 }}
                  animate={{ scale: 1 }}
                  className={`status-banner ${result.prediction === 'Pneumonia' ? 'pneumonia' : 'normal'}`}
                >
                  {result.prediction === 'Pneumonia' ? <AlertTriangle size={28} /> : <CheckCircle2 size={28} />}
                  <div className="status-text">
                    <div className="status-label">Final Diagnosis</div>
                    <span className="status-value">
                      {result.prediction.toUpperCase()} DETECTED
                    </span>
                  </div>
                  <div className="status-meta">
                    <div className="meta-label">Confidence</div>
                    <div className="meta-value">{(result.confidence * 100).toFixed(1)}%</div>
                  </div>
                </motion.div>

                {/* Key Metrics */}
                <div className="metrics-grid">
                  <div className="metric-item">
                    <div className="metric-label">Methodology</div>
                    <div className="metric-value">
                      <span className="dot"></span>
                      CNN-VGG16 + DHE
                    </div>
                  </div>
                  <div className="metric-item">
                    <div className="metric-label">Severity Index</div>
                    <div className={`metric-value ${result.prediction === 'Pneumonia' ? 'text-danger' : 'text-success'}`}>{result.severity}</div>
                  </div>
                  <div className="metric-item">
                    <div className="metric-label">
                      Validation <Info size={12} />
                    </div>
                    <div className="metric-value pending">
                      Pending Radiologist Review
                    </div>
                  </div>
                </div>

                {/* Findings */}
                <div className="findings-section">
                  <h3 className="section-title">
                    <Activity size={16} />
                    Clinical Findings
                  </h3>
                  <ul className="findings-list">
                    {result.findings.map((f, i) => (
                      <motion.li
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.1 }}
                        key={i}
                        className="finding-item"
                      >
                        <span className="bullet">•</span>
                        {f}
                      </motion.li>
                    ))}
                  </ul>
                </div>

                {/* Recommendation */}
                <div className="recommendation-section">
                  <div className="rec-icon">
                    <Building2 size={18} />
                  </div>
                  <div>
                    <div className="rec-label">Recommendation</div>
                    <p className="rec-text">{result.recommendation}</p>
                  </div>
                </div>

                {/* DHE View */}
                {result.dhe_image && (
                  <div className="dhe-section">
                    <div className="dhe-header">
                      <span className="dhe-title">
                        <ScanEye size={18} />
                        Enhanced Contrast View (DHE)
                      </span>
                      <span className="dhe-badge">FILTER: CLAHE v2.0</span>
                    </div>
                    <div className="dhe-image-container">
                      <div className="dhe-grid-overlay"></div>
                      <img src={result.dhe_image} alt="DHE Processed" className="dhe-image" />
                      <div className="dhe-controls">
                        <div className="dot red"></div>
                        <div className="dot yellow"></div>
                        <div className="dot green"></div>
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </div>
        </motion.section>
      </main>
    </div>
  );
}

export default App;
