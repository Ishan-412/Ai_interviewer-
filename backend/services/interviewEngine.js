const { STOPWORDS } = require('../utils/constants');

/**
 * Interview Engine — Rule-Based Interview Evaluation
 * Uses keyword matching and NLP heuristics to evaluate answers.
 * No external AI APIs used.
 */
class InterviewEngine {

  /**
   * Select questions for an interview session
   * @param {Array} questionBank - Available questions
   * @param {string} category - Interview category
   * @param {number} count - Number of questions to select
   * @returns {Array} Selected questions
   */
  selectQuestions(questionBank, category, count = 10) {
    let filtered = questionBank;
    
    if (category !== 'mixed') {
      filtered = questionBank.filter(q => q.category === category);
    }

    // Mix difficulties: 30% easy, 50% medium, 20% hard
    const easy = filtered.filter(q => q.difficulty === 'easy');
    const medium = filtered.filter(q => q.difficulty === 'medium');
    const hard = filtered.filter(q => q.difficulty === 'hard');

    const easyCount = Math.ceil(count * 0.3);
    const hardCount = Math.floor(count * 0.2);
    const mediumCount = count - easyCount - hardCount;

    const selected = [
      ...this.shuffleAndPick(easy, easyCount),
      ...this.shuffleAndPick(medium, mediumCount),
      ...this.shuffleAndPick(hard, hardCount),
    ];

    // If we don't have enough of one difficulty, fill from others
    if (selected.length < count) {
      const remaining = filtered.filter(q => !selected.includes(q));
      const fill = this.shuffleAndPick(remaining, count - selected.length);
      selected.push(...fill);
    }

    return this.shuffle(selected).slice(0, count);
  }

  /**
   * Evaluate a candidate's answer against expected keywords
   * @param {string} answer - Candidate's answer
   * @param {Array} expectedKeywords - Expected keywords
   * @param {string} difficulty - Question difficulty
   * @returns {Object} Evaluation result
   */
  evaluateAnswer(answer, expectedKeywords, difficulty = 'medium') {
    if (!answer || !expectedKeywords || expectedKeywords.length === 0) {
      return {
        score: 0,
        matchedKeywords: [],
        missedKeywords: expectedKeywords || [],
        keywordMatchPercentage: 0,
        feedback: 'No answer provided.',
        strengths: [],
        improvements: ['Please provide a detailed answer.'],
      };
    }

    // Tokenize and normalize the answer
    const answerTokens = this.tokenize(answer);
    const answerLower = answer.toLowerCase();

    // Check keyword matches (including partial matches and synonyms)
    const matchedKeywords = [];
    const missedKeywords = [];

    for (const keyword of expectedKeywords) {
      const keywordLower = keyword.toLowerCase();
      
      // Direct match
      if (answerLower.includes(keywordLower)) {
        matchedKeywords.push(keyword);
        continue;
      }

      // Check if any token matches
      const keywordTokens = keywordLower.split(/\s+/);
      const allTokensFound = keywordTokens.every(kt => 
        answerTokens.some(at => at.includes(kt) || kt.includes(at))
      );

      if (allTokensFound) {
        matchedKeywords.push(keyword);
        continue;
      }

      // Check synonyms
      if (this.hasSynonymMatch(answerLower, keywordLower)) {
        matchedKeywords.push(keyword);
        continue;
      }

      missedKeywords.push(keyword);
    }

    // Calculate scores
    const keywordMatchPercentage = Math.round(
      (matchedKeywords.length / expectedKeywords.length) * 100
    );

    // Factor in answer length
    const wordCount = answerTokens.length;
    const lengthFactor = this.calculateLengthFactor(wordCount);

    // Factor in difficulty
    const difficultyMultiplier = difficulty === 'hard' ? 1.2 : difficulty === 'easy' ? 0.8 : 1.0;

    // Calculate final score (0-100)
    let score = Math.round(
      (keywordMatchPercentage * 0.7 + lengthFactor * 0.3) * difficultyMultiplier
    );
    score = Math.min(100, Math.max(0, score));

    // Generate feedback
    const feedback = this.generateFeedback(score, matchedKeywords, missedKeywords, wordCount);
    const strengths = this.generateAnswerStrengths(score, matchedKeywords, wordCount);
    const improvements = this.generateImprovements(score, missedKeywords, wordCount);

    return {
      score,
      matchedKeywords,
      missedKeywords,
      keywordMatchPercentage,
      feedback,
      strengths,
      improvements,
    };
  }

  /**
   * Generate session-level summary after all questions are answered
   */
  generateSessionSummary(evaluations) {
    if (!evaluations || evaluations.length === 0) {
      return {
        overallScore: 0,
        keywordMatchAvg: 0,
        strengths: ['No answers evaluated'],
        weaknesses: ['Complete more questions to get feedback'],
        recommendations: ['Try answering all interview questions'],
      };
    }

    const overallScore = Math.round(
      evaluations.reduce((sum, e) => sum + e.score, 0) / evaluations.length
    );

    const keywordMatchAvg = Math.round(
      evaluations.reduce((sum, e) => sum + e.keywordMatchPercentage, 0) / evaluations.length
    );

    const strengths = [];
    const weaknesses = [];
    const recommendations = [];

    if (overallScore >= 80) {
      strengths.push('Excellent understanding of core concepts');
      strengths.push('Comprehensive and well-structured answers');
    } else if (overallScore >= 60) {
      strengths.push('Good foundational knowledge');
      strengths.push('Decent coverage of key topics');
    } else if (overallScore >= 40) {
      strengths.push('Basic understanding demonstrated');
    }

    if (keywordMatchAvg >= 70) {
      strengths.push('Strong technical vocabulary');
    }

    // Find consistently missed keywords
    const allMissed = evaluations.flatMap(e => e.missedKeywords);
    const missedCounts = {};
    for (const kw of allMissed) {
      missedCounts[kw] = (missedCounts[kw] || 0) + 1;
    }

    const frequentlyMissed = Object.entries(missedCounts)
      .filter(([, count]) => count >= 2)
      .map(([kw]) => kw);

    if (frequentlyMissed.length > 0) {
      weaknesses.push(`Frequently missed concepts: ${frequentlyMissed.slice(0, 5).join(', ')}`);
    }

    if (overallScore < 60) {
      weaknesses.push('Need deeper understanding of technical concepts');
      recommendations.push('Review fundamental concepts in computer science');
      recommendations.push('Practice explaining technical concepts clearly');
    }

    if (overallScore < 40) {
      weaknesses.push('Answers lack sufficient technical detail');
      recommendations.push('Study each topic thoroughly before interviews');
    }

    if (keywordMatchAvg < 50) {
      recommendations.push('Use more technical terminology in your answers');
    }

    // Count scores by category
    const lowScores = evaluations.filter(e => e.score < 40).length;
    const highScores = evaluations.filter(e => e.score >= 80).length;

    if (lowScores > evaluations.length * 0.5) {
      recommendations.push('Focus on improving weak areas before your next interview');
    }

    if (highScores > evaluations.length * 0.7) {
      strengths.push('Consistently high-quality answers');
      recommendations.push('You are well-prepared — keep practicing to maintain this level');
    }

    recommendations.push('Practice mock interviews regularly to build confidence');
    recommendations.push('Read about industry trends and latest technologies');

    return {
      overallScore,
      keywordMatchAvg,
      strengths: strengths.slice(0, 5),
      weaknesses: weaknesses.length > 0 ? weaknesses.slice(0, 5) : ['No significant weaknesses'],
      recommendations: recommendations.slice(0, 5),
    };
  }

  // ─── Private Helpers ────────────────────────────────────

  tokenize(text) {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s+#.-]/g, ' ')
      .split(/\s+/)
      .filter(t => t.length > 1 && !STOPWORDS.has(t));
  }

  calculateLengthFactor(wordCount) {
    if (wordCount < 10) return 15;
    if (wordCount < 25) return 40;
    if (wordCount < 50) return 60;
    if (wordCount < 100) return 80;
    if (wordCount <= 200) return 95;
    return 85; // Slightly penalize very long answers
  }

  hasSynonymMatch(text, keyword) {
    const synonyms = {
      'linked list': ['linkedlist', 'singly linked', 'doubly linked', 'chain of nodes'],
      'array': ['arrays', 'list', 'vector'],
      'pointer': ['pointers', 'reference', 'address', 'memory address'],
      'dynamic': ['runtime', 'heap', 'dynamic allocation', 'dynamically'],
      'node': ['nodes', 'element', 'vertex'],
      'recursion': ['recursive', 'self-calling', 'divide and conquer'],
      'algorithm': ['algorithms', 'algo', 'algorithmic'],
      'database': ['db', 'dbms', 'data store'],
      'object oriented': ['oop', 'oops', 'object-oriented'],
      'polymorphism': ['poly', 'method overriding', 'method overloading'],
      'inheritance': ['extends', 'derived class', 'parent class', 'base class'],
      'encapsulation': ['data hiding', 'access modifiers', 'private', 'protected'],
      'abstraction': ['abstract class', 'interface', 'abstract'],
      'stack': ['lifo', 'last in first out', 'push pop'],
      'queue': ['fifo', 'first in first out', 'enqueue dequeue'],
      'tree': ['binary tree', 'bst', 'binary search tree'],
      'hash': ['hashing', 'hash table', 'hash map', 'hashmap', 'dictionary'],
      'complexity': ['time complexity', 'space complexity', 'big o', 'o(n)'],
      'api': ['rest api', 'restful', 'endpoint', 'web service'],
      'testing': ['unit test', 'test cases', 'qa', 'quality assurance'],
      'agile': ['scrum', 'sprint', 'kanban', 'iterative'],
      'version control': ['git', 'github', 'branching', 'merge'],
    };

    for (const [key, syns] of Object.entries(synonyms)) {
      if (keyword.includes(key) || key.includes(keyword)) {
        if (syns.some(s => text.includes(s))) return true;
      }
    }
    return false;
  }

  generateFeedback(score, matched, missed, wordCount) {
    if (score >= 90) return 'Excellent answer! You demonstrated comprehensive knowledge and covered all key concepts.';
    if (score >= 75) return 'Great answer! You covered most key points. A few more details would make it perfect.';
    if (score >= 60) return 'Good answer with decent coverage. Try to include more specific technical details.';
    if (score >= 40) return 'Fair answer. You touched on some concepts but missed several important points.';
    if (score >= 20) return 'Your answer needs significant improvement. Study the topic more thoroughly.';
    return 'Very limited answer. Please review this topic and provide a more comprehensive response.';
  }

  generateAnswerStrengths(score, matchedKeywords, wordCount) {
    const strengths = [];
    if (matchedKeywords.length > 0) strengths.push(`Correctly mentioned: ${matchedKeywords.join(', ')}`);
    if (wordCount >= 50) strengths.push('Detailed response with good explanation');
    if (score >= 70) strengths.push('Strong conceptual understanding');
    return strengths.length > 0 ? strengths : ['Attempted the question'];
  }

  generateImprovements(score, missedKeywords, wordCount) {
    const improvements = [];
    if (missedKeywords.length > 0) improvements.push(`Also mention: ${missedKeywords.join(', ')}`);
    if (wordCount < 30) improvements.push('Provide a more detailed and elaborate answer');
    if (score < 50) improvements.push('Review this topic from textbooks or reliable sources');
    return improvements.length > 0 ? improvements : ['Keep up the good work!'];
  }

  shuffle(array) {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  shuffleAndPick(array, count) {
    return this.shuffle(array).slice(0, count);
  }
}

module.exports = new InterviewEngine();
