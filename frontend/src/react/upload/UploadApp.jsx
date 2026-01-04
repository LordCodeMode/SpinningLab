import React, { useEffect, useMemo, useRef, useState } from 'react';
import Services from '../../../static/js/services/index.js';

const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
};

const UploadApp = () => {
  const [files, setFiles] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState(null);
  const fileInputRef = useRef(null);
  const dragCounterRef = useRef(0);
  const resultTimerRef = useRef(null);
  const cleanupTimerRef = useRef(null);

  useEffect(() => {
    Services.analytics.trackPageView('upload');
  }, []);

  useEffect(() => {
    return () => {
      if (resultTimerRef.current) {
        clearTimeout(resultTimerRef.current);
      }
      if (cleanupTimerRef.current) {
        clearTimeout(cleanupTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (typeof feather !== 'undefined') feather.replace();
  }, [files, isUploading, result]);

  const fileCountLabel = useMemo(() => {
    return `${files.length} file${files.length === 1 ? '' : 's'}`;
  }, [files.length]);

  const showNotification = (message, type = 'info') => {
    if (Services.notify) {
      Services.notify(message, type);
    } else {
      console.log(`[Upload] ${type.toUpperCase()}: ${message}`);
    }
  };

  const handleFileSelect = (selected) => {
    const incoming = Array.from(selected || []);
    const fitFiles = incoming.filter((file) => file.name.toLowerCase().endsWith('.fit'));

    if (fitFiles.length === 0) {
      showNotification('Please select .FIT files', 'error');
      return;
    }

    setFiles((prev) => {
      const merged = [...prev, ...fitFiles];
      return merged.filter((file, index, self) =>
        index === self.findIndex((f) => f.name === file.name && f.size === file.size)
      );
    });
  };

  const handleRemove = (index) => {
    setFiles((prev) => prev.filter((_, idx) => idx !== index));
  };

  const clearFiles = () => {
    setFiles([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const showResults = (type, messageHtml) => {
    setResult({ type, messageHtml });
    if (resultTimerRef.current) {
      clearTimeout(resultTimerRef.current);
    }
    resultTimerRef.current = setTimeout(() => {
      setResult(null);
    }, 5000);
  };

  const handleUpload = async () => {
    if (!files.length || isUploading) return;

    setIsUploading(true);
    setProgress(0);

    try {
      const resultData = await Services.upload.uploadFiles(files, {
        onProgress: (current, total) => {
          const pct = total ? Math.round((current / total) * 100) : 100;
          setProgress(Math.min(100, Math.max(0, pct)));
        }
      });

      const items = Array.isArray(resultData.results) ? resultData.results : [];
      const successItems = items.filter((item) => item?.success);
      const duplicateItems = items.filter((item) => !item?.success && /already imported/i.test(item?.message || ''));
      const errorItems = items.filter((item) => !item?.success && !/already imported/i.test(item?.message || ''));

      const importedCount = successItems.length;
      const duplicateCount = duplicateItems.length;
      const failedCount = errorItems.length;
      const failedMessages = errorItems.map((item) => `${item.filename}: ${item.message || 'Unknown error'}`);
      const processedCount = importedCount + duplicateCount;

      if (processedCount > 0) {
        const messageParts = [];
        if (importedCount > 0) {
          messageParts.push(`${importedCount} new file${importedCount === 1 ? '' : 's'} imported`);
        } else if (duplicateCount > 0) {
          messageParts.push('No new files imported');
        }
        if (duplicateCount > 0) {
          messageParts.push(`${duplicateCount} already imported`);
        }
        if (failedCount > 0) {
          messageParts.push(`${failedCount} failed`);
        }

        const summary = messageParts.join(' | ') || `Processed ${processedCount} file${processedCount === 1 ? '' : 's'}`;
        const details = failedMessages.length ? `<br><small>${failedMessages.join('<br>')}</small>` : '';
        const resultType = failedCount > 0 || duplicateCount > 0 ? 'warning' : 'success';

        showResults(resultType, `${summary}${details}`);
        setProgress(100);

        cleanupTimerRef.current = setTimeout(() => {
          clearFiles();
          setIsUploading(false);
          setProgress(0);
        }, 2000);
      } else {
        const details = failedMessages.length ? `<br><small>${failedMessages.join('<br>')}</small>` : '';
        showResults('error', `Upload failed: ${failedCount} file${failedCount === 1 ? '' : 's'} could not be processed${details}`);
        setIsUploading(false);
      }
    } catch (error) {
      showResults('error', `Upload failed: ${error.message}`);
      setIsUploading(false);
    }
  };

  const handleDragEnter = (event) => {
    event.preventDefault();
    event.stopPropagation();
    dragCounterRef.current += 1;
    setIsDragOver(true);
  };

  const handleDragLeave = (event) => {
    event.preventDefault();
    event.stopPropagation();
    dragCounterRef.current -= 1;
    if (dragCounterRef.current <= 0) {
      setIsDragOver(false);
    }
  };

  const handleDrop = (event) => {
    event.preventDefault();
    event.stopPropagation();
    dragCounterRef.current = 0;
    setIsDragOver(false);
    if (event.dataTransfer?.files?.length) {
      handleFileSelect(event.dataTransfer.files);
    }
  };

  const handleBrowse = (event) => {
    event.stopPropagation();
    fileInputRef.current?.click();
  };

  const handleZoneClick = () => {
    fileInputRef.current?.click();
  };

  const resultConfig = {
    success: {
      icon: (
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
      ),
      className: 'upload-result-success',
      title: 'Upload Complete'
    },
    warning: {
      icon: (
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01M5.07 19h13.86a1 1 0 00.94-1.342L12.94 4.658a1 1 0 00-1.88 0L4.13 17.658A1 1 0 005.07 19z" />
      ),
      className: 'upload-result-warning',
      title: 'Upload Completed with Issues'
    },
    error: {
      icon: (
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
      ),
      className: 'upload-result-error',
      title: 'Upload Failed'
    }
  };

  const resultVariant = result ? resultConfig[result.type] || resultConfig.error : null;

  return (
    <div className="upload-section">
      <div className="upload-header">
        <h1>Upload Activities</h1>
        <p>Import .FIT files from your cycling computer or training platform</p>
      </div>

      <div
        className={`upload-zone ${isDragOver ? 'drag-over' : ''}`}
        onClick={handleZoneClick}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={(event) => {
          event.preventDefault();
          event.stopPropagation();
        }}
        onDrop={handleDrop}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".fit"
          multiple
          hidden
          onChange={(event) => {
            if (event.target.files?.length) {
              handleFileSelect(event.target.files);
            }
          }}
        />
        <div className="upload-zone__content">
          <div className="upload-zone__icon-wrapper">
            <svg className="upload-zone__icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
          </div>
          <h3 className="upload-zone__title">Drop files here or click to browse</h3>
          <p className="upload-zone__subtitle">Drag and drop your .FIT files anywhere on this area</p>
          <button type="button" className="upload-zone__button" onClick={handleBrowse}>
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Select Files
          </button>
          <div className="upload-zone__formats">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Supports .FIT files up to 50MB each
          </div>
        </div>
      </div>

      {files.length > 0 && (
        <div className="upload-files-card">
          <div className="upload-files-header">
            <div className="upload-files-title">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Selected Files
            </div>
            <span className="upload-files-count">{fileCountLabel}</span>
          </div>
          <div className="upload-file-list">
            {files.map((file, index) => (
              <div key={`${file.name}-${file.size}`} className="upload-file-item">
                <div className="upload-file-icon">
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div className="upload-file-info">
                  <div className="upload-file-name" title={file.name}>{file.name}</div>
                  <div className="upload-file-size">{formatFileSize(file.size)}</div>
                </div>
                <button className="upload-file-remove" type="button" onClick={() => handleRemove(index)} title="Remove file">
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {files.length > 0 && !isUploading && (
        <div className="upload-actions">
          <button className="btn btn--primary" type="button" onClick={handleUpload}>
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            Upload Files
          </button>
          <button className="btn btn--secondary" type="button" onClick={clearFiles}>
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
            Clear All
          </button>
        </div>
      )}

      {isUploading && (
        <div className="upload-progress">
          <div className="upload-progress-header">
            <div className="upload-progress-text">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Uploading...
            </div>
            <div className="upload-progress-percent">{progress}%</div>
          </div>
          <div className="upload-progress-bar">
            <div className="upload-progress-fill" style={{ width: `${progress}%` }}></div>
          </div>
        </div>
      )}

      {result && resultVariant && (
        <div className="upload-results-card">
          <div className={resultVariant.className}>
            <div className="upload-result-icon">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {resultVariant.icon}
              </svg>
            </div>
            <div className="upload-result-content">
              <div className="upload-result-title">{resultVariant.title}</div>
              <div className="upload-result-text" dangerouslySetInnerHTML={{ __html: result.messageHtml }} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UploadApp;
