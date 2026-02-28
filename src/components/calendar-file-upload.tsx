"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Upload, FileText, CheckCircle, AlertCircle, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { invalidateTaskCaches, invalidateIntegrationCaches } from "@/hooks/use-data-cache";
import { useBuckets } from "@/hooks/use-buckets";

export interface UploadResult {
  success: boolean;
  message: string;
  totalEvents?: number;
  importedEvents?: number;
  tasksCreated?: number;
  tasksUpdated?: number;
  taskSyncErrors?: number;
  warnings?: string;
  error?: string;
  importId?: string;
  calendarName?: string;
  bucket?: string | null;
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
  const [calendarName, setCalendarName] = useState('');
  const { buckets, activeBucket } = useBuckets();
  const [selectedBucket, setSelectedBucket] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const userBucketChoiceRef = useRef(false);

  useEffect(() => {
    if (activeBucket && !userBucketChoiceRef.current) {
      setSelectedBucket(activeBucket);
    }
  }, [activeBucket]);

  const ALLOWED_MIME_TYPES = new Set([
    'text/calendar',
    'application/ics',
    'text/x-vcalendar',
    // Some browsers report generic types for .ics files
    'application/octet-stream',
    '',
  ]);

  const validateFile = (file: File): string | null => {
    if (!file.name.endsWith('.ics') && !file.name.endsWith('.ical')) {
      return 'Please select a valid calendar file (.ics or .ical)';
    }

    if (file.type && !ALLOWED_MIME_TYPES.has(file.type)) {
      return `Unexpected file type "${file.type}". Please upload a valid .ics calendar file.`;
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
      const trimmedName = calendarName.trim();
      if (trimmedName.length > 0) {
        formData.append('calendarName', trimmedName);
      }
      if (selectedBucket) {
        formData.append('bucket', selectedBucket);
      }

      const response = await fetch('/api/calendar/upload', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (response.ok) {
        invalidateTaskCaches();
        invalidateIntegrationCaches('calendar');
        const successResult: UploadResult = {
          success: true,
          message: result.message,
          totalEvents: result.totalEvents,
          importedEvents: result.importedEvents,
          tasksCreated: result.tasksCreated,
          tasksUpdated: result.tasksUpdated,
          taskSyncErrors: result.taskSyncErrors,
          warnings: result.warnings,
          importId: result.importId,
          calendarName: result.calendarName ?? trimmedName,
          bucket: typeof result.bucket !== 'undefined' ? result.bucket : (selectedBucket || null),
        };
        setUploadResult(successResult);
        onUploadComplete?.(successResult);
        setCalendarName('');
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        setSelectedFile(null);
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
    setCalendarName('');
    userBucketChoiceRef.current = false;
    setSelectedBucket(activeBucket ?? '');
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
          <Upload className="h-5 w-5 text-warm-600" />
          Upload Calendar File
        </CardTitle>
        {onClose && (
          <button
            onClick={onClose}
            aria-label="Close upload dialog"
            className="p-1 rounded-lg hover:bg-theme-progress-track text-theme-text-tertiary hover:text-theme-text-body"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <label className="block text-sm font-medium text-theme-text-body">
            Calendar name
            <input
              type="text"
              value={calendarName}
              onChange={(e) => setCalendarName(e.target.value)}
              placeholder="e.g., Family Schedule"
              className="mt-1 w-full rounded-lg border border-theme-neutral-300 px-3 py-2 text-sm focus:border-warm-500 focus:outline-none"
            />
          </label>
          <p className="text-xs text-theme-text-tertiary">
            Give this calendar a label so you can manage it from the Integrations tab.
          </p>
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-theme-text-body">
            Bucket
            <select
              value={selectedBucket}
              onChange={(e) => {
                userBucketChoiceRef.current = true;
                setSelectedBucket(e.target.value);
              }}
              className="mt-1 w-full rounded-lg border border-theme-neutral-300 px-3 py-2 text-sm focus:border-warm-500 focus:outline-none bg-white"
            >
              <option value="">Don&apos;t assign a bucket</option>
              {buckets.map((bucket) => (
                <option key={bucket} value={bucket}>
                  {bucket}
                </option>
              ))}
            </select>
          </label>
          <p className="text-xs text-theme-text-tertiary">
            Imported events will be tagged with this bucket so they appear with the right color coding.
          </p>
        </div>

        {/* Upload Area */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`
            border-2 border-dashed rounded-xl p-8 text-center transition-all duration-200
            ${isDragging
              ? 'border-warm-400 bg-warm-50'
              : selectedFile
                ? 'border-green-300 bg-green-50'
                : 'border-theme-neutral-300 bg-theme-surface-alt hover:border-theme-neutral-400'
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
                  <p className="font-medium text-theme-text-primary">{selectedFile.name}</p>
                  <p className="text-sm text-theme-text-tertiary">{formatFileSize(selectedFile.size)}</p>
                </div>
                <button
                  onClick={handleReset}
                  className="text-sm text-theme-text-subtle hover:text-theme-text-primary underline"
                >
                  Choose different file
                </button>
              </>
            ) : (
              <>
                <div className={`p-3 rounded-full ${isDragging ? 'bg-warm-100' : 'bg-theme-progress-track'}`}>
                  <Upload className={`h-8 w-8 ${isDragging ? 'text-warm-600' : 'text-theme-text-tertiary'}`} />
                </div>
                <div className="text-center">
                  <p className="text-lg font-medium text-theme-text-primary mb-2">
                    Drop your calendar file here
                  </p>
                  <p className="text-sm text-theme-text-subtle mb-4">
                    or click to browse for .ics or .ical files
                  </p>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-warm-600 text-white rounded-lg hover:bg-warm-700 transition-colors"
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
                {uploadResult.success && ((uploadResult.tasksCreated ?? 0) > 0 || (uploadResult.tasksUpdated ?? 0) > 0) && (
                  <p className="text-sm mt-1">
                    Converted {uploadResult.tasksCreated ?? 0} new events into tasks
                    {uploadResult.tasksUpdated ? ` and refreshed ${uploadResult.tasksUpdated} existing tasks.` : '.'}
                  </p>
                )}
                {uploadResult.success && (uploadResult.taskSyncErrors ?? 0) > 0 && (
                  <p className="text-sm mt-1 text-yellow-700">
                    {uploadResult.taskSyncErrors} events could not be converted into tasks. Check server logs for more details.
                  </p>
                )}
                {uploadResult.success && uploadResult.warnings && (
                  <p className="text-sm mt-1 text-yellow-700">{uploadResult.warnings}</p>
                )}
                {uploadResult.success && uploadResult.bucket && (
                  <p className="text-sm mt-1 text-theme-text-body">
                    Tagged imported events with the {uploadResult.bucket} bucket.
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
              className="flex-1 bg-warm-600 text-white py-3 px-4 rounded-lg hover:bg-warm-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
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
              className="px-4 py-3 border border-theme-neutral-300 text-theme-text-body rounded-lg hover:bg-theme-surface-alt transition-colors"
            >
              Cancel
            </button>
          </div>
        )}

        {/* Help Text */}
        <div className="text-sm text-theme-text-subtle bg-warm-50 p-4 rounded-lg">
          <h4 className="font-medium text-warm-900 mb-2">Supported formats:</h4>
          <ul className="space-y-1 list-disc list-inside">
            <li>iCalendar files (.ics, .ical)</li>
            <li>Exported from Google Calendar, Outlook, Apple Calendar, etc.</li>
            <li>Maximum file size: 5MB</li>
          </ul>
          <p className="mt-3 text-xs">
            Imported events show up as editable tasks without a bucket so you can organize them later, and they stay in sync with your calendar view.
            Duplicate events will update automatically.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
