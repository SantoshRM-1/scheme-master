import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, FileText, Clock, Trash2 } from "lucide-react";
import { generatePDF } from "@/lib/pdfExport";
import { toast } from "sonner";

interface Paper {
  id: string;
  question_paper_name: string;
  template_type: string;
  marks_config: string;
  generated_content: any;
  file_names: any;
  created_at: string;
}

const templateLabels: Record<string, string> = {
  vtu: "University Format",
  autonomous: "Autonomous College",
  simple: "Simple Exam",
};

export default function HistoryPage() {
  const [papers, setPapers] = useState<Paper[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  const fetchPapers = async () => {
    const { data, error } = await supabase
      .from("generated_papers")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) toast.error("Failed to load history");
    else setPapers((data as any) || []);
    setLoading(false);
  };

  useEffect(() => { fetchPapers(); }, []);

  const handleDownload = (paper: Paper) => {
    generatePDF(paper.generated_content, paper.question_paper_name, paper.template_type);
    toast.success("PDF downloaded!");
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("generated_papers").delete().eq("id", id);
    if (error) toast.error("Failed to delete");
    else { setPapers(prev => prev.filter(p => p.id !== id)); toast.success("Deleted"); }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl animate-fade-in">
      <div className="mb-6">
        <h1 className="font-serif text-3xl text-foreground">History</h1>
        <p className="mt-1 text-muted-foreground">View and download your previously generated papers.</p>
      </div>

      {papers.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <FileText className="mb-4 h-12 w-12 text-muted-foreground/40" />
            <h3 className="font-serif text-lg text-foreground">No papers yet</h3>
            <p className="mt-1 text-sm text-muted-foreground">Generate your first scheme to see it here.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {papers.map((paper) => (
            <Card key={paper.id} className="transition-shadow hover:shadow-md">
              <CardHeader className="flex flex-row items-start justify-between pb-2">
                <div className="flex-1">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <FileText className="h-4 w-4 text-primary" />
                    {paper.question_paper_name}
                  </CardTitle>
                  <CardDescription className="mt-1 flex flex-wrap items-center gap-3 text-xs">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {new Date(paper.created_at).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </span>
                    <Badge variant="secondary" className="text-xs">
                      {templateLabels[paper.template_type] || paper.template_type}
                    </Badge>
                  </CardDescription>
                  {paper.file_names && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {(paper.file_names as any)?.questionPapers?.map((n: string, i: number) => (
                        <Badge key={`qp-${i}`} variant="outline" className="text-xs font-normal">QP: {n}</Badge>
                      ))}
                      {(paper.file_names as any)?.textbooks?.map((n: string, i: number) => (
                        <Badge key={`tb-${i}`} variant="outline" className="text-xs font-normal">TB: {n}</Badge>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setExpanded(expanded === paper.id ? null : paper.id)}>
                    {expanded === paper.id ? "Collapse" : "View"}
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleDownload(paper)}>
                    <Download className="mr-1 h-3 w-3" /> PDF
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => handleDelete(paper.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardHeader>

              {expanded === paper.id && paper.generated_content?.questions && (
                <CardContent className="space-y-4 border-t pt-4">
                  {paper.generated_content.questions.map((q: any, i: number) => (
                    <div key={i} className="rounded-lg border border-border bg-muted/30 p-4">
                      <h3 className="mb-2 font-semibold text-foreground">Q{i + 1}. {q.question}</h3>
                      <div className="mb-2">
                        <h4 className="text-sm font-medium text-primary">Scheme:</h4>
                        <ul className="space-y-0.5 pl-4">
                          {q.scheme?.map((s: any, j: number) => (
                            <li key={j} className="flex justify-between text-sm text-muted-foreground">
                              <span>• {s.point}</span>
                              <span className="font-medium text-foreground">{s.marks}m</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <h4 className="text-sm font-medium text-accent">Solution:</h4>
                        <p className="whitespace-pre-wrap text-sm text-muted-foreground">{q.solution}</p>
                      </div>
                    </div>
                  ))}
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
