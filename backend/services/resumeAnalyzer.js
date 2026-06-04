const pdfParse = require('pdf-parse');
const fs = require('fs');
const { SKILLS_DATABASE, EDUCATION_KEYWORDS } = require('../utils/constants');

/**
 * Resume Analysis Engine
 * Rule-based intelligence for resume parsing and scoring.
 * No external AI APIs used.
 */
class ResumeAnalyzer {
  
  /**
   * Analyze a resume PDF file
   * @param {string} filePath - Path to the PDF file
   * @returns {Object} Analysis results
   */
  async analyze(filePath) {
    const dataBuffer = fs.readFileSync(filePath);
    const pdfData = await pdfParse(dataBuffer);
    const rawText = pdfData.text;
    const textLower = rawText.toLowerCase();
    
    const skills = this.detectSkills(textLower);
    const education = this.detectEducation(rawText, textLower);
    const experience = this.detectExperience(rawText, textLower);
    const projects = this.detectProjects(rawText);
    const sections = this.detectSections(rawText);
    
    const skillScore = this.calculateSkillScore(skills);
    const educationScore = this.calculateEducationScore(education);
    const experienceScore = this.calculateExperienceScore(experience);
    const formattingScore = this.calculateFormattingScore(rawText, sections);
    
    const overallScore = Math.round(
      (skillScore * 0.30 + educationScore * 0.20 + experienceScore * 0.25 + formattingScore * 0.15 + (sections.length / 6 * 10)) * 100
    ) / 100;

    const strengths = this.generateStrengths(skills, education, experience);
    const weaknesses = this.generateWeaknesses(skills, education, experience, sections);
    const suggestions = this.generateSuggestions(skills, education, experience, sections);

    return {
      rawText,
      detectedSkills: skills.all,
      skillsByCategory: skills.byCategory,
      detectedEducation: education,
      detectedExperience: experience,
      detectedProjects: projects,
      sections,
      skillScore: Math.min(100, skillScore),
      educationScore: Math.min(100, educationScore),
      experienceScore: Math.min(100, experienceScore),
      formattingScore: Math.min(100, formattingScore),
      overallScore: Math.min(100, overallScore),
      strengths,
      weaknesses,
      suggestions,
    };
  }

  /**
   * Detect skills from resume text
   */
  detectSkills(textLower) {
    const found = { all: [], byCategory: {} };
    
    for (const [category, skillList] of Object.entries(SKILLS_DATABASE)) {
      found.byCategory[category] = [];
      for (const skill of skillList) {
        // Use word boundary matching to avoid false positives
        const regex = new RegExp(`\\b${skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
        if (regex.test(textLower)) {
          if (!found.all.includes(skill)) {
            found.all.push(skill);
          }
          found.byCategory[category].push(skill);
        }
      }
    }
    
    return found;
  }

  /**
   * Detect education information
   */
  detectEducation(rawText, textLower) {
    const education = {
      degrees: [],
      institutions: [],
      year: null,
      level: 'unknown',
    };

    // Detect degrees
    for (const degree of EDUCATION_KEYWORDS.degrees) {
      const regex = new RegExp(`\\b${degree.replace(/\./g, '\\.')}\\b`, 'i');
      if (regex.test(textLower)) {
        education.degrees.push(degree.toUpperCase());
      }
    }

    // Detect graduation year
    const yearMatches = rawText.match(/20[1-3]\d/g);
    if (yearMatches) {
      education.year = Math.max(...yearMatches.map(Number));
    }

    // Detect institutions
    for (const inst of EDUCATION_KEYWORDS.institutions) {
      const regex = new RegExp(`\\b${inst}\\b`, 'i');
      if (regex.test(textLower)) {
        education.institutions.push(inst.toUpperCase());
      }
    }

    // Detect CGPA/GPA
    const cgpaMatch = rawText.match(/(?:cgpa|gpa|percentage)[:\s]*(\d+\.?\d*)/i);
    if (cgpaMatch) {
      education.cgpa = parseFloat(cgpaMatch[1]);
    }

    // Determine education level
    if (education.degrees.some(d => ['PHD', 'PH.D', 'DOCTORATE'].includes(d))) {
      education.level = 'doctorate';
    } else if (education.degrees.some(d => ['M.TECH', 'MTECH', 'M.E', 'MSC', 'M.SC', 'MCA', 'MBA', 'MASTER'].includes(d))) {
      education.level = 'masters';
    } else if (education.degrees.some(d => ['B.TECH', 'BTECH', 'B.E', 'BE', 'BSC', 'B.SC', 'BCA', 'BBA', 'BACHELOR'].includes(d))) {
      education.level = 'bachelors';
    } else if (education.degrees.some(d => ['DIPLOMA'].includes(d))) {
      education.level = 'diploma';
    }

    return education;
  }

  /**
   * Detect work experience
   */
  detectExperience(rawText, textLower) {
    const experience = {
      years: 0,
      roles: [],
      hasInternship: false,
    };

    // Detect years of experience
    const expMatches = textLower.match(/(\d+)\+?\s*(?:years?|yrs?)\s*(?:of\s*)?(?:experience|exp)/i);
    if (expMatches) {
      experience.years = parseInt(expMatches[1]);
    }

    // Detect common role titles
    const roles = [
      'software engineer', 'developer', 'frontend developer', 'backend developer',
      'full stack developer', 'data scientist', 'data analyst', 'web developer',
      'mobile developer', 'devops engineer', 'qa engineer', 'test engineer',
      'project manager', 'product manager', 'intern', 'trainee', 'associate',
      'senior', 'junior', 'lead', 'architect', 'consultant', 'analyst',
    ];

    for (const role of roles) {
      if (textLower.includes(role)) {
        experience.roles.push(role);
      }
    }

    experience.hasInternship = textLower.includes('intern') || textLower.includes('internship');

    // Try to extract from date ranges (e.g., "Jan 2020 - Dec 2022")
    const dateRanges = rawText.match(/(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s*\d{4}\s*[-–]\s*(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s*\d{4}/gi);
    if (dateRanges && experience.years === 0) {
      // Estimate experience from date ranges
      let totalMonths = 0;
      for (const range of dateRanges) {
        const years = range.match(/\d{4}/g);
        if (years && years.length === 2) {
          totalMonths += (parseInt(years[1]) - parseInt(years[0])) * 12;
        }
      }
      experience.years = Math.round(totalMonths / 12);
    }

    return experience;
  }

  /**
   * Detect projects mentioned in resume
   */
  detectProjects(rawText) {
    const projects = [];
    const lines = rawText.split('\n');
    let inProjectSection = false;
    let currentProject = null;

    for (const line of lines) {
      const trimmed = line.trim();
      if (/^projects?$/i.test(trimmed) || /^personal\s*projects?$/i.test(trimmed) || /^academic\s*projects?$/i.test(trimmed)) {
        inProjectSection = true;
        continue;
      }
      
      if (inProjectSection) {
        if (/^(education|experience|skills|certifications|achievements|awards|hobbies|references)/i.test(trimmed)) {
          inProjectSection = false;
          if (currentProject) projects.push(currentProject);
          continue;
        }
        
        if (trimmed.length > 5 && trimmed.length < 100 && /^[A-Z]/.test(trimmed) && !trimmed.startsWith('•') && !trimmed.startsWith('-')) {
          if (currentProject) projects.push(currentProject);
          currentProject = { title: trimmed, description: '' };
        } else if (currentProject && trimmed.length > 0) {
          currentProject.description += trimmed + ' ';
        }
      }
    }
    if (currentProject) projects.push(currentProject);

    return projects.slice(0, 5); // Max 5 projects
  }

  /**
   * Detect sections present in resume
   */
  detectSections(rawText) {
    const sectionNames = [
      'education', 'experience', 'skills', 'projects', 'certifications',
      'achievements', 'awards', 'summary', 'objective', 'hobbies',
      'interests', 'references', 'contact', 'publications', 'courses',
    ];
    
    const found = [];
    const textLower = rawText.toLowerCase();
    
    for (const section of sectionNames) {
      const regex = new RegExp(`\\b${section}\\b`, 'i');
      if (regex.test(textLower)) {
        found.push(section);
      }
    }
    
    return found;
  }

  /**
   * Calculate skill score (0-100)
   */
  calculateSkillScore(skills) {
    const total = skills.all.length;
    if (total === 0) return 10;
    if (total <= 3) return 30;
    if (total <= 6) return 50;
    if (total <= 10) return 70;
    if (total <= 15) return 85;
    return 95;
  }

  /**
   * Calculate education score (0-100)
   */
  calculateEducationScore(education) {
    let score = 20; // Base score
    
    switch (education.level) {
      case 'doctorate': score = 95; break;
      case 'masters': score = 85; break;
      case 'bachelors': score = 70; break;
      case 'diploma': score = 55; break;
      default: score = 20;
    }

    if (education.cgpa) {
      if (education.cgpa >= 9) score = Math.min(100, score + 10);
      else if (education.cgpa >= 8) score = Math.min(100, score + 5);
    }

    if (education.institutions.length > 0) score = Math.min(100, score + 5);

    return score;
  }

  /**
   * Calculate experience score (0-100)
   */
  calculateExperienceScore(experience) {
    let score = 15; // Base for freshers
    
    if (experience.hasInternship) score = 35;
    if (experience.years >= 1) score = 50;
    if (experience.years >= 2) score = 65;
    if (experience.years >= 3) score = 75;
    if (experience.years >= 5) score = 85;
    if (experience.years >= 8) score = 95;

    if (experience.roles.length > 2) score = Math.min(100, score + 5);

    return score;
  }

  /**
   * Calculate formatting score (0-100)
   */
  calculateFormattingScore(rawText, sections) {
    let score = 30; // Base score
    
    const wordCount = rawText.split(/\s+/).length;
    
    // Good length (300-1500 words)
    if (wordCount >= 300 && wordCount <= 1500) score += 20;
    else if (wordCount >= 150 && wordCount <= 2000) score += 10;

    // Has proper sections
    if (sections.length >= 4) score += 20;
    else if (sections.length >= 2) score += 10;

    // Has contact info
    const hasEmail = /[\w.-]+@[\w.-]+\.\w+/.test(rawText);
    const hasPhone = /[\d]{10,}/.test(rawText.replace(/\s/g, ''));
    if (hasEmail) score += 10;
    if (hasPhone) score += 10;

    // Not too many special characters (indicates poor formatting)
    const specialCharRatio = (rawText.match(/[^\w\s.,;:!?()-]/g) || []).length / rawText.length;
    if (specialCharRatio < 0.05) score += 10;

    return Math.min(100, score);
  }

  /**
   * Generate strength points
   */
  generateStrengths(skills, education, experience) {
    const strengths = [];
    
    if (skills.all.length >= 10) strengths.push('Strong and diverse technical skill set');
    if (skills.byCategory.programming?.length >= 3) strengths.push('Proficient in multiple programming languages');
    if (skills.byCategory.web?.length >= 3) strengths.push('Good web development knowledge');
    if (skills.byCategory.database?.length >= 2) strengths.push('Database management experience');
    if (skills.byCategory.ai_ml?.length >= 2) strengths.push('AI/ML knowledge is a strong differentiator');
    if (skills.byCategory.cloud?.length >= 2) strengths.push('Cloud computing skills are in high demand');
    if (skills.byCategory.cs_fundamentals?.length >= 2) strengths.push('Strong computer science fundamentals');
    if (education.level === 'masters' || education.level === 'doctorate') strengths.push('Advanced educational qualification');
    if (education.cgpa >= 8) strengths.push('Strong academic performance');
    if (experience.years >= 2) strengths.push(`${experience.years} years of relevant experience`);
    if (experience.hasInternship) strengths.push('Practical internship experience');
    
    return strengths.length > 0 ? strengths : ['Resume uploaded successfully'];
  }

  /**
   * Generate weakness points
   */
  generateWeaknesses(skills, education, experience, sections) {
    const weaknesses = [];
    
    if (skills.all.length < 5) weaknesses.push('Limited technical skills listed');
    if (skills.byCategory.programming?.length < 2) weaknesses.push('Should learn more programming languages');
    if (!skills.byCategory.database?.length) weaknesses.push('No database skills mentioned');
    if (!skills.byCategory.tools?.length) weaknesses.push('No development tools mentioned');
    if (education.level === 'unknown') weaknesses.push('Education details not clearly mentioned');
    if (experience.years === 0 && !experience.hasInternship) weaknesses.push('No work experience or internship mentioned');
    if (sections.length < 3) weaknesses.push('Resume lacks structured sections');
    if (!sections.includes('projects')) weaknesses.push('No projects section found');
    
    return weaknesses.length > 0 ? weaknesses : ['No significant weaknesses detected'];
  }

  /**
   * Generate improvement suggestions
   */
  generateSuggestions(skills, education, experience, sections) {
    const suggestions = [];
    
    if (skills.all.length < 8) suggestions.push('Add more relevant technical skills to your resume');
    if (!skills.byCategory.cloud?.length) suggestions.push('Consider learning cloud technologies (AWS, Docker, Kubernetes)');
    if (!skills.byCategory.ai_ml?.length) suggestions.push('Adding AI/ML skills can make your profile stand out');
    if (!sections.includes('projects')) suggestions.push('Add a projects section to showcase practical work');
    if (!sections.includes('certifications')) suggestions.push('Include relevant certifications to strengthen your profile');
    if (!sections.includes('achievements')) suggestions.push('Add an achievements/awards section');
    if (experience.years === 0) suggestions.push('Consider adding internship or freelance experience');
    if (!skills.byCategory.tools?.length) suggestions.push('Mention tools you use: Git, VS Code, Jira, etc.');
    suggestions.push('Keep your resume concise (1-2 pages recommended)');
    suggestions.push('Use action verbs to describe your experiences');
    
    return suggestions.slice(0, 6);
  }
}

module.exports = new ResumeAnalyzer();
