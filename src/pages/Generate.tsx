import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Upload, FileText, Sparkles, Download } from "lucide-react";
import { generatePDF } from "@/lib/pdfExport";

interface GeneratedResult {
  questions: {
    question: string;
    scheme: { point: string; marks: number }[];
    solution: string;
  }[];
}

export default function Generate() {
  const { user } = useAuth();
  const [questionPaper, setQuestionPaper] = useState("");
  const [textbook, setTextbook] = useState("");
  const [marksConfig, setMarksConfig] = useState("10");
  const [templateType, setTemplateType] = useState("simple");
  const [paperName, setPaperName] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<GeneratedResult | null>(null);

  const handleFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    setter: (v: string) => void
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type === "text/plain") {
      const text = await file.text();
      setter(text);
    } else if (file.type === "application/pdf") {
      toast.info("PDF text extraction is handled during generation.");
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = (reader.result as string).split(",")[1];
        setter(`[PDF_BASE64]${base64}`);
      };
      reader.readAsDataURL(file);
    } else {
      toast.error("Please upload a .txt or .pdf file");
    }
  };

  const handleGenerate = async () => {
    if (!questionPaper.trim()) {
      toast.error("Please upload or paste your question paper");
      return;
    }
    if (!textbook.trim()) {
      toast.error("Please upload or paste your textbook content");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-scheme", {
        body: {
          questionPaper,
          textbook,
          marksPerQuestion: parseInt(marksConfig) || 10,
          templateType,
        },
      });

      if (error) throw error;

      const generatedContent = data.result;
      setResult(generatedContent);

      // Save to database
      await supabase.from("generated_papers").insert({
        user_id: user!.id,
        question_paper_name: paperName || "Untitled Paper",
        template_type: templateType,
        marks_config: marksConfig,
        generated_content: generatedContent,
      });

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
        <p className="mt-1 text-muted-foreground">Upload your question paper and textbook to generate marking schemes and solutions.</p>
      </div>

      <div className="grid gap-6">
        {/* Configuration */}
        <Card>
          <CardHeader>
            <CardTitle className="font-serif text-lg">Configuration</CardTitle>
          </CardHeader>
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
                  <SelectItem value="vtu">VTU Format</SelectItem>
                  <SelectItem value="autonomous">Autonomous College Format</SelectItem>
                  <SelectItem value="simple">Simple Exam Format</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Question Paper */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-serif text-lg">
              <FileText className="h-5 w-5 text-primary" />
              Question Paper
            </CardTitle>
            <CardDescription>Upload a PDF/text file or paste the content directly.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-3">
              <Label htmlFor="qp-upload" className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-border bg-muted/50 px-4 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-muted">
                <Upload className="h-4 w-4" /> Upload File
              </Label>
              <input id="qp-upload" type="file" accept=".pdf,.txt" className="hidden" onChange={(e) => handleFileUpload(e, setQuestionPaper)} />
              {questionPaper && <span className="text-xs text-accent">Content loaded</span>}
            </div>
            <Textarea
              value={questionPaper.startsWith("[PDF_BASE64]") ? "(PDF content loaded)" : questionPaper}
              onChange={(e) => setQuestionPaper(e.target.value)}
              placeholder="Or paste your question paper text here..."
              rows={6}
              disabled={questionPaper.startsWith("[PDF_BASE64]")}
            />
          </CardContent>
        </Card>

        {/* Textbook */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-serif text-lg">
              <FileText className="h-5 w-5 text-primary" />
              Textbook Content
            </CardTitle>
            <CardDescription>Upload a PDF/text file or paste the relevant textbook content.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-3">
              <Label htmlFor="tb-upload" className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-border bg-muted/50 px-4 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-muted">
                <Upload className="h-4 w-4" /> Upload File
              </Label>
              <input id="tb-upload" type="file" accept=".pdf,.txt" className="hidden" onChange={(e) => handleFileUpload(e, setTextbook)} />
              {textbook && <span className="text-xs text-accent">Content loaded</span>}
            </div>
            <Textarea
              value={textbook.startsWith("[PDF_BASE64]") ? "(PDF content loaded)" : textbook}
              onChange={(e) => setTextbook(e.target.value)}
              placeholder="Or paste your textbook content here..."
              rows={6}
              disabled={textbook.startsWith("[PDF_BASE64]")}
            />
          </CardContent>
        </Card>

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
