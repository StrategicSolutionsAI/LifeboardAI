"use client";

import { useState, useCallback, useRef } from "react";
import { Upload, FileText, CheckCircle, AlertCircle, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface UploadResult {
  success: boolean;
  message: string;
  totalEvents?: number;
  importedEvents?: number;
  error?: string;
}

interface CalendarFileUploadProps {
  onUploadComplete?: (result: UploadResult) => void;
  onClose?: () => void;
}

export function CalendarFileUpload({ onUploadComplete, onClose }: CalendarFileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateFile = (file: File): string | null => {
    if (!file.name.endsWith('.ics') && !file.name.endsWith('.ical')) {
      return 'Please select a valid calendar file (.ics or .ical)';
    }

    if (file.size > 5 * 1024 * 1024) {
      return 'File size must be less than 5MB';
    }

    return null;
  };

  const handleFileSelect = useCallback((file: File) => {
    const error = validateFile(file);
    if (error) {
      setUploadResult({
        success: false,
        message: error,
        error
      });
      return;
    }

    setSelectedFile(file);
    setUploadResult(null);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  }, [handleFileSelect]);

  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileSelect(files[0]);
    }
  }, [handleFileSelect]);

  const handleUpload = async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    setUploadResult(null);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      const response = await fetch('/api/calendar/upload', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (response.ok) {
        const successResult: UploadResult = {
          success: true,
          message: result.message,
          totalEvents: result.totalEvents,
          importedEvents: result.importedEvents
        };
        setUploadResult(successResult);
        onUploadComplete?.(successResult);
      } else {
        let errorMessage = result.error || 'Upload failed';
        
        // Handle specific database setup issues
        if (result.migrationNeeded) {
          errorMessage = 'Database setup required. Please contact your administrator to set up the calendar events table.';
        }

        const errorResult: UploadResult = {
          success: false,
          message: errorMessage,
          error: result.error
        };
        setUploadResult(errorResult);
        onUploadComplete?.(errorResult);
      }
    } catch (error) {
      console.error('Upload error:', error);
      const errorResult: UploadResult = {
        success: false,
        message: 'Network error occurred',
        error: 'Network error'
      };
      setUploadResult(errorResult);
      onUploadComplete?.(errorResult);
    } finally {
      setIsUploading(false);
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    setUploadResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-xl flex items-center gap-2">
          <Upload className="h-5 w-5 text-blue-600" />
          Upload Calendar File
        </CardTitle>
        {onClose && (
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Upload Area */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`
            border-2 border-dashed rounded-xl p-8 text-center transition-all duration-200
            ${isDragging
              ? 'border-blue-400 bg-blue-50'
              : selectedFile
                ? 'border-green-300 bg-green-50'
                : 'border-gray-300 bg-gray-50 hover:border-gray-400'
            }
          `}
        >
          <div className="flex flex-col items-center gap-4">
            {selectedFile ? (
              <>
                <div className="p-3 rounded-full bg-green-100">
                  <FileText className="h-8 w-8 text-green-600" />
                </div>
                <div className="text-center">
                  <p className="font-medium text-gray-900">{selectedFile.name}</p>
                  <p className="text-sm text-gray-500">{formatFileSize(selectedFile.size)}</p>
                </div>
                <button
                  onClick={handleReset}
                  className="text-sm text-gray-600 hover:text-gray-800 underline"
                >
                  Choose different file
                </button>
              </>
            ) : (
              <>
                <div className={`p-3 rounded-full ${isDragging ? 'bg-blue-100' : 'bg-gray-100'}`}>
                  <Upload className={`h-8 w-8 ${isDragging ? 'text-blue-600' : 'text-gray-400'}`} />
                </div>
                <div className="text-center">
                  <p className="text-lg font-medium text-gray-900 mb-2">
                    Drop your calendar file here
                  </p>
                  <p className="text-sm text-gray-600 mb-4">
                    or click to browse for .ics or .ical files
                  </p>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <Upload className="h-4 w-4" />
                    Choose File
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".ics,.ical"
          onChange={handleFileInputChange}
          className="hidden"
        />

        {/* Upload Result */}
        {uploadResult && (
          <div className={`p-4 rounded-lg border ${
            uploadResult.success
              ? 'bg-green-50 border-green-200 text-green-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}>
            <div className="flex items-start gap-2">
              {uploadResult.success ? (
                <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
              )}
              <div className="flex-1">
                <p className="font-medium">{uploadResult.message}</p>
                {uploadResult.success && uploadResult.totalEvents && (
                  <p className="text-sm mt-1">
                    Found {uploadResult.totalEvents} events, imported {uploadResult.importedEvents} successfully.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Upload Button */}
        {selectedFile && !uploadResult?.success && (
          <div className="flex gap-3">
            <button
              onClick={handleUpload}
              disabled={isUploading}
              className="flex-1 bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
            >
              {isUploading ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Uploading...
                </span>
              ) : (
                'Upload Calendar'
              )}
            </button>
            <button
              onClick={handleReset}
              className="px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        )}

        {/* Help Text */}
        <div className="text-sm text-gray-600 bg-blue-50 p-4 rounded-lg">
          <h4 className="font-medium text-blue-900 mb-2">Supported formats:</h4>
          <ul className="space-y-1 list-disc list-inside">
            <li>iCalendar files (.ics, .ical)</li>
            <li>Exported from Google Calendar, Outlook, Apple Calendar, etc.</li>
            <li>Maximum file size: 5MB</li>
          </ul>
          <p className="mt-3 text-xs">
            Your calendar events will be imported and made available in your calendar view.
            Duplicate events will be updated automatically.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}