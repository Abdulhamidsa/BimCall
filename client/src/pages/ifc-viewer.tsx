import { useState, useRef, useEffect } from "react";
import Layout from "@/components/layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, FileBox, RotateCcw, Loader2, Download, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

export default function IFCViewerPage() {
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [fileSize, setFileSize] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.ifc')) {
      setError("Please upload an IFC file (.ifc)");
      return;
    }

    setLoading(true);
    setError(null);
    setFileName(file.name);
    setFileSize(formatFileSize(file.size));

    const url = URL.createObjectURL(file);
    setFileUrl(url);
    setLoading(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.ifc')) {
      setError("Please upload an IFC file (.ifc)");
      return;
    }

    setLoading(true);
    setError(null);
    setFileName(file.name);
    setFileSize(formatFileSize(file.size));

    const url = URL.createObjectURL(file);
    setFileUrl(url);
    setLoading(false);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const resetViewer = () => {
    if (fileUrl) {
      URL.revokeObjectURL(fileUrl);
    }
    setFileUrl(null);
    setFileName("");
    setFileSize("");
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const downloadFile = () => {
    if (fileUrl) {
      const a = document.createElement("a");
      a.href = fileUrl;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  const openInBimVision = () => {
    window.open("https://bimvision.eu/en/free-ifc-viewer/", "_blank");
  };

  useEffect(() => {
    return () => {
      if (fileUrl) {
        URL.revokeObjectURL(fileUrl);
      }
    };
  }, [fileUrl]);

  return (
    <Layout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-ifc-viewer-title">IFC Viewer</h1>
            <p className="text-muted-foreground">View and inspect BIM/IFC 3D models</p>
          </div>
          {fileUrl && (
            <Button variant="outline" onClick={resetViewer} data-testid="button-reset-viewer">
              <RotateCcw className="h-4 w-4 mr-2" />
              Load New Model
            </Button>
          )}
        </div>

        {!fileUrl ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileBox className="h-5 w-5" />
                Upload IFC File
              </CardTitle>
              <CardDescription>
                Upload an IFC file to view the 3D BIM model. Supported format: .ifc
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div
                className={cn(
                  "border-2 border-dashed rounded-lg p-12 text-center transition-colors cursor-pointer",
                  "hover:border-primary hover:bg-accent/50",
                  error && "border-destructive"
                )}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onClick={() => fileInputRef.current?.click()}
                data-testid="dropzone-ifc-upload"
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  accept=".ifc"
                  onChange={handleFileUpload}
                  className="hidden"
                  data-testid="input-ifc-file"
                />
                <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-lg font-medium mb-1">
                  Drop your IFC file here
                </p>
                <p className="text-sm text-muted-foreground mb-4">
                  or click to browse
                </p>
                <Button variant="secondary" data-testid="button-browse-files">
                  Browse Files
                </Button>
                {error && (
                  <p className="text-destructive text-sm mt-4" data-testid="text-upload-error">{error}</p>
                )}
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            <Card>
              <CardHeader className="py-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <FileBox className="h-5 w-5 text-primary" />
                    <div>
                      <CardTitle className="text-base" data-testid="text-loaded-filename">{fileName}</CardTitle>
                      <CardDescription className="text-xs">IFC Model Loaded • {fileSize}</CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={downloadFile} data-testid="button-download-file">
                      <Download className="h-4 w-4 mr-2" />
                      Download
                    </Button>
                    <Button variant="outline" size="sm" onClick={openInBimVision} data-testid="button-open-external">
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Open in BIMvision
                    </Button>
                  </div>
                </div>
              </CardHeader>
            </Card>

            <Card className="overflow-hidden">
              <div 
                className="relative w-full bg-gradient-to-br from-slate-900 to-slate-800"
                style={{ height: "calc(100vh - 350px)", minHeight: "400px" }}
                data-testid="container-ifc-viewer"
              >
                {loading ? (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center text-white">
                      <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4" />
                      <p className="text-lg font-medium">Loading IFC Model...</p>
                      <p className="text-sm text-slate-400">This may take a moment for large files</p>
                    </div>
                  </div>
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center text-white p-8 max-w-xl">
                      <FileBox className="h-20 w-20 mx-auto mb-6 text-blue-400" />
                      <h3 className="text-2xl font-semibold mb-3">IFC Model Loaded</h3>
                      <p className="text-slate-300 mb-6">
                        Your file <span className="font-mono text-blue-300">{fileName}</span> has been successfully loaded.
                      </p>
                      
                      <div className="bg-slate-700/60 rounded-xl p-6 text-left mb-6">
                        <h4 className="text-white font-medium mb-4 flex items-center gap-2">
                          <FileBox className="h-4 w-4" />
                          Model Information
                        </h4>
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <div>
                            <p className="text-slate-400">File Name</p>
                            <p className="text-white font-mono truncate">{fileName}</p>
                          </div>
                          <div>
                            <p className="text-slate-400">File Size</p>
                            <p className="text-white">{fileSize}</p>
                          </div>
                          <div>
                            <p className="text-slate-400">Format</p>
                            <p className="text-white">Industry Foundation Classes</p>
                          </div>
                          <div>
                            <p className="text-slate-400">Standard</p>
                            <p className="text-white">ISO 16739</p>
                          </div>
                        </div>
                      </div>

                      <p className="text-slate-400 text-sm mb-4">
                        For full 3D viewing, open this file in a dedicated IFC viewer application like BIMvision, Autodesk Viewer, or Trimble Connect.
                      </p>
                      
                      <div className="flex justify-center gap-3">
                        <Button variant="secondary" onClick={downloadFile} data-testid="button-download-model">
                          <Download className="h-4 w-4 mr-2" />
                          Download IFC
                        </Button>
                        <Button variant="outline" onClick={openInBimVision} className="bg-transparent border-slate-500 text-white hover:bg-slate-700">
                          <ExternalLink className="h-4 w-4 mr-2" />
                          View Online
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardHeader className="py-3">
                  <CardTitle className="text-sm font-medium">About IFC</CardTitle>
                </CardHeader>
                <CardContent className="py-3">
                  <p className="text-sm text-muted-foreground">
                    Industry Foundation Classes (IFC) is an open file format for Building Information Modeling (BIM) data.
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="py-3">
                  <CardTitle className="text-sm font-medium">Supported Versions</CardTitle>
                </CardHeader>
                <CardContent className="py-3">
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• IFC2x3</li>
                    <li>• IFC4</li>
                    <li>• IFC4.3</li>
                  </ul>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="py-3">
                  <CardTitle className="text-sm font-medium">External Viewers</CardTitle>
                </CardHeader>
                <CardContent className="py-3">
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• BIMvision (Free)</li>
                    <li>• Autodesk Viewer</li>
                    <li>• Trimble Connect</li>
                  </ul>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
