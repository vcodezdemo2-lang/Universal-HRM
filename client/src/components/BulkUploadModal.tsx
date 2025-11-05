import { useState, useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent } from "@/components/ui/card";
import { Upload, FileSpreadsheet, X, AlertCircle, CheckCircle } from "lucide-react";

interface BulkUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface UploadResult {
  uploadId: number;
  totalRows: number;
  processedCount: number;
  failedCount: number;
  errors: Array<{ row: number; error: string }>;
}

export default function BulkUploadModal({ isOpen, onClose }: BulkUploadModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [allocationStrategy, setAllocationStrategy] = useState<string>("round-robin");
  const [dragOver, setDragOver] = useState(false);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);

  const uploadMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const response = await fetch("/api/upload-leads", {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`${response.status}: ${error}`);
      }

      return response.json();
    },
    onSuccess: (data: UploadResult) => {
      setUploadResult(data);
      setUploadProgress(100);
      queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
      queryClient.invalidateQueries({ queryKey: ["/api/metrics"] });
      toast({
        title: "Upload Successful",
        description: `Processed ${data.processedCount} leads successfully`,
      });
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/login";
        }, 500);
        return;
      }
      toast({
        title: "Upload Failed",
        description: error.message || "There was an error uploading your file",
        variant: "destructive",
      });
    },
  });

  const handleFileSelect = useCallback((file: File) => {
    const validTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv'
    ];
    
    if (!validTypes.includes(file.type)) {
      toast({
        title: "Invalid File Type",
        description: "Please upload an Excel (.xlsx, .xls) or CSV file",
        variant: "destructive",
      });
      return;
    }

    if (file.size > 10 * 1024 * 1024) { // 10MB limit
      toast({
        title: "File Too Large",
        description: "Please upload a file smaller than 10MB",
        variant: "destructive",
      });
      return;
    }

    setSelectedFile(file);
    setUploadResult(null);
    setUploadProgress(0);
  }, [toast]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  }, [handleFileSelect]);

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const handleSubmit = async () => {
    if (!selectedFile) {
      toast({
        title: "No File Selected",
        description: "Please select a file to upload",
        variant: "destructive",
      });
      return;
    }

    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('allocationStrategy', allocationStrategy);

    // Simulate upload progress
    const progressInterval = setInterval(() => {
      setUploadProgress(prev => {
        if (prev >= 90) {
          clearInterval(progressInterval);
          return prev;
        }
        return prev + 10;
      });
    }, 200);

    uploadMutation.mutate(formData);
  };

  const handleClose = () => {
    setSelectedFile(null);
    setUploadResult(null);
    setUploadProgress(0);
    onClose();
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="bulk-upload-modal">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <div className="flex items-center">
              <Upload className="mr-2 h-5 w-5" />
              Bulk Lead Upload
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleClose}
              data-testid="button-close-upload"
            >
              <X className="h-4 w-4" />
            </Button>
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Upload Excel file with lead data
          </p>
        </DialogHeader>

        <div className="space-y-6">
          {/* File Upload Area */}
          <div
            className={`upload-area ${dragOver ? 'border-primary bg-primary/5' : ''} ${
              selectedFile ? 'border-green-500 bg-green-50 dark:bg-green-900/10' : ''
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => document.getElementById('file-input')?.click()}
            data-testid="file-drop-zone"
          >
            <input
              id="file-input"
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileInputChange}
              className="hidden"
              data-testid="input-file"
            />
            
            <div className="space-y-3">
              {selectedFile ? (
                <>
                  <CheckCircle className="h-12 w-12 text-green-600 mx-auto" />
                  <div>
                    <p className="text-lg font-medium text-green-700 dark:text-green-400">
                      File Selected
                    </p>
                    <p className="text-sm text-muted-foreground">{selectedFile.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatFileSize(selectedFile.size)}
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <FileSpreadsheet className="h-12 w-12 text-muted-foreground mx-auto" />
                  <div>
                    <p className="text-lg font-medium">Drop your Excel file here</p>
                    <p className="text-sm text-muted-foreground">or click to browse</p>
                  </div>
                </>
              )}
              
              <div className="text-xs text-muted-foreground space-y-1">
                <p>Supported formats: .xlsx, .xls, .csv</p>
                <p>Required columns: name, email, phone, location, degree</p>
                <p>Optional columns: year_of_passing, college_name</p>
                <p>Maximum file size: 10MB</p>
              </div>
            </div>
          </div>

          {/* Allocation Strategy */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Allocation Strategy</Label>
            <RadioGroup
              value={allocationStrategy}
              onValueChange={setAllocationStrategy}
              className="space-y-3"
              data-testid="radio-allocation-strategy"
            >
              <div className="flex items-start space-x-3">
                <RadioGroupItem value="round-robin" id="round-robin" className="mt-1" data-testid="radio-round-robin" />
                <Label htmlFor="round-robin" className="cursor-pointer space-y-1">
                  <div className="font-medium">Round Robin</div>
                  <div className="text-sm text-muted-foreground">
                    Distribute leads evenly among HR personnel
                  </div>
                </Label>
              </div>
              
              <div className="flex items-start space-x-3">
                <RadioGroupItem value="shared-pool" id="shared-pool" className="mt-1" data-testid="radio-shared-pool" />
                <Label htmlFor="shared-pool" className="cursor-pointer space-y-1">
                  <div className="font-medium">Shared Pool</div>
                  <div className="text-sm text-muted-foreground">
                    HR personnel pick leads from common pool
                  </div>
                </Label>
              </div>
              
              <div className="flex items-start space-x-3">
                <RadioGroupItem value="manual" id="manual" className="mt-1" data-testid="radio-manual" />
                <Label htmlFor="manual" className="cursor-pointer space-y-1">
                  <div className="font-medium">Manual Assignment</div>
                  <div className="text-sm text-muted-foreground">
                    Manually assign leads after upload
                  </div>
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Upload Progress */}
          {(uploadMutation.isPending || uploadProgress > 0) && (
            <Card>
              <CardContent className="p-4">
                <h3 className="text-sm font-medium mb-3">Upload Progress</h3>
                <div className="space-y-3">
                  {selectedFile && (
                    <div className="flex items-center justify-between text-sm">
                      <span>File: <span className="font-medium">{selectedFile.name}</span></span>
                      <span>{formatFileSize(selectedFile.size)}</span>
                    </div>
                  )}
                  
                  <div>
                    <Progress value={uploadProgress} className="h-2" />
                    <div className="flex justify-between text-xs text-muted-foreground mt-1">
                      <span>
                        {uploadMutation.isPending ? 'Processing...' : 'Upload Complete'}
                      </span>
                      <span>{uploadProgress}%</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Upload Results */}
          {uploadResult && (
            <Card>
              <CardContent className="p-4">
                <h3 className="text-sm font-medium mb-3" data-testid="text-upload-results">Upload Results</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between" data-testid="result-total-rows">
                    <span>Total Rows:</span>
                    <span className="font-medium">{uploadResult.totalRows}</span>
                  </div>
                  <div className="flex justify-between" data-testid="result-processed-count">
                    <span>Successfully Processed:</span>
                    <span className="font-medium text-green-600">{uploadResult.processedCount}</span>
                  </div>
                  <div className="flex justify-between" data-testid="result-failed-count">
                    <span>Failed:</span>
                    <span className="font-medium text-red-600">{uploadResult.failedCount}</span>
                  </div>
                </div>

                {uploadResult.errors.length > 0 && (
                  <div className="mt-4">
                    <h4 className="text-sm font-medium text-red-600 mb-2 flex items-center">
                      <AlertCircle className="mr-1 h-4 w-4" />
                      Errors ({uploadResult.errors.length})
                    </h4>
                    <div className="max-h-32 overflow-y-auto space-y-1">
                      {uploadResult.errors.slice(0, 5).map((error, index) => (
                        <div key={index} className="text-xs text-red-600 bg-red-50 dark:bg-red-900/20 p-2 rounded">
                          Row {error.row}: {error.error}
                        </div>
                      ))}
                      {uploadResult.errors.length > 5 && (
                        <div className="text-xs text-muted-foreground">
                          And {uploadResult.errors.length - 5} more errors...
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end space-x-3 pt-4 border-t border-border">
            <Button
              variant="secondary"
              onClick={handleClose}
              data-testid="button-cancel-upload"
            >
              {uploadResult ? 'Close' : 'Cancel'}
            </Button>
            {!uploadResult && (
              <Button
                onClick={handleSubmit}
                disabled={!selectedFile || uploadMutation.isPending}
                data-testid="button-submit-upload"
              >
                {uploadMutation.isPending ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-foreground mr-2"></div>
                    Processing...
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Upload Leads
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
