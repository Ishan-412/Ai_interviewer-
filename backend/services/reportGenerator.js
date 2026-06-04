const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

/**
 * Report Generator — PDF Report Generation using PDFKit
 * Creates professional, formatted PDF reports for candidates.
 */
class ReportGenerator {

  /**
   * Generate a comprehensive candidate report
   */
  async generateComprehensiveReport(data, outputPath) {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({
          size: 'A4',
          margins: { top: 50, bottom: 50, left: 50, right: 50 },
          info: {
            Title: `Assessment Report - ${data.candidateName}`,
            Author: 'AI Interview Platform',
            Subject: 'Candidate Assessment Report',
          }
        });

        const stream = fs.createWriteStream(outputPath);
        doc.pipe(stream);

        // ── Header ──────────────────────────
        this.drawHeader(doc, data);

        // ── Candidate Info ──────────────────
        this.drawCandidateInfo(doc, data);

        // ── Score Summary ───────────────────
        this.drawScoreSummary(doc, data);

        // ── Detailed Scores ─────────────────
        if (data.resumeScore !== undefined) {
          this.drawSection(doc, 'Resume Analysis', [
            { label: 'Overall Score', value: `${data.resumeScore}/100` },
            { label: 'Skills Detected', value: `${data.skillCount || 0} skills` },
            { label: 'Education', value: data.educationLevel || 'N/A' },
            { label: 'Experience', value: `${data.experienceYears || 0} years` },
          ]);
        }

        if (data.aptitudeScore !== undefined) {
          this.drawSection(doc, 'Aptitude Performance', [
            { label: 'Average Score', value: `${data.aptitudeScore}%` },
            { label: 'Tests Taken', value: `${data.testsTaken || 0}` },
            { label: 'Best Score', value: `${data.bestAptitudeScore || 0}%` },
          ]);
        }

        if (data.codingScore !== undefined) {
          this.drawSection(doc, 'Coding Assessment', [
            { label: 'Average Score', value: `${data.codingScore}/100` },
            { label: 'Problems Solved', value: `${data.problemsSolved || 0}` },
            { label: 'Acceptance Rate', value: `${data.acceptanceRate || 0}%` },
          ]);
        }

        if (data.interviewScore !== undefined) {
          this.drawSection(doc, 'Interview Performance', [
            { label: 'Average Score', value: `${data.interviewScore}/100` },
            { label: 'Sessions Completed', value: `${data.interviewsCompleted || 0}` },
            { label: 'Keyword Match', value: `${data.keywordMatchAvg || 0}%` },
          ]);
        }

        // ── Score Bars ──────────────────────
        this.drawScoreBars(doc, data);

        // ── Recommendations ─────────────────
        if (data.recommendations && data.recommendations.length > 0) {
          this.drawRecommendations(doc, data.recommendations);
        }

        // ── Skills Analysis ─────────────────
        if (data.skills && data.skills.length > 0) {
          this.drawSkillsSection(doc, data.skills);
        }

        // ── Footer ──────────────────────────
        this.drawFooter(doc, data);

        doc.end();

        stream.on('finish', () => resolve(outputPath));
        stream.on('error', reject);
      } catch (error) {
        reject(error);
      }
    });
  }

  // ─── Drawing Methods ─────────────────────────────────

  drawHeader(doc, data) {
    // Purple gradient header bar
    doc.rect(0, 0, doc.page.width, 80).fill('#4F46E5');
    
    doc.fontSize(22).fillColor('#FFFFFF')
      .text('AI INTERVIEW PLATFORM', 50, 20, { align: 'left' });
    
    doc.fontSize(11).fillColor('#C7D2FE')
      .text('Comprehensive Assessment Report', 50, 48, { align: 'left' });

    doc.fontSize(10).fillColor('#C7D2FE')
      .text(`Generated: ${new Date().toLocaleDateString('en-US', { 
        year: 'numeric', month: 'long', day: 'numeric' 
      })}`, 400, 48, { align: 'right' });

    doc.moveDown(2);
    doc.y = 100;
  }

  drawCandidateInfo(doc, data) {
    doc.fillColor('#1F2937').fontSize(16)
      .text(`Candidate: ${data.candidateName}`, 50);
    
    doc.fontSize(10).fillColor('#6B7280');
    if (data.email) doc.text(`Email: ${data.email}`);
    if (data.college) doc.text(`College: ${data.college}`);
    if (data.branch) doc.text(`Branch: ${data.branch}`);
    if (data.globalRank) doc.text(`Global Rank: #${data.globalRank}`);
    
    doc.moveDown(1);
    
    // Divider
    doc.strokeColor('#E5E7EB').lineWidth(1)
      .moveTo(50, doc.y).lineTo(545, doc.y).stroke();
    doc.moveDown(0.5);
  }

  drawScoreSummary(doc, data) {
    const y = doc.y;
    
    doc.fontSize(14).fillColor('#1F2937')
      .text('Overall Score Summary', 50, y);
    doc.moveDown(0.5);

    // Overall score box
    const boxY = doc.y;
    doc.roundedRect(50, boxY, 200, 60, 8)
      .fill('#4F46E5');
    
    doc.fontSize(28).fillColor('#FFFFFF')
      .text(`${data.overallScore || 0}`, 60, boxY + 8, { width: 180, align: 'center' });
    doc.fontSize(10)
      .text('OVERALL SCORE', 60, boxY + 40, { width: 180, align: 'center' });

    // Individual score boxes
    const scores = [
      { label: 'Aptitude', value: data.aptitudeScore || 0, color: '#7C3AED' },
      { label: 'Coding', value: data.codingScore || 0, color: '#2563EB' },
      { label: 'Interview', value: data.interviewScore || 0, color: '#059669' },
    ];

    let xOffset = 270;
    for (const s of scores) {
      doc.roundedRect(xOffset, boxY, 90, 60, 8).fill(s.color);
      doc.fontSize(18).fillColor('#FFFFFF')
        .text(`${s.value}`, xOffset + 5, boxY + 10, { width: 80, align: 'center' });
      doc.fontSize(8)
        .text(s.label.toUpperCase(), xOffset + 5, boxY + 38, { width: 80, align: 'center' });
      xOffset += 95;
    }

    doc.y = boxY + 75;
    doc.moveDown(0.5);
  }

  drawSection(doc, title, items) {
    // Check if we need a new page
    if (doc.y > 680) doc.addPage();

    doc.fontSize(13).fillColor('#4F46E5')
      .text(`▸ ${title}`, 50);
    doc.moveDown(0.3);

    for (const item of items) {
      doc.fontSize(10).fillColor('#374151')
        .text(`${item.label}: `, 70, doc.y, { continued: true })
        .fillColor('#1F2937').font('Helvetica-Bold')
        .text(item.value)
        .font('Helvetica');
    }

    doc.moveDown(0.5);
  }

  drawScoreBars(doc, data) {
    if (doc.y > 620) doc.addPage();

    doc.fontSize(13).fillColor('#4F46E5')
      .text('▸ Score Distribution', 50);
    doc.moveDown(0.3);

    const bars = [
      { label: 'Resume', score: data.resumeScore || 0, color: '#8B5CF6' },
      { label: 'Aptitude', score: data.aptitudeScore || 0, color: '#7C3AED' },
      { label: 'Coding', score: data.codingScore || 0, color: '#2563EB' },
      { label: 'Interview', score: data.interviewScore || 0, color: '#059669' },
    ];

    for (const bar of bars) {
      const barY = doc.y;
      
      // Label
      doc.fontSize(9).fillColor('#374151')
        .text(bar.label, 70, barY, { width: 60 });
      
      // Background bar
      doc.roundedRect(140, barY, 300, 14, 3).fill('#E5E7EB');
      
      // Score bar
      const barWidth = Math.max(2, (bar.score / 100) * 300);
      doc.roundedRect(140, barY, barWidth, 14, 3).fill(bar.color);
      
      // Score text
      doc.fontSize(9).fillColor('#374151')
        .text(`${bar.score}%`, 450, barY);
      
      doc.y = barY + 22;
    }

    doc.moveDown(0.5);
  }

  drawRecommendations(doc, recommendations) {
    if (doc.y > 620) doc.addPage();

    doc.fontSize(13).fillColor('#4F46E5')
      .text('▸ Recommendations', 50);
    doc.moveDown(0.3);

    for (const rec of recommendations) {
      doc.fontSize(9).fillColor('#374151')
        .text(`• ${rec}`, 70, doc.y, { width: 460 });
      doc.moveDown(0.2);
    }

    doc.moveDown(0.5);
  }

  drawSkillsSection(doc, skills) {
    if (doc.y > 650) doc.addPage();

    doc.fontSize(13).fillColor('#4F46E5')
      .text('▸ Detected Skills', 50);
    doc.moveDown(0.3);

    // Draw skills as tags
    let x = 70;
    let y = doc.y;

    for (const skill of skills.slice(0, 20)) {
      const width = doc.widthOfString(skill) + 16;
      
      if (x + width > 530) {
        x = 70;
        y += 22;
      }

      if (y > 750) break;

      doc.roundedRect(x, y, width, 18, 9).fill('#EDE9FE');
      doc.fontSize(8).fillColor('#5B21B6')
        .text(skill, x + 8, y + 4);
      
      x += width + 6;
    }

    doc.y = y + 28;
  }

  drawFooter(doc) {
    const pages = doc.bufferedPageRange();
    for (let i = 0; i < pages.count; i++) {
      doc.switchToPage(i);
      
      doc.fontSize(8).fillColor('#9CA3AF')
        .text(
          `AI Interview Platform • Page ${i + 1} of ${pages.count} • Confidential`,
          50, doc.page.height - 30,
          { align: 'center', width: doc.page.width - 100 }
        );
    }
  }
}

module.exports = new ReportGenerator();
