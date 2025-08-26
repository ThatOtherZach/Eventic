import { useState, useEffect } from "react";
import type { ReactNode } from "react";
import { Upload, X } from "lucide-react";

interface ObjectUploaderProps {
  maxFileSize?: number;
  onGetUploadParameters: () => Promise<{
    method: "PUT";
    url: string;
  }>;
  onComplete?: (result: any) => void;
  buttonClassName?: string;
  children?: ReactNode;
  accept?: string;
  currentImageUrl?: string | null;
  showPreview?: boolean;
}

export function ObjectUploader({
  maxFileSize = 10485760, // 10MB default
  onGetUploadParameters,
  onComplete,
  buttonClassName = "btn btn-primary",
  children,
  accept = "image/*",
  currentImageUrl,
  showPreview = true
}: ObjectUploaderProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentImageUrl || null);
  const [error, setError] = useState<string | null>(null);
  
  // Sync preview URL with parent's currentImageUrl
  useEffect(() => {
    if (!selectedFile) {
      setPreviewUrl(currentImageUrl || null);
    }
  }, [currentImageUrl, selectedFile]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > maxFileSize) {
      setError(`File size must be less than ${maxFileSize / 1024 / 1024}MB`);
      return;
    }

    setSelectedFile(file);
    setError(null);

    // Create preview for images
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    setError(null);

    try {
      // Get upload URL from backend
      const { url } = await onGetUploadParameters();

      // Upload file directly to storage
      const response = await fetch(url, {
        method: 'PUT',
        body: selectedFile,
        headers: {
          'Content-Type': selectedFile.type,
        },
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      // Extract the base URL (without query parameters)
      const uploadUrl = url.split('?')[0];
      
      // Call onComplete with a structure similar to what the component expects
      onComplete?.({
        successful: [{
          uploadURL: uploadUrl
        }]
      });
      setSelectedFile(null);
    } catch (err) {
      setError('Failed to upload file. Please try again.');
      console.error('Upload error:', err);
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemove = () => {
    setSelectedFile(null);
    setPreviewUrl(currentImageUrl || null);
    setError(null);
  };

  return (
    <div>
      {showPreview && previewUrl && (
        <div className="mb-3">
          <img 
            src={previewUrl} 
            alt="Preview" 
            className="img-fluid rounded"
            style={{ maxHeight: '200px', objectFit: 'cover' }}
          />
          {selectedFile && (
            <button
              type="button"
              className="btn btn-sm btn-outline-danger mt-2"
              onClick={handleRemove}
            >
              <X size={16} className="me-1" />
              Remove
            </button>
          )}
        </div>
      )}

      {!selectedFile ? (
        <div>
          <input
            type="file"
            accept={accept}
            onChange={handleFileSelect}
            className="d-none"
            id="file-upload"
          />
          <label htmlFor="file-upload" className={buttonClassName} style={{ cursor: 'pointer' }}>
            {children || (
              <>
                <Upload size={18} className="me-2" />
                Choose File
              </>
            )}
          </label>
        </div>
      ) : (
        <div>
          <p className="mb-2">
            <strong>Selected:</strong> {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
          </p>
          <button
            type="button"
            className="btn btn-success"
            onClick={handleUpload}
            disabled={isUploading}
          >
            {isUploading ? (
              <>
                <span className="spinner-border spinner-border-sm me-2" />
                Uploading...
              </>
            ) : (
              <>
                <Upload size={18} className="me-2" />
                Upload Image
              </>
            )}
          </button>
        </div>
      )}

      {error && (
        <div className="alert alert-danger mt-2">
          {error}
        </div>
      )}
    </div>
  );
}