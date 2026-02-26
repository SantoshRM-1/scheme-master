import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Upload, FileText, Sparkles, Download, X, AlertTriangle } from "lucide-react";
import { generatePDF } from "@/lib/pdfExport";

interface UploadedFile {
  name: string;
  content: string;
}

interface GeneratedResult {
  questions: {
    question: string;
    scheme: { point: string; marks: number }[];
    solution: string;
  }[];
}

function extractKeywords(text: string): Set<string> {
  const stopWords = new Set(["the","a","an","is","are","was","were","be","been","being","have","has","had","do","does","did","will","would","shall","should","may","might","can","could","of","in","to","for","with","on","at","from","by","about","as","into","through","during","before","after","above","below","between","out","off","over","under","again","further","then","once","and","but","or","nor","not","so","yet","both","either","neither","each","every","all","any","few","more","most","other","some","such","no","only","own","same","than","too","very","just","because","if","when","where","how","what","which","who","whom","this","that","these","those","it","its"]);
  return new Set(
    text.toLowerCase().replace(/[^a-z0-9\s]/g, "").split(/\s+/).filter(w => w.length > 3 && !stopWords.has(w))
  );
}

function checkKeywordMatch(qpTexts: string[], tbTexts: string[]): boolean {
  const qpKeywords = extractKeywords(qpTexts.join(" "));
  const tbKeywords = extractKeywords(tbTexts.join(" "));
  if (qpKeywords.size === 0) return true;
  let matchCount = 0;
  qpKeywords.forEach(k => { if (tbKeywords.has(k)) matchCount++; });
  return matchCount / qpKeywords.size > 0.15;
}

export default function Generate() {
  const [qpFiles, setQpFiles] = useState<UploadedFile[]>([]);
  const [tbFiles, setTbFiles] = useState<UploadedFile[]>([]);
  const [marksConfig, setMarksConfig] = useState("10");
  const [templateType, setTemplateType] = useState("simple");
  const [paperName, setPaperName] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<GeneratedResult | null>(null);
  const [mismatchWarning, setMismatchWarning] = useState(false);

  const handleFilesUpload = async (e: React.ChangeEvent<HTMLInputElement>, setter: React.Dispatch<React.SetStateAction<UploadedFile[]>>) => {
    const files = e.target.files;
    if (!files) return;
    const newFiles: UploadedFile[] = [];
    for (const file of Array.from(files)) {
      if (file.type === "text/plain") {
        newFiles.push({ name: file.name, content: await file.text() });
      } else if (file.type === "application/pdf") {
        const reader = new FileReader();
        const content = await new Promise<string>((resolve) => {
          reader.onload = () => resolve(`[PDF_BASE64]${(reader.result as string).split(",")[1]}`);
          reader.readAsDataURL(file);
        });
        newFiles.push({ name: file.name, content });
      } else {
        toast.error(`Unsupported file: ${file.name}. Use .txt or .pdf`);
      }
    }
    setter(prev => [...prev, ...newFiles]);
    e.target.value = "";
  };

  const removeFile = (setter: React.Dispatch<React.SetStateAction<UploadedFile[]>>, index: number) => {
    setter(prev => prev.filter((_, i) => i !== index));
  };

  const handleGenerate = async () => {
    if (qpFiles.length === 0) { toast.error("Please upload at least one question paper"); return; }
    if (tbFiles.length === 0) { toast.error("Please upload at least one textbook/reference file"); return; }

    // Keyword mismatch check
    const qpTexts = qpFiles.map(f => f.content.startsWith("[PDF_BASE64]") ? "" : f.content);
    const tbTexts = tbFiles.map(f => f.content.startsWith("[PDF_BASE64]") ? "" : f.content);
    const matched = checkKeywordMatch(qpTexts, tbTexts);
    setMismatchWarning(!matched);

    setLoading(true);
    try {
      const questionPaper = qpFiles.map(f => f.content).join("\n\n--- NEXT FILE ---\n\n");
      const textbook = tbFiles.map(f => f.content).join("\n\n--- NEXT FILE ---\n\n");

      const { data, error } = await supabase.functions.invoke("generate-scheme", {
        body: { questionPaper, textbook, marksPerQuestion: parseInt(marksConfig) || 10, templateType },
      });
      if (error) throw error;

      const generatedContent = data.result;
      setResult(generatedContent);

      const fileNames = { questionPapers: qpFiles.map(f => f.name), textbooks: tbFiles.map(f => f.name) };
      await supabase.from("generated_papers").insert({
        user_id: null,
        question_paper_name: paperName || "Untitled Paper",
        template_type: templateType,
        marks_config: marksConfig,
        generated_content: generatedContent,
        file_names: fileNames,
      } as any);

      toast.success("Scheme and solutions generated successfully!");
    } catch (error: any) {
      console.error("Generation error:", error);
      toast.error(error.message || "Failed to generate. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    if (!result) return;
    generatePDF(result, paperName || "Untitled Paper", templateType);
    toast.success("PDF downloaded!");
  };

  return (
    <div className="mx-auto max-w-4xl animate-fade-in">
      <div className="mb-6">
        <h1 className="font-serif text-3xl text-foreground">Generate New</h1>
        <p className="mt-1 text-muted-foreground">Upload question papers and textbook content to generate marking schemes and solutions.</p>
      </div>

      <div className="grid gap-6">
        {/* Configuration */}
        <Card>
          <CardHeader><CardTitle className="font-serif text-lg">Configuration</CardTitle></CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label>Paper Name</Label>
              <Input value={paperName} onChange={(e) => setPaperName(e.target.value)} placeholder="e.g. CS101 Midterm" />
            </div>
            <div className="space-y-2">
              <Label>Marks per Question</Label>
              <Input type="number" value={marksConfig} onChange={(e) => setMarksConfig(e.target.value)} min="1" max="100" />
            </div>
            <div className="space-y-2">
              <Label>Template Format</Label>
              <Select value={templateType} onValueChange={setTemplateType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="vtu">University Format</SelectItem>
                  <SelectItem value="autonomous">Autonomous College Format</SelectItem>
                  <SelectItem value="simple">Simple Exam Format</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Question Paper Files */}
        <FileUploadCard
          title="Question Papers"
          description="Upload one or more PDF/text files containing questions."
          files={qpFiles}
          inputId="qp-upload"
          onUpload={(e) => handleFilesUpload(e, setQpFiles)}
          onRemove={(i) => removeFile(setQpFiles, i)}
        />

        {/* Textbook Files */}
        <FileUploadCard
          title="Textbook / Reference Content"
          description="Upload one or more PDF/text files as reference material."
          files={tbFiles}
          inputId="tb-upload"
          onUpload={(e) => handleFilesUpload(e, setTbFiles)}
          onRemove={(i) => removeFile(setTbFiles, i)}
        />

        {/* Mismatch Warning */}
        {mismatchWarning && (
          <div className="flex items-start gap-3 rounded-lg border border-warning/40 bg-warning/10 p-4 text-sm">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
            <p className="text-foreground">
              <strong>Warning:</strong> Uploaded textbook may not match the question paper. Results may be inaccurate.
            </p>
          </div>
        )}

        {/* Generate Button */}
        <Button onClick={handleGenerate} disabled={loading} size="lg" className="w-full">
          {loading ? (
            <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating...</>
          ) : (
            <><Sparkles className="mr-2 h-4 w-4" /> Generate Scheme & Solutions</>
          )}
        </Button>

        {/* Results */}
        {result && (
          <Card className="animate-slide-up">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="font-serif text-lg">Generated Results</CardTitle>
                <CardDescription>{result.questions.length} question(s) processed</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={handleDownload}>
                <Download className="mr-2 h-4 w-4" /> Download PDF
              </Button>
            </CardHeader>
            <CardContent className="space-y-6">
              {result.questions.map((q, i) => (
                <div key={i} className="rounded-lg border border-border bg-muted/30 p-4">
                  <h3 className="mb-3 font-semibold text-foreground">Q{i + 1}. {q.question}</h3>
                  <div className="mb-3">
                    <h4 className="mb-1 text-sm font-medium text-primary">Marking Scheme:</h4>
                    <ul className="space-y-1 pl-4">
                      {q.scheme.map((s, j) => (
                        <li key={j} className="flex justify-between text-sm text-muted-foreground">
                          <span>• {s.point}</span>
                          <span className="font-medium text-foreground">{s.marks} marks</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h4 className="mb-1 text-sm font-medium text-accent">Solution:</h4>
                    <p className="whitespace-pre-wrap text-sm text-muted-foreground">{q.solution}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function FileUploadCard({ title, description, files, inputId, onUpload, onRemove }: {
  title: string;
  description: string;
  files: UploadedFile[];
  inputId: string;
  onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemove: (index: number) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-serif text-lg">
          <FileText className="h-5 w-5 text-primary" />
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <Label htmlFor={inputId} className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-border bg-muted/50 px-4 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-muted">
            <Upload className="h-4 w-4" /> Upload Files
          </Label>
          <input id={inputId} type="file" accept=".pdf,.txt" multiple className="hidden" onChange={onUpload} />
        </div>
        {files.length > 0 && (
          <ul className="space-y-1.5">
            {files.map((f, i) => (
              <li key={i} className="flex items-center justify-between rounded-md border border-border bg-muted/30 px-3 py-2 text-sm">
                <span className="flex items-center gap-2 truncate text-foreground">
                  <FileText className="h-3.5 w-3.5 shrink-0 text-primary" />
                  {f.name}
                </span>
                <button onClick={() => onRemove(i)} className="ml-2 rounded p-0.5 text-muted-foreground hover:text-destructive">
                  <X className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
