import jsPDF from "jspdf";

interface SchemeItem {
  point: string;
  marks: number;
}

interface QuestionResult {
  question: string;
  scheme: SchemeItem[];
  solution: string;
}

interface GeneratedResult {
  questions: QuestionResult[];
}

export function generatePDF(result: GeneratedResult, title: string, templateType: string) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 20;

  const checkPage = (needed: number) => {
    if (y + needed > 270) {
      doc.addPage();
      y = 20;
    }
  };

  // Title
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text(title, pageWidth / 2, y, { align: "center" });
  y += 8;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  const templateLabel =
    templateType === "vtu" ? "VTU Format" :
    templateType === "autonomous" ? "Autonomous College Format" : "Simple Exam Format";
  doc.text(`Template: ${templateLabel}`, pageWidth / 2, y, { align: "center" });
  y += 12;

  doc.setDrawColor(180);
  doc.line(14, y, pageWidth - 14, y);
  y += 8;

  result.questions.forEach((q, i) => {
    checkPage(60);

    // Question
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    const qLines = doc.splitTextToSize(`Q${i + 1}. ${q.question}`, pageWidth - 28);
    doc.text(qLines, 14, y);
    y += qLines.length * 6 + 4;

    // Scheme
    checkPage(20);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("Marking Scheme:", 14, y);
    y += 6;

    doc.setFont("helvetica", "normal");
    q.scheme.forEach((s) => {
      checkPage(8);
      const line = `• ${s.point}`;
      const lines = doc.splitTextToSize(line, pageWidth - 55);
      doc.text(lines, 18, y);
      doc.text(`${s.marks} marks`, pageWidth - 14, y, { align: "right" });
      y += lines.length * 5 + 2;
    });
    y += 3;

    // Solution
    checkPage(20);
    doc.setFont("helvetica", "bold");
    doc.text("Solution:", 14, y);
    y += 6;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    const solLines = doc.splitTextToSize(q.solution, pageWidth - 32);
    solLines.forEach((line: string) => {
      checkPage(6);
      doc.text(line, 18, y);
      y += 5;
    });

    y += 6;
    doc.setDrawColor(220);
    doc.line(14, y, pageWidth - 14, y);
    y += 8;
  });

  doc.save(`${title.replace(/\s+/g, "_")}_scheme.pdf`);
}
